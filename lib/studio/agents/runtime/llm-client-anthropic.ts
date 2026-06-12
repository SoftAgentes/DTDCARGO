/**
 * AnthropicLLMClient · LLMClient real con Claude (SDD-0020 Fase 2D.2).
 *
 * Implementa el loop tool-use de Anthropic:
 *  1. Manda system_prompt + tools (con cache_control en ambos para
 *     ahorrar ~90% en re-runs del mismo agent en 5 min)
 *  2. Loop: si la respuesta contiene tool_use blocks, ejecuta cada tool
 *     handler real (vía registry), arma tool_result blocks, re-llama
 *  3. Para cuando el modelo devuelve solo texto (stop_reason='end_turn')
 *  4. Parsea el texto final como JSON que matchea output_schema de la
 *     skill. Si el modelo devuelve texto plano sin JSON, lo envuelve
 *     en { message, citations: [] } como fallback.
 *
 * Cost: calcula desde `usage` de cada respuesta con pricing hardcoded
 * por modelo. TODO: mover pricing a tabla `agent_model_pricing` (SDD-0022).
 *
 * Safety: max 10 iteraciones de tool-use para evitar loops infinitos.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  Message,
  MessageParam,
  TextBlock,
  Tool,
  ToolResultBlockParam,
  ToolUnion,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages";

import type { AgentToolCall } from "@/lib/studio/agent-types";
import type {
  AnyToolDef,
  LLMClient,
  LLMRunResponse,
  ToolContext,
} from "./types";

// ─── Pricing (USD por 1M tokens) ───────────────────────────
// Hardcoded — mover a tabla agent_model_pricing en SDD-0022.

const PRICING: Record<string, { inPer1M: number; outPer1M: number; cacheReadPer1M: number; cacheWritePer1M: number }> = {
  "claude-opus-4-7": {
    inPer1M: 15,
    outPer1M: 75,
    cacheReadPer1M: 1.5,
    cacheWritePer1M: 18.75,
  },
  "claude-sonnet-4-6": {
    inPer1M: 3,
    outPer1M: 15,
    cacheReadPer1M: 0.3,
    cacheWritePer1M: 3.75,
  },
  "claude-haiku-4-5-20251001": {
    inPer1M: 1,
    outPer1M: 5,
    cacheReadPer1M: 0.1,
    cacheWritePer1M: 1.25,
  },
};

const MAX_TOOL_ITERATIONS = 10;

function computeCost(model: string, usage: Message["usage"]): number {
  const p = PRICING[model] ?? PRICING["claude-sonnet-4-6"];
  const tokensIn = usage.input_tokens ?? 0;
  const tokensOut = usage.output_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cost =
    (tokensIn / 1_000_000) * p.inPer1M +
    (tokensOut / 1_000_000) * p.outPer1M +
    (cacheRead / 1_000_000) * p.cacheReadPer1M +
    (cacheWrite / 1_000_000) * p.cacheWritePer1M;
  return Math.round(cost * 10000) / 10000;
}

/** Suma usage de múltiples mensajes para totales del run. */
function accumulateUsage(
  acc: { tokensIn: number; tokensOut: number; costUsd: number },
  model: string,
  usage: Message["usage"],
) {
  acc.tokensIn += (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  acc.tokensOut += usage.output_tokens ?? 0;
  acc.costUsd += computeCost(model, usage);
}

/** Intenta parsear el texto final como JSON; si falla, lo envuelve. */
function parseFinalOutput(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  // Buscar el primer { ... } (el modelo a veces lo envuelve en prosa)
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      // fall through
    }
  }
  // Fallback: envolver en shape mínima
  return { message: trimmed, citations: [] };
}

function toAnthropicTools(tools: AnyToolDef[]): ToolUnion[] {
  // Aplicamos cache_control en la ÚLTIMA tool — Anthropic cachea
  // todo lo previo en el bloque cacheable.
  //
  // Tipado: el SDK exporta ToolUnion como discriminated union que incluye
  // tools predefinidos (computer_20250124, bash, etc.) que NO tienen
  // input_schema. Construimos un Anthropic.Tool custom (que sí lo tiene)
  // y lo asignamos al union — la conversión es segura porque Tool es uno
  // de los miembros válidos del union.
  return tools.map((t, idx) => {
    const base: Tool = {
      name: t.key,
      description: t.description,
      input_schema: t.input_schema as Tool["input_schema"],
    };
    if (idx === tools.length - 1) {
      (base as Tool & { cache_control: { type: "ephemeral" } }).cache_control =
        { type: "ephemeral" };
    }
    return base;
  });
}

async function executeToolCall(
  tools: AnyToolDef[],
  ctx: ToolContext,
  toolUse: ToolUseBlock,
): Promise<{ result: AgentToolCall; resultBlock: ToolResultBlockParam }> {
  const tool = tools.find((t) => t.key === toolUse.name);
  const started_at = new Date().toISOString();
  const t0 = Date.now();

  if (!tool) {
    const error = `Tool '${toolUse.name}' no registrada`;
    return {
      result: {
        tool_key: toolUse.name,
        input: toolUse.input,
        error,
        started_at,
        ended_at: new Date().toISOString(),
        latency_ms: Date.now() - t0,
      },
      resultBlock: {
        type: "tool_result",
        tool_use_id: toolUse.id,
        is_error: true,
        content: error,
      },
    };
  }

  try {
    const output = await tool.handler(ctx, toolUse.input);
    return {
      result: {
        tool_key: tool.key,
        input: toolUse.input,
        output,
        started_at,
        ended_at: new Date().toISOString(),
        latency_ms: Date.now() - t0,
      },
      resultBlock: {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(output ?? null),
      },
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return {
      result: {
        tool_key: tool.key,
        input: toolUse.input,
        error,
        started_at,
        ended_at: new Date().toISOString(),
        latency_ms: Date.now() - t0,
      },
      resultBlock: {
        type: "tool_result",
        tool_use_id: toolUse.id,
        is_error: true,
        content: error,
      },
    };
  }
}

export class AnthropicLLMClient implements LLMClient {
  private client: Anthropic;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error(
        "ANTHROPIC_API_KEY no está configurada. Agrégala a .env.local o usa MockLLMClient.",
      );
    }
    this.client = new Anthropic({ apiKey: key });
  }

  async run({
    model,
    systemPrompt,
    input,
    tools,
    ctx,
  }: {
    model: string;
    systemPrompt: string;
    input: Record<string, unknown>;
    tools: AnyToolDef[];
    ctx: ToolContext;
  }): Promise<LLMRunResponse> {
    const totals = { tokensIn: 0, tokensOut: 0, costUsd: 0 };
    const toolCalls: AgentToolCall[] = [];

    // System con cache_control para reuso en runs siguientes (5 min TTL)
    const systemBlocks = [
      {
        type: "text" as const,
        text: systemPrompt,
        cache_control: { type: "ephemeral" as const },
      },
    ];

    // Wrap del input en <untrusted_content> para mitigación de prompt injection
    const initialUserMessage = `<untrusted_content>\n${JSON.stringify(input, null, 2)}\n</untrusted_content>\n\nUsá las tools disponibles para responder y devolveme el JSON final en el formato del output_schema.`;

    const messages: MessageParam[] = [
      { role: "user", content: initialUserMessage },
    ];

    const anthropicTools = tools.length > 0 ? toAnthropicTools(tools) : undefined;

    let iterations = 0;
    let finalText = "";

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations += 1;

      const response = await this.client.messages.create({
        model,
        max_tokens: 1024,
        system: systemBlocks,
        tools: anthropicTools,
        messages,
      });

      accumulateUsage(totals, model, response.usage);

      const toolUseBlocks = response.content.filter(
        (b): b is ToolUseBlock => b.type === "tool_use",
      );

      if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
        // Mensaje final del modelo
        const textBlock = response.content.find(
          (b): b is TextBlock => b.type === "text",
        );
        finalText = textBlock?.text ?? "";
        break;
      }

      // Ejecutar cada tool use real
      const toolResultBlocks: ToolResultBlockParam[] = [];
      for (const tu of toolUseBlocks) {
        const { result, resultBlock } = await executeToolCall(tools, ctx, tu);
        toolCalls.push(result);
        toolResultBlocks.push(resultBlock);
      }

      // Apendar mensaje del assistant con tool_use + nuestro tool_result
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResultBlocks });
    }

    if (iterations >= MAX_TOOL_ITERATIONS && !finalText) {
      finalText = JSON.stringify({
        message:
          "El agente alcanzó el límite de iteraciones de tool-use sin converger. Reformula la consulta o contacta soporte.",
        citations: [],
      });
    }

    return {
      output: parseFinalOutput(finalText),
      toolCalls,
      tokensIn: totals.tokensIn,
      tokensOut: totals.tokensOut,
      costUsd: Math.round(totals.costUsd * 10000) / 10000,
    };
  }
}
