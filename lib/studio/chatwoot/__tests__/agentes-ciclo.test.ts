// @vitest-environment node
/**
 * SDD-0585 · paso 2.5 · `sincronizarAgentes` y `avisarSaludAAdmins`. El doble de
 * Supabase APLICA los filtros (`eq`, `is`): sin eso no se prueba que una baja
 * toque solo el vínculo del tenant y del usuario que corresponde.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Fila = Record<string, unknown>;
type Tablas = Record<string, Fila[]>;

function doble(tablas: Tablas, fallar: { tabla?: string; borrar?: boolean } = {}) {
  const borrados: { tabla: string; filtros: string[] }[] = [];
  const from = (tabla: string) => {
    const filtros: ((f: Fila) => boolean)[] = [];
    const descripcion: string[] = [];
    let modo: "select" | "delete" = "select";
    const filas = () => (tablas[tabla] ?? []).filter((f) => filtros.every((p) => p(f)));
    const builder = {
      select: () => builder,
      eq: (col: string, v: unknown) => (filtros.push((f) => f[col] === v), descripcion.push(`${col}=${String(v)}`), builder),
      is: (col: string, v: unknown) => (filtros.push((f) => (f[col] ?? null) === v), builder),
      delete: () => ((modo = "delete"), builder),
      then: (resolver: (v: { data: Fila[] | null; error: { code: string } | null }) => unknown) => {
        if (fallar.tabla === tabla && modo === "select") return Promise.resolve(resolver({ data: null, error: { code: "42P01" } }));
        if (modo === "delete") {
          if (fallar.borrar) return Promise.resolve(resolver({ data: null, error: { code: "42501" } }));
          const quitar = new Set(filas());
          tablas[tabla] = (tablas[tabla] ?? []).filter((f) => !quitar.has(f));
          borrados.push({ tabla, filtros: descripcion });
          return Promise.resolve(resolver({ data: null, error: null }));
        }
        return Promise.resolve(resolver({ data: filas(), error: null }));
      },
    };
    return builder;
  };
  return { from, borrados };
}

const m = vi.hoisted(() => ({ listar: vi.fn(), quitar: vi.fn(), encolar: vi.fn(), drenar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../platform-api", () => ({ listarMiembrosCuenta: m.listar, quitarDeCuenta: m.quitar }));
vi.mock("@/lib/studio/notify/operario-push-outbox", () => ({ enqueueUserPush: m.encolar, drainOperarioPushOutbox: m.drenar }));

import { avisarSaludAAdmins, sincronizarAgentes } from "../agentes-ciclo";

const T1 = "10000000-0000-4000-8000-000000000001";
const T2 = "10000000-0000-4000-8000-000000000002";
const ANA = "20000000-0000-4000-8000-000000000003";
const LUIS = "20000000-0000-4000-8000-000000000004";
const SAM = "20000000-0000-4000-8000-000000000001";
const CFG = { origin: "https://chat.ejemplo.test", token: "tok", accountId: 1 };
const SERVICIO = 1;

function tablasBase(): Tablas {
  return {
    chatwoot_agent_links: [
      { tenant_id: T1, user_id: ANA, chatwoot_user_id: 7 },
      { tenant_id: T1, user_id: LUIS, chatwoot_user_id: 8 },
      { tenant_id: T1, user_id: SAM, chatwoot_user_id: 3 },
      { tenant_id: T2, user_id: ANA, chatwoot_user_id: 99 },
    ],
    user_tenants: [
      { tenant_id: T1, user_id: ANA, role: "commercial", disabled_at: null },
      { tenant_id: T1, user_id: LUIS, role: "support", disabled_at: null },
      { tenant_id: T1, user_id: SAM, role: "admin", disabled_at: null },
      { tenant_id: T2, user_id: ANA, role: "commercial", disabled_at: "2026-10-01T00:00:00Z" },
    ],
    studio_role_module_overrides: [],
  };
}
const CUENTA = [
  { userId: SERVICIO, rol: "administrator" },
  { userId: 3, rol: "administrator" },
  { userId: 7, rol: "agent" },
  { userId: 8, rol: "agent" },
];

let tablas: Tablas;
let admin: ReturnType<typeof doble>;
const ctx = () => ({ admin: admin as never, tenantId: T1, cfg: CFG, servicioId: SERVICIO });

beforeEach(() => {
  vi.clearAllMocks();
  tablas = tablasBase();
  admin = doble(tablas);
  m.listar.mockResolvedValue({ ok: true, data: CUENTA.map((c) => ({ ...c })) });
  m.quitar.mockResolvedValue({ ok: true, data: null });
  m.encolar.mockResolvedValue("push-1");
});

describe("sincronizarAgentes (2.5)", () => {
  it("todos activos y con Bandeja: no da de baja a nadie y la salud sale limpia", async () => {
    const r = await sincronizarAgentes(ctx());
    expect(r).toMatchObject({ revisados: 3, bajas: 0, bloqueadas: 0, fallidas: 0 });
    expect(r.salud.alertas).toEqual([]);
    expect(m.quitar).not.toHaveBeenCalled();
  });

  it("usuario desactivado en Studio: lo saca de la cuenta y borra SOLO su vínculo del tenant", async () => {
    tablas.user_tenants[0].disabled_at = "2026-10-30T00:00:00Z";
    const r = await sincronizarAgentes(ctx());
    expect(r.bajas).toBe(1);
    expect(m.quitar).toHaveBeenCalledWith(7, CFG);
    expect(admin.borrados).toEqual([{ tabla: "chatwoot_agent_links", filtros: [`tenant_id=${T1}`, `user_id=${ANA}`] }]);
    expect(tablas.chatwoot_agent_links.map((v) => v.chatwoot_user_id)).toEqual([8, 3, 99]);
  });

  it("usuario que ya no es del tenant: baja", async () => {
    tablas.user_tenants = tablas.user_tenants.filter((u) => !(u.tenant_id === T1 && u.user_id === LUIS));
    const r = await sincronizarAgentes(ctx());
    expect(r.bajas).toBe(1);
    expect(m.quitar).toHaveBeenCalledWith(8, CFG);
  });

  it("rol que perdió la Bandeja por override: baja", async () => {
    tablas.studio_role_module_overrides = [{ tenant_id: T1, role: "support", module_id: "bandeja", can_view: false, can_edit: false }];
    const r = await sincronizarAgentes(ctx());
    expect(r.bajas).toBe(1);
    expect(m.quitar).toHaveBeenCalledWith(8, CFG);
  });

  it("el override de otro tenant no cuenta", async () => {
    tablas.studio_role_module_overrides = [{ tenant_id: T2, role: "support", module_id: "bandeja", can_view: false, can_edit: false }];
    expect((await sincronizarAgentes(ctx())).bajas).toBe(0);
  });

  it("el último admin humano desactivado: no se saca de la cuenta, el vínculo queda y la salud lo avisa", async () => {
    tablas.user_tenants[2].disabled_at = "2026-10-30T00:00:00Z";
    const r = await sincronizarAgentes(ctx());
    expect(r).toMatchObject({ bajas: 0, bloqueadas: 1 });
    expect(m.quitar).not.toHaveBeenCalled();
    expect(tablas.chatwoot_agent_links.some((v) => v.user_id === SAM && v.tenant_id === T1)).toBe(true);
    expect(r.salud.alertas).toContain("baja_bloqueada");
  });

  it("si Chatwoot no saca al agente: fallida y el vínculo se queda para reintentar", async () => {
    tablas.user_tenants[0].disabled_at = "2026-10-30T00:00:00Z";
    m.quitar.mockResolvedValueOnce({ ok: false, error: "http_500" });
    const r = await sincronizarAgentes(ctx());
    expect(r).toMatchObject({ bajas: 0, fallidas: 1 });
    expect(tablas.chatwoot_agent_links.some((v) => v.user_id === ANA && v.tenant_id === T1)).toBe(true);
  });

  it("si Chatwoot no responde: nadie se da de baja (no se puede comprobar el candado) y la salud lo dice", async () => {
    tablas.user_tenants[0].disabled_at = "2026-10-30T00:00:00Z";
    m.listar.mockResolvedValueOnce({ ok: false, error: "red" });
    const r = await sincronizarAgentes(ctx());
    expect(r).toMatchObject({ bajas: 0, fallidas: 1 });
    expect(m.quitar).not.toHaveBeenCalled();
    expect(r.salud.alertas).toEqual(["chatwoot_no_responde"]);
  });

  it("un agente que ya no está en la cuenta: solo se borra el vínculo", async () => {
    tablas.user_tenants[0].disabled_at = "2026-10-30T00:00:00Z";
    m.listar.mockResolvedValueOnce({ ok: true, data: CUENTA.filter((c) => c.userId !== 7) });
    const r = await sincronizarAgentes(ctx());
    expect(r.bajas).toBe(1);
    expect(m.quitar).not.toHaveBeenCalled();
  });

  it("si borrar el vínculo falla: fallida", async () => {
    tablas.user_tenants[0].disabled_at = "2026-10-30T00:00:00Z";
    admin = doble(tablas, { borrar: true });
    expect((await sincronizarAgentes(ctx())).fallidas).toBe(1);
  });

  it("soloUsuario: revisa solo ese vínculo", async () => {
    tablas.user_tenants[0].disabled_at = "2026-10-30T00:00:00Z";
    tablas.user_tenants[1].disabled_at = "2026-10-30T00:00:00Z";
    const r = await sincronizarAgentes(ctx(), { soloUsuario: LUIS });
    expect(r).toMatchObject({ revisados: 1, bajas: 1 });
    expect(m.quitar).toHaveBeenCalledWith(8, CFG);
    expect(m.quitar).toHaveBeenCalledTimes(1);
  });

  it("sin la 0503 (no existe la tabla de vínculos): omitido, sin tocar Chatwoot", async () => {
    admin = doble(tablas, { tabla: "chatwoot_agent_links" });
    const r = await sincronizarAgentes(ctx());
    expect(r.omitido).toBe(true);
    expect(m.listar).not.toHaveBeenCalled();
  });

  it("la salud refleja la cuenta DESPUÉS de las bajas", async () => {
    tablas.user_tenants[0].disabled_at = "2026-10-30T00:00:00Z";
    const r = await sincronizarAgentes(ctx());
    expect(r.salud.vinculosFueraDeCuenta).toEqual([]);
    expect(r.salud.adminsHumanos).toBe(1);
  });
});

describe("avisarSaludAAdmins (2.5)", () => {
  it("con alertas: un push a cada admin activo del tenant, sin datos personales", async () => {
    tablas.user_tenants.push({ tenant_id: T1, user_id: "20000000-0000-4000-8000-000000000005", role: "admin", disabled_at: "2026-10-01T00:00:00Z" });
    const n = await avisarSaludAAdmins(ctx(), { alertas: ["sin_admin_humano"], adminsHumanos: 0, vinculosFueraDeCuenta: [] });
    expect(n).toBe(1);
    expect(m.encolar).toHaveBeenCalledTimes(1);
    const [, tenant, usuario, payload] = m.encolar.mock.calls[0];
    expect([tenant, usuario]).toEqual([T1, SAM]);
    expect(payload).toMatchObject({ url: "/studio/bandeja", tag: "chatwoot-salud" });
    expect(payload.body).toContain("ningún administrador");
    expect(m.drenar).toHaveBeenCalledTimes(1);
  });

  it("sin alertas: no avisa", async () => {
    expect(await avisarSaludAAdmins(ctx(), { alertas: [], adminsHumanos: 1, vinculosFueraDeCuenta: [] })).toBe(0);
    expect(m.encolar).not.toHaveBeenCalled();
  });
});
