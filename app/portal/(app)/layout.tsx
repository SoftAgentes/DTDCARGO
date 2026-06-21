import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { jetbrainsMonoUi } from "@/lib/fonts";
import { createClient } from "@/lib/db/server";
import { getPortalClient } from "@/lib/portal/portal-queries";
import { showNortePortal } from "@/lib/portal/demo";
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

  // Dark mode + rediseño Norte del portal (founder 2026-06-20). `showNortePortal`
  // decide quién lo ve: con NORTE_PORTAL_LIVE=true es TODO cliente (formalizado); si
  // no, sólo el demo. El tema nace en OSCURO y persiste por la cookie `portal-theme`
  // (la setea el toggle; la lee acá → sin flash en SSR).
  const norte = showNortePortal(client.markbox);
  const cookieTheme = (await cookies()).get("portal-theme")?.value;
  const theme: "dark" | "light" = cookieTheme === "light" ? "light" : "dark";

  return (
    <div
      id="portal-shell"
      data-portal-theme={norte ? theme : undefined}
      className={`${jetbrainsMonoUi.variable} min-h-screen bg-paper flex flex-col`}
    >
      <PortalHeader
        markbox={client.markbox}
        name={client.name}
        themed={norte}
        theme={theme}
      />
      <main className="flex-1 wrap w-full py-10 lg:py-14">{children}</main>
    </div>
  );
}
