"use client";

/**
 * AsistenciaDrawer — registrar / editar un día de asistencia de un empleado
 * (SDD-0103 · Slice C). Form HTML5 (form="id" + submit en el footer, sin
 * requestSubmit). useActionState + fieldErrors del validador. En edición ofrece
 * eliminar (soft-delete). El empleado solo se elige al crear (no se mueve un
 * registro entre empleados).
 */

import { useActionState, useEffect } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Icon } from "@/app/studio/_components/icons";
import {
  ATTENDANCE_STATUS_OPTIONS,
  type Attendance,
} from "@/lib/studio/nomina/attendance-types";
import type { Employee } from "@/lib/studio/nomina/employee-types";
import type { NominaActionState } from "@/lib/studio/nomina/employee-types";
import {
  createAttendanceAction,
  updateAttendanceAction,
  softDeleteAttendanceAction,
} from "../actions";
import { Field, Row, ErrorBox } from "./form-bits";
import { submitKeepingDraft } from "@/app/studio/_components/ui/submitKeepingDraft";

const FORM_ID = "asistencia-form";
const initial: NominaActionState = {};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AsistenciaDrawer({
  record,
  employees,
  employeeName,
  onClose,
}: {
  record: Attendance | null;
  employees: Employee[];
  employeeName: string | null;
  onClose: () => void;
}) {
  const isEdit = !!record;
  const action = isEdit
    ? updateAttendanceAction.bind(null, record!.id)
    : createAttendanceAction;
  const [state, formAction, isPending] = useActionState(action, initial);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <DrawerShell
      title={isEdit ? "Editar asistencia" : "Registrar asistencia"}
      subtitle={isEdit ? (employeeName ?? record!.work_date) : "Un día por empleado"}
      onClose={onClose}
      pending={isPending}
      width={560}
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
        {isEdit ? (
          // En edición el empleado y la fecha no se mueven (mandamos el id).
          <input type="hidden" name="employee_id" value={record!.employee_id} />
        ) : (
          <Field label="Empleado" error={state.fieldErrors?.employee_id} required>
            <select name="employee_id" className="studio-input" defaultValue="" required>
              <option value="" disabled>
                Selecciona…
              </option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name} · {e.employee_code}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Row>
          <Field label="Fecha" error={state.fieldErrors?.work_date} required>
            <input
              name="work_date"
              type="date"
              className="studio-input"
              defaultValue={record?.work_date ?? todayIso()}
              readOnly={isEdit}
              required
            />
          </Field>
          <Field label="Estado del día" error={state.fieldErrors?.status} required>
            <select
              name="status"
              className="studio-input"
              defaultValue={record?.status ?? "trabajado"}
            >
              {ATTENDANCE_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </Row>

        <Row>
          <Field label="Horas extra (diurnas)" error={state.fieldErrors?.overtime_hours}>
            <input
              name="overtime_hours"
              type="number"
              step="0.5"
              min="0"
              max="24"
              className="studio-input studio-input-mono"
              defaultValue={record ? String(record.overtime_hours) : "0"}
            />
          </Field>
          <Field label="Horas nocturnas" error={state.fieldErrors?.night_hours}>
            <input
              name="night_hours"
              type="number"
              step="0.5"
              min="0"
              max="24"
              className="studio-input studio-input-mono"
              defaultValue={record ? String(record.night_hours) : "0"}
            />
          </Field>
        </Row>

        <Field label="Notas">
          <textarea
            name="notes"
            className="studio-input"
            rows={2}
            defaultValue={record?.notes ?? ""}
            style={{ resize: "vertical" }}
          />
        </Field>

        {state.error && <ErrorBox>{state.error}</ErrorBox>}

        {isEdit && (
          <div style={{ marginTop: "var(--s-2)", paddingTop: "var(--s-4)", borderTop: "1px solid var(--border)" }}>
            <ActionButton
              variant="danger"
              size="sm"
              idleLabel="Eliminar registro"
              loadingLabel="Eliminando…"
              successLabel="Eliminado"
              idleIcon={Icon.trash(13)}
              onAction={() => softDeleteAttendanceAction(record!.id)}
              onSuccess={onClose}
            />
          </div>
        )}
      </form>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit
        submitLabel={isEdit ? "Guardar cambios" : "Registrar"}
      />
    </DrawerShell>
  );
}
