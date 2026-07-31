\set ON_ERROR_STOP on
begin;
do $$ begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end $$;
create type public.document_entity_type as enum('none','shipment','invoice','supplier_bill','supplier_payment','journal_entry','client','supplier','consolidation','booking');
create function public.get_user_tenant_id() returns uuid language sql stable as $$ select current_setting('test.tenant',true)::uuid $$;
create table public.documents(id uuid primary key,tenant_id uuid,entity_type public.document_entity_type,entity_id uuid,scan_status text,deleted_at timestamptz);
create table public.expenses(id uuid primary key,tenant_id uuid,deleted_at timestamptz);
\ir ../migrations/0314_expenses_document_adapter.sql
do $$ declare
 t uuid='11111111-1111-4111-8111-111111111111'; other uuid='22222222-2222-4222-8222-222222222222';
 e uuid='33333333-3333-4333-8333-333333333333'; d uuid='44444444-4444-4444-8444-444444444444';
begin
 perform set_config('test.tenant',t::text,true);
 insert into public.expenses(id,tenant_id) values(e,t);
 insert into public.documents values(d,t,'expense',e,'clean',null);
 perform public.attach_document_to_expense(e,d);
 if (select receipt_document_id from public.expenses where id=e)<>d then raise exception '0314: adaptador no enlazó'; end if;
 update public.documents set tenant_id=other where id=d;
 begin perform public.attach_document_to_expense(e,d); raise exception '0314: aceptó documento cross-tenant';
 exception when object_not_in_prerequisite_state then null; end;
end $$;
rollback;

