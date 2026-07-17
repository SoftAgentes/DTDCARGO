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
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { drainClientNotifications } from "@/lib/studio/notifications/drain-client-notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "CRON_SECRET no configurado" };
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return { ok: true };
  return { ok: false, reason: "Forbidden" };
}

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  const admin = createAdminClient();
  const result = await drainClientNotifications(admin);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
