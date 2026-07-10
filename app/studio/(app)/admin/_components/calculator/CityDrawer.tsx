"use client";

/**
 * CityDrawer — crear/editar una ciudad del calculador (Administración ·
 * sección Calculadora pública). Movido desde el módulo Tarifas.
 *
 * Drawer lateral derecho. Mode "create" o "edit". useActionState con
 * createCityAction / updateCityAction. Soft delete en footer (solo edit).
 * Admin-only: la sección Administración ya exige rol admin, y las actions +
 * la RLS lo refuerzan.
 */

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  slugify,
  type CalculatorCity,
  type CalculatorCityActionState,
} from "@/lib/studio/calculator-cities-types";
import {
  createCityAction,
  deleteCityAction,
  updateCityAction,
} from "../../calculator-actions";
import { Icon } from "@/app/studio/_components/icons";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";

interface Props {
  mode: "create" | "edit";
  city?: CalculatorCity;
  onClose: () => void;
}

const initialState: CalculatorCityActionState = {};

export function CityDrawer({ mode, city, onClose }: Props) {
  const action =
    mode === "edit" && city
      ? updateCityAction.bind(null, city.id)
      : createCityAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  const toast = useToast();
  const router = useRouter();
  const [label, setLabel] = useState(city?.label ?? "");
  const [slug, setSlug] = useState(city?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // En create, autocompletar el slug desde el label mientras no lo editen a mano.
  const derivedSlug = slugTouched ? slug : slugify(label);

  useEffect(() => {
    if (state.ok) {
      toast.success(mode === "create" ? "Ciudad creada" : "Ciudad actualizada");
      // Al crear, resaltar la row nueva en la lista de ciudades (tono warm).
      if (mode === "create" && state.createdId) {
        router.push(
          `/studio/admin?section=calculadora&tab=ciudades&highlight=${encodeURIComponent(state.createdId)}&hl-tone=warm`,
        );
      }
      onClose();
    }
  }, [state.ok, state.createdId, mode, onClose, toast, router]);

  const title = mode === "create" ? "Nueva ciudad" : "Editar ciudad";

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="city-drawer-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(480px, 96vw)",
          height: "100vh",
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-pop)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
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
            id="city-drawer-title"
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
            }}
          >
            {Icon.close(14)}
          </button>
        </header>

        <form
          id="city-drawer-form"
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
          {/* Nombre visible */}
          <div>
            <label className="studio-label" htmlFor="label">
              Nombre <span style={{ color: "var(--wine)" }}>*</span>
            </label>
            <input
              id="label"
              name="label"
              type="text"
              className="studio-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Barquisimeto"
              required
            />
            {state.fieldErrors?.label && (
              <FieldError msg={state.fieldErrors.label} />
            )}
          </div>

          {/* Slug (identificador interno) */}
          <div>
            <label className="studio-label" htmlFor="slug">
              Identificador (slug)
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              className="studio-input"
              value={derivedSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="barquisimeto"
              style={{ fontFamily: "var(--f-mono)" }}
            />
            <p
              style={{
                font: "400 11.5px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: "4px 0 0",
              }}
            >
              Solo minúsculas, números y guiones. Se autocompleta desde el nombre.
            </p>
            {state.fieldErrors?.slug && (
              <FieldError msg={state.fieldErrors.slug} />
            )}
          </div>

          {/* Km + Orden */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)" }}
          >
            <div>
              <label className="studio-label" htmlFor="km">
                Km desde Valencia <span style={{ color: "var(--wine)" }}>*</span>
              </label>
              <NumericInput
                id="km"
                name="km"
                type="count"
                unit="km"
                min={0}
                required
                placeholder="220"
                defaultValue={city?.km ?? null}
              />
              {state.fieldErrors?.km && <FieldError msg={state.fieldErrors.km} />}
            </div>
            <div>
              <label className="studio-label" htmlFor="sort_order">
                Orden
              </label>
              <input
                id="sort_order"
                name="sort_order"
                type="number"
                min={0}
                step={1}
                className="studio-input"
                defaultValue={city?.sort_order ?? 0}
                placeholder="0"
              />
              {state.fieldErrors?.sort_order && (
                <FieldError msg={state.fieldErrors.sort_order} />
              )}
            </div>
          </div>

          {/* Casco central */}
          <label
            htmlFor="casco"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "12px 14px",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
              background: "var(--bg-elevated)",
              cursor: "pointer",
            }}
          >
            <input
              id="casco"
              name="casco"
              type="checkbox"
              className="studio-checkbox"
              defaultChecked={city?.casco ?? false}
              style={{
                marginTop: 2,
                width: 16,
                height: 16,
                accentColor: "var(--wine)",
                cursor: "pointer",
              }}
            />
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span
                style={{ font: "600 13px/1.3 var(--f-sans)", color: "var(--ink)" }}
              >
                Casco central
              </span>
              <span
                style={{
                  font: "400 12px/1.4 var(--f-sans)",
                  color: "var(--ink-soft)",
                }}
              >
                Entrega flat sin recargo por distancia (Valencia, Maracay,
                Caracas).
              </span>
            </span>
          </label>

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

          <div style={{ flex: 1, minHeight: 12 }} />
        </form>

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
          <div>
            {mode === "edit" && city && (
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
                      setDeleteError(null);
                      startDelete(async () => {
                        const result = await deleteCityAction(city.id);
                        if (result.ok) {
                          toast.success("Ciudad eliminada");
                          onClose();
                        } else {
                          setDeleteError(result.error ?? "No se pudo eliminar.");
                          setConfirmDelete(false);
                        }
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

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="studio-btn studio-btn-ghost"
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="city-drawer-form"
              className="studio-btn studio-btn-primary"
              disabled={isPending}
            >
              {isPending
                ? "Guardando…"
                : mode === "create"
                  ? "Crear ciudad"
                  : "Guardar cambios"}
            </button>
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
