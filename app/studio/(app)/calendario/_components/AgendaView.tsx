"use client";

/**
 * AgendaView — lista cronológica del mes: eventos operativos, ferias y
 * feriados agrupados por día (Slice 1 · Norte). Los eventos linkean al
 * detalle del embarque; ferias y feriados son informativos.
 */

import Link from "next/link";
import {
  formatShortDate,
  isoToDate,
  type MonthCursor,
} from "@/lib/studio/calendar-helpers";
import type { Fair, Holiday } from "@/lib/studio/calendar-data";
import {
  EVENT_TYPE_META,
  toneVar,
  type CalendarEvent,
} from "@/lib/studio/calendar-events-types";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Badge } from "@/app/studio/_components/ui/Badge";

type AgendaItem =
  | { kind: "event"; date: string; event: CalendarEvent }
  | { kind: "fair"; date: string; fair: Fair }
  | { kind: "holiday"; date: string; holiday: Holiday };

type Props = {
  cursor: MonthCursor;
  events: CalendarEvent[];
  holidays: Holiday[];
  fairs: Fair[];
};

function inCursorMonth(iso: string, cursor: MonthCursor): boolean {
  return (
    Number(iso.slice(0, 4)) === cursor.year &&
    Number(iso.slice(5, 7)) === cursor.month
  );
}

function weekdayLabel(iso: string): string {
  return isoToDate(iso).toLocaleDateString("es-VE", { weekday: "long" });
}

export function AgendaView({ cursor, events, holidays, fairs }: Props) {
  const items: AgendaItem[] = [];
  for (const e of events) {
    if (inCursorMonth(e.date, cursor)) items.push({ kind: "event", date: e.date, event: e });
  }
  for (const f of fairs) {
    if (inCursorMonth(f.startDate, cursor)) items.push({ kind: "fair", date: f.startDate, fair: f });
  }
  for (const h of holidays) {
    if (inCursorMonth(h.startDate, cursor)) items.push({ kind: "holiday", date: h.startDate, holiday: h });
  }

  items.sort((a, b) => a.date.localeCompare(b.date));

  const grouped = new Map<string, AgendaItem[]>();
  for (const it of items) {
    const bucket = grouped.get(it.date);
    if (bucket) bucket.push(it);
    else grouped.set(it.date, [it]);
  }

  if (grouped.size === 0) {
    return (
      <EmptyState
        eyebrow="Agenda"
        title="Sin eventos este mes"
        description="No hay zarpes, arribos, entregas, ferias ni feriados con los filtros aplicados."
      />
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {[...grouped.entries()].map(([date, group], idx) => (
        <div
          key={date}
          style={{
            display: "grid",
            gridTemplateColumns: "120px 1fr",
            gap: 16,
            padding: "14px 18px",
            borderTop: idx > 0 ? "1px solid var(--border)" : "none",
          }}
        >
          <div>
            <div style={{ font: "900 18px/1 var(--f-display)", color: "var(--ink)" }}>
              {formatShortDate(date)}
            </div>
            <div
              style={{
                font: "600 11px/1 var(--f-sans)",
                color: "var(--ink-soft)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginTop: 4,
              }}
            >
              {weekdayLabel(date)}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {group.map((it) => {
              if (it.kind === "event") {
                const e = it.event;
                const meta = EVENT_TYPE_META[e.type];
                return (
                  <Link
                    key={e.id}
                    href={`/studio/tracking/${e.shipmentId}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "64px 1fr",
                      gap: 12,
                      padding: "10px 12px",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                      borderLeft: `3px solid ${toneVar(e.tone)}`,
                      borderRadius: 8,
                      alignItems: "center",
                      textDecoration: "none",
                    }}
                  >
                    <Badge tone={e.tone} size="sm">
                      {meta.short}
                    </Badge>
                    <div>
                      <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>
                        {meta.label} · {e.shipmentCode}
                      </div>
                      {(e.clientName || e.destination) && (
                        <div
                          style={{
                            font: "500 11.5px/1.2 var(--f-sans)",
                            color: "var(--ink-soft)",
                            marginTop: 3,
                          }}
                        >
                          {[e.clientName, e.destination].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              }
              if (it.kind === "fair") {
                const f = it.fair;
                return (
                  <div
                    key={f.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "64px 1fr",
                      gap: 12,
                      padding: "10px 12px",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                      borderLeft: "3px solid var(--info)",
                      borderRadius: 8,
                      alignItems: "center",
                    }}
                  >
                    <Badge tone="info" size="sm">
                      Feria
                    </Badge>
                    <div>
                      <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>
                        {f.name}
                      </div>
                      <div
                        style={{
                          font: "500 11.5px/1.2 var(--f-sans)",
                          color: "var(--ink-soft)",
                          marginTop: 3,
                        }}
                      >
                        {f.city} · {f.sector}
                      </div>
                    </div>
                  </div>
                );
              }
              const h = it.holiday;
              return (
                <div
                  key={h.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "64px 1fr",
                    gap: 12,
                    padding: "10px 12px",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    borderLeft: `3px solid ${
                      h.country === "CN" ? "var(--wine)" : "var(--success)"
                    }`,
                    borderRadius: 8,
                    alignItems: "center",
                  }}
                >
                  <Badge tone={h.country === "CN" ? "wine" : "success"} size="sm">
                    {h.country}
                  </Badge>
                  <div>
                    <div
                      style={{
                        font: "700 13px/1.2 var(--f-sans)",
                        fontFamily: "var(--f-sans), var(--f-cn)",
                        color: "var(--ink)",
                      }}
                    >
                      Feriado · {h.name}
                    </div>
                    <div
                      style={{
                        font: "500 11.5px/1.2 var(--f-sans)",
                        color: "var(--ink-soft)",
                        marginTop: 3,
                      }}
                    >
                      Operación {h.country} {h.critical ? "paralizada" : "reducida"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
