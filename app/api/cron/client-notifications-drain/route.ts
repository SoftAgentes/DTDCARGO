/**
 * /api/cron/client-notifications-drain — worker de la agenda de avisos al
 * cliente (SDD-0156 · Slice A).
 *
 * Drena client_notification_schedule (filas 'scheduled' vencidas) y despacha por
 * email/push. Dos disparadores:
 *  1. Vercel Cron (vercel.json · cada minuto) · backstop de durabilidad.
 *  2. Inline tras programar (drainClientNotifications in-process desde el motor).
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>` (mismo patrón que
 * push-drain / ceo-brief). El disparo inline NO pega a este endpoint.
 */
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { createCronRequestContext } from "@/lib/observability/cron-request-context";
import { drainClientNotifications } from "@/lib/studio/notifications/drain-client-notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cron = createCronRequestContext(req, "cron.client-notifications-drain");
  if (!cron.authorized) return cron.deny();

  try {
    const admin = createAdminClient();
    const result = await drainClientNotifications(admin, cron.logger);
    return cron.complete(
      { ok: true, ...result },
      {
        fields: {
          processed: result.processed,
          delivered: result.delivered,
          skipped: result.skipped,
          failed: result.failed,
        },
      },
    );
  } catch (error) {
    return cron.fail("No se pudo drenar la agenda de avisos.", error, {
      event: "cron.drain_failed",
      fields: { stage: "drain" },
    });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
