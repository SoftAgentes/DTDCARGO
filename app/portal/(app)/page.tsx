import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  getPortalClientPrincipal,
  getPortalActivation,
  getProfileCompleteness,
  getDashboardKpis,
  getNextArrival,
  getPortalAdvisor,
  listMyShipments,
} from "@/lib/portal/portal-queries";
import { loadPendingAcceptanceForClient } from "@/lib/portal/pending-acceptance";
import { listMyRecentActivity } from "@/lib/portal/shipment-events-queries";
import {
  getNextOpenSailing,
  daysUntil,
  type PortalSailing,
} from "@/lib/portal/next-sailing-queries";
import { getShipmentNaviera } from "@/lib/studio/naviera-tracking/queries";
import type { NavieraSnapshot } from "@/lib/studio/naviera-tracking/types";
import { effectiveVisibleStatus } from "@/lib/portal/portal-types";
import { getHiddenPortalStatusesForPortal } from "@/lib/studio/notifications/portal-visibility-queries";
import { TRACKING_EN_CONSTRUCCION } from "@/lib/portal/tracking-en-construccion";
import { PortalPending } from "../_components/PortalPending";
import { PortalDashboardNorte } from "./_components/PortalDashboardNorte";
import { PendingAcceptanceCard } from "./_components/PendingAcceptanceCard";
import { ProfileIncompleteCard } from "./_components/ProfileIncompleteCard";
import { PortalAdvisorCard } from "./_components/PortalAdvisorCard";
import { PortalPushOptIn } from "../_components/PortalPushOptIn";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Inicio del portal (SDD-0042 · Fase 5 · Norte PortalHome).
 *
 * Gate de activación (5.1): si la cuenta NO está activada (ni aprobada por asesor
 * ni con ≥1 envío) → pantalla de espera `<PortalPending>`. Si está activada →
 * dashboard `<PortalDashboardNorte>` (5.2). El layout `(app)` ya garantizó la
 * sesión del portal (redirect al login si null); acá el principal es defensa extra.
 *
 * SDD-0552: tenant y Shipping Mark salen del principal de sesión
 * (`getPortalClientPrincipal`). Las lecturas con el admin client (órdenes por
 * aceptar, próximo zarpe) ya no releen `clients.tenant_id`.
 */
export default async function PortalHomePage() {
  const supabase = await createClient();

  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return null;
  const { client } = principal;

  const activation = await getPortalActivation(supabase);
  if (!activation.activated) {
    return <PortalPending name={client.name} markbox={client.markbox} />;
  }

  const [kpis, rawNextArrival, rawShipments, profile, activity] = await Promise.all([
    getDashboardKpis(supabase),
    getNextArrival(supabase),
    listMyShipments(supabase),
    getProfileCompleteness(supabase),
    listMyRecentActivity(supabase),
  ]);

  // SDD-0156 · Slice D: si la config del tenant oculta un hito (ej. "en aduana"),
  // el dashboard muestra el último estado VISIBLE — el héroe y los badges no
  // delatan el hito oculto. Falla-seguro → sin sustitución.
  const hiddenStatuses = await getHiddenPortalStatusesForPortal(supabase);
  const shipments = rawShipments.map((s) => ({
    ...s,
    status: effectiveVisibleStatus(s.status, s.service, hiddenStatuses),
  }));
  const nextArrival = rawNextArrival
    ? {
        ...rawNextArrival,
        status: effectiveVisibleStatus(
          rawNextArrival.status,
          rawNextArrival.service,
          hiddenStatuses,
        ),
      }
    : rawNextArrival;

  // Órdenes DDP en borrador esperando aceptación de T&C (SDD-0054 · Slice C). El
  // portal OCULTA los borradores → se leen con el admin client, scopeado EXPLÍCITO
  // por el tenant + markbox del principal (mismo loader que «Mis facturas»,
  // SDD-0549). Best-effort: un fallo devuelve [] y la portada sigue.
  const pendingAcceptance = await loadPendingAcceptanceForClient(principal);

  // Snapshot naviero del próximo arribo (SDD-0101 · Tier 1) — admin client (el
  // cliente del portal no tiene RLS sobre sailings/consolidations), scopeado al
  // envío. El héroe muestra el buque real cuando existe. Best-effort → null no rompe.
  let nextArrivalNaviera: NavieraSnapshot | null = null;
  if (nextArrival) {
    try {
      nextArrivalNaviera = await getShipmentNaviera(createAdminClient(), nextArrival.id);
    } catch {
      nextArrivalNaviera = null;
    }
  }

  // Próximo zarpe abierto (SDD-0133): calendario/cut-off del portal. Admin client
  // scopeado por el tenant del principal (el cliente no tiene RLS sobre
  // `sailings`). Best-effort → null no rompe; la card se oculta si no hay salida
  // publicada.
  let sailing: PortalSailing | null = null;
  const todayIso = new Date().toISOString().slice(0, 10);
  try {
    sailing = await getNextOpenSailing(createAdminClient(), principal.tenantId, todayIso);
  } catch {
    sailing = null;
  }
  const sailingDaysToCutoff = sailing ? daysUntil(sailing.cutoff, todayIso) : null;

  // Asesor asignado (card "Tu asesor" del Norte). La RPC deriva el cliente por
  // auth.uid(), verifica la membresía activa y devuelve sólo el perfil asignado.
  // Best-effort: si falla, la card cae al contacto público (nunca inventa nombre).
  const advisor = await getPortalAdvisor(supabase).catch(() => null);

  return (
    <div className="flex flex-col gap-7">
      {pendingAcceptance.length > 0 ? (
        <PendingAcceptanceCard pending={pendingAcceptance} />
      ) : null}
      {!profile.complete ? (
        <ProfileIncompleteCard
          hasPhoto={profile.hasPhoto}
          hasAddress={profile.hasAddress}
        />
      ) : null}

      {/*
        Medido el 2026-08-24: de 115 clientes con portal, sólo 4 tenían las
        notificaciones activadas — un 3,5%. La causa no era que las rechazaran:
        el botón vivía ÚNICAMENTE en `/portal/soporte`, una pantalla a la que casi
        nadie entra. Acá está donde el cliente sí pasa.

        No es un prompt: es un botón. El permiso del navegador se pide recién al
        hacer clic, y eso importa porque es de un solo tiro — si el cliente lo
        niega queda negado y recuperarlo exige que entre a la configuración del
        sitio. Por eso NO se dispara solo al cargar.

        Tampoco lleva "descartar" a propósito: la tarjeta desaparece sola cuando
        el cliente activa (o cuando el navegador no soporta push, o cuando ya
        negó el permiso — el componente decide eso por su cuenta). Un botón de
        descartar guardado en localStorage es justo la forma en que estas
        tarjetas se apagan para siempre sin que nadie se entere.

        SDD-0516 · mientras el seguimiento esté en construcción (SDD-0514), la
        tarjeta no promete el aviso de llegada a bodega: sólo se programa cuando
        la recepción se registra en el sistema, y la bodega de China todavía
        registra en Excel. Zarpe y entrega se conservan porque los disparan
        operaciones del Studio, no la bodega. Apagado, vuelve el texto de siempre.
      */}
      <PortalPushOptIn
        titulo="Entérate apenas se mueva tu carga"
        descripcion={
          TRACKING_EN_CONSTRUCCION
            ? "Activa las notificaciones y tu navegador te avisa cuando tu carga zarpa y cuando está por entregarse — aunque no tengas el portal abierto."
            : "Activa las notificaciones y tu navegador te avisa cuando tu mercancía llega a bodega, cuando zarpa y cuando está por entregarse — aunque no tengas el portal abierto."
        }
        tituloActivo="Notificaciones activadas"
        descripcionActiva="Te avisamos apenas tu carga se mueva."
      />
      <PortalDashboardNorte
        client={client}
        kpis={kpis}
        nextArrival={nextArrival}
        nextArrivalNaviera={nextArrivalNaviera}
        shipments={shipments}
        activity={activity}
        sailing={sailing}
        sailingDaysToCutoff={sailingDaysToCutoff}
        advisorCard={<PortalAdvisorCard client={client} advisor={advisor} />}
      />
    </div>
  );
}
