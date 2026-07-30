import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildRevokeAnonSweepSqlTest,
  loadRevokeAnonSweepRepair,
} from "./build-sdd-0118-repair.mjs";
import { loadInputs as loadRlsHistoryInputs } from "./build-sdd-0118-rls-history.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");

export const SOURCE_PATH = resolve(
  ROOT,
  "supabase/migrations/0276_restore_revoke_anon_rpc_sweep_history.sql",
);
export const MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/0285_repair_revoke_anon_split_history.sql",
);
export const SQL_TEST_PATH = resolve(
  ROOT,
  "supabase/tests/0285_repair_revoke_anon_split_history.test.sql",
);

export const TARGET_VERSION = "20260729163005";
export const TARGET_NAME = "0276_restore_revoke_anon_rpc_sweep_history";
export const SOURCE_MD5 = "784f95726bd9c6f21963722f1ce7e61d";
export const PATCHED_MD5 = "66df90af092b02ae8c0a87f5e2bc08e0";
export const SWEEP_VERSION = "20260703234254";
export const SWEEP_NAME = "0209_revoke_anon_rpc_sweep";
export const SWEEP_SPLIT_COUNT = 101;
export const SWEEP_SPLIT_MD5 = "fb8e6a5e43f4abff8e1b69582e36eadb";
export const SWEEP_TARGET_MD5 = "c6c722efdb7ff79ef037e0d826739205";
export const SPLIT_EDGE_FINGERPRINTS = [
  "84b1c280f6a84700456ed5b0f18250b6",
  "c8f5140ed87d3f7d65a7ae249d771f14",
  "ffc5c7230e8e08168ab48d06ca1073f8",
  "3174c1b5829e86ea4174198c37ee0d48",
  "b266d8b7c7cd2cb3af6b2b1f5388c9b1",
  "18a4719debe3b2d3ce77052917e7dd6f",
  "a2530de4b4ae0ede77004e6b4e7f31c2",
  "d72f43b1b0b2953203ca63e428f6053b",
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

export function splitReplayTarget(bootstrapSql, sweepSql) {
  const bootstrapGroups = bootstrapSql.split("\n\n");
  if (bootstrapGroups.length !== 4) {
    throw new Error(
      `El bootstrap RLS produjo ${bootstrapGroups.length} grupos, se esperaban 4`,
    );
  }
  const bootstrapStatements = [
    ...bootstrapGroups.slice(0, 3).map((statement) => statement.slice(0, -1)),
    ...bootstrapGroups[3]
      .split("\n")
      .filter(Boolean)
      .map((statement) => statement.slice(0, -1)),
  ];
  const aclMatches = Array.from(
    sweepSql.matchAll(/^(?:revoke|grant) execute .*?;$/gm),
  );
  if (aclMatches.length !== 96) {
    throw new Error(
      `El sweep produjo ${aclMatches.length} statements ACL, se esperaban 96`,
    );
  }
  const aclStatements = aclMatches.map((match, index) =>
    index === 0
      ? sweepSql.slice(0, match.index + match[0].length - 1)
      : match[0].slice(0, -1),
  );
  const splitStatements = [...bootstrapStatements, ...aclStatements];
  if (splitStatements.length !== SWEEP_SPLIT_COUNT) {
    throw new Error(
      `El replay produjo ${splitStatements.length} statements, se esperaban ${SWEEP_SPLIT_COUNT}`,
    );
  }
  if (md5(splitStatements.join("\n")) !== SWEEP_SPLIT_MD5) {
    throw new Error(
      "El replay fragmentado de revoke_anon no coincide con el digest de R16",
    );
  }
  const edgeFingerprints = [
    ...splitStatements.slice(0, 6),
    ...splitStatements.slice(-2),
  ].map(md5);
  if (
    edgeFingerprints.some(
      (fingerprint, index) =>
        fingerprint !== SPLIT_EDGE_FINGERPRINTS[index],
    )
  ) {
    throw new Error(
      "Los fingerprints de borde de revoke_anon no coinciden con R16",
    );
  }
  return splitStatements;
}

export function buildPatched0276(originalSql) {
  const preflightBefore = `        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '${SWEEP_TARGET_MD5}'
        )
      )`;
  const preflightAfter = `        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '${SWEEP_TARGET_MD5}'
        )
        or (
          cardinality(statements) = ${SWEEP_SPLIT_COUNT}
          and md5(array_to_string(statements, E'\\n')) = '${SWEEP_SPLIT_MD5}'
        )
      )`;
  const updateBefore = `  and name = '${SWEEP_NAME}'
  and statements is null;`;
  const updateAfter = `  and name = '${SWEEP_NAME}'
  and (
    statements is null
    or (
      cardinality(statements) = ${SWEEP_SPLIT_COUNT}
      and md5(array_to_string(statements, E'\\n')) = '${SWEEP_SPLIT_MD5}'
    )
  );`;

  let patched = replaceOnce(
    originalSql,
    preflightBefore,
    preflightAfter,
    "preflight revoke_anon",
  );
  patched = replaceOnce(
    patched,
    updateBefore,
    updateAfter,
    "update revoke_anon",
  );
  return patched.replace(
    "-- Sólo reemplaza statements NULL del ledger; no ejecuta los REVOKE/GRANT almacenados.\n",
    `-- Sólo reemplaza el estado NULL o el split exacto de R16; no ejecuta los REVOKE/GRANT almacenados.
-- 0285 conserva fail-closed cualquier representación no reconocida.
`,
  );
}

export async function loadInputs() {
  const sourceSql = normalizeSql(await readFile(SOURCE_PATH, "utf8"));
  if (md5(sourceSql) !== SOURCE_MD5) {
    throw new Error("0276 cambió respecto del statement exacto de Producción");
  }

  const repair = await loadRevokeAnonSweepRepair();
  const { bootstrapSql, sweepSql } = await loadRlsHistoryInputs();
  if (sweepSql !== repair.targetSql) {
    throw new Error("Los generadores 0276 y 0278 divergen en el target 0209");
  }
  const splitStatements = splitReplayTarget(bootstrapSql, sweepSql);
  const patched0276Sql = buildPatched0276(sourceSql);
  const patchedMd5 = md5(patched0276Sql);
  if (PATCHED_MD5 !== "__PATCHED_MD5__" && patchedMd5 !== PATCHED_MD5) {
    throw new Error("El payload reparado de 0276 cambió inesperadamente");
  }

  return {
    sourceSql,
    patched0276Sql,
    patchedMd5,
    repair,
    splitStatements,
  };
}

export function buildMigration({ patched0276Sql, patchedMd5 }) {
  return `-- SDD-0118 · hacer replay-safe el restaurador histórico de revoke_anon.
-- Sólo sustituye el payload de 0276 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_revoke_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('${SOURCE_MD5}', '${patchedMd5}')
  ) then
    raise exception '0285 abortada: ledger 0276 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_revoke_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  ${sqlLiteral(patched0276Sql, "sdd0118_revoke_split_patched_0276")}
]
where version = '${TARGET_VERSION}'
  and name = '${TARGET_NAME}'
  and cardinality(statements) = 1
  and md5(statements[1]) = '${SOURCE_MD5}';

do $sdd0118_revoke_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${patchedMd5}'
  ) then
    raise exception '0285 abortada: 0276 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_revoke_split_postconditions$;
`;
}

export function buildSqlTest({
  sourceSql,
  patched0276Sql,
  patchedMd5,
  repair,
  splitStatements,
}) {
  const baseTest = buildRevokeAnonSweepSqlTest(repair);
  const splitArray = splitStatements
    .map((statement, index) =>
      sqlLiteral(statement, `sdd0118_revoke_split_${index}`),
    )
    .join(",\n    ");
  const originalInsert = `insert into supabase_migrations.schema_migrations (version, name, statements)
values ('${repair.version}', '${repair.name}', null);`;
  const splitInsert = `insert into supabase_migrations.schema_migrations (version, name, statements)
values
(
  '${repair.version}',
  '${repair.name}',
  array[
    ${splitArray}
  ]
),
(
  '${TARGET_VERSION}',
  '${TARGET_NAME}',
  array[${sqlLiteral(sourceSql, "sdd0118_revoke_split_original_0276")}]
);`;
  const originalApply = `\\ir ../migrations/0276_restore_revoke_anon_rpc_sweep_history.sql
\\ir ../migrations/0276_restore_revoke_anon_rpc_sweep_history.sql`;
  const repairApply = `\\ir ../migrations/0285_repair_revoke_anon_split_history.sql
\\ir ../migrations/0285_repair_revoke_anon_split_history.sql

do $patched_0276_contract$
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

  if v_payload <> ${sqlLiteral(
    patched0276Sql,
    "sdd0118_revoke_split_expected_0276",
  )} then
    raise exception 'TEST 0285: payload 0276 no es byte-idéntico al esperado';
  end if;
  if pg_catalog.strpos(v_payload, '${SWEEP_SPLIT_MD5}') = 0
     or pg_catalog.strpos(v_payload, 'cardinality(statements) = ${SWEEP_SPLIT_COUNT}') = 0 then
    raise exception 'TEST 0285: falta compatibilidad con el split de R16';
  end if;
end
$patched_0276_contract$;

select statements[1]
from supabase_migrations.schema_migrations
where version = '${TARGET_VERSION}'
  and name = '${TARGET_NAME}'
\\gexec`;
  const replayApply = `select statements[1]
from supabase_migrations.schema_migrations
where version = '${repair.version}'
  and name = '${repair.name}'
\\gexec`;

  let test = replaceOnce(
    baseTest,
    originalInsert,
    splitInsert,
    "fixture ledger revoke_anon",
  );
  test = replaceOnce(test, originalApply, repairApply, "aplicación 0276");
  test = replaceOnce(
    test,
    `${repair.targetSql}\n\ndo $replay_contract$`,
    `${replayApply}\n\ndo $replay_contract$`,
    "replay revoke_anon",
  );
  return test;
}

async function writeOrCheck(path, content, checkOnly) {
  if (checkOnly) {
    const current = await readFile(path, "utf8");
    if (current !== content) {
      throw new Error(`${path} no coincide con su generador`);
    }
    return;
  }
  await writeFile(path, content, "utf8");
}

async function main() {
  const inputs = await loadInputs();
  if (process.argv.includes("--print-md5")) {
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
      ? "0285 sincronizada con su generador determinista"
      : "0285 generada: payload 0276 replay-safe + prueba transaccional",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
