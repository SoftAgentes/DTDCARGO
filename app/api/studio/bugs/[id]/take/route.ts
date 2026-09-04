/**
 * /api/studio/bugs/[id]/take · POST
 *
 * Admin presiona "Tomar bug" en el drawer → estado pasa a 'triaje' +
 * taken_by/taken_at se setean en el bug_advance_state RPC.
 *
 * Wrapper de conveniencia sobre /state con new_state='triaje'.
 *
 * SDD-0036 Fase 1.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { createRequestLogger } from "@/lib/observability/structured-logger";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const logger = createRequestLogger(request, "api.studio.bugs.take");
  const respond = (body: Record<string, unknown>, status = 200) =>
    logger.withResponse(NextResponse.json(body, { status }));
  const { id } = await params;
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return respond({ error: "No autorizado." }, 401);
  }

  const { data, error } = await supabase.rpc("bug_advance_state", {
    p_bug_id: id,
    p_new_state: "triaje",
    p_note: "Bug tomado por admin",
  });

  if (error) {
    const status =
      error.code === "P0001"
        ? 404
        : error.code === "42501"
          ? 403
          : error.code === "P0002" || error.code === "P0003"
            ? 409
            : 500;
    const message =
      status === 404
        ? "Bug no encontrado."
        : status === 403
          ? "No tienes permiso para tomar este bug."
          : status === 409
            ? "El bug no está en un estado que permita tomarlo."
            : "No pudimos tomar el bug.";
    if (status === 500) {
      logger.error("bug_workflow.rpc_failed", {
        error,
        operation: "take",
        stage: "advance_state",
        status,
      });
    }
    return respond({ error: message }, status);
  }

  return respond({ ok: true, bug: data });
}
