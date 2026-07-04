"use client";

/**
 * DayDrawer — drawer lateral de solo lectura con el detalle de un día:
 * eventos operativos (zarpe/arribo/entrega), ferias y feriados (Slice 1 ·
 * Norte). Usa el DrawerShell compartido. Los eventos linkean al detalle
 * del embarque.
 */

import Link from "next/link";
import {
  fairsForDate,
  holidaysForDate,
  isoToDate,
} from "@/lib/studio/calendar-helpers";
import type { Fair, Holiday } from "@/lib/studio/calendar-data";
import {
  EVENT_TYPE_META,
  calendarEventHref,
  eventsForDate,
  toneVar,
  type CalendarEvent,
} from "@/lib/studio/calendar-events-types";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Badge } from "@/app/studio/_components/ui/Badge";

type Props = {
  isoDate: string;
  events: CalendarEvent[];
  holidays: Holiday[];
  fairs: Fair[];
  onClose: () => void;
};

function formatLongDate(iso: string): string {
  const raw = isoToDate(iso).toLocaleDateString("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function DayDrawer({ isoDate, events, holidays, fairs, onClose }: Props) {
  const dayEvents = eventsForDate(isoDate, events);
  const dayHolidays = holidaysForDate(isoDate, holidays);
  const dayFairs = fairsForDate(isoDate, fairs);
  const total = dayEvents.length + dayHolidays.length + dayFairs.length;

  return (
    <DrawerShell
      title={formatLongDate(isoDate)}
      subtitle={
        total === 0
          ? "Sin novedades"
          : `${total} ${total === 1 ? "novedad" : "novedades"}`
      }
      onClose={onClose}
      pending={false}
      width={520}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {total === 0 && (
          <EmptyState
            eyebrow="Día"
            title="Sin eventos"
            description="No hay zarpes, arribos, entregas, ferias ni feriados este día."
          />
        )}

        {/* Feriados */}
        {dayHolidays.map((h) => (
          <div
            key={h.id}
            style={{
              padding: "12px 14px",
              background:
                h.country === "CN" ? "var(--cal-cn-soft)" : "var(--cal-ve-soft)",
              border: "1px solid var(--border)",
              borderLeft: `3px solid ${
                h.country === "CN" ? "var(--wine)" : "var(--success)"
              }`,
              borderRadius: 8,
              display: "flex",
              gap: 12,
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
                  font: "500 11.5px/1.4 var(--f-sans)",
                  color: "var(--ink-soft)",
                  marginTop: 3,
                }}
              >
                Operación {h.country} {h.critical ? "paralizada" : "reducida"}.
                {h.critical && h.country === "CN"
                  ? " Planifica zarpes con 3 semanas de anticipación."
                  : ""}
              </div>
            </div>
          </div>
        ))}

        {/* Ferias */}
        {dayFairs.map((f) => (
          <div
            key={f.id}
            style={{
              padding: "12px 14px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderLeft: "3px solid var(--info)",
              borderRadius: 8,
              display: "flex",
              gap: 12,
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
                  font: "500 11.5px/1.4 var(--f-sans)",
                  color: "var(--ink-soft)",
                  marginTop: 3,
                }}
              >
                {f.city} · {f.sector}
              </div>
            </div>
          </div>
        ))}

        {/* Eventos operativos (embarques) + tareas de Bitácora (SDD-0146) */}
        {dayEvents.map((e) => {
          const meta = EVENT_TYPE_META[e.type];
          const primary = e.type === "tarea" ? e.title : e.shipmentCode;
          return (
            <Link
              key={e.id}
              href={calendarEventHref(e)}
              onClick={onClose}
              style={{
                padding: "12px 14px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderLeft: `3px solid ${toneVar(e.tone)}`,
                borderRadius: 8,
                display: "flex",
                gap: 12,
                alignItems: "center",
                textDecoration: "none",
              }}
            >
              <Badge tone={e.tone} size="sm">
                {meta.short}
              </Badge>
              <div style={{ flex: 1 }}>
                <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>
                  {meta.label} · {primary}
                </div>
                {(e.clientName || e.destination) && (
                  <div
                    style={{
                      font: "500 11.5px/1.4 var(--f-sans)",
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
        })}
      </div>
    </DrawerShell>
  );
}
