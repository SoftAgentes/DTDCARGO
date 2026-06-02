import { redirect } from "next/navigation";
import { JetBrains_Mono } from "next/font/google";
import { createClient } from "@/lib/db/server";
import { getPortalClient } from "@/lib/portal/portal-queries";
import { PortalHeader } from "../_components/PortalHeader";

/**
 * JetBrains Mono — cargada scoped al área autenticada del portal (codes:
 * MARKBOX, tracking). El layout público no la carga; la aplicamos al wrapper.
 */
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

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
    <div className={`${jetbrainsMono.variable} min-h-screen bg-paper flex flex-col`}>
      <PortalHeader markbox={client.markbox} name={client.name} />
      <main className="flex-1 wrap w-full py-10 lg:py-14">{children}</main>
    </div>
  );
}
