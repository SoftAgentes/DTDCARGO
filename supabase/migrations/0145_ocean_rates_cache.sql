-- ─────────────────────────────────────────────────────────────
-- 0145 · SDD-0094 · Cotizador público de fletes — caché de tarifas SeaRates
--
-- Tabla `ocean_rates`: matriz CACHEADA de tarifas de flete marítimo (derivadas
-- de SeaRates) que un cron SEMANAL refresca. El sitio público lee de acá, 0
-- llamadas en vivo por visita = a prueba de scraping + protege la cuota (100/mes).
--
-- Modelo:
--   · Es DATA DE REFERENCIA GLOBAL (no por-cliente) → SIN tenant_id.
--   · La ESCRIBE el cron vía service_role (bypassa RLS) — /api/cron/searates-refresh.
--   · La LEE el público SOLO vía la RPC `public_ocean_rate` (security definer,
--     grant anon) — nunca acceso directo a la tabla (RLS la bloquea para anon).
--   · Cacheamos también los "no_rate"/"error" (status) para no reintentar rutas
--     muertas en cada visita y poder decir "no disponible" con contexto.
--
-- Seguridad (skills Supabase invocados · seguridad + postgres-best-practices):
--   · RLS ENABLE sin policies para anon/authenticated → tabla cerrada al Data API.
--   · public_ocean_rate: security definer + search_path fijo + SOLO columnas de
--     tarifa (nada sensible) + revoke from public + grant anon (público a propósito).
--
-- Idempotente (if not exists / create or replace). NO aplicar a prod desde la rama
-- — la aplica la ventana de coordinación (regla de la ventana secundaria).
-- ─────────────────────────────────────────────────────────────

-- ── 1) Tabla de caché ────────────────────────────────────────
create table if not exists public.ocean_rates (
  id            uuid primary key default gen_random_uuid(),
  -- Ruta (IDs de punto SeaRates "P_<n>"). container='' para LCL (no NULL → upsert simple).
  point_from    text not null,
  point_to      text not null,
  shipping_type text not null,
  container     text not null default '',
  -- Resultado de la consulta a SeaRates.
  status        text not null default 'ok',     -- ok | no_rate | error
  rate_usd      numeric(12,2),
  currency      text,
  transit_days  integer,
  carrier       text,
  offers_count  integer,
  valid_to      date,
  indicative    boolean,
  spot          boolean,
  error_code    text,                            -- poblado cuando status='error'
  -- Frescura.
  fetched_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- CHECKs (enums lógicos; espejo de OceanShippingType / status en lib/shared/ocean-rate.ts).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ocean_rates_shipping_type_chk') then
    alter table public.ocean_rates
      add constraint ocean_rates_shipping_type_chk check (shipping_type in ('FCL','LCL'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ocean_rates_status_chk') then
    alter table public.ocean_rates
      add constraint ocean_rates_status_chk check (status in ('ok','no_rate','error'));
  end if;
end $$;

-- Clave de upsert: una fila por ruta+contenedor (container='' = LCL).
create unique index if not exists ocean_rates_route_uidx
  on public.ocean_rates (point_from, point_to, shipping_type, container);

comment on table public.ocean_rates is
  'SDD-0094: caché de tarifas de flete marítimo (SeaRates) que refresca el cron semanal /api/cron/searates-refresh. Data de referencia GLOBAL (sin tenant_id). El público la lee SOLO vía public_ocean_rate() (0 llamadas en vivo = anti-scraping).';

-- ── 2) RLS · tabla cerrada (acceso solo por service_role + la RPC) ──
alter table public.ocean_rates enable row level security;
-- Intencional: NO hay policies para anon/authenticated. El cron escribe con
-- service_role (bypassa RLS); el público lee con public_ocean_rate() (definer).
-- Acceso directo a la tabla por anon/authenticated → bloqueado.

-- ── 3) RPC pública de lectura (anon) ─────────────────────────
-- Devuelve la fila cacheada de una ruta. Retorno MÍNIMO: solo columnas de tarifa
-- (no expone error_code/created_at internos). Security definer para leer la tabla
-- RLS-cerrada; search_path fijo; revoke from public + grant anon (público a propósito).
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
  where o.point_from = upper(trim(p_from))
    and o.point_to = upper(trim(p_to))
    and o.shipping_type = upper(trim(p_type))
    and o.container = upper(trim(coalesce(p_container, '')))
  limit 1;
$$;

comment on function public.public_ocean_rate(text,text,text,text) is
  'SDD-0094: lectura pública (anon) de una tarifa cacheada de ocean_rates. Retorno mínimo (solo tarifa). Lo consume lib/public/ocean-rates-public.ts. 0 llamadas a SeaRates por visita.';

revoke all on function public.public_ocean_rate(text,text,text,text) from public;
grant execute on function public.public_ocean_rate(text,text,text,text) to anon, authenticated;
