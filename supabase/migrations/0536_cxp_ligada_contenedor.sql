-- ─────────────────────────────────────────────────────────────
-- 0536 · SDD-0631 — La CxP se liga a un contenedor y, opcional, a un embarque.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Aplicar exige OK de Sam NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md). El código tolera la base sin
--    estas columnas: el costeo sigue sin CxP ligadas y Tesorería oculta el
--    selector.
--
-- ── Para qué ─────────────────────────────────────────────────
-- Lo que se le debe a un proveedor por el espacio de un contenedor tiene que
-- llegar al margen de ese contenedor y de sus embarques. `supplier_bills` ya
-- tenía `shipment_id` (0088) pero nunca se llenaba, y no tenía vínculo con
-- `consolidations` (0096).
--
-- ── Qué toca ─────────────────────────────────────────────────
-- · `consolidation_id` uuid nullable → consolidations(id) on delete set null.
-- · `cost_category` text nullable con CHECK en las 7 categorías de Costing
--   (`shipment_costs`, 0100): qué renglón del costeo cubre la CxP.
-- · Dos índices parciales sobre las CxP vivas ligadas.
-- · Trigger same-tenant fail-closed (contenedor y embarque vivos del tenant,
--   embarque dentro del contenedor, categoría obligatoria si hay vínculo).
-- Sin cambios de filas, RLS, grants, asientos ni auditoría: las columnas
-- heredan las policies de 0470. ADD COLUMN nullable sin default solo toca
-- metadatos; el CHECK recorre la tabla una vez (todas las filas en null).
-- ─────────────────────────────────────────────────────────────

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.supplier_bills') is null
     or pg_catalog.to_regclass('public.consolidations') is null
     or pg_catalog.to_regclass('public.consolidation_items') is null
     or pg_catalog.to_regclass('public.shipments') is null then
    raise exception '0536: faltan supplier_bills, consolidations, consolidation_items o shipments';
  end if;
  if pg_catalog.to_regprocedure('public.consolidation_in_tenant(uuid,uuid)') is null
     or pg_catalog.to_regprocedure('public.shipment_in_tenant(uuid,uuid)') is null then
    raise exception '0536: faltan los helpers consolidation_in_tenant (0241) o shipment_in_tenant (0100)';
  end if;
  -- Si una columna ya existe con otro tipo, no es la de esta migración: parar.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'supplier_bills'
       and ((column_name = 'consolidation_id' and data_type <> 'uuid')
         or (column_name = 'cost_category' and data_type <> 'text'))
  ) then
    raise exception '0536: supplier_bills ya tiene consolidation_id o cost_category con otro tipo';
  end if;
end
$preflight$;

alter table public.supplier_bills
  add column if not exists consolidation_id uuid
    references public.consolidations(id) on delete set null;

alter table public.supplier_bills
  add column if not exists cost_category text;

do $check$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'public.supplier_bills'::regclass
       and conname = 'supplier_bills_cost_category_check'
  ) then
    alter table public.supplier_bills
      add constraint supplier_bills_cost_category_check
      check (cost_category is null or cost_category in
        ('freight', 'customs', 'transport', 'handling', 'insurance', 'commission', 'other'));
  end if;
end
$check$;

create index if not exists sb_tenant_consolidation_idx
  on public.supplier_bills (tenant_id, consolidation_id)
  where consolidation_id is not null and deleted_at is null;

create index if not exists sb_tenant_shipment_idx
  on public.supplier_bills (tenant_id, shipment_id)
  where shipment_id is not null and deleted_at is null;

-- ── Defensa en la base (la acción del servidor valida lo mismo) ──
create or replace function public.supplier_bills_validate_cost_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.consolidation_in_tenant(new.consolidation_id, new.tenant_id) then
    raise exception 'supplier_bills: consolidation_id % inexistente, borrada o de otro tenant',
      new.consolidation_id using errcode = '42501';
  end if;
  if not public.shipment_in_tenant(new.shipment_id, new.tenant_id) then
    raise exception 'supplier_bills: shipment_id % inexistente, borrado o de otro tenant',
      new.shipment_id using errcode = '42501';
  end if;
  if new.consolidation_id is not null and new.shipment_id is not null
     and not exists (
       select 1 from public.consolidation_items ci
        where ci.consolidation_id = new.consolidation_id
          and ci.shipment_id = new.shipment_id
          and ci.tenant_id = new.tenant_id
     ) then
    raise exception 'supplier_bills: el embarque % no está asignado al contenedor %',
      new.shipment_id, new.consolidation_id using errcode = '23514';
  end if;
  if (new.consolidation_id is not null or new.shipment_id is not null)
     and new.cost_category is null then
    raise exception 'supplier_bills: una CxP ligada a contenedor o embarque necesita cost_category'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

comment on function public.supplier_bills_validate_cost_link() is
  'SDD-0631: la CxP ligada apunta a un contenedor y a un embarque vivos del MISMO tenant; si trae los dos, el embarque está en ese contenedor; con vínculo, cost_category es obligatoria. SECURITY DEFINER, fail-closed.';

revoke all on function public.supplier_bills_validate_cost_link() from public;

drop trigger if exists supplier_bills_validate_cost_link on public.supplier_bills;
create trigger supplier_bills_validate_cost_link
  before insert or update of consolidation_id, shipment_id, cost_category, tenant_id
  on public.supplier_bills
  for each row execute function public.supplier_bills_validate_cost_link();

comment on column public.supplier_bills.consolidation_id is
  'SDD-0631: contenedor (consolidación) al que pertenece el costo de la CxP. Sin embarque, el costo se reparte por CBM entre los embarques del contenedor.';
comment on column public.supplier_bills.cost_category is
  'SDD-0631: categoría de Costing que cubre la CxP (freight/customs/transport/handling/insurance/commission/other). En esa categoría reemplaza a shipment_costs; obligatoria si hay vínculo.';

do $postflight$
begin
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'supplier_bills'
         and column_name in ('consolidation_id', 'cost_category')) <> 2 then
    raise exception '0536: faltan columnas tras aplicar';
  end if;
  if not exists (select 1 from pg_catalog.pg_trigger
                  where tgrelid = 'public.supplier_bills'::regclass
                    and tgname = 'supplier_bills_validate_cost_link'
                    and not tgisinternal) then
    raise exception '0536: falta el trigger supplier_bills_validate_cost_link';
  end if;
end
$postflight$;
