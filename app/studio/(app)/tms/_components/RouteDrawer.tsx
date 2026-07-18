"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { createRouteAction } from "../actions";
import type { EligibleShipmentForRoute } from "@/lib/studio/tms-queries";
import type {
  TmsActionState,
  TmsDriver,
  TmsTruck,
} from "@/lib/studio/tms-types";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  FieldText,
  FieldSelect,
  FieldError,
  FormError,
} from "./TruckDrawer";

const initialState: TmsActionState = {};

interface Props {
  eligibleShipments: EligibleShipmentForRoute[];
  availableTrucks: TmsTruck[];
  availableDrivers: TmsDriver[];
  /** Si viene preselected via ?shipment=<id> (refactor VE). */
  preselectShipmentId?: string;
  onClose: () => void;
}

export function RouteDrawer({
  eligibleShipments,
  availableTrucks,
  availableDrivers,
  preselectShipmentId,
  onClose,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    createRouteAction,
    initialState,
  );

  const [shipmentId, setShipmentId] = useState(preselectShipmentId ?? "");
  const [truckId, setTruckId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [stops, setStops] = useState<string[]>(["", ""]);
  const [distanceKm, setDistanceKm] = useState("");
  const [etaAt, setEtaAt] = useState("");
  const [notes, setNotes] = useState("");

  // Auto-rellenar primera parada con el destination del shipment y última con
  // delivery_address si existe (sino vacía para que el operario complete).
  const selectedShipment = useMemo(
    () => eligibleShipments.find((s) => s.id === shipmentId),
    [eligibleShipments, shipmentId],
  );

  useEffect(() => {
    if (selectedShipment) {
      setStops((prev) => {
        const next = [...prev];
        if (!next[0]?.trim() && selectedShipment.destination) {
          next[0] = selectedShipment.destination;
        }
        if (
          (!next[next.length - 1] || !next[next.length - 1].trim()) &&
          selectedShipment.delivery_address
        ) {
          next[next.length - 1] = selectedShipment.delivery_address;
        }
        return next;
      });
    }
  }, [selectedShipment]);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  const addStop = () => setStops((prev) => [...prev, ""]);
  const removeStop = (i: number) =>
    setStops((prev) =>
      prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i),
    );
  const setStop = (i: number, v: string) =>
    setStops((prev) => prev.map((s, idx) => (idx === i ? v : s)));

  const stopsJson = JSON.stringify(stops.map((s) => s.trim()).filter(Boolean));

  const canSubmit = useMemo(() => {
    if (!shipmentId) return false;
    const filledStops = stops.filter((s) => s.trim()).length;
    if (filledStops < 2) return false;
    return true;
  }, [shipmentId, stops]);

  return (
    <DrawerShell
      title="Nueva ruta de entrega"
      subtitle="Asignar embarque liberado + camión + chofer + paradas"
      onClose={onClose}
      pending={isPending}
      width={700}
    >
      <form
        id="tms-route-form"
        action={formAction}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-4)",
        }}
      >
        <input type="hidden" name="shipment_id" value={shipmentId} />
        <input type="hidden" name="truck_id" value={truckId} />
        <input type="hidden" name="driver_id" value={driverId} />
        <input type="hidden" name="stops_json" value={stopsJson} />

        {/* Shipment select */}
        <div>
          <label htmlFor="tms-route-shipment" className="studio-label">
            Embarque a entregar <span style={{ color: "var(--wine-text)" }}>*</span>
          </label>
          {eligibleShipments.length === 0 ? (
            <div
              style={{
                padding: "10px 12px",
                background: "var(--warning-bg)",
                border: "1px solid var(--warning)",
                borderRadius: "var(--r-sm)",
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--ink)",
              }}
            >
              No hay embarques liberados de aduana esperando reparto. Crear
              ruta requiere shipment con status{" "}
              <strong>arrived_destination</strong>.
            </div>
          ) : (
            <select
              id="tms-route-shipment"
              className="studio-input"
              value={shipmentId}
              onChange={(e) => setShipmentId(e.target.value)}
              required
            >
              <option value="">Selecciona shipment liberado…</option>
              {eligibleShipments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.client_name ?? "—"}
                  {s.destination ? ` · ${s.destination}` : ""}
                </option>
              ))}
            </select>
          )}
          {state.fieldErrors?.shipment_id && (
            <FieldError msg={state.fieldErrors.shipment_id} />
          )}
          {selectedShipment &&
            (selectedShipment.destination || selectedShipment.delivery_address) && (
              <p
                style={{
                  font: "500 11px/1.3 var(--f-sans)",
                  color: "var(--success)",
                  margin: "6px 0 0",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {Icon.check(11)} Origen y destino pre-completados desde el
                embarque · puedes ajustar abajo
              </p>
            )}
        </div>

        {/* Truck + Driver */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)" }}>
          <FieldSelect
            label="Camión disponible"
            name="truck_id"
            value={truckId}
            onChange={setTruckId}
            options={[
              { value: "", label: "Sin asignar" },
              ...availableTrucks.map((t) => ({
                value: t.id,
                label: `${t.plate} · ${t.brand ?? "—"} (${t.capacity_cbm ?? "—"} CBM)`,
              })),
            ]}
          />
          <FieldSelect
            label="Chofer disponible"
            name="driver_id"
            value={driverId}
            onChange={setDriverId}
            options={[
              { value: "", label: "Sin asignar" },
              ...availableDrivers.map((d) => ({
                value: d.id,
                label: `${d.name}${d.rating != null ? ` · ★ ${d.rating.toFixed(1)}` : ""}`,
              })),
            ]}
          />
        </div>

        {/* Stops builder */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "var(--s-2)",
            }}
          >
            <span
              style={{
                font: "700 11px/1 var(--f-sans)",
                color: "var(--ink-soft)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Paradas de la ruta *
            </span>
            <span
              style={{
                font: "700 11px/1 var(--f-mono)",
                color: "var(--wine-text)",
                padding: "2px 8px",
                background: "var(--wine-tint)",
                borderRadius: "var(--r-sm)",
              }}
            >
              {stops.length} {stops.length === 1 ? "parada" : "paradas"}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {stops.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px 1fr 36px",
                  gap: "var(--s-2)",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background:
                      i === 0
                        ? "var(--ink)"
                        : i === stops.length - 1
                          ? "var(--wine)"
                          : "var(--bg-elevated)",
                    color:
                      i === 0 || i === stops.length - 1
                        ? "var(--ink-inv)"
                        : "var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    font: "800 12px/1 var(--f-mono)",
                    border:
                      i !== 0 && i !== stops.length - 1
                        ? "1px solid var(--border)"
                        : "none",
                  }}
                >
                  {i + 1}
                </div>
                <input
                  type="text"
                  className="studio-input"
                  value={s}
                  onChange={(e) => setStop(i, e.target.value)}
                  placeholder={
                    i === 0
                      ? "Puerto de origen (ej: Puerto Cabello · Terminal Bolipuertos)"
                      : i === stops.length - 1
                        ? "Destino final del cliente"
                        : "Parada intermedia"
                  }
                />
                {stops.length > 2 ? (
                  <button
                    type="button"
                    onClick={() => removeStop(i)}
                    aria-label={`Quitar parada ${i + 1}`}
                    style={{
                      width: 32,
                      height: 32,
                      color: "var(--ink-soft)",
                      borderRadius: "var(--r-sm)",
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {Icon.trash(13)}
                  </button>
                ) : (
                  <div />
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addStop}
            style={{
              marginTop: "var(--s-2)",
              padding: "var(--s-2) var(--s-3)",
              borderRadius: "var(--r-md)",
              border: "1px dashed var(--border-strong)",
              background: "transparent",
              font: "600 12px/1 var(--f-sans)",
              color: "var(--wine-text)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
            }}
          >
            {Icon.plus(11)} Agregar parada intermedia
          </button>
          {state.fieldErrors?.stops && (
            <FieldError msg={state.fieldErrors.stops} />
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)" }}>
          <FieldText
            label="Distancia estimada (km)"
            name="distance_km"
            value={distanceKm}
            onChange={setDistanceKm}
            type="number"
            numericType="count"
            placeholder="168"
            mono
          />
          <FieldText
            label="ETA salida"
            name="eta_at"
            value={etaAt}
            onChange={setEtaAt}
            type="datetime-local"
          />
        </div>

        <FieldText
          label="Notas para el chofer"
          name="notes"
          value={notes}
          onChange={setNotes}
          placeholder="Horarios de carga, contacto en destino, observaciones…"
        />

        <div
          style={{
            padding: "12px 14px",
            background: "var(--info-bg)",
            borderRadius: "var(--r-md)",
            display: "flex",
            gap: 10,
          }}
        >
          <span style={{ color: "var(--info)", flexShrink: 0 }}>
            {Icon.box(13)}
          </span>
          <div
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--ink)",
            }}
          >
            Al crear la ruta el shipment pasa a <b>En reparto</b> y el camión +
            chofer quedan <b>en_ruta</b>. La notificación automática al chofer
            por WhatsApp llega con SDD-0019.2.
          </div>
        </div>

        {state.error && <FormError msg={state.error} />}
        <div style={{ flex: 1, minHeight: 12 }} />
      </form>
      <DrawerFooter
        formId="tms-route-form"
        onClose={onClose}
        isPending={isPending}
        canSubmit={canSubmit}
        submitLabel="Crear ruta"
      />
    </DrawerShell>
  );
}
