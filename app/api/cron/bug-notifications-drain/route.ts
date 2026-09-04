/**
 * /api/cron/bug-notifications-drain — worker drain del outbox de
 * email/Telegram de bug_notifications (SDD-0036 Fase 5 · P3).
 *
 * Drena las filas con un fallo pendiente (`<canal>_attempts > 0`,
 * `delivered_<canal>_at is null`, `< 5` intentos) y reintenta el envío.
 * Espejo de /api/cron/push-drain y /api/cron/workflow-drain.
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>` (Vercel Cron + curl).
 * Solo por header, nunca por query-param. Idempotente: cada fila transiciona
 * a delivered_<canal>_at set (éxito) o incrementa attempts (fallo) — una
 * segunda corrida no re-envía las que ya tienen delivered_at.
 */

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { createCronRequestContext } from "@/lib/observability/cron-request-context";
import { drainBugNotificationOutbox } from "@/lib/studio/notify/bug-notif-outbox";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cron = createCronRequestContext(req, "cron.bug-notifications-drain");
  if (!cron.authorized) return cron.deny();

  try {
    const admin = createAdminClient();
    const result = await drainBugNotificationOutbox(admin);
    return cron.complete(
      { ok: true, ...result },
      {
        fields: {
          processed: result.email.processed + result.telegram.processed,
          delivered: result.email.delivered + result.telegram.delivered,
          failed: result.email.failed + result.telegram.failed,
        },
      },
    );
  } catch (error) {
    return cron.fail("No se pudo drenar el outbox de bugs.", error, {
      event: "cron.drain_failed",
      fields: { stage: "drain" },
    });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
