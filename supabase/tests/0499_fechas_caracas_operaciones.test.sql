\set ON_ERROR_STOP on
-- SDD0576/C1. SOLO PostgreSQL desechable vacío, datos sintéticos y ROLLBACK.
-- 0421 aporta estructura Portal y auditoría REAL. auth.uid es adaptador de JWT;
-- la identidad Studio se reemplaza abajo por el cuerpo REAL de0453, no LIMIT1.
-- apply_fix=false conserva cuerpos/defaults anteriores y debe FALLAR por fecha.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
\if :{?fixture_only}
\else
\set fixture_only false
\endif
\if :{?run_defaults}
\else
\set run_defaults true
\endif
\if :{?run_operations}
\else
\set run_operations true
\endif
\if :{?run_auto_invoice}
\else
\set run_auto_invoice true
\endif
\if :{?run_expenses}
\else
\set run_expenses true
\endif
\if :{?run_portal}
\else
\set run_portal true
\endif
\if :{?run_closing}
\else
\set run_closing true
\endif
\if :{?run_portal_replay_only}
\else
\set run_portal_replay_only false
\endif
\set caracas_apply :apply_fix
\set apply_fix true
\set fixture_in_transaction true
begin;
\ir 0421_payment_report_commands.test.sql
\set fixture_in_transaction false
\set apply_fix :caracas_apply
\ir ../migrations/0464_reporte_pago_factura_pagada.sql

alter table public.tenants add column slug text;
alter table public.shipments add column shipment_service text;
\ir ../migrations/0078_contabilidad.sql
\ir ../migrations/0079_cobranzas.sql
\ir ../migrations/0088_tesoreria.sql
\ir ../migrations/0047_expenses.sql
\ir ../migrations/0122_recibos_cobranza.sql
\ir ../migrations/0132_expense_posting.sql
\ir ../migrations/0133_period_close.sql
-- Restaurar el contrato AUD-01 real0267 tras cargar tablas históricas: el
-- catálogo/FK ya instalado gobierna entity_type, no su antiguo CHECK0066.
alter table public.entity_audit_log drop constraint if exists entity_audit_log_entity_type_check;
alter table public.expenses add column receipt_path text, add column receipt_document_id uuid;
\ir ../migrations/0290_audit_d2_financial_domain.sql
\ir ../migrations/0340_expense_void_governance.sql
\ir ../migrations/0407_invoices_write_rbac.sql
-- Aplicar la definición/postflight de las policies REALES0414; su preflight
-- de release0411–0413 no pertenece a esta fixture ni se sustituye por RPC vacía.
do $read_boundary$
declare source text:=pg_read_file('/sb/migrations/0414_invoices_read_rbac.sql'); start_at int;
begin
 start_at:=strpos(source,'drop policy invoices_team_select on public.invoices;');
 if start_at=0 then raise exception 'TEST0499: deriva fuente0414'; end if;
 execute substring(source from start_at);
end;
$read_boundary$;

-- Definiciones completas REALES: tenant inequívoco0453 y rol activo0200.
-- auth.uid sigue siendo el adaptador de claims sintéticos declarado arriba.
do $identity$
declare source text := pg_read_file('/sb/migrations/0453_portal_helpers_principal_determinista.sql'); definition text;
begin
  definition := substring(source from '(?s)(create or replace function public\.get_user_tenant_id\(\).*?\$\$;)');
  if definition is null then raise exception 'TEST0499: no se encontró helper real0453'; end if;
  execute definition;
  source:=pg_read_file('/sb/migrations/0200_rbac_disabled_enforcement.sql');
  definition:=substring(source from '(?s)(create or replace function public\.current_studio_role\(\).*?\$\$;)');
  if definition is null then raise exception 'TEST0499: no se encontró rol real0200'; end if;
  execute definition;
end;
$identity$;
-- Composición vigente: fuentes REALES0357/0493 completas, sin sustituir
-- permisos ni el nonce. Estos dos pins proceden de0210 y son requisito del
-- preflight0493; no cargamos el test0493 (su guard exige una base vacía).
\ir ../migrations/0357_role_module_overrides.sql
alter function public.journal_entries_validate_closing() set search_path = public;
alter function public.journal_lines_validate_closing() set search_path = public;
\ir ../migrations/0493_cierre_contable_superclave.sql
\ir ../migrations/0467_cobro_factura_atomico.sql
\ir ../migrations/0468_pago_proveedor_atomico.sql
-- Las tablas se añadieron después del bootstrap0421: reaplicar0230 idempotente
-- y0470 REAL conserva el límite actual INSERT/UPDATE accounting/admin.
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
-- Privilegios estándar del bootstrap Supabase para las cuatro tablas añadidas
-- después de0421. No se amplía authenticated;0470 y sus postflights son reales.
grant select,insert,update,delete on public.payment_receipts,public.suppliers,public.supplier_bills,public.supplier_payments to service_role;
\ir ../migrations/0470_rls_escritura_cobros_proveedores.sql

-- Esqueleto de Warehouse/OV: tipos numeric y relaciones relevantes reales;
-- no finge gates app.0128 completa agrega su hardening, firmas y ACL.
create table public.sales_orders(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,sales_order_code text not null,
  client_markbox text,client_name text,total_usd numeric(14,2),status text not null default 'confirmada',service text not null default 'consolidado',deleted_at timestamptz);
alter table public.invoices add column sales_order_id uuid;
create table public.prealertas(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,sales_order_id uuid references public.sales_orders(id),
  boxes int not null default 0,invoice_id uuid references public.invoices(id),invoiced_at timestamptz,deleted_at timestamptz);
create table public.warehouse_receipts_cn(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,receipt_code text not null,
  client_markbox text,client_name text,is_orphan boolean not null default false,total_cbm numeric(12,3),total_weight_kg numeric(12,2),
  prealerta_id uuid references public.prealertas(id),sales_order_id uuid references public.sales_orders(id),deleted_at timestamptz);
\ir ../migrations/0128_sales_order_invoicing_hardening.sql

create schema c1_fixture;
create sequence c1_fixture.assertions;
create function c1_fixture.id(label text) returns uuid language sql immutable as $$select md5('0499-synthetic-'||label)::uuid$$;
create function c1_fixture.assert_true(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'TEST0499: %',label; end if; perform nextval('c1_fixture.assertions'); end;
$$;
create function c1_fixture.actor(label text,statement text,api_role text default 'authenticated') returns jsonb language plpgsql as $$
declare result jsonb;
begin
 perform set_config('request.jwt.claim.sub',pg_temp.fixture_id(label)::text,true);
 execute format('set local role %I',api_role); execute statement into result; reset role; return result;
exception when others then reset role; raise;
end;
$$;
create function c1_fixture.state() returns jsonb language sql as $$
select jsonb_build_object('reports',(select jsonb_agg(to_jsonb(t) order by id) from public.payment_reports t),
 'commands',(select jsonb_agg(to_jsonb(t) order by request_id) from payment_private.report_commands t),
 'invoices',(select jsonb_agg(to_jsonb(t) order by id) from public.invoices t),
 'audit',(select jsonb_agg(to_jsonb(t) order by id) from public.entity_audit_log t),
 'receipts',(select jsonb_agg(to_jsonb(t) order by id) from public.payment_receipts t),
 'payments',(select jsonb_agg(to_jsonb(t) order by id) from public.supplier_payments t),
 'bills',(select jsonb_agg(to_jsonb(t) order by id) from public.supplier_bills t),
 'expenses',(select jsonb_agg(to_jsonb(t) order by id) from public.expenses t),
 'journals',(select jsonb_agg(to_jsonb(t) order by id) from public.journal_entries t),
 'objects',(select jsonb_agg(to_jsonb(t) order by id) from storage.objects t),
 'journalLines',(select jsonb_agg(to_jsonb(t) order by id) from public.journal_lines t),
 'closingExceptions',(select jsonb_agg(to_jsonb(t) order by id) from public.accounting_closing_exceptions t),
 'closingEvents',(select jsonb_agg(to_jsonb(t) order by id) from public.accounting_closing_events t))
$$;
create function c1_fixture.denied(label text,actor text,statement text,expected_message text,expected_state text default '22023',api_role text default 'authenticated') returns void language plpgsql as $$
declare before_state jsonb:=c1_fixture.state(); denied boolean:=false; code text; message text;
begin
 begin perform c1_fixture.actor(actor,statement,api_role);
 exception when others then get stacked diagnostics code=returned_sqlstate,message=message_text;
  if code<>expected_state or (expected_message is not null and message<>expected_message) then
   raise exception 'TEST0499: % esperaba % %, obtuvo % %',label,expected_state,expected_message,code,message; end if;
  denied:=true;
 end;
 perform c1_fixture.assert_true(denied,label||' rechazado');
 perform c1_fixture.assert_true(c1_fixture.state()=before_state,label||' sin efectos');
end;
$$;

insert into public.accounts(id,tenant_id,code,name,type) values(c1_fixture.id('cash'),pg_temp.fixture_id('tenant-A'),'1.1.1.1','Banco sintético','A'),
 (c1_fixture.id('expense-account'),pg_temp.fixture_id('tenant-A'),'6.1','Gasto sintético','G');
insert into public.suppliers(id,tenant_id,supplier_code,name) values(c1_fixture.id('supplier'),pg_temp.fixture_id('tenant-A'),'PRV-C1','Proveedor sintético');
insert into public.supplier_bills(id,tenant_id,bill_code,supplier_id,supplier_name,expense_account_id,total_amount,due_date)
values(c1_fixture.id('bill'),pg_temp.fixture_id('tenant-A'),'CXP-C1',c1_fixture.id('supplier'),'Proveedor sintético',c1_fixture.id('expense-account'),1000,'2026-12-31');

-- Guardar catálogo/filas antes de cargar0499 REAL, sin instrumentar su archivo.
create temporary table c1_before_functions as select oid,proowner,proacl,prosecdef,proconfig,prorettype,proargtypes,proargnames,provolatile,
 pg_get_functiondef(oid) definition from pg_proc where oid in('public.register_collection_receipt(uuid,numeric,uuid,text,date,text,text,text,text,text,boolean)'::regprocedure,
 'public.register_supplier_payment_order(uuid,numeric,uuid,text,date,text,text)'::regprocedure,'public.void_expense_governed(uuid,text,text)'::regprocedure,
 'payment_private.run_report_command(uuid,uuid,text,jsonb)'::regprocedure,'public.sales_order_claim_and_invoice(uuid,uuid)'::regprocedure);
create temporary table c1_before_policies as select to_jsonb(p) value from pg_policies p;
create temporary table c1_before_closing_functions as select oid,proacl,proowner,proconfig,md5(prosrc) body_md5
 from pg_proc where oid in('public.journal_entries_validate_closing()'::regprocedure,
 'public.journal_lines_validate_closing()'::regprocedure,'public.excepcion_al_cierre_vigente(uuid)'::regprocedure);
create temporary table c1_before_triggers as select to_jsonb(t) value from pg_trigger t where not tgisinternal;
create temporary table c1_before_state as select c1_fixture.state() value;
\if :apply_fix
\ir ../migrations/0499_fechas_caracas_operaciones.sql
\endif
select c1_fixture.assert_true((select c1_fixture.state()=value from c1_before_state),'DDL no toca filas');
select c1_fixture.assert_true(not exists(select 1 from c1_before_functions b left join pg_proc p on p.oid=b.oid where p.oid is null
 or (p.proowner,p.proacl,p.prosecdef,p.proconfig,p.prorettype,p.proargtypes,p.proargnames,p.provolatile)
 is distinct from(b.proowner,b.proacl,b.prosecdef,b.proconfig,b.prorettype,b.proargtypes,b.proargnames,b.provolatile)),'OID owner ACL firma idénticos');
select c1_fixture.assert_true(not exists((select value from c1_before_policies except select to_jsonb(p) from pg_policies p)
 union all(select to_jsonb(p) from pg_policies p except select value from c1_before_policies)),'policies idénticas');
select c1_fixture.assert_true(not exists((select value from c1_before_triggers except select to_jsonb(t) from pg_trigger t where not tgisinternal)
 union all(select to_jsonb(t) from pg_trigger t where not tgisinternal except select value from c1_before_triggers)),'triggers idénticos');
select c1_fixture.assert_true(not exists(select 1 from c1_before_closing_functions b left join pg_proc p on p.oid=b.oid
 where p.oid is null or (p.proacl,p.proowner,p.proconfig,md5(p.prosrc)) is distinct from(b.proacl,b.proowner,b.proconfig,b.body_md5)),
 '0493 conserva hashes ACL owner config de ambos triggers y excepción después0499');

-- Captura durable de fuentes REALES antes de instrumentar exclusivamente reloj.
create table c1_fixture.real_definitions as select oid::regprocedure::text signature,pg_get_functiondef(oid) definition from c1_before_functions;
create table c1_fixture.real_defaults as select c.relname,a.attname,pg_get_expr(d.adbin,d.adrelid) expression from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
 join pg_class c on c.oid=a.attrelid where (c.relname,a.attname) in(('journal_entries','entry_date'),('payment_receipts','received_at'),('supplier_bills','issue_date'),('supplier_payments','paid_at'));
\if :fixture_only
commit;
\else

-- Reloj exclusivo de fixture. No permiso productivo ni un parámetro nuevo en RPC.
create sequence c1_fixture.clock_reads;
create function c1_fixture.clock() returns timestamptz language plpgsql as $$
declare n bigint:=nextval('c1_fixture.clock_reads');
begin
 if current_setting('c1.clock_sequence',true)='on' and n>1 then return '2026-10-21T04:00:00Z'::timestamptz; end if;
 return coalesce(nullif(current_setting('c1.instant',true),''),'2026-10-21T02:30:00Z')::timestamptz;
end;
$$;
grant usage on schema c1_fixture to authenticated,service_role;
grant usage,select on sequence c1_fixture.clock_reads to authenticated,service_role;
grant execute on function c1_fixture.clock() to authenticated,service_role;
create function c1_fixture.instrument_clock() returns void language plpgsql as $$
declare r record; original text; changed text; count_hits int;
begin
 for r in select * from c1_fixture.real_definitions loop
  original:=r.definition; changed:=original;
  if position('America/Caracas' in original)>0 and r.signature not like '%void_expense%' then
   count_hits:=(length(original)-length(replace(original,'pg_catalog.clock_timestamp() at time zone ''America/Caracas''','')))/length('pg_catalog.clock_timestamp() at time zone ''America/Caracas''');
   if count_hits<>1 then raise exception 'TEST0499: deriva de ancla de reloj %',r.signature; end if;
   changed:=replace(original,'pg_catalog.clock_timestamp() at time zone ''America/Caracas''','c1_fixture.clock() at time zone ''America/Caracas''');
  elsif r.signature like '%run_report_command%' then
   if (length(original)-length(replace(original,'pg_catalog.clock_timestamp() at time zone ''UTC''','')))/length('pg_catalog.clock_timestamp() at time zone ''UTC''')<>1 then raise exception 'TEST0499: deriva reloj previo Portal'; end if;
   changed:=replace(original,'pg_catalog.clock_timestamp() at time zone ''UTC''','c1_fixture.clock() at time zone ''UTC''');
  elsif r.signature not like '%void_expense%' then
   count_hits:=(length(original)-length(replace(original,'current_date','')))/length('current_date');
   if count_hits<>(case when r.signature like '%sales_order%' then 2 else 1 end) then raise exception 'TEST0499: deriva current_date %',r.signature; end if;
   changed:=replace(original,'current_date','(c1_fixture.clock() at time zone current_setting(''TimeZone''))::date');
  end if;
  execute changed;
 end loop;
 for r in select * from c1_fixture.real_defaults loop
  if r.expression='CURRENT_DATE' then changed:='(c1_fixture.clock() at time zone current_setting(''TimeZone''))::date';
  elsif r.expression in('(statement_timestamp() AT TIME ZONE ''America/Caracas''::text)::date','((statement_timestamp() AT TIME ZONE ''America/Caracas''::text))::date') then changed:='(c1_fixture.clock() at time zone ''America/Caracas'')::date';
  else raise exception 'TEST0499: deriva default %.%',r.relname,r.attname; end if;
  execute format('alter table public.%I alter column %I set default %s',r.relname,r.attname,changed);
 end loop;
end;
$$;
select c1_fixture.instrument_clock();
set local timezone='UTC';
set local c1.instant='2026-10-21T02:30:00Z';

-- Día de Caracas en defaults: el ROJO anterior da21. Auditoría sigue timestamptz.
\if :run_defaults
do $defaults$
declare d date; t text; n int:=0;
begin
 foreach t in array array['UTC','America/Caracas','Asia/Shanghai'] loop
  perform set_config('TimeZone',t,true); n:=n+1;
  insert into public.journal_entries(tenant_id,entry_code) values(pg_temp.fixture_id('tenant-A'),'C1-DEFAULT-'||n) returning entry_date into d;
  perform c1_fixture.assert_true(d='2026-10-20','default journal Caracas independiente de sesión');
  insert into public.payment_receipts(tenant_id,receipt_code,amount,cash_account_id,application_status)
   values(pg_temp.fixture_id('tenant-A'),'C1-DEFAULT-'||n,10.25,c1_fixture.id('cash'),'recibido_sin_ref') returning received_at into d;
  perform c1_fixture.assert_true(d='2026-10-20','default receipt Caracas independiente de sesión');
  insert into public.supplier_bills(tenant_id,bill_code,supplier_id,supplier_name,expense_account_id,total_amount,due_date)
   values(pg_temp.fixture_id('tenant-A'),'C1-DEFAULT-'||n,c1_fixture.id('supplier'),'Sintético',c1_fixture.id('expense-account'),10.25,'2026-11-01') returning issue_date into d;
  perform c1_fixture.assert_true(d='2026-10-20','default bill Caracas independiente de sesión');
  insert into public.supplier_payments(tenant_id,payment_code,bill_id,supplier_id,supplier_name,amount,cash_account_id)
   values(pg_temp.fixture_id('tenant-A'),'C1-DEFAULT-'||n,c1_fixture.id('bill'),c1_fixture.id('supplier'),'Sintético',10.25,c1_fixture.id('cash')) returning paid_at into d;
  perform c1_fixture.assert_true(d='2026-10-20','default payment Caracas independiente de sesión');
 end loop;
end;
$defaults$;
do $edges$
declare r record; d date; n int:=0;
begin
 for r in select * from(values
 ('2026-10-21T03:59:59.999Z','2026-10-20'),('2026-10-21T04:00:00Z','2026-10-21'),
 ('2027-01-01T02:30:00Z','2026-12-31'),('2024-03-01T03:30:00Z','2024-02-29'),
 ('2010-01-01T04:15:00Z','2009-12-31'))v(instant,day) loop
  n:=n+1; perform set_config('c1.instant',r.instant,true);
  insert into public.journal_entries(tenant_id,entry_code) values(pg_temp.fixture_id('tenant-A'),'C1-EDGE-'||n) returning entry_date into d;
  perform c1_fixture.assert_true(d=r.day::date,'default bordes mes año bisiesto historia IANA');
 end loop;
end;
$edges$;
\endif
set local timezone='UTC';
set local c1.instant='2026-10-21T02:30:00Z';
\if :run_operations
do $operations$
declare r jsonb; d date; before_paid numeric; a record;
begin
 perform set_config('c1.clock_sequence','on',true); perform setval('c1_fixture.clock_reads',1,false);
 select paid_amount into before_paid from public.invoices where id=pg_temp.fixture_id('invoice-A');
 r:=c1_fixture.actor('accounting-A',format('select public.register_collection_receipt(%L,10.25,%L,''transferencia'',null,null,null,''cliente'',null,null,false)',pg_temp.fixture_id('invoice-A'),c1_fixture.id('cash')));
 select received_at into d from public.payment_receipts where id=(r->>'receipt_id')::uuid;
 perform c1_fixture.assert_true(d='2026-10-20','cobro null captura Caracas una vez');
 perform c1_fixture.assert_true((select last_value from c1_fixture.clock_reads)=1,'cobro un reloj de negocio');
 perform c1_fixture.assert_true((r->>'amount')::numeric=10.25 and (r->>'paid_amount')::numeric=before_paid+10.25,'cobro conserva centavos y saldo');
 perform setval('c1_fixture.clock_reads',1,false);
 r:=c1_fixture.actor('accounting-A',format('select public.register_supplier_payment_order(%L,10.25,%L,''transferencia'',null,null,null)',c1_fixture.id('bill'),c1_fixture.id('cash')));
 select paid_at into d from public.supplier_payments where id=(r->>'payment_id')::uuid;
 perform c1_fixture.assert_true(d='2026-10-20','pago null captura Caracas una vez');
 perform c1_fixture.assert_true((select last_value from c1_fixture.clock_reads)=1,'pago un reloj de negocio');
 perform c1_fixture.assert_true((r->>'amount')::numeric=10.25 and (r->>'paid_amount')::numeric=10.25,'pago conserva centavos y saldo');
 r:=c1_fixture.actor('accounting-A',format('select public.register_collection_receipt(%L,1,%L,''transferencia'',''2024-02-29'',null,null,''cliente'',null,null,false)',pg_temp.fixture_id('invoice-A'),c1_fixture.id('cash')));
 perform c1_fixture.assert_true((select received_at='2024-02-29' from public.payment_receipts where id=(r->>'receipt_id')::uuid),'cobro explícito intacto');
 r:=c1_fixture.actor('accounting-A',format('select public.register_supplier_payment_order(%L,1,%L,''transferencia'',''2024-02-29'',null,null)',c1_fixture.id('bill'),c1_fixture.id('cash')));
 perform c1_fixture.assert_true((select paid_at='2024-02-29' from public.supplier_payments where id=(r->>'payment_id')::uuid),'pago explícito intacto');
 perform set_config('c1.clock_sequence','off',true);
 for a in select * from(values('marketing-A','authenticated'),('accounting-A','service_role'),('accounting-A','anon'))v(actor,role_name) loop
  perform c1_fixture.denied('cobro ACL/rol',a.actor,format('select public.register_collection_receipt(%L,1,%L,''transferencia'',null,null,null,''cliente'',null,null,false)',pg_temp.fixture_id('invoice-A'),c1_fixture.id('cash')),null,'42501',a.role_name);
  perform c1_fixture.denied('pago ACL/rol',a.actor,format('select public.register_supplier_payment_order(%L,1,%L,''transferencia'',null,null,null)',c1_fixture.id('bill'),c1_fixture.id('cash')),null,'42501',a.role_name);
 end loop;
 perform c1_fixture.denied('cobro tenant ajeno','accounting-B',format('select public.register_collection_receipt(%L,1,%L,''transferencia'',null,null,null,''cliente'',null,null,false)',pg_temp.fixture_id('invoice-A'),c1_fixture.id('cash')),'PAYMENT_INVOICE_NOT_FOUND','P0002');
 perform c1_fixture.denied('pago tenant ajeno','accounting-B',format('select public.register_supplier_payment_order(%L,1,%L,''transferencia'',null,null,null)',c1_fixture.id('bill'),c1_fixture.id('cash')),'PAYMENT_BILL_NOT_FOUND','P0002');
 -- Helper0453 REAL: dos membresías activas no eligen el primer tenant.
 insert into public.user_tenants values(pg_temp.fixture_id('accounting-A'),pg_temp.fixture_id('tenant-B'),'accounting',null);
 perform c1_fixture.denied('cobro tenant ambiguo','accounting-A',format('select public.register_collection_receipt(%L,1,%L,''transferencia'',null,null,null,''cliente'',null,null,false)',pg_temp.fixture_id('invoice-A'),c1_fixture.id('cash')),'PAYMENT_FORBIDDEN','42501');
 perform c1_fixture.denied('pago tenant ambiguo','accounting-A',format('select public.register_supplier_payment_order(%L,1,%L,''transferencia'',null,null,null)',c1_fixture.id('bill'),c1_fixture.id('cash')),'PAYMENT_FORBIDDEN','42501');
 delete from public.user_tenants where user_id=pg_temp.fixture_id('accounting-A') and tenant_id=pg_temp.fixture_id('tenant-B');
end;
$operations$;
\endif
\if :run_auto_invoice
do $auto_invoice$
declare r jsonb; d date; due date;
begin
 insert into public.sales_orders(id,tenant_id,sales_order_code,client_markbox,client_name,total_usd) values(c1_fixture.id('order'),pg_temp.fixture_id('tenant-A'),'OV-C1','DUP','Sintético',10.25);
 insert into public.prealertas(id,tenant_id,sales_order_id,boxes) values(c1_fixture.id('box'),pg_temp.fixture_id('tenant-A'),c1_fixture.id('order'),1);
 insert into public.warehouse_receipts_cn(id,tenant_id,receipt_code,client_markbox,total_cbm,total_weight_kg,prealerta_id)
 values(c1_fixture.id('warehouse'),pg_temp.fixture_id('tenant-A'),'WR-C1','DUP',1,10,c1_fixture.id('box'));
 perform set_config('c1.clock_sequence','on',true); perform setval('c1_fixture.clock_reads',1,false);
 r:=c1_fixture.actor('accounting-A',format('select public.sales_order_claim_and_invoice(%L,%L)',pg_temp.fixture_id('tenant-A'),c1_fixture.id('warehouse')),'service_role');
 select issued_at,due_date into d,due from public.invoices where id=(r->>'invoice_id')::uuid;
 perform c1_fixture.assert_true(r->>'outcome'='invoiced' and d='2026-10-20' and r->>'issued_at'=d::text and due=d+30,'0128 retorna fecha persistida misma ancla y vencimiento');
 perform c1_fixture.assert_true((select last_value from c1_fixture.clock_reads)=1,'0128 captura un reloj antes de locks');
 perform c1_fixture.assert_true((r->>'total_amount')::numeric=10.25 and (r->>'base_amount')::numeric+(r->>'iva_amount')::numeric=10.25,'0128 importes exactos intactos');
 r:=c1_fixture.actor('accounting-A',format('select public.sales_order_claim_and_invoice(%L,%L)',pg_temp.fixture_id('tenant-A'),c1_fixture.id('warehouse')),'service_role');
 perform c1_fixture.assert_true(r->>'outcome'='already_invoiced' and not(r?'issued_at'),'0128 replay legado sin ampliar resultado');
 perform c1_fixture.denied('0128 no authenticated','accounting-A',format('select public.sales_order_claim_and_invoice(%L,%L)',pg_temp.fixture_id('tenant-A'),c1_fixture.id('warehouse')),null,'42501');
 perform set_config('c1.clock_sequence','off',true);
end;
$auto_invoice$;
\endif
\if :run_expenses
do $expense_history$
declare r jsonb;
begin
 insert into public.expenses(id,tenant_id,user_id,expense_code,amount,category,occurred_at) values
 (c1_fixture.id('expense-closed'),pg_temp.fixture_id('tenant-A'),pg_temp.fixture_id('accounting-A'),'EXP-C1-CLOSED',10.25,'otro','2026-10-21T02:30Z'),
 (c1_fixture.id('expense-live'),pg_temp.fixture_id('tenant-A'),pg_temp.fixture_id('accounting-A'),'EXP-C1-LIVE',10.25,'otro','2026-10-21T05:00Z'),
 (c1_fixture.id('expense-open'),pg_temp.fixture_id('tenant-A'),pg_temp.fixture_id('accounting-A'),'EXP-C1-OPEN',10.25,'otro','2026-10-21T05:00Z');
 insert into public.journal_entries(id,tenant_id,entry_code,expense_id,entry_date,status,source) values
 (c1_fixture.id('journal-live'),pg_temp.fixture_id('tenant-A'),'C1-HISTORY',c1_fixture.id('expense-live'),'2026-10-20','asentado','expense');
 insert into public.accounting_settings(tenant_id,closing_date) values(pg_temp.fixture_id('tenant-A'),'2026-10-20');
 perform c1_fixture.denied('origen Caracas cerrado sin asiento','accounting-A',format('select to_jsonb(public.void_expense_governed(%L,''Corrección sintética'',''c1-closed''))',c1_fixture.id('expense-closed')),'expenses: período contable cerrado','23514');
 perform c1_fixture.denied('asiento histórico cerrado aunque origen abierto','accounting-A',format('select to_jsonb(public.void_expense_governed(%L,''Corrección sintética'',''c1-live''))',c1_fixture.id('expense-live')),'expenses: período contable cerrado','23514');
 r:=c1_fixture.actor('accounting-A',format('select to_jsonb(public.void_expense_governed(%L,''Corrección sintética'',''c1-open''))',c1_fixture.id('expense-open')));
 perform c1_fixture.assert_true(r='"voided"'::jsonb,'gasto abierto conserva anulación');
 perform c1_fixture.assert_true((select occurred_at='2026-10-21T05:00Z'::timestamptz and deleted_at is not null from public.expenses where id=c1_fixture.id('expense-open')),'gasto conserva instante original');
 perform c1_fixture.assert_true((select count(*)=1 from public.entity_audit_log where entity_type='expense' and entity_id=c1_fixture.id('expense-open') and event_type='expense_voided'),'auditoría gasto real');
 update public.accounting_settings set closing_date=null;
end;
$expense_history$;
\endif
\if :run_closing
do $current_closing$
declare r jsonb; current_nonce text; before_state jsonb; entry_closed uuid:=c1_fixture.id('closing-closed'); entry_open uuid:=c1_fixture.id('closing-open');
begin
 -- Datos sintéticos antes de cerrar; nada se refecha después para acomodar C1.
 insert into public.expenses(id,tenant_id,user_id,expense_code,amount,category,occurred_at)
 values(c1_fixture.id('expense-governed'),pg_temp.fixture_id('tenant-A'),pg_temp.fixture_id('accounting-A'),'EXP-C1-GOV',10.25,'otro','2026-10-21T05:00Z');
 insert into public.journal_entries(id,tenant_id,entry_code,entry_date,status,source,expense_id) values
 (entry_closed,pg_temp.fixture_id('tenant-A'),'C1-493-CLOSED','2026-10-20','borrador','expense',c1_fixture.id('expense-governed')),
 (entry_open,pg_temp.fixture_id('tenant-A'),'C1-493-OPEN','2026-10-21','borrador','manual',null);
 insert into public.journal_lines(id,entry_id,account_id,debit,credit) values
 (c1_fixture.id('closing-line'),entry_closed,c1_fixture.id('cash'),10.25,0),
 (c1_fixture.id('closing-credit'),entry_closed,c1_fixture.id('expense-account'),0,10.25);
 insert into public.accounting_settings(tenant_id,closing_date) values(pg_temp.fixture_id('tenant-A'),'2026-10-20')
 on conflict(tenant_id) do update set closing_date=excluded.closing_date;
 perform c1_fixture.denied('0493 OLD cerrado NEW abierto','accounting-A',format('update public.journal_entries set entry_date=''2026-10-21'' where id=%L returning to_jsonb(id)',entry_closed),
 'Período contable cerrado: no se puede modificar un asiento en período cerrado (cierre: 2026-10-20).','23514');
 perform c1_fixture.denied('0493 OLD abierto NEW cerrado','accounting-A',format('update public.journal_entries set entry_date=''2026-10-20'' where id=%L returning to_jsonb(id)',entry_open),
 'Período contable cerrado: no se puede modificar un asiento en período cerrado (cierre: 2026-10-20).','23514');
 perform c1_fixture.denied('0493 DELETE cerrado','accounting-A',format('delete from public.journal_entries where id=%L returning to_jsonb(id)',entry_closed),
 'Período contable cerrado: no se puede borrar un asiento en período cerrado (cierre: 2026-10-20).','23514');
 perform c1_fixture.denied('0493 línea no se traslada a abierto','accounting-A',format('update public.journal_lines set entry_id=%L where id=%L returning to_jsonb(id)',entry_open,c1_fixture.id('closing-line')),
 'Una línea no cambia de asiento: bórrala y créala en el otro.','23514');
 perform c1_fixture.denied('0493 línea conserva asiento cerrado y no cambia importe','accounting-A',format('update public.journal_lines set debit=20.50,line_memo=''NO'' where id=%L returning to_jsonb(id)',c1_fixture.id('closing-line')),
 'Período contable cerrado: no se pueden modificar las líneas de un asiento cerrado.','23514');
 r:=c1_fixture.actor('accounting-A',format('update public.journal_entries set memo=''Abierto conservado'' where id=%L returning to_jsonb(memo)',entry_open));
 perform c1_fixture.assert_true(r='"Abierto conservado"'::jsonb,'0493 permite abierto');
 perform set_config('dtd.excepcion_cierre','nonce-inventado',true);
 perform c1_fixture.denied('0493 GUC inventado','accounting-A',format('update public.journal_entries set memo=''NO'' where id=%L returning to_jsonb(id)',entry_closed),
 'Período contable cerrado: no se puede modificar un asiento en período cerrado (cierre: 2026-10-20).','23514');
 perform set_config('dtd.excepcion_cierre','',true);
 before_state:=c1_fixture.state();
 r:=c1_fixture.actor('accounting-A',format('select public.asentar_asiento_en_cierre(%L,null,''Intento sin superclave'')',entry_closed));
 perform c1_fixture.assert_true(r=jsonb_build_object('ok',false,'motivo','sin_superclave'),'0493 modo default sin clave deniega');
 perform c1_fixture.assert_true(c1_fixture.state()=before_state,'0493 sin clave no cambia asiento ni crea excepción');
 -- Modo advertencia autorizado por admin, excepción por RPC real accounting;
 -- no stub de autorización ni inserción manual que se presente como permiso.
 perform c1_fixture.actor('admin-A',format('update public.accounting_settings set closing_mode=''advertencia'' where tenant_id=%L returning to_jsonb(tenant_id)',pg_temp.fixture_id('tenant-A')));
 r:=c1_fixture.actor('accounting-A',format('select public.asentar_asiento_en_cierre(%L,null,''Composición C1 verificada'')',entry_closed));
 perform c1_fixture.assert_true(r->>'ok'='true','0493 excepción gobernada asienta');
 perform c1_fixture.assert_true(exists(select 1 from public.accounting_closing_exceptions where entry_id=entry_closed and entry_date='2026-10-20'
  and closing_date='2026-10-20' and operation='asentar' and authorized_by='advertencia' and reason='Composición C1 verificada'
  and user_id=pg_temp.fixture_id('accounting-A') and txid=txid_current() and length(nonce)=32 and amount_before=0 and amount_after=10.25),
 '0493 fila nonce txid actor motivo importes reales');
 perform c1_fixture.assert_true(coalesce(current_setting('dtd.excepcion_cierre',true),'')='','0493 limpia nonce después RPC');
 select nonce into current_nonce from public.accounting_closing_exceptions where entry_id=entry_closed;
 perform set_config('dtd.excepcion_cierre',current_nonce,true);
 perform c1_fixture.denied('0493 nonce de otro asiento','accounting-A',format('update public.journal_entries set entry_date=''2026-10-20'' where id=%L returning to_jsonb(id)',entry_open),
 'Período contable cerrado: no se puede modificar un asiento en período cerrado (cierre: 2026-10-20).','23514');
 -- El nonce real de ESTA transacción pasa el trigger para su asiento; la
 -- guarda específica C1 de void_expense se mantiene incluso en ese contexto.
 perform c1_fixture.assert_true(public.excepcion_al_cierre_vigente(entry_closed),'0493 nonce real válido para su asiento');
 perform c1_fixture.denied('0499 void mantiene bloqueo con nonce válido','accounting-A',format('select to_jsonb(public.void_expense_governed(%L,''No anular historia'',''c1-valid-nonce''))',c1_fixture.id('expense-governed')),
 'expenses: período contable cerrado','23514');
 -- Simular únicamente antigüedad de una fila autorizada prueba el contrato de
 -- txid, sin declarar que una API pueda escribir esta tabla privada.
 update public.accounting_closing_exceptions set txid=txid_current()-1 where entry_id=entry_closed;
 perform c1_fixture.denied('0493 nonce de transacción previa','accounting-A',format('update public.journal_entries set memo=''NO'' where id=%L returning to_jsonb(id)',entry_closed),
 'Período contable cerrado: no se puede modificar un asiento en período cerrado (cierre: 2026-10-20).','23514');
 perform set_config('dtd.excepcion_cierre','',true);
 update public.accounting_settings set closing_date=null where tenant_id=pg_temp.fixture_id('tenant-A');
end;
$current_closing$;
\endif
\if :run_portal
\if :run_portal_replay_only
set local c1.replay_only='on';
\else
set local c1.replay_only='off';
\endif
create function c1_fixture.create_sql(request text,report text,paid text,overrides jsonb default '{}'::jsonb) returns text language plpgsql as $$
declare v jsonb:=jsonb_build_object('request',c1_fixture.id(request),'report',c1_fixture.id(report),'code','F-CMD-SHARED','amount',10.25,'method','transferencia','paid',paid,
 'proof',pg_temp.fixture_id('tenant-A')::text||'/'||pg_temp.fixture_id('invoice-A')::text||'/'||c1_fixture.id(report)::text||'/'||c1_fixture.id('object')::text||'.pdf','note','Sintético')||overrides;
begin return format('select public.create_portal_payment_report(%L,%L,%L,%L,%L,%L,%L,%L)',v->>'request',v->>'report',v->>'code',v->>'amount',v->>'method',v->>'paid',v->>'proof',v->>'note'); end;
$$;
do $portal$
declare r jsonb; before_state jsonb; path text; change jsonb; receipts_before jsonb; invoice_before jsonb;
begin
 select jsonb_agg(to_jsonb(t) order by id) into receipts_before from public.payment_receipts t;
 select jsonb_agg(to_jsonb(t) order by id) into invoice_before from public.invoices t;
 path:=pg_temp.fixture_id('tenant-A')::text||'/'||pg_temp.fixture_id('invoice-A')::text||'/'||c1_fixture.id('portal-new')::text||'/'||c1_fixture.id('object')::text||'.pdf';
 insert into storage.objects(bucket_id,name) values('payment-proofs',path);
 if current_setting('c1.replay_only')<>'on' then
  perform c1_fixture.denied('Portal futuro nuevo Caracas aun con objeto presente','portal-A',c1_fixture.create_sql('request-new','portal-new','2026-10-21'),'PAYMENT_INPUT');
  perform c1_fixture.denied('Portal futuro nuevo antes de comprobar Storage','portal-A',c1_fixture.create_sql('request-absent','portal-absent','2026-10-21'),'PAYMENT_INPUT');
 end if;
 -- Fue aceptado día22; luego la fixture vuelve al20 Caracas (21 UTC).
 -- La fecha futura también según UTC descubre el guard previo al replay0464.
 perform set_config('c1.instant','2026-10-22T04:00:00Z',true);
 r:=c1_fixture.actor('portal-A',c1_fixture.create_sql('request-new','portal-new','2026-10-22'));
 perform c1_fixture.assert_true(r->>'replayed'='false','Portal creación día vigente');
 perform set_config('c1.instant','2026-10-21T02:30:00Z',true); before_state:=c1_fixture.state();
 r:=c1_fixture.actor('portal-A',c1_fixture.create_sql('request-new','portal-new','2026-10-22'));
 perform c1_fixture.assert_true(r->>'replayed'='true' and c1_fixture.state()=before_state,'Portal replay futuro idéntico sin efectos');
 -- SQL usa el recibo/hash/path histórico, NO verifica bytes actuales: eso le
 -- corresponde a la action/helper. La ausencia de Storage no autoriza recrearlo.
 delete from storage.objects where bucket_id='payment-proofs' and name=path; before_state:=c1_fixture.state();
 r:=c1_fixture.actor('portal-A',c1_fixture.create_sql('request-new','portal-new','2026-10-22'));
 perform c1_fixture.assert_true(r->>'replayed'='true' and c1_fixture.state()=before_state,'replay SQL histórico antes de Storage');
 for change in select * from unnest(array[
  '{"amount":11}'::jsonb,'{"method":"otro"}'::jsonb,'{"note":"Otra nota"}'::jsonb,'{"paid":"2026-10-20"}'::jsonb,'{"code":"F-LIMIT"}'::jsonb,
  jsonb_build_object('report',c1_fixture.id('other-report')),jsonb_build_object('proof',path||'.png')]) loop
  perform c1_fixture.denied('replay payload/identidad distinto','portal-A',c1_fixture.create_sql('request-new','portal-new','2026-10-22',change),'PAYMENT_REQUEST_CONFLICT','23505');
 end loop;
 perform c1_fixture.denied('replay tenant/actor ajeno','portal-B',c1_fixture.create_sql('request-new','portal-new','2026-10-22'),'PAYMENT_REQUEST_CONFLICT','23505');
 insert into auth.users(id,email) values(pg_temp.fixture_id('portal-A-second'),'second@example.invalid');
 -- Hay un solo principal por cliente: el vínculo se reasigna en fixture,
 -- conservando el constraint real, para probar el actor del recibo histórico.
 update public.client_users set auth_user_id=pg_temp.fixture_id('portal-A-second') where auth_user_id=pg_temp.fixture_id('portal-A');
 perform c1_fixture.denied('replay otro actor del mismo cliente','portal-A-second',c1_fixture.create_sql('request-new','portal-new','2026-10-22'),'PAYMENT_REQUEST_CONFLICT','23505');
 update public.client_users set auth_user_id=pg_temp.fixture_id('portal-A') where auth_user_id=pg_temp.fixture_id('portal-A-second');
 update public.client_users set status='revoked' where auth_user_id=pg_temp.fixture_id('portal-A');
 perform c1_fixture.denied('replay principal revocado','portal-A',c1_fixture.create_sql('request-new','portal-new','2026-10-22'),'PAYMENT_FORBIDDEN','42501');
 update public.client_users set status='active' where auth_user_id=pg_temp.fixture_id('portal-A');
 perform c1_fixture.denied('request nuevo no recupera reporte existente','portal-A',c1_fixture.create_sql('another-request','portal-new','2026-10-22'),'PAYMENT_INPUT');
 perform c1_fixture.denied('verb distinto no recupera recibo','portal-A',format('select public.cancel_portal_payment_report(%L,%L,''F-CMD-SHARED'',''Motivo sintético'')',c1_fixture.id('request-new'),c1_fixture.id('portal-new')),'PAYMENT_REQUEST_CONFLICT','23505');
 perform c1_fixture.assert_true((select jsonb_agg(to_jsonb(t) order by id) from public.payment_receipts t) is not distinct from receipts_before,'reporte no crea/modifica recibos de cobro');
 perform c1_fixture.assert_true((select jsonb_agg(to_jsonb(t) order by id) from public.invoices t) is not distinct from invoice_before,'reporte no cambia saldo ni factura');
end;
$portal$;
\endif
select 'TEST0499 GREEN: '||(select last_value from c1_fixture.assertions)||' aserciones' resultado;
rollback;
\endif
