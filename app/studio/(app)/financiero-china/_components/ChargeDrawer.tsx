"use client";

/**
 * Drawer de alta de un cargo del socio China (SDD-0059 · Slice B2).
 *
 * Usa el DrawerShell compartido (form id + button form= en el footer, HTML5
 * estándar). El amount usa <NumericInput> (regla del Studio); la moneda es un
 * select que cubre RMB (que NumericInput no adornará — el símbolo lo da el
 * preview/label). Valida en server con validateChargeInput.
 */

import { useState, useTransition } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { PARTNER_CURRENCIES } from "@/lib/studio/partner-finance/types";
import { addChargeAction } from "../actions";

export function ChargeDrawer({
  supplierId,
  supplierLabel,
  onClose,
}: {
  supplierId: string;
  supplierLabel: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const [description, setDescription] = useState("");
  const [descriptionCn, setDescriptionCn] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [chargedOn, setChargedOn] = useState("");

  const canSubmit = description.trim().length > 0 && (amount ?? 0) > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addChargeAction({
        supplier_id: supplierId,
        description,
        description_cn: descriptionCn || null,
        amount,
        currency,
        charged_on: chargedOn || null,
      });
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Cargo creado");
      onClose();
    });
  };

  return (
    <DrawerShell
      title="Nuevo cargo del socio"
      subtitle={supplierLabel}
      onClose={onClose}
      pending={pending}
      width={560}
    >
      <form
        id="fc-charge-form"
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

        <div>
          <label className="studio-label" htmlFor="fc-charge-desc">
            Concepto
          </label>
          <input
            id="fc-charge-desc"
            className="studio-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Flete · sobrepeso · BL · inspección…"
            required
          />
        </div>

        <div>
          <label className="studio-label" htmlFor="fc-charge-desc-cn">
            Concepto en chino <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
          </label>
          <input
            id="fc-charge-desc-cn"
            className="studio-input"
            value={descriptionCn}
            onChange={(e) => setDescriptionCn(e.target.value)}
            placeholder="超重 · 运费…"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
          <div>
            <label className="studio-label" htmlFor="fc-charge-amount">
              Monto
            </label>
            <NumericInput
              id="fc-charge-amount"
              type="decimal"
              value={amount}
              onChange={setAmount}
              min={0}
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="fc-charge-currency">
              Moneda
            </label>
            <select
              id="fc-charge-currency"
              className="studio-input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {PARTNER_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="studio-label" htmlFor="fc-charge-date">
            Fecha del cargo <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
          </label>
          <input
            id="fc-charge-date"
            type="date"
            className="studio-input"
            value={chargedOn}
            onChange={(e) => setChargedOn(e.target.value)}
          />
        </div>
      </form>

      <DrawerFooter
        formId="fc-charge-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel="Crear cargo"
      />
    </DrawerShell>
  );
}
