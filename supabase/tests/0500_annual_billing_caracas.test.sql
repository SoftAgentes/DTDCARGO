\set ON_ERROR_STOP on
-- SDD-0572-b · Fixture base real de 0495: el conversor a USD que falla cerrado y la tabla de
-- tasas. Fixture sintético aislado; no ejecutar sobre una DB real. Aplica con
-- \ir las migraciones REALES de la auditoría (0267, 0294), facturas (0077),
-- contabilidad (0078) y tesorería (0088), y después 0495. Termina en ROLLBACK.
-- RED: psql -v apply_fix=false -f /sb/tests/0498_annual_billing_fx_v2.test.sql
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
set local timezone='UTC';
do $fixture_guard$
begin
  if to_regclass('public.entity_audit_log') is not null or to_regclass('public.invoices') is not null then
    raise exception 'TEST 0500: fixture rechazada, la base ya contiene objetos de aplicación';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$fixture_guard$;
-- Historia0033 del owner postgres, antes de crear v1; Portal/v2 revocan.
alter default privileges for role postgres in schema public grant all on functions to service_role;
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


-- Identidad mínima sintética; auth.uid entiende SET ROLE y los claims de PostgREST14.
create or replace function auth.uid() returns uuid language sql stable set search_path='' as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''), nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
revoke all on function public.get_user_tenant_id() from public, anon;
grant execute on function public.get_user_tenant_id() to authenticated;
-- Ejecuta la definición REAL vigente 0453, no el antiguo LIMIT 1 de fixture0411.
-- pg_read_file usa solo el volumen local /sb; PGlite inlina exactamente este archivo.
do $tenant_source$
declare src text := pg_read_file('/sb/migrations/0453_portal_helpers_principal_determinista.sql'); definition text;
begin
  definition := substring(src from '(create or replace function public.get_user_tenant_id\(\)[\s\S]*?\$\$;)');
  if definition is null then raise exception 'TEST 0498: no se encontró helper real 0453'; end if;
  execute definition;
end;
$tenant_source$;
-- current_studio_role procede de0200 real; no autorización siempre verdadera.
do $role_source$
declare src text := pg_read_file('/sb/migrations/0200_rbac_disabled_enforcement.sql'); definition text;
begin
 definition := substring(src from '(create or replace function public.current_studio_role\(\)[\s\S]*?\$\$;)');
 if definition is null then raise exception 'TEST 0500: falta current_studio_role real'; end if;
 execute definition;
end;
$role_source$;
create table public.clients(id uuid primary key, tenant_id uuid not null, markbox text not null, name text, deleted_at timestamptz);
create table public.client_users(id uuid primary key, auth_user_id uuid unique, client_id uuid, tenant_id uuid, status text);
alter table public.clients enable row level security;
alter table public.client_users enable row level security;
grant select on public.clients,public.client_users to authenticated;
create policy fixture_client_self on public.client_users for select to authenticated using(auth_user_id=auth.uid());
create policy fixture_clients on public.clients for select to authenticated using(tenant_id=public.get_user_tenant_id() or exists(select 1 from public.client_users cu where cu.client_id=clients.id and cu.tenant_id=clients.tenant_id));
create table public.studio_role_module_overrides(tenant_id uuid, role text,module_id text,can_view boolean,primary key(tenant_id,role,module_id));
create table public.referral_settings(tenant_id uuid primary key,referrer_reward_usd numeric,referred_reward_usd numeric);
create table public.referrals(id uuid primary key,tenant_id uuid,referrer_markbox text,referred_name text,referred_company text,status text,reward_usd numeric,created_at timestamptz,deleted_at timestamptz);
-- 0411 requiere frontera histórica; se carga y se sustituye enseguida con 0414 real.
drop policy "invoices by tenant" on public.invoices;
create policy invoices_team_select on public.invoices for select to authenticated using(tenant_id=public.get_user_tenant_id());
create policy "invoices portal self read" on public.invoices for select to authenticated using(false);
grant select,insert,update on public.invoices to authenticated;
revoke delete on public.invoices from authenticated;
\ir ../migrations/0404_portal_referidos_por_principal.sql
\ir ../migrations/0411_client_annual_billing_facade.sql
-- Dependencias de catálogo de0414; aquí no se prueban sus dominios.
create function public.conversation_client_outstanding(uuid) returns numeric language sql stable security definer set search_path='' as $$select 0::numeric$$;
create function public.sales_order_invoice_refs(uuid[]) returns jsonb language sql stable security definer set search_path='' as $$select '[]'::jsonb$$;
\ir ../migrations/0414_invoices_read_rbac.sql

create function pg_temp.fixture_id(label text) returns uuid language sql immutable as $$select md5('0498-synthetic-'||label)::uuid$$;
insert into public.tenants values(pg_temp.fixture_id('A'),'fixture-0498-a','Sintético A'),(pg_temp.fixture_id('B'),'fixture-0498-b','Sintético B');
insert into auth.users(id) select pg_temp.fixture_id(u) from unnest(array['admin','accounting','commercial','support','operations','disabled','ambiguous','other','portal','revoked','incoherent']) u;
insert into public.user_tenants(user_id,tenant_id,role,disabled_at) select pg_temp.fixture_id(u),pg_temp.fixture_id(t),r,case when u='disabled' then now() end from (values
 ('admin','A','admin'),('accounting','A','accounting'),('commercial','A','commercial'),('support','A','support'),('operations','A','operations'),('disabled','A','commercial'),('ambiguous','A','commercial'),('ambiguous','B','commercial'),('other','B','commercial'))v(u,t,r);
insert into public.clients values(pg_temp.fixture_id('client-A'),pg_temp.fixture_id('A'),'DTD-BASE','Ficticio A',null),(pg_temp.fixture_id('client-B'),pg_temp.fixture_id('B'),'DTD-BASE','Ficticio B',null);
insert into public.client_users values(pg_temp.fixture_id('link-A'),pg_temp.fixture_id('portal'),pg_temp.fixture_id('client-A'),pg_temp.fixture_id('A'),'active'),(pg_temp.fixture_id('link-R'),pg_temp.fixture_id('revoked'),pg_temp.fixture_id('client-A'),pg_temp.fixture_id('A'),'revoked'),(pg_temp.fixture_id('link-I'),pg_temp.fixture_id('incoherent'),pg_temp.fixture_id('client-B'),pg_temp.fixture_id('A'),'active');
insert into public.referral_settings values(pg_temp.fixture_id('A'),80,60);
insert into public.referrals values(pg_temp.fixture_id('ref'),pg_temp.fixture_id('A'),'DTD-BASE','Referido sintético',null,'acreditado',80,now(),null);
insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,fx_rate,base_amount,iva_rate,iva_amount,total_amount,status,issued_at,created_at,deleted_at)
select pg_temp.fixture_id(label),pg_temp.fixture_id(tenant),label,mark,'Cliente sintético',currency::public.invoice_currency,rate,amount,0,0,amount,status::public.invoice_status,(transaction_timestamp() at time zone 'America/Caracas')::date+days,now(),case when gone then now() end from (values
 ('usd','A','DTD-BASE','USD',null::numeric,100::numeric,'emitida',0,false),
 ('cny','A','DTD-BASE','CNY',7,700,'pagada',0,false),
 ('ves','A','DTD-BASE','VES',36,360,'parcial',0,false),
 ('missing','A','DTD-BASE','VES',null,1000,'vencida',0,false),
 ('zero','A','DTD-ZERO','USD',null,0,'emitida',0,false),
 ('negative','A','DTD-NEG','USDT',null,-50,'emitida',0,false),
 ('only','A','DTD-ONLY','CNY',null,10,'emitida',0,false),
 ('other','B','DTD-BASE','USD',null,999,'emitida',0,false),
 ('draft','A','DTD-BASE','USD',null,20000,'borrador',0,false),
 ('void','A','DTD-BASE','USD',null,20000,'anulada',0,false),
 ('deleted','A','DTD-BASE','USD',null,20000,'emitida',0,true),
 ('old','A','DTD-BASE','USD',null,20000,'emitida',-800,false),
 ('future','A','DTD-BASE','USD',null,5,'emitida',2,false)
)v(label,tenant,mark,currency,rate,amount,status,days,gone);
-- Total de factura (incluye IVA) es el contrato anual legado; no sustituir por base.
update public.invoices set base_amount=80,iva_amount=20,iva_rate=25 where invoice_code='usd';


-- Base anual vigente en C1: estas funciones no cambiaron en0499.
\ir ../migrations/0498_annual_billing_fx_v2.sql
-- Todo lo siguiente pertenece solo a este fixture sintético y termina en rollback.
\if :{?fixture_only}
\else
\set fixture_only false
\endif
\if :fixture_only
commit;
\else
create temporary sequence assertion_count;
create function pg_temp.assert_true(value boolean,label text) returns void language plpgsql as $$begin
 if value is distinct from true then raise exception 'TEST 0500: %',label; end if; perform nextval('pg_temp.assertion_count'); end$$;
create function pg_temp.actor(actor text,sql text,role_name text default 'authenticated') returns jsonb language plpgsql as $$declare result jsonb; begin
 perform set_config('request.jwt.claim.sub',coalesce(pg_temp.fixture_id(actor)::text,''),true);
 execute format('set local role %I',role_name); execute sql into result; reset role; return result;
 exception when others then reset role; raise; end$$;
create function pg_temp.err(actor text,sql text,role_name text default 'authenticated') returns text language plpgsql as $$begin
 perform pg_temp.actor(actor,sql,role_name); return 'ok'; exception when others then return sqlstate||'|'||sqlerrm; end$$;
create temporary table c2_before as
select oid,proname,proowner,proacl,prosecdef,provolatile,proconfig,prolang,
 pg_get_function_result(oid) result_type,pg_get_function_identity_arguments(oid) arguments,
 pg_get_functiondef(oid) definition,md5(prosrc) body_md5,
 array(select has_function_privilege(r,oid,'EXECUTE') from unnest(array['anon','authenticated','service_role']) r) effective_acl
from pg_proc where oid in ('public.studio_client_annual_billing(date)'::regprocedure,'public.studio_client_annual_billing_v2(date)'::regprocedure,'public.get_portal_referral_program()'::regprocedure);
create temporary table c2_untouched as select oid,pg_get_functiondef(oid) definition,proowner,proacl from pg_proc where oid in ('public.to_usd(numeric,text,numeric)'::regprocedure,'annual_billing_private.convertir_factura_anual_usd(numeric,text,numeric)'::regprocedure,'public.get_user_tenant_id()'::regprocedure,'public.current_studio_role()'::regprocedure);
create temporary table c2_state as select
 (select jsonb_agg(to_jsonb(i) order by id) from public.invoices i) invoices,
 (select jsonb_agg(to_jsonb(a) order by id) from public.entity_audit_log a) audit,
 (select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p where schemaname='public') policies;
-- DDL íntegra y real PRIMERO: ninguna sustitución del reloj hasta el marcador.
\if :apply_fix
\ir ../migrations/0500_annual_billing_caracas.sql
\endif
create temporary table c2_after as
select p.oid,p.proname,p.proowner,p.proacl,p.prosecdef,p.provolatile,p.proconfig,p.prolang,
 pg_get_function_result(p.oid) result_type,pg_get_function_identity_arguments(p.oid) arguments,
 pg_get_functiondef(p.oid) definition,md5(p.prosrc) body_md5,
 array(select has_function_privilege(r,p.oid,'EXECUTE') from unnest(array['anon','authenticated','service_role']) r) effective_acl
from pg_proc p join c2_before b using(oid);
select jsonb_build_object('fase','DDL-real-intacta','antes',(select jsonb_agg(to_jsonb(b) order by proname) from c2_before b),'despues',(select jsonb_agg(to_jsonb(a) order by proname) from c2_after a),'helpers',(select jsonb_agg(to_jsonb(h) order by oid) from c2_untouched h)) as catalogo_real;
select pg_temp.assert_true((select count(*)=3 and bool_and((a.oid,a.proowner,a.proacl,a.prosecdef,a.provolatile,a.proconfig,a.prolang,a.result_type,a.arguments,a.effective_acl) is not distinct from (b.oid,b.proowner,b.proacl,b.prosecdef,b.provolatile,b.proconfig,b.prolang,b.result_type,b.arguments,b.effective_acl)) from c2_before b join c2_after a using(oid)),'identidad firma retorno owner ACL efectiva y seguridad intactos');
select pg_temp.assert_true((select bool_and(pg_get_functiondef(h.oid)=h.definition and p.proowner=h.proowner and p.proacl is not distinct from h.proacl) from c2_untouched h join pg_proc p using(oid)),'helpers completos intactos');
select pg_temp.assert_true((select invoices is not distinct from (select jsonb_agg(to_jsonb(i) order by id) from public.invoices i) and audit is not distinct from (select jsonb_agg(to_jsonb(a) order by id) from public.entity_audit_log a) and policies is not distinct from (select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p where schemaname='public') from c2_state),'cero DML y RLS intacta');
select pg_temp.assert_true((select effective_acl=array[false,true,true] from c2_before where proname='studio_client_annual_billing') and (select bool_and(effective_acl=array[false,true,false]) from c2_before where proname<>'studio_client_annual_billing'),'historia0033 ACL diferenciada y owner postgres reproducidos');
-- Respuestas reales tras DDL sin sustituir el reloj, con el día de transacción.
select pg_temp.assert_true(pg_temp.actor('commercial',$q$select to_jsonb(x) from public.studio_client_annual_billing_v2((transaction_timestamp() at time zone 'America/Caracas')::date) x where client_markbox='DTD-BASE'$q$)='{"client_markbox":"DTD-BASE","subtotal_usd":"210.00","sin_tasa_count":1,"conversion_state":"sin_tasa"}'::jsonb,'fase real v2 completa compatible');
select pg_temp.assert_true((pg_temp.actor('commercial',$q$select to_jsonb(x) from public.studio_client_annual_billing((transaction_timestamp() at time zone 'America/Caracas')::date) x where client_markbox='DTD-BASE'$q$)->>'billed_usd')::numeric=110,'fase real v1 legada compatible');
select pg_temp.assert_true(pg_temp.actor('portal','select public.get_portal_referral_program()')->'billing_v2'='{"version":2,"subtotal_usd":"215.00","sin_tasa_count":1,"conversion_state":"sin_tasa"}'::jsonb,'fase real Portal conserva futuro');
select 'FASE REAL 0500 COMPLETA; solo después se instrumenta el reloj' as fase;

-- Transformación SOLO en copias pg_temp de las tres definiciones medidas.
-- Dos anclas por cuerpo: se aborta ante ausencia, cantidad extra o deriva.
create function pg_temp.freeze(instant timestamptz) returns void language plpgsql as $freeze$
declare f record; def text; anchor text; n integer;
begin
 for f in select * from c2_after order by proname loop
   anchor := 'pg_catalog.transaction_timestamp()';
   n := (length(f.definition)-length(replace(f.definition,anchor,'')))/length(anchor);
   if n=0 then
     anchor := 'current_date';
     n := (length(f.definition)-length(replace(f.definition,anchor,'')))/length(anchor);
     if n<>2 then raise exception 'TEST 0500: deriva reloj histórico %: %',f.proname,n; end if;
     def := replace(f.definition,anchor,format('(%L::timestamptz at time zone current_setting(''TimeZone''))::date',instant));
   else
     if n<>2 then raise exception 'TEST 0500: deriva reloj Caracas %: %',f.proname,n; end if;
     def := replace(f.definition,anchor,format('%L::timestamptz',instant));
   end if;
   execute def;
 end loop;
end;
$freeze$;
create function pg_temp.invoice(label text,mark text,amount numeric,issued date,created timestamptz,currency text default 'USD',rate numeric default null,tenant text default 'A') returns void language sql as $$
 insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,fx_rate,base_amount,total_amount,status,issued_at,created_at)
 values(pg_temp.fixture_id(label),pg_temp.fixture_id(tenant),label,mark,'Sintético',currency::public.invoice_currency,rate,amount,amount,'emitida',issued,created)
$$;

\if :{?test_v1}
\else
\set test_v1 true
\endif
\if :{?test_v2}
\else
\set test_v2 true
\endif
\if :{?test_portal}
\else
\set test_portal true
\endif
\if :{?test_permissions}
\else
\set test_permissions true
\endif
create temporary table c2_groups(name text primary key);
\if :test_v1
insert into c2_groups values('v1');
\endif
\if :test_v2
insert into c2_groups values('v2');
\endif
\if :test_portal
insert into c2_groups values('portal');
\endif
-- Cada grupo usa oráculos propios y el mismo instante para las tres funciones.
-- No detiene la medición de un consumidor por seleccionar previamente otro.
do $temporal$
declare scenario record; zone text; mark text; lower_day date; extra numeric; expected numeric; entry record; payload jsonb; expression text; delta integer;
begin
 for scenario in select * from (values
  (1,'2026-10-21T02:30:00Z'::timestamptz,date '2026-10-20',date '2025-10-20'),
  (2,'2026-10-21T03:59:59.999Z'::timestamptz,date '2026-10-20',date '2025-10-20'),
  (3,'2026-10-21T04:00:00Z'::timestamptz,date '2026-10-21',date '2025-10-21'),
  (4,'2027-01-01T02:30:00Z'::timestamptz,date '2026-12-31',date '2025-12-31'),
  (5,'2024-03-01T02:30:00Z'::timestamptz,date '2024-02-29',date '2023-02-28'),
  (6,'2024-03-01T04:00:00Z'::timestamptz,date '2024-03-01',date '2023-03-01'),
  (7,'2010-01-01T04:15:00Z'::timestamptz,date '2009-12-31',date '2008-12-31')
 ) v(n,instant,day,lo) loop
   mark := 'TIME-'||scenario.n; lower_day := scenario.lo;
   perform pg_temp.invoice(mark||'-lower',mark,11,lower_day,((scenario.day+10)::text||'T12:00:00Z')::timestamptz);
   perform pg_temp.invoice(mark||'-before',mark,13,lower_day-1,scenario.instant);
   perform pg_temp.invoice(mark||'-priority',mark,17,lower_day,((lower_day-10)::text||'T12:00:00Z')::timestamptz);
   perform pg_temp.invoice(mark||'-fallback-lower',mark,19,null,((lower_day+1)::text||'T02:30:00Z')::timestamptz);
   perform pg_temp.invoice(mark||'-fallback-before',mark,23,null,(lower_day::text||'T02:30:00Z')::timestamptz);
   perform pg_temp.invoice(mark||'-upper',mark,29,scenario.day,scenario.instant);
   perform pg_temp.invoice(mark||'-future',mark,31,scenario.day+1,scenario.instant);
   perform pg_temp.invoice(mark||'-fallback-upper',mark,37,null,((scenario.day+1)::text||'T03:59:59.999Z')::timestamptz);
   perform pg_temp.invoice(mark||'-fallback-future',mark,41,null,((scenario.day+1)::text||'T04:30:00Z')::timestamptz);
   extra := 0;
   if scenario.n=7 then
     perform pg_temp.invoice(mark||'-history',mark,43,null,'2010-01-01T04:15:00Z'); extra := 43;
   end if;
   update public.clients set markbox=mark where id=pg_temp.fixture_id('client-A');
   foreach zone in array array['UTC','America/Caracas','Asia/Shanghai'] loop
     perform set_config('TimeZone',zone,true);
     perform pg_temp.freeze(scenario.instant);
     for entry in select name from c2_groups order by name loop
       if entry.name='portal' then
         payload := pg_temp.actor('portal','select public.get_portal_referral_program()');
         perform pg_temp.assert_true((payload->>'billed_usd')::numeric=185+extra,'portal legado lower calendario inclusivo prioridad fallback IANA sin upper '||scenario.n||'/'||zone);
         perform pg_temp.assert_true(payload->'billing_v2'=jsonb_build_object('version',2,'subtotal_usd',((185+extra)::numeric(1000,2))::text,'sin_tasa_count',0,'conversion_state','completo'),'portal v2 población temporal '||scenario.n||'/'||zone);
         perform pg_temp.assert_true(payload->>'markbox'=mark and payload->>'referrer_reward_usd'='80' and payload->>'referred_reward_usd'='60' and payload->'referrals'='[]'::jsonb,'portal campos no anuales conservados '||scenario.n||'/'||zone);
       else
         expression := case when entry.name='v1' then 'public.studio_client_annual_billing' else 'public.studio_client_annual_billing_v2' end;
         payload := pg_temp.actor('commercial',format('select to_jsonb(x) from %s(%L::date) x where client_markbox=%L',expression,scenario.day,mark));
         expected := 113+extra;
         perform pg_temp.assert_true((payload->>case when entry.name='v1' then 'billed_usd' else 'subtotal_usd' end)::numeric=expected,entry.name||' lower y upper inclusivos prioridad fallback IANA calendario '||scenario.n||'/'||zone);
         if entry.name='v2' then
           perform pg_temp.assert_true(payload->>'subtotal_usd'=expected::numeric(1000,2)::text and payload->>'sin_tasa_count'='0' and payload->>'conversion_state'='completo','v2 DTO temporal exacto '||scenario.n||'/'||zone);
         end if;
         foreach delta in array array[-1,0,1] loop
           perform pg_temp.assert_true(pg_temp.err('commercial',format('select to_jsonb(count(*)) from %s(%L::date)',expression,scenario.day+delta))='ok',entry.name||' tolerancia extremo '||delta||' '||scenario.n||'/'||zone);
         end loop;
         foreach delta in array array[-2,2] loop
           perform pg_temp.assert_true(pg_temp.err('commercial',format('select to_jsonb(count(*)) from %s(%L::date)',expression,scenario.day+delta)) like '22023|%',entry.name||' rechaza ±2 '||delta||' '||scenario.n||'/'||zone);
         end loop;
         perform pg_temp.assert_true(pg_temp.err('commercial',format('select to_jsonb(count(*)) from %s(null)',expression)) like '22023|%',entry.name||' NULL conserva error '||scenario.n||'/'||zone);
       end if;
     end loop;
   end loop;
 end loop;
end;
$temporal$;
-- Restaura solo las copias medidas de producto, antes del bloque independiente.
do $$declare f record;begin for f in select * from c2_after loop execute f.definition;end loop;end$$;
set local timezone='UTC';
update public.clients set markbox='DTD-BASE' where id=pg_temp.fixture_id('client-A');
\if :test_permissions
-- Independiente de los casos de reloj, no admin universal ni helper simulado.
do $permissions$
declare expression text; actor text; role_name text; payload jsonb; day date := (transaction_timestamp() at time zone 'America/Caracas')::date;
begin
 foreach expression in array array['public.studio_client_annual_billing','public.studio_client_annual_billing_v2'] loop
  foreach actor in array array['disabled','ambiguous','operations','portal'] loop
   perform pg_temp.assert_true(pg_temp.err(actor,format('select to_jsonb(x) from %s(%L::date) x',expression,day)) like '42501|%',expression||' niega '||actor);
  end loop;
  foreach actor in array array['support','accounting','commercial','admin'] loop
   perform pg_temp.assert_true(pg_temp.err(actor,format('select to_jsonb(x) from %s(%L::date) x',expression,day))='ok',expression||' admite '||actor);
  end loop;
  perform pg_temp.assert_true(pg_temp.actor('other',format('select to_jsonb(x) from %s(%L::date) x where client_markbox=''DTD-BASE''',expression,day))->>case when expression like '%_v2' then 'subtotal_usd' else 'billed_usd' end in ('999','999.00'),expression||' tenant separado mismo markbox');
  insert into public.studio_role_module_overrides values(pg_temp.fixture_id('A'),'commercial','fidelizacion',false);
  perform pg_temp.assert_true(pg_temp.err('commercial',format('select to_jsonb(x) from %s(%L::date) x',expression,day))='ok',expression||' OR conserva Kommo');
  insert into public.studio_role_module_overrides values(pg_temp.fixture_id('A'),'commercial','kommo',false);
  perform pg_temp.assert_true(pg_temp.err('commercial',format('select to_jsonb(x) from %s(%L::date) x',expression,day)) like '42501|%',expression||' false explícito no reabre');
  delete from public.studio_role_module_overrides;
  perform pg_temp.assert_true(pg_temp.err('commercial',format('select to_jsonb(x) from %s(%L::date) x',expression,day),'anon') like '42501|%',expression||' anon niega');
 end loop;
 perform pg_temp.assert_true(pg_temp.err('commercial',format('select to_jsonb(x) from public.studio_client_annual_billing(%L::date) x',day),'service_role')='ok','v1 conserva EXECUTE service_role heredado con autorización interna');
 perform pg_temp.assert_true(pg_temp.err('commercial',format('select to_jsonb(x) from public.studio_client_annual_billing_v2(%L::date) x',day),'service_role') like '42501|%','v2 service_role revocado');
 perform pg_temp.assert_true(pg_temp.actor('commercial','select to_jsonb(count(*)) from public.invoices')='0'::jsonb,'RLS no revela facturas al caller');
 foreach actor in array array['revoked','incoherent'] loop
  perform pg_temp.assert_true(pg_temp.actor(actor,'select public.get_portal_referral_program()') is null,'Portal ausencia real '||actor);
 end loop;
 foreach role_name in array array['anon','service_role'] loop
  perform pg_temp.assert_true(pg_temp.err('portal','select public.get_portal_referral_program()',role_name) like '42501|%','Portal ACL niega '||role_name);
 end loop;
 perform pg_temp.assert_true(not has_schema_privilege('authenticated','annual_billing_private','USAGE') and not has_function_privilege('authenticated','annual_billing_private.convertir_factura_anual_usd(numeric,text,numeric)','EXECUTE'),'helper privado sin API');
 payload := pg_temp.actor('commercial',format($q$select jsonb_agg(to_jsonb(x) order by client_markbox) from public.studio_client_annual_billing_v2(%L::date) x where client_markbox in ('DTD-ZERO','DTD-NEG','DTD-ONLY')$q$,day));
 perform pg_temp.assert_true(payload='[{"client_markbox":"DTD-NEG","subtotal_usd":"-50.00","sin_tasa_count":0,"conversion_state":"completo"},{"client_markbox":"DTD-ONLY","subtotal_usd":"0.00","sin_tasa_count":1,"conversion_state":"sin_tasa"},{"client_markbox":"DTD-ZERO","subtotal_usd":"0.00","sin_tasa_count":0,"conversion_state":"completo"}]'::jsonb,'v2 conserva cero negativo solo excluidas y DTO');
 perform pg_temp.assert_true(pg_temp.actor('commercial',format($q$select to_jsonb(count(*)) from public.studio_client_annual_billing(%L::date) x where client_markbox in ('DTD-ZERO','DTD-NEG','DTD-ONLY')$q$,day))='0'::jsonb,'v1 conserva HAVING positivo');
 perform pg_temp.assert_true((select usd from annual_billing_private.convertir_factura_anual_usd(15.66,'RMB',7.2))=2.18 and (select usd from annual_billing_private.convertir_factura_anual_usd(-15.66,'CNY',7.2))=-2.18,'FX preserva signo RMB CNY precisión');
 perform pg_temp.assert_true((select sum(c.usd) from generate_series(1,2) g cross join lateral annual_billing_private.convertir_factura_anual_usd(g*0+0.01,'VES',2) c)=0.02,'FX redondeo por factura sin cambiar helper');
end;
$permissions$;
\endif
select pg_temp.assert_true((select bool_and(pg_get_functiondef(a.oid)=a.definition) from c2_after a),'copias de reloj restauradas íntegramente');
select pg_temp.assert_true((select bool_and(pg_get_functiondef(h.oid)=h.definition) from c2_untouched h),'helpers originales restaurados sin instrumentación');
select 'TEST 0500 GREEN: '||last_value||' aserciones' as resultado from assertion_count;
rollback;
\endif