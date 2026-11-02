"use client";

/**
 * ReglasDrawer — editar los parámetros LOTTT (SDD-0103 · Slice B).
 * Es CONFIG, no cálculo: solo lee/guarda params. Form HTML5 (form="id" + submit
 * en el footer, sin requestSubmit). useActionState + fieldErrors del validador.
 * Guardar archiva el ruleset vigente y crea una versión nueva (lo hace la action).
 */

import { useActionState, useEffect } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  PAY_FREQUENCY_OPTIONS,
  DAY_METHOD_OPTIONS,
  PAYROLL_RULES_DEFAULTS,
  type PayrollRules,
} from "@/lib/studio/nomina/payroll-rules-types";
import type { NominaActionState } from "@/lib/studio/nomina/employee-types";
import { savePayrollRulesAction } from "../actions";
import { Field, Row, ErrorBox } from "./form-bits";
import { submitKeepingDraft } from "@/lib/shared/submit-keeping-draft";

const FORM_ID = "reglas-form";
const initial: NominaActionState = {};

/** Valor por defecto del campo: el del ruleset vigente o el default LOTTT. */
function val(rules: PayrollRules | null, key: keyof typeof PAYROLL_RULES_DEFAULTS): string {
  const fallback = PAYROLL_RULES_DEFAULTS[key];
  const v = rules ? (rules as unknown as Record<string, unknown>)[key] : fallback;
  if (v == null) return "";
  if (Array.isArray(v)) return "";
  return String(v);
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        font: "700 9.5px/1 var(--f-sans)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--ink-soft)",
        marginTop: "var(--s-2)",
      }}
    >
      {children}
    </div>
  );
}

export function ReglasDrawer({
  rules,
  onClose,
}: {
  rules: PayrollRules | null;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(savePayrollRulesAction, initial);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <DrawerShell
      title="Reglas de cálculo"
      subtitle={
        rules
          ? `Versión ${rules.version} vigente · al guardar se crea la v${rules.version + 1}`
          : "Parámetros LOTTT — define la primera versión"
      }
      onClose={onClose}
      pending={isPending}
      width={680}
    >
      <form
        id={FORM_ID}
        onSubmit={submitKeepingDraft(formAction, isPending)}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-4)",
        }}
      >
        <p style={{ font: "400 12px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          Estos parámetros son la fuente de verdad de la nómina del período. Acá no se
          calcula ningún recibo: el contador ajusta los valores y el motor de cálculo los
          consume después.
        </p>

        {/* Frecuencia y método de días */}
        <GroupTitle>Frecuencia y días</GroupTitle>
        <Row>
          <Field label="Frecuencia de pago" error={state.fieldErrors?.pay_frequency}>
            <select
              name="pay_frequency"
              className="studio-input"
              defaultValue={val(rules, "pay_frequency") || "mensual"}
            >
              {PAY_FREQUENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Método de días" error={state.fieldErrors?.day_method}>
            <select
              name="day_method"
              className="studio-input"
              defaultValue={val(rules, "day_method") || "30"}
            >
              {DAY_METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </Row>

        {/* Montos base (Bs) */}
        <GroupTitle>Montos base (Bs)</GroupTitle>
        <Row>
          <Field label="Salario mínimo" error={state.fieldErrors?.min_salary}>
            <input
              name="min_salary"
              type="number"
              step="0.01"
              min="0"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "min_salary")}
            />
          </Field>
          <Field label="Cestaticket" error={state.fieldErrors?.cestaticket}>
            <input
              name="cestaticket"
              type="number"
              step="0.01"
              min="0"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "cestaticket")}
            />
          </Field>
          <Field label="Bono de guerra" error={state.fieldErrors?.bono_guerra}>
            <input
              name="bono_guerra"
              type="number"
              step="0.01"
              min="0"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "bono_guerra")}
            />
          </Field>
        </Row>

        {/* Deducciones (%) */}
        <GroupTitle>Deducciones del empleado (%)</GroupTitle>
        <Row>
          <Field label="SSO / IVSS" error={state.fieldErrors?.sso_pct}>
            <input
              name="sso_pct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "sso_pct")}
            />
          </Field>
          <Field label="RPE" error={state.fieldErrors?.rpe_pct}>
            <input
              name="rpe_pct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "rpe_pct")}
            />
          </Field>
          <Field label="FAOV" error={state.fieldErrors?.faov_pct}>
            <input
              name="faov_pct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "faov_pct")}
            />
          </Field>
        </Row>

        {/* Topes (nº de SM) */}
        <GroupTitle>Topes de cotización (nº de salarios mínimos)</GroupTitle>
        <Row>
          <Field label="Tope IVSS" error={state.fieldErrors?.sso_cap_sm}>
            <input
              name="sso_cap_sm"
              type="number"
              step="0.01"
              min="0"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "sso_cap_sm")}
            />
          </Field>
          <Field label="Tope RPE" error={state.fieldErrors?.rpe_cap_sm}>
            <input
              name="rpe_cap_sm"
              type="number"
              step="0.01"
              min="0"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "rpe_cap_sm")}
            />
          </Field>
        </Row>

        {/* Recargos (%) */}
        <GroupTitle>Recargos (%)</GroupTitle>
        <Row>
          <Field label="Hora extra diurna" error={state.fieldErrors?.overtime_pct}>
            <input
              name="overtime_pct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "overtime_pct")}
            />
          </Field>
          <Field label="Bono nocturno" error={state.fieldErrors?.night_pct}>
            <input
              name="night_pct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "night_pct")}
            />
          </Field>
          <Field label="Día feriado" error={state.fieldErrors?.holiday_pct}>
            <input
              name="holiday_pct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "holiday_pct")}
            />
          </Field>
        </Row>

        {/* Provisiones (días) */}
        <GroupTitle>Provisiones / prestaciones (días)</GroupTitle>
        <Row>
          <Field label="Utilidades" error={state.fieldErrors?.utilidades_days}>
            <input
              name="utilidades_days"
              type="number"
              step="1"
              min="30"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "utilidades_days")}
            />
          </Field>
          <Field label="Bono vacacional" error={state.fieldErrors?.bono_vacacional_days}>
            <input
              name="bono_vacacional_days"
              type="number"
              step="1"
              min="0"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "bono_vacacional_days")}
            />
          </Field>
          <Field label="Vacaciones" error={state.fieldErrors?.vacaciones_days}>
            <input
              name="vacaciones_days"
              type="number"
              step="1"
              min="0"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "vacaciones_days")}
            />
          </Field>
        </Row>
        <p style={{ font: "400 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "-8px 0 0" }}>
          Utilidades: mínimo legal 30 días (LOTTT Art. 131).
        </p>

        <Field label="Notas">
          <textarea
            name="notes"
            className="studio-input"
            rows={2}
            defaultValue={rules?.notes ?? ""}
            style={{ resize: "vertical" }}
          />
        </Field>

        {state.error && <ErrorBox>{state.error}</ErrorBox>}
      </form>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit
        submitLabel="Guardar reglas"
      />
    </DrawerShell>
  );
}
