/**
 * Tipos del Portal del Cliente (SDD-0042).
 *
 * Reusa los enums + labels/colores de estado de `lib/shared/shipment-public.ts`
 * (la fuente única público↔ERP) para que el portal muestre los mismos estados
 * y colores que el tracking público y el Studio.
 */
import type { ShipmentService, ShipmentStatus } from "@/lib/shared/shipment-public";

export type { ShipmentService, ShipmentStatus };
export {
  SERVICE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/shared/shipment-public";

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
};

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
