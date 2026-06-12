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

export type ShipmentService =
  | "consolidacion"
  | "puerta_a_puerta_DDP"
  | "reserva_FCL"
  | "transporte_terrestre";

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
 * Labels para mostrar el servicio en UI.
 * El `sub` es un calificador chico del servicio (LCL, container completo, etc.).
 * Para DDP usamos la modalidad de marca vigente "Pagas al llegar"
 * (reemplazó a "Financiamiento 100%" 2026-06-09 por riesgo legal del término;
 * antes había reemplazado al viejo "prepago", retirado 2026-06-04).
 */
export const SERVICE_LABELS: Record<
  ShipmentService,
  { primary: string; sub?: string }
> = {
  consolidacion: { primary: "Consolidación", sub: "LCL" },
  puerta_a_puerta_DDP: { primary: "Puerta a Puerta DDP", sub: "Pagas al llegar" },
  reserva_FCL: { primary: "Reserva FCL", sub: "container completo" },
  transporte_terrestre: { primary: "Transporte terrestre", sub: "VE interno" },
};

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
