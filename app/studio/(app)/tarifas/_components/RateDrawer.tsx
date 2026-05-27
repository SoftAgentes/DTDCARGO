"use client";

/**
 * RateDrawer — crear/editar tarifa (SDD-0008).
 *
 * Drawer lateral derecho 560px. Mode "create" o "edit" según props.
 * useActionState con createRate / updateRate.
 * Soft delete button en footer (solo mode edit) con doble confirmación inline.
 */

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RATE_SERVICE_OPTIONS,
  priceMode,
  type Rate,
  type RateActionState,
} from "@/lib/studio/rate-types";
import type { ShipmentService } from "@/lib/studio/shipment-types";
import { createRate, softDeleteRate, updateRate } from "../actions";
import { Icon } from "@/app/studio/_components/icons";
import { SplitActionButton } from "@/app/studio/_components/ui/SplitActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";

interface Props {
  mode: "create" | "edit";
  rate?: Rate;
  onClose: () => void;
}

const initialState: RateActionState = {};

export function RateDrawer({ mode, rate, onClose }: Props) {
  const action =
    mode === "edit" && rate
      ? updateRate.bind(null, rate.id)
      : createRate;
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [service, setService] = useState<ShipmentService>(
    rate?.service ?? "consolidacion",
  );
  const mode$ = priceMode(service);

  // Confirmar delete inline
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  const router = useRouter();
  const toast = useToast();
  const [createError, setCreateError] = useState<string | null>(null);

  // Auto-cerrar drawer on success (modo edit · create maneja close via SplitActionButton)
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  /** Reset de campos controlados para "Crear y empezar otra". */
  const resetFormFields = () => {
    const formEl = document.getElementById(
      "rate-drawer-form",
    ) as HTMLFormElement | null;
    formEl?.reset();
    setService("consolidacion");
  };

  /**
   * Crea tarifa llamando createRate directo + ejecuta el comportamiento
   * `postAction`. Las tarifas no tienen detail page · solo 2 opciones
   * útiles (cerrar y empezar otra).
   */
  const createWithPostAction = async (
    postAction: "close" | "reset",
  ): Promise<void | { error?: string }> => {
    setCreateError(null);
    const formEl = document.getElementById(
      "rate-drawer-form",
    ) as HTMLFormElement | null;
    if (!formEl) return { error: "No se encontró el formulario." };
    if (!formEl.checkValidity()) {
      formEl.reportValidity();
      return { error: "Hay campos requeridos sin completar." };
    }
    const formData = new FormData(formEl);
    const result = await createRate({} as RateActionState, formData);
    if (result.error) {
      setCreateError(result.error);
      return { error: result.error };
    }
    if (result.fieldErrors) {
      const firstErr =
        Object.values(result.fieldErrors).find((v) => !!v) ??
        "Revisá los campos.";
      setCreateError(firstErr);
      return { error: firstErr };
    }
    if (!result.ok || !result.createdId) {
      const m = "No se pudo crear la tarifa.";
      setCreateError(m);
      return { error: m };
    }
    const id = result.createdId;
    if (postAction === "close") {
      toast.success("Tarifa creada");
      router.push(
        `/studio/tarifas?highlight=${encodeURIComponent(id)}&hl-tone=warm`,
      );
      onClose();
    } else if (postAction === "reset") {
      toast.success("Tarifa creada · cargá la siguiente", {
        link: {
          href: `/studio/tarifas?highlight=${encodeURIComponent(id)}&hl-tone=warm`,
          label: "Ver en listado",
        },
      });
      resetFormFields();
    }
    return undefined;
  };

  const title = mode === "create" ? "Nueva tarifa" : "Editar tarifa";

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-drawer-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 30, 61, 0.55)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 96vw)",
          height: "100vh",
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-pop)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <h2
            id="rate-drawer-title"
            className="studio-display"
            style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-soft)",
              background: "transparent",
              cursor: "pointer",
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-elevated)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {Icon.close(14)}
          </button>
        </header>

        <form
          id="rate-drawer-form"
          action={mode === "edit" ? formAction : undefined}
          onSubmit={
            mode === "create" ? (e) => e.preventDefault() : undefined
          }
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Servicio */}
          <div>
            <label className="studio-label" htmlFor="service">
              Servicio <span style={{ color: "var(--wine)" }}>*</span>
            </label>
            <select
              id="service"
              name="service"
              className="studio-input"
              value={service}
              onChange={(e) => setService(e.target.value as ShipmentService)}
              required
            >
              {RATE_SERVICE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {state.fieldErrors?.service && (
              <FieldError msg={state.fieldErrors.service} />
            )}
          </div>

          {/* Origen + Destino */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <div>
              <label className="studio-label" htmlFor="origin">
                Origen <span style={{ color: "var(--wine)" }}>*</span>
              </label>
              <input
                id="origin"
                name="origin"
                type="text"
                className="studio-input"
                defaultValue={rate?.origin ?? ""}
                placeholder="Yiwu, Guangzhou…"
                required
              />
              {state.fieldErrors?.origin && (
                <FieldError msg={state.fieldErrors.origin} />
              )}
            </div>
            <div>
              <label className="studio-label" htmlFor="destination">
                Destino <span style={{ color: "var(--wine)" }}>*</span>
              </label>
              <input
                id="destination"
                name="destination"
                type="text"
                className="studio-input"
                defaultValue={rate?.destination ?? ""}
                placeholder="Valencia, La Guaira…"
                required
              />
              {state.fieldErrors?.destination && (
                <FieldError msg={state.fieldErrors.destination} />
              )}
            </div>
          </div>

          {/* Precio: per_cbm O flat_rate según servicio */}
          {mode$ === "per_cbm" ? (
            <div>
              <label className="studio-label" htmlFor="per_cbm">
                Tarifa por CBM (USD) <span style={{ color: "var(--wine)" }}>*</span>
              </label>
              <NumericInput
                id="per_cbm"
                name="per_cbm"
                type="currency"
                currency="USD"
                required
                min={0}
                placeholder="480.00"
                defaultValue={rate?.per_cbm ?? null}
              />
              <input
                type="hidden"
                name="flat_rate"
                defaultValue={rate?.flat_rate ?? ""}
              />
              {state.fieldErrors?.per_cbm && (
                <FieldError msg={state.fieldErrors.per_cbm} />
              )}
            </div>
          ) : (
            <div>
              <label className="studio-label" htmlFor="flat_rate">
                Tarifa flat por contenedor (USD){" "}
                <span style={{ color: "var(--wine)" }}>*</span>
              </label>
              <NumericInput
                id="flat_rate"
                name="flat_rate"
                type="currency"
                currency="USD"
                required
                min={0}
                placeholder="8500.00"
                defaultValue={rate?.flat_rate ?? null}
              />
              <input
                type="hidden"
                name="per_cbm"
                defaultValue={rate?.per_cbm ?? ""}
              />
              {state.fieldErrors?.flat_rate && (
                <FieldError msg={state.fieldErrors.flat_rate} />
              )}
            </div>
          )}

          {/* Min charge + Tránsito */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <div>
              <label className="studio-label" htmlFor="min_charge">
                Min charge (USD)
              </label>
              <NumericInput
                id="min_charge"
                name="min_charge"
                type="currency"
                currency="USD"
                min={0}
                placeholder="380.00"
                defaultValue={rate?.min_charge ?? null}
              />
              {state.fieldErrors?.min_charge && (
                <FieldError msg={state.fieldErrors.min_charge} />
              )}
            </div>
            <div>
              <label className="studio-label" htmlFor="transit_days">
                Días de tránsito
              </label>
              <NumericInput
                id="transit_days"
                name="transit_days"
                type="count"
                unit="días"
                min={0}
                placeholder="38"
                defaultValue={rate?.transit_days ?? null}
              />
              {state.fieldErrors?.transit_days && (
                <FieldError msg={state.fieldErrors.transit_days} />
              )}
            </div>
          </div>

          {/* Vigencia */}
          <div>
            <label className="studio-label" htmlFor="valid_until">
              Válida hasta
            </label>
            <input
              id="valid_until"
              name="valid_until"
              type="date"
              className="studio-input"
              defaultValue={rate?.valid_until ?? ""}
            />
            {state.fieldErrors?.valid_until && (
              <FieldError msg={state.fieldErrors.valid_until} />
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="studio-label" htmlFor="notes">
              Notas
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="studio-input"
              defaultValue={rate?.notes ?? ""}
              placeholder="Detalles del contrato, agente, condiciones especiales…"
              style={{ resize: "vertical" }}
            />
          </div>

          {/* Error general */}
          {state.error && (
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
              {state.error}
            </p>
          )}

          {/* Spacer para que el footer no quede pegado */}
          <div style={{ flex: 1, minHeight: 12 }} />
        </form>

        {/* Footer pegado abajo */}
        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          {/* Left: soft delete solo en mode edit */}
          <div>
            {mode === "edit" && rate && (
              confirmDelete ? (
                <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <span
                    style={{
                      font: "500 12px/1 var(--f-sans)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    ¿Seguro?
                  </span>
                  <button
                    type="button"
                    className="studio-btn studio-btn-danger studio-btn-sm"
                    disabled={isDeleting}
                    onClick={() => {
                      startDelete(async () => {
                        const result = await softDeleteRate(rate.id);
                        if (result.ok) onClose();
                      });
                    }}
                  >
                    {isDeleting ? "Eliminando…" : "Sí, eliminar"}
                  </button>
                  <button
                    type="button"
                    className="studio-btn studio-btn-ghost studio-btn-sm"
                    onClick={() => setConfirmDelete(false)}
                    disabled={isDeleting}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  style={{ color: "var(--danger)" }}
                  onClick={() => setConfirmDelete(true)}
                >
                  Eliminar
                </button>
              )
            )}
          </div>

          {/* Right: cancelar + submit */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="studio-btn studio-btn-ghost"
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </button>
            {mode === "create" ? (
              <SplitActionButton
                memoryKey="rate-drawer-create"
                variant="primary"
                size="default"
                disabled={isPending}
                onError={setCreateError}
                actions={[
                  {
                    key: "create-and-close",
                    idleLabel: "Crear y cerrar",
                    loadingLabel: "Creando…",
                    successLabel: "Tarifa creada",
                    successIcon: Icon.check(14),
                    description:
                      "Crea la tarifa y vuelve al listado con la nueva resaltada.",
                    onAction: () => createWithPostAction("close"),
                  },
                  {
                    key: "create-and-new",
                    idleLabel: "Crear y empezar otra",
                    loadingLabel: "Creando…",
                    successLabel: "Lista la siguiente",
                    successIcon: Icon.check(14),
                    description:
                      "Crea la tarifa, limpia los campos y deja el drawer abierto para cargar el catálogo trimestral.",
                    onAction: () => createWithPostAction("reset"),
                  },
                ]}
              />
            ) : (
              <button
                type="submit"
                form="rate-drawer-form"
                className="studio-btn studio-btn-primary"
                disabled={isPending}
              >
                {isPending ? "Guardando…" : "Guardar cambios"}
              </button>
            )}
          </div>
        </footer>
      </aside>
    </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p
      style={{
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--danger)",
        margin: "4px 0 0",
      }}
    >
      {msg}
    </p>
  );
}
