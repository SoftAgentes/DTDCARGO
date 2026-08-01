/**
 * Naviera & Consolidación (SDD-0047, Slice B) — surface operable.
 *
 * Server component: fetcha itinerarios, reservas, contenedores (con items +
 * utilización ya calculada), carga suelta candidata a consolidar y los
 * catálogos (navieras/puertos/tipos). Delega la UI a NavieraClient (KPIs +
 * 4 tabs: Itinerarios / Contenedores·consolidación / Carga suelta / Reservas).
 *
 * Reusa los queries puros de lib/studio/naviera (Slice A). RLS filtra por tenant.
 */

import { createClient } from "@/lib/db/server";
import {
  listBookings,
  listCarriers,
  listConsolidationsWithStats,
  listContainerTypes,
  listLooseCargo,
  listPorts,
  listSailings,
  listStuffingByConsolidation,
  navieraKpis,
} from "@/lib/studio/naviera/queries";
import { listCurrentPlans } from "@/lib/studio/naviera/plan-queries";
import {
  listTrackingSnapshots,
  type TrackingSnapshotRow,
} from "@/lib/studio/naviera-tracking/snapshot-queries";
import { NavieraClient } from "./_components/NavieraClient";

export const metadata = { title: "Naviera & Consolidación" };

export default async function NavieraPage() {
  const supabase = await createClient();

  const [
    sailings,
    bookings,
    consolidations,
    looseCargo,
    carriers,
    ports,
    containerTypes,
    kpis,
  ] = await Promise.all([
    listSailings(supabase),
    listBookings(supabase),
    listConsolidationsWithStats(supabase),
    listLooseCargo(supabase),
    listCarriers(supabase),
    listPorts(supabase),
    listContainerTypes(supabase),
    navieraKpis(supabase),
  ]);

  // Estiba por zonas (SDD-0152): dónde quedó cada caja dentro de cada
  // contenedor. Mismo criterio que los snapshots de tracking — se mapea acá
  // para que el detalle no re-consulte.
  const stuffingByConsolidation = await listStuffingByConsolidation(
    supabase,
    consolidations.map((c) => c.consolidation.id),
  );

  // Plan de carga vigente por contenedor (SDD-0184 · Fase 3): la HIPOTESIS de
  // donde va cada lote. La realidad capturada es `stuffingByConsolidation`.
  const plansByConsolidation = await listCurrentPlans(
    supabase,
    consolidations.map((c) => c.consolidation.id),
  );

  // Snapshots de tracking cacheados (SDD-0101 · Slice B.2) mapeados por
  // consolidación, para que el detalle muestre el dato vivo sin re-query.
  const snapshots = await listTrackingSnapshots(supabase);
  const trackingByConsolidation: Record<string, TrackingSnapshotRow> = {};
  for (const s of snapshots) {
    if (s.consolidationId && !trackingByConsolidation[s.consolidationId]) {
      trackingByConsolidation[s.consolidationId] = s;
    }
  }

  return (
    <NavieraClient
      sailings={sailings}
      bookings={bookings}
      consolidations={consolidations}
      looseCargo={looseCargo}
      carriers={carriers}
      ports={ports}
      containerTypes={containerTypes}
      kpis={kpis}
      trackingByConsolidation={trackingByConsolidation}
      stuffingByConsolidation={stuffingByConsolidation}
      plansByConsolidation={plansByConsolidation}
    />
  );
}
