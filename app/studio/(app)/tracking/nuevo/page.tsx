/**
 * Form de creacion de envio.
 *
 * Server action en ./actions.ts crea + redirige a /studio/tracking.
 *
 * Convencion de marca: el dropdown muestra "Puerta a Puerta DDP (prepago)" como
 * un solo string (label compuesto). La separacion del "prepago" en chico se ve
 * en la tabla via ServiceBadge.
 */

"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createShipment, type CreateShipmentState } from "./actions";
import {
  SERVICE_OPTIONS,
  VEHICLE_CATEGORY_OPTIONS,
  type ShipmentService,
} from "@/lib/studio/shipment-types";

const initialState: CreateShipmentState = {};

const fieldErrorStyle: React.CSSProperties = {
  font: "500 11px/1.3 Archivo, sans-serif",
  color: "#C2353F",
  marginTop: 4,
};

const hintStyle: React.CSSProperties = {
  font: "500 10.5px/1.3 Archivo, sans-serif",
  color: "#6B6B6B",
  marginTop: 4,
};

export default function NuevoEnvioPage() {
  const [state, formAction, isPending] = useActionState(createShipment, initialState);
  const [service, setService] = useState<ShipmentService>("consolidacion");
  const [vehicleCategory, setVehicleCategory] = useState("");

  const vehicleRequired = service === "transporte_terrestre";

  return (
    <div style={{ maxWidth: 760 }}>
      <Link
        href="/studio/tracking"
        style={{
          display: "inline-block",
          font: "600 12px/1 Archivo, sans-serif",
          color: "#6B6B6B",
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        ← Volver al listado
      </Link>

      <span className="studio-eyebrow">Nuevo envío</span>
      <h1
        className="studio-display"
        style={{ fontSize: 30, margin: "8px 0 32px", color: "#0F1E3D" }}
      >
        Crear envío.
      </h1>

      <form
        action={formAction}
        style={{
          display: "grid",
          gap: 18,
          background: "#FFFFFF",
          border: "1px solid #E8E6E2",
          borderRadius: 12,
          padding: 28,
        }}
      >
        {/* Codigo + servicio */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 14 }}>
          <div>
            <label htmlFor="code" className="studio-label">
              Código del envío <span style={{ color: "#7F0F1A" }}>*</span>
            </label>
            <input
              id="code"
              name="code"
              type="text"
              placeholder="DTDU-0001"
              required
              disabled={isPending}
              className="studio-input studio-input-mono"
            />
            {state.fieldErrors?.code && (
              <div style={fieldErrorStyle}>{state.fieldErrors.code}</div>
            )}
          </div>

          <div>
            <label htmlFor="shipment_service" className="studio-label">
              Servicio <span style={{ color: "#7F0F1A" }}>*</span>
            </label>
            <select
              id="shipment_service"
              name="shipment_service"
              value={service}
              onChange={(e) => setService(e.target.value as ShipmentService)}
              disabled={isPending}
              className="studio-input"
            >
              {SERVICE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {state.fieldErrors?.shipment_service && (
              <div style={fieldErrorStyle}>{state.fieldErrors.shipment_service}</div>
            )}
          </div>
        </div>

        {/* Cliente */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
          <div>
            <label htmlFor="client_name" className="studio-label">
              Cliente
            </label>
            <input
              id="client_name"
              name="client_name"
              type="text"
              placeholder="Empresa Demo S.A."
              disabled={isPending}
              className="studio-input"
            />
          </div>
          <div>
            <label htmlFor="client_markbox" className="studio-label">
              MARKBOX
            </label>
            <input
              id="client_markbox"
              name="client_markbox"
              type="text"
              placeholder="DTD-XXXX"
              disabled={isPending}
              className="studio-input studio-input-mono"
            />
          </div>
        </div>

        {/* Origen + destino */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label htmlFor="origin" className="studio-label">
              Origen
            </label>
            <input
              id="origin"
              name="origin"
              type="text"
              placeholder="Yiwu, China"
              disabled={isPending}
              className="studio-input"
            />
          </div>
          <div>
            <label htmlFor="destination" className="studio-label">
              Destino
            </label>
            <input
              id="destination"
              name="destination"
              type="text"
              placeholder="Puerto Cabello, VE"
              disabled={isPending}
              className="studio-input"
            />
          </div>
        </div>

        {/* Peso + volumen */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label htmlFor="weight_kg" className="studio-label">
              Peso (kg)
            </label>
            <input
              id="weight_kg"
              name="weight_kg"
              type="number"
              step="0.01"
              min="0"
              placeholder="120.50"
              disabled={isPending}
              className="studio-input"
            />
          </div>
          <div>
            <label htmlFor="volume_m3" className="studio-label">
              Volumen (m³)
            </label>
            <input
              id="volume_m3"
              name="volume_m3"
              type="number"
              step="0.001"
              min="0"
              placeholder="0.450"
              disabled={isPending}
              className="studio-input"
            />
          </div>
        </div>

        {/* Vehiculo — destacado SOLO cuando es required (terrestre) */}
        <div
          style={
            vehicleRequired
              ? {
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                  padding: 16,
                  background: "rgba(127, 15, 26, 0.035)",
                  border: "1px dashed #7F0F1A",
                  borderRadius: 8,
                }
              : {
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                }
          }
        >
          <div>
            <label htmlFor="vehicle_category" className="studio-label">
              Vehículo{" "}
              {vehicleRequired ? (
                <span style={{ color: "#7F0F1A" }}>*</span>
              ) : (
                <span style={{ color: "#9B9B9B", fontWeight: 500 }}>(opcional)</span>
              )}
            </label>
            <select
              id="vehicle_category"
              name="vehicle_category"
              value={vehicleCategory}
              onChange={(e) => setVehicleCategory(e.target.value)}
              disabled={isPending}
              required={vehicleRequired}
              className="studio-input"
            >
              <option value="">— Sin especificar —</option>
              {VEHICLE_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {state.fieldErrors?.vehicle_category && (
              <div style={fieldErrorStyle}>{state.fieldErrors.vehicle_category}</div>
            )}
            {vehicleRequired &&
              !vehicleCategory &&
              !state.fieldErrors?.vehicle_category && (
                <div style={hintStyle}>
                  Obligatorio para transporte terrestre.
                </div>
              )}
          </div>

          <div>
            <label htmlFor="vehicle_model" className="studio-label">
              Modelo específico
            </label>
            <input
              id="vehicle_model"
              name="vehicle_model"
              type="text"
              placeholder="Ford 350, Gandola 40t, 40HC Reefer"
              disabled={isPending}
              className="studio-input"
            />
          </div>
        </div>

        {/* Notas */}
        <div>
          <label htmlFor="notes" className="studio-label">
            Notas internas
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            disabled={isPending}
            placeholder="Cualquier detalle operativo que el operador necesite recordar."
            className="studio-input"
            style={{ resize: "vertical", fontFamily: "Archivo, sans-serif" }}
          />
        </div>

        {/* Error general */}
        {state.error && (
          <div
            role="alert"
            style={{
              padding: "11px 14px",
              background: "rgba(194, 53, 63, 0.08)",
              border: "1px solid rgba(194, 53, 63, 0.25)",
              borderRadius: 6,
              color: "#C2353F",
              font: "500 12.5px/1.4 Archivo, sans-serif",
            }}
          >
            {state.error}
          </div>
        )}

        {/* Submit */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
          <Link href="/studio/tracking" className="studio-btn studio-btn-ghost">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="studio-btn studio-btn-primary"
          >
            {isPending ? "CREANDO..." : "CREAR ENVÍO"}
          </button>
        </div>
      </form>
    </div>
  );
}
