/**
 * "Guárdalo en mi WhatsApp" — mensaje del cliente recién registrado (SDD-0254).
 *
 * ── Por qué existe ─────────────────────────────────────────────────────────
 * Si el correo de bienvenida rebota, el cliente se queda **sin su Shipping Mark
 * y sin puerta**: la clave que le crea el registro es aleatoria, así que la
 * única forma de entrar es un enlace al correo. Medido dos veces —DTD-9048 el
 * 2026-08-06 y DTD-1010 el 2026-06-07— y en los dos casos nadie se enteró hasta
 * mucho después.
 *
 * La pantalla SÍ le muestra el código, pero lo ve una vez y no le queda en
 * ningún lado suyo. Esto se lo pone en su propio historial de WhatsApp, que es
 * donde un cliente venezolano busca las cosas.
 *
 * ⚠️ **No es un envío automático** — no existe API de WhatsApp en el proyecto.
 * Es un `wa.me` que abre el chat con el mensaje escrito; el cliente aprieta
 * enviar desde su teléfono.
 *
 * ── Qué viaja, y qué NO ────────────────────────────────────────────────────
 * Sólo **nombre de pila + Shipping Mark**. Nunca correo, teléfono, cédula/RIF ni
 * dirección: el texto va en el query string de `wa.me`, así que lo mínimo es la
 * regla, no una preferencia. Hay un test que lo vigila.
 */

/**
 * Arma el mensaje que el cliente le manda a DTD con su Shipping Mark.
 *
 * Puro y sin dependencias, para que el test pueda vigilar el copy: tuteo
 * venezolano, cero voseo, y nada de datos de más.
 *
 * @param markbox   Shipping Mark recién emitido (`DTD-NNNN`).
 * @param firstName nombre de pila, opcional — sin él el saludo va genérico en
 *                  vez de quedar un "Hola, soy ." colgando.
 */
export function buildMarkboxWhatsAppMessage(
  markbox: string,
  firstName?: string | null,
): string {
  const nombre = (firstName ?? "").trim();
  const saludo = nombre ? `Hola, soy ${nombre}.` : "Hola.";
  return `${saludo} Acabo de registrarme en DTD Cargo y mi Shipping Mark es ${markbox.trim()}.`;
}
