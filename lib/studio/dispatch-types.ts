/**
 * Tipos + labels + tones + validators del módulo Despacho (SDD-0029).
 * Matchea schema de supabase/migrations/0024_dispatch_core.sql.
 */

import type { BadgeTone } from "@/app/studio/_components/ui/Badge";

// ─────────────────────────────────────────────────────────────
// Enums (matchean Postgres)
// ─────────────────────────────────────────────────────────────

export type DispatchOrderStatus =
  | "creada"
  | "cargando"
  | "lista"
  | "en_ruta"
  | "entregada"
  | "cerrada"
  | "cancelada";

export type DispatchHub =
  | "valencia"
  | "la_guaira"
  | "punto_fijo"
  | "maracaibo";

export type DispatchSplitReason =
  | "falta_volumen"
  | "cliente_pidio_esperar"
  | "dano_caja"
  | "documentacion_pendiente"
  | "otro";

export type DispatchPaymentStatus = "pagado" | "parcial" | "pendiente";

export type DispatchPackageKind =
  | "warehouse_receipt_cn"
  | "warehouse_receipt_ve";

// ─────────────────────────────────────────────────────────────
// Row types (DB)
// ─────────────────────────────────────────────────────────────

export type DispatchOrder = {
  id: string;
  tenant_id: string;
  order_code: string;
  status: DispatchOrderStatus;
  hub: DispatchHub;
  route_id: string | null;
  truck_id: string | null;
  driver_id: string | null;
  capacity_kg_snapshot: number | null;
  capacity_cbm_snapshot: number | null;
  total_kg: number;
  total_cbm: number;
  package_count: number;
  cities_ordered: string[];
  created_at: string;
  updated_at: string;
  departed_at: string | null;
  completed_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  reassigned_at: string | null;
  progress_pct: number;
  current_city: string | null;
  cancel_reason: string | null;
  parent_od_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  cancelled_by: string | null;
};

export type DispatchOrderPackage = {
  od_id: string;
  package_kind: DispatchPackageKind;
  package_id: string;
  markbox: string;
  client_name: string;
  city: string;
  pay: DispatchPaymentStatus;
  description: string | null;
  boxes_total: number;
  boxes_shipped: number;
  weight_kg: number;
  cbm: number;
  hs_code: string | null;
  aes_code: string | null;
  split_reason: DispatchSplitReason | null;
  split_reason_text: string | null;
  added_at: string;
  /**
   * Sprint G (handoff v1.7): fields derivados del JOIN con `clients` por
   * markbox. NO viven en DB · se hidratan en `dispatch-mobile-queries.ts`
   * post-fetch. Si el cliente fue borrado o el markbox no matchea, quedan
   * `null` y la UI hace fallback graceful (sin tier badge, sin botones tel/WA).
   */
  client_tier?: import("./client-types").ClientTier | null;
  client_phone?: string | null;
  /** Sprint 3 (handoff v1.7) · CurrentDelivery del camionero. */
  client_address?: string | null;
  client_address_reference?: string | null;
  client_facade_photo_url?: string | null;
  client_lat?: number | null;
  client_lng?: number | null;
  /** Sprint 3 · status per-paquete (V1 default 'pendiente'). */
  delivery_status?: "pendiente" | "entregado" | "rechazado" | "retornado";
};

/** OD con joins (route + truck + driver) para tabla principal y panel activas. */
export type DispatchOrderRow = DispatchOrder & {
  route: { id: string; route_code: string; name: string } | null;
  truck: { id: string; plate: string; brand: string | null } | null;
  driver: { id: string; name: string; rating: number | null } | null;
  packages: DispatchOrderPackage[];
};

// ─────────────────────────────────────────────────────────────
// EligiblePackage (proyección runtime de warehouse_receipts_cn + score)
// ─────────────────────────────────────────────────────────────

export type EligiblePackage = {
  id: string;                       // package_id
  package_kind: DispatchPackageKind;
  markbox: string;
  client_name: string;
  city: string;
  pay: DispatchPaymentStatus;
  description: string | null;
  boxes_total: number;
  weight_kg: number;
  cbm: number;
  hs_code: string | null;
  aes_code: string | null;
  received_at: string;
  route_proximity?: number | null;  // 0-5 precalculado opcional
  tier?: "Platinum" | "Gold" | "Silver" | "Bronze" | null;
  /** Days in warehouse (FIFO antiquity). */
  days_in_warehouse: number;
  /** Score 0-100 computed by dispatch-scoring.ts */
  score: number;
};

// ─────────────────────────────────────────────────────────────
// Labels + Tones
// ─────────────────────────────────────────────────────────────

export const DISPATCH_ORDER_STATUS_LABELS: Record<DispatchOrderStatus, string> = {
  creada: "Creada",
  cargando: "Cargando",
  lista: "Lista para salir",
  en_ruta: "En ruta",
  entregada: "Entregada",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
};

export const DISPATCH_ORDER_STATUS_TONES: Record<DispatchOrderStatus, BadgeTone> = {
  creada: "info",
  cargando: "info",
  lista: "info",
  en_ruta: "info",
  entregada: "success",
  cerrada: "neutral",
  cancelada: "neutral",
};

export const DISPATCH_HUB_LABELS: Record<DispatchHub, string> = {
  valencia: "Valencia",
  la_guaira: "La Guaira",
  punto_fijo: "Punto Fijo",
  maracaibo: "Maracaibo",
};

export const DISPATCH_HUB_OPTIONS: { value: DispatchHub; label: string }[] = (
  Object.keys(DISPATCH_HUB_LABELS) as DispatchHub[]
).map((h) => ({ value: h, label: DISPATCH_HUB_LABELS[h] }));

export const DISPATCH_SPLIT_REASON_LABELS: Record<DispatchSplitReason, string> = {
  falta_volumen: "Sin capacidad en camión",
  cliente_pidio_esperar: "Pedido del cliente",
  dano_caja: "Cajas dañadas · inspección",
  documentacion_pendiente: "Documentación pendiente",
  otro: "Otro motivo",
};

export const DISPATCH_PAYMENT_LABELS: Record<DispatchPaymentStatus, string> = {
  pagado: "Pagado",
  parcial: "Parcial",
  pendiente: "Pendiente",
};

export const DISPATCH_PAYMENT_TONES: Record<DispatchPaymentStatus, BadgeTone> = {
  pagado: "success",
  parcial: "info",
  pendiente: "info",
};

// ─────────────────────────────────────────────────────────────
// Transitions allowed (mirror del trigger guard SQL)
// ─────────────────────────────────────────────────────────────

export const ALLOWED_TRANSITIONS: Record<DispatchOrderStatus, DispatchOrderStatus[]> = {
  creada: ["cargando", "cancelada"],
  cargando: ["lista", "cancelada"],
  lista: ["en_ruta", "cancelada"],
  en_ruta: ["entregada", "cancelada"],
  entregada: ["cerrada"],
  cerrada: [],
  cancelada: [],
};

export function canTransition(
  from: DispatchOrderStatus,
  to: DispatchOrderStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

// ─────────────────────────────────────────────────────────────
// Action state (compartido)
// ─────────────────────────────────────────────────────────────

export type DispatchActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  createdId?: string;
  createdCode?: string;
};

// ─────────────────────────────────────────────────────────────
// Input shapes + validators
// ─────────────────────────────────────────────────────────────

export type CreateDispatchOrderInput = {
  hub: DispatchHub;
  route_id: string;
  truck_id: string;
  driver_id: string;
  /** Packages a incluir en la OD. */
  packages: Array<{
    package_kind: DispatchPackageKind;
    package_id: string;
    boxes_shipped: number;
    split_reason: DispatchSplitReason | null;
    split_reason_text: string | null;
  }>;
};

export function validateCreateDispatchOrderInput(
  input: Partial<CreateDispatchOrderInput>,
): { input?: CreateDispatchOrderInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.hub) errors.hub = "Indica el hub de salida.";
  if (!input.route_id) errors.route_id = "Asigna una ruta.";
  if (!input.truck_id) errors.truck_id = "Asigna un camión.";
  if (!input.driver_id) errors.driver_id = "Asigna un chofer.";

  const packages = input.packages ?? [];
  if (packages.length === 0) {
    errors.packages = "Selecciona al menos 1 paquete.";
  } else {
    for (const p of packages) {
      if (!p.package_id) {
        errors.packages = "Hay paquetes sin ID válido.";
        break;
      }
      if (!Number.isFinite(p.boxes_shipped) || p.boxes_shipped <= 0) {
        errors.packages = `Paquete ${p.package_id}: cajas debe ser > 0.`;
        break;
      }
    }
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      hub: input.hub!,
      route_id: input.route_id!,
      truck_id: input.truck_id!,
      driver_id: input.driver_id!,
      packages,
    },
  };
}

export type CancelDispatchOrderInput = {
  od_id: string;
  from: "creada" | "cargando" | "lista" | "en_ruta";
  reason: string;
  request_ref: string;
};

export function validateCancelDispatchOrderInput(
  input: Partial<CancelDispatchOrderInput>,
): { input?: CancelDispatchOrderInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const od_id = input.od_id?.trim();
  if (!od_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(od_id)) {
    errors.od_id = "OD inválida.";
  }
  const from = input.from;
  if (!from || !["creada", "cargando", "lista", "en_ruta"].includes(from)) {
    errors.from = "La OD cambió de estado. Actualiza la página.";
  }
  const reason = input.reason?.trim();
  if (!reason) errors.reason = "El motivo es obligatorio para cancelar.";
  if (reason && reason.length < 4) errors.reason = "El motivo es muy corto.";
  if (reason && reason.length > 500) errors.reason = "El motivo es muy largo (máx 500).";
  const requestRef = input.request_ref?.trim();
  if (!requestRef || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(requestRef)) {
    errors.request_ref = "La referencia de la operación es inválida.";
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };
  return {
    input: {
      od_id: od_id!,
      from: from!,
      reason: reason!,
      request_ref: requestRef!,
    },
  };
}

export type AssignTruckDriverInput = {
  od_id: string;
  truck_id: string | null;
  driver_id: string | null;
};

export function validateAssignTruckDriverInput(
  input: Partial<AssignTruckDriverInput>,
): { input?: AssignTruckDriverInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const od_id = input.od_id?.trim();
  if (!od_id) errors.od_id = "Falta el ID de la OD.";
  if (!input.truck_id && !input.driver_id) {
    errors.truck_id = "Indica al menos camión o chofer para reasignar.";
  }
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };
  return {
    input: {
      od_id: od_id!,
      truck_id: input.truck_id?.trim() || null,
      driver_id: input.driver_id?.trim() || null,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Capacity helpers
// ─────────────────────────────────────────────────────────────

export type CapacitySnapshot = {
  capacity_kg: number;
  capacity_cbm: number;
};

export type CapacityUsage = {
  kg_used: number;
  cbm_used: number;
  kg_pct: number;
  cbm_pct: number;
  overflow: boolean;
};

export function computeCapacity(
  packages: Array<{ weight_kg: number; cbm: number; boxes_total: number; boxes_shipped: number }>,
  capacity: CapacitySnapshot,
): CapacityUsage {
  let kg_used = 0;
  let cbm_used = 0;
  for (const p of packages) {
    const ratio = p.boxes_shipped / p.boxes_total;
    kg_used += p.weight_kg * ratio;
    cbm_used += p.cbm * ratio;
  }
  const kg_pct = (kg_used / capacity.capacity_kg) * 100;
  const cbm_pct = (cbm_used / capacity.capacity_cbm) * 100;
  return {
    kg_used,
    cbm_used,
    kg_pct,
    cbm_pct,
    overflow: kg_pct > 100 || cbm_pct > 100,
  };
}

// ─────────────────────────────────────────────────────────────
// Search params parsers
// ─────────────────────────────────────────────────────────────

export type DispatchFilters = {
  hub?: DispatchHub | "all";
  status?: DispatchOrderStatus | "active" | "all";
  city?: string;
  pay?: DispatchPaymentStatus | "all";
};

const VALID_HUBS: DispatchHub[] = ["valencia", "la_guaira", "punto_fijo", "maracaibo"];
const VALID_STATUSES: DispatchOrderStatus[] = [
  "creada", "cargando", "lista", "en_ruta", "entregada", "cerrada", "cancelada",
];
const VALID_PAYS: DispatchPaymentStatus[] = ["pagado", "parcial", "pendiente"];

export function parseDispatchFilters(
  raw: Record<string, string | string[] | undefined>,
): DispatchFilters {
  const single = (k: string): string | undefined => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const hubRaw = single("hub");
  const statusRaw = single("status");
  const payRaw = single("pay");
  return {
    hub: hubRaw && VALID_HUBS.includes(hubRaw as DispatchHub) ? (hubRaw as DispatchHub) : "all",
    status:
      statusRaw === "active"
        ? "active"
        : statusRaw && VALID_STATUSES.includes(statusRaw as DispatchOrderStatus)
        ? (statusRaw as DispatchOrderStatus)
        : "all",
    city: single("city"),
    pay: payRaw && VALID_PAYS.includes(payRaw as DispatchPaymentStatus) ? (payRaw as DispatchPaymentStatus) : "all",
  };
}
