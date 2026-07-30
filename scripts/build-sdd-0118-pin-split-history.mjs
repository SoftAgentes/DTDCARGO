import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildPinSearchPathSqlTest,
  loadPinSearchPathRepair,
} from "./build-sdd-0118-repair.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");

export const SOURCE_PATH = resolve(
  ROOT,
  "supabase/migrations/0275_restore_pin_search_path_history.sql",
);
export const MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/0284_repair_pin_search_path_split_history.sql",
);
export const SQL_TEST_PATH = resolve(
  ROOT,
  "supabase/tests/0284_repair_pin_search_path_split_history.test.sql",
);

export const TARGET_VERSION = "20260729152036";
export const TARGET_NAME = "0275_restore_pin_search_path_history";
export const SOURCE_MD5 = "a217fa825ff964f2c2a4cb26d31c3dbc";
export const PATCHED_MD5 = "cad36533b4225b674f1d8fd7b8c165ea";
export const PIN_VERSION = "20260703235255";
export const PIN_NAME = "0210_pin_search_path_triggers";
export const PIN_SPLIT_MD5 = "442a34163980f1fc26bf6f930347b8a1";
export const PIN_TARGET_MD5 = "c3131d8ea3756049d6455bc98b4d0ecc";
export const PIN_SPLIT_FINGERPRINTS = [
  "4aec76173fe77cc54722dab274ace2b5",
  "ab61c1d455599424528a582dd86041c4",
  "51d8f913f75e329d9466642a63eb5523",
  "7c1b6fbbda34ff110553349b53ccbfb8",
  "42761756f2f44a46ce3e3b4567876e00",
  "2563c1daaa0e36b74ad80644447d5080",
  "fe85c07ffacef0994f104ab29f7a1d33",
  "b948705b8fe07c440d2bdb7b11dd52f9",
  "eecaa4b9021bafe3ec69bfaaa608a61a",
  "bb97013b0f7776c43ab583b2af224161",
  "bf993074c063e38318e4539e5f165884",
  "34fa549de3b31da01ad725020761884b",
  "7543ef5be1f22a77c8e2fcc882cff270",
  "45680909caefce5545d61974f3f231d1",
  "58e8551dcc70c99ebc5d3f55fb2ee3e7",
  "10472888b24e316e4569a70d3dd0f5cb",
  "b95cf72852e1c5b72208d4499d4ce6ba",
  "060467c11e8f99c5a2be1bcbadcc63b3",
  "de760ab1d066d4f324b04122876ca1ec",
  "0f2c8dd05b95ac18d33075e7ae80966d",
  "805cca12026d19e95d6442501b0e845c",
  "c635ecad307f74055eff03b7555885a1",
  "9e0d12b1963ae0549b717a9064d5a386",
  "2ef7fa90329099f525330cbbf288257f",
  "401d18e45b05341f762417f151abd513",
  "c9c368e38db9081cfcf44b344c1b767d",
  "ceb167f93ad235ba32edb4450e77185f",
  "e04707233161408d92ea9868e0b5b079",
  "7b84ce45e569be2c1eae1e5c47df7608",
  "9e3ba25ab5319876d8068f30995de658",
  "03ef41e7c9ac837ed11c37b07b348a1f",
  "8dec68319f1e0ec01d7db9c863715445",
  "007def051c605511fd7ec271eb6a6a67",
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

export function splitPinTarget(targetSql) {
  const matches = Array.from(targetSql.matchAll(/^alter function .*?;$/gm));
  if (matches.length !== 33) {
    throw new Error(
      `El target pin_search_path produjo ${matches.length} ALTER FUNCTION, se esperaban 33`,
    );
  }
  const splitStatements = matches.map((match, index) =>
    index === 0
      ? targetSql.slice(0, match.index + match[0].length - 1)
      : match[0].slice(0, -1),
  );
  const fingerprints = splitStatements.map(md5);
  if (
    fingerprints.length !== PIN_SPLIT_FINGERPRINTS.length ||
    fingerprints.some(
      (fingerprint, index) => fingerprint !== PIN_SPLIT_FINGERPRINTS[index],
    )
  ) {
    throw new Error(
      "El target fragmentado de pin_search_path no coincide con los fingerprints de R15",
    );
  }
  if (md5(splitStatements.join("\n")) !== PIN_SPLIT_MD5) {
    throw new Error("El digest combinado de pin_search_path cambió");
  }
  return splitStatements;
}

export function buildPatched0275(originalSql) {
  const preflightBefore = `        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '${PIN_TARGET_MD5}'
        )
      )`;
  const preflightAfter = `        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '${PIN_TARGET_MD5}'
        )
        or (
          cardinality(statements) = 33
          and md5(array_to_string(statements, E'\\n')) = '${PIN_SPLIT_MD5}'
        )
      )`;
  const updateBefore = `  and name = '${PIN_NAME}'
  and statements is null;`;
  const updateAfter = `  and name = '${PIN_NAME}'
  and (
    statements is null
    or (
      cardinality(statements) = 33
      and md5(array_to_string(statements, E'\\n')) = '${PIN_SPLIT_MD5}'
    )
  );`;

  let patched = replaceOnce(
    originalSql,
    preflightBefore,
    preflightAfter,
    "preflight pin_search_path",
  );
  patched = replaceOnce(
    patched,
    updateBefore,
    updateAfter,
    "update pin_search_path",
  );
  return patched.replace(
    "-- Sólo reemplaza statements NULL del ledger; no ejecuta los ALTER almacenados.\n",
    `-- Sólo reemplaza el estado NULL o el split exacto de R15; no ejecuta los ALTER almacenados.
-- 0284 conserva fail-closed cualquier representación no reconocida.
`,
  );
}

export async function loadInputs() {
  const sourceSql = normalizeSql(await readFile(SOURCE_PATH, "utf8"));
  if (md5(sourceSql) !== SOURCE_MD5) {
    throw new Error("0275 cambió respecto del statement exacto de Producción");
  }

  const repair = await loadPinSearchPathRepair();
  const splitStatements = splitPinTarget(repair.targetSql);
  const patched0275Sql = buildPatched0275(sourceSql);
  const patchedMd5 = md5(patched0275Sql);
  if (PATCHED_MD5 !== "__PATCHED_MD5__" && patchedMd5 !== PATCHED_MD5) {
    throw new Error("El payload reparado de 0275 cambió inesperadamente");
  }

  return {
    sourceSql,
    patched0275Sql,
    patchedMd5,
    repair,
    splitStatements,
  };
}

export function buildMigration({ patched0275Sql, patchedMd5 }) {
  return `-- SDD-0118 · hacer replay-safe el restaurador histórico de pin_search_path.
-- Sólo sustituye el payload de 0275 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_pin_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('${SOURCE_MD5}', '${patchedMd5}')
  ) then
    raise exception '0284 abortada: ledger 0275 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_pin_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  ${sqlLiteral(patched0275Sql, "sdd0118_pin_split_patched_0275")}
]
where version = '${TARGET_VERSION}'
  and name = '${TARGET_NAME}'
  and cardinality(statements) = 1
  and md5(statements[1]) = '${SOURCE_MD5}';

do $sdd0118_pin_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${patchedMd5}'
  ) then
    raise exception '0284 abortada: 0275 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_pin_split_postconditions$;
`;
}

export function buildSqlTest({
  sourceSql,
  patched0275Sql,
  patchedMd5,
  repair,
  splitStatements,
}) {
  const baseTest = buildPinSearchPathSqlTest(repair);
  const splitArray = splitStatements
    .map((statement, index) =>
      sqlLiteral(statement, `sdd0118_pin_split_${index}`),
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
  array[${sqlLiteral(sourceSql, "sdd0118_pin_split_original_0275")}]
);`;
  const originalApply = `\\ir ../migrations/0275_restore_pin_search_path_history.sql
\\ir ../migrations/0275_restore_pin_search_path_history.sql`;
  const repairApply = `\\ir ../migrations/0284_repair_pin_search_path_split_history.sql
\\ir ../migrations/0284_repair_pin_search_path_split_history.sql

do $patched_0275_contract$
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
    patched0275Sql,
    "sdd0118_pin_split_expected_0275",
  )} then
    raise exception 'TEST 0284: payload 0275 no es byte-idéntico al esperado';
  end if;
  if pg_catalog.strpos(v_payload, '${PIN_SPLIT_MD5}') = 0
     or pg_catalog.strpos(v_payload, 'cardinality(statements) = 33') = 0 then
    raise exception 'TEST 0284: falta compatibilidad con el split de R15';
  end if;
end
$patched_0275_contract$;

select statements[1]
from supabase_migrations.schema_migrations
where version = '${TARGET_VERSION}'
  and name = '${TARGET_NAME}'
\\gexec`;
  const replayApply = `select unnest(statements)
from supabase_migrations.schema_migrations
where version = '${repair.version}'
  and name = '${repair.name}'
\\gexec`;

  let test = replaceOnce(
    baseTest,
    originalInsert,
    splitInsert,
    "fixture ledger pin_search_path",
  );
  test = replaceOnce(test, originalApply, repairApply, "aplicación 0275");
  test = replaceOnce(
    test,
    `${repair.targetSql}\n\ndo $replay_contract$`,
    `${replayApply}\n\ndo $replay_contract$`,
    "replay pin_search_path",
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
      ? "0284 sincronizada con su generador determinista"
      : "0284 generada: payload 0275 replay-safe + prueba transaccional",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
