/**
 * POST /api/portal/push/subscribe — el CLIENTE del portal opta-in a Web Push
 * (SDD-0148 #3b). El cliente es `auth.users` (magic-link), así que su push vive en
 * la MISMA tabla `user_push_subscriptions` que el staff (RLS self). Resolvemos su
 * principal Portal completo (vínculo activo + cliente vivo + tenant coherente)
 * antes de elevar, y hacemos upsert por endpoint.
 *
 * Body: el PushSubscription serializado (sub.toJSON()):
 *   { endpoint, keys: { p256dh, auth }, expirationTime? }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";
import { parsePushSubscription } from "@/lib/studio/notify/push-subscription";

export async function POST(req: Request) {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  }

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user?.id) {
    return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  }
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) {
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
  );
  const sub = parsePushSubscription(raw);
  if (!sub) {
    return NextResponse.json(
      { error: "Suscripción no válida. Vuelve a activar las notificaciones desde tu navegador." },
      { status: 422 },
    );
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "No se pudo guardar la suscripción." },
      { status: 500 },
    );
  }

  // Upsert por endpoint (unique). Si el endpoint ya existía (otro user en el mismo
  // browser), se re-asigna al cliente actual con su tenant.
  const { error } = await admin.from("user_push_subscriptions").upsert(
    {
      tenant_id: principal.tenantId,
      user_id: principal.userId,
      endpoint: sub.endpoint,
      subscription: sub,
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
