\set ON_ERROR_STOP on
-- SDD-0377. RED: psql -v apply_fix=false; GREEN predeterminado: RPC real.
-- Usa migraciones reales; no abre SELECT histórico ni simula el writer AUD-01.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
\if :{?keep_fixture}
\else
\set keep_fixture false
\endif
begin;
do $guard$
begin
  if to_regclass('public.clients') is not null or to_regnamespace('auth') is not null then
    raise exception 'TEST 0427 requiere una base desechable vacía';
  end if;
end;
$guard$;
do $roles$
begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create schema extensions;
grant usage on schema auth to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.tenants (id uuid primary key, slug text);
create table public.user_tenants (
  user_id uuid primary key, tenant_id uuid not null references public.tenants(id), disabled_at timestamptz
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
-- Tabla clients, sus constraints/ACL, identidad Portal y direcciones REALES.
-- tenants está vacío: el seed histórico de 0006 no introduce datos demo.
\ir ../migrations/0006_clients.sql
\ir ../migrations/0080_portal_cliente.sql
\ir ../migrations/0198_client_delivery_addresses.sql
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
\ir ../migrations/0347_client_delivery_addresses_city_slug.sql

create function pg_temp.fixture_id(label text) returns uuid language sql immutable as $$
  select md5('0427-synthetic-' || label)::uuid
$$;
create temporary table assertions (label text primary key);
create temporary sequence assertion_count;
grant insert, select on assertions to authenticated, service_role;
grant usage on sequence assertion_count to authenticated, service_role;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'TEST 0427: %', label; end if;
  insert into pg_temp.assertions values (label);
  perform nextval('pg_temp.assertion_count');
end;
$$;
insert into public.tenants values
  (pg_temp.fixture_id('tenant-A'), 'synthetic-A'), (pg_temp.fixture_id('tenant-B'), 'synthetic-B');
insert into auth.users (id)
select pg_temp.fixture_id(v) from unnest(array[
  'portal-A', 'portal-B', 'revoked', 'invited', 'incoherent', 'retired',
  'unbound', 'team-A', 'team-B', 'team-disabled'
]) v;
insert into public.user_tenants values
  (pg_temp.fixture_id('team-A'), pg_temp.fixture_id('tenant-A'), null),
  (pg_temp.fixture_id('team-B'), pg_temp.fixture_id('tenant-B'), null),
  (pg_temp.fixture_id('team-disabled'), pg_temp.fixture_id('tenant-A'), now());
insert into public.clients (id, tenant_id, markbox, name)
select pg_temp.fixture_id(label), pg_temp.fixture_id(tenant), markbox, label
from (values
  ('client-A', 'tenant-A', 'DUP'), ('client-B', 'tenant-B', 'DUP'),
  ('client-other', 'tenant-A', 'OTHER'), ('client-revoked', 'tenant-A', 'REVOKED'),
  ('client-invited', 'tenant-A', 'INVITED'), ('client-retired', 'tenant-A', 'RETIRED')
) v(label, tenant, markbox);
insert into public.client_users (auth_user_id, tenant_id, client_id, email, status)
select pg_temp.fixture_id(actor), pg_temp.fixture_id(tenant), pg_temp.fixture_id(client),
  actor || '@example.invalid', status
from (values
  ('portal-A', 'tenant-A', 'client-A', 'active'),
  ('portal-B', 'tenant-B', 'client-B', 'active'),
  -- Las FK reales permiten un vínculo incoherente sin desactivar triggers.
  ('incoherent', 'tenant-A', 'client-B', 'active'),
  ('revoked', 'tenant-A', 'client-revoked', 'revoked'),
  ('invited', 'tenant-A', 'client-invited', 'invited'),
  ('retired', 'tenant-A', 'client-retired', 'active')
) v(actor, tenant, client, status);
insert into public.client_delivery_addresses (id, client_id, tenant_id, client_markbox, line)
select pg_temp.fixture_id('address-' || suffix), pg_temp.fixture_id('client-' || suffix),
  pg_temp.fixture_id('tenant-A'), 'forged-input-is-sealed', 'synthetic-address-' || suffix
from unnest(array['A', 'B', 'other', 'revoked', 'invited', 'retired']) suffix;
update public.clients set deleted_at = now() where id = pg_temp.fixture_id('client-retired');


\ir ../migrations/0425_portal_delivery_addresses_tenant_boundary.sql
insert into public.client_delivery_addresses(id,client_id,tenant_id,client_markbox,line,deleted_at)
values(pg_temp.fixture_id('historical-A'),pg_temp.fixture_id('client-A'),
  pg_temp.fixture_id('tenant-A'),'DUP','synthetic-history-not-visible',now());

set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id('portal-A')::text,true);
do $red_soft_delete$
declare before_row jsonb; after_row jsonb; blocked boolean:=false; captured_state text;
begin
  select to_jsonb(a) into before_row from public.client_delivery_addresses a
  where id=pg_temp.fixture_id('address-A');
  if before_row is null then raise exception 'TEST 0427: fixture no permite leer dirección propia'; end if;
  if exists(select from public.client_delivery_addresses where id in
    (pg_temp.fixture_id('historical-A'),pg_temp.fixture_id('address-B'))) then
    raise exception 'TEST 0427: fixture no preserva ocultación de histórico/tenant ajeno';
  end if;
  begin
    update public.client_delivery_addresses set deleted_at=now()
    where id=pg_temp.fixture_id('address-A');
  exception when insufficient_privilege then
    blocked:=true;
    get stacked diagnostics captured_state=returned_sqlstate;
  end;
  select to_jsonb(a) into after_row from public.client_delivery_addresses a
  where id=pg_temp.fixture_id('address-A');
  if not blocked or captured_state<>'42501' or before_row is distinct from after_row then
    raise exception 'TEST 0427: baseline no reproduce 42501 y preservación exacta de fila';
  end if;
  raise notice 'TEST 0427 RED: dirección propia visible; histórico/ajena ocultos; UPDATE recibió42501 y preservó fila íntegra';
  perform pg_temp.assert_true(blocked, 'UPDATE directo sigue bloqueado; no abrir SELECT histórico');
end;
$red_soft_delete$;
reset role;
\if :apply_fix
\else
do $$ begin raise exception using errcode='42501',
  message='TEST 0427 RED: borrado lógico propio rechazado; falta comando autorizado y auditado'; end $$;
\endif

-- Plataforma legacy mínima de0421. Catálogo, constraints y ambos writers se
-- instalan desde0258/0261/0267/0294 REALES, nunca un writer simulado.
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  entity_type text not null, entity_id uuid not null, actor_type text not null,
  actor_id uuid, event_type text not null, payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint entity_audit_log_tenant_id_fkey foreign key(tenant_id) references public.tenants(id) on delete cascade,
  constraint entity_audit_log_actor_type_check check(actor_type in ('user','operario','system')),
  constraint entity_audit_log_entity_type_check check(entity_type in ('shipment'))
);
alter table public.entity_audit_log enable row level security;
create policy entity_audit_log_tenant_select on public.entity_audit_log for select to authenticated
  using(tenant_id=public.get_user_tenant_id());
create policy entity_audit_log_service_role_all on public.entity_audit_log for all to service_role
  using(true) with check(true);
grant select on public.entity_audit_log to authenticated;
grant all on public.entity_audit_log to service_role;
create publication supabase_realtime;
alter publication supabase_realtime add table public.entity_audit_log;
\ir ../migrations/0258_audit_entity_catalog.sql
\ir ../migrations/0261_audit_entity_catalog_validate.sql
\ir ../migrations/0267_audit_contract_append_only.sql
\ir ../migrations/0294_audit_d2_human_reasons.sql

-- Datos sintéticos distintivos: no deben aparecer en ningún campo del evento.
update public.client_delivery_addresses set is_default=true,label='PRIVATE-LABEL-0427',
  line='PRIVATE-LINE-0427', city='PRIVATE-CITY-0427',reference='PRIVATE-REFERENCE-0427'
where id=pg_temp.fixture_id('address-A');
insert into public.client_delivery_addresses(id,client_id,tenant_id,client_markbox,line)
select pg_temp.fixture_id('address-'||n),pg_temp.fixture_id('client-A'),
  pg_temp.fixture_id('tenant-A'),'DUP','synthetic-'||n
from unnest(array['audit-error','audit-null','rollback','rename','stale']) n;

create function pg_temp.rows_snapshot() returns jsonb language sql as $$
  select jsonb_build_object(
    'addresses',(select jsonb_agg(to_jsonb(a) order by id) from public.client_delivery_addresses a),
    'clients',(select jsonb_agg(to_jsonb(c) order by id) from public.clients c),
    'bindings',(select jsonb_agg(to_jsonb(c) order by id) from public.client_users c),
    'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]'::jsonb) from public.entity_audit_log a),
    'catalog',(select jsonb_agg(to_jsonb(c) order by entity_type) from public.audit_entity_types c));
$$;
create function pg_temp.catalog_snapshot() returns jsonb language sql as $$
  select jsonb_build_object(
    'relations',(select jsonb_agg(jsonb_build_array(oid,relacl,relrowsecurity,relforcerowsecurity) order by oid)
      from pg_class where oid in ('public.client_delivery_addresses'::regclass,'public.clients'::regclass,
        'public.client_users'::regclass,'public.entity_audit_log'::regclass,'public.audit_entity_types'::regclass)),
    'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p),
    'columns',(select jsonb_agg(to_jsonb(a) order by attrelid,attnum) from pg_attribute a
      where attrelid in ('public.client_delivery_addresses'::regclass,'public.entity_audit_log'::regclass)),
    'triggers',(select jsonb_agg(to_jsonb(t) order by oid) from pg_trigger t
      where tgrelid='public.client_delivery_addresses'::regclass),
    'indexes',(select jsonb_agg(to_jsonb(i) order by indexrelid) from pg_index i
      where indrelid='public.client_delivery_addresses'::regclass),
    'writers',(select jsonb_agg(to_jsonb(p) order by oid) from pg_proc p
      where pronamespace='public'::regnamespace and proname in ('append_audit_event','append_audit_event_v1')));
$$;
create temporary table before_migration as select pg_temp.catalog_snapshot() catalog,pg_temp.rows_snapshot() rows;
\if :keep_fixture
\else
do $preflight_drift$
declare drift text; original jsonb; original_catalog jsonb; failed boolean; message text;
begin
  foreach drift in array array[
    'create schema portal_address_private',
    'create function public.delete_portal_delivery_address(p_address_id uuid,p_correlation_id uuid) returns boolean language sql as $f$ select false $f$',
    'alter function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text) rename to writer_missing_0427',
    'alter table public.client_delivery_addresses disable row level security',
    'create role unexpected_default_0427 nologin; alter default privileges grant execute on functions to unexpected_default_0427'
  ] loop
    original:=pg_temp.rows_snapshot();
    original_catalog:=pg_temp.catalog_snapshot();
    failed:=false;
    begin
      execute drift;
      begin execute pg_read_file('/sb/migrations/0427_portal_delete_delivery_address_command.sql');
      exception when others then
        get stacked diagnostics message=message_text;
        if message not like '0427:%' then raise exception 'TEST 0427: error fuera de preflight: %',message; end if;
        failed:=true;
      end;
      if not failed then raise exception 'TEST 0427: preflight aceptó drift %',drift; end if;
      if original<>pg_temp.rows_snapshot() then raise exception 'TEST 0427: drift dejó datos parciales'; end if;
      raise exception using errcode='PT427',message='rollback preflight drift';
    exception when sqlstate 'PT427' then null; end;
    perform pg_temp.assert_true(failed and original=pg_temp.rows_snapshot()
      and original_catalog=pg_temp.catalog_snapshot(),'Preflight rechaza y preserva: '||drift);
  end loop;
end;
$preflight_drift$;
\endif
\ir ../migrations/0427_portal_delete_delivery_address_command.sql
\if :keep_fixture
commit;
\echo FIXTURE_0427_READY
\quit
\endif
select pg_temp.assert_true((select catalog from before_migration)=pg_temp.catalog_snapshot(),
  '0427 conserva ACL/RLS/policies/columnas/índices/triggers y writers existentes');
select pg_temp.assert_true((select rows-'catalog' from before_migration)=pg_temp.rows_snapshot()-'catalog',
  '0427 no cambia filas de negocio ni agrega eventos al aplicarse');
select pg_temp.assert_true((select count(*)=1 from public.audit_entity_types
  where entity_type='client_delivery_address' and domain_code='clients'
    and introduced_by_ref='migration:0427' and status='active'),
  'Catálogo aditivo client_delivery_address identifica dominio y migración');
select pg_temp.assert_true((select rows->'catalog' from before_migration)=
  (select jsonb_agg(to_jsonb(c) order by entity_type) from public.audit_entity_types c
   where entity_type<>'client_delivery_address'),'Catálogo previo íntegro');
select pg_temp.assert_true((select not prosecdef and 'search_path=""'=any(proconfig)
  from pg_proc where oid='public.delete_portal_delivery_address(uuid,uuid)'::regprocedure),
  'Wrapper público INVOKER con search_path vacío');
select pg_temp.assert_true((select prosecdef and proowner='postgres'::regrole
  and 'search_path=""'=any(proconfig) and 'lock_timeout=2s'=any(proconfig)
  from pg_proc where oid='portal_address_private.delete_delivery_address(uuid,uuid)'::regprocedure),
  'Comando privado DEFINER postgres con search_path vacío y lock_timeout2s');

do $acl$
declare signature text; actor text; denied boolean;
begin
  foreach signature in array array['public.delete_portal_delivery_address(uuid,uuid)',
    'portal_address_private.delete_delivery_address(uuid,uuid)'] loop
    perform pg_temp.assert_true(has_function_privilege('authenticated',signature,'EXECUTE'),
      'Authenticated EXECUTE: '||signature);
    perform pg_temp.assert_true(not exists(select from pg_proc p cross join lateral aclexplode(p.proacl) acl
      where p.oid=signature::regprocedure and acl.grantee=0),'PUBLIC sin EXECUTE: '||signature);
    perform pg_temp.assert_true(not exists(select from pg_proc p cross join lateral aclexplode(p.proacl) acl
      where p.oid=signature::regprocedure and (acl.grantee not in(p.proowner,'authenticated'::regrole)
        or acl.is_grantable)),'ACL exacta owner/authenticated sin delegación: '||signature);
    foreach actor in array array['anon','service_role'] loop
      perform pg_temp.assert_true(not has_function_privilege(actor,signature,'EXECUTE'),
        actor||' sin EXECUTE: '||signature);
      execute format('set local role %I',actor);
      denied:=false;
      begin execute format('select %s($1,$2)',split_part(signature,'(',1))
        using pg_temp.fixture_id('address-A'),pg_temp.fixture_id('correlation-denied');
      exception when insufficient_privilege then denied:=true; end;
      execute 'reset role';
      perform pg_temp.assert_true(denied,actor||' llamada real42501: '||signature);
    end loop;
  end loop;
  perform pg_temp.assert_true(has_schema_privilege('authenticated','portal_address_private','USAGE')
    and not has_schema_privilege('anon','portal_address_private','USAGE')
    and not has_schema_privilege('service_role','portal_address_private','USAGE'),
    'Sólo authenticated tiene USAGE privado entre roles aplicación');
end;
$acl$;

do $nulls$
declare denied boolean;
begin
  execute 'set local role authenticated';
  begin perform public.delete_portal_delivery_address(null,pg_temp.fixture_id('corr-null'));
  exception when invalid_parameter_value then denied:=true; end;
  perform pg_temp.assert_true(denied,'address_id NULL rechazado22023');
  denied:=false;
  begin perform public.delete_portal_delivery_address(pg_temp.fixture_id('address-A'),null);
  exception when invalid_parameter_value then denied:=true; end;
  perform pg_temp.assert_true(denied,'correlation_id NULL rechazado22023');
  execute 'reset role';
end;
$nulls$;

do $principals$
declare actor text; original jsonb:=pg_temp.rows_snapshot(); address_id uuid;
begin
  execute 'set local role authenticated';
  foreach actor in array array['revoked','invited','incoherent','retired','unbound','team-A','team-disabled'] loop
    perform set_config('request.jwt.claim.sub',pg_temp.fixture_id(actor)::text,true);
    address_id:=pg_temp.fixture_id(case actor when 'revoked' then 'address-revoked'
      when 'invited' then 'address-invited' when 'retired' then 'address-retired'
      when 'incoherent' then 'address-B' else 'address-A' end);
    perform pg_temp.assert_true(public.delete_portal_delivery_address(address_id,
      pg_temp.fixture_id('corr-invalid')) is false,actor||' sin principal válido no puede borrar dirección vinculada');
  end loop;
  perform set_config('request.jwt.claim.sub','',true);
  perform pg_temp.assert_true(public.delete_portal_delivery_address(pg_temp.fixture_id('address-A'),
    pg_temp.fixture_id('corr-none')) is false,'Sin auth.uid devuelve false');
  perform set_config('request.jwt.claim.sub',pg_temp.fixture_id('portal-A')::text,true);
  foreach address_id in array array[pg_temp.fixture_id('address-B'),pg_temp.fixture_id('address-other'),
    pg_temp.fixture_id('unknown-address')] loop
    perform pg_temp.assert_true(public.delete_portal_delivery_address(address_id,
      pg_temp.fixture_id('corr-foreign')) is false,'Ajena/desconocida no revela ni borra: '||address_id);
  end loop;
  execute 'reset role';
  perform pg_temp.assert_true(original=pg_temp.rows_snapshot(),'Rechazos no mutan direcciones/vínculos/eventos');
end;
$principals$;

create temporary table before_delete as select to_jsonb(a) value from public.client_delivery_addresses a
where id=pg_temp.fixture_id('address-A');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id('portal-A')::text,true);
select set_config('dtd.audit_reason','UNTRUSTED-REASON-0427 private@example.invalid',true);
select pg_temp.assert_true(public.delete_portal_delivery_address(pg_temp.fixture_id('address-A'),
  pg_temp.fixture_id('corr-success')),'Propia viva devuelve true');
select pg_temp.assert_true(current_setting('dtd.audit_reason')='UNTRUSTED-REASON-0427 private@example.invalid',
  'Contexto audit_reason externo restaurado después del éxito');
select pg_temp.assert_true(not exists(select from public.client_delivery_addresses
  where id in(pg_temp.fixture_id('address-A'),pg_temp.fixture_id('historical-A'))),
  'Ningún histórico propio se vuelve visible');
reset role;
select pg_temp.assert_true((select count(*)=1 and bool_and(deleted_at is not null and is_default)
  from public.client_delivery_addresses where id=pg_temp.fixture_id('address-A')),
  'Conserva fila física e is_default; deleted_at sellado');
select pg_temp.assert_true((select value-array['deleted_at','updated_at'] from before_delete)=
  (select to_jsonb(a)-array['deleted_at','updated_at'] from public.client_delivery_addresses a
   where id=pg_temp.fixture_id('address-A')),'Sólo cambian deleted_at y updated_at');
select pg_temp.assert_true((select jsonb_agg(to_jsonb(a) order by id) from public.client_delivery_addresses a
  where id<>pg_temp.fixture_id('address-A'))=(select jsonb_agg(item order by item->>'id')
  from jsonb_array_elements((select rows->'addresses' from before_migration)) item
  where item->>'id'<>pg_temp.fixture_id('address-A')::text),
  'Todas las demás direcciones y predeterminadas permanecen idénticas');
select pg_temp.assert_true((select rows->'clients' from before_migration)=pg_temp.rows_snapshot()->'clients'
  and (select rows->'bindings' from before_migration)=pg_temp.rows_snapshot()->'bindings',
  'El comando no modifica clientes ni vínculos');

do $event$
declare event public.entity_audit_log; after_row public.client_delivery_addresses;
begin
  select * into strict event from public.entity_audit_log where entity_id=pg_temp.fixture_id('address-A');
  select * into strict after_row from public.client_delivery_addresses where id=pg_temp.fixture_id('address-A');
  perform pg_temp.assert_true(event.tenant_id=pg_temp.fixture_id('tenant-A')
    and event.actor_id=pg_temp.fixture_id('portal-A') and event.actor_type='user'
    and event.entity_type='client_delivery_address' and event.event_type='portal_delivery_address_deleted'
    and event.source='rpc' and event.result='succeeded' and event.correlation_id=pg_temp.fixture_id('corr-success')::text,
    'Evento durable atribuido al principal y dirección correctos');
  perform pg_temp.assert_true(event.reason='Solicitud del titular desde el Portal','Motivo fijo no acepta contexto externo');
  perform pg_temp.assert_true(event.before_data=jsonb_build_object('deleted_at',null,'is_default',true)
    and event.after_data=jsonb_build_object('deleted_at',after_row.deleted_at,'is_default',true),
    'Before/after sólo deleted_at e is_default');
  perform pg_temp.assert_true(event.payload=jsonb_build_object('surface','portal','permanence','P2',
    'recovery','support_review_required','consequence','removed_from_active_addresses','related_files','[]'::jsonb),
    'Payload mínimo exacto y sin archivos relacionados inventados');
  perform pg_temp.assert_true(to_jsonb(event)::text !~ 'PRIVATE-|UNTRUSTED-|example.invalid|synthetic-address|198[.]51',
    'Evento sin dirección, label, contacto, correo, IP ni contexto arbitrario');
end;
$event$;

create temporary table after_delete as select pg_temp.rows_snapshot() value;
set local role authenticated;
select pg_temp.assert_true(public.delete_portal_delivery_address(pg_temp.fixture_id('address-A'),
  pg_temp.fixture_id('corr-retry')),'Reintento propia ya borrada devuelve true');
select pg_temp.assert_true(public.delete_portal_delivery_address(pg_temp.fixture_id('historical-A'),
  pg_temp.fixture_id('corr-history')),'Histórico propio devuelve true sin inventar evento previo');
reset role;
select pg_temp.assert_true((select value from after_delete)=pg_temp.rows_snapshot(),
  'Reintentos/históricos no reactivan, no vuelven a fechar y no duplican auditoría');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id('portal-B')::text,true);
select pg_temp.assert_true(public.delete_portal_delivery_address(pg_temp.fixture_id('address-A'),
  pg_temp.fixture_id('corr-foreign-deleted')) is false,'B no obtiene true para histórico de A con mismo markbox');
select set_config('request.jwt.claim.sub',pg_temp.fixture_id('portal-A')::text,true);
reset role;

savepoint rename_identity;
update public.clients set markbox='RENAMED-0427' where id=pg_temp.fixture_id('client-A');
set local role authenticated;
select pg_temp.assert_true(public.delete_portal_delivery_address(pg_temp.fixture_id('address-rename'),
  pg_temp.fixture_id('corr-stale')) is false,'Markbox antiguo de dirección no coincide con cliente renombrado');
reset role;
-- El trigger0198 sella la identidad actual al editar una dirección viva.
update public.client_delivery_addresses set line=line where id=pg_temp.fixture_id('address-rename');
set local role authenticated;
select pg_temp.assert_true(public.delete_portal_delivery_address(pg_temp.fixture_id('address-rename'),
  pg_temp.fixture_id('corr-renamed')),'Dirección coherente con cliente renombrado sí se retira');
reset role;
rollback to rename_identity;
select pg_temp.assert_true((select value from after_delete)=pg_temp.rows_snapshot(),
  'Prueba de renombrado restaura catálogo de negocio y auditoría');

-- Fallos del log real, no reemplazo del writer: un trigger sintético provoca
-- error o suprime INSERT. Toda mutación debe revertirse si no hay evento durable.
do $audit_failure$
declare mode text; denied boolean; original jsonb; target uuid;
begin
  foreach mode in array array['error','null'] loop
    original:=pg_temp.rows_snapshot();
    target:=pg_temp.fixture_id('address-audit-'||mode);
    begin
      execute format('create function pg_temp.audit_fault() returns trigger language plpgsql as $f$ begin %s end; $f$',
        case mode when 'error' then 'raise exception using errcode=''P0001'',message=''synthetic log unavailable'';'
          else 'return null;' end);
      execute 'create trigger test_0427_audit_fault before insert on public.entity_audit_log
        for each row execute function pg_temp.audit_fault()';
      execute 'set local role authenticated';
      denied:=false;
      begin perform public.delete_portal_delivery_address(target,pg_temp.fixture_id('corr-audit-failure'));
      exception when others then denied:=true; end;
      if not denied then raise exception 'TEST 0427: log % sin confirmación no bloqueó',mode; end if;
      perform pg_temp.assert_true(current_setting('dtd.audit_reason')='UNTRUSTED-REASON-0427 private@example.invalid',
        'Motivo externo restaurado tras fallo '||mode);
      execute 'reset role';
      if original<>pg_temp.rows_snapshot() then raise exception 'TEST 0427: log % dejó cambios parciales',mode; end if;
      raise exception using errcode='PT427',message='rollback fault';
    exception when sqlstate 'PT427' then null; end;
    perform pg_temp.assert_true(denied and original=pg_temp.rows_snapshot(),'Fallo log '||mode||' revierte dirección y evento');
  end loop;
end;
$audit_failure$;

savepoint command_rollback;
set local role authenticated;
select pg_temp.assert_true(public.delete_portal_delivery_address(pg_temp.fixture_id('address-rollback'),
  pg_temp.fixture_id('corr-rollback')),'Comando se ejecuta dentro de transacción del caller');
reset role;
rollback to command_rollback;
select pg_temp.assert_true((select deleted_at is null from public.client_delivery_addresses
  where id=pg_temp.fixture_id('address-rollback')) and not exists(select from public.entity_audit_log
  where entity_id=pg_temp.fixture_id('address-rollback')),'Rollback externo revierte dirección y auditoría juntas');

do $rerun$
declare original jsonb:=pg_temp.rows_snapshot(); before_catalog jsonb:=pg_temp.catalog_snapshot(); failed boolean:=false;
begin
  begin execute pg_read_file('/sb/migrations/0427_portal_delete_delivery_address_command.sql');
  exception when others then failed:=true; end;
  perform pg_temp.assert_true(failed,'Reejecución rechaza namespace/funciones existentes');
  perform pg_temp.assert_true(original=pg_temp.rows_snapshot() and before_catalog=pg_temp.catalog_snapshot(),
    'Reejecución fallida no altera evidencia');
end;
$rerun$;
select count(*) as assertions_0427 from assertions;
rollback;
do $$ begin
  if to_regclass('public.client_delivery_addresses') is not null or to_regnamespace('auth') is not null
    or to_regnamespace('portal_address_private') is not null then raise exception 'TEST 0427: rollback incompleto'; end if;
end $$;
