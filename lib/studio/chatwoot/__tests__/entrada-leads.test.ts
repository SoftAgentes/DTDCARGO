// @vitest-environment node
/**
 * SDD-0587 · entrarLead (6.4). La base y la API de Chatwoot son dobles; lo que las
 * RPC hacen con estos datos, y que correrlas dos veces no tenga efecto doble, está
 * en el contrato de crm-entrada.migration.test.ts. Aquí se prueba qué le pide el
 * manejador a la base con cada evento, y que no filtra datos personales.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ obtenerConversacionYContacto: vi.fn() }));
vi.mock("../router-api", async (original) => ({ ...(await original<typeof import("../router-api")>()), ...api }));
vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: async () => ({ chatwoot_inbox: false }) }));
vi.mock("@/lib/studio/notify/operario-push-outbox", () => ({ enqueueUserPush: vi.fn(), drainOperarioPushOutbox: vi.fn() }));

import { entrarLead, fuenteDeCanal } from "../entrada-leads";
import { MANEJADORES, procesarEventoChatwoot, type ContextoChatwoot } from "../webhook-procesar";
import { interpretarContactoDelEvento, interpretarEvento, type EventoChatwoot } from "../webhook-events";
import {
  NOMBRE_SINTETICO,
  TEXTO_SINTETICO,
  conversacionAsignada,
  conversacionCreada,
  conversacionSintetica,
  estadoCambiado,
  mensajeCreado,
} from "./webhook-fixtures";

const T1 = "10000000-0000-4000-8000-000000000001";
const INBOX_LEADS = 3;
const INBOX_CLIENTES = 4;
const REGISTRO = { nuevo: true, aplicado: true, clientId: null };

type Rpc = (nombre: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { code: string } | null }>;

function base(error?: { code: string }) {
  const rpc = vi.fn<Rpc>(async () => ({ data: error ? null : [{ tarjeta_id: "t", creada: true, volvio: false }], error: error ?? null }));
  return { rpc } as unknown as ContextoChatwoot["admin"] & { rpc: typeof rpc };
}

/** Lo que hace la ruta: interpreta el payload y pasa el contacto aparte. */
function delPayload(payload: Record<string, unknown>, admin = base()) {
  const evento = interpretarEvento(payload) as EventoChatwoot;
  return { evento, admin, ctx: { admin, tenantId: T1, contacto: interpretarContactoDelEvento(payload) } };
}

const mensaje = (conv: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  mensajeCreado({ conversation: conversacionSintetica({ channel: "Channel::Whatsapp", ...conv }), ...extra });
const args = (a: ReturnType<typeof base>) => a.rpc.mock.calls[0]?.[1] as Record<string, unknown>;
const nombres = (a: ReturnType<typeof base>) => a.rpc.mock.calls.map(([n]) => n);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CHATWOOT_INBOX_LEADS_ID", String(INBOX_LEADS));
  vi.stubEnv("CHATWOOT_INBOX_CLIENTES_ID", String(INBOX_CLIENTES));
  vi.stubEnv("CHATWOOT_ROUTER_TOKEN", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("entrarLead: crear o completar la tarjeta (SDD-0587, 6.4)", () => {
  it("mensaje entrante: la RPC recibe contacto, teléfono, nombre, fuente, agente y la clave del mensaje", async () => {
    const { ctx, evento, admin } = delPayload(mensaje());
    await entrarLead(ctx, evento, REGISTRO);
    expect(nombres(admin)).toEqual(["crm_entrada_chatwoot"]);
    expect(args(admin)).toEqual({
      p_tenant_id: T1,
      p_contact_id: 5,
      p_bsuid: null,
      p_phone_last10: "4125550101",
      p_nombre_visible: NOMBRE_SINTETICO,
      p_fuente: "whatsapp_leads",
      p_agente_chatwoot_id: 7,
      p_clave_mensaje: "message_created:101",
      p_ocurrio_at: new Date(1_761_760_000 * 1000).toISOString(),
    });
  });

  it("la RPC no recibe el texto del mensaje, el correo ni el teléfono completo", async () => {
    const { ctx, evento, admin } = delPayload(mensaje());
    await entrarLead(ctx, evento, REGISTRO);
    const enviado = JSON.stringify(args(admin));
    for (const dato of [TEXTO_SINTETICO, "example.test", "+58", "412-555"]) expect(enviado).not.toContain(dato);
  });

  it("conversation_created: crea sin clave de mensaje, porque no dice que haya vuelto", async () => {
    const { ctx, evento, admin } = delPayload(conversacionCreada());
    await entrarLead(ctx, evento, REGISTRO);
    expect(nombres(admin)).toEqual(["crm_entrada_chatwoot"]);
    expect(args(admin)).toMatchObject({ p_clave_mensaje: null, p_contact_id: 5, p_fuente: "whatsapp_leads" });
  });

  it("correrlo dos veces le pide a la base exactamente lo mismo: la idempotencia está en la RPC", async () => {
    const { ctx, evento, admin } = delPayload(mensaje());
    await entrarLead(ctx, evento, REGISTRO);
    await entrarLead(ctx, evento, REGISTRO);
    expect(a2(admin)).toEqual(args(admin));
  });

  it.each([
    ["saliente", { message_type: "outgoing" }],
    ["nota privada", { private: true }],
    ["actividad", { message_type: "activity" }],
  ])("mensaje %s: no entra nadie", async (_caso, extra) => {
    const { ctx, evento, admin } = delPayload(mensaje({}, extra));
    await entrarLead(ctx, evento, REGISTRO);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("conversation_status_changed: no hace nada", async () => {
    const { ctx, evento, admin } = delPayload(estadoCambiado({ channel: "Channel::Whatsapp" }));
    await entrarLead(ctx, evento, REGISTRO);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("un bot asignado no es un asesor: el agente va nulo y la tarjeta se crea igual", async () => {
    const meta = { sender: { id: 5, name: NOMBRE_SINTETICO }, assignee: { id: 7 }, assignee_type: "AgentBot" };
    const { ctx, evento, admin } = delPayload(mensaje({ meta }));
    await entrarLead(ctx, evento, REGISTRO);
    expect(args(admin)).toMatchObject({ p_agente_chatwoot_id: null, p_contact_id: 5 });
  });

  it("sin teléfono trae el BSUID como llave de respaldo", async () => {
    const conv = { meta: { sender: { id: 5, name: "Solo Usuario" } }, contact_inbox: { source_id: "VE.5550000000000000001" } };
    const { ctx, evento, admin } = delPayload(mensaje(conv));
    await entrarLead(ctx, evento, REGISTRO);
    expect(args(admin)).toMatchObject({ p_bsuid: "VE.5550000000000000001", p_phone_last10: null, p_contact_id: 5 });
  });

  it("sin contacto ni BSUID no hay por dónde ubicarla: no llama a la base", async () => {
    const { ctx, evento, admin } = delPayload(mensaje({ meta: { sender: {} } }));
    await entrarLead(ctx, evento, REGISTRO);
    expect(admin.rpc).not.toHaveBeenCalled();
  });
});

describe("entrarLead: asesor con conversation_updated (SDD-0587, §5.4)", () => {
  it("con asignado: pide el asesor con el contacto y el agente, y no crea tarjeta", async () => {
    const { ctx, evento, admin } = delPayload(conversacionAsignada());
    await entrarLead(ctx, evento, REGISTRO);
    expect(nombres(admin)).toEqual(["crm_asesor_desde_chatwoot"]);
    expect(args(admin)).toEqual({
      p_tenant_id: T1,
      p_contact_id: 5,
      p_bsuid: null,
      p_phone_last10: "4125550101",
      p_agente_chatwoot_id: 7,
    });
  });

  it("sin asignado (lo desasignaron): no llama a la base", async () => {
    const { ctx, evento, admin } = delPayload(conversacionAsignada({ meta: { sender: { id: 5 }, assignee: null } }));
    await entrarLead(ctx, evento, REGISTRO);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("asignado a un bot: no le da asesor", async () => {
    const meta = { sender: { id: 5 }, assignee: { id: 7 }, assignee_type: "AgentBot" };
    const { ctx, evento, admin } = delPayload(conversacionAsignada({ meta }));
    await entrarLead(ctx, evento, REGISTRO);
    expect(admin.rpc).not.toHaveBeenCalled();
  });
});

describe("fuenteDeCanal (SDD-0587, §3)", () => {
  it.each([
    ["Channel::Whatsapp", INBOX_LEADS, "whatsapp_leads"],
    ["Channel::Whatsapp", INBOX_CLIENTES, "whatsapp_clientes"],
    ["Channel::Instagram", 9, "instagram"],
    ["Channel::FacebookPage", 9, "messenger"],
    ["Channel::Email", 9, "correo"],
  ])("%s en la bandeja %i → %s", (canal, bandeja, fuente) => {
    expect(fuenteDeCanal(canal, bandeja)).toBe(fuente);
  });

  it.each([
    ["la bandeja API del Archivo Kommo", "Channel::Api", INBOX_LEADS],
    ["el chat del sitio, que no está en el alcance", "Channel::WebWidget", INBOX_LEADS],
    ["canal desconocido", null, INBOX_LEADS],
    ["un WhatsApp que no es ni el de leads ni el de clientes", "Channel::Whatsapp", 77],
    ["un WhatsApp sin bandeja", "Channel::Whatsapp", null],
  ])("%s → sin tarjeta", (_caso, canal, bandeja) => {
    expect(fuenteDeCanal(canal, bandeja)).toBeNull();
  });

  it("sin las bandejas configuradas no atribuye a ciegas, porque la fuente no se pisa", () => {
    vi.stubEnv("CHATWOOT_INBOX_LEADS_ID", "");
    vi.stubEnv("CHATWOOT_INBOX_CLIENTES_ID", "");
    expect(fuenteDeCanal("Channel::Whatsapp", INBOX_LEADS)).toBeNull();
    expect(fuenteDeCanal("Channel::Whatsapp", null)).toBeNull();
  });

  it("una conversación de la bandeja API no crea tarjeta", async () => {
    const { ctx, evento, admin } = delPayload(conversacionCreada({ channel: "Channel::Api" }));
    await entrarLead(ctx, evento, REGISTRO);
    expect(admin.rpc).not.toHaveBeenCalled();
  });
});

describe("entrarLead: fallos y reproceso (SDD-0587, §5.2)", () => {
  it("si la base falla, lanza con el código para que el evento quede fallido y se reintente", async () => {
    const { ctx, evento } = delPayload(mensaje(), base({ code: "XX000" }));
    await expect(entrarLead(ctx, evento, REGISTRO)).rejects.toThrow(/crm_entrada_chatwoot: XX000/);
    const asignado = delPayload(conversacionAsignada(), base({ code: "57014" }));
    await expect(entrarLead(asignado.ctx, asignado.evento, REGISTRO)).rejects.toThrow(/crm_asesor_desde_chatwoot: 57014/);
  });

  it.each(["PGRST202", "PGRST205", "42883", "42P01"])("sin la migración (%s) no lanza: no marca fallido cada mensaje", async (code) => {
    const { ctx, evento } = delPayload(mensaje(), base({ code }));
    await expect(entrarLead(ctx, evento, REGISTRO)).resolves.toBeUndefined();
    const asignado = delPayload(conversacionAsignada(), base({ code }));
    await expect(entrarLead(asignado.ctx, asignado.evento, REGISTRO)).resolves.toBeUndefined();
  });

  const paraReproceso = () => {
    const e = interpretarEvento(mensaje()) as EventoChatwoot;
    e.conversacion = { ...e.conversacion, inboxId: null, telefonoUltimos10: null };
    return e;
  };

  it("reproceso: lee conversación y contacto de Chatwoot y usa lo leído", async () => {
    vi.stubEnv("CHATWOOT_URL", "https://chat.ejemplo.test");
    vi.stubEnv("CHATWOOT_ROUTER_TOKEN", "tok-router-sintetico");
    vi.stubEnv("CHATWOOT_ACCOUNT_ID", "1");
    vi.stubEnv("CHATWOOT_TEAM_CLIENTES_ID", "21");
    vi.stubEnv("CHATWOOT_TEAM_LEADS_ID", "22");
    vi.stubEnv("WHATSAPP_NUMERO_CLIENTES", "584125550999");
    const leido = interpretarEvento(mensaje()) as EventoChatwoot;
    api.obtenerConversacionYContacto.mockResolvedValueOnce({
      ok: true,
      data: { conversacion: leido.conversacion, contacto: { contactoId: 5, nombre: "Leido", canal: "Channel::Whatsapp", asignadoEsBot: false } },
    });
    const a = base();
    await entrarLead({ admin: a, tenantId: T1 }, paraReproceso(), REGISTRO);
    expect(api.obtenerConversacionYContacto).toHaveBeenCalledWith(expect.anything(), 12);
    expect(args(a)).toMatchObject({ p_contact_id: 5, p_nombre_visible: "Leido", p_phone_last10: "4125550101", p_clave_mensaje: "message_created:101" });
  });

  it("reproceso sin poder leer: lanza, y el cron lo intenta otra vez", async () => {
    vi.stubEnv("CHATWOOT_URL", "https://chat.ejemplo.test");
    vi.stubEnv("CHATWOOT_ROUTER_TOKEN", "tok-router-sintetico");
    vi.stubEnv("CHATWOOT_ACCOUNT_ID", "1");
    vi.stubEnv("CHATWOOT_TEAM_CLIENTES_ID", "21");
    vi.stubEnv("CHATWOOT_TEAM_LEADS_ID", "22");
    vi.stubEnv("WHATSAPP_NUMERO_CLIENTES", "584125550999");
    api.obtenerConversacionYContacto.mockResolvedValueOnce({ ok: false, error: "red" });
    await expect(entrarLead({ admin: base(), tenantId: T1 }, paraReproceso(), REGISTRO)).rejects.toThrow(/conversación: red/);
  });

  it("reproceso sin el token de E10: no lanza ni llama a nadie", async () => {
    const a = base();
    await entrarLead({ admin: a, tenantId: T1 }, paraReproceso(), REGISTRO);
    expect(a.rpc).not.toHaveBeenCalled();
    expect(api.obtenerConversacionYContacto).not.toHaveBeenCalled();
  });

  it("con el contacto del payload no vuelve a leer de Chatwoot", async () => {
    const { ctx, evento } = delPayload(mensaje());
    await entrarLead(ctx, evento, REGISTRO);
    expect(api.obtenerConversacionYContacto).not.toHaveBeenCalled();
  });

  it("los avisos de error no llevan nombre, teléfono ni BSUID", async () => {
    const warn = vi.mocked(console.warn);
    const conv = { contact_inbox: { source_id: "VE.5550000000000000001" } };
    const { ctx, evento } = delPayload(mensaje(conv), base({ code: "42883" }));
    await entrarLead(ctx, evento, REGISTRO);
    fuenteDeCanal("Channel::Whatsapp", 77);
    const texto = JSON.stringify(warn.mock.calls);
    expect(warn).toHaveBeenCalled();
    for (const dato of [NOMBRE_SINTETICO, "4125550101", "VE.555"]) expect(texto).not.toContain(dato);
  });
});

describe("entrarLead en la lista de manejadores (SDD-0587, E2-D25)", () => {
  it("está en MANEJADORES", () => {
    expect(MANEJADORES).toContain(entrarLead);
  });

  it("si falla, el evento queda fallido, pero los otros manejadores corren", async () => {
    const otro = vi.fn(async () => {});
    const rpc = vi.fn<Rpc>(async (nombre) => {
      if (nombre === "chatwoot_registrar_evento") return { data: [{ nuevo: true, aplicado: true, client_id: null }], error: null };
      if (nombre === "chatwoot_cerrar_evento") return { data: true, error: null };
      return { data: null, error: { code: "XX000" } };
    });
    const admin = { rpc } as unknown as ContextoChatwoot["admin"];
    const payload = mensaje();
    const r = await procesarEventoChatwoot(
      { admin, tenantId: T1, contacto: interpretarContactoDelEvento(payload) },
      interpretarEvento(payload) as EventoChatwoot,
      [entrarLead, otro],
    );
    expect(r.estado).toBe("fallido");
    expect(otro).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("chatwoot_cerrar_evento", expect.objectContaining({ p_ok: false }));
  });
});

function a2(a: ReturnType<typeof base>) {
  return a.rpc.mock.calls[1]?.[1] as Record<string, unknown>;
}
