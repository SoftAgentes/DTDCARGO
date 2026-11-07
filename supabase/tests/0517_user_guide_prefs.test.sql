\set ON_ERROR_STOP on

-- SDD-0589 · contrato de 0517 (user_guide_prefs), paso 9.3.
--
-- Monta lo mínimo que la 0517 da por sentado: auth.uid() leyendo el JWT, auth.users,
-- tenants, user_tenants con disabled_at (0200) y touch_updated_at() (0002). Aplica la
-- 0517 REAL y escribe como la acción de Studio, que usa la sesión del usuario
-- (authenticated con su JWT), y como service_role.
--
-- CONTROL ROJO: sin 0517 cae en la primera aserción (la tabla no existe).
--
-- Termina siempre en ROLLBACK. Solo ids sintéticos.
begin;

do $roles$
begin
  if to_regclass('public.user_guide_prefs') is not null then
    raise exception 'Fixture 0517 rechazada: el objeto real ya existe';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table auth.users (id uuid primary key);

create table public.tenants (id uuid primary key, slug text);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
grant select on public.user_tenants to authenticated;

-- Copia de 0002.
create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001', 'dtd'),
  ('10000000-0000-0000-0000-000000000002', 'otro');
insert into auth.users values
  ('20000000-0000-0000-0000-000000000001'),  -- dueño, T1
  ('20000000-0000-0000-0000-000000000002'),  -- compañero, T1
  ('20000000-0000-0000-0000-000000000003'),  -- desactivado, T1
  ('20000000-0000-0000-0000-000000000004');  -- de T2
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'commercial', null),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'operations', null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'commercial', now()),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'admin', null);

\ir ../migrations/0517_user_guide_prefs.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0517: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Ejecuta con un rol (y el JWT del usuario si es authenticated); devuelve las filas tocadas.
create function pg_temp.como(p_rol text, p_user uuid, p_sql text) returns integer language plpgsql as $$
declare v_rows integer;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  execute format('set local role %I', p_rol);
  execute p_sql;
  get diagnostics v_rows = row_count;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v_rows;
exception when others then
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  raise;
end;
$$;

-- ¿Falla la sentencia? Devuelve el SQLSTATE o null si pasó.
create function pg_temp.falla(p_rol text, p_user uuid, p_sql text) returns text language plpgsql as $$
begin
  perform pg_temp.como(p_rol, p_user, p_sql);
  return null;
exception when others then
  return sqlstate;
end;
$$;

-- Cuántas filas ve el usuario.
create function pg_temp.ve(p_user uuid) returns integer language plpgsql as $$
declare v integer;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  select count(*) into v from public.user_guide_prefs;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v;
end;
$$;

-- El INSERT que hace la acción: su propia fila, en un tenant.
create function pg_temp.guardar(p_tenant uuid, p_user uuid, p_state text default '{"v":1,"recorridos":{}}')
returns text language sql as $$
  select format(
    $q$insert into public.user_guide_prefs (tenant_id, user_id, state) values (%L, %L, %L::jsonb)$q$,
    p_tenant, p_user, p_state);
$$;

do $guia$
declare
  t1 constant uuid := '10000000-0000-0000-0000-000000000001';
  t2 constant uuid := '10000000-0000-0000-0000-000000000002';
  duenio constant uuid := '20000000-0000-0000-0000-000000000001';
  companiero constant uuid := '20000000-0000-0000-0000-000000000002';
  desactivado constant uuid := '20000000-0000-0000-0000-000000000003';
  otro constant uuid := '20000000-0000-0000-0000-000000000004';
  antes timestamptz;
  despues timestamptz;
begin
  perform pg_temp.assert_true(to_regclass('public.user_guide_prefs') is not null,
    'existe user_guide_prefs');

  -- El dueño escribe y lee su fila.
  perform pg_temp.assert_true(pg_temp.como('authenticated', duenio, pg_temp.guardar(t1, duenio)) = 1,
    'el dueño guarda su estado');
  perform pg_temp.assert_true(pg_temp.ve(duenio) = 1, 'el dueño ve su fila');
  perform pg_temp.assert_true(pg_temp.como('authenticated', duenio,
    $q$update public.user_guide_prefs set state = '{"v":1,"recorridos":{"dashboard":{"pasoId":"D2","terminado":false,"noMostrar":false,"vistoEn":"2026-11-06T00:00:00Z"}}}'$q$) = 1,
    'el dueño actualiza su estado');

  -- Nadie más.
  perform pg_temp.assert_true(pg_temp.ve(companiero) = 0, 'un compañero del mismo tenant no ve la fila del dueño');
  perform pg_temp.assert_true(pg_temp.como('authenticated', companiero,
    $q$update public.user_guide_prefs set state = '{}'$q$) = 0,
    'un compañero no cambia la fila del dueño');
  perform pg_temp.assert_true(pg_temp.como('authenticated', companiero,
    'delete from public.user_guide_prefs') = 0,
    'un compañero no borra la fila del dueño');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', companiero, pg_temp.guardar(t1, duenio)) = '42501',
    'nadie escribe una fila a nombre de otro');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', duenio, pg_temp.guardar(t2, duenio)) = '42501',
    'nadie escribe en un tenant al que no pertenece');
  perform pg_temp.assert_true(pg_temp.ve(otro) = 0, 'el usuario de otro tenant no ve nada de T1');
  perform pg_temp.assert_true(pg_temp.falla('anon', null,
    'select count(*) from public.user_guide_prefs') = '42501', 'anon no lee el estado de la guía');

  -- Un usuario desactivado no lee ni escribe su fila.
  perform pg_temp.assert_true(pg_temp.como('service_role', null, pg_temp.guardar(t1, desactivado)) = 1,
    'service_role guarda una fila del desactivado (fixture)');
  perform pg_temp.assert_true(pg_temp.ve(desactivado) = 0, 'un usuario desactivado no lee su fila');
  perform pg_temp.assert_true(pg_temp.como('authenticated', desactivado,
    $q$update public.user_guide_prefs set state = '{}'$q$) = 0,
    'un usuario desactivado no cambia su fila');

  -- Una fila por tenant y usuario.
  perform pg_temp.assert_true(pg_temp.falla('authenticated', duenio, pg_temp.guardar(t1, duenio)) = '23505',
    'una sola fila por tenant y usuario');

  -- Forma del estado.
  perform pg_temp.assert_true(pg_temp.falla('service_role', null, pg_temp.guardar(t1, companiero, '[]')) = '23514',
    'el estado es un objeto');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null, format(
    $q$insert into public.user_guide_prefs (tenant_id, user_id, state)
       values (%L, %L, jsonb_build_object('x', repeat('a', 20000)))$q$, t1, companiero)) = '23514',
    'el estado tiene tope de tamaño');

  -- updated_at se mueve con cada cambio. now() es fijo dentro de la transacción, así
  -- que la fecha vieja se pone sin disparar el trigger.
  perform set_config('session_replication_role', 'replica', true);
  update public.user_guide_prefs set updated_at = now() - interval '1 day' where user_id = duenio;
  perform set_config('session_replication_role', 'origin', true);
  select updated_at into antes from public.user_guide_prefs where user_id = duenio;
  perform pg_temp.como('authenticated', duenio, $q$update public.user_guide_prefs set state = '{"v":1,"recorridos":{}}'$q$);
  select updated_at into despues from public.user_guide_prefs where user_id = duenio;
  perform pg_temp.assert_true(despues > antes, 'updated_at se mueve con cada cambio');

  -- El dueño borra su fila; el borrado del usuario arrastra la suya.
  perform pg_temp.assert_true(pg_temp.como('authenticated', duenio, 'delete from public.user_guide_prefs') = 1,
    'el dueño borra su fila');
  delete from auth.users where id = desactivado;
  perform pg_temp.assert_true(not exists (select 1 from public.user_guide_prefs where user_id = desactivado),
    'al borrar el usuario se borra su fila');
end;
$guia$;

select 'TEST 0517 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;

rollback;
