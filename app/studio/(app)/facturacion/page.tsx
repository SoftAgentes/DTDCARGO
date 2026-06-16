/**
 * Facturación — lista de facturas (SDD-0021).
 *
 * Reemplaza el placeholder EmptyState. Server component que fetchea facturas
 * con filtros desde searchParams, los KPIs agregados y el flag iva_enabled
 * del tenant, y delega la UI interactiva al FacturacionClient.
 */

import { createClient } from "@/lib/db/server";
import {
  invoiceKpis,
  listInvoices,
  parseInvoiceFiltersFromSearchParams,
  tabCounts,
} from "@/lib/studio/invoice-queries";
import { getFiscalSettingsSafe } from "@/lib/studio/fiscal/queries";
import { FacturacionClient } from "./_components/FacturacionClient";

export const metadata = { title: "Facturación" };

export default async function FacturacionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const filters = parseInvoiceFiltersFromSearchParams(rawParams);

  const supabase = await createClient();

  // Cargamos sin filtro de tab para poder contar todas las pestañas; el
  // filtro de tab se aplica client-side sobre el set ya resuelto.
  const [allRows, kpis, ivaRow, fiscal] = await Promise.all([
    listInvoices(supabase, { q: filters.q, clientMarkbox: filters.clientMarkbox }),
    invoiceKpis(supabase),
    supabase.from("tenants").select("iva_enabled").maybeSingle(),
    getFiscalSettingsSafe(supabase),
  ]);

  const ivaOn = (ivaRow.data as { iva_enabled?: boolean } | null)?.iva_enabled ?? false;
  const counts = tabCounts(allRows);

  return (
    <FacturacionClient
      invoices={allRows}
      filters={filters}
      kpis={kpis}
      counts={counts}
      ivaOn={ivaOn}
      fiscalModuleEnabled={fiscal.fiscal_module_enabled}
      defaultIvaMode={fiscal.default_invoice_iva_mode}
      ivaRateGeneral={fiscal.iva_rate_general}
    />
  );
}
