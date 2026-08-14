-- 0370_lote_legado_solo_vendedor.sql — SDD-0258
--
-- AFINA QUÉ CUENTA COMO "CÓDIGO DE VENDEDOR" EN EL LOTE.
--
-- La migr 0369 barría con `^DTD-[A-Za-z]`, y eso arrastraba dos fichas que NO
-- son de ningún vendedor: `DTD-LEG-SN01` y `DTD-LEG-SN02`. Decisión del founder
-- (2026-08-14): quedan fuera del lote.
--
-- SE AFINA EL PATRÓN EN VEZ DE PONER UNA LISTA NEGRA. Un código de vendedor es
-- `DTD-` + UNA letra + un DÍGITO: `DTD-A101`, `DTD-j029`, `DTD-Y053`. Las `LEG`
-- llevan tres letras, así que no matchean. Una lista negra (`!~ '^DTD-LEG'`)
-- habría tapado estos dos casos y dejado pasar el próximo que aparezca.
--
-- ⚠️ EL PATRÓN NO SE ANCLA AL FINAL, Y ES A PROPÓSITO. En prod hay una ficha
-- `DTD-A102-`, con un guion de más: es de la serie A y tiene que migrar igual.
-- Con `^DTD-[A-Za-z]\d+$` se habría quedado fuera EN SILENCIO. Medido hoy:
--   `^DTD-[A-Za-z]`      → 363 (mete las dos LEG)
--   `^DTD-[A-Za-z]\d+$`  → 360 (deja fuera las LEG y también DTD-A102-)
--   `^DTD-[A-Za-z]\d`    → 361 ✅ (sólo deja fuera las dos LEG)
--
-- Sólo cambia el predicado. El resto del cuerpo es idéntico al de la 0369, que
-- se leyó VIVO antes de este create or replace.

create or replace function public.rename_legacy_markboxes(
  p_batch   int     default 50,
  p_dry_run boolean default true,
  p_reason  text    default 'migración del código de vendedor a la serie de la casa'
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

  select coalesce(max((regexp_match(m, '^DTD-(\d+)$'))[1]::int), 0)
    into v_max
    from (
      select markbox as m from public.clients where tenant_id = v_tenant
      union all
      select markbox as m from public.client_markbox_history where tenant_id = v_tenant
    ) s;

  for r in
    select c.id, c.markbox
      from public.clients c
     where c.tenant_id = v_tenant
       and c.deleted_at is null
       and c.merged_into_client_id is null
       and c.aliado_id is null
       -- UNA letra + un DÍGITO. Ver la cabecera: ni ancla al final (perdería
       -- `DTD-A102-`) ni lista negra (taparía sólo los casos conocidos).
       and c.markbox ~ '^DTD-[A-Za-z]\d'
     order by c.markbox
     limit p_batch
  loop
    v_max := v_max + 1;
    v_nuevo := 'DTD-' || lpad(v_max::text, 4, '0');

    if not p_dry_run then
      perform public.rename_client_markbox(r.id, v_nuevo, p_reason);
      v_hechos := v_hechos + 1;
    end if;

    v_rows := v_rows || jsonb_build_object('de', r.markbox, 'a', v_nuevo);
  end loop;

  select count(*) into v_pend
    from public.clients c
   where c.tenant_id = v_tenant
     and c.deleted_at is null
     and c.merged_into_client_id is null
     and c.aliado_id is null
     and c.markbox ~ '^DTD-[A-Za-z]\d';

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
  'Pasa por lotes las fichas con código de VENDEDOR del legado (DTD-<letra><dígitos>, 361 en 2026-08-14) a la serie limpia de la casa, delegando en rename_client_markbox(). Las DTD-LEG-* NO entran: no son de ningún vendedor. Arranca en simulacro. SDD-0258.';

revoke all on function public.rename_legacy_markboxes(int, boolean, text) from public, anon, service_role;
grant execute on function public.rename_legacy_markboxes(int, boolean, text) to authenticated;
