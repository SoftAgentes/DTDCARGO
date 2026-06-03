-- ─────────────────────────────────────────────────────────────
-- 0101 · Calculadora pública Fase 2 · rates.valid_from + rates.is_public
--        + RPC public_cbm_rate() (anon, security definer endurecida)
--
-- Justificación negocio: la calculadora pública (app/calculadora) usa hoy
-- una tarifa HARDCODEADA ($800/CBM, piso $50). Fase 2 la conecta a la tarifa
-- real que el admin configura en /studio/tarifas, sin romper la frontera
-- público↔ERP y sin filtrar info comercial.
--
-- Mecanismo: el admin marca UNA tarifa per_cbm como `is_public` (la pública
-- del calculador). El sitio público la lee vía RPC anon de retorno MÍNIMO
-- (per_cbm + min_charge + valid_until). NUNCA tenant_id, flat_rate, notes.
--
-- Decisiones (plan-eng-review + codex outside voice):
--  · Singleton: índice único parcial → a lo sumo UNA tarifa per_cbm pública
--    por tenant. Sin esto, marcar 2 → la RPC elige al azar (bug silencioso).
--  · La RPC scopea al tenant slug='dtd' explícito (mono-tenant en la práctica,
--    igual que 0059), no LIMIT 1 global → determinista y a prueba de un
--    segundo tenant futuro que marque una pública por accidente.
--  · SECURITY DEFINER endurecida: set search_path, refs schema-qualified,
--    revoke all from public + grant execute a anon.
--
-- Idempotente: add column if not exists + create or replace + drop if exists.
-- ─────────────────────────────────────────────────────────────

-- 1) Columnas nuevas en rates
alter table public.rates
  add column if not exists valid_from date;

alter table public.rates
  add column if not exists is_public boolean not null default false;

comment on column public.rates.valid_from is
  'Fecha desde la que la tarifa es válida (nullable = válida desde siempre). Par con valid_until.';
comment on column public.rates.is_public is
  'Marca la tarifa per_cbm como la PÚBLICA del calculador del sitio. A lo sumo una por tenant (índice único parcial). La lee public_cbm_rate() vía anon.';

-- 2) Backfill: valid_from = created_at (created_at es NOT NULL en 0005)
update public.rates
   set valid_from = created_at::date
 where valid_from is null;

-- 3) Singleton: a lo sumo UNA tarifa per_cbm pública viva por tenant.
--    Sin per_cbm (FCL flat) no puede ser la pública del calculador LCL.
create unique index if not exists rates_one_public_cbm_per_tenant
  on public.rates (tenant_id)
  where is_public and deleted_at is null and per_cbm is not null;

-- ─────────────────────────────────────────────────────────────
-- 4) RPC public_cbm_rate() · anon · retorno mínimo
-- ─────────────────────────────────────────────────────────────

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
    and r.deleted_at is null
    and r.per_cbm is not null
    and (r.valid_from is null or r.valid_from <= current_date)
    and (r.valid_until is null or r.valid_until >= current_date)
  order by r.valid_from desc nulls last
  limit 1;
$$;

comment on function public.public_cbm_rate() is
  'Endpoint público (anon) para la calculadora del sitio (SDD calculadora Fase 2). Devuelve la tarifa per_cbm marcada is_public del tenant dtd: per_cbm + min_charge + valid_until. Retorno MÍNIMO, sin data comercial sensible. Scoped a slug=dtd. Singleton garantizado por índice rates_one_public_cbm_per_tenant.';

-- Grants: solo execute, anon + authenticated. Nadie más.
revoke all on function public.public_cbm_rate() from public;
grant execute on function public.public_cbm_rate() to anon, authenticated;
