/**
 * Query de eventos operativos para el Calendario (Slice 1 · Norte).
 *
 * `listCalendarEvents` trae los hitos de embarques del tenant cuya fecha
 * cae en el rango [from, to] y los mapea a `CalendarEvent`. Solo lectura —
 * la RLS por tenant_id ya filtra; no se pasa tenant_id.
 *
 * Campos de fecha REALES usados (no hay columnas ETD/ETA en `shipments`):
 *   - arribo  → `shipments.arrived_destination_at` (migr 0002)
 *   - entrega → `shipments.delivered_at`           (migr 0009)
 *   - zarpe   → `shipment_events.occurred_at` del evento `status = 'shipped'`
 *               (no existe columna de zarpe en shipments; el timeline es la
 *               fuente real de la salida).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_CALENDAR_TIME_ZONE,
  bitacoraTaskToCalendarEvent,
  normalizeCalendarTimeZone,
  timestampToCalendarDay,
  type BitacoraTaskCalRow,
  type CalendarEvent,
} from "./calendar-events-types";

export type CalendarRange = {
  /** ISO `YYYY-MM-DD` inclusivo. */
  from: string;
  /** ISO `YYYY-MM-DD` inclusivo. */
  to: string;
};

type ShipmentDateRow = {
  id: string;
  code: string;
  client_name: string | null;
  destination: string | null;
  arrived_destination_at: string | null;
  delivered_at: string | null;
};

type ShippedEventRow = {
  id: string;
  occurred_at: string;
  shipment:
    | {
        id: string;
        code: string;
        client_name: string | null;
        destination: string | null;
      }
    | {
        id: string;
        code: string;
        client_name: string | null;
        destination: string | null;
      }[]
    | null;
};

function shiftIsoDay(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/** True si el día ISO del timestamp cae dentro de [from, to]. */
function dayInRange(
  ts: string,
  from: string,
  to: string,
  timeZone: string,
): boolean {
  const day = timestampToCalendarDay(ts, timeZone);
  return day >= from && day <= to;
}

/**
 * Eventos operativos (zarpe · arribo · entrega) del rango dado.
 * Devuelve una lista plana lista para pintar en el grid / semana / agenda.
 */
export async function listCalendarEvents(
  supabase: SupabaseClient,
  range: CalendarRange,
  options: { timeZone?: string } = {},
): Promise<CalendarEvent[]> {
  const { from, to } = range;
  const timeZone = normalizeCalendarTimeZone(
    options.timeZone ?? DEFAULT_CALENDAR_TIME_ZONE,
  );
  // Una zona IANA puede mover el día frente a UTC. El query se amplía un día
  // en ambos extremos y el filtro final usa el día civil real.
  const fromTs = `${shiftIsoDay(from, -1)}T00:00:00Z`;
  const toTs = `${shiftIsoDay(to, 1)}T23:59:59Z`;

  const events: CalendarEvent[] = [];

  // ── Arribo + entrega: columnas timestamptz en shipments ──────────
  // El .or() trae la fila si CUALQUIER columna cae en rango; luego
  // filtramos por columna para no emitir un hito fuera del rango.
  const { data: shipmentsData, error: shipErr } = await supabase
    .from("shipments")
    .select(
      "id, code, client_name, destination, arrived_destination_at, delivered_at",
    )
    .or(
      `and(arrived_destination_at.gte.${fromTs},arrived_destination_at.lte.${toTs}),` +
        `and(delivered_at.gte.${fromTs},delivered_at.lte.${toTs})`,
    )
    .limit(500);
  if (shipErr) throw shipErr;

  for (const s of (shipmentsData ?? []) as ShipmentDateRow[]) {
    if (
      s.arrived_destination_at &&
      dayInRange(s.arrived_destination_at, from, to, timeZone)
    ) {
      events.push({
        id: `${s.id}-arribo`,
        date: timestampToCalendarDay(s.arrived_destination_at, timeZone),
        temporalKind: "instant",
        timeZone,
        type: "arribo",
        shipmentId: s.id,
        shipmentCode: s.code,
        title: s.code,
        clientName: s.client_name ?? undefined,
        destination: s.destination ?? undefined,
        tone: "wine",
      });
    }
    if (
      s.delivered_at &&
      dayInRange(s.delivered_at, from, to, timeZone)
    ) {
      events.push({
        id: `${s.id}-entrega`,
        date: timestampToCalendarDay(s.delivered_at, timeZone),
        temporalKind: "instant",
        timeZone,
        type: "entrega",
        shipmentId: s.id,
        shipmentCode: s.code,
        title: s.code,
        clientName: s.client_name ?? undefined,
        destination: s.destination ?? undefined,
        tone: "success",
      });
    }
  }

  // ── Zarpe: evento 'shipped' del timeline, con el embarque embebido ──
  const { data: shippedData, error: evErr } = await supabase
    .from("shipment_events")
    .select(
      "id, occurred_at, shipment:shipments(id, code, client_name, destination)",
    )
    .eq("status", "shipped")
    .gte("occurred_at", fromTs)
    .lte("occurred_at", toTs)
    .limit(500);
  if (evErr) throw evErr;

  for (const ev of (shippedData ?? []) as ShippedEventRow[]) {
    if (!dayInRange(ev.occurred_at, from, to, timeZone)) continue;
    // El embed to-one puede venir como objeto o (según PostgREST) array.
    const s = Array.isArray(ev.shipment) ? ev.shipment[0] : ev.shipment;
    if (!s) continue; // embarque soft-deleted → filtrado por RLS
    events.push({
      id: `${ev.id}-zarpe`,
      date: timestampToCalendarDay(ev.occurred_at, timeZone),
      temporalKind: "instant",
      timeZone,
      type: "zarpe",
      shipmentId: s.id,
      shipmentCode: s.code,
      title: s.code,
      clientName: s.client_name ?? undefined,
      destination: s.destination ?? undefined,
      tone: "info",
    });
  }

  // ── Tareas de Bitácora con vencimiento en el rango (SDD-0146 · Fase 6) ──
  // Aditivo: una fuente más en la union, NO una tabla nueva. Degrada a []
  // si `bitacora_tasks` aún no existe (migr 0213 la aplica el founder) o si
  // no hay permiso → el calendario sigue con los hitos de embarques (nunca
  // rompe el calendario existente).
  try {
    const { data: taskData, error: taskErr } = await supabase
      .from("bitacora_tasks")
      .select("id, titulo, due_date, estado")
      .gte("due_date", from)
      .lte("due_date", to)
      .neq("estado", "hecho")
      .limit(500);
    if (!taskErr && taskData) {
      for (const t of taskData as BitacoraTaskCalRow[]) {
        const ev = bitacoraTaskToCalendarEvent(t);
        if (ev) events.push(ev);
      }
    }
  } catch {
    /* bitácora sin aplicar / sin permiso → calendario advisory, no rompe */
  }

  return events;
}
