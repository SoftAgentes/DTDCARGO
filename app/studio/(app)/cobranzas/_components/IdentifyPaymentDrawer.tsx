"use client";

/**
 * Drawer "Identificar" un pago sin referencia (SDD-0068 #3 · decisión #6).
 *
 * Flujo: elegir cliente → elegir factura con saldo ≥ monto (misma moneda) →
 * confirmar. La identificación es RETROACTIVA: conserva `received_at`
 * original (la imputación es a la fecha de recepción de fondos), aplica el
 * saldo como un cobro normal y reclasifica el asiento (DR 2.1.8 / CR 1.1.2).
 *
 * Las opciones salen de la cola de CxC ya cargada (receivables) — facturas
 * con saldo del tenant. El server re-valida todo en `identifyPaymentFor`.
 */

import { useMemo, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import type { Receivable } from "@/lib/studio/payment-queries";
import {
  paymentMethodLabel,
  UNIDENTIFIED_CLIENT_NOTICE,
  type PaymentReceipt,
} from "@/lib/studio/payment-types";
import { identifyPayment } from "../actions";

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function IdentifyPaymentDrawer({
  receipt,
  receivables,
  onClose,
  onDone,
}: {
  receipt: PaymentReceipt;
  receivables: Receivable[];
  onClose: () => void;
  onDone: (invoiceCode: string | undefined, fullyPaid: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [clientMarkbox, setClientMarkbox] = useState<string>("");
  const [invoiceId, setInvoiceId] = useState<string>("");

  // Facturas elegibles: misma moneda del pago + saldo suficiente.
  const eligible = useMemo(
    () =>
      receivables.filter(
        (r) =>
          r.invoice.currency === receipt.currency &&
          r.balance >= receipt.amount - 1e-6,
      ),
    [receivables, receipt.currency, receipt.amount],
  );

  const clients = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of eligible) {
      if (!seen.has(r.invoice.client_markbox)) {
        seen.set(r.invoice.client_markbox, r.invoice.client_name);
      }
    }
    return [...seen.entries()].map(([markbox, name]) => ({ markbox, name }));
  }, [eligible]);

  const invoiceOptions = useMemo(
    () => eligible.filter((r) => r.invoice.client_markbox === clientMarkbox),
    [eligible, clientMarkbox],
  );

  const selected =
    invoiceOptions.find((r) => r.invoice.id === invoiceId) ?? null;

  return (
    <DrawerShell
      title={`Identificar ${receipt.receipt_code}`}
      subtitle={`$${fmt(receipt.amount)} ${receipt.currency} · ${paymentMethodLabel(receipt.method)} · recibido el ${receipt.received_at}`}
      onClose={onClose}
      pending={false}
      width={560}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {error && (
          <Aviso tono="error" compacto>
            {error}
          </Aviso>
        )}

        {/* Aviso COPY §3/§7 — lo que el cliente ve hoy. */}
        <Aviso tono="atencion" compacto titulo="El cliente ve">
          “{UNIDENTIFIED_CLIENT_NOTICE}”
        </Aviso>

        {eligible.length === 0 ? (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              border: "1px dashed var(--border-strong)",
              borderRadius: "var(--r-md)",
              font: "500 12px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            No hay facturas en {receipt.currency} con saldo ≥ $
            {fmt(receipt.amount)} para aplicar este pago. Emite o reliquida la
            factura primero.
          </div>
        ) : (
          <>
            <div>
              <label className="studio-label" htmlFor="ident-client">
                Cliente
              </label>
              <select
                id="ident-client"
                className="studio-input"
                value={clientMarkbox}
                onChange={(e) => {
                  setClientMarkbox(e.target.value);
                  setInvoiceId("");
                }}
              >
                <option value="">Elegir cliente…</option>
                {clients.map((c) => (
                  <option key={c.markbox} value={c.markbox}>
                    {c.markbox} · {c.name}
                  </option>
                ))}
              </select>
            </div>

            {clientMarkbox && (
              <div>
                <label className="studio-label" htmlFor="ident-invoice">
                  Factura (saldo ≥ monto del pago)
                </label>
                <select
                  id="ident-invoice"
                  className="studio-input"
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value)}
                >
                  <option value="">Elegir factura…</option>
                  {invoiceOptions.map((r) => (
                    <option key={r.invoice.id} value={r.invoice.id}>
                      {r.invoice.invoice_code} · saldo ${fmt(r.balance)}
                      {r.invoice.shipment_code
                        ? ` · ${r.invoice.shipment_code}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selected && (
              <Aviso tono="info" compacto>
                Se aplican <strong>${fmt(receipt.amount)}</strong> a{" "}
                <strong>{selected.invoice.invoice_code}</strong> con imputación
                retroactiva al <strong>{receipt.received_at}</strong> (fecha de
                recepción de fondos). Quedará un saldo de $
                {fmt(Math.max(0, selected.balance - receipt.amount))}.
              </Aviso>
            )}
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={onClose}
          >
            Cancelar
          </button>
          <ActionButton
            variant="primary"
            size="sm"
            idleLabel="Identificar y aplicar"
            loadingLabel="Aplicando…"
            successLabel="Pago aplicado"
            idleIcon={Icon.check(13)}
            disabled={!selected}
            onAction={async () => {
              setError(null);
              if (!selected) return { error: "Elige la factura destino." };
              const r = await identifyPayment(receipt.id, selected.invoice.id);
              if (r.error) return { error: r.error };
              onDone(r.invoiceCode, r.fullyPaid ?? false);
              return undefined;
            }}
            onError={setError}
          />
        </div>
      </div>
    </DrawerShell>
  );
}
