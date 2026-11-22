/**
 * SDD-0705 · El aviso al cliente de la Oficina_Virtual (texto de Hermes DIRECTOR, aprobado por Sam el 21/11/2026).
 *
 * Cuando el borrador va a ser la PRIMERA respuesta de DTD Cargo en la conversación, el despachador le antepone el
 * aviso de que lo atiende un asistente virtual y de que una persona revisa cada respuesta. Va en el borrador (no al
 * enviar): así Sam lo ve antes de aprobar, y la huella que el envío compara con lo aprobado sigue siendo la misma.
 *
 * «Primera respuesta» = entre los mensajes leídos no hay ninguno del lado de DTD (`rol: "agente"`, que incluye las
 * respuestas de una persona del equipo). Si ya respondió alguien, el aviso no se repite.
 *
 * Límite conocido: el despachador lee los últimos 20 mensajes (`MENSAJES_MAXIMOS`). En una conversación con más de
 * 20 mensajes seguidos del cliente y una respuesta anterior más vieja, el aviso volvería a salir. Es un caso raro y
 * el efecto es inofensivo (un aviso de más, que Sam ve antes de aprobar).
 *
 * El aviso NO pasa por `revisarRespuesta`: se agrega después de la revisión, sobre un texto que ya pasó. No trae
 * cifras, fechas, datos personales ni enlaces.
 */
import type { MensajeLeido } from "./chatwoot-lectura";

export const AVISO_CLIENTE =
  "Hola, soy el asistente virtual de DTD Cargo. Una persona del equipo revisa cada respuesta antes de enviártela.";

/** ¿Es la primera respuesta de DTD en esta conversación (ningún mensaje leído del lado de DTD)? */
export function esPrimeraRespuesta(mensajes: readonly MensajeLeido[]): boolean {
  return !mensajes.some((m) => m.rol === "agente");
}

/** El texto del borrador con el aviso delante si es la primera respuesta; si no, tal cual. Nunca lo duplica. */
export function conAvisoAlCliente(texto: string, mensajes: readonly MensajeLeido[]): string {
  if (!esPrimeraRespuesta(mensajes)) return texto;
  if (texto.startsWith(AVISO_CLIENTE)) return texto;
  return `${AVISO_CLIENTE}\n\n${texto}`;
}
