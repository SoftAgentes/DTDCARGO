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
import { apiError } from "@/lib/http/api-error";
import { createRequestLogger } from "@/lib/observability/structured-logger";
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const logger = createRequestLogger(request, "api.studio.bugs.messages_list");
  const respond = (body: Record<string, unknown>, status = 200) =>
    logger.withResponse(NextResponse.json(body, { status }));
  const { id } = await params;
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return respond({ error: "No autorizado." }, 401);
  }
  try {
    const messages = await listBugMessages(supabase, id);
    return respond({ messages });
  } catch (err) {
    return logger.withResponse(
      apiError("No pudimos listar mensajes.", err, 500, "bugs:messages", {
        logger,
        event: "bug_workflow.messages_list_failed",
        fields: { operation: "list", stage: "query" },
      }),
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const logger = createRequestLogger(request, "api.studio.bugs.messages_post");
  const respond = (body: Record<string, unknown>, status = 200) =>
    logger.withResponse(NextResponse.json(body, { status }));
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond({ error: "JSON inválido." }, 400);
  }

  const raw = { ...(body as Partial<PostBugMessageInput>), bug_id: id };
  const { input, fieldErrors } = validatePostBugMessageInput(raw);
  if (fieldErrors || !input) {
    return respond({ error: "Datos inválidos.", fieldErrors }, 400);
  }

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return respond({ error: "No autorizado." }, 401);
  }

  // Resolver tenant + role del caller
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();
  if (!link?.tenant_id) {
    return respond({ error: "Sin tenant." }, 403);
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
    const status = msgErr.code === "42501" ? 403 : 500;
    logger.error("bug_workflow.message_create_failed", {
      error: msgErr,
      operation: "create_message",
      stage: "insert",
      status,
    });
    return respond({ error: "No pudimos publicar el mensaje." }, status);
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

  // Timeline entry + SDD-0036 F5 email notif (ambos via admin client)
  try {
    const supabaseAdmin = createAdminClient();
    await supabaseAdmin.from("bug_timeline").insert({
      bug_id: input.bug_id,
      event_type: "message",
      actor_id: userResp.user.id,
      actor_type: authorType,
      payload: { message_id: msg.id, preview: input.body.slice(0, 120) },
    });

    // Email notif: solo cuando admin respondió (no spammear admin con sus
    // propios reportes ni reportadores con sus propios mensajes)
    if (authorType === "admin") {
      const { data: bugRow } = await supabaseAdmin
        .from("bug_reports")
        .select("id, folio, title, state, severity, reporter_id")
        .eq("id", input.bug_id)
        .maybeSingle<{
          id: string;
          folio: string;
          title: string;
          state: string;
          severity: string | null;
          reporter_id: string;
        }>();
      if (bugRow) {
        const { notifyBugMessageToReporter } = await import(
          "@/lib/studio/bug-email-notify"
        );
        await notifyBugMessageToReporter(
          supabaseAdmin,
          link.tenant_id,
          {
            id: bugRow.id,
            folio: bugRow.folio,
            title: bugRow.title,
            state: bugRow.state as never,
            severity: bugRow.severity as never,
            reporter_id: bugRow.reporter_id,
          },
          input.body,
          userResp.user.id,
          logger,
        );
      }
    }
  } catch (err) {
    logger.error("bug_workflow.message_side_effect_failed", {
      error: err,
      operation: "create_message",
      stage: "timeline_or_notification",
    });
  }

  return respond({ ok: true, message: msg });
}
