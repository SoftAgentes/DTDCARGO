// @vitest-environment node
/**
 * SDD-0626 Paso 3b · `crearChatwootEnvio` contra un fetch falso con la forma REAL de Chatwoot 4.19.1
 * (GET /api/v1/accounts/:id/conversations/:id, GET …/messages y POST …/messages). Falla hacia el lado seguro: si la
 * forma no se reconoce, la conversación vuelve como `desconocida` y el envío se bloquea. Un envío que pudo haber
 * llegado nunca se marca como rechazado.
 */
import { describe, expect, it, vi } from "vitest";

import { ErrorDeChatwoot, crearChatwootEnvio, interpretarConversacion } from "../envio";

const T0 = 1763290000;

/** GET /conversations/17 de Chatwoot 4.19.1 (recortado a lo que importa, con los campos reales alrededor). */
function conversacion(o: Record<string, unknown> = {}) {
  return {
    meta: { sender: { id: 4326, name: "Contacto de prueba", type: "contact" }, channel: "Channel::Api", hmac_verified: false },
    id: 17,
    messages: [],
    account_id: 2,
    uuid: "c6c3b8de-0000-4000-8000-000000000017",
    additional_attributes: {},
    agent_last_seen_at: 0,
    assignee_last_seen_at: 0,
    can_reply: true,
    contact_last_seen_at: 0,
    custom_attributes: {},
    inbox_id: 11,
    labels: [],
    muted: false,
    snoozed_until: null,
    status: "open",
    created_at: T0,
    updated_at: T0 + 1,
    timestamp: T0,
    unread_count: 1,
    priority: null,
    ...o,
  };
}

/** Un mensaje de GET /conversations/17/messages (Chatwoot 4.19.1: message_type entero, created_at unix). */
function mensaje(o: Record<string, unknown>) {
  return {
    id: 101,
    content: "Hola, quiero enviar una caja",
    inbox_id: 11,
    conversation_id: 17,
    message_type: 0,
    content_type: "text",
    status: "sent",
    content_attributes: {},
    created_at: T0,
    private: false,
    source_id: null,
    sender: { id: 4326, name: "Contacto de prueba", type: "contact" },
    attachments: [],
    ...o,
  };
}

const lista = (...payload: unknown[]) => ({
  meta: { labels: [], additional_attributes: {}, contact: { id: 4326 }, assignee: null, agent_last_seen_at: null },
  payload,
});

const C = { url: "http://chatwoot.prueba:3000", token: "token-de-envio-de-prueba", cuenta: 2 };

function fetchFalso(respuestas: Array<Response | Error>) {
  const pedidos: Array<{ url: string; init: RequestInit }> = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    pedidos.push({ url: String(url), init: init ?? {} });
    const r = respuestas.shift();
    if (!r) throw new Error("pedido de más");
    if (r instanceof Error) throw r;
    return r;
  });
  return { f: f as unknown as typeof fetch, pedidos };
}

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });

describe("crearChatwootEnvio · lectura de la conversación (Chatwoot 4.19.1)", () => {
  it("la forma real: cuenta, bandeja y la hora del último entrante; solo GET con el token en la cabecera", async () => {
    const { f, pedidos } = fetchFalso([json(conversacion()), json(lista(mensaje({})))]);
    const r = await crearChatwootEnvio(C, f).conversacion(17);
    expect(r).toEqual({ forma: "conocida", cuenta: 2, bandeja: 11, ultimaSalidaS: null, ultimaEntradaS: T0 });
    expect(pedidos.map((p) => [p.init.method, p.url])).toEqual([
      ["GET", "http://chatwoot.prueba:3000/api/v1/accounts/2/conversations/17"],
      ["GET", "http://chatwoot.prueba:3000/api/v1/accounts/2/conversations/17/messages"],
    ]);
    expect((pedidos[0].init.headers as Record<string, string>).api_access_token).toBe("token-de-envio-de-prueba");
  });

  it("sin inbox_id (o con uno que no es un entero): forma desconocida → se bloquea", () => {
    const sinBandeja: Record<string, unknown> = conversacion();
    delete sinBandeja.inbox_id;
    expect(interpretarConversacion(sinBandeja, lista(), 2)).toEqual({ forma: "desconocida" });
    expect(interpretarConversacion(conversacion({ inbox_id: "once" }), lista(), 2)).toEqual({ forma: "desconocida" });
    expect(interpretarConversacion(conversacion({ inbox_id: null }), lista(), 2)).toEqual({ forma: "desconocida" });
  });

  it("otra bandeja y otra cuenta se leen tal cual (el envío las bloquea)", () => {
    expect(interpretarConversacion(conversacion({ inbox_id: 6 }), lista(), 2)).toMatchObject({ forma: "conocida", bandeja: 6 });
    expect(interpretarConversacion(conversacion({ account_id: 3 }), lista(), 2)).toMatchObject({ forma: "conocida", cuenta: 3 });
    expect(interpretarConversacion(conversacion({ account_id: "dos" }), lista(), 2)).toEqual({ forma: "desconocida" });
  });

  it("un saliente PRIVADO (nota interna) no cuenta como respuesta; uno público posterior sí", () => {
    const nota = mensaje({ id: 102, message_type: 1, private: true, created_at: T0 + 50, sender: { type: "user" } });
    expect(interpretarConversacion(conversacion(), lista(mensaje({}), nota), 2)).toMatchObject({ ultimaSalidaS: null });
    const publico = mensaje({ id: 103, message_type: 1, private: false, created_at: T0 + 60, sender: { type: "user" } });
    expect(interpretarConversacion(conversacion(), lista(mensaje({}), nota, publico), 2)).toMatchObject({ ultimaSalidaS: T0 + 60 });
  });

  it("message_type como texto («outgoing», como en los webhooks) también se reconoce; las plantillas cuentan como salida", () => {
    const texto = mensaje({ message_type: "outgoing", created_at: T0 + 70 });
    expect(interpretarConversacion(conversacion(), lista(texto), 2)).toMatchObject({ ultimaSalidaS: T0 + 70 });
    const plantilla = mensaje({ message_type: 3, created_at: T0 + 80 });
    expect(interpretarConversacion(conversacion(), lista(plantilla), 2)).toMatchObject({ ultimaSalidaS: T0 + 80 });
    const entrante = mensaje({ message_type: "incoming", created_at: T0 + 90 });
    expect(interpretarConversacion(conversacion(), lista(entrante), 2)).toMatchObject({ ultimaEntradaS: T0 + 90 });
    const actividad = mensaje({ message_type: 2, created_at: T0 + 99 });
    expect(interpretarConversacion(conversacion(), lista(actividad), 2)).toMatchObject({ ultimaSalidaS: null, ultimaEntradaS: null });
  });

  it.each([
    ["un message_type que no se conoce", { message_type: 7 }],
    ["un message_type de texto raro", { message_type: "outbound" }],
    ["sin message_type", { message_type: undefined }],
    ["un private que no es booleano", { message_type: 1, private: "no" }],
    ["un saliente sin hora legible", { message_type: 1, created_at: "ayer" }],
  ])("FALLA SEGURO: %s → forma desconocida", (_, o) => {
    expect(interpretarConversacion(conversacion(), lista(mensaje(o)), 2)).toEqual({ forma: "desconocida" });
  });

  it("FALLA SEGURO: la lista de mensajes no es una lista → forma desconocida", () => {
    expect(interpretarConversacion(conversacion(), { meta: {}, data: [] }, 2)).toEqual({ forma: "desconocida" });
    expect(interpretarConversacion(conversacion(), [mensaje({})], 2)).toEqual({ forma: "desconocida" });
  });

  it("la hora en ISO o en milisegundos también se entiende", () => {
    const iso = mensaje({ message_type: 1, created_at: new Date((T0 + 10) * 1000).toISOString() });
    expect(interpretarConversacion(conversacion(), lista(iso), 2)).toMatchObject({ ultimaSalidaS: T0 + 10 });
    const ms = mensaje({ message_type: 1, created_at: (T0 + 20) * 1000 });
    expect(interpretarConversacion(conversacion(), lista(ms), 2)).toMatchObject({ ultimaSalidaS: T0 + 20 });
  });

  it("un error de lectura no se toma por una forma: se lanza (el envío espera al minuto siguiente)", async () => {
    const { f } = fetchFalso([json({ error: "no" }, 404)]);
    await expect(crearChatwootEnvio(C, f).conversacion(17)).rejects.toMatchObject({ codigo: "http_404" });
  });
});

describe("crearChatwootEnvio · el POST del mensaje saliente (M1)", () => {
  it("201 con el id del mensaje: lo devuelve; el cuerpo es un saliente público de texto", async () => {
    const { f, pedidos } = fetchFalso([json(mensaje({ id: 102, message_type: 1, content: "Hola" }))]);
    expect(await crearChatwootEnvio(C, f).enviar(17, "Hola")).toBe(102);
    expect(pedidos[0].init.method).toBe("POST");
    expect(JSON.parse(String(pedidos[0].init.body))).toEqual({ content: "Hola", message_type: "outgoing", private: false, content_type: "text" });
  });

  it.each([
    ["422 (rechazo: no se entregó)", [json({ error: "x" }, 422)], { codigo: "http_422", incierto: false }],
    ["401 (rechazo)", [json({ error: "x" }, 401)], { codigo: "http_401", incierto: false }],
    ["408 (pudo llegar)", [json({}, 408)], { codigo: "http_408", incierto: true }],
    ["500 (pudo llegar)", [json({}, 500)], { codigo: "http_500", incierto: true }],
    ["la red se corta (pudo llegar)", [new TypeError("fetch failed")], { codigo: "red", incierto: true }],
    ["200 que no se puede leer (pudo llegar)", [new Response("<html>", { status: 200 })], { codigo: "json", incierto: true }],
    ["200 sin id (pudo llegar)", [json({ ok: true })], { codigo: "sin_id", incierto: true }],
  ] as const)("%s", async (_, respuestas, esperado) => {
    const { f } = fetchFalso([...respuestas]);
    const err = await crearChatwootEnvio(C, f)
      .enviar(17, "Hola")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ErrorDeChatwoot);
    expect(err).toMatchObject(esperado);
  });
});
