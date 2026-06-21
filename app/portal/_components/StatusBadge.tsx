import { STATUS_LABELS, type ShipmentStatus } from "@/lib/portal/portal-types";

/**
 * Badge de estado de envío. Mapea el status a un TONO (info/success/warning/
 * danger/neutral) y lo pinta con clases `.badge-status-*` tokenizadas (globals.css)
 * en vez de hex inline → se adapta al TEMA del portal (claro/oscuro). Los tonos
 * espejan 1:1 los colores de `STATUS_COLORS` (lib/shared/shipment-public.ts) en
 * CLARO (cero cambio visual para los clientes reales) y usan los tokens de estado
 * brillantes en OSCURO (legibles sobre navy, que con los hex fijos eran invisibles).
 */
const STATUS_TONE: Record<
  ShipmentStatus,
  "info" | "success" | "warning" | "danger" | "neutral"
> = {
  draft: "neutral", // #6B6B6B
  in_warehouse: "info", // #0F1E3D
  consolidating: "info",
  shipped: "info",
  in_transit: "info",
  in_customs: "warning", // #B8893A
  arrived_destination: "info",
  delayed_warehouse: "warning",
  out_for_delivery: "info",
  last_mile: "info",
  delivered: "success", // #1F8A5B
  exception: "danger", // #C2353F
  cancelled: "neutral",
};

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  return (
    <span className={`badge-status badge-status-${STATUS_TONE[status]}`}>
      <span className="badge-status-dot" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}
