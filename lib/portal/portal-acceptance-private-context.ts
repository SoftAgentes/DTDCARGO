import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import {
  getPendingAcceptanceInvoice,
  latestOrderAcceptanceDocs,
} from "@/lib/portal/portal-legal-queries";
import { getPortalClient } from "@/lib/portal/portal-queries";
import { currentClientDocs } from "@/lib/studio/legal/queries";

type Order = NonNullable<
  Awaited<ReturnType<typeof getPendingAcceptanceInvoice>>
>;
type Documents = Awaited<ReturnType<typeof currentClientDocs>>;
type PreviousDocuments = Awaited<ReturnType<typeof latestOrderAcceptanceDocs>>;

export type PortalAcceptancePrivateContext =
  | { state: "unauthenticated" }
  | { state: "unavailable" }
  | {
      state: "ready";
      order: Order;
      docs: Documents;
      previousDocs: PreviousDocuments;
    };

async function getTenantId(
  admin: SupabaseClient,
  clientId: string,
): Promise<string> {
  try {
    const { data } = await admin
      .from("clients")
      .select("tenant_id")
      .eq("id", clientId)
      .maybeSingle<{ tenant_id: string }>();
    return String(data?.tenant_id ?? "").trim();
  } catch {
    return "";
  }
}

/**
 * Resuelve la lectura legal sin aceptar tenant, client id ni Shipping Mark del
 * RSC. El único dato externo es el código de factura; identidad y scopes salen
 * de la sesión antes de consultar borradores ocultos con service_role.
 */
export async function getPortalAcceptancePrivateContext(
  db: SupabaseClient,
  code: string,
): Promise<PortalAcceptancePrivateContext> {
  const invoiceCode = String(code ?? "").trim();
  const client = await getPortalClient(db);
  if (!client) return { state: "unauthenticated" };
  if (!invoiceCode) return { state: "unavailable" };

  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch {
    return { state: "unavailable" };
  }

  const tenantId = await getTenantId(admin, client.id);
  if (!tenantId) return { state: "unavailable" };

  const order = await getPendingAcceptanceInvoice(admin, {
    tenantId,
    markbox: client.markbox,
    code: invoiceCode,
  }).catch(() => null);
  if (!order) return { state: "unavailable" };

  try {
    const docs = await currentClientDocs(admin, tenantId);
    const previousDocs = await latestOrderAcceptanceDocs(admin, {
      tenantId,
      markbox: client.markbox,
      orderRef: order.shipmentCode ?? order.code,
    });
    return { state: "ready", order, docs, previousDocs };
  } catch {
    return { state: "unavailable" };
  }
}
