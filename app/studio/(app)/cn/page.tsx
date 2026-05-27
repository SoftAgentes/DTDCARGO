/**
 * /studio/cn — Almacén CN (SDD-0016).
 *
 * Server component. Fetchea recepciones + warehouses + clients + KPIs en
 * paralelo y delega la UI interactiva al AlmacenCnClient.
 *
 * Reemplaza el placeholder previo del módulo.
 */

import { createClient } from "@/lib/db/server";
import { listClients } from "@/lib/studio/client-queries";
import {
  computeWarehouseKpis,
  listReceipts,
  listWarehouses,
  parseReceiptFiltersFromSearchParams,
} from "@/lib/studio/warehouse-cn-queries";
import { listCities } from "@/lib/studio/dispatch-routes-queries";
import { AlmacenCnClient } from "./_components/AlmacenCnClient";
import { HeaderActions } from "./_components/HeaderActions";
import { WarehouseKpis } from "./_components/WarehouseKpis";

export const metadata = { title: "Almacén CN" };

export default async function CnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const filters = parseReceiptFiltersFromSearchParams(rawParams);

  const supabase = await createClient();
  const [receipts, warehouses, clients, kpis, cities] = await Promise.all([
    listReceipts(supabase, filters),
    listWarehouses(supabase),
    listClients(supabase),
    computeWarehouseKpis(supabase),
    // Catálogo per-tenant para el picker de destino al consolidar.
    // Si vacío, el component fallback a input text libre.
    listCities(supabase, { activeOnly: true }),
  ]);

  return (
    <div style={{ maxWidth: 1480 }}>
      {/* Header */}
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
          <span className="studio-eyebrow">Operación · Almacén</span>
          <h1
            className="studio-display"
            style={{
              fontSize: 30,
              margin: "8px 0 8px",
              color: "var(--ink)",
            }}
          >
            Almacén CN ·{" "}
            <span
              style={{
                fontFamily: '"Noto Sans SC", var(--f-sans)',
                color: "var(--wine)",
              }}
            >
              中国
            </span>
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "70ch",
            }}
          >
            Recepción de mercadería en hubs{" "}
            <strong style={{ color: "var(--ink)" }}>Yiwu · Guangzhou · Shenzhen · Shanghai</strong>
            . Consolidación previa a zarpe.
          </p>
        </div>
        <HeaderActions />
      </div>

      {/* KPIs */}
      <WarehouseKpis kpis={kpis} />

      {/* Toolbar + tabla + drawer */}
      <AlmacenCnClient
        receipts={receipts}
        warehouses={warehouses}
        clients={clients}
        cities={cities}
        filters={filters}
      />
    </div>
  );
}
