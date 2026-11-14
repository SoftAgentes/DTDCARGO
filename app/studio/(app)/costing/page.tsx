/**
 * Costing & Margen (SDD-0053 · Slice B) — reemplaza el stub.
 *
 * Server component, READ-ONLY salvo el Cost Editor (server action
 * saveShipmentCosts). Carga el costeo real con las queries de Slice A
 * (costingData cruza shipments + shipment_costs + CxP ligadas (SDD-0631) +
 * revenue de invoices,
 * excluyendo borradores) y deriva los agregados puros (totales, margen por
 * ruta). El toggle USD/VES es display-only: SDD-0572, la tasa vigente de
 * fx_rates (ultimaTasa de VES); sin ella, el selector de bolívares se apaga.
 *
 * Delega la UI interactiva (tabs Overview/Ranking/Breakdown/Routes + drawer) a
 * CostingClient. Frontera RSC: de CostingClient importamos SOLO el componente.
 */

import { createClient } from "@/lib/db/server";
import {
  costingData,
  costingTotals,
  forecastQuotes,
  listRouteCostTemplates,
  marginByRoute,
} from "@/lib/studio/costing/queries";
import { buildForecast } from "@/lib/studio/costing/ui";
import { ultimaTasa } from "@/lib/studio/fx-rates";
import { CostingClient } from "./_components/CostingClient";

export const metadata = { title: "Costing & Margen" };
export const dynamic = "force-dynamic";

export default async function CostingPage() {
  const supabase = await createClient();

  const [{ rows, containers, linksAvailable }, vesRate, templates, quotes] = await Promise.all([
    costingData(supabase),
    ultimaTasa(supabase, "VES").then((t) => t?.rate ?? null),
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
      containers={containers}
      linksAvailable={linksAvailable}
    />
  );
}
