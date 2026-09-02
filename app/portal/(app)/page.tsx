import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { daysUntil } from "@/lib/portal/next-sailing-queries";
import { getPortalHomePrivateContext } from "@/lib/portal/portal-home-private-context";
import { effectiveVisibleStatus } from "@/lib/portal/portal-types";
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
 * sesión del portal (redirect al login si null); acá `client` es defensa extra.
 */
export default async function PortalHomePage() {
  const supabase = await createClient();
  const context = await getPortalHomePrivateContext(supabase);
  if (!context) return null;
  if (context.state === "pending") {
    return <PortalPending name={context.client.name} markbox={context.client.markbox} />;
  }
  const {
    client,
    kpis,
    rawNextArrival,
    rawShipments,
    profile,
    activity,
    hiddenStatuses,
    pendingAcceptance,
    nextArrivalNaviera,
    sailing,
    advisor,
  } = context;

  // SDD-0156 · Slice D: si la config del tenant oculta un hito (ej. "en aduana"),
  // el dashboard muestra el último estado VISIBLE — el héroe y los badges no
  // delatan el hito oculto. Falla-seguro → sin sustitución.
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

  const todayIso = new Date().toISOString().slice(0, 10);
  const sailingDaysToCutoff = sailing ? daysUntil(sailing.cutoff, todayIso) : null;

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
      */}
      <PortalPushOptIn
        titulo="Entérate apenas se mueva tu carga"
        descripcion="Activa las notificaciones y tu navegador te avisa cuando tu mercancía llega a bodega, cuando zarpa y cuando está por entregarse — aunque no tengas el portal abierto."
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
