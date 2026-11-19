-- ─────────────────────────────────────────────────────────────────────────────
-- 0565 · SDD-0675 — La Bandeja se puede dar como acceso adicional por persona.
--
-- ⚠️ NO APLICADA EN NINGÚN ENTORNO. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla en
--    producción exige el OK de Sam NOMBRANDO este archivo, el runbook
--    aplicar-migraciones-prod y el Director General. Fusionar la PR NO
--    autoriza aplicarla. REQUIERE la 0538 (accesos adicionales por persona).
--
-- POR QUÉ: Sam (2026-11-18) decidió que una persona de la oficina vea la Bandeja
-- con Leads y Clientes sin cambiarle el rol (SDD-0671 §3.2, opción D; SDD-0675).
-- La 0538 dice que ampliar la lista de módulos concedibles «va con su migración».
--
-- QUÉ HACE: `create or replace` de `studio_module_is_grantable(text)` con la
-- misma firma, el mismo lenguaje y los mismos atributos, sumando 'bandeja' a la
-- lista de la 0538. `create or replace` conserva el dueño y los privilegios
-- (EXECUTE de authenticated y service_role; sin public ni anon).
--
-- NO escribe filas ni toca tablas: es una función `immutable` sin datos. No toma
-- locks de tablas. La RLS que habla de la Bandeja ya decide con
-- `user_has_module('bandeja')`, que suma el extra (0538, 0540, 0554).
--
-- La app funciona con o sin ella: sin la 0565, la RPC `studio_grant_user_module`
-- rechaza conceder `bandeja` y Usuarios muestra su error de siempre.
-- Desarme: supabase/desarmes/0565_desarme.sql.
-- ─────────────────────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

-- La lista vigente se lee de dos maneras: preguntando por cada módulo esperado
-- y sacando los literales del cuerpo de la función. Lo segundo detecta un
-- módulo de más, que preguntar por los esperados no ve.
do $preflight$
declare
  v_esperada text[] := array['kommo', 'clients', 'quotes', 'sales-orders', 'purchase-orders', 'conversaciones', 'rates', 'suppliers'];
  v_literales text[];
begin
  if pg_catalog.to_regprocedure('public.studio_module_is_grantable(text)') is null
     or pg_catalog.to_regclass('public.studio_user_module_grants') is null then
    raise exception '0565 requiere la 0538 (studio_module_is_grantable y studio_user_module_grants)';
  end if;
  if public.studio_module_is_grantable('bandeja') then
    raise exception '0565: bandeja ya es concedible; no se reaplica';
  end if;
  select coalesce(array_agg(l[1] order by l[1] collate "C"), '{}') into v_literales
  from regexp_matches(
    (select p.prosrc from pg_catalog.pg_proc p where p.oid = 'public.studio_module_is_grantable(text)'::regprocedure),
    '''([^'']*)''', 'g') as l;
  if exists (select 1 from unnest(v_esperada) as m(id) where not public.studio_module_is_grantable(m.id))
     or v_literales is distinct from (select array_agg(x order by x collate "C") from unnest(v_esperada) as x)
     or public.studio_module_is_grantable('admin') or public.studio_module_is_grantable('users') then
    raise exception '0565: studio_module_is_grantable no tiene la lista de la 0538';
  end if;
end;
$preflight$;

create or replace function public.studio_module_is_grantable(p_module_id text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_module_id = any (array[
    'kommo', 'clients', 'quotes', 'sales-orders', 'purchase-orders', 'conversaciones', 'rates', 'suppliers',
    'bandeja'
  ]::text[])
$$;

comment on function public.studio_module_is_grantable(text) is
  'SDD-0622 y SDD-0675: COVERED de lib/studio/user-module-grants.ts. Solo estos módulos se conceden como extra; la prueba compara la lista vigente con el código.';

do $postflight$
declare
  v_esperada text[] := array['kommo', 'clients', 'quotes', 'sales-orders', 'purchase-orders', 'conversaciones', 'rates', 'suppliers', 'bandeja'];
  v_literales text[];
begin
  -- Los 8 módulos de la 0538 siguen, uno por uno, se suma bandeja y no hay
  -- ninguno de más (los literales del cuerpo son exactamente esos 9).
  select coalesce(array_agg(l[1] order by l[1] collate "C"), '{}') into v_literales
  from regexp_matches(
    (select p.prosrc from pg_catalog.pg_proc p where p.oid = 'public.studio_module_is_grantable(text)'::regprocedure),
    '''([^'']*)''', 'g') as l;
  if exists (select 1 from unnest(v_esperada) as m(id) where not public.studio_module_is_grantable(m.id))
     or v_literales is distinct from (select array_agg(x order by x collate "C") from unnest(v_esperada) as x)
     or public.studio_module_is_grantable('admin')
     or public.studio_module_is_grantable('users') then
    raise exception '0565: la lista de módulos concedibles no quedó como se esperaba';
  end if;
  if has_function_privilege('anon', 'public.studio_module_is_grantable(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.studio_module_is_grantable(text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.studio_module_is_grantable(text)', 'EXECUTE') then
    raise exception '0565: los privilegios de studio_module_is_grantable cambiaron';
  end if;
end;
$postflight$;
