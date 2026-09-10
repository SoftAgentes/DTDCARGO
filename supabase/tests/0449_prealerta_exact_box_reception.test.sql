-- Focused contract against a disposable database. Fixtures contain no customer data.
begin;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema if not exists auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create table tenants(id uuid primary key);
create table user_tenants(user_id uuid,tenant_id uuid,role text,disabled_at timestamptz);
create function get_user_tenant_id() returns uuid language sql stable as $$ select tenant_id from user_tenants where user_id=auth.uid() and disabled_at is null limit 1 $$;
create type warehouse_receipt_status as enum('pendiente_consolidacion');
create type warehouse_receipt_event_type as enum('received','note');
create table operario_pins(id uuid,tenant_id uuid,region text,active boolean,warehouse_id uuid);
create table prealertas(id uuid primary key,tenant_id uuid,code text,client_markbox text,supplier_id uuid,status text,deleted_at timestamptz,boxes integer,received_at timestamptz);
create table suppliers_cn(id uuid, name text);
create table warehouse_receipts_cn(id uuid primary key default gen_random_uuid(),tenant_id uuid,receipt_code text,warehouse_id uuid,client_markbox text,client_name text,supplier_name text,boxes integer,status warehouse_receipt_status,received_at date,created_by_operario_id uuid,prealerta_id uuid,notes text,unique(tenant_id,receipt_code));
create table warehouse_boxes(id uuid primary key default gen_random_uuid(),tenant_id uuid,prealerta_id uuid,receipt_id uuid,status text,code text,markbox text,deleted_at timestamptz,seq integer);
create table warehouse_receipt_events(tenant_id uuid,receipt_id uuid,event_type warehouse_receipt_event_type,description text,occurred_at timestamptz);
create table packing_list_submissions(id uuid default gen_random_uuid(),tenant_id uuid,prealerta_id uuid,total_ctns numeric,is_current boolean,deleted_at timestamptz);
\ir ../migrations/0449_prealerta_exact_box_reception.sql

insert into tenants values ('00000000-0000-0000-0000-000000000001');
insert into auth.users values ('00000000-0000-0000-0000-000000000002');
insert into user_tenants values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','admin',null);
select set_config('test.uid','00000000-0000-0000-0000-000000000002',true);
insert into operario_pins values ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','cn',true,'00000000-0000-0000-0000-000000000004');
insert into prealertas values ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','DTD-0000-1-1','DTD-0000',null,'anunciada',null,3,null);
insert into warehouse_boxes(tenant_id,prealerta_id,status,code,markbox,seq)
select '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000005','esperada','DTD-B-00000'||n,'DTD-0000',n from generate_series(1,3)n;

do $$ declare r jsonb; v integer; begin
  -- Receive box 3, not the first box by sequence.
  r := receive_prealerta_boxes_as_operario('00000000-0000-0000-0000-000000000003','DTD-B-000003',array['DTD-B-000003']);
  if (r->>'received')::int <> 1 or (r->>'remaining')::int <> 2 then raise exception 'Wrong partial totals'; end if;
  if (select status from warehouse_boxes where code='DTD-B-000001') <> 'esperada' then raise exception 'Wrong box adopted'; end if;
  if exists(select 1 from warehouse_receipts_cn where client_name is not null) then raise exception 'Client identity exposed'; end if;
  begin
    perform receive_prealerta_boxes_as_operario('00000000-0000-0000-0000-000000000003','DTD-B-000003',array['DTD-B-000003']);
    raise exception 'Duplicate accepted';
  exception when sqlstate 'P0137' then null; end;
  if (select count(*) from warehouse_receipts_cn) <> 1 then raise exception 'Duplicate receipt'; end if;
  begin
    perform receive_prealerta_boxes_as_operario('00000000-0000-0000-0000-000000000003','DTD-B-000001',array['DTD-B-000001','DTD-B-999999']);
    raise exception 'Unknown box accepted';
  exception when sqlstate 'P0137' then null; end;
  -- Already received boxes prevent packing submissions from changing the physical lot.
  insert into packing_list_submissions(tenant_id,prealerta_id,total_ctns,is_current) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000005',1,true);
  if (select boxes from prealertas) <> 3 then raise exception 'Received lot resized'; end if;
  r := receive_prealerta_boxes_as_operario('00000000-0000-0000-0000-000000000003','DTD-B-000001',array['DTD-B-000001','DTD-B-000002']);
  if (r->>'remaining')::int <> 0 or (select status from prealertas) <> 'recibida' then raise exception 'Lot not completed'; end if;
  v := save_shipping_label_presentation('{"showBrand":true,"language":"zh-es","size":"standard"}',0);
  if v <> 1 then raise exception 'Wrong label version'; end if;
  begin
    perform save_shipping_label_presentation('{"showBrand":true,"language":"zh-es","size":"large"}',0);
    raise exception 'Stale settings accepted';
  exception when serialization_failure then null; end;
  begin
    perform save_shipping_label_presentation('{"showBrand":true,"language":"zh-es","size":"standard","clientName":"bad"}',1);
    raise exception 'Private field accepted';
  exception when invalid_parameter_value then null; end;
  update user_tenants set role='operador';
  begin
    perform save_shipping_label_presentation('{"showBrand":true,"language":"zh-es","size":"large"}',1);
    raise exception 'Non-admin write accepted';
  exception when insufficient_privilege then null; end;
  if has_function_privilege('anon','receive_prealerta_boxes_as_operario(uuid,text,text[])','execute') then raise exception 'Anonymous reception allowed'; end if;
  if has_table_privilege('authenticated','shipping_label_versions','insert,update,delete') then raise exception 'History mutable'; end if;
end $$;
rollback;
