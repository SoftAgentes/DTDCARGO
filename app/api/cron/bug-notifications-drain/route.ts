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

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { drainBugNotificationOutbox } from "@/lib/studio/notify/bug-notif-outbox";
import { drainAlertOutbox } from "@/lib/studio/alerts/alert-outbox";
import { matchesBearerSecret } from "@/lib/http/secret-compare";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "CRON_SECRET no configurado" };
  const auth = req.headers.get("authorization");
  if (matchesBearerSecret(auth, secret)) return { ok: true };
  return { ok: false, reason: "Forbidden" };
}

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  const admin = createAdminClient();
  const result = await drainBugNotificationOutbox(admin);
  // SDD-0606 · la cola de avisos a Discord se drena en el mismo tick (cada 5
  // min, infra/dtd-cargo/cron/crontab): sin entrada nueva en el crontab.
  const alertas = await drainAlertOutbox(admin);
  return NextResponse.json({ ok: true, ...result, alertas });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
