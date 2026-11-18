/** Día de negocio. Los instantes de auditoría siguen siendo UTC. Sin DB/Studio. */
export const CARACAS_TIME_ZONE = "America/Caracas";

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CARACAS_TIME_ZONE, calendar: "gregory", numberingSystem: "latn",
  year: "numeric", month: "2-digit", day: "2-digit", era: "short",
});

/** Calendario estricto; no normaliza 30 de febrero ni elimina espacios. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Acepta Date válido o timestamp con zona explícita; nunca date-only/host TZ. */
export function validInstant(value: Date | string): Date {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new RangeError("Instante inválido.");
    return new Date(value.getTime());
  }
  if (typeof value !== "string") throw new RangeError("Instante inválido.");
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match || !isCalendarDate(match[1]) || Number(match[2]) > 23
    || Number(match[3]) > 59 || Number(match[4]) > 59
    || (match[6] !== undefined && (Number(match[6]) > 23 || Number(match[7]) > 59))) {
    throw new RangeError("Instante inválido: incluye hora y zona explícita.");
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError("Instante inválido.");
  return date;
}

function localDate(ms: number): string {
  const parts = formatter.formatToParts(ms);
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === name)!.value;
  return `${part("era") === "BC" ? "-" : ""}${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}

/** Reloj inyectable por argumento; el default se captura una sola vez. */
export function fechaCaracas(instant: Date | string = new Date()): string {
  const result = localDate(validInstant(instant).getTime());
  if (!isCalendarDate(result)) throw new RangeError("Fecha fuera del calendario admitido.");
  return result;
}

function calendarUtc(day: string): Date {
  if (!isCalendarDate(day)) throw new RangeError("Fecha inválida (YYYY-MM-DD).");
  const date = new Date(`${day}T00:00:00.000Z`);
  return date;
}

/** Primer instante del día local. Busca con IANA, sin fijar un offset histórico. */
function startOfDay(day: string): string {
  const anchor = calendarUtc(day).getTime();
  let low = anchor - 2 * 86_400_000;
  let high = anchor + 2 * 86_400_000;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (localDate(middle) < day) low = middle + 1;
    else high = middle;
  }
  if (localDate(low) !== day) throw new RangeError("Día local no disponible.");
  return new Date(low).toISOString();
}

export function caracasDayBounds(day = fechaCaracas()): { start: string; end: string } {
  const next = calendarUtc(day);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: startOfDay(day), end: startOfDay(next.toISOString().slice(0, 10)) };
}

export function caracasMonthBounds(month = fechaCaracas().slice(0, 7)): { start: string; end: string } {
  if (!/^\d{4}-\d{2}$/.test(month) || !isCalendarDate(`${month}-01`)) throw new RangeError("Mes inválido (YYYY-MM).");
  const next = calendarUtc(`${month}-01`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { start: startOfDay(`${month}-01`), end: startOfDay(next.toISOString().slice(0, 10)) };
}
