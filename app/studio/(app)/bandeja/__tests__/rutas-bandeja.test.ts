// @vitest-environment node
/**
 * SDD-0680, adenda 2026-11-23 · rutas `POST /studio/bandeja/sso` y
 * `POST /studio/bandeja/reconciliar`: fuera de la cola de server actions, con
 * candado de origen, sin caché y con la misma lógica que las actions.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const pedirEnlaceSso = vi.fn();
const reconciliarBandeja = vi.fn();
vi.mock("../actions", () => ({
  pedirEnlaceSso: (c?: number) => pedirEnlaceSso(c),
  reconciliarBandeja: () => reconciliarBandeja(),
}));

const { POST: postSso } = await import("../sso/route");
const { POST: postReconciliar } = await import("../reconciliar/route");
const { esMismoOrigen } = await import("../mismo-origen");

const URL_SSO = "https://studio.ejemplo.test/studio/bandeja/sso";

function pedido(url: string, cabeceras: Record<string, string>, cuerpo?: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "x-forwarded-host": "studio.ejemplo.test", "content-type": "application/json", ...cabeceras },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

beforeEach(() => {
  pedirEnlaceSso.mockReset();
  reconciliarBandeja.mockReset();
});

describe("esMismoOrigen", () => {
  it("acepta same-origin y un Origin con el mismo host (también tras Traefik)", () => {
    expect(esMismoOrigen(pedido(URL_SSO, { "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(esMismoOrigen(pedido(URL_SSO, { origin: "https://studio.ejemplo.test" }))).toBe(true);
    expect(
      esMismoOrigen(pedido(URL_SSO, { host: "web:3000", "x-forwarded-host": "studio.ejemplo.test", origin: "https://studio.ejemplo.test" })),
    ).toBe(true);
  });

  it("rechaza otro sitio, otro Origin y un Origin roto", () => {
    expect(esMismoOrigen(pedido(URL_SSO, { "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(esMismoOrigen(pedido(URL_SSO, { "sec-fetch-site": "same-site" }))).toBe(false);
    expect(esMismoOrigen(pedido(URL_SSO, { origin: "https://malo.ejemplo.test" }))).toBe(false);
    expect(esMismoOrigen(pedido(URL_SSO, { origin: "null" }))).toBe(false);
  });
});

describe("POST /studio/bandeja/sso", () => {
  it("devuelve lo de la action, con la conversación y sin caché", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: "https://chat.ejemplo.test/app/login?sso_auth_token=t" });
    const r = await postSso(pedido(URL_SSO, { "sec-fetch-site": "same-origin" }, { conversacion: 12 }));
    expect(pedirEnlaceSso).toHaveBeenCalledWith(12);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ ok: true, url: "https://chat.ejemplo.test/app/login?sso_auth_token=t" });
  });

  it("sin cuerpo o con una conversación que no es número, pide sin conversación", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: false, error: "unlinked" });
    await postSso(pedido(URL_SSO, { "sec-fetch-site": "same-origin" }));
    await postSso(pedido(URL_SSO, { "sec-fetch-site": "same-origin" }, { conversacion: "12" }));
    expect(pedirEnlaceSso.mock.calls).toEqual([[undefined], [undefined]]);
  });

  it("de otro sitio: 403 y no pide el enlace", async () => {
    const r = await postSso(pedido(URL_SSO, { "sec-fetch-site": "cross-site" }, {}));
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ ok: false, error: "denied" });
    expect(pedirEnlaceSso).not.toHaveBeenCalled();
  });
});

describe("POST /studio/bandeja/reconciliar", () => {
  it("corre la reconciliación y devuelve su resultado", async () => {
    reconciliarBandeja.mockResolvedValue({ ok: true, aplicadas: 3 });
    const r = await postReconciliar(pedido(URL_SSO, { "sec-fetch-site": "same-origin" }, {}));
    expect(await r.json()).toEqual({ ok: true, aplicadas: 3 });
  });

  it("de otro sitio: 403 y no reconcilia", async () => {
    const r = await postReconciliar(pedido(URL_SSO, { origin: "https://malo.ejemplo.test" }, {}));
    expect(r.status).toBe(403);
    expect(reconciliarBandeja).not.toHaveBeenCalled();
  });
});
