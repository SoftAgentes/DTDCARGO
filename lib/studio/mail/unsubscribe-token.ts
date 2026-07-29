/**
 * Token opaco de baja de marketing (SDD-0082 · SDD-0062 Slice D).
 *
 * Un link de unsubscribe NO debe expirar y NO requiere sesión: lo abre cualquiera
 * desde su correo. El formato vigente cifra y autentica el payload con AES-GCM,
 * sin registro en DB ni RPC anon. La verificación también acepta el formato HMAC
 * histórico para no romper correos ya enviados.
 *
 * `sign`/`verify` son PUROS (reciben el secreto) → testeables sin env. El secreto
 * real lo resuelve el route handler (`unsubscribeSecret()`), con fallback al
 * service-role key para NO introducir un gate nuevo. El secreto nunca se expone.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

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

const TOKEN_VERSION = "v2";
const TOKEN_AAD = Buffer.from("dtd-unsubscribe-v2", "utf8");

function tokenKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function encodePayload(payload: UnsubscribePayload): Buffer {
  return Buffer.from(
    JSON.stringify({
      e: payload.email.trim().toLowerCase(),
      t: payload.tenantId,
      a: payload.audience ?? "marketing",
    }),
    "utf8",
  );
}

function decodePayload(value: Buffer): UnsubscribePayload | null {
  try {
    const parsed = JSON.parse(value.toString("utf8"));
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
 * Huella corta e irreversible para correlacionar emisión y recepción sin
 * registrar el token, el correo ni el tenant. No sirve para verificar la firma.
 */
export function unsubscribeTokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

/**
 * Cifra y autentica un token opaco `v2.<iv>.<ciphertext>.<tag>`.
 *
 * El payload ya no queda legible en la ruta ni en los access logs. La función de
 * verificación conserva compatibilidad con los tokens HMAC históricos.
 */
export function signUnsubscribeToken(
  payload: UnsubscribePayload,
  secret: string,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(secret), iv);
  cipher.setAAD(TOKEN_AAD);
  const ciphertext = Buffer.concat([
    cipher.update(encodePayload(payload)),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [TOKEN_VERSION, b64url(iv), b64url(ciphertext), b64url(tag)].join(".");
}

/**
 * Verifica un token y devuelve el payload, o `null` si la autenticación no calza
 * o está mal formado. El fallback HMAC compara en tiempo constante.
 */
export function verifyUnsubscribeToken(
  token: string | null | undefined,
  secret: string,
): UnsubscribePayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");

  if (parts.length === 4 && parts[0] === TOKEN_VERSION) {
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        tokenKey(secret),
        Buffer.from(parts[1], "base64url"),
      );
      decipher.setAAD(TOKEN_AAD);
      decipher.setAuthTag(Buffer.from(parts[3], "base64url"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(parts[2], "base64url")),
        decipher.final(),
      ]);
      return decodePayload(plaintext);
    } catch {
      return null;
    }
  }

  // Compatibilidad con correos ya enviados: `<payload-b64url>.<hmac-b64url>`.
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = b64url(hmac(body, secret));
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return decodePayload(Buffer.from(body, "base64url"));
}

/** URL de baja con token opaco en la ruta, resistente a clientes que quitan queries. */
export function buildUnsubscribeUrl(siteUrl: string, token: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}/api/email/unsubscribe/${encodeURIComponent(token)}`;
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
