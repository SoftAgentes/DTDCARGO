// @vitest-environment node
/**
 * SDD-0570 · `pgliteLimpio` tiene que ser indistinguible de un `new PGlite()`.
 *
 * Si la plantilla arrastrara algo (un objeto, un GUC, un txid adelantado), los
 * contratos de migración correrían sobre otra base y un verde dejaría de
 * significar lo mismo. Por eso la huella compara más que el catálogo: también
 * el txid y el OID siguiente, de los que dependen los desempates por xmin.
 */
import { PGlite, type Extensions, type PGliteOptions } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pgliteLimpio } from "./pglite-limpio";

const SLOW = 60_000;

const HUELLA: Record<string, string> = {
  version: "select version() as v",
  sesion: "select current_user as u, session_user as s, current_database() as d",
  bases: "select string_agg(datname, ',' order by datname) as v from pg_database",
  roles: "select string_agg(rolname || ':' || rolsuper, ',' order by rolname) as v from pg_roles",
  extensiones: "select string_agg(extname || '@' || extversion, ',' order by extname) as v from pg_extension",
  catalogo: "select count(*)::int as n, max(oid::int) as maxoid from pg_class",
  esquemas: "select string_agg(nspname, ',' order by nspname) as v from pg_namespace",
  disponibles: "select count(*)::int as n from pg_available_extensions",
  ajustes:
    "select string_agg(name || '=' || setting, ';' order by name) as v from pg_settings where source not in ('default', 'override')",
  txid: "select txid_current()::text as t",
  oidSiguiente: "create table _sonda (x int); select 'public._sonda'::regclass::oid::int as oid",
};

async function huella(db: PGlite): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  try {
    for (const [nombre, sql] of Object.entries(HUELLA)) {
      const results = await db.exec(sql);
      out[nombre] = results[results.length - 1].rows[0];
    }
  } finally {
    await db.close();
  }
  return out;
}

const variantes: [string, Extensions | undefined][] = [
  ["sin extensiones", undefined],
  ["con pgcrypto", { pgcrypto }],
];

describe("SDD-0570 · pgliteLimpio", () => {
  afterEach(() => {
    vi.doUnmock("@electric-sql/pglite");
    vi.resetModules();
  });

  it.each(variantes)("%s: misma huella que un PGlite recién creado", async (_nombre, extensions) => {
    const fresco = await huella(new PGlite(extensions ? { extensions } : {}));
    // Dos veces: la segunda ya sale del caché, que es el camino de casi todos los casos.
    expect(await huella(await pgliteLimpio(extensions))).toEqual(fresco);
    expect(await huella(await pgliteLimpio(extensions))).toEqual(fresco);
  }, SLOW);

  it("lo que escribe un caso no llega al siguiente", async () => {
    const a = await pgliteLimpio();
    await a.exec("create table public.rastro (x int); insert into public.rastro values (1); create role rastro_rol;");
    await a.close();
    const b = await pgliteLimpio();
    try {
      const { rows } = await b.query<{ tabla: string | null; rol: number }>(
        "select to_regclass('public.rastro')::text as tabla, (select count(*)::int from pg_roles where rolname = 'rastro_rol') as rol",
      );
      expect(rows[0]).toEqual({ tabla: null, rol: 0 });
    } finally {
      await b.close();
    }
  }, SLOW);

  it("pgcrypto se crea y funciona sobre la plantilla", async () => {
    const db = await pgliteLimpio({ pgcrypto });
    try {
      await db.exec("create extension pgcrypto");
      const { rows } = await db.query<{ h: string; u: boolean }>(
        "select encode(digest('a', 'sha256'), 'hex') as h, gen_random_uuid() is not null as u",
      );
      expect(rows[0]).toEqual({ h: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb", u: true });
    } finally {
      await db.close();
    }
  }, SLOW);

  /**
   * Cuenta las instancias que arma el módulo: sin `loadDataDir` es un initdb.
   * No se espía `dumpDataDir` porque el propio `new PGlite()` lo llama por
   * dentro (hace el initdb en otra instancia y la carga).
   */
  async function contado(fallarDump = 0) {
    const construidos: { initdb: boolean }[] = [];
    vi.doMock("@electric-sql/pglite", async (importOriginal) => {
      const original = await importOriginal<typeof import("@electric-sql/pglite")>();
      class Contado extends original.PGlite {
        constructor(options?: PGliteOptions) {
          super(options);
          construidos.push({ initdb: !options?.loadDataDir });
        }
        override async dumpDataDir(...args: Parameters<PGlite["dumpDataDir"]>) {
          if (fallarDump > 0) {
            fallarDump--;
            throw new Error("initdb roto");
          }
          return super.dumpDataDir(...args);
        }
      }
      return { ...original, PGlite: Contado };
    });
    const { pgliteLimpio: limpio } = await import("./pglite-limpio");
    const initdbs = () => construidos.filter((c) => c.initdb).length;
    return { limpio, initdbs, total: () => construidos.length };
  }

  it("hace un initdb por juego de extensiones, no uno por caso", async () => {
    const { limpio, initdbs, total } = await contado();
    for (let i = 0; i < 3; i++) await (await limpio()).close();
    expect([initdbs(), total()]).toEqual([1, 4]);
    for (let i = 0; i < 2; i++) await (await limpio({ pgcrypto })).close();
    expect([initdbs(), total()]).toEqual([2, 7]);
  }, SLOW);

  it("una plantilla que falló no queda en el caché", async () => {
    const { limpio, initdbs } = await contado(1);
    await expect(limpio()).rejects.toThrow("initdb roto");
    await (await limpio()).close();
    expect(initdbs()).toBe(2);
  }, SLOW);
});
