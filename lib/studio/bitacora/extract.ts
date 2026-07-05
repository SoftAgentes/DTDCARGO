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

/** Hilo: tema disperso reconstruido, con el dato FINAL (SDD-0150 Fase A). */
export interface RawActaHilo {
  tema: string;
  estado_final?: string;
  contradiccion_sin_resolver?: boolean;
}

/** Duda de clasificación empleado-vs-externo sin resolver (SDD-0150 Fase A). */
export interface RawActaDuda {
  texto: string;
  hablante?: string;
  opciones?: string[];
}

/** Vínculo con cliente DETECTADO por la IA (el match lo hace el server, Fase B). */
export interface RawActaVinculo {
  nombre_detectado?: string;
  tipo_externo?: string;
  posible_cliente_nuevo?: boolean;
  confianza?: string;
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
  /** Temas dispersos cosidos, con el dato final (SDD-0150). */
  hilos?: RawActaHilo[];
  /** Clasificaciones ambiguas que el humano debe resolver (SDD-0150). */
  dudas_clasificacion?: RawActaDuda[];
  /** Externo detectado para atar contra la tabla de clientes (SDD-0150 Fase B). */
  vinculo_cliente?: RawActaVinculo;
}

export interface ExtractOpts {
  tipo: MeetingTipo;
  clienteNombre?: string | null;
  teamNames: string[];
  hoyISO: string;
  hoyDia: string;
  /**
   * Resumen corregido por el humano (mejora "volver a generar tareas"). Se pasa
   * al prompt como guía prioritaria. Sin valor → comportamiento original.
   */
  resumenGuia?: string | null;
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
    hilos: {
      type: "array",
      description:
        "Temas que se tocaron en partes separadas y se retomaron, cosidos en un solo hilo con su estado FINAL.",
      items: {
        type: "object",
        properties: {
          tema: { type: "string", description: "Nombre corto del hilo." },
          estado_final: {
            type: "string",
            description: "Lo que vale al final (si un dato se corrigió, el último).",
          },
          contradiccion_sin_resolver: {
            type: "boolean",
            description: "true si quedó una contradicción que la reunión NO resolvió.",
          },
        },
        required: ["tema"],
      },
    },
    dudas_clasificacion: {
      type: "array",
      description:
        "Cuando no quede claro si alguien es del equipo o externo (y eso cambia tarea-vs-pendiente): no decidas, anótalo como duda.",
      items: {
        type: "object",
        properties: {
          texto: { type: "string", description: "La duda, en una frase." },
          hablante: { type: "string", description: "Nombre en cuestión, si se menciona." },
          opciones: { type: "array", items: { type: "string" } },
        },
        required: ["texto"],
      },
    },
    vinculo_cliente: {
      type: "object",
      description:
        "Si se habló con un externo (cliente/proveedor/contratista), detecta con QUIÉN. Solo detectas el nombre — NO inventes un cliente; el sistema lo cruza con la tabla y el humano confirma.",
      properties: {
        nombre_detectado: {
          type: "string",
          description: "Nombre/empresa/apodo del externo tal como se dijo.",
        },
        tipo_externo: {
          type: "string",
          enum: ["cliente", "proveedor", "contratista", "indeterminado"],
        },
        posible_cliente_nuevo: {
          type: "boolean",
          description: "true si actúa como cliente pero no parece uno ya conocido.",
        },
        confianza: { type: "string", enum: ["alta", "media", "baja"] },
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
    resumenGuia: opts.resumenGuia,
  });

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.BITACORA_ACTA_MODEL ?? DEFAULT_MODEL;
    const response = await client.messages.create({
      model,
      max_tokens: 5000, // +1000 vs SDD-0146: el contrato ahora trae hilos + dudas.
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

  const hilos: RawActaHilo[] = Array.isArray(o.hilos)
    ? o.hilos
        .map((raw): RawActaHilo | null => {
          if (!raw || typeof raw !== "object") return null;
          const h = raw as Record<string, unknown>;
          const tema = typeof h.tema === "string" ? h.tema.trim() : "";
          if (!tema) return null;
          return {
            tema,
            estado_final:
              typeof h.estado_final === "string" ? h.estado_final : undefined,
            contradiccion_sin_resolver: h.contradiccion_sin_resolver === true,
          };
        })
        .filter((h): h is RawActaHilo => h !== null)
    : [];

  const dudas: RawActaDuda[] = Array.isArray(o.dudas_clasificacion)
    ? o.dudas_clasificacion
        .map((raw): RawActaDuda | null => {
          if (!raw || typeof raw !== "object") return null;
          const d = raw as Record<string, unknown>;
          const texto = typeof d.texto === "string" ? d.texto.trim() : "";
          if (!texto) return null;
          return {
            texto,
            hablante: typeof d.hablante === "string" ? d.hablante : undefined,
            opciones: asStringArray(d.opciones),
          };
        })
        .filter((d): d is RawActaDuda => d !== null)
    : [];

  let vinculo_cliente: RawActaVinculo | undefined;
  if (o.vinculo_cliente && typeof o.vinculo_cliente === "object") {
    const v = o.vinculo_cliente as Record<string, unknown>;
    const nombre =
      typeof v.nombre_detectado === "string" ? v.nombre_detectado.trim() : "";
    if (nombre) {
      vinculo_cliente = {
        nombre_detectado: nombre,
        tipo_externo:
          typeof v.tipo_externo === "string" ? v.tipo_externo : undefined,
        posible_cliente_nuevo: v.posible_cliente_nuevo === true,
        confianza: typeof v.confianza === "string" ? v.confianza : undefined,
      };
    }
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
    hilos,
    dudas_clasificacion: dudas,
    vinculo_cliente,
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
  // Con guía del líder (regenerar), la propuesta se deriva del resumen corregido
  // → la nueva tanda refleja lo que el humano marcó como importante. Sin guía,
  // cae al primer renglón del transcript (comportamiento original). Determinista
  // en ambos casos (sin random, sin reloj).
  const guia = (opts.resumenGuia ?? "").trim();
  const snippet = (guia || firstLine).slice(0, 80);
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
    hilos: [],
    dudas_clasificacion: [],
  };

  if (opts.tipo === "cliente") {
    acta.entregables_cliente = [
      { descripcion: "Confirmar los próximos pasos con el cliente" },
    ];
    const cli = (opts.clienteNombre ?? "").trim();
    if (cli) {
      acta.vinculo_cliente = {
        nombre_detectado: cli,
        tipo_externo: "cliente",
        posible_cliente_nuevo: false,
        confianza: "baja",
      };
    }
  }

  return acta;
}
