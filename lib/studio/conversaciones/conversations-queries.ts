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

const EMPTY_KPIS: ConversationKpis = {
  open: 0,
  unread: 0,
  unassigned: 0,
  openCases: 0,
  resolvedToday: 0,
};

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
  const { data, error } = await supabase
    .from("conversations")
    .select("status, is_case, assigned_to, unread_count, updated_at")
    .is("deleted_at", null)
    .limit(2000);

  if (error || !data) return EMPTY_KPIS;

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
 * agregado (link a Cobranzas en la UI). Devuelve null si el cliente no existe.
 */
export async function getClientContext(
  supabase: SupabaseClient,
  clientId: string,
): Promise<ConversationClientContext | null> {
  const { data: client, error } = await supabase
    .from("clients")
    .select("id, markbox, name, email, phone")
    .eq("id", clientId)
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

  // Saldo CxC: Σ (total − paid) de facturas no-borrador, moneda dominante.
  const { data: invoices } = await supabase
    .from("invoices")
    .select("currency, total_amount, paid_amount")
    .eq("client_markbox", client.markbox)
    .neq("status", "borrador")
    .is("deleted_at", null);

  const { balance, currency } = aggregateOutstanding(
    ((invoices as Array<{
      currency: string;
      total_amount: number | null;
      paid_amount: number | null;
    }> | null) ?? []),
  );

  return {
    client_id: client.id,
    markbox: client.markbox,
    client_name: client.name,
    email: client.email,
    phone: client.phone,
    activeShipments,
    outstandingBalance: balance,
    outstandingCurrency: currency,
  };
}

/** Agrega saldo pendiente por moneda y devuelve la moneda dominante. Pura. */
export function aggregateOutstanding(
  invoices: Array<{
    currency: string;
    total_amount: number | null;
    paid_amount: number | null;
  }>,
): { balance: number; currency: string } {
  const byCurrency = new Map<string, { total: number; balance: number }>();
  for (const inv of invoices) {
    const e = byCurrency.get(inv.currency) ?? { total: 0, balance: 0 };
    e.total += Number(inv.total_amount ?? 0);
    e.balance += Math.max(0, Number(inv.total_amount ?? 0) - Number(inv.paid_amount ?? 0));
    byCurrency.set(inv.currency, e);
  }
  const currencies = [...byCurrency.keys()];
  const currency =
    currencies
      .slice()
      .sort((a, b) => (byCurrency.get(b)?.total ?? 0) - (byCurrency.get(a)?.total ?? 0))[0] ??
    "USD";
  return { balance: byCurrency.get(currency)?.balance ?? 0, currency };
}
