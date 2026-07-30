import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");

export const SOURCE_PATH = resolve(
  ROOT,
  "supabase/migrations/0272_skip_superseded_invite_history.sql",
);
export const MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/0281_repair_invite_skip_split_history.sql",
);
export const SQL_TEST_PATH = resolve(
  ROOT,
  "supabase/tests/0281_repair_invite_skip_split_history.test.sql",
);

export const TARGET_VERSION = "20260729140214";
export const TARGET_NAME = "0272_skip_superseded_invite_history";
export const SOURCE_MD5 = "887cc625c50ba8f6a2292bad25989fc5";
export const PATCHED_MD5 = "4242bf102d649559d13793b53e46f43c";

export const SPLIT_FIXES = [
  {
    version: "20260528060007",
    name: "0031_fix_studio_invite_gen_random_bytes",
    canonicalMd5: "8296dce3805f143e549a239995bd954a",
    splitMd5: "e7f1e2878e508b2338f4f014f8e9578f",
    targetMd5: "9e4dc98716f8335c93e9961ccdf18fbe",
  },
  {
    version: "20260528060008",
    name: "0032_fix_studio_invite_ambiguous_token",
    canonicalMd5: "bb5879cd44f1b5911511e223a0618e51",
    splitMd5: "45a1d8ecf3de592e7c2106bb704e709f",
    targetMd5: "accd69afa043efc46960c8de5faa7c34",
  },
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

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${label}: el bloque fuente no aparece exactamente una vez`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

export function buildPatched0272(originalSql) {
  let patched = originalSql;

  for (const fix of SPLIT_FIXES) {
    const preflightBefore =
      `md5(statements[1]) in ('${fix.canonicalMd5}', '${fix.targetMd5}')`;
    const preflightAfter =
      `md5(statements[1]) in ('${fix.canonicalMd5}', '${fix.splitMd5}', '${fix.targetMd5}')`;
    patched = replaceOnce(
      patched,
      preflightBefore,
      preflightAfter,
      `preflight ${fix.version}`,
    );

    const updateBefore =
      `and md5(statements[1]) = '${fix.canonicalMd5}';`;
    const updateAfter =
      `and md5(statements[1]) in ('${fix.canonicalMd5}', '${fix.splitMd5}');`;
    patched = replaceOnce(
      patched,
      updateBefore,
      updateAfter,
      `update ${fix.version}`,
    );
  }

  return patched.replace(
    "-- Sólo restaura comments no-op en el ledger; no ejecuta DDL de negocio.\n",
    `-- Sólo restaura comments no-op en el ledger; no ejecuta DDL de negocio.
-- 0281 acepta además los payloads fragmentados que 0280 preserva en replay.
`,
  );
}

export async function loadInputs() {
  // Supabase conservó el archivo 0272 completo y añadió un CRLF terminal al
  // statement registrado. Esa diferencia de dos bytes forma parte del
  // fingerprint de Producción y se reconstruye de manera explícita.
  const sourceSql =
    normalizeSql(await readFile(SOURCE_PATH, "utf8")) + "\r\n";
  if (md5(sourceSql) !== SOURCE_MD5) {
    throw new Error("0272 cambió respecto del statement exacto de Producción");
  }

  const patched0272Sql = buildPatched0272(sourceSql);
  const patchedMd5 = md5(patched0272Sql);
  if (PATCHED_MD5 !== "__PATCHED_MD5__" && patchedMd5 !== PATCHED_MD5) {
    throw new Error("El payload reparado de 0272 cambió inesperadamente");
  }

  return { sourceSql, patched0272Sql, patchedMd5 };
}

export function buildMigration({ patched0272Sql, patchedMd5 }) {
  return `-- SDD-0118 · hacer replay-safe el skip histórico de invitaciones.
-- Sólo sustituye el payload de 0272 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_invite_skip_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('${SOURCE_MD5}', '${patchedMd5}')
  ) then
    raise exception '0281 abortada: ledger 0272 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_invite_skip_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  ${sqlLiteral(patched0272Sql, "sdd0118_invite_skip_split_patched_0272")}
]
where version = '${TARGET_VERSION}'
  and name = '${TARGET_NAME}'
  and cardinality(statements) = 1
  and md5(statements[1]) = '${SOURCE_MD5}';

do $sdd0118_invite_skip_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${patchedMd5}'
  ) then
    raise exception '0281 abortada: 0272 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_invite_skip_split_postconditions$;
`;
}

export function buildSqlTest({ sourceSql, patched0272Sql, patchedMd5 }) {
  const markerAssertions = SPLIT_FIXES.map(
    (fix) => `  if pg_catalog.strpos(v_payload, '${fix.splitMd5}') = 0
     or pg_catalog.strpos(
       v_payload,
       'in (''${fix.canonicalMd5}'', ''${fix.splitMd5}'')'
     ) = 0 then
    raise exception 'TEST 0281: falta compatibilidad split ${fix.version}';
  end if;`,
  ).join("\n\n");

  return `\\set ON_ERROR_STOP on

begin;

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
  array[${sqlLiteral(sourceSql, "sdd0118_invite_skip_split_original_0272")}]
);

\\ir ../migrations/0281_repair_invite_skip_split_history.sql
\\ir ../migrations/0281_repair_invite_skip_split_history.sql

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

${markerAssertions}

  if v_payload <> ${sqlLiteral(
    patched0272Sql,
    "sdd0118_invite_skip_split_expected_0272",
  )} then
    raise exception 'TEST 0281: payload 0272 no es byte-idéntico al esperado';
  end if;
end
$ledger_contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  as sdd_0118_invite_skip_split_fixture_rolled_back;
`;
}

async function main() {
  const inputs = await loadInputs();

  if (process.argv.includes("--print-patched-md5")) {
    console.log(inputs.patchedMd5);
    return;
  }

  if (!process.argv.includes("--write")) {
    console.log(buildMigration(inputs));
    return;
  }

  await writeFile(MIGRATION_PATH, buildMigration(inputs), "utf8");
  await writeFile(SQL_TEST_PATH, buildSqlTest(inputs), "utf8");
  console.log(
    "0281 generada: payload 0272 replay-safe + prueba transaccional",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
