\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0452 (SDD-0463): por RLS, el Portal sólo lee
-- facturas del tenant de su vínculo. Fixtures ficticios y rollback: no consulta
-- ni modifica una base alojada. Aplica las migraciones reales 0080, 0430, 0085 y
-- 0452, en el orden en que viven en producción, sobre stubs mínimos de lo que
-- ellas nombran.
--
-- Lo que defiende:
--   1. RED, sin 0452: el cliente del Portal de T1 lee por RLS la factura de T2
--      que comparte su Shipping Mark, y el de T2 las de T1. También sin 0452, un
--      vínculo activo con el cliente borrado y un vínculo incoherente (vínculo
--      en T2, cliente en T1) leen facturas.
--   2. Estático: el archivo es un único `do`; `lock_timeout` 5 s y
--      `statement_timeout` 60 s van dentro y antes del lock; el lock va antes del
--      preflight y el preflight antes del DDL; sin DML, grants, comentarios,
--      alter ni funciones.
--   3. Drift: policy ausente, con un rol de más, restrictiva, FOR ALL, con otra
--      expresión, casi final, u otra policy con get_portal_client_markbox(). La
--      migración falla en el preflight con P0001, sin ids ni Shipping Marks, y no
--      cambia nada. Reaplicarla sobre la policy final alterada también falla.
--   4. Postflight: si el DDL no deja la forma final, o toca otra policy, falla.
--   5. Aplicada, la transacción queda con lock_timeout 5 s y statement_timeout
--      60 s, y el search_path de la sesión no cambia.
--   6. Con 0452, el cliente de T1 deja de leer la factura de T2 y conserva las
--      suyas, anulada incluida; el de T2, lo mismo con la suya. FRONTERA, la misma
--      de 0414 y aceptada por el Director en L07: el vínculo con cliente borrado y
--      el incoherente pierden el acceso, sin error y con cero filas. El revocado y
--      la sesión sin identidad siguen sin leer. El equipo del tenant y
--      service_role no cambian, y el Portal sigue sin escribir.
--   7. Catálogo: la policy Portal es idéntica a la que produce el predicado de
--      0414, copiado abajo sobre una tabla de referencia; las demás policies no
--      cambian, ninguna usa get_portal_client_markbox() y no cambia ninguna fila.
--   8. Reaplicar no cambia nada: la misma policy, con el mismo oid, y las mismas
--      filas.
--
-- Lo que NO mide: locks, contención ni convergencia con L07. Se midieron en
-- PostgreSQL 17 efímero; ver el handoff de la tarea portal-facturas-rls.
-- Dos mutaciones del predicado (sin `c.deleted_at is null` o sin
-- `c.tenant_id = cu.tenant_id`) no cambian las filas de este fixture, porque la
-- RLS de `clients` que dejó la 0430 ya exige lo mismo para el Portal: las detecta
-- la comparación de catálogo del punto 7.

begin;

do $fixture_guard$
begin
  if to_regnamespace('auth') is not null or to_regclass('public.invoices') is not null then
    raise exception 'TEST 0452 requiere una base PostgreSQL desechable vacía';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$fixture_guard$;

grant usage on schema public to anon, authenticated, service_role;

create schema extensions;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.tenants (id uuid primary key);

create table public.user_tenants (
  user_id uuid not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null default 'admin',
  primary key (user_id, tenant_id)
);

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid() limit 1
$$;

-- Stub del trigger de `updated_at` que la 0080 le pone a `client_users`.
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

-- `clients` con las columnas que leen la 0080, la 0430, la 0085 y la 0452. El
-- Shipping Mark es único POR tenant, como en la 0006.
create table public.clients (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  markbox text,
  name text not null,
  email text,
  deleted_at timestamptz,
  unique (tenant_id, markbox)
);
grant select on public.clients to authenticated;
alter table public.clients enable row level security;
-- La policy de equipo tal como la dejó la 0012.
create policy "clients by tenant"
  on public.clients for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

-- `shipments`, sólo para la policy Portal que crea la 0080.
create table public.shipments (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_markbox text,
  deleted_at timestamptz
);

-- La migración real del principal Portal: `client_users`, sus helpers y su RLS.
\ir ../migrations/0080_portal_cliente.sql

-- `client_change_requests`, sólo para el inventario que exige la 0430.
create table public.client_change_requests (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null,
  source text not null
);
alter table public.client_change_requests enable row level security;
create policy "client_change_requests self or tenant read"
  on public.client_change_requests for select to authenticated
  using (tenant_id = public.get_user_tenant_id());

-- La RLS de `clients` para el Portal que hoy rige: vínculo activo del mismo tenant.
\ir ../migrations/0430_portal_profile_change_requests_principal_tenant.sql

-- `invoices` con las columnas que leen la 0085 y la 0452, y la policy de equipo
-- tal como está hoy en main: FOR ALL por tenant.
create type public.invoice_status as enum ('borrador', 'emitida', 'parcial', 'pagada', 'vencida', 'anulada');
create table public.invoices (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_code text not null,
  client_markbox text not null,
  client_name text not null,
  client_rif text,
  total_amount numeric(14,2) not null,
  status public.invoice_status not null default 'borrador',
  notes text,
  deleted_at timestamptz,
  unique (tenant_id, invoice_code)
);
grant select, insert, update, delete on public.invoices to authenticated;
grant all on public.invoices to service_role;
alter table public.invoices enable row level security;
create policy "invoices by tenant"
  on public.invoices for all to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

-- La policy Portal de facturas que hoy rige en producción.
\ir ../migrations/0085_portal_invoices_rls.sql

-- ── Fixture ─────────────────────────────────────────────────────────────────
insert into public.tenants (id) values
  ('10000000-0452-4000-8000-000000000001'),   -- T1
  ('20000000-0452-4000-8000-000000000002');   -- T2, otra empresa

insert into auth.users (id, email) values
  ('a1000000-0452-4000-8000-000000000001', 'portal-t1@example.test'),
  ('a2000000-0452-4000-8000-000000000002', 'portal-t2@example.test'),
  ('a3000000-0452-4000-8000-000000000003', 'portal-borrado@example.test'),
  ('a4000000-0452-4000-8000-000000000004', 'portal-incoherente@example.test'),
  ('a5000000-0452-4000-8000-000000000005', 'portal-revocado@example.test'),
  ('e1000000-0452-4000-8000-000000000001', 'equipo-t1@example.test');

insert into public.user_tenants (user_id, tenant_id, role) values
  ('e1000000-0452-4000-8000-000000000001', '10000000-0452-4000-8000-000000000001', 'accounting');

-- DTD-9901 existe en los dos tenants.
insert into public.clients (id, tenant_id, markbox, name, email, deleted_at) values
  ('c1000000-0452-4000-8000-000000000001', '10000000-0452-4000-8000-000000000001',
   'DTD-9901', 'Cliente sintético T1', 'portal-t1@example.test', null),
  ('c2000000-0452-4000-8000-000000000002', '20000000-0452-4000-8000-000000000002',
   'DTD-9901', 'Cliente sintético T2', 'portal-t2@example.test', null),
  ('c3000000-0452-4000-8000-000000000003', '10000000-0452-4000-8000-000000000001',
   'DTD-9902', 'Cliente borrado T1', 'portal-borrado@example.test', now()),
  ('c4000000-0452-4000-8000-000000000004', '10000000-0452-4000-8000-000000000001',
   'DTD-9903', 'Cliente T1 del vínculo incoherente', 'portal-incoherente@example.test', null),
  ('c5000000-0452-4000-8000-000000000005', '10000000-0452-4000-8000-000000000001',
   'DTD-9904', 'Cliente T1 revocado', 'portal-revocado@example.test', null);

insert into public.client_users (tenant_id, client_id, email, auth_user_id, status) values
  ('10000000-0452-4000-8000-000000000001', 'c1000000-0452-4000-8000-000000000001',
   'portal-t1@example.test', 'a1000000-0452-4000-8000-000000000001', 'active'),
  ('20000000-0452-4000-8000-000000000002', 'c2000000-0452-4000-8000-000000000002',
   'portal-t2@example.test', 'a2000000-0452-4000-8000-000000000002', 'active'),
  ('10000000-0452-4000-8000-000000000001', 'c3000000-0452-4000-8000-000000000003',
   'portal-borrado@example.test', 'a3000000-0452-4000-8000-000000000003', 'active'),
  -- Incoherente: el vínculo dice T2 y su cliente es de T1.
  ('20000000-0452-4000-8000-000000000002', 'c4000000-0452-4000-8000-000000000004',
   'portal-incoherente@example.test', 'a4000000-0452-4000-8000-000000000004', 'active'),
  ('10000000-0452-4000-8000-000000000001', 'c5000000-0452-4000-8000-000000000005',
   'portal-revocado@example.test', 'a5000000-0452-4000-8000-000000000005', 'revoked');

insert into public.invoices
  (id, tenant_id, invoice_code, client_markbox, client_name, client_rif, total_amount, status, deleted_at)
values
  ('f1000000-0452-4000-8000-000000000001', '10000000-0452-4000-8000-000000000001',
   'F-T1-0001', 'DTD-9901', 'Cliente sintético T1', 'J-00000001-1', 100, 'emitida', null),
  ('f1000000-0452-4000-8000-000000000002', '10000000-0452-4000-8000-000000000001',
   'F-T1-0002', 'DTD-9901', 'Cliente sintético T1', 'J-00000001-1', 40, 'anulada', null),
  ('f1000000-0452-4000-8000-000000000003', '10000000-0452-4000-8000-000000000001',
   'F-T1-0003', 'DTD-9901', 'Cliente sintético T1', 'J-00000001-1', 30, 'borrador', null),
  ('f1000000-0452-4000-8000-000000000004', '10000000-0452-4000-8000-000000000001',
   'F-T1-0004', 'DTD-9901', 'Cliente sintético T1', 'J-00000001-1', 60, 'emitida', now()),
  ('f1000000-0452-4000-8000-000000000005', '10000000-0452-4000-8000-000000000001',
   'F-T1-0005', 'DTD-9902', 'Cliente borrado T1', 'J-00000003-3', 80, 'emitida', null),
  ('f1000000-0452-4000-8000-000000000006', '10000000-0452-4000-8000-000000000001',
   'F-T1-0006', 'DTD-9903', 'Cliente T1 del vínculo incoherente', 'J-00000004-4', 90, 'emitida', null),
  ('f1000000-0452-4000-8000-000000000007', '10000000-0452-4000-8000-000000000001',
   'F-T1-0007', 'DTD-9904', 'Cliente T1 revocado', 'J-00000005-5', 50, 'emitida', null),
  ('f2000000-0452-4000-8000-000000000001', '20000000-0452-4000-8000-000000000002',
   'F-T2-0001', 'DTD-9901', 'Cliente sintético T2', 'J-00000002-2', 777, 'emitida', null);

-- ── Ayudas ──────────────────────────────────────────────────────────────────

create function pg_temp.assert_true(p_ok boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_ok is not true then raise exception 'TEST 0452: %', p_label; end if;
end;
$$;

-- Códigos de las facturas que una identidad lee por RLS, en orden C.
create function pg_temp.lee(p_role text, p_sub text) returns text
language plpgsql as $$
declare
  v_codigos text;
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', coalesce(p_sub, ''), true);
  execute pg_catalog.format('set local role %I', p_role);
  execute 'select coalesce(string_agg(invoice_code, '','' order by invoice_code collate "C"), '''') '
       || 'from public.invoices'
    into v_codigos;
  execute 'reset role';
  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  return v_codigos;
end;
$$;

-- Filas que alcanza un UPDATE del Portal. Siempre se deshace.
create function pg_temp.actualiza_portal(p_sub text) returns bigint
language plpgsql as $$
declare
  v_filas bigint := -1;
begin
  begin
    perform pg_catalog.set_config('request.jwt.claim.sub', p_sub, true);
    execute 'set local role authenticated';
    execute 'update public.invoices set notes = ''escritura del Portal''';
    get diagnostics v_filas = row_count;
    raise exception using errcode = 'PT521', message = 'deshacer';
  exception when sqlstate 'PT521' then null;
  end;
  return v_filas;
end;
$$;

create function pg_temp.policies() returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', p.polname,
           'cmd', p.polcmd,
           'permissive', p.polpermissive,
           'roles', p.polroles::text,
           'qual', pg_get_expr(p.polqual, p.polrelid),
           'with_check', pg_get_expr(p.polwithcheck, p.polrelid)) order by p.polname), '[]'::jsonb)
    from pg_policy p
   where p.polrelid = 'public.invoices'::regclass
$$;

create function pg_temp.sin_portal(p_policies jsonb) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_agg(e order by e ->> 'name'), '[]'::jsonb)
    from jsonb_array_elements(p_policies) as e
   where e ->> 'name' <> 'invoices portal self read'
$$;

-- Expresión normalizada de una policy: search_path vacío y sin espacios.
create function pg_temp.forma(p_rel regclass, p_policy text) returns text
language sql stable set search_path = '' as $$
  select pg_catalog.regexp_replace(pg_catalog.pg_get_expr(p.polqual, p.polrelid), '\s', '', 'g')
    from pg_catalog.pg_policy as p
   where p.polrelid = p_rel and p.polname = p_policy
$$;

create function pg_temp.filas() returns jsonb
language sql stable as $$
  select jsonb_agg(to_jsonb(i) order by i.id) from public.invoices i
$$;

-- Arma un escenario, corre la migración (la del repo o una variante) y lo deshace
-- todo. Devuelve 'SQLSTATE|mensaje|detalle|pista', u 'ok|||' si la migración pasó.
create function pg_temp.corre(p_setup text, p_migracion text default null) returns text
language plpgsql as $$
declare
  v_state text := 'ok';
  v_message text := '';
  v_detail text := '';
  v_hint text := '';
begin
  begin
    if p_setup is not null then
      execute p_setup;
    end if;
    begin
      execute coalesce(p_migracion, pg_read_file('/sb/migrations/0452_portal_invoices_tenant_rls.sql'));
    exception when others then
      get stacked diagnostics
        v_state = returned_sqlstate,
        v_message = message_text,
        v_detail = pg_exception_detail,
        v_hint = pg_exception_hint;
    end;
    raise exception using errcode = 'PT520', message = 'deshacer el escenario sintético';
  exception when sqlstate 'PT520' then null;
  end;
  return concat_ws('|', v_state, v_message, coalesce(v_detail, ''), coalesce(v_hint, ''));
end;
$$;

create function pg_temp.espera_aborto(p_resultado text, p_patron text, p_caso text) returns void
language plpgsql as $$
begin
  perform pg_temp.assert_true(p_resultado like p_patron,
    format('%s: se esperaba [%s] y dio [%s]', p_caso, p_patron, p_resultado));
  perform pg_temp.assert_true(
    p_resultado !~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-' and p_resultado !~ 'DTD-[0-9]',
    format('%s: el mensaje filtra ids o Shipping Marks: %s', p_caso, p_resultado));
end;
$$;

-- ── 1. RED: sin 0452 la policy de 0085 cruza tenants ────────────────────────
select pg_temp.lee('authenticated', 'a1000000-0452-4000-8000-000000000001') as t1_antes,
       pg_temp.lee('authenticated', 'a2000000-0452-4000-8000-000000000002') as t2_antes,
       pg_temp.lee('authenticated', 'a3000000-0452-4000-8000-000000000003') as borrado_antes,
       pg_temp.lee('authenticated', 'a4000000-0452-4000-8000-000000000004') as incoherente_antes,
       pg_temp.lee('authenticated', 'a5000000-0452-4000-8000-000000000005') as revocado_antes,
       pg_temp.lee('authenticated', null) as sin_identidad_antes,
       pg_temp.lee('authenticated', 'e1000000-0452-4000-8000-000000000001') as equipo_antes,
       pg_temp.lee('service_role', null) as service_antes
\gset

select pg_temp.assert_true(:'t1_antes' = 'F-T1-0001,F-T1-0002,F-T2-0001',
  format('RED: sin 0452 el cliente de T1 debía leer por RLS la factura de T2 con su mismo Shipping Mark; leyó [%s]',
    :'t1_antes'));
select pg_temp.assert_true(:'t2_antes' = 'F-T1-0001,F-T1-0002,F-T2-0001',
  format('RED: sin 0452 el cliente de T2 debía leer las facturas de T1 con su mismo Shipping Mark; leyó [%s]',
    :'t2_antes'));
select pg_temp.assert_true(:'borrado_antes' = 'F-T1-0005',
  format('RED: sin 0452 el vínculo con cliente borrado debía leer las facturas de ese cliente; leyó [%s]',
    :'borrado_antes'));
select pg_temp.assert_true(:'incoherente_antes' = 'F-T1-0006',
  format('RED: sin 0452 el vínculo incoherente debía leer las facturas de su cliente; leyó [%s]',
    :'incoherente_antes'));
select pg_temp.assert_true(:'revocado_antes' = '' and :'sin_identidad_antes' = '',
  'Sin 0452 el vínculo revocado o la sesión sin identidad leyeron facturas');
select pg_temp.assert_true(
  :'equipo_antes' = 'F-T1-0001,F-T1-0002,F-T1-0003,F-T1-0004,F-T1-0005,F-T1-0006,F-T1-0007'
  and :'service_antes' = 'F-T1-0001,F-T1-0002,F-T1-0003,F-T1-0004,F-T1-0005,F-T1-0006,F-T1-0007,F-T2-0001',
  format('La lectura del equipo de T1 o de service_role no es la del fixture: [%s] [%s]',
    :'equipo_antes', :'service_antes'));

-- ── 2. Estático ─────────────────────────────────────────────────────────────
do $contrato_estatico$
declare
  v_codigo text := lower(regexp_replace(regexp_replace(
    pg_read_file('/sb/migrations/0452_portal_invoices_tenant_rls.sql'),
    '/\*.*?\*/', '', 'g'), '--[^\n]*', '', 'g'));
  v_fuera text;
  v_do int := strpos(v_codigo, 'do $migracion$');
  v_lock_timeout int := strpos(v_codigo, 'set local lock_timeout = ''5s'';');
  v_statement_timeout int := strpos(v_codigo, 'set local statement_timeout = ''60s'';');
  v_lock int := strpos(v_codigo, 'lock table public.invoices in access exclusive mode;');
  v_preflight int := strpos(v_codigo, '0452 abortada');
  v_ddl int := regexp_instr(v_codigo, '\m(drop|create|alter)\s+policy\M');
  v_postflight int := strpos(v_codigo, 'no quedó con la forma final');
begin
  -- Un único `do`: nada de SQL suelto antes o después del bloque.
  v_fuera := btrim(regexp_replace(
    regexp_replace(v_codigo, '\$migracion\$.*\$migracion\$', '', 'g'), '\s+', ' ', 'g'));
  perform pg_temp.assert_true(v_fuera = 'do ;',
    format('Fuera del bloque do quedó SQL: [%s]', v_fuera));

  perform pg_temp.assert_true(
    0 < v_do and v_do < v_lock_timeout and v_do < v_statement_timeout
    and v_lock_timeout < v_lock and v_statement_timeout < v_lock
    and v_lock < v_preflight and v_preflight < v_ddl and v_ddl < v_postflight,
    format('Orden roto: do %s, lock_timeout %s, statement_timeout %s, lock %s, preflight %s, '
           'primer DDL %s, postflight %s',
      v_do, v_lock_timeout, v_statement_timeout, v_lock, v_preflight, v_ddl, v_postflight));

  perform pg_temp.assert_true(
    (select count(*) from regexp_matches(v_codigo, '\mlock\s+table\M', 'g')) = 1
    and (select count(*) from regexp_matches(v_codigo, '\mdrop\s+policy\M', 'g')) = 1
    and (select count(*) from regexp_matches(v_codigo, '\mcreate\s+policy\M', 'g')) = 1
    and strpos(v_codigo, 'drop policy "invoices portal self read" on public.invoices;') > 0
    and strpos(v_codigo, 'create policy "invoices portal self read"') > 0,
    'La migración debe tomar un solo lock y reemplazar sólo "invoices portal self read"');

  -- El UPDATE se reconoce por su `set`.
  perform pg_temp.assert_true(
    v_codigo !~ '\m(insert\s+into|delete\s+from|merge\s+into|truncate|copy)\M'
    and v_codigo !~ '\mupdate\s+(only\s+)?[a-z0-9_."]+(\s+(as\s+)?[a-z0-9_]+)?\s+set\M',
    'La migración contiene DML');

  perform pg_temp.assert_true(
    v_codigo !~ '\m(grant|revoke|comment\s+on|alter\s+(table|policy|function)|create\s+(or\s+replace\s+)?function|security\s+definer)\M',
    'La migración contiene grants, comentarios, alter o funciones');
end;
$contrato_estatico$;

-- ── 3. Drift: el preflight falla cerrado y no cambia nada ────────────────────
create temporary table catalogo_legado as select pg_temp.policies() as p;

select pg_temp.espera_aborto(
  pg_temp.corre($q$drop policy "invoices portal self read" on public.invoices$q$),
  'P0001|0452 abortada: la policy "invoices portal self read" está ausente o no es permisiva%',
  'Policy Portal ausente');

select pg_temp.espera_aborto(
  pg_temp.corre($q$alter policy "invoices portal self read" on public.invoices to authenticated, anon$q$),
  'P0001|0452 abortada: la policy "invoices portal self read" está ausente o no es permisiva%',
  'Policy Portal también para anon');

select pg_temp.espera_aborto(
  pg_temp.corre($q$
    drop policy "invoices portal self read" on public.invoices;
    create policy "invoices portal self read" on public.invoices as restrictive for select to authenticated
      using (deleted_at is null and status <> 'borrador' and client_markbox is not null
             and client_markbox = public.get_portal_client_markbox())$q$),
  'P0001|0452 abortada: la policy "invoices portal self read" está ausente o no es permisiva%',
  'Policy Portal restrictiva');

select pg_temp.espera_aborto(
  pg_temp.corre($q$
    drop policy "invoices portal self read" on public.invoices;
    create policy "invoices portal self read" on public.invoices for all to authenticated
      using (deleted_at is null and status <> 'borrador' and client_markbox is not null
             and client_markbox = public.get_portal_client_markbox())$q$),
  'P0001|0452 abortada: la policy "invoices portal self read" está ausente o no es permisiva%',
  'Policy Portal FOR ALL');

-- Otra expresión: la de 0085 sin el filtro de borradores.
select pg_temp.espera_aborto(
  pg_temp.corre($q$
    alter policy "invoices portal self read" on public.invoices
      using (deleted_at is null and client_markbox is not null
             and client_markbox = public.get_portal_client_markbox())$q$),
  'P0001|0452 abortada: la expresión de "invoices portal self read" no es la de 0085 ni la final%',
  'Policy Portal sin el filtro de borradores');

-- Casi final: el predicado de 0414 sin `c.deleted_at is null`.
select pg_temp.espera_aborto(
  pg_temp.corre($q$
    alter policy "invoices portal self read" on public.invoices
      using (
        deleted_at is null
        and status <> 'borrador'
        and client_markbox is not null
        and exists (
          select 1
          from public.client_users as cu
          join public.clients as c
            on c.id = cu.client_id and c.tenant_id = cu.tenant_id
          where cu.auth_user_id = (select auth.uid())
            and cu.status = 'active'
            and cu.tenant_id = invoices.tenant_id
            and c.markbox = invoices.client_markbox
        )
      )$q$),
  'P0001|0452 abortada: la expresión de "invoices portal self read" no es la de 0085 ni la final%',
  'Policy Portal casi final, sin exigir el cliente vivo');

-- La misma lectura sin tenant, con otro nombre.
select pg_temp.espera_aborto(
  pg_temp.corre($q$
    create policy "invoices portal copia" on public.invoices for select to authenticated
      using (client_markbox = public.get_portal_client_markbox())$q$),
  'P0001|0452 abortada: 1 policy(s) más de invoices usan get_portal_client_markbox()%',
  'Otra policy con get_portal_client_markbox()');

select pg_temp.assert_true(pg_temp.policies() = (select p from catalogo_legado),
  'Los escenarios de drift dejaron cambios en el catálogo');

-- ── 4. Postflight: variantes del archivo que el preflight deja pasar ─────────
select pg_temp.espera_aborto(
  pg_temp.corre(null, regexp_replace(
    pg_read_file('/sb/migrations/0452_portal_invoices_tenant_rls.sql'),
    'and cu\.tenant_id = invoices\.tenant_id', 'and true')),
  'P0001|0452: "invoices portal self read" no quedó con la forma final%',
  'DDL sin el tenant de la factura');

select pg_temp.espera_aborto(
  pg_temp.corre(null, replace(
    pg_read_file('/sb/migrations/0452_portal_invoices_tenant_rls.sql'),
    '-- ─── Postflight',
    'alter policy "invoices by tenant" on public.invoices using (true);' || E'\n  -- ─── Postflight')),
  'P0001|0452: cambió otra policy de invoices%',
  'DDL que además toca la policy de equipo');

select pg_temp.assert_true(pg_temp.policies() = (select p from catalogo_legado),
  'Los escenarios de postflight dejaron cambios en el catálogo');

-- ── 5. Aplicar 0452 ─────────────────────────────────────────────────────────
create temporary table filas_antes as select pg_temp.filas() as filas;
select current_setting('search_path') as search_path_antes \gset

-- Se anulan los topes para demostrar que 0452 los fija por sí misma.
set local lock_timeout = 0;
set local statement_timeout = 0;

\ir ../migrations/0452_portal_invoices_tenant_rls.sql

select pg_temp.assert_true(
  (select setting from pg_settings where name = 'lock_timeout') = '5000'
  and (select setting from pg_settings where name = 'statement_timeout') = '60000',
  'La transacción de aplicación no quedó con lock_timeout 5 s y statement_timeout 60 s');
select pg_temp.assert_true(current_setting('search_path') = :'search_path_antes',
  format('0452 cambió el search_path de la sesión: [%s]', current_setting('search_path')));

-- ── 6. Comportamiento con 0452 ──────────────────────────────────────────────
select pg_temp.lee('authenticated', 'a1000000-0452-4000-8000-000000000001') as t1_despues,
       pg_temp.lee('authenticated', 'a2000000-0452-4000-8000-000000000002') as t2_despues,
       pg_temp.lee('authenticated', 'a3000000-0452-4000-8000-000000000003') as borrado_despues,
       pg_temp.lee('authenticated', 'a4000000-0452-4000-8000-000000000004') as incoherente_despues,
       pg_temp.lee('authenticated', 'a5000000-0452-4000-8000-000000000005') as revocado_despues,
       pg_temp.lee('authenticated', null) as sin_identidad_despues,
       pg_temp.lee('authenticated', 'e1000000-0452-4000-8000-000000000001') as equipo_despues,
       pg_temp.lee('service_role', null) as service_despues
\gset

select pg_temp.assert_true(:'t1_despues' = 'F-T1-0001,F-T1-0002',
  format('Con 0452 el cliente de T1 debía dejar de leer la factura de T2 y conservar las suyas; leyó [%s]',
    :'t1_despues'));
select pg_temp.assert_true(:'t2_despues' = 'F-T2-0001',
  format('Con 0452 el cliente de T2 debía leer sólo su factura; leyó [%s]', :'t2_despues'));

-- FRONTERA, la de 0414 aceptada por el Director en L07: sin error y con cero filas.
select pg_temp.assert_true(:'borrado_despues' = '',
  format('Con 0452 el vínculo con cliente borrado debía perder el acceso; leyó [%s]', :'borrado_despues'));
select pg_temp.assert_true(:'incoherente_despues' = '',
  format('Con 0452 el vínculo incoherente debía perder el acceso; leyó [%s]', :'incoherente_despues'));

select pg_temp.assert_true(:'revocado_despues' = '' and :'sin_identidad_despues' = '',
  'Con 0452 el vínculo revocado o la sesión sin identidad leyeron facturas');
select pg_temp.assert_true(:'equipo_despues' = :'equipo_antes' and :'service_despues' = :'service_antes',
  format('Con 0452 cambió la lectura del equipo de T1 o de service_role: [%s] [%s]',
    :'equipo_despues', :'service_despues'));
select pg_temp.assert_true(pg_temp.actualiza_portal('a1000000-0452-4000-8000-000000000001') = 0,
  'El Portal pudo actualizar facturas');

-- ── 7. Catálogo ─────────────────────────────────────────────────────────────
-- Referencia: el predicado de la 0414 de L07 (PR #106, rama
-- codex/c-l07-fidelizacion-conversations, líneas 66-79 de su archivo), copiado
-- tal cual sobre una tabla con la misma forma.
create schema ref0452;
create table ref0452.invoices (like public.invoices);
create policy "referencia 0414"
  on ref0452.invoices for select to authenticated
  using (
    deleted_at is null
    and status <> 'borrador'
    and client_markbox is not null
    and exists (
      select 1
      from public.client_users as cu
      join public.clients as c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id
          and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid())
        and cu.status = 'active'
        and cu.tenant_id = invoices.tenant_id
        and c.markbox = invoices.client_markbox
    )
  );

select pg_temp.assert_true(
  pg_temp.forma('public.invoices', 'invoices portal self read')
    = pg_temp.forma('ref0452.invoices', 'referencia 0414'),
  format('La policy Portal no es idéntica al predicado de 0414: [%s] contra [%s]',
    pg_temp.forma('public.invoices', 'invoices portal self read'),
    pg_temp.forma('ref0452.invoices', 'referencia 0414')));

select pg_temp.assert_true(
  (select count(*) from pg_policy p
    where p.polrelid = 'public.invoices'::regclass
      and p.polname = 'invoices portal self read'
      and p.polcmd = 'r'
      and p.polpermissive
      and p.polwithcheck is null
      and p.polroles = array['authenticated'::regrole::oid]) = 1,
  'La policy Portal no es permisiva, SELECT, sólo de authenticated y sin WITH CHECK');

select pg_temp.assert_true(
  not exists (
    select 1 from pg_policy p
     where p.polrelid = 'public.invoices'::regclass
       and (coalesce(pg_get_expr(p.polqual, p.polrelid), '') like '%get_portal_client_markbox%'
            or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') like '%get_portal_client_markbox%')),
  'Alguna policy de invoices sigue usando get_portal_client_markbox()');

select pg_temp.assert_true(
  pg_temp.sin_portal(pg_temp.policies()) = pg_temp.sin_portal((select p from catalogo_legado))
  and jsonb_array_length(pg_temp.policies()) = jsonb_array_length((select p from catalogo_legado)),
  '0452 cambió, agregó o quitó otra policy de invoices');

select pg_temp.assert_true((select filas from filas_antes) = pg_temp.filas(),
  'Aplicar 0452 modificó filas');

-- Sobre la policy final alterada, reaplicar también falla cerrado.
select pg_temp.espera_aborto(
  pg_temp.corre($q$alter policy "invoices portal self read" on public.invoices to authenticated, anon$q$),
  'P0001|0452 abortada: la policy "invoices portal self read" está ausente o no es permisiva%',
  'Policy final también para anon');

-- ── 8. Reaplicar no cambia nada ─────────────────────────────────────────────
create temporary table portal_primera as
select (select p.oid from pg_policy p
         where p.polrelid = 'public.invoices'::regclass
           and p.polname = 'invoices portal self read') as policy_oid,
       pg_temp.policies() as policies;

\ir ../migrations/0452_portal_invoices_tenant_rls.sql

select pg_temp.assert_true(
  (select policy_oid from portal_primera)
    = (select p.oid from pg_policy p
        where p.polrelid = 'public.invoices'::regclass
          and p.polname = 'invoices portal self read')
  and (select policies from portal_primera) = pg_temp.policies(),
  'Reaplicar 0452 recreó o cambió la policy');
select pg_temp.assert_true((select filas from filas_antes) = pg_temp.filas(),
  'Reaplicar 0452 modificó filas');

rollback;

select to_regclass('public.invoices') is null as portal_invoices_tenant_rls_0452_fixture_rolled_back;
