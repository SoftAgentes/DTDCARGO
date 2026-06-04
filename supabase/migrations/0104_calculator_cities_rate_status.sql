-- ─────────────────────────────────────────────────────────────
-- 0104 · Calculadora pública Fase 3 (Slices B + C) · SDD-0055
--
--   Slice B — ciudades del calculador a la DB
--     · tabla calculator_cities (por tenant, RLS, soft-delete)
--     · seed de las 15 ciudades actuales de lib/calculadora.ts (tenant dtd)
--     · RPC anon public_calculator_cities() · retorno MÍNIMO (slug,label,km,casco)
--
--   Slice C — estados de tarifa
--     · rates.status enum-text draft|published|archived (default published)
--     · backfill: las existentes quedan published (no cambia nada)
--     · public_cbm_rate() ahora filtra además status='published' → un draft
--       NUNCA se sirve al público
--
-- Justificación negocio: hoy las ciudades (km desde Valencia + flag casco)
-- están HARDCODEADAS en lib/calculadora.ts → cambiar una distancia exige deploy.
-- Slice A ya movió los 8 parámetros escalares a calculator_settings; esto cierra
-- las ciudades. Y rates no tenía borrador: toda tarifa era live (0008 §96) → el
-- admin no podía preparar una tarifa sin impactar al público. status agrega el
-- lifecycle; el calculador público = is_public (singleton 0101) Y published.
--
-- Decisiones (mismo patrón que 0101 / 0103):
--  · Frontera intacta: el sitio lee por RPC anon de retorno mínimo, jamás
--    tenant_id ni columnas internas. Sin filas → fallback a CIUDADES (0 regr.).
--  · RPC scopea al tenant slug='dtd' explícito (mono-tenant en la práctica).
--  · SECURITY DEFINER endurecida: set search_path, refs schema-qualified,
--    revoke all from public + grant execute a anon.
--  · Write de calculator_cities = ADMIN del tenant (más restrictivo que rates,
--    que es cualquier usuario del tenant) — son datos del calculador público.
--
-- Aditiva · idempotente · NO se aplica a prod en esta corrida (lo hace el founder).
-- Sin DDL destructivo (solo add column / create table / create or replace).
-- ─────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════
-- SLICE B · 1) Tabla calculator_cities
-- ═════════════════════════════════════════════════════════════

create table if not exists public.calculator_cities (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  slug        text not null,                         -- sin espacios (id interno del calculador)
  label       text not null,                         -- nombre visible en el form
  km          numeric(10,1) not null default 0,      -- km desde Valencia centro (≥0)
  casco       boolean not null default false,        -- true = casco central, entrega flat sin recargo por km
  sort_order  int not null default 0,                -- orden de aparición en el dropdown
  deleted_at  timestamptz,                           -- soft-delete
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint calculator_cities_km_nonneg check (km >= 0),
  constraint calculator_cities_slug_nonempty check (length(trim(slug)) > 0)
);

comment on table public.calculator_cities is
  'Ciudades de destino del calculador público LCL DDP (Fase 3 Slice B, SDD-0055). Una fila por tenant+slug. km = distancia desde Valencia centro; casco = entrega flat sin recargo por km. La lee public_calculator_cities() vía anon. Sin filas → el sitio cae al array CIUDADES de lib/calculadora.ts (cero regresión).';

-- Slug único por tenant entre las vivas (soft-delete permite reusar un slug
-- borrado). Espeja el singleton-por-slug de los ids de CIUDADES.
create unique index if not exists calculator_cities_tenant_slug_alive
  on public.calculator_cities (tenant_id, slug)
  where deleted_at is null;

-- GRANTS EXPLÍCITOS (auto-expose new tables OFF en este proyecto Supabase)
grant select, insert, update on public.calculator_cities to authenticated;
grant all on public.calculator_cities to service_role;

-- 2) RLS por tenant: read = cualquier usuario autenticado del tenant;
--    write (insert/update) = solo ADMIN del tenant; service_role bypasea.
alter table public.calculator_cities enable row level security;

create policy "calculator_cities read by tenant"
  on public.calculator_cities for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id());

create policy "calculator_cities write by admin"
  on public.calculator_cities for insert
  to authenticated
  with check (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = calculator_cities.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

create policy "calculator_cities update by admin"
  on public.calculator_cities for update
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = calculator_cities.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  )
  with check (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = calculator_cities.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

create policy "calculator_cities service_role all"
  on public.calculator_cities for all
  to service_role
  using (true)
  with check (true);

-- 3) Trigger updated_at (reusa function existente de 0002_shipments.sql)
drop trigger if exists calculator_cities_touch on public.calculator_cities;
create trigger calculator_cities_touch
  before update on public.calculator_cities
  for each row execute function public.touch_updated_at();

-- 4) Seed: las 15 ciudades actuales de lib/calculadora.ts (CIUDADES) para el
--    tenant dtd. Idempotente — on conflict (índice parcial vivo) do nothing.
insert into public.calculator_cities (tenant_id, slug, label, km, casco, sort_order)
select t.id, c.slug, c.label, c.km, c.casco, c.sort_order
from public.tenants t
cross join (values
  ('casco-central',  'Casco central (Valencia · Maracay · Caracas)', 0,   true,  0),
  ('valencia',       'Valencia (sede)',  0,   true,  1),
  ('maracay',        'Maracay',          70,  true,  2),
  ('caracas',        'Caracas',          150, true,  3),
  ('barquisimeto',   'Barquisimeto',     220, false, 4),
  ('maracaibo',      'Maracaibo',        410, false, 5),
  ('puerto-la-cruz', 'Puerto La Cruz',   430, false, 6),
  ('san-cristobal',  'San Cristóbal',    580, false, 7),
  ('merida',         'Mérida',           520, false, 8),
  ('ciudad-bolivar', 'Ciudad Bolívar',   700, false, 9),
  ('puerto-ordaz',   'Puerto Ordaz',     770, false, 10),
  ('punto-fijo',     'Punto Fijo',       290, false, 11),
  ('coro',           'Coro',             260, false, 12),
  ('margarita',      'Isla Margarita',   540, false, 13)
) as c(slug, label, km, casco, sort_order)
where t.slug = 'dtd'
on conflict (tenant_id, slug) where (deleted_at is null) do nothing;

-- 5) RPC public_calculator_cities() · anon · retorno MÍNIMO
drop function if exists public.public_calculator_cities(uuid);

create or replace function public.public_calculator_cities(p_tenant uuid default null)
returns table (
  slug  text,
  label text,
  km    numeric,
  casco boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select cc.slug, cc.label, cc.km, cc.casco
  from public.calculator_cities cc
  join public.tenants t on t.id = cc.tenant_id
  where (
          (p_tenant is not null and t.id = p_tenant)
          or (p_tenant is null and t.slug = 'dtd')
        )
    and cc.deleted_at is null
  order by cc.sort_order asc, cc.label asc;
$$;

comment on function public.public_calculator_cities(uuid) is
  'Endpoint público (anon) para la calculadora del sitio (SDD-0055 Fase 3 Slice B). Devuelve las ciudades de destino del tenant dtd (o p_tenant si se pasa): slug + label + km + casco. Retorno MÍNIMO, sin tenant_id ni columnas internas. Par con public_cbm_rate() y public_calculator_config(). Sin filas → el sitio cae al array CIUDADES hardcoded.';

revoke all on function public.public_calculator_cities(uuid) from public;
grant execute on function public.public_calculator_cities(uuid) to anon, authenticated;

-- ═════════════════════════════════════════════════════════════
-- SLICE C · estados de tarifa (rates.status)
-- ═════════════════════════════════════════════════════════════

-- 1) Columna status: draft | published | archived. Default published →
--    backfill automático: las filas existentes quedan published (no cambia
--    nada del comportamiento actual; el público ya las veía).
alter table public.rates
  add column if not exists status text not null default 'published';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rates_status_check'
  ) then
    alter table public.rates
      add constraint rates_status_check
      check (status in ('draft', 'published', 'archived'));
  end if;
end$$;

comment on column public.rates.status is
  'Lifecycle de la tarifa (SDD-0055 Fase 3 Slice C): draft = preparada, NO live · published = activa (la pública del calculador = is_public Y published) · archived = retirada. Backfill: existentes = published.';

-- 2) public_cbm_rate() ahora exige status='published' → un draft (o archived)
--    nunca se sirve al público. Resto del cuerpo idéntico a 0101.
drop function if exists public.public_cbm_rate();

create or replace function public.public_cbm_rate()
returns table (
  per_cbm     numeric,
  min_charge  numeric,
  valid_until date
)
language sql
stable
security definer
set search_path = public
as $$
  select r.per_cbm, r.min_charge, r.valid_until
  from public.rates r
  join public.tenants t on t.id = r.tenant_id
  where t.slug = 'dtd'
    and r.is_public = true
    and r.status = 'published'
    and r.deleted_at is null
    and r.per_cbm is not null
    and (r.valid_from is null or r.valid_from <= current_date)
    and (r.valid_until is null or r.valid_until >= current_date)
  order by r.valid_from desc nulls last
  limit 1;
$$;

comment on function public.public_cbm_rate() is
  'Endpoint público (anon) para la calculadora del sitio (calculadora Fase 2 + Fase 3 Slice C). Devuelve la tarifa per_cbm marcada is_public Y status=published del tenant dtd: per_cbm + min_charge + valid_until. Retorno MÍNIMO. Un draft NUNCA se sirve. Singleton garantizado por índice rates_one_public_cbm_per_tenant.';

revoke all on function public.public_cbm_rate() from public;
grant execute on function public.public_cbm_rate() to anon, authenticated;
