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

import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
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
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";

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
  const [casco, setCasco] = useState(city?.casco ?? false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // En create, autocompletar el slug desde el label mientras no lo editen a mano.
  const derivedSlug = slugTouched ? slug : slugify(label);

  useEffect(() => {
    if (state.ok) {
      toast.success(mode === "create" ? "Ciudad creada" : "Ciudad actualizada");
      router.refresh();
      // Al crear, resaltar la row nueva en la lista de ciudades (tono warm).
      if (mode === "create" && state.createdId) {
        router.push(
          `/studio/admin?section=calculadora&tab=ciudades&highlight=${encodeURIComponent(state.createdId)}&hl-tone=warm`,
        );
      }
      onClose();
    }
  }, [state.ok, state.createdId, mode, onClose, toast, router]);

  // Depende de `isPending` y no de `state.error`: un segundo error con el mismo
  // texto no lo cambia, y el botón deshabilitado ya soltó el foco fuera del panel.
  useEffect(() => {
    if (!isPending && state.error) errorRef.current?.focus();
  }, [state, isPending]);

  const title = mode === "create" ? "Nueva ciudad" : "Editar ciudad";

  return (
    <DrawerShell
      title={title}
      onClose={onClose}
      pending={isPending}
      width={480}
    >
        <form
          id="city-drawer-form"
          aria-busy={isPending}
          onSubmit={(event) => {
            event.preventDefault();
            if (isPending) return;
            // El dispatch manual evita que React borre el borrador ante un error.
            const formData = new FormData(event.currentTarget);
            startTransition(() => formAction(formData));
          }}
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
              Nombre <span style={{ color: "var(--wine-text)" }}>*</span>
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
              aria-invalid={state.fieldErrors?.label ? true : undefined}
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
              aria-invalid={state.fieldErrors?.slug ? true : undefined}
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
                Km desde Valencia <span style={{ color: "var(--wine-text)" }}>*</span>
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
                aria-invalid={state.fieldErrors?.km ? true : undefined}
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
                aria-invalid={state.fieldErrors?.sort_order ? true : undefined}
              />
              {state.fieldErrors?.sort_order && (
                <FieldError msg={state.fieldErrors.sort_order} />
              )}
            </div>
          </div>

          {/* Inclusión de la entrega · control original de la ciudad. */}
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
              checked={casco}
              onChange={(event) => setCasco(event.target.checked)}
              disabled={isPending}
              aria-labelledby="casco-label"
              aria-describedby="casco-description"
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
                id="casco-label"
                style={{ font: "600 13px/1.3 var(--f-sans)", color: "var(--ink)" }}
              >
                Entrega incluida, sin costo adicional
              </span>
              <span
                id="casco-description"
                style={{
                  font: "400 12px/1.4 var(--f-sans)",
                  color: "var(--ink-soft)",
                }}
              >
                Si está marcada, el cliente no paga recargo de entrega en esta
                ciudad. Si la desmarcas, se aplica la tarifa de entrega vigente.
              </span>
            </span>
          </label>

          {(state.error || deleteError) && (
            <p
              ref={errorRef}
              role="alert"
              tabIndex={-1}
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--ink)",
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
    </DrawerShell>
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
