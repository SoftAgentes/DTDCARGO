// @vitest-environment node
/**
 * SDD-0585 · paso 2.5 · `sincronizarAgentes` y `avisarSaludAAdmins`. El doble de
 * Supabase APLICA los filtros (`eq`, `is`): sin eso no se prueba que una baja
 * toque solo el vínculo del tenant y del usuario que corresponde.
 *
 * Paso 2.7: la baja cierra las sesiones a la fuerza (`cerrarSesionesAgente`),
 * anota la fecha (0508) y después corre la matriz (`aplicarMatriz`). Los dos
 * son dobles aquí; sus reglas se prueban en sus propios archivos.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Fila = Record<string, unknown>;
type Tablas = Record<string, Fila[]>;

function doble(tablas: Tablas, fallar: { tabla?: string; borrar?: boolean; upsert?: boolean } = {}) {
  const borrados: { tabla: string; filtros: string[] }[] = [];
  const upserts: { tabla: string; fila: Fila; onConflict?: string }[] = [];
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
      upsert: async (fila: Fila, opciones?: { onConflict?: string }) => {
        if (fallar.upsert) return { error: { code: "42P01" } };
        upserts.push({ tabla, fila, onConflict: opciones?.onConflict });
        return { error: null };
      },
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
  return { from, borrados, upserts };
}

const m = vi.hoisted(() => ({
  listar: vi.fn(),
  quitar: vi.fn(),
  encolar: vi.fn(),
  drenar: vi.fn(),
  cerrar: vi.fn(),
  matriz: vi.fn(),
  orden: [] as string[],
}));
vi.mock("server-only", () => ({}));
vi.mock("../platform-api", () => ({ listarMiembrosCuenta: m.listar, quitarDeCuenta: m.quitar }));
vi.mock("../cierre-sesion", () => ({ cerrarSesionesAgente: m.cerrar }));
vi.mock("../agentes-matriz", () => ({ aplicarMatriz: m.matriz }));
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
  m.orden = [];
  m.quitar.mockImplementation(async () => (m.orden.push("quitar"), { ok: true, data: null }));
  m.encolar.mockResolvedValue("push-1");
  m.cerrar.mockImplementation(async () => (m.orden.push("cerrar"), { ok: true, data: { sesionesCerradas: 1 } }));
  m.matriz.mockImplementation(async (_ctx: unknown, _agentes: unknown, miembros: unknown[]) => ({
    roles: 0,
    bloqueadas: 0,
    bandejas: 0,
    equipos: 0,
    fallidas: 0,
    miembrosCuenta: miembros,
  }));
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

describe("sincronizarAgentes · cierre forzado y matriz (2.7)", () => {
  it("la baja cierra las sesiones DESPUÉS de sacarlo de la cuenta y anota la fecha en su tenant", async () => {
    tablas.user_tenants[0].disabled_at = "2026-10-30T00:00:00Z";
    const r = await sincronizarAgentes(ctx());
    expect(r).toMatchObject({ bajas: 1, cierresPendientes: 0 });
    expect(m.cerrar).toHaveBeenCalledWith(7, CFG);
    expect(m.orden).toEqual(["quitar", "cerrar"]);
    expect(admin.upserts).toHaveLength(1);
    expect(admin.upserts[0]).toMatchObject({
      tabla: "chatwoot_agent_bajas",
      fila: { tenant_id: T1, chatwoot_user_id: 7 },
      onConflict: "tenant_id,chatwoot_user_id",
    });
    expect(Date.now() - Date.parse(String(admin.upserts[0].fila.baja_at))).toBeLessThan(60_000);
  });

  it("si el cierre falla: el vínculo queda para reintentar, no se anota la baja y la salud avisa", async () => {
    tablas.user_tenants[0].disabled_at = "2026-10-30T00:00:00Z";
    m.cerrar.mockResolvedValueOnce({ ok: false, paso: "entrada", error: "http_429" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = await sincronizarAgentes(ctx());
    expect(r).toMatchObject({ bajas: 0, cierresPendientes: 1 });
    expect(tablas.chatwoot_agent_links.some((v) => v.user_id === ANA && v.tenant_id === T1)).toBe(true);
    expect(admin.upserts).toEqual([]);
    expect(r.salud.alertas).toContain("cierre_pendiente");
    expect(JSON.stringify(warn.mock.calls)).toContain("entrada http_429");
    warn.mockRestore();
  });

  it("la corrida siguiente: ya fuera de la cuenta, reintenta solo el cierre y termina la baja", async () => {
    tablas.user_tenants[0].disabled_at = "2026-10-30T00:00:00Z";
    m.listar.mockResolvedValueOnce({ ok: true, data: CUENTA.filter((c) => c.userId !== 7) });
    const r = await sincronizarAgentes(ctx());
    expect(m.quitar).not.toHaveBeenCalled();
    expect(m.cerrar).toHaveBeenCalledWith(7, CFG);
    expect(r.bajas).toBe(1);
  });

  it("un usuario que ya no existe en Chatwoot no tiene sesiones: la baja sigue", async () => {
    tablas.user_tenants[0].disabled_at = "2026-10-30T00:00:00Z";
    m.cerrar.mockResolvedValueOnce({ ok: false, paso: "token", error: "no_encontrado" });
    const r = await sincronizarAgentes(ctx());
    expect(r).toMatchObject({ bajas: 1, cierresPendientes: 0 });
  });

  it("un 404 en otro paso del cierre SÍ queda pendiente", async () => {
    tablas.user_tenants[0].disabled_at = "2026-10-30T00:00:00Z";
    m.cerrar.mockResolvedValueOnce({ ok: false, paso: "enlace", error: "no_encontrado" });
    expect((await sincronizarAgentes(ctx())).cierresPendientes).toBe(1);
  });

  it("sin la 0508 (no se puede anotar la fecha): avisa y la baja sigue igual", async () => {
    tablas.user_tenants[0].disabled_at = "2026-10-30T00:00:00Z";
    admin = doble(tablas, { upsert: true });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = await sincronizarAgentes(ctx());
    expect(r.bajas).toBe(1);
    expect(JSON.stringify(warn.mock.calls)).toContain("42P01");
    warn.mockRestore();
  });

  it("la matriz recibe los vínculos que quedan, con su rol de Studio, y la cuenta después de las bajas", async () => {
    tablas.user_tenants[0].disabled_at = "2026-10-30T00:00:00Z";
    await sincronizarAgentes(ctx());
    expect(m.matriz).toHaveBeenCalledTimes(1);
    const [, agentes, miembros] = m.matriz.mock.calls[0];
    expect(agentes).toEqual([
      { chatwootUserId: 8, rol: "support" },
      { chatwootUserId: 3, rol: "admin" },
    ]);
    expect((miembros as { userId: number }[]).map((x) => x.userId)).toEqual([SERVICIO, 3, 8]);
  });

  it("soloUsuario: la matriz vuelve a leer TODOS los vínculos del tenant (las bandejas se fijan con la lista completa)", async () => {
    tablas.user_tenants[1].disabled_at = "2026-10-30T00:00:00Z";
    await sincronizarAgentes(ctx(), { soloUsuario: LUIS });
    const [, agentes] = m.matriz.mock.calls[0];
    expect(agentes).toEqual([
      { chatwootUserId: 7, rol: "commercial" },
      { chatwootUserId: 3, rol: "admin" },
    ]);
  });

  it("una baja que no se pudo completar NO entra en la matriz (no se le devuelve el rol ni la bandeja)", async () => {
    tablas.user_tenants[0].disabled_at = "2026-10-30T00:00:00Z";
    m.quitar.mockResolvedValueOnce({ ok: false, error: "http_500" });
    const r = await sincronizarAgentes(ctx());
    expect(r.fallidas).toBe(1);
    const [, agentes] = m.matriz.mock.calls[0];
    expect((agentes as { chatwootUserId: number }[]).map((a) => a.chatwootUserId)).toEqual([8, 3]);
  });

  it("si Chatwoot no responde no se corre la matriz", async () => {
    m.listar.mockResolvedValueOnce({ ok: false, error: "red" });
    await sincronizarAgentes(ctx());
    expect(m.matriz).not.toHaveBeenCalled();
  });

  it("la salud usa la cuenta que devuelve la matriz y suma sus alertas", async () => {
    m.matriz.mockResolvedValueOnce({
      roles: 1,
      bloqueadas: 1,
      bandejas: 0,
      equipos: 0,
      fallidas: 1,
      miembrosCuenta: [...CUENTA, { userId: 12, rol: "agent" }],
    });
    tablas.chatwoot_agent_links.push({ tenant_id: T1, user_id: "20000000-0000-4000-8000-000000000008", chatwoot_user_id: 12 });
    tablas.user_tenants.push({ tenant_id: T1, user_id: "20000000-0000-4000-8000-000000000008", role: "support", disabled_at: null });
    const r = await sincronizarAgentes(ctx());
    expect(r.salud.vinculosFueraDeCuenta).toEqual([]);
    expect(r.salud.alertas).toEqual(expect.arrayContaining(["degradacion_bloqueada", "matriz_incompleta"]));
    expect(r.matriz).toEqual({ roles: 1, bloqueadas: 1, bandejas: 0, equipos: 0, fallidas: 1 });
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
