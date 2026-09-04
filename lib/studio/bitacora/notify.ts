/**
 * Notificaciones de Bitácora (SDD-0146 · Fase 5) sobre la infra SDD-0036 + outbox 0066.
 *
 * Dos eventos: `bitacora_task` (asignación) y `bitacora_digest` (8am). La MÁSCARA
 * DE CANALES es EXPLÍCITA (NO pasa por computeChannelDecision de bugs, que
 * heredaría email ON con el template de bugs):
 *   in-app SIEMPRE · push según channel_push · telegram según channel_telegram ·
 *   email OFF hard-coded (V1: Bitácora nunca manda email).
 *
 * Push = durable: se ENCOLA (enqueue_user_push → outbox 0066) y se drena inline
 * (+ cron del minuto de backstop). Nunca tumba la acción del user (best-effort).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createComponentLogger,
  type StructuredLogger,
} from "@/lib/observability/structured-logger";
import { writeInAppNotification } from "@/lib/studio/notify/write-inapp";
import {
  drainOperarioPushOutbox,
  enqueueUserPush,
} from "@/lib/studio/notify/operario-push-outbox";
import { sendTelegramToUser } from "@/lib/studio/notify/send-user-telegram";
import { prioridadRank } from "./bitacora-types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Vista Hoy en el teléfono (destino del digest). */
export const BITACORA_MOBILE_HOY_PATH = "/m/erp/bitacora";

/** Deep-link NEUTRO a una tarea (el redirector /ir decide móvil vs desktop). */
export function bitacoraTaskDeepLink(taskId: string): string {
  return `/ir/bitacora/tarea/${taskId}`;
}

// ─────────────────────────────────────────────────────────────
// Máscara de canales explícita (V1)
// ─────────────────────────────────────────────────────────────

export type BitacoraNotifType = "bitacora_task" | "bitacora_digest";

export interface BitacoraChannelDecision {
  inapp: boolean;
  email: boolean;
  push: boolean;
  telegram: boolean;
}

/** Prefs mínimas que la máscara necesita (o null → defaults: push/telegram OFF). */
export interface NotifPrefsLite {
  channel_push: boolean;
  channel_telegram: boolean;
}

/**
 * Decide canales para un evento de Bitácora. PURA + switch EXHAUSTIVO sobre los
 * 2 tipos de Bitácora. Regla dura V1: in-app SIEMPRE, email OFF; push/telegram
 * según los flags del user (default OFF si no tiene fila de prefs).
 */
export function computeBitacoraChannelDecision(
  prefs: NotifPrefsLite | null,
  type: BitacoraNotifType,
): BitacoraChannelDecision {
  switch (type) {
    case "bitacora_task":
    case "bitacora_digest":
      return {
        inapp: true, // la campanita SIEMPRE (channel_push OFF = solo campanita)
        email: false, // Bitácora nunca manda email en V1 (documentado)
        push: !!prefs?.channel_push,
        telegram: !!prefs?.channel_telegram,
      };
    default: {
      // Exhaustividad: si se agrega un tipo nuevo, TS obliga a manejarlo acá.
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/** Lee las prefs de canal del user (best-effort). null si no tiene fila / falla. */
async function readNotifPrefs(
  admin: SupabaseClient,
  userId: string,
  logger: StructuredLogger,
): Promise<NotifPrefsLite | null> {
  try {
    const { data } = await admin
      .from("user_notification_prefs")
      .select("channel_push, channel_telegram")
      .eq("user_id", userId)
      .maybeSingle<NotifPrefsLite>();
    return data ?? null;
  } catch (err) {
    logger.error("bitacora_notification.failed", {
      error: err,
      operation: "preferences",
      stage: "read",
    });
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Evento: tarea asignada
// ─────────────────────────────────────────────────────────────

export interface NotifyTaskAssignedArgs {
  tenantId: string;
  taskId: string;
  titulo: string;
  /** user_ids asignados a la tarea. El actor se excluye adentro. */
  assigneeUserIds: string[];
  /** Quién disparó la asignación (no se auto-notifica). */
  actorId: string | null;
}

/**
 * Notifica a cada asignado (MENOS el actor) que le cayó una tarea: campanita
 * SIEMPRE + push (si channel_push) vía outbox + telegram (si channel_telegram).
 * Best-effort TOTAL: jamás throwea → la action que la llama nunca se cae.
 * Requiere admin client (service_role): escribe bug_notifications + encola.
 */
export async function notifyBitacoraTaskAssigned(
  admin: SupabaseClient,
  args: NotifyTaskAssignedArgs,
  logger: StructuredLogger = createComponentLogger(
    "internal.bitacora-notify",
  ),
): Promise<void> {
  try {
    const targets = Array.from(new Set(args.assigneeUserIds)).filter(
      (uid) => uid && uid !== args.actorId,
    );
    if (targets.length === 0) return;

    const url = bitacoraTaskDeepLink(args.taskId);
    const tag = `task-${args.taskId}`;
    const label = `Nueva tarea: ${args.titulo}`;
    const excerpt = "Te asignaron una tarea en Bitácora.";
    let enqueued = false;

    for (const userId of targets) {
      const prefs = await readNotifPrefs(admin, userId, logger);
      const decision = computeBitacoraChannelDecision(prefs, "bitacora_task");

      // In-app SIEMPRE (excluye al actor por si acaso — doble candado).
      if (decision.inapp) {
        await writeInAppNotification(
          admin,
          {
            userId,
            actorId: args.actorId,
            bugId: null,
            type: "bitacora_task",
            payload: { label, excerpt, url, tag },
          },
          logger,
        );
      }

      if (decision.push) {
        const id = await enqueueUserPush(
          admin,
          args.tenantId,
          userId,
          {
            title: "Nueva tarea en Bitácora",
            body: args.titulo,
            url,
            tag,
          },
          logger,
        );
        if (id) enqueued = true;
      }

      if (decision.telegram) {
        await sendTelegramToUser(
          admin,
          userId,
          `${label}\n\n${excerpt}\n\n${SITE_URL}${url}`,
          logger,
        );
      }
    }

    // Drain inline para push casi-instantáneo (el cron del minuto es backstop).
    if (enqueued) await drainOperarioPushOutbox(admin, logger);
  } catch (err) {
    logger.error("bitacora_notification.failed", {
      error: err,
      operation: "task_assigned",
      stage: "dispatch",
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Digest 8am — funciones PURAS (testeables sin red)
// ─────────────────────────────────────────────────────────────

/** Fila mínima de tarea que el digest necesita. */
export interface DigestTask {
  id: string;
  titulo: string;
  prioridad: string;
  due_date: string | null;
}

/** Título de la notificación del digest (push + campanita). */
export const DIGEST_LABEL = "Tus tareas de hoy";

/** Tag idempotente del digest por fecha (dos corridas del mismo día no duplican). */
export function digestTag(dateISO: string): string {
  return `recordatorio-bitacora-${dateISO}`;
}

/**
 * Agrupa filas (con assignees embebidos) por persona → 1 entrada por user con
 * SUS tareas (una tarea con 2 dueños cae en las 2 listas = 1 push/persona).
 * PURA. Input vacío → Map vacío (sin tareas = sin push).
 */
export function groupDigestByPerson(
  rows: Array<DigestTask & { assignees: Array<{ user_id: string }> }>,
): Map<string, DigestTask[]> {
  const byPerson = new Map<string, DigestTask[]>();
  for (const row of rows) {
    const task: DigestTask = {
      id: row.id,
      titulo: row.titulo,
      prioridad: row.prioridad,
      due_date: row.due_date,
    };
    for (const a of row.assignees ?? []) {
      if (!a?.user_id) continue;
      const list = byPerson.get(a.user_id);
      if (list) list.push(task);
      else byPerson.set(a.user_id, [task]);
    }
  }
  return byPerson;
}

/**
 * La tarea "más urgente" del conjunto: due_date más temprana (atrasadas primero),
 * y a igual fecha, prioridad alta→media→baja, luego título estable. PURA.
 * (No necesita `hoy`: el orden por due_date asc ya pone lo más atrasado primero.)
 */
export function pickMostUrgent(
  tasks: readonly DigestTask[],
): DigestTask | null {
  if (tasks.length === 0) return null;
  return [...tasks].sort((a, b) => {
    const dueA = a.due_date ?? "9999-12-31";
    const dueB = b.due_date ?? "9999-12-31";
    if (dueA !== dueB) return dueA < dueB ? -1 : 1;
    const pr = prioridadRank(a.prioridad) - prioridadRank(b.prioridad);
    if (pr !== 0) return pr;
    return a.titulo.localeCompare(b.titulo, "es");
  })[0];
}

function plural(n: number, singular: string, prlz: string): string {
  return n === 1 ? singular : prlz;
}

/**
 * Arma el texto del digest de UNA persona: "Tienes N tarea(s) pendiente(s) · M
 * atrasada(s) · Empieza por: {la más urgente}". PURA. `hoyISO` para contar
 * atrasadas (due < hoy).
 */
export function buildDigestMessage(
  tasks: readonly DigestTask[],
  hoyISO: string,
): { label: string; body: string } {
  const n = tasks.length;
  const overdue = tasks.filter(
    (t) => t.due_date != null && t.due_date < hoyISO,
  ).length;
  const urgent = pickMostUrgent(tasks);

  let body = `Tienes ${n} ${plural(n, "tarea pendiente", "tareas pendientes")}`;
  if (overdue > 0) {
    body += ` · ${overdue} ${plural(overdue, "atrasada", "atrasadas")}`;
  }
  if (urgent) body += ` · Empieza por: ${urgent.titulo}`;

  return { label: DIGEST_LABEL, body };
}

// ─────────────────────────────────────────────────────────────
// Digest 8am — corrida por tenant (usa admin client · desde el cron)
// ─────────────────────────────────────────────────────────────

interface DigestRow extends DigestTask {
  assignees: Array<{ user_id: string }>;
}

export interface DigestTenantResult {
  tenant_id: string;
  persons: number;
  pushed: number;
  skipped: number;
  error?: string;
}

/** ¿Ya se escribió el digest de HOY (tag) para este user? (idempotencia día). */
async function digestAlreadySent(
  admin: SupabaseClient,
  userId: string,
  tag: string,
): Promise<boolean> {
  try {
    const { data } = await admin
      .from("bug_notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "bitacora_digest")
      .eq("payload->>tag", tag)
      .limit(1)
      .maybeSingle<{ id: string }>();
    return !!data;
  } catch {
    return false; // fail-open: mejor mandar de más que perder el recordatorio.
  }
}

/**
 * Corre el digest de UN tenant: tareas abiertas con due_date <= hoy (incluye
 * atrasadas) agrupadas por persona → 1 push/persona + fila in-app. Encola el push
 * (durable) y drena inline. Idempotente por (user, tag=fecha). Sin tareas = sin
 * push. Best-effort por persona.
 */
export async function runBitacoraDigestForTenant(
  admin: SupabaseClient,
  tenantId: string,
  hoyISO: string,
  logger: StructuredLogger = createComponentLogger(
    "internal.bitacora-digest",
  ),
): Promise<DigestTenantResult> {
  const tag = digestTag(hoyISO);
  try {
    const { data, error } = await admin
      .from("bitacora_tasks")
      .select("id, titulo, prioridad, due_date, assignees:bitacora_task_assignees(user_id)")
      .eq("tenant_id", tenantId)
      .neq("estado", "hecho")
      .not("due_date", "is", null)
      .lte("due_date", hoyISO);

    if (error) {
      return { tenant_id: tenantId, persons: 0, pushed: 0, skipped: 0, error: error.message };
    }

    const byPerson = groupDigestByPerson((data ?? []) as unknown as DigestRow[]);
    let pushed = 0;
    let skipped = 0;
    let enqueued = false;

    for (const [userId, tasks] of byPerson) {
      if (tasks.length === 0) continue;
      if (await digestAlreadySent(admin, userId, tag)) {
        skipped += 1;
        continue;
      }

      const { label, body } = buildDigestMessage(tasks, hoyISO);

      // In-app SIEMPRE (bugId null; no hay actor — lo dispara el sistema).
      await writeInAppNotification(
        admin,
        {
          userId,
          bugId: null,
          type: "bitacora_digest",
          payload: { label, excerpt: body, url: BITACORA_MOBILE_HOY_PATH, tag },
        },
        logger,
      );

      const prefs = await readNotifPrefs(admin, userId, logger);
      const decision = computeBitacoraChannelDecision(prefs, "bitacora_digest");

      if (decision.push) {
        const id = await enqueueUserPush(
          admin,
          tenantId,
          userId,
          {
            title: label,
            body,
            url: BITACORA_MOBILE_HOY_PATH,
            tag,
          },
          logger,
        );
        if (id) {
          enqueued = true;
          pushed += 1;
        }
      }

      if (decision.telegram) {
        await sendTelegramToUser(
          admin,
          userId,
          `${label}\n\n${body}\n\n${SITE_URL}${BITACORA_MOBILE_HOY_PATH}`,
          logger,
        );
      }
    }

    if (enqueued) await drainOperarioPushOutbox(admin, logger);

    return { tenant_id: tenantId, persons: byPerson.size, pushed, skipped };
  } catch (err) {
    return {
      tenant_id: tenantId,
      persons: 0,
      pushed: 0,
      skipped: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
