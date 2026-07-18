"use client";

/**
 * WeekView — 7 columnas (lunes→domingo) con feriados, ferias y eventos
 * operativos (Slice 1 · Norte). Muestra la semana que contiene "hoy" si
 * cae en el mes del cursor; si no, la primera semana del mes. Cada columna
 * es clickeable para abrir el drawer del día.
 */

import {
  buildMonthGrid,
  fairsForDate,
  holidaysForDate,
  type MonthCursor,
} from "@/lib/studio/calendar-helpers";
import type { Fair, Holiday } from "@/lib/studio/calendar-data";
import {
  EVENT_TYPE_META,
  groupEventsByDate,
  toneVar,
  type CalendarEvent,
} from "@/lib/studio/calendar-events-types";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type Props = {
  cursor: MonthCursor;
  events: CalendarEvent[];
  holidays: Holiday[];
  fairs: Fair[];
  todayIso: string;
  onDayClick: (isoDate: string) => void;
};

export function WeekView({
  cursor,
  events,
  holidays,
  fairs,
  todayIso,
  onDayClick,
}: Props) {
  const cells = buildMonthGrid(cursor);
  const todayIdx = cells.findIndex((c) => c.isoDate === todayIso);
  const rowStart = todayIdx >= 0 ? Math.floor(todayIdx / 7) * 7 : 0;
  const week = cells.slice(rowStart, rowStart + 7);
  const eventsByDate = groupEventsByDate(events);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "var(--s-2)" }}>
      {week.map((cell, i) => {
        const dayHolidays = holidaysForDate(cell.isoDate, holidays);
        const dayFairs = fairsForDate(cell.isoDate, fairs);
        const dayEvents = eventsByDate.get(cell.isoDate) ?? [];
        const isToday = cell.isoDate === todayIso;

        return (
          <button
            type="button"
            key={cell.isoDate}
            onClick={() => onDayClick(cell.isoDate)}
            aria-label={`Ver eventos del ${cell.isoDate}`}
            className="studio-cal-daycell"
            style={{
              background: "var(--bg-surface)",
              border: `1px solid ${isToday ? "var(--wine)" : "var(--border)"}`,
              borderRadius: 8,
              padding: "var(--s-3)",
              minHeight: 340,
              textAlign: "left",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              opacity: cell.inMonth ? 1 : 0.55,
            }}
          >
            <div
              style={{
                font: "700 10.5px/1 var(--f-sans)",
                color: "var(--ink-soft)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {WEEKDAY_LABELS[i]}
            </div>
            <div
              style={{
                font: "900 22px/1 var(--f-display)",
                color: isToday ? "var(--wine)" : "var(--ink)",
                marginBottom: "var(--s-1)",
              }}
            >
              {cell.dayOfMonth}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {dayHolidays.map((h) => (
                <span
                  key={h.id}
                  style={{
                    padding: "5px 8px",
                    borderRadius: 6,
                    background:
                      h.country === "CN"
                        ? "var(--cal-cn-soft)"
                        : "var(--cal-ve-soft)",
                    borderLeft: `3px solid ${
                      h.country === "CN" ? "var(--wine)" : "var(--success)"
                    }`,
                    font: "600 10.5px/1.3 var(--f-sans)",
                    fontFamily: "var(--f-sans), var(--f-cn)",
                    color: "var(--ink)",
                  }}
                >
                  Feriado {h.country} · {h.shortName}
                </span>
              ))}
              {dayFairs.map((f) => (
                <span
                  key={f.id}
                  style={{
                    padding: "5px 8px",
                    borderRadius: 6,
                    background: "var(--info-bg)",
                    borderLeft: "3px solid var(--info)",
                    font: "600 10.5px/1.3 var(--f-sans)",
                    color: "var(--ink)",
                  }}
                >
                  Feria · {f.shortName}
                </span>
              ))}
              {dayEvents.map((e) => {
                const meta = EVENT_TYPE_META[e.type];
                const color = toneVar(e.tone);
                return (
                  <span
                    key={e.id}
                    style={{
                      padding: "5px 8px",
                      borderRadius: 6,
                      background: "var(--bg-elevated)",
                      borderLeft: `3px solid ${color}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <span
                      style={{
                        font: "700 9.5px/1 var(--f-sans)",
                        color,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      {meta.label} · {meta.short}
                    </span>
                    <span
                      style={{
                        font: "700 11px/1.2 var(--f-mono)",
                        color: "var(--ink)",
                      }}
                    >
                      {e.shipmentCode}
                    </span>
                  </span>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
