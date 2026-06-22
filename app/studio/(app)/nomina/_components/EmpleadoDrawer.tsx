"use client";

/**
 * EmpleadoDrawer — crear / editar la ficha del empleado (SDD-0103 · Slice A).
 * Form HTML5 (form="id" + submit en el footer, sin requestSubmit). useActionState
 * + fieldErrors del validador. En modo edición ofrece eliminar (soft-delete).
 */

import { useActionState, useEffect } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Icon } from "@/app/studio/_components/icons";
import {
  EMPLOYEE_STATUS_OPTIONS,
  VE_BANKS,
  type Employee,
  type NominaActionState,
} from "@/lib/studio/nomina/employee-types";
import {
  createEmployeeAction,
  updateEmployeeAction,
  softDeleteEmployeeAction,
} from "../actions";
import { Field, Row, ErrorBox } from "./form-bits";

const FORM_ID = "empleado-form";
const initial: NominaActionState = {};

export function EmpleadoDrawer({
  employee,
  onClose,
}: {
  employee: Employee | null;
  onClose: () => void;
}) {
  const isEdit = !!employee;
  const action = isEdit
    ? updateEmployeeAction.bind(null, employee!.id)
    : createEmployeeAction;
  const [state, formAction, isPending] = useActionState(action, initial);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <DrawerShell
      title={isEdit ? "Editar empleado" : "Nuevo empleado"}
      subtitle={isEdit ? employee!.employee_code : "Sueldo indexado en USD"}
      onClose={onClose}
      pending={isPending}
      width={620}
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
        <Field label="Nombre completo" error={state.fieldErrors?.full_name} required>
          <input
            name="full_name"
            type="text"
            className="studio-input"
            defaultValue={employee?.full_name ?? ""}
            maxLength={120}
            required
          />
        </Field>

        <Row>
          <Field label="Cédula / pasaporte" error={state.fieldErrors?.national_id}>
            <input
              name="national_id"
              type="text"
              className="studio-input"
              defaultValue={employee?.national_id ?? ""}
              placeholder="V-12.345.678"
            />
          </Field>
          <Field label="Teléfono">
            <input
              name="phone"
              type="tel"
              className="studio-input"
              defaultValue={employee?.phone ?? ""}
              placeholder="+58 412 000 0000"
            />
          </Field>
        </Row>

        <Row>
          <Field label="Cargo">
            <input
              name="position_label"
              type="text"
              className="studio-input"
              defaultValue={employee?.position_label ?? ""}
            />
          </Field>
          <Field label="Departamento">
            <input
              name="department"
              type="text"
              className="studio-input"
              defaultValue={employee?.department ?? ""}
            />
          </Field>
        </Row>

        <Row>
          <Field label="Sueldo mensual (USD)" error={state.fieldErrors?.salary_usd} required>
            <input
              name="salary_usd"
              type="number"
              step="0.01"
              min="0"
              className="studio-input"
              defaultValue={employee ? String(employee.salary_usd) : "0"}
              required
            />
          </Field>
          <Field label="Email" error={state.fieldErrors?.email}>
            <input
              name="email"
              type="email"
              className="studio-input"
              defaultValue={employee?.email ?? ""}
            />
          </Field>
        </Row>

        <Row>
          <Field label="Fecha de ingreso" error={state.fieldErrors?.hire_date}>
            <input
              name="hire_date"
              type="date"
              className="studio-input"
              defaultValue={employee?.hire_date ?? ""}
            />
          </Field>
          <Field label="Fecha de nacimiento" error={state.fieldErrors?.birth_date}>
            <input
              name="birth_date"
              type="date"
              className="studio-input"
              defaultValue={employee?.birth_date ?? ""}
            />
          </Field>
        </Row>

        <Row>
          <Field label="Banco">
            <select name="bank_name" className="studio-input" defaultValue={employee?.bank_name ?? ""}>
              <option value="">—</option>
              {VE_BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de cuenta" error={state.fieldErrors?.bank_account_type}>
            <select
              name="bank_account_type"
              className="studio-input"
              defaultValue={employee?.bank_account_type ?? ""}
            >
              <option value="">—</option>
              <option value="corriente">Corriente</option>
              <option value="ahorro">Ahorro</option>
            </select>
          </Field>
        </Row>

        <Field label="Número de cuenta">
          <input
            name="bank_account"
            type="text"
            className="studio-input"
            defaultValue={employee?.bank_account ?? ""}
            placeholder="0000 0000 00 0000000000"
          />
        </Field>

        {isEdit && (
          <Field label="Estado" error={state.fieldErrors?.status}>
            <select name="status" className="studio-input" defaultValue={employee!.status}>
              {EMPLOYEE_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Notas">
          <textarea
            name="notes"
            className="studio-input"
            rows={2}
            defaultValue={employee?.notes ?? ""}
            style={{ resize: "vertical" }}
          />
        </Field>

        {state.error && <ErrorBox>{state.error}</ErrorBox>}

        {isEdit && (
          <div style={{ marginTop: "var(--s-2)", paddingTop: "var(--s-4)", borderTop: "1px solid var(--border)" }}>
            <ActionButton
              variant="danger"
              size="sm"
              idleLabel="Eliminar empleado"
              loadingLabel="Eliminando…"
              successLabel="Eliminado"
              idleIcon={Icon.trash(13)}
              onAction={() => softDeleteEmployeeAction(employee!.id)}
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
        submitLabel={isEdit ? "Guardar cambios" : "Crear empleado"}
      />
    </DrawerShell>
  );
}
