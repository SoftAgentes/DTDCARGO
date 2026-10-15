\set ON_ERROR_STOP on

-- SDD-0537 · contrato de 0490 con el writer AUD-01 REAL y la tabla REAL.
--
-- Monta la plataforma mínima que el preflight de 0267 exige, 0267 y 0294
-- reales (el writer), 0330 real (carrier_tariffs con su RLS de admin) y
-- después 0490. Las escrituras se hacen como `authenticated` con un JWT de
-- admin, igual que la Server Action, salvo donde se prueba el actor `system`.
--
-- CONTROL ROJO: sin 0490 cae en la primera aserción de evento (el UPDATE del
-- precio no deja ningún carrier_tariff_updated).
--
-- Termina siempre en ROLLBACK. No imprime payloads.
begin;

do $roles$
begin
  if to_regclass('public.entity_audit_log') is not null
     or to_regclass('public.carrier_tariffs') is not null then
    raise exception 'Fixture 0490 rechazada: los objetos reales ya existen';
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

-- ── Plataforma previa a 0267: lo que su preflight exige ─────────────────────
-- `slug` además del id: la RPC pública de 0330 (language sql) lo lee al crearse.
create table public.tenants (id uuid primary key, slug text);

create table public.audit_entity_types (
  entity_type text primary key,
  status text not null check (status in ('active', 'deprecated')),
  domain_code text,
  contract_version integer,
  introduced_by_ref text
);

create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  actor_type text not null,
  actor_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint entity_audit_log_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint entity_audit_log_entity_type_fkey
    foreign key (entity_type) references public.audit_entity_types(entity_type)
    on update restrict on delete restrict,
  constraint entity_audit_log_actor_type_check
    check (actor_type in ('user', 'operario', 'system'))
);

alter table public.entity_audit_log enable row level security;
create policy entity_audit_log_tenant_select on public.entity_audit_log
  for select to authenticated using (true);
create policy entity_audit_log_service_role_all on public.entity_audit_log
  for all to service_role using (true) with check (true);
grant select on public.entity_audit_log to authenticated;
grant all on public.entity_audit_log to service_role;

create publication supabase_realtime;
alter publication supabase_realtime add table public.entity_audit_log;

\ir ../migrations/0267_audit_contract_append_only.sql
\ir ../migrations/0294_audit_d2_human_reasons.sql

-- ── Lo que 0330 necesita además de tenants ───────────────────────────────────
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
grant select on public.user_tenants to authenticated;

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id from public.user_tenants ut
  where ut.user_id = auth.uid() and ut.disabled_at is null
  limit 1
$$;
grant execute on function public.get_user_tenant_id() to authenticated;

create function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

\ir ../migrations/0330_freight_carriers_tariffs.sql
\ir ../migrations/0490_carrier_tariffs_auditoria.sql

-- ── Datos: dos tenants, un admin por tenant, Benito y dos ciudades ──────────
insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001', 'dtd'),
  ('10000000-0000-0000-0000-000000000002', 'otro');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin', null),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'admin', null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'commercial', null);
insert into public.freight_carriers (id, tenant_id, name, is_default) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000001', 'Benito', true),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000002', 'Otro', true);
insert into public.carrier_tariffs (
  id, tenant_id, carrier_id, city_slug, cost_usd_cbm, price_usd_cbm, price_usd_ft3,
  dispatch_frequency_days, departure_frequency
) values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000001',
   '40000000-0000-4000-8000-000000000001', 'merida', 80, 123.60, 3.5, 7, '1 vez por semana · lunes'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000001',
   '40000000-0000-4000-8000-000000000001', 'coro', 80, 176.57, 5, 15, 'cada 15 días'),
  ('50000000-0000-4000-8000-000000000003', '10000000-0000-0000-0000-000000000002',
   '40000000-0000-4000-8000-000000000002', 'merida', 60, 90, null, null, null);

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0490: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Los INSERT de arriba los hizo el dueño sin JWT: actor `system`, uno por fila.
do $siembra$
begin
  perform pg_temp.assert_true(
    (select count(*) from public.entity_audit_log where event_type = 'carrier_tariff_created') = 3,
    'cada alta de tarifa deja un carrier_tariff_created');
  perform pg_temp.assert_true(not exists (
    select 1 from public.entity_audit_log
    where event_type = 'carrier_tariff_created'
      and (actor_type <> 'system' or actor_id is not null)
  ), 'sin JWT el actor es system y no lleva id');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = '50000000-0000-4000-8000-000000000003'
      and tenant_id = '10000000-0000-0000-0000-000000000002'
  ), 'el evento lleva el tenant de la fila, no otro');
end;
$siembra$;

-- Escribe como la Server Action: rol authenticated con el JWT del usuario.
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
end;
$$;

-- 1. Editar costo, venta, frecuencia y días de una ciudad.
do $editar$
declare
  v_log public.entity_audit_log%rowtype;
  v_antes integer := (select count(*) from public.entity_audit_log);
begin
  perform pg_temp.assert_true(pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$update public.carrier_tariffs
       set cost_usd_cbm = 85, price_usd_cbm = 130.50, dispatch_frequency_days = 15,
           departure_frequency = 'cada 15 días · jueves'
       where id = '50000000-0000-4000-8000-000000000001'$q$) = 1,
    'el admin edita su tarifa');
  perform pg_temp.assert_true((select count(*) from public.entity_audit_log) = v_antes + 1,
    'la edición deja exactamente un evento');
  select * into v_log from public.entity_audit_log
  where event_type = 'carrier_tariff_updated';
  perform pg_temp.assert_true(found, 'el evento es carrier_tariff_updated');
  perform pg_temp.assert_true(
    v_log.entity_type = 'carrier_tariff'
    and v_log.entity_id = '50000000-0000-4000-8000-000000000001'
    and v_log.tenant_id = '10000000-0000-0000-0000-000000000001',
    'entidad, id y tenant de la fila editada');
  perform pg_temp.assert_true(
    v_log.actor_type = 'user' and v_log.actor_id = '20000000-0000-0000-0000-000000000001',
    'el actor es el usuario del JWT');
  perform pg_temp.assert_true(
    (v_log.before_data->>'cost_usd_cbm')::numeric = 80
    and (v_log.before_data->>'price_usd_cbm')::numeric = 123.60
    and (v_log.before_data->>'dispatch_frequency_days')::int = 7
    and v_log.before_data->>'departure_frequency' = '1 vez por semana · lunes',
    'before_data trae costo, venta, frecuencia y días anteriores');
  perform pg_temp.assert_true(
    (v_log.after_data->>'cost_usd_cbm')::numeric = 85
    and (v_log.after_data->>'price_usd_cbm')::numeric = 130.50
    and (v_log.after_data->>'dispatch_frequency_days')::int = 15
    and v_log.after_data->>'departure_frequency' = 'cada 15 días · jueves',
    'after_data trae los nuevos');
  perform pg_temp.assert_true(
    v_log.before_data->>'city_slug' = 'merida' and (v_log.after_data->>'active')::boolean,
    'antes/después nombran la ciudad y que sigue viva');
  perform pg_temp.assert_true(
    v_log.source = 'rpc' and v_log.result = 'succeeded' and v_log.sensitivity = 'restricted'
    and v_log.reason is null,
    'fuente, resultado y sensibilidad del contrato; editar no exige motivo');
  perform pg_temp.assert_true(
    v_log.correlation_id ~ '^carrier-tariff:50000000-0000-4000-8000-000000000001:[0-9]+$',
    'correlation_id con el id de la tarifa y la transacción');
end;
$editar$;

-- 2. Un UPDATE sin cambio de negocio no escribe evento.
do $sin_cambio$
declare v_antes integer := (select count(*) from public.entity_audit_log);
begin
  perform pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$update public.carrier_tariffs set updated_at = now()
       where id = '50000000-0000-4000-8000-000000000001'$q$);
  perform pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$update public.carrier_tariffs set price_usd_cbm = 130.50
       where id = '50000000-0000-4000-8000-000000000001'$q$);
  perform pg_temp.assert_true((select count(*) from public.entity_audit_log) = v_antes,
    'tocar sólo updated_at o reescribir el mismo precio no deja evento');
end;
$sin_cambio$;

-- 3. Cambio en lote: un solo UPDATE, un evento por fila, misma transacción.
do $lote$
declare v_antes integer := (select count(*) from public.entity_audit_log);
begin
  perform pg_temp.assert_true(pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$update public.carrier_tariffs set cost_usd_cbm = 90
       where carrier_id = '40000000-0000-4000-8000-000000000001'
         and deleted_at is null$q$) = 2,
    'el lote toca las dos tarifas vivas de Benito');
  perform pg_temp.assert_true((select count(*) from public.entity_audit_log) = v_antes + 2,
    'el lote deja un evento por fila');
  perform pg_temp.assert_true((
    select count(distinct split_part(correlation_id, ':', 3)) from public.entity_audit_log
    where event_type = 'carrier_tariff_updated' and (after_data->>'cost_usd_cbm')::numeric = 90
  ) = 1, 'los eventos del lote comparten la transacción en su correlation_id');
end;
$lote$;

-- 4. Quitar y restaurar una ruta: motivo fijo y `active` en antes/después.
do $quitar$
begin
  perform pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$update public.carrier_tariffs set deleted_at = now()
       where id = '50000000-0000-4000-8000-000000000002'$q$);
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = '50000000-0000-4000-8000-000000000002'
      and event_type = 'carrier_tariff_deleted'
      and reason = 'Ruta quitada del tarifario del transportista.'
      and (before_data->>'active')::boolean and not (after_data->>'active')::boolean
      and actor_id = '20000000-0000-0000-0000-000000000001'
  ), 'quitar la ruta deja carrier_tariff_deleted con motivo y actor');
  perform pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$update public.carrier_tariffs set deleted_at = null
       where id = '50000000-0000-4000-8000-000000000002'$q$);
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = '50000000-0000-4000-8000-000000000002'
      and event_type = 'carrier_tariff_restored'
      and reason = 'Ruta restaurada en el tarifario del transportista.'
  ), 'restaurarla deja carrier_tariff_restored con motivo');
end;
$quitar$;

-- 5. Agregar una ciudad como admin.
do $agregar$
begin
  perform pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$insert into public.carrier_tariffs (tenant_id, carrier_id, city_slug, cost_usd_cbm, price_usd_cbm)
       values ('10000000-0000-0000-0000-000000000001', '40000000-0000-4000-8000-000000000001',
               'valencia', 70, 105.94)$q$);
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log l
    join public.carrier_tariffs t on t.id = l.entity_id
    where t.city_slug = 'valencia' and l.event_type = 'carrier_tariff_created'
      and l.before_data is null and l.after_data->>'city_slug' = 'valencia'
      and (l.after_data->>'price_usd_cbm')::numeric = 105.94
      and l.actor_id = '20000000-0000-0000-0000-000000000001'
  ), 'agregar una ciudad deja carrier_tariff_created sin before y con el actor');
end;
$agregar$;

-- 6. Atomicidad: si el writer falla, la escritura del tarifario se revierte.
do $atomico$
declare v_state text; v_message text;
begin
  update public.audit_entity_types set status = 'deprecated' where entity_type = 'carrier_tariff';
  begin
    perform pg_temp.como('20000000-0000-0000-0000-000000000001',
      $q$update public.carrier_tariffs set price_usd_cbm = 999
         where id = '50000000-0000-4000-8000-000000000001'$q$);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;
  reset role;
  update public.audit_entity_types set status = 'active' where entity_type = 'carrier_tariff';
  perform pg_temp.assert_true(v_state = '23503' and v_message = 'audit: entity_type inexistente o inactivo',
    'con el writer fallando la edición falla');
  perform pg_temp.assert_true(
    (select price_usd_cbm from public.carrier_tariffs
     where id = '50000000-0000-4000-8000-000000000001') = 130.50,
    'y el precio no cambió');
end;
$atomico$;

-- 7. La RLS de 0330 sigue mandando: un commercial no edita y no hay evento.
do $rls$
declare v_antes integer := (select count(*) from public.entity_audit_log);
begin
  perform pg_temp.assert_true(pg_temp.como('20000000-0000-0000-0000-000000000003',
    $q$update public.carrier_tariffs set price_usd_cbm = 1
       where id = '50000000-0000-4000-8000-000000000001'$q$) = 0,
    'un commercial no toca ninguna fila');
  perform pg_temp.assert_true(pg_temp.como('20000000-0000-0000-0000-000000000002',
    $q$update public.carrier_tariffs set price_usd_cbm = 1
       where id = '50000000-0000-4000-8000-000000000001'$q$) = 0,
    'el admin de otro tenant no toca la tarifa de DTD');
  perform pg_temp.assert_true((select count(*) from public.entity_audit_log) = v_antes,
    'sin escritura no hay evento');
end;
$rls$;

-- 8. Borrado físico (sólo service_role/dueño): también queda, con motivo.
do $fisico$
begin
  delete from public.carrier_tariffs where id = '50000000-0000-4000-8000-000000000003';
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = '50000000-0000-4000-8000-000000000003'
      and event_type = 'carrier_tariff_deleted'
      and after_data is null and before_data->>'city_slug' = 'merida'
      and reason = 'Tarifa eliminada de la base, fuera del Studio.'
  ), 'un DELETE físico deja carrier_tariff_deleted con before y motivo');
end;
$fisico$;

-- 9. Catálogo: la función no se expone a la API y el tipo queda activo.
do $catalogo$
begin
  perform pg_temp.assert_true(
    not has_function_privilege('authenticated', 'public.audit_carrier_tariff_change()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.audit_carrier_tariff_change()', 'EXECUTE'),
    'audit_carrier_tariff_change no es ejecutable por anon ni authenticated');
  perform pg_temp.assert_true(exists (
    select 1 from public.audit_entity_types
    where entity_type = 'carrier_tariff' and status = 'active'
      and domain_code = 'configuration' and introduced_by_ref = 'migration:0490'
  ), 'carrier_tariff activo en el dominio configuration');
  perform pg_temp.assert_true(
    obj_description('public.audit_carrier_tariff_change()'::regprocedure, 'pg_proc') like '%SDD-0537%',
    'el comentario de la función nombra la SDD-0537');
end;
$catalogo$;

select 'TEST 0490 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
