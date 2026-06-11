"use client";

/**
 * Orquestador client del módulo Cobranzas (SDD-0041).
 *
 * Header + 4 KPIs (Por cobrar · Vencido · En promesa · Tasa de cobro) +
 * filtro por stage + cola de CxC (tabla con aging + stage) + drawer del
 * receivable (registrar cobro / gestión + historial).
 *
 * La cola se deriva de las facturas con saldo (no es una tabla). El stage
 * (vencido/promesa/contactado/al-día/pagado) se calcula server-side.
 */

import { useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import {
  COB_STAGES,
  collectionKindLabel,
  stageLabel,
  stageTone,
  type ReceivableStage,
} from "@/lib/studio/payment-types";
import type {
  CollectionKpis,
  Receivable,
} from "@/lib/studio/payment-queries";
import { CobranzaDrawer, type CashAccountOption } from "./CobranzaDrawer";

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
function fmtAmount(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type StageFilter = "all" | "open" | ReceivableStage;

const STAGE_FILTERS: { value: StageFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "open", label: "Solo abiertas" },
  ...(Object.keys(COB_STAGES) as ReceivableStage[]).map((k) => ({
    value: k as StageFilter,
    label: COB_STAGES[k].label,
  })),
];

const GRID = "130px 1.4fr 110px 130px 1fr 120px";

export function CobranzasClient({
  receivables,
  kpis,
  cashAccounts,
}: {
  receivables: Receivable[];
  kpis: CollectionKpis;
  cashAccounts: CashAccountOption[];
}) {
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = receivables.filter((r) =>
    stageFilter === "all"
      ? true
      : stageFilter === "open"
        ? r.stage !== "pagado"
        : r.stage === stageFilter,
  );

  const selected =
    selectedId != null
      ? receivables.find((r) => r.invoice.id === selectedId) ?? null
      : null;

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Finanzas · Cuentas por cobrar</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Cobranzas.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "62ch",
            }}
          >
            Cola de cobranza sobre las facturas con saldo. Registra cobros (con
            recibo y asiento), sigue promesas de pago y la gestión queda en el
            historial.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            disabled
            title="Próximamente · recordatorio masivo por email"
          >
            Recordatorio masivo
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <KpiCard
          value={`$${fmtMoney(kpis.porCobrar)}`}
          label="Por cobrar"
          valueColor={kpis.porCobrar > 0 ? "var(--wine)" : "var(--ink)"}
          sub={`${kpis.casos} caso(s) abierto(s)`}
        />
        <KpiCard
          value={`$${fmtMoney(kpis.vencido)}`}
          label="Vencido"
          valueColor={kpis.vencido > 0 ? "var(--danger)" : "var(--ink)"}
          sub={kpis.vencido > 0 ? "Requiere gestión" : "Sin vencidos"}
        />
        <KpiCard
          value={`$${fmtMoney(kpis.enPromesa)}`}
          label="En promesa de pago"
          valueColor={kpis.enPromesa > 0 ? "var(--info)" : "var(--ink)"}
          sub="Comprometido por el cliente"
        />
        <KpiCard
          value={`${kpis.tasaCobro}%`}
          label="Tasa de cobro"
          valueColor={kpis.tasaCobro >= 80 ? "var(--success)" : "var(--ink)"}
          sub="Al día sobre el total por cobrar"
        />
      </div>

      {/* Filtro por stage */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 200 }}>
          <label className="studio-label" htmlFor="cob-stage">
            Estado
          </label>
          <select
            id="cob-stage"
            className="studio-input"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as StageFilter)}
          >
            {STAGE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          eyebrow={receivables.length === 0 ? "Sin saldos" : "Sin resultados"}
          title={
            receivables.length === 0
              ? "No hay facturas con saldo por cobrar."
              : "Ninguna factura coincide con este estado."
          }
          description={
            receivables.length === 0
              ? "Cuando emitas facturas, las que tengan saldo aparecerán acá para gestionar el cobro."
              : "Prueba cambiar el filtro de estado."
          }
        />
      ) : (
        <ReceivablesTable
          rows={rows}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
        />
      )}

      {selected && (
        <CobranzaDrawer
          receivable={selected}
          cashAccounts={cashAccounts}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function ReceivablesTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: Receivable[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
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
        <span>Factura</span>
        <span>Cliente</span>
        <span style={{ textAlign: "right" }}>Saldo</span>
        <span>Vencimiento</span>
        <span>Última gestión</span>
        <span style={{ textAlign: "right" }}>Estado</span>
      </div>

      {rows.map((r, i) => {
        const inv = r.invoice;
        const isSel = selectedId === inv.id;
        const veryOverdue = (r.daysOverdue ?? 0) > 30 && r.stage !== "pagado";
        // Tintes persistentes vía modifiers en studio.css. Mantenemos
        // studio-tracking-row SIEMPRE para conservar hover + focus-visible
        // (el :hover/:focus gana por especificidad sobre los modifiers).
        const rowClass = isSel
          ? "studio-tracking-row studio-row-selected"
          : veryOverdue
            ? "studio-tracking-row studio-row-overdue"
            : "studio-tracking-row";
        return (
          <div
            key={inv.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(inv.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(inv.id);
              }
            }}
            className={rowClass}
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              gap: 12,
              padding: "14px 20px",
              borderTop: i > 0 ? "1px solid var(--border)" : 0,
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                font: "700 12px/1 var(--f-mono)",
                color: "var(--ink)",
                letterSpacing: "0.02em",
              }}
            >
              {inv.invoice_code}
            </span>
            <div style={{ overflow: "hidden" }}>
              <div
                style={{
                  font: "700 12px/1.3 var(--f-sans)",
                  color: "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {inv.client_name}
              </div>
              <div
                style={{
                  font: "600 11px/1 var(--f-mono)",
                  color: "var(--wine)",
                  marginTop: 3,
                }}
              >
                {inv.client_markbox}
              </div>
            </div>
            <span
              style={{
                font: "800 12.5px/1 var(--f-mono)",
                color: "var(--ink)",
                textAlign: "right",
              }}
            >
              ${fmtAmount(r.balance)}
            </span>
            <div>
              <div
                style={{
                  font: "500 11px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                }}
              >
                {inv.due_date ?? "—"}
              </div>
              {r.daysOverdue != null && (
                <div
                  style={{
                    font: "700 10px/1 var(--f-sans)",
                    color: r.daysOverdue > 0 ? "var(--danger)" : "var(--ink-mute)",
                    marginTop: 3,
                  }}
                >
                  {r.daysOverdue > 0
                    ? `vencido ${r.daysOverdue}d`
                    : r.daysOverdue === 0
                      ? "vence hoy"
                      : `en ${Math.abs(r.daysOverdue)}d`}
                </div>
              )}
            </div>
            <div style={{ overflow: "hidden" }}>
              {r.lastActivity ? (
                <>
                  <div
                    style={{
                      font: "600 11.5px/1.2 var(--f-sans)",
                      color: "var(--ink)",
                    }}
                  >
                    {collectionKindLabel(r.lastActivity.kind)}
                  </div>
                  <div
                    style={{
                      font: "500 10px/1.2 var(--f-mono)",
                      color: "var(--ink-mute)",
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.lastActivity.created_at.slice(0, 10)}
                  </div>
                </>
              ) : (
                <span
                  style={{
                    font: "500 11px/1 var(--f-sans)",
                    color: "var(--ink-mute)",
                  }}
                >
                  Sin gestión
                </span>
              )}
            </div>
            <span style={{ textAlign: "right" }}>
              <Badge tone={stageTone(r.stage)} size="sm" dot>
                {stageLabel(r.stage)}
              </Badge>
            </span>
          </div>
        );
      })}
    </div>
  );
}
