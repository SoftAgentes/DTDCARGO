"use client";

/**
 * GenerarCorteDrawer — genera un corte de nómina del período (SDD-0103 · Slice
 * motor — ESTRUCTURA). El recibo de cada empleado se computa en BORRADOR /
 * ADVISORY (solo cálculo mecánico). La frecuencia y el método de días salen de
 * las reglas vigentes (snapshot congelado). Form HTML5 (form="id" + submit en el
 * footer, sin requestSubmit). useActionState + fieldErrors.
 */

import { useActionState, useEffect } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import type { NominaActionState } from "@/lib/studio/nomina/employee-types";
import {
  payFrequencyLabel,
  dayMethodLabel,
  type PayrollRules,
} from "@/lib/studio/nomina/payroll-rules-types";
import { generatePayrollRunAction } from "../actions";
import { Field, Row, ErrorBox } from "./form-bits";

const FORM_ID = "generar-corte-form";
const initial: NominaActionState = {};

/** Período por defecto: el mes actual (YYYY-MM + primer/último día). */
function defaultPeriod(): { label: string; start: string; end: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based
  const pad = (n: number) => String(n).padStart(2, "0");
  const label = `${y}-${pad(m + 1)}`;
  const start = `${label}-01`;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const end = `${label}-${pad(lastDay)}`;
  return { label, start, end };
}

export function GenerarCorteDrawer({
  rules,
  onClose,
}: {
  rules: PayrollRules | null;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(generatePayrollRunAction, initial);
  const period = defaultPeriod();

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <DrawerShell
      title="Generar corte"
      subtitle="Recibos en borrador · cálculo mecánico (advisory)"
      onClose={onClose}
      pending={isPending}
      width={560}
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
        <Field label="Período" error={state.fieldErrors?.period_label} required>
          <input
            name="period_label"
            type="text"
            className="studio-input studio-input-mono"
            placeholder="2026-06"
            defaultValue={period.label}
            maxLength={40}
            required
          />
        </Field>

        <Row>
          <Field label="Inicio" error={state.fieldErrors?.period_start} required>
            <input
              name="period_start"
              type="date"
              className="studio-input"
              defaultValue={period.start}
              required
            />
          </Field>
          <Field label="Fin" error={state.fieldErrors?.period_end} required>
            <input
              name="period_end"
              type="date"
              className="studio-input"
              defaultValue={period.end}
              required
            />
          </Field>
        </Row>

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
            Reglas que se congelan en el corte
          </div>
          {rules ? (
            <p style={{ font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
              {payFrequencyLabel(rules.pay_frequency)} · {dayMethodLabel(rules.day_method)} ·
              reglas v{rules.version}. Editar las reglas después no cambia este corte.
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
            placeholder="Observaciones del corte (opcional)"
          />
        </Field>

        <p style={{ font: "400 11px/1.5 var(--f-sans)", color: "var(--ink-mute)", margin: "-8px 0 0" }}>
          Los recibos se calculan de forma <strong>mecánica y advisory</strong>: prorrateo, horas
          extra/nocturnas y deducciones sobre el sueldo base con sus topes. No incluye bonos
          salariales (criterio del contador) ni genera asiento contable.
        </p>

        {state.error && <ErrorBox>{state.error}</ErrorBox>}
      </form>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit={!!rules}
        submitLabel="Generar corte"
      />
    </DrawerShell>
  );
}
