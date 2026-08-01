import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");

export const BOOTSTRAP_PATH = resolve(
  ROOT,
  "supabase/migrations/0277_version_rls_auto_enable.sql",
);
export const SWEEP_PATH = resolve(
  ROOT,
  "supabase/migrations/0209_revoke_anon_rpc_sweep.sql",
);
export const MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/0278_restore_rls_auto_enable_history.sql",
);
export const SQL_TEST_PATH = resolve(
  ROOT,
  "supabase/tests/0278_restore_rls_auto_enable_history.test.sql",
);

export const BOOTSTRAP_FILE_MD5 = "171643b4a504a765e5183d0e80cd461f";
export const BOOTSTRAP_MD5 = "3be131a05cb2d712fc92996004ae8b33";
export const SWEEP_MD5 = "c6c722efdb7ff79ef037e0d826739205";
export const TARGET_VERSION = "20260703234254";
export const TARGET_NAME = "0209_revoke_anon_rpc_sweep";

function normalizeSql(value) {
  return value.replace(/\r\n/g, "\n");
}

function executableStatement(value) {
  return value
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .trim();
}

function md5(value) {
  return createHash("md5").update(value).digest("hex");
}

function sqlLiteral(value, tag) {
  if (value.includes(`$${tag}$`)) {
    throw new Error(`El tag SQL ${tag} colisiona con su contenido`);
  }
  return `$${tag}$${value}$${tag}$`;
}

export async function loadInputs() {
  const bootstrapFile = normalizeSql(await readFile(BOOTSTRAP_PATH, "utf8"));
  const sweepSql = normalizeSql(await readFile(SWEEP_PATH, "utf8"));

  if (md5(bootstrapFile) !== BOOTSTRAP_FILE_MD5) {
    throw new Error("0277 cambió respecto del archivo recuperado y publicado");
  }
  const bootstrapSql = executableStatement(bootstrapFile);
  if (md5(bootstrapSql) !== BOOTSTRAP_MD5) {
    throw new Error("0277 cambió respecto del statement exacto del ledger de Producción");
  }
  if (md5(sweepSql) !== SWEEP_MD5) {
    throw new Error("0209 cambió respecto del payload ya restaurado en el ledger");
  }

  return { bootstrapSql, sweepSql };
}

export function buildMigration({ bootstrapSql }) {
  return `-- SDD-0118 · hacer autosuficiente el replay histórico de 0209.
-- Sólo antepone al ledger la definición versionada por 0277; no ejecuta ese DDL.
-- 0209 conserva su payload y pasa a tener dos statements ordenados.

do $sdd0118_rls_history_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '${SWEEP_MD5}'
        )
        or (
          cardinality(statements) = 2
          and md5(statements[1]) = '${BOOTSTRAP_MD5}'
          and md5(statements[2]) = '${SWEEP_MD5}'
        )
      )
  ) then
    raise exception 'SDD-0118 rls history: drift en ${TARGET_VERSION} ${TARGET_NAME}';
  end if;
end
$sdd0118_rls_history_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  ${sqlLiteral(bootstrapSql, "sdd0118_rls_bootstrap")}
] || statements
where version = '${TARGET_VERSION}'
  and name = '${TARGET_NAME}'
  and cardinality(statements) = 1
  and md5(statements[1]) = '${SWEEP_MD5}';

do $sdd0118_rls_history_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 2
      and md5(statements[1]) = '${BOOTSTRAP_MD5}'
      and md5(statements[2]) = '${SWEEP_MD5}'
  ) then
    raise exception 'SDD-0118 rls history: postcondición falló en ${TARGET_VERSION} ${TARGET_NAME}';
  end if;
end
$sdd0118_rls_history_postflight$;
`;
}

export function buildSqlTest({ sweepSql }) {
  return `\\set ON_ERROR_STOP on

begin;

select 'create role anon nologin'
where not exists (select 1 from pg_roles where rolname = 'anon')
\\gexec
select 'create role authenticated nologin'
where not exists (select 1 from pg_roles where rolname = 'authenticated')
\\gexec
select 'create role service_role nologin'
where not exists (select 1 from pg_roles where rolname = 'service_role')
\\gexec

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  statements text[] not null
);

insert into supabase_migrations.schema_migrations (version, name, statements)
values (
  '${TARGET_VERSION}',
  '${TARGET_NAME}',
  array[${sqlLiteral(sweepSql, "sdd0118_rls_sweep_fixture")}]
);

\\ir ../migrations/0278_restore_rls_auto_enable_history.sql
\\ir ../migrations/0278_restore_rls_auto_enable_history.sql

do $ledger_contract$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 2
      and md5(statements[1]) = '${BOOTSTRAP_MD5}'
      and md5(statements[2]) = '${SWEEP_MD5}'
  ) then
    raise exception 'TEST 0278: ledger no quedó ordenado e idempotente';
  end if;
end
$ledger_contract$;

-- Simula el primer statement que recibirá un branch fresco antes del sweep.
select statements[1]
from supabase_migrations.schema_migrations
where version = '${TARGET_VERSION}'
\\gexec

create table public.sdd_0172_rls_probe (id bigint primary key);

do $replay_contract$
declare
  fn oid := to_regprocedure('public.rls_auto_enable()');
begin
  if fn is null then
    raise exception 'TEST 0278: el bootstrap no creó rls_auto_enable()';
  end if;
  if not exists (
    select 1
    from pg_proc
    where oid = fn
      and prosecdef
      and prorettype = 'event_trigger'::regtype
      and proconfig = array['search_path=pg_catalog']
  ) then
    raise exception 'TEST 0278: contrato de seguridad de rls_auto_enable() incorrecto';
  end if;
  if not exists (
    select 1
    from pg_event_trigger
    where evtname = 'ensure_rls'
      and evtevent = 'ddl_command_end'
      and evtenabled = 'O'
      and evttags = array['CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO']
  ) then
    raise exception 'TEST 0278: ensure_rls no quedó activo con los tags exactos';
  end if;
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'sdd_0172_rls_probe'
      and c.relrowsecurity
  ) then
    raise exception 'TEST 0278: ensure_rls no habilitó RLS en la tabla nueva';
  end if;
  if has_function_privilege('anon', fn, 'EXECUTE')
     or has_function_privilege('authenticated', fn, 'EXECUTE')
     or not has_function_privilege('service_role', fn, 'EXECUTE') then
    raise exception 'TEST 0278: ACL de rls_auto_enable() incorrecto';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = fn),
      acldefault('f', (select proowner from pg_proc where oid = fn))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0278: PUBLIC conserva EXECUTE';
  end if;
end
$replay_contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  and to_regclass('public.sdd_0172_rls_probe') is null
  and to_regprocedure('public.rls_auto_enable()') is null
  as sdd_0118_rls_history_fixture_rolled_back;
`;
}

async function main() {
  const inputs = await loadInputs();
  const outputs = [
    [MIGRATION_PATH, buildMigration(inputs)],
    [SQL_TEST_PATH, buildSqlTest(inputs)],
  ];
  const checkOnly = process.argv.includes("--check");

  for (const [path, content] of outputs) {
    if (checkOnly) {
      const existing = normalizeSql(await readFile(path, "utf8"));
      if (existing !== content) {
        throw new Error(`${path} no coincide con el artefacto determinista`);
      }
    } else {
      await writeFile(path, content, "utf8");
    }
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
