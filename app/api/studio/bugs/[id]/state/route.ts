/**
 * /api/studio/bugs/[id]/state · PATCH
 *
 * Cambia estado del bug via RPC bug_advance_state.
 * Solo admin del tenant (excepto reportador respondiendo a `espera`).
 *
 * Body: { new_state: BugState, note?: string }
 *
 * SDD-0036 Fase 1.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { notifyBugStateChangeToReporter } from "@/lib/studio/bug-email-notify";
import {
  validateAdvanceBugStateInput,
  type AdvanceBugStateInput,
} from "@/lib/studio/bug-types";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const raw = { ...(body as Partial<AdvanceBugStateInput>), bug_id: id };
  const { input, fieldErrors } = validateAdvanceBugStateInput(raw);
  if (fieldErrors || !input) {
    return NextResponse.json(
      { error: "Datos inválidos.", fieldErrors },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("bug_advance_state", {
    p_bug_id: input.bug_id,
    p_new_state: input.new_state,
    p_note: input.note,
  });

  if (error) {
    // P0001 bug no encontrado · P0002 terminal · P0003 transición no permitida · 42501 sin permisos
    const status =
      error.code === "P0001"
        ? 404
        : error.code === "42501"
          ? 403
          : error.code === "P0002" || error.code === "P0003"
            ? 409
            : 500;
    const message =
      error.code === "P0001"
        ? "Bug no encontrado."
        : error.code === "42501"
          ? "No tenés permiso para cambiar el estado de este bug."
          : error.code === "P0002"
            ? "El bug ya está en un estado final."
            : error.code === "P0003"
              ? "Esa transición de estado no está permitida."
              : "No pudimos cambiar el estado del bug.";
    if (status === 500) console.error("[bugs:state] rpc error:", error);
    return NextResponse.json({ error: message }, { status });
  }

  // SDD-0036 F5 · email notif al reportador (best-effort, no rompe respuesta)
  try {
    const supabaseAdmin = createAdminClient();
    const { data: bugRow } = await supabaseAdmin
      .from("bug_reports")
      .select("id, tenant_id, folio, title, state, severity, reporter_id")
      .eq("id", input.bug_id)
      .maybeSingle<{
        id: string;
        tenant_id: string;
        folio: string;
        title: string;
        state: string;
        severity: string | null;
        reporter_id: string;
      }>();
    if (bugRow) {
      await notifyBugStateChangeToReporter(
        supabaseAdmin,
        bugRow.tenant_id,
        {
          id: bugRow.id,
          folio: bugRow.folio,
          title: bugRow.title,
          state: bugRow.state as never,
          severity: bugRow.severity as never,
          reporter_id: bugRow.reporter_id,
        },
        userResp.user.id,
      );
    }
  } catch (err) {
    console.error("[bugs/state] notify failed:", err);
  }

  return NextResponse.json({ ok: true, bug: data });
}
