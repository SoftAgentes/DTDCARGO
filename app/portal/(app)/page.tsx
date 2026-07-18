import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  getPortalClient,
  getPortalActivation,
  getProfileCompleteness,
  getDashboardKpis,
  getNextArrival,
  listMyShipments,
} from "@/lib/portal/portal-queries";
import { listPendingAcceptanceInvoices } from "@/lib/portal/portal-legal-queries";
import { listMyRecentActivity } from "@/lib/portal/shipment-events-queries";
import {
  getNextOpenSailing,
  daysUntil,
  type PortalSailing,
} from "@/lib/portal/next-sailing-queries";
import { getShipmentNaviera } from "@/lib/studio/naviera-tracking/queries";
import type { NavieraSnapshot } from "@/lib/studio/naviera-tracking/types";
import { effectiveVisibleStatus } from "@/lib/portal/portal-types";
import { getHiddenPortalStatusesForClient } from "@/lib/studio/notifications/portal-visibility-queries";
import { showNortePortal } from "@/lib/portal/demo";
import { PortalPending } from "../_components/PortalPending";
import { PortalDashboard } from "./_components/PortalDashboard";
import { PortalDashboardNorte } from "./_components/PortalDashboardNorte";
import { PendingAcceptanceCard } from "./_components/PendingAcceptanceCard";
import { ProfileIncompleteCard } from "./_components/ProfileIncompleteCard";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Inicio del portal (SDD-0042 · Fase 5 · Norte PortalHome).
 *
 * Gate de activación (5.1): si la cuenta NO está activada (ni aprobada por asesor
 * ni con ≥1 envío) → pantalla de espera `<PortalPending>`. Si está activada →
 * dashboard `<PortalDashboard>` (5.2). El layout `(app)` ya garantizó la sesión
 * del portal (redirect al login si null); acá `client` es defensa extra.
 */
export default async function PortalHomePage() {
  const supabase = await createClient();

  const client = await getPortalClient(supabase);
  if (!client) return null;

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
  const hiddenStatuses = await getHiddenPortalStatusesForClient(
    createAdminClient(),
    client.id,
  );
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
  // por tenant + markbox (identidad ya resuelta por sesión vía getPortalClient).
  const pendingAcceptance = await loadPendingAcceptance(client.id, client.markbox);

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
  // scopeado por tenant (el cliente no tiene RLS sobre `sailings`). Best-effort →
  // null no rompe; la card se oculta si no hay salida publicada.
  let sailing: PortalSailing | null = null;
  const todayIso = new Date().toISOString().slice(0, 10);
  try {
    const admin = createAdminClient();
    const { data: clientRow } = await admin
      .from("clients")
      .select("tenant_id")
      .eq("id", client.id)
      .maybeSingle<{ tenant_id: string }>();
    const tenantId = String(clientRow?.tenant_id ?? "").trim();
    if (tenantId) {
      sailing = await getNextOpenSailing(admin, tenantId, todayIso);
    }
  } catch {
    sailing = null;
  }
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
      {/* Rediseño Norte (oscuro). `showNortePortal`: todos si NORTE_PORTAL_LIVE, si no el demo. */}
      {showNortePortal(client.markbox) ? (
        <PortalDashboardNorte
          client={client}
          kpis={kpis}
          nextArrival={nextArrival}
          nextArrivalNaviera={nextArrivalNaviera}
          shipments={shipments}
          activity={activity}
          sailing={sailing}
          sailingDaysToCutoff={sailingDaysToCutoff}
        />
      ) : (
        <PortalDashboard
          client={client}
          kpis={kpis}
          nextArrival={nextArrival}
          shipments={shipments}
        />
      )}
    </div>
  );
}

/**
 * Carga las órdenes pendientes de aceptación con el admin client. Resuelve el
 * tenant del cliente (por su id, ya verificado por sesión) y delega en
 * `listPendingAcceptanceInvoices` (que scopea por tenant + markbox). Best-effort:
 * un fallo del admin client no debe romper el dashboard → devuelve [].
 */
async function loadPendingAcceptance(clientId: string, markbox: string) {
  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("clients")
      .select("tenant_id")
      .eq("id", clientId)
      .maybeSingle<{ tenant_id: string }>();
    const tenantId = String(row?.tenant_id ?? "").trim();
    if (!tenantId) return [];
    return await listPendingAcceptanceInvoices(admin, { tenantId, markbox });
  } catch {
    return [];
  }
}
