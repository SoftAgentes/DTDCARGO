/**
 * CBM (m³): un único formateador y un único redondeo de PANTALLA para todo el
 * producto (SDD-0667).
 *
 * Regla (reunión de oficina 2026-11-18): el CBM se ve con hasta 4 decimales y
 * SIN ceros de relleno: solo los decimales que el valor realmente tiene.
 *   0.0012 → "0,0012" · 1.5 → "1,5" · 0.12 → "0,12" · 2 → "2"   (es-VE: coma)
 *
 * Es solo visual: no cambia cómo se guarda el dato ni los cálculos de tarifa.
 * Los cálculos trabajan con el número completo; `roundCbm` solo sirve para
 * mostrar totales de pantalla sin ruido binario (4 decimales).
 */
export const CBM_MAX_DECIMALS = 4;

const FACTOR = 10 ** CBM_MAX_DECIMALS;

/** Redondea a 4 decimales (mitad hacia arriba, tolerante al ruido binario). */
export function roundCbm(n: number): number {
  if (!Number.isFinite(n)) return n;
  return Math.round((n + Number.EPSILON * Math.sign(n)) * FACTOR) / FACTOR;
}

export interface FormatCbmOptions {
  /** `true` → "m³"; un texto → ese texto. Sin opción, solo el número. */
  unit?: boolean | string;
  /** Qué mostrar si no hay valor. Por defecto "—". */
  fallback?: string;
  /** Locale de la vista. Por defecto es-VE (coma decimal), como el resto del Studio. */
  locale?: string;
}

/**
 * Texto para mostrar un CBM: máximo 4 decimales, sin ceros de relleno.
 * `null`/`undefined`/no finito → `fallback`.
 */
export function formatCbm(
  n: number | string | null | undefined,
  opts: FormatCbmOptions = {},
): string {
  const fallback = opts.fallback ?? "—";
  if (n == null || n === "") return fallback;
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  const r = roundCbm(v);
  const text = (r === 0 ? 0 : r).toLocaleString(opts.locale ?? "es-VE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: CBM_MAX_DECIMALS,
  });
  const unit = opts.unit === true ? "m³" : opts.unit || "";
  return unit ? `${text} ${unit}` : text;
}

/** Para archivos (CSV): punto decimal, sin separador de miles, sin ceros de relleno. */
export function cbmPlano(n: number | string | null | undefined): string {
  if (n == null || n === "") return "";
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return "";
  const r = roundCbm(v);
  return String(r === 0 ? 0 : r);
}
