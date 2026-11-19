// @vitest-environment node
/**
 * SDD-0649 · segmento y Shipping Mark del ERP en el contacto de Chatwoot.
 * La base y la API de Chatwoot son dobles; el segmento lo decide la 0505 (su
 * contrato está en su propia prueba). Aquí se prueba qué escribe el manejador,
 * cuándo no escribe y que no filtra datos personales en los logs.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const api = vi.hoisted(() => ({
  obtenerConversacionYContacto: vi.fn(),
  leerAtributosContacto: vi.fn(),
  escribirAtributosContacto: vi.fn(),
}));
vi.mock("../router-api", async (original) => ({ ...(await original<typeof import("../router-api")>()), ...api }));
vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: async () => ({ chatwoot_inbox: false }) }));
vi.mock("@/lib/studio/notify/operario-push-outbox", () => ({ enqueueUserPush: vi.fn(), drainOperarioPushOutbox: vi.fn() }));

import { atributosPorEscribir, shippingMarkVisible, SIN_FICHA } from "../contacto-erp";
import { marcarContactoErp } from "../contacto-erp-manejador";
import { MANEJADORES } from "../webhook-procesar";
import { interpretarContactoDelEvento, interpretarEvento, type EventoChatwoot } from "../webhook-events";
import { conversacionSintetica, mensajeCreado } from "./webhook-fixtures";

const T1 = "10000000-0000-4000-8000-000000000001";
const CODIGO = "DTD-T0001";
const INBOX_LEADS = 3;
const INBOX_CLIENTES = 7;
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

type Fila = { markbox: unknown };

function base(opciones: { segmento?: unknown; fichas?: Fila[]; fallaRpc?: boolean; fallaFichas?: boolean } = {}) {
  const filtros: [string, unknown][] = [];
  const rpc = vi.fn(async (nombre: string) => {
    if (nombre !== "chatwoot_segmento_contacto") throw new Error(`RPC inesperada ${nombre}`);
    if (opciones.fallaRpc) return { data: null, error: { code: "XX000" } };
    return { data: opciones.segmento ?? "lead_nuevo", error: null };
  });
  const consulta = {} as { select: Mock; eq: Mock; is: Mock; limit: Mock };
  consulta.select = vi.fn(() => consulta);
  consulta.eq = vi.fn((col: string, val: unknown) => {
    filtros.push([col, val]);
    return consulta;
  });
  consulta.is = vi.fn((col: string, val: unknown) => {
    filtros.push([col, val]);
    return consulta;
  });
  consulta.limit = vi.fn(async () =>
    opciones.fallaFichas ? { data: null, error: { code: "57014" } } : { data: opciones.fichas ?? [{ markbox: CODIGO }], error: null },
  );
  // SDD-0676: el manejador mira primero la unión del contacto; aquí nadie está unido
  // (ese camino tiene su prueba en contacto-erp-union.test.ts).
  const sinUniones = {
    select: () => sinUniones,
    eq: () => sinUniones,
    limit: async () => ({ data: [], error: null }),
  };
  const from = vi.fn((tabla: string) => {
    if (tabla === "chatwoot_contact_links") return sinUniones;
    if (tabla !== "clients") throw new Error(`tabla inesperada ${tabla}`);
    return consulta;
  });
  const admin = { rpc, from } as unknown as Parameters<typeof marcarContactoErp>[0]["admin"];
  return { admin, rpc, from, consulta, filtros };
}

function evento(conv: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  const payload = mensajeCreado({ conversation: conversacionSintetica(conv), ...extra });
  return { evento: interpretarEvento(payload) as EventoChatwoot, contacto: interpretarContactoDelEvento(payload) };
}
const REGISTRO = { nuevo: true, aplicado: true, clientId: null };

beforeEach(() => {
  vi.clearAllMocks();
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  api.leerAtributosContacto.mockResolvedValue({ ok: true, data: { otro: "se conserva" } });
  api.escribirAtributosContacto.mockResolvedValue({ ok: true, data: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("reglas puras (SDD-0649)", () => {
  it("escribe los dos atributos cuando faltan", () => {
    expect(atributosPorEscribir({}, { segmento: "cliente", shippingMark: CODIGO })).toEqual({
      dtd_segmento: "cliente",
      dtd_shipping_mark: CODIGO,
    });
  });

  it("no escribe si ya están iguales; un texto vacío cuenta como sin código", () => {
    expect(atributosPorEscribir({ dtd_segmento: "cliente", dtd_shipping_mark: CODIGO }, { segmento: "cliente", shippingMark: CODIGO })).toBeNull();
    expect(atributosPorEscribir({ dtd_segmento: "lead_nuevo", dtd_shipping_mark: "" }, SIN_FICHA)).toBeNull();
    expect(atributosPorEscribir({ dtd_segmento: "lead_nuevo" }, SIN_FICHA)).toBeNull();
  });

  it("borra un código anterior cuando ya no hay ficha única", () => {
    expect(atributosPorEscribir({ dtd_segmento: "cliente", dtd_shipping_mark: CODIGO }, SIN_FICHA)).toEqual({
      dtd_segmento: "lead_nuevo",
      dtd_shipping_mark: null,
    });
  });

  it("solo devuelve los dos atributos propios, nunca los demás", () => {
    const r = atributosPorEscribir({ otro: "x" }, { segmento: "lead_registrado", shippingMark: CODIGO });
    expect(Object.keys(r ?? {}).sort()).toEqual(["dtd_segmento", "dtd_shipping_mark"]);
  });

  it.each([
    [` ${CODIGO} `, CODIGO],
    ["", null],
    ["   ", null],
    ["DTD 0001", null],
    ["X".repeat(41), null],
    [null, null],
    [42, null],
  ])("shippingMarkVisible(%j) = %j", (entrada, esperado) => {
    expect(shippingMarkVisible(entrada)).toBe(esperado);
  });
});

describe("marcarContactoErp (SDD-0649)", () => {
  it("está en MANEJADORES, después de clasificarContacto", () => {
    expect(MANEJADORES).toContain(marcarContactoErp);
  });

  it("cliente con ficha única: escribe segmento y Shipping Mark, con el filtro de la 0505", async () => {
    const b = base({ segmento: "cliente" });
    const e = evento();
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);

    expect(b.rpc).toHaveBeenCalledWith("chatwoot_segmento_contacto", { p_tenant_id: T1, p_phone_last10: "4125550101" });
    expect(b.consulta.select).toHaveBeenCalledWith("markbox");
    expect(b.filtros).toEqual([
      ["tenant_id", T1],
      ["phone_last10", "4125550101"],
      ["deleted_at", null],
    ]);
    expect(b.consulta.limit).toHaveBeenCalledWith(2);
    expect(api.leerAtributosContacto).toHaveBeenCalledWith(expect.anything(), 5);
    expect(api.escribirAtributosContacto).toHaveBeenCalledWith(expect.anything(), 5, {
      dtd_segmento: "cliente",
      dtd_shipping_mark: CODIGO,
    });
  });

  it("lead registrado: segmento lead_registrado y su código", async () => {
    const b = base({ segmento: "lead_registrado" });
    const e = evento();
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);
    expect(api.escribirAtributosContacto).toHaveBeenCalledWith(expect.anything(), 5, {
      dtd_segmento: "lead_registrado",
      dtd_shipping_mark: CODIGO,
    });
  });

  it("lead nuevo: no busca la ficha y borra un código anterior", async () => {
    const b = base({ segmento: "lead_nuevo" });
    api.leerAtributosContacto.mockResolvedValueOnce({ ok: true, data: { dtd_segmento: "cliente", dtd_shipping_mark: CODIGO } });
    const e = evento();
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);
    // La unión del contacto se mira siempre (SDD-0676); la ficha por teléfono, no.
    expect(b.from).not.toHaveBeenCalledWith("clients");
    expect(api.escribirAtributosContacto).toHaveBeenCalledWith(expect.anything(), 5, {
      dtd_segmento: "lead_nuevo",
      dtd_shipping_mark: null,
    });
  });

  it("sin teléfono: lead_nuevo sin consultar el ERP", async () => {
    const b = base({ segmento: "cliente" });
    const e = evento({ meta: { sender: { id: 5, name: "Sin teléfono" } } });
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);
    expect(b.rpc).not.toHaveBeenCalled();
    expect(api.escribirAtributosContacto).toHaveBeenCalledWith(expect.anything(), 5, {
      dtd_segmento: "lead_nuevo",
      dtd_shipping_mark: null,
    });
  });

  it("si la ficha dejó de ser única entre la regla y la lectura, no copia un código", async () => {
    const b = base({ segmento: "cliente", fichas: [{ markbox: CODIGO }, { markbox: "DTD-T0002" }] });
    const e = evento();
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);
    expect(api.escribirAtributosContacto).toHaveBeenCalledWith(expect.anything(), 5, {
      dtd_segmento: "lead_nuevo",
      dtd_shipping_mark: null,
    });
  });

  it("si ya están bien, no escribe", async () => {
    const b = base({ segmento: "cliente" });
    api.leerAtributosContacto.mockResolvedValueOnce({ ok: true, data: { dtd_segmento: "cliente", dtd_shipping_mark: CODIGO } });
    const e = evento();
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);
    expect(api.escribirAtributosContacto).not.toHaveBeenCalled();
  });

  it("también en la bandeja de Clientes (D5)", async () => {
    const b = base({ segmento: "cliente" });
    const e = evento({ inbox_id: INBOX_CLIENTES });
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);
    expect(api.escribirAtributosContacto).toHaveBeenCalledTimes(1);
  });

  it("en otra bandeja (portal, Archivo Kommo, correo) no hace nada", async () => {
    const b = base({ segmento: "cliente" });
    const e = evento({ inbox_id: 8 });
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);
    expect(b.rpc).not.toHaveBeenCalled();
    expect(api.leerAtributosContacto).not.toHaveBeenCalled();
  });

  it.each(["", "0", "si", "true", " 2 "])("apagado con CHATWOOT_ATRIBUTOS_CONTACTO=%j: no toca nada", async (valor) => {
    vi.stubEnv("CHATWOOT_ATRIBUTOS_CONTACTO", valor);
    const b = base({ segmento: "cliente" });
    const e = evento();
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);
    expect(b.rpc).not.toHaveBeenCalled();
    expect(api.leerAtributosContacto).not.toHaveBeenCalled();
    expect(api.escribirAtributosContacto).not.toHaveBeenCalled();
  });

  it("un mensaje saliente o privado no hace nada", async () => {
    const b = base({ segmento: "cliente" });
    const e = evento({}, { message_type: "outgoing" });
    await marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO);
    expect(api.leerAtributosContacto).not.toHaveBeenCalled();
  });

  it("reproceso sin contacto: lee la conversación y el contacto de Chatwoot", async () => {
    const b = base({ segmento: "cliente" });
    const e = evento();
    api.obtenerConversacionYContacto.mockResolvedValueOnce({ ok: true, data: { conversacion: e.evento.conversacion, contacto: e.contacto } });
    await marcarContactoErp({ admin: b.admin, tenantId: T1 }, e.evento, REGISTRO);
    expect(api.obtenerConversacionYContacto).toHaveBeenCalledWith(expect.anything(), 12);
    expect(api.escribirAtributosContacto).toHaveBeenCalledWith(expect.anything(), 5, expect.objectContaining({ dtd_segmento: "cliente" }));
  });

  it.each([
    ["la regla de la 0505", { fallaRpc: true }, /chatwoot_segmento_contacto: XX000/],
    ["la lectura de la ficha", { fallaFichas: true }, /clients: 57014/],
  ])("si falla %s, lanza con el código y sin escribir", async (_n, opciones, mensaje) => {
    const b = base({ segmento: "cliente", ...opciones });
    const e = evento();
    await expect(marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO)).rejects.toThrow(mensaje);
    expect(api.escribirAtributosContacto).not.toHaveBeenCalled();
  });

  it("si falla leer o escribir en Chatwoot, lanza para que el reproceso lo retome", async () => {
    const e = evento();
    api.leerAtributosContacto.mockResolvedValueOnce({ ok: false, error: "http_500" });
    await expect(
      marcarContactoErp({ admin: base({ segmento: "cliente" }).admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO),
    ).rejects.toThrow("atributos: http_500");
    api.escribirAtributosContacto.mockResolvedValueOnce({ ok: false, error: "no_autorizado" });
    await expect(
      marcarContactoErp({ admin: base({ segmento: "cliente" }).admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO),
    ).rejects.toThrow("atributos: no_autorizado");
  });

  it("segmento desconocido: lanza sin escribir", async () => {
    const b = base({ segmento: "vip" });
    const e = evento();
    await expect(marcarContactoErp({ admin: b.admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO)).rejects.toThrow(
      "segmento desconocido",
    );
    expect(api.escribirAtributosContacto).not.toHaveBeenCalled();
  });

  it("los errores no llevan teléfono, código ni nombre", async () => {
    const e = evento();
    api.escribirAtributosContacto.mockResolvedValueOnce({ ok: false, error: "http_422" });
    const error = await marcarContactoErp({ admin: base({ segmento: "cliente" }).admin, tenantId: T1, contacto: e.contacto }, e.evento, REGISTRO).catch(
      (err: Error) => err,
    );
    const texto = String((error as Error).message);
    expect(texto).not.toMatch(/4125550101|DTD-T0001|Sintetico/);
  });
});
