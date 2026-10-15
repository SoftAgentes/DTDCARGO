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
 *
 * SDD-0238: el sellado AES-GCM se mudó a `lib/shared/signed-token.ts` porque el
 * gate de `/marca` necesitaba el mismo mecanismo y el sitio público no puede
 * importar `lib/studio/*` (frontera ESLint). Acá quedó SOLO lo propio del
 * dominio: la forma del payload y el fallback HMAC histórico. El formato del
 * token no cambió ni un byte — los links ya enviados siguen abriendo.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { firstConfiguredSecret } from "@/lib/runtime/server-secret";
import { openToken, sealToken, type SealOptions } from "@/lib/shared/signed-token";

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

/**
 * Contrato criptográfico del token de baja. Los valores NO se pueden cambiar:
 * cualquier correo ya enviado trae un token sellado con estos, y un link de
 * unsubscribe no expira nunca.
 */
const SEAL: SealOptions = { version: TOKEN_VERSION, aad: "dtd-unsubscribe-v2" };

/** Forma compacta que viaja dentro del token (claves de una letra: el token va en la URL). */
type WirePayload = { e: string; t: string; a: string };

function toWire(payload: UnsubscribePayload): WirePayload {
  return {
    e: payload.email.trim().toLowerCase(),
    t: payload.tenantId,
    a: payload.audience ?? "marketing",
  };
}

function fromWire(parsed: unknown): UnsubscribePayload | null {
  if (parsed == null || typeof parsed !== "object") return null;
  const raw = parsed as Partial<WirePayload>;
  const email = typeof raw.e === "string" ? raw.e : "";
  const tenantId = typeof raw.t === "string" ? raw.t : "";
  const audience: UnsubscribeAudience =
    raw.a === "newsletter" || raw.a === "marketing" ? raw.a : "marketing";
  if (!email || !tenantId) return null;
  return { email, tenantId, audience };
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
  return sealToken(toWire(payload), secret, SEAL);
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
    return fromWire(openToken<WirePayload>(token, secret, SEAL));
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

  try {
    return fromWire(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
  } catch {
    return null;
  }
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
 *
 * SDD-0523: una variable vacía o con sólo espacios cuenta como ausente. Con `??`,
 * una `EMAIL_UNSUBSCRIBE_SECRET=` vacía no caía al service role: el `!secret` de
 * los llamadores la descartaba, toda baja daba error y no se enviaba Actualidad.
 * Con sólo espacios, `"  "` se usaba como clave y los tokens se podían falsificar.
 */
export function unsubscribeSecret(): string | null {
  return firstConfiguredSecret(
    process.env.EMAIL_UNSUBSCRIBE_SECRET,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** De dónde sale `unsubscribeSecret()`, para el log. No dice nada del valor. */
export function unsubscribeSecretSource(): "dedicated" | "service_role" | null {
  if (firstConfiguredSecret(process.env.EMAIL_UNSUBSCRIBE_SECRET)) return "dedicated";
  if (firstConfiguredSecret(process.env.SUPABASE_SERVICE_ROLE_KEY)) return "service_role";
  return null;
}
