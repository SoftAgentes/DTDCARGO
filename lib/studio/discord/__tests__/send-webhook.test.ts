// @vitest-environment node
/**
 * Envío a Discord por webhook (SDD-0606). Cada regla del módulo se mide sobre
 * el pedido HTTP que sale y la respuesta que vuelve, no sobre el texto del código.
 *
 * Correcciones de la revisión de Codex (2026-11-05), cada una con su caso:
 *   A3 · se pide `wait=true` y sólo cuenta como entregado lo que vuelve con el
 *        ID del mensaje;
 *   M1 · una espera de 429 sin dato o en cero no gasta los intentos de golpe;
 *   M2 · «rechazado» (no se guardó) se distingue de «incierto» (pudo guardarse);
 *   M4 · User-Agent con el formato de Discord y la URL validada entera.
 */

import { describe, it, expect, vi } from "vitest";
import {
  DISCORD_CONTENT_LIMIT,
  DISCORD_DEFAULT_WAIT_MS,
  DISCORD_MAX_ATTEMPTS,
  DISCORD_MAX_WAIT_MS,
  DISCORD_MIN_WAIT_MS,
  DISCORD_USER_AGENT,
  isDiscordUserId,
  isDiscordWebhookUrl,
  sendDiscordWebhook,
  truncateForDiscord,
} from "../send-webhook";
import { fakeWebhook } from "./webhook-fixture";

const URL_OK = fakeWebhook(1);
const TOKEN = URL_OK.split("/").pop() as string;
const USER_A = "111111111111111111";
const USER_B = "222222222222222222";
const MSG_ID = "1300000000000000001";

function respuesta(status: number, body?: unknown, headers?: Record<string, string>) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers,
  });
}

/** Lo que Discord devuelve con `wait=true`: el mensaje guardado. */
const guardado = () => respuesta(200, { id: MSG_ID, channel_id: "1567954867878629406" });

/** fetch falso que responde en orden y guarda cada pedido. */
function fetchEnOrden(...responses: Array<Response | Error>) {
  const calls: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = [];
  const impl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(url),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    });
    const next = responses.shift();
    if (!next) throw new Error("fetch llamado de más");
    if (next instanceof Error) throw next;
    return next;
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

/** Error de fetch de Node con su causa, como lo arma undici. */
function errorDeRed(code: string): TypeError {
  const err = new TypeError("fetch failed");
  (err as TypeError & { cause: unknown }).cause = Object.assign(new Error(code), { code });
  return err;
}

describe("isDiscordWebhookUrl (M4: la URL entera)", () => {
  it("acepta las direcciones de webhook de Discord", () => {
    expect(isDiscordWebhookUrl(URL_OK)).toBe(true);
    expect(isDiscordWebhookUrl(URL_OK.replace("discord.com", "discordapp.com"))).toBe(true);
    expect(isDiscordWebhookUrl(URL_OK.replace("discord.com/api", "canary.discord.com/api/v10"))).toBe(
      true,
    );
  });

  it.each([
    ["otro host", URL_OK.replace("discord.com", "evil.example")],
    ["host parecido", URL_OK.replace("discord.com", "discord.com.evil.example")],
    ["http plano", URL_OK.replace("https:", "http:")],
    ["con usuario", URL_OK.replace("https://", "https://user:pw@")],
    ["con puerto", URL_OK.replace("discord.com", "discord.com:8443")],
    ["con query", `${URL_OK}?wait=false`],
    ["con fragmento", `${URL_OK}#x`],
    ["barra al final", `${URL_OK}/`],
    ["con /slack", `${URL_OK}/slack`],
    ["id corto", "https://discord.com/api/webhooks/1/" + TOKEN],
    ["sin token", "https://discord.com/api/webhooks/123456789012345678"],
    ["token corto", "https://discord.com/api/webhooks/123456789012345678/abc"],
    ["vacío", ""],
  ])("rechaza %s", (_caso, url) => {
    expect(isDiscordWebhookUrl(url)).toBe(false);
  });

  it("rechaza null", () => {
    expect(isDiscordWebhookUrl(null)).toBe(false);
  });
});

describe("isDiscordUserId", () => {
  it("sólo dígitos, de 17 a 20", () => {
    expect(isDiscordUserId(USER_A)).toBe(true);
    expect(isDiscordUserId("1234")).toBe(false);
    expect(isDiscordUserId("11111111111111111a")).toBe(false);
    expect(isDiscordUserId("everyone")).toBe(false);
    expect(isDiscordUserId(null)).toBe(false);
  });
});

describe("truncateForDiscord", () => {
  it("no toca un texto que cabe", () => {
    expect(truncateForDiscord("hola")).toBe("hola");
    expect(truncateForDiscord("a".repeat(DISCORD_CONTENT_LIMIT))).toHaveLength(
      DISCORD_CONTENT_LIMIT,
    );
  });

  it("recorta a 2.000 y termina en puntos suspensivos", () => {
    const out = truncateForDiscord("a".repeat(DISCORD_CONTENT_LIMIT + 500));
    expect(out).toHaveLength(DISCORD_CONTENT_LIMIT);
    expect(out.endsWith("…")).toBe(true);
  });

  it("no parte un emoji en el corte", () => {
    const text = "a".repeat(DISCORD_CONTENT_LIMIT - 2) + "😀" + "b".repeat(10);
    const out = truncateForDiscord(text);
    expect(out.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT);
    const sinCola = out.slice(0, -1);
    const last = sinCola.charCodeAt(sinCola.length - 1);
    expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
  });
});

describe("sendDiscordWebhook", () => {
  it("A3: pide wait=true y devuelve el ID del mensaje guardado", async () => {
    const { impl, calls } = fetchEnOrden(guardado());
    const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl });

    expect(res).toMatchObject({ ok: true, estado: "entregado", messageId: MSG_ID, attempts: 1 });
    const pedido = new URL(calls[0].url);
    expect(`${pedido.origin}${pedido.pathname}`).toBe(URL_OK);
    expect(pedido.searchParams.get("wait")).toBe("true");
  });

  it("A3: un 2xx sin ID de mensaje no es una entrega confirmada", async () => {
    const { impl } = fetchEnOrden(respuesta(204));
    const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl });
    expect(res.ok).toBe(false);
    expect(res.estado).toBe("incierto");
  });

  it("A3: un 200 con un ID que no es un snowflake tampoco", async () => {
    const { impl } = fetchEnOrden(respuesta(200, { id: "abc" }));
    const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl });
    expect(res).toMatchObject({ ok: false, estado: "incierto" });
  });

  it("M4: manda el User-Agent con el formato que pide Discord", async () => {
    const { impl, calls } = fetchEnOrden(guardado());
    await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl });
    expect(DISCORD_USER_AGENT).toBe("DiscordBot (https://dtdcargo.com, 1.0)");
    expect(calls[0].headers.get("user-agent")).toBe(DISCORD_USER_AGENT);
  });

  it("sin menciones por defecto", async () => {
    const { impl, calls } = fetchEnOrden(guardado());
    await sendDiscordWebhook(URL_OK, "@everyone hola <@&999>", { fetchImpl: impl });
    expect(calls[0].body.allowed_mentions).toEqual({ parse: [], users: [] });
  });

  it("sólo suenan los IDs explícitos y válidos, sin repetir", async () => {
    const { impl, calls } = fetchEnOrden(guardado());
    await sendDiscordWebhook(URL_OK, "aviso", {
      fetchImpl: impl,
      mentionUserIds: [USER_A, USER_A, "everyone", "123", USER_B],
    });
    expect(calls[0].body.allowed_mentions).toEqual({ parse: [], users: [USER_A, USER_B] });
  });

  it("recorta el contenido a 2.000 caracteres antes de mandar", async () => {
    const { impl, calls } = fetchEnOrden(guardado());
    await sendDiscordWebhook(URL_OK, "x".repeat(4096), { fetchImpl: impl });
    expect(String(calls[0].body.content)).toHaveLength(DISCORD_CONTENT_LIMIT);
  });

  it("ante un 429 espera lo que indica el cuerpo y reintenta", async () => {
    const { impl, calls } = fetchEnOrden(respuesta(429, { retry_after: 1.25 }), guardado());
    const sleep = vi.fn(async () => {});
    const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl, sleep });

    expect(res).toMatchObject({ ok: true, estado: "entregado", attempts: 2 });
    expect(sleep).toHaveBeenCalledWith(1250);
    expect(calls).toHaveLength(2);
  });

  it("usa la cabecera Retry-After si el cuerpo no trae el tiempo", async () => {
    const { impl } = fetchEnOrden(
      new Response("no es json", { status: 429, headers: { "retry-after": "2" } }),
      guardado(),
    );
    const sleep = vi.fn(async () => {});
    const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl, sleep });
    expect(res.ok).toBe(true);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("M1: un 429 sin cuerpo ni cabecera espera el tiempo por defecto, no cero", async () => {
    const { impl } = fetchEnOrden(respuesta(429), guardado());
    const sleep = vi.fn(async () => {});
    const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl, sleep });

    expect(res.ok).toBe(true);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(DISCORD_DEFAULT_WAIT_MS);
  });

  it("M1: una espera en cero se sube al mínimo; los intentos no se gastan de golpe", async () => {
    const { impl } = fetchEnOrden(
      respuesta(429, { retry_after: 0 }),
      new Response(null, { status: 429, headers: { "retry-after": "0" } }),
      guardado(),
    );
    const sleep = vi.fn(async () => {});
    const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl, sleep });

    expect(res.ok).toBe(true);
    expect(sleep.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      DISCORD_MIN_WAIT_MS,
      DISCORD_MIN_WAIT_MS,
    ]);
  });

  it("no espera más del tope: no guardado, reintentable, sin reintentar acá", async () => {
    const { impl, calls } = fetchEnOrden(
      respuesta(429, { retry_after: DISCORD_MAX_WAIT_MS / 1000 + 30 }),
    );
    const sleep = vi.fn(async () => {});
    const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl, sleep });

    expect(res).toMatchObject({ ok: false, estado: "reintentable", status: 429 });
    expect(sleep).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it("se rinde tras el máximo de intentos si Discord sigue pidiendo esperar", async () => {
    const { impl, calls } = fetchEnOrden(
      ...Array.from({ length: DISCORD_MAX_ATTEMPTS }, () => respuesta(429, { retry_after: 0.3 })),
    );
    const sleep = vi.fn(async () => {});
    const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl, sleep });

    expect(res).toMatchObject({ ok: false, estado: "reintentable", attempts: DISCORD_MAX_ATTEMPTS });
    expect(calls).toHaveLength(DISCORD_MAX_ATTEMPTS);
    expect(sleep).toHaveBeenCalledTimes(DISCORD_MAX_ATTEMPTS - 1);
  });

  it("M2: un 404 (webhook borrado) es rechazado: no se guardó y no se reintenta", async () => {
    const { impl, calls } = fetchEnOrden(respuesta(404, { message: "Unknown Webhook" }));
    const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl });
    expect(res).toMatchObject({ ok: false, estado: "rechazado", status: 404, attempts: 1 });
    expect(calls).toHaveLength(1);
  });

  it("M2: un 5xx es reintentable (Discord respondió que falló)", async () => {
    const { impl } = fetchEnOrden(respuesta(503));
    const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl });
    expect(res).toMatchObject({ ok: false, estado: "reintentable", status: 503 });
  });

  it("M2: si no llegó a conectar (DNS, conexión rechazada) es reintentable", async () => {
    for (const code of ["ENOTFOUND", "ECONNREFUSED", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"]) {
      const { impl } = fetchEnOrden(errorDeRed(code));
      const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl });
      expect(res.estado, code).toBe("reintentable");
    }
  });

  it("M2: si se cortó después de enviar (tiempo agotado, conexión reiniciada) es incierto", async () => {
    const timeout = new DOMException("The operation timed out.", "TimeoutError");
    for (const err of [timeout, errorDeRed("ECONNRESET"), errorDeRed("UND_ERR_SOCKET")]) {
      const { impl } = fetchEnOrden(err as Error);
      const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl });
      expect(res.estado).toBe("incierto");
    }
  });

  it("nunca lanza y nunca devuelve la dirección en el error", async () => {
    const { impl } = fetchEnOrden(new TypeError(`fetch failed: ${URL_OK}`));
    const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl });
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    expect(res.error).not.toContain(TOKEN);
    expect(res.error).not.toContain("discord.com");
  });

  it("rechaza sin pedir nada una dirección inválida o un mensaje vacío", async () => {
    const { impl, calls } = fetchEnOrden();
    const mala = await sendDiscordWebhook("https://evil.example/x", "aviso", { fetchImpl: impl });
    const vacio = await sendDiscordWebhook(URL_OK, "   ", { fetchImpl: impl });
    expect(mala).toMatchObject({ ok: false, estado: "rechazado" });
    expect(mala.error).not.toContain("evil.example");
    expect(vacio).toMatchObject({ ok: false, estado: "rechazado" });
    expect(calls).toHaveLength(0);
  });
});
