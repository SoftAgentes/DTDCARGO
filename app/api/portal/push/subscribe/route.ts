/**
 * POST /api/portal/push/subscribe — el CLIENTE del portal opta-in a Web Push
 * (SDD-0148 #3b). El cliente es `auth.users` (magic-link), así que su push vive en
 * la MISMA tabla `user_push_subscriptions` que el staff (RLS self). Resolvemos su
 * auth uid de la sesión + su tenant de `client_users`, y upsert por endpoint.
 *
 * Body: el PushSubscription serializado (sub.toJSON()):
 *   { endpoint, keys: { p256dh, auth }, expirationTime? }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  }

  // Verifica que sea un cliente del portal + resuelve su tenant (RLS self).
  const { data: link } = await supabase
    .from("client_users")
    .select("tenant_id")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) {
    return NextResponse.json(
      { error: "Tu sesión no es un cliente del portal." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 422 });
  }

  // Acepta el sub crudo (lo que manda PortalPushOptIn) O envuelto en `{subscription}`
  // (lo que manda el `pushsubscriptionchange` del SW raíz, compartido con el Studio).
  const raw = (
    body && typeof body === "object" && "subscription" in body
      ? (body as { subscription: unknown }).subscription
      : body
  ) as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  const sub = raw;
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

  // Upsert por endpoint (unique). Si el endpoint ya existía (otro user en el mismo
  // browser), se re-asigna al cliente actual con su tenant.
  const { error } = await admin.from("user_push_subscriptions").upsert(
    {
      tenant_id: link.tenant_id,
      user_id: user.id,
      endpoint,
      subscription: raw as unknown as Record<string, unknown>,
      user_agent: userAgent,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    console.error("[portal push/subscribe] upsert error:", error.message);
    return NextResponse.json(
      { error: "No se pudo guardar la suscripción." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
