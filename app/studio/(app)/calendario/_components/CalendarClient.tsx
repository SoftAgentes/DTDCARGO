"use client";

/**
 * CalendarClient — orquestador del Calendario operativo (Slice 1 · Norte).
 *
 * Maneja: tabs nivel-1 (Calendario · Ferias CN · Ferias VE), selector de
 * vista (Mes · Semana · Agenda), filtros por tipo de evento, y el drawer
 * del día. La navegación de mes usa `?month=YYYY-MM` (el server re-fetcha
 * los eventos del mes); tab/vista/filtros son estado client efímero.
 *
 * Todo lectura — sin mutaciones, sin server actions.
 */

import { useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type MonthCursor,
  currentMonth,
  formatMonthLabel,
  formatMonthParam,
  nextMonth,
  prevMonth,
} from "@/lib/studio/calendar-helpers";
import type { Fair, Holiday } from "@/lib/studio/calendar-data";
import type { CalendarEvent } from "@/lib/studio/calendar-events-types";
import { Icon } from "@/app/studio/_components/icons";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { AgendaView } from "./AgendaView";
import { DayDrawer } from "./DayDrawer";
import { FairsPanel } from "./FairsPanel";
import { CalendarLegend } from "./CalendarLegend";
import { UpcomingHolidaysCard } from "./UpcomingHolidaysCard";
import { CNHolidayWarning } from "./CNHolidayWarning";

type Tab = "calendar" | "fairs-cn" | "fairs-ve";
type View = "month" | "week" | "agenda";
type Filters = {
  zarpe: boolean;
  arribo: boolean;
  entrega: boolean;
  feriado: boolean;
  feria: boolean;
};

type Props = {
  cursor: MonthCursor;
  events: CalendarEvent[];
  holidays: Holiday[];
  fairs: Fair[];
  todayIso: string;
};

const VIEW_OPTS: { v: View; label: string; icon: () => ReactNode }[] = [
  { v: "month", label: "Mes", icon: () => Icon.dashboard(13) },
  { v: "week", label: "Semana", icon: () => Icon.menu(13) },
  { v: "agenda", label: "Agenda", icon: () => Icon.doc(13) },
];

export function CalendarClient({
  cursor,
  events,
  holidays,
  fairs,
  todayIso,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const [tab, setTab] = useState<Tab>("calendar");
  const [view, setView] = useState<View>("month");
  const [filters, setFilters] = useState<Filters>({
    zarpe: true,
    arribo: true,
    entrega: true,
    feriado: true,
    feria: true,
  });
  const [dayOpen, setDayOpen] = useState<string | null>(null);

  const fairsCN = useMemo(() => fairs.filter((f) => f.country === "CN"), [fairs]);
  const fairsVE = useMemo(() => fairs.filter((f) => f.country === "VE"), [fairs]);
  const holidaysCN = useMemo(
    () => holidays.filter((h) => h.country === "CN"),
    [holidays],
  );
  const holidaysVE = useMemo(
    () => holidays.filter((h) => h.country === "VE"),
    [holidays],
  );

  // Data filtrada que va a las vistas y al drawer.
  const visibleEvents = useMemo(
    () => events.filter((e) => filters[e.type]),
    [events, filters],
  );
  const visibleHolidays = filters.feriado ? holidays : [];
  const visibleFairs = filters.feria ? fairs : [];

  function navigateMonth(target: MonthCursor) {
    const next = new URLSearchParams(sp.toString());
    next.set("month", formatMonthParam(target));
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  function goToday() {
    const next = new URLSearchParams(sp.toString());
    next.delete("month");
    const q = next.toString();
    router.replace(q ? `?${q}` : "?", { scroll: false });
  }

  const today = currentMonth();
  const isCurrentMonth =
    cursor.year === today.year && cursor.month === today.month;

  const TABS: { v: Tab; label: string; count?: number }[] = [
    { v: "calendar", label: "Calendario" },
    { v: "fairs-cn", label: "Ferias China", count: fairsCN.length },
    { v: "fairs-ve", label: "Ferias Venezuela", count: fairsVE.length },
  ];

  return (
    <div>
      {/* Tabs nivel-1 */}
      <div
        role="tablist"
        aria-label="Secciones del calendario"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border)",
          marginBottom: 18,
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.v;
          return (
            <button
              key={t.v}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 4px",
                margin: "0 8px",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${active ? "var(--wine)" : "transparent"}`,
                color: active ? "var(--ink)" : "var(--ink-soft)",
                font: `${active ? "700" : "500"} 13px/1 var(--f-sans)`,
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {t.label}
              {typeof t.count === "number" && (
                <span
                  style={{
                    font: "700 10.5px/1 var(--f-mono)",
                    color: "var(--ink-mute)",
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "calendar" && (
        <div className="studio-calendar-grid">
          {/* Columna izquierda · nav + vista + grid + leyenda */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 14,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => navigateMonth(prevMonth(cursor))}
                aria-label="Mes anterior"
                className="studio-cal-nav-btn"
              >
                ‹
              </button>
              <h2
                className="studio-display"
                style={{
                  fontSize: 22,
                  color: "var(--ink)",
                  margin: 0,
                  flex: 1,
                  minWidth: 160,
                }}
              >
                {formatMonthLabel(cursor)}
              </h2>
              <button
                type="button"
                onClick={goToday}
                disabled={isCurrentMonth}
                className="studio-cal-today-btn"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => navigateMonth(nextMonth(cursor))}
                aria-label="Mes siguiente"
                className="studio-cal-nav-btn"
              >
                ›
              </button>

              {/* Selector de vista */}
              <div
                role="tablist"
                aria-label="Vista del calendario"
                style={{
                  display: "inline-flex",
                  padding: 3,
                  background: "var(--bg-elevated)",
                  borderRadius: 8,
                  gap: 2,
                }}
              >
                {VIEW_OPTS.map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    role="tab"
                    aria-selected={view === o.v}
                    onClick={() => setView(o.v)}
                    className="studio-cal-viewbtn"
                  >
                    {o.icon()} {o.label}
                  </button>
                ))}
              </div>
            </div>

            {view === "month" && (
              <MonthView
                cursor={cursor}
                events={visibleEvents}
                holidays={visibleHolidays}
                fairs={visibleFairs}
                todayIso={todayIso}
                onDayClick={setDayOpen}
              />
            )}
            {view === "week" && (
              <WeekView
                cursor={cursor}
                events={visibleEvents}
                holidays={visibleHolidays}
                fairs={visibleFairs}
                todayIso={todayIso}
                onDayClick={setDayOpen}
              />
            )}
            {view === "agenda" && (
              <AgendaView
                cursor={cursor}
                events={visibleEvents}
                holidays={visibleHolidays}
                fairs={visibleFairs}
              />
            )}

            <CalendarLegend />
          </div>

          {/* Sidebar · filtros + próximos feriados + warning CN */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <FilterCard filters={filters} setFilters={setFilters} />
            <UpcomingHolidaysCard holidays={holidays} />
            <CNHolidayWarning />
          </aside>
        </div>
      )}

      {tab === "fairs-cn" && (
        <FairsPanel country="CN" fairs={fairsCN} holidays={holidaysCN} />
      )}
      {tab === "fairs-ve" && (
        <FairsPanel country="VE" fairs={fairsVE} holidays={holidaysVE} />
      )}

      {dayOpen && (
        <DayDrawer
          isoDate={dayOpen}
          events={visibleEvents}
          holidays={visibleHolidays}
          fairs={visibleFairs}
          onClose={() => setDayOpen(null)}
        />
      )}
    </div>
  );
}

// ── Filtros ────────────────────────────────────────────────────────
function FilterCard({
  filters,
  setFilters,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  const rows: { k: keyof Filters; label: string; dot: string }[] = [
    { k: "zarpe", label: "Zarpes · ETD", dot: "var(--info)" },
    { k: "arribo", label: "Arribos · ETA", dot: "var(--wine)" },
    { k: "entrega", label: "Entregas · POD", dot: "var(--success)" },
    { k: "feriado", label: "Feriados CN / VE", dot: "var(--ink-soft)" },
    { k: "feria", label: "Ferias comerciales", dot: "var(--info)" },
  ];

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 20,
      }}
    >
      <div className="studio-eyebrow" style={{ color: "var(--wine)", marginBottom: 12 }}>
        Filtros
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((r) => (
          <label
            key={r.k}
            className="studio-cal-filterrow"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "6px 8px",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={filters[r.k]}
              onChange={(e) => setFilters({ ...filters, [r.k]: e.target.checked })}
              style={{ accentColor: "var(--wine)", width: 14, height: 14, flexShrink: 0 }}
            />
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: r.dot,
                flexShrink: 0,
              }}
            />
            <span style={{ font: "500 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
              {r.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
