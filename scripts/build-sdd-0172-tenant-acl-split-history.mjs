import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  ACL_REVOKE_MD5,
  ACL_REVOKE_SQL,
  buildSqlTest as buildTenantAclSqlTest,
  loadInputs as loadTenantAclInputs,
  SOURCE_MD5 as TENANT_TARGET_MD5,
} from "./build-sdd-0172-tenant-acl-history.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");

export const SOURCE_PATH = resolve(
  ROOT,
  "supabase/migrations/0279_restore_tenant_lifecycle_acl_history.sql",
);
export const MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/0286_repair_tenant_acl_split_history.sql",
);
export const SQL_TEST_PATH = resolve(
  ROOT,
  "supabase/tests/0286_repair_tenant_acl_split_history.test.sql",
);

export const TARGET_VERSION = "20260729224850";
export const TARGET_NAME = "0279_restore_tenant_lifecycle_acl_history";
export const SOURCE_MD5 = "5251a9ca8ccbf579c5b81688e63acb01";
export const PATCHED_MD5 = "d67b2e81a67028e56bd994f47ce16f6d";
export const TENANT_VERSION = "20260729053713";
export const TENANT_NAME = "0268_tenant_lifecycle_guardrails";
export const TENANT_SPLIT_COUNT = 10;
export const TENANT_SPLIT_MD5 = "f21fd3848c7a52b0c12c0c215da86c31";
export const TENANT_SPLIT_FINGERPRINTS = [
  "9432784fdac7fdbf5d4bfcb874971a7b",
  "3690da9fdfd94375fbf1ade69e1934c9",
  "56df8bf5be57c4b5628e86e1e37cd630",
  "89a1f366904e1efdf781a7e4fc75086e",
  "9ab4740b93fe9c9dfc123cb498f54f61",
  "001ba2aa51ed551172c511c637392c79",
  "6a8c477dbe7ff2e7f324aa6bdab7c591",
  "9456a948a0a3887eaaf5b090f614ff47",
  "25558c5e2ff79730c8e1545c992d76f0",
  "258212bcf610d19873bccf3b3b5bcec8",
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

function sliceToMarker(source, start, marker) {
  const markerIndex = source.indexOf(marker, start);
  if (markerIndex < 0) {
    throw new Error(`No se encontró el marcador ${marker}`);
  }
  return {
    statement: source.slice(start, markerIndex + marker.length - 1),
    next: markerIndex + marker.length,
  };
}

export function splitTenantTarget(tenantLifecycleSql) {
  const statements = [ACL_REVOKE_SQL.slice(0, -1)];
  let cursor = 0;
  for (const marker of [
    "set lock_timeout = '5s';",
    "set statement_timeout = '30s';",
    "$preflight$;",
    "    not valid;",
    "  validate constraint entity_audit_log_tenant_id_fkey;",
    "revoke delete on table public.tenants from service_role;",
    "$postconditions$;",
    "reset statement_timeout;",
    "reset lock_timeout;",
  ]) {
    while (
      cursor < tenantLifecycleSql.length &&
      /\s/.test(tenantLifecycleSql[cursor])
    ) {
      cursor += 1;
    }
    const sliced = sliceToMarker(tenantLifecycleSql, cursor, marker);
    statements.push(sliced.statement);
    cursor = sliced.next;
  }
  if (tenantLifecycleSql.slice(cursor).trim() !== "") {
    throw new Error("0268 conserva contenido no clasificado después del split");
  }
  if (statements.length !== TENANT_SPLIT_COUNT) {
    throw new Error(
      `El target tenant produjo ${statements.length} statements, se esperaban ${TENANT_SPLIT_COUNT}`,
    );
  }
  const fingerprints = statements.map(md5);
  if (
    fingerprints.some(
      (fingerprint, index) =>
        fingerprint !== TENANT_SPLIT_FINGERPRINTS[index],
    )
  ) {
    throw new Error(
      "Los fingerprints de tenant lifecycle no coinciden con R17",
    );
  }
  if (md5(statements.join("\n")) !== TENANT_SPLIT_MD5) {
    throw new Error("El digest combinado de tenant lifecycle cambió");
  }
  return statements;
}

export function buildPatched0279(originalSql, tenantLifecycleSql) {
  const preflightBefore = `        or (
          cardinality(statements) = 2
          and md5(statements[1]) = '${ACL_REVOKE_MD5}'
          and md5(statements[2]) = '${TENANT_TARGET_MD5}'
        )
      )`;
  const preflightAfter = `        or (
          cardinality(statements) = 2
          and md5(statements[1]) = '${ACL_REVOKE_MD5}'
          and md5(statements[2]) = '${TENANT_TARGET_MD5}'
        )
        or (
          cardinality(statements) = ${TENANT_SPLIT_COUNT}
          and md5(array_to_string(statements, E'\\n')) = '${TENANT_SPLIT_MD5}'
        )
      )`;
  const updateBefore = `set statements = array[
  $sdd0172_tenant_acl_revoke$${ACL_REVOKE_SQL}$sdd0172_tenant_acl_revoke$,
  statements[1]
]
where version = '${TENANT_VERSION}'
  and name = '${TENANT_NAME}'
  and cardinality(statements) = 1
  and md5(statements[1]) = '${TENANT_TARGET_MD5}';`;
  const updateAfter = `set statements = array[
  $sdd0172_tenant_acl_revoke$${ACL_REVOKE_SQL}$sdd0172_tenant_acl_revoke$,
  ${sqlLiteral(tenantLifecycleSql, "sdd0172_tenant_acl_canonical_0268")}
]
where version = '${TENANT_VERSION}'
  and name = '${TENANT_NAME}'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '${TENANT_TARGET_MD5}'
    )
    or (
      cardinality(statements) = ${TENANT_SPLIT_COUNT}
      and md5(array_to_string(statements, E'\\n')) = '${TENANT_SPLIT_MD5}'
    )
  );`;

  let patched = replaceOnce(
    originalSql,
    preflightBefore,
    preflightAfter,
    "preflight tenant ACL",
  );
  patched = replaceOnce(
    patched,
    updateBefore,
    updateAfter,
    "update tenant ACL",
  );
  return patched.replace(
    "-- Sólo antepone al ledger el retiro de DELETE de roles cliente; no ejecuta DDL.\n",
    `-- Sólo repara el estado canónico o el split exacto de R17; no ejecuta DDL.
-- 0286 conserva fail-closed cualquier representación no reconocida.
`,
  );
}

export async function loadInputs() {
  const sourceSql =
    normalizeSql(await readFile(SOURCE_PATH, "utf8")) + "\r\n";
  if (md5(sourceSql) !== SOURCE_MD5) {
    throw new Error("0279 cambió respecto del statement exacto de Producción");
  }
  const { tenantLifecycleSql } = await loadTenantAclInputs();
  const splitStatements = splitTenantTarget(tenantLifecycleSql);
  const patched0279Sql = buildPatched0279(sourceSql, tenantLifecycleSql);
  const patchedMd5 = md5(patched0279Sql);
  if (PATCHED_MD5 !== "__PATCHED_MD5__" && patchedMd5 !== PATCHED_MD5) {
    throw new Error("El payload reparado de 0279 cambió inesperadamente");
  }
  return {
    sourceSql,
    tenantLifecycleSql,
    patched0279Sql,
    patchedMd5,
    splitStatements,
  };
}

export function buildMigration({ patched0279Sql, patchedMd5 }) {
  return `-- SDD-0172 · hacer replay-safe el restaurador histórico del ACL tenant.
-- Sólo sustituye el payload de 0279 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0172_tenant_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('${SOURCE_MD5}', '${patchedMd5}')
  ) then
    raise exception '0286 abortada: ledger 0279 ausente, ambiguo o con drift';
  end if;
end
$sdd0172_tenant_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  ${sqlLiteralWithTerminalCrLf(
    patched0279Sql,
    "sdd0172_tenant_split_patched_0279",
  )}
]
where version = '${TARGET_VERSION}'
  and name = '${TARGET_NAME}'
  and cardinality(statements) = 1
  and md5(statements[1]) = '${SOURCE_MD5}';

do $sdd0172_tenant_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${TARGET_VERSION}'
      and name = '${TARGET_NAME}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${patchedMd5}'
  ) then
    raise exception '0286 abortada: 0279 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0172_tenant_split_postconditions$;
`;
}

export function buildSqlTest({
  sourceSql,
  tenantLifecycleSql,
  patched0279Sql,
  patchedMd5,
  splitStatements,
}) {
  const baseTest = buildTenantAclSqlTest({ tenantLifecycleSql });
  const splitArray = splitStatements
    .map((statement, index) =>
      sqlLiteral(statement, `sdd0172_tenant_split_${index}`),
    )
    .join(",\n    ");
  const originalInsert = `insert into supabase_migrations.schema_migrations (version, name, statements)
values (
  '${TENANT_VERSION}',
  '${TENANT_NAME}',
  array[${sqlLiteral(
    tenantLifecycleSql,
    "sdd0172_tenant_lifecycle_fixture",
  )}]
);`;
  const splitInsert = `insert into supabase_migrations.schema_migrations (version, name, statements)
values
(
  '${TENANT_VERSION}',
  '${TENANT_NAME}',
  array[
    ${splitArray}
  ]
),
(
  '${TARGET_VERSION}',
  '${TARGET_NAME}',
  array[${sqlLiteralWithTerminalCrLf(
    sourceSql,
    "sdd0172_tenant_split_original_0279",
  )}]
);`;
  const originalApply = `\\ir ../migrations/0279_restore_tenant_lifecycle_acl_history.sql
\\ir ../migrations/0279_restore_tenant_lifecycle_acl_history.sql`;
  const repairApply = `\\ir ../migrations/0286_repair_tenant_acl_split_history.sql
\\ir ../migrations/0286_repair_tenant_acl_split_history.sql

do $patched_0279_contract$
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
    patched0279Sql,
    "sdd0172_tenant_split_expected_0279",
  )} then
    raise exception 'TEST 0286: payload 0279 no es byte-idéntico al esperado';
  end if;
  if pg_catalog.strpos(v_payload, '${TENANT_SPLIT_MD5}') = 0
     or pg_catalog.strpos(v_payload, 'cardinality(statements) = ${TENANT_SPLIT_COUNT}') = 0 then
    raise exception 'TEST 0286: falta compatibilidad con el split de R17';
  end if;
end
$patched_0279_contract$;

select statements[1]
from supabase_migrations.schema_migrations
where version = '${TARGET_VERSION}'
  and name = '${TARGET_NAME}'
\\gexec`;

  let test = replaceOnce(
    baseTest,
    originalInsert,
    splitInsert,
    "fixture ledger tenant ACL",
  );
  test = replaceOnce(test, originalApply, repairApply, "aplicación 0279");
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
      ? "0286 sincronizada con su generador determinista"
      : "0286 generada: payload 0279 replay-safe + prueba transaccional",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
