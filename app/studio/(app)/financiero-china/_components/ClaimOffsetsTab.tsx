"use client";

/**
 * Tab "Cruces" del Financiero China (SDD-0115 sub-slice 2 · feature claim offsets).
 * Tablero del reclamo→proveedor→china→cliente con su máquina de estados. Reusa el
 * backend (addClaimOffsetAction + transitionClaimOffsetAction + el asiento 0110).
 * Solo-lectura + alta + avance de estado (un paso por click, con guard server-side).
 */

import { useState } from "react";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import type { SupplierClaimOffset } from "@/lib/studio/partner-finance/types";
import {
  claimOffsetStatusLabel,
  claimOffsetStatusTone,
  CLAIM_OFFSET_NEXT,
} from "@/lib/studio/partner-finance/types";
import type { SupplierOption } from "@/lib/studio/partner-finance/types";
import { ClaimOffsetDrawer } from "./ClaimOffsetDrawer";
import { transitionClaimOffsetAction } from "../actions";

function usd(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ClaimOffsetsTab({
  claimOffsets,
  suppliers,
}: {
  claimOffsets: SupplierClaimOffset[];
  suppliers: SupplierOption[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paymentDecision, setPaymentDecision] = useState<{
    claim: SupplierClaimOffset;
    supplier: string;
    effectiveDate: string;
    requestRef: string;
  } | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const [paymentError, setPaymentError] = useState<string>();
  const toast = useToast();

  const supplierName = (id: string | null) =>
    id ? (suppliers.find((s) => s.id === id)?.name ?? "—") : "—";

  // En vuelo = todo lo que no está cerrado.
  const enVuelo = claimOffsets.filter((c) => c.status !== "cerrado");
  const totalEnVuelo = enVuelo.reduce((acc, c) => acc + c.amount_usd, 0);

  const openPaymentDecision = (claim: SupplierClaimOffset) => {
    setPaymentError(undefined);
    setPaymentDecision({
      claim,
      supplier: supplierName(claim.supplier_id),
      effectiveDate: new Date().toISOString().slice(0, 10),
      requestRef: `partner-claim-payment:${claim.id}:${crypto.randomUUID()}`,
    });
  };

  const confirmPayment = async (reason: string) => {
    if (!paymentDecision || paymentPending) return;
    setPaymentPending(true);
    setPaymentError(undefined);
    try {
      const result = await transitionClaimOffsetAction({
        claimId: paymentDecision.claim.id,
        from: paymentDecision.claim.status,
        effectiveDate: paymentDecision.effectiveDate,
        reason,
        requestRef: paymentDecision.requestRef,
      });
      if (!result.ok) {
        setPaymentError(result.error ?? "No se pudo declarar el pago.");
        return;
      }
      toast.success(result.replayed ? "Pago ya registrado anteriormente" : "Pago en China registrado");
      setPaymentDecision(null);
    } finally {
      setPaymentPending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <KpiCard
          label="Cruces en vuelo"
          value={usd(totalEnVuelo)}
          sub={`${enVuelo.length} sin cerrar · ${claimOffsets.length} total`}
        />
        <button
          type="button"
          className="studio-btn studio-btn-primary studio-btn-sm"
          onClick={() => setDrawerOpen(true)}
        >
          + Nuevo cruce
        </button>
      </div>

      {claimOffsets.length === 0 ? (
        <EmptyState
          eyebrow="Cruces"
          title="Todavía no hay cruces registrados"
          description="Registra un reclamo al proveedor que se cobra en China y se aplica al cliente; avanza su estado paso a paso."
        />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink-soft)", borderBottom: "1.5px solid var(--border)" }}>
                <th style={{ padding: "8px 10px", font: "700 10px/1 var(--f-sans)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Fecha</th>
                <th style={{ padding: "8px 10px", font: "700 10px/1 var(--f-sans)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Proveedor</th>
                <th style={{ padding: "8px 10px", textAlign: "right", font: "700 10px/1 var(--f-sans)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Monto</th>
                <th style={{ padding: "8px 10px", font: "700 10px/1 var(--f-sans)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Estado</th>
                <th style={{ padding: "8px 10px", textAlign: "right", font: "700 10px/1 var(--f-sans)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Avanzar</th>
              </tr>
            </thead>
            <tbody>
              {claimOffsets.map((c) => {
                const next = CLAIM_OFFSET_NEXT[c.status];
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 10px", color: "var(--ink-soft)" }}>{c.claimed_on}</td>
                    <td style={{ padding: "8px 10px" }}>{supplierName(c.supplier_id)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--f-mono)" }}>{usd(c.amount_usd)}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <Badge tone={claimOffsetStatusTone(c.status)} size="sm">
                        {claimOffsetStatusLabel(c.status)}
                      </Badge>
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>
                      {next === "pagado_en_china" ? (
                        <button
                          type="button"
                          className="studio-btn studio-btn-ghost studio-btn-xs"
                          onClick={() => openPaymentDecision(c)}
                        >
                          → {claimOffsetStatusLabel(next)}
                        </button>
                      ) : next ? (
                        <ActionButton
                          variant="ghost"
                          size="xs"
                          idleLabel={`→ ${claimOffsetStatusLabel(next)}`}
                          loadingLabel="Avanzando…"
                          successLabel="Avanzado"
                          onAction={() => transitionClaimOffsetAction({ claimId: c.id, from: c.status })}
                          onError={(m) => toast.error(m)}
                          onSuccess={() => toast.success(`Cruce avanzado a ${claimOffsetStatusLabel(next)}`)}
                        />
                      ) : (
                        <span style={{ color: "var(--ink-mute)", fontSize: 11 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {drawerOpen && <ClaimOffsetDrawer suppliers={suppliers} onClose={() => setDrawerOpen(false)} />}
      <ConfirmDialog
        open={paymentDecision !== null}
        danger
        reason
        reasonRequired
        holdToConfirm
        initialFocus="safe"
        title="Declarar pago en China"
        message={
          paymentDecision
            ? `${paymentDecision.supplier} · ${usd(paymentDecision.claim.amount_usd)} · fecha efectiva ${paymentDecision.effectiveDate}. Esta decisión afirma que el valor ya fue pagado en China y quedará en auditoría.`
            : ""
        }
        confirmLabel="Declarar pagado"
        holdLabel="Mantén para declarar pagado"
        reasonLabel="Motivo o soporte de la decisión"
        reasonPlaceholder="Ej. Confirmado contra comprobante del socio"
        pending={paymentPending}
        error={paymentError}
        onCancel={() => {
          if (paymentPending) return;
          setPaymentDecision(null);
          setPaymentError(undefined);
        }}
        onConfirm={confirmPayment}
      />
    </div>
  );
}
