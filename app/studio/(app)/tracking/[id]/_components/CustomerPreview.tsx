/**
 * Preview del mensaje que vera el cliente con el estado actual.
 *
 * Server component — lee de lib/studio/shipment-messages.ts. Es solo UI hint
 * para que el operador chequee el mensaje antes de cambiar el estado.
 *
 * El Portal Cliente (SDD-0009) usara los mismos mensajes.
 */

import { getCustomerMessage } from "@/lib/studio/shipment-messages";
import type {
  ShipmentService,
  ShipmentStatus,
} from "@/lib/studio/shipment-types";

export function CustomerPreview({
  service,
  status,
}: {
  service: ShipmentService;
  status: ShipmentStatus;
}) {
  const message = getCustomerMessage(service, status);

  return (
    <div
      style={{
        background: "#F2F0EC",
        border: "1px solid #E8E6E2",
        borderRadius: 8,
        padding: "16px 20px",
      }}
    >
      <div className="studio-eyebrow" style={{ marginBottom: 8 }}>
        Esto verá el cliente
      </div>
      <p
        style={{
          font: "500 13.5px/1.5 Archivo, sans-serif",
          color: "#0F1E3D",
          margin: 0,
        }}
      >
        {message}
      </p>
    </div>
  );
}
