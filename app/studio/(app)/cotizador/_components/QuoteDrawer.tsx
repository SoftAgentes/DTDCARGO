"use client";

/**
 * QuoteDrawer — calculator + form para crear/editar cotización (SDD-0011).
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

interface Props {
  mode: "create" | "edit";
  quote?: Quote;
  onClose: () => void;
  /** Si mode=edit, optional callback con el code para redirect post-success. */
  onSuccess?: () => void;
}

const initialState: QuoteActionState = {};

const SERVICE_CARDS: { value: ShipmentService; label: string; hint: string }[] = [
  { value: "consolidacion", label: "Consolidación LCL", hint: "$/CBM" },
  { value: "puerta_a_puerta_DDP", label: "Puerta a Puerta DDP", hint: "$/CBM prepago" },
  { value: "reserva_FCL", label: "Reserva FCL", hint: "tarifa flat" },
  { value: "transporte_terrestre", label: "Transporte terrestre", hint: "VE flat" },
];

export function QuoteDrawer({ mode, quote, onClose }: Props) {
  const action =
    mode === "edit" && quote
      ? updateQuote.bind(null, quote.id)
      : createQuote;
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [service, setService] = useState<ShipmentService>(
    quote?.service ?? "consolidacion",
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
    quote?.valid_until ??
      new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(quote?.notes ?? "");

  const [suggestedRate, setSuggestedRate] = useState<Rate | null>(null);
  const [lookupPending, setLookupPending] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  const mode$ = quotePriceMode(service);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  // Lookup automático de rate al cambiar destino
  useEffect(() => {
    if (!destination.trim()) {
      setSuggestedRate(null);
      return;
    }
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

  const title = mode === "create" ? "Nueva cotización" : "Editar cotización";

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
          action={formAction}
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
                        color: active ? "var(--wine)" : "var(--ink-mute)",
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

          {/* Cliente: MARKBOX + Nombre */}
          <div
            style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="qd-markbox">
                MARKBOX <span style={{ color: "var(--wine)" }}>*</span>
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
            <div>
              <label className="studio-label" htmlFor="qd-clname">
                Nombre del cliente <span style={{ color: "var(--wine)" }}>*</span>
              </label>
              <input
                id="qd-clname"
                name="client_name"
                type="text"
                className="studio-input"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Empresa Demo S.A."
                required
              />
              {state.fieldErrors?.client_name && (
                <FieldError msg={state.fieldErrors.client_name} />
              )}
            </div>
          </div>

          {/* Origen + Destino */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="qd-origin">
                Origen <span style={{ color: "var(--wine)" }}>*</span>
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
                Destino <span style={{ color: "var(--wine)" }}>*</span>
              </label>
              <input
                id="qd-dest"
                name="destination"
                type="text"
                className="studio-input"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
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
                  CBM <span style={{ color: "var(--wine)" }}>*</span>
                </label>
                <input
                  id="qd-cbm"
                  name="cbm"
                  type="number"
                  step="0.001"
                  min="0"
                  className="studio-input studio-input-mono"
                  value={cbm}
                  onChange={(e) => setCbm(e.target.value)}
                  placeholder="3.40"
                  required
                />
                {state.fieldErrors?.cbm && <FieldError msg={state.fieldErrors.cbm} />}
              </div>
              <div>
                <label className="studio-label" htmlFor="qd-weight">
                  Peso (kg)
                </label>
                <input
                  id="qd-weight"
                  name="weight_kg"
                  type="number"
                  step="0.01"
                  min="0"
                  className="studio-input studio-input-mono"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="450"
                />
              </div>
              <div>
                <label className="studio-label" htmlFor="qd-boxes">
                  Cajas
                </label>
                <input
                  id="qd-boxes"
                  name="boxes"
                  type="number"
                  step="1"
                  min="0"
                  className="studio-input studio-input-mono"
                  value={boxes}
                  onChange={(e) => setBoxes(e.target.value)}
                  placeholder="4"
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
              <input
                id="qd-weight-flat"
                name="weight_kg"
                type="number"
                step="0.01"
                min="0"
                className="studio-input studio-input-mono"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="—"
              />
            </div>
          )}

          {/* Rate */}
          {mode$ === "per_cbm" ? (
            <div>
              <label className="studio-label" htmlFor="qd-rate-cbm">
                Tarifa por CBM (USD) <span style={{ color: "var(--wine)" }}>*</span>
              </label>
              <input
                id="qd-rate-cbm"
                name="rate_per_cbm"
                type="number"
                step="0.01"
                min="0"
                className="studio-input studio-input-mono"
                value={ratePerCbm}
                onChange={(e) => setRatePerCbm(e.target.value)}
                placeholder="480.00"
                required
              />
              <input type="hidden" name="flat_rate" value={flatRate} />
              {state.fieldErrors?.rate_per_cbm && (
                <FieldError msg={state.fieldErrors.rate_per_cbm} />
              )}
            </div>
          ) : (
            <div>
              <label className="studio-label" htmlFor="qd-rate-flat">
                Tarifa flat (USD) <span style={{ color: "var(--wine)" }}>*</span>
              </label>
              <input
                id="qd-rate-flat"
                name="flat_rate"
                type="number"
                step="0.01"
                min="0"
                className="studio-input studio-input-mono"
                value={flatRate}
                onChange={(e) => setFlatRate(e.target.value)}
                placeholder="8500.00"
                required
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
                Válida hasta <span style={{ color: "var(--wine)" }}>*</span>
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

          {/* Total card navy LIVE */}
          <div
            style={{
              padding: "18px 20px",
              background: "var(--ink)",
              color: "var(--ink-inv)",
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
                color: "rgba(255,255,255,0.75)",
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
                  color: "rgba(255,255,255,0.75)",
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
                    color: "rgba(255,255,255,0.55)",
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
                  color: "rgba(255,255,255,0.55)",
                  textAlign: "right",
                }}
              >
                Total cotizado<br />
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
            <button
              type="submit"
              className="studio-btn studio-btn-primary"
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                const form = (e.currentTarget.closest("aside") as HTMLElement)?.querySelector("form");
                if (form) (form as HTMLFormElement).requestSubmit();
              }}
            >
              {isPending
                ? mode === "create"
                  ? "Creando…"
                  : "Guardando…"
                : mode === "create"
                  ? "Crear cotización"
                  : "Guardar cambios"}
            </button>
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
          color: "var(--ink-mute)",
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
        Sin tarifa registrada — definí la tarifa manualmente.
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
        margin: "4px 0 0",
      }}
    >
      {msg}
    </p>
  );
}
