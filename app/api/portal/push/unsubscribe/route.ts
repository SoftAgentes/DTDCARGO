/**
 * POST /api/portal/push/unsubscribe — el cliente del portal desactiva Web Push
 * (SDD-0148 #3b). Borra la fila de `user_push_subscriptions` por endpoint,
 * scopeada al auth uid de su principal Portal coherente (defensa: no borra la
 * de otro user y una sesión staff/retirada no usa esta ruta).
 *
 * Body: { endpoint: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { createRequestLogger } from "@/lib/observability/structured-logger";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";

export async function POST(req: Request) {
  const logger = createRequestLogger(req, "portal.push.unsubscribe");
  const respond = (
    body: { error: string } | { ok: true },
    init?: ResponseInit,
  ) => logger.withResponse(NextResponse.json(body, init));

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return respond({ error: "Sesión inválida." }, { status: 401 });
  }
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user?.id) {
    return respond({ error: "Sesión inválida." }, { status: 401 });
  }
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) {
    return respond(
      { error: "Tu sesión no es un cliente del portal." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return respond({ error: "Body inválido." }, { status: 422 });
  }
  const endpoint =
    body && typeof (body as { endpoint?: unknown }).endpoint === "string"
      ? (body as { endpoint: string }).endpoint
      : null;
  if (!endpoint) {
    return respond({ error: "Falta el endpoint." }, { status: 422 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return respond(
      { error: "No se pudo desactivar." },
      { status: 500 },
    );
  }
  const { error } = await admin
    .from("user_push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", principal.userId);
  if (error) {
    logger.error("portal_push.subscription_failed", {
      error,
      operation: "unsubscribe",
      stage: "write",
    });
    return respond(
      { error: "No se pudo desactivar." },
      { status: 500 },
    );
  }

  return respond({ ok: true });
}
