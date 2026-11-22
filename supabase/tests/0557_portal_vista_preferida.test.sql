\set ON_ERROR_STOP on
-- SDD-0654 fase 1 · contrato de la 0557 (vista preferida del Portal).
-- Migraciones reales (0080 y 0557); fixtures sintéticos. Nunca conecta a producción.
-- Cubre AC-2 (existentes en pro, nuevas en simple), AC-3 (cada RPC cambia solo
-- su columna y updated_at, solo en la fila activa de quien llama) y AC-4 (sin
-- privilegios ni policies de escritura sobre client_users).
begin;
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid primary key, tenant_id uuid not null, disabled_at timestamptz
);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create table public.clients (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  markbox text not null, email text, deleted_at timestamptz, unique (tenant_id, markbox)
);
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  code text not null, client_markbox text, deleted_at timestamptz
);
\ir ../migrations/0080_portal_cliente.sql

-- Lo que el ACL predeterminado anterior a 0263 pudo dejar en producción: la
-- 0557 tiene que REVOCARLO, no solo encontrar el catálogo limpio.
grant insert, update, delete on public.client_users to anon, authenticated;
grant update (email) on public.client_users to authenticated;

insert into public.tenants values
  ('10000000-6540-0000-0000-000000000001'), ('20000000-6540-0000-0000-000000000002');
insert into auth.users (id) values
  ('aaaaaaaa-6540-0000-0000-000000000001'), -- cliente A (tenant 1)
  ('bbbbbbbb-6540-0000-0000-000000000001'), -- cliente B (tenant 2)
  ('aaaaaaaa-6540-0000-0000-000000000002'), -- vínculo revocado
  ('aaaaaaaa-6540-0000-0000-000000000003'), -- cliente borrado con vínculo activo
  ('aaaaaaaa-6540-0000-0000-000000000004'), -- invitado sin vincular
  ('aaaaaaaa-6540-0000-0000-000000000009'); -- sin fila en client_users
insert into public.clients (id, tenant_id, markbox, deleted_at) values
  ('31000000-6540-0000-0000-000000000001', '10000000-6540-0000-0000-000000000001', 'DTD-1A', null),
  ('32000000-6540-0000-0000-000000000001', '20000000-6540-0000-0000-000000000002', 'DTD-1A', null),
  ('31000000-6540-0000-0000-000000000002', '10000000-6540-0000-0000-000000000001', 'DTD-2R', null),
  ('31000000-6540-0000-0000-000000000003', '10000000-6540-0000-0000-000000000001', 'DTD-3D', now()),
  ('31000000-6540-0000-0000-000000000004', '10000000-6540-0000-0000-000000000001', 'DTD-4I', null),
  ('31000000-6540-0000-0000-000000000005', '10000000-6540-0000-0000-000000000001', 'DTD-5N', null);
insert into public.client_users (auth_user_id, tenant_id, client_id, email, status, updated_at) values
  ('aaaaaaaa-6540-0000-0000-000000000001', '10000000-6540-0000-0000-000000000001', '31000000-6540-0000-0000-000000000001', 'a@example.invalid', 'active', '2026-01-01T00:00:00Z'),
  ('bbbbbbbb-6540-0000-0000-000000000001', '20000000-6540-0000-0000-000000000002', '32000000-6540-0000-0000-000000000001', 'b@example.invalid', 'active', '2026-01-01T00:00:00Z'),
  ('aaaaaaaa-6540-0000-0000-000000000002', '10000000-6540-0000-0000-000000000001', '31000000-6540-0000-0000-000000000002', 'r@example.invalid', 'revoked', '2026-01-01T00:00:00Z'),
  ('aaaaaaaa-6540-0000-0000-000000000003', '10000000-6540-0000-0000-000000000001', '31000000-6540-0000-0000-000000000003', 'd@example.invalid', 'active', '2026-01-01T00:00:00Z'),
  (null, '10000000-6540-0000-0000-000000000001', '31000000-6540-0000-0000-000000000004', 'i@example.invalid', 'invited', '2026-01-01T00:00:00Z');

\ir ../migrations/0557_portal_vista_preferida.sql

-- ── AC-2: existentes en pro, sin tocar updated_at; nuevas en simple ─────────
do $ac2$
begin
  if exists (select 1 from public.client_users where portal_vista <> 'pro' or portal_guia_vista_at is not null) then
    raise exception 'TEST 0557: una fila existente no quedó en pro con la guía vacía';
  end if;
  if exists (select 1 from public.client_users where updated_at <> '2026-01-01T00:00:00Z') then
    raise exception 'TEST 0557: la migración movió updated_at de filas existentes';
  end if;
  insert into public.client_users (tenant_id, client_id, email, status)
  values ('10000000-6540-0000-0000-000000000001', '31000000-6540-0000-0000-000000000005', 'n@example.invalid', 'invited');
  if (select portal_vista from public.client_users where client_id = '31000000-6540-0000-0000-000000000005') <> 'simple' then
    raise exception 'TEST 0557: una fila nueva no nació en simple';
  end if;
  begin
    update public.client_users set portal_vista = 'light' where client_id = '31000000-6540-0000-0000-000000000005';
    raise exception 'TEST 0557: el CHECK aceptó light';
  exception when check_violation then null;
  end;
end;
$ac2$;

-- ── AC-4: catálogo ──────────────────────────────────────────────────────────
do $ac4$
declare
  v_role text;
  v_priv text;
  v_fn text;
begin
  foreach v_role in array array['anon', 'authenticated'] loop
    foreach v_priv in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
      if has_table_privilege(v_role, 'public.client_users', v_priv) then
        raise exception 'TEST 0557: % conserva % sobre client_users', v_role, v_priv;
      end if;
    end loop;
    if has_any_column_privilege(v_role, 'public.client_users', 'UPDATE')
       or has_any_column_privilege(v_role, 'public.client_users', 'INSERT') then
      raise exception 'TEST 0557: % conserva escritura por columna sobre client_users', v_role;
    end if;
  end loop;
  if not has_table_privilege('authenticated', 'public.client_users', 'SELECT') then
    raise exception 'TEST 0557: authenticated perdió el SELECT de 0080';
  end if;
  if exists (select 1 from pg_policy where polrelid = 'public.client_users'::regclass and polcmd <> 'r') then
    raise exception 'TEST 0557: client_users tiene policies de escritura';
  end if;
  foreach v_fn in array array['public.portal_set_vista(text)', 'public.portal_marcar_guia_vista()'] loop
    if not exists (
      select 1 from pg_proc
      where oid = to_regprocedure(v_fn) and prosecdef and proconfig @> array['search_path=""']::text[]
    ) then
      raise exception 'TEST 0557: % sin SECURITY DEFINER o sin search_path vacío', v_fn;
    end if;
    if not has_function_privilege('authenticated', v_fn, 'EXECUTE')
       or has_function_privilege('anon', v_fn, 'EXECUTE')
       or has_function_privilege('service_role', v_fn, 'EXECUTE') then
      raise exception 'TEST 0557: EXECUTE de % no es solo de authenticated', v_fn;
    end if;
    if (select pronargs from pg_proc where oid = to_regprocedure(v_fn)) > 1 then
      raise exception 'TEST 0557: % recibe más de un argumento', v_fn;
    end if;
  end loop;
end;
$ac4$;

-- Foto de todas las filas antes de las RPC (ctid cambia con cada UPDATE).
create temp table foto as
select cu.ctid as fila, cu.* from public.client_users cu;
grant select on foto to authenticated, anon;

-- ── AC-3: portal_set_vista como A ───────────────────────────────────────────
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-6540-0000-0000-000000000001';
do $set_a$
begin
  if public.portal_set_vista('simple') <> 'simple' then
    raise exception 'TEST 0557: portal_set_vista no devolvió simple';
  end if;
  begin
    perform public.portal_set_vista('light');
    raise exception 'TEST 0557: portal_set_vista aceptó light';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.portal_set_vista(null);
    raise exception 'TEST 0557: portal_set_vista aceptó null';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.portal_set_vista('Simple');
    raise exception 'TEST 0557: portal_set_vista aceptó Simple';
  exception when invalid_parameter_value then null;
  end;
  -- Escribir directo sigue cerrado, aunque sea su propia fila.
  begin
    update public.client_users set portal_vista = 'pro', status = 'revoked'
    where auth_user_id = 'aaaaaaaa-6540-0000-0000-000000000001';
    raise exception 'TEST 0557: authenticated escribió client_users directo';
  exception when insufficient_privilege then null;
  end;
end;
$set_a$;
reset role;

do $after_set$
declare
  v_a record;
  v_antes record;
begin
  select * into v_a from public.client_users where auth_user_id = 'aaaaaaaa-6540-0000-0000-000000000001';
  select * into v_antes from foto where auth_user_id = 'aaaaaaaa-6540-0000-0000-000000000001';
  if v_a.portal_vista <> 'simple' then
    raise exception 'TEST 0557: A no quedó en simple';
  end if;
  if v_a.updated_at = v_antes.updated_at then
    raise exception 'TEST 0557: el trigger no movió updated_at de A';
  end if;
  if (v_a.id, v_a.tenant_id, v_a.client_id, v_a.email, v_a.auth_user_id, v_a.token, v_a.status,
      v_a.invited_by, v_a.invited_at, v_a.bound_at, v_a.revoked_at, v_a.last_login_at,
      v_a.created_at, v_a.portal_guia_vista_at)
     is distinct from
     (v_antes.id, v_antes.tenant_id, v_antes.client_id, v_antes.email, v_antes.auth_user_id, v_antes.token,
      v_antes.status, v_antes.invited_by, v_antes.invited_at, v_antes.bound_at, v_antes.revoked_at,
      v_antes.last_login_at, v_antes.created_at, v_antes.portal_guia_vista_at) then
    raise exception 'TEST 0557: portal_set_vista cambió otra columna de A';
  end if;
  if exists (
    select 1 from public.client_users cu join foto f on f.id = cu.id
    where cu.auth_user_id is distinct from 'aaaaaaaa-6540-0000-0000-000000000001'
      and cu.ctid <> f.fila
  ) then
    raise exception 'TEST 0557: portal_set_vista escribió otra fila';
  end if;
end;
$after_set$;

-- ── AC-3: portal_marcar_guia_vista como A, dos veces ────────────────────────
truncate foto;
insert into foto select cu.ctid, cu.* from public.client_users cu;
create temp table guia_a (primera timestamptz, segunda timestamptz);
grant all on guia_a to authenticated;
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-6540-0000-0000-000000000001';
insert into guia_a values (public.portal_marcar_guia_vista(), null);
reset role;

do $after_guia$
declare
  v_a record;
  v_antes record;
begin
  select * into v_a from public.client_users where auth_user_id = 'aaaaaaaa-6540-0000-0000-000000000001';
  select * into v_antes from foto where auth_user_id = 'aaaaaaaa-6540-0000-0000-000000000001';
  if v_a.portal_guia_vista_at is null or v_a.portal_guia_vista_at <> (select primera from guia_a) then
    raise exception 'TEST 0557: la guía no quedó marcada con la fecha devuelta';
  end if;
  if (v_a.id, v_a.tenant_id, v_a.client_id, v_a.email, v_a.auth_user_id, v_a.token, v_a.status,
      v_a.invited_by, v_a.invited_at, v_a.bound_at, v_a.revoked_at, v_a.last_login_at,
      v_a.created_at, v_a.portal_vista)
     is distinct from
     (v_antes.id, v_antes.tenant_id, v_antes.client_id, v_antes.email, v_antes.auth_user_id, v_antes.token,
      v_antes.status, v_antes.invited_by, v_antes.invited_at, v_antes.bound_at, v_antes.revoked_at,
      v_antes.last_login_at, v_antes.created_at, v_antes.portal_vista) then
    raise exception 'TEST 0557: portal_marcar_guia_vista cambió otra columna de A';
  end if;
  if exists (
    select 1 from public.client_users cu join foto f on f.id = cu.id
    where cu.auth_user_id is distinct from 'aaaaaaaa-6540-0000-0000-000000000001'
      and cu.ctid <> f.fila
  ) then
    raise exception 'TEST 0557: portal_marcar_guia_vista escribió otra fila';
  end if;
end;
$after_guia$;

-- La segunda vez no escribe: misma fecha y misma versión de la fila.
truncate foto;
insert into foto select cu.ctid, cu.* from public.client_users cu;
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-6540-0000-0000-000000000001';
update guia_a set segunda = public.portal_marcar_guia_vista();
reset role;
do $guia_once$
begin
  if (select segunda from guia_a) is distinct from (select primera from guia_a) then
    raise exception 'TEST 0557: la segunda marca devolvió otra fecha';
  end if;
  if exists (select 1 from public.client_users cu join foto f on f.id = cu.id where cu.ctid <> f.fila) then
    raise exception 'TEST 0557: la segunda marca volvió a escribir';
  end if;
end;
$guia_once$;

-- ── AC-3: quien no tiene fila activa no cambia nada ─────────────────────────
truncate foto;
insert into foto select cu.ctid, cu.* from public.client_users cu;

-- Revocado, cliente borrado y sin fila: 42501 en las dos RPC.
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-6540-0000-0000-000000000002';
do $revocado$
begin
  begin perform public.portal_set_vista('simple'); raise exception 'TEST 0557: revocado cambió la vista';
  exception when insufficient_privilege then null; end;
  begin perform public.portal_marcar_guia_vista(); raise exception 'TEST 0557: revocado marcó la guía';
  exception when insufficient_privilege then null; end;
end;
$revocado$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-6540-0000-0000-000000000003';
do $borrado$
begin
  begin perform public.portal_set_vista('simple'); raise exception 'TEST 0557: cliente borrado cambió la vista';
  exception when insufficient_privilege then null; end;
  begin perform public.portal_marcar_guia_vista(); raise exception 'TEST 0557: cliente borrado marcó la guía';
  exception when insufficient_privilege then null; end;
end;
$borrado$;
set local "request.jwt.claim.sub" = 'aaaaaaaa-6540-0000-0000-000000000009';
do $sin_fila$
begin
  begin perform public.portal_set_vista('simple'); raise exception 'TEST 0557: sin fila cambió la vista';
  exception when insufficient_privilege then null; end;
  begin perform public.portal_marcar_guia_vista(); raise exception 'TEST 0557: sin fila marcó la guía';
  exception when insufficient_privilege then null; end;
end;
$sin_fila$;
-- Sesión sin sub (auth.uid() nulo): tampoco hay fila.
set local "request.jwt.claim.sub" = '';
do $sin_sub$
begin
  begin perform public.portal_set_vista('simple'); raise exception 'TEST 0557: sin sub cambió la vista';
  exception when insufficient_privilege then null; end;
end;
$sin_sub$;
reset role;

-- anon no puede ni llamarlas.
set local role anon;
set local "request.jwt.claim.sub" = 'aaaaaaaa-6540-0000-0000-000000000001';
do $anon$
begin
  begin perform public.portal_set_vista('pro'); raise exception 'TEST 0557: anon llamó portal_set_vista';
  exception when insufficient_privilege then null; end;
  begin perform public.portal_marcar_guia_vista(); raise exception 'TEST 0557: anon llamó portal_marcar_guia_vista';
  exception when insufficient_privilege then null; end;
  begin
    update public.client_users set portal_vista = 'pro';
    raise exception 'TEST 0557: anon escribió client_users';
  exception when insufficient_privilege then null; end;
end;
$anon$;
reset role;

do $nada_cambio$
begin
  if exists (select 1 from public.client_users cu join foto f on f.id = cu.id where cu.ctid <> f.fila) then
    raise exception 'TEST 0557: una llamada sin fila activa escribió client_users';
  end if;
end;
$nada_cambio$;

-- ── AC-3: B solo cambia su fila ─────────────────────────────────────────────
set local role authenticated;
set local "request.jwt.claim.sub" = 'bbbbbbbb-6540-0000-0000-000000000001';
select public.portal_set_vista('simple') as b_simple \gset
reset role;
do $b$
begin
  if exists (
    select 1 from public.client_users cu join foto f on f.id = cu.id
    where cu.auth_user_id is distinct from 'bbbbbbbb-6540-0000-0000-000000000001' and cu.ctid <> f.fila
  ) then
    raise exception 'TEST 0557: la llamada de B escribió otra fila';
  end if;
  if (select portal_vista from public.client_users where auth_user_id = 'bbbbbbbb-6540-0000-0000-000000000001') <> 'simple' then
    raise exception 'TEST 0557: B no quedó en simple';
  end if;
end;
$b$;

rollback;
select to_regclass('public.client_users') is null as portal_vista_0557_fixture_rolled_back;
