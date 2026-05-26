/**
 * /api/studio/bugs/[id]/messages
 *
 * POST · agrega mensaje al hilo del bug.
 *   Body: { body: string }
 *   author_type se infiere del role (admin → 'admin', else → 'user').
 *
 * Side-effect: si el caller es reporter y el bug está en 'espera',
 * el endpoint llama bug_advance_state(triaje) automáticamente
 * para destrabar el flujo (decisión D4 del handoff).
 *
 * GET · lista mensajes del bug (RLS filtra acceso).
 *
 * SDD-0036 Fase 1.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  listBugMessages,
  getBugDetail,
} from "@/lib/studio/bug-queries";
import {
  validatePostBugMessageInput,
  type PostBugMessageInput,
} from "@/lib/studio/bug-types";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const messages = await listBugMessages(supabase, id);
    return NextResponse.json({ messages });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "No pudimos listar mensajes.", detail: msg },
      { status: 500 },
    );
  }
}

export async function POST(
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

  const raw = { ...(body as Partial<PostBugMessageInput>), bug_id: id };
  const { input, fieldErrors } = validatePostBugMessageInput(raw);
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

  // Resolver tenant + role del caller
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();
  if (!link?.tenant_id) {
    return NextResponse.json({ error: "Sin tenant." }, { status: 403 });
  }

  const authorType: "admin" | "user" = link.role === "admin" ? "admin" : "user";

  // Insert message (RLS: caller debe ser reporter del bug o admin del tenant)
  const { data: msg, error: msgErr } = await supabase
    .from("bug_messages")
    .insert({
      bug_id: input.bug_id,
      author_id: userResp.user.id,
      author_type: authorType,
      body: input.body,
    })
    .select()
    .single();

  if (msgErr) {
    return NextResponse.json(
      { error: "No pudimos publicar el mensaje.", detail: msgErr.message },
      { status: msgErr.code === "42501" ? 403 : 500 },
    );
  }

  // Side-effect: si es reporter y bug está en 'espera' → auto-avanzar a triaje
  if (authorType === "user") {
    const bug = await getBugDetail(supabase, input.bug_id);
    if (bug && bug.state === "espera" && bug.reporter_id === userResp.user.id) {
      await supabase.rpc("bug_advance_state", {
        p_bug_id: input.bug_id,
        p_new_state: "triaje",
        p_note: "Auto: reportador respondió",
      });
    }
  }

  // Timeline entry (service_role)
  try {
    const supabaseAdmin = createAdminClient();
    await supabaseAdmin.from("bug_timeline").insert({
      bug_id: input.bug_id,
      event_type: "message",
      actor_id: userResp.user.id,
      actor_type: authorType,
      payload: { message_id: msg.id, preview: input.body.slice(0, 120) },
    });
  } catch {
    // Si no hay admin client, ignoramos timeline (no crítico)
  }

  return NextResponse.json({ ok: true, message: msg });
}
