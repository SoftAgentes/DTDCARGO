/**
 * Audit append-only del runtime (SDD-0020 Fase 2D).
 *
 * Escribe en `agent_runs` con cliente `service_role` — es la única forma
 * de garantizar que el audit se persiste incluso si el trigger no es un
 * user logueado (cron / webhook / event en futuras fases).
 *
 * RLS de `agent_runs` solo permite SELECT a authenticated; INSERT/UPDATE
 * van por acá con service_role.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AgentRunStatus,
  AgentRunTrigger,
  AgentToolCall,
} from "@/lib/studio/agent-types";

interface StartRunParams {
  agentId: string;
  tenantId: string;
  trigger: AgentRunTrigger;
  triggerSource?: string;
  idempotencyKey?: string;
  input: Record<string, unknown>;
}

/**
 * Crea la fila de `agent_runs` con `status='running'`. Si ya existía
 * una fila con el mismo `(agent_id, idempotency_key)` devuelve ese
 * `runId` (idempotency garantizada por UNIQUE constraint + ON CONFLICT).
 *
 * Returns: `{ runId, isReplay }`. `isReplay=true` significa que el caller
 * debe saltarse la ejecución y devolver el resultado existente.
 */
export async function startRun(
  admin: SupabaseClient,
  params: StartRunParams,
): Promise<{ runId: string; isReplay: boolean }> {
  // 1. Si hay idempotency_key, intentamos lookup antes de insert para
  //    devolver el run existente sin pelearle al UNIQUE constraint.
  if (params.idempotencyKey) {
    const { data: existing } = await admin
      .from("agent_runs")
      .select("id")
      .eq("agent_id", params.agentId)
      .eq("idempotency_key", params.idempotencyKey)
      .maybeSingle<{ id: string }>();
    if (existing?.id) {
      return { runId: existing.id, isReplay: true };
    }
  }

  // 2. Insert nuevo run
  const { data, error } = await admin
    .from("agent_runs")
    .insert({
      agent_id: params.agentId,
      tenant_id: params.tenantId,
      trigger: params.trigger,
      trigger_source: params.triggerSource ?? null,
      idempotency_key: params.idempotencyKey ?? null,
      input: params.input,
      status: "running" as AgentRunStatus,
      tool_calls: [],
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(
      `audit.startRun: no se pudo insertar el run: ${error?.message ?? "insert vacío"}`,
    );
  }
  return { runId: data.id, isReplay: false };
}

interface FinishRunParams {
  runId: string;
  status: AgentRunStatus;
  output?: Record<string, unknown> | null;
  toolCalls?: AgentToolCall[];
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  latencyMs?: number;
  error?: string;
}

export async function finishRun(
  admin: SupabaseClient,
  params: FinishRunParams,
): Promise<void> {
  const { error } = await admin
    .from("agent_runs")
    .update({
      status: params.status,
      output: params.output ?? null,
      tool_calls: params.toolCalls ?? [],
      tokens_in: params.tokensIn ?? null,
      tokens_out: params.tokensOut ?? null,
      cost_usd: params.costUsd ?? null,
      latency_ms: params.latencyMs ?? null,
      error: params.error ?? null,
      ended_at: new Date().toISOString(),
    })
    .eq("id", params.runId);

  if (error) {
    throw new Error(
      `audit.finishRun: no se pudo actualizar run ${params.runId}: ${error.message}`,
    );
  }
}
