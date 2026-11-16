\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0548 (SDD-0626 Paso 3a): el despachador mínimo del cable.
-- Fixtures ficticios y rollback: no toca prod.
--
-- Lo que se protege:
--   1. Aplicar la 0548 otra vez no falla.
--   2. Pausada (la oficina nace pausada): no convierte la bandeja ni toma tareas.
--   3. Convertir: cada evento en «triaje» da UNA tarea «listo» del agente, y el evento pasa a «convertido».
--      Repetirlo no duplica.
--   4. Tomar: una tarea a la vez por agente; la pausa entre corridas (10 s) se respeta.
--   5. Entregar: guarda el borrador, anota el cierre y pasa a «aprobación». Una corrida ya cerrada, o
--      que no es la vigente, no se entrega dos veces. Soltar (pausa) devuelve la tarea a «listo».
--   6. Recuperar: una corrida sin cierre tras el tope + 30 s se escala como interrumpida, sin repetirse.
--   7. Auto-pausa: al 80 % del tope del mes pausa la oficina; SOLO pausa (nunca agrega «false»).
--   8. Purga: los borradores de más de 90 días se borran; los demás quedan.
--   9. Privilegios: anon y authenticated no alcanzan nada; service_role no cambia ni borra borradores,
--      no toca el turno sin las funciones y sigue sin poder despausar.
--  10. Turno: una tanda a la vez; otra tanda no lo toma mientras no venza.

begin;

do $roles$
begin
  if to_regclass('public.office_tasks') is not null or to_regclass('public.platform_admins') is not null then
    raise exception 'TEST 0548 requiere una base PostgreSQL desechable vacía';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;

create table public.platform_admins (user_id uuid primary key);
create function public.is_platform_admin()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_platform_admin() from public, anon, authenticated;
grant execute on function public.is_platform_admin() to service_role;

\ir ../migrations/0541_oficina_cable_tablas.sql
\ir ../migrations/0544_oficina_filtro_bandeja.sql
\ir ../migrations/0548_oficina_despachador.sql
-- Otra vez encima: no falla.
\ir ../migrations/0548_oficina_despachador.sql

-- Tres eventos ya en «triaje» (como los deja el filtro): uno de dinero y dos de cliente.
insert into public.event_inbox (tipo, origen, clave_dedupe, prioridad, payload_ref, estado, triaje_en)
values ('chatwoot.message_created', 'chatwoot', 'chatwoot:conv:1:msg:1', 2, 'chatwoot:conversations/1/messages/1', 'triaje', now()),
       ('chatwoot.message_created', 'chatwoot', 'chatwoot:conv:2:msg:2', 3, 'chatwoot:conversations/2/messages/2', 'triaje', now()),
       ('chatwoot.message_created', 'chatwoot', 'chatwoot:conv:3:msg:3', 2, 'chatwoot:conversations/3/messages/3', 'triaje', now());

-- 2. Pausada: nada se convierte ni se toma.
do $pausada$
declare
  v integer;
  n integer;
begin
  set local role service_role;
  v := public.office_convertir_triaje('soporte-chatwoot', 20);
  select count(*) into n from public.office_tomar_tarea('soporte-chatwoot', 10, 300);
  reset role;
  if v <> 0 or n <> 0 or (select count(*) from public.office_tasks) <> 0 then
    raise exception 'CONTRATO 2: con la oficina pausada el despachador movió algo';
  end if;
end;
$pausada$;

-- Despausar (el dueño, en sesión propia: lo que haría office_cambiar_pausa de un admin).
insert into public.office_paused (pausada, motivo) values (false, 'Contrato 0548: despausada para la prueba.');

-- 3. Convertir.
do $convertir$
declare
  v integer;
begin
  set local role service_role;
  v := public.office_convertir_triaje('soporte-chatwoot', 20);
  reset role;
  if v <> 3 then
    raise exception 'CONTRATO 3: debía convertir 3, convirtió %', v;
  end if;
  if (select count(*) from public.office_tasks
       where estado = 'listo' and asignado_a = 'agente:soporte-chatwoot' and origen = 'event_inbox') <> 3 then
    raise exception 'CONTRATO 3: las tareas no quedaron «listo» del agente';
  end if;
  if exists (select 1 from public.event_inbox where estado <> 'convertido') then
    raise exception 'CONTRATO 3: un evento no pasó a «convertido»';
  end if;
  if (select prioridad from public.office_tasks where entidad_ref = 'chatwoot:conversations/2/messages/2') <> 3 then
    raise exception 'CONTRATO 3: la tarea no heredó la prioridad del evento';
  end if;
  -- Otra vez: nada nuevo, y aunque un evento volviera a «triaje» no da otra tarea.
  update public.event_inbox set estado = 'triaje' where clave_dedupe = 'chatwoot:conv:1:msg:1';
  set local role service_role;
  v := public.office_convertir_triaje('soporte-chatwoot', 20);
  reset role;
  if v <> 0 or (select count(*) from public.office_tasks) <> 3 then
    raise exception 'CONTRATO 3: un evento dio dos tareas';
  end if;
  if (select count(*) from public.task_events where tipo = 'tarea.creada') <> 3 then
    raise exception 'CONTRATO 3: falta o sobra el evento tarea.creada';
  end if;
end;
$convertir$;

-- 4 y 5. Tomar, entregar, soltar.
do $corridas$
declare
  r record;
  r2 record;
  ok boolean;
  n integer;
begin
  set local role service_role;
  select * into r from public.office_tomar_tarea('soporte-chatwoot', 10, 300);
  reset role;
  if r.task_id is null or r.entidad_ref <> 'chatwoot:conversations/2/messages/2' then
    raise exception 'CONTRATO 4: debía tomar primero la de dinero';
  end if;
  if (select estado from public.office_tasks where id = r.task_id) <> 'en-ejecución' then
    raise exception 'CONTRATO 4: la tarea tomada no quedó «en-ejecución»';
  end if;
  -- 1 corrida por agente a la vez.
  set local role service_role;
  select count(*) into n from public.office_tomar_tarea('soporte-chatwoot', 0, 300);
  reset role;
  if n <> 0 then
    raise exception 'CONTRATO 4: tomó una segunda tarea con otra en curso';
  end if;
  -- Entregar una corrida que no es la vigente: no.
  set local role service_role;
  ok := public.office_entregar_corrida(r.task_id, gen_random_uuid(), 'respuesta', 'Hola', 'acuse-general', null, null,
                                       'agente:soporte-chatwoot', 'x');
  reset role;
  if ok then raise exception 'CONTRATO 5: entregó una corrida que no era la vigente'; end if;
  -- Entregar la vigente.
  set local role service_role;
  ok := public.office_entregar_corrida(r.task_id, r.run_id, 'respuesta', 'Hola, entiendo tu consulta.', 'acuse-general',
                                       null, null, 'agente:soporte-chatwoot', 'Borrador listo para Sam.');
  reset role;
  if not ok or (select estado from public.office_tasks where id = r.task_id) <> 'aprobación'
     or (select count(*) from public.office_borradores where run_id = r.run_id and tipo = 'respuesta') <> 1
     or (select count(*) from public.task_events where run_id = r.run_id and tipo = 'run.terminada') <> 1 then
    raise exception 'CONTRATO 5: la entrega no dejó borrador, cierre y «aprobación»';
  end if;
  -- Dos veces: no.
  set local role service_role;
  ok := public.office_entregar_corrida(r.task_id, r.run_id, 'respuesta', 'Otra', 'acuse-general', null, null,
                                       'agente:soporte-chatwoot', 'x');
  reset role;
  if ok or (select count(*) from public.office_borradores) <> 1 then
    raise exception 'CONTRATO 5: entregó dos veces la misma corrida';
  end if;
  -- La pausa entre corridas: con 10 s no toma; con 0 s sí.
  set local role service_role;
  select count(*) into n from public.office_tomar_tarea('soporte-chatwoot', 10, 300);
  reset role;
  if n <> 0 then raise exception 'CONTRATO 4: no respetó la pausa de 10 s entre corridas'; end if;
  set local role service_role;
  select * into r2 from public.office_tomar_tarea('soporte-chatwoot', 0, 300);
  -- Soltar (la pausa abortó): vuelve a «listo».
  ok := public.office_soltar_corrida(r2.task_id, r2.run_id, 'Abortada por office_paused.');
  reset role;
  if not ok or (select estado from public.office_tasks where id = r2.task_id) <> 'listo'
     or (select count(*) from public.task_events where run_id = r2.run_id and tipo = 'run.abortada') <> 1 then
    raise exception 'CONTRATO 5: soltar no devolvió la tarea a «listo»';
  end if;
  set local role service_role;
  ok := public.office_entregar_corrida(r2.task_id, r2.run_id, 'escalado', null, null, 'tarde', 2::smallint,
                                       'agente:soporte-chatwoot', 'x');
  reset role;
  if ok then raise exception 'CONTRATO 5: entregó un resultado tardío de una corrida soltada'; end if;
  -- Un borrador con la forma mala no entra.
  begin
    insert into public.office_borradores (task_id, run_id, tipo, texto) values (r.task_id, gen_random_uuid(), 'respuesta', 'sin guion');
    raise exception 'CONTRATO 5: entró una respuesta sin guion';
  exception when check_violation then null;
  end;
end;
$corridas$;

-- 6. Recuperar: una corrida iniciada hace 10 min sin cierre.
do $recuperar$
declare
  v_tarea uuid;
  v_run uuid := gen_random_uuid();
  v integer;
begin
  select id into v_tarea from public.office_tasks where estado = 'listo' order by creado_en limit 1;
  update public.office_tasks set estado = 'en-ejecución' where id = v_tarea;
  insert into public.task_events (task_id, run_id, tipo, actor, ts)
  values (v_tarea, v_run, 'run.iniciada', 'sistema:despachador', now() - interval '10 minutes');
  set local role service_role;
  v := public.office_recuperar_corridas('soporte-chatwoot', 300);
  reset role;
  if v <> 1 or (select estado from public.office_tasks where id = v_tarea) <> 'aprobación'
     or (select count(*) from public.task_events where run_id = v_run and tipo = 'run.interrumpida') <> 1
     or (select count(*) from public.office_borradores where run_id = v_run and tipo = 'escalado') <> 1 then
    raise exception 'CONTRATO 6: la corrida caída no se escaló como interrumpida';
  end if;
  -- Otra vez: nada (no se repite).
  set local role service_role;
  v := public.office_recuperar_corridas('soporte-chatwoot', 300);
  reset role;
  if v <> 0 then raise exception 'CONTRATO 6: recuperó dos veces la misma corrida'; end if;
end;
$recuperar$;

-- 7. Auto-pausa.
do $autopausa$
declare
  v_tarea uuid := (select id from public.office_tasks limit 1);
  v boolean;
  n integer;
begin
  insert into public.task_events (task_id, tipo, actor, costo_usd) values (v_tarea, 'modelo.respuesta', 'agente:soporte-chatwoot', 11.5);
  set local role service_role;
  v := public.office_autopausar_por_tope(15, 0.8);
  reset role;
  if v or public.office_esta_pausada() then
    raise exception 'CONTRATO 7: pausó por debajo del 80 %%';
  end if;
  insert into public.task_events (task_id, tipo, actor, costo_usd) values (v_tarea, 'modelo.respuesta', 'agente:soporte-chatwoot', 0.5);
  select count(*) into n from public.office_paused;
  set local role service_role;
  v := public.office_autopausar_por_tope(15, 0.8);
  v := public.office_autopausar_por_tope(15, 0.8);
  reset role;
  if not v or not public.office_esta_pausada() or (select count(*) from public.office_paused) <> n + 1 then
    raise exception 'CONTRATO 7: al 80 %% no pausó una sola vez';
  end if;
  if exists (select 1 from public.office_paused where cambiado_por is null and motivo like 'Auto-pausa%' and not pausada) then
    raise exception 'CONTRATO 7: la auto-pausa despausó';
  end if;
  -- Topes absurdos: no.
  begin
    set local role service_role;
    perform public.office_autopausar_por_tope(0, 0.8);
    raise exception 'CONTRATO 7: aceptó un tope de 0';
  exception when invalid_parameter_value then null;
  end;
  reset role;
  -- Pausada: el despachador ya no toma nada.
  set local role service_role;
  select count(*) into n from public.office_tomar_tarea('soporte-chatwoot', 0, 300);
  reset role;
  if n <> 0 then raise exception 'CONTRATO 7: tomó una tarea tras la auto-pausa'; end if;
end;
$autopausa$;

-- 8. Purga a los 90 días.
do $purga$
declare
  v_tarea uuid := (select id from public.office_tasks limit 1);
  v integer;
begin
  insert into public.office_borradores (task_id, run_id, tipo, motivo, prioridad, creado_en)
  values (v_tarea, gen_random_uuid(), 'escalado', 'viejo', 1, now() - interval '91 days');
  set local role service_role;
  v := public.office_purgar_borradores_viejos();
  reset role;
  if v <> 1 or exists (select 1 from public.office_borradores where creado_en < now() - interval '90 days')
     or (select count(*) from public.office_borradores) <> 2 then
    raise exception 'CONTRATO 8: la purga no borró solo lo de más de 90 días';
  end if;
end;
$purga$;

-- 9 y 10. Privilegios y turno.
do $privilegios$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
begin
  begin
    set local role service_role;
    update public.office_borradores set texto = 'cambiado';
    raise exception 'CONTRATO 9: service_role cambió un borrador';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role service_role;
    delete from public.office_borradores;
    raise exception 'CONTRATO 9: service_role borró borradores';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role service_role;
    update public.office_despachador set dueno = gen_random_uuid();
    raise exception 'CONTRATO 9: service_role tocó el turno sin las funciones';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role service_role;
    perform public.office_cambiar_pausa(false, 'intento');
    raise exception 'CONTRATO 9: service_role despausó';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role authenticated;
    perform public.office_tomar_tarea('soporte-chatwoot', 0, 300);
    raise exception 'CONTRATO 9: authenticated ejecutó el despachador';
  exception when insufficient_privilege then null;
  end;
  reset role;
  if has_any_column_privilege('anon', 'public.office_borradores', 'SELECT')
     or has_any_column_privilege('authenticated', 'public.office_borradores', 'SELECT') then
    raise exception 'CONTRATO 9: anon o authenticated leen los borradores';
  end if;

  set local role service_role;
  if not public.office_despachador_turno(a, 60) then raise exception 'CONTRATO 10: el primero no tomó el turno'; end if;
  if public.office_despachador_turno(b, 60) then raise exception 'CONTRATO 10: dos tandas a la vez'; end if;
  if not public.office_despachador_turno(a, 60) then raise exception 'CONTRATO 10: el dueño no renovó su turno'; end if;
  if public.office_despachador_soltar(b) then raise exception 'CONTRATO 10: otro soltó el turno ajeno'; end if;
  if not public.office_despachador_soltar(a) then raise exception 'CONTRATO 10: el dueño no soltó'; end if;
  if not public.office_despachador_turno(b, 60) then raise exception 'CONTRATO 10: tras soltar, otro no tomó'; end if;
  reset role;
end;
$privilegios$;

rollback;
