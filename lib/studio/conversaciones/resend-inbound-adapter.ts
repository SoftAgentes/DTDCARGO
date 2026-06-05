/**
 * Adapter Resend Inbound → core de ingesta — SDD-0056 · Fase 2.
 *
 * Aísla TODO el parsing Resend-específico para que `ingestInboundEmail` siga
 * siendo provider-agnóstico (si mañana cambia el proveedor, se reescribe solo
 * este archivo).
 *
 * Contrato real (verificado en los docs de Resend, 2026-06-04):
 *
 * 1. Webhook `email.received` — SOLO metadata (no trae body/headers/adjuntos):
 *    {
 *      "type": "email.received",
 *      "created_at": "2026-04-03T23:41:11.894719+00:00",
 *      "data": {
 *        "email_id": "...",          // id para la Received Emails API
 *        "from": "user@dominio",
 *        "to": ["casilla@dtd..."],
 *        "cc": [], "bcc": [],
 *        "message_id": "<example+123>",
 *        "subject": "...",
 *        "attachments": [ { id, filename, content_type, ... } ]
 *      }
 *    }
 *    Docs: https://resend.com/docs/dashboard/receiving/introduction
 *
 * 2. Received Emails API — el cuerpo se baja aparte:
 *    GET https://api.resend.com/emails/receiving/:email_id  (Bearer RESEND_API_KEY)
 *    {
 *      "object": "email", "id": "...",
 *      "to": [...], "from": "...", "created_at": "...",
 *      "subject": "...", "html": "...", "text": null,
 *      "headers": { "from": "...", "in-reply-to": "...", ... },
 *      "cc": [], "bcc": [], "reply_to": [],
 *      "message_id": "<example+123>",
 *      "raw": { "download_url": "...", "expires_at": "..." },
 *      "attachments": [ ... ]
 *    }
 *    Docs: https://resend.com/docs/api-reference/emails/retrieve-received-email
 *
 * La idempotencia usa `email_id` (estable y único por email recibido) como
 * `providerMsgId` — el `message_id` (header del remitente) puede repetirse o
 * faltar; el `email_id` lo asigna Resend.
 *
 * El threading, en cambio, usa el `Message-ID` RFC del email entrante (header
 * del remitente, ej. `<abc@mail.gmail.com>`) → `rfcMessageId`. Es lo que
 * In-Reply-To/References debe referenciar para que la respuesta agrupe en el
 * cliente de correo del cliente (Gmail/Outlook). El email_id interno de Resend
 * NO sirve para esto. Se toma de `message_id` o, si falta, de `headers['message-id']`.
 */

import type { InboundEmailInput } from "./inbound-email";

// ─────────────────────────────────────────────────────────────
// Shapes del proveedor (lo que SÍ usamos del payload)
// ─────────────────────────────────────────────────────────────

export type ResendInboundWebhookEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    message_id?: string;
    subject?: string;
    [k: string]: unknown;
  };
};

export type ResendReceivedEmail = {
  object?: string;
  id?: string;
  from?: string;
  to?: string[];
  subject?: string;
  html?: string | null;
  text?: string | null;
  message_id?: string | null;
  created_at?: string;
  headers?: Record<string, string> | null;
  [k: string]: unknown;
};

export const RESEND_INBOUND_EVENT = "email.received";

/** El evento del webhook es un email entrante que nos interesa ingestar. */
export function isInboundEmailEvent(event: ResendInboundWebhookEvent): boolean {
  return event?.type === RESEND_INBOUND_EVENT && !!event?.data?.email_id;
}

/** Extrae el email_id del webhook (lo que se pasa a la Received Emails API). */
export function inboundEmailIdOf(event: ResendInboundWebhookEvent): string | null {
  const id = event?.data?.email_id;
  return typeof id === "string" && id.trim() !== "" ? id.trim() : null;
}

// ─────────────────────────────────────────────────────────────
// Parsing de "from" → email + nombre
// ─────────────────────────────────────────────────────────────

/** "Nombre Apellido <user@dominio>" → { email, name }. Tolera solo el address. */
export function parseFromAddress(raw: string | null | undefined): {
  email: string;
  name: string | null;
} {
  const s = (raw ?? "").trim();
  if (!s) return { email: "", name: null };
  const m = s.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) {
    const name = m[1].replace(/^["']|["']$/g, "").trim() || null;
    return { email: m[2].trim().toLowerCase(), name };
  }
  return { email: s.toLowerCase(), name: null };
}

/** El "to" del email puede traer varias direcciones; tomamos la primera. */
function firstAddress(list: string[] | undefined): string | null {
  if (!list || list.length === 0) return null;
  const parsed = parseFromAddress(list[0]);
  return parsed.email || null;
}

// ─────────────────────────────────────────────────────────────
// Mapeo al input del core
// ─────────────────────────────────────────────────────────────

/**
 * Mapea (evento del webhook + cuerpo bajado por la API) → input del core.
 *
 * - `providerMsgId` = email_id (id estable del email recibido → idempotencia).
 * - `rfcMessageId`  = Message-ID RFC del remitente (`message_id` o el header
 *   `message-id`) → threading. null si no vino (mejor que un valor incorrecto).
 * - `body` = preferir `text`; si no hay, derivar de `html` (strip básico de tags).
 * - `subject`/`sentAt`/`to` se toman del cuerpo (más completo) con fallback al
 *   webhook.
 */
export function mapResendInboundToCore(args: {
  event: ResendInboundWebhookEvent;
  email: ResendReceivedEmail;
}): InboundEmailInput | null {
  const { event, email } = args;
  const emailId = inboundEmailIdOf(event) ?? (typeof email.id === "string" ? email.id : null);
  if (!emailId) return null;

  const fromRaw = email.from ?? event.data?.from ?? null;
  const { email: fromEmail, name: fromName } = parseFromAddress(fromRaw);
  if (!fromEmail) return null;

  const toAddress = firstAddress(email.to) ?? firstAddress(event.data?.to) ?? null;
  const subject = (email.subject ?? event.data?.subject ?? "").trim() || null;
  const sentAt = (email.created_at ?? event.created_at ?? "").trim() || null;
  const rfcMessageId = rfcMessageIdOf({ email, event });
  const body = bodyFromEmail(email);
  if (!body) return null;

  return {
    fromEmail,
    fromName,
    toAddress,
    subject,
    body,
    providerMsgId: emailId,
    rfcMessageId,
    sentAt,
  };
}

/**
 * Message-ID RFC del email entrante (header del remitente) para threading.
 * Orden de preferencia: campo top-level `message_id` → header `message-id`
 * (case-insensitive) → del webhook (`event.data.message_id`). Devuelve null si
 * ninguno trae un valor (el core lo valida de forma `<...>` antes de sembrarlo).
 */
export function rfcMessageIdOf(args: {
  email: ResendReceivedEmail;
  event?: ResendInboundWebhookEvent;
}): string | null {
  const { email, event } = args;
  const fromHeader = headerValue(email.headers, "message-id");
  const candidate =
    (typeof email.message_id === "string" ? email.message_id : null) ??
    fromHeader ??
    (typeof event?.data?.message_id === "string" ? event.data.message_id : null);
  const trimmed = (candidate ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/** Busca un header por nombre (case-insensitive) en el mapa de headers del email. */
function headerValue(
  headers: Record<string, string> | null | undefined,
  name: string,
): string | null {
  if (!headers) return null;
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) return typeof v === "string" ? v : null;
  }
  return null;
}

/**
 * Cuerpo legible: prefiere `text`; si solo hay `html`, hace un strip básico de
 * tags + colapso de whitespace (no es un renderer, solo evitar guardar markup
 * crudo). Devuelve "" si no hay contenido.
 */
export function bodyFromEmail(email: ResendReceivedEmail): string {
  const text = (email.text ?? "").trim();
  if (text) return text;
  const html = (email.html ?? "").trim();
  if (!html) return "";
  return htmlToText(html);
}

/** Strip mínimo de HTML a texto (no librería; suficiente para guardar el hilo). */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
