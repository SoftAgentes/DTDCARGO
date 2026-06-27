"use client";

/**
 * RevisarSolicitudDrawer — el admin aprueba o rechaza una solicitud de registro
 * (SDD-0113 Slice A). Aprobar materializa la ficha con el **sueldo que define la
 * empresa** (no el del candidato). Rechazar exige motivo. Dos server actions
 * bindeadas con el id de la solicitud. useActionState + fieldErrors.
 */

import { useActionState, useEffect, useState } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import type { NominaActionState } from "@/lib/studio/nomina/employee-types";
import type { EmployeeRegistration } from "@/lib/studio/nomina/registration-types";
import { approveRegistrationAction, rejectRegistrationAction } from "../actions";
import { Field, Row, ErrorBox } from "./form-bits";

const initial: NominaActionState = {};

function DataRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
      <span style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>{label}</span>
      <span style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)", textAlign: "right" }}>
        {value || "—"}
      </span>
    </div>
  );
}

export function RevisarSolicitudDrawer({
  registration,
  onClose,
}: {
  registration: EmployeeRegistration;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"aprobar" | "rechazar">("aprobar");

  const approve = approveRegistrationAction.bind(null, registration.id);
  const reject = rejectRegistrationAction.bind(null, registration.id);
  const [aState, aAction, aPending] = useActionState(approve, initial);
  const [rState, rAction, rPending] = useActionState(reject, initial);

  useEffect(() => {
    if (aState.ok || rState.ok) onClose();
  }, [aState.ok, rState.ok, onClose]);

  const isPending = aPending || rPending;
  const FORM_ID = mode === "aprobar" ? "aprobar-solicitud-form" : "rechazar-solicitud-form";

  return (
    <DrawerShell
      title="Revisar solicitud"
      subtitle={registration.full_name}
      onClose={onClose}
      pending={isPending}
      width={560}
    >
      <div style={{ flex: 1, overflow: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
        {/* Datos del candidato (read-only) */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <DataRow label="Cédula" value={registration.national_id} />
          <DataRow label="Correo" value={registration.email} />
          <DataRow label="Teléfono" value={registration.phone} />
          <DataRow label="Cargo propuesto" value={registration.cargo} />
          <DataRow label="Banco" value={registration.bank_name} />
          <DataRow label="Cuenta" value={registration.bank_account} />
        </div>

        {/* Toggle aprobar / rechazar */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setMode("aprobar")}
            className={`studio-btn studio-btn-sm ${mode === "aprobar" ? "studio-btn-primary" : "studio-btn-ghost"}`}
          >
            Aprobar
          </button>
          <button
            type="button"
            onClick={() => setMode("rechazar")}
            className={`studio-btn studio-btn-sm ${mode === "rechazar" ? "studio-btn-danger" : "studio-btn-ghost"}`}
          >
            Rechazar
          </button>
        </div>

        {mode === "aprobar" ? (
          <form id="aprobar-solicitud-form" action={aAction} style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
            <p style={{ font: "400 12px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
              Al aprobar se crea la ficha del empleado. El <strong>sueldo lo defines tú</strong>, no el
              candidato.
            </p>
            <Row>
              <Field label="Sueldo mensual (USD)" error={aState.fieldErrors?.salary_usd} required>
                <input name="salary_usd" type="number" min={0} step="0.01" className="studio-input studio-input-mono" placeholder="0.00" required />
              </Field>
              <Field label="Fecha de ingreso" error={aState.fieldErrors?.hire_date}>
                <input name="hire_date" type="date" className="studio-input" defaultValue={registration.start_date ?? undefined} />
              </Field>
            </Row>
            {aState.error && <ErrorBox>{aState.error}</ErrorBox>}
          </form>
        ) : (
          <form id="rechazar-solicitud-form" action={rAction} style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
            <Field label="Motivo del rechazo" error={rState.fieldErrors?.rejection_reason} required>
              <textarea name="rejection_reason" className="studio-input" rows={3} style={{ resize: "vertical" }} placeholder="Por qué no procede esta solicitud" required />
            </Field>
            {rState.error && <ErrorBox>{rState.error}</ErrorBox>}
          </form>
        )}
      </div>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit
        submitLabel={mode === "aprobar" ? "Aprobar y crear ficha" : "Rechazar solicitud"}
      />
    </DrawerShell>
  );
}
