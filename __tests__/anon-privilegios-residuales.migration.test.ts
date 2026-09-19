// @vitest-environment node
/**
 * SDD-0485 · La migración 0465 corrida de verdad sobre PostgreSQL embebido.
 *
 * POR QUÉ ESTE TEST: el contrato `supabase/tests/0465_…test.sql` sólo corre en
 * `verify` con Docker, y el CI de calidad no lo ejecuta. PGlite corre ese MISMO
 * contrato con el `.sql` real inlineado, y además:
 *
 *   · CONTROL ROJO: sin la 0465 el contrato tiene que fallar.
 *   · Cada rama del preflight aborta sin cambiar nada.
 *   · Sin transacción externa (autocommit) un fallo del postflight tampoco deja
 *     nada a medias: todo vive en un solo bloque DO.
 *   · Condición de L14 (Director, 2026-09-18): con la 0465 aplicada, los
 *     contratos de 0422 y 0423 siguen pasando, preflights incluidos. Su control
 *     rojo quita el SELECT de authenticated en user_tenants y 0422 aborta.
 *
 * Los contratos usan `\if`, `\set` e `\ir` de psql; `psql()` los resuelve antes
 * de pasar el texto a PGlite. PGlite corre como superusuario: que la migración
 * funcione con `postgres` sin superusuario se midió aparte, en la imagen
 * supabase/postgres (ver SDD-0485).
 */
import { readFileSync } from "node:fs";
import { dirname, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TESTS = resolve(ROOT, "supabase/tests");
const MIGRATIONS = resolve(ROOT, "supabase/migrations");
const CONTRACT_0465 = resolve(TESTS, "0465_anon_privilegios_residuales.test.sql");
const FILE_0465 = resolve(MIGRATIONS, "0465_anon_privilegios_residuales.sql");
const FILE_0371 = resolve(MIGRATIONS, "0371_insignia_pelada_del_aliado.sql");
const MIGRATION_0465 = readFileSync(FILE_0465, "utf8");

type Include = (file: string) => string | null;

/**
 * El subconjunto de psql que usan los contratos: `\set`, `\if`/`\else`/`\endif`
 * con `:{?var}` o `:var`, e `\ir`. `onInclude` puede reemplazar un `\ir`.
 * Cualquier otro metacomando, o una variable interpolada en SQL, es un error:
 * mejor fallar que correr un texto distinto del que correría psql.
 */
function psql(file: string, onInclude: Include = () => null): string {
  const vars = new Map<string, string>();
  const truthy = (value: string) => /^(on|true|1|yes)$/i.test(value);
  const value = (raw: string) => {
    const ref = raw.match(/^:(\w+)$/);
    if (!ref) return raw;
    if (!vars.has(ref[1])) throw new Error(`variable psql sin definir: ${ref[1]}`);
    return vars.get(ref[1])!;
  };

  const render = (path: string): string => {
    const out: string[] = [];
    const stack: { active: boolean; taken: boolean }[] = [];
    const active = () => stack.every((frame) => frame.active);
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const meta = line.match(/^\s*\\(\w+)\s*(.*?)\s*$/);
      if (!meta) {
        if (!active()) continue;
        for (const name of vars.keys()) {
          if (new RegExp(`(?<![:\\w]):(?:'${name}'|"${name}"|${name}\\b)`).test(line)) {
            throw new Error(`interpolación psql no soportada en ${path}: ${line.trim()}`);
          }
        }
        out.push(line);
        continue;
      }
      const [, command, rest] = meta;
      if (command === "if") {
        // Como psql: dentro de una rama inactiva la condición no se evalúa.
        const parent = active();
        const defined = rest.match(/^:\{\?(\w+)\}$/);
        const condition = parent && (defined ? vars.has(defined[1]) : truthy(value(rest)));
        stack.push({ active: condition, taken: condition });
        continue;
      }
      if (command === "else") {
        const frame = stack.at(-1);
        if (!frame) throw new Error(`\\else sin \\if en ${path}`);
        const parent = stack.slice(0, -1).every((f) => f.active);
        frame.active = parent && !frame.taken;
        frame.taken = true;
        continue;
      }
      if (command === "endif") {
        if (!stack.pop()) throw new Error(`\\endif sin \\if en ${path}`);
        continue;
      }
      if (!active()) continue;
      if (command === "set") {
        const [name, ...raw] = rest.split(/\s+/);
        if (name !== "ON_ERROR_STOP") vars.set(name, value(raw.join(" ")));
        continue;
      }
      if (command === "ir") {
        const target = resolve(dirname(path), rest);
        out.push(onInclude(target) ?? render(target));
        continue;
      }
      throw new Error(`metacomando psql no soportado en ${path}: \\${command}`);
    }
    if (stack.length) throw new Error(`\\if sin cerrar en ${path}`);
    return out.join("\n");
  };

  return render(file);
}

/**
 * Los contratos de 0422 y 0423 leen migraciones con `pg_read_file('/sb/…')`,
 * la ruta del volumen de Docker. Se copian al sistema de archivos de PGlite.
 */
function montarSb(db: PGlite, sql: string): void {
  const fs = db.Module.FS;
  for (const [, rel] of sql.matchAll(/pg_read_file\('\/sb\/([^']+)'\)/g)) {
    const target = `/sb/${rel}`;
    let dir = "";
    for (const part of posix.dirname(target).split("/").filter(Boolean)) {
      dir += `/${part}`;
      if (!fs.analyzePath(dir).exists) fs.mkdir(dir);
    }
    fs.writeFile(target, readFileSync(resolve(ROOT, "supabase", rel), "utf8"));
  }
}

async function run(...parts: string[]): Promise<string | null> {
  // pgcrypto: el fixture de 0421 la crea en el schema extensions.
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.waitReady;
    montarSb(db, parts.join("\n"));
    for (const sql of parts) await db.exec(sql);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    await db.close();
  }
}

/** El fixture del contrato 0465: todo lo anterior a su primer `\ir`. */
const FIXTURE = (() => {
  const text = readFileSync(CONTRACT_0465, "utf8");
  return text.slice(0, text.indexOf("\\ir ")).replace(/^\\set\s.*$/m, "");
})();

/** El mismo fixture sin `begin`: cada sentencia se confirma sola. */
const FIXTURE_AUTOCOMMIT = FIXTURE.replace(/^begin;$/m, "");

/** Las relaciones donde anon conserva MAINTAIN, REFERENCES o TRIGGER. */
const RESIDUO_ANON = `
  select coalesce(string_agg(c.relname::text, ',' order by c.relname::text), '') as rels
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v')
    and has_table_privilege('anon', c.oid, 'MAINTAIN, REFERENCES, TRIGGER')`;

describe("0465 · el contrato sobre PGlite", () => {
  it("fija lock_timeout y statement_timeout antes del bloque, como pide el runbook", () => {
    const bloque = MIGRATION_0465.indexOf("do $migracion_0465$");
    const cabecera = MIGRATION_0465.slice(0, bloque);
    expect(cabecera).toMatch(/^set lock_timeout = '5s';$/m);
    expect(cabecera).toMatch(/^set statement_timeout = '30s';$/m);
  });

  it("el contrato completo pasa con la migración real", async () => {
    expect(await run(psql(CONTRACT_0465))).toBeNull();
  }, 60_000);

  it("control rojo: sin la 0465 el mismo contrato falla en el contrato 1", async () => {
    const sinMigracion = psql(CONTRACT_0465, (file) => (file === FILE_0465 ? "" : null));
    expect(await run(sinMigracion)).toMatch(/CONTRATO 1 ROTO: quedan MAINTAIN\/REFERENCES\/TRIGGER/);
  }, 60_000);
});

describe("0465 · el preflight aborta sin tocar nada", () => {
  const casos: [string, string, RegExp][] = [
    [
      "una relación de public con otro dueño",
      "create role supabase_admin; alter table public.invoices owner to supabase_admin;",
      /relaciones de public con dueño distinto de postgres: invoices \(supabase_admin\)/,
    ],
    [
      "anon con un privilegio que no está en el inventario",
      "grant insert on public.mail_logs to anon;",
      /fuera del inventario de SDD-0485: mail_logs anon INSERT/,
    ],
    [
      "un grant a PUBLIC, que anon hereda",
      "grant select on public.invoices to public;",
      /fuera del inventario de SDD-0485: invoices PUBLIC SELECT/,
    ],
    [
      "anon con un privilegio por columna",
      "grant select (destinatario) on public.mail_logs to anon;",
      /por columna de anon\/PUBLIC fuera del inventario de SDD-0485: mail_logs\.destinatario anon SELECT/,
    ],
    [
      "una tabla pública sin RLS",
      "alter table public.news_posts disable row level security;",
      /sin SELECT de anon o sin RLS en: news_posts/,
    ],
    [
      "una tabla pública que ya perdió el SELECT de anon",
      "revoke select on public.back_glosario from anon;",
      /sin SELECT de anon o sin RLS en: back_glosario/,
    ],
    [
      "el default de postgres en public vuelve a incluir a anon",
      "alter default privileges for role postgres in schema public grant select on tables to anon;",
      /el default de postgres volvió a dar privilegios de tabla a public\/r: anon/,
    ],
    [
      "un default global de postgres para authenticated",
      "alter default privileges for role postgres grant references on tables to authenticated;",
      /el default de postgres volvió a dar privilegios de tabla a <global>\/r: authenticated/,
    ],
    [
      "un grant option de authenticated",
      "grant references on public.privada to authenticated with grant option;",
      /grant option inesperado para anon\/authenticated: privada authenticated REFERENCES/,
    ],
    [
      "un rol que no actúa como postgres",
      "create role intruso; grant usage on schema public to intruso; set role intruso;",
      /0465 debe correr como postgres/,
    ],
    [
      "falta el rol service_role",
      "drop owned by service_role; drop role service_role;",
      /0465 requiere los roles anon, authenticated, service_role y postgres/,
    ],
  ];

  for (const [nombre, giro, mensaje] of casos) {
    it(nombre, async () => {
      expect(await run(FIXTURE, giro, MIGRATION_0465)).toMatch(mensaje);
    }, 60_000);
  }

  it("sin transacción externa, un preflight que aborta deja el residuo como estaba", async () => {
    const db = new PGlite();
    try {
      await db.exec(FIXTURE_AUTOCOMMIT);
      const antes = (await db.query<{ rels: string }>(RESIDUO_ANON)).rows[0].rels;
      await db.exec("grant insert on public.mail_logs to anon;");
      await expect(db.exec(MIGRATION_0465)).rejects.toThrow(/fuera del inventario/);
      expect((await db.query<{ rels: string }>(RESIDUO_ANON)).rows[0].rels).toBe(antes);
      expect(antes).toContain("invoices");
    } finally {
      await db.close();
    }
  }, 60_000);
});

describe("0465 · el postflight atrapa un revoke que se pasa o se queda corto", () => {
  const REVOKE = /revoke maintain, references, trigger on all tables in schema public\s+from anon, authenticated;/;

  it("la migración real tiene exactamente el revoke que estos mutantes reemplazan", () => {
    expect(MIGRATION_0465).toMatch(REVOKE);
  });

  it("si también quita SELECT, aborta y en autocommit no queda nada a medias", async () => {
    const mutante = MIGRATION_0465.replace(
      REVOKE,
      "revoke select, maintain, references, trigger on all tables in schema public from anon, authenticated;",
    );
    const db = new PGlite();
    try {
      await db.exec(FIXTURE_AUTOCOMMIT);
      const antes = (await db.query<{ rels: string }>(RESIDUO_ANON)).rows[0].rels;
      await expect(db.exec(mutante)).rejects.toThrow(
        /se quitó algo más que MAINTAIN, REFERENCES y TRIGGER/,
      );
      // El revoke corrió y el postflight lo deshizo: el residuo sigue entero y
      // anon conserva su lectura pública.
      expect((await db.query<{ rels: string }>(RESIDUO_ANON)).rows[0].rels).toBe(antes);
      const lee = await db.query<{ ok: boolean }>(
        "select has_table_privilege('anon', 'public.news_posts', 'SELECT') as ok",
      );
      expect(lee.rows[0].ok).toBe(true);
    } finally {
      await db.close();
    }
  }, 60_000);

  it("si se olvida de authenticated, aborta", async () => {
    const mutante = MIGRATION_0465.replace(
      REVOKE,
      "revoke maintain, references, trigger on all tables in schema public from anon;",
    );
    expect(await run(FIXTURE, mutante)).toMatch(/todavía quedan MAINTAIN, REFERENCES o TRIGGER en .*authenticated/);
  }, 60_000);

  it("si se olvida de TRIGGER, aborta", async () => {
    const mutante = MIGRATION_0465.replace(
      REVOKE,
      "revoke maintain, references on all tables in schema public from anon, authenticated;",
    );
    expect(await run(FIXTURE, mutante)).toMatch(/todavía quedan MAINTAIN, REFERENCES o TRIGGER/);
  }, 60_000);

  it("si además concede algo, aborta", async () => {
    const mutante = MIGRATION_0465.replace(
      REVOKE,
      (revoke) => `${revoke}\n  grant select on public.privada to authenticated;`,
    );
    expect(await run(FIXTURE, mutante)).toMatch(/aparecieron privilegios que no estaban/);
  }, 60_000);

  it("si además toca un privilegio por columna, aborta", async () => {
    const mutante = MIGRATION_0465.replace(
      REVOKE,
      (revoke) => `${revoke}\n  revoke update (telefono) on public.perfil_columnas from authenticated;`,
    );
    expect(await run(FIXTURE, mutante)).toMatch(/cambiaron privilegios por columna que no eran objetivo/);
  }, 60_000);
});

describe("0465 · el postflight mide privilegios efectivos, no sólo los directos", () => {
  it("anon no puede leer otra tabla heredándola de un rol", async () => {
    const giro =
      "create role lector; grant select on public.invoices to lector; grant lector to anon;";
    expect(await run(FIXTURE, giro, MIGRATION_0465)).toMatch(
      /anon tiene que leer exactamente .* y lee .*invoices/,
    );
  }, 60_000);

  it("anon no puede borrar heredándolo de un rol", async () => {
    const giro =
      "create role escritor; grant delete on public.mail_logs to escritor; grant escritor to anon;";
    expect(await run(FIXTURE, giro, MIGRATION_0465)).toMatch(/anon puede escribir en mail_logs/);
  }, 60_000);
});

/**
 * Condición de L14. En producción ya están 0421, 0367 y 0371; la 0465 entra
 * antes que 0422. Aquí se agrega lo que la 0465 necesita encontrar: las 5
 * tablas que anon lee y el residuo de Supabase sobre todas las tablas de
 * public, como lo leyó el Director el 2026-09-18.
 */
const PRODUCCION_0465 = `
  create table public.back_glosario (id int primary key, is_published boolean);
  create table public.back_noticias (id int primary key, is_published boolean);
  create table public.back_servicios (id int primary key, is_published boolean);
  create table public.news_posts (id int primary key, published boolean);
  create table public.ve_locality_catalog (id int primary key, city text, state_name text);
  alter table public.back_glosario enable row level security;
  alter table public.back_noticias enable row level security;
  alter table public.back_servicios enable row level security;
  alter table public.news_posts enable row level security;
  alter table public.ve_locality_catalog enable row level security;
  grant select on public.back_glosario, public.back_noticias, public.back_servicios,
    public.news_posts, public.ve_locality_catalog to anon;
  grant maintain, references, trigger on all tables in schema public to anon, authenticated;
`;

/**
 * Justo después de 0371, que es el punto de cada contrato donde termina lo que
 * producción ya tiene. En el de 0422 lo que sigue es su fixture adversarial
 * (grants por columna que 0422 debe limpiar), que nunca existió en producción.
 */
function despuesDe0371(extra: string): Include {
  return (file) =>
    file === FILE_0371
      ? [readFileSync(FILE_0371, "utf8"), PRODUCCION_0465, extra].join("\n")
      : null;
}

describe("L14 · con la 0465 aplicada, 0422 y 0423 siguen pasando", () => {
  const CONTRACT_0422 = resolve(TESTS, "0422_payment_report_command_boundary.test.sql");
  const CONTRACT_0423 = resolve(TESTS, "0423_payment_report_historical_identity.test.sql");

  it("el contrato de 0422, preflight incluido, pasa después de la 0465", async () => {
    expect(await run(psql(CONTRACT_0422, despuesDe0371(MIGRATION_0465)))).toBeNull();
  }, 120_000);

  it("el contrato de 0423 (que aplica 0422 y luego 0423) pasa después de la 0465", async () => {
    expect(await run(psql(CONTRACT_0423, despuesDe0371(MIGRATION_0465)))).toBeNull();
  }, 120_000);

  it("control rojo: si authenticated perdiera SELECT en user_tenants, el preflight de 0422 abortaría", async () => {
    const rompe = "revoke select on public.user_tenants from authenticated;";
    expect(await run(psql(CONTRACT_0423, despuesDe0371(rompe)))).toMatch(
      /0422 requiere SELECT de membresías propio\/activo/,
    );
  }, 120_000);
});
