// @vitest-environment node
/**
 * SDD-0676 · «Vincular a cliente» desde la Ficha DTD: `buscarClientesParaVincular` y
 * `vincularContactoDeConversacion`.
 *
 * Lo que importa es lo que NO debe pasar: quien no edita la Bandeja no busca ni vincula,
 * el contacto sale de Chatwoot (no del navegador) y al navegador no llega el teléfono
 * entero de nadie. El doble de Supabase APLICA los filtros `eq` sobre filas de dos
 * tenants; la regla de roles es la real (`puedeVincularContacto`).
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
const OTRO = "30000000-0000-4000-8000-000000000002";
const AJENO = "30000000-0000-4000-8000-000000000009";
const CFG = { origin: "https://chat.ejemplo.test", token: "tok", accountId: 1 };
/** SINT: teléfono imposible en Venezuela (ningún código de área empieza por 0). */
const TELEFONO_SINT = "+58 000-555-0142";

const m = vi.hoisted(() => ({
  sesion: null as unknown,
  gate: null as unknown,
  access: null as unknown,
  flags: { chatwoot_inbox: true } as Record<string, boolean>,
  cfg: null as unknown,
  tenantChatwoot: null as string | null,
  rpc: vi.fn(),
  adminCreado: vi.fn(),
  tokenAgente: vi.fn(),
  obtener: vi.fn(),
  listar: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => m.sesion }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    m.adminCreado();
    return { rpc: m.rpc };
  },
}));
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditGate: async () => m.gate,
  getStudioAccess: async () => m.access,
}));
vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: async () => m.flags }));
vi.mock("@/lib/studio/chatwoot/config", () => ({ chatwootConfig: () => m.cfg, chatwootTenantId: () => m.tenantChatwoot }));
vi.mock("@/lib/studio/chatwoot/platform-api", () => ({ obtenerTokenAgente: m.tokenAgente }));
vi.mock("@/lib/studio/chatwoot/account-api", () => ({ obtenerConversacion: m.obtener }));
vi.mock("@/lib/studio/client-queries", () => ({ listClients: m.listar }));

import { buscarClientesParaVincular, vincularContactoDeConversacion } from "../vincular-actions";

function tablasBase(): Tablas {
  return {
    chatwoot_agent_links: [
      { tenant_id: T1, user_id: ANA, chatwoot_user_id: 3 },
      { tenant_id: T2, user_id: ANA, chatwoot_user_id: 99 },
    ],
    chatwoot_contact_links: [
      { tenant_id: T1, chatwoot_contact_id: 77, client_id: OTRO },
      { tenant_id: T2, chatwoot_contact_id: 88, client_id: AJENO },
    ],
    clients: [
      { tenant_id: T1, id: CLIENTE, markbox: "DTD-0001", name: "SINT Uno", deleted_at: null },
      { tenant_id: T1, id: OTRO, markbox: "DTD-0002", name: " SINT Dos ", deleted_at: null },
      { tenant_id: T2, id: AJENO, markbox: "DTD-0900", name: "SINT Ajeno", deleted_at: null },
    ],
  };
}

function nadaSeTocó() {
  expect(m.tokenAgente).not.toHaveBeenCalled();
  expect(m.obtener).not.toHaveBeenCalled();
  expect(m.adminCreado).not.toHaveBeenCalled();
  expect(m.rpc).not.toHaveBeenCalled();
  expect(m.listar).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  m.sesion = dobleSupabase(tablasBase());
  m.gate = { ok: true, tenantId: T1, userId: ANA, role: "commercial" };
  m.access = { role: "commercial", tenantId: T1, userId: ANA, overrides: {} };
  m.flags = { chatwoot_inbox: true };
  m.cfg = CFG;
  m.tenantChatwoot = T1;
  m.tokenAgente.mockResolvedValue({ ok: true, data: "tok-agente" });
  m.obtener.mockResolvedValue({ ok: true, data: { id: 42, inboxId: 5, contactoId: 77, canal: "Channel::Instagram" } });
  m.rpc.mockResolvedValue({ data: { resultado: "unido", tarjeta_absorbida: true }, error: null });
  m.listar.mockResolvedValue([
    { id: CLIENTE, markbox: "DTD-0001", name: "SINT Uno", phone: TELEFONO_SINT, email: "sint@ejemplo.test", rif: "V-0", codigo_anterior: "VIEJO-01" },
    { id: OTRO, markbox: "DTD-0002", name: "SINT Dos", phone: null, email: null, rif: null },
  ]);
});

describe("quién puede (decisión 1: Admin y Comercial)", () => {
  it("sin editar la Bandeja (primer candado): denied, sin leer nada", async () => {
    m.gate = { ok: false, denied: "No tienes permiso para realizar esta acción." };
    expect(await buscarClientesParaVincular("DTD-0001")).toEqual({ ok: false, error: "denied" });
    expect(await vincularContactoDeConversacion(42, 3, CLIENTE)).toEqual({ ok: false, error: "denied" });
    nadaSeTocó();
  });

  it.each(["support", "operations", "accounting", "warehouse"])(
    "%s: aunque el primer candado pasara, la regla real de roles corta",
    async (rol) => {
      m.access = { role: rol, tenantId: T1, userId: ANA, overrides: {} };
      expect(await buscarClientesParaVincular("DTD-0001")).toEqual({ ok: false, error: "denied" });
      expect(await vincularContactoDeConversacion(42, 3, CLIENTE)).toEqual({ ok: false, error: "denied" });
      nadaSeTocó();
    },
  );

  it("comercial sin el módulo Clientes: denied", async () => {
    m.access = { role: "commercial", tenantId: T1, userId: ANA, overrides: { "commercial:clients": { view: false, edit: false } } };
    expect(await buscarClientesParaVincular("DTD-0001")).toEqual({ ok: false, error: "denied" });
    nadaSeTocó();
  });

  it("una sesión de OTRO tenant que el dueño de la cuenta de Chatwoot: denied", async () => {
    m.gate = { ok: true, tenantId: T2, userId: ANA, role: "admin" };
    m.access = { role: "admin", tenantId: T2, userId: ANA, overrides: {} };
    expect(await buscarClientesParaVincular("DTD-0001")).toEqual({ ok: false, error: "denied" });
    expect(await vincularContactoDeConversacion(42, 99, AJENO)).toEqual({ ok: false, error: "denied" });
    nadaSeTocó();
  });

  it("sin CHATWOOT_TENANT_ID nadie vincula; con el módulo apagado, tampoco", async () => {
    m.tenantChatwoot = null;
    expect(await vincularContactoDeConversacion(42, 3, CLIENTE)).toEqual({ ok: false, error: "denied" });
    m.tenantChatwoot = T1;
    m.flags = { chatwoot_inbox: false };
    expect(await vincularContactoDeConversacion(42, 3, CLIENTE)).toEqual({ ok: false, error: "denied" });
    nadaSeTocó();
  });
});

describe("buscarClientesParaVincular", () => {
  it("con menos de 3 caracteres no busca", async () => {
    expect(await buscarClientesParaVincular(" ab ")).toEqual({ ok: true, clientes: [] });
    expect(await buscarClientesParaVincular(42)).toEqual({ ok: true, clientes: [] });
    expect(m.listar).not.toHaveBeenCalled();
  });

  it("busca con el cliente de SESIÓN, tope 8, y devuelve solo código, nombre y los últimos 4 dígitos", async () => {
    const r = await buscarClientesParaVincular("  SINT  ");
    expect(m.listar).toHaveBeenCalledWith(m.sesion, { q: "SINT", limite: 8 });
    expect(r).toEqual({
      ok: true,
      clientes: [
        { id: CLIENTE, markbox: "DTD-0001", nombre: "SINT Uno", telefonoFinal: "0142", codigoAnterior: "VIEJO-01" },
        { id: OTRO, markbox: "DTD-0002", nombre: "SINT Dos", telefonoFinal: null, codigoAnterior: null },
      ],
    });
    const salida = JSON.stringify(r);
    expect(salida).not.toContain("555");
    expect(salida).not.toContain("ejemplo.test");
    expect(salida).not.toContain("V-0");
    expect(m.adminCreado).not.toHaveBeenCalled();
  });

  it("nunca devuelve más de 8, aunque la consulta traiga más", async () => {
    m.listar.mockResolvedValueOnce(Array.from({ length: 12 }, (_, i) => ({ id: `id-${i}`, markbox: `DTD-${i}`, name: "SINT", phone: null })));
    const r = await buscarClientesParaVincular("SINT");
    expect(r.ok && r.clientes).toHaveLength(8);
  });

  it("si la base falla: service, y el log lleva solo el código", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    m.listar.mockRejectedValueOnce(Object.assign(new Error("SINT Uno 0142"), { code: "57014" }));
    expect(await buscarClientesParaVincular("SINT Uno")).toEqual({ ok: false, error: "service" });
    expect(warn.mock.calls.flat().join(" ")).toMatch(/57014/);
    expect(warn.mock.calls.flat().join(" ")).not.toMatch(/SINT|0142/);
    warn.mockRestore();
  });
});

describe("vincularContactoDeConversacion", () => {
  it("vincula: el contacto y el canal salen de Chatwoot; tenant y actor, de la sesión; motivo automático", async () => {
    const r = await vincularContactoDeConversacion(42, 3, CLIENTE);
    expect(r).toEqual({ ok: true, resultado: "unido", tarjetaAbsorbida: true });
    expect(m.tokenAgente).toHaveBeenCalledWith(3, CFG);
    expect(m.obtener).toHaveBeenCalledWith(CFG, "tok-agente", 42);
    expect(m.rpc).toHaveBeenCalledTimes(1);
    expect(m.rpc).toHaveBeenCalledWith("chatwoot_vincular_contacto", {
      p_tenant_id: T1,
      p_actor_user_id: ANA,
      p_client_id: CLIENTE,
      p_contact_id: 77,
      p_canal: "instagram",
      p_motivo: "Vinculado desde la conversación 42",
      p_mover: false,
    });
  });

  it("entradas inválidas no llegan a Chatwoot ni a la base", async () => {
    expect(await vincularContactoDeConversacion("42", 3, CLIENTE)).toEqual({ ok: false, error: "invalid" });
    expect(await vincularContactoDeConversacion(42, null, CLIENTE)).toEqual({ ok: false, error: "invalid" });
    expect(await vincularContactoDeConversacion(42, 3, "no-es-uuid")).toEqual({ ok: false, error: "invalid" });
    expect(await vincularContactoDeConversacion(42, 3, { id: CLIENTE })).toEqual({ ok: false, error: "invalid" });
    expect(m.tokenAgente).not.toHaveBeenCalled();
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("el agente del contexto no es el de esta sesión: otro_agente (el vínculo de T2 no cuenta)", async () => {
    expect(await vincularContactoDeConversacion(42, 99, CLIENTE)).toEqual({ ok: false, error: "otro_agente" });
    expect(m.tokenAgente).not.toHaveBeenCalled();
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("usuario sin agente vinculado: unlinked", async () => {
    m.gate = { ok: true, tenantId: T1, userId: "20000000-0000-4000-8000-000000000004", role: "commercial" };
    expect(await vincularContactoDeConversacion(42, 3, CLIENTE)).toEqual({ ok: false, error: "unlinked" });
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("Chatwoot no le muestra la conversación a ese agente: sin_acceso, sin vincular", async () => {
    m.obtener.mockResolvedValueOnce({ ok: false, error: "no_encontrado" });
    expect(await vincularContactoDeConversacion(42, 3, CLIENTE)).toEqual({ ok: false, error: "sin_acceso" });
    expect(m.adminCreado).not.toHaveBeenCalled();
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("conversación sin contacto: sin_contacto", async () => {
    m.obtener.mockResolvedValueOnce({ ok: true, data: { id: 42, inboxId: 5, contactoId: null, canal: "Channel::Instagram" } });
    expect(await vincularContactoDeConversacion(42, 3, CLIENTE)).toEqual({ ok: false, error: "sin_contacto" });
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("sin configuración de Chatwoot: unconfigured", async () => {
    m.cfg = null;
    expect(await vincularContactoDeConversacion(42, 3, CLIENTE)).toEqual({ ok: false, error: "unconfigured" });
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("el chat ya está unido a otra ficha (23505): dice a cuál, leída con la sesión y filtrada por tenant", async () => {
    m.rpc.mockResolvedValueOnce({ data: null, error: { code: "23505" } });
    const r = await vincularContactoDeConversacion(42, 3, CLIENTE);
    expect(r).toEqual({ ok: false, error: "otra_ficha", otra: { markbox: "DTD-0002", nombre: "SINT Dos" } });
  });

  it("el chat es del portal de otro cliente (55000): lo dice y no ofrece moverlo ni nombra a nadie", async () => {
    m.rpc.mockResolvedValueOnce({ data: null, error: { code: "55000" } });
    const r = await vincularContactoDeConversacion(42, 3, CLIENTE);
    expect(r).toEqual({ ok: false, error: "del_portal" });
    expect(JSON.stringify(r)).not.toContain("DTD-");
  });

  it("unido en OTRO tenant: avisa sin decir a quién (el filtro por tenant se aplica)", async () => {
    m.obtener.mockResolvedValueOnce({ ok: true, data: { id: 42, inboxId: 5, contactoId: 88, canal: "Channel::Instagram" } });
    m.rpc.mockResolvedValueOnce({ data: null, error: { code: "23505" } });
    const r = await vincularContactoDeConversacion(42, 3, CLIENTE);
    expect(r).toEqual({ ok: false, error: "otra_ficha", otra: null });
    expect(JSON.stringify(r)).not.toContain("DTD-0900");
  });

  it("«Mover aquí» exige un motivo escrito y lo manda tal cual, con p_mover", async () => {
    expect(await vincularContactoDeConversacion(42, 3, CLIENTE, { mover: true, motivo: "  no " })).toEqual({ ok: false, error: "motivo" });
    expect(m.tokenAgente).not.toHaveBeenCalled();

    m.rpc.mockResolvedValueOnce({ data: { resultado: "movido", tarjeta_absorbida: false }, error: null });
    const r = await vincularContactoDeConversacion(42, 3, CLIENTE, { mover: true, motivo: "  Era de la otra ficha  " });
    expect(r).toEqual({ ok: true, resultado: "movido", tarjetaAbsorbida: false });
    expect(m.rpc).toHaveBeenCalledWith(
      "chatwoot_vincular_contacto",
      expect.objectContaining({ p_mover: true, p_motivo: "Era de la otra ficha", p_contact_id: 77 }),
    );
  });

  it("sin «mover», un motivo que mande el navegador se ignora: el automático", async () => {
    await vincularContactoDeConversacion(42, 3, CLIENTE, { motivo: "lo que sea" });
    expect(m.rpc).toHaveBeenCalledWith("chatwoot_vincular_contacto", expect.objectContaining({ p_motivo: "Vinculado desde la conversación 42", p_mover: false }));
  });

  it.each([
    ["42501", "denied"],
    ["P0002", "ficha_inexistente"],
    ["22023", "motivo"],
    ["XX000", "service"],
  ])("la base responde %s → %s", async (codigo, esperado) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    m.rpc.mockResolvedValueOnce({ data: null, error: { code: codigo } });
    expect(await vincularContactoDeConversacion(42, 3, CLIENTE)).toEqual({ ok: false, error: esperado });
    warn.mockRestore();
  });

  it("sin la migración nueva (PGRST202): une con la RPC de la 0554; si tampoco está, sin_migracion", async () => {
    m.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } }).mockResolvedValueOnce({ data: "unido", error: null });
    expect(await vincularContactoDeConversacion(42, 3, CLIENTE)).toEqual({ ok: true, resultado: "unido", tarjetaAbsorbida: false });
    expect(m.rpc).toHaveBeenLastCalledWith("chatwoot_unir_contacto_manual", {
      p_tenant_id: T1,
      p_actor_user_id: ANA,
      p_client_id: CLIENTE,
      p_contact_id: 77,
      p_motivo: "Vinculado desde la conversación 42",
    });

    m.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } }).mockResolvedValueOnce({ data: null, error: { code: "42883" } });
    expect(await vincularContactoDeConversacion(42, 3, CLIENTE)).toEqual({ ok: false, error: "sin_migracion" });
  });

  it("«Mover aquí» sin la migración nueva: sin_migracion, sin caer en la RPC vieja", async () => {
    m.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    expect(await vincularContactoDeConversacion(42, 3, CLIENTE, { mover: true, motivo: "Era de la otra" })).toEqual({
      ok: false,
      error: "sin_migracion",
    });
    expect(m.rpc).toHaveBeenCalledTimes(1);
  });

  it("los logs no llevan el contacto, la ficha ni el token", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    m.tokenAgente.mockResolvedValueOnce({ ok: false, error: "http_500" });
    expect(await vincularContactoDeConversacion(42, 3, CLIENTE)).toEqual({ ok: false, error: "service" });
    m.rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000" } });
    await vincularContactoDeConversacion(42, 3, CLIENTE);
    const texto = warn.mock.calls.flat().join(" ");
    expect(texto).toMatch(/http_500/);
    expect(texto).toMatch(/XX000/);
    expect(texto).not.toMatch(new RegExp(`${CLIENTE}|tok-agente|DTD-`));
    warn.mockRestore();
  });
});
