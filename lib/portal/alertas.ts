/**
 * Hub "Alertas · mis envíos" del portal (Norte `PortalAlertas`) — lógica PURA.
 *
 * Unifica el ciclo de vida de una compra en UNA sola lista, tal como lo modela el
 * Norte (docs/design/studio/_norte/portal/app.jsx, `PortalAlertas`):
 *
 *   Pre-alerta (la creas tú) → Alerta (confirmada) → Envío (en camino a ti)
 *
 * Dos fuentes reales que ya existen en el repo:
 *  - PREALERTAS (SDD-0057, `prealertas`): la compra que el cliente registra. Su
 *    `status` determina si va como "Pre-alerta" (recién anunciada) o "Alerta"
 *    (ya confirmada / en camino a bodega CN).
 *  - ENVÍOS (`shipments`, `listMyShipments`): la carga ya recibida por DTD / en
 *    tránsito a Venezuela = etapa "Envío".
 *
 * Dedup: una prealerta con `shipment_id` ya "graduó" a envío → se representa por su
 * shipment (no se duplica). Las canceladas se excluyen.
 *
 * Todo acá es puro y testeable; la página server arma los datos y el componente
 * cliente pinta. Sin queries, sin DB.
 */
import type { Prealerta, PrealertaStatus } from "@/lib/studio/prealertas/types";
import { PREALERTA_STATUS } from "@/lib/studio/prealertas/types";
import type {
  PortalShipmentRow,
  ShipmentService,
  ShipmentStatus,
} from "@/lib/portal/portal-types";
import { STATUS_LABELS } from "@/lib/portal/portal-types";

export type AlertStage = "prealerta" | "alerta" | "envio";

/** Tono de badge (subset del set del sistema) por etapa. */
export type AlertStageTone = "wine" | "warning" | "info";

export const ALERT_STAGE_META: Record<
  AlertStage,
  { label: string; desc: string; tone: AlertStageTone }
> = {
  prealerta: { label: "Pre-alerta", desc: "La creas tú", tone: "wine" },
  alerta: { label: "Alerta", desc: "Confirmada", tone: "warning" },
  envio: { label: "Envío", desc: "En camino a ti", tone: "info" },
};

/** Orden del pipeline para la leyenda de 3 pasos. */
export const ALERT_STAGES: readonly AlertStage[] = [
  "prealerta",
  "alerta",
  "envio",
] as const;

/**
 * Etapa del hub para una prealerta según su `status`. `null` = no se muestra
 * (cancelada). anunciada = Pre-alerta; en_camino/recibida/consolidada = Alerta.
 */
export function prealertaStage(status: PrealertaStatus): AlertStage | null {
  switch (status) {
    case "anunciada":
      return "prealerta";
    case "en_camino":
    case "recibida":
    case "consolidada":
      return "alerta";
    case "cancelada":
      return null;
  }
}

/** Etiqueta corta de servicio para la meta de un envío. */
const SHORT_SERVICE: Record<ShipmentService, string> = {
  consolidacion: "LCL",
  puerta_a_puerta_DDP: "DDP",
  reserva_FCL: "FCL",
  transporte_terrestre: "Terrestre",
};

/** Una fila del hub (prealerta, alerta o envío) ya normalizada para la UI. */
export type AlertItem = {
  /** Clave única y estable (prefijada por origen para no colisionar). */
  key: string;
  code: string;
  stage: AlertStage;
  /** Nombre del proveedor (prealerta) u origen (envío); null si no hay. */
  title: string;
  /** Sub-línea descriptiva (cajas · estado, o servicio · estado). */
  meta: string;
  /** ISO para ordenar (created_at de la compra / updatedAt del envío). */
  sortAt: string;
  /** Id del envío para "Ver seguimiento"; null en prealertas/alertas. */
  shipmentId: string | null;
  /** Id de la prealerta para cargar sus documentos (Slice B); null en envíos. */
  prealertaId: string | null;
};

function prealertaMeta(p: Prealerta): string {
  const cajas = `${p.boxes} caja${p.boxes === 1 ? "" : "s"}`;
  const desc = p.description?.trim();
  if (p.status === "anunciada") {
    return desc ? `${cajas} · ${desc}` : `${cajas} · esperando packing del proveedor`;
  }
  const estado = PREALERTA_STATUS[p.status]?.label ?? p.status;
  return `${cajas} · ${estado}`;
}

function shipmentMeta(s: PortalShipmentRow): string {
  const svc = SHORT_SERVICE[s.service] ?? s.service;
  const estado = STATUS_LABELS[s.status as ShipmentStatus] ?? s.status;
  return `${svc} · ${estado}`;
}

/** Ciudad (parte antes de la coma) para el título de un envío. */
function cityOf(loc: string | null): string | null {
  if (!loc) return null;
  return loc.split(",")[0]?.trim() || loc;
}

/**
 * Arma la lista unificada del hub: pedidos (prealertas + alertas, primero) seguidos
 * de los envíos, cada bloque ordenado por fecha desc — igual que el Norte
 * (`[...pedidos, ...envios]`). Excluye prealertas canceladas y las que ya graduaron
 * a envío (`shipment_id` presente).
 */
export function buildAlertItems(
  prealertas: Prealerta[],
  shipments: PortalShipmentRow[],
  supplierNameById: Record<string, string>,
): AlertItem[] {
  const pedidos: AlertItem[] = [];
  for (const p of prealertas) {
    if (p.shipment_id) continue; // ya es un envío → se muestra como shipment
    const stage = prealertaStage(p.status);
    if (!stage) continue; // cancelada
    const supplier = p.supplier_id ? supplierNameById[p.supplier_id] : null;
    pedidos.push({
      key: `p:${p.id}`,
      code: p.code,
      stage,
      title: supplier ?? "Proveedor",
      meta: prealertaMeta(p),
      sortAt: p.created_at,
      shipmentId: null,
      prealertaId: p.id,
    });
  }
  pedidos.sort((a, b) => b.sortAt.localeCompare(a.sortAt));

  const envios: AlertItem[] = shipments
    .map((s) => ({
      key: `s:${s.id}`,
      code: s.code,
      stage: "envio" as const,
      title: cityOf(s.origin) ?? "Proveedor",
      meta: shipmentMeta(s),
      sortAt: s.updatedAt,
      shipmentId: s.id,
      prealertaId: null,
    }))
    .sort((a, b) => b.sortAt.localeCompare(a.sortAt));

  return [...pedidos, ...envios];
}

export type AlertCounts = Record<"todas" | AlertStage, number>;

/** Conteos por etapa para las pestañas (Todas · Pre-alertas · Alertas · Envíos). */
export function countByStage(items: AlertItem[]): AlertCounts {
  return {
    todas: items.length,
    prealerta: items.filter((i) => i.stage === "prealerta").length,
    alerta: items.filter((i) => i.stage === "alerta").length,
    envio: items.filter((i) => i.stage === "envio").length,
  };
}

/** Filtra por etapa; `"todas"` devuelve todo. */
export function filterByStage(
  items: AlertItem[],
  stage: "todas" | AlertStage,
): AlertItem[] {
  return stage === "todas" ? items : items.filter((i) => i.stage === stage);
}
