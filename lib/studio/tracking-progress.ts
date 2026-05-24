/**
 * Helpers de avance operativo para el módulo Tracking (SDD-0013).
 *
 * Como la tabla `shipments` no almacena progress %, lo calculamos
 * determinísticamente desde el status según un flow canónico. Esto
 * permite mostrar mapa + timeline coherentes sin schema nuevo.
 */

import type { ShipmentService, ShipmentStatus } from "./shipment-types";

/**
 * Flow canónico de un embarque marítimo / aéreo (CN → VE).
 * Para transporte terrestre (VE interno) se usa un subset (ver
 * computeProgress).
 *
 * Excluye estados terminales sin progreso (draft, cancelled) y el
 * excepcional (exception, delayed_warehouse) que se tratan aparte.
 */
export const STATUS_FLOW_ORDER: ShipmentStatus[] = [
  "in_warehouse",
  "consolidating",
  "shipped",
  "in_transit",
  "in_customs",
  "arrived_destination",
  "out_for_delivery",
  "last_mile",
  "delivered",
];

/**
 * Subset para transporte terrestre interno VE. No pasa por
 * consolidación / aduana / etc.
 */
export const STATUS_FLOW_GROUND: ShipmentStatus[] = [
  "in_warehouse",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "last_mile",
  "delivered",
];

/**
 * % de progreso por status. Mapeo determinístico.
 *
 * draft = 0% (no se muestra en activos, lo dejamos por exhaustividad).
 * delayed_warehouse = mismo nivel que arrived_destination (con badge warning).
 * exception = se asume 50% (no se almacena el progreso previo).
 * cancelled = 0% (no se muestra).
 */
const PROGRESS_BY_STATUS: Record<ShipmentStatus, number> = {
  draft: 0,
  in_warehouse: 10,
  consolidating: 20,
  shipped: 35,
  in_transit: 55,
  in_customs: 75,
  arrived_destination: 85,
  delayed_warehouse: 85,
  out_for_delivery: 95,
  last_mile: 98,
  delivered: 100,
  exception: 50,
  cancelled: 0,
};

export function computeProgress(status: ShipmentStatus): number {
  return PROGRESS_BY_STATUS[status] ?? 0;
}

/**
 * Devuelve el flow a usar para un servicio dado.
 * Terrestre tiene su propio flow más corto.
 */
export function flowForService(service: ShipmentService): ShipmentStatus[] {
  if (service === "transporte_terrestre") return STATUS_FLOW_GROUND;
  return STATUS_FLOW_ORDER;
}

/**
 * Próximo hito visible para el KPI "Próximo hito".
 * Devuelve un string corto en español-VE.
 */
export function nextMilestone(
  status: ShipmentStatus,
  service: ShipmentService,
): string {
  if (status === "delivered") return "Entregado";
  if (status === "cancelled") return "—";
  if (status === "exception") return "Resolver alerta";
  if (status === "delayed_warehouse") return "Salida bodega";

  const flow = flowForService(service);
  const idx = flow.indexOf(status);
  if (idx < 0) return "—";

  const next = flow[idx + 1];
  if (!next) return "Entregado";

  const LABEL_MILESTONE: Partial<Record<ShipmentStatus, string>> = {
    consolidating: "Consolidación",
    shipped: "Embarque",
    in_transit: "Tránsito",
    in_customs: "Aduana VE",
    arrived_destination: "Bodega VE",
    out_for_delivery: "Reparto",
    last_mile: "Última milla",
    delivered: "Entrega",
  };
  return LABEL_MILESTONE[next] ?? next;
}

/**
 * Estimación rough de días restantes hasta entrega. Heurística:
 * (100 - progress) * factor. Factor depende del servicio:
 *  - marítimo (consolidacion, FCL, DDP): 0.35 día/% (≈ 35 días para 100%)
 *  - terrestre: 0.04 día/% (≈ 4 días)
 *
 * NO es real. Reemplazar cuando exista AIS / ETA confirmada.
 */
export function daysRemaining(
  status: ShipmentStatus,
  service: ShipmentService,
): number {
  if (status === "delivered" || status === "cancelled") return 0;
  const progress = computeProgress(status);
  const factor = service === "transporte_terrestre" ? 0.04 : 0.35;
  return Math.max(0, Math.round((100 - progress) * factor));
}

/**
 * Estado de cada step para la timeline operativa.
 * - done: el shipment ya pasó por ese status (índice < currentIdx).
 * - active: status actual del shipment.
 * - pending: aún no llegó.
 * - exception: marcador especial cuando shipment.status === "exception".
 */
export type TimelineStepState = "done" | "active" | "pending" | "exception";

export type TimelineStep = {
  status: ShipmentStatus;
  state: TimelineStepState;
};

/**
 * Construye la timeline de steps para un shipment.
 *
 * Comportamiento exception: si el status actual es "exception", se
 * marca el último step done como "exception" (rojo) y el resto sigue
 * pending. La idea es que el operador vea dónde se rompió el flow.
 */
export function buildTimeline(
  status: ShipmentStatus,
  service: ShipmentService,
): TimelineStep[] {
  const flow = flowForService(service);

  if (status === "exception") {
    // No sabemos el último status real (no se almacena). Marcamos el
    // primer pending como exception para visualizar el corte.
    return flow.map((s, i) => ({
      status: s,
      state: i === 0 ? "exception" : "pending",
    }));
  }

  if (status === "cancelled" || status === "draft") {
    // Todos pending para draft. Cancelled no debería verse en activos
    // pero por exhaustividad.
    return flow.map((s) => ({ status: s, state: "pending" }));
  }

  if (status === "delayed_warehouse") {
    // delayed_warehouse no está en el flow pero indica detención post
    // arrived_destination. Marcamos arrived_destination como exception
    // visualmente.
    return flow.map((s) => ({
      status: s,
      state:
        s === "arrived_destination"
          ? "exception"
          : flow.indexOf(s) < flow.indexOf("arrived_destination")
            ? "done"
            : "pending",
    }));
  }

  const currentIdx = flow.indexOf(status);
  return flow.map((s, i) => ({
    status: s,
    state: i < currentIdx ? "done" : i === currentIdx ? "active" : "pending",
  }));
}
