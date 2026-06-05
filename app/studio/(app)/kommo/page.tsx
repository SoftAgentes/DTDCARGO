/**
 * Kommo CRM — espejo READ-ONLY de la cuenta Kommo (SDD-0043).
 * Server component: fetcha overview + embudos + etapas + leads (filtrados).
 * No muta nada (ni Kommo ni el mirror).
 */
import { createClient } from "@/lib/db/server";
import {
  getKommoOverview,
  listKommoLeads,
  listKommoPipelines,
  listKommoStatuses,
  parseKommoFiltersFromSearchParams,
} from "@/lib/studio/kommo-queries";
import { listConvertedLeadIds } from "@/lib/studio/kommo-convert";
import { KommoClient } from "./_components/KommoClient";

export const metadata = { title: "Kommo CRM" };

export default async function KommoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const filters = parseKommoFiltersFromSearchParams(raw);

  const supabase = await createClient();
  const [overview, pipelines, statuses, leads] = await Promise.all([
    getKommoOverview(supabase),
    listKommoPipelines(supabase),
    listKommoStatuses(supabase),
    listKommoLeads(supabase, filters),
  ]);
  // Qué leads visibles ya son clientes (para marcar "Convertir" vs Badge MARKBOX).
  const convertedLeads = await listConvertedLeadIds(
    supabase,
    leads.map((l) => l.id),
  );

  return (
    <KommoClient
      overview={overview}
      pipelines={pipelines}
      statuses={statuses}
      leads={leads}
      filters={filters}
      convertedLeads={convertedLeads}
    />
  );
}
