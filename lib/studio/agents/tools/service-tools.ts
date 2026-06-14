/**
 * Service tools · 3 tools read-only del runtime de agentes (SDD-0076 Fase 4).
 *
 * Exponen el corpus de servicios (catálogo de código + contenido de DB:
 * service_configs / service_faqs) al asistente IA, como grounding. Reusan las
 * queries del módulo (lib/studio/service-catalog/queries) SIN modificarlas.
 *
 * El handler recibe ctx.supabase (JWT del operador → RLS por tenant). Read-only:
 * ninguna escribe. El corpus incluye capa INTERNA (notas, precio de referencia,
 * FAQ internas) — es un asistente del EQUIPO; el system prompt de la skill le
 * instruye no filtrar lo interno textual al cliente.
 *
 * Frontera: vive en lib/studio (runtime del ERP) — puede leer lib/studio.
 */

import {
  listServiceConfigs,
  getServiceConfig,
  listServiceFaqs,
} from "@/lib/studio/service-catalog/queries";
import type { ToolDef } from "../runtime/types";

// ─── Tipos compactos para responses (el LLM no necesita timestamps/FKs) ───

interface ServiceBrief {
  service_key: string;
  nombre: string;
  grupo: string;
  tipo: string;
  estado: string;
  publicado: boolean;
}

interface ServiceDetail {
  service_key: string;
  nombre: string;
  descripcion: string;
  incluye: string[];
  no_incluye: string[];
  precio: string;
  como_se_cobra: string | null;
  metodos_pago: string[];
  como_se_solicita: string;
  tiempos: string;
  nota: string | null;
  condiciones_politicas: string | null;
  /** INTERNO — no compartir textual con el cliente. */
  notas_internas: string | null;
  /** INTERNO — no compartir. */
  precio_ref_interno: string | null;
  publicado: boolean;
  estado: string;
}

interface FaqBrief {
  pregunta: string;
  respuesta: string;
  /** "public" | "internal" — las internal NO se citan textual al cliente. */
  audiencia: string;
  publicada: boolean;
}

// ─── Tool: list_services ───────────────────────────────────

const listServicesTool: ToolDef<Record<string, never>, ServiceBrief[]> = {
  key: "list_services",
  description:
    "Lista todos los servicios de DTD con nombre, grupo, tipo (núcleo/add-on), estado y si está publicado. Úsalo para tener el panorama antes de detallar uno.",
  input_schema: { type: "object", properties: {} },
  handler: async (ctx) => {
    const items = await listServiceConfigs(ctx.supabase);
    return items.map(({ catalog, config }) => ({
      service_key: catalog.id,
      nombre: config?.title_public || catalog.nombre,
      grupo: catalog.grupo,
      tipo: catalog.tipo,
      estado: config?.service_state ?? catalog.estado,
      publicado: !!config?.is_public,
    }));
  },
};

// ─── Tool: get_service ─────────────────────────────────────

const getServiceTool: ToolDef<{ service_key: string }, ServiceDetail | null> = {
  key: "get_service",
  description:
    "Devuelve el detalle completo de un servicio por su service_key: descripción, qué incluye / no incluye, precio, cómo se cobra, métodos de pago, cómo se solicita, tiempos, condiciones y notas. Incluye campos INTERNOS (notas_internas, precio_ref_interno) — úsalos para responderle al equipo, NUNCA los cites textual a un cliente.",
  input_schema: {
    type: "object",
    properties: {
      service_key: {
        type: "string",
        description: "Clave del servicio (ej: puerta-a-puerta-ddp, compra-asistida).",
      },
    },
    required: ["service_key"],
  },
  handler: async (ctx, input) => {
    const key = String(input.service_key ?? "").trim();
    if (!key) return null;
    const cfg = await getServiceConfig(ctx.supabase, key);
    if (!cfg) return null;
    return {
      service_key: cfg.service_key,
      nombre: cfg.title_public,
      descripcion: cfg.description_public,
      incluye: cfg.includes_public,
      no_incluye: cfg.excludes_public,
      precio: cfg.price_text,
      como_se_cobra: cfg.charge_moment,
      metodos_pago: cfg.payment_methods,
      como_se_solicita: cfg.how_to_request,
      tiempos: cfg.timelines_public,
      nota: cfg.note_public,
      condiciones_politicas: cfg.condiciones_politicas,
      notas_internas: cfg.notes_internal,
      precio_ref_interno: cfg.internal_price_ref,
      publicado: cfg.is_public,
      estado: cfg.service_state,
    };
  },
};

// ─── Tool: list_service_faqs ───────────────────────────────

const listServiceFaqsTool: ToolDef<{ service_key: string }, FaqBrief[]> = {
  key: "list_service_faqs",
  description:
    "Lista las FAQ de un servicio (públicas e internas). Las internas (audiencia='internal') son para el equipo — no las cites textual a un cliente.",
  input_schema: {
    type: "object",
    properties: {
      service_key: {
        type: "string",
        description: "Clave del servicio (ej: puerta-a-puerta-ddp).",
      },
    },
    required: ["service_key"],
  },
  handler: async (ctx, input) => {
    const key = String(input.service_key ?? "").trim();
    if (!key) return [];
    const faqs = await listServiceFaqs(ctx.supabase, key);
    return faqs.map((f) => ({
      pregunta: f.question,
      respuesta: f.answer,
      audiencia: f.audience,
      publicada: f.is_public,
    }));
  },
};

/** Tools del corpus de servicios (SDD-0076 Fase 4). Read-only. */
export const SERVICE_TOOLS = [
  listServicesTool,
  getServiceTool,
  listServiceFaqsTool,
];
