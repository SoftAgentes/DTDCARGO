\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0541 (SDD-0626 §3.1).
-- Fixtures ficticios y rollback: no toca prod.
--
-- Lo que se protege:
--   1. Aplicar la 0541 otra vez no falla ni duplica la primera fila de office_paused. La vuelta
--      0541 → desarme → 0541 la agrega el runner PGlite en el primer \ir (ver el punto 1, abajo).
--   2. task_events y office_paused son SOLO INSERT (AUD-01) en la base: UPDATE, DELETE y TRUNCATE
--      fallan para service_role, también con esos privilegios dados por error, también con
--      session_replication_role = replica (disparadores ALWAYS) y también desde una función
--      SECURITY DEFINER del dueño llamada por otro. Solo pasa el dueño de las migraciones en sesión propia.
--   2e. La única edición de la bitácora: office_vaciar_resumenes_viejos() vacía el resumen de las filas
--      de más de 90 días y deja el resto de la fila. El disparador no deja pasar nada más: ni otro
--      valor de resumen, ni otra columna, ni una fila de menos de 90 días.
--   3. Las listas cerradas: estado y modo de office_tasks, prioridad y estado de event_inbox. Lo de
--      fuera falla; todo lo permitido entra. actor y asignado_a son identificadores (agente:,
--      sistema: o persona:<uuid>), nunca nombres.
--   4. payload_ref es una referencia, nunca el mensaje del cliente (R5).
--   5. Existen los índices de task_events.task_id y event_inbox.clave_dedupe, y la clave es única:
--      un duplicado no entra y ON CONFLICT DO NOTHING lo descarta (AC-4).
--   6. office_paused nace en VERDADERO; un no administrador no la cambia (ni authenticated, ni anon,
--      ni service_role); un administrador sí, con motivo, y queda quién y cuándo. Sin filas,
--      office_esta_pausada() responde VERDADERO (falla cerrado).
--   7. RLS activada en las cuatro tablas, sin policies; anon y authenticated sin acceso.
--   8. service_role escribe por columna: nunca id, creado_en, ts ni clave_dedupe, ni el origen de
--      una fila ya creada; sí los campos de trabajo (estado, prioridad…).

begin;

do $roles$
begin
  if to_regclass('public.office_tasks') is not null or to_regclass('public.platform_admins') is not null then
    raise exception 'TEST 0541 requiere una base PostgreSQL desechable vacía';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

-- Lo mínimo de la plataforma: auth.uid() desde un GUC y el is_platform_admin() de producción.
create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;

create table public.platform_admins (user_id uuid primary key);
create function public.is_platform_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()))
$$;
grant execute on function public.is_platform_admin() to authenticated;
insert into public.platform_admins values ('00000000-0000-4000-8000-00000000a001');

-- 1. La 0541. El runner PGlite (lib/studio/__tests__/oficina-cable-tablas.migration.test.ts) corre este
--    mismo contrato con la vuelta completa en este punto: 0541 → desarme → 0541, y comprueba entre medio
--    que el desarme quitó todo lo de la 0541 y nada más. Aquí, en Postgres 17, va la 0541 sola: el desarme
--    vive fuera de supabase/migrations/ y el control C4 del CI no copia supabase/desarmes/.
\ir ../migrations/0541_oficina_cable_tablas.sql

do $nace$
begin
  if not public.office_esta_pausada() then
    raise exception 'CONTRATO 6: la primera subida no nació pausada';
  end if;
end;
$nace$;

-- Otra vez encima: no falla ni duplica la primera fila.
\ir ../migrations/0541_oficina_cable_tablas.sql

do $arriba$
begin
  if (select count(*) from public.office_paused) <> 1 then
    raise exception 'CONTRATO 1: aplicar la 0541 de nuevo duplicó la primera fila de office_paused';
  end if;
end;
$arriba$;

-- Filas válidas (como service_role, que es quien escribirá). El id y la hora los pone la base: el
-- id de la tarea de prueba se lee de vuelta, como lo leerá el despachador.
set local role service_role;
insert into public.office_tasks (titulo, estado, modo, prioridad, entidad_ref, origen, meta_datos)
values ('Responder conversación de prueba', 'listo', 'solo', 2,
        'chatwoot:conversations/1', 'chatwoot', '{"inbox":"prueba"}');
insert into public.task_events (task_id, tipo, actor, resumen, costo_usd, modelo_usado)
select t.id, 'run.iniciada', 'sistema:despachador', 'Corrida 1', 0.001234, 'glm-5.3'
  from public.office_tasks t where t.titulo = 'Responder conversación de prueba';
insert into public.event_inbox (tipo, origen, clave_dedupe, prioridad, payload_ref)
values ('chatwoot.message_created', 'chatwoot', 'chatwoot:1:10', 2, 'chatwoot:conversations/1/messages/10');
reset role;

-- 2. task_events y office_paused: SOLO INSERT.
do $solo_insertar$
declare
  v_sql text;
  v_resultado text;
  v_msg text;
  v_sesion name;
begin
  -- a) service_role, con los privilegios que deja la migración: no puede.
  foreach v_sql in array array[
    'update public.task_events set resumen = ''editado''',
    'delete from public.task_events',
    'truncate public.task_events'
  ] loop
    begin
      execute 'set local role service_role';
      execute v_sql;
      raise exception using errcode = 'DT001';
    exception
      when sqlstate 'DT001' then v_resultado := 'paso';
      when insufficient_privilege then v_resultado := 'cortado';
    end;
    execute 'reset role';
    if v_resultado = 'paso' then
      raise exception 'CONTRATO 2: service_role pudo ejecutar: %', v_sql;
    end if;
  end loop;

  -- b) Aunque alguien le dé UPDATE, DELETE y TRUNCATE por error, el disparador lo corta, en las dos
  --    tablas de solo agregar. El grant se deshace con el bloque.
  foreach v_sql in array array[
    'update public.task_events set resumen = ''editado''',
    'delete from public.task_events',
    'truncate public.task_events',
    'update public.office_paused set pausada = false',
    'delete from public.office_paused',
    'truncate public.office_paused'
  ] loop
    v_msg := null;
    begin
      grant update, delete, truncate on public.task_events, public.office_paused to service_role;
      execute 'set local role service_role';
      execute v_sql;
      raise exception using errcode = 'DT001';
    exception
      when sqlstate 'DT001' then v_resultado := 'paso';
      when insufficient_privilege then
        v_resultado := 'cortado';
        get stacked diagnostics v_msg = message_text;
    end;
    execute 'reset role';
    if v_resultado = 'paso' then
      raise exception 'CONTRATO 2: con privilegio dado por error, service_role pudo ejecutar: %', v_sql;
    end if;
    if v_msg not like '%solo se agregan filas%' then
      raise exception 'CONTRATO 2: lo cortó otra cosa y no el disparador: %', v_msg;
    end if;
  end loop;

  -- b2) session_replication_role = replica apaga los disparadores ORIGIN; los de la 0541 son ALWAYS y
  --     siguen cortando. Lo fija el superusuario de la prueba (service_role no podría) y se devuelve a
  --     mano, igual que la sesión en c).
  foreach v_sql in array array[
    'update public.task_events set resumen = ''editado''',
    'delete from public.task_events',
    'update public.office_paused set pausada = false',
    'delete from public.office_paused'
  ] loop
    v_msg := null;
    begin
      grant update, delete on public.task_events, public.office_paused to service_role;
      perform set_config('session_replication_role', 'replica', true);
      execute 'set local role service_role';
      execute v_sql;
      raise exception using errcode = 'DT001';
    exception
      when sqlstate 'DT001' then v_resultado := 'paso';
      when insufficient_privilege then
        v_resultado := 'cortado';
        get stacked diagnostics v_msg = message_text;
    end;
    execute 'reset role';
    perform set_config('session_replication_role', 'origin', true);
    if v_resultado = 'paso' then
      raise exception 'CONTRATO 2: con session_replication_role = replica, service_role pudo ejecutar: %', v_sql;
    end if;
    if v_msg not like '%solo se agregan filas%' then
      raise exception 'CONTRATO 2: en modo replica lo cortó otra cosa y no el disparador: %', v_msg;
    end if;
  end loop;

  -- c) Una función SECURITY DEFINER del dueño, llamada por otro rol, tampoco puede. La sesión se
  --    devuelve a mano al usuario original: PGlite no la revierte al abortar el bloque.
  v_msg := null;
  v_sesion := session_user;
  begin
    execute $f$
      create function public.prueba_0541_definer_edita() returns void
      language sql security definer set search_path = '' as
      $b$ update public.task_events set resumen = 'editado por definer' $b$
    $f$;
    execute 'grant execute on function public.prueba_0541_definer_edita() to service_role';
    execute 'set local session authorization service_role';
    perform public.prueba_0541_definer_edita();
    raise exception using errcode = 'DT001';
  exception
    when sqlstate 'DT001' then v_resultado := 'paso';
    when insufficient_privilege then
      v_resultado := 'cortado';
      get stacked diagnostics v_msg = message_text;
  end;
  execute format('set local session authorization %I', v_sesion);
  if session_user <> v_sesion or current_user <> v_sesion then
    raise exception 'TEST 0541: no se pudo volver a la sesión original (%/%)', session_user, current_user;
  end if;
  if v_resultado = 'paso' then
    raise exception 'CONTRATO 2: una función SECURITY DEFINER del dueño editó task_events para otro rol';
  end if;
  if v_msg not like '%solo se agregan filas%' then
    raise exception 'CONTRATO 2: a la función definer la cortó otra cosa: %', v_msg;
  end if;

  -- d) La excepción: el dueño de las migraciones en sesión propia sí puede (y aquí se deshace).
  begin
    update public.task_events set resumen = 'corrección del dueño';
    raise exception using errcode = 'DT001';
  exception
    when sqlstate 'DT001' then v_resultado := 'paso';
    when insufficient_privilege then v_resultado := 'cortado';
  end;
  if v_resultado <> 'paso' then
    raise exception 'CONTRATO 2: el dueño de las migraciones no pudo corregir en sesión propia';
  end if;

  if (select count(*) from public.task_events where resumen = 'Corrida 1') <> 1 then
    raise exception 'CONTRATO 2: la fila de task_events cambió';
  end if;
end;
$solo_insertar$;

-- 2e. Retención del resumen: la única edición de la bitácora (temporalidad, SDD-0626 §3.1).
do $retencion$
declare
  v_tarea uuid;
  v_sql text;
  v_resultado text;
  v_msg text;
  v_sesion name;
  v_vaciados integer;
  v_rol text;
begin
  select id into v_tarea from public.office_tasks where titulo = 'Responder conversación de prueba';
  -- El dueño siembra dos filas con la hora corrida (service_role no puede escribir ts).
  insert into public.task_events (id, task_id, tipo, actor, resumen, costo_usd, modelo_usado, ts) values
    ('00000000-0000-4000-8000-0000000000e1', v_tarea, 'run.terminada', 'agente:soporte-chatwoot', 'Resumen viejo',
     0.5, 'glm-5.3', now() - interval '91 days'),
    ('00000000-0000-4000-8000-0000000000e2', v_tarea, 'run.terminada', 'agente:soporte-chatwoot', 'Resumen reciente',
     0.5, 'glm-5.3', now() - interval '89 days');

  -- a) Con UPDATE dado por error, service_role no logra más que esa edición exacta.
  foreach v_sql in array array[
    'update public.task_events set resumen = ''otro'' where id = ''00000000-0000-4000-8000-0000000000e1''',
    'update public.task_events set resumen = null, costo_usd = 0 where id = ''00000000-0000-4000-8000-0000000000e1''',
    'update public.task_events set resumen = null, ts = now() where id = ''00000000-0000-4000-8000-0000000000e1''',
    'update public.task_events set resumen = null, actor = ''sistema:otro'' where id = ''00000000-0000-4000-8000-0000000000e1''',
    'update public.task_events set tipo = ''run.editada'' where id = ''00000000-0000-4000-8000-0000000000e1''',
    'update public.task_events set resumen = null where id = ''00000000-0000-4000-8000-0000000000e2'''
  ] loop
    v_msg := null;
    begin
      grant update on public.task_events to service_role;
      execute 'set local role service_role';
      execute v_sql;
      raise exception using errcode = 'DT001';
    exception
      when sqlstate 'DT001' then v_resultado := 'paso';
      when insufficient_privilege then
        v_resultado := 'cortado';
        get stacked diagnostics v_msg = message_text;
    end;
    execute 'reset role';
    if v_resultado = 'paso' then
      raise exception 'CONTRATO 2e: el solo agregar dejó pasar: %', v_sql;
    end if;
    if v_msg not like '%solo se agregan filas%' then
      raise exception 'CONTRATO 2e: lo cortó otra cosa y no el disparador: %', v_msg;
    end if;
  end loop;

  -- b) anon y authenticated no la ejecutan.
  foreach v_rol in array array['anon', 'authenticated'] loop
    begin
      execute format('set local role %I', v_rol);
      perform public.office_vaciar_resumenes_viejos();
      raise exception using errcode = 'DT001';
    exception
      when sqlstate 'DT001' then v_resultado := 'paso';
      when insufficient_privilege then v_resultado := 'cortado';
    end;
    execute 'reset role';
    if v_resultado = 'paso' then
      raise exception 'CONTRATO 2e: % pudo vaciar resúmenes', v_rol;
    end if;
  end loop;

  -- c) El camino de verdad: service_role en su propia sesión, como entra por la API (session_user no es el
  --    dueño, así que la excepción del dueño no aplica y decide la de la retención). La sesión se devuelve
  --    a mano, como en 2c.
  v_sesion := session_user;
  begin
    execute 'set local session authorization service_role';
    v_vaciados := public.office_vaciar_resumenes_viejos();
  exception
    when insufficient_privilege then
      get stacked diagnostics v_msg = message_text;
      execute format('set local session authorization %I', v_sesion);
      raise exception 'CONTRATO 2e: el disparador no dejó vaciar los resúmenes viejos: %', v_msg;
  end;
  execute format('set local session authorization %I', v_sesion);
  if session_user <> v_sesion or current_user <> v_sesion then
    raise exception 'TEST 0541: no se pudo volver a la sesión original (%/%)', session_user, current_user;
  end if;

  if v_vaciados is distinct from 1 then
    raise exception 'CONTRATO 2e: office_vaciar_resumenes_viejos() vació % filas, no 1', v_vaciados;
  end if;
  if (select resumen from public.task_events where id = '00000000-0000-4000-8000-0000000000e2')
     is distinct from 'Resumen reciente' then
    raise exception 'CONTRATO 2e: se vació un resumen de menos de 90 días';
  end if;
  if not exists (
    select 1 from public.task_events
     where id = '00000000-0000-4000-8000-0000000000e1' and resumen is null
       and task_id = v_tarea and tipo = 'run.terminada' and actor = 'agente:soporte-chatwoot'
       and costo_usd = 0.5 and modelo_usado = 'glm-5.3' and ts < now() - interval '90 days'
  ) then
    raise exception 'CONTRATO 2e: el resumen viejo no quedó vacío o se tocó otra columna de la fila';
  end if;
end;
$retencion$;

-- 3 y 4. Listas cerradas y referencias: cada caso fuera tiene que caer por un CHECK (23514).
do $listas$
declare
  v_valor text;
  v_caso record;
begin
  foreach v_valor in array array['borrador', 'listo', 'en-ejecución', 'auditoría', 'aprobación', 'terminada'] loop
    insert into public.office_tasks (titulo, estado) values ('Estado ' || v_valor, v_valor);
  end loop;
  insert into public.office_tasks (titulo, modo) values ('Modo solo', 'solo'), ('Modo equipo', 'equipo');
  insert into public.event_inbox (tipo, origen, clave_dedupe, prioridad)
  values ('prueba', 'interno', 'p:3', 3), ('prueba', 'interno', 'p:2', 2), ('prueba', 'interno', 'p:1', 1);
  foreach v_valor in array array['nuevo', 'triaje', 'convertido', 'descartado'] loop
    insert into public.event_inbox (tipo, origen, clave_dedupe, estado) values ('prueba', 'interno', 'e:' || v_valor, v_valor);
  end loop;
  -- Identificadores: agente, sistema o persona por su uuid.
  foreach v_valor in array array['agente:soporte-chatwoot', 'sistema:despachador',
                                  'persona:00000000-0000-4000-8000-00000000a001'] loop
    insert into public.task_events (task_id, tipo, actor)
    select id, 'paso.prueba', v_valor from public.office_tasks where titulo = 'Responder conversación de prueba';
    insert into public.office_tasks (titulo, asignado_a) values ('Asignada a ' || v_valor, v_valor);
  end loop;

  for v_caso in
    select * from (values
      ('estado fuera de la lista', 'insert into public.office_tasks (titulo, estado) values (''x'', ''cancelada'')'),
      ('estado sin tilde',         'insert into public.office_tasks (titulo, estado) values (''x'', ''en-ejecucion'')'),
      ('estado en mayúscula',      'insert into public.office_tasks (titulo, estado) values (''x'', ''Listo'')'),
      ('modo fuera de la lista',   'insert into public.office_tasks (titulo, modo) values (''x'', ''grupo'')'),
      ('meta_datos no objeto',     'insert into public.office_tasks (titulo, meta_datos) values (''x'', ''[]'')'),
      ('prioridad 0',              'insert into public.event_inbox (tipo, origen, clave_dedupe, prioridad) values (''prueba'', ''interno'', ''k'', 0)'),
      ('prioridad 4',              'insert into public.event_inbox (tipo, origen, clave_dedupe, prioridad) values (''prueba'', ''interno'', ''k'', 4)'),
      ('estado de bandeja',        'insert into public.event_inbox (tipo, origen, clave_dedupe, estado) values (''prueba'', ''interno'', ''k'', ''procesado'')'),
      ('costo negativo',           'insert into public.task_events (task_id, tipo, actor, costo_usd) select id, ''x'', ''sistema:prueba'', -1 from public.office_tasks limit 1'),
      ('mensaje completo',         'insert into public.event_inbox (tipo, origen, clave_dedupe, payload_ref) values (''prueba'', ''chatwoot'', ''k'', ''Hola, quiero saber dónde está mi paquete'')'),
      ('mensaje tras el origen',   'insert into public.event_inbox (tipo, origen, clave_dedupe, payload_ref) values (''prueba'', ''chatwoot'', ''k'', ''chatwoot:hola mi pedido'')'),
      ('referencia sin origen',    'insert into public.event_inbox (tipo, origen, clave_dedupe, payload_ref) values (''prueba'', ''chatwoot'', ''k'', ''conversations/1'')'),
      ('referencia demasiado larga', 'insert into public.event_inbox (tipo, origen, clave_dedupe, payload_ref) values (''prueba'', ''chatwoot'', ''k'', ''chatwoot:'' || repeat(''x'', 300))'),
      ('actor con nombre',         'insert into public.task_events (task_id, tipo, actor) select id, ''x'', ''Juan Pérez'' from public.office_tasks limit 1'),
      ('actor sin prefijo',        'insert into public.task_events (task_id, tipo, actor) select id, ''x'', ''soporte-chatwoot'' from public.office_tasks limit 1'),
      ('actor persona sin uuid',   'insert into public.task_events (task_id, tipo, actor) select id, ''x'', ''persona:juan-perez'' from public.office_tasks limit 1'),
      ('actor con correo',         'insert into public.task_events (task_id, tipo, actor) select id, ''x'', ''persona:juan@ejemplo.test'' from public.office_tasks limit 1'),
      ('asignado_a con nombre',    'insert into public.office_tasks (titulo, asignado_a) values (''x'', ''María'')'),
      ('asignado_a persona sin uuid', 'insert into public.office_tasks (titulo, asignado_a) values (''x'', ''persona:maria'')')
    ) as t(nombre, sentencia)
  loop
    begin
      execute v_caso.sentencia;
      raise exception 'CONTRATO 3/4: entró una fila inválida (%)', v_caso.nombre;
    exception
      when check_violation then null;
    end;
  end loop;
end;
$listas$;

-- 5. Índices, y la clave de dedupe única (AC-4).
do $indices$
declare
  v_resultado text;
begin
  if not exists (
    select 1 from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
     where i.indrelid = 'public.task_events'::regclass and a.attname = 'task_id'
  ) then
    raise exception 'CONTRATO 5: falta el índice de task_events.task_id';
  end if;
  if not exists (
    select 1 from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
     where i.indrelid = 'public.event_inbox'::regclass and a.attname = 'clave_dedupe'
  ) then
    raise exception 'CONTRATO 5: falta el índice de event_inbox.clave_dedupe';
  end if;

  -- La misma clave otra vez, como la mandaría una segunda entrega del webhook: no entra.
  begin
    execute 'set local role service_role';
    insert into public.event_inbox (tipo, origen, clave_dedupe, prioridad, payload_ref)
    values ('chatwoot.message_created', 'chatwoot', 'chatwoot:1:10', 2, 'chatwoot:conversations/1/messages/10');
    raise exception using errcode = 'DT001';
  exception
    when sqlstate 'DT001' then v_resultado := 'paso';
    when unique_violation then v_resultado := 'cortado';
  end;
  execute 'reset role';
  if v_resultado = 'paso' then
    raise exception 'CONTRATO 5: entró una clave_dedupe repetida (AC-4)';
  end if;

  -- Y con ON CONFLICT DO NOTHING, como insertará el webhook, se descarta sin error.
  execute 'set local role service_role';
  insert into public.event_inbox (tipo, origen, clave_dedupe, prioridad, payload_ref)
  values ('chatwoot.message_created', 'chatwoot', 'chatwoot:1:10', 2, 'chatwoot:conversations/1/messages/10')
  on conflict (clave_dedupe) do nothing;
  execute 'reset role';
  if (select count(*) from public.event_inbox where clave_dedupe = 'chatwoot:1:10') <> 1 then
    raise exception 'CONTRATO 5: la clave chatwoot:1:10 no quedó una sola vez';
  end if;
end;
$indices$;

-- 6. office_paused.
do $bandera$
declare
  v_caso record;
  v_resultado text;
  v_admin constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_otro  constant uuid := '00000000-0000-4000-8000-00000000b002';
  v_fila record;
begin
  if not public.office_esta_pausada()
     or (select count(*) from public.office_paused) <> 1
     or not (select pausada from public.office_paused) then
    raise exception 'CONTRATO 6: office_paused no nació en verdadero';
  end if;

  -- Nadie que no sea administrador la cambia.
  for v_caso in
    select * from (values
      ('authenticated', v_otro::text, 'select public.office_cambiar_pausa(false, ''quiero despausar'')'),
      ('authenticated', v_otro::text, 'insert into public.office_paused (pausada, motivo) values (false, ''x'')'),
      ('authenticated', v_otro::text, 'update public.office_paused set pausada = false'),
      ('authenticated', v_admin::text, 'insert into public.office_paused (pausada, motivo) values (false, ''x'')'),
      ('authenticated', v_admin::text, 'update public.office_paused set pausada = false'),
      ('anon',          '',           'select public.office_cambiar_pausa(false, ''x'')'),
      ('service_role',  '',           'select public.office_cambiar_pausa(false, ''x'')'),
      ('service_role',  '',           'insert into public.office_paused (pausada, motivo) values (false, ''x'')'),
      ('service_role',  '',           'update public.office_paused set pausada = false'),
      ('service_role',  '',           'delete from public.office_paused')
    ) as t(rol, uid, sentencia)
  loop
    begin
      perform set_config('test.uid', v_caso.uid, true);
      execute format('set local role %I', v_caso.rol);
      execute v_caso.sentencia;
      raise exception using errcode = 'DT001';
    exception
      when sqlstate 'DT001' then v_resultado := 'paso';
      when insufficient_privilege then v_resultado := 'cortado';
    end;
    execute 'reset role';
    if v_resultado = 'paso' then
      raise exception 'CONTRATO 6: % (uid %) cambió la bandera con: %', v_caso.rol, v_caso.uid, v_caso.sentencia;
    end if;
  end loop;
  perform set_config('test.uid', '', true);

  if not public.office_esta_pausada() or (select count(*) from public.office_paused) <> 1 then
    raise exception 'CONTRATO 6: la bandera cambió sin un administrador';
  end if;

  -- El administrador sí, con motivo; sin motivo, no.
  perform set_config('test.uid', v_admin::text, true);
  execute 'set local role authenticated';
  begin
    perform public.office_cambiar_pausa(false, '   ');
    raise exception 'CONTRATO 6: se cambió la bandera sin motivo';
  exception
    when invalid_parameter_value then null;
  end;
  if public.office_cambiar_pausa(false, 'Prueba del contrato: despausar') is distinct from false then
    raise exception 'CONTRATO 6: office_cambiar_pausa no devolvió el valor nuevo';
  end if;
  execute 'reset role';
  perform set_config('test.uid', '', true);

  if public.office_esta_pausada() then
    raise exception 'CONTRATO 6: el administrador no pudo despausar';
  end if;
  select * into v_fila from public.office_paused order by id desc limit 1;
  if v_fila.cambiado_por is distinct from v_admin or v_fila.cambiado_en is null
     or v_fila.motivo <> 'Prueba del contrato: despausar' then
    raise exception 'CONTRATO 6: el cambio no guardó quién, cuándo y por qué';
  end if;
  if (select count(*) from public.office_paused) <> 2
     or not (select pausada from public.office_paused order by id limit 1) then
    raise exception 'CONTRATO 6: el historial de office_paused no es de solo agregar';
  end if;

  -- Sin filas, la bandera falla cerrado: VERDADERO aunque el último valor fuera falso. Vaciarla solo lo
  -- puede el dueño en sesión propia, y el bloque lo deshace.
  begin
    delete from public.office_paused;
    if (select count(*) from public.office_paused) <> 0 then
      raise exception 'TEST 0541: el dueño no pudo vaciar office_paused';
    end if;
    if public.office_esta_pausada() is distinct from true then
      raise exception 'CONTRATO 6: sin filas, office_esta_pausada() no falló cerrado';
    end if;
    raise exception using errcode = 'DT001';
  exception
    when sqlstate 'DT001' then null;
  end;
  if public.office_esta_pausada() or (select count(*) from public.office_paused) <> 2 then
    raise exception 'TEST 0541: vaciar office_paused no se deshizo';
  end if;

  -- service_role (el despachador) lee el valor vigente; anon y authenticated no.
  execute 'set local role service_role';
  if public.office_esta_pausada() then
    raise exception 'CONTRATO 6: service_role no lee el valor vigente';
  end if;
  execute 'reset role';
end;
$bandera$;

-- 7. RLS y privilegios: ni anon ni authenticated tocan las tablas; service_role no borra.
do $privilegios$
declare
  v_tabla text;
  v_rol text;
  v_sql text;
  v_resultado text;
begin
  foreach v_tabla in array array['office_tasks', 'task_events', 'event_inbox', 'office_paused'] loop
    if not (select relrowsecurity from pg_catalog.pg_class where oid = ('public.' || v_tabla)::regclass) then
      raise exception 'CONTRATO 7: RLS apagada en %', v_tabla;
    end if;
    if exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_tabla) then
      raise exception 'CONTRATO 7: % no debía tener policies', v_tabla;
    end if;
    foreach v_rol in array array['anon', 'authenticated'] loop
      foreach v_sql in array array[
        format('select count(*) from public.%I', v_tabla),
        format('delete from public.%I', v_tabla),
        format('truncate public.%I cascade', v_tabla)
      ] loop
        begin
          execute format('set local role %I', v_rol);
          execute v_sql;
          raise exception using errcode = 'DT001';
        exception
          when sqlstate 'DT001' then v_resultado := 'paso';
          when insufficient_privilege then v_resultado := 'cortado';
        end;
        execute 'reset role';
        if v_resultado = 'paso' then
          raise exception 'CONTRATO 7: % pudo ejecutar: %', v_rol, v_sql;
        end if;
      end loop;
    end loop;
    begin
      execute 'set local role service_role';
      execute format('delete from public.%I', v_tabla);
      raise exception using errcode = 'DT001';
    exception
      when sqlstate 'DT001' then v_resultado := 'paso';
      when insufficient_privilege then v_resultado := 'cortado';
    end;
    execute 'reset role';
    if v_resultado = 'paso' then
      raise exception 'CONTRATO 7: service_role pudo borrar en %', v_tabla;
    end if;
  end loop;

  foreach v_rol in array array['anon', 'authenticated'] loop
    begin
      execute format('set local role %I', v_rol);
      perform public.office_esta_pausada();
      raise exception using errcode = 'DT001';
    exception
      when sqlstate 'DT001' then v_resultado := 'paso';
      when insufficient_privilege then v_resultado := 'cortado';
    end;
    execute 'reset role';
    if v_resultado = 'paso' then
      raise exception 'CONTRATO 7: % puede leer office_esta_pausada()', v_rol;
    end if;
  end loop;
end;
$privilegios$;

-- 8. service_role escribe por columna: la identidad, la hora y el origen de cada fila los pone la base.
do $columnas$
declare
  v_sql text;
  v_resultado text;
begin
  foreach v_sql in array array[
    'insert into public.office_tasks (id, titulo) values (gen_random_uuid(), ''x'')',
    'insert into public.office_tasks (titulo, creado_en) values (''x'', now() - interval ''1 day'')',
    'update public.office_tasks set id = gen_random_uuid() where titulo = ''Modo solo''',
    'update public.office_tasks set creado_en = now() - interval ''1 day''',
    'update public.office_tasks set origen = ''otro''',
    'insert into public.task_events (id, task_id, tipo, actor) select gen_random_uuid(), id, ''x'', ''sistema:despachador'' from public.office_tasks limit 1',
    'insert into public.task_events (task_id, tipo, actor, ts) select id, ''x'', ''sistema:despachador'', now() - interval ''1 day'' from public.office_tasks limit 1',
    'insert into public.event_inbox (tipo, origen, clave_dedupe, ts) values (''prueba'', ''interno'', ''c:ts'', now() - interval ''1 day'')',
    'update public.event_inbox set clave_dedupe = ''otra'' where clave_dedupe = ''p:3''',
    'update public.event_inbox set payload_ref = ''chatwoot:otra''',
    'update public.event_inbox set ts = now() - interval ''1 day''',
    'update public.event_inbox set id = gen_random_uuid()'
  ] loop
    begin
      execute 'set local role service_role';
      execute v_sql;
      raise exception using errcode = 'DT001';
    exception
      when sqlstate 'DT001' then v_resultado := 'paso';
      when insufficient_privilege then v_resultado := 'cortado';
    end;
    execute 'reset role';
    if v_resultado = 'paso' then
      raise exception 'CONTRATO 8: service_role pudo: %', v_sql;
    end if;
  end loop;

  -- Los campos de trabajo sí: el despachador mueve el estado de la tarea y el triaje el de la bandeja.
  execute 'set local role service_role';
  update public.office_tasks set estado = 'en-ejecución', meta_datos = '{"paso":1}'
   where titulo = 'Responder conversación de prueba';
  update public.event_inbox set estado = 'triaje', prioridad = 3 where clave_dedupe = 'chatwoot:1:10';
  execute 'reset role';
  if not exists (select 1 from public.office_tasks where titulo = 'Responder conversación de prueba'
                  and estado = 'en-ejecución')
     or not exists (select 1 from public.event_inbox where clave_dedupe = 'chatwoot:1:10'
                     and estado = 'triaje' and prioridad = 3) then
    raise exception 'CONTRATO 8: service_role no pudo mover el estado de la tarea o de la bandeja';
  end if;
end;
$columnas$;

rollback;

\echo 'TEST 0541 OK'
