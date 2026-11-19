-- ─────────────────────────────────────────────────────────────────────────────
-- 0567 · SDD-0626 etapa 1 — exclusiones del conteo y corrección de cierres, de solo agregar.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN NI A NINGÚN OTRO ENTORNO. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla en
--    producción exige el OK nominal de Sam NOMBRANDO este archivo, el runbook
--    aplicar-migraciones-prod y el Director General. Fusionar la PR NO autoriza
--    aplicarla. REQUIERE la 0558 y la 0560 (su preflight para si faltan).
--    Esta migración NO escribe ninguna fila: las primeras (la conversación de la
--    prueba del encendido y las dos correcciones de cierre de la tanda 1) van
--    aparte, con su propio OK nominal de Sam en el chat del DG (runbook §13b).
--
-- ── Por qué (decisión del DG, 18/11/2026) ───────────────────
-- En la tanda 1 de la etapa 1 el conteo quedó en «5 de 10, 1 correctas» por dos
-- cosas que no son del agente:
--   · Una conversación de la prueba del encendido entró al conteo. No es una de
--     las 10 de práctica y no debe contar ni a favor ni en contra.
--   · Dos cierres quedaron guardados como «falló» cuando Sam marcó «cumple».
--     office_cierres es de solo agregar (uno por conversación y etapa): no se
--     pueden editar ni repetir.
-- Ninguna de las dos se arregla borrando o editando: eso rompe AUD-01. Se arreglan
-- con filas NUEVAS que dicen qué se corrige, por qué, quién y cuándo.
--
-- ── Qué cambia ──────────────────────────────────────────────
-- 1. office_conteo_exclusiones (nueva, solo agregar): conversación, etapa, motivo,
--    actor y fecha. Una por conversación y etapa. La conversación listada no
--    cuenta en esa etapa: ni conversaciones, ni correctas, ni inventadas.
-- 2. office_cierres_correcciones (nueva, solo agregar): conversación, etapa,
--    cumple, motivo, actor y fecha. Varias por conversación; en el conteo manda la
--    ÚLTIMA (por orden de llegada) en lugar del cierre original. El original sigue
--    en office_cierres sin tocar.
-- 3. office_excluir_conversacion() y office_corregir_cierre(): la única vía de
--    escritura. SIN EXECUTE para ningún rol de la API (anon, authenticated,
--    service_role): solo las llama el dueño en una sesión directa, la del runbook,
--    con el OK nominal de Sam. Validan conversación, etapa, motivo y actor; la
--    corrección exige un cierre original.
-- 4. office_conteo_revisiones(etapa), REEMPLAZADA (misma firma y columnas): la
--    regla de la 0560 igual, más 1 y 2.
-- 5. office_conversaciones_por_cerrar(etapa), REEMPLAZADA (misma firma): tampoco
--    lista las conversaciones excluidas.
--
-- ── Qué NO toca ─────────────────────────────────────────────
-- Ninguna fila. office_cierres, office_revisiones, office_registrar_cierre y
-- office_revisar_borrador_v2 siguen igual. La página no cambia.
--
-- ── Locks ───────────────────────────────────────────────────
-- CREATE TABLE de dos tablas nuevas y CREATE OR REPLACE FUNCTION. lock_timeout 5 s.
--
-- ── Deshacer ────────────────────────────────────────────────
-- supabase/desarmes/0567_desarme.sql (sin número; usarlo exige OK nominal de Sam):
-- vuelve el conteo al cuerpo de la 0560 y la lista de por cerrar al de la 0558, y
-- quita las dos funciones de escritura. Las tablas y sus filas QUEDAN (solo
-- agregar): el conteo deja de mirarlas.
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_conteo text;
  v_por_cerrar text;
begin
  if pg_catalog.to_regclass('public.office_cierres') is null
     or pg_catalog.to_regprocedure('public.office_conteo_revisiones(smallint)') is null
     or pg_catalog.to_regprocedure('public.office_conversaciones_por_cerrar(smallint)') is null
     or pg_catalog.to_regprocedure('public.office_exigir_admin(text)') is null
     or pg_catalog.to_regprocedure('public.office_solo_insertar()') is null then
    raise exception '0567 requiere la 0541 (office_solo_insertar), la 0558 (office_cierres) y la 0560';
  end if;
  -- El cuerpo vivo tiene que ser EXACTAMENTE el de la 0560 (o el de esta, si ya se aplicó): md5 de prosrc. Si
  -- alguien cambió el conteo por fuera, esta migración no lo pisa.
  select pg_catalog.md5(p.prosrc) into v_conteo from pg_catalog.pg_proc p
   where p.oid = 'public.office_conteo_revisiones(smallint)'::pg_catalog.regprocedure;
  if v_conteo not in ('a936f1ab6c7dd3a58a4c14ce58f9af36', 'c86f494b046bdf00eb71011c945650e7') then
    raise exception '0567: el conteo vivo no es el de la 0560 ni el de la 0567; no se aplica (avisar al DG)';
  end if;
  select pg_catalog.md5(p.prosrc) into v_por_cerrar from pg_catalog.pg_proc p
   where p.oid = 'public.office_conversaciones_por_cerrar(smallint)'::pg_catalog.regprocedure;
  if v_por_cerrar not in ('7bc6356c6e653c2109cca49cbecba9b3', '980fa0b14bf9774e2ac1c8f0825c1aae') then
    raise exception '0567: la lista de por cerrar viva no es la de la 0558 ni la de la 0567; no se aplica (avisar al DG)';
  end if;
end
$preflight$;

-- ─── 1. office_conteo_exclusiones ───────────────────────────
create table if not exists public.office_conteo_exclusiones (
  id            uuid primary key default pg_catalog.gen_random_uuid(),
  -- La misma clave de conversación que office_cierres.
  conversacion  text not null,
  etapa         smallint not null,
  motivo        text not null,
  -- Quién lo decidió y con qué OK (texto: la escribe el dueño en una sesión directa, sin auth.uid()).
  actor         text not null,
  excluida_en   timestamptz not null default now(),

  constraint office_conteo_exclusiones_conversacion_valida check (conversacion ~ '^[0-9a-f-]{1,40}$'),
  constraint office_conteo_exclusiones_etapa_valida check (etapa in (1, 2)),
  constraint office_conteo_exclusiones_motivo_corto check (char_length(btrim(motivo)) between 1 and 500),
  constraint office_conteo_exclusiones_actor_corto check (char_length(btrim(actor)) between 1 and 200),
  constraint office_conteo_exclusiones_una_por_conversacion unique (conversacion, etapa)
);

comment on table public.office_conteo_exclusiones is
  'SDD-0626 · 0567: conversaciones que NO cuentan en el conteo de una etapa (p. ej. una prueba del encendido), con '
  'motivo, actor y fecha. SOLO SE AGREGAN FILAS. Una por conversación y etapa. Se escribe solo con '
  'office_excluir_conversacion(), en una sesión directa del dueño y con el OK nominal de Sam. Sin texto del cliente.';

-- ─── 2. office_cierres_correcciones ─────────────────────────
create table if not exists public.office_cierres_correcciones (
  id            uuid primary key default pg_catalog.gen_random_uuid(),
  -- Orden de llegada: en el conteo manda la corrección con el orden más alto.
  orden         bigint generated always as identity,
  conversacion  text not null,
  etapa         smallint not null,
  cumple        boolean not null,
  motivo        text not null,
  actor         text not null,
  corregido_en  timestamptz not null default now(),

  constraint office_cierres_correcciones_conversacion_valida check (conversacion ~ '^[0-9a-f-]{1,40}$'),
  constraint office_cierres_correcciones_etapa_valida check (etapa in (1, 2)),
  constraint office_cierres_correcciones_motivo_corto check (char_length(btrim(motivo)) between 1 and 500),
  constraint office_cierres_correcciones_actor_corto check (char_length(btrim(actor)) between 1 and 200),
  constraint office_cierres_correcciones_orden_unico unique (orden)
);

comment on table public.office_cierres_correcciones is
  'SDD-0626 · 0567: correcciones de un cierre de office_cierres. La última (orden más alto) reemplaza en el conteo '
  'al cierre original, que no se borra. SOLO SE AGREGAN FILAS. Se escribe solo con office_corregir_cierre(), en una '
  'sesión directa del dueño y con el OK nominal de Sam. Sin texto del cliente.';

create or replace trigger office_conteo_exclusiones_solo_insertar
  before update or delete on public.office_conteo_exclusiones
  for each row execute function public.office_solo_insertar();
create or replace trigger office_conteo_exclusiones_solo_insertar_truncate
  before truncate on public.office_conteo_exclusiones
  for each statement execute function public.office_solo_insertar();
alter table public.office_conteo_exclusiones enable always trigger office_conteo_exclusiones_solo_insertar;
alter table public.office_conteo_exclusiones enable always trigger office_conteo_exclusiones_solo_insertar_truncate;

create or replace trigger office_cierres_correcciones_solo_insertar
  before update or delete on public.office_cierres_correcciones
  for each row execute function public.office_solo_insertar();
create or replace trigger office_cierres_correcciones_solo_insertar_truncate
  before truncate on public.office_cierres_correcciones
  for each statement execute function public.office_solo_insertar();
alter table public.office_cierres_correcciones enable always trigger office_cierres_correcciones_solo_insertar;
alter table public.office_cierres_correcciones enable always trigger office_cierres_correcciones_solo_insertar_truncate;

alter table public.office_conteo_exclusiones enable row level security;
alter table public.office_cierres_correcciones enable row level security;
revoke all on public.office_conteo_exclusiones from public, anon, authenticated, service_role;
revoke all on public.office_cierres_correcciones from public, anon, authenticated, service_role;
-- service_role las lee (la bitácora del ERP), como office_cierres; escribir, solo las funciones.
grant select on public.office_conteo_exclusiones to service_role;
grant select on public.office_cierres_correcciones to service_role;

-- ─── 3. La vía de escritura (solo el dueño, en sesión directa) ─
-- Una conversación sale del conteo de una etapa. Exige que tenga revisiones de criterio 2 en esa etapa.
create or replace function public.office_excluir_conversacion(
  p_conversacion text, p_etapa smallint, p_motivo text, p_actor text)
returns uuid
language plpgsql
set search_path = ''
as $function$
declare
  v_id uuid;
begin
  if p_etapa is null or p_etapa not in (1, 2) then
    raise exception 'office_excluir_conversacion: la etapa es 1 o 2' using errcode = '22023';
  end if;
  if p_motivo is null or char_length(btrim(p_motivo)) not between 1 and 500 then
    raise exception 'office_excluir_conversacion: el motivo es obligatorio (1 a 500 caracteres)' using errcode = '22023';
  end if;
  if p_actor is null or char_length(btrim(p_actor)) not between 1 and 200 then
    raise exception 'office_excluir_conversacion: el actor es obligatorio (1 a 200 caracteres)' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.office_revisiones r join public.office_tasks t on t.id = r.task_id
     where r.regla_casillas = 2 and r.etapa = p_etapa
       and coalesce(pg_catalog.substring(t.entidad_ref, '^chatwoot:conversations/([0-9]+)/'), t.id::text) = p_conversacion) then
    raise exception 'office_excluir_conversacion: esa conversación no tiene revisiones en esta etapa' using errcode = 'P0002';
  end if;
  insert into public.office_conteo_exclusiones (conversacion, etapa, motivo, actor)
  values (p_conversacion, p_etapa, btrim(p_motivo), btrim(p_actor))
  on conflict (conversacion, etapa) do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'office_excluir_conversacion: esa conversación ya está excluida en esta etapa' using errcode = '23505';
  end if;
  return v_id;
end;
$function$;

-- Una corrección del cierre de una conversación. Exige el cierre original en office_cierres.
create or replace function public.office_corregir_cierre(
  p_conversacion text, p_etapa smallint, p_cumple boolean, p_motivo text, p_actor text)
returns uuid
language plpgsql
set search_path = ''
as $function$
declare
  v_id uuid;
begin
  if p_etapa is null or p_etapa not in (1, 2) then
    raise exception 'office_corregir_cierre: la etapa es 1 o 2' using errcode = '22023';
  end if;
  if p_cumple is null then
    raise exception 'office_corregir_cierre: falta decir si cerró o escaló en 3 intercambios o menos' using errcode = '22004';
  end if;
  if p_motivo is null or char_length(btrim(p_motivo)) not between 1 and 500 then
    raise exception 'office_corregir_cierre: el motivo es obligatorio (1 a 500 caracteres)' using errcode = '22023';
  end if;
  if p_actor is null or char_length(btrim(p_actor)) not between 1 and 200 then
    raise exception 'office_corregir_cierre: el actor es obligatorio (1 a 200 caracteres)' using errcode = '22023';
  end if;
  if not exists (select 1 from public.office_cierres c where c.conversacion = p_conversacion and c.etapa = p_etapa) then
    raise exception 'office_corregir_cierre: esa conversación no tiene cierre en esta etapa' using errcode = 'P0002';
  end if;
  insert into public.office_cierres_correcciones (conversacion, etapa, cumple, motivo, actor)
  values (p_conversacion, p_etapa, p_cumple, btrim(p_motivo), btrim(p_actor))
  returning id into v_id;
  return v_id;
end;
$function$;

-- ─── 4. La lista de por cerrar, sin las excluidas ───────────
create or replace function public.office_conversaciones_por_cerrar(p_etapa smallint)
returns table (conversacion text, revisiones integer, ultima_revision timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $function$
#variable_conflict use_column
begin
  perform public.office_exigir_admin('office_conversaciones_por_cerrar');
  if p_etapa is null or p_etapa not in (1, 2) then
    raise exception 'office_conversaciones_por_cerrar: la etapa es 1 o 2' using errcode = '22023';
  end if;
  return query
    select x.conv, pg_catalog.count(*)::integer, pg_catalog.max(x.revisado_en)
      from (select coalesce(pg_catalog.substring(t.entidad_ref, '^chatwoot:conversations/([0-9]+)/'), t.id::text) as conv,
                   r.revisado_en
              from public.office_revisiones r join public.office_tasks t on t.id = r.task_id
             where r.regla_casillas = 2 and r.etapa = p_etapa) x
     where not exists (select 1 from public.office_cierres c where c.conversacion = x.conv and c.etapa = p_etapa)
       -- 0567: una conversación excluida del conteo no se cierra.
       and not exists (select 1 from public.office_conteo_exclusiones e where e.conversacion = x.conv and e.etapa = p_etapa)
     group by x.conv
     order by pg_catalog.max(x.revisado_en) asc
     limit 200;
end;
$function$;

-- ─── 5. El conteo de AC-1 y AC-7 ─────────────────────────────
-- Como en la 0560, más: las excluidas no cuentan y, si un cierre tiene corrección, manda la última.
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
    ), sin_excluidas as (
      -- 0567: la conversación excluida en esta etapa no cuenta (ni a favor ni en contra).
      select p.* from por_conv p
       where not exists (select 1 from public.office_conteo_exclusiones e
                          where e.conversacion = p.conv and e.etapa = p_etapa)
    ), con_cierre as (
      -- 0567: el cierre que cuenta es la última corrección si la hay; si no, el original.
      select p.conv, p.inventada, coalesce(k.cumple, c.cumple) as cierre,
             p.correcta_mensajes and coalesce(k.cumple, c.cumple) is distinct from false
               and (p_etapa = 1 or coalesce(k.cumple, c.cumple) is true) as correcta
        from sin_excluidas p
        left join public.office_cierres c on c.conversacion = p.conv and c.etapa = p_etapa
        left join lateral (
          select k2.cumple from public.office_cierres_correcciones k2
           where k2.conversacion = p.conv and k2.etapa = p_etapa
           order by k2.orden desc
           limit 1
        ) k on true
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

-- ─── 6. Dueño, privilegios y comentarios ─────────────────────
alter function public.office_conteo_revisiones(smallint) owner to postgres;
revoke all on function public.office_conteo_revisiones(smallint) from public, anon, authenticated, service_role;
grant execute on function public.office_conteo_revisiones(smallint) to authenticated;

alter function public.office_conversaciones_por_cerrar(smallint) owner to postgres;
revoke all on function public.office_conversaciones_por_cerrar(smallint) from public, anon, authenticated, service_role;
grant execute on function public.office_conversaciones_por_cerrar(smallint) to authenticated;

-- Las de escritura: SIN EXECUTE para ningún rol de la API. Solo el dueño, en una sesión directa.
alter function public.office_excluir_conversacion(text, smallint, text, text) owner to postgres;
revoke all on function public.office_excluir_conversacion(text, smallint, text, text) from public, anon, authenticated, service_role;
alter function public.office_corregir_cierre(text, smallint, boolean, text, text) owner to postgres;
revoke all on function public.office_corregir_cierre(text, smallint, boolean, text, text) from public, anon, authenticated, service_role;

comment on function public.office_conteo_revisiones(smallint) is
  'SDD-0626 AC-1 (etapa 1: 10) y AC-7 (etapa 2: 20), regla de la 0558 con la 0560 y la 0567: solo criterio 2; '
  'correcta = aprobada con los 4 criterios en cumple (en un escalado, «Acuse» puede quedar sin evaluar) y cierre que '
  'no falló (etapa 2: cierre que cumple; solo conversaciones con cierre); el cierre que cuenta es la última fila de '
  'office_cierres_correcciones si la hay; las conversaciones de office_conteo_exclusiones no cuentan; inventada = '
  'c_cero_inventados false explícito. Solo is_platform_admin().';
comment on function public.office_conversaciones_por_cerrar(smallint) is
  'SDD-0626 · 0558 (H3) con la 0567: conversaciones con revisiones de criterio 2, sin cierre en la etapa y sin '
  'exclusión del conteo. Solo is_platform_admin().';
comment on function public.office_excluir_conversacion(text, smallint, text, text) is
  'SDD-0626 · 0567: saca una conversación del conteo de una etapa (una vez), con motivo y actor. Sin EXECUTE para la '
  'API: solo el dueño en una sesión directa, con el OK nominal de Sam (runbook oficina-cable §13b).';
comment on function public.office_corregir_cierre(text, smallint, boolean, text, text) is
  'SDD-0626 · 0567: agrega una corrección al cierre de una conversación (la última manda en el conteo; el original '
  'queda). Sin EXECUTE para la API: solo el dueño en una sesión directa, con el OK nominal de Sam (runbook §13b).';

-- ─── 7. Postflight ───────────────────────────────────────────
do $postflight$
declare
  v_rol text;
  v_priv text;
  v_tabla text;
  v_firma text;
  v_def text;
begin
  foreach v_tabla in array array['public.office_conteo_exclusiones', 'public.office_cierres_correcciones'] loop
    if not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = v_tabla::pg_catalog.regclass) then
      raise exception '0567 postflight: RLS apagada en %', v_tabla;
    end if;
    if exists (select 1 from pg_catalog.pg_policies
                where schemaname = 'public' and tablename = pg_catalog.split_part(v_tabla, '.', 2)) then
      raise exception '0567 postflight: % no debía tener policies', v_tabla;
    end if;
    foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
      foreach v_priv in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
        if pg_catalog.has_table_privilege(v_rol, v_tabla, v_priv) then
          raise exception '0567 postflight: % tiene % sobre %', v_rol, v_priv, v_tabla;
        end if;
      end loop;
      if pg_catalog.has_any_column_privilege(v_rol, v_tabla, 'INSERT')
         or pg_catalog.has_any_column_privilege(v_rol, v_tabla, 'UPDATE') then
        raise exception '0567 postflight: % escribe columnas de %', v_rol, v_tabla;
      end if;
    end loop;
    foreach v_rol in array array['anon', 'authenticated'] loop
      if pg_catalog.has_any_column_privilege(v_rol, v_tabla, 'SELECT') then
        raise exception '0567 postflight: % lee %', v_rol, v_tabla;
      end if;
    end loop;
    if (select pg_catalog.count(*) from pg_catalog.pg_trigger g
         where g.tgrelid = v_tabla::pg_catalog.regclass and g.tgenabled = 'A'
           and g.tgfoid = 'public.office_solo_insertar()'::pg_catalog.regprocedure) <> 2 then
      raise exception '0567 postflight: % sin los dos disparadores ALWAYS de solo agregar', v_tabla;
    end if;
  end loop;
  foreach v_firma in array array['public.office_conteo_revisiones(smallint)',
                                 'public.office_conversaciones_por_cerrar(smallint)'] loop
    if not exists (
      select 1 from pg_catalog.pg_proc p
       where p.oid = pg_catalog.to_regprocedure(v_firma) and p.prosecdef and p.proconfig @> array['search_path=""']
    ) then
      raise exception '0567 postflight: % sin search_path vacío o sin SECURITY DEFINER', v_firma;
    end if;
    foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
      if pg_catalog.has_function_privilege(v_rol, v_firma, 'EXECUTE') <> (v_rol = 'authenticated') then
        raise exception '0567 postflight: EXECUTE de % sobre % no es el esperado', v_rol, v_firma;
      end if;
    end loop;
  end loop;
  foreach v_firma in array array['public.office_excluir_conversacion(text, smallint, text, text)',
                                 'public.office_corregir_cierre(text, smallint, boolean, text, text)'] loop
    if not exists (
      select 1 from pg_catalog.pg_proc p
       where p.oid = pg_catalog.to_regprocedure(v_firma) and not p.prosecdef and p.proconfig @> array['search_path=""']
    ) then
      raise exception '0567 postflight: % sin search_path vacío o con SECURITY DEFINER', v_firma;
    end if;
    foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
      if pg_catalog.has_function_privilege(v_rol, v_firma, 'EXECUTE') then
        raise exception '0567 postflight: % puede llamar a %', v_rol, v_firma;
      end if;
    end loop;
  end loop;
  v_def := pg_catalog.pg_get_functiondef('public.office_conteo_revisiones(smallint)'::pg_catalog.regprocedure);
  if pg_catalog.strpos(v_def, 'public.office_conteo_exclusiones') = 0
     or pg_catalog.strpos(v_def, 'public.office_cierres_correcciones') = 0
     or pg_catalog.strpos(v_def, 'r.tipo_borrador = ''escalado'' and r.c_acuse is null') = 0 then
    raise exception '0567 postflight: office_conteo_revisiones no tiene la regla de la 0567';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';
