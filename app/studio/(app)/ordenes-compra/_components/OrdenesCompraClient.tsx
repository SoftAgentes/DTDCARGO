"use client";

/**
 * OrdenesCompraClient — vista de operador de "Compras asistidas" (SDD-0071;
 * renombre founder 2026-07-03, ex "Órdenes de compra" — id/slug NO cambian,
 * son contrato interno; el correlativo visible pasó a CANNNN en migr 0208).
 *
 * Header + 4 KPIs + botón "Nueva compra" + 2 tabs:
 *   · Compras de DTD ⭐      : purchase_orders del tenant (compra asistida:
 *     DTD compra al proveedor por encargo del cliente). Crear/editar, cambiar
 *     estado, "Recibir" → genera el Bill (0044). Filtros agrupados por momento
 *     de vida (Abiertas = borrador+confirmada+recibida), búsqueda y columnas
 *     CONFIGURABLES (orden + visibilidad, handoff Norte "Almacén CN →
 *     columnas configurables") vía useColumnConfig/ColumnManager.
 *   · Prealertas del cliente : prealertas (0057), read-only (las crea/edita
 *     el cliente desde el portal).
 *
 * El detalle de una compra abre un drawer con vínculos (link a OV/prealerta
 * cuando exista, Bill generado) + el flujo de recepción. Solo tokens var(--*).
 */

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import {
  ColumnManager,
  useColumnConfig,
  type ColumnLabels,
  type ColumnVisibility,
} from "@/app/studio/_components/ui/columns/ColumnConfig";
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
  type PurchaseOrderStatus,
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
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

type Tab = "dtd" | "cliente";

const TABS: { value: Tab; label: string }[] = [
  { value: "dtd", label: "Compras de DTD" },
  { value: "cliente", label: "Prealertas del cliente" },
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

  const abiertas =
    stats.byStatus.borrador + stats.byStatus.confirmada + stats.byStatus.recibida;

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "var(--s-6)",
          marginBottom: "var(--s-6)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Comercial · Compras</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "var(--s-2) 0 var(--s-2)", color: "var(--ink)" }}
          >
            Compras asistidas.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "72ch",
            }}
          >
            Cada fila es una compra que DTD hace a un proveedor en China por
            encargo de un cliente: el cliente pide, DTD compra y le sigue el
            rastro hasta recibir la mercancía. Al recibirla se genera sola la
            cuenta por pagar en Tesorería. La pestaña{" "}
            <strong>Prealertas del cliente</strong> muestra las compras que el
            cliente hizo por su cuenta y anunció desde su portal.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={() => setShowNewPo(true)}
          >
            Nueva compra
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 14,
          marginBottom: "var(--s-5)",
        }}
      >
        <KpiCard
          value={stats.total}
          label="Compras"
          sub="por encargo del cliente"
        />
        <KpiCard
          value={abiertas}
          label="Abiertas"
          valueColor={abiertas > 0 ? "var(--warning)" : "var(--ink)"}
          sub="borrador · confirmada · recibida"
        />
        <KpiCard
          value={stats.byStatus.facturada}
          label="Facturadas"
          valueColor={
            stats.byStatus.facturada > 0 ? "var(--success)" : "var(--ink)"
          }
          sub="cuenta por pagar generada"
        />
        <KpiCard
          value={`$${fmtMoney(stats.totalCostUsd)}`}
          label="Costo total"
          sub="USD · compras vivas no canceladas"
        />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "var(--s-1)",
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
                  color: "var(--ink-soft)",
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
// Tab: Compras de DTD
// ════════════════════════════════════════════════════════════════

// ── Filtros agrupados por momento de vida (modelo mental del operador:
//    pendientes / cerradas / no concluidas — sin exigir conocer los 6
//    estados; cada fila igual muestra su estado exacto en el badge) ──────
type FilterGroup =
  | "todas"
  | "abiertas"
  | "facturadas"
  | "cerradas"
  | "canceladas";

const OPEN_STATUSES: ReadonlySet<PurchaseOrderStatus> = new Set([
  "borrador",
  "confirmada",
  "recibida",
]);

const FILTER_GROUPS: {
  value: FilterGroup;
  label: string;
  match: (s: PurchaseOrderStatus) => boolean;
}[] = [
  { value: "todas", label: "Todas", match: () => true },
  { value: "abiertas", label: "Abiertas", match: (s) => OPEN_STATUSES.has(s) },
  { value: "facturadas", label: "Facturadas", match: (s) => s === "facturada" },
  { value: "cerradas", label: "Cerradas", match: (s) => s === "cerrada" },
  { value: "canceladas", label: "Canceladas", match: (s) => s === "cancelada" },
];

// ── Columnas configurables (regla Studio · handoff Norte 2026-07-03) ──────
// El array maestro (label + render) vive acá; lo persistido es solo
// { key, visible }[] bajo la clave del módulo.
const COMPRAS_COLS_KEY = "dtd-compras-cols-v1";
const COMPRAS_COLS_DEFAULT: ColumnVisibility[] = [
  { key: "supplier", visible: true },
  { key: "date", visible: true },
  { key: "code", visible: true },
  { key: "links", visible: true },
  { key: "cost", visible: true },
  { key: "status", visible: true },
];

const COMPRAS_COL_LABELS: ColumnLabels = {
  supplier: { label: "Proveedor · cliente", hint: "nombre + Shipping Mark" },
  date: { label: "Fecha", hint: "cuándo se registró la compra" },
  code: { label: "Código", hint: "correlativo interno de la compra" },
  links: { label: "Vínculos", hint: "orden de venta · cuenta por pagar" },
  cost: { label: "Costo USD", hint: "suma de los ítems" },
  status: { label: "Estado" },
};

// Orden clickeando el header (persistido): [primer click, click siguiente].
type SortBy =
  | "date-desc"
  | "date-asc"
  | "client-asc"
  | "client-desc"
  | "cost-desc"
  | "cost-asc";

const COMPRAS_SORT_KEY = "dtd-compras-sort-v1";
const SORT_VALUES: ReadonlySet<string> = new Set([
  "date-desc",
  "date-asc",
  "client-asc",
  "client-desc",
  "cost-desc",
  "cost-asc",
]);

type ColDef = {
  key: string;
  label: string;
  width: string;
  align?: "right";
  sort?: [SortBy, SortBy];
  render: (po: PurchaseOrder) => React.ReactNode;
};

function DtdTab({
  orders,
  supplierCnName,
  onOpen,
}: {
  orders: PurchaseOrder[];
  supplierCnName: Record<string, string>;
  onOpen: (id: string) => void;
}) {
  const [group, setGroup] = useState<FilterGroup>("abiertas");
  const [search, setSearch] = useState("");
  const [colCfg, setColCfg] = useColumnConfig(
    COMPRAS_COLS_KEY,
    COMPRAS_COLS_DEFAULT,
  );

  // Orden por defecto: la más reciente primero. Persistido por navegador,
  // igual que las columnas.
  const [sortBy, setSortBy] = useState<SortBy>("date-desc");
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const saved = localStorage.getItem(COMPRAS_SORT_KEY);
        if (saved && SORT_VALUES.has(saved)) setSortBy(saved as SortBy);
      } catch {
        /* default */
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const changeSort = (v: SortBy) => {
    setSortBy(v);
    try {
      localStorage.setItem(COMPRAS_SORT_KEY, v);
    } catch {
      /* en memoria */
    }
  };

  const provNameOf = (po: PurchaseOrder): string =>
    po.supplier_name
      ? po.supplier_name
      : po.supplier_id && supplierCnName[po.supplier_id]
        ? supplierCnName[po.supplier_id]
        : "Sin proveedor";

  const countOf = useMemo(() => {
    const m = {} as Record<FilterGroup, number>;
    for (const g of FILTER_GROUPS) {
      m[g.value] = orders.filter((po) => g.match(po.status)).length;
    }
    return m;
  }, [orders]);

  const rows = useMemo(() => {
    const groupDef = FILTER_GROUPS.find((g) => g.value === group)!;
    const q = search.trim().toLowerCase();
    let out = orders.filter((po) => groupDef.match(po.status));
    if (q) {
      out = out.filter(
        (po) =>
          po.purchase_order_code.toLowerCase().includes(q) ||
          (po.client_markbox ?? "").toLowerCase().includes(q) ||
          provNameOf(po).toLowerCase().includes(q),
      );
    }
    const byDateDesc = (a: PurchaseOrder, b: PurchaseOrder) =>
      b.created_at.localeCompare(a.created_at);
    const compare: Record<
      SortBy,
      (a: PurchaseOrder, b: PurchaseOrder) => number
    > = {
      "date-desc": byDateDesc,
      "date-asc": (a, b) => byDateDesc(b, a),
      "client-asc": (a, b) =>
        (a.client_markbox ?? "").localeCompare(b.client_markbox ?? "") ||
        byDateDesc(a, b),
      "client-desc": (a, b) =>
        (b.client_markbox ?? "").localeCompare(a.client_markbox ?? "") ||
        byDateDesc(a, b),
      "cost-desc": (a, b) =>
        b.total_cost_usd - a.total_cost_usd || byDateDesc(a, b),
      "cost-asc": (a, b) =>
        a.total_cost_usd - b.total_cost_usd || byDateDesc(a, b),
    };
    return [...out].sort(compare[sortBy]);
    // provNameOf es estable por render (deriva de supplierCnName).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, group, search, sortBy, supplierCnName]);

  // Array maestro de columnas (§2 del handoff): el key es el contrato estable.
  const columns: ColDef[] = [
    {
      key: "supplier",
      label: "Proveedor · cliente",
      width: "minmax(150px, 1.4fr)",
      sort: ["client-asc", "client-desc"],
      render: (po) => (
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
            {provNameOf(po)}
          </div>
          <div
            style={{
              font: "500 10.5px/1.3 var(--f-mono)",
              color: "var(--ink-soft)",
              marginTop: 3,
            }}
          >
            {po.client_markbox || "—"}
          </div>
        </div>
      ),
    },
    {
      key: "date",
      label: "Fecha",
      width: "88px",
      sort: ["date-desc", "date-asc"],
      render: (po) => (
        <span
          title={new Date(po.created_at).toLocaleString("es-VE")}
          style={{
            font: "500 11px/1.2 var(--f-mono)",
            color: "var(--ink-soft)",
          }}
        >
          {shortDate(po.created_at)}
        </span>
      ),
    },
    {
      key: "code",
      label: "Código",
      width: "148px",
      render: (po) => (
        <code
          style={{
            font: "700 12px/1.2 var(--f-mono)",
            color: "var(--wine-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {po.purchase_order_code}
        </code>
      ),
    },
    {
      key: "links",
      label: "Vínculos",
      width: "minmax(110px, 1fr)",
      render: (po) => (
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
              Orden de venta
            </Badge>
          )}
          {po.bill_id && (
            <Badge tone="success" size="sm">
              Cuenta por pagar
            </Badge>
          )}
          {!po.sales_order_id && !po.bill_id && (
            <span
              style={{
                font: "500 11px/1 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              Sin vínculos
            </span>
          )}
        </div>
      ),
    },
    {
      key: "cost",
      label: "Costo USD",
      width: "110px",
      align: "right",
      sort: ["cost-desc", "cost-asc"],
      render: (po) => (
        <span
          style={{
            font: "700 12.5px/1 var(--f-mono)",
            color: "var(--ink)",
            textAlign: "right",
            display: "block",
          }}
        >
          ${fmt(po.total_cost_usd)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Estado",
      width: "132px",
      align: "right",
      render: (po) => (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Badge tone={purchaseOrderStatusTone(po.status)} size="sm">
            {purchaseOrderStatusLabel(po.status)}
          </Badge>
        </div>
      ),
    },
  ];

  // visibleColumns con .filter(Boolean): red de seguridad si el cfg guardado
  // trae un key sin entrada en el mapa (§3 del handoff).
  const colMap: Record<string, ColDef> = {};
  for (const c of columns) colMap[c.key] = c;
  const visibleColumns = colCfg
    .filter((c) => c.visible)
    .map((c) => colMap[c.key])
    .filter(Boolean);
  const grid = visibleColumns.map((c) => c.width).join(" ");

  // Totales sobre lo filtrado (patrón del almacén CN).
  const totCost = rows.reduce((acc, po) => acc + po.total_cost_usd, 0);

  if (orders.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin compras asistidas"
        title="Todavía no hay compras registradas."
        description='Registra una compra cuando DTD le vaya a comprar la mercancía al proveedor por encargo del cliente; al recibirla se genera sola la cuenta por pagar en Tesorería. Toca "Nueva compra".'
      />
    );
  }

  const groupLabel =
    FILTER_GROUPS.find((g) => g.value === group)?.label ?? "Todas";

  return (
    <>
      {/* Toolbar: búsqueda + filtros por momento de vida + gestor de columnas */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--s-2)",
            flex: "1 1 220px",
            minWidth: 180,
            maxWidth: 380,
            height: 32,
            padding: "0 10px",
            background: "var(--bg-elevated)",
            borderRadius: "var(--r-sm)",
          }}
        >
          <span style={{ color: "var(--ink-mute)", display: "inline-flex" }}>
            {Icon.search(13)}
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar código, cliente o proveedor…"
            aria-label="Buscar compras"
            style={{
              flex: 1,
              height: "100%",
              border: 0,
              background: "transparent",
              font: "500 12px/1 var(--f-sans)",
              color: "var(--ink)",
            }}
          />
        </div>
        {FILTER_GROUPS.map((g) => (
          <button
            key={g.value}
            type="button"
            onClick={() => setGroup(g.value)}
            aria-pressed={group === g.value}
            className={`studio-btn ${
              group === g.value ? "studio-btn-primary" : "studio-btn-ghost"
            }`}
          >
            {g.label}
            <span style={{ marginLeft: 6, opacity: 0.85 }}>
              {countOf[g.value]}
            </span>
          </button>
        ))}
        <div style={{ marginLeft: "auto" }}>
          <ColumnManager
            cfg={colCfg}
            setCfg={setColCfg}
            defaults={COMPRAS_COLS_DEFAULT}
            labels={COMPRAS_COL_LABELS}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          eyebrow={search.trim() ? "Sin resultados" : `Sin ${groupLabel.toLowerCase()}`}
          title={
            search.trim()
              ? "Nada coincide con tu búsqueda."
              : `No hay compras ${groupLabel.toLowerCase()} ahora.`
          }
          description={
            search.trim()
              ? "Prueba con el código de la compra, el Shipping Mark del cliente o el nombre del proveedor."
              : 'Revisa otro estado o toca "Todas" para ver el historial completo.'
          }
        />
      ) : (
        <TableShell>
          <HeaderRow grid={grid}>
            {visibleColumns.map((col) => (
              <SortableHeaderCell
                key={col.key}
                col={col}
                sortBy={sortBy}
                onSort={changeSort}
              />
            ))}
          </HeaderRow>
          {rows.map((po, i) => (
            <button
              key={po.id}
              type="button"
              onClick={() => onOpen(po.id)}
              className="studio-tracking-row studio-row-btn"
              style={{
                display: "grid",
                gridTemplateColumns: grid,
                gap: "var(--s-3)",
                padding: "14px 20px",
                alignItems: "center",
                width: "100%",
                textAlign: "left",
                border: 0,
                borderTop: i > 0 ? "1px solid var(--border)" : "none",
                cursor: "pointer",
              }}
            >
              {visibleColumns.map((col) => (
                <div key={col.key} style={{ minWidth: 0 }}>
                  {col.render(po)}
                </div>
              ))}
            </button>
          ))}
          {/* Totales sobre lo filtrado (patrón almacén CN: Σ label mute +
              valor wine con peso — se lee de un vistazo) */}
          <div
            style={{
              display: "flex",
              gap: 22,
              alignItems: "baseline",
              padding: "11px 20px",
              borderTop: "1px solid var(--border)",
              background: "var(--bg-elevated)",
            }}
          >
            {[
              { label: "Σ compras", value: String(rows.length) },
              { label: "Σ costo USD", value: `$${fmt(totCost)}` },
            ].map((t) => (
              <span
                key={t.label}
                style={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    font: "600 10px/1 var(--f-mono)",
                    color: "var(--ink-soft)",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {t.label}
                </span>
                <span
                  style={{
                    font: "800 13px/1 var(--f-mono)",
                    color: "var(--wine-text)",
                  }}
                >
                  {t.value}
                </span>
              </span>
            ))}
          </div>
        </TableShell>
      )}
    </>
  );
}

/**
 * Celda del header: si la columna define `sort`, es un botón que alterna
 * [primer click, click siguiente] con flecha ▲/▼ (mismo patrón que
 * PreAlertas de servicios).
 */
function SortableHeaderCell({
  col,
  sortBy,
  onSort,
}: {
  col: ColDef;
  sortBy: SortBy;
  onSort: (v: SortBy) => void;
}) {
  if (!col.sort) {
    return (
      <span style={col.align === "right" ? { textAlign: "right" } : undefined}>
        {col.label}
      </span>
    );
  }
  const [primary, alt] = col.sort;
  const active = sortBy === primary || sortBy === alt;
  const next: SortBy = active && sortBy === primary ? alt : primary;
  const dir = sortBy.endsWith("-asc") ? "ascendente" : "descendente";
  return (
    <button
      type="button"
      onClick={() => onSort(next)}
      title={`Ordenar por ${col.label}`}
      aria-label={`Ordenar por ${col.label}${active ? ` (${dir})` : ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--s-1)",
        justifySelf: col.align === "right" ? "end" : "start",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        font: "inherit",
        letterSpacing: "inherit",
        textTransform: "inherit",
        color: active ? "var(--wine)" : "inherit",
      }}
    >
      {col.label}
      <span
        aria-hidden="true"
        style={{ font: "700 8px/1 var(--f-sans)", opacity: active ? 1 : 0.4 }}
      >
        {active ? (sortBy.endsWith("-asc") ? "▲" : "▼") : "▲▼"}
      </span>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab: Prealertas del cliente (read-only)
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
        eyebrow="Sin prealertas"
        title="Todavía no hay prealertas de clientes."
        description="Cuando un cliente anuncie una compra desde su portal, aparecerá acá como prealerta. Es de solo lectura — el cliente la gestiona desde su portal."
      />
    );
  }

  return (
    <>
      <div
        style={{
          font: "500 11.5px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 var(--s-3)",
        }}
      >
        Prealertas que los clientes anuncian desde el portal. Solo lectura — se
        gestionan en{" "}
        <a
          href="/studio/proveedores"
          className="studio-link-quiet"
          style={{ color: "var(--wine-text)" }}
        >
          PreAlertas de servicios
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
              gap: "var(--s-3)",
              padding: "14px 20px",
              borderTop: i > 0 ? "1px solid var(--border)" : 0,
              alignItems: "center",
            }}
          >
            <code
              style={{
                font: "700 12px/1.2 var(--f-mono)",
                color: "var(--wine-text)",
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
                  color: "var(--ink-soft)",
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
              <Badge tone={prealertaStatusTone(p.status)} size="sm">
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
        gap: "var(--s-3)",
        padding: "var(--s-3) var(--s-5)",
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
