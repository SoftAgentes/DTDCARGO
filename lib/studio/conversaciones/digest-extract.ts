/**
 * lib/studio/conversaciones/digest-extract.ts · SDD-0149 — hilo del mes → resumen (LLM).
 *
 * ÚNICO punto del digest que usa un LLM. Calca `bitacora/extract.ts`: Anthropic
 * directo con **tool-use FORZADO** (schema como input_schema → cero parseo frágil).
 * Modelo `CONVERSATION_DIGEST_MODEL` (env) → default el de Bitácora → `claude-sonnet-4-6`.
 *
 * Sin `ANTHROPIC_API_KEY` (o `LLM_FORCE_MOCK=1`) → **mock determinista** derivado del
 * hilo (dev/tests/verify sin gastar tokens). NUNCA lanza → `{ summary, model }` o
 * `{ error }`.
 */

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";

export interface DigestMessage {
  direction: "in" | "out";
  body: string;
  authorName: string | null;
}

export type DigestResult = { summary: string; model: string } | { error: string };

const TOOL_NAME = "resumen";
const DEFAULT_MODEL =
  process.env.CONVERSATION_DIGEST_MODEL ??
  process.env.BITACORA_ACTA_MODEL ??
  "claude-sonnet-4-6";

const SCHEMA: Anthropic.Messages.Tool.InputSchema = {
  type: "object",
  properties: {
    resumen: {
      type: "string",
      description: "2-5 frases: de qué se habló con el cliente ese mes, para uso interno.",
    },
    temas: {
      type: "array",
      items: { type: "string" },
      description: "Temas / pedidos tratados (bullets cortos).",
    },
    pendientes: {
      type: "array",
      items: { type: "string" },
      description: "Lo que quedó pendiente o a seguir (bullets), si aplica.",
    },
  },
  required: ["resumen"],
};

/**
 * Resume el hilo de un mes. `periodLabel` ej. "julio 2026". Devuelve markdown listo
 * para guardar. Nunca lanza.
 */
export async function summarizeMonthThread(
  messages: DigestMessage[],
  opts: { clientName: string; periodLabel: string },
): Promise<DigestResult> {
  if (messages.length === 0) return { error: "sin mensajes" };

  const transcript = messages
    .map(
      (m) =>
        `${m.direction === "in" ? opts.clientName : m.authorName ?? "DTD Cargo"}: ${m.body}`,
    )
    .join("\n");

  const forceMock = process.env.LLM_FORCE_MOCK === "1";
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (forceMock || !apiKey) {
    return { summary: mockSummary(messages, opts), model: "mock" };
  }

  const prompt = [
    `Eres un asistente de atención al cliente de DTD Cargo (logística China↔Venezuela).`,
    `Resume, para uso INTERNO del equipo, la conversación con el cliente "${opts.clientName}" durante ${opts.periodLabel}.`,
    `Español venezolano neutro, tuteo, directo. Que un asesor entienda en 10 segundos qué pasó ese mes.`,
    ``,
    `Transcripción del mes:`,
    transcript,
  ].join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1200,
      tools: [
        {
          name: TOOL_NAME,
          description: "Registra el resumen mensual de la conversación con el cliente.",
          input_schema: SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content.find(
      (b): b is ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME,
    );
    if (!block) return { error: "La IA no devolvió un resumen." };

    const summary = formatSummary(block.input);
    if (!summary) return { error: "Formato de resumen inesperado." };
    return { summary, model: DEFAULT_MODEL };
  } catch (e) {
    // Logueamos el error real de la IA (404 modelo inexistente, 401 key, rate limit…):
    // sin esto el fallo es invisible en los logs de Vercel y el digest queda en 0 en
    // silencio. Incluimos el modelo para diagnosticar de un vistazo cuál se pidió.
    const msg = e instanceof Error ? e.message : "Error de IA";
    console.error(`[digest-extract] IA falló (model=${DEFAULT_MODEL}):`, msg);
    return { error: msg };
  }
}

// ── Formato + coerción ────────────────────────────────────────

function asList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((x) => x.length > 0);
}

/** Estructura de la tool → markdown para guardar. Devuelve "" si no hay resumen. */
function formatSummary(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const o = input as Record<string, unknown>;
  const resumen = typeof o.resumen === "string" ? o.resumen.trim() : "";
  if (!resumen) return "";
  const temas = asList(o.temas);
  const pendientes = asList(o.pendientes);

  const parts = [resumen];
  if (temas.length > 0) {
    parts.push("", "**Temas:**", ...temas.map((t) => `- ${t}`));
  }
  if (pendientes.length > 0) {
    parts.push("", "**Pendientes:**", ...pendientes.map((p) => `- ${p}`));
  }
  return parts.join("\n");
}

/** Mock determinista (sin gastar tokens): snippet + conteo. Sin random ni reloj. */
function mockSummary(
  messages: DigestMessage[],
  opts: { clientName: string; periodLabel: string },
): string {
  const inN = messages.filter((m) => m.direction === "in").length;
  const outN = messages.length - inN;
  const first = messages.find((m) => m.body.trim().length > 0)?.body ?? "";
  const snippet = first.replace(/\s+/g, " ").trim().slice(0, 100);
  return [
    `Resumen automático (modo sin IA) de ${opts.periodLabel} con ${opts.clientName}: ${snippet}`,
    "",
    `${messages.length} mensajes (${inN} del cliente, ${outN} del equipo).`,
  ].join("\n");
}
