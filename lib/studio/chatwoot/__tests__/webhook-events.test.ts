import { describe, expect, it } from "vitest";

import {
  interpretarContacto,
  interpretarContactoDelEvento,
  interpretarConversacion,
  interpretarEvento,
  nombreVisibleDe,
  ultimos10,
} from "../webhook-events";
import {
  CORREO_SINTETICO,
  NOMBRE_SINTETICO,
  TEXTO_SINTETICO,
  conversacionAsignada,
  conversacionCreada,
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

describe("eventos de la entrada de leads (SDD-0587, 6.4)", () => {
  it("conversation_created: clave por conversación y no avisa", () => {
    const e = interpretarEvento(conversacionCreada());
    expect(e).toMatchObject({ evento: "conversation_created", clave: "conversation_created:12", accountId: 1, mensajeId: null, avisar: false });
    expect(e?.conversacion).toMatchObject({ id: 12, inboxId: 3, telefonoUltimos10: "4125550101" });
  });

  it("conversation_updated con cambio de asignado: la clave distingue asignado y fecha", () => {
    const e = interpretarEvento(conversacionAsignada());
    expect(e).toMatchObject({ evento: "conversation_updated", clave: "conversation_updated:12:7:1761760200.75", avisar: false });
    const sinAsignado = interpretarEvento(conversacionAsignada({ meta: { sender: {}, assignee: null } }));
    expect(sinAsignado?.clave).toBe("conversation_updated:12:sin:1761760200.75");
  });

  it.each([
    ["etiquetas", [{ label_list: { previous_value: [], current_value: ["x"] } }]],
    ["equipo", [{ team_id: { previous_value: null, current_value: 21 } }]],
    ["sin cambios", []],
    ["sin la lista", undefined],
    ["forma rara", "assignee_id"],
  ])("conversation_updated sin cambio de asignado (%s): no se registra", (_caso, cambios) => {
    expect(interpretarEvento(conversacionAsignada({ changed_attributes: cambios }))).toBeNull();
  });

  it.each([
    ["conversation_created", conversacionCreada],
    ["conversation_updated", conversacionAsignada],
  ])("%s sin cuenta o con estado desconocido → null", (_nombre, fabrica) => {
    expect(interpretarEvento(fabrica({ account: null }))).toBeNull();
    expect(interpretarEvento(fabrica({ status: "archivada" }))).toBeNull();
  });

  it("el nombre, el correo y el teléfono completo no salen en el evento: viajan solo en el contacto", () => {
    const fuera = JSON.stringify([interpretarEvento(conversacionCreada()), interpretarEvento(conversacionAsignada())]);
    for (const dato of [TEXTO_SINTETICO, NOMBRE_SINTETICO, CORREO_SINTETICO, "+58", "412-555"]) {
      expect(fuera).not.toContain(dato);
    }
    const contacto = JSON.stringify(interpretarContactoDelEvento(conversacionCreada()));
    expect(contacto).toContain(NOMBRE_SINTETICO);
    for (const dato of [TEXTO_SINTETICO, CORREO_SINTETICO, "+58", "412-555"]) {
      expect(contacto).not.toContain(dato);
    }
  });
});

describe("interpretarContacto (SDD-0587, 6.4)", () => {
  it("del webhook: contacto, nombre y canal de arriba", () => {
    expect(interpretarContacto(conversacionCreada())).toEqual({
      contactoId: 5,
      nombre: NOMBRE_SINTETICO,
      canal: "Channel::Whatsapp",
      asignadoEsBot: false,
    });
  });

  it("en message_created la conversación viene anidada", () => {
    const m = mensajeCreado({ sender: { id: 999, name: "Quien Escribe" }, conversation: conversacionSintetica({ channel: "Channel::Email" }) });
    expect(interpretarContactoDelEvento(m)).toMatchObject({ contactoId: 5, nombre: NOMBRE_SINTETICO, canal: "Channel::Email" });
  });

  it("de la API de cuenta: el canal viene en meta", () => {
    const c = conversacionSintetica({ meta: { sender: { id: 6, name: "Por API" }, channel: "Channel::Instagram" } });
    expect(interpretarContacto(c)).toMatchObject({ contactoId: 6, canal: "Channel::Instagram" });
  });

  it("Instagram conectado por una página de Facebook cuenta como Instagram; Messenger no", () => {
    const pagina = (tipo?: string) =>
      interpretarContacto(conversacionSintetica({ channel: "Channel::FacebookPage", additional_attributes: tipo ? { type: tipo } : {} })).canal;
    expect(pagina("instagram_direct_message")).toBe("Channel::Instagram");
    expect(pagina()).toBe("Channel::FacebookPage");
    expect(pagina("otra_cosa")).toBe("Channel::FacebookPage");
  });

  it("un bot asignado se marca: su id no es de un agente", () => {
    const c = conversacionSintetica({ meta: { sender: { id: 5 }, assignee: { id: 7 }, assignee_type: "AgentBot" } });
    expect(interpretarContacto(c).asignadoEsBot).toBe(true);
  });

  it("lo que no sirve queda en null; nunca lanza", () => {
    const vacio = { contactoId: null, nombre: null, canal: null, asignadoEsBot: false };
    expect(interpretarContacto(null)).toEqual(vacio);
    expect(interpretarContacto("x")).toEqual(vacio);
    expect(interpretarContactoDelEvento(undefined)).toEqual(vacio);
    expect(interpretarContacto(conversacionSintetica({ meta: { sender: { id: "5", name: 7 } } }))).toMatchObject({ contactoId: null, nombre: null });
  });
});

describe("nombreVisibleDe (SDD-0587, D6)", () => {
  it.each([
    ["  Ana   María  ", "Ana María"],
    ["José Ñáñez", "José Ñáñez"],
    ["李明", "李明"],
    ["Ana 2", "Ana 2"],
    ["Importadora 123456", "Importadora 123456"],
  ])("%j → %j", (entra, sale) => {
    expect(nombreVisibleDe(entra)).toBe(sale);
  });

  it.each([
    ["el teléfono como nombre", "+58 412-555-0101"],
    ["solo dígitos", "04125550101"],
    ["teléfono dentro del nombre", "Ana 0412 555 0101"],
    ["correo", "ana.sintetica@example.test"],
    ["vacío", "   "],
    ["sin letras", "12345"],
    ["no es texto", 7],
    ["nada", undefined],
  ])("%s → null", (_caso, entra) => {
    expect(nombreVisibleDe(entra)).toBeNull();
  });

  it("se recorta a 120", () => {
    expect(nombreVisibleDe("a".repeat(500))).toHaveLength(120);
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
