/**
 * Clasificador del término del buscador global (SDD-0135 §4).
 *
 * Decide cómo interpretar lo que el usuario teclea para rutear a las facetas
 * correctas y elegir la estrategia de query:
 *   - `code`   → prefijo del dominio (DTD-/S-/Q-/F-/R-) → faceta específica.
 *   - `date`   → dd/mm o dd/mm/aaaa → facetas con fecha.
 *   - `cedula` → V/E/J/G/P + dígitos, o dígitos sueltos suficientemente largos.
 *   - `amount` → $ o número con separadores → facetas de dinero.
 *   - `text`   → texto libre → fan-out completo.
 *
 * PURA — sin red, sin DB. Heurística de UX/ruteo: la seguridad NO depende de
 * esto (el gate por faceta vive en facets.ts). El orden importa: lo más
 * específico primero para desambiguar (código antes que monto, cédula antes que
 * monto).
 */

import type { GlobalSearchFacetId, SearchTermKind } from "./types";

/** Prefijos de código por dominio → faceta destino. */
export const CODE_PREFIXES: Record<string, GlobalSearchFacetId> = {
  DTD: "clients",
  S: "shipments",
  Q: "quotes",
  F: "invoices",
  R: "payments",
};

const CODE_RE = /^(dtd|s|q|f|r)-\s*\d/i;
const DATE_RE = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/;
const CEDULA_PREFIX_RE = /^[vejgp]-?\s*\d/i;
const AMOUNT_RE = /^\s*\$?\d[\d.,]*\s*$/;

/**
 * Heurística cédula-like para dígitos sueltos: normalizado (solo dígitos) con
 * largo de cédula/RIF venezolano. Un número corto (≤6) se trata como monto.
 */
function looksLikeCedulaDigits(digitsOnly: string): boolean {
  return digitsOnly.length >= 7;
}

export function classifyTerm(raw: string): SearchTermKind {
  const term = (raw ?? "").trim();
  if (!term) return "text";

  // 1. Código con prefijo del dominio — lo más específico.
  if (CODE_RE.test(term)) return "code";

  // 2. Fecha dd/mm(/aaaa).
  if (DATE_RE.test(term)) return "date";

  // 3. Cédula/RIF con prefijo de nacionalidad/tipo (V/E/J/G/P).
  if (CEDULA_PREFIX_RE.test(term)) return "cedula";

  // 4. Número: monto vs cédula suelta (dígitos sin prefijo ni separador).
  if (AMOUNT_RE.test(term)) {
    const digitsOnly = term.replace(/[^0-9]/g, "");
    const hasSeparator = /[$.,]/.test(term);
    // "12345678" (largo, sin separador ni $) es más probablemente una cédula.
    if (!hasSeparator && looksLikeCedulaDigits(digitsOnly)) return "cedula";
    return "amount";
  }

  return "text";
}

/**
 * Parsea el número de un término tipo monto ("$1.500,50" → 1500.5). Formato
 * venezolano (punto = miles, coma = decimal). null si no parsea. PURA.
 */
export function parseAmount(raw: string): number | null {
  const cleaned = (raw ?? "").replace(/[$\s]/g, "");
  if (!cleaned) return null;
  // Punto = separador de miles, coma = decimal (es-VE).
  const normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Faceta destino de un código por su prefijo, o null si no reconoce el prefijo. */
export function facetForCode(raw: string): GlobalSearchFacetId | null {
  const m = /^([a-z]+)-/i.exec((raw ?? "").trim());
  if (!m) return null;
  return CODE_PREFIXES[m[1].toUpperCase()] ?? null;
}
