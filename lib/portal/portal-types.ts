/**
 * Tipos del Portal del Cliente (SDD-0042).
 *
 * Reusa los enums + labels/colores de estado de `lib/shared/shipment-public.ts`
 * (la fuente única público↔ERP) para que el portal muestre los mismos estados
 * y colores que el tracking público y el Studio.
 */
import type { ShipmentService, ShipmentStatus } from "@/lib/shared/shipment-public";
import {
  type InvoiceStatus,
  type InvoiceCurrency,
  type InvoiceLine,
  statusLabel,
  statusBadgeTone,
  displayStatus,
  computeBalance,
  isOverdue,
  currencyLabel,
} from "@/lib/studio/invoice-types";
import type { ShipmentDocType } from "@/lib/studio/shipment-document-types";

export type { ShipmentService, ShipmentStatus };
export {
  SERVICE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/shared/shipment-public";

/**
 * Derivación de timeline desde el status — fuente ÚNICA del repo.
 *
 * `buildTimeline()` (status → pasos done/active/pending/exception según el flow
 * canónico por servicio) ya existe en `lib/studio/tracking-progress.ts` y la usan
 * el Studio (TrackingTimeline) y, conceptualmente, el tracking público. El portal
 * la REUSA tal cual — no inventa una nueva derivación. Sólo depende de los enums
 * compartidos, sin tocar la DB.
 *
 * El portal está FUERA de la frontera ESLint público↔ERP (es superficie
 * autenticada Supabase-backed, igual que `app/m/*` que "reusa lib/studio,
 * permitido"), así que puede importar de `@/lib/studio`. Lo re-exportamos acá
 * para que las pantallas del portal tengan un único punto de entrada
 * (`@/lib/portal/portal-types`), igual que con los labels/colores de estado.
 */
export type {
  TimelineStep,
  TimelineStepState,
} from "@/lib/studio/tracking-progress";
export {
  buildTimeline,
  flowForService,
  nextMilestone,
} from "@/lib/studio/tracking-progress";

/** Estado del acceso de un cliente al portal (tabla client_users). */
export type ClientUserStatus = "invited" | "active" | "revoked";

/** El cliente logueado (su propio registro, vía RLS del portal). */
export type PortalClient = {
  id: string;
  /** Código de cliente DTD-XXXX (de cara al cliente: "MARKBOX", nunca "Shipping Mark"). */
  markbox: string;
  name: string;
  email: string | null;
  phone: string | null;
  /**
   * Dirección/ciudad de entrega en Venezuela (columna `clients.address`, migr
   * 0006). La administra el asesor; el portal la muestra read-only. Null si el
   * registro no la tiene cargada.
   */
  address: string | null;
};

/**
 * El texto exacto que el cliente le pide a su proveedor en China que escriba en
 * **cada caja** como Shipping Mark (唛头): su MARKBOX. Así la mercancía llega
 * identificada a la bodega de Yiwu y se sabe de quién es. Es el VALOR del perfil
 * (de cara al cliente el término es "MARKBOX"; sólo al hablar del proveedor se
 * nombra "Shipping Mark").
 *
 * Función pura (testeable, reusable por un botón "copiar" del lado cliente) que
 * NORMALIZA el código a como se rotula físicamente: en mayúsculas y sin espacios
 * accidentales. NO agrega prefijos ni PII — la marca de la caja ES el código.
 * Espeja el "texto listo para WeChat" del glosario (id "markbox") y el paso 03 de
 * `/registro`.
 */
export function buildPortalSupplierMark(markbox: string): string {
  return markbox.trim().toUpperCase();
}

/** Una fila de "Mis envíos" (read-only). */
export type PortalShipmentRow = {
  id: string;
  code: string;
  service: ShipmentService;
  status: ShipmentStatus;
  origin: string | null;
  destination: string | null;
  updatedAt: string;
};

// ─────────────────────────────────────────────────────────────
// Dashboard de Inicio (SDD-0042 · Fase 5 · Norte PortalHome)
// ─────────────────────────────────────────────────────────────

/**
 * Estados TERMINALES de un envío (ya no "activo" / en curso). Fuente única para
 * el gate de "envíos activos" del dashboard. `arrived_destination` se cuenta como
 * terminal del lado del cliente (ya llegó a bodega VE; la milla final la maneja la
 * operación, pero para el cliente el viaje internacional terminó).
 */
export const TERMINAL_SHIPMENT_STATUSES: ReadonlySet<ShipmentStatus> = new Set<
  ShipmentStatus
>(["delivered", "cancelled", "arrived_destination"]);

/** ¿El envío sigue "activo" (en curso) de cara al dashboard? */
export function isActiveShipmentStatus(status: ShipmentStatus): boolean {
  return !TERMINAL_SHIPMENT_STATUSES.has(status);
}

/**
 * Resultado del gate de activación del portal (Fase 5.1). `activated` true si el
 * asesor aprobó la cuenta (`portal_approved_at`) O si el cliente ya tiene ≥1 envío
 * (prueba de cliente real → auto-desbloqueo). `reason` indica qué destrabó.
 */
export type PortalActivation = {
  activated: boolean;
  reason: "approved" | "has_shipments" | null;
};

/**
 * Completitud del perfil del cliente (REGISTRO EXPRESS · founder 2026-06-07). El
 * alta express difiere la FOTO de cédula y la DIRECCIÓN de entrega a "Completá tu
 * perfil" (`/portal/perfil`); ambas se piden antes de la 1ª compra y el asesor
 * revisa la foto antes de operar. `complete` = tiene foto Y dirección. Es ORTOGONAL
 * a `PortalActivation` (la cuenta nace activa; el perfil puede estar incompleto).
 */
export type ProfileCompleteness = {
  /** ¿Subió la foto de cédula/RIF? (`clients.cedula_photo_path` no vacío). */
  hasPhoto: boolean;
  /** ¿Cargó la dirección de entrega VE? (`clients.address` no vacío). */
  hasAddress: boolean;
  /** Las dos: foto + dirección. */
  complete: boolean;
};

/**
 * Las 4 métricas del dashboard de Inicio (Norte PortalHome). Sólo data que SÍ
 * existe: envíos (status) + facturas (montos). NO incluye contenedor/buque/ETA
 * real (Tier 1 Naviera, no construido).
 */
export type PortalDashboardKpis = {
  /** Envíos en curso (status no terminal). */
  activeShipments: number;
  /** Entregados (`delivered`) en el año calendario actual. */
  deliveredYtd: number;
  /** Σ total_amount de facturas no-borrador (acumulado, moneda dominante). */
  invoicedTotal: number;
  /** Σ (total_amount − paid_amount) de facturas no-borrador. */
  outstandingBalance: number;
  /** Moneda dominante de las facturas (la de mayor total facturado); USD si no hay. */
  currency: InvoiceCurrency;
  /** ¿Hay facturas en más de una moneda? (los montos se muestran en la dominante). */
  mixedCurrencies: boolean;
  /** Cuántas facturas tienen saldo pendiente (> 0). */
  pendingInvoiceCount: number;
};

/**
 * El "Próximo arribo" del dashboard (DEGRADADO · Norte hero card). El envío activo
 * más reciente, con la ETA estimada (heurística honesta). SIN contenedor/buque/
 * progreso/mapa — esa data es Tier 1 Naviera (no construida). Si no hay envío
 * activo → null (el card se oculta).
 */
export type PortalNextArrival = {
  id: string;
  code: string;
  service: ShipmentService;
  status: ShipmentStatus;
  origin: string | null;
  destination: string | null;
  /** ETA ISO estimada (`estimatePortalEta`); null si no aplica. */
  etaIso: string | null;
};

/**
 * Detalle de UN envío del cliente (read-only, Fase 2).
 *
 * Extiende la fila con los campos que el detalle muestra: volumen/peso y la
 * llegada real a destino. `shipments` NO tiene columnas ETA/ETD — la ETA se
 * estima en runtime (heurística por servicio sobre createdAt) y la "llegada"
 * real es `arrivedDestinationAt` cuando la operación ya la marcó.
 */
export type PortalShipmentDetail = {
  id: string;
  code: string;
  service: ShipmentService;
  status: ShipmentStatus;
  origin: string | null;
  destination: string | null;
  /** CBM (volumen) si está cargado. */
  volumeM3: number | null;
  /** Peso en kg si está cargado. */
  weightKg: number | null;
  /** Llegada real a bodega VE (dispara el reloj de bodegaje); null hasta que ocurre. */
  arrivedDestinationAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * ETA estimada (ISO) para el detalle del portal. Heurística simple por servicio
 * sobre `createdAt` — NO es real (no hay AIS/ETA confirmada en `shipments`).
 * Espeja `estimateEta` del tracking público para que cliente vea el mismo número.
 *
 * Devuelve null cuando ya no aplica:
 *  - entregado → null (ya llegó),
 *  - ya en bodega VE (`arrivedDestinationAt`) → null (mostramos la llegada real),
 *  - cancelado/borrador → null (no hay tránsito en curso).
 */
const ETA_DAYS_BY_SERVICE: Record<ShipmentService, number> = {
  consolidacion: 45,
  puerta_a_puerta_DDP: 50,
  reserva_FCL: 35,
  transporte_terrestre: 5,
};

export function estimatePortalEta(detail: {
  status: ShipmentStatus;
  service: ShipmentService;
  arrivedDestinationAt: string | null;
  createdAt: string;
}): string | null {
  if (
    detail.status === "delivered" ||
    detail.status === "cancelled" ||
    detail.status === "draft"
  ) {
    return null;
  }
  if (detail.arrivedDestinationAt) return null;

  const created = new Date(detail.createdAt).getTime();
  if (Number.isNaN(created)) return null;
  const days = ETA_DAYS_BY_SERVICE[detail.service] ?? 45;
  return new Date(created + days * 24 * 60 * 60 * 1000).toISOString();
}

// ─────────────────────────────────────────────────────────────
// Facturas del portal (SDD-0042 · Fase 3)
//
// El portal REUSA los tipos/helpers de facturación del Studio (SDD-0021,
// `lib/studio/invoice-types`): mismos labels, estados, derivación visual de
// "vencida" y cálculo de saldo que el módulo Facturación. (El portal está FUERA
// de la frontera ESLint público↔ERP — superficie autenticada Supabase-backed —
// así que puede importar de `@/lib/studio`, igual que con el timeline de envíos.)
// ─────────────────────────────────────────────────────────────
export type { InvoiceStatus, InvoiceCurrency, InvoiceLine };
export {
  statusLabel as invoiceStatusLabel,
  statusBadgeTone as invoiceStatusTone,
  displayStatus as invoiceDisplayStatus,
  computeBalance as invoiceBalance,
  isOverdue as invoiceIsOverdue,
  currencyLabel,
};

/** Tono del badge de estado de factura (lo que devuelve `invoiceStatusTone`). */
export type InvoiceBadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "danger"
  | "warning";

/**
 * Color de marca para el badge de estado de factura. Espeja la lógica de
 * `STATUS_COLORS` de envíos: usa los tokens de ESTADO de `globals.css`
 * (`--color-status-*`, `--color-ink`, `--color-grey-500`) — NUNCA wine, que es
 * sólo para CTAs. Son los hex de esos tokens (el badge necesita hex para componer
 * el alpha del fondo/borde, mismo patrón que el badge de envíos).
 */
export const INVOICE_TONE_COLOR: Record<InvoiceBadgeTone, string> = {
  success: "#1F8A5B", // --color-status-success · pagada
  info: "#0F1E3D", // --color-ink · emitida (en curso)
  warning: "#B8893A", // --color-status-warning · parcial
  danger: "#C2353F", // --color-status-danger · vencida
  neutral: "#6B6B6B", // --color-grey-500 · borrador / anulada
};

/**
 * Formatea un monto de factura de cara al cliente: separador de miles + 2
 * decimales y el CÓDIGO de moneda (no símbolo). USDT no es ISO 4217, así que por
 * coherencia mostramos el código para las cuatro monedas. Ej: "USD 1,250.00".
 */
export function formatInvoiceAmount(
  amount: number,
  currency: InvoiceCurrency,
): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${currency} ${formatted}`;
}

/** Una fila de "Mis facturas" (read-only). */
export type PortalInvoiceRow = {
  id: string;
  /** invoice_code F-YYYY-NNNN. */
  code: string;
  /** Status crudo; la UI deriva "vencida" con `invoiceDisplayStatus`. */
  status: InvoiceStatus;
  currency: InvoiceCurrency;
  total: number;
  paid: number;
  issuedAt: string | null; // YYYY-MM-DD
  dueDate: string | null; // YYYY-MM-DD
  shipmentCode: string | null;
};

/** Detalle de UNA factura del cliente (read-only). */
export type PortalInvoiceDetail = PortalInvoiceRow & {
  clientName: string;
  base: number;
  ivaRate: number;
  ivaAmount: number;
  fxRate: number | null;
  lines: InvoiceLine[];
  shipmentId: string | null;
  notes: string | null;
  createdAt: string;
};

/**
 * Un documento del cliente para la sección GLOBAL "Documentos" del portal
 * (SDD-0042 Fase 3b · Norte). Todos los docs del cliente cruzando envíos, con el
 * código del envío al que pertenecen. Espeja `D.DOCUMENTS` del portal del Norte.
 */
export type PortalDocument = {
  id: string;
  docType: ShipmentDocType;
  storagePath: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  shipmentCode: string | null;
};
