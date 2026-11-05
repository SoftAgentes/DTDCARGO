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
 *   2. Push browser · enqueueUserPush (outbox SDD-0146, Web Push + VAPID)
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
 * Outbox durable (P3, SDD-0036 Fase 5): el intento inline sigue siendo el
 * camino feliz (respuesta rápida), pero un fallo YA NO se pierde:
 *  - Push encola en el outbox de SDD-0146 (`enqueueUserPush` +
 *    `drainOperarioPushOutbox`, cron `/api/cron/push-drain` cada minuto).
 *  - Email/Telegram: un fallo marca `<canal>_attempts`/`<canal>_last_error`
 *    en la fila (migración 0232) y el cron `/api/cron/bug-notifications-drain`
 *    reintenta hasta 5 veces (lib/studio/notify/bug-notif-outbox.ts).
 *
 * NO cubre todavía:
 *  - Templates específicos por tipo de notif (1 template genérico cubre los 3).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/studio/mail/send-email";
import {
  enqueueUserPush,
  drainOperarioPushOutbox,
} from "@/lib/studio/notify/operario-push-outbox";
import { recordBugNotifChannelFailure } from "@/lib/studio/notify/bug-notif-outbox";
import { writeInAppNotification } from "@/lib/studio/notify/write-inapp";
import {
  resolveUserEmail,
  resolveUserDisplayName,
} from "@/lib/studio/notify/resolve-recipient";
import { sendTelegramMessage } from "@/lib/studio/telegram/send-message";
import { resolveCategoryChatIds } from "@/lib/studio/telegram/alert-routing";
import { sendDiscordCategoryAlert } from "@/lib/studio/alerts/dispatch-alert";
import { sendDiscordMentionToUser } from "@/lib/studio/alerts/user-alert";
import type { MinimalAlert } from "@/lib/studio/discord/minimal-alert";
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

// writeInAppNotification vive ahora en ./notify/write-inapp (extraída y
// generalizada para Bitácora SDD-0146: bugId opcional + exclusión del actor).
// Se reexporta acá por si algún import viejo la buscaba en este módulo; los
// call-sites de bugs la llaman con { userId, bugId, type, payload } → sin actorId
// → comportamiento idéntico al original.
export { writeInAppNotification };

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

    // SDD-0271 · si la categoría `bugs` tiene destino configurado, el Telegram
    // sale por ahí: UNA vez, al chat que eligió el founder, sin depender de
    // quién tenga `channel_telegram` encendido.
    //
    // ⚠️ Este camino NO pasa por el outbox de reintentos (`bug_notifications`),
    // porque esa tabla es por USUARIO y un chat de categoría no es de nadie: un
    // fallo se loguea, no se reintenta. El camino per-admin de abajo —el que
    // corre cuando no hay rutas— conserva el outbox intacto.
    //
    // SDD-0606 · Discord va primero: al canal de bugs, con el folio y el
    // enlace, SIN el título del bug ni el nombre de quien lo reportó. Si
    // entrega, no sale ningún Telegram por este aviso.
    const bugEnDiscord = await sendDiscordCategoryAlert(
      supabaseAdmin,
      "bugs",
      { titulo: notifLabel, codigo: bug.folio, url: `${SITE_URL}${bugUrlPath}` },
      { logTag: "bug-admin" },
    );
    const routedBugChats = bugEnDiscord.delivered
      ? []
      : await resolveCategoryChatIds(supabaseAdmin, tenantId, "bugs");
    if (routedBugChats.length > 0) {
      const text = `${notifLabel} · ${bug.folio}\n\n${bug.title}\nReportado por ${reporterName}.\n\n${SITE_URL}${bugUrlPath}`;
      for (const chatId of routedBugChats) {
        const res = await sendTelegramMessage(chatId, text);
        if (!res.ok) {
          console.error("[bug-email-notify] telegram ruteado falló:", res.error);
        }
      }
    }

    for (const admin of admins) {
      const channels = await resolveChannels(
        supabaseAdmin,
        admin.user_id,
        "critical_alert",
      );

      // Fila del outbox: ancla de retry para email/push/telegram (P3), no solo
      // campanita — se crea si CUALQUIER canal va a intentar algo, aunque el
      // admin haya apagado in-app (markDelivered la deja sin marcar leída/vista).
      const excerpt = `Reportado por ${reporterName}.`;
      const actionLabel = "Ver bug en el Studio";
      const anyChannel =
        channels.inapp || channels.email || channels.push || channels.telegram;
      const notifId = anyChannel
        ? await writeInAppNotification(supabaseAdmin, {
            userId: admin.user_id,
            bugId: bug.id,
            type: "critical_alert",
            payload: {
              folio: bug.folio,
              title: bug.title,
              label: notifLabel,
              excerpt,
              url: bugUrlPath,
              actionLabel,
            },
            markDelivered: channels.inapp,
          })
        : null;

      // Email (puede skip-ar si Resend no está configurado) · fallo → outbox P3.
      if (channels.email) {
        const result = await sendBugNotification(supabaseAdmin, tenantId, {
          to: admin.email,
          bug,
          notifTypeLabel: notifLabel,
          recipientName: "Equipo admin",
          messageExcerpt: excerpt,
          bugUrlPath,
          actionLabel,
        });
        if (result.ok) {
          await stampDelivered(supabaseAdmin, notifId, "delivered_email_at");
        } else if (notifId) {
          await recordBugNotifChannelFailure(supabaseAdmin, notifId, "email", 0, result.error);
        }
      }

      // Push browser · encola en el outbox durable de SDD-0146
      // (outbox_push_events + cron push-drain cada minuto) en vez de mandar
      // directo — 5 reintentos gratis, sin infraestructura nueva (P3).
      if (channels.push) {
        const pushId = await enqueueUserPush(supabaseAdmin, tenantId, admin.user_id, {
          title: `${notifLabel} · ${bug.folio}`,
          body: `${bug.title} — reportado por ${reporterName}`,
          url: bugUrlPath,
          tag: `bug-${bug.id}`,
          requireInteraction: bug.severity === "critica",
        });
        if (pushId) {
          await drainOperarioPushOutbox(supabaseAdmin); // near-instant; cron es backstop
          await stampDelivered(supabaseAdmin, notifId, "delivered_push_at");
        }
      }

      // Telegram · respeta channel_telegram (default OFF) + link. Fallo → outbox P3.
      // Sólo cuando la categoría `bugs` no tiene destino: si lo tiene, el aviso
      // ya salió arriba y repetirlo acá sería el duplicado que cierra SDD-0271.
      if (channels.telegram && routedBugChats.length === 0 && !bugEnDiscord.delivered) {
        const result = await sendBugTelegramToUser(supabaseAdmin, admin.user_id, {
          title: `${notifLabel} · ${bug.folio}`,
          body: `${bug.title}\nReportado por ${reporterName}.`,
          url: `${SITE_URL}${bugUrlPath}`,
        });
        if (result.ok) {
          await stampDelivered(supabaseAdmin, notifId, "delivered_telegram_at");
        } else if (notifId) {
          await recordBugNotifChannelFailure(supabaseAdmin, notifId, "telegram", 0, result.error);
        }
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

    const excerpt = "El admin actualizó el estado de tu reporte.";
    const actionLabel = "Ver mi reporte";
    const anyChannel =
      channels.inapp || channels.email || channels.push || channels.telegram;
    const notifId = anyChannel
      ? await writeInAppNotification(supabaseAdmin, {
          userId: bug.reporter_id,
          bugId: bug.id,
          type: notifType,
          payload: {
            folio: bug.folio,
            title: bug.title,
            state: bug.state,
            label: notifLabel,
            excerpt,
            url: bugUrlPath,
            actionLabel,
          },
          markDelivered: channels.inapp,
        })
      : null;

    if (channels.email && reporterEmail) {
      const result = await sendBugNotification(supabaseAdmin, tenantId, {
        to: reporterEmail,
        bug,
        notifTypeLabel: notifLabel,
        recipientName: reporterName,
        messageExcerpt: excerpt,
        bugUrlPath,
        actionLabel,
      });
      if (result.ok) {
        await stampDelivered(supabaseAdmin, notifId, "delivered_email_at");
      } else if (notifId) {
        await recordBugNotifChannelFailure(supabaseAdmin, notifId, "email", 0, result.error);
      }
    }

    if (channels.push) {
      const pushId = await enqueueUserPush(supabaseAdmin, tenantId, bug.reporter_id, {
        title: `${bug.folio} · ${stateLabel}`,
        body: `Tu reporte "${bug.title}" cambió a ${stateLabel}.`,
        url: bugUrlPath,
        tag: `bug-${bug.id}`,
      });
      if (pushId) {
        await drainOperarioPushOutbox(supabaseAdmin);
        await stampDelivered(supabaseAdmin, notifId, "delivered_push_at");
      }
    }

    if (channels.telegram) {
      const result = await sendBugTelegramToUser(supabaseAdmin, bug.reporter_id, {
        title: `${bug.folio} · ${stateLabel}`,
        body: `Tu reporte "${bug.title}" cambió a ${stateLabel}.`,
        url: `${SITE_URL}${bugUrlPath}`,
        discord: {
          titulo: "Tu reporte cambió de estado",
          codigo: bug.folio,
          url: `${SITE_URL}${bugUrlPath}`,
        },
      });
      if (result.ok) {
        await stampDelivered(supabaseAdmin, notifId, "delivered_telegram_at");
      } else if (notifId) {
        await recordBugNotifChannelFailure(supabaseAdmin, notifId, "telegram", 0, result.error);
      }
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

    const actionLabel = "Ver conversación";
    const anyChannel =
      channels.inapp || channels.email || channels.push || channels.telegram;
    const notifId = anyChannel
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
            actionLabel,
          },
          markDelivered: channels.inapp,
        })
      : null;

    if (channels.email && reporterEmail) {
      const result = await sendBugNotification(supabaseAdmin, tenantId, {
        to: reporterEmail,
        bug,
        notifTypeLabel: notifLabel,
        recipientName: reporterName,
        messageExcerpt: excerpt,
        bugUrlPath,
        actionLabel,
      });
      if (result.ok) {
        await stampDelivered(supabaseAdmin, notifId, "delivered_email_at");
      } else if (notifId) {
        await recordBugNotifChannelFailure(supabaseAdmin, notifId, "email", 0, result.error);
      }
    }

    if (channels.push) {
      const pushId = await enqueueUserPush(supabaseAdmin, tenantId, bug.reporter_id, {
        title: `${bug.folio} · Admin respondió`,
        body: excerpt,
        url: bugUrlPath,
        tag: `bug-${bug.id}`,
      });
      if (pushId) {
        await drainOperarioPushOutbox(supabaseAdmin);
        await stampDelivered(supabaseAdmin, notifId, "delivered_push_at");
      }
    }

    if (channels.telegram) {
      const result = await sendBugTelegramToUser(supabaseAdmin, bug.reporter_id, {
        title: `${bug.folio} · Admin respondió`,
        body: excerpt,
        url: `${SITE_URL}${bugUrlPath}`,
        discord: {
          titulo: "Respondieron tu reporte",
          codigo: bug.folio,
          url: `${SITE_URL}${bugUrlPath}`,
        },
      });
      if (result.ok) {
        await stampDelivered(supabaseAdmin, notifId, "delivered_telegram_at");
      } else if (notifId) {
        await recordBugNotifChannelFailure(supabaseAdmin, notifId, "telegram", 0, result.error);
      }
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
): Promise<{ ok: boolean; error?: string }> {
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
  return result;
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

/**
 * Envía notif por Telegram a un user. El gate de CONSENTIMIENTO
 * (`channel_telegram`, default OFF) se aplica upstream en `resolveChannels`
 * — acá solo resolvemos el chat_id (fuente de verdad: user_profiles, donde
 * lo escribe el flujo de link) y hacemos skip silencioso si no linkeó
 * (telegram_chat_id IS NULL) o si TELEGRAM_BOT_TOKEN no está configurado.
 *
 * Best-effort: nunca throwea. Devuelve {ok,error} para que el caller decida
 * si el fallo va al outbox de retry (P3) — antes se tragaba el error acá
 * mismo y la notif se perdía sin dejar rastro.
 */
async function sendBugTelegramToUser(
  supabaseAdmin: SupabaseClient,
  userId: string,
  payload: {
    title: string;
    body: string;
    url: string;
    /** SDD-0606 · lo mínimo para la mención en el canal de bugs de Discord. */
    discord?: MinimalAlert;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    // SDD-0606 · Discord primero: mención en el canal de bugs, si la persona
    // enlazó su ID. Si entrega, no hay Telegram. Si falla, se intenta su
    // Telegram; y si tampoco tiene, el fallo va al outbox para reintentar.
    let discordError: string | undefined;
    if (payload.discord) {
      const mencion = await sendDiscordMentionToUser(
        supabaseAdmin,
        userId,
        "bugs",
        payload.discord,
      );
      if (mencion.attempted && mencion.ok) return { ok: true };
      if (mencion.attempted) discordError = mencion.error ?? "Discord no entregó";
    }

    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("telegram_chat_id")
      .eq("user_id", userId)
      .maybeSingle<{ telegram_chat_id: string | null }>();

    const chatId = profile?.telegram_chat_id;
    if (!chatId) {
      // Sin Telegram: si Discord falló hay algo que reintentar; si no, no.
      return discordError ? { ok: false, error: discordError } : { ok: true };
    }

    // Plain text · evita escape hell de MarkdownV2.
    const text = `${payload.title}\n\n${payload.body}\n\n${payload.url}`;

    const result = await sendTelegramMessage(chatId, text);
    if (!result.ok) {
      console.error("[bug-email-notify] sendTelegramMessage failed:", result.error);
    }
    return result;
  } catch (err) {
    console.error("[bug-email-notify] sendBugTelegramToUser failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
