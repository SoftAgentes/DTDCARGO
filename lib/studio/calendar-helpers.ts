/**
 * Helpers de fecha para el Calendario operativo (SDD-0015).
 *
 * Stateless / puros — importables desde server o client. Sin Intl
 * pesado, mantengo el formateo locale "es-VE" minimal.
 */

import type { Fair, Holiday } from "./calendar-data";

/** Mes/año estable. Mes es 1-12 (no JS 0-11) para evitar bugs off-by-one. */
export type MonthCursor = {
  year: number;
  month: number; // 1..12
};

const MONTH_PARAM_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * Convierte `?month=YYYY-MM` en un cursor estable.
 * - Inválido → mes actual.
 * - Sin param → mes actual.
 */
export function parseMonthParam(raw: string | null | undefined): MonthCursor {
  if (raw) {
    const m = MONTH_PARAM_RE.exec(raw);
    if (m) {
      return { year: Number(m[1]), month: Number(m[2]) };
    }
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Devuelve `YYYY-MM` para usar en `?month=...`. */
export function formatMonthParam(cursor: MonthCursor): string {
  const mm = String(cursor.month).padStart(2, "0");
  return `${cursor.year}-${mm}`;
}

/** Devuelve el cursor del mes anterior. */
export function prevMonth(cursor: MonthCursor): MonthCursor {
  if (cursor.month === 1) return { year: cursor.year - 1, month: 12 };
  return { year: cursor.year, month: cursor.month - 1 };
}

/** Devuelve el cursor del mes siguiente. */
export function nextMonth(cursor: MonthCursor): MonthCursor {
  if (cursor.month === 12) return { year: cursor.year + 1, month: 1 };
  return { year: cursor.year, month: cursor.month + 1 };
}

/** Mes del momento de ejecución. */
export function currentMonth(): MonthCursor {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export type MonthGridCell = {
  /** Fecha real de la celda. */
  date: Date;
  /** ISO `YYYY-MM-DD` para keys / lookups. */
  isoDate: string;
  /** Día 1..31 del mes que representa esta celda. */
  dayOfMonth: number;
  /** True si la celda pertenece al mes del cursor (no a relleno). */
  inMonth: boolean;
  /** True si es sábado o domingo. */
  isWeekend: boolean;
};

/**
 * Construye el grid 7×N del mes. Incluye relleno desde el lunes
 * anterior + completar hasta el domingo posterior.
 *
 * Convención: Lunes = primer día (es-VE).
 */
export function buildMonthGrid(cursor: MonthCursor): MonthGridCell[] {
  const { year, month } = cursor;
  const firstDay = new Date(year, month - 1, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Lun = 0
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  // Anclamos en lunes-relleno
  const gridStart = new Date(year, month - 1, 1 - startOffset);

  const cells: MonthGridCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({
      date: d,
      isoDate: toIso(d),
      dayOfMonth: d.getDate(),
      inMonth: d.getMonth() === month - 1 && d.getFullYear() === year,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    });
  }
  return cells;
}

/**
 * Devuelve los feriados que incluyen una fecha dada (rangos
 * inclusivos). Puede haber múltiples (ej: 1-may cae en CN labor + VE
 * trabajador).
 */
export function holidaysForDate(
  isoDate: string,
  all: Holiday[],
): Holiday[] {
  return all.filter((h) => isoDate >= h.startDate && isoDate <= h.endDate);
}

/** Devuelve las ferias que incluyen una fecha dada (rangos inclusivos). */
export function fairsForDate(isoDate: string, all: Fair[]): Fair[] {
  return all.filter((f) => isoDate >= f.startDate && isoDate <= f.endDate);
}

/**
 * Devuelve los próximos N feriados desde una fecha de referencia.
 * Ordenado por startDate asc.
 */
export function upcomingHolidays(
  todayIso: string,
  all: Holiday[],
  limit = 8,
): Holiday[] {
  return all
    .filter((h) => h.endDate >= todayIso)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, limit);
}

/** "mayo 2026" con primera letra mayúscula. */
export function formatMonthLabel(cursor: MonthCursor): string {
  const d = new Date(cursor.year, cursor.month - 1, 1);
  const raw = d.toLocaleDateString("es-VE", {
    month: "long",
    year: "numeric",
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** "23 may" para listas compactas. */
export function formatShortDate(iso: string): string {
  const d = isoToDate(iso);
  const raw = d.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
  });
  // Remove the trailing period that some locales add ("23 may.")
  return raw.replace(/\.$/, "").trim();
}

/**
 * Date local sin shift de timezone. `new Date("2026-05-01")` interpreta
 * UTC, lo cual cae en 30-abr en GMT-4. Esto usa el constructor año/mes/día.
 */
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date → "YYYY-MM-DD" usando los componentes LOCALES, no UTC. */
export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
