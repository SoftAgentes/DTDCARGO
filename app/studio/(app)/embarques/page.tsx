/**
 * Embarques — vista comercial por contenedor → cliente → embarque.
 *
 * SDD-0012. Server component fetchea todos los shipments del tenant
 * (RLS-filtered) y delega la UI a EmbarquesClient. Los filtros (tabs +
 * search) son client-side para evitar round trips por interacción.
 *
 * SDD-0522: a quien puede eliminar embarques (admin) se le lee además qué
 * bloquea cada uno, con la misma regla que aplica el borrado.
 *
 * SDD-0643: se lee en qué contenedor va cada embarque (consolidation_items →
 * consolidations → sailings → carriers, con la sesión y su RLS) y la vista
 * empieza por los contenedores. El tope sube a 500 embarques para no cortar
 * un consolidado; si se llega al tope, la vista lo dice.
 *
 * SDD-0661: las cajas salen con los contenedores. El monto a cobrar sólo se
 * lee si la persona ve Facturación (módulo de dinero `invoices`): si no, no se
 * consulta y la prop no existe, así no viaja al navegador.
 */

import { createClient } from "@/lib/db/server";
import { getStudioAccess, moduleViewDenial, requireModuleView } from "@/lib/studio/rbac-guard";
import { canSpecial } from "@/lib/studio/rbac";
import { listShipments, type ShipmentListRow } from "@/lib/studio/shipment-queries";
import { contarAdjuntosDeEmbarques } from "@/lib/studio/documents/adjuntos-queries";
import { conteosPorId } from "@/lib/studio/documents/adjuntos";
import { leerInfoEmbarques } from "@/lib/studio/borrado/servidor";
import {
  leerContenedoresDeEmbarques,
  leerMontosDeContenedores,
} from "@/lib/studio/embarques-contenedores-queries";
import type { MontosDeContenedores } from "@/lib/studio/embarques-contenedores";
import { EmbarquesClient, type EliminacionEmbarques } from "./_components/EmbarquesClient";

export const metadata = { title: "Embarques" };

/** SDD-0643: tope de la lista. Un consolidado trae decenas de embarques. */
const TOPE_EMBARQUES = 500;

export default async function EmbarquesPage() {
  await requireModuleView("shipments");

  const supabase = await createClient();
  const shipments = (await listShipments(supabase, {}, { limit: TOPE_EMBARQUES })) as ShipmentListRow[];
  const ids = shipments.map((s) => s.id);
  // SDD-0507: cuántos adjuntos tiene cada embarque (internos + portal), con el
  // cliente de sesión. `null` si no se pudo contar: la tabla lo dice.
  // Esta pantalla se abre con `shipments`, pero la RLS de los documentos de un
  // embarque pide `tracking` (migr 0439/0444). Sin `tracking` no ve ninguno, y
  // la columna diría «Ninguno» en todas las filas sin ser cierto: no se cuenta.
  // SDD-0643: contenedores y adjuntos se leen a la vez. `contenedores` `null` =
  // no se pudo leer; la vista lo dice y agrupa sólo por cliente.
  const [contenedores, adjuntos] = await Promise.all([
    leerContenedoresDeEmbarques(supabase, ids),
    (async () => {
      const veAdjuntos = (await moduleViewDenial(supabase, "tracking")) === null;
      return veAdjuntos ? conteosPorId(await contarAdjuntosDeEmbarques(supabase, ids)) : undefined;
    })(),
  ]);

  // SDD-0661: el monto es dinero. Se decide aquí, en el servidor, con la misma
  // comprobación que abre Facturación; sin permiso no se lee `invoices`.
  let montos: MontosDeContenedores | undefined;
  if (contenedores && (await moduleViewDenial(supabase, "invoices")) === null) {
    montos = await leerMontosDeContenedores(supabase, contenedores);
  }

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

  return (
    <EmbarquesClient
      shipments={shipments}
      adjuntos={adjuntos}
      eliminacion={eliminacion}
      contenedores={contenedores}
      {...(montos ? { montos } : {})}
      tope={shipments.length >= TOPE_EMBARQUES ? TOPE_EMBARQUES : undefined}
    />
  );
}
