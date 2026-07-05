/**
 * lib/studio/bitacora/escucha-extract.ts · SDD-0150 Fase D — Secretaria Escucha Activa.
 *
 * Capa PRIVADA del founder (admin-only, gate `escucha_activa`). NO rehace el
 * acta ni crea tareas: lee entre líneas la transcripción y CRITICA lo que ya
 * produjo la secretaria default, devolviendo recomendaciones que Sam aplica a
 * mano. Efímero — no se persiste.
 *
 * Calca `extract.ts`: Anthropic directo con **tool-use FORZADO** (tool
 * `sugerencias`, su input_schema fuerza la estructura). Modelo por cascada
 * `BITACORA_ESCUCHA_MODEL ?? BITACORA_ACTA_MODEL ?? default` → puede apuntar a
 * Opus sin tocar código. Sin `ANTHROPIC_API_KEY` (o `LLM_FORCE_MOCK=1`) → mock
 * determinista (dev/tests/verify sin gastar tokens). NUNCA lanza al caller.
 */

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { buildEscuchaPrompt } from "./prompts";
import {
  ESCUCHA_SUGERENCIA_TIPOS,
  isEscuchaSugerenciaTipo,
  TRANSCRIPT_MIN_CHARS,
  type EscuchaSugerencia,
} from "./bitacora-types";

export interface EscuchaOpts {
  hoyISO: string;
  hoyDia: string;
  teamNames: string[];
  /** Resumen que ya produjo la default (para criticarlo). */
  actaResumen: string;
  /** Tareas ya propuestas, en orden (el índice = task_index de la sugerencia). */
  actaTareas: { titulo: string; prioridad: string }[];
}

export type EscuchaResult =
  | { sugerencias: EscuchaSugerencia[] }
  | { error: string };

const TOOL_NAME = "sugerencias";
const DEFAULT_MODEL = "claude-sonnet-4-6";

const ESCUCHA_SCHEMA: Anthropic.Messages.Tool.InputSchema = {
  type: "object",
  properties: {
    sugerencias: {
      type: "array",
      description:
        "Recomendaciones para Sam (pocas y sólidas; si no hay señal, deja el array vacío).",
      items: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: [...ESCUCHA_SUGERENCIA_TIPOS] },
          task_index: {
            type: "integer",
            description:
              "Índice (0-based) de la tarea afectada del acta; omite si es general.",
          },
          actual: {
            type: "string",
            description: "Lo que la secretaria default produjo (para comparar).",
          },
          sugerido: { type: "string", description: "Lo que recomiendas cambiar." },
          motivo: {
            type: "string",
            description: "Por qué — cita corta textual + el marco (Grice, hedging…).",
          },
        },
        required: ["tipo", "sugerido", "motivo"],
      },
    },
  },
  required: ["sugerencias"],
};

/**
 * Corre la Escucha Activa sobre la transcripción + el acta ya producida.
 * Devuelve `{ sugerencias }` o `{ error }` — nunca lanza.
 */
export async function extractEscucha(
  transcript: string,
  opts: EscuchaOpts,
): Promise<EscuchaResult> {
  const clean = (transcript ?? "").trim();
  if (clean.length < TRANSCRIPT_MIN_CHARS) {
    return {
      error: `El texto es muy corto para analizar (mínimo ${TRANSCRIPT_MIN_CHARS} caracteres).`,
    };
  }

  const forceMock = process.env.LLM_FORCE_MOCK === "1";
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (forceMock || !apiKey) {
    return { sugerencias: mockEscucha(opts) };
  }

  const prompt = buildEscuchaPrompt({
    transcript: clean,
    hoyISO: opts.hoyISO,
    hoyDia: opts.hoyDia,
    teamNames: opts.teamNames,
    actaResumen: opts.actaResumen,
    actaTareas: opts.actaTareas,
  });

  try {
    const client = new Anthropic({ apiKey });
    const model =
      process.env.BITACORA_ESCUCHA_MODEL ??
      process.env.BITACORA_ACTA_MODEL ??
      DEFAULT_MODEL;
    const response = await client.messages.create({
      model,
      max_tokens: 3000,
      tools: [
        {
          name: TOOL_NAME,
          description:
            "Registra las recomendaciones privadas de escucha activa para el founder.",
          input_schema: ESCUCHA_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: prompt }],
    });

    const toolBlock = response.content.find(
      (b): b is ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME,
    );
    if (!toolBlock) {
      return { error: "La IA no devolvió sugerencias. Reintenta." };
    }
    return { sugerencias: coerceSugerencias(toolBlock.input) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { error: `Falló la Escucha Activa: ${msg}` };
  }
}

// ── Coerción defensiva de la salida de la tool ────────────────

function coerceSugerencias(input: unknown): EscuchaSugerencia[] {
  if (!input || typeof input !== "object") return [];
  const arr = (input as Record<string, unknown>).sugerencias;
  if (!Array.isArray(arr)) return [];
  const out: EscuchaSugerencia[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    if (!isEscuchaSugerenciaTipo(s.tipo)) continue;
    const sugerido = typeof s.sugerido === "string" ? s.sugerido.trim() : "";
    const motivo = typeof s.motivo === "string" ? s.motivo.trim() : "";
    if (!sugerido || !motivo) continue;
    const idx = s.task_index;
    out.push({
      tipo: s.tipo,
      task_index:
        typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null,
      actual: typeof s.actual === "string" ? s.actual.trim() : "",
      sugerido: sugerido.slice(0, 1000),
      motivo: motivo.slice(0, 1000),
    });
  }
  return out;
}

// ── Mock determinista (sin gastar tokens) ─────────────────────

/**
 * Sugerencia fija PLAUSIBLE derivada del acta. Determinista (misma entrada →
 * misma salida) para dev/tests/verify. Si no hay tareas, no sugiere nada.
 */
function mockEscucha(opts: EscuchaOpts): EscuchaSugerencia[] {
  if (opts.actaTareas.length === 0) return [];
  const t0 = opts.actaTareas[0];
  return [
    {
      tipo: "revisar_compromiso",
      task_index: 0,
      actual: `${t0.titulo} (prioridad ${t0.prioridad})`,
      sugerido: `Confirmar el compromiso de "${t0.titulo}" antes de darlo por firme.`,
      motivo:
        "Sugerencia automática (modo sin IA): revisar el gradiente de compromiso del responsable.",
    },
  ];
}
