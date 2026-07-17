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
 * Estado a MOSTRAR de cara al cliente cuando la config del tenant oculta hitos
 * (SDD-0156 · `visible_in_portal`). Si el status actual está oculto (ej. "en
 * aduana"), devuelve el último estado VISIBLE en el flow igual o anterior al
 * actual — así el badge y el % de la lista/dashboard no delatan el hito oculto y
 * quedan coherentes con el stepper del detalle. Si no hay estados ocultos, o el
 * actual es visible, devuelve el mismo status. Los estados fuera del flow
 * (exception/delayed_warehouse/cancelled/draft) se devuelven tal cual.
 */
export function effectiveVisibleStatus(
  status: ShipmentStatus,
  service: ShipmentService,
  hiddenStatuses?: ReadonlySet<ShipmentStatus>,
): ShipmentStatus {
  if (!hiddenStatuses || hiddenStatuses.size === 0) return status;
  if (!hiddenStatuses.has(status)) return status;

  const flow = flowForService(service);
  const idx = flow.indexOf(status);
  if (idx < 0) return status; // fuera del flow → sin sustitución
  // Camina hacia atrás hasta el primer estado visible.
  for (let i = idx - 1; i >= 0; i--) {
    if (!hiddenStatuses.has(flow[i])) return flow[i];
  }
  return status; // no hay visible anterior → deja el actual (no rompe)
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
 *
 * `hiddenStatuses` (SDD-0156 · Slice D): estados a NO mostrar en el stepper (por
 * `visible_in_portal=false` de la config por tenant). Se filtran DESPUÉS de
 * calcular done/active/pending sobre el flow completo, así ocultar el hito actual
 * (ej. "en aduana") no descoloca los pasos cumplidos ni los pendientes. El Studio
 * y el tracking público no pasan este set → ven todo (sólo el portal lo aplica).
 */
export function buildTimeline(
  status: ShipmentStatus,
  service: ShipmentService,
  hiddenStatuses?: ReadonlySet<ShipmentStatus>,
): TimelineStep[] {
  const steps = buildTimelineFull(status, service);
  if (!hiddenStatuses || hiddenStatuses.size === 0) return steps;

  const visible = steps.filter((s) => !hiddenStatuses.has(s.status));
  // Si el paso ACTUAL quedó oculto (ej. "en aduana" oculto mientras el envío está
  // ahí), el filtrado deja al stepper sin ningún paso 'active' → se ve estancado.
  // Promovemos el último paso visible YA cumplido a 'active' ("en curso") para que
  // siga mostrando avance sin nombrar el hito oculto. Solo cuando había un 'active'
  // y el filtro lo quitó (no cuando el actual sigue visible).
  const activeWasHidden =
    steps.some((s) => s.state === "active") &&
    !visible.some((s) => s.state === "active");
  if (activeWasHidden) {
    for (let i = visible.length - 1; i >= 0; i--) {
      if (visible[i].state === "done") {
        visible[i] = { ...visible[i], state: "active" };
        break;
      }
    }
  }
  return visible;
}

function buildTimelineFull(
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
