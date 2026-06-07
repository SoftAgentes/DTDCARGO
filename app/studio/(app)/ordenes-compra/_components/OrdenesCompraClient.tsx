"use client";

/**
 * OrdenesCompraClient — vista de operador de Órdenes de compra (SDD-0063).
 *
 * Header + 4 KPIs + botón "Nueva OC de DTD" + 2 tabs:
 *   · OC de DTD   ⭐ : purchase_orders del tenant (compra asistida). Crear/editar,
 *                       cambiar estado, "Recibir" → genera el Bill (0044).
 *   · OC de cliente   : prealertas (0057), etiquetadas "OC cliente". Read-only
 *                       (las crea/edita el cliente desde el portal).
 *
 * El detalle de una OC DTD abre un drawer con provenance (link a OV/prealerta
 * cuando exista, Bill generado) + el flujo de recepción. Solo tokens var(--*).
 */

import { useMemo, useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import {
  prealertaStatusLabel,
  prealertaStatusTone,
  type Prealerta,
} from "@/lib/studio/prealertas/types";
import {
  purchaseOrderStatusLabel,
  purchaseOrderStatusTone,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from "@/lib/studio/purchase-orders/types";
import type { PurchaseOrderStats } from "@/lib/studio/purchase-orders/queries";
import { PoDrawer, NewPoDrawer, type AccountOption } from "./PoDrawer";

export type SupplierCnOption = {
  id: string;
  name: string;
  client_markbox: string;
  supplier_seq: number;
};

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

type Tab = "dtd" | "cliente";

const TABS: { value: Tab; label: string }[] = [
  { value: "dtd", label: "OC de DTD" },
  { value: "cliente", label: "OC de cliente" },
];

export function OrdenesCompraClient({
  orders,
  itemsByPo,
  stats,
  prealertas,
  suppliersCn,
  expenseAccounts,
}: {
  orders: PurchaseOrder[];
  itemsByPo: Record<string, PurchaseOrderItem[]>;
  stats: PurchaseOrderStats;
  prealertas: Prealerta[];
  suppliersCn: SupplierCnOption[];
  expenseAccounts: AccountOption[];
}) {
  const [tab, setTab] = useState<Tab>("dtd");
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [showNewPo, setShowNewPo] = useState(false);

  const selectedPo =
    selectedPoId != null
      ? orders.find((o) => o.id === selectedPoId) ?? null
      : null;

  const supplierCnName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of suppliersCn) m[s.id] = s.name;
    return m;
  }, [suppliersCn]);

  const pendientes =
    stats.byStatus.borrador + stats.byStatus.confirmada + stats.byStatus.recibida;

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
          <span className="studio-eyebrow">Comercial · Compras</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Órdenes de compra.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "72ch",
            }}
          >
            El lado compras del ERP. Las <strong>OC de DTD</strong> registran lo
            que DTD le compra al proveedor por cuenta del cliente (compra
            asistida); al recibir la mercancía generan el Bill en Tesorería. Las{" "}
            <strong>OC de cliente</strong> son las prealertas que el cliente
            anuncia desde su portal.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={() => setShowNewPo(true)}
          >
            Nueva OC de DTD
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
        <KpiCard
          value={stats.total}
          label="OC de DTD"
          sub="compra asistida"
        />
        <KpiCard
          value={pendientes}
          label="En curso"
          valueColor={pendientes > 0 ? "var(--warning)" : "var(--ink)"}
          sub="borrador · confirmada · recibida"
        />
        <KpiCard
          value={stats.byStatus.facturada}
          label="Facturadas"
          valueColor={
            stats.byStatus.facturada > 0 ? "var(--success)" : "var(--ink)"
          }
          sub="con Bill generado"
        />
        <KpiCard
          value={`$${fmtMoney(stats.totalCostUsd)}`}
          label="Costo total"
          sub="USD · OC vivas no canceladas"
        />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 18,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {TABS.map((tDef) => {
          const active = tab === tDef.value;
          const count =
            tDef.value === "dtd" ? orders.length : prealertas.length;
          return (
            <button
              key={tDef.value}
              type="button"
              onClick={() => setTab(tDef.value)}
              style={{
                padding: "10px 16px",
                background: "transparent",
                border: "none",
                borderBottom: active
                  ? "2px solid var(--wine)"
                  : "2px solid transparent",
                color: active ? "var(--ink)" : "var(--ink-soft)",
                font: active
                  ? "700 13px/1 var(--f-sans)"
                  : "500 13px/1 var(--f-sans)",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {tDef.label}
              <span
                style={{
                  marginLeft: 7,
                  font: "600 11px/1 var(--f-mono)",
                  color: "var(--ink-mute)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "dtd" && (
        <DtdTab
          orders={orders}
          supplierCnName={supplierCnName}
          onOpen={setSelectedPoId}
        />
      )}

      {tab === "cliente" && (
        <ClienteTab prealertas={prealertas} supplierCnName={supplierCnName} />
      )}

      {/* Drawers */}
      {selectedPo && (
        <PoDrawer
          po={selectedPo}
          items={itemsByPo[selectedPo.id] ?? []}
          supplierCnName={
            selectedPo.supplier_id
              ? supplierCnName[selectedPo.supplier_id] ?? null
              : null
          }
          expenseAccounts={expenseAccounts}
          onClose={() => setSelectedPoId(null)}
        />
      )}
      {showNewPo && (
        <NewPoDrawer
          suppliersCn={suppliersCn}
          onClose={() => setShowNewPo(false)}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab: OC de DTD
// ════════════════════════════════════════════════════════════════

const PO_GRID = "150px 1.5fr 1.1fr 110px 130px";

function DtdTab({
  orders,
  supplierCnName,
  onOpen,
}: {
  orders: PurchaseOrder[];
  supplierCnName: Record<string, string>;
  onOpen: (id: string) => void;
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin OC de DTD"
        title="Todavía no hay órdenes de compra de DTD."
        description='Creá una OC de DTD cuando vayas a comprarle la mercancía al proveedor por cuenta del cliente (compra asistida). Al recibirla genera el Bill en Tesorería. Tocá "Nueva OC de DTD".'
      />
    );
  }

  return (
    <TableShell>
      <HeaderRow grid={PO_GRID}>
        <span>Código</span>
        <span>Proveedor · cliente</span>
        <span>Provenance</span>
        <span style={{ textAlign: "right" }}>Costo USD</span>
        <span style={{ textAlign: "right" }}>Estado</span>
      </HeaderRow>
      {orders.map((po, i) => {
        const provName = po.supplier_name
          ? po.supplier_name
          : po.supplier_id && supplierCnName[po.supplier_id]
            ? supplierCnName[po.supplier_id]
            : "Sin proveedor";
        return (
          <button
            key={po.id}
            type="button"
            onClick={() => onOpen(po.id)}
            className="studio-tracking-row"
            style={{
              display: "grid",
              gridTemplateColumns: PO_GRID,
              gap: 12,
              padding: "14px 20px",
              borderTop: i > 0 ? "1px solid var(--border)" : 0,
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
              {po.purchase_order_code}
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
                {provName}
              </div>
              <div
                style={{
                  font: "500 10.5px/1.3 var(--f-mono)",
                  color: "var(--ink-mute)",
                  marginTop: 3,
                }}
              >
                {po.client_markbox || "—"}
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
              {po.sales_order_id && (
                <Badge tone="info" size="sm">
                  OV
                </Badge>
              )}
              {po.bill_id && (
                <Badge tone="success" size="sm">
                  Bill
                </Badge>
              )}
              {!po.sales_order_id && !po.bill_id && (
                <span
                  style={{ font: "500 11px/1 var(--f-sans)", color: "var(--ink-mute)" }}
                >
                  Standalone
                </span>
              )}
            </div>
            <span
              style={{
                font: "700 12.5px/1 var(--f-mono)",
                color: "var(--ink)",
                textAlign: "right",
              }}
            >
              ${fmt(po.total_cost_usd)}
            </span>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Badge tone={purchaseOrderStatusTone(po.status)} size="sm" dot>
                {purchaseOrderStatusLabel(po.status)}
              </Badge>
            </div>
          </button>
        );
      })}
    </TableShell>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab: OC de cliente (prealertas, read-only)
// ════════════════════════════════════════════════════════════════

const PREALERTA_GRID = "150px 1.4fr 1.1fr 70px 130px";

function ClienteTab({
  prealertas,
  supplierCnName,
}: {
  prealertas: Prealerta[];
  supplierCnName: Record<string, string>;
}) {
  if (prealertas.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin OC de cliente"
        title="Todavía no hay prealertas de clientes."
        description="Cuando un cliente anuncie una compra desde su portal, aparecerá acá como OC de cliente (prealerta). Es de solo lectura — el cliente la gestiona desde su portal."
      />
    );
  }

  return (
    <>
      <div
        style={{
          font: "500 11.5px/1.4 var(--f-sans)",
          color: "var(--ink-mute)",
          margin: "0 0 12px",
        }}
      >
        Prealertas que los clientes anuncian desde el portal. Solo lectura — se
        gestionan en{" "}
        <a
          href="/studio/proveedores"
          style={{ color: "var(--wine)", textDecoration: "none" }}
        >
          Proveedores &amp; prealertas
        </a>
        .
      </div>
      <TableShell>
        <HeaderRow grid={PREALERTA_GRID}>
          <span>Código</span>
          <span>Descripción</span>
          <span>Proveedor · cliente</span>
          <span style={{ textAlign: "right" }}>Cajas</span>
          <span style={{ textAlign: "right" }}>Estado</span>
        </HeaderRow>
        {prealertas.map((p, i) => (
          <div
            key={p.id}
            className="studio-tracking-row"
            style={{
              display: "grid",
              gridTemplateColumns: PREALERTA_GRID,
              gap: 12,
              padding: "14px 20px",
              borderTop: i > 0 ? "1px solid var(--border)" : 0,
              alignItems: "center",
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
              {p.code}
            </code>
            <div
              style={{
                font: "600 12.5px/1.3 var(--f-sans)",
                color: "var(--ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {p.description}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div
                style={{
                  font: "500 12px/1.3 var(--f-sans)",
                  color: "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {p.supplier_id && supplierCnName[p.supplier_id]
                  ? supplierCnName[p.supplier_id]
                  : "Sin proveedor"}
              </div>
              <div
                style={{
                  font: "500 10.5px/1.3 var(--f-mono)",
                  color: "var(--ink-mute)",
                  marginTop: 3,
                }}
              >
                {p.client_markbox || "—"}
              </div>
            </div>
            <span
              style={{
                font: "700 12.5px/1 var(--f-mono)",
                color: "var(--ink)",
                textAlign: "right",
              }}
            >
              {p.boxes}
            </span>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Badge tone={prealertaStatusTone(p.status)} size="sm" dot>
                {prealertaStatusLabel(p.status)}
              </Badge>
            </div>
          </div>
        ))}
      </TableShell>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// Shell de tabla (mismo patrón que naviera / proveedores)
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
