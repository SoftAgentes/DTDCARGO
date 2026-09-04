import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { jetbrainsMonoUi } from "@/lib/fonts";
import { createClient } from "@/lib/db/server";
import { getProfileCompleteness } from "@/lib/portal/portal-queries";
import { isPortalClubMember } from "@/lib/portal/portal-club-queries";
import { getPortalShellPrivateContext } from "@/lib/portal/portal-shell-private-context";
import { showNortePortal } from "@/lib/portal/demo";
import { PortalShell } from "../_components/PortalShell";
import { PortalCalcFab } from "../_components/PortalCalcFab";
import { PortalPushRegister } from "../_components/PortalPushRegister";

// JetBrains Mono scoped al área autenticada del portal (codes: MARKBOX,
// tracking): el wrapper monta --font-jetbrains-mono con la instancia única
// de lib/fonts.ts. El layout público no la carga.

/**
 * Layout autenticado del portal (SDD-0042 Fase 1b).
 *
 * Guard: la fachada privada resuelve el principal Portal coherente con la
 * sesión antes de cualquier lectura elevada; null redirige al login.
 */
export default async function PortalAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const privateContext = await getPortalShellPrivateContext(supabase);
  if (!privateContext) redirect("/entrar");
  const { client, soporteLastReplyAt, sailing, sailingDaysToCutoff } = privateContext;

  // Dark mode + rediseño Norte del portal (founder 2026-06-20). `showNortePortal`
  // decide quién lo ve: con NORTE_PORTAL_LIVE=true es TODO cliente (formalizado); si
  // no, sólo el demo. El tema nace en OSCURO y persiste por la cookie `portal-theme`
  // (la setea el toggle; la lee acá → sin flash en SSR).
  const norte = showNortePortal(client.markbox);
  const cookieTheme = (await cookies()).get("portal-theme")?.value;
  const theme: "dark" | "light" = cookieTheme === "light" ? "light" : "dark";

  // Club en el nav: oculto por defecto (founder 2026-07-01) — solo si el cliente
  // está habilitado (hoy = es miembro del Club). Config por tenant llega con el
  // admin del Club más adelante.
  const showClub = await isPortalClubMember(supabase);

  // Perfil incompleto → la topbar muestra la píldora "Falta completar datos"
  // (Norte). Best-effort: si falla, no la mostramos (no bloquea el portal).
  const profile = await getProfileCompleteness(supabase).catch(() => null);

  // Próximo zarpe abierto (SDD-0133) → píldora "Próxima salida" de la topbar.
  // Admin client scopeado por tenant (el cliente no tiene RLS sobre `sailings`).
  return (
    <div
      id="portal-shell"
      data-portal-theme={norte ? theme : undefined}
      className={`${jetbrainsMonoUi.variable} min-h-screen bg-paper`}
    >
      {/* Armazón del Norte: barra lateral navy + topbar + contenido + pie. */}
      <PortalShell
        markbox={client.markbox}
        name={client.name}
        themed={norte}
        theme={theme}
        showClub={showClub}
        soporteLastReplyAt={soporteLastReplyAt}
        profileComplete={profile?.complete ?? true}
        sailing={sailing}
        sailingDaysToCutoff={sailingDaysToCutoff}
      >
        {children}
      </PortalShell>
      {/* Calculadora flotante (Norte) — siempre a mano, sin salir del portal. */}
      {norte && <PortalCalcFab />}
      {/* Registra el SW para Web Push al cliente (SDD-0148 #3b). */}
      <PortalPushRegister />
    </div>
  );
}
