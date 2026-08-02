/**
 * Token sellado genérico (AES-256-GCM) — cifrado + autenticado, sin DB.
 *
 * SOLO SERVIDOR. Usa `node:crypto`; no lo importes desde un componente cliente
 * (`lib/shared/` es el puente público↔ERP y sí tiene módulos que viajan al
 * browser — este no).
 *
 * Por qué existe: el token de baja de marketing (SDD-0082) ya resolvía esto
 * bien, pero la cripto vivía dentro de `lib/studio/mail/`, que el sitio público
 * NO puede importar (frontera ESLint). El gate de `/marca` (SDD-0238) necesita
 * exactamente el mismo sellado para su cookie, así que el mecanismo se extrajo
 * acá y el helper de mail pasó a consumirlo. Una sola implementación de cripto
 * en el repo, no dos.
 *
 * El formato es idéntico al que ya emitía `signUnsubscribeToken`
 * (`<version>.<iv>.<ciphertext>.<tag>`, base64url, clave = sha256(secreto)) para
 * no invalidar los tokens que ya viajaron en correos enviados.
 *
 * `version` y `aad` son parte del contrato criptográfico: un token sellado para
 * un propósito NO se puede abrir con el de otro, aunque compartan el secreto.
 * Eso impide que una cookie de `/marca` valga como link de baja, y viceversa.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type SealOptions = {
  /** Prefijo del token. Distingue formatos y permite migrar sin romper. */
  version: string;
  /** Additional Authenticated Data — el "para qué" del token. */
  aad: string;
};

function key(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

/** Sella un objeto JSON. El resultado es opaco: no se lee sin el secreto. */
export function sealToken(
  payload: unknown,
  secret: string,
  { version, aad }: SealOptions,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(payload), "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    version,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

/**
 * Abre un token sellado. Devuelve `null` ante CUALQUIER problema — token nulo,
 * versión distinta, firma que no calza, JSON corrupto. Nunca lanza: el llamador
 * trata `null` como "no autenticado" y no tiene que envolver en try/catch.
 */
export function openToken<T = unknown>(
  token: string | null | undefined,
  secret: string,
  { version, aad }: SealOptions,
): T | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== version) return null;

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(secret),
      Buffer.from(parts[1], "base64url"),
    );
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(Buffer.from(parts[3], "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(parts[2], "base64url")),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString("utf8")) as T;
  } catch {
    return null;
  }
}
