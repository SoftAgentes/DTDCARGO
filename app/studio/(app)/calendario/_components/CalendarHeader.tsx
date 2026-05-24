"use client";

/**
 * CalendarHeader — navegación mes anterior/hoy/siguiente + view switch
 * (SDD-0015). View switch tiene Mes activo + Semana/Agenda disabled
 * (placeholder hasta SDD futuro).
 *
 * Cambia `?month=YYYY-MM` via router.replace.
 */

import { useRouter, useSearchParams } from "next/navigation";
import {
  type MonthCursor,
  currentMonth,
  formatMonthLabel,
  formatMonthParam,
  nextMonth,
  prevMonth,
} from "@/lib/studio/calendar-helpers";

type Props = {
  cursor: MonthCursor;
};

export function CalendarHeader({ cursor }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  function navigate(target: MonthCursor) {
    const next = new URLSearchParams(sp.toString());
    next.set("month", formatMonthParam(target));
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  function clearToToday() {
    const next = new URLSearchParams(sp.toString());
    next.delete("month");
    const q = next.toString();
    router.replace(q ? `?${q}` : "?", { scroll: false });
  }

  const monthLabel = formatMonthLabel(cursor);
  const today = currentMonth();
  const isCurrentMonth =
    cursor.year === today.year && cursor.month === today.month;

  return (
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
        onClick={() => navigate(prevMonth(cursor))}
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
          minWidth: 180,
        }}
      >
        {monthLabel}
      </h2>

      <button
        type="button"
        onClick={clearToToday}
        disabled={isCurrentMonth}
        className="studio-cal-today-btn"
      >
        HOY
      </button>

      <button
        type="button"
        onClick={() => navigate(nextMonth(cursor))}
        aria-label="Mes siguiente"
        className="studio-cal-nav-btn"
      >
        ›
      </button>

      <ViewSwitch />
    </div>
  );
}

/**
 * View switch: Mes activo, Semana/Agenda disabled (SDD futuro).
 * No usa state — solo es visual placeholder.
 */
function ViewSwitch() {
  const opts = [
    { v: "month", l: "Mes", active: true, available: true },
    { v: "week", l: "Semana", active: false, available: false },
    { v: "agenda", l: "Agenda", active: false, available: false },
  ];

  return (
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
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          role="tab"
          aria-selected={o.active}
          disabled={!o.available}
          title={o.available ? undefined : "Próximamente"}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            background: o.active ? "var(--bg-surface)" : "transparent",
            color: o.active
              ? "var(--ink)"
              : o.available
                ? "var(--ink-soft)"
                : "var(--ink-mute)",
            font: `${o.active ? "700" : "500"} 12.5px/1 var(--f-sans)`,
            boxShadow: o.active ? "var(--shadow-xs)" : "none",
            border: "none",
            cursor: o.available ? "pointer" : "not-allowed",
            opacity: o.available ? 1 : 0.6,
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
