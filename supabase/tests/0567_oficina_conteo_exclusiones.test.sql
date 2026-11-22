\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0567 (SDD-0626, etapa 1): exclusiones del conteo y corrección de cierres, de
-- solo agregar. Fixtures ficticios y rollback: no toca prod.
--
-- Lo que se protege:
--   1. Una conversación excluida no cuenta (ni conversaciones, ni correctas, ni inventadas); una no excluida sí
--      cuenta; la exclusión es por etapa; la excluida no aparece en «por cerrar».
--   2. Una corrección de cierre reemplaza en el conteo al cierre original; manda la ÚLTIMA; el original queda en
--      office_cierres sin tocar.
--   3. Las dos tablas son de solo agregar: ni UPDATE, ni DELETE, ni TRUNCATE para un rol de la API, ni con el
--      privilegio prestado (lo corta el disparador).
--   4. La vía de escritura: sin EXECUTE para anon, authenticated ni service_role; valida etapa, motivo, actor,
--      revisiones de la conversación, cierre original y exclusión repetida.
--   5. Aplicar la 0567 otra vez no falla y el conteo no cambia.
--   6. El caso de la tanda 1 de la etapa 1 (18/11/2026), con números ficticios: una prueba del encendido excluida
--      y dos cierres guardados en «falló» corregidos a «cumple».
-- El preflight (un conteo vivo que no es el de la 0560) se prueba en
-- lib/studio/__tests__/oficina-conteo-exclusiones.migration.test.ts: aquí cortaría el script.

begin;

do $roles$
begin
  if to_regclass('public.office_tasks') is not null or to_regclass('public.platform_admins') is not null then
    raise exception 'TEST 0567 requiere una base PostgreSQL desechable vacía';
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
\ir ../migrations/0558_oficina_casillas_tres_estados.sql
\ir ../migrations/0560_oficina_acuse_en_escalados.sql
\ir ../migrations/0567_oficina_conteo_exclusiones.sql

insert into public.platform_admins (user_id) values ('00000000-0000-4000-8000-00000000a001');
insert into public.office_paused (pausada, motivo) values (false, 'Contrato 0567: despausada para la prueba.');

-- Ayuda: una conversación de prueba hasta su borrador de respuesta, con las funciones de la 0548.
create function public.t_borrador(p_conv integer) returns uuid
language plpgsql as $$
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

create function public.t_sam() returns void language plpgsql as $$
begin
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000a001', true);
end;
$$;

-- Una revisión de criterio 2 de Sam en la etapa 1: aprobada con todo en cumple, o rechazada con un fallo.
create function public.t_rev(p_conv integer, p_ok boolean) returns void language plpgsql as $$
declare
  b uuid := public.t_borrador(p_conv);
begin
  perform public.t_sam();
  set local role authenticated;
  if p_ok then
    perform public.office_revisar_borrador_v2(b, 'aprobado', true, true, true, true, 'Revisión del contrato.', 1::smallint);
  else
    perform public.office_revisar_borrador_v2(b, 'rechazado', false, true, true, true, 'Revisión del contrato.', 1::smallint);
  end if;
  reset role;
end;
$$;

create function public.t_cierre(p_conv text, p_cumple boolean) returns void language plpgsql as $$
begin
  perform public.t_sam();
  set local role authenticated;
  perform public.office_registrar_cierre(p_conv, p_cumple, 'Cierre del contrato.', 1::smallint);
  reset role;
end;
$$;

create function public.t_conteo() returns text language plpgsql as $$
declare
  r record;
begin
  perform public.t_sam();
  set local role authenticated;
  select * into r from public.office_conteo_revisiones(1::smallint);
  reset role;
  return r.conversaciones || '/' || r.correctas || '/' || r.con_inventados;
end;
$$;

create function public.t_por_cerrar() returns text language plpgsql as $$
declare
  v text;
begin
  perform public.t_sam();
  set local role authenticated;
  select coalesce(string_agg(conversacion, ',' order by conversacion), '') into v
    from public.office_conversaciones_por_cerrar(1::smallint);
  reset role;
  return v;
end;
$$;

-- 1. Exclusiones.
do $uno$
declare
  c text;
begin
  -- 40 a 42: correctas. 43: rechazada (incorrecta).
  perform public.t_rev(40, true);
  perform public.t_rev(41, true);
  perform public.t_rev(42, true);
  perform public.t_rev(43, false);
  c := public.t_conteo();
  if c <> '4/3/0' then raise exception 'CONTRATO 1: el punto de partida no es 4/3/0 (%)', c; end if;
  if public.t_por_cerrar() <> '40,41,42,43' then
    raise exception 'CONTRATO 1: por cerrar no lista las cuatro (%)', public.t_por_cerrar();
  end if;

  -- Excluir la 40 (correcta): sale de conversaciones y de correctas; la 41 y la 42 siguen contando.
  perform public.office_excluir_conversacion('40', 1::smallint, 'Prueba del encendido (contrato).', 'contrato 0567');
  c := public.t_conteo();
  if c <> '3/2/0' then raise exception 'CONTRATO 1: la conversación excluida siguió contando (%)', c; end if;
  if public.t_por_cerrar() <> '41,42,43' then
    raise exception 'CONTRATO 1: la excluida sigue en por cerrar (%)', public.t_por_cerrar();
  end if;

  -- Excluir la 43 (incorrecta): tampoco cuenta en contra.
  perform public.office_excluir_conversacion('43', 1::smallint, 'Prueba del encendido (contrato).', 'contrato 0567');
  c := public.t_conteo();
  if c <> '2/2/0' then raise exception 'CONTRATO 1: la excluida incorrecta siguió restando (%)', c; end if;

  -- La exclusión es por etapa: una de la etapa 2 (el dueño la escribe directo) no toca la etapa 1.
  insert into public.office_conteo_exclusiones (conversacion, etapa, motivo, actor)
  values ('41', 2, 'Exclusión de otra etapa (contrato).', 'contrato 0567');
  c := public.t_conteo();
  if c <> '2/2/0' then raise exception 'CONTRATO 1: una exclusión de la etapa 2 sacó la conversación de la etapa 1 (%)', c; end if;
  if public.t_por_cerrar() <> '41,42' then
    raise exception 'CONTRATO 1: una exclusión de la etapa 2 sacó la conversación de por cerrar en la etapa 1 (%)', public.t_por_cerrar();
  end if;
end;
$uno$;

-- 2. Corrección de cierres.
do $dos$
declare
  c text;
begin
  -- 44 y 45: correctas en mensajes, con cierre guardado en «falló» → incorrectas.
  perform public.t_rev(44, true);
  perform public.t_rev(45, true);
  perform public.t_cierre('44', false);
  perform public.t_cierre('45', false);
  c := public.t_conteo();
  if c <> '4/2/0' then raise exception 'CONTRATO 2: los cierres que fallaron no restaron (%)', c; end if;

  -- Corregir la 44 a «cumple»: vuelve a ser correcta. La 45 sigue con su cierre original.
  perform public.office_corregir_cierre('44', 1::smallint, true, 'Sam marcó Cumple (contrato).', 'contrato 0567');
  c := public.t_conteo();
  if c <> '4/3/0' then raise exception 'CONTRATO 2: la corrección no reemplazó al cierre (%)', c; end if;

  -- Manda la ÚLTIMA: otra corrección a «falló» la vuelve incorrecta, y otra a «cumple» correcta otra vez.
  perform public.office_corregir_cierre('44', 1::smallint, false, 'Segunda corrección (contrato).', 'contrato 0567');
  c := public.t_conteo();
  if c <> '4/2/0' then raise exception 'CONTRATO 2: no mandó la última corrección (falló) (%)', c; end if;
  perform public.office_corregir_cierre('44', 1::smallint, true, 'Tercera corrección (contrato).', 'contrato 0567');
  c := public.t_conteo();
  if c <> '4/3/0' then raise exception 'CONTRATO 2: no mandó la última corrección (cumple) (%)', c; end if;

  -- El original queda: office_cierres sigue con la 44 en «falló» y con una sola fila por conversación.
  if (select count(*) from public.office_cierres where conversacion = '44') <> 1
     or (select cumple from public.office_cierres where conversacion = '44') is distinct from false then
    raise exception 'CONTRATO 2: la corrección tocó el cierre original';
  end if;
  if (select count(*) from public.office_cierres_correcciones where conversacion = '44') <> 3 then
    raise exception 'CONTRATO 2: no quedaron las tres correcciones';
  end if;
end;
$dos$;

-- 3. Solo se agregan filas, ni con el privilegio prestado (lo corta el disparador, no el GRANT).
do $tres$
declare
  v_tabla text;
  v_sql text;
begin
  foreach v_tabla in array array['public.office_conteo_exclusiones', 'public.office_cierres_correcciones'] loop
    -- Sin el privilegio: ni authenticated ni service_role escriben.
    begin
      set local role service_role;
      execute format('delete from %s', v_tabla);
      raise exception 'CONTRATO 3: service_role borró en % sin privilegio', v_tabla;
    exception when insufficient_privilege then null;
    end;
    reset role;
    begin
      set local role authenticated;
      execute format('insert into %s (conversacion, etapa, motivo, actor) values (''99'', 1, ''x'', ''x'')', v_tabla);
      raise exception 'CONTRATO 3: authenticated escribió en %', v_tabla;
    exception when insufficient_privilege or not_null_violation then null;
    end;
    reset role;
    -- Con el privilegio prestado: el disparador corta UPDATE, DELETE y TRUNCATE.
    execute format('grant update, delete, truncate on %s to service_role', v_tabla);
    foreach v_sql in array array[
      format('update %s set motivo = ''cambiado''', v_tabla),
      format('delete from %s', v_tabla),
      format('truncate %s', v_tabla)
    ] loop
      begin
        set local role service_role;
        execute v_sql;
        raise exception 'CONTRATO 3: pasó «%»', v_sql;
      exception when insufficient_privilege then
        if sqlerrm not like '%solo se agregan filas%' then
          raise exception 'CONTRATO 3: «%» no lo cortó el disparador (%)', v_sql, sqlerrm;
        end if;
      end;
      reset role;
    end loop;
    execute format('revoke update, delete, truncate on %s from service_role', v_tabla);
  end loop;
  if (select count(*) from public.office_conteo_exclusiones) <> 3
     or (select count(*) from public.office_cierres_correcciones) <> 3 then
    raise exception 'CONTRATO 3: se perdió una fila';
  end if;
end;
$tres$;

-- 4. La vía de escritura.
do $cuatro$
declare
  v_rol text;
begin
  -- Sin EXECUTE para la API, ni siendo Sam. Dos candados: el EXECUTE y, aunque se diera, la función corre con los
  -- derechos de quien llama, que no escribe las tablas.
  foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
    if has_function_privilege(v_rol, 'public.office_excluir_conversacion(text, smallint, text, text)', 'EXECUTE')
       or has_function_privilege(v_rol, 'public.office_corregir_cierre(text, smallint, boolean, text, text)', 'EXECUTE') then
      raise exception 'CONTRATO 4: % tiene EXECUTE sobre la vía de escritura', v_rol;
    end if;
    perform public.t_sam();
    begin
      execute format('set local role %I', v_rol);
      perform public.office_excluir_conversacion('42', 1::smallint, 'x', 'x');
      raise exception 'CONTRATO 4: % excluyó una conversación', v_rol;
    exception when insufficient_privilege then null;
    end;
    reset role;
    begin
      execute format('set local role %I', v_rol);
      perform public.office_corregir_cierre('45', 1::smallint, true, 'x', 'x');
      raise exception 'CONTRATO 4: % corrigió un cierre', v_rol;
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
  -- Validaciones.
  begin
    perform public.office_excluir_conversacion('40', 1::smallint, 'Otra vez.', 'contrato 0567');
    raise exception 'CONTRATO 4: excluyó dos veces la misma conversación';
  exception when unique_violation then null;
  end;
  begin
    perform public.office_excluir_conversacion('98', 1::smallint, 'Sin revisiones.', 'contrato 0567');
    raise exception 'CONTRATO 4: excluyó una conversación sin revisiones';
  exception when no_data_found then null;
  end;
  begin
    perform public.office_corregir_cierre('42', 1::smallint, true, 'Sin cierre.', 'contrato 0567');
    raise exception 'CONTRATO 4: corrigió una conversación sin cierre';
  exception when no_data_found then null;
  end;
  begin
    perform public.office_excluir_conversacion('42', 1::smallint, '   ', 'contrato 0567');
    raise exception 'CONTRATO 4: excluyó sin motivo';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.office_corregir_cierre('45', 1::smallint, true, 'Sin actor.', ' ');
    raise exception 'CONTRATO 4: corrigió sin actor';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.office_corregir_cierre('45', 1::smallint, null, 'Sin valor.', 'contrato 0567');
    raise exception 'CONTRATO 4: corrigió sin decir si cumple';
  exception when null_value_not_allowed then null;
  end;
  begin
    perform public.office_excluir_conversacion('42', 3::smallint, 'Etapa 3.', 'contrato 0567');
    raise exception 'CONTRATO 4: excluyó en una etapa que no existe';
  exception when invalid_parameter_value then null;
  end;
  if public.t_conteo() <> '4/3/0' then
    raise exception 'CONTRATO 4: un intento rechazado cambió el conteo (%)', public.t_conteo();
  end if;
end;
$cuatro$;

-- 4b. Una corrección sobre una conversación excluida: la conversación sigue sin contar (manda la exclusión).
do $cuatro_b$
declare
  c text;
begin
  perform public.t_cierre('40', false);
  perform public.office_corregir_cierre('40', 1::smallint, true, 'Corrección sobre una excluida (contrato).', 'contrato 0567');
  c := public.t_conteo();
  if c <> '4/3/0' then raise exception 'CONTRATO 4b: una corrección devolvió al conteo una conversación excluida (%)', c; end if;
end;
$cuatro_b$;

-- 5. Otra vez encima: no falla y el conteo no cambia.
\ir ../migrations/0567_oficina_conteo_exclusiones.sql

do $cinco$
begin
  if public.t_conteo() <> '4/3/0' then
    raise exception 'CONTRATO 5: aplicar la 0567 otra vez cambió el conteo (%)', public.t_conteo();
  end if;
end;
$cinco$;

-- 6. El caso de la tanda 1 (números ficticios): 5 conversaciones; la 125 es la prueba del encendido (aprobada
-- por error con un fallo marcado, cuenta como incorrecta); la 126 rechazada; 127, 128 y 130 correctas, con los
-- cierres de 127 y 130 guardados en «falló». De la tanda, antes: 5 y 1 correcta. Después de excluir la 125 y
-- corregir 127 y 130: 4 y 3 correctas.
do $seis$
declare
  b uuid;
  c text;
  antes text;
begin
  antes := public.t_conteo();
  b := public.t_borrador(125);
  perform public.t_sam();
  set local role authenticated;
  perform public.office_revisar_borrador_v2(b, 'aprobado', true, false, true, true, 'Prueba del encendido.', 1::smallint);
  reset role;
  perform public.t_rev(126, false);
  perform public.t_rev(127, true);
  perform public.t_rev(128, true);
  perform public.t_rev(130, true);
  perform public.t_cierre('126', true);
  perform public.t_cierre('127', false);
  perform public.t_cierre('128', true);
  perform public.t_cierre('130', false);
  c := public.t_conteo();
  if c <> '9/4/0' then raise exception 'CONTRATO 6: el caso de la tanda no parte de 4+5 conversaciones (%; antes %)', c, antes; end if;
  perform public.office_excluir_conversacion('125', 1::smallint, 'prueba del encendido; decisión del DG, 2026-11-18', 'contrato 0567');
  perform public.office_corregir_cierre('127', 1::smallint, true, 'Sam marcó Cumple; quedó guardado Falló; 2026-11-18', 'contrato 0567');
  perform public.office_corregir_cierre('130', 1::smallint, true, 'Sam marcó Cumple; quedó guardado Falló; 2026-11-18', 'contrato 0567');
  c := public.t_conteo();
  -- De las 5 de la tanda: 4 cuentan (sale la 125) y 3 son correctas (127, 128 y 130): +4 y +3 sobre el 4/3 previo.
  if c <> '8/6/0' then raise exception 'CONTRATO 6: el caso de la tanda no quedó en 4 conversaciones y 3 correctas (%)', c; end if;
end;
$seis$;

rollback;
