/**
 * Cliente Resend mínimo · usa fetch directo (sin dep `resend` npm).
 * SDD-0026 Fase 2.
 *
 * Razones para fetch en lugar de la dep oficial:
 *   - Cero deps nuevas (evita pasar por `pnpm add` + workaround del founder)
 *   - Resend API es REST simple, el SDK no agrega valor V1
 *   - Si después queremos features avanzadas (batch, attachments, scheduled),
 *     migramos al SDK · API es compatible
 *
 * Auth: `RESEND_API_KEY` env var. Si no está set, todas las llamadas
 * devuelven `{ ok: false, error: 'mock_no_key' }` y NO hacen HTTP request.
 * Esto permite developar local + en CI sin tocar el dashboard de Resend.
 *
 * Webhook events handled en `/api/webhooks/resend/route.ts`.
 */

const RESEND_API_BASE = "https://api.resend.com";

export type ResendSendInput = {
  from: string;          // "DTD Cargo <noreply@dtdcargo.com>"
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  reply_to?: string | string[];
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
};

export type ResendSendResult =
  | { ok: true; id: string }                  // resend_message_id
  | { ok: false; error: string; code?: string };

/**
 * Envía un email via Resend API.
 *
 * Mock mode: si no hay RESEND_API_KEY, devuelve `{ok: false, error:'mock_no_key'}`
 * sin hacer HTTP request. El caller decide si trata eso como error real o
 * como "ok pero no enviado" (típico: insertar mail_log con status='queued').
 */
export async function resendSend(input: ResendSendInput): Promise<ResendSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "mock_no_key" };
  }

  try {
    const res = await fetch(`${RESEND_API_BASE}/emails`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      let errBody: { message?: string; name?: string } = {};
      try {
        errBody = (await res.json()) as { message?: string; name?: string };
      } catch {
        // body no es JSON · usar status text
      }
      return {
        ok: false,
        error: errBody.message ?? `HTTP ${res.status} ${res.statusText}`,
        code: errBody.name ?? String(res.status),
      };
    }

    const data = (await res.json()) as { id: string };
    if (!data.id) {
      return { ok: false, error: "Resend response sin id" };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `network: ${msg}` };
  }
}

// ─────────────────────────────────────────────────────────────
// Webhook signature verification (Svix-style HMAC)
// ─────────────────────────────────────────────────────────────

/**
 * Resend usa Svix para webhooks. La verificación HMAC es:
 *   - Headers `svix-id`, `svix-timestamp`, `svix-signature`
 *   - Signature = "v1," + base64(HMAC-SHA256(secret_decoded, `${id}.${timestamp}.${body}`))
 *   - El header signature puede contener múltiples versiones separadas por espacio
 *
 * Spec: https://resend.com/docs/dashboard/webhooks/verify-webhooks
 *
 * Devuelve true si la firma matchea Y el timestamp está dentro de 5 minutos
 * (anti-replay). Tolerance es estándar de Svix.
 */
export async function verifyResendWebhookSignature(opts: {
  rawBody: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  secret: string;
}): Promise<boolean> {
  const { rawBody, svixId, svixTimestamp, svixSignature, secret } = opts;

  if (!rawBody || !svixId || !svixTimestamp || !svixSignature || !secret) {
    return false;
  }

  // Anti-replay: timestamp ± 5min
  const tsSec = parseInt(svixTimestamp, 10);
  if (Number.isNaN(tsSec)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  const skewSec = Math.abs(nowSec - tsSec);
  if (skewSec > 5 * 60) return false;

  // Secret viene como "whsec_<base64>". Decode el body base64.
  const secretBase64 = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(secretBase64), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }

  // Mensaje a firmar: `${svixId}.${svixTimestamp}.${rawBody}`
  const message = `${svixId}.${svixTimestamp}.${rawBody}`;
  const enc = new TextEncoder().encode(message);

  // HMAC-SHA256 con WebCrypto
  let signature: ArrayBuffer;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes as unknown as BufferSource,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    signature = await crypto.subtle.sign("HMAC", key, enc);
  } catch {
    return false;
  }

  // Base64 del HMAC
  const sigBytes = new Uint8Array(signature);
  const sigBase64 = btoa(String.fromCharCode(...sigBytes));
  const expectedTag = `v1,${sigBase64}`;

  // svixSignature puede contener múltiples ("v1,xxx v1,yyy") — match cualquiera
  const provided = svixSignature.split(/\s+/);
  return provided.some((p) => p.trim() === expectedTag);
}

// ─────────────────────────────────────────────────────────────
// Resend webhook event types
// ─────────────────────────────────────────────────────────────

export type ResendWebhookEvent = {
  type:
    | "email.sent"
    | "email.delivered"
    | "email.delivery_delayed"
    | "email.complained"
    | "email.bounced"
    | "email.opened"
    | "email.clicked"
    | "email.failed"
    | string;
  created_at: string;
  data: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    [key: string]: unknown;
  };
};

/**
 * Mapea el `type` del webhook al status correspondiente en mail_logs.
 * Algunos events no tienen status equivalente (ej: email.opened es
 * un evento de tracking pero el log status sigue siendo 'delivered').
 */
export function mailLogStatusFromEvent(eventType: string): {
  status?:
    | "sent"
    | "delivered"
    | "bounced"
    | "complained"
    | "opened"
    | "clicked"
    | "failed";
  blacklistReason?: "bounce" | "complaint";
} {
  switch (eventType) {
    case "email.sent":
      return { status: "sent" };
    case "email.delivered":
      return { status: "delivered" };
    case "email.bounced":
      return { status: "bounced", blacklistReason: "bounce" };
    case "email.complained":
      return { status: "complained", blacklistReason: "complaint" };
    case "email.opened":
      return { status: "opened" };
    case "email.clicked":
      return { status: "clicked" };
    case "email.failed":
      return { status: "failed" };
    case "email.delivery_delayed":
    default:
      return {};
  }
}
