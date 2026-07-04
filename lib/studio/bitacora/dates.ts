/**
 * Fechas en zona Venezuela para Bitácora (SDD-0146).
 *
 * "Hoy" SIEMPRE se calcula server-side en America/Caracas: si el server corre
 * en UTC, entre las 20:00 y las 00:00 VE el día del server ya es "mañana" y la
 * agrupación Atrasadas/Para hoy se corre un día. VE = UTC-4 fijo (sin DST).
 *
 * Función pura (recibe `now` inyectable) → testeable sin mocks de reloj.
 */

export const VE_TIME_ZONE = "America/Caracas";

/**
 * Fecha de HOY en Caracas como `YYYY-MM-DD` (ISO date, sin hora).
 * `sv-SE` formatea exactamente `YYYY-MM-DD` — cero manipulación de strings.
 */
export function todayCaracasISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: VE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** ¿String con shape ISO date estricto (`^\d{4}-\d{2}-\d{2}$`) y fecha real? */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // Verificación de fecha real (30 feb, 31 abr, etc.) vía UTC round-trip.
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Label corto es-VE para una due date (`YYYY-MM-DD`) relativa a hoy:
 * "Hoy" · "Mañana" · "Ayer" · "12 mar". Puro (hoyISO inyectado).
 */
export function dueDateLabel(dueISO: string, hoyISO: string): string {
  if (dueISO === hoyISO) return "Hoy";
  const due = isoToUtcMs(dueISO);
  const hoy = isoToUtcMs(hoyISO);
  if (due == null || hoy == null) return dueISO;
  const diffDays = Math.round((due - hoy) / 86_400_000);
  if (diffDays === 1) return "Mañana";
  if (diffDays === -1) return "Ayer";
  const [y, m, d] = dueISO.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-VE", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
  return label;
}

function isoToUtcMs(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
