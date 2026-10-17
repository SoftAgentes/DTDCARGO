\set ON_ERROR_STOP on

-- SDD-0539 · contrato de 0491 con el writer AUD-01 REAL y la tabla REAL.
--
-- Monta la plataforma mínima que el preflight de 0267 exige, 0267 y 0294
-- reales (el writer), 0330 real (freight_carriers con su RLS de admin), la
-- 0490 (aplicada en producción el 2026-10-15) y después 0491. Las escrituras
-- se hacen como `authenticated` con un JWT de admin, igual que la Server
-- Action, salvo donde se prueba el actor `system`.
--
-- CONTROL ROJO: sin 0491 cae en la primera aserción de evento (las altas de
-- la siembra no dejan ningún freight_carrier_created).
--
-- Termina siempre en ROLLBACK. No imprime payloads.
begin;

do $roles$
begin
  if to_regclass('public.entity_audit_log') is not null
     or to_regclass('public.freight_carriers') is not null then
    raise exception 'Fixture 0491 rechazada: los objetos reales ya existen';
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
\ir ../migrations/0491_freight_carriers_auditoria.sql

-- ── Datos: dos tenants, un admin por tenant, Benito y Otro en DTD ───────────
-- Los textos del proveedor llevan marcas únicas (MARCA-…) para buscar copias.
insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001', 'dtd'),
  ('10000000-0000-0000-0000-000000000002', 'otro');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin', null),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'admin', null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'commercial', null);
insert into public.freight_carriers (id, tenant_id, name, legal_name, tax_id, contact, notes, is_default) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000001',
   'MARCA-NOMBRE-BENITO', 'MARCA-RAZON-BENITO', 'MARCA-RIF-BENITO', 'MARCA-CONTACTO-BENITO', 'MARCA-NOTA-BENITO', true),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000001',
   'MARCA-NOMBRE-OTRO', null, null, null, null, false),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-0000-0000-000000000002',
   'MARCA-NOMBRE-AJENO', null, null, null, null, true);
insert into public.carrier_tariffs (id, tenant_id, carrier_id, city_slug, cost_usd_cbm, price_usd_cbm) values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000001',
   '40000000-0000-4000-8000-000000000002', 'merida', 70, 105.94);

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0491: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Los INSERT de arriba los hizo el dueño sin JWT: actor `system`, uno por fila.
do $siembra$
begin
  perform pg_temp.assert_true(
    (select count(*) from public.entity_audit_log where event_type = 'freight_carrier_created') = 3,
    'cada alta de transportista deja un freight_carrier_created');
  perform pg_temp.assert_true(not exists (
    select 1 from public.entity_audit_log
    where event_type = 'freight_carrier_created'
      and (actor_type <> 'system' or actor_id is not null)
  ), 'sin JWT el actor es system y no lleva id');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = '40000000-0000-4000-8000-000000000003'
      and tenant_id = '10000000-0000-0000-0000-000000000002'
  ), 'el evento lleva el tenant de la fila, no otro');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = '40000000-0000-4000-8000-000000000001'
      and event_type = 'freight_carrier_created'
      and before_data is null
      and (after_data->>'is_default')::boolean
      and (after_data->>'contact_present')::boolean
      and not (after_data->>'deleted')::boolean
      and payload = '{}'::jsonb
  ), 'el alta trae las banderas del después y no trae before');
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

-- 1. Cambiar el que cotiza la web, como setDefaultCarrier: bajar y subir.
do $predeterminado$
declare
  v_baja public.entity_audit_log%rowtype;
  v_sube public.entity_audit_log%rowtype;
  v_antes integer := (select count(*) from public.entity_audit_log);
begin
  perform pg_temp.assert_true(pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$update public.freight_carriers set is_default = false
       where is_default and id <> '40000000-0000-4000-8000-000000000002'
         and deleted_at is null$q$) = 1,
    'bajar al anterior toca sólo a Benito (la RLS esconde al ajeno)');
  perform pg_temp.assert_true(pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$update public.freight_carriers set is_default = true, active = true
       where id = '40000000-0000-4000-8000-000000000002' and deleted_at is null$q$) = 1,
    'subir a Otro toca una fila');
  perform pg_temp.assert_true((select count(*) from public.entity_audit_log) = v_antes + 2,
    'el cambio deja exactamente dos eventos, uno por transportista');
  select * into v_baja from public.entity_audit_log
  where event_type = 'freight_carrier_default_changed'
    and entity_id = '40000000-0000-4000-8000-000000000001';
  select * into v_sube from public.entity_audit_log
  where event_type = 'freight_carrier_default_changed'
    and entity_id = '40000000-0000-4000-8000-000000000002';
  perform pg_temp.assert_true(
    (v_baja.before_data->>'is_default')::boolean and not (v_baja.after_data->>'is_default')::boolean
    and v_baja.reason = 'Deja de ser el transportista que cotiza la web pública.',
    'el anterior deja freight_carrier_default_changed de true a false con su motivo');
  perform pg_temp.assert_true(
    not (v_sube.before_data->>'is_default')::boolean and (v_sube.after_data->>'is_default')::boolean
    and v_sube.reason = 'Pasa a ser el transportista que cotiza la web pública.',
    'el nuevo deja freight_carrier_default_changed de false a true con su motivo');
  perform pg_temp.assert_true(
    v_sube.actor_type = 'user' and v_sube.actor_id = '20000000-0000-0000-0000-000000000001'
    and v_baja.actor_id = '20000000-0000-0000-0000-000000000001',
    'el actor es el usuario del JWT');
  perform pg_temp.assert_true(
    v_sube.entity_type = 'freight_carrier'
    and v_sube.tenant_id = '10000000-0000-0000-0000-000000000001'
    and v_sube.payload = '{"changed_fields": ["is_default"]}'::jsonb,
    'entidad, tenant y columnas cambiadas del nuevo');
  perform pg_temp.assert_true(
    v_sube.source = 'rpc' and v_sube.result = 'succeeded' and v_sube.sensitivity = 'restricted',
    'fuente, resultado y sensibilidad del contrato');
  perform pg_temp.assert_true(
    v_sube.correlation_id ~ '^freight-carrier:40000000-0000-4000-8000-000000000002:[0-9]+$',
    'correlation_id con el id del transportista y la transacción');
end;
$predeterminado$;

-- 2. Editar los datos del proveedor: evento sin valores, con las columnas.
do $editar$
declare v_log public.entity_audit_log%rowtype;
begin
  perform pg_temp.assert_true(pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$update public.freight_carriers
       set contact = 'MARCA-CONTACTO-NUEVO', tax_id = 'MARCA-RIF-NUEVO'
       where id = '40000000-0000-4000-8000-000000000002'$q$) = 1,
    'el admin edita los datos de Otro');
  select * into v_log from public.entity_audit_log
  where event_type = 'freight_carrier_updated'
    and entity_id = '40000000-0000-4000-8000-000000000002';
  perform pg_temp.assert_true(found, 'editar deja freight_carrier_updated');
  perform pg_temp.assert_true(
    not (v_log.before_data->>'contact_present')::boolean
    and (v_log.after_data->>'contact_present')::boolean
    and (v_log.after_data->>'tax_id_present')::boolean
    and not (v_log.after_data->>'legal_name_present')::boolean,
    'antes/después dicen si hay contacto, RIF y razón social');
  perform pg_temp.assert_true(
    v_log.payload = '{"changed_fields": ["contact", "tax_id"]}'::jsonb,
    'payload.changed_fields nombra las columnas cambiadas, en orden');
  perform pg_temp.assert_true(v_log.reason is null, 'editar no exige motivo');
end;
$editar$;

-- 3. Cambiar un texto por otro sin cambiar ninguna bandera también queda.
do $sin_bandera$
declare v_antes integer := (select count(*) from public.entity_audit_log);
begin
  perform pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$update public.freight_carriers set name = 'MARCA-NOMBRE-OTRO-2'
       where id = '40000000-0000-4000-8000-000000000002'$q$);
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = '40000000-0000-4000-8000-000000000002'
      and event_type = 'freight_carrier_updated'
      and payload = '{"changed_fields": ["name"]}'::jsonb
  ) and (select count(*) from public.entity_audit_log) = v_antes + 1,
    'renombrar deja un evento con changed_fields = [name]');
end;
$sin_bandera$;

-- 4. Un UPDATE sin cambio de negocio no escribe evento.
do $sin_cambio$
declare v_antes integer := (select count(*) from public.entity_audit_log);
begin
  perform pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$update public.freight_carriers set updated_at = now()
       where id = '40000000-0000-4000-8000-000000000002'$q$);
  perform pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$update public.freight_carriers set is_default = true, active = true
       where id = '40000000-0000-4000-8000-000000000002'$q$);
  perform pg_temp.assert_true((select count(*) from public.entity_audit_log) = v_antes,
    'tocar sólo updated_at o volver a marcar al que ya cotiza no deja evento');
end;
$sin_cambio$;

-- 5. Quitar el que cotiza la web y restaurarlo: motivo y banderas.
do $quitar$
begin
  perform pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$update public.freight_carriers set deleted_at = now(), is_default = false
       where id = '40000000-0000-4000-8000-000000000002' and deleted_at is null$q$);
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = '40000000-0000-4000-8000-000000000002'
      and event_type = 'freight_carrier_deleted'
      and reason = 'Transportista quitado del registro: deja de cotizar la web pública.'
      and not (before_data->>'deleted')::boolean and (after_data->>'deleted')::boolean
      and (before_data->>'is_default')::boolean and not (after_data->>'is_default')::boolean
      and actor_id = '20000000-0000-0000-0000-000000000001'
  ), 'quitar al que cotiza deja freight_carrier_deleted con el motivo que lo dice');
  perform pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$update public.freight_carriers set deleted_at = null
       where id = '40000000-0000-4000-8000-000000000002'$q$);
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = '40000000-0000-4000-8000-000000000002'
      and event_type = 'freight_carrier_restored'
      and reason = 'Transportista restaurado en el registro.'
  ), 'restaurarlo deja freight_carrier_restored con motivo');
  perform pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$update public.freight_carriers set deleted_at = now()
       where id = '40000000-0000-4000-8000-000000000001'$q$);
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = '40000000-0000-4000-8000-000000000001'
      and event_type = 'freight_carrier_deleted'
      and reason = 'Transportista quitado del registro.'
  ), 'quitar uno que no cotiza lleva el motivo corto');
end;
$quitar$;

-- 6. Dar de alta como admin.
do $agregar$
begin
  perform pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$insert into public.freight_carriers (tenant_id, name)
       values ('10000000-0000-0000-0000-000000000001', 'MARCA-NOMBRE-NUEVO')$q$);
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log l
    join public.freight_carriers c on c.id = l.entity_id
    where c.name = 'MARCA-NOMBRE-NUEVO' and l.event_type = 'freight_carrier_created'
      and l.before_data is null and not (l.after_data->>'is_default')::boolean
      and l.actor_id = '20000000-0000-0000-0000-000000000001'
  ), 'el alta deja freight_carrier_created sin before y con el actor');
end;
$agregar$;

-- 7. Atomicidad: si el writer falla, la escritura del registro se revierte.
--    En este punto Benito está quitado y Otro, restaurado, no cotiza la web.
do $atomico$
declare v_state text; v_message text;
begin
  update public.audit_entity_types set status = 'deprecated' where entity_type = 'freight_carrier';
  begin
    perform pg_temp.como('20000000-0000-0000-0000-000000000001',
      $q$update public.freight_carriers set is_default = true
         where id = '40000000-0000-4000-8000-000000000002'$q$);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;
  reset role;
  update public.audit_entity_types set status = 'active' where entity_type = 'freight_carrier';
  perform pg_temp.assert_true(v_state = '23503' and v_message = 'audit: entity_type inexistente o inactivo',
    'con el writer fallando el cambio falla');
  perform pg_temp.assert_true(
    not (select is_default from public.freight_carriers
         where id = '40000000-0000-4000-8000-000000000002'),
    'y Otro sigue sin cotizar la web');
end;
$atomico$;

-- 8. La RLS de 0330 sigue mandando: un commercial no edita y no hay evento.
do $rls$
declare v_antes integer := (select count(*) from public.entity_audit_log);
begin
  perform pg_temp.assert_true(pg_temp.como('20000000-0000-0000-0000-000000000003',
    $q$update public.freight_carriers set is_default = false
       where id = '40000000-0000-4000-8000-000000000002'$q$) = 0,
    'un commercial no toca ninguna fila');
  perform pg_temp.assert_true(pg_temp.como('20000000-0000-0000-0000-000000000002',
    $q$update public.freight_carriers set is_default = false
       where id = '40000000-0000-4000-8000-000000000002'$q$) = 0,
    'el admin de otro tenant no toca el registro de DTD');
  perform pg_temp.assert_true((select count(*) from public.entity_audit_log) = v_antes,
    'sin escritura no hay evento');
end;
$rls$;

-- 9. Borrado físico (sólo dueño): queda, con motivo, y las tarifas en cascada
--    dejan su evento de la 0490.
do $fisico$
begin
  delete from public.freight_carriers where id = '40000000-0000-4000-8000-000000000002';
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = '40000000-0000-4000-8000-000000000002'
      and event_type = 'freight_carrier_deleted'
      and after_data is null and not (before_data->>'deleted')::boolean
      and reason = 'Transportista eliminado de la base, fuera del Studio.'
  ), 'un DELETE físico deja freight_carrier_deleted con before y motivo');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = '50000000-0000-4000-8000-000000000001'
      and event_type = 'carrier_tariff_deleted'
  ), 'la tarifa que cae en cascada deja su carrier_tariff_deleted (0490)');
end;
$fisico$;

-- 10. Ningún texto del proveedor llegó a la bitácora.
do $sin_copias$
begin
  perform pg_temp.assert_true(not exists (
    select 1 from public.entity_audit_log
    where (payload::text || coalesce(before_data::text, '') || coalesce(after_data::text, '')
           || coalesce(reason, '')) like '%MARCA-%'
  ), 'ni nombre, razón social, RIF, contacto ni notas se copian a la bitácora');
end;
$sin_copias$;

-- 11. Catálogo: la función no se expone a la API y el tipo queda activo.
do $catalogo$
begin
  perform pg_temp.assert_true(
    not has_function_privilege('authenticated', 'public.audit_freight_carrier_change()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.audit_freight_carrier_change()', 'EXECUTE'),
    'audit_freight_carrier_change no es ejecutable por anon ni authenticated');
  perform pg_temp.assert_true(exists (
    select 1 from public.audit_entity_types
    where entity_type = 'freight_carrier' and status = 'active'
      and domain_code = 'configuration' and introduced_by_ref = 'migration:0491'
  ), 'freight_carrier activo en el dominio configuration');
  perform pg_temp.assert_true(
    obj_description('public.audit_freight_carrier_change()'::regprocedure, 'pg_proc') like '%SDD-0539%',
    'el comentario de la función nombra la SDD-0539');
end;
$catalogo$;

select 'TEST 0491 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
