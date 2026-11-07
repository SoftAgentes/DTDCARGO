/**
 * Discord · envío por aviso automático de canal (webhook) · SDD-0606.
 *
 * Un webhook de Discord sólo puede ESCRIBIR en su canal: no lee ni recibe
 * órdenes. Por eso es la pieza de los avisos del Studio; el bot conversacional
 * es otra cosa y no vive en este repositorio.
 *
 * Reglas que este módulo garantiza, cada una con su prueba:
 *
 *   1. NUNCA lanza. Devuelve `{ ok, estado, … }`: un fallo de Discord no puede
 *      romper el alta de un cliente ni el mensaje de nadie.
 *   2. La dirección del webhook es una LLAVE: quien la tenga escribe en el
 *      canal. Se valida entera antes de usarla y no aparece en ningún `error`
 *      ni en ningún log de este módulo.
 *   3. Sin menciones por defecto: `allowed_mentions.parse = []`. Sólo suenan
 *      los IDs de usuario que el llamador pase explícitos.
 *   4. Recorte a 2.000 caracteres (el tope de Discord).
 *   5. Se pide `wait=true`: Discord responde con el mensaje guardado, y sólo
 *      cuenta como entregado lo que vuelve con su ID.
 *   6. Si Discord pide esperar (HTTP 429), se espera lo que indique —con un
 *      mínimo, para no gastar los intentos de golpe— y se reintenta, pero sólo
 *      si la espera es corta: esto corre dentro de pedidos de usuarios.
 *   7. Cada resultado dice si el mensaje pudo quedar guardado (`estado`), para
 *      que quien llama no repita a ciegas un aviso que quizá ya está en el canal.
 *
 * Doc: https://discord.com/developers/docs/resources/webhook#execute-webhook
 */

/** Tope de Discord para `content`. */
export const DISCORD_CONTENT_LIMIT = 2000;

/** Intentos totales ante 429 (el primero más dos reintentos). */
export const DISCORD_MAX_ATTEMPTS = 3;

/**
 * Espera máxima que se acepta de un 429. Si Discord pide más, no se espera: se
 * devuelve `reintentable` y decide quien llama (otro canal o la cola).
 */
export const DISCORD_MAX_WAIT_MS = 5_000;

/** Espera cuando un 429 no dice cuánto (ni en el cuerpo ni en las cabeceras). */
export const DISCORD_DEFAULT_WAIT_MS = 1_000;

/** Espera mínima ante un 429, aunque Discord diga cero. */
export const DISCORD_MIN_WAIT_MS = 250;

/** Formato que Discord documenta para el User-Agent: `DiscordBot ($url, $versión)`. */
export const DISCORD_USER_AGENT = "DiscordBot (https://dtdcargo.com, 1.0)";

/** Corte de un pedido colgado: Discord caído no puede colgar un alta. */
const REQUEST_TIMEOUT_MS = 8_000;

/** `SUPPRESS_EMBEDS`: sin vista previa de enlaces. */
const FLAG_SUPPRESS_EMBEDS = 1 << 2;

/** Discord admite hasta 100 usuarios en `allowed_mentions.users`. */
const MAX_MENTIONS = 100;

const DISCORD_HOSTS: ReadonlySet<string> = new Set([
  "discord.com",
  "discordapp.com",
  "canary.discord.com",
  "ptb.discord.com",
]);

/** `/api[/vN]/webhooks/<id>/<token>`, sin nada más. */
const WEBHOOK_PATH_RE = /^\/api(?:\/v\d{1,2})?\/webhooks\/\d{17,20}\/[A-Za-z0-9_-]{20,100}$/;

/** Un ID de Discord (usuario o mensaje) es un snowflake: sólo dígitos, 17 a 20. */
const SNOWFLAKE_RE = /^\d{17,20}$/;

/**
 * Códigos de red que dicen que el pedido NO salió: no hubo conexión. Cualquier
 * otro error de red puede haber ocurrido con el mensaje ya enviado.
 */
const ERRORES_ANTES_DE_CONECTAR: ReadonlySet<string> = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
]);

/**
 * La dirección de un webhook se valida ENTERA (M4): https, uno de los hosts de
 * Discord, sin usuario, puerto, query ni fragmento, y la ruta exacta del
 * webhook. El valor viene de una variable del servidor: una errata no puede
 * terminar en un POST con datos a otro lugar.
 */
export function isDiscordWebhookUrl(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  const raw = value.trim();
  if (!raw) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  return (
    u.protocol === "https:" &&
    DISCORD_HOSTS.has(u.hostname) &&
    u.username === "" &&
    u.password === "" &&
    u.port === "" &&
    u.search === "" &&
    u.hash === "" &&
    !raw.includes("?") &&
    !raw.includes("#") &&
    WEBHOOK_PATH_RE.test(u.pathname)
  );
}

export function isDiscordUserId(value: string | null | undefined): boolean {
  return typeof value === "string" && SNOWFLAKE_RE.test(value);
}

/**
 * Recorta a `limit` unidades sin partir un par sustituto (un emoji cortado a
 * la mitad es un carácter inválido y Discord rechaza el mensaje entero).
 */
export function truncateForDiscord(
  text: string,
  limit: number = DISCORD_CONTENT_LIMIT,
): string {
  if (text.length <= limit) return text;
  let cut = text.slice(0, limit - 1);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/**
 * Qué pasó con el mensaje:
 *   - `entregado`    → Discord lo guardó y devolvió su ID.
 *   - `rechazado`    → NO se guardó y repetir en el mismo webhook no sirve
 *                      (dirección inválida, 4xx). Otro canal sí puede.
 *   - `reintentable` → NO se guardó, pero puede salir más tarde (429 largo,
 *                      5xx, no hubo conexión).
 *   - `incierto`     → pudo quedar guardado (tiempo agotado después de enviar,
 *                      conexión cortada, 2xx sin ID). No se repite a ciegas.
 */
export type DiscordDeliveryState = "entregado" | "rechazado" | "reintentable" | "incierto";

export interface DiscordSendOptions {
  /** IDs de usuario que SÍ deben sonar. Los inválidos se descartan. */
  mentionUserIds?: ReadonlyArray<string>;
  /** Inyectables para las pruebas. */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface DiscordSendResult {
  ok: boolean;
  estado: DiscordDeliveryState;
  /** ID del mensaje guardado, sólo si `entregado`. */
  messageId?: string;
  error?: string;
  /** Estado HTTP de la última respuesta, si hubo alguna. */
  status?: number;
  /** Cuántos pedidos se hicieron (1 si no hubo que reintentar). */
  attempts: number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Segundos de una cabecera, o `null` si falta, está vacía o no es un número. */
function headerSeconds(res: Response, name: string): number | null {
  const raw = res.headers.get(name);
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Cuánto esperar ante un 429, en milisegundos (M1). Discord lo manda en el
 * cuerpo (`retry_after`, segundos con decimales) y en las cabeceras
 * `Retry-After` y `X-RateLimit-Reset-After`. Sin dato legible se usa
 * `DISCORD_DEFAULT_WAIT_MS`; nunca menos que `DISCORD_MIN_WAIT_MS`.
 */
async function readRetryAfterMs(res: Response): Promise<number> {
  let seconds: number | null = null;
  try {
    const body = (await res.json()) as { retry_after?: unknown };
    if (typeof body?.retry_after === "number" && Number.isFinite(body.retry_after)) {
      seconds = Math.max(0, body.retry_after);
    }
  } catch {
    // Cuerpo ausente o no JSON: se miran las cabeceras.
  }
  seconds ??= headerSeconds(res, "retry-after") ?? headerSeconds(res, "x-ratelimit-reset-after");
  const ms = seconds === null ? DISCORD_DEFAULT_WAIT_MS : Math.ceil(seconds * 1000);
  return Math.max(ms, DISCORD_MIN_WAIT_MS);
}

/** ID del mensaje guardado, o `null` si la respuesta no lo trae bien formado. */
async function readMessageId(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { id?: unknown };
    return typeof body?.id === "string" && SNOWFLAKE_RE.test(body.id) ? body.id : null;
  } catch {
    return null;
  }
}

/** Clasifica un error de `fetch` sin mirar su mensaje, que puede traer la URL. */
function estadoDeErrorDeRed(err: unknown): { estado: DiscordDeliveryState; error: string } {
  const name = err instanceof Error ? err.name : "Error";
  if (name === "TimeoutError" || name === "AbortError") {
    return { estado: "incierto", error: `sin respuesta de Discord (${name})` };
  }
  const code = (err as { cause?: { code?: unknown } } | null)?.cause?.code;
  if (typeof code === "string" && ERRORES_ANTES_DE_CONECTAR.has(code)) {
    return { estado: "reintentable", error: `no se pudo conectar con Discord (${code})` };
  }
  return {
    estado: "incierto",
    error: `fallo de red (${typeof code === "string" ? code : name})`,
  };
}

export async function sendDiscordWebhook(
  webhookUrl: string,
  content: string,
  opts: DiscordSendOptions = {},
): Promise<DiscordSendResult> {
  let attempts = 0;
  try {
    if (!isDiscordWebhookUrl(webhookUrl)) {
      return {
        ok: false,
        estado: "rechazado",
        error: "dirección de webhook de Discord inválida",
        attempts,
      };
    }
    if (!content.trim()) {
      return { ok: false, estado: "rechazado", error: "mensaje vacío", attempts };
    }

    const doFetch = opts.fetchImpl ?? fetch;
    const sleep = opts.sleep ?? defaultSleep;
    const users = [...new Set((opts.mentionUserIds ?? []).filter(isDiscordUserId))].slice(
      0,
      MAX_MENTIONS,
    );

    const target = new URL(webhookUrl.trim());
    target.searchParams.set("wait", "true");

    const body = JSON.stringify({
      content: truncateForDiscord(content),
      // `parse: []` apaga @everyone, @here, roles y usuarios; `users` vuelve a
      // encender sólo los IDs explícitos.
      allowed_mentions: { parse: [], users },
      flags: FLAG_SUPPRESS_EMBEDS,
    });

    let lastStatus: number | undefined;
    while (attempts < DISCORD_MAX_ATTEMPTS) {
      attempts += 1;
      let res: Response;
      try {
        res = await doFetch(target.toString(), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": DISCORD_USER_AGENT,
          },
          body,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        return { ...estadoDeErrorDeRed(err), ok: false, status: lastStatus, attempts };
      }
      lastStatus = res.status;

      if (res.ok) {
        const messageId = await readMessageId(res);
        if (messageId) {
          return { ok: true, estado: "entregado", messageId, status: res.status, attempts };
        }
        return {
          ok: false,
          estado: "incierto",
          error: `Discord respondió HTTP ${res.status} sin el ID del mensaje`,
          status: res.status,
          attempts,
        };
      }

      if (res.status === 429) {
        const waitMs = await readRetryAfterMs(res);
        if (waitMs > DISCORD_MAX_WAIT_MS) {
          return {
            ok: false,
            estado: "reintentable",
            error: `Discord pidió esperar ${Math.ceil(waitMs / 1000)} s; no se espera tanto`,
            status: 429,
            attempts,
          };
        }
        if (attempts >= DISCORD_MAX_ATTEMPTS) break;
        await sleep(waitMs);
        continue;
      }

      // 5xx: Discord respondió que falló. 4xx: lo rechazó (webhook borrado,
      // llave inválida, cuerpo inválido) y repetir no lo arregla.
      return {
        ok: false,
        estado: res.status >= 500 ? "reintentable" : "rechazado",
        error: `Discord respondió HTTP ${res.status}`,
        status: res.status,
        attempts,
      };
    }

    return {
      ok: false,
      estado: "reintentable",
      error: `Discord siguió pidiendo esperar tras ${attempts} intentos`,
      status: lastStatus,
      attempts,
    };
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    return { ok: false, estado: "incierto", error: `fallo inesperado (${name})`, attempts };
  }
}
