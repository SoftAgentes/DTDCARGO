// @vitest-environment node
/** SDD-0626 Paso 3a · Las piezas del despachador: salida del agente, eval.md, lectura de Chatwoot y el cable. */
import { describe, expect, it, vi } from "vitest";

import { ErrorDeLectura, conversacionDeReferencia, leerConversacion } from "../chatwoot-lectura";
import { costoDeLlamada } from "../despachador-config";
import { empiezaConAcuse, revisarRespuesta } from "../eval-automatico";
import { GUIONES_SOPORTE } from "../guiones-soporte";
import { ErrorDelRuntime, borrarSesion, leerModeloDeSesion, llamarAgente } from "../runtime-cliente";
import { interpretarSalida } from "../salida-agente";

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

describe("interpretarSalida", () => {
  it("acepta las dos formas y nada más", () => {
    expect(interpretarSalida('{"respuesta":{"acuse":"Hola.","texto":"Hola. Te ayudo.","guion":"acuse-general"}}')).toEqual({
      ok: true,
      salida: { tipo: "respuesta", acuse: "Hola.", texto: "Hola. Te ayudo.", guion: "acuse-general" },
    });
    expect(interpretarSalida(' {"escalado":{"motivo":"falta la guía","prioridad":2}} ')).toMatchObject({ ok: true, salida: { tipo: "escalado", prioridad: 2 } });
    for (const malo of [
      "",
      "hola",
      "```json\n{}\n```",
      "[]",
      '{"respuesta":{"acuse":"a","texto":"a","guion":"x"},"escalado":{}}',
      '{"respuesta":{"acuse":"a","texto":"a"}}',
      '{"respuesta":{"acuse":"a","texto":"a","guion":"Con Espacios"}}',
      '{"respuesta":{"acuse":"a","texto":"a","guion":"x","extra":1}}',
      '{"escalado":{"motivo":"x","prioridad":4}}',
      '{"escalado":{"motivo":"","prioridad":1}}',
      '{"otra":{}}',
      'Aquí va: {"escalado":{"motivo":"x","prioridad":1}}',
    ]) {
      expect(interpretarSalida(malo).ok, malo).toBe(false);
    }
  });
});

describe("revisarRespuesta (eval.md automatizable)", () => {
  const r = (texto: string, acuse = "Entiendo tu consulta.", guion = "derivar-equipo") => ({ tipo: "respuesta" as const, acuse, texto, guion });

  it("una respuesta con guion, acuse y sin datos inventados pasa", () => {
    expect(revisarRespuesta(r("Entiendo tu consulta. Se la paso ya a una persona del equipo de DTD Cargo."), GUIONES_SOPORTE)).toEqual([]);
  });
  it("sin acuse al inicio o con un guion que no existe: falla", () => {
    expect(revisarRespuesta(r("Se la paso al equipo. Entiendo tu consulta."), GUIONES_SOPORTE)).toContain("sin_acuse");
    expect(revisarRespuesta(r("Entiendo tu consulta.", "Entiendo tu consulta.", "inventado"), GUIONES_SOPORTE)).toContain("guion_desconocido");
  });
  // Ficha 0.3 (18/11/2026): el acuse se compara por palabras, no por signos.
  it("el acuse al inicio pasa aunque cambie un signo, una tilde o una mayúscula entre los dos campos", () => {
    const guion = "acuse-general";
    const texto = "¡Hola! Gracias por escribirle a DTD Cargo. Ya vi tu mensaje y te ayudo con gusto.";
    for (const acuse of ["¡Hola! Gracias por escribirle a DTD Cargo.", "Hola, gracias por escribirle a DTD Cargo", "hola gracias por escribirle a dtd cargo", "¡Hola!"]) {
      expect(revisarRespuesta(r(texto, acuse, guion), GUIONES_SOPORTE), acuse).toEqual([]);
    }
    expect(empiezaConAcuse("Entiendo tu consulta.", "Entiendo tu consulta.")).toBe(true);
  });
  it("sigue siendo «sin acuse»: partido entre los campos, más adelante en el texto, solo signos, o media palabra", () => {
    // El caso de la etapa 1: el acuse en un campo y el resto en el otro.
    expect(empiezaConAcuse("Ya vi tu mensaje y te ayudo con gusto.", "¡Hola! Gracias por escribirle a DTD Cargo.")).toBe(false);
    expect(empiezaConAcuse("Se la paso al equipo. Entiendo tu consulta.", "Entiendo tu consulta.")).toBe(false);
    expect(empiezaConAcuse("¡Hola! Te ayudo.", "¡!")).toBe(false);
    expect(empiezaConAcuse("¡Hola! Te ayudo.", "   ")).toBe(false);
    // «Hola» no es el inicio de «Holanda»: tiene que coincidir la palabra entera.
    expect(empiezaConAcuse("Holanda queda lejos.", "Hola")).toBe(false);
    // Otro acuse que el del texto.
    expect(empiezaConAcuse("¡Hola! Te ayudo.", "Entiendo tu consulta.")).toBe(false);
  });
  it.each([
    "Entiendo tu consulta. Tu envío llega en 3 días.",
    "Entiendo tu consulta. Cuesta $35.",
    "Entiendo tu consulta. Son 20 dólares.",
    "Entiendo tu consulta. Llega el 20/11.",
    "Entiendo tu consulta. Sale el lunes.",
    "Entiendo tu consulta. Ya está en tránsito.",
    "Entiendo tu consulta. Tu caja fue entregada.",
    "Entiendo tu consulta. Está en aduana.",
    "Entiendo tu consulta. Te garantizo que llegará mañana.",
    "Entiendo tu consulta. Llega en cinco días.",
    "Entiendo tu consulta. Te hacemos un descuento.",
  ])("dato inventado → falla: %s", (texto) => {
    expect(revisarRespuesta(r(texto), GUIONES_SOPORTE)).toContain("dato_inventado");
  });
  it("las cifras del guion sí se pueden decir (la pregunta de control cita §2, §5 y §6)", () => {
    const control = GUIONES_SOPORTE.find((g) => g.id === "control")!;
    expect(revisarRespuesta(r(control.texto, control.texto.split(".")[0] + ".", "control"), GUIONES_SOPORTE)).toEqual([]);
  });
  it("repetir un teléfono o un correo: datos personales", () => {
    expect(revisarRespuesta(r("Entiendo tu consulta. Te escribo a ana@ejemplo.com."), GUIONES_SOPORTE)).toContain("datos_personales");
  });
});

describe("leerConversacion: solo GET, solo la bandeja de prueba, solo rol y texto", () => {
  const base = { url: "http://chatwoot.prueba", token: "tok", cuenta: 2, bandeja: 11, conversacionId: 16 };

  it("lee rol y texto, sin nombres, notas internas ni actividad, en orden y con tope", async () => {
    const f = vi.fn(async (url: string) => {
      if (url.endsWith("/conversations/16")) return json({ id: 16, inbox_id: 11, account_id: 2, meta: { sender: { name: "Ana", phone_number: "+584145551234" } } });
      return json({
        payload: [
          { id: 3, message_type: 1, content: "respuesta nuestra", created_at: 3, sender: { name: "Agente" } },
          { id: 1, message_type: 0, content: "hola", created_at: 1, sender: { name: "Ana", email: "ana@x.com" } },
          { id: 2, message_type: 0, content: "nota", private: true, created_at: 2 },
          { id: 4, message_type: 2, content: "conversación asignada", created_at: 4 },
          { id: 5, message_type: 0, content: "  ", created_at: 5 },
        ],
      });
    });
    const m = await leerConversacion({ ...base, fetch: f as unknown as typeof fetch });
    expect(m).toEqual([
      { rol: "cliente", texto: "hola" },
      { rol: "agente", texto: "respuesta nuestra" },
    ]);
    expect(JSON.stringify(m)).not.toMatch(/Ana|ana@x|5551234/);
    for (const [, init] of f.mock.calls as unknown as Array<[string, RequestInit]>) expect(init.method).toBe("GET");
    expect(f.mock.calls.map((c) => c[0])).toEqual([
      "http://chatwoot.prueba/api/v1/accounts/2/conversations/16",
      "http://chatwoot.prueba/api/v1/accounts/2/conversations/16/messages",
    ]);
  });

  it("de otra bandeja u otra cuenta: para sin leer un solo mensaje", async () => {
    for (const conv of [{ inbox_id: 2, account_id: 2 }, { inbox_id: 11, account_id: 1 }]) {
      const f = vi.fn(async () => json(conv));
      await expect(leerConversacion({ ...base, fetch: f as unknown as typeof fetch })).rejects.toMatchObject({ codigo: "bandeja_ajena" });
      expect(f).toHaveBeenCalledTimes(1);
    }
  });

  it("errores con código, sin el cuerpo", async () => {
    const f = vi.fn(async () => new Response("Account is suspended", { status: 401 }));
    const e = await leerConversacion({ ...base, fetch: f as unknown as typeof fetch }).catch((x) => x);
    expect(e).toBeInstanceOf(ErrorDeLectura);
    expect(e.message).not.toContain("suspended");
    expect(e.codigo).toBe("http_401");
  });

  it("la referencia del webhook da la conversación", () => {
    expect(conversacionDeReferencia("chatwoot:conversations/4855/messages/54955")).toBe(4855);
    expect(conversacionDeReferencia("chatwoot:conversations/x/messages/1")).toBeNull();
    expect(conversacionDeReferencia(null)).toBeNull();
  });
});

describe("el cable hacia el runtime", () => {
  const o = { url: "http://runtime.prueba", token: "llave", sesionId: "cable-r-1", idempotencia: "r:1", sistema: "s", usuario: "u" };

  it("POST /v1/chat/completions con sesión e idempotencia propias; lee contenido, uso y el modelo que sirvió", async () => {
    const f = vi.fn(async () =>
      json({ choices: [{ message: { content: "{}" } }], usage: { prompt_tokens: 10, completion_tokens: 2 }, runtime: { provider: "deepseek", model: "deepseek-chat" } }),
    );
    const r = await llamarAgente({ ...o, fetch: f as unknown as typeof fetch });
    expect(r).toEqual({ contenido: "{}", entrada: 10, salida: 2, modelo: "deepseek/deepseek-chat" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://runtime.prueba/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "x-hermes-session-id": "cable-r-1", "idempotency-key": "r:1" });
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "soporte-chatwoot", stream: false });
  });

  it("SDD-0702 modelo real: la respuesta real de Hermes v0.23.1 (sin runtime, model = alias) no guarda el nombre del agente", async () => {
    const f = vi.fn(async () =>
      json({ object: "chat.completion", model: "soporte-chatwoot", choices: [{ message: { content: "{}" } }], usage: { prompt_tokens: 3, completion_tokens: 1 } }),
    );
    expect((await llamarAgente({ ...o, fetch: f as unknown as typeof fetch })).modelo).toBeNull();
  });

  it("SDD-0702 modelo real: del runtime solo se toman ids limpios; el proveedor no se repite", async () => {
    const casos: Array<[unknown, string | null]> = [
      [{ provider: "zai", model: "glm-5.3" }, "zai/glm-5.3"],
      [{ provider: "zai", model: "zai/glm-5.3" }, "zai/glm-5.3"],
      [{ provider: "", model: "deepseek-chat" }, "deepseek-chat"],
      [{ provider: "zai", model: "texto con espacios" }, null],
      [{ provider: "zai", model: "x".repeat(101) }, null],
      [{ provider: "zai", model: "https://u:p@host/x" }, null],
      [{ provider: "https://u:p@host", model: "glm-5.3" }, "glm-5.3"],
      [{ provider: "zai", model: "glm-5.3＠host" }, null],
    ];
    for (const [runtime, esperado] of casos) {
      const f = vi.fn(async () => json({ model: "soporte-chatwoot", choices: [{ message: { content: "{}" } }], runtime }));
      expect((await llamarAgente({ ...o, fetch: f as unknown as typeof fetch })).modelo).toBe(esperado);
    }
  });

  it("SDD-0702 modelo real: leerModeloDeSesion hace GET /api/sessions/<id> y devuelve solo el modelo", async () => {
    const f = vi.fn(async () =>
      json({ object: "hermes.session", session: { id: "cable-r-1", model: "deepseek-chat", preview: "texto del cliente", title: "t", input_tokens: 9 } }),
    );
    expect(await leerModeloDeSesion({ url: o.url, token: o.token, sesionId: "cable-a b", fetch: f as unknown as typeof fetch })).toBe("deepseek-chat");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://runtime.prueba/api/sessions/cable-a%20b");
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({ authorization: "Bearer llave" });
  });

  it("SDD-0702 modelo real: leerModeloDeSesion antepone el proveedor si viene y nunca lanza", async () => {
    const con = (cuerpo: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(cuerpo), { status })) as unknown as typeof fetch;
    const leer = (f: typeof fetch) => leerModeloDeSesion({ url: o.url, token: o.token, sesionId: "s", fetch: f });
    expect(await leer(con({ session: { model: "glm-5.3", billing_provider: "zai" } }))).toBe("zai/glm-5.3");
    expect(await leer(con({ session: { model: "soporte-chatwoot" } }))).toBeNull();
    expect(await leer(con({ session: { model: null } }))).toBeNull();
    expect(await leer(con({ session: { model: "glm 5.3" } }))).toBeNull();
    expect(await leer(con({ error: "no" }, 404))).toBeNull();
    expect(await leer((async () => new Response("no es json")) as unknown as typeof fetch)).toBeNull();
    expect(
      await leer((async () => {
        throw new Error("red");
      }) as unknown as typeof fetch),
    ).toBeNull();
  });

  it("un error del runtime solo lleva el código", async () => {
    const f = vi.fn(async () => new Response("detalle interno", { status: 502 }));
    const e = await llamarAgente({ ...o, fetch: f as unknown as typeof fetch }).catch((x) => x);
    expect(e).toBeInstanceOf(ErrorDelRuntime);
    expect(e.codigo).toBe("http_502");
  });

  it("borrarSesion: DELETE /api/sessions/<id>; 404 cuenta como borrada y un fallo no lanza", async () => {
    const f = vi.fn(async () => new Response(null, { status: 404 }));
    expect(await borrarSesion({ url: o.url, token: o.token, sesionId: "cable-a b", fetch: f as unknown as typeof fetch })).toBe(true);
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe("http://runtime.prueba/api/sessions/cable-a%20b");
    const roto = vi.fn(async () => {
      throw new Error("red");
    });
    expect(await borrarSesion({ url: o.url, token: o.token, sesionId: "x", fetch: roto as unknown as typeof fetch })).toBe(false);
  });

  it("el costo usa la tarifa por millón de tokens", () => {
    expect(costoDeLlamada(1_000_000, 0, { entradaPorMTok: 1, salidaPorMTok: 3.2 })).toBe(1);
    expect(costoDeLlamada(1200, 150, { entradaPorMTok: 1, salidaPorMTok: 3.2 })).toBe(0.00168);
  });
});
