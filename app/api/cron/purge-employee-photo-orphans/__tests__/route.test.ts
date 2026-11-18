// @vitest-environment node
/**
 * SDD-0652 fase 2 · reconciliación de fotos huérfanas
 * (/api/cron/purge-employee-photo-orphans).
 *
 * Cubre: 403 sin el secreto; solo cuenta por defecto; borra únicamente con
 * PURGE_EMPLOYEE_PHOTO_ORPHANS_ENABLED=true; nunca borra una foto referida por
 * una ficha viva ni una subida reciente; `?dryRun=1` fuerza el conteo; y si no
 * se pueden leer las referencias, no borra nada. Rutas sintéticas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DAY = 24 * 60 * 60 * 1000;
const VIEJA = new Date(Date.now() - 10 * DAY).toISOString();
const RECIENTE = new Date(Date.now() - 60 * 1000).toISOString();

const T = "10000000-0000-4000-8000-000000000001";
const E1 = "30000000-0000-4000-8000-000000000001";
const E2 = "30000000-0000-4000-8000-000000000002";
const ACTUAL = `${T}/${E1}/aaaaaaaa-0000-4000-8000-000000000001.webp`;
const ANTERIOR = `${T}/${E1}/bbbbbbbb-0000-4000-8000-000000000002.webp`;
const EN_VUELO = `${T}/${E1}/cccccccc-0000-4000-8000-000000000003.webp`;
const DE_BORRADA = `${T}/${E2}/dddddddd-0000-4000-8000-000000000004.webp`;

type Entrada = { name: string; id: string | null; created_at: string | null };

const state = {
  borradas: [] as string[],
  filtros: [] as [string, ...unknown[]][],
  referidas: [] as { photo_path: string | null }[],
  dbError: null as { code: string; message: string } | null,
  arbol: {} as Record<string, Entrada[]>,
  listError: false,
  logs: [] as string[],
};

function makeAdmin() {
  return {
    from: (tabla: string) => {
      expect(tabla).toBe("nomina_employees");
      const chain: Record<string, unknown> = {
        select: (c: string) => (state.filtros.push(["select", c]), chain),
        is: (c: string, v: unknown) => (state.filtros.push(["is", c, v]), chain),
        not: (c: string, op: string, v: unknown) => (state.filtros.push(["not", c, op, v]), chain),
        order: () => chain,
        range: (from: number) =>
          Promise.resolve(
            state.dbError ? { data: null, error: state.dbError } : { data: from > 0 ? [] : state.referidas, error: null },
          ),
      };
      return chain;
    },
    storage: {
      from: (bucket: string) => {
        expect(bucket).toBe("employee-photos");
        return {
          list: (prefix: string, opts: { offset?: number }) => {
            if (state.listError) return Promise.resolve({ data: null, error: { message: "x" } });
            if ((opts?.offset ?? 0) > 0) return Promise.resolve({ data: [], error: null });
            return Promise.resolve({ data: state.arbol[prefix] ?? [], error: null });
          },
          remove: (rutas: string[]) => {
            state.borradas.push(...rutas);
            return Promise.resolve({ error: null });
          },
        };
      },
    },
  };
}

vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => makeAdmin() }));

import { GET, POST } from "../route";

function req(query = "", headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost/api/cron/purge-employee-photo-orphans${query}`, { method: "GET", headers });
}
const AUTH = { authorization: "Bearer s3cret" };
const archivo = (ruta: string, created_at: string | null): Entrada => ({ name: ruta.split("/").pop()!, id: "obj", created_at });

beforeEach(() => {
  state.borradas = [];
  state.filtros = [];
  state.dbError = null;
  state.listError = false;
  state.logs = [];
  // E1 tiene foto (ACTUAL). E2 está borrada: su foto ya no cuenta como referida.
  state.referidas = [{ photo_path: ACTUAL }];
  state.arbol = {
    "": [{ name: T, id: null, created_at: null }],
    [T]: [
      { name: E1, id: null, created_at: null },
      { name: E2, id: null, created_at: null },
    ],
    [`${T}/${E1}`]: [archivo(ACTUAL, VIEJA), archivo(ANTERIOR, VIEJA), archivo(EN_VUELO, RECIENTE)],
    [`${T}/${E2}`]: [archivo(DE_BORRADA, VIEJA)],
  };
  process.env.CRON_SECRET = "s3cret";
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void state.logs.push(a.join(" ")));
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.PURGE_EMPLOYEE_PHOTO_ORPHANS_ENABLED;
  vi.restoreAllMocks();
});

describe("auth", () => {
  it.each([
    ["sin Authorization", {}],
    ["con otro secreto", { authorization: "Bearer otro" }],
  ])("%s → 403 y no borra", async (_caso, headers) => {
    process.env.PURGE_EMPLOYEE_PHOTO_ORPHANS_ENABLED = "true";
    const res = await GET(req("", headers as Record<string, string>) as never);
    expect(res.status).toBe(403);
    expect(state.borradas).toEqual([]);
    expect(state.filtros).toEqual([]);
  });

  it("sin CRON_SECRET configurado → 403", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req("", AUTH) as never)).status).toBe(403);
  });
});

describe("nace apagado", () => {
  it.each([undefined, "", "1", "TRUE", "false"])("con PURGE_EMPLOYEE_PHOTO_ORPHANS_ENABLED=%j solo cuenta", async (valor) => {
    if (valor !== undefined) process.env.PURGE_EMPLOYEE_PHOTO_ORPHANS_ENABLED = valor;
    const res = await GET(req("", AUTH) as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toMatchObject({ mode: "dry-run", scanned: 4, referenced: 1, orphans: 2, deleted: 0, skippedTooNew: 1 });
    expect(state.borradas).toEqual([]);
  });
});

describe("encendido", () => {
  beforeEach(() => {
    process.env.PURGE_EMPLOYEE_PHOTO_ORPHANS_ENABLED = "true";
  });

  it("borra la foto anterior y la de la ficha borrada; nunca la actual ni la subida reciente", async () => {
    const res = await POST(req("", AUTH) as never);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toMatchObject({ mode: "live", orphans: 2, deleted: 2 });
    expect([...state.borradas].sort()).toEqual([ANTERIOR, DE_BORRADA].sort());
    expect(state.borradas).not.toContain(ACTUAL);
    expect(state.borradas).not.toContain(EN_VUELO);
  });

  it("«referida» es la foto de una ficha VIVA: lee photo_path sin las borradas", async () => {
    await GET(req("", AUTH) as never);
    expect(state.filtros).toEqual([
      ["select", "photo_path"],
      ["is", "deleted_at", null],
      ["not", "photo_path", "is", null],
    ]);
  });

  it("?dryRun=1 fuerza el conteo aunque esté encendido", async () => {
    const json = (await (await GET(req("?dryRun=1", AUTH) as never)).json()) as Record<string, unknown>;
    expect(json).toMatchObject({ mode: "dry-run", orphans: 2, deleted: 0 });
    expect(state.borradas).toEqual([]);
  });

  it("si no se pueden leer las referencias (por ejemplo, sin la columna), responde 500 y NO borra nada", async () => {
    state.dbError = { code: "42703", message: "column nomina_employees.photo_path does not exist" };
    const res = await GET(req("", AUTH) as never);
    expect(res.status).toBe(500);
    expect(state.borradas).toEqual([]);
  });

  it("si no se puede listar el bucket, responde 500 y no borra nada", async () => {
    state.listError = true;
    const res = await GET(req("", AUTH) as never);
    expect(res.status).toBe(500);
    expect(state.borradas).toEqual([]);
  });

  it("un objeto sin fecha no se borra", async () => {
    state.arbol[`${T}/${E2}`] = [archivo(DE_BORRADA, null)];
    const json = (await (await GET(req("", AUTH) as never)).json()) as Record<string, unknown>;
    expect(json).toMatchObject({ deleted: 1, skippedNoDate: 1 });
    expect(state.borradas).toEqual([ANTERIOR]);
  });

  it("el log lleva conteos, no rutas ni ids de ficha", async () => {
    await GET(req("", AUTH) as never);
    const todo = state.logs.join("\n");
    expect(todo).toContain('"deleted":2');
    expect(todo).not.toContain(E1);
    expect(todo).not.toContain(".webp");
  });
});
