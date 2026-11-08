import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { notifyClientReplyPush } from "@/lib/studio/conversation-reply-push";
import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";
import { chatwootPortalConfig, type ChatwootPortalConfig } from "./config";
import { buscarMensajePorSourceId, crearNotaPrivada, leerMensaje } from "./router-api";
import type { ContextoChatwoot, ManejadorEvento } from "./webhook-procesar";

/**
 * La vuelta, de Chatwoot al portal (SDD-0586, paso 10.5, PR 1b: E10-D37 y E10-D38).
 *
 * `responderAlPortal` corre con cada `message_created` del webhook y del reproceso. Solo toma
 * la respuesta del equipo en la bandeja «Conversaciones del portal»: saliente, no privada, ni de
 * actividad ni plantilla, de texto y que no sea el eco de un mensaje nuestro (`source_id` que
 * empieza con `dtd:`). La escribe `chatwoot_portal_respuesta` (0520) en el hilo del cliente, una
 * sola vez por `chatwoot:<id>`, con la hora de Chatwoot y el autor del vínculo del agente.
 *
 *   - Insertó → el push de hoy al cliente (`notifyClientReplyPush`), una sola vez: un reintento
 *     da «duplicado» y no avisa.
 *   - Hilo archivado en Studio → no escribe ni avisa, y deja en Chatwoot una nota privada, una
 *     vez por mensaje (§10.5.10, «Hilos archivados»).
 *   - Con un adjunto → al portal llega el texto, si lo hay, y queda una nota privada, una vez
 *     por mensaje: el chat del portal solo lleva texto (E10-D38).
 *
 * El texto lo lee solo este manejador: del webhook, lo que la ruta le pasa en
 * `ctx.salientePortal`, solo para esa bandeja; en el reproceso, que no lo guardó, lo relee de
 * Chatwoot con el token del servicio. Cada nota lleva su `source_id` (`dtd:nota:<motivo>:<id>`)
 * y se busca antes de crearla, así que un reintento no la repite. Un fallo de Chatwoot o de la
 * base lanza: el evento queda «fallido» y se reintenta (0504). En los logs, solo códigos.
 *
 * Con el flag `chatwoot_portal` apagado o sin `chatwootPortalConfig()`, no hace nada.
 */

export type TipoMensaje = "incoming" | "outgoing" | "activity" | "template";

/** Lo que la vuelta necesita de un mensaje de Chatwoot, del webhook o de la API de cuenta. */
export interface MensajePortal {
  id: number;
  conversacionId: number | null;
  inboxId: number | null;
  tipo: TipoMensaje | null;
  privado: boolean;
  sourceId: string | null;
  /** El texto tal como vino; "" si no hay. */
  texto: string;
  tipoContenido: string | null;
  adjuntos: number;
  /** ISO, o null si no vino. */
  creado: string | null;
  /** El usuario de Chatwoot que lo escribió. Null si fue un bot, un contacto, el sistema o no se sabe. */
  agenteId: number | null;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const entero = (v: unknown): number | null =>
  typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 2_147_483_647 ? v : null;

/** `message_type`: el webhook lo da como texto y la API de cuenta como número (enum de `Message`). */
const TIPOS: readonly TipoMensaje[] = ["incoming", "outgoing", "activity", "template"];
function tipoDe(v: unknown): TipoMensaje | null {
  if (typeof v === "string") return (TIPOS as readonly string[]).includes(v) ? (v as TipoMensaje) : null;
  if (typeof v === "number" && Number.isInteger(v)) return TIPOS[v] ?? null;
  return null;
}

/** `created_at`: ISO en el webhook, segundos Unix en la API de cuenta. */
function fechaDe(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return new Date(v * 1000).toISOString();
  if (typeof v === "string") {
    const ms = Date.parse(v);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }
  return null;
}

/**
 * El agente: solo un usuario (`type: "user"` en el remitente, o `sender_type: "User"` en la API
 * de cuenta). Un bot tiene otra secuencia de ids y un contacto no es del equipo: nunca firman.
 */
function agenteDe(m: Obj): number | null {
  const remitente = obj(m.sender);
  const tipo = typeof remitente?.type === "string" ? remitente.type.toLowerCase() : null;
  const esUsuario = tipo === "user" || (tipo === null && m.sender_type === "User");
  if (!esUsuario) return null;
  return entero(remitente?.id) ?? (m.sender_type === "User" ? entero(m.sender_id) : null);
}

/** Un mensaje de Chatwoot (carga del webhook o fila de la API de cuenta) → lo mínimo para la vuelta. */
export function interpretarMensajePortal(raw: unknown): MensajePortal | null {
  const m = obj(raw);
  const id = entero(m?.id);
  if (!m || !id) return null;
  const conversacion = obj(m.conversation);
  return {
    id,
    conversacionId: entero(m.conversation_id) ?? entero(conversacion?.id),
    inboxId: entero(m.inbox_id) ?? entero(obj(m.inbox)?.id) ?? entero(conversacion?.inbox_id),
    tipo: tipoDe(m.message_type),
    privado: m.private === true,
    sourceId: typeof m.source_id === "string" && m.source_id !== "" ? m.source_id : null,
    texto: typeof m.content === "string" ? m.content : "",
    tipoContenido: typeof m.content_type === "string" ? m.content_type : null,
    adjuntos: Array.isArray(m.attachments) ? m.attachments.length : 0,
    creado: fechaDe(m.created_at),
    agenteId: agenteDe(m),
  };
}

/**
 * Lo que la ruta del webhook le pasa a la vuelta (`ctx.salientePortal`). El texto se lee solo si
 * el mensaje es de la bandeja del portal y saliente; si no, `null`: la ruta ya miró y no hay nada
 * que hacer (así el manejador no relee de Chatwoot cada entrante).
 */
export function salientePortalDelPayload(payload: unknown, inboxPortalId: number): MensajePortal | null {
  const p = obj(payload);
  if (!p || p.event !== "message_created") return null;
  const inbox = entero(obj(p.inbox)?.id) ?? entero(obj(p.conversation)?.inbox_id);
  if (inbox !== inboxPortalId || tipoDe(p.message_type) !== "outgoing") return null;
  return interpretarMensajePortal(p);
}

/** La respuesta del equipo que va al portal (E10-D37). */
export function esRespuestaDelEquipo(m: MensajePortal, inboxPortalId: number): boolean {
  return (
    m.tipo === "outgoing" &&
    !m.privado &&
    !(m.sourceId ?? "").startsWith("dtd:") &&
    (m.inboxId === null || m.inboxId === inboxPortalId) &&
    (m.tipoContenido === null || m.tipoContenido === "text")
  );
}

export const NOTA_ARCHIVADO =
  "Este hilo está archivado en el Studio: el cliente no ve esta respuesta. Si tiene otra conversación del portal abierta, escríbele allí; si no, por WhatsApp o por correo.";
export const NOTA_ADJUNTO =
  "Este archivo no le llegó al cliente: el chat del portal solo lleva texto. Mándalo por WhatsApp o por correo.";

type MotivoNota = "archivado" | "adjunto";
const sourceIdNota = (motivo: MotivoNota, mensajeId: number) => `dtd:nota:${motivo}:${mensajeId}`;

export type ResultadoRespuesta = "insertado" | "duplicado" | "archivado" | "sin_texto" | "ficha_borrada" | "sin_hilo" | "apagado";

/** La nota privada, una sola vez por mensaje: se busca su `source_id` antes de crearla. */
async function dejarNota(cfg: ChatwootPortalConfig, conversacionId: number, m: MensajePortal, motivo: MotivoNota): Promise<void> {
  const sourceId = sourceIdNota(motivo, m.id);
  const desde = m.creado ? new Date(m.creado) : new Date();
  const b = await buscarMensajePorSourceId(cfg, conversacionId, sourceId, desde);
  if (!b.ok) throw new Error(`nota_buscar_${b.error}`);
  if (b.data !== null) return;
  const n = await crearNotaPrivada(cfg, conversacionId, { texto: motivo === "archivado" ? NOTA_ARCHIVADO : NOTA_ADJUNTO, sourceId });
  if (!n.ok) throw new Error(`nota_${n.error}`);
}

/** ¿La conversación de Chatwoot es de un hilo del portal? Antes de releer nada de Chatwoot. */
async function esDelPortal(ctx: ContextoChatwoot, cfg: ChatwootPortalConfig, conversacionId: number): Promise<boolean> {
  const { data, error } = await ctx.admin
    .from("chatwoot_portal_hilos")
    .select("conversation_id")
    .eq("tenant_id", cfg.tenantId)
    .eq("chatwoot_conversation_id", conversacionId)
    .limit(1);
  if (error) throw new Error(`chatwoot_portal_hilos: ${error.code ?? "sin código"}`);
  return (data ?? []).length > 0;
}

export const responderAlPortal: ManejadorEvento = async (ctx, evento) => {
  if (evento.evento !== "message_created" || evento.mensajeId === null) return;
  // La ruta ya leyó la carga y no es una respuesta en la bandeja del portal.
  if (ctx.salientePortal === null) return;
  // Un entrante público (el que avisa): no es del equipo.
  if (evento.avisar) return;
  const cfg = chatwootPortalConfig();
  if (!cfg || cfg.tenantId !== ctx.tenantId) return;
  if (evento.conversacion.inboxId !== null && evento.conversacion.inboxId !== cfg.inboxPortalId) return;
  const flags = await listFeatureFlags(ctx.admin, ctx.tenantId);
  if (!flags.chatwoot_portal) return;

  const conversacionId = evento.conversacion.id;
  let m = ctx.salientePortal?.id === evento.mensajeId ? ctx.salientePortal : null;
  if (!m) {
    // Reproceso: el evento no guardó el texto. Solo se relee si la conversación es del portal.
    if (!(await esDelPortal(ctx, cfg, conversacionId))) return;
    const r = await leerMensaje(cfg, conversacionId, evento.mensajeId);
    if (!r.ok) throw new Error(`leer_mensaje_${r.error}`);
    m = interpretarMensajePortal(r.data);
    // Ya no está en Chatwoot: no hay nada que llevar.
    if (!m) return;
  }
  if (!esRespuestaDelEquipo(m, cfg.inboxPortalId)) return;
  await escribirRespuestaPortal(ctx.admin, cfg, conversacionId, m);
};

/**
 * Escribe una respuesta del equipo en el hilo del portal (`chatwoot_portal_respuesta`, 0520), avisa
 * al cliente una sola vez y deja las notas del archivado y del adjunto. La usan `responderAlPortal`
 * y la conciliación (SDD-0586 1c-2). Es idempotente: un reintento da «duplicado» y no avisa.
 * El que llama ya comprobó `esRespuestaDelEquipo`. Lanza si falla Chatwoot o la base.
 */
export async function escribirRespuestaPortal(
  admin: SupabaseClient,
  cfg: ChatwootPortalConfig,
  conversacionId: number,
  m: MensajePortal,
): Promise<ResultadoRespuesta | undefined> {
  const texto = m.texto.trim() === "" ? null : m.texto;
  const { data, error } = await admin.rpc("chatwoot_portal_respuesta", {
    p_tenant_id: cfg.tenantId,
    p_chatwoot_conversation_id: conversacionId,
    p_chatwoot_message_id: m.id,
    p_cuerpo: texto,
    p_enviado_at: m.creado,
    p_chatwoot_user_id: m.agenteId,
  });
  if (error) throw new Error(`chatwoot_portal_respuesta: ${error.code ?? "sin código"}`);
  const fila = (Array.isArray(data) ? data[0] : data) as { resultado?: ResultadoRespuesta; cliente_id?: string | null } | null;
  const resultado = fila?.resultado;

  // El push primero: si la nota falla y el evento se reintenta, la respuesta ya está y no se avisa dos veces.
  if (resultado === "insertado" && fila?.cliente_id && texto) {
    await notifyClientReplyPush(admin, { clientId: fila.cliente_id, body: texto });
  }
  if (resultado === "archivado") {
    await dejarNota(cfg, conversacionId, m, "archivado");
  } else if (m.adjuntos > 0 && (resultado === "insertado" || resultado === "duplicado" || resultado === "sin_texto")) {
    await dejarNota(cfg, conversacionId, m, "adjunto");
  }
  return resultado;
}

/**
 * El estado del hilo del portal (SDD-0586 1c-2, E10-D39): `chatwoot_portal_estado_hilo` (0521) lo
 * lee del espejo `chatwoot_conversations`, que `chatwoot_registrar_evento` ya ordenó, y lo escribe
 * solo si cambia. Nunca del evento: el reproceso lo rellena con «open». Sin la 0521 (PGRST202)
 * no lanza: la 0521 se aplica antes de fusionar, y esto solo cubre el hueco.
 */
export async function estadoDelHilo(admin: SupabaseClient, tenantId: string, conversacionId: number): Promise<string> {
  const { data, error } = await admin.rpc("chatwoot_portal_estado_hilo", {
    p_tenant_id: tenantId,
    p_chatwoot_conversation_id: conversacionId,
  });
  if (error) {
    if (error.code === "PGRST202") return "sin_migracion";
    throw new Error(`chatwoot_portal_estado_hilo: ${error.code ?? "sin código"}`);
  }
  const fila = (Array.isArray(data) ? data[0] : data) as { resultado?: string } | null;
  return fila?.resultado ?? "sin_resultado";
}

/**
 * Corre con cada evento, después de que `chatwoot_registrar_evento` aplicó el espejo. Solo en la
 * bandeja del portal (en el reproceso la bandeja no vino: decide el vínculo, en la base), con el
 * flag y la configuración de la 1c-1.
 */
export const estadoAlPortal: ManejadorEvento = async (ctx, evento) => {
  const cfg = chatwootPortalConfig();
  if (!cfg || cfg.tenantId !== ctx.tenantId) return;
  if (evento.conversacion.inboxId !== null && evento.conversacion.inboxId !== cfg.inboxPortalId) return;
  const flags = await listFeatureFlags(ctx.admin, ctx.tenantId);
  if (!flags.chatwoot_portal) return;
  await estadoDelHilo(ctx.admin, cfg.tenantId, evento.conversacion.id);
};
