import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPlatformAdminRepair } from "./build-sdd-0118-repair.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");

export const SOURCE_PATH = resolve(
  ROOT,
  "supabase/migrations/0273_skip_platform_admin_bootstrap_history.sql",
);
export const MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/0282_repair_platform_admin_skip_split_history.sql",
);
export const SQL_TEST_PATH = resolve(
  ROOT,
  "supabase/tests/0282_repair_platform_admin_skip_split_history.test.sql",
);

export const TARGET_VERSION = "20260729141805";
export const TARGET_NAME = "0273_skip_platform_admin_bootstrap_history";
export const SOURCE_MD5 = "22cac3383ef1d3c9a0a814508cc4c817";
export const PATCHED_MD5 = "7866d00b211f8158f79117657fd8a8d1";
export const PLATFORM_ADMIN_VERSION = "20260529071707";
export const PLATFORM_ADMIN_NAME = "platform_admins";
export const PLATFORM_ADMIN_SPLIT_MD5 = "4912baa3058c9f1a4f2281b843499fcd";
export const PLATFORM_ADMIN_TARGET_MD5 = "cb374d4ad4c3b2bb62915e80a5a13793";
export const PLATFORM_ADMIN_SPLIT_FINGERPRINTS = [
  "43f2ea05eb0ae13de285ce938f5c1490",
  "9d3d7de154303b5aa9ccb35e1e06152e",
  "8de52969792cd9e2cf497059316f9028",
  "f502423fc129505bee3493700051eec7",
  "3cce9d25173f4f3a7c086e65b9756408",
  "4d486d82a86dbd6ade967f3096dd9e54",
  "babee21a3d2cd93af5a9f1ccde8f8f62",
  "fbf7f0d94cdfe8122795825c06419ba7",
  "8d0596a81130a0d20c5cc512013dad32",
  "8f5898d246c5d3f6281a7aedce7ced71",
];

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

function sqlLiteralWithTerminalCrLf(value, tag) {
  if (!value.endsWith("\r\n")) {
    throw new Error(`${tag}: falta el CRLF terminal contractual`);
  }
  return `${sqlLiteral(value.slice(0, -2), tag)} || chr(13) || chr(10)`;
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${label}: el bloque fuente no aparece exactamente una vez`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

export function splitPlatformAdminTarget(targetSql) {
  const fragments = targetSql
    .split(/;\s*(?:\n|$)/)
    .filter((fragment) => fragment.trim().length > 0);
  if (fragments.length !== 11) {
    throw new Error(
      `El target platform_admins produjo ${fragments.length} fragmentos, se esperaban 11`,
    );
  }

  const splitStatements = [
    ...fragments.slice(0, 7),
    `${fragments[7]};\n${fragments[8]}`,
    fragments[9],
    fragments[10].trimEnd(),
  ];
  const fingerprints = splitStatements.map(md5);
  if (
    fingerprints.length !== PLATFORM_ADMIN_SPLIT_FINGERPRINTS.length ||
    fingerprints.some(
      (fingerprint, index) =>
        fingerprint !== PLATFORM_ADMIN_SPLIT_FINGERPRINTS[index],
    )
  ) {
    throw new Error(
      "El target fragmentado de platform_admins no coincide con los fingerprints de R13",
    );
  }
  if (md5(splitStatements.join("\n")) !== PLATFORM_ADMIN_SPLIT_MD5) {
    throw new Error("El digest combinado de platform_admins cambió");
  }

  return splitStatements;
}

export function buildPatched0273(originalSql) {
  const preflightBefore = `      and cardinality(statements) = 1
      and md5(statements[1]) in (
        '6c31b8ac8841b24815e3fb2463eabdd2',
        'bb99b54106d671457836daa0dc53b839',
        '${PLATFORM_ADMIN_TARGET_MD5}'
      )`;
  const preflightAfter = `      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in (
            '6c31b8ac8841b24815e3fb2463eabdd2',
            'bb99b54106d671457836daa0dc53b839',
            '${PLATFORM_ADMIN_TARGET_MD5}'
          )
        )
        or (
          cardinality(statements) = 10
          and md5(array_to_string(statements, E'\\n')) = '${PLATFORM_ADMIN_SPLIT_MD5}'
        )
      )`;

  const updateBefore = `  and cardinality(statements) = 1
  and md5(statements[1]) in ('6c31b8ac8841b24815e3fb2463eabdd2', 'bb99b54106d671457836daa0dc53b839');`;
  const updateAfter = `  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) in ('6c31b8ac8841b24815e3fb2463eabdd2', 'bb99b54106d671457836daa0dc53b839')
    )
    or (
      cardinality(statements) = 10
      and md5(array_to_string(statements, E'\\n')) = '${PLATFORM_ADMIN_SPLIT_MD5}'
    )
  );`;

  let patched = replaceOnce(
    originalSql,
    preflightBefore,
    preflightAfter,
    "preflight platform_admins",
  );
  patched = replaceOnce(
    patched,
    updateBefore,
    updateAfter,
    "update platform_admins",
  );
  return patched.replace(
    "-- Conserva el DDL canónico y sólo modifica el statement técnico del ledger.\n",
    `-- Conserva el DDL canónico y sólo modifica el statement técnico del ledger.
-- 0282 acepta además el payload de diez statements observado en R13.
`,
  );
}

export async function loadInputs() {
  // Supabase registró 0273 con un CRLF terminal. Se preserva explícitamente
  // para que el preflight de Producción sea byte-exacto.
  const sourceSql =
    normalizeSql(await readFile(SOURCE_PATH, "utf8")) + "\r\n";
  if (md5(sourceSql) !== SOURCE_MD5) {
    throw new Error("0273 cambió respecto del statement exacto de Producción");
  }

  const { targetSql } = await loadPlatformAdminRepair();
  const splitStatements = splitPlatformAdminTarget(targetSql);
  const patched0273Sql = buildPatched0273(sourceSql);
  const patchedMd5 = md5(patched0273Sql);
  if (PATCHED_MD5 !== "__PATCHED_MD5__" && patchedMd5 !== PATCHED_MD5) {
    throw new Error("El payload reparado de 0273 cambió inesperadamente");
  }

  return {
    sourceSql,
    patched0273Sql,
    patchedMd5,
    splitStatements,
  };
}

export function buildMigration({ patched0273Sql, patchedMd5 }) {
  return `-- SDD-0118 · hacer replay-safe el skip histórico de platform_admins.
-- Sólo sustituye el payload de 0273 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_platform_admin_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('${SOURCE_MD5}', '${patchedMd5}')
  ) then
    raise exception '0282 abortada: ledger 0273 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_platform_admin_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  ${sqlLiteralWithTerminalCrLf(
    patched0273Sql,
    "sdd0118_platform_admin_split_patched_0273",
  )}
]
where version = '${TARGET_VERSION}'
  and name = '${TARGET_NAME}'
  and cardinality(statements) = 1
  and md5(statements[1]) = '${SOURCE_MD5}';

do $sdd0118_platform_admin_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${patchedMd5}'
  ) then
    raise exception '0282 abortada: 0273 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_platform_admin_split_postconditions$;
`;
}

export function buildSqlTest({
  sourceSql,
  patched0273Sql,
  patchedMd5,
  splitStatements,
}) {
  const splitArray = splitStatements
    .map((statement, index) =>
      sqlLiteral(statement, `sdd0118_platform_admin_split_${index}`),
    )
    .join(",\n    ");

  return `\\set ON_ERROR_STOP on

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$roles$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  statements text[] not null
);

insert into supabase_migrations.schema_migrations (version, name, statements)
values
(
  '${PLATFORM_ADMIN_VERSION}',
  '${PLATFORM_ADMIN_NAME}',
  array[
    ${splitArray}
  ]
),
(
  '${TARGET_VERSION}',
  '${TARGET_NAME}',
  array[${sqlLiteralWithTerminalCrLf(
    sourceSql,
    "sdd0118_platform_admin_split_original_0273",
  )}]
);

\\ir ../migrations/0282_repair_platform_admin_skip_split_history.sql
\\ir ../migrations/0282_repair_platform_admin_skip_split_history.sql

do $ledger_contract$
declare
  v_payload text;
begin
  select statements[1]
  into strict v_payload
  from supabase_migrations.schema_migrations
  where version = '${TARGET_VERSION}'
    and name = '${TARGET_NAME}'
    and cardinality(statements) = 1
    and md5(statements[1]) = '${patchedMd5}';

  if v_payload <> ${sqlLiteralWithTerminalCrLf(
    patched0273Sql,
    "sdd0118_platform_admin_split_expected_0273",
  )} then
    raise exception 'TEST 0282: payload 0273 no es byte-idéntico al esperado';
  end if;
  if pg_catalog.strpos(v_payload, '${PLATFORM_ADMIN_SPLIT_MD5}') = 0
     or pg_catalog.strpos(v_payload, 'cardinality(statements) = 10') = 0 then
    raise exception 'TEST 0282: falta compatibilidad con el split de R13';
  end if;
end
$ledger_contract$;

select unnest(statements[1:9])
from supabase_migrations.schema_migrations
where version = '${PLATFORM_ADMIN_VERSION}'
  and name = '${PLATFORM_ADMIN_NAME}'
\\gexec

select statements[1]
from supabase_migrations.schema_migrations
where version = '${TARGET_VERSION}'
  and name = '${TARGET_NAME}'
\\gexec

do $replay_contract$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${PLATFORM_ADMIN_VERSION}'
      and name = '${PLATFORM_ADMIN_NAME}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${PLATFORM_ADMIN_TARGET_MD5}'
  ) then
    raise exception 'TEST 0282: el replay no colapsó platform_admins al target exacto';
  end if;
  if exists (select 1 from public.platform_admins) then
    raise exception 'TEST 0282: el replay creó un platform_admin';
  end if;
end
$replay_contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  and to_regnamespace('auth') is null
  and to_regclass('public.platform_admins') is null
  as sdd_0118_platform_admin_split_fixture_rolled_back;
`;
}

async function writeOrCheck(path, expected, checkOnly) {
  if (checkOnly) {
    const existing = await readFile(path, "utf8");
    if (existing !== expected) {
      throw new Error(`${path} no coincide con el generador determinista`);
    }
    return;
  }
  await writeFile(path, expected, "utf8");
}

async function main() {
  const inputs = await loadInputs();

  if (process.argv.includes("--print-patched-md5")) {
    console.log(inputs.patchedMd5);
    return;
  }

  const checkOnly = process.argv.includes("--check");
  if (!checkOnly && !process.argv.includes("--write")) {
    console.log(buildMigration(inputs));
    return;
  }

  await writeOrCheck(MIGRATION_PATH, buildMigration(inputs), checkOnly);
  await writeOrCheck(SQL_TEST_PATH, buildSqlTest(inputs), checkOnly);
  console.log(
    checkOnly
      ? "0282 sincronizada con su generador determinista"
      : "0282 generada: payload 0273 replay-safe + prueba transaccional",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
