-- ─────────────────────────────────────────────────────────────────────────────
-- 0558 · SDD-0626 Paso 3b, seguimiento de la prueba F (17/11/2026) — Las casillas
-- de la revisión con tres estados y el cierre por conversación.
--
-- ⚠️ NO APLICADA EN NINGÚN ENTORNO. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla en
--    producción exige el OK de Sam NOMBRANDO este archivo, el runbook
--    aplicar-migraciones-prod y el Director General; en staging, el OK de Sam
--    con aviso previo al DG. Fusionar la PR NO autoriza aplicarla.
--    REQUIERE la 0549 (su preflight para si falta). La 0549 no se toca.
--    El código funciona con o sin ella: sin la 0558 la página de revisión dice
--    «Falta la migración 0558» y no guarda nada; el envío y el despachador
--    siguen igual.
--
-- ── Por qué (decisión del DG por delegación de Sam, 17/11/2026) ──────────────
-- H2. En la 0549 cada casilla es boolean NOT NULL: «sin marcar» y «no cumple»
--     eran lo mismo, y un rechazo sin casillas sumaba «1 con datos inventados».
--     Ahora cada criterio tiene tres estados: true = cumple (la pantalla: sin
--     marca), false = falló (marcado) y null = no evaluado. Solo un false
--     explícito en c_cero_inventados cuenta como dato inventado.
-- H3. «Cierre o escalado en 3 intercambios o menos» no se juzga en el primer
--     mensaje. La revisión de cada mensaje lleva 4 criterios (c_cierre_3 queda
--     null) y el cierre se registra UNA vez por conversación, al cerrarla o
--     escalarla, en office_cierres. Etapa 1: un cierre registrado que falló
--     hace incorrecta la conversación; sin cierre, cuenta por sus 4 criterios.
--     Etapa 2 (AC-7): solo cuentan las conversaciones con cierre registrado.
-- Filas viejas: la 0558 no las toca. Una columna nueva, regla_casillas, las deja en 1
--     (la regla de la 0549) y las nuevas van con 2; el conteo solo mira 2.
--
-- ── Qué cambia ──────────────────────────────────────────────
-- 1. office_revisiones: columna regla_casillas (1 = 0549, 2 = 0558; default 1, así
--    office_revisar_borrador de la 0549 sigue escribiendo filas de criterio 1
--    sin tocarla), las 5 casillas admiten null y cuatro checks nuevos:
--    criterio válido; criterio 1 con las 5 casillas; criterio 2 sin c_cierre_3;
--    criterio 2 aprobado (respuesta) con cero inventados y sin datos personales
--    en true; criterio 2 rechazado con al menos un fallo marcado (false).
-- 2. office_cierres: el cierre de cada conversación (cumple o no, motivo,
--    revisor, hora, etapa). SOLO SE AGREGAN FILAS. Uno por conversación y etapa.
-- 3. Funciones (search_path vacío, authenticated + is_platform_admin()):
--    office_revisar_borrador_v2(...) (4 criterios, null = no evaluado),
--    office_registrar_cierre(...), office_conversaciones_por_cerrar(etapa) y,
--    REEMPLAZADA, office_conteo_revisiones(etapa) (misma firma y columnas).
--
-- ── Qué NO toca ──────────────────────────────────────────────
-- Ninguna fila. Ninguna otra función de la 0549 (office_revisar_borrador queda
-- igual y sigue con su EXECUTE: el código nuevo ya no la llama). El envío, la
-- reserva y el despachador no cambian.
--
-- ── Locks ───────────────────────────────────────────────────
-- ALTER TABLE office_revisiones (ACCESS EXCLUSIVE, tabla chica, sin reescritura:
-- el default de regla_casillas es constante). lock_timeout 5 s.
--
-- ── Deshacer ────────────────────────────────────────────────
-- supabase/desarmes/0558_desarme.sql (sin número; usarlo exige OK nominal de
-- Sam). Pierde los cierres. Las revisiones de criterio 2 quedan, pero sus
-- casillas null impiden volver a NOT NULL: el desarme no lo intenta.
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.office_revisiones') is null
     or pg_catalog.to_regprocedure('public.office_conteo_revisiones(smallint)') is null
     or pg_catalog.to_regprocedure('public.office_exigir_admin(text)') is null
     or pg_catalog.to_regprocedure('public.office_solo_insertar()') is null then
    raise exception '0558 requiere la 0549 (office_revisiones, office_conteo_revisiones y office_exigir_admin) y la 0541';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'office_revisiones' and column_name = 'c_cierre_3') then
    raise exception '0558: public.office_revisiones no tiene la forma de la 0549';
  end if;
  if pg_catalog.to_regclass('public.office_cierres') is not null
     and not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'office_cierres' and column_name = 'cumple') then
    raise exception '0558: public.office_cierres ya existe con otra forma';
  end if;
end
$preflight$;

-- ─── 1. office_revisiones: regla_casillas y tres estados ─────
alter table public.office_revisiones add column if not exists regla_casillas smallint not null default 1;
alter table public.office_revisiones
  alter column c_acuse            drop not null,
  alter column c_guion_o_escalado drop not null,
  alter column c_cero_inventados  drop not null,
  alter column c_pii_no_repetida  drop not null,
  alter column c_cierre_3         drop not null;

do $checks$
declare
  v record;
begin
  for v in
    select * from (values
      ('office_revisiones_criterio_valido',
       'check (regla_casillas in (1, 2))'),
      -- La regla de la 0549 sigue para sus filas: las 5 casillas, sin null.
      ('office_revisiones_criterio1_completa',
       'check (regla_casillas <> 1 or (c_acuse is not null and c_guion_o_escalado is not null and c_cero_inventados is not null '
       || 'and c_pii_no_repetida is not null and c_cierre_3 is not null))'),
      -- El cierre no se juzga por mensaje: va en office_cierres.
      ('office_revisiones_criterio2_sin_cierre',
       'check (regla_casillas <> 2 or c_cierre_3 is null)'),
      -- Lo que se envía: cero inventados y sin datos personales repetidos, EVALUADOS (null no basta).
      ('office_revisiones_criterio2_aprobar_exige',
       'check (regla_casillas <> 2 or not (veredicto = ''aprobado'' and tipo_borrador = ''respuesta'') '
       || 'or (c_cero_inventados is true and c_pii_no_repetida is true))'),
      -- Un rechazo dice qué falló.
      ('office_revisiones_criterio2_rechazo_marca',
       'check (regla_casillas <> 2 or veredicto <> ''rechazado'' or c_acuse is false or c_guion_o_escalado is false '
       || 'or c_cero_inventados is false or c_pii_no_repetida is false)')
    ) as t(nombre, def)
  loop
    if not exists (select 1 from pg_catalog.pg_constraint
                    where conrelid = 'public.office_revisiones'::pg_catalog.regclass and conname = v.nombre) then
      execute pg_catalog.format('alter table public.office_revisiones add constraint %I %s', v.nombre, v.def);
    end if;
  end loop;
end
$checks$;

comment on column public.office_revisiones.regla_casillas is
  'SDD-0626 · 0558: 1 = regla de la 0549 (5 casillas booleanas, sin null); 2 = regla de la 0558 (4 criterios: '
  'true cumple, false falló, null no evaluado; el cierre va en office_cierres). El conteo solo mira criterio 2.';

-- ─── 2. office_cierres ──────────────────────────────────────
create table if not exists public.office_cierres (
  id            uuid primary key default pg_catalog.gen_random_uuid(),
  -- La clave de conteo de la conversación: el id de Chatwoot de entidad_ref, o el id de la tarea sin conversación.
  conversacion  text not null,
  -- «Cierre o escalado en 3 intercambios o menos» (eval.md, Anexo A §A.7).
  cumple        boolean not null,
  motivo        text not null,
  etapa         smallint not null default 1,
  revisor       uuid not null,
  revisado_en   timestamptz not null default now(),

  constraint office_cierres_conversacion_valida check (conversacion ~ '^[0-9a-f-]{1,40}$'),
  constraint office_cierres_motivo_corto check (char_length(btrim(motivo)) between 1 and 500),
  constraint office_cierres_etapa_valida check (etapa in (1, 2)),
  constraint office_cierres_uno_por_conversacion unique (conversacion, etapa)
);

comment on table public.office_cierres is
  'SDD-0626 · 0558 (H3): el cierre de cada conversación revisada: cerró o escaló en 3 intercambios o menos, '
  'motivo, revisor (auth.uid()) y hora. SOLO SE AGREGAN FILAS. Uno por conversación y etapa. Sin texto del cliente.';

create or replace trigger office_cierres_solo_insertar
  before update or delete on public.office_cierres
  for each row execute function public.office_solo_insertar();
create or replace trigger office_cierres_solo_insertar_truncate
  before truncate on public.office_cierres
  for each statement execute function public.office_solo_insertar();
alter table public.office_cierres enable always trigger office_cierres_solo_insertar;
alter table public.office_cierres enable always trigger office_cierres_solo_insertar_truncate;

-- ─── 3. Funciones de la página ──────────────────────────────
-- La revisión de criterio 2: 4 criterios con tres estados (null = no evaluado).
create or replace function public.office_revisar_borrador_v2(
  p_borrador uuid, p_veredicto text,
  p_acuse boolean, p_guion_o_escalado boolean, p_cero_inventados boolean, p_pii_no_repetida boolean,
  p_motivo text, p_etapa smallint default 1)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := public.office_exigir_admin('office_revisar_borrador_v2');
  v_b record;
  v_estado text;
  v_ref text;
  v_id uuid;
  v_fallos integer;
  v_sin integer;
begin
  if p_veredicto is null or p_veredicto not in ('aprobado', 'rechazado') then
    raise exception 'office_revisar_borrador_v2: el veredicto es aprobado o rechazado' using errcode = '22023';
  end if;
  if p_motivo is null or char_length(btrim(p_motivo)) not between 1 and 500 then
    raise exception 'office_revisar_borrador_v2: el motivo es obligatorio (1 a 500 caracteres)' using errcode = '22023';
  end if;
  v_fallos := (p_acuse is false)::int + (p_guion_o_escalado is false)::int + (p_cero_inventados is false)::int
              + (p_pii_no_repetida is false)::int;
  v_sin := (p_acuse is null)::int + (p_guion_o_escalado is null)::int + (p_cero_inventados is null)::int
           + (p_pii_no_repetida is null)::int;
  if p_veredicto = 'rechazado' and v_fallos = 0 then
    raise exception 'office_revisar_borrador_v2: un rechazo marca al menos un criterio que falló' using errcode = 'OFR01';
  end if;
  select b.id, b.task_id, b.run_id, b.tipo, b.texto, b.guion, b.motivo, b.prioridad into v_b
    from public.office_borradores b where b.id = p_borrador;
  if not found then
    raise exception 'office_revisar_borrador_v2: el borrador no existe' using errcode = 'P0002';
  end if;
  select t.estado, t.entidad_ref into v_estado, v_ref from public.office_tasks t where t.id = v_b.task_id for update;
  if v_estado is distinct from 'aprobación' then
    raise exception 'office_revisar_borrador_v2: la tarea no está en aprobación' using errcode = '55000';
  end if;
  if p_veredicto = 'aprobado' and v_b.tipo = 'respuesta'
     and not (p_cero_inventados is true and p_pii_no_repetida is true) then
    raise exception 'office_revisar_borrador_v2: no se aprueba un envío sin evaluar, o con datos inventados o datos personales repetidos'
      using errcode = '23514';
  end if;
  insert into public.office_revisiones (borrador_id, task_id, run_id, entidad_ref, tipo_borrador, huella_borrador, veredicto,
         c_acuse, c_guion_o_escalado, c_cero_inventados, c_pii_no_repetida, c_cierre_3, motivo, etapa, revisor, regla_casillas)
  values (v_b.id, v_b.task_id, v_b.run_id, v_ref, v_b.tipo,
          public.office_huella_borrador(v_b.tipo, v_b.texto, v_b.guion, v_b.motivo, v_b.prioridad),
          p_veredicto, p_acuse, p_guion_o_escalado, p_cero_inventados, p_pii_no_repetida, null,
          btrim(p_motivo), coalesce(p_etapa, 1), v_uid, 2)
  on conflict (borrador_id) do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'office_revisar_borrador_v2: ese borrador ya tiene su revisión' using errcode = '23505';
  end if;
  insert into public.task_events (task_id, run_id, tipo, actor, resumen)
  values (v_b.task_id, v_b.run_id, 'revision.' || case when p_veredicto = 'aprobado' then 'aprobada' else 'rechazada' end,
          'persona:' || v_uid::text,
          'Revisión de Sam: ' || p_veredicto || ' (de 4 criterios de eval.md: ' || v_fallos || ' fallaron, '
          || v_sin || ' sin evaluar).'
          || case when p_veredicto = 'aprobado' and v_b.tipo = 'respuesta' then ' Queda para el envío.' else '' end);
  if p_veredicto = 'rechazado' or v_b.tipo = 'escalado' then
    update public.office_tasks set estado = 'terminada' where id = v_b.task_id;
  end if;
  return v_id;
end;
$function$;

-- El cierre de una conversación: una vez por conversación y etapa, solo si tiene revisiones de criterio 2.
create or replace function public.office_registrar_cierre(
  p_conversacion text, p_cumple boolean, p_motivo text, p_etapa smallint default 1)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := public.office_exigir_admin('office_registrar_cierre');
  v_etapa smallint := coalesce(p_etapa, 1);
  v_id uuid;
begin
  if p_cumple is null then
    raise exception 'office_registrar_cierre: falta decir si cerró o escaló en 3 intercambios o menos' using errcode = '22004';
  end if;
  if p_motivo is null or char_length(btrim(p_motivo)) not between 1 and 500 then
    raise exception 'office_registrar_cierre: el motivo es obligatorio (1 a 500 caracteres)' using errcode = '22023';
  end if;
  if v_etapa not in (1, 2) then
    raise exception 'office_registrar_cierre: la etapa es 1 o 2' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.office_revisiones r join public.office_tasks t on t.id = r.task_id
     where r.regla_casillas = 2 and r.etapa = v_etapa
       and coalesce(pg_catalog.substring(t.entidad_ref, '^chatwoot:conversations/([0-9]+)/'), t.id::text) = p_conversacion) then
    raise exception 'office_registrar_cierre: esa conversación no tiene revisiones en esta etapa' using errcode = 'P0002';
  end if;
  insert into public.office_cierres (conversacion, cumple, motivo, etapa, revisor)
  values (p_conversacion, p_cumple, btrim(p_motivo), v_etapa, v_uid)
  on conflict (conversacion, etapa) do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'office_registrar_cierre: esa conversación ya tiene su cierre' using errcode = '23505';
  end if;
  return v_id;
end;
$function$;

-- Las conversaciones revisadas (criterio 2) que todavía no tienen cierre en la etapa.
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
     group by x.conv
     order by pg_catalog.max(x.revisado_en) asc
     limit 200;
end;
$function$;

-- LA consulta de conteo de AC-1 (etapa 1) y AC-7 (etapa 2), con la regla de la 0558. Solo revisiones de criterio 2.
-- Por conversación: correcta si TODAS sus revisiones están aprobadas con los 4 criterios en «cumple» (null no
-- basta) y, si tiene cierre registrado, el cierre cumple; con dato inventado solo si alguna tiene c_cero_inventados
-- = false EXPLÍCITO. Etapa 2: solo cuentan las conversaciones con cierre registrado. Cumple con el mínimo (10 o 20),
-- el 90 % correctas y cero inventados.
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

-- ─── 4. Dueño, privilegios y comentarios ─────────────────────
do $funciones$
declare
  v_firma text;
begin
  foreach v_firma in array array[
    'public.office_revisar_borrador_v2(uuid, text, boolean, boolean, boolean, boolean, text, smallint)',
    'public.office_registrar_cierre(text, boolean, text, smallint)',
    'public.office_conversaciones_por_cerrar(smallint)',
    'public.office_conteo_revisiones(smallint)'
  ] loop
    execute pg_catalog.format('alter function %s owner to postgres', v_firma);
    execute pg_catalog.format('revoke all on function %s from public, anon, authenticated, service_role', v_firma);
    execute pg_catalog.format('grant execute on function %s to authenticated', v_firma);
  end loop;
end
$funciones$;

comment on function public.office_revisar_borrador_v2(uuid, text, boolean, boolean, boolean, boolean, text, smallint) is
  'SDD-0626 · 0558 (H2): la revisión de Sam con 4 criterios de tres estados (true cumple, false falló, null no '
  'evaluado). Aprobar una respuesta exige cero inventados y sin datos personales en true; rechazar exige al menos un '
  'fallo. Exige is_platform_admin() y un motivo. Escribe criterio 2. Una por borrador.';
comment on function public.office_registrar_cierre(text, boolean, text, smallint) is
  'SDD-0626 · 0558 (H3): el cierre de una conversación (cerró o escaló en 3 intercambios o menos), una vez por '
  'conversación y etapa, solo si tiene revisiones de criterio 2. Exige is_platform_admin() y un motivo.';
comment on function public.office_conversaciones_por_cerrar(smallint) is
  'SDD-0626 · 0558 (H3): conversaciones con revisiones de criterio 2 y sin cierre en la etapa. Solo is_platform_admin().';
comment on function public.office_conteo_revisiones(smallint) is
  'SDD-0626 AC-1 (etapa 1: 10) y AC-7 (etapa 2: 20), regla de la 0558: solo criterio 2; correcta = aprobada con los '
  '4 criterios en cumple y cierre que no falló (etapa 2: cierre que cumple; solo conversaciones con cierre); '
  'inventada = c_cero_inventados false explícito. Solo is_platform_admin().';

alter table public.office_cierres enable row level security;
revoke all on public.office_cierres from public, anon, authenticated, service_role;
-- service_role lee los cierres (la bitácora del ERP); escribe solo la función.
grant select on public.office_cierres to service_role;

-- ─── 5. Postflight ───────────────────────────────────────────
do $postflight$
declare
  v_rol text;
  v_priv text;
  v_firma text;
  v_nombre text;
begin
  if (select pg_catalog.count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'office_revisiones'
         and column_name in ('c_acuse', 'c_guion_o_escalado', 'c_cero_inventados', 'c_pii_no_repetida', 'c_cierre_3')
         and is_nullable = 'YES') <> 5 then
    raise exception '0558 postflight: las 5 casillas no admiten null';
  end if;
  if (select c.column_default from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = 'office_revisiones' and c.column_name = 'regla_casillas')
     is distinct from '1' then
    raise exception '0558 postflight: regla_casillas sin default 1';
  end if;
  foreach v_nombre in array array['office_revisiones_criterio_valido', 'office_revisiones_criterio1_completa',
                                  'office_revisiones_criterio2_sin_cierre', 'office_revisiones_criterio2_aprobar_exige',
                                  'office_revisiones_criterio2_rechazo_marca'] loop
    if not exists (select 1 from pg_catalog.pg_constraint
                    where conrelid = 'public.office_revisiones'::pg_catalog.regclass and conname = v_nombre
                      and convalidated) then
      raise exception '0558 postflight: falta el check %', v_nombre;
    end if;
  end loop;
  if not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.office_cierres'::pg_catalog.regclass) then
    raise exception '0558 postflight: RLS apagada en office_cierres';
  end if;
  if exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'office_cierres') then
    raise exception '0558 postflight: office_cierres no debía tener policies';
  end if;
  foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
    foreach v_priv in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
      if pg_catalog.has_table_privilege(v_rol, 'public.office_cierres', v_priv) then
        raise exception '0558 postflight: % tiene % sobre office_cierres', v_rol, v_priv;
      end if;
    end loop;
    if pg_catalog.has_any_column_privilege(v_rol, 'public.office_cierres', 'INSERT')
       or pg_catalog.has_any_column_privilege(v_rol, 'public.office_cierres', 'UPDATE') then
      raise exception '0558 postflight: % escribe columnas de office_cierres', v_rol;
    end if;
  end loop;
  foreach v_rol in array array['anon', 'authenticated'] loop
    if pg_catalog.has_any_column_privilege(v_rol, 'public.office_cierres', 'SELECT') then
      raise exception '0558 postflight: % lee office_cierres', v_rol;
    end if;
  end loop;
  if (select pg_catalog.count(*) from pg_catalog.pg_trigger g
       where g.tgrelid = 'public.office_cierres'::pg_catalog.regclass and g.tgenabled = 'A'
         and g.tgfoid = 'public.office_solo_insertar()'::pg_catalog.regprocedure) <> 2 then
    raise exception '0558 postflight: office_cierres sin los dos disparadores ALWAYS de solo agregar';
  end if;
  foreach v_firma in array array[
    'public.office_revisar_borrador_v2(uuid, text, boolean, boolean, boolean, boolean, text, smallint)',
    'public.office_registrar_cierre(text, boolean, text, smallint)',
    'public.office_conversaciones_por_cerrar(smallint)',
    'public.office_conteo_revisiones(smallint)'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_proc p
       where p.oid = pg_catalog.to_regprocedure(v_firma) and p.prosecdef and p.proconfig @> array['search_path=""']
    ) then
      raise exception '0558 postflight: % sin search_path vacío o sin SECURITY DEFINER', v_firma;
    end if;
    foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
      if pg_catalog.has_function_privilege(v_rol, v_firma, 'EXECUTE') <> (v_rol = 'authenticated') then
        raise exception '0558 postflight: EXECUTE de % sobre % no es el esperado', v_rol, v_firma;
      end if;
    end loop;
  end loop;
end
$postflight$;

notify pgrst, 'reload schema';
