"use client";

/**
 * FeriadoDrawer — agregar un feriado al calendario (SDD-0103 · Slice C).
 * Form HTML5 (form="id" + submit en el footer, sin requestSubmit). Solo alta:
 * los feriados se borran (soft-delete) desde la lista, no se editan en línea.
 */

import { useActionState, useEffect } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { HOLIDAY_SCOPE_OPTIONS } from "@/lib/studio/nomina/attendance-types";
import type { NominaActionState } from "@/lib/studio/nomina/employee-types";
import { createHolidayAction } from "../actions";
import { Field, Row, ErrorBox } from "./form-bits";

const FORM_ID = "feriado-form";
const initial: NominaActionState = {};

export function FeriadoDrawer({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(createHolidayAction, initial);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <DrawerShell
      title="Nuevo feriado"
      subtitle="Nacional VE o propio de la empresa"
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
        <Field label="Nombre del feriado" error={state.fieldErrors?.label} required>
          <input
            name="label"
            type="text"
            className="studio-input"
            maxLength={120}
            placeholder="Día del Trabajador"
            required
          />
        </Field>

        <Row>
          <Field label="Fecha" error={state.fieldErrors?.holiday_date} required>
            <input name="holiday_date" type="date" className="studio-input" required />
          </Field>
          <Field label="Alcance" error={state.fieldErrors?.scope}>
            <select name="scope" className="studio-input" defaultValue="nacional">
              {HOLIDAY_SCOPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </Row>

        {state.error && <ErrorBox>{state.error}</ErrorBox>}
      </form>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit
        submitLabel="Agregar feriado"
      />
    </DrawerShell>
  );
}
