\set ON_ERROR_STOP on

-- SDD-0585 · contrato de 0508 (bajas de agentes de Chatwoot y purga por plazo).
--
-- Monta lo que la 0504 da por sentado (copia del montaje de su contrato), aplica la
-- 0504 REAL y después la 0508 REAL.
--
-- CONTROL ROJO: sin 0508 cae en la primera aserción (la purga no existe).
--
-- Termina siempre en ROLLBACK. Solo ids sintéticos.
begin;

do $roles$
begin
  if to_regclass('public.chatwoot_agent_bajas') is not null then
    raise exception 'Fixture 0508 rechazada: el objeto real ya existe';
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

create table public.tenants (id uuid primary key, slug text);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
grant select on public.user_tenants to authenticated;

-- Forma de 0383: phone_last10 generada desde phone.
create table public.clients (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  phone text,
  deleted_at timestamptz,
  phone_last10 text generated always as (
    case when length(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) >= 10
         then right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) end
  ) stored
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

create publication supabase_realtime;

insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001', 'dtd'),
  ('10000000-0000-0000-0000-000000000002', 'otro');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'commercial', null),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'admin', null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'admin', null);
-- T1: un cliente con 4125550101 (único), dos con 4125550102 (ambiguo), uno borrado con 4125550103.
insert into public.clients (id, tenant_id, phone, deleted_at) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '+58 412-555-0101', null),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '+584125550102', null),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '0412 555 0102', null),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '+584125550103', now()),
  -- T2 también tiene 4125550101: el cruce no cruza de tenant.
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', '+584125550101', null);

\ir ../migrations/0504_chatwoot_eventos.sql
\ir ../migrations/0508_chatwoot_bajas_purga.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0508: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Eventos y conversaciones sintéticos de T1 y T2, con fechas a cada lado de los plazos.
insert into public.chatwoot_webhook_events (tenant_id, event_key, event, conversation_id, status, received_at) values
  ('10000000-0000-0000-0000-000000000001', 'viejo-procesado', 'message_created', 1, 'procesado', now() - interval '91 days'),
  ('10000000-0000-0000-0000-000000000001', 'viejo-descartado', 'message_created', 1, 'descartado', now() - interval '120 days'),
  ('10000000-0000-0000-0000-000000000001', 'viejo-fallido', 'message_created', 1, 'fallido', now() - interval '120 days'),
  ('10000000-0000-0000-0000-000000000001', 'reciente-procesado', 'message_created', 1, 'procesado', now() - interval '89 days'),
  ('10000000-0000-0000-0000-000000000002', 'viejo-t2', 'message_created', 1, 'procesado', now() - interval '91 days');

insert into public.chatwoot_conversations (tenant_id, conversation_id, status, last_activity_at, updated_at) values
  ('10000000-0000-0000-0000-000000000001', 11, 'open', now() - interval '13 months', now() - interval '13 months'),
  ('10000000-0000-0000-0000-000000000001', 12, 'open', now() - interval '11 months', now() - interval '13 months'),
  ('10000000-0000-0000-0000-000000000001', 13, 'open', null, now() - interval '13 months'),
  ('10000000-0000-0000-0000-000000000001', 14, 'open', null, now() - interval '1 day'),
  ('10000000-0000-0000-0000-000000000002', 15, 'open', now() - interval '13 months', now());

insert into public.chatwoot_agent_bajas (tenant_id, chatwoot_user_id, baja_at) values
  ('10000000-0000-0000-0000-000000000001', 21, now() - interval '13 months'),
  ('10000000-0000-0000-0000-000000000001', 22, now() - interval '11 months'),
  ('10000000-0000-0000-0000-000000000002', 23, now() - interval '400 days');

do $purga$
declare
  r record;
  v_ids text[];
begin
  set local role service_role;
  select * into r from public.chatwoot_purgar_bandeja();
  reset role;

  perform pg_temp.assert_true(r.eventos = 3, 'la purga borra 3 eventos viejos (procesado y descartado, de los dos tenants)');
  select array_agg(event_key order by event_key) into v_ids from public.chatwoot_webhook_events;
  perform pg_temp.assert_true(
    v_ids = array['reciente-procesado', 'viejo-fallido'],
    'quedan el evento de 89 días y el fallido, que todavía puede reintentarse');

  perform pg_temp.assert_true(r.conversaciones = 3, 'la purga borra 3 conversaciones sin actividad en 12 meses');
  select array_agg(conversation_id::text order by conversation_id) into v_ids from public.chatwoot_conversations;
  perform pg_temp.assert_true(
    v_ids = array['12', '14'],
    'quedan la de actividad reciente y la recién creada sin actividad');

  set local role service_role;
  select * into r from public.chatwoot_purgar_bandeja();
  reset role;
  perform pg_temp.assert_true(r.eventos = 0 and r.conversaciones = 0, 'una segunda purga no borra nada');
end;
$purga$;

do $vencidas$
declare
  v_ids text[];
begin
  set local role service_role;
  select array_agg(chatwoot_user_id::text order by chatwoot_user_id) into v_ids from public.chatwoot_bajas_vencidas();
  reset role;
  perform pg_temp.assert_true(v_ids = array['21', '23'], 'vencidas: las bajas de más de 12 meses, de todos los tenants');

  set local role service_role;
  insert into public.chatwoot_agent_bajas (tenant_id, chatwoot_user_id) values ('10000000-0000-0000-0000-000000000001', 24);
  delete from public.chatwoot_agent_bajas where chatwoot_user_id = 21;
  reset role;
  perform pg_temp.assert_true(
    (select baja_at from public.chatwoot_agent_bajas where chatwoot_user_id = 24) > now() - interval '1 minute',
    'service_role registra una baja con la fecha de hoy y borra la fila');
end;
$vencidas$;

do $acceso$
begin
  perform pg_temp.assert_true(
    not has_table_privilege('authenticated', 'public.chatwoot_agent_bajas', 'SELECT')
    and not has_table_privilege('authenticated', 'public.chatwoot_agent_bajas', 'INSERT')
    and not has_table_privilege('anon', 'public.chatwoot_agent_bajas', 'SELECT'),
    'las bajas son solo de service_role');
  perform pg_temp.assert_true(
    (select relrowsecurity from pg_class where oid = 'public.chatwoot_agent_bajas'::regclass),
    'las bajas tienen RLS');
  perform pg_temp.assert_true(
    not has_function_privilege('authenticated', 'public.chatwoot_purgar_bandeja()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.chatwoot_purgar_bandeja()', 'EXECUTE'),
    'la purga es solo de service_role');
  perform pg_temp.assert_true(
    not has_function_privilege('authenticated', 'public.chatwoot_bajas_vencidas()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.chatwoot_bajas_vencidas()', 'EXECUTE'),
    'las vencidas son solo de service_role');
  perform pg_temp.assert_true(not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'chatwoot_agent_bajas'
      and column_name ~ '(phone|content|name|email|text|user_id$)' and column_name <> 'chatwoot_user_id'
  ), 'las bajas no guardan correo, nombre ni el usuario de Studio');
end;
$acceso$;

select 'TEST 0508 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
