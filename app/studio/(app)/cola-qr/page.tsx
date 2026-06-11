/**
 * /studio/cola-qr — Cola de impresión QR · vista oficina (SDD-0033).
 *
 * Server component:
 *  1. Parse filters
 *  2. Fetch orders + KPIs
 *  3. Render QrQueueClient (tabs · filtros · selección · drawer impresora)
 */

import { createClient } from "@/lib/db/server";
import {
  computeQrQueueKpis,
  listQrOrders,
} from "@/lib/studio/qr-queue-queries";
import { parseQrQueueFilters } from "@/lib/studio/qr-queue-types";
import { QrQueueClient } from "./_components/QrQueueClient";

export const metadata = { title: "Cola de QR · DTD Studio" };
export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function ColaQrPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = parseQrQueueFilters(params);

  const supabase = await createClient();
  const [orders, kpis, { data: warehousesData }] = await Promise.all([
    listQrOrders(supabase, filters),
    computeQrQueueKpis(supabase),
    supabase
      .from("warehouses_cn")
      .select("id, code, city")
      .order("code", { ascending: true }),
  ]);

  const warehouses = (warehousesData ?? []) as Array<{
    id: string;
    code: string;
    city: string;
  }>;

  return (
    <div style={{ maxWidth: 1480 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Operación · CN</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Cola de impresión QR
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "76ch",
            }}
          >
            Órdenes de impresión que el operario del PWA mandó a la oficina.
            Selecciona varias para imprimir en lote, marca impresas y
            entregadas. Auto-refresh cada 30s.
          </p>
        </div>
      </div>

      <QrQueueClient
        orders={orders}
        kpis={kpis}
        filters={filters}
        warehouses={warehouses}
      />
    </div>
  );
}
