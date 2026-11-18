"use client";

/**
 * Drawer de alta de una conversión de divisa del socio China (SDD-0115 Slice C).
 *
 * Reusa el backend completo: addConversionAction (valida con
 * validateConversionInput, persiste con addConversion calculando spread +
 * comisión, y cabla el asiento forex vía syncConversionJournalEntry / SDD-0110).
 * effective_rate se deriva de to/from si no se da; market_rate + commission son
 * opcionales (sin market_rate el spread = 0). NumericInput por la regla del Studio.
 */

import { useState, useTransition } from "react";
import { DrawerShell, DrawerFooter } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { addConversionAction } from "../actions";

const FROM_CURRENCIES = ["USD", "USDT", "VES"] as const;
const TO_CURRENCIES = ["RMB", "USD"] as const;

export function ConversionDrawer({ onClose }: { onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const [fromCurrency, setFromCurrency] = useState<string>("USD");
  const [toCurrency, setToCurrency] = useState<string>("RMB");
  const [fromAmount, setFromAmount] = useState<number | null>(null);
  const [toAmount, setToAmount] = useState<number | null>(null);
  const [marketRate, setMarketRate] = useState<number | null>(null);
  const [commission, setCommission] = useState<number | null>(null);
  const [convertedOn, setConvertedOn] = useState("");
  const [notes, setNotes] = useState("");

  const canSubmit = (fromAmount ?? 0) > 0 && (toAmount ?? 0) > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addConversionAction({
        from_currency: fromCurrency,
        to_currency: toCurrency,
        from_amount: fromAmount,
        to_amount: toAmount,
        // effective_rate se deriva en el validador desde to/from si no se manda.
        market_rate: marketRate,
        commission_amount: commission,
        converted_on: convertedOn || null,
        notes: notes.trim() || null,
      });
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Conversión registrada");
      onClose();
    });
  };

  return (
    <DrawerShell
      title="Registrar conversión"
      subtitle="Forex del socio China · captura el spread como revenue"
      onClose={onClose}
      pending={pending}
      width={560}
    >
      <form
        id="fc-conversion-form"
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
          <Aviso tono="error" compacto>{error}</Aviso>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="studio-label" htmlFor="fc-conv-from">
              Moneda origen
            </label>
            <select
              id="fc-conv-from"
              className="studio-input"
              value={fromCurrency}
              onChange={(e) => setFromCurrency(e.target.value)}
            >
              {FROM_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="studio-label" htmlFor="fc-conv-to">
              Moneda destino
            </label>
            <select
              id="fc-conv-to"
              className="studio-input"
              value={toCurrency}
              onChange={(e) => setToCurrency(e.target.value)}
            >
              {TO_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="studio-label" htmlFor="fc-conv-from-amt">
              Monto origen ({fromCurrency})
            </label>
            <NumericInput
              id="fc-conv-from-amt"
              type="decimal"
              value={fromAmount}
              onChange={setFromAmount}
              placeholder="0.00"
              min={0}
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="fc-conv-to-amt">
              Monto destino ({toCurrency})
            </label>
            <NumericInput
              id="fc-conv-to-amt"
              type="decimal"
              value={toAmount}
              onChange={setToAmount}
              placeholder="0.00"
              min={0}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="studio-label" htmlFor="fc-conv-market">
              Tasa de mercado <span style={{ color: "var(--ink-soft)" }}>(opcional · para el spread)</span>
            </label>
            <NumericInput
              id="fc-conv-market"
              type="decimal"
              value={marketRate}
              onChange={setMarketRate}
              placeholder="0.00"
              min={0}
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="fc-conv-comm">
              Comisión explícita <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
            </label>
            <NumericInput
              id="fc-conv-comm"
              type="decimal"
              value={commission}
              onChange={setCommission}
              placeholder="0.00"
              min={0}
            />
          </div>
        </div>

        <div>
          <label className="studio-label" htmlFor="fc-conv-date">
            Fecha de conversión <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
          </label>
          <input
            id="fc-conv-date"
            type="date"
            className="studio-input"
            value={convertedOn}
            onChange={(e) => setConvertedOn(e.target.value)}
          />
        </div>

        <div>
          <label className="studio-label" htmlFor="fc-conv-notes">
            Notas <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
          </label>
          <textarea
            id="fc-conv-notes"
            className="studio-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Contexto de la operación…"
          />
        </div>
      </form>

      <DrawerFooter
        formId="fc-conversion-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel="Registrar conversión"
      />
    </DrawerShell>
  );
}
