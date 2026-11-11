import { createHmac } from "node:crypto";

import { sameSecret } from "@/lib/http/secret-compare";

/**
 * Firma de los webhooks de Chatwoot 4.19.1 (SDD-0585, E2-D16).
 *
 * `lib/webhooks/trigger.rb` manda, si el webhook tiene secreto:
 *   X-Chatwoot-Timestamp: <segundos epoch>
 *   X-Chatwoot-Signature: sha256=<hex de HMAC-SHA256(secreto, "<timestamp>.<cuerpo>")>
 *
 * Se compara en tiempo constante (`sameSecret`) y se rechaza un timestamp a más
 * de `VENTANA_FIRMA_S` del reloj, en las dos direcciones (anti-replay: una
 * petición capturada no sirve después de la ventana). El cuerpo es el texto
 * crudo tal como llegó: re-serializar el JSON cambiaría la firma.
 */

export const VENTANA_FIRMA_S = 300;

export type ResultadoFirma = "ok" | "sin_firma" | "vencida" | "invalida";

export function verificarFirmaChatwoot(args: {
  cuerpo: string;
  timestamp: string | null;
  firma: string | null;
  secreto: string;
  ahoraMs?: number;
}): ResultadoFirma {
  const { cuerpo, timestamp, firma, secreto } = args;
  if (!timestamp || !firma) return "sin_firma";
  if (!/^[0-9]{1,12}$/.test(timestamp.trim())) return "invalida";
  const segundos = Number(timestamp.trim());
  const ahora = (args.ahoraMs ?? Date.now()) / 1000;
  if (Math.abs(ahora - segundos) > VENTANA_FIRMA_S) return "vencida";
  const esperada = `sha256=${createHmac("sha256", secreto).update(`${timestamp.trim()}.${cuerpo}`).digest("hex")}`;
  return sameSecret(firma.trim(), esperada) ? "ok" : "invalida";
}
