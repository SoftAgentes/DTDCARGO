import { redirect } from "next/navigation";
import { jetbrainsMonoUi } from "@/lib/fonts";
import { createClient } from "@/lib/db/server";
import { getPortalClient } from "@/lib/portal/portal-queries";
import { PortalHeader } from "../_components/PortalHeader";

// JetBrains Mono scoped al área autenticada del portal (codes: MARKBOX,
// tracking): el wrapper monta --font-jetbrains-mono con la instancia única
// de lib/fonts.ts. El layout público no la carga.

/**
 * Layout autenticado del portal (SDD-0042 Fase 1b).
 *
 * Guard: `getPortalClient()` resuelve el cliente vía la helper aislada
 * `get_portal_client_id()` — null si no hay sesión vinculada (incluye a un user
 * de equipo del Studio, que NO tiene row en client_users) → redirect al login.
 */
export default async function PortalAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const client = await getPortalClient(supabase);
  if (!client) redirect("/portal/login");

  return (
    <div className={`${jetbrainsMonoUi.variable} min-h-screen bg-paper flex flex-col`}>
      <PortalHeader markbox={client.markbox} name={client.name} />
      <main className="flex-1 wrap w-full py-10 lg:py-14">{children}</main>
    </div>
  );
}
