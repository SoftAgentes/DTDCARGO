"use client";

/**
 * EmbarquesClient — vista comercial agrupada por cliente (SDD-0012).
 *
 * - SDD-0643: empieza por contenedores («DDP 64», «FCL 63», «Sin
 *   contenedor»); dentro de cada uno, el acordeón por cliente de siempre.
 *   Filtros «Contenedor» (número DTD o ISO) y «Cliente» (nombre o Shipping
 *   Mark). Si no se pudieron leer los contenedores, se dice y se agrupa sólo
 *   por cliente.
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
 * - SDD-0661 (diseño elegido por Sam, «Franja + Excel»): la cabecera cerrada
 *   dice clientes, envíos, cajas y m³. Al abrir el contenedor, una franja de
 *   totales (clientes, cajas, cajas recibidas, CBM) y el detalle por cliente
 *   como en el Excel, con la fila «Total del contenedor». El dinero sólo se
 *   pinta si la página lo pasó: lo lee sólo para quien ve Facturación, así que
 *   aquí no se decide permiso.
 * - SDD-0690 (versión B de Sam): el dinero es «Total del embarque» / «Pagado» /
 *   «Saldo», con «Sin facturar» (las pre-órdenes) como desglose del total. El
 *   total en color lleva a la factura o a la pre-orden en Facturación.
 */

import { formatCbm } from "@/lib/shared/cbm";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import {
  contarPorPestana,
  filtrarPorPestana,
  groupShipmentsByClient,
  PESTANA_POR_DEFECTO,
  type PestanaEmbarques,
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
import { FacturarContenedor, type PreordenDeCliente } from "./FacturarContenedor";
import type { FacturacionExc0674 } from "@/lib/studio/exc0674";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import {
  agruparPorContenedor,
  clienteCoincide,
  contenedorCoincide,
  contenedorFacturado,
  formatFecha,
  type ClienteDeContenedor,
  type ContenedoresDeEmbarques,
  type GrupoContenedor,
  documentoDeEnlace,
  saldoUsd,
  sumarMontos,
  type MontoAcumulado,
  type MontosDeContenedores,
} from "@/lib/studio/embarques-contenedores";
import { fmtUsd } from "@/lib/money";
import { CONTAINER_STATUS, type ContainerStatus } from "@/lib/studio/naviera/types";

/** Sin datos de contenedores (p. ej., en pruebas): todo va a «Sin contenedor». */
const SIN_CONTENEDORES: ContenedoresDeEmbarques = { contenedores: [], porEmbarque: {} };

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

// SDD-0682 §2.5: las pestañas y su regla viven en `shipment-queries.ts`.
type Tab = PestanaEmbarques;
type ServiceFilter = ShipmentService | "all";

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
  contenedores = SIN_CONTENEDORES,
  montos,
  facturacion,
  tope,
  pestanaInicial = PESTANA_POR_DEFECTO,
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
  /**
   * SDD-0643: en qué contenedor va cada embarque. `null` = no se pudo leer:
   * se dice y la lista se agrupa sólo por cliente, como antes.
   */
  contenedores?: ContenedoresDeEmbarques | null;
  /**
   * SDD-0661: monto a cobrar por contenedor. Sólo llega si quien mira ve
   * Facturación (lo decide la página en el servidor); `undefined` = no se pinta.
   */
  montos?: MontosDeContenedores;
  /**
   * SDD-0674 · EXC-0674: qué contenedores se facturan desde aquí y qué ya se facturó. Sólo llega
   * para accounting y admin (lo decide la página en el servidor).
   */
  facturacion?: FacturacionExc0674;
  /** SDD-0643: si la lista llegó al tope de lectura, cuál es (se avisa). */
  tope?: number;
  /** SDD-0682 §2.5: pestaña con la que abre. La pantalla real abre en «Activos». */
  pestanaInicial?: Tab;
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

  const [tab, setTab] = useState<Tab>(pestanaInicial);
  const [q, setQ] = useState("");
  const [qContenedor, setQContenedor] = useState("");
  const [qCliente, setQCliente] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all");
  const [filtroAdjuntos, setFiltroAdjuntos] = useState<FiltroAdjuntos>("todos");
  const [drawerShipmentId, setDrawerShipmentId] = useState<string | null>(null);

  // Counts globales para los tabs (sin search aplicado)
  const tabCounts = useMemo(() => contarPorPestana(shipments), [shipments]);

  const contenedorPorId = useMemo(
    () => new Map((contenedores?.contenedores ?? []).map((c) => [c.id, c])),
    [contenedores],
  );

  // Apply tab + service + search → filas
  const filtradas = useMemo(() => {
    let rows = filtrarPorPestana(shipments, tab);

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

    // SDD-0643: cliente por nombre o Shipping Mark; contenedor por número DTD o ISO.
    if (qCliente.trim()) {
      rows = rows.filter((r) => clienteCoincide(r, qCliente));
    }
    if (qContenedor.trim() && contenedores) {
      rows = rows.filter((r) => {
        const cid = contenedores.porEmbarque[r.id];
        return contenedorCoincide(cid ? contenedorPorId.get(cid) ?? null : null, qContenedor);
      });
    }
    return rows;
  }, [shipments, tab, serviceFilter, q, qCliente, qContenedor, filtroAdjuntos, adjuntos, contenedores, contenedorPorId]);

  // SDD-0643: nivel 1. `null` = sin datos de contenedores: sólo por cliente.
  // El rótulo DDP/FCL sale de `shipments` sin filtrar (revisión M1).
  const grupos = useMemo<GrupoContenedor[] | null>(
    () => (contenedores ? agruparPorContenedor(filtradas, contenedores, shipments) : null),
    [filtradas, contenedores, shipments],
  );
  const groupedFiltered = useMemo(
    () => (grupos ? grupos.flatMap((g) => g.clientes) : groupShipmentsByClient(filtradas)),
    [grupos, filtradas],
  );
  const hayFiltroTexto = Boolean(q.trim() || qCliente.trim() || qContenedor.trim());

  // Default expand: si <3 grupos, todos abiertos; sino, todos cerrados.
  // SDD-0643: se cuenta por contenedor; con un filtro de texto, hasta 5.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set<string>());

  const allExpanded =
    expanded.size === groupedFiltered.length &&
    (grupos === null || abiertos.size === grupos.length);
  const defaultExpandKey = useMemo(() => {
    if (!grupos) {
      return groupedFiltered.length < 3
        ? new Set(groupedFiltered.map((g) => g.groupKey))
        : new Set<string>();
    }
    const porDefecto = new Set<string>();
    for (const g of grupos) {
      if (g.clientes.length < 3 || (hayFiltroTexto && g.clientes.length <= 5)) {
        for (const c of g.clientes) porDefecto.add(c.groupKey);
      }
    }
    return porDefecto;
  }, [grupos, groupedFiltered, hayFiltroTexto]);
  // Un solo contenedor, o un filtro de texto, los abre; si son varios, cerrados.
  const defaultAbiertos = useMemo(
    () =>
      new Set<string>(
        grupos && (grupos.length === 1 || hayFiltroTexto) ? grupos.map((g) => g.key) : [],
      ),
    [grupos, hayFiltroTexto],
  );

  // Si el set de grupos cambia (filtros o tab), aplicar defaults una vez
  const groupsKey =
    (grupos ? grupos.map((g) => g.key).join(",") + "#" : "") +
    groupedFiltered.map((g) => g.groupKey).join("|");
  const [lastGroupsKey, setLastGroupsKey] = useState("");
  if (groupsKey !== lastGroupsKey) {
    setExpanded(defaultExpandKey);
    setAbiertos(defaultAbiertos);
    setLastGroupsKey(groupsKey);
  }

  const toggleContenedor = (key: string) => {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /**
   * SDD-0689: clic en un cliente del detalle. Con un solo embarque abre su ficha
   * (el panel con «Editar»); con varios abre su bloque de embarques y lo trae a la vista.
   */
  const abrirCliente = (c: ClienteDeContenedor) => {
    if (c.shipments.length === 1) {
      setDrawerShipmentId(c.shipments[0].id);
      return;
    }
    setExpanded((prev) => new Set(prev).add(c.groupKey));
    requestAnimationFrame(() => {
      const bloque = document.getElementById(idDeCliente(c.groupKey));
      bloque?.scrollIntoView({ behavior: "smooth", block: "start" });
      bloque?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    });
  };

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
    if (grupos) setAbiertos(new Set(grupos.map((g) => g.key)));
  };
  const collapseAll = () => {
    setExpanded(new Set());
    setAbiertos(new Set());
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
          Primero el contenedor, después el cliente y después sus embarques.
          Para cambiar estado, editar campos o cancelar, abre el detalle e
          ingresa al Tracking.
        </p>
      </div>

      {/* Tabs */}
      <div
        role="group"
        aria-label="Embarques por estado"
        className="studio-tabs"
        style={{ marginBottom: "var(--s-4)" }}
      >
        {(
          [
            { value: "active", label: "Activos", count: tabCounts.active },
            { value: "camino", label: "En camino", count: tabCounts.camino },
            { value: "delivered", label: "Entregados", count: tabCounts.delivered },
            { value: "alerts", label: "Con alertas", count: tabCounts.alerts },
            { value: "all", label: "Todos", count: tabCounts.all },
          ] as { value: Tab; label: string; count: number }[]
        ).map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              aria-pressed={active}
              data-activa={active ? "true" : undefined}
              onClick={() => setTab(t.value)}
              className="studio-tab"
            >
              <span>{t.label}</span>
              <span className="studio-tab-n">{t.count}</span>
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
        {contenedores && (
          <div
            className="emb-toolbar-cont"
            // 25 caracteres de 14 px monoespaciado (~8,7 px c/u) + 26 px de
            // padding y borde ≈ 243 px: el texto de ejemplo cabe entero.
            style={{ flex: "0 1 260px", minWidth: 250 }}
          >
            <label className="studio-label" htmlFor="emb-cont">
              Contenedor
            </label>
            <input
              id="emb-cont"
              type="search"
              className="studio-input studio-input-mono"
              placeholder="Nº DTD (1-4 cifras) o ISO"
              value={qContenedor}
              onChange={(e) => setQContenedor(e.target.value)}
            />
          </div>
        )}
        <div
          className="emb-toolbar-cli"
          style={{ flex: "1 1 220px", minWidth: 200 }}
        >
          <label className="studio-label" htmlFor="emb-cli">
            Cliente
          </label>
          <input
            id="emb-cli"
            type="search"
            className="studio-input"
            placeholder="Nombre o Shipping Mark"
            value={qCliente}
            onChange={(e) => setQCliente(e.target.value)}
          />
        </div>
        <div
          className="emb-toolbar-search"
          style={{ flex: "1 1 220px", minWidth: 200 }}
        >
          <label className="studio-label" htmlFor="emb-q">
            Buscar
          </label>
          <input
            id="emb-q"
            type="search"
            className="studio-input"
            placeholder="Código, ruta…"
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
          .emb-toolbar-cont,
          .emb-toolbar-cli,
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

      {/* SDD-0643: sin contenedores no se inventa un «Sin contenedor». */}
      {contenedores === null && (
        <div style={{ marginBottom: "var(--s-3)" }}>
          <Aviso tono="atencion" compacto>
            No se pudieron leer los contenedores. La lista se agrupa sólo por cliente.
          </Aviso>
        </div>
      )}
      {tope !== undefined && (
        <div style={{ marginBottom: "var(--s-3)" }}>
          <Aviso tono="info" compacto>
            Se muestran los {tope} embarques más recientes. Los anteriores no entran en esta vista.
          </Aviso>
        </div>
      )}

      {/* Tabla agrupada o empty */}
      {groupedFiltered.length === 0 ? (
        <EmptyState
          eyebrow={
            hayFiltroTexto || filtroAdjuntos !== "todos"
              ? "Sin resultados"
              : tab === "all"
                ? "Catálogo vacío"
                : "Sin envíos en este tab"
          }
          title={
            hayFiltroTexto
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
                    : tab === "camino"
                      ? "Ningún envío va en el mar ahora."
                      : "Sin envíos activos en origen ni en destino."
          }
          description={
            hayFiltroTexto
              ? "Prueba ajustar los términos de búsqueda."
              : filtroAdjuntos !== "todos"
                ? "Cambia el filtro «Adjuntos» a «Todos» para ver el resto."
              : "Crea envíos desde Estimados (convertir estimado aceptado) o desde /tracking/nuevo."
          }
        />
      ) : grupos ? (
        <ListaDeContenedores
          grupos={grupos}
          abiertos={abiertos}
          toggleContenedor={toggleContenedor}
          montos={montos}
          facturacion={facturacion}
          onAbrirCliente={abrirCliente}
          renderClientes={(g) => (
            <GroupedTable
              groups={g.clientes}
              expanded={expanded}
              toggleGroup={toggleGroup}
              onRowClick={(id) => setDrawerShipmentId(id)}
              adjuntos={adjuntos ?? null}
              seleccionable={seleccionable}
            />
          )}
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

/**
 * SDD-0643 · Nivel 1: un acordeón por contenedor. La cabecera dice el nombre
 * («DDP 64», «FCL 63»), el número ISO, la naviera, la ETA, el estado y
 * los conteos; el cuerpo es el acordeón por cliente (nivel 2) con sus
 * embarques (nivel 3).
 */
function ListaDeContenedores({
  grupos,
  abiertos,
  toggleContenedor,
  montos,
  facturacion,
  onAbrirCliente,
  renderClientes,
}: {
  grupos: GrupoContenedor[];
  abiertos: Set<string>;
  toggleContenedor: (key: string) => void;
  montos?: MontosDeContenedores;
  facturacion?: FacturacionExc0674;
  onAbrirCliente: (c: ClienteDeContenedor) => void;
  renderClientes: (g: GrupoContenedor) => ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
      {grupos.map((g) => {
        const abierto = abiertos.has(g.key);
        const c = g.contenedor;
        const estado = c ? CONTAINER_STATUS[c.status as ContainerStatus] : undefined;
        const cuerpoId = `emb-cont-${g.key}`;
        const nClientes = g.clientes.length;
        // SDD-0689: el dinero del encabezado solo llega a quien ve Facturación (la página decide).
        // Peso y dinero se suman sobre el contenedor entero, no sobre lo que dejó pasar la pestaña.
        const dinero =
          montos?.estado === "lista" ? sumarMontos(g.completo.envios, montos.porEmbarque) : null;
        // SDD-0690 §3.5: «Facturado» = todos los clientes del contenedor entero con factura emitida viva.
        const facturado =
          !!c && montos?.estado === "lista" && contenedorFacturado(g, montos.porEmbarque);
        return (
          <section
            key={g.key}
            aria-label={g.nombre}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: abierto ? "var(--bg-elevated)" : undefined,
              }}
            >
            <button
              type="button"
              aria-expanded={abierto}
              aria-controls={abierto ? cuerpoId : undefined}
              onClick={() => toggleContenedor(g.key)}
              className="emb-cont-header"
              style={{
                flex: 1,
                minWidth: 0,
                width: "100%",
                display: "grid",
                gridTemplateColumns: "24px minmax(0, 1fr) auto",
                gap: "var(--s-3)",
                padding: "var(--s-4) var(--s-5)",
                background: abierto ? "var(--bg-elevated)" : undefined,
                border: 0,
                textAlign: "left",
                cursor: "pointer",
                alignItems: "center",
                color: "inherit",
                transition: "background var(--dur-fast) var(--ease)",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  color: "var(--ink-soft)",
                  transform: abierto ? "rotate(90deg)" : "none",
                  transition: "transform var(--dur-fast) var(--ease)",
                }}
              >
                {Icon.chevR(16)}
              </span>
              <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ font: "800 16px/1.2 var(--f-sans)", color: "var(--ink)" }}>
                    {g.nombre}
                  </span>
                  {c?.containerNo && (
                    <span
                      style={{
                        font: "700 12px/1 var(--f-mono)",
                        color: "var(--ink)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {c.containerNo}
                    </span>
                  )}
                  {estado && (
                    <Badge tone={estado.tone} size="sm">
                      {estado.label}
                    </Badge>
                  )}
                </span>
                {c ? (
                  <span
                    style={{
                      font: "500 12px/1.3 var(--f-sans)",
                      color: "var(--ink-soft)",
                      display: "flex",
                      gap: "var(--s-3)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span>{c.naviera ?? "Sin naviera"}</span>
                    <span>ETA {c.eta ? formatFecha(c.eta) : "sin fecha"}</span>
                    <span style={{ font: "500 11.5px/1.3 var(--f-mono)" }}>{c.ref}</span>
                  </span>
                ) : (
                  <span style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
                    Embarques que no van en ningún contenedor.
                  </span>
                )}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  gap: "var(--s-2)",
                  alignItems: "center",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                {facturado && (
                  <span data-testid="encabezado-facturado">
                    <Badge tone="success" size="sm">
                      Facturado
                    </Badge>
                  </span>
                )}
                {g.alertas > 0 && (
                  <Badge tone="danger" size="sm">
                    {g.alertas} alerta{g.alertas === 1 ? "" : "s"}
                  </Badge>
                )}
                <Badge tone="neutral" size="sm">
                  {nClientes} {nClientes === 1 ? "cliente" : "clientes"}
                </Badge>
                <Badge tone="neutral" size="sm">
                  {g.embarques} {g.embarques === 1 ? "envío" : "envíos"}
                </Badge>
                {g.cajas != null && (
                  <Badge tone="neutral" size="sm">
                    {textoCajas(g.cajas)}
                  </Badge>
                )}
                {c && (
                  <Badge tone="neutral" size="sm">
                    {g.completo.enviosSinPeso === g.completo.envios.length
                      ? "Sin peso"
                      : textoPeso(g.completo.pesoKg)}
                  </Badge>
                )}
                <span
                  style={{
                    font: "600 11.5px/1 var(--f-mono)",
                    color: "var(--ink-soft)",
                    minWidth: 80,
                    textAlign: "right",
                  }}
                >
                  {formatCbm(g.totalCbm)} m³
                </span>
              </span>
            </button>
            {c && dinero && (
              <MontoOculto
                texto={dinero.sinFacturarUsd > 0 ? fmtUsd(dinero.sinFacturarUsd) : null}
                sinMonto={textoSinMonto(dinero, facturado)}
                contenedor={g.nombre}
              />
            )}
            </div>
            {abierto && (
              <div
                id={cuerpoId}
                style={{
                  padding: "var(--s-3)",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--s-3)",
                }}
              >
                {c && (
                  <>
                    <FranjaDeTotales grupo={g} montos={montos} />
                    <DetallePorCliente grupo={g} montos={montos} onAbrirCliente={onAbrirCliente} />
                    {facturacion?.estado === "lista" && facturacion.contenedores.includes(c.id) && (
                      <FacturarContenedor
                        grupo={g}
                        facturados={facturacion.facturados[c.id] ?? {}}
                        preordenes={preordenesDeGrupo(g, montos)}
                      />
                    )}
                  </>
                )}
                {renderClientes(g)}
              </div>
            )}
          </section>
        );
      })}
      <style>{`
        .emb-cont-header { background: transparent; }
        .emb-cont-header:hover { background: var(--bg-elevated); }
        .emb-cliente-link { all: unset; cursor: pointer; border-radius: var(--r-sm); }
        .emb-doc-link { color: var(--accion-text); font-weight: 700; text-decoration: none; border-radius: var(--r-sm); }
        .emb-doc-link:hover { text-decoration: underline; }
        .emb-doc-link:focus-visible { outline: 2px solid var(--accion); outline-offset: 2px; }
        .emb-cliente-link:hover { text-decoration: underline; }
        .emb-ojo:hover { background: var(--bg-elevated) !important; }
        .emb-ojo:focus-visible { outline: 2px solid var(--accion); outline-offset: 2px; }
        .emb-cliente-link:focus-visible { outline: 2px solid var(--accion); outline-offset: 2px; }
        /* La tarjeta recorta lo que sale (overflow hidden): el foco va adentro. */
        .emb-cont-header:focus-visible { outline-offset: -3px; }
        @media (max-width: 640px) {
          .emb-cont-header {
            grid-template-columns: 24px minmax(0, 1fr) !important;
          }
          .emb-cont-header > :nth-child(3) {
            grid-column: 2;
            justify-content: flex-start !important;
          }
        }
      `}</style>
    </div>
  );
}

/** SDD-0689: cuánto se muestra el monto al oprimir el ojo. */
export const SEGUNDOS_MONTO_VISIBLE = 4;

/**
 * SDD-0689 → SDD-0690: qué dice el encabezado cuando no hay monto en USD que ocultar.
 *  - sin facturas: «Sin precios cargados»;
 *  - todos los clientes del contenedor con factura emitida viva (§3.5): «Facturado»;
 *  - sin pre-órdenes pero con algún cliente sin precio: «Clientes sin precio»;
 *  - con pre-órdenes que no suman en USD (otra moneda): «Sin monto en USD». Nunca «$0.00».
 */
function textoSinMonto(
  m: { facturas: number; borradores: number; otraMoneda: number },
  facturado: boolean,
): string {
  if (m.facturas === 0) return "Sin precios cargados";
  if (facturado) return "Facturado";
  if (m.borradores === 0) return "Clientes sin precio";
  // SDD-0690: pre-órdenes en USD que suman $0 no son «otra moneda».
  return m.otraMoneda > 0 ? "Sin monto en USD" : "Pre-orden sin monto";
}

/**
 * SDD-0690 · La pre-orden pendiente de cada cliente del contenedor ENTERO (sin filtro), por Shipping
 * Mark en MAYÚSCULAS, para «Facturar». Una pre-orden en $0 o en otra moneda también viaja (con
 * `totalUsd` null o 0): ese cliente no va al camino tecleado, se corrige en Facturación. Sale de los
 * mismos `montos` que decide la página: sin ellos, nada.
 */
function preordenesDeGrupo(
  g: GrupoContenedor,
  montos: MontosDeContenedores | undefined,
): Record<string, PreordenDeCliente> {
  const out: Record<string, PreordenDeCliente> = {};
  if (montos?.estado !== "lista") return out;
  for (const cl of g.completo.clientes) {
    const mb = (cl.clientMarkbox ?? "").trim().toUpperCase();
    if (!mb) continue;
    const pres = sumarMontos(cl.shipments, montos.porEmbarque).documentos.filter((d) => d.preorden);
    // La válida primero; si no hay, la inválida, para avisar en vez de ofrecer teclear.
    const po = pres.find((d) => d.totalUsd != null && d.totalUsd > 0) ?? pres[0];
    if (po) out[mb] = { invoiceId: po.invoiceId, invoiceCode: po.invoiceCode, totalUsd: po.totalUsd };
  }
  return out;
}

/**
 * SDD-0689 · «Total sin facturar» del encabezado, oculto por privacidad: la pantalla queda abierta en la
 * PC de la oficina (Sam, 2026-11-20: «la opción del ojito como lo hace QuickBooks»). El ojo lo muestra
 * {@link SEGUNDOS_MONTO_VISIBLE} segundos y vuelve a ocultarlo. Adentro, en la franja del contenedor, los
 * montos se ven completos. `texto` null = no hay monto en USD sin facturar: se muestra `sinMonto`.
 */
function MontoOculto({
  texto,
  sinMonto,
  contenedor,
}: {
  texto: string | null;
  sinMonto: string;
  contenedor: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), SEGUNDOS_MONTO_VISIBLE * 1000);
    return () => clearTimeout(t);
  }, [visible]);
  return (
    <span
      data-testid="total-sin-facturar"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--s-2)",
        paddingRight: "var(--s-5)",
        font: "600 11.5px/1 var(--f-mono)",
        color: "var(--ink-soft)",
        whiteSpace: "nowrap",
      }}
    >
      {texto == null ? (
        sinMonto
      ) : (
        <>
          Sin facturar
          <span aria-live="polite" style={{ minWidth: 88, textAlign: "right" }}>
            {visible ? texto : <span aria-hidden="true">••••••</span>}
          </span>
          <button
            type="button"
            className="emb-ojo"
            aria-pressed={visible}
            aria-label={`Mostrar u ocultar el total sin facturar de ${contenedor} (se oculta solo a los ${SEGUNDOS_MONTO_VISIBLE} segundos)`}
            onClick={() => setVisible((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              padding: 0,
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              background: "var(--bg-surface)",
              color: "var(--ink-soft)",
              cursor: "pointer",
            }}
          >
            {visible ? Icon.eyeOff(16) : Icon.eye(16)}
          </button>
        </>
      )}
    </span>
  );
}

/** SDD-0689: id del bloque de embarques de un cliente, para llevarlo a la vista. */
function idDeCliente(groupKey: string): string {
  return `emb-cli-${groupKey}`;
}

/** SDD-0661: «1 caja» · «1.234 cajas». */
function textoCajas(n: number): string {
  return `${n.toLocaleString("es-VE")} ${n === 1 ? "caja" : "cajas"}`;
}

/** SDD-0661: cajas recibidas; sin recepción, «Sin recepción» (decisión de Sam: nunca 0). */
function textoRecibidas(n: number | null): string {
  return n == null ? "Sin recepción" : n.toLocaleString("es-VE");
}

/** SDD-0665: «1.234,5 kg». */
function textoPeso(kg: number): string {
  return `${kg.toLocaleString("es-VE", { maximumFractionDigits: 2 })} kg`;
}

/** SDD-0665: el peso de un cliente; si ninguno de sus envíos lo tiene, «Sin peso» (no 0). */
function textoPesoCliente(c: ClienteDeContenedor): string {
  return c.enviosSinPeso === c.shipments.length ? "Sin peso" : textoPeso(c.stats.totalWeight);
}

/**
 * SDD-0690 · Versión B de Sam (2026-11-20): Total del embarque / Pagado / Saldo. Sin facturas ni
 * pre-órdenes no hay precio cargado: «Sin precio», nunca $0.00 inventado.
 */
type CampoDinero = "total" | "pagado" | "saldo";

function textoMonto(m: MontoAcumulado, campo: CampoDinero): string {
  if (m.facturas === 0) return "Sin precio";
  if (campo === "total") return fmtUsd(m.totalUsd);
  if (campo === "pagado") return fmtUsd(m.pagadoUsd);
  return fmtUsd(saldoUsd(m));
}

/**
 * SDD-0690 · El total en color lleva a su documento en Facturación: la factura si ya está emitida; si
 * no, la pre-orden. Ahí se edita, con el RBAC de Facturación.
 */
function MontoConEnlace({ m }: { m: MontoAcumulado }) {
  const doc = documentoDeEnlace(m);
  const texto = textoMonto(m, "total");
  if (!doc || m.facturas === 0) return <>{texto}</>;
  const que = doc.preorden ? "la pre-orden" : "la factura";
  return (
    <Link
      href={`/studio/facturacion/${encodeURIComponent(doc.invoiceCode)}`}
      className="emb-doc-link"
      title={`Abrir ${que} ${doc.invoiceCode} en Facturación`}
    >
      {texto}
    </Link>
  );
}

/** SDD-0661: franja de totales al abrir el contenedor. */
function FranjaDeTotales({
  grupo,
  montos,
}: {
  grupo: GrupoContenedor;
  montos?: MontosDeContenedores;
}) {
  // SDD-0690: dinero y peso del contenedor entero, como el encabezado (no lo filtrado por la vista).
  const total =
    montos?.estado === "lista" ? sumarMontos(grupo.completo.envios, montos.porEmbarque) : null;
  const fichas: { etiqueta: string; valor: string; dinero?: boolean; detalle?: string }[] = [
    { etiqueta: "Clientes", valor: grupo.clientes.length.toLocaleString("es-VE") },
    { etiqueta: "Cajas", valor: (grupo.cajas ?? 0).toLocaleString("es-VE") },
    { etiqueta: "Cajas recibidas", valor: textoRecibidas(grupo.recibidas) },
    { etiqueta: "CBM total", valor: `${formatCbm(grupo.totalCbm)} m³` },
    {
      etiqueta: "Peso total",
      valor:
        grupo.completo.enviosSinPeso === grupo.completo.envios.length
          ? "Sin peso"
          : textoPeso(grupo.completo.pesoKg),
    },
  ];
  if (montos) {
    const nd = "No disponible";
    fichas.push(
      {
        etiqueta: "Total del embarque",
        valor: total ? textoMonto(total, "total") : nd,
        dinero: true,
        // «Sin facturar» = las pre-órdenes, como desglose del total.
        detalle:
          total && total.borradores > 0 ? `Sin facturar ${fmtUsd(total.sinFacturarUsd)}` : undefined,
      },
      { etiqueta: "Pagado", valor: total ? textoMonto(total, "pagado") : nd, dinero: true },
      { etiqueta: "Saldo", valor: total ? textoMonto(total, "saldo") : nd, dinero: true },
    );
  }
  return (
    <div>
      <dl
        aria-label={`Totales de ${grupo.nombre}`}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "var(--s-2)",
          margin: 0,
        }}
      >
        {fichas.map((f) => (
          <div
            key={f.etiqueta}
            style={{
              background: f.dinero ? "var(--warning-bg)" : "var(--bg-elevated)",
              borderRadius: "var(--r-md)",
              padding: "var(--s-3)",
              minWidth: 0,
            }}
          >
            <dt style={{ font: "600 12px/1.2 var(--f-sans)", color: "var(--ink-soft)" }}>
              {f.etiqueta}
            </dt>
            <dd
              style={{
                margin: "var(--s-1) 0 0",
                font: "800 18px/1.2 var(--f-sans)",
                color: "var(--ink)",
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
              }}
            >
              {f.valor}
            </dd>
            {f.detalle && (
              <dd
                style={{
                  margin: "var(--s-1) 0 0",
                  font: "600 12px/1.2 var(--f-mono)",
                  color: "var(--ink-soft)",
                  whiteSpace: "nowrap",
                }}
              >
                {f.detalle}
              </dd>
            )}
          </div>
        ))}
      </dl>
      {grupo.completo.enviosSinPeso > 0 &&
        grupo.completo.enviosSinPeso < grupo.completo.envios.length && (
        <p
          style={{
            margin: "var(--s-2) 0 0",
            font: "500 12px/1.3 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          {grupo.completo.enviosSinPeso} {grupo.completo.enviosSinPeso === 1 ? "envío" : "envíos"} sin
          peso cargado: el peso total no los incluye.
        </p>
      )}
      {total && total.otraMoneda > 0 && (
        <p
          style={{
            margin: "var(--s-2) 0 0",
            font: "500 12px/1.3 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          {total.otraMoneda} {total.otraMoneda === 1 ? "factura está" : "facturas están"} en otra
          moneda y no se suman.
        </p>
      )}
    </div>
  );
}

const TH_DETALLE = {
  font: "700 11px/1 var(--f-sans)",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "var(--ink-soft)",
  textAlign: "right" as const,
  padding: "var(--s-2)",
  whiteSpace: "nowrap" as const,
};

const TD_DETALLE = {
  font: "500 13px/1.3 var(--f-mono)",
  color: "var(--ink)",
  textAlign: "right" as const,
  padding: "var(--s-2)",
  borderTop: "1px solid var(--border)",
  whiteSpace: "nowrap" as const,
};

const PIE_DETALLE = { ...TD_DETALLE, fontWeight: 700, borderTop: "2px solid var(--ink-soft)" };

/** SDD-0661: el detalle por cliente como en el Excel, con la fila de total. */
function DetallePorCliente({
  grupo,
  montos,
  onAbrirCliente,
}: {
  grupo: GrupoContenedor;
  montos?: MontosDeContenedores;
  onAbrirCliente: (c: ClienteDeContenedor) => void;
}) {
  const lista = montos?.estado === "lista" ? montos.porEmbarque : null;
  const celdaDinero = (filas: readonly ShipmentListRow[], campo: CampoDinero) => {
    if (!lista) return "—";
    const m = sumarMontos(filas, lista);
    return campo === "total" ? <MontoConEnlace m={m} /> : textoMonto(m, campo);
  };
  // SDD-0690: la fila «Total del contenedor» suma el contenedor entero en peso y dinero.
  const todas = grupo.completo.envios;
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontVariantNumeric: "tabular-nums",
          minWidth: montos ? 820 : 520,
        }}
      >
        <caption
          style={{
            textAlign: "left",
            font: "700 12px/1.2 var(--f-sans)",
            color: "var(--ink-soft)",
            padding: "0 var(--s-2) var(--s-1)",
          }}
        >
          Detalle por cliente
        </caption>
        <thead>
          <tr>
            <th scope="col" style={{ ...TH_DETALLE, textAlign: "left" }}>
              Cliente
            </th>
            <th scope="col" style={TH_DETALLE}>
              Envíos
            </th>
            <th scope="col" style={TH_DETALLE}>
              Cajas
            </th>
            <th scope="col" style={TH_DETALLE}>
              Recibidas
            </th>
            <th scope="col" style={TH_DETALLE}>
              m³
            </th>
            <th scope="col" style={TH_DETALLE}>
              kg
            </th>
            {montos && (
              <>
                <th scope="col" style={TH_DETALLE}>
                  Total
                </th>
                <th scope="col" style={TH_DETALLE}>
                  Pagado
                </th>
                <th scope="col" style={TH_DETALLE}>
                  Saldo
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {grupo.clientes.map((c) => (
            <tr key={c.groupKey}>
              <th
                scope="row"
                style={{
                  ...TD_DETALLE,
                  font: "600 13px/1.3 var(--f-sans)",
                  textAlign: "left",
                  whiteSpace: "normal",
                }}
              >
                <button
                  type="button"
                  className="emb-cliente-link"
                  onClick={() => onAbrirCliente(c)}
                  title={c.shipments.length === 1 ? "Abrir la ficha del embarque" : "Ver sus embarques"}
                >
                  {c.clientName}
                  {c.clientMarkbox && (
                    <span
                      style={{
                        marginLeft: "var(--s-2)",
                        font: "700 11px/1 var(--f-mono)",
                        color: "var(--ink)",
                      }}
                    >
                      {c.clientMarkbox}
                    </span>
                  )}
                </button>
              </th>
              <td style={TD_DETALLE}>{c.stats.count.toLocaleString("es-VE")}</td>
              <td style={TD_DETALLE}>{(c.cajas ?? 0).toLocaleString("es-VE")}</td>
              <td style={TD_DETALLE}>{textoRecibidas(c.recibidas)}</td>
              <td style={TD_DETALLE}>{formatCbm(c.stats.totalCbm)}</td>
              <td style={TD_DETALLE}>{textoPesoCliente(c)}</td>
              {montos && (
                <>
                  <td style={TD_DETALLE}>{celdaDinero(c.shipments, "total")}</td>
                  <td style={TD_DETALLE}>{celdaDinero(c.shipments, "pagado")}</td>
                  <td style={TD_DETALLE}>{celdaDinero(c.shipments, "saldo")}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th
              scope="row"
              style={{ ...PIE_DETALLE, font: "700 13px/1.3 var(--f-sans)", textAlign: "left" }}
            >
              Total del contenedor
            </th>
            <td style={PIE_DETALLE}>{grupo.embarques.toLocaleString("es-VE")}</td>
            <td style={PIE_DETALLE}>{(grupo.cajas ?? 0).toLocaleString("es-VE")}</td>
            <td style={PIE_DETALLE}>{textoRecibidas(grupo.recibidas)}</td>
            <td style={PIE_DETALLE}>{formatCbm(grupo.totalCbm)}</td>
            <td style={PIE_DETALLE}>
              {grupo.completo.enviosSinPeso === grupo.completo.envios.length
                ? "Sin peso"
                : textoPeso(grupo.completo.pesoKg)}
            </td>
            {montos && (
              <>
                <td style={PIE_DETALLE}>{celdaDinero(todas, "total")}</td>
                <td style={PIE_DETALLE}>{celdaDinero(todas, "pagado")}</td>
                <td style={PIE_DETALLE}>{celdaDinero(todas, "saldo")}</td>
              </>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function GroupedTable({
  groups,
  expanded,
  toggleGroup,
  onRowClick,
  adjuntos,
  seleccionable,
}: {
  /** SDD-0661: dentro de un contenedor, cada cliente trae sus cajas. */
  groups: (ReturnType<typeof groupShipmentsByClient>[number] & Partial<Pick<ClienteDeContenedor, "cajas">>)[];
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
      ? "24px 130px minmax(160px, 1fr) 130px 130px 110px 70px 90px 92px"
      : "24px 130px minmax(160px, 1fr) 130px 130px 110px 70px 96px 90px 92px";
  // SDD-0522: la fila es [casilla | botón con los datos | «Abrir»]. El botón
  // usa las mismas columnas sin la primera ni la última, así el encabezado y
  // las filas no se desalinean (24px + gap + datos + gap + 92px).
  const columnasDatos = columnas.replace(/^24px /, "").replace(/ 92px$/, "");
  const anchoMinimo = adjuntos === null ? 926 : 1032;
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
            id={idDeCliente(group.groupKey)}
            style={{
              borderTop: gi > 0 ? "1px solid var(--border)" : 0,
              scrollMarginTop: "var(--s-5)",
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
                      color: "var(--accion-text)",
                      textDecoration: "underline", textUnderlineOffset: 3,
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
                {group.cajas != null && (
                  <Badge tone="neutral" size="sm">
                    {textoCajas(group.cajas)}
                  </Badge>
                )}
              </div>
              <span
                style={{
                  font: "600 11.5px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                  textAlign: "right",
                  minWidth: 90,
                }}
              >
                {formatCbm(group.stats.totalCbm)} m³
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
                  {/* SDD-0603: columna de «Abrir», sin rótulo propio. */}
                  <span aria-hidden="true" />
                </div>
                {group.shipments.map((s) => {
                  const pct = computeProgress(s.status);
                  const svc = SERVICE_LABELS[s.shipment_service];
                  const motivo = seleccionable ? seleccionable.motivo(s.id) : null;
                  const elegido = seleccionable?.seleccion.has(s.id) === true && motivo === null;
                  const fondo = elegido ? "color-mix(in srgb, var(--ink) 8%, transparent)" : "transparent";
                  const motivoId = `emb-motivo-${s.id}`;
                  return (
                    <div
                      key={s.id}
                      data-row-id={s.code}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "24px minmax(0, 1fr) 92px",
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
                              accentColor: "var(--accion)",
                              cursor: motivo !== null ? "not-allowed" : "pointer",
                              width: 16,
                              height: 16,
                              margin: 0,
                            }}
                          />
                        )}
                      </span>
                      {/* SDD-0603 · tramo 5a: la fila entera sigue abriendo
                          con el ratón, pero el control de teclado y de lector
                          es «Abrir». Sale del orden de Tab para que cada fila
                          siga teniendo una sola parada. */}
                      <button
                        type="button"
                        tabIndex={-1}
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
                        {formatCbm(s.volume_m3)}
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
                      </button>
                      <button
                        type="button"
                        className="studio-btn studio-btn-ghost studio-btn-sm"
                        aria-label={`Abrir embarque ${s.code}`}
                        onClick={() => onRowClick(s.id)}
                        style={{ justifySelf: "end" }}
                      >
                        Abrir
                        {Icon.chevR(14)}
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
        accentColor: "var(--accion)",
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
