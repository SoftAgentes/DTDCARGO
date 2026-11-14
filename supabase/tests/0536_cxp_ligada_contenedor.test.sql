\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0536 (SDD-0631).
-- Fixtures ficticios, montos inventados y rollback: no toca prod.
--
-- Lo que se protege:
--   1. Las columnas nacen vacías y la fila previa no cambia.
--   2. Se aceptan: sin vínculo, solo contenedor, solo embarque, ambos coherentes.
--   3. Se rechaza: contenedor de otro tenant, contenedor borrado, embarque de
--      otro tenant, embarque que no está en el contenedor, vínculo sin categoría,
--      categoría fuera de las 7 de Costing.
--   4. Aplicarla dos veces no falla ni duplica CHECK ni trigger.
--   5. Cambiar solo el estado de una CxP legada (embarque sin categoría) no la
--      bloquea: el trigger mira las columnas del vínculo, no cualquier UPDATE.

begin;

do $vacia$
begin
  if to_regclass('public.supplier_bills') is not null or to_regclass('public.consolidations') is not null then
    raise exception 'TEST 0536 requiere una base PostgreSQL desechable vacía';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end;
$vacia$;

-- Lo mínimo de las tablas que la migración toca o consulta (0088, 0096, 0100).
create table public.tenants (id uuid primary key);
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id), deleted_at timestamptz
);
create table public.consolidations (
  id uuid primary key, tenant_id uuid not null references public.tenants(id), deleted_at timestamptz
);
create table public.consolidation_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  consolidation_id uuid not null references public.consolidations(id) on delete cascade,
  shipment_id uuid references public.shipments(id) on delete set null,
  cbm numeric(10,3) not null default 0
);
create table public.supplier_bills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  bill_code text not null,
  total_amount numeric(14,2) not null,
  status text not null default 'pendiente',
  shipment_id uuid references public.shipments(id) on delete set null,
  deleted_at timestamptz
);

-- Helpers same-tenant con el cuerpo de 0241 y 0100.
create function public.consolidation_in_tenant(p_consolidation uuid, p_tenant uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if p_consolidation is null then return true; end if;
  return exists (select 1 from public.consolidations
                  where id = p_consolidation and tenant_id = p_tenant and deleted_at is null);
end;
$$;
create function public.shipment_in_tenant(p_shipment uuid, p_tenant uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if p_shipment is null then return true; end if;
  return exists (select 1 from public.shipments
                  where id = p_shipment and tenant_id = p_tenant and deleted_at is null);
end;
$$;

-- Tenant A (propio) y B (ajeno).
insert into public.tenants values
  ('00000000-0000-4000-8000-0000000000a1'), ('00000000-0000-4000-8000-0000000000b1');
insert into public.shipments values
  ('00000000-0000-4000-8000-00000000a501', '00000000-0000-4000-8000-0000000000a1', null), -- en el contenedor
  ('00000000-0000-4000-8000-00000000a502', '00000000-0000-4000-8000-0000000000a1', null), -- suelto
  ('00000000-0000-4000-8000-00000000b501', '00000000-0000-4000-8000-0000000000b1', null); -- ajeno
insert into public.consolidations values
  ('00000000-0000-4000-8000-00000000ac01', '00000000-0000-4000-8000-0000000000a1', null),
  ('00000000-0000-4000-8000-00000000ac02', '00000000-0000-4000-8000-0000000000a1', now()), -- borrado
  ('00000000-0000-4000-8000-00000000bc01', '00000000-0000-4000-8000-0000000000b1', null);  -- ajeno
insert into public.consolidation_items (tenant_id, consolidation_id, shipment_id, cbm) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000ac01', '00000000-0000-4000-8000-00000000a501', 12);

-- CxP legada: embarque puesto a mano antes de la 0536, sin categoría.
insert into public.supplier_bills (id, tenant_id, bill_code, total_amount, shipment_id) values
  ('00000000-0000-4000-8000-0000000b1001', '00000000-0000-4000-8000-0000000000a1', 'CXP-TEST-0001', 100,
   '00000000-0000-4000-8000-00000000a502');

\ir ../migrations/0536_cxp_ligada_contenedor.sql

-- 4. Idempotente: la segunda pasada no falla.
\ir ../migrations/0536_cxp_ligada_contenedor.sql

do $contrato$
declare
  v_count integer;
  v_ok boolean;
  A constant uuid := '00000000-0000-4000-8000-0000000000a1';
  C_OK constant uuid := '00000000-0000-4000-8000-00000000ac01';
  C_BORRADO constant uuid := '00000000-0000-4000-8000-00000000ac02';
  C_AJENO constant uuid := '00000000-0000-4000-8000-00000000bc01';
  S_EN constant uuid := '00000000-0000-4000-8000-00000000a501';
  S_SUELTO constant uuid := '00000000-0000-4000-8000-00000000a502';
  S_AJENO constant uuid := '00000000-0000-4000-8000-00000000b501';
begin
  -- 1. Nacen vacías; la fila legada no cambió.
  select count(*) into v_count from public.supplier_bills
   where consolidation_id is not null or cost_category is not null;
  if v_count <> 0 then
    raise exception 'CONTRATO 1: las columnas debían nacer vacías (% filas)', v_count;
  end if;

  -- 4. Un solo CHECK y un solo trigger.
  select count(*) into v_count from pg_catalog.pg_constraint
   where conrelid = 'public.supplier_bills'::regclass and conname = 'supplier_bills_cost_category_check';
  if v_count <> 1 then raise exception 'CONTRATO 4: se esperaba 1 CHECK, hay %', v_count; end if;
  select count(*) into v_count from pg_catalog.pg_trigger
   where tgrelid = 'public.supplier_bills'::regclass and tgname = 'supplier_bills_validate_cost_link';
  if v_count <> 1 then raise exception 'CONTRATO 4: se esperaba 1 trigger, hay %', v_count; end if;

  -- 6. La función del trigger: search_path vacío y nadie la ejecuta por la API.
  if not exists (
    select 1 from pg_catalog.pg_proc
     where oid = 'public.supplier_bills_validate_cost_link()'::regprocedure
       and prosecdef and proconfig @> array['search_path=""']
  ) then
    raise exception 'CONTRATO 6: la función del trigger debe ser SECURITY DEFINER con search_path vacío';
  end if;
  if pg_catalog.has_function_privilege('authenticated', 'public.supplier_bills_validate_cost_link()', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.supplier_bills_validate_cost_link()', 'EXECUTE') then
    raise exception 'CONTRATO 6: anon o authenticated pueden ejecutar la función del trigger';
  end if;

  -- 5. La CxP legada sigue pudiendo cambiar de estado.
  update public.supplier_bills set status = 'parcial' where bill_code = 'CXP-TEST-0001';

  -- 2. Aceptados.
  insert into public.supplier_bills (tenant_id, bill_code, total_amount) values (A, 'CXP-OK-NADA', 10);
  insert into public.supplier_bills (tenant_id, bill_code, total_amount, consolidation_id, cost_category)
    values (A, 'CXP-OK-CONT', 10, C_OK, 'freight');
  insert into public.supplier_bills (tenant_id, bill_code, total_amount, shipment_id, cost_category)
    values (A, 'CXP-OK-EMB', 10, S_SUELTO, 'customs');
  insert into public.supplier_bills (tenant_id, bill_code, total_amount, consolidation_id, shipment_id, cost_category)
    values (A, 'CXP-OK-AMBOS', 10, C_OK, S_EN, 'freight');
  -- Ligar después una CxP existente (el caso de la deuda ya registrada).
  update public.supplier_bills set consolidation_id = C_OK, cost_category = 'freight'
   where bill_code = 'CXP-OK-NADA';

  -- 3. Rechazados. Cada bloque tiene que fallar.
  v_ok := false;
  begin
    insert into public.supplier_bills (tenant_id, bill_code, total_amount, consolidation_id, cost_category)
      values (A, 'CXP-X-1', 10, C_AJENO, 'freight');
  exception when others then v_ok := sqlerrm like '%consolidation_id%'; end;
  if not v_ok then raise exception 'CONTRATO 3a: aceptó un contenedor de otro tenant'; end if;

  v_ok := false;
  begin
    insert into public.supplier_bills (tenant_id, bill_code, total_amount, consolidation_id, cost_category)
      values (A, 'CXP-X-2', 10, C_BORRADO, 'freight');
  exception when others then v_ok := sqlerrm like '%consolidation_id%'; end;
  if not v_ok then raise exception 'CONTRATO 3b: aceptó un contenedor borrado'; end if;

  v_ok := false;
  begin
    insert into public.supplier_bills (tenant_id, bill_code, total_amount, shipment_id, cost_category)
      values (A, 'CXP-X-3', 10, S_AJENO, 'freight');
  exception when others then v_ok := sqlerrm like '%shipment_id%'; end;
  if not v_ok then raise exception 'CONTRATO 3c: aceptó un embarque de otro tenant'; end if;

  v_ok := false;
  begin
    insert into public.supplier_bills (tenant_id, bill_code, total_amount, consolidation_id, shipment_id, cost_category)
      values (A, 'CXP-X-4', 10, C_OK, S_SUELTO, 'freight');
  exception when others then v_ok := sqlerrm like '%no está asignado%'; end;
  if not v_ok then raise exception 'CONTRATO 3d: aceptó un embarque que no está en el contenedor'; end if;

  v_ok := false;
  begin
    insert into public.supplier_bills (tenant_id, bill_code, total_amount, consolidation_id)
      values (A, 'CXP-X-5', 10, C_OK);
  exception when others then v_ok := sqlerrm like '%cost_category%'; end;
  if not v_ok then raise exception 'CONTRATO 3e: aceptó un vínculo sin categoría'; end if;

  v_ok := false;
  begin
    update public.supplier_bills set cost_category = null where bill_code = 'CXP-OK-CONT';
  exception when others then v_ok := sqlerrm like '%cost_category%'; end;
  if not v_ok then raise exception 'CONTRATO 3f: dejó quitar la categoría a una CxP ligada'; end if;

  v_ok := false;
  begin
    insert into public.supplier_bills (tenant_id, bill_code, total_amount, consolidation_id, cost_category)
      values (A, 'CXP-X-6', 10, C_OK, 'espacio');
  exception when check_violation then v_ok := true; end;
  if not v_ok then raise exception 'CONTRATO 3g: aceptó una categoría fuera de Costing'; end if;

  select count(*) into v_count from public.supplier_bills where bill_code like 'CXP-OK-%';
  if v_count <> 4 then raise exception 'CONTRATO 2: se esperaban 4 CxP aceptadas, hay %', v_count; end if;

  raise notice 'TEST 0536 GREEN';
end;
$contrato$;

select 'TEST 0536 GREEN' as resultado;

rollback;
