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
  listClients,
  parseClientFiltersFromSearchParams,
} from "@/lib/studio/client-queries";
import { ClientsClient } from "./_components/ClientsClient";

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
  const clients = await listClients(supabase, filters);

  return <ClientsClient clients={clients} filters={filters} />;
}
