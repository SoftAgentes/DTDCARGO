// @vitest-environment node
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { Socket } from "node:net";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBcvObservation } from "../bcv-source";
import { BCV_MAX_BYTES, BCV_URL, BcvError } from "../bcv-types";

const html = readFileSync(new URL("./fixtures/bcv-usd-20261021.html", import.meta.url), "utf8");
const ok = () => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
afterEach(() => vi.useRealTimers());

describe("B4 · fuente HTTPS constante y presupuesto", () => {
  it("una obtención sin secretos/cache, con hash del cuerpo", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(ok());
    const result = await fetchBcvObservation({ fetch, signal: new AbortController().signal,
      now: () => new Date("2026-10-21T07:00:00Z") });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(BCV_URL);
    expect(init).toMatchObject({ method: "GET", redirect: "manual", cache: "no-store", credentials: "omit" });
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
    expect(new Headers(init?.headers).has("cookie")).toBe(false);
    expect(result).toMatchObject({ quote: { rate: "883.39630000", validOn: "2026-10-21" },
      retrievedAt: "2026-10-21T07:00:00.000Z" });
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it.each(["https://bcv.org.ve/", "https://other.invalid/", "http://www.bcv.org.ve/",
    "https://u:p@www.bcv.org.ve/", "https://www.bcv.org.ve:444/", "/otra", "/?dato=1", "/#otra"])("rechaza redirect %s", async (location) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 302, headers: { location } }));
    await expect(fetchBcvObservation({ fetch, signal: new AbortController().signal })).rejects.toMatchObject({ reason: "SOURCE_REDIRECT_REJECTED" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("admite hasta dos redirects canónicos y rechaza el tercero", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => new Response(null,
      { status: 302, headers: { location: BCV_URL } }));
    await expect(fetchBcvObservation({ fetch, signal: new AbortController().signal })).rejects.toMatchObject({ reason: "SOURCE_REDIRECT_REJECTED" });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it.each([1, 2])("acepta 200 final después de %s redirects canónicos", async (redirects) => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    for (let index = 0; index < redirects; index++) {
      fetch.mockResolvedValueOnce(new Response(null, { status: index === 0 ? 301 : 308, headers: { location: BCV_URL } }));
    }
    fetch.mockResolvedValueOnce(ok());
    const result = await fetchBcvObservation({ fetch, signal: new AbortController().signal });
    expect(result.quote.rate).toBe("883.39630000");
    expect(fetch).toHaveBeenCalledTimes(redirects + 1);
    expect(fetch.mock.calls.every(([url, init]) => url === BCV_URL && init?.redirect === "manual")).toBe(true);
  });
  it.each([204, 304, 404, 503])("no usa respuesta %s como fuente", async (status) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status }));
    await expect(fetchBcvObservation({ fetch, signal: new AbortController().signal })).rejects.toMatchObject({ reason: "SOURCE_UNAVAILABLE" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rechaza tipo/HTML inválido y nunca reutiliza la última cotización", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("{}", { headers: { "content-type": "application/json" } }));
    await expect(fetchBcvObservation({ fetch, signal: new AbortController().signal })).rejects.toMatchObject({ reason: "SOURCE_UNAVAILABLE" });
    fetch.mockResolvedValue(new Response("CAPTCHA", { headers: { "content-type": "text/html" } }));
    await expect(fetchBcvObservation({ fetch, signal: new AbortController().signal })).rejects.toMatchObject({ reason: "SOURCE_INVALID" });
  });
  it("mide bytes reales sin confiar en longitud falsa", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(BCV_MAX_BYTES + 1)); }, cancel });
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(stream,
      { headers: { "content-type": "text/html", "content-length": "1" } }));
    await expect(fetchBcvObservation({ fetch, signal: new AbortController().signal })).rejects.toMatchObject({ reason: "SOURCE_TOO_LARGE" });
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("20s incluye stream lento y termina la promesa/reader", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(new ReadableStream({ cancel }),
      { headers: { "content-type": "text/html" } }));
    const pending = fetchBcvObservation({ fetch, signal: new AbortController().signal });
    const rejected = expect(pending).rejects.toMatchObject({ reason: "SOURCE_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(20_000);
    await rejected;
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("el deadline padre cancela antes y no reinicia el presupuesto", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetch = vi.fn<typeof globalThis.fetch>();
    await expect(fetchBcvObservation({ fetch, signal: controller.signal })).rejects.toMatchObject({ reason: "DEADLINE" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("abort del padre durante body cancela el reader y conserva DEADLINE", async () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    const cancel = vi.fn();
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(new ReadableStream({ cancel }),
      { headers: { "content-type": "text/html" } }));
    const pending = fetchBcvObservation({ fetch, signal: parent.signal });
    const rejected = expect(pending).rejects.toMatchObject({ reason: "DEADLINE" });
    setTimeout(() => parent.abort(), 1_000);
    await vi.advanceTimersByTimeAsync(1_001);
    await rejected;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["length-invalid", "length-large", "body-large", "slow-body", "parent-abort",
    "redirect-allowed", "redirect-rejected", "status", "type"])("F03 · cancel diferido queda dentro del presupuesto: %s", async (mode) => {
    vi.useFakeTimers();
    const release = deferred();
    const parent = new AbortController();
    const cancel = vi.fn(() => release.promise);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { if (mode === "body-large") controller.enqueue(new Uint8Array(BCV_MAX_BYTES + 1)); }, cancel,
    });
    const headers: Record<string, string> = { "content-type": mode === "type" ? "application/json" : "text/html" };
    if (mode === "length-invalid") headers["content-length"] = "invalid";
    if (mode === "length-large") headers["content-length"] = String(BCV_MAX_BYTES + 1);
    if (mode.startsWith("redirect")) headers.location = mode === "redirect-allowed" ? BCV_URL : "https://other.invalid/";
    const status = mode.startsWith("redirect") ? 302 : mode === "status" ? 503 : 200;
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(stream, { headers, status }));
    let observed: { kind: "resolved" | "rejected"; reason?: string } | undefined;
    const task = fetchBcvObservation({ fetch, signal: parent.signal }).then(
      () => { observed = { kind: "resolved" }; },
      error => { observed = { kind: "rejected", reason: error instanceof BcvError ? error.reason : "UNEXPECTED" }; },
    );
    const budget = mode === "parent-abort" ? 5_000 : 20_000;
    if (mode === "parent-abort") setTimeout(() => parent.abort(), budget);
    let requestsAtBudget: number | undefined;
    try {
      await vi.advanceTimersByTimeAsync(budget + 1);
      requestsAtBudget = fetch.mock.calls.length;
      expect(observed, "la operación debe asentarse aunque el productor no confirme cancel").toMatchObject({ kind: "rejected" });
      expect(["DEADLINE", "SOURCE_TIMEOUT", "SOURCE_TOO_LARGE", "SOURCE_REDIRECT_REJECTED", "SOURCE_UNAVAILABLE"])
        .toContain(observed?.reason);
      expect(cancel).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(fetch).toHaveBeenCalledTimes(requestsAtBudget);
    } finally {
      // Liberar y esperar tareas del propio doble incluso cuando el oráculo sea ROJO.
      // No atribuye una demora a Undici real ni promete terminación física remota.
      release.release();
      await release.promise; await task;
      if (requestsAtBudget !== undefined) expect(fetch).toHaveBeenCalledTimes(requestsAtBudget);
      expect(vi.getTimerCount()).toBe(0);
    }
  });
  it("20 s se acumulan entre headers y body; no empieza otro presupuesto al recibir headers", async () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    let bodyTimer: ReturnType<typeof setTimeout> | undefined;
    const cancel = vi.fn(() => { if (bodyTimer !== undefined) clearTimeout(bodyTimer); });
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(() => new Promise<Response>(resolve => {
      setTimeout(() => resolve(new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          bodyTimer = setTimeout(() => { controller.enqueue(new TextEncoder().encode(html)); controller.close(); }, 3_000);
        }, cancel,
      }), { headers: { "content-type": "text/html" } })), 18_000);
    }));
    let observed: string | undefined;
    const task = fetchBcvObservation({ fetch, signal: parent.signal }).then(
      () => { observed = "RESOLVED"; }, error => { observed = error instanceof BcvError ? error.reason : "UNEXPECTED"; },
    );
    try {
      await vi.advanceTimersByTimeAsync(19_999);
      expect(observed).toBeUndefined();
      await vi.advanceTimersByTimeAsync(2);
      expect(observed).toBe("SOURCE_TIMEOUT");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(cancel).toHaveBeenCalledTimes(1);
    } finally {
      parent.abort();
      if (bodyTimer !== undefined) clearTimeout(bodyTimer);
      await task;
      expect(vi.getTimerCount()).toBe(0);
    }
  });
  it("stream fallido y UTF8 inválido nunca producen candidata", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(new ReadableStream({
      start(controller) { controller.error(new Error("stream sintético fallido")); },
    }), { headers: { "content-type": "text/html" } }));
    await expect(fetchBcvObservation({ fetch, signal: new AbortController().signal }))
      .rejects.toMatchObject({ reason: "SOURCE_UNAVAILABLE" });
    fetch.mockResolvedValue(new Response(new Uint8Array([0xc3, 0x28]), { headers: { "content-type": "text/html" } }));
    await expect(fetchBcvObservation({ fetch, signal: new AbortController().signal }))
      .rejects.toMatchObject({ reason: "SOURCE_INVALID" });
  });
  it("fetch nativo descomprime gzip y rechaza más de 1 MiB real en fixture HTTP loopback", async () => {
    const compressed = gzipSync(Buffer.alloc(BCV_MAX_BYTES + 1, 0x20));
    expect(compressed.byteLength).toBeLessThan(BCV_MAX_BYTES);
    const sockets = new Set<Socket>();
    let requests = 0;
    const server = createServer((_request, response) => {
      requests++;
      response.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip", "content-length": compressed.byteLength });
      response.end(compressed);
    });
    server.on("connection", socket => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
    await new Promise<void>((done, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", () => done()); });
    const nativeFetch = globalThis.fetch;
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("FIXTURE_ADDRESS_UNAVAILABLE");
      const endpoint = `http://127.0.0.1:${address.port}`;
      const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (input, init) => {
        expect(input).toBe(BCV_URL); // Sólo se sustituye el transporte de la fixture, no la URL productiva.
        return nativeFetch(endpoint, init);
      });
      await expect(fetchBcvObservation({ fetch, signal: AbortSignal.timeout(5_000) }))
        .rejects.toMatchObject({ reason: "SOURCE_TOO_LARGE" });
      expect(requests).toBe(1); expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      const stopped = new Promise<void>((done, fail) => server.close(error => error ? fail(error) : done()));
      const closed = [...sockets].map(socket => new Promise<void>(done => socket.once("close", () => done())));
      server.closeAllConnections();
      for (const socket of sockets) socket.destroy();
      await Promise.all([stopped, ...closed]);
      expect(server.listening).toBe(false); expect(sockets.size).toBe(0);
    }
  });
});
