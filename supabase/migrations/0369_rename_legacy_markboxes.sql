-- 0369_rename_legacy_markboxes.sql — SDD-0258
--
-- MIGRACIÓN POR LOTE DE LOS CÓDIGOS DEL LEGADO.
--
-- Quedan 364 fichas con la serie de VENDEDOR (`DTD-A101`, `DTD-j029`…), de una
-- época sin gobernanza de códigos: cada vendedor tenía su letra (A=Darilis,
-- J=José, D=Darín, Y=Yeglenis, P=Pedro). El concepto está muerto y el founder
-- quiere pasarlas a la serie limpia de la casa.
--
-- ⚠️ SON 364, NO 351. Las otras 13 llevan la letra en MINÚSCULA (`DTD-j029`), y
-- un patrón sensible a mayúsculas las deja fuera en silencio. Medido en prod el
-- 2026-08-14. El predicado de acá usa `[A-Za-z]` justamente por eso.
--
-- POR QUÉ NO ES UN UPDATE MASIVO. Cada renombrado tiene que jubilar el código
-- viejo y mover las 33 copias, y eso ya lo resuelve `rename_client_markbox()`
-- (migr 0367). Esta función NO reimplementa nada: elige a quién le toca, calcula
-- el código nuevo y delega. Un UPDATE masivo se saltaría los guards, el
-- historial y la reserva del código viejo — o sea, exactamente las tres cosas
-- que hacen que renombrar sea seguro.
--
-- POR QUÉ EN LOTES Y NO LOS 364 DE UN TIRO. Cada renombrado toca 30 tablas; 364
-- de golpe son ~11.000 sentencias con el lock de `clients` tomado todo el rato.
-- En lotes se puede parar, mirar y seguir — y si algo falla, se pierde un lote,
-- no la operación entera.
--
-- 🔒 ARRANCA EN SIMULACRO. `p_dry_run` es `true` por defecto: la llamada normal
-- NO escribe, sólo devuelve el mapeo viejo→nuevo para revisarlo. Hay que pedir
-- explícitamente `p_dry_run => false` para que toque algo.

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
  -- Sólo admin: un lote mueve cientos de fichas de una vez. El renombrado de a
  -- uno sí lo puede hacer comercial u operaciones (migr 0367).
  perform public.assert_studio_role(array['admin']);

  if p_batch is null or p_batch < 1 or p_batch > 500 then
    raise exception 'El tamaño del lote va entre 1 y 500' using errcode = '22023';
  end if;

  v_tenant := public.get_user_tenant_id();
  if v_tenant is null then
    raise exception 'Authenticated tenant required' using errcode = '42501';
  end if;

  -- El punto de partida del correlativo, mirando `clients` ∪ historial para no
  -- reemitir nada retirado (misma regla que next_markbox tras la migr 0367).
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
       -- Un cliente de aliado lleva la cadena de su aliado: renumerarlo a la
       -- serie de la casa lo sacaría de su insignia. Fuera de este lote.
       and c.aliado_id is null
       and c.markbox ~ '^DTD-[A-Za-z]'
     order by c.markbox
     limit p_batch
  loop
    v_max := v_max + 1;
    v_nuevo := 'DTD-' || lpad(v_max::text, 4, '0');

    if not p_dry_run then
      -- Delegación, no copia: los guards, el historial y la reserva del código
      -- viejo viven en rename_client_markbox().
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
     and c.markbox ~ '^DTD-[A-Za-z]';

  return jsonb_build_object(
    'simulacro', p_dry_run,
    'en_este_lote', jsonb_array_length(v_rows),
    'renombrados', v_hechos,
    -- En simulacro `pendientes` incluye a los que se acaban de listar, porque
    -- nada se tocó. Decirlo evita leer el número como si ya faltaran menos.
    'pendientes_despues', v_pend,
    'mapeo', v_rows
  );
end;
$function$;

comment on function public.rename_legacy_markboxes(int, boolean, text) is
  'Pasa por lotes las fichas con código de VENDEDOR del legado (DTD-<letra>NNN, 364 en 2026-08-14) a la serie limpia de la casa, delegando cada renombrado en rename_client_markbox(). Arranca en simulacro: hay que pedir p_dry_run => false para que escriba. SDD-0258.';

revoke all on function public.rename_legacy_markboxes(int, boolean, text) from public, anon, service_role;
grant execute on function public.rename_legacy_markboxes(int, boolean, text) to authenticated;
