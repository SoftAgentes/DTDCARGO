/**
 * Queries puras del módulo Conversaciones (SDD-0056 · Fase 1).
 * Funciones que reciben un `SupabaseClient` (regular, RLS filtra por tenant).
 *
 * - listConversations: filas de la bandeja (conversation + cliente + agente +
 *   preview del último mensaje), agrupables/filtrables client-side.
 * - computeConversationKpis: las 4 KPIs (abiertas+sin leer · sin asignar ·
 *   casos abiertos · resueltas hoy).
 * - listAssignableAgents: usuarios activos del tenant para el picker de asignación.
 * - getClientContext: panel lateral (MARKBOX, envíos activos, saldo CxC).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import type {
  Conversation,
  ConversationAgent,
  ConversationClientContext,
  ConversationKpis,
  ConversationRow,
} from "./conversations-types";

// ─────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────

type AgentNameMap = Map<string, string>;

/** user_id → nombre legible (first + last), para resolver agentes asignados. */
async function loadAgentNames(supabase: SupabaseClient): Promise<AgentNameMap> {
  const map: AgentNameMap = new Map();
  const { data, error } = await supabase
    .from("user_tenants")
    .select("user_id, profile:user_profiles(first_name, last_name)")
    .is("disabled_at", null);
  if (error || !data) return map;
  for (const r of data as Array<{
    user_id: string;
    profile:
      | { first_name: string | null; last_name: string | null }
      | { first_name: string | null; last_name: string | null }[]
      | null;
  }>) {
    const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
    const name = `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim();
    map.set(r.user_id, name || "Agente");
  }
  return map;
}

// ─────────────────────────────────────────────────────────────
// Lista de la bandeja
// ─────────────────────────────────────────────────────────────

/**
 * Filas de la bandeja: cada `conversation` (no borrada) + datos del cliente
 * (join clients) + agente asignado (resuelto del map de usuarios) + preview del
 * último mensaje (subquery a conversation_messages, recientes primero).
 *
 * Devuelve hasta `limit` (default 200), recientes primero por last_message_at.
 */
/**
 * Conversaciones con mensajes sin leer del tenant, mínimas (id + unread_count),
 * para el badge del topbar (SDD-0148). RLS scopea al tenant. El componente client
 * las mantiene vivas por Realtime (upsert en UPDATE → un hilo reabierto entra
 * solo). Payload chico a propósito (corre en el layout de cada pantalla).
 */
export async function listUnreadConversationsForBadge(
  supabase: SupabaseClient,
): Promise<Array<{ id: string; unread_count: number }>> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, unread_count")
    .is("deleted_at", null)
    .gt("unread_count", 0)
    .limit(200);
  if (error || !data) return [];
  return data as Array<{ id: string; unread_count: number }>;
}

/** Un resumen mensual del histórico (SDD-0149). `period` = primer día del mes. */
export type ConversationDigest = {
  id: string;
  period: string;
  summary: string;
  messageCount: number;
  inCount: number;
  outCount: number;
  generatedAt: string;
};

/**
 * Historial de resúmenes mensuales del cliente (SDD-0149 · Fase 2), recientes
 * primero. RLS filtra por tenant. Para el panel del hilo en Conversaciones — el
 * histórico condensado de lo dialogado (cada uno con su fecha).
 */
export async function listClientConversationDigests(
  supabase: SupabaseClient,
  clientId: string,
): Promise<ConversationDigest[]> {
  const { data, error } = await supabase
    .from("conversation_monthly_digests")
    .select("id, period, summary, message_count, in_count, out_count, generated_at")
    .eq("client_id", clientId)
    .order("period", { ascending: false })
    .limit(60);
  if (error || !data) return [];
  return (
    data as Array<{
      id: string;
      period: string;
      summary: string;
      message_count: number;
      in_count: number;
      out_count: number;
      generated_at: string;
    }>
  ).map((d) => ({
    id: d.id,
    period: d.period,
    summary: d.summary,
    messageCount: d.message_count,
    inCount: d.in_count,
    outCount: d.out_count,
    generatedAt: d.generated_at,
  }));
}

export async function listConversations(
  supabase: SupabaseClient,
  opts: { limit?: number } = {},
): Promise<ConversationRow[]> {
  const limit = opts.limit ?? 200;

  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, tenant_id, client_id, ref, channel, status, is_case, assigned_to, subject, last_message_at, unread_count, external_ref, created_at, updated_at, deleted_at, client:clients(markbox, name, email, phone)",
    )
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  const convs = data as Array<
    Conversation & {
      client:
        | { markbox: string; name: string; email: string | null; phone: string | null }
        | { markbox: string; name: string; email: string | null; phone: string | null }[]
        | null;
    }
  >;

  const agentNames = await loadAgentNames(supabase);

  // Preview del último mensaje de cada hilo (una sola query, agrupado en JS).
  const convIds = convs.map((c) => c.id);
  const lastMsgMap = await loadLastMessages(supabase, convIds);

  return convs.map((c) => {
    const client = Array.isArray(c.client) ? c.client[0] : c.client;
    const last = lastMsgMap.get(c.id);
    const agent: ConversationAgent | null = c.assigned_to
      ? { id: c.assigned_to, name: agentNames.get(c.assigned_to) ?? "Agente" }
      : null;
    return {
      ...c,
      client_id: c.client_id,
      markbox: client?.markbox ?? "—",
      client_name: client?.name ?? "Cliente",
      email: client?.email ?? null,
      phone: client?.phone ?? null,
      agent,
      last_message_preview: last?.body ?? null,
      last_message_direction: last?.direction ?? null,
    } as ConversationRow;
  });
}

/** conversation_id → último mensaje (body + direction). Una query, agrupado en JS. */
async function loadLastMessages(
  supabase: SupabaseClient,
  convIds: string[],
): Promise<Map<string, { body: string; direction: "in" | "out" }>> {
  const map = new Map<string, { body: string; direction: "in" | "out" }>();
  if (convIds.length === 0) return map;
  const { data, error } = await supabase
    .from("conversation_messages")
    .select("conversation_id, body, direction, sent_at")
    .in("conversation_id", convIds)
    .order("sent_at", { ascending: false });
  if (error || !data) return map;
  // El primero por conversation_id (orden desc) es el más reciente.
  for (const m of data as Array<{
    conversation_id: string;
    body: string;
    direction: "in" | "out";
  }>) {
    if (!map.has(m.conversation_id)) {
      map.set(m.conversation_id, { body: m.body, direction: m.direction });
    }
  }
  return map;
}

// ─────────────────────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────────────────────

/**
 * Las 4 KPIs de la bandeja. Calcula sobre `conversations` (no borradas):
 *   - open      = status='abierto'
 *   - unread    = Σ unread_count de las abiertas
 *   - unassigned= assigned_to null y status != 'resuelto'
 *   - openCases = is_case y status != 'resuelto'
 *   - resolvedToday = status='resuelto' y updated_at >= inicio del día (UTC)
 *
 * Una sola lectura de columnas mínimas + agregación en JS (la bandeja no tiene
 * volumen alto; evita 5 head-counts).
 */
export async function computeConversationKpis(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<ConversationKpis> {
  // Paginado: son los KPI de conversaciones (conteos por estado).
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(
    (d, h) =>
      supabase
        .from("conversations")
        .select("status, is_case, assigned_to, unread_count, updated_at")
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(d, h),
  );
  if (!complete) {
    throw new Error("Las conversaciones superan el tope de lectura para el KPI.");
  }


  return aggregateKpis(
    data as Array<{
      status: string;
      is_case: boolean;
      assigned_to: string | null;
      unread_count: number;
      updated_at: string;
    }>,
    now,
  );
}

/** Agregación pura de KPIs (testeable sin DB). */
export function aggregateKpis(
  rows: Array<{
    status: string;
    is_case: boolean;
    assigned_to: string | null;
    unread_count: number;
    updated_at: string;
  }>,
  now: Date = new Date(),
): ConversationKpis {
  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).getTime();
  let open = 0;
  let unread = 0;
  let unassigned = 0;
  let openCases = 0;
  let resolvedToday = 0;
  for (const r of rows) {
    const resolved = r.status === "resuelto";
    if (r.status === "abierto") {
      open += 1;
      unread += r.unread_count ?? 0;
    }
    if (!r.assigned_to && !resolved) unassigned += 1;
    if (r.is_case && !resolved) openCases += 1;
    if (resolved) {
      const t = new Date(r.updated_at).getTime();
      if (!Number.isNaN(t) && t >= startOfDay) resolvedToday += 1;
    }
  }
  return { open, unread, unassigned, openCases, resolvedToday };
}

// ─────────────────────────────────────────────────────────────
// Agentes asignables
// ─────────────────────────────────────────────────────────────

/** Usuarios activos del tenant para el picker de asignación (id + nombre). */
export async function listAssignableAgents(
  supabase: SupabaseClient,
): Promise<ConversationAgent[]> {
  const map = await loadAgentNames(supabase);
  return [...map.entries()].map(([id, name]) => ({ id, name }));
}

// ─────────────────────────────────────────────────────────────
// Contexto del cliente (panel lateral)
// ─────────────────────────────────────────────────────────────

const TERMINAL_SHIPMENT_STATUSES = new Set([
  "delivered",
  "cancelled",
  "arrived_destination",
]);

/**
 * Contexto del cliente para el panel del hilo: MARKBOX, envíos activos y saldo
 * CxC. No duplica data operativa — los envíos linkean al módulo y el saldo es un
 * agregado (link a Cobranzas en la UI). La RPC resuelve el cliente desde el hilo
 * y devuelve sólo saldo/moneda. Devuelve null si no hay contexto autorizado.
 */
export async function getClientContext(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<ConversationClientContext | null> {
  const { data: outstanding, error: outstandingError } = await supabase
    .rpc("conversation_client_outstanding", {
      p_conversation_id: conversationId,
    })
    .maybeSingle<{ client_id: string; balance: number | string; currency: string }>();
  if (outstandingError || !outstanding) return null;
  const balance = Number(outstanding.balance);
  if (!Number.isFinite(balance) || balance < 0) return null;

  const { data: client, error } = await supabase
    .from("clients")
    .select("id, markbox, name, email, phone")
    .eq("id", outstanding.client_id)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      markbox: string;
      name: string;
      email: string | null;
      phone: string | null;
    }>();
  if (error || !client) return null;

  // Envíos activos del cliente (por markbox), recientes primero.
  const { data: ships } = await supabase
    .from("shipments")
    .select("id, code, status")
    .eq("client_markbox", client.markbox)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(50);

  const activeShipments = ((ships as Array<{ id: string; code: string; status: string }> | null) ?? [])
    .filter((s) => !TERMINAL_SHIPMENT_STATUSES.has(s.status))
    .slice(0, 5);

  return {
    client_id: client.id,
    markbox: client.markbox,
    client_name: client.name,
    email: client.email,
    phone: client.phone,
    activeShipments,
    outstandingBalance: balance,
    outstandingCurrency: outstanding.currency,
  };
}
