import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");

export const SOURCE_PATH = resolve(
  ROOT,
  "supabase/migrations/0268_tenant_lifecycle_guardrails.sql",
);
export const MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/0279_restore_tenant_lifecycle_acl_history.sql",
);
export const SQL_TEST_PATH = resolve(
  ROOT,
  "supabase/tests/0279_restore_tenant_lifecycle_acl_history.test.sql",
);

export const SOURCE_MD5 = "127a11d4eac9106d621a537b1886c6c3";
export const ACL_REVOKE_SQL =
  "revoke delete on table public.tenants from public, anon, authenticated;";
export const ACL_REVOKE_MD5 = "6f6ddc2074c8f8c527fa6150ff8616c5";
export const TARGET_VERSION = "20260729053713";
export const TARGET_NAME = "0268_tenant_lifecycle_guardrails";

function normalizeSql(value) {
  return value.replace(/\r\n/g, "\n");
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
  const tenantLifecycleSql = normalizeSql(await readFile(SOURCE_PATH, "utf8"));
  if (md5(tenantLifecycleSql) !== SOURCE_MD5) {
    throw new Error("0268 cambió respecto del statement exacto de Producción");
  }
  if (md5(ACL_REVOKE_SQL) !== ACL_REVOKE_MD5) {
    throw new Error("El REVOKE histórico cambió respecto de su digest aprobado");
  }
  return { tenantLifecycleSql };
}

export function buildMigration({ tenantLifecycleSql }) {
  if (!tenantLifecycleSql) {
    throw new Error("Falta el payload canónico de 0268");
  }
  return `-- SDD-0172 · hacer reproducible el preflight histórico de 0268.
-- Sólo antepone al ledger el retiro de DELETE de roles cliente; no ejecuta DDL.

do $sdd0172_tenant_acl_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '${SOURCE_MD5}'
        )
        or (
          cardinality(statements) = 2
          and md5(statements[1]) = '${ACL_REVOKE_MD5}'
          and md5(statements[2]) = '${SOURCE_MD5}'
        )
      )
  ) then
    raise exception
      '0279 abortada: ledger 0268 ausente, ambiguo o con payload inesperado';
  end if;
end
$sdd0172_tenant_acl_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  ${sqlLiteral(ACL_REVOKE_SQL, "sdd0172_tenant_acl_revoke")},
  statements[1]
]
where version = '${TARGET_VERSION}'
  and name = '${TARGET_NAME}'
  and cardinality(statements) = 1
  and md5(statements[1]) = '${SOURCE_MD5}';

do $sdd0172_tenant_acl_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 2
      and md5(statements[1]) = '${ACL_REVOKE_MD5}'
      and md5(statements[2]) = '${SOURCE_MD5}'
  ) then
    raise exception '0279 abortada: 0268 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0172_tenant_acl_postconditions$;
`;
}

export function buildSqlTest({ tenantLifecycleSql }) {
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

grant usage on schema public to anon, authenticated, service_role;

create table public.tenants (
  id uuid primary key
);

create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  constraint entity_audit_log_tenant_id_fkey
    foreign key (tenant_id)
    references public.tenants(id)
    on delete cascade
);

create function public.append_audit_event(
  p_tenant_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_event_type text,
  p_source text,
  p_result text default 'succeeded',
  p_reason text default null,
  p_before_data jsonb default null,
  p_after_data jsonb default null,
  p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null,
  p_schema_version integer default 1,
  p_sensitivity text default 'internal'
)
returns uuid
language sql
as $function$
  select gen_random_uuid()
$function$;

grant all on table public.tenants to service_role;
grant delete on table public.tenants to public, anon, authenticated;

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
  array[${sqlLiteral(tenantLifecycleSql, "sdd0172_tenant_lifecycle_fixture")}]
);

do $fixture_reproduces_r9$
begin
  if not has_table_privilege('anon', 'public.tenants', 'DELETE')
     or not has_table_privilege('authenticated', 'public.tenants', 'DELETE') then
    raise exception 'TEST 0279: el fixture no reproduce el fallo R9';
  end if;
end
$fixture_reproduces_r9$;

\\ir ../migrations/0279_restore_tenant_lifecycle_acl_history.sql
\\ir ../migrations/0279_restore_tenant_lifecycle_acl_history.sql

do $ledger_contract$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 2
      and md5(statements[1]) = '${ACL_REVOKE_MD5}'
      and md5(statements[2]) = '${SOURCE_MD5}'
  ) then
    raise exception 'TEST 0279: ledger 0268 incorrecto';
  end if;
end
$ledger_contract$;

select statements[1]
from supabase_migrations.schema_migrations
where version = '${TARGET_VERSION}'
\\gexec

select statements[2]
from supabase_migrations.schema_migrations
where version = '${TARGET_VERSION}'
\\gexec

do $runtime_contract$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = 'entity_audit_log_tenant_id_fkey'
      and confdeltype = 'r'
      and convalidated
  ) then
    raise exception 'TEST 0279: 0268 no dejó FK RESTRICT';
  end if;

  if has_table_privilege('anon', 'public.tenants', 'DELETE')
     or has_table_privilege('authenticated', 'public.tenants', 'DELETE')
     or has_table_privilege('service_role', 'public.tenants', 'DELETE') then
    raise exception 'TEST 0279: algún rol no-owner conserva DELETE';
  end if;

  if not has_table_privilege('service_role', 'public.tenants', 'SELECT')
     or not has_table_privilege('service_role', 'public.tenants', 'INSERT')
     or not has_table_privilege('service_role', 'public.tenants', 'UPDATE') then
    raise exception 'TEST 0279: 0268 retiró privilegios fuera de alcance';
  end if;
end
$runtime_contract$;

set local role authenticated;

do $authenticated_denied$
begin
  begin
    delete from public.tenants;
    raise exception 'TEST 0279: authenticated todavía puede borrar tenants';
  exception
    when insufficient_privilege then
      null;
  end;
end
$authenticated_denied$;

reset role;

rollback;

select
  to_regclass('public.tenants') is null
  and to_regclass('public.entity_audit_log') is null
  and to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null
  as sdd_0172_tenant_acl_fixture_rolled_back;
`;
}

async function writeOrCheck(path, expected, checkOnly) {
  if (checkOnly) {
    const existing = normalizeSql(await readFile(path, "utf8"));
    if (existing !== expected) {
      throw new Error(`${path} no coincide con el generador determinista`);
    }
    return;
  }
  await writeFile(path, expected, "utf8");
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const inputs = await loadInputs();
  await writeOrCheck(MIGRATION_PATH, buildMigration(inputs), checkOnly);
  await writeOrCheck(SQL_TEST_PATH, buildSqlTest(inputs), checkOnly);
}

const isEntryPoint =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isEntryPoint) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
