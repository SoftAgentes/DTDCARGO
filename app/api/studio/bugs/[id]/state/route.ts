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
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status },
    );
  }

  return NextResponse.json({ ok: true, bug: data });
}
