-- ─────────────────────────────────────────────────────────────
-- 0336 · Tarifa pública DDP → $850/CBM a partir del 4-sep-2026 (founder 2026-08-05)
--
-- QUÉ HACE: programa con pg_cron el relevo de la tarifa pública del calculador
-- Puerta a Puerta. La vigente ($800, válida hasta 2026-09-03) vence sola; este
-- job crea su reemplazo de $850 con vigencia 2026-09-04 → 2026-10-04 (un mes).
--
-- POR QUÉ UN JOB Y NO DEJAR LA FILA LISTA: el índice único
-- `rates_one_public_cbm_per_tenant_modo` (tenant_id, public_calc_modo) admite
-- UNA sola tarifa pública viva por modalidad — no se puede dejar la de
-- septiembre esperando al lado de la de agosto. Y el índice no se toca: el
-- singleton es la invariante que /studio/tarifas usa para avisarle al founder
-- cuando intenta marcar una segunda pública (PUBLIC_RATE_CONFLICT_MSG en
-- app/studio/(app)/tarifas/actions.ts). Relajarlo apagaría ese aviso.
--
-- QUÉ PASA SI EL JOB FALLA: nada se rompe. La fila vieja ya venció, la RPC
-- devuelve null y el sitio cae al respaldo de lib/calculadora.ts ($800) — el
-- mismo precio de hoy. Se pierde la subida, no la calculadora.
--
-- ⚠️ EL RESPALDO DEL CÓDIGO QUEDA DESALINEADO EL 4-SEP. `CONFIG.tarifaBaseCBM`
--    en lib/calculadora.ts sigue en 800 a propósito (hoy es el valor correcto).
--    El 4-sep hay que subirlo a 850 en un deploy, o una caída de Supabase
--    cotizaría 6% por debajo. Es la misma grieta que documenta esa constante.
--
-- ⚠️ Y EL 5-OCT LA TARIFA CAE SOLA A 800. Al vencer el 2026-10-04 la RPC
--    devuelve null y el sitio vuelve al respaldo del código sin avisarle a
--    nadie. Renovar la vigencia antes de esa fecha desde /studio/tarifas.
--
-- Idempotente: la función no hace nada si la tarifa de septiembre ya existe, y
-- se auto-desprograma al terminar (doble red por si el unschedule falla).
-- ─────────────────────────────────────────────────────────────

create extension if not exists pg_cron;

create or replace function public.rate_ddp_promote_850_sep2026()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_actual public.rates%rowtype;
  v_nueva  uuid;
begin
  select id into v_tenant from public.tenants where slug = 'dtd' limit 1;
  if v_tenant is null then
    raise notice '[rate_ddp_850] no existe el tenant dtd — no hago nada';
    return null;
  end if;

  -- Idempotencia: si la tarifa de septiembre ya está creada, salir en silencio.
  if exists (
    select 1 from public.rates
     where tenant_id = v_tenant
       and public_calc_modo = 'ddp'
       and per_cbm = 850
       and valid_from = date '2026-09-04'
       and deleted_at is null
  ) then
    raise notice '[rate_ddp_850] la tarifa de septiembre ya existe — no hago nada';
    perform cron.unschedule('rate-ddp-850-sep2026');
    return null;
  end if;

  -- La pública vigente del modo ddp. Se clona para no perder sus datos
  -- (service, origin/destination, min_charge, transit_days).
  select * into v_actual
    from public.rates
   where tenant_id = v_tenant
     and public_calc_modo = 'ddp'
     and is_public
     and deleted_at is null
     and per_cbm is not null
   limit 1;

  if not found then
    raise notice '[rate_ddp_850] no hay tarifa pública ddp que relevar — no hago nada';
    return null;
  end if;

  -- Despublicar la vieja ANTES de insertar: el índice único no admite dos.
  -- No se borra ni se archiva: queda como histórico con su vigencia cerrada.
  update public.rates
     set is_public = false,
         updated_at = now()
   where id = v_actual.id;

  insert into public.rates (
    tenant_id, service, origin, destination,
    per_cbm, flat_rate, min_charge, transit_days,
    valid_from, valid_until, is_public, status, public_calc_modo, notes
  ) values (
    v_tenant, v_actual.service, v_actual.origin, v_actual.destination,
    850, v_actual.flat_rate, v_actual.min_charge, v_actual.transit_days,
    date '2026-09-04', date '2026-10-04', true, 'published', 'ddp',
    'Tarifa pública del calculador web — Puerta a Puerta China→Venezuela. '
    'Subida programada de $800 a $850 al vencer la anterior (founder 2026-08-05, '
    'migración 0336). Vigencia de un mes: al vencer el 2026-10-04 el sitio cae al '
    'respaldo del código ($800) — renovar antes desde /studio/tarifas.'
  ) returning id into v_nueva;

  -- Trabajo hecho: el job no tiene por qué volver a correr el año que viene.
  perform cron.unschedule('rate-ddp-850-sep2026');

  return v_nueva;
end;
$$;

comment on function public.rate_ddp_promote_850_sep2026() is
  'Migración 0336: releva la tarifa pública DDP del calculador ($800 → $850) el 4-sep-2026, con vigencia hasta el 2026-10-04. La corre pg_cron una sola vez y se auto-desprograma. Idempotente.';

revoke execute on function public.rate_ddp_promote_850_sep2026() from public, anon, authenticated;
grant  execute on function public.rate_ddp_promote_850_sep2026() to service_role;

-- 4 de septiembre de 2026, 05:10 UTC = 01:10 en Venezuela (tráfico mínimo).
-- El día importa: la tarifa vieja es válida HASTA el 3-sep inclusive
-- (la RPC filtra `valid_until >= current_date`), así que el relevo es el 4.
select cron.schedule(
  'rate-ddp-850-sep2026',
  '10 5 4 9 *',
  $job$select public.rate_ddp_promote_850_sep2026();$job$
);
