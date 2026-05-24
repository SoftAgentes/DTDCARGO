/**
 * Embarques — vista comercial agrupada por cliente.
 *
 * SDD-0012. Server component fetchea todos los shipments del tenant
 * (RLS-filtered) y delega la UI a EmbarquesClient. Los filtros (tabs +
 * search) son client-side para evitar round trips por interacción.
 */

import { createClient } from "@/lib/db/server";
import { listShipments, type ShipmentListRow } from "@/lib/studio/shipment-queries";
import { EmbarquesClient } from "./_components/EmbarquesClient";

export const metadata = { title: "Embarques" };

export default async function EmbarquesPage() {
  const supabase = await createClient();
  const shipments = (await listShipments(supabase, {})) as ShipmentListRow[];

  return <EmbarquesClient shipments={shipments} />;
}
