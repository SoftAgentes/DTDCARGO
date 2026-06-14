/**
 * Tablero CRM Kommo (SDD-0078) — espejo READ-ONLY + cruce con la plata del ERP.
 * Server component: resuelve la pestaña, computa la analítica (Dirección) en una
 * pasada y deriva los mapas del worklist (Asesor) sin queries extra. No muta nada
 * (ni Kommo ni el mirror).
 */
import { createClient } from "@/lib/db/server";
import { getKommoAnalytics } from "@/lib/studio/kommo-analytics";
import {
  getKommoOverview,
  listKommoLeads,
  listKommoPipelines,
  listKommoStatuses,
  parseKommoFiltersFromSearchParams,
} from "@/lib/studio/kommo-queries";
import { DireccionTab } from "./_components/DireccionTab";
import { KommoClient } from "./_components/KommoClient";
import { resolveKommoTab } from "./_components/kommo-tabs.shared";

export const metadata = { title: "Kommo CRM" };

export default async function KommoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const single = (k: string): string | undefined => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const tab = resolveKommoTab(single("tab"));
  const filters = parseKommoFiltersFromSearchParams(raw);

  const supabase = await createClient();

  // La analítica corre siempre: alimenta el tablero Dirección + el reparto de
  // asesores del filtro + los mapas convertido/valor del worklist (sin re-query).
  const [overview, pipelines, statuses, analytics] = await Promise.all([
    getKommoOverview(supabase),
    listKommoPipelines(supabase),
    listKommoStatuses(supabase),
    getKommoAnalytics(supabase),
  ]);

  // Worklist (Asesor): leads filtrados; converted/valor se derivan del análisis.
  const leads = tab === "asesor" ? await listKommoLeads(supabase, filters) : [];
  const visibleConverted: Record<number, string> = {};
  const visibleValue: Record<number, number> = {};
  for (const l of leads) {
    const mb = analytics.convertedMarkboxByLead[l.id];
    if (mb) visibleConverted[l.id] = mb;
    const v = analytics.valueByLead[l.id];
    if (v != null) visibleValue[l.id] = v;
  }

  return (
    <KommoClient
      tab={tab}
      direccion={tab === "direccion" ? <DireccionTab data={analytics} /> : null}
      overview={overview}
      pipelines={pipelines}
      statuses={statuses}
      leads={leads}
      filters={filters}
      convertedLeads={visibleConverted}
      valueByLead={visibleValue}
      responsibleUsers={analytics.ownership.owners}
    />
  );
}
