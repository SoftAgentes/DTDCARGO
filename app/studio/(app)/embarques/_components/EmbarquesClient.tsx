"use client";

/**
 * EmbarquesClient — vista comercial agrupada por cliente (SDD-0012).
 *
 * - Tabs: Todos / Activos / Entregados / Con alertas (con counts)
 * - Toolbar: search por client_name, MARKBOX, code, ruta
 * - Tabla acordeón agrupada por cliente
 * - Click en row hijo abre ShipmentDetailDrawer
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  computeClientStats,
  groupShipmentsByClient,
  type ShipmentListRow,
} from "@/lib/studio/shipment-queries";
import {
  SERVICE_LABELS,
  STATUS_LABELS,
  type ShipmentStatus,
} from "@/lib/studio/shipment-types";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Icon } from "@/app/studio/_components/icons";
import { ShipmentDetailDrawer } from "./ShipmentDetailDrawer";

type Tab = "all" | "active" | "delivered" | "alerts";

const TERMINAL_STATUSES = new Set<ShipmentStatus>(["delivered", "cancelled"]);

function filterByTab(rows: ShipmentListRow[], tab: Tab): ShipmentListRow[] {
  switch (tab) {
    case "all":
      return rows;
    case "active":
      return rows.filter((r) => !TERMINAL_STATUSES.has(r.status));
    case "delivered":
      return rows.filter((r) => r.status === "delivered");
    case "alerts":
      return rows.filter((r) => r.status === "exception");
  }
}

function statusBadgeTone(
  status: ShipmentStatus,
): "neutral" | "info" | "success" | "warning" | "danger" | "wine" {
  if (status === "delivered") return "success";
  if (status === "cancelled") return "neutral";
  if (status === "exception" || status === "delayed_warehouse") return "danger";
  if (status === "in_customs") return "warning";
  if (status === "draft") return "neutral";
  return "info";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function EmbarquesClient({
  shipments,
}: {
  shipments: ShipmentListRow[];
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [drawerShipmentId, setDrawerShipmentId] = useState<string | null>(null);

  // Counts globales para los tabs (sin search aplicado)
  const tabCounts = useMemo(() => {
    const stats = computeClientStats(shipments);
    return {
      all: stats.count,
      active: stats.activeCount,
      delivered: shipments.filter((r) => r.status === "delivered").length,
      alerts: stats.alertCount,
    };
  }, [shipments]);

  // Apply tab + search → group
  const groupedFiltered = useMemo(() => {
    let rows = filterByTab(shipments, tab);

    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      rows = rows.filter((r) => {
        return (
          r.code.toLowerCase().includes(needle) ||
          (r.client_name ?? "").toLowerCase().includes(needle) ||
          (r.client_markbox ?? "").toLowerCase().includes(needle) ||
          (r.origin ?? "").toLowerCase().includes(needle) ||
          (r.destination ?? "").toLowerCase().includes(needle)
        );
      });
    }

    return groupShipmentsByClient(rows);
  }, [shipments, tab, q]);

  // Default expand: si <3 grupos, todos abiertos; sino, todos cerrados
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set<string>(),
  );

  const allExpanded = expanded.size === groupedFiltered.length;
  const defaultExpandKey = useMemo(() => {
    if (groupedFiltered.length < 3) {
      return new Set(groupedFiltered.map((g) => g.groupKey));
    }
    return new Set<string>();
  }, [groupedFiltered]);

  // Si el set de grupos cambia (filtros o tab), aplicar defaults una vez
  const groupsKey = groupedFiltered.map((g) => g.groupKey).join("|");
  const [lastGroupsKey, setLastGroupsKey] = useState("");
  if (groupsKey !== lastGroupsKey) {
    setExpanded(defaultExpandKey);
    setLastGroupsKey(groupsKey);
  }

  const toggleGroup = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    setExpanded(new Set(groupedFiltered.map((g) => g.groupKey)));
  };
  const collapseAll = () => {
    setExpanded(new Set());
  };

  const selectedShipment = drawerShipmentId
    ? shipments.find((s) => s.id === drawerShipmentId) ?? null
    : null;

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <span className="studio-eyebrow">Operación comercial</span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
        >
          Embarques.
        </h1>
        <p
          style={{
            font: "400 13px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "62ch",
          }}
        >
          Vista comercial agrupada por cliente. Para cambiar estado, editar
          campos o cancelar, abrí el detalle e ingresá al Tracking.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border)",
          marginBottom: 16,
          overflowX: "auto",
        }}
      >
        {(
          [
            { value: "all", label: "Todos", count: tabCounts.all },
            { value: "active", label: "Activos", count: tabCounts.active },
            { value: "delivered", label: "Entregados", count: tabCounts.delivered },
            { value: "alerts", label: "Con alertas", count: tabCounts.alerts },
          ] as { value: Tab; label: string; count: number }[]
        ).map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              style={{
                padding: "10px 14px",
                background: "transparent",
                border: 0,
                borderBottom: `2px solid ${active ? "var(--wine)" : "transparent"}`,
                font: `${active ? "700" : "500"} 13px/1 var(--f-sans)`,
                color: active ? "var(--ink)" : "var(--ink-soft)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginBottom: -1,
              }}
            >
              <span>{t.label}</span>
              <span
                style={{
                  padding: "2px 6px",
                  borderRadius: "var(--r-sm)",
                  background: active ? "var(--wine-tint)" : "var(--bg-elevated)",
                  color: active ? "var(--wine)" : "var(--ink-soft)",
                  font: "700 10.5px/1.3 var(--f-mono)",
                }}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toolbar: search + expand/collapse all */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 280px", minWidth: 240 }}>
          <label className="studio-label" htmlFor="emb-q">
            Buscar
          </label>
          <input
            id="emb-q"
            type="search"
            className="studio-input"
            placeholder="Cliente, MARKBOX, código, ruta…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {groupedFiltered.length > 0 && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            style={{ height: 38 }}
            onClick={allExpanded ? collapseAll : expandAll}
          >
            {allExpanded ? "Colapsar todo" : "Expandir todo"}
          </button>
        )}
      </div>

      {/* Tabla agrupada o empty */}
      {groupedFiltered.length === 0 ? (
        <EmptyState
          eyebrow={q ? "Sin resultados" : tab === "all" ? "Catálogo vacío" : "Sin envíos en este tab"}
          title={
            q
              ? "Ningún envío matchea la búsqueda."
              : tab === "all"
                ? "Aún no hay envíos registrados."
                : tab === "alerts"
                  ? "Sin envíos con alertas activas."
                  : tab === "delivered"
                    ? "Sin envíos entregados todavía."
                    : "Sin envíos activos."
          }
          description={
            q
              ? "Probá ajustar los términos de búsqueda."
              : "Creá envíos desde el Cotizador (convertir cotización aceptada) o desde /tracking/nuevo."
          }
        />
      ) : (
        <GroupedTable
          groups={groupedFiltered}
          expanded={expanded}
          toggleGroup={toggleGroup}
          onRowClick={(id) => setDrawerShipmentId(id)}
        />
      )}

      {selectedShipment && (
        <ShipmentDetailDrawer
          shipment={selectedShipment}
          onClose={() => setDrawerShipmentId(null)}
        />
      )}
    </div>
  );
}

// ── Grouped Table ──────────────────────────────────────────────

function GroupedTable({
  groups,
  expanded,
  toggleGroup,
  onRowClick,
}: {
  groups: ReturnType<typeof groupShipmentsByClient>;
  expanded: Set<string>;
  toggleGroup: (key: string) => void;
  onRowClick: (shipmentId: string) => void;
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
      {groups.map((group, gi) => {
        const isOpen = expanded.has(group.groupKey);
        return (
          <div
            key={group.groupKey}
            style={{
              borderTop: gi > 0 ? "1px solid var(--border)" : 0,
            }}
          >
            {/* Group header (clickeable como toggle) */}
            <button
              type="button"
              onClick={() => toggleGroup(group.groupKey)}
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "24px 1fr auto auto",
                gap: 12,
                padding: "14px 20px",
                background: isOpen ? "var(--bg-elevated)" : "transparent",
                border: 0,
                textAlign: "left",
                cursor: "pointer",
                alignItems: "center",
                transition: "background var(--dur-fast) var(--ease)",
              }}
              onMouseEnter={(e) => {
                if (!isOpen)
                  e.currentTarget.style.background = "var(--bg-elevated)";
              }}
              onMouseLeave={(e) => {
                if (!isOpen)
                  e.currentTarget.style.background = "transparent";
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  color: "var(--ink-soft)",
                  transform: isOpen ? "rotate(90deg)" : "none",
                  transition: "transform var(--dur-fast) var(--ease)",
                }}
              >
                {Icon.chevR(14)}
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    font: "700 14px/1.2 var(--f-sans)",
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {group.clientName}
                </span>
                {group.clientMarkbox && (
                  <Link
                    href={`/studio/clientes/${group.clientMarkbox}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      font: "700 11.5px/1 var(--f-mono)",
                      color: "var(--wine)",
                      textDecoration: "none",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {group.clientMarkbox}
                  </Link>
                )}
              </div>
              <div
                style={{
                  display: "inline-flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                {group.stats.alertCount > 0 && (
                  <Badge tone="danger" size="sm" dot>
                    {group.stats.alertCount} alerta
                    {group.stats.alertCount === 1 ? "" : "s"}
                  </Badge>
                )}
                <Badge tone="neutral" size="sm">
                  {group.stats.count}{" "}
                  {group.stats.count === 1 ? "envío" : "envíos"}
                </Badge>
              </div>
              <span
                style={{
                  font: "600 11.5px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                  textAlign: "right",
                  minWidth: 90,
                }}
              >
                {group.stats.totalCbm.toFixed(2)} m³
              </span>
            </button>

            {/* Children rows (cuando isOpen) */}
            {isOpen && (
              <div style={{ background: "var(--bg-surface)" }}>
                {/* Mini header de columnas */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "24px 130px 1fr 140px 130px 80px 100px",
                    gap: 10,
                    padding: "8px 20px",
                    borderTop: "1px solid var(--border)",
                    font: "700 9.5px/1 var(--f-sans)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--ink-mute)",
                  }}
                >
                  <span></span>
                  <span>Código</span>
                  <span>Ruta</span>
                  <span>Servicio</span>
                  <span>Estado</span>
                  <span style={{ textAlign: "right" }}>CBM</span>
                  <span>Creado</span>
                </div>
                {group.shipments.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onRowClick(s.id)}
                    style={{
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "24px 130px 1fr 140px 130px 80px 100px",
                      gap: 10,
                      padding: "10px 20px",
                      background: "transparent",
                      border: 0,
                      borderTop: "1px solid var(--border)",
                      alignItems: "center",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "background var(--dur-fast) var(--ease)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--bg-elevated)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span></span>
                    <span
                      style={{
                        font: "700 12px/1 var(--f-mono)",
                        color: "var(--ink)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {s.code}
                    </span>
                    <span
                      style={{
                        font: "500 12px/1.3 var(--f-sans)",
                        color: "var(--ink-soft)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.origin ?? "?"} → {s.destination ?? "?"}
                    </span>
                    <span
                      style={{
                        font: "600 11.5px/1 var(--f-sans)",
                        color: "var(--ink)",
                      }}
                    >
                      {SERVICE_LABELS[s.shipment_service].primary}
                    </span>
                    <span>
                      <Badge tone={statusBadgeTone(s.status)} size="sm" dot>
                        {STATUS_LABELS[s.status]}
                      </Badge>
                    </span>
                    <span
                      style={{
                        font: "600 12px/1 var(--f-mono)",
                        color: "var(--ink)",
                        textAlign: "right",
                      }}
                    >
                      {s.volume_m3 != null ? Number(s.volume_m3).toFixed(2) : "—"}
                    </span>
                    <span
                      style={{
                        font: "500 11px/1 var(--f-sans)",
                        color: "var(--ink-soft)",
                      }}
                    >
                      {formatDate(s.created_at)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
