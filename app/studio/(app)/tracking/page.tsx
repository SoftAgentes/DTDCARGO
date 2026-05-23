/**
 * Tracking — lista de envíos del tenant.
 *
 * Reemplaza el placeholder del SDD-0004. CRUD basico:
 * - GET via query directa server-side (mas rapido que /api).
 * - Boton "+ Envio" lleva a /studio/tracking/nuevo.
 *
 * Refactor visual post-audit:
 *   - H1 estandarizado a 30px
 *   - Eyebrow con guión wine-soft (.studio-eyebrow)
 *   - Botón "+ ENVÍO" usa sistema de botones
 *   - Spacing rítmico 8/12/32
 *   - Hover sutil en filas (paper-2 background)
 *
 * Edicion + detalle + timeline → SDD-0006.
 */

import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { ServiceBadge } from "./_components/ServiceBadge";
import { StatusBadge } from "./_components/StatusBadge";
import type { ShipmentService, ShipmentStatus } from "@/lib/studio/shipment-types";

export const metadata = {
  title: "Tracking",
};

type ShipmentRow = {
  id: string;
  code: string;
  client_name: string | null;
  origin: string | null;
  destination: string | null;
  shipment_service: ShipmentService;
  status: ShipmentStatus;
  weight_kg: number | null;
  volume_m3: number | null;
  created_at: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function TrackingPage() {
  const supabase = await createClient();
  const { data: shipments } = await supabase
    .from("shipments")
    .select(
      "id, code, client_name, origin, destination, shipment_service, status, weight_kg, volume_m3, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (shipments ?? []) as ShipmentRow[];

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header con spacing rítmico 8/12/32 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 32,
        }}
      >
        <div>
          <span className="studio-eyebrow">Operación</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 12px", color: "#0F1E3D" }}
          >
            Tracking.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 Archivo, sans-serif",
              color: "#6B6B6B",
              margin: 0,
            }}
          >
            {rows.length === 0
              ? "Sin envíos todavía."
              : `${rows.length} ${rows.length === 1 ? "envío" : "envíos"} · 100 más recientes`}
          </p>
        </div>
        <Link
          href="/studio/tracking/nuevo"
          className="studio-btn studio-btn-primary"
        >
          + ENVÍO
        </Link>
      </div>

      {/* Lista */}
      {rows.length === 0 ? (
        <div
          style={{
            background: "#FFFFFF",
            border: "2px dashed #C9C5BE",
            borderRadius: 12,
            padding: "48px 28px",
            textAlign: "center",
          }}
        >
          <div
            className="studio-display"
            style={{ fontSize: 22, color: "#0F1E3D", marginBottom: 10 }}
          >
            Todavía no hay envíos.
          </div>
          <p
            style={{
              font: "400 14px/1.55 Archivo, sans-serif",
              color: "#6B6B6B",
              maxWidth: "56ch",
              margin: "0 auto 18px",
            }}
          >
            Creá el primero con el botón "+ ENVÍO" arriba a la derecha. Vas a poder
            elegir entre Consolidación, Puerta a Puerta DDP, Reserva FCL o Transporte
            terrestre.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E8E6E2",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "150px 1fr 180px 130px 100px",
              gap: 12,
              padding: "12px 20px",
              background: "#F2F0EC",
              borderBottom: "1px solid #E8E6E2",
              font: "700 10px/1 Archivo, sans-serif",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#6B6B6B",
            }}
          >
            <span>Código</span>
            <span>Cliente · Ruta</span>
            <span>Servicio</span>
            <span>Estado</span>
            <span style={{ textAlign: "right" }}>Creado</span>
          </div>

          {/* Rows */}
          {rows.map((row, i) => (
            <div
              key={row.id}
              title="Detalle disponible en SDD-0006"
              style={{
                display: "grid",
                gridTemplateColumns: "150px 1fr 180px 130px 100px",
                gap: 12,
                padding: "14px 20px",
                borderTop: i > 0 ? "1px solid #F2F0EC" : 0,
                alignItems: "center",
                transition: "background 0.12s",
              }}
              onMouseEnter={undefined}
            >
              <span
                style={{
                  font: "700 12.5px/1 ui-monospace, monospace",
                  color: "#0F1E3D",
                  letterSpacing: "0.02em",
                }}
              >
                {row.code}
              </span>
              <div style={{ font: "500 12.5px/1.4 Archivo, sans-serif", color: "#0F1E3D" }}>
                <div style={{ fontWeight: 700 }}>{row.client_name ?? "—"}</div>
                {(row.origin || row.destination) && (
                  <div style={{ color: "#6B6B6B", marginTop: 3, fontSize: 11 }}>
                    {row.origin ?? "?"} → {row.destination ?? "?"}
                  </div>
                )}
              </div>
              <ServiceBadge service={row.shipment_service} />
              <StatusBadge status={row.status} />
              <span
                style={{
                  font: "500 11px/1 Archivo, sans-serif",
                  color: "#6B6B6B",
                  textAlign: "right",
                }}
              >
                {formatDate(row.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
