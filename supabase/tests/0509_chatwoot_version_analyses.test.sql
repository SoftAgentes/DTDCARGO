\set ON_ERROR_STOP on

-- SDD-0588 · contrato de 0509 (chatwoot_version_analyses), paso 3.4.
--
-- Monta lo mínimo que 0507 y 0509 dan por sentado: auth.uid() leyendo el JWT,
-- tenants, user_tenants, get_user_tenant_id() (copia de 0453) e is_tenant_admin()
-- (copia de 0386). Aplica la 0507 REAL (de ella cuelga check_id) y la 0509 REAL, y
-- escribe como la acción de Studio (service_role, después del gate) y como un
-- usuario de Studio (authenticated con su JWT).
--
-- CONTROL ROJO: sin 0509 cae en la primera aserción (la tabla no existe).
--
-- Termina siempre en ROLLBACK. Solo ids y versiones sintéticas.
begin;

do $roles$
begin
  if to_regclass('public.chatwoot_version_analyses') is not null then
    raise exception 'Fixture 0509 rechazada: el objeto real ya existe';
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

-- Copia de 0453.
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1]
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid())
    and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
grant execute on function public.get_user_tenant_id() to authenticated;

-- Copia de 0386.
create function public.is_tenant_admin() returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce(exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = (select public.get_user_tenant_id())
      and ut.role = 'admin'
      and ut.disabled_at is null
  ), false);
$fn$;
grant execute on function public.is_tenant_admin() to authenticated;

insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001', 'dtd'),
  ('10000000-0000-0000-0000-000000000002', 'otro');
insert into auth.users values
  ('20000000-0000-0000-0000-000000000001'),  -- admin de T1
  ('20000000-0000-0000-0000-000000000002'),  -- admin de T2
  ('20000000-0000-0000-0000-000000000003');  -- commercial de T1
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin', null),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'admin', null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'commercial', null);

\ir ../migrations/0507_chatwoot_versiones.sql
\ir ../migrations/0509_chatwoot_version_analyses.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0509: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Ejecuta con un rol (y el JWT del usuario si es authenticated).
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
  select count(*) into v from public.chatwoot_version_analyses;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v;
end;
$$;

-- Un INSERT de service_role con los campos variables; el resto, válido.
create function pg_temp.analisis(p_tenant uuid, p_campos text, p_valores text) returns text language sql as $$
  select format(
    $q$insert into public.chatwoot_version_analyses
       (tenant_id, from_version, to_version, package_files, package_chars, report, %s)
       values (%L, '4.19.1', '4.20.0', 3, 1200, '{"piezas":[]}', %s)$q$,
    p_campos, p_tenant, p_valores);
$$;

do $analisis$
declare
  t1 constant uuid := '10000000-0000-0000-0000-000000000001';
  t2 constant uuid := '10000000-0000-0000-0000-000000000002';
  admin1 constant uuid := '20000000-0000-0000-0000-000000000001';
  admin2 constant uuid := '20000000-0000-0000-0000-000000000002';
  comercial constant uuid := '20000000-0000-0000-0000-000000000003';
begin
  perform pg_temp.assert_true(to_regclass('public.chatwoot_version_analyses') is not null,
    'existe chatwoot_version_analyses');

  -- Escritura: solo service_role.
  perform pg_temp.assert_true(pg_temp.como('service_role', null, pg_temp.analisis(t1,
    'engine, model, recommendation, requested_by', format($v$'glm', 'glm-4.6', 'revisar', %L$v$, admin1))) = 1,
    'la acción (service_role) guarda un análisis con IA');
  perform pg_temp.assert_true(pg_temp.como('service_role', null, pg_temp.analisis(t2,
    'engine, recommendation, fallback_reason', $v$'sin_ia', 'seguro', 'motor_apagado'$v$)) = 1,
    'la acción guarda un análisis sin IA');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', admin1, pg_temp.analisis(t1,
    'engine, model, recommendation', $v$'glm', 'glm-4.6', 'seguro'$v$)) = '42501',
    'ni el admin escribe análisis: solo la acción con service_role');

  -- Lectura: el admin de su tenant.
  perform pg_temp.assert_true(pg_temp.ve(admin1) = 1, 'el admin de T1 ve solo el análisis de T1');
  perform pg_temp.assert_true(pg_temp.ve(comercial) = 0, 'quien no es admin no ve los análisis');
  perform pg_temp.assert_true(pg_temp.ve(admin2) = 1, 'el admin de T2 ve solo el suyo');
  perform pg_temp.assert_true(pg_temp.falla('anon', null,
    'select count(*) from public.chatwoot_version_analyses') = '42501', 'anon no lee los análisis');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', admin1,
    $q$update public.chatwoot_version_analyses set recommendation = 'seguro'$q$) = '42501',
    'nadie edita un análisis desde Studio');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', admin1,
    'delete from public.chatwoot_version_analyses') = '42501',
    'nadie borra un análisis desde Studio');

  -- Forma del informe.
  perform pg_temp.assert_true(pg_temp.falla('service_role', null, pg_temp.analisis(t1,
    'engine, recommendation, fallback_reason', $v$'sin_ia', 'no_actualizar', 'motor_formato'$v$)) = '23514',
    'sin IA el informe nunca dice no actualizar');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null, pg_temp.analisis(t1,
    'engine, recommendation', $v$'sin_ia', 'seguro'$v$)) = '23514',
    'un análisis sin IA dice por qué');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null, pg_temp.analisis(t1,
    'engine, model, recommendation, fallback_reason', $v$'glm', 'glm-4.6', 'seguro', 'motor_formato'$v$)) = '23514',
    'un análisis con IA no lleva motivo de respaldo');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null, pg_temp.analisis(t1,
    'engine, recommendation', $v$'glm', 'seguro'$v$)) = '23514',
    'un análisis con IA dice qué modelo');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null, pg_temp.analisis(t1,
    'engine, model, recommendation', $v$'glm', 'glm 4.6; drop', 'seguro'$v$)) = '23514',
    'el nombre del modelo tiene forma de identificador');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null, pg_temp.analisis(t1,
    'engine, model, recommendation', $v$'glm', 'glm-4.6', 'actualizar ya'$v$)) = '23514',
    'la recomendación es seguro, revisar o no_actualizar');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null, format(
    $q$insert into public.chatwoot_version_analyses
       (tenant_id, from_version, to_version, package_files, package_chars, report, engine, model, recommendation)
       values (%L, '4.20.0', '4.20.0', 1, 1, '{}', 'glm', 'glm-4.6', 'seguro')$q$, t1)) = '23514',
    'no se analiza el salto a la misma versión');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null, format(
    $q$insert into public.chatwoot_version_analyses
       (tenant_id, from_version, to_version, package_files, package_chars, report, engine, model, recommendation)
       values (%L, '4.19', '4.20.0', 1, 1, '{}', 'glm', 'glm-4.6', 'seguro')$q$, t1)) = '23514',
    'una versión sin el formato X.Y.Z no entra');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null, format(
    $q$insert into public.chatwoot_version_analyses
       (tenant_id, from_version, to_version, package_files, package_chars, report, engine, model, recommendation)
       values (%L, '4.19.1', '4.20.0', 1, 1, '[]', 'glm', 'glm-4.6', 'seguro')$q$, t1)) = '23514',
    'el informe es un objeto');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null, format(
    $q$insert into public.chatwoot_version_analyses
       (tenant_id, from_version, to_version, package_files, package_chars, report, engine, model, recommendation)
       values (%L, '4.19.1', '4.20.0', 1, 1, jsonb_build_object('x', repeat('a', 70000)), 'glm', 'glm-4.6', 'seguro')$q$, t1)) = '23514',
    'el informe tiene tope de tamaño');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null, pg_temp.analisis(t1,
    'engine, recommendation, fallback_reason', $v$'sin_ia', 'seguro', 'otra_cosa'$v$)) = '23514',
    'el motivo del respaldo es uno de la lista');
end;
$analisis$;

select 'TEST 0509 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;

rollback;
