-- SDD-0626 · Desarme de la 0560: vuelve office_conteo_revisiones al cuerpo de la 0558.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: supabase/tests/0560_oficina_acuse_en_escalados.test.sql y
--   lib/studio/__tests__/oficina-acuse-escalado.migration.test.ts.
-- No toca filas. Con el cuerpo de la 0558, un escalado con «Acuse» sin evaluar vuelve a hacer incorrecta su
-- conversación. ORDEN: antes que el desarme de la 0558.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- office_conteo_revisiones con el cuerpo de la 0558 (copiado tal cual).
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
             pg_catalog.bool_and(r.veredicto = 'aprobado' and r.c_acuse is true and r.c_guion_o_escalado is true
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

-- El comentario de la 0558 (copiado tal cual).
comment on function public.office_conteo_revisiones(smallint) is
  'SDD-0626 AC-1 (etapa 1: 10) y AC-7 (etapa 2: 20), regla de la 0558: solo criterio 2; correcta = aprobada con los '
  '4 criterios en cumple y cierre que no falló (etapa 2: cierre que cumple; solo conversaciones con cierre); '
  'inventada = c_cero_inventados false explícito. Solo is_platform_admin().';

notify pgrst, 'reload schema';
