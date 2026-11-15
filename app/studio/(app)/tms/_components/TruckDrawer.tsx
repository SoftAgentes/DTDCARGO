"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createTruckAction } from "../actions";
import {
  FUEL_TYPE_OPTIONS,
  TMS_HUBS,
  VEHICLE_TYPE_OPTIONS,
  type TmsActionState,
} from "@/lib/studio/tms-types";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";

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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)" }}>
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
            options={[{ value: "", label: "Selecciona tipo…" }, ...VEHICLE_TYPE_OPTIONS.map((v) => ({ value: v, label: v }))]}
          />
        </div>
        <FieldText
          label="Marca y modelo"
          name="brand"
          value={brand}
          onChange={setBrand}
          placeholder="Volvo FH · Mercedes Atego · Iveco Daily"
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)" }}>
          <FieldSelect
            label="Hub base"
            name="hub_code"
            value={hubCode}
            onChange={setHubCode}
            options={[{ value: "", label: "Selecciona hub…" }, ...TMS_HUBS.map((h) => ({ value: h.code, label: `${h.code} · ${h.name}` }))]}
          />
          <FieldSelect
            label="Propiedad"
            name="owned"
            value={owned}
            onChange={setOwned}
            options={[
              { value: "true", label: "Propio · DTD Cargo" },
              { value: "false", label: "Contratado · proveedor externo" },
            ]}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--s-3)" }}>
          <FieldText
            label="Capacidad kg"
            name="capacity_kg"
            value={capacityKg}
            onChange={setCapacityKg}
            type="number"
            numericType="weight"
            placeholder="30000"
            mono
          />
          <FieldText
            label="Capacidad m³"
            name="capacity_cbm"
            value={capacityCbm}
            onChange={setCapacityCbm}
            type="number"
            numericType="volume"
            placeholder="76"
            mono
          />
          <FieldText
            label="Km actuales"
            name="km"
            value={km}
            onChange={setKm}
            type="number"
            numericType="count"
            placeholder="0"
            mono
            error={state.fieldErrors?.km}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)" }}>
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
            numericType="decimal"
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
// Shared TMS field helpers (prefijo tms- en IDs)
// ─────────────────────────────────────────────────────────────

export function FieldText({
  label,
  name,
  value,
  onChange,
  type = "text",
  numericType,
  placeholder,
  mono,
  error,
  rows,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  /**
   * type HTML del input. Si es `"number"`, internamente se renderiza
   * `<NumericInput>` (con adornment + preview formateado + soporte de
   * expresiones aritméticas).
   */
  type?: string;
  /**
   * Cuando type="number", define el tipo semántico del NumericInput:
   * "currency" / "weight" / "volume" / "count" / "decimal".
   * Default: "decimal".
   */
  numericType?: "currency" | "weight" | "volume" | "count" | "decimal";
  placeholder?: string;
  mono?: boolean;
  error?: string;
  rows?: number;
}) {
  const cls = mono ? "studio-input studio-input-mono" : "studio-input";
  const isNumeric = type === "number";
  const errorProps = fieldErrorProps(name, error);
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
          {...errorProps}
        />
      ) : isNumeric ? (
        <NumericInput
          id={`tms-${name}`}
          name={name}
          type={numericType ?? "decimal"}
          placeholder={placeholder}
          value={value === "" ? null : Number(value)}
          onChange={(v) => onChange(v != null ? String(v) : "")}
          {...errorProps}
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
          {...errorProps}
        />
      )}
      {error && <FieldError id={`tms-${name}-error`} msg={error} />}
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
        {...fieldErrorProps(name, error)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <FieldError id={`tms-${name}-error`} msg={error} />}
    </div>
  );
}

/** `aria-invalid` es lo que `useDialogA11y` usa para llevarle el foco al primer campo con error. */
function fieldErrorProps(name: string, error?: string) {
  return error ? { "aria-invalid": true, "aria-describedby": `tms-${name}-error` } : {};
}

export function FieldError({ msg, id }: { msg: string; id?: string }) {
  return (
    <p
      id={id}
      style={{
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--danger)",
        margin: "var(--s-1) 0 0",
      }}
    >
      {msg}
    </p>
  );
}

export function FormError({ msg }: { msg: string }) {
  return (
    <Aviso tono="error" compacto>
      {msg}
    </Aviso>
  );
}
