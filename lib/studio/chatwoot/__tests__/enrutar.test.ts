// @vitest-environment node
/**
 * SDD-0586 · clasificarContacto (10.2 y 10.3). La base y la API de Chatwoot son
 * dobles; el segmento lo decide la 0505 (su contrato está en
 * chatwoot-segmento.migration.test.ts). Acá se prueba qué hace el manejador con
 * cada segmento, que responde una sola vez y que no filtra datos personales.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  obtenerConversacion: vi.fn(),
  leerEtiquetas: vi.fn(),
  ponerEtiquetas: vi.fn(),
  asignarEquipo: vi.fn(),
  enviarMensaje: vi.fn(),
}));
vi.mock("../router-api", () => api);
vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: async () => ({ chatwoot_inbox: false }) }));
vi.mock("@/lib/studio/notify/operario-push-outbox", () => ({ enqueueUserPush: vi.fn(), drainOperarioPushOutbox: vi.fn() }));

import { clasificarContacto } from "../enrutar";
import { reprocesarEventosChatwoot } from "../webhook-procesar";
import { interpretarEvento, type ConversacionChatwoot, type EventoChatwoot } from "../webhook-events";
import { TELEFONO_SINTETICO, conversacionSintetica, mensajeCreado } from "./webhook-fixtures";

const T1 = "10000000-0000-4000-8000-000000000001";
const NUMERO_CLIENTES = "584125550999";
const BSUID = "VE.5550000000000000001";
const INBOX_LEADS = 3;
const ENV = {
  CHATWOOT_URL: "https://chat.ejemplo.test",
  CHATWOOT_ROUTER_TOKEN: "tok-router-sintetico",
  CHATWOOT_ACCOUNT_ID: "1",
  CHATWOOT_INBOX_LEADS_ID: String(INBOX_LEADS),
  CHATWOOT_TEAM_CLIENTES_ID: "21",
  CHATWOOT_TEAM_LEADS_ID: "22",
  WHATSAPP_NUMERO_CLIENTES: NUMERO_CLIENTES,
};

type Rpc = (nombre: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { code: string } | null }>;

function base(opciones: { segmento?: unknown; reserva?: boolean; falla?: string } = {}) {
  const rpc = vi.fn<Rpc>(async (nombre) => {
    if (nombre === opciones.falla) return { data: null, error: { code: "XX000" } };
    if (nombre === "chatwoot_segmento_contacto") return { data: opciones.segmento ?? "lead_nuevo", error: null };
    if (nombre === "chatwoot_reservar_respuesta") return { data: opciones.reserva ?? true, error: null };
    if (nombre === "chatwoot_cerrar_respuesta") return { data: true, error: null };
    if (nombre === "chatwoot_guardar_bsuid") return { data: null, error: null };
    if (nombre === "chatwoot_tomar_pendientes") return { data: [], error: null };
    if (nombre === "chatwoot_cerrar_evento") return { data: true, error: null };
    throw new Error(`RPC inesperada ${nombre}`);
  });
  return { rpc } as unknown as Parameters<typeof clasificarContacto>[0]["admin"] & { rpc: typeof rpc };
}

function evento(conv: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): EventoChatwoot {
  return interpretarEvento(mensajeCreado({ conversation: conversacionSintetica({ labels: ["urgente"], ...conv }), ...extra })) as EventoChatwoot;
}
const REGISTRO = { nuevo: true, aplicado: true, clientId: null };
const llamadas = (a: ReturnType<typeof base>) => a.rpc.mock.calls.map(([n]) => n);

beforeEach(() => {
  vi.clearAllMocks();
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  api.ponerEtiquetas.mockResolvedValue({ ok: true, data: null });
  api.asignarEquipo.mockResolvedValue({ ok: true, data: null });
  api.enviarMensaje.mockResolvedValue({ ok: true, data: null });
  api.leerEtiquetas.mockResolvedValue({ ok: true, data: [] });
});
afterEach(() => vi.unstubAllEnvs());

describe("clasificarContacto (SDD-0586, 10.2)", () => {
  it("cliente: un solo mensaje con el enlace wa.me al número de clientes, etiqueta y equipo Clientes", async () => {
    const a = base({ segmento: "cliente" });
    await clasificarContacto({ admin: a, tenantId: T1 }, evento(), REGISTRO);

    expect(a.rpc).toHaveBeenCalledWith("chatwoot_segmento_contacto", { p_tenant_id: T1, p_phone_last10: "4125550101" });
    expect(api.enviarMensaje).toHaveBeenCalledTimes(1);
    const [, conv, texto] = api.enviarMensaje.mock.calls[0];
    expect(conv).toBe(12);
    expect(texto).toContain(`https://wa.me/${NUMERO_CLIENTES}?text=`);
    expect(a.rpc).toHaveBeenCalledWith("chatwoot_reservar_respuesta", { p_tenant_id: T1, p_conversation_id: 12, p_tipo: "redireccion_cliente" });
    expect(a.rpc).toHaveBeenCalledWith("chatwoot_cerrar_respuesta", { p_tenant_id: T1, p_conversation_id: 12, p_enviada: true });
    expect(api.ponerEtiquetas).toHaveBeenCalledWith(expect.anything(), 12, ["urgente", "cliente"]);
    expect(api.asignarEquipo).toHaveBeenCalledWith(expect.anything(), 12, 21);
    // La respuesta sale antes que la etiqueta: si la etiqueta falla, el reintento no responde otra vez.
    expect(api.enviarMensaje.mock.invocationCallOrder[0]).toBeLessThan(api.ponerEtiquetas.mock.invocationCallOrder[0]);
  });

  it("lead registrado: sin mensaje, etiqueta lead-registrado y equipo Leads; reemplaza la de otro segmento", async () => {
    const a = base({ segmento: "lead_registrado" });
    await clasificarContacto({ admin: a, tenantId: T1 }, evento({ labels: ["cliente", "urgente"] }), REGISTRO);
    expect(api.enviarMensaje).not.toHaveBeenCalled();
    expect(llamadas(a)).not.toContain("chatwoot_reservar_respuesta");
    expect(api.ponerEtiquetas).toHaveBeenCalledWith(expect.anything(), 12, ["urgente", "lead-registrado"]);
    expect(api.asignarEquipo).toHaveBeenCalledWith(expect.anything(), 12, 22);
  });

  it("lead nuevo con teléfono: sin mensaje, etiqueta lead-nuevo y equipo Leads", async () => {
    const a = base({ segmento: "lead_nuevo" });
    await clasificarContacto({ admin: a, tenantId: T1 }, evento(), REGISTRO);
    expect(api.enviarMensaje).not.toHaveBeenCalled();
    expect(api.ponerEtiquetas).toHaveBeenCalledWith(expect.anything(), 12, ["urgente", "lead-nuevo"]);
    expect(api.asignarEquipo).toHaveBeenCalledWith(expect.anything(), 12, 22);
  });

  it("si la etiqueta y el equipo ya están, no los vuelve a escribir", async () => {
    const a = base({ segmento: "lead_registrado" });
    const e = evento({ labels: ["lead-registrado"], meta: { sender: { phone_number: TELEFONO_SINTETICO }, team: { id: 22 } } });
    await clasificarContacto({ admin: a, tenantId: T1 }, e, REGISTRO);
    expect(api.ponerEtiquetas).not.toHaveBeenCalled();
    expect(api.asignarEquipo).not.toHaveBeenCalled();
  });

  it("sin etiquetas en el payload las lee de Chatwoot antes de reemplazarlas", async () => {
    const a = base({ segmento: "lead_nuevo" });
    api.leerEtiquetas.mockResolvedValueOnce({ ok: true, data: ["vip"] });
    await clasificarContacto({ admin: a, tenantId: T1 }, evento({ labels: undefined }), REGISTRO);
    expect(api.leerEtiquetas).toHaveBeenCalledTimes(1);
    expect(api.ponerEtiquetas).toHaveBeenCalledWith(expect.anything(), 12, ["vip", "lead-nuevo"]);
  });

  it("ya respondida en las últimas 24 h (reserva tomada): no envía otra vez", async () => {
    const a = base({ segmento: "cliente", reserva: false });
    await clasificarContacto({ admin: a, tenantId: T1 }, evento(), REGISTRO);
    expect(api.enviarMensaje).not.toHaveBeenCalled();
    expect(llamadas(a)).not.toContain("chatwoot_cerrar_respuesta");
    expect(api.asignarEquipo).toHaveBeenCalledWith(expect.anything(), 12, 21);
  });

  it("Chatwoot rechaza el envío: libera la reserva y lanza para que el reintento responda", async () => {
    const a = base({ segmento: "cliente" });
    api.enviarMensaje.mockResolvedValueOnce({ ok: false, error: "http_500" });
    await expect(clasificarContacto({ admin: a, tenantId: T1 }, evento(), REGISTRO)).rejects.toThrow(/respuesta: http_500/);
    expect(a.rpc).toHaveBeenCalledWith("chatwoot_cerrar_respuesta", { p_tenant_id: T1, p_conversation_id: 12, p_enviada: false });
  });

  it("envío incierto (red): deja la reserva, no lanza y sigue con etiqueta y equipo", async () => {
    const a = base({ segmento: "cliente" });
    api.enviarMensaje.mockResolvedValueOnce({ ok: false, error: "red" });
    await clasificarContacto({ admin: a, tenantId: T1 }, evento(), REGISTRO);
    expect(llamadas(a)).not.toContain("chatwoot_cerrar_respuesta");
    expect(api.asignarEquipo).toHaveBeenCalledWith(expect.anything(), 12, 21);
  });

  it("si el ERP falla, lanza sin responder ni etiquetar", async () => {
    const a = base({ falla: "chatwoot_segmento_contacto" });
    await expect(clasificarContacto({ admin: a, tenantId: T1 }, evento(), REGISTRO)).rejects.toThrow(/chatwoot_segmento_contacto: XX000/);
    expect(api.enviarMensaje).not.toHaveBeenCalled();
    expect(api.ponerEtiquetas).not.toHaveBeenCalled();
  });

  it("un segmento que no es de los tres lanza", async () => {
    const a = base({ segmento: "vip" });
    await expect(clasificarContacto({ admin: a, tenantId: T1 }, evento(), REGISTRO)).rejects.toThrow(/segmento desconocido/);
  });

  it("si la etiqueta falla, lanza (el evento queda fallido y se reintenta)", async () => {
    const a = base({ segmento: "lead_nuevo" });
    api.ponerEtiquetas.mockResolvedValueOnce({ ok: false, error: "http_422" });
    await expect(clasificarContacto({ admin: a, tenantId: T1 }, evento(), REGISTRO)).rejects.toThrow(/etiquetas: http_422/);
  });

  it("no actúa en otra bandeja, en mensajes salientes ni sin configuración", async () => {
    const a = base({ segmento: "cliente" });
    await clasificarContacto({ admin: a, tenantId: T1 }, evento({ inbox_id: 9 }), REGISTRO);
    await clasificarContacto({ admin: a, tenantId: T1 }, evento({}, { message_type: "outgoing" }), REGISTRO);
    vi.stubEnv("WHATSAPP_NUMERO_CLIENTES", "");
    await clasificarContacto({ admin: a, tenantId: T1 }, evento(), REGISTRO);
    expect(a.rpc).not.toHaveBeenCalled();
    expect(api.enviarMensaje).not.toHaveBeenCalled();
  });

  it("el número de clientes sale de la configuración, no del código", async () => {
    vi.stubEnv("WHATSAPP_NUMERO_CLIENTES", "15555550100");
    const a = base({ segmento: "cliente" });
    await clasificarContacto({ admin: a, tenantId: T1 }, evento(), REGISTRO);
    expect(api.enviarMensaje.mock.calls[0][2]).toContain("https://wa.me/15555550100?text=");
  });
});

describe("clasificarContacto sin teléfono (SDD-0586, 10.3)", () => {
  const sinTelefono = (bsuid: string | null) =>
    evento({ meta: { sender: { id: 5, name: "Contacto Sintetico E2" } }, contact_inbox: bsuid ? { source_id: bsuid } : undefined });

  it("guarda el BSUID, no consulta al ERP y responde la neutra", async () => {
    const a = base();
    await clasificarContacto({ admin: a, tenantId: T1 }, sinTelefono(BSUID), REGISTRO);
    expect(a.rpc).toHaveBeenCalledWith("chatwoot_guardar_bsuid", { p_tenant_id: T1, p_bsuid: BSUID, p_conversation_id: 12 });
    expect(llamadas(a)).not.toContain("chatwoot_segmento_contacto");
    expect(a.rpc).toHaveBeenCalledWith("chatwoot_reservar_respuesta", { p_tenant_id: T1, p_conversation_id: 12, p_tipo: "neutra_sin_telefono" });
    expect(api.enviarMensaje).toHaveBeenCalledTimes(1);
    expect(api.enviarMensaje.mock.calls[0][2]).toContain(`https://wa.me/${NUMERO_CLIENTES}?text=`);
    expect(api.ponerEtiquetas).toHaveBeenCalledWith(expect.anything(), 12, ["urgente", "lead-nuevo"]);
    expect(api.asignarEquipo).toHaveBeenCalledWith(expect.anything(), 12, 22);
  });

  it("la respuesta neutra es la misma para cualquiera: no revela si existe", async () => {
    await clasificarContacto({ admin: base(), tenantId: T1 }, sinTelefono(BSUID), REGISTRO);
    await clasificarContacto({ admin: base(), tenantId: T1 }, sinTelefono("VE.5550000000000000002"), REGISTRO);
    await clasificarContacto({ admin: base(), tenantId: T1 }, sinTelefono(null), REGISTRO);
    const textos = api.enviarMensaje.mock.calls.map(([, , t]) => t);
    expect(textos).toHaveLength(3);
    expect(new Set(textos).size).toBe(1);
    expect(textos[0]).not.toContain(BSUID);
  });

  it("sin BSUID no guarda nada pero responde igual", async () => {
    const a = base();
    await clasificarContacto({ admin: a, tenantId: T1 }, sinTelefono(null), REGISTRO);
    expect(llamadas(a)).not.toContain("chatwoot_guardar_bsuid");
    expect(api.enviarMensaje).toHaveBeenCalledTimes(1);
  });

  it("si guardar el BSUID falla, lanza antes de responder", async () => {
    const a = base({ falla: "chatwoot_guardar_bsuid" });
    await expect(clasificarContacto({ admin: a, tenantId: T1 }, sinTelefono(BSUID), REGISTRO)).rejects.toThrow(/chatwoot_guardar_bsuid/);
    expect(api.enviarMensaje).not.toHaveBeenCalled();
  });
});

describe("reproceso y datos personales (SDD-0586)", () => {
  it("en el reproceso (sin bandeja ni teléfono guardados) lee la conversación de Chatwoot", async () => {
    const a = base({ segmento: "cliente" });
    const pendiente = {
      tenant_id: T1, event_key: "message_created:101", event: "message_created",
      conversation_id: 12, message_id: 101, avisar: true, assignee_id: null,
    };
    a.rpc.mockImplementationOnce(async () => ({ data: [pendiente], error: null }));
    const conv = interpretarEvento(mensajeCreado())!.conversacion as ConversacionChatwoot;
    api.obtenerConversacion.mockResolvedValueOnce({ ok: true, data: { ...conv, etiquetas: [] } });

    const r = await reprocesarEventosChatwoot(a);
    expect(api.obtenerConversacion).toHaveBeenCalledWith(expect.anything(), 12);
    expect(api.enviarMensaje).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ tomados: 1, procesados: 1, fallidos: 0 });
  });

  it("si no puede leer la conversación en el reproceso, lanza", async () => {
    api.obtenerConversacion.mockResolvedValueOnce({ ok: false, error: "red" });
    const e = evento();
    e.conversacion = { ...e.conversacion, inboxId: null, telefonoUltimos10: null };
    await expect(clasificarContacto({ admin: base(), tenantId: T1 }, e, REGISTRO)).rejects.toThrow(/conversación: red/);
  });

  it("los avisos de error no llevan teléfono, BSUID ni token", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    api.enviarMensaje.mockResolvedValueOnce({ ok: false, error: "red" });
    await clasificarContacto({ admin: base({ segmento: "cliente" }), tenantId: T1 }, evento(), REGISTRO);
    const a = base({ falla: "chatwoot_cerrar_respuesta" });
    await clasificarContacto({ admin: a, tenantId: T1 }, evento({ meta: { sender: {} }, contact_inbox: { source_id: BSUID } }), REGISTRO);
    const todo = JSON.stringify(warn.mock.calls);
    expect(warn).toHaveBeenCalled();
    for (const dato of ["4125550101", BSUID, ENV.CHATWOOT_ROUTER_TOKEN, NUMERO_CLIENTES]) expect(todo).not.toContain(dato);
    warn.mockRestore();
  });
});
