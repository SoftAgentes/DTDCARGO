/**
 * lib/studio/bitacora/extract.ts · SDD-0146 Fase 2 — texto → acta (LLM).
 *
 * ÚNICO punto del módulo que usa un LLM. Anthropic directo (patrón noticias
 * SDD-0088) con **tool-use FORZADO**: se declara una tool `acta` cuyo
 * `input_schema` ES el ActaSchema y se fuerza `tool_choice: {type:"tool",
 * name:"acta"}` → el modelo devuelve la estructura como argumentos de la tool
 * (cero parseo frágil de JSON en prosa).
 *
 * Modelo: `BITACORA_ACTA_MODEL` (env) con default `claude-sonnet-4-6` — el
 * mismo ID que noticias-web/actions.ts tiene cableado y funcionando hoy. El
 * spec menciona "Sonnet 5" como norte; se deja configurable por env para
 * subirlo sin tocar código cuando el ID esté disponible.
 *
 * Sin `ANTHROPIC_API_KEY` (o `LLM_FORCE_MOCK=1`) → **mock determinista**
 * derivado de la transcripción (patrón SDD-0020): dev/tests/verify corren sin
 * gastar tokens. Guard mínimo de 20 chars. NUNCA lanza al caller → devuelve
 * `{ acta }` o `{ error }`.
 */

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { buildActaPrompt } from "./prompts";
import { TRANSCRIPT_MIN_CHARS, type MeetingTipo } from "./bitacora-types";

// ── Shape cruda del acta (lo que devuelve el LLM / el mock) ───

export interface RawActaTask {
  titulo: string;
  responsable_nombre?: string;
  due_date?: string;
  prioridad?: string;
  checklist?: string[];
  para_agente?: boolean;
}

export interface RawActaEntregable {
  descripcion: string;
  responsable_seguimiento?: string;
  due_date?: string;
}

export interface RawActa {
  resumen: string;
  puntos: string[];
  hablaron: string[];
  decisiones: string[];
  pendientes: string[];
  proxima_reunion?: { fecha?: string; foco?: string };
  tareas: RawActaTask[];
  entregables_cliente?: RawActaEntregable[];
}

export interface ExtractOpts {
  tipo: MeetingTipo;
  clienteNombre?: string | null;
  teamNames: string[];
  hoyISO: string;
  hoyDia: string;
}

export type ExtractResult = { acta: RawActa } | { error: string };

const TOOL_NAME = "acta";
const DEFAULT_MODEL = "claude-sonnet-4-6";

/**
 * JSON Schema (draft 2020-12) del acta = input_schema de la tool forzada.
 * Espejo exacto de RawActa.
 */
const ACTA_INPUT_SCHEMA: Anthropic.Messages.Tool.InputSchema = {
  type: "object",
  properties: {
    resumen: { type: "string", description: "2-4 frases con lo esencial." },
    puntos: {
      type: "array",
      items: { type: "string" },
      description: "Puntos clave hablados (bullets).",
    },
    hablaron: {
      type: "array",
      items: { type: "string" },
      description: "Nombres de quienes participaron.",
    },
    decisiones: { type: "array", items: { type: "string" } },
    pendientes: { type: "array", items: { type: "string" } },
    proxima_reunion: {
      type: "object",
      properties: {
        fecha: { type: "string", description: "YYYY-MM-DD si es deducible." },
        foco: { type: "string" },
      },
    },
    tareas: {
      type: "array",
      description: "Tareas CONCRETAS para los empleados (nunca para el cliente).",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          responsable_nombre: {
            type: "string",
            description: "Nombre del empleado responsable, si se menciona.",
          },
          due_date: { type: "string", description: "YYYY-MM-DD si es deducible." },
          prioridad: { type: "string", enum: ["baja", "media", "alta"] },
          checklist: { type: "array", items: { type: "string" } },
          para_agente: { type: "boolean" },
        },
        required: ["titulo"],
      },
    },
    entregables_cliente: {
      type: "array",
      description:
        "Solo en conversaciones con cliente: lo que el CLIENTE debe entregar/enviar.",
      items: {
        type: "object",
        properties: {
          descripcion: { type: "string" },
          responsable_seguimiento: {
            type: "string",
            description: "Empleado que lo persigue, si se menciona.",
          },
          due_date: { type: "string", description: "YYYY-MM-DD si se deduce." },
        },
        required: ["descripcion"],
      },
    },
  },
  required: [
    "resumen",
    "puntos",
    "hablaron",
    "decisiones",
    "pendientes",
    "tareas",
  ],
};

/**
 * Extrae el acta de una transcripción. Devuelve `{ acta }` o `{ error }` —
 * nunca lanza.
 */
export async function extractActa(
  transcript: string,
  opts: ExtractOpts,
): Promise<ExtractResult> {
  const clean = (transcript ?? "").trim();
  if (clean.length < TRANSCRIPT_MIN_CHARS) {
    return {
      error: `El texto es muy corto para analizar (mínimo ${TRANSCRIPT_MIN_CHARS} caracteres).`,
    };
  }

  // Mock determinista (dev/tests/verify) — sin key o forzado.
  const forceMock = process.env.LLM_FORCE_MOCK === "1";
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (forceMock || !apiKey) {
    return { acta: mockActa(clean, opts) };
  }

  const prompt = buildActaPrompt({
    transcript: clean,
    tipo: opts.tipo,
    clienteNombre: opts.clienteNombre,
    teamNames: opts.teamNames,
    hoyISO: opts.hoyISO,
    hoyDia: opts.hoyDia,
  });

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.BITACORA_ACTA_MODEL ?? DEFAULT_MODEL;
    const response = await client.messages.create({
      model,
      max_tokens: 4000,
      tools: [
        {
          name: TOOL_NAME,
          description:
            "Registra el acta estructurada extraída de la conversación de trabajo.",
          input_schema: ACTA_INPUT_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: prompt }],
    });

    const toolBlock = response.content.find(
      (b): b is ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME,
    );
    if (!toolBlock) {
      return { error: "La IA no devolvió un acta. Reintenta." };
    }

    const acta = coerceRawActa(toolBlock.input);
    if (!acta) {
      return { error: "La IA devolvió un formato inesperado. Reintenta." };
    }
    return { acta };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { error: `Falló el análisis con IA: ${msg}` };
  }
}

// ── Coerción defensiva de la salida de la tool ────────────────

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((x) => x.length > 0);
}

function coerceRawActa(input: unknown): RawActa | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;

  const tareas: RawActaTask[] = Array.isArray(o.tareas)
    ? o.tareas
        .map((raw): RawActaTask | null => {
          if (!raw || typeof raw !== "object") return null;
          const t = raw as Record<string, unknown>;
          const titulo = typeof t.titulo === "string" ? t.titulo.trim() : "";
          if (!titulo) return null;
          return {
            titulo,
            responsable_nombre:
              typeof t.responsable_nombre === "string"
                ? t.responsable_nombre
                : undefined,
            due_date: typeof t.due_date === "string" ? t.due_date : undefined,
            prioridad: typeof t.prioridad === "string" ? t.prioridad : undefined,
            checklist: asStringArray(t.checklist),
            para_agente: t.para_agente === true,
          };
        })
        .filter((t): t is RawActaTask => t !== null)
    : [];

  const entregables: RawActaEntregable[] = Array.isArray(o.entregables_cliente)
    ? o.entregables_cliente
        .map((raw): RawActaEntregable | null => {
          if (!raw || typeof raw !== "object") return null;
          const e = raw as Record<string, unknown>;
          const descripcion =
            typeof e.descripcion === "string" ? e.descripcion.trim() : "";
          if (!descripcion) return null;
          return {
            descripcion,
            responsable_seguimiento:
              typeof e.responsable_seguimiento === "string"
                ? e.responsable_seguimiento
                : undefined,
            due_date: typeof e.due_date === "string" ? e.due_date : undefined,
          };
        })
        .filter((e): e is RawActaEntregable => e !== null)
    : [];

  const proxRaw = o.proxima_reunion;
  let proxima_reunion: { fecha?: string; foco?: string } | undefined;
  if (proxRaw && typeof proxRaw === "object") {
    const p = proxRaw as Record<string, unknown>;
    proxima_reunion = {
      fecha: typeof p.fecha === "string" ? p.fecha : undefined,
      foco: typeof p.foco === "string" ? p.foco : undefined,
    };
  }

  return {
    resumen: typeof o.resumen === "string" ? o.resumen.trim() : "",
    puntos: asStringArray(o.puntos),
    hablaron: asStringArray(o.hablaron),
    decisiones: asStringArray(o.decisiones),
    pendientes: asStringArray(o.pendientes),
    proxima_reunion,
    tareas,
    entregables_cliente: entregables,
  };
}

// ── Mock determinista (sin gastar tokens) ─────────────────────

/**
 * Acta fija PLAUSIBLE derivada del transcript. Determinista (misma entrada →
 * misma salida) para dev/tests/verify. No usa random ni reloj.
 */
function mockActa(clean: string, opts: ExtractOpts): RawActa {
  const firstLine =
    clean.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ??
    clean.slice(0, 120);
  const snippet = firstLine.slice(0, 80);
  const primeros = opts.teamNames.slice(0, 2);

  const acta: RawActa = {
    resumen: `Resumen automático (modo sin IA) de la conversación: ${snippet}`,
    puntos: [snippet],
    hablaron: primeros,
    decisiones: [],
    pendientes: [],
    proxima_reunion: {},
    tareas: [
      {
        titulo: `Dar seguimiento a: ${snippet.slice(0, 60)}`,
        prioridad: "media",
        checklist: [],
        para_agente: false,
      },
    ],
    entregables_cliente: [],
  };

  if (opts.tipo === "cliente") {
    acta.entregables_cliente = [
      { descripcion: "Confirmar los próximos pasos con el cliente" },
    ];
  }

  return acta;
}
