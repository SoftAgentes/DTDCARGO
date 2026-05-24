"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { createTruckAction } from "../actions";
import {
  FUEL_TYPE_OPTIONS,
  TMS_HUBS,
  VEHICLE_TYPE_OPTIONS,
  type TmsActionState,
} from "@/lib/studio/tms-types";

const initialState: TmsActionState = {};

export function TruckDrawer({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(
    createTruckAction,
    initialState,
  );

  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [hubCode, setHubCode] = useState("");
  const [owned, setOwned] = useState("true");
  const [capacityKg, setCapacityKg] = useState("");
  const [capacityCbm, setCapacityCbm] = useState("");
  const [km, setKm] = useState("0");
  const [fuelType, setFuelType] = useState("Diesel");
  const [consumption, setConsumption] = useState("");
  const [nextService, setNextService] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  const canSubmit = useMemo(() => !!plate.trim(), [plate]);

  return (
    <DrawerShell title="Nuevo camión" subtitle="Agregar vehículo a la flota" onClose={onClose} pending={isPending}>
      <form
        id="tms-truck-form"
        action={formAction}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FieldText
            label="Patente *"
            name="plate"
            value={plate}
            onChange={setPlate}
            placeholder="AB123CD"
            mono
            error={state.fieldErrors?.plate}
          />
          <FieldSelect
            label="Tipo"
            name="vehicle_type"
            value={vehicleType}
            onChange={setVehicleType}
            options={[{ value: "", label: "Seleccioná tipo…" }, ...VEHICLE_TYPE_OPTIONS.map((v) => ({ value: v, label: v }))]}
          />
        </div>
        <FieldText
          label="Marca y modelo"
          name="brand"
          value={brand}
          onChange={setBrand}
          placeholder="Volvo FH · Mercedes Atego · Iveco Daily"
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FieldSelect
            label="Hub base"
            name="hub_code"
            value={hubCode}
            onChange={setHubCode}
            options={[{ value: "", label: "Seleccioná hub…" }, ...TMS_HUBS.map((h) => ({ value: h.code, label: `${h.code} · ${h.name}` }))]}
          />
          <FieldSelect
            label="Propiedad"
            name="owned"
            value={owned}
            onChange={setOwned}
            options={[
              { value: "true", label: "Propio · DTD-Cargo" },
              { value: "false", label: "Contratado · proveedor externo" },
            ]}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <FieldText
            label="Capacidad kg"
            name="capacity_kg"
            value={capacityKg}
            onChange={setCapacityKg}
            type="number"
            placeholder="30000"
            mono
          />
          <FieldText
            label="Capacidad m³"
            name="capacity_cbm"
            value={capacityCbm}
            onChange={setCapacityCbm}
            type="number"
            placeholder="76"
            mono
          />
          <FieldText
            label="Km actuales"
            name="km"
            value={km}
            onChange={setKm}
            type="number"
            placeholder="0"
            mono
            error={state.fieldErrors?.km}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FieldSelect
            label="Combustible"
            name="fuel_type"
            value={fuelType}
            onChange={setFuelType}
            options={FUEL_TYPE_OPTIONS.map((f) => ({ value: f, label: f }))}
          />
          <FieldText
            label="Rendimiento km/L"
            name="consumption_km_l"
            value={consumption}
            onChange={setConsumption}
            type="number"
            placeholder="8.0"
            mono
          />
        </div>
        <FieldText
          label="Próximo service"
          name="next_service_at"
          value={nextService}
          onChange={setNextService}
          type="date"
        />
        <FieldText
          label="Notas"
          name="notes"
          value={notes}
          onChange={setNotes}
          placeholder="Seguro, observaciones técnicas, restricciones…"
        />
        {state.error && <FormError msg={state.error} />}
        <div style={{ flex: 1, minHeight: 12 }} />
      </form>
      <DrawerFooter
        formId="tms-truck-form"
        onClose={onClose}
        isPending={isPending}
        canSubmit={canSubmit}
        submitLabel="Agregar camión"
      />
    </DrawerShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared drawer pieces
// ─────────────────────────────────────────────────────────────

export function DrawerShell({
  title,
  subtitle,
  onClose,
  pending,
  children,
  width = 620,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  pending: boolean;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <div
      onClick={() => !pending && onClose()}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: `min(${width}px, 96vw)`,
          height: "100vh",
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-pop)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              className="studio-display"
              style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
            >
              {title}
            </h2>
            {subtitle && (
              <p
                style={{
                  font: "500 11.5px/1.3 var(--f-sans)",
                  color: "var(--ink-soft)",
                  margin: "4px 0 0",
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Cerrar"
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-soft)",
              background: "transparent",
              border: 0,
              cursor: pending ? "wait" : "pointer",
            }}
          >
            {Icon.close(14)}
          </button>
        </header>
        {children}
      </aside>
    </div>
  );
}

export function DrawerFooter({
  formId,
  onClose,
  isPending,
  canSubmit,
  submitLabel,
}: {
  formId: string;
  onClose: () => void;
  isPending: boolean;
  canSubmit: boolean;
  submitLabel: string;
}) {
  return (
    <footer
      style={{
        padding: "14px 22px",
        borderTop: "1px solid var(--border)",
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
        background: "var(--bg-surface)",
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        className="studio-btn studio-btn-ghost"
        onClick={onClose}
        disabled={isPending}
      >
        Cancelar
      </button>
      <button
        type="submit"
        form={formId}
        className="studio-btn studio-btn-primary"
        disabled={isPending || !canSubmit}
      >
        {isPending ? "Creando…" : submitLabel}
      </button>
    </footer>
  );
}

export function FieldText({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  mono,
  error,
  rows,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  mono?: boolean;
  error?: string;
  rows?: number;
}) {
  const cls = mono ? "studio-input studio-input-mono" : "studio-input";
  return (
    <div>
      <label className="studio-label" htmlFor={`tms-${name}`}>
        {label}
      </label>
      {rows ? (
        <textarea
          id={`tms-${name}`}
          name={name}
          rows={rows}
          className={cls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ resize: "vertical" }}
        />
      ) : (
        <input
          id={`tms-${name}`}
          name={name}
          type={type}
          className={cls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
      {error && <FieldError msg={error} />}
    </div>
  );
}

export function FieldSelect({
  label,
  name,
  value,
  onChange,
  options,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
}) {
  return (
    <div>
      <label className="studio-label" htmlFor={`tms-${name}`}>
        {label}
      </label>
      <select
        id={`tms-${name}`}
        name={name}
        className="studio-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <FieldError msg={error} />}
    </div>
  );
}

export function FieldError({ msg }: { msg: string }) {
  return (
    <p
      style={{
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--danger)",
        margin: "4px 0 0",
      }}
    >
      {msg}
    </p>
  );
}

export function FormError({ msg }: { msg: string }) {
  return (
    <p
      role="alert"
      style={{
        font: "500 12px/1.4 var(--f-sans)",
        color: "var(--danger)",
        margin: 0,
        padding: "10px 12px",
        background: "var(--danger-bg)",
        border: "1px solid var(--danger)",
        borderRadius: "var(--r-sm)",
      }}
    >
      {msg}
    </p>
  );
}
