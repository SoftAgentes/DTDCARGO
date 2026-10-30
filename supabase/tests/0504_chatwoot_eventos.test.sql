\set ON_ERROR_STOP on

-- SDD-0585 · contrato de 0504 (eventos de Chatwoot, estado por conversación y cruce).
--
-- Monta lo mínimo que 0504 da por sentado: auth.uid() leyendo el JWT, tenants,
-- user_tenants, clients con phone_last10 (forma de 0383) y get_user_tenant_id()
-- (copia de 0453), más la publicación supabase_realtime. Después aplica la 0504 REAL.
--
-- CONTROL ROJO: sin 0504 cae en la primera aserción (la RPC no existe).
--
-- Termina siempre en ROLLBACK. Solo ids y teléfonos sintéticos (555).
begin;

do $roles$
begin
  if to_regclass('public.chatwoot_conversations') is not null then
    raise exception 'Fixture 0504 rechazada: el objeto real ya existe';
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

create publication supabase_realtime;

insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001', 'dtd'),
  ('10000000-0000-0000-0000-000000000002', 'otro');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'commercial', null),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'admin', null);
-- T1: un cliente con 4125550101 (único), dos con 4125550102 (ambiguo), uno borrado con 4125550103.
insert into public.clients (id, tenant_id, phone, deleted_at) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '+58 412-555-0101', null),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '+584125550102', null),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '0412 555 0102', null),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '+584125550103', now()),
  -- T2 también tiene 4125550101: el cruce no cruza de tenant.
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', '+584125550101', null);

\ir ../migrations/0504_chatwoot_eventos.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0504: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Llama la RPC como service_role (lo que hace la ruta del webhook).
create function pg_temp.evento(
  p_key text, p_conv bigint, p_status text, p_unread integer, p_phone text, p_ts double precision,
  p_tenant uuid default '10000000-0000-0000-0000-000000000001'
) returns record language plpgsql as $$
declare r record;
begin
  set local role service_role;
  select * into r from public.chatwoot_registrar_evento(
    p_tenant, p_key, case when p_key like 'conversation_status_changed%' then 'conversation_status_changed' else 'message_created' end,
    p_conv, 3, p_status, p_unread, 7, p_phone, to_timestamp(p_ts), p_ts);
  reset role;
  return r;
end;
$$;

create function pg_temp.ve(p_user uuid) returns integer language plpgsql as $$
declare v integer;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  select count(*) into v from public.chatwoot_conversations;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v;
end;
$$;

do $eventos$
declare
  r record;
  t1 constant uuid := '10000000-0000-0000-0000-000000000001';
begin
  r := pg_temp.evento('message_created:101', 12, 'open', 1, '4125550101', 1000);
  perform pg_temp.assert_true(r.nuevo and r.aplicado, 'un evento nuevo se registra y se aplica');
  perform pg_temp.assert_true(r.client_id = '30000000-0000-0000-0000-000000000001', 'el teléfono único cruza con su cliente');
  perform pg_temp.assert_true(
    (select unread_count = 1 and status = 'open' and inbox_id = 3 and assignee_id = 7
     from public.chatwoot_conversations where tenant_id = t1 and conversation_id = 12),
    'el estado queda guardado');

  r := pg_temp.evento('message_created:101', 12, 'open', 5, '4125550101', 2000);
  perform pg_temp.assert_true(not r.nuevo and not r.aplicado, 'el mismo evento otra vez no hace nada');
  perform pg_temp.assert_true(
    (select unread_count from public.chatwoot_conversations where tenant_id = t1 and conversation_id = 12) = 1,
    'el duplicado no cambia el estado');

  r := pg_temp.evento('message_created:103', 12, 'open', 3, '4125550101', 3000);
  r := pg_temp.evento('message_created:102', 12, 'open', 2, '4125550101', 2500);
  perform pg_temp.assert_true(r.nuevo and not r.aplicado, 'un evento más viejo se registra pero no pisa el estado');
  perform pg_temp.assert_true(
    (select unread_count from public.chatwoot_conversations where tenant_id = t1 and conversation_id = 12) = 3,
    'queda el estado del evento más nuevo');

  r := pg_temp.evento('conversation_status_changed:12:resolved:3500', 12, 'resolved', 0, null, 3500);
  perform pg_temp.assert_true(
    (select status = 'resolved' and unread_count = 0 and client_id = '30000000-0000-0000-0000-000000000001'
     from public.chatwoot_conversations where tenant_id = t1 and conversation_id = 12),
    'sin teléfono en el evento se conserva el cliente cruzado');

  r := pg_temp.evento('message_created:201', 20, 'open', 1, '4125550102', 1000);
  perform pg_temp.assert_true(r.client_id is null, 'un teléfono con dos clientes no cruza (no adivina)');
  r := pg_temp.evento('message_created:301', 30, 'open', 1, '4125550103', 1000);
  perform pg_temp.assert_true(r.client_id is null, 'un cliente borrado no cruza');
  r := pg_temp.evento('message_created:401', 40, 'open', 1, '58412', 1000);
  perform pg_temp.assert_true(r.client_id is null, 'un teléfono que no son 10 dígitos no cruza');

  r := pg_temp.evento('message_created:101', 12, 'open', 1, '4125550101', 1000, '10000000-0000-0000-0000-000000000002');
  perform pg_temp.assert_true(r.nuevo, 'la misma clave en otro tenant es otro evento');
  perform pg_temp.assert_true(r.client_id = '30000000-0000-0000-0000-000000000005', 'el cruce usa los clientes del tenant del evento');

  -- Reconciliación: sin event_key, no deja evento y aplica si es más nuevo.
  set local role service_role;
  select * into r from public.chatwoot_registrar_evento(t1, null, null, 20, 3, 'open', 0, null, null, to_timestamp(5000), 5000);
  reset role;
  perform pg_temp.assert_true(r.nuevo and r.aplicado, 'la reconciliación aplica sin evento');
  perform pg_temp.assert_true(
    (select count(*) from public.chatwoot_webhook_events where conversation_id = 20) = 1,
    'la reconciliación no deja fila de evento');

  perform pg_temp.assert_true(
    (select count(*) from public.chatwoot_conversations where tenant_id = t1 and status = 'open' and unread_count > 0) = 2,
    'el contador del tenant cuenta las abiertas con no leídos');
end;
$eventos$;

do $acceso$
begin
  perform pg_temp.assert_true(pg_temp.ve('20000000-0000-0000-0000-000000000001') = 4, 'un usuario de T1 ve las conversaciones de T1');
  perform pg_temp.assert_true(pg_temp.ve('20000000-0000-0000-0000-000000000002') = 1, 'un usuario de T2 ve solo las de T2');
  perform pg_temp.assert_true(
    not has_table_privilege('authenticated', 'public.chatwoot_webhook_events', 'SELECT'),
    'authenticated no lee los eventos');
  perform pg_temp.assert_true(
    not has_table_privilege('authenticated', 'public.chatwoot_conversations', 'INSERT')
    and not has_table_privilege('authenticated', 'public.chatwoot_conversations', 'UPDATE'),
    'authenticated no escribe conversaciones');
  perform pg_temp.assert_true(
    not has_function_privilege('authenticated', 'public.chatwoot_registrar_evento(uuid, text, text, bigint, bigint, text, integer, bigint, text, timestamptz, double precision)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.chatwoot_registrar_evento(uuid, text, text, bigint, bigint, text, integer, bigint, text, timestamptz, double precision)', 'EXECUTE'),
    'la RPC es solo de service_role');
  perform pg_temp.assert_true(exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chatwoot_conversations'
  ), 'chatwoot_conversations entra en supabase_realtime');
  perform pg_temp.assert_true(not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name in ('chatwoot_conversations', 'chatwoot_webhook_events')
      and column_name ~ '(phone|content|name|email|text)'
  ), 'ninguna columna guarda teléfono, texto, nombre ni correo');
end;
$acceso$;

select 'TEST 0504 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
