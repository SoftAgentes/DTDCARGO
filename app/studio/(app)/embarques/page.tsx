/**
 * Embarques — vista comercial agrupada por cliente.
 *
 * SDD-0012. Server component fetchea todos los shipments del tenant
 * (RLS-filtered) y delega la UI a EmbarquesClient. Los filtros (tabs +
 * search) son client-side para evitar round trips por interacción.
 */

import { createClient } from "@/lib/db/server";
import { moduleViewDenial, requireModuleView } from "@/lib/studio/rbac-guard";
import { listShipments, type ShipmentListRow } from "@/lib/studio/shipment-queries";
import { contarAdjuntosDeEmbarques } from "@/lib/studio/documents/adjuntos-queries";
import { conteosPorId } from "@/lib/studio/documents/adjuntos";
import { EmbarquesClient } from "./_components/EmbarquesClient";

export const metadata = { title: "Embarques" };

export default async function EmbarquesPage() {
  await requireModuleView("shipments");

  const supabase = await createClient();
  const shipments = (await listShipments(supabase, {})) as ShipmentListRow[];
  // SDD-0507: cuántos adjuntos tiene cada embarque (internos + portal), con el
  // cliente de sesión. `null` si no se pudo contar: la tabla lo dice.
  // Esta pantalla se abre con `shipments`, pero la RLS de los documentos de un
  // embarque pide `tracking` (migr 0439/0444). Sin `tracking` no ve ninguno, y
  // la columna diría «Ninguno» en todas las filas sin ser cierto: no se cuenta.
  const veAdjuntos = (await moduleViewDenial(supabase, "tracking")) === null;
  const adjuntos = veAdjuntos
    ? conteosPorId(
        await contarAdjuntosDeEmbarques(
          supabase,
          shipments.map((s) => s.id),
        ),
      )
    : undefined;

  return <EmbarquesClient shipments={shipments} adjuntos={adjuntos} />;
}
