-- ─────────────────────────────────────────────────────────────────────────────
-- 0541 · SDD-0626 §3.1 — Las tres tablas del cable y la bandera office_paused.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK de Sam NOMBRANDO este archivo, el runbook aplicar-migraciones-prod y el
--    Director General. Fusionar la PR NO autoriza aplicarla.
--    ORDEN: indiferente. Ningún código del ERP la usa todavía (sin webhook, sin
--    filtro, sin despachador y sin pantallas): la web corre igual con o sin ella.
--
-- ── Qué crea ────────────────────────────────────────────────
-- 1. office_tasks: las tareas de la oficina. estado ∈ {borrador, listo,
--    en-ejecución, auditoría, aprobación, terminada}; modo ∈ {solo, equipo};
--    meta_datos jsonb (objeto, ≤ 8 KB). Nadie las borra: SGE-AG-01 §7 dice que
--    las tareas quedan congeladas, nunca se pierden.
-- 2. task_events: la bitácora de cada tarea. SOLO INSERT (AUD-01), cumplido en la
--    base: service_role solo tiene SELECT e INSERT (sin id ni ts: la hora la
--    pone la base), y un disparador para UPDATE,
--    DELETE y TRUNCATE aunque alguien le dé esos privilegios por error. La única
--    excepción es el dueño de las migraciones en una sesión propia (ver 5).
--    costo_usd numeric ≥ 0. Índice en task_id. actor es un identificador
--    (agente:<perfil>, sistema:<componente> o persona:<uuid>), nunca un nombre.
--    La ÚNICA edición: vaciar resumen en filas de más de 90 días (ver 6).
-- 3. event_inbox: la bandeja de eventos entrantes. prioridad ∈ {3, 2, 1}
--    (§3.3: dinero > cliente > interno); estado ∈ {nuevo, triaje, convertido,
--    descartado}. clave_dedupe es ÚNICA (AC-4 en la base: un duplicado no entra;
--    el webhook inserta con ON CONFLICT DO NOTHING). payload_ref es una
--    REFERENCIA (`origen:ruta`, sin espacios, ≤ 288 caracteres), nunca el
--    mensaje del cliente (R5 · PII): un texto con espacios o saltos no entra.
-- 4. office_paused: la bandera de toda la oficina (kill switch, SGE-AG-01 §7),
--    guardada como historial de solo agregar. Cada fila es un cambio: a qué
--    valor, quién (auth.uid()), cuándo y por qué. Vale la ÚLTIMA fila. Nace con
--    una fila en VERDADERO: la oficina arranca pausada.
--    · office_esta_pausada(): el valor vigente. Sin filas responde VERDADERO
--      (falla cerrado). Solo la ejecuta service_role (el despachador futuro).
--    · office_cambiar_pausa(pausada, motivo): el único camino desde la API.
--      Exige is_platform_admin() y un motivo; guarda auth.uid() y now().
-- 5. office_solo_insertar(): el disparador de solo agregar de task_events y
--    office_paused. Deja pasar UPDATE, DELETE o TRUNCATE solo si current_user y
--    session_user son el dueño de la tabla: una sesión directa del dueño de las
--    migraciones. Una función SECURITY DEFINER llamada desde la API corre como
--    el dueño, pero su session_user es el de la API: no pasa. Los cuatro
--    disparadores van ENABLE ALWAYS: session_replication_role = replica no los
--    apaga.
-- 6. Retención del resumen (SDD-0626 §3.1, temporalidad: una red por si la
--    redacción de datos personales del Paso 2 falla; no es un plazo de R5, que
--    se lo da al replay). office_vaciar_resumenes_viejos(), SECURITY DEFINER,
--    solo para service_role: pone resumen = null en las filas de más de 90 días.
--    El disparador deja pasar esa edición y ninguna otra: solo resumen → null,
--    solo en filas de más de 90 días, con todas las demás columnas iguales.
--    office_tasks.asignado_a también es un identificador, como actor.
--
-- ── Quién la ve ──────────────────────────────────────────────
-- RLS activada en las cuatro tablas y sin policies. anon y authenticated sin
-- ningún privilegio de tabla, de columna ni de secuencia. service_role (el
-- despachador futuro) lee todo y escribe POR COLUMNA: nunca id, creado_en, ts
-- ni clave_dedupe (la hora y la identidad las pone la base, AUD-01 §3), ni
-- origen o payload_ref después de creada la fila. No borra nada. Aún no hay
-- pantallas.
--
-- ── Revisión de la #572 ──────────────────────────────────────
-- Corregida EN SU LUGAR antes de aplicarse en ningún entorno (ni sellada en
-- migrations.lock.json): clave_dedupe única, disparadores ALWAYS, grants por
-- columna y un postflight que mira las tres funciones. Si encuentra la versión
-- anterior aplicada (el índice no único event_inbox_clave_dedupe_idx), para.
--
-- ── Qué NO toca ──────────────────────────────────────────────
-- Ninguna tabla, función, policy ni grant existente. No usa agents, agent_runs
-- ni agent_approvals (SDD-0020). Lee is_platform_admin() sin cambiarla.
--
-- ── Locks ───────────────────────────────────────────────────
-- Solo objetos nuevos: ningún lock sobre tablas existentes.
--
-- ── Deshacer ────────────────────────────────────────────────
-- supabase/desarmes/0541_desarme.sql (sin número; usarlo exige OK nominal de
-- Sam). Pierde las filas de las cuatro tablas, también la bitácora.
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regprocedure('public.is_platform_admin()') is null then
    raise exception '0541 requiere public.is_platform_admin()';
  end if;
  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0541 requiere auth.uid()';
  end if;
  -- Si ya existe una tabla con estos nombres y no tiene la forma de esta
  -- migración, parar: no es la nuestra.
  if pg_catalog.to_regclass('public.office_tasks') is not null
     and not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'office_tasks'
                        and column_name = 'meta_datos') then
    raise exception '0541: public.office_tasks ya existe con otra forma';
  end if;
  if pg_catalog.to_regclass('public.task_events') is not null
     and not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'task_events'
                        and column_name = 'modelo_usado') then
    raise exception '0541: public.task_events ya existe con otra forma';
  end if;
  if pg_catalog.to_regclass('public.event_inbox') is not null
     and not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'event_inbox'
                        and column_name = 'clave_dedupe') then
    raise exception '0541: public.event_inbox ya existe con otra forma';
  end if;
  if pg_catalog.to_regclass('public.office_paused') is not null
     and not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'office_paused'
                        and column_name = 'cambiado_por') then
    raise exception '0541: public.office_paused ya existe con otra forma';
  end if;
  -- La versión de la 0541 anterior a la revisión de la #572 dejaba un índice no
  -- único en clave_dedupe. Esta versión no la convierte: se desarma antes.
  if pg_catalog.to_regclass('public.event_inbox_clave_dedupe_idx') is not null then
    raise exception '0541: está aplicada la versión anterior a la revisión de la #572 (índice no único event_inbox_clave_dedupe_idx); desarmarla antes';
  end if;
end
$preflight$;

-- ─── 1. office_tasks ─────────────────────────────────────────
create table if not exists public.office_tasks (
  id           uuid primary key default pg_catalog.gen_random_uuid(),
  titulo       text not null,
  estado       text not null default 'borrador',
  modo         text not null default 'solo',
  ejecucion    text,
  asignado_a   text,
  depto        text,
  prioridad    smallint not null default 1,
  entidad_ref  text,
  origen       text,
  meta_datos   jsonb not null default '{}'::jsonb,
  creado_en    timestamptz not null default now(),

  constraint office_tasks_estado_valido
    check (estado in ('borrador', 'listo', 'en-ejecución', 'auditoría', 'aprobación', 'terminada')),
  constraint office_tasks_modo_valido
    check (modo in ('solo', 'equipo')),
  constraint office_tasks_prioridad_valida
    check (prioridad in (1, 2, 3)),
  constraint office_tasks_titulo_corto
    check (char_length(btrim(titulo)) between 1 and 200),
  constraint office_tasks_textos_cortos
    check (coalesce(char_length(ejecucion), 0) <= 200
           and coalesce(char_length(depto), 0) <= 100
           and coalesce(char_length(origen), 0) <= 100),
  -- R5 · AUD-01 §5: a quién va la tarea es un identificador, nunca un nombre.
  constraint office_tasks_asignado_a_es_identificador
    check (asignado_a is null or asignado_a ~ '^(agente:[a-z0-9][a-z0-9_.-]{0,63}|sistema:[a-z0-9][a-z0-9_.-]{0,63}|persona:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'),
  -- Una referencia a una entidad del ERP, no su contenido (R5).
  constraint office_tasks_entidad_ref_es_referencia
    check (entidad_ref is null or (entidad_ref ~ '^[^[:space:]]+$' and char_length(entidad_ref) <= 300)),
  constraint office_tasks_meta_datos_objeto
    check (jsonb_typeof(meta_datos) = 'object' and octet_length(meta_datos::text) <= 8192)
);

comment on table public.office_tasks is
  'SDD-0626 §3.1: tareas de la oficina. estado borrador|listo|en-ejecución|auditoría|aprobación|terminada; '
  'modo solo|equipo. Sin DELETE para nadie de la API: las tareas no se pierden (SGE-AG-01 §7).';

-- ─── 2. task_events (SOLO INSERT, AUD-01) ────────────────────
create table if not exists public.task_events (
  id            uuid primary key default pg_catalog.gen_random_uuid(),
  task_id       uuid not null references public.office_tasks(id) on delete restrict,
  run_id        uuid,
  tipo          text not null,
  actor         text not null,
  resumen       text,
  costo_usd     numeric(12, 6) not null default 0,
  modelo_usado  text,
  ts            timestamptz not null default now(),

  constraint task_events_tipo_valido
    check (tipo ~ '^[a-z][a-z0-9_.:-]{0,63}$'),
  -- R5 · AUD-01 §5: quién hizo el paso es un identificador (agente:<perfil>,
  -- sistema:<componente> o persona:<uuid de auth>), nunca un nombre ni un correo.
  constraint task_events_actor_es_identificador
    check (actor ~ '^(agente:[a-z0-9][a-z0-9_.-]{0,63}|sistema:[a-z0-9][a-z0-9_.-]{0,63}|persona:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'),
  constraint task_events_resumen_corto
    check (resumen is null or char_length(resumen) <= 1000),
  constraint task_events_costo_no_negativo
    check (costo_usd >= 0),
  constraint task_events_modelo_corto
    check (modelo_usado is null or char_length(modelo_usado) <= 100)
);

comment on table public.task_events is
  'SDD-0626 §3.1: bitácora de las tareas. SOLO INSERT (AUD-01): UPDATE, DELETE y TRUNCATE fallan también para '
  'service_role; solo el dueño de las migraciones, en sesión propia, pasa el disparador office_solo_insertar.';

create index if not exists task_events_task_id_idx
  on public.task_events (task_id, ts);

-- ─── 3. event_inbox ──────────────────────────────────────────
create table if not exists public.event_inbox (
  id            uuid primary key default pg_catalog.gen_random_uuid(),
  tipo          text not null,
  origen        text not null,
  clave_dedupe  text not null,
  prioridad     smallint not null default 1,
  payload_ref   text,
  estado        text not null default 'nuevo',
  ts            timestamptz not null default now(),

  constraint event_inbox_prioridad_valida
    check (prioridad in (3, 2, 1)),
  constraint event_inbox_estado_valido
    check (estado in ('nuevo', 'triaje', 'convertido', 'descartado')),
  constraint event_inbox_tipo_valido
    check (tipo ~ '^[a-z][a-z0-9_.:-]{0,63}$'),
  constraint event_inbox_origen_corto
    check (char_length(btrim(origen)) between 1 and 100),
  constraint event_inbox_clave_dedupe_valida
    check (clave_dedupe ~ '^[^[:space:]]{1,200}$'),
  -- AC-4 en la base: la misma clave entra una sola vez, sin carrera entre dos
  -- entregas del mismo webhook. Su índice es el de clave_dedupe que pide §9.
  constraint event_inbox_clave_dedupe_unica
    unique (clave_dedupe),
  -- R5 · PII: una referencia `origen:ruta`, nunca el mensaje completo del cliente.
  constraint event_inbox_payload_ref_es_referencia
    check (payload_ref is null or payload_ref ~ '^[a-z][a-z0-9_-]{0,31}:[^[:space:]]{1,255}$')
);

comment on table public.event_inbox is
  'SDD-0626 §3.1: bandeja de eventos. prioridad 3|2|1, estado nuevo|triaje|convertido|descartado. '
  'clave_dedupe es única (AC-4). payload_ref es una referencia (origen:ruta, sin espacios), nunca el '
  'mensaje del cliente (R5).';

-- ─── 4. office_paused (kill switch, historial de solo agregar) ─
create table if not exists public.office_paused (
  id            bigint generated always as identity primary key,
  pausada       boolean not null,
  cambiado_por  uuid,
  cambiado_en   timestamptz not null default now(),
  motivo        text not null,

  constraint office_paused_motivo_valido
    check (char_length(btrim(motivo)) between 1 and 500)
);

comment on table public.office_paused is
  'SDD-0626 §3.1 · SGE-AG-01 §7: bandera única de la oficina, como historial de solo agregar. Vale la última '
  'fila (office_esta_pausada()). Nace en VERDADERO. Solo la cambia un administrador con office_cambiar_pausa(). '
  'cambiado_por = auth.uid() de quien la cambió; null = la migración o el dueño en sesión propia.';

-- Nace pausada: una sola vez, aunque la migración se aplique de nuevo.
insert into public.office_paused (pausada, motivo)
select true, 'La oficina nace pausada (SDD-0626 §3.1).'
 where not exists (select 1 from public.office_paused);

-- ─── 5. Disparador de solo agregar ───────────────────────────
create or replace function public.office_solo_insertar()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_dueno name;
begin
  select pg_catalog.pg_get_userbyid(c.relowner)
    into v_dueno
    from pg_catalog.pg_class c
   where c.oid = tg_relid;
  -- Excepción 1: el dueño de las migraciones en una sesión propia. Una
  -- función SECURITY DEFINER llamada desde la API corre como el dueño
  -- (current_user), pero su session_user es otro: no pasa.
  if current_user = v_dueno and session_user = v_dueno then
    if tg_level = 'STATEMENT' then
      return null;
    elsif tg_op = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;
  -- Excepción 2, la única edición de la bitácora (SDD-0626 §3.1, temporalidad):
  -- vaciar el resumen de una fila de task_events de más de 90 días. Solo
  -- resumen → null; cualquier otra columna igual. La fila queda para siempre.
  if tg_op = 'UPDATE' and tg_level = 'ROW' and tg_relid = 'public.task_events'::pg_catalog.regclass then
    if old.ts < pg_catalog.now() - interval '90 days'
       and old.resumen is not null and new.resumen is null
       and (pg_catalog.to_jsonb(new) - 'resumen') = (pg_catalog.to_jsonb(old) - 'resumen') then
      return new;
    end if;
  end if;
  raise exception '%: solo se agregan filas (AUD-01); % no está permitido para %',
    tg_table_name, tg_op, current_user
    using errcode = 'insufficient_privilege',
          hint ='Una corrección es una fila nueva que referencia la anterior (AUD-01 §5).';
end;
$function$;

alter function public.office_solo_insertar() owner to postgres;
revoke all on function public.office_solo_insertar() from public, anon, authenticated, service_role;

comment on function public.office_solo_insertar() is
  'SDD-0626 §3.1 · AUD-01: corta UPDATE, DELETE y TRUNCATE en task_events y office_paused. Pasa el dueño de la '
  'tabla cuando también es el session_user (sesión directa del dueño de las migraciones) y, en task_events, el '
  'vaciado del resumen de filas de más de 90 días (solo resumen → null).';

create or replace trigger task_events_solo_insertar
  before update or delete on public.task_events
  for each row execute function public.office_solo_insertar();
create or replace trigger task_events_solo_insertar_truncate
  before truncate on public.task_events
  for each statement execute function public.office_solo_insertar();
create or replace trigger office_paused_solo_insertar
  before update or delete on public.office_paused
  for each row execute function public.office_solo_insertar();
create or replace trigger office_paused_solo_insertar_truncate
  before truncate on public.office_paused
  for each statement execute function public.office_solo_insertar();
-- ALWAYS: también con session_replication_role = replica (que sí apaga los ORIGIN).
alter table public.task_events   enable always trigger task_events_solo_insertar;
alter table public.task_events   enable always trigger task_events_solo_insertar_truncate;
alter table public.office_paused enable always trigger office_paused_solo_insertar;
alter table public.office_paused enable always trigger office_paused_solo_insertar_truncate;

-- ─── 6. Lectura y cambio de la bandera ───────────────────────
create or replace function public.office_esta_pausada()
returns boolean
language sql
stable
set search_path = ''
as $function$
  -- Sin filas: pausada. La bandera falla cerrado.
  select coalesce(
    (select p.pausada from public.office_paused p order by p.id desc limit 1),
    true
  );
$function$;

alter function public.office_esta_pausada() owner to postgres;
revoke all on function public.office_esta_pausada() from public, anon, authenticated, service_role;
grant execute on function public.office_esta_pausada() to service_role;

comment on function public.office_esta_pausada() is
  'SDD-0626 §3.1: valor vigente de office_paused (la última fila). Sin filas devuelve true (falla cerrado).';

create or replace function public.office_cambiar_pausa(p_pausada boolean, p_motivo text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not coalesce(public.is_platform_admin(), false) then
    raise exception 'office_cambiar_pausa: solo un administrador cambia office_paused'
      using errcode = '42501';
  end if;
  if p_pausada is null then
    raise exception 'office_cambiar_pausa: falta el valor (true o false)' using errcode = '22004';
  end if;
  if p_motivo is null or char_length(pg_catalog.btrim(p_motivo)) not between 1 and 500 then
    raise exception 'office_cambiar_pausa: el motivo es obligatorio (1 a 500 caracteres)'
      using errcode = '22023';
  end if;
  -- Un cambio a la vez: el orden de las filas es el de los cambios. No bloquea lecturas.
  lock table public.office_paused in share row exclusive mode;
  insert into public.office_paused (pausada, cambiado_por, motivo)
  values (p_pausada, v_uid, pg_catalog.btrim(p_motivo));
  return p_pausada;
end;
$function$;

alter function public.office_cambiar_pausa(boolean, text) owner to postgres;
revoke all on function public.office_cambiar_pausa(boolean, text) from public, anon, authenticated, service_role;
grant execute on function public.office_cambiar_pausa(boolean, text) to authenticated;

comment on function public.office_cambiar_pausa(boolean, text) is
  'SDD-0626 §3.1 · SGE-AG-01 §7: único camino de la API para pausar o despausar la oficina. Exige '
  'is_platform_admin() y un motivo; agrega una fila con auth.uid() y now(). Despausar queda registrado.';

-- ─── 6b. Retención del resumen (temporalidad, SDD-0626 §3.1) ──
-- El despachador la llama una vez al día. Vacía el resumen de las filas de más de
-- 90 días y devuelve cuántas vació; el resto de cada fila queda para siempre. Es
-- SECURITY DEFINER para que service_role no necesite UPDATE sobre task_events:
-- el disparador deja pasar solo esta edición (excepción 2 de office_solo_insertar).
create or replace function public.office_vaciar_resumenes_viejos()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_vaciados integer;
begin
  update public.task_events
     set resumen = null
   where resumen is not null
     and ts < pg_catalog.now() - interval '90 days';
  get diagnostics v_vaciados = row_count;
  return v_vaciados;
end;
$function$;

alter function public.office_vaciar_resumenes_viejos() owner to postgres;
revoke all on function public.office_vaciar_resumenes_viejos() from public, anon, authenticated, service_role;
grant execute on function public.office_vaciar_resumenes_viejos() to service_role;

comment on function public.office_vaciar_resumenes_viejos() is
  'SDD-0626 §3.1: vacía task_events.resumen en las filas de más de 90 días (temporalidad: red por si la redacción '
  'de datos personales falla). La fila queda: tipo, actor, costo, modelo y hora. Solo la ejecuta service_role.';

-- ─── 7. Seguridad: RLS sin policies y privilegios mínimos ────
alter table public.office_tasks  enable row level security;
alter table public.task_events   enable row level security;
alter table public.event_inbox   enable row level security;
alter table public.office_paused enable row level security;

revoke all on public.office_tasks, public.task_events, public.event_inbox, public.office_paused
  from public, anon, authenticated, service_role;

-- service_role lee todo y escribe por columna. La identidad (id) y la hora
-- (creado_en, ts) las pone la base, nunca quien escribe (AUD-01 §3: hora del
-- servidor). De dónde vino la fila (origen, clave_dedupe, payload_ref, tipo de
-- evento) no cambia después de creada.
grant select on public.office_tasks, public.task_events, public.event_inbox, public.office_paused
  to service_role;
grant insert (titulo, estado, modo, ejecucion, asignado_a, depto, prioridad, entidad_ref, origen, meta_datos)
  on public.office_tasks to service_role;
grant update (titulo, estado, modo, ejecucion, asignado_a, depto, prioridad, entidad_ref, meta_datos)
  on public.office_tasks to service_role;
grant insert (task_id, run_id, tipo, actor, resumen, costo_usd, modelo_usado)
  on public.task_events to service_role;
grant insert (tipo, origen, clave_dedupe, prioridad, payload_ref, estado)
  on public.event_inbox to service_role;
grant update (prioridad, estado)
  on public.event_inbox to service_role;

do $secuencia$
declare
  v_seq text := pg_catalog.pg_get_serial_sequence('public.office_paused', 'id');
begin
  execute pg_catalog.format('revoke all on sequence %s from public, anon, authenticated, service_role', v_seq);
end
$secuencia$;

-- ─── 8. Postflight ───────────────────────────────────────────
do $postflight$
declare
  v_tabla text;
  v_rol text;
  v_priv text;
  v_col record;
  v_fn record;
begin
  foreach v_tabla in array array['office_tasks', 'task_events', 'event_inbox', 'office_paused'] loop
    if not (select c.relrowsecurity from pg_catalog.pg_class c
             where c.oid = pg_catalog.to_regclass('public.' || v_tabla)) then
      raise exception '0541 postflight: RLS apagada en %', v_tabla;
    end if;
    if exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_tabla) then
      raise exception '0541 postflight: % no debía tener policies', v_tabla;
    end if;
    foreach v_rol in array array['anon', 'authenticated'] loop
      foreach v_priv in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
        if pg_catalog.has_table_privilege(v_rol, 'public.' || v_tabla, v_priv) then
          raise exception '0541 postflight: % tiene % sobre %', v_rol, v_priv, v_tabla;
        end if;
      end loop;
      -- Tampoco por columna.
      foreach v_priv in array array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] loop
        if pg_catalog.has_any_column_privilege(v_rol, 'public.' || v_tabla, v_priv) then
          raise exception '0541 postflight: % tiene % sobre columnas de %', v_rol, v_priv, v_tabla;
        end if;
      end loop;
    end loop;
    if pg_catalog.has_table_privilege('service_role', 'public.' || v_tabla, 'DELETE')
       or pg_catalog.has_table_privilege('service_role', 'public.' || v_tabla, 'TRUNCATE') then
      raise exception '0541 postflight: service_role puede borrar en %', v_tabla;
    end if;
  end loop;

  -- Quién y a quién: identificadores, nunca nombres (R5 · AUD-01 §5).
  if (select pg_catalog.count(*) from pg_catalog.pg_constraint k
       where k.contype = 'c'
         and ((k.conrelid = 'public.task_events'::regclass and k.conname = 'task_events_actor_es_identificador')
           or (k.conrelid = 'public.office_tasks'::regclass and k.conname = 'office_tasks_asignado_a_es_identificador'))) <> 2 then
    raise exception '0541 postflight: faltan los CHECK de identificador de actor o asignado_a';
  end if;

  foreach v_tabla in array array['task_events', 'office_paused'] loop
    if pg_catalog.has_any_column_privilege('service_role', 'public.' || v_tabla, 'UPDATE') then
      raise exception '0541 postflight: service_role puede cambiar filas de %', v_tabla;
    end if;
    -- ENABLE ALWAYS ('A'): session_replication_role = replica no los apaga.
    if (select pg_catalog.count(*) from pg_catalog.pg_trigger t
         where t.tgrelid = pg_catalog.to_regclass('public.' || v_tabla)
           and not t.tgisinternal and t.tgenabled = 'A'
           and t.tgfoid = 'public.office_solo_insertar()'::regprocedure) <> 2 then
      raise exception '0541 postflight: faltan los disparadores de solo agregar (ENABLE ALWAYS) en %', v_tabla;
    end if;
  end loop;

  -- La identidad, la hora y el origen de cada fila: service_role no los escribe.
  for v_col in
    select * from (values
      ('office_tasks', 'id', 'INSERT'), ('office_tasks', 'id', 'UPDATE'),
      ('office_tasks', 'creado_en', 'INSERT'), ('office_tasks', 'creado_en', 'UPDATE'),
      ('office_tasks', 'origen', 'UPDATE'),
      ('task_events', 'id', 'INSERT'), ('task_events', 'ts', 'INSERT'),
      ('event_inbox', 'id', 'INSERT'), ('event_inbox', 'id', 'UPDATE'),
      ('event_inbox', 'ts', 'INSERT'), ('event_inbox', 'ts', 'UPDATE'),
      ('event_inbox', 'clave_dedupe', 'UPDATE'), ('event_inbox', 'tipo', 'UPDATE'),
      ('event_inbox', 'origen', 'UPDATE'), ('event_inbox', 'payload_ref', 'UPDATE'),
      ('office_paused', 'pausada', 'INSERT')
    ) as t(tabla, columna, priv)
  loop
    if pg_catalog.has_column_privilege('service_role', 'public.' || v_col.tabla, v_col.columna, v_col.priv) then
      raise exception '0541 postflight: service_role tiene % sobre %.%', v_col.priv, v_col.tabla, v_col.columna;
    end if;
  end loop;

  if pg_catalog.to_regclass('public.task_events_task_id_idx') is null then
    raise exception '0541 postflight: falta el índice de task_events.task_id';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint k
      join pg_catalog.pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
     where k.conrelid = 'public.event_inbox'::regclass and k.contype = 'u'
       and pg_catalog.array_length(k.conkey, 1) = 1 and a.attname = 'clave_dedupe'
  ) then
    raise exception '0541 postflight: event_inbox.clave_dedupe no es única (AC-4)';
  end if;

  if not exists (select 1 from public.office_paused) then
    raise exception '0541 postflight: office_paused sin su primera fila';
  end if;

  -- Las cuatro funciones con search_path vacío; solo office_cambiar_pausa y
  -- office_vaciar_resumenes_viejos son SECURITY DEFINER.
  for v_fn in
    select * from (values
      ('public.office_solo_insertar()', false),
      ('public.office_esta_pausada()', false),
      ('public.office_cambiar_pausa(boolean, text)', true),
      ('public.office_vaciar_resumenes_viejos()', true)
    ) as t(firma, definer)
  loop
    if not exists (
      select 1 from pg_catalog.pg_proc p
       where p.oid = pg_catalog.to_regprocedure(v_fn.firma)
         and p.prosecdef = v_fn.definer
         and p.proconfig @> array['search_path=""']
    ) then
      raise exception '0541 postflight: % sin search_path vacío o sin el SECURITY DEFINER esperado (%)',
        v_fn.firma, case when v_fn.definer then 'definer' else 'invoker' end;
    end if;
  end loop;
  if pg_catalog.has_function_privilege('anon', 'public.office_cambiar_pausa(boolean, text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.office_cambiar_pausa(boolean, text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.office_esta_pausada()', 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.office_esta_pausada()', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.office_solo_insertar()', 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.office_solo_insertar()', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.office_solo_insertar()', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.office_vaciar_resumenes_viejos()', 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.office_vaciar_resumenes_viejos()', 'EXECUTE') then
    raise exception '0541 postflight: una función quedó ejecutable por quien no debía';
  end if;
  if not pg_catalog.has_function_privilege('service_role', 'public.office_vaciar_resumenes_viejos()', 'EXECUTE') then
    raise exception '0541 postflight: service_role no puede vaciar los resúmenes viejos';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';
