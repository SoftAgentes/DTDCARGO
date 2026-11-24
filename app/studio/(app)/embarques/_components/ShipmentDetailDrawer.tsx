"use client";

/**
 * ShipmentDetailDrawer — drawer read-only para vista comercial (SDD-0012).
 *
 * Solo muestra datos. Todas las acciones (cambio estado, edición, cancel,
 * cambio de destino) viven en /tracking/[id]. El drawer linkea allá.
 *
 * Single Source of Truth para edición = el módulo Tracking.
 */

import { formatCbm } from "@/lib/shared/cbm";
import type { EstadoCajas } from "@/lib/studio/cajas-por-proveedor";
import Link from "next/link";
import {
  SERVICE_LABELS,
  STATUS_LABELS,
  type ShipmentStatus,
} from "@/lib/studio/shipment-types";
import type { ShipmentListRow } from "@/lib/studio/shipment-queries";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { esSinCliente } from "../../tracking/[id]/_components/ClienteDelEmbarque";

function statusBadgeTone(
  status: ShipmentStatus,
): "neutral" | "info" | "success" | "warning" | "danger" {
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

/** SDD-0711: «14 cajas» · «1 caja»; sin recepción, «Sin recepción» (nunca 0). */
function textoTotalCajas(cajas: EstadoCajas): string {
  if (cajas.estado === "no_disponible") return "No se pudo leer";
  if (cajas.estado === "sin_recepcion") return "Sin recepción";
  const n = cajas.datos.totalCajas;
  return `${n.toLocaleString("es-VE")} ${n === 1 ? "caja" : "cajas"}`;
}

export function ShipmentDetailDrawer({
  shipment,
  cajas,
  onClose,
}: {
  shipment: ShipmentListRow;
  /** SDD-0711: cajas y CBM por proveedor (ver `estadoDeCajas`). */
  cajas: EstadoCajas;
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
                  href={`/studio/embarques/ficha-cliente/${encodeURIComponent(shipment.client_markbox)}${esSinCliente(shipment.client_markbox) ? `?embarque=${encodeURIComponent(shipment.id)}` : ""}`}
                  scroll={false}
                  onClick={(event) => event.currentTarget.focus({ preventScroll: true })}
                  style={{
                    font: "700 11.5px/1 var(--f-mono)",
                    color: "var(--accion-text)",
                    textDecoration: "underline", textUnderlineOffset: 3,
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
                  ? formatCbm(shipment.volume_m3, { unit: true })
                  : "—"
              }
              mono
            />
            <Field label="Cajas" value={textoTotalCajas(cajas)} mono />
            <Field label="Creado" value={formatDate(shipment.created_at)} mono />
          </div>

          {/* SDD-0711: cajas y CBM de cada proveedor */}
          {cajas.estado === "listo" && (
            <section aria-labelledby="det-prov-titulo">
              <div
                id="det-prov-titulo"
                style={{
                  font: "600 10.5px/1.3 var(--f-sans)",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Por proveedor
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ font: "600 10.5px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
                    <th scope="col" style={{ textAlign: "left", padding: "4px 0", fontWeight: 600 }}>Proveedor</th>
                    <th scope="col" style={{ textAlign: "right", padding: "4px 0", fontWeight: 600 }}>Cajas</th>
                    <th scope="col" style={{ textAlign: "right", padding: "4px 0 4px 16px", fontWeight: 600 }}>CBM</th>
                  </tr>
                </thead>
                <tbody>
                  {cajas.datos.proveedores.map((p) => (
                    <tr key={p.proveedor ?? "__sin_proveedor__"} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "7px 0", font: "500 13px/1.4 var(--f-sans)", color: "var(--ink)", wordBreak: "break-word" }}>
                        {p.proveedor ?? "Sin proveedor"}
                      </td>
                      <td style={{ padding: "7px 0", textAlign: "right", font: "600 13px/1.3 var(--f-mono)", color: "var(--ink)", whiteSpace: "nowrap" }}>
                        {p.cajas.toLocaleString("es-VE")}
                      </td>
                      <td style={{ padding: "7px 0 7px 16px", textAlign: "right", font: "600 13px/1.3 var(--f-mono)", color: "var(--ink)", whiteSpace: "nowrap" }}>
                        {formatCbm(p.cbm, { unit: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

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
