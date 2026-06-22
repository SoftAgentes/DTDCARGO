"use client";

/**
 * PagoPrestadorDrawer — registra un pago por sesión a un prestador
 * (SDD-0103 · Slice A). Selecciona un prestador ACTIVO + concepto + monto.
 */

import { useActionState, useEffect } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import type { Contractor } from "@/lib/studio/nomina/contractor-types";
import type { NominaActionState } from "@/lib/studio/nomina/employee-types";
import { createContractorPaymentAction } from "../actions";
import { Field, ErrorBox } from "./form-bits";

const FORM_ID = "pago-prestador-form";
const initial: NominaActionState = {};

export function PagoPrestadorDrawer({
  contractors,
  onClose,
}: {
  contractors: Contractor[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    createContractorPaymentAction,
    initial,
  );
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <DrawerShell
      title="Registrar pago"
      subtitle="Pago por sesión a un prestador"
      onClose={onClose}
      pending={isPending}
      width={520}
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
        <Field label="Prestador" error={state.fieldErrors?.contractor_id} required>
          <select name="contractor_id" className="studio-input" defaultValue="" required>
            <option value="" disabled>
              Seleccionar…
            </option>
            {contractors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name} · {c.service}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Fecha del pago" error={state.fieldErrors?.paid_on}>
          <input name="paid_on" type="date" className="studio-input" defaultValue={today} />
        </Field>

        <Field label="Concepto" error={state.fieldErrors?.concept} required>
          <input
            name="concept"
            type="text"
            className="studio-input"
            placeholder="Limpieza de oficina (jornada)"
            maxLength={200}
            required
          />
        </Field>

        <Field label="Monto (USD)" error={state.fieldErrors?.amount_usd} required>
          <input
            name="amount_usd"
            type="number"
            step="0.01"
            min="0"
            className="studio-input"
            defaultValue="0"
            required
          />
        </Field>

        {state.error && <ErrorBox>{state.error}</ErrorBox>}
      </form>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit
        submitLabel="Registrar pago"
      />
    </DrawerShell>
  );
}
