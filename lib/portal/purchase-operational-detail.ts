import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClient } from "@/lib/portal/portal-queries";
import {
  listarRecepcionesDeCompra,
  type ResumenRecepcion,
} from "@/lib/portal/purchase-reception-queries";
import {
  obtenerPackingListDeCompra,
  type PackingListDeCompra,
} from "@/lib/portal/packing-list-queries";
import { getPrealertaByCode } from "@/lib/studio/prealertas/queries";

export type PortalPurchaseOperationalDetail = {
  recepcion: ResumenRecepcion;
  packing: PackingListDeCompra | null;
};

function emptyDetail(): PortalPurchaseOperationalDetail {
  return {
    recepcion: {
      recepciones: [],
      cajasRecibidas: 0,
      cbmTotal: null,
      pesoTotal: null,
      primeraRecepcion: null,
    },
    packing: null,
  };
}

/**
 * Resuelve la parte interna del detalle de compra desde un único dato público:
 * el código. Antes de elevar, deriva el cliente desde auth.uid() y vuelve a leer
 * la compra mediante la sesión/RLS. El caller no entrega ids, tenant, Shipping
 * Mark ni un cliente privilegiado.
 */
export async function getPortalPurchaseOperationalDetail(
  db: SupabaseClient,
  purchaseCode: string,
): Promise<PortalPurchaseOperationalDetail> {
  const code = String(purchaseCode ?? "").trim();
  if (!code) return emptyDetail();

  const client = await getPortalClient(db);
  if (!client) return emptyDetail();

  const prealerta = await getPrealertaByCode(db, code, {
    markbox: client.markbox,
  });
  if (!prealerta) return emptyDetail();

  try {
    const admin = createAdminClient();
    const [recepcion, packing] = await Promise.all([
      listarRecepcionesDeCompra(admin, prealerta.id),
      obtenerPackingListDeCompra(admin, prealerta.id, client.markbox),
    ]);
    return { recepcion, packing };
  } catch {
    return emptyDetail();
  }
}
