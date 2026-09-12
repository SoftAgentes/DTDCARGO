/**
 * Regresión SDD-0450 (corrección 2026-09-11, bloques DO): el gate
 * pending-migration-symbols enmascaraba todo cuerpo dollar-quoted, también el de
 * `DO $…$`, que sí se ejecuta al aplicar la migración. Una función creada con
 * `EXECUTE format($ddl$ create or replace function … $ddl$, …)` dentro de un
 * bloque DO (forma de 0426) no nacía en la pendiente: el código que la llama
 * quedaba en 0 ROJO y declararla daba exit 2.
 *
 * Los casos de extracción fallan con el enmascarado anterior. Las guardas fijan
 * lo que no debe cambiar: cuerpos de función, literales no ejecutados, nombres
 * calculados y funciones de usuario `esquema.execute(…)` no crean símbolos.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRepositoryData, extractCreatedSymbols, findPendingOnlySymbols } from "../check-pending-migration-symbols.mjs";

const EMPTY_DECLARATIONS = { schemaVersion: 1, degradations: [] };
const RPC = "reserve_fixture_verify_attempt";
const MIGRATION = "0426_fixture_verify_atomic_reservation";

// Forma de 0426, con astrales en comentarios del cuerpo DO y del cuerpo de función.
const DO_BLOCK_MIGRATION = [
  "-- La función nace con DDL dinámico dentro de un bloque DO.",
  "do $migration$",
  "declare",
  "  v_body text := $body$",
  "begin",
  "  -- 🔒 Cuenta y registra bajo el mismo lock transaccional.",
  "  insert into public.fixture_throttle (ip, created_at) values (p_ip, pg_catalog.clock_timestamp());",
  "  return true;",
  "end;",
  "$body$;",
  "begin",
  "  if pg_catalog.to_regclass('public.fixture_throttle') is null then",
  "    raise exception 'fixture: missing table';",
  "  end if;",
  "  -- 📦 Solo reemplaza su propia definición.",
  "  execute pg_catalog.format($ddl$",
  `    create or replace function public.${RPC}(p_ip text)`,
  "    returns boolean language plpgsql volatile security invoker",
  "    set search_path = '' set lock_timeout = '2s'",
  "    as %L",
  "  $ddl$, v_body);",
  `  revoke all on function public.${RPC}(text) from public, anon, authenticated;`,
  `  grant execute on function public.${RPC}(text) to service_role;`,
  `  comment on function public.${RPC}(text) is 'fixture: reserva por IP';`,
  "end;",
  "$migration$;",
  "notify pgrst, 'reload schema';",
].join("\n");

const THROTTLE_FILE = "lib/public/fixture-throttle.ts";
const CALL_LINE = 5;
const EVIDENCE_LINE = 10;
const THROTTLE = [
  "/**",
  " * Throttle de fixture: sin la RPC la verificación queda bloqueada.",
  " */",
  "export const VERIFY_IP_LIMIT = 40;",
  `const RESERVE_RPC = "${RPC}";`,
  "",
  "export async function isVerifyThrottled(db, ip) {",
  "  try {",
  "    const result = await db.rpc(RESERVE_RPC, { p_ip: ip });",
  '    if (result?.error !== null || typeof result?.data !== "boolean") return true;',
  "    return !result.data;",
  "  } catch {",
  "    return true;",
  "  }",
  "}",
].join("\n");
const PAGE_FILE = "app/verificar/page.tsx";
const PAGE = [
  'import { isVerifyThrottled } from "@/lib/public/fixture-throttle";',
  "",
  "export default async function Page() {",
  '  const blocked = await isVerifyThrottled(db, "203.0.113.7");',
  "  return blocked ? <p>Demasiadas verificaciones</p> : <p>OK</p>;",
  "}",
].join("\n");
const SOURCE_FILES = { [PAGE_FILE]: PAGE, [THROTTLE_FILE]: THROTTLE };

function keys(sql, migration = MIGRATION) {
  return extractCreatedSymbols(sql, migration).map((symbol) => symbol.key);
}

function reachableSites(analysis) {
  return analysis.reachableReferences.map((reference) => reference.site);
}

function analyze(declarations = EMPTY_DECLARATIONS) {
  return analyzeRepositoryData({
    migrations: [{ name: MIGRATION, sql: DO_BLOCK_MIGRATION }],
    pendingMigrationNames: [MIGRATION],
    sourceFiles: SOURCE_FILES,
    declarations,
  });
}

test("una RPC creada con EXECUTE format() en un bloque DO pendiente y llamada desde TS alcanzable da ROJO", () => {
  assert.ok(THROTTLE.split("\n")[CALL_LINE - 1].includes(`"${RPC}"`), "fixture: el nombre vive en CALL_LINE");

  // Solo la función: revoke, grant, comment y to_regclass no crean símbolos.
  assert.deepEqual(keys(DO_BLOCK_MIGRATION), [`function:public.${RPC}`]);

  const result = analyze();
  assert.deepEqual(result.declarationErrors, []);
  assert.deepEqual(result.red.map((analysis) => analysis.symbol.displayName), [RPC]);
  assert.deepEqual(result.red.map(reachableSites), [[`${THROTTLE_FILE}:${CALL_LINE}`]]);
});

test("declarar ese degradado ya es verificable: la declaración anclada a la llamada real pasa como AMARILLO", () => {
  const declarations = {
    schemaVersion: 1,
    degradations: [{
      id: "fixture-verify-pending-rpc",
      primarySymbol: RPC,
      migration: MIGRATION,
      symbols: [{ kind: "function", name: RPC, callSites: [`${THROTTLE_FILE}:${CALL_LINE}`] }],
      evidence: [{
        site: `${THROTTLE_FILE}:${EVIDENCE_LINE}`,
        contains: 'typeof result?.data !== "boolean") return true;',
        degradation: "sin la RPC la verificación falla cerrada",
      }],
    }],
  };

  const result = analyze(declarations);
  assert.deepEqual(result.declarationErrors, []);
  assert.deepEqual(result.red, []);
  assert.deepEqual(result.yellow.map((group) => group.primarySymbol), [RPC]);
  assert.deepEqual(result.yellow[0].analyses.map(reachableSites), [[`${THROTTLE_FILE}:${CALL_LINE}`]]);
});

test("el DDL estático de un bloque DO y los literales de EXECUTE crean símbolos", () => {
  const sql = [
    "do $$",
    "begin",
    "  if pg_catalog.to_regclass('public.fixture_boxes') is null then",
    "    create table public.fixture_boxes (id uuid primary key);",
    "  end if;",
    "  alter table public.fixture_boxes add column if not exists label text;",
    "  create or replace function public.fixture_box_count() returns bigint",
    "    language sql as $f$ select count(*) from public.fixture_boxes $f$;",
    "end $$;",
    "do language plpgsql $$",
    "begin",
    // Literal simple con comillas escapadas: la vista termina en `<> ''`.
    "  execute 'create or replace view public.fixture_open_boxes as select id from public.fixture_boxes where label <> ''''';",
    "  execute format('create table if not exists public.fixture_box_events (box_id uuid, kind text)');",
    "end $$;",
  ].join("\n");

  assert.deepEqual(keys(sql), [
    "column:public.fixture_boxes.label",
    "function:public.fixture_box_count",
    "table:public.fixture_box_events",
    "table:public.fixture_boxes",
    "view:public.fixture_open_boxes",
  ]);
});

test("una función creada en un bloque DO aplicado es redefinición, no ausencia", () => {
  const migrations = [
    { name: "0300_fixture_applied_do", sql: DO_BLOCK_MIGRATION },
    {
      name: "0450_fixture_pending_redefinition",
      sql: `create or replace function public.${RPC}(p_ip text) returns boolean language sql as 'select true';`,
    },
  ];

  assert.deepEqual(findPendingOnlySymbols(migrations, ["0450_fixture_pending_redefinition"]), []);
});

test("anidado DO → EXECUTE → DO, execute (…), mayúsculas y un DO entre comillas simples crean símbolos", () => {
  const sql = [
    "do $outer$",
    "begin",
    "  execute $sql$",
    "    do $inner$",
    "    begin",
    "      execute 'create table public.fixture_nested (id uuid)';",
    "    end",
    "    $inner$",
    "  $sql$;",
    "  execute ('create table public.fixture_paren (id uuid)');",
    "end",
    "$outer$;",
    "DO LANGUAGE PLPGSQL $$ BEGIN EXECUTE PG_CATALOG.FORMAT('CREATE TABLE PUBLIC.FIXTURE_UPPER (ID UUID)'); END $$;",
    // Cuerpo DO como literal simple: dentro, las comillas del EXECUTE van dobladas.
    "do 'begin execute ''create table public.fixture_quoted_do (id uuid)''; end';",
  ].join("\n");

  assert.deepEqual(keys(sql), [
    "table:public.fixture_nested",
    "table:public.fixture_paren",
    "table:public.fixture_quoted_do",
    "table:public.fixture_upper",
  ]);
});

test("cuerpos de función, literales no ejecutados y comentarios no crean símbolos", () => {
  const sql = [
    "create or replace function public.fixture_rotate() returns void language plpgsql as $$",
    "begin",
    "  -- Solo corre al invocar la función, no al aplicar la migración.",
    "  execute 'create table public.runtime_only(id uuid)';",
    "end $$;",
    "do $$",
    "declare",
    "  v_note text := 'create table public.assigned_only(id uuid)';",
    "begin",
    "  raise notice 'create function public.noticed_only(): %', v_note;",
    "  perform pg_catalog.format('create view public.formatted_only as select 1');",
    "  -- execute 'create table public.commented_only(id uuid)';",
    "end $$;",
    "comment on function public.fixture_rotate() is 'create table public.described_only(id uuid)';",
    "insert into public.fixture_rules (sql) values ('create table public.data_only(id uuid)') on conflict do nothing;",
  ].join("\n");

  assert.deepEqual(keys(sql), ["function:public.fixture_rotate"]);
});

test("un nombre calculado en la plantilla EXECUTE no produce símbolos falsos", () => {
  const sql = [
    "do $$",
    "declare",
    "  v_schema text := 'public';",
    "begin",
    "  execute format('create table %I.%I (id uuid)', v_schema, 'dynamic_only');",
    "  execute format('create table public.%I (id uuid)', 'dynamic_only');",
    "  execute format('create table if not exists %I (id uuid)', 'dynamic_only');",
    "  execute format('create table public.fixture_%s (id uuid)', 'dynamic_only');",
    "  execute format('alter table if exists only %I add column if not exists %I text', 'fixture_boxes', 'note');",
    "  execute format('alter table public.fixture_boxes add column if not exists %I text', 'note');",
    "  execute 'create table public.fixture_part_' || pg_catalog.to_char(pg_catalog.now(), 'YYYYMM') || ' (id uuid)';",
    "end $$;",
  ].join("\n");

  // Sin la guarda de nombre completo aparecerían table:public.public,
  // table:public.if, table:public.fixture_, table:public.fixture_part_ o
  // column:public.if.note: todos coincidirían con tokens de código alcanzable.
  assert.deepEqual(keys(sql), []);
});

test("una función de usuario esquema.execute(…) no es la sentencia EXECUTE", () => {
  const sql = [
    "do $$",
    "begin",
    "  perform public.execute('create table public.not_executed (id uuid)');",
    "  perform ops.execute(pg_catalog.format('create table public.not_formatted (id uuid)'));",
    "  perform \"Ops\".execute('create view public.not_quoted as select 1');",
    "end $$;",
  ].join("\n");

  assert.deepEqual(keys(sql), []);
});
