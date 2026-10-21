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
    raise exception 'TEST 0498: fixture rechazada, la base ya contiene objetos de aplicación';
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
select pg_temp.fixture_id(label),pg_temp.fixture_id(tenant),label,mark,'Cliente sintético',currency::public.invoice_currency,rate,amount,0,0,amount,status::public.invoice_status,current_date+days,now(),case when gone then now() end from (values
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

-- HTTP reutiliza SOLO este fixture confirmado; arranca PostgREST antes del DDL0498.
\if :{?fixture_only}
\else
\set fixture_only false
\endif
\if :fixture_only
commit;
\else
create temporary sequence assertion_count;
create function pg_temp.assert_true(value boolean,label text) returns void language plpgsql as $$begin
 if value is distinct from true then raise exception 'TEST 0498: %',label; end if; perform nextval('pg_temp.assertion_count'); end$$;
create function pg_temp.actor(actor text,sql text,role_name text default 'authenticated') returns jsonb language plpgsql as $$declare result jsonb; begin
 perform set_config('request.jwt.claim.sub',coalesce(pg_temp.fixture_id(actor)::text,''),true);
 execute format('set local role %I',role_name); execute sql into result; reset role; return result;
 exception when others then reset role; raise; end$$;
create function pg_temp.err(actor text,sql text,role_name text default 'authenticated') returns text language plpgsql as $$begin
 perform pg_temp.actor(actor,sql,role_name); return 'ok'; exception when others then return sqlstate||'|'||sqlerrm; end$$;
create temporary table legacy_v1 as select oid,proowner,proacl,pg_get_functiondef(oid) def from pg_proc where oid='public.studio_client_annual_billing(date)'::regprocedure;
create temporary table legacy_portal as select oid,proowner,proacl,pg_temp.actor('portal','select public.get_portal_referral_program()') payload from pg_proc where oid='public.get_portal_referral_program()'::regprocedure;
\if :apply_fix
\ir ../migrations/0498_annual_billing_fx_v2.sql
\endif
select pg_temp.assert_true(to_regprocedure('public.studio_client_annual_billing_v2(date)') is not null,'existe RPC v2 sin retirar v1');
select pg_temp.assert_true((select bool_and(p.oid=b.oid and p.proowner=b.proowner and p.proacl is not distinct from b.proacl and pg_get_functiondef(p.oid)=b.def) from legacy_v1 b join pg_proc p on p.oid=b.oid),'v1 identidad ACL y definición intactas');
select pg_temp.assert_true((select pg_temp.actor('portal','select public.get_portal_referral_program()')-'billing_v2'=payload from legacy_portal),'Portal conserva todos los campos legados');
select pg_temp.assert_true((select bool_and(p.oid=b.oid and p.proowner=b.proowner and p.proacl is not distinct from b.proacl) from legacy_portal b join pg_proc p on p.oid=b.oid),'Portal identidad y ACL intactas');
select pg_temp.assert_true(pg_temp.actor('commercial',$q$select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x where client_markbox='DTD-BASE'$q$)='{"client_markbox":"DTD-BASE","subtotal_usd":"210.00","sin_tasa_count":1,"conversion_state":"sin_tasa"}'::jsonb,'v2 convierte CNY y conserva parcial sin multiplicar');
select pg_temp.assert_true(pg_temp.actor('portal','select public.get_portal_referral_program()')->'billing_v2'='{"version":2,"subtotal_usd":"215.00","sin_tasa_count":1,"conversion_state":"sin_tasa"}'::jsonb,'Portal conserva ventana futura sin cota superior');
select pg_temp.assert_true(pg_temp.actor('commercial',$q$select jsonb_agg(to_jsonb(x) order by client_markbox) from public.studio_client_annual_billing_v2(current_date) x where client_markbox in ('DTD-ZERO','DTD-NEG','DTD-ONLY')$q$)='[{"client_markbox":"DTD-NEG","subtotal_usd":"-50.00","sin_tasa_count":0,"conversion_state":"completo"},{"client_markbox":"DTD-ONLY","subtotal_usd":"0.00","sin_tasa_count":1,"conversion_state":"sin_tasa"},{"client_markbox":"DTD-ZERO","subtotal_usd":"0.00","sin_tasa_count":0,"conversion_state":"completo"}]'::jsonb,'incluye cero negativo y solo sin tasa');
select pg_temp.assert_true(pg_temp.actor('other',$q$select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x$q$)->>'subtotal_usd'='999.00','tenant distinto con mismo markbox');
select pg_temp.assert_true(pg_temp.actor('commercial','select to_jsonb(count(*)) from public.invoices')='0'::jsonb,'RPC no concede lectura directa de facturas');
select pg_temp.assert_true(pg_temp.actor('revoked','select public.get_portal_referral_program()') is null and pg_temp.actor('incoherent','select public.get_portal_referral_program()') is null,'Portal vínculo revocado o incoherente');
select pg_temp.assert_true(pg_temp.err('disabled','select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x') like '42501|%' and pg_temp.err('ambiguous','select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x') like '42501|%' and pg_temp.err(null,'select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x') like '42501|%','sin identidad deshabilitado o dos membresías bloqueados');
select pg_temp.assert_true(pg_temp.actor('ambiguous','select to_jsonb(public.current_studio_role())')='"commercial"'::jsonb and pg_temp.actor('ambiguous','select to_jsonb(public.get_user_tenant_id())') is null,'helper0453 real cierra aunque rol resuelva');
select pg_temp.assert_true(pg_temp.err('operations','select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x') like '42501|%','rol sin permiso bloqueado');
select pg_temp.assert_true(pg_temp.err('support','select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x')='ok' and pg_temp.err('accounting','select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x')='ok','support por Fidelización y accounting autorizados');
insert into public.studio_role_module_overrides values(pg_temp.fixture_id('A'),'operations','kommo',true);
select pg_temp.assert_true(pg_temp.err('operations','select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x')='ok','override efectivo habilita Kommo');
delete from public.studio_role_module_overrides;
insert into public.studio_role_module_overrides values(pg_temp.fixture_id('A'),'commercial','fidelizacion',false);
select pg_temp.assert_true(pg_temp.err('commercial','select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x')='ok','OR entre módulos conserva Kommo permitido');
insert into public.studio_role_module_overrides values(pg_temp.fixture_id('A'),'commercial','kommo',false);
select pg_temp.assert_true(pg_temp.err('commercial','select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x') like '42501|%','false explícito de ambos módulos no reabre defaults');
delete from public.studio_role_module_overrides;
select pg_temp.assert_true(pg_temp.err('admin','select to_jsonb(x) from public.studio_client_annual_billing_v2(null) x') like '22023|%' and pg_temp.err('admin','select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date-2) x') like '22023|%','as_of nulo o fuera de ventana rechazado');
select pg_temp.assert_true(pg_temp.err('admin','select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x','anon') like '42501|%' and pg_temp.err('admin','select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x','service_role') like '42501|%','anon y service_role no ejecutan v2');
select pg_temp.assert_true(not has_schema_privilege('authenticated','annual_billing_private','USAGE') and not has_function_privilege('authenticated','annual_billing_private.convertir_factura_anual_usd(numeric,text,numeric)','EXECUTE'),'ayudante privado no expuesto');
-- Clasificación exacta / orden canónico / half away from zero / 8 decimales.
select pg_temp.assert_true((select usd from annual_billing_private.convertir_factura_anual_usd(15.66,'RMB',7.2))=2.18 and (select usd from annual_billing_private.convertir_factura_anual_usd(-15.66,'CNY',7.2))=-2.18,'redondeo canónico con signo');
select pg_temp.assert_true((select sum(c.usd) from generate_series(1,2) g cross join lateral annual_billing_private.convertir_factura_anual_usd(g*0+0.01,'VES',2) c)=0.02,'redondeo por factura antes de suma');
select pg_temp.assert_true((select usd from annual_billing_private.convertir_factura_anual_usd(1,'VES',0.00000001))=100000000,'tasa persistida ocho decimales');
select pg_temp.assert_true((select bool_and(c.fx_state='sin_tasa') from unnest(array[null::numeric,0,-1,'NaN'::numeric,'Infinity'::numeric,1e12]) r cross join lateral annual_billing_private.convertir_factura_anual_usd(1,'CNY',r) c),'tasas inválidas clasificadas');
select pg_temp.assert_true((select bool_and(c.fx_state='datos_invalidos') from unnest(array[null::numeric,'NaN'::numeric,'Infinity'::numeric,1e12,-1e12]) a cross join lateral annual_billing_private.convertir_factura_anual_usd(a,'VES',null) c),'monto inválido precede tasa faltante');
select pg_temp.assert_true((select fx_state from annual_billing_private.convertir_factura_anual_usd(1,'XXX',1))='datos_invalidos','moneda desconocida no es falta de tasa');

-- Casos de agregado y fechas, sin variar reglas de emisión ni ventana.
insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,fx_rate,base_amount,total_amount,status,issued_at,created_at)
select pg_temp.fixture_id(label),pg_temp.fixture_id('A'),label,mark,'Sintético',cur::invoice_currency,rate,amount,amount,'emitida',day,created from (values
 ('half1','DTD-HALF','VES',2::numeric,0.01::numeric,current_date,now()),('half2','DTD-HALF','VES',2,0.01,current_date,now()),
 ('invalid','DTD-INVALID','USD',null,'NaN'::numeric,current_date,now()),('invalid-missing','DTD-INVALID','CNY',null,1,current_date,now()),
 ('large','DTD-LARGE','VES',0.00000001,999999999999.99,current_date,now()),
 ('lower','DTD-DATE','USD',null,3,(current_date-interval '1 year')::date,now()),
 ('before-lower','DTD-DATE','USD',null,500,(current_date-interval '1 year')::date-1,now()),
 ('fallback','DTD-DATE','USD',null,7,null, (current_date-interval '1 year')::timestamp at time zone 'UTC')
)v(label,mark,cur,rate,amount,day,created);
select pg_temp.assert_true(pg_temp.actor('admin',$q$select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x where client_markbox='DTD-HALF'$q$)->>'subtotal_usd'='0.02','agregado redondea cada factura');
select pg_temp.assert_true(pg_temp.actor('admin',$q$select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x where client_markbox='DTD-INVALID'$q$)='{"client_markbox":"DTD-INVALID","subtotal_usd":null,"sin_tasa_count":1,"conversion_state":"datos_invalidos"}'::jsonb,'inválido tiene precedencia y conserva contador distinto');
select pg_temp.assert_true(pg_temp.actor('admin',$q$select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x where client_markbox='DTD-LARGE'$q$)->>'subtotal_usd'='99999999999999000000.00','subtotal grande decimal exacto como texto');
select pg_temp.assert_true(pg_temp.actor('admin',$q$select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x where client_markbox='DTD-DATE'$q$)->>'subtotal_usd'='10.00','límite inferior inclusivo año calendario y fallbackUTC');
select pg_temp.assert_true((date '2024-02-29'-interval '1 year')::date=date '2023-02-28' and (date '2025-03-01'-interval '1 year')::date=date '2024-03-01','aritmética calendario bisiesto sin365días');
create temporary table fixture_as_of as select current_date as day;
set local timezone='America/Los_Angeles';
select pg_temp.assert_true(pg_temp.actor('admin',format($q$select to_jsonb(x) from public.studio_client_annual_billing_v2(%L::date) x where client_markbox='DTD-DATE'$q$,(select day from fixture_as_of)))->>'subtotal_usd'='10.00','fallbackUTC de Studio no depende de zona de sesión');
set local timezone='UTC';
-- Carga sintética, no producción/JWT. CTE MATERIALIZED evita repetir por SUM/COUNT/estado.
create temporary sequence conversion_calls;
do $instrument$
declare body text;
begin
 select prosrc into body from pg_proc where oid='public.to_usd(numeric,text,numeric)'::regprocedure;
 body := regexp_replace(body,'begin','begin perform nextval(''pg_temp.conversion_calls'');');
 execute format('create or replace function public.to_usd(p_amount numeric,p_currency text,p_rate numeric) returns numeric language plpgsql volatile set search_path='''' as %L',body);
end;
$instrument$;
insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,fx_rate,base_amount,total_amount,status,issued_at)
select md5('0498-load-'||g)::uuid,pg_temp.fixture_id('B'),'load-'||g,'LOAD-'||lpad(g::text,5,'0'),'Sintético','CNY',7,g,g,'emitida',current_date from generate_series(1,1200) g;
select setval('conversion_calls',1,false);
select pg_temp.assert_true(pg_temp.actor('other','select to_jsonb(count(*)) from public.studio_client_annual_billing_v2(current_date)')='1201'::jsonb,'carga mayor de1000 grupos conserva todos');
select pg_temp.assert_true((select last_value from conversion_calls)<=1201 and (select last_value from conversion_calls)>0,'clasificador no recalcula por cada agregado');
select jsonb_build_object('clasificaciones',(select last_value from conversion_calls),'facturas_elegibles',1201,'fuente','to_usd real instrumentado solo en fixture') as medicion;

-- Inyectar fallo canónico sintético verifica que no se capture todo22023.
create or replace function public.to_usd(p_amount numeric,p_currency text,p_rate numeric) returns numeric language plpgsql immutable set search_path='' as $$begin raise exception 'otro error' using errcode='22023',hint='dtd-fx'; end$$;
select pg_temp.assert_true(pg_temp.err('admin','select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x') like '22023|otro error','error SQL ajeno se relanza');
create or replace function public.to_usd(p_amount numeric,p_currency text,p_rate numeric) returns numeric language plpgsql immutable set search_path='' as $$begin raise exception 'FX_RATE_MISSING' using errcode='22023',hint='otro'; end$$;
select pg_temp.assert_true(pg_temp.err('admin','select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x') like '22023|FX_RATE_MISSING','mensaje conocido con hint ajeno se relanza');
create or replace function public.to_usd(p_amount numeric,p_currency text,p_rate numeric) returns numeric language plpgsql immutable set search_path='' as $$begin raise exception 'FX_RATE_MISSING' using errcode='P0001',hint='dtd-fx'; end$$;
select pg_temp.assert_true(pg_temp.err('admin','select to_jsonb(x) from public.studio_client_annual_billing_v2(current_date) x') like 'P0001|FX_RATE_MISSING','mensaje y hint conocidos con SQLSTATE ajeno se relanza');
select 'TEST 0498 GREEN: '||last_value||' aserciones' as resultado from assertion_count;
rollback;
\endif
