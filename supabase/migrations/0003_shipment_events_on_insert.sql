-- ─────────────────────────────────────────────────────────────
-- SDD-0006 Fase 3: triggers para timeline automatico + cascade soft delete
-- ─────────────────────────────────────────────────────────────

-- 1. Trigger: cada vez que se crea un shipment, se inserta un evento inicial
--    "Envio creado". Asi el timeline nunca esta vacio.
create or replace function public.create_initial_shipment_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.shipment_events (tenant_id, shipment_id, status, note, occurred_at)
  values (new.tenant_id, new.id, new.status, 'Envio creado', new.created_at);
  return new;
end;
$$;

comment on function public.create_initial_shipment_event is
  'SDD-0006: inserta un evento inicial al crear un shipment, para que el timeline siempre arranque con un punto.';

create trigger shipments_initial_event
  after insert on public.shipments
  for each row execute function public.create_initial_shipment_event();

-- 2. Trigger: cuando un shipment se soft-deletea (deleted_at pasa de null a no-null),
--    sus events tambien se soft-deletean con el mismo timestamp.
create or replace function public.cascade_soft_delete_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.shipment_events
    set deleted_at = new.deleted_at
    where shipment_id = new.id and deleted_at is null;
  end if;
  return new;
end;
$$;

comment on function public.cascade_soft_delete_events is
  'SDD-0006: cascade soft delete del shipment a sus shipment_events asociados.';

create trigger shipments_cascade_soft_delete
  after update of deleted_at on public.shipments
  for each row execute function public.cascade_soft_delete_events();

-- 3. Indices para busqueda/filtros del listado en /studio/tracking
create index if not exists shipments_tenant_code_idx
  on public.shipments (tenant_id, code)
  where deleted_at is null;

create index if not exists shipments_tenant_client_idx
  on public.shipments (tenant_id, client_name)
  where deleted_at is null;
