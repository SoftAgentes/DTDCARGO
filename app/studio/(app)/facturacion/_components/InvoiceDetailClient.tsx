"use client";

/**
 * Wrapper client del detalle de factura (SDD-0021).
 *
 * Maneja:
 * - Drawer de edit (solo status=borrador)
 * - Emitir (borrador → emitida)
 * - Modal "Registrar pago" (emitida/parcial/vencida → parcial/pagada)
 * - Anular (con confirmación · no si pagada)
 * - Botones disabled placeholder: PDF, Duplicar (próximamente)
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  canEmit,
  canRegisterPayment,
  canVoid,
  computeBalance,
  isEditable,
  type Invoice,
} from "@/lib/studio/invoice-types";
import {
  emitInvoice,
  registerPayment,
  voidInvoice,
} from "../actions";
import { InvoiceDrawer } from "./InvoiceDrawer";

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function InvoiceDetailClient({
  invoice,
  ivaOn,
}: {
  invoice: Invoice;
  ivaOn: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const balance = computeBalance(invoice);

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
              return emitInvoice(invoice.id);
            }}
            onSuccess={() =>
              toast.success(`Factura ${invoice.invoice_code} emitida`, {
                link: {
                  href: `/studio/facturacion?tab=pending&highlight=${encodeURIComponent(invoice.invoice_code)}&hl-tone=success`,
                  label: "Ver en Por cobrar",
                },
              })
            }
            onError={setError}
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

        {canVoid(invoice.status) &&
          (confirmVoid ? (
            <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span
                style={{
                  font: "500 12px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                }}
              >
                ¿Anular?
              </span>
              <ActionButton
                variant="danger"
                size="sm"
                idleLabel="Sí, anular"
                loadingLabel="Anulando…"
                successLabel={null}
                onAction={async () => {
                  setError(null);
                  const r = await voidInvoice(invoice.id);
                  if (r.error) return { error: r.error };
                  toast.info(`Factura ${invoice.invoice_code} anulada`);
                  return undefined;
                }}
                onError={setError}
              />
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                onClick={() => setConfirmVoid(false)}
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              style={{ color: "var(--danger)" }}
              onClick={() => setConfirmVoid(true)}
            >
              Anular
            </button>
          ))}

        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          disabled
          title="Próximamente"
        >
          PDF
        </button>
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          disabled
          title="Próximamente"
        >
          Duplicar
        </button>
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

      {editing && (
        <InvoiceDrawer
          mode="edit"
          invoice={invoice}
          ivaOn={ivaOn}
          onClose={() => setEditing(false)}
        />
      )}

      {showPayment && (
        <PaymentModal
          invoice={invoice}
          balance={balance}
          onClose={() => setShowPayment(false)}
          onError={setError}
          onPaid={(amount, fullyPaid) => {
            toast.success(
              `Pago de $${fmt(amount)} registrado en ${invoice.invoice_code}`,
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
  onClose,
  onPaid,
  onError,
}: {
  invoice: Invoice;
  balance: number;
  onClose: () => void;
  onPaid: (amount: number, fullyPaid: boolean) => void;
  onError: (msg: string) => void;
}) {
  const [amount, setAmount] = useState<string>(String(balance));
  const [localError, setLocalError] = useState<string | null>(null);

  const amt = Number(amount) || 0;
  const valid = amt > 0 && amt <= balance + 1e-6;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-modal-title"
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
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, 96vw)",
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
            Registrar pago
          </h2>
          <p
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "6px 0 0",
            }}
          >
            {invoice.invoice_code} · saldo actual{" "}
            <strong style={{ font: "700 12px/1 var(--f-mono)", color: "var(--wine)" }}>
              ${fmt(balance)}
            </strong>
          </p>
        </div>

        <div>
          <label className="studio-label" htmlFor="pay-amount">
            Monto a registrar ({invoice.currency})
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
          {!valid && amount !== "" && (
            <p
              style={{
                font: "500 11px/1.3 var(--f-sans)",
                color: "var(--danger)",
                margin: "4px 0 0",
              }}
            >
              El monto debe ser mayor a 0 y no superar el saldo (${fmt(balance)}).
            </p>
          )}
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
            idleLabel="Registrar pago"
            loadingLabel="Registrando…"
            successLabel="Pago registrado"
            idleIcon={Icon.check(14)}
            successIcon={Icon.check(14)}
            disabled={!valid}
            onAction={async () => {
              setLocalError(null);
              const r = await registerPayment(invoice.id, amt);
              if (r.error) {
                setLocalError(r.error);
                return { error: r.error };
              }
              const fullyPaid = amt >= balance - 1e-6;
              onPaid(amt, fullyPaid);
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
