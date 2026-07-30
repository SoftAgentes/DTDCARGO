import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildMigration as buildOriginal0287,
  loadInputs as loadReplayGateInputs,
  splitSqlStatements,
} from "./build-sdd-0118-replay-gates-split-history.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");

export const SOURCE_PATH = resolve(
  ROOT,
  "supabase/migrations/0287_repair_replay_gate_split_history.sql",
);
export const MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/0288_finalize_replay_gate_split_history.sql",
);
export const SQL_TEST_PATH = resolve(
  ROOT,
  "supabase/tests/0288_finalize_replay_gate_split_history.test.sql",
);

export const TARGET_VERSION = "20260730162532";
export const TARGET_NAME = "0287_repair_replay_gate_split_history";
export const SOURCE_MD5 = "edc792b37b75361e1a095a7f71eaff34";
export const SOURCE_LENGTH = 191741;

export const REPAIR_SPLIT_STATES = [
  {
    repairName: "0280_repair_sdd0118_split_history",
    splitCount: 3,
    splitMd5: "9028fffb80d2c9893aabf1e6ee7afb6e",
  },
  {
    repairName: "0281_repair_invite_skip_split_history",
    splitCount: 3,
    splitMd5: "2497d8f67f2cda02d8cb5cab9b113844",
  },
  {
    repairName: "0282_repair_platform_admin_skip_split_history",
    splitCount: 3,
    splitMd5: "4ee8cb102e54fd9623f858df6e032910",
  },
  {
    repairName: "0283_repair_calculator_settings_split_history",
    splitCount: 3,
    splitMd5: "96ba90f48a4f9c1742d7d52aabdf8d8d",
  },
  {
    repairName: "0284_repair_pin_search_path_split_history",
    splitCount: 3,
    splitMd5: "6b62b8b4eb08cce4a7cdf7f848f3857a",
  },
  {
    repairName: "0285_repair_revoke_anon_split_history",
    splitCount: 3,
    splitMd5: "e7ef637390bc02fcbda73db1117581bb",
  },
  {
    repairName: "0286_repair_tenant_acl_split_history",
    splitCount: 3,
    splitMd5: "8cc6e74326c8780d2002233d3e4cc989",
  },
];

function md5(value) {
  return createHash("md5").update(value).digest("hex");
}

function sqlLiteral(value, tag) {
  if (value.includes(`$${tag}$`)) {
    throw new Error(`El tag SQL ${tag} colisiona con su contenido`);
  }
  return `$${tag}$${value}$${tag}$`;
}

function replaceFirst(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) {
    throw new Error(`${label}: no se encontró el bloque fuente`);
  }
  return source.slice(0, index) + after + source.slice(index + before.length);
}

export function patchReplayGatePayload(sourceSql, gates) {
  let patched = sourceSql;

  for (const gate of gates) {
    const state = REPAIR_SPLIT_STATES.find(
      (candidate) => candidate.repairName === gate.repairName,
    );
    if (!state) {
      throw new Error(`Falta el split R20 de ${gate.repairName}`);
    }

    const splitStatements = splitSqlStatements(gate.repairPatchedSql);
    if (
      splitStatements.length !== state.splitCount ||
      md5(splitStatements.join("\n")) !== state.splitMd5
    ) {
      throw new Error(`${gate.repairName}: el split no coincide con R20`);
    }

    const preflightBefore = `      and cardinality(statements) = 1
      and md5(statements[1]) in ('${gate.repairSourceMd5}', '${gate.repairPatchedMd5}')`;
    const preflightAfter = `      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('${gate.repairSourceMd5}', '${gate.repairPatchedMd5}')
        )
        or (
          cardinality(statements) = ${state.splitCount}
          and md5(array_to_string(statements, E'\\n')) = '${state.splitMd5}'
        )
      )`;
    const updateBefore = `where version = '${gate.repairVersion}'
  and name = '${gate.repairName}'
  and cardinality(statements) = 1
  and md5(statements[1]) = '${gate.repairSourceMd5}';`;
    const updateAfter = `where version = '${gate.repairVersion}'
  and name = '${gate.repairName}'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '${gate.repairSourceMd5}'
    )
    or (
      cardinality(statements) = ${state.splitCount}
      and md5(array_to_string(statements, E'\\n')) = '${state.splitMd5}'
    )
  );`;

    patched = replaceFirst(
      patched,
      preflightBefore,
      preflightAfter,
      `preflight ${gate.repairName}`,
    );
    patched = replaceFirst(
      patched,
      updateBefore,
      updateAfter,
      `update ${gate.repairName}`,
    );
  }

  return patched;
}

export async function loadInputs() {
  const replayInputs = await loadReplayGateInputs();
  const canonicalSource = buildOriginal0287(replayInputs);
  const sourceFile = await readFile(SOURCE_PATH, "utf8");
  if (sourceFile !== canonicalSource) {
    throw new Error("0287 cambió respecto de su generador determinista");
  }
  const sourceSql = `${sourceFile}\r\n`;
  if (sourceSql.length !== SOURCE_LENGTH || md5(sourceSql) !== SOURCE_MD5) {
    throw new Error("0287 no coincide byte a byte con Producción");
  }

  const patched0287Sql = patchReplayGatePayload(
    sourceSql,
    replayInputs.gates,
  );
  const patchedMd5 = md5(patched0287Sql);
  const patchedSplitStatements = splitSqlStatements(patched0287Sql);
  const patchedSplitMd5 = md5(patchedSplitStatements.join("\n"));

  return {
    gates: replayInputs.gates,
    sourceSql,
    patched0287Sql,
    patchedMd5,
    patchedSplitStatements,
    patchedSplitMd5,
  };
}

export function buildMigration({
  patched0287Sql,
  patchedMd5,
  patchedSplitStatements,
  patchedSplitMd5,
}) {
  const splitCount = patchedSplitStatements.length;
  return `-- SDD-0118/SDD-0172 · terminar la recursión de splits del replay.
-- Sólo sustituye el payload de 0287 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_replay_finalizer_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('${SOURCE_MD5}', '${patchedMd5}')
        )
        or (
          cardinality(statements) = ${splitCount}
          and md5(array_to_string(statements, E'\\n')) = '${patchedSplitMd5}'
        )
      )
  ) then
    raise exception '0288 abortada: ledger 0287 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_replay_finalizer_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  ${sqlLiteral(patched0287Sql, "sdd0118_replay_finalizer_patched_0287")}
]
where version = '${TARGET_VERSION}'
  and name = '${TARGET_NAME}'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '${SOURCE_MD5}'
    )
    or (
      cardinality(statements) = ${splitCount}
      and md5(array_to_string(statements, E'\\n')) = '${patchedSplitMd5}'
    )
  );

do $sdd0118_replay_finalizer_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${patchedMd5}'
  ) then
    raise exception '0288 abortada: 0287 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_replay_finalizer_postconditions$;
`;
}

export function buildSqlTest({
  gates,
  sourceSql,
  patched0287Sql,
  patchedMd5,
  patchedSplitStatements,
}) {
  const repairRows = gates
    .map((gate, gateIndex) => {
      const statements = splitSqlStatements(gate.repairPatchedSql)
        .map((statement, statementIndex) =>
          sqlLiteral(
            statement,
            `sdd0118_finalizer_repair_${gateIndex}_${statementIndex}`,
          ),
        )
        .join(",\n    ");
      return `(
  '${gate.repairVersion}',
  '${gate.repairName}',
  array[
    ${statements}
  ]
)`;
    })
    .join(",\n");
  const repairAssertions = gates
    .map(
      (gate) => `  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${gate.repairVersion}'
      and name = '${gate.repairName}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${gate.repairPatchedMd5}'
  ) then
    raise exception 'TEST 0288: ${gate.repairName} no colapsó';
  end if;`,
    )
    .join("\n\n");
  const patchedSplitArray = patchedSplitStatements
    .map((statement, index) =>
      sqlLiteral(statement, `sdd0118_finalizer_0287_split_${index}`),
    )
    .join(",\n    ");

  return `\\set ON_ERROR_STOP on

begin;

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  statements text[] not null
);

insert into supabase_migrations.schema_migrations (version, name, statements)
values
${repairRows},
(
  '${TARGET_VERSION}',
  '${TARGET_NAME}',
  array[${sqlLiteral(sourceSql, "sdd0118_finalizer_source_0287")}]
);

\\ir ../migrations/0288_finalize_replay_gate_split_history.sql
\\ir ../migrations/0288_finalize_replay_gate_split_history.sql

select statements[1]
from supabase_migrations.schema_migrations
where version = '${TARGET_VERSION}'
  and name = '${TARGET_NAME}'
\\gexec

do $repair_contracts$
begin
${repairAssertions}
end
$repair_contracts$;

update supabase_migrations.schema_migrations
set statements = array[
    ${patchedSplitArray}
]
where version = '${TARGET_VERSION}'
  and name = '${TARGET_NAME}';

\\ir ../migrations/0288_finalize_replay_gate_split_history.sql

do $finalizer_contract$
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

  if v_payload <> ${sqlLiteral(patched0287Sql, "sdd0118_finalizer_expected_0287")} then
    raise exception 'TEST 0288: payload 0287 no es byte-idéntico al esperado';
  end if;
end
$finalizer_contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  as sdd_0118_replay_finalizer_fixture_rolled_back;
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
  const checkOnly = process.argv.includes("--check");
  const inputs = await loadInputs();
  await writeOrCheck(MIGRATION_PATH, buildMigration(inputs), checkOnly);
  await writeOrCheck(SQL_TEST_PATH, buildSqlTest(inputs), checkOnly);

  if (process.argv.includes("--print-digests")) {
    console.log(`patched_0287_md5=${inputs.patchedMd5}`);
    console.log(
      `patched_0287_split=${inputs.patchedSplitStatements.length}:${inputs.patchedSplitMd5}`,
    );
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
