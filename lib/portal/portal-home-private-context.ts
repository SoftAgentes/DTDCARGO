import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import { getNextOpenSailing } from "@/lib/portal/next-sailing-queries";
import { listPendingAcceptanceInvoices } from "@/lib/portal/portal-legal-queries";
import {
  getDashboardKpis,
  getNextArrival,
  getPortalActivation,
  getPortalAdvisor,
  getPortalClientPrincipal,
  getProfileCompleteness,
  listMyShipments,
  type PortalClientPrincipal,
} from "@/lib/portal/portal-queries";
import { listMyRecentActivity } from "@/lib/portal/shipment-events-queries";
import { getHiddenPortalStatusesForPortal } from "@/lib/studio/notifications/portal-visibility-queries";
import { getShipmentNaviera } from "@/lib/studio/naviera-tracking/queries";

type PortalClient = PortalClientPrincipal["client"];
type DashboardKpis = Awaited<ReturnType<typeof getDashboardKpis>>;
type NextArrival = Awaited<ReturnType<typeof getNextArrival>>;
type Shipments = Awaited<ReturnType<typeof listMyShipments>>;
type Profile = Awaited<ReturnType<typeof getProfileCompleteness>>;
type Activity = Awaited<ReturnType<typeof listMyRecentActivity>>;
type HiddenStatuses = Awaited<ReturnType<typeof getHiddenPortalStatusesForPortal>>;
type Advisor = Awaited<ReturnType<typeof getPortalAdvisor>>;
type PendingAcceptance = Awaited<ReturnType<typeof listPendingAcceptanceInvoices>>;
type NextArrivalNaviera = Awaited<ReturnType<typeof getShipmentNaviera>>;
type Sailing = Awaited<ReturnType<typeof getNextOpenSailing>>;

type ActiveSessionContext = {
  client: PortalClient;
  kpis: DashboardKpis;
  rawNextArrival: NextArrival;
  rawShipments: Shipments;
  profile: Profile;
  activity: Activity;
  hiddenStatuses: HiddenStatuses;
  advisor: Advisor;
};

type PrivateContext = {
  pendingAcceptance: PendingAcceptance;
  nextArrivalNaviera: NextArrivalNaviera;
  sailing: Sailing;
};

export type PortalHomePrivateContext =
  | { state: "pending"; client: PortalClient }
  | ({ state: "active" } & ActiveSessionContext & PrivateContext);

function emptyPrivateContext(): PrivateContext {
  return {
    pendingAcceptance: [],
    nextArrivalNaviera: null,
    sailing: null,
  };
}

async function loadPrivateContext(
  client: PortalClient,
  tenantId: string,
  nextArrival: NextArrival,
): Promise<PrivateContext> {
  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch {
    return emptyPrivateContext();
  }

  const nextArrivalNaviera = nextArrival
    ? await getShipmentNaviera(admin, nextArrival.id).catch(() => null)
    : null;

  const todayIso = new Date().toISOString().slice(0, 10);
  const [pendingAcceptance, sailing] = await Promise.all([
    listPendingAcceptanceInvoices(admin, {
      tenantId,
      markbox: client.markbox,
    }).catch(() => [] as PendingAcceptance),
    getNextOpenSailing(admin, tenantId, todayIso).catch(() => null),
  ]);

  return { pendingAcceptance, nextArrivalNaviera, sailing };
}

/**
 * Encapsula el home sin aceptar ids, tenant o Shipping Mark desde el RSC. La
 * identidad y todos los ids que llegan al único admin se derivan primero desde
 * la sesión/RLS. La cuenta pendiente evita por completo las lecturas privadas.
 */
export async function getPortalHomePrivateContext(
  db: SupabaseClient,
): Promise<PortalHomePrivateContext | null> {
  const principal = await getPortalClientPrincipal(db);
  if (!principal) return null;
  const { client, tenantId } = principal;

  const activation = await getPortalActivation(db);
  if (!activation.activated) return { state: "pending", client };

  const [
    kpis,
    rawNextArrival,
    rawShipments,
    profile,
    activity,
    hiddenStatuses,
    advisor,
  ] = await Promise.all([
    getDashboardKpis(db),
    getNextArrival(db),
    listMyShipments(db),
    getProfileCompleteness(db),
    listMyRecentActivity(db),
    getHiddenPortalStatusesForPortal(db),
    getPortalAdvisor(db).catch(() => null),
  ]);
  const sessionContext = {
    client,
    kpis,
    rawNextArrival,
    rawShipments,
    profile,
    activity,
    hiddenStatuses,
    advisor,
  };
  const privateContext = await loadPrivateContext(client, tenantId, rawNextArrival);

  return { state: "active", ...sessionContext, ...privateContext };
}
