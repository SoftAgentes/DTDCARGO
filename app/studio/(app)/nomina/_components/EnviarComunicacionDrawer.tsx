"use client";

/**
 * EnviarComunicacionDrawer — RRHH envía una comunicación a un empleado (SDD-0113
 * Slice B): recibo/aviso/llamado/amonestación. useActionState contra
 * sendCommAction; el trigger same-tenant de la DB valida empleado + ref. Los
 * tipos llamado/amonestación piden acuse por defecto.
 */

import { useActionState, useState } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import type { NominaActionState, Employee } from "@/lib/studio/nomina/employee-types";
import { COMM_TYPES, commTypeLabel, commTypeRequiresAck } from "@/lib/studio/nomina/comms-types";
import { sendCommAction } from "../actions";
import { Field, ErrorBox } from "./form-bits";
import { submitKeepingDraft } from "@/app/studio/_components/ui/submitKeepingDraft";

const FORM_ID = "enviar-comunicacion-form";
const initial: NominaActionState = {};

export function EnviarComunicacionDrawer({
  employees,
  presetEmployeeId,
  onClose,
}: {
  employees: Employee[];
  presetEmployeeId?: string;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(sendCommAction, initial);
  const [type, setType] = useState<string>("aviso");

  if (state.ok) {
    return (
      <DrawerShell title="Comunicación enviada" onClose={onClose} pending={false} width={520}>
        <div style={{ flex: 1, padding: "24px 22px" }}>
          <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
            La comunicación se envió. El empleado la verá en su app y, si requiere acuse, podrá
            confirmarla. Aquí verás cuándo la lee y la confirma.
          </p>
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="studio-btn studio-btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </DrawerShell>
    );
  }

  return (
    <DrawerShell
      title="Enviar comunicación"
      subtitle="A un empleado · con acuse opcional"
      onClose={onClose}
      pending={isPending}
      width={520}
    >
      <form
        id={FORM_ID}
        onSubmit={submitKeepingDraft(formAction, isPending)}
        style={{ flex: 1, overflow: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: "var(--s-4)" }}
      >
        <Field label="Empleado" error={state.fieldErrors?.employee_id}>
          <select name="employee_id" className="studio-input" defaultValue={presetEmployeeId ?? ""} required>
            <option value="" disabled>Selecciona…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name} · {e.employee_code}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tipo" error={state.fieldErrors?.type}>
          <select name="type" className="studio-input" value={type} onChange={(ev) => setType(ev.target.value)}>
            {COMM_TYPES.map((t) => (
              <option key={t} value={t}>{commTypeLabel(t)}</option>
            ))}
          </select>
        </Field>

        <Field label="Título" error={state.fieldErrors?.title}>
          <input name="title" type="text" className="studio-input" maxLength={160} required />
        </Field>

        <Field label="Mensaje" error={state.fieldErrors?.body}>
          <textarea name="body" className="studio-input" rows={5} required />
        </Field>

        <label style={{ display: "flex", gap: 8, alignItems: "center", font: "400 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          <input type="checkbox" name="requires_ack" value="1" defaultChecked={commTypeRequiresAck(type)} />
          Requiere acuse de recibo del empleado
        </label>

        {state.error && <ErrorBox>{state.error}</ErrorBox>}
      </form>

      <DrawerFooter formId={FORM_ID} onClose={onClose} isPending={isPending} canSubmit submitLabel="Enviar" />
    </DrawerShell>
  );
}
