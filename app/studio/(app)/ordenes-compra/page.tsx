/**
 * Compras asistidas (SDD-0071) — el lado COMPRAS del modelo QuickBooks.
 * Renombre founder 2026-07-03 (ex "Órdenes de compra"); slug NO cambia
 * (contrato interno). Correlativo visible: CANNNN (migr 0208, ex OC-YYYY-NNNN).
 *
 * Server component: lista los DOS sub-tipos de compra juntos:
 *   · Prealertas del cliente = prealertas (0057) — el cliente compró por su
 *     cuenta y anuncia la mercancía desde su portal (read-only acá).
 *   · Compras de DTD = purchase_orders (0071) — DTD compra POR el cliente
 *     (compra asistida); al recibir genera el Bill (0044).
 *
 * Carga las OC DTD + sus ítems + stats, las prealertas + sus proveedores_cn,
 * y las cuentas de costo/gasto (para el form de recepción → Bill). Delega la UI
 * a OrdenesCompraClient.
 */

import { createClient } from "@/lib/db/server";
import {
  listPurchaseOrders,
  listPurchaseOrderItems,
  purchaseOrderStats,
} from "@/lib/studio/purchase-orders/queries";
import { listPrealertas, listSuppliers } from "@/lib/studio/prealertas/queries";
import { listExpenseAccounts } from "@/lib/studio/treasury/bill-queries";
import { OrdenesCompraClient } from "./_components/OrdenesCompraClient";

export const metadata = { title: "Compras asistidas" };

export default async function OrdenesCompraPage() {
  const supabase = await createClient();

  const [orders, stats, prealertas, suppliersCn, expenseAccounts] =
    await Promise.all([
      listPurchaseOrders(supabase),
      purchaseOrderStats(supabase),
      listPrealertas(supabase),
      listSuppliers(supabase),
      listExpenseAccounts(supabase),
    ]);

  // Ítems por OC (para el detalle / total). Se cargan en paralelo.
  const itemsByPo = Object.fromEntries(
    await Promise.all(
      orders.map(async (po) => {
        const items = await listPurchaseOrderItems(supabase, po.id);
        return [po.id, items] as const;
      }),
    ),
  );

  return (
    <OrdenesCompraClient
      orders={orders}
      itemsByPo={itemsByPo}
      stats={stats}
      prealertas={prealertas}
      suppliersCn={suppliersCn.map((s) => ({
        id: s.id,
        name: s.name,
        client_markbox: s.client_markbox,
        supplier_seq: s.supplier_seq,
      }))}
      expenseAccounts={expenseAccounts.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
      }))}
    />
  );
}
