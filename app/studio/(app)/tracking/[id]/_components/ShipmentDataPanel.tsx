"use client";

/**
 * Panel de datos editables del envio.
 *
 * Form con todos los campos editables del envio. Boton "Guardar cambios"
 * se habilita solo si hay cambios pendientes (dirty state).
 *
 * Campos NO editables: code, shipment_service, status, deleted_at.
 *  - code: trazabilidad externa (BL, AWB).
 *  - shipment_service: cambia la matriz de estados aplicables.
 *  - status: se modifica via StateActionsPanel.
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

  // Dirty state — comparamos cada input con su valor inicial.
  const [dirty, setDirty] = useState(false);
  const checkDirty = (e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const fd = new FormData(form);
    const changed =
      (fd.get("client_name") ?? "") !== (shipment.client_name ?? "") ||
      (fd.get("client_markbox") ?? "") !== (shipment.client_markbox ?? "") ||
      (fd.get("origin") ?? "") !== (shipment.origin ?? "") ||
      (fd.get("destination") ?? "") !== (shipment.destination ?? "") ||
      String(fd.get("weight_kg") ?? "") !== String(shipment.weight_kg ?? "") ||
      String(fd.get("volume_m3") ?? "") !== String(shipment.volume_m3 ?? "") ||
      (fd.get("vehicle_category") ?? "") !== (shipment.vehicle_category ?? "") ||
      (fd.get("vehicle_model") ?? "") !== (shipment.vehicle_model ?? "") ||
      (fd.get("notes") ?? "") !== (shipment.notes ?? "");
    setDirty(changed);
  };

  const showVehicle = shipment.shipment_service === "transporte_terrestre" || shipment.vehicle_category;

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
          marginBottom: 14,
        }}
      >
        <div>
          <label className="studio-label" htmlFor="client_name">
            Cliente
          </label>
          <input
            id="client_name"
            name="client_name"
            className="studio-input"
            defaultValue={shipment.client_name ?? ""}
            placeholder="Nombre del cliente"
          />
        </div>
        <div>
          <label className="studio-label" htmlFor="client_markbox">
            MARKBOX
          </label>
          <input
            id="client_markbox"
            name="client_markbox"
            className="studio-input studio-input-mono"
            defaultValue={shipment.client_markbox ?? ""}
            placeholder="DTD-XXXX"
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 14,
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
                <span style={{ color: "#C2353F", marginLeft: 6 }}>*</span>
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
                  color: "#C2353F",
                  font: "500 11px/1.3 Archivo, sans-serif",
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
            color: "#C2353F",
            font: "500 12px/1.4 Archivo, sans-serif",
            marginBottom: 10,
          }}
        >
          {state.error}
        </p>
      )}
      {state.ok && !dirty && (
        <p
          style={{
            color: "#1F8A5B",
            font: "500 12px/1.4 Archivo, sans-serif",
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
