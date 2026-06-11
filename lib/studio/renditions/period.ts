/**
 * Período quincenal de la rendición (SDD-0069 · decisión #1) — helpers PUROS.
 *
 * El corte es QUINCENAL (decisión #5 del handoff): días 1-15 (Q1) y 16-último
 * (Q2). El "último" día se deriva del MES PEDIDO (28/29/30/31), no de "hoy".
 *
 * ⚠️ Sin `Date.now()` ni `new Date()` argless (prohibido en libs puras del
 * harness — rompe la reproducibilidad). Todo se computa con `Date.UTC(...)`
 * recibiendo year/month EXPLÍCITOS. Las fechas se devuelven como strings
 * `YYYY-MM-DD` (mismo formato que `received_at` / `issue_date`), sin objetos
 * Date que arrastren timezone.
 */

/** Mitad de la quincena: 1 = días 1-15, 2 = días 16-último. */
export type Half = 1 | 2;

/** Rango quincenal inclusivo, en strings `YYYY-MM-DD`. */
export type QuincenaRange = {
  year: number;
  month: number; // 1..12
  half: Half;
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
};

const MONTH_NAMES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** `YYYY-MM-DD` a partir de y/m/d con padding. PURA (no usa Date). */
function iso(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Último día del mes pedido (28/29/30/31). PURA: `Date.UTC(year, month, 0)` =
 * el día 0 del mes SIGUIENTE = el último del mes pedido (month es 1..12 → el
 * índice JS del mes siguiente es `month`, y day 0 retrocede uno). UTC evita el
 * shift de timezone. Maneja años bisiestos (febrero 29) correctamente.
 */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Rango de una quincena. PURA — recibe year/month/half explícitos:
 *  - Q1 → [YYYY-MM-01, YYYY-MM-15]
 *  - Q2 → [YYYY-MM-16, YYYY-MM-<último>]
 *
 * `month` es 1..12. `half` distinto de 1 se trata como 2 (defensivo).
 */
export function quincenaRange(
  year: number,
  month: number,
  half: Half,
): QuincenaRange {
  const h: Half = half === 1 ? 1 : 2;
  if (h === 1) {
    return {
      year,
      month,
      half: 1,
      from: iso(year, month, 1),
      to: iso(year, month, 15),
    };
  }
  const last = lastDayOfMonth(year, month);
  return {
    year,
    month,
    half: 2,
    from: iso(year, month, 16),
    to: iso(year, month, last),
  };
}

/**
 * Etiqueta legible de una quincena: "junio 2026 · 16-30". PURA. El día final
 * se deriva del mes (febrero → "16-28"/"16-29", etc.).
 */
export function quincenaLabel(
  year: number,
  month: number,
  half: Half,
): string {
  const h: Half = half === 1 ? 1 : 2;
  const name = MONTH_NAMES_ES[month - 1] ?? String(month);
  if (h === 1) return `${name} ${year} · 1-15`;
  return `${name} ${year} · 16-${lastDayOfMonth(year, month)}`;
}

/**
 * Las dos quincenas de un mes (Q1 y Q2), en orden. PURA. La UI lista esto para
 * el mes navegable (cursor de calendar-helpers).
 */
export function quincenasOfMonth(
  year: number,
  month: number,
): QuincenaRange[] {
  return [quincenaRange(year, month, 1), quincenaRange(year, month, 2)];
}
