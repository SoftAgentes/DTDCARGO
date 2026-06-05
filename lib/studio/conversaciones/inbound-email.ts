/**
 * Core de ingesta de email entrante — SDD-0056 · Fase 2.
 *
 * Provider-agnóstico y puro (recibe un admin `SupabaseClient` con service_role
 * que bypassa RLS — el webhook NO tiene sesión de usuario). Todo el parsing
 * Resend-específico vive en `resend-inbound-adapter.ts`; acá entra el input ya
 * normalizado.
 *
 * Flujo de `ingestInboundEmail`:
 *   1. Resuelve el cliente por `clients.email` (case-insensitive, vivo).
 *        - 0 matches → { status: 'unmatched' } (NO inserta: client_id es NOT NULL,
 *          un remitente desconocido no puede crear hilo). Dead-letter/log del caller.
 *        - >1 match (mismo email en varios tenants) → desambigua por `toAddress`
 *          (dominio/tenant); si no se puede → { status: 'ambiguous' }.
 *   2. Hilo: reusa el hilo VIVO cliente×canal='email'; si no existe, lo crea con
 *      `ref` (RPC next_conversation_ref) + subject. Maneja la race del índice
 *      único parcial (23505) re-seleccionando el existente.
 *   3. Idempotencia: insert del mensaje inbound con external_msg_id = providerMsgId
 *      (reusa insertInboundMessage). Si ya existe → { status: 'duplicate' }.
 *   4. Bump unread/last_message_at + reabre si estaba 'resuelto' (mismo comportamiento
 *      que portal_post_message).
 *
 * NO agrega migración: code-only sobre el schema 0106 (decisión del founder).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { insertInboundMessage } from "./messages-queries";

// ─────────────────────────────────────────────────────────────
// Input/Output del core
// ─────────────────────────────────────────────────────────────

export type InboundEmailInput = {
  /** Email del remitente (cliente). Se normaliza a lower-case. */
  fromEmail: string;
  /** Nombre legible del remitente (si vino). */
  fromName?: string | null;
  /** Dirección "to" receptora (desambigua tenant si el email matchea varios). */
  toAddress?: string | null;
  /** Asunto del email (se usa como subject del hilo si se crea). */
  subject?: string | null;
  /** Cuerpo en texto plano (ya bajado por la Received Emails API). */
  body: string;
  /** id del proveedor (Resend email_id, estable) → idempotencia. */
  providerMsgId: string;
  /**
   * Message-ID RFC del email entrante (header `Message-ID`, ej. `<abc@mail.gmail.com>`)
   * → threading. Se siembra en `conversations.external_ref` al CREAR el hilo, y
   * `sendReplyAction` lo referencia con In-Reply-To/References para que la respuesta
   * caiga en el mismo hilo del cliente de correo. Distinto del `providerMsgId`
   * (que es el id interno de Resend, NO sirve para agrupar en Gmail/Outlook).
   * Si no viene → el hilo queda con external_ref null (un valor incorrecto es peor
   * que ninguno; sendReplyAction saltea el threading si es null).
   */
  rfcMessageId?: string | null;
  /** ISO de envío (created_at del email). Default: ahora. */
  sentAt?: string | null;
};

export type IngestResult =
  | { status: "ingested"; conversationId: string; duplicate: false }
  | { status: "duplicate"; conversationId: string }
  | { status: "unmatched" }
  | { status: "ambiguous"; matches: number }
  | { status: "error"; error: string };

type ClientMatch = {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Devuelve el Message-ID RFC solo si tiene forma válida (`<algo>`). Cualquier
 * otra cosa (vacío, sin `<>`, el email_id interno de Resend) → null, para no
 * sembrar un external_ref que rompa el threading de la respuesta.
 */
function normalizeRfcMessageId(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  // RFC 5322 message-id: <id-left@id-right>. Validación mínima de forma.
  return /^<[^<>@\s]+@[^<>@\s]+>$/.test(s) ? s : null;
}

/** Dominio de un email (sin `<>`, sin display name). null si no parsea. */
export function emailDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // "Nombre <user@dominio>" → quedarse con el address.
  const m = raw.match(/<([^>]+)>/);
  const addr = (m ? m[1] : raw).trim().toLowerCase();
  const at = addr.lastIndexOf("@");
  if (at < 0 || at === addr.length - 1) return null;
  return addr.slice(at + 1);
}

/**
 * Resuelve el cliente por email. Devuelve todos los matches vivos (puede haber
 * el mismo email en varios tenants — multi-tenant). El admin client bypassa RLS
 * así que la desambiguación por tenant es responsabilidad nuestra.
 */
async function findClientsByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<ClientMatch[]> {
  const { data, error } = await admin
    .from("clients")
    .select("id, tenant_id, name, email")
    .ilike("email", email) // case-insensitive exact (sin %)
    .is("deleted_at", null);
  if (error || !data) return [];
  return data as ClientMatch[];
}

/**
 * Resuelve/crea el hilo VIVO cliente×canal='email'. Maneja la race del índice
 * único parcial (tenant, client, channel) where deleted_at is null:
 *   - si dos inbound entran a la vez y ambos no ven hilo, el segundo INSERT
 *     choca 23505 → re-seleccionamos el que ganó.
 * Devuelve el conversation_id + si el hilo es nuevo (para sembrar external_ref).
 */
async function resolveOrCreateEmailThread(
  admin: SupabaseClient,
  args: {
    tenantId: string;
    clientId: string;
    subject: string | null;
    /** Message-ID RFC del primer email → external_ref (threading). null si no vino. */
    rfcMessageId: string | null;
  },
): Promise<{ ok: true; conversationId: string; created: boolean } | { ok: false; error: string }> {
  const existing = await selectLiveEmailThread(admin, args.tenantId, args.clientId);
  if (existing) return { ok: true, conversationId: existing, created: false };

  // No hay hilo vivo → crear con ref. external_ref siembra el Message-ID RFC del
  // primer email para threading de la respuesta (In-Reply-To/References). Si no
  // vino el header → external_ref queda null (NO sembramos el email_id interno de
  // Resend: no agrupa en Gmail/Outlook, y un valor incorrecto es peor que ninguno).
  const { data: refData, error: refErr } = await admin.rpc("next_conversation_ref", {
    p_tenant_id: args.tenantId,
  });
  if (refErr) return { ok: false, error: `next_conversation_ref: ${refErr.message}` };
  const ref = typeof refData === "string" ? refData : null;

  const { data: created, error: insErr } = await admin
    .from("conversations")
    .insert({
      tenant_id: args.tenantId,
      client_id: args.clientId,
      ref,
      channel: "email",
      status: "abierto",
      subject: args.subject,
      external_ref: args.rfcMessageId,
      last_message_at: new Date().toISOString(),
      unread_count: 0,
    })
    .select("id")
    .single<{ id: string }>();

  if (insErr) {
    // Race: otro inbound creó el hilo entre el SELECT y el INSERT. Re-seleccionar.
    if (insErr.code === "23505") {
      const after = await selectLiveEmailThread(admin, args.tenantId, args.clientId);
      if (after) return { ok: true, conversationId: after, created: false };
    }
    return { ok: false, error: `insert conversation: ${insErr.message}` };
  }
  if (!created) return { ok: false, error: "insert conversation devolvió vacío" };
  return { ok: true, conversationId: created.id, created: true };
}

async function selectLiveEmailThread(
  admin: SupabaseClient,
  tenantId: string,
  clientId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("conversations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .eq("channel", "email")
    .is("deleted_at", null)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

// ─────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────

/**
 * Ingesta un email entrante al hilo del cliente. Idempotente por providerMsgId.
 * Provider-agnóstico: el caller (webhook) ya normalizó el payload del proveedor.
 */
export async function ingestInboundEmail(
  admin: SupabaseClient,
  input: InboundEmailInput,
): Promise<IngestResult> {
  const fromEmail = normalizeEmail(input.fromEmail);
  if (!fromEmail) return { status: "error", error: "fromEmail vacío" };
  const providerMsgId = (input.providerMsgId ?? "").trim();
  if (!providerMsgId) return { status: "error", error: "providerMsgId vacío" };
  const body = (input.body ?? "").trim();
  if (!body) return { status: "error", error: "body vacío" };

  // 1. Resolver cliente por email.
  const matches = await findClientsByEmail(admin, fromEmail);
  if (matches.length === 0) return { status: "unmatched" };

  let client: ClientMatch;
  if (matches.length === 1) {
    client = matches[0];
  } else {
    // >1 match: desambiguar. Si todos los matches son del MISMO tenant (dato
    // sucio: email duplicado dentro de un tenant), el tenant es inequívoco. Si
    // son de tenants distintos, sin un mapa tenant↔dominio receptor no hay forma
    // fiable → no adivinamos: 'ambiguous'. (El toAddress es la casilla de DTD,
    // no del cliente; no desambigua sin ese mapa, que es trabajo futuro.)
    const disambiguated = disambiguateByTenant(matches);
    if (!disambiguated) return { status: "ambiguous", matches: matches.length };
    client = disambiguated;
  }

  // 2. Resolver/crear el hilo email del cliente. external_ref (threading) usa el
  // Message-ID RFC del email entrante, NO el email_id interno de Resend. Solo
  // aceptamos un Message-ID con forma RFC (`<...>`); cualquier otra cosa → null.
  const rfcMessageId = normalizeRfcMessageId(input.rfcMessageId);
  const subject = (input.subject ?? "").trim() || null;
  const thread = await resolveOrCreateEmailThread(admin, {
    tenantId: client.tenant_id,
    clientId: client.id,
    subject,
    rfcMessageId,
  });
  if (!thread.ok) return { status: "error", error: thread.error };

  // 3. Insertar el mensaje inbound idempotente (external_msg_id = providerMsgId).
  const sentAt = (input.sentAt ?? "").trim() || new Date().toISOString();
  const authorName = (input.fromName ?? "").trim() || fromEmail;
  const inserted = await insertInboundMessage(admin, {
    tenantId: client.tenant_id,
    conversationId: thread.conversationId,
    body,
    authorName,
    externalMsgId: providerMsgId,
    sentAt,
  });
  if (!inserted.ok) return { status: "error", error: inserted.error };
  if (inserted.duplicate) {
    return { status: "duplicate", conversationId: thread.conversationId };
  }

  // 4. Reabrir el hilo si estaba 'resuelto' (el cliente volvió a escribir). El
  // bump de unread/last_message_at ya lo hizo insertInboundMessage; acá solo el
  // estado, igual que portal_post_message. Best-effort.
  await admin
    .from("conversations")
    .update({ status: "abierto" })
    .eq("id", thread.conversationId)
    .eq("status", "resuelto");

  return { status: "ingested", conversationId: thread.conversationId, duplicate: false };
}

/**
 * Desambigua entre varios clientes con el mismo email. Estrategia conservadora:
 * si todos los matches son del MISMO tenant (dato sucio: email duplicado dentro
 * de un tenant), el tenant es inequívoco → tomamos el primero. Si son de tenants
 * distintos (multi-tenant real), sin un mapa tenant↔dominio receptor no hay forma
 * fiable de elegir → devolvemos null (el caller responde 'ambiguous'). El
 * to-address no ayuda: es la casilla de DTD, no del cliente.
 */
export function disambiguateByTenant(matches: ClientMatch[]): ClientMatch | null {
  const tenants = new Set(matches.map((m) => m.tenant_id));
  if (tenants.size === 1) {
    // Mismo email duplicado dentro del mismo tenant (dato sucio): el tenant es
    // inequívoco, tomamos el primero — el hilo es por cliente×canal, el índice
    // único garantiza un solo hilo vivo.
    return matches[0];
  }
  // Multi-tenant real: sin mapa tenant↔dominio receptor no hay forma fiable.
  return null;
}
