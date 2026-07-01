import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getMyShipment, getPortalClient } from "@/lib/portal/portal-queries";
import {
  listMyShipmentEvents,
  stepDatesFromEvents,
} from "@/lib/portal/shipment-events-queries";
import { SERVICE_LABELS, estimatePortalEta } from "@/lib/portal/portal-types";
import { showNortePortal } from "@/lib/portal/demo";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { ArrowIcon, WhatsAppIcon } from "@/components/Icon";
import { StatusBadge } from "../../../_components/StatusBadge";
import { PortalTimeline } from "../../../_components/PortalTimeline";
import { PortalDocsCard } from "../../../_components/PortalDocsCard";
import { PortalShipmentDetailNorte } from "./_components/PortalShipmentDetailNorte";
import {
  listShipmentDocuments,
  signDocumentUrls,
} from "@/lib/studio/shipment-document-queries";
import { createAdminClient } from "@/lib/db/admin";
import {
  getShipmentNaviera,
  getShipmentTrackingSnapshot,
} from "@/lib/studio/naviera-tracking/queries";
import type { NavieraSnapshot } from "@/lib/studio/naviera-tracking/types";
import type { TrackingSnapshotRow } from "@/lib/studio/naviera-tracking/snapshot-queries";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Envío ${decodeURIComponent(code)}` };
}

export default async function PortalShipmentDetailPage({ params }: Props) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw);

  const supabase = await createClient();
  const [shipment, client] = await Promise.all([
    getMyShipment(supabase, code),
    getPortalClient(supabase),
  ]);
  // RLS sólo devuelve envíos del cliente logueado; si no hay match (ajeno o
  // inexistente) → 404, no exponemos la diferencia.
  if (!shipment) notFound();

  // Documentos del envío (SDD-0042 Fase 3b). El shipment ya viene verificado por
  // markbox (getMyShipment) y la RLS de shipment_documents filtra por markbox;
  // las signed URLs se firman con admin client (un cliente puro no puede leer el
  // bucket por tenant vía storage RLS).
  const documents = await listShipmentDocuments(supabase, shipment.id);
  const docUrls = documents.length
    ? await signDocumentUrls(
        createAdminClient(),
        documents.map((d) => d.storage_path),
      )
    : {};

  // Hitos con fecha real (SDD-0132): el stepper de ambos detalles muestra la
  // fecha de cada paso (del evento más antiguo de ese status). RLS portal por
  // markbox (migr 0196) + filtro explícito.
  const events = await listMyShipmentEvents(supabase, shipment.id);
  const stepDates = stepDatesFromEvents(events);

  // Rediseño Norte (founder 2026-06-20) GATEADO al demo: stepper horizontal + 2
  // columnas. Clientes reales siguen con el detalle de abajo.
  if (showNortePortal(client?.markbox)) {
    // Snapshot naviero (SDD-0101): la cadena interna (Tier 1 · Slice A) + el snapshot
    // VIVO de SeaRates (Slice B.3) se resuelven con el admin client (el cliente del
    // portal no tiene RLS sobre sailings/consolidations/tracking_snapshots), scopeados
    // al envío PROPIO (shipment.id ya verificado por getMyShipment). El portal SOLO LEE
    // el cache del tracking (cero cuota; el refresh lo dispara el ERP). Degradan a null.
    const admin = createAdminClient();
    let naviera: NavieraSnapshot | null = null;
    let live: TrackingSnapshotRow | null = null;
    try {
      [naviera, live] = await Promise.all([
        getShipmentNaviera(admin, shipment.id),
        getShipmentTrackingSnapshot(admin, shipment.id),
      ]);
    } catch {
      naviera = null;
      live = null;
    }
    return (
      <PortalShipmentDetailNorte
        shipment={shipment}
        documents={documents}
        signedUrls={docUrls}
        naviera={naviera}
        live={live}
        stepDates={stepDates}
      />
    );
  }

  const svc = SERVICE_LABELS[shipment.service];
  const serviceLabel = svc.sub ? `${svc.primary} · ${svc.sub}` : svc.primary;
  const route =
    shipment.origin || shipment.destination
      ? `${shipment.origin ?? "—"} → ${shipment.destination ?? "—"}`
      : null;
  const eta = estimatePortalEta(shipment);

  const waLink = buildWhatsAppLink(
    `Hola DTD Cargo, tengo una consulta sobre mi envío ${shipment.code}.`,
  );

  return (
    <div>
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-grey-500 hover:text-ink transition-colors"
      >
        <ArrowIcon size={15} className="rotate-180" /> Volver a mis envíos
      </Link>

      <div className="mt-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <span className="eyebrow">Detalle del envío</span>
          <div
            className="mt-2 text-[30px] sm:text-[40px] leading-none text-ink"
            style={{
              fontFamily: "var(--font-archivo-black)",
              letterSpacing: "-0.02em",
            }}
          >
            {shipment.code}
          </div>
        </div>
        <StatusBadge status={shipment.status} />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 lg:gap-8 items-start">
        {/* Datos del envío */}
        <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
          <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500">
            Resumen
          </h2>
          <dl className="mt-5 flex flex-col gap-4">
            <Field label="Servicio" value={serviceLabel} />
            {route ? <Field label="Ruta" value={route} mono /> : null}
            {shipment.arrivedDestinationAt ? (
              <Field
                label="Llegó a bodega VE"
                value={formatDate(shipment.arrivedDestinationAt)}
                highlight
              />
            ) : eta ? (
              <Field
                label="Entrega estimada"
                value={formatDate(eta)}
                highlight
                hint="Estimada, sujeta a aduana y tránsito."
              />
            ) : null}
            {shipment.volumeM3 != null ? (
              <Field label="Volumen" value={`${shipment.volumeM3.toFixed(2)} m³`} mono />
            ) : null}
            {shipment.weightKg != null ? (
              <Field label="Peso" value={`${shipment.weightKg.toFixed(0)} kg`} mono />
            ) : null}
          </dl>

          <div className="mt-8 pt-6 border-t border-grey-200">
            <p className="text-[13.5px] text-grey-700 leading-[1.55]">
              ¿Necesitas un cambio o tienes una duda sobre este envío? Escríbele a
              tu asesor.
            </p>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost mt-4 inline-flex items-center gap-2"
            >
              <WhatsAppIcon size={18} /> Consultar por WhatsApp
            </a>
          </div>
        </div>

        {/* Timeline de estado */}
        <div className="card-shadow bg-paper border border-grey-200 rounded-[18px] p-6 sm:p-8">
          <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500 mb-6">
            Estado del envío
          </h2>
          <PortalTimeline
            status={shipment.status}
            service={shipment.service}
            dates={stepDates}
          />
          <p className="mt-2 text-[12px] text-grey-500 leading-[1.5]">
            Las actualizaciones de estado las carga nuestro equipo a medida que tu
            carga avanza.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <PortalDocsCard documents={documents} signedUrls={docUrls} />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  highlight = false,
  mono = false,
  hint,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
        {label}
      </dt>
      <dd
        className={`text-[15.5px] ${
          highlight ? "font-extrabold text-wine" : "font-semibold text-ink"
        }`}
        style={
          mono
            ? { fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }
            : undefined
        }
      >
        {value}
      </dd>
      {hint ? <span className="text-[11.5px] text-grey-500">{hint}</span> : null}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
