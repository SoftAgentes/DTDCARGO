"use client";

/**
 * WithholdingDrawer — nuevo comprobante de retención (SDD-0104 · Slice B).
 *
 * DrawerShell + DrawerFooter compartidos (form HTML5 con form="…", sin
 * requestSubmit hack). useActionState con createWithholdingAction. El monto
 * retenido se calcula en vivo (base × % / 100) como ayuda visual, pero la action
 * lo RECALCULA server-side (no se confía en el valor del form). Nº de
 * comprobante CAPTURADO del portal SENIAT (el ERP no inventa correlativos).
 */

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import {
  WITHHOLDING_TYPES,
  computeWithholdingAmount,
  withholdingTypeLabel,
  type WithholdingActionState,
  type WithholdingType,
} from "@/lib/studio/fiscal/withholding-types";
import { createWithholdingAction } from "../actions";

const FORM_ID = "withholding-drawer-form";
const initialState: WithholdingActionState = {};

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const labelStyle: React.CSSProperties = {
  font: "700 11px/1 var(--f-sans)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--ink-soft)",
  marginBottom: 6,
  display: "block",
};
const fieldStyle: React.CSSProperties = { display: "block" };
const errStyle: React.CSSProperties = {
  font: "500 11px/1.3 var(--f-sans)",
  color: "var(--danger)",
  marginTop: 4,
};

export function WithholdingDrawer({
  period,
  onClose,
  onSaved,
}: {
  period: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    createWithholdingAction,
    initialState,
  );

  const [type, setType] = useState<WithholdingType>("iva");
  const [base, setBase] = useState<number | null>(null);
  const [pct, setPct] = useState<number | null>(type === "iva" ? 75 : null);

  // Monto retenido en vivo (solo ayuda visual; el server recalcula).
  const previewAmount = useMemo(() => {
    if (base == null || pct == null) return null;
    return computeWithholdingAmount(base, pct);
  }, [base, pct]);

  useEffect(() => {
    if (state.ok) onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  const fe = state.fieldErrors ?? {};

  return (
    <DrawerShell
      title="Nuevo comprobante de retención"
      subtitle="El nº de comprobante lo asigna el portal SENIAT — ingrésalo aquí."
      onClose={onClose}
      pending={isPending}
      width={560}
    >
      <form
        id={FORM_ID}
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
        {state.error && (
          <Aviso tono="error" compacto>
            {state.error}
          </Aviso>
        )}

        {/* Período (oculto: lo fija el selector de mes del listado). */}
        <input type="hidden" name="period" value={period} />

        <div>
          <label style={labelStyle} htmlFor="wh-type">
            Tipo de retención
          </label>
          <select
            id="wh-type"
            name="withholding_type"
            className="studio-input"
            value={type}
            onChange={(e) => {
              const v = e.target.value as WithholdingType;
              setType(v);
              if (v === "iva" && pct == null) setPct(75);
            }}
            style={fieldStyle}
          >
            {WITHHOLDING_TYPES.map((t) => (
              <option key={t} value={t}>
                {withholdingTypeLabel(t)}
              </option>
            ))}
          </select>
          {fe.withholdingType && <div style={errStyle}>{fe.withholdingType}</div>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle} htmlFor="wh-voucher">
              Nº de comprobante
            </label>
            <input
              id="wh-voucher"
              name="voucher_number"
              className="studio-input studio-input-mono"
              placeholder="20260600001234"
              style={fieldStyle}
            />
            {fe.voucherNumber && <div style={errStyle}>{fe.voucherNumber}</div>}
          </div>
          <div>
            <label style={labelStyle} htmlFor="wh-date">
              Fecha
            </label>
            <input
              id="wh-date"
              name="op_date"
              type="date"
              className="studio-input studio-input-mono"
              style={fieldStyle}
            />
            {fe.opDate && <div style={errStyle}>{fe.opDate}</div>}
          </div>
        </div>

        <div>
          <label style={labelStyle} htmlFor="wh-supplier">
            Proveedor retenido
          </label>
          <input
            id="wh-supplier"
            name="supplier_name"
            className="studio-input"
            placeholder="Nombre del proveedor"
            style={fieldStyle}
          />
          {fe.supplierName && <div style={errStyle}>{fe.supplierName}</div>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle} htmlFor="wh-rif">
              RIF (opcional)
            </label>
            <input
              id="wh-rif"
              name="rif"
              className="studio-input studio-input-mono"
              placeholder="J-12345678-9"
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="wh-doc">
              Documento origen (opcional)
            </label>
            <input
              id="wh-doc"
              name="source_doc"
              className="studio-input"
              placeholder="Nº de factura del proveedor"
              style={fieldStyle}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle} htmlFor="wh-base">
              {type === "iva"
                ? "Base (IVA de la compra)"
                : "Base (monto / honorario)"}
            </label>
            <NumericInput
              id="wh-base"
              name="base"
              type="decimal"
              precision={2}
              min={0}
              value={base}
              onChange={setBase}
              required
              aria-invalid={!!fe.base}
              aria-label={
                type === "iva"
                  ? "Base de IVA de la compra"
                  : "Base del monto u honorario"
              }
            />
            {fe.base && <div style={errStyle}>{fe.base}</div>}
          </div>
          <div>
            <label style={labelStyle} htmlFor="wh-pct">
              % de retención
            </label>
            <NumericInput
              id="wh-pct"
              name="pct"
              type="decimal"
              unit="%"
              precision={3}
              min={0}
              max={100}
              value={pct}
              onChange={setPct}
              required
              aria-invalid={!!fe.pct}
              aria-label="Porcentaje de retención"
            />
            {fe.pct && <div style={errStyle}>{fe.pct}</div>}
          </div>
        </div>

        {/* Monto retenido = base × % / 100 (lo recalcula el server). */}
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "12px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            className="studio-eyebrow"
            style={{ color: "var(--ink-soft)" }}
          >
            Monto retenido
          </span>
          <span style={{ font: "800 18px/1 var(--f-mono)", color: "var(--ink)" }}>
            {previewAmount == null ? "—" : fmtMoney(previewAmount)}
          </span>
        </div>
        {/* Espejo del monto para el form; el server lo recalcula igual. */}
        <input
          type="hidden"
          name="amount"
          value={previewAmount == null ? "" : String(previewAmount)}
        />
        {fe.amount && <div style={errStyle}>{fe.amount}</div>}

        <div>
          <label style={labelStyle} htmlFor="wh-notes">
            Notas (opcional)
          </label>
          <textarea
            id="wh-notes"
            name="notes"
            className="studio-input"
            rows={2}
            style={{ ...fieldStyle, resize: "vertical" }}
          />
        </div>
      </form>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit
        submitLabel="Registrar comprobante"
        pendingLabel="Registrando…"
      />
    </DrawerShell>
  );
}
