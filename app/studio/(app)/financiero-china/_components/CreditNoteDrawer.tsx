"use client";

/**
 * Drawer de alta de una nota de crédito sobre un cargo (SDD-0059 · Slice B2).
 *
 * La corrección del error de facturación recurrente (ej: 超重 Overweight). Al
 * aplicarla, el cargo pasa a `corregido` y el net_amount se recalcula
 * (amount − Σ notas). Nunca se paga el bruto si hay nota aplicada (guard en lib).
 */

import { useState, useTransition } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import type { SupplierChargeWithNet } from "@/lib/studio/partner-finance/types";
import { addCreditNoteAction } from "../actions";

function fmtAmount(n: number, currency: string): string {
  const sym = currency === "RMB" ? "¥" : "$";
  return `${sym}${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function CreditNoteDrawer({
  charge,
  onClose,
}: {
  charge: SupplierChargeWithNet;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [issuedOn, setIssuedOn] = useState("");

  const canSubmit = reason.trim().length > 0 && (amount ?? 0) > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addCreditNoteAction({
        charge_id: charge.id,
        reason,
        amount,
        currency: charge.currency,
        issued_on: issuedOn || null,
      });
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Nota de crédito aplicada");
      onClose();
    });
  };

  return (
    <DrawerShell
      title="Aplicar nota de crédito"
      subtitle={charge.description}
      onClose={onClose}
      pending={pending}
      width={520}
    >
      <form
        id="fc-credit-form"
        onSubmit={onSubmit}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {error && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "var(--r-md)",
              background: "var(--danger-bg)",
              color: "var(--danger)",
              font: "600 12px/1.4 var(--f-sans)",
            }}
          >
            {error}
          </div>
        )}

        {/* Resumen del cargo original */}
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "var(--r-md)",
            background: "var(--bg-elevated)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                font: "700 10px/1 var(--f-sans)",
                color: "var(--ink-soft)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Cargo bruto
            </div>
            <div
              style={{
                font: "800 16px/1 var(--f-mono)",
                color: "var(--ink)",
                marginTop: 4,
              }}
            >
              {fmtAmount(charge.amount, charge.currency)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                font: "700 10px/1 var(--f-sans)",
                color: "var(--ink-soft)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Neto actual
            </div>
            <div
              style={{
                font: "800 16px/1 var(--f-mono)",
                color: "var(--success)",
                marginTop: 4,
              }}
            >
              {fmtAmount(charge.net_amount, charge.currency)}
            </div>
          </div>
        </div>

        <div>
          <label className="studio-label" htmlFor="fc-credit-reason">
            Motivo
          </label>
          <input
            id="fc-credit-reason"
            className="studio-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Sobrepeso mal facturado · ajuste acordado…"
            required
          />
        </div>

        <div>
          <label className="studio-label" htmlFor="fc-credit-amount">
            Monto a acreditar <span style={{ color: "var(--ink-mute)" }}>({charge.currency})</span>
          </label>
          <NumericInput
            id="fc-credit-amount"
            type="decimal"
            value={amount}
            onChange={setAmount}
            min={0}
            max={charge.amount}
            placeholder="0.00"
            required
          />
        </div>

        <div>
          <label className="studio-label" htmlFor="fc-credit-date">
            Fecha de emisión <span style={{ color: "var(--ink-mute)" }}>(opcional)</span>
          </label>
          <input
            id="fc-credit-date"
            type="date"
            className="studio-input"
            value={issuedOn}
            onChange={(e) => setIssuedOn(e.target.value)}
          />
        </div>
      </form>

      <DrawerFooter
        formId="fc-credit-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel="Aplicar nota"
      />
    </DrawerShell>
  );
}
