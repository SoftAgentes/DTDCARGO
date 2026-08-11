"use client";

/**
 * TemplateDrawer — crear/editar un template de costo por ruta (SDD-0053 · Slice C).
 *
 * Calcado del CostEditorDrawer: DrawerShell + <form id> + 7 NumericInput (USD) +
 * costo total recalculado en vivo. Suma los campos de ruta (nombre, origen,
 * destino, servicio, activo). Postea createTemplate / updateTemplate vía
 * useActionState (no Zod; validación en validateTemplateInput). Footer HTML5
 * (<button form=…>) sin requestSubmit hack. En modo edit, botón de borrar
 * (soft-delete) con confirmación inline.
 *
 * Costos en USD canónico (igual que el Cost Editor — el toggle VES vive en la
 * pantalla, no en el editor).
 */

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DrawerShell, DrawerFooter } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { Icon } from "@/app/studio/_components/icons";
import { SERVICE_LABELS } from "@/lib/studio/shipment-types";
import type { ShipmentService } from "@/lib/studio/shipment-types";
import {
  COST_CATEGORIES,
  emptyCosts,
  totalCost,
  type CostAmounts,
  type CostCategoryKey,
  type RouteCostTemplate,
  type TemplateActionState,
} from "@/lib/studio/costing/types";
import {
  createTemplate,
  softDeleteTemplate,
  updateTemplate,
} from "../actions";
import { fmtUsd } from "@/lib/money";

const FORM_ID = "template-editor-form";
const initialState: TemplateActionState = {};

const SERVICE_OPTIONS = (Object.keys(SERVICE_LABELS) as ShipmentService[]).map(
  (s) => {
    const l = SERVICE_LABELS[s];
    return { value: s, label: l.sub ? `${l.primary} (${l.sub})` : l.primary };
  },
);

function templateAmounts(tpl: RouteCostTemplate | null): CostAmounts {
  if (!tpl) return emptyCosts();
  const a = emptyCosts();
  for (const c of COST_CATEGORIES) a[c.key] = tpl[c.key];
  return a;
}

export function TemplateDrawer({
  mode,
  template,
  onClose,
}: {
  mode: "create" | "edit";
  template?: RouteCostTemplate;
  onClose: () => void;
}) {
  const router = useRouter();
  const action =
    mode === "edit" && template
      ? updateTemplate.bind(null, template.id)
      : createTemplate;
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [amounts, setAmounts] = useState<CostAmounts>(() =>
    templateAmounts(template ?? null),
  );

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onClose();
    }
  }, [state.ok, router, onClose]);

  const total = useMemo(() => totalCost(amounts), [amounts]);

  const set = (k: CostCategoryKey, v: number | null) =>
    setAmounts((prev) => ({ ...prev, [k]: v != null && v >= 0 ? v : 0 }));

  const onDelete = () => {
    if (!template) return;
    setDeleteError(null);
    startDelete(async () => {
      const res = await softDeleteTemplate(template.id);
      if (res.error) {
        setDeleteError(res.error);
        return;
      }
      router.refresh();
      onClose();
    });
  };

  return (
    <DrawerShell
      title={mode === "edit" ? `Editar template · ${template?.name}` : "Nuevo template de ruta"}
      subtitle="Costos default por ruta + servicio · USD"
      onClose={onClose}
      pending={isPending || isDeleting}
      width={640}
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
          gap: 14,
        }}
      >
        {/* Identidad del template */}
        <div>
          <label className="studio-label" htmlFor="template-name">
            Nombre del template
          </label>
          <input
            id="template-name"
            name="name"
            className="studio-input"
            required
            defaultValue={template?.name ?? ""}
            placeholder="Yiwu → Puerto Cabello · Consolidación"
          />
          {state.fieldErrors?.name && <FieldError msg={state.fieldErrors.name} />}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <div>
            <label className="studio-label" htmlFor="template-origin">
              Origen
            </label>
            <input
              id="template-origin"
              name="origin"
              className="studio-input"
              defaultValue={template?.origin ?? ""}
              placeholder="YIW"
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="template-destination">
              Destino
            </label>
            <input
              id="template-destination"
              name="destination"
              className="studio-input"
              defaultValue={template?.destination ?? ""}
              placeholder="PBL"
            />
          </div>
        </div>

        <div>
          <label className="studio-label" htmlFor="template-service">
            Servicio
          </label>
          <select
            id="template-service"
            name="shipment_service"
            className="studio-input"
            defaultValue={template?.shipment_service ?? ""}
          >
            <option value="">— Cualquiera —</option>
            {SERVICE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {state.fieldErrors?.shipment_service && (
            <FieldError msg={state.fieldErrors.shipment_service} />
          )}
          <p
            style={{
              font: "500 11px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "6px 0 0",
            }}
          >
            La ruta debe coincidir (origen + destino + servicio) para prellenar
            un embarque nuevo.
          </p>
        </div>

        {/* Costo total en vivo */}
        <div
          style={{
            background: "var(--bg-sidebar)",
            borderRadius: "var(--r-lg)",
            padding: "var(--s-4) var(--s-5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              font: "700 10px/1 var(--f-sans)",
              color: "var(--ink-side-soft)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Costo total del template
          </span>
          <span style={{ font: "900 22px/1 var(--f-mono)", color: "var(--ink-side)" }}>
            {fmtUsd(total)}
          </span>
        </div>

        {/* 7 inputs de costo */}
        {COST_CATEGORIES.map((c) => (
          <div
            key={c.key}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 150px",
              gap: 14,
              alignItems: "start",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  aria-hidden
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: c.colorToken,
                    flexShrink: 0,
                  }}
                />
                <label
                  htmlFor={`tpl-${c.key}`}
                  style={{ font: "700 12.5px/1.2 var(--f-sans)", color: "var(--ink)" }}
                >
                  {c.label}
                </label>
              </div>
              <div
                style={{
                  font: "500 11px/1.4 var(--f-sans)",
                  color: "var(--ink-soft)",
                  marginTop: 3,
                  paddingLeft: 20,
                }}
              >
                {c.desc}
              </div>
            </div>
            <div>
              <NumericInput
                id={`tpl-${c.key}`}
                name={c.key}
                type="currency"
                currency="USD"
                min={0}
                placeholder="0"
                value={amounts[c.key]}
                onChange={(v) => set(c.key, v)}
              />
              {state.fieldErrors?.[c.key] && (
                <FieldError msg={state.fieldErrors[c.key] as string} />
              )}
            </div>
          </div>
        ))}

        {/* Activo */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            font: "600 12.5px/1.2 var(--f-sans)",
            color: "var(--ink)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            name="active"
            value="on"
            defaultChecked={template?.active ?? true}
          />
          Template activo (se usa para prellenar embarques nuevos)
        </label>

        {/* Notas */}
        <div>
          <label className="studio-label" htmlFor="template-notes">
            Notas
          </label>
          <textarea
            id="template-notes"
            name="notes"
            rows={2}
            className="studio-input"
            defaultValue={template?.notes ?? ""}
            placeholder="Vigente para naviera COSCO · revisar si sube el flete."
            style={{ resize: "vertical" }}
          />
        </div>

        {(state.error || deleteError) && (
          <p
            role="alert"
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--danger)",
              margin: 0,
              padding: "10px 12px",
              background: "var(--danger-bg)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--r-sm)",
            }}
          >
            {state.error ?? deleteError}
          </p>
        )}

        {/* Soft delete (solo edit) */}
        {mode === "edit" && (
          <div style={{ paddingTop: 4 }}>
            {confirmDelete ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ font: "600 12px/1.3 var(--f-sans)", color: "var(--danger)" }}>
                  ¿Borrar este template?
                </span>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isDeleting}
                  style={{
                    background: "var(--danger)",
                    color: "var(--ink-inv)",
                    border: 0,
                    borderRadius: "var(--r-sm)",
                    padding: "6px 12px",
                    font: "700 12px/1 var(--f-sans)",
                    cursor: "pointer",
                  }}
                >
                  {isDeleting ? "Borrando…" : "Sí, borrar"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    background: "transparent",
                    color: "var(--ink-soft)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-sm)",
                    padding: "6px 12px",
                    font: "600 12px/1 var(--f-sans)",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  background: "transparent",
                  color: "var(--danger)",
                  border: "1px solid var(--danger)",
                  borderRadius: "var(--r-sm)",
                  padding: "7px 12px",
                  font: "600 12px/1 var(--f-sans)",
                  cursor: "pointer",
                }}
              >
                {Icon.trash(13)}
                Borrar template
              </button>
            )}
          </div>
        )}
      </form>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit
        submitLabel={mode === "edit" ? "Guardar cambios" : "Crear template"}
        pendingLabel="Guardando…"
      />
    </DrawerShell>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p
      style={{
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--danger)",
        margin: "var(--s-1) 0 0",
      }}
    >
      {msg}
    </p>
  );
}
