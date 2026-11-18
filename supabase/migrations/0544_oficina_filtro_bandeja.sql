-- ─────────────────────────────────────────────────────────────────────────────
-- 0544 · SDD-0626 §3.3 — El filtro nivel 1 de la bandeja del cable.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK de Sam NOMBRANDO este archivo, el runbook aplicar-migraciones-prod y el
--    Director General. Fusionar la PR NO autoriza aplicarla.
--    REQUIERE la 0541 (event_inbox y office_esta_pausada()): su preflight para si falta.
--    ORDEN: después de la 0541. El código del Paso 2 funciona con o sin ella: sin
--    la 0541 o sin la 0544, el webhook y el filtro no hacen nada y lo anotan una vez en el log.
--
-- ── Por qué existe ──────────────────────────────────────────
-- §3.3 pide «cuota 20/hora al triaje». Para contar lo que pasó en la última hora
-- hace falta saber CUÁNDO pasó cada evento a «triaje», y event_inbox solo guarda
-- cuándo llegó (ts): un evento que esperó 2 h en «nuevo» y hoy pasa no contaría
-- contra la cuota. Y contar-y-mover desde el ERP tiene una carrera entre dos
-- corridas del filtro. Las dos cosas se resuelven en la base.
--
-- ── Qué crea ────────────────────────────────────────────────
-- 1. event_inbox.triaje_en (timestamptz, null): cuándo pasó a «triaje». Solo lo
--    escribe office_filtrar_bandeja(): service_role NO recibe UPDATE sobre la columna.
-- 2. office_filtrar_bandeja(p_cuota integer default 20): el filtro nivel 1 (0 tokens).
--    · Con office_esta_pausada() en verdadero no mueve nada y devuelve 0.
--    · Toma un candado de aviso (pg_advisory_xact_lock): dos corridas a la vez no
--      pueden pasarse de la cuota.
--    · Cuenta los eventos que pasaron a «triaje» en la última hora, y pasa como
--      máximo (cuota − contados) de los que están en «nuevo», primero los de
--      mayor prioridad (3 dinero > 2 cliente > 1 interno) y, a igual prioridad,
--      los más viejos. NO descarta nada: lo que no cabe se queda en «nuevo» y
--      espera a la hora siguiente.
--    · Devuelve cuántos pasó. SECURITY DEFINER, search_path vacío, solo service_role.
--    · El dedupe por clave (AC-4) ya lo hace la base: clave_dedupe es ÚNICA (0541),
--      así que la misma clave no entra dos veces, ni dentro de 30 min ni después.
--
-- ── Qué NO toca ──────────────────────────────────────────────
-- Ninguna tabla, función, policy ni grant existente, salvo agregar una columna a
-- event_inbox. RLS y privilegios de las cuatro tablas del cable quedan como los dejó la 0541.
--
-- ── Locks ───────────────────────────────────────────────────
-- ALTER TABLE ... ADD COLUMN sin default sobre event_inbox: ACCESS EXCLUSIVE un instante,
-- sin reescribir la tabla. La 0541 no está aplicada en ningún entorno: la tabla está vacía.
--
-- ── Deshacer ────────────────────────────────────────────────
-- supabase/desarmes/0544_desarme.sql (sin número; usarlo exige OK nominal de Sam).
-- Pierde la hora en que cada evento pasó a «triaje»; las filas quedan.
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.event_inbox') is null then
    raise exception '0544 requiere la 0541 (public.event_inbox)';
  end if;
  if pg_catalog.to_regprocedure('public.office_esta_pausada()') is null then
    raise exception '0544 requiere la 0541 (public.office_esta_pausada())';
  end if;
end
$preflight$;

-- ─── 1. Cuándo pasó a triaje ─────────────────────────────────
alter table public.event_inbox add column if not exists triaje_en timestamptz;

comment on column public.event_inbox.triaje_en is
  'SDD-0626 §3.3: cuándo pasó a «triaje». Solo lo escribe office_filtrar_bandeja(); sirve para contar la cuota de 20 por hora.';

-- Para contar la cuota de la última hora sin recorrer toda la bandeja.
create index if not exists event_inbox_triaje_en_idx
  on public.event_inbox (triaje_en)
  where triaje_en is not null;

-- ─── 2. El filtro nivel 1 ────────────────────────────────────
create or replace function public.office_filtrar_bandeja(p_cuota integer default 20)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_usados integer;
  v_libres integer;
  v_pasados integer;
begin
  if p_cuota is null or p_cuota not between 0 and 1000 then
    raise exception 'office_filtrar_bandeja: la cuota va de 0 a 1000' using errcode = '22023';
  end if;
  -- Pausada (o sin la bandera): el filtro no mueve nada. Falla cerrado, como la bandera.
  if public.office_esta_pausada() then
    return 0;
  end if;
  -- Una corrida a la vez: sin esto, dos corridas leerían los mismos «usados» y se pasarían de la cuota.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('office_filtrar_bandeja'));

  select pg_catalog.count(*) into v_usados
    from public.event_inbox
   where triaje_en > pg_catalog.now() - interval '1 hour';
  v_libres := greatest(p_cuota - v_usados, 0);
  if v_libres = 0 then
    return 0;
  end if;

  with elegidos as (
    select e.id
      from public.event_inbox e
     where e.estado = 'nuevo'
     order by e.prioridad desc, e.ts asc, e.id asc
     limit v_libres
       for update skip locked
  )
  update public.event_inbox e
     set estado = 'triaje',
         triaje_en = pg_catalog.now()
    from elegidos
   where e.id = elegidos.id;
  get diagnostics v_pasados = row_count;
  return v_pasados;
end;
$function$;

alter function public.office_filtrar_bandeja(integer) owner to postgres;
revoke all on function public.office_filtrar_bandeja(integer) from public, anon, authenticated, service_role;
grant execute on function public.office_filtrar_bandeja(integer) to service_role;

comment on function public.office_filtrar_bandeja(integer) is
  'SDD-0626 §3.3: filtro nivel 1 (0 tokens). Pasa a «triaje» como máximo (cuota − los de la última hora) eventos «nuevo», '
  'primero los de mayor prioridad y los más viejos. No descarta nada. Con office_esta_pausada() no mueve nada. '
  'Solo la ejecuta service_role.';

-- ─── 3. Postflight ───────────────────────────────────────────
do $postflight$
begin
  if not exists (
    select 1 from pg_catalog.pg_proc p
     where p.oid = pg_catalog.to_regprocedure('public.office_filtrar_bandeja(integer)')
       and p.prosecdef
       and p.proconfig @> array['search_path=""']
  ) then
    raise exception '0544 postflight: office_filtrar_bandeja sin search_path vacío o sin SECURITY DEFINER';
  end if;
  if pg_catalog.has_function_privilege('anon', 'public.office_filtrar_bandeja(integer)', 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.office_filtrar_bandeja(integer)', 'EXECUTE') then
    raise exception '0544 postflight: office_filtrar_bandeja ejecutable por quien no debía';
  end if;
  if not pg_catalog.has_function_privilege('service_role', 'public.office_filtrar_bandeja(integer)', 'EXECUTE') then
    raise exception '0544 postflight: service_role no puede ejecutar office_filtrar_bandeja';
  end if;
  -- La hora de triaje la pone solo la función: service_role no la escribe.
  if pg_catalog.has_column_privilege('service_role', 'public.event_inbox', 'triaje_en', 'INSERT')
     or pg_catalog.has_column_privilege('service_role', 'public.event_inbox', 'triaje_en', 'UPDATE') then
    raise exception '0544 postflight: service_role puede escribir event_inbox.triaje_en';
  end if;
  if pg_catalog.has_any_column_privilege('anon', 'public.event_inbox', 'SELECT')
     or pg_catalog.has_any_column_privilege('authenticated', 'public.event_inbox', 'SELECT') then
    raise exception '0544 postflight: anon o authenticated alcanzan event_inbox';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';
