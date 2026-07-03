/**
 * Queries del módulo Mailing (SDD-0026 Fase 1).
 *
 * Solo LECTURA. NO envía emails (eso es Fase 2 con Resend client).
 * Todas las queries devuelven data filtrada por tenant via RLS.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MailBlacklistEntry,
  MailCategory,
  MailChannel,
  MailConfig,
  MailKpis,
  MailLog,
  MailLogStatus,
  MailRule,
  MailRuleEvent,
  MailRuleWithTemplate,
  MailScheduled,
  MailSignature,
  MailTemplate,
} from "./mail-types";

const EMPTY_KPIS: MailKpis = {
  sent30d: 0,
  openRate: 0,
  bounceRate: 0,
  queuedNow: 0,
};

// ─── Templates ──────────────────────────────────────────────

export interface ListTemplatesFilters {
  category?: MailCategory;
  channel?: MailChannel;
  search?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}

export async function listTemplates(
  supabase: SupabaseClient,
  filters: ListTemplatesFilters = {},
): Promise<MailTemplate[]> {
  let q = supabase
    .from("mail_templates")
    .select("*")
    .is("deleted_at", null);

  if (filters.category) q = q.eq("category", filters.category);
  if (filters.channel) q = q.eq("channel", filters.channel);
  if (filters.active !== undefined) q = q.eq("active", filters.active);
  if (filters.search) {
    const term = `%${filters.search.replace(/[%_]/g, "\\$&")}%`;
    q = q.or(`name.ilike.${term},subject.ilike.${term},slug.ilike.${term}`);
  }

  q = q.order("updated_at", { ascending: false });

  const limit = filters.limit ?? 200;
  const offset = filters.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as MailTemplate[];
}

export async function getTemplate(
  supabase: SupabaseClient,
  id: string,
): Promise<MailTemplate | null> {
  const { data, error } = await supabase
    .from("mail_templates")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<MailTemplate>();
  if (error) return null;
  return data;
}

export async function getTemplateBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<MailTemplate | null> {
  const { data, error } = await supabase
    .from("mail_templates")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .eq("active", true)
    .maybeSingle<MailTemplate>();
  if (error) return null;
  return data;
}

// ─── Signatures ─────────────────────────────────────────────

/**
 * Lista firmas del user. Si userId no se provee, RLS aplica auth.uid()
 * automáticamente.
 */
export async function listSignatures(
  supabase: SupabaseClient,
  userId?: string,
): Promise<MailSignature[]> {
  let q = supabase
    .from("mail_signatures")
    .select("*")
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as MailSignature[];
}

/**
 * Lista TODAS las firmas del tenant (todos los miembros, no solo la propia).
 * Usada por la vista Firmas del Norte (admin-only en la capa app). La policy
 * tenant-scoped de la migr 0204 permite este SELECT a cualquier miembro; el
 * gating a rol admin lo hace page.tsx. Incluye la columna `lang` vía select("*").
 */
export async function listTenantSignatures(
  supabase: SupabaseClient,
): Promise<MailSignature[]> {
  const { data, error } = await supabase
    .from("mail_signatures")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as MailSignature[];
}

/**
 * Devuelve la firma default del user (is_default=true). Hay 1 sola
 * garantizada via partial unique index en la migración.
 */
export async function getDefaultSignature(
  supabase: SupabaseClient,
  userId: string,
): Promise<MailSignature | null> {
  const { data, error } = await supabase
    .from("mail_signatures")
    .select("*")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle<MailSignature>();
  if (error) return null;
  return data;
}

// ─── Logs ───────────────────────────────────────────────────

export interface ListLogsFilters {
  status?: MailLogStatus;
  templateId?: string;
  toEmail?: string;
  limit?: number;
  offset?: number;
}

export async function listLogs(
  supabase: SupabaseClient,
  filters: ListLogsFilters = {},
): Promise<MailLog[]> {
  let q = supabase
    .from("mail_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.status) q = q.eq("status", filters.status);
  if (filters.templateId) q = q.eq("template_id", filters.templateId);
  if (filters.toEmail) q = q.eq("to_email", filters.toEmail);

  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as MailLog[];
}

export async function getLog(
  supabase: SupabaseClient,
  id: string,
): Promise<MailLog | null> {
  const { data, error } = await supabase
    .from("mail_logs")
    .select("*")
    .eq("id", id)
    .maybeSingle<MailLog>();
  if (error) return null;
  return data;
}

// ─── Rules ──────────────────────────────────────────────────

export async function listRules(
  supabase: SupabaseClient,
  event?: MailRuleEvent,
): Promise<MailRuleWithTemplate[]> {
  let q = supabase
    .from("mail_rules")
    .select("*, template:mail_templates(id, slug, name, channel, category)")
    .order("event", { ascending: true })
    .order("created_at", { ascending: false });
  if (event) q = q.eq("event", event);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as MailRuleWithTemplate[];
}

export async function getRule(
  supabase: SupabaseClient,
  id: string,
): Promise<MailRule | null> {
  const { data, error } = await supabase
    .from("mail_rules")
    .select("*")
    .eq("id", id)
    .maybeSingle<MailRule>();
  if (error) return null;
  return data;
}

// ─── Config ─────────────────────────────────────────────────

export async function getMailConfig(
  supabase: SupabaseClient,
): Promise<MailConfig | null> {
  const { data, error } = await supabase
    .from("mail_config")
    .select("*")
    .maybeSingle<MailConfig>();
  if (error) return null;
  return data;
}

// ─── Blacklist ──────────────────────────────────────────────

export async function listBlacklist(
  supabase: SupabaseClient,
): Promise<MailBlacklistEntry[]> {
  const { data, error } = await supabase
    .from("mail_blacklist")
    .select("*")
    .order("added_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as MailBlacklistEntry[];
}

// ─── Scheduled (SDD-0140 Slice D · Programados) ─────────────

/**
 * Lista la cola de programados del tenant (RLS filtra tenant).
 * Muestra queued + sent (histórico corto), oculta los cancelados —
 * mismo criterio que la vista del Norte (mailing-scheduled.jsx). Orden
 * por scheduled_for asc (los próximos a vencer arriba).
 */
export async function listScheduled(
  supabase: SupabaseClient,
): Promise<MailScheduled[]> {
  const { data, error } = await supabase
    .from("mail_scheduled")
    .select("*")
    .neq("status", "canceled")
    .order("scheduled_for", { ascending: true });
  if (error) return [];
  return (data ?? []) as MailScheduled[];
}

// ─── KPIs ───────────────────────────────────────────────────

/**
 * Calcula KPIs agregados del tenant:
 *  - sent30d: count de logs con status IN (sent, delivered, opened, clicked, bounced, complained) creados últimos 30d
 *  - openRate: % logs con status='opened' o 'clicked' sobre sent30d (excluye queued/failed)
 *  - bounceRate: % logs con status='bounced' o 'complained' sobre sent30d
 *  - queuedNow: count de logs con status='queued' (sin importar fecha)
 *
 * Defensivo: si alguna query falla, devuelve EMPTY_KPIS para no romper render.
 */
export async function computeMailKpis(
  supabase: SupabaseClient,
): Promise<MailKpis> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Una sola query con select de status para hacer el agregado en TS.
  // Más simple que múltiples count() y suficiente hasta volúmenes grandes.
  const [sentResp, queuedResp] = await Promise.all([
    supabase
      .from("mail_logs")
      .select("status")
      .gte("created_at", thirtyDaysAgo)
      .not("status", "in", "(queued,failed)"),
    supabase
      .from("mail_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued"),
  ]);

  if (sentResp.error || queuedResp.error) return EMPTY_KPIS;

  const rows = (sentResp.data ?? []) as Array<{ status: MailLogStatus }>;
  const sent30d = rows.length;
  let opened = 0;
  let bounced = 0;
  for (const r of rows) {
    if (r.status === "opened" || r.status === "clicked") opened += 1;
    if (r.status === "bounced" || r.status === "complained") bounced += 1;
  }

  return {
    sent30d,
    openRate: sent30d > 0 ? Math.round((opened / sent30d) * 100) : 0,
    bounceRate: sent30d > 0 ? Math.round((bounced / sent30d) * 100) : 0,
    queuedNow: queuedResp.count ?? 0,
  };
}

// ─── Helpers ────────────────────────────────────────────────

/** Wrapper del RPC mail_check_blacklist. */
export async function isEmailBlacklisted(
  supabase: SupabaseClient,
  tenantId: string,
  email: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("mail_check_blacklist", {
    p_tenant_id: tenantId,
    p_email: email,
  });
  if (error || data == null) return false;
  return data === true;
}
