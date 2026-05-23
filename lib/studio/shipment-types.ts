/**
 * Tipos TypeScript del modulo Tracking.
 * Matcheando los enums de la migracion 0002_shipments.sql.
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

export type VehicleCategory =
  | "contenedor_maritimo"
  | "camion_chico"
  | "camion_pesado"
  | "gandola"
  | "aereo";

export type Shipment = {
  id: string;
  tenant_id: string;
  code: string;
  client_name: string | null;
  client_markbox: string | null;
  origin: string | null;
  destination: string | null;
  shipment_service: ShipmentService;
  status: ShipmentStatus;
  weight_kg: number | null;
  volume_m3: number | null;
  vehicle_category: string | null;
  vehicle_model: string | null;
  arrived_destination_at: string | null;
  cancellation_reason: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Labels para mostrar el servicio en UI.
 * Convención de marca (memoria persistente): "Puerta a Puerta DDP" siempre con
 * "prepago" en chico debajo o al lado.
 */
export const SERVICE_LABELS: Record<
  ShipmentService,
  { primary: string; sub?: string }
> = {
  consolidacion: { primary: "Consolidación", sub: "LCL" },
  puerta_a_puerta_DDP: { primary: "Puerta a Puerta DDP", sub: "prepago" },
  reserva_FCL: { primary: "Reserva FCL", sub: "container completo" },
  transporte_terrestre: { primary: "Transporte terrestre", sub: "VE interno" },
};

export const SERVICE_OPTIONS: { value: ShipmentService; label: string }[] = [
  { value: "consolidacion", label: "Consolidación (LCL)" },
  { value: "puerta_a_puerta_DDP", label: "Puerta a Puerta DDP (prepago)" },
  { value: "reserva_FCL", label: "Reserva FCL (container completo)" },
  { value: "transporte_terrestre", label: "Transporte terrestre (VE interno)" },
];

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
 * Color de marca para cada status (usado en badges del dashboard y lista).
 *
 * Regla de color theory (post-audit gráfico):
 * - Wine (#7F0F1A) → SOLO para CTAs / acciones del usuario, NO para estados.
 * - Ink (#0F1E3D) → estados "en curso" neutrales.
 * - Dorado (#B8893A) → warning / atención requerida.
 * - Verde (#1F8A5B) → éxito terminal.
 * - Rojo (#C2353F) → alerta / problema.
 * - Gris (#6B6B6B) → terminal sin acción (draft, cancelled).
 */
export const STATUS_COLORS: Record<ShipmentStatus, string> = {
  draft: "#6B6B6B",
  in_warehouse: "#0F1E3D",
  consolidating: "#0F1E3D",
  shipped: "#0F1E3D",            // antes wine: ahora ink (estado en curso)
  in_transit: "#0F1E3D",         // antes wine: ahora ink
  in_customs: "#B8893A",
  arrived_destination: "#0F1E3D",
  delayed_warehouse: "#B8893A",
  out_for_delivery: "#0F1E3D",   // antes wine: ahora ink
  last_mile: "#0F1E3D",          // antes wine: ahora ink
  delivered: "#1F8A5B",
  exception: "#C2353F",
  cancelled: "#6B6B6B",
};

export const VEHICLE_CATEGORY_OPTIONS: { value: VehicleCategory; label: string }[] = [
  { value: "contenedor_maritimo", label: "Contenedor marítimo" },
  { value: "camion_chico", label: "Camión chico (Ford 350, Iveco, etc.)" },
  { value: "camion_pesado", label: "Camión pesado (NPR, 750, etc.)" },
  { value: "gandola", label: "Gandola" },
  { value: "aereo", label: "Aéreo" },
];
