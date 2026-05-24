/**
 * Header de la vista detalle de envio.
 *
 * Muestra: link volver, codigo (mono), cliente, servicio (badge), status (badge grande),
 * ruta origen → destino, timestamps "creado / actualizado".
 *
 * Server component — solo despliega.
 */

import Link from "next/link";
import { ServiceBadge } from "../../_components/ServiceBadge";
import { StatusBadge } from "../../_components/StatusBadge";
import type { Shipment } from "@/lib/studio/shipment-types";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.round((now - then) / 60_000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr} h`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `hace ${diffDay} ${diffDay === 1 ? "día" : "días"}`;
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCreated(iso: string): string {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ShipmentHeader({ shipment }: { shipment: Shipment }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <Link
        href="/studio/tracking"
        style={{
          font: "500 12px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 14,
          transition: "color 0.12s",
        }}
      >
        <span style={{ fontSize: 14 }}>←</span> Volver al listado
      </Link>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span
            style={{
              font: "800 18px/1 var(--f-mono)",
              color: "var(--ink)",
              letterSpacing: "0.02em",
              padding: "8px 14px",
              background: "var(--bg-elevated)",
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
          >
            {shipment.code}
          </span>
          <span
            className="studio-display"
            style={{ fontSize: 22, color: "var(--ink)" }}
          >
            {shipment.client_name ?? "Sin cliente"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ServiceBadge service={shipment.shipment_service} />
          <StatusBadge status={shipment.status} />
        </div>
      </div>

      {shipment.origin && shipment.destination && (
        <p
          style={{
            font: "600 13px/1.4 var(--f-sans)",
            color: "var(--ink)",
            margin: "0 0 4px",
          }}
        >
          {shipment.origin} → {shipment.destination}
        </p>
      )}
      <p
        style={{
          font: "400 11px/1.4 var(--f-sans)",
          color: "var(--ink-mute)",
          margin: 0,
          letterSpacing: "0.02em",
        }}
      >
        Creado {formatCreated(shipment.created_at)} · Actualizado{" "}
        {relativeTime(shipment.updated_at)}
      </p>
    </div>
  );
}
