/**
 * Audit log (SDD-0123) — queries server-side (read-only).
 *
 * `getRecentAuditEvents(supabase, limit)` lee las últimas mutaciones del tenant
 * desde `entity_audit_log`. RLS filtra por tenant.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditActorType, AuditEvent } from "./audit-types";

interface AuditRow {
  id: string;
  entity_type: string;
  entity_id: string;
  actor_type: string;
  actor_id: string | null;
  event_type: string;
  payload: Record<string, unknown> | null;
  occurred_at: string;
}

const DEFAULT_LIMIT = 100;

export async function getRecentAuditEvents(
  supabase: SupabaseClient,
  limit: number = DEFAULT_LIMIT,
): Promise<AuditEvent[]> {
  const { data, error } = await supabase
    .from("entity_audit_log")
    .select("id, entity_type, entity_id, actor_type, actor_id, event_type, payload, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 500));

  if (error || !data) return [];

  return data.map((r: AuditRow) => ({
    id: r.id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    actorType: (["user", "operario", "system"].includes(r.actor_type)
      ? r.actor_type
      : "system") as AuditActorType,
    actorId: r.actor_id,
    eventType: r.event_type,
    payload: r.payload ?? {},
    occurredAt: r.occurred_at,
  }));
}
