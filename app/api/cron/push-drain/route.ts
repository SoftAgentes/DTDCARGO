/**
 * /api/cron/push-drain — worker drain del outbox de push (Sprint 4 v3).
 *
 * Drena outbox_push_events pending y los envía via Web Push. Dos disparadores:
 *  1. Vercel Cron (vercel.json · cada minuto) · backstop de durabilidad.
 *  2. Inline tras encolar (fire-and-forget desde las server actions) ·
 *     push casi-instantáneo sin esperar al cron.
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>` (Vercel Cron y
 * testing manual con curl -H). Mismo patrón que ceo-brief. El secret SOLO
 * por header — nunca por query-param (terminan en logs/referrers). El
 * disparo inline tras encolar NO pega a este endpoint: llama
 * drainOperarioPushOutbox() in-process, así que no necesita el secret.
 *
 * Idempotente: marca sent_at en cada envío OK, así una segunda corrida no
 * re-envía. Eventos sin subscription destino se marcan sent (no se
 * reintentan eternamente).
 */

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { createCronRequestContext } from "@/lib/observability/cron-request-context";
import { drainOperarioPushOutbox } from "@/lib/studio/notify/operario-push-outbox";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cron = createCronRequestContext(req, "cron.push-drain");
  if (!cron.authorized) return cron.deny();

  try {
    const admin = createAdminClient();
    const result = await drainOperarioPushOutbox(admin);
    return cron.complete(
      { ok: true, ...result },
      {
        fields: {
          processed: result.processed,
          delivered: result.delivered,
          failed: result.failed,
        },
      },
    );
  } catch (error) {
    return cron.fail("No se pudo drenar el outbox de push.", error, {
      event: "cron.drain_failed",
      fields: { stage: "drain" },
    });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
