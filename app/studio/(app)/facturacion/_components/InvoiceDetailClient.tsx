"use client";

/**
 * Wrapper client del detalle de factura (SDD-0021).
 *
 * Maneja:
 * - Drawer de edit (solo status=borrador)
 * - Emitir (borrador → emitida)
 * - Modal "Registrar pago" (emitida/parcial/vencida → parcial/pagada)
 * - Anular (con confirmación · no si pagada)
 * - PDF (SDD-0281 · abre el documento) y Duplicar (SDD-0281 · nueva en borrador)
 */

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { voidReferralRevertTitle } from "@/lib/studio/fidelizacion/referral-revert-notice";
import {
  canEmit,
  canRegisterPayment,
  canVoid,
  computeBalance,
  isEditable,
  type Invoice,
  type InvoiceIvaMode,
} from "@/lib/studio/invoice-types";
import {
  PAYMENT_METHOD_OPTIONS,
  type PaymentMethod,
} from "@/lib/studio/payment-types";
import {
  duplicateInvoice,
  emitInvoice,
  registerPayment,
  voidInvoice,
} from "../actions";
import { InvoiceDrawer } from "./InvoiceDrawer";
import { useDialogA11y } from "@/app/studio/_components/ui/drawer/useDialogA11y";

/** Cuenta de caja/banco (subset para el select del cobro). */
export type CashAccountOption = { id: string; code: string; name: string };

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function InvoiceDetailClient({
  invoice,
  ivaOn,
  fiscalModuleEnabled = false,
  defaultIvaMode = "sin_iva",
  ivaRateGeneral = 16,
  cashAccounts,
}: {
  invoice: Invoice;
  ivaOn: boolean;
  fiscalModuleEnabled?: boolean;
  defaultIvaMode?: InvoiceIvaMode;
  ivaRateGeneral?: number;
  cashAccounts: CashAccountOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [voidPending, setVoidPending] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  // Gate legal AUT-04 (SDD-0054 · Slice B) — advisory. Cuando emitInvoice avisa
  // que el embarque DDP no tiene aceptación T&C vigente, guardamos el warning y
  // mostramos un banner con un segundo botón "Emitir igual" (override).
  const [legalAck, setLegalAck] = useState<string | null>(null);
  // SDD-0495 — la anulación salió bien pero la reversión del crédito de
  // referido no. NO es un error (la factura quedó anulada), así que no va al
  // banner rojo ni cancela el toast: es un aviso que se queda en pantalla
  // mientras quien anuló sigue ahí. Lo durable lo pinta el server component.
  const [voidWarning, setVoidWarning] = useState<string | null>(null);

  const balance = computeBalance(invoice);

  // Sentinel: emitInvoice avisó que falta la aceptación T&C (DDP). No es error
  // ni emisión — interrumpe el flash de éxito del ActionButton sin pintar el
  // banner rojo de error (el aviso ya se muestra como banner warning aparte).
  const LEGAL_ACK_SENTINEL = "__needs_legal_ack__";

  function onEmitSuccess() {
    setLegalAck(null);
    toast.success(`Factura ${invoice.invoice_code} emitida`, {
      link: {
        href: `/studio/facturacion?tab=pending&highlight=${encodeURIComponent(invoice.invoice_code)}&hl-tone=success`,
        label: "Ver en Por cobrar",
      },
    });
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        {isEditable(invoice.status) && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={() => setEditing(true)}
          >
            Editar
          </button>
        )}

        {canEmit(invoice.status) && (
          <ActionButton
            variant="primary"
            size="sm"
            idleLabel="Emitir factura"
            loadingLabel="Emitiendo…"
            successLabel="Factura emitida"
            idleIcon={Icon.check(14)}
            successIcon={Icon.check(14)}
            title={(s) =>
              s === "success"
                ? "Factura emitida · pasa a estado Emitida"
                : "Emite la factura: pasa a Emitida y fija fecha de emisión y vencimiento (+30d)"
            }
            onAction={async () => {
              setError(null);
              const r = await emitInvoice(invoice.id);
              // Advisory: no es error ni emisión — pedir confirmación legal.
              // Throw el sentinel para que el ActionButton NO entre en flash
              // verde (no se emitió). onError lo intercepta y no lo muestra.
              if (r.needsLegalAck) {
                setLegalAck(r.warning ?? "Falta la aceptación de T&C del cliente.");
                throw new Error(LEGAL_ACK_SENTINEL);
              }
              if (r.error) return { error: r.error };
              return undefined;
            }}
            onSuccess={onEmitSuccess}
            onError={(msg) => {
              if (msg === LEGAL_ACK_SENTINEL) return; // ya mostrado como banner warning
              setError(msg);
            }}
          />
        )}

        {canRegisterPayment(invoice) && (
          <button
            type="button"
            className="studio-btn studio-btn-dark studio-btn-sm"
            onClick={() => setShowPayment(true)}
          >
            Registrar pago
          </button>
        )}

        {canVoid(invoice.status) && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            style={{ color: "var(--danger)" }}
            onClick={() => {
              setError(null);
              setConfirmVoid(true);
            }}
          >
            Anular
          </button>
        )}

        {/* El PDF de un borrador no existe a propósito: emitir el papel es un
            acto comercial, y así es como un borrador termina en el WhatsApp de
            un cliente. El route también lo rechaza (409) — esto sólo evita el
            viaje. */}
        <a
          href={`/studio/facturacion/${encodeURIComponent(invoice.invoice_code)}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          aria-disabled={invoice.status === "borrador" ? true : undefined}
          onClick={(e) => {
            if (invoice.status === "borrador") {
              e.preventDefault();
              setError("Emite la factura antes de generar el PDF.");
            }
          }}
          title={
            invoice.status === "borrador"
              ? "Emite la factura antes de generar el PDF"
              : "Abre la factura en PDF"
          }
          style={invoice.status === "borrador" ? { opacity: 0.55 } : undefined}
        >
          PDF
        </a>
        <ActionButton
          variant="ghost"
          size="sm"
          idleLabel="Duplicar"
          loadingLabel="Duplicando…"
          successLabel={null}
          onAction={async () => {
            setError(null);
            const r = await duplicateInvoice(invoice.id);
            if (r.error) return { error: r.error };
            if (r.code) {
              toast.success(`Factura ${r.code} creada en borrador`, {
                link: {
                  href: `/studio/facturacion/${r.code}`,
                  label: "Abrir",
                },
              });
              router.push(`/studio/facturacion/${r.code}`);
            }
            return undefined;
          }}
          onError={setError}
        />
      </div>

      {error && (
        <p
          role="alert"
          style={{
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--danger)",
            margin: "0 0 12px",
            padding: "10px 12px",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-sm)",
          }}
        >
          {error}
        </p>
      )}

      {voidWarning && (
        <div
          role="alert"
          style={{
            margin: "0 0 var(--s-3)",
            padding: "var(--s-3) var(--s-4)",
            background: "var(--warning-bg)",
            border: "1px solid var(--warning)",
            borderRadius: "var(--r-md)",
            display: "flex",
            gap: "var(--s-3)",
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              color: "var(--warning)",
              display: "flex",
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            {Icon.warn(16)}
          </span>
          <div>
            <div
              style={{
                font: "700 12.5px/1.3 var(--f-sans)",
                color: "var(--ink)",
                marginBottom: "var(--s-1)",
              }}
            >
              {voidReferralRevertTitle(voidWarning)}
            </div>
            <p
              style={{
                font: "500 12px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: 0,
              }}
            >
              {voidWarning}
            </p>
          </div>
        </div>
      )}

      {legalAck && (
        <div
          role="alert"
          style={{
            margin: "0 0 12px",
            padding: "12px 14px",
            background: "var(--warning-bg)",
            border: "1px solid var(--warning)",
            borderRadius: "var(--r-md)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span
              style={{ color: "var(--warning)", display: "flex", flexShrink: 0, marginTop: 1 }}
            >
              {Icon.warn(16)}
            </span>
            <div>
              <div
                style={{
                  font: "700 12.5px/1.3 var(--f-sans)",
                  color: "var(--ink)",
                  marginBottom: 4,
                }}
              >
                Falta la aceptación de T&C del cliente
              </div>
              <p
                style={{
                  font: "500 12px/1.5 var(--f-sans)",
                  color: "var(--ink-soft)",
                  margin: 0,
                }}
              >
                {legalAck} Si emites, queda registrado en la auditoría de la
                factura como emisión sin aceptación vigente.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              onClick={() => setLegalAck(null)}
            >
              Cancelar
            </button>
            <ActionButton
              variant="warning"
              size="sm"
              idleLabel="Emitir igual (sin aceptación)"
              loadingLabel="Emitiendo…"
              successLabel="Factura emitida"
              idleIcon={Icon.check(14)}
              successIcon={Icon.check(14)}
              onAction={async () => {
                setError(null);
                return emitInvoice(invoice.id, true);
              }}
              onSuccess={onEmitSuccess}
              onError={setError}
            />
          </div>
        </div>
      )}

      {editing && (
        <InvoiceDrawer
          mode="edit"
          invoice={invoice}
          ivaOn={ivaOn}
          fiscalModuleEnabled={fiscalModuleEnabled}
          defaultIvaMode={defaultIvaMode}
          ivaRateGeneral={ivaRateGeneral}
          onClose={() => setEditing(false)}
        />
      )}

      <ConfirmDialog
        open={confirmVoid}
        danger
        reason
        reasonRequired
        holdToConfirm
        initialFocus="reason"
        title="Anular factura"
        message={`La factura ${invoice.invoice_code} quedará anulada en el historial. Indica el motivo.`}
        confirmLabel="Anular factura"
        holdLabel="Mantén presionado para anular"
        holdAlternativeLabel="Entiendo que la factura quedará anulada y prefiero confirmar con un clic"
        pending={voidPending}
        error={error ?? undefined}
        onCancel={() => {
          if (!voidPending) setConfirmVoid(false);
        }}
        onConfirm={async (reason) => {
          setVoidPending(true);
          setError(null);
          const result = await voidInvoice(invoice.id, reason);
          if (result.error) {
            setError(result.error);
            setVoidPending(false);
            return;
          }
          // SDD-0495: la anulación fue exitosa igual, pero si vino aviso hay que
          // mostrarlo — antes se perdía en el log del servidor y quien anulaba
          // se iba con un éxito limpio.
          setVoidWarning(result.warning ?? null);
          toast.info(`Factura ${invoice.invoice_code} anulada`);
          setConfirmVoid(false);
          setVoidPending(false);
          router.refresh();
        }}
      />

      {showPayment && (
        <PaymentModal
          invoice={invoice}
          balance={balance}
          cashAccounts={cashAccounts}
          onClose={() => setShowPayment(false)}
          onError={setError}
          onPaid={(amount, fullyPaid, receiptCode) => {
            toast.success(
              `Cobro de $${fmt(amount)} registrado en ${invoice.invoice_code}${receiptCode ? ` · recibo ${receiptCode}` : ""}`,
              fullyPaid
                ? {
                    link: {
                      href: `/studio/facturacion?tab=paid&highlight=${encodeURIComponent(invoice.invoice_code)}&hl-tone=success`,
                      label: "Ver en Pagadas",
                    },
                  }
                : undefined,
            );
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function PaymentModal({
  invoice,
  balance,
  cashAccounts,
  onClose,
  onPaid,
  onError,
}: {
  invoice: Invoice;
  balance: number;
  cashAccounts: CashAccountOption[];
  onClose: () => void;
  onPaid: (amount: number, fullyPaid: boolean, receiptCode?: string) => void;
  onError: (msg: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState<string>(String(balance));
  const [cashAccountId, setCashAccountId] = useState<string>(
    cashAccounts[0]?.id ?? "",
  );
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [receivedAt, setReceivedAt] = useState<string>(today);
  const [reference, setReference] = useState<string>("");
  const [localError, setLocalError] = useState<string | null>(null);

  const amt = Number(amount) || 0;
  const noCashAccounts = cashAccounts.length === 0;
  const valid =
    amt > 0 && amt <= balance + 1e-6 && !!cashAccountId && !noCashAccounts;

  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(panelRef, { onClose, pending: false });

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 110,
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(460px, 96vw)",
          maxHeight: "90vh",
          overflow: "auto",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-pop)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div>
          <h2
            id="pay-modal-title"
            className="studio-display"
            style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
          >
            Registrar cobro
          </h2>
          <p
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "6px 0 0",
            }}
          >
            {invoice.invoice_code} · saldo actual{" "}
            <strong style={{ font: "700 12px/1 var(--f-mono)", color: "var(--wine-text)" }}>
              ${fmt(balance)}
            </strong>
          </p>
        </div>

        <div>
          <label className="studio-label" htmlFor="pay-amount">
            Monto a cobrar ({invoice.currency})
          </label>
          <NumericInput
            id="pay-amount"
            type="currency"
            currency="USD"
            min={0}
            max={balance}
            placeholder="0.00"
            value={amount === "" ? null : Number(amount)}
            onChange={(v) => setAmount(v != null ? String(v) : "")}
          />
          {amt > 0 && amt <= balance + 1e-6 && (
            <p
              style={{
                font: "500 11px/1.3 var(--f-sans)",
                color: amt >= balance - 1e-6 ? "var(--ink-soft)" : "var(--warning)",
                margin: "var(--s-1) 0 0",
              }}
            >
              {amt >= balance - 1e-6
                ? "Cobro total · salda la factura."
                : `Abono parcial · quedan $${fmt(balance - amt)} pendientes.`}
            </p>
          )}
          {amt > balance + 1e-6 && amount !== "" && (
            <p
              style={{
                font: "500 11px/1.3 var(--f-sans)",
                color: "var(--danger)",
                margin: "var(--s-1) 0 0",
              }}
            >
              El monto no puede superar el saldo (${fmt(balance)}).
            </p>
          )}
        </div>

        <div>
          <label className="studio-label" htmlFor="pay-cash-account">
            Cuenta de caja / banco
          </label>
          {noCashAccounts ? (
            <p
              style={{
                font: "500 11.5px/1.4 var(--f-sans)",
                color: "var(--warning)",
                margin: "var(--s-1) 0 0",
              }}
            >
              No hay cuentas de caja/banco en el plan de cuentas. Siembra el
              plan en Contabilidad para registrar cobros con asiento.
            </p>
          ) : (
            <select
              id="pay-cash-account"
              className="studio-input"
              value={cashAccountId}
              onChange={(e) => setCashAccountId(e.target.value)}
            >
              {cashAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="studio-label" htmlFor="pay-method">
              Método
            </label>
            <select
              id="pay-method"
              className="studio-input"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="studio-label" htmlFor="pay-date">
              Fecha
            </label>
            <input
              id="pay-date"
              type="date"
              className="studio-input studio-input-mono"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="studio-label" htmlFor="pay-ref">
            Referencia <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
          </label>
          <input
            id="pay-ref"
            type="text"
            className="studio-input"
            placeholder="Nro de transferencia, captura, nota…"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>

        {localError && (
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
            {localError}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={onClose}
          >
            Cancelar
          </button>
          <ActionButton
            variant="primary"
            size="default"
            idleLabel="Registrar cobro"
            loadingLabel="Registrando…"
            successLabel="Cobro registrado"
            idleIcon={Icon.check(14)}
            successIcon={Icon.check(14)}
            disabled={!valid}
            onAction={async () => {
              setLocalError(null);
              const r = await registerPayment(invoice.id, {
                amount: amt,
                cashAccountId,
                method,
                receivedAt,
                reference: reference.trim() || null,
              });
              if (r.error) {
                setLocalError(r.error);
                return { error: r.error };
              }
              const fullyPaid = r.fullyPaid ?? amt >= balance - 1e-6;
              onPaid(amt, fullyPaid, r.receiptCode);
              onClose();
              return undefined;
            }}
            onError={onError}
          />
        </div>
      </div>
    </div>
  );
}
