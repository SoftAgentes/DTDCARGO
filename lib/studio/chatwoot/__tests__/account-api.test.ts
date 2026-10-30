// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contarEnviadosWhatsapp, listarConversacionesRecientes, obtenerConversacion } from "../account-api";
import { obtenerTokenAgente } from "../platform-api";
import type { ChatwootConfig } from "../config";
import { TEXTO_SINTETICO, conversacionSintetica } from "./webhook-fixtures";

const CFG: ChatwootConfig = { origin: "https://chat.ejemplo.test", token: "tok-plataforma", accountId: 1 };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch");
});
afterEach(() => fetchSpy.mockRestore());

describe("listarConversacionesRecientes (SDD-0585)", () => {
  it("pide con el token DEL AGENTE y devuelve solo lo mínimo", async () => {
    fetchSpy.mockResolvedValueOnce(json({ data: { meta: {}, payload: [conversacionSintetica()] } }));
    const r = await listarConversacionesRecientes(CFG, "tok-agente");
    expect(r.ok).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://chat.ejemplo.test/api/v1/accounts/1/conversations?status=all&assignee_type=all&page=1");
    expect((init.headers as Record<string, string>).api_access_token).toBe("tok-agente");
    expect(JSON.stringify(r)).not.toContain(TEXTO_SINTETICO);
    if (r.ok) expect(r.data).toHaveLength(1);
  });

  it("sigue a la página siguiente solo si la actual vino llena, hasta el tope", async () => {
    const llena = Array.from({ length: 25 }, (_, i) => conversacionSintetica({ id: i + 1 }));
    fetchSpy.mockResolvedValue(json({ data: { payload: llena } }));
    const r = await listarConversacionesRecientes(CFG, "tok", 2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    if (r.ok) expect(r.data).toHaveLength(50);
  });

  it("401 → no_autorizado; red caída → red; forma rara → respuesta_invalida", async () => {
    fetchSpy.mockResolvedValueOnce(json({}, 401));
    expect(await listarConversacionesRecientes(CFG, "tok")).toEqual({ ok: false, error: "no_autorizado" });
    fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await listarConversacionesRecientes(CFG, "tok")).toEqual({ ok: false, error: "red" });
    fetchSpy.mockResolvedValueOnce(json({ data: {} }));
    expect(await listarConversacionesRecientes(CFG, "tok")).toEqual({ ok: false, error: "respuesta_invalida" });
  });
});

describe("obtenerTokenAgente (SDD-0585)", () => {
  it("devuelve el token del agente pedido; un id distinto es respuesta_invalida", async () => {
    fetchSpy.mockResolvedValueOnce(json({ id: 7, access_token: "tok-agente" }));
    expect(await obtenerTokenAgente(7, CFG)).toEqual({ ok: true, data: "tok-agente" });
    fetchSpy.mockResolvedValueOnce(json({ id: 8, access_token: "tok-otro" }));
    expect(await obtenerTokenAgente(7, CFG)).toEqual({ ok: false, error: "respuesta_invalida" });
  });

  it("sin configuración no llama a la red", async () => {
    expect(await obtenerTokenAgente(7, null)).toEqual({ ok: false, error: "sin_configurar" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("obtenerConversacion (SDD-0585, 2.4, E2-D30)", () => {
  it("pide UNA conversación con el token del agente y devuelve solo lo mínimo", async () => {
    fetchSpy.mockResolvedValueOnce(json(conversacionSintetica({ id: 42 })));
    const r = await obtenerConversacion(CFG, "tok-agente", 42);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://chat.ejemplo.test/api/v1/accounts/1/conversations/42");
    expect((init.headers as Record<string, string>).api_access_token).toBe("tok-agente");
    expect(init.redirect).toBe("error");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.id).toBe(42);
    expect(JSON.stringify(r)).not.toContain(TEXTO_SINTETICO);
  });

  it("Chatwoot no se la muestra a ese agente (401, 403 o 404): no_autorizado o no_encontrado", async () => {
    fetchSpy.mockResolvedValueOnce(json({}, 401));
    expect(await obtenerConversacion(CFG, "tok", 42)).toEqual({ ok: false, error: "no_autorizado" });
    fetchSpy.mockResolvedValueOnce(json({}, 403));
    expect(await obtenerConversacion(CFG, "tok", 42)).toEqual({ ok: false, error: "no_autorizado" });
    fetchSpy.mockResolvedValueOnce(json({}, 404));
    expect(await obtenerConversacion(CFG, "tok", 42)).toEqual({ ok: false, error: "no_encontrado" });
  });

  it("una conversación con otro id del que se pidió es respuesta_invalida", async () => {
    fetchSpy.mockResolvedValueOnce(json(conversacionSintetica({ id: 43 })));
    expect(await obtenerConversacion(CFG, "tok", 42)).toEqual({ ok: false, error: "respuesta_invalida" });
  });

  it("red caída → red; forma rara → respuesta_invalida", async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await obtenerConversacion(CFG, "tok", 42)).toEqual({ ok: false, error: "red" });
    fetchSpy.mockResolvedValueOnce(json({ hola: 1 }));
    expect(await obtenerConversacion(CFG, "tok", 42)).toEqual({ ok: false, error: "respuesta_invalida" });
  });
});

describe("contarEnviadosWhatsapp (SDD-0585, 2.8)", () => {
  const msg = (id: number, extra: Record<string, unknown> = {}) => ({
    id,
    message_type: 1,
    private: false,
    source_id: `wamid.sintetico${id}`,
    content: TEXTO_SINTETICO,
    ...extra,
  });
  const pagina = (payload: unknown[], telefono: string | null = "+584125550101") =>
    json({ meta: { contact: { phone_number: telefono, name: "Contacto Sintético" } }, payload });

  it("cuenta solo los salientes entregados por WhatsApp: ni entrantes, ni notas, ni fallidos, ni otros canales", async () => {
    fetchSpy.mockResolvedValueOnce(
      pagina([
        msg(1),
        msg(2),
        msg(3, { message_type: 0 }),
        msg(4, { private: true }),
        msg(5, { source_id: null }),
        msg(6, { source_id: "web-123" }),
        msg(7, { message_type: 2 }),
      ]),
    );
    const r = await contarEnviadosWhatsapp(CFG, "tok-agente", 42);
    expect(r).toEqual({ ok: true, data: { enviados: 2, completo: true, telefono: "+584125550101" } });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://chat.ejemplo.test/api/v1/accounts/1/conversations/42/messages?after=0");
    expect((init.headers as Record<string, string>).api_access_token).toBe("tok-agente");
    expect(JSON.stringify(r)).not.toContain(TEXTO_SINTETICO);
    expect(JSON.stringify(r)).not.toContain("Contacto Sintético");
  });

  it("pagina de a 100 con el id del último; si llega al tope, completo es false", async () => {
    const llena = (desde: number) => Array.from({ length: 100 }, (_, i) => msg(desde + i));
    fetchSpy.mockResolvedValueOnce(pagina(llena(1))).mockResolvedValueOnce(pagina(llena(101), null)).mockResolvedValueOnce(pagina([msg(201)]));
    const r = await contarEnviadosWhatsapp(CFG, "tok", 42, 3);
    expect(r).toEqual({ ok: true, data: { enviados: 201, completo: true, telefono: "+584125550101" } });
    expect((fetchSpy.mock.calls[1] as [string])[0]).toMatch(/after=100$/);
    expect((fetchSpy.mock.calls[2] as [string])[0]).toMatch(/after=200$/);

    fetchSpy.mockReset();
    fetchSpy.mockResolvedValueOnce(pagina(llena(1))).mockResolvedValueOnce(pagina(llena(101)));
    expect(await contarEnviadosWhatsapp(CFG, "tok", 42, 2)).toEqual({ ok: true, data: { enviados: 200, completo: false, telefono: "+584125550101" } });
  });

  it("sin teléfono en el contacto: telefono null", async () => {
    fetchSpy.mockResolvedValueOnce(pagina([msg(1)], ""));
    expect(await contarEnviadosWhatsapp(CFG, "tok", 42)).toEqual({ ok: true, data: { enviados: 1, completo: true, telefono: null } });
  });

  it("401 → no_autorizado; red → red; forma rara → respuesta_invalida", async () => {
    fetchSpy.mockResolvedValueOnce(json({}, 401));
    expect(await contarEnviadosWhatsapp(CFG, "tok", 42)).toEqual({ ok: false, error: "no_autorizado" });
    fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await contarEnviadosWhatsapp(CFG, "tok", 42)).toEqual({ ok: false, error: "red" });
    fetchSpy.mockResolvedValueOnce(json({ payload: "x" }));
    expect(await contarEnviadosWhatsapp(CFG, "tok", 42)).toEqual({ ok: false, error: "respuesta_invalida" });
  });
});
