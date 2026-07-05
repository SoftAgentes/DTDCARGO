/**
 * POST /api/portal/push/unsubscribe — el cliente del portal desactiva Web Push
 * (SDD-0148 #3b). Borra la fila de `user_push_subscriptions` por endpoint,
 * scopeada a su propio auth uid (defensa: no borra la de otro user).
 *
 * Body: { endpoint: string }
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 422 });
  }
  const endpoint =
    body && typeof (body as { endpoint?: unknown }).endpoint === "string"
      ? (body as { endpoint: string }).endpoint
      : null;
  if (!endpoint) {
    return NextResponse.json({ error: "Falta el endpoint." }, { status: 422 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
  if (error) {
    console.error("[portal push/unsubscribe] delete error:", error.message);
    return NextResponse.json(
      { error: "No se pudo desactivar." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
