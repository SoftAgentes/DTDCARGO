/**
 * SDD-0585 · paso 2.4, E2-D30. El contexto que manda Chatwoot 4.19.1 a una
 * Dashboard App (`Frame.vue`: `postMessage(JSON.stringify({event:"appContext",
 * data}), "*")`) trae el nombre, el teléfono y el correo del contacto. De acá
 * solo salen dos enteros y el tema, y solo si el mensaje viene del chat y de
 * la ventana que enmarca la app.
 */
import { describe, expect, it } from "vitest";

import { leerContextoChatwoot, PEDIR_CONTEXTO } from "../dashboard-app";

const CHAT = "https://chat.ejemplo.test";
const PADRE = { soy: "padre" };

/** Contexto sintético completo, con los datos personales que Chatwoot sí manda. */
function contexto(over: Record<string, unknown> = {}) {
  return JSON.stringify({
    event: "appContext",
    data: {
      conversation: { id: 42, inbox_id: 1, status: "open", meta: { sender: { id: 7, phone_number: "+584125550101" } } },
      contact: { id: 7, name: "Contacto Sintético", phone_number: "+584125550101", email: "contacto@example.test" },
      currentAgent: { id: 3, name: "Agente Sintética", email: "agente@example.test" },
      customAttributes: [],
      theme: "dark",
      ...over,
    },
  });
}

const ev = (data: unknown, origin = CHAT, source: unknown = PADRE) => ({ data, origin, source });

describe("leerContextoChatwoot (E2-D30)", () => {
  it("la señal para pedir el contexto es la de Chatwoot 4.19.1", () => {
    expect(PEDIR_CONTEXTO).toBe("chatwoot-dashboard-app:fetch-info");
  });

  it("del contexto completo salen SOLO los dos ids y el tema", () => {
    const leido = leerContextoChatwoot(ev(contexto()), CHAT, PADRE);
    expect(leido).toEqual({ conversacionId: 42, agenteId: 3, tema: "dark" });
    const plano = JSON.stringify(leido);
    for (const dato of ["Sintético", "Sintética", "+58", "4125550101", "example.test"]) {
      expect(plano).not.toContain(dato);
    }
  });

  it("otro origen: se ignora", () => {
    expect(leerContextoChatwoot(ev(contexto(), "https://otro.ejemplo.test"), CHAT, PADRE)).toBeNull();
    expect(leerContextoChatwoot(ev(contexto(), "https://chat.ejemplo.test.malo.test"), CHAT, PADRE)).toBeNull();
  });

  it("del origen correcto pero de otra ventana: se ignora", () => {
    expect(leerContextoChatwoot(ev(contexto(), CHAT, { otra: true }), CHAT, PADRE)).toBeNull();
  });

  it("sin padre (la página abierta suelta): se ignora", () => {
    expect(leerContextoChatwoot(ev(contexto(), CHAT, PADRE), CHAT, null)).toBeNull();
  });

  it("otro evento, JSON roto o un objeto en vez de texto: se ignora", () => {
    expect(leerContextoChatwoot(ev(JSON.stringify({ event: "otro", data: {} })), CHAT, PADRE)).toBeNull();
    expect(leerContextoChatwoot(ev("{no es json"), CHAT, PADRE)).toBeNull();
    expect(leerContextoChatwoot(ev({ event: "appContext", data: {} }), CHAT, PADRE)).toBeNull();
  });

  it("ids que no son enteros positivos: se ignora", () => {
    expect(leerContextoChatwoot(ev(contexto({ conversation: { id: "42" } })), CHAT, PADRE)).toBeNull();
    expect(leerContextoChatwoot(ev(contexto({ conversation: { id: 0 } })), CHAT, PADRE)).toBeNull();
    expect(leerContextoChatwoot(ev(contexto({ currentAgent: { id: 3.5 } })), CHAT, PADRE)).toBeNull();
    expect(leerContextoChatwoot(ev(contexto({ currentAgent: null })), CHAT, PADRE)).toBeNull();
  });

  it("un tema desconocido cae a claro", () => {
    expect(leerContextoChatwoot(ev(contexto({ theme: "sepia" })), CHAT, PADRE)?.tema).toBe("light");
  });
});
