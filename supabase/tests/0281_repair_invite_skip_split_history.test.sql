\set ON_ERROR_STOP on

begin;

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  statements text[] not null
);

insert into supabase_migrations.schema_migrations (version, name, statements)
values (
  '20260729140214',
  '0272_skip_superseded_invite_history',
  array[$sdd0118_invite_skip_split_original_0272$-- SDD-0118 · omitir dos fixes de invitaciones supersedidos.
-- Sólo restaura comments no-op en el ledger; no ejecuta DDL de negocio.

do $sdd0118_followup_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('8296dce3805f143e549a239995bd954a', '9e4dc98716f8335c93e9961ccdf18fbe')
  ) then
    raise exception 'SDD-0118 follow-up: drift en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('bb5879cd44f1b5911511e223a0618e51', 'accd69afa043efc46960c8de5faa7c34')
  ) then
    raise exception 'SDD-0118 follow-up: drift en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;
end
$sdd0118_followup_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_followup_0$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0031_fix_studio_invite_gen_random_bytes.sql.$sdd0118_followup_0$
]
where version = '20260528060007'
  and name = '0031_fix_studio_invite_gen_random_bytes'
  and cardinality(statements) = 1
  and md5(statements[1]) = '8296dce3805f143e549a239995bd954a';

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_followup_1$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0032_fix_studio_invite_ambiguous_token.sql.$sdd0118_followup_1$
]
where version = '20260528060008'
  and name = '0032_fix_studio_invite_ambiguous_token'
  and cardinality(statements) = 1
  and md5(statements[1]) = 'bb5879cd44f1b5911511e223a0618e51';

do $sdd0118_followup_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and cardinality(statements) = 1
      and md5(statements[1]) = '9e4dc98716f8335c93e9961ccdf18fbe'
  ) then
    raise exception 'SDD-0118 follow-up: postcondición falló en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'accd69afa043efc46960c8de5faa7c34'
  ) then
    raise exception 'SDD-0118 follow-up: postcondición falló en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;
end
$sdd0118_followup_postflight$;

$sdd0118_invite_skip_split_original_0272$]
);

\ir ../migrations/0281_repair_invite_skip_split_history.sql
\ir ../migrations/0281_repair_invite_skip_split_history.sql

do $ledger_contract$
declare
  v_payload text;
begin
  select statements[1]
  into strict v_payload
  from supabase_migrations.schema_migrations
  where version = '20260729140214'
    and name = '0272_skip_superseded_invite_history'
    and cardinality(statements) = 1
    and md5(statements[1]) = '4242bf102d649559d13793b53e46f43c';

  if pg_catalog.strpos(v_payload, 'e7f1e2878e508b2338f4f014f8e9578f') = 0
     or pg_catalog.strpos(
       v_payload,
       'in (''8296dce3805f143e549a239995bd954a'', ''e7f1e2878e508b2338f4f014f8e9578f'')'
     ) = 0 then
    raise exception 'TEST 0281: falta compatibilidad split 20260528060007';
  end if;

  if pg_catalog.strpos(v_payload, '45a1d8ecf3de592e7c2106bb704e709f') = 0
     or pg_catalog.strpos(
       v_payload,
       'in (''bb5879cd44f1b5911511e223a0618e51'', ''45a1d8ecf3de592e7c2106bb704e709f'')'
     ) = 0 then
    raise exception 'TEST 0281: falta compatibilidad split 20260528060008';
  end if;

  if v_payload <> $sdd0118_invite_skip_split_expected_0272$-- SDD-0118 · omitir dos fixes de invitaciones supersedidos.
-- Sólo restaura comments no-op en el ledger; no ejecuta DDL de negocio.
-- 0281 acepta además los payloads fragmentados que 0280 preserva en replay.

do $sdd0118_followup_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('8296dce3805f143e549a239995bd954a', 'e7f1e2878e508b2338f4f014f8e9578f', '9e4dc98716f8335c93e9961ccdf18fbe')
  ) then
    raise exception 'SDD-0118 follow-up: drift en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('bb5879cd44f1b5911511e223a0618e51', '45a1d8ecf3de592e7c2106bb704e709f', 'accd69afa043efc46960c8de5faa7c34')
  ) then
    raise exception 'SDD-0118 follow-up: drift en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;
end
$sdd0118_followup_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_followup_0$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0031_fix_studio_invite_gen_random_bytes.sql.$sdd0118_followup_0$
]
where version = '20260528060007'
  and name = '0031_fix_studio_invite_gen_random_bytes'
  and cardinality(statements) = 1
  and md5(statements[1]) in ('8296dce3805f143e549a239995bd954a', 'e7f1e2878e508b2338f4f014f8e9578f');

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_followup_1$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0032_fix_studio_invite_ambiguous_token.sql.$sdd0118_followup_1$
]
where version = '20260528060008'
  and name = '0032_fix_studio_invite_ambiguous_token'
  and cardinality(statements) = 1
  and md5(statements[1]) in ('bb5879cd44f1b5911511e223a0618e51', '45a1d8ecf3de592e7c2106bb704e709f');

do $sdd0118_followup_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and cardinality(statements) = 1
      and md5(statements[1]) = '9e4dc98716f8335c93e9961ccdf18fbe'
  ) then
    raise exception 'SDD-0118 follow-up: postcondición falló en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'accd69afa043efc46960c8de5faa7c34'
  ) then
    raise exception 'SDD-0118 follow-up: postcondición falló en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;
end
$sdd0118_followup_postflight$;

$sdd0118_invite_skip_split_expected_0272$ then
    raise exception 'TEST 0281: payload 0272 no es byte-idéntico al esperado';
  end if;
end
$ledger_contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  as sdd_0118_invite_skip_split_fixture_rolled_back;
