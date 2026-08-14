-- 0373_lote_legado_con_nombre.sql — SDD-0258
--
-- EL SIMULACRO DICE A QUIÉN LE ESTÁS CAMBIANDO EL CÓDIGO.
--
-- El founder corrió el simulacro y pidió esto: "con los puros códigos no
-- identifico quién es". Tiene razón — un mapeo `DTD-A001 → DTD-9065` no le
-- permite a nadie decidir nada. Aprobar a ciegas no es aprobar.
--
-- Se agregan DOS campos al mapeo:
--   · `nombre` — para saber a quién se le está tocando el código.
--   · `portal` — si ese cliente tiene acceso ACTIVO al portal. Ése es el que se
--     entera del cambio: entra y ve un código distinto al que le dimos. Los
--     demás sólo existen en el ERP. No lo pidió, pero es lo que convierte una
--     lista en una decisión.
--
-- Sólo cambia lo que se devuelve. El predicado, el orden, el candado de admin y
-- la delegación en `rename_client_markbox` quedan idénticos a la 0370, que se
-- leyó VIVA antes de este create or replace.

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
    select c.id, c.markbox, c.name,
           exists (
             select 1 from public.client_users cu
              where cu.client_id = c.id and cu.status = 'active'
           ) as tiene_portal
      from public.clients c
     where c.tenant_id = v_tenant
       and c.deleted_at is null
       and c.merged_into_client_id is null
       and c.aliado_id is null
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
  'Pasa por lotes las fichas con código de VENDEDOR del legado (DTD-<letra><dígitos>) a la serie limpia de la casa, delegando en rename_client_markbox(). El mapeo trae nombre y si el cliente tiene portal activo, para poder decidir. Las DTD-LEG-* NO entran. Arranca en simulacro. SDD-0258.';

revoke all on function public.rename_legacy_markboxes(int, boolean, text) from public, anon, service_role;
grant execute on function public.rename_legacy_markboxes(int, boolean, text) to authenticated;
