/**
 * POST /api/m/push/unsubscribe — borrar Web Push subscription (Sprint 4).
 *
 * El operario desactiva push desde el SettingsMenu / MenuModal. Borramos
 * la row por endpoint. Si el endpoint no se manda, borramos TODAS las del
 * operario (opt-out total).
 *
 * Body: { endpoint?: string }
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { createRequestLogger } from "@/lib/observability/structured-logger";

export async function POST(req: Request) {
  const logger = createRequestLogger(req, "api.m.push.unsubscribe");
  const respond = (body: Record<string, unknown>, status = 200) =>
    logger.withResponse(NextResponse.json(body, { status }));

  const session = await getCurrentOperario();
  if (!session) {
    return respond({ error: "Sesión inválida." }, 401);
  }

  let endpoint: string | null = null;
  try {
    const body = (await req.json()) as { endpoint?: unknown };
    endpoint = typeof body.endpoint === "string" ? body.endpoint : null;
  } catch {
    // Body opcional · sin él borramos todas las del operario
  }

  const admin = createAdminClient();
  let q = admin
    .from("operario_push_subscriptions")
    .delete()
    .eq("operario_id", session.operario_id);
  if (endpoint) q = q.eq("endpoint", endpoint);

  const { error } = await q;
  if (error) {
    logger.error("mobile_push.subscription_failed", {
      error,
      operation: "unsubscribe",
      stage: "delete",
    });
    return respond({ error: "No se pudo desuscribir." }, 500);
  }

  return respond({ ok: true });
}
