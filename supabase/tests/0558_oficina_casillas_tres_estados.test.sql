\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0558 (SDD-0626, seguimiento de la prueba F): las casillas de la revisión con
-- tres estados y el cierre por conversación. Fixtures ficticios y rollback: no toca prod.
--
-- Lo que se protege:
--   1. Aplicar la 0558 otra vez no falla; la fila vieja (criterio 1, de la 0549) queda igual y la función vieja
--      sigue escribiendo criterio 1.
--   2. Revisar con criterio 2: solo un superadministrador; null = no evaluado; aprobar una respuesta exige
--      «cero inventados» y «sin datos personales» en true (null no basta); un rechazo marca al menos un fallo;
--      c_cierre_3 queda null. Los checks de la tabla lo repiten aunque alguien salte la función.
--   3. Conteo etapa 1 (null ≠ false): las filas de criterio 1 no cuentan; un rechazo sin «cero inventados»
--      marcado NO suma dato inventado; solo un false explícito suma; un «no evaluado» no hace correcta la
--      conversación; un cierre que falló la hace incorrecta.
--   4. Cierres: solo un superadministrador; solo conversaciones con revisiones de criterio 2; uno por
--      conversación y etapa; solo se agregan filas; la lista de conversaciones por cerrar.
--   5. Conteo etapa 2: solo cuentan las conversaciones con cierre, y el cierre tiene que cumplir.
--   6. Privilegios: anon y authenticated no leen office_cierres; service_role no llama a las funciones de la
--      página; anon tampoco.

begin;

do $roles$
begin
  if to_regclass('public.office_tasks') is not null or to_regclass('public.platform_admins') is not null then
    raise exception 'TEST 0558 requiere una base PostgreSQL desechable vacía';
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

insert into public.platform_admins (user_id) values ('00000000-0000-4000-8000-00000000a001');
insert into public.office_paused (pausada, motivo) values (false, 'Contrato 0558: despausada para la prueba.');

-- Ayuda: una conversación de prueba hasta su borrador, con las funciones de la 0548.
create function public.t_borrador(p_conv integer) returns uuid language plpgsql as $$
declare
  r record;
begin
  insert into public.event_inbox (tipo, origen, clave_dedupe, prioridad, payload_ref, estado, triaje_en)
  values ('chatwoot.message_created', 'chatwoot', 'chatwoot:conv:' || p_conv || ':msg:' || p_conv, 2,
          'chatwoot:conversations/' || p_conv || '/messages/' || p_conv, 'triaje', now());
  perform public.office_convertir_triaje('soporte-chatwoot', 20);
  select * into r from public.office_tomar_tarea('soporte-chatwoot', 0, 300);
  if r.task_id is null then raise exception 't_borrador: no tomó la tarea %', p_conv; end if;
  perform public.office_entregar_corrida(r.task_id, r.run_id, 'respuesta',
    'Entiendo tu consulta. Se la paso ya a una persona del equipo.', 'derivar-equipo', null, null,
    'agente:soporte-chatwoot', 'Borrador del contrato.');
  return (select b.id from public.office_borradores b where b.run_id = r.run_id);
end;
$$;

-- Ayuda: como Sam (authenticated + test.uid).
create function public.t_sam() returns void language plpgsql as $$
begin
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000a001', true);
end;
$$;

-- La fila vieja: conversación 1, rechazada con la 0549 y las 5 casillas en false (la 0549 la contaba «inventada»).
do $vieja$
declare
  b uuid := public.t_borrador(1);
begin
  perform public.t_sam();
  set local role authenticated;
  perform public.office_revisar_borrador(b, 'rechazado', false, false, false, false, false, 'Fila vieja.', 1::smallint);
  reset role;
end;
$vieja$;

\ir ../migrations/0558_oficina_casillas_tres_estados.sql
-- Otra vez encima: no falla.
\ir ../migrations/0558_oficina_casillas_tres_estados.sql

-- 1. La fila vieja queda igual (criterio 1, sus false) y la función vieja sigue escribiendo criterio 1.
do $uno$
declare
  b uuid := public.t_borrador(90);
  v uuid;
begin
  if (select count(*) from public.office_revisiones
       where regla_casillas = 1 and c_acuse is false and c_cero_inventados is false and c_cierre_3 is false) <> 1 then
    raise exception 'CONTRATO 1: la 0558 tocó la fila vieja';
  end if;
  perform public.t_sam();
  set local role authenticated;
  v := public.office_revisar_borrador(b, 'aprobado', true, true, true, true, true, 'Con la función vieja.', 2::smallint);
  reset role;
  if (select regla_casillas from public.office_revisiones where id = v) <> 1 then
    raise exception 'CONTRATO 1: la función vieja debía escribir criterio 1';
  end if;
end;
$uno$;

-- 2. Revisar con criterio 2.
do $dos$
declare
  b uuid := public.t_borrador(2);
  v uuid;
begin
  -- Solo un superadministrador.
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000b002', true);
  begin
    set local role authenticated;
    perform public.office_revisar_borrador_v2(b, 'aprobado', true, true, true, true, 'x', 1::smallint);
    raise exception 'CONTRATO 2: alguien sin is_platform_admin revisó';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform public.t_sam();
  set local role authenticated;
  -- Aprobar una respuesta exige «cero inventados» y «sin datos personales» EVALUADOS en true.
  begin
    perform public.office_revisar_borrador_v2(b, 'aprobado', true, true, null, true, 'x', 1::smallint);
    raise exception 'CONTRATO 2: aprobó sin evaluar «cero inventados»';
  exception when check_violation then null;
  end;
  begin
    perform public.office_revisar_borrador_v2(b, 'aprobado', true, true, true, false, 'x', 1::smallint);
    raise exception 'CONTRATO 2: aprobó con datos personales repetidos';
  exception when check_violation then null;
  end;
  -- Un rechazo dice qué falló: sin ningún false, no se guarda (ni con todo «no evaluado»).
  begin
    perform public.office_revisar_borrador_v2(b, 'rechazado', true, true, true, true, 'x', 1::smallint);
    raise exception 'CONTRATO 2: rechazó sin marcar un fallo';
  exception when sqlstate 'OFR01' then null;
  end;
  begin
    perform public.office_revisar_borrador_v2(b, 'rechazado', null, null, null, null, 'x', 1::smallint);
    raise exception 'CONTRATO 2: rechazó con todo sin evaluar';
  exception when sqlstate 'OFR01' then null;
  end;
  begin
    perform public.office_revisar_borrador_v2(b, 'aprobado', true, true, true, true, '  ', 1::smallint);
    raise exception 'CONTRATO 2: revisó sin motivo';
  exception when invalid_parameter_value then null;
  end;
  -- Aprobada con «acuse» sin evaluar: se guarda (null), criterio 2, sin cierre por mensaje.
  v := public.office_revisar_borrador_v2(b, 'aprobado', null, true, true, true, 'Bien; el acuse no lo miré.', 2::smallint);
  reset role;
  if (select regla_casillas from public.office_revisiones where id = v) <> 2
     or (select c_acuse from public.office_revisiones where id = v) is not null
     or (select c_cierre_3 from public.office_revisiones where id = v) is not null
     or (select revisor from public.office_revisiones where id = v) <> '00000000-0000-4000-8000-00000000a001' then
    raise exception 'CONTRATO 2: la revisión de criterio 2 no guardó lo que debía';
  end if;
  if not exists (select 1 from public.task_events where tipo = 'revision.aprobada' and resumen like '%0 fallaron, 1 sin evaluar%') then
    raise exception 'CONTRATO 2: el evento no dice cuántos fallaron y cuántos quedaron sin evaluar';
  end if;
  -- Los checks de la tabla lo repiten aunque se salte la función (como el dueño).
  begin
    insert into public.office_revisiones (borrador_id, task_id, run_id, tipo_borrador, huella_borrador, veredicto,
           c_acuse, c_guion_o_escalado, c_cero_inventados, c_pii_no_repetida, c_cierre_3, motivo, revisor, regla_casillas)
    select gen_random_uuid(), task_id, run_id, tipo_borrador, huella_borrador, 'rechazado',
           true, null, null, null, null, 'x', revisor, 2 from public.office_revisiones where id = v;
    raise exception 'CONTRATO 2: la tabla aceptó un rechazo sin fallo';
  exception when check_violation then null;
  end;
  begin
    insert into public.office_revisiones (borrador_id, task_id, run_id, tipo_borrador, huella_borrador, veredicto,
           c_acuse, c_guion_o_escalado, c_cero_inventados, c_pii_no_repetida, c_cierre_3, motivo, revisor, regla_casillas)
    select gen_random_uuid(), task_id, run_id, tipo_borrador, huella_borrador, 'aprobado',
           true, true, null, true, null, 'x', revisor, 2 from public.office_revisiones where id = v;
    raise exception 'CONTRATO 2: la tabla aceptó una aprobación sin evaluar «cero inventados»';
  exception when check_violation then null;
  end;
  begin
    insert into public.office_revisiones (borrador_id, task_id, run_id, tipo_borrador, huella_borrador, veredicto,
           c_acuse, c_guion_o_escalado, c_cero_inventados, c_pii_no_repetida, c_cierre_3, motivo, revisor, regla_casillas)
    select gen_random_uuid(), task_id, run_id, tipo_borrador, huella_borrador, 'aprobado',
           true, true, true, true, true, 'x', revisor, 2 from public.office_revisiones where id = v;
    raise exception 'CONTRATO 2: la tabla aceptó el cierre por mensaje en criterio 2';
  exception when check_violation then null;
  end;
  begin
    insert into public.office_revisiones (borrador_id, task_id, run_id, tipo_borrador, huella_borrador, veredicto,
           c_acuse, c_guion_o_escalado, c_cero_inventados, c_pii_no_repetida, c_cierre_3, motivo, revisor, regla_casillas)
    select gen_random_uuid(), task_id, run_id, tipo_borrador, huella_borrador, 'aprobado',
           true, true, true, true, null, 'x', revisor, 1 from public.office_revisiones where id = v;
    raise exception 'CONTRATO 2: la tabla aceptó una fila de criterio 1 con una casilla null';
  exception when check_violation then null;
  end;
end;
$dos$;

-- 3. Conteo, etapa 1 (null ≠ false).
create function public.t_conteo(p_etapa smallint) returns text language plpgsql as $$
declare
  r record;
begin
  perform public.t_sam();
  set local role authenticated;
  select * into r from public.office_conteo_revisiones(p_etapa);
  reset role;
  return r.conversaciones || '/' || r.correctas || '/' || r.con_inventados || '/' || r.cumple;
end;
$$;

create function public.t_v2(p_conv integer, p_v text, p_acuse boolean, p_guion boolean, p_cero boolean, p_pii boolean,
                            p_etapa smallint) returns uuid language plpgsql as $$
declare
  v uuid;
  b uuid := public.t_borrador(p_conv);
begin
  perform public.t_sam();
  set local role authenticated;
  v := public.office_revisar_borrador_v2(b, p_v, p_acuse, p_guion, p_cero, p_pii, 'Revisión del contrato.', p_etapa);
  reset role;
  return v;
end;
$$;

create function public.t_cierre(p_conv text, p_cumple boolean, p_etapa smallint) returns uuid language plpgsql as $$
declare
  v uuid;
begin
  perform public.t_sam();
  set local role authenticated;
  v := public.office_registrar_cierre(p_conv, p_cumple, 'Cierre del contrato.', p_etapa);
  reset role;
  return v;
end;
$$;

do $tres$
declare
  i integer;
  c text;
begin
  -- Sin revisiones de criterio 2 en la etapa 1, la fila vieja (rechazo con todo en false) NO cuenta.
  c := public.t_conteo(1::smallint);
  if c <> '0/0/0/false' then raise exception 'CONTRATO 3: la fila de criterio 1 contó (%)', c; end if;
  -- 3 a 10 y 12: aprobadas con los 4 criterios en «cumple». 11: rechazada porque el acuse falló, sin evaluar el resto.
  for i in 3..10 loop perform public.t_v2(i, 'aprobado', true, true, true, true, 1::smallint); end loop;
  perform public.t_v2(11, 'rechazado', false, null, null, null, 1::smallint);
  perform public.t_v2(12, 'aprobado', true, true, true, true, 1::smallint);
  c := public.t_conteo(1::smallint);
  -- 10 conversaciones, 9 correctas, 0 inventadas: cumple. (Con la regla de la 0549, la 11 habría sumado «inventada».)
  if c <> '10/9/0/true' then raise exception 'CONTRATO 3: un rechazo sin «cero inventados» marcado sumó (%)', c; end if;
  -- 13: aprobada con el acuse «no evaluado»: cuenta, pero no es correcta.
  perform public.t_v2(13, 'aprobado', null, true, true, true, 1::smallint);
  c := public.t_conteo(1::smallint);
  if c <> '11/9/0/false' then raise exception 'CONTRATO 3: un «no evaluado» hizo correcta la conversación (%)', c; end if;
  -- Un cierre que falló hace incorrecta la conversación 3.
  perform public.t_cierre('3', false, 1::smallint);
  c := public.t_conteo(1::smallint);
  if c <> '11/8/0/false' then raise exception 'CONTRATO 3: el cierre que falló no restó (%)', c; end if;
  -- Solo un false explícito en «cero inventados» suma dato inventado.
  perform public.t_v2(14, 'rechazado', true, true, false, true, 1::smallint);
  c := public.t_conteo(1::smallint);
  if c <> '12/8/1/false' then raise exception 'CONTRATO 3: el dato inventado explícito no sumó (%)', c; end if;
end;
$tres$;

-- 4. Cierres.
do $cuatro$
begin
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000b002', true);
  begin
    set local role authenticated;
    perform public.office_registrar_cierre('4', true, 'x', 1::smallint);
    raise exception 'CONTRATO 4: alguien sin is_platform_admin registró un cierre';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    perform public.t_cierre('3', true, 1::smallint);
    raise exception 'CONTRATO 4: una conversación tuvo dos cierres';
  exception when unique_violation then null;
  end;
  -- La 90 solo tiene una revisión de criterio 1 (la función vieja): no se cierra.
  begin
    perform public.t_cierre('90', true, 2::smallint);
    raise exception 'CONTRATO 4: cerró una conversación sin revisiones de criterio 2';
  exception when no_data_found then null;
  end;
  begin
    perform public.t_sam();
    set local role authenticated;
    perform public.office_registrar_cierre('4', null, 'x', 1::smallint);
    raise exception 'CONTRATO 4: registró un cierre sin decir si cumple';
  exception when null_value_not_allowed then null;
  end;
  reset role;
  -- Solo se agregan filas, ni con el privilegio prestado.
  grant update, delete on public.office_cierres to service_role;
  begin
    set local role service_role;
    update public.office_cierres set cumple = true;
    raise exception 'CONTRATO 4: se cambió un cierre';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role service_role;
    delete from public.office_cierres;
    raise exception 'CONTRATO 4: se borró un cierre';
  exception when insufficient_privilege then null;
  end;
  reset role;
  revoke update, delete on public.office_cierres from service_role;
end;
$cuatro$;

-- 5. Conteo, etapa 2: solo las conversaciones con cierre, y el cierre tiene que cumplir.
do $cinco$
declare
  c text;
  n integer;
begin
  perform public.t_v2(20, 'aprobado', true, true, true, true, 2::smallint);
  perform public.t_v2(21, 'aprobado', true, true, true, true, 2::smallint);
  perform public.t_sam();
  set local role authenticated;
  select count(*) into n from public.office_conversaciones_por_cerrar(2::smallint);
  reset role;
  -- La 2 (acuse sin evaluar), la 20 y la 21; la 90 es de criterio 1 y no aparece.
  if n <> 3 then raise exception 'CONTRATO 5: debían quedar 3 conversaciones por cerrar en la etapa 2, hay %', n; end if;
  c := public.t_conteo(2::smallint);
  if c <> '0/0/0/false' then raise exception 'CONTRATO 5: contó conversaciones sin cierre (%)', c; end if;
  perform public.t_cierre('20', true, 2::smallint);
  c := public.t_conteo(2::smallint);
  if c <> '1/1/0/false' then raise exception 'CONTRATO 5: la cerrada que cumple no contó bien (%)', c; end if;
  perform public.t_cierre('21', false, 2::smallint);
  perform public.t_cierre('2', true, 2::smallint);
  c := public.t_conteo(2::smallint);
  if c <> '3/1/0/false' then raise exception 'CONTRATO 5: cierre que falla o acuse sin evaluar contaron como correctas (%)', c; end if;
  perform public.t_sam();
  set local role authenticated;
  select count(*) into n from public.office_conversaciones_por_cerrar(2::smallint);
  reset role;
  if n <> 0 then raise exception 'CONTRATO 5: quedaron conversaciones por cerrar (%)', n; end if;
end;
$cinco$;

-- 6. Privilegios.
do $seis$
begin
  -- Alguien autenticado que no es superadministrador no ve el conteo ni las conversaciones por cerrar.
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000b002', true);
  begin
    set local role authenticated;
    perform public.office_conteo_revisiones(1::smallint);
    raise exception 'CONTRATO 6: alguien sin is_platform_admin vio el conteo';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role authenticated;
    perform public.office_conversaciones_por_cerrar(1::smallint);
    raise exception 'CONTRATO 6: alguien sin is_platform_admin vio las conversaciones por cerrar';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform set_config('test.uid', '', true);
  begin
    set local role anon;
    perform public.office_conteo_revisiones(1::smallint);
    raise exception 'CONTRATO 6: anon vio el conteo';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role authenticated;
    perform count(*) from public.office_cierres;
    raise exception 'CONTRATO 6: authenticated leyó office_cierres';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role anon;
    perform count(*) from public.office_cierres;
    raise exception 'CONTRATO 6: anon leyó office_cierres';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role service_role;
    perform public.office_registrar_cierre('20', true, 'x', 2::smallint);
    raise exception 'CONTRATO 6: service_role registró un cierre como Sam';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role service_role;
    perform public.office_revisar_borrador_v2(gen_random_uuid(), 'aprobado', true, true, true, true, 'x', 1::smallint);
    raise exception 'CONTRATO 6: service_role revisó como Sam';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role anon;
    perform public.office_conversaciones_por_cerrar(1::smallint);
    raise exception 'CONTRATO 6: anon vio las conversaciones por cerrar';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$seis$;

rollback;
