// @vitest-environment node
/**
 * SDD-0585 · paso 2.4 · `pedirFichaDtd`, la server action de la Dashboard App
 * «Ficha DTD». Lo que importa es el camino que NO debe mostrar datos (E2-D30 a
 * E2-D32), así que cada caso comprueba también lo que no se llamó. El doble de
 * Supabase APLICA los filtros `eq`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Fila = Record<string, unknown>;
type Tablas = Record<string, Fila[]>;

function dobleSupabase(tablas: Tablas) {
  const lecturas: string[] = [];
  const from = (tabla: string) => {
    lecturas.push(tabla);
    const filtros: ((f: Fila) => boolean)[] = [];
    const filas = () => (tablas[tabla] ?? []).filter((f) => filtros.every((p) => p(f)));
    const builder = {
      select: () => builder,
      eq: (col: string, v: unknown) => (filtros.push((f) => f[col] === v), builder),
      maybeSingle: async () => ({ data: filas()[0] ?? null, error: null }),
    };
    return builder;
  };
  return { from, lecturas };
}

const T1 = "10000000-0000-4000-8000-000000000001";
const T2 = "10000000-0000-4000-8000-000000000002";
const ANA = "20000000-0000-4000-8000-000000000003";
const CLIENTE = "30000000-0000-4000-8000-000000000001";
const CFG = { origin: "https://chat.ejemplo.test", token: "tok", accountId: 1 };
const CONVERSACION = { id: 42, inboxId: 1, estado: "open", noLeidos: 1, asignadoId: 3, ultimaActividad: null, fuenteActualizada: 1, telefonoUltimos10: "4125550101" };
const CUENTA_OK = {
  tipo: "ok",
  cuenta: {
    clientId: CLIENTE,
    markboxes: ["DTD-0001", "VIEJO-01"],
    asOf: "2026-10-30",
    saldos: [{ currency: "USD", abierto: 120, vencido: 20, facturasAbiertas: 2, facturasVencidas: 1, vencimientoMasAntiguo: "2026-10-01", diasVencido: 29, tramo: "d1_30", ultimoPago: null }],
    ultimoPago: null,
    embarquesEnCurso: 2,
  },
};

const m = vi.hoisted(() => ({
  sesion: null as unknown,
  admin: { soy: "admin" } as unknown,
  denial: null as string | null,
  access: null as unknown,
  flags: { chatwoot_inbox: true } as Record<string, boolean>,
  cfg: null as unknown,
  tokenAgente: vi.fn(),
  obtener: vi.fn(),
  aplicar: vi.fn(),
  cuenta: vi.fn(),
  historial: vi.fn(),
  saldo: null as boolean | null,
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => m.sesion }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => m.admin }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleViewDenial: async () => m.denial,
  tenantAdminGate: async () => ({ ok: false }),
  getStudioAccess: async () => m.access,
}));
vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: async () => m.flags }));
vi.mock("@/lib/studio/chatwoot/config", () => ({ chatwootConfig: () => m.cfg }));
vi.mock("@/lib/studio/chatwoot/platform-api", () => ({ obtenerEnlaceSso: vi.fn(), obtenerAgente: vi.fn(), obtenerTokenAgente: m.tokenAgente }));
vi.mock("@/lib/studio/chatwoot/account-api", () => ({ listarConversacionesRecientes: vi.fn(), obtenerConversacion: m.obtener }));
vi.mock("@/lib/studio/chatwoot/webhook-procesar", () => ({ aplicarConversacion: m.aplicar }));
vi.mock("@/lib/studio/client-queries", () => ({ getClientAccountState: m.cuenta }));
vi.mock("@/lib/studio/markbox-history-queries", () => ({ listMarkboxHistory: m.historial }));
// El criterio real del saldo, salvo que la prueba lo fije (m.saldo).
vi.mock("@/lib/studio/client-account", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/studio/client-account")>();
  return { ...real, puedeVerSaldoCliente: (...a: Parameters<typeof real.puedeVerSaldoCliente>) => m.saldo ?? real.puedeVerSaldoCliente(...a) };
});
vi.mock("next/headers", () => ({ cookies: async () => ({ set: vi.fn() }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { pedirFichaDtd } from "../actions";

function tablasBase(): Tablas {
  return {
    chatwoot_agent_links: [
      { tenant_id: T1, user_id: ANA, chatwoot_user_id: 3 },
      { tenant_id: T2, user_id: ANA, chatwoot_user_id: 99 },
    ],
    chatwoot_conversations: [
      { tenant_id: T1, conversation_id: 42, client_id: CLIENTE },
      { tenant_id: T1, conversation_id: 50, client_id: null },
      { tenant_id: T2, conversation_id: 42, client_id: "30000000-0000-4000-8000-000000000999" },
    ],
    clients: [{ id: CLIENTE, markbox: "DTD-0001", deleted_at: null }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.denial = null;
  m.flags = { chatwoot_inbox: true };
  m.cfg = CFG;
  m.access = { role: "commercial", tenantId: T1, userId: ANA, overrides: {} };
  m.sesion = dobleSupabase(tablasBase());
  m.tokenAgente.mockResolvedValue({ ok: true, data: "tok-agente" });
  m.obtener.mockResolvedValue({ ok: true, data: CONVERSACION });
  m.aplicar.mockResolvedValue({ nuevo: false, aplicado: true, clientId: CLIENTE });
  m.cuenta.mockResolvedValue(CUENTA_OK);
  m.historial.mockResolvedValue([{ markbox: "VIEJO-01" }]);
  m.saldo = null;
});

describe("pedirFichaDtd (SDD-0585, 2.4)", () => {
  it("sin permiso de la Bandeja: denied, sin tocar Chatwoot ni la base", async () => {
    m.denial = "No tienes permiso para ver esto.";
    expect(await pedirFichaDtd(42, 3)).toEqual({ ok: false, error: "denied" });
    expect(m.tokenAgente).not.toHaveBeenCalled();
    expect(m.cuenta).not.toHaveBeenCalled();
  });

  it("con el flag apagado: denied", async () => {
    m.flags = { chatwoot_inbox: false };
    expect(await pedirFichaDtd(42, 3)).toEqual({ ok: false, error: "denied" });
    expect(m.tokenAgente).not.toHaveBeenCalled();
  });

  it("ids que no son enteros positivos: invalid", async () => {
    expect(await pedirFichaDtd("42", 3)).toEqual({ ok: false, error: "invalid" });
    expect(await pedirFichaDtd(42, 0)).toEqual({ ok: false, error: "invalid" });
    expect(m.tokenAgente).not.toHaveBeenCalled();
  });

  it("sin configuración de Chatwoot: unconfigured", async () => {
    m.cfg = null;
    expect(await pedirFichaDtd(42, 3)).toEqual({ ok: false, error: "unconfigured" });
  });

  it("sin vínculo en SU tenant: unlinked (el vínculo de otro tenant no cuenta)", async () => {
    m.access = { role: "commercial", tenantId: T1, userId: "20000000-0000-4000-8000-000000000004", overrides: {} };
    expect(await pedirFichaDtd(42, 3)).toEqual({ ok: false, error: "unlinked" });
    expect(m.tokenAgente).not.toHaveBeenCalled();
  });

  it("el agente del contexto no es el vinculado a la sesión: otro_agente, sin pedir token", async () => {
    expect(await pedirFichaDtd(42, 99)).toEqual({ ok: false, error: "otro_agente" });
    expect(m.tokenAgente).not.toHaveBeenCalled();
  });

  it("el rol no ve clientes (override): sin_clientes, sin tocar Chatwoot", async () => {
    m.access = { role: "commercial", tenantId: T1, userId: ANA, overrides: { "commercial:clients": { view: false, edit: false } } };
    expect(await pedirFichaDtd(42, 3)).toEqual({ ok: false, error: "sin_clientes" });
    expect(m.tokenAgente).not.toHaveBeenCalled();
  });

  it("pide la conversación con el token DEL agente vinculado", async () => {
    await pedirFichaDtd(42, 3);
    expect(m.tokenAgente).toHaveBeenCalledWith(3, CFG);
    expect(m.obtener).toHaveBeenCalledWith(CFG, "tok-agente", 42);
  });

  it("Chatwoot no le muestra la conversación a ese agente: sin_acceso, sin aplicar ni leer la ficha", async () => {
    for (const error of ["no_autorizado", "no_encontrado"]) {
      m.obtener.mockResolvedValueOnce({ ok: false, error });
      expect(await pedirFichaDtd(42, 3)).toEqual({ ok: false, error: "sin_acceso" });
    }
    expect(m.aplicar).not.toHaveBeenCalled();
    expect(m.cuenta).not.toHaveBeenCalled();
  });

  it("Chatwoot caído o sin token: service", async () => {
    m.tokenAgente.mockResolvedValueOnce({ ok: false, error: "red" });
    expect(await pedirFichaDtd(42, 3)).toEqual({ ok: false, error: "service" });
    m.obtener.mockResolvedValueOnce({ ok: false, error: "red" });
    expect(await pedirFichaDtd(42, 3)).toEqual({ ok: false, error: "service" });
  });

  it("aplica la conversación con la RPC de la reconciliación, en el tenant de la sesión", async () => {
    await pedirFichaDtd(42, 3);
    expect(m.aplicar).toHaveBeenCalledWith({ admin: m.admin, tenantId: T1 }, CONVERSACION, null);
  });

  it("si aplicar falla: service, sin leer la ficha", async () => {
    m.aplicar.mockRejectedValueOnce(new Error("chatwoot_registrar_evento: 42883"));
    expect(await pedirFichaDtd(42, 3)).toEqual({ ok: false, error: "service" });
    expect(m.cuenta).not.toHaveBeenCalled();
  });

  it("sin client_id (cruce ambiguo o sin cruce): «sin ficha»", async () => {
    m.obtener.mockResolvedValueOnce({ ok: true, data: { ...CONVERSACION, id: 50 } });
    expect(await pedirFichaDtd(50, 3)).toEqual({ ok: true, ficha: null });
    expect(m.cuenta).not.toHaveBeenCalled();
  });

  it("el client_id sale de la base del tenant de la sesión, no del de otro tenant", async () => {
    const r = await pedirFichaDtd(42, 3);
    expect(r.ok && r.ficha?.markbox).toBe("DTD-0001");
  });

  it("la RLS de clients no devuelve el cliente: «sin ficha»", async () => {
    const tablas = tablasBase();
    tablas.clients = [];
    m.sesion = dobleSupabase(tablas);
    expect(await pedirFichaDtd(42, 3)).toEqual({ ok: true, ficha: null });
  });

  it("con cliente: código, anteriores, cuenta, segmento vacío y enlace a la ficha", async () => {
    const r = await pedirFichaDtd(42, 3);
    expect(r).toEqual({
      ok: true,
      ficha: {
        markbox: "DTD-0001",
        segmento: null,
        cuenta: CUENTA_OK,
        enlace: "/studio/clientes/DTD-0001",
      },
    });
    expect(m.cuenta).toHaveBeenCalledWith(
      m.sesion,
      { id: CLIENTE, markbox: "DTD-0001", deleted_at: null },
      { puedeVerSaldo: true, codigosConocidos: ["VIEJO-01"] },
    );
  });

  it("sin permiso de saldo (la base responde 42501): la respuesta no lleva dinero", async () => {
    m.cuenta.mockResolvedValueOnce({ tipo: "sin-permiso", markboxes: ["DTD-0001"], embarquesEnCurso: 1 });
    const r = await pedirFichaDtd(42, 3);
    const plano = JSON.stringify(r);
    expect(plano).not.toContain("saldos");
    expect(plano).not.toContain("abierto");
  });

  it("el saldo sigue el MISMO criterio que la ficha (puedeVerSaldoCliente): si dice que no, no se pide", async () => {
    // Hoy quien ve clientes ve saldo (decisión 14); si la regla cambia, la Ficha DTD la sigue.
    m.saldo = false;
    await pedirFichaDtd(42, 3);
    expect(m.cuenta).toHaveBeenCalledWith(m.sesion, expect.anything(), { puedeVerSaldo: false, codigosConocidos: ["VIEJO-01"] });
  });

  it("si el historial de códigos falla, la ficha sale igual", async () => {
    m.historial.mockRejectedValueOnce(new Error("relation does not exist"));
    const r = await pedirFichaDtd(42, 3);
    expect(r.ok && r.ficha?.markbox).toBe("DTD-0001");
  });

  it("los logs no llevan ids de cliente, códigos ni teléfonos", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    m.obtener.mockResolvedValueOnce({ ok: false, error: "red" });
    await pedirFichaDtd(42, 3);
    m.aplicar.mockRejectedValueOnce(new Error("chatwoot_registrar_evento: 42883"));
    await pedirFichaDtd(42, 3);
    await pedirFichaDtd(42, 3);
    const todo = JSON.stringify([...warn.mock.calls, ...error.mock.calls]);
    for (const dato of [CLIENTE, "DTD-0001", "4125550101", "tok-agente"]) expect(todo).not.toContain(dato);
    warn.mockRestore();
    error.mockRestore();
  });
});
