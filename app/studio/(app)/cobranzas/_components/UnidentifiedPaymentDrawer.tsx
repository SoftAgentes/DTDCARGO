"use client";

import { fechaCaracas } from "@/lib/shared/fechas-caracas";

/**
 * Drawer "+ Pago sin identificar" (SDD-0068 #2 · cláusula 7.3 del Acuerdo).
 *
 * Registra plata que llegó SIN referencia: monto, moneda, canal, cuenta de
 * caja, fecha de recepción, referencia bancaria opcional y notas. SIN factura
 * ni cliente — quedan NULL hasta la identificación retroactiva (decisión #6).
 * El asiento va DR caja / CR 2.1.8 "Fondos por identificar".
 */

import { useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { INVOICE_CURRENCY_OPTIONS, type InvoiceCurrency } from "@/lib/studio/invoice-types";
import {
  PAYMENT_METHOD_OPTIONS,
  UNIDENTIFIED_CLIENT_NOTICE,
  type PaymentMethod,
} from "@/lib/studio/payment-types";
import { registerUnidentifiedPayment } from "../actions";
import type { CashAccountOption } from "./CobranzaDrawer";

export function UnidentifiedPaymentDrawer({
  cashAccounts,
  onClose,
  onDone,
}: {
  cashAccounts: CashAccountOption[];
  onClose: () => void;
  onDone: (receiptCode: string | undefined) => void;
}) {
  const today = fechaCaracas();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<InvoiceCurrency>("USD");
  const [fxRate, setFxRate] = useState<string>("");
  const [cashAccountId, setCashAccountId] = useState<string>(
    cashAccounts[0]?.id ?? "",
  );
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [receivedAt, setReceivedAt] = useState<string>(today);
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const amt = Number(amount) || 0;
  const fx = Number(fxRate) || 0;
  const needsFx = currency === "VES";
  const noCashAccounts = cashAccounts.length === 0;
  const valid =
    amt > 0 && !!cashAccountId && !noCashAccounts && (!needsFx || fx > 0);

  return (
    <DrawerShell
      title="Pago sin identificar"
      subtitle="Fondos en cuenta sin cruce · cláusula 7.3 del Acuerdo"
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

        {/* Aviso COPY §3 — lo que el cliente ve mientras el pago no cruza. */}
        <Aviso tono="atencion" compacto titulo="El cliente ve">
          “{UNIDENTIFIED_CLIENT_NOTICE}”
        </Aviso>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="studio-label" htmlFor="unid-amount">
              Monto recibido
            </label>
            <NumericInput
              id="unid-amount"
              type="currency"
              currency="USD"
              min={0}
              placeholder="0.00"
              value={amount === "" ? null : Number(amount)}
              onChange={(v) => setAmount(v != null ? String(v) : "")}
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="unid-currency">
              Moneda
            </label>
            <select
              id="unid-currency"
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
        </div>

        {needsFx && (
          <div>
            <label className="studio-label" htmlFor="unid-fx">
              Tasa BCV (VES/USD)
            </label>
            <NumericInput
              id="unid-fx"
              type="decimal"
              min={0}
              placeholder="36.50"
              value={fxRate === "" ? null : Number(fxRate)}
              onChange={(v) => setFxRate(v != null ? String(v) : "")}
            />
          </div>
        )}

        <div>
          <label className="studio-label" htmlFor="unid-cash-account">
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
              plan en Contabilidad para registrar pagos con asiento.
            </p>
          ) : (
            <select
              id="unid-cash-account"
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="studio-label" htmlFor="unid-method">
              Canal
            </label>
            <select
              id="unid-method"
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
            <label className="studio-label" htmlFor="unid-date">
              Fecha de recepción
            </label>
            <input
              id="unid-date"
              type="date"
              className="studio-input studio-input-mono"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="studio-label" htmlFor="unid-ref">
            Referencia bancaria{" "}
            <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
          </label>
          <input
            id="unid-ref"
            type="text"
            className="studio-input"
            placeholder="Nro de transferencia, captura…"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>

        <div>
          <label className="studio-label" htmlFor="unid-notes">
            Notas <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
          </label>
          <textarea
            id="unid-notes"
            className="studio-input"
            rows={2}
            placeholder="Banco emisor, posible cliente, contexto…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ resize: "vertical" }}
          />
        </div>

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
            idleLabel="Registrar pago"
            loadingLabel="Registrando…"
            successLabel="Pago registrado"
            idleIcon={Icon.check(13)}
            disabled={!valid}
            onAction={async () => {
              setError(null);
              const r = await registerUnidentifiedPayment({
                amount: amt,
                currency,
                fxRate: needsFx || fx > 0 ? fx || null : null,
                cashAccountId,
                method,
                receivedAt,
                reference: reference.trim() || null,
                notes: notes.trim() || null,
              });
              if (r.error) return { error: r.error };
              onDone(r.receiptCode);
              return undefined;
            }}
            onError={setError}
          />
        </div>
      </div>
    </DrawerShell>
  );
}
