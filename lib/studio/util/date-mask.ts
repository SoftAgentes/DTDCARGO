/**
 * Máscara de fechas del Studio (SDD-0660).
 *
 * Lógica pura, sin React, para el campo `<DateField>`:
 *   - lo que se ve es `dd/mm/aaaa` (o `mm/aaaa` en meses);
 *   - lo que viaja en el formulario es ISO: `AAAA-MM-DD` (o `AAAA-MM`).
 *
 * Reglas de escritura:
 *   - se escriben los números seguidos (`18112026` → `18/11/2026`); las barras
 *     se insertan solas cuando empieza el grupo siguiente, así borrar nunca
 *     choca con una barra que se vuelve a poner;
 *   - una barra escrita a mano tras un solo dígito lo completa con cero
 *     (`1/` → `01`);
 *   - al pegar se aceptan `18/11/2026`, `18-11-2026`, `18.11.2026`, `1/2/2026`
 *     y el ISO `2026-11-18`.
 *
 * Una fecha imposible (31/02) NO se corrige en silencio (DAT-01): queda escrita
 * y se explica el error.
 */

import { fechaCaracas } from "@/lib/shared/fechas-caracas";

export type DateMode = "date" | "month";

export const DATE_TEMPLATE: Record<DateMode, string> = {
  date: "dd/mm/aaaa",
  month: "mm/aaaa",
};

const GROUPS: Record<DateMode, number[]> = {
  date: [2, 2, 4],
  month: [2, 4],
};

const MAX_DIGITS: Record<DateMode, number> = { date: 8, month: 6 };

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;

export const MONTH_NAMES = [
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
] as const;

/** Inserta las barras entre grupos ya empezados. `181120` → `18/11/20`. */
export function groupDigits(digits: string, mode: DateMode): string {
  const clean = digits.replace(/\D/g, "").slice(0, MAX_DIGITS[mode]);
  const parts: string[] = [];
  let rest = clean;
  for (const size of GROUPS[mode]) {
    if (!rest) break;
    parts.push(rest.slice(0, size));
    rest = rest.slice(size);
  }
  return parts.join("/");
}

function pad(segment: string, size: number): string {
  return segment.length >= size ? segment : segment.padStart(size, "0");
}

/**
 * Normaliza lo que quedó en el campo después de una tecla.
 * Solo se rellena con cero el grupo que se cerró con una barra AL FINAL
 * (la que se acaba de escribir); en medio del texto se reagrupa sin rellenar.
 */
export function normalizeTyped(raw: string, mode: DateMode): string {
  const sizes = GROUPS[mode];
  const trailingSeparator = /[^\d]$/.test(raw) && /\d/.test(raw);
  const segments = raw.split(/[^\d]+/).filter((s, i, all) => s !== "" || i < all.length - 1);
  if (trailingSeparator) {
    const filled = segments.filter((s) => s !== "");
    // ¿Qué grupo se acaba de cerrar? El último segmento con dígitos.
    const digitsBefore = filled.slice(0, -1).join("");
    const last = filled[filled.length - 1] ?? "";
    // Posición del grupo según los dígitos que ya estaban antes.
    let acc = 0;
    let groupIndex = 0;
    while (groupIndex < sizes.length && acc + sizes[groupIndex] <= digitsBefore.length) {
      acc += sizes[groupIndex];
      groupIndex += 1;
    }
    const size = sizes[groupIndex];
    const startsGroup = acc === digitsBefore.length;
    if (size && startsGroup && last.length < size && groupIndex < sizes.length - 1) {
      return groupDigits(digitsBefore + pad(last, size), mode);
    }
  }
  return groupDigits(segments.join(""), mode);
}

/**
 * Normaliza un texto pegado: entiende separadores y el ISO.
 * Devuelve `null` si no parece una fecha (el campo deja el texto como estaba).
 */
export function normalizePasted(raw: string, mode: DateMode): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (mode === "date") {
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
    if (iso) return `${pad(iso[3], 2)}/${pad(iso[2], 2)}/${iso[1]}`;
    const local = text.match(/^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{4})$/);
    if (local) return `${pad(local[1], 2)}/${pad(local[2], 2)}/${local[3]}`;
  } else {
    const iso = text.match(/^(\d{4})-(\d{1,2})$/);
    if (iso) return `${pad(iso[2], 2)}/${iso[1]}`;
    const local = text.match(/^(\d{1,2})[/.\- ](\d{4})$/);
    if (local) return `${pad(local[1], 2)}/${local[2]}`;
  }
  const digits = text.replace(/\D/g, "");
  if (digits.length === MAX_DIGITS[mode] && /^[\d/.\- ]+$/.test(text)) {
    return groupDigits(digits, mode);
  }
  return null;
}

/**
 * Posición del cursor después de reformatear: tras el mismo número de dígitos
 * que había a su izquierda.
 */
export function caretAfterDigits(formatted: string, digitsBefore: number): number {
  if (digitsBefore <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen += 1;
      if (seen === digitsBefore) return i + 1;
    }
  }
  return formatted.length;
}

export function countDigits(text: string): number {
  return text.replace(/\D/g, "").length;
}

export type DateParse =
  | { status: "empty"; iso: null; error: null }
  | { status: "incomplete"; iso: null; error: string }
  | { status: "invalid"; iso: null; error: string }
  | { status: "valid"; iso: string; error: null };

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** `2026-11-18` → `18/11/2026`. Acepta un ISO con hora detrás. Vacío si no es ISO. */
export function isoToDisplay(iso: string | null | undefined, mode: DateMode): string {
  if (!iso) return "";
  if (mode === "date") {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
  }
  const m = iso.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[2]}/${m[1]}` : "";
}

/** ISO del valor normalizado (`AAAA-MM-DD` o `AAAA-MM`), o `null` si no es ISO. */
export function normalizeIso(iso: string | null | undefined, mode: DateMode): string | null {
  if (!iso) return null;
  const m = mode === "date" ? iso.match(/^(\d{4})-(\d{2})-(\d{2})/) : iso.match(/^(\d{4})-(\d{2})/);
  return m ? m[0] : null;
}

export function parseDisplay(
  text: string,
  mode: DateMode,
  bounds: { min?: string; max?: string } = {},
): DateParse {
  const digits = text.replace(/\D/g, "");
  if (!digits) return { status: "empty", iso: null, error: null };
  if (digits.length < MAX_DIGITS[mode]) {
    return {
      status: "incomplete",
      iso: null,
      error: `Completa la fecha: ${DATE_TEMPLATE[mode]}.`,
    };
  }
  const day = mode === "date" ? Number(digits.slice(0, 2)) : 1;
  const month = Number(mode === "date" ? digits.slice(2, 4) : digits.slice(0, 2));
  const year = Number(mode === "date" ? digits.slice(4, 8) : digits.slice(2, 6));

  if (month < 1 || month > 12) {
    return { status: "invalid", iso: null, error: "El mes va de 01 a 12." };
  }
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return {
      status: "invalid",
      iso: null,
      error: `El año va de ${MIN_YEAR} a ${MAX_YEAR}.`,
    };
  }
  if (mode === "date") {
    const max = daysInMonth(year, month);
    if (day < 1 || day > max) {
      return {
        status: "invalid",
        iso: null,
        error: `Ese día no existe: ${MONTH_NAMES[month - 1]} de ${year} tiene ${max} días.`,
      };
    }
  }
  const mm = String(month).padStart(2, "0");
  const iso = mode === "date" ? `${year}-${mm}-${String(day).padStart(2, "0")}` : `${year}-${mm}`;

  const min = normalizeIso(bounds.min, mode);
  const maxBound = normalizeIso(bounds.max, mode);
  if (min && iso < min) {
    return {
      status: "invalid",
      iso: null,
      error: `La fecha mínima es ${isoToDisplay(min, mode)}.`,
    };
  }
  if (maxBound && iso > maxBound) {
    return {
      status: "invalid",
      iso: null,
      error: `La fecha máxima es ${isoToDisplay(maxBound, mode)}.`,
    };
  }
  return { status: "valid", iso, error: null };
}

/**
 * Hoy = el día de negocio en Caracas, como el resto del Studio (no el del
 * navegador: un operador en China a las 9 de la mañana sigue en el «ayer» de
 * Caracas, y no UTC: de 20:00 a medianoche de Venezuela UTC ya es «mañana»).
 */
export function todayIso(mode: DateMode, now: Date = new Date()): string {
  const day = fechaCaracas(now);
  return mode === "month" ? day.slice(0, 7) : day;
}

/** Suma días a un `AAAA-MM-DD` (aritmética en UTC: sin saltos por horario). */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Suma meses a un `AAAA-MM`. */
export function addMonths(isoMonth: string, n: number): string {
  const [y, m] = isoMonth.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Suma meses a un `AAAA-MM-DD`, recortando el día al último del mes destino. */
export function addMonthsToDate(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = addMonths(`${y}-${String(m).padStart(2, "0")}`, n);
  const [ty, tm] = target.split("-").map(Number);
  const day = Math.min(d, daysInMonth(ty, tm));
  return `${target}-${String(day).padStart(2, "0")}`;
}

/** Recorta un ISO a los límites (para mover el foco del calendario sin salirse). */
export function clampIso(iso: string, min?: string | null, max?: string | null): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

/** «18 de noviembre de 2026» o «noviembre de 2026», para lector de pantalla. */
export function spokenDate(iso: string, mode: DateMode): string {
  const [y, m, d] = iso.split("-").map(Number);
  const mes = MONTH_NAMES[m - 1];
  return mode === "date" ? `${d} de ${mes} de ${y}` : `${mes} de ${y}`;
}
