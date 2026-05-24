-- ─────────────────────────────────────────────────────────────
-- SDD-0017: Almacén VE — columnas de entrega final + POD
-- Agrega 3 columnas a shipments (todas nullable, no rompe nada):
--   delivery_address  → dirección final del cliente (≠ destination que es puerto)
--   delivered_at      → timestamp del POD firmado
--   pod_signed_by     → quien recibió y firmó
-- Trigger: setea delivered_at = now() al pasar a status 'delivered'.
-- ─────────────────────────────────────────────────────────────

alter table public.shipments
  add column if not exists delivery_address text,
  add column if not exists delivered_at     timestamptz,
  add column if not exists pod_signed_by    text;

comment on column public.shipments.delivery_address is
  'Dirección final del cliente en destino (distinta de destination que es el puerto). Se completa al asignar reparto.';

comment on column public.shipments.delivered_at is
  'Timestamp del POD (proof of delivery). Se setea automáticamente al pasar status a delivered.';

comment on column public.shipments.pod_signed_by is
  'Nombre de quien recibió y firmó el POD (cliente, recepcionista, etc.).';

-- Trigger: dispara delivered_at cuando el shipment entra al estado delivered
-- por primera vez. Paralelo al trigger existente set_arrived_destination_at.
create or replace function public.set_delivered_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'delivered'
     and (old.status is null or old.status <> 'delivered')
     and new.delivered_at is null then
    new.delivered_at = now();
  end if;
  return new;
end; $$;

drop trigger if exists shipments_delivered_at on public.shipments;
create trigger shipments_delivered_at
  before insert or update on public.shipments
  for each row execute function public.set_delivered_at();
