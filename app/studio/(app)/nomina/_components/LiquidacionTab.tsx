"use client";

/**
 * LiquidacionTab — finiquitos de egreso (SDD-0109). Lista con Badge de estado +
 * el detalle (FiniquitoDetalle) = desglose de renglones. El cálculo es advisory
 * (criterio salarial = parámetro); el contador valida antes de pagar.
 */

import { useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  settlementStatusLabel,
  settlementStatusTone,
  terminationCauseLabel,
  type Settlement,
} from "@/lib/studio/nomina/settlement-types";
import { FiniquitoDetalle } from "./FiniquitoDetalle";

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });
}

const COLS = "minmax(150px,1.2fr) minmax(140px,1fr) 130px 120px 100px 96px";

export function LiquidacionTab({
  settlements,
  hasEmployees,
  onNew,
}: {
  settlements: Settlement[];
  hasEmployees: boolean;
  onNew: () => void;
}) {
  const [selected, setSelected] = useState<Settlement | null>(null);

  if (selected) {
    // Releer del array por si cambió (tras una acción + revalidate desmonta igual).
    const fresh = settlements.find((s) => s.id === selected.id) ?? selected;
    return <FiniquitoDetalle settlement={fresh} onBack={() => setSelected(null)} />;
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--s-4)",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          {settlements.length === 0
            ? "Sin finiquitos."
            : `${settlements.length} ${settlements.length === 1 ? "finiquito" : "finiquitos"}`}
        </div>
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={onNew}
          disabled={!hasEmployees}
        >
          + Generar finiquito
        </button>
      </div>

      {settlements.length === 0 ? (
        <EmptyState
          eyebrow="Sin finiquitos"
          title="Aún no liquidas a ningún empleado."
          description={
            hasEmployees
              ? "Genera el finiquito de egreso de un empleado: prestaciones (Art. 142), fracciones de vacaciones/utilidades e indemnización según la causa de terminación. El cálculo es advisory; el contador valida antes de pagar."
              : "Primero registra al menos un empleado para poder liquidar."
          }
          action={
            hasEmployees ? (
              <button type="button" className="studio-btn studio-btn-primary" onClick={onNew}>
                + Generar finiquito
              </button>
            ) : undefined
          }
        />
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: COLS,
              gap: 12,
              padding: "10px 20px",
              font: "700 9.5px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-mute)",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-elevated)",
            }}
          >
            <span>Empleado</span>
            <span>Causa</span>
            <span>Egreso</span>
            <span style={{ textAlign: "right" }}>Neto</span>
            <span>Estado</span>
            <span style={{ textAlign: "right" }}>Acciones</span>
          </div>
          {settlements.map((s, i) => (
            <FiniquitoRow key={s.id} s={s} first={i === 0} onOpen={() => setSelected(s)} />
          ))}
        </div>
      )}
    </>
  );
}

function FiniquitoRow({
  s,
  first,
  onOpen,
}: {
  s: Settlement;
  first: boolean;
  onOpen: () => void;
}) {
  const dimmed = s.status === "anulado";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: COLS,
        gap: 12,
        padding: "12px 20px",
        alignItems: "center",
        borderTop: first ? 0 : "1px solid var(--border)",
        opacity: dimmed ? 0.6 : 1,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            font: "700 13px/1.2 var(--f-sans)",
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {s.employee_name}
        </div>
        <div style={{ font: "600 11px/1.3 var(--f-mono)", color: "var(--ink-mute)" }}>
          {s.settlement_code} · {s.employee_code}
        </div>
      </div>
      <span style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--ink-soft)", minWidth: 0 }}>
        {terminationCauseLabel(s.termination_cause)}
      </span>
      <span style={{ font: "600 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
        {fmtDate(s.termination_date)}
      </span>
      <span style={{ font: "700 12.5px/1 var(--f-mono)", color: "var(--ink)", textAlign: "right" }}>
        {fmtUsd(s.total_net_usd)}
      </span>
      <Badge tone={settlementStatusTone(s.status)} size="sm">
        {settlementStatusLabel(s.status)}
      </Badge>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
        <button
          type="button"
          onClick={onOpen}
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{ padding: "6px 10px" }}
        >
          Ver
        </button>
      </div>
    </div>
  );
}
