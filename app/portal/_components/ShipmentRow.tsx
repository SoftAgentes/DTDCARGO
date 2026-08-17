import Link from "next/link";
import { SERVICE_LABELS, type PortalShipmentRow } from "@/lib/portal/portal-types";
import { ArrowIcon } from "@/components/Icon";
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
 * Fila read-only de "Mis envíos". Toda la card linkea al detalle del envío
 * (`/portal/envios/[code]` — Fase 2). El `code` es URL-safe (S-YYYY-NNNN).
 */
export function ShipmentRow({ shipment }: { shipment: PortalShipmentRow }) {
  const svc = SERVICE_LABELS[shipment.service];
  const route =
    shipment.origin || shipment.destination
      ? `${shipment.origin ?? "—"} → ${shipment.destination ?? "—"}`
      : null;

  return (
    <Link
      href={`/portal/envios/${encodeURIComponent(shipment.code)}`}
      className="card-link group bg-white border border-grey-200 rounded-[14px] p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 transition-colors hover:border-ink focus-visible:border-ink"
      aria-label={`Ver detalle del envío ${shipment.code}`}
    >
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
      <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0 sm:justify-end">
        <span className="text-[12px] text-grey-500">
          Actualizado {formatDate(shipment.updatedAt)}
        </span>
        <ArrowIcon
          className="text-grey-300 transition-colors group-hover:text-wine-text"
          size={18}
        />
      </div>
    </Link>
  );
}
