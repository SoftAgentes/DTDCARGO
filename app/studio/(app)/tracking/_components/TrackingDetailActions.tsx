/**
 * TrackingDetailActions — botonera arriba del mapa (SDD-0013).
 *
 * "Ver cliente" navega al módulo Clientes filtrado por MARKBOX si el
 * shipment tiene markbox; si no, va al listado de clientes sin filtro.
 *
 * "Ver detalle completo" navega a /tracking/[id] (vista de edición).
 */

import Link from "next/link";
import type { Shipment } from "@/lib/studio/shipment-types";

type Props = {
  shipment: Shipment;
};

export function TrackingDetailActions({ shipment }: Props) {
  const clientHref = shipment.client_markbox
    ? `/studio/clientes?q=${encodeURIComponent(shipment.client_markbox)}`
    : "/studio/clientes";

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <Link
        href={clientHref}
        className="studio-btn studio-btn-ghost studio-btn-sm"
      >
        VER CLIENTE
      </Link>
      <Link
        href={`/studio/tracking/${shipment.id}`}
        className="studio-btn studio-btn-primary studio-btn-sm"
      >
        VER DETALLE COMPLETO
      </Link>
    </div>
  );
}
