import { describe, expect, it } from "vitest";

import { interpretarConversacion, interpretarEvento, ultimos10 } from "../webhook-events";
import {
  CORREO_SINTETICO,
  NOMBRE_SINTETICO,
  TEXTO_SINTETICO,
  conversacionSintetica,
  estadoCambiado,
  mensajeCreado,
} from "./webhook-fixtures";

describe("interpretarEvento (SDD-0585)", () => {
  it("message_created entrante: clave por mensaje, estado de la conversación y aviso", () => {
    expect(interpretarEvento(mensajeCreado())).toEqual({
      evento: "message_created",
      clave: "message_created:101",
      accountId: 1,
      mensajeId: 101,
      avisar: true,
      conversacion: {
        id: 12,
        inboxId: 3,
        estado: "open",
        noLeidos: 2,
        asignadoId: 7,
        ultimaActividad: new Date(1_761_760_000 * 1000).toISOString(),
        fuenteActualizada: 1_761_760_000.25,
        telefonoUltimos10: "4125550101",
      },
    });
  });

  it("el texto, el nombre, el correo y el teléfono completo NO salen de la interpretación", () => {
    const fuera = JSON.stringify([interpretarEvento(mensajeCreado()), interpretarEvento(estadoCambiado())]);
    for (const dato of [TEXTO_SINTETICO, NOMBRE_SINTETICO, CORREO_SINTETICO, "+58", "412-555"]) {
      expect(fuera).not.toContain(dato);
    }
  });

  it.each([
    ["saliente", { message_type: "outgoing" }],
    ["nota privada", { private: true }],
    ["actividad", { message_type: "activity" }],
  ])("message_created %s: se registra pero no avisa", (_caso, extra) => {
    expect(interpretarEvento(mensajeCreado(extra))?.avisar).toBe(false);
  });

  it("conversation_status_changed: clave con conversación, estado y updated_at; no avisa", () => {
    const e = interpretarEvento(estadoCambiado());
    expect(e?.clave).toBe("conversation_status_changed:12:resolved:1761760100.5");
    expect(e?.conversacion.estado).toBe("resolved");
    expect(e?.avisar).toBe(false);
    expect(e?.mensajeId).toBeNull();
  });

  it.each([
    ["otro evento", { event: "contact_created" }],
    ["sin id de mensaje", { id: null }],
    ["estado desconocido", { conversation: conversacionSintetica({ status: "archivada" }) }],
    ["sin cuenta", { account: null, conversation: conversacionSintetica({ account: null }) }],
  ])("%s → null", (_caso, extra) => {
    expect(interpretarEvento(mensajeCreado(extra))).toBeNull();
  });

  it("lo que no es objeto → null", () => {
    expect(interpretarEvento(null)).toBeNull();
    expect(interpretarEvento("message_created")).toBeNull();
    expect(interpretarEvento([mensajeCreado()])).toBeNull();
  });
});

describe("interpretarConversacion y ultimos10", () => {
  it("sin asignado, sin teléfono y sin no leídos negativos", () => {
    const c = interpretarConversacion(conversacionSintetica({ unread_count: -3, meta: { sender: {}, assignee: null } }));
    expect(c).toMatchObject({ noLeidos: 0, asignadoId: null, telefonoUltimos10: null });
  });

  it("últimos 10 dígitos como clients.phone_last10; menos de 10 → null", () => {
    expect(ultimos10("+58 412-555-0101")).toBe("4125550101");
    expect(ultimos10("0412 555 0102")).toBe("4125550102");
    expect(ultimos10("58412")).toBeNull();
    expect(ultimos10(undefined)).toBeNull();
  });
});
