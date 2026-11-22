/**
 * Token del link de registro al portal (SDD-0646). Sólo servidor: usa
 * `node:crypto`. Lo puro (textos, tipos, URL) está en `registro-link-types.ts`.
 *
 * El token son 32 bytes aleatorios (256 bits) en base64url; la base guarda SOLO
 * su sha256, así que quien lea la tabla no puede armar el link.
 */

import { createHash, randomBytes } from "node:crypto";

/** Bytes aleatorios del token: 32 = 256 bits (el mínimo pedido es 128). */
export const REGISTRO_LINK_TOKEN_BYTES = 32;

export function generateRegistroToken(): string {
  return randomBytes(REGISTRO_LINK_TOKEN_BYTES).toString("base64url");
}

/** sha256 hex del token: lo único que se guarda y lo único que se compara. */
export function hashRegistroToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
