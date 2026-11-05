// @vitest-environment node
/**
 * Envío a Discord por webhook (SDD-0606). Cada regla del módulo se mide sobre
 * el pedido HTTP que sale, no sobre el texto del código.
 */

import { describe, it, expect, vi } from "vitest";
import {
  DISCORD_CONTENT_LIMIT,
  DISCORD_MAX_ATTEMPTS,
  DISCORD_MAX_WAIT_MS,
  isDiscordUserId,
  isDiscordWebhookUrl,
  sendDiscordWebhook,
  truncateForDiscord,
} from "../send-webhook";

const URL_OK = "https://discord.com/api/webhooks/123456789012345678/tok-EN_secreto";
const USER_A = "111111111111111111";
const USER_B = "222222222222222222";

function respuesta(status: number, body?: unknown, headers?: Record<string, string>) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers,
  });
}

/** fetch falso que responde en orden y guarda cada pedido. */
function fetchEnOrden(...responses: Array<Response | Error>) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const impl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    const next = responses.shift();
    if (!next) throw new Error("fetch llamado de más");
    if (next instanceof Error) throw next;
    return next;
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

describe("isDiscordWebhookUrl", () => {
  it("acepta las direcciones de webhook de Discord", () => {
    expect(isDiscordWebhookUrl(URL_OK)).toBe(true);
    expect(isDiscordWebhookUrl("https://discordapp.com/api/webhooks/1/abc")).toBe(true);
    expect(isDiscordWebhookUrl("https://canary.discord.com/api/v10/webhooks/1/a-b_c")).toBe(true);
  });

  it("rechaza otro host, http plano, rutas distintas y vacíos", () => {
    expect(isDiscordWebhookUrl("https://evil.example/api/webhooks/1/abc")).toBe(false);
    expect(isDiscordWebhookUrl("https://discord.com.evil.example/api/webhooks/1/abc")).toBe(false);
    expect(isDiscordWebhookUrl("http://discord.com/api/webhooks/1/abc")).toBe(false);
    expect(isDiscordWebhookUrl("https://discord.com/api/webhooks/1")).toBe(false);
    expect(isDiscordWebhookUrl("https://discord.com/api/webhooks/1/abc?wait=true")).toBe(false);
    expect(isDiscordWebhookUrl("")).toBe(false);
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
    // El par sustituto del emoji cae justo en la frontera.
    const text = "a".repeat(DISCORD_CONTENT_LIMIT - 2) + "😀" + "b".repeat(10);
    const out = truncateForDiscord(text);
    expect(out.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT);
    const sinCola = out.slice(0, -1);
    const last = sinCola.charCodeAt(sinCola.length - 1);
    expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
  });
});

describe("sendDiscordWebhook", () => {
  it("entrega con un solo pedido y sin menciones por defecto", async () => {
    const { impl, calls } = fetchEnOrden(respuesta(204));
    const res = await sendDiscordWebhook(URL_OK, "@everyone hola <@&999>", {
      fetchImpl: impl,
    });

    expect(res).toMatchObject({ ok: true, status: 204, attempts: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(URL_OK);
    // El texto viaja tal cual, pero nada en él puede sonar.
    expect(calls[0].body.allowed_mentions).toEqual({ parse: [], users: [] });
  });

  it("sólo suenan los IDs explícitos y válidos, sin repetir", async () => {
    const { impl, calls } = fetchEnOrden(respuesta(204));
    await sendDiscordWebhook(URL_OK, "aviso", {
      fetchImpl: impl,
      mentionUserIds: [USER_A, USER_A, "everyone", "123", USER_B],
    });
    expect(calls[0].body.allowed_mentions).toEqual({
      parse: [],
      users: [USER_A, USER_B],
    });
  });

  it("recorta el contenido a 2.000 caracteres antes de mandar", async () => {
    const { impl, calls } = fetchEnOrden(respuesta(204));
    await sendDiscordWebhook(URL_OK, "x".repeat(4096), { fetchImpl: impl });
    expect(String(calls[0].body.content)).toHaveLength(DISCORD_CONTENT_LIMIT);
  });

  it("ante un 429 espera lo que indica el cuerpo y reintenta", async () => {
    const { impl, calls } = fetchEnOrden(
      respuesta(429, { retry_after: 1.25, global: false }),
      respuesta(204),
    );
    const sleep = vi.fn(async () => {});
    const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl, sleep });

    expect(res).toMatchObject({ ok: true, attempts: 2 });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(1250);
    expect(calls).toHaveLength(2);
  });

  it("usa la cabecera Retry-After si el cuerpo no trae el tiempo", async () => {
    const { impl } = fetchEnOrden(
      new Response("no es json", { status: 429, headers: { "retry-after": "2" } }),
      respuesta(204),
    );
    const sleep = vi.fn(async () => {});
    const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl, sleep });
    expect(res.ok).toBe(true);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("no espera más del tope: devuelve el error sin reintentar", async () => {
    const { impl, calls } = fetchEnOrden(
      respuesta(429, { retry_after: DISCORD_MAX_WAIT_MS / 1000 + 30 }),
    );
    const sleep = vi.fn(async () => {});
    const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl, sleep });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(429);
    expect(sleep).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it("se rinde tras el máximo de intentos si Discord sigue pidiendo esperar", async () => {
    const { impl, calls } = fetchEnOrden(
      ...Array.from({ length: DISCORD_MAX_ATTEMPTS }, () =>
        respuesta(429, { retry_after: 0.1 }),
      ),
    );
    const sleep = vi.fn(async () => {});
    const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl, sleep });

    expect(res.ok).toBe(false);
    expect(res.attempts).toBe(DISCORD_MAX_ATTEMPTS);
    expect(calls).toHaveLength(DISCORD_MAX_ATTEMPTS);
    expect(sleep).toHaveBeenCalledTimes(DISCORD_MAX_ATTEMPTS - 1);
  });

  it("un 404 (webhook borrado) no se reintenta", async () => {
    const { impl, calls } = fetchEnOrden(respuesta(404, { message: "Unknown Webhook" }));
    const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl });
    expect(res).toMatchObject({ ok: false, status: 404, attempts: 1 });
    expect(calls).toHaveLength(1);
  });

  it("nunca lanza y nunca devuelve la dirección en el error", async () => {
    const { impl } = fetchEnOrden(new TypeError(`fetch failed: ${URL_OK}`));
    const res = await sendDiscordWebhook(URL_OK, "aviso", { fetchImpl: impl });
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    expect(res.error).not.toContain("tok-EN_secreto");
    expect(res.error).not.toContain("discord.com");
  });

  it("rechaza sin pedir nada una dirección inválida o un mensaje vacío", async () => {
    const { impl, calls } = fetchEnOrden();
    const mala = await sendDiscordWebhook("https://evil.example/x", "aviso", {
      fetchImpl: impl,
    });
    const vacio = await sendDiscordWebhook(URL_OK, "   ", { fetchImpl: impl });
    expect(mala.ok).toBe(false);
    expect(mala.error).not.toContain("evil.example");
    expect(vacio.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
