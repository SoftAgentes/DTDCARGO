import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import { getConsolidationsForShipments } from "@/lib/portal/consolidation-queries";
import { getNextOpenSailing } from "@/lib/portal/next-sailing-queries";
import { prealertasConPackingList } from "@/lib/portal/packing-list-queries";
import {
  getPortalClientPrincipal,
  listMyShipments,
  type PortalClientPrincipal,
} from "@/lib/portal/portal-queries";
import { getHiddenPortalStatusesForPortal } from "@/lib/studio/notifications/portal-visibility-queries";
import {
  listPrealertaDocumentPresence,
  listPrealertas,
  listSuppliers,
} from "@/lib/studio/prealertas/queries";

type PortalClient = PortalClientPrincipal["client"];
type Shipments = Awaited<ReturnType<typeof listMyShipments>>;
type Prealertas = Awaited<ReturnType<typeof listPrealertas>>;
type Suppliers = Awaited<ReturnType<typeof listSuppliers>>;
type HiddenStatuses = Awaited<ReturnType<typeof getHiddenPortalStatusesForPortal>>;
type DocumentEntries = Awaited<ReturnType<typeof listPrealertaDocumentPresence>>;
type Consolidations = Awaited<ReturnType<typeof getConsolidationsForShipments>>;
type Sailing = Awaited<ReturnType<typeof getNextOpenSailing>>;

export type PortalShipmentsHubPrivateContext = {
  client: PortalClient;
  rawShipments: Shipments;
  prealertas: Prealertas;
  suppliers: Suppliers;
  hiddenStatuses: HiddenStatuses;
  docEntries: DocumentEntries;
  conPackingOnline: Set<string>;
  consolidations: Consolidations;
  sailing: Sailing;
};

async function loadNextSailing(
  admin: SupabaseClient,
  tenantId: string,
): Promise<Sailing> {
  try {
    return await getNextOpenSailing(
      admin,
      tenantId,
      new Date().toISOString().slice(0, 10),
    );
  } catch {
    return null;
  }
}

/**
 * Resuelve el hub sin aceptar ids o Shipping Marks desde el RSC. Primero deriva
 * cliente, envíos y compras con la sesión; después usa un único admin para los
 * conjuntos exactos ya autorizados.
 */
export async function getPortalShipmentsHubPrivateContext(
  db: SupabaseClient,
): Promise<PortalShipmentsHubPrivateContext | null> {
  const principal = await getPortalClientPrincipal(db);
  if (!principal) return null;
  const { client, tenantId } = principal;

  const [rawShipments, prealertas, suppliers, hiddenStatuses] = await Promise.all([
    listMyShipments(db).catch(() => [] as Shipments),
    listPrealertas(db, { tenantId, markbox: client.markbox }).catch(
      () => [] as Prealertas,
    ),
    listSuppliers(db, { tenantId, markbox: client.markbox }).catch(
      () => [] as Suppliers,
    ),
    getHiddenPortalStatusesForPortal(db).catch(
      () => new Set() as HiddenStatuses,
    ),
  ]);
  const prealertaIds = prealertas
    .filter((prealerta) => !prealerta.shipment_id && prealerta.status !== "cancelada")
    .map((prealerta) => prealerta.id);
  const shipmentIds = rawShipments.map((shipment) => shipment.id);
  const docEntries = await listPrealertaDocumentPresence(db, {
    prealertaIds,
    tenantId,
    markbox: client.markbox,
  }).catch(() => [] as DocumentEntries);

  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch {
    return {
      client,
      rawShipments,
      prealertas,
      suppliers,
      hiddenStatuses,
      docEntries,
      conPackingOnline: new Set(),
      consolidations: {} as Consolidations,
      sailing: null,
    };
  }

  const [conPackingOnline, consolidations, sailing] = await Promise.all([
    prealertasConPackingList(admin, prealertaIds, client.markbox).catch(
      () => new Set<string>(),
    ),
    getConsolidationsForShipments(admin, shipmentIds).catch(
      () => ({} as Consolidations),
    ),
    loadNextSailing(admin, tenantId),
  ]);

  return {
    client,
    rawShipments,
    prealertas,
    suppliers,
    hiddenStatuses,
    docEntries,
    conPackingOnline,
    consolidations,
    sailing,
  };
}
