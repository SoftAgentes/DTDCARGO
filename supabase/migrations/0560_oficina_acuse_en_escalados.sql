-- ─────────────────────────────────────────────────────────────────────────────
-- 0560 · SDD-0626 Paso 3b, etapa 1 — «Acuse» en los escalados.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN NI A NINGÚN OTRO ENTORNO. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla en
--    producción exige el OK nominal de Sam NOMBRANDO este archivo, el runbook
--    aplicar-migraciones-prod y el Director General. Fusionar la PR NO autoriza
--    aplicarla. REQUIERE la 0558 (su preflight para si falta). La 0558 no se toca.
--    La pantalla de esta PR la NECESITA: aplicar la 0560 ANTES de publicar el web
--    (y antes de fusionar). Esa pantalla deja «Acuse» en «No evaluado» en los
--    escalados, justo las filas que hacen abortar el preflight si la 0560 llega
--    después.
--
-- ── Por qué (decisión del DG por delegación de Sam, 17/11/2026) ──────────────
-- Un escalado no lleva respuesta al cliente, así que «Acuse en la primera
-- respuesta» no ocurrió y marcarlo «cumple» ensuciaría el dato que decide el paso
-- de etapa. Con la 0558, un null en cualquier criterio hace incorrecta la
-- conversación: los escalados bien hechos (dinero, intento de sacar datos,
-- enlace, fuera de guion) no podían contar como correctos.
--
-- ── Qué cambia ──────────────────────────────────────────────
-- Solo office_conteo_revisiones(etapa), REEMPLAZADA (misma firma y columnas). Por
-- revisión de criterio 2:
--   · ESCALADO (office_revisiones.tipo_borrador = 'escalado', que la base copia del
--     borrador, nunca el cliente): aprobada, «Acuse» en true o null (false sigue
--     contando como fallo) y las otras tres en true.
--   · RESPUESTA: sin cambios, las cuatro en true.
-- Todo lo demás del conteo queda como en la 0558 (cierres, etapa 2, inventadas).
--
-- ── Supuesto (escrito a pedido del DG) ──────────────────────
-- En producción todavía no hay revisiones de criterio 2: la etapa 1 no empezó y el
-- web de producción corría el código de la #604 (escribe criterio 1). Por eso no
-- hace falta una regla 3: ninguna fila cambia de resultado. El preflight lo
-- comprueba con lo único que cambiaría (criterio 2, escalado, c_acuse null) y, si
-- hay alguna, aborta sin aplicar nada y solo dice cuántas.
--
-- ── Qué NO toca ─────────────────────────────────────────────
-- Ninguna fila, ninguna tabla, ningún check. office_revisar_borrador_v2 sigue igual:
-- aprobar un escalado no exige nada sobre «Acuse» (lo exigido para aprobar, cero
-- inventados y sin datos personales en true, vale solo para las respuestas).
--
-- ── Locks ───────────────────────────────────────────────────
-- Solo CREATE OR REPLACE FUNCTION. lock_timeout 5 s.
--
-- ── Deshacer ────────────────────────────────────────────────
-- supabase/desarmes/0560_desarme.sql (sin número; usarlo exige OK nominal de Sam):
-- vuelve office_conteo_revisiones al cuerpo de la 0558.
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_n integer;
begin
  if pg_catalog.to_regclass('public.office_cierres') is null
     or pg_catalog.to_regprocedure('public.office_conteo_revisiones(smallint)') is null
     or pg_catalog.to_regprocedure('public.office_exigir_admin(text)') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'office_revisiones'
                       and column_name = 'regla_casillas')
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'office_revisiones'
                       and column_name = 'tipo_borrador') then
    raise exception '0560 requiere la 0558 (office_cierres y office_revisiones.regla_casillas) y la 0549 (tipo_borrador)';
  end if;
  -- Ya aplicada (el cuerpo vivo del conteo es EXACTAMENTE el de la 0560: md5 de prosrc): esas filas ya se
  -- cuentan así, nada cambia de resultado. Volver a aplicarla no falla.
  if (select pg_catalog.md5(p.prosrc) from pg_catalog.pg_proc p
       where p.oid = 'public.office_conteo_revisiones(smallint)'::pg_catalog.regprocedure) = 'a936f1ab6c7dd3a58a4c14ce58f9af36' then
    return;
  end if;
  -- Las únicas filas cuyo resultado cambiaría. Solo se cuentan: ningún dato sale en el mensaje.
  select pg_catalog.count(*)::integer into v_n
    from public.office_revisiones r
   where r.regla_casillas = 2 and r.tipo_borrador = 'escalado' and r.c_acuse is null;
  if v_n > 0 then
    raise exception '0560: hay % revisiones de criterio 2 de escalados con «Acuse» sin evaluar; la 0560 cambiaría su resultado. No se aplica: avisar al DG (haría falta una regla 3).', v_n;
  end if;
end
$preflight$;

-- ─── 1. El conteo de AC-1 y AC-7 ─────────────────────────────
-- Como en la 0558, más: en un escalado, «Acuse» en null no cuenta en contra.
create or replace function public.office_conteo_revisiones(p_etapa smallint)
returns table (etapa smallint, conversaciones integer, correctas integer, con_inventados integer,
               minimo integer, minimo_correctas integer, cumple boolean)
language plpgsql
stable
security definer
set search_path = ''
as $function$
#variable_conflict use_column
declare
  v_min integer;
begin
  perform public.office_exigir_admin('office_conteo_revisiones');
  if p_etapa is null or p_etapa not in (1, 2) then
    raise exception 'office_conteo_revisiones: la etapa es 1 o 2' using errcode = '22023';
  end if;
  v_min := case when p_etapa = 1 then 10 else 20 end;
  return query
    with por_conv as (
      select coalesce(pg_catalog.substring(t.entidad_ref, '^chatwoot:conversations/([0-9]+)/'), t.id::text) as conv,
             -- 0560: en un ESCALADO (lo dice tipo_borrador, que escribe la base) «Acuse» en null no cuenta en
             -- contra; en false sí. En una RESPUESTA, las cuatro en true como en la 0558.
             pg_catalog.bool_and(r.veredicto = 'aprobado'
                                 and (r.c_acuse is true or (r.tipo_borrador = 'escalado' and r.c_acuse is null))
                                 and r.c_guion_o_escalado is true
                                 and r.c_cero_inventados is true and r.c_pii_no_repetida is true) as correcta_mensajes,
             pg_catalog.bool_or(r.c_cero_inventados is false) as inventada
        from public.office_revisiones r
        join public.office_tasks t on t.id = r.task_id
       where r.etapa = p_etapa and r.regla_casillas = 2
       group by 1
    ), con_cierre as (
      select p.conv, p.inventada, c.cumple as cierre,
             p.correcta_mensajes and c.cumple is distinct from false
               and (p_etapa = 1 or c.cumple is true) as correcta
        from por_conv p
        left join public.office_cierres c on c.conversacion = p.conv and c.etapa = p_etapa
    ), contadas as (
      select * from con_cierre where p_etapa = 1 or cierre is not null
    ), totales as (
      select pg_catalog.count(*)::integer as n,
             (pg_catalog.count(*) filter (where correcta))::integer as ok,
             (pg_catalog.count(*) filter (where inventada))::integer as inv
        from contadas
    )
    select p_etapa, n, ok, inv, v_min,
           greatest(pg_catalog.ceil(n * 0.9)::integer, pg_catalog.ceil(v_min * 0.9)::integer),
           n >= v_min and ok >= pg_catalog.ceil(n * 0.9) and inv = 0
      from totales;
end;
$function$;

alter function public.office_conteo_revisiones(smallint) owner to postgres;
revoke all on function public.office_conteo_revisiones(smallint) from public, anon, authenticated, service_role;
grant execute on function public.office_conteo_revisiones(smallint) to authenticated;

comment on function public.office_conteo_revisiones(smallint) is
  'SDD-0626 AC-1 (etapa 1: 10) y AC-7 (etapa 2: 20), regla de la 0558 con la 0560: solo criterio 2; correcta = '
  'aprobada con los 4 criterios en cumple (en un escalado, «Acuse» puede quedar sin evaluar) y cierre que no falló '
  '(etapa 2: cierre que cumple; solo conversaciones con cierre); inventada = c_cero_inventados false explícito. '
  'Solo is_platform_admin().';

-- ─── 2. Postflight ───────────────────────────────────────────
do $postflight$
declare
  v_rol text;
  v_def text;
begin
  if not exists (
    select 1 from pg_catalog.pg_proc p
     where p.oid = pg_catalog.to_regprocedure('public.office_conteo_revisiones(smallint)')
       and p.prosecdef and p.proconfig @> array['search_path=""']
  ) then
    raise exception '0560 postflight: office_conteo_revisiones sin search_path vacío o sin SECURITY DEFINER';
  end if;
  foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
    if pg_catalog.has_function_privilege(v_rol, 'public.office_conteo_revisiones(smallint)', 'EXECUTE')
       <> (v_rol = 'authenticated') then
      raise exception '0560 postflight: EXECUTE de % sobre office_conteo_revisiones no es el esperado', v_rol;
    end if;
  end loop;
  v_def := pg_catalog.pg_get_functiondef('public.office_conteo_revisiones(smallint)'::pg_catalog.regprocedure);
  if pg_catalog.strpos(v_def, 'r.tipo_borrador = ''escalado'' and r.c_acuse is null') = 0
     or pg_catalog.strpos(v_def, 'r.regla_casillas = 2') = 0 then
    raise exception '0560 postflight: office_conteo_revisiones no tiene la regla de la 0560';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';
