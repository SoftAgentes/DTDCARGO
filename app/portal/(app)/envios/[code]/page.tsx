import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import {
  listMyShipmentEvents,
  stepDatesFromEvents,
} from "@/lib/portal/shipment-events-queries";
import { getHiddenPortalStatusesForPortal } from "@/lib/studio/notifications/portal-visibility-queries";
import type { ShipmentStatus } from "@/lib/shared/shipment-public";
import { PortalShipmentDetailNorte } from "./_components/PortalShipmentDetailNorte";
import { getPortalShipmentPrivateContext } from "@/lib/portal/shipment-private-context";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Envío ${decodeURIComponent(code)}` };
}

export default async function PortalShipmentDetailPage({ params }: Props) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw);

  const supabase = await createClient();
  const context = await getPortalShipmentPrivateContext(supabase, code);
  // RLS sólo devuelve envíos del cliente logueado; si no hay match (ajeno o
  // inexistente) → 404, no exponemos la diferencia.
  if (!context) notFound();
  const {
    shipment,
    documents,
    signedUrls,
    naviera,
    live,
    notificationHistory,
    pendingAcceptance,
  } = context;

  // Hitos con fecha real (SDD-0132): el stepper de ambos detalles muestra la
  // fecha de cada paso (del evento más antiguo de ese status). RLS portal por
  // markbox (migr 0196) + filtro explícito.
  const events = await listMyShipmentEvents(supabase, shipment.id);
  const stepDates = stepDatesFromEvents(events);

  // Hitos ocultos del stepper (SDD-0156 · Slice D): la config por tenant puede
  // ocultar un status del portal (ej. "en aduana" → se dispara cobro anticipado
  // en su lugar). La RPC deriva cliente y tenant desde auth.uid(), sin aceptar
  // ids de entrada. Falla-seguro → set vacío (muestra todo).
  const hiddenStatuses: ReadonlySet<ShipmentStatus> =
    await getHiddenPortalStatusesForPortal(supabase);

  return (
    <PortalShipmentDetailNorte
      shipment={shipment}
      documents={documents}
      signedUrls={signedUrls}
      naviera={naviera}
      live={live}
      stepDates={stepDates}
      hiddenStatuses={hiddenStatuses}
      notificationHistory={notificationHistory}
      pendingAcceptance={pendingAcceptance}
    />
  );
}
