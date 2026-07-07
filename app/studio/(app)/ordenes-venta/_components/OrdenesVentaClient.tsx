"use client";

/**
 * OrdenesVentaClient — vista de operador de Órdenes de venta (SDD-0072).
 *
 * Header + 4 KPIs + "Nueva OV" + "Convertir estimado" + tabla de OV con
 * provenance ("viene de EST-…" / manual). La OV es el estimado CONFIRMADO y
 * formal (gemela de la OC 0124, lado ventas).
 *
 * El detalle de una OV abre un drawer con provenance + edición del snapshot +
 * transiciones de status + asignar/quitar prealertas (cajas físicas). Solo
 * tokens var(--*) + primitivas del Studio.
 */

import { useMemo, useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import {
  salesOrderStatusLabel,
  salesOrderStatusTone,
  type SalesOrder,
} from "@/lib/studio/sales-orders/types";
import type {
  SalesOrderStats,
  SalesOrderInvoiceRef,
} from "@/lib/studio/sales-orders/queries";
import {
  OvDrawer,
  NewOvDrawer,
  ConvertEstimateDrawer,
  type QuoteOption,
  type PrealertaOption,
} from "./OvDrawer";

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function OrdenesVentaClient({
  orders,
  stats,
  prealertasByOrder,
  invoicesByOrder,
  quotes,
  prealertas,
}: {
  orders: SalesOrder[];
  stats: SalesOrderStats;
  prealertasByOrder: Record<string, PrealertaOption[]>;
  invoicesByOrder: Record<string, SalesOrderInvoiceRef[]>;
  quotes: QuoteOption[];
  prealertas: PrealertaOption[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showConvert, setShowConvert] = useState(false);

  const selected =
    selectedId != null ? orders.find((o) => o.id === selectedId) ?? null : null;

  // Estimados convertibles = aceptados sin OV todavía.
  const convertibles = useMemo(
    () => quotes.filter((q) => !q.sales_order_id),
    [quotes],
  );

  const enCurso = stats.byStatus.confirmada + stats.byStatus.parcial;

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
          <span className="studio-eyebrow">Comercial · Ventas</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Órdenes de venta.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "72ch",
            }}
          >
            La <strong>Orden de venta</strong> es el estimado confirmado y formal:
            soporta la venta, carga la trazabilidad y (próximamente) dispara la
            factura cuando la mercancía llega. Conviértela desde un{" "}
            <strong>Estimado</strong> aceptado o créala manual para B2B y otros
            servicios.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={() => setShowConvert(true)}
            disabled={convertibles.length === 0}
            title={
              convertibles.length === 0
                ? "No hay estimados aceptados sin convertir"
                : undefined
            }
          >
            Convertir estimado
          </button>
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={() => setShowNew(true)}
          >
            Nueva orden de venta
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <KpiCard value={stats.total} label="Órdenes de venta" sub="vivas" />
        <KpiCard
          value={enCurso}
          label="En curso"
          valueColor={enCurso > 0 ? "var(--warning)" : "var(--ink)"}
          sub="confirmada · parcial"
        />
        <KpiCard
          value={stats.byStatus.facturada}
          label="Facturadas"
          valueColor={
            stats.byStatus.facturada > 0 ? "var(--success)" : "var(--ink)"
          }
          sub="venta completa"
        />
        <KpiCard
          value={`$${fmtMoney(stats.totalUsd)}`}
          label="Total vendido"
          sub="USD · OV vivas no canceladas"
        />
      </div>

      {/* Tabla */}
      {orders.length === 0 ? (
        <EmptyState
          eyebrow="Sin órdenes de venta"
          title="Todavía no hay órdenes de venta."
          description='Convierte un estimado aceptado en orden de venta, o crea una manual para B2B y otros servicios. Toca "Convertir estimado" o "Nueva orden de venta".'
        />
      ) : (
        <OrdersTable
          orders={orders}
          prealertasByOrder={prealertasByOrder}
          onOpen={setSelectedId}
        />
      )}

      {/* Drawers */}
      {selected && (
        <OvDrawer
          so={selected}
          prealertas={prealertasByOrder[selected.id] ?? []}
          invoices={invoicesByOrder[selected.id] ?? []}
          allPrealertas={prealertas}
          onClose={() => setSelectedId(null)}
        />
      )}
      {showNew && <NewOvDrawer onClose={() => setShowNew(false)} />}
      {showConvert && (
        <ConvertEstimateDrawer
          quotes={convertibles}
          onClose={() => setShowConvert(false)}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tabla de OV
// ════════════════════════════════════════════════════════════════

const SO_GRID = "150px 1.5fr 1.1fr 120px 140px";

function OrdersTable({
  orders,
  prealertasByOrder,
  onOpen,
}: {
  orders: SalesOrder[];
  prealertasByOrder: Record<string, PrealertaOption[]>;
  onOpen: (id: string) => void;
}) {
  return (
    <TableShell>
      <HeaderRow grid={SO_GRID}>
        <span>Código</span>
        <span>Cliente · destino</span>
        <span>Provenance</span>
        <span style={{ textAlign: "right" }}>Total USD</span>
        <span style={{ textAlign: "right" }}>Estado</span>
      </HeaderRow>
      {orders.map((so, i) => {
        const cajas = (prealertasByOrder[so.id] ?? []).length;
        return (
          <button
            key={so.id}
            type="button"
            onClick={() => onOpen(so.id)}
            className="studio-tracking-row"
            style={{
              display: "grid",
              gridTemplateColumns: SO_GRID,
              gap: 12,
              padding: "14px 20px",
              alignItems: "center",
              width: "100%",
              textAlign: "left",
              background: "transparent",
              border: 0,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopStyle: "solid",
              borderTopColor: i > 0 ? "var(--border)" : "transparent",
              cursor: "pointer",
            }}
          >
            <code
              style={{
                font: "700 12px/1.2 var(--f-mono)",
                color: "var(--wine)",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {so.sales_order_code}
            </code>
            <div style={{ overflow: "hidden" }}>
              <div
                style={{
                  font: "600 12.5px/1.3 var(--f-sans)",
                  color: "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {so.client_name || "Sin nombre"}
              </div>
              <div
                style={{
                  font: "500 10.5px/1.3 var(--f-mono)",
                  color: "var(--ink-soft)",
                  marginTop: 3,
                }}
              >
                {so.destination || "—"}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                alignItems: "center",
              }}
            >
              {so.quote_id ? (
                <Badge tone="info" size="sm">
                  Estimado
                </Badge>
              ) : (
                <Badge tone="neutral" size="sm">
                  Manual
                </Badge>
              )}
              {cajas > 0 && (
                <Badge tone="wine" size="sm">
                  {cajas} {cajas === 1 ? "caja" : "cajas"}
                </Badge>
              )}
            </div>
            <span
              style={{
                font: "700 12.5px/1 var(--f-mono)",
                color: "var(--ink)",
                textAlign: "right",
              }}
            >
              ${fmt(so.total_usd)}
            </span>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Badge tone={salesOrderStatusTone(so.status)} size="sm" dot>
                {salesOrderStatusLabel(so.status)}
              </Badge>
            </div>
          </button>
        );
      })}
    </TableShell>
  );
}

// ════════════════════════════════════════════════════════════════
// Shell de tabla (mismo patrón que ordenes-compra / naviera)
// ════════════════════════════════════════════════════════════════

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function HeaderRow({
  grid,
  children,
}: {
  grid: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: grid,
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
      {children}
    </div>
  );
}
