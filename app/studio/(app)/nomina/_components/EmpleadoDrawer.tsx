"use client";

/**
 * EmpleadoDrawer — crear / editar la ficha del empleado (SDD-0103 · Slice A;
 * alta unificada SDD-0140 · Fase 2). Form HTML5 (form="id" + submit en el footer,
 * sin requestSubmit). useActionState + fieldErrors del validador.
 *
 * Alta unificada: al crear se puede asignar un PUESTO (perfil, nomina_positions)
 * y —solo si el caller es admin— dar ACCESO al sistema invitando al usuario con
 * el rol que sugiere el puesto. La invitación reusa el flujo de Usuarios (email
 * Resend + link de fallback). Al invitar, el drawer muestra el link en vez de
 * cerrarse. En modo edición ofrece eliminar (soft-delete).
 */

import { useActionState, useEffect, useState } from "react";
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
import { type Position } from "@/lib/studio/nomina/position-types";
import { STUDIO_USER_ROLES, ROLE_LABELS } from "@/lib/studio/user-types";
import {
  createEmployeeAction,
  updateEmployeeAction,
  softDeleteEmployeeAction,
} from "../actions";
import { Field, Row, ErrorBox } from "./form-bits";
import { submitKeepingDraft } from "@/app/studio/_components/ui/submitKeepingDraft";

const FORM_ID = "empleado-form";
const initial: NominaActionState = {};

export function EmpleadoDrawer({
  employee,
  positions,
  canManageUsers,
  onClose,
}: {
  employee: Employee | null;
  positions: Position[];
  canManageUsers: boolean;
  onClose: () => void;
}) {
  const isEdit = !!employee;
  const action = isEdit
    ? updateEmployeeAction.bind(null, employee!.id)
    : createEmployeeAction;
  const [state, formAction, isPending] = useActionState(action, initial);

  const [positionId, setPositionId] = useState(employee?.position_id ?? "");
  const [giveAccess, setGiveAccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Rol sugerido por el puesto seleccionado (plantilla del acceso).
  const suggestedRole = positions.find((p) => p.id === positionId)?.rbac_role ?? null;

  // El alta unificada (dar acceso) solo tiene sentido al CREAR y si el caller es
  // admin (Usuarios es admin-only). En edición, el acceso se gestiona en Usuarios.
  const showAccess = !isEdit && canManageUsers;

  // Éxito con "algo que mostrar": invitación creada o aviso no-fatal → no cerrar.
  const successPanel = state.ok && (state.invitationLink || state.accessWarning);

  useEffect(() => {
    if (state.ok && !state.invitationLink && !state.accessWarning) onClose();
  }, [state.ok, state.invitationLink, state.accessWarning, onClose]);

  const copyLink = async () => {
    if (!state.invitationLink) return;
    try {
      await navigator.clipboard.writeText(state.invitationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* el usuario puede seleccionar el texto */
    }
  };

  return (
    <DrawerShell
      title={isEdit ? "Editar empleado" : "Nuevo empleado"}
      subtitle={isEdit ? employee!.employee_code : "Sueldo indexado en USD"}
      onClose={onClose}
      pending={isPending}
      width={640}
    >
      {successPanel ? (
        <div style={{ flex: 1, overflow: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
          <div style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
            {state.invitationLink ? "Empleado creado · invitación lista" : "Empleado creado"}
          </div>
          {state.invitationLink ? (
            <>
              <p style={{ font: "400 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
                Se le envió un correo con el acceso. Si no llega, comparte este enlace (vence en 7 días):
              </p>
              <div
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-sm)",
                  padding: "10px 12px",
                  font: "600 12px/1.5 var(--f-mono)",
                  color: "var(--ink)",
                  wordBreak: "break-all",
                }}
              >
                {state.invitationLink}
              </div>
              <button type="button" className="studio-btn studio-btn-primary" onClick={copyLink}>
                {copied ? "Copiado" : "Copiar enlace"}
              </button>
            </>
          ) : (
            <ErrorBox>{state.accessWarning}</ErrorBox>
          )}
        </div>
      ) : (
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

          {/* Puesto (perfil) · SDD-0140 */}
          <Field label="Puesto" error={state.fieldErrors?.position_id}>
            <select
              name="position_id"
              className="studio-input"
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
            >
              <option value="">— Sin puesto asignado —</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.area} · {p.title}
                </option>
              ))}
            </select>
          </Field>

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

          {/* Alta unificada · dar acceso al sistema (solo admin, solo al crear) */}
          {showAccess && (
            <AccessSection suggestedRole={suggestedRole} open={giveAccess} onToggle={setGiveAccess} />
          )}

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
      )}

      {successPanel ? (
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="studio-btn studio-btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>
      ) : (
        <DrawerFooter
          formId={FORM_ID}
          onClose={onClose}
          isPending={isPending}
          canSubmit
          submitLabel={isEdit ? "Guardar cambios" : "Crear empleado"}
        />
      )}
    </DrawerShell>
  );
}

/**
 * Sección de acceso unificado: checkbox "dar acceso al sistema" + rol (plantilla
 * del puesto) + oficina. Los campos van al form como give_access/access_role/
 * access_region; la action los usa solo si el caller es admin.
 */
function AccessSection({
  suggestedRole,
  open,
  onToggle,
}: {
  suggestedRole: string | null;
  open: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-3)",
        background: "var(--bg-elevated)",
      }}
    >
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
        <input
          type="checkbox"
          name="give_access"
          checked={open}
          onChange={(e) => onToggle(e.target.checked)}
          style={{ accentColor: "var(--wine)", width: 16, height: 16, marginTop: 2 }}
        />
        <div>
          <div style={{ font: "600 12.5px/1.4 var(--f-sans)", color: "var(--ink)" }}>
            Dar acceso al sistema
          </div>
          <div style={{ font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: 2 }}>
            Invita a esta persona como usuario del Studio con el rol que sugiere su puesto. Se le
            manda un correo con el acceso. Requiere el email de arriba.
          </div>
        </div>
      </label>

      {open && (
        <Row>
          <Field label="Rol de acceso">
            <select
              name="access_role"
              className="studio-input"
              defaultValue={suggestedRole ?? "operations"}
              key={suggestedRole ?? "operations"}
            >
              {STUDIO_USER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Oficina">
            <select name="access_region" className="studio-input" defaultValue="ve">
              <option value="ve">Venezuela</option>
              <option value="cn">China</option>
            </select>
          </Field>
        </Row>
      )}
    </div>
  );
}
