/**
 * SDD-0650 F2 · Reglas puras del panel de conversaciones de la ficha.
 * Payloads SINTÉTICOS con la forma de `GET /contacts/{id}/conversations` de Chatwoot 4.19.1
 * (`api/v1/conversations/partials/_conversation.json.jbuilder`): nada de personas reales.
 */
import { describe, expect, it } from "vitest";

import {
  armarPanel,
  cortarTexto,
  puedeAbrirArchivoKommo,
  resumirConversacion,
  type ConversacionEnVivo,
} from "../ficha-conversaciones";

/** SINT: teléfono imposible en Venezuela (ningún código de área empieza por 0). */
const TELEFONO_SINT = "+58 000-000-0650";
const ARCHIVO = 9;
const TEXTO = "SINT-0650 mensaje del cliente con un pedido de prueba";

function conv(extra: Record<string, unknown> = {}) {
  return {
    id: 31,
    inbox_id: 3,
    status: "open",
    unread_count: 0,
    last_activity_at: 1_763_000_000,
    meta: { sender: { id: 5, name: "SINT Contacto", phone_number: TELEFONO_SINT, type: "contact" }, channel: "Channel::Whatsapp" },
    messages: [{ id: 70, content: "viejo", message_type: 0, created_at: 1_762_999_000 }],
    last_non_activity_message: { id: 71, content: TEXTO, message_type: 0, private: false, created_at: 1_763_000_000, sender: { type: "contact" } },
    ...extra,
  };
}

function enVivo(n: number, extra: Partial<ConversacionEnVivo> = {}): ConversacionEnVivo {
  return {
    conversationId: n,
    inboxId: 3,
    estado: "open",
    ultimaActividad: new Date(Date.UTC(2026, 10, n)).toISOString(),
    texto: `SINT texto ${n}`,
    autor: "cliente",
    fechaMensaje: null,
    nombreContacto: null,
    ...extra,
  };
}

const BASE = { archivoKommoInboxId: ARCHIVO, puedeAbrirArchivo: false, puedeVerDatos: true, fichaSinNombre: false };

describe("cortarTexto", () => {
  it("deja el texto corto igual y junta los espacios", () => {
    expect(cortarTexto("  hola \n\n  mundo ")).toBe("hola mundo");
  });
  it("corta a 160 caracteres, contando emojis como uno", () => {
    const largo = "😀".repeat(200);
    const corto = cortarTexto(largo) as string;
    expect(Array.from(corto)).toHaveLength(160);
    expect(corto.endsWith("…")).toBe(true);
  });
  it("vacío o no texto → null", () => {
    expect(cortarTexto("   ")).toBeNull();
    expect(cortarTexto(42)).toBeNull();
  });
});

describe("resumirConversacion (forma de 4.19.1)", () => {
  it("toma last_non_activity_message, el autor, la bandeja, el estado y la fecha", () => {
    expect(resumirConversacion(conv())).toEqual({
      conversationId: 31,
      inboxId: 3,
      estado: "open",
      ultimaActividad: new Date(1_763_000_000_000).toISOString(),
      texto: TEXTO,
      autor: "cliente",
      fechaMensaje: new Date(1_763_000_000_000).toISOString(),
      nombreContacto: "SINT Contacto",
    });
  });

  it("sin last_non_activity_message cae al último de messages que no es actividad", () => {
    const r = resumirConversacion(
      conv({
        last_non_activity_message: undefined,
        messages: [
          { id: 1, content: "SINT del equipo", message_type: 1, created_at: 1_763_000_001, sender: { type: "user" } },
          { id: 2, content: "Conversación resuelta", message_type: 2, created_at: 1_763_000_002 },
        ],
      }),
    );
    expect(r?.texto).toBe("SINT del equipo");
    expect(r?.autor).toBe("equipo");
  });

  it("una nota interna se nombra, pero su texto no sale", () => {
    const r = resumirConversacion(
      conv({ last_non_activity_message: { id: 3, content: "SINT nota interna secreta", message_type: 1, private: true, created_at: 1 } }),
    );
    expect(r?.autor).toBe("nota_interna");
    expect(r?.texto).toBeNull();
    expect(JSON.stringify(r)).not.toContain("secreta");
  });

  it("el bot es bot", () => {
    const r = resumirConversacion(
      conv({ last_non_activity_message: { id: 4, content: "SINT bot", message_type: 1, created_at: 1, sender: { type: "agent_bot" } } }),
    );
    expect(r?.autor).toBe("bot");
  });

  it("un nombre que es un teléfono no sirve como «Nombre en el chat»", () => {
    const r = resumirConversacion(conv({ meta: { sender: { id: 5, name: TELEFONO_SINT } } }));
    expect(r?.nombreContacto).toBeNull();
  });

  it("sin mensajes ni estado válido", () => {
    expect(resumirConversacion(conv({ messages: [], last_non_activity_message: null }))?.texto).toBeNull();
    expect(resumirConversacion(conv({ status: "otro" }))).toBeNull();
    expect(resumirConversacion(null)).toBeNull();
  });
});

describe("puedeAbrirArchivoKommo (D3)", () => {
  it("Admin y Contabilidad sí; Comercial, Soporte y el resto no", () => {
    expect(puedeAbrirArchivoKommo("admin")).toBe(true);
    expect(puedeAbrirArchivoKommo("accounting")).toBe(true);
    for (const rol of ["commercial", "support", "operations", "warehouse", "marketing"] as const) {
      expect(puedeAbrirArchivoKommo(rol)).toBe(false);
    }
    expect(puedeAbrirArchivoKommo(null)).toBe(false);
  });
});

describe("armarPanel", () => {
  it("ordena por actividad, quita repetidas y se queda con 6", () => {
    const lista = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => enVivo(n));
    const p = armarPanel({ ...BASE, conversaciones: [...lista, enVivo(8)] });
    expect(p.items.map((i) => i.conversationId)).toEqual([8, 7, 6, 5, 4, 3]);
  });

  it("Archivo Kommo sin permiso de abrir: se ve el texto, pero sin enlace, y avisa sin contar", () => {
    const p = armarPanel({ ...BASE, conversaciones: [enVivo(1, { inboxId: ARCHIVO }), enVivo(2)] });
    const archivo = p.items.find((i) => i.conversationId === 1);
    const otra = p.items.find((i) => i.conversationId === 2);
    expect(archivo).toMatchObject({ esArchivoKommo: true, abrirHref: null, texto: "SINT texto 1" });
    expect(otra?.abrirHref).toBe("/studio/bandeja?c=2");
    expect(p.hayQueNoAbres).toBe(true);
    // No dice cuántas: no hay ningún conteo en lo que sale.
    expect(Object.keys(p).sort()).toEqual(["hayQueNoAbres", "incompleto", "items", "nombreEnElChat"]);
  });

  it("con permiso de abrir el Archivo Kommo, el enlace sale y no hay aviso", () => {
    const p = armarPanel({ ...BASE, puedeAbrirArchivo: true, conversaciones: [enVivo(1, { inboxId: ARCHIVO })] });
    expect(p.items[0].abrirHref).toBe("/studio/bandeja?c=1");
    expect(p.hayQueNoAbres).toBe(false);
  });

  it("sin poder ver datos (región cn, SDD-0531): ni texto ni nombre en lo que sale", () => {
    const p = armarPanel({
      ...BASE,
      puedeVerDatos: false,
      fichaSinNombre: true,
      conversaciones: [enVivo(1, { texto: "SINT-SECRETO", nombreContacto: "SINT Nombre Oculto" })],
    });
    expect(p.items[0].texto).toBeNull();
    expect(p.nombreEnElChat).toBeNull();
    expect(JSON.stringify(p)).not.toMatch(/SINT-SECRETO|SINT Nombre Oculto/);
  });

  it("«Nombre en el chat» solo si la ficha no tiene nombre, el de la conversación más reciente con nombre", () => {
    const conversaciones = [enVivo(1, { nombreContacto: "SINT Viejo" }), enVivo(3, { nombreContacto: null }), enVivo(2, { nombreContacto: "SINT Nuevo" })];
    expect(armarPanel({ ...BASE, fichaSinNombre: true, conversaciones }).nombreEnElChat).toBe("SINT Nuevo");
    expect(armarPanel({ ...BASE, fichaSinNombre: false, conversaciones }).nombreEnElChat).toBeNull();
  });

  it("sin conversaciones: lista vacía, sin aviso", () => {
    expect(armarPanel({ ...BASE, conversaciones: [] })).toEqual({ items: [], hayQueNoAbres: false, nombreEnElChat: null, incompleto: false });
  });
});
