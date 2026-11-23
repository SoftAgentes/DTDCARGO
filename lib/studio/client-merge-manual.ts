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
  hasDocument: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  hasPortal: boolean;
  counts: { shipments: number; invoices: number; addresses: number; conversations: number };
};

export type MergeWarnings = {
  /** Las dos personas tienen acceso al portal: el de la ficha que se anula se revoca. */
  portalRevoked: boolean;
  /** Solo la que se anula tiene acceso: pasa a la que se queda. */
  portalMoved: boolean;
  documentNotPassed: boolean;
  emailNotPassed: boolean;
  phoneNotPassed: boolean;
  /** Las fichas solo coinciden por el nombre: nada más las une. */
  sameNameOnly: boolean;
};

export type MergePreview = {
  ok: boolean;
  blockers: string[];
  survivor: MergeSide;
  merged: MergeSide;
  warnings: MergeWarnings;
};

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
  const flags = [raw.hasDocument, raw.hasEmail, raw.hasPhone, raw.hasPortal];
  if (flags.some((f) => typeof f !== "boolean")) return null;
  return {
    id,
    markbox,
    name,
    hasDocument: raw.hasDocument as boolean,
    hasEmail: raw.hasEmail as boolean,
    hasPhone: raw.hasPhone as boolean,
    hasPortal: raw.hasPortal as boolean,
    counts: { shipments, invoices, addresses, conversations },
  };
}

/** Resultado de `client_merge_preview`. `null` si la forma no es la esperada. */
export function parsePreview(data: unknown): MergePreview | null {
  if (!esObjeto(data) || typeof data.ok !== "boolean") return null;
  if (!Array.isArray(data.blockers) || !esObjeto(data.warnings)) return null;
  const survivor = parseSide(data.survivor);
  const merged = parseSide(data.merged);
  if (!survivor || !merged) return null;

  const w = data.warnings;
  const claves = [
    "portalRevoked",
    "portalMoved",
    "documentNotPassed",
    "emailNotPassed",
    "phoneNotPassed",
    "sameNameOnly",
  ] as const;
  if (claves.some((k) => typeof w[k] !== "boolean")) return null;

  return {
    ok: data.ok,
    blockers: data.blockers.filter((b): b is string => typeof b === "string"),
    survivor,
    merged,
    warnings: {
      portalRevoked: w.portalRevoked as boolean,
      portalMoved: w.portalMoved as boolean,
      documentNotPassed: w.documentNotPassed as boolean,
      emailNotPassed: w.emailNotPassed as boolean,
      phoneNotPassed: w.phoneNotPassed as boolean,
      sameNameOnly: w.sameNameOnly as boolean,
    },
  };
}

/** Los avisos que se muestran, ya en español y en orden de gravedad. */
export function avisosDeFusion(w: MergeWarnings): { tono: AvisoTono; texto: string }[] {
  const avisos: { tono: AvisoTono; texto: string }[] = [];
  if (w.sameNameOnly) {
    avisos.push({
      tono: "error",
      texto:
        "Solo coinciden por el nombre. Comprueba que sean la misma persona, o que de verdad quieras un solo código para las dos.",
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
