\set ON_ERROR_STOP on

-- SDD-0622 · contrato de la 0538 (accesos adicionales por persona).
--
-- Monta lo mínimo que la 0538 da por sentado, con la forma de las migraciones
-- reales: tenants, auth.users, user_tenants con warehouse_scope (0202),
-- get_user_tenant_id (0453), is_tenant_admin (0386), is_platform_admin
-- (platform_admins), audit_entity_types (0258) y entity_audit_log. Aplica la
-- 0357 REAL (desvíos por rol) y la 0538 REAL.
--
-- `append_audit_event` es un doble con la MISMA firma y las validaciones que
-- importan aquí (tipo de entidad activo y motivo de 4 a 1000 caracteres); el
-- writer real (0267/0294) tiene su propio contrato.
--
-- CONTROL ROJO: sin 0538 cae en la primera aserción (la RPC no existe).
-- Termina siempre en ROLLBACK. Solo ids y correos sintéticos.
begin;

do $roles$
begin
  if to_regclass('public.studio_user_module_grants') is not null then
    raise exception 'Fixture 0538 rechazada: el objeto real ya existe';
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

create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null references auth.users(id),
  tenant_id uuid not null references public.tenants(id),
  role text not null,
  disabled_at timestamptz,
  warehouse_scope text not null default 'all',
  primary key (user_id, tenant_id)
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

-- Forma de 0288.
create table public.platform_admins (user_id uuid primary key);
create function public.is_platform_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;
grant execute on function public.is_platform_admin() to authenticated;

-- Forma de 0258 + entity_audit_log con FK al catálogo.
create table public.audit_entity_types (
  entity_type text primary key,
  status text not null check (status in ('active', 'deprecated')),
  domain_code text,
  contract_version integer,
  introduced_by_ref text
);
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  entity_type text not null references public.audit_entity_types(entity_type),
  entity_id uuid not null,
  actor_type text not null,
  actor_id uuid,
  event_type text not null,
  reason text,
  before_data jsonb,
  after_data jsonb,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
grant select on public.entity_audit_log to authenticated;

-- Doble de append_audit_event (firma de 0294).
create function public.append_audit_event(
  p_tenant_id uuid, p_entity_type text, p_entity_id uuid, p_actor_type text, p_actor_id uuid,
  p_event_type text, p_source text, p_result text default 'succeeded', p_reason text default null,
  p_before_data jsonb default null, p_after_data jsonb default null, p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null, p_schema_version integer default 1, p_sensitivity text default 'internal'
) returns uuid language plpgsql security definer set search_path = '' as $fn$
declare v_id uuid;
begin
  if not exists (select 1 from public.audit_entity_types where entity_type = p_entity_type and status = 'active') then
    raise exception 'audit: entity_type inexistente o inactivo';
  end if;
  if p_reason is not null and pg_catalog.char_length(p_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres';
  end if;
  insert into public.entity_audit_log (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, reason, before_data, after_data, payload)
  values (p_tenant_id, p_entity_type, p_entity_id, p_actor_type, p_actor_id, p_event_type, p_reason, p_before_data, p_after_data, p_payload)
  returning id into v_id;
  return v_id;
end;
$fn$;
revoke all on function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text) from public, anon, authenticated;

-- ── Fixture ─────────────────────────────────────────────────────────────
-- T1 = 1…1, T2 = 1…2.
-- a1 admin T1 · a2 admin T1 superadmin · c1 contabilidad (Alejandro) · c2 contabilidad
-- k1 comercial · s1 support · w1 almacén con scope VE · x1 contabilidad desactivada · o1 admin T2
insert into public.tenants values ('11111111-1111-1111-1111-111111111111'), ('11111111-1111-1111-1111-111111111112');
insert into auth.users values
  ('a0000000-0000-0000-0000-0000000000a1'), ('a0000000-0000-0000-0000-0000000000a2'),
  ('a0000000-0000-0000-0000-0000000000c1'), ('a0000000-0000-0000-0000-0000000000c2'),
  ('a0000000-0000-0000-0000-0000000000b1'), ('a0000000-0000-0000-0000-0000000000d1'),
  ('a0000000-0000-0000-0000-0000000000e1'), ('a0000000-0000-0000-0000-0000000000f1'),
  ('a0000000-0000-0000-0000-0000000000f2');
insert into public.user_tenants (user_id, tenant_id, role, disabled_at, warehouse_scope) values
  ('a0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'admin', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'admin', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'accounting', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000c2', '11111111-1111-1111-1111-111111111111', 'accounting', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'commercial', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000d1', '11111111-1111-1111-1111-111111111111', 'support', null, 'all'),
  ('a0000000-0000-0000-0000-0000000000e1', '11111111-1111-1111-1111-111111111111', 'warehouse', null, 've'),
  ('a0000000-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'accounting', now(), 'all'),
  ('a0000000-0000-0000-0000-0000000000f2', '11111111-1111-1111-1111-111111111112', 'admin', null, 'all');
insert into public.platform_admins values ('a0000000-0000-0000-0000-0000000000a2');

\ir ../migrations/0357_role_module_overrides.sql
\ir ../migrations/0538_studio_user_module_grants.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0538: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Corre un SQL como un usuario (authenticated con su sub) o, con null, como service_role.
create function pg_temp.como(p_user uuid, p_sql text) returns void language plpgsql as $$
begin
  if p_user is null then
    set local role service_role;
  else
    perform set_config('request.jwt.claim.sub', p_user::text, true);
    set local role authenticated;
  end if;
  execute p_sql;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

create function pg_temp.valor(p_user uuid, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  if p_user is null then
    set local role service_role;
  else
    perform set_config('request.jwt.claim.sub', p_user::text, true);
    set local role authenticated;
  end if;
  execute 'select (' || p_sql || ')::text' into v;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v;
end;
$$;

create function pg_temp.falla(p_user uuid, p_sql text, p_patron text, p_label text) returns void language plpgsql as $$
declare v_msg text;
begin
  begin
    perform pg_temp.como(p_user, p_sql);
    v_msg := null;
  exception when others then
    v_msg := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.assert_true(v_msg is not null and v_msg ~ p_patron,
    p_label || ' (error: ' || coalesce(v_msg, 'ninguno') || ')');
end;
$$;

-- ¿Tiene el módulo? como el usuario.
create function pg_temp.tiene(p_user text, p_module text, p_edit boolean) returns boolean language sql as $$
  select pg_temp.valor(('a0000000-0000-0000-0000-0000000000' || p_user)::uuid,
    format('public.user_has_module(%L, %L)', p_module, p_edit))::boolean;
$$;

create function pg_temp.u(p_user text) returns uuid language sql immutable as $$
  select ('a0000000-0000-0000-0000-0000000000' || p_user)::uuid;
$$;

-- ── 1. Solo un admin de la base concede ──────────────────────────────────
select pg_temp.falla(pg_temp.u('c2'),
  format($q$select public.studio_grant_user_module(%L, 'kommo', true, true, 'Atiende el CRM')$q$, pg_temp.u('c1')),
  'Solo un administrador', '1: contabilidad no concede (42501)');
select pg_temp.falla(pg_temp.u('d1'),
  format($q$select public.studio_grant_user_module(%L, 'kommo', true, false, 'Atiende el CRM')$q$, pg_temp.u('c1')),
  'Solo un administrador', '1b: support no concede');

-- ── 2. Caso Alejandro: contabilidad + CRM editar ─────────────────────────
select pg_temp.assert_true(not pg_temp.tiene('c1', 'kommo', false), '2a: sin extra, contabilidad no ve el CRM');
select pg_temp.como(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'kommo', true, true, 'Atiende el CRM con comercial')$q$, pg_temp.u('c1')));
select pg_temp.assert_true(pg_temp.tiene('c1', 'kommo', false), '2b: con extra ve el CRM');
select pg_temp.assert_true(pg_temp.tiene('c1', 'kommo', true), '2c: con extra edita el CRM');
select pg_temp.assert_true(not pg_temp.tiene('c2', 'kommo', false), '2d: otra persona de contabilidad sigue sin CRM');
select pg_temp.assert_true(not pg_temp.tiene('c1', 'users', false), '2e: el extra no abre Usuarios');
select pg_temp.assert_true(not pg_temp.tiene('c1', 'legal', false), '2f: el extra no abre Legal');
select pg_temp.assert_true(pg_temp.tiene('c1', 'treasury', true), '2g: solo suma: su rol sigue editando Tesorería');
select pg_temp.assert_true((
  select count(*) = 1 from public.entity_audit_log
  where entity_type = 'studio_user_module_grant' and entity_id = pg_temp.u('c1')
    and event_type = 'user_module_grant_created' and actor_id = pg_temp.u('a1')
    and reason = 'Atiende el CRM con comercial'
    and after_data->>'module_id' = 'kommo' and (after_data->>'can_edit')::boolean
), '2h: la concesión deja evento con actor, destino, módulo, permisos y motivo');

-- Cambiar a solo ver: queda el evento de cambio con el antes.
select pg_temp.como(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'kommo', true, false, 'Solo consulta el CRM')$q$, pg_temp.u('c1')));
select pg_temp.assert_true(not pg_temp.tiene('c1', 'kommo', true), '2i: pasado a solo ver, ya no edita');
select pg_temp.assert_true(pg_temp.tiene('c1', 'kommo', false), '2j: sigue viendo');
select pg_temp.assert_true((
  select count(*) = 1 from public.entity_audit_log
  where event_type = 'user_module_grant_updated' and (before_data->>'can_edit')::boolean
    and not (after_data->>'can_edit')::boolean
), '2k: el cambio guarda el antes y el después');

-- ── 3. Validaciones de la RPC ─────────────────────────────────────────────
select pg_temp.falla(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'kommo', true, true, 'abc')$q$, pg_temp.u('c2')),
  'motivo es obligatorio', '3a: motivo corto rechazado');
select pg_temp.falla(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'no-existe', true, false, 'Motivo válido')$q$, pg_temp.u('c2')),
  'Módulo desconocido', '3b: módulo desconocido rechazado');
select pg_temp.falla(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'kommo', true, false, 'Motivo válido', now() - interval '1 day')$q$, pg_temp.u('c2')),
  'vencimiento', '3c: vencimiento en el pasado rechazado');
select pg_temp.falla(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'kommo', false, false, 'Motivo válido')$q$, pg_temp.u('c2')),
  'siempre deja ver', '3d: un extra sin ver no existe');
select pg_temp.falla(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'kommo', true, false, 'Motivo válido')$q$, pg_temp.u('a1')),
  'a ti mismo', '3e: nadie se concede a sí mismo');
select pg_temp.falla(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'kommo', true, false, 'Motivo válido')$q$, pg_temp.u('a2')),
  'ya tiene todos', '3f: no se concede a un admin');
select pg_temp.falla(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'kommo', true, false, 'Motivo válido')$q$, pg_temp.u('f2')),
  'miembro activo', '3g: no se concede a alguien de otro tenant');
select pg_temp.falla(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'kommo', true, false, 'Motivo válido')$q$, pg_temp.u('f1')),
  'miembro activo', '3h: no se concede a alguien desactivado');

-- ── 4. Sensibles: doble aviso exigido por la RPC y por la tabla ──────────
select pg_temp.falla(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'treasury', true, false, 'Revisa la caja')$q$, pg_temp.u('b1')),
  'doble aviso', '4a: tesorería sin confirmación rechazada');
select pg_temp.falla(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'treasury', true, false, 'Revisa la caja', null, true)$q$, pg_temp.u('b1')),
  'versión de la lista de efectos', '4b: sin versión de efectos rechazada');
select pg_temp.como(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'treasury', true, false, 'Revisa la caja', null, true, '2026-11-11.1')$q$, pg_temp.u('b1')));
select pg_temp.assert_true(pg_temp.tiene('b1', 'treasury', false), '4c: con confirmación, comercial ve Tesorería');
select pg_temp.assert_true(not pg_temp.tiene('b1', 'treasury', true), '4d: solo ver no edita');
select pg_temp.assert_true((
  select count(*) = 1 from public.entity_audit_log
  where entity_id = pg_temp.u('b1') and event_type = 'user_module_grant_created'
    and (payload->>'sensitive_confirmed')::boolean and payload->>'effects_version' = '2026-11-11.1'
), '4e: la auditoría guarda la confirmación y la versión de efectos');
select pg_temp.falla(null,
  format($q$insert into public.studio_user_module_grants (tenant_id, user_id, module_id, can_view, can_edit, reason)
            values ('11111111-1111-1111-1111-111111111111', %L, 'nomina', true, false, 'Directo sin aviso')$q$, pg_temp.u('b1')),
  'studio_user_module_grants_sensitive_confirmed', '4f: la tabla rechaza un sensible sin confirmación aunque sea service_role');
select pg_temp.falla(null,
  $q$insert into public.studio_role_module_overrides (tenant_id, role, module_id, can_view, can_edit)
     values ('11111111-1111-1111-1111-111111111111', 'commercial', 'treasury', true, false)$q$,
  'studio_role_module_overrides_locked_check', '4g: el CHECK de la 0357 sigue cerrando desvíos por rol sobre dinero');

-- ── 5. R1: usuarios/admin solo ver; R2: superadmin ───────────────────────
select pg_temp.falla(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'users', true, true, 'Ayuda con altas', null, true, '2026-11-11.1')$q$, pg_temp.u('b1')),
  'solo para ver', '5a: Usuarios no se concede con edición');
select pg_temp.como(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'users', true, false, 'Ayuda con altas', null, true, '2026-11-11.1')$q$, pg_temp.u('b1')));
select pg_temp.assert_true(pg_temp.tiene('b1', 'users', false) and not pg_temp.tiene('b1', 'users', true),
  '5b: un extra sobre Usuarios es solo lectura efectiva');
select pg_temp.falla(pg_temp.u('b1'),
  format($q$select public.studio_grant_user_module(%L, 'kommo', true, false, 'Escalada')$q$, pg_temp.u('c2')),
  'Solo un administrador', '5c: con Usuarios por extra no se pueden conceder accesos');
select pg_temp.falla(null,
  format($q$update public.studio_user_module_grants set can_edit = true
            where user_id = %L and module_id = 'users'$q$, pg_temp.u('b1')),
  'studio_user_module_grants_keystone_read_only', '5d: la tabla rechaza edición sobre Usuarios');
select pg_temp.falla(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'legal', true, false, 'Revisa contratos', null, true, '2026-11-11.1')$q$, pg_temp.u('b1')),
  'superadministrador', '5e: un admin que no es superadmin no concede Legal');
select pg_temp.como(pg_temp.u('a2'),
  format($q$select public.studio_grant_user_module(%L, 'legal', true, false, 'Revisa contratos', null, true, '2026-11-11.1')$q$, pg_temp.u('b1')));
select pg_temp.assert_true((select count(*) = 1 from public.studio_user_module_grants where module_id = 'legal'),
  '5f: el superadmin sí concede Legal');

-- ── 6. support, vencimiento, desactivado, scope ──────────────────────────
select pg_temp.como(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'kommo', true, true, 'Mira el CRM')$q$, pg_temp.u('d1')));
select pg_temp.assert_true(pg_temp.tiene('d1', 'kommo', false), '6a: support ve con el extra');
select pg_temp.assert_true(not pg_temp.tiene('d1', 'kommo', true), '6b: support nunca edita, ni con extra');

select pg_temp.como(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'rates', true, false, 'Cotiza tarifas', now() + interval '2 days')$q$, pg_temp.u('e1')));
select pg_temp.assert_true(pg_temp.tiene('e1', 'rates', false), '6c: antes de vencer funciona');
select pg_temp.como(null, format($q$update public.studio_user_module_grants set expires_at = now() - interval '1 minute'
  where user_id = %L and module_id = 'rates'$q$, pg_temp.u('e1')));
select pg_temp.assert_true(not pg_temp.tiene('e1', 'rates', false), '6d: vencido, el acceso desaparece solo');

select pg_temp.como(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'cn', true, false, 'Ayuda en China')$q$, pg_temp.u('e1')));
select pg_temp.assert_true(not pg_temp.tiene('e1', 'cn', false), '6e: un extra no salta el scope de almacén');

update public.user_tenants set disabled_at = now() where user_id = pg_temp.u('c1');
select pg_temp.assert_true(not pg_temp.tiene('c1', 'kommo', false), '6f: desactivado, ni rol ni extra');
update public.user_tenants set disabled_at = null where user_id = pg_temp.u('c1');

-- ── 7. Desvío por rol y extras conviven (orden de §5.2) ──────────────────
insert into public.studio_role_module_overrides (tenant_id, role, module_id, can_view, can_edit)
values ('11111111-1111-1111-1111-111111111111', 'accounting', 'clients', false, false);
select pg_temp.assert_true(not pg_temp.tiene('c2', 'clients', false), '7a: el desvío por rol quita Clientes a contabilidad');
select pg_temp.como(pg_temp.u('a1'),
  format($q$select public.studio_grant_user_module(%L, 'clients', true, true, 'Lleva cartera')$q$, pg_temp.u('c2')));
select pg_temp.assert_true(pg_temp.tiene('c2', 'clients', true), '7b: el extra de la persona suma encima del desvío');

-- ── 8. Sin escritura directa; lectura propia o de admin ──────────────────
select pg_temp.falla(pg_temp.u('a1'),
  format($q$insert into public.studio_user_module_grants (tenant_id, user_id, module_id, can_view, can_edit, reason)
            values ('11111111-1111-1111-1111-111111111111', %L, 'quotes', true, false, 'Directo del admin')$q$, pg_temp.u('c2')),
  'permission denied', '8a: authenticated no inserta directo, ni siendo admin');
select pg_temp.falla(pg_temp.u('c1'),
  format($q$delete from public.studio_user_module_grants where user_id = %L$q$, pg_temp.u('c1')),
  'permission denied', '8b: la persona no borra sus extras');
select pg_temp.assert_true(pg_temp.valor(pg_temp.u('c1'), 'select count(*) from public.studio_user_module_grants')::int = 1,
  '8c: la persona ve solo sus extras');
select pg_temp.assert_true(pg_temp.valor(pg_temp.u('c2'),
  format('select count(*) from public.studio_user_module_grants where user_id <> %L', pg_temp.u('c2')))::int = 0,
  '8d: otra persona no ve los extras ajenos');
select pg_temp.assert_true(pg_temp.valor(pg_temp.u('a1'), 'select count(*) from public.studio_user_module_grants')::int
  = (select count(*) from public.studio_user_module_grants)::int, '8e: el admin ve todos los de su tenant');
select pg_temp.assert_true(pg_temp.valor(pg_temp.u('f2'), 'select count(*) from public.studio_user_module_grants')::int = 0,
  '8f: el admin de otro tenant no ve nada');

-- ── 9. Quitar ─────────────────────────────────────────────────────────────
select pg_temp.falla(pg_temp.u('c2'),
  format($q$select public.studio_revoke_user_module_grant(%L, 'kommo', 'Ya no atiende')$q$, pg_temp.u('c1')),
  'Solo un administrador', '9a: un no-admin no quita');
select pg_temp.falla(pg_temp.u('a1'),
  format($q$select public.studio_revoke_user_module_grant(%L, 'kommo', '')$q$, pg_temp.u('c1')),
  'motivo es obligatorio', '9b: quitar pide motivo');
select pg_temp.assert_true(pg_temp.valor(pg_temp.u('a1'),
  format($q$public.studio_revoke_user_module_grant(%L, 'kommo', 'Ya no atiende el CRM')$q$, pg_temp.u('c1')))::boolean,
  '9c: el admin quita el extra');
select pg_temp.assert_true(not pg_temp.tiene('c1', 'kommo', false), '9d: quitado, no ve el CRM');
select pg_temp.assert_true((
  select count(*) = 1 from public.entity_audit_log
  where entity_id = pg_temp.u('c1') and event_type = 'user_module_grant_revoked'
    and reason = 'Ya no atiende el CRM' and before_data->>'module_id' = 'kommo'
), '9e: quitar deja evento con el antes y el motivo');
select pg_temp.assert_true(not pg_temp.valor(pg_temp.u('a1'),
  format($q$public.studio_revoke_user_module_grant(%L, 'kommo', 'Otra vez el mismo')$q$, pg_temp.u('c1')))::boolean,
  '9f: quitar lo que no hay devuelve false');

-- ── 10. Grants a API ─────────────────────────────────────────────────────
select pg_temp.assert_true(not has_function_privilege('anon', 'public.user_has_module(text, boolean)', 'execute'),
  '10a: anon no ejecuta user_has_module');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.studio_user_module_grants', 'update'),
  '10b: authenticated no actualiza la tabla');

select 'TEST 0538: ' || nextval('pg_temp.assertion_count') - 1 || ' aserciones OK' as resultado;

rollback;
