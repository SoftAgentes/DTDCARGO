/**
 * Búsqueda amplia y fusión manual de clientes (SDD-0712).
 *
 * Capa pura: tipos y validadores de lo que devuelven las RPC de la migración
 * 0572 (`client_search_for_merge`, `client_merge_preview`) y de lo que se le
 * pide al operador antes de fusionar. Sin acceso a datos: lo mismo corre en el
 * servidor, en el cliente y en las pruebas.
 *
 * Las RPC se leen FALLANDO CERRADO: una forma inesperada no se muestra a medias.
 * Una vista previa mal leída que dijera «sin avisos» es peor que no mostrarla.
 */

import type { AvisoTono } from "@/app/studio/_components/ui/Aviso";

export type MergeSearchHit = {
  id: string;
  markbox: string;
  name: string;
  email: string | null;
  phone: string | null;
  rif: string | null;
  /** Por qué apareció: «Shipping Mark», «nombre», «correo», «teléfono», «documento». */
  matchedBy: string[];
};

export type MergeSide = {
  id: string;
  markbox: string;
  name: string;
  /** Datos para comparar a las dos personas; los mismos del listado de Clientes. */
  document: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string | null;
  /** `true` solo si el acceso está activo: una invitación sin usar no cuenta. */
  hasPortal: boolean;
  /** Estado de la fila del portal, o `null` si no tiene. */
  portalStatus: "active" | "invited" | "revoked" | null;
  counts: { shipments: number; invoices: number; addresses: number; conversations: number };
};

/** Qué dato une a las dos fichas. Vacío contra vacío no cuenta. */
export type MergeMatches = { document: boolean; email: boolean; phone: boolean; name: boolean };

export type MergeWarnings = {
  /** Las dos tienen acceso vivo al portal: el de la ficha que se anula se revoca. */
  portalRevoked: boolean;
  /**
   * La que se queda tiene el acceso REVOCADO y la otra uno vivo: `merge_clients`
   * revoca el vivo y nadie queda con acceso. Conviene invertir.
   */
  portalLost: boolean;
  /** Solo la que se anula tiene acceso: pasa a la que se queda. */
  portalMoved: boolean;
  documentNotPassed: boolean;
  emailNotPassed: boolean;
  phoneNotPassed: boolean;
  /** Las fichas solo coinciden por el nombre: nada más las une. */
  sameNameOnly: boolean;
  /** No coinciden en nada: a la vista, son dos personas distintas. */
  nothingInCommon: boolean;
};

export type MergePreview = {
  ok: boolean;
  blockers: string[];
  survivor: MergeSide;
  merged: MergeSide;
  matches: MergeMatches;
  warnings: MergeWarnings;
};

/** Quién fusiona (Sam, 2026-11-23). Espejo de `merge_clients_manual` (0572): la base manda. */
export const ROLES_QUE_FUSIONAN: readonly string[] = ["admin", "operations", "commercial"];

export function rolPuedeFusionar(role: string | null | undefined): boolean {
  return !!role && ROLES_QUE_FUSIONAN.includes(role);
}

export const MOTIVO_MIN = 4;
export const MOTIVO_MAX = 1000;

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

function entero(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}

/** `true` si TODAS las claves son booleanas: una que falte invalida el bloque. */
function sonBooleanos<K extends string>(
  o: Record<string, unknown>,
  claves: readonly K[],
): o is Record<K, boolean> {
  return claves.every((k) => typeof o[k] === "boolean");
}

/** Filas de `client_search_for_merge`. Descarta las que no traen id, código y nombre. */
export function parseSearchRows(rows: unknown): MergeSearchHit[] {
  if (!Array.isArray(rows)) return [];
  const hits: MergeSearchHit[] = [];
  for (const r of rows) {
    if (!esObjeto(r)) continue;
    const id = texto(r.client_id);
    const markbox = texto(r.markbox);
    const name = texto(r.nombre);
    if (!id || !markbox || !name) continue;
    hits.push({
      id,
      markbox,
      name,
      email: texto(r.email),
      phone: texto(r.phone),
      rif: texto(r.rif),
      matchedBy: Array.isArray(r.matched_by)
        ? r.matched_by.filter((m): m is string => typeof m === "string")
        : [],
    });
  }
  return hits;
}

function parseSide(raw: unknown): MergeSide | null {
  if (!esObjeto(raw) || !esObjeto(raw.counts)) return null;
  const id = texto(raw.id);
  const markbox = texto(raw.markbox);
  const name = texto(raw.name);
  const shipments = entero(raw.counts.shipments);
  const invoices = entero(raw.counts.invoices);
  const addresses = entero(raw.counts.addresses);
  const conversations = entero(raw.counts.conversations);
  if (!id || !markbox || !name) return null;
  if (shipments === null || invoices === null || addresses === null || conversations === null) {
    return null;
  }
  if (typeof raw.hasPortal !== "boolean") return null;
  // Un estado que no se conoce invalida la vista previa: no se adivina.
  const estado = raw.portalStatus ?? null;
  if (estado !== null && estado !== "active" && estado !== "invited" && estado !== "revoked") return null;
  return {
    id,
    markbox,
    name,
    document: texto(raw.document),
    email: texto(raw.email),
    phone: texto(raw.phone),
    createdAt: texto(raw.createdAt),
    hasPortal: raw.hasPortal,
    portalStatus: estado,
    counts: { shipments, invoices, addresses, conversations },
  };
}

const CLAVES_AVISOS = [
  "portalRevoked",
  "portalLost",
  "portalMoved",
  "documentNotPassed",
  "emailNotPassed",
  "phoneNotPassed",
  "sameNameOnly",
  "nothingInCommon",
] as const;

const CLAVES_COINCIDENCIAS = ["document", "email", "phone", "name"] as const;

/** Resultado de `client_merge_preview`. `null` si la forma no es la esperada. */
export function parsePreview(data: unknown): MergePreview | null {
  if (!esObjeto(data) || typeof data.ok !== "boolean") return null;
  if (!Array.isArray(data.blockers) || !esObjeto(data.warnings) || !esObjeto(data.matches)) return null;
  const survivor = parseSide(data.survivor);
  const merged = parseSide(data.merged);
  if (!survivor || !merged) return null;

  const w = data.warnings;
  const c = data.matches;
  if (!sonBooleanos(w, CLAVES_AVISOS) || !sonBooleanos(c, CLAVES_COINCIDENCIAS)) return null;

  return {
    ok: data.ok,
    blockers: data.blockers.filter((b): b is string => typeof b === "string"),
    survivor,
    merged,
    matches: { document: c.document, email: c.email, phone: c.phone, name: c.name },
    warnings: {
      portalRevoked: w.portalRevoked,
      portalLost: w.portalLost,
      portalMoved: w.portalMoved,
      documentNotPassed: w.documentNotPassed,
      emailNotPassed: w.emailNotPassed,
      phoneNotPassed: w.phoneNotPassed,
      sameNameOnly: w.sameNameOnly,
      nothingInCommon: w.nothingInCommon,
    },
  };
}

/** Cómo se dice el estado del portal de una ficha. */
export function portalLegible(estado: MergeSide["portalStatus"]): string {
  if (estado === "active") return "Con acceso";
  if (estado === "invited") return "Invitado, aún sin entrar";
  if (estado === "revoked") return "Acceso revocado";
  return "Sin acceso";
}

/** «documento», «correo»…: en qué coinciden las dos fichas. Vacío si en nada. */
export function coincidenciasLegibles(m: MergeMatches): string[] {
  const r: string[] = [];
  if (m.document) r.push("documento");
  if (m.email) r.push("correo");
  if (m.phone) r.push("teléfono");
  if (m.name) r.push("nombre");
  return r;
}

/** Los avisos que se muestran, ya en español y en orden de gravedad. */
export function avisosDeFusion(w: MergeWarnings): { tono: AvisoTono; texto: string }[] {
  const avisos: { tono: AvisoTono; texto: string }[] = [];
  if (w.nothingInCommon) {
    avisos.push({
      tono: "error",
      texto:
        "No coinciden en ningún dato: a la vista son dos personas distintas. Fusiona solo si de verdad quieren un único código.",
    });
  }
  if (w.sameNameOnly) {
    avisos.push({
      tono: "error",
      texto:
        "Solo coinciden por el nombre. Comprueba que sean la misma persona, o que de verdad quieras un solo código para las dos.",
    });
  }
  if (w.portalLost) {
    avisos.push({
      tono: "error",
      texto:
        "La ficha que se queda tiene el acceso al portal revocado y la otra uno activo: fusionando así, nadie queda con acceso. Usa Invertir para que se quede la del acceso activo.",
    });
  }
  if (w.portalRevoked) {
    avisos.push({
      tono: "error",
      texto:
        "Las dos tienen acceso al portal y solo cabe uno por cliente: el de la ficha que se anula se revoca. Avísale con qué correo entrar.",
    });
  }
  if (w.portalMoved) {
    avisos.push({ tono: "info", texto: "El acceso al portal de la ficha que se anula pasa a la que se queda." });
  }
  if (w.documentNotPassed) {
    avisos.push({
      tono: "atencion",
      texto: "Tienen documentos distintos: queda el de la ficha que se queda; el otro solo se ve en la ficha anulada.",
    });
  }
  if (w.emailNotPassed) {
    avisos.push({ tono: "atencion", texto: "Tienen correos distintos: queda el de la ficha que se queda." });
  }
  if (w.phoneNotPassed) {
    avisos.push({ tono: "atencion", texto: "Tienen teléfonos distintos: queda el de la ficha que se queda." });
  }
  return avisos;
}

/** Texto de error del motivo, o `null` si sirve. Espejo de la RPC (4 a 1000). */
export function errorDeMotivo(raw: string | null | undefined): string | null {
  const largo = (raw ?? "").trim().length;
  if (largo < MOTIVO_MIN) return `Cuéntanos el motivo (mínimo ${MOTIVO_MIN} caracteres).`;
  if (largo > MOTIVO_MAX) return `El motivo es muy largo (máximo ${MOTIVO_MAX} caracteres).`;
  return null;
}

/** ¿Lo escrito es el Shipping Mark que se anula? Sin distinguir mayúsculas ni espacios de borde. */
export function confirmacionCoincide(escrito: string | null | undefined, markboxQueSeAnula: string): boolean {
  const a = (escrito ?? "").trim().toUpperCase();
  return a !== "" && a === markboxQueSeAnula.trim().toUpperCase();
}
