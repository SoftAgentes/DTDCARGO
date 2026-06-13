/**
 * Tipos del módulo Órdenes de venta (SDD-0072) — la OV de DTD.
 * Matchea el schema de supabase/migrations/0125_sales_orders.sql (sales_orders).
 *
 * La OV es el estimado CONFIRMADO y formal: el gemelo "ventas" de la Orden de
 * compra (0124). Nace al CONVERTIR un estimado (quotes, EST-) — snapshot editable
 * de sus datos — o manual (B2B / otros servicios, sin estimado). Es el nodo de
 * trazabilidad del QB: estimado (arriba) ↔ prealertas físicas (abajo). (Fase 2) la
 * recepción de Warehouse con datos reales genera la Factura (0021), parcial por
 * defecto.
 *
 * Helpers PUROS + validadores manuales (no Zod, patrón del repo).
 */

import { SERVICE_OPTIONS, type ShipmentService } from "../shipment-types";

// ── Tonos de badge (set del sistema) ──────────────────────────
export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "wine"
  | "neutral";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Estado de la OV (enum de display)                         ║
// ╚═══════════════════════════════════════════════════════════╝

export type SalesOrderStatus =
  | "confirmada"
  | "parcial"
  | "facturada"
  | "cerrada"
  | "cancelada";

export const SALES_ORDER_STATUS: Record<
  SalesOrderStatus,
  { label: string; tone: BadgeTone }
> = {
  confirmada: { label: "Confirmada", tone: "info" },
  parcial: { label: "Facturada parcial", tone: "warning" },
  facturada: { label: "Facturada", tone: "success" },
  cerrada: { label: "Cerrada", tone: "wine" },
  cancelada: { label: "Cancelada", tone: "neutral" },
};

export const SALES_ORDER_STATUSES = Object.keys(
  SALES_ORDER_STATUS,
) as SalesOrderStatus[];

export function salesOrderStatusLabel(status: string): string {
  return SALES_ORDER_STATUS[status as SalesOrderStatus]?.label ?? status;
}
export function salesOrderStatusTone(status: string): BadgeTone {
  return SALES_ORDER_STATUS[status as SalesOrderStatus]?.tone ?? "neutral";
}

export function isSalesOrderStatus(v: unknown): v is SalesOrderStatus {
  return typeof v === "string" && v in SALES_ORDER_STATUS;
}

/**
 * Transiciones de status permitidas. PURA — testeable sin DB.
 *
 *   confirmada → parcial · facturada · cerrada · cancelada
 *   parcial    → facturada · cerrada · cancelada
 *   facturada  → cerrada
 *   cerrada    → (terminal)
 *   cancelada  → (terminal)
 *
 * 'parcial' y 'facturada' NO se setean por transición manual desde la UI: las
 * pone el motor de facturación (Fase 2: recepción de Warehouse → Factura). Las
 * incluimos en el grafo para validar el orden, pero `canTransition` para esos
 * destinos devuelve false (solo el motor las setea). Manual: confirmada/parcial →
 * cerrada · cancelada.
 */
const ALLOWED_TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  confirmada: ["parcial", "facturada", "cerrada", "cancelada"],
  parcial: ["facturada", "cerrada", "cancelada"],
  facturada: ["cerrada"],
  cerrada: [],
  cancelada: [],
};

/** Destinos que SOLO setea el motor de facturación (Fase 2), no la UI. */
const ENGINE_ONLY_STATES: readonly SalesOrderStatus[] = ["parcial", "facturada"];

/** ¿Se puede pasar la OV de `from` a `to` por acción manual del operador? PURA. */
export function canTransition(from: string, to: string): boolean {
  if (!isSalesOrderStatus(from) || !isSalesOrderStatus(to)) return false;
  if (ENGINE_ONLY_STATES.includes(to)) return false; // las pone el motor (Fase 2)
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * ¿La transición es válida en el grafo (incluyendo las del motor)? PURA. La usa
 * el motor de facturación (Fase 2) para validar parcial/facturada; la UI usa
 * `canTransition`, que excluye los estados de motor.
 */
export function isAllowedTransition(from: string, to: string): boolean {
  if (!isSalesOrderStatus(from) || !isSalesOrderStatus(to)) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Estados terminales (no admiten más cambios). PURA. */
export function isTerminalStatus(status: string): boolean {
  return status === "cerrada" || status === "cancelada";
}

/** ¿La OV admite edición del snapshot? Solo 'confirmada' (antes de facturar). */
export function isEditableStatus(status: string): boolean {
  return status === "confirmada";
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Filas persistidas                                         ║
// ╚═══════════════════════════════════════════════════════════╝

export type SalesOrder = {
  id: string;
  tenant_id: string;
  sales_order_code: string;
  quote_id: string | null;
  /** Code del estimado de origen (EST-…), traído por embed `quotes(quote_code)` cuando la OV viene de un estimado. */
  quote_code?: string | null;
  client_markbox: string | null;
  client_name: string;
  service: ShipmentService;
  origin: string;
  destination: string;
  subtotal_usd: number;
  total_usd: number;
  status: SalesOrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** ¿La OV viene de un estimado (provenance "viene de EST-…")? */
export function isFromEstimate(
  so: Pick<SalesOrder, "quote_id">,
): boolean {
  return !!so.quote_id;
}

/** Label del servicio (reusa SERVICE_OPTIONS del Studio). PURA. */
export function salesOrderServiceLabel(service: ShipmentService): string {
  return SERVICE_OPTIONS.find((o) => o.value === service)?.label ?? service;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Inputs + validadores manuales (no Zod, patrón del repo)   ║
// ╚═══════════════════════════════════════════════════════════╝

/** Lo que el operador edita al crear/editar una OV (sin code/status/timestamps). */
export type SalesOrderInput = {
  clientMarkbox: string | null;
  clientName: string;
  service: ShipmentService;
  origin: string;
  destination: string;
  subtotalUsd: number;
  totalUsd: number;
  notes: string | null;
};

export type SalesOrderActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof SalesOrderInput, string>>;
  salesOrderCode?: string;
};

const SERVICES: readonly ShipmentService[] = [
  "consolidacion",
  "puerta_a_puerta_DDP",
  "reserva_FCL",
  "transporte_terrestre",
];

function isService(v: unknown): v is ShipmentService {
  return typeof v === "string" && SERVICES.includes(v as ShipmentService);
}

/**
 * Validación manual del input de la OV (sin zod, patrón del repo).
 *
 * Reglas (criterios de aceptación §6):
 *  - clientName requerido (no vacío) — la OV es un documento formal.
 *  - service requerido y válido.
 *  - origin / destination requeridos.
 *  - totalUsd ≥ 0 (una OV puede crearse con total 0 y completarse luego).
 *  - subtotalUsd ≥ 0; si no se pasa, cae al total.
 *  - clientMarkbox / notes opcionales (se normalizan a null).
 */
export function validateSalesOrderInput(
  input: Partial<SalesOrderInput>,
): {
  input?: SalesOrderInput;
  fieldErrors?: SalesOrderActionState["fieldErrors"];
} {
  const errors: SalesOrderActionState["fieldErrors"] = {};

  const clientName = (input.clientName ?? "").toString().trim();
  if (!clientName) errors.clientName = "Indica el nombre del cliente.";

  if (!isService(input.service)) {
    errors.service = "Elige un servicio.";
  }

  const origin = (input.origin ?? "").toString().trim();
  if (!origin) errors.origin = "Indica el origen.";

  const destination = (input.destination ?? "").toString().trim();
  if (!destination) errors.destination = "Indica el destino.";

  const totalNum = Number(input.totalUsd);
  if (!Number.isFinite(totalNum) || totalNum < 0) {
    errors.totalUsd = "El total no puede ser negativo.";
  }

  let subtotalNum = Number(input.subtotalUsd);
  if (!Number.isFinite(subtotalNum) || subtotalNum < 0) {
    // Si el subtotal no viene o es inválido, cae al total (snapshot mínimo).
    subtotalNum = Number.isFinite(totalNum) && totalNum >= 0 ? totalNum : 0;
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      clientMarkbox: (input.clientMarkbox ?? "").toString().trim() || null,
      clientName,
      service: input.service as ShipmentService,
      origin,
      destination,
      subtotalUsd: round2(subtotalNum),
      totalUsd: round2(totalNum),
      notes: (input.notes ?? "").toString().trim() || null,
    },
  };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Snapshot estimado → OV (helper PURO, testeable sin DB)    ║
// ╚═══════════════════════════════════════════════════════════╝

/**
 * Subconjunto del Quote (0061) que la OV snapshotea. Lo declaramos acotado para
 * no acoplar este módulo al tipo completo del estimado.
 */
export type QuoteSnapshotSource = {
  client_markbox: string | null;
  client_name: string;
  service: ShipmentService;
  origin: string;
  destination: string;
  subtotal_usd: number;
  total_usd: number;
  notes: string | null;
};

/**
 * Arma el `SalesOrderInput` snapshot a partir de un estimado. PURA — testeable
 * sin DB. Copia los datos del estimado (cliente, totales USD, origen/destino,
 * servicio, notas); el operador PUEDE editarlos luego (entre estimado y OV puede
 * haber cambios · §3.2). Normaliza números a no-negativos redondeados a 2.
 */
export function buildSalesOrderFromQuote(
  quote: QuoteSnapshotSource,
): SalesOrderInput {
  const total = Math.max(0, Number(quote.total_usd) || 0);
  const subtotalRaw = Number(quote.subtotal_usd);
  const subtotal =
    Number.isFinite(subtotalRaw) && subtotalRaw >= 0 ? subtotalRaw : total;
  return {
    clientMarkbox: (quote.client_markbox ?? "").trim() || null,
    clientName: (quote.client_name ?? "").trim(),
    service: quote.service,
    origin: (quote.origin ?? "").trim(),
    destination: (quote.destination ?? "").trim(),
    subtotalUsd: round2(subtotal),
    totalUsd: round2(total),
    notes: (quote.notes ?? "")?.trim() || null,
  };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Código correlativo (espejo en TS para test sin DB)        ║
// ╚═══════════════════════════════════════════════════════════╝

/** Patrón del sales_order_code: OV-YYYY-NNNN (mínimo 4 dígitos). */
export const SALES_ORDER_CODE_RE = /^OV-\d{4}-\d{4,}$/;

/** Formatea un sales_order_code. Espejo en TS de la SQL next_sales_order_code. */
export function formatSalesOrderCode(year: number, seq: number): string {
  return `OV-${year}-${String(seq).padStart(4, "0")}`;
}
