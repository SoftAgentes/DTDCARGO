"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createDriverAction } from "../actions";
import {
  LICENSE_CLASS_OPTIONS,
  TMS_HUBS,
  type TmsActionState,
} from "@/lib/studio/tms-types";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  FieldText,
  FieldSelect,
  FormError,
} from "./TruckDrawer";

const initialState: TmsActionState = {};

export function DriverDrawer({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(
    createDriverAction,
    initialState,
  );

  const [name, setName] = useState("");
  const [cedula, setCedula] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [licenseClass, setLicenseClass] = useState("");
  const [licenseExpires, setLicenseExpires] = useState("");
  const [hubCode, setHubCode] = useState("");
  const [expYears, setExpYears] = useState("0");
  const [address, setAddress] = useState("");
  const [emergency, setEmergency] = useState("");
  const [safety, setSafety] = useState("true");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  const canSubmit = useMemo(() => !!name.trim(), [name]);

  return (
    <DrawerShell
      title="Nuevo chofer"
      subtitle="Alta de conductor para flota DTD"
      onClose={onClose}
      pending={isPending}
      width={600}
    >
      <form
        id="tms-driver-form"
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
        <input type="hidden" name="safety_certified" value={safety} />

        <FieldText
          label="Nombre completo *"
          name="name"
          value={name}
          onChange={setName}
          placeholder="Carlos Ramírez Mendoza"
          error={state.fieldErrors?.name}
        />
        <FieldText
          label="Cédula"
          name="cedula"
          value={cedula}
          onChange={setCedula}
          placeholder="V-12.345.678"
          mono
          error={state.fieldErrors?.cedula}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FieldText
            label="Teléfono"
            name="phone"
            value={phone}
            onChange={setPhone}
            placeholder="+58 412 000 0000"
            mono
          />
          <FieldText
            label="Email (opcional)"
            name="email"
            value={email}
            onChange={setEmail}
            type="email"
            placeholder="chofer@dtdcargo.com"
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FieldSelect
            label="Licencia de conducir"
            name="license_class"
            value={licenseClass}
            onChange={setLicenseClass}
            options={[{ value: "", label: "Seleccioná…" }, ...LICENSE_CLASS_OPTIONS.map((c) => ({ value: c, label: c }))]}
          />
          <FieldText
            label="Vence licencia"
            name="license_expires"
            value={licenseExpires}
            onChange={setLicenseExpires}
            type="date"
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FieldSelect
            label="Hub base"
            name="hub_code"
            value={hubCode}
            onChange={setHubCode}
            options={[{ value: "", label: "Seleccioná hub…" }, ...TMS_HUBS.map((h) => ({ value: h.code, label: `${h.code} · ${h.name}` }))]}
          />
          <FieldText
            label="Años de experiencia"
            name="exp_years"
            value={expYears}
            onChange={setExpYears}
            type="number"
            numericType="count"
            placeholder="5"
            mono
            error={state.fieldErrors?.exp_years}
          />
        </div>
        <FieldText
          label="Dirección"
          name="address"
          value={address}
          onChange={setAddress}
          placeholder="Av. Bolívar, Valencia"
        />
        <FieldText
          label="Contacto de emergencia"
          name="emergency_contact"
          value={emergency}
          onChange={setEmergency}
          placeholder="Nombre · teléfono"
        />

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            background: "var(--bg-elevated)",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--border)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={safety === "true"}
            onChange={(e) => setSafety(e.target.checked ? "true" : "false")}
            style={{ accentColor: "var(--wine)", width: 16, height: 16 }}
          />
          <span
            style={{
              font: "500 12.5px/1.4 var(--f-sans)",
              color: "var(--ink)",
            }}
          >
            Cuenta con cursos de seguridad vial vigentes
          </span>
        </label>

        <FieldText
          label="Notas"
          name="notes"
          value={notes}
          onChange={setNotes}
          placeholder="Observaciones…"
        />

        {state.error && <FormError msg={state.error} />}
        <div style={{ flex: 1, minHeight: 12 }} />
      </form>
      <DrawerFooter
        formId="tms-driver-form"
        onClose={onClose}
        isPending={isPending}
        canSubmit={canSubmit}
        submitLabel="Crear chofer"
      />
    </DrawerShell>
  );
}
