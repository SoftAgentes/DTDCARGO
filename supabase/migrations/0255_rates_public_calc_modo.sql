-- ─────────────────────────────────────────────────────────────
-- 0255 · La tarifa del LCL CONSOLIDADO se edita desde /studio/tarifas
--        rates.public_calc_modo + índice singleton POR MODALIDAD
--        + public_cbm_rate(p_modo) + fila pública del consolidado
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff.
--    Aplicar exige OK del founder NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md).
--
-- ── Problema ────────────────────────────────────────────────
-- El sitio tiene DOS calculadoras LCL (SDD revestido web, /tarifas):
--   · Puerta a Puerta (DDP) → tarifa CONFIGURABLE: la fila de `rates`
--     marcada is_public, servida por la RPC anon public_cbm_rate().
--   · LCL Consolidado (hasta puerto, BL propio) → tarifa HARDCODEADA en
--     `CONSOLIDADO_CBM_RATE = 580` de lib/calculadora.ts. Cambiarla exige
--     un deploy. El founder no puede tocarla desde el Studio.
--
-- ── Por qué NO alcanza con marcar otra fila is_public ───────
-- El índice `rates_one_public_cbm_per_tenant` (migr 0101) es un singleton
-- POR TENANT: `unique (tenant_id) where is_public and deleted_at is null
-- and per_cbm is not null`. A lo sumo UNA tarifa per_cbm pública por tenant
-- → una segunda fila para el consolidado es imposible hoy.
--
-- ── Por qué NO se usa la columna `service` como discriminador ─
-- Sería lo natural (`consolidacion` vs `puerta_a_puerta_DDP`), pero en prod
-- la ÚNICA fila is_public —la que alimenta la calculadora DDP— está guardada
-- como `service = 'consolidacion'` (verificado 2026-07-20: China → Venezuela,
-- per_cbm 850, min_charge 50, status published). `service` describe el
-- PRODUCTO COMERCIAL del catálogo, no la ranura del calculador público, y hoy
-- los dos no coinciden. Discriminar por `service` intercambiaría en silencio
-- las dos tarifas del sitio el día que alguien corrija ese dato. (Corregir el
-- `service` de esa fila es una limpieza aparte, del founder, no de esta
-- migración: tocarlo mueve la fila en reportes y filtros del Studio.)
--
-- ── Decisión: COLUMNA discriminadora + FILA nueva ───────────
-- `rates.public_calc_modo` ('ddp' | 'consolidado') dice a QUÉ calculadora
-- pública alimenta la fila. Es explícito, independiente de `service`, y
-- `not null default 'ddp'` hace el backfill solo: toda fila existente (y toda
-- fila nueva que el Studio inserte sin tocar la columna) conserva EXACTAMENTE
-- la semántica de antes.
--
-- El singleton pasa a ser por (tenant_id, public_calc_modo) → una pública por
-- modalidad. Como el default es 'ddp', una fila nueva marcada is_public sin
-- pensar sigue colisionando con la DDP igual que hoy: cero forma nueva de
-- romper el sitio.
--
-- Y como la fila del consolidado se inserta acá, el founder puede editar su
-- per_cbm en /studio/tarifas SIN un solo cambio de UI: es una tarifa más de
-- la tabla, y el form ya edita per_cbm / min_charge / vigencia / status.
--
-- ── Falta después de aplicar (NO va en esta migración) ──────
-- lib/public/rates-queries.ts → getPublicCbmRate('consolidado') y
-- components/CalculadoraForm.tsx → leer esa tarifa en vez de
-- CONSOLIDADO_CBM_RATE (que queda como fallback, igual que el DDP).
--
-- Idempotente: add column if not exists · create index if not exists ·
-- create or replace · insert ... where not exists.
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 1) Columna discriminadora
-- ─────────────────────────────────────────────────────────────

alter table public.rates
  add column if not exists public_calc_modo text not null default 'ddp';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rates_public_calc_modo_check'
  ) then
    alter table public.rates
      add constraint rates_public_calc_modo_check
      check (public_calc_modo in ('ddp', 'consolidado'));
  end if;
end$$;

comment on column public.rates.public_calc_modo is
  'A qué calculadora PÚBLICA alimenta esta tarifa cuando is_public: ddp = Puerta a Puerta (todo incluido hasta la puerta) · consolidado = LCL Consolidado (hasta puerto, BL propio del cliente). Espeja el tipo CalcModo de lib/calculadora.ts. NO es lo mismo que `service` (ese es el producto del catálogo comercial). Default ddp = la semántica que había antes de la migr 0255. Solo importa si is_public.';

-- ─────────────────────────────────────────────────────────────
-- 2) Singleton: de UNA pública por tenant → una por tenant Y MODALIDAD
-- ─────────────────────────────────────────────────────────────

drop index if exists public.rates_one_public_cbm_per_tenant;

create unique index if not exists rates_one_public_cbm_per_tenant_modo
  on public.rates (tenant_id, public_calc_modo)
  where is_public and deleted_at is null and per_cbm is not null;

comment on index public.rates_one_public_cbm_per_tenant_modo is
  'A lo sumo UNA tarifa per_cbm pública por tenant y por modalidad del calculador (migr 0255; reemplaza rates_one_public_cbm_per_tenant de 0101, que era una sola por tenant). Sin esto, marcar 2 → la RPC elige al azar (bug silencioso).';

-- ─────────────────────────────────────────────────────────────
-- 3) public_cbm_rate(p_modo) · anon · retorno mínimo
--    Cuerpo idéntico a 0104 (exige status='published') + filtro de modalidad.
--    El parámetro tiene DEFAULT 'ddp' → el código ya desplegado, que llama
--    `rpc("public_cbm_rate")` sin argumentos, sigue recibiendo la tarifa DDP.
--    Se dropea la firma vieja de 0 args: convivir con la nueva haría ambigua
--    la llamada sin argumentos.
-- ─────────────────────────────────────────────────────────────

drop function if exists public.public_cbm_rate();

create or replace function public.public_cbm_rate(p_modo text default 'ddp')
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
    and r.public_calc_modo = coalesce(nullif(trim(p_modo), ''), 'ddp')
    and (r.valid_from is null or r.valid_from <= current_date)
    and (r.valid_until is null or r.valid_until >= current_date)
  order by r.valid_from desc nulls last
  limit 1;
$$;

comment on function public.public_cbm_rate(text) is
  'Endpoint público (anon) de la tarifa por CBM del calculador del sitio. p_modo: ddp (default, Puerta a Puerta) | consolidado (LCL hasta puerto). Devuelve la fila is_public Y status=published del tenant dtd para esa modalidad: per_cbm + min_charge + valid_until. Retorno MÍNIMO, sin data comercial sensible. Un draft NUNCA se sirve. Singleton garantizado por rates_one_public_cbm_per_tenant_modo (migr 0255).';

revoke all on function public.public_cbm_rate(text) from public;
grant execute on function public.public_cbm_rate(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4) La fila del LCL Consolidado, sembrada con el valor vigente
--    (CONSOLIDADO_CBM_RATE = 580, dato del founder 2026-07-20).
--    Sin piso comercial: el consolidado no tiene mínimo hoy.
--    Nace published + is_public → editable de una en /studio/tarifas.
-- ─────────────────────────────────────────────────────────────

insert into public.rates (
  tenant_id, service, origin, destination,
  per_cbm, min_charge, is_public, public_calc_modo, status, notes
)
select
  t.id, 'consolidacion'::shipment_service, 'China', 'Puerto en Venezuela',
  580.00, null, true, 'consolidado', 'published',
  'Tarifa base del calculador público LCL Consolidado (hasta puerto, BL propio del cliente). La edita el founder desde /studio/tarifas; el sitio la lee por public_cbm_rate(''consolidado'').'
from public.tenants t
where t.slug = 'dtd'
  and not exists (
    select 1 from public.rates r
    where r.tenant_id = t.id
      and r.public_calc_modo = 'consolidado'
      and r.is_public
      and r.deleted_at is null
  );
