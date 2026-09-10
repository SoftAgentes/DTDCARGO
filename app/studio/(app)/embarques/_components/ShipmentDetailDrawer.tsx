"use client";

/**
 * ShipmentDetailDrawer — drawer read-only para vista comercial (SDD-0012).
 *
 * Solo muestra datos. Todas las acciones (cambio estado, edición, cancel,
 * cambio de destino) viven en /tracking/[id]. El drawer linkea allá.
 *
 * Single Source of Truth para edición = el módulo Tracking.
 */

import Link from "next/link";
import {
  SERVICE_LABELS,
  STATUS_LABELS,
  type ShipmentStatus,
} from "@/lib/studio/shipment-types";
import type { ShipmentListRow } from "@/lib/studio/shipment-queries";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";

function statusBadgeTone(
  status: ShipmentStatus,
): "neutral" | "info" | "success" | "warning" | "danger" | "wine" {
  if (status === "delivered") return "success";
  if (status === "cancelled") return "neutral";
  if (status === "exception" || status === "delayed_warehouse") return "danger";
  if (status === "in_customs") return "warning";
  if (status === "draft") return "neutral";
  return "info";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ShipmentDetailDrawer({
  shipment,
  onClose,
}: {
  shipment: ShipmentListRow;
  onClose: () => void;
}) {
  return (
    <DrawerShell
      title="Detalle del envío"
      subtitle={shipment.code}
      onClose={onClose}
      pending={false}
      width={560}
    >
        {/* Body */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {/* Cliente + status */}
          <div
            style={{
              padding: "14px 16px",
              background: "var(--bg-elevated)",
              borderRadius: "var(--r-md)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "var(--s-3)",
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  font: "700 14px/1.3 var(--f-sans)",
                  color: "var(--ink)",
                }}
              >
                {shipment.client_name ?? "Sin cliente"}
              </div>
              {shipment.client_markbox && (
                <Link
                  href={`/studio/clientes/${shipment.client_markbox}`}
                  style={{
                    font: "700 11.5px/1 var(--f-mono)",
                    color: "var(--wine-text)",
                    textDecoration: "none",
                    letterSpacing: "0.02em",
                    marginTop: "var(--s-1)",
                    display: "inline-block",
                  }}
                >
                  {shipment.client_markbox}
                </Link>
              )}
            </div>
            <Badge tone={statusBadgeTone(shipment.status)} size="md">
              {STATUS_LABELS[shipment.status]}
            </Badge>
          </div>

          {/* Datos grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            <Field label="Servicio" value={SERVICE_LABELS[shipment.shipment_service].primary} />
            <Field
              label="Subtipo"
              value={SERVICE_LABELS[shipment.shipment_service].sub ?? "—"}
            />
            <Field label="Origen" value={shipment.origin ?? "—"} />
            <Field label="Destino" value={shipment.destination ?? "—"} />
            <Field
              label="Peso"
              value={
                shipment.weight_kg != null
                  ? `${Number(shipment.weight_kg).toFixed(2)} kg`
                  : "—"
              }
              mono
            />
            <Field
              label="Volumen"
              value={
                shipment.volume_m3 != null
                  ? `${Number(shipment.volume_m3).toFixed(3)} m³`
                  : "—"
              }
              mono
            />
            <Field label="Creado" value={formatDate(shipment.created_at)} mono />
          </div>

          {/* Aviso de read-only */}
          <div
            style={{
              padding: "10px 12px",
              background: "var(--bg-elevated)",
              borderRadius: "var(--r-sm)",
              font: "500 11.5px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            Esta vista es de solo lectura. Para cambiar el estado, editar
            campos, agregar eventos al timeline, cambiar el destino o
            cancelar el envío, ingresa al Tracking.
          </div>
        </div>

        {/* Footer */}
        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={onClose}
          >
            Cerrar
          </button>
          <Link
            href={`/studio/tracking/${shipment.id}`}
            className="studio-btn studio-btn-primary"
          >
            Ir al tracking →
          </Link>
        </footer>
    </DrawerShell>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          font: "600 10.5px/1.3 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: mono
            ? "600 13px/1.3 var(--f-mono)"
            : "500 13px/1.4 var(--f-sans)",
          color: "var(--ink)",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}
