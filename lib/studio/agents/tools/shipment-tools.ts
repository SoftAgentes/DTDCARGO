/**
 * Shipment tools · 4 tools read-only del runtime (SDD-0020 Fase 2D).
 *
 * Cada tool reusa queries existentes del Studio (shipment-queries.ts,
 * client-queries.ts) SIN modificarlas. El handler:
 *  1. Recibe ctx con supabase (JWT del operador → RLS por tenant)
 *  2. Llama queries existentes
 *  3. Devuelve subset minimalista (no toda la entidad — el LLM no necesita
 *     timestamps internos ni FKs)
 *
 * Tools son read-only V1 — ninguna escribe en DB. Aun con prompt injection
 * exitoso el blast radius es lectura (los shipments ya son consultables
 * por código en /track/[code] público).
 */

import {
  getShipmentEvents,
  type ShipmentEventRow,
} from "@/lib/studio/shipment-queries";
import {
  getClientByMarkbox,
  listShipmentsByMarkbox,
} from "@/lib/studio/client-queries";
import type { ToolDef } from "../runtime/types";

// ─── Tipos compactos para responses ────────────────────────

export interface ShipmentSummary {
  code: string;
  origin: string;
  destination: string;
  service: string;
  status: string;
  client_markbox: string | null;
  client_name: string | null;
  eta_estimated: string | null;
}

export interface TimelineEntry {
  status: string;
  note: string | null;
  occurred_at: string;
}

export interface ClientSummary {
  markbox: string;
  name: string;
  tier: string | null;
  /**
   * Dirección libre del cliente (SDD-0010 client_types.ts).
   * Reemplaza los antiguos campos `city` + `country` que no existían
   * en la tabla `clients`. Cuando se agreguen columnas estructuradas
   * (SDD futuro de Master data), volvemos a city + country separados.
   */
  address: string | null;
  total_shipments: number;
}

// ─── Tool: get_shipment ────────────────────────────────────

const getShipmentTool: ToolDef<{ code: string }, ShipmentSummary | null> = {
  key: "get_shipment",
  description:
    "Busca un envío individual por su código (formato S-YYYY-NNNN). Devuelve resumen con origen, destino, servicio (LCL/FCL/DDP), estado actual y ETA.",
  input_schema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "Código de envío. Formato S-YYYY-NNNN (ej: S-2026-0001).",
      },
    },
    required: ["code"],
  },
  handler: async (ctx, input) => {
    const code = String(input.code ?? "").trim();
    if (!code) return null;
    const { data, error } = await ctx.supabase
      .from("shipments")
      .select(
        "code, origin, destination, shipment_service, status, client_markbox, client_name, eta_estimated",
      )
      .eq("code", code)
      .maybeSingle<{
        code: string;
        origin: string;
        destination: string;
        shipment_service: string;
        status: string;
        client_markbox: string | null;
        client_name: string | null;
        eta_estimated: string | null;
      }>();
    if (error || !data) return null;
    return {
      code: data.code,
      origin: data.origin,
      destination: data.destination,
      service: data.shipment_service,
      status: data.status,
      client_markbox: data.client_markbox,
      client_name: data.client_name,
      eta_estimated: data.eta_estimated,
    };
  },
};

// ─── Tool: get_shipment_timeline ────────────────────────────

const getShipmentTimelineTool: ToolDef<{ code: string }, TimelineEntry[]> = {
  key: "get_shipment_timeline",
  description:
    "Devuelve los eventos del timeline de un envío (cambios de status, notas operativas), ordenados del más reciente al más antiguo.",
  input_schema: {
    type: "object",
    properties: {
      code: { type: "string", description: "Código de envío S-YYYY-NNNN." },
    },
    required: ["code"],
  },
  handler: async (ctx, input) => {
    const code = String(input.code ?? "").trim();
    if (!code) return [];
    // Resolver id por code → fetch events
    const { data: shipment } = await ctx.supabase
      .from("shipments")
      .select("id")
      .eq("code", code)
      .maybeSingle<{ id: string }>();
    if (!shipment) return [];
    const events = await getShipmentEvents(ctx.supabase, shipment.id);
    return (events as ShipmentEventRow[]).map((e) => ({
      status: e.status,
      note: e.note,
      occurred_at: e.occurred_at,
    }));
  },
};

// ─── Tool: search_shipments_by_customer ─────────────────────

const searchShipmentsByCustomerTool: ToolDef<
  { markbox: string },
  ShipmentSummary[]
> = {
  key: "search_shipments_by_customer",
  description:
    "Lista los envíos asociados a un cliente identificado por su MARKBOX (formato DTD-NNNN). Hasta 200 envíos, más reciente primero.",
  input_schema: {
    type: "object",
    properties: {
      markbox: {
        type: "string",
        description: "MARKBOX del cliente, formato DTD-NNNN.",
      },
    },
    required: ["markbox"],
  },
  handler: async (ctx, input) => {
    const markbox = String(input.markbox ?? "").trim();
    if (!markbox) return [];
    const rows = await listShipmentsByMarkbox(ctx.supabase, markbox);
    // Necesitamos campos extra → re-fetch con select más completo
    const { data } = await ctx.supabase
      .from("shipments")
      .select(
        "code, origin, destination, shipment_service, status, client_markbox, client_name, eta_estimated",
      )
      .eq("client_markbox", markbox)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!data) return [];
    return (data as Array<{
      code: string;
      origin: string;
      destination: string;
      shipment_service: string;
      status: string;
      client_markbox: string | null;
      client_name: string | null;
      eta_estimated: string | null;
    }>).map((d) => ({
      code: d.code,
      origin: d.origin,
      destination: d.destination,
      service: d.shipment_service,
      status: d.status,
      client_markbox: d.client_markbox,
      client_name: d.client_name,
      eta_estimated: d.eta_estimated,
    }));
    // Nota: `rows` de listShipmentsByMarkbox queda sin usar — lo dejamos
    // como guardia: si esa query falla por RLS, falla también la nuestra.
    void rows;
  },
};

// ─── Tool: get_customer ────────────────────────────────────

const getCustomerTool: ToolDef<{ markbox: string }, ClientSummary | null> = {
  key: "get_customer",
  description:
    "Devuelve resumen de un cliente por MARKBOX (DTD-NNNN): nombre, tier, ubicación, total de envíos históricos.",
  input_schema: {
    type: "object",
    properties: {
      markbox: { type: "string", description: "MARKBOX del cliente." },
    },
    required: ["markbox"],
  },
  handler: async (ctx, input) => {
    const markbox = String(input.markbox ?? "").trim();
    if (!markbox) return null;
    const client = await getClientByMarkbox(ctx.supabase, markbox);
    if (!client) return null;
    const shipments = await listShipmentsByMarkbox(ctx.supabase, markbox);
    return {
      markbox: client.markbox,
      name: client.name,
      tier: client.tier ?? null,
      address: client.address ?? null,
      total_shipments: shipments.length,
    };
  },
};

// ─── Export array para registry ─────────────────────────────

export const SHIPMENT_TOOLS = [
  getShipmentTool,
  getShipmentTimelineTool,
  searchShipmentsByCustomerTool,
  getCustomerTool,
];
