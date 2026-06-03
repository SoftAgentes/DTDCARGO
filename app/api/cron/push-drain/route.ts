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

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { drainOperarioPushOutbox } from "@/lib/studio/notify/operario-push-outbox";

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
  const result = await drainOperarioPushOutbox(admin);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
