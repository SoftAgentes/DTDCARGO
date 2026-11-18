// @vitest-environment node
/**
 * SDD-0585 · paso 2.7 · purga por plazo en el cron `chatwoot-reintentos`.
 * Las RPC de la 0508 se prueban en PGlite (`chatwoot-bajas.migration.test.ts`);
 * aquí, los candados de TypeScript antes de borrar un usuario de Chatwoot. El
 * doble APLICA los filtros (`eq`, `in`).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Fila = Record<string, unknown>;

const m = vi.hoisted(() => ({ listar: vi.fn(), borrar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../platform-api", () => ({ listarMiembrosCuenta: m.listar, borrarUsuario: m.borrar }));

import { purgarBajasVencidas, purgarBandejaChatwoot } from "../purga";

const T1 = "10000000-0000-4000-8000-000000000001";
const T2 = "10000000-0000-4000-8000-000000000002";
const CFG = { origin: "https://chat.ejemplo.test", token: "tok", accountId: 1 };
const SERVICIO = 1;

function doble(opciones: {
  rpc?: Record<string, { data: unknown; error: { code: string } | null }>;
  tablas?: Record<string, Fila[]>;
  errorVinculos?: boolean;
}) {
  const tablas = opciones.tablas ?? {};
  const from = (tabla: string) => {
    const filtros: ((f: Fila) => boolean)[] = [];
    let modo: "select" | "delete" = "select";
    const filas = () => (tablas[tabla] ?? []).filter((f) => filtros.every((p) => p(f)));
    const builder = {
      select: () => builder,
      delete: () => ((modo = "delete"), builder),
      eq: (col: string, v: unknown) => (filtros.push((f) => f[col] === v), builder),
      in: (col: string, vs: unknown[]) => (filtros.push((f) => vs.includes(f[col])), builder),
      then: (r: (v: { data: Fila[] | null; error: { code: string } | null }) => unknown) => {
        if (modo === "delete") {
          const quitar = new Set(filas());
          tablas[tabla] = (tablas[tabla] ?? []).filter((f) => !quitar.has(f));
          return Promise.resolve(r({ data: null, error: null }));
        }
        if (opciones.errorVinculos && tabla === "chatwoot_agent_links") return Promise.resolve(r({ data: null, error: { code: "42P01" } }));
        return Promise.resolve(r({ data: filas(), error: null }));
      },
    };
    return builder;
  };
  const rpc = vi.fn(async (nombre: string) => opciones.rpc?.[nombre] ?? { data: null, error: { code: "PGRST202" } });
  return { from, rpc, tablas };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.listar.mockResolvedValue({ ok: true, data: [{ userId: SERVICIO, rol: "administrator" }, { userId: 3, rol: "administrator" }] });
  m.borrar.mockResolvedValue({ ok: true, data: null });
});

describe("purgarBandejaChatwoot", () => {
  it("devuelve lo que borró la 0508", async () => {
    const admin = doble({ rpc: { chatwoot_purgar_bandeja: { data: [{ eventos: 12, conversaciones: 2 }], error: null } } });
    expect(await purgarBandejaChatwoot(admin as never)).toEqual({ eventos: 12, conversaciones: 2 });
    expect(admin.rpc).toHaveBeenCalledWith("chatwoot_purgar_bandeja");
  });

  it("sin la 0508: omitido y sin ruido; otro error: omitido con su código", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await purgarBandejaChatwoot(doble({}) as never)).toEqual({ omitido: true });
    expect(warn).not.toHaveBeenCalled();
    const otro = doble({ rpc: { chatwoot_purgar_bandeja: { data: null, error: { code: "57014" } } } });
    expect(await purgarBandejaChatwoot(otro as never)).toEqual({ omitido: true });
    expect(JSON.stringify(warn.mock.calls)).toContain("57014");
    warn.mockRestore();
  });
});

describe("purgarBajasVencidas", () => {
  const vencidas = (ids: [string, number][]) => ({
    chatwoot_bajas_vencidas: { data: ids.map(([tenant_id, chatwoot_user_id]) => ({ tenant_id, chatwoot_user_id })), error: null },
  });
  const bajas = (ids: [string, number][]) => ids.map(([tenant_id, chatwoot_user_id]) => ({ tenant_id, chatwoot_user_id }));

  it("borra el usuario de Chatwoot y después su fila", async () => {
    const admin = doble({ rpc: vencidas([[T1, 7]]), tablas: { chatwoot_agent_bajas: bajas([[T1, 7], [T2, 7]]), chatwoot_agent_links: [] } });
    expect(await purgarBajasVencidas(admin as never, CFG, SERVICIO)).toEqual({ borrados: 1, conservados: 0, ajenos: 0, fallidos: 0 });
    expect(m.borrar).toHaveBeenCalledWith(7, CFG);
    expect(admin.tablas.chatwoot_agent_bajas).toEqual(bajas([[T2, 7]]));
  });

  it("nunca el usuario de servicio, ni uno que está en la cuenta, ni uno con vínculo: se conservan y su baja se borra", async () => {
    const admin = doble({
      rpc: vencidas([[T1, SERVICIO], [T1, 3], [T1, 8]]),
      tablas: { chatwoot_agent_bajas: bajas([[T1, SERVICIO], [T1, 3], [T1, 8]]), chatwoot_agent_links: [{ tenant_id: T2, chatwoot_user_id: 8 }] },
    });
    expect(await purgarBajasVencidas(admin as never, CFG, SERVICIO)).toEqual({ borrados: 0, conservados: 3, ajenos: 0, fallidos: 0 });
    expect(m.borrar).not.toHaveBeenCalled();
    expect(admin.tablas.chatwoot_agent_bajas).toEqual([]);
  });

  it("el usuario de servicio no se borra aunque no figure en la cuenta ni tenga vínculo", async () => {
    m.listar.mockResolvedValueOnce({ ok: true, data: [{ userId: 3, rol: "administrator" }] });
    const admin = doble({ rpc: vencidas([[T1, SERVICIO]]), tablas: { chatwoot_agent_bajas: bajas([[T1, SERVICIO]]), chatwoot_agent_links: [] } });
    expect(await purgarBajasVencidas(admin as never, CFG, SERVICIO)).toEqual({ borrados: 0, conservados: 1, ajenos: 0, fallidos: 0 });
    expect(m.borrar).not.toHaveBeenCalled();
  });

  it("sin la lista de la cuenta o sin los vínculos no se borra a nadie", async () => {
    m.listar.mockResolvedValueOnce({ ok: false, error: "red" });
    const admin = doble({ rpc: vencidas([[T1, 7]]), tablas: { chatwoot_agent_bajas: bajas([[T1, 7]]) } });
    expect(await purgarBajasVencidas(admin as never, CFG, SERVICIO)).toEqual({ borrados: 0, conservados: 0, ajenos: 0, fallidos: 1 });
    const sinVinculos = doble({ rpc: vencidas([[T1, 7]]), errorVinculos: true });
    expect(await purgarBajasVencidas(sinVinculos as never, CFG, SERVICIO)).toEqual({ borrados: 0, conservados: 0, ajenos: 0, fallidos: 1 });
    expect(m.borrar).not.toHaveBeenCalled();
    expect(admin.tablas.chatwoot_agent_bajas).toEqual(bajas([[T1, 7]]));
  });

  it("ya borrado (404): cuenta como borrado; ajeno a la app (401): se suelta la fila; 500: queda para reintentar", async () => {
    m.borrar
      .mockResolvedValueOnce({ ok: false, error: "no_encontrado" })
      .mockResolvedValueOnce({ ok: false, error: "no_autorizado" })
      .mockResolvedValueOnce({ ok: false, error: "http_500" });
    const admin = doble({ rpc: vencidas([[T1, 7], [T1, 8], [T1, 9]]), tablas: { chatwoot_agent_bajas: bajas([[T1, 7], [T1, 8], [T1, 9]]), chatwoot_agent_links: [] } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await purgarBajasVencidas(admin as never, CFG, SERVICIO)).toEqual({ borrados: 1, conservados: 0, ajenos: 1, fallidos: 1 });
    expect(admin.tablas.chatwoot_agent_bajas).toEqual(bajas([[T1, 9]]));
    warn.mockRestore();
  });

  it("sin vencidas no llama a Chatwoot; sin config o sin la 0508: omitido", async () => {
    const vacia = doble({ rpc: vencidas([]) });
    expect(await purgarBajasVencidas(vacia as never, CFG, SERVICIO)).toEqual({ borrados: 0, conservados: 0, ajenos: 0, fallidos: 0 });
    expect(m.listar).not.toHaveBeenCalled();
    expect(await purgarBajasVencidas(vacia as never, null, SERVICIO)).toEqual({ omitido: true });
    expect(vacia.rpc).toHaveBeenCalledTimes(1);
    expect(await purgarBajasVencidas(doble({}) as never, CFG, SERVICIO)).toEqual({ omitido: true });
  });
});
