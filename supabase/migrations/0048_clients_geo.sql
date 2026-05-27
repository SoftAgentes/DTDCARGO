-- ─────────────────────────────────────────────────────────────
-- Geolocalización en clients · habilita "Cerca tuyo" real del Mobile ERP
--
-- Aditivo · NULLABLE · admin carga lat/lng desde /studio/clientes
-- (drawer de edit) o se autocompleta cuando integremos geocoding
-- de address en una fase futura.
--
-- También a user_profiles · "operating_lat/lng" override para cuando
-- el user no quiera dar permiso al browser pero sí setear su HQ.
-- ─────────────────────────────────────────────────────────────

alter table public.clients
  add column if not exists lat numeric,
  add column if not exists lng numeric;

comment on column public.clients.lat is
  'Latitud GPS del cliente · NULL si no se capturó. Habilita "Cerca tuyo" del Mobile ERP via haversine.';

comment on column public.clients.lng is
  'Longitud GPS del cliente · NULL si no se capturó.';

create index if not exists clients_geo_idx
  on public.clients (lat, lng)
  where deleted_at is null and lat is not null and lng is not null;

-- user_profiles: lat/lng operativo · fallback cuando browser geo no
-- disponible o user no autoriza.
alter table public.user_profiles
  add column if not exists operating_lat numeric,
  add column if not exists operating_lng numeric;

comment on column public.user_profiles.operating_lat is
  'Latitud HQ operativa del user · fallback para Mobile ERP "Cerca tuyo" si browser geo no autorizado.';

comment on column public.user_profiles.operating_lng is
  'Longitud HQ operativa del user.';
