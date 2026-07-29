"use client";

/**
 * ProveedoresClient — "Solicitudes de servicio" (SDD-0057 · renombre +
 * columnas configurables founder 2026-07-03; alta/edición de proveedores
 * agregada 2026-07-12).
 *
 * Header ("Solicitudes de servicio.") + 5 KPIs por estado + 2 tabs:
 *   - Prealertas entrantes ⭐ : cola de compras del tenant. Columnas
 *     CONFIGURABLES (orden + visibilidad, handoff Norte "Almacén CN →
 *     columnas configurables") vía useColumnConfig/ColumnManager, headers
 *     clickeables para ordenar (persistido) y búsqueda. Read-only (las crea
 *     el cliente desde su portal).
 *   - Proveedores            : suppliers_cn del tenant (#, nombre, ciudad,
 *     wechat/contacto, # de compras). El operador puede dar de alta un
 *     proveedor a nombre de un cliente y editar cualquiera — misma fila que
 *     ve el cliente en su portal (SupplierDrawer, migr 0229).
 *
 * Solo tokens var(--*).
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
import type { PrealertaServiceRequest } from "@/lib/studio/prealertas/addons";
import type { PackingListSubmission } from "@/lib/studio/prealertas/packlist-form";
import type { PrealertaStats } from "@/lib/studio/prealertas/queries";
import type {
  SupplierClaimRow,
  SupplierScorecard,
  SupplierScorecardStats,
} from "@/lib/studio/proveedores/scorecard-queries";
import {
  ServiceRequestsTab,
  type PrealertaLite,
} from "./ServiceRequestsTab";
import { PackingListsTab } from "./PackingListsTab";
import { ProviderLinkDrawer } from "./ProviderLinkDrawer";
import { SupplierDrawer } from "./SupplierDrawer";
import { ScorecardTab } from "./ScorecardTab";
import { ReclamosTab } from "./ReclamosTab";
import type { SupplierOption } from "./SupplierClaimDrawer";

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
  notes: string | null;
  orderCount: number;
};

type Tab =
  | "services"
  | "incoming"
  | "packing"
  | "suppliers"
  | "scorecard"
  | "reclamos";

const TABS: { value: Tab; label: string }[] = [
  { value: "services", label: "Servicios solicitados" },
  { value: "incoming", label: "Prealertas entrantes" },
  { value: "packing", label: "Packing lists" },
  { value: "suppliers", label: "Proveedores" },
  { value: "scorecard", label: "Scorecard" },
  { value: "reclamos", label: "Reclamos" },
];

export function ProveedoresClient({
  stats,
  prealertas,
  suppliers,
  cbmByPrealertaId,
  serviceRequests,
  packingLists,
  disabledShareIds,
  scorecards,
  claims,
  scorecardStats,
}: {
  stats: PrealertaStats;
  prealertas: Prealerta[];
  suppliers: SupplierRow[];
  /** CBM real medido al recibir en CN (Σ por prealerta · migr 0127). */
  cbmByPrealertaId: Record<string, number>;
  /** Solicitudes de servicio de recepción del tenant (SDD-0098 · PORT-1). */
  serviceRequests: PrealertaServiceRequest[];
  /** Packing lists vigentes enviados por proveedores (SDD-0096 · PORT-2). */
  packingLists: PackingListSubmission[];
  /** IDs de prealertas con el link del proveedor DESACTIVADO (SDD-0096 · PORT-4). */
  disabledShareIds: string[];
  /** Rating por ficha derivado en vivo (SDD-0111 · supplier_scorecard_v). */
  scorecards: SupplierScorecard[];
  /** Reclamos operativos al proveedor (SDD-0111 · supplier_claims). */
  claims: SupplierClaimRow[];
  /** KPIs del scorecard (SDD-0111). */
  scorecardStats: SupplierScorecardStats;
}) {
  const disabledShareSet = useMemo(
    () => new Set(disabledShareIds),
    [disabledShareIds],
  );
  const [tab, setTab] = useState<Tab>("services");

  // nombre de proveedor por id (para la columna de la cola).
  const supplierName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of suppliers) m[s.id] = s.name;
    return m;
  }, [suppliers]);

  // Contexto de compra por prealerta_id (código + descripción) para la bandeja.
  const prealertaById = useMemo(() => {
    const m: Record<string, PrealertaLite> = {};
    for (const p of prealertas) {
      m[p.id] = { code: p.code, description: p.description };
    }
    return m;
  }, [prealertas]);

  const pendingServices = useMemo(
    () =>
      serviceRequests.filter(
        (r) => r.status === "solicitada" || r.status === "en_proceso",
      ).length,
    [serviceRequests],
  );

  const incomingCount = stats.byStatus.anunciada + stats.byStatus.en_camino;

  // Opciones de proveedor para el drawer de reclamo (desde el scorecard).
  const supplierOptions: SupplierOption[] = useMemo(
    () =>
      scorecards.map((s) => ({
        supplier_cn_id: s.supplier_cn_id,
        name: s.name,
        supplier_seq: s.supplier_seq,
        client_markbox: s.client_markbox,
      })),
    [scorecards],
  );

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
            tDef.value === "services"
              ? serviceRequests.length
              : tDef.value === "incoming"
                ? prealertas.length
                : tDef.value === "packing"
                  ? packingLists.length
                  : tDef.value === "suppliers"
                    ? suppliers.length
                    : tDef.value === "scorecard"
                      ? scorecards.length
                      : claims.length;
          const alert = tDef.value === "services" && pendingServices > 0;
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
                title={alert ? `${pendingServices} pendientes por atender` : undefined}
                style={{
                  marginLeft: 7,
                  font: alert
                    ? "800 11px/1 var(--f-mono)"
                    : "600 11px/1 var(--f-mono)",
                  color: alert ? "var(--wine)" : "var(--ink-soft)",
                }}
              >
                {alert ? pendingServices : count}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "services" && (
        <ServiceRequestsTab
          requests={serviceRequests}
          prealertaById={prealertaById}
        />
      )}

      {tab === "incoming" && (
        <IncomingTab
          prealertas={prealertas}
          supplierName={supplierName}
          incomingCount={incomingCount}
          cbmByPrealertaId={cbmByPrealertaId}
          disabledShareSet={disabledShareSet}
        />
      )}

      {tab === "packing" && (
        <PackingListsTab
          submissions={packingLists}
          prealertaById={prealertaById}
        />
      )}

      {tab === "suppliers" && <SuppliersTab suppliers={suppliers} />}

      {tab === "scorecard" && (
        <ScorecardTab
          scorecards={scorecards}
          claims={claims}
          stats={scorecardStats}
        />
      )}

      {tab === "reclamos" && (
        <ReclamosTab claims={claims} suppliers={supplierOptions} />
      )}
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
  { key: "link", visible: true },
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
  link: { label: "Link proveedor", hint: "copiar · activar / desactivar el enlace" },
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
  disabledShareSet,
}: {
  prealertas: Prealerta[];
  supplierName: Record<string, string>;
  incomingCount: number;
  cbmByPrealertaId: Record<string, number>;
  /** IDs de prealertas con el link del proveedor desactivado (PORT-4). */
  disabledShareSet: Set<string>;
}) {
  const [onlyIncoming, setOnlyIncoming] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLink, setSelectedLink] = useState<Prealerta | null>(null);
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
          {/* Nota que el CLIENTE escribió sobre esta compra (SDD-0173, migr
              0269). Va acá y no en una columna propia: es contexto de la
              compra, se lee junto a la descripción y no ensancha la tabla.
              Hasta este cambio la columna era write-only — el cliente escribía
              "pedido urgente" y nadie en DTD lo veía. */}
          {p.client_note && (
            <div
              title={p.client_note}
              style={{
                font: "500 11px/1.35 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Nota del cliente: {p.client_note}
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
            color: "var(--wine-text)",
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
      key: "link",
      label: "Link proveedor",
      width: "108px",
      render: (p) => {
        const active = !disabledShareSet.has(p.id);
        return (
          <button
            type="button"
            onClick={() => setSelectedLink(p)}
            title="Gestionar el link del proveedor"
            className="studio-btn studio-btn-ghost"
            style={{ height: 26, padding: "0 9px" }}
          >
            <span
              aria-hidden
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: active ? "var(--success)" : "var(--danger)",
                display: "inline-block",
                marginRight: 6,
              }}
            />
            <span style={{ font: "600 11px/1 var(--f-sans)" }}>
              {active ? "Link" : "Revocado"}
            </span>
          </button>
        );
      },
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

      {selectedLink && (
        <ProviderLinkDrawer
          prealertaId={selectedLink.id}
          code={selectedLink.code}
          shareToken={selectedLink.share_token}
          clientMarkbox={selectedLink.client_markbox}
          supplierName={
            selectedLink.supplier_id
              ? (supplierName[selectedLink.supplier_id] ?? null)
              : null
          }
          initialActive={!disabledShareSet.has(selectedLink.id)}
          onClose={() => setSelectedLink(null)}
        />
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

const SUPPLIER_GRID = "60px 1.4fr 1fr 1.1fr 90px 74px";

function SuppliersTab({ suppliers }: { suppliers: SupplierRow[] }) {
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<"new" | SupplierRow | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.client_markbox.toLowerCase().includes(q) ||
        (s.city ?? "").toLowerCase().includes(q) ||
        (s.wechat ?? "").toLowerCase().includes(q) ||
        (s.contact ?? "").toLowerCase().includes(q),
    );
  }, [suppliers, search]);

  return (
    <>
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
            placeholder="Buscar proveedor, cliente, ciudad o WeChat…"
            aria-label="Buscar proveedores"
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
          onClick={() => setDrawer("new")}
          className="studio-btn studio-btn-primary"
          style={{ marginLeft: "auto" }}
        >
          + Nuevo proveedor
        </button>
      </div>

      {suppliers.length === 0 ? (
        <EmptyState
          eyebrow="Sin proveedores"
          title="Todavía no hay proveedores cargados."
          description="Los clientes registran sus proveedores chinos desde el portal, o dalos de alta acá a nombre de un cliente. Aparecen con su nº por cliente y su historial de compras."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          eyebrow="Sin resultados"
          title="Nada coincide con tu búsqueda."
          description="Prueba con el nombre del proveedor, el Shipping Mark del cliente, la ciudad o el WeChat."
        />
      ) : (
        <TableShell>
          <HeaderRow grid={SUPPLIER_GRID}>
            <span>Nº</span>
            <span>Proveedor · cliente</span>
            <span>Ciudad</span>
            <span>WeChat · contacto</span>
            <span style={{ textAlign: "right" }}>Compras</span>
            <span />
          </HeaderRow>
          {rows.map((s, i) => (
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
                  color: "var(--wine-text)",
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
                  color: s.orderCount > 0 ? "var(--ink)" : "var(--ink-soft)",
                  textAlign: "right",
                }}
              >
                {s.orderCount}
              </span>
              <div style={{ textAlign: "right" }}>
                <button
                  type="button"
                  onClick={() => setDrawer(s)}
                  className="studio-btn studio-btn-ghost"
                  style={{ height: 26, padding: "0 9px" }}
                >
                  Editar
                </button>
              </div>
            </div>
          ))}
        </TableShell>
      )}

      {drawer && (
        <SupplierDrawer
          supplier={drawer === "new" ? undefined : drawer}
          allSuppliers={suppliers}
          onClose={() => setDrawer(null)}
        />
      )}
    </>
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
