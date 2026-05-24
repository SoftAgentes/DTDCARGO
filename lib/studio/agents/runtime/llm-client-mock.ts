/**
 * Mock LLM client (SDD-0020 Fase 2D.1).
 *
 * Simula un cliente Anthropic SIN gastar tokens — útil para validar el
 * loop tool-use + audit + policy gates end-to-end antes de wirear el
 * SDK real en Fase 2D.2.
 *
 * Lógica determinística basada en el `input.query`:
 *  - Detecta códigos S-YYYY-NNNN → invoca `get_shipment` + `get_shipment_timeline`
 *  - Detecta MARKBOX DTD-NNNN → invoca `get_customer` + `search_shipments_by_customer`
 *  - Else → respuesta genérica pidiendo más info, sin tool calls
 *
 * Devuelve `LLMRunResponse` con métricas mock (tokens hardcoded, cost
 * basado en cost_estimate de la skill).
 */

import type { AgentToolCall } from "@/lib/studio/agent-types";
import type {
  AnyToolDef,
  LLMClient,
  LLMRunResponse,
  ToolContext,
} from "./types";

const SHIPMENT_CODE_RE = /\bS-\d{4}-\d{3,5}\b/i;
const MARKBOX_RE = /\bDTD-\d{3,5}\b/i;

async function callTool(
  tool: AnyToolDef,
  ctx: ToolContext,
  input: unknown,
): Promise<AgentToolCall> {
  const started_at = new Date().toISOString();
  const t0 = Date.now();
  try {
    const output = await tool.handler(ctx, input);
    return {
      tool_key: tool.key,
      input,
      output,
      started_at,
      ended_at: new Date().toISOString(),
      latency_ms: Date.now() - t0,
    };
  } catch (e) {
    return {
      tool_key: tool.key,
      input,
      error: e instanceof Error ? e.message : String(e),
      started_at,
      ended_at: new Date().toISOString(),
      latency_ms: Date.now() - t0,
    };
  }
}

function findTool(tools: AnyToolDef[], key: string): AnyToolDef | undefined {
  return tools.find((t) => t.key === key);
}

export class MockLLMClient implements LLMClient {
  async run({
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
    const query = String(input.query ?? "").trim();
    const customerMarkbox = String(input.customer_markbox ?? "").trim();
    const toolCalls: AgentToolCall[] = [];
    const citations: string[] = [];

    // 1. Si query menciona un código de shipment → consultar shipment + timeline
    const shipMatch = query.match(SHIPMENT_CODE_RE);
    if (shipMatch) {
      const code = shipMatch[0].toUpperCase();
      const tGet = findTool(tools, "get_shipment");
      const tTimeline = findTool(tools, "get_shipment_timeline");
      let shipmentSummary: Record<string, unknown> | null = null;
      let timeline: unknown[] = [];

      if (tGet) {
        const call = await callTool(tGet, ctx, { code });
        toolCalls.push(call);
        if (call.output && !call.error) {
          shipmentSummary = call.output as Record<string, unknown>;
          citations.push(`shipments.${code}`);
        }
      }
      if (tTimeline && shipmentSummary) {
        const call = await callTool(tTimeline, ctx, { code });
        toolCalls.push(call);
        if (Array.isArray(call.output)) {
          timeline = call.output;
          if (timeline.length > 0) citations.push(`events.${code}`);
        }
      }

      const message = shipmentSummary
        ? buildShipmentReply(code, shipmentSummary, timeline)
        : `No encuentro un envío con código ${code}. Verificá que esté bien escrito (formato S-YYYY-NNNN) o consultá con el equipo de Operaciones.`;

      return mockResult({
        output: {
          message,
          shipment_code: shipmentSummary ? code : undefined,
          citations,
        },
        toolCalls,
      });
    }

    // 2. Si query menciona un MARKBOX (o viene como customer_markbox) → cliente + sus envíos
    const markboxMatch = query.match(MARKBOX_RE);
    const markbox = (markboxMatch?.[0] ?? customerMarkbox).toUpperCase();
    if (markbox) {
      const tCustomer = findTool(tools, "get_customer");
      const tList = findTool(tools, "search_shipments_by_customer");
      let customer: Record<string, unknown> | null = null;
      let shipments: unknown[] = [];

      if (tCustomer) {
        const call = await callTool(tCustomer, ctx, { markbox });
        toolCalls.push(call);
        if (call.output && !call.error) {
          customer = call.output as Record<string, unknown>;
          citations.push(`clients.${markbox}`);
        }
      }
      if (tList) {
        const call = await callTool(tList, ctx, { markbox });
        toolCalls.push(call);
        if (Array.isArray(call.output)) {
          shipments = call.output;
        }
      }

      const message = customer
        ? buildCustomerReply(markbox, customer, shipments)
        : `No encuentro un cliente con MARKBOX ${markbox}. Verificá el código o consultá el módulo Clientes.`;

      return mockResult({
        output: { message, citations },
        toolCalls,
      });
    }

    // 3. Sin códigos detectables → pedir más info, sin tool calls
    return mockResult({
      output: {
        message:
          "Para ayudarte mejor, mandame el código del envío (formato S-YYYY-NNNN) o el MARKBOX del cliente (DTD-NNNN).",
        citations: [],
      },
      toolCalls: [],
    });
  }
}

// ─── Helpers de render de respuestas ────────────────────────

function buildShipmentReply(
  code: string,
  s: Record<string, unknown>,
  timeline: unknown[],
): string {
  const origin = String(s.origin ?? "—");
  const destination = String(s.destination ?? "—");
  const service = String(s.service ?? "—");
  const status = String(s.status ?? "—");
  const client = s.client_name ? `del cliente ${s.client_name}` : "";
  const eta = s.eta_estimated
    ? ` · ETA estimada ${formatEta(String(s.eta_estimated))}`
    : "";
  const lastEvent = Array.isArray(timeline) && timeline.length > 0
    ? ` · último evento: ${describeEvent(timeline[0] as Record<string, unknown>)}`
    : "";
  return `El envío ${code} ${client} está en estado ${status}, ruta ${origin} → ${destination} (${service})${eta}${lastEvent}.`.trim();
}

function buildCustomerReply(
  markbox: string,
  c: Record<string, unknown>,
  shipments: unknown[],
): string {
  const name = String(c.name ?? "—");
  const tier = c.tier ? ` (tier ${c.tier})` : "";
  const total = Array.isArray(shipments) ? shipments.length : 0;
  const lines = [`Cliente ${name} (${markbox})${tier} tiene ${total} ${total === 1 ? "envío" : "envíos"} registrados.`];
  if (Array.isArray(shipments) && shipments.length > 0) {
    const recent = shipments.slice(0, 3).map((s) => {
      const x = s as Record<string, unknown>;
      return `${x.code} (${x.status})`;
    });
    lines.push(`Más recientes: ${recent.join(", ")}.`);
  }
  return lines.join(" ");
}

function describeEvent(e: Record<string, unknown>): string {
  const status = String(e.status ?? "—");
  const note = e.note ? ` (${e.note})` : "";
  return `${status}${note}`;
}

function formatEta(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function mockResult({
  output,
  toolCalls,
}: {
  output: Record<string, unknown>;
  toolCalls: AgentToolCall[];
}): LLMRunResponse {
  // Métricas mock: tokens proporcionales al output, cost al cost_estimate
  // de Sonnet ($0.003/1K input + $0.015/1K output, aprox).
  const tokensIn = 800; // system prompt + tools schemas + input
  const tokensOut = Math.max(80, JSON.stringify(output).length / 4);
  const costUsd =
    (tokensIn / 1000) * 0.003 + (tokensOut / 1000) * 0.015;
  return {
    output,
    toolCalls,
    tokensIn,
    tokensOut: Math.round(tokensOut),
    costUsd: Math.round(costUsd * 10000) / 10000,
  };
}
