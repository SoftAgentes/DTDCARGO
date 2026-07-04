/**
 * EventChip — chip compacto de un evento operativo dentro de una celda
 * del grid o de la vista semana (Slice 1 · Norte). Presentacional puro.
 */

import {
  EVENT_TYPE_META,
  toneBgVar,
  toneVar,
  type CalendarEvent,
} from "@/lib/studio/calendar-events-types";

export function EventChip({ event }: { event: CalendarEvent }) {
  const color = toneVar(event.tone);
  const bg = toneBgVar(event.tone);
  const meta = EVENT_TYPE_META[event.type];
  // Embarque: cola del código (S-2026-0042 → 0042) para ahorrar ancho.
  // Tarea (SDD-0146): el título de la tarea (no hay código de embarque).
  const tail =
    event.type === "tarea"
      ? event.title
      : (event.shipmentCode.split("-").slice(-1)[0] ?? event.shipmentCode);

  return (
    <span
      title={`${meta.label} · ${event.type === "tarea" ? event.title : event.shipmentCode}${
        event.clientName ? ` · ${event.clientName}` : ""
      }`}
      style={{
        display: "block",
        padding: "2px 6px",
        borderRadius: 3,
        background: bg,
        color,
        font: "700 10px/1.3 var(--f-mono)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {meta.short} {tail}
    </span>
  );
}
