/**
 * Órdenes de venta (SDD-0072) — el lado VENTAS del modelo QuickBooks.
 *
 * Server component: lista las OV (sales_orders, NUEVO) del tenant. La OV es el
 * estimado CONFIRMADO y formal (gemela de la OC 0124). Nace al convertir un
 * estimado (snapshot editable) o manual (B2B / otros servicios).
 *
 * Carga las OV + stats, los estimados convertibles (para "Convertir en orden"),
 * las prealertas vivas (para asignar cajas físicas a la OV) y las prealertas ya
 * atadas a cada OV (para el detalle). Delega la UI a OrdenesVentaClient.
 */

import { createClient } from "@/lib/db/server";
import {
  listSalesOrders,
  listPrealertasBySalesOrder,
  listInvoicesBySalesOrder,
  salesOrderStats,
} from "@/lib/studio/sales-orders/queries";
import { listQuotes } from "@/lib/studio/quote-queries";
import { listPrealertas } from "@/lib/studio/prealertas/queries";
import { OrdenesVentaClient } from "./_components/OrdenesVentaClient";

export const metadata = { title: "Órdenes de venta" };

export default async function OrdenesVentaPage() {
  const supabase = await createClient();

  const [orders, stats, quotes, prealertas] = await Promise.all([
    listSalesOrders(supabase),
    salesOrderStats(supabase),
    // Estimados aceptados (candidatos a convertir en OV). El filtro fino de "no
    // convertido aún" se hace client-side con quote.sales_order_id.
    listQuotes(supabase, { status: "accepted" }),
    listPrealertas(supabase),
  ]);

  // Prealertas ya atadas a cada OV + facturas generadas (Fase 2 · provenance),
  // paginadas y agrupadas por lotes en vez de disparar dos queries por OV.
  const orderIds = orders.map((so) => so.id);
  const [prealertasByOrder, invoicesByOrder] = await Promise.all([
    listPrealertasBySalesOrder(supabase, orderIds),
    listInvoicesBySalesOrder(supabase, orderIds),
  ]);

  return (
    <OrdenesVentaClient
      orders={orders}
      stats={stats}
      prealertasByOrder={prealertasByOrder}
      invoicesByOrder={invoicesByOrder}
      quotes={quotes.map((q) => ({
        id: q.id,
        quote_code: q.quote_code,
        client_name: q.client_name,
        client_markbox: q.client_markbox,
        total_usd: q.total_usd,
        sales_order_id: q.sales_order_id,
      }))}
      prealertas={prealertas.map((p) => ({
        id: p.id,
        code: p.code,
        description: p.description,
        client_markbox: p.client_markbox,
        boxes: p.boxes,
        status: p.status,
        sales_order_id: p.sales_order_id,
      }))}
    />
  );
}
