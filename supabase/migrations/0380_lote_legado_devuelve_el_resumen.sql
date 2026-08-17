-- 0380_lote_legado_devuelve_el_resumen.sql — SDD-0258
--
-- LA PANTALLA DEJA DE TENER SU PROPIA DEFINICIÓN DE "DEL LEGADO".
--
-- Hasta hoy el contador y el desglose por serie los calculaba
-- `lib/studio/markbox-legacy-queries.ts` con un patrón propio en JavaScript,
-- en paralelo a esta función. Dos definiciones de la misma regla — y se
-- desincronizaron en CUATRO HORAS: cuando la migr 0379 pasó el criterio a
-- «tiene AHORA un código de vendedor O TUVO uno», la pantalla se quedó mirando
-- sólo el código de hoy y marcaba 201 donde la base contaba 361. Un contador que
-- miente en la pantalla desde la que se aprueba una migración masiva.
--
-- Mismo remedio que la migr 0371 con la regla de la insignia: UNA definición y
-- varios llamadores. Acá la función devuelve además `por_serie`, calculado con
-- EXACTAMENTE el mismo predicado que elige a quién migrar, así que el número que
-- se ve y el trabajo que se hace no pueden discrepar.
--
-- La serie se lee del código ORIGINAL de vendedor (el más viejo del historial, o
-- el actual si nunca cambió). Por eso una ficha que ya pasó por el 9000 sigue
-- contando en su serie de siempre y no aparece como "serie 9".
--
-- Sólo cambia lo que se devuelve. Predicado, orden, candado de admin, rango 8000
-- y delegación quedan idénticos a la 0379, leída VIVA antes de reemplazarla.

create or replace function public.rename_legacy_markboxes(
  p_batch   int     default 50,
  p_dry_run boolean default true,
  p_reason  text    default 'legado: al rango 8000, separado de la serie de la casa'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant   uuid;
  v_max      int;
  v_pend     int;
  v_series   jsonb;
  v_rows     jsonb := '[]'::jsonb;
  v_hechos   int := 0;
  r          record;
  v_nuevo    text;
begin
  perform public.assert_studio_role(array['admin']);

  if p_batch is null or p_batch < 1 or p_batch > 500 then
    raise exception 'El tamaño del lote va entre 1 y 500' using errcode = '22023';
  end if;

  v_tenant := public.get_user_tenant_id();
  if v_tenant is null then
    raise exception 'Authenticated tenant required' using errcode = '42501';
  end if;

  select coalesce(max((regexp_match(m, '^DTD-8(\d{3})$'))[1]::int), 0)
    into v_max
    from (
      select markbox as m from public.clients where tenant_id = v_tenant
      union all
      select markbox as m from public.client_markbox_history where tenant_id = v_tenant
    ) s;

  for r in
    select c.id, c.markbox, c.name,
           exists (
             select 1 from public.client_users cu
              where cu.client_id = c.id and cu.status = 'active'
           ) as tiene_portal,
           coalesce(
             (select h.markbox from public.client_markbox_history h
               where h.client_id = c.id and h.markbox ~ '^DTD-[A-Za-z]\d'
               order by h.retired_at asc limit 1),
             c.markbox
           ) as origen
      from public.clients c
     where c.tenant_id = v_tenant
       and c.deleted_at is null
       and c.merged_into_client_id is null
       and c.aliado_id is null
       and not exists (
         select 1 from public.aliados a
          where a.client_id = c.id and a.deleted_at is null
       )
       and c.markbox !~ '^DTD-8\d{3}$'
       and (
         c.markbox ~ '^DTD-[A-Za-z]\d'
         or exists (
           select 1 from public.client_markbox_history h2
            where h2.client_id = c.id and h2.markbox ~ '^DTD-[A-Za-z]\d'
         )
       )
     order by origen
     limit p_batch
  loop
    v_max := v_max + 1;
    if v_max > 999 then
      raise exception 'El rango 8000 se llenó (DTD-8999). Hace falta decidir el siguiente rango.'
        using errcode = '23514';
    end if;
    v_nuevo := 'DTD-8' || lpad(v_max::text, 3, '0');

    if not p_dry_run then
      perform public.rename_client_markbox(r.id, v_nuevo, p_reason);
      v_hechos := v_hechos + 1;
    end if;

    v_rows := v_rows || jsonb_build_object(
      'de', r.markbox,
      'a', v_nuevo,
      'nombre', r.name,
      'portal', r.tiene_portal
    );
  end loop;

  -- ⭐ Pendientes y desglose, con EL MISMO predicado que elige a quién migrar.
  -- Que salgan de acá es el punto: la pantalla ya no puede contar distinto.
  with pendientes as (
    select coalesce(
             (select h.markbox from public.client_markbox_history h
               where h.client_id = c.id and h.markbox ~ '^DTD-[A-Za-z]\d'
               order by h.retired_at asc limit 1),
             c.markbox
           ) as origen
      from public.clients c
     where c.tenant_id = v_tenant
       and c.deleted_at is null
       and c.merged_into_client_id is null
       and c.aliado_id is null
       and not exists (select 1 from public.aliados a
                        where a.client_id = c.id and a.deleted_at is null)
       and c.markbox !~ '^DTD-8\d{3}$'
       and (
         c.markbox ~ '^DTD-[A-Za-z]\d'
         or exists (select 1 from public.client_markbox_history h2
                     where h2.client_id = c.id and h2.markbox ~ '^DTD-[A-Za-z]\d')
       )
  )
  select count(*),
         coalesce(
           (select jsonb_agg(x order by x->>'fichas' desc)
              from (
                select jsonb_build_object(
                         'serie', upper(substring(origen from 5 for 1)),
                         'fichas', count(*)
                       ) as x
                  from pendientes
                 group by upper(substring(origen from 5 for 1))
              ) g),
           '[]'::jsonb)
    into v_pend, v_series
    from pendientes;

  return jsonb_build_object(
    'simulacro', p_dry_run,
    'en_este_lote', jsonb_array_length(v_rows),
    'renombrados', v_hechos,
    'pendientes_despues', v_pend,
    'por_serie', v_series,
    'mapeo', v_rows
  );
end;
$function$;

comment on function public.rename_legacy_markboxes(int, boolean, text) is
  'Manda las fichas del LEGADO al rango DTD-8xxx, separado de la serie viva de la casa. Devuelve TAMBIÉN el conteo pendiente y el desglose por serie, calculados con el mismo predicado que elige a quién migrar — para que la pantalla no tenga una definición propia que se desincronice. SDD-0258.';

revoke all on function public.rename_legacy_markboxes(int, boolean, text) from public, anon, service_role;
grant execute on function public.rename_legacy_markboxes(int, boolean, text) to authenticated;
