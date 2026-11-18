// @vitest-environment node
/**
 * SDD-0586 (10.5, PR 1a) · la ida del chat del portal a Chatwoot.
 *
 * La base y la API de Chatwoot son dobles. El orden por hilo, un solo envío en curso, el
 * corte, el flag en SQL y las esperas los decide la migración (su contrato está en
 * chatwoot-portal.migration.test.ts). Acá se prueba qué hace el servidor con cada fila que
 * le da `chatwoot_portal_tomar`: crear o reusar el contacto y la conversación, mandar el
 * mensaje una sola vez aunque se reintente, cerrar el intento con el código justo y avisar a
 * los administradores con solo números.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  crearContactoPortal: vi.fn(),
  buscarContactoPortal: vi.fn(),
  listarConversacionesContacto: vi.fn(),
  crearConversacionPortal: vi.fn(),
  buscarMensajePorSourceId: vi.fn(),
  crearMensajeEntrante: vi.fn(),
}));
const flags = vi.hoisted(() => ({ chatwoot_portal: true }));
const push = vi.hoisted(() => ({ enqueueUserPush: vi.fn(), drainOperarioPushOutbox: vi.fn() }));
const nextServer = vi.hoisted(() => ({ after: vi.fn() }));
const db = vi.hoisted(() => ({ admin: null as unknown }));

// Solo la red es doble; `envioIncierto` (pura) es la real.
vi.mock("../router-api", async (original) => ({ ...(await original<typeof import("../router-api")>()), ...api }));
vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: vi.fn(async () => ({ ...flags })) }));
vi.mock("@/lib/studio/notify/operario-push-outbox", () => push);
vi.mock("next/server", () => nextServer);
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => db.admin }));

import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";
import { chatwootPortalConfig } from "../config";
import { avisarRezagoPortal, enviarPortalPendientes, pedirEnvioPortal } from "../portal";

const T1 = "10000000-0000-4000-8000-000000000001";
const INBOX_PORTAL = 9;
const ENV = {
  CHATWOOT_URL: "https://chat.ejemplo.test",
  CHATWOOT_ROUTER_TOKEN: "tok-router-sintetico",
  CHATWOOT_ACCOUNT_ID: "1",
  CHATWOOT_TENANT_ID: T1,
  CHATWOOT_INBOX_PORTAL_ID: String(INBOX_PORTAL),
};
const HILO = "20000000-0000-4000-8000-0000000000aa";
const IDENT = "30000000-0000-4000-8000-0000000000bb";
const TEXTO = "Hola, ¿llegó mi caja? Mi teléfono es 0412-555-0101";
const ENVIADO_AT = "2026-11-07T19:00:00.000Z";

interface Fila {
  mensaje_id: string;
  hilo_id: string;
  autor: string | null;
  cuerpo: string;
  enviado_at: string;
  intento: number;
  verificar: boolean;
  identificador: string;
  contacto_id: number | null;
  contacto_source_id: string | null;
  conversacion_id: number | null;
}
const fila = (extra: Partial<Fila> = {}): Fila => ({
  mensaje_id: "40000000-0000-4000-8000-000000000001",
  hilo_id: HILO,
  autor: "Cliente Sintético",
  cuerpo: TEXTO,
  enviado_at: ENVIADO_AT,
  intento: 1,
  verificar: false,
  identificador: IDENT,
  contacto_id: null,
  contacto_source_id: null,
  conversacion_id: null,
  ...extra,
});
const vinculada = (extra: Partial<Fila> = {}) =>
  fila({ contacto_id: 41, contacto_source_id: "src-41", conversacion_id: 9001, ...extra });

type Rpc = (nombre: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { code: string } | null }>;

/** La base: `tomar` da las tandas en orden y después nada; lo demás contesta bien salvo `falla`. */
function base(opciones: {
  tandas?: Fila[][];
  falla?: string;
  rezagados?: { sin_llegar: number; atascados: number };
  admins?: string[];
  yaAvisados?: string[];
  hilosVinculados?: number[];
} = {}) {
  const tandas = [...(opciones.tandas ?? [])];
  const rpc = vi.fn<Rpc>(async (nombre) => {
    if (nombre === opciones.falla) return { data: null, error: { code: "XX000" } };
    if (nombre === "chatwoot_portal_tomar") return { data: tandas.shift() ?? [], error: null };
    if (nombre === "chatwoot_portal_marcar") return { data: "enviado", error: null };
    if (nombre === "chatwoot_portal_vincular") return { data: null, error: null };
    if (nombre === "chatwoot_portal_rezagados") return { data: [opciones.rezagados ?? { sin_llegar: 0, atascados: 0 }], error: null };
    throw new Error(`RPC inesperada ${nombre}`);
  });
  const tablas: Record<string, unknown[]> = {
    user_tenants: (opciones.admins ?? []).map((user_id) => ({ user_id })),
    outbox_push_events: (opciones.yaAvisados ?? []).map((target_id) => ({ target_id })),
    chatwoot_portal_hilos: (opciones.hilosVinculados ?? []).map((chatwoot_conversation_id) => ({ chatwoot_conversation_id })),
  };
  const filtros: { tabla: string; metodo: string; args: unknown[] }[] = [];
  const from = vi.fn((tabla: string) => {
    if (opciones.falla === `from:${tabla}`) {
      const roto = { select: () => roto, eq: () => roto, is: () => roto, in: () => roto, then: (r: (v: unknown) => void) => r({ data: null, error: { code: "XX000" } }) };
      return roto;
    }
    const cadena: Record<string, unknown> = {
      then: (r: (v: unknown) => void) => r({ data: tablas[tabla] ?? [], error: null }),
    };
    for (const metodo of ["select", "eq", "is", "in"]) {
      cadena[metodo] = (...args: unknown[]) => {
        filtros.push({ tabla, metodo, args });
        return cadena;
      };
    }
    return cadena;
  });
  return { rpc, from, filtros } as unknown as Parameters<typeof enviarPortalPendientes>[0] & {
    rpc: typeof rpc;
    from: typeof from;
    filtros: typeof filtros;
  };
}
const llamadas = (a: ReturnType<typeof base>) => a.rpc.mock.calls.map(([n]) => n);
const argsDe = (a: ReturnType<typeof base>, nombre: string) =>
  a.rpc.mock.calls.filter(([n]) => n === nombre).map(([, args]) => args as Record<string, unknown>);

let avisos: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  flags.chatwoot_portal = true;
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  api.crearContactoPortal.mockResolvedValue({ ok: true, data: { contactoId: 41, sourceId: "src-41" } });
  api.buscarContactoPortal.mockResolvedValue({ ok: true, data: null });
  api.listarConversacionesContacto.mockResolvedValue({ ok: true, data: [] });
  api.crearConversacionPortal.mockResolvedValue({ ok: true, data: 9001 });
  api.buscarMensajePorSourceId.mockResolvedValue({ ok: true, data: null });
  api.crearMensajeEntrante.mockResolvedValue({ ok: true, data: 5001 });
  push.enqueueUserPush.mockResolvedValue("push-1");
  avisos = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  avisos.mockRestore();
});

describe("chatwootPortalConfig (§10.5.8)", () => {
  it("con todo, da la bandeja, la cuenta, el tenant y el token", () => {
    expect(chatwootPortalConfig()).toEqual({
      origin: "https://chat.ejemplo.test",
      token: "tok-router-sintetico",
      accountId: 1,
      tenantId: T1,
      inboxPortalId: INBOX_PORTAL,
    });
  });

  it.each(["CHATWOOT_INBOX_PORTAL_ID", "CHATWOOT_ROUTER_TOKEN", "CHATWOOT_ACCOUNT_ID", "CHATWOOT_TENANT_ID"])(
    "sin %s da null",
    (variable) => {
      vi.stubEnv(variable, "");
      expect(chatwootPortalConfig()).toBeNull();
    },
  );

  it("una bandeja que no es un id da null", () => {
    vi.stubEnv("CHATWOOT_INBOX_PORTAL_ID", "09");
    expect(chatwootPortalConfig()).toBeNull();
  });
});

describe("enviarPortalPendientes · sin configuración o apagado, nada", () => {
  it("sin configuración no lee la base ni llama a Chatwoot", async () => {
    vi.stubEnv("CHATWOOT_INBOX_PORTAL_ID", "");
    const admin = base({ tandas: [[fila()]] });
    expect(await enviarPortalPendientes(admin)).toEqual({ tomados: 0, enviados: 0, fallidos: 0, omitido: "sin_configurar" });
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(listFeatureFlags).not.toHaveBeenCalled();
    expect(api.crearMensajeEntrante).not.toHaveBeenCalled();
  });

  it("con el flag apagado no toma nada", async () => {
    flags.chatwoot_portal = false;
    const admin = base({ tandas: [[fila()]] });
    expect(await enviarPortalPendientes(admin)).toEqual({ tomados: 0, enviados: 0, fallidos: 0, omitido: "apagado" });
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(listFeatureFlags).toHaveBeenCalledWith(admin, T1);
  });

  it("sin la migración no rompe", async () => {
    const admin = base({ falla: "chatwoot_portal_tomar" });
    expect(await enviarPortalPendientes(admin)).toEqual({ tomados: 0, enviados: 0, fallidos: 0, omitido: "base" });
    expect(avisos.mock.calls.flat().join(" ")).toContain("XX000");
  });
});

describe("enviarPortalPendientes · el primer mensaje de un hilo", () => {
  it("guarda el contacto, después la conversación, y manda el mensaje entrante con su source_id", async () => {
    const admin = base({ tandas: [[fila()]] });
    expect(await enviarPortalPendientes(admin)).toEqual({ tomados: 1, enviados: 1, fallidos: 0 });

    expect(argsDe(admin, "chatwoot_portal_tomar")[0]).toEqual({ p_tenant_id: T1, p_limite: 10, p_conversation_id: null });
    expect(api.crearContactoPortal).toHaveBeenCalledWith(expect.objectContaining({ accountId: 1 }), {
      inboxId: INBOX_PORTAL,
      nombre: "Cliente Sintético",
      identificador: `dtd-portal:${IDENT}`,
    });
    expect(argsDe(admin, "chatwoot_portal_vincular")).toEqual([
      { p_tenant_id: T1, p_hilo_id: HILO, p_contacto_id: 41, p_contacto_source_id: "src-41", p_inbox_id: null, p_conversacion_id: null },
      { p_tenant_id: T1, p_hilo_id: HILO, p_contacto_id: 41, p_contacto_source_id: "src-41", p_inbox_id: INBOX_PORTAL, p_conversacion_id: 9001 },
    ]);
    expect(api.crearConversacionPortal).toHaveBeenCalledWith(expect.anything(), { inboxId: INBOX_PORTAL, contactoId: 41, sourceId: "src-41" });
    expect(api.crearMensajeEntrante).toHaveBeenCalledWith(expect.anything(), 9001, {
      texto: TEXTO,
      sourceId: "dtd:40000000-0000-4000-8000-000000000001",
    });
    expect(argsDe(admin, "chatwoot_portal_marcar")).toEqual([
      {
        p_tenant_id: T1,
        p_mensaje_id: "40000000-0000-4000-8000-000000000001",
        p_intento: 1,
        p_ok: true,
        p_chatwoot_message_id: 5001,
        p_error: null,
        p_incierto: false,
      },
    ]);
    // El contacto queda guardado ANTES de crear la conversación: un reintento no crea otro.
    const orden = [
      ...llamadas(admin).map((n, i) => ({ n, t: admin.rpc.mock.invocationCallOrder[i] })),
      { n: "crearConversacionPortal", t: api.crearConversacionPortal.mock.invocationCallOrder[0] },
      { n: "crearMensajeEntrante", t: api.crearMensajeEntrante.mock.invocationCallOrder[0] },
    ]
      .sort((a, b) => a.t - b.t)
      .map((x) => x.n);
    expect(orden).toEqual([
      "chatwoot_portal_tomar",
      "chatwoot_portal_vincular",
      "crearConversacionPortal",
      "chatwoot_portal_vincular",
      "crearMensajeEntrante",
      "chatwoot_portal_marcar",
      "chatwoot_portal_tomar",
    ]);
  });

  it("sin nombre, el contacto se llama «Cliente del portal»", async () => {
    await enviarPortalPendientes(base({ tandas: [[fila({ autor: "  " })]] }));
    expect(api.crearContactoPortal.mock.calls[0][1].nombre).toBe("Cliente del portal");
  });

  it("un hilo ya vinculado solo manda el mensaje", async () => {
    const admin = base({ tandas: [[vinculada()]] });
    await enviarPortalPendientes(admin);
    expect(api.crearContactoPortal).not.toHaveBeenCalled();
    expect(api.crearConversacionPortal).not.toHaveBeenCalled();
    expect(api.buscarMensajePorSourceId).not.toHaveBeenCalled();
    expect(argsDe(admin, "chatwoot_portal_vincular")).toEqual([]);
    expect(api.crearMensajeEntrante).toHaveBeenCalledOnce();
  });

  it("procesa en el orden que da tomar y vuelve a tomar hasta que no queda nada", async () => {
    const a = vinculada({ mensaje_id: "m-a", hilo_id: "h-a" });
    const b = vinculada({ mensaje_id: "m-b", hilo_id: "h-b", conversacion_id: 9002 });
    const a2 = vinculada({ mensaje_id: "m-a2", hilo_id: "h-a" });
    const admin = base({ tandas: [[a, b], [a2]] });
    expect(await enviarPortalPendientes(admin)).toEqual({ tomados: 3, enviados: 3, fallidos: 0 });
    expect(api.crearMensajeEntrante.mock.calls.map(([, , d]) => d.sourceId)).toEqual(["dtd:m-a", "dtd:m-b", "dtd:m-a2"]);
    expect(llamadas(admin).filter((n) => n === "chatwoot_portal_tomar")).toHaveLength(3);
  });
});

describe("enviarPortalPendientes · reintentos sin duplicar (E10-D34)", () => {
  it("un error incierto al mandar cierra el intento como incierto, con su código", async () => {
    api.crearMensajeEntrante.mockResolvedValueOnce({ ok: false, error: "red" });
    const admin = base({ tandas: [[vinculada()]] });
    expect(await enviarPortalPendientes(admin)).toEqual({ tomados: 1, enviados: 0, fallidos: 1 });
    expect(argsDe(admin, "chatwoot_portal_marcar")[0]).toMatchObject({ p_ok: false, p_error: "mensaje_red", p_incierto: true });
  });

  it.each([
    ["http_502", true],
    ["http_408", true],
    ["respuesta_invalida", true],
    ["http_422", false],
    ["no_autorizado", false],
  ] as const)("al mandar, %s es incierto: %s", async (error, incierto) => {
    api.crearMensajeEntrante.mockResolvedValueOnce({ ok: false, error });
    const admin = base({ tandas: [[vinculada()]] });
    await enviarPortalPendientes(admin);
    expect(argsDe(admin, "chatwoot_portal_marcar")[0]).toMatchObject({ p_ok: false, p_error: `mensaje_${error}`, p_incierto: incierto });
  });

  it("después de un incierto, busca el source_id y si ya entró no lo reenvía", async () => {
    api.buscarMensajePorSourceId.mockResolvedValueOnce({ ok: true, data: 5001 });
    const admin = base({ tandas: [[vinculada({ intento: 2, verificar: true })]] });
    expect(await enviarPortalPendientes(admin)).toEqual({ tomados: 1, enviados: 1, fallidos: 0 });
    // Busca desde la hora del mensaje de Studio: lo de antes no puede ser él.
    expect(api.buscarMensajePorSourceId).toHaveBeenCalledWith(
      expect.anything(),
      9001,
      "dtd:40000000-0000-4000-8000-000000000001",
      new Date(ENVIADO_AT),
    );
    expect(api.crearMensajeEntrante).not.toHaveBeenCalled();
    expect(argsDe(admin, "chatwoot_portal_marcar")[0]).toMatchObject({ p_intento: 2, p_ok: true, p_chatwoot_message_id: 5001 });
  });

  it("después de un incierto, si no entró, lo manda una vez", async () => {
    const admin = base({ tandas: [[vinculada({ intento: 2, verificar: true })]] });
    await enviarPortalPendientes(admin);
    expect(api.buscarMensajePorSourceId).toHaveBeenCalledOnce();
    expect(api.crearMensajeEntrante).toHaveBeenCalledOnce();
    expect(api.buscarMensajePorSourceId.mock.invocationCallOrder[0]).toBeLessThan(api.crearMensajeEntrante.mock.invocationCallOrder[0]);
  });

  it("si no puede buscar, no reenvía: queda incierto para la próxima", async () => {
    api.buscarMensajePorSourceId.mockResolvedValueOnce({ ok: false, error: "http_503" });
    const admin = base({ tandas: [[vinculada({ verificar: true })]] });
    await enviarPortalPendientes(admin);
    expect(api.crearMensajeEntrante).not.toHaveBeenCalled();
    expect(argsDe(admin, "chatwoot_portal_marcar")[0]).toMatchObject({ p_ok: false, p_error: "mensaje_http_503", p_incierto: true });
  });

  it("si la búsqueda no pudo descartarlo en todas sus páginas, no reenvía", async () => {
    api.buscarMensajePorSourceId.mockResolvedValueOnce({ ok: false, error: "busqueda_incompleta" });
    const admin = base({ tandas: [[vinculada({ verificar: true })]] });
    await enviarPortalPendientes(admin);
    expect(api.crearMensajeEntrante).not.toHaveBeenCalled();
    expect(argsDe(admin, "chatwoot_portal_marcar")[0]).toMatchObject({
      p_ok: false,
      p_error: "mensaje_busqueda_incompleta",
      p_incierto: true,
    });
  });

  it("un contacto que ya existe (422) se busca y se vincula, sin crear otro", async () => {
    api.crearContactoPortal.mockResolvedValueOnce({ ok: false, error: "http_422" });
    api.buscarContactoPortal.mockResolvedValueOnce({ ok: true, data: { contactoId: 77, sourceId: "src-77" } });
    const admin = base({ tandas: [[fila()]] });
    await enviarPortalPendientes(admin);
    expect(api.buscarContactoPortal).toHaveBeenCalledWith(expect.anything(), `dtd-portal:${IDENT}`, INBOX_PORTAL);
    expect(argsDe(admin, "chatwoot_portal_vincular")[0]).toMatchObject({ p_contacto_id: 77, p_contacto_source_id: "src-77" });
    expect(api.crearContactoPortal).toHaveBeenCalledOnce();
  });

  it("después de un incierto sin contacto, busca antes de crear", async () => {
    api.buscarContactoPortal.mockResolvedValueOnce({ ok: true, data: { contactoId: 77, sourceId: "src-77" } });
    const admin = base({ tandas: [[fila({ verificar: true })]] });
    await enviarPortalPendientes(admin);
    expect(api.crearContactoPortal).not.toHaveBeenCalled();
    expect(argsDe(admin, "chatwoot_portal_vincular")[0]).toMatchObject({ p_contacto_id: 77 });
  });

  it("después de un incierto sin conversación, reusa la de la bandeja que no está vinculada", async () => {
    api.listarConversacionesContacto.mockResolvedValueOnce({
      ok: true,
      data: [
        { id: 12, inboxId: 3 },
        { id: 9000, inboxId: INBOX_PORTAL },
        { id: 9005, inboxId: INBOX_PORTAL },
      ],
    });
    // La vinculada a otro hilo es la MÁS NUEVA: si no se descartara, saldría elegida (mutante M13).
    const admin = base({ tandas: [[fila({ contacto_id: 41, contacto_source_id: "src-41", verificar: true })]], hilosVinculados: [9005] });
    await enviarPortalPendientes(admin);
    expect(api.crearConversacionPortal).not.toHaveBeenCalled();
    expect(argsDe(admin, "chatwoot_portal_vincular")[0]).toMatchObject({ p_conversacion_id: 9000, p_inbox_id: INBOX_PORTAL });
    expect(admin.filtros).toContainEqual({ tabla: "chatwoot_portal_hilos", metodo: "eq", args: ["tenant_id", T1] });
    expect(admin.filtros).toContainEqual({ tabla: "chatwoot_portal_hilos", metodo: "in", args: ["chatwoot_conversation_id", [9000, 9005]] });
  });

  it("si la base falla al vincular, el intento queda incierto", async () => {
    const admin = base({ tandas: [[fila()]], falla: "chatwoot_portal_vincular" });
    expect(await enviarPortalPendientes(admin)).toEqual({ tomados: 1, enviados: 0, fallidos: 1 });
    expect(api.crearConversacionPortal).not.toHaveBeenCalled();
    expect(argsDe(admin, "chatwoot_portal_marcar")[0]).toMatchObject({ p_ok: false, p_error: "base", p_incierto: true });
  });

  it("si cerrar el intento falla, no lanza: el colgado se retoma como incierto", async () => {
    const admin = base({ tandas: [[vinculada()]], falla: "chatwoot_portal_marcar" });
    await expect(enviarPortalPendientes(admin)).resolves.toMatchObject({ tomados: 1 });
  });
});

describe("enviarPortalPendientes · datos personales (§10.5.13, punto 2)", () => {
  it("a Chatwoot solo van el nombre, el identificador al azar y el texto", async () => {
    const real = await vi.importActual<typeof import("../router-api")>("../router-api");
    api.crearContactoPortal.mockImplementation(real.crearContactoPortal);
    api.crearConversacionPortal.mockImplementation(real.crearConversacionPortal);
    api.crearMensajeEntrante.mockImplementation(real.crearMensajeEntrante);
    const red = vi.spyOn(globalThis, "fetch");
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    red
      .mockResolvedValueOnce(json({ payload: { contact: { id: 41 }, contact_inbox: { source_id: "src-41" } } }))
      .mockResolvedValueOnce(json({ id: 9001 }))
      .mockResolvedValueOnce(json({ id: 5001 }));
    try {
      await enviarPortalPendientes(base({ tandas: [[fila()]] }));
      const cuerpos = red.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)) as Record<string, unknown>);
      expect(cuerpos.map((c) => Object.keys(c).sort())).toEqual([
        ["identifier", "inbox_id", "name"],
        ["contact_id", "inbox_id", "source_id", "status"],
        ["content", "message_type", "private", "source_id"],
      ]);
      expect(cuerpos[0]).toEqual({ inbox_id: INBOX_PORTAL, name: "Cliente Sintético", identifier: `dtd-portal:${IDENT}` });
      const todo = JSON.stringify(red.mock.calls);
      expect(todo).not.toContain(HILO);
      expect(todo).not.toMatch(/phone|email|markbox|client_id|rif|cedula/i);
    } finally {
      red.mockRestore();
    }
  });

  it("los avisos de error llevan solo códigos: ni texto, ni nombre, ni ids", async () => {
    api.crearMensajeEntrante.mockResolvedValueOnce({ ok: false, error: "http_500" });
    await enviarPortalPendientes(base({ tandas: [[vinculada()]] }));
    const log = avisos.mock.calls.flat().join(" ");
    expect(log).toContain("mensaje_http_500");
    expect(log).not.toContain(TEXTO);
    expect(log).not.toContain("Cliente Sintético");
    expect(log).not.toContain("40000000-0000-4000-8000-000000000001");
    expect(log).not.toContain(HILO);
  });
});

describe("pedirEnvioPortal · el portal no espera a Chatwoot (E10-D24)", () => {
  it("sin configuración no agenda nada", () => {
    vi.stubEnv("CHATWOOT_INBOX_PORTAL_ID", "");
    pedirEnvioPortal(HILO);
    expect(nextServer.after).not.toHaveBeenCalled();
  });

  it("con configuración agenda el envío de ese hilo después de responder", async () => {
    const admin = base({ tandas: [[vinculada()]] });
    db.admin = admin;
    pedirEnvioPortal(HILO);
    expect(nextServer.after).toHaveBeenCalledOnce();
    expect(admin.rpc).not.toHaveBeenCalled();
    await (nextServer.after.mock.calls[0][0] as () => Promise<void>)();
    expect(argsDe(admin, "chatwoot_portal_tomar")[0]).toEqual({ p_tenant_id: T1, p_limite: 1, p_conversation_id: HILO });
    expect(api.crearMensajeEntrante).toHaveBeenCalledOnce();
  });

  it("fuera de un request no lanza", () => {
    nextServer.after.mockImplementationOnce(() => {
      throw new Error("after() fuera de un request");
    });
    expect(() => pedirEnvioPortal(HILO)).not.toThrow();
  });

  it("si el envío agendado lanza, no se propaga", async () => {
    db.admin = { rpc: () => Promise.reject(new Error("caída")) };
    pedirEnvioPortal(HILO);
    await expect((nextServer.after.mock.calls[0][0] as () => Promise<void>)()).resolves.toBeUndefined();
  });
});

describe("avisarRezagoPortal · solo números, una vez por hora (E10-D40)", () => {
  const AHORA = new Date("2026-11-07T20:15:00Z");

  it("avisa a los admins activos con el número de mensajes sin llegar y los atascados", async () => {
    const admin = base({ rezagados: { sin_llegar: 3, atascados: 1 }, admins: ["u-admin-1", "u-admin-2"] });
    expect(await avisarRezagoPortal(admin, AHORA)).toEqual({ avisados: 2, sinLlegar: 3, atascados: 1 });
    expect(argsDe(admin, "chatwoot_portal_rezagados")[0]).toEqual({ p_tenant_id: T1 });
    expect(push.enqueueUserPush).toHaveBeenCalledWith(admin, T1, "u-admin-1", {
      title: "Portal → Chatwoot",
      body: "Portal → Chatwoot: 3 mensajes sin llegar, 1 atascado.",
      url: "/studio/bandeja",
      tag: "chatwoot-portal-rezago",
      claveEvento: "chatwoot-portal-rezago:2026-11-07T20",
    });
    expect(push.drainOperarioPushOutbox).toHaveBeenCalledOnce();
    expect(admin.filtros).toContainEqual({ tabla: "user_tenants", metodo: "eq", args: ["role", "admin"] });
    expect(admin.filtros).toContainEqual({ tabla: "user_tenants", metodo: "is", args: ["disabled_at", null] });
  });

  it("un solo mensaje, en singular y sin atascados", async () => {
    await avisarRezagoPortal(base({ rezagados: { sin_llegar: 1, atascados: 0 }, admins: ["u"] }), AHORA);
    expect(push.enqueueUserPush.mock.calls[0][3].body).toBe("Portal → Chatwoot: 1 mensaje sin llegar.");
  });

  it("en la misma hora no repite a quien ya lo tiene", async () => {
    const admin = base({ rezagados: { sin_llegar: 3, atascados: 0 }, admins: ["u-1", "u-2"], yaAvisados: ["u-1"] });
    expect(await avisarRezagoPortal(admin, AHORA)).toMatchObject({ avisados: 1 });
    expect(push.enqueueUserPush.mock.calls.map(([, , u]) => u)).toEqual(["u-2"]);
    expect(admin.filtros).toContainEqual({
      tabla: "outbox_push_events",
      metodo: "eq",
      args: ["payload->>clave_evento", "chatwoot-portal-rezago:2026-11-07T20"],
    });
  });

  it("sin rezagados no avisa", async () => {
    const admin = base({ admins: ["u"] });
    expect(await avisarRezagoPortal(admin, AHORA)).toEqual({ avisados: 0, sinLlegar: 0, atascados: 0 });
    expect(push.enqueueUserPush).not.toHaveBeenCalled();
  });

  it("apagado o sin configuración no consulta nada", async () => {
    flags.chatwoot_portal = false;
    const apagado = base({ rezagados: { sin_llegar: 3, atascados: 0 }, admins: ["u"] });
    expect(await avisarRezagoPortal(apagado, AHORA)).toEqual({ avisados: 0, sinLlegar: 0, atascados: 0, omitido: "apagado" });
    expect(apagado.rpc).not.toHaveBeenCalled();
    flags.chatwoot_portal = true;
    vi.stubEnv("CHATWOOT_TENANT_ID", "");
    const sinConfig = base({ rezagados: { sin_llegar: 3, atascados: 0 }, admins: ["u"] });
    expect(await avisarRezagoPortal(sinConfig, AHORA)).toEqual({ avisados: 0, sinLlegar: 0, atascados: 0, omitido: "sin_configurar" });
    expect(sinConfig.rpc).not.toHaveBeenCalled();
  });

  it("si no sabe a quién ya avisó, no avisa: mejor la próxima corrida que repetir", async () => {
    const admin = base({ rezagados: { sin_llegar: 3, atascados: 0 }, admins: ["u"], falla: "from:outbox_push_events" });
    expect(await avisarRezagoPortal(admin, AHORA)).toMatchObject({ avisados: 0, omitido: "base" });
    expect(push.enqueueUserPush).not.toHaveBeenCalled();
  });
});
