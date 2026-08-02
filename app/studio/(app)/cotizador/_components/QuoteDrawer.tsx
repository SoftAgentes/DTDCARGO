"use client";

/**
 * QuoteDrawer — calculator + form para crear/editar un estimado (SDD-0011).
 *
 * - Cards de servicio (LCL/FCL) que cambian el modo del calculator
 * - Cliente: MARKBOX + nombre con lookup blando (warning si no está en catálogo)
 * - Origen + Destino con sugerencia automática del rate
 * - CBM / peso / cajas
 * - Packaging radio con extra cost
 * - Rate input (override del sugerido)
 * - Total card navy LIVE — se actualiza al typear
 * - Soft delete en footer (mode edit con doble confirmación)
 */

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PACKAGING_OPTIONS,
  calcQuoteTotal,
  quotePriceMode,
  type Quote,
  type QuoteActionState,
} from "@/lib/studio/quote-types";
import {
  SERVICE_LABELS,
  type ShipmentService,
} from "@/lib/studio/shipment-types";
import {
  createQuote,
  lookupSuggestedRate,
  softDeleteQuote,
  updateQuote,
} from "../actions";
import type { Rate } from "@/lib/studio/rate-types";
import { Icon } from "@/app/studio/_components/icons";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { SplitActionButton } from "@/app/studio/_components/ui/SplitActionButton";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { ClientCombobox } from "@/app/studio/_components/ui/ClientCombobox";
import type { ClientSearchHit } from "@/lib/studio/client-search-action";

interface Props {
  mode: "create" | "edit";
  quote?: Quote;
  onClose: () => void;
  /** Si mode=edit, optional callback con el code para redirect post-success. */
  onSuccess?: () => void;
}

const initialState: QuoteActionState = {};
const DEFAULT_VALID_UNTIL = new Date(Date.now() + 30 * 24 * 3600 * 1000)
  .toISOString()
  .slice(0, 10);

const SERVICE_CARDS: { value: ShipmentService; label: string; hint: string }[] = [
  { value: "consolidado_lcl", label: "Consolidación LCL", hint: "$/CBM" },
  { value: "puerta_a_puerta_DDP", label: "Puerta a Puerta DDP", hint: "$/CBM prepago" },
  { value: "fcl_directo", label: "Reserva FCL", hint: "tarifa flat" },
  { value: "transporte_terrestre", label: "Transporte terrestre", hint: "VE flat" },
];

export function QuoteDrawer({ mode, quote, onClose }: Props) {
  const router = useRouter();
  const toast = useToast();
  const action =
    mode === "edit" && quote
      ? updateQuote.bind(null, quote.id)
      : createQuote;
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [service, setService] = useState<ShipmentService>(
    quote?.service ?? "consolidado_lcl",
  );
  const [clientMarkbox, setClientMarkbox] = useState(quote?.client_markbox ?? "");
  const [clientName, setClientName] = useState(quote?.client_name ?? "");
  const [origin, setOrigin] = useState(quote?.origin ?? "");
  const [destination, setDestination] = useState(quote?.destination ?? "");
  const [cbm, setCbm] = useState<string>(quote?.cbm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState<string>(quote?.weight_kg?.toString() ?? "");
  const [boxes, setBoxes] = useState<string>(quote?.boxes?.toString() ?? "");
  const [packaging, setPackaging] = useState(quote?.packaging ?? "carton");
  const [ratePerCbm, setRatePerCbm] = useState<string>(
    quote?.rate_per_cbm?.toString() ?? "",
  );
  const [flatRate, setFlatRate] = useState<string>(
    quote?.flat_rate?.toString() ?? "",
  );
  const [rateUsedId, setRateUsedId] = useState<string>(quote?.rate_used_id ?? "");
  const [validUntil, setValidUntil] = useState(
    quote?.valid_until ?? DEFAULT_VALID_UNTIL,
  );
  const [notes, setNotes] = useState(quote?.notes ?? "");

  const [suggestedRate, setSuggestedRate] = useState<Rate | null>(null);
  const [lookupPending, setLookupPending] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  // Error local para el SplitActionButton (modo create) · el useActionState
  // legacy seguía manejando errores via state.error.
  const [createError, setCreateError] = useState<string | null>(null);

  const mode$ = quotePriceMode(service);

  /**
   * Reset de todos los campos del form a sus valores default. Usado por la
   * acción "Crear y empezar otra" del SplitActionButton.
   */
  const resetFormFields = () => {
    setService("consolidado_lcl");
    setClientMarkbox("");
    setClientName("");
    setOrigin("");
    setDestination("");
    setCbm("");
    setWeightKg("");
    setBoxes("");
    setPackaging("carton");
    setRatePerCbm("");
    setFlatRate("");
    setRateUsedId("");
    setValidUntil(
      new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    );
    setNotes("");
    setSuggestedRate(null);
  };

  /**
   * Crea un estimado llamando createQuote directamente (sin useActionState)
   * y ejecuta el comportamiento `postAction` según la opción elegida en el
   * SplitActionButton:
   *
   *   - "close"  → navega al listado con highlight + cierra drawer
   *   - "open"   → navega al detail de la nueva quote + cierra drawer
   *   - "reset"  → limpia el form, drawer queda abierto (batch rápido)
   *
   * Retorna `{ error }` para el contrato de SplitActionButton.onAction.
   */
  const createWithPostAction = async (
    postAction: "close" | "open" | "reset",
  ): Promise<void | { error?: string }> => {
    setCreateError(null);
    const formEl = document.getElementById(
      "quote-drawer-form",
    ) as HTMLFormElement | null;
    if (!formEl) return { error: "No se encontró el formulario." };
    if (!formEl.checkValidity()) {
      formEl.reportValidity();
      return { error: "Hay campos requeridos sin completar." };
    }
    const formData = new FormData(formEl);
    const result = await createQuote({} as QuoteActionState, formData);
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
    if (!result.ok || !result.createdCode) {
      const m = "No se pudo crear el estimado.";
      setCreateError(m);
      return { error: m };
    }
    const code = result.createdCode;
    if (postAction === "close") {
      toast.success(`Estimado ${code} creado`, {
        link: {
          href: `/studio/cotizador/${code}`,
          label: "Abrir detalle",
        },
      });
      router.push(
        `/studio/cotizador?highlight=${encodeURIComponent(code)}&hl-tone=warm`,
      );
      onClose();
    } else if (postAction === "open") {
      toast.success(`Estimado ${code} creado · abriendo detalle`);
      router.push(`/studio/cotizador/${code}`);
      onClose();
    } else if (postAction === "reset") {
      toast.success(`Estimado ${code} creado · empieza el siguiente`, {
        link: {
          href: `/studio/cotizador?highlight=${encodeURIComponent(code)}&hl-tone=warm`,
          label: "Ver en listado",
        },
      });
      resetFormFields();
    }
    return undefined;
  };

  useEffect(() => {
    if (!state.ok) return;
    // Trazabilidad visual · cuando se CREA, navegamos al listado con
    // ?highlight=<code> y disparamos toast. Cuando se EDITA, mostramos
    // un toast más suave sin navegación (el detail page revalida sola).
    if (mode === "create" && state.createdCode) {
      const code = state.createdCode;
      toast.success(`Estimado ${code} creado`, {
        link: {
          href: `/studio/cotizador/${code}`,
          label: "Abrir detalle",
        },
      });
      // tone=warm porque la entidad es NUEVA en el listado · regla 1 del
      // principio "Trazabilidad visual".
      router.push(
        `/studio/cotizador?highlight=${encodeURIComponent(code)}&hl-tone=warm`,
      );
    } else if (mode === "edit" && quote) {
      toast.success(`Estimado ${quote.quote_code} actualizado`);
    }
    onClose();
  }, [state.ok, state.createdCode, mode, quote, router, toast, onClose]);

  // Lookup automático de rate al cambiar destino
  useEffect(() => {
    if (!destination.trim()) return;
    const t = setTimeout(async () => {
      setLookupPending(true);
      try {
        const { rate } = await lookupSuggestedRate(service, destination);
        setSuggestedRate(rate);
      } finally {
        setLookupPending(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [destination, service]);

  // Cálculo live del total
  const totals = calcQuoteTotal({
    service,
    cbm: cbm ? Number(cbm) : null,
    ratePerCbm: ratePerCbm ? Number(ratePerCbm) : null,
    flatRate: flatRate ? Number(flatRate) : null,
    packaging,
  });

  const applySuggestion = () => {
    if (!suggestedRate) return;
    setRateUsedId(suggestedRate.id);
    if (mode$ === "per_cbm" && suggestedRate.per_cbm != null) {
      setRatePerCbm(String(suggestedRate.per_cbm));
    }
    if (mode$ === "flat_rate" && suggestedRate.flat_rate != null) {
      setFlatRate(String(suggestedRate.flat_rate));
    }
    if (!origin && suggestedRate.origin) setOrigin(suggestedRate.origin);
  };

  const title = mode === "create" ? "Nuevo estimado" : "Editar estimado";

  return (
    <div
      onClick={() => !isPending && !isDeleting && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quote-drawer-title"
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
          width: "min(680px, 96vw)",
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
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <h2
              id="quote-drawer-title"
              className="studio-display"
              style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
            >
              {title}
            </h2>
            {mode === "edit" && quote && (
              <div
                style={{
                  font: "700 11.5px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.02em",
                }}
              >
                {quote.quote_code}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending || isDeleting}
            aria-label="Cerrar"
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-soft)",
              background: "transparent",
              cursor: isPending || isDeleting ? "wait" : "pointer",
              flexShrink: 0,
            }}
          >
            {Icon.close(14)}
          </button>
        </header>

        <form
          id="quote-drawer-form"
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
            gap: 16,
          }}
        >
          {/* Hidden inputs para el server */}
          <input type="hidden" name="service" value={service} />
          <input type="hidden" name="packaging" value={packaging} />
          <input type="hidden" name="rate_used_id" value={rateUsedId} />

          {/* Servicio cards */}
          <div>
            <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
              Servicio
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 8,
              }}
            >
              {SERVICE_CARDS.map((s) => {
                const active = service === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setService(s.value)}
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      background: active ? "var(--wine-tint)" : "var(--bg-surface)",
                      border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
                      borderRadius: "var(--r-md)",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        font: "700 12.5px/1.2 var(--f-sans)",
                        color: active ? "var(--wine)" : "var(--ink)",
                      }}
                    >
                      {SERVICE_LABELS[s.value].primary}
                    </div>
                    <div
                      style={{
                        font: "600 11px/1.3 var(--f-mono)",
                        color: active ? "var(--wine)" : "var(--ink-soft)",
                        marginTop: 4,
                      }}
                    >
                      {s.hint}
                    </div>
                  </button>
                );
              })}
            </div>
            {state.fieldErrors?.service && (
              <FieldError msg={state.fieldErrors.service} />
            )}
          </div>

          {/* Cliente: combobox cédula-first (SDD-0108) + Shipping Mark.
              El combobox busca por cédula/nombre/Shipping Mark; al elegir
              autocompleta nombre + markbox. Si el cliente aún no existe, el
              operador tipea libre (fallback manual) y completa el markbox. */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="qd-clname">
                Cliente <span style={{ color: "var(--wine-text)" }}>*</span>
              </label>
              <ClientCombobox
                id="qd-clname"
                value={clientName}
                onManualChange={(text) => setClientName(text)}
                onSelect={(c: ClientSearchHit) => {
                  setClientName(c.name);
                  setClientMarkbox(c.markbox);
                }}
                placeholder="Cédula, nombre o Shipping Mark…"
                required
              />
              {/* El nombre viaja en el form vía hidden (el input visible es el combobox). */}
              <input type="hidden" name="client_name" value={clientName} />
              {state.fieldErrors?.client_name && (
                <FieldError msg={state.fieldErrors.client_name} />
              )}
            </div>
            <div>
              <label className="studio-label" htmlFor="qd-markbox">
                Shipping Mark <span style={{ color: "var(--wine-text)" }}>*</span>
              </label>
              <input
                id="qd-markbox"
                name="client_markbox"
                type="text"
                className="studio-input studio-input-mono"
                value={clientMarkbox}
                onChange={(e) => setClientMarkbox(e.target.value)}
                placeholder="DTD-1001"
                required
              />
              {state.fieldErrors?.client_markbox && (
                <FieldError msg={state.fieldErrors.client_markbox} />
              )}
            </div>
          </div>

          {/* Origen + Destino */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="qd-origin">
                Origen <span style={{ color: "var(--wine-text)" }}>*</span>
              </label>
              <input
                id="qd-origin"
                name="origin"
                type="text"
                className="studio-input"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Yiwu, Guangzhou…"
                required
              />
              {state.fieldErrors?.origin && (
                <FieldError msg={state.fieldErrors.origin} />
              )}
            </div>
            <div>
              <label className="studio-label" htmlFor="qd-dest">
                Destino <span style={{ color: "var(--wine-text)" }}>*</span>
              </label>
              <input
                id="qd-dest"
                name="destination"
                type="text"
                className="studio-input"
                value={destination}
                onChange={(e) => {
                  const next = e.target.value;
                  setDestination(next);
                  if (!next.trim()) setSuggestedRate(null);
                }}
                placeholder="Valencia, La Guaira…"
                required
              />
              {state.fieldErrors?.destination && (
                <FieldError msg={state.fieldErrors.destination} />
              )}
              {destination.trim() && (
                <RateSuggestionLine
                  rate={suggestedRate}
                  pending={lookupPending}
                  onApply={applySuggestion}
                />
              )}
            </div>
          </div>

          {/* CBM + Peso + Cajas (solo si LCL-style) */}
          {mode$ === "per_cbm" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <label className="studio-label" htmlFor="qd-cbm">
                  CBM <span style={{ color: "var(--wine-text)" }}>*</span>
                </label>
                <NumericInput
                  id="qd-cbm"
                  name="cbm"
                  type="volume"
                  required
                  min={0}
                  placeholder="3.40"
                  value={cbm === "" ? null : Number(cbm)}
                  onChange={(v) => setCbm(v != null ? String(v) : "")}
                />
                {state.fieldErrors?.cbm && <FieldError msg={state.fieldErrors.cbm} />}
              </div>
              <div>
                <label className="studio-label" htmlFor="qd-weight">
                  Peso (kg)
                </label>
                <NumericInput
                  id="qd-weight"
                  name="weight_kg"
                  type="weight"
                  min={0}
                  placeholder="450"
                  value={weightKg === "" ? null : Number(weightKg)}
                  onChange={(v) =>
                    setWeightKg(v != null ? String(v) : "")
                  }
                />
              </div>
              <div>
                <label className="studio-label" htmlFor="qd-boxes">
                  Cajas
                </label>
                <NumericInput
                  id="qd-boxes"
                  name="boxes"
                  type="count"
                  unit="cajas"
                  min={0}
                  placeholder="4"
                  value={boxes === "" ? null : Number(boxes)}
                  onChange={(v) => setBoxes(v != null ? String(v) : "")}
                />
              </div>
            </div>
          )}

          {/* Peso para FCL (sin cbm/cajas obligatorios) */}
          {mode$ === "flat_rate" && (
            <div>
              <label className="studio-label" htmlFor="qd-weight-flat">
                Peso (kg)
              </label>
              <NumericInput
                id="qd-weight-flat"
                name="weight_kg"
                type="weight"
                min={0}
                placeholder="—"
                value={weightKg === "" ? null : Number(weightKg)}
                onChange={(v) =>
                  setWeightKg(v != null ? String(v) : "")
                }
              />
            </div>
          )}

          {/* Rate */}
          {mode$ === "per_cbm" ? (
            <div>
              <label className="studio-label" htmlFor="qd-rate-cbm">
                Tarifa por CBM (USD) <span style={{ color: "var(--wine-text)" }}>*</span>
              </label>
              <NumericInput
                id="qd-rate-cbm"
                name="rate_per_cbm"
                type="currency"
                currency="USD"
                required
                min={0}
                placeholder="480.00"
                value={ratePerCbm === "" ? null : Number(ratePerCbm)}
                onChange={(v) =>
                  setRatePerCbm(v != null ? String(v) : "")
                }
              />
              <input type="hidden" name="flat_rate" value={flatRate} />
              {state.fieldErrors?.rate_per_cbm && (
                <FieldError msg={state.fieldErrors.rate_per_cbm} />
              )}
            </div>
          ) : (
            <div>
              <label className="studio-label" htmlFor="qd-rate-flat">
                Tarifa flat (USD) <span style={{ color: "var(--wine-text)" }}>*</span>
              </label>
              <NumericInput
                id="qd-rate-flat"
                name="flat_rate"
                type="currency"
                currency="USD"
                required
                min={0}
                placeholder="8500.00"
                value={flatRate === "" ? null : Number(flatRate)}
                onChange={(v) =>
                  setFlatRate(v != null ? String(v) : "")
                }
              />
              <input type="hidden" name="rate_per_cbm" value={ratePerCbm} />
              {state.fieldErrors?.flat_rate && (
                <FieldError msg={state.fieldErrors.flat_rate} />
              )}
            </div>
          )}

          {/* Packaging */}
          <div>
            <div className="studio-eyebrow" style={{ marginBottom: 8 }}>
              Embalaje
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PACKAGING_OPTIONS.map((p) => {
                const active = packaging === p.id;
                return (
                  <label
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: "var(--r-md)",
                      background: active ? "var(--wine-tint)" : "var(--bg-surface)",
                      border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="packaging-radio"
                      checked={active}
                      onChange={() => setPackaging(p.id)}
                      style={{ accentColor: "var(--wine)" }}
                    />
                    <span
                      style={{
                        flex: 1,
                        font: "600 13px/1 var(--f-sans)",
                        color: active ? "var(--wine)" : "var(--ink)",
                      }}
                    >
                      {p.label}
                    </span>
                    {p.extra > 0 && (
                      <span
                        style={{
                          font: "700 12px/1 var(--f-mono)",
                          color: active ? "var(--wine)" : "var(--ink-soft)",
                        }}
                      >
                        +${p.extra}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Vigencia + Notas */}
          <div
            style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="qd-valid">
                Válida hasta <span style={{ color: "var(--wine-text)" }}>*</span>
              </label>
              <input
                id="qd-valid"
                name="valid_until"
                type="date"
                className="studio-input"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                required
              />
              {state.fieldErrors?.valid_until && (
                <FieldError msg={state.fieldErrors.valid_until} />
              )}
            </div>
            <div>
              <label className="studio-label" htmlFor="qd-notes">
                Notas
              </label>
              <input
                id="qd-notes"
                name="notes"
                type="text"
                className="studio-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Condiciones especiales, descuentos, vencimientos…"
              />
            </div>
          </div>

          {(state.error || createError) && (
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
              {state.error ?? createError}
            </p>
          )}

          {/* Total card navy LIVE */}
          <div
            style={{
              padding: "18px 20px",
              background: "var(--bg-sidebar)",
              color: "var(--ink-side)",
              borderRadius: "var(--r-lg)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                font: "500 13px/1 var(--f-sans)",
                color: "var(--ink-side)",
              }}
            >
              <span>Subtotal flete</span>
              <span style={{ font: "600 13px/1 var(--f-mono)" }}>
                ${totals.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {totals.packagingCost > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  font: "500 13px/1 var(--f-sans)",
                  color: "var(--ink-side)",
                }}
              >
                <span>Embalaje</span>
                <span style={{ font: "600 13px/1 var(--f-mono)" }}>
                  +${totals.packagingCost}
                </span>
              </div>
            )}
            <div style={{ height: 1, background: "rgba(255,255,255,0.15)" }} />
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    font: "600 10.5px/1 var(--f-sans)",
                    color: "var(--ink-side-soft)",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  Total
                </div>
                <div
                  style={{
                    font: "900 36px/1 var(--f-display)",
                    color: "#fff",
                    letterSpacing: "-0.02em",
                    marginTop: 4,
                  }}
                >
                  ${totals.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div
                style={{
                  font: "500 11px/1.4 var(--f-sans)",
                  color: "var(--ink-side-soft)",
                  textAlign: "right",
                }}
              >
                Total estimado<br />
                <span style={{ color: "var(--wine-soft)", fontWeight: 700 }}>
                  Válida hasta {validUntil}
                </span>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 12 }} />
        </form>

        {/* Footer */}
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
            {mode === "edit" && quote && (
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
                        const result = await softDeleteQuote(quote.id);
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
                memoryKey="quote-drawer-create"
                variant="primary"
                size="default"
                disabled={isPending}
                onError={setCreateError}
                actions={[
                  {
                    key: "create-and-close",
                    idleLabel: "Crear y cerrar",
                    loadingLabel: "Creando…",
                    successLabel: "Estimado creado",
                    successIcon: Icon.check(14),
                    description:
                      "Crea el estimado y vuelve al listado con el nuevo resaltado.",
                    onAction: () => createWithPostAction("close"),
                  },
                  {
                    key: "create-and-open",
                    idleLabel: "Crear y abrir detalle",
                    loadingLabel: "Creando…",
                    successLabel: "Abriendo detalle",
                    successIcon: Icon.check(14),
                    description:
                      "Crea el estimado y abre su detalle para revisar o enviar al cliente.",
                    onAction: () => createWithPostAction("open"),
                  },
                  {
                    key: "create-and-new",
                    idleLabel: "Crear y empezar otra",
                    loadingLabel: "Creando…",
                    successLabel: "Lista la siguiente",
                    successIcon: Icon.check(14),
                    description:
                      "Crea el estimado, limpia los campos y deja este drawer abierto para batch rápido.",
                    onAction: () => createWithPostAction("reset"),
                  },
                ]}
              />
            ) : (
              <button
                type="submit"
                form="quote-drawer-form"
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

function RateSuggestionLine({
  rate,
  pending,
  onApply,
}: {
  rate: Rate | null;
  pending: boolean;
  onApply: () => void;
}) {
  if (pending) {
    return (
      <p
        style={{
          font: "500 11px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "6px 0 0",
        }}
      >
        Buscando tarifa…
      </p>
    );
  }
  if (!rate) {
    return (
      <p
        style={{
          font: "500 11px/1.4 var(--f-sans)",
          color: "var(--warning)",
          margin: "6px 0 0",
        }}
      >
        Sin tarifa registrada — define la tarifa manualmente.
      </p>
    );
  }
  const price =
    rate.per_cbm != null ? `$${rate.per_cbm}/CBM` : `$${rate.flat_rate}/ctr`;
  return (
    <div
      style={{
        marginTop: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "6px 10px",
        background: "var(--success-bg)",
        border: "1px solid var(--success)",
        borderRadius: "var(--r-sm)",
      }}
    >
      <span
        style={{
          font: "500 11px/1.3 var(--f-sans)",
          color: "var(--ink)",
        }}
      >
        Tarifa en catálogo:{" "}
        <strong
          style={{ font: "700 11.5px/1 var(--f-mono)", color: "var(--success)" }}
        >
          {price}
        </strong>{" "}
        ({rate.origin} → {rate.destination})
      </span>
      <button
        type="button"
        onClick={onApply}
        className="studio-btn studio-btn-ghost studio-btn-xs"
        style={{ flexShrink: 0 }}
      >
        Usar
      </button>
    </div>
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
