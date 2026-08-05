/**
 * Queries read-only del espejo Kommo (SDD-0043). RLS filtra por tenant.
 * Funciones puras `(supabase) => Promise<T>` consumidas desde page.tsx.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  KommoCustomFieldRow,
  KommoLeadRow,
  KommoOverview,
  KommoPipelineRow,
  KommoStatusRow,
  KommoUserRow,
} from "./kommo-types";

export type KommoSort = "recent" | "oldest";

export type KommoFilters = {
  pipeline?: number | "all";
  q?: string;
  /** Filtrar por asesor (responsible_user_id de Kommo). */
  responsible?: number;
  /** Solo leads sin moverse hace ≥ N días (antigüedad mínima). */
  agedDays?: number;
  /** Orden por kommo_updated_at: reciente (default) o más viejo primero. */
  sort?: KommoSort;
};

/** Antigüedades ofrecidas en el filtro del worklist (días). */
export const KOMMO_AGE_OPTIONS = [30, 90, 180, 365] as const;

/**
 * Usuarios (asesores) del espejo Kommo → id→nombre para el tablero (SDD-0087).
 * Tira si la tabla no existe; el orquestador (getKommoAnalytics) lo envuelve con
 * `.catch(() => [])` para tolerar el gap entre deploy del código y migración.
 */
export async function listKommoUsers(
  supabase: SupabaseClient,
): Promise<KommoUserRow[]> {
  const { data, error } = await supabase
    .from("kommo_users")
    .select("id, name, email")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as KommoUserRow[] | null) ?? [];
}

const DAY_MS = 86_400_000;

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

/** Custom fields de leads (para configurar en qué campo va el MARKBOX · SDD-0086). */
export async function listKommoLeadCustomFields(
  supabase: SupabaseClient,
): Promise<KommoCustomFieldRow[]> {
  const { data, error } = await supabase
    .from("kommo_custom_fields")
    .select("id, name, type, code")
    .eq("entity_type", "leads")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as KommoCustomFieldRow[] | null) ?? [];
}

/**
 * Custom fields de CONTACTOS (SDD-0244 rebanada B). El campo del lead muere con
 * el trato; éste es el permanente, y es el que hace que la próxima vez el cliente
 * se reconozca sin cruzar teléfonos.
 */
export async function listKommoContactCustomFields(
  supabase: SupabaseClient,
): Promise<KommoCustomFieldRow[]> {
  const { data, error } = await supabase
    .from("kommo_custom_fields")
    .select("id, name, type, code")
    .eq("entity_type", "contacts")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as KommoCustomFieldRow[] | null) ?? [];
}

/**
 * Leads con filtros opcionales (embudo · búsqueda · asesor · antigüedad · orden).
 * Hasta 200. Orden por kommo_updated_at (reciente por default; "oldest" saca el
 * cementerio primero para el worklist). RLS filtra por tenant.
 */
export async function listKommoLeads(
  supabase: SupabaseClient,
  filters: KommoFilters = {},
): Promise<KommoLeadRow[]> {
  const ascending = filters.sort === "oldest";
  let query = supabase
    .from("kommo_leads")
    .select(LEAD_COLUMNS)
    .order("kommo_updated_at", { ascending, nullsFirst: false })
    .limit(200);

  if (filters.pipeline && filters.pipeline !== "all") {
    query = query.eq("pipeline_id", filters.pipeline);
  }
  if (filters.responsible && Number.isFinite(filters.responsible)) {
    query = query.eq("responsible_user_id", filters.responsible);
  }
  if (filters.agedDays && Number.isFinite(filters.agedDays)) {
    const cutoff = new Date(Date.now() - filters.agedDays * DAY_MS).toISOString();
    query = query.lt("kommo_updated_at", cutoff);
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

/**
 * Leads de UN embudo para el Tablero kanban (SDD-0078 · vista Tablero).
 * Trae hasta `cap` leads del embudo ordenados por actividad reciente; el server
 * los agrupa por etapa y computa conteo + Σ por columna. El `cap` acota embudos
 * gigantes (ej. una etapa con miles de leads) — se avisa en la UI si se recorta.
 * RLS filtra por tenant.
 */
export async function listKommoBoardLeads(
  supabase: SupabaseClient,
  pipelineId: number,
  cap = 2000,
): Promise<KommoLeadRow[]> {
  const { data, error } = await supabase
    .from("kommo_leads")
    .select(LEAD_COLUMNS)
    .eq("pipeline_id", pipelineId)
    .order("kommo_updated_at", { ascending: false, nullsFirst: false })
    .limit(cap);
  if (error) throw error;
  return (data as KommoLeadRow[] | null) ?? [];
}

/**
 * Conteo REAL de leads por etapa de un embudo (SDD-0078 · Tablero).
 * Independiente del `cap` de tarjetas: usa `count: exact, head` (no trae filas)
 * por cada etapa → el header de columna nunca miente aunque el embudo esté
 * capado. Una query liviana por etapa, en paralelo. RLS filtra por tenant.
 */
export async function getKommoStatusCounts(
  supabase: SupabaseClient,
  pipelineId: number,
  statusIds: number[],
): Promise<Record<number, number>> {
  const entries = await Promise.all(
    statusIds.map(async (sid) => {
      const { count } = await supabase
        .from("kommo_leads")
        .select("*", { count: "exact", head: true })
        .eq("pipeline_id", pipelineId)
        .eq("status_id", sid);
      return [sid, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/** Parsea filtros del URL (?pipeline=&q=&asesor=&aged=&sort=). */
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

  const asesor = single("asesor");
  const responsible = asesor && /^\d+$/.test(asesor) ? Number(asesor) : undefined;

  const aged = single("aged");
  const agedNum = aged && /^\d+$/.test(aged) ? Number(aged) : undefined;
  const agedDays = (KOMMO_AGE_OPTIONS as readonly number[]).includes(agedNum ?? -1)
    ? agedNum
    : undefined;

  const sortRaw = single("sort");
  const sort: KommoSort | undefined = sortRaw === "oldest" ? "oldest" : undefined;

  return { pipeline, q: single("q") || undefined, responsible, agedDays, sort };
}
