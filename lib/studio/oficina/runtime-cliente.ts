/**
 * SDD-0626 §3.4 (Paso 3a) · El cliente del cable hacia el runtime de la oficina (Hermes, perfil
 * `soporte-chatwoot`), por `OFICINA_RUNTIME_URL` con `OFICINA_RUNTIME_TOKEN`.
 *
 * - Solo `POST /v1/chat/completions` sin streaming, nunca `/v1/responses` (que guarda la cadena entera en el
 *   `response_store.db` de la oficina).
 * - Cada llamada lleva su propia sesión (`X-Hermes-Session-Id: cable-<run>-<intento>`) y su `Idempotency-Key`:
 *   Hermes v0.23.1 guarda cada turno del API server en su `state.db` y no se puede apagar, así que el despachador
 *   BORRA esa sesión al terminar (`borrarSesion`, `DELETE /api/sessions/<id>`). En la oficina queda además una
 *   purga diaria de las sesiones de más de 24 h (privacidad.md).
 * - Los errores llevan solo un código; ni el cuerpo ni el texto salen de aquí hacia un log.
 */
export class ErrorDelRuntime extends Error {
  readonly codigo: string;
  constructor(codigo: string) {
    super(`el runtime de la oficina no respondió (${codigo})`);
    this.name = "ErrorDelRuntime";
    this.codigo = codigo;
  }
}

export interface LlamadaAgente {
  url: string;
  token: string;
  sesionId: string;
  idempotencia: string;
  sistema: string;
  usuario: string;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}

export interface RespuestaAgente {
  contenido: string | null;
  entrada: number;
  salida: number;
  /** `proveedor/modelo` que sirvió el turno (tras un fallback, el de respaldo). */
  modelo: string | null;
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function entero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

export async function llamarAgente(o: LlamadaAgente): Promise<RespuestaAgente> {
  const f = o.fetch ?? fetch;
  let r: Response;
  try {
    r = await f(`${o.url}/v1/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${o.token}`,
        "content-type": "application/json",
        "x-hermes-session-id": o.sesionId,
        "idempotency-key": o.idempotencia,
      },
      body: JSON.stringify({
        model: "soporte-chatwoot",
        stream: false,
        messages: [
          { role: "system", content: o.sistema },
          { role: "user", content: o.usuario },
        ],
      }),
      signal: o.signal,
      cache: "no-store",
    });
  } catch (e) {
    if (o.signal?.aborted) throw e;
    throw new ErrorDelRuntime("red");
  }
  if (!r.ok) throw new ErrorDelRuntime(`http_${r.status}`);
  let cuerpo: Record<string, unknown> | null;
  try {
    cuerpo = obj(await r.json());
  } catch {
    throw new ErrorDelRuntime("json");
  }
  const eleccion = obj(Array.isArray(cuerpo?.choices) ? cuerpo.choices[0] : null);
  const mensaje = obj(eleccion?.message);
  const uso = obj(cuerpo?.usage);
  return {
    contenido: typeof mensaje?.content === "string" ? mensaje.content : null,
    entrada: entero(uso?.prompt_tokens),
    salida: entero(uso?.completion_tokens),
    modelo: modeloDeRespuesta(cuerpo),
  };
}

/**
 * Hermes v0.23.1 no dice en `/v1/chat/completions` qué modelo respondió: el campo `model` repite el alias que se
 * pidió (`soporte-chatwoot`, el nombre del agente) y no trae bloque `runtime`. Por eso el alias se descarta (null =
 * «no consta», nunca el nombre del agente). Si una versión futura trae `runtime.provider/model`, se usa.
 */
export const ALIAS_DEL_AGENTE = "soporte-chatwoot";

/**
 * Un id de proveedor o modelo: sin espacios ni texto libre, tope 100 (el CHECK de `modelo_usado`). Nunca una URL:
 * con `://` se rechaza, para que un `https://usuario:clave@host/x` no llegue a la bitácora.
 */
export function idDeModelo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= 100 && !t.includes("://") && /^[A-Za-z0-9._:@/+-]+$/.test(t) ? t : null;
}

function unir(proveedor: string | null, modelo: string | null): string | null {
  if (!modelo || modelo === ALIAS_DEL_AGENTE) return null;
  const junto = proveedor && !modelo.startsWith(`${proveedor}/`) ? `${proveedor}/${modelo}` : modelo;
  return junto.length <= 100 ? junto : modelo;
}

function modeloDeRespuesta(cuerpo: Record<string, unknown> | null): string | null {
  const runtime = obj(cuerpo?.runtime);
  return unir(idDeModelo(runtime?.provider), idDeModelo(runtime?.model) ?? idDeModelo(cuerpo?.model));
}

/**
 * SDD-0702 (hija de la 0626) · modelo real. Lee `GET /api/sessions/<id>` ANTES del borrado y devuelve solo `session.model`: Hermes
 * v0.23.1 reescribe esa columna con el modelo de la primera llamada con consumo (`hermes_state_usage.py`,
 * `first_accounted_route`), así que tras un fallback dice el de respaldo. El proveedor (`billing_provider`) no sale
 * por la API en la v0.23.1; si alguna versión lo publicara como `session.provider` o `session.billing_provider`,
 * se antepone. Del resto de la sesión (vista previa, título,
 * tokens) no se lee ni se guarda nada. Nunca lanza: null = no consta.
 */
export async function leerModeloDeSesion(o: {
  url: string;
  token: string;
  sesionId: string;
  fetch?: typeof fetch;
}): Promise<string | null> {
  const f = o.fetch ?? fetch;
  try {
    const r = await f(`${o.url}/api/sessions/${encodeURIComponent(o.sesionId)}`, {
      method: "GET",
      headers: { authorization: `Bearer ${o.token}` },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const sesion = obj(obj(await r.json())?.session);
    return unir(idDeModelo(sesion?.provider ?? sesion?.billing_provider), idDeModelo(sesion?.model));
  } catch {
    return null;
  }
}

/** Borra la sesión de la corrida en la oficina. 200 o 404 = ya no está. Nunca lanza: devuelve si quedó borrada. */
export async function borrarSesion(o: { url: string; token: string; sesionId: string; fetch?: typeof fetch }): Promise<boolean> {
  const f = o.fetch ?? fetch;
  try {
    const r = await f(`${o.url}/api/sessions/${encodeURIComponent(o.sesionId)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${o.token}` },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    return r.ok || r.status === 404;
  } catch {
    return false;
  }
}
