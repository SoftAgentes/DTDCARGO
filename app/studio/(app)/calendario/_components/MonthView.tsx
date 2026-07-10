"use client";

/**
 * MonthView — grid 7×N del mes con feriados, ferias y eventos operativos
 * (Slice 1 · Norte). Reemplaza al MonthGrid estático: además de pintar
 * feriados, pinta chips de zarpe/arribo/entrega y ferias, y cada día es
 * clickeable para abrir el drawer del día. Lunes como primer día.
 */

import {
  buildMonthGrid,
  fairsForDate,
  holidaysForDate,
  type MonthCursor,
} from "@/lib/studio/calendar-helpers";
import type { Fair, Holiday } from "@/lib/studio/calendar-data";
import {
  groupEventsByDate,
  type CalendarEvent,
} from "@/lib/studio/calendar-events-types";
import { Icon } from "@/app/studio/_components/icons";
import { EventChip } from "./EventChip";

const DAY_NAMES = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const MAX_EVENT_CHIPS = 3;

type Props = {
  cursor: MonthCursor;
  events: CalendarEvent[];
  holidays: Holiday[];
  fairs: Fair[];
  todayIso: string;
  onDayClick: (isoDate: string) => void;
};

function cellBackground(
  inMonth: boolean,
  isWeekend: boolean,
  cnHoliday: Holiday | undefined,
  veHoliday: Holiday | undefined,
): string {
  if (!inMonth) return "var(--bg-elevated)";
  if (cnHoliday) {
    return cnHoliday.critical ? "var(--cal-cn-critical)" : "var(--cal-cn-soft)";
  }
  if (veHoliday) return "var(--cal-ve-soft)";
  if (isWeekend) return "var(--cal-weekend)";
  return "var(--bg-surface)";
}

export function MonthView({
  cursor,
  events,
  holidays,
  fairs,
  todayIso,
  onDayClick,
}: Props) {
  const cells = buildMonthGrid(cursor);
  const eventsByDate = groupEventsByDate(events);

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
              borderRight: i < 6 ? "1px solid var(--border)" : "none",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid de celdas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {cells.map((cell, i) => {
          const dayHolidays = holidaysForDate(cell.isoDate, holidays);
          const cnHoliday = dayHolidays.find((h) => h.country === "CN");
          const veHoliday = dayHolidays.find((h) => h.country === "VE");
          const dayFairs = cell.inMonth ? fairsForDate(cell.isoDate, fairs) : [];
          const dayEvents = cell.inMonth
            ? eventsByDate.get(cell.isoDate) ?? []
            : [];
          const isToday = cell.isoDate === todayIso && cell.inMonth;
          const isRightEdge = (i + 1) % 7 === 0;
          const criticalCN = cnHoliday?.critical;
          const hiddenEvents = dayEvents.length - MAX_EVENT_CHIPS;

          return (
            <button
              type="button"
              key={cell.isoDate}
              onClick={() => cell.inMonth && onDayClick(cell.isoDate)}
              disabled={!cell.inMonth}
              aria-label={`Ver eventos del ${cell.isoDate}`}
              className="studio-cal-daycell"
              style={{
                minHeight: 116,
                padding: "var(--s-2)",
                textAlign: "left",
                background: cellBackground(
                  cell.inMonth,
                  cell.isWeekend,
                  cnHoliday,
                  veHoliday,
                ),
                borderTop: "1px solid var(--border)",
                borderRight: isRightEdge ? "none" : "1px solid var(--border)",
                borderLeft: "none",
                borderBottom: "none",
                boxShadow: criticalCN ? "inset 3px 0 0 var(--wine)" : undefined,
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: "var(--s-1)",
                cursor: cell.inMonth ? "pointer" : "default",
                width: "100%",
                font: "inherit",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 6,
                  minHeight: 24,
                }}
              >
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
                    padding: isToday ? 0 : "0 2px",
                    flexShrink: 0,
                  }}
                  aria-current={isToday ? "date" : undefined}
                >
                  {cell.dayOfMonth}
                </span>

                {(cnHoliday || veHoliday) && cell.inMonth && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 2,
                      maxWidth: 82,
                      minWidth: 0,
                    }}
                  >
                    {cnHoliday && (
                      <span
                        title={cnHoliday.name}
                        style={{
                          font: "700 8.5px/1.2 var(--f-sans)",
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
                      >
                        {cnHoliday.shortName}
                      </span>
                    )}
                    {veHoliday && (
                      <span
                        title={veHoliday.name}
                        style={{
                          font: "600 8px/1.2 var(--f-sans)",
                          color: "var(--success)",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          textAlign: "right",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                        }}
                      >
                        {veHoliday.shortName}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Ferias */}
              {dayFairs.map((f) => (
                <span
                  key={f.id}
                  title={`${f.name} · ${f.city}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--s-1)",
                    padding: "2px 6px",
                    borderRadius: 3,
                    background: "var(--info-bg)",
                    color: "var(--info)",
                    font: "700 9.5px/1.3 var(--f-sans)",
                    overflow: "hidden",
                  }}
                >
                  <span style={{ flexShrink: 0, display: "inline-flex" }}>
                    {Icon.globe(10)}
                  </span>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.shortName}
                  </span>
                </span>
              ))}

              {/* Eventos operativos */}
              {dayEvents.slice(0, MAX_EVENT_CHIPS).map((e) => (
                <EventChip key={e.id} event={e} />
              ))}
              {hiddenEvents > 0 && (
                <span
                  style={{
                    font: "600 10px/1 var(--f-sans)",
                    color: "var(--ink-soft)",
                    padding: "1px 6px",
                  }}
                >
                  +{hiddenEvents} más
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
