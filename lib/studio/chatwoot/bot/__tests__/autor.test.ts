/**
 * SDD-NNNN · 7.6 · filtro de autor y dirección de `dtd-bot`. Pura, con payloads inventados
 * con la forma de `message.rb#webhook_data` de Chatwoot 4.19.1. Sin datos de personas.
 */
import { describe, expect, it } from "vitest";

import { efectoDelMensaje, formatoAdmitido, interpretarMensajeBot, type MensajeBot } from "../autor";

function payload(extra: Record<string, unknown> = {}) {
  return {
    event: "message_created",
    id: 501,
    content: "Hola, quiero cotizar",
    message_type: "incoming",
    private: false,
    created_at: 1_794_000_000,
    sender: { id: 77, type: "contact" },
    conversation: { id: 12, inbox_id: 3 },
    attachments: [],
    ...extra,
  };
}

const mensaje = (extra: Record<string, unknown> = {}) => interpretarMensajeBot(payload(extra)) as MensajeBot;

describe("interpretarMensajeBot", () => {
  it("toma ids, tipo, remitente y fecha, y no lleva el texto", () => {
    const m = mensaje();
    expect(m).toEqual({
      mensajeId: 501,
      conversacionId: 12,
      inboxId: 3,
      tipo: "incoming",
      privado: false,
      remitente: "contact",
      remitenteId: 77,
      adjuntos: 0,
      conTexto: true,
      creadoEn: new Date(1_794_000_000 * 1000).toISOString(),
    });
    expect(JSON.stringify(m)).not.toContain("cotizar");
  });

  it("entiende la forma de la API de cuenta (enum numérico y sender_type)", () => {
    const m = interpretarMensajeBot({ id: 9, conversation_id: 4, inbox_id: 2, message_type: 1, sender_type: "User", sender_id: 5, content: "x" });
    expect(m).toMatchObject({ tipo: "outgoing", remitente: "user", remitenteId: 5, conversacionId: 4, inboxId: 2 });
  });

  it.each([[null], [{}], [{ id: 1 }], [{ id: 0, conversation: { id: 1 } }], [{ id: 1, conversation: { id: -3 } }]])(
    "sin ids utilizables (%j) no hay mensaje",
    (raw) => {
      expect(interpretarMensajeBot(raw)).toBeNull();
    },
  );

  it("lo que no reconoce queda «desconocido», nunca como entrante de un contacto", () => {
    const m = mensaje({ message_type: "raro", sender: { id: 77, type: "otro" } });
    expect(m.tipo).toBe("desconocido");
    expect(m.remitente).toBe("desconocido");
  });

  it("cuenta adjuntos y ve si hay texto sin leerlo", () => {
    expect(mensaje({ content: "  ", attachments: [{}, {}] })).toMatchObject({ adjuntos: 2, conTexto: false });
  });
});

describe("efectoDelMensaje", () => {
  it("abre: entrante, no privado, de un contacto", () => {
    expect(efectoDelMensaje(mensaje())).toBe("abre");
  });

  it("invalida: saliente no privado de una persona", () => {
    expect(efectoDelMensaje(mensaje({ message_type: "outgoing", sender: { id: 5, type: "user" } }))).toBe("invalida");
  });

  it.each([
    ["nota privada de una persona", { message_type: "outgoing", private: true, sender: { id: 5, type: "user" } }],
    ["entrante privado (no debería existir)", { private: true }],
    ["saliente del propio bot (agente bot)", { message_type: "outgoing", sender: { id: 90, type: "agent_bot" } }],
    ["eco de un saliente sin remitente", { message_type: "outgoing", sender: undefined }],
    ["actividad", { message_type: "activity", sender: undefined }],
    ["plantilla", { message_type: "template", sender: { id: 5, type: "user" } }],
    ["entrante de una persona (no es un cliente)", { sender: { id: 5, type: "user" } }],
    ["entrante de un agente bot", { sender: { id: 90, type: "agent_bot" } }],
    ["tipo desconocido", { message_type: "raro" }],
    ["remitente desconocido", { sender: { id: 77, type: "otro" } }],
  ])("ignora: %s", (_caso, extra) => {
    expect(efectoDelMensaje(mensaje(extra))).toBe("ignora");
  });

  it("un saliente de un usuario que es uno de los bots de DTD no invalida", () => {
    const m = mensaje({ message_type: "outgoing", sender: { id: 90, type: "user" } });
    expect(efectoDelMensaje(m, new Set([90]))).toBe("ignora");
    expect(efectoDelMensaje(m, new Set([91]))).toBe("invalida");
  });

  it("un contacto con el mismo id que un bot sigue abriendo (son secuencias distintas)", () => {
    expect(efectoDelMensaje(mensaje({ sender: { id: 90, type: "contact" } }), new Set([90]))).toBe("abre");
  });
});

describe("formatoAdmitido", () => {
  it.each([
    [{ adjuntos: 0, conTexto: true }, true],
    [{ adjuntos: 1, conTexto: true }, false],
    [{ adjuntos: 1, conTexto: false }, false],
    [{ adjuntos: 0, conTexto: false }, false],
  ])("%j → %s", (m, esperado) => {
    expect(formatoAdmitido(m)).toBe(esperado);
  });
});
