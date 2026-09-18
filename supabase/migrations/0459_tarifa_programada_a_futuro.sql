-- SDD-0478. Prepared for review; NOT applied to production.
-- The next public calculator rate can be loaded ahead of time: it waits in a
-- scheduled slot and replaces the public one, atomically, on its start date.
-- ─────────────────────────────────────────────────────────────
-- 0459 · Programar la próxima tarifa pública sin dejar el sitio sin tarifa
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff.
--    Aplicar exige OK del founder NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md).
--
-- ── Problema ────────────────────────────────────────────────
-- El índice `rates_one_public_cbm_per_tenant_modo` (migr 0255) admite UNA
-- tarifa pública con precio por modalidad:
--   unique (tenant_id, public_calc_modo)
--   where is_public and deleted_at is null and per_cbm is not null
-- Para dejar cargada la tarifa que rija después del 2026-11-29 hay que
-- DESPUBLICAR la vigente. Desde ese instante hasta el `valid_from` de la nueva,
-- `public_cbm_rate` no tiene fila que devolver (filtra `valid_from <=
-- current_date`) y `/tarifas`, `/tarifas/embed` y `/api/public/cbm-rate`
-- cotizan con `CONFIG.tarifaBaseCBM` de `lib/calculadora.ts`: una constante del
-- código, no la base. Es el hueco que la 0458 cerró por el lado del
-- vencimiento, abierto ahora por el lado del arranque.
--
-- La 0336 lo esquivó UNA vez con un job de pg_cron escrito a mano para una
-- sola fecha y un solo precio ($800 → $850 el 2026-09-04). Funcionó. Esta
-- migración convierte ese relevo en algo que el founder hace desde
-- /studio/tarifas sin pedirle una migración a nadie.
--
-- ── Decisión: una ranura PROGRAMADA al lado de la pública ───
-- · `rates.publica_programada` marca LA tarifa que va a reemplazar a la pública
--   de su modalidad el día de su `valid_from`. Mientras espera NO es pública
--   (`is_public = false`): la RPC no la ve y el sitio sigue con la vigente.
-- · A lo sumo UNA programada por (tenant, modalidad): índice propio.
-- · `promover_tarifas_programadas()` hace el relevo en UNA transacción:
--   despublica la pública con precio de esa modalidad y publica la programada.
--   Un lector ve el antes o el después, nunca el medio. No hay ventana.
-- · pg_cron la corre cada hora al minuto 5. El día cuenta en hora de Caracas,
--   así que el relevo ocurre a las 00:05 de Venezuela del día de arranque.
--   Si una corrida falla, la siguiente hora la repite: es idempotente.
--
-- ── Por qué NO se toca el índice singleton ──────────────────
-- Es la invariante con la que /studio/tarifas le avisa al founder cuando
-- intenta marcar una SEGUNDA pública (PUBLIC_RATE_CONFLICT_MSG en
-- app/studio/(app)/tarifas/actions.ts, que reconoce el 23505 por el nombre del
-- índice). Relajarlo —por ejemplo, indexando también `valid_from`— apagaría
-- ese aviso para cualquier par de fechas distintas, y una segunda pública con
-- fecha pasada quedaría ignorada en silencio. Con la ranura aparte la regla
-- sigue igual: una sola pública viva por modalidad, siempre.
--
-- ── Qué pasa si el job no corre ─────────────────────────────
-- Nada se rompe: el sitio sigue cotizando la pública anterior (con la 0458 ya
-- aplicada, aunque esté vencida), que es el criterio del founder del
-- 2026-09-17: «se mantiene el precio anterior». Se pierde la subida, no la
-- calculadora. /studio/tarifas marca la programada atrasada.
--
-- ── Qué NO hace ─────────────────────────────────────────────
-- No toca `public_cbm_rate` (0458, aplicada 2026-09-18), ni el índice de 0255,
-- ni `rates_guard_price_book` (0382), ni una sola fila existente: la columna
-- nace en false para todas. Tampoco cierra el `valid_until` de la tarifa
-- relevada: queda como histórico, igual que dejó la 0336 a la de $800.
--
-- Idempotente: add column if not exists · constraint condicional · create
-- index if not exists · create or replace · cron.schedule con nombre (pg_cron
-- actualiza el job existente en vez de duplicarlo).
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.rates') is null
     or to_regclass('public.price_books') is null then
    raise exception '0459 requiere public.rates y public.price_books (migr 0382)';
  end if;

  if to_regclass('public.rates_one_public_cbm_per_tenant_modo') is null then
    raise exception
      '0459 se apoya en el índice rates_one_public_cbm_per_tenant_modo (migr 0255) y no existe';
  end if;

  if to_regprocedure('public.public_cbm_rate(text)') is null then
    raise exception '0459 requiere public.public_cbm_rate(text) (migr 0255/0458)';
  end if;

  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise exception '0459 requiere pg_cron: el relevo lo corre un job programado';
  end if;
end;
$preflight$;

-- ─────────────────────────────────────────────────────────────
-- 1) La ranura programada
-- ─────────────────────────────────────────────────────────────

alter table public.rates
  add column if not exists publica_programada boolean not null default false;

comment on column public.rates.publica_programada is
  'SDD-0478: esta tarifa reemplaza a la pública del calculador de su modalidad (public_calc_modo) el día de su valid_from, en hora de Caracas. Mientras espera no es pública (is_public = false) y el sitio sigue con la vigente. A lo sumo una por tenant y modalidad (rates_one_programada_per_tenant_modo). La promueve promover_tarifas_programadas(), que corre pg_cron cada hora.';

do $check$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rates_publica_programada_check'
  ) then
    -- Una programada tiene que poder servirse el día que entra: precio por
    -- CBM (la RPC descarta per_cbm null) y fecha de arranque (sin ella el job
    -- no sabría cuándo). Y no puede ser pública y programada a la vez.
    alter table public.rates
      add constraint rates_publica_programada_check
      check (
        not publica_programada
        or (not is_public and per_cbm is not null and valid_from is not null)
      );
  end if;
end;
$check$;

create unique index if not exists rates_one_programada_per_tenant_modo
  on public.rates (tenant_id, public_calc_modo)
  where publica_programada and deleted_at is null;

comment on index public.rates_one_programada_per_tenant_modo is
  'SDD-0478: a lo sumo UNA tarifa programada por tenant y modalidad. Sin esto, dos programadas para la misma modalidad obligarían al job a elegir entre ellas. El aviso de /studio/tarifas reconoce el 23505 por el nombre de este índice.';

-- ─────────────────────────────────────────────────────────────
-- 2) El candado de la ranura
--    · Archivar o borrar suelta la programación: lo que salió del catálogo no
--      puede entrar solo al sitio.
--    · Un borrador no se programa: el job sólo promueve publicadas, así que un
--      borrador programado sería una promesa que nunca se cumple.
--    · Sólo la lista de la casa: es la regla de 0382 para la pública, aplicada
--      acá ANTES de que el job choque con ella a medianoche.
-- ─────────────────────────────────────────────────────────────

create or replace function public.rates_guard_publica_programada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_es_casa boolean;
begin
  if new.status = 'archived' or new.deleted_at is not null then
    new.publica_programada := false;
    return new;
  end if;

  if not new.publica_programada then
    return new;
  end if;

  if new.status <> 'published' then
    raise exception
      'Una tarifa en borrador no puede programarse como la pública del sitio: publícala primero'
      using errcode = '23514';
  end if;

  select pb.is_house into v_es_casa
    from public.price_books pb
   where pb.id = new.price_book_id
     and pb.deleted_at is null;

  if not coalesce(v_es_casa, false) then
    raise exception
      'Sólo una tarifa de la lista de la casa puede programarse como la pública del sitio'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.rates_guard_publica_programada() is
  'SDD-0478: archivar o borrar una tarifa suelta su programación; un borrador o una tarifa de un aliado no pueden programarse como la pública del sitio. Corre después de rates_guard_price_book_t (orden alfabético de triggers), que ya rellenó price_book_id.';

revoke all on function public.rates_guard_publica_programada() from public, anon, authenticated;

drop trigger if exists rates_guard_publica_programada_t on public.rates;
create trigger rates_guard_publica_programada_t
  before insert or update of publica_programada, price_book_id, tenant_id, status, deleted_at
  on public.rates
  for each row execute function public.rates_guard_publica_programada();

-- ─────────────────────────────────────────────────────────────
-- 3) El relevo
-- ─────────────────────────────────────────────────────────────

create or replace function public.promover_tarifas_programadas()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy        date := (now() at time zone 'America/Caracas')::date;
  v_row        record;
  v_relevadas  integer;
  v_promovidas jsonb := '[]'::jsonb;
begin
  -- `for update` bloquea la programada: si dos corridas se cruzan (el job y
  -- una llamada manual), la segunda espera y, al releer la fila, ya no la
  -- encuentra programada. El guard ya impide borradores y borradas en la
  -- ranura; los filtros de `status` y `deleted_at` son la red por si alguien
  -- carga datos saltando el trigger: promover un borrador dejaría el sitio sin
  -- tarifa, porque la RPC no los sirve.
  for v_row in
    select r.id, r.tenant_id, r.public_calc_modo, r.per_cbm, r.valid_from
      from public.rates r
     where r.publica_programada
       and r.deleted_at is null
       and r.status = 'published'
       and r.valid_from <= v_hoy
     order by r.tenant_id, r.public_calc_modo
     for update
  loop
    -- Primero se despublica la vigente: el índice singleton no admite dos.
    -- Sólo la que tiene precio: las públicas con per_cbm null no ocupan la
    -- ranura del índice ni las sirve la RPC, así que no se tocan. La
    -- programada nunca cae acá: el check le prohíbe ser pública.
    update public.rates p
       set is_public = false
     where p.tenant_id = v_row.tenant_id
       and p.public_calc_modo = v_row.public_calc_modo
       and p.is_public
       and p.deleted_at is null
       and p.per_cbm is not null;
    get diagnostics v_relevadas = row_count;

    -- En la misma sentencia deja de ser programada: el check no admite las
    -- dos marcas a la vez.
    update public.rates
       set is_public = true,
           publica_programada = false
     where id = v_row.id;

    v_promovidas := v_promovidas || jsonb_build_array(jsonb_build_object(
      'rate_id', v_row.id,
      'modo', v_row.public_calc_modo,
      'per_cbm', v_row.per_cbm,
      'valid_from', v_row.valid_from,
      'relevadas', v_relevadas
    ));
  end loop;

  return jsonb_build_object('hoy_caracas', v_hoy, 'promovidas', v_promovidas);
end;
$$;

comment on function public.promover_tarifas_programadas() is
  'SDD-0478: para cada tarifa programada cuyo valid_from ya llegó (día de Caracas), despublica la pública con precio de su modalidad y publica la programada, en una sola transacción. Devuelve lo que hizo (queda en cron.job_run_details). Idempotente: sin programadas vencidas no toca nada. La corre pg_cron cada hora (job tarifas-programadas-relevo).';

revoke all on function public.promover_tarifas_programadas() from public, anon, authenticated;
grant execute on function public.promover_tarifas_programadas() to service_role;

-- Cada hora al minuto 5 (UTC). La que cae a las 04:05 UTC es la de las 00:05
-- de Caracas: la primera del día de arranque. Las demás son la red por si una
-- corrida falla.
select cron.schedule(
  'tarifas-programadas-relevo',
  '5 * * * *',
  $job$select public.promover_tarifas_programadas();$job$
);
