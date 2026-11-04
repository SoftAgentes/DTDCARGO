\set ON_ERROR_STOP on

-- SDD-0585 · contrato de 0503 (flag chatwoot_inbox + chatwoot_agent_links).
--
-- Monta lo mínimo que 0503 da por sentado: auth.uid() leyendo el JWT, tenants,
-- user_tenants, feature_flags (forma de 0042), get_user_tenant_id() (copia de
-- 0453) e is_tenant_admin() (copia de 0386). Después aplica la 0337 REAL
-- (catálogo, siembra y trigger) y la 0503 REAL.
--
-- CONTROL ROJO: sin 0503 cae en la primera aserción (el catálogo no tiene
-- chatwoot_inbox).
--
-- Termina siempre en ROLLBACK. Solo ids sintéticos.
begin;

do $roles$
begin
  if to_regclass('public.chatwoot_agent_links') is not null then
    raise exception 'Fixture 0503 rechazada: el objeto real ya existe';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table auth.users (id uuid primary key);

create table public.tenants (id uuid primary key, slug text);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
grant select on public.user_tenants to authenticated;

-- Forma de 0042.
create table public.feature_flags (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  key         text not null,
  enabled     boolean not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  unique (tenant_id, key)
);

-- Copia de 0453.
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1]
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid())
    and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
grant execute on function public.get_user_tenant_id() to authenticated;

-- Copia de 0386.
create function public.is_tenant_admin() returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce(exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = (select public.get_user_tenant_id())
      and ut.role = 'admin'
      and ut.disabled_at is null
  ), false);
$fn$;
grant execute on function public.is_tenant_admin() to authenticated;

-- ── Datos previos: dos tenants; T1 apagó «whatsapp» a mano ──────────────────
insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001', 'dtd'),
  ('10000000-0000-0000-0000-000000000002', 'otro');
insert into auth.users values
  ('20000000-0000-0000-0000-000000000001'),  -- admin de T1
  ('20000000-0000-0000-0000-000000000002'),  -- admin de T2
  ('20000000-0000-0000-0000-000000000003'),  -- commercial de T1 (se vincula)
  ('20000000-0000-0000-0000-000000000004');  -- support de T1 (sin vínculo)
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin', null),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'admin', null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'commercial', null),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'support', null);

\ir ../migrations/0337_feature_flags_seed_and_trigger.sql

update public.feature_flags set enabled = false
where tenant_id = '10000000-0000-0000-0000-000000000001' and key = 'whatsapp';
create temporary table catalogo_0337 as select * from public.feature_flag_catalog();

\ir ../migrations/0503_chatwoot_bandeja.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0503: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Ejecuta como la Server Action: rol authenticated con el JWT del usuario.
create function pg_temp.como(p_user uuid, p_sql text) returns integer language plpgsql as $$
declare v_rows integer;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  execute p_sql;
  get diagnostics v_rows = row_count;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v_rows;
exception when others then
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  raise;
end;
$$;

-- ¿Falla la sentencia? Devuelve el SQLSTATE o null si pasó.
create function pg_temp.falla(p_user uuid, p_sql text) returns text language plpgsql as $$
begin
  perform pg_temp.como(p_user, p_sql);
  return null;
exception when others then
  return sqlstate;
end;
$$;

-- Cuántas filas de la tabla ve el usuario.
create function pg_temp.ve(p_user uuid) returns integer language plpgsql as $$
declare v integer;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  select count(*) into v from public.chatwoot_agent_links;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v;
end;
$$;

-- 1. Catálogo y siembra del flag.
do $flag$
begin
  perform pg_temp.assert_true(exists (
    select 1 from public.feature_flag_catalog() where key = 'chatwoot_inbox' and enabled = false
  ), 'el catálogo tiene chatwoot_inbox apagado');
  perform pg_temp.assert_true(not exists (
    select key, enabled from catalogo_0337
    except select key, enabled from public.feature_flag_catalog()
  ), 'la 0503 conserva todas las filas y defaults del catálogo de 0337');
  perform pg_temp.assert_true(
    (select count(*) from public.feature_flag_catalog()) = (select count(*) from catalogo_0337) + 1,
    'la 0503 agrega exactamente una fila al catálogo');
  perform pg_temp.assert_true(
    (select count(*) from public.feature_flags where key = 'chatwoot_inbox' and enabled = false) = 2,
    'los dos tenants existentes reciben chatwoot_inbox apagado');
  perform pg_temp.assert_true(exists (
    select 1 from public.feature_flags
    where tenant_id = '10000000-0000-0000-0000-000000000001' and key = 'whatsapp' and enabled = false
  ), 'la siembra no toca un flag que el admin ya había cambiado');
  insert into public.tenants values ('10000000-0000-0000-0000-000000000003', 'nuevo');
  perform pg_temp.assert_true(exists (
    select 1 from public.feature_flags
    where tenant_id = '10000000-0000-0000-0000-000000000003' and key = 'chatwoot_inbox'
  ), 'un tenant nuevo nace con chatwoot_inbox (trigger de 0337 con el catálogo nuevo)');
end;
$flag$;

-- 2. Vínculos: quién crea, quién ve, quién borra.
do $vinculos$
declare
  t1 constant uuid := '10000000-0000-0000-0000-000000000001';
  t2 constant uuid := '10000000-0000-0000-0000-000000000002';
  admin1 constant uuid := '20000000-0000-0000-0000-000000000001';
  admin2 constant uuid := '20000000-0000-0000-0000-000000000002';
  comercial constant uuid := '20000000-0000-0000-0000-000000000003';
  soporte constant uuid := '20000000-0000-0000-0000-000000000004';
begin
  perform pg_temp.assert_true(pg_temp.falla(comercial, format(
    'insert into public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id, created_by) values (%L, %L, 7, %L)',
    t1, comercial, comercial)) = '42501', 'quien no es admin no crea vínculos, ni el suyo');
  perform pg_temp.assert_true(pg_temp.falla(admin1, format(
    'insert into public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id, created_by) values (%L, %L, 7, %L)',
    t2, admin2, admin1)) = '42501', 'el admin no crea vínculos en otro tenant');
  perform pg_temp.assert_true(pg_temp.falla(admin1, format(
    'insert into public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id, created_by) values (%L, %L, 7, %L)',
    t1, comercial, admin2)) = '42501', 'created_by tiene que ser quien crea');
  perform pg_temp.assert_true(pg_temp.como(admin1, format(
    'insert into public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id, created_by) values (%L, %L, 7, %L)',
    t1, comercial, admin1)) = 1, 'el admin de T1 vincula a un usuario de T1');
  perform pg_temp.assert_true(pg_temp.falla(admin1, format(
    'insert into public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id, created_by) values (%L, %L, 7, %L)',
    t1, soporte, admin1)) = '23505', 'un agente de Chatwoot no se vincula a dos usuarios del mismo tenant');
  perform pg_temp.assert_true(pg_temp.falla(admin1, format(
    'insert into public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id, created_by) values (%L, %L, 8, %L)',
    t1, comercial, admin1)) = '23505', 'un usuario de Studio no tiene dos agentes en el mismo tenant');
  perform pg_temp.assert_true(pg_temp.falla(admin1, format(
    'insert into public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id, created_by) values (%L, %L, 0, %L)',
    t1, soporte, admin1)) = '23514', 'el id de Chatwoot es positivo');
  perform pg_temp.assert_true(pg_temp.como(admin2, format(
    'insert into public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id, created_by) values (%L, %L, 7, %L)',
    t2, admin2, admin2)) = 1, 'el mismo id de Chatwoot puede existir en otro tenant');

  perform pg_temp.assert_true(pg_temp.ve(comercial) = 1, 'el usuario vinculado ve su fila');
  perform pg_temp.assert_true(pg_temp.ve(soporte) = 0, 'otro usuario del tenant no ve el vínculo ajeno');
  perform pg_temp.assert_true(pg_temp.ve(admin1) = 1, 'el admin de T1 ve los vínculos de T1 y solo esos');
  perform pg_temp.assert_true(pg_temp.ve(admin2) = 1, 'el admin de T2 ve solo el de T2');

  perform pg_temp.assert_true(pg_temp.falla(comercial, format(
    'update public.chatwoot_agent_links set chatwoot_user_id = 9 where user_id = %L', comercial)) = '42501',
    'nadie edita un vínculo (sin UPDATE)');
  perform pg_temp.assert_true(pg_temp.como(comercial, format(
    'delete from public.chatwoot_agent_links where user_id = %L', comercial)) = 0,
    'quien no es admin no borra, ni su propio vínculo');
  perform pg_temp.assert_true(pg_temp.como(admin2, format(
    'delete from public.chatwoot_agent_links where user_id = %L', comercial)) = 0,
    'el admin de T2 no borra vínculos de T1');
  perform pg_temp.assert_true(pg_temp.como(admin1, format(
    'delete from public.chatwoot_agent_links where user_id = %L', comercial)) = 1,
    'el admin de T1 borra el vínculo');

  update public.user_tenants set disabled_at = now() where user_id = admin1;
  perform pg_temp.assert_true(pg_temp.falla(admin1, format(
    'insert into public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id, created_by) values (%L, %L, 7, %L)',
    t1, comercial, admin1)) = '42501', 'un admin deshabilitado ya no crea vínculos');
  update public.user_tenants set disabled_at = null where user_id = admin1;
end;
$vinculos$;

-- 3. Privilegios.
do $privilegios$
begin
  perform pg_temp.assert_true(
    not has_table_privilege('anon', 'public.chatwoot_agent_links', 'SELECT')
    and not has_table_privilege('anon', 'public.chatwoot_agent_links', 'INSERT'),
    'anon no tiene acceso a la tabla');
  perform pg_temp.assert_true(
    not has_table_privilege('authenticated', 'public.chatwoot_agent_links', 'UPDATE'),
    'authenticated no tiene UPDATE');
  perform pg_temp.assert_true(
    not has_function_privilege('anon', 'public.feature_flag_catalog()', 'EXECUTE'),
    'anon sigue sin ejecutar el catálogo');
end;
$privilegios$;

select 'TEST 0503 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
