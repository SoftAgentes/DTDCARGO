\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0544 (SDD-0626 §3.3): el filtro nivel 1 de la bandeja del cable.
-- Fixtures ficticios y rollback: no toca prod.
--
-- Lo que se protege:
--   1. Aplicar la 0544 otra vez no falla.
--   2. Ráfaga de 50 eventos con duplicados (§9): la base deja 30 (la clave es única, AC-4) y el filtro
--      pasa a «triaje» como máximo 20 por hora, primero dinero (3), luego cliente (2), luego interno (1).
--      Lo que no cabe se queda en «nuevo»: la cuota NO descarta nada.
--   3. La cuota es por hora: con la hora de triaje de hace 2 h, el filtro vuelve a pasar el resto.
--   4. Pausada, el filtro no mueve nada. La oficina nace pausada.
--   5. La cuota va de 0 a 1000; solo service_role ejecuta el filtro; service_role no escribe triaje_en
--      (solo lo escribe la función) y anon y authenticated no alcanzan la tabla.
--   6. El filtro no cambia ninguna otra columna de la fila (clave, origen, referencia, prioridad).

begin;

do $roles$
begin
  if to_regclass('public.office_tasks') is not null or to_regclass('public.platform_admins') is not null then
    raise exception 'TEST 0544 requiere una base PostgreSQL desechable vacía';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

-- Lo mínimo de la plataforma: auth.uid() desde un GUC y is_platform_admin().
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
  select exists (
    select 1 from public.platform_admins where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_platform_admin() from public, anon, authenticated;
grant execute on function public.is_platform_admin() to service_role;
insert into public.platform_admins values ('00000000-0000-4000-8000-00000000a001');

-- Las migraciones. La 0541 deja la oficina pausada.
\ir ../migrations/0541_oficina_cable_tablas.sql
\ir ../migrations/0544_oficina_filtro_bandeja.sql
-- Otra vez encima: no falla.
\ir ../migrations/0544_oficina_filtro_bandeja.sql

-- Una ráfaga de 50 eventos de Chatwoot: 30 mensajes distintos, 20 entregas repetidas. Prioridad: 5 de
-- dinero (3), 10 de cliente (2) y 15 internos (1). Entra como service_role, con ON CONFLICT DO NOTHING
-- (así inserta el webhook).
set local role service_role;
insert into public.event_inbox (tipo, origen, clave_dedupe, prioridad, payload_ref)
select 'chatwoot.message_created', 'chatwoot',
       'chatwoot:conv:' || (g % 30) || ':msg:' || (g % 30),
       case when g % 30 < 5 then 3 when g % 30 < 15 then 2 else 1 end,
       'chatwoot:conversations/' || (g % 30) || '/messages/' || (g % 30)
  from generate_series(1, 50) g
on conflict (clave_dedupe) do nothing;
reset role;

do $rafaga$
begin
  if (select count(*) from public.event_inbox) <> 30 then
    raise exception 'CONTRATO 2: la ráfaga de 50 con 20 repetidas debía dejar 30 filas, dejó %', (select count(*) from public.event_inbox);
  end if;
  if (select count(*) from public.event_inbox where estado = 'nuevo' and triaje_en is null) <> 30 then
    raise exception 'CONTRATO 2: todo debía entrar en «nuevo» y sin hora de triaje';
  end if;
end;
$rafaga$;

-- 4. Pausada (la oficina nace pausada): el filtro no mueve nada.
do $pausada$
declare
  v_pasados integer;
begin
  set local role service_role;
  v_pasados := public.office_filtrar_bandeja();
  reset role;
  if v_pasados <> 0 then
    raise exception 'CONTRATO 4: pausada, el filtro movió % filas', v_pasados;
  end if;
  if (select count(*) from public.event_inbox where estado = 'nuevo') <> 30 then
    raise exception 'CONTRATO 4: pausada, el filtro cambió filas';
  end if;
end;
$pausada$;

-- Un administrador despausa (con motivo).
select set_config('test.uid', '00000000-0000-4000-8000-00000000a001', true);
set local role authenticated;
select public.office_cambiar_pausa(false, 'Contrato 0544: despausa para probar el filtro');
reset role;
select set_config('test.uid', '', true);

-- 2. La cuota: 20 de 30, primero dinero, luego cliente, luego interno; nada se descarta.
do $cuota$
declare
  v_pasados integer;
begin
  set local role service_role;
  v_pasados := public.office_filtrar_bandeja();
  reset role;
  if v_pasados <> 20 then
    raise exception 'CONTRATO 2: el filtro debía pasar 20, pasó %', v_pasados;
  end if;
  if (select count(*) from public.event_inbox where estado = 'triaje' and prioridad = 3) <> 5
     or (select count(*) from public.event_inbox where estado = 'triaje' and prioridad = 2) <> 10
     or (select count(*) from public.event_inbox where estado = 'triaje' and prioridad = 1) <> 5 then
    raise exception 'CONTRATO 2: el orden debía ser dinero (5), cliente (10) y 5 internos';
  end if;
  if (select count(*) from public.event_inbox where estado = 'nuevo' and prioridad = 1) <> 10
     or (select count(*) from public.event_inbox where estado = 'nuevo') <> 10 then
    raise exception 'CONTRATO 2: los 10 que no caben debían quedar en «nuevo»';
  end if;
  if (select count(*) from public.event_inbox where estado = 'descartado') <> 0 then
    raise exception 'CONTRATO 2: la cuota descartó filas';
  end if;
  if (select count(*) from public.event_inbox where estado = 'triaje' and triaje_en is not null) <> 20
     or (select count(*) from public.event_inbox where estado <> 'triaje' and triaje_en is not null) <> 0 then
    raise exception 'CONTRATO 2: solo los de triaje llevan hora de triaje';
  end if;
  -- Dentro de la misma hora no pasa ninguno más.
  set local role service_role;
  v_pasados := public.office_filtrar_bandeja();
  reset role;
  if v_pasados <> 0 then
    raise exception 'CONTRATO 2: con la cuota gastada el filtro pasó % más', v_pasados;
  end if;
end;
$cuota$;

-- 6. El filtro no tocó ninguna otra columna: la clave, el origen y la referencia siguen como entraron.
do $columnas$
begin
  if exists (
    select 1 from public.event_inbox
     where clave_dedupe <> 'chatwoot:conv:' || split_part(payload_ref, '/', 2) || ':msg:' || split_part(payload_ref, '/', 4)
        or origen <> 'chatwoot' or tipo <> 'chatwoot.message_created'
  ) then
    raise exception 'CONTRATO 6: el filtro cambió la clave, el origen, el tipo o la referencia';
  end if;
end;
$columnas$;

-- 3. La cuota es por hora: con la hora de triaje de hace 2 h, pasa el resto.
update public.event_inbox set triaje_en = now() - interval '2 hours' where estado = 'triaje';
do $hora$
declare
  v_pasados integer;
begin
  set local role service_role;
  v_pasados := public.office_filtrar_bandeja();
  reset role;
  if v_pasados <> 10 then
    raise exception 'CONTRATO 3: pasada la hora, el filtro debía pasar los 10 que esperaban, pasó %', v_pasados;
  end if;
  if (select count(*) from public.event_inbox where estado = 'nuevo') <> 0 then
    raise exception 'CONTRATO 3: no debía quedar nada en «nuevo»';
  end if;
  -- Una cuota menor se respeta contando lo de la última hora: 10 usados, cuota 12 → 2 libres.
  insert into public.event_inbox (tipo, origen, clave_dedupe, prioridad, payload_ref)
  select 'chatwoot.message_created', 'chatwoot', 'chatwoot:conv:' || g || ':msg:' || g, 2,
         'chatwoot:conversations/' || g || '/messages/' || g
    from generate_series(100, 109) g;
  set local role service_role;
  v_pasados := public.office_filtrar_bandeja(12);
  reset role;
  if v_pasados <> 2 then
    raise exception 'CONTRATO 3: con 10 usados y cuota 12 debía pasar 2, pasó %', v_pasados;
  end if;
  -- Cuota 0: no pasa nada.
  set local role service_role;
  v_pasados := public.office_filtrar_bandeja(0);
  reset role;
  if v_pasados <> 0 then
    raise exception 'CONTRATO 3: con cuota 0 el filtro pasó %', v_pasados;
  end if;
end;
$hora$;

-- 4b. Pausada de nuevo: lo que llega se guarda y no avanza.
select set_config('test.uid', '00000000-0000-4000-8000-00000000a001', true);
set local role authenticated;
select public.office_cambiar_pausa(true, 'Contrato 0544: pausa otra vez');
reset role;
select set_config('test.uid', '', true);
update public.event_inbox set triaje_en = now() - interval '5 hours' where estado = 'triaje';
do $pausa2$
declare
  v_pasados integer;
  v_nuevos_antes integer := (select count(*) from public.event_inbox where estado = 'nuevo');
begin
  set local role service_role;
  v_pasados := public.office_filtrar_bandeja(1000);
  reset role;
  if v_pasados <> 0 or (select count(*) from public.event_inbox where estado = 'nuevo') <> v_nuevos_antes then
    raise exception 'CONTRATO 4: pausada otra vez, el filtro movió filas';
  end if;
end;
$pausa2$;

-- 5. Privilegios.
do $privilegios$
begin
  begin
    set local role service_role;
    perform public.office_filtrar_bandeja(-1);
    raise exception 'CONTRATO 5: aceptó una cuota negativa';
  exception when sqlstate '22023' then null;
  end;
  reset role;
  begin
    set local role service_role;
    perform public.office_filtrar_bandeja(1001);
    raise exception 'CONTRATO 5: aceptó una cuota de 1001';
  exception when sqlstate '22023' then null;
  end;
  reset role;
  begin
    set local role service_role;
    perform public.office_filtrar_bandeja(null);
    raise exception 'CONTRATO 5: aceptó una cuota nula';
  exception when sqlstate '22023' then null;
  end;
  reset role;

  if has_function_privilege('anon', 'public.office_filtrar_bandeja(integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.office_filtrar_bandeja(integer)', 'EXECUTE') then
    raise exception 'CONTRATO 5: anon o authenticated ejecutan el filtro';
  end if;
  begin
    set local role authenticated;
    perform public.office_filtrar_bandeja();
    raise exception 'CONTRATO 5: authenticated ejecutó el filtro';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- service_role no escribe la hora de triaje por su cuenta.
  begin
    set local role service_role;
    update public.event_inbox set triaje_en = now();
    raise exception 'CONTRATO 5: service_role actualizó triaje_en';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role service_role;
    insert into public.event_inbox (tipo, origen, clave_dedupe, triaje_en)
    values ('chatwoot.message_created', 'chatwoot', 'chatwoot:conv:999:msg:999', now());
    raise exception 'CONTRATO 5: service_role insertó triaje_en';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- anon y authenticated no alcanzan la tabla, tampoco la columna nueva.
  if has_any_column_privilege('anon', 'public.event_inbox', 'SELECT')
     or has_any_column_privilege('authenticated', 'public.event_inbox', 'SELECT')
     or has_column_privilege('authenticated', 'public.event_inbox', 'triaje_en', 'UPDATE') then
    raise exception 'CONTRATO 5: anon o authenticated alcanzan event_inbox';
  end if;
end;
$privilegios$;

rollback;
