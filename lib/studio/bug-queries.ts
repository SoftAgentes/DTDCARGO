/**
 * Queries server-side del módulo Bug Reporter (SDD-0036).
 *
 * Las funciones reciben un SupabaseClient (server-side, con cookies del user
 * logueado) y devuelven data tipada. RLS se encarga de filtrar lo que el
 * caller puede ver:
 *   - Reporter ve sus bugs.
 *   - Admin del tenant ve todos los bugs del tenant.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BugAdminFilters,
  BugAttachment,
  BugMessage,
  BugNotification,
  BugReport,
  BugState,
  BugTechData,
  BugTimelineEvent,
  UserNotificationPrefs,
} from "./bug-types";
import { BUG_ACTIVE_STATES } from "./bug-types";

const BUG_REPORT_COLUMNS =
  "id, tenant_id, folio, reporter_id, category, severity, state, progress_pct, " +
  "title, description, module, url, build_sha, browser_info, " +
  "duplicate_hash, duplicate_count, duplicate_of_id, eta_days, admin_thanks, commit_url, " +
  "taken_by, taken_at, resolved_at, discarded_at, created_at, updated_at";

// ─────────────────────────────────────────────────────────────
// Listados
// ─────────────────────────────────────────────────────────────

/**
 * Admin view: bugs del tenant con filtros opcionales.
 * RLS deja pasar todos los del tenant si el caller es admin, o solo los
 * propios si es reporter (que no debería usar esta query).
 */
export async function listBugsForAdmin(
  supabase: SupabaseClient,
  filters: BugAdminFilters,
): Promise<BugReport[]> {
  let query = supabase
    .from("bug_reports")
    .select(BUG_REPORT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(500);

  if (filters.state && filters.state !== "all") {
    query = query.eq("state", filters.state);
  } else if (filters.tab === "kanban") {
    // Kanban muestra activos + resueltos recientes (no descartados)
    query = query.neq("state", "descartado");
  }

  if (filters.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }
  if (filters.module) query = query.eq("module", filters.module);
  if (filters.reporter) query = query.eq("reporter_id", filters.reporter);

  if (filters.search) {
    const q = filters.search.trim();
    query = query.or(
      `folio.ilike.%${q}%,title.ilike.%${q}%,description.ilike.%${q}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as BugReport[] | null) ?? [];
}

/**
 * Reporter view: mis bugs (RLS hace el filtro por reporter_id).
 */
export async function listBugsForReporter(
  supabase: SupabaseClient,
  reporterId: string,
): Promise<BugReport[]> {
  const { data, error } = await supabase
    .from("bug_reports")
    .select(BUG_REPORT_COLUMNS)
    .eq("reporter_id", reporterId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data as unknown as BugReport[] | null) ?? [];
}

/**
 * Detalle de un bug · RLS filtra acceso (reporter o admin del tenant).
 */
export async function getBugDetail(
  supabase: SupabaseClient,
  bugId: string,
): Promise<BugReport | null> {
  const { data, error } = await supabase
    .from("bug_reports")
    .select(BUG_REPORT_COLUMNS)
    .eq("id", bugId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as BugReport | null) ?? null;
}

/**
 * Buscar bugs vivos con el mismo duplicate_hash en el tenant.
 * Usado por el endpoint POST /api/studio/bugs antes del insert.
 */
export async function findDuplicateBug(
  supabase: SupabaseClient,
  tenantId: string,
  duplicateHash: string,
): Promise<BugReport | null> {
  if (!duplicateHash) return null;

  const { data, error } = await supabase
    .from("bug_reports")
    .select(BUG_REPORT_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("duplicate_hash", duplicateHash)
    .in("state", BUG_ACTIVE_STATES)
    .order("created_at", { ascending: true })  // el original es el más viejo
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as BugReport | null) ?? null;
}

// ─────────────────────────────────────────────────────────────
// Sub-recursos
// ─────────────────────────────────────────────────────────────

export async function getBugTechData(
  supabase: SupabaseClient,
  bugId: string,
): Promise<BugTechData | null> {
  const { data, error } = await supabase
    .from("bug_tech_data")
    .select("bug_id, console_logs, network_requests, session_replay_url, environment, captured_at")
    .eq("bug_id", bugId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as BugTechData | null) ?? null;
}

export async function listBugAttachments(
  supabase: SupabaseClient,
  bugId: string,
): Promise<BugAttachment[]> {
  const { data, error } = await supabase
    .from("bug_attachments")
    .select(
      "id, bug_id, storage_path, mime_type, size_bytes, width_px, height_px, uploaded_by, uploaded_at",
    )
    .eq("bug_id", bugId)
    .order("uploaded_at", { ascending: true });

  if (error) throw error;
  return (data as unknown as BugAttachment[] | null) ?? [];
}

export async function listBugMessages(
  supabase: SupabaseClient,
  bugId: string,
): Promise<BugMessage[]> {
  const { data, error } = await supabase
    .from("bug_messages")
    .select("id, bug_id, author_id, author_type, body, created_at")
    .eq("bug_id", bugId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as unknown as BugMessage[] | null) ?? [];
}

export async function listBugTimeline(
  supabase: SupabaseClient,
  bugId: string,
): Promise<BugTimelineEvent[]> {
  const { data, error } = await supabase
    .from("bug_timeline")
    .select("id, bug_id, event_type, actor_id, actor_type, payload, created_at")
    .eq("bug_id", bugId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as BugTimelineEvent[] | null) ?? [];
}

export async function countBugAttachments(
  supabase: SupabaseClient,
  bugId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("bug_attachments")
    .select("id", { count: "exact", head: true })
    .eq("bug_id", bugId);

  if (error) throw error;
  return count ?? 0;
}

// ─────────────────────────────────────────────────────────────
// Notificaciones del user logueado
// ─────────────────────────────────────────────────────────────

export async function listNotificationsForUser(
  supabase: SupabaseClient,
  userId: string,
  opts: { unreadOnly?: boolean; limit?: number } = {},
): Promise<BugNotification[]> {
  let q = supabase
    .from("bug_notifications")
    .select(
      "id, user_id, bug_id, type, payload, read_at, " +
        "delivered_inapp_at, delivered_push_at, delivered_email_at, delivered_telegram_at, " +
        "created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 30);

  if (opts.unreadOnly) q = q.is("read_at", null);

  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as BugNotification[] | null) ?? [];
}

export async function countUnreadNotifications(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("bug_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Bugs en estados activos (triaje/espera/progreso) abiertos hace > N días.
 * Usado por el banner "bugs estancados" del admin (SDD-0036 Fase 6).
 * Excluye `nuevo` porque ese estado es responsabilidad del admin de tomarlo
 * primero, no de "ya está estancado".
 */
export async function countStaleBugs(
  supabase: SupabaseClient,
  staleDays = 7,
): Promise<number> {
  const cutoffIso = new Date(
    Date.now() - staleDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { count, error } = await supabase
    .from("bug_reports")
    .select("id", { count: "exact", head: true })
    .in("state", ["triaje", "espera", "progreso"])
    .lte("created_at", cutoffIso);

  if (error) throw error;
  return count ?? 0;
}

export async function getUserNotificationPrefs(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserNotificationPrefs | null> {
  const { data, error } = await supabase
    .from("user_notification_prefs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as UserNotificationPrefs | null) ?? null;
}

// ─────────────────────────────────────────────────────────────
// KPIs admin
// ─────────────────────────────────────────────────────────────

export type BugAdminKpis = {
  totalBugs: number;
  resueltosSemana: number;
  enProgreso: number;
  topModule: { module: string; count: number } | null;
};

export async function computeBugAdminKpis(
  supabase: SupabaseClient,
): Promise<BugAdminKpis> {
  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, resueltosRes, enProgresoRes, byModuleRes] = await Promise.all([
    supabase
      .from("bug_reports")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("bug_reports")
      .select("id", { count: "exact", head: true })
      .eq("state", "resuelto")
      .gte("resolved_at", weekAgoIso),
    supabase
      .from("bug_reports")
      .select("id", { count: "exact", head: true })
      .eq("state", "progreso"),
    supabase
      .from("bug_reports")
      .select("module")
      .in("state", BUG_ACTIVE_STATES)
      .limit(500),
  ]);

  const moduleRows =
    (byModuleRes.data as Array<{ module: string }> | null) ?? [];
  const counts = new Map<string, number>();
  for (const r of moduleRows) {
    counts.set(r.module, (counts.get(r.module) ?? 0) + 1);
  }
  let topModule: { module: string; count: number } | null = null;
  for (const [module, count] of counts) {
    if (!topModule || count > topModule.count) {
      topModule = { module, count };
    }
  }

  return {
    totalBugs: totalRes.count ?? 0,
    resueltosSemana: resueltosRes.count ?? 0,
    enProgreso: enProgresoRes.count ?? 0,
    topModule,
  };
}

// ─────────────────────────────────────────────────────────────
// Resumen para el FAB del reportador (mini badge)
// ─────────────────────────────────────────────────────────────

export type ReporterBugSummary = {
  total: number;
  byState: Record<BugState, number>;
};

export async function computeReporterBugSummary(
  supabase: SupabaseClient,
  reporterId: string,
): Promise<ReporterBugSummary> {
  const { data, error } = await supabase
    .from("bug_reports")
    .select("state")
    .eq("reporter_id", reporterId)
    .limit(500);

  if (error) throw error;
  const rows = (data as Array<{ state: BugState }> | null) ?? [];

  const byState: Record<BugState, number> = {
    nuevo: 0,
    triaje: 0,
    espera: 0,
    progreso: 0,
    resuelto: 0,
    descartado: 0,
  };
  for (const r of rows) byState[r.state] = (byState[r.state] ?? 0) + 1;

  return { total: rows.length, byState };
}
