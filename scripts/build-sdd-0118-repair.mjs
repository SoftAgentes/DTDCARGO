import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");

export const MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/0271_repair_branch_replay_history.sql",
);
export const SQL_TEST_PATH = resolve(
  ROOT,
  "supabase/tests/0271_repair_branch_replay_history.test.sql",
);
export const FOLLOWUP_MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/0272_skip_superseded_invite_history.sql",
);
export const FOLLOWUP_SQL_TEST_PATH = resolve(
  ROOT,
  "supabase/tests/0272_skip_superseded_invite_history.test.sql",
);

const SEED_TEAM_INVITATION = String.raw`-- Seed template "team_invitation" por cada tenant existente.
-- Idempotente · on conflict do nothing.
do $$
declare
  v_tenant record;
begin
  for v_tenant in select id from public.tenants loop
    insert into public.mail_templates (
      tenant_id, slug, name, category, channel,
      subject, body_html, variables, lang, active
    ) values (
      v_tenant.id,
      'team_invitation',
      'Invitación al equipo · DTD Studio',
      'interno',
      'email',
      '{{inviter_name}} te invitó a {{tenant_name}} · DTD Studio',
      $html$<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p>Hola,</p>
<p><strong>{{inviter_name}}</strong> te invitó a unirte al equipo de <strong>{{tenant_name}}</strong> en DTD Studio con el rol de <strong>{{role_label}}</strong>.</p>
<p>Aceptá tu invitación y creá tu cuenta:</p>
<p style="margin:20px 0;"><a href="{{invitation_link}}" style="display:inline-block;padding:10px 18px;background:#7F0F1A;color:#fff;text-decoration:none;font:600 14px Archivo,sans-serif;border-radius:6px;">Aceptar invitación &rarr;</a></p>
<p style="color:#6B6B6B;font-size:13px;">El link expira en <strong>{{expires_in_days}}</strong> días. Si no esperabas esta invitación, ignorala &mdash; no se crea ninguna cuenta hasta que la aceptés.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0;">
<p style="color:#6B6B6B;font-size:12px;margin:0;">&iquest;Problemas con el link? Copialo a tu navegador:<br><code style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#7F0F1A;word-break:break-all;">{{invitation_link}}</code></p>
</div>$html$,
      array['inviter_name', 'tenant_name', 'role_label', 'invitation_link', 'expires_in_days']::text[],
      'es',
      true
    )
    on conflict (tenant_id, slug) do nothing;
  end loop;
end $$;`;

const REALTIME_DISPATCH = String.raw`do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dispatch_orders'
  ) then
    alter publication supabase_realtime add table public.dispatch_orders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dispatch_order_packages'
  ) then
    alter publication supabase_realtime add table public.dispatch_order_packages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'warehouse_receipts_cn'
  ) then
    alter publication supabase_realtime add table public.warehouse_receipts_cn;
  end if;
end $$;`;

export const REPAIRS = [
  {
    version: "20260526213130",
    name: "seed_team_invitation_template",
    expectedOldMd5: "e087ed48b2838aca3d1ba061ed7a6ab6",
    oldStatement: SEED_TEAM_INVITATION,
    mode: "prepend",
    sources: ["0018_mailing.sql"],
  },
  {
    version: "20260527073053",
    name: "realtime_dispatch",
    expectedOldMd5: "528cbe1e1d4e39ba597403efbac747d2",
    oldStatement: REALTIME_DISPATCH,
    mode: "prepend",
    sources: ["0024_dispatch_core.sql", "0025_operario_roles_extend.sql"],
  },
  ...[
    ["20260528060005", "0026_welcome_email_template_seed"],
    ["20260528060006", "0027_qr_print_orders"],
    ["20260528060007", "0031_fix_studio_invite_gen_random_bytes"],
    ["20260528060008", "0032_fix_studio_invite_ambiguous_token"],
    ["20260528060009", "0033_grant_service_role_policies"],
    ["20260528060010", "0035_fix_verify_operario_pin_extensions"],
    ["20260528060011", "0036_fk_user_tenants_profile"],
    ["20260528060012", "0037_harden_operario_pin_validator"],
    ["20260528060013", "0039_fix_bug_advance_state_actor_type_cast"],
  ].map(([version, name]) => ({
    version,
    name,
    expectedOldMd5: {
      "20260528060005": "0cfa106867486d74f9ad5ec39fc266d1",
      "20260528060006": "73f96e878683199f797992231e976560",
      "20260528060007": "9e4dc98716f8335c93e9961ccdf18fbe",
      "20260528060008": "accd69afa043efc46960c8de5faa7c34",
      "20260528060009": "7c389fe42d9ea494f340316bd78917cc",
      "20260528060010": "2bde657a6160e36a7c44d7b4d0a31066",
      "20260528060011": "360306612b953b7e385c4e9d3847f5fa",
      "20260528060012": "4119b8a81a6934fad97621cd6570dc21",
      "20260528060013": "22bc70e8f7d216fc1d68e8e8bc3b71fa",
    }[version],
    oldStatement: `-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/${name}.sql.`,
    mode: "replace",
    sources: [`${name}.sql`],
  })),
];

function md5(value) {
  return createHash("md5").update(value).digest("hex");
}

function normalizeSql(value) {
  return value.replace(/\r\n/g, "\n");
}

function sqlLiteral(value, tag) {
  if (value.includes(`$${tag}$`)) {
    throw new Error(`El tag SQL ${tag} colisiona con su contenido`);
  }
  return `$${tag}$${value}$${tag}$`;
}

export async function loadRepairs() {
  return Promise.all(
    REPAIRS.map(async (repair, repairIndex) => {
      if (md5(repair.oldStatement) !== repair.expectedOldMd5) {
        throw new Error(
          `${repair.version} no coincide con el digest remoto esperado`,
        );
      }

      const sources = await Promise.all(
        repair.sources.map(async (file, sourceIndex) => {
          const sql = normalizeSql(
            await readFile(resolve(ROOT, "supabase/migrations", file), "utf8"),
          );
          return {
            file,
            sql,
            md5: md5(sql),
            tag: `sdd0118_${repairIndex}_${sourceIndex}`,
          };
        }),
      );

      return { ...repair, sources };
    }),
  );
}

export function loadFollowups(repairs) {
  return repairs
    .filter((repair) =>
      ["20260528060007", "20260528060008"].includes(repair.version),
    )
    .map((repair) => ({
      version: repair.version,
      name: repair.name,
      sourceSql: repair.sources[0].sql,
      sourceMd5: repair.sources[0].md5,
      targetSql: repair.oldStatement,
      targetMd5: repair.expectedOldMd5,
    }));
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

export function buildMigration(repairs) {
  const preflight = repairs
    .map(
      (repair) => `  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${repair.version}'
      and name = '${repair.name}'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\\n')) = '${repair.expectedOldMd5}'
        )
        or (
          ${currentStatePredicate(repair)}
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en ${repair.version} ${repair.name}';
  end if;`,
    )
    .join("\n\n");

  const updates = repairs
    .map((repair) => {
      const sourceArray = repair.sources
        .map((source) => sqlLiteral(source.sql, source.tag))
        .join(",\n    ");
      const expression =
        repair.mode === "prepend"
          ? `array[\n    ${sourceArray}\n  ] || statements`
          : `array[\n    ${sourceArray}\n  ]`;
      return `update supabase_migrations.schema_migrations
set statements = ${expression}
where version = '${repair.version}'
  and name = '${repair.name}'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\\n')) = '${repair.expectedOldMd5}';`;
    })
    .join("\n\n");

  const postflight = repairs
    .map(
      (repair) => `  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${repair.version}'
      and name = '${repair.name}'
      and ${currentStatePredicate(repair)}
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en ${repair.version} ${repair.name}';
  end if;`,
    )
    .join("\n\n");

  const manifest = repairs
    .flatMap((repair) =>
      repair.sources.map(
        (source) =>
          `-- ${repair.version} <- ${source.file} · md5 ${source.md5}`,
      ),
    )
    .join("\n");

  return `-- SDD-0118 · reparar el replay de branches sin ejecutar DDL de negocio.
-- La migración sólo modifica statements del ledger con precondiciones exactas.
-- Los SQL históricos quedan almacenados como texto para futuros replays.
${manifest}

do $sdd0118_preflight$
begin
${preflight}
end
$sdd0118_preflight$;

${updates}

do $sdd0118_postflight$
begin
${postflight}
end
$sdd0118_postflight$;
`;
}

export function buildSqlTest(repairs) {
  const fixtureRows = repairs
    .map(
      (repair, index) => `  (
    '${repair.version}',
    '${repair.name}',
    array[${sqlLiteral(repair.oldStatement, `sdd0118_old_${index}`)}]
  )`,
    )
    .join(",\n");
  const assertions = repairs
    .map(
      (repair) => `  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${repair.version}'
      and name = '${repair.name}'
      and ${currentStatePredicate(repair)}
  ) then
    raise exception 'TEST 0271: estado incorrecto en ${repair.version}';
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
${fixtureRows};

\\ir ../migrations/0271_repair_branch_replay_history.sql
\\ir ../migrations/0271_repair_branch_replay_history.sql

do $contract$
begin
${assertions}
end
$contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  as sdd_0118_fixture_rolled_back;
`;
}

export function buildFollowupMigration(followups) {
  const preflight = followups
    .map(
      (followup) => `  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${followup.version}'
      and name = '${followup.name}'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('${followup.sourceMd5}', '${followup.targetMd5}')
  ) then
    raise exception 'SDD-0118 follow-up: drift en ${followup.version} ${followup.name}';
  end if;`,
    )
    .join("\n\n");
  const updates = followups
    .map(
      (followup, index) => `update supabase_migrations.schema_migrations
set statements = array[
  ${sqlLiteral(followup.targetSql, `sdd0118_followup_${index}`)}
]
where version = '${followup.version}'
  and name = '${followup.name}'
  and cardinality(statements) = 1
  and md5(statements[1]) = '${followup.sourceMd5}';`,
    )
    .join("\n\n");
  const postflight = followups
    .map(
      (followup) => `  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${followup.version}'
      and name = '${followup.name}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${followup.targetMd5}'
  ) then
    raise exception 'SDD-0118 follow-up: postcondición falló en ${followup.version} ${followup.name}';
  end if;`,
    )
    .join("\n\n");

  return `-- SDD-0118 · omitir dos fixes de invitaciones supersedidos.
-- Sólo restaura comments no-op en el ledger; no ejecuta DDL de negocio.

do $sdd0118_followup_preflight$
begin
${preflight}
end
$sdd0118_followup_preflight$;

${updates}

do $sdd0118_followup_postflight$
begin
${postflight}
end
$sdd0118_followup_postflight$;
`;
}

export function buildFollowupSqlTest(followups) {
  const fixtureRows = followups
    .map(
      (followup, index) => `  (
    '${followup.version}',
    '${followup.name}',
    array[${sqlLiteral(followup.sourceSql, `sdd0118_followup_source_${index}`)}]
  )`,
    )
    .join(",\n");
  const assertions = followups
    .map(
      (followup) => `  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${followup.version}'
      and name = '${followup.name}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${followup.targetMd5}'
  ) then
    raise exception 'TEST 0272: estado incorrecto en ${followup.version}';
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
${fixtureRows};

\\ir ../migrations/0272_skip_superseded_invite_history.sql
\\ir ../migrations/0272_skip_superseded_invite_history.sql

do $contract$
begin
${assertions}
end
$contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  as sdd_0118_followup_fixture_rolled_back;
`;
}

async function run() {
  const repairs = await loadRepairs();
  const migration = buildMigration(repairs);
  const sqlTest = buildSqlTest(repairs);
  const followups = loadFollowups(repairs);
  const followupMigration = buildFollowupMigration(followups);
  const followupSqlTest = buildFollowupSqlTest(followups);
  const checkOnly = process.argv.includes("--check");

  if (checkOnly) {
    const [
      currentMigration,
      currentTest,
      currentFollowupMigration,
      currentFollowupTest,
    ] = await Promise.all([
      readFile(MIGRATION_PATH, "utf8"),
      readFile(SQL_TEST_PATH, "utf8"),
      readFile(FOLLOWUP_MIGRATION_PATH, "utf8"),
      readFile(FOLLOWUP_SQL_TEST_PATH, "utf8"),
    ]);
    if (
      normalizeSql(currentMigration) !== migration ||
      normalizeSql(currentTest) !== sqlTest ||
      normalizeSql(currentFollowupMigration) !== followupMigration ||
      normalizeSql(currentFollowupTest) !== followupSqlTest
    ) {
      throw new Error("Los artefactos generados de SDD-0118 están desactualizados");
    }
    return;
  }

  await Promise.all([
    writeFile(MIGRATION_PATH, migration, "utf8"),
    writeFile(SQL_TEST_PATH, sqlTest, "utf8"),
    writeFile(FOLLOWUP_MIGRATION_PATH, followupMigration, "utf8"),
    writeFile(FOLLOWUP_SQL_TEST_PATH, followupSqlTest, "utf8"),
  ]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
