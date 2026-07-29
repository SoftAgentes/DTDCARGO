/**
 * Tipos TypeScript del módulo Tracking.
 * Matcheando los enums de la migración 0002_shipments.sql.
 *
 * Los enums/labels que TAMBIÉN usa el sitio público (ShipmentService,
 * ShipmentStatus, SERVICE_LABELS, STATUS_LABELS, STATUS_COLORS) viven en
 * `@/lib/shared/shipment-public` y se re-exportan acá para no romper los
 * importadores del Studio. El resto del dominio Shipment vive acá.
 */

import type { ShipmentService, ShipmentStatus } from "@/lib/shared/shipment-public";

export type { ShipmentService, ShipmentStatus };
export {
  SHIPMENT_SERVICES,
  isShipmentService,
  SERVICE_LABELS,
  SERVICE_SHORT_LABELS,
  SERVICE_OPTIONS,
  serviceLabel,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/shared/shipment-public";

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
  delivered_at: string | null;
  pod_signed_by: string | null;
  delivery_address: string | null;
  cancellation_reason: string | null;
  destination_gps: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export const VEHICLE_CATEGORY_OPTIONS: { value: VehicleCategory; label: string }[] = [
  { value: "contenedor_maritimo", label: "Contenedor marítimo" },
  { value: "camion_chico", label: "Camión chico (Ford 350, Iveco, etc.)" },
  { value: "camion_pesado", label: "Camión pesado (NPR, 750, etc.)" },
  { value: "gandola", label: "Gandola" },
  { value: "aereo", label: "Aéreo" },
];
