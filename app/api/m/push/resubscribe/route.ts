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
 *
 * SDD-0499 · los borrados de `old_endpoint` iban por endpoint pelado con el
 * admin client: quien conociera el endpoint de otro le apagaba las
 * notificaciones. Ahora se acotan al dueño, como ya hacía el hermano
 * `m/push/unsubscribe`. El rebind del endpoint NUEVO pide posesión — ver
 * `lib/studio/notify/push-rebind.ts`.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { parsePushSubscription } from "@/lib/studio/notify/push-subscription";
import {
  operarioPushRebindDenial,
  userPushRebindDenial,
} from "@/lib/studio/notify/push-rebind";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 422 });
  }

  const input = body !== null && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown> : null;
  const parsed = parsePushSubscription(input?.subscription);
  if (!parsed) {
    return NextResponse.json(
      { error: "Suscripción no válida. Vuelve a activar las notificaciones desde tu navegador." },
      { status: 422 },
    );
  }
  const oldEndpoint =
    typeof input?.old_endpoint === "string" ? input.old_endpoint : null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  const admin = createAdminClient();

  // 1) Operario (PIN) — reusa la lógica de operario_push_subscriptions.
  const operario = await getCurrentOperario();
  if (operario) {
    const denial = await operarioPushRebindDenial(
      admin,
      parsed.endpoint,
      operario.operario_id,
      parsed.keys.auth,
    );
    if (denial) return NextResponse.json({ error: denial }, { status: 409 });

    if (oldEndpoint) {
      // Acotado al operario de la sesión: `old_endpoint` es, por definición, el
      // endpoint anterior de QUIEN llama.
      await admin
        .from("operario_push_subscriptions")
        .delete()
        .eq("endpoint", oldEndpoint)
        .eq("operario_id", operario.operario_id);
    }
    const { error } = await admin.from("operario_push_subscriptions").upsert(
      {
        tenant_id: operario.tenant_id,
        operario_id: operario.operario_id,
        endpoint: parsed.endpoint,
        p256dh: parsed.keys.p256dh,
        auth: parsed.keys.auth,
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

  const denial = await userPushRebindDenial(
    admin,
    parsed.endpoint,
    userId,
    parsed.keys.auth,
  );
  if (denial) return NextResponse.json({ error: denial }, { status: 409 });

  // Dos borrados con alcances DISTINTOS a propósito:
  //   · `old_endpoint` es el endpoint anterior de quien llama → acotado a su
  //     user_id, igual que el molde de `portal/push/unsubscribe`.
  //   · `parsed.endpoint` va sin acotar porque el gate de arriba ya decidió que
  //     este llamador puede quedárselo (libre, suyo, o posesión demostrada), y
  //     el insert necesita el hueco: `endpoint` es único global.
  if (oldEndpoint) {
    await admin
      .from("user_push_subscriptions")
      .delete()
      .eq("endpoint", oldEndpoint)
      .eq("user_id", userId);
  }
  await admin
    .from("user_push_subscriptions")
    .delete()
    .eq("endpoint", parsed.endpoint);

  const { error } = await admin.from("user_push_subscriptions").insert({
    tenant_id: link.tenant_id,
    user_id: userId,
    endpoint: parsed.endpoint,
    subscription: parsed,
    user_agent: userAgent,
    last_used_at: new Date().toISOString(),
  });
  if (error) {
    console.error("[push/resubscribe] user insert:", error.message);
    return NextResponse.json({ error: "No se pudo renovar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, kind: "user" });
}
