/**
 * SDD-0701 (hijo de SDD-0626) · ¿El CLIENTE mandó un enlace?
 *
 * Hallazgo de la etapa 1 (conversación 6): el cliente mandó un enlace y la Oficina_Virtual contestó normal, porque
 * la regla `enlace` de `eval-automatico.ts` solo mira lo que escribe el AGENTE. Un enlace del cliente puede ser una
 * estafa (un «comprobante» falso, una página para robar la clave, un archivo con virus), así que lo ve una persona.
 * Igual que el dinero (`tema-dinero.ts`): el despachador lo aplica ANTES de llamar al agente, con el motivo-código
 * `cliente:enlace` y prioridad 2, y el texto del cliente no sale hacia el proveedor del modelo.
 *
 * Mira solo los mensajes del CLIENTE, en memoria. Cuenta como enlace:
 *   · todo lo que empieza con un esquema (`http://`, `https://`, `ftp://`, …) o con `www.`;
 *   · un `nombre.tld` sin esquema cuando el TLD está en la lista de abajo (los que se ven en enlaces y estafas).
 * Los dominios propios (`dtdcargo.com`) también cuentan: escribirlos igual es fácil (`dtdcargo.com.otro.io`,
 * `dtdcarg0.com`) y la Oficina_Virtual no tiene que juzgar si es nuestro. Un punto entre dos palabras
 * («ok.gracias», «llegó.mañana») o una cifra («1.500») no es enlace: el TLD no está en la lista.
 */
import type { MensajeLeido } from "./chatwoot-lectura";

/**
 * TLD que cuentan sin esquema. Se dejan fuera los que en español son palabras comunes y saldrían en un punto mal
 * puesto («la», «no», «si», «de», «do», «to», «se», «ya», «al», «es», «am», «pa»). `me` sí queda: `t.me` es
 * Telegram y se usa en estafas.
 */
const TLD = [
  "com", "net", "org", "info", "biz", "io", "co", "me", "ly", "ve", "us", "uk", "cn", "ru", "app", "dev",
  "xyz", "top", "site", "online", "shop", "store", "link", "click", "live", "pro", "club", "vip", "icu", "tk",
  "gl", "gd", "gg", "cc", "ws", "page", "website", "tech", "cloud", "pw", "mx", "ar", "cl", "pe", "ec",
  "cr", "gt", "uy", "py", "bo", "br", "eu", "tv", "fm",
].join("|");

const CON_ESQUEMA = /\b[a-z][a-z0-9+.-]{1,15}:\/\/\S+|\bwww\.\S+/i;
const SIN_ESQUEMA = new RegExp(
  String.raw`(?:^|[^\p{L}\p{N}@._-])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:${TLD})(?![\p{L}\p{N}-])`,
  "iu",
);

export function tieneEnlace(texto: string): boolean {
  const t = texto.normalize("NFC");
  return CON_ESQUEMA.test(t) || SIN_ESQUEMA.test(t);
}

export function clienteMandoEnlace(mensajes: readonly MensajeLeido[]): boolean {
  return mensajes.some((m) => m.rol === "cliente" && tieneEnlace(m.texto));
}
