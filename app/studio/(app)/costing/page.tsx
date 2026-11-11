/**
 * Costing & Margen (SDD-0053 · Slice B) — reemplaza el stub.
 *
 * Server component, READ-ONLY salvo el Cost Editor (server action
 * saveShipmentCosts). Carga el costeo real con las queries de Slice A
 * (costingRows cruza shipments + shipment_costs + revenue de invoices,
 * excluyendo borradores) y deriva los agregados puros (totales, margen por
 * ruta). El toggle USD/VES es display-only: se resuelve la tasa BCV desde la
 * última factura en VES (fallback al default del Norte).
 *
 * Delega la UI interactiva (tabs Overview/Ranking/Breakdown/Routes + drawer) a
 * CostingClient. Frontera RSC: de CostingClient importamos SOLO el componente.
 */

import { createClient } from "@/lib/db/server";
import {
  costingRows,
  costingTotals,
  forecastQuotes,
  latestVesFxRate,
  listRouteCostTemplates,
  marginByRoute,
} from "@/lib/studio/costing/queries";
import { buildForecast } from "@/lib/studio/costing/ui";
import { CostingClient } from "./_components/CostingClient";
import { requireModuleView } from "@/lib/studio/rbac-guard";

export const metadata = { title: "Costing & Margen" };
export const dynamic = "force-dynamic";

export default async function CostingPage() {
  // SDD-0624: el gate va también en la página, no sólo en el layout: un
  // layout compartido no se vuelve a ejecutar en la navegación parcial.
  await requireModuleView("costing");

  const supabase = await createClient();

  const [rows, vesRate, templates, quotes] = await Promise.all([
    costingRows(supabase),
    latestVesFxRate(supabase),
    listRouteCostTemplates(supabase),
    forecastQuotes(supabase),
  ]);

  const totals = costingTotals(rows);
  const routes = marginByRoute(rows);
  const forecast = buildForecast(quotes, templates);

  return (
    <CostingClient
      rows={rows}
      totals={totals}
      routes={routes}
      templates={templates}
      forecast={forecast}
      vesRate={vesRate}
    />
  );
}
