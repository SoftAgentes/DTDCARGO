/**
 * Discord · envío por aviso automático de canal (webhook) · SDD-0606.
 *
 * Un webhook de Discord sólo puede ESCRIBIR en su canal: no lee ni recibe
 * órdenes. Por eso es la pieza de los avisos del Studio; el bot conversacional
 * es otra cosa y no vive en este repositorio.
 *
 * Reglas que este módulo garantiza, cada una con su prueba:
 *
 *   1. NUNCA lanza. Devuelve `{ ok, error }`: un fallo de Discord no puede
 *      romper el alta de un cliente ni el mensaje de nadie.
 *   2. La dirección del webhook es una LLAVE: quien la tenga escribe en el
 *      canal. No aparece en ningún `error` ni en ningún log de este módulo.
 *   3. Sin menciones por defecto: `allowed_mentions.parse = []`. Un texto que
 *      traiga `@everyone` no le suena a nadie. Sólo suenan los IDs de usuario
 *      que el llamador pase explícitos en `mentionUserIds`.
 *   4. Recorte a 2.000 caracteres (el tope de Discord; Telegram admitía 4.096).
 *   5. Si Discord pide esperar (HTTP 429), se espera lo que indique y se
 *      reintenta — pero sólo si la espera es corta: esto corre dentro de
 *      pedidos de usuarios y no puede dejarlos colgados.
 *
 * Doc: https://discord.com/developers/docs/resources/webhook#execute-webhook
 */

/** Tope de Discord para `content`. */
export const DISCORD_CONTENT_LIMIT = 2000;

/** Intentos totales ante 429 (el primero más dos reintentos). */
export const DISCORD_MAX_ATTEMPTS = 3;

/**
 * Espera máxima que se acepta de un 429. Si Discord pide más, no se espera: se
 * devuelve el error y el despachador usa su respaldo.
 */
export const DISCORD_MAX_WAIT_MS = 5_000;

/** Corte de un pedido colgado: Discord caído no puede colgar un alta. */
const REQUEST_TIMEOUT_MS = 8_000;

/** `SUPPRESS_EMBEDS`: sin vista previa de enlaces. */
const FLAG_SUPPRESS_EMBEDS = 1 << 2;

/** Discord admite hasta 100 usuarios en `allowed_mentions.users`. */
const MAX_MENTIONS = 100;

/**
 * Forma de una dirección de webhook de Discord. Se valida ANTES de usarla
 * porque el valor viene de una variable del servidor: una errata no debe
 * terminar en un POST con datos a un host cualquiera.
 */
const WEBHOOK_URL_RE =
  /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/\d+\/[A-Za-z0-9_-]+$/;

/** Un ID de usuario de Discord es un snowflake: sólo dígitos, 17 a 20. */
const DISCORD_USER_ID_RE = /^\d{17,20}$/;

export function isDiscordWebhookUrl(value: string | null | undefined): boolean {
  return typeof value === "string" && WEBHOOK_URL_RE.test(value.trim());
}

export function isDiscordUserId(value: string | null | undefined): boolean {
  return typeof value === "string" && DISCORD_USER_ID_RE.test(value);
}

/**
 * Recorta a `limit` unidades sin partir un par sustituto (un emoji cortado a
 * la mitad es un carácter inválido y Discord rechaza el mensaje entero).
 * Contar unidades UTF-16 es conservador: nunca deja pasar más de `limit`
 * caracteres de los que cuenta Discord.
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

export interface DiscordSendOptions {
  /** IDs de usuario que SÍ deben sonar. Los inválidos se descartan. */
  mentionUserIds?: ReadonlyArray<string>;
  /** Inyectables para las pruebas. */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface DiscordSendResult {
  ok: boolean;
  error?: string;
  /** Estado HTTP de la última respuesta, si hubo alguna. */
  status?: number;
  /** Cuántos pedidos se hicieron (1 si no hubo que reintentar). */
  attempts: number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Cuánto pide esperar un 429, en milisegundos. Discord lo manda en el cuerpo
 * (`retry_after`, segundos con decimales) y en la cabecera `Retry-After`.
 * `null` = no lo dijo de forma legible.
 */
async function readRetryAfterMs(res: Response): Promise<number | null> {
  try {
    const body = (await res.json()) as { retry_after?: unknown };
    if (typeof body?.retry_after === "number" && Number.isFinite(body.retry_after)) {
      return Math.max(0, Math.ceil(body.retry_after * 1000));
    }
  } catch {
    // Cuerpo ausente o no JSON: se mira la cabecera.
  }
  const header = Number(res.headers.get("retry-after"));
  if (Number.isFinite(header) && header >= 0) return Math.ceil(header * 1000);
  return null;
}

export async function sendDiscordWebhook(
  webhookUrl: string,
  content: string,
  opts: DiscordSendOptions = {},
): Promise<DiscordSendResult> {
  let attempts = 0;
  try {
    if (!isDiscordWebhookUrl(webhookUrl)) {
      return { ok: false, error: "dirección de webhook de Discord inválida", attempts };
    }
    if (!content.trim()) {
      return { ok: false, error: "mensaje vacío", attempts };
    }

    const doFetch = opts.fetchImpl ?? fetch;
    const sleep = opts.sleep ?? defaultSleep;
    const users = [...new Set((opts.mentionUserIds ?? []).filter(isDiscordUserId))].slice(
      0,
      MAX_MENTIONS,
    );

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
      const res = await doFetch(webhookUrl.trim(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      lastStatus = res.status;

      if (res.ok) return { ok: true, status: res.status, attempts };

      if (res.status === 429) {
        const waitMs = await readRetryAfterMs(res);
        if (waitMs === null) {
          return {
            ok: false,
            error: "Discord pidió esperar sin decir cuánto",
            status: 429,
            attempts,
          };
        }
        if (waitMs > DISCORD_MAX_WAIT_MS) {
          return {
            ok: false,
            error: `Discord pidió esperar ${Math.ceil(waitMs / 1000)} s; no se espera tanto`,
            status: 429,
            attempts,
          };
        }
        if (attempts >= DISCORD_MAX_ATTEMPTS) break;
        await sleep(waitMs);
        continue;
      }

      // 404 = el webhook se borró; 401/403 = llave inválida; 5xx = Discord.
      // Ninguno se arregla reintentando acá: decide el despachador.
      return { ok: false, error: `Discord respondió HTTP ${res.status}`, status: res.status, attempts };
    }

    return {
      ok: false,
      error: `Discord siguió pidiendo esperar tras ${attempts} intentos`,
      status: lastStatus,
      attempts,
    };
  } catch (err) {
    // El mensaje de un error de red puede traer la URL pedida, y la URL es la
    // llave: sólo se conserva el nombre del error.
    const name = err instanceof Error ? err.name : "Error";
    return { ok: false, error: `fallo de red (${name})`, attempts };
  }
}
