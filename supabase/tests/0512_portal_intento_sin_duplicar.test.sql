\set ON_ERROR_STOP on
-- SDD-0599: un reintento con el mismo identificador no crea otra fila ni otro mensaje.
-- RED causal: -v apply_fix=false. GREEN: aplica la migración real 0512.
-- -v drift=true quita el índice de 0106: el preflight tiene que rechazarlo.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
\if :{?drift}
\else
\set drift false
\endif

begin;

do $fixture_guard$
begin
  if to_regnamespace('auth') is not null or to_regclass('public.clients') is not null then
    raise exception 'TEST 0512 requiere una base PostgreSQL desechable vacía';
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
-- Dependencias mínimas de 0006, 0007, 0080, 0105, 0106 y 0152, no copias de sus policies.
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
create function public.assert_tenant_match(p_tenant_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_tenant_id is distinct from public.get_user_tenant_id() then
    raise exception 'tenant ajeno' using errcode = '42501';
  end if;
end;
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create type public.shipment_service as enum (
  'consolidacion', 'puerta_a_puerta_DDP', 'reserva_FCL', 'transporte_terrestre'
);
create table public.rates (id uuid primary key);
create table public.shipments (
  id uuid primary key, tenant_id uuid, client_markbox text, deleted_at timestamptz
);
alter table public.shipments enable row level security;
create publication supabase_realtime;

-- tenants vacío evita el seed demo histórico de 0006 y 0152.
\ir ../migrations/0006_clients.sql
\ir ../migrations/0007_quotes.sql
\ir ../migrations/0080_portal_cliente.sql
\ir ../migrations/0105_portal_compras.sql
\ir ../migrations/0106_conversaciones.sql
\ir ../migrations/0152_client_claims.sql

-- Estado efectivo posterior a los barridos ACL 0209/0211/0276/0285, y RPC vigente.
revoke execute on function public.portal_post_message(text) from public, anon;
grant execute on function public.portal_post_message(text) to authenticated, service_role;
revoke execute on function public.next_conversation_ref(uuid) from public, anon, authenticated;
grant execute on function public.next_conversation_ref(uuid) to service_role;
\ir ../migrations/0431_portal_post_message_principal_tenant.sql

create function pg_temp.fixture_id(label text) returns uuid language sql immutable as $$
  select md5('0512-synthetic-' || label)::uuid
$$;
create temporary sequence assertion_count;
grant usage on sequence assertion_count to authenticated, service_role;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'TEST 0512: %', label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;
-- El nombre del índice con el que chocó la sentencia, o NULL si no chocó.
create function pg_temp.choque(sentencia text) returns text language plpgsql as $$
declare v_nombre text;
begin
  execute sentencia;
  return null;
exception when unique_violation then
  get stacked diagnostics v_nombre = constraint_name;
  return v_nombre;
end;
$$;

insert into public.tenants values
  (pg_temp.fixture_id('tenant-A'), 'synthetic-a'),
  (pg_temp.fixture_id('tenant-B'), 'synthetic-b');
insert into auth.users (id, email)
select pg_temp.fixture_id(actor), actor || '@example.invalid'
from unnest(array['portal-A', 'portal-A2', 'portal-B', 'revoked']) actor;
insert into public.clients (id, tenant_id, markbox, name)
select pg_temp.fixture_id(client), pg_temp.fixture_id(tenant), markbox, client_name
from (values
  ('client-A', 'tenant-A', 'DTD-A', 'Cliente A'),
  ('client-A2', 'tenant-A', 'DTD-A2', 'Cliente A2'),
  ('client-B', 'tenant-B', 'DTD-A', 'Cliente B, mismo Shipping Mark en otro tenant'),
  ('client-revoked', 'tenant-A', 'DTD-R', 'Cliente revocado')
) fixture(client, tenant, markbox, client_name);
insert into public.client_users (auth_user_id, tenant_id, client_id, email, status)
select pg_temp.fixture_id(actor), pg_temp.fixture_id(tenant), pg_temp.fixture_id(client),
  actor || '@example.invalid', status
from (values
  ('portal-A', 'tenant-A', 'client-A', 'active'),
  ('portal-A2', 'tenant-A', 'client-A2', 'active'),
  ('portal-B', 'tenant-B', 'client-B', 'active'),
  ('revoked', 'tenant-A', 'client-revoked', 'revoked')
) fixture(actor, tenant, client, status);

-- Filas de antes de la migración: quedan fuera del índice y sin tocar.
insert into public.prealertas (tenant_id, client_markbox, code, description, boxes)
select pg_temp.fixture_id('tenant-A'), 'DTD-A', 'P-HIST-' || n, 'Compra histórica', 1
from generate_series(1, 2) n;
insert into public.quotes (tenant_id, quote_code, client_markbox, client_name, service, origin, destination, subtotal_usd, total_usd)
select pg_temp.fixture_id('tenant-A'), 'Q-HIST-' || n, 'DTD-A', 'Cliente A', 'consolidacion', 'China', 'Caracas', 0, 0
from generate_series(1, 2) n;
insert into public.client_claims (tenant_id, claim_code, client_markbox, claim_type, description)
select pg_temp.fixture_id('tenant-A'), 'RC-HIST-' || n, 'DTD-A', 'otro', 'Reclamo histórico'
from generate_series(1, 2) n;
create temporary table filas_antes as
select (select jsonb_agg(to_jsonb(p) order by code) from public.prealertas p) prealertas,
  (select jsonb_agg(to_jsonb(q) order by quote_code) from public.quotes q) quotes,
  (select jsonb_agg(to_jsonb(c) order by claim_code) from public.client_claims c) claims;

\if :drift
drop index public.conversation_messages_external_idx;
\endif

\if :apply_fix
\ir ../migrations/0512_portal_intento_sin_duplicar.sql
create temporary table funcion_primera as
select pg_get_functiondef(p.oid) definicion, obj_description(p.oid, 'pg_proc') comentario, p.proacl
from pg_proc p where p.oid = to_regprocedure('public.portal_post_message(text, uuid)');
\ir ../migrations/0512_portal_intento_sin_duplicar.sql
select pg_temp.assert_true((select to_jsonb(f) from funcion_primera f) = (
  select to_jsonb(actual) from (
    select pg_get_functiondef(p.oid) definicion, obj_description(p.oid, 'pg_proc') comentario, p.proacl
    from pg_proc p where p.oid = to_regprocedure('public.portal_post_message(text, uuid)')
  ) actual), 'Reejecutar 0512 conserva definición, comentario y ACL');
\endif

-- ── Las columnas y sus candados ──────────────────────────────────
select pg_temp.assert_true((
  select count(*) = 3 from pg_attribute a
  where a.attrelid = any (array[to_regclass('public.prealertas'), to_regclass('public.quotes'), to_regclass('public.client_claims')]::oid[])
    and a.attname = 'client_request_id' and a.atttypid = 'uuid'::regtype
    and not a.attnotnull and not a.atthasdef and not a.attisdropped
), 'Las tres tablas tienen client_request_id uuid, nullable y sin default');

select pg_temp.assert_true((
  select count(*) = 3 from pg_indexes i
  where i.schemaname = 'public' and i.indexname in (
      'prealertas_client_request_uidx', 'quotes_client_request_uidx', 'client_claims_client_request_uidx'
    )
    and i.indexdef like 'CREATE UNIQUE INDEX %(tenant_id, client_markbox, client_request_id) WHERE (client_request_id IS NOT NULL)'
), 'Los tres índices son únicos, parciales y por tenant y Shipping Mark');

select pg_temp.assert_true((select prealertas from filas_antes) =
    (select jsonb_agg(to_jsonb(p) - 'client_request_id' order by code) from public.prealertas p)
  and (select quotes from filas_antes) =
    (select jsonb_agg(to_jsonb(q) - 'client_request_id' order by quote_code) from public.quotes q)
  and (select claims from filas_antes) =
    (select jsonb_agg(to_jsonb(c) - 'client_request_id' order by claim_code) from public.client_claims c),
  'La migración no cambia ninguna fila existente');

-- ── Compras ──────────────────────────────────────────────────────
create function pg_temp.compra(tenant text, markbox text, code text, intento text) returns text
language sql as $$
  select pg_temp.choque(format(
    'insert into public.prealertas (tenant_id, client_markbox, code, description, boxes, client_request_id) values (%L, %L, %L, %L, 1, %L)',
    pg_temp.fixture_id(tenant), markbox, code, 'Compra', case when intento is null then null else pg_temp.fixture_id(intento) end
  ));
$$;
select pg_temp.assert_true(pg_temp.compra('tenant-A', 'DTD-A', 'P-1', 'intento-1') is null,
  'Primer intento de compra entra');
select pg_temp.assert_true(pg_temp.compra('tenant-A', 'DTD-A', 'P-2', 'intento-1') = 'prealertas_client_request_uidx',
  'Mismo intento con otro código choca en el índice del intento, no en el del código');
select pg_temp.assert_true(pg_temp.compra('tenant-A', 'DTD-A', 'P-1', 'intento-2') = 'prealertas_tenant_id_code_key',
  'El choque de código sigue siendo el de siempre, y se distingue por su nombre');
select pg_temp.assert_true(pg_temp.compra('tenant-A', 'DTD-A2', 'P-3', 'intento-1') is null,
  'Mismo intento en otro Shipping Mark no choca');
select pg_temp.assert_true(pg_temp.compra('tenant-B', 'DTD-A', 'P-1', 'intento-1') is null,
  'Mismo intento y Shipping Mark en otro tenant no choca');
select pg_temp.assert_true(pg_temp.compra('tenant-A', 'DTD-A', 'P-4', null) is null
  and pg_temp.compra('tenant-A', 'DTD-A', 'P-5', null) is null,
  'Sin identificador no hay candado: un POST sin JavaScript queda como hoy');
select pg_temp.assert_true((
  select count(*) = 1 from public.prealertas
  where tenant_id = pg_temp.fixture_id('tenant-A') and client_markbox = 'DTD-A'
    and client_request_id = pg_temp.fixture_id('intento-1')
), 'El mismo intento deja una sola compra');

-- ── Cotizaciones ─────────────────────────────────────────────────
create function pg_temp.cotizacion(markbox text, code text, intento text) returns text language sql as $$
  select pg_temp.choque(format(
    'insert into public.quotes (tenant_id, quote_code, client_markbox, client_name, service, origin, destination, subtotal_usd, total_usd, client_request_id) values (%L, %L, %L, %L, %L, %L, %L, 0, 0, %L)',
    pg_temp.fixture_id('tenant-A'), code, markbox, 'Cliente', 'consolidacion', 'China', 'Caracas', pg_temp.fixture_id(intento)
  ));
$$;
select pg_temp.assert_true(pg_temp.cotizacion('DTD-A', 'Q-1', 'intento-1') is null,
  'Primer intento de cotización entra');
select pg_temp.assert_true(pg_temp.cotizacion('DTD-A', 'Q-2', 'intento-1') = 'quotes_client_request_uidx',
  'Mismo intento de cotización choca en su índice');
select pg_temp.assert_true(pg_temp.cotizacion('DTD-A2', 'Q-3', 'intento-1') is null,
  'Mismo intento de cotización en otro Shipping Mark no choca');

-- ── Reclamos ─────────────────────────────────────────────────────
create function pg_temp.reclamo(markbox text, code text, intento text) returns text language sql as $$
  select pg_temp.choque(format(
    'insert into public.client_claims (tenant_id, claim_code, client_markbox, claim_type, description, client_request_id) values (%L, %L, %L, %L, %L, %L)',
    pg_temp.fixture_id('tenant-A'), code, markbox, 'otro', 'Reclamo', pg_temp.fixture_id(intento)
  ));
$$;
select pg_temp.assert_true(pg_temp.reclamo('DTD-A', 'RC-1', 'intento-1') is null,
  'Primer intento de reclamo entra');
select pg_temp.assert_true(pg_temp.reclamo('DTD-A', 'RC-2', 'intento-1') = 'client_claims_client_request_uidx',
  'Mismo intento de reclamo choca en su índice');
select pg_temp.assert_true(pg_temp.reclamo('DTD-A2', 'RC-3', 'intento-1') is null,
  'Mismo intento de reclamo en otro Shipping Mark no choca');

-- ── La columna se puede escribir desde la sesión del portal ──────
savepoint sesion_portal;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
select pg_temp.assert_true(pg_temp.compra('tenant-A', 'DTD-A', 'P-SESION', 'intento-sesion') is null,
  'El cliente del portal inserta su compra con identificador, bajo su RLS');
reset role;
select pg_temp.assert_true((
  select count(*) = 1 from public.prealertas where code = 'P-SESION'
    and client_request_id = pg_temp.fixture_id('intento-sesion')
), 'La compra de la sesión queda con su identificador');
rollback to sesion_portal;
release sesion_portal;

-- ── Mensajes ─────────────────────────────────────────────────────
create function pg_temp.mensaje(actor text, cuerpo text, intento text) returns jsonb language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.fixture_id(actor)::text, ''), true);
  return public.portal_post_message(cuerpo, case when intento is null then null else pg_temp.fixture_id(intento) end);
end;
$$;
create function pg_temp.mensaje_rechazado(actor text, cuerpo text, intento text, estado text) returns boolean
language plpgsql as $$
begin
  perform pg_temp.mensaje(actor, cuerpo, intento);
  return false;
exception when others then
  return sqlstate = estado;
end;
$$;

set local role authenticated;
select set_config('test.primero', pg_temp.mensaje('portal-A', '  primer mensaje  ', 'msg-1')::text, true);
reset role;
select pg_temp.assert_true((current_setting('test.primero')::jsonb ->> 'replayed')::boolean = false,
  'El primer envío de un mensaje dice que no es repetido');
select pg_temp.assert_true((
  select count(*) = 1 and bool_and(m.body = 'primer mensaje' and m.direction = 'in' and m.author_name = 'Cliente A'
      and m.tenant_id = pg_temp.fixture_id('tenant-A')
      and m.external_msg_id = 'portal:' || pg_temp.fixture_id('client-A') || ':' || pg_temp.fixture_id('msg-1'))
  from public.conversation_messages m
), 'El mensaje entra normalizado, en el hilo de su cliente y con su identificador');
select pg_temp.assert_true((
  select c.unread_count = 1 and c.client_id = pg_temp.fixture_id('client-A') and c.channel = 'portal'
  from public.conversations c
), 'Crea el hilo Portal del cliente con un no leído');

update public.conversations set status = 'resuelto', last_message_at = 'epoch';
set local role authenticated;
select set_config('test.repetido', pg_temp.mensaje('portal-A', 'primer mensaje, corregido tras el corte', 'msg-1')::text, true);
reset role;
select pg_temp.assert_true((current_setting('test.repetido')::jsonb ->> 'replayed')::boolean = true
  and current_setting('test.repetido')::jsonb ->> 'conversation_id' = current_setting('test.primero')::jsonb ->> 'conversation_id',
  'El reintento responde repetido, con el mismo hilo');
select pg_temp.assert_true((
  select count(*) = 1 and bool_and(body = 'primer mensaje') from public.conversation_messages
), 'El reintento no crea otro mensaje, y vale el texto del primero');
select pg_temp.assert_true((
  select unread_count = 1 and status = 'resuelto' and last_message_at = 'epoch' from public.conversations
), 'El reintento no suma un no leído, no reabre el hilo ni cambia su fecha');

set local role authenticated;
select pg_temp.assert_true((pg_temp.mensaje('portal-A', 'segundo mensaje', 'msg-2') ->> 'replayed')::boolean = false,
  'Otro identificador es otro mensaje');
reset role;
select pg_temp.assert_true((
  select unread_count = 2 and status = 'abierto' from public.conversations
) and (select count(*) = 2 from public.conversation_messages),
  'Otro mensaje suma un no leído y reabre el hilo, como antes');

set local role authenticated;
select pg_temp.assert_true((pg_temp.mensaje('portal-A2', 'de otro cliente', 'msg-1') ->> 'replayed')::boolean = false,
  'El mismo identificador en otro cliente del tenant no choca ni dice que ya existe');
reset role;
select pg_temp.assert_true((select count(*) = 2 from public.conversations)
  and (select count(*) = 3 from public.conversation_messages),
  'El otro cliente tiene su propio hilo y su propio mensaje');

-- Si el hilo se archivó entre un intento y otro, el reintento no abre uno vacío.
update public.conversations set deleted_at = now() where client_id = pg_temp.fixture_id('client-A2');
set local role authenticated;
select pg_temp.assert_true((pg_temp.mensaje('portal-A2', 'de otro cliente', 'msg-1') ->> 'replayed')::boolean = true,
  'Con el hilo archivado, el reintento sigue siendo repetido');
reset role;
select pg_temp.assert_true((select count(*) = 2 from public.conversations),
  'El reintento no abre un hilo nuevo');
update public.conversations set deleted_at = null where client_id = pg_temp.fixture_id('client-A2');

set local role authenticated;
select pg_temp.assert_true(pg_temp.mensaje_rechazado('portal-A', 'sin identificador', null, '22023'),
  'La firma nueva exige identificador');
select pg_temp.assert_true(pg_temp.mensaje_rechazado('revoked', 'bloqueado', 'msg-3', '42501'),
  'Vínculo revocado falla 42501 antes de escribir');
select pg_temp.assert_true(pg_temp.mensaje_rechazado('portal-A', '   ', 'msg-4', 'P0001'),
  'Cuerpo vacío sigue rechazado');
select pg_temp.assert_true(pg_temp.mensaje_rechazado('portal-A', repeat('x', 4001), 'msg-5', 'P0001'),
  'Cuerpo de más de 4000 sigue rechazado');
reset role;
select pg_temp.assert_true((select count(*) = 3 from public.conversation_messages),
  'Las entradas rechazadas no escriben');

-- ── La firma vieja sigue viva para la web anterior ───────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
select set_config('test.vieja', public.portal_post_message('desde la web anterior')::text, true);
reset role;
select pg_temp.assert_true(current_setting('test.vieja')::uuid = (current_setting('test.primero')::jsonb ->> 'conversation_id')::uuid
  and (select count(*) = 1 from public.conversation_messages
    where body = 'desde la web anterior' and external_msg_id is null),
  'La firma vieja sigue escribiendo, sin identificador');

-- ── Privilegios ──────────────────────────────────────────────────
select pg_temp.assert_true(not has_function_privilege('anon', 'public.portal_post_message(text, uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.portal_post_message(text, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.portal_post_message(text, uuid)', 'execute')
  and not exists (
    select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.portal_post_message(text, uuid)'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ), 'ACL niega anon y PUBLIC, y permite authenticated y service_role');
select pg_temp.assert_true((
  select p.prosecdef and p.prorettype = 'jsonb'::regtype
    and p.proconfig = array['search_path=pg_catalog, public']
  from pg_proc p where p.oid = 'public.portal_post_message(text, uuid)'::regprocedure
), 'La firma nueva es SECURITY DEFINER, devuelve jsonb y fija search_path');

select 'TEST 0512 GREEN: ' || last_value || ' aserciones' as resultado from assertion_count;

rollback;
select to_regclass('public.clients') is null and to_regnamespace('auth') is null
  as fixture_0512_rolled_back;
