-- ─────────────────────────────────────────────────────────────
-- SDD-0006 patch: agregar columna destination_gps a shipments.
-- Sirve para que el operador registre la ubicacion GPS del destino
-- cuando el cliente la envia (solo aplicable a transporte_terrestre,
-- pero el campo es nullable para todos).
--
-- Formato libre por ahora: puede ser "lat,long" o un link de Google Maps.
-- ─────────────────────────────────────────────────────────────

alter table public.shipments
  add column if not exists destination_gps text;

comment on column public.shipments.destination_gps is
  'Ubicacion GPS del destino. Util en transporte terrestre cuando el cliente envia coordenadas o link Google Maps. Texto libre — sin validacion estricta en MVP.';
