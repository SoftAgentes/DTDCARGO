/**
 * Token firmado de baja de marketing (SDD-0082 · SDD-0062 Slice D).
 *
 * Un link de unsubscribe NO debe expirar y NO requiere sesión: lo abre cualquiera
 * desde su correo. Por eso es un token HMAC autocontenido (payload + firma), NO un
 * registro en DB ni un RPC anon. La firma evita que alguien dé de baja a otro
 * (necesita el secreto del server para forjar un token válido).
 *
 * `sign`/`verify` son PUROS (reciben el secreto) → testeables sin env. El secreto
 * real lo resuelve el route handler (`unsubscribeSecret()`), con fallback al
 * service-role key para NO introducir un gate nuevo (el secreto nunca se expone:
 * HMAC es de una vía).
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type UnsubscribeAudience = "marketing" | "newsletter";

export type UnsubscribePayload = {
  email: string;
  tenantId: string;
  /** Default histórico: marketing de clientes. */
  audience?: UnsubscribeAudience;
};

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function hmac(data: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

/** Firma un token `<payload-b64url>.<sig-b64url>`. Email canónico (lower) por estabilidad. */
export function signUnsubscribeToken(
  payload: UnsubscribePayload,
  secret: string,
): string {
  const body = b64url(
    Buffer.from(
      JSON.stringify({
        e: payload.email.trim().toLowerCase(),
        t: payload.tenantId,
        a: payload.audience ?? "marketing",
      }),
    ),
  );
  const sig = b64url(hmac(body, secret));
  return `${body}.${sig}`;
}

/**
 * Verifica un token y devuelve el payload, o `null` si la firma no calza / está mal
 * formado. Comparación en tiempo constante (anti timing attack).
 */
export function verifyUnsubscribeToken(
  token: string | null | undefined,
  secret: string,
): UnsubscribePayload | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = b64url(hmac(body, secret));
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const email = typeof parsed?.e === "string" ? parsed.e : "";
    const tenantId = typeof parsed?.t === "string" ? parsed.t : "";
    const audience =
      parsed?.a === "newsletter" || parsed?.a === "marketing"
        ? parsed.a
        : "marketing";
    if (!email || !tenantId) return null;
    return { email, tenantId, audience };
  } catch {
    return null;
  }
}

/**
 * Secreto del server para firmar/verificar (NUNCA al cliente). Dedicado si existe,
 * sino el service-role key (ya presente en prod → sin gate nuevo). `null` si no hay
 * ninguno (el route responde error claro; no se manda marketing sin esto igual).
 */
export function unsubscribeSecret(): string | null {
  return (
    process.env.EMAIL_UNSUBSCRIBE_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    null
  );
}
