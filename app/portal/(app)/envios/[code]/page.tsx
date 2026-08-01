import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getMyShipment, getPortalClient } from "@/lib/portal/portal-queries";
import {
  listMyShipmentEvents,
  stepDatesFromEvents,
} from "@/lib/portal/shipment-events-queries";
import { getHiddenPortalStatuses } from "@/lib/studio/notifications/portal-visibility-queries";
import { listShipmentNotificationHistory } from "@/lib/studio/notifications/notification-history-queries";
import type { ShipmentStatus } from "@/lib/shared/shipment-public";
import { showShipmentAcceptanceCta } from "@/lib/portal/demo";
import {
  getPendingAcceptanceForShipment,
  type PendingAcceptanceInvoice,
} from "@/lib/portal/portal-legal-queries";
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

  // Hitos ocultos del stepper (SDD-0156 · Slice D): la config por tenant puede
  // ocultar un status del portal (ej. "en aduana" → se dispara cobro anticipado
  // en su lugar). Se resuelve con el admin client (el cliente no lee la tabla de
  // reglas). Falla-seguro → set vacío (muestra todo).
  const admin = createAdminClient();
  const tenantId = client ? await resolveClientTenant(admin, client.id) : null;
  const hiddenStatuses: ReadonlySet<ShipmentStatus> = tenantId
    ? await getHiddenPortalStatuses(admin, tenantId, client?.id ?? null)
    : new Set<ShipmentStatus>();

  // Historial de avisos enviados de este envío (SDD-0156 · Slice C · loose end).
  // Read-only, scopeado al envío PROPIO (admin, sin RLS de cliente sobre la cola).
  const notificationHistory = await listShipmentNotificationHistory(
    admin,
    shipment.id,
  );

  // Rediseño Norte (founder 2026-06-20) GATEADO al demo: stepper horizontal + 2
  // columnas. Clientes reales siguen con el detalle de abajo.
  // Snapshot naviero (SDD-0101): la cadena interna (Tier 1 · Slice A) + el snapshot
  // VIVO de SeaRates (Slice B.3) se resuelven con el admin client (el cliente del
  // portal no tiene RLS sobre sailings/consolidations/tracking_snapshots), scopeados
  // al envío PROPIO (shipment.id ya verificado por getMyShipment). El portal SOLO LEE
  // el cache del tracking (cero cuota; el refresh lo dispara el ERP). Degradan a null.
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

  // Orden DDP de ESTE envío esperando aceptación (SDD-0075 §1 · Slice A). Gate
  // propio (`showShipmentAcceptanceCta`): NORTE_PORTAL_LIVE ya está en true, así
  // que sin él el CTA saldría vivo para todos. Best-effort → un fallo del admin
  // client no rompe el detalle del envío (el card simplemente no aparece).
  const pendingAcceptance =
    client && showShipmentAcceptanceCta(client.markbox)
      ? await loadPendingAcceptance(admin, client.id, client.markbox, shipment.id)
      : null;

  return (
    <PortalShipmentDetailNorte
      shipment={shipment}
      documents={documents}
      signedUrls={docUrls}
      naviera={naviera}
      live={live}
      stepDates={stepDates}
      hiddenStatuses={hiddenStatuses}
      notificationHistory={notificationHistory}
      pendingAcceptance={pendingAcceptance}
    />
  );
}

/**
 * La orden DDP de este envío que espera aceptación (SDD-0075 §1 · Slice A).
 * Resuelve el tenant del cliente (por su id, ya verificado por sesión vía
 * `getPortalClient`) y delega en la query, que scopea por tenant + markbox —
 * misma invariante que el dashboard. Best-effort: un fallo del admin client no
 * debe romper el detalle del envío → null (el card no se muestra).
 */
/** Tenant del cliente logueado (por su id ya verificado por sesión). null si no. */
async function resolveClientTenant(
  admin: SupabaseClient,
  clientId: string,
): Promise<string | null> {
  try {
    const { data } = await admin
      .from("clients")
      .select("tenant_id")
      .eq("id", clientId)
      .maybeSingle<{ tenant_id: string }>();
    return String(data?.tenant_id ?? "").trim() || null;
  } catch {
    return null;
  }
}

async function loadPendingAcceptance(
  admin: SupabaseClient,
  clientId: string,
  markbox: string,
  shipmentId: string,
): Promise<PendingAcceptanceInvoice | null> {
  try {
    const { data: row } = await admin
      .from("clients")
      .select("tenant_id")
      .eq("id", clientId)
      .maybeSingle<{ tenant_id: string }>();
    const tenantId = String(row?.tenant_id ?? "").trim();
    if (!tenantId) return null;
    return await getPendingAcceptanceForShipment(admin, {
      tenantId,
      markbox,
      shipmentId,
    });
  } catch {
    return null;
  }
}
