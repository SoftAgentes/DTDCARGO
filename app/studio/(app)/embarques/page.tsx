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
 * SDD-0661: las cajas salen con los contenedores; las cajas recibidas, de la
 * recepción VE de cada contenedor (para todos). Por cobrar y cobrado sólo se
 * lee si la persona ve Facturación (módulo de dinero `invoices`): si no, no se
 * consulta y la prop no existe, así no viaja al navegador.
 *
 * SDD-0674 · EXC-0674: a accounting y admin (los que ya ven montos) se les lee además qué
 * contenedores están en la lista transitoria (hoy solo el 64) y qué clientes ya se facturaron ahí.
 * Los demás roles, operations incluido, no reciben la prop (Sam, 2026-11-18).
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
  leerRecibidasDeContenedores,
} from "@/lib/studio/embarques-contenedores-queries";
import type { MontosDeContenedores } from "@/lib/studio/embarques-contenedores";
import { leerCajasPorProveedor } from "@/lib/studio/cajas-por-proveedor-queries";
import { rolFacturaExc0674, type FacturacionExc0674 } from "@/lib/studio/exc0674";
import { leerFacturacionExc0674 } from "@/lib/studio/exc0674-queries";
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
  // SDD-0711: cajas y CBM por proveedor para el panel de detalle (una lectura, sin migración).
  const [contenedores, cajasPorEnvio, adjuntos] = await Promise.all([
    leerContenedoresDeEmbarques(supabase, ids),
    leerCajasPorProveedor(supabase, ids),
    (async () => {
      const veAdjuntos = (await moduleViewDenial(supabase, "tracking")) === null;
      return veAdjuntos ? conteosPorId(await contarAdjuntosDeEmbarques(supabase, ids)) : undefined;
    })(),
  ]);

  // SDD-0661: el monto es dinero. Se decide aquí, en el servidor; sin permiso no
  // se lee `invoices` y la prop no existe. Hacen falta las DOS cosas:
  //  - la puerta de Facturación (`moduleViewDenial(…, "invoices")`), y
  //  - el rol que deja leer la tabla: `invoices_accounting_select` (0414) sólo
  //    abre el SELECT a accounting y admin. Un acceso extra de la SDD-0622 pasa
  //    la puerta pero no la RLS: leería cero facturas y diría «Sin facturar»
  //    sin ser cierto. Por eso no se le muestra dinero.
  // Las cajas recibidas (recepción VE) son carga, no dinero: para todos.
  const { role } = await getStudioAccess(supabase);
  const rolLeeFacturas = role === "accounting" || role === "admin";
  // SDD-0674: la puerta de Facturación decide también «Facturar». Una sola consulta para las dos.
  const veFacturacion =
    (rolLeeFacturas || rolFacturaExc0674(role)) && (await moduleViewDenial(supabase, "invoices")) === null;
  let montos: MontosDeContenedores | undefined;
  let facturacion: FacturacionExc0674 | undefined;
  if (contenedores) {
    const [recibidas, leidos, exc0674] = await Promise.all([
      leerRecibidasDeContenedores(supabase, contenedores.contenedores),
      rolLeeFacturas && veFacturacion ? leerMontosDeContenedores(supabase, contenedores) : undefined,
      rolFacturaExc0674(role) && veFacturacion
        ? leerFacturacionExc0674(supabase, contenedores.contenedores.map((c) => c.id))
        : undefined,
    ]);
    if (recibidas) contenedores.recibidasPorContenedor = recibidas;
    montos = leidos;
    facturacion = exc0674;
  }

  // SDD-0522: sin la capability no se pinta nada de borrar. Si la lectura de
  // bloqueos falla (por ejemplo, sin la 0476), se dice y no se ofrece borrar.
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
      cajasPorEnvio={cajasPorEnvio}
      {...(montos ? { montos } : {})}
      {...(facturacion ? { facturacion } : {})}
      tope={shipments.length >= TOPE_EMBARQUES ? TOPE_EMBARQUES : undefined}
    />
  );
}
