/**
 * Tracking — lista de envíos del tenant.
 *
 * - Lee filtros desde searchParams (?service=&status=&q=)
 * - Filas clickeables → /studio/tracking/[id]
 * - Hover row highlight via CSS module-like inline (transition)
 * - Empty state diferenciado:
 *   - Sin filtros + 0 envios → onboarding
 *   - Con filtros + 0 envios → "ningún resultado"
 *
 * Tipos visuales mantenidos del SDD-0005. Detalle: SDD-0006.
 */

import Link from "next/link";
import { createClient } from "@/lib/db/server";
import {
  listShipments,
  parseFiltersFromSearchParams,
} from "@/lib/studio/shipment-queries";
import { ServiceBadge } from "./_components/ServiceBadge";
import { StatusBadge } from "./_components/StatusBadge";
import { TrackingFilters } from "./_components/TrackingFilters";
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

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const filters = parseFiltersFromSearchParams(rawParams);

  const supabase = await createClient();
  const rows = (await listShipments(supabase, filters)) as ShipmentRow[];

  const hasFilters = Boolean(filters.service || filters.status || filters.q);

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header con spacing rítmico 8/12/32 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 24,
        }}
      >
        <div>
          <span className="studio-eyebrow">Operación</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 12px", color: "var(--ink)" }}
          >
            Tracking.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
            }}
          >
            {rows.length === 0
              ? hasFilters
                ? "Sin resultados para los filtros actuales."
                : "Sin envíos todavía."
              : `${rows.length} ${rows.length === 1 ? "envío" : "envíos"}${rows.length === 100 ? " · 100 más recientes" : ""}`}
          </p>
        </div>
        <Link
          href="/studio/tracking/nuevo"
          className="studio-btn studio-btn-primary"
        >
          + ENVÍO
        </Link>
      </div>

      {/* Filtros */}
      <TrackingFilters />

      {/* Lista */}
      {rows.length === 0 ? (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "2px dashed var(--border-strong)",
            borderRadius: 12,
            padding: "48px 28px",
            textAlign: "center",
          }}
        >
          <div
            className="studio-display"
            style={{ fontSize: 22, color: "var(--ink)", marginBottom: 10 }}
          >
            {hasFilters ? "Ningún envío coincide con estos filtros." : "Todavía no hay envíos."}
          </div>
          <p
            style={{
              font: "400 14px/1.55 var(--f-sans)",
              color: "var(--ink-soft)",
              maxWidth: "56ch",
              margin: "0 auto 18px",
            }}
          >
            {hasFilters
              ? "Probá ajustar la búsqueda o limpiar los filtros para ver todos los envíos."
              : "Creá el primero con el botón \"+ ENVÍO\" arriba a la derecha. Vas a poder elegir entre Consolidación, Puerta a Puerta DDP, Reserva FCL o Transporte terrestre."}
          </p>
        </div>
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
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
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border)",
              font: "700 10px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            <span>Código</span>
            <span>Cliente · Ruta</span>
            <span>Servicio</span>
            <span>Estado</span>
            <span style={{ textAlign: "right" }}>Creado</span>
          </div>

          {/* Rows clickeables → detalle */}
          {rows.map((row, i) => (
            <Link
              key={row.id}
              href={`/studio/tracking/${row.id}`}
              className="studio-tracking-row"
              style={{
                display: "grid",
                gridTemplateColumns: "150px 1fr 180px 130px 100px",
                gap: 12,
                padding: "14px 20px",
                borderTop: i > 0 ? "1px solid var(--border)" : 0,
                alignItems: "center",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <span
                style={{
                  font: "700 12.5px/1 ui-monospace, monospace",
                  color: "var(--ink)",
                  letterSpacing: "0.02em",
                }}
              >
                {row.code}
              </span>
              <div style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink)" }}>
                <div style={{ fontWeight: 700 }}>{row.client_name ?? "—"}</div>
                {(row.origin || row.destination) && (
                  <div style={{ color: "var(--ink-mute)", marginTop: 2, fontSize: 10.5, letterSpacing: "0.02em" }}>
                    {row.origin ?? "?"} → {row.destination ?? "?"}
                  </div>
                )}
              </div>
              <ServiceBadge service={row.shipment_service} />
              <StatusBadge status={row.status} />
              <span
                style={{
                  font: "500 11px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  textAlign: "right",
                }}
              >
                {formatDate(row.created_at)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
