\set ON_ERROR_STOP on

begin;

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  statements text[] not null
);

insert into supabase_migrations.schema_migrations (version, name, statements)
values
  (
    '20260526213130',
    'seed_team_invitation_template',
    array[$sdd0118_old_0$-- Seed template "team_invitation" por cada tenant existente.
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
end $$;$sdd0118_old_0$]
  ),
  (
    '20260527073053',
    'realtime_dispatch',
    array[$sdd0118_old_1$do $$
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
end $$;$sdd0118_old_1$]
  ),
  (
    '20260528060005',
    '0026_welcome_email_template_seed',
    array[$sdd0118_old_2$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0026_welcome_email_template_seed.sql.$sdd0118_old_2$]
  ),
  (
    '20260528060006',
    '0027_qr_print_orders',
    array[$sdd0118_old_3$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0027_qr_print_orders.sql.$sdd0118_old_3$]
  ),
  (
    '20260528060007',
    '0031_fix_studio_invite_gen_random_bytes',
    array[$sdd0118_old_4$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0031_fix_studio_invite_gen_random_bytes.sql.$sdd0118_old_4$]
  ),
  (
    '20260528060008',
    '0032_fix_studio_invite_ambiguous_token',
    array[$sdd0118_old_5$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0032_fix_studio_invite_ambiguous_token.sql.$sdd0118_old_5$]
  ),
  (
    '20260528060009',
    '0033_grant_service_role_policies',
    array[$sdd0118_old_6$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0033_grant_service_role_policies.sql.$sdd0118_old_6$]
  ),
  (
    '20260528060010',
    '0035_fix_verify_operario_pin_extensions',
    array[$sdd0118_old_7$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0035_fix_verify_operario_pin_extensions.sql.$sdd0118_old_7$]
  ),
  (
    '20260528060011',
    '0036_fk_user_tenants_profile',
    array[$sdd0118_old_8$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0036_fk_user_tenants_profile.sql.$sdd0118_old_8$]
  ),
  (
    '20260528060012',
    '0037_harden_operario_pin_validator',
    array[$sdd0118_old_9$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0037_harden_operario_pin_validator.sql.$sdd0118_old_9$]
  ),
  (
    '20260528060013',
    '0039_fix_bug_advance_state_actor_type_cast',
    array[$sdd0118_old_10$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0039_fix_bug_advance_state_actor_type_cast.sql.$sdd0118_old_10$]
  );

\ir ../migrations/0271_repair_branch_replay_history.sql
\ir ../migrations/0271_repair_branch_replay_history.sql

do $contract$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260526213130'
      and name = 'seed_team_invitation_template'
      and cardinality(statements) = 2
          and md5(statements[1]) = 'e2e1b4c3846c7fba431455c9130f0d34'
          and md5(statements[2]) = 'e087ed48b2838aca3d1ba061ed7a6ab6'
  ) then
    raise exception 'TEST 0271: estado incorrecto en 20260526213130';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260527073053'
      and name = 'realtime_dispatch'
      and cardinality(statements) = 3
          and md5(statements[1]) = 'fc9872ff14733d3d9cac5f0cbb330962'
          and md5(statements[2]) = 'bc9153c31f543e4a74aaa2c570a7aff4'
          and md5(statements[3]) = '528cbe1e1d4e39ba597403efbac747d2'
  ) then
    raise exception 'TEST 0271: estado incorrecto en 20260527073053';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060005'
      and name = '0026_welcome_email_template_seed'
      and cardinality(statements) = 1
          and md5(statements[1]) = 'b0a7c682cc6031be6034940cb27a5702'
  ) then
    raise exception 'TEST 0271: estado incorrecto en 20260528060005';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060006'
      and name = '0027_qr_print_orders'
      and cardinality(statements) = 1
          and md5(statements[1]) = 'b760d6196dc02d67036148d33b4ce1f1'
  ) then
    raise exception 'TEST 0271: estado incorrecto en 20260528060006';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and cardinality(statements) = 1
          and md5(statements[1]) = '8296dce3805f143e549a239995bd954a'
  ) then
    raise exception 'TEST 0271: estado incorrecto en 20260528060007';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and cardinality(statements) = 1
          and md5(statements[1]) = 'bb5879cd44f1b5911511e223a0618e51'
  ) then
    raise exception 'TEST 0271: estado incorrecto en 20260528060008';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060009'
      and name = '0033_grant_service_role_policies'
      and cardinality(statements) = 1
          and md5(statements[1]) = 'a09e03f9f62c47b32ee0a5b4902fa834'
  ) then
    raise exception 'TEST 0271: estado incorrecto en 20260528060009';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060010'
      and name = '0035_fix_verify_operario_pin_extensions'
      and cardinality(statements) = 1
          and md5(statements[1]) = '732f8ed961708b91b94cf4965ca8d797'
  ) then
    raise exception 'TEST 0271: estado incorrecto en 20260528060010';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060011'
      and name = '0036_fk_user_tenants_profile'
      and cardinality(statements) = 1
          and md5(statements[1]) = 'ba63f9c578e32019aaafc8e6d6247056'
  ) then
    raise exception 'TEST 0271: estado incorrecto en 20260528060011';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060012'
      and name = '0037_harden_operario_pin_validator'
      and cardinality(statements) = 1
          and md5(statements[1]) = '6e3f5a4763cd32e66a33f189af2da876'
  ) then
    raise exception 'TEST 0271: estado incorrecto en 20260528060012';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060013'
      and name = '0039_fix_bug_advance_state_actor_type_cast'
      and cardinality(statements) = 1
          and md5(statements[1]) = 'f2872b0ac20dd9e070b14085a60a3fb6'
  ) then
    raise exception 'TEST 0271: estado incorrecto en 20260528060013';
  end if;
end
$contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  as sdd_0118_fixture_rolled_back;
