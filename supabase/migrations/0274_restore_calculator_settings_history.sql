-- SDD-0118 · restaurar el payload reproducible de calculator_settings.
-- Sólo reemplaza statements NULL del ledger; no ejecuta el DDL almacenado.

do $sdd0118_calculator_settings_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260604131310'
      and name = '0103_calculator_settings'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '0f7deee22e3a978c52159b6fc211ee2c'
        )
      )
  ) then
    raise exception 'SDD-0118 calculator_settings: drift en 20260604131310 0103_calculator_settings';
  end if;
end
$sdd0118_calculator_settings_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_calculator_settings_target$-- ─────────────────────────────────────────────────────────────
-- 0103 · Calculadora pública Fase 3 (Slice A) · calculator_settings
--        + RPC public_calculator_config() (anon, security definer endurecida)
--
-- Justificación negocio: la calculadora pública (app/calculadora) ya toma la
-- TARIFA BASE y el PISO desde la tarifa real del Studio (Fase 2, rates.is_public).
-- Pero el RESTO de las reglas (peso incluido por CBM, $/kg de excedente,
-- descuento Valencia, multiplicador de baterías, km del casco, $/km, recargo
-- de embalaje especial) sigue HARDCODEADO en lib/calculadora.ts (CONFIG).
-- Slice A las saca al Studio: el admin las edita en /studio/tarifas › Parámetros.
--
-- Alcance de esta tabla: SOLO las reglas escalares del calculador. La tarifa
-- base (per_cbm) y el piso (min_charge) NO viven acá — siguen en rates.is_public
-- (fuente única, Fase 2). Ciudades y embalajes quedan para Slice B.
--
-- Mecanismo: una fila por tenant (singleton, tenant_id como PK). El sitio
-- público la lee vía RPC anon de retorno mínimo. Si no hay fila, el calculador
-- cae a los defaults de CONFIG (cero regresión).
--
-- Decisiones (mismo patrón que 0101):
--  · Singleton por tenant_id PK → no hay ambigüedad de "cuál config".
--  · CHECKs de cordura → previene config que rompa el cálculo (peso_max <
--    peso_incluido, multiplicador < 1, negativos).
--  · RPC scopeada a slug='dtd' explícito (mono-tenant en la práctica).
--  · SECURITY DEFINER endurecida: set search_path, refs schema-qualified,
--    revoke all from public + grant execute a anon.
--
-- Idempotente: create table if not exists + create or replace + drop if exists.
-- ─────────────────────────────────────────────────────────────

-- 1) Tabla singleton por tenant
create table if not exists public.calculator_settings (
  tenant_id                 uuid primary key references public.tenants(id) on delete cascade,
  -- Reglas escalares del calculador LCL DDP (espejo de CONFIG en lib/calculadora.ts)
  peso_incluido_kg          numeric(10,2) not null default 500,   -- kg/CBM incluidos sin recargo
  peso_max_kg               numeric(10,2) not null default 600,   -- kg/CBM tope → alerta FCL
  recargo_excedente_kg      numeric(10,2) not null default 1,     -- $/kg sobre peso_incluido
  descuento_valencia        numeric(10,2) not null default 50,    -- $ off si destino = Valencia
  recargo_embalaje_especial numeric(10,2) not null default 50,    -- $ por embalaje madera/paleta
  recargo_bateria_mult      numeric(10,3) not null default 1.5,   -- ×flete si lleva baterías
  threshold_casco_km        numeric(10,2) not null default 200,   -- km de casco central (flat)
  tarifa_km_fuera_casco     numeric(10,2) not null default 1,     -- $/km fuera del casco
  updated_at                timestamptz not null default now(),
  updated_by                uuid references auth.users(id),
  -- Cordura: una config inválida rompería el calculador público.
  constraint calculator_settings_peso_incluido_pos check (peso_incluido_kg > 0),
  constraint calculator_settings_peso_max_gte_incluido check (peso_max_kg >= peso_incluido_kg),
  constraint calculator_settings_excedente_nonneg check (recargo_excedente_kg >= 0),
  constraint calculator_settings_descuento_nonneg check (descuento_valencia >= 0),
  constraint calculator_settings_embalaje_nonneg check (recargo_embalaje_especial >= 0),
  constraint calculator_settings_bateria_gte_one check (recargo_bateria_mult >= 1),
  constraint calculator_settings_casco_nonneg check (threshold_casco_km >= 0),
  constraint calculator_settings_km_nonneg check (tarifa_km_fuera_casco >= 0)
);

comment on table public.calculator_settings is
  'Reglas escalares del calculador público LCL DDP (Fase 3 Slice A). Una fila por tenant. La tarifa base y el piso NO viven acá (siguen en rates.is_public, Fase 2). La lee public_calculator_config() vía anon. Sin fila → el sitio cae a los defaults de CONFIG.';

-- GRANTS EXPLÍCITOS (auto-expose new tables OFF en este proyecto Supabase)
grant select, insert, update on public.calculator_settings to authenticated;

-- 2) RLS por tenant (mismo nivel de permiso que editar rates: cualquier
--    usuario autenticado del tenant. No admin-gated, consistente con tarifas).
alter table public.calculator_settings enable row level security;

create policy "calculator_settings by tenant"
  on public.calculator_settings for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

-- 3) Trigger updated_at (reusa function existente de 0002_shipments.sql)
create trigger calculator_settings_touch
  before update on public.calculator_settings
  for each row execute function public.touch_updated_at();

-- 4) Seed: fila default para el tenant dtd (matchea CONFIG de lib/calculadora.ts).
--    Sin esto el calculador igual anda (cae a CONFIG), pero el form del Studio
--    arranca poblado en vez de vacío.
insert into public.calculator_settings (tenant_id)
select t.id from public.tenants t where t.slug = 'dtd'
on conflict (tenant_id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 5) RPC public_calculator_config() · anon · retorno mínimo
-- ─────────────────────────────────────────────────────────────

drop function if exists public.public_calculator_config();

create or replace function public.public_calculator_config()
returns table (
  peso_incluido_kg          numeric,
  peso_max_kg               numeric,
  recargo_excedente_kg      numeric,
  descuento_valencia        numeric,
  recargo_embalaje_especial numeric,
  recargo_bateria_mult      numeric,
  threshold_casco_km        numeric,
  tarifa_km_fuera_casco     numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select cs.peso_incluido_kg, cs.peso_max_kg, cs.recargo_excedente_kg,
         cs.descuento_valencia, cs.recargo_embalaje_especial, cs.recargo_bateria_mult,
         cs.threshold_casco_km, cs.tarifa_km_fuera_casco
  from public.calculator_settings cs
  join public.tenants t on t.id = cs.tenant_id
  where t.slug = 'dtd'
  limit 1;
$$;

comment on function public.public_calculator_config() is
  'Endpoint público (anon) para la calculadora del sitio (calculadora Fase 3 Slice A). Devuelve las reglas escalares del calculador del tenant dtd. Retorno MÍNIMO, sin tenant_id ni data sensible. Par con public_cbm_rate() (que sirve base + piso). Scoped a slug=dtd.';

-- Grants: solo execute, anon + authenticated. Nadie más.
revoke all on function public.public_calculator_config() from public;
grant execute on function public.public_calculator_config() to anon, authenticated;
$sdd0118_calculator_settings_target$
]
where version = '20260604131310'
  and name = '0103_calculator_settings'
  and statements is null;

do $sdd0118_calculator_settings_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260604131310'
      and name = '0103_calculator_settings'
      and cardinality(statements) = 1
      and md5(statements[1]) = '0f7deee22e3a978c52159b6fc211ee2c'
  ) then
    raise exception 'SDD-0118 calculator_settings: postcondición falló en 20260604131310 0103_calculator_settings';
  end if;
end
$sdd0118_calculator_settings_postflight$;
