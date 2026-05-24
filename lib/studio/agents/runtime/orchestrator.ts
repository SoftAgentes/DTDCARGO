/**
 * Orchestrator: ejecuta un run end-to-end (SDD-0020 Fase 2D).
 *
 * Flujo:
 *  1. Resolver agent (RLS por tenant del operador)
 *  2. Verificar status === 'active'
 *  3. Verificar budget disponible
 *  4. startRun (audit) — si replay → devolver existente
 *  5. Cargar skill del code-registry (lib/studio/agents/skills/)
 *  6. Resolver tools (skill.tools_required ∩ registry global)
 *  7. Filtrar tools por grants reales del agent (agent_tool_grants)
 *  8. Llamar llmClient.run() (mock o Anthropic)
 *  9. finishRun con métricas
 *  10. update_agent_spend RPC → si excedió, status='paused'
 *
 * Si algo throwea, intenta cerrar el run con status='error' antes de
 * propagar el error.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Agent,
  AgentRunTrigger,
  AgentToolCall,
} from "@/lib/studio/agent-types";
import { getSkillDefBySlug } from "../skills/tracking-concierge";
import { resolveTools } from "./registry";
import {
  AgentNotActiveError,
  AgentNotFoundError,
  AgentRuntimeError,
  SkillNotFoundError,
} from "./errors";
import { assertBudgetAvailable } from "./policy-gates";
import { startRun, finishRun } from "./audit";
import type { AnyToolDef, LLMClient, RunResult } from "./types";

interface RunAgentParams {
  agentId: string;
  trigger: AgentRunTrigger;
  triggerSource?: string;
  idempotencyKey?: string;
  input: Record<string, unknown>;
}

interface RunAgentDeps {
  /** Cliente Supabase con JWT del operador — usado por tools y reads. */
  supabaseUser: SupabaseClient;
  /** Cliente Supabase con service_role — usado solo para audit. */
  supabaseAdmin: SupabaseClient;
  /** Cliente LLM (mock en Fase 2D.1, Anthropic real en 2D.2). */
  llmClient: LLMClient;
}

export async function runAgent(
  params: RunAgentParams,
  deps: RunAgentDeps,
): Promise<RunResult> {
  const { supabaseUser, supabaseAdmin, llmClient } = deps;
  const t0 = Date.now();

  // 1. Resolver agent (RLS preserva tenant)
  const { data: agent } = await supabaseUser
    .from("agents")
    .select(
      "id, tenant_id, skill_id, status, model, budget_usd_monthly, spend_usd_mtd, skill:skills(slug, name)",
    )
    .eq("id", params.agentId)
    .is("deleted_at", null)
    .maybeSingle<
      Pick<
        Agent,
        | "id"
        | "tenant_id"
        | "skill_id"
        | "status"
        | "model"
        | "budget_usd_monthly"
        | "spend_usd_mtd"
      > & {
        skill: { slug: string; name: string } | null;
      }
    >();

  if (!agent) throw new AgentNotFoundError(params.agentId);
  if (agent.status !== "active") throw new AgentNotActiveError(agent.status);

  // 2. Budget gate
  await assertBudgetAvailable(supabaseUser, agent.id);

  // 3. Cargar skill code-registry
  const skillSlug = agent.skill?.slug;
  if (!skillSlug) throw new SkillNotFoundError("<missing slug>");
  const skill = getSkillDefBySlug(skillSlug);
  if (!skill) throw new SkillNotFoundError(skillSlug);

  // 4. Resolver tools + filtrar por grants
  const candidateTools = resolveTools(skill.tools_required);
  const { data: grantRows } = await supabaseUser
    .from("agent_tool_grants")
    .select("tool_key")
    .eq("agent_id", agent.id);
  const grantedKeys = new Set(
    (grantRows ?? []).map((r) => (r as { tool_key: string }).tool_key),
  );
  const tools: AnyToolDef[] = candidateTools.filter((t) =>
    grantedKeys.has(t.key),
  );

  // 5. startRun (audit)
  const { runId, isReplay } = await startRun(supabaseAdmin, {
    agentId: agent.id,
    tenantId: agent.tenant_id,
    trigger: params.trigger,
    triggerSource: params.triggerSource,
    idempotencyKey: params.idempotencyKey,
    input: params.input,
  });

  if (isReplay) {
    // Replay: devolvemos el run existente sin re-ejecutar
    const { data: existing } = await supabaseUser
      .from("agent_runs")
      .select(
        "status, output, tool_calls, tokens_in, tokens_out, cost_usd, latency_ms, error",
      )
      .eq("id", runId)
      .maybeSingle();
    return {
      runId,
      status: (existing?.status ?? "ok") as RunResult["status"],
      output: (existing?.output ?? null) as RunResult["output"],
      toolCalls: ((existing?.tool_calls ?? []) as AgentToolCall[]),
      tokensIn: existing?.tokens_in ?? 0,
      tokensOut: existing?.tokens_out ?? 0,
      costUsd: existing?.cost_usd ?? 0,
      latencyMs: existing?.latency_ms ?? 0,
      error: existing?.error ?? undefined,
    };
  }

  // 6. Ejecutar el LLM
  try {
    const llmResponse = await llmClient.run({
      model: agent.model,
      systemPrompt: skill.system_prompt,
      input: params.input,
      tools,
      ctx: {
        supabase: supabaseUser,
        tenantId: agent.tenant_id,
        agentId: agent.id,
        runId,
      },
    });

    const latencyMs = Date.now() - t0;

    // 7. finishRun OK
    await finishRun(supabaseAdmin, {
      runId,
      status: "ok",
      output: llmResponse.output,
      toolCalls: llmResponse.toolCalls,
      tokensIn: llmResponse.tokensIn,
      tokensOut: llmResponse.tokensOut,
      costUsd: llmResponse.costUsd,
      latencyMs,
    });

    // 8. update_agent_spend RPC — auto-pause si excede
    if (llmResponse.costUsd > 0) {
      await supabaseAdmin.rpc("update_agent_spend", {
        p_agent_id: agent.id,
        p_cost_usd: llmResponse.costUsd,
      });
    }

    return {
      runId,
      status: "ok",
      output: llmResponse.output,
      toolCalls: llmResponse.toolCalls,
      tokensIn: llmResponse.tokensIn,
      tokensOut: llmResponse.tokensOut,
      costUsd: llmResponse.costUsd,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    const message = err instanceof Error ? err.message : String(err);
    const status: RunResult["status"] =
      err instanceof AgentRuntimeError && err.httpStatus === 504
        ? "timeout"
        : "error";

    // Intentamos cerrar el run con status error (best-effort)
    try {
      await finishRun(supabaseAdmin, {
        runId,
        status,
        latencyMs,
        error: message,
      });
    } catch {
      // si finishRun rompe, no podemos hacer mucho — el run queda en 'running'
      // y debería timeout-ear naturalmente. Loggeamos al stdout solo.
      console.error(`[orchestrator] failed to close run ${runId}`);
    }

    throw err;
  }
}
