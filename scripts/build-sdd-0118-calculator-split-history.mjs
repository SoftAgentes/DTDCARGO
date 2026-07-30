import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildCalculatorSettingsSqlTest,
  loadCalculatorSettingsRepair,
} from "./build-sdd-0118-repair.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");

export const SOURCE_PATH = resolve(
  ROOT,
  "supabase/migrations/0274_restore_calculator_settings_history.sql",
);
export const MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/0283_repair_calculator_settings_split_history.sql",
);
export const SQL_TEST_PATH = resolve(
  ROOT,
  "supabase/tests/0283_repair_calculator_settings_split_history.test.sql",
);

export const TARGET_VERSION = "20260729143620";
export const TARGET_NAME = "0274_restore_calculator_settings_history";
export const SOURCE_MD5 = "6ddc823788cbdd6b280810d7ae61a86c";
export const PATCHED_MD5 = "7dec3bd4977326580000cbdb0d528305";
export const CALCULATOR_VERSION = "20260604131310";
export const CALCULATOR_NAME = "0103_calculator_settings";
export const CALCULATOR_SPLIT_MD5 = "f7102aeb22551a4628923dfba5d11793";
export const CALCULATOR_TARGET_MD5 = "0f7deee22e3a978c52159b6fc211ee2c";
export const CALCULATOR_SPLIT_FINGERPRINTS = [
  "62307ab8c52471c4a07efc14d48417b8",
  "f42e11b7e85267542456c38c47b4ce98",
  "3a89ebc313211e1bcee3c6872dabbcdb",
  "db433f4d92f7bd7741670660d67506ef",
  "6e66fd2bd2616aeea5b222dc8cc8d19b",
  "2065b24a0b96e70a683d5d904b9c1927",
  "ffdb26231d26ff81b8caea2bd2ee424c",
  "a4947fa5a62c7f29b76e9c9f0c17914a",
  "977a827bc590173bc3df1f97fc47a98c",
  "afc02ba3eea09eb599cc9aadedd0b3d0",
  "3f3ece1b4bc4d4f60353d51154e6bc80",
  "4d1e18a14ce0aede9602e54ef650c3a2",
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

export function splitCalculatorTarget(targetSql) {
  const fragments = targetSql
    .split(/;\s*(?:\n|$)/)
    .filter((fragment) => fragment.trim().length > 0);
  if (fragments.length !== 13) {
    throw new Error(
      `El target calculator_settings produjo ${fragments.length} fragmentos, se esperaban 13`,
    );
  }

  const splitStatements = [
    ...fragments.slice(0, 8),
    `${fragments[8]};\n${fragments[9]}`,
    ...fragments.slice(10),
  ];
  const fingerprints = splitStatements.map(md5);
  if (
    fingerprints.length !== CALCULATOR_SPLIT_FINGERPRINTS.length ||
    fingerprints.some(
      (fingerprint, index) =>
        fingerprint !== CALCULATOR_SPLIT_FINGERPRINTS[index],
    )
  ) {
    throw new Error(
      "El target fragmentado de calculator_settings no coincide con los fingerprints de R14",
    );
  }
  if (md5(splitStatements.join("\n")) !== CALCULATOR_SPLIT_MD5) {
    throw new Error("El digest combinado de calculator_settings cambió");
  }

  return splitStatements;
}

export function buildPatched0274(originalSql) {
  const preflightBefore = `        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '${CALCULATOR_TARGET_MD5}'
        )
      )`;
  const preflightAfter = `        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '${CALCULATOR_TARGET_MD5}'
        )
        or (
          cardinality(statements) = 12
          and md5(array_to_string(statements, E'\\n')) = '${CALCULATOR_SPLIT_MD5}'
        )
      )`;
  const updateBefore = `  and name = '${CALCULATOR_NAME}'
  and statements is null;`;
  const updateAfter = `  and name = '${CALCULATOR_NAME}'
  and (
    statements is null
    or (
      cardinality(statements) = 12
      and md5(array_to_string(statements, E'\\n')) = '${CALCULATOR_SPLIT_MD5}'
    )
  );`;

  let patched = replaceOnce(
    originalSql,
    preflightBefore,
    preflightAfter,
    "preflight calculator_settings",
  );
  patched = replaceOnce(
    patched,
    updateBefore,
    updateAfter,
    "update calculator_settings",
  );
  return patched.replace(
    "-- Sólo reemplaza statements NULL del ledger; no ejecuta el DDL almacenado.\n",
    `-- Sólo reemplaza el estado NULL o el split exacto de R14; no ejecuta el DDL almacenado.
-- 0283 conserva fail-closed cualquier representación no reconocida.
`,
  );
}

export async function loadInputs() {
  const sourceSql =
    normalizeSql(await readFile(SOURCE_PATH, "utf8")) + "\r\n";
  if (md5(sourceSql) !== SOURCE_MD5) {
    throw new Error("0274 cambió respecto del statement exacto de Producción");
  }

  const repair = await loadCalculatorSettingsRepair();
  const splitStatements = splitCalculatorTarget(repair.targetSql);
  const patched0274Sql = buildPatched0274(sourceSql);
  const patchedMd5 = md5(patched0274Sql);
  if (PATCHED_MD5 !== "__PATCHED_MD5__" && patchedMd5 !== PATCHED_MD5) {
    throw new Error("El payload reparado de 0274 cambió inesperadamente");
  }

  return {
    sourceSql,
    patched0274Sql,
    patchedMd5,
    repair,
    splitStatements,
  };
}

export function buildMigration({ patched0274Sql, patchedMd5 }) {
  return `-- SDD-0118 · hacer replay-safe el restaurador histórico de calculator_settings.
-- Sólo sustituye el payload de 0274 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_calculator_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('${SOURCE_MD5}', '${patchedMd5}')
  ) then
    raise exception '0283 abortada: ledger 0274 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_calculator_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  ${sqlLiteralWithTerminalCrLf(
    patched0274Sql,
    "sdd0118_calculator_split_patched_0274",
  )}
]
where version = '${TARGET_VERSION}'
  and name = '${TARGET_NAME}'
  and cardinality(statements) = 1
  and md5(statements[1]) = '${SOURCE_MD5}';

do $sdd0118_calculator_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${patchedMd5}'
  ) then
    raise exception '0283 abortada: 0274 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_calculator_split_postconditions$;
`;
}

export function buildSqlTest({
  sourceSql,
  patched0274Sql,
  patchedMd5,
  repair,
  splitStatements,
}) {
  const baseTest = buildCalculatorSettingsSqlTest(repair);
  const splitArray = splitStatements
    .map((statement, index) =>
      sqlLiteral(statement, `sdd0118_calculator_split_${index}`),
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
  array[${sqlLiteralWithTerminalCrLf(
    sourceSql,
    "sdd0118_calculator_split_original_0274",
  )}]
);`;
  const originalApply = `\\ir ../migrations/0274_restore_calculator_settings_history.sql
\\ir ../migrations/0274_restore_calculator_settings_history.sql`;
  const repairApply = `\\ir ../migrations/0283_repair_calculator_settings_split_history.sql
\\ir ../migrations/0283_repair_calculator_settings_split_history.sql

do $patched_0274_contract$
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
    patched0274Sql,
    "sdd0118_calculator_split_expected_0274",
  )} then
    raise exception 'TEST 0283: payload 0274 no es byte-idéntico al esperado';
  end if;
  if pg_catalog.strpos(v_payload, '${CALCULATOR_SPLIT_MD5}') = 0
     or pg_catalog.strpos(v_payload, 'cardinality(statements) = 12') = 0 then
    raise exception 'TEST 0283: falta compatibilidad con el split de R14';
  end if;
end
$patched_0274_contract$;

select unnest(statements)
from supabase_migrations.schema_migrations
where version = '${repair.version}'
  and name = '${repair.name}'
\\gexec

select statements[1]
from supabase_migrations.schema_migrations
where version = '${TARGET_VERSION}'
  and name = '${TARGET_NAME}'
\\gexec`;

  let test = replaceOnce(
    baseTest,
    originalInsert,
    splitInsert,
    "fixture ledger calculator_settings",
  );
  test = replaceOnce(test, originalApply, repairApply, "aplicación 0274");
  test = replaceOnce(
    test,
    `${repair.targetSql}\n\ndo $replay_contract$`,
    "do $replay_contract$",
    "DDL calculator_settings duplicado",
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
      ? "0283 sincronizada con su generador determinista"
      : "0283 generada: payload 0274 replay-safe + prueba transaccional",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
