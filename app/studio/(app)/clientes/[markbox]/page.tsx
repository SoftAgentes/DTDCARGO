/**
 * Detalle de cliente — datos + histórico de envíos.
 *
 * SDD-0010. Server component lee cliente + shipments via lookup textual
 * (sin FK constraint). El botón "Editar" se maneja en ClientDetailClient.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import {
  getClientByMarkbox,
  listShipmentsByMarkbox,
  getClientPortalAccess,
} from "@/lib/studio/client-queries";
import { tierBadgeTone, tierLabel } from "@/lib/studio/client-types";
import {
  SERVICE_LABELS,
  type ShipmentService,
  type ShipmentStatus,
} from "@/lib/studio/shipment-types";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ClientDetailClient } from "../_components/ClientDetailClient";
import { PortalAccessCard } from "../_components/PortalAccessCard";

export const metadata = { title: "Detalle cliente" };

type ShipmentRow = {
  id: string;
  code: string;
  origin: string | null;
  destination: string | null;
  shipment_service: ShipmentService;
  status: ShipmentStatus;
  created_at: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ markbox: string }>;
}) {
  const { markbox } = await params;
  const supabase = await createClient();

  const client = await getClientByMarkbox(supabase, markbox);
  if (!client) notFound();

  const shipments = (await listShipmentsByMarkbox(supabase, markbox)) as ShipmentRow[];
  const portalAccess = await getClientPortalAccess(supabase, client.id);

  return (
    <div style={{ maxWidth: 1200 }}>
      <Link
        href="/studio/clientes"
        style={{
          font: "500 12px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: 14 }}>←</span> Volver al listado
      </Link>

      <ClientDetailClient client={client}>
        {/* Header con MARKBOX + nombre + tier badge */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                font: "800 18px/1 var(--f-mono)",
                color: "var(--ink)",
                letterSpacing: "0.02em",
                padding: "8px 14px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border)",
              }}
            >
              {client.markbox}
            </span>
            <h1
              className="studio-display"
              style={{
                fontSize: 26,
                margin: 0,
                color: "var(--ink)",
                flex: 1,
                minWidth: 0,
              }}
            >
              {client.name}
            </h1>
            <Badge tone={tierBadgeTone(client.tier)} size="md">
              {tierLabel(client.tier)}
            </Badge>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.6fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
          {/* Columna izquierda: datos del cliente + acceso al portal */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Card datos */}
          <section
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              padding: 20,
            }}
          >
            <div className="studio-eyebrow" style={{ marginBottom: 14 }}>
              Datos del cliente
            </div>
            <DataRow label="Email" value={client.email} mono={false} />
            <DataRow label="Teléfono" value={client.phone} mono />
            <DataRow label="Dirección" value={client.address} mono={false} />
            <DataRow label="RIF" value={client.rif} mono />
            {client.notes && (
              <div style={{ marginTop: 14 }}>
                <div className="studio-eyebrow" style={{ marginBottom: 6 }}>
                  Notas
                </div>
                <p
                  style={{
                    font: "500 13px/1.5 var(--f-sans)",
                    color: "var(--ink)",
                    margin: 0,
                  }}
                >
                  {client.notes}
                </p>
              </div>
            )}
            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: "1px solid var(--border)",
                font: "500 11px/1.4 var(--f-sans)",
                color: "var(--ink-mute)",
              }}
            >
              Creado {formatDate(client.created_at)}
            </div>
          </section>

          <PortalAccessCard
            clientId={client.id}
            markbox={client.markbox}
            email={client.email}
            access={portalAccess}
          />
          </div>

          {/* Histórico de envíos */}
          <section
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 14,
              }}
            >
              <span className="studio-eyebrow">Historial de envíos</span>
              <span
                style={{
                  font: "500 12px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                }}
              >
                {shipments.length}{" "}
                {shipments.length === 1 ? "envío" : "envíos"}
              </span>
            </div>

            {shipments.length === 0 ? (
              <p
                style={{
                  font: "500 13px/1.5 var(--f-sans)",
                  color: "var(--ink-soft)",
                  margin: 0,
                  padding: "20px 0",
                  textAlign: "center",
                }}
              >
                Sin envíos registrados con este MARKBOX todavía.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {shipments.map((s, i) => (
                  <Link
                    key={s.id}
                    href={`/studio/tracking/${s.id}`}
                    className="studio-tracking-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "110px 1fr 120px 100px",
                      gap: 10,
                      padding: "12px 8px",
                      borderTop: i > 0 ? "1px solid var(--border)" : 0,
                      alignItems: "center",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <span
                      style={{
                        font: "700 12px/1 var(--f-mono)",
                        color: "var(--ink)",
                      }}
                    >
                      {s.code}
                    </span>
                    <div
                      style={{
                        font: "500 12px/1.4 var(--f-sans)",
                        color: "var(--ink-soft)",
                      }}
                    >
                      {s.origin ?? "?"} → {s.destination ?? "?"}
                    </div>
                    <span
                      style={{
                        font: "600 11px/1 var(--f-sans)",
                        color: "var(--ink)",
                      }}
                    >
                      {SERVICE_LABELS[s.shipment_service].primary}
                    </span>
                    <span
                      style={{
                        font: "500 11px/1 var(--f-sans)",
                        color: "var(--ink-soft)",
                        textAlign: "right",
                      }}
                    >
                      {formatDate(s.created_at)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </ClientDetailClient>
    </div>
  );
}

function DataRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid var(--border)",
        alignItems: "baseline",
      }}
    >
      <span
        style={{
          font: "600 10.5px/1.3 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          font: mono
            ? "500 13px/1.3 var(--f-mono)"
            : "500 13px/1.4 var(--f-sans)",
          color: value ? "var(--ink)" : "var(--ink-mute)",
          wordBreak: "break-word",
        }}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}
