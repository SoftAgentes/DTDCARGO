\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0560 (SDD-0626, etapa 1): «Acuse» en los escalados. Fixtures ficticios y
-- rollback: no toca prod.
--
-- Lo que se protege:
--   1. Aplicar la 0560 otra vez no falla (también con escalados de criterio 2 ya guardados con «Acuse» sin
--      evaluar: ya se cuentan con la regla de la 0560).
--   2. El conteo, etapa 1, por tipo de borrador (que la base copia del borrador, nunca el cliente):
--        · escalado con «Acuse» en null y el resto en cumple → correcta;
--        · escalado con «Acuse» en false (aunque se apruebe) → incorrecta;
--        · respuesta con «Acuse» en null → incorrecta;
--        · escalado con otra casilla en null → incorrecta;
--        · escalado y respuesta con las cuatro en cumple → correctas;
--        · un cierre que falló sigue haciendo incorrecta la conversación (lo de la 0558 no cambia);
--        · escalado RECHAZADO con «Acuse» en null → incorrecta;
--        · una conversación con varias revisiones mezcladas (escalado y respuesta): cuenta la regla de cada una;
--        · las revisiones de criterio 1 (la 0549) siguen sin contar.
--   3. Aprobar un escalado no depende de «Acuse»: se aprueba con «Acuse» en null.
--   4. Privilegios: anon y service_role no llaman al conteo; un authenticated sin is_platform_admin tampoco.
-- El preflight (con una fila así ANTES de la 0560, no se aplica) se prueba en
-- lib/studio/__tests__/oficina-acuse-escalado.migration.test.ts: aquí cortaría el script.

begin;

do $roles$
begin
  if to_regclass('public.office_tasks') is not null or to_regclass('public.platform_admins') is not null then
    raise exception 'TEST 0560 requiere una base PostgreSQL desechable vacía';
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

insert into public.platform_admins (user_id) values ('00000000-0000-4000-8000-00000000a001');
insert into public.office_paused (pausada, motivo) values (false, 'Contrato 0560: despausada para la prueba.');

-- Ayuda: una conversación de prueba hasta su borrador (respuesta o escalado), con las funciones de la 0548.
create function public.t_borrador(p_conv integer, p_tipo text, p_msg integer default null) returns uuid
language plpgsql as $$
declare
  r record;
  m integer := coalesce(p_msg, p_conv);
begin
  insert into public.event_inbox (tipo, origen, clave_dedupe, prioridad, payload_ref, estado, triaje_en)
  values ('chatwoot.message_created', 'chatwoot', 'chatwoot:conv:' || p_conv || ':msg:' || m, 2,
          'chatwoot:conversations/' || p_conv || '/messages/' || m, 'triaje', now());
  perform public.office_convertir_triaje('soporte-chatwoot', 20);
  select * into r from public.office_tomar_tarea('soporte-chatwoot', 0, 300);
  if r.task_id is null then raise exception 't_borrador: no tomó la tarea %', p_conv; end if;
  if p_tipo = 'escalado' then
    perform public.office_entregar_corrida(r.task_id, r.run_id, 'escalado', null, null, 'dinero', 3::smallint,
      'sistema:despachador', 'Escalado del contrato.');
  else
    perform public.office_entregar_corrida(r.task_id, r.run_id, 'respuesta',
      'Entiendo tu consulta. Se la paso ya a una persona del equipo.', 'derivar-equipo', null, null,
      'agente:soporte-chatwoot', 'Borrador del contrato.');
  end if;
  return (select b.id from public.office_borradores b where b.run_id = r.run_id);
end;
$$;

create function public.t_sam() returns void language plpgsql as $$
begin
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000a001', true);
end;
$$;

create function public.t_v2(p_conv integer, p_tipo text, p_v text, p_acuse boolean, p_guion boolean, p_cero boolean,
                            p_pii boolean, p_msg integer default null) returns uuid language plpgsql as $$
declare
  v uuid;
  b uuid := public.t_borrador(p_conv, p_tipo, p_msg);
begin
  perform public.t_sam();
  set local role authenticated;
  v := public.office_revisar_borrador_v2(b, p_v, p_acuse, p_guion, p_cero, p_pii, 'Revisión del contrato.', 1::smallint);
  reset role;
  return v;
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

-- 2 y 3. El conteo por tipo de borrador.
do $dos$
declare
  v uuid;
  c text;
begin
  -- 10: escalado, «Acuse» sin evaluar y el resto en cumple. Aprobar un escalado no depende de «Acuse».
  v := public.t_v2(10, 'escalado', 'aprobado', null, true, true, true);
  if (select tipo_borrador from public.office_revisiones where id = v) <> 'escalado' then
    raise exception 'CONTRATO 2: el tipo de la revisión no es el del borrador';
  end if;
  c := public.t_conteo();
  if c <> '1/1/0' then raise exception 'CONTRATO 2: escalado con «Acuse» en null no contó como correcta (%)', c; end if;

  -- 11: escalado con «Acuse» en false, aunque se apruebe → incorrecta.
  perform public.t_v2(11, 'escalado', 'aprobado', false, true, true, true);
  c := public.t_conteo();
  if c <> '2/1/0' then raise exception 'CONTRATO 2: escalado con «Acuse» en false contó como correcta (%)', c; end if;

  -- 12: respuesta con «Acuse» en null → incorrecta (en una respuesta nada cambia).
  perform public.t_v2(12, 'respuesta', 'aprobado', null, true, true, true);
  c := public.t_conteo();
  if c <> '3/1/0' then raise exception 'CONTRATO 2: respuesta con «Acuse» en null contó como correcta (%)', c; end if;

  -- 13: escalado con otra casilla en null («Guion o escalado») → incorrecta.
  perform public.t_v2(13, 'escalado', 'aprobado', null, null, true, true);
  c := public.t_conteo();
  if c <> '4/1/0' then raise exception 'CONTRATO 2: escalado con otra casilla en null contó como correcta (%)', c; end if;

  -- 14 y 15: escalado y respuesta con las cuatro en cumple → correctas.
  perform public.t_v2(14, 'escalado', 'aprobado', true, true, true, true);
  perform public.t_v2(15, 'respuesta', 'aprobado', true, true, true, true);
  c := public.t_conteo();
  if c <> '6/3/0' then raise exception 'CONTRATO 2: las conversaciones en cumple no contaron (%)', c; end if;

  -- Un cierre que falló sigue restando (lo de la 0558 no cambia): la 10 pasa a incorrecta.
  perform public.t_sam();
  set local role authenticated;
  perform public.office_registrar_cierre('10', false, 'Cierre del contrato.', 1::smallint);
  reset role;
  c := public.t_conteo();
  if c <> '6/2/0' then raise exception 'CONTRATO 2: un cierre que falló no restó (%)', c; end if;

  -- 16: escalado RECHAZADO con «Acuse» en null (falló «Guion o escalado») → incorrecta.
  perform public.t_v2(16, 'escalado', 'rechazado', null, false, true, true);
  c := public.t_conteo();
  if c <> '7/2/0' then raise exception 'CONTRATO 2: un escalado rechazado contó como correcta (%)', c; end if;
end;
$dos$;

-- 2b. Una conversación con varias revisiones mezcladas: el escalado cierra su tarea y la conversación sigue con
-- una respuesta. Cuenta la regla de CADA revisión (todas tienen que valer).
do $mezcla$
declare
  c text;
begin
  -- 20: escalado con «Acuse» en null (vale) + respuesta con «Acuse» en null (no vale) → incorrecta.
  perform public.t_v2(20, 'escalado', 'aprobado', null, true, true, true, 2001);
  perform public.t_v2(20, 'respuesta', 'aprobado', null, true, true, true, 2002);
  -- 21: escalado con «Acuse» en null (vale) + respuesta con todo en cumple → correcta.
  perform public.t_v2(21, 'escalado', 'aprobado', null, true, true, true, 2101);
  perform public.t_v2(21, 'respuesta', 'aprobado', true, true, true, true, 2102);
  if (select count(*) from public.office_revisiones r join public.office_tasks t on t.id = r.task_id
       where r.regla_casillas = 2 and t.entidad_ref like 'chatwoot:conversations/2_/%') <> 4 then
    raise exception 'CONTRATO 2: las conversaciones mezcladas no tienen sus 4 revisiones';
  end if;
  c := public.t_conteo();
  if c <> '9/3/0' then raise exception 'CONTRATO 2: la conversación mezclada no contó como debía (%)', c; end if;
end;
$mezcla$;

-- 2c. Las revisiones de criterio 1 (la función de la 0549) siguen sin contar, aunque digan «inventado».
do $vieja$
declare
  b uuid := public.t_borrador(30, 'respuesta');
  c text;
begin
  perform public.t_sam();
  set local role authenticated;
  perform public.office_revisar_borrador(b, 'rechazado', false, false, false, false, false, 'Fila vieja.', 1::smallint);
  reset role;
  if (select count(*) from public.office_revisiones where regla_casillas = 1) <> 1 then
    raise exception 'CONTRATO 2: no quedó la revisión de criterio 1';
  end if;
  c := public.t_conteo();
  if c <> '9/3/0' then raise exception 'CONTRATO 2: una revisión de criterio 1 contó (%)', c; end if;
end;
$vieja$;

-- 1. Otra vez encima, ya con escalados de criterio 2 con «Acuse» sin evaluar: no falla y el conteo no cambia.
\ir ../migrations/0560_oficina_acuse_en_escalados.sql

do $uno$
begin
  if public.t_conteo() <> '9/3/0' then
    raise exception 'CONTRATO 1: aplicar la 0560 otra vez cambió el conteo';
  end if;
end;
$uno$;

-- 4. Privilegios del conteo.
do $cuatro$
begin
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000b002', true);
  begin
    set local role authenticated;
    perform public.office_conteo_revisiones(1::smallint);
    raise exception 'CONTRATO 4: un authenticated sin is_platform_admin vio el conteo';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role anon;
    perform public.office_conteo_revisiones(1::smallint);
    raise exception 'CONTRATO 4: anon vio el conteo';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role service_role;
    perform public.office_conteo_revisiones(1::smallint);
    raise exception 'CONTRATO 4: service_role llamó al conteo de la página';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$cuatro$;

rollback;
