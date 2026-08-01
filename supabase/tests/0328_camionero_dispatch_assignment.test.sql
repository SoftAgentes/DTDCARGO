\set ON_ERROR_STOP on
begin;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create type public.operario_region as enum('cn','ve');
create type public.dispatch_order_status as enum('creada','cargando','lista','en_ruta','entregada','cerrada','cancelada');
create table public.operario_pins(
  id uuid primary key, tenant_id uuid, role text, roles text[], region public.operario_region,
  active boolean, tms_driver_id uuid
);
create table public.dispatch_orders(
  id uuid primary key, tenant_id uuid, driver_id uuid, status public.dispatch_order_status,
  progress_pct int default 0, current_city text, updated_at timestamptz
);
\ir ../migrations/0328_camionero_dispatch_assignment.sql

do $$ declare
  t uuid='11111111-1111-4111-8111-111111111111';
  op uuid='22222222-2222-4222-8222-222222222222';
  sup uuid='33333333-3333-4333-8333-333333333333';
  od uuid='44444444-4444-4444-8444-444444444444';
  driver_a uuid='55555555-5555-4555-8555-555555555555';
  driver_b uuid='66666666-6666-4666-8666-666666666666';
begin
  insert into public.operario_pins values(op,t,'camionero',array['camionero'],'ve',true,driver_a),(sup,t,'supervisor',array['supervisor'],'ve',true,null);
  insert into public.dispatch_orders values(od,t,driver_b,'lista',0,null,now());
  begin
    perform public.camionero_advance_od(op,od,'en_ruta',10,'Valencia');
    raise exception '0328: camionero avanzó OD ajena';
  exception when sqlstate 'P0008' then null; end;
  perform public.camionero_advance_od(sup,od,'en_ruta',10,'Valencia');
  if (select status from public.dispatch_orders where id=od) <> 'en_ruta' then raise exception '0328: supervisor no avanzó'; end if;
end $$;
rollback;
