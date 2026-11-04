"use client";

/**
 * EmbarquesClient — vista comercial agrupada por cliente (SDD-0012).
 *
 * - Tabs: Todos / Activos / Entregados / Con alertas (con counts)
 * - Toolbar: search por client_name, MARKBOX, code, ruta
 * - Tabla acordeón agrupada por cliente
 * - Click en row hijo abre ShipmentDetailDrawer
 * - SDD-0522: quien puede eliminar (admin) ve una casilla por fila, el motivo
 *   de las bloqueadas, una barra con la selección y un ConfirmDialog R3 con
 *   motivo obligatorio. La casilla vive FUERA del <button> de la fila: un
 *   control interactivo dentro de otro no es HTML válido ni accesible.
 * - SDD-0560: junto al motivo de una fila bloqueada, «Ver los pasos» abre el
 *   asistente de borrado de ese embarque (`AsistenteBorrado`).
 */

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  computeClientStats,
  groupShipmentsByClient,
  type ShipmentListRow,
} from "@/lib/studio/shipment-queries";
import {
  SERVICE_LABELS,
  SERVICE_OPTIONS,
  STATUS_LABELS,
  type ShipmentService,
  type ShipmentStatus,
} from "@/lib/studio/shipment-types";
import { computeProgress } from "@/lib/studio/tracking-progress";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Icon } from "@/app/studio/_components/icons";
import { ShipmentDetailDrawer } from "./ShipmentDetailDrawer";
import { AdjuntosConteo } from "@/app/studio/_components/documents/AdjuntosConteo";
import {
  FILTRO_ADJUNTOS_OPCIONES,
  desgloseEmbarque,
  pasaFiltroAdjuntos,
  type ConteoEmbarque,
  type ConteosPorId,
  type FiltroAdjuntos,
} from "@/lib/studio/documents/adjuntos";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  MAX_LOTE_BORRADO,
  shipmentDeleteBlockReason,
  shipmentDeleteWarningsSummary,
  type InfoBorradoEmbarque,
} from "@/lib/studio/borrado/reglas";
import { deleteShipmentsAction } from "../actions";
import { AsistenteBorrado } from "./AsistenteBorrado";

/**
 * SDD-0522 · Qué sabe la pantalla para ofrecer el borrado. `undefined` = quien
 * mira no puede eliminar: no se pinta nada. `no_disponible` = no se pudo leer
 * qué bloquea cada embarque: se dice y no se ofrece borrar.
 */
export type EliminacionEmbarques =
  | { estado: "lista"; info: Record<string, InfoBorradoEmbarque> }
  | { estado: "no_disponible" };

/** Lo que cuelga de la casilla de cada fila. */
interface Seleccionable {
  seleccion: Set<string>;
  motivo: (id: string) => string | null;
  onToggle: (id: string) => void;
  onToggleGrupo: (ids: string[]) => void;
  /** SDD-0560: ¿el asistente tiene algo que mostrar para este bloqueado? */
  guiable: (id: string) => boolean;
  onGuiar: (id: string, code: string) => void;
}

const BORRADO_SIN_CONFIRMAR =
  "No se pudo confirmar el borrado. Recarga la lista para ver cómo quedó.";

type Tab = "all" | "active" | "delivered" | "alerts";
type ServiceFilter = ShipmentService | "all";

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
  adjuntos,
  eliminacion,
}: {
  shipments: ShipmentListRow[];
  /**
   * SDD-0507: adjuntos por embarque. `null` = no se pudo contar (se dice).
   * `undefined` = quien mira no tiene el módulo `tracking`: la RLS no le deja
   * ver ningún adjunto de embarque, así que no se pinta nada (un «Ninguno» en
   * todas las filas no sería cierto).
   */
  adjuntos: ConteosPorId<ConteoEmbarque> | undefined;
  /** SDD-0522: ver `EliminacionEmbarques`. */
  eliminacion?: EliminacionEmbarques;
}) {
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());
  // SDD-0560: el embarque cuyo asistente de borrado está abierto.
  const [guiando, setGuiando] = useState<{ id: string; code: string } | null>(null);

  const seleccionable: Seleccionable | null =
    eliminacion?.estado === "lista"
      ? {
          seleccion,
          // La misma regla que decide el servidor: sin información, bloquea.
          motivo: (id) => shipmentDeleteBlockReason(eliminacion.info[id]),
          onToggle: (id) =>
            setSeleccion((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            }),
          onToggleGrupo: (ids) =>
            setSeleccion((prev) => {
              const next = new Set(prev);
              const todos = ids.length > 0 && ids.every((id) => next.has(id));
              for (const id of ids) {
                if (todos) next.delete(id);
                else next.add(id);
              }
              return next;
            }),
          // Sin lectura no hay plan que mostrar, y uno ya eliminado tampoco.
          guiable: (id) => {
            const info = eliminacion.info[id];
            return info !== undefined && !info.bloqueos.already_deleted;
          },
          onGuiar: (id, code) => setGuiando({ id, code }),
        }
      : null;

  // Lo elegido que sigue en la lista y se puede eliminar, por código.
  const elegidos = useMemo(
    () =>
      eliminacion?.estado === "lista"
        ? shipments
            .filter((s) => seleccion.has(s.id) && shipmentDeleteBlockReason(eliminacion.info[s.id]) === null)
            .sort((a, b) => a.code.localeCompare(b.code))
        : [],
    [shipments, seleccion, eliminacion],
  );

  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all");
  const [filtroAdjuntos, setFiltroAdjuntos] = useState<FiltroAdjuntos>("todos");
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

  // Apply tab + service + search → group
  const groupedFiltered = useMemo(() => {
    let rows = filterByTab(shipments, tab);

    if (serviceFilter !== "all") {
      rows = rows.filter((r) => r.shipment_service === serviceFilter);
    }

    // SDD-0507: con / sin adjuntos. Sin conteo no filtra (y el select ni se pinta).
    rows = rows.filter((r) => pasaFiltroAdjuntos(filtroAdjuntos, adjuntos ?? null, r.id));

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
  }, [shipments, tab, serviceFilter, q, filtroAdjuntos, adjuntos]);

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
      <div style={{ marginBottom: "var(--s-6)" }}>
        <span className="studio-eyebrow">Operación comercial</span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "var(--s-2) 0 var(--s-2)", color: "var(--ink)" }}
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
          campos o cancelar, abre el detalle e ingresa al Tracking.
        </p>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Filtrar embarques"
        style={{ marginBottom: "var(--s-4)" }}
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
              role="tab"
              aria-selected={active}
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
                gap: "var(--s-2)",
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

      {/* Toolbar: search + expand/collapse all
          Mobile (<640px): cada item ocupa fila completa (stretch).
          Desktop: search 1fr, select 200, botón inline a la derecha. */}
      <div
        className="emb-toolbar"
        style={{
          display: "flex",
          gap: "var(--s-3)",
          alignItems: "stretch",
          marginBottom: "var(--s-4)",
          flexWrap: "wrap",
        }}
      >
        <div
          className="emb-toolbar-search"
          style={{ flex: "1 1 280px", minWidth: 240 }}
        >
          <label className="studio-label" htmlFor="emb-q">
            Buscar
          </label>
          <input
            id="emb-q"
            type="search"
            className="studio-input"
            placeholder="Cliente, Shipping Mark, código, ruta…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div
          className="emb-toolbar-svc"
          style={{ flex: "0 1 220px", minWidth: 180 }}
        >
          <label className="studio-label" htmlFor="emb-svc">
            Servicio
          </label>
          <select
            id="emb-svc"
            className="studio-input"
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value as ServiceFilter)}
          >
            <option value="all">Todos los servicios</option>
            {SERVICE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {adjuntos != null && (
          <div
            className="emb-toolbar-adj"
            style={{ flex: "0 1 180px", minWidth: 160 }}
          >
            <label className="studio-label" htmlFor="emb-adj">
              Adjuntos
            </label>
            <select
              id="emb-adj"
              className="studio-input"
              value={filtroAdjuntos}
              onChange={(e) => setFiltroAdjuntos(e.target.value as FiltroAdjuntos)}
            >
              {FILTRO_ADJUNTOS_OPCIONES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {groupedFiltered.length > 0 && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm emb-toolbar-toggle"
            onClick={allExpanded ? collapseAll : expandAll}
          >
            {allExpanded ? "Colapsar todo" : "Expandir todo"}
          </button>
        )}
      </div>
      {/* Responsive: mobile-first stack del toolbar + header del grupo */}
      <style>{`
        @media (max-width: 640px) {
          .emb-toolbar-search,
          .emb-toolbar-svc,
          .emb-toolbar-adj {
            flex: 1 1 100% !important;
            min-width: 0 !important;
          }
          .emb-toolbar-toggle {
            align-self: flex-start;
          }
          /* Header de grupo: 2 filas en mobile
             Row 1: chev + nombre (full)
             Row 2: badges + m³ */
          .emb-group-header {
            grid-template-columns: 24px 1fr auto !important;
            row-gap: 6px !important;
          }
          .emb-group-header > :nth-child(1) {
            grid-row: 1 / span 2;
            align-self: start;
            margin-top: 2px;
          }
          .emb-group-header > :nth-child(2) {
            grid-row: 1;
            grid-column: 2 / -1;
          }
          .emb-group-header > :nth-child(3) {
            grid-row: 2;
            grid-column: 2;
            justify-self: start;
          }
          .emb-group-header > :nth-child(4) {
            grid-row: 2;
            grid-column: 3;
            justify-self: end;
          }
        }
        @media (min-width: 641px) {
          .emb-toolbar-toggle {
            align-self: flex-end;
            margin-left: auto;
          }
        }
      `}</style>

      {/* SDD-0522: sin saber qué bloquea cada embarque no se ofrece borrar. */}
      {eliminacion?.estado === "no_disponible" && (
        <p
          role="status"
          style={{
            margin: "0 0 var(--s-3)",
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          No se pudo comprobar qué embarques se pueden eliminar. Recarga la página.
        </p>
      )}

      {/* SDD-0507: si no se pudo contar, se dice; la columna no se pinta. */}
      {adjuntos === null && (
        <p
          role="status"
          style={{
            margin: "0 0 var(--s-3)",
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          No se pudieron contar los adjuntos.
        </p>
      )}

      {/* Tabla agrupada o empty */}
      {groupedFiltered.length === 0 ? (
        <EmptyState
          eyebrow={
            q || filtroAdjuntos !== "todos"
              ? "Sin resultados"
              : tab === "all"
                ? "Catálogo vacío"
                : "Sin envíos en este tab"
          }
          title={
            q
              ? "Ningún envío matchea la búsqueda."
              : filtroAdjuntos !== "todos"
                ? filtroAdjuntos === "con"
                  ? "Ningún envío de esta vista tiene adjuntos."
                  : "Todos los envíos de esta vista tienen adjuntos."
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
              ? "Prueba ajustar los términos de búsqueda."
              : filtroAdjuntos !== "todos"
                ? "Cambia el filtro «Adjuntos» a «Todos» para ver el resto."
              : "Crea envíos desde Estimados (convertir estimado aceptado) o desde /tracking/nuevo."
          }
        />
      ) : (
        <GroupedTable
          groups={groupedFiltered}
          expanded={expanded}
          toggleGroup={toggleGroup}
          onRowClick={(id) => setDrawerShipmentId(id)}
          adjuntos={adjuntos ?? null}
          seleccionable={seleccionable}
        />
      )}

      {selectedShipment && (
        <ShipmentDetailDrawer
          shipment={selectedShipment}
          onClose={() => setDrawerShipmentId(null)}
        />
      )}

      {seleccionable && elegidos.length > 0 && (
        <PanelDeBorrado
          elegidos={elegidos}
          eliminacion={eliminacion}
          onCancelar={() => setSeleccion(new Set())}
          onBorrado={() => setSeleccion(new Set())}
        />
      )}

      {seleccionable && guiando && (
        <AsistenteEnEmbarques
          embarque={guiando}
          onClose={() => setGuiando(null)}
          onEliminado={() => {
            setSeleccion((prev) => {
              const next = new Set(prev);
              next.delete(guiando.id);
              return next;
            });
            setGuiando(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * SDD-0560 · El asistente montado desde la lista. Como el panel de borrado,
 * sólo se monta cuando se abre: quien no puede borrar no depende del toast.
 * El éxito final es UN aviso (AVS-01); la lista se revalida sola.
 */
function AsistenteEnEmbarques({
  embarque,
  onClose,
  onEliminado,
}: {
  embarque: { id: string; code: string };
  onClose: () => void;
  onEliminado: () => void;
}) {
  const toast = useToast();
  return (
    <AsistenteBorrado
      shipmentId={embarque.id}
      shipmentCode={embarque.code}
      onClose={onClose}
      onEliminado={(hecho) => {
        toast.show({
          eventKey: "shipments:deleted",
          tone: "success",
          message: hecho,
          priority: "normal",
          scope: "module",
          dedupeKey: `shipments:deleted:${embarque.code}`,
        });
        onEliminado();
      }}
    />
  );
}

/**
 * SDD-0522 · Barra + diálogo + aviso. Sólo se monta con selección, así quien no
 * puede borrar no depende del ToastProvider ni de nada de esto. El diálogo va
 * como HERMANO de la barra: la barra tiene transform y backdrop-filter, que la
 * vuelven el contenedor de cualquier hijo `position: fixed`.
 */
function PanelDeBorrado({
  elegidos,
  eliminacion,
  onCancelar,
  onBorrado,
}: {
  elegidos: ShipmentListRow[];
  eliminacion: EliminacionEmbarques | undefined;
  onCancelar: () => void;
  onBorrado: () => void;
}) {
  const toast = useToast();
  const [confirmar, setConfirmar] = useState(false);
  const [errorBorrado, setErrorBorrado] = useState<string | undefined>(undefined);
  const [borrando, startBorrado] = useTransition();

  const cerrarConfirmacion = () => {
    if (borrando) return;
    setConfirmar(false);
    setErrorBorrado(undefined);
  };

  const confirmarBorrado = (motivo: string) => {
    const ids = elegidos.map((s) => s.id);
    // Limpiar antes de reintentar: el diálogo reabre su candado cuando cambia
    // `error`, también si la acción repite el mismo mensaje.
    setErrorBorrado(undefined);
    startBorrado(async () => {
      try {
        const resultado = await deleteShipmentsAction(ids, motivo);
        if (resultado.ok) {
          setConfirmar(false);
          toast.show({
            eventKey: "shipments:deleted",
            tone: "success",
            message:
              resultado.deleted === 1
                ? `Embarque ${resultado.codes[0] ?? ""} eliminado. Ya no aparece en Embarques, Tracking ni el Portal.`
                : `${resultado.deleted} embarques eliminados. Ya no aparecen en Embarques, Tracking ni el Portal.`,
            priority: "normal",
            scope: "module",
            dedupeKey: `shipments:deleted:${resultado.codes.join(",")}`,
          });
          onBorrado();
        } else {
          setErrorBorrado(resultado.error);
        }
      } catch {
        setErrorBorrado(BORRADO_SIN_CONFIRMAR);
      }
    });
  };

  return (
    <>
      {/* Colchón: la barra es fija y taparía la última fila. */}
      <div aria-hidden style={{ height: 96 }} />
      <BarraDeSeleccion
        cantidad={elegidos.length}
        pending={borrando}
        onEliminar={() => {
          setErrorBorrado(undefined);
          setConfirmar(true);
        }}
        onCancelar={onCancelar}
      />
      <ConfirmDialog
        open={confirmar}
        danger
        reason
        reasonRequired
        reasonLabel="Motivo (obligatorio, sin datos personales)"
        reasonPlaceholder="p. ej. Embarques de prueba"
        title={elegidos.length === 1 ? "Eliminar 1 embarque" : `Eliminar ${elegidos.length} embarques`}
        message={mensajeConfirmacion(elegidos, eliminacion)}
        confirmLabel={elegidos.length === 1 ? "Eliminar embarque" : "Eliminar embarques"}
        pending={borrando}
        error={errorBorrado}
        onCancel={cerrarConfirmacion}
        onConfirm={confirmarBorrado}
      />
    </>
  );
}

/** El texto del diálogo: qué se elimina, qué pasa y qué se conserva. */
function mensajeConfirmacion(
  elegidos: ShipmentListRow[],
  eliminacion: EliminacionEmbarques | undefined,
): string {
  const codigos = elegidos.map((s) => s.code).join(", ");
  const avisos =
    eliminacion?.estado === "lista"
      ? shipmentDeleteWarningsSummary(elegidos.map((s) => eliminacion.info[s.id]))
      : null;
  return [
    `Vas a eliminar ${elegidos.length === 1 ? "el embarque" : `${elegidos.length} embarques`}: ${codigos}.`,
    "Desaparecen de Embarques, Tracking, el Portal del cliente y el calendario, y se cancelan sus avisos pendientes.",
    "Sus códigos no se pueden volver a usar. Solo se recuperan desde la base de datos.",
    avisos,
  ]
    .filter(Boolean)
    .join(" ");
}

// ── Barra de selección (SDD-0522) ──────────────────────────────
// Mismo panel que la barra masiva del Almacén CN: aparece sólo con selección.

function BarraDeSeleccion({
  cantidad,
  pending,
  onEliminar,
  onCancelar,
}: {
  cantidad: number;
  pending: boolean;
  onEliminar: () => void;
  onCancelar: () => void;
}) {
  const excede = cantidad > MAX_LOTE_BORRADO;
  return (
    <div
      role="region"
      aria-label={`Selección de embarques · ${cantidad}`}
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 70,
        maxWidth: "calc(100vw - 32px)",
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        border: "1px solid var(--glass-border)",
        color: "var(--glass-ink)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--glass-shadow), var(--glass-hi)",
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ font: "700 12.5px/1 var(--f-sans)", color: "var(--glass-ink)", whiteSpace: "nowrap" }}>
          {cantidad === 1 ? "1 embarque seleccionado" : `${cantidad} embarques seleccionados`}
        </span>
        <span aria-hidden style={{ width: 1, height: 20, background: "var(--glass-border)" }} />
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          onClick={onCancelar}
          disabled={pending}
        >
          Cancelar selección
        </button>
        <button
          type="button"
          className="studio-btn studio-btn-danger studio-btn-sm"
          onClick={onEliminar}
          disabled={pending || excede}
          aria-describedby={excede ? "emb-borrado-excede" : undefined}
        >
          Eliminar…
        </button>
      </div>
      {excede && (
        <p id="emb-borrado-excede" role="status" style={{ margin: 0, font: "600 11.5px/1.3 var(--f-sans)" }}>
          Elige hasta {MAX_LOTE_BORRADO} por vez: quita {cantidad - MAX_LOTE_BORRADO} de la selección.
        </p>
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
  adjuntos,
  seleccionable,
}: {
  groups: ReturnType<typeof groupShipmentsByClient>;
  expanded: Set<string>;
  toggleGroup: (key: string) => void;
  onRowClick: (shipmentId: string) => void;
  adjuntos: ConteosPorId<ConteoEmbarque>;
  /** SDD-0522: `null` = sin casillas (quien mira no puede eliminar). */
  seleccionable: Seleccionable | null;
}) {
  // SDD-0507: «Adjuntos» va antes de «Creado», sólo si se pudo contar.
  const columnas =
    adjuntos === null
      ? "24px 130px minmax(120px, 1fr) 130px 130px 110px 70px 90px 84px"
      : "24px 130px minmax(120px, 1fr) 130px 130px 110px 70px 96px 90px 84px";
  // SDD-0522: la fila es [casilla | botón con el resto]. El botón usa las
  // mismas columnas sin la primera, así el encabezado y las filas no se
  // desalinean (24px + gap + resto, igual que el encabezado).
  const columnasDatos = columnas.replace(/^24px /, "");
  const anchoMinimo = adjuntos === null ? 1008 : 1114;
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
            {/* Group header (clickeable como toggle).
                Desktop: grid horizontal 4 cols (chev / nombre / badges / m³).
                Mobile (<640px): areas en 2 filas — nombre arriba, badges+m³
                en la segunda. Nombre nunca colapsa a 0px gracias a min 0
                + overflow del wrapper interno. */}
            <button
              type="button"
              onClick={() => toggleGroup(group.groupKey)}
              className="emb-group-header"
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "24px minmax(0, 1fr) auto auto",
                gap: "var(--s-3)",
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
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    font: "700 14px/1.2 var(--f-sans)",
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
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
                      color: "var(--wine-text)",
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
                  gap: "var(--s-2)",
                  alignItems: "center",
                }}
              >
                {group.stats.alertCount > 0 && (
                  <Badge tone="danger" size="sm">
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
            {/* Scroll horizontal aislado: el grid de 8 columnas necesita ~824px
                mínimo. En mobile (< 824px) scrollea horizontal dentro del
                contenedor, NO en el body. Body queda contenido. */}
            {isOpen && (
              <div
                style={{
                  background: "var(--bg-surface)",
                  overflowX: "auto",
                }}
              >
                {/* Mini header de columnas */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: columnas,
                    gap: 10,
                    padding: "var(--s-2) var(--s-5)",
                    borderTop: "1px solid var(--border)",
                    font: "700 10.5px/1 var(--f-sans)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                    minWidth: anchoMinimo,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center" }}>
                    {seleccionable && (
                      <CasillaDeGrupo
                        clientName={group.clientName}
                        ids={group.shipments
                          .filter((s) => seleccionable.motivo(s.id) === null)
                          .map((s) => s.id)}
                        seleccionable={seleccionable}
                      />
                    )}
                  </span>
                  <span>Código</span>
                  <span>Ruta</span>
                  <span>Servicio</span>
                  <span>Estado</span>
                  <span>Progreso</span>
                  <span style={{ textAlign: "right" }}>CBM</span>
                  {adjuntos !== null && <span>Adjuntos</span>}
                  <span>Creado</span>
                  <span />
                </div>
                {group.shipments.map((s) => {
                  const pct = computeProgress(s.status);
                  const svc = SERVICE_LABELS[s.shipment_service];
                  const motivo = seleccionable ? seleccionable.motivo(s.id) : null;
                  const elegido = seleccionable?.seleccion.has(s.id) === true && motivo === null;
                  const fondo = elegido ? "var(--wine-tint)" : "transparent";
                  const motivoId = `emb-motivo-${s.id}`;
                  return (
                    <div
                      key={s.id}
                      data-row-id={s.code}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "24px minmax(0, 1fr)",
                        columnGap: 10,
                        padding: "var(--s-3) var(--s-5)",
                        background: fondo,
                        borderTop: "1px solid var(--border)",
                        alignItems: "center",
                        transition: "background var(--dur-fast) var(--ease)",
                        minWidth: anchoMinimo,
                      }}
                      onMouseEnter={(e) => {
                        if (!elegido) e.currentTarget.style.background = "var(--bg-elevated)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = fondo;
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center" }}>
                        {seleccionable && (
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar ${s.code}`}
                            checked={elegido}
                            disabled={motivo !== null}
                            aria-describedby={motivo !== null ? motivoId : undefined}
                            onChange={() => seleccionable.onToggle(s.id)}
                            style={{
                              accentColor: "var(--wine)",
                              cursor: motivo !== null ? "not-allowed" : "pointer",
                              width: 16,
                              height: 16,
                              margin: 0,
                            }}
                          />
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRowClick(s.id)}
                        style={{
                          width: "100%",
                          display: "grid",
                          gridTemplateColumns: columnasDatos,
                          gap: 10,
                          padding: 0,
                          background: "transparent",
                          border: 0,
                          alignItems: "center",
                          textAlign: "left",
                          cursor: "pointer",
                          color: "inherit",
                          font: "inherit",
                        }}
                      >
                      <span
                        style={{
                          font: "700 13px/1 var(--f-mono)",
                          color: "var(--wine-text)",
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
                      <span style={{ minWidth: 0 }}>
                        <div
                          style={{
                            font: "600 11.5px/1.1 var(--f-sans)",
                            color: "var(--ink)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {svc.primary}
                        </div>
                        {svc.sub && (
                          <div
                            style={{
                              font: "500 10px/1.1 var(--f-sans)",
                              color: "var(--ink-soft)",
                              marginTop: 2,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {svc.sub}
                          </div>
                        )}
                      </span>
                      <span>
                        <Badge tone={statusBadgeTone(s.status)} size="sm">
                          {STATUS_LABELS[s.status]}
                        </Badge>
                      </span>
                      <ProgressBar pct={pct} status={s.status} />
                      <span
                        style={{
                          font: "600 12px/1 var(--f-mono)",
                          color: "var(--ink)",
                          textAlign: "right",
                        }}
                      >
                        {s.volume_m3 != null ? Number(s.volume_m3).toFixed(2) : "—"}
                      </span>
                      {adjuntos !== null && (
                        <span>
                          <AdjuntosDeEmbarque conteo={adjuntos[s.id]} />
                        </span>
                      )}
                      <span
                        style={{
                          font: "500 11px/1 var(--f-sans)",
                          color: "var(--ink-soft)",
                        }}
                      >
                        {formatDate(s.created_at)}
                      </span>
                      <span className="studio-fila-abrir">
                        Abrir
                        {Icon.chevR(12)}
                      </span>
                      </button>
                      {/* SDD-0522 · BTN-01 §6: el motivo de una casilla
                          deshabilitada se ve, no depende de enfocarla. */}
                      {motivo !== null && (
                        <div
                          style={{
                            gridColumn: "2 / -1",
                            margin: "var(--s-1) 0 0",
                            display: "flex",
                            alignItems: "baseline",
                            gap: "var(--s-2)",
                            flexWrap: "wrap",
                          }}
                        >
                          <p
                            id={motivoId}
                            style={{
                              margin: 0,
                              font: "500 11.5px/1.4 var(--f-sans)",
                              color: "var(--ink-soft)",
                            }}
                          >
                            {motivo}
                          </p>
                          {/* SDD-0560: el motivo no deja a Sam trabado; el
                              asistente le dice qué hacer y en qué orden. */}
                          {seleccionable?.guiable(s.id) && (
                            <button
                              type="button"
                              className="studio-btn studio-btn-ghost studio-btn-sm"
                              aria-label={`Ver los pasos para eliminar ${s.code}`}
                              onClick={() => seleccionable.onGuiar(s.id, s.code)}
                            >
                              Ver los pasos
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * SDD-0522 · Elige o suelta, de una vez, los embarques del cliente que se
 * pueden eliminar. Los bloqueados no entran nunca.
 */
function CasillaDeGrupo({
  clientName,
  ids,
  seleccionable,
}: {
  clientName: string;
  ids: string[];
  seleccionable: Seleccionable;
}) {
  const todos = ids.length > 0 && ids.every((id) => seleccionable.seleccion.has(id));
  const alguno = ids.some((id) => seleccionable.seleccion.has(id));
  return (
    <input
      type="checkbox"
      aria-label={`Seleccionar los embarques de ${clientName} que se pueden eliminar`}
      checked={todos}
      disabled={ids.length === 0}
      ref={(el) => {
        if (el) el.indeterminate = alguno && !todos;
      }}
      onChange={() => seleccionable.onToggleGrupo(ids)}
      style={{
        accentColor: "var(--wine)",
        cursor: ids.length === 0 ? "not-allowed" : "pointer",
        width: 16,
        height: 16,
        margin: 0,
      }}
    />
  );
}

// ── ProgressBar ────────────────────────────────────────────────
// Mini barra horizontal con % numérico debajo. Color del fill por status,
// pero usando TOKENS CSS (no hex literal) para que respete dark mode.
// El mapa STATUS_COLORS del shipment-types.ts no se puede usar acá porque
// consumers como StatusBadge concatenan alpha (`${color}1F`) que requiere
// hex literal. Acá hacemos un mapa local equivalente con `var(--*)`.

const PROGRESS_FILL_TOKEN: Record<ShipmentStatus, string> = {
  draft: "var(--neutral)",
  in_warehouse: "var(--ink)",
  consolidating: "var(--ink)",
  shipped: "var(--ink)",
  in_transit: "var(--ink)",
  in_customs: "var(--warning)",
  arrived_destination: "var(--ink)",
  delayed_warehouse: "var(--warning)",
  out_for_delivery: "var(--ink)",
  last_mile: "var(--ink)",
  delivered: "var(--success)",
  exception: "var(--danger)",
  cancelled: "var(--neutral)",
};

function ProgressBar({
  pct,
  status,
}: {
  pct: number;
  status: ShipmentStatus;
}) {
  const fillColor = PROGRESS_FILL_TOKEN[status];
  const safePct = Math.max(0, Math.min(100, pct));
  return (
    <span style={{ display: "block", minWidth: 0 }}>
      <span
        style={{
          display: "block",
          height: 6,
          background: "var(--bg-elevated)",
          borderRadius: "var(--r-pill)",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            display: "block",
            width: `${safePct}%`,
            height: "100%",
            background: fillColor,
            transition: "width var(--dur) var(--ease)",
          }}
        />
      </span>
      <span
        style={{
          display: "block",
          font: "600 10.5px/1 var(--f-mono)",
          color: "var(--ink-soft)",
          marginTop: "var(--s-1)",
        }}
      >
        {safePct}%
      </span>
    </span>
  );
}

/** Celda «Adjuntos» de un embarque. Sin entrada cuenta como cero (ver `pasaFiltroAdjuntos`). */
function AdjuntosDeEmbarque({ conteo }: { conteo: ConteoEmbarque | undefined }) {
  const c = conteo ?? { internos: 0, portal: 0, total: 0 };
  return <AdjuntosConteo total={c.total} desglose={desgloseEmbarque(c)} />;
}
