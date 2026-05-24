"use client";

/**
 * Panel de datos editables del envio.
 *
 * Form con campos editables del envio. Boton "Guardar cambios"
 * se habilita solo si hay cambios pendientes (dirty state).
 *
 * Campos NO editables (read-only):
 *  - code: trazabilidad externa (BL, AWB).
 *  - shipment_service: cambia la matriz de estados aplicables.
 *  - status: se modifica via StateActionsPanel.
 *  - client_name + client_markbox: vienen de la base de clientes externa
 *    (Excel/sistema CRM futuro). Bloqueados en edicion. Solo se setean al
 *    momento de crear el envio (form /nuevo). Cuando llegue el modulo de
 *    Clientes, estos se sincronizan, no se editan aca.
 *  - deleted_at: solo via boton "Eliminar envio".
 */

import { useActionState, useState } from "react";
import { updateShipment, type ActionState } from "../actions";
import {
  VEHICLE_CATEGORY_OPTIONS,
  type Shipment,
} from "@/lib/studio/shipment-types";

const initialState: ActionState = {};

export function ShipmentDataPanel({ shipment }: { shipment: Shipment }) {
  const action = updateShipment.bind(null, shipment.id);
  const [state, formAction, isPending] = useActionState(action, initialState);

  // Dirty state — solo cuenta los campos editables.
  // client_name y client_markbox NO se chequean: son readonly (vienen de BD externa).
  const [dirty, setDirty] = useState(false);
  const checkDirty = (e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const fd = new FormData(form);
    const changed =
      (fd.get("origin") ?? "") !== (shipment.origin ?? "") ||
      (fd.get("destination") ?? "") !== (shipment.destination ?? "") ||
      (fd.get("destination_gps") ?? "") !== (shipment.destination_gps ?? "") ||
      String(fd.get("weight_kg") ?? "") !== String(shipment.weight_kg ?? "") ||
      String(fd.get("volume_m3") ?? "") !== String(shipment.volume_m3 ?? "") ||
      (fd.get("vehicle_category") ?? "") !== (shipment.vehicle_category ?? "") ||
      (fd.get("vehicle_model") ?? "") !== (shipment.vehicle_model ?? "") ||
      (fd.get("notes") ?? "") !== (shipment.notes ?? "");
    setDirty(changed);
  };

  const isTerrestre = shipment.shipment_service === "transporte_terrestre";
  const showVehicle = isTerrestre || shipment.vehicle_category;
  const showGps = isTerrestre || shipment.destination_gps;

  // Si hay GPS, intentamos detectar si es link o lat,long para mostrar el boton
  // "Abrir en Google Maps" con el href apropiado.
  const gpsValue = shipment.destination_gps ?? "";
  const gpsIsUrl = /^https?:\/\//i.test(gpsValue);
  const gpsMapsUrl = gpsIsUrl
    ? gpsValue
    : gpsValue.trim()
      ? `https://maps.google.com/?q=${encodeURIComponent(gpsValue.trim())}`
      : null;

  return (
    <form action={formAction} onChange={checkDirty} noValidate>
      <div className="studio-eyebrow" style={{ marginBottom: 14 }}>
        Datos del envío
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 6,
        }}
      >
        <div>
          <label className="studio-label" htmlFor="client_name">
            <span style={{ marginRight: 6 }}>🔒</span> Cliente
          </label>
          <input
            id="client_name"
            name="client_name"
            className="studio-input"
            defaultValue={shipment.client_name ?? ""}
            placeholder="—"
            readOnly
            disabled
            title="El cliente se gestiona desde la base de clientes (futuro: sync con Excel)"
          />
        </div>
        <div>
          <label className="studio-label" htmlFor="client_markbox">
            <span style={{ marginRight: 6 }}>🔒</span> MARKBOX
          </label>
          <input
            id="client_markbox"
            name="client_markbox"
            className="studio-input studio-input-mono"
            defaultValue={shipment.client_markbox ?? ""}
            placeholder="—"
            readOnly
            disabled
            title="El MARKBOX viene de la base de clientes (futuro: sync con Excel)"
          />
        </div>
      </div>
      <p
        style={{
          font: "500 11px/1.4 var(--f-sans)",
          color: "var(--ink-mute)",
          margin: "0 0 14px",
          letterSpacing: "0.02em",
        }}
      >
        Cliente y MARKBOX vienen de la base de clientes — no se editan acá.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: showGps ? 8 : 14,
        }}
      >
        <div>
          <label className="studio-label" htmlFor="origin">
            Origen
          </label>
          <input
            id="origin"
            name="origin"
            className="studio-input"
            defaultValue={shipment.origin ?? ""}
            placeholder="Yiwu, Caracas, etc."
          />
        </div>
        <div>
          <label className="studio-label" htmlFor="destination">
            Destino
          </label>
          <input
            id="destination"
            name="destination"
            className="studio-input"
            defaultValue={shipment.destination ?? ""}
            placeholder="Valencia, Maracaibo, etc."
          />
        </div>
      </div>

      {/* GPS destino — solo terrestre o si ya tiene valor */}
      {showGps && (
        <div
          style={{
            padding: "12px 14px",
            background: "var(--success-bg)",
            border: "1px dashed var(--success)",
            borderRadius: 8,
            marginBottom: 14,
          }}
        >
          <label
            className="studio-label"
            htmlFor="destination_gps"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>📍 GPS destino {isTerrestre && <span style={{ color: "var(--ink-mute)", fontWeight: 500 }}>(recomendado)</span>}</span>
            {gpsMapsUrl && (
              <a
                href={gpsMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  font: "600 10.5px/1 var(--f-sans)",
                  color: "var(--success)",
                  textDecoration: "none",
                  letterSpacing: "0.04em",
                  textTransform: "none",
                }}
              >
                Abrir en Google Maps ↗
              </a>
            )}
          </label>
          <input
            id="destination_gps"
            name="destination_gps"
            className="studio-input"
            defaultValue={shipment.destination_gps ?? ""}
            placeholder="10.4806, -66.9036  o  https://maps.app.goo.gl/…"
            autoComplete="off"
          />
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <div>
          <label className="studio-label" htmlFor="weight_kg">
            Peso (kg)
          </label>
          <input
            id="weight_kg"
            name="weight_kg"
            type="number"
            min="0"
            step="0.01"
            className="studio-input"
            defaultValue={shipment.weight_kg ?? ""}
          />
        </div>
        <div>
          <label className="studio-label" htmlFor="volume_m3">
            Volumen (m³)
          </label>
          <input
            id="volume_m3"
            name="volume_m3"
            type="number"
            min="0"
            step="0.001"
            className="studio-input"
            defaultValue={shipment.volume_m3 ?? ""}
          />
        </div>
      </div>

      {showVehicle && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <div>
            <label className="studio-label" htmlFor="vehicle_category">
              Categoría vehículo
              {shipment.shipment_service === "transporte_terrestre" && (
                <span style={{ color: "var(--danger)", marginLeft: 6 }}>*</span>
              )}
            </label>
            <select
              id="vehicle_category"
              name="vehicle_category"
              className="studio-input"
              defaultValue={shipment.vehicle_category ?? ""}
            >
              <option value="">— Sin especificar —</option>
              {VEHICLE_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {state.fieldErrors?.vehicle_category && (
              <p
                style={{
                  color: "var(--danger)",
                  font: "500 11px/1.3 var(--f-sans)",
                  marginTop: 4,
                }}
              >
                {state.fieldErrors.vehicle_category}
              </p>
            )}
          </div>
          <div>
            <label className="studio-label" htmlFor="vehicle_model">
              Modelo vehículo
            </label>
            <input
              id="vehicle_model"
              name="vehicle_model"
              className="studio-input"
              defaultValue={shipment.vehicle_model ?? ""}
              placeholder="Ford 350, 40HC Reefer, etc."
            />
          </div>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <label className="studio-label" htmlFor="notes">
          Notas
        </label>
        <textarea
          id="notes"
          name="notes"
          className="studio-input"
          rows={3}
          defaultValue={shipment.notes ?? ""}
          placeholder="Detalles operativos, observaciones, etc."
          style={{ resize: "vertical" }}
        />
      </div>

      {state.error && (
        <p
          style={{
            color: "var(--danger)",
            font: "500 12px/1.4 var(--f-sans)",
            marginBottom: 10,
          }}
        >
          {state.error}
        </p>
      )}
      {state.ok && !dirty && (
        <p
          style={{
            color: "var(--success)",
            font: "500 12px/1.4 var(--f-sans)",
            marginBottom: 10,
          }}
        >
          Cambios guardados ✓
        </p>
      )}

      <button
        type="submit"
        className="studio-btn studio-btn-primary"
        disabled={!dirty || isPending}
        style={{ opacity: !dirty || isPending ? 0.6 : 1 }}
      >
        {isPending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
