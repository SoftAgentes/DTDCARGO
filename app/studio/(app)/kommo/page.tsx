/**
 * Tablero CRM Kommo (SDD-0078) — espejo READ-ONLY + cruce con la plata del ERP.
 * Server component: resuelve la pestaña, computa la analítica (Dirección) en una
 * pasada y deriva los mapas del worklist (Asesor) sin queries extra. No muta nada
 * (ni Kommo ni el mirror).
 */
import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { getKommoAnalytics } from "@/lib/studio/kommo-analytics";
import {
  getKommoMarkboxFieldId,
  getKommoStageMap,
  getWritebackStatus,
  type WritebackStatus,
} from "@/lib/studio/kommo-writeback";
import {
  getKommoOverview,
  listKommoLeadCustomFields,
  listKommoLeads,
  listKommoPipelines,
  listKommoStatuses,
  parseKommoFiltersFromSearchParams,
} from "@/lib/studio/kommo-queries";
import type {
  KommoCustomFieldRow,
  KommoStageMap,
} from "@/lib/studio/kommo-types";
import { DireccionTab } from "./_components/DireccionTab";
import { KommoClient } from "./_components/KommoClient";
import { resolveKommoTab } from "./_components/kommo-tabs.shared";

export const metadata = { title: "Kommo CRM" };

export default async function KommoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleView("kommo");

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

  // Datos solo de la pestaña Dirección: panel de write-back (SDD-0083) + mapa de
  // etapas y rol del viewer para la config (SDD-0084).
  let writeback: WritebackStatus | null = null;
  let stageMap: KommoStageMap = {};
  let canEditStageMap = false;
  let markboxFields: KommoCustomFieldRow[] = [];
  let markboxFieldId: number | null = null;
  if (tab === "direccion") {
    const [wb, sm, mf, mfid, link] = await Promise.all([
      getWritebackStatus(supabase),
      getKommoStageMap(supabase),
      listKommoLeadCustomFields(supabase),
      getKommoMarkboxFieldId(supabase),
      supabase.from("user_tenants").select("role").maybeSingle<{ role: string }>(),
    ]);
    writeback = wb;
    stageMap = sm;
    markboxFields = mf;
    markboxFieldId = mfid;
    canEditStageMap = link.data?.role === "admin";
  }

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
      direccion={
        tab === "direccion" ? (
          <DireccionTab
            data={analytics}
            writeback={writeback}
            pipelines={pipelines}
            statuses={statuses}
            stageMap={stageMap}
            canEditStageMap={canEditStageMap}
            markboxFields={markboxFields}
            markboxFieldId={markboxFieldId}
          />
        ) : null
      }
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
