-- ─────────────────────────────────────────────────────────────
-- Fix: public_ocean_rate() nunca matcheaba ninguna ruta (SDD-0095)
-- ─────────────────────────────────────────────────────────────
-- Bug de nacimiento (migración 0146): la función comparaba
-- `o.point_from = upper(trim(p_from))`, pero `point_from`/`point_to` en
-- `ocean_rates` se guardan en MINÚSCULA (slugs del catálogo, ej. 'ningbo',
-- 'la-guaira' — ver lib/shared/ocean-rate.ts:validateOceanRouteInput, que
-- normaliza pointIdFrom/pointIdTo a lowercase). El upper() nunca matcheaba
-- → /cotizador-flete SIEMPRE mostraba "no disponible", desde que se creó.
--
-- shipping_type/container SÍ se guardan en MAYÚSCULA (validateOceanRouteInput
-- los normaliza a uppercase) → esas comparaciones quedan igual.
--
-- Detectado 2026-07-20 al verificar el backfill de SeaRates (SDD-0092/0095)
-- tras reactivar el acceso a la cuenta.

create or replace function public.public_ocean_rate(
  p_from text,
  p_to text,
  p_type text,
  p_container text default ''
)
returns table (
  rate_usd     numeric,
  currency     text,
  transit_days integer,
  carrier      text,
  offers_count integer,
  valid_to     date,
  indicative   boolean,
  spot         boolean,
  status       text,
  fetched_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select o.rate_usd, o.currency, o.transit_days, o.carrier, o.offers_count,
         o.valid_to, o.indicative, o.spot, o.status, o.fetched_at
  from public.ocean_rates o
  where o.point_from = lower(trim(p_from))
    and o.point_to = lower(trim(p_to))
    and o.shipping_type = upper(trim(p_type))
    and o.container = upper(trim(coalesce(p_container, '')))
  limit 1;
$$;

comment on function public.public_ocean_rate(text,text,text,text) is
  'SDD-0095: lectura pública (anon) de una tarifa cacheada de ocean_rates. Retorno mínimo (solo tarifa). Lo consume lib/public/ocean-rates-public.ts. 0 llamadas a SeaRates por visita. Fix 2026-07-20: point_from/point_to comparan en minúscula (bug de nacimiento con upper()).';

revoke all on function public.public_ocean_rate(text,text,text,text) from public;
grant execute on function public.public_ocean_rate(text,text,text,text) to anon, authenticated;
