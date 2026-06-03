/**
 * Helper de formato del módulo Fidelización (SDD-0051, Slice B).
 *
 * Espejo del fmtUsd del Norte / direccion: `$12,323` con separador de miles
 * (en-US) y signo menos tipográfico. Fuente única del módulo (no duplicar).
 */
export function fmtUsd(n: number): string {
  const v = Number(n) || 0;
  const sign = v < 0 ? "−" : "";
  return sign + "$" + Math.round(Math.abs(v)).toLocaleString("en-US");
}
