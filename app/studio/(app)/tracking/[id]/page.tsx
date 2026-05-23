/**
 * Vista detalle de envio.
 *
 * Layout 2 columnas en desktop, stack en mobile.
 * Columna izquierda: datos editables (ShipmentDataPanel).
 * Columna derecha: estado actual + acciones + customer preview + timeline.
 * Footer: cancelar + eliminar.
 *
 * Server component lee shipment + events via lib/studio/shipment-queries.
 * 404 si no se encuentra (RLS oculta los de otros tenants).
 */

import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import {
  getShipmentById,
  getShipmentEvents,
} from "@/lib/studio/shipment-queries";
import { ShipmentHeader } from "./_components/ShipmentHeader";
import { ShipmentDataPanel } from "./_components/ShipmentDataPanel";
import { StateActionsPanel } from "./_components/StateActionsPanel";
import { CustomerPreview } from "./_components/CustomerPreview";
import { TimelinePanel } from "./_components/TimelinePanel";
import { FooterActions } from "./_components/FooterActions";

export const metadata = {
  title: "Detalle envío",
};

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const shipment = await getShipmentById(supabase, id);
  if (!shipment) notFound();

  const events = await getShipmentEvents(supabase, id);

  return (
    <div style={{ maxWidth: 1200 }}>
      <ShipmentHeader shipment={shipment} />

      {/* Cancellation reason banner — solo si el envio esta cancelado */}
      {shipment.status === "cancelled" && shipment.cancellation_reason && (
        <div
          style={{
            background: "rgba(194, 53, 63, 0.08)",
            border: "1px solid rgba(194, 53, 63, 0.30)",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 24,
          }}
        >
          <div
            className="studio-eyebrow"
            style={{ color: "#C2353F", marginBottom: 6 }}
          >
            Razón de cancelación
          </div>
          <p
            style={{
              font: "500 13px/1.5 Archivo, sans-serif",
              color: "#0F1E3D",
              margin: 0,
            }}
          >
            {shipment.cancellation_reason}
          </p>
        </div>
      )}

      <div className="studio-detail-grid">
        {/* Columna izquierda — datos editables */}
        <section
          style={{
            background: "#FFFFFF",
            border: "1px solid #E8E6E2",
            borderRadius: 10,
            padding: 24,
          }}
        >
          <ShipmentDataPanel shipment={shipment} />
        </section>

        {/* Columna derecha — operación */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section
            style={{
              background: "#FFFFFF",
              border: "1px solid #E8E6E2",
              borderRadius: 10,
              padding: 20,
            }}
          >
            <StateActionsPanel
              shipmentId={shipment.id}
              service={shipment.shipment_service}
              status={shipment.status}
            />
          </section>

          <section>
            <CustomerPreview
              service={shipment.shipment_service}
              status={shipment.status}
            />
          </section>

          <section
            style={{
              background: "#FFFFFF",
              border: "1px solid #E8E6E2",
              borderRadius: 10,
              padding: 20,
            }}
          >
            <TimelinePanel
              shipmentId={shipment.id}
              service={shipment.shipment_service}
              events={events}
            />
          </section>
        </aside>
      </div>

      <FooterActions shipmentId={shipment.id} status={shipment.status} />
    </div>
  );
}
