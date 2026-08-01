import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildMigration as buildOriginal0271,
  loadRepairs,
} from "./build-sdd-0118-repair.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");

export const SOURCE_PATH = resolve(
  ROOT,
  "supabase/migrations/0271_repair_branch_replay_history.sql",
);
export const MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/0280_repair_sdd0118_split_history.sql",
);
export const SQL_TEST_PATH = resolve(
  ROOT,
  "supabase/tests/0280_repair_sdd0118_split_history.test.sql",
);

export const TARGET_VERSION = "20260729135053";
export const TARGET_NAME = "0271_repair_branch_replay_history";
export const SOURCE_MD5 = "0839e50eeb47a158382fc2f6c27d5fe9";
export const PATCHED_MD5 = "c7b1f468087e249e2ca44359aa3f686f";

export const SPLIT_STATES = [
  {
    version: "20260526213130",
    name: "seed_team_invitation_template",
    cardinality: 63,
    joinedMd5: "b9da059306c4a80875e54947b9338252",
  },
  {
    version: "20260527073053",
    name: "realtime_dispatch",
    cardinality: 110,
    joinedMd5: "ffa4e66b1ca875226edc55a86b37d780",
  },
  {
    version: "20260528060005",
    name: "0026_welcome_email_template_seed",
    cardinality: 2,
    joinedMd5: "c399ccef97c43bcb53a512ae7f89fb1c",
  },
  {
    version: "20260528060006",
    name: "0027_qr_print_orders",
    cardinality: 24,
    joinedMd5: "fb618384a1a3f605c1fe8694a03ec937",
  },
  {
    version: "20260528060007",
    name: "0031_fix_studio_invite_gen_random_bytes",
    cardinality: 1,
    joinedMd5: "e7f1e2878e508b2338f4f014f8e9578f",
  },
  {
    version: "20260528060008",
    name: "0032_fix_studio_invite_ambiguous_token",
    cardinality: 1,
    joinedMd5: "45a1d8ecf3de592e7c2106bb704e709f",
  },
  {
    version: "20260528060009",
    name: "0033_grant_service_role_policies",
    cardinality: 22,
    joinedMd5: "1ee346e5e133b78975092b3e35e85ee4",
  },
  {
    version: "20260528060010",
    name: "0035_fix_verify_operario_pin_extensions",
    cardinality: 5,
    joinedMd5: "5f11aede669230b8ac8f9e192d71bdd1",
  },
  {
    version: "20260528060011",
    name: "0036_fk_user_tenants_profile",
    cardinality: 2,
    joinedMd5: "3793eabacad9b8462e6d79b80c3df1ee",
  },
  {
    version: "20260528060012",
    name: "0037_harden_operario_pin_validator",
    cardinality: 2,
    joinedMd5: "b518fb6c89d4e61d28fdde7b7d7cd23c",
  },
  {
    version: "20260528060013",
    name: "0039_fix_bug_advance_state_actor_type_cast",
    cardinality: 1,
    joinedMd5: "8d9f6730f9b5d420d2cf807eedaa66d9",
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

function currentStatePredicate(repair) {
  const expectedCardinality =
    repair.mode === "prepend" ? repair.sources.length + 1 : 1;
  const checks = repair.sources.map(
    (source, index) =>
      `md5(statements[${index + 1}]) = '${source.md5}'`,
  );
  if (repair.mode === "prepend") {
    checks.push(
      `md5(statements[${expectedCardinality}]) = '${repair.expectedOldMd5}'`,
    );
  }

  return [
    `cardinality(statements) = ${expectedCardinality}`,
    ...checks,
  ].join("\n          and ");
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${label}: el bloque fuente no aparece exactamente una vez`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

export function buildPatched0271(originalSql, repairs) {
  let patched = originalSql;

  for (const split of SPLIT_STATES) {
    const repair = repairs.find(
      (item) => item.version === split.version && item.name === split.name,
    );
    if (!repair) {
      throw new Error(
        `Falta la reparación base ${split.version} ${split.name}`,
      );
    }

    const current = currentStatePredicate(repair);
    const splitPredicate = `cardinality(statements) = ${split.cardinality}
          and md5(array_to_string(statements, E'\\n')) = '${split.joinedMd5}'`;
    const preflightBefore = `        or (
          ${current}
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en ${repair.version} ${repair.name}';`;
    const preflightAfter = `        or (
          ${current}
        )
        or (
          ${splitPredicate}
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en ${repair.version} ${repair.name}';`;
    patched = replaceOnce(
      patched,
      preflightBefore,
      preflightAfter,
      `preflight ${repair.version}`,
    );

    const postflightBefore = `      and ${current}
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en ${repair.version} ${repair.name}';`;
    const postflightAfter = `      and (
        (
          ${current}
        )
        or (
          ${splitPredicate}
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en ${repair.version} ${repair.name}';`;
    patched = replaceOnce(
      patched,
      postflightBefore,
      postflightAfter,
      `postflight ${repair.version}`,
    );
  }

  return patched.replace(
    "-- Los SQL históricos quedan almacenados como texto para futuros replays.\n",
    `-- Los SQL históricos quedan almacenados como texto para futuros replays.
-- 0280 acepta además la fragmentación exacta observada en un branch fresco.
`,
  );
}

export async function loadInputs() {
  const repairs = await loadRepairs();
  const canonicalOriginal = buildOriginal0271(repairs);
  const sourceSql = normalizeSql(await readFile(SOURCE_PATH, "utf8"));

  if (sourceSql !== canonicalOriginal || md5(sourceSql) !== SOURCE_MD5) {
    throw new Error("0271 cambió respecto del statement exacto de Producción");
  }

  const patched0271Sql = buildPatched0271(sourceSql, repairs);
  const patchedMd5 = md5(patched0271Sql);
  if (PATCHED_MD5 !== "__PATCHED_MD5__" && patchedMd5 !== PATCHED_MD5) {
    throw new Error("El payload reparado de 0271 cambió inesperadamente");
  }

  return { sourceSql, patched0271Sql, patchedMd5, repairs };
}

export function buildMigration({ patched0271Sql, patchedMd5 }) {
  return `-- SDD-0118 · hacer replay-safe el preflight histórico de 0271.
-- Sólo sustituye el payload del ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('${SOURCE_MD5}', '${patchedMd5}')
  ) then
    raise exception '0280 abortada: ledger 0271 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  ${sqlLiteral(patched0271Sql, "sdd0118_split_patched_0271")}
]
where version = '${TARGET_VERSION}'
  and name = '${TARGET_NAME}'
  and cardinality(statements) = 1
  and md5(statements[1]) = '${SOURCE_MD5}';

do $sdd0118_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${patchedMd5}'
  ) then
    raise exception '0280 abortada: 0271 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_split_postconditions$;
`;
}

export function buildSqlTest({ sourceSql, patchedMd5 }) {
  const markerAssertions = SPLIT_STATES.map(
    (split) => `  if pg_catalog.strpos(
    v_payload,
    'cardinality(statements) = ${split.cardinality}'
  ) = 0
     or pg_catalog.strpos(v_payload, '${split.joinedMd5}') = 0 then
    raise exception 'TEST 0280: falta fingerprint ${split.version}';
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
  array[${sqlLiteral(sourceSql, "sdd0118_split_original_0271")}]
);

\\ir ../migrations/0280_repair_sdd0118_split_history.sql
\\ir ../migrations/0280_repair_sdd0118_split_history.sql

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
end
$ledger_contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  as sdd_0118_split_fixture_rolled_back;
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

  if (process.argv.includes("--print-patched-md5")) {
    console.log(inputs.patchedMd5);
  }
}

const isEntryPoint =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isEntryPoint) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
