import { SERVICE_LABELS, type PortalShipmentRow } from "@/lib/portal/portal-types";
import { StatusBadge } from "./StatusBadge";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Fila read-only de "Mis envíos" (Fase 1b — sin link a detalle, eso es Fase 2).
 */
export function ShipmentRow({ shipment }: { shipment: PortalShipmentRow }) {
  const svc = SERVICE_LABELS[shipment.service];
  const route =
    shipment.origin || shipment.destination
      ? `${shipment.origin ?? "—"} → ${shipment.destination ?? "—"}`
      : null;

  return (
    <div className="bg-white border border-grey-200 rounded-[14px] p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className="text-[14px] font-bold text-ink"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          >
            {shipment.code}
          </span>
          <StatusBadge status={shipment.status} />
        </div>
        <div className="mt-1.5 text-[13.5px] text-grey-700">
          <span className="font-medium">{svc.primary}</span>
          {svc.sub ? <span className="text-grey-500"> · {svc.sub}</span> : null}
        </div>
        {route ? (
          <div
            className="mt-0.5 text-[13px] text-grey-500"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          >
            {route}
          </div>
        ) : null}
      </div>
      <div className="text-[12px] text-grey-500 sm:text-right flex-shrink-0">
        Actualizado {formatDate(shipment.updatedAt)}
      </div>
    </div>
  );
}
