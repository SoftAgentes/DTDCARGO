"use client";

/**
 * Form de creacion de envio — todos los fixes del review post-MVP:
 *
 * 1. Header limpio (eyebrow propio bloque, no se choca con "Volver al listado").
 * 2. Default de servicio = "Puerta a Puerta DDP" (el mas frecuente en DTD).
 * 3. Campo GPS destino condicional: aparece cuando service=transporte_terrestre.
 * 4. Datalist HTML5 con clientes ya usados para autocomplete sin BD propia.
 * 5. Indicador "Cliente nuevo" / "Cliente existente" en tiempo real.
 *
 * Cuando llegue el modulo Clientes (SDD futuro), el datalist se reemplaza por
 * un combo con search server-side. La UX queda igual para el operador.
 */

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { createShipment, type CreateShipmentState } from "../actions";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import {
  SERVICE_OPTIONS,
  VEHICLE_CATEGORY_OPTIONS,
  type ShipmentService,
} from "@/lib/studio/shipment-types";

const initialState: CreateShipmentState = {};

const fieldErrorStyle: React.CSSProperties = {
  font: "500 11px/1.3 var(--f-sans)",
  color: "var(--danger)",
  marginTop: 4,
};

const hintStyle: React.CSSProperties = {
  font: "500 10.5px/1.3 var(--f-sans)",
  color: "var(--ink-soft)",
  marginTop: 4,
};

export function CreateShipmentForm({
  existingClients,
}: {
  existingClients: string[];
}) {
  const [state, formAction, isPending] = useActionState(
    createShipment,
    initialState,
  );
  // Default = puerta a puerta DDP (el servicio mas frecuente en DTD).
  const [service, setService] = useState<ShipmentService>("puerta_a_puerta_DDP");
  const [vehicleCategory, setVehicleCategory] = useState("");
  const [clientName, setClientName] = useState("");

  const vehicleRequired = service === "transporte_terrestre";
  const showGps = service === "transporte_terrestre";

  // Lower-case set de clientes existentes para comparacion case-insensitive
  const clientsLowerSet = useMemo(
    () => new Set(existingClients.map((c) => c.toLowerCase())),
    [existingClients],
  );

  const trimmedClient = clientName.trim();
  const clientIsKnown =
    trimmedClient.length > 0 && clientsLowerSet.has(trimmedClient.toLowerCase());
  const clientIsNew = trimmedClient.length > 0 && !clientIsKnown;

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Header limpio: Link arriba, eyebrow + h1 en su propio bloque sin solape */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/studio/tracking"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            font: "500 12px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            textDecoration: "none",
            transition: "color 0.12s",
          }}
        >
          <span style={{ fontSize: 14 }}>←</span> Volver al listado
        </Link>
      </div>

      <div style={{ marginBottom: 32 }}>
        <span
          className="studio-eyebrow"
          style={{
            fontSize: 12,
            letterSpacing: "0.16em",
          }}
        >
          Nuevo envío
        </span>
        <h1
          className="studio-display"
          style={{
            fontSize: 30,
            margin: "10px 0 0",
            color: "var(--ink)",
          }}
        >
          Crear envío.
        </h1>
      </div>

      <form
        action={formAction}
        style={{
          display: "grid",
          gap: 18,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 28,
        }}
      >
        {/* Codigo + servicio */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 14 }}>
          <div>
            <label htmlFor="code" className="studio-label">
              Código del envío <span style={{ color: "var(--wine)" }}>*</span>
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
              Servicio <span style={{ color: "var(--wine)" }}>*</span>
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

        {/* Cliente (con datalist) + MARKBOX */}
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
              list="clientes-existentes"
              autoComplete="off"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              disabled={isPending}
              className="studio-input"
            />
            <datalist id="clientes-existentes">
              {existingClients.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {clientIsKnown && (
              <div
                style={{
                  ...hintStyle,
                  color: "var(--success)",
                  fontWeight: 600,
                }}
              >
                ✓ Cliente existente
              </div>
            )}
            {clientIsNew && (
              <div
                style={{
                  ...hintStyle,
                  color: "var(--warning)",
                  fontWeight: 600,
                }}
              >
                + Cliente nuevo — se va a crear con este envío
              </div>
            )}
            {!trimmedClient && existingClients.length > 0 && (
              <div style={hintStyle}>
                {existingClients.length} cliente{existingClients.length === 1 ? "" : "s"} ya usado{existingClients.length === 1 ? "" : "s"}.
                Tipeá para autocompletar.
              </div>
            )}
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

        {/* GPS destino — SOLO para transporte terrestre */}
        {showGps && (
          <div
            style={{
              padding: 16,
              background: "var(--success-bg)",
              border: "1px dashed var(--success)",
              borderRadius: 8,
            }}
          >
            <label htmlFor="destination_gps" className="studio-label">
              📍 GPS del destino{" "}
              <span style={{ color: "var(--ink-mute)", fontWeight: 500 }}>
                (recomendado para terrestre)
              </span>
            </label>
            <input
              id="destination_gps"
              name="destination_gps"
              type="text"
              placeholder="10.4806, -66.9036  o  https://maps.app.goo.gl/…"
              disabled={isPending}
              className="studio-input"
              autoComplete="off"
            />
            <div style={hintStyle}>
              Coordenadas (lat,long) o link de Google Maps. El cliente suele
              compartirlo por WhatsApp. Más adelante esto va a habilitar
              tracking en vivo de la última milla.
            </div>
          </div>
        )}

        {/* Peso + volumen */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label htmlFor="weight_kg" className="studio-label">
              Peso
            </label>
            <NumericInput
              id="weight_kg"
              name="weight_kg"
              type="weight"
              min={0}
              placeholder="120.50"
              disabled={isPending}
            />
          </div>
          <div>
            <label htmlFor="volume_m3" className="studio-label">
              Volumen
            </label>
            <NumericInput
              id="volume_m3"
              name="volume_m3"
              type="volume"
              min={0}
              placeholder="0.450"
              disabled={isPending}
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
                  background: "var(--wine-tint)",
                  border: "1px dashed var(--wine)",
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
                <span style={{ color: "var(--wine)" }}>*</span>
              ) : (
                <span style={{ color: "var(--ink-mute)", fontWeight: 500 }}>(opcional)</span>
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
            style={{ resize: "vertical", fontFamily: "var(--f-sans)" }}
          />
        </div>

        {/* Error general */}
        {state.error && (
          <div
            role="alert"
            style={{
              padding: "11px 14px",
              background: "var(--danger-bg)",
              border: "1px solid var(--danger)",
              borderRadius: 6,
              color: "var(--danger)",
              font: "500 12.5px/1.4 var(--f-sans)",
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
