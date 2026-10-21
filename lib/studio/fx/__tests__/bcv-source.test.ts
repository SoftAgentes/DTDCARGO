// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBcvObservation } from "../bcv-source";
import { BCV_MAX_BYTES, BCV_URL } from "../bcv-types";

const html = readFileSync(new URL("./fixtures/bcv-usd-20261021.html", import.meta.url), "utf8");
const ok = () => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
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
});
