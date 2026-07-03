/**
 * Eventos operativos del Calendario (Slice 1 · Norte).
 *
 * Un CalendarEvent es un hito real derivado de un embarque:
 *   - `zarpe`   → salida / ETD (evento `shipped` en shipment_events).
 *   - `arribo`  → llegada a destino / ETA (`shipments.arrived_destination_at`).
 *   - `entrega` → POD firmado (`shipments.delivered_at`).
 *
 * Todo lectura. La query vive en `calendar-events-queries.ts`.
 */

export type CalendarEventType = "zarpe" | "arribo" | "entrega";

export type CalendarEventTone = "info" | "wine" | "success";

export type CalendarEvent = {
  /** Estable para keys de React. `<shipmentId>-<type>` o `<eventId>-zarpe`. */
  id: string;
  /** ISO `YYYY-MM-DD` (día del hito). */
  date: string;
  type: CalendarEventType;
  /** UUID del embarque · para linkear al detalle. */
  shipmentId: string;
  /** Código legible del embarque (S-2026-NNNN). */
  shipmentCode: string;
  /** Texto principal del chip. Hoy = shipmentCode. */
  title: string;
  clientName?: string;
  destination?: string;
  tone: CalendarEventTone;
};

/** Metadata de presentación por tipo (label largo, sigla, tono). */
export const EVENT_TYPE_META: Record<
  CalendarEventType,
  { label: string; short: string; tone: CalendarEventTone }
> = {
  zarpe: { label: "Zarpe", short: "ETD", tone: "info" },
  arribo: { label: "Arribo", short: "ETA", tone: "wine" },
  entrega: { label: "Entrega", short: "POD", tone: "success" },
};

/** CSS var del color de un tono de evento. */
export function toneVar(tone: CalendarEventTone): string {
  if (tone === "info") return "var(--info)";
  if (tone === "success") return "var(--success)";
  return "var(--wine)";
}

/** CSS var del fondo tenue (tint) de un tono de evento. */
export function toneBgVar(tone: CalendarEventTone): string {
  if (tone === "info") return "var(--info-bg)";
  if (tone === "success") return "var(--success-bg)";
  return "var(--wine-tint)";
}

/** Devuelve los eventos de una fecha ISO dada. */
export function eventsForDate(
  isoDate: string,
  events: CalendarEvent[],
): CalendarEvent[] {
  return events.filter((e) => e.date === isoDate);
}

/**
 * Agrupa eventos por fecha ISO. Útil para pintar el grid o la agenda.
 * El orden de inserción preserva el orden del array recibido.
 */
export function groupEventsByDate(
  events: CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const bucket = map.get(e.date);
    if (bucket) bucket.push(e);
    else map.set(e.date, [e]);
  }
  return map;
}
