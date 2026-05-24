/**
 * Queries del módulo Agentes y Skills (SDD-0020).
 *
 * Fase 2A: solo `computeAgentKpis()` para alimentar el AgenticHealthCard
 * del Dashboard. Resto de queries (listAgents, getAgent, listAgentRuns,
 * etc.) se agregan cuando se construyan las pages de /admin/agentes.
 *
 * RLS filtra por tenant automáticamente en todas las tablas excepto
 * `skills` (catálogo global, sin tenant_id).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentKpis, AgentWithSkill, Skill } from "./agent-types";

const VE_TZ = "America/Caracas";

const EMPTY_KPIS: AgentKpis = {
  installed: 0,
  active: 0,
  runsToday: 0,
  spendMtd: 0,
  errors24h: 0,
  approvalsPending: 0,
};

/** ISO timestamp del inicio del día actual en zona Caracas (UTC-4). */
function startOfTodayVE(now: Date): string {
  // sv-SE devuelve "YYYY-MM-DD" — formato ISO date sin manipulación
  const ymd = new Intl.DateTimeFormat("sv-SE", {
    timeZone: VE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  // VE = UTC-4 fijo (no DST). Forzar offset para evitar drift por zona del server.
  return new Date(`${ymd}T00:00:00-04:00`).toISOString();
}

/** Suma defensiva — coerciona null/undefined/string numeric a 0 y limita decimales. */
function sumNumeric(rows: Array<{ spend_usd_mtd: number | string | null }>): number {
  let total = 0;
  for (const r of rows) {
    const n = typeof r.spend_usd_mtd === "string"
      ? parseFloat(r.spend_usd_mtd)
      : (r.spend_usd_mtd ?? 0);
    if (Number.isFinite(n)) total += n;
  }
  return Math.round(total * 10000) / 10000;
}

/**
 * KPIs agregados de la plataforma agentic para el tenant del usuario logueado.
 *
 * Devuelve EMPTY_KPIS (todos en 0) si cualquier query falla — evita romper
 * el render del Dashboard si la migration no está aplicada o si el usuario
 * todavía no instaló ningún agent.
 */
export async function computeAgentKpis(
  supabase: SupabaseClient,
): Promise<AgentKpis> {
  const now = new Date();
  const todayStartIso = startOfTodayVE(now);
  const since24hIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [
    installedResp,
    activeResp,
    runsTodayResp,
    spendResp,
    errors24hResp,
    approvalsResp,
  ] = await Promise.all([
    supabase
      .from("agents")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .is("deleted_at", null),
    supabase
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStartIso),
    supabase
      .from("agents")
      .select("spend_usd_mtd")
      .is("deleted_at", null),
    supabase
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .in("status", ["error", "timeout"])
      .gte("created_at", since24hIso),
    supabase
      .from("agent_approvals")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  // Si alguna query rompió (ej: tabla no existe en local), no propagamos —
  // el dashboard queda usable y la card cae al estado N=0.
  if (
    installedResp.error ||
    activeResp.error ||
    runsTodayResp.error ||
    spendResp.error ||
    errors24hResp.error ||
    approvalsResp.error
  ) {
    return EMPTY_KPIS;
  }

  return {
    installed: installedResp.count ?? 0,
    active: activeResp.count ?? 0,
    runsToday: runsTodayResp.count ?? 0,
    spendMtd: sumNumeric(
      (spendResp.data ?? []) as Array<{ spend_usd_mtd: number | string | null }>,
    ),
    errors24h: errors24hResp.count ?? 0,
    approvalsPending: approvalsResp.count ?? 0,
  };
}

// ─── Catálogo de skills ─────────────────────────────────────

/**
 * Lista las skills built-in activas del catálogo global.
 * La tabla `skills` no tiene tenant_id — RLS deja ver todas las
 * filas con active=true a cualquier `authenticated` (ver migración 0015).
 */
export async function listSkills(supabase: SupabaseClient): Promise<Skill[]> {
  const { data, error } = await supabase
    .from("skills")
    .select("*")
    .eq("active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) return [];
  return (data ?? []) as Skill[];
}

export async function getSkillBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<Skill | null> {
  const { data, error } = await supabase
    .from("skills")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle<Skill>();
  if (error) return null;
  return data;
}

// ─── Agentes instalados ─────────────────────────────────────

/**
 * Lista los agentes instalados del tenant del usuario logueado, con
 * la skill embebida via join. RLS filtra tenant automáticamente.
 * Excluye soft-deleted.
 */
export async function listAgents(
  supabase: SupabaseClient,
): Promise<AgentWithSkill[]> {
  const { data, error } = await supabase
    .from("agents")
    .select("*, skill:skills(*)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as AgentWithSkill[];
}
