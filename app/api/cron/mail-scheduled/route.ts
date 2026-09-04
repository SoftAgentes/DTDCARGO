/**
 * /api/cron/mail-scheduled — procesa la cola de correos programados
 * (SDD-0143 Slice D · Programados).
 *
 * Toma los mail_scheduled con status='queued' y scheduled_for <= now() de
 * TODOS los tenants, envía cada uno con sendEmail() y marca 'sent' (con
 * sent_at + sent_log_id) o 'failed' (con error). Best-effort: un fallo en
 * uno no frena los demás.
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>` — mismo patrón que
 * purge-throttle / push-drain (solo header, nunca query-param). Admin client
 * (service_role) porque sendEmail inserta en mail_logs (bloqueado para
 * authenticated) y cruza tenants.
 */

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { createCronRequestContext } from "@/lib/observability/cron-request-context";
import { sendEmail } from "@/lib/studio/mail/send-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Techo por corrida · backstop anti-runaway. */
const BATCH_CAP = 200;

type DueRow = {
  id: string;
  tenant_id: string;
  to_email: string;
  to_name: string | null;
  cc: string[];
  bcc: string[];
  subject: string;
  body_html: string;
};

export async function GET(req: NextRequest) {
  const cron = createCronRequestContext(req, "cron.mail-scheduled");
  if (!cron.authorized) return cron.deny();

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due, error: dueErr } = await admin
    .from("mail_scheduled")
    .select("id, tenant_id, to_email, to_name, cc, bcc, subject, body_html")
    .eq("status", "queued")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(BATCH_CAP);

  if (dueErr) {
    return cron.fail(
      "No se pudo leer la cola de programados.",
      dueErr,
      { event: "cron.read_failed", fields: { stage: "read" } },
    );
  }

  const rows = (due ?? []) as DueRow[];
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const result = await sendEmail(admin, row.tenant_id, {
      to: row.to_email,
      to_name: row.to_name ?? undefined,
      cc: row.cc,
      bcc: row.bcc,
      subject: row.subject,
      html: row.body_html,
      metadata: { source: "cron:mail-scheduled", scheduled_id: row.id },
    });

    if (result.ok) {
      await admin
        .from("mail_scheduled")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          sent_log_id: result.logId,
          error: null,
        })
        .eq("id", row.id);
      sent += 1;
    } else {
      await admin
        .from("mail_scheduled")
        .update({ status: "failed", error: result.error })
        .eq("id", row.id);
      failed += 1;
    }
  }

  const summary = { ok: true, processed: rows.length, sent, failed };
  return cron.complete(summary, {
    fields: { processed: rows.length, sent, failed },
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
