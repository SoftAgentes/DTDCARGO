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

export async function POST(req: Request) {
  const session = await getCurrentOperario();
  if (!session) {
    return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 422 });
  }

  const sub = body as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  const endpoint = typeof sub.endpoint === "string" ? sub.endpoint : null;
  const p256dh =
    sub.keys && typeof sub.keys.p256dh === "string" ? sub.keys.p256dh : null;
  const auth =
    sub.keys && typeof sub.keys.auth === "string" ? sub.keys.auth : null;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "Subscription incompleta (endpoint/p256dh/auth)." },
      { status: 422 },
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
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
      failure_count: 0,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("[push/subscribe] upsert error:", error.message);
    return NextResponse.json(
      { error: "No se pudo guardar la suscripción." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
