/**
 * SDD-0705 · El aviso al cliente de la Oficina_Virtual (texto de Hermes DIRECTOR, aprobado por Sam el 21/11/2026).
 *
 * Cuando el borrador va a ser la PRIMERA respuesta de DTD Cargo en la conversación, el despachador le agrega el
 * aviso de que lo atiende un asistente virtual y de que una persona revisa cada respuesta. Va en el borrador (no al
 * enviar): así Sam lo ve antes de aprobar, y la huella que el envío compara con lo aprobado sigue siendo la misma.
 *
 * Enmienda v0.2 (Sam, 21/11/2026: «Doble saludo: opción B, el aviso va al final»): el aviso va AL FINAL, como nota.
 * Delante, chocaba con el «¡Hola!» del guion de saludo y el cliente leía dos saludos seguidos. Ahora el borrador abre
 * con el guion y termina con el aviso.
 *
 * «Primera respuesta» = entre los mensajes leídos no hay ninguno del lado de DTD (`rol: "agente"`, que incluye las
 * respuestas de una persona del equipo). Si ya respondió alguien, el aviso no se repite.
 *
 * Límite conocido: el despachador lee los últimos 20 mensajes (`MENSAJES_MAXIMOS`). En una conversación con más de
 * 20 mensajes seguidos del cliente y una respuesta anterior más vieja, el aviso volvería a salir. Es un caso raro y
 * el efecto es inofensivo (un aviso de más, que Sam ve antes de aprobar).
 *
 * Largo: el borrador admite hasta `TEXTO_MAXIMO_BORRADOR` caracteres (check de `office_borradores` en la 0548). El
 * aviso suma `AVISO_CLIENTE.length + 2`. Si el borrador final no cabe, lleve el aviso o no (v0.3, M3), el despachador
 * escala con `borrador_largo` (lo ve una persona) en vez de dejar que la base lo rechace como `fallo_interno`.
 *
 * El aviso NO pasa por `revisarRespuesta`: se agrega después de la revisión, sobre un texto que ya pasó. No trae
 * cifras, fechas, datos personales ni enlaces.
 */
import type { MensajeLeido } from "./chatwoot-lectura";

export const AVISO_CLIENTE =
  "Hola, soy el asistente virtual de DTD Cargo. Una persona del equipo revisa cada respuesta antes de enviártela.";

/** El check de `office_borradores.texto` (0548): `char_length(btrim(texto)) between 1 and 4000`. */
export const TEXTO_MAXIMO_BORRADOR = 4000;

const SEPARADOR = "\n\n";

/** ¿Es la primera respuesta de DTD en esta conversación (ningún mensaje leído del lado de DTD)? */
export function esPrimeraRespuesta(mensajes: readonly MensajeLeido[]): boolean {
  return !mensajes.some((m) => m.rol === "agente");
}

/** El texto del borrador con el aviso al final si es la primera respuesta; si no, tal cual. Nunca lo duplica. */
export function conAvisoAlCliente(texto: string, mensajes: readonly MensajeLeido[]): string {
  if (!esPrimeraRespuesta(mensajes)) return texto;
  if (texto.includes(AVISO_CLIENTE)) return texto;
  return `${texto}${SEPARADOR}${AVISO_CLIENTE}`;
}

/** ¿Cabe en `office_borradores`? Se mide como la base: `char_length(btrim(texto))`. */
export function cabeEnBorrador(texto: string): boolean {
  // `btrim(texto)` sin segundo argumento de PostgreSQL quita SOLO espacios (U+0020), no saltos de línea ni
  // tabuladores; `char_length` cuenta caracteres, no bytes. `String.trim()` quitaría también `\n` y `\t`, y un texto
  // con saltos al final pasaría aquí y la base lo rechazaría (SDD-0705 v0.3, M1).
  return [...texto.replace(/^ +| +$/g, "")].length <= TEXTO_MAXIMO_BORRADOR;
}
