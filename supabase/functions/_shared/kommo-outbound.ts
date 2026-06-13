// SDD-0074 · builders PUROS para el push del alta a Kommo (outbound de creación).
//
// Igual que `_shared/kommo-mapping.ts`: TS puro, SIN globals de Deno ni deps, para que
//   1. la Edge Function `kommo-push-client` los importe vía `../_shared/kommo-outbound.ts`,
//   2. Vitest los testee dentro de `node scripts/verify.mjs` (la Edge Function en sí, con
//      Deno.serve + HTTP, NO la ve el gate → toda la lógica decidible vive acá y se testea).
//
// Interfaces locales (no importan de kommo-sync/types.ts) para mantener `_shared` desacoplado.

/** Cliente del ERP, en la forma mínima que el push necesita (subset de `clients`). */
export interface OnboardingClient {
  name: string | null;
  email: string | null;
  phone: string | null; // WhatsApp (clients.phone)
  rif: string | null; // documento: cédula o RIF (clients.rif)
  markbox: string; // DTD-NNNN (clients.markbox) — siempre presente al alta
  doc_kind: string | null; // 'persona' | 'empresa'
  tier: string | null; // 'regular' | 'vip' | 'premium'
}

/** Fila del espejo `kommo_custom_fields` (subset). */
export interface KommoFieldDef {
  id: number;
  entity_type: string; // 'leads' | 'contacts'
  name: string | null;
  code: string | null;
}

/** Custom field de un contacto/lead en una respuesta de Kommo (subset para dedup). */
export interface KommoCfv {
  field_code?: string | null;
  field_name?: string | null;
  values?: Array<{ value?: string | number | boolean | null }> | null;
}
export interface KommoEntityLite {
  id: number;
  custom_fields_values?: KommoCfv[] | null;
}

/** Claves lógicas de los custom fields del lead que etiquetamos. */
export interface LeadFieldIds {
  markbox?: number;
  rif?: number;
  tier?: number;
}

// Keywords por campo lógico (match por nombre/code, case-insensitive). El espejo trae los
// nombres REALES de la cuenta; si ninguno matchea, el campo se omite (graceful, no se inventa).
const FIELD_KEYWORDS: Record<keyof LeadFieldIds, string[]> = {
  markbox: ["markbox", "shipping mark", "shippingmark", "marca de envío", "marca de envio", "唛头", "casillero"],
  rif: ["rif", "cédula", "cedula", "documento", "c.i", "cid"],
  tier: ["tier", "nivel", "categoría", "categoria"],
};

/**
 * Resuelve los `field_id` de markbox/rif/tier desde el espejo `kommo_custom_fields`
 * (solo entity_type='leads'), por keyword sobre name/code. Campo no hallado → ausente.
 */
export function resolveFieldIds(rows: KommoFieldDef[]): LeadFieldIds {
  const leadFields = (rows ?? []).filter((r) => r.entity_type === "leads");
  const out: LeadFieldIds = {};
  for (const key of Object.keys(FIELD_KEYWORDS) as (keyof LeadFieldIds)[]) {
    const kws = FIELD_KEYWORDS[key];
    const hit = leadFields.find((f) => {
      const name = (f.name ?? "").toLowerCase();
      const code = (f.code ?? "").toLowerCase();
      return kws.some((k) => name.includes(k) || code.includes(k));
    });
    if (hit) out[key] = hit.id;
  }
  return out;
}

/** Nombre del lead en Kommo: nombre del cliente + MARKBOX (el markbox SIEMPRE visible). */
export function leadName(client: OnboardingClient): string {
  const base = (client.name ?? "").trim();
  return base ? `${base} · ${client.markbox}` : client.markbox;
}

/**
 * Cuerpo de un contacto Kommo (objeto único; la Edge Function lo envuelve en `[...]` para
 * POST /api/v4/contacts). Teléfono/email van por `field_code` PHONE/EMAIL (campos de sistema),
 * así no hace falta resolver sus ids del espejo.
 */
export function buildContactPayload(client: OnboardingClient): Record<string, unknown> {
  const cfv: Record<string, unknown>[] = [];
  if (client.phone) {
    cfv.push({ field_code: "PHONE", values: [{ value: client.phone, enum_code: "WORK" }] });
  }
  if (client.email) {
    cfv.push({ field_code: "EMAIL", values: [{ value: client.email, enum_code: "WORK" }] });
  }
  const payload: Record<string, unknown> = { name: client.name ?? client.markbox };
  if (cfv.length) payload.custom_fields_values = cfv;
  return payload;
}

/** custom_fields_values del lead, solo con los campos que resolvieron (markbox/rif/tier). */
export function buildLeadCustomFields(
  client: OnboardingClient,
  fieldIds: LeadFieldIds,
): Record<string, unknown>[] {
  const cfv: Record<string, unknown>[] = [];
  if (fieldIds.markbox) {
    cfv.push({ field_id: fieldIds.markbox, values: [{ value: client.markbox }] });
  }
  if (fieldIds.rif && client.rif) {
    cfv.push({ field_id: fieldIds.rif, values: [{ value: client.rif }] });
  }
  if (fieldIds.tier && client.tier) {
    cfv.push({ field_id: fieldIds.tier, values: [{ value: client.tier }] });
  }
  return cfv;
}

/**
 * Cuerpo de un lead Kommo (objeto único; la Edge Function lo envuelve en `[...]` para
 * POST /api/v4/leads). Enlaza el contacto vía `_embedded.contacts:[{id}]` (no crea contacto).
 */
export function buildLeadPayload(
  client: OnboardingClient,
  contactId: number,
  fieldIds: LeadFieldIds,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: leadName(client),
    _embedded: { contacts: [{ id: contactId }] },
  };
  const cfv = buildLeadCustomFields(client, fieldIds);
  if (cfv.length) payload.custom_fields_values = cfv;
  return payload;
}

/** Para PATCH idempotente de un lead ya enlazado: solo refresca los custom fields. */
export function buildLeadPatch(
  client: OnboardingClient,
  fieldIds: LeadFieldIds,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const cfv = buildLeadCustomFields(client, fieldIds);
  if (cfv.length) payload.custom_fields_values = cfv;
  return payload;
}

/** Solo dígitos de un teléfono ("+58 412 166 8021" → "584121668021"). */
export function normalizePhoneDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/**
 * ¿Dos teléfonos son la misma línea? Compara los últimos 10 dígitos (número nacional
 * venezolano sin código de país / 0 inicial), con fallback a igualdad de dígitos completa.
 */
export function phoneMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = normalizePhoneDigits(a);
  const db = normalizePhoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length >= 10 && db.length >= 10) return da.slice(-10) === db.slice(-10);
  return false;
}

/** Todos los valores (string) de un custom field por `field_code` (PHONE/EMAIL). */
export function valuesByCode(entity: KommoEntityLite, code: string): string[] {
  const want = code.toLowerCase();
  const out: string[] = [];
  for (const f of entity.custom_fields_values ?? []) {
    if ((f.field_code ?? "").toLowerCase() !== want) continue;
    for (const v of f.values ?? []) {
      if (v?.value !== null && v?.value !== undefined) out.push(String(v.value));
    }
  }
  return out;
}

/**
 * Busca entre los contactos devueltos por la búsqueda de Kommo uno cuyo PHONE coincida
 * (últimos 10 dígitos) o cuyo EMAIL coincida (case-insensitive). Devuelve su id o null.
 * El dedup exige coincidencia REAL del campo: `?query=` de Kommo es difuso y puede traer ruido.
 */
export function matchContact(
  contacts: KommoEntityLite[],
  phone: string | null | undefined,
  email: string | null | undefined,
): number | null {
  const emailLc = (email ?? "").trim().toLowerCase();
  for (const c of contacts ?? []) {
    if (phone) {
      if (valuesByCode(c, "PHONE").some((p) => phoneMatches(p, phone))) return c.id;
    }
    if (emailLc) {
      if (valuesByCode(c, "EMAIL").some((e) => e.trim().toLowerCase() === emailLc)) return c.id;
    }
  }
  return null;
}

/** Orden de búsquedas de dedup: teléfono (identidad primaria del lead VE), luego email. */
export function pickDedupQueries(
  client: OnboardingClient,
): Array<{ by: "phone" | "email"; q: string }> {
  const queries: Array<{ by: "phone" | "email"; q: string }> = [];
  const digits = normalizePhoneDigits(client.phone);
  if (digits) queries.push({ by: "phone", q: digits });
  if (client.email) queries.push({ by: "email", q: client.email.trim() });
  return queries;
}

/**
 * ¿La corrida es DRY-RUN (ensayo: lee Kommo y arma payloads pero NO escribe)?
 * Default SEGURO = sí (nace apagado, estilo SDD-0062 Slice A "toda escritura nace apagada").
 * Solo escribe de verdad si el secreto `KOMMO_PUSH_DRY_RUN` es EXACTAMENTE "false" Y el body no
 * fuerza dry-run. El body puede FORZAR dry-run (extra seguro) pero NUNCA forzar escritura real.
 */
export function resolveDryRun(
  envValue: string | null | undefined,
  bodyDryRun?: boolean,
): boolean {
  return envValue !== "false" || bodyDryRun === true;
}
