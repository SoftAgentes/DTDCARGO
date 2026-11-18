\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0549 (SDD-0626 Paso 3b): la revisión de Sam y el envío desde el ERP.
-- Fixtures ficticios y rollback: no toca prod.
--
-- Lo que se protege:
--   1. Aplicar la 0549 otra vez no falla.
--   2. Revisar: solo un superadministrador (is_platform_admin); las 5 casillas y el motivo son obligatorios;
--      no se aprueba un envío con datos inventados o repetidos; una revisión por borrador; guarda quién, cuándo
--      y la huella. Rechazado o escalado → la tarea termina; aprobado → queda para el envío.
--   3. Solo se agregan filas: ni UPDATE ni DELETE en office_revisiones ni en office_envios, ni siquiera con
--      el privilegio prestado (el disparador ALWAYS de la 0541 lo corta).
--   4. Conteo (AC-1 y AC-7, la misma consulta): 10 conversaciones con 9 correctas cumplen la etapa 1; con 8 o con
--      un dato inventado, no.
--   5. Envío: solo lo aprobado; pausada no da nada; reservar mira otra vez la pausa y la huella; un borrador se
--      reserva una sola vez; enviado termina la tarea; cerrar dos veces no hace nada.
--   6. Sesiones por borrar: se anotan, se listan, vencen y se quitan; solo ids de sesión del cable.
--   7. Privilegios: anon y authenticated no leen ni escriben las tablas; authenticated no llama a las funciones
--      del ERP; service_role no llama a las de la página.
--   8. B3: la revisión guarda la conversación aprobada y el envío no sale si la tarea cambió de conversación o si
--      el ERP pide otra. B1: una aprobación de más de 24 h vence. El ERP bloquea una vez (y la tarea termina). M1:
--      un envío incierto queda «enviando» con su aviso y nunca vuelve a la lista.

begin;

do $roles$
begin
  if to_regclass('public.office_tasks') is not null or to_regclass('public.platform_admins') is not null then
    raise exception 'TEST 0549 requiere una base PostgreSQL desechable vacía';
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
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;

\ir ../migrations/0541_oficina_cable_tablas.sql
\ir ../migrations/0544_oficina_filtro_bandeja.sql
\ir ../migrations/0548_oficina_despachador.sql
\ir ../migrations/0549_oficina_revisiones_envio.sql
-- Otra vez encima: no falla.
\ir ../migrations/0549_oficina_revisiones_envio.sql

-- Sam (superadministrador) y otra persona que no lo es.
insert into public.platform_admins (user_id) values ('00000000-0000-4000-8000-00000000a001');
insert into public.office_paused (pausada, motivo) values (false, 'Contrato 0549: despausada para la prueba.');

-- Ayuda del contrato: una conversación de prueba hasta su borrador, con las funciones de la 0548.
create function public.t_borrador(p_conv integer, p_tipo text) returns uuid language plpgsql as $$
declare
  r record;
begin
  insert into public.event_inbox (tipo, origen, clave_dedupe, prioridad, payload_ref, estado, triaje_en)
  values ('chatwoot.message_created', 'chatwoot', 'chatwoot:conv:' || p_conv || ':msg:' || p_conv, 2,
          'chatwoot:conversations/' || p_conv || '/messages/' || p_conv, 'triaje', now());
  perform public.office_convertir_triaje('soporte-chatwoot', 20);
  select * into r from public.office_tomar_tarea('soporte-chatwoot', 0, 300);
  if r.task_id is null then raise exception 't_borrador: no tomó la tarea %', p_conv; end if;
  if p_tipo = 'respuesta' then
    perform public.office_entregar_corrida(r.task_id, r.run_id, 'respuesta',
      'Entiendo tu consulta. Se la paso ya a una persona del equipo.', 'derivar-equipo', null, null,
      'agente:soporte-chatwoot', 'Borrador del contrato.');
  else
    perform public.office_entregar_corrida(r.task_id, r.run_id, 'escalado', null, null, 'agente:dinero', 3::smallint,
      'sistema:despachador', 'Escalado del contrato.');
  end if;
  return (select b.id from public.office_borradores b where b.run_id = r.run_id);
end;
$$;

-- Ayuda: una revisión como Sam (authenticated + test.uid).
create function public.t_revisar(p_b uuid, p_v text, p_todas boolean default true, p_inventado boolean default false)
returns uuid language plpgsql as $$
declare
  v uuid;
begin
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000a001', true);
  set local role authenticated;
  v := public.office_revisar_borrador(p_b, p_v, p_todas, true, not p_inventado, true, true, 'Revisión del contrato.', 1::smallint);
  reset role;
  perform set_config('test.uid', '', true);
  return v;
end;
$$;

-- 2. Revisar.
do $revisar$
declare
  b1 uuid := public.t_borrador(1, 'respuesta');
  b2 uuid := public.t_borrador(2, 'respuesta');
  b3 uuid := public.t_borrador(3, 'escalado');
  v uuid;
  t1 uuid;
begin
  -- Pendientes: solo para un superadministrador.
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000b002', true);
  begin
    set local role authenticated;
    perform public.office_borradores_pendientes();
    raise exception 'CONTRATO 2: alguien sin is_platform_admin vio los borradores';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role authenticated;
    perform public.office_revisar_borrador(b1, 'aprobado', true, true, true, true, true, 'x', 1::smallint);
    raise exception 'CONTRATO 2: alguien sin is_platform_admin revisó';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000a001', true);
  set local role authenticated;
  if (select count(*) from public.office_borradores_pendientes()) <> 3 then
    raise exception 'CONTRATO 2: Sam debía ver 3 pendientes';
  end if;
  -- Faltan casillas o motivo.
  begin
    perform public.office_revisar_borrador(b1, 'aprobado', true, null, true, true, true, 'x', 1::smallint);
    raise exception 'CONTRATO 2: revisó sin las 5 casillas';
  exception when null_value_not_allowed then null;
  end;
  begin
    perform public.office_revisar_borrador(b1, 'aprobado', true, true, true, true, true, '   ', 1::smallint);
    raise exception 'CONTRATO 2: revisó sin motivo';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.office_revisar_borrador(b1, 'tal vez', true, true, true, true, true, 'x', 1::smallint);
    raise exception 'CONTRATO 2: aceptó un veredicto raro';
  exception when invalid_parameter_value then null;
  end;
  -- No se aprueba un envío con un dato inventado.
  begin
    perform public.office_revisar_borrador(b1, 'aprobado', true, true, false, true, true, 'x', 1::smallint);
    raise exception 'CONTRATO 2: aprobó un envío con un dato inventado';
  exception when check_violation then null;
  end;
  v := public.office_revisar_borrador(b1, 'aprobado', true, true, true, true, true, 'Bien.', 1::smallint);
  -- Una sola revisión por borrador.
  begin
    perform public.office_revisar_borrador(b1, 'rechazado', true, true, true, true, true, 'Cambio de idea.', 1::smallint);
    raise exception 'CONTRATO 2: un borrador tuvo dos revisiones';
  exception when unique_violation then null;
  end;
  perform public.office_revisar_borrador(b2, 'rechazado', false, true, true, true, true, 'El acuse no confirma nada.', 1::smallint);
  perform public.office_revisar_borrador(b3, 'aprobado', true, true, true, true, true, 'Bien escalado.', 1::smallint);
  reset role;
  perform set_config('test.uid', '', true);

  select task_id into t1 from public.office_borradores where id = b1;
  if (select revisor from public.office_revisiones where id = v) <> '00000000-0000-4000-8000-00000000a001'
     or (select revisado_en from public.office_revisiones where id = v) is null
     or (select huella_borrador from public.office_revisiones where id = v)
        <> (select public.office_huella_borrador(b.tipo, b.texto, b.guion, b.motivo, b.prioridad)
              from public.office_borradores b where b.id = b1) then
    raise exception 'CONTRATO 2: la revisión no guardó quién, cuándo o la huella';
  end if;
  if (select estado from public.office_tasks where id = t1) <> 'aprobación' then
    raise exception 'CONTRATO 2: la aprobada debía quedar en aprobación hasta el envío';
  end if;
  if (select estado from public.office_tasks t join public.office_borradores b on b.task_id = t.id where b.id = b2) <> 'terminada'
     or (select estado from public.office_tasks t join public.office_borradores b on b.task_id = t.id where b.id = b3) <> 'terminada' then
    raise exception 'CONTRATO 2: rechazado o escalado debían terminar la tarea';
  end if;
  if (select count(*) from public.task_events where tipo in ('revision.aprobada', 'revision.rechazada')
        and actor = 'persona:00000000-0000-4000-8000-00000000a001') <> 3 then
    raise exception 'CONTRATO 2: faltan los eventos de revisión con el revisor';
  end if;
  -- Una tarea que ya no está en aprobación no se revisa.
  begin
    perform public.t_revisar(b2, 'aprobado');
    raise exception 'CONTRATO 2: revisó una tarea terminada';
  exception when object_not_in_prerequisite_state then null;
  end;
end;
$revisar$;

-- 3. Solo se agregan filas.
do $solo_agregar$
begin
  -- service_role ni siquiera tiene UPDATE; con el privilegio prestado, el disparador igual lo corta.
  grant update on public.office_revisiones to service_role;
  begin
    set local role service_role;
    update public.office_revisiones set veredicto = 'rechazado';
    raise exception 'CONTRATO 3: se cambió una revisión';
  exception when insufficient_privilege then null;
  end;
  reset role;
  revoke update on public.office_revisiones from service_role;
  begin
    set local role service_role;
    delete from public.office_revisiones;
    raise exception 'CONTRATO 3: service_role borró una revisión';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$solo_agregar$;

-- 5. Envío.
do $envio$
declare
  r record;
  n integer;
  s text;
  b4 uuid;
  rev4 uuid;
begin
  set local role service_role;
  select count(*) into n from public.office_envios_por_hacer(5);
  reset role;
  if n <> 1 then
    raise exception 'CONTRATO 5: debía haber 1 envío por hacer (solo la respuesta aprobada), hay %', n;
  end if;
  -- Pausada: no hay nada que enviar y reservar lo dice.
  insert into public.office_paused (pausada, motivo) values (true, 'Contrato 0549: pausa.');
  set local role service_role;
  select count(*) into n from public.office_envios_por_hacer(5);
  select * into r from public.office_revisiones where veredicto = 'aprobado' and tipo_borrador = 'respuesta' limit 1;
  s := public.office_reservar_envio(r.id, r.huella_borrador, 11, 1);
  reset role;
  if n <> 0 or s <> 'pausada' or exists (select 1 from public.office_envios) then
    raise exception 'CONTRATO 5: con la oficina pausada se preparó un envío (%, %)', n, s;
  end if;
  insert into public.office_paused (pausada, motivo) values (false, 'Contrato 0549: despausa.');
  -- Una huella que no es la aprobada: bloqueado, y no se reintenta.
  b4 := public.t_borrador(4, 'respuesta');
  rev4 := public.t_revisar(b4, 'aprobado');
  set local role service_role;
  s := public.office_reservar_envio(rev4, repeat('0', 64), 11, 4);
  reset role;
  if s <> 'borrador_cambio' or (select estado from public.office_envios where revision_id = rev4) <> 'bloqueado'
     or (select t.estado from public.office_tasks t join public.office_revisiones x on x.task_id = t.id where x.id = rev4) <> 'terminada' then
    raise exception 'CONTRATO 5: una huella distinta no bloqueó el envío ni terminó la tarea (%)', s;
  end if;
  set local role service_role;
  s := public.office_reservar_envio(rev4, (select huella_borrador from public.office_revisiones where id = rev4), 11, 4);
  reset role;
  if s <> 'ya_reservado' then
    raise exception 'CONTRATO 5: un envío bloqueado se volvió a reservar (%)', s;
  end if;
  -- Reservar UNA vez, cerrar, terminar.
  set local role service_role;
  s := public.office_reservar_envio(r.id, r.huella_borrador, 11, 1);
  if s <> 'ok' then raise exception 'CONTRATO 5: no reservó el envío aprobado (%)', s; end if;
  s := public.office_reservar_envio(r.id, r.huella_borrador, 11, 1);
  if s <> 'ya_reservado' then raise exception 'CONTRATO 5: reservó dos veces (%)', s; end if;
  select count(*) into n from public.office_envios_por_hacer(5);
  if n <> 0 then raise exception 'CONTRATO 5: lo reservado siguió por hacer'; end if;
  if not public.office_cerrar_envio(r.id, 'enviado', null, 901) then raise exception 'CONTRATO 5: no cerró'; end if;
  if public.office_cerrar_envio(r.id, 'fallido', 'red', null) then raise exception 'CONTRATO 5: cerró dos veces'; end if;
  reset role;
  if (select estado from public.office_tasks where id = r.task_id) <> 'terminada'
     or (select chatwoot_mensaje_id from public.office_envios where revision_id = r.id and estado = 'enviado') <> 901
     or (select count(*) from public.task_events where task_id = r.task_id and tipo = 'envio.hecho') <> 1 then
    raise exception 'CONTRATO 5: el envío hecho no quedó registrado';
  end if;
  -- Un rechazado no se envía nunca.
  set local role service_role;
  s := public.office_reservar_envio((select id from public.office_revisiones where veredicto = 'rechazado' limit 1), repeat('a', 64), 11, 2);
  reset role;
  if s <> 'no_aprobado' then raise exception 'CONTRATO 5: reservó un rechazado (%)', s; end if;
  begin
    set local role service_role;
    update public.office_envios set estado = 'fallido';
    raise exception 'CONTRATO 3: service_role cambió un envío';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$envio$;

-- 4. Conteo de AC-1 (etapa 1).
do $conteo$
declare
  c record;
  i integer;
  b uuid;
begin
  -- Ya hay 4 conversaciones revisadas (1, 3 y 4 correctas; 2 no). Se suman 6 correctas: 10 con 9 correctas.
  for i in 11..16 loop
    b := public.t_borrador(i, 'escalado');
    perform public.t_revisar(b, 'aprobado');
  end loop;
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000a001', true);
  set local role authenticated;
  select * into c from public.office_conteo_revisiones(1::smallint);
  reset role;
  if c.conversaciones <> 10 or c.correctas <> 9 or c.con_inventados <> 0 or c.minimo <> 10 or not c.cumple then
    raise exception 'CONTRATO 4: 10 conversaciones y 9 correctas debían cumplir la etapa 1 (%)', row_to_json(c);
  end if;
  -- Una más con un dato inventado (rechazada): ya no cumple.
  b := public.t_borrador(17, 'respuesta');
  perform public.t_revisar(b, 'rechazado', true, true);
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000a001', true);
  set local role authenticated;
  select * into c from public.office_conteo_revisiones(1::smallint);
  reset role;
  if c.con_inventados <> 1 or c.cumple then
    raise exception 'CONTRATO 4: un dato inventado debía frenar el paso (%)', row_to_json(c);
  end if;
  -- La etapa 2 es la misma consulta con 20.
  set local role authenticated;
  select * into c from public.office_conteo_revisiones(2::smallint);
  reset role;
  if c.conversaciones <> 0 or c.minimo <> 20 or c.cumple then
    raise exception 'CONTRATO 4: la etapa 2 debía estar vacía con mínimo 20 (%)', row_to_json(c);
  end if;
  perform set_config('test.uid', '', true);
end;
$conteo$;

-- 8. La conversación aprobada (B3), la vigencia (B1), el bloqueo desde el ERP y el envío incierto (M1).
do $envio_b$
declare
  b uuid;
  rv uuid;
  s text;
  h text;
begin
  -- B3: la revisión guarda la conversación de la tarea.
  b := public.t_borrador(21, 'respuesta');
  rv := public.t_revisar(b, 'aprobado');
  if (select entidad_ref from public.office_revisiones where id = rv) <> 'chatwoot:conversations/21/messages/21' then
    raise exception 'CONTRATO 8: la revisión no guardó la conversación aprobada';
  end if;
  -- B3: la tarea pasó a otra conversación → no se envía a ninguna.
  update public.office_tasks t set entidad_ref = 'chatwoot:conversations/99/messages/99'
    from public.office_revisiones x where x.id = rv and t.id = x.task_id;
  h := (select huella_borrador from public.office_revisiones where id = rv);
  set local role service_role;
  s := public.office_reservar_envio(rv, h, 11, 21);
  reset role;
  if s <> 'conversacion_cambio' then raise exception 'CONTRATO 8: se reservó con la conversación cambiada (%)', s; end if;
  -- B3: el ERP pide enviar a otra conversación que la aprobada → tampoco.
  b := public.t_borrador(22, 'respuesta');
  rv := public.t_revisar(b, 'aprobado');
  h := (select huella_borrador from public.office_revisiones where id = rv);
  set local role service_role;
  s := public.office_reservar_envio(rv, h, 11, 999);
  reset role;
  if s <> 'conversacion_cambio' then raise exception 'CONTRATO 8: se reservó para otra conversación (%)', s; end if;
  -- B1: una aprobación de más de 24 h vence (el dueño, en su sesión, corre la hora).
  b := public.t_borrador(23, 'respuesta');
  rv := public.t_revisar(b, 'aprobado');
  update public.office_revisiones set revisado_en = now() - interval '25 hours' where id = rv;
  h := (select huella_borrador from public.office_revisiones where id = rv);
  set local role service_role;
  s := public.office_reservar_envio(rv, h, 11, 23);
  reset role;
  if s <> 'aprobacion_vencida' or (select estado from public.office_envios where revision_id = rv) <> 'bloqueado' then
    raise exception 'CONTRATO 8: una aprobación vencida se reservó (%)', s;
  end if;
  -- Bloqueo desde el ERP (B1: el cliente escribió después): una sola vez, termina la tarea y ya no se reserva.
  b := public.t_borrador(24, 'respuesta');
  rv := public.t_revisar(b, 'aprobado');
  h := (select huella_borrador from public.office_revisiones where id = rv);
  set local role service_role;
  if not public.office_bloquear_envio(rv, 'cliente_escribio', 11) then raise exception 'CONTRATO 8: no bloqueó'; end if;
  if public.office_bloquear_envio(rv, 'cliente_escribio', 11) then raise exception 'CONTRATO 8: bloqueó dos veces'; end if;
  s := public.office_reservar_envio(rv, h, 11, 24);
  begin
    perform public.office_bloquear_envio(rv, 'cualquier cosa', 11);
    raise exception 'CONTRATO 8: aceptó un código de bloqueo raro';
  exception when invalid_parameter_value then null;
  end;
  reset role;
  if s <> 'ya_reservado'
     or (select t.estado from public.office_tasks t join public.office_revisiones x on x.task_id = t.id where x.id = rv) <> 'terminada' then
    raise exception 'CONTRATO 8: el bloqueo no frenó el envío o no terminó la tarea (%)', s;
  end if;
  -- M1: incierto deja «enviando» (nunca «fallido»), lo anota y no vuelve a la lista.
  b := public.t_borrador(25, 'respuesta');
  rv := public.t_revisar(b, 'aprobado');
  h := (select huella_borrador from public.office_revisiones where id = rv);
  set local role service_role;
  if public.office_marcar_envio_incierto(rv, 'red') then raise exception 'CONTRATO 8: incierto sin reserva'; end if;
  s := public.office_reservar_envio(rv, h, 11, 25);
  if s <> 'ok' then raise exception 'CONTRATO 8: no reservó (%)', s; end if;
  if not public.office_marcar_envio_incierto(rv, 'red') then raise exception 'CONTRATO 8: no marcó incierto'; end if;
  if exists (select 1 from public.office_envios_por_hacer(50) x where x.revision_id = rv) then
    raise exception 'CONTRATO 8: un envío incierto volvió a la lista';
  end if;
  reset role;
  if (select array_agg(estado) from public.office_envios where revision_id = rv) <> array['enviando']
     or (select count(*) from public.task_events ev join public.office_revisiones x on x.task_id = ev.task_id
          where x.id = rv and ev.tipo = 'envio.incierto') <> 1 then
    raise exception 'CONTRATO 8: incierto no quedó «enviando» con su aviso';
  end if;
end;
$envio_b$;

-- 6. Sesiones por borrar.
do $sesiones$
declare
  n integer;
begin
  set local role service_role;
  perform public.office_anotar_sesion_por_borrar('cable-00000000-0000-4000-8000-000000000001-1', 15);
  perform public.office_anotar_sesion_por_borrar('cable-00000000-0000-4000-8000-000000000001-1', 15);
  select count(*) into n from public.office_sesiones_por_borrar() where not vencida;
  if n <> 1 then raise exception 'CONTRATO 6: la sesión anotada no está (o está dos veces)'; end if;
  begin
    perform public.office_anotar_sesion_por_borrar('Hola, mi teléfono es 0414', 15);
    raise exception 'CONTRATO 6: anotó algo que no es un id de sesión';
  exception when check_violation then null;
  end;
  reset role;
  update public.office_sesiones_por_borrar set hasta = now() - interval '1 minute';
  set local role service_role;
  select count(*) into n from public.office_sesiones_por_borrar() where vencida;
  if n <> 1 then raise exception 'CONTRATO 6: la sesión no venció'; end if;
  if not public.office_quitar_sesion_por_borrar('cable-00000000-0000-4000-8000-000000000001-1') then
    raise exception 'CONTRATO 6: no la quitó';
  end if;
  reset role;
  if exists (select 1 from public.office_sesiones_por_borrar) then raise exception 'CONTRATO 6: quedó la sesión'; end if;
end;
$sesiones$;

-- 7. Privilegios.
do $privilegios$
begin
  if has_any_column_privilege('anon', 'public.office_revisiones', 'SELECT')
     or has_any_column_privilege('authenticated', 'public.office_revisiones', 'SELECT')
     or has_any_column_privilege('authenticated', 'public.office_envios', 'SELECT')
     or has_any_column_privilege('service_role', 'public.office_sesiones_por_borrar', 'SELECT') then
    raise exception 'CONTRATO 7: alguien lee las tablas sin las funciones';
  end if;
  begin
    set local role authenticated;
    perform public.office_reservar_envio(gen_random_uuid(), repeat('a', 64), 11, 1);
    raise exception 'CONTRATO 7: authenticated reservó un envío';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role service_role;
    perform public.office_revisar_borrador(gen_random_uuid(), 'aprobado', true, true, true, true, true, 'x', 1::smallint);
    raise exception 'CONTRATO 7: service_role revisó como Sam';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role anon;
    perform public.office_borradores_pendientes();
    raise exception 'CONTRATO 7: anon vio los pendientes';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$privilegios$;

rollback;
