/**
 * Tipos/labels de envío COMPARTIDOS público ↔ ERP.
 *
 * `lib/shared/` es el ÚNICO puente que cruza la frontera sitio-público ↔ Studio.
 * Acá vive SOLO lo que el lado público necesita (tracking): los enums de
 * servicio/estado + sus labels/colores de display. El resto del dominio Shipment
 * vive en `lib/studio/shipment-types` (que re-exporta estos símbolos).
 *
 * Matchea los enums de supabase/migrations/0002_shipments.sql.
 *
 * ⚠️ Regla de admisión a lib/shared: SOLO símbolos genuinamente usados por el
 * sitio público Y el Studio. No es cajón de sastre — si algo lo usa solo el
 * Studio, va en lib/studio.
 */

/**
 * Los 5 valores del enum `shipment_service` de Postgres, en ORDEN COMERCIAL
 * (el que se muestra en los selects: primero lo que más se vende).
 *
 * Es una tupla `as const` y no un `type` suelto a propósito: de acá salen el
 * tipo, el guard `isShipmentService()` y los selects, así que agregar un
 * servicio se hace en UN lugar y TypeScript reclama en todos los `Record<…>`.
 *
 * Historia de los nombres (SDD-0164):
 *  - `consolidacion` se renombró a `consolidado_lcl` porque la palabra
 *    significaba dos cosas — el producto comercial Y la operación de juntar
 *    carga, que también hace el puerta a puerta. Esa ambigüedad ya provocó un
 *    dato mal clasificado en producción.
 *  - `reserva_FCL` se renombró a `fcl_directo` (es literalmente lo que era:
 *    reservar un contenedor cargado en la fábrica del proveedor).
 *  - `fcl_bodega` es valor NUEVO: el contenedor completo que se consolida en
 *    la bodega de Yiwu. Antes compartía enum con el directo y por eso no se le
 *    podía poner tarifa propia ni medirlo aparte.
 */
export const SHIPMENT_SERVICES = [
  "puerta_a_puerta_DDP",
  "consolidado_lcl",
  "fcl_directo",
  "fcl_bodega",
  "transporte_terrestre",
] as const;

export type ShipmentService = (typeof SHIPMENT_SERVICES)[number];

/** Guard para validar texto crudo (querystring, FormData, CSV, payload web). */
export function isShipmentService(value: unknown): value is ShipmentService {
  return (
    typeof value === "string" &&
    (SHIPMENT_SERVICES as readonly string[]).includes(value)
  );
}

export type ShipmentStatus =
  | "draft"
  | "in_warehouse"
  | "consolidating"
  | "shipped"
  | "in_transit"
  | "in_customs"
  | "arrived_destination"
  | "delayed_warehouse"
  | "out_for_delivery"
  | "last_mile"
  | "delivered"
  | "exception"
  | "cancelled";

/**
 * FUENTE ÚNICA del nombre visible de cada servicio (SDD-0164). Todas las
 * superficies —sitio público, Studio, portal del cliente, móvil— leen de acá.
 * Si una pantalla necesita una variante (más corta, con sigla), la DERIVA de
 * estos valores; no vuelve a escribir el nombre.
 *
 * `primary` = el nombre, idéntico en todas partes.
 * `sub` = la aclaración corta que lo desambigua.
 *
 * Reglas de copy que NO se rompen:
 *  - El puerta a puerta NO lleva la sigla "DDP" en el nombre visible; "DDP" se
 *    usa solo como aclaración técnica cuando hace falta. El enum interno sí
 *    sigue siendo `puerta_a_puerta_DDP`.
 *  - La palabra "prepago" NO aparece: la verdad comercial es que se PAGA AL
 *    LLEGAR (así está vivo en el sitio y en la FAQ). El término se retiró el
 *    2026-06-04; "Financiamiento 100%" se retiró el 2026-06-09 por riesgo legal.
 */
export const SERVICE_LABELS: Record<
  ShipmentService,
  { primary: string; sub?: string }
> = {
  puerta_a_puerta_DDP: {
    primary: "Puerta a Puerta",
    sub: "Todo pagado · pagas al llegar",
  },
  consolidado_lcl: { primary: "Consolidado LCL", sub: "Hasta puerto · con tu BL" },
  fcl_directo: {
    primary: "FCL directo de fábrica",
    sub: "Contenedor cargado en origen",
  },
  fcl_bodega: {
    primary: "FCL en bodega",
    sub: "Contenedor completo, consolidado en Yiwu",
  },
  transporte_terrestre: {
    primary: "Transporte terrestre",
    sub: "Nacional en Venezuela · próximamente",
  },
};

/**
 * Variante CORTA para chips y celdas apretadas (portal, listas del Studio).
 * Vive acá —y no en `lib/portal`— porque es una forma del MISMO nombre: si el
 * nombre cambia, las dos formas se editan de una sola vez y no se separan.
 */
export const SERVICE_SHORT_LABELS: Record<ShipmentService, string> = {
  puerta_a_puerta_DDP: "Puerta a Puerta",
  consolidado_lcl: "Consolidado LCL",
  fcl_directo: "FCL directo",
  fcl_bodega: "FCL bodega",
  transporte_terrestre: "Terrestre",
};

/**
 * Opciones de los selects de servicio (Tracking, Tarifas, Cotizador, Órdenes
 * de venta, Costing, portal). DERIVADO de SERVICE_LABELS — nadie vuelve a
 * escribir la lista a mano.
 */
export const SERVICE_OPTIONS: {
  value: ShipmentService;
  label: string;
  hint?: string;
}[] = SHIPMENT_SERVICES.map((value) => ({
  value,
  label: SERVICE_LABELS[value].primary,
  hint: SERVICE_LABELS[value].sub,
}));

/** Nombre visible de un servicio; cae al valor crudo si llega basura de la DB. */
export function serviceLabel(service: string): string {
  return isShipmentService(service)
    ? SERVICE_LABELS[service].primary
    : service;
}

export const STATUS_LABELS: Record<ShipmentStatus, string> = {
  draft: "Borrador",
  in_warehouse: "En bodega",
  consolidating: "Consolidando",
  shipped: "Embarcado",
  in_transit: "En tránsito",
  in_customs: "En aduana",
  arrived_destination: "En bodega VE",
  delayed_warehouse: "Bodegaje",
  out_for_delivery: "En reparto",
  last_mile: "Última milla",
  delivered: "Entregado",
  exception: "Alerta",
  cancelled: "Cancelado",
};

/**
 * Color de marca para cada status (badges del dashboard/lista y tracking público).
 * Wine SOLO para CTAs, no estados. Ink=en curso, Dorado=warning, Verde=éxito,
 * Rojo=alerta, Gris=terminal sin acción.
 */
export const STATUS_COLORS: Record<ShipmentStatus, string> = {
  draft: "#6B6B6B",
  in_warehouse: "#0F1E3D",
  consolidating: "#0F1E3D",
  shipped: "#0F1E3D",
  in_transit: "#0F1E3D",
  in_customs: "#B8893A",
  arrived_destination: "#0F1E3D",
  delayed_warehouse: "#B8893A",
  out_for_delivery: "#0F1E3D",
  last_mile: "#0F1E3D",
  delivered: "#1F8A5B",
  exception: "#C2353F",
  cancelled: "#6B6B6B",
};
