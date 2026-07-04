/**
 * Endpoints /api/studio/push/subscribe (SDD-0146 Fase 5 · multi-dispositivo).
 *
 * POST: registra/renueva una PushSubscription del user en `user_push_subscriptions`
 *   (N dispositivos por user) + setea `channel_push=true`. La IDENTIDAD sale SOLO
 *   de la sesión (`supabase.auth.getUser()`) — NUNCA del body (un user_id ajeno en
 *   el JSON se ignora). Delete-then-insert por endpoint: si el mismo dispositivo lo
 *   compartió otro user, el endpoint se re-vincula al de la sesión.
 *
 * DELETE: borra la sub del user por endpoint (body {endpoint}); si no queda ninguna
 *   fila del user, apaga `channel_push`. (Antes ponía channel_push=false global aunque
 *   el user tuviera otro dispositivo activo — hallazgo "rompe" mono-dispositivo.)
 *
 * Auth: caller logueado. La tabla tiene RLS self; el delete-por-endpoint del rebind
 * (que puede tocar la fila de OTRO user en un dispositivo compartido) usa el admin
 * client tras verificar la sesión.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { apiError } from "@/lib/http/api-error";

interface PushSubscriptionPayload {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
  expirationTime?: number | null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const userId = userResp.user.id;

  let body: { subscription?: PushSubscriptionPayload };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body inválido — esperamos JSON." },
      { status: 400 },
    );
  }

  const sub = body.subscription;
  if (!sub || typeof sub.endpoint !== "string" || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json(
      { error: "Subscription inválida: faltan endpoint + keys.p256dh + keys.auth." },
      { status: 400 },
    );
  }

  // tenant_id server-side (jamás del body). Sin membership activo → no es staff.
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .eq("user_id", userId)
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) {
    return NextResponse.json(
      { error: "Sin acceso al Studio." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;

  // Delete-then-insert por endpoint (rebind en dispositivo compartido: el endpoint
  // es único global). El admin client puede borrar la fila de otro user; el insert
  // va SIEMPRE con el user_id de la SESIÓN.
  await admin.from("user_push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error: insErr } = await admin.from("user_push_subscriptions").insert({
    tenant_id: link.tenant_id,
    user_id: userId,
    endpoint: sub.endpoint,
    subscription: sub as unknown as Record<string, unknown>,
    user_agent: userAgent,
    last_used_at: new Date().toISOString(),
  });
  if (insErr) {
    return apiError("No se pudo guardar la subscription.", insErr, 500, "push:subscribe");
  }

  // channel_push=true (upsert self: si no hay fila, la crea con los demás defaults).
  const { error: prefErr } = await supabase.from("user_notification_prefs").upsert(
    {
      user_id: userId,
      channel_push: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (prefErr) {
    return apiError("No se pudo activar el push.", prefErr, 500, "push:subscribe");
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const userId = userResp.user.id;

  let endpoint: string | null = null;
  try {
    const body = (await request.json()) as { endpoint?: unknown };
    endpoint = typeof body.endpoint === "string" ? body.endpoint : null;
  } catch {
    // Body opcional: sin endpoint borramos TODAS las subs del user (opt-out total).
  }

  let del = supabase
    .from("user_push_subscriptions")
    .delete()
    .eq("user_id", userId);
  if (endpoint) del = del.eq("endpoint", endpoint);
  const { error: delErr } = await del;
  if (delErr) {
    return apiError("No se pudo desuscribir.", delErr, 500, "push:unsubscribe");
  }

  // channel_push=false SOLO si al user no le queda ningún dispositivo.
  const { count } = await supabase
    .from("user_push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (!count || count === 0) {
    const { error: prefErr } = await supabase
      .from("user_notification_prefs")
      .update({ channel_push: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (prefErr) {
      return apiError("No se pudo desactivar el push.", prefErr, 500, "push:unsubscribe");
    }
  }

  return NextResponse.json({ ok: true });
}
