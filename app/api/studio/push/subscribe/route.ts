/**
 * Endpoints /api/studio/push/subscribe
 *
 * POST: registra una PushSubscription del user actual en
 *   user_notification_prefs.push_subscription + setea channel_push=true.
 *
 * DELETE: borra push_subscription + setea channel_push=false (sin
 *   eliminar la row completa porque otros canales pueden seguir activos).
 *
 * Auth: caller debe estar logueado. La RLS de user_notification_prefs
 * es owner-only (user_id = auth.uid()), o sea cada user gestiona su
 * propia subscription.
 *
 * Body POST: JSON `{ subscription: PushSubscriptionJSON }`. El client
 * obtiene esto con `registration.pushManager.subscribe()`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
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

  // Upsert prefs: si la row no existe la crea; si existe, actualiza
  // push_subscription + channel_push=true.
  const { error } = await supabase.from("user_notification_prefs").upsert(
    {
      user_id: userResp.user.id,
      push_subscription: sub as unknown as Record<string, unknown>,
      channel_push: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return apiError("No se pudo guardar la subscription.", error, 500, "push:subscribe");
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { error } = await supabase
    .from("user_notification_prefs")
    .update({
      push_subscription: null,
      channel_push: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userResp.user.id);

  if (error) {
    return apiError("No se pudo desuscribir.", error, 500, "push:unsubscribe");
  }

  return NextResponse.json({ ok: true });
}
