"use client";

/**
 * Cargos del socio + notas de crédito (SDD-0059 · Slice B2).
 *
 * Lista de supplier_charges CON net_amount derivado (amount − Σ notas vivas) +
 * estado (vigente/disputado/corregido/cancelado) + acciones: aplicar nota de
 * crédito (evita el pago duplicado del 超重 Overweight), disputar, cancelar.
 * + drawer de alta de cargo.
 *
 * El net_amount NO es columna — lo deriva charges-queries.ts (deriveNetAmount).
 */

import { useState, useTransition } from "react";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  canTransitionCharge,
  chargeStatusLabel,
  chargeStatusTone,
  type SupplierChargeWithNet,
} from "@/lib/studio/partner-finance/types";
import type { SupplierOption } from "./FinancieroChinaClient";
import { SupplierPicker } from "./SupplierPicker";
import { ChargeDrawer } from "./ChargeDrawer";
import { CreditNoteDrawer } from "./CreditNoteDrawer";
import { transitionCharge } from "../actions";

function fmtAmount(n: number, currency: string): string {
  const sym = currency === "RMB" ? "¥" : "$";
  return `${sym}${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const GRID = "120px 1fr 120px 120px 110px 130px";

export function ChargesTab({
  suppliers,
  selectedSupplier,
  supplierId,
  onSupplierChange,
  charges,
  loading,
  loadError,
}: {
  suppliers: SupplierOption[];
  selectedSupplier: SupplierOption | null;
  supplierId: string | null;
  onSupplierChange: (id: string) => void;
  charges: SupplierChargeWithNet[];
  loading: boolean;
  loadError: string | null;
}) {
  const [drawer, setDrawer] = useState<"charge" | null>(null);
  const [creditFor, setCreditFor] = useState<SupplierChargeWithNet | null>(null);
  const [pending, startTransition] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);
  const toast = useToast();

  const onTransition = (
    charge: SupplierChargeWithNet,
    to: "disputado" | "cancelado",
  ) => {
    setRowError(null);
    startTransition(async () => {
      const res = await transitionCharge({
        chargeId: charge.id,
        from: charge.status,
        to,
      });
      if (res.error) {
        setRowError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(to === "disputado" ? "Cargo disputado" : "Cargo cancelado");
    });
  };

  return (
    <div>
      {/* Selector + acción de alta */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <SupplierPicker
          suppliers={suppliers}
          value={supplierId}
          onChange={onSupplierChange}
          disabled={loading || pending}
        />
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={() => setDrawer("charge")}
          disabled={!supplierId}
        >
          + Nuevo cargo
        </button>
      </div>

      {(loadError || rowError) && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--r-md)",
            background: "var(--danger-bg)",
            color: "var(--danger)",
            font: "600 12px/1.4 var(--f-sans)",
            marginBottom: 16,
          }}
        >
          {loadError ?? rowError}
        </div>
      )}

      {charges.length === 0 ? (
        <EmptyState
          eyebrow="Sin cargos"
          title="Este socio no tiene cargos registrados."
          description="Cargá las líneas de cargo que factura el socio (flete, sobrepeso, BL, inspección). Cuando llegue una corrección, aplicá una nota de crédito y el monto neto se recalcula solo."
        />
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              gap: 12,
              padding: "12px 20px",
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border)",
              font: "700 10px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            <span>Fecha</span>
            <span>Concepto</span>
            <span style={{ textAlign: "right" }}>Bruto</span>
            <span style={{ textAlign: "right" }}>Neto</span>
            <span>Estado</span>
            <span style={{ textAlign: "right" }}>Acciones</span>
          </div>

          {charges.map((c, i) => {
            const credited = c.credited > 0;
            return (
              <div
                key={c.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID,
                  gap: 12,
                  padding: "14px 20px",
                  borderTop: i > 0 ? "1px solid var(--border)" : 0,
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    font: "700 11px/1 var(--f-mono)",
                    color: "var(--ink-soft)",
                  }}
                >
                  {c.charged_on?.slice(0, 10) ?? "—"}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      font: "600 12.5px/1.3 var(--f-sans)",
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.description}
                  </div>
                  {c.description_cn && (
                    <div
                      style={{
                        font: "500 11px/1.2 var(--f-cn)",
                        color: "var(--ink-mute)",
                        marginTop: 3,
                      }}
                    >
                      {c.description_cn}
                    </div>
                  )}
                </div>
                <span
                  style={{
                    textAlign: "right",
                    font: "700 12px/1 var(--f-mono)",
                    color: credited ? "var(--ink-mute)" : "var(--ink)",
                    textDecoration: credited ? "line-through" : "none",
                  }}
                >
                  {fmtAmount(c.amount, c.currency)}
                </span>
                <span
                  style={{
                    textAlign: "right",
                    font: "800 12.5px/1 var(--f-mono)",
                    color: credited ? "var(--success)" : "var(--ink)",
                  }}
                >
                  {fmtAmount(c.net_amount, c.currency)}
                </span>
                <span>
                  <Badge tone={chargeStatusTone(c.status)} size="sm" dot>
                    {chargeStatusLabel(c.status)}
                  </Badge>
                </span>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    justifyContent: "flex-end",
                    flexWrap: "wrap",
                  }}
                >
                  {c.status !== "cancelado" && c.status !== "corregido" && (
                    <button
                      type="button"
                      className="studio-btn studio-btn-ghost studio-btn-xs"
                      onClick={() => setCreditFor(c)}
                      disabled={pending}
                    >
                      Nota de crédito
                    </button>
                  )}
                  {canTransitionCharge(c.status, "disputado") && (
                    <button
                      type="button"
                      className="studio-btn studio-btn-ghost studio-btn-xs"
                      onClick={() => onTransition(c, "disputado")}
                      disabled={pending}
                      style={{ color: "var(--warning)" }}
                    >
                      Disputar
                    </button>
                  )}
                  {canTransitionCharge(c.status, "cancelado") && (
                    <button
                      type="button"
                      className="studio-btn studio-btn-ghost studio-btn-xs"
                      onClick={() => onTransition(c, "cancelado")}
                      disabled={pending}
                      style={{ color: "var(--danger)" }}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {drawer === "charge" && supplierId && (
        <ChargeDrawer
          supplierId={supplierId}
          supplierLabel={selectedSupplier?.name ?? ""}
          onClose={() => setDrawer(null)}
        />
      )}

      {creditFor && (
        <CreditNoteDrawer
          charge={creditFor}
          onClose={() => setCreditFor(null)}
        />
      )}
    </div>
  );
}
