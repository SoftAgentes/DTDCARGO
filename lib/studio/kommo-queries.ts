/**
 * Queries read-only del espejo Kommo (SDD-0043). RLS filtra por tenant.
 * Funciones puras `(supabase) => Promise<T>` consumidas desde page.tsx.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  KommoLeadRow,
  KommoOverview,
  KommoPipelineRow,
  KommoStatusRow,
} from "./kommo-types";

export type KommoFilters = {
  pipeline?: number | "all";
  q?: string;
};

const LEAD_COLUMNS =
  "id, name, status_id, pipeline_id, price, responsible_user_id, kommo_created_at, kommo_updated_at, closed_at";

/** Conteos + estado de la conexión para los KPIs del header. */
export async function getKommoOverview(
  supabase: SupabaseClient,
): Promise<KommoOverview> {
  const [leads, contacts, conn] = await Promise.all([
    supabase.from("kommo_leads").select("*", { count: "exact", head: true }),
    supabase.from("kommo_contacts").select("*", { count: "exact", head: true }),
    supabase
      .from("kommo_connections")
      .select("last_sync_at, status, subdomain")
      .maybeSingle(),
  ]);

  const c = conn.data as {
    last_sync_at: string | null;
    status: string | null;
    subdomain: string | null;
  } | null;

  return {
    leads: leads.count ?? 0,
    contacts: contacts.count ?? 0,
    lastSyncAt: c?.last_sync_at ?? null,
    connStatus: c?.status ?? null,
    subdomain: c?.subdomain ?? null,
  };
}

/** Embudos ordenados por sort. */
export async function listKommoPipelines(
  supabase: SupabaseClient,
): Promise<KommoPipelineRow[]> {
  const { data, error } = await supabase
    .from("kommo_pipelines")
    .select("id, name, sort, is_main")
    .order("sort", { ascending: true });
  if (error) throw error;
  return (data as KommoPipelineRow[] | null) ?? [];
}

/** Etapas (todas; el cliente arma el lookup por (pipeline_id, id)). */
export async function listKommoStatuses(
  supabase: SupabaseClient,
): Promise<KommoStatusRow[]> {
  const { data, error } = await supabase
    .from("kommo_statuses")
    .select("id, pipeline_id, name, color, sort")
    .order("sort", { ascending: true });
  if (error) throw error;
  return (data as KommoStatusRow[] | null) ?? [];
}

/**
 * Leads con filtros opcionales (embudo + búsqueda por nombre).
 * Hasta 200, orden actualizado más reciente. RLS filtra por tenant.
 */
export async function listKommoLeads(
  supabase: SupabaseClient,
  filters: KommoFilters = {},
): Promise<KommoLeadRow[]> {
  let query = supabase
    .from("kommo_leads")
    .select(LEAD_COLUMNS)
    .order("kommo_updated_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (filters.pipeline && filters.pipeline !== "all") {
    query = query.eq("pipeline_id", filters.pipeline);
  }
  if (filters.q && filters.q.trim()) {
    const q = filters.q
      .trim()
      .replace(/[,()%]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    query = query.ilike("name", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as KommoLeadRow[] | null) ?? [];
}

/** Parsea filtros del URL (?pipeline=<id>&q=). */
export function parseKommoFiltersFromSearchParams(
  raw: Record<string, string | string[] | undefined>,
): KommoFilters {
  const single = (k: string): string | undefined => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const p = single("pipeline");
  const pipeline: KommoFilters["pipeline"] =
    p && /^\d+$/.test(p) ? Number(p) : "all";
  return { pipeline, q: single("q") || undefined };
}
