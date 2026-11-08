/**
 * `dtd-bot` · filtro de autor y dirección (SDD-0618 §3.4, fila 7.6 de SDD-0582). Puro.
 *
 * Decide qué hace un `message_created` de Chatwoot 4.19.1 con el turno del bot:
 *
 *  - **abre** (o extiende) un turno: solo un mensaje ENTRANTE, NO privado, de un CONTACTO;
 *  - **invalida** el turno abierto: un saliente NO privado de una PERSONA (agente de Chatwoot);
 *  - **ignora** todo lo demás: notas privadas, actividad, plantillas, lo que escribe el propio bot
 *    (o cualquier agente bot) y lo que no se reconoce. Así el eco de un saliente, que también
 *    llega como evento, nunca abre un turno y no hay bucles.
 *
 * Lo que no se reconoce se IGNORA para abrir y no invalida: abrir por error haría hablar al bot;
 * invalidar por error solo le quita una respuesta (y la conversación pasa a la persona igual).
 *
 * El texto del mensaje no cruza este archivo: solo tipo, remitente, ids, fechas y cuántos
 * adjuntos trae (para el pase a humano por formato no admitido).
 *
 * Formas (`app/models/message.rb#webhook_data`): `message_type` llega como texto
 * (`incoming`, `outgoing`, `activity`, `template`), `private` booleano y `sender.type`
 * en minúsculas (`contact`, `user`, `agent_bot`).
 */

export type TipoMensaje = "incoming" | "outgoing" | "activity" | "template" | "desconocido";
export type Remitente = "contact" | "user" | "agent_bot" | "desconocido";

export interface MensajeBot {
  mensajeId: number;
  conversacionId: number;
  inboxId: number | null;
  tipo: TipoMensaje;
  privado: boolean;
  remitente: Remitente;
  /** Id del remitente en Chatwoot (para reconocer al propio bot). */
  remitenteId: number | null;
  /** Cuántos adjuntos trae; el bot solo atiende texto hasta 7.5. */
  adjuntos: number;
  /** Si trae texto (sin leerlo). */
  conTexto: boolean;
  /** ISO; null si no vino. */
  creadoEn: string | null;
}

export type EfectoMensaje = "abre" | "invalida" | "ignora";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const entero = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null);

const TIPOS: ReadonlyMap<unknown, TipoMensaje> = new Map<unknown, TipoMensaje>([
  ["incoming", "incoming"],
  ["outgoing", "outgoing"],
  ["activity", "activity"],
  ["template", "template"],
  // La API de cuenta devuelve el número del enum.
  [0, "incoming"],
  [1, "outgoing"],
  [2, "activity"],
  [3, "template"],
]);

const REMITENTES: ReadonlyMap<unknown, Remitente> = new Map<unknown, Remitente>([
  ["contact", "contact"],
  ["user", "user"],
  ["agent_bot", "agent_bot"],
  // `sender_type` de la API de cuenta.
  ["Contact", "contact"],
  ["User", "user"],
  ["AgentBot", "agent_bot"],
]);

/** Un `message_created` del webhook (o un mensaje de la API de cuenta) → lo mínimo para el bot. */
export function interpretarMensajeBot(raw: unknown): MensajeBot | null {
  const m = obj(raw);
  const conversacion = obj(m?.conversation);
  const mensajeId = entero(m?.id);
  const conversacionId = entero(conversacion?.id) ?? entero(m?.conversation_id);
  if (!m || !mensajeId || !conversacionId) return null;
  const sender = obj(m.sender);
  const remitente = REMITENTES.get(sender?.type) ?? REMITENTES.get(m.sender_type) ?? "desconocido";
  const creado = m.created_at;
  const creadoEn =
    typeof creado === "number" && Number.isFinite(creado) && creado > 0
      ? new Date(creado * 1000).toISOString()
      : typeof creado === "string" && !Number.isNaN(Date.parse(creado))
        ? new Date(creado).toISOString()
        : null;
  return {
    mensajeId,
    conversacionId,
    inboxId: entero(conversacion?.inbox_id) ?? entero(m.inbox_id),
    tipo: TIPOS.get(m.message_type) ?? "desconocido",
    // Solo `true` es privado; lo que no vino se trata como privado para ABRIR (ver efecto).
    privado: m.private === true,
    remitente,
    remitenteId: entero(sender?.id) ?? entero(m.sender_id),
    adjuntos: Array.isArray(m.attachments) ? m.attachments.length : 0,
    conTexto: typeof m.content === "string" && m.content.trim().length > 0,
    creadoEn,
  };
}

/**
 * Qué hace el mensaje con el turno del bot. `botIds`: ids de los agentes bot de DTD en
 * Chatwoot; un mensaje suyo nunca abre ni invalida.
 */
export function efectoDelMensaje(m: MensajeBot, botIds: ReadonlySet<number> = new Set()): EfectoMensaje {
  if (m.remitenteId !== null && botIds.has(m.remitenteId) && m.remitente !== "contact") return "ignora";
  if (m.privado) return "ignora";
  if (m.tipo === "incoming" && m.remitente === "contact") return "abre";
  if (m.tipo === "outgoing" && m.remitente === "user") return "invalida";
  return "ignora";
}

/** El bot solo atiende texto sin adjuntos hasta que 7.5 apruebe un proveedor para lo demás. */
export function formatoAdmitido(m: Pick<MensajeBot, "adjuntos" | "conTexto">): boolean {
  return m.adjuntos === 0 && m.conTexto;
}
