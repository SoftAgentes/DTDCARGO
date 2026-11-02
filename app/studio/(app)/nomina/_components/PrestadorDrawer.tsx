"use client";

/**
 * PrestadorDrawer — crear / editar un prestador freelance (SDD-0103 · Slice A).
 * Mismo patrón que EmpleadoDrawer (form HTML5 + useActionState + fieldErrors).
 */

import { useActionState, useEffect } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Icon } from "@/app/studio/_components/icons";
import type { Contractor } from "@/lib/studio/nomina/contractor-types";
import type { NominaActionState } from "@/lib/studio/nomina/employee-types";
import {
  createContractorAction,
  updateContractorAction,
  softDeleteContractorAction,
} from "../actions";
import { Field, Row, ErrorBox } from "./form-bits";
import { submitKeepingDraft } from "@/app/studio/_components/ui/submitKeepingDraft";

const FORM_ID = "prestador-form";
const initial: NominaActionState = {};

export function PrestadorDrawer({
  contractor,
  onClose,
}: {
  contractor: Contractor | null;
  onClose: () => void;
}) {
  const isEdit = !!contractor;
  const action = isEdit
    ? updateContractorAction.bind(null, contractor!.id)
    : createContractorAction;
  const [state, formAction, isPending] = useActionState(action, initial);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <DrawerShell
      title={isEdit ? "Editar prestador" : "Nuevo prestador"}
      subtitle="Pago por sesión · fuera de la nómina fija"
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
        <Field label="Nombre completo" error={state.fieldErrors?.full_name} required>
          <input
            name="full_name"
            type="text"
            className="studio-input"
            defaultValue={contractor?.full_name ?? ""}
            maxLength={120}
            required
          />
        </Field>

        <Field label="Servicio" error={state.fieldErrors?.service} required>
          <input
            name="service"
            type="text"
            className="studio-input"
            defaultValue={contractor?.service ?? ""}
            placeholder="Limpieza, plomería, mensajería…"
            maxLength={120}
            required
          />
        </Field>

        <Row>
          <Field label="Teléfono">
            <input
              name="phone"
              type="tel"
              className="studio-input"
              defaultValue={contractor?.phone ?? ""}
              placeholder="+58 412 000 0000"
            />
          </Field>
          <Field label="Tarifa de referencia (USD)" error={state.fieldErrors?.default_rate_usd}>
            <input
              name="default_rate_usd"
              type="number"
              step="0.01"
              min="0"
              className="studio-input"
              defaultValue={contractor ? String(contractor.default_rate_usd) : "0"}
            />
          </Field>
        </Row>

        <Field label="Cédula / RIF">
          <input
            name="national_id"
            type="text"
            className="studio-input"
            defaultValue={contractor?.national_id ?? ""}
          />
        </Field>

        {isEdit && (
          <Field label="Estado" error={state.fieldErrors?.status}>
            <select name="status" className="studio-input" defaultValue={contractor!.status}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </Field>
        )}

        <Field label="Notas">
          <textarea
            name="notes"
            className="studio-input"
            rows={2}
            defaultValue={contractor?.notes ?? ""}
            style={{ resize: "vertical" }}
          />
        </Field>

        {state.error && <ErrorBox>{state.error}</ErrorBox>}

        {isEdit && (
          <div style={{ marginTop: "var(--s-2)", paddingTop: "var(--s-4)", borderTop: "1px solid var(--border)" }}>
            <ActionButton
              variant="danger"
              size="sm"
              idleLabel="Eliminar prestador"
              loadingLabel="Eliminando…"
              successLabel="Eliminado"
              idleIcon={Icon.trash(13)}
              onAction={() => softDeleteContractorAction(contractor!.id)}
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
        submitLabel={isEdit ? "Guardar cambios" : "Crear prestador"}
      />
    </DrawerShell>
  );
}
