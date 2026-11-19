// @vitest-environment node
/**
 * SDD-0676 · Reconocimiento automático de un contacto vinculado.
 *
 *  - Reglas puras del canal (`canal-union.ts`).
 *  - `aplicarConversacion` manda el contacto a la base (`p_contact_id`) y, sin la
 *    migración, cae en la llamada de antes.
 *  - `marcarContactoErp` escribe el segmento y el Shipping Mark de la ficha UNIDA al
 *    contacto, en cualquier bandeja. El doble de Supabase APLICA los filtros (`eq`,
 *    `is`) sobre filas de dos tenants: una unión de otro tenant o una ficha borrada no
 *    prestan su código.
 *  - `vincularContacto` cae en la RPC de la 0554 solo cuando falta la nueva.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  obtenerConversacionYContacto: vi.fn(),
  leerAtributosContacto: vi.fn(),
  escribirAtributosContacto: vi.fn(),
}));
vi.mock("../router-api", async (original) => ({ ...(await original<typeof import("../router-api")>()), ...api }));
vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: async () => ({ chatwoot_inbox: false }) }));
vi.mock("@/lib/studio/notify/operario-push-outbox", () => ({ enqueueUserPush: vi.fn(), drainOperarioPushOutbox: vi.fn() }));

import { canalDeChatwoot, esCanalUnion, logoDeCanalUnion, telefonoFinal } from "../canal-union";
import { marcarContactoErp } from "../contacto-erp-manejador";
import { vincularContacto } from "../vincular";
import { aplicarConversacion } from "../webhook-procesar";
import { interpretarContactoDelEvento, interpretarEvento, type EventoChatwoot } from "../webhook-events";
import { conversacionSintetica, mensajeCreado } from "./webhook-fixtures";

const T1 = "10000000-0000-4000-8000-000000000001";
const T2 = "10000000-0000-4000-8000-000000000002";
const FICHA = "30000000-0000-4000-8000-000000000001";
const BORRADA = "30000000-0000-4000-8000-000000000002";
const AJENA = "30000000-0000-4000-8000-000000000009";
const INBOX_LEADS = 3;
const INBOX_CLIENTES = 7;
const INBOX_INSTAGRAM = 11;
const ENV = {
  CHATWOOT_URL: "https://chat.ejemplo.test",
  CHATWOOT_ROUTER_TOKEN: "tok-router-sintetico",
  CHATWOOT_ACCOUNT_ID: "1",
  CHATWOOT_INBOX_LEADS_ID: String(INBOX_LEADS),
  CHATWOOT_INBOX_CLIENTES_ID: String(INBOX_CLIENTES),
  CHATWOOT_TEAM_CLIENTES_ID: "21",
  CHATWOOT_TEAM_LEADS_ID: "22",
  WHATSAPP_NUMERO_CLIENTES: "584125550999",
  CHATWOOT_ATRIBUTOS_CONTACTO: "1",
};

type Fila = Record<string, unknown>;

const UNIONES: Fila[] = [
  { tenant_id: T1, chatwoot_contact_id: 5, client_id: FICHA },
  { tenant_id: T1, chatwoot_contact_id: 6, client_id: BORRADA },
  // El contacto del chat del portal de esa misma ficha (unión que escribe chatwoot_portal_vincular).
  { tenant_id: T1, chatwoot_contact_id: 9, client_id: FICHA, origen: "portal" },
  // El mismo número de contacto no existe en dos tenants (llave de la 0554): este es otro contacto, de T2.
  { tenant_id: T2, chatwoot_contact_id: 8, client_id: AJENA },
];
const FICHAS: Fila[] = [
  { tenant_id: T1, id: FICHA, markbox: "DTD-T0001", phone_last10: "4125550101", deleted_at: null },
  { tenant_id: T1, id: BORRADA, markbox: "DTD-T0002", phone_last10: "4125550102", deleted_at: "2026-11-01T00:00:00Z" },
  { tenant_id: T2, id: AJENA, markbox: "DTD-T0900", phone_last10: "4125550109", deleted_at: null },
];

/** Cliente de servicio en memoria: filtra de verdad con `eq` e `is`. */
function base(opciones: { segmentos?: Record<string, string>; errorUniones?: { code: string }; errorSegmento?: { code: string } } = {}) {
  const tablas: Record<string, Fila[]> = { chatwoot_contact_links: UNIONES, clients: FICHAS };
  const lecturas: string[] = [];
  const from = vi.fn((tabla: string) => {
    lecturas.push(tabla);
    if (!(tabla in tablas)) throw new Error(`tabla inesperada ${tabla}`);
    let filas = [...tablas[tabla]];
    const q = {
      select: () => q,
      eq: (col: string, v: unknown) => {
        filas = filas.filter((f) => f[col] === v);
        return q;
      },
      is: (col: string, v: unknown) => {
        filas = filas.filter((f) => (f[col] ?? null) === v);
        return q;
      },
      limit: async (n: number) =>
        tabla === "chatwoot_contact_links" && opciones.errorUniones
          ? { data: null, error: opciones.errorUniones }
          : { data: filas.slice(0, n), error: null },
    };
    return q;
  });
  const rpc = vi.fn(async (nombre: string, args: Record<string, unknown>) => {
    if (nombre === "crm_segmento_cliente") {
      if (opciones.errorSegmento) return { data: null, error: opciones.errorSegmento };
      return { data: opciones.segmentos?.[String(args.p_client_id)] ?? "cliente", error: null };
    }
    if (nombre === "chatwoot_segmento_contacto") return { data: "lead_nuevo", error: null };
    throw new Error(`RPC inesperada ${nombre}`);
  });
  const admin = { rpc, from } as unknown as Parameters<typeof marcarContactoErp>[0]["admin"];
  return { admin, rpc, from, lecturas };
}

function evento(conv: Record<string, unknown> = {}) {
  const payload = mensajeCreado({ conversation: conversacionSintetica(conv) });
  return { evento: interpretarEvento(payload) as EventoChatwoot, contacto: interpretarContactoDelEvento(payload) };
}
const REGISTRO = { nuevo: true, aplicado: true, clientId: null };
/** Un contacto de Instagram: otra bandeja y sin teléfono. */
const instagram = (contacto: number) => evento({ inbox_id: INBOX_INSTAGRAM, meta: { sender: { id: contacto, name: "SINT Instagram" } } });

beforeEach(() => {
  vi.clearAllMocks();
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  api.leerAtributosContacto.mockResolvedValue({ ok: true, data: {} });
  api.escribirAtributosContacto.mockResolvedValue({ ok: true, data: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("canal de la unión (reglas puras)", () => {
  it.each([
    ["Channel::Whatsapp", "whatsapp"],
    ["Channel::Instagram", "instagram"],
    ["Channel::FacebookPage", "messenger"],
    ["Channel::Tiktok", "tiktok"],
    ["Channel::Email", "correo"],
    ["Channel::Api", "otro"],
    ["Channel::WebWidget", "otro"],
    ["", null],
    [null, null],
    [undefined, null],
  ])("canalDeChatwoot(%j) = %j", (entrada, esperado) => {
    expect(canalDeChatwoot(entrada)).toBe(esperado);
  });

  it("solo los canales de la migración son válidos", () => {
    for (const c of ["whatsapp", "instagram", "messenger", "tiktok", "correo", "otro", "portal"]) expect(esCanalUnion(c)).toBe(true);
    for (const c of ["telegram", "", null, undefined, 3, "Instagram"]) expect(esCanalUnion(c)).toBe(false);
  });

  it("el logo: Messenger usa el de Facebook; «otro» y nulo no llevan logo", () => {
    expect(logoDeCanalUnion("messenger")).toBe("facebook");
    expect(logoDeCanalUnion("instagram")).toBe("instagram");
    expect(logoDeCanalUnion("otro")).toBeNull();
    expect(logoDeCanalUnion(null)).toBeNull();
    // El chat del portal lleva el logo de los canales propios de DTD.
    expect(logoDeCanalUnion("portal")).toBe("dtd");
  });

  it("«portal» nunca sale del tipo de bandeja: solo lo escribe el chat del portal", () => {
    for (const tipo of ["Channel::Api", "Channel::WebWidget", "Channel::Whatsapp", "portal"]) {
      expect(canalDeChatwoot(tipo)).not.toBe("portal");
    }
  });

  it.each([
    ["+58 412-555-0142", "0142"],
    ["04125550142", "0142"],
    ["12345", null],
    ["", null],
    [null, null],
  ])("telefonoFinal(%j) = %j", (entrada, esperado) => {
    expect(telefonoFinal(entrada)).toBe(esperado);
  });
});

describe("aplicarConversacion manda el contacto a la base", () => {
  const conv = evento().evento.conversacion;
  const fila = { nuevo: true, aplicado: true, client_id: FICHA };

  it("el contacto del payload viaja en p_contact_id y el cliente vuelve", async () => {
    const rpc = vi.fn(async () => ({ data: [fila], error: null }));
    const r = await aplicarConversacion({ admin: { rpc } as never, tenantId: T1, contacto: evento().contacto }, conv, null);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("chatwoot_registrar_evento", expect.objectContaining({ p_tenant_id: T1, p_contact_id: 5 }));
    expect(r.clientId).toBe(FICHA);
  });

  it("el cuarto argumento manda sobre el contexto; sin ninguno, null", async () => {
    const rpc = vi.fn(async () => ({ data: [fila], error: null }));
    await aplicarConversacion({ admin: { rpc } as never, tenantId: T1 }, conv, null, 77);
    await aplicarConversacion({ admin: { rpc } as never, tenantId: T1 }, conv, null);
    expect(rpc.mock.calls.map((c) => (c as unknown[])[1])).toEqual([
      expect.objectContaining({ p_contact_id: 77 }),
      expect.objectContaining({ p_contact_id: null }),
    ]);
  });

  it("sin la migración (PGRST202) repite la llamada de antes, sin p_contact_id", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } })
      .mockResolvedValueOnce({ data: [{ nuevo: true, aplicado: true, client_id: null }], error: null });
    const r = await aplicarConversacion({ admin: { rpc } as never, tenantId: T1 }, conv, null, 77);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(Object.keys((rpc.mock.calls[1] as unknown[])[1] as object)).not.toContain("p_contact_id");
    expect(r).toEqual({ nuevo: true, aplicado: true, clientId: null, origenCliente: null });
  });

  it.each([
    ["union", "union"],
    ["telefono", "telefono"],
    ["conservado", "conservado"],
    // Un valor que no conocemos nunca es «teléfono»: se trata como conservado, que no une.
    ["otra_cosa", "conservado"],
    [7, "conservado"],
  ])("origen_cliente %j de la base se lee como %j", async (dicho, esperado) => {
    const rpc = vi.fn(async () => ({ data: [{ ...fila, origen_cliente: dicho }], error: null }));
    const r = await aplicarConversacion({ admin: { rpc } as never, tenantId: T1 }, conv, null, 77);
    expect(r).toEqual({ nuevo: true, aplicado: true, clientId: FICHA, origenCliente: esperado });
  });

  it("la función de antes (sin origen_cliente): su cliente solo sale del teléfono", async () => {
    const rpc = vi.fn(async () => ({ data: [fila], error: null }));
    const r = await aplicarConversacion({ admin: { rpc } as never, tenantId: T1 }, conv, null, 77);
    expect(r.origenCliente).toBe("telefono");
  });

  it("sin cliente no hay origen, diga lo que diga la fila", async () => {
    const rpc = vi.fn(async () => ({ data: [{ nuevo: true, aplicado: true, client_id: null, origen_cliente: "telefono" }], error: null }));
    const r = await aplicarConversacion({ admin: { rpc } as never, tenantId: T1 }, conv, null, 77);
    expect(r).toEqual({ nuevo: true, aplicado: true, clientId: null, origenCliente: null });
  });

  it("otro error no se repite: lanza con el código", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "57014" } }));
    await expect(aplicarConversacion({ admin: { rpc } as never, tenantId: T1 }, conv, null, 77)).rejects.toThrow(
      "chatwoot_registrar_evento: 57014",
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe("marcarContactoErp con un contacto vinculado", () => {
  it("Instagram, sin teléfono: escribe el segmento y el Shipping Mark de la ficha unida", async () => {
    const b = base();
    const e = instagram(5);
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);
    expect(b.rpc).toHaveBeenCalledWith("crm_segmento_cliente", { p_tenant_id: T1, p_client_id: FICHA });
    expect(api.escribirAtributosContacto).toHaveBeenCalledWith(expect.anything(), 5, {
      dtd_segmento: "cliente",
      dtd_shipping_mark: "DTD-T0001",
    });
  });

  it("Instagram sin unión: no lee ni escribe nada en Chatwoot (D5 de la SDD-0649 sigue igual)", async () => {
    const b = base();
    const e = instagram(55);
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);
    expect(b.lecturas).toEqual(["chatwoot_contact_links"]);
    expect(b.rpc).not.toHaveBeenCalled();
    expect(api.leerAtributosContacto).not.toHaveBeenCalled();
    expect(api.escribirAtributosContacto).not.toHaveBeenCalled();
  });

  it("contacto del portal: aunque está unido, no se le escribe segmento ni Shipping Mark (a Chatwoot solo va su nombre)", async () => {
    const b = base();
    const e = instagram(9);
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);
    // Lee la unión, ve que es del portal y para: ni la ficha, ni el segmento, ni Chatwoot.
    expect(b.lecturas).toEqual(["chatwoot_contact_links"]);
    expect(b.rpc).not.toHaveBeenCalled();
    expect(api.leerAtributosContacto).not.toHaveBeenCalled();
    expect(api.escribirAtributosContacto).not.toHaveBeenCalled();
  });

  it("la unión de OTRO tenant no presta su código: el filtro por tenant se aplica", async () => {
    const b = base();
    const e = instagram(8);
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);
    expect(api.escribirAtributosContacto).not.toHaveBeenCalled();
    // Y con el tenant dueño de esa unión, sí.
    await marcarContactoErp({ admin: b.admin, tenantId: T2, contacto: e.contacto }, e.evento, REGISTRO);
    expect(api.escribirAtributosContacto).toHaveBeenCalledWith(expect.anything(), 8, expect.objectContaining({ dtd_shipping_mark: "DTD-T0900" }));
  });

  it("unión a una ficha borrada: fuera de WhatsApp no escribe; no copia el código de la borrada", async () => {
    const b = base();
    const e = instagram(6);
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);
    expect(b.rpc).not.toHaveBeenCalled();
    expect(api.escribirAtributosContacto).not.toHaveBeenCalled();
  });

  it("WhatsApp: la unión manda sobre el teléfono (no se consulta la regla por teléfono)", async () => {
    const b = base({ segmentos: { [FICHA]: "lead_registrado" } });
    const e = evento({ inbox_id: INBOX_CLIENTES });
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);
    expect(b.rpc).not.toHaveBeenCalledWith("chatwoot_segmento_contacto", expect.anything());
    expect(api.escribirAtributosContacto).toHaveBeenCalledWith(expect.anything(), 5, {
      dtd_segmento: "lead_registrado",
      dtd_shipping_mark: "DTD-T0001",
    });
  });

  it("ficha unida que la regla da como lead nuevo: sin código", async () => {
    const b = base({ segmentos: { [FICHA]: "lead_nuevo" } });
    api.leerAtributosContacto.mockResolvedValueOnce({ ok: true, data: { dtd_segmento: "cliente", dtd_shipping_mark: "DTD-T0001" } });
    const e = instagram(5);
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);
    expect(api.escribirAtributosContacto).toHaveBeenCalledWith(expect.anything(), 5, { dtd_segmento: "lead_nuevo", dtd_shipping_mark: null });
  });

  it("si ya están bien, no escribe", async () => {
    const b = base();
    api.leerAtributosContacto.mockResolvedValueOnce({ ok: true, data: { dtd_segmento: "cliente", dtd_shipping_mark: "DTD-T0001" } });
    const e = instagram(5);
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);
    expect(api.escribirAtributosContacto).not.toHaveBeenCalled();
  });

  it("sin la 0554 (PGRST205): Instagram no hace nada y WhatsApp sigue por teléfono", async () => {
    const b = base({ errorUniones: { code: "PGRST205" } });
    const ig = instagram(5);
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: ig.contacto }, ig.evento, REGISTRO);
    expect(api.leerAtributosContacto).not.toHaveBeenCalled();
    const wa = evento();
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: wa.contacto }, wa.evento, REGISTRO);
    expect(b.rpc).toHaveBeenCalledWith("chatwoot_segmento_contacto", { p_tenant_id: T1, p_phone_last10: "4125550101" });
  });

  it.each([
    ["la lectura de la unión", { errorUniones: { code: "57014" } }, /chatwoot_contact_links: 57014/],
    ["el segmento de la ficha", { errorSegmento: { code: "XX000" } }, /crm_segmento_cliente: XX000/],
  ])("si falla %s, lanza con el código y sin escribir", async (_n, opciones, mensaje) => {
    const b = base(opciones);
    const e = instagram(5);
    await expect(marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO)).rejects.toThrow(mensaje);
    expect(api.escribirAtributosContacto).not.toHaveBeenCalled();
  });

  it("apagado sin CHATWOOT_ATRIBUTOS_CONTACTO=1: ni mira la unión", async () => {
    vi.stubEnv("CHATWOOT_ATRIBUTOS_CONTACTO", "");
    const b = base();
    const e = instagram(5);
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);
    expect(b.from).not.toHaveBeenCalled();
  });
});

describe("vincularContacto (RPC nueva, con caída a la 0554)", () => {
  const args = { tenantId: T1, actorId: "u-1", clientId: FICHA, contactoId: 5, canal: "instagram" as const, motivo: "Vinculado desde la conversación 9", mover: false };

  it("usa la RPC nueva y traduce su respuesta", async () => {
    const rpc = vi.fn(async () => ({ data: { resultado: "ya_estaba", tarjeta_absorbida: false }, error: null }));
    expect(await vincularContacto({ rpc } as never, args)).toEqual({ ok: true, resultado: "ya_estaba", tarjetaAbsorbida: false });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("un rechazo de la base no cae en la RPC vieja", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "23505" } }));
    expect(await vincularContacto({ rpc } as never, args)).toEqual({ ok: false, codigo: "23505", sinMigracion: false });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("solo si la función nueva no existe (PGRST202 o 42883) une con la de la 0554", async () => {
    for (const codigo of ["PGRST202", "42883"]) {
      const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: { code: codigo } }).mockResolvedValueOnce({ data: "ya_estaba", error: null });
      expect(await vincularContacto({ rpc } as never, args)).toEqual({ ok: true, resultado: "ya_estaba", tarjetaAbsorbida: false });
      expect((rpc.mock.calls[1] as unknown[])[0]).toBe("chatwoot_unir_contacto_manual");
    }
  });
});
