/**
 * SDD-0608 · Verificación de la firma Ed25519 de Discord.
 *
 * Discord firma cada petición a la «URL de interacciones» con la llave privada
 * de la aplicación: `X-Signature-Ed25519` = firma de `timestamp + cuerpo crudo`,
 * `X-Signature-Timestamp` = el timestamp. Se verifica con la llave PÚBLICA de
 * la aplicación (64 caracteres hex, en el portal de Discord), que vive en la
 * variable `DISCORD_CONSULTA_PUBLIC_KEY` del servidor, nunca en el repo.
 *
 * Discord exige rechazar con 401 una firma inválida: al guardar la URL manda
 * pedidos con firma mala y, si la ruta los acepta, no la guarda.
 *
 * Además de la firma se exige que el timestamp esté a menos de 5 minutos del
 * reloj del servidor, para que un pedido capturado no se pueda repetir más
 * tarde.
 *
 * Fail-closed: cualquier dato ausente o con otra forma devuelve false.
 */

import { createPublicKey, verify } from "node:crypto";

/** Prefijo DER (SubjectPublicKeyInfo) de una llave Ed25519 cruda de 32 bytes. */
const SPKI_ED25519 = Buffer.from("302a300506032b6570032100", "hex");

export const DESFASE_MAXIMO_S = 300;

const HEX_LLAVE = /^[0-9a-f]{64}$/i;
const HEX_FIRMA = /^[0-9a-f]{128}$/i;
const TIMESTAMP = /^[0-9]{1,12}$/;

export interface FirmaDiscord {
  clavePublicaHex: string | null | undefined;
  firmaHex: string | null | undefined;
  timestamp: string | null | undefined;
  /** Los bytes del cuerpo TAL CUAL llegaron. */
  cuerpo: Uint8Array;
  /** Reloj inyectable para pruebas. */
  ahoraMs?: number;
}

export function verificarFirmaDiscord(f: FirmaDiscord): boolean {
  const clave = f.clavePublicaHex?.trim() ?? "";
  if (!HEX_LLAVE.test(clave)) return false;
  if (!f.firmaHex || !HEX_FIRMA.test(f.firmaHex)) return false;
  if (!f.timestamp || !TIMESTAMP.test(f.timestamp)) return false;

  const ahoraS = Math.floor((f.ahoraMs ?? Date.now()) / 1000);
  if (Math.abs(ahoraS - Number(f.timestamp)) > DESFASE_MAXIMO_S) return false;

  try {
    const llave = createPublicKey({
      key: Buffer.concat([SPKI_ED25519, Buffer.from(clave, "hex")]),
      format: "der",
      type: "spki",
    });
    const mensaje = Buffer.concat([Buffer.from(f.timestamp, "utf8"), Buffer.from(f.cuerpo)]);
    return verify(null, mensaje, llave, Buffer.from(f.firmaHex, "hex"));
  } catch {
    return false;
  }
}
