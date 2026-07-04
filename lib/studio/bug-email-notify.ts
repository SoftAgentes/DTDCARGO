/**
 * Bug Reporter · notificaciones multi-canal (SDD-0036 Fase 5).
 *
 * 3 casos cubiertos:
 *   - notifyBugCreatedToAdmin: bug nuevo con severity alta/critica → admin(s)
 *   - notifyBugStateChangeToReporter: cambio de estado → reportador
 *   - notifyBugMessageToReporter: admin respondió → reportador
 *
 * 3 canales que dispara para cada caso:
 *   1. Email · sendEmail con template bug_notification (Resend)
 *   2. Push browser · sendBugPushToUser (Web Push + VAPID)
 *   3. Telegram · sendBugTelegramToUser (Bot API)
 *
 * Diseño:
 *  - Best-effort por canal: cada falla se loguea a console.error pero
 *    NO rompe la operación principal del bug ni los otros canales.
 *  - Cada evento respeta `user_notification_prefs` del destinatario (Fase 5 V1):
 *    se cargan una vez por destinatario y se ramifica por `channel_*` +
 *    el flag por-evento `notify_on_*`. Sin fila de prefs → defaults de la DB
 *    (in-app+email ON, push+telegram OFF, todos los eventos ON).
 *  - Canal in-app = una fila en `bug_notifications` (el outbox) por (user,
 *    evento), que alimenta la campanita. Los demás canales estampan su
 *    `delivered_*_at` en esa fila cuando envían.
 *  - Telegram respeta `channel_telegram` (default OFF): NO manda solo por
 *    estar linkeado. El chat_id sale de user_profiles.telegram_chat_id.
 *  - Si test_mode=true en mail_config, sendEmail redirige a internal_test_email.
 *
 * NO cubre todavía (P3, fuera de V1):
 *  - Outbox durable enqueue→drain con retry (hoy el dispatch es inline).
 *  - Templates específicos por tipo de notif (1 template genérico cubre los 3).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/studio/mail/send-email";
import { sendBugPushToUser } from "@/lib/studio/notify/send-bug-push";
import { sendTelegramMessage } from "@/lib/studio/telegram/send-message";
import {
  BUG_STATE_LABELS,
  BUG_SEVERITY_LABELS,
  type BugSeverity,
  type BugState,
  type BugNotifType,
  type UserNotificationPrefs,
} from "@/lib/studio/bug-types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface MinimalBugForNotify {
  id: string;
  folio: string;
  title: string;
  state: BugState;
  severity: BugSeverity | null;
  reporter_id: string;
}

/** Qué canales disparar para un destinatario+evento, tras aplicar prefs. */
interface ChannelDecision {
  inapp: boolean;
  email: boolean;
  push: boolean;
  telegram: boolean;
}

// ─────────────────────────────────────────────────────────────
// Preferencias · gate por canal + evento (Fase 5 V1)
// ─────────────────────────────────────────────────────────────

/**
 * Defaults que espeja la DB (`user_notification_prefs`): se usan cuando el
 * user todavía no tiene fila de preferencias. in-app+email ON, push+telegram
 * OFF, todos los eventos ON.
 */
const DEFAULT_PREFS = {
  channel_inapp: true,
  channel_push: false,
  channel_email: true,
  channel_telegram: false,
  notify_on_state_change: true,
  notify_on_admin_reply: true,
  notify_on_resolved: true,
  notify_on_critical: true,
} as const;

/** Mapea el tipo de notif al flag `notify_on_*` que lo habilita. */
function eventEnabled(
  prefs: Pick<
    UserNotificationPrefs,
    | "notify_on_state_change"
    | "notify_on_admin_reply"
    | "notify_on_resolved"
    | "notify_on_critical"
  >,
  type: BugNotifType,
): boolean {
  switch (type) {
    case "state_change":
      return prefs.notify_on_state_change;
    case "new_reply":
      return prefs.notify_on_admin_reply;
    case "resolved":
      return prefs.notify_on_resolved;
    case "critical_alert":
    case "duplicate_detected":
      return prefs.notify_on_critical;
    default:
      return true;
  }
}

/**
 * Decide qué canales disparar para un evento a partir de las prefs del
 * destinatario (o defaults si `null`): `channel_X && notify_on_<evento>`.
 * PURA (sin I/O) → testeable. Clave del fix de consentimiento de Telegram:
 * con prefs null, `channel_telegram` es false (default OFF) → no manda.
 */
/**
 * Mapea el estado destino de un bug al tipo de notif del cambio de estado.
 * PURA + testeada: guarda contra el pitfall es/en (el estado "resuelto" es
 * español del enum bug_state; el tipo "resolved" es inglés de bug_notif_type).
 */
export function stateChangeNotifType(state: BugState): BugNotifType {
  return state === "resuelto" ? "resolved" : "state_change";
}

export function computeChannelDecision(
  prefs: UserNotificationPrefs | null,
  type: BugNotifType,
): ChannelDecision {
  const p = prefs ?? DEFAULT_PREFS;
  const eventOn = eventEnabled(p, type);
  return {
    inapp: p.channel_inapp && eventOn,
    email: p.channel_email && eventOn,
    push: p.channel_push && eventOn,
    telegram: p.channel_telegram && eventOn,
  };
}

/**
 * Carga las prefs del destinatario (o defaults si no tiene fila) y decide
 * qué canales disparar. Best-effort: si la lectura falla, cae a defaults.
 */
async function resolveChannels(
  supabaseAdmin: SupabaseClient,
  userId: string,
  type: BugNotifType,
): Promise<ChannelDecision> {
  let prefs: UserNotificationPrefs | null = null;
  try {
    const { data } = await supabaseAdmin
      .from("user_notification_prefs")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    prefs = (data as UserNotificationPrefs | null) ?? null;
  } catch (err) {
    console.error("[bug-email-notify] resolveChannels prefs read failed:", err);
  }
  return computeChannelDecision(prefs, type);
}

/**
 * Escribe la fila del outbox in-app (alimenta la campanita). Idempotencia
 * razonable: si ya hay una fila NO leída del mismo (user, bug, type) en los
 * últimos 60s, no duplica (protege contra doble-dispatch del mismo evento).
 * Devuelve el id de la fila (para estampar delivered_*_at) o null si falló.
 */
async function writeInAppNotification(
  supabaseAdmin: SupabaseClient,
  args: {
    userId: string;
    bugId: string;
    type: BugNotifType;
    payload: Record<string, unknown>;
  },
): Promise<string | null> {
  try {
    const since = new Date(Date.now() - 60_000).toISOString();
    const { data: dup } = await supabaseAdmin
      .from("bug_notifications")
      .select("id")
      .eq("user_id", args.userId)
      .eq("bug_id", args.bugId)
      .eq("type", args.type)
      .is("read_at", null)
      .gte("created_at", since)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (dup) return dup.id;

    const { data, error } = await supabaseAdmin
      .from("bug_notifications")
      .insert({
        user_id: args.userId,
        bug_id: args.bugId,
        type: args.type,
        payload: args.payload,
        delivered_inapp_at: new Date().toISOString(),
      })
      .select("id")
      .single<{ id: string }>();
    if (error) {
      console.error("[bug-email-notify] writeInAppNotification failed:", error);
      return null;
    }
    return data.id;
  } catch (err) {
    console.error("[bug-email-notify] writeInAppNotification threw:", err);
    return null;
  }
}

/** Estampa un delivered_*_at en la fila del outbox (best-effort). */
async function stampDelivered(
  supabaseAdmin: SupabaseClient,
  notifId: string | null,
  column:
    | "delivered_email_at"
    | "delivered_push_at"
    | "delivered_telegram_at",
): Promise<void> {
  if (!notifId) return;
  try {
    await supabaseAdmin
      .from("bug_notifications")
      .update({ [column]: new Date().toISOString() })
      .eq("id", notifId);
  } catch (err) {
    console.error("[bug-email-notify] stampDelivered failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Bug nuevo con severity alta/critica → notif a admin(s) del tenant.
 * Si severity es baja/media/null, no notifica (evita ruido).
 */
export async function notifyBugCreatedToAdmin(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  bug: MinimalBugForNotify,
): Promise<void> {
  if (bug.severity !== "alta" && bug.severity !== "critica") return;

  try {
    const admins = await resolveAdminEntries(supabaseAdmin, tenantId);
    if (admins.length === 0) {
      console.warn("[bug-email-notify] No hay admins para notificar bug", bug.folio);
      return;
    }

    const reporterName = await resolveUserDisplayName(supabaseAdmin, bug.reporter_id);
    const notifLabel =
      bug.severity === "critica"
        ? "🔴 Bug crítico reportado"
        : "🟠 Bug de severidad alta";

    const bugUrlPath = `/studio/bugs?focus=${bug.id}`;

    for (const admin of admins) {
      const channels = await resolveChannels(
        supabaseAdmin,
        admin.user_id,
        "critical_alert",
      );

      // In-app (campanita) · alimenta el outbox si el admin no lo apagó.
      const notifId = channels.inapp
        ? await writeInAppNotification(supabaseAdmin, {
            userId: admin.user_id,
            bugId: bug.id,
            type: "critical_alert",
            payload: {
              folio: bug.folio,
              title: bug.title,
              label: notifLabel,
              excerpt: `Reportado por ${reporterName}.`,
              url: bugUrlPath,
            },
          })
        : null;

      // Email (puede skip-ar si Resend no está configurado)
      if (channels.email) {
        await sendBugNotification(supabaseAdmin, tenantId, {
          to: admin.email,
          bug,
          notifTypeLabel: notifLabel,
          recipientName: "Equipo admin",
          messageExcerpt: `Reportado por ${reporterName}.`,
          bugUrlPath,
          actionLabel: "Ver bug en el Studio",
        });
        await stampDelivered(supabaseAdmin, notifId, "delivered_email_at");
      }

      // Push browser (skip silencioso si el admin no opted-in)
      if (channels.push) {
        await sendBugPushToUser(supabaseAdmin, admin.user_id, {
          title: `${notifLabel} · ${bug.folio}`,
          body: `${bug.title} — reportado por ${reporterName}`,
          url: bugUrlPath,
          tag: `bug-${bug.id}`,
          requireInteraction: bug.severity === "critica",
        });
        await stampDelivered(supabaseAdmin, notifId, "delivered_push_at");
      }

      // Telegram · respeta channel_telegram (default OFF) + link.
      if (channels.telegram) {
        await sendBugTelegramToUser(supabaseAdmin, admin.user_id, {
          title: `${notifLabel} · ${bug.folio}`,
          body: `${bug.title}\nReportado por ${reporterName}.`,
          url: `${SITE_URL}${bugUrlPath}`,
        });
        await stampDelivered(supabaseAdmin, notifId, "delivered_telegram_at");
      }
    }
  } catch (err) {
    console.error("[bug-email-notify] notifyBugCreatedToAdmin failed:", err);
  }
}

/**
 * Admin cambió el estado del bug → notif al reportador.
 * Solo notifica si el actor NO es el mismo reportador (auto-notif sin sentido).
 */
export async function notifyBugStateChangeToReporter(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  bug: MinimalBugForNotify,
  actorId: string,
): Promise<void> {
  if (actorId === bug.reporter_id) return;

  try {
    const reporterEmail = await resolveUserEmail(supabaseAdmin, bug.reporter_id);
    const reporterName = await resolveUserDisplayName(supabaseAdmin, bug.reporter_id);
    const stateLabel = BUG_STATE_LABELS[bug.state] ?? bug.state;
    const bugUrlPath = `/studio/mis-bugs?focus=${bug.id}`;
    const notifType = stateChangeNotifType(bug.state);
    const notifLabel = `Tu reporte cambió a ${stateLabel}`;

    const channels = await resolveChannels(
      supabaseAdmin,
      bug.reporter_id,
      notifType,
    );

    const notifId = channels.inapp
      ? await writeInAppNotification(supabaseAdmin, {
          userId: bug.reporter_id,
          bugId: bug.id,
          type: notifType,
          payload: {
            folio: bug.folio,
            title: bug.title,
            state: bug.state,
            label: notifLabel,
            url: bugUrlPath,
          },
        })
      : null;

    if (channels.email && reporterEmail) {
      await sendBugNotification(supabaseAdmin, tenantId, {
        to: reporterEmail,
        bug,
        notifTypeLabel: notifLabel,
        recipientName: reporterName,
        messageExcerpt: "El admin actualizó el estado de tu reporte.",
        bugUrlPath,
        actionLabel: "Ver mi reporte",
      });
      await stampDelivered(supabaseAdmin, notifId, "delivered_email_at");
    }

    if (channels.push) {
      await sendBugPushToUser(supabaseAdmin, bug.reporter_id, {
        title: `${bug.folio} · ${stateLabel}`,
        body: `Tu reporte "${bug.title}" cambió a ${stateLabel}.`,
        url: bugUrlPath,
        tag: `bug-${bug.id}`,
      });
      await stampDelivered(supabaseAdmin, notifId, "delivered_push_at");
    }

    if (channels.telegram) {
      await sendBugTelegramToUser(supabaseAdmin, bug.reporter_id, {
        title: `${bug.folio} · ${stateLabel}`,
        body: `Tu reporte "${bug.title}" cambió a ${stateLabel}.`,
        url: `${SITE_URL}${bugUrlPath}`,
      });
      await stampDelivered(supabaseAdmin, notifId, "delivered_telegram_at");
    }
  } catch (err) {
    console.error("[bug-email-notify] notifyBugStateChangeToReporter failed:", err);
  }
}

/**
 * Admin respondió un mensaje en el hilo → notif al reportador.
 */
export async function notifyBugMessageToReporter(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  bug: MinimalBugForNotify,
  messageBody: string,
  authorId: string,
): Promise<void> {
  if (authorId === bug.reporter_id) return;

  try {
    const reporterEmail = await resolveUserEmail(supabaseAdmin, bug.reporter_id);
    const reporterName = await resolveUserDisplayName(supabaseAdmin, bug.reporter_id);
    const excerpt =
      messageBody.length > 280 ? messageBody.slice(0, 277) + "…" : messageBody;
    const bugUrlPath = `/studio/mis-bugs?focus=${bug.id}`;
    const notifLabel = "El admin respondió tu reporte";

    const channels = await resolveChannels(
      supabaseAdmin,
      bug.reporter_id,
      "new_reply",
    );

    const notifId = channels.inapp
      ? await writeInAppNotification(supabaseAdmin, {
          userId: bug.reporter_id,
          bugId: bug.id,
          type: "new_reply",
          payload: {
            folio: bug.folio,
            title: bug.title,
            label: notifLabel,
            excerpt,
            url: bugUrlPath,
          },
        })
      : null;

    if (channels.email && reporterEmail) {
      await sendBugNotification(supabaseAdmin, tenantId, {
        to: reporterEmail,
        bug,
        notifTypeLabel: notifLabel,
        recipientName: reporterName,
        messageExcerpt: excerpt,
        bugUrlPath,
        actionLabel: "Ver conversación",
      });
      await stampDelivered(supabaseAdmin, notifId, "delivered_email_at");
    }

    if (channels.push) {
      await sendBugPushToUser(supabaseAdmin, bug.reporter_id, {
        title: `${bug.folio} · Admin respondió`,
        body: excerpt,
        url: bugUrlPath,
        tag: `bug-${bug.id}`,
      });
      await stampDelivered(supabaseAdmin, notifId, "delivered_push_at");
    }

    if (channels.telegram) {
      await sendBugTelegramToUser(supabaseAdmin, bug.reporter_id, {
        title: `${bug.folio} · Admin respondió`,
        body: excerpt,
        url: `${SITE_URL}${bugUrlPath}`,
      });
      await stampDelivered(supabaseAdmin, notifId, "delivered_telegram_at");
    }
  } catch (err) {
    console.error("[bug-email-notify] notifyBugMessageToReporter failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────
// Internal
// ─────────────────────────────────────────────────────────────

interface SendBugNotificationOpts {
  to: string;
  bug: MinimalBugForNotify;
  notifTypeLabel: string;
  recipientName: string;
  messageExcerpt: string;
  bugUrlPath: string;
  actionLabel: string;
}

async function sendBugNotification(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  opts: SendBugNotificationOpts,
): Promise<void> {
  const result = await sendEmail(supabaseAdmin, tenantId, {
    templateSlug: "bug_notification",
    to: opts.to,
    vars: {
      bug_folio: opts.bug.folio,
      bug_title: opts.bug.title,
      bug_state: BUG_STATE_LABELS[opts.bug.state] ?? opts.bug.state,
      bug_severity: opts.bug.severity
        ? BUG_SEVERITY_LABELS[opts.bug.severity] ?? opts.bug.severity
        : "—",
      notif_type_label: opts.notifTypeLabel,
      reporter_name: opts.recipientName,
      message_excerpt: opts.messageExcerpt,
      bug_url: `${SITE_URL}${opts.bugUrlPath}`,
      action_label: opts.actionLabel,
    },
    metadata: {
      source: "bug-email-notify",
      bug_id: opts.bug.id,
      bug_folio: opts.bug.folio,
    },
  });
  if (!result.ok) {
    console.error("[bug-email-notify] sendEmail failed:", result.error);
  }
}

async function resolveAdminEmails(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
): Promise<string[]> {
  const admins = await resolveAdminEntries(supabaseAdmin, tenantId);
  return admins.map((a) => a.email);
}

/**
 * Resuelve admins activos del tenant con {user_id, email}. Útil cuando
 * el caller necesita disparar push notifications además del email.
 */
async function resolveAdminEntries(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
): Promise<Array<{ user_id: string; email: string }>> {
  const { data, error } = await supabaseAdmin
    .from("user_tenants")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "admin")
    .is("disabled_at", null);

  if (error || !data || data.length === 0) return [];

  const ids = (data as Array<{ user_id: string }>).map((r) => r.user_id);
  const { data: users } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const usersList = users?.users ?? [];
  return usersList
    .filter((u) => ids.includes(u.id) && !!u.email)
    .map((u) => ({ user_id: u.id, email: u.email as string }));
}

async function resolveUserEmail(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

async function resolveUserDisplayName(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("first_name, last_name")
    .eq("user_id", userId)
    .maybeSingle<{ first_name: string | null; last_name: string | null }>();
  const name = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (name) return name;

  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  return userData?.user?.email ?? "Usuario";
}

/**
 * Envía notif por Telegram a un user. El gate de CONSENTIMIENTO
 * (`channel_telegram`, default OFF) se aplica upstream en `resolveChannels`
 * — acá solo resolvemos el chat_id (fuente de verdad: user_profiles, donde
 * lo escribe el flujo de link) y hacemos skip silencioso si no linkeó
 * (telegram_chat_id IS NULL) o si TELEGRAM_BOT_TOKEN no está configurado.
 *
 * Best-effort: errores se loguean pero no se propagan.
 */
async function sendBugTelegramToUser(
  supabaseAdmin: SupabaseClient,
  userId: string,
  payload: {
    title: string;
    body: string;
    url: string;
  },
): Promise<void> {
  try {
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("telegram_chat_id")
      .eq("user_id", userId)
      .maybeSingle<{ telegram_chat_id: string | null }>();

    const chatId = profile?.telegram_chat_id;
    if (!chatId) return;

    // Plain text · evita escape hell de MarkdownV2.
    const text = `${payload.title}\n\n${payload.body}\n\n${payload.url}`;

    const result = await sendTelegramMessage(chatId, text);
    if (!result.ok) {
      console.error("[bug-email-notify] sendTelegramMessage failed:", result.error);
    }
  } catch (err) {
    console.error("[bug-email-notify] sendBugTelegramToUser failed:", err);
  }
}
