/**
 * POST /api/m/push/subscribe — registrar Web Push subscription (Sprint 4).
 *
 * El operario (PIN auth · cookie dtd_op) opta-in a push. El browser le da
 * un PushSubscription; lo guardamos en operario_push_subscriptions.
 *
 * Upsert por endpoint: si el operario re-suscribe (re-instala la PWA), el
 * endpoint cambia y queda una row nueva; el viejo se limpia solo al
 * fallar con 410 desde el worker drain.
 *
 * Body: el PushSubscription serializado (subscription.toJSON()):
 *   { endpoint, keys: { p256dh, auth }, expirationTime? }
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { createRequestLogger } from "@/lib/observability/structured-logger";
import { parsePushSubscription } from "@/lib/studio/notify/push-subscription";

export async function POST(req: Request) {
  const logger = createRequestLogger(req, "api.m.push.subscribe");
  const respond = (body: Record<string, unknown>, status = 200) =>
    logger.withResponse(NextResponse.json(body, { status }));

  const session = await getCurrentOperario();
  if (!session) {
    return respond({ error: "Sesión inválida." }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return respond({ error: "Body inválido." }, 422);
  }

  const sub = parsePushSubscription(body);
  if (!sub) {
    return respond(
      { error: "Suscripción no válida. Vuelve a activar las notificaciones desde tu navegador." },
      422,
    );
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  const admin = createAdminClient();

  // Upsert por endpoint (unique). Si ya existe para otro operario (móvil
  // compartido entre operarios), re-asignamos al operario actual.
  const { error } = await admin.from("operario_push_subscriptions").upsert(
    {
      tenant_id: session.tenant_id,
      operario_id: session.operario_id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: userAgent,
      failure_count: 0,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    logger.error("mobile_push.subscription_failed", {
      error,
      operation: "subscribe",
      stage: "upsert",
    });
    return respond({ error: "No se pudo guardar la suscripción." }, 500);
  }

  return respond({ ok: true });
}
