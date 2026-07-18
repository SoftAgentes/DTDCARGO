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
  getKommoStatusCounts,
  listKommoBoardLeads,
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
import type { ReactNode } from "react";
import {
  filterRecoveryRows,
  getRecoveryUniverse,
  parseRecoveryFilters,
  RECOVERY_LIST_CAP,
} from "@/lib/studio/kommo-recovery";
import { DireccionTab } from "./_components/DireccionTab";
import { KommoBoardView } from "./_components/KommoBoardView";
import { KommoClient } from "./_components/KommoClient";
import { RecoveryTab } from "./_components/RecoveryTab";
import { resolveKommoTab } from "./_components/kommo-tabs.shared";

/** Tope de leads traídos por embudo para el Tablero kanban. */
const BOARD_CAP = 2000;

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

  // Tablero (kanban): leads del embudo activo (param ?pipeline= o el principal),
  // agrupados por etapa en el componente. Slot server-render (read-only).
  let tablero: ReactNode = null;
  if (tab === "tablero") {
    const p = single("pipeline");
    const boardPipelineId =
      p && /^\d+$/.test(p)
        ? Number(p)
        : (pipelines.find((pl) => pl.is_main)?.id ?? pipelines[0]?.id ?? null);
    if (boardPipelineId != null) {
      const statusIds = statuses
        .filter((s) => s.pipeline_id === boardPipelineId)
        .map((s) => s.id);
      const [boardLeads, realCountByStatus] = await Promise.all([
        listKommoBoardLeads(supabase, boardPipelineId, BOARD_CAP),
        getKommoStatusCounts(supabase, boardPipelineId, statusIds),
      ]);
      const ownerName: Record<number, string> = {};
      for (const o of analytics.ownership.owners) {
        if (o.id != null) ownerName[o.id] = o.label;
      }
      tablero = (
        <KommoBoardView
          pipelines={pipelines}
          statuses={statuses}
          leads={boardLeads}
          realCountByStatus={realCountByStatus}
          pipelineId={boardPipelineId}
          subdomain={overview.subdomain}
          convertedMarkboxByLead={analytics.convertedMarkboxByLead}
          valueByLead={analytics.valueByLead}
          ownerName={ownerName}
          boardCap={BOARD_CAP}
        />
      );
    }
  }

  // Recuperación (SDD-0157): universo de contactos con teléfono × clientes del
  // ERP, filtrado server-side; a la UI viaja solo la página (cap 300).
  let recuperacion: ReactNode = null;
  if (tab === "recuperacion") {
    const universe = await getRecoveryUniverse(supabase);
    const rf = parseRecoveryFilters(raw);
    const filtered = filterRecoveryRows(universe.rows, rf);
    let clientes = 0;
    for (const r of universe.rows) if (r.segment === "cliente") clientes += 1;
    recuperacion = (
      <RecoveryTab
        rows={filtered.slice(0, RECOVERY_LIST_CAP)}
        totalFiltered={filtered.length}
        listCap={RECOVERY_LIST_CAP}
        filters={rf}
        counts={{
          total: universe.rows.length,
          clientes,
          interesados: universe.rows.length - clientes,
          noPhone: universe.noPhone,
          noPhoneWithEmail: universe.noPhoneWithEmail,
          deduped: universe.deduped,
          fetched: universe.fetched,
          cap: universe.cap,
        }}
      />
    );
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
      tablero={tablero}
      recuperacion={recuperacion}
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
