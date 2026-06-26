"use client";

/**
 * PrestamoDrawer — registrar un préstamo a un empleado (SDD-0103 · Slice C).
 * El descuento real en el recibo lo hará el motor (Slice posterior); acá solo
 * se registra el préstamo (principal + cuota + nº de cuotas). Form HTML5
 * (form="id" + submit en el footer, sin requestSubmit). useActionState + fieldErrors.
 */

import { useActionState, useEffect } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import type { Employee } from "@/lib/studio/nomina/employee-types";
import type { NominaActionState } from "@/lib/studio/nomina/employee-types";
import { createLoanAction } from "../actions";
import { Field, Row, ErrorBox } from "./form-bits";

const FORM_ID = "prestamo-form";
const initial: NominaActionState = {};

export function PrestamoDrawer({
  employees,
  onClose,
}: {
  employees: Employee[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(createLoanAction, initial);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <DrawerShell
      title="Nuevo préstamo"
      subtitle="La cuota se descontará en el recibo del período"
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
        <Field label="Empleado" error={state.fieldErrors?.employee_id} required>
          <select name="employee_id" className="studio-input" defaultValue="" required>
            <option value="" disabled>
              Seleccionar…
            </option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name} · {e.employee_code}
              </option>
            ))}
          </select>
        </Field>

        <Row>
          <Field label="Monto del préstamo (USD)" error={state.fieldErrors?.principal_usd} required>
            <input
              name="principal_usd"
              type="number"
              step="0.01"
              min="0"
              className="studio-input studio-input-mono"
              placeholder="300.00"
              required
            />
          </Field>
          <Field label="Cuota por período (USD)" error={state.fieldErrors?.installment_usd} required>
            <input
              name="installment_usd"
              type="number"
              step="0.01"
              min="0"
              className="studio-input studio-input-mono"
              placeholder="25.00"
              required
            />
          </Field>
        </Row>

        <Row>
          <Field label="Número de cuotas" error={state.fieldErrors?.installments_total}>
            <input
              name="installments_total"
              type="number"
              step="1"
              min="1"
              className="studio-input studio-input-mono"
              defaultValue="1"
            />
          </Field>
          <Field label="Fecha de otorgamiento" error={state.fieldErrors?.granted_on}>
            <input name="granted_on" type="date" className="studio-input" defaultValue={today} />
          </Field>
        </Row>

        <Field label="Concepto" error={state.fieldErrors?.concept}>
          <input
            name="concept"
            type="text"
            className="studio-input"
            placeholder="Adelanto personal, emergencia médica…"
            maxLength={200}
          />
        </Field>

        <Field label="Notas">
          <textarea
            name="notes"
            className="studio-input"
            rows={2}
            style={{ resize: "vertical" }}
          />
        </Field>

        <p style={{ font: "400 11px/1.4 var(--f-sans)", color: "var(--ink-mute)", margin: "-8px 0 0" }}>
          El descuento de la cuota se aplica al recibo cuando el motor de nómina lo procese.
          Acá solo registras el préstamo y su saldo.
        </p>

        {state.error && <ErrorBox>{state.error}</ErrorBox>}
      </form>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit
        submitLabel="Registrar préstamo"
      />
    </DrawerShell>
  );
}
