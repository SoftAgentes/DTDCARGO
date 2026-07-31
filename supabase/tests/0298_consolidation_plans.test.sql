\set ON_ERROR_STOP on

-- Contrato de 0295 (SDD-0184 Fase 3): el plan de carga es versionado, aislado
-- por tenant y fail-closed.
--
-- Lo que se ancla acá:
--   · UNA sola versión vigente por consolidación. Es el invariante que hace que
--     el diff plan ↔ realidad de la Fase 4 tenga sentido: si hay dos vigentes,
--     no se sabe contra cuál comparar.
--   · Un plan NO puede colgar de una consolidación de otro tenant. Las dos FK
--     son independientes, así que el schema solo no alcanza.
--   · RLS prendida y sin acceso para anon: el plan es interno.
--   · El trigger no se puede invocar suelto desde el cliente.
--
-- Fixture PostgreSQL desechable. Toda la prueba termina en ROLLBACK.

begin;

do $roles$
begin
  if to_regclass('public.consolidation_plans') is not null
     or to_regclass('public.consolidations') is not null then
    raise exception 'Fixture 0295 rechazada: los objetos reales ya existen';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$roles$;

grant usage on schema public to anon, authenticated, service_role;
create schema if not exists extensions;
create schema if not exists auth;

-- Stubs mínimos de lo que la migración referencia.
create or replace function extensions.gen_random_uuid() returns uuid
  language sql as $$ select gen_random_uuid() $$;

create table auth.users (id uuid primary key);

create table public.tenants (id uuid primary key);

create table public.consolidations (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade
);

-- El tenant del usuario logueado; la RLS real la usa.
create or replace function public.get_user_tenant_id() returns uuid
  language sql stable as $$ select '11111111-1111-1111-1111-111111111111'::uuid $$;

insert into public.tenants (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into public.consolidations (id, tenant_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222');

\ir ../migrations/0298_consolidation_plans.sql

-- ── Aserciones ───────────────────────────────────────────────

do $t$
declare
  v_n int;
begin
  -- 1. RLS prendida.
  if not exists (
    select 1 from pg_class
    where oid = 'public.consolidation_plans'::regclass and relrowsecurity
  ) then
    raise exception 'TEST 0295: la tabla quedó SIN row level security';
  end if;

  -- 2. anon no tiene NINGÚN privilegio: el plan es interno.
  if has_table_privilege('anon', 'public.consolidation_plans', 'SELECT')
     or has_table_privilege('anon', 'public.consolidation_plans', 'INSERT') then
    raise exception 'TEST 0295: anon puede tocar los planes de carga';
  end if;

  -- 3. El trigger de coherencia de tenant existe y está armado.
  select count(*) into v_n
  from pg_trigger
  where tgrelid = 'public.consolidation_plans'::regclass
    and tgname = 'consolidation_plans_same_tenant'
    and not tgisinternal;
  if v_n <> 1 then
    raise exception 'TEST 0295: falta el trigger de coherencia de tenant';
  end if;

  -- 4. Nadie salvo el motor de la DB puede invocar el trigger suelto.
  if has_function_privilege('anon', 'public.consolidation_plan_same_tenant()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.consolidation_plan_same_tenant()', 'EXECUTE') then
    raise exception 'TEST 0295: el trigger de tenant quedó ejecutable desde el cliente';
  end if;
end
$t$;

-- 5. Una sola versión vigente por consolidación.
insert into public.consolidation_plans
  (tenant_id, consolidation_id, version_no, is_current, container_type,
   cbm_capacity, zone_layout, input, result)
values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
   1, true, '40HC', 68, '{"nx":3,"ny":1,"nz":3}', '[]', '{}');

do $t$
begin
  begin
    insert into public.consolidation_plans
      (tenant_id, consolidation_id, version_no, is_current, container_type,
       cbm_capacity, zone_layout, input, result)
    values
      ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
       2, true, '40HC', 68, '{"nx":3,"ny":1,"nz":3}', '[]', '{}');
    raise exception 'TEST 0295: entraron DOS versiones vigentes en la misma consolidación';
  exception
    when unique_violation then null;  -- esperado
  end;
end
$t$;

-- 6. Con la anterior apagada, la versión nueva SÍ entra (el flujo real).
update public.consolidation_plans
   set is_current = false
 where consolidation_id = 'aaaaaaaa-0000-0000-0000-000000000001';

insert into public.consolidation_plans
  (tenant_id, consolidation_id, version_no, is_current, container_type,
   cbm_capacity, zone_layout, input, result)
values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
   2, true, '40HC', 68, '{"nx":3,"ny":1,"nz":3}', '[]', '{}');

do $t$
declare v_n int;
begin
  select count(*) into v_n
  from public.consolidation_plans
  where consolidation_id = 'aaaaaaaa-0000-0000-0000-000000000001' and is_current;
  if v_n <> 1 then
    raise exception 'TEST 0295: quedaron % versiones vigentes tras el flip', v_n;
  end if;

  select count(*) into v_n
  from public.consolidation_plans
  where consolidation_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v_n <> 2 then
    raise exception 'TEST 0295: el versionado pisó la versión anterior en vez de conservarla';
  end if;
end
$t$;

-- 7. Un plan NO puede colgar de una consolidación de otro tenant.
do $t$
begin
  begin
    insert into public.consolidation_plans
      (tenant_id, consolidation_id, version_no, is_current, container_type,
       cbm_capacity, zone_layout, input, result)
    values
      ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000002',
       1, true, '40HC', 68, '{"nx":3,"ny":1,"nz":3}', '[]', '{}');
    raise exception 'TEST 0295: se coló un plan cruzado entre tenants';
  exception
    when check_violation then null;  -- lo levanta el trigger con errcode 23514
  end;
end
$t$;

rollback;

select
  to_regclass('public.consolidation_plans') is null
  and to_regprocedure('public.consolidation_plan_same_tenant()') is null
  as consolidation_plans_fixture_rolled_back;
