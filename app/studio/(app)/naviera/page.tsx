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
  navieraKpis,
} from "@/lib/studio/naviera/queries";
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
    />
  );
}
