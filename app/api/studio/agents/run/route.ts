/**
 * POST /api/studio/agents/run — endpoint del orchestrator (SDD-0020 Fase 2D).
 *
 * Body:
 *   {
 *     agent_id: string (uuid),
 *     trigger?: "manual" | "cron" | "webhook" | "event",  // default manual
 *     trigger_source?: string,
 *     input: Record<string, unknown>,
 *     idempotency_key?: string
 *   }
 *
 * Returns 200:
 *   {
 *     run_id, status, output, tool_calls,
 *     tokens_in, tokens_out, cost_usd, latency_ms
 *   }
 *
 * Errors:
 *   400 input inválido
 *   401 sin sesión válida
 *   403 ToolNotGranted (futuro)
 *   404 agent no encontrado / no pertenece al tenant
 *   409 budget excedido o agent no activo
 *   504 timeout
 *   500 runtime error
 *
 * V1 Fase 2D.1: usa MockLLMClient (sin gastar tokens). Fase 2D.2 cambia
 * la dep a AnthropicLLMClient sin tocar este endpoint ni el orchestrator.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { runAgent } from "@/lib/studio/agents/runtime/orchestrator";
import { createLLMClient } from "@/lib/studio/agents/runtime/llm-client-factory";
import {
  AgentRuntimeError,
} from "@/lib/studio/agents/runtime/errors";
import type { AgentRunTrigger } from "@/lib/studio/agent-types";

export const runtime = "nodejs";
export const maxDuration = 300;

const VALID_TRIGGERS: AgentRunTrigger[] = ["manual", "cron", "webhook", "event"];

function isTrigger(s: unknown): s is AgentRunTrigger {
  return typeof s === "string" && (VALID_TRIGGERS as string[]).includes(s);
}

export async function POST(request: Request) {
  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body inválido — esperamos JSON." },
      { status: 400 },
    );
  }

  const obj = (body ?? {}) as Record<string, unknown>;
  const agentId = typeof obj.agent_id === "string" ? obj.agent_id : null;
  const trigger: AgentRunTrigger = isTrigger(obj.trigger) ? obj.trigger : "manual";
  const triggerSource =
    typeof obj.trigger_source === "string" ? obj.trigger_source : undefined;
  const idempotencyKey =
    typeof obj.idempotency_key === "string" ? obj.idempotency_key : undefined;
  const input = (obj.input ?? {}) as Record<string, unknown>;

  if (!agentId) {
    return NextResponse.json(
      { error: "Falta `agent_id` en el body." },
      { status: 400 },
    );
  }
  if (typeof input !== "object" || input === null) {
    return NextResponse.json(
      { error: "`input` debe ser un objeto JSON." },
      { status: 400 },
    );
  }

  // Auth: el cliente regular usa cookies, si no hay sesión auth.getUser() devuelve null
  const supabaseUser = await createClient();
  const { data: userResp } = await supabaseUser.auth.getUser();
  if (!userResp.user) {
    return NextResponse.json(
      { error: "No autorizado — iniciá sesión primero." },
      { status: 401 },
    );
  }

  // Admin (service_role) — solo para audit
  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Runtime no configurado: ${msg}` },
      { status: 500 },
    );
  }

  // Ejecutar
  try {
    const result = await runAgent(
      {
        agentId,
        trigger,
        triggerSource,
        idempotencyKey,
        input,
      },
      {
        supabaseUser,
        supabaseAdmin,
        llmClient: createLLMClient(),
      },
    );

    return NextResponse.json({
      run_id: result.runId,
      status: result.status,
      output: result.output,
      tool_calls: result.toolCalls,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      cost_usd: result.costUsd,
      latency_ms: result.latencyMs,
    });
  } catch (err) {
    if (err instanceof AgentRuntimeError) {
      return NextResponse.json(
        { error: err.message, name: err.name },
        { status: err.httpStatus },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/studio/agents/run] runtime error:", err);
    return NextResponse.json(
      { error: `Runtime error: ${message}` },
      { status: 500 },
    );
  }
}
