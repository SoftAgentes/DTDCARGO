/**
 * Form de creacion de envio.
 *
 * Server component que fetchea nombres de clientes ya usados (DISTINCT de
 * client_name en shipments del tenant) para alimentar el autocomplete del
 * form. Cuando llegue el modulo Clientes con su tabla propia, este fetch
 * se cambia por la tabla clients.
 *
 * Despues delega al CreateShipmentForm (client) que tiene toda la logica
 * interactiva.
 */

import { createClient } from "@/lib/db/server";
import { CreateShipmentForm } from "./_components/CreateShipmentForm";

export const metadata = {
  title: "Nuevo envío",
};

async function fetchExistingClients(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shipments")
    .select("client_name")
    .not("client_name", "is", null)
    .order("client_name", { ascending: true })
    .limit(500);

  if (error || !data) return [];

  // DISTINCT del lado del cliente (PostgREST no expone DISTINCT facil)
  const set = new Set<string>();
  for (const row of data) {
    const name = (row as { client_name: string | null }).client_name?.trim();
    if (name) set.add(name);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}

export default async function NuevoEnvioPage() {
  const existingClients = await fetchExistingClients();
  return <CreateShipmentForm existingClients={existingClients} />;
}
