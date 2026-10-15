/**
 * Embarques — vista comercial agrupada por cliente.
 *
 * SDD-0012. Server component fetchea todos los shipments del tenant
 * (RLS-filtered) y delega la UI a EmbarquesClient. Los filtros (tabs +
 * search) son client-side para evitar round trips por interacción.
 *
 * SDD-0522: a quien puede eliminar embarques (admin) se le lee además qué
 * bloquea cada uno, con la misma regla que aplica el borrado.
 */

import { createClient } from "@/lib/db/server";
import { getStudioAccess, moduleViewDenial, requireModuleView } from "@/lib/studio/rbac-guard";
import { canSpecial } from "@/lib/studio/rbac";
import { listShipments, type ShipmentListRow } from "@/lib/studio/shipment-queries";
import { contarAdjuntosDeEmbarques } from "@/lib/studio/documents/adjuntos-queries";
import { conteosPorId } from "@/lib/studio/documents/adjuntos";
import { leerInfoEmbarques } from "@/lib/studio/borrado/servidor";
import { EmbarquesClient, type EliminacionEmbarques } from "./_components/EmbarquesClient";

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

  // SDD-0522: sin la capability no se pinta nada de borrar. Si la lectura de
  // bloqueos falla (por ejemplo, sin la 0476), se dice y no se ofrece borrar.
  const { role } = await getStudioAccess(supabase);
  let eliminacion: EliminacionEmbarques | undefined;
  if (canSpecial(role, "delete_shipments")) {
    const info = await leerInfoEmbarques(
      supabase,
      shipments.map((s) => s.id),
    );
    eliminacion = info === null ? { estado: "no_disponible" } : { estado: "lista", info };
  }

  return <EmbarquesClient shipments={shipments} adjuntos={adjuntos} eliminacion={eliminacion} />;
}
