"use client";

/**
 * PuestoDrawer — crear / editar el perfil de un puesto (SDD-0140 · Fase 1).
 * El perfil está desacoplado de la persona: define qué necesita el puesto
 * (área, rol RBAC sugerido, disparadores, responsabilidades, skills, KPI),
 * sin importar quién lo ocupe hoy. Form HTML5 + useActionState + fieldErrors.
 *
 * El slug se deriva del título al crear (input hidden vacío → el validador lo
 * calcula); al editar se mantiene el slug existente (hidden con su valor) para
 * no romper referencias.
 */

import { useActionState, useEffect } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Icon } from "@/app/studio/_components/icons";
import {
  POSITION_ROLE_OPTIONS,
  type Position,
} from "@/lib/studio/nomina/position-types";
import type { NominaActionState } from "@/lib/studio/nomina/employee-types";
import {
  createPositionAction,
  updatePositionAction,
  softDeletePositionAction,
} from "../actions";
import { Field, Row, ErrorBox } from "./form-bits";
import { submitKeepingDraft } from "@/lib/shared/submit-keeping-draft";

const FORM_ID = "puesto-form";
const initial: NominaActionState = {};

const AREAS = [
  "Dirección",
  "Marketing",
  "Comercial",
  "Administración",
  "Operaciones",
  "China",
  "Trámites",
  "Formación",
];

export function PuestoDrawer({
  position,
  onClose,
}: {
  position: Position | null;
  onClose: () => void;
}) {
  const isEdit = !!position;
  const action = isEdit
    ? updatePositionAction.bind(null, position!.id)
    : createPositionAction;
  const [state, formAction, isPending] = useActionState(action, initial);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <DrawerShell
      title={isEdit ? "Editar puesto" : "Nuevo puesto"}
      subtitle={isEdit ? position!.title : "Perfil del cargo, aparte de la persona"}
      onClose={onClose}
      pending={isPending}
      width={640}
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
        {/* Slug: hidden. Vacío al crear (se deriva del título); estable al editar. */}
        <input type="hidden" name="slug" defaultValue={position?.slug ?? ""} />

        <Field label="Título del puesto" error={state.fieldErrors?.title} required>
          <input
            name="title"
            type="text"
            className="studio-input"
            defaultValue={position?.title ?? ""}
            maxLength={120}
            placeholder="Administración / PMO / Tesorería"
            required
          />
        </Field>

        <Row>
          <Field label="Área" error={state.fieldErrors?.area} required>
            <input
              name="area"
              type="text"
              className="studio-input"
              defaultValue={position?.area ?? ""}
              list="puesto-areas"
              maxLength={80}
              placeholder="Administración"
              required
            />
            <datalist id="puesto-areas">
              {AREAS.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Field>
          <Field label="Rol de acceso (RBAC)" error={state.fieldErrors?.rbac_role}>
            <select
              name="rbac_role"
              className="studio-input"
              defaultValue={position?.rbac_role ?? ""}
            >
              {POSITION_ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </Row>

        <Field label="Disparadores">
          <textarea
            name="triggers"
            className="studio-input"
            rows={2}
            defaultValue={position?.triggers ?? ""}
            placeholder="Cuándo entra una tarea a este puesto (para enrutar el trabajo)."
            style={{ resize: "vertical" }}
          />
        </Field>

        <Field label="Responsabilidades">
          <textarea
            name="responsibilities"
            className="studio-input"
            rows={3}
            defaultValue={position?.responsibilities ?? ""}
            style={{ resize: "vertical" }}
          />
        </Field>

        <Field label="Skills">
          <textarea
            name="skills"
            className="studio-input"
            rows={2}
            defaultValue={position?.skills ?? ""}
            placeholder="Duras + blandas."
            style={{ resize: "vertical" }}
          />
        </Field>

        <Field label="KPI principal">
          <input
            name="kpi"
            type="text"
            className="studio-input"
            defaultValue={position?.kpi ?? ""}
            maxLength={200}
          />
        </Field>

        <Row>
          <Field label="Titular / suplente (referencial)">
            <input
              name="owner_note"
              type="text"
              className="studio-input"
              defaultValue={position?.owner_note ?? ""}
              maxLength={200}
              placeholder="Titular: … · Suplente: …"
            />
          </Field>
        </Row>

        <Field label="Candado de gobernanza">
          <input
            name="governance_note"
            type="text"
            className="studio-input"
            defaultValue={position?.governance_note ?? ""}
            maxLength={200}
            placeholder="Ej: mueve plata pero NO admin (separación de poderes)."
          />
        </Field>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "var(--ink)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            name="active"
            defaultChecked={position ? position.active : true}
            style={{ accentColor: "var(--wine)", width: 16, height: 16 }}
          />
          Puesto activo
        </label>

        {state.error && <ErrorBox>{state.error}</ErrorBox>}

        {isEdit && (
          <div style={{ marginTop: "var(--s-2)", paddingTop: "var(--s-4)", borderTop: "1px solid var(--border)" }}>
            <ActionButton
              variant="danger"
              size="sm"
              idleLabel="Eliminar puesto"
              loadingLabel="Eliminando…"
              successLabel="Eliminado"
              idleIcon={Icon.trash(13)}
              onAction={() => softDeletePositionAction(position!.id)}
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
        submitLabel={isEdit ? "Guardar cambios" : "Crear puesto"}
      />
    </DrawerShell>
  );
}
