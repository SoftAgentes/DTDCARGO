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
  const runtime = obj(cuerpo?.runtime);
  const proveedor = typeof runtime?.provider === "string" ? runtime.provider : null;
  const modelo = typeof runtime?.model === "string" ? runtime.model : typeof cuerpo?.model === "string" ? cuerpo.model : null;
  return {
    contenido: typeof mensaje?.content === "string" ? mensaje.content : null,
    entrada: entero(uso?.prompt_tokens),
    salida: entero(uso?.completion_tokens),
    modelo: modelo ? (proveedor ? `${proveedor}/${modelo}` : modelo).slice(0, 100) : null,
  };
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
