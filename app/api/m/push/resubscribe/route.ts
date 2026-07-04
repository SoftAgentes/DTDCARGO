/**
 * POST /api/m/push/resubscribe — renueva una PushSubscription tras
 * `pushsubscriptionchange` (SDD-0146 Fase 5).
 *
 * El browser rota el endpoint (expiración / re-permiso) y el service worker
 * re-suscribe y postea acá. Identidad resuelta EN ORDEN:
 *   1. cookie `dtd_op` → operario (PIN) → operario_push_subscriptions.
 *   2. si no, sesión Supabase → user staff → user_push_subscriptions.
 * Reemplaza `old_endpoint` (si vino) por la nueva sub. Sin identidad → 401.
 *
 * Body: { old_endpoint?: string, subscription: { endpoint, keys:{p256dh,auth} } }
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { getCurrentOperario } from "@/lib/auth/operario-session";

interface SubIn {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

function parseSub(sub: SubIn | undefined) {
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : null;
  const p256dh =
    sub?.keys && typeof sub.keys.p256dh === "string" ? sub.keys.p256dh : null;
  const auth =
    sub?.keys && typeof sub.keys.auth === "string" ? sub.keys.auth : null;
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, p256dh, auth };
}

export async function POST(req: Request) {
  let body: { old_endpoint?: unknown; subscription?: SubIn };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 422 });
  }

  const parsed = parseSub(body.subscription);
  if (!parsed) {
    return NextResponse.json(
      { error: "Subscription incompleta (endpoint/p256dh/auth)." },
      { status: 422 },
    );
  }
  const oldEndpoint =
    typeof body.old_endpoint === "string" ? body.old_endpoint : null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  const admin = createAdminClient();

  // 1) Operario (PIN) — reusa la lógica de operario_push_subscriptions.
  const operario = await getCurrentOperario();
  if (operario) {
    if (oldEndpoint) {
      await admin
        .from("operario_push_subscriptions")
        .delete()
        .eq("endpoint", oldEndpoint);
    }
    const { error } = await admin.from("operario_push_subscriptions").upsert(
      {
        tenant_id: operario.tenant_id,
        operario_id: operario.operario_id,
        endpoint: parsed.endpoint,
        p256dh: parsed.p256dh,
        auth: parsed.auth,
        user_agent: userAgent,
        failure_count: 0,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) {
      console.error("[push/resubscribe] operario upsert:", error.message);
      return NextResponse.json({ error: "No se pudo renovar." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, kind: "operario" });
  }

  // 2) User staff (sesión Supabase) → user_push_subscriptions.
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  }
  const userId = userResp.user.id;

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .eq("user_id", userId)
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) {
    return NextResponse.json({ error: "Sin acceso al Studio." }, { status: 403 });
  }

  // Reemplazar old_endpoint + la fila del endpoint nuevo (rebind).
  const toDrop = [oldEndpoint, parsed.endpoint].filter(
    (e): e is string => typeof e === "string",
  );
  if (toDrop.length > 0) {
    await admin.from("user_push_subscriptions").delete().in("endpoint", toDrop);
  }
  const { error } = await admin.from("user_push_subscriptions").insert({
    tenant_id: link.tenant_id,
    user_id: userId,
    endpoint: parsed.endpoint,
    subscription: {
      endpoint: parsed.endpoint,
      keys: { p256dh: parsed.p256dh, auth: parsed.auth },
    },
    user_agent: userAgent,
    last_used_at: new Date().toISOString(),
  });
  if (error) {
    console.error("[push/resubscribe] user insert:", error.message);
    return NextResponse.json({ error: "No se pudo renovar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, kind: "user" });
}
