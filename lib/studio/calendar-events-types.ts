/**
 * Eventos operativos del Calendario (Slice 1 · Norte).
 *
 * Un CalendarEvent es un hito real derivado de un embarque:
 *   - `zarpe`   → salida / ETD (evento `shipped` en shipment_events).
 *   - `arribo`  → llegada a destino / ETA (`shipments.arrived_destination_at`).
 *   - `entrega` → POD firmado (`shipments.delivered_at`).
 *   - `tarea`   → tarea de Bitácora con vencimiento (SDD-0146 · Fase 6). Es
 *                 aditivo: una fuente más en la union query, NO una tabla nueva.
 *
 * Todo lectura. La query vive en `calendar-events-queries.ts`.
 */

export type CalendarEventType =
  | "zarpe"
  | "arribo"
  | "entrega"
  | "zarpe_planificado"
  | "arribo_planificado"
  | "entrega_planificada"
  | "tarea";

export type CalendarEventTone = "info" | "wine" | "success" | "neutral";

export const DEFAULT_CALENDAR_TIME_ZONE = "America/Caracas";

/** Acepta solo zonas IANA reconocidas por el runtime; degrada a Caracas. */
export function normalizeCalendarTimeZone(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    return DEFAULT_CALENDAR_TIME_ZONE;
  }
  const candidate = value.trim();
  try {
    new Intl.DateTimeFormat("en", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return DEFAULT_CALENDAR_TIME_ZONE;
  }
}

/** Convierte un instante ISO al día civil de una zona IANA, sin cortar UTC. */
export function timestampToCalendarDay(
  timestamp: string,
  timeZone: string,
): string {
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: normalizeCalendarTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export type CalendarEvent = {
  /** Estable para keys de React. `<shipmentId>-<type>` o `<eventId>-zarpe`. */
  id: string;
  /** ISO `YYYY-MM-DD` (día del hito). */
  date: string;
  /** `instant` se convierte con `timeZone`; `local-date` ya es día civil. */
  temporalKind: "instant" | "local-date";
  /** Zona IANA visible para eventos derivados de timestamptz. */
  timeZone?: string;
  type: CalendarEventType;
  /**
   * UUID de la entidad · para linkear al detalle. Para embarques es el
   * shipmentId; para tareas (SDD-0146) es el taskId (el `href` manda el destino
   * real, este campo queda como id genérico y key de React).
   */
  shipmentId: string;
  /** Código legible del embarque (S-2026-NNNN). "" para eventos sin código. */
  shipmentCode: string;
  /** Texto principal del chip. Embarque = shipmentCode; tarea = su título. */
  title: string;
  clientName?: string;
  destination?: string;
  tone: CalendarEventTone;
  /**
   * Destino del enlace del evento (SDD-0146 · Fase 6). Si está presente, el
   * drawer linkea acá en vez de al tracking del embarque. Las tareas lo setean
   * a `/studio/bitacora?task={id}`.
   */
  href?: string;
};

/** Destino del enlace de un evento del calendario (embarque o tarea). */
export function calendarEventHref(e: CalendarEvent): string {
  return e.href ?? `/studio/tracking/${e.shipmentId}`;
}

/** Metadata de presentación por tipo (label largo, sigla, tono). */
export const EVENT_TYPE_META: Record<
  CalendarEventType,
  { label: string; short: string; tone: CalendarEventTone }
> = {
  zarpe: { label: "Zarpe", short: "ETD", tone: "info" },
  arribo: { label: "Arribo", short: "ETA", tone: "wine" },
  entrega: { label: "Entrega", short: "POD", tone: "success" },
  zarpe_planificado: { label: "Salida planificada", short: "ETD plan", tone: "info" },
  arribo_planificado: { label: "Llegada planificada", short: "ETA plan", tone: "wine" },
  entrega_planificada: { label: "Entrega planificada", short: "POD plan", tone: "success" },
  tarea: { label: "Tarea", short: "TAREA", tone: "neutral" },
};

/** CSS var del color de un tono de evento. */
export function toneVar(tone: CalendarEventTone): string {
  if (tone === "info") return "var(--info)";
  if (tone === "success") return "var(--success)";
  if (tone === "neutral") return "var(--ink-soft)";
  return "var(--wine)";
}

/** CSS var del fondo tenue (tint) de un tono de evento. */
export function toneBgVar(tone: CalendarEventTone): string {
  if (tone === "info") return "var(--info-bg)";
  if (tone === "success") return "var(--success-bg)";
  if (tone === "neutral") return "var(--neutral-bg)";
  return "var(--wine-tint)";
}

/**
 * Fila mínima de `bitacora_tasks` que el calendario necesita (SDD-0146 · F6).
 * El mapeo es PURO → testeable sin DB.
 */
export type BitacoraTaskCalRow = {
  id: string;
  titulo: string;
  due_date: string | null;
  estado: string;
};

/**
 * Mapea una tarea de Bitácora con vencimiento a un evento `tarea` del
 * calendario. Sin `due_date` → `null` (no aparece). Las tareas ya en `hecho`
 * las excluye la query (no la vista). El enlace apunta al detalle de la tarea.
 */
export function bitacoraTaskToCalendarEvent(
  row: BitacoraTaskCalRow,
): CalendarEvent | null {
  if (!row.due_date) return null;
  const day = row.due_date.slice(0, 10);
  return {
    id: `${row.id}-tarea`,
    date: day,
    temporalKind: "local-date",
    type: "tarea",
    shipmentId: row.id,
    shipmentCode: "",
    title: row.titulo,
    tone: "neutral",
    href: `/studio/bitacora?task=${row.id}`,
  };
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
