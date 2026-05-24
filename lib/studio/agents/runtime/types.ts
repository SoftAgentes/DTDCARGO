/**
 * Tipos del runtime de Agentes y Skills (SDD-0020 Fase 2D).
 *
 * Diseño:
 *  - `ToolDef<I,O>` es genérico: cada tool declara su input/output type.
 *  - El registry guarda tools como `ToolDef<unknown, unknown>` (type-erased)
 *    para poder mezclar en el mismo Map. El handler valida shape internamente.
 *  - `SkillDef` referencia tool keys (strings); el orchestrator resuelve
 *    contra el registry al armar las herramientas para el LLM.
 *  - `LLMClient` es una interfaz para permitir mock/real (Fase 2D.1 mock,
 *    2D.2 Anthropic real) sin tocar el orchestrator.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AgentModel,
  AgentRunStatus,
  AgentToolCall,
} from "@/lib/studio/agent-types";

/** Contexto pasado a cada tool handler en ejecución. */
export interface ToolContext {
  /** Cliente Supabase con JWT del operador — respeta RLS por tenant. */
  supabase: SupabaseClient;
  tenantId: string;
  agentId: string;
  runId: string;
}

/** JSON Schema mínimo de input/output que entiende un LLM (Anthropic tool use). */
export type JsonSchema = Record<string, unknown>;

export interface ToolDef<I = unknown, O = unknown> {
  key: string;
  description: string;
  input_schema: JsonSchema;
  handler: (ctx: ToolContext, input: I) => Promise<O>;
}

/** Versión type-erased para el registry. */
export type AnyToolDef = ToolDef<unknown, unknown>;

export interface SkillDef {
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string | null;
  default_model: AgentModel;
  tools_required: string[]; // tool keys
  input_schema: JsonSchema;
  output_schema: JsonSchema;
  system_prompt: string;
  cost_estimate_usd: number;
  version: string;
}

/** Resultado de un run completo, lo que devuelve el orchestrator. */
export interface RunResult {
  runId: string;
  status: AgentRunStatus;
  output: Record<string, unknown> | null;
  toolCalls: AgentToolCall[];
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  error?: string;
}

/** Lo que el LLM (mock o real) devuelve por cada iteración del loop. */
export interface LLMRunResponse {
  /** Respuesta final del modelo (objeto que matchea output_schema). */
  output: Record<string, unknown>;
  /** Tool calls que el modelo decidió hacer durante el loop. */
  toolCalls: AgentToolCall[];
  /** Métricas crudas de la inferencia. */
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

/**
 * Interfaz del cliente LLM. Permite swap mock / Anthropic / multi-provider
 * sin modificar el orchestrator.
 */
export interface LLMClient {
  run(args: {
    model: AgentModel;
    systemPrompt: string;
    input: Record<string, unknown>;
    tools: AnyToolDef[];
    ctx: ToolContext;
  }): Promise<LLMRunResponse>;
}
