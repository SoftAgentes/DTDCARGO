"use client";

/**
 * ProveedoresClient — vista de operador de Proveedores + Prealertas (SDD-0057,
 * Slice C · SOLO LECTURA).
 *
 * Header + 5 KPIs (conteo por estado: anunciada / en_camino / recibida /
 * consolidada / cancelada) + 2 tabs:
 *   - Prealertas entrantes ⭐ : cola de compras del tenant (recientes primero),
 *     filtro rápido "solo entrantes" (anunciada + en_camino). Read-only.
 *   - Proveedores            : suppliers_cn del tenant (#, nombre, ciudad,
 *     wechat/contacto, # de compras). Read-only.
 *
 * Cero writes / cero acciones que muten (alcance founder). Solo tokens var(--*).
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
}: {
  stats: PrealertaStats;
  prealertas: Prealerta[];
  suppliers: SupplierRow[];
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
          gap: 24,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Operación · CN</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Proveedores & prealertas.
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
          marginBottom: 20,
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
          gap: 4,
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
                  color: "var(--ink-mute)",
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
        />
      )}

      {tab === "suppliers" && <SuppliersTab suppliers={suppliers} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab: Prealertas entrantes
// ════════════════════════════════════════════════════════════════

const PREALERTA_GRID = "150px 1.3fr 1.1fr 70px 110px 130px";

function IncomingTab({
  prealertas,
  supplierName,
  incomingCount,
}: {
  prealertas: Prealerta[];
  supplierName: Record<string, string>;
  incomingCount: number;
}) {
  const [onlyIncoming, setOnlyIncoming] = useState(true);

  const rows = useMemo(() => {
    // Entrantes primero, luego el resto; dentro, lo más reciente arriba (las
    // queries ya vienen ordenadas por created_at desc).
    const ordered = [...prealertas].sort((a, b) => {
      const ai = INCOMING.has(a.status) ? 0 : 1;
      const bi = INCOMING.has(b.status) ? 0 : 1;
      return ai - bi;
    });
    return onlyIncoming
      ? ordered.filter((p) => INCOMING.has(p.status))
      : ordered;
  }, [prealertas, onlyIncoming]);

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
      {/* Filtro rápido */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
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
      </div>

      {rows.length === 0 ? (
        <EmptyState
          eyebrow="Sin entrantes"
          title="No hay prealertas entrantes ahora."
          description='Todas las compras están recibidas, consolidadas o canceladas. Tocá "Todas" para ver el historial completo.'
        />
      ) : (
        <TableShell>
          <HeaderRow grid={PREALERTA_GRID}>
            <span>Código</span>
            <span>Descripción</span>
            <span>Proveedor · cliente</span>
            <span style={{ textAlign: "right" }}>Cajas</span>
            <span style={{ textAlign: "right" }}>Valor</span>
            <span style={{ textAlign: "right" }}>Estado</span>
          </HeaderRow>
          {rows.map((p, i) => (
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
                      color: "var(--ink-mute)",
                      marginTop: 3,
                    }}
                  >
                    tracking {p.tracking_cn}
                  </div>
                )}
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
                  {p.supplier_id && supplierName[p.supplier_id]
                    ? supplierName[p.supplier_id]
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
              <span
                style={{
                  font: "600 12px/1 var(--f-mono)",
                  color: p.est_value_usd != null ? "var(--ink)" : "var(--ink-mute)",
                  textAlign: "right",
                }}
              >
                {p.est_value_usd != null
                  ? `$${p.est_value_usd.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : "—"}
              </span>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Badge tone={prealertaStatusTone(p.status)} size="sm" dot>
                  {prealertaStatusLabel(p.status)}
                </Badge>
              </div>
            </div>
          ))}
        </TableShell>
      )}
    </>
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
            gap: 12,
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
                color: "var(--ink-mute)",
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
                  color: "var(--ink-mute)",
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
