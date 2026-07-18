/**
 * SDD-0157 — Campaña de recuperación Kommo. Lógica del universo de contactos
 * del espejo cruzado contra los clientes del ERP, para tocar la base warm por
 * WhatsApp (tandas manuales) o SMS (export CSV).
 *
 * READ-ONLY: no escribe ni en el espejo ni en Kommo. El registro del toque se
 * hace en Kommo mismo (nota/tarea del asesor) — Slice B persistiría el toque.
 *
 * El teléfono/email del contacto viven en `custom_fields` (jsonb) → se parsean
 * en JS con `parseContactFields` (kommo-convert) y se matchean contra `clients`
 * con `phonesMatch`/`emailsMatch` (estimado-linking). Todo lo que no toca la DB
 * es PURO y testeable.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseContactFields } from "./kommo-convert";
import {
  buildProspectWaLink,
  normalizePhone,
} from "./estimado-linking";

/** Tope de contactos traídos del espejo (mismo cap que la analítica SDD-0078). */
export const RECOVERY_UNIVERSE_CAP = 5000;
/** Filas máximas que viajan a la UI por carga (el server filtra antes). */
export const RECOVERY_LIST_CAP = 300;
/** Tandas de WhatsApp manual (mismo tope que las invitaciones del portal). */
export const RECOVERY_WA_BATCH_MAX = 10;

export type RecoverySegment = "cliente" | "interesado";

export type RecoveryRow = {
  contactId: number;
  name: string;
  phone: string;
  email: string | null;
  /** Última actividad del contacto en Kommo (ISO) — proxy de "qué tan frío". */
  lastActivity: string | null;
  /** Días desde la última actividad (null = sin fecha). */
  days: number | null;
  segment: RecoverySegment;
  /** Si es cliente: su Shipping Mark (markbox) y nombre en el ERP. */
  markbox: string | null;
  clientName: string | null;
};

export type RecoveryUniverse = {
  rows: RecoveryRow[];
  /** Contactos del espejo sin teléfono usable (fuera de WhatsApp/SMS). */
  noPhone: number;
  /** De los sin-teléfono, cuántos al menos tienen email (pool campaña correo). */
  noPhoneWithEmail: number;
  /** Duplicados colapsados por teléfono (misma persona, varios contactos). */
  deduped: number;
  /** Cuántos contactos trajo la query (para avisar si pegó el cap). */
  fetched: number;
  cap: number;
};

export type RecoveryFilters = {
  segment?: RecoverySegment;
  /** Solo contactos sin actividad hace ≥ N días. */
  agedDays?: number;
  /** Búsqueda por nombre o teléfono (subcadena, case-insensitive). */
  q?: string;
  /** Orden por última actividad: viejos primero (default) o recientes. */
  sort?: "oldest" | "recent";
};

const DAY_MS = 86_400_000;

type ContactInput = {
  id: number;
  name: string | null;
  custom_fields: unknown;
  kommo_updated_at: string | null;
};

type ClientInput = {
  markbox: string;
  name: string | null;
  phone: string | null;
  email: string | null;
};

function daysSince(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((nowMs - t) / DAY_MS));
}

/**
 * Clasifica los contactos del espejo contra los clientes del ERP. PURA.
 * - Match por teléfono (últimos 10 dígitos) o, si no, por email exacto.
 * - Dedupe por teléfono: mismos últimos 10 dígitos = misma persona → queda el
 *   contacto con actividad más reciente (una persona, un toque).
 * - Sin teléfono usable (<10 dígitos) → fuera de la campaña (contadores).
 */
export function classifyRecoveryContacts(
  contacts: ContactInput[],
  clients: ClientInput[],
  nowMs: number,
): Omit<RecoveryUniverse, "fetched" | "cap"> {
  // Índice de clientes por sufijo de teléfono y por email (para match O(1)).
  const clientByPhone = new Map<string, ClientInput>();
  const clientByEmail = new Map<string, ClientInput>();
  for (const c of clients) {
    const p = normalizePhone(c.phone);
    if (p.length >= 10 && !clientByPhone.has(p.slice(-10))) {
      clientByPhone.set(p.slice(-10), c);
    }
    const e = (c.email ?? "").trim().toLowerCase();
    if (e && !clientByEmail.has(e)) clientByEmail.set(e, c);
  }

  let noPhone = 0;
  let noPhoneWithEmail = 0;
  let deduped = 0;
  const byPhoneKey = new Map<string, RecoveryRow>();

  for (const c of contacts) {
    const { email, phone } = parseContactFields(c.custom_fields);
    const digits = normalizePhone(phone);
    if (digits.length < 10) {
      noPhone += 1;
      if (email) noPhoneWithEmail += 1;
      continue;
    }
    const key = digits.slice(-10);

    const emailNorm = (email ?? "").trim().toLowerCase();
    const client =
      clientByPhone.get(key) ??
      (emailNorm ? clientByEmail.get(emailNorm) : undefined) ??
      null;

    const row: RecoveryRow = {
      contactId: c.id,
      name: c.name?.trim() || `Contacto ${c.id}`,
      phone: phone ?? digits,
      email: email,
      lastActivity: c.kommo_updated_at,
      days: daysSince(c.kommo_updated_at, nowMs),
      segment: client ? "cliente" : "interesado",
      markbox: client?.markbox ?? null,
      clientName: client?.name ?? null,
    };

    const prev = byPhoneKey.get(key);
    if (!prev) {
      byPhoneKey.set(key, row);
    } else {
      deduped += 1;
      // Queda el de actividad más reciente (null pierde contra fecha).
      const prevT = prev.lastActivity ? Date.parse(prev.lastActivity) : -1;
      const curT = row.lastActivity ? Date.parse(row.lastActivity) : -1;
      if (curT > prevT) byPhoneKey.set(key, row);
    }
  }

  return {
    rows: Array.from(byPhoneKey.values()),
    noPhone,
    noPhoneWithEmail,
    deduped,
  };
}

/** Aplica filtros + orden al universo. PURA. */
export function filterRecoveryRows(
  rows: RecoveryRow[],
  f: RecoveryFilters,
): RecoveryRow[] {
  let out = rows;
  if (f.segment) out = out.filter((r) => r.segment === f.segment);
  if (f.agedDays != null && f.agedDays > 0) {
    const min = f.agedDays;
    out = out.filter((r) => r.days != null && r.days >= min);
  }
  const term = (f.q ?? "").trim().toLowerCase();
  if (term) {
    const termDigits = normalizePhone(term);
    out = out.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        (termDigits.length >= 4 && normalizePhone(r.phone).includes(termDigits)) ||
        (r.markbox ?? "").toLowerCase().includes(term),
    );
  }
  const sorted = [...out];
  if (f.sort === "recent") {
    // Recientes primero; sin fecha al final.
    sorted.sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity));
  } else {
    // Default "oldest": los más fríos primero; sin fecha al final.
    sorted.sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
  }
  return sorted;
}

/** Plantillas default del guion por segmento (editables en la UI, `{nombre}`). */
export const RECOVERY_TEMPLATES: Record<RecoverySegment, string> = {
  cliente:
    "¡Hola {nombre}! Te saluda el equipo de DTD Cargo. Tenemos tiempo sin saber de ti y estamos " +
    "cerrando el próximo consolidado desde Yiwu. ¿Te toca reponer mercancía? Te preparo números " +
    "sin compromiso — y recuerda: con nosotros pagas al llegar, sin adelantos.",
  interesado:
    "¡Hola {nombre}! Te saluda el equipo de DTD Cargo. Hace un tiempo nos escribiste por traer " +
    "mercancía de China y quedó pendiente. Seguimos con el servicio puerta a puerta: pagas cuando " +
    "tu carga llega, sin adelantos ni sorpresas de aduana. ¿Te armo un estimado?",
};

/** Interpola `{nombre}` con el primer nombre del contacto. PURA. */
export function buildRecoveryMessage(template: string, fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] || fullName.trim();
  return template.replaceAll("{nombre}", first);
}

/** Link wa.me al contacto con el guion prellenado (null si el nº no da). PURA. */
export function buildRecoveryWaLink(
  row: Pick<RecoveryRow, "phone" | "name">,
  template: string,
): string | null {
  const base = buildProspectWaLink(row.phone);
  if (!base) return null;
  const msg = buildRecoveryMessage(template, row.name);
  return `${base}?text=${encodeURIComponent(msg)}`;
}

function csvCell(v: string): string {
  return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * CSV para el proveedor de SMS: nombre, teléfono (solo dígitos, formato
 * internacional 58…), segmento, días sin actividad, markbox. PURA — el BOM lo
 * antepone `downloadTextFile` al descargar.
 */
export function buildRecoverySmsCsv(rows: RecoveryRow[]): string {
  const header = "nombre,telefono,segmento,dias_inactivo,shipping_mark";
  const lines = rows.map((r) => {
    let digits = normalizePhone(r.phone);
    if (digits.length === 11 && digits.startsWith("0")) digits = "58" + digits.slice(1);
    return [
      csvCell(r.name),
      digits,
      r.segment,
      r.days == null ? "" : String(r.days),
      r.markbox ?? "",
    ].join(",");
  });
  return [header, ...lines].join("\n");
}

/**
 * Trae y clasifica el universo completo: contactos del espejo (cap 5000, los
 * más recientes) × clientes vivos del ERP. RLS filtra ambos por tenant.
 */
export async function getRecoveryUniverse(
  supabase: SupabaseClient,
  nowMs = Date.now(),
): Promise<RecoveryUniverse> {
  const [contactsRes, clientsRes] = await Promise.all([
    supabase
      .from("kommo_contacts")
      .select("id, name, custom_fields, kommo_updated_at")
      .order("kommo_updated_at", { ascending: false, nullsFirst: false })
      .limit(RECOVERY_UNIVERSE_CAP),
    supabase
      .from("clients")
      .select("markbox, name, phone, email")
      .is("deleted_at", null),
  ]);
  if (contactsRes.error) throw contactsRes.error;
  if (clientsRes.error) throw clientsRes.error;

  const contacts = (contactsRes.data as ContactInput[] | null) ?? [];
  const clients = (clientsRes.data as ClientInput[] | null) ?? [];
  const classified = classifyRecoveryContacts(contacts, clients, nowMs);
  return {
    ...classified,
    fetched: contacts.length,
    cap: RECOVERY_UNIVERSE_CAP,
  };
}

/** Parse de los searchParams de la pestaña (`rseg`, `raged`, `rq`, `rsort`). */
export function parseRecoveryFilters(
  raw: Record<string, string | string[] | undefined>,
): RecoveryFilters {
  const single = (k: string): string | undefined => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const seg = single("rseg");
  const aged = Number(single("raged"));
  const q = (single("rq") ?? "").trim();
  return {
    segment: seg === "cliente" || seg === "interesado" ? seg : undefined,
    agedDays: Number.isFinite(aged) && aged > 0 ? aged : undefined,
    q: q || undefined,
    sort: single("rsort") === "recent" ? "recent" : "oldest",
  };
}
