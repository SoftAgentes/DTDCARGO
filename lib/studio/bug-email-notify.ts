/**
 * Bug Reporter · notificaciones por email (SDD-0036 Fase 5 · mínimo viable).
 *
 * Wraps sendEmail con el template `bug_notification` para 3 casos:
 *   - notifyBugCreatedToAdmin: bug nuevo con severity alta/critica → email admin
 *   - notifyBugStateChangeToReporter: cambio de estado → email reportador
 *   - notifyBugMessageToReporter: admin respondió → email reportador
 *
 * Diseño:
 *  - Best-effort: errores se loggean a console.error pero NO se propagan
 *    (no rompe la operación principal del bug).
 *  - Resuelve email + nombre del destinatario internamente (admin client).
 *  - Si test_mode=true en mail_config, sendEmail redirige a internal_test_email.
 *
 * NO cubre (deferred al spec completo de F5):
 *  - Canales in-app, push browser, Telegram
 *  - Outbox bug_notifications (retry, status, idempotency)
 *  - user_notification_prefs check (asume todos quieren email)
 *  - Templates por tipo de notif (1 template genérico cubre los 3)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/studio/mail/send-email";
import { sendBugPushToUser } from "@/lib/studio/notify/send-bug-push";
import {
  BUG_STATE_LABELS,
  BUG_SEVERITY_LABELS,
  type BugSeverity,
  type BugState,
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
      // Email (puede skip-ar si Resend no está configurado)
      await sendBugNotification(supabaseAdmin, tenantId, {
        to: admin.email,
        bug,
        notifTypeLabel: notifLabel,
        recipientName: "Equipo admin",
        messageExcerpt: `Reportado por ${reporterName}.`,
        bugUrlPath,
        actionLabel: "Ver bug en el Studio",
      });

      // Push browser (skip silencioso si el admin no opted-in)
      await sendBugPushToUser(supabaseAdmin, admin.user_id, {
        title: `${notifLabel} · ${bug.folio}`,
        body: `${bug.title} — reportado por ${reporterName}`,
        url: bugUrlPath,
        tag: `bug-${bug.id}`,
        requireInteraction: bug.severity === "critica",
      });
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
    if (!reporterEmail) return;

    const reporterName = await resolveUserDisplayName(supabaseAdmin, bug.reporter_id);
    const stateLabel = BUG_STATE_LABELS[bug.state] ?? bug.state;
    const bugUrlPath = `/studio/mis-bugs?focus=${bug.id}`;

    await sendBugNotification(supabaseAdmin, tenantId, {
      to: reporterEmail,
      bug,
      notifTypeLabel: `Tu reporte cambió a ${stateLabel}`,
      recipientName: reporterName,
      messageExcerpt: "El admin actualizó el estado de tu reporte.",
      bugUrlPath,
      actionLabel: "Ver mi reporte",
    });

    await sendBugPushToUser(supabaseAdmin, bug.reporter_id, {
      title: `${bug.folio} · ${stateLabel}`,
      body: `Tu reporte "${bug.title}" cambió a ${stateLabel}.`,
      url: bugUrlPath,
      tag: `bug-${bug.id}`,
    });
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
    if (!reporterEmail) return;

    const reporterName = await resolveUserDisplayName(supabaseAdmin, bug.reporter_id);
    const excerpt =
      messageBody.length > 280 ? messageBody.slice(0, 277) + "…" : messageBody;
    const bugUrlPath = `/studio/mis-bugs?focus=${bug.id}`;

    await sendBugNotification(supabaseAdmin, tenantId, {
      to: reporterEmail,
      bug,
      notifTypeLabel: "El admin respondió tu reporte",
      recipientName: reporterName,
      messageExcerpt: excerpt,
      bugUrlPath,
      actionLabel: "Ver conversación",
    });

    await sendBugPushToUser(supabaseAdmin, bug.reporter_id, {
      title: `${bug.folio} · Admin respondió`,
      body: excerpt,
      url: bugUrlPath,
      tag: `bug-${bug.id}`,
    });
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
