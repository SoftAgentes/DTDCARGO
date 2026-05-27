"use client";

/**
 * CostHelpers — sub-componente del CreateFilingDrawer.
 *
 * Permite ingresar un "valor mercadería" base y aplicar los porcentajes
 * IGTF 3% / IVA 16% para llenar los campos de impuestos en el form padre.
 *
 * Es un helper de cálculo: no persiste el valor base (no hay columna para él).
 */

import { useState } from "react";
import { IGTF_RATE, IVA_RATE } from "@/lib/studio/customs-types";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";

interface Props {
  onApplyIgtf: (value: number) => void;
  onApplyIva: (value: number) => void;
}

export function CostHelpers({ onApplyIgtf, onApplyIva }: Props) {
  const [base, setBase] = useState<string>("");
  const baseNum = Number(base) || 0;

  const igtfPreview = baseNum * IGTF_RATE;
  const ivaPreview = baseNum * IVA_RATE;

  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              font: "700 10.5px/1 var(--f-sans)",
              color: "var(--wine)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Helper de cálculo
          </div>
          <div
            style={{
              font: "500 11px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: 3,
            }}
          >
            Ingresá el valor base de la mercadería y aplicá las tasas.
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto",
          gap: 8,
          alignItems: "flex-end",
        }}
      >
        <div>
          <label htmlFor="cost-base" className="studio-label">
            Valor mercadería
          </label>
          <NumericInput
            id="cost-base"
            type="currency"
            currency="USD"
            min={0}
            placeholder="0.00"
            value={base === "" ? null : Number(base)}
            onChange={(v) => setBase(v != null ? String(v) : "")}
          />
        </div>
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          disabled={baseNum <= 0}
          onClick={() => onApplyIgtf(Math.round(igtfPreview * 100) / 100)}
          style={{
            height: 38,
            opacity: baseNum <= 0 ? 0.5 : 1,
            whiteSpace: "nowrap",
          }}
        >
          IGTF 3%
          <span
            style={{
              font: "600 10.5px/1 var(--f-mono)",
              color: "var(--warning)",
              marginLeft: 6,
            }}
          >
            ${igtfPreview.toFixed(0)}
          </span>
        </button>
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          disabled={baseNum <= 0}
          onClick={() => onApplyIva(Math.round(ivaPreview * 100) / 100)}
          style={{
            height: 38,
            opacity: baseNum <= 0 ? 0.5 : 1,
            whiteSpace: "nowrap",
          }}
        >
          IVA 16%
          <span
            style={{
              font: "600 10.5px/1 var(--f-mono)",
              color: "var(--info)",
              marginLeft: 6,
            }}
          >
            ${ivaPreview.toFixed(0)}
          </span>
        </button>
      </div>
    </div>
  );
}
