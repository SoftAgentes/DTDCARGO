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
 *   · todo lo que empieza con un esquema (`http://`, `https://`, `ftp://`, `hxxp://`, …) o con `www.`;
 *   · un `nombre.tld/ruta` sin esquema, con CUALQUIER TLD de letras (`youtu.be/x`, `amzn.to/x`, `algo.es/x`):
 *     la barra después del TLD ya dice que es una dirección;
 *   · un `nombre.tld` sin esquema ni ruta cuando el TLD está en la lista de abajo y va todo en minúsculas o todo
 *     en mayúsculas (`bit.ly`, `PAGOS.COM`). «Hola.Com permiso» o «Dpto.Info» (TLD con mayúscula inicial) no
 *     cuentan: es un punto sin espacio antes de la palabra siguiente.
 * Los dominios propios (`dtdcargo.com`) también cuentan: escribirlos igual es fácil (`dtdcargo.com.otro.io`,
 * `dtdcarg0.com`) y la Oficina_Virtual no tiene que juzgar si es nuestro. Un punto entre dos palabras
 * («ok.gracias», «llegó.mañana») o una cifra («1.500») no es enlace: el TLD no está en la lista.
 */
import type { MensajeLeido } from "./chatwoot-lectura";

/**
 * TLD que cuentan sin esquema NI ruta. Con ruta cuenta cualquiera. Se dejan fuera los que en español son palabras comunes y saldrían en un punto mal
 * puesto («la», «no», «si», «de», «do», «to», «se», «ya», «al», «es», «am», «pa»). `me` sí queda: `t.me` es
 * Telegram y se usa en estafas.
 */
const TLD = [
  "com", "net", "org", "info", "biz", "io", "co", "me", "ly", "ve", "us", "uk", "cn", "ru", "app", "dev",
  "xyz", "top", "site", "online", "shop", "store", "link", "click", "live", "pro", "club", "vip", "icu", "tk",
  "gl", "gd", "gg", "cc", "ws", "page", "website", "tech", "cloud", "pw", "mx", "ar", "cl", "pe", "ec",
  "cr", "gt", "uy", "py", "bo", "br", "eu", "tv", "fm", "be", "ee", "id", "ml", "ga", "cf", "gq",
];

const CON_ESQUEMA = /\b[a-z][a-z0-9+.-]{1,15}:\/\/\S+|\bwww\.\S+/i;
const ETIQUETAS = String.raw`(?:^|[^\p{L}\p{N}@._-])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+`;
/** Con ruta: cualquier TLD de letras, en cualquier caja. */
const CON_RUTA = new RegExp(String.raw`${ETIQUETAS}[A-Za-z]{2,24}\/`, "u");
/** Sin ruta: solo la lista, todo en minúsculas o todo en mayúsculas. */
const SIN_RUTA = new RegExp(
  String.raw`${ETIQUETAS}(?:${TLD.join("|")}|${TLD.map((t) => t.toUpperCase()).join("|")})(?![\p{L}\p{N}-])`,
  "u",
);

export function tieneEnlace(texto: string): boolean {
  const t = texto.normalize("NFC");
  return CON_ESQUEMA.test(t) || CON_RUTA.test(t) || SIN_RUTA.test(t);
}

export function clienteMandoEnlace(mensajes: readonly MensajeLeido[]): boolean {
  return mensajes.some((m) => m.rol === "cliente" && tieneEnlace(m.texto));
}
