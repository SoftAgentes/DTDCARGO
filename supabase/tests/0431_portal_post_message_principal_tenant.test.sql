\set ON_ERROR_STOP on
-- SDD-0385: identidad coherente del RPC inbound de conversaciones Portal.
-- RED causal: -v apply_fix=false. GREEN: aplica la migración real 0431.
\if :{?apply_fix}
\else
\set apply_fix true
\endif

begin;

do $fixture_guard$
begin
  if to_regnamespace('auth') is not null or to_regclass('public.clients') is not null then
    raise exception 'TEST 0431 requiere una base PostgreSQL desechable vacía';
  end if;
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$fixture_guard$;

grant usage on schema public to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.tenants (id uuid primary key, slug text unique);
create table public.user_tenants (
  user_id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  disabled_at timestamptz
);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select tenant_id from public.user_tenants
  where user_id = (select auth.uid()) and disabled_at is null limit 1
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create table public.shipments (
  id uuid primary key, tenant_id uuid, client_markbox text, deleted_at timestamptz
);
alter table public.shipments enable row level security;
create publication supabase_realtime;

\ir ../migrations/0006_clients.sql
\ir ../migrations/0080_portal_cliente.sql
\ir ../migrations/0106_conversaciones.sql

-- Estado efectivo posterior a los barridos ACL 0209/0211/0276/0285.
revoke execute on function public.portal_post_message(text) from public, anon;
grant execute on function public.portal_post_message(text) to authenticated, service_role;
revoke execute on function public.next_conversation_ref(uuid) from public, anon, authenticated;
grant execute on function public.next_conversation_ref(uuid) to service_role;

create function pg_temp.fixture_id(label text) returns uuid language sql immutable as $$
  select md5('0431-synthetic-' || label)::uuid
$$;
create temporary sequence assertion_count;
grant usage on sequence assertion_count to authenticated, service_role;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'TEST 0431: %', label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

insert into public.tenants values
  (pg_temp.fixture_id('tenant-A'), 'synthetic-a'),
  (pg_temp.fixture_id('tenant-B'), 'synthetic-b');
insert into auth.users (id, email)
select pg_temp.fixture_id(actor), actor || '@example.invalid' from unnest(array[
  'portal-A', 'portal-B', 'incoherent', 'retired', 'revoked', 'invited', 'unbound'
]) actor;
insert into public.clients (id, tenant_id, markbox, name)
select pg_temp.fixture_id(client), pg_temp.fixture_id(tenant), markbox, client_name
from (values
  ('client-A', 'tenant-A', 'A', 'Cliente A'),
  ('client-B', 'tenant-B', 'B', 'Cliente B'),
  ('client-retired', 'tenant-A', 'RET', 'Cliente retirado'),
  ('client-revoked', 'tenant-A', 'REV', 'Cliente revocado'),
  ('client-invited', 'tenant-A', 'INV', 'Cliente invitado')
) fixture(client, tenant, markbox, client_name);
insert into public.client_users (auth_user_id, tenant_id, client_id, email, status)
select pg_temp.fixture_id(actor), pg_temp.fixture_id(tenant), pg_temp.fixture_id(client),
  actor || '@example.invalid', status
from (values
  ('portal-A', 'tenant-A', 'client-A', 'active'),
  ('portal-B', 'tenant-B', 'client-B', 'active'),
  ('incoherent', 'tenant-A', 'client-B', 'active'),
  ('retired', 'tenant-A', 'client-retired', 'active'),
  ('revoked', 'tenant-A', 'client-revoked', 'revoked'),
  ('invited', 'tenant-A', 'client-invited', 'invited')
) fixture(actor, tenant, client, status);
update public.clients set deleted_at = now()
where id = pg_temp.fixture_id('client-retired');

-- La vulnerabilidad histórica se reproduce antes del arreglo, aun en GREEN.
savepoint legacy_probe;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('incoherent')::text, true);
select public.portal_post_message('mensaje sintético cruzado') as legacy_conversation_id \gset
reset role;
select pg_temp.assert_true(exists (
  select 1 from public.conversations c
  join public.conversation_messages m on m.conversation_id = c.id
  where c.id = :'legacy_conversation_id'::uuid
    and c.tenant_id = pg_temp.fixture_id('tenant-B')
    and c.client_id = pg_temp.fixture_id('client-B')
    and m.tenant_id = pg_temp.fixture_id('tenant-B')
    and m.body = 'mensaje sintético cruzado'
), 'RED baseline: vínculo tenant-A a cliente-B escribe conversación y mensaje de B');
rollback to legacy_probe;
release legacy_probe;

create function pg_temp.row_snapshot() returns jsonb language sql stable as $rows$
select jsonb_build_object(
  'clients', (select jsonb_agg(to_jsonb(c) order by id) from public.clients c),
  'bindings', (select jsonb_agg(to_jsonb(cu) order by id) from public.client_users cu),
  'conversations', (select jsonb_agg(to_jsonb(c) order by id) from public.conversations c),
  'messages', (select jsonb_agg(to_jsonb(m) order by id) from public.conversation_messages m),
  'tenants', (select jsonb_agg(to_jsonb(t) order by id) from public.tenants t),
  'users', (select jsonb_agg(to_jsonb(u) order by id) from auth.users u)
);
$rows$;
create temporary table before_state as
select pg_temp.row_snapshot() rows, p.proowner, p.proacl
from pg_proc p where p.oid = 'public.portal_post_message(text)'::regprocedure;

\if :apply_fix
\ir ../migrations/0431_portal_post_message_principal_tenant.sql
create temporary table function_after_first as
select pg_get_functiondef(p.oid) definition, obj_description(p.oid, 'pg_proc') comment,
  p.proowner, p.proacl, p.proconfig
from pg_proc p where p.oid = 'public.portal_post_message(text)'::regprocedure;
\ir ../migrations/0431_portal_post_message_principal_tenant.sql
select pg_temp.assert_true((select to_jsonb(f) from function_after_first f) =
  (select to_jsonb(current) from (
    select pg_get_functiondef(p.oid) definition, obj_description(p.oid, 'pg_proc') comment,
      p.proowner, p.proacl, p.proconfig
    from pg_proc p where p.oid = 'public.portal_post_message(text)'::regprocedure
  ) current), 'Reejecución idempotente conserva definición, comentario, propietario y ACL');

do $drift$
declare failed boolean := false; message text;
  migration text := pg_read_file('/sb/migrations/0431_portal_post_message_principal_tenant.sql');
begin
  begin
    alter table public.client_users disable row level security;
    begin execute migration;
    exception when others then
      get stacked diagnostics message = message_text;
      if sqlstate <> 'P0001' or message not like '0431:%' then raise; end if;
      failed := true;
    end;
    if not failed then raise exception 'TEST 0431: preflight aceptó client_users sin RLS'; end if;
    raise exception using errcode = 'PT431', message = 'rollback drift sintético';
  exception when sqlstate 'PT431' then null;
  end;
  perform pg_temp.assert_true(failed and (
    select relrowsecurity from pg_class where oid = 'public.client_users'::regclass
  ), 'Preflight rechaza drift y revierte sin cambio parcial');
end;
$drift$;
\endif

select pg_temp.assert_true((select rows from before_state) = pg_temp.row_snapshot(),
  'Migración no modifica filas históricas ni fixtures');
select pg_temp.assert_true((select proowner from before_state) =
  (select proowner from pg_proc where oid = 'public.portal_post_message(text)'::regprocedure),
  'CREATE OR REPLACE preserva el propietario del RPC');

create function pg_temp.call_is_blocked(actor text, body text default 'mensaje bloqueado')
returns boolean language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',
    coalesce(pg_temp.fixture_id(actor)::text, ''), true);
  begin
    perform public.portal_post_message(body);
    return false;
  exception when sqlstate '42501' then return true;
  end;
end;
$$;

set local role authenticated;
-- Primera aserción causal que falla en RED.
select pg_temp.assert_true(pg_temp.call_is_blocked('incoherent'),
  'Vínculo tenant/cliente incoherente falla 42501 antes de escribir');
select pg_temp.assert_true(pg_temp.call_is_blocked('retired'),
  'Cliente retirado falla 42501 antes de escribir');
select pg_temp.assert_true(pg_temp.call_is_blocked('revoked'),
  'Vínculo revocado falla 42501 antes de escribir');
select pg_temp.assert_true(pg_temp.call_is_blocked('invited'),
  'Vínculo invitado falla 42501 antes de escribir');
select pg_temp.assert_true(pg_temp.call_is_blocked('unbound'),
  'Usuario sin vínculo falla 42501 antes de escribir');
select pg_temp.assert_true(pg_temp.call_is_blocked(null),
  'Sesión authenticated sin auth.uid falla 42501 antes de escribir');
reset role;
select pg_temp.assert_true((select count(*) from public.conversations) = 0 and
  (select count(*) from public.conversation_messages) = 0,
  'Principales inválidos dejan cero conversaciones y mensajes');

set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
select public.portal_post_message('  primer mensaje  ') as first_conversation_id \gset
reset role;
select pg_temp.assert_true(exists (
  select 1 from public.conversations c
  join public.conversation_messages m on m.conversation_id = c.id
  where c.id = :'first_conversation_id'::uuid
    and c.tenant_id = pg_temp.fixture_id('tenant-A')
    and c.client_id = pg_temp.fixture_id('client-A')
    and c.channel = 'portal' and c.status = 'abierto'
    and c.unread_count = 1 and c.deleted_at is null
    and m.tenant_id = pg_temp.fixture_id('tenant-A')
    and m.direction = 'in' and m.author_name = 'Cliente A'
    and m.body = 'primer mensaje'
), 'Principal A crea sólo su hilo y mensaje inbound con cuerpo normalizado');

update public.conversations set status = 'resuelto'
where id = :'first_conversation_id'::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
select public.portal_post_message('segundo mensaje') as second_conversation_id \gset
reset role;
select pg_temp.assert_true(:'second_conversation_id'::uuid = :'first_conversation_id'::uuid and
  (select unread_count = 2 and status = 'abierto'
    from public.conversations where id = :'first_conversation_id'::uuid) and
  (select count(*) from public.conversation_messages
    where conversation_id = :'first_conversation_id'::uuid) = 2,
  'Segundo inbound reutiliza hilo, incrementa unread y reabre resuelto');

create function pg_temp.input_rejected(body text) returns boolean language plpgsql as $$
begin
  begin perform public.portal_post_message(body); return false;
  exception when others then return sqlstate = 'P0001'; end;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
select pg_temp.assert_true(pg_temp.input_rejected('   '), 'Cuerpo vacío sigue rechazado');
select pg_temp.assert_true(pg_temp.input_rejected(repeat('x', 4001)), 'Cuerpo mayor a 4000 sigue rechazado');
reset role;
select pg_temp.assert_true((select count(*) from public.conversation_messages) = 2,
  'Entradas inválidas no escriben mensajes');

select pg_temp.assert_true(not has_function_privilege('anon',
  'public.portal_post_message(text)', 'execute') and
  has_function_privilege('authenticated', 'public.portal_post_message(text)', 'execute') and
  has_function_privilege('service_role', 'public.portal_post_message(text)', 'execute'),
  'ACL efectivo niega anon y permite authenticated/service_role');
select pg_temp.assert_true(not exists (
  select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  where p.oid = 'public.portal_post_message(text)'::regprocedure
    and a.grantee = 0 and a.privilege_type = 'EXECUTE'
), 'ACL explícito niega EXECUTE a PUBLIC');
select pg_temp.assert_true((
  select p.prosecdef and p.prorettype = 'uuid'::regtype
    and p.proconfig = array['search_path=pg_catalog, public']
  from pg_proc p where p.oid = 'public.portal_post_message(text)'::regprocedure
), 'RPC conserva SECURITY DEFINER/UUID y fija search_path endurecido');
select pg_temp.assert_true((
  select lower(pg_get_functiondef(p.oid)) like '%from public.client_users%'
    and lower(pg_get_functiondef(p.oid)) like '%c.tenant_id = cu.tenant_id%'
    and lower(pg_get_functiondef(p.oid)) like '%c.deleted_at is null%'
    and lower(pg_get_functiondef(p.oid)) like '%auth.uid()%'
    and lower(pg_get_functiondef(p.oid)) not like '%get_portal_client_id%'
  from pg_proc p where p.oid = 'public.portal_post_message(text)'::regprocedure
), 'Definición resuelve directamente vínculo activo, tenant coherente y cliente vivo');

select pg_temp.assert_true((select count(*) from public.conversations) = 1 and
  (select count(*) from public.conversation_messages) = 2,
  'Sólo persiste el flujo válido A dentro de la transacción de prueba');
select last_value as assertions_0431 from assertion_count;

rollback;
select to_regclass('public.clients') is null and to_regnamespace('auth') is null
  as fixture_0431_rolled_back;
