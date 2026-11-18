/**
 * SDD-0626 §3.4 (Paso 3a) · Lee una conversación de Chatwoot para el despachador: SOLO LECTURA, SOLO la bandeja
 * de prueba, SOLO lo necesario y EN MEMORIA.
 *
 * - Solo `GET`. Nunca envía, nunca marca nada, nunca cambia estados (D1: el envío es del ERP en el Paso 3b).
 * - Primero lee la conversación y comprueba que es de la cuenta y de la bandeja permitidas; si no, para
 *   (`bandeja_ajena`) sin leer un solo mensaje.
 * - De cada mensaje se queda con el rol (cliente o agente) y el texto, nada más: ni nombres, ni correos, ni
 *   teléfonos del remitente, ni adjuntos. Sin notas internas ni actividad. Los últimos 20, hasta 2000
 *   caracteres cada uno.
 * - El resultado vive en memoria: lo usa la corrida y se pierde. Nunca se guarda ni se registra. Los errores
 *   solo llevan un código (`ErrorDeLectura`).
 */
export interface MensajeLeido {
  rol: "cliente" | "agente";
  texto: string;
}

export const MENSAJES_MAXIMOS = 20;
export const CARACTERES_POR_MENSAJE = 2000;

export class ErrorDeLectura extends Error {
  readonly codigo: string;
  constructor(codigo: string) {
    super(`no se pudo leer la conversación (${codigo})`);
    this.name = "ErrorDeLectura";
    this.codigo = codigo;
  }
}

export interface OpcionesLectura {
  url: string;
  token: string;
  cuenta: number;
  bandeja: number;
  conversacionId: number;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}

/** `chatwoot:conversations/<id>/messages/<id>` (el `payload_ref` del webhook) → el id de la conversación. */
export function conversacionDeReferencia(ref: string | null | undefined): number | null {
  const m = /^chatwoot:conversations\/([1-9][0-9]{0,11})\/messages\/[1-9][0-9]{0,15}$/.exec(ref ?? "");
  return m ? Number(m[1]) : null;
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

async function pedir(o: OpcionesLectura, ruta: string): Promise<unknown> {
  const f = o.fetch ?? fetch;
  let r: Response;
  try {
    r = await f(`${o.url}/api/v1/accounts/${o.cuenta}${ruta}`, {
      method: "GET",
      headers: { api_access_token: o.token, accept: "application/json" },
      signal: o.signal,
      cache: "no-store",
    });
  } catch (e) {
    if (o.signal?.aborted) throw e;
    throw new ErrorDeLectura("red");
  }
  if (!r.ok) throw new ErrorDeLectura(`http_${r.status}`);
  try {
    return await r.json();
  } catch {
    throw new ErrorDeLectura("json");
  }
}

export async function leerConversacion(o: OpcionesLectura): Promise<MensajeLeido[]> {
  const conv = obj(await pedir(o, `/conversations/${o.conversacionId}`));
  if (!conv) throw new ErrorDeLectura("conversacion");
  const inbox = Number(conv.inbox_id);
  const cuenta = conv.account_id === undefined ? o.cuenta : Number(conv.account_id);
  if (inbox !== o.bandeja || cuenta !== o.cuenta) throw new ErrorDeLectura("bandeja_ajena");

  const cuerpo = obj(await pedir(o, `/conversations/${o.conversacionId}/messages`));
  const lista = Array.isArray(cuerpo?.payload) ? (cuerpo.payload as unknown[]) : [];
  const mensajes = lista
    .map(obj)
    .filter((m): m is Record<string, unknown> => m !== null)
    .filter((m) => m.private !== true && (m.message_type === 0 || m.message_type === 1))
    .filter((m) => typeof m.content === "string" && m.content.trim() !== "")
    .sort((a, b) => Number(a.created_at ?? 0) - Number(b.created_at ?? 0) || Number(a.id ?? 0) - Number(b.id ?? 0))
    .slice(-MENSAJES_MAXIMOS)
    .map<MensajeLeido>((m) => ({
      rol: m.message_type === 0 ? "cliente" : "agente",
      texto: (m.content as string).trim().slice(0, CARACTERES_POR_MENSAJE),
    }));
  return mensajes;
}
