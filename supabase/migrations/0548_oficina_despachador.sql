-- ─────────────────────────────────────────────────────────────────────────────
-- 0548 · SDD-0626 §3.4 y §3.5 (Paso 3a) — El despachador mínimo del cable: el
-- agente redacta, NO envía.
--
-- ⚠️ NO APLICADA EN NINGÚN ENTORNO. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla en
--    producción exige el OK de Sam NOMBRANDO este archivo, el runbook
--    aplicar-migraciones-prod y el Director General; en staging, el OK de Sam
--    con aviso previo al DG. Fusionar la PR NO autoriza aplicarla.
--    REQUIERE la 0541 (tablas del cable y office_esta_pausada()) y la 0544
--    (event_inbox.triaje_en): su preflight para si falta alguna.
--    ORDEN: después de la 0544. El código del Paso 3a funciona con o sin ella:
--    sin la 0548 el despachador no hace nada y lo anota una vez en el log.
--
-- ── Qué crea ────────────────────────────────────────────────
-- 1. office_borradores: lo que redactó el agente para que Sam lo revise (D3).
--    Una fila por corrida (run_id único): una «respuesta» (texto + guion) o un
--    «escalado» (motivo + prioridad). NUNCA el texto del cliente. Se borra a los
--    90 días con office_purgar_borradores_viejos(). RLS sin policies: ni anon ni
--    authenticated la alcanzan; service_role lee e inserta, no cambia ni borra.
-- 2. office_despachador: el turno del despachador (una fila). Una sola tanda a
--    la vez; si el proceso se cae, el turno vence y la siguiente tanda retoma.
--    Solo se toca con office_despachador_turno() y office_despachador_soltar().
-- 3. office_tasks_evento_unico: un evento de la bandeja se convierte en UNA tarea.
-- 4. Funciones del despachador (todas con search_path vacío, solo service_role):
--    · office_convertir_triaje(agente, límite): event_inbox «triaje» → tarea
--      «listo» asignada al agente; el evento pasa a «convertido». Pausada: 0.
--    · office_tomar_tarea(agente, pausa_s, tope_s): toma UNA tarea «listo» y la
--      pasa a «en-ejecución» con un run_id nuevo. Nada si la oficina está
--      pausada, si el agente ya tiene una corrida en curso (1 a la vez) o si su
--      última corrida terminó hace menos de pausa_s (10 s).
--    · office_entregar_corrida(...): guarda el borrador, anota run.terminada o
--      run.escalada y pasa la tarea a «aprobación». Solo si la tarea sigue en
--      ejecución con ESA corrida: un resultado tardío no pisa nada.
--    · office_soltar_corrida(tarea, run): la pausa abortó la corrida → la tarea
--      vuelve a «listo» (run.abortada).
--    · office_recuperar_corridas(agente, tope_s): corridas «en-ejecución» de más
--      de tope_s + 30 s sin cierre (el proceso se cayó) → run.interrumpida y un
--      escalado a «aprobación». NO se repiten: el modelo no se llama dos veces.
--    · office_gasto_del_mes(): suma de task_events.costo_usd del mes (UTC).
--    · office_autopausar_por_tope(tope, umbral): si el gasto del mes llega al
--      umbral (80 %) del tope, PAUSA la oficina. SOLO PAUSA: no existe camino
--      para despausar desde aquí (eso sigue siendo office_cambiar_pausa, admin).
--    · office_purgar_borradores_viejos(): borra los borradores de más de 90 días.
--
-- ── Qué NO toca ──────────────────────────────────────────────
-- Ninguna tabla, función, policy ni grant existente, salvo un índice único nuevo
-- en office_tasks. RLS y privilegios de las tablas de la 0541 quedan iguales.
--
-- ── Locks ───────────────────────────────────────────────────
-- CREATE UNIQUE INDEX sobre office_tasks: SHARE un instante (la tabla está vacía
-- o casi; el cable sigue apagado). lock_timeout 5 s.
--
-- ── Deshacer ────────────────────────────────────────────────
-- supabase/desarmes/0548_desarme.sql (sin número; usarlo exige OK nominal de
-- Sam). Pierde los borradores y el turno; las tareas y la bitácora quedan.
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.office_tasks') is null
     or pg_catalog.to_regclass('public.task_events') is null
     or pg_catalog.to_regprocedure('public.office_esta_pausada()') is null then
    raise exception '0548 requiere la 0541 (tablas del cable y office_esta_pausada())';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'event_inbox' and column_name = 'triaje_en') then
    raise exception '0548 requiere la 0544 (event_inbox.triaje_en)';
  end if;
  if pg_catalog.to_regclass('public.office_borradores') is not null
     and not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'office_borradores' and column_name = 'guion') then
    raise exception '0548: public.office_borradores ya existe con otra forma';
  end if;
end
$preflight$;

-- ─── 1. office_borradores ────────────────────────────────────
create table if not exists public.office_borradores (
  id          uuid primary key default pg_catalog.gen_random_uuid(),
  task_id     uuid not null references public.office_tasks(id) on delete restrict,
  run_id      uuid not null,
  tipo        text not null,
  texto       text,
  guion       text,
  motivo      text,
  prioridad   smallint,
  creado_en   timestamptz not null default now(),

  constraint office_borradores_tipo_valido
    check (tipo in ('respuesta', 'escalado')),
  constraint office_borradores_forma
    check ((tipo = 'respuesta' and texto is not null and guion is not null and motivo is null and prioridad is null)
        or (tipo = 'escalado' and texto is null and guion is null and motivo is not null and prioridad is not null)),
  constraint office_borradores_texto_corto
    check (texto is null or char_length(btrim(texto)) between 1 and 4000),
  constraint office_borradores_guion_es_id
    check (guion is null or guion ~ '^[a-z0-9][a-z0-9_.-]{0,63}$'),
  constraint office_borradores_motivo_corto
    check (motivo is null or char_length(btrim(motivo)) between 1 and 500),
  constraint office_borradores_prioridad_valida
    check (prioridad is null or prioridad in (1, 2, 3)),
  -- Una corrida deja un solo borrador: un reintento no duplica.
  constraint office_borradores_run_unico
    unique (run_id)
);

comment on table public.office_borradores is
  'SDD-0626 Paso 3a (D3): borrador del agente para la revisión de Sam: respuesta (texto + guion) o escalado '
  '(motivo + prioridad). Nunca el texto del cliente. Se borra a los 90 días (office_purgar_borradores_viejos). '
  'Nada se envía desde aquí: el envío es del Paso 3b, tras la aprobación de Sam.';

create index if not exists office_borradores_task_id_idx on public.office_borradores (task_id);
create index if not exists office_borradores_creado_en_idx on public.office_borradores (creado_en);

-- ─── 2. El turno del despachador ─────────────────────────────
create table if not exists public.office_despachador (
  id           smallint primary key default 1,
  dueno        uuid,
  hasta        timestamptz,
  ultimo_tick  timestamptz,
  constraint office_despachador_una_fila check (id = 1)
);

comment on table public.office_despachador is
  'SDD-0626 §3.4: turno del despachador (una fila). Una tanda a la vez; si se cae, el turno vence (hasta) y la '
  'siguiente retoma desde el último tick. Solo con office_despachador_turno() / office_despachador_soltar().';

insert into public.office_despachador (id) values (1) on conflict (id) do nothing;

-- ─── 3. Un evento → una tarea ────────────────────────────────
create unique index if not exists office_tasks_evento_unico
  on public.office_tasks ((meta_datos ->> 'evento_id'))
  where origen = 'event_inbox';

-- ─── 4. Funciones ────────────────────────────────────────────
-- Validación común: el perfil del agente (sin el prefijo «agente:»).
create or replace function public.office_agente_valido(p_agente text)
returns text
language plpgsql
immutable
set search_path = ''
as $function$
begin
  if p_agente is null or p_agente !~ '^[a-z0-9][a-z0-9_.-]{0,63}$' then
    raise exception 'agente inválido' using errcode = '22023';
  end if;
  return 'agente:' || p_agente;
end;
$function$;

create or replace function public.office_despachador_turno(p_dueno uuid, p_segundos integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_filas integer;
begin
  if p_dueno is null then
    raise exception 'office_despachador_turno: falta el dueño' using errcode = '22004';
  end if;
  if p_segundos is null or p_segundos not between 1 and 900 then
    raise exception 'office_despachador_turno: los segundos van de 1 a 900' using errcode = '22023';
  end if;
  update public.office_despachador d
     set dueno = p_dueno,
         hasta = pg_catalog.now() + pg_catalog.make_interval(secs => p_segundos),
         ultimo_tick = pg_catalog.now()
   where d.id = 1
     and (d.dueno is null or d.dueno = p_dueno or d.hasta is null or d.hasta < pg_catalog.now());
  get diagnostics v_filas = row_count;
  return v_filas > 0;
end;
$function$;

create or replace function public.office_despachador_soltar(p_dueno uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_filas integer;
begin
  update public.office_despachador d
     set dueno = null, hasta = null
   where d.id = 1 and d.dueno = p_dueno;
  get diagnostics v_filas = row_count;
  return v_filas > 0;
end;
$function$;

create or replace function public.office_convertir_triaje(p_agente text, p_limite integer default 20)
returns integer
language plpgsql
set search_path = ''
as $function$
declare
  v_actor text := public.office_agente_valido(p_agente);
  v_evento record;
  v_tarea uuid;
  v_convertidos integer := 0;
begin
  if p_limite is null or p_limite not between 1 and 100 then
    raise exception 'office_convertir_triaje: el límite va de 1 a 100' using errcode = '22023';
  end if;
  if public.office_esta_pausada() then
    return 0;
  end if;
  for v_evento in
    select e.id, e.tipo, e.prioridad, e.payload_ref
      from public.event_inbox e
     where e.estado = 'triaje'
     order by e.prioridad desc, e.triaje_en asc nulls last, e.ts asc, e.id asc
     limit p_limite
       for update skip locked
  loop
    v_tarea := null;
    insert into public.office_tasks (titulo, estado, asignado_a, prioridad, entidad_ref, origen, meta_datos)
    values ('Conversación de Chatwoot por atender', 'listo', v_actor, v_evento.prioridad,
            v_evento.payload_ref, 'event_inbox',
            pg_catalog.jsonb_build_object('evento_id', v_evento.id::text, 'evento_tipo', v_evento.tipo))
    on conflict ((meta_datos ->> 'evento_id')) where origen = 'event_inbox' do nothing
    returning id into v_tarea;
    update public.event_inbox set estado = 'convertido' where id = v_evento.id;
    if v_tarea is not null then
      insert into public.task_events (task_id, tipo, actor, resumen)
      values (v_tarea, 'tarea.creada', 'sistema:despachador', 'Desde la bandeja del cable (prioridad ' || v_evento.prioridad || ').');
      v_convertidos := v_convertidos + 1;
    end if;
  end loop;
  return v_convertidos;
end;
$function$;

-- Las corridas que ya cerraron (cualquiera de estos tipos cierra una corrida).
create or replace function public.office_tipos_de_cierre()
returns text[]
language sql
immutable
set search_path = ''
as $function$
  select array['run.terminada', 'run.escalada', 'run.abortada', 'run.interrumpida']::text[];
$function$;

create or replace function public.office_tomar_tarea(p_agente text, p_pausa_s integer default 10, p_tope_s integer default 300)
returns table (task_id uuid, run_id uuid, entidad_ref text, prioridad smallint)
language plpgsql
set search_path = ''
as $function$
#variable_conflict use_column
declare
  v_actor text := public.office_agente_valido(p_agente);
  v_tarea record;
  v_run uuid;
begin
  if p_pausa_s is null or p_pausa_s not between 0 and 3600 then
    raise exception 'office_tomar_tarea: la pausa va de 0 a 3600 s' using errcode = '22023';
  end if;
  if p_tope_s is null or p_tope_s not between 1 and 900 then
    raise exception 'office_tomar_tarea: el tope va de 1 a 900 s' using errcode = '22023';
  end if;
  if public.office_esta_pausada() then
    return;
  end if;
  -- Una toma a la vez por agente: sin esto, dos tandas verían «ninguna en curso» a la vez.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('office_tomar_tarea:' || v_actor));
  -- 1 corrida por agente a la vez.
  if exists (select 1 from public.office_tasks t where t.asignado_a = v_actor and t.estado = 'en-ejecución') then
    return;
  end if;
  -- Pausa entre corridas: la última corrida del agente cerró hace menos de p_pausa_s.
  if exists (
    select 1 from public.task_events ev
      join public.office_tasks t on t.id = ev.task_id
     where t.asignado_a = v_actor
       and ev.tipo = any (public.office_tipos_de_cierre())
       and ev.ts > pg_catalog.now() - pg_catalog.make_interval(secs => p_pausa_s)
  ) then
    return;
  end if;
  select t.id, t.entidad_ref, t.prioridad into v_tarea
    from public.office_tasks t
   where t.asignado_a = v_actor and t.estado = 'listo'
   order by t.prioridad desc, t.creado_en asc, t.id asc
   limit 1
     for update skip locked;
  if not found then
    return;
  end if;
  v_run := pg_catalog.gen_random_uuid();
  update public.office_tasks set estado = 'en-ejecución' where id = v_tarea.id;
  insert into public.task_events (task_id, run_id, tipo, actor, resumen)
  values (v_tarea.id, v_run, 'run.iniciada', 'sistema:despachador', 'Tope ' || p_tope_s || ' s.');
  task_id := v_tarea.id;
  run_id := v_run;
  entidad_ref := v_tarea.entidad_ref;
  prioridad := v_tarea.prioridad;
  return next;
end;
$function$;

-- ¿Es p_run la corrida en curso de p_tarea? (en ejecución, iniciada con ese run y sin cierre)
create or replace function public.office_corrida_en_curso(p_tarea uuid, p_run uuid)
returns boolean
language sql
stable
set search_path = ''
as $function$
  select exists (
    select 1 from public.office_tasks t
     where t.id = p_tarea and t.estado = 'en-ejecución'
       and exists (select 1 from public.task_events ev
                    where ev.task_id = p_tarea and ev.run_id = p_run and ev.tipo = 'run.iniciada')
       and not exists (select 1 from public.task_events ev
                        where ev.task_id = p_tarea and ev.run_id = p_run
                          and ev.tipo = any (public.office_tipos_de_cierre()))
       and p_run = (select ev.run_id from public.task_events ev
                     where ev.task_id = p_tarea and ev.tipo = 'run.iniciada'
                     order by ev.ts desc, ev.id desc limit 1)
  );
$function$;

create or replace function public.office_entregar_corrida(
  p_tarea uuid, p_run uuid, p_tipo text, p_texto text, p_guion text, p_motivo text, p_prioridad smallint,
  p_actor text, p_resumen text)
returns boolean
language plpgsql
set search_path = ''
as $function$
begin
  if p_tipo is null or p_tipo not in ('respuesta', 'escalado') then
    raise exception 'office_entregar_corrida: tipo inválido' using errcode = '22023';
  end if;
  -- Bloquea la tarea: entregar, soltar y recuperar no se cruzan.
  perform 1 from public.office_tasks where id = p_tarea for update;
  if not public.office_corrida_en_curso(p_tarea, p_run) then
    return false;
  end if;
  insert into public.office_borradores (task_id, run_id, tipo, texto, guion, motivo, prioridad)
  values (p_tarea, p_run, p_tipo, p_texto, p_guion, p_motivo, p_prioridad);
  insert into public.task_events (task_id, run_id, tipo, actor, resumen)
  values (p_tarea, p_run, case when p_tipo = 'respuesta' then 'run.terminada' else 'run.escalada' end,
          p_actor, p_resumen);
  update public.office_tasks set estado = 'aprobación' where id = p_tarea;
  return true;
end;
$function$;

create or replace function public.office_soltar_corrida(p_tarea uuid, p_run uuid, p_resumen text)
returns boolean
language plpgsql
set search_path = ''
as $function$
begin
  perform 1 from public.office_tasks where id = p_tarea for update;
  if not public.office_corrida_en_curso(p_tarea, p_run) then
    return false;
  end if;
  insert into public.task_events (task_id, run_id, tipo, actor, resumen)
  values (p_tarea, p_run, 'run.abortada', 'sistema:despachador', p_resumen);
  update public.office_tasks set estado = 'listo' where id = p_tarea;
  return true;
end;
$function$;

create or replace function public.office_recuperar_corridas(p_agente text, p_tope_s integer default 300)
returns integer
language plpgsql
set search_path = ''
as $function$
declare
  v_actor text := public.office_agente_valido(p_agente);
  v_fila record;
  v_recuperadas integer := 0;
begin
  if p_tope_s is null or p_tope_s not between 1 and 900 then
    raise exception 'office_recuperar_corridas: el tope va de 1 a 900 s' using errcode = '22023';
  end if;
  for v_fila in
    select t.id as task_id, t.prioridad, ini.run_id
      from public.office_tasks t
      join lateral (
        select ev.run_id, ev.ts from public.task_events ev
         where ev.task_id = t.id and ev.tipo = 'run.iniciada'
         order by ev.ts desc, ev.id desc limit 1
      ) ini on true
     where t.asignado_a = v_actor and t.estado = 'en-ejecución'
       and ini.ts < pg_catalog.now() - pg_catalog.make_interval(secs => p_tope_s + 30)
       for update of t skip locked
  loop
    insert into public.office_borradores (task_id, run_id, tipo, motivo, prioridad)
    values (v_fila.task_id, v_fila.run_id, 'escalado',
            'Corrida interrumpida: el despachador se cayó a mitad. No se repite (no se llama al modelo dos veces).',
            v_fila.prioridad)
    on conflict (run_id) do nothing;
    insert into public.task_events (task_id, run_id, tipo, actor, resumen)
    values (v_fila.task_id, v_fila.run_id, 'run.interrumpida', 'sistema:despachador',
            'Sin cierre tras ' || (p_tope_s + 30) || ' s; se escala sin repetir.');
    update public.office_tasks set estado = 'aprobación' where id = v_fila.task_id;
    v_recuperadas := v_recuperadas + 1;
  end loop;
  return v_recuperadas;
end;
$function$;

create or replace function public.office_gasto_del_mes()
returns numeric
language sql
stable
set search_path = ''
as $function$
  select coalesce(pg_catalog.sum(ev.costo_usd), 0)::numeric
    from public.task_events ev
   where ev.ts >= pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'UTC') at time zone 'UTC';
$function$;

create or replace function public.office_autopausar_por_tope(p_tope_usd numeric, p_umbral numeric default 0.8)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_gasto numeric;
begin
  if p_tope_usd is null or p_tope_usd <= 0 or p_tope_usd > 10000 then
    raise exception 'office_autopausar_por_tope: el tope va de 0 a 10000 USD' using errcode = '22023';
  end if;
  if p_umbral is null or p_umbral <= 0 or p_umbral > 1 then
    raise exception 'office_autopausar_por_tope: el umbral va de 0 a 1' using errcode = '22023';
  end if;
  v_gasto := public.office_gasto_del_mes();
  if v_gasto < p_tope_usd * p_umbral then
    return false;
  end if;
  lock table public.office_paused in share row exclusive mode;
  -- SOLO PAUSA. Si ya está pausada no agrega nada; despausar es de office_cambiar_pausa (admin).
  if not public.office_esta_pausada() then
    insert into public.office_paused (pausada, cambiado_por, motivo)
    values (true, null,
            'Auto-pausa: el gasto del mes (' || pg_catalog.round(v_gasto, 4) || ' USD) llegó al '
            || pg_catalog.round(p_umbral * 100) || ' % del tope (' || p_tope_usd || ' USD). SDD-0626 §3.5, AC-5.');
  end if;
  return true;
end;
$function$;

create or replace function public.office_purgar_borradores_viejos()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_borrados integer;
begin
  delete from public.office_borradores
   where creado_en < pg_catalog.now() - interval '90 days';
  get diagnostics v_borrados = row_count;
  return v_borrados;
end;
$function$;

-- ─── 5. Dueño, privilegios y comentarios ─────────────────────
do $funciones$
declare
  v_firma text;
begin
  foreach v_firma in array array[
    'public.office_agente_valido(text)',
    'public.office_despachador_turno(uuid, integer)',
    'public.office_despachador_soltar(uuid)',
    'public.office_convertir_triaje(text, integer)',
    'public.office_tipos_de_cierre()',
    'public.office_tomar_tarea(text, integer, integer)',
    'public.office_corrida_en_curso(uuid, uuid)',
    'public.office_entregar_corrida(uuid, uuid, text, text, text, text, smallint, text, text)',
    'public.office_soltar_corrida(uuid, uuid, text)',
    'public.office_recuperar_corridas(text, integer)',
    'public.office_gasto_del_mes()',
    'public.office_autopausar_por_tope(numeric, numeric)',
    'public.office_purgar_borradores_viejos()'
  ] loop
    execute pg_catalog.format('alter function %s owner to postgres', v_firma);
    execute pg_catalog.format('revoke all on function %s from public, anon, authenticated, service_role', v_firma);
    execute pg_catalog.format('grant execute on function %s to service_role', v_firma);
  end loop;
end
$funciones$;

comment on function public.office_autopausar_por_tope(numeric, numeric) is
  'SDD-0626 §3.5 · AC-5: si el gasto del mes (task_events.costo_usd) llega al umbral del tope, pausa la oficina. '
  'SOLO PAUSA (cambiado_por = null, motivo «Auto-pausa…»); despausar es de office_cambiar_pausa (admin).';
comment on function public.office_tomar_tarea(text, integer, integer) is
  'SDD-0626 §3.4: toma UNA tarea «listo» del agente y la pasa a «en-ejecución» con un run_id nuevo. Nada si la '
  'oficina está pausada, si el agente ya tiene una corrida en curso o si cerró una hace menos de la pausa.';
comment on function public.office_recuperar_corridas(text, integer) is
  'SDD-0626 §9 (despachador): corridas sin cierre tras el tope + 30 s → run.interrumpida y escalado. No se repiten.';

alter table public.office_borradores  enable row level security;
alter table public.office_despachador enable row level security;
revoke all on public.office_borradores, public.office_despachador from public, anon, authenticated, service_role;
grant select on public.office_borradores to service_role;
grant insert (task_id, run_id, tipo, texto, guion, motivo, prioridad) on public.office_borradores to service_role;
grant select on public.office_despachador to service_role;

-- ─── 6. Postflight ───────────────────────────────────────────
do $postflight$
declare
  v_tabla text;
  v_rol text;
  v_priv text;
  v_fn record;
begin
  foreach v_tabla in array array['office_borradores', 'office_despachador'] loop
    if not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = pg_catalog.to_regclass('public.' || v_tabla)) then
      raise exception '0548 postflight: RLS apagada en %', v_tabla;
    end if;
    if exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_tabla) then
      raise exception '0548 postflight: % no debía tener policies', v_tabla;
    end if;
    foreach v_rol in array array['anon', 'authenticated'] loop
      foreach v_priv in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
        if pg_catalog.has_table_privilege(v_rol, 'public.' || v_tabla, v_priv) then
          raise exception '0548 postflight: % tiene % sobre %', v_rol, v_priv, v_tabla;
        end if;
      end loop;
      if pg_catalog.has_any_column_privilege(v_rol, 'public.' || v_tabla, 'SELECT') then
        raise exception '0548 postflight: % lee columnas de %', v_rol, v_tabla;
      end if;
    end loop;
    if pg_catalog.has_table_privilege('service_role', 'public.' || v_tabla, 'DELETE')
       or pg_catalog.has_table_privilege('service_role', 'public.' || v_tabla, 'TRUNCATE')
       or pg_catalog.has_any_column_privilege('service_role', 'public.' || v_tabla, 'UPDATE') then
      raise exception '0548 postflight: service_role cambia o borra filas de %', v_tabla;
    end if;
  end loop;
  if pg_catalog.has_any_column_privilege('service_role', 'public.office_despachador', 'INSERT') then
    raise exception '0548 postflight: service_role escribe el turno sin las funciones';
  end if;
  if pg_catalog.has_column_privilege('service_role', 'public.office_borradores', 'creado_en', 'INSERT')
     or pg_catalog.has_column_privilege('service_role', 'public.office_borradores', 'id', 'INSERT') then
    raise exception '0548 postflight: service_role pone la hora o la identidad de un borrador';
  end if;
  if pg_catalog.to_regclass('public.office_tasks_evento_unico') is null then
    raise exception '0548 postflight: falta el índice único de evento en office_tasks';
  end if;
  for v_fn in
    select * from (values
      ('public.office_despachador_turno(uuid, integer)', true),
      ('public.office_despachador_soltar(uuid)', true),
      ('public.office_convertir_triaje(text, integer)', false),
      ('public.office_tomar_tarea(text, integer, integer)', false),
      ('public.office_entregar_corrida(uuid, uuid, text, text, text, text, smallint, text, text)', false),
      ('public.office_soltar_corrida(uuid, uuid, text)', false),
      ('public.office_recuperar_corridas(text, integer)', false),
      ('public.office_gasto_del_mes()', false),
      ('public.office_autopausar_por_tope(numeric, numeric)', true),
      ('public.office_purgar_borradores_viejos()', true)
    ) as t(firma, definer)
  loop
    if not exists (
      select 1 from pg_catalog.pg_proc p
       where p.oid = pg_catalog.to_regprocedure(v_fn.firma)
         and p.prosecdef = v_fn.definer
         and p.proconfig @> array['search_path=""']
    ) then
      raise exception '0548 postflight: % sin search_path vacío o sin el SECURITY esperado', v_fn.firma;
    end if;
    if pg_catalog.has_function_privilege('anon', v_fn.firma, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', v_fn.firma, 'EXECUTE') then
      raise exception '0548 postflight: % ejecutable por anon o authenticated', v_fn.firma;
    end if;
    if not pg_catalog.has_function_privilege('service_role', v_fn.firma, 'EXECUTE') then
      raise exception '0548 postflight: service_role no ejecuta %', v_fn.firma;
    end if;
  end loop;
  -- La auto-pausa no abre ningún camino para despausar: service_role sigue sin office_cambiar_pausa.
  if pg_catalog.has_function_privilege('service_role', 'public.office_cambiar_pausa(boolean, text)', 'EXECUTE') then
    raise exception '0548 postflight: service_role puede cambiar la pausa';
  end if;
  if not exists (select 1 from public.office_despachador where id = 1) then
    raise exception '0548 postflight: falta la fila del turno';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';
