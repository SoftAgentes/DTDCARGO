"use client";

import { useActionState, useState } from "react";
import type { Shipment } from "@/lib/studio/shipment-types";
import { updateShipmentPlan, type ActionState } from "../actions";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

const ZONES = [
  ["America/Caracas", "Venezuela · America/Caracas"],
  ["Asia/Shanghai", "China · Asia/Shanghai"],
  ["UTC", "UTC"],
] as const;

function partsInZone(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

function localInZoneToIso(value: string, timeZone: string): string {
  if (!value) return "";
  const [date, clock] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = clock.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let guess = desired;
  for (let index = 0; index < 2; index += 1) {
    const observed = partsInZone(new Date(guess), timeZone);
    const [observedDate, observedClock] = observed.split("T");
    const [oy, om, od] = observedDate.split("-").map(Number);
    const [oh, omin] = observedClock.split(":").map(Number);
    guess += desired - Date.UTC(oy, om - 1, od, oh, omin);
  }
  return new Date(guess).toISOString();
}

export function ShipmentPlanPanel({
  shipment,
  canEdit,
}: {
  shipment: Shipment;
  canEdit: boolean;
}) {
  const action = updateShipmentPlan.bind(null, shipment.id);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const [timezone, setTimezone] = useState(shipment.planning_timezone);
  const [departure, setDeparture] = useState(
    shipment.planned_departure_at ? partsInZone(new Date(shipment.planned_departure_at), timezone) : "",
  );
  const [arrival, setArrival] = useState(
    shipment.planned_arrival_at ? partsInZone(new Date(shipment.planned_arrival_at), timezone) : "",
  );
  const [delivery, setDelivery] = useState(
    shipment.planned_delivery_at ? partsInZone(new Date(shipment.planned_delivery_at), timezone) : "",
  );

  return (
    <form action={formAction}>
      <div className="studio-eyebrow" style={{ marginBottom: 6 }}>Plan operativo</div>
      <p style={{ color: "var(--ink-soft)", font: "500 12px/1.5 var(--f-sans)", margin: "0 0 14px" }}>
        Fechas previstas; los hitos reales del timeline no se modifican.
      </p>
      <input type="hidden" name="planning_version" value={shipment.planning_version} />
      <input type="hidden" name="planned_departure_at" value={localInZoneToIso(departure, timezone)} />
      <input type="hidden" name="planned_arrival_at" value={localInZoneToIso(arrival, timezone)} />
      <input type="hidden" name="planned_delivery_at" value={localInZoneToIso(delivery, timezone)} />
      <label className="studio-label" htmlFor="planning_timezone">Zona horaria</label>
      <select
        id="planning_timezone"
        name="planning_timezone"
        className="studio-input"
        value={timezone}
        onChange={(event) => setTimezone(event.target.value)}
        disabled={!canEdit}
        style={{ marginBottom: 12 }}
      >
        {ZONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {[
        ["planned_departure_local", "Salida planificada", departure, setDeparture],
        ["planned_arrival_local", "Llegada planificada", arrival, setArrival],
        ["planned_delivery_local", "Entrega planificada", delivery, setDelivery],
      ].map(([id, label, value, setter]) => (
        <div key={id as string} style={{ marginBottom: 12 }}>
          <label className="studio-label" htmlFor={id as string}>{label as string}</label>
          <input
            id={id as string}
            className="studio-input"
            type="datetime-local"
            value={value as string}
            onChange={(event) => (setter as (next: string) => void)(event.target.value)}
            disabled={!canEdit}
          />
        </div>
      ))}
      {canEdit && (
        <>
          <label className="studio-label" htmlFor="planning_reason">Motivo de planificación o cambio</label>
          <input id="planning_reason" name="planning_reason" className="studio-input" minLength={4} required placeholder="Ej. itinerario confirmado por naviera" style={{ marginBottom: 12 }} />
          {state.error && (
            <div style={{ marginBottom: 12 }}>
              <Aviso tono="error" compacto>{state.error}</Aviso>
            </div>
          )}
          {state.ok && (
            <div style={{ marginBottom: 12 }}>
              <Aviso tono="exito" compacto>Plan guardado.</Aviso>
            </div>
          )}
          <button type="submit" className="studio-btn studio-btn-primary studio-btn-sm" disabled={pending}>
            {pending ? "Guardando…" : "Guardar planificación"}
          </button>
        </>
      )}
    </form>
  );
}
