-- ─────────────────────────────────────────────────────────────
-- SDD-0101 · Naviera Tier 1 · Slice A: número de contenedor (tracking key)
--
-- El tracking naviero real (deep-link a SeaRates / API de tracking) se hace por
-- NÚMERO DE CONTENEDOR (ej 'COSU1234567') o por BL. El BL ya existe (bookings.bl_number,
-- migr 0096) pero el nº de contenedor no se persistía. Esta migración lo agrega al
-- CONTENEDOR físico (consolidations = el Container del blueprint) y al booking (para
-- FCL / reserva directa).
--
-- ADITIVA y NULLABLE:
--   · 2 columnas text nullable (consolidations.container_no, bookings.container_no),
--   · SIN tocar la RLS — heredan la de sus tablas (por tenant_id, SDD-0047 migr 0096),
--   · índices parciales (tenant_id, container_no) para el lookup inverso "por contenedor",
--   · SIN funciones nuevas → sin revoke/security-definer que aplicar acá.
--
-- El resto del snapshot naviero (vessel/voyage/POL/POD/ETD/ETA/carrier/BL) NO se
-- duplica: ya vive en sailings/bookings/carriers y se resuelve por join.
--
-- Sin DDL destructivo. NO aplicar a prod (lo hace coordinación / Sam).
-- ─────────────────────────────────────────────────────────────

-- 1. Nº de contenedor físico del contenedor de consolidación (el 95% LCL).
alter table public.consolidations
  add column if not exists container_no text;

comment on column public.consolidations.container_no is
  'SDD-0101: número físico del contenedor (ej COSU1234567) para tracking naviero (deep-link SeaRates / API). null = aún sin asignar. El resto del dato naviero (vessel/ETD/ETA) vive en sailings vía sailing_id.';

-- 2. Nº de contenedor a nivel booking (FCL / reserva directa sin consolidación).
alter table public.bookings
  add column if not exists container_no text;

comment on column public.bookings.container_no is
  'SDD-0101: número físico del contenedor (FCL / reserva directa) para tracking. Complementa bl_number (también clave de tracking). null = sin asignar.';

-- 3. Índices parciales para el lookup inverso "¿de quién es este contenedor?"
--    (futura conciliación con el feed de SeaRates). Solo filas vivas con contenedor.
create index if not exists consolidations_tenant_container_idx
  on public.consolidations (tenant_id, container_no)
  where container_no is not null and deleted_at is null;

create index if not exists bookings_tenant_container_idx
  on public.bookings (tenant_id, container_no)
  where container_no is not null and deleted_at is null;
