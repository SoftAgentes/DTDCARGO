// @vitest-environment node
/**
 * SDD-0585 · paso 2.5 · `altaAgente`: el admin da de alta en Chatwoot a un
 * usuario de Studio. Crea (o adopta por correo) el usuario de Chatwoot, lo mete
 * en la cuenta como agente y guarda el vínculo. El doble APLICA los filtros.
 *
 * Paso 2.7: el rol de la cuenta sale de la matriz, cada alta que no es de un
 * admin pone una clave aleatoria (cierre del acceso directo), y una baja vieja
 * del mismo agente se borra.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Fila = Record<string, unknown>;
type Tablas = Record<string, Fila[]>;

function doble(tablas: Tablas, opciones: { errorInsert?: { code: string }; sinTabla?: string } = {}) {
  const inserts: { tabla: string; fila: Fila }[] = [];
  const from = (tabla: string) => {
    const filtros: ((f: Fila) => boolean)[] = [];
    let modo: "select" | "delete" = "select";
    const filas = () => (tablas[tabla] ?? []).filter((f) => filtros.every((p) => p(f)));
    const builder = {
      select: () => builder,
      delete: () => ((modo = "delete"), builder),
      eq: (col: string, v: unknown) => (filtros.push((f) => f[col] === v), builder),
      is: (col: string, v: unknown) => (filtros.push((f) => (f[col] ?? null) === v), builder),
      maybeSingle: async () =>
        opciones.sinTabla === tabla ? { data: null, error: { code: "42P01" } } : { data: filas()[0] ?? null, error: null },
      insert: async (fila: Fila) => {
        if (opciones.errorInsert) return { error: opciones.errorInsert };
        inserts.push({ tabla, fila });
        (tablas[tabla] ??= []).push(fila);
        return { error: null };
      },
      then: (r: (v: { data: Fila[] | null; error: null }) => unknown) => {
        if (modo === "delete") {
          const quitar = new Set(filas());
          tablas[tabla] = (tablas[tabla] ?? []).filter((f) => !quitar.has(f));
          return Promise.resolve(r({ data: null, error: null }));
        }
        return Promise.resolve(r({ data: filas(), error: null }));
      },
    };
    return builder;
  };
  return { from, inserts };
}

const T1 = "10000000-0000-4000-8000-000000000001";
const T2 = "10000000-0000-4000-8000-000000000002";
const SAM = "20000000-0000-4000-8000-000000000001";
const ANA = "20000000-0000-4000-8000-000000000003";
const OPE = "20000000-0000-4000-8000-000000000006";
const LUZ = "20000000-0000-4000-8000-000000000007";
const CFG = { origin: "https://chat.ejemplo.test", token: "tok", accountId: 1 };

const m = vi.hoisted(() => ({
  sesion: null as unknown,
  admin: null as unknown,
  gate: null as unknown,
  cfg: null as unknown,
  crear: vi.fn(),
  agregar: vi.fn(),
  clave: vi.fn(),
  sincronizar: vi.fn(),
  orden: [] as string[],
  revalidate: vi.fn(),
  correos: {} as Record<string, string>,
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => m.sesion }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => m.admin }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleViewDenial: async () => null,
  tenantAdminGate: async () => m.gate,
  getStudioAccess: async () => ({}),
}));
vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: async () => ({ chatwoot_inbox: true }) }));
vi.mock("@/lib/studio/chatwoot/config", () => ({ chatwootConfig: () => m.cfg }));
vi.mock("@/lib/studio/chatwoot/platform-api", () => ({
  obtenerEnlaceSso: vi.fn(),
  obtenerAgente: vi.fn(),
  obtenerTokenAgente: vi.fn(),
  crearAgente: m.crear,
  agregarACuenta: m.agregar,
  fijarClaveAleatoria: m.clave,
}));
vi.mock("@/lib/studio/chatwoot/agentes-usuario", () => ({ sincronizarAgenteDeUsuario: m.sincronizar }));
vi.mock("@/lib/studio/chatwoot/account-api", () => ({ listarConversacionesRecientes: vi.fn(), obtenerConversacion: vi.fn() }));
vi.mock("@/lib/studio/chatwoot/webhook-procesar", () => ({ aplicarConversacion: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: vi.fn() }) }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));

import { altaAgente } from "../actions";

const form = (datos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(datos)) f.set(k, v);
  return f;
};
const INICIAL = { ok: false, error: null } as const;

function tablasBase(): Tablas {
  return {
    user_tenants: [
      { tenant_id: T1, user_id: ANA, role: "commercial", disabled_at: null },
      { tenant_id: T1, user_id: OPE, role: "operations", disabled_at: null },
      { tenant_id: T1, user_id: LUZ, role: "admin", disabled_at: null },
      { tenant_id: T2, user_id: "20000000-0000-4000-8000-000000000009", role: "commercial", disabled_at: null },
    ],
    user_profiles: [{ user_id: ANA, first_name: "Ana", last_name: "Sintética" }],
    studio_role_module_overrides: [],
    chatwoot_agent_links: [{ tenant_id: T1, user_id: SAM, chatwoot_user_id: 3 }],
    chatwoot_agent_bajas: [
      { tenant_id: T1, chatwoot_user_id: 7 },
      { tenant_id: T2, chatwoot_user_id: 7 },
      { tenant_id: T1, chatwoot_user_id: 8 },
    ],
  };
}

let tablas: Tablas;
beforeEach(() => {
  vi.clearAllMocks();
  tablas = tablasBase();
  const base = doble(tablas);
  m.admin = {
    ...base,
    auth: {
      admin: {
        getUserById: async (id: string) =>
          m.correos[id] ? { data: { user: { id, email: m.correos[id] } }, error: null } : { data: { user: null }, error: { message: "no" } },
      },
    },
  };
  m.sesion = doble(tablas);
  m.gate = { ok: true, tenantId: T1, userId: SAM, role: "admin" };
  m.cfg = CFG;
  m.correos = { [ANA]: "ana@example.test", [OPE]: "ope@example.test", [LUZ]: "luz@example.test" };
  m.orden = [];
  m.crear.mockResolvedValue({ ok: true, data: 7 });
  m.agregar.mockImplementation(async () => (m.orden.push("agregar"), { ok: true, data: null }));
  m.clave.mockImplementation(async () => (m.orden.push("clave"), { ok: true, data: null }));
  m.sincronizar.mockResolvedValue(undefined);
});

describe("altaAgente (SDD-0585, 2.5)", () => {
  it("sin admin: denied, sin tocar Chatwoot", async () => {
    m.gate = { ok: false };
    expect(await altaAgente(INICIAL, form({ user_id: ANA }))).toEqual({ ok: false, error: "denied" });
    expect(m.crear).not.toHaveBeenCalled();
  });

  it("id inválido o de otro tenant: invalid / not_member", async () => {
    expect(await altaAgente(INICIAL, form({ user_id: "x" }))).toEqual({ ok: false, error: "invalid" });
    expect(await altaAgente(INICIAL, form({ user_id: "20000000-0000-4000-8000-000000000009" }))).toEqual({ ok: false, error: "not_member" });
    expect(m.crear).not.toHaveBeenCalled();
  });

  it("un rol sin Bandeja no se da de alta", async () => {
    expect(await altaAgente(INICIAL, form({ user_id: OPE }))).toEqual({ ok: false, error: "sin_bandeja" });
    expect(m.crear).not.toHaveBeenCalled();
  });

  it("ya vinculado: duplicate", async () => {
    tablas.chatwoot_agent_links.push({ tenant_id: T1, user_id: ANA, chatwoot_user_id: 9 });
    expect(await altaAgente(INICIAL, form({ user_id: ANA }))).toEqual({ ok: false, error: "duplicate" });
    expect(m.crear).not.toHaveBeenCalled();
  });

  it("alta completa: crea con nombre y correo de Studio, mete como agente y guarda el vínculo", async () => {
    expect(await altaAgente(INICIAL, form({ user_id: ANA }))).toEqual({ ok: true, error: null });
    expect(m.crear).toHaveBeenCalledWith({ nombre: "Ana Sintética", correo: "ana@example.test" }, CFG);
    expect(m.agregar).toHaveBeenCalledWith(7, CFG, "agent");
    expect(tablas.chatwoot_agent_links).toContainEqual({ tenant_id: T1, user_id: ANA, chatwoot_user_id: 7, created_by: SAM });
    expect(m.revalidate).toHaveBeenCalledWith("/studio/bandeja");
  });

  it("sin nombre en el perfil: usa la parte local del correo", async () => {
    tablas.user_profiles = [];
    await altaAgente(INICIAL, form({ user_id: ANA }));
    expect(m.crear).toHaveBeenCalledWith({ nombre: "ana", correo: "ana@example.test" }, CFG);
  });

  it("el usuario de Chatwoot ya está vinculado a OTRA persona: duplicate, sin meterlo en la cuenta", async () => {
    m.crear.mockResolvedValueOnce({ ok: true, data: 3 });
    expect(await altaAgente(INICIAL, form({ user_id: ANA }))).toEqual({ ok: false, error: "duplicate" });
    expect(m.agregar).not.toHaveBeenCalled();
  });

  it("Chatwoot falla al crear o al meter en la cuenta: service, sin vínculo", async () => {
    m.crear.mockResolvedValueOnce({ ok: false, error: "http_422" });
    expect(await altaAgente(INICIAL, form({ user_id: ANA }))).toEqual({ ok: false, error: "service" });
    m.agregar.mockResolvedValueOnce({ ok: false, error: "red" });
    expect(await altaAgente(INICIAL, form({ user_id: ANA }))).toEqual({ ok: false, error: "service" });
    expect(tablas.chatwoot_agent_links.some((v) => v.user_id === ANA)).toBe(false);
  });

  it("2.7 · cierra el acceso directo: clave aleatoria ANTES de meterlo en la cuenta", async () => {
    await altaAgente(INICIAL, form({ user_id: ANA }));
    expect(m.clave).toHaveBeenCalledWith(7, CFG);
    expect(m.orden).toEqual(["clave", "agregar"]);
  });

  it("2.7 · si la clave no se puede cambiar: service, sin meterlo en la cuenta ni vincularlo", async () => {
    m.clave.mockResolvedValueOnce({ ok: false, error: "no_autorizado" });
    expect(await altaAgente(INICIAL, form({ user_id: ANA }))).toEqual({ ok: false, error: "service" });
    expect(m.agregar).not.toHaveBeenCalled();
    expect(tablas.chatwoot_agent_links.some((v) => v.user_id === ANA)).toBe(false);
  });

  it("2.7 · un admin de Studio entra como administrator y conserva su clave (entrada de respaldo)", async () => {
    m.crear.mockResolvedValueOnce({ ok: true, data: 11 });
    expect(await altaAgente(INICIAL, form({ user_id: LUZ }))).toEqual({ ok: true, error: null });
    expect(m.agregar).toHaveBeenCalledWith(11, CFG, "administrator");
    expect(m.clave).not.toHaveBeenCalled();
  });

  it("2.7 · borra SOLO la baja vieja de ese agente en el tenant y aplica la matriz", async () => {
    await altaAgente(INICIAL, form({ user_id: ANA }));
    expect(tablas.chatwoot_agent_bajas).toEqual([
      { tenant_id: T2, chatwoot_user_id: 7 },
      { tenant_id: T1, chatwoot_user_id: 8 },
    ]);
    expect(m.sincronizar).toHaveBeenCalledWith(ANA);
  });

  it("sin correo en Auth: not_member", async () => {
    m.correos = {};
    expect(await altaAgente(INICIAL, form({ user_id: ANA }))).toEqual({ ok: false, error: "not_member" });
  });

  it("sin la 0503 (la tabla de vínculos no existe): service, sin crear nada en Chatwoot", async () => {
    const base = doble(tablas, { sinTabla: "chatwoot_agent_links" });
    m.admin = { ...base, auth: (m.admin as { auth: unknown }).auth };
    expect(await altaAgente(INICIAL, form({ user_id: ANA }))).toEqual({ ok: false, error: "service" });
    expect(m.crear).not.toHaveBeenCalled();
    expect(m.agregar).not.toHaveBeenCalled();
  });

  it("los logs no llevan el correo", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    m.crear.mockResolvedValueOnce({ ok: false, error: "http_422" });
    await altaAgente(INICIAL, form({ user_id: ANA }));
    expect(JSON.stringify(warn.mock.calls)).not.toContain("ana@example.test");
    warn.mockRestore();
  });
});
