\set ON_ERROR_STOP on
begin;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema extensions;
create extension pgcrypto with schema extensions;
create type public.operario_region as enum ('cn','ve');
create table public.tenants(id uuid primary key);
create table public.operario_pins(
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  warehouse_id uuid, display_name text not null, display_name_cn text,
  pin_hash text not null, role text not null, roles text[] not null default '{}',
  region public.operario_region not null, active boolean not null default true,
  last_login_at timestamptz, tms_driver_id uuid
);
\ir ../migrations/0325_operario_pin_login_hardening.sql

do $$ declare
  t1 uuid='11111111-1111-4111-8111-111111111111';
  t2 uuid='22222222-2222-4222-8222-222222222222';
  n integer;
  k text=repeat('a',64);
begin
  insert into public.tenants values(t1),(t2);
  insert into public.operario_pins(id,tenant_id,display_name,pin_hash,role,roles,region)
  values
    ('33333333-3333-4333-8333-333333333333',t1,'CN',extensions.crypt('1234',extensions.gen_salt('bf')),'operario',array['operario'],'cn'),
    ('44444444-4444-4444-8444-444444444444',t2,'VE',extensions.crypt('1234',extensions.gen_salt('bf')),'camionero',array['camionero'],'ve');

  select count(*) into n from public.verify_operario_pin('1234',t1,'cn',k);
  if n <> 1 then raise exception '0325: no autenticó el tenant/región correctos'; end if;
  select count(*) into n from public.verify_operario_pin('1234',t1,'ve',repeat('b',64));
  if n <> 0 then raise exception '0325: aceptó PIN cross-region'; end if;

  insert into public.operario_pin_attempts(tenant_id,region,attempt_key,succeeded)
  select t1,'cn',repeat('c',64),false from generate_series(1,10);
  select count(*) into n from public.verify_operario_pin('1234',t1,'cn',repeat('c',64));
  if n <> 0 then raise exception '0325: throttle no bloqueó'; end if;
  if has_function_privilege('anon','public.verify_operario_pin(text,uuid,public.operario_region,text)','EXECUTE') then
    raise exception '0325: anon conserva EXECUTE';
  end if;
end $$;
rollback;
