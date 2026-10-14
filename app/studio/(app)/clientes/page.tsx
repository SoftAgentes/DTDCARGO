/**
 * Clientes — catálogo comercial con MARKBOX.
 *
 * SDD-0010. Reemplaza el placeholder.
 *
 * Server component que fetchea clientes con filtros desde searchParams y
 * delega la UI interactiva (drawer crear/editar) al ClientsClient.
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import {
  listClientsPage,
  parseClientFiltersFromSearchParams,
} from "@/lib/studio/client-queries";
import { ClientsClient } from "./_components/ClientsClient";
import { listAliadoOptions } from "@/lib/studio/aliados/aliado-queries";
import { contarAdjuntosDeClientes } from "@/lib/studio/documents/adjuntos-queries";
import { conteosPorId } from "@/lib/studio/documents/adjuntos";

export const metadata = { title: "Clientes" };

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // RBAC: gate de vista por rol (SDD-0085). clients = [commercial, operations,
  // accounting, support]; el resto (ej. warehouse) se redirige fail-closed.
  await requireModuleView("clients");

  const rawParams = await searchParams;
  const filters = parseClientFiltersFromSearchParams(rawParams);

  const supabase = await createClient();
  // SDD-0265: el listado necesita saber cuántos hay en total, no sólo los que
  // caben en la página. Sin eso la pantalla mentía por omisión.
  const { clients, total, limite, topeAlcanzado } = await listClientsPage(
    supabase,
    filters,
  );
  // SDD-0255: los aliados alimentan el selector "Pertenece a" del alta. Un
  // cliente creado bajo un aliado recibe la insignia de ese aliado, no DTD-.
  // SDD-0507: cuántos adjuntos tiene cada fila (su ficha + sus embarques), con
  // el cliente de sesión: lo que la RLS no le muestra no se cuenta. `null` si
  // no se pudo contar; la tabla lo dice en vez de pintar «Ninguno».
  const [aliados, adjuntos] = await Promise.all([
    listAliadoOptions(supabase),
    contarAdjuntosDeClientes(
      supabase,
      clients.map((c) => ({ id: c.id, markbox: c.markbox })),
    ),
  ]);

  return (
    <ClientsClient
      clients={clients}
      total={total}
      limite={limite}
      topeAlcanzado={topeAlcanzado}
      filters={filters}
      aliados={aliados}
      adjuntos={conteosPorId(adjuntos)}
    />
  );
}
