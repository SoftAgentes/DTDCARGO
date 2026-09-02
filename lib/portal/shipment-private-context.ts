import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import { showShipmentAcceptanceCta } from "@/lib/portal/demo";
import {
  getPendingAcceptanceForShipment,
  type PendingAcceptanceInvoice,
} from "@/lib/portal/portal-legal-queries";
import { getMyShipment, getPortalClient } from "@/lib/portal/portal-queries";
import {
  listShipmentNotificationHistory,
  type PortalNotificationHistoryItem,
} from "@/lib/studio/notifications/notification-history-queries";
import {
  getShipmentNaviera,
  getShipmentTrackingSnapshot,
} from "@/lib/studio/naviera-tracking/queries";
import type { NavieraSnapshot } from "@/lib/studio/naviera-tracking/types";
import type { TrackingSnapshotRow } from "@/lib/studio/naviera-tracking/snapshot-queries";
import {
  listShipmentDocuments,
  signDocumentUrls,
} from "@/lib/studio/shipment-document-queries";
import type { ShipmentDocument } from "@/lib/studio/shipment-document-types";

type PortalShipment = NonNullable<Awaited<ReturnType<typeof getMyShipment>>>;
type PortalClient = NonNullable<Awaited<ReturnType<typeof getPortalClient>>>;

export type PortalShipmentPrivateContext = {
  shipment: PortalShipment;
  documents: ShipmentDocument[];
  signedUrls: Record<string, string>;
  naviera: NavieraSnapshot | null;
  live: TrackingSnapshotRow | null;
  notificationHistory: PortalNotificationHistoryItem[];
  pendingAcceptance: PendingAcceptanceInvoice | null;
};

function sessionOnlyContext(
  shipment: PortalShipment,
  documents: ShipmentDocument[],
): PortalShipmentPrivateContext {
  return {
    shipment,
    documents,
    signedUrls: {},
    naviera: null,
    live: null,
    notificationHistory: [],
    pendingAcceptance: null,
  };
}

async function loadPendingAcceptance(
  admin: SupabaseClient,
  client: PortalClient | null,
  shipmentId: string,
): Promise<PendingAcceptanceInvoice | null> {
  if (!client || !showShipmentAcceptanceCta(client.markbox)) return null;
  try {
    const { data: row } = await admin
      .from("clients")
      .select("tenant_id")
      .eq("id", client.id)
      .maybeSingle<{ tenant_id: string }>();
    const tenantId = String(row?.tenant_id ?? "").trim();
    if (!tenantId) return null;
    return await getPendingAcceptanceForShipment(admin, {
      tenantId,
      markbox: client.markbox,
      shipmentId,
    });
  } catch {
    return null;
  }
}

/**
 * Resuelve el contexto privado de un envío usando sólo el código visible. El
 * envío se prueba primero con sesión/RLS; después un único admin queda acotado a
 * ese id para firma, avisos, naviera y aceptación.
 */
export async function getPortalShipmentPrivateContext(
  db: SupabaseClient,
  shipmentCode: string,
): Promise<PortalShipmentPrivateContext | null> {
  const code = String(shipmentCode ?? "").trim();
  if (!code) return null;

  const [shipment, client] = await Promise.all([
    getMyShipment(db, code),
    getPortalClient(db),
  ]);
  if (!shipment) return null;

  const documents = await listShipmentDocuments(db, shipment.id).catch(
    () => [] as ShipmentDocument[],
  );
  const base = sessionOnlyContext(shipment, documents);

  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch {
    return base;
  }

  const [signedUrls, notificationHistory, naviera, live, pendingAcceptance] =
    await Promise.all([
      documents.length > 0
        ? signDocumentUrls(
            admin,
            documents.map((document) => document.storage_path),
          ).catch(() => ({}))
        : Promise.resolve({}),
      listShipmentNotificationHistory(admin, shipment.id).catch(
        () => [] as PortalNotificationHistoryItem[],
      ),
      getShipmentNaviera(admin, shipment.id).catch(() => null),
      getShipmentTrackingSnapshot(admin, shipment.id).catch(() => null),
      loadPendingAcceptance(admin, client, shipment.id),
    ]);

  return {
    ...base,
    signedUrls,
    notificationHistory,
    naviera,
    live,
    pendingAcceptance,
  };
}
