-- SDD-0118 · hacer replay-safe el skip histórico de invitaciones.
-- Sólo sustituye el payload de 0272 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_invite_skip_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729140214'
      and name = '0272_skip_superseded_invite_history'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('887cc625c50ba8f6a2292bad25989fc5', '4242bf102d649559d13793b53e46f43c')
  ) then
    raise exception '0281 abortada: ledger 0272 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_invite_skip_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_invite_skip_split_patched_0272$-- SDD-0118 · omitir dos fixes de invitaciones supersedidos.
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

$sdd0118_invite_skip_split_patched_0272$
]
where version = '20260729140214'
  and name = '0272_skip_superseded_invite_history'
  and cardinality(statements) = 1
  and md5(statements[1]) = '887cc625c50ba8f6a2292bad25989fc5';

do $sdd0118_invite_skip_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729140214'
      and name = '0272_skip_superseded_invite_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '4242bf102d649559d13793b53e46f43c'
  ) then
    raise exception '0281 abortada: 0272 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_invite_skip_split_postconditions$;
