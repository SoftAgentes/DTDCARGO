\set ON_ERROR_STOP on

-- Contrato desechable de la 0510 (SDD-0591). Fixture sintética y ROLLBACK.
-- Aplica las migraciones REALES de facturas (0077), contabilidad (0078),
-- cobranzas (0079, 0122), tesorería (0088) y auditoría (0258/0261/0267/0290), y
-- encima la 0510.
--
-- Prueba la matriz de roles sobre public.accounts: leer es del equipo del tenant
-- y escribir es de accounting y admin. El caso que la motivó: nadie más puede
-- cambiar is_postable de la 4.5, de la que depende la validez de las ventas
-- desde la 0497.
--
-- CONTROL ROJO: con `-v apply_fix=false` la 0510 no se aplica y la primera
-- aserción de escritura falla, porque el comercial puede crear una cuenta.
-- En CI, que no tiene Docker, este mismo contrato corre en PGlite:
-- lib/studio/__tests__/rls-escritura-accounts.migration.test.ts.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.invoices') is not null or to_regclass('public.tenants') is not null
     or to_regclass('public.entity_audit_log') is not null then
    raise exception 'TEST 0510: fixture rechazada, la base ya contiene objetos de aplicación';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$fixture_guard$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema auth to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
-- Columnas de 0001/0019/0200, con el CHECK de rol de producción.
create table public.tenants (id uuid primary key, slug text unique not null, display_name text not null);
create table public.user_tenants (
  user_id uuid not null references auth.users(id), tenant_id uuid not null references public.tenants(id),
  role text not null, disabled_at timestamptz, primary key (user_id, tenant_id),
  constraint user_tenants_role_check check (role in ('admin', 'commercial', 'operations', 'accounting',
    'warehouse', 'support', 'marketing'))
);
alter table public.user_tenants enable row level security;
grant select on public.user_tenants to authenticated;
create policy "users see their own user_tenants" on public.user_tenants
  for select to authenticated using (user_id = (select auth.uid()) and disabled_at is null);
-- La semántica de 0453 (la ÚNICA membresía activa) y de 0200.
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1] from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
-- El cuerpo exacto de la 0200: la 0510 lo fija por md5.
create or replace function public.current_studio_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_tenants
  where user_id = (select auth.uid())
    and disabled_at is null
  limit 1
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
-- 0077 apunta a shipments; 0122 hace backfill por shipment_service.
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  shipment_service text, deleted_at timestamptz
);
-- Plataforma legacy mínima de 0267, igual que el contrato 0470.
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  entity_type text not null, entity_id uuid not null, actor_type text not null,
  actor_id uuid, event_type text not null, payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint entity_audit_log_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint entity_audit_log_actor_type_check check (actor_type in ('user', 'operario', 'system'))
);
alter table public.entity_audit_log enable row level security;
create policy entity_audit_log_tenant_select on public.entity_audit_log for select to authenticated
  using (tenant_id = public.get_user_tenant_id());
create policy entity_audit_log_service_role_all on public.entity_audit_log for all to service_role
  using (true) with check (true);
grant select on public.entity_audit_log to authenticated;
grant all on public.entity_audit_log to service_role;
create publication supabase_realtime;
alter publication supabase_realtime add table public.entity_audit_log;

\ir ../migrations/0077_invoices.sql
\ir ../migrations/0078_contabilidad.sql
\ir ../migrations/0079_cobranzas.sql
\ir ../migrations/0088_tesoreria.sql
\ir ../migrations/0122_recibos_cobranza.sql
\ir ../migrations/0258_audit_entity_catalog.sql
\ir ../migrations/0261_audit_entity_catalog_validate.sql
\ir ../migrations/0267_audit_contract_append_only.sql
\ir ../migrations/0290_audit_d2_financial_domain.sql

-- 0131:41, sin el resto de esa migración, que pide gastos.
alter table public.accounts add column if not exists subtype text;
-- Supabase le da a service_role todo sobre public por default privileges. La
-- ACL de producción de accounts es {authenticated=arwd, service_role=arwdDxtm} y
-- anon no tiene nada. La fixture lo replica para poder comprobarlo.
grant all on all tables in schema public to service_role;

create function pg_temp.fid(p_label text) returns uuid language sql immutable as $$
  select md5('0510-synthetic-' || p_label)::uuid
$$;

-- Un usuario por rol en el tenant A; uno desactivado; uno con dos membresías;
-- un cliente del portal, sin membresía; y accounting en B.
insert into auth.users (id)
select pg_temp.fid(u) from unnest(array['accounting-A', 'admin-A', 'commercial-A', 'operations-A',
  'warehouse-A', 'support-A', 'marketing-A', 'accounting-off', 'accounting-dos', 'cliente-portal',
  'accounting-B']) u;
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fid('tenant-A'), 'tenant-a-0510', 'Tenant A 0510'),
  (pg_temp.fid('tenant-B'), 'tenant-b-0510', 'Tenant B 0510');
insert into public.user_tenants (user_id, tenant_id, role, disabled_at)
select pg_temp.fid(v.u), pg_temp.fid(v.t), v.r, case when v.off then now() end from (values
  ('accounting-A', 'tenant-A', 'accounting', false), ('admin-A', 'tenant-A', 'admin', false),
  ('commercial-A', 'tenant-A', 'commercial', false), ('operations-A', 'tenant-A', 'operations', false),
  ('warehouse-A', 'tenant-A', 'warehouse', false), ('support-A', 'tenant-A', 'support', false),
  ('marketing-A', 'tenant-A', 'marketing', false), ('accounting-off', 'tenant-A', 'accounting', true),
  ('accounting-dos', 'tenant-A', 'accounting', false), ('accounting-dos', 'tenant-B', 'accounting', false),
  ('accounting-B', 'tenant-B', 'accounting', false)
) v(u, t, r, off);
-- El grupo 4, la 4.5 de la que dependen las ventas y una hoja sin movimientos.
insert into public.accounts (id, tenant_id, code, name, type, parent_id, is_postable)
select pg_temp.fid(v.etiqueta || '-' || t), pg_temp.fid('tenant-' || t), v.codigo, v.etiqueta || ' ' || t, 'I'::public.acct_type,
  case when v.padre is null then null else pg_temp.fid(v.padre || '-' || t) end, v.postable
from unnest(array['A', 'B']) t
cross join (values ('grupo', '4', null, false), ('ingreso', '4.5', 'grupo', true), ('hoja', '4.6', 'grupo', true)) v(etiqueta, codigo, padre, postable);

-- Lo que la 0510 NO puede tocar.
create temporary table baseline_policies as
select to_jsonb(p) as definition from pg_catalog.pg_policies p where p.tablename <> 'accounts';
create temporary table baseline_acl as select c.oid, c.relacl from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v');
create temporary table baseline_triggers as select t.oid, to_jsonb(t) as definition
from pg_trigger t where not t.tgisinternal;
create temporary table baseline_functions as
select p.oid, to_jsonb(p) as definition from pg_catalog.pg_proc p
join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'auth');
create temporary table baseline_rows as select to_jsonb(a) as row_data from public.accounts a;

\if :apply_fix
\ir ../migrations/0510_rls_escritura_accounts.sql
\endif

-- ── Aserciones ──────────────────────────────────────────────
create temporary sequence aserciones;
create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0510: %', p_msg; end if;
  perform nextval('pg_temp.aserciones');
end;
$$;

-- Corre p_sql como el actor (rol de la API + su auth.uid) y cuenta filas o
-- devuelve el error. No reemplaza autorización: la da la RLS real.
create function pg_temp.intenta(p_actor text, p_sql text, p_rol text default 'authenticated')
returns jsonb language plpgsql as $$
declare v_filas bigint := 0; v_state text; v_msg text;
begin
  perform set_config('request.jwt.claim.sub',
    case when p_actor is null then '' else pg_temp.fid(p_actor)::text end, true);
  begin
    execute format('set local role %I', p_rol);
    execute p_sql;
    get diagnostics v_filas = row_count;
    reset role;
    return jsonb_build_object('ok', true, 'filas', v_filas);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    reset role;
    return jsonb_build_object('ok', false, 'sqlstate', v_state, 'mensaje', v_msg);
  end;
end;
$$;

-- Cuenta lo que el actor ve de ese tenant.
create function pg_temp.cuenta(p_actor text, p_tenant text) returns bigint
language plpgsql as $$
declare v bigint;
begin
  perform set_config('request.jwt.claim.sub', pg_temp.fid(p_actor)::text, true);
  set local role authenticated;
  execute format('select count(*) from public.accounts where tenant_id = %L', pg_temp.fid('tenant-' || p_tenant)) into v;
  reset role;
  return v;
end;
$$;

create function pg_temp.alta_sql(p_tenant text, p_codigo text) returns text
language sql immutable as $$
  select format($q$insert into public.accounts (tenant_id, code, name, type, parent_id, is_postable)
    values (%L, %L, 'Cuenta nueva', 'I', %L, true)$q$,
    pg_temp.fid('tenant-' || p_tenant), p_codigo, pg_temp.fid('grupo-' || p_tenant))
$$;

-- Los cambios que dejarían sin cobro a las ventas, sobre la 4.5.
create function pg_temp.cambios_peligrosos(p_tenant text) returns table (que text, sentencia text)
language sql immutable as $$
  select v.que, format('update public.accounts set %s where id = %L', v.asignacion, pg_temp.fid('ingreso-' || p_tenant))
  from (values
    ('is_postable', 'is_postable = false'),
    ('parent_id', 'parent_id = null'),
    ('code', $c$code = '4.5.9'$c$),
    ('type', $c$type = 'G'$c$)
  ) v(que, asignacion)
$$;

create function pg_temp.ingreso(p_tenant text) returns jsonb language sql stable as $$
  select to_jsonb(a) - 'updated_at' from public.accounts a where a.id = pg_temp.fid('ingreso-' || p_tenant)
$$;

do $sin_filas$
begin
  -- 1. La 0510 no cambia ninguna fila al aplicarse.
  perform pg_temp.afirmar(not exists (
    select 1 from (select to_jsonb(a) as row_data from public.accounts a) ahora
    full join baseline_rows b on b.row_data = ahora.row_data
    where b.row_data is null or ahora.row_data is null),
    'aplicar la migración cambió filas de accounts');
end;
$sin_filas$;

do $matriz$
declare
  v_financieros text[] := array['accounting-A', 'admin-A'];
  v_otros text[] := array['commercial-A', 'operations-A', 'warehouse-A', 'support-A', 'marketing-A'];
  v_fuera text[] := array['accounting-off', 'accounting-dos', 'cliente-portal'];
  v_actor text; v_r jsonb; v_i integer := 0; v_c record; v_antes jsonb; v_codigo text; v_audit bigint;
begin
  -- 2. Leer no cambia: todo el equipo activo del tenant ve el mismo plan.
  perform pg_temp.afirmar(pg_temp.cuenta('accounting-A', 'A') = 3, 'accounting no ve las 3 cuentas del tenant A');
  foreach v_actor in array v_otros loop
    perform pg_temp.afirmar(pg_temp.cuenta(v_actor, 'A') = 3, format('%s dejó de leer el plan de cuentas', v_actor));
  end loop;

  -- 3. Crear, editar como la app y borrar es de accounting y admin.
  foreach v_actor in array v_financieros loop
    v_i := v_i + 1;
    v_codigo := '4.7.' || v_i;
    v_r := pg_temp.intenta(v_actor, pg_temp.alta_sql('A', v_codigo));
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 1,
      format('%s no pudo dar de alta una cuenta (%s)', v_actor, coalesce(v_r ->> 'sqlstate', v_r ->> 'filas')));

    -- La misma escritura de updateAccount en contabilidad/actions.ts.
    v_r := pg_temp.intenta(v_actor, format(
      $q$update public.accounts set name = 'Editada', type = 'I', subtype = null, is_postable = false, notes = 'nota'
         where code = %L and tenant_id = %L$q$, v_codigo, pg_temp.fid('tenant-A')));
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 1,
      format('%s no pudo editar una cuenta (%s)', v_actor, coalesce(v_r ->> 'sqlstate', v_r ->> 'filas')));

    v_r := pg_temp.intenta(v_actor, format(
      'delete from public.accounts where code = %L and tenant_id = %L', v_codigo, pg_temp.fid('tenant-A')));
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 1,
      format('%s no pudo borrar una cuenta (%s)', v_actor, coalesce(v_r ->> 'sqlstate', v_r ->> 'filas')));
  end loop;

  -- 4. Ningún otro rol crea, edita ni borra, y nada queda escrito.
  select count(*) into v_audit from public.entity_audit_log where entity_type = 'account';
  foreach v_actor in array v_otros loop
    v_r := pg_temp.intenta(v_actor, pg_temp.alta_sql('A', '4.8'));
    perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
      format('%s pudo dar de alta en accounts (%s)', v_actor, coalesce(v_r ->> 'sqlstate', 'sin error')));

    v_antes := pg_temp.ingreso('A');
    for v_c in select * from pg_temp.cambios_peligrosos('A') loop
      v_r := pg_temp.intenta(v_actor, v_c.sentencia);
      perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 0,
        format('%s cambió %s de la 4.5 (%s)', v_actor, v_c.que, coalesce(v_r ->> 'sqlstate', v_r ->> 'filas')));
      perform pg_temp.afirmar(pg_temp.ingreso('A') = v_antes, format('la 4.5 cambió tras el intento de %s', v_actor));
    end loop;

    v_r := pg_temp.intenta(v_actor, format('delete from public.accounts where id = %L', pg_temp.fid('hoja-A')));
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 0,
      format('%s borró de accounts (%s)', v_actor, coalesce(v_r ->> 'sqlstate', v_r ->> 'filas')));
    perform pg_temp.afirmar(exists (select 1 from public.accounts a where a.id = pg_temp.fid('hoja-A')),
      format('la hoja desapareció tras el intento de %s', v_actor));
  end loop;
  perform pg_temp.afirmar((select count(*) from public.entity_audit_log where entity_type = 'account') = v_audit,
    'un intento rechazado dejó un evento de auditoría');

  -- 5. Sin membresía activa única no se lee ni se escribe: desactivado, con dos
  -- membresías o cliente del portal.
  foreach v_actor in array v_fuera loop
    perform pg_temp.afirmar(pg_temp.cuenta(v_actor, 'A') = 0, format('%s lee el plan del tenant A', v_actor));
    v_r := pg_temp.intenta(v_actor, pg_temp.alta_sql('A', '4.8'));
    perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
      format('%s pudo dar de alta en accounts (%s)', v_actor, coalesce(v_r ->> 'sqlstate', 'sin error')));
    v_r := pg_temp.intenta(v_actor, format('update public.accounts set is_postable = false where id = %L', pg_temp.fid('ingreso-A')));
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 0,
      format('%s cambió is_postable de la 4.5 (%s)', v_actor, coalesce(v_r ->> 'sqlstate', v_r ->> 'filas')));
    v_r := pg_temp.intenta(v_actor, format('delete from public.accounts where id = %L', pg_temp.fid('hoja-A')));
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 0,
      format('%s borró de accounts (%s)', v_actor, coalesce(v_r ->> 'sqlstate', v_r ->> 'filas')));
  end loop;

  -- 6. Otro tenant: ni el rol financiero cruza.
  perform pg_temp.afirmar(pg_temp.cuenta('accounting-B', 'A') = 0, 'accounting-B lee el plan del tenant A');
  perform pg_temp.afirmar(pg_temp.cuenta('accounting-B', 'B') = 3, 'accounting-B dejó de leer su propio plan');
  v_r := pg_temp.intenta('accounting-B', pg_temp.alta_sql('A', '4.8'));
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
    format('accounting-B dio de alta en el tenant A (%s)', coalesce(v_r ->> 'sqlstate', 'sin error')));
  v_r := pg_temp.intenta('accounting-B', format('update public.accounts set is_postable = false where id = %L', pg_temp.fid('ingreso-A')));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 0, 'accounting-B editó la 4.5 del tenant A');
  v_r := pg_temp.intenta('accounting-B', format('delete from public.accounts where id = %L', pg_temp.fid('hoja-A')));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 0, 'accounting-B borró una cuenta del tenant A');

  -- 7. El rol financiero no se lleva una cuenta a otro tenant.
  v_r := pg_temp.intenta('accounting-A', format('update public.accounts set tenant_id = %L where id = %L',
    pg_temp.fid('tenant-B'), pg_temp.fid('hoja-A')));
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
    format('accounting-A movió una cuenta al tenant B (%s)', coalesce(v_r ->> 'sqlstate', 'sin error')));
  -- Si la sentencia no lee ninguna columna, no entra la policy de SELECT y el WITH
  -- CHECK de UPDATE es lo único que lo frena. El código nuevo es para que no salte
  -- antes el UNIQUE (tenant, code).
  v_r := pg_temp.intenta('accounting-A', format($q$update public.accounts set tenant_id = %L, code = gen_random_uuid()::text$q$, pg_temp.fid('tenant-B')));
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
    format('accounting-A movió cuentas al tenant B sin filtro (%s)', coalesce(v_r ->> 'sqlstate', 'sin error')));

  -- 8. anon no tiene GRANT: ni lee ni escribe.
  v_r := pg_temp.intenta(null, 'select count(*) from public.accounts', 'anon');
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501', 'anon lee accounts');
  v_r := pg_temp.intenta(null, format('update public.accounts set is_postable = false where id = %L', pg_temp.fid('ingreso-A')), 'anon');
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501', 'anon edita accounts');

  -- 9. service_role sigue escribiendo: jobs y operación.
  v_r := pg_temp.intenta(null, format('update public.accounts set notes = %L where id = %L', 'job', pg_temp.fid('hoja-A')), 'service_role');
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 1, 'service_role dejó de poder editar accounts');

  -- 10. Un cambio permitido sigue dejando rastro en auditoría.
  select count(*) into v_audit from public.entity_audit_log where entity_type = 'account';
  v_r := pg_temp.intenta('accounting-A', format('update public.accounts set is_postable = false where id = %L', pg_temp.fid('hoja-A')));
  perform pg_temp.afirmar((v_r ->> 'filas')::int = 1, 'accounting-A no pudo volver grupo la hoja');
  perform pg_temp.afirmar((select count(*) from public.entity_audit_log where entity_type = 'account') = v_audit + 1,
    'el cambio de is_postable no dejó evento de auditoría');
end;
$matriz$;

do $forma$
begin
  -- 11. La forma: cuatro policies, ninguna FOR ALL, sin FORCE y la misma ACL.
  perform pg_temp.afirmar((select count(*) from pg_catalog.pg_policies p
    where p.schemaname = 'public' and p.tablename = 'accounts') = 4, 'accounts no tiene cuatro policies');
  perform pg_temp.afirmar(not exists (select 1 from pg_catalog.pg_policies p
    where p.schemaname = 'public' and p.tablename = 'accounts' and p.cmd = 'ALL'), 'accounts conserva una policy FOR ALL');
  perform pg_temp.afirmar(not (select c.relforcerowsecurity from pg_class c where c.oid = 'public.accounts'::regclass),
    'accounts quedó con FORCE');
  perform pg_temp.afirmar(
    has_table_privilege('authenticated', 'public.accounts', 'SELECT')
    and has_table_privilege('authenticated', 'public.accounts', 'INSERT')
    and has_table_privilege('authenticated', 'public.accounts', 'UPDATE')
    and has_table_privilege('authenticated', 'public.accounts', 'DELETE')
    and has_table_privilege('service_role', 'public.accounts', 'DELETE')
    and not has_table_privilege('anon', 'public.accounts', 'SELECT,INSERT,UPDATE,DELETE'),
    'la ACL de accounts no quedó como se esperaba');
end;
$forma$;

do $sin_efectos$
begin
  -- 12. La 0510 no toca nada más.
  perform pg_temp.afirmar(not exists (
    select 1 from (
      select to_jsonb(p) as definition from pg_catalog.pg_policies p where p.tablename <> 'accounts'
    ) ahora full join baseline_policies b on b.definition = ahora.definition
    where b.definition is null or ahora.definition is null),
    'cambiaron policies de otras tablas');
  perform pg_temp.afirmar(not exists (
    select 1 from (
      select c.oid, c.relacl from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v')
    ) ahora full join baseline_acl b on b.oid = ahora.oid
    where b.oid is null or ahora.oid is null or b.relacl is distinct from ahora.relacl),
    'cambió la ACL de alguna tabla');
  perform pg_temp.afirmar(not exists (
    select 1 from (select t.oid, to_jsonb(t) as definition from pg_trigger t where not t.tgisinternal) ahora
    full join baseline_triggers b on b.oid = ahora.oid
    where b.oid is null or ahora.oid is null or b.definition is distinct from ahora.definition),
    'cambió algún trigger');
  perform pg_temp.afirmar(not exists (
    select 1 from (
      select p.oid, to_jsonb(p) as definition from pg_catalog.pg_proc p
      join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'auth')
    ) ahora full join baseline_functions b on b.oid = ahora.oid
    where b.oid is null or ahora.oid is null or b.definition is distinct from ahora.definition),
    'cambió alguna función');
end;
$sin_efectos$;

select 'TEST 0510 GREEN: ' || currval('pg_temp.aserciones') || ' aserciones' as resultado;
rollback;
