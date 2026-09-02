\set ON_ERROR_STOP on

-- Fixture desechable sin PII real; rollback total.
begin;
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end;
$roles$;
grant usage on schema public to anon, authenticated;
create schema auth;
grant usage on schema auth to authenticated;
create function auth.uid() returns uuid
language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.user_tenants (
  user_id uuid primary key, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.current_studio_role() returns text
language sql stable security definer set search_path = '' as $$
  select ut.role from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create table public.studio_role_module_overrides (
  tenant_id uuid not null, role text not null, module_id text not null,
  can_view boolean not null, primary key (tenant_id, role, module_id)
);
create table public.clients (
  id uuid primary key, tenant_id uuid not null, markbox text not null,
  deleted_at timestamptz
);
create table public.conversations (
  id uuid primary key, tenant_id uuid not null, client_id uuid not null,
  deleted_at timestamptz
);
create table public.invoices (
  id uuid primary key, tenant_id uuid not null, client_markbox text not null,
  currency text not null, total_amount numeric not null, paid_amount numeric,
  status text not null, deleted_at timestamptz
);

insert into public.user_tenants values
  ('aaaaaaaa-4120-0000-0000-000000000001', '10000000-4120-0000-0000-000000000001', 'admin', null),
  ('aaaaaaaa-4120-0000-0000-000000000002', '10000000-4120-0000-0000-000000000001', 'commercial', null),
  ('aaaaaaaa-4120-0000-0000-000000000003', '10000000-4120-0000-0000-000000000001', 'operations', null),
  ('aaaaaaaa-4120-0000-0000-000000000004', '10000000-4120-0000-0000-000000000001', 'support', null),
  ('aaaaaaaa-4120-0000-0000-000000000005', '10000000-4120-0000-0000-000000000001', 'accounting', null),
  ('aaaaaaaa-4120-0000-0000-000000000006', '10000000-4120-0000-0000-000000000001', 'commercial', now()),
  ('bbbbbbbb-4120-0000-0000-000000000001', '20000000-4120-0000-0000-000000000002', 'commercial', null);
insert into public.clients values
  ('61000000-4120-0000-0000-000000000001', '10000000-4120-0000-0000-000000000001', 'DTD-0001', null),
  ('61000000-4120-0000-0000-000000000002', '10000000-4120-0000-0000-000000000001', 'DTD-0002', null),
  ('62000000-4120-0000-0000-000000000001', '20000000-4120-0000-0000-000000000002', 'DTD-9001', null);
insert into public.conversations values
  ('71000000-4120-0000-0000-000000000001', '10000000-4120-0000-0000-000000000001', '61000000-4120-0000-0000-000000000001', null),
  ('71000000-4120-0000-0000-000000000002', '10000000-4120-0000-0000-000000000001', '61000000-4120-0000-0000-000000000002', null),
  ('71000000-4120-0000-0000-000000000003', '10000000-4120-0000-0000-000000000001', '61000000-4120-0000-0000-000000000001', now()),
  ('72000000-4120-0000-0000-000000000001', '20000000-4120-0000-0000-000000000002', '62000000-4120-0000-0000-000000000001', null);
insert into public.invoices values
  ('81000000-4120-0000-0000-000000000001', '10000000-4120-0000-0000-000000000001', 'DTD-0001', 'USD', 100, 30, 'emitida', null),
  ('81000000-4120-0000-0000-000000000002', '10000000-4120-0000-0000-000000000001', 'DTD-0001', 'USD', 50, 80, 'pagada', null),
  ('81000000-4120-0000-0000-000000000003', '10000000-4120-0000-0000-000000000001', 'DTD-0001', 'VES', 1000, 100, 'parcial', null),
  ('81000000-4120-0000-0000-000000000004', '10000000-4120-0000-0000-000000000001', 'DTD-0001', 'VES', 10000, 0, 'anulada', null),
  ('81000000-4120-0000-0000-000000000005', '10000000-4120-0000-0000-000000000001', 'DTD-0001', 'VES', 10000, 0, 'borrador', null),
  ('81000000-4120-0000-0000-000000000006', '10000000-4120-0000-0000-000000000001', 'DTD-0001', 'VES', 10000, 0, 'emitida', now()),
  ('82000000-4120-0000-0000-000000000001', '20000000-4120-0000-0000-000000000002', 'DTD-9001', 'USD', 777, 0, 'emitida', null);

\ir ../migrations/0412_conversation_outstanding_facade.sql

do $shape$
begin
  if pg_catalog.pg_get_function_result(pg_catalog.to_regprocedure(
    'public.conversation_client_outstanding(uuid)'
  )) <> 'TABLE(client_id uuid, balance numeric, currency text)' then
    raise exception 'TEST 0412: la RPC expone más que el contexto mínimo';
  end if;
end;
$shape$;

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4120-0000-0000-000000000002';
do $balance_and_scope$
begin
  if not exists (
    select 1 from public.conversation_client_outstanding('71000000-4120-0000-0000-000000000001')
    where client_id = '61000000-4120-0000-0000-000000000001' and balance = 900 and currency = 'VES'
  ) then
    raise exception 'TEST 0412: saldo/moneda o exclusión de anuladas incorrectos';
  end if;
  if not exists (
    select 1 from public.conversation_client_outstanding('71000000-4120-0000-0000-000000000002')
    where balance = 0 and currency = 'USD'
  ) then
    raise exception 'TEST 0412: cliente sin facturas no devuelve cero real';
  end if;
  if (select count(*) from public.conversation_client_outstanding('72000000-4120-0000-0000-000000000001')) <> 0
     or (select count(*) from public.conversation_client_outstanding('71000000-4120-0000-0000-000000000003')) <> 0 then
    raise exception 'TEST 0412: hilo ajeno o retirado expuso contexto';
  end if;
end;
$balance_and_scope$;

do $denied_roles$
declare v_user uuid; v_blocked boolean;
begin
  foreach v_user in array array[
    'aaaaaaaa-4120-0000-0000-000000000005'::uuid,
    'aaaaaaaa-4120-0000-0000-000000000006'::uuid
  ] loop
    perform pg_catalog.set_config('request.jwt.claim.sub', v_user::text, true);
    v_blocked := false;
    begin
      perform * from public.conversation_client_outstanding('71000000-4120-0000-0000-000000000001');
    exception when insufficient_privilege then v_blocked := true;
    end;
    if not v_blocked then raise exception 'TEST 0412: identidad sin acceso % ejecutó la RPC', v_user; end if;
  end loop;
end;
$denied_roles$;

do $allowed_roles$
declare v_user uuid;
begin
  foreach v_user in array array[
    'aaaaaaaa-4120-0000-0000-000000000001'::uuid,
    'aaaaaaaa-4120-0000-0000-000000000003'::uuid,
    'aaaaaaaa-4120-0000-0000-000000000004'::uuid
  ] loop
    perform pg_catalog.set_config('request.jwt.claim.sub', v_user::text, true);
    if (select count(*) from public.conversation_client_outstanding('71000000-4120-0000-0000-000000000001')) <> 1 then
      raise exception 'TEST 0412: rol permitido % no recibió contexto', v_user;
    end if;
  end loop;
end;
$allowed_roles$;
reset role;

-- Sin VES elegible, la moneda USD demuestra el clamp de sobrepago (70 + 0).
update public.invoices set status = 'anulada' where id = '81000000-4120-0000-0000-000000000003';
insert into public.studio_role_module_overrides values
  ('10000000-4120-0000-0000-000000000001', 'commercial', 'conversaciones', false),
  ('10000000-4120-0000-0000-000000000001', 'accounting', 'conversaciones', true);
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4120-0000-0000-000000000002';
do $revoke$
declare v_blocked boolean := false;
begin
  begin
    perform * from public.conversation_client_outstanding('71000000-4120-0000-0000-000000000001');
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0412: override revoke ignorado'; end if;
end;
$revoke$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4120-0000-0000-000000000005';
do $grant_and_overpayment$
begin
  if not exists (
    select 1 from public.conversation_client_outstanding('71000000-4120-0000-0000-000000000001')
    where balance = 70 and currency = 'USD'
  ) then
    raise exception 'TEST 0412: grant o clamp de sobrepago incorrectos';
  end if;
end;
$grant_and_overpayment$;
set local "request.jwt.claim.sub" = 'bbbbbbbb-4120-0000-0000-000000000001';
do $tenant_b$
begin
  if not exists (
    select 1 from public.conversation_client_outstanding('72000000-4120-0000-0000-000000000001')
    where balance = 777 and currency = 'USD'
  ) then raise exception 'TEST 0412: override del tenant A afectó al B'; end if;
end;
$tenant_b$;
reset role;
rollback;
select pg_catalog.to_regclass('public.invoices') is null as conversation_outstanding_0412_fixture_rolled_back;
