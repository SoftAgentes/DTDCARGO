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
 *
 * SDD-0531 · al equipo de China (región cn, no admin) no se le manda la lista:
 * son hasta 500 nombres de clientes. Trabaja con el Shipping Mark y el server
 * completa el nombre al crear el envío.
 */

import { createClient } from "@/lib/db/server";
import { readCanSeeClientNames } from "@/lib/studio/privacidad-cn";
import { CreateShipmentForm } from "./_components/CreateShipmentForm";

export const metadata = {
  title: "Nuevo envío",
};

async function fetchExistingClients(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string[]> {
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
  const supabase = await createClient();
  const puedeVerNombres = await readCanSeeClientNames(supabase);
  const existingClients = puedeVerNombres
    ? await fetchExistingClients(supabase)
    : [];
  return (
    <CreateShipmentForm
      existingClients={existingClients}
      nombresOcultos={!puedeVerNombres}
    />
  );
}
