import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");

export const MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/0287_repair_replay_gate_split_history.sql",
);
export const SQL_TEST_PATH = resolve(
  ROOT,
  "supabase/tests/0287_repair_replay_gate_split_history.test.sql",
);

export const REPLAY_GATES = [
  {
    moduleFile: "build-sdd-0118-split-history.mjs",
    repairFile: "0280_repair_sdd0118_split_history.sql",
    repairVersion: "20260730002206",
    repairName: "0280_repair_sdd0118_split_history",
    repairSourceMd5: "0cd59e31c466de0286c5b82091d3db32",
    repairSourceLength: 129597,
    targetSplitCount: 13,
    targetSplitMd5: "47c33a4bde5fde9963bd3a26adeb77bf",
  },
  {
    moduleFile: "build-sdd-0118-invite-skip-split-history.mjs",
    repairFile: "0281_repair_invite_skip_split_history.sql",
    repairVersion: "20260730011643",
    repairName: "0281_repair_invite_skip_split_history",
    repairSourceMd5: "08ffa846d67496336012a46029848d1a",
    repairSourceLength: 4526,
    targetSplitCount: 4,
    targetSplitMd5: "46339fd905e6b1a9ac3eafd55cdb620b",
  },
  {
    moduleFile: "build-sdd-0118-platform-admin-split-history.mjs",
    repairFile: "0282_repair_platform_admin_skip_split_history.sql",
    repairVersion: "20260730130403",
    repairName: "0282_repair_platform_admin_skip_split_history",
    repairSourceMd5: "5525c9ef4374d967e99d8886d4ec9532",
    repairSourceLength: 6284,
    targetSplitCount: 3,
    targetSplitMd5: "92a91df672663aadb5d5b5fc5e72e654",
  },
  {
    moduleFile: "build-sdd-0118-calculator-split-history.mjs",
    repairFile: "0283_repair_calculator_settings_split_history.sql",
    repairVersion: "20260730132651",
    repairName: "0283_repair_calculator_settings_split_history",
    repairSourceMd5: "6614a85c247cf6ead23573f7a8cb2514",
    repairSourceLength: 9985,
    targetSplitCount: 3,
    targetSplitMd5: "672e8f2ed1df04f9f8b4de50f2295c50",
  },
  {
    moduleFile: "build-sdd-0118-pin-split-history.mjs",
    repairFile: "0284_repair_pin_search_path_split_history.sql",
    repairVersion: "20260730160209",
    repairName: "0284_repair_pin_search_path_split_history",
    repairSourceMd5: "ca7f9d149eeb6eff924cb6d813094fef",
    repairSourceLength: 6919,
    targetSplitCount: 3,
    targetSplitMd5: "274402248472f4f666801aa8130b0c47",
  },
  {
    moduleFile: "build-sdd-0118-revoke-split-history.mjs",
    repairFile: "0285_repair_revoke_anon_split_history.sql",
    repairVersion: "20260730160939",
    repairName: "0285_repair_revoke_anon_split_history",
    repairSourceMd5: "db953b1adc8f6dcad4bd040b59c461d7",
    repairSourceLength: 15694,
    targetSplitCount: 3,
    targetSplitMd5: "08a15b51481cff3f5c62ebdd3df96fca",
  },
  {
    moduleFile: "build-sdd-0172-tenant-acl-split-history.mjs",
    repairFile: "0286_repair_tenant_acl_split_history.sql",
    repairVersion: "20260730161446",
    repairName: "0286_repair_tenant_acl_split_history",
    repairSourceMd5: "5d42c84f8fb245ea9514ee80cab24a39",
    repairSourceLength: 7803,
    targetSplitCount: 3,
    targetSplitMd5: "11c2a3aabeb58020c4c3f5847f556594",
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

function replaceLast(source, before, after, label) {
  const index = source.lastIndexOf(before);
  if (index < 0) {
    throw new Error(`${label}: no se encontró el bloque fuente`);
  }
  return source.slice(0, index) + after + source.slice(index + before.length);
}

export function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let index = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let blockCommentDepth = 0;
  let dollarTag = null;

  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];

    if (inLineComment) {
      current += char;
      index += 1;
      if (char === "\n") inLineComment = false;
      continue;
    }

    if (blockCommentDepth > 0) {
      current += char;
      if (char === "/" && next === "*") {
        current += next;
        index += 2;
        blockCommentDepth += 1;
        continue;
      }
      if (char === "*" && next === "/") {
        current += next;
        index += 2;
        blockCommentDepth -= 1;
        continue;
      }
      index += 1;
      continue;
    }

    if (dollarTag) {
      if (sql.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length;
        dollarTag = null;
      } else {
        current += char;
        index += 1;
      }
      continue;
    }

    if (inSingleQuote) {
      current += char;
      index += 1;
      if (char === "'") {
        if (sql[index] === "'") {
          current += "'";
          index += 1;
        } else {
          inSingleQuote = false;
        }
      }
      continue;
    }

    if (inDoubleQuote) {
      current += char;
      index += 1;
      if (char === '"') {
        if (sql[index] === '"') {
          current += '"';
          index += 1;
        } else {
          inDoubleQuote = false;
        }
      }
      continue;
    }

    if (char === "-" && next === "-") {
      current += char + next;
      index += 2;
      inLineComment = true;
      continue;
    }
    if (char === "/" && next === "*") {
      current += char + next;
      index += 2;
      blockCommentDepth = 1;
      continue;
    }
    if (char === "'") {
      current += char;
      index += 1;
      inSingleQuote = true;
      continue;
    }
    if (char === '"') {
      current += char;
      index += 1;
      inDoubleQuote = true;
      continue;
    }
    if (char === "$") {
      const match = sql
        .slice(index)
        .match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        index += dollarTag.length;
        continue;
      }
    }
    if (char === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  if (
    inSingleQuote ||
    inDoubleQuote ||
    inLineComment ||
    blockCommentDepth > 0 ||
    dollarTag
  ) {
    if (inLineComment && !inSingleQuote && !inDoubleQuote && !dollarTag) {
      inLineComment = false;
    } else {
      throw new Error("El payload SQL terminó dentro de un literal o comentario");
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

export function patchReplayGate(sourceSql, gate) {
  const preflightBefore = `      and cardinality(statements) = 1
      and md5(statements[1]) in ('${gate.targetSourceMd5}', '${gate.targetPatchedMd5}')`;
  const preflightAfter = `      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('${gate.targetSourceMd5}', '${gate.targetPatchedMd5}')
        )
        or (
          cardinality(statements) = ${gate.targetSplitCount}
          and md5(array_to_string(statements, E'\\n')) = '${gate.targetSplitMd5}'
        )
      )`;
  const updateBefore = `where version = '${gate.targetVersion}'
  and name = '${gate.targetName}'
  and cardinality(statements) = 1
  and md5(statements[1]) = '${gate.targetSourceMd5}';`;
  const updateAfter = `where version = '${gate.targetVersion}'
  and name = '${gate.targetName}'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '${gate.targetSourceMd5}'
    )
    or (
      cardinality(statements) = ${gate.targetSplitCount}
      and md5(array_to_string(statements, E'\\n')) = '${gate.targetSplitMd5}'
    )
  );`;

  let patched = replaceFirst(
    sourceSql,
    preflightBefore,
    preflightAfter,
    `preflight ${gate.repairName}`,
  );
  patched = replaceLast(
    patched,
    updateBefore,
    updateAfter,
    `update ${gate.repairName}`,
  );
  return patched;
}

export async function loadInputs() {
  const gates = [];

  for (const config of REPLAY_GATES) {
    const repairModule = await import(
      pathToFileURL(resolve(SCRIPT_DIR, config.moduleFile)).href
    );
    const moduleInputs = await repairModule.loadInputs();
    const targetPayloadKey = Object.keys(moduleInputs).find((key) =>
      /^patched\d+Sql$/.test(key),
    );
    if (!targetPayloadKey) {
      throw new Error(`${config.moduleFile}: falta el payload target reparado`);
    }
    const targetPatchedSql = moduleInputs[targetPayloadKey];
    const targetSplitStatements = splitSqlStatements(targetPatchedSql);
    if (
      targetSplitStatements.length !== config.targetSplitCount ||
      md5(targetSplitStatements.join("\n")) !== config.targetSplitMd5
    ) {
      throw new Error(
        `${config.repairName}: el split reconstruido no coincide con R18`,
      );
    }

    const repairPath = resolve(ROOT, "supabase/migrations", config.repairFile);
    const repairSourceSql = `${await readFile(repairPath, "utf8")}\r\n`;
    if (
      repairSourceSql.length !== config.repairSourceLength ||
      md5(repairSourceSql) !== config.repairSourceMd5
    ) {
      throw new Error(
        `${config.repairName}: el payload local no coincide con Producción`,
      );
    }

    const gate = {
      ...config,
      targetVersion: repairModule.TARGET_VERSION,
      targetName: repairModule.TARGET_NAME,
      targetSourceMd5: repairModule.SOURCE_MD5,
      targetPatchedMd5: repairModule.PATCHED_MD5,
      targetPatchedSql,
      targetSplitStatements,
      repairSourceSql,
    };
    const repairPatchedSql = patchReplayGate(repairSourceSql, gate);
    gates.push({
      ...gate,
      repairPatchedSql,
      repairPatchedMd5: md5(repairPatchedSql),
    });
  }

  return { gates };
}

export function buildMigration({ gates }) {
  const preflights = gates
    .map(
      (gate) => `  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${gate.repairVersion}'
      and name = '${gate.repairName}'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('${gate.repairSourceMd5}', '${gate.repairPatchedMd5}')
  ) then
    raise exception '0287 abortada: ${gate.repairName} ausente, ambiguo o con drift';
  end if;`,
    )
    .join("\n\n");
  const updates = gates
    .map(
      (gate, index) => `update supabase_migrations.schema_migrations
set statements = array[
  ${sqlLiteral(gate.repairPatchedSql, `sdd0118_replay_gate_${index}`)}
]
where version = '${gate.repairVersion}'
  and name = '${gate.repairName}'
  and cardinality(statements) = 1
  and md5(statements[1]) = '${gate.repairSourceMd5}';`,
    )
    .join("\n\n");
  const postconditions = gates
    .map(
      (gate) => `  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${gate.repairVersion}'
      and name = '${gate.repairName}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${gate.repairPatchedMd5}'
  ) then
    raise exception '0287 abortada: ${gate.repairName} no quedó en el estado objetivo';
  end if;`,
    )
    .join("\n\n");

  return `-- SDD-0118/SDD-0172 · hacer replay-safe los gates 0280–0286.
-- Sólo sustituye payloads del ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_replay_gates_preflight$
begin
${preflights}
end
$sdd0118_replay_gates_preflight$;

${updates}

do $sdd0118_replay_gates_postconditions$
begin
${postconditions}
end
$sdd0118_replay_gates_postconditions$;
`;
}

export function buildSqlTest({ gates }) {
  const targetRows = gates
    .map((gate, gateIndex) => {
      const statements = gate.targetSplitStatements
        .map((statement, statementIndex) =>
          sqlLiteral(
            statement,
            `sdd0118_replay_target_${gateIndex}_${statementIndex}`,
          ),
        )
        .join(",\n    ");
      return `(
  '${gate.targetVersion}',
  '${gate.targetName}',
  array[
    ${statements}
  ]
)`;
    })
    .join(",\n");
  const repairRows = gates
    .map(
      (gate, index) => `(
  '${gate.repairVersion}',
  '${gate.repairName}',
  array[${sqlLiteral(gate.repairSourceSql, `sdd0118_replay_source_${index}`)}]
)`,
    )
    .join(",\n");
  const patchedRepairAssertions = gates
    .map(
      (gate) => `  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${gate.repairVersion}'
      and name = '${gate.repairName}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${gate.repairPatchedMd5}'
  ) then
    raise exception 'TEST 0287: ${gate.repairName} no fue reparada';
  end if;`,
    )
    .join("\n\n");
  const executeRepairs = gates
    .map(
      (gate) => `select statements[1]
from supabase_migrations.schema_migrations
where version = '${gate.repairVersion}'
  and name = '${gate.repairName}'
\\gexec`,
    )
    .join("\n\n");
  const targetAssertions = gates
    .map(
      (gate) => `  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${gate.targetVersion}'
      and name = '${gate.targetName}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${gate.targetPatchedMd5}'
  ) then
    raise exception 'TEST 0287: ${gate.targetName} no colapsó al payload canónico';
  end if;`,
    )
    .join("\n\n");

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
${targetRows},
${repairRows};

\\ir ../migrations/0287_repair_replay_gate_split_history.sql
\\ir ../migrations/0287_repair_replay_gate_split_history.sql

do $patched_repair_contracts$
begin
${patchedRepairAssertions}
end
$patched_repair_contracts$;

${executeRepairs}

do $target_contracts$
begin
${targetAssertions}
end
$target_contracts$;

rollback;

select to_regnamespace('supabase_migrations') is null
  as sdd_0118_replay_gate_fixture_rolled_back;
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

  if (process.argv.includes("--print-patched-md5")) {
    for (const gate of inputs.gates) {
      console.log(`${gate.repairName} ${gate.repairPatchedMd5}`);
    }
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
