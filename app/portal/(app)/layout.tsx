import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { jetbrainsMonoUi } from "@/lib/fonts";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  getPortalClient,
  getProfileCompleteness,
} from "@/lib/portal/portal-queries";
import { getPortalLastReplyAt } from "@/lib/portal/portal-conversation-queries";
import { isPortalClubMember } from "@/lib/portal/portal-club-queries";
import {
  getNextOpenSailing,
  daysUntil,
  type PortalSailing,
} from "@/lib/portal/next-sailing-queries";
import { showNortePortal } from "@/lib/portal/demo";
import { listMyPortalAvisos } from "@/lib/portal/portal-avisos-queries";
import { PortalShell } from "../_components/PortalShell";
import { PortalCalcFab } from "../_components/PortalCalcFab";
import { PortalPushRegister } from "../_components/PortalPushRegister";
import { PortalMaintenanceNotice } from "../_components/PortalMaintenanceNotice";
import { avisoDeMantenimiento } from "@/lib/runtime/maintenance-notice";

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
  if (!client) redirect("/entrar");

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

  // Badge de Soporte (SDD-0148 #4): timestamp del último mensaje del equipo, para
  // que el nav pinte un punto si hay respuesta nueva. Best-effort (admin) — un
  // fallo no debe tumbar el portal.
  const soporteLastReplyAt = await getPortalLastReplyAt(
    createAdminClient(),
    client.id,
  ).catch(() => null);

  // Perfil incompleto → la topbar muestra la píldora "Falta completar datos"
  // (Norte). Best-effort: si falla, no la mostramos (no bloquea el portal).
  const profile = await getProfileCompleteness(supabase).catch(() => null);

  // Próximo zarpe abierto (SDD-0133) → píldora "Próxima salida" de la topbar.
  // Admin client scopeado por tenant (el cliente no tiene RLS sobre `sailings`).
  const { sailing, sailingDaysToCutoff } = await loadSailing(client.id);

  // Bandeja de avisos de la campana (SDD-0526): los avisos ya enviados al
  // cliente, con su sesión (RPC 0479, frontera de tenant y Shipping Mark en la
  // base). Degrada a lista vacía: nunca tumba el portal.
  const avisos = await listMyPortalAvisos(supabase);

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
        avisos={avisos}
      >
        {/* Mantenimiento programado (SDD-0505): solo con MAINTENANCE_NOTICE_START/END
            y hasta el fin de la ventana; sin variables no pinta nada. */}
        <PortalMaintenanceNotice aviso={avisoDeMantenimiento()} />
        {children}
      </PortalShell>
      {/* Calculadora flotante (Norte) — siempre a mano, sin salir del portal. */}
      {norte && <PortalCalcFab />}
      {/* Registra el SW para Web Push al cliente (SDD-0148 #3b). */}
      <PortalPushRegister />
    </div>
  );
}

/**
 * Próximo zarpe abierto del tenant del cliente. Best-effort: cualquier fallo
 * devuelve null → la píldora simplemente no aparece.
 */
async function loadSailing(clientId: string): Promise<{
  sailing: PortalSailing | null;
  sailingDaysToCutoff: number | null;
}> {
  const todayIso = new Date().toISOString().slice(0, 10);
  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("clients")
      .select("tenant_id")
      .eq("id", clientId)
      .maybeSingle<{ tenant_id: string }>();
    const tenantId = String(row?.tenant_id ?? "").trim();
    if (!tenantId) return { sailing: null, sailingDaysToCutoff: null };
    const sailing = await getNextOpenSailing(admin, tenantId, todayIso);
    return {
      sailing,
      sailingDaysToCutoff: sailing ? daysUntil(sailing.cutoff, todayIso) : null,
    };
  } catch {
    return { sailing: null, sailingDaysToCutoff: null };
  }
}
