"use client";

/**
 * FiniquitoDetalle — desglose de un finiquito (SDD-0109): salario integral,
 * renglones (prestaciones, fracciones, indemnización, intereses, deducciones),
 * neto, y las acciones de lifecycle (confirmar = PDF imprimible + asiento de
 * provisión; anular = contra-asiento; regenerar si borrador). Aviso advisory
 * mientras esté en borrador. El detalle es imprimible desde el navegador.
 */

import { useState, useTransition, useEffect } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  settlementStatusLabel,
  settlementStatusTone,
  terminationCauseLabel,
  canTransitionSettlement,
  type Settlement,
  type SettlementLineRow,
} from "@/lib/studio/nomina/settlement-types";
import {
  confirmarFiniquitoAction,
  anularFiniquitoAction,
  regenerarFiniquitoAction,
  softDeleteFiniquitoAction,
  listSettlementLinesAction,
} from "../actions";

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

const LINE_COLS = "minmax(200px,1.6fr) 90px 120px 120px";

export function FiniquitoDetalle({
  settlement,
  onBack,
}: {
  settlement: Settlement;
  onBack: () => void;
}) {
  const [lines, setLines] = useState<SettlementLineRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    listSettlementLinesAction(settlement.id).then((res) => {
      if (!alive) return;
      if (res.error) setLoadError(res.error);
      else setLines(res.lines ?? []);
    });
    return () => {
      alive = false;
    };
  }, [settlement.id]);

  const run = (fn: () => Promise<{ error?: string }>) => {
    setActionError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setActionError(res.error);
      else onBack();
    });
  };

  const isDraft = settlement.status === "borrador";
  const canConfirm = canTransitionSettlement(settlement.status, "confirmado");
  const canAnular = canTransitionSettlement(settlement.status, "anulado");

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="studio-btn studio-btn-ghost studio-btn-sm"
        style={{ marginBottom: "var(--s-4)" }}
      >
        ← Volver a los finiquitos
      </button>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--s-3)",
          flexWrap: "wrap",
          marginBottom: "var(--s-4)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", marginBottom: 4 }}>
            <h2 className="studio-display" style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}>
              Finiquito {settlement.settlement_code}
            </h2>
            <Badge tone={settlementStatusTone(settlement.status)} size="sm">
              {settlementStatusLabel(settlement.status)}
            </Badge>
          </div>
          <div style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
            {settlement.employee_name} · {settlement.employee_code} ·{" "}
            {terminationCauseLabel(settlement.termination_cause)}
          </div>
          <div style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-mute)" }}>
            Ingreso {fmtDate(settlement.hire_date)} → egreso {fmtDate(settlement.termination_date)}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {isDraft && (
            <button
              type="button"
              onClick={() => run(() => regenerarFiniquitoAction(settlement.id))}
              disabled={isPending}
              className="studio-btn studio-btn-ghost studio-btn-sm"
            >
              Regenerar
            </button>
          )}
          {settlement.status !== "anulado" && (
            <button
              type="button"
              onClick={() => window.print()}
              className="studio-btn studio-btn-ghost studio-btn-sm"
            >
              Imprimir / PDF
            </button>
          )}
          {canConfirm && (
            <button
              type="button"
              onClick={() => run(() => confirmarFiniquitoAction(settlement.id))}
              disabled={isPending}
              className="studio-btn studio-btn-dark studio-btn-sm"
            >
              {isPending ? "Confirmando…" : "Confirmar (provisiona)"}
            </button>
          )}
          {canAnular && (
            <button
              type="button"
              onClick={() => run(() => anularFiniquitoAction(settlement.id))}
              disabled={isPending}
              className="studio-btn studio-btn-danger studio-btn-sm"
            >
              Anular
            </button>
          )}
          {settlement.status === "anulado" && (
            <button
              type="button"
              onClick={() => run(() => softDeleteFiniquitoAction(settlement.id))}
              disabled={isPending}
              className="studio-btn studio-btn-ghost studio-btn-sm"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <p
          role="alert"
          style={{
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--danger)",
            padding: "10px 12px",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-sm)",
            margin: "0 0 var(--s-4)",
          }}
        >
          {actionError}
        </p>
      )}

      {isDraft && (
        <p
          style={{
            font: "600 12px/1.5 var(--f-sans)",
            color: "var(--warning)",
            padding: "10px 12px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--warning)",
            borderRadius: "var(--r-sm)",
            margin: "0 0 var(--s-4)",
            maxWidth: "70ch",
          }}
        >
          Borrador advisory — el contador valida el criterio salarial antes de confirmar y pagar.
          Confirmar genera el asiento de provisión (DR cargas sociales / CR sueldos por pagar); el
          pago real sale luego por Tesorería.
        </p>
      )}

      {/* Totales */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "var(--s-3)",
          marginBottom: "var(--s-5)",
        }}
      >
        <TotalCard label="Salario integral / mes" value={fmtUsd(settlement.salario_integral_usd)} />
        <TotalCard label="Prestaciones" value={fmtUsd(settlement.total_prestaciones_usd)} />
        <TotalCard label="Fracciones" value={fmtUsd(settlement.total_fracciones_usd)} />
        <TotalCard label="Indemnización" value={fmtUsd(settlement.total_indemnizacion_usd)} />
        <TotalCard label="Neto a pagar" value={fmtUsd(settlement.total_net_usd)} strong />
      </div>

      {loadError ? (
        <p style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--danger)" }}>{loadError}</p>
      ) : lines === null ? (
        <p style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          Cargando desglose…
        </p>
      ) : lines.length === 0 ? (
        <EmptyState
          eyebrow="Sin renglones"
          title="El finiquito no tiene desglose."
          description="Regenera el finiquito (botón Regenerar) para recomputar los renglones."
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
              gridTemplateColumns: LINE_COLS,
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
            <span>Renglón</span>
            <span style={{ textAlign: "right" }}>Días</span>
            <span style={{ textAlign: "right" }}>Base / día</span>
            <span style={{ textAlign: "right" }}>Monto</span>
          </div>
          {lines.map((l, i) => (
            <div
              key={l.id}
              style={{
                display: "grid",
                gridTemplateColumns: LINE_COLS,
                gap: 12,
                padding: "11px 20px",
                alignItems: "center",
                borderTop: i === 0 ? 0 : "1px solid var(--border)",
              }}
            >
              <span style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                {l.label}
              </span>
              <span style={{ font: "600 12px/1 var(--f-mono)", color: "var(--ink-soft)", textAlign: "right" }}>
                {l.days == null ? "—" : l.days}
              </span>
              <span style={{ font: "600 12px/1 var(--f-mono)", color: "var(--ink-soft)", textAlign: "right" }}>
                {l.base_usd == null ? "—" : fmtUsd(l.base_usd)}
              </span>
              <span
                style={{
                  font: "700 12.5px/1 var(--f-mono)",
                  color: l.amount_usd < 0 ? "var(--danger)" : "var(--ink)",
                  textAlign: "right",
                }}
              >
                {fmtUsd(l.amount_usd)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TotalCard({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      style={{
        background: strong ? "var(--ink)" : "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          font: "700 9.5px/1 var(--f-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: strong ? "var(--ink-inv-mute)" : "var(--ink-mute)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ font: "800 18px/1 var(--f-mono)", color: strong ? "var(--ink-inv)" : "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
