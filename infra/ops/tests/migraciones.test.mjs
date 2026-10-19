// @vitest-environment node
/**
 * SDD-0546 · infra/ops/migraciones/: el generador, el SQL que genera y el retiro
 * de esperas.
 *
 * - Funciones puras de preparar.mjs: la máscara de comentarios, cadenas y cuerpos
 *   entre dólares; los `create function` de nivel superior y sus cuerpos; los
 *   bloques `$preflight$`.
 * - Paridad con infra/ops/lib/migracion.sh: el envoltorio de node es byte a byte
 *   el de `mig_envolver`, y los rechazos son los de `mig_revisar` (el servidor
 *   rehace el envoltorio con bash y se niega si difiere).
 * - Contra PostgreSQL embebido (PGlite): el cuerpo que extrae node es el `prosrc`
 *   que guarda Postgres, en funciones reales del repo; la lectura previa detecta
 *   cada estado de deriva y el preflight propio; el apply deja la fila del ledger;
 *   la verificación pasa y cae si el ledger o un cuerpo vivo difieren.
 * - retirar-espera.mjs sobre copias temporales, con el sello en el candado de la
 *   SDD-0561 (supabase/migrations.lock.json).
 * - La prueba bash con dobles (infra/ops/tests/prueba-migraciones-produccion.sh):
 *   «0 FALLÓ». Nada de esto toca el servidor ni una base real.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as P from "../migraciones/preparar.mjs";
import { retirarEspera } from "../migraciones/retirar-espera.mjs";
import { verificarRepo } from "../../../scripts/migrations-lock.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const MIGS = path.join(RAIZ, "supabase", "migrations");
const LIB = path.join(RAIZ, "infra", "ops", "lib", "migracion.sh");
const SLOW = 240_000;
/**
 * ⏱️ Las que lanzan bash (paridad, bash -n) o leen las 485 migraciones tardan
 * 0,1-0,4 s aisladas y, con la máquina cargada, 2,3-7,2 s (×20, SDD-0550):
 * con el tope global de 20 s quedaban a merced de la carga de `verify`.
 */
const BAJO_CARGA = 120_000;

// En Windows, el `bash` del PATH puede ser el de WSL: se prefiere el de Git.
const BASH = (() => {
  if (process.platform !== "win32") return "bash";
  for (const p of ["C:\\Program Files\\Git\\bin\\bash.exe", "C:\\Program Files\\Git\\usr\\bin\\bash.exe"]) if (existsSync(p)) return p;
  return "bash";
})();
const barras = (p) => p.replace(/\\/g, "/");
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "sdd0546-"));
/** El SQL de psql sin sus metacomandos (`\set …`), para PGlite. */
const sinMeta = (sql) => sql.split("\n").filter((l) => !l.startsWith("\\")).join("\n");

// ─── Fixture: tres migraciones inventadas ────────────────────────────────────
const M0900 = "create or replace function public.zz_f() returns int language sql as $$ select 0 $$;\n";
const M0901 = "-- create function public.zz_comentada() returns int as $$ select 9 $$;\ncreate or replace function public.zz_f() returns int language sql as $$ select 1 -- uno\n$$;\n";
const M0902 = [
  "-- 0902 · SDD-0546 — prueba. ⚠️ NO APLICADA A PRODUCCIÓN.",
  "set lock_timeout = '5s';",
  "do $preflight$",
  "begin",
  "  if to_regprocedure('public.zz_f()') is null then",
  "    raise exception '0902 requiere public.zz_f()';",
  "  end if;",
  "end;",
  "$preflight$;",
  "create or replace function public.zz_f() returns int language sql as $$ select 2 $$;",
  "create function public.zz_g(p_x text default 'a') returns text language plpgsql as $function$",
  "begin",
  "  return 'g-' || p_x; -- comentario dentro del cuerpo: queda en prosrc",
  "end;",
  "$function$;",
  "reset lock_timeout;",
  "",
].join("\n");
const PREVIAS = [
  { archivo: "0900_zz_cero.sql", texto: M0900 },
  { archivo: "0901_zz_base.sql", texto: M0901 },
];
const SHA = "0".repeat(40);

describe("SDD-0546 · lectura del SQL (preparar.mjs)", () => {
  it("la máscara tapa comentarios, cadenas y cuerpos entre dólares y conserva las posiciones", () => {
    const t = "select 'a -- b' /* c */ , $x$ d $x$; -- e\nselect 1;";
    const { mascara, bloques } = P.enmascarar(t);
    expect(mascara.length).toBe(t.length);
    expect(mascara.split("\n").length).toBe(2);
    for (const tapado of ["'a", "-- b", "/* c */", "$x$", " d ", "-- e"]) expect(mascara).not.toContain(tapado);
    expect(mascara.startsWith("select ")).toBe(true);
    expect(mascara.endsWith("\nselect 1;")).toBe(true);
    expect(bloques).toHaveLength(1);
    expect(t.slice(bloques[0].contenidoInicio, bloques[0].contenidoFin)).toBe(" d ");
  });

  it("extrae los create function de nivel superior con su cuerpo exacto, esquema y firma", () => {
    const ev = P.eventosDeFunciones(M0902).filter((e) => e.tipo === "crear");
    expect(ev.map((e) => `${e.esquema}.${e.nombre}(${e.args})`)).toEqual(["public.zz_f()", "public.zz_g(p_x text)"]);
    expect(ev[0].cuerpo).toBe(" select 2 ");
    expect(ev[1].cuerpo).toContain("-- comentario dentro del cuerpo: queda en prosrc");
    expect(ev[1].cuerpo.startsWith("\nbegin\n")).toBe(true);
  });

  it("un create function en un comentario o en una cadena no cuenta ni roba el cuerpo siguiente", () => {
    expect(P.eventosDeFunciones(M0901).filter((e) => e.tipo === "crear").map((e) => e.nombre)).toEqual(["zz_f"]);
    const t = "do $$ begin raise exception 'create function public.zz_mal()'; end $$;\ncreate function public.zz_bien() returns int language sql as $q$ select 1 $q$;\n";
    const ev = P.eventosDeFunciones(t).filter((e) => e.tipo === "crear");
    expect(ev.map((e) => [e.nombre, e.cuerpo])).toEqual([["zz_bien", " select 1 "]]);
  });

  it("el bloque $preflight$ sale tal cual y la escritura en su código se detecta (no en cadenas ni comentarios)", () => {
    const [b] = P.bloquesPreflight(M0902);
    expect(b.texto.startsWith("do $preflight$\nbegin")).toBe(true);
    expect(b.texto.endsWith("$preflight$;")).toBe(true);
    expect(b.escritura).toEqual([]);
    const conEscritura = "do $preflight$\nbegin\n  -- update en un comentario no cuenta\n  raise notice 'delete en una cadena tampoco';\n  perform 1 from t for update;\nend;\n$preflight$;\n";
    expect(P.bloquesPreflight(conEscritura)[0].escritura).toEqual(["update"]);
  });

  it("en las migraciones reales: los $preflight$ de nivel superior se extraen y ninguno escribe", () => {
    let bloques = 0;
    for (const f of readdirSync(MIGS).filter((x) => x.endsWith(".sql"))) {
      for (const b of P.bloquesPreflight(readFileSync(path.join(MIGS, f), "utf8"))) {
        bloques++;
        expect(b.escritura, f).toEqual([]);
      }
    }
    expect(bloques).toBeGreaterThanOrEqual(100);
  }, BAJO_CARGA);

  it("deriva esperada: último cuerpo de cada firma como vigente, los reemplazados como anteriores, y las nuevas", () => {
    const d = P.derivaEsperada(M0902, PREVIAS);
    const f = d.find((x) => x.funcion === "public.zz_f");
    const g = d.find((x) => x.funcion === "public.zz_g");
    expect(f).toMatchObject({ previa: true, origen: "0901_zz_base.sql", aceptada: false, vigentes: [P.md5(" select 1 -- uno\n")], anteriores: [P.md5(" select 0 ")] });
    expect(f.vigentesSinComentarios).toEqual([P.md5("select1")]);
    expect(P.sinComentarios("select '--no' /* sí */ -- sí\n, 1")).toBe("select'--no',1");
    expect(g).toMatchObject({ previa: false, vigentes: [], anteriores: [] });
    expect(P.derivaEsperada(M0902, PREVIAS, ["public.zz_f"]).find((x) => x.funcion === "public.zz_f").aceptada).toBe(true);
    expect(() => P.derivaEsperada(M0902, PREVIAS, ["public.zz_otra"])).toThrow(/no crea/);
    const borrada = [...PREVIAS, { archivo: "0901b_zz_borra.sql", texto: "drop function if exists public.zz_f();\n" }];
    expect(P.derivaEsperada(M0902, borrada).find((x) => x.funcion === "public.zz_f").previa).toBe(false);
  });

  it("created_by según el destino, y nada fuera de producción o -staging", () => {
    expect(P.createdByPara(P.PROYECTO_PRODUCCION, "0546")).toBe("servidor-propio:psql:SDD-0546");
    expect(P.createdByPara("dtd-cargo-staging", "0546")).toBe("servidor-propio:psql:prueba:SDD-0546");
    expect(() => P.createdByPara("otro", "0546")).toThrow(P.Rechazo);
  });
});

describe("SDD-0546 · paridad con infra/ops/lib/migracion.sh", { timeout: BAJO_CARGA }, () => {
  const dir = tmp();
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const bash = (script, env) => spawnSync(BASH, ["-c", script], { encoding: "utf8", env: { ...process.env, LIB: barras(LIB), ...env } });

  it.each([
    ["con salto final", M0902],
    ["sin salto final", "create table public.zz (id int);"],
    ["barra invertida dentro de una línea", "select 'a\\b' as x;\n"],
  ])("envolver = mig_envolver byte a byte (%s)", (_n, texto) => {
    const f = path.join(dir, `m-${Math.random().toString(36).slice(2)}.sql`);
    writeFileSync(f, texto);
    const out = `${f}.env`;
    const r = bash('source "$LIB"; mig_envolver "$F" 0902_zz_buena "servidor-propio:psql:SDD-0546" "$MIG_VERSION_RELOJ" "$OUT"', { F: barras(f), OUT: barras(out) });
    expect(r.status, r.stderr).toBe(0);
    expect(Buffer.from(P.envolver(texto, "0902_zz_buena", "servidor-propio:psql:SDD-0546"), "utf8").equals(readFileSync(out))).toBe(true);
  });

  it.each([
    ["CR", "create table public.zz (id int);\r\n", "CR"],
    ["barra al inicio", "select 1;\n\\connect otra\n", "barra invertida"],
    ["delimitador", "select $mig0902$x$mig0902$;\n", "delimitador"],
    ["begin propio", "begin;\nselect 1;\ncommit;\n", "begin, commit o rollback"],
    ["end de plpgsql (vale)", "do $$ begin perform 1; end $$;\nend;\n", null],
  ])("revisarMigracion rechaza lo mismo que mig_revisar (%s)", (_n, texto, motivo) => {
    const f = path.join(dir, `r-${Math.random().toString(36).slice(2)}.sql`);
    writeFileSync(f, texto);
    const r = bash('source "$LIB"; mig_revisar "$F" 0902_zz_buena 0', { F: barras(f) });
    const nodo = P.revisarMigracion(readFileSync(f), "0902_zz_buena");
    expect(r.status === 0, `${r.stdout}`).toBe(nodo.length === 0);
    if (motivo) expect(nodo.join(" ")).toContain(motivo);
  });
});

/** PGlite con lo mínimo de Supabase que tocan los scripts: el ledger y dos roles. */
async function baseNueva() {
  const db = new PGlite();
  await db.exec(`
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text, created_by text, idempotency_key text, rollback text[]);
    create role anon;
    create role authenticated;
  `);
  return db;
}
/** Corre un script; si falla, deshace la transacción abierta y relanza. */
async function correr(db, sql) {
  try {
    return await db.exec(sinMeta(sql));
  } catch (e) {
    await db.exec("rollback").catch(() => {});
    throw e;
  }
}
const filas = (res) => res.flatMap((r) => r.rows);

describe("SDD-0546 · el cuerpo que extrae node es el prosrc de Postgres (migraciones reales, PGlite)", () => {
  it(
    "en las funciones de 0400 en adelante que se pueden crear sin su esquema, md5(prosrc) = md5 del cuerpo extraído",
    async () => {
      const db = new PGlite();
      await db.exec("set check_function_bodies = off;");
      let comparadas = 0;
      for (const f of readdirSync(MIGS).filter((x) => x.endsWith(".sql") && x >= "0400").sort()) {
        const texto = readFileSync(path.join(MIGS, f), "utf8");
        for (const e of P.eventosDeFunciones(texto)) {
          if (e.tipo !== "crear" || e.cuerpo === null || e.esquema !== "public") continue;
          const sentencia = texto.slice(e.posicion, e.finSentencia);
          await db.exec("begin;");
          try {
            await db.exec(sentencia);
          } catch {
            await db.exec("rollback;");
            continue; // tipos o tablas del resto del esquema: no se puede crear aislada
          }
          const r = await db.query("select md5(prosrc) as m from pg_proc where pronamespace = 'public'::regnamespace and proname = $1", [e.nombre]);
          await db.exec("rollback;");
          expect(r.rows.map((x) => x.m), `${f} · ${e.nombre}`).toEqual([P.md5(e.cuerpo)]);
          comparadas++;
        }
      }
      expect(comparadas).toBeGreaterThanOrEqual(30);
    },
    SLOW,
  );
});

describe("SDD-0546 · lectura previa, apply y verificación contra PostgreSQL (PGlite)", () => {
  const NOMBRE = "0902_zz_buena";
  const previa = (aceptadas = []) =>
    P.armarPrevia({ nombre: NOMBRE, sha: SHA, deriva: P.derivaEsperada(M0902, PREVIAS, aceptadas), preflights: P.bloquesPreflight(M0902) });
  const verificar = () =>
    P.armarVerificar({ nombre: NOMBRE, sha: SHA, blobMd5: P.md5(M0902), blobBytes: Buffer.byteLength(M0902), funciones: P.funcionesCreadas(M0902) });
  const estado = (res) => filas(res).filter((r) => "estado" in r).map((r) => `${r.funcion}:${r.estado}`);
  const resultado = (res) => filas(res).find((r) => "resultado" in r)?.resultado;

  it(
    "deriva: igual, sin espacios, sin comentarios, cuerpo desconocido, aceptada, cuerpo anterior, falta en vivo y sin definición previa",
    async () => {
      const db = await baseNueva();
      await db.exec(M0901);
      let r = await correr(db, previa());
      expect(estado(r)).toEqual(["public.zz_f:igual", "public.zz_g:nueva"]);
      expect(resultado(r)).toBe(`PREVIA ${NOMBRE} OK`);

      await db.exec("create or replace function public.zz_f() returns int language sql as $$\n  select   1\t --   uno\n$$;");
      r = await correr(db, previa());
      expect(estado(r)).toContain("public.zz_f:igual sin espacios");

      // Como en Cloud (handoffs 0506 y 0453): el cuerpo vivo perdió el comentario.
      await db.exec("create or replace function public.zz_f() returns int language sql as $$ select 1 $$;");
      r = await correr(db, previa());
      expect(estado(r)).toContain("public.zz_f:igual sin comentarios");
      expect(resultado(r)).toBe(`PREVIA ${NOMBRE} OK`);

      await db.exec("create or replace function public.zz_f() returns int language sql as $$ select 3 $$;");
      await expect(correr(db, previa())).rejects.toThrow(/deriva: .*public\.zz_f \[zz_f\(\): cuerpo desconocido\]/);
      r = await correr(db, previa(["public.zz_f"]));
      expect(resultado(r)).toBe(`PREVIA ${NOMBRE} OK`);

      await db.exec(M0900);
      await expect(correr(db, previa())).rejects.toThrow(/public\.zz_f \[zz_f\(\): cuerpo anterior del repo\]/);

      await db.exec("drop function public.zz_f();");
      await expect(correr(db, previa())).rejects.toThrow(/public\.zz_f \[-: falta en vivo\]/);
      // Aceptada la deriva, el preflight propio de la migración es el que frena.
      await expect(correr(db, previa(["public.zz_f"]))).rejects.toThrow(/0902 requiere public\.zz_f\(\)/);

      await db.exec(M0901);
      await db.exec("create function public.zz_g(p_x text) returns text language sql as $$ select 'fuera de banda' $$;");
      await expect(correr(db, previa())).rejects.toThrow(/public\.zz_g \[zz_g\(text\): existe sin definición previa en el repo\]/);
      await db.close();
    },
    SLOW,
  );

  it(
    "la lectura previa es de solo lectura y frena si la migración ya está en el ledger",
    async () => {
      const db = await baseNueva();
      await db.exec(M0901);
      await correr(db, previa());
      const n = (await db.query("select count(*)::int as n from supabase_migrations.schema_migrations")).rows[0].n;
      expect(n).toBe(0);
      expect(previa().split("\n").find((l) => l && !l.startsWith("\\") && !l.startsWith("--"))).toBe("begin transaction read only;");
      await db.exec(`insert into supabase_migrations.schema_migrations (version, name) values ('1', '${NOMBRE}')`);
      await expect(correr(db, previa())).rejects.toThrow(/ya está en el ledger/);
      await db.close();
    },
    SLOW,
  );

  it(
    "apply: migración y fila del ledger en una transacción; verificación PASÓ; cae si cambia un cuerpo vivo o el ledger",
    async () => {
      const db = await baseNueva();
      await db.exec(M0901);
      await correr(db, P.envolver(M0902, NOMBRE, "servidor-propio:psql:SDD-0546"));
      const fila = (await db.query("select version, name, created_by, md5(array_to_string(statements, '')) as m from supabase_migrations.schema_migrations")).rows;
      expect(fila).toHaveLength(1);
      expect(fila[0]).toMatchObject({ name: NOMBRE, created_by: "servidor-propio:psql:SDD-0546", m: P.md5(M0902) });
      expect(fila[0].version).toMatch(/^[0-9]{14}$/);

      const r = await correr(db, verificar());
      expect(resultado(r)).toBe(`VERIFICACIÓN ${NOMBRE} OK`);
      expect(filas(r).filter((x) => "igual_al_archivo" in x).every((x) => x.igual_al_archivo === true)).toBe(true);
      await expect(correr(db, previa())).rejects.toThrow(/ya está en el ledger/);

      await db.exec("create or replace function public.zz_g(p_x text default 'a') returns text language plpgsql as $function$ begin return 'otro'; end; $function$;");
      await expect(correr(db, verificar())).rejects.toThrow(/el cuerpo vivo no es el del archivo en: public\.zz_g/);
      await db.exec(`update supabase_migrations.schema_migrations set statements = array['otro texto'] where name = '${NOMBRE}'`);
      await expect(correr(db, verificar())).rejects.toThrow(/el ledger no coincide con el blob/);
      await db.close();
    },
    SLOW,
  );

  it(
    "un error a la mitad del apply no deja ni el objeto ni la fila",
    async () => {
      const db = await baseNueva();
      const mala = "create table public.zz_mitad (id int);\nselect 1 / 0;\n";
      await expect(correr(db, P.envolver(mala, "0904_zz_mala", "servidor-propio:psql:SDD-0546"))).rejects.toThrow(/division by zero/);
      expect((await db.query("select to_regclass('public.zz_mitad') is null as nada")).rows[0].nada).toBe(true);
      expect((await db.query("select count(*)::int as n from supabase_migrations.schema_migrations")).rows[0].n).toBe(0);
      await db.close();
    },
    SLOW,
  );
});

describe("SDD-0546 · preparar.mjs sobre el repo real", () => {
  const cabeza = spawnSync("git", ["-C", RAIZ, "rev-parse", "HEAD"], { encoding: "utf8" });
  const conGit = cabeza.status === 0;
  let salida;
  beforeAll(() => {
    salida = path.join(tmp(), "p0491");
  });
  afterAll(() => salida && rmSync(path.dirname(salida), { recursive: true, force: true }));

  it.skipIf(!conGit)(
    "0491: el md5 y los bytes del blob son los que guardó el ledger de producción (evidencia del 2026-10-16)",
    () => {
      const r = P.preparar(
        { sha: cabeza.stdout.trim(), migracion: "0491_freight_carriers_auditoria", sdd: "0539", salida, repo: RAIZ, proyecto: P.PROYECTO_PRODUCCION, aceptaDeriva: [], sinPreflightPropio: false },
        () => {},
      );
      // Ledger 20261016081616: md5 22c72cb6… y 12175 bytes (commit 2bb0c817, apply-0491 del Director).
      expect(r.blobMd5).toBe("22c72cb6ae0ee8fa85040c8bbc469bd8");
      expect(r.blobBytes).toBe(12175);
      expect(r.createdBy).toBe("servidor-propio:psql:SDD-0539");
      expect(r.funcionesReemplazadas).toEqual(["public.audit_freight_carrier_change (nueva)"]);
      expect(r.preflightPropio).toBe("incluido");
      const sumas = readFileSync(path.join(salida, "SHA256SUMS"), "utf8").trim().split("\n");
      for (const l of sumas) {
        const [h, n] = l.split("  ");
        expect(P.sha256(readFileSync(path.join(salida, n))), n).toBe(h);
      }
    },
    SLOW,
  );
});

describe("SDD-0546 · retirar-espera.mjs", () => {
  // SDD-0561: retirar la espera sella la migración en el candado, así que el
  // fixture trae los .sql y un candado (vacío) además del baseline.
  const SQL = { "0901_zz_a": "select 'a';\n", "0902_zz_b": "select 'b';\r\n" };
  const CANDADO_VACIO = { schemaVersion: 1, selladas: {} };
  const armar = (baseline, declaraciones, { candado = CANDADO_VACIO } = {}) => {
    const d = tmp();
    mkdirSync(path.join(d, "supabase", "migrations"), { recursive: true });
    writeFileSync(path.join(d, "supabase", "migrations-baseline.json"), typeof baseline === "string" ? baseline : JSON.stringify(baseline, null, 2) + "\n");
    if (declaraciones) writeFileSync(path.join(d, "supabase", "pending-migration-symbol-declarations.json"), JSON.stringify(declaraciones, null, 2) + "\n");
    for (const [n, t] of Object.entries(SQL)) writeFileSync(path.join(d, "supabase", "migrations", `${n}.sql`), t);
    if (candado) writeFileSync(path.join(d, "supabase", "migrations.lock.json"), JSON.stringify(candado, null, 2) + "\n");
    return d;
  };
  const leer = (d, f) => JSON.parse(readFileSync(path.join(d, "supabase", f), "utf8"));
  const texto = (d, f) => readFileSync(path.join(d, "supabase", f), "utf8");
  const md5De = (n) => P.md5(SQL[n]);
  const BASE = { $doc: ["x"], cutoff: 238, pendingBelowCutoff: { "0901_zz_a": "espera a", "0902_zz_b": "espera b" } };
  const DECL = { schemaVersion: 1, degradations: [{ migration: "0902_zz_b", symbol: "s" }, { migration: "0901_zz_a", symbol: "t" }] };

  it("quita la espera y sus declaraciones, y conserva el resto y el formato", () => {
    const d = armar(BASE, DECL);
    const r = retirarEspera({ raiz: d, nombre: "0902_zz_b", md5: md5De("0902_zz_b") });
    expect(r).toMatchObject({ esperaRetirada: true, declaracionesQuitadas: 1, esperasQuedan: ["0901_zz_a"] });
    expect(leer(d, "migrations-baseline.json")).toEqual({ ...BASE, pendingBelowCutoff: { "0901_zz_a": "espera a" } });
    expect(leer(d, "pending-migration-symbol-declarations.json").degradations).toEqual([{ migration: "0901_zz_a", symbol: "t" }]);
    expect(readFileSync(path.join(d, "supabase", "migrations-baseline.json"), "utf8")).toBe(JSON.stringify(leer(d, "migrations-baseline.json"), null, 2) + "\n");
    rmSync(d, { recursive: true, force: true });
  });

  it("SDD-0561: sella la migración con la identidad del archivo y el candado queda verde", () => {
    const d = armar(BASE, DECL);
    const r = retirarEspera({ raiz: d, nombre: "0902_zz_b", md5: md5De("0902_zz_b") });
    const id = { sha256: P.sha256(SQL["0902_zz_b"]), md5: md5De("0902_zz_b"), bytes: Buffer.byteLength(SQL["0902_zz_b"]) };
    expect(r.sellada).toEqual(id);
    expect(leer(d, "migrations.lock.json").selladas).toEqual({ "0902_zz_b": id });
    expect(texto(d, "migrations.lock.json")).toBe(JSON.stringify(leer(d, "migrations.lock.json"), null, 2) + "\n");
    const v = verificarRepo({ raiz: d, base: null });
    expect(v.errores).toEqual([]);
    expect(v.avisos.map((a) => `${a.tipo} ${a.nombre}`)).toEqual(["ESPERA 0901_zz_a"]);
    rmSync(d, { recursive: true, force: true });
  });

  it("SDD-0561: con un md5 que no es el del archivo sale 3 y no escribe nada", () => {
    const d = armar(BASE, DECL);
    const antes = ["migrations-baseline.json", "pending-migration-symbol-declarations.json", "migrations.lock.json"].map((f) => texto(d, f));
    expect(() => retirarEspera({ raiz: d, nombre: "0902_zz_b", md5: md5De("0901_zz_a") })).toThrow(expect.objectContaining({ codigo: 3 }));
    expect(["migrations-baseline.json", "pending-migration-symbol-declarations.json", "migrations.lock.json"].map((f) => texto(d, f))).toEqual(antes);
    rmSync(d, { recursive: true, force: true });
  });

  it("SDD-0561: sin --md5, sin candado o sin el archivo sale 2 sin tocar el baseline", () => {
    const d = armar(BASE, DECL);
    const antes = texto(d, "migrations-baseline.json");
    expect(() => retirarEspera({ raiz: d, nombre: "0902_zz_b" })).toThrow(expect.objectContaining({ codigo: 2 }));
    rmSync(path.join(d, "supabase", "migrations", "0902_zz_b.sql"));
    expect(() => retirarEspera({ raiz: d, nombre: "0902_zz_b", md5: md5De("0902_zz_b") })).toThrow(expect.objectContaining({ codigo: 2 }));
    expect(texto(d, "migrations-baseline.json")).toBe(antes);
    rmSync(d, { recursive: true, force: true });
    const e = armar(BASE, DECL, { candado: null });
    expect(() => retirarEspera({ raiz: e, nombre: "0902_zz_b", md5: md5De("0902_zz_b") })).toThrow(expect.objectContaining({ codigo: 2 }));
    expect(texto(e, "migrations-baseline.json")).toBe(JSON.stringify(BASE, null, 2) + "\n");
    rmSync(e, { recursive: true, force: true });
  });

  it("si no estaba en pendingBelowCutoff sale 3 sin tocar nada; en seco no escribe", () => {
    const d = armar(BASE, DECL);
    const antes = readFileSync(path.join(d, "supabase", "migrations-baseline.json"), "utf8");
    const candadoAntes = texto(d, "migrations.lock.json");
    expect(() => retirarEspera({ raiz: d, nombre: "0999_zz_no", md5: md5De("0901_zz_a") })).toThrow(expect.objectContaining({ codigo: 3 }));
    const r = retirarEspera({ raiz: d, nombre: "0901_zz_a", md5: md5De("0901_zz_a"), enSeco: true });
    expect(r.esperasQuedan).toEqual(["0902_zz_b"]);
    expect(r.sellada.md5).toBe(md5De("0901_zz_a"));
    expect(readFileSync(path.join(d, "supabase", "migrations-baseline.json"), "utf8")).toBe(antes);
    expect(texto(d, "migrations.lock.json")).toBe(candadoAntes);
    rmSync(d, { recursive: true, force: true });
  });

  it("no reescribe un baseline con otro formato (un diff de todo el archivo esconde el cambio)", () => {
    const d = armar('{"cutoff":238,"pendingBelowCutoff":{"0901_zz_a":"x"}}\n');
    expect(() => retirarEspera({ raiz: d, nombre: "0901_zz_a", md5: md5De("0901_zz_a") })).toThrow(expect.objectContaining({ codigo: 2 }));
    rmSync(d, { recursive: true, force: true });
  });

  it("lista las pruebas que nombran la migración y pendingBelowCutoff (pueden afirmar la espera)", () => {
    const d = armar(BASE, DECL);
    mkdirSync(path.join(d, "lib"));
    writeFileSync(path.join(d, "lib", "afirma.test.ts"), 'expect(BASELINE.pendingBelowCutoff["0902_zz_b"]).toBeDefined();\n');
    writeFileSync(path.join(d, "lib", "solo-nombra.ts"), "// 0902_zz_b\n");
    const g = (args) => spawnSync("git", ["-C", d, ...args], { encoding: "utf8" });
    g(["init", "-q"]);
    g(["add", "-A"]);
    expect(retirarEspera({ raiz: d, nombre: "0902_zz_b", md5: md5De("0902_zz_b"), enSeco: true }).revisarAMano).toEqual(["lib/afirma.test.ts"]);
    rmSync(d, { recursive: true, force: true });
  });
});

describe("SDD-0546 · scripts bash con dobles", () => {
  const SCRIPTS = ["infra/ops/migraciones/aplicar.sh", "infra/ops/migraciones/aplicar-remoto.sh", "infra/ops/tests/prueba-migraciones-produccion.sh"];

  it("pasan bash -n", () => {
    for (const s of SCRIPTS) {
      const r = spawnSync(BASH, ["-n", s], { cwd: RAIZ, encoding: "utf8" });
      expect(r.status, `${s}: ${r.stderr}`).toBe(0);
    }
  }, BAJO_CARGA);

  it(
    "prueba-migraciones-produccion.sh sale con 0 FALLÓ",
    async () => {
      const r = await new Promise((done) => {
        const hijo = spawn(BASH, ["infra/ops/tests/prueba-migraciones-produccion.sh"], { cwd: RAIZ, env: { ...process.env, LC_ALL: "C.UTF-8" } });
        let salida = "";
        hijo.stdout.on("data", (d) => (salida += d));
        hijo.stderr.on("data", (d) => (salida += d));
        hijo.on("close", (codigo) => done({ codigo, salida }));
      });
      const fallas = r.salida.split("\n").filter((l) => l.startsWith("FALLÓ"));
      expect(fallas, r.salida.slice(-3000)).toEqual([]);
      expect(r.salida).toMatch(/RESULTADO: \d+ PASÓ · 0 FALLÓ/);
      expect(r.codigo).toBe(0);
    },
    600_000,
  );
});
