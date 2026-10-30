/**
 * Interpretación de los eventos de Chatwoot 4.19.1 (SDD-0585, E2-D17). Pura.
 *
 * El payload trae el texto del mensaje, el nombre, el correo y el teléfono del
 * contacto. De acá sale SOLO lo que Studio necesita: ids, estado, no leídos,
 * asignado, bandeja, fechas y los últimos 10 dígitos del teléfono (para cruzar
 * con `clients.phone_last10`, sin guardarlo). Para E10 (SDD-0586) también
 * las etiquetas, el equipo y, solo si no hay teléfono, el BSUID
 * (`contact_inbox.source_id`). Nada más cruza este archivo.
 *
 * Formas (`app/models/message.rb#webhook_data`,
 * `app/presenters/conversations/event_data_presenter.rb#webhook_data`):
 *   - message_created: { event, id, message_type, private, account: {id},
 *     conversation: <conversación> }
 *   - conversation_status_changed: <conversación> + { event, changed_attributes }
 *   - <conversación>: { id (display_id), inbox_id, status, unread_count,
 *     meta: { sender: { phone_number }, assignee: { id } }, last_activity_at
 *     (epoch s), updated_at (epoch s con decimales), account: {id} }
 */

export type EstadoConversacion = "open" | "resolved" | "pending" | "snoozed";

export interface ConversacionChatwoot {
  id: number;
  inboxId: number | null;
  estado: EstadoConversacion;
  noLeidos: number;
  asignadoId: number | null;
  /** ISO, o null si no vino. */
  ultimaActividad: string | null;
  /** `updated_at` de Chatwoot: ordena los eventos (uno más viejo no pisa). */
  fuenteActualizada: number;
  /** Últimos 10 dígitos del teléfono del contacto, o null. No se guarda. */
  telefonoUltimos10: string | null;
  /**
   * E10 (10.3): BSUID del usuario de WhatsApp SIN teléfono (`contact_inbox.source_id`
   * cuando el contacto no trae `phone_number` y el id no es solo dígitos). Solo
   * viene si no hay teléfono. Que Chatwoot 4.19.1 lo ponga ahí es NV (10.6).
   */
  bsuid?: string;
  /** E10: etiquetas de la conversación (`labels`), si vinieron. */
  etiquetas?: string[];
  /** E10: equipo asignado (`meta.team.id`); null = sin equipo; ausente = no vino. */
  equipoId?: number | null;
}

export interface EventoChatwoot {
  evento: "message_created" | "conversation_status_changed";
  /** Clave de idempotencia (E2-D18). */
  clave: string;
  accountId: number;
  /** Id del mensaje (message_created): lo guarda el evento para reprocesar sin el payload. */
  mensajeId: number | null;
  conversacion: ConversacionChatwoot;
  /** Mensaje entrante y no privado: merece aviso push (E2-D20). */
  avisar: boolean;
}

const ESTADOS: ReadonlySet<string> = new Set(["open", "resolved", "pending", "snoozed"]);

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const entero = (v: unknown): number | null =>
  typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Últimos 10 dígitos, como `clients.phone_last10` (0383): menos de 10 → null. */
export function ultimos10(telefono: unknown): string | null {
  if (typeof telefono !== "string") return null;
  const digitos = telefono.replace(/[^0-9]/g, "");
  return digitos.length >= 10 ? digitos.slice(-10) : null;
}

/** Una conversación de Chatwoot (webhook o API de cuenta) → lo mínimo para Studio. */
export function interpretarConversacion(raw: unknown): ConversacionChatwoot | null {
  const c = obj(raw);
  const id = entero(c?.id);
  const estado = typeof c?.status === "string" && ESTADOS.has(c.status) ? (c.status as EstadoConversacion) : null;
  if (!c || !id || !estado) return null;
  const meta = obj(c.meta);
  const actividad = numero(c.last_activity_at);
  const noLeidos = numero(c.unread_count);
  const telefono = ultimos10(obj(meta?.sender)?.phone_number);
  const bsuid = telefono ? null : bsuidDe(obj(c.contact_inbox)?.source_id);
  const etiquetas = Array.isArray(c.labels) ? c.labels.filter((l): l is string => typeof l === "string") : undefined;
  return {
    id,
    inboxId: entero(c.inbox_id),
    estado,
    noLeidos: noLeidos !== null && noLeidos > 0 ? Math.floor(noLeidos) : 0,
    asignadoId: entero(obj(meta?.assignee)?.id),
    ultimaActividad: actividad && actividad > 0 ? new Date(actividad * 1000).toISOString() : null,
    fuenteActualizada: numero(c.updated_at) ?? actividad ?? 0,
    telefonoUltimos10: telefono,
    ...(bsuid ? { bsuid } : {}),
    ...(etiquetas ? { etiquetas } : {}),
    ...(meta && "team" in meta ? { equipoId: entero(obj(meta.team)?.id) } : {}),
  };
}

/**
 * Un BSUID aceptable: la misma forma que exige `chatwoot_contactos_bsuid` (0505).
 * Solo dígitos sería un teléfono (wa_id) y no se toma.
 */
export function bsuidDe(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^[A-Za-z0-9._:-]{1,128}$/.test(s) && !/^[0-9]+$/.test(s) ? s : null;
}

export function interpretarEvento(payload: unknown): EventoChatwoot | null {
  const p = obj(payload);
  if (!p) return null;

  if (p.event === "message_created") {
    const mensajeId = entero(p.id);
    const conversacion = interpretarConversacion(p.conversation);
    const accountId = entero(obj(p.account)?.id) ?? entero(obj(obj(p.conversation)?.account)?.id);
    if (!mensajeId || !conversacion || !accountId) return null;
    return {
      evento: "message_created",
      clave: `message_created:${mensajeId}`,
      accountId,
      mensajeId,
      conversacion,
      avisar: p.message_type === "incoming" && p.private !== true,
    };
  }

  if (p.event === "conversation_status_changed") {
    const conversacion = interpretarConversacion(p);
    const accountId = entero(obj(p.account)?.id);
    if (!conversacion || !accountId) return null;
    return {
      evento: "conversation_status_changed",
      clave: `conversation_status_changed:${conversacion.id}:${conversacion.estado}:${conversacion.fuenteActualizada}`,
      accountId,
      mensajeId: null,
      conversacion,
      avisar: false,
    };
  }

  return null;
}
