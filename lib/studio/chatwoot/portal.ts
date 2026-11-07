import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";

import { createAdminClient } from "@/lib/db/admin";
import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";
import { drainOperarioPushOutbox, enqueueUserPush } from "@/lib/studio/notify/operario-push-outbox";
import type { ChatwootError } from "./chatwoot-types";
import { chatwootPortalConfig, type ChatwootPortalConfig } from "./config";
import {
  buscarContactoPortal,
  crearContactoPortal,
  crearConversacionPortal,
  crearMensajeEntrante,
  envioIncierto,
  listarConversacionesContacto,
  listarMensajes,
  type ContactoPortal,
} from "./router-api";

/**
 * La ida del chat del portal a Chatwoot (SDD-0586, paso 10.5, PR 1a: E10-D34, E10-D35 y
 * el aviso de E10-D40).
 *
 * El mensaje ya está guardado en Studio (`portal_post_message`) antes de llegar aquí: el
 * portal nunca falla por Chatwoot (E10-D24). La migración de la 10.5 decide qué sale y
 * cuándo: `chatwoot_portal_tomar` da, por hilo, el mensaje que le toca, el más viejo primero
 * y uno por hilo, y `chatwoot_portal_marcar` fija el próximo intento. Aquí se hace la
 * llamada a Chatwoot con el token del usuario de servicio de E10:
 *
 *   1. El contacto, con el identificador al azar que la base ya guardó
 *      (`dtd-portal:<uuid>`) y el nombre del mensaje. Un 422 (ya existe) o un intento
 *      anterior incierto lo buscan en vez de crear otro.
 *   2. La conversación del hilo. Después de un incierto se reusa la de la bandeja que no
 *      esté vinculada a otro hilo.
 *   3. El mensaje, `incoming`, con `source_id = dtd:<id del mensaje>`. Después de un
 *      incierto, antes de reenviar se busca ese source_id en la conversación.
 *
 * Cada vínculo se guarda apenas existe, antes del paso siguiente. A Chatwoot solo van el
 * nombre, el identificador y el texto: ni teléfono, ni correo, ni cédula o RIF, ni Shipping
 * Mark, ni el client_id, que este archivo nunca recibe. En los logs, solo códigos.
 *
 * Con el flag `chatwoot_portal` apagado o sin `chatwootPortalConfig()`, no hace nada.
 */

/** Fila de `chatwoot_portal_tomar`. */
interface Tomado {
  mensaje_id: string;
  hilo_id: string;
  autor: string | null;
  cuerpo: string;
  intento: number;
  verificar: boolean;
  identificador: string;
  contacto_id: number | null;
  contacto_source_id: string | null;
  conversacion_id: number | null;
}

export interface ResultadoEnvioPortal {
  tomados: number;
  enviados: number;
  fallidos: number;
  omitido?: "sin_configurar" | "apagado" | "base";
}

type Intento = { ok: true; chatwootMessageId: number } | { ok: false; codigo: string; incierto: boolean };

const NOMBRE_SIN_AUTOR = "Cliente del portal";
const PRESUPUESTO_MS = 25_000;

const sourceIdDe = (mensajeId: string) => `dtd:${mensajeId}`;
const identificadorDe = (uuid: string) => `dtd-portal:${uuid}`;

/** Un código para `chatwoot_portal_salida.error` (`^[a-z0-9_]{1,40}$`). */
function codigo(paso: "contacto" | "conversacion" | "mensaje", error: ChatwootError): string {
  return `${paso}_${error}`.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
}

/** Después de un POST, una respuesta que no se entiende también es incierta: pudo haberse creado. */
function falloPost(paso: "contacto" | "conversacion" | "mensaje", error: ChatwootError): Intento {
  return { ok: false, codigo: codigo(paso, error), incierto: envioIncierto(error) || error === "respuesta_invalida" };
}

/** Un GET que falla no crea nada, pero no deja saber si el intento anterior entró. */
function falloLectura(paso: "contacto" | "conversacion" | "mensaje", error: ChatwootError): Intento {
  return { ok: false, codigo: codigo(paso, error), incierto: true };
}

async function vincular(
  admin: SupabaseClient,
  cfg: ChatwootPortalConfig,
  hiloId: string,
  contacto: ContactoPortal,
  conversacionId: number | null,
): Promise<void> {
  const { error } = await admin.rpc("chatwoot_portal_vincular", {
    p_tenant_id: cfg.tenantId,
    p_hilo_id: hiloId,
    p_contacto_id: contacto.contactoId,
    p_contacto_source_id: contacto.sourceId,
    p_inbox_id: conversacionId === null ? null : cfg.inboxPortalId,
    p_conversacion_id: conversacionId,
  });
  if (error) throw new Error(`chatwoot_portal_vincular: ${error.code ?? "sin código"}`);
}

/** La conversación de la bandeja que un intento incierto ya creó: la más nueva que no tiene hilo. */
async function conversacionSinHilo(
  admin: SupabaseClient,
  cfg: ChatwootPortalConfig,
  contactoId: number,
): Promise<{ ok: true; id: number | null } | { ok: false; error: ChatwootError }> {
  const r = await listarConversacionesContacto(cfg, contactoId);
  if (!r.ok) return r;
  const candidatas = r.data.filter((c) => c.inboxId === cfg.inboxPortalId).map((c) => c.id);
  if (candidatas.length === 0) return { ok: true, id: null };
  const { data, error } = await admin
    .from("chatwoot_portal_hilos")
    .select("chatwoot_conversation_id")
    .eq("tenant_id", cfg.tenantId)
    .in("chatwoot_conversation_id", candidatas);
  if (error) throw new Error(`chatwoot_portal_hilos: ${error.code ?? "sin código"}`);
  const ocupadas = new Set(((data ?? []) as { chatwoot_conversation_id: number }[]).map((f) => Number(f.chatwoot_conversation_id)));
  const libres = candidatas.filter((id) => !ocupadas.has(id)).sort((a, b) => b - a);
  return { ok: true, id: libres[0] ?? null };
}

async function enviarUno(admin: SupabaseClient, cfg: ChatwootPortalConfig, fila: Tomado): Promise<Intento> {
  // 1. El contacto.
  let contacto: ContactoPortal | null =
    fila.contacto_id !== null && fila.contacto_source_id !== null
      ? { contactoId: Number(fila.contacto_id), sourceId: fila.contacto_source_id }
      : null;
  if (!contacto) {
    const identificador = identificadorDe(fila.identificador);
    if (fila.verificar) {
      const b = await buscarContactoPortal(cfg, identificador, cfg.inboxPortalId);
      if (!b.ok) return falloLectura("contacto", b.error);
      contacto = b.data;
    }
    if (!contacto) {
      const c = await crearContactoPortal(cfg, {
        inboxId: cfg.inboxPortalId,
        nombre: fila.autor?.trim() || NOMBRE_SIN_AUTOR,
        identificador,
      });
      if (c.ok) {
        contacto = c.data;
      } else if (c.error === "http_422") {
        // Ya existe con ese identificador: lo creó un intento anterior.
        const b = await buscarContactoPortal(cfg, identificador, cfg.inboxPortalId);
        if (!b.ok) return falloLectura("contacto", b.error);
        if (!b.data) return falloPost("contacto", c.error);
        contacto = b.data;
      } else {
        return falloPost("contacto", c.error);
      }
    }
    await vincular(admin, cfg, fila.hilo_id, contacto, null);
  }

  // 2. La conversación del hilo.
  let conversacionId = fila.conversacion_id === null ? null : Number(fila.conversacion_id);
  if (conversacionId === null) {
    if (fila.verificar) {
      const libre = await conversacionSinHilo(admin, cfg, contacto.contactoId);
      if (!libre.ok) return falloLectura("conversacion", libre.error);
      conversacionId = libre.id;
    }
    if (conversacionId === null) {
      const c = await crearConversacionPortal(cfg, {
        inboxId: cfg.inboxPortalId,
        contactoId: contacto.contactoId,
        sourceId: contacto.sourceId,
      });
      if (!c.ok) return falloPost("conversacion", c.error);
      conversacionId = c.data;
    }
    await vincular(admin, cfg, fila.hilo_id, contacto, conversacionId);
  }

  // 3. El mensaje, una sola vez aunque se reintente.
  const sourceId = sourceIdDe(fila.mensaje_id);
  if (fila.verificar) {
    const l = await listarMensajes(cfg, conversacionId);
    if (!l.ok) return falloLectura("mensaje", l.error);
    const ya = l.data.find((m) => m.sourceId === sourceId);
    if (ya) return { ok: true, chatwootMessageId: ya.id };
  }
  const m = await crearMensajeEntrante(cfg, conversacionId, { texto: fila.cuerpo, sourceId });
  return m.ok ? { ok: true, chatwootMessageId: m.data } : falloPost("mensaje", m.error);
}

async function marcar(admin: SupabaseClient, cfg: ChatwootPortalConfig, fila: Tomado, r: Intento): Promise<void> {
  // Si cerrar falla, la fila queda en «enviando» y a los 5 min se retoma como incierta:
  // busca el source_id antes de reenviar, así que no duplica.
  const { error } = await admin.rpc("chatwoot_portal_marcar", {
    p_tenant_id: cfg.tenantId,
    p_mensaje_id: fila.mensaje_id,
    p_intento: fila.intento,
    p_ok: r.ok,
    p_chatwoot_message_id: r.ok ? r.chatwootMessageId : null,
    p_error: r.ok ? null : r.codigo,
    p_incierto: r.ok ? false : r.incierto,
  });
  if (error) console.warn(`[chatwoot-portal] chatwoot_portal_marcar: ${error.code ?? "sin código"}`);
}

/**
 * Manda lo que la cola tenga listo: del cron, todo el tenant; del portal, solo su hilo.
 * Toma de a `limite` y vuelve a tomar (el siguiente mensaje de cada hilo) hasta que no
 * queda nada, `maxVueltas` o el presupuesto de tiempo. No lanza por lo que responda
 * Chatwoot ni por un error que devuelva la base; quien la llama atrapa el resto.
 */
export async function enviarPortalPendientes(
  admin: SupabaseClient,
  opciones: { hiloId?: string; limite?: number; maxVueltas?: number; presupuestoMs?: number } = {},
): Promise<ResultadoEnvioPortal> {
  const resultado: ResultadoEnvioPortal = { tomados: 0, enviados: 0, fallidos: 0 };
  const cfg = chatwootPortalConfig();
  if (!cfg) return { ...resultado, omitido: "sin_configurar" };
  const flags = await listFeatureFlags(admin, cfg.tenantId);
  if (!flags.chatwoot_portal) return { ...resultado, omitido: "apagado" };

  const inicio = Date.now();
  const presupuesto = opciones.presupuestoMs ?? PRESUPUESTO_MS;
  const maxVueltas = opciones.maxVueltas ?? 10;
  for (let vuelta = 0; vuelta < maxVueltas && Date.now() - inicio < presupuesto; vuelta += 1) {
    const { data, error } = await admin.rpc("chatwoot_portal_tomar", {
      p_tenant_id: cfg.tenantId,
      p_limite: opciones.limite ?? 10,
      p_conversation_id: opciones.hiloId ?? null,
    });
    if (error) {
      // Sin la migración (o con la base caída) no rompe: lo intenta la próxima corrida.
      console.warn(`[chatwoot-portal] chatwoot_portal_tomar: ${error.code ?? "sin código"}`);
      return resultado.tomados === 0 ? { ...resultado, omitido: "base" } : resultado;
    }
    const filas = (data ?? []) as Tomado[];
    if (filas.length === 0) break;
    for (const fila of filas) {
      resultado.tomados += 1;
      let r: Intento;
      try {
        r = await enviarUno(admin, cfg, fila);
      } catch {
        // La base falló a mitad de camino: pudo quedar algo creado en Chatwoot sin vincular.
        r = { ok: false, codigo: "base", incierto: true };
      }
      await marcar(admin, cfg, fila, r);
      if (r.ok) {
        resultado.enviados += 1;
      } else {
        resultado.fallidos += 1;
        console.warn(`[chatwoot-portal] envío falló: ${r.codigo}`);
      }
    }
  }
  return resultado;
}

/**
 * El portal pide el envío de su hilo después de guardar el mensaje, sin esperarlo: corre
 * con `after()`, cuando el cliente ya tiene su respuesta. Sin configuración no agenda
 * nada. Si falla, lo manda el cron `chatwoot-reintentos`.
 */
export function pedirEnvioPortal(hiloId: string): void {
  if (!chatwootPortalConfig()) return;
  try {
    after(async () => {
      try {
        await enviarPortalPendientes(createAdminClient(), { hiloId, limite: 1, maxVueltas: 5 });
      } catch (e) {
        console.warn(`[chatwoot-portal] envío desde el portal falló: ${e instanceof Error ? e.name : "error"}`);
      }
    });
  } catch {
    // `after()` solo vale dentro de un request; fuera (pruebas, scripts) lo manda el cron.
  }
}

export interface AvisoRezagoPortal {
  avisados: number;
  sinLlegar: number;
  atascados: number;
  omitido?: "sin_configurar" | "apagado" | "base";
}

/**
 * El aviso de E10-D40: si hay mensajes del portal que llevan más de 15 min sin llegar a
 * Chatwoot, o alguno atascado, un push a los admins activos con solo números, una vez por
 * hora (UTC) mientras dure. Nunca lanza.
 */
export async function avisarRezagoPortal(admin: SupabaseClient, ahora: Date = new Date()): Promise<AvisoRezagoPortal> {
  const vacio: AvisoRezagoPortal = { avisados: 0, sinLlegar: 0, atascados: 0 };
  const cfg = chatwootPortalConfig();
  if (!cfg) return { ...vacio, omitido: "sin_configurar" };
  const flags = await listFeatureFlags(admin, cfg.tenantId);
  if (!flags.chatwoot_portal) return { ...vacio, omitido: "apagado" };

  const { data, error } = await admin.rpc("chatwoot_portal_rezagados", { p_tenant_id: cfg.tenantId });
  if (error) {
    console.warn(`[chatwoot-portal] chatwoot_portal_rezagados: ${error.code ?? "sin código"}`);
    return { ...vacio, omitido: "base" };
  }
  const fila = (Array.isArray(data) ? data[0] : data) as { sin_llegar?: number; atascados?: number } | null;
  const sinLlegar = Number(fila?.sin_llegar ?? 0);
  const atascados = Number(fila?.atascados ?? 0);
  if (!(sinLlegar > 0)) return { ...vacio, sinLlegar: 0, atascados: 0 };

  const clave = `chatwoot-portal-rezago:${ahora.toISOString().slice(0, 13)}`;
  const [admins, ya] = await Promise.all([
    admin.from("user_tenants").select("user_id").eq("tenant_id", cfg.tenantId).eq("role", "admin").is("disabled_at", null),
    admin.from("outbox_push_events").select("target_id").eq("tenant_id", cfg.tenantId).eq("payload->>clave_evento", clave),
  ]);
  if (admins.error || ya.error) {
    // Sin saber a quién ya se avisó, mejor la próxima corrida que repetir.
    console.warn(`[chatwoot-portal] aviso: ${(admins.error ?? ya.error)?.code ?? "sin código"}`);
    return { ...vacio, sinLlegar, atascados, omitido: "base" };
  }
  const avisados = new Set(((ya.data ?? []) as { target_id: string }[]).map((f) => f.target_id));
  const faltan = ((admins.data ?? []) as { user_id: string }[]).map((f) => f.user_id).filter((u) => !avisados.has(u));

  const cuerpo =
    `Portal → Chatwoot: ${sinLlegar} ${sinLlegar === 1 ? "mensaje" : "mensajes"} sin llegar` +
    (atascados > 0 ? `, ${atascados} ${atascados === 1 ? "atascado" : "atascados"}` : "") +
    ".";
  let encolados = 0;
  for (const userId of faltan) {
    const id = await enqueueUserPush(admin, cfg.tenantId, userId, {
      title: "Portal → Chatwoot",
      body: cuerpo,
      url: "/studio/bandeja",
      tag: "chatwoot-portal-rezago",
      claveEvento: clave,
    });
    if (id) encolados += 1;
  }
  if (encolados > 0) await drainOperarioPushOutbox(admin);
  return { avisados: encolados, sinLlegar, atascados };
}
