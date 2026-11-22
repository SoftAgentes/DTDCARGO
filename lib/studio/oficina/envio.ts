/**
 * SDD-0626 Paso 3b (C) · El envío: SOLO el ERP envía, SOLO lo aprobado por Sam, SOLO a la bandeja de prueba.
 *
 * TODO NACE APAGADO. `OFICINA_ENVIO_ACTIVO` solo vale con `1` o `true`; cualquier otra cosa = apagado y no se
 * toca ni la base ni Chatwoot. Lo llama `/api/cron/oficina-envio` cada minuto.
 *
 * - `OFICINA_CHATWOOT_TOKEN_ENVIO`: token de ESCRITURA de un usuario agente de Chatwoot que SOLO es miembro de la
 *   bandeja de prueba. Chatwoot 4.19.1 no tiene tokens con alcance: el token tiene los permisos de su usuario,
 *   así que «limitado a la bandeja» = el usuario solo está en esa bandeja. Además, este código solo escribe en
 *   la conversación que Sam aprobó, y antes comprueba por GET que es de la cuenta y de la bandeja permitidas.
 * - La cuenta (`OFICINA_CHATWOOT_ACCOUNT_ID`, nunca la del ERP) y la bandeja (`OFICINA_CHATWOOT_INBOX_PRUEBA`) son las del webhook. La
 *   bandeja nunca puede ser una del ERP (portal, clientes, leads): un solo contestador por bandeja (§3.5).
 *
 * Por cada revisión aprobada (`office_envios_por_hacer`):
 *   1. la huella del texto que se va a mandar tiene que ser la que Sam aprobó;
 *   2. GET de la conversación (la que Sam aprobó, B3). Se BLOQUEA si es de otra bandeja o cuenta, si alguien ya
 *      contestó después del borrador (un solo contestador), si el cliente escribió después del borrador (B1) o si
 *      Chatwoot responde con una forma que no se reconoce (falla hacia el lado seguro);
 *   3. `office_reservar_envio` mira OTRA VEZ la pausa, que la conversación sigue siendo la aprobada, que la
 *      aprobación tiene menos de 24 h (B1) y que el borrador no cambió (su huella), y reserva el envío UNA vez;
 *   4. POST del mensaje saliente. Solo un rechazo seguro de Chatwoot (4xx) es «fallido». Si el mensaje PUDO haber
 *      salido (red, plazo vencido, 5xx, una respuesta ilegible o el cierre en la base que falla después de
 *      entregar), el envío se queda en «enviando», con el aviso `envio.incierto`, y nunca se reintenta (M1): como
 *      mucho una vez, nunca dos.
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
  /** La conversación que Sam aprobó (la de la revisión, no la de la tarea: B3). */
  entidadRef: string | null;
  texto: string;
  guion: string;
  huella: string;
  borradorCreadoEn: string;
}

export type Reserva =
  | "ok"
  | "pausada"
  | "ya_reservado"
  | "no_aprobado"
  | "conversacion_cambio"
  | "aprobacion_vencida"
  | "borrador_cambio"
  | "borrador_no_existe";

export type Bloqueo = "otra_bandeja" | "ya_contestada" | "cliente_escribio" | "forma_desconocida";

export interface AlmacenEnvio {
  estaPausada(): Promise<boolean>;
  porHacer(limite: number): Promise<EnvioPorHacer[]>;
  reservar(revisionId: string, huella: string, bandeja: number, conversacion: number): Promise<Reserva>;
  bloquear(revisionId: string, codigo: Bloqueo, bandeja: number): Promise<boolean>;
  cerrar(revisionId: string, estado: "enviado" | "fallido", codigo: string | null, mensajeId: number | null): Promise<boolean>;
  marcarIncierto(revisionId: string, codigo: string): Promise<boolean>;
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
    reservar: (revisionId, huella, bandeja, conversacion) =>
      rpc<Reserva>("office_reservar_envio", {
        p_revision: revisionId,
        p_huella: huella,
        p_bandeja: bandeja,
        p_conversacion: conversacion,
      }),
    bloquear: (revisionId, codigo, bandeja) =>
      rpc<boolean>("office_bloquear_envio", { p_revision: revisionId, p_codigo: codigo, p_bandeja: bandeja }),
    cerrar: (revisionId, estado, codigo, mensajeId) =>
      rpc<boolean>("office_cerrar_envio", { p_revision: revisionId, p_estado: estado, p_codigo: codigo, p_mensaje_id: mensajeId }),
    marcarIncierto: (revisionId, codigo) =>
      rpc<boolean>("office_marcar_envio_incierto", { p_revision: revisionId, p_codigo: codigo }),
  };
}

/**
 * Un error de Chatwoot. `incierto` = el mensaje PUDO haber llegado (se cortó la red o venció el plazo, respondió
 * 5xx o 408, o un 2xx que no se puede leer). Solo un 4xx (distinto de 408) es un rechazo seguro: no se entregó.
 */
export class ErrorDeChatwoot extends Error {
  readonly codigo: string;
  readonly incierto: boolean;
  constructor(codigo: string, incierto = false) {
    super(`Chatwoot no respondió (${codigo})`);
    this.name = "ErrorDeChatwoot";
    this.codigo = codigo;
    this.incierto = incierto;
  }
}

/** Lo que el envío necesita saber de la conversación, ya interpretado. */
export type LecturaConversacion =
  | { forma: "conocida"; cuenta: number; bandeja: number; ultimaSalidaS: number | null; ultimaEntradaS: number | null }
  | { forma: "desconocida" };

export interface ChatwootEnvio {
  /** GET de la conversación y de sus mensajes. Una forma que no se reconoce vuelve como `desconocida` (se bloquea). */
  conversacion(conversacionId: number): Promise<LecturaConversacion>;
  /** POST del mensaje saliente. Devuelve el id del mensaje; si no lo puede confirmar, lanza `ErrorDeChatwoot`. */
  enviar(conversacionId: number, texto: string): Promise<number>;
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function entero(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^[0-9]+$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** La hora de un mensaje en segundos: unix (número o texto) o ISO. Null si no se entiende. */
function segundos(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v > 1e12 ? v / 1000 : v;
  if (typeof v === "string" && v.trim()) {
    if (/^[0-9]+(\.[0-9]+)?$/.test(v.trim())) return segundos(Number(v));
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms / 1000 : null;
  }
  return null;
}

/**
 * `message_type` de Chatwoot 4.19.1: en la API de mensajes es un entero (0 entrante, 1 saliente, 2 actividad,
 * 3 plantilla); en los webhooks, texto. Las plantillas cuentan como salientes. Cualquier otra cosa = no se reconoce.
 */
const TIPOS: Record<string, "entrada" | "salida" | "otro"> = {
  "0": "entrada",
  incoming: "entrada",
  "1": "salida",
  outgoing: "salida",
  "2": "otro",
  activity: "otro",
  "3": "salida",
  template: "salida",
};

/**
 * Interpreta la conversación y sus mensajes. FALLA HACIA EL LADO SEGURO: si la bandeja no es un entero, si la lista
 * de mensajes no es una lista, si un mensaje trae un `message_type` o un `private` que no se reconoce, o si un mensaje
 * entrante o saliente no trae una hora legible, la forma es `desconocida` y el envío se bloquea.
 */
export function interpretarConversacion(conv: unknown, mensajes: unknown, cuentaEsperada: number): LecturaConversacion {
  const c = obj(conv);
  const bandeja = entero(c?.inbox_id);
  if (!c || bandeja === null) return { forma: "desconocida" };
  let cuenta = cuentaEsperada;
  if (c.account_id !== undefined) {
    const n = entero(c.account_id);
    if (n === null) return { forma: "desconocida" };
    cuenta = n;
  }
  const m = obj(mensajes);
  if (!m || !Array.isArray(m.payload)) return { forma: "desconocida" };
  let ultimaSalidaS: number | null = null;
  let ultimaEntradaS: number | null = null;
  for (const crudo of m.payload) {
    const x = obj(crudo);
    if (!x) return { forma: "desconocida" };
    const tipo = TIPOS[String(x.message_type)];
    if (!tipo) return { forma: "desconocida" };
    if (x.private !== undefined && x.private !== null && typeof x.private !== "boolean") return { forma: "desconocida" };
    if (x.private === true || tipo === "otro") continue;
    const s = segundos(x.created_at);
    if (s === null) return { forma: "desconocida" };
    if (tipo === "salida") ultimaSalidaS = Math.max(ultimaSalidaS ?? 0, s);
    else ultimaEntradaS = Math.max(ultimaEntradaS ?? 0, s);
  }
  return { forma: "conocida", cuenta, bandeja, ultimaSalidaS, ultimaEntradaS };
}

export function crearChatwootEnvio(c: { url: string; token: string; cuenta: number }, f: typeof fetch = fetch): ChatwootEnvio {
  const base = `${c.url}/api/v1/accounts/${c.cuenta}`;
  const cabeceras = { api_access_token: c.token, accept: "application/json", "content-type": "application/json" };
  const leer = async (ruta: string): Promise<unknown> => {
    let r: Response;
    try {
      r = await f(`${base}${ruta}`, { method: "GET", headers: cabeceras, signal: AbortSignal.timeout(15_000), cache: "no-store" });
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
      const conv = await leer(`/conversations/${id}`);
      const mensajes = await leer(`/conversations/${id}/messages`);
      return interpretarConversacion(conv, mensajes, c.cuenta);
    },
    async enviar(id, texto) {
      let r: Response;
      try {
        r = await f(`${base}/conversations/${id}/messages`, {
          method: "POST",
          headers: cabeceras,
          body: JSON.stringify({ content: texto, message_type: "outgoing", private: false, content_type: "text" }),
          signal: AbortSignal.timeout(15_000),
          cache: "no-store",
        });
      } catch {
        // Se cortó o venció el plazo: Chatwoot pudo haberlo guardado.
        throw new ErrorDeChatwoot("red", true);
      }
      if (!r.ok) {
        const rechazo = r.status >= 400 && r.status < 500 && r.status !== 408;
        throw new ErrorDeChatwoot(`http_${r.status}`, !rechazo);
      }
      let cuerpo: unknown;
      try {
        cuerpo = await r.json();
      } catch {
        throw new ErrorDeChatwoot("json", true);
      }
      const n = entero(obj(cuerpo)?.id);
      if (n === null) throw new ErrorDeChatwoot("sin_id", true);
      return n;
    },
  };
}

export type ResultadoUno = "enviado" | "fallido" | "incierto" | "omitido" | Bloqueo | Exclude<Reserva, "ok">;

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

const codigoSeguro = (c: string) => c.replace(/[^a-z0-9_:.-]/g, "_").slice(0, 64) || "error";

async function bloquear(deps: DepsEnvio, e: EnvioPorHacer, codigo: Bloqueo, bandeja: number, por: string): Promise<ResultadoUno> {
  (deps.registrar ?? ((m: string) => console.error(m)))(`[oficina-envio] no se envía (${codigo}): ${por}`);
  await deps.almacen.bloquear(e.revisionId, codigo, bandeja);
  return codigo;
}

/** El mensaje pudo haber salido: el envío se queda en «enviando», se anota y NUNCA se reintenta (M1). */
async function incierto(deps: DepsEnvio, e: EnvioPorHacer, codigo: string): Promise<ResultadoUno> {
  const registrar = deps.registrar ?? ((m: string) => console.error(m));
  registrar(`[oficina-envio] no se sabe si el mensaje llegó (${codigo}): queda «enviando» para que Sam lo revise; no se reintenta`);
  try {
    await deps.almacen.marcarIncierto(e.revisionId, codigoSeguro(codigo));
  } catch {
    // Sin el aviso igual queda «enviando», y lo «enviando» nunca vuelve a la lista de envíos por hacer.
  }
  return "incierto";
}

async function enviarUno(deps: DepsEnvio, e: EnvioPorHacer, bandeja: number): Promise<ResultadoUno> {
  const { almacen, chatwoot } = deps;
  const registrar = deps.registrar ?? ((m: string) => console.error(m));
  const conversacionId = conversacionDeReferencia(e.entidadRef);
  const borradorS = Date.parse(e.borradorCreadoEn) / 1000;
  if (conversacionId === null || !Number.isFinite(borradorS)) return "omitido";
  // 1. El texto en memoria es el que Sam aprobó. Si no, la reserva lo deja «bloqueado» (borrador_cambio).
  const huella = huellaBorrador({ tipo: "respuesta", texto: e.texto, guion: e.guion, motivo: null, prioridad: null });
  if (huella !== e.huella) {
    const r = await almacen.reservar(e.revisionId, huella, bandeja, conversacionId);
    return r === "ok" ? "omitido" : r;
  }
  // 2. La conversación: de la bandeja permitida, nadie contestó y el cliente no escribió después del borrador.
  let conv: LecturaConversacion;
  try {
    conv = await chatwoot.conversacion(conversacionId);
  } catch (err) {
    registrar(`[oficina-envio] no se pudo leer la conversación (${err instanceof ErrorDeChatwoot ? err.codigo : "error"}); se reintenta en el próximo minuto`);
    return "omitido";
  }
  if (conv.forma === "desconocida") return bloquear(deps, e, "forma_desconocida", bandeja, "Chatwoot respondió con una forma que no se reconoce");
  if (conv.bandeja !== bandeja || conv.cuenta !== deps.config.chatwoot?.cuenta) {
    return bloquear(deps, e, "otra_bandeja", bandeja, "la conversación no es de la bandeja de prueba");
  }
  if (conv.ultimaSalidaS !== null && conv.ultimaSalidaS > borradorS) {
    return bloquear(deps, e, "ya_contestada", bandeja, "alguien ya contestó después del borrador (un solo contestador)");
  }
  if (conv.ultimaEntradaS !== null && conv.ultimaEntradaS > borradorS) {
    return bloquear(deps, e, "cliente_escribio", bandeja, "el cliente escribió después del borrador");
  }
  // 3. Otra vez la pausa, la conversación aprobada, la vigencia y la huella, y la reserva (una sola vez), en la base.
  const reserva = await almacen.reservar(e.revisionId, e.huella, bandeja, conversacionId);
  if (reserva !== "ok") return reserva;
  // 4. El envío. Solo un rechazo seguro de Chatwoot es «fallido»; si pudo haber salido, «incierto» (M1).
  let mensajeId: number;
  try {
    mensajeId = await chatwoot.enviar(conversacionId, e.texto);
  } catch (err) {
    if (err instanceof ErrorDeChatwoot && !err.incierto) {
      registrar(`[oficina-envio] Chatwoot rechazó el envío (${err.codigo}); no se entregó y no se reintenta solo`);
      await almacen.cerrar(e.revisionId, "fallido", codigoSeguro(err.codigo), null);
      return "fallido";
    }
    return incierto(deps, e, err instanceof ErrorDeChatwoot ? err.codigo : "error");
  }
  // 5. Chatwoot ya lo tiene: si el cierre en la base falla, NUNCA «fallido» (reintentarlo duplicaría el mensaje).
  try {
    if (await almacen.cerrar(e.revisionId, "enviado", null, mensajeId)) return "enviado";
    return incierto(deps, e, "cierre_rechazado");
  } catch {
    return incierto(deps, e, "cierre_fallo");
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
