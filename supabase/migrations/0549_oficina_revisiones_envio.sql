-- ─────────────────────────────────────────────────────────────────────────────
-- 0549 · SDD-0626 Paso 3b (D2 y D4 · AC-1 etapa 1) — La revisión de Sam y el
-- envío desde el ERP.
--
-- ⚠️ NO APLICADA EN NINGÚN ENTORNO. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla en
--    producción exige el OK de Sam NOMBRANDO este archivo, el runbook
--    aplicar-migraciones-prod y el Director General; en staging, el OK de Sam
--    con aviso previo al DG. Fusionar la PR NO autoriza aplicarla.
--    REQUIERE la 0541, la 0544 y la 0548: su preflight para si falta alguna.
--    El código del Paso 3b funciona con o sin ella: sin la 0549 la página de
--    revisión lo dice, el envío no hace nada y el despachador sigue como en el
--    Paso 3a (lo anota una vez en el log).
--
-- ── Qué crea ────────────────────────────────────────────────
-- 1. office_revisiones (D2): la revisión de Sam de cada borrador. Veredicto
--    (aprobado | rechazado), las 5 casillas de eval.md (Anexo A §A.7), motivo,
--    quién (auth.uid()) y cuándo (now()). SOLO SE AGREGAN FILAS (el disparador
--    office_solo_insertar de la 0541, ALWAYS). Una revisión por borrador. Guarda
--    la huella del borrador revisado, nunca su texto: el borrador se purga a los
--    90 días y la revisión queda para contar (AC-1 y AC-7).
-- 2. office_envios: lo que pasó con el envío de un borrador aprobado
--    (enviando → enviado | fallido, o bloqueado). SOLO SE AGREGAN FILAS. Un
--    estado por revisión: un borrador se envía como mucho UNA vez («enviando»
--    no se repite aunque el proceso se caiga a mitad).
-- 3. office_sesiones_por_borrar: las sesiones de la oficina (Hermes) de una
--    llamada abortada o cuyo DELETE falló. El despachador reintenta el borrado
--    en cada tick durante 15 min; así no esperan a la purga diaria de 24 h.
--    Solo guarda el id de la sesión (cable-<run>-<intento>), nunca texto.
-- 4. Funciones (search_path vacío):
--    · para la página (authenticated, exigen is_platform_admin()):
--      office_borradores_pendientes(), office_revisar_borrador(...) y
--      office_conteo_revisiones(etapa): LA consulta de conteo de AC-1 (etapa 1:
--      10 conversaciones) y de AC-7 (etapa 2: 20), con la misma regla (90 %
--      correctas y cero datos inventados).
--    · para el ERP (solo service_role): office_pendientes_conteo() (el aviso de
--      Discord, solo el número), office_envios_por_hacer(límite),
--      office_reservar_envio(revisión, huella, bandeja, conversación) (mira OTRA
--      VEZ la pausa, que el borrador no cambió, que la conversación es la que
--      Sam aprobó y que la aprobación no venció —24 h—, y reserva el envío),
--      office_bloquear_envio(...), office_cerrar_envio(...),
--      office_marcar_envio_incierto(...), office_anotar_sesion_por_borrar(...),
--      office_sesiones_por_borrar() y office_quitar_sesion_por_borrar(...).
--
-- ── Qué NO toca ──────────────────────────────────────────────
-- Ninguna tabla, función, policy ni grant existente. Las tablas de la 0541 y de
-- la 0548 quedan iguales; las funciones nuevas cambian office_tasks.estado
-- (aprobación → terminada) y agregan filas a task_events, como las de la 0548.
--
-- ── Locks ───────────────────────────────────────────────────
-- Solo tablas nuevas. lock_timeout 5 s.
--
-- ── Deshacer ────────────────────────────────────────────────
-- supabase/desarmes/0549_desarme.sql (sin número; usarlo exige OK nominal de
-- Sam). Pierde las revisiones y el registro de envíos; las tareas, la bitácora
-- y los borradores quedan. Los mensajes ya enviados siguen en Chatwoot.
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.office_tasks') is null
     or pg_catalog.to_regprocedure('public.office_esta_pausada()') is null
     or pg_catalog.to_regprocedure('public.office_solo_insertar()') is null
     or pg_catalog.to_regprocedure('public.is_platform_admin()') is null then
    raise exception '0549 requiere la 0541 (tablas del cable, office_esta_pausada y office_solo_insertar) e is_platform_admin()';
  end if;
  if pg_catalog.to_regclass('public.office_borradores') is null then
    raise exception '0549 requiere la 0548 (office_borradores)';
  end if;
  if pg_catalog.to_regclass('public.office_revisiones') is not null
     and not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'office_revisiones' and column_name = 'c_cierre_3') then
    raise exception '0549: public.office_revisiones ya existe con otra forma';
  end if;
end
$preflight$;

-- ─── 0. La huella de un borrador ─────────────────────────────
-- sha256 en hex de «tipo \n texto \n guion \n motivo \n prioridad» (los nulos como
-- vacío). La misma cuenta está en lib/studio/oficina/revisiones.ts (huellaBorrador).
create or replace function public.office_huella_borrador(
  p_tipo text, p_texto text, p_guion text, p_motivo text, p_prioridad smallint)
returns text
language sql
immutable
set search_path = ''
as $function$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    coalesce(p_tipo, '') || E'\n' || coalesce(p_texto, '') || E'\n' || coalesce(p_guion, '') || E'\n'
    || coalesce(p_motivo, '') || E'\n' || coalesce(p_prioridad::text, ''), 'UTF8')), 'hex');
$function$;

-- ─── 1. office_revisiones (D2) ───────────────────────────────
create table if not exists public.office_revisiones (
  id                    uuid primary key default pg_catalog.gen_random_uuid(),
  -- Sin FK al borrador: el borrador se purga a los 90 días (D3) y la revisión queda para contar.
  borrador_id           uuid not null,
  task_id               uuid not null references public.office_tasks(id) on delete restrict,
  run_id                uuid not null,
  -- La conversación que Sam aprobó (la entidad_ref de la tarea al revisar). El envío la vuelve a comparar.
  entidad_ref           text,
  tipo_borrador         text not null,
  huella_borrador       text not null,
  veredicto             text not null,
  -- Las 5 casillas de eval.md (SDD-0626 Anexo A §A.7).
  c_acuse               boolean not null,
  c_guion_o_escalado    boolean not null,
  c_cero_inventados     boolean not null,
  c_pii_no_repetida     boolean not null,
  c_cierre_3            boolean not null,
  motivo                text not null,
  etapa                 smallint not null default 1,
  revisor               uuid not null,
  revisado_en           timestamptz not null default now(),

  constraint office_revisiones_tipo_valido check (tipo_borrador in ('respuesta', 'escalado')),
  constraint office_revisiones_veredicto_valido check (veredicto in ('aprobado', 'rechazado')),
  constraint office_revisiones_huella_hex check (huella_borrador ~ '^[0-9a-f]{64}$'),
  constraint office_revisiones_motivo_corto check (char_length(btrim(motivo)) between 1 and 500),
  constraint office_revisiones_etapa_valida check (etapa in (1, 2)),
  constraint office_revisiones_entidad_ref_es_referencia
    check (entidad_ref is null or (entidad_ref ~ '^[^[:space:]]+$' and char_length(entidad_ref) <= 300)),
  -- Lo que se envía no puede llevar datos inventados ni datos personales repetidos.
  constraint office_revisiones_aprobar_exige
    check (not (veredicto = 'aprobado' and tipo_borrador = 'respuesta')
           or (c_cero_inventados and c_pii_no_repetida)),
  -- Una revisión por borrador: la decisión de Sam no se pisa.
  constraint office_revisiones_borrador_unico unique (borrador_id)
);

comment on table public.office_revisiones is
  'SDD-0626 Paso 3b (D2): revisión de Sam de cada borrador del agente: veredicto, las 5 casillas de eval.md, '
  'motivo, revisor (auth.uid()) y hora. SOLO SE AGREGAN FILAS. Una por borrador. Guarda la huella del borrador, '
  'no su texto. Se cuenta con office_conteo_revisiones (AC-1 y AC-7).';

create index if not exists office_revisiones_task_id_idx on public.office_revisiones (task_id);

create or replace trigger office_revisiones_solo_insertar
  before update or delete on public.office_revisiones
  for each row execute function public.office_solo_insertar();
create or replace trigger office_revisiones_solo_insertar_truncate
  before truncate on public.office_revisiones
  for each statement execute function public.office_solo_insertar();
alter table public.office_revisiones enable always trigger office_revisiones_solo_insertar;
alter table public.office_revisiones enable always trigger office_revisiones_solo_insertar_truncate;

-- ─── 2. office_envios ────────────────────────────────────────
create table if not exists public.office_envios (
  id                   uuid primary key default pg_catalog.gen_random_uuid(),
  revision_id          uuid not null references public.office_revisiones(id) on delete restrict,
  task_id              uuid not null references public.office_tasks(id) on delete restrict,
  estado               text not null,
  codigo               text,
  bandeja              integer,
  chatwoot_mensaje_id  bigint,
  ts                   timestamptz not null default now(),

  constraint office_envios_estado_valido check (estado in ('enviando', 'enviado', 'fallido', 'bloqueado')),
  constraint office_envios_codigo_es_codigo check (codigo is null or codigo ~ '^[a-z0-9][a-z0-9_:.-]{0,63}$'),
  constraint office_envios_bandeja_valida check (bandeja is null or bandeja > 0),
  constraint office_envios_un_estado_por_revision unique (revision_id, estado)
);

comment on table public.office_envios is
  'SDD-0626 Paso 3b: el envío de un borrador aprobado (enviando → enviado | fallido, o bloqueado). SOLO SE '
  'AGREGAN FILAS. Un estado por revisión: un borrador se envía como mucho una vez. Sin texto: el mensaje '
  'enviado vive en Chatwoot.';

create or replace trigger office_envios_solo_insertar
  before update or delete on public.office_envios
  for each row execute function public.office_solo_insertar();
create or replace trigger office_envios_solo_insertar_truncate
  before truncate on public.office_envios
  for each statement execute function public.office_solo_insertar();
alter table public.office_envios enable always trigger office_envios_solo_insertar;
alter table public.office_envios enable always trigger office_envios_solo_insertar_truncate;

-- ─── 3. office_sesiones_por_borrar ───────────────────────────
create table if not exists public.office_sesiones_por_borrar (
  sesion_id   text primary key,
  anotada_en  timestamptz not null default now(),
  hasta       timestamptz not null,
  constraint office_sesiones_por_borrar_id_valido
    check (sesion_id ~ '^cable-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[1-9]$')
);

comment on table public.office_sesiones_por_borrar is
  'SDD-0626 Paso 3b: sesiones de la oficina (Hermes) de una llamada abortada o cuyo DELETE falló. El despachador '
  'reintenta el borrado en cada tick hasta «hasta» (15 min). Solo el id de la sesión, nunca texto.';

-- ─── 4. Funciones para la página (authenticated + is_platform_admin) ─
create or replace function public.office_exigir_admin(p_que text)
returns uuid
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not coalesce(public.is_platform_admin(), false) then
    raise exception '%: solo un superadministrador (is_platform_admin)', p_que using errcode = '42501';
  end if;
  return v_uid;
end;
$function$;

create or replace function public.office_borradores_pendientes()
returns table (borrador_id uuid, task_id uuid, run_id uuid, tipo text, texto text, guion text, motivo text,
               prioridad smallint, creado_en timestamptz, entidad_ref text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
#variable_conflict use_column
begin
  perform public.office_exigir_admin('office_borradores_pendientes');
  return query
    select b.id, b.task_id, b.run_id, b.tipo, b.texto, b.guion, b.motivo, b.prioridad, b.creado_en, t.entidad_ref
      from public.office_borradores b
      join public.office_tasks t on t.id = b.task_id
     where t.estado = 'aprobación'
       and not exists (select 1 from public.office_revisiones r where r.borrador_id = b.id)
     order by coalesce(b.prioridad, t.prioridad) desc, b.creado_en asc, b.id asc
     limit 200;
end;
$function$;

create or replace function public.office_revisar_borrador(
  p_borrador uuid, p_veredicto text,
  p_acuse boolean, p_guion_o_escalado boolean, p_cero_inventados boolean, p_pii_no_repetida boolean,
  p_cierre_3 boolean, p_motivo text, p_etapa smallint default 1)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := public.office_exigir_admin('office_revisar_borrador');
  v_b record;
  v_estado text;
  v_ref text;
  v_id uuid;
  v_casillas integer;
begin
  if p_veredicto is null or p_veredicto not in ('aprobado', 'rechazado') then
    raise exception 'office_revisar_borrador: el veredicto es aprobado o rechazado' using errcode = '22023';
  end if;
  if p_acuse is null or p_guion_o_escalado is null or p_cero_inventados is null or p_pii_no_repetida is null
     or p_cierre_3 is null then
    raise exception 'office_revisar_borrador: faltan casillas (las 5 de eval.md)' using errcode = '22004';
  end if;
  if p_motivo is null or char_length(btrim(p_motivo)) not between 1 and 500 then
    raise exception 'office_revisar_borrador: el motivo es obligatorio (1 a 500 caracteres)' using errcode = '22023';
  end if;
  select b.id, b.task_id, b.run_id, b.tipo, b.texto, b.guion, b.motivo, b.prioridad into v_b
    from public.office_borradores b where b.id = p_borrador;
  if not found then
    raise exception 'office_revisar_borrador: el borrador no existe' using errcode = 'P0002';
  end if;
  select t.estado, t.entidad_ref into v_estado, v_ref from public.office_tasks t where t.id = v_b.task_id for update;
  if v_estado is distinct from 'aprobación' then
    raise exception 'office_revisar_borrador: la tarea no está en aprobación' using errcode = '55000';
  end if;
  if p_veredicto = 'aprobado' and v_b.tipo = 'respuesta' and not (p_cero_inventados and p_pii_no_repetida) then
    raise exception 'office_revisar_borrador: no se aprueba un envío con datos inventados o datos personales repetidos'
      using errcode = '23514';
  end if;
  insert into public.office_revisiones (borrador_id, task_id, run_id, entidad_ref, tipo_borrador, huella_borrador, veredicto,
         c_acuse, c_guion_o_escalado, c_cero_inventados, c_pii_no_repetida, c_cierre_3, motivo, etapa, revisor)
  values (v_b.id, v_b.task_id, v_b.run_id, v_ref, v_b.tipo,
          public.office_huella_borrador(v_b.tipo, v_b.texto, v_b.guion, v_b.motivo, v_b.prioridad),
          p_veredicto, p_acuse, p_guion_o_escalado, p_cero_inventados, p_pii_no_repetida, p_cierre_3,
          btrim(p_motivo), coalesce(p_etapa, 1), v_uid)
  on conflict (borrador_id) do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'office_revisar_borrador: ese borrador ya tiene su revisión' using errcode = '23505';
  end if;
  v_casillas := p_acuse::int + p_guion_o_escalado::int + p_cero_inventados::int + p_pii_no_repetida::int + p_cierre_3::int;
  insert into public.task_events (task_id, run_id, tipo, actor, resumen)
  values (v_b.task_id, v_b.run_id, 'revision.' || case when p_veredicto = 'aprobado' then 'aprobada' else 'rechazada' end,
          'persona:' || v_uid::text,
          'Revisión de Sam: ' || p_veredicto || ' (' || v_casillas || ' de 5 casillas de eval.md).'
          || case when p_veredicto = 'aprobado' and v_b.tipo = 'respuesta' then ' Queda para el envío.' else '' end);
  -- Rechazado, o un escalado (no hay nada que enviar): la tarea termina. Un envío aprobado termina al enviarse.
  if p_veredicto = 'rechazado' or v_b.tipo = 'escalado' then
    update public.office_tasks set estado = 'terminada' where id = v_b.task_id;
  end if;
  return v_id;
end;
$function$;

-- LA consulta de conteo de AC-1 (etapa 1) y AC-7 (etapa 2). Por conversación (la de entidad_ref): correcta si
-- todas sus revisiones de la etapa tienen las 5 casillas; con dato inventado si alguna tiene c_cero_inventados
-- falsa. Cumple con el mínimo de conversaciones (10 o 20), el 90 % correctas (9 de 10, 18 de 20) y cero inventados.
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

-- ─── 5. Funciones para el ERP (solo service_role) ────────────
create or replace function public.office_pendientes_conteo()
returns integer
language sql
stable
set search_path = ''
as $function$
  select pg_catalog.count(*)::integer
    from public.office_borradores b
    join public.office_tasks t on t.id = b.task_id
   where t.estado = 'aprobación'
     and not exists (select 1 from public.office_revisiones r where r.borrador_id = b.id);
$function$;

create or replace function public.office_envios_por_hacer(p_limite integer default 5)
returns table (revision_id uuid, task_id uuid, entidad_ref text, texto text, guion text, huella text,
               borrador_creado_en timestamptz)
language plpgsql
stable
set search_path = ''
as $function$
#variable_conflict use_column
begin
  if p_limite is null or p_limite not between 1 and 50 then
    raise exception 'office_envios_por_hacer: el límite va de 1 a 50' using errcode = '22023';
  end if;
  if public.office_esta_pausada() then
    return;
  end if;
  return query
    select r.id, r.task_id, r.entidad_ref, b.texto, b.guion, r.huella_borrador, b.creado_en
      from public.office_revisiones r
      join public.office_tasks t on t.id = r.task_id
      join public.office_borradores b on b.id = r.borrador_id
     where r.veredicto = 'aprobado' and r.tipo_borrador = 'respuesta' and b.tipo = 'respuesta'
       and t.estado = 'aprobación'
       and t.asignado_a = 'agente:soporte-chatwoot'
       and not exists (select 1 from public.office_envios e where e.revision_id = r.id)
     order by r.revisado_en asc, r.id asc
     limit p_limite;
end;
$function$;

-- Interna (sin EXECUTE para nadie): deja un envío «bloqueado» con su código, lo anota y termina la tarea (un
-- bloqueado no se reintenta; si el cliente vuelve a escribir, su mensaje abre una tarea nueva).
create or replace function public.office_bloquear(p_revision uuid, p_task uuid, p_run uuid, p_codigo text,
                                                  p_bandeja integer, p_resumen text)
returns void
language plpgsql
set search_path = ''
as $function$
begin
  insert into public.office_envios (revision_id, task_id, estado, codigo, bandeja)
  values (p_revision, p_task, 'bloqueado', p_codigo, p_bandeja);
  insert into public.task_events (task_id, run_id, tipo, actor, resumen)
  values (p_task, p_run, 'envio.bloqueado', 'sistema:envio', 'No se envía (' || p_codigo || '): ' || p_resumen);
  update public.office_tasks set estado = 'terminada' where id = p_task;
end;
$function$;

-- Reserva UN envío. Mira OTRA VEZ la pausa; que la conversación es la que Sam aprobó (B3) y sigue siendo la de la
-- tarea; que la aprobación tiene menos de 24 h (B1); y que el borrador no cambió desde la aprobación (su huella).
-- Devuelve: ok | pausada | ya_reservado | no_aprobado | conversacion_cambio | aprobacion_vencida |
-- borrador_cambio | borrador_no_existe.
create or replace function public.office_reservar_envio(p_revision uuid, p_huella text, p_bandeja integer,
                                                        p_conversacion bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_r record;
  v_b record;
  v_ref_tarea text;
  v_huella text;
begin
  if p_bandeja is null or p_bandeja <= 0 then
    raise exception 'office_reservar_envio: falta la bandeja' using errcode = '22023';
  end if;
  if p_conversacion is null or p_conversacion <= 0 then
    raise exception 'office_reservar_envio: falta la conversación' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('office_envio:' || coalesce(p_revision::text, '')));
  if public.office_esta_pausada() then
    return 'pausada';
  end if;
  select r.id, r.task_id, r.run_id, r.borrador_id, r.veredicto, r.tipo_borrador, r.huella_borrador, r.entidad_ref,
         r.revisado_en into v_r
    from public.office_revisiones r where r.id = p_revision;
  if not found or v_r.veredicto <> 'aprobado' or v_r.tipo_borrador <> 'respuesta' then
    return 'no_aprobado';
  end if;
  if exists (select 1 from public.office_envios e where e.revision_id = p_revision) then
    return 'ya_reservado';
  end if;
  select t.entidad_ref into v_ref_tarea from public.office_tasks t where t.id = v_r.task_id for update;
  if v_r.entidad_ref is null or v_ref_tarea is distinct from v_r.entidad_ref
     or pg_catalog.substring(v_r.entidad_ref, '^chatwoot:conversations/([0-9]+)/') is distinct from p_conversacion::text then
    perform public.office_bloquear(p_revision, v_r.task_id, v_r.run_id, 'conversacion_cambio', p_bandeja,
                                   'la conversación no es la que Sam aprobó.');
    return 'conversacion_cambio';
  end if;
  if v_r.revisado_en < pg_catalog.now() - interval '24 hours' then
    perform public.office_bloquear(p_revision, v_r.task_id, v_r.run_id, 'aprobacion_vencida', p_bandeja,
                                   'la aprobación tiene más de 24 h.');
    return 'aprobacion_vencida';
  end if;
  select b.tipo, b.texto, b.guion, b.motivo, b.prioridad into v_b
    from public.office_borradores b where b.id = v_r.borrador_id;
  if not found then
    perform public.office_bloquear(p_revision, v_r.task_id, v_r.run_id, 'borrador_no_existe', p_bandeja,
                                   'el borrador ya no existe.');
    return 'borrador_no_existe';
  end if;
  v_huella := public.office_huella_borrador(v_b.tipo, v_b.texto, v_b.guion, v_b.motivo, v_b.prioridad);
  if v_huella <> v_r.huella_borrador or p_huella is distinct from v_r.huella_borrador then
    perform public.office_bloquear(p_revision, v_r.task_id, v_r.run_id, 'borrador_cambio', p_bandeja,
                                   'el borrador no es el que Sam aprobó (la huella cambió).');
    return 'borrador_cambio';
  end if;
  insert into public.office_envios (revision_id, task_id, estado, bandeja)
  values (p_revision, v_r.task_id, 'enviando', p_bandeja);
  insert into public.task_events (task_id, run_id, tipo, actor, resumen)
  values (v_r.task_id, v_r.run_id, 'envio.reservado', 'sistema:envio',
          'Envío reservado a la bandeja ' || p_bandeja || '; se manda una sola vez.');
  return 'ok';
end;
$function$;

-- Lo que el ERP ve en Chatwoot y frena el envío ANTES de reservarlo: la conversación es de otra bandeja o cuenta,
-- alguien ya contestó, el cliente escribió después del borrador (B1) o Chatwoot respondió con una forma que no se
-- reconoce. Queda «bloqueado» y la tarea termina. Solo si no hay ningún envío de esa revisión.
create or replace function public.office_bloquear_envio(p_revision uuid, p_codigo text, p_bandeja integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_r record;
begin
  if p_codigo is null or p_codigo not in ('otra_bandeja', 'ya_contestada', 'cliente_escribio', 'forma_desconocida') then
    raise exception 'office_bloquear_envio: código inválido' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('office_envio:' || coalesce(p_revision::text, '')));
  select r.task_id, r.run_id into v_r
    from public.office_revisiones r where r.id = p_revision and r.veredicto = 'aprobado';
  if not found or exists (select 1 from public.office_envios e where e.revision_id = p_revision) then
    return false;
  end if;
  perform public.office_bloquear(p_revision, v_r.task_id, v_r.run_id, p_codigo, p_bandeja,
    case p_codigo
      when 'otra_bandeja' then 'la conversación no es de la bandeja de prueba.'
      when 'ya_contestada' then 'alguien ya contestó después del borrador (un solo contestador).'
      when 'cliente_escribio' then 'el cliente escribió después del borrador; su mensaje abre una tarea nueva.'
      else 'Chatwoot respondió con una forma que no se reconoce.'
    end);
  return true;
end;
$function$;

-- Cierra un envío reservado: «enviado» (Chatwoot lo confirmó) o «fallido» (Chatwoot lo RECHAZÓ: no se entregó).
create or replace function public.office_cerrar_envio(p_revision uuid, p_estado text, p_codigo text, p_mensaje_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_r record;
begin
  if p_estado is null or p_estado not in ('enviado', 'fallido') then
    raise exception 'office_cerrar_envio: el estado es enviado o fallido' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('office_envio:' || coalesce(p_revision::text, '')));
  select e.task_id, e.bandeja, r.run_id into v_r
    from public.office_envios e join public.office_revisiones r on r.id = e.revision_id
   where e.revision_id = p_revision and e.estado = 'enviando';
  if not found or exists (select 1 from public.office_envios e
                           where e.revision_id = p_revision and e.estado in ('enviado', 'fallido', 'bloqueado')) then
    return false;
  end if;
  insert into public.office_envios (revision_id, task_id, estado, codigo, bandeja, chatwoot_mensaje_id)
  values (p_revision, v_r.task_id, p_estado, p_codigo, v_r.bandeja, case when p_estado = 'enviado' then p_mensaje_id end);
  if p_estado = 'enviado' then
    insert into public.task_events (task_id, run_id, tipo, actor, resumen)
    values (v_r.task_id, v_r.run_id, 'envio.hecho', 'sistema:envio',
            'Enviado a la bandeja ' || v_r.bandeja || ' (mensaje ' || coalesce(p_mensaje_id::text, '?') || ').');
    update public.office_tasks set estado = 'terminada' where id = v_r.task_id;
  else
    insert into public.task_events (task_id, run_id, tipo, actor, resumen)
    values (v_r.task_id, v_r.run_id, 'envio.fallido', 'sistema:envio',
            'Chatwoot rechazó el envío (' || coalesce(p_codigo, 'error') || '): no se entregó. No se reintenta solo.');
  end if;
  return true;
end;
$function$;

-- El envío pudo haber salido y no se sabe (se cortó la red, llegó un 200 ilegible, o el cierre en la base falló
-- DESPUÉS de entregar). El envío se queda en «enviando» —nunca «fallido»: reintentarlo podría duplicar el mensaje
-- al cliente— y se anota para que Sam lo mire en Chatwoot antes de hacer nada.
create or replace function public.office_marcar_envio_incierto(p_revision uuid, p_codigo text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_r record;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('office_envio:' || coalesce(p_revision::text, '')));
  select e.task_id, e.bandeja, r.run_id into v_r
    from public.office_envios e join public.office_revisiones r on r.id = e.revision_id
   where e.revision_id = p_revision and e.estado = 'enviando';
  if not found or exists (select 1 from public.office_envios e
                           where e.revision_id = p_revision and e.estado in ('enviado', 'fallido', 'bloqueado')) then
    return false;
  end if;
  insert into public.task_events (task_id, run_id, tipo, actor, resumen)
  values (v_r.task_id, v_r.run_id, 'envio.incierto', 'sistema:envio',
          'No se sabe si el mensaje llegó (' || coalesce(pg_catalog.left(p_codigo, 64), 'error')
          || '). Queda «enviando» y NO se reintenta: revisar la conversación en Chatwoot antes de hacer nada.');
  return true;
end;
$function$;

create or replace function public.office_anotar_sesion_por_borrar(p_sesion text, p_minutos integer default 15)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_minutos is null or p_minutos not between 1 and 120 then
    raise exception 'office_anotar_sesion_por_borrar: los minutos van de 1 a 120' using errcode = '22023';
  end if;
  insert into public.office_sesiones_por_borrar (sesion_id, hasta)
  values (p_sesion, pg_catalog.now() + pg_catalog.make_interval(mins => p_minutos))
  on conflict (sesion_id) do update set hasta = greatest(excluded.hasta, public.office_sesiones_por_borrar.hasta);
end;
$function$;

create or replace function public.office_sesiones_por_borrar()
returns table (sesion_id text, vencida boolean)
language sql
stable
security definer
set search_path = ''
as $function$
  select s.sesion_id, s.hasta < pg_catalog.now()
    from public.office_sesiones_por_borrar s
   order by s.anotada_en asc
   limit 100;
$function$;

create or replace function public.office_quitar_sesion_por_borrar(p_sesion text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_filas integer;
begin
  delete from public.office_sesiones_por_borrar where sesion_id = p_sesion;
  get diagnostics v_filas = row_count;
  return v_filas > 0;
end;
$function$;

-- ─── 6. Dueño, privilegios y comentarios ─────────────────────
do $funciones$
declare
  v_firma text;
begin
  foreach v_firma in array array[
    'public.office_huella_borrador(text, text, text, text, smallint)',
    'public.office_bloquear(uuid, uuid, uuid, text, integer, text)',
    'public.office_exigir_admin(text)',
    'public.office_borradores_pendientes()',
    'public.office_revisar_borrador(uuid, text, boolean, boolean, boolean, boolean, boolean, text, smallint)',
    'public.office_conteo_revisiones(smallint)',
    'public.office_pendientes_conteo()',
    'public.office_envios_por_hacer(integer)',
    'public.office_reservar_envio(uuid, text, integer, bigint)',
    'public.office_bloquear_envio(uuid, text, integer)',
    'public.office_marcar_envio_incierto(uuid, text)',
    'public.office_cerrar_envio(uuid, text, text, bigint)',
    'public.office_anotar_sesion_por_borrar(text, integer)',
    'public.office_sesiones_por_borrar()',
    'public.office_quitar_sesion_por_borrar(text)'
  ] loop
    execute pg_catalog.format('alter function %s owner to postgres', v_firma);
    execute pg_catalog.format('revoke all on function %s from public, anon, authenticated, service_role', v_firma);
  end loop;
  -- La página: solo authenticated, y adentro is_platform_admin().
  foreach v_firma in array array[
    'public.office_borradores_pendientes()',
    'public.office_revisar_borrador(uuid, text, boolean, boolean, boolean, boolean, boolean, text, smallint)',
    'public.office_conteo_revisiones(smallint)'
  ] loop
    execute pg_catalog.format('grant execute on function %s to authenticated', v_firma);
  end loop;
  -- El ERP: solo service_role.
  foreach v_firma in array array[
    'public.office_pendientes_conteo()',
    'public.office_envios_por_hacer(integer)',
    'public.office_reservar_envio(uuid, text, integer, bigint)',
    'public.office_bloquear_envio(uuid, text, integer)',
    'public.office_marcar_envio_incierto(uuid, text)',
    'public.office_cerrar_envio(uuid, text, text, bigint)',
    'public.office_anotar_sesion_por_borrar(text, integer)',
    'public.office_sesiones_por_borrar()',
    'public.office_quitar_sesion_por_borrar(text)'
  ] loop
    execute pg_catalog.format('grant execute on function %s to service_role', v_firma);
  end loop;
end
$funciones$;

comment on function public.office_revisar_borrador(uuid, text, boolean, boolean, boolean, boolean, boolean, text, smallint) is
  'SDD-0626 Paso 3b (D2, D4): la revisión de Sam. Exige is_platform_admin(), las 5 casillas y un motivo; guarda '
  'auth.uid(), now() y la huella del borrador. Una por borrador. Rechazado o escalado → la tarea termina.';
comment on function public.office_conteo_revisiones(smallint) is
  'SDD-0626 AC-1 (etapa 1: 10) y AC-7 (etapa 2: 20): la MISMA consulta. Por conversación; cumple con el mínimo, '
  'el 90 % correctas (las 5 casillas) y cero datos inventados. Solo is_platform_admin().';
comment on function public.office_reservar_envio(uuid, text, integer, bigint) is
  'SDD-0626 Paso 3b: reserva un envío UNA vez. Mira otra vez la pausa, la conversación aprobada, la vigencia (24 h) '
  'y la huella del borrador (que no cambió desde la aprobación). Solo service_role.';

alter table public.office_revisiones          enable row level security;
alter table public.office_envios              enable row level security;
alter table public.office_sesiones_por_borrar enable row level security;
revoke all on public.office_revisiones, public.office_envios, public.office_sesiones_por_borrar
  from public, anon, authenticated, service_role;
-- service_role lee las revisiones y los envíos (la bitácora del ERP); escribe solo por las funciones.
grant select on public.office_revisiones, public.office_envios to service_role;

-- ─── 7. Postflight ───────────────────────────────────────────
do $postflight$
declare
  v_tabla text;
  v_rol text;
  v_priv text;
  v_fn record;
begin
  foreach v_tabla in array array['office_revisiones', 'office_envios', 'office_sesiones_por_borrar'] loop
    if not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = pg_catalog.to_regclass('public.' || v_tabla)) then
      raise exception '0549 postflight: RLS apagada en %', v_tabla;
    end if;
    if exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_tabla) then
      raise exception '0549 postflight: % no debía tener policies', v_tabla;
    end if;
    foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
      foreach v_priv in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
        if pg_catalog.has_table_privilege(v_rol, 'public.' || v_tabla, v_priv) then
          raise exception '0549 postflight: % tiene % sobre %', v_rol, v_priv, v_tabla;
        end if;
      end loop;
      if pg_catalog.has_any_column_privilege(v_rol, 'public.' || v_tabla, 'INSERT')
         or pg_catalog.has_any_column_privilege(v_rol, 'public.' || v_tabla, 'UPDATE') then
        raise exception '0549 postflight: % escribe columnas de %', v_rol, v_tabla;
      end if;
    end loop;
    foreach v_rol in array array['anon', 'authenticated'] loop
      if pg_catalog.has_any_column_privilege(v_rol, 'public.' || v_tabla, 'SELECT') then
        raise exception '0549 postflight: % lee %', v_rol, v_tabla;
      end if;
    end loop;
  end loop;
  if pg_catalog.has_any_column_privilege('service_role', 'public.office_sesiones_por_borrar', 'SELECT') then
    raise exception '0549 postflight: service_role lee las sesiones sin las funciones';
  end if;
  foreach v_tabla in array array['office_revisiones', 'office_envios'] loop
    if (select pg_catalog.count(*) from pg_catalog.pg_trigger g
         where g.tgrelid = pg_catalog.to_regclass('public.' || v_tabla) and g.tgenabled = 'A'
           and g.tgfoid = 'public.office_solo_insertar()'::pg_catalog.regprocedure) <> 2 then
      raise exception '0549 postflight: % sin los dos disparadores ALWAYS de solo agregar', v_tabla;
    end if;
  end loop;
  for v_fn in
    select * from (values
      ('public.office_borradores_pendientes()', true, 'authenticated'),
      ('public.office_revisar_borrador(uuid, text, boolean, boolean, boolean, boolean, boolean, text, smallint)', true, 'authenticated'),
      ('public.office_conteo_revisiones(smallint)', true, 'authenticated'),
      ('public.office_pendientes_conteo()', false, 'service_role'),
      ('public.office_envios_por_hacer(integer)', false, 'service_role'),
      ('public.office_reservar_envio(uuid, text, integer, bigint)', true, 'service_role'),
      ('public.office_bloquear_envio(uuid, text, integer)', true, 'service_role'),
      ('public.office_marcar_envio_incierto(uuid, text)', true, 'service_role'),
      ('public.office_cerrar_envio(uuid, text, text, bigint)', true, 'service_role'),
      ('public.office_anotar_sesion_por_borrar(text, integer)', true, 'service_role'),
      ('public.office_sesiones_por_borrar()', true, 'service_role'),
      ('public.office_quitar_sesion_por_borrar(text)', true, 'service_role')
    ) as t(firma, definer, rol)
  loop
    if not exists (
      select 1 from pg_catalog.pg_proc p
       where p.oid = pg_catalog.to_regprocedure(v_fn.firma)
         and p.prosecdef = v_fn.definer
         and p.proconfig @> array['search_path=""']
    ) then
      raise exception '0549 postflight: % sin search_path vacío o sin el SECURITY esperado', v_fn.firma;
    end if;
    foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
      if pg_catalog.has_function_privilege(v_rol, v_fn.firma, 'EXECUTE') <> (v_rol = v_fn.rol) then
        raise exception '0549 postflight: EXECUTE de % sobre % no es el esperado', v_rol, v_fn.firma;
      end if;
    end loop;
  end loop;
  foreach v_tabla in array array['public.office_exigir_admin(text)', 'public.office_bloquear(uuid, uuid, uuid, text, integer, text)'] loop
    foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
      if pg_catalog.has_function_privilege(v_rol, v_tabla, 'EXECUTE') then
        raise exception '0549 postflight: % se llama desde la API (%)', v_tabla, v_rol;
      end if;
    end loop;
  end loop;
end
$postflight$;

notify pgrst, 'reload schema';
