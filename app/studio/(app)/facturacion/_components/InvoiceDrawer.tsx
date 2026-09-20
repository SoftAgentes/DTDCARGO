"use client";

/**
 * InvoiceDrawer — form + editor de líneas + total en vivo (SDD-0021).
 *
 * - Cliente: MARKBOX + nombre con lookup blando (no bloquea)
 * - Embarque opcional: código → prefill de cliente desde el shipment
 * - Moneda + fx_rate (BCV requerido si VES)
 * - Editor de líneas: descripción / cantidad / precio unitario · subtotal por línea
 * - Total card navy LIVE con desglose Base / IVA 16% / Total cuando ivaOn
 * - Vencimiento opcional · checkbox "emitir al crear"
 * - Soft delete en footer (mode edit con doble confirmación)
 *
 * El total se calcula con `calcInvoiceTotals` (la misma fn pura que el server),
 * así UI y BD coinciden.
 */

import { useActionState, useEffect, useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  INVOICE_CURRENCY_OPTIONS,
  IVA_RATE_DEFAULT,
  calcInvoiceTotals,
  type Invoice,
  type InvoiceActionState,
  type InvoiceCurrency,
  type InvoiceIvaMode,
  type InvoiceLine,
} from "@/lib/studio/invoice-types";
import {
  INVOICE_IVA_MODES,
  invoiceIvaModeLabel,
} from "@/lib/studio/fiscal/config-types";
import {
  createInvoice,
  lookupShipmentForInvoice,
  softDeleteInvoice,
  updateInvoice,
} from "../actions";
import { Icon } from "@/app/studio/_components/icons";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { useDialogA11y } from "@/app/studio/_components/ui/drawer/useDialogA11y";
import { InvoiceTitularPicker } from "./InvoiceTitularPicker";

interface Props {
  mode: "create" | "edit";
  invoice?: Invoice;
  ivaOn: boolean;
  /** SDD-0073 §8: con el módulo fiscal ON, el IVA se elige por factura (iva_mode).
   *  Default false → comportamiento actual (toggle de tenant vía ivaOn). */
  fiscalModuleEnabled?: boolean;
  defaultIvaMode?: InvoiceIvaMode;
  ivaRateGeneral?: number;
  onClose: () => void;
}

const initialState: InvoiceActionState = {};

type DraftLine = { desc: string; qty: string; unitPrice: string };

function toDraft(lines: InvoiceLine[]): DraftLine[] {
  if (!lines.length) return [{ desc: "", qty: "1", unitPrice: "" }];
  return lines.map((l) => ({
    desc: l.desc,
    qty: String(l.qty),
    unitPrice: String(l.unitPrice),
  }));
}

function draftToLines(draft: DraftLine[]): InvoiceLine[] {
  return draft
    .map((d) => ({
      desc: d.desc.trim(),
      qty: Number(d.qty) || 0,
      unitPrice: Number(d.unitPrice) || 0,
    }))
    .filter((l) => l.desc.length > 0);
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function InvoiceDrawer({
  mode,
  invoice,
  ivaOn,
  fiscalModuleEnabled = false,
  defaultIvaMode = "sin_iva",
  ivaRateGeneral = IVA_RATE_DEFAULT,
  onClose,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const action =
    mode === "edit" && invoice
      ? updateInvoice.bind(null, invoice.id)
      : createInvoice;
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [clientMarkbox, setClientMarkbox] = useState(
    invoice?.client_markbox ?? "",
  );
  const [clientName, setClientName] = useState(invoice?.client_name ?? "");
  const [shipmentCode, setShipmentCode] = useState(invoice?.shipment_code ?? "");
  const [shipmentId, setShipmentId] = useState(invoice?.shipment_id ?? "");
  const [currency, setCurrency] = useState<InvoiceCurrency>(
    invoice?.currency ?? "USD",
  );
  const [fxRate, setFxRate] = useState<string>(
    invoice?.fx_rate != null ? String(invoice.fx_rate) : "",
  );
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? "");
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [lines, setLines] = useState<DraftLine[]>(toDraft(invoice?.lines ?? []));
  const [emitOnCreate, setEmitOnCreate] = useState(false);
  // SDD-0073 §8: modo de IVA por factura (solo visible/activo con el módulo ON).
  const [ivaMode, setIvaMode] = useState<InvoiceIvaMode>(
    invoice?.iva_mode ?? defaultIvaMode,
  );

  const [shipmentLookupMsg, setShipmentLookupMsg] = useState<string | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  // IVA efectivo: con el módulo fiscal ON lo decide el iva_mode de la factura
  // (con_iva grava a la alícuota general); con OFF, el toggle de tenant (ivaOn).
  const effectiveIvaOn = fiscalModuleEnabled ? ivaMode === "con_iva" : ivaOn;
  const effectiveRate = fiscalModuleEnabled ? ivaRateGeneral : IVA_RATE_DEFAULT;
  const totals = calcInvoiceTotals({
    lines: draftToLines(lines),
    ivaRate: effectiveRate,
    ivaOn: effectiveIvaOn,
  });

  // Post-success: navegar al listado (create) o cerrar con toast (edit).
  useEffect(() => {
    if (!state.ok) return;
    if (mode === "create" && state.createdCode) {
      const code = state.createdCode;
      toast.success(`Factura ${code} creada`, {
        link: { href: `/studio/facturacion/${code}`, label: "Abrir detalle" },
      });
      router.push(
        `/studio/facturacion?highlight=${encodeURIComponent(code)}&hl-tone=warm`,
      );
    } else if (mode === "edit" && invoice) {
      toast.success(`Factura ${invoice.invoice_code} actualizada`);
    }
    onClose();
  }, [state.ok, state.createdCode, mode, invoice, router, toast, onClose]);

  // Lookup blando del embarque al cambiar el código.
  useEffect(() => {
    const code = shipmentCode.trim();
    if (!code) return;
    const t = setTimeout(async () => {
      const { shipment } = await lookupShipmentForInvoice(code);
      if (shipment) {
        setShipmentId(shipment.id);
        setShipmentLookupMsg(`Embarque encontrado · ${shipment.code}`);
        setClientMarkbox((current) => current || shipment.client_markbox || "");
        setClientName((current) => current || shipment.client_name || "");
      } else {
        setShipmentId("");
        setShipmentLookupMsg("Sin embarque con ese código (se guarda igual).");
      }
    }, 450);
    return () => clearTimeout(t);
  }, [shipmentCode]);

  const addLine = () =>
    setLines((prev) => [...prev, { desc: "", qty: "1", unitPrice: "" }]);
  const removeLine = (idx: number) =>
    setLines((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== idx),
    );
  const updateLine = (idx: number, patch: Partial<DraftLine>) =>
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    );

  const linesJson = JSON.stringify(draftToLines(lines));

  const title = mode === "create" ? "Nueva factura" : "Editar factura";

  const panelRef = useRef<HTMLElement>(null);
  useDialogA11y(panelRef, { onClose, pending: isPending || isDeleting });

  return (
    <div
      onClick={() => !isPending && !isDeleting && onClose()}
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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inv-drawer-title"
        tabIndex={-1}
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
          <div style={{ minWidth: 0 }}>
            <h2
              id="inv-drawer-title"
              className="studio-display"
              style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
            >
              {title}
            </h2>
            {mode === "edit" && invoice && (
              <div
                style={{
                  font: "700 11.5px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                  marginTop: 4,
                }}
              >
                {invoice.invoice_code}
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
              border: 0,
              cursor: isPending || isDeleting ? "wait" : "pointer",
              flexShrink: 0,
            }}
          >
            {Icon.close(14)}
          </button>
        </header>

        <form
          id="inv-drawer-form"
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
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="shipment_id" value={shipmentId} />
          <input type="hidden" name="lines" value={linesJson} />
          {fiscalModuleEnabled && (
            <input type="hidden" name="iva_mode" value={ivaMode} />
          )}
          {mode === "create" && (
            <input
              type="hidden"
              name="emit_on_create"
              value={emitOnCreate ? "true" : "false"}
            />
          )}

          {/* Cliente */}
          <div
            style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="ivd-markbox">
                Shipping Mark <span style={{ color: "var(--wine-text)" }}>*</span>
              </label>
              <input
                id="ivd-markbox"
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
              <label className="studio-label" htmlFor="ivd-clname">
                Nombre del cliente <span style={{ color: "var(--wine-text)" }}>*</span>
              </label>
              <input
                id="ivd-clname"
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

          {/* SDD-0487: titular de la factura (sólo con 0466 y un cliente real). */}
          <InvoiceTitularPicker markbox={clientMarkbox} invoiceId={invoice?.id ?? null} />

          {/* Embarque opcional */}
          <div>
            <label className="studio-label" htmlFor="ivd-shipment">
              Embarque (opcional)
            </label>
            <input
              id="ivd-shipment"
              name="shipment_code"
              type="text"
              className="studio-input studio-input-mono"
              value={shipmentCode}
              onChange={(e) => {
                const next = e.target.value;
                setShipmentCode(next);
                if (!next.trim()) {
                  setShipmentId("");
                  setShipmentLookupMsg(null);
                }
              }}
              placeholder="DTDU-0001"
            />
            {shipmentLookupMsg && (
              <p
                style={{
                  font: "500 11px/1.3 var(--f-sans)",
                  color: shipmentId ? "var(--success)" : "var(--ink-soft)",
                  margin: "6px 0 0",
                }}
              >
                {shipmentLookupMsg}
              </p>
            )}
          </div>

          {/* Moneda + fx */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="ivd-currency">
                Moneda
              </label>
              <select
                id="ivd-currency"
                className="studio-input"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as InvoiceCurrency)}
              >
                {INVOICE_CURRENCY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {currency === "VES" && (
              <div>
                <label className="studio-label" htmlFor="ivd-fx">
                  Tasa BCV <span style={{ color: "var(--wine-text)" }}>*</span>
                </label>
                <NumericInput
                  id="ivd-fx"
                  name="fx_rate"
                  type="decimal"
                  min={0}
                  placeholder="36.50"
                  value={fxRate === "" ? null : Number(fxRate)}
                  onChange={(v) => setFxRate(v != null ? String(v) : "")}
                />
                {state.fieldErrors?.fx_rate && (
                  <FieldError msg={state.fieldErrors.fx_rate} />
                )}
              </div>
            )}
            {currency !== "VES" && (
              <input type="hidden" name="fx_rate" value={fxRate} />
            )}
          </div>

          {/* IVA por factura (SDD-0073 §8) — solo con el módulo fiscal activo */}
          {fiscalModuleEnabled && (
            <div>
              <label className="studio-label" htmlFor="ivd-ivamode">
                IVA de esta factura
              </label>
              <select
                id="ivd-ivamode"
                className="studio-input"
                value={ivaMode}
                onChange={(e) => setIvaMode(e.target.value as InvoiceIvaMode)}
              >
                {INVOICE_IVA_MODES.map((m) => (
                  <option key={m} value={m}>
                    {invoiceIvaModeLabel(m)}
                    {m === "con_iva" ? ` (${effectiveRate}%)` : ""}
                  </option>
                ))}
              </select>
              <p
                style={{
                  font: "400 11px/1.4 var(--f-sans)",
                  color: "var(--ink-soft)",
                  margin: "6px 0 0",
                }}
              >
                Con IVA grava a la alícuota general de tu configuración fiscal; el
                resto va sin débito fiscal. El default lo fija Configuración fiscal.
              </p>
            </div>
          )}

          {/* Editor de líneas */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div className="studio-eyebrow">Líneas</div>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-xs"
                onClick={addLine}
              >
                + Agregar línea
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lines.map((l, idx) => {
                const subtotal = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
                return (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 70px 110px 28px",
                      gap: 8,
                      alignItems: "start",
                    }}
                  >
                    <input
                      type="text"
                      className="studio-input"
                      placeholder="Descripción (flete, despacho, seguro…)"
                      value={l.desc}
                      onChange={(e) => updateLine(idx, { desc: e.target.value })}
                      aria-label={`Descripción línea ${idx + 1}`}
                    />
                    <NumericInput
                      type="count"
                      min={0}
                      placeholder="1"
                      value={l.qty === "" ? null : Number(l.qty)}
                      onChange={(v) =>
                        updateLine(idx, { qty: v != null ? String(v) : "" })
                      }
                      aria-label={`Cantidad línea ${idx + 1}`}
                    />
                    <NumericInput
                      type="currency"
                      currency="USD"
                      min={0}
                      placeholder="0.00"
                      value={l.unitPrice === "" ? null : Number(l.unitPrice)}
                      onChange={(v) =>
                        updateLine(idx, {
                          unitPrice: v != null ? String(v) : "",
                        })
                      }
                      aria-label={`Precio unitario línea ${idx + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length === 1}
                      aria-label={`Quitar línea ${idx + 1}`}
                      title="Quitar línea"
                      style={{
                        height: 38,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: "var(--r-sm)",
                        border: "1px solid var(--border)",
                        background: "var(--bg-surface)",
                        color:
                          lines.length === 1
                            ? "var(--ink-mute)"
                            : "var(--danger)",
                        cursor: lines.length === 1 ? "not-allowed" : "pointer",
                      }}
                    >
                      {Icon.trash(13)}
                    </button>
                    {subtotal > 0 && (
                      <div
                        style={{
                          gridColumn: "1 / -1",
                          font: "500 10.5px/1 var(--f-mono)",
                          color: "var(--ink-soft)",
                          textAlign: "right",
                          marginTop: -2,
                        }}
                      >
                        subtotal ${fmt(subtotal)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {state.fieldErrors?.lines && (
              <FieldError msg={state.fieldErrors.lines} />
            )}
          </div>

          {/* Vencimiento + emitir */}
          <div
            style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="ivd-due">
                Vence (opcional)
              </label>
              <input
                id="ivd-due"
                name="due_date"
                type="date"
                className="studio-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              {state.fieldErrors?.due_date && (
                <FieldError msg={state.fieldErrors.due_date} />
              )}
            </div>
            <div>
              <label className="studio-label" htmlFor="ivd-notes">
                Notas
              </label>
              <input
                id="ivd-notes"
                name="notes"
                type="text"
                className="studio-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Concepto, referencias internas…"
              />
            </div>
          </div>

          {mode === "create" && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                font: "600 12.5px/1.3 var(--f-sans)",
                color: "var(--ink)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={emitOnCreate}
                onChange={(e) => setEmitOnCreate(e.target.checked)}
                style={{ accentColor: "var(--wine)" }}
              />
              Emitir al crear (si no, queda en borrador)
            </label>
          )}

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

          {/* Total card navy LIVE con desglose IVA reactivo */}
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
            {effectiveIvaOn && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    font: "500 13px/1 var(--f-sans)",
                    color: "var(--ink-side)",
                  }}
                >
                  <span>Base imponible</span>
                  <span style={{ font: "600 13px/1 var(--f-mono)" }}>
                    ${fmt(totals.base)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    font: "500 13px/1 var(--f-sans)",
                    color: "var(--ink-side)",
                  }}
                >
                  <span>IVA {effectiveRate}%</span>
                  <span style={{ font: "600 13px/1 var(--f-mono)" }}>
                    ${fmt(totals.iva)}
                  </span>
                </div>
                <div
                  style={{ height: 1, background: "var(--ink-side-soft)" }}
                />
              </>
            )}
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
                  Total a facturar
                </div>
                <div
                  style={{
                    font: "900 36px/1 var(--f-display)",
                    color: "var(--ink-side-strong)",
                    letterSpacing: "-0.02em",
                    marginTop: 4,
                  }}
                >
                  ${fmt(totals.total)}
                </div>
              </div>
              <div
                style={{
                  font: "500 11px/1.4 var(--f-sans)",
                  color: "var(--ink-side-soft)",
                  textAlign: "right",
                }}
              >
                {currency}
                {currency === "VES" && fxRate
                  ? ` · BCV ${fxRate}`
                  : ""}
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
            {mode === "edit" && invoice && (
              confirmDelete ? (
                <div
                  style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
                >
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
                        const result = await softDeleteInvoice(invoice.id);
                        if (result.ok) {
                          toast.info(`Factura ${invoice.invoice_code} eliminada`);
                          router.push("/studio/facturacion");
                          onClose();
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
              form="inv-drawer-form"
              className="studio-btn studio-btn-primary"
              disabled={isPending}
            >
              {isPending
                ? mode === "create"
                  ? "Creando…"
                  : "Guardando…"
                : mode === "create"
                  ? emitOnCreate
                    ? "Crear y emitir"
                    : "Crear borrador"
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
        margin: "var(--s-1) 0 0",
      }}
    >
      {msg}
    </p>
  );
}
