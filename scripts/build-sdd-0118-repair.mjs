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
export const PLATFORM_ADMIN_MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/0273_skip_platform_admin_bootstrap_history.sql",
);
export const PLATFORM_ADMIN_SQL_TEST_PATH = resolve(
  ROOT,
  "supabase/tests/0273_skip_platform_admin_bootstrap_history.test.sql",
);
export const CALCULATOR_SETTINGS_MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/0274_restore_calculator_settings_history.sql",
);
export const CALCULATOR_SETTINGS_SQL_TEST_PATH = resolve(
  ROOT,
  "supabase/tests/0274_restore_calculator_settings_history.test.sql",
);
export const PIN_SEARCH_PATH_MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/0275_restore_pin_search_path_history.sql",
);
export const PIN_SEARCH_PATH_SQL_TEST_PATH = resolve(
  ROOT,
  "supabase/tests/0275_restore_pin_search_path_history.test.sql",
);
export const REVOKE_ANON_SWEEP_MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/0276_restore_revoke_anon_rpc_sweep_history.sql",
);
export const REVOKE_ANON_SWEEP_SQL_TEST_PATH = resolve(
  ROOT,
  "supabase/tests/0276_restore_revoke_anon_rpc_sweep_history.test.sql",
);

const PLATFORM_ADMIN_SOURCE_PATH = resolve(
  ROOT,
  "supabase/migrations/0058_platform_admins.sql",
);
const PLATFORM_ADMIN_SEED_MARKER =
  "-- ─── Seed: primer platform_admin ─────────────────────────────";
const PLATFORM_ADMIN_REPLAY_NOTE = `-- Replay-safe: el bootstrap de datos se omite intencionalmente.
-- La membresía platform_admin se provisiona fuera del replay del schema.
`;
const PLATFORM_ADMIN_SOURCE_MD5 = "bb99b54106d671457836daa0dc53b839";
const PLATFORM_ADMIN_REMOTE_MD5 = "6c31b8ac8841b24815e3fb2463eabdd2";
const PLATFORM_ADMIN_TARGET_MD5 = "cb374d4ad4c3b2bb62915e80a5a13793";
const CALCULATOR_SETTINGS_SOURCE_PATH = resolve(
  ROOT,
  "supabase/migrations/0103_calculator_settings.sql",
);
const CALCULATOR_SETTINGS_TARGET_MD5 = "0f7deee22e3a978c52159b6fc211ee2c";
const PIN_SEARCH_PATH_SOURCE_PATH = resolve(
  ROOT,
  "supabase/migrations/0210_pin_search_path_triggers.sql",
);
const PIN_SEARCH_PATH_TARGET_MD5 = "c3131d8ea3756049d6455bc98b4d0ecc";
const REVOKE_ANON_SWEEP_SOURCE_PATH = resolve(
  ROOT,
  "supabase/migrations/0209_revoke_anon_rpc_sweep.sql",
);
const REVOKE_ANON_SWEEP_TARGET_MD5 = "c6c722efdb7ff79ef037e0d826739205";

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

export async function loadPlatformAdminRepair() {
  const sourceSql = normalizeSql(
    await readFile(PLATFORM_ADMIN_SOURCE_PATH, "utf8"),
  );
  const markerMatches = sourceSql.split(PLATFORM_ADMIN_SEED_MARKER).length - 1;
  if (markerMatches !== 1) {
    throw new Error(
      `0058_platform_admins.sql debe contener un solo marcador de bootstrap; encontrados ${markerMatches}`,
    );
  }
  if (md5(sourceSql) !== PLATFORM_ADMIN_SOURCE_MD5) {
    throw new Error(
      "0058_platform_admins.sql no coincide con el digest canónico esperado",
    );
  }

  const targetSql = `${sourceSql
    .slice(0, sourceSql.indexOf(PLATFORM_ADMIN_SEED_MARKER))
    .trimEnd()}\n\n${PLATFORM_ADMIN_REPLAY_NOTE}`;
  if (md5(targetSql) !== PLATFORM_ADMIN_TARGET_MD5) {
    throw new Error(
      "El payload replay-safe de platform_admins cambió sin actualizar su contrato",
    );
  }

  return {
    version: "20260529071707",
    name: "platform_admins",
    sourceSql,
    sourceMd5: PLATFORM_ADMIN_SOURCE_MD5,
    remoteMd5: PLATFORM_ADMIN_REMOTE_MD5,
    targetSql,
    targetMd5: PLATFORM_ADMIN_TARGET_MD5,
  };
}

export function buildPlatformAdminMigration(repair) {
  return `-- SDD-0118 · omitir del replay el bootstrap fijo de platform_admins.
-- Conserva el DDL canónico y sólo modifica el statement técnico del ledger.

do $sdd0118_platform_admin_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${repair.version}'
      and name = '${repair.name}'
      and cardinality(statements) = 1
      and md5(statements[1]) in (
        '${repair.remoteMd5}',
        '${repair.sourceMd5}',
        '${repair.targetMd5}'
      )
  ) then
    raise exception 'SDD-0118 platform_admins: drift en ${repair.version} ${repair.name}';
  end if;
end
$sdd0118_platform_admin_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  ${sqlLiteral(repair.targetSql, "sdd0118_platform_admin_target")}
]
where version = '${repair.version}'
  and name = '${repair.name}'
  and cardinality(statements) = 1
  and md5(statements[1]) in ('${repair.remoteMd5}', '${repair.sourceMd5}');

do $sdd0118_platform_admin_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${repair.version}'
      and name = '${repair.name}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${repair.targetMd5}'
  ) then
    raise exception 'SDD-0118 platform_admins: postcondición falló en ${repair.version} ${repair.name}';
  end if;
end
$sdd0118_platform_admin_postflight$;
`;
}

export function buildPlatformAdminSqlTest(repair) {
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
values (
  '${repair.version}',
  '${repair.name}',
  array[${sqlLiteral(repair.sourceSql, "sdd0118_platform_admin_source")}]
);

\\ir ../migrations/0273_skip_platform_admin_bootstrap_history.sql
\\ir ../migrations/0273_skip_platform_admin_bootstrap_history.sql

do $ledger_contract$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${repair.version}'
      and name = '${repair.name}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${repair.targetMd5}'
  ) then
    raise exception 'TEST 0273: estado final incorrecto en ${repair.version}';
  end if;
end
$ledger_contract$;

${repair.targetSql}

do $replay_contract$
begin
  if to_regclass('public.platform_admins') is null then
    raise exception 'TEST 0273: falta public.platform_admins';
  end if;
  if exists (select 1 from public.platform_admins) then
    raise exception 'TEST 0273: el replay creó un platform_admin';
  end if;
  if not exists (
    select 1
    from pg_constraint c
    join pg_class source_table on source_table.oid = c.conrelid
    join pg_class target_table on target_table.oid = c.confrelid
    join pg_namespace target_schema on target_schema.oid = target_table.relnamespace
    where c.contype = 'f'
      and source_table.relname = 'platform_admins'
      and c.conname = 'platform_admins_user_id_fkey'
      and target_schema.nspname = 'auth'
      and target_table.relname = 'users'
      and c.confdeltype = 'c'
  ) then
    raise exception 'TEST 0273: FK platform_admins_user_id_fkey incorrecta';
  end if;
  if not coalesce((
    select relrowsecurity
    from pg_class
    where oid = 'public.platform_admins'::regclass
  ), false) then
    raise exception 'TEST 0273: RLS no está habilitado';
  end if;
  if (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_admins'
      and policyname in (
        'platform_admins_self_select',
        'service_role_all_platform_admins'
      )
  ) <> 2 then
    raise exception 'TEST 0273: policies incompletas';
  end if;
  if not has_table_privilege(
    'authenticated',
    'public.platform_admins',
    'SELECT'
  ) then
    raise exception 'TEST 0273: falta SELECT de authenticated';
  end if;
  if not has_table_privilege(
    'service_role',
    'public.platform_admins',
    'SELECT, INSERT, UPDATE, DELETE'
  ) then
    raise exception 'TEST 0273: grants de service_role incompletos';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.is_platform_admin()',
    'EXECUTE'
  ) then
    raise exception 'TEST 0273: falta EXECUTE de authenticated';
  end if;
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_platform_admin'
      and p.prosecdef
      and p.proconfig @> array['search_path=public']
  ) then
    raise exception 'TEST 0273: is_platform_admin no conserva hardening';
  end if;
end
$replay_contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  and to_regnamespace('auth') is null
  and to_regclass('public.platform_admins') is null
  as sdd_0118_platform_admin_fixture_rolled_back;
`;
}

export async function loadCalculatorSettingsRepair() {
  const targetSql = normalizeSql(
    await readFile(CALCULATOR_SETTINGS_SOURCE_PATH, "utf8"),
  );
  if (md5(targetSql) !== CALCULATOR_SETTINGS_TARGET_MD5) {
    throw new Error(
      "0103_calculator_settings.sql no coincide con el digest canónico esperado",
    );
  }

  return {
    version: "20260604131310",
    name: "0103_calculator_settings",
    targetSql,
    targetMd5: CALCULATOR_SETTINGS_TARGET_MD5,
  };
}

export function buildCalculatorSettingsMigration(repair) {
  return `-- SDD-0118 · restaurar el payload reproducible de calculator_settings.
-- Sólo reemplaza statements NULL del ledger; no ejecuta el DDL almacenado.

do $sdd0118_calculator_settings_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${repair.version}'
      and name = '${repair.name}'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '${repair.targetMd5}'
        )
      )
  ) then
    raise exception 'SDD-0118 calculator_settings: drift en ${repair.version} ${repair.name}';
  end if;
end
$sdd0118_calculator_settings_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  ${sqlLiteral(repair.targetSql, "sdd0118_calculator_settings_target")}
]
where version = '${repair.version}'
  and name = '${repair.name}'
  and statements is null;

do $sdd0118_calculator_settings_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${repair.version}'
      and name = '${repair.name}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${repair.targetMd5}'
  ) then
    raise exception 'SDD-0118 calculator_settings: postcondición falló en ${repair.version} ${repair.name}';
  end if;
end
$sdd0118_calculator_settings_postflight$;
`;
}

export function buildCalculatorSettingsSqlTest(repair) {
  return `\\set ON_ERROR_STOP on

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$roles$;

create schema auth;
create table auth.users (id uuid primary key);

create table public.tenants (
  id uuid primary key,
  slug text not null unique
);

create function public.get_user_tenant_id()
returns uuid
language sql
stable
as $$
  select null::uuid
$$;

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

insert into public.tenants (id, slug)
values ('10000000-0000-4000-8000-000000000103', 'dtd');

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  statements text[]
);

insert into supabase_migrations.schema_migrations (version, name, statements)
values ('${repair.version}', '${repair.name}', null);

\\ir ../migrations/0274_restore_calculator_settings_history.sql
\\ir ../migrations/0274_restore_calculator_settings_history.sql

do $ledger_contract$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${repair.version}'
      and name = '${repair.name}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${repair.targetMd5}'
  ) then
    raise exception 'TEST 0274: estado final incorrecto en ${repair.version}';
  end if;
end
$ledger_contract$;

${repair.targetSql}

do $replay_contract$
declare
  v_config record;
begin
  if to_regclass('public.calculator_settings') is null then
    raise exception 'TEST 0274: falta public.calculator_settings';
  end if;
  if (
    select count(*)
    from public.calculator_settings cs
    join public.tenants t on t.id = cs.tenant_id
    where t.slug = 'dtd'
      and cs.peso_incluido_kg = 500
      and cs.peso_max_kg = 600
      and cs.recargo_excedente_kg = 1
      and cs.descuento_valencia = 50
      and cs.recargo_embalaje_especial = 50
      and cs.recargo_bateria_mult = 1.5
      and cs.threshold_casco_km = 200
      and cs.tarifa_km_fuera_casco = 1
  ) <> 1 then
    raise exception 'TEST 0274: seed default incorrecto';
  end if;
  if not exists (
    select 1
    from pg_constraint c
    join pg_class source_table on source_table.oid = c.conrelid
    join pg_class target_table on target_table.oid = c.confrelid
    join pg_namespace target_schema on target_schema.oid = target_table.relnamespace
    where c.contype = 'f'
      and source_table.relname = 'calculator_settings'
      and target_schema.nspname = 'public'
      and target_table.relname = 'tenants'
      and c.confdeltype = 'c'
  ) then
    raise exception 'TEST 0274: FK tenant no conserva CASCADE';
  end if;
  if not exists (
    select 1
    from pg_constraint c
    join pg_class source_table on source_table.oid = c.conrelid
    join pg_class target_table on target_table.oid = c.confrelid
    join pg_namespace target_schema on target_schema.oid = target_table.relnamespace
    where c.contype = 'f'
      and source_table.relname = 'calculator_settings'
      and target_schema.nspname = 'auth'
      and target_table.relname = 'users'
  ) then
    raise exception 'TEST 0274: FK updated_by hacia auth.users ausente';
  end if;
  if not coalesce((
    select relrowsecurity
    from pg_class
    where oid = 'public.calculator_settings'::regclass
  ), false) then
    raise exception 'TEST 0274: RLS no está habilitado';
  end if;
  if (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'calculator_settings'
      and policyname = 'calculator_settings by tenant'
      and cmd = 'ALL'
  ) <> 1 then
    raise exception 'TEST 0274: policy tenant incompleta';
  end if;
  if not has_table_privilege(
    'authenticated',
    'public.calculator_settings',
    'SELECT, INSERT, UPDATE'
  ) or has_table_privilege(
    'authenticated',
    'public.calculator_settings',
    'DELETE'
  ) then
    raise exception 'TEST 0274: grants de tabla incorrectos';
  end if;
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.calculator_settings'::regclass
      and tgname = 'calculator_settings_touch'
      and tgenabled = 'O'
      and not tgisinternal
  ) then
    raise exception 'TEST 0274: trigger updated_at ausente';
  end if;
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'public_calculator_config'
      and p.prosecdef
      and p.provolatile = 's'
      and p.proconfig @> array['search_path=public']
  ) then
    raise exception 'TEST 0274: RPC no conserva hardening';
  end if;
  if not has_function_privilege(
    'anon',
    'public.public_calculator_config()',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.public_calculator_config()',
    'EXECUTE'
  ) then
    raise exception 'TEST 0274: grants de RPC incompletos';
  end if;
  if exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) acl
    where p.oid = 'public.public_calculator_config()'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0274: PUBLIC conserva EXECUTE';
  end if;

  select * into v_config from public.public_calculator_config();
  if v_config.peso_incluido_kg <> 500
    or v_config.peso_max_kg <> 600
    or v_config.recargo_excedente_kg <> 1
    or v_config.descuento_valencia <> 50
    or v_config.recargo_embalaje_especial <> 50
    or v_config.recargo_bateria_mult <> 1.5
    or v_config.threshold_casco_km <> 200
    or v_config.tarifa_km_fuera_casco <> 1
  then
    raise exception 'TEST 0274: retorno RPC incorrecto';
  end if;
end
$replay_contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  and to_regnamespace('auth') is null
  and to_regclass('public.calculator_settings') is null
  as sdd_0118_calculator_settings_fixture_rolled_back;
`;
}

export async function loadPinSearchPathRepair() {
  const targetSql = normalizeSql(
    await readFile(PIN_SEARCH_PATH_SOURCE_PATH, "utf8"),
  );
  if (md5(targetSql) !== PIN_SEARCH_PATH_TARGET_MD5) {
    throw new Error(
      "0210_pin_search_path_triggers.sql no coincide con el digest canónico esperado",
    );
  }

  const targets = Array.from(
    targetSql.matchAll(
      /^alter function public\.([a-z0-9_]+)\(([^)]*)\) set search_path = public;$/gm,
    ),
    ([statement, name, argumentsSql]) => ({
      statement,
      name,
      argumentsSql,
      identity: `public.${name}(${argumentsSql})`,
      regprocedure: `public.${name}(${
        argumentsSql === "p_pin text" ? "text" : argumentsSql
      })`,
    }),
  );
  if (targets.length !== 33) {
    throw new Error(
      `0210_pin_search_path_triggers.sql debe contener 33 ALTER FUNCTION; encontrados ${targets.length}`,
    );
  }
  if (new Set(targets.map((target) => target.identity)).size !== targets.length) {
    throw new Error(
      "0210_pin_search_path_triggers.sql contiene firmas duplicadas",
    );
  }
  if (
    targets.filter((target) => target.argumentsSql !== "").length !== 1 ||
    !targets.some(
      (target) =>
        target.identity ===
        "public.validate_operario_pin_format(p_pin text)",
    )
  ) {
    throw new Error(
      "0210_pin_search_path_triggers.sql cambió su contrato de firmas",
    );
  }

  return {
    version: "20260703235255",
    name: "0210_pin_search_path_triggers",
    targetSql,
    targetMd5: PIN_SEARCH_PATH_TARGET_MD5,
    targets,
  };
}

export function buildPinSearchPathMigration(repair) {
  return `-- SDD-0118 · restaurar el payload reproducible del pin de search_path.
-- Sólo reemplaza statements NULL del ledger; no ejecuta los ALTER almacenados.

do $sdd0118_pin_search_path_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${repair.version}'
      and name = '${repair.name}'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '${repair.targetMd5}'
        )
      )
  ) then
    raise exception 'SDD-0118 pin_search_path: drift en ${repair.version} ${repair.name}';
  end if;
end
$sdd0118_pin_search_path_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  ${sqlLiteral(repair.targetSql, "sdd0118_pin_search_path_target")}
]
where version = '${repair.version}'
  and name = '${repair.name}'
  and statements is null;

do $sdd0118_pin_search_path_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${repair.version}'
      and name = '${repair.name}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${repair.targetMd5}'
  ) then
    raise exception 'SDD-0118 pin_search_path: postcondición falló en ${repair.version} ${repair.name}';
  end if;
end
$sdd0118_pin_search_path_postflight$;
`;
}

export function buildPinSearchPathSqlTest(repair) {
  const functionFixtures = repair.targets
    .map((target) => {
      if (target.argumentsSql === "") {
        return `create function public.${target.name}()
returns trigger
language plpgsql
as $$
begin
  return new;
end
$$;`;
      }
      return `create function public.${target.name}(${target.argumentsSql})
returns boolean
language sql
as $$
  select true
$$;`;
    })
    .join("\n\n");
  const replayAssertions = repair.targets
    .map(
      (target) => `  if not exists (
    select 1
    from pg_proc
    where oid = '${target.regprocedure}'::regprocedure
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'TEST 0275: falta pin en ${target.identity}';
  end if;`,
    )
    .join("\n\n");

  return `\\set ON_ERROR_STOP on

begin;

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  statements text[]
);

insert into supabase_migrations.schema_migrations (version, name, statements)
values ('${repair.version}', '${repair.name}', null);

\\ir ../migrations/0275_restore_pin_search_path_history.sql
\\ir ../migrations/0275_restore_pin_search_path_history.sql

do $ledger_contract$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${repair.version}'
      and name = '${repair.name}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${repair.targetMd5}'
  ) then
    raise exception 'TEST 0275: estado final incorrecto en ${repair.version}';
  end if;
  if to_regprocedure('public.comments_freeze_immutable()') is not null then
    raise exception 'TEST 0275: la migración ejecutó el payload almacenado';
  end if;
end
$ledger_contract$;

${functionFixtures}

${repair.targetSql}

do $replay_contract$
begin
${replayAssertions}
end
$replay_contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  and to_regprocedure('public.comments_freeze_immutable()') is null
  as sdd_0118_pin_search_path_fixture_rolled_back;
`;
}

function signatureArgumentTypes(argumentsSql) {
  if (argumentsSql === "") {
    return "";
  }
  return argumentsSql
    .split(",")
    .map((argument) => argument.trim().replace(/^[a-z0-9_]+\s+/, ""))
    .join(", ");
}

export async function loadRevokeAnonSweepRepair() {
  const targetSql = normalizeSql(
    await readFile(REVOKE_ANON_SWEEP_SOURCE_PATH, "utf8"),
  );
  if (md5(targetSql) !== REVOKE_ANON_SWEEP_TARGET_MD5) {
    throw new Error(
      "0209_revoke_anon_rpc_sweep.sql no coincide con el digest canónico esperado",
    );
  }

  const revokePattern =
    /^revoke execute on function public\.([a-z0-9_]+)\(([^)]*)\) from public, anon;$/gm;
  const grantPattern =
    /^grant execute on function public\.([a-z0-9_]+)\(([^)]*)\) to authenticated, service_role;$/gm;
  const revokes = Array.from(
    targetSql.matchAll(revokePattern),
    ([statement, name, argumentsSql]) => ({
      statement,
      name,
      argumentsSql,
      identity: `public.${name}(${argumentsSql})`,
      regprocedure: `public.${name}(${signatureArgumentTypes(argumentsSql)})`,
    }),
  );
  const grants = Array.from(
    targetSql.matchAll(grantPattern),
    ([statement, name, argumentsSql]) => ({
      statement,
      identity: `public.${name}(${argumentsSql})`,
    }),
  );

  if (revokes.length !== 48 || grants.length !== 48) {
    throw new Error(
      `0209_revoke_anon_rpc_sweep.sql debe contener 48 pares ACL; encontrados ${revokes.length}/${grants.length}`,
    );
  }
  if (new Set(revokes.map((target) => target.identity)).size !== 48) {
    throw new Error(
      "0209_revoke_anon_rpc_sweep.sql contiene firmas duplicadas",
    );
  }
  if (
    revokes.some(
      (target, index) => target.identity !== grants[index]?.identity,
    )
  ) {
    throw new Error(
      "0209_revoke_anon_rpc_sweep.sql cambió el orden o emparejamiento REVOKE/GRANT",
    );
  }
  if (
    !revokes.some(
      (target) => target.identity === "public.comment_mentions_validate()",
    )
  ) {
    throw new Error(
      "0209_revoke_anon_rpc_sweep.sql perdió comment_mentions_validate()",
    );
  }

  return {
    version: "20260703234254",
    name: "0209_revoke_anon_rpc_sweep",
    targetSql,
    targetMd5: REVOKE_ANON_SWEEP_TARGET_MD5,
    targets: revokes,
  };
}

export function buildRevokeAnonSweepMigration(repair) {
  return `-- SDD-0118 · restaurar el payload reproducible del sweep ACL de RPCs.
-- Sólo reemplaza statements NULL del ledger; no ejecuta los REVOKE/GRANT almacenados.

do $sdd0118_revoke_anon_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${repair.version}'
      and name = '${repair.name}'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '${repair.targetMd5}'
        )
      )
  ) then
    raise exception 'SDD-0118 revoke_anon: drift en ${repair.version} ${repair.name}';
  end if;
end
$sdd0118_revoke_anon_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  ${sqlLiteral(repair.targetSql, "sdd0118_revoke_anon_target")}
]
where version = '${repair.version}'
  and name = '${repair.name}'
  and statements is null;

do $sdd0118_revoke_anon_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${repair.version}'
      and name = '${repair.name}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${repair.targetMd5}'
  ) then
    raise exception 'SDD-0118 revoke_anon: postcondición falló en ${repair.version} ${repair.name}';
  end if;
end
$sdd0118_revoke_anon_postflight$;
`;
}

export function buildRevokeAnonSweepSqlTest(repair) {
  const functionFixtures = repair.targets
    .map(
      (target) => `create function public.${target.name}(${target.argumentsSql})
returns boolean
language sql
as $fixture$
  select true
$fixture$;

grant execute on function ${target.identity} to anon, authenticated, service_role;`,
    )
    .join("\n\n");
  const replayAssertions = repair.targets
    .map(
      (target) => `  if has_function_privilege('anon', '${target.regprocedure}', 'EXECUTE') then
    raise exception 'TEST 0276: anon conserva EXECUTE en ${target.identity}';
  end if;
  if not has_function_privilege('authenticated', '${target.regprocedure}', 'EXECUTE')
    or not has_function_privilege('service_role', '${target.regprocedure}', 'EXECUTE')
  then
    raise exception 'TEST 0276: grants legítimos incompletos en ${target.identity}';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid = '${target.regprocedure}'::regprocedure),
      acldefault('f', (select proowner from pg_proc where oid = '${target.regprocedure}'::regprocedure))
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0276: PUBLIC conserva EXECUTE en ${target.identity}';
  end if;`,
    )
    .join("\n\n");

  return `\\set ON_ERROR_STOP on

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$roles$;

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  statements text[]
);

insert into supabase_migrations.schema_migrations (version, name, statements)
values ('${repair.version}', '${repair.name}', null);

create type public.document_status as enum ('fixture');
create type public.document_entity_type as enum ('fixture');
create type public.back_role as enum ('fixture');

${functionFixtures}

\\ir ../migrations/0276_restore_revoke_anon_rpc_sweep_history.sql
\\ir ../migrations/0276_restore_revoke_anon_rpc_sweep_history.sql

do $ledger_contract$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '${repair.version}'
      and name = '${repair.name}'
      and cardinality(statements) = 1
      and md5(statements[1]) = '${repair.targetMd5}'
  ) then
    raise exception 'TEST 0276: estado final incorrecto en ${repair.version}';
  end if;
  if not has_function_privilege(
    'anon',
    'public.comment_mentions_validate()',
    'EXECUTE'
  ) then
    raise exception 'TEST 0276: la migración ejecutó el payload almacenado';
  end if;
end
$ledger_contract$;

${repair.targetSql}

do $replay_contract$
begin
${replayAssertions}
end
$replay_contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  and to_regprocedure('public.comment_mentions_validate()') is null
  as sdd_0118_revoke_anon_fixture_rolled_back;
`;
}

async function run() {
  const repairs = await loadRepairs();
  const migration = buildMigration(repairs);
  const sqlTest = buildSqlTest(repairs);
  const followups = loadFollowups(repairs);
  const followupMigration = buildFollowupMigration(followups);
  const followupSqlTest = buildFollowupSqlTest(followups);
  const platformAdminRepair = await loadPlatformAdminRepair();
  const platformAdminMigration = buildPlatformAdminMigration(
    platformAdminRepair,
  );
  const platformAdminSqlTest = buildPlatformAdminSqlTest(platformAdminRepair);
  const calculatorSettingsRepair = await loadCalculatorSettingsRepair();
  const calculatorSettingsMigration = buildCalculatorSettingsMigration(
    calculatorSettingsRepair,
  );
  const calculatorSettingsSqlTest = buildCalculatorSettingsSqlTest(
    calculatorSettingsRepair,
  );
  const pinSearchPathRepair = await loadPinSearchPathRepair();
  const pinSearchPathMigration = buildPinSearchPathMigration(
    pinSearchPathRepair,
  );
  const pinSearchPathSqlTest = buildPinSearchPathSqlTest(pinSearchPathRepair);
  const revokeAnonSweepRepair = await loadRevokeAnonSweepRepair();
  const revokeAnonSweepMigration = buildRevokeAnonSweepMigration(
    revokeAnonSweepRepair,
  );
  const revokeAnonSweepSqlTest = buildRevokeAnonSweepSqlTest(
    revokeAnonSweepRepair,
  );
  const checkOnly = process.argv.includes("--check");

  if (checkOnly) {
    const [
      currentMigration,
      currentTest,
      currentFollowupMigration,
      currentFollowupTest,
      currentPlatformAdminMigration,
      currentPlatformAdminTest,
      currentCalculatorSettingsMigration,
      currentCalculatorSettingsTest,
      currentPinSearchPathMigration,
      currentPinSearchPathTest,
      currentRevokeAnonSweepMigration,
      currentRevokeAnonSweepTest,
    ] = await Promise.all([
      readFile(MIGRATION_PATH, "utf8"),
      readFile(SQL_TEST_PATH, "utf8"),
      readFile(FOLLOWUP_MIGRATION_PATH, "utf8"),
      readFile(FOLLOWUP_SQL_TEST_PATH, "utf8"),
      readFile(PLATFORM_ADMIN_MIGRATION_PATH, "utf8"),
      readFile(PLATFORM_ADMIN_SQL_TEST_PATH, "utf8"),
      readFile(CALCULATOR_SETTINGS_MIGRATION_PATH, "utf8"),
      readFile(CALCULATOR_SETTINGS_SQL_TEST_PATH, "utf8"),
      readFile(PIN_SEARCH_PATH_MIGRATION_PATH, "utf8"),
      readFile(PIN_SEARCH_PATH_SQL_TEST_PATH, "utf8"),
      readFile(REVOKE_ANON_SWEEP_MIGRATION_PATH, "utf8"),
      readFile(REVOKE_ANON_SWEEP_SQL_TEST_PATH, "utf8"),
    ]);
    if (
      normalizeSql(currentMigration) !== migration ||
      normalizeSql(currentTest) !== sqlTest ||
      normalizeSql(currentFollowupMigration) !== followupMigration ||
      normalizeSql(currentFollowupTest) !== followupSqlTest ||
      normalizeSql(currentPlatformAdminMigration) !==
        platformAdminMigration ||
      normalizeSql(currentPlatformAdminTest) !== platformAdminSqlTest ||
      normalizeSql(currentCalculatorSettingsMigration) !==
        calculatorSettingsMigration ||
      normalizeSql(currentCalculatorSettingsTest) !==
        calculatorSettingsSqlTest ||
      normalizeSql(currentPinSearchPathMigration) !==
        pinSearchPathMigration ||
      normalizeSql(currentPinSearchPathTest) !== pinSearchPathSqlTest ||
      normalizeSql(currentRevokeAnonSweepMigration) !==
        revokeAnonSweepMigration ||
      normalizeSql(currentRevokeAnonSweepTest) !== revokeAnonSweepSqlTest
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
    writeFile(
      PLATFORM_ADMIN_MIGRATION_PATH,
      platformAdminMigration,
      "utf8",
    ),
    writeFile(PLATFORM_ADMIN_SQL_TEST_PATH, platformAdminSqlTest, "utf8"),
    writeFile(
      CALCULATOR_SETTINGS_MIGRATION_PATH,
      calculatorSettingsMigration,
      "utf8",
    ),
    writeFile(
      CALCULATOR_SETTINGS_SQL_TEST_PATH,
      calculatorSettingsSqlTest,
      "utf8",
    ),
    writeFile(PIN_SEARCH_PATH_MIGRATION_PATH, pinSearchPathMigration, "utf8"),
    writeFile(PIN_SEARCH_PATH_SQL_TEST_PATH, pinSearchPathSqlTest, "utf8"),
    writeFile(
      REVOKE_ANON_SWEEP_MIGRATION_PATH,
      revokeAnonSweepMigration,
      "utf8",
    ),
    writeFile(
      REVOKE_ANON_SWEEP_SQL_TEST_PATH,
      revokeAnonSweepSqlTest,
      "utf8",
    ),
  ]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
