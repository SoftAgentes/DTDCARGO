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
 *
 * SDD-0531 · con `nombresOcultos` (región China, no admin) el envío llega sin
 * nombre del cliente ni ubicación de entrega: no se pintan esos campos y el
 * formulario guarda por `updateShipmentSinUbicacion`, que conserva la ubicación
 * en el servidor en vez de pisarla con el campo vacío.
 */

import { useActionState, useState } from "react";
import { updateShipment, type ActionState } from "../actions";
import { updateShipmentSinUbicacion } from "../datos-reservados-actions";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import {
  VEHICLE_CATEGORY_OPTIONS,
  type Shipment,
  type ShipmentStatus,
} from "@/lib/studio/shipment-types";
import { ChangeDestinationModal } from "./ChangeDestinationModal";
import type { NormalShipmentRead } from "@/lib/studio/client-consolidation/types";
import { formatObservedCents } from "@/lib/studio/client-consolidation/normal-flow";

const initialState: ActionState = {};

const TERMINAL_STATUSES: ShipmentStatus[] = ["delivered", "cancelled"];

export function ShipmentDataPanel({
  shipment, nombresOcultos = false, normal,
}: { shipment: Shipment; nombresOcultos?: boolean; normal?: NormalShipmentRead }) {
  if (!normal?.available) return <section aria-label="Datos del envío"><h3>Datos del envío</h3>
    <p role="alert">{normal?.error ?? "No se pudo comprobar la pertenencia del envío. Actualiza antes de editar."}</p></section>;
  if (!normal.context.complete || normal.context.shipmentId !== shipment.id || !normal.context.cohort && (normal.context.group || normal.context.manifest)
    || normal.context.cohort && normal.context.group?.shipmentId !== shipment.id) {
    return <p role="alert">La pertenencia no corresponde al envío completo solicitado.</p>;
  }
  if (!normal.context.cohort) return <LegacyShipmentDataPanel shipment={shipment} nombresOcultos={nombresOcultos} />;
  const { group, manifest } = normal.context;
  if (!group || !manifest) return <p role="alert">Falta la identidad completa del envío por cliente.</p>;
  return <section aria-label="Datos derivados del envío por cliente">
    <h3>Envío por cliente · {group.code}</h3><p>{group.clientMarkbox}{!nombresOcultos && group.clientName ? ` · ${group.clientName}` : ""}</p>
    <p>{group.service === "consolidado_lcl" ? "Consolidado LCL" : "Puerta a puerta DDP"} · {group.destination}</p>
    <p>{group.measures.boxes} cajas · {group.measures.cbm} CBM · {group.measures.weightKg} kg.</p>
    <p>{group.receiptIds.length} recepción(es) · revisión del grupo {group.revision} · revisión del contenedor {manifest.revision} · {manifest.sealed ? "Manifiesto sellado" : "Manifiesto abierto"}.</p>
    <p>Subtotal conocido: {formatObservedCents(group.rates.knownSubtotalCents)}. {group.rates.totalCents === null
      ? `Total pendiente: ${group.rates.missingReceiptIds.length} recepción(es) sin tarifa.` : `Total observado: ${formatObservedCents(group.rates.totalCents)}.`} Sin facturación automática.</p>
    <p>Cliente, servicio, destino, cajas y medidas vienen de la pertenencia confirmada. Esta vía no permite corregir miembros previos ni reasignarlos.</p>
    <a href="/studio/naviera">Consultar el contenedor en Naviera</a>
    {shipment.notes && <p>Nota operativa guardada: {shipment.notes}</p>}
    <p>Las nuevas notas se registran con el estado actual y la hora del servidor desde el panel de acciones.</p>
  </section>;
}

function LegacyShipmentDataPanel({
  shipment,
  nombresOcultos = false,
}: {
  shipment: Shipment;
  nombresOcultos?: boolean;
}) {
  const action = (
    nombresOcultos ? updateShipmentSinUbicacion : updateShipment
  ).bind(null, shipment.id);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [showChangeDest, setShowChangeDest] = useState(false);
  const canChangeDest = !TERMINAL_STATUSES.includes(shipment.status);

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
  const showGps = !nombresOcultos && (isTerrestre || shipment.destination_gps);
  const showGpsReservado = nombresOcultos && isTerrestre;

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
    <>
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
        {!nombresOcultos && (
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
        )}
        <div>
          <label className="studio-label" htmlFor="client_markbox">
            <span style={{ marginRight: 6 }}>🔒</span> Shipping Mark
          </label>
          <input
            id="client_markbox"
            name="client_markbox"
            className="studio-input studio-input-mono"
            defaultValue={shipment.client_markbox ?? ""}
            placeholder="—"
            readOnly
            disabled
            title="El Shipping Mark viene de la base de clientes (futuro: sync con Excel)"
          />
        </div>
      </div>
      <p
        style={{
          font: "500 11px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 14px",
          letterSpacing: "0.02em",
        }}
      >
        {nombresOcultos
          ? "El Shipping Mark viene de la base de clientes — no se edita acá. Por privacidad, el nombre del cliente no se muestra en tu región."
          : "Cliente y Shipping Mark vienen de la base de clientes — no se editan acá."}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: showGps || showGpsReservado ? 8 : 14,
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
          <label
            className="studio-label"
            htmlFor="destination"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Destino</span>
            {canChangeDest && (
              <button
                type="button"
                onClick={() => setShowChangeDest(true)}
                style={{
                  font: "600 10px/1 var(--f-sans)",
                  color: "var(--wine-text)",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                  textTransform: "none",
                  padding: 0,
                }}
                title="Cambia el destino del envío y registra el cobro en el timeline"
              >
                Cambiar destino →
              </button>
            )}
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

      {/* SDD-0531: la ubicación existe pero no se muestra; al guardar se conserva. */}
      {showGpsReservado && (
        <p
          style={{
            padding: "12px 14px",
            background: "var(--bg-elevated)",
            border: "1px dashed var(--border)",
            borderRadius: 8,
            margin: "0 0 14px",
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          La ubicación de entrega no se muestra en tu región. Se conserva tal
          cual al guardar.
        </p>
      )}

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
            <span>📍 GPS destino {isTerrestre && <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>(recomendado)</span>}</span>
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
            Peso
          </label>
          <NumericInput
            id="weight_kg"
            name="weight_kg"
            type="weight"
            min={0}
            defaultValue={shipment.weight_kg ?? null}
          />
        </div>
        <div>
          <label className="studio-label" htmlFor="volume_m3">
            Volumen
          </label>
          <NumericInput
            id="volume_m3"
            name="volume_m3"
            type="volume"
            min={0}
            defaultValue={shipment.volume_m3 ?? null}
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
    {showChangeDest && (
      <ChangeDestinationModal
        shipment={shipment}
        onClose={() => setShowChangeDest(false)}
      />
    )}
    </>
  );
}
