/**
 * MonthGrid — grid 7×N del mes con feriados pintados (SDD-0015).
 *
 * Server component. Lunes como primer día. Hoy resaltado con círculo
 * wine. Feriados CN críticos más opacos que los no-críticos. Weekends
 * con un tint sutil.
 */

import {
  buildMonthGrid,
  type MonthCursor,
  toIso,
  holidaysForDate,
} from "@/lib/studio/calendar-helpers";
import type { Holiday } from "@/lib/studio/calendar-data";

const DAY_NAMES = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

type Props = {
  cursor: MonthCursor;
  holidays: Holiday[];
};

function cellBackground(
  inMonth: boolean,
  isWeekend: boolean,
  cnHoliday: Holiday | undefined,
  veHoliday: Holiday | undefined,
): string {
  if (!inMonth) return "var(--bg-elevated)";
  if (cnHoliday) {
    // Crítico = más opaco
    return cnHoliday.critical
      ? "var(--cal-cn-critical)"
      : "var(--cal-cn-soft)";
  }
  if (veHoliday) return "var(--cal-ve-soft)";
  if (isWeekend) return "var(--cal-weekend)";
  return "var(--bg-surface)";
}

export function MonthGrid({ cursor, holidays }: Props) {
  const cells = buildMonthGrid(cursor);
  const todayIso = toIso(new Date());

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Header de días */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          background: "var(--bg-elevated)",
        }}
      >
        {DAY_NAMES.map((d, i) => (
          <div
            key={d}
            style={{
              padding: "10px 14px",
              font: "700 10.5px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.12em",
              borderRight:
                i < 6 ? "1px solid var(--border)" : "none",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid de celdas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
        }}
      >
        {cells.map((cell, i) => {
          const dayHolidays = holidaysForDate(cell.isoDate, holidays);
          const cnHoliday = dayHolidays.find((h) => h.country === "CN");
          const veHoliday = dayHolidays.find((h) => h.country === "VE");
          const isToday = cell.isoDate === todayIso && cell.inMonth;
          const isRightEdge = (i + 1) % 7 === 0;
          const hasHolidayLabel = cnHoliday || veHoliday;

          const criticalCN = cnHoliday?.critical;

          return (
            <div
              key={cell.isoDate}
              style={{
                minHeight: 110,
                padding: 8,
                background: cellBackground(
                  cell.inMonth,
                  cell.isWeekend,
                  cnHoliday,
                  veHoliday,
                ),
                borderTop: "1px solid var(--border)",
                borderRight: isRightEdge
                  ? "none"
                  : "1px solid var(--border)",
                // Border-left wine para feriados CN críticos
                // (paralización total — más fuerte visual que solo el tinte)
                boxShadow: criticalCN
                  ? "inset 3px 0 0 var(--wine)"
                  : undefined,
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 6,
                  minHeight: 26,
                }}
              >
                {/* Número del día (círculo wine si es hoy) */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: isToday ? 26 : "auto",
                    height: isToday ? 26 : 22,
                    minWidth: isToday ? 26 : "auto",
                    borderRadius: isToday ? "50%" : 0,
                    background: isToday ? "var(--wine)" : "transparent",
                    color: isToday
                      ? "var(--bg-surface)"
                      : cell.inMonth
                        ? "var(--ink)"
                        : "var(--ink-mute)",
                    font: `${isToday ? "900" : "700"} 13px/1 var(--f-display)`,
                    padding: isToday ? 0 : "0 4px",
                    flexShrink: 0,
                  }}
                  aria-current={isToday ? "date" : undefined}
                >
                  {cell.dayOfMonth}
                </span>

                {/* Labels feriados en esquina sup-derecha (CN arriba, VE debajo si hay overlap) */}
                {hasHolidayLabel && cell.inMonth && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 2,
                      maxWidth: 84,
                      minWidth: 0,
                    }}
                  >
                    {cnHoliday && (
                      <span
                        style={{
                          font: "700 9px/1.2 var(--f-sans)",
                          fontFamily: "var(--f-sans), var(--f-cn)",
                          color: "var(--wine)",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          textAlign: "right",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                        }}
                        title={cnHoliday.name}
                      >
                        {cnHoliday.shortName}
                      </span>
                    )}
                    {veHoliday && (
                      <span
                        style={{
                          font: "600 8.5px/1.2 var(--f-sans)",
                          color: "var(--success)",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          textAlign: "right",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                          opacity: 0.9,
                        }}
                        title={veHoliday.name}
                      >
                        {veHoliday.shortName}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
