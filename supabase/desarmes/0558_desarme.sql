-- SDD-0626 · Desarme de la 0558: vuelve a la regla de conteo de la 0549 y quita los cierres.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: supabase/tests/0558_oficina_casillas_tres_estados.test.sql y
--   lib/studio/__tests__/oficina-casillas.migration.test.ts.
--
-- QUITA office_revisar_borrador_v2, office_registrar_cierre, office_conversaciones_por_cerrar,
-- office_cierres (y sus filas: se pierden los cierres) y los cuatro checks de criterio 2; VUELVE
-- office_conteo_revisiones al cuerpo de la 0549.
-- NO VUELVE las casillas a NOT NULL ni quita la columna regla_casillas: las revisiones de criterio 2 ya
-- guardadas tienen null y la tabla es de solo agregar. Con el cuerpo de la 0549, el conteo trata esas
-- filas como lo hacía la 0549 (un null no hace correcta la conversación). La página vuelve a la 0549
-- solo con el código anterior (sin la 0558, el código nuevo dice «Falta la migración 0558»).
-- ORDEN: antes que el desarme de la 0549. El DROP TABLE lo hace el dueño (postgres) en su propia sesión.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop function if exists public.office_conversaciones_por_cerrar(smallint);
drop function if exists public.office_registrar_cierre(text, boolean, text, smallint);
drop function if exists public.office_revisar_borrador_v2(uuid, text, boolean, boolean, boolean, boolean, text, smallint);
drop table if exists public.office_cierres;
alter table public.office_revisiones
  drop constraint if exists office_revisiones_criterio2_rechazo_marca,
  drop constraint if exists office_revisiones_criterio2_aprobar_exige,
  drop constraint if exists office_revisiones_criterio2_sin_cierre;

-- office_conteo_revisiones con el cuerpo de la 0549 (copiado tal cual).
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
             pg_catalog.bool_and(r.c_acuse and r.c_guion_o_escalado and r.c_cero_inventados
                                 and r.c_pii_no_repetida and r.c_cierre_3) as correcta,
             pg_catalog.bool_or(not r.c_cero_inventados) as inventada
        from public.office_revisiones r
        join public.office_tasks t on t.id = r.task_id
       where r.etapa = p_etapa
       group by 1
    ), totales as (
      select pg_catalog.count(*)::integer as n,
             (pg_catalog.count(*) filter (where correcta))::integer as ok,
             (pg_catalog.count(*) filter (where inventada))::integer as inv
        from por_conv
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

notify pgrst, 'reload schema';
