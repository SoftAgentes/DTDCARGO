"use client";

/**
 * ProveedoresClient — "PreAlertas de servicios" (SDD-0057 Slice C · SOLO
 * LECTURA; renombre + columnas configurables founder 2026-07-03).
 *
 * Header ("Solicitudes de servicio.") + 5 KPIs por estado + 2 tabs:
 *   - Prealertas entrantes ⭐ : cola de compras del tenant. Columnas
 *     CONFIGURABLES (orden + visibilidad, handoff Norte "Almacén CN →
 *     columnas configurables") vía useColumnConfig/ColumnManager, headers
 *     clickeables para ordenar (persistido) y búsqueda. Read-only.
 *   - Proveedores            : suppliers_cn del tenant (#, nombre, ciudad,
 *     wechat/contacto, # de compras). Read-only.
 *
 * Cero writes / cero acciones que muten (alcance founder). Solo tokens var(--*).
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
import type { PrealertaStats } from "@/lib/studio/prealertas/queries";

// Estados que el operador considera "entrantes" (esperando arribo a CN).
const INCOMING: ReadonlySet<string> = new Set(["anunciada", "en_camino"]);

/** Proveedor enriquecido con # de compras vivas (resuelto en el server). */
export type SupplierRow = {
  id: string;
  client_markbox: string;
  supplier_seq: number;
  name: string;
  city: string | null;
  wechat: string | null;
  contact: string | null;
  orderCount: number;
};

type Tab = "incoming" | "suppliers";

const TABS: { value: Tab; label: string }[] = [
  { value: "incoming", label: "Prealertas entrantes" },
  { value: "suppliers", label: "Proveedores" },
];

export function ProveedoresClient({
  stats,
  prealertas,
  suppliers,
  cbmByPrealertaId,
}: {
  stats: PrealertaStats;
  prealertas: Prealerta[];
  suppliers: SupplierRow[];
  /** CBM real medido al recibir en CN (Σ por prealerta · migr 0127). */
  cbmByPrealertaId: Record<string, number>;
}) {
  const [tab, setTab] = useState<Tab>("incoming");

  // nombre de proveedor por id (para la columna de la cola).
  const supplierName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of suppliers) m[s.id] = s.name;
    return m;
  }, [suppliers]);

  const incomingCount = stats.byStatus.anunciada + stats.byStatus.en_camino;

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
          <span className="studio-eyebrow">Operación · CN</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "var(--s-2) 0 var(--s-2)", color: "var(--ink)" }}
          >
            Solicitudes de servicio.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "72ch",
            }}
          >
            La cola de compras que los clientes anuncian desde el portal: cada
            prealerta avisa que viene mercancía de China para esperarla y
            atarla a su envío al llegar al almacén CN. Vista de solo lectura — el
            cliente las crea y edita desde su portal.
          </p>
        </div>
      </div>

      {/* KPIs · conteo por estado */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: "var(--s-5)",
        }}
      >
        <KpiCard
          value={stats.byStatus.anunciada}
          label="Anunciadas"
          valueColor={stats.byStatus.anunciada > 0 ? "var(--info)" : "var(--ink)"}
          sub="esperando salida del proveedor"
        />
        <KpiCard
          value={stats.byStatus.en_camino}
          label="En camino"
          valueColor={
            stats.byStatus.en_camino > 0 ? "var(--warning)" : "var(--ink)"
          }
          sub="rumbo al almacén CN"
        />
        <KpiCard
          value={stats.byStatus.recibida}
          label="Recibidas en CN"
          valueColor={
            stats.byStatus.recibida > 0 ? "var(--success)" : "var(--ink)"
          }
          sub="llegaron al hub"
        />
        <KpiCard
          value={stats.byStatus.consolidada}
          label="Consolidadas"
          valueColor={
            stats.byStatus.consolidada > 0 ? "var(--wine)" : "var(--ink)"
          }
          sub="atadas a un envío"
        />
        <KpiCard
          value={stats.byStatus.cancelada}
          label="Canceladas"
          sub="dadas de baja"
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
            tDef.value === "incoming" ? prealertas.length : suppliers.length;
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

      {tab === "incoming" && (
        <IncomingTab
          prealertas={prealertas}
          supplierName={supplierName}
          incomingCount={incomingCount}
          cbmByPrealertaId={cbmByPrealertaId}
        />
      )}

      {tab === "suppliers" && <SuppliersTab suppliers={suppliers} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab: Prealertas entrantes
// ════════════════════════════════════════════════════════════════

// ── Columnas configurables (regla Studio · handoff Norte 2026-07-03) ──────
// El array maestro (label + render) vive acá; lo persistido es solo
// { key, visible }[] bajo la clave del módulo. Proveedor · cliente va PRIMERA
// y Valor est. oculta por default (pedido founder — el operador no necesita el
// valor de la mercancía; lo puede encender desde "Columnas").
const PREALERTA_COLS_KEY = "dtd-prealertas-cols-v1";
const PREALERTA_COLS_DEFAULT: ColumnVisibility[] = [
  { key: "supplier", visible: true },
  { key: "date", visible: true },
  { key: "description", visible: true },
  { key: "code", visible: true },
  { key: "boxes", visible: true },
  { key: "cbm", visible: true },
  { key: "value", visible: false },
  { key: "status", visible: true },
];

const PREALERTA_COL_LABELS: ColumnLabels = {
  supplier: { label: "Proveedor · cliente", hint: "nombre + Shipping Mark" },
  date: { label: "Fecha", hint: "cuándo la anunció el cliente" },
  description: { label: "Descripción de artículos", hint: "incluye tracking CN" },
  code: { label: "Código", hint: "va rotulado en cada caja" },
  boxes: { label: "Cajas" },
  cbm: { label: "CBM", hint: "se mide al recibir en CN" },
  value: { label: "Valor est.", hint: "declarado por el cliente" },
  status: { label: "Estado" },
};

// Orden clickeando el header (persistido): [primer click, click siguiente].
type SortBy =
  | "client-asc"
  | "client-desc"
  | "date-asc"
  | "date-desc"
  | "boxes-desc"
  | "boxes-asc"
  | "cbm-desc"
  | "cbm-asc"
  | "value-desc"
  | "value-asc";

const PREALERTA_SORT_KEY = "dtd-prealertas-sort-v1";
const SORT_VALUES: ReadonlySet<string> = new Set([
  "client-asc",
  "client-desc",
  "date-asc",
  "date-desc",
  "boxes-desc",
  "boxes-asc",
  "cbm-desc",
  "cbm-asc",
  "value-desc",
  "value-asc",
]);

type ColDef = {
  key: string;
  label: string;
  width: string;
  align?: "right";
  sort?: [SortBy, SortBy];
  render: (p: Prealerta) => React.ReactNode;
};

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

function IncomingTab({
  prealertas,
  supplierName,
  incomingCount,
  cbmByPrealertaId,
}: {
  prealertas: Prealerta[];
  supplierName: Record<string, string>;
  incomingCount: number;
  cbmByPrealertaId: Record<string, number>;
}) {
  const [onlyIncoming, setOnlyIncoming] = useState(true);
  const [search, setSearch] = useState("");
  const [colCfg, setColCfg] = useColumnConfig(
    PREALERTA_COLS_KEY,
    PREALERTA_COLS_DEFAULT,
  );

  // Orden por defecto: por cliente A→Z y, dentro, la más vieja primero (FIFO
  // operativo). Persistido por navegador, igual que las columnas.
  const [sortBy, setSortBy] = useState<SortBy>("client-asc");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREALERTA_SORT_KEY);
      if (saved && SORT_VALUES.has(saved)) setSortBy(saved as SortBy);
    } catch {
      /* default */
    }
  }, []);
  const changeSort = (v: SortBy) => {
    setSortBy(v);
    try {
      localStorage.setItem(PREALERTA_SORT_KEY, v);
    } catch {
      /* en memoria */
    }
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = prealertas.filter((p) => !onlyIncoming || INCOMING.has(p.status));
    if (q) {
      out = out.filter(
        (p) =>
          p.code.toLowerCase().includes(q) ||
          p.client_markbox.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.tracking_cn ?? "").toLowerCase().includes(q) ||
          (p.supplier_id ? (supplierName[p.supplier_id] ?? "") : "")
            .toLowerCase()
            .includes(q),
      );
    }
    const cbmOf = (p: Prealerta): number | null =>
      cbmByPrealertaId[p.id] ?? null;
    const byDateAsc = (a: Prealerta, b: Prealerta) =>
      a.created_at.localeCompare(b.created_at);
    const compare: Record<SortBy, (a: Prealerta, b: Prealerta) => number> = {
      "client-asc": (a, b) =>
        a.client_markbox.localeCompare(b.client_markbox) || byDateAsc(a, b),
      "client-desc": (a, b) =>
        b.client_markbox.localeCompare(a.client_markbox) || byDateAsc(a, b),
      "date-asc": byDateAsc,
      "date-desc": (a, b) => byDateAsc(b, a),
      "boxes-desc": (a, b) => b.boxes - a.boxes || byDateAsc(a, b),
      "boxes-asc": (a, b) => a.boxes - b.boxes || byDateAsc(a, b),
      "cbm-desc": (a, b) =>
        (cbmOf(b) ?? -1) - (cbmOf(a) ?? -1) || byDateAsc(a, b),
      "cbm-asc": (a, b) =>
        (cbmOf(a) ?? Number.MAX_VALUE) - (cbmOf(b) ?? Number.MAX_VALUE) ||
        byDateAsc(a, b),
      "value-desc": (a, b) =>
        (b.est_value_usd ?? -1) - (a.est_value_usd ?? -1) || byDateAsc(a, b),
      "value-asc": (a, b) =>
        (a.est_value_usd ?? Number.MAX_VALUE) -
          (b.est_value_usd ?? Number.MAX_VALUE) || byDateAsc(a, b),
    };
    return [...out].sort(compare[sortBy]);
  }, [prealertas, onlyIncoming, search, sortBy, supplierName, cbmByPrealertaId]);

  // Array maestro de columnas (§2 del handoff): el key es el contrato estable.
  const columns: ColDef[] = [
    {
      key: "supplier",
      label: "Proveedor · cliente",
      width: "minmax(150px, 1.2fr)",
      sort: ["client-asc", "client-desc"],
      render: (p) => (
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
            {p.supplier_id && supplierName[p.supplier_id]
              ? supplierName[p.supplier_id]
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
      ),
    },
    {
      key: "date",
      label: "Fecha",
      width: "88px",
      sort: ["date-asc", "date-desc"],
      render: (p) => (
        <span
          title={new Date(p.created_at).toLocaleString("es-VE")}
          style={{
            font: "500 11px/1.2 var(--f-mono)",
            color: "var(--ink-soft)",
          }}
        >
          {shortDate(p.created_at)}
        </span>
      ),
    },
    {
      key: "description",
      label: "Descripción de artículos",
      width: "minmax(190px, 1.5fr)",
      render: (p) => (
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
            {p.description}
          </div>
          {p.tracking_cn && (
            <div
              style={{
                font: "500 10.5px/1.3 var(--f-mono)",
                color: "var(--ink-soft)",
                marginTop: 3,
              }}
            >
              tracking {p.tracking_cn}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "code",
      label: "Código",
      width: "148px",
      render: (p) => (
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
      ),
    },
    {
      key: "boxes",
      label: "Cajas",
      width: "62px",
      align: "right",
      sort: ["boxes-desc", "boxes-asc"],
      render: (p) => (
        <span
          style={{
            font: "700 12.5px/1 var(--f-mono)",
            color: "var(--ink)",
            textAlign: "right",
            display: "block",
          }}
        >
          {p.boxes}
        </span>
      ),
    },
    {
      key: "cbm",
      label: "CBM",
      width: "80px",
      align: "right",
      sort: ["cbm-desc", "cbm-asc"],
      render: (p) => {
        const cbm = cbmByPrealertaId[p.id];
        return (
          <span
            title={cbm == null ? "Se mide al recibir en el almacén CN" : undefined}
            style={{
              font: "600 12px/1 var(--f-mono)",
              color: cbm != null ? "var(--wine)" : "var(--ink-mute)",
              textAlign: "right",
              display: "block",
            }}
          >
            {cbm != null
              ? cbm.toLocaleString("es-VE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "—"}
          </span>
        );
      },
    },
    {
      key: "value",
      label: "Valor est.",
      width: "96px",
      align: "right",
      sort: ["value-desc", "value-asc"],
      render: (p) => (
        <span
          style={{
            font: "600 12px/1 var(--f-mono)",
            color: p.est_value_usd != null ? "var(--ink)" : "var(--ink-mute)",
            textAlign: "right",
            display: "block",
          }}
        >
          {p.est_value_usd != null
            ? `$${p.est_value_usd.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Estado",
      width: "132px",
      align: "right",
      render: (p) => (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Badge tone={prealertaStatusTone(p.status)} size="sm" dot>
            {prealertaStatusLabel(p.status)}
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
  const totBoxes = rows.reduce((acc, p) => acc + p.boxes, 0);
  const totCbm = rows.reduce(
    (acc, p) => acc + (cbmByPrealertaId[p.id] ?? 0),
    0,
  );

  if (prealertas.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin prealertas"
        title="Todavía no hay compras anunciadas."
        description="Cuando un cliente registre una compra desde su portal, aparecerá acá como prealerta para que la esperes y la ates a su envío al llegar al almacén CN."
      />
    );
  }

  return (
    <>
      {/* Toolbar: búsqueda + filtro rápido + gestor de columnas */}
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
            placeholder="Buscar código, cliente, proveedor o descripción…"
            aria-label="Buscar prealertas"
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
        <button
          type="button"
          onClick={() => setOnlyIncoming(true)}
          className={`studio-btn ${
            onlyIncoming ? "studio-btn-primary" : "studio-btn-ghost"
          }`}
        >
          Solo entrantes
          <span style={{ marginLeft: 6, opacity: 0.85 }}>{incomingCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setOnlyIncoming(false)}
          className={`studio-btn ${
            !onlyIncoming ? "studio-btn-primary" : "studio-btn-ghost"
          }`}
        >
          Todas
          <span style={{ marginLeft: 6, opacity: 0.85 }}>
            {prealertas.length}
          </span>
        </button>
        <div style={{ marginLeft: "auto" }}>
          <ColumnManager
            cfg={colCfg}
            setCfg={setColCfg}
            defaults={PREALERTA_COLS_DEFAULT}
            labels={PREALERTA_COL_LABELS}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          eyebrow={search.trim() ? "Sin resultados" : "Sin entrantes"}
          title={
            search.trim()
              ? "Nada coincide con tu búsqueda."
              : "No hay prealertas entrantes ahora."
          }
          description={
            search.trim()
              ? "Prueba con el código, el Shipping Mark del cliente, el proveedor o parte de la descripción."
              : 'Todas las compras están recibidas, consolidadas o canceladas. Toca "Todas" para ver el historial completo.'
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
          {rows.map((p, i) => (
            <div
              key={p.id}
              className="studio-tracking-row"
              style={{
                display: "grid",
                gridTemplateColumns: grid,
                gap: "var(--s-3)",
                padding: "14px 20px",
                borderTop: i > 0 ? "1px solid var(--border)" : 0,
                alignItems: "center",
              }}
            >
              {visibleColumns.map((col) => (
                <div key={col.key} style={{ minWidth: 0 }}>
                  {col.render(p)}
                </div>
              ))}
            </div>
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
              { label: "Σ prealertas", value: String(rows.length) },
              { label: "Σ cajas", value: String(totBoxes) },
              {
                label: "Σ CBM",
                value:
                  totCbm > 0
                    ? totCbm.toLocaleString("es-VE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "—",
              },
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
                    color: t.value === "—" ? "var(--ink-mute)" : "var(--wine)",
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
 * [primer click, click siguiente] con flecha ▲/▼ (pedido founder: ordenar
 * desde la propia columna, de mayor a menor y al revés).
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
      <span
        style={col.align === "right" ? { textAlign: "right" } : undefined}
      >
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
// Tab: Proveedores
// ════════════════════════════════════════════════════════════════

const SUPPLIER_GRID = "60px 1.4fr 1fr 1.1fr 110px";

function SuppliersTab({ suppliers }: { suppliers: SupplierRow[] }) {
  if (suppliers.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin proveedores"
        title="Todavía no hay proveedores cargados."
        description="Los clientes registran sus proveedores chinos desde el portal. Cuando lo hagan, aparecerán acá con su nº por cliente y su historial de compras."
      />
    );
  }

  return (
    <TableShell>
      <HeaderRow grid={SUPPLIER_GRID}>
        <span>Nº</span>
        <span>Proveedor · cliente</span>
        <span>Ciudad</span>
        <span>WeChat · contacto</span>
        <span style={{ textAlign: "right" }}>Compras</span>
      </HeaderRow>
      {suppliers.map((s, i) => (
        <div
          key={s.id}
          className="studio-tracking-row"
          style={{
            display: "grid",
            gridTemplateColumns: SUPPLIER_GRID,
            gap: "var(--s-3)",
            padding: "14px 20px",
            borderTop: i > 0 ? "1px solid var(--border)" : 0,
            alignItems: "center",
          }}
        >
          <span
            style={{
              font: "700 12.5px/1 var(--f-mono)",
              color: "var(--wine)",
            }}
          >
            #{s.supplier_seq}
          </span>
          <div style={{ overflow: "hidden" }}>
            <div
              style={{
                font: "700 12.5px/1.2 var(--f-sans)",
                color: "var(--ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.name}
            </div>
            <div
              style={{
                font: "500 10.5px/1.3 var(--f-mono)",
                color: "var(--ink-soft)",
                marginTop: 3,
              }}
            >
              {s.client_markbox || "—"}
            </div>
          </div>
          <span
            style={{
              font: "500 12px/1.3 var(--f-sans)",
              color: s.city ? "var(--ink)" : "var(--ink-mute)",
            }}
          >
            {s.city || "—"}
          </span>
          <div style={{ overflow: "hidden" }}>
            <div
              style={{
                font: "500 12px/1.3 var(--f-sans)",
                color: s.wechat ? "var(--ink)" : "var(--ink-mute)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.wechat ? `WeChat ${s.wechat}` : "—"}
            </div>
            {s.contact && (
              <div
                style={{
                  font: "500 10.5px/1.3 var(--f-sans)",
                  color: "var(--ink-soft)",
                  marginTop: 3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.contact}
              </div>
            )}
          </div>
          <span
            style={{
              font: "700 12.5px/1 var(--f-mono)",
              color: s.orderCount > 0 ? "var(--ink)" : "var(--ink-mute)",
              textAlign: "right",
            }}
          >
            {s.orderCount}
          </span>
        </div>
      ))}
    </TableShell>
  );
}

// ════════════════════════════════════════════════════════════════
// Shell de tabla (mismo patrón que naviera)
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
