\set ON_ERROR_STOP on

-- SDD-0650 F2 · contrato de la 0554 (lista de uniones chat ↔ ficha, D4).
--
-- Monta lo mínimo que la 0554 da por sentado, con la forma de las migraciones
-- reales: tenants, auth.users, user_tenants, clients con deleted_at (0509),
-- get_user_tenant_id (0453), audit_entity_types (0258) y entity_audit_log.
--
-- Dobles con la MISMA firma (los reales tienen su propio contrato):
--   · user_has_module (0538): admin todo; bandeja para commercial y support,
--     support sin edición; el resto nada. Filtra de verdad por el rol de la sesión.
--   · append_audit_event (0294): tipo de entidad activo y motivo de 4 a 1000.
--
-- Negativos que pide el DG: un rol sin Bandeja no lee uniones; otro tenant
-- tampoco; nadie escribe la tabla directo; ninguna sesión ejecuta las funciones
-- que escriben (todas son de service_role) y la base vuelve a comprobar al actor
-- que le pasa el ERP. Se aplica DOS veces (idempotencia).
--
-- CONTROL ROJO: sin la 0554 cae en la primera aserción (la tabla no existe).
-- Termina siempre en ROLLBACK. Solo ids sintéticos.
begin;

do $roles$
begin
  if to_regclass('public.chatwoot_contact_links') is not null then
    raise exception 'Fixture 0554 rechazada: el objeto real ya existe';
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

create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null references auth.users(id),
  tenant_id uuid not null references public.tenants(id),
  role text not null,
  disabled_at timestamptz,
  primary key (user_id, tenant_id)
);
grant select on public.user_tenants to authenticated;

-- Forma de 0006 + deleted_at (0509): lo que la 0554 toca.
create table public.clients (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  markbox text not null,
  name text,
  deleted_at timestamptz
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

-- Doble de user_has_module (firma de 0538).
create function public.user_has_module(p_module_id text, p_edit boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when ut.role = 'admin' then true
      when p_module_id = 'bandeja' and ut.role in ('commercial', 'support') then not (coalesce(p_edit, false) and ut.role = 'support')
      else false
    end
    from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = (select public.get_user_tenant_id())
      and ut.disabled_at is null
    limit 1
  ), false);
$$;
revoke all on function public.user_has_module(text, boolean) from public, anon;
grant execute on function public.user_has_module(text, boolean) to authenticated, service_role;

-- Forma de 0258 + entity_audit_log con FK al catálogo.
create table public.audit_entity_types (
  entity_type text primary key,
  status text not null check (status in ('active', 'deprecated')),
  domain_code text,
  contract_version integer,
  introduced_by_ref text
);
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  entity_type text not null references public.audit_entity_types(entity_type),
  entity_id uuid not null,
  actor_type text not null,
  actor_id uuid,
  event_type text not null,
  reason text,
  before_data jsonb,
  after_data jsonb,
  payload jsonb not null default '{}'::jsonb,
  correlation_id text check (correlation_id is null or correlation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  occurred_at timestamptz not null default now()
);

-- Doble de append_audit_event (firma de 0294).
create function public.append_audit_event(
  p_tenant_id uuid, p_entity_type text, p_entity_id uuid, p_actor_type text, p_actor_id uuid,
  p_event_type text, p_source text, p_result text default 'succeeded', p_reason text default null,
  p_before_data jsonb default null, p_after_data jsonb default null, p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null, p_schema_version integer default 1, p_sensitivity text default 'internal'
) returns uuid language plpgsql security definer set search_path = '' as $fn$
declare v_id uuid;
begin
  if not exists (select 1 from public.audit_entity_types where entity_type = p_entity_type and status = 'active') then
    raise exception 'audit: entity_type inexistente o inactivo';
  end if;
  if p_reason is not null and pg_catalog.char_length(p_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres';
  end if;
  insert into public.entity_audit_log (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, reason, before_data, after_data, payload, correlation_id)
  values (p_tenant_id, p_entity_type, p_entity_id, p_actor_type, p_actor_id, p_event_type, p_reason, p_before_data, p_after_data, p_payload, p_correlation_id)
  returning id into v_id;
  return v_id;
end;
$fn$;
revoke all on function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text) from public, anon, authenticated;

-- ── Fixture ─────────────────────────────────────────────────────────────
-- T1 = …1, T2 = …2.
-- a1 admin T1 · b1 comercial T1 · d1 soporte T1 · o1 operaciones T1 (sin Bandeja) · c1 contabilidad T1 (sin Bandeja)
-- x1 comercial T1 desactivado · f2 admin T2 · g2 comercial T2
insert into public.tenants values ('11111111-1111-1111-1111-111111111111'), ('11111111-1111-1111-1111-111111111112');
insert into auth.users values
  ('a0000000-0000-0000-0000-0000000000a1'), ('a0000000-0000-0000-0000-0000000000b1'),
  ('a0000000-0000-0000-0000-0000000000d1'), ('a0000000-0000-0000-0000-0000000000e1'),
  ('a0000000-0000-0000-0000-0000000000c1'), ('a0000000-0000-0000-0000-0000000000f1'),
  ('a0000000-0000-0000-0000-0000000000f2'), ('a0000000-0000-0000-0000-0000000000f3');
insert into public.user_tenants (user_id, tenant_id, role, disabled_at) values
  ('a0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'admin', null),
  ('a0000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'commercial', null),
  ('a0000000-0000-0000-0000-0000000000d1', '11111111-1111-1111-1111-111111111111', 'support', null),
  ('a0000000-0000-0000-0000-0000000000e1', '11111111-1111-1111-1111-111111111111', 'operations', null),
  ('a0000000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'accounting', null),
  ('a0000000-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'commercial', now()),
  ('a0000000-0000-0000-0000-0000000000f2', '11111111-1111-1111-1111-111111111112', 'admin', null),
  ('a0000000-0000-0000-0000-0000000000f3', '11111111-1111-1111-1111-111111111112', 'commercial', null);
-- Fichas: k1 y k2 en T1, kb borrada en T1, z1 en T2.
insert into public.clients (id, tenant_id, markbox, name, deleted_at) values
  ('c0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'SINT-0001', null, null),
  ('c0000000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'SINT-0002', 'SINT Dos', null),
  ('c0000000-0000-0000-0000-0000000000ab', '11111111-1111-1111-1111-111111111111', 'SINT-0003', null, now()),
  ('c0000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111112', 'SINT-0001', null, null);

\ir ../migrations/0554_chatwoot_contact_links.sql
-- Idempotente: aplicarla otra vez no falla ni cambia nada.
\ir ../migrations/0554_chatwoot_contact_links.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0554: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

create function pg_temp.u(p_user text) returns uuid language sql immutable as $$
  select ('a0000000-0000-0000-0000-0000000000' || p_user)::uuid;
$$;
create function pg_temp.k(p_c text) returns uuid language sql immutable as $$
  select ('c0000000-0000-0000-0000-0000000000' || p_c)::uuid;
$$;

-- Un valor como un usuario (authenticated con su sub) o, con null, como service_role.
create function pg_temp.valor(p_user uuid, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  if p_user is null then
    set local role service_role;
  else
    perform set_config('request.jwt.claim.sub', p_user::text, true);
    set local role authenticated;
  end if;
  execute 'select (' || p_sql || ')::text' into v;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v;
end;
$$;

create function pg_temp.falla(p_user uuid, p_sql text, p_estado text, p_label text) returns void language plpgsql as $$
declare v_estado text;
begin
  begin
    if p_user is null then
      set local role service_role;
    elsif p_user = '00000000-0000-0000-0000-000000000000'::uuid then
      set local role anon;
    else
      perform set_config('request.jwt.claim.sub', p_user::text, true);
      set local role authenticated;
    end if;
    execute p_sql;
    v_estado := null;
  exception when others then
    v_estado := sqlstate;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.assert_true(v_estado is not distinct from p_estado,
    p_label || ' (sqlstate: ' || coalesce(v_estado, 'ninguno') || ', esperado ' || p_estado || ')');
end;
$$;

create function pg_temp.visibles(p_user uuid) returns integer language sql as $$
  select pg_temp.valor(p_user, 'select count(*) from public.chatwoot_contact_links')::integer;
$$;

-- ── 1. Forma y privilegios ───────────────────────────────────────────────
select pg_temp.assert_true(to_regclass('public.chatwoot_contact_links') is not null, '1a: la tabla existe');
select pg_temp.assert_true((select relrowsecurity from pg_class where oid = 'public.chatwoot_contact_links'::regclass), '1b: con RLS');
select pg_temp.assert_true(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'chatwoot_contact_links'
    and column_name not in ('tenant_id', 'client_id', 'chatwoot_contact_id', 'origen', 'created_by', 'created_at')
), '1c: solo ids, origen y autoría: ni nombres ni teléfonos');
select pg_temp.assert_true(not has_table_privilege('anon', 'public.chatwoot_contact_links', 'select'), '1d: anon no lee');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.chatwoot_contact_links', 'insert,update,delete,truncate'),
  '1e: authenticated no escribe la tabla');
select pg_temp.assert_true(not has_function_privilege('authenticated', 'public.chatwoot_unir_contactos(uuid,text,jsonb)', 'execute'),
  '1f: authenticated no ejecuta la unión automática');
select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.chatwoot_unir_contacto_manual(uuid,uuid,uuid,bigint,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.chatwoot_unir_contacto_manual(uuid,uuid,uuid,bigint,text)', 'execute')
  and not has_function_privilege('anon', 'public.chatwoot_quitar_union(uuid,uuid,uuid,bigint,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.chatwoot_quitar_union(uuid,uuid,uuid,bigint,text)', 'execute')
  and has_function_privilege('service_role', 'public.chatwoot_unir_contacto_manual(uuid,uuid,uuid,bigint,text)', 'execute')
  and has_function_privilege('service_role', 'public.chatwoot_quitar_union(uuid,uuid,uuid,bigint,text)', 'execute'),
  '1g: unir y quitar a mano son solo de service_role (acotar por tenant en la base)');
select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'public.chatwoot_contact_links_actor_puede(uuid,uuid)', 'execute')
  and not has_function_privilege('service_role', 'public.chatwoot_contact_links_actor_puede(uuid,uuid)', 'execute'),
  '1g2: la comprobación del actor no se llama sola');
select pg_temp.assert_true(
  (select count(*) from public.audit_entity_types where entity_type = 'chatwoot_contact_link' and status = 'active') = 1,
  '1h: tipo de auditoría registrado una vez');

-- ── 2. Unión automática (service_role) ───────────────────────────────────
select pg_temp.assert_true(pg_temp.valor(null, format(
  $q$(select row(unidos, ya_estaban, otra_ficha, sin_ficha)::text from public.chatwoot_unir_contactos(%L, 'kommo', %L::jsonb))$q$,
  '11111111-1111-1111-1111-111111111111',
  jsonb_build_array(
    jsonb_build_object('client_id', pg_temp.k('a1'), 'contact_id', 101),
    jsonb_build_object('client_id', pg_temp.k('a1'), 'contact_id', 102),
    jsonb_build_object('client_id', pg_temp.k('a2'), 'contact_id', 201),
    jsonb_build_object('client_id', pg_temp.k('ab'), 'contact_id', 301),   -- ficha borrada
    jsonb_build_object('client_id', pg_temp.k('b1'), 'contact_id', 401)    -- ficha de OTRO tenant
  ))) = '(3,0,0,2)', '2a: une 3; la borrada y la de otro tenant no');
select pg_temp.assert_true(pg_temp.valor(null, format(
  $q$(select row(unidos, ya_estaban, otra_ficha, sin_ficha)::text from public.chatwoot_unir_contactos(%L, 'webhook', %L::jsonb))$q$,
  '11111111-1111-1111-1111-111111111111',
  jsonb_build_array(
    jsonb_build_object('client_id', pg_temp.k('a1'), 'contact_id', 101),   -- ya estaba
    jsonb_build_object('client_id', pg_temp.k('a2'), 'contact_id', 102)    -- es de k1: no se pisa
  ))) = '(0,1,1,0)', '2b: no repite ni pisa una unión existente');
select pg_temp.assert_true((select client_id from public.chatwoot_contact_links where chatwoot_contact_id = 102) = pg_temp.k('a1'),
  '2c: el contacto 102 sigue en k1');
select pg_temp.assert_true((select origen from public.chatwoot_contact_links where chatwoot_contact_id = 101) = 'kommo',
  '2d: el origen queda el del primero');
-- Una sola cuenta de Chatwoot: un contacto unido en T1 NO se une en T2 (cuenta como
-- otra_ficha, sin decir de qué tenant). Antes de la revisión de la F2 esto era «otra
-- unión»; ya no es un comportamiento deseado.
select pg_temp.assert_true(pg_temp.valor(null, format(
  $q$(select row(unidos, ya_estaban, otra_ficha, sin_ficha)::text from public.chatwoot_unir_contactos(%L, 'webhook', %L::jsonb))$q$,
  '11111111-1111-1111-1111-111111111112',
  jsonb_build_array(jsonb_build_object('client_id', pg_temp.k('b1'), 'contact_id', 101)))) = '(0,0,1,0)',
  '2e: el mismo contacto no se une en otro tenant');
select pg_temp.assert_true((select tenant_id from public.chatwoot_contact_links where chatwoot_contact_id = 101) = '11111111-1111-1111-1111-111111111111',
  '2e2: el contacto 101 sigue en T1');
-- Un contacto libre sí entra en T2.
select pg_temp.assert_true(pg_temp.valor(null, format(
  $q$(select unidos from public.chatwoot_unir_contactos(%L, 'webhook', %L::jsonb))$q$,
  '11111111-1111-1111-1111-111111111112',
  jsonb_build_array(jsonb_build_object('client_id', pg_temp.k('b1'), 'contact_id', 401)))) = '1',
  '2e3: un contacto libre se une en T2');
select pg_temp.falla(null, $q$select * from public.chatwoot_unir_contactos('11111111-1111-1111-1111-111111111111', 'manual', '[]'::jsonb)$q$,
  '22023', '2f: el origen manual no entra por la función automática');
select pg_temp.falla(null, $q$select * from public.chatwoot_unir_contactos('11111111-1111-1111-1111-111111111111', 'kommo', '[{"client_id":"x","contact_id":1}]'::jsonb)$q$,
  '22023', '2g: un par mal formado aborta todo');
select pg_temp.falla(null, $q$select * from public.chatwoot_unir_contactos('99999999-9999-9999-9999-999999999999', 'kommo', '[]'::jsonb)$q$,
  '22023', '2h: tenant inexistente');
select pg_temp.falla(pg_temp.u('a1'), $q$select * from public.chatwoot_unir_contactos('11111111-1111-1111-1111-111111111111', 'kommo', '[]'::jsonb)$q$,
  '42501', '2i: ni el admin de Studio llama la función automática');
select pg_temp.falla(null, $q$insert into public.chatwoot_contact_links (tenant_id, client_id, chatwoot_contact_id, origen) values ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-0000000000a2', 999, 'manual')$q$,
  '23514', '2j: una unión manual sin autor no entra');

-- ── 3. RLS de lectura: Bandeja y tenant ──────────────────────────────────
select pg_temp.assert_true(pg_temp.visibles(pg_temp.u('a1')) = 3, '3a: admin T1 ve las 3 de T1');
select pg_temp.assert_true(pg_temp.visibles(pg_temp.u('b1')) = 3, '3b: comercial T1 ve las 3');
select pg_temp.assert_true(pg_temp.visibles(pg_temp.u('d1')) = 3, '3c: soporte T1 ve las 3');
select pg_temp.assert_true(pg_temp.visibles(pg_temp.u('e1')) = 0, '3d: operaciones (sin Bandeja) no ve ninguna');
select pg_temp.assert_true(pg_temp.visibles(pg_temp.u('c1')) = 0, '3e: contabilidad (sin Bandeja) no ve ninguna');
select pg_temp.assert_true(pg_temp.visibles(pg_temp.u('f1')) = 0, '3f: un usuario desactivado no ve ninguna');
select pg_temp.assert_true(pg_temp.visibles(pg_temp.u('f2')) = 1, '3g: admin T2 ve solo la de T2');
select pg_temp.assert_true(pg_temp.valor(pg_temp.u('f3'),
  $q$select count(*) from public.chatwoot_contact_links where tenant_id = '11111111-1111-1111-1111-111111111111'$q$) = '0',
  '3h: comercial T2 pidiendo T1 por nombre no ve nada');
select pg_temp.falla('00000000-0000-0000-0000-000000000000'::uuid, 'select count(*) from public.chatwoot_contact_links',
  '42501', '3i: anon no lee');
select pg_temp.falla(pg_temp.u('b1'), $q$insert into public.chatwoot_contact_links (tenant_id, client_id, chatwoot_contact_id, origen, created_by) values ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-0000000000a2', 500, 'manual', 'a0000000-0000-0000-0000-0000000000b1')$q$,
  '42501', '3j: comercial no inserta directo');
select pg_temp.falla(pg_temp.u('a1'), $q$delete from public.chatwoot_contact_links$q$,
  '42501', '3k: admin no borra directo');

-- ── 4. Unión manual: solo service_role, y la base vuelve a comprobar al actor ──
-- Llamada como la hace el ERP: tenant y actor explícitos.
create function pg_temp.unir(p_tenant text, p_actor text, p_ficha text, p_contacto bigint, p_motivo text) returns text language sql as $$
  select format('select public.chatwoot_unir_contacto_manual(%L, %L, %L, %s, %L)',
    case p_tenant when 'T1' then '11111111-1111-1111-1111-111111111111' else '11111111-1111-1111-1111-111111111112' end,
    pg_temp.u(p_actor), pg_temp.k(p_ficha), p_contacto, p_motivo);
$$;
create function pg_temp.quitar(p_tenant text, p_actor text, p_ficha text, p_contacto bigint, p_motivo text) returns text language sql as $$
  select format('select public.chatwoot_quitar_union(%L, %L, %L, %s, %L)',
    case p_tenant when 'T1' then '11111111-1111-1111-1111-111111111111' else '11111111-1111-1111-1111-111111111112' end,
    pg_temp.u(p_actor), pg_temp.k(p_ficha), p_contacto, p_motivo);
$$;
-- Valor de una llamada como service_role (sin el «select» del frente).
create function pg_temp.servicio(p_sql text) returns text language sql as $$
  select pg_temp.valor(null, substring(p_sql from 8));
$$;

-- Ninguna sesión las ejecuta, ni del tenant dueño ni de otro.
select pg_temp.falla(pg_temp.u('b1'), pg_temp.unir('T1', 'b1', 'a2', 501, 'Es su chat de leads'),
  '42501', '4a: comercial del tenant dueño no la llama con su sesión');
select pg_temp.falla(pg_temp.u('a1'), pg_temp.unir('T1', 'a1', 'a2', 501, 'Es su chat de leads'),
  '42501', '4a2: ni el admin del tenant dueño');
select pg_temp.falla(pg_temp.u('f3'), pg_temp.unir('T2', 'f3', 'b1', 501, 'Es su chat de leads'),
  '42501', '4a3: ni alguien de otro tenant (no acapara contactos)');
-- service_role con un actor que no puede.
select pg_temp.falla(null, pg_temp.unir('T1', 'd1', 'a2', 501, 'Es su chat de leads'),
  '42501', '4b: actor soporte (solo lectura) no une');
select pg_temp.falla(null, pg_temp.unir('T1', 'e1', 'a2', 501, 'Es su chat de leads'),
  '42501', '4c: actor sin Bandeja no une');
select pg_temp.falla(null, pg_temp.unir('T1', 'f1', 'a2', 501, 'Es su chat de leads'),
  '42501', '4d: actor desactivado no une');
select pg_temp.falla(null, pg_temp.unir('T1', 'f3', 'a2', 501, 'Es su chat de leads'),
  '42501', '4e: actor de otro tenant no une en T1');
select pg_temp.falla(null, pg_temp.unir('T2', 'f2', 'a2', 501, 'Es su chat de leads'),
  'P0002', '4e2: actor de T2 no une a una ficha de T1');
select pg_temp.falla(null, pg_temp.unir('T1', 'b1', 'ab', 501, 'Es su chat de leads'),
  'P0002', '4f: no se une a una ficha borrada');
select pg_temp.falla(null, pg_temp.unir('T1', 'b1', 'a2', 501, '  ok '),
  '22023', '4g: motivo de menos de 4 caracteres');
select pg_temp.falla(null, pg_temp.unir('T1', 'b1', 'a2', 0, 'Es su chat de leads'),
  '22023', '4g2: contacto inválido');
select pg_temp.assert_true(not exists (select 1 from public.chatwoot_contact_links where chatwoot_contact_id = 501),
  '4g3: ningún intento rechazado dejó la unión');
select pg_temp.assert_true(pg_temp.servicio(pg_temp.unir('T1', 'b1', 'a2', 501, 'Es su chat de leads')) = 'unido',
  '4h: el ERP une por un comercial del tenant');
select pg_temp.assert_true(exists (
  select 1 from public.chatwoot_contact_links
  where chatwoot_contact_id = 501 and client_id = pg_temp.k('a2') and origen = 'manual' and created_by = pg_temp.u('b1')
), '4i: queda manual y con el actor real de autor');
select pg_temp.assert_true(exists (
  select 1 from public.entity_audit_log
  where entity_type = 'chatwoot_contact_link' and entity_id = pg_temp.k('a2') and actor_id = pg_temp.u('b1')
    and actor_type = 'user' and event_type = 'chatwoot_contact_linked' and reason = 'Es su chat de leads'
    and after_data = jsonb_build_object('chatwoot_contact_id', 501, 'origen', 'manual')
    and correlation_id is not null
), '4j: la auditoría registra al actor real, con motivo y sin datos personales');
select pg_temp.assert_true(pg_temp.servicio(pg_temp.unir('T1', 'b1', 'a2', 501, 'Otra vez la misma')) = 'ya_estaba',
  '4k: repetir devuelve ya_estaba');
select pg_temp.assert_true((select count(*) from public.entity_audit_log where event_type = 'chatwoot_contact_linked') = 1,
  '4l: repetir no deja otro evento');
select pg_temp.falla(null, pg_temp.unir('T1', 'a1', 'a2', 102, 'Mover el chat'),
  '23505', '4m: un chat unido a otra ficha no se mueve');
select pg_temp.falla(null, pg_temp.unir('T1', 'b1', 'a2', 401, 'Es de este cliente'),
  '23505', '4n: un chat unido en OTRO tenant falla igual que «otra ficha»');
select pg_temp.assert_true((select tenant_id from public.chatwoot_contact_links where chatwoot_contact_id = 401) = '11111111-1111-1111-1111-111111111112',
  '4o: y sigue en su tenant');
-- La comprobación del actor devuelve request.jwt.claim.sub como estaba.
create function pg_temp.sub_tras_unir() returns text language plpgsql as $$
declare v text;
begin
  set local role service_role;
  perform public.chatwoot_unir_contacto_manual('11111111-1111-1111-1111-111111111111', pg_temp.u('b1'), pg_temp.k('a2'), 501, 'Otra vez la misma');
  v := coalesce(current_setting('request.jwt.claim.sub', true), '');
  reset role;
  return v;
end;
$$;
select pg_temp.assert_true(pg_temp.sub_tras_unir() = '', '4p: deja request.jwt.claim.sub como estaba');

-- ── 5. Quitar una unión: igual ───────────────────────────────────────────
select pg_temp.falla(pg_temp.u('b1'), pg_temp.quitar('T1', 'b1', 'a2', 501, 'Fue un error'),
  '42501', '5a: comercial del tenant dueño no la llama con su sesión');
select pg_temp.falla(pg_temp.u('f2'), pg_temp.quitar('T2', 'f2', 'a2', 501, 'Fue un error'),
  '42501', '5a2: ni alguien de otro tenant');
select pg_temp.falla(null, pg_temp.quitar('T1', 'd1', 'a2', 501, 'Fue un error'),
  '42501', '5b: actor soporte no quita');
select pg_temp.falla(null, pg_temp.quitar('T1', 'f2', 'a2', 501, 'Fue un error'),
  '42501', '5c: actor de otro tenant no quita en T1');
select pg_temp.assert_true(not pg_temp.servicio(pg_temp.quitar('T2', 'f2', 'a2', 501, 'Fue un error'))::boolean,
  '5c2: con su propio tenant no alcanza una unión de T1');
select pg_temp.assert_true(exists (select 1 from public.chatwoot_contact_links where chatwoot_contact_id = 501),
  '5c3: la unión sigue después de los intentos');
select pg_temp.falla(null, pg_temp.quitar('T1', 'b1', 'a2', 501, 'no'),
  '22023', '5d: quitar exige motivo');
select pg_temp.assert_true(pg_temp.servicio(pg_temp.quitar('T1', 'b1', 'a2', 501, 'Fue un error'))::boolean,
  '5e: el ERP quita por un comercial del tenant');
select pg_temp.assert_true(not exists (select 1 from public.chatwoot_contact_links where chatwoot_contact_id = 501),
  '5f: la unión ya no está');
select pg_temp.assert_true(exists (
  select 1 from public.entity_audit_log
  where event_type = 'chatwoot_contact_unlinked' and entity_id = pg_temp.k('a2') and reason = 'Fue un error'
    and actor_id = pg_temp.u('b1') and actor_type = 'user'
    and before_data = jsonb_build_object('chatwoot_contact_id', 501, 'origen', 'manual')
), '5g: quitar deja evento con el antes y el actor real');
select pg_temp.assert_true(not pg_temp.servicio(pg_temp.quitar('T1', 'b1', 'a2', 501, 'Otra vez igual'))::boolean,
  '5h: quitar lo que no hay devuelve false');

-- ── 6. Borrar la ficha borra sus uniones ─────────────────────────────────
update public.clients set name = 'SINT cambio' where id = pg_temp.k('a1');
select pg_temp.assert_true((select count(*) from public.chatwoot_contact_links where client_id = pg_temp.k('a1')) = 2,
  '6a: otro cambio de la ficha no toca las uniones');
update public.clients set deleted_at = now() where id = pg_temp.k('a1');
select pg_temp.assert_true((select count(*) from public.chatwoot_contact_links where client_id = pg_temp.k('a1')) = 0,
  '6b: el borrado lógico se lleva las uniones');
select pg_temp.assert_true((
  select count(*) from public.entity_audit_log
  where entity_type = 'chatwoot_contact_link' and entity_id = pg_temp.k('a1')
    and event_type = 'chatwoot_contact_unlinked' and actor_type = 'system' and actor_id is null
    and before_data = jsonb_build_object('chatwoot_contact_ids', jsonb_build_array(101, 102), 'motivo', 'ficha_borrada')
    and after_data is null
) = 1, '6b2: una sola fila de auditoría, solo con los ids');
update public.clients set deleted_at = null where id = pg_temp.k('a1');
select pg_temp.assert_true((select count(*) from public.chatwoot_contact_links where client_id = pg_temp.k('a1')) = 0,
  '6b3: restaurar la ficha no restaura sus uniones');
update public.clients set deleted_at = now() where id = pg_temp.k('a1');
select pg_temp.assert_true((select count(*) from public.entity_audit_log where entity_id = pg_temp.k('a1') and event_type = 'chatwoot_contact_unlinked') = 1,
  '6b4: borrarla otra vez sin uniones no deja otra fila');
select pg_temp.assert_true((select count(*) from public.chatwoot_contact_links where client_id = pg_temp.k('a2')) = 1,
  '6c: las de otra ficha quedan');
delete from public.clients where id = pg_temp.k('a2');
select pg_temp.assert_true((select count(*) from public.chatwoot_contact_links where client_id = pg_temp.k('a2')) = 0,
  '6d: el borrado físico las borra en cascada');
select pg_temp.assert_true((select count(*) from public.chatwoot_contact_links where tenant_id = '11111111-1111-1111-1111-111111111112') = 1,
  '6e: las de otro tenant no se tocan');

select 'TEST 0554: ' || nextval('pg_temp.assertion_count') - 1 || ' aserciones OK' as resultado;

rollback;
