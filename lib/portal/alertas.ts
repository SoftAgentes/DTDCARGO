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
  ShipmentStatus,
} from "@/lib/portal/portal-types";
import { SERVICE_SHORT_LABELS, STATUS_LABELS } from "@/lib/portal/portal-types";

export type AlertStage =
  | "prealerta"
  | "alerta"
  | "envio"
  | "bodegave"
  | "recibido";

/** Tono de badge (subset del set del sistema) por etapa. */
export type AlertStageTone =
  | "wine"
  | "warning"
  | "info"
  | "neutral"
  | "success";

export const ALERT_STAGE_META: Record<
  AlertStage,
  { label: string; desc: string; tone: AlertStageTone }
> = {
  prealerta: { label: "Pre-alerta", desc: "La creas tú", tone: "wine" },
  alerta: { label: "Alerta", desc: "Confirmada", tone: "warning" },
  envio: { label: "Envío", desc: "En camino a ti", tone: "info" },
  // El Norte rotula esta etapa "En casa · En nuestra bodega". Acá la descripción
  // se abre a "Ya en Venezuela" porque la etapa cubre TAMBIÉN el reparto y la
  // última milla (ver `shipmentStage`): decir "en nuestra bodega" de una caja que
  // ya salió a repartir sería mentira. El estado exacto sigue visible en la fila.
  bodegave: { label: "En casa", desc: "Ya en Venezuela", tone: "neutral" },
  recibido: { label: "Recibiste", desc: "Ya en tu puerta", tone: "success" },
};

/** Orden del pipeline para la leyenda de 5 pasos (Norte `_ALERT_STAGE`). */
export const ALERT_STAGES: readonly AlertStage[] = [
  "prealerta",
  "alerta",
  "envio",
  "bodegave",
  "recibido",
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

/**
 * Etapa del hub para un ENVÍO según su `status`. `null` = no se muestra
 * (cancelado). Se apoya en el flow canónico de `lib/studio/tracking-progress.ts`
 * (`STATUS_FLOW_ORDER`):
 *
 *   in_warehouse → consolidating → shipped → in_transit → in_customs
 *     → arrived_destination → out_for_delivery → last_mile → delivered
 *
 * El corte es geográfico, que es como lo piensa el cliente:
 *  · hasta `in_customs` la carga viene en camino  → **envio**
 *  · desde `arrived_destination` ya está en el país → **bodegave**
 *    (incluye `delayed_warehouse`, que el flow canónico ubica "al mismo nivel
 *    que arrived_destination", y el reparto / última milla)
 *  · `delivered` → **recibido**
 *
 * `exception` no tiene lugar en el flow (es transversal): se queda en **envio**,
 * que es donde el cliente espera ver algo que se trabó en camino.
 */
export function shipmentStage(status: ShipmentStatus): AlertStage | null {
  switch (status) {
    case "cancelled":
      return null;
    case "delivered":
      return "recibido";
    case "arrived_destination":
    case "delayed_warehouse":
    case "out_for_delivery":
    case "last_mile":
      return "bodegave";
    case "draft":
    case "in_warehouse":
    case "consolidating":
    case "shipped":
    case "in_transit":
    case "in_customs":
    case "exception":
      return "envio";
  }
}

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
  const svc = SERVICE_SHORT_LABELS[s.service] ?? s.service;
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
    .map((s): AlertItem | null => {
      const stage = shipmentStage(s.status as ShipmentStatus);
      if (!stage) return null; // cancelado → fuera del hub, igual que las prealertas
      return {
        key: `s:${s.id}`,
        code: s.code,
        stage,
        title: cityOf(s.origin) ?? "Proveedor",
        meta: shipmentMeta(s),
        sortAt: s.updatedAt,
        shipmentId: s.id,
        prealertaId: null,
      };
    })
    .filter((x): x is AlertItem => x !== null)
    .sort((a, b) => b.sortAt.localeCompare(a.sortAt));

  return [...pedidos, ...envios];
}

export type AlertCounts = Record<"todas" | AlertStage, number>;

/** Conteos por etapa para las pestañas (Todas + una por etapa). */
export function countByStage(items: AlertItem[]): AlertCounts {
  const counts = { todas: items.length } as AlertCounts;
  for (const s of ALERT_STAGES) {
    counts[s] = items.filter((i) => i.stage === s).length;
  }
  return counts;
}

/** Filtra por etapa; `"todas"` devuelve todo. */
export function filterByStage(
  items: AlertItem[],
  stage: "todas" | AlertStage,
): AlertItem[] {
  return stage === "todas" ? items : items.filter((i) => i.stage === stage);
}
