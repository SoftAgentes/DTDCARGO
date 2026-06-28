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
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import type { SupplierClaimOffset } from "@/lib/studio/partner-finance/types";
import {
  claimOffsetStatusLabel,
  claimOffsetStatusTone,
  CLAIM_OFFSET_NEXT,
} from "@/lib/studio/partner-finance/types";
import type { SupplierOption } from "./FinancieroChinaClient";
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
  const toast = useToast();

  const supplierName = (id: string | null) =>
    id ? (suppliers.find((s) => s.id === id)?.name ?? "—") : "—";

  // En vuelo = todo lo que no está cerrado.
  const enVuelo = claimOffsets.filter((c) => c.status !== "cerrado");
  const totalEnVuelo = enVuelo.reduce((acc, c) => acc + c.amount_usd, 0);

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
                      {next ? (
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
    </div>
  );
}
