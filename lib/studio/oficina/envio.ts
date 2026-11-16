/**
 * SDD-0626 Paso 3b (C) · El envío: SOLO el ERP envía, SOLO lo aprobado por Sam, SOLO a la bandeja de prueba.
 *
 * TODO NACE APAGADO. `OFICINA_ENVIO_ACTIVO` solo vale con `1` o `true`; cualquier otra cosa = apagado y no se
 * toca ni la base ni Chatwoot. Lo llama `/api/cron/oficina-envio` cada minuto.
 *
 * - `OFICINA_CHATWOOT_TOKEN_ENVIO`: token de ESCRITURA de un usuario agente de Chatwoot que SOLO es miembro de la
 *   bandeja de prueba. Chatwoot 4.19.1 no tiene tokens con alcance: el token tiene los permisos de su usuario,
 *   así que «limitado a la bandeja» = el usuario solo está en esa bandeja. Además, este código solo escribe en
 *   la conversación de la tarea, y antes comprueba por GET que es de la cuenta y de la bandeja permitidas.
 * - La cuenta (`CHATWOOT_ACCOUNT_ID`) y la bandeja (`OFICINA_CHATWOOT_INBOX_PRUEBA`) son las del webhook. La
 *   bandeja nunca puede ser una del ERP (portal, clientes, leads): un solo contestador por bandeja (§3.5).
 *
 * Por cada revisión aprobada (`office_envios_por_hacer`):
 *   1. la huella del texto que se va a mandar tiene que ser la que Sam aprobó;
 *   2. GET de la conversación: de la cuenta y la bandeja permitidas, y sin un mensaje saliente nuevo desde que se
 *      redactó el borrador (si alguien ya contestó, no se contesta dos veces: un solo contestador);
 *   3. `office_reservar_envio` mira OTRA VEZ la pausa y la huella del borrador (que no cambió desde la
 *      aprobación) y reserva el envío UNA vez; recién entonces
 *   4. POST del mensaje saliente, y `office_cerrar_envio` (enviado | fallido). Nunca se reintenta solo: si el
 *      proceso se cae entre 3 y 4, el envío queda «enviando» y lo mira Sam (como mucho una vez, nunca dos).
 *
 * Los errores llevan solo un código; el texto no va a ningún log.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { chatwootOriginFromEnv } from "@/lib/runtime/chatwoot-origin";
import { firstConfiguredSecret } from "@/lib/runtime/server-secret";

import { conversacionDeReferencia } from "./chatwoot-lectura";
import { configWebhookOficina, interruptorEncendido } from "./config";
import { SinMigracion, ErrorDelAlmacen } from "./despachador-almacen";
import { faltaLaMigracion } from "./escritura";
import { huellaBorrador } from "./revisiones";

type Entorno = Readonly<Record<string, string | undefined>>;

export interface ConfigEnvio {
  activo: boolean;
  chatwoot: { url: string; token: string; cuenta: number; bandeja: number } | null;
}

function urlValida(valor: string | undefined): string | null {
  const v = (valor ?? "").trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    if ((u.protocol !== "http:" && u.protocol !== "https:") || u.username || u.password) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function configEnvio(env: Entorno = process.env): ConfigEnvio {
  const webhook = configWebhookOficina(env);
  const token = firstConfiguredSecret(env.OFICINA_CHATWOOT_TOKEN_ENVIO);
  const url = urlValida(env.OFICINA_CHATWOOT_API_URL) ?? chatwootOriginFromEnv(env.CHATWOOT_URL);
  return {
    activo: interruptorEncendido(env.OFICINA_ENVIO_ACTIVO),
    // `bandejaPrueba` ya es null si coincide con una bandeja del ERP (un solo contestador por bandeja).
    chatwoot:
      token && url && webhook.cuenta !== null && webhook.bandejaPrueba !== null
        ? { url, token, cuenta: webhook.cuenta, bandeja: webhook.bandejaPrueba }
        : null,
  };
}

export interface EnvioPorHacer {
  revisionId: string;
  taskId: string;
  entidadRef: string | null;
  texto: string;
  guion: string;
  huella: string;
  borradorCreadoEn: string;
}

export type Reserva = "ok" | "pausada" | "ya_reservado" | "no_aprobado" | "borrador_cambio" | "borrador_no_existe";

export interface AlmacenEnvio {
  estaPausada(): Promise<boolean>;
  porHacer(limite: number): Promise<EnvioPorHacer[]>;
  reservar(revisionId: string, huella: string, bandeja: number): Promise<Reserva>;
  cerrar(revisionId: string, estado: "enviado" | "fallido", codigo: string | null, mensajeId: number | null): Promise<boolean>;
}

export function crearAlmacenEnvio(admin: SupabaseClient): AlmacenEnvio {
  const rpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await admin.rpc(fn, args);
    if (error) {
      if (faltaLaMigracion(error)) throw new SinMigracion();
      throw new ErrorDelAlmacen(error.code);
    }
    return data as T;
  };
  return {
    estaPausada: async () => (await rpc<boolean>("office_esta_pausada", {})) !== false,
    async porHacer(limite) {
      const filas = await rpc<Array<Record<string, unknown>> | null>("office_envios_por_hacer", { p_limite: limite });
      return (filas ?? [])
        .filter(
          (f) =>
            typeof f.revision_id === "string" &&
            typeof f.texto === "string" &&
            typeof f.guion === "string" &&
            typeof f.huella === "string",
        )
        .map((f) => ({
          revisionId: f.revision_id as string,
          taskId: String(f.task_id),
          entidadRef: typeof f.entidad_ref === "string" ? f.entidad_ref : null,
          texto: f.texto as string,
          guion: f.guion as string,
          huella: f.huella as string,
          borradorCreadoEn: String(f.borrador_creado_en ?? ""),
        }));
    },
    reservar: (revisionId, huella, bandeja) =>
      rpc<Reserva>("office_reservar_envio", { p_revision: revisionId, p_huella: huella, p_bandeja: bandeja }),
    cerrar: (revisionId, estado, codigo, mensajeId) =>
      rpc<boolean>("office_cerrar_envio", { p_revision: revisionId, p_estado: estado, p_codigo: codigo, p_mensaje_id: mensajeId }),
  };
}

export class ErrorDeChatwoot extends Error {
  readonly codigo: string;
  constructor(codigo: string) {
    super(`Chatwoot no respondió (${codigo})`);
    this.name = "ErrorDeChatwoot";
    this.codigo = codigo;
  }
}

export interface ChatwootEnvio {
  /** GET de la conversación: cuenta, bandeja y la hora (s) del último mensaje saliente no privado. */
  conversacion(conversacionId: number): Promise<{ cuenta: number; bandeja: number; ultimaSalidaS: number | null }>;
  /** POST del mensaje saliente. Devuelve el id del mensaje. */
  enviar(conversacionId: number, texto: string): Promise<number | null>;
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function crearChatwootEnvio(c: { url: string; token: string; cuenta: number }, f: typeof fetch = fetch): ChatwootEnvio {
  const pedir = async (ruta: string, init: RequestInit): Promise<unknown> => {
    let r: Response;
    try {
      r = await f(`${c.url}/api/v1/accounts/${c.cuenta}${ruta}`, {
        ...init,
        headers: { api_access_token: c.token, accept: "application/json", "content-type": "application/json" },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
    } catch {
      throw new ErrorDeChatwoot("red");
    }
    if (!r.ok) throw new ErrorDeChatwoot(`http_${r.status}`);
    try {
      return await r.json();
    } catch {
      throw new ErrorDeChatwoot("json");
    }
  };
  return {
    async conversacion(id) {
      const conv = obj(await pedir(`/conversations/${id}`, { method: "GET" }));
      if (!conv) throw new ErrorDeChatwoot("conversacion");
      const mensajes = obj(await pedir(`/conversations/${id}/messages`, { method: "GET" }));
      const lista = Array.isArray(mensajes?.payload) ? (mensajes.payload as unknown[]) : [];
      const salidas = lista
        .map(obj)
        .filter((m): m is Record<string, unknown> => m !== null && m.message_type === 1 && m.private !== true)
        .map((m) => Number(m.created_at))
        .filter((n) => Number.isFinite(n));
      return {
        cuenta: conv.account_id === undefined ? c.cuenta : Number(conv.account_id),
        bandeja: Number(conv.inbox_id),
        ultimaSalidaS: salidas.length ? Math.max(...salidas) : null,
      };
    },
    async enviar(id, texto) {
      const m = obj(
        await pedir(`/conversations/${id}/messages`, {
          method: "POST",
          body: JSON.stringify({ content: texto, message_type: "outgoing", private: false, content_type: "text" }),
        }),
      );
      const n = Number(m?.id);
      return Number.isFinite(n) && n > 0 ? n : null;
    },
  };
}

export type ResultadoUno =
  | "enviado"
  | "fallido"
  | "bloqueado"
  | "omitido"
  | Exclude<Reserva, "ok">;

export interface ResumenEnvio {
  estado: "apagado" | "sin_config" | "sin_migracion" | "pausada" | "hecho";
  resultados: ResultadoUno[];
}

export interface DepsEnvio {
  config: ConfigEnvio;
  almacen: AlmacenEnvio;
  chatwoot: ChatwootEnvio;
  registrar?: (m: string) => void;
}

async function enviarUno(deps: DepsEnvio, e: EnvioPorHacer, bandeja: number): Promise<ResultadoUno> {
  const { almacen, chatwoot } = deps;
  const registrar = deps.registrar ?? ((m: string) => console.error(m));
  // 1. El texto en memoria es el que Sam aprobó. Si no, la reserva lo deja «bloqueado» (borrador_cambio).
  const huella = huellaBorrador({ tipo: "respuesta", texto: e.texto, guion: e.guion, motivo: null, prioridad: null });
  if (huella !== e.huella) return await almacen.reservar(e.revisionId, huella, bandeja).then((r) => (r === "ok" ? "omitido" : r));
  const conversacionId = conversacionDeReferencia(e.entidadRef);
  if (conversacionId === null) return "omitido";
  // 2. La conversación es de la bandeja permitida y nadie contestó desde el borrador.
  let conv: Awaited<ReturnType<ChatwootEnvio["conversacion"]>>;
  try {
    conv = await chatwoot.conversacion(conversacionId);
  } catch (err) {
    registrar(`[oficina-envio] no se pudo leer la conversación (${err instanceof ErrorDeChatwoot ? err.codigo : "error"}); se reintenta en el próximo minuto`);
    return "omitido";
  }
  if (conv.bandeja !== bandeja || conv.cuenta !== deps.config.chatwoot?.cuenta) {
    // No se reserva: nunca se escribe fuera de la bandeja de prueba.
    registrar("[oficina-envio] la conversación no es de la bandeja de prueba: no se envía");
    return "bloqueado";
  }
  const borradorS = Date.parse(e.borradorCreadoEn) / 1000;
  if (conv.ultimaSalidaS !== null && Number.isFinite(borradorS) && conv.ultimaSalidaS > borradorS) {
    registrar("[oficina-envio] alguien ya contestó en esa conversación después del borrador: no se envía (un solo contestador)");
    return "bloqueado";
  }
  // 3. Otra vez la pausa y la huella, y la reserva (una sola vez), en la base.
  const reserva = await almacen.reservar(e.revisionId, e.huella, bandeja);
  if (reserva !== "ok") return reserva;
  // 4. El envío.
  try {
    const id = await chatwoot.enviar(conversacionId, e.texto);
    await almacen.cerrar(e.revisionId, "enviado", null, id);
    return "enviado";
  } catch (err) {
    const codigo = err instanceof ErrorDeChatwoot ? err.codigo : "error";
    registrar(`[oficina-envio] el envío falló (${codigo}); no se reintenta solo`);
    await almacen.cerrar(e.revisionId, "fallido", codigo.replace(/[^a-z0-9_:.-]/g, "_").slice(0, 64), null);
    return "fallido";
  }
}

export async function procesarEnvios(deps: DepsEnvio, limite = 5): Promise<ResumenEnvio> {
  const { config, almacen } = deps;
  if (!config.activo) return { estado: "apagado", resultados: [] };
  if (!config.chatwoot) return { estado: "sin_config", resultados: [] };
  const bandeja = config.chatwoot.bandeja;
  const resultados: ResultadoUno[] = [];
  try {
    if (await almacen.estaPausada()) return { estado: "pausada", resultados };
    for (const e of await almacen.porHacer(limite)) {
      // La pausa se mira antes de cada envío (y otra vez dentro de la reserva).
      if (await almacen.estaPausada()) return { estado: "pausada", resultados };
      resultados.push(await enviarUno(deps, e, bandeja));
    }
  } catch (err) {
    if (err instanceof SinMigracion) return { estado: "sin_migracion", resultados };
    throw err;
  }
  return { estado: "hecho", resultados };
}
