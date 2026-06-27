"use client";

/**
 * GenerarFiniquitoDrawer — genera el finiquito de egreso de un empleado
 * (SDD-0109). Selector de empleado + causa de terminación LOTTT (las 4) + fecha
 * de egreso. El cálculo es BORRADOR / ADVISORY (calcLiquidacion); el criterio
 * salarial sale de las reglas vigentes (snapshot congelado). Form HTML5
 * (form="id" + submit en footer, sin requestSubmit). useActionState + fieldErrors.
 */

import { useActionState, useEffect, useState } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import type { NominaActionState } from "@/lib/studio/nomina/employee-types";
import type { Employee } from "@/lib/studio/nomina/employee-types";
import type { PayrollRules } from "@/lib/studio/nomina/payroll-rules-types";
import {
  TERMINATION_CAUSES,
  TERMINATION_CAUSE_META,
  type TerminationCause,
} from "@/lib/studio/nomina/settlement-types";
import { generarFiniquitoAction } from "../actions";
import { Field, ErrorBox } from "./form-bits";

const FORM_ID = "generar-finiquito-form";
const initial: NominaActionState = {};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function GenerarFiniquitoDrawer({
  employees,
  rules,
  onClose,
}: {
  employees: Employee[];
  rules: PayrollRules | null;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(generarFiniquitoAction, initial);
  const [cause, setCause] = useState<TerminationCause>("renuncia_76");

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  const eligible = employees.filter((e) => e.status !== "egresado");

  return (
    <DrawerShell
      title="Generar finiquito"
      subtitle="Liquidación de egreso · borrador advisory (el contador valida)"
      onClose={onClose}
      pending={isPending}
      width={580}
    >
      <form
        id={FORM_ID}
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
        <Field label="Empleado" error={state.fieldErrors?.employee_id} required>
          <select name="employee_id" className="studio-input" required defaultValue="">
            <option value="" disabled>
              Selecciona un empleado…
            </option>
            {eligible.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name} · {e.employee_code}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Causa de terminación" error={state.fieldErrors?.termination_cause} required>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {TERMINATION_CAUSES.map((c) => {
              const active = cause === c;
              return (
                <label
                  key={c}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: "10px 12px",
                    border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
                    borderRadius: "var(--r-sm)",
                    cursor: "pointer",
                    background: active ? "var(--wine-tint)" : "var(--bg-surface)",
                  }}
                >
                  <input
                    type="radio"
                    name="termination_cause"
                    value={c}
                    checked={active}
                    onChange={() => setCause(c)}
                    style={{ marginTop: 2 }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ font: "700 12.5px/1.3 var(--f-sans)", color: "var(--ink)", display: "block" }}>
                      {TERMINATION_CAUSE_META[c].label}
                    </span>
                    <span style={{ font: "400 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                      {TERMINATION_CAUSE_META[c].note}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </Field>

        <Field label="Fecha de egreso" error={state.fieldErrors?.termination_date} required>
          <input
            name="termination_date"
            type="date"
            className="studio-input"
            defaultValue={todayIso()}
            required
          />
        </Field>

        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)",
            padding: "12px 14px",
          }}
        >
          <div
            style={{
              font: "700 9.5px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-mute)",
              marginBottom: 8,
            }}
          >
            Criterio salarial que se congela
          </div>
          {rules ? (
            <p style={{ font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
              Reglas v{rules.version}: salario integral según los bonos salariales y alícuotas de la
              config. Editar las reglas después no cambia este finiquito.
            </p>
          ) : (
            <p style={{ font: "500 12.5px/1.5 var(--f-sans)", color: "var(--danger)", margin: 0 }}>
              Aún no defines las reglas de cálculo. Defínelas en la pestaña Reglas antes de generar.
            </p>
          )}
        </div>

        <Field label="Notas">
          <textarea
            name="notes"
            className="studio-input"
            rows={2}
            style={{ resize: "vertical" }}
            placeholder="Observaciones del finiquito (opcional)"
          />
        </Field>

        <p style={{ font: "400 11px/1.5 var(--f-sans)", color: "var(--ink-mute)", margin: "-8px 0 0" }}>
          El finiquito se calcula <strong>advisory</strong>: prestaciones (Art. 142), fracciones de
          vacaciones/bono vacacional/utilidades, indemnización Art. 92 según la causa, e intereses. El
          contador valida el criterio salarial antes de confirmar y pagar.
        </p>

        {state.error && <ErrorBox>{state.error}</ErrorBox>}
      </form>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit={!!rules && eligible.length > 0}
        submitLabel="Generar finiquito"
      />
    </DrawerShell>
  );
}
