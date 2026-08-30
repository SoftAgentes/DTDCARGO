/**
 * Adaptador server-side del viewer gobernado (SDD-0166 Corte C).
 *
 * Solo consume audit_list_events. No existe fallback a SELECT de tabla.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AUDIT_ACTOR_TYPES,
  COMMENT_LIFECYCLE_AUDIT_ACTIONS,
  AUDIT_RESULTS,
  AUDIT_SENSITIVITIES,
  AUDIT_SOURCES,
  type AuditActorType,
  type AuditEvent,
  type AuditListFilters,
  type AuditListResult,
  type AuditResult,
  type AuditSensitivity,
  type AuditSource,
  type AuditSummary,
} from "./audit-types";

interface AuditRpcRow {
  id: string;
  entity_type: string;
  entity_id: string;
  actor_type: string;
  actor_id: string | null;
  actor_label: string | null;
  actor_resolved: boolean;
  event_type: string;
  occurred_at: string;
  correlation_id: string | null;
  source: string;
  result: string;
  sensitivity: string;
  schema_version: number;
  timezone: string;
  summary: unknown;
  next_cursor: string | null;
  has_more: boolean;
}

const MACHINE_NAME = /^[a-z][a-z0-9_]{1,79}$/;
const CURSOR = /^[A-Za-z0-9_-]{8,256}$/;
const CORRELATION = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const COMMENT_LIFECYCLE_EVENTS = [
  "comment_soft_deleted",
  "comment_restored",
] as const;

function one(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const clean = value?.trim();
  return clean || undefined;
}

function member<T extends string>(
  raw: string | undefined,
  values: readonly T[],
): T | undefined {
  return raw && (values as readonly string[]).includes(raw)
    ? (raw as T)
    : undefined;
}

function isoDate(raw: string | undefined): string | undefined {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const [year, month, day] = raw.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? raw
    : undefined;
}

export type AuditSearchParams = Record<
  string,
  string | string[] | undefined
>;

export function parseAuditFilters(
  params: AuditSearchParams,
): AuditListFilters {
  const entityType = one(params.auditEntity);
  const eventType = one(params.auditEvent);
  const cursor = one(params.auditCursor);
  const correlationId = one(params.auditCorrelation);

  return {
    entityType:
      entityType && MACHINE_NAME.test(entityType) ? entityType : undefined,
    actorType: member<AuditActorType>(
      one(params.auditActor),
      AUDIT_ACTOR_TYPES,
    ),
    eventType:
      eventType && MACHINE_NAME.test(eventType) ? eventType : undefined,
    source: member<AuditSource>(one(params.auditSource), AUDIT_SOURCES),
    result: member<AuditResult>(one(params.auditResult), AUDIT_RESULTS),
    sensitivity: member<AuditSensitivity>(
      one(params.auditSensitivity),
      AUDIT_SENSITIVITIES,
    ),
    from: isoDate(one(params.auditFrom)),
    to: isoDate(one(params.auditTo)),
    cursor: cursor && CURSOR.test(cursor) ? cursor : undefined,
    ...(correlationId && CORRELATION.test(correlationId)
      ? { correlationId }
      : {}),
  };
}

function validSummary(row: AuditRpcRow): row is AuditRpcRow & {
  summary: Exclude<AuditSummary, null> | null;
} {
  if (row.summary === null) return true;
  if (
    row.entity_type !== "comment" ||
    !COMMENT_LIFECYCLE_EVENTS.includes(
      row.event_type as (typeof COMMENT_LIFECYCLE_EVENTS)[number],
    ) ||
    typeof row.summary !== "object" ||
    Array.isArray(row.summary)
  ) {
    return false;
  }

  const keys = Object.keys(row.summary);
  const action = (row.summary as { action?: unknown }).action;
  return (
    keys.length === 1 &&
    keys[0] === "action" &&
    typeof action === "string" &&
    COMMENT_LIFECYCLE_AUDIT_ACTIONS.includes(
      action as (typeof COMMENT_LIFECYCLE_AUDIT_ACTIONS)[number],
    )
  );
}

function validRow(row: AuditRpcRow): boolean {
  return (
    row !== null &&
    typeof row === "object" &&
    typeof row.id === "string" &&
    typeof row.entity_type === "string" &&
    typeof row.entity_id === "string" &&
    (row.actor_id === null || typeof row.actor_id === "string") &&
    (row.actor_label === null || typeof row.actor_label === "string") &&
    typeof row.actor_resolved === "boolean" &&
    typeof row.event_type === "string" &&
    typeof row.occurred_at === "string" &&
    (row.correlation_id === null ||
      typeof row.correlation_id === "string") &&
    AUDIT_ACTOR_TYPES.includes(row.actor_type as AuditActorType) &&
    AUDIT_SOURCES.includes(row.source as AuditSource) &&
    AUDIT_RESULTS.includes(row.result as AuditResult) &&
    AUDIT_SENSITIVITIES.includes(row.sensitivity as AuditSensitivity) &&
    Number.isInteger(row.schema_version) &&
    validSummary(row) &&
    (row.next_cursor === null || typeof row.next_cursor === "string") &&
    typeof row.has_more === "boolean" &&
    row.timezone === "UTC"
  );
}

export async function listGovernedAuditEvents(
  supabase: SupabaseClient,
  filters: AuditListFilters = {},
): Promise<AuditListResult> {
  const from = filters.from ? `${filters.from}T00:00:00.000Z` : null;
  const to = filters.to ? `${filters.to}T23:59:59.999Z` : null;

  const { data, error } = await supabase.rpc("audit_list_events", {
    p_limit: 50,
    p_entity_type: filters.entityType ?? null,
    p_actor_type: filters.actorType ?? null,
    p_event_type: filters.eventType ?? null,
    p_source: filters.source ?? null,
    p_result: filters.result ?? null,
    p_sensitivity: filters.sensitivity ?? null,
    p_correlation_id: filters.correlationId ?? null,
    p_from: from,
    p_to: to,
    p_cursor: filters.cursor ?? null,
  });

  if (error) {
    return {
      ok: false,
      events: [],
      code:
        error.code === "42501"
          ? "forbidden"
          : error.code === "22023"
            ? "invalid_filter"
            : "query_failed",
    };
  }

  if (!Array.isArray(data)) {
    return { ok: false, events: [], code: "query_failed" };
  }
  const rows = data as unknown as AuditRpcRow[];
  if (!rows.every(validRow)) {
    return { ok: false, events: [], code: "query_failed" };
  }

  const events: AuditEvent[] = rows.map((row) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actorType: row.actor_type as AuditActorType,
    actorId: row.actor_id,
    actorLabel: row.actor_label,
    actorResolved: row.actor_resolved,
    eventType: row.event_type,
    occurredAt: row.occurred_at,
    correlationId: row.correlation_id,
    source: row.source as AuditSource,
    result: row.result as AuditResult,
    sensitivity: row.sensitivity as AuditSensitivity,
    schemaVersion: row.schema_version,
    timezone: "UTC",
    summary: row.summary as AuditSummary,
  }));

  return {
    ok: true,
    events,
    nextCursor: rows[0]?.next_cursor ?? null,
    hasMore: rows[0]?.has_more ?? false,
  };
}
