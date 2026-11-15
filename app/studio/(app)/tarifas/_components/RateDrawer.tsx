"use client";

/**
 * RateDrawer — crear/editar tarifa (SDD-0008).
 *
 * Drawer lateral derecho 560px. Mode "create" o "edit" según props.
 * useActionState con createRate / updateRate.
 * Soft delete button en footer (solo mode edit) con doble confirmación inline.
 */

import {
  useActionState,
  useEffect,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { StatusIcon } from "@/components/StatusIcon";
import {
  RATE_SERVICE_OPTIONS,
  priceMode,
  rateStatusLabel,
  rateStatusTone,
  type Rate,
  type RateActionState,
} from "@/lib/studio/rate-types";
import type { ShipmentService } from "@/lib/studio/shipment-types";
import {
  archiveRateAction,
  createRate,
  publishRateAction,
  softDeleteRate,
  updateRate,
} from "../actions";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { SplitActionButton } from "@/app/studio/_components/ui/SplitActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

interface Props {
  mode: "create" | "edit";
  rate?: Rate;
  onClose: () => void;
  /**
   * Lista de precios en la que nace la tarifa (SDD-0269). Sin esto una tarifa
   * pactada con un aliado terminaría en la lista de la casa — o sea, en la
   * calculadora del sitio. Al editar no se toca: mover una tarifa de lista es
   * cambiarle el precio a un tercero.
   */
  priceBookId?: string | null;
  priceBookName?: string | null;
  priceBookEsCasa?: boolean;
  /**
   * SDD-0478: la ranura programada existe (migr 0459 aplicada). Sin ella la
   * opción no se muestra y el guardado no nombra la columna.
   */
  programacionDisponible?: boolean;
  /** La tarifa que se edita es hoy la programada. */
  programada?: boolean;
}

/**
 * Pública y programada se excluyen: marcar una desmarca la otra en el acto,
 * en vez de dejar que el founder descubra el choque al guardar. El servidor
 * lo vuelve a validar (validateRateInput) y la base también (check de 0459).
 */
function desmarcarOtra(e: ChangeEvent<HTMLInputElement>, otra: string) {
  if (!e.currentTarget.checked) return;
  const el = e.currentTarget.form?.elements.namedItem(otra);
  if (el instanceof HTMLInputElement) el.checked = false;
}

const initialState: RateActionState = {};

export function RateDrawer({
  mode,
  rate,
  onClose,
  priceBookId,
  priceBookName,
  priceBookEsCasa = true,
  programacionDisponible = false,
  programada = false,
}: Props) {
  // En una lista de aliado no se ofrece: la base lo rechazaría (sólo la casa
  // alimenta el sitio). Al editar no se conoce la lista y decide la base.
  const ofrecerProgramacion =
    programacionDisponible && (mode === "edit" || priceBookEsCasa);
  const action =
    mode === "edit" && rate
      ? updateRate.bind(null, rate.id)
      : createRate;
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [service, setService] = useState<ShipmentService>(
    rate?.service ?? "consolidado_lcl",
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
    setService("consolidado_lcl");
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
        "Revisa los campos.";
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
      toast.success("Tarifa creada · carga la siguiente", {
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
    <DrawerShell
      title={title}
      titleAccessory={
        mode === "edit" && rate ? (
          <Badge tone={rateStatusTone(rate.status)} size="sm">
            {rateStatusLabel(rate.status)}
          </Badge>
        ) : undefined
      }
      onClose={onClose}
      pending={isPending}
      width={560}
    >
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
          {mode === "create" && priceBookId && (
            <input type="hidden" name="price_book_id" value={priceBookId} />
          )}
          {mode === "create" && priceBookId && !priceBookEsCasa && (
            <Aviso tono="info" compacto>
              Esta tarifa entra en <b>{priceBookName}</b> — sólo la ven sus
              clientes. No sale en la calculadora del sitio.
            </Aviso>
          )}
          {/* Servicio */}
          <div>
            <label className="studio-label" htmlFor="service">
              Servicio <span style={{ color: "var(--wine-text)" }}>*</span>
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
                Origen <span style={{ color: "var(--wine-text)" }}>*</span>
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
                Destino <span style={{ color: "var(--wine-text)" }}>*</span>
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
                Tarifa por CBM (USD) <span style={{ color: "var(--wine-text)" }}>*</span>
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
                <span style={{ color: "var(--wine-text)" }}>*</span>
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

          {/* Vigencia: desde / hasta */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <div>
              <label className="studio-label" htmlFor="valid_from">
                Válida desde
              </label>
              <input
                id="valid_from"
                name="valid_from"
                type="date"
                className="studio-input"
                defaultValue={rate?.valid_from ?? ""}
              />
              {state.fieldErrors?.valid_from && (
                <FieldError msg={state.fieldErrors.valid_from} />
              )}
            </div>
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
          </div>

          {/* Tarifa pública del calculador · solo aplica a tarifas per_cbm (LCL) */}
          {mode$ === "per_cbm" && (
            <label
              htmlFor="is_public"
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
                id="is_public"
                name="is_public"
                type="checkbox"
                className="studio-checkbox"
                defaultChecked={rate?.is_public ?? false}
                onChange={
                  ofrecerProgramacion
                    ? (e) => desmarcarOtra(e, "publica_programada")
                    : undefined
                }
                style={{
                  marginTop: 2,
                  width: 16,
                  height: 16,
                  accentColor: "var(--wine)",
                  cursor: "pointer",
                }}
              />
              <span
                style={{ display: "flex", flexDirection: "column", gap: 2 }}
              >
                <span
                  style={{ font: "600 13px/1.3 var(--f-sans)", color: "var(--ink)" }}
                >
                  Tarifa pública del calculador
                </span>
                <span
                  style={{
                    font: "400 12px/1.4 var(--f-sans)",
                    color: "var(--ink-soft)",
                  }}
                >
                  El calculador del sitio muestra esta tarifa por CBM y su
                  mínimo. Solo una tarifa puede ser la pública.
                </span>
              </span>
            </label>
          )}

          {/* SDD-0478 · la próxima pública, cargada antes de su día */}
          {mode$ === "per_cbm" && ofrecerProgramacion && (
            <div>
              <input type="hidden" name="publica_programada_control" value="1" />
              <label
                htmlFor="publica_programada"
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
                  id="publica_programada"
                  name="publica_programada"
                  type="checkbox"
                  className="studio-checkbox"
                  defaultChecked={programada}
                  onChange={(e) => desmarcarOtra(e, "is_public")}
                  aria-describedby="publica_programada_ayuda"
                  style={{
                    marginTop: 2,
                    width: 16,
                    height: 16,
                    accentColor: "var(--wine)",
                    cursor: "pointer",
                  }}
                />
                <span
                  style={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  <span
                    style={{ font: "600 13px/1.3 var(--f-sans)", color: "var(--ink)" }}
                  >
                    Programada: reemplaza a la pública en su fecha
                  </span>
                  <span
                    id="publica_programada_ayuda"
                    style={{
                      font: "400 12px/1.4 var(--f-sans)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    Entra sola el día de «Válida desde», a las 00:05 de
                    Venezuela, y reemplaza a la pública actual. Hasta ese día
                    el sitio sigue cotizando con la actual.
                  </span>
                </span>
              </label>
              {state.fieldErrors?.publica_programada && (
                <FieldError msg={state.fieldErrors.publica_programada} />
              )}
            </div>
          )}

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
          {(state.error || createError) && (
            <Aviso tono="error" compacto>
              {state.error ?? createError}
            </Aviso>
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
          {/* Left: lifecycle (publicar/archivar) + soft delete, solo en edit */}
          <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            {mode === "edit" && rate && rate.status === "draft" && (
              <ActionButton
                variant="primary"
                size="sm"
                idleLabel="Publicar"
                loadingLabel="Publicando…"
                successLabel="Publicada"
                successIcon={Icon.check(13)}
                onAction={() => publishRateAction(rate.id)}
                onError={setCreateError}
                onSuccess={() => {
                  toast.success("Tarifa publicada");
                  onClose();
                }}
              />
            )}
            {mode === "edit" && rate && rate.status !== "archived" && (
              <ActionButton
                variant="ghost"
                size="sm"
                idleLabel="Archivar"
                loadingLabel="Archivando…"
                successLabel={null}
                onAction={() => archiveRateAction(rate.id)}
                onError={setCreateError}
                onSuccess={() => {
                  toast.success("Tarifa archivada");
                  onClose();
                }}
              />
            )}
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
                  style={{ color: "var(--danger-text)" }}
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
    </DrawerShell>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p
      style={{
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--ink)",
        margin: "var(--s-1) 0 0",
      }}
    >
      <StatusIcon tone="danger" style={{ color: "var(--danger-text)", display: "inline", marginRight: "var(--s-1)" }} />
      {msg}
    </p>
  );
}
