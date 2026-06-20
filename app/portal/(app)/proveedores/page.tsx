import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { getPortalClient } from "@/lib/portal/portal-queries";
import {
  listSuppliers,
  listPrealertas,
  listActivePrealertaAddons,
} from "@/lib/studio/prealertas/queries";
import { summarizeSuppliers } from "@/lib/studio/prealertas/types";
import { SuppliersClient } from "./SuppliersClient";

export const metadata: Metadata = { title: "Tus proveedores" };

/**
 * "Tus proveedores" del Portal (SDD-0057 · Slice B · Norte PortalSuppliers).
 *
 * El cliente registra sus proveedores chinos y, por cada uno, genera el código
 * de la próxima compra (prealerta) + las etiquetas. Cada compra es una prealerta:
 * nos avisa que viene mercancía de China. Re-comprar = una nueva compra al mismo
 * proveedor (incrementa el order_seq del código).
 *
 * Carga server-side: proveedores del cliente + sus compras, las combina con
 * `summarizeSuppliers` (orderCount + próximo código). El layout `(app)` ya
 * garantizó la sesión del portal.
 */
export default async function PortalSuppliersPage() {
  const supabase = await createClient();
  const client = await getPortalClient(supabase);
  if (!client) return null;

  const [suppliers, prealertas, addons] = await Promise.all([
    listSuppliers(supabase, { markbox: client.markbox }),
    listPrealertas(supabase, { markbox: client.markbox }),
    listActivePrealertaAddons(supabase),
  ]);

  // Conteo de compras vivas por proveedor (para el próximo código y "N compras").
  const orderCountBySupplierId: Record<string, number> = {};
  for (const p of prealertas) {
    if (p.supplier_id) {
      orderCountBySupplierId[p.supplier_id] =
        (orderCountBySupplierId[p.supplier_id] ?? 0) + 1;
    }
  }

  const views = summarizeSuppliers(
    client.markbox,
    suppliers.map((s) => ({
      id: s.id,
      supplier_seq: s.supplier_seq,
      name: s.name,
      wechat: s.wechat,
    })),
    orderCountBySupplierId,
  );

  return (
    <SuppliersClient suppliers={views} markbox={client.markbox} addons={addons} />
  );
}
