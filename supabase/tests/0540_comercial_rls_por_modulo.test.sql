\set ON_ERROR_STOP on

-- SDD-0622 · contrato de la 0540 (RLS de tablas comerciales por módulo).
--
-- Reusa el fixture de la 0538 (tenants, miembros, helpers de 0453/0386, doble
-- de append_audit_event) con la 0357 y la 0538 REALES, crea las tablas
-- comerciales con la forma mínima y una copia LITERAL de las policies que la
-- 0540 reemplaza, y aplica la 0540 REAL.
--
-- Lo que defiende (auditoría de permisos 2026-11-11): support no escribe;
-- marketing y almacén fuera de la CN no leen tarifas; lo que ya funcionaba
-- (comercial, contabilidad, almacén CN por la propuesta de tarifa) sigue; un
-- acceso adicional abre lo que el rol no da.
--
-- CONTROL ROJO: sin 0540 cae en «1b: support no crea cotizaciones».
-- Termina siempre en ROLLBACK. Solo ids y textos sintéticos.
begin;

do $roles$
begin
  if to_regclass('public.studio_user_module_grants') is not null then
    raise exception 'Fixture 0538 rechazada: el objeto real ya existe';
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
  warehouse_scope text not null default 'all',
  primary key (user_id, tenant_id)
);
grant select on public.user_tenants to authenticated;

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

-- Forma de 0288.
create table public.platform_admins (user_id uuid primary key);
create function public.is_platform_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;
grant execute on function public.is_platform_admin() to authenticated;

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
  occurred_at timestamptz not null default now()
);
grant select on public.entity_audit_log to authenticated;

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
  insert into public.entity_audit_log (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, reason, before_data, after_data, payload)
  values (p_tenant_id, p_entity_type, p_entity_id, p_actor_type, p_actor_id, p_event_type, p_reason, p_before_data, p_after_data, p_payload)
  returning id into v_id;
  return v_id;
end;
$fn$;
revoke all on function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text) from public, anon, authenticated;

-- ── Fixture ─────────────────────────────────────────────────────────────
-- T1 = 1…1, T2 = 1…2.
-- a1 admin T1 · a2 admin T1 superadmin · c1 contabilidad que también atiende el CRM · c2 contabilidad
-- k1 comercial · s1 support · w1 almacén con scope VE · x1 contabilidad desactivada · o1 admin T2
insert into public.tenants values ('11111111-1111-1111-1111-111111111111'), ('11111111-1111-1111-1111-111111111112');
insert into auth.users values
  ('a0000000-0000-0000-0000-0000000000a1'), ('a0000000-0000-0000-0000-0000000000a2'),
  ('a0000000-0000-0000-0000-0000000000c1'), ('a0000000-0000-0000-0000-0000000000c2'),
  ('a0000000-0000-0000-0000-0000000000b1'), ('a0000000-0000-0000-0000-0000000000d1'),
  ('a0000000-0000-0000-0000-0000000000e1'), ('a0000000-0000-0000-0000-0000000000f1'),
  ('a0000000-0000-0000-0000-0000000000f2');
insert into public.user_tenants (user_id, tenant_id, role, disabled_at, warehouse_scope) values
  ('a0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'admin', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'admin', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'accounting', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000c2', '11111111-1111-1111-1111-111111111111', 'accounting', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'commercial', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000d1', '11111111-1111-1111-1111-111111111111', 'support', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000e1', '11111111-1111-1111-1111-111111111111', 'warehouse', null, 've'),
  ('a0000000-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'accounting', now(), 'all'),
  ('a0000000-0000-0000-0000-0000000000f2', '11111111-1111-1111-1111-111111111112', 'admin', null, 'all');
insert into public.platform_admins values ('a0000000-0000-0000-0000-0000000000a2');

\ir ../migrations/0357_role_module_overrides.sql
\ir ../migrations/0538_studio_user_module_grants.sql

-- ── Dos personas más para esta prueba ───────────────────────────────────
-- a3 marketing · e2 almacén con scope CN
insert into auth.users values ('a0000000-0000-0000-0000-0000000000a3'), ('a0000000-0000-0000-0000-0000000000e2');
insert into public.user_tenants (user_id, tenant_id, role, disabled_at, warehouse_scope) values
  ('a0000000-0000-0000-0000-0000000000a3', '11111111-1111-1111-1111-111111111111', 'marketing', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000e2', '11111111-1111-1111-1111-111111111111', 'warehouse', null, 'cn');

-- ── Tablas comerciales, forma mínima, con sus policies VIGENTES ──────────
-- Copia literal de TODAS las policies que el repo deja en estas 8 tablas antes
-- de la 0540 (su preflight exige el conjunto exacto con huellas): las que
-- reemplaza (0012:242-244 y :256-258, 0106:129-145, 0124:178-185,
-- 0125:187-189 y 0504:117-119), las de service_role (0106, 0124, 0125, 0504) y
-- las del portal en su forma final (0428:40-51 y 0433:87-91). Después se aplica
-- la 0230 REAL (`\ir` más abajo), que quita `AND (deleted_at IS NULL)` del USING
-- de las FOR ALL «by tenant»: ese es el estado del repo y de producción.
create table public.clients (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, deleted_at timestamptz, markbox text);
create table public.client_users (auth_user_id uuid, client_id uuid, tenant_id uuid, status text);
-- Vacías: la policy del portal las lee y no encuentra a nadie.
grant select on public.clients, public.client_users to authenticated;
create function public.portal_can_read_conversation_message(p_conversation_id uuid, p_message_tenant uuid)
returns boolean language sql stable set search_path = '' as $$ select false $$;
create table public.rates (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, deleted_at timestamptz, nombre text);
create table public.quotes (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, deleted_at timestamptz, sales_order_id uuid, client_markbox text);
create table public.conversations (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, deleted_at timestamptz);
create table public.conversation_messages (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, body text, conversation_id uuid);
create table public.purchase_orders (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, deleted_at timestamptz);
create table public.purchase_order_items (id uuid primary key default gen_random_uuid(), tenant_id uuid not null);
create table public.sales_orders (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, deleted_at timestamptz);
create table public.chatwoot_conversations (tenant_id uuid not null, conversation_id bigint not null, primary key (tenant_id, conversation_id));

alter table public.rates enable row level security;
alter table public.quotes enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.sales_orders enable row level security;
alter table public.chatwoot_conversations enable row level security;

create policy "rates by tenant" on public.rates for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));
create policy "quotes by tenant" on public.quotes for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));
create policy "conversations by tenant" on public.conversations for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "conversation_messages by tenant" on public.conversation_messages for all to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
create policy "purchase_orders by tenant" on public.purchase_orders for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "purchase_order_items by tenant" on public.purchase_order_items for all to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
create policy "sales_orders by tenant" on public.sales_orders for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy chatwoot_conversations_select_tenant on public.chatwoot_conversations
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

-- service_role y portal: la 0540 no las toca, pero su preflight las cuenta.
create policy "conversations service_role all" on public.conversations
  for all to service_role using (true) with check (true);
create policy "conversation_messages service_role all" on public.conversation_messages
  for all to service_role using (true) with check (true);
create policy "purchase_orders service_role all"
  on public.purchase_orders for all to service_role using (true) with check (true);
create policy "purchase_order_items service_role all"
  on public.purchase_order_items for all to service_role using (true) with check (true);
create policy "sales_orders service_role all"
  on public.sales_orders for all to service_role using (true) with check (true);
create policy chatwoot_conversations_service_role_all on public.chatwoot_conversations
  for all to service_role using (true) with check (true);
create policy "quotes portal self read" on public.quotes for select to authenticated
  using (
    deleted_at is null and client_markbox is not null
    and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id
          and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = quotes.tenant_id
        and c.markbox = quotes.client_markbox
    )
  );
create policy "conv_messages portal client read own" on public.conversation_messages
  for select to authenticated
  using (
    public.portal_can_read_conversation_message(conversation_id, tenant_id)
  );

-- La 0230 real: deja las FOR ALL «by tenant» sin el filtro de borrado en el USING.
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql

grant select, insert, update, delete on public.rates, public.quotes, public.conversations,
  public.conversation_messages, public.purchase_orders, public.purchase_order_items, public.sales_orders
  to authenticated;
grant select on public.chatwoot_conversations to authenticated;

insert into public.rates (tenant_id, nombre) values ('11111111-1111-1111-1111-111111111111', 'China → Caracas');
insert into public.quotes (tenant_id) values ('11111111-1111-1111-1111-111111111111');
insert into public.conversations (tenant_id) values ('11111111-1111-1111-1111-111111111111');
insert into public.conversation_messages (tenant_id, body) values ('11111111-1111-1111-1111-111111111111', 'Hola');
insert into public.purchase_orders (tenant_id) values ('11111111-1111-1111-1111-111111111111');
insert into public.purchase_order_items (tenant_id) values ('11111111-1111-1111-1111-111111111111');
insert into public.sales_orders (tenant_id) values ('11111111-1111-1111-1111-111111111111');
insert into public.chatwoot_conversations values ('11111111-1111-1111-1111-111111111111', 7);

\ir ../migrations/0540_comercial_rls_por_modulo.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0540: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

create function pg_temp.como(p_user uuid, p_sql text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  execute p_sql;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

create function pg_temp.valor(p_user uuid, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  execute 'select (' || p_sql || ')::text' into v;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v;
end;
$$;

create function pg_temp.falla(p_user uuid, p_sql text, p_patron text, p_label text) returns void language plpgsql as $$
declare v_msg text;
begin
  begin
    perform pg_temp.como(p_user, p_sql);
    v_msg := null;
  exception when others then
    v_msg := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.assert_true(v_msg is not null and v_msg ~ p_patron,
    p_label || ' (error: ' || coalesce(v_msg, 'ninguno') || ')');
end;
$$;

create function pg_temp.u(p_user text) returns uuid language sql immutable as $$
  select ('a0000000-0000-0000-0000-0000000000' || p_user)::uuid;
$$;

/** Filas que ve la persona en una tabla. */
create function pg_temp.ve(p_user text, p_tabla text) returns int language sql as $$
  select pg_temp.valor(pg_temp.u(p_user), format('select count(*) from public.%I', p_tabla))::int;
$$;

/** Filas que una persona logra actualizar en una tabla (RLS deniega en silencio: 0). */
create function pg_temp.actualiza(p_user text, p_tabla text) returns int language plpgsql as $$
declare v int;
begin
  perform set_config('request.jwt.claim.sub', pg_temp.u(p_user)::text, true);
  set local role authenticated;
  execute format('update public.%I set tenant_id = tenant_id', p_tabla);
  get diagnostics v = row_count;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v;
end;
$$;

-- ── 1. support (solo lectura) no escribe ─────────────────────────────────
select pg_temp.assert_true(pg_temp.ve('d1', 'quotes') = 1, '1a: support sigue leyendo cotizaciones');
select pg_temp.falla(pg_temp.u('d1'),
  $q$insert into public.quotes (tenant_id) values ('11111111-1111-1111-1111-111111111111')$q$,
  'row-level security', '1b: support no crea cotizaciones');
select pg_temp.assert_true(pg_temp.actualiza('d1', 'quotes') = 0, '1c: support no actualiza cotizaciones');
select pg_temp.falla(pg_temp.u('d1'),
  $q$insert into public.rates (tenant_id, nombre) values ('11111111-1111-1111-1111-111111111111', 'x')$q$,
  'row-level security', '1d: support no crea tarifas');
select pg_temp.assert_true(pg_temp.actualiza('d1', 'rates') = 0, '1e: support no actualiza tarifas');
select pg_temp.falla(pg_temp.u('d1'),
  $q$insert into public.conversation_messages (tenant_id, body) values ('11111111-1111-1111-1111-111111111111', 'x')$q$,
  'row-level security', '1f: support no escribe mensajes');
select pg_temp.assert_true(pg_temp.actualiza('d1', 'conversations') = 0, '1g: support no actualiza conversaciones');

-- ── 2. Quien no tiene el módulo no lee ───────────────────────────────────
select pg_temp.assert_true(pg_temp.ve('a3', 'rates') = 0, '2a: marketing no lee tarifas');
select pg_temp.assert_true(pg_temp.ve('a3', 'quotes') = 0, '2b: marketing no lee cotizaciones');
select pg_temp.assert_true(pg_temp.ve('a3', 'conversations') = 0, '2c: marketing no lee conversaciones');
select pg_temp.assert_true(pg_temp.ve('a3', 'purchase_orders') = 0, '2d: marketing no lee órdenes de compra');
select pg_temp.assert_true(pg_temp.ve('e1', 'rates') = 0, '2e: almacén (scope VE) no lee tarifas');
select pg_temp.assert_true(pg_temp.ve('e1', 'quotes') = 0, '2f: almacén (scope VE) no lee cotizaciones');
select pg_temp.assert_true(pg_temp.ve('e1', 'sales_orders') = 0, '2g: almacén (scope VE) no lee órdenes de venta');
select pg_temp.assert_true(pg_temp.ve('e1', 'chatwoot_conversations') = 0, '2h: almacén no lee la bandeja');
select pg_temp.assert_true(pg_temp.ve('c1', 'conversations') = 0, '2i: contabilidad no lee conversaciones por rol');
select pg_temp.assert_true(pg_temp.ve('f2', 'rates') = 0, '2j: otro tenant no ve nada');

-- ── 3. Lo que ya funcionaba sigue funcionando ────────────────────────────
select pg_temp.assert_true(pg_temp.ve('e2', 'rates') = 1, '3a: almacén CN lee tarifas por la propuesta de la recepción');
select pg_temp.assert_true(pg_temp.actualiza('e2', 'rates') = 0, '3b: y no las edita');
select pg_temp.como(pg_temp.u('b1'),
  $q$insert into public.rates (tenant_id, nombre) values ('11111111-1111-1111-1111-111111111111', 'Yiwu → Valencia')$q$);
select pg_temp.como(pg_temp.u('b1'),
  $q$insert into public.quotes (tenant_id) values ('11111111-1111-1111-1111-111111111111')$q$);
select pg_temp.como(pg_temp.u('b1'),
  $q$insert into public.conversation_messages (tenant_id, body) values ('11111111-1111-1111-1111-111111111111', 'Buenas')$q$);
select pg_temp.como(pg_temp.u('b1'),
  $q$insert into public.purchase_orders (tenant_id) values ('11111111-1111-1111-1111-111111111111')$q$);
select pg_temp.como(pg_temp.u('b1'),
  $q$insert into public.sales_orders (tenant_id) values ('11111111-1111-1111-1111-111111111111')$q$);
select pg_temp.assert_true(pg_temp.ve('b1', 'rates') = 2 and pg_temp.ve('b1', 'quotes') = 2
  and pg_temp.ve('b1', 'conversation_messages') = 2 and pg_temp.ve('b1', 'purchase_orders') = 2
  and pg_temp.ve('b1', 'sales_orders') = 2 and pg_temp.ve('b1', 'chatwoot_conversations') = 1,
  '3c: comercial lee y escribe todo lo comercial');
-- Borrado lógico: como dejó la 0230, la RLS de lectura NO filtra `deleted_at`
-- (si lo hiciera, el borrado con la sesión fallaría: ver la sección 7). Lo
-- borrado lo oculta la app en cada consulta.
select pg_temp.assert_true(pg_temp.actualiza('b1', 'quotes') = 2, '3d: comercial edita cotizaciones');
update public.quotes set deleted_at = now() where id in (select id from public.quotes limit 1);
select pg_temp.assert_true(pg_temp.ve('b1', 'quotes') = 2, '3d2: la RLS no oculta lo borrado (lo filtra la app, como en la 0230)');
select pg_temp.assert_true(pg_temp.actualiza('b1', 'quotes') = 1, '3d3: lo borrado ya no se edita');
select pg_temp.assert_true(pg_temp.ve('c1', 'sales_orders') = 2,
  '3e: contabilidad lee órdenes de venta');
select pg_temp.assert_true(pg_temp.actualiza('c1', 'quotes') >= 1, '3f: contabilidad edita cotizaciones por su rol');

-- ── 4. Un acceso adicional abre lo que la persona no tenía ───────────────
select pg_temp.como(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'conversaciones', true, true, 'Responde a clientes con saldo')$q$, pg_temp.u('c1')));
select pg_temp.como(pg_temp.u('c1'),
  $q$insert into public.conversation_messages (tenant_id, body) values ('11111111-1111-1111-1111-111111111111', 'Su saldo')$q$);
select pg_temp.assert_true(pg_temp.ve('c1', 'conversation_messages') = 3, '4a: contabilidad con extra de Conversaciones lee y escribe');
select pg_temp.como(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'kommo', true, false, 'Mira el CRM')$q$, pg_temp.u('c2')));
select pg_temp.assert_true(pg_temp.ve('c2', 'chatwoot_conversations') = 1, '4b: con el CRM concedido lee quién atiende el chat');
select pg_temp.como(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'rates', true, false, 'Consulta tarifas')$q$, pg_temp.u('a3')));
select pg_temp.assert_true(pg_temp.ve('a3', 'rates') = 2 and pg_temp.actualiza('a3', 'rates') = 0,
  '4c: marketing con extra de Tarifas (solo ver) lee y no edita');

-- ── 5. Ninguna policy de authenticated quedó solo por tenant ─────────────
select pg_temp.assert_true(not exists (
  select 1 from pg_catalog.pg_policy p
  where p.polrelid in ('public.rates'::regclass, 'public.quotes'::regclass, 'public.conversations'::regclass,
                       'public.conversation_messages'::regclass, 'public.purchase_orders'::regclass,
                       'public.purchase_order_items'::regclass, 'public.sales_orders'::regclass,
                       'public.chatwoot_conversations'::regclass)
    and p.polname like '%by tenant%'
), '5a: no queda ninguna policy «by tenant»');

-- ── 6. Borrado y órdenes de compra/venta (revisión de la #509) ───────────
-- support con OC y OV concedidas para VER: lee, pero no crea ni borra.
create function pg_temp.borra(p_user text, p_tabla text) returns int language plpgsql as $$
declare v int;
begin
  perform set_config('request.jwt.claim.sub', pg_temp.u(p_user)::text, true);
  set local role authenticated;
  execute format('delete from public.%I', p_tabla);
  get diagnostics v = row_count;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v;
end;
$$;
select pg_temp.como(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'purchase-orders', true, false, 'Consulta órdenes de compra')$q$, pg_temp.u('d1')));
select pg_temp.como(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'sales-orders', true, false, 'Consulta órdenes de venta')$q$, pg_temp.u('d1')));
select pg_temp.assert_true(pg_temp.ve('d1', 'purchase_orders') > 0 and pg_temp.ve('d1', 'sales_orders') > 0,
  '6a: support con OC y OV para ver las lee');
select pg_temp.falla(pg_temp.u('d1'),
  $q$insert into public.purchase_orders (tenant_id) values ('11111111-1111-1111-1111-111111111111')$q$,
  'row-level security', '6b: support no crea órdenes de compra');
select pg_temp.falla(pg_temp.u('d1'),
  $q$insert into public.sales_orders (tenant_id) values ('11111111-1111-1111-1111-111111111111')$q$,
  'row-level security', '6c: support no crea órdenes de venta');
select pg_temp.assert_true(pg_temp.borra('d1', 'quotes') = 0, '6d: support no borra cotizaciones');
select pg_temp.assert_true(pg_temp.borra('d1', 'purchase_orders') = 0, '6e: support no borra órdenes de compra');
select pg_temp.assert_true(pg_temp.borra('a3', 'rates') = 0, '6f: marketing con Tarifas para ver no borra tarifas');

-- ── 7. Borrado lógico CON LA SESIÓN (revisión de la #509, la 0230) ───────
-- Como lo hacen `softDeleteRate` (tarifas/actions.ts) y el cotizador: un UPDATE
-- de `deleted_at` filtrado por id. Lo hace alguien que no es dueño de la fila
-- (las filas las carga el fixture), con el módulo para editar. Postgres aplica
-- la policy de SELECT a la fila nueva: si filtrara `deleted_at`, esto fallaría
-- con «new row violates row-level security policy».
create function pg_temp.error_de(p_user uuid, p_sql text) returns text language plpgsql as $$
declare v_msg text;
begin
  begin
    perform pg_temp.como(p_user, p_sql);
    v_msg := null;
  exception when others then
    v_msg := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v_msg;
end;
$$;
insert into public.rates (id, tenant_id, nombre)
values ('70000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Tarifa a retirar');
insert into public.quotes (id, tenant_id)
values ('70000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111');
select pg_temp.assert_true(pg_temp.error_de(pg_temp.u('b1'),
  $q$update public.rates set deleted_at = now() where id = '70000000-0000-0000-0000-000000000001'$q$) is null
  and (select deleted_at is not null from public.rates where id = '70000000-0000-0000-0000-000000000001'),
  '7a: comercial borra lógico una tarifa con la sesión');
select pg_temp.assert_true(pg_temp.error_de(pg_temp.u('a1'),
  $q$update public.quotes set deleted_at = now() where id = '70000000-0000-0000-0000-000000000002'$q$) is null
  and (select deleted_at is not null from public.quotes where id = '70000000-0000-0000-0000-000000000002'),
  '7b: admin borra lógico una cotización con la sesión');

select 'TEST 0540: ' || nextval('pg_temp.assertion_count') - 1 || ' aserciones OK' as resultado;

rollback;
