-- 0379_legado_al_rango_8000.sql — SDD-0258
--
-- EL LEGADO SE VA AL RANGO 8000, SEPARADO DE LA SERIE VIVA DE LA CASA.
--
-- Decisión del founder (2026-08-14), y el número que la sostiene: tal como
-- estaba, CADA cliente viejo migrado empujaba el correlativo de la casa. Se
-- arrancó en `DTD-9065` y con 150 migrados ya iba en `DTD-9225`. Terminar los
-- 361 lo habría dejado en ~`DTD-9429` — o sea que el próximo cliente REAL, uno
-- que llega mañana y paga, arrancaría en 9430 porque 361 fichas del legado se
-- comieron los números del medio.
--
-- Con el legado en el 8000 eso se acaba:
--   `DTD-8001`..`DTD-8361` → legado, se reconoce de un vistazo
--   `DTD-9xxx`             → serie viva de la casa, sin saltos
-- Medido antes de escribir: los rangos 7000 y 8000 estaban COMPLETAMENTE libres
-- (0 códigos vivos y 0 jubilados).
--
-- ⭐ QUÉ CUENTA COMO "DEL LEGADO", Y POR QUÉ NO ES EL CÓDIGO ACTUAL.
-- Hoy hay 160 fichas que YA se migraron y llevan un `DTD-9xxx`, pero vienen del
-- legado. Definir el grupo por el código de HOY las dejaría fuera y el trabajo
-- quedaría a medias: 201 en el 8000 y 160 en el 9000. Así que el criterio es
--   «tiene AHORA un código de vendedor  O  TUVO uno alguna vez»,
-- y el historial es justamente lo que permite saberlo. Los 63 clientes que
-- SIEMPRE fueron `DTD-9xxx` no tienen ese rastro y no se tocan.
--
-- El orden respeta la serie del vendedor (A, D, J, P, Y) usando el código
-- ORIGINAL —el más viejo del historial, o el actual si nunca cambió—, para que
-- las series no queden entreveradas.
--
-- Cuerpo base leído VIVO antes de este create or replace (regla de la 0361).
-- Sólo cambian el predicado, el orden y el cálculo del código nuevo.

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

  -- El correlativo del LEGADO vive en su propio rango. Mira `clients` ∪ historial
  -- para no reemitir nada retirado, igual que el de la casa.
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
           -- El código ORIGINAL de vendedor: el más viejo del historial, o el
           -- actual si nunca se renombró. Sirve para ordenar por serie.
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
       -- Un aliado lleva su insignia en la ficha (migr 0371): fuera del lote.
       and not exists (
         select 1 from public.aliados a
          where a.client_id = c.id and a.deleted_at is null
       )
       -- Ya está en su rango: nada que hacer.
       and c.markbox !~ '^DTD-8\d{3}$'
       -- ⭐ Del legado = tiene AHORA un código de vendedor, O TUVO uno.
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

  select count(*) into v_pend
    from public.clients c
   where c.tenant_id = v_tenant
     and c.deleted_at is null
     and c.merged_into_client_id is null
     and c.aliado_id is null
     and not exists (select 1 from public.aliados a where a.client_id = c.id and a.deleted_at is null)
     and c.markbox !~ '^DTD-8\d{3}$'
     and (
       c.markbox ~ '^DTD-[A-Za-z]\d'
       or exists (select 1 from public.client_markbox_history h2
                   where h2.client_id = c.id and h2.markbox ~ '^DTD-[A-Za-z]\d')
     );

  return jsonb_build_object(
    'simulacro', p_dry_run,
    'en_este_lote', jsonb_array_length(v_rows),
    'renombrados', v_hechos,
    'pendientes_despues', v_pend,
    'mapeo', v_rows
  );
end;
$function$;

comment on function public.rename_legacy_markboxes(int, boolean, text) is
  'Manda las fichas del LEGADO al rango DTD-8xxx, separado de la serie viva de la casa (DTD-9xxx), delegando cada renombrado en rename_client_markbox(). "Del legado" = tiene ahora un código de vendedor O TUVO uno (el historial lo delata), así que también recoge las que ya se habían movido al 9000 por error. Los clientes que siempre fueron DTD-9xxx no se tocan. Arranca en simulacro. SDD-0258.';

revoke all on function public.rename_legacy_markboxes(int, boolean, text) from public, anon, service_role;
grant execute on function public.rename_legacy_markboxes(int, boolean, text) to authenticated;
