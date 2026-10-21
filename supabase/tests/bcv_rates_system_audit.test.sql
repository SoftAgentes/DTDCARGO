-- SDD-0569 · contrato adicional0501. Fixture sintética, jamás DB real.
-- La base de fixture1–119 se deriva del contrato0495 sin editar ese original.
-- apply_fix controla SOLO0501;0495/cadena real siempre están presentes.
-- fixture_only=true COMMIT prepara HTTP en otra conexión; contrato normal ROLLBACK.
-- SQL directo no sustituye el gate HTTP del rol dentro del trigger.
\set ON_ERROR_STOP on
-- Cadena real0267/0294/0077/0078/0088/0495; no stubs de auditoría.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
\if :{?fixture_only}
\else
\set fixture_only false
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.entity_audit_log') is not null or to_regclass('public.invoices') is not null then
    raise exception 'TEST BCV0501: fixture rechazada, la base ya contiene objetos de aplicación';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$fixture_guard$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table public.tenants (id uuid primary key, slug text unique not null, display_name text not null);

-- La auditoría, como el contrato 0491.
create table public.audit_entity_types (
  entity_type text primary key,
  status text not null check (status in ('active', 'deprecated')),
  domain_code text, contract_version integer, introduced_by_ref text
);
-- El tipo exchange_rate lo siembra 0293 en producción.
insert into public.audit_entity_types values ('exchange_rate', 'active', 'configuration', 1, 'migration:0293');
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  entity_type text not null, entity_id uuid not null, actor_type text not null,
  actor_id uuid, event_type text not null, payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint entity_audit_log_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint entity_audit_log_entity_type_fkey foreign key (entity_type)
    references public.audit_entity_types(entity_type) on update restrict on delete restrict,
  constraint entity_audit_log_actor_type_check check (actor_type in ('user', 'operario', 'system'))
);
alter table public.entity_audit_log enable row level security;
create policy entity_audit_log_tenant_select on public.entity_audit_log for select to authenticated using (true);
create policy entity_audit_log_service_role_all on public.entity_audit_log for all to service_role using (true) with check (true);
grant select on public.entity_audit_log to authenticated;
grant all on public.entity_audit_log to service_role;
create publication supabase_realtime;
alter publication supabase_realtime add table public.entity_audit_log;
\ir ../migrations/0267_audit_contract_append_only.sql
\ir ../migrations/0294_audit_d2_human_reasons.sql

create table public.user_tenants (
  user_id uuid not null references auth.users(id), tenant_id uuid not null references public.tenants(id),
  role text not null, disabled_at timestamptz, primary key (user_id, tenant_id)
);
alter table public.user_tenants enable row level security;
grant select on public.user_tenants to authenticated;
create policy "users see their own user_tenants" on public.user_tenants
  for select to authenticated using (user_id = (select auth.uid()) and disabled_at is null);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1] from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
grant execute on function public.get_user_tenant_id() to authenticated;
create function public.current_studio_role() returns text
language sql stable security definer set search_path = '' as $$
  select ut.role from public.user_tenants ut where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id), shipment_service text, deleted_at timestamptz
);
-- 0074 crea tenant_fx_history; acá basta su forma para el conteo del preflight.
create table public.tenant_fx_history (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
  currency_pair text not null, rate numeric not null check (rate > 0), set_at timestamptz default now(),
  set_by uuid, expense_id uuid
);

\ir ../migrations/0077_invoices.sql
\ir ../migrations/0078_contabilidad.sql
\ir ../migrations/0088_tesoreria.sql
-- 0077, 0078 y 0088 vuelven a crear la lista cerrada (CHECK) de entity_type, que
-- en producción retiró la 0261: desde entonces manda la FK a audit_entity_types.
alter table public.entity_audit_log drop constraint entity_audit_log_entity_type_check;
\ir ../migrations/0495_fx_rates_conversor_usd.sql

create function pg_temp.fixture_id(p_label text) returns uuid language sql immutable as $$
  select md5('0495-synthetic-' || p_label)::uuid
$$;
insert into auth.users (id) select pg_temp.fixture_id(u) from unnest(array['admin-A', 'accounting-A', 'commercial-A', 'admin-B']) u;
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fixture_id('tenant-A'), 'tenant-a-0495', 'Tenant A 0495'),
  (pg_temp.fixture_id('tenant-B'), 'tenant-b-0495', 'Tenant B 0495');
insert into public.user_tenants (user_id, tenant_id, role)
select pg_temp.fixture_id(u), pg_temp.fixture_id(t), r from (values
  ('admin-A', 'tenant-A', 'admin'), ('accounting-A', 'tenant-A', 'accounting'),
  ('commercial-A', 'tenant-A', 'commercial'), ('admin-B', 'tenant-B', 'admin')) v(u, t, r);

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST BCV0501: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Adaptador HTTP explícito: el shim legado original no demuestra JWT moderno.
create or replace function auth.uid() returns uuid language sql stable set search_path='' as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
do $fixture_login$ begin
  if not exists(select 1 from pg_roles where rolname='authenticator') then
    create role authenticator nologin noinherit;
  end if;
end; $fixture_login$;
grant anon,authenticated,service_role to authenticator;
grant select on public.tenants to service_role;

create schema bcv_fixture;
grant usage on schema bcv_fixture to anon,authenticated,service_role;
create table bcv_fixture.context_log (
  entity_id uuid, operation text, native_role text, effective_user text, login_user text, actor_id uuid, claims jsonb
);
create function bcv_fixture.capture_context() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into bcv_fixture.context_log values(new.id,tg_op,pg_catalog.current_setting('role',true),current_user,session_user,
    auth.uid(),nullif(pg_catalog.current_setting('request.jwt.claims',true),'')::jsonb);
  return new;
end;
$$;
revoke all on function bcv_fixture.capture_context() from public,anon,authenticated,service_role;
create trigger zz_bcv_fixture_context after insert or update on public.fx_rates
for each row execute function bcv_fixture.capture_context();
create function bcv_fixture.error_sql(p_sql text) returns text language plpgsql set search_path='' as $$
begin
  execute p_sql;
  return 'ok';
exception when others then return sqlstate;
end;
$$;
grant execute on function bcv_fixture.error_sql(text) to service_role;

-- Solo la fixture efímera puede inyectar claims para separar GUC nativo y claim.
-- No se instala en0501 ni se expone el schema como API.
create function bcv_fixture.http_context() returns void language plpgsql set search_path='' as $$
declare v_override text := nullif(pg_catalog.current_setting('request.headers',true),'')::jsonb->>'x-bcv-fixture-claims';
begin
  if v_override is not null then perform pg_catalog.set_config('request.jwt.claims',v_override,true); end if;
end;
$$;
grant execute on function bcv_fixture.http_context() to anon,authenticated,service_role;

\if :apply_fix
\ir ../migrations/0501_bcv_rates_system_audit.sql
\endif

\if :fixture_only
commit;
\else
select pg_temp.assert_true(to_regprocedure('public.bcv_rates_write_capability()') is not null,
  'capability0501 instalada, no fallback al contrato0495');
select pg_temp.assert_true((public.bcv_rates_write_capability()->>'version')='1'
  and (public.bcv_rates_write_capability()->>'ready')='false', 'postgres directo no acredita contexto HTTP');
select pg_temp.assert_true(not has_function_privilege('anon','public.bcv_rates_write_capability()','EXECUTE')
  and not has_function_privilege('authenticated','public.bcv_rates_write_capability()','EXECUTE')
  and has_function_privilege('service_role','public.bcv_rates_write_capability()','EXECUTE'), 'capability service-only');
select pg_temp.assert_true(not exists(select 1 from pg_proc p,
  lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where p.oid='public.bcv_rates_write_capability()'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),
  'PUBLIC sin EXECUTE efectivo directo');

set session authorization authenticator;
set local role service_role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
create temporary table bcv_ready_result as select public.bcv_rates_write_capability() as value;
insert into public.fx_rates(id,tenant_id,currency,valid_on,source,rate,set_by,note)
values('00000000-0000-4000-8000-000000000501',md5('0495-synthetic-tenant-A')::uuid,
  'VES','2026-10-21','bcv','883.39630000',null,'procedencia sintética sin datos reales');
reset role;
reset session authorization;
-- Precondición de la inspección: no convertir permisos de fixture en un mutante detectado.
do $fixture_reader$
begin
  if current_user<>'postgres' or session_user<>'postgres'
     or pg_catalog.current_setting('is_superuser')<>'on' then
    raise exception 'BCV_FIXTURE_READER user=% session=% role=% authorization=% superuser=%',
      current_user,session_user,pg_catalog.current_setting('role'),
      pg_catalog.current_setting('session_authorization'),pg_catalog.current_setting('is_superuser');
  end if;
end;
$fixture_reader$;
select pg_temp.assert_true((select value='{"version":1,"ready":true}'::jsonb from bcv_ready_result),
  'contexto servicio sin sub devuelve ready true');
select pg_temp.assert_true((select native_role='service_role' and effective_user='postgres'
  and login_user='authenticator' and actor_id is null and not (claims ? 'sub')
  from bcv_fixture.context_log limit 1), 'rol de request observado en trigger definer de fixture');
select pg_temp.assert_true((select rate::text='883.39630000' from fx_rates
  where id='00000000-0000-4000-8000-000000000501'), 'alta preserva ocho decimales');
select pg_temp.assert_true((select count(*)=1 and bool_and(actor_type='system' and actor_id is null
  and source='job' and event_type='exchange_rate_recorded'
  and reason='Carga automática del catálogo BCV: tasa oficial VES por 1 USD para la fecha valor 2026-10-21.'
  and before_data is null and after_data=jsonb_build_object('currency','VES','rate',883.39630000,'valid_on','2026-10-21','source','bcv')
  and not (payload ? 'note') and not (payload ? 'set_by'))
  from entity_audit_log where entity_id='00000000-0000-4000-8000-000000000501'),
  'alta R3: un evento SYSTEM/job, motivo fijo, cuatro campos');

set session authorization authenticator;
set local role service_role;
update public.fx_rates set rate='883.39630001',set_at='2026-10-21T07:00:00.123456Z'
where id='00000000-0000-4000-8000-000000000501' and tenant_id=md5('0495-synthetic-tenant-A')::uuid
  and currency='VES' and valid_on='2026-10-21' and source='bcv' and rate='883.39630000';
reset role;
reset session authorization;
select pg_temp.assert_true((select count(*)=1 and bool_and(actor_type='system' and actor_id is null
  and source='job' and event_type='exchange_rate_corrected'
  and reason='Actualización automática del catálogo BCV: tasa oficial VES por 1 USD para la fecha valor 2026-10-21.'
  and before_data->>'rate'='883.39630000' and after_data->>'rate'='883.39630001')
  from entity_audit_log where entity_id='00000000-0000-4000-8000-000000000501' and event_type='exchange_rate_corrected'),
  'corrección R3 exacta sin note/set_by');
select pg_temp.assert_true((select set_at::text like '%00.123456+00' from fx_rates
  where id='00000000-0000-4000-8000-000000000501'), 'timestamp conserva microsegundos');

set session authorization authenticator;
set local role service_role;
select set_config('dtd.audit_reason','motivo ajeno sintético',true);
create temporary table bcv_reason_result as select bcv_fixture.error_sql($sql$
  update public.fx_rates set rate='884' where id='00000000-0000-4000-8000-000000000501'
$sql$) as value;
select set_config('dtd.audit_reason','',true);
select set_config('request.jwt.claims','{"role":"service_role","sub":null}',true);
create temporary table bcv_ambiguous_result as select public.bcv_rates_write_capability() as value;
create temporary table bcv_ambiguous_dml_result as select bcv_fixture.error_sql($sql$
  insert into public.fx_rates(id,tenant_id,currency,valid_on,source,rate,set_by)
  values('00000000-0000-4000-8000-000000000503',md5('0495-synthetic-tenant-B')::uuid,'VES','2026-10-23','bcv','885',null)
$sql$) as value;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
reset role;
reset session authorization;
select pg_temp.assert_true((select value='42501' from bcv_reason_result), 'motivo previo rechazado');
select pg_temp.assert_true((select rate::text='883.39630001' from fx_rates
  where id='00000000-0000-4000-8000-000000000501'), 'rechazo motivo revierte tasa');
select pg_temp.assert_true((select value->>'ready'='false' from bcv_ambiguous_result), 'sub null no equivale a ausencia');
select pg_temp.assert_true((select value='42501' from bcv_ambiguous_dml_result), 'sub null DML no habilita SYSTEM/job');
select pg_temp.assert_true(not exists(select 1 from fx_rates where id='00000000-0000-4000-8000-000000000503')
  and not exists(select 1 from entity_audit_log where entity_id='00000000-0000-4000-8000-000000000503')
  and not exists(select 1 from bcv_fixture.context_log where entity_id='00000000-0000-4000-8000-000000000503'),
  'sub null DML no deja tasa/evento/contexto confirmado');

-- Fallo REAL del append0267: catálogo inactivo. La tasa y el evento son atómicos.
update public.audit_entity_types set status='deprecated' where entity_type='exchange_rate';
set session authorization authenticator;
set local role service_role;
create temporary table bcv_append_result as select bcv_fixture.error_sql($sql$
  insert into public.fx_rates(id,tenant_id,currency,valid_on,source,rate,set_by)
  values('00000000-0000-4000-8000-000000000502',md5('0495-synthetic-tenant-B')::uuid,'VES','2026-10-21','bcv','884',null)
$sql$) as value;
reset role;
reset session authorization;
update public.audit_entity_types set status='active' where entity_type='exchange_rate';
select pg_temp.assert_true((select value<>'ok' from bcv_append_result), 'append real falla por catálogo inactivo');
select pg_temp.assert_true(not exists(select 1 from fx_rates where id='00000000-0000-4000-8000-000000000502')
  and not exists(select 1 from entity_audit_log where entity_id='00000000-0000-4000-8000-000000000502'),
  'append fallido no deja tasa ni evento parcial');

-- Drift del trigger: readiness no acepta su propia versión sin dependencia íntegra.
alter table public.fx_rates disable trigger audit_fx_rates;
set session authorization authenticator;
set local role service_role;
create temporary table bcv_drift_result as select public.bcv_rates_write_capability() as value;
reset role;
reset session authorization;
alter table public.fx_rates enable trigger audit_fx_rates;
select pg_temp.assert_true((select value->>'ready'='false' from bcv_drift_result), 'trigger disabled cierra capability');
select pg_temp.assert_true((select count(*)=2 from entity_audit_log
  where entity_id='00000000-0000-4000-8000-000000000501'), 'solo alta y corrección confirmadas');
select 'TEST BCV0501 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
\endif
