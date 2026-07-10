/**
 * Audit log + detección de anomalías del No-Olvidar — SDD-0025 §4.7/§4.14.
 *
 * El log es append-only e INMUTABLE a nivel DB: las policies de UPDATE/DELETE
 * de no_olvidar_access_log devuelven false para TODOS, incluido service_role
 * (ver migración 0017). Acá solo se INSERTA (con service_role, único rol con
 * GRANT insert) y se LEE.
 *
 * `logAccess` es best-effort: si el insert falla, se registra en consola pero
 * NO se lanza — un hipo del log no debe tumbar la operación que lo disparó (un
 * reveal ya ocurrió cuando se intenta loggear). La inmutabilidad + las alertas
 * de anomalía son la red de contención, no la prevención (spec §4.16).
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  NoOlvidarAccessLog,
  NoOlvidarAlertSeverity,
  NoOlvidarAuditAction,
} from "../no-olvidar-types";

// ─── logAccess ───────────────────────────────────────────────

export interface LogAccessParams {
  userId: string;
  action: NoOlvidarAuditAction;
  itemId?: string | null;
  ip?: string | null;
  ua?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Inserta una fila en el audit log. Requiere cliente service_role (createAdminClient):
 * authenticated tiene el INSERT denegado por policy. Best-effort — nunca lanza.
 */
export async function logAccess(
  supabase: SupabaseClient,
  params: LogAccessParams,
): Promise<void> {
  try {
    const { error } = await supabase.from("no_olvidar_access_log").insert({
      user_id: params.userId,
      action: params.action,
      item_id: params.itemId ?? null,
      ip_address: params.ip ?? null,
      user_agent: params.ua ?? null,
      metadata: params.metadata ?? {},
    });
    if (error) {
      console.error("[no-olvidar audit] insert falló:", error.message);
    }
  } catch (e) {
    console.error("[no-olvidar audit] excepción al loggear:", e);
  }
}

// ─── getAccessLog ────────────────────────────────────────────

export interface GetAccessLogFilters {
  userId?: string;
  action?: NoOlvidarAuditAction;
  itemId?: string;
  since?: string; // ISO
  limit?: number;
  offset?: number;
}

/**
 * Lee el audit log paginado. Con cliente authenticated, RLS filtra a dueño-o-admin;
 * con service_role ve todo (pasar `userId` para acotar). Defensivo: si rompe, [].
 */
export async function getAccessLog(
  supabase: SupabaseClient,
  filters: GetAccessLogFilters = {},
): Promise<NoOlvidarAccessLog[]> {
  let q = supabase
    .from("no_olvidar_access_log")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.userId) q = q.eq("user_id", filters.userId);
  if (filters.action) q = q.eq("action", filters.action);
  if (filters.itemId) q = q.eq("item_id", filters.itemId);
  if (filters.since) q = q.gte("created_at", filters.since);

  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as NoOlvidarAccessLog[];
}

// ─── Anomalías (§4.14) ───────────────────────────────────────

export type AnomalyType =
  | "burst_views" // ≥5 views de un item en 1 min → posible scraping
  | "off_hours" // acceso fuera de 06:00–23:00 VET
  | "new_ip" // IP no vista en los últimos 30 días
  | "brute_force"; // ≥3 unlock fallidos en 5 min

export interface Anomaly {
  type: AnomalyType;
  severity: NoOlvidarAlertSeverity;
  userId: string;
  detail: string;
  at: string; // ISO del evento más reciente que la dispara
  count?: number;
}

/** Horario laboral en Venezuela (VET, UTC−4). Fuera de esto = sospechoso. */
const VET_OFFSET_HOURS = -4;
const WORK_START_HOUR = 6;
const WORK_END_HOUR = 23;

/**
 * Heurísticas de anomalía sobre el audit log de las últimas `windowHours` horas
 * (default 24). Pensado para el banner visible a admins. NO bloquea nada — solo
 * señala para revisión humana. V2: enviar a Slack/email.
 *
 * Requiere que el caller tenga visibilidad del log (admin vía RLS, o service_role).
 */
export async function getAnomalies(
  supabase: SupabaseClient,
  windowHours = 24,
): Promise<Anomaly[]> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  const logs = await getAccessLog(supabase, { since, limit: 2000 });
  if (logs.length === 0) return [];

  const anomalies: Anomaly[] = [];

  // ── burst_views: ≥5 'view' del mismo (user,item) en 60 s ──
  const viewGroups = groupBy(
    logs.filter((l) => l.action === "view"),
    (l) => `${l.user_id}|${l.item_id ?? "-"}`,
  );
  for (const [, group] of viewGroups) {
    const hit = slidingWindowHit(group, 60_000, 5);
    if (hit) {
      anomalies.push({
        type: "burst_views",
        severity: "warning",
        userId: group[0].user_id,
        detail: `${hit.count} vistas del mismo item en menos de 1 minuto (posible scraping).`,
        at: hit.at,
        count: hit.count,
      });
    }
  }

  // ── brute_force: ≥3 'unlock' del mismo user en 5 min ──
  const unlockGroups = groupBy(
    logs.filter((l) => l.action === "unlock"),
    (l) => l.user_id,
  );
  for (const [userId, group] of unlockGroups) {
    const hit = slidingWindowHit(group, 5 * 60_000, 3);
    if (hit) {
      anomalies.push({
        type: "brute_force",
        severity: "critical",
        userId,
        detail: `${hit.count} desbloqueos en 5 minutos (posible fuerza bruta del 2FA).`,
        at: hit.at,
        count: hit.count,
      });
    }
  }

  // ── off_hours: cualquier acceso fuera de 06:00–23:00 VET ──
  for (const l of logs) {
    const h = vetHour(l.created_at);
    if (h < WORK_START_HOUR || h >= WORK_END_HOUR) {
      anomalies.push({
        type: "off_hours",
        severity: "info",
        userId: l.user_id,
        detail: `Acceso a las ${String(h).padStart(2, "0")}:xx VET, fuera de horario laboral.`,
        at: l.created_at,
      });
    }
  }

  // ── new_ip: IP presente en la ventana pero NO en los 30 días previos ──
  const priorSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const priorUntil = since;
  const priorLogs = await getAccessLog(supabase, {
    since: priorSince,
    limit: 5000,
  });
  const knownIps = new Set(
    priorLogs
      .filter((l) => l.created_at < priorUntil && l.ip_address)
      .map((l) => `${l.user_id}|${l.ip_address}`),
  );
  const flaggedIps = new Set<string>();
  for (const l of logs) {
    if (!l.ip_address) continue;
    const key = `${l.user_id}|${l.ip_address}`;
    if (knownIps.has(key) || flaggedIps.has(key)) continue;
    flaggedIps.add(key);
    anomalies.push({
      type: "new_ip",
      severity: "warning",
      userId: l.user_id,
      detail: `IP nueva ${l.ip_address}, no vista en los últimos 30 días.`,
      at: l.created_at,
    });
  }

  // Más severo primero, luego más reciente
  const rank: Record<NoOlvidarAlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  anomalies.sort((a, b) => rank[a.severity] - rank[b.severity] || b.at.localeCompare(a.at));
  return anomalies;
}

// ─── Internos ────────────────────────────────────────────────

/** Agrupa por clave. Preserva el orden de aparición dentro de cada grupo. */
function groupBy<T>(items: T[], keyOf: (x: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = keyOf(it);
    const arr = map.get(k);
    if (arr) arr.push(it);
    else map.set(k, [it]);
  }
  return map;
}

/**
 * ¿Hay al menos `threshold` eventos dentro de alguna ventana deslizante de
 * `windowMs`? Devuelve el pico (count + timestamp del último evento del pico) o
 * null. Asume `events` puede venir en cualquier orden (se ordena por fecha).
 */
function slidingWindowHit(
  events: NoOlvidarAccessLog[],
  windowMs: number,
  threshold: number,
): { count: number; at: string } | null {
  if (events.length < threshold) return null;
  const ts = events.map((e) => new Date(e.created_at).getTime()).sort((a, b) => a - b);
  let best = 0;
  let bestEnd = 0;
  let start = 0;
  for (let end = 0; end < ts.length; end++) {
    while (ts[end] - ts[start] > windowMs) start++;
    const count = end - start + 1;
    if (count > best) {
      best = count;
      bestEnd = ts[end];
    }
  }
  if (best >= threshold) return { count: best, at: new Date(bestEnd).toISOString() };
  return null;
}

/** Hora del día (0–23) del timestamp ISO convertido a VET (UTC−4). */
function vetHour(iso: string): number {
  const utcMs = new Date(iso).getTime();
  const vet = new Date(utcMs + VET_OFFSET_HOURS * 60 * 60 * 1000);
  return vet.getUTCHours();
}
