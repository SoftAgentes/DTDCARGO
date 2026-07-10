"use client";

/**
 * Cola de reconciliación del estado de cuenta del Socio China
 * (SDD-0059 · Slice B2) — el dolor de mayor ROI.
 *
 * Lista de partner_statements (períodos importados) → abrir uno carga su
 * detalle (líneas con el match auto-sugerido por reconcileStatement + cargos /
 * entries del socio para el match manual) → el operador confirma / corrige /
 * rechaza cada línea → cierra el período.
 *
 * Diseño anclado a erp/modules/conciliacion.jsx: KPIs + tabs por estado de
 * match + filas de movimiento con match sugerido + panel detalle con búsqueda
 * de match manual. Adaptado a primitivas reales + Server Actions.
 */

import { useMemo, useState, useTransition } from "react";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  statementStatusLabel,
  statementStatusTone,
  type PartnerStatement,
  type PartnerStatementWithLines,
  type SupplierChargeWithNet,
  type PartnerLedgerEntry,
} from "@/lib/studio/partner-finance/types";
import type { SupplierOption } from "./FinancieroChinaClient";
import { ImportStatementDrawer } from "./ImportStatementDrawer";
import { StatementDetail } from "./StatementDetail";
import { getStatementDetail } from "../actions";

export function ReconciliationTab({
  suppliers,
  statements,
  defaultSupplierId,
}: {
  suppliers: SupplierOption[];
  statements: PartnerStatement[];
  defaultSupplierId: string | null;
}) {
  const [importing, setImporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    statement: PartnerStatementWithLines;
    charges: SupplierChargeWithNet[];
    ledgerEntries: PartnerLedgerEntry[];
    supplierId: string;
  } | null>(null);
  const [loading, startLoading] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const supplierName = useMemo(() => {
    const map = new Map(suppliers.map((s) => [s.id, s] as const));
    return (id: string) => map.get(id)?.name ?? id;
  }, [suppliers]);

  const openStatement = (st: PartnerStatement) => {
    setOpenId(st.id);
    setError(null);
    startLoading(async () => {
      const res = await getStatementDetail(st.id, st.supplier_id);
      if (res.ok) {
        setDetail({
          statement: res.statement,
          charges: res.charges,
          ledgerEntries: res.ledgerEntries,
          supplierId: st.supplier_id,
        });
      } else {
        setError(res.error);
        setOpenId(null);
      }
    });
  };

  const closeDetail = () => {
    setOpenId(null);
    setDetail(null);
  };

  const openStatements = statements.filter((s) => s.status !== "cerrado");
  const closedStatements = statements.filter((s) => s.status === "cerrado");

  // Si hay un estado abierto en el panel, mostramos el detalle full-width.
  if (openId && detail) {
    return (
      <StatementDetail
        statement={detail.statement}
        charges={detail.charges}
        ledgerEntries={detail.ledgerEntries}
        supplierId={detail.supplierId}
        supplierName={supplierName(detail.supplierId)}
        onBack={closeDetail}
        onRefetch={() => {
          const st = statements.find((s) => s.id === openId);
          if (st) openStatement(st);
        }}
      />
    );
  }

  return (
    <div>
      {/* KPIs + acción de import */}
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 14,
            flex: 1,
            minWidth: 280,
          }}
        >
          <KpiCard
            value={statements.length}
            label="Estados importados"
            sub="Períodos del socio"
          />
          <KpiCard
            value={openStatements.length}
            label="A reconciliar"
            valueColor={openStatements.length > 0 ? "var(--warning)" : "var(--ink)"}
            sub={openStatements.length > 0 ? "Requieren revisión" : "Todo cerrado"}
          />
          <KpiCard
            value={closedStatements.length}
            label="Cerrados"
            valueColor={closedStatements.length > 0 ? "var(--success)" : "var(--ink)"}
            sub="Períodos confirmados"
          />
        </div>
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={() => setImporting(true)}
          disabled={suppliers.length === 0}
        >
          + Importar estado de cuenta
        </button>
      </div>

      {error && (
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
          {error}
        </div>
      )}

      {statements.length === 0 ? (
        <EmptyState
          eyebrow="Sin estados"
          title="No hay estados de cuenta importados todavía."
          description="Importa el estado de cuenta que manda el Administrador China para reconciliarlo línea por línea contra los cargos y el libro mayor. El sistema sugiere los matches; tú confirmas."
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr 130px 130px 120px",
              gap: 12,
              padding: "var(--s-3) var(--s-5)",
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border)",
              font: "700 10px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            <span>Período</span>
            <span>Socio</span>
            <span style={{ textAlign: "right" }}>Total USD</span>
            <span style={{ textAlign: "right" }}>Total RMB</span>
            <span style={{ textAlign: "right" }}>Estado</span>
          </div>

          {statements.map((st, i) => (
            <div
              key={st.id}
              role="button"
              tabIndex={0}
              onClick={() => openStatement(st)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openStatement(st);
                }
              }}
              className="studio-tracking-row"
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 1fr 130px 130px 120px",
                gap: 12,
                padding: "14px 20px",
                borderTop: i > 0 ? "1px solid var(--border)" : 0,
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  font: "700 13px/1.2 var(--f-sans)",
                  color: "var(--ink)",
                }}
              >
                {st.period_label}
                <div
                  style={{
                    font: "500 10px/1 var(--f-mono)",
                    color: "var(--ink-soft)",
                    marginTop: 4,
                  }}
                >
                  importado {st.imported_at.slice(0, 10)}
                </div>
              </div>
              <span
                style={{
                  font: "600 12px/1.3 var(--f-sans)",
                  color: "var(--ink-soft)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {supplierName(st.supplier_id)}
              </span>
              <span
                style={{
                  textAlign: "right",
                  font: "700 12px/1 var(--f-mono)",
                  color: "var(--ink)",
                }}
              >
                ${st.total_usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
              <span
                style={{
                  textAlign: "right",
                  font: "700 12px/1 var(--f-mono)",
                  color: "var(--ink)",
                }}
              >
                ¥{st.total_rmb.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
              <span style={{ textAlign: "right" }}>
                <Badge tone={statementStatusTone(st.status)} size="sm" dot>
                  {statementStatusLabel(st.status)}
                </Badge>
              </span>
            </div>
          ))}
        </div>
      )}

      {importing && (
        <ImportStatementDrawer
          suppliers={suppliers}
          defaultSupplierId={defaultSupplierId}
          onClose={() => setImporting(false)}
        />
      )}
    </div>
  );
}
