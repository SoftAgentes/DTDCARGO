\set ON_ERROR_STOP on

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$roles$;

create schema auth;
create table auth.users (id uuid primary key);

create table public.tenants (
  id uuid primary key,
  slug text not null unique
);

create function public.get_user_tenant_id()
returns uuid
language sql
stable
as $$
  select null::uuid
$$;

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

insert into public.tenants (id, slug)
values ('10000000-0000-4000-8000-000000000103', 'dtd');

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  statements text[]
);

insert into supabase_migrations.schema_migrations (version, name, statements)
values
(
  '20260604131310',
  '0103_calculator_settings',
  array[
    $sdd0118_calculator_split_0$-- ─────────────────────────────────────────────────────────────
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
)$sdd0118_calculator_split_0$,
    $sdd0118_calculator_split_1$comment on table public.calculator_settings is
  'Reglas escalares del calculador público LCL DDP (Fase 3 Slice A). Una fila por tenant. La tarifa base y el piso NO viven acá (siguen en rates.is_public, Fase 2). La lee public_calculator_config() vía anon. Sin fila → el sitio cae a los defaults de CONFIG.'$sdd0118_calculator_split_1$,
    $sdd0118_calculator_split_2$-- GRANTS EXPLÍCITOS (auto-expose new tables OFF en este proyecto Supabase)
grant select, insert, update on public.calculator_settings to authenticated$sdd0118_calculator_split_2$,
    $sdd0118_calculator_split_3$-- 2) RLS por tenant (mismo nivel de permiso que editar rates: cualquier
--    usuario autenticado del tenant. No admin-gated, consistente con tarifas).
alter table public.calculator_settings enable row level security$sdd0118_calculator_split_3$,
    $sdd0118_calculator_split_4$create policy "calculator_settings by tenant"
  on public.calculator_settings for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id())$sdd0118_calculator_split_4$,
    $sdd0118_calculator_split_5$-- 3) Trigger updated_at (reusa function existente de 0002_shipments.sql)
create trigger calculator_settings_touch
  before update on public.calculator_settings
  for each row execute function public.touch_updated_at()$sdd0118_calculator_split_5$,
    $sdd0118_calculator_split_6$-- 4) Seed: fila default para el tenant dtd (matchea CONFIG de lib/calculadora.ts).
--    Sin esto el calculador igual anda (cae a CONFIG), pero el form del Studio
--    arranca poblado en vez de vacío.
insert into public.calculator_settings (tenant_id)
select t.id from public.tenants t where t.slug = 'dtd'
on conflict (tenant_id) do nothing$sdd0118_calculator_split_6$,
    $sdd0118_calculator_split_7$-- ─────────────────────────────────────────────────────────────
-- 5) RPC public_calculator_config() · anon · retorno mínimo
-- ─────────────────────────────────────────────────────────────

drop function if exists public.public_calculator_config()$sdd0118_calculator_split_7$,
    $sdd0118_calculator_split_8$create or replace function public.public_calculator_config()
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
$$$sdd0118_calculator_split_8$,
    $sdd0118_calculator_split_9$comment on function public.public_calculator_config() is
  'Endpoint público (anon) para la calculadora del sitio (calculadora Fase 3 Slice A). Devuelve las reglas escalares del calculador del tenant dtd. Retorno MÍNIMO, sin tenant_id ni data sensible. Par con public_cbm_rate() (que sirve base + piso). Scoped a slug=dtd.'$sdd0118_calculator_split_9$,
    $sdd0118_calculator_split_10$-- Grants: solo execute, anon + authenticated. Nadie más.
revoke all on function public.public_calculator_config() from public$sdd0118_calculator_split_10$,
    $sdd0118_calculator_split_11$grant execute on function public.public_calculator_config() to anon, authenticated$sdd0118_calculator_split_11$
  ]
),
(
  '20260729143620',
  '0274_restore_calculator_settings_history',
  array[$sdd0118_calculator_split_original_0274$-- SDD-0118 · restaurar el payload reproducible de calculator_settings.
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
$sdd0118_calculator_split_original_0274$ || chr(13) || chr(10)]
);

\ir ../migrations/0283_repair_calculator_settings_split_history.sql
\ir ../migrations/0283_repair_calculator_settings_split_history.sql

do $patched_0274_contract$
declare
  v_payload text;
begin
  select statements[1]
  into strict v_payload
  from supabase_migrations.schema_migrations
  where version = '20260729143620'
    and name = '0274_restore_calculator_settings_history'
    and cardinality(statements) = 1
    and md5(statements[1]) = '7dec3bd4977326580000cbdb0d528305';

  if v_payload <> $sdd0118_calculator_split_expected_0274$-- SDD-0118 · restaurar el payload reproducible de calculator_settings.
-- Sólo reemplaza el estado NULL o el split exacto de R14; no ejecuta el DDL almacenado.
-- 0283 conserva fail-closed cualquier representación no reconocida.

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
        or (
          cardinality(statements) = 12
          and md5(array_to_string(statements, E'\n')) = 'f7102aeb22551a4628923dfba5d11793'
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
  and (
    statements is null
    or (
      cardinality(statements) = 12
      and md5(array_to_string(statements, E'\n')) = 'f7102aeb22551a4628923dfba5d11793'
    )
  );

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
$sdd0118_calculator_split_expected_0274$ || chr(13) || chr(10) then
    raise exception 'TEST 0283: payload 0274 no es byte-idéntico al esperado';
  end if;
  if pg_catalog.strpos(v_payload, 'f7102aeb22551a4628923dfba5d11793') = 0
     or pg_catalog.strpos(v_payload, 'cardinality(statements) = 12') = 0 then
    raise exception 'TEST 0283: falta compatibilidad con el split de R14';
  end if;
end
$patched_0274_contract$;

select unnest(statements)
from supabase_migrations.schema_migrations
where version = '20260604131310'
  and name = '0103_calculator_settings'
\gexec

select statements[1]
from supabase_migrations.schema_migrations
where version = '20260729143620'
  and name = '0274_restore_calculator_settings_history'
\gexec

do $ledger_contract$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260604131310'
      and name = '0103_calculator_settings'
      and cardinality(statements) = 1
      and md5(statements[1]) = '0f7deee22e3a978c52159b6fc211ee2c'
  ) then
    raise exception 'TEST 0274: estado final incorrecto en 20260604131310';
  end if;
end
$ledger_contract$;

do $replay_contract$
declare
  v_config record;
begin
  if to_regclass('public.calculator_settings') is null then
    raise exception 'TEST 0274: falta public.calculator_settings';
  end if;
  if (
    select count(*)
    from public.calculator_settings cs
    join public.tenants t on t.id = cs.tenant_id
    where t.slug = 'dtd'
      and cs.peso_incluido_kg = 500
      and cs.peso_max_kg = 600
      and cs.recargo_excedente_kg = 1
      and cs.descuento_valencia = 50
      and cs.recargo_embalaje_especial = 50
      and cs.recargo_bateria_mult = 1.5
      and cs.threshold_casco_km = 200
      and cs.tarifa_km_fuera_casco = 1
  ) <> 1 then
    raise exception 'TEST 0274: seed default incorrecto';
  end if;
  if not exists (
    select 1
    from pg_constraint c
    join pg_class source_table on source_table.oid = c.conrelid
    join pg_class target_table on target_table.oid = c.confrelid
    join pg_namespace target_schema on target_schema.oid = target_table.relnamespace
    where c.contype = 'f'
      and source_table.relname = 'calculator_settings'
      and target_schema.nspname = 'public'
      and target_table.relname = 'tenants'
      and c.confdeltype = 'c'
  ) then
    raise exception 'TEST 0274: FK tenant no conserva CASCADE';
  end if;
  if not exists (
    select 1
    from pg_constraint c
    join pg_class source_table on source_table.oid = c.conrelid
    join pg_class target_table on target_table.oid = c.confrelid
    join pg_namespace target_schema on target_schema.oid = target_table.relnamespace
    where c.contype = 'f'
      and source_table.relname = 'calculator_settings'
      and target_schema.nspname = 'auth'
      and target_table.relname = 'users'
  ) then
    raise exception 'TEST 0274: FK updated_by hacia auth.users ausente';
  end if;
  if not coalesce((
    select relrowsecurity
    from pg_class
    where oid = 'public.calculator_settings'::regclass
  ), false) then
    raise exception 'TEST 0274: RLS no está habilitado';
  end if;
  if (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'calculator_settings'
      and policyname = 'calculator_settings by tenant'
      and cmd = 'ALL'
  ) <> 1 then
    raise exception 'TEST 0274: policy tenant incompleta';
  end if;
  if not has_table_privilege(
    'authenticated',
    'public.calculator_settings',
    'SELECT, INSERT, UPDATE'
  ) or has_table_privilege(
    'authenticated',
    'public.calculator_settings',
    'DELETE'
  ) then
    raise exception 'TEST 0274: grants de tabla incorrectos';
  end if;
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.calculator_settings'::regclass
      and tgname = 'calculator_settings_touch'
      and tgenabled = 'O'
      and not tgisinternal
  ) then
    raise exception 'TEST 0274: trigger updated_at ausente';
  end if;
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'public_calculator_config'
      and p.prosecdef
      and p.provolatile = 's'
      and p.proconfig @> array['search_path=public']
  ) then
    raise exception 'TEST 0274: RPC no conserva hardening';
  end if;
  if not has_function_privilege(
    'anon',
    'public.public_calculator_config()',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.public_calculator_config()',
    'EXECUTE'
  ) then
    raise exception 'TEST 0274: grants de RPC incompletos';
  end if;
  if exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) acl
    where p.oid = 'public.public_calculator_config()'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0274: PUBLIC conserva EXECUTE';
  end if;

  select * into v_config from public.public_calculator_config();
  if v_config.peso_incluido_kg <> 500
    or v_config.peso_max_kg <> 600
    or v_config.recargo_excedente_kg <> 1
    or v_config.descuento_valencia <> 50
    or v_config.recargo_embalaje_especial <> 50
    or v_config.recargo_bateria_mult <> 1.5
    or v_config.threshold_casco_km <> 200
    or v_config.tarifa_km_fuera_casco <> 1
  then
    raise exception 'TEST 0274: retorno RPC incorrecto';
  end if;
end
$replay_contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  and to_regnamespace('auth') is null
  and to_regclass('public.calculator_settings') is null
  as sdd_0118_calculator_settings_fixture_rolled_back;
