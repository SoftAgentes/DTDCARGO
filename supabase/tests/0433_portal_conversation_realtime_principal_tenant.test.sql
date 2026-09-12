\set ON_ERROR_STOP on
-- SDD-0401: PostgreSQL local y principals exclusivamente sintéticos.
-- RED: psql -v apply_fix=false -f este archivo.
-- GREEN por defecto: aplica 0433; apply_fix=false conserva el fallo histórico.
\if :{?apply_fix}
\else
\set apply_fix true
\endif

begin;
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to authenticated, service_role;
create function auth.uid() returns uuid
language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.clients (
  id uuid primary key, tenant_id uuid not null, markbox text not null,
  deleted_at timestamptz
);
create table public.client_users (
  auth_user_id uuid primary key, tenant_id uuid not null,
  client_id uuid not null references public.clients(id), status text not null
);
create table public.user_tenants (
  user_id uuid primary key, tenant_id uuid not null, disabled_at timestamptz
);
create table public.conversations (
  id uuid primary key, tenant_id uuid not null,
  client_id uuid not null references public.clients(id), channel text not null,
  deleted_at timestamptz
);
create table public.conversation_messages (
  id uuid primary key, tenant_id uuid not null,
  conversation_id uuid not null references public.conversations(id), body text not null
);

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.get_portal_client_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select cu.client_id from public.client_users cu
  where cu.auth_user_id = (select auth.uid()) and cu.status = 'active' limit 1
$$;

grant select on public.clients, public.client_users, public.user_tenants,
  public.conversations, public.conversation_messages to authenticated;
grant insert, update, delete on public.conversation_messages to authenticated;
grant all on public.conversations, public.conversation_messages to service_role;

alter table public.clients enable row level security;
alter table public.client_users enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

create policy "clients portal self read" on public.clients for select to authenticated
  using (deleted_at is null and id = public.get_portal_client_id());
create policy "client_users self or tenant read" on public.client_users for select to authenticated
  using (auth_user_id = (select auth.uid()) or tenant_id = public.get_user_tenant_id());
create policy "conversations by tenant" on public.conversations for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "conversations service_role all" on public.conversations for all to service_role
  using (true) with check (true);
create policy "conversation_messages by tenant" on public.conversation_messages for all to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
create policy "conversation_messages service_role all" on public.conversation_messages for all to service_role
  using (true) with check (true);
create policy "conv_messages portal client read own" on public.conversation_messages
  for select to authenticated using (
    conversation_id in (
      select c.id from public.conversations c
      where c.client_id = public.get_portal_client_id()
        and c.channel = 'portal' and c.deleted_at is null
    )
  );

insert into public.clients values
  ('31000000-4330-4000-8000-000000000001', '10000000-4330-4000-8000-000000000001', 'DUP', null),
  ('32000000-4330-4000-8000-000000000001', '20000000-4330-4000-8000-000000000002', 'OTHER', null),
  ('31000000-4330-4000-8000-000000000003', '10000000-4330-4000-8000-000000000001', 'DEAD', now());
insert into public.client_users values
  ('aaaaaaaa-4330-4000-8000-000000000101', '10000000-4330-4000-8000-000000000001', '31000000-4330-4000-8000-000000000001', 'active'),
  ('aaaaaaaa-4330-4000-8000-000000000102', '10000000-4330-4000-8000-000000000001', '32000000-4330-4000-8000-000000000001', 'active'),
  ('aaaaaaaa-4330-4000-8000-000000000103', '10000000-4330-4000-8000-000000000001', '31000000-4330-4000-8000-000000000003', 'revoked');
insert into public.user_tenants values
  ('aaaaaaaa-4330-4000-8000-000000000001', '10000000-4330-4000-8000-000000000001', null);
insert into public.conversations values
  ('41000000-4330-4000-8000-000000000001', '10000000-4330-4000-8000-000000000001', '31000000-4330-4000-8000-000000000001', 'portal', null),
  ('42000000-4330-4000-8000-000000000001', '20000000-4330-4000-8000-000000000002', '32000000-4330-4000-8000-000000000001', 'portal', null),
  ('41000000-4330-4000-8000-000000000002', '10000000-4330-4000-8000-000000000001', '31000000-4330-4000-8000-000000000001', 'email', null),
  ('41000000-4330-4000-8000-000000000003', '10000000-4330-4000-8000-000000000001', '31000000-4330-4000-8000-000000000001', 'portal', now());
insert into public.conversation_messages values
  ('51000000-4330-4000-8000-000000000001', '10000000-4330-4000-8000-000000000001', '41000000-4330-4000-8000-000000000001', 'own'),
  ('52000000-4330-4000-8000-000000000001', '20000000-4330-4000-8000-000000000002', '42000000-4330-4000-8000-000000000001', 'foreign'),
  ('52000000-4330-4000-8000-000000000002', '20000000-4330-4000-8000-000000000002', '41000000-4330-4000-8000-000000000001', 'child-tenant-mismatch'),
  ('51000000-4330-4000-8000-000000000002', '10000000-4330-4000-8000-000000000001', '41000000-4330-4000-8000-000000000002', 'email-channel'),
  ('51000000-4330-4000-8000-000000000003', '10000000-4330-4000-8000-000000000001', '41000000-4330-4000-8000-000000000003', 'deleted-conversation');

-- La subconsulta histórica queda bloqueada por la RLS de conversations.
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4330-4000-8000-000000000101';
do $historical_bug$
begin
  if public.get_portal_client_id() <> '31000000-4330-4000-8000-000000000001'::uuid
     or (select count(*) from public.conversation_messages) <> 0 then
    raise exception 'TEST 0433: fixture no reprodujo el Realtime vacío histórico';
  end if;
  raise notice 'TEST 0433 RED baseline: principal Portal válido recibe cero mensajes';
end;
$historical_bug$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4330-4000-8000-000000000102';
do $historical_identity$
begin
  if public.get_portal_client_id() <> '32000000-4330-4000-8000-000000000001'::uuid then
    raise exception 'TEST 0433: fixture no reprodujo identidad tenant/cliente incoherente';
  end if;
end;
$historical_identity$;
reset role;

create temporary table unchanged_policy_baseline as
  select to_jsonb(p) as definition from pg_catalog.pg_policies p
  where schemaname = 'public' and tablename = 'conversation_messages'
    and policyname <> 'conv_messages portal client read own';
create temporary table table_baseline as
  select relacl, relrowsecurity from pg_catalog.pg_class
  where oid = 'public.conversation_messages'::regclass;

\if :apply_fix
\ir ../migrations/0433_portal_conversation_realtime_principal_tenant.sql

do $preflight_drift$
declare v record; v_rejected boolean;
begin
  for v in select * from (values
    ('create policy "0433 unexpected" on public.conversation_messages for select to authenticated using (true)',
     '0433: inventario de policies ausente o con drift'),
    ('drop policy "conv_messages portal client read own" on public.conversation_messages',
     '0433: inventario de policies ausente o con drift'),
    ('alter table public.conversation_messages disable row level security',
     '0433: tabla ausente o sin RLS: conversation_messages')
  ) d(ddl, expected) loop
    begin
      execute v.ddl;
      begin
        execute pg_catalog.pg_read_file('/sb/migrations/0433_portal_conversation_realtime_principal_tenant.sql');
      exception when others then
        v_rejected := position(v.expected in sqlerrm) > 0;
      end;
      raise exception 'rollback drift';
    exception when raise_exception then
      if sqlerrm <> 'rollback drift' then raise; end if;
    end;
    if not v_rejected then raise exception 'TEST 0433: preflight aceptó drift: %', v.ddl; end if;
    v_rejected := false;
  end loop;
end;
$preflight_drift$;
\endif

do $unchanged$
begin
  if exists (
    (select to_jsonb(p) from pg_catalog.pg_policies p
     where schemaname = 'public' and tablename = 'conversation_messages'
       and policyname <> 'conv_messages portal client read own')
    except table unchanged_policy_baseline
  ) or exists (
    table unchanged_policy_baseline except
    select to_jsonb(p) from pg_catalog.pg_policies p
    where schemaname = 'public' and tablename = 'conversation_messages'
      and policyname <> 'conv_messages portal client read own'
  ) then raise exception 'TEST 0433: cambió una policy ajena'; end if;
  if exists (
    (select relacl, relrowsecurity from pg_catalog.pg_class
     where oid = 'public.conversation_messages'::regclass)
    except table table_baseline
  ) then raise exception 'TEST 0433: cambió ACL de tabla o RLS'; end if;
end;
$unchanged$;

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4330-4000-8000-000000000101';
do $coherent$
begin
  if (select array_agg(body order by body) from public.conversation_messages)
     is distinct from array['own']::text[] then
    raise exception 'TEST 0433: principal válido no quedó en su mensaje Portal coherente';
  end if;
end;
$coherent$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4330-4000-8000-000000000102';
do $invalid$
declare v_blocked boolean := false;
begin
  if (select count(*) from public.conversation_messages) <> 0 then
    raise exception 'TEST 0433: vínculo incoherente leyó mensajes';
  end if;
  begin
    insert into public.conversation_messages values
      ('51000000-4330-4000-8000-000000000099', '10000000-4330-4000-8000-000000000001', '41000000-4330-4000-8000-000000000001', 'forged');
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0433: Portal escribió mensaje directo'; end if;
end;
$invalid$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4330-4000-8000-000000000103';
do $revoked$
begin
  if (select count(*) from public.conversation_messages) <> 0 then
    raise exception 'TEST 0433: vínculo revocado leyó mensajes';
  end if;
end;
$revoked$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4330-4000-8000-000000000001';
do $staff$
begin
  if (select count(*) from public.conversation_messages) <> 3 then
    raise exception 'TEST 0433: staff perdió su lectura tenant-wide';
  end if;
end;
$staff$;
reset role;

set local role service_role;
do $service$
begin
  if (select count(*) from public.conversation_messages) <> 5 then
    raise exception 'TEST 0433: service_role perdió mensajes';
  end if;
end;
$service$;
reset role;

do $function_acl$
declare v_rpc oid := pg_catalog.to_regprocedure(
  'public.portal_can_read_conversation_message(uuid,uuid)'
);
begin
  if v_rpc is null
     or pg_catalog.has_function_privilege('anon', v_rpc, 'execute')
     or not pg_catalog.has_function_privilege('authenticated', v_rpc, 'execute')
     or pg_catalog.has_function_privilege('service_role', v_rpc, 'execute')
     or exists (
       select 1 from pg_catalog.pg_proc p,
         lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
       where p.oid = v_rpc and a.grantee = 0 and a.privilege_type = 'EXECUTE'
     ) then raise exception 'TEST 0433: ACL de helper booleana inválida'; end if;
end;
$function_acl$;

rollback;
select to_regclass('public.conversation_messages') is null as portal_realtime_0433_fixture_rolled_back;
