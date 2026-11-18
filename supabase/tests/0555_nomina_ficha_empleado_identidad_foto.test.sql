\set ON_ERROR_STOP on

-- SDD-0652 fase 2 · contrato de la 0555 (enlace ficha ↔ usuario, foto, revelado
-- de la cuenta y línea de tiempo con eventos).
--
-- Monta el writer AUD-01 REAL (_audit-writer-real.sql: 0267 y 0294), una
-- fixture mínima de Nómina con la forma de 0160, 0181 y 0179, y aplica la 0555
-- REAL. Mide quién puede y quién no, qué queda escrito y qué no sale nunca.
--
-- CONTROL ROJO: sin la 0555 cae en la primera aserción (C0).
-- Lo que NO mide: dos enlaces en paralelo de verdad. PGlite y este archivo
-- tienen una sola conexión; se mide el segundo intento en serie, que recibe
-- «ya enlazada». El `for update` de la ficha no queda probado por carrera.
--
-- Termina siempre en ROLLBACK. Solo ids y valores sintéticos. No imprime
-- payloads ni la cuenta.
begin;
set local timezone = 'UTC';

\ir _audit-writer-real.sql

-- ── Fixture ─────────────────────────────────────────────────────────────────
create table auth.users (id uuid primary key);

create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);

-- Forma de 0080 (lo que la 0555 lee).
create table public.client_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  auth_user_id uuid references auth.users(id)
);

-- Forma de 0160 + 0181 (enlace y su índice único).
create table public.nomina_employees (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  employee_code text not null,
  full_name text not null,
  bank_account text,
  status text not null default 'activo' check (status in ('activo', 'inactivo', 'egresado')),
  auth_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, employee_code)
);
create unique index nomina_employees_auth_user_uniq
  on public.nomina_employees (auth_user_id)
  where auth_user_id is not null and deleted_at is null;

-- Forma de 0179 (lo que la línea de tiempo lee).
create table public.nomina_settlements (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  employee_id uuid not null references public.nomina_employees(id)
);

-- Forma de la plataforma (storage.buckets).
create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean not null default false,
  file_size_limit bigint, allowed_mime_types text[]
);

-- Un acceso extra a `nomina` (SDD-0635): existe, y no es un rol.
create table public.studio_user_module_grants (
  tenant_id uuid not null, user_id uuid not null, module_id text not null
);

insert into public.audit_entity_types (entity_type, status, domain_code, contract_version, introduced_by_ref)
values ('payroll_settlement', 'active', 'finance', 1, 'migration:0316'),
       ('otro_tipo', 'active', 'operations', 1, 'fixture');

\ir ../migrations/0555_nomina_ficha_empleado_identidad_foto.sql

insert into public.tenants values
  ('10000000-0000-4000-8000-000000000001'), ('10000000-0000-4000-8000-000000000002');
insert into auth.users
select ('20000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid from generate_series(1, 10) as n;
-- 01 admin T1 · 02 contabilidad T1 · 03 comercial T1 (candidato) · 04 admin T2
-- 05 admin T1 suspendido · 06 comercial T1 que además es cliente del portal
-- 07 almacén T1 con su propia ficha enlazada (lectura propia de 0181)
-- 08 soporte T1 con acceso extra a nomina · 09 comercial T1 (segundo candidato)
-- 10 admin de T1 y de T2 (dos membresías)
insert into public.user_tenants values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'admin', null),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'accounting', null),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'commercial', null),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'admin', null),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'admin', now()),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 'commercial', null),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', 'warehouse', null),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', 'support', null),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000001', 'commercial', null),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', 'admin', null),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000002', 'admin', null);
insert into public.client_users (tenant_id, auth_user_id) values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000006');
insert into public.studio_user_module_grants values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000008', 'nomina');

-- E1 con cuenta · E2 sin cuenta · E3 enlazada a 07 · E4 egresada · E5 borrada · E6 de T2
insert into public.nomina_employees (id, tenant_id, employee_code, full_name, bank_account, status, auth_user_id, deleted_at) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'EMP-0001', 'Ficha Uno', '00000000000000005501', 'activo', null, null),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'EMP-0002', 'Ficha Dos', null, 'activo', null, null),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'EMP-0003', 'Ficha Tres', '00000000000000005503', 'activo', '20000000-0000-4000-8000-000000000007', null),
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'EMP-0004', 'Ficha Cuatro', null, 'egresado', null, null),
  ('30000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'EMP-0005', 'Ficha Cinco', null, 'activo', null, now()),
  ('30000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', 'EMP-0001', 'Ficha Seis', '00000000000000005506', 'activo', null, null);
insert into public.nomina_settlements values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002');

-- ── Herramientas ────────────────────────────────────────────────────────────
create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0555: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Corre p_sql como la persona p_user (rol authenticated) y devuelve su primer valor.
create function pg_temp.corre(p_user uuid, p_sql text) returns text language plpgsql as $$
declare v_out text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  set local role authenticated;
  execute p_sql into v_out;
  reset role;
  return v_out;
end;
$$;

-- p_sql tiene que fallar con p_state y no devolver nada.
create function pg_temp.falla(p_user uuid, p_sql text, p_state text, p_label text) returns void language plpgsql as $$
declare v_state text := 'sin-error'; v_out text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  set local role authenticated;
  begin
    execute p_sql into v_out;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
  end;
  reset role;
  perform pg_temp.assert_true(v_state = p_state and v_out is null,
    p_label || ' (esperado ' || p_state || ', salió ' || v_state || ')');
end;
$$;

-- La línea de tiempo, como la persona p_user.
create function pg_temp.linea(p_user uuid, p_emp uuid, p_cursor text, p_limit integer)
returns table (id uuid, entity_type text, event_type text, occurred_at timestamptz, actor_id uuid, next_cursor text)
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  return query select * from public.nomina_employee_timeline_events(p_emp, p_cursor, p_limit);
  reset role;
end;
$$;

create function pg_temp.eventos(p_emp uuid, p_event text) returns bigint language sql as $$
  select count(*) from public.entity_audit_log where entity_id = p_emp and event_type = p_event
$$;

-- ── C. Lo que la migración deja ─────────────────────────────────────────────
select pg_temp.assert_true(
  to_regprocedure('public.nomina_link_employee_user(uuid,uuid,text)') is not null,
  'C0: existe nomina_link_employee_user');
select pg_temp.assert_true(
  (select count(*) from public.audit_entity_types where status = 'active' and (entity_type, domain_code) in (
     ('nomina_employee_access', 'access'), ('nomina_employee_photo', 'governance'),
     ('nomina_employee_sensitive_view', 'security'))) = 3,
  'C1: los tres tipos quedan en el catálogo con su dominio');
select pg_temp.assert_true(
  exists (select 1 from storage.buckets where id = 'employee-photos' and not public
            and file_size_limit = 2097152
            and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']),
  'C2: el bucket es privado, con 2 MB y solo imágenes');
select pg_temp.assert_true(
  exists (select 1 from information_schema.columns where table_schema = 'public'
            and table_name = 'nomina_employees' and column_name = 'photo_path' and is_nullable = 'YES'),
  'C3: nomina_employees tiene photo_path');
select pg_temp.assert_true(
  (select bool_and(has_function_privilege('authenticated', f, 'execute')
                   and not has_function_privilege('anon', f, 'execute')
                   and not has_function_privilege('service_role', f, 'execute'))
   from unnest(array[
     'public.nomina_link_employee_user(uuid,uuid,text)', 'public.nomina_unlink_employee_user(uuid,text)',
     'public.nomina_set_employee_photo(uuid,text)', 'public.nomina_reveal_bank_account(uuid,text)',
     'public.nomina_employee_timeline_events(uuid,text,integer)']) as f),
  'C4: las cinco RPC las ejecuta solo authenticated');
select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'public.nomina_ficha_actor_tenant(boolean)', 'execute')
  and not has_function_privilege('anon', 'public.nomina_ficha_actor_tenant(boolean)', 'execute'),
  'C5: nadie ejecuta nomina_ficha_actor_tenant directo');
select pg_temp.falla('20000000-0000-4000-8000-000000000001',
  $$select public.nomina_ficha_actor_tenant(true)::text$$, '42501',
  'C6: ni el admin llama directo a nomina_ficha_actor_tenant');

-- ── L. Enlace: quién no puede ───────────────────────────────────────────────
select pg_temp.falla(u, format(
  $$select public.nomina_link_employee_user('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'Es la misma persona')::text$$),
  '42501', 'L1: ' || quien || ' no enlaza')
from (values
  ('20000000-0000-4000-8000-000000000002'::uuid, 'Contabilidad'),
  ('20000000-0000-4000-8000-000000000003'::uuid, 'un comercial'),
  ('20000000-0000-4000-8000-000000000005'::uuid, 'un admin suspendido'),
  ('20000000-0000-4000-8000-000000000007'::uuid, 'quien solo tiene la lectura propia'),
  ('20000000-0000-4000-8000-000000000008'::uuid, 'quien tiene acceso extra a nomina'),
  ('20000000-0000-4000-8000-000000000010'::uuid, 'un admin con dos membresías'),
  (null::uuid, 'una llamada sin sesión')
) as t(u, quien);
select pg_temp.falla('20000000-0000-4000-8000-000000000004',
  $$select public.nomina_link_employee_user('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'Es la misma persona')::text$$,
  'P0002', 'L2: el admin de otro tenant no encuentra la ficha');

-- ── L. Enlace: lo que el admin tampoco puede ────────────────────────────────
select pg_temp.falla('20000000-0000-4000-8000-000000000001', format(
  $$select public.nomina_link_employee_user(%L, %L, %L)::text$$, emp, usr, motivo), estado, 'L3: ' || caso)
from (values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'abc', '22023', 'motivo de 3 caracteres'),
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '   ', '22023', 'motivo en blanco'),
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000005', 'Es la misma persona', '22023', 'usuario suspendido'),
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000006', 'Es la misma persona', '22023', 'cliente del portal'),
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', 'Es la misma persona', '22023', 'usuario de otro tenant'),
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000007', 'Es la misma persona', '23505', 'usuario ya enlazado a otra ficha'),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', 'Es la misma persona', '22023', 'ficha egresada'),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000003', 'Es la misma persona', 'P0002', 'ficha borrada'),
  ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000003', 'Es la misma persona', 'P0002', 'ficha de otro tenant')
) as t(emp, usr, motivo, estado, caso);
select pg_temp.assert_true(
  (select auth_user_id is null from public.nomina_employees where id = '30000000-0000-4000-8000-000000000001')
  and (select count(*) from public.entity_audit_log) = 0,
  'L4: ningún rechazo enlazó ni dejó evento');

-- ── L. Enlace: el camino feliz ──────────────────────────────────────────────
select pg_temp.corre('20000000-0000-4000-8000-000000000001',
  $$select public.nomina_link_employee_user('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '  Es la misma persona  ')::text$$);
select pg_temp.assert_true(
  (select auth_user_id = '20000000-0000-4000-8000-000000000003' from public.nomina_employees
   where id = '30000000-0000-4000-8000-000000000001'),
  'L5: el admin enlaza la ficha con el usuario');
select pg_temp.assert_true(
  (select count(*) from public.entity_audit_log
   where entity_type = 'nomina_employee_access' and event_type = 'user_linked'
     and entity_id = '30000000-0000-4000-8000-000000000001'
     and tenant_id = '10000000-0000-4000-8000-000000000001'
     and actor_type = 'user' and actor_id = '20000000-0000-4000-8000-000000000001'
     and reason = 'Es la misma persona' and source = 'rpc' and result = 'succeeded'
     and after_data ->> 'user_id' = '20000000-0000-4000-8000-000000000003') = 1,
  'L6: queda un user_linked con actor, motivo y el usuario enlazado');
-- El segundo intento, en serie: no sobrescribe.
select pg_temp.falla('20000000-0000-4000-8000-000000000001',
  $$select public.nomina_link_employee_user('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000009', 'Otro intento sobre la misma')::text$$,
  '23505', 'L7: una ficha ya enlazada no se sobrescribe');
select pg_temp.falla('20000000-0000-4000-8000-000000000001',
  $$select public.nomina_link_employee_user('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', 'El mismo usuario en otra ficha')::text$$,
  '23505', 'L8: un usuario no queda en dos fichas');
select pg_temp.assert_true(
  (select auth_user_id = '20000000-0000-4000-8000-000000000003' from public.nomina_employees
   where id = '30000000-0000-4000-8000-000000000001')
  and (select auth_user_id is null from public.nomina_employees where id = '30000000-0000-4000-8000-000000000002')
  and pg_temp.eventos('30000000-0000-4000-8000-000000000001', 'user_linked') = 1
  and pg_temp.eventos('30000000-0000-4000-8000-000000000002', 'user_linked') = 0,
  'L9: después de los dos rechazos el enlace y los eventos no cambiaron');

-- ── U. Quitar el enlace ─────────────────────────────────────────────────────
select pg_temp.falla('20000000-0000-4000-8000-000000000002',
  $$select public.nomina_unlink_employee_user('30000000-0000-4000-8000-000000000001', 'Ya no trabaja aquí')::text$$,
  '42501', 'U1: Contabilidad no quita el enlace');
select pg_temp.falla('20000000-0000-4000-8000-000000000003',
  $$select public.nomina_unlink_employee_user('30000000-0000-4000-8000-000000000001', 'Ya no trabaja aquí')::text$$,
  '42501', 'U2: la persona enlazada no quita su propio enlace');
select pg_temp.falla('20000000-0000-4000-8000-000000000001',
  $$select public.nomina_unlink_employee_user('30000000-0000-4000-8000-000000000001', null)::text$$,
  '22023', 'U3: quitar el enlace pide motivo');
select pg_temp.falla('20000000-0000-4000-8000-000000000001',
  $$select public.nomina_unlink_employee_user('30000000-0000-4000-8000-000000000002', 'No hay nada que quitar')::text$$,
  '22023', 'U4: una ficha sin enlace no se desenlaza');
select pg_temp.corre('20000000-0000-4000-8000-000000000001',
  $$select public.nomina_unlink_employee_user('30000000-0000-4000-8000-000000000001', 'Se enlazó a la persona equivocada')::text$$);
select pg_temp.assert_true(
  (select auth_user_id is null and deleted_at is null from public.nomina_employees
   where id = '30000000-0000-4000-8000-000000000001')
  and exists (select 1 from public.user_tenants where user_id = '20000000-0000-4000-8000-000000000003' and disabled_at is null)
  and (select count(*) from public.entity_audit_log
       where event_type = 'user_unlinked' and entity_id = '30000000-0000-4000-8000-000000000001'
         and reason = 'Se enlazó a la persona equivocada'
         and before_data ->> 'user_id' = '20000000-0000-4000-8000-000000000003'
         and actor_id = '20000000-0000-4000-8000-000000000001') = 1,
  'U5: quitar el enlace deja la ficha y el usuario, y un user_unlinked con su motivo');

-- ── F. Foto ─────────────────────────────────────────────────────────────────
select pg_temp.falla(u, format(
  $$select public.nomina_set_employee_photo(%L, %L)::text$$, emp, ruta), estado, 'F1: ' || caso)
from (values
  ('20000000-0000-4000-8000-000000000003'::uuid, '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000001.webp', '42501', 'un comercial no cambia la foto'),
  ('20000000-0000-4000-8000-000000000008'::uuid, '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000001.webp', '42501', 'el acceso extra no cambia la foto'),
  ('20000000-0000-4000-8000-000000000007'::uuid, '30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000003/aaaaaaaa-0000-4000-8000-000000000001.webp', '42501', 'la lectura propia no cambia su foto'),
  ('20000000-0000-4000-8000-000000000004'::uuid, '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000001.webp', 'P0002', 'el admin de otro tenant no encuentra la ficha'),
  ('20000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002/30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000001.webp', '22023', 'ruta con otro tenant'),
  ('20000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-000000000001.webp', '22023', 'ruta de otra ficha'),
  ('20000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000001.jpg', '22023', 'ruta que no es .webp'),
  ('20000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001/../x/aaaaaaaa-0000-4000-8000-000000000001.webp', '22023', 'ruta con salto de carpeta'),
  ('20000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000004/aaaaaaaa-0000-4000-8000-000000000001.webp', '22023', 'ficha egresada'),
  ('20000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000001', null, '22023', 'quitar una foto que no hay')
) as t(u, emp, ruta, estado, caso);
select pg_temp.assert_true(
  (select count(*) from public.nomina_employees where photo_path is not null) = 0
  and (select count(*) from public.entity_audit_log where entity_type = 'nomina_employee_photo') = 0,
  'F2: ningún rechazo cambió la foto ni dejó evento');

select pg_temp.corre('20000000-0000-4000-8000-000000000002',
  $$select public.nomina_set_employee_photo('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000001.webp')::text$$);
select pg_temp.assert_true(
  (select photo_path like '%aaaaaaaa-0000-4000-8000-000000000001.webp' from public.nomina_employees
   where id = '30000000-0000-4000-8000-000000000001')
  and (select count(*) from public.entity_audit_log
       where entity_type = 'nomina_employee_photo' and event_type = 'photo_set'
         and entity_id = '30000000-0000-4000-8000-000000000001'
         and actor_id = '20000000-0000-4000-8000-000000000002') = 1,
  'F3: Contabilidad pone la foto y queda photo_set');
select pg_temp.falla('20000000-0000-4000-8000-000000000001',
  $$select public.nomina_set_employee_photo('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000001.webp')::text$$,
  '22023', 'F4: la misma foto otra vez no deja un evento de más');
select pg_temp.corre('20000000-0000-4000-8000-000000000001',
  $$select public.nomina_set_employee_photo('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001/bbbbbbbb-0000-4000-8000-000000000002.webp')::text$$);
select pg_temp.corre('20000000-0000-4000-8000-000000000001',
  $$select public.nomina_set_employee_photo('30000000-0000-4000-8000-000000000001', null)::text$$);
select pg_temp.assert_true(
  (select photo_path is null from public.nomina_employees where id = '30000000-0000-4000-8000-000000000001')
  and pg_temp.eventos('30000000-0000-4000-8000-000000000001', 'photo_set') = 2
  and pg_temp.eventos('30000000-0000-4000-8000-000000000001', 'photo_removed') = 1,
  'F5: cambiar y quitar la foto dejan photo_set y photo_removed');
select pg_temp.assert_true(
  not exists (select 1 from public.entity_audit_log as l
              where l.entity_type = 'nomina_employee_photo' and l::text like '%.webp%'),
  'F6: los eventos de la foto no guardan la ruta');

-- ── R. Revelado de la cuenta ────────────────────────────────────────────────
select pg_temp.falla(u, format(
  $$select public.nomina_reveal_bank_account(%L, %L)$$, emp, motivo), estado, 'R1: ' || caso)
from (values
  ('20000000-0000-4000-8000-000000000003'::uuid, '30000000-0000-4000-8000-000000000001', 'Pago de la quincena', '42501', 'un comercial no ve la cuenta'),
  ('20000000-0000-4000-8000-000000000008'::uuid, '30000000-0000-4000-8000-000000000001', 'Pago de la quincena', '42501', 'el acceso extra no ve la cuenta'),
  ('20000000-0000-4000-8000-000000000007'::uuid, '30000000-0000-4000-8000-000000000003', 'Pago de la quincena', '42501', 'la lectura propia no revela por esta vía'),
  ('20000000-0000-4000-8000-000000000005'::uuid, '30000000-0000-4000-8000-000000000001', 'Pago de la quincena', '42501', 'un admin suspendido no ve la cuenta'),
  (null::uuid, '30000000-0000-4000-8000-000000000001', 'Pago de la quincena', '42501', 'sin sesión no se ve la cuenta'),
  ('20000000-0000-4000-8000-000000000004'::uuid, '30000000-0000-4000-8000-000000000001', 'Pago de la quincena', 'P0002', 'el admin de otro tenant no encuentra la ficha'),
  ('20000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000006', 'Pago de la quincena', 'P0002', 'la ficha de otro tenant no se revela'),
  ('20000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000001', null, '22023', 'sin motivo no se revela'),
  ('20000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000001', 'ok', '22023', 'con un motivo de 2 caracteres no se revela'),
  ('20000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000002', 'Pago de la quincena', '22023', 'una ficha sin cuenta no deja evento')
) as t(u, emp, motivo, estado, caso);
select pg_temp.assert_true(
  (select count(*) from public.entity_audit_log where event_type = 'bank_account_revealed') = 0,
  'R2: ningún rechazo dejó un bank_account_revealed');

select pg_temp.assert_true(
  pg_temp.corre('20000000-0000-4000-8000-000000000002',
    $$select public.nomina_reveal_bank_account('30000000-0000-4000-8000-000000000001', 'Pago de la quincena')$$)
  = '00000000000000005501',
  'R3: Contabilidad, con motivo, recibe la cuenta completa');
select pg_temp.assert_true(
  (select count(*) from public.entity_audit_log
   where entity_type = 'nomina_employee_sensitive_view' and event_type = 'bank_account_revealed'
     and entity_id = '30000000-0000-4000-8000-000000000001'
     and actor_id = '20000000-0000-4000-8000-000000000002'
     and reason = 'Pago de la quincena' and sensitivity = 'sensitive') = 1,
  'R4: queda un bank_account_revealed con actor, motivo y marca de sensible');
select pg_temp.assert_true(
  not exists (select 1 from public.entity_audit_log as l where l::text like '%00000000000000005501%'),
  'R5: ningún evento guarda el número de la cuenta');

-- Falla cerrado: si el evento no se puede escribir, la cuenta no sale.
update public.audit_entity_types set status = 'deprecated' where entity_type = 'nomina_employee_sensitive_view';
do $cerrado$
declare v_out text; v_fallo boolean := false;
begin
  perform set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
  set local role authenticated;
  begin
    v_out := public.nomina_reveal_bank_account('30000000-0000-4000-8000-000000000001', 'Pago de la quincena');
  exception when others then
    v_fallo := true;
  end;
  reset role;
  perform pg_temp.assert_true(v_fallo and v_out is null,
    'R6: si el evento no se puede escribir, el revelado falla y no devuelve la cuenta');
end;
$cerrado$;
update public.audit_entity_types set status = 'active' where entity_type = 'nomina_employee_sensitive_view';
select pg_temp.assert_true(
  pg_temp.eventos('30000000-0000-4000-8000-000000000001', 'bank_account_revealed') = 1,
  'R7: el revelado fallido no dejó evento');

-- ── T. Línea de tiempo ──────────────────────────────────────────────────────
-- Un finiquito anulado de E1, otro de E2 y un evento de OTRO tipo sobre E1.
select public.append_audit_event(
  '10000000-0000-4000-8000-000000000001', 'payroll_settlement', '40000000-0000-4000-8000-000000000001',
  'user', '20000000-0000-4000-8000-000000000001', 'payroll_settlement_voided', 'rpc', 'succeeded',
  'Se calculó con la fecha equivocada', null, null, '{}'::jsonb, null, 1, 'internal');
select public.append_audit_event(
  '10000000-0000-4000-8000-000000000001', 'payroll_settlement', '40000000-0000-4000-8000-000000000002',
  'user', '20000000-0000-4000-8000-000000000001', 'payroll_settlement_voided', 'rpc', 'succeeded',
  'Se calculó con la fecha equivocada', null, null, '{}'::jsonb, null, 1, 'internal');
select public.append_audit_event(
  '10000000-0000-4000-8000-000000000001', 'otro_tipo', '30000000-0000-4000-8000-000000000001',
  'user', '20000000-0000-4000-8000-000000000003', 'otra_cosa_hecha', 'studio', 'succeeded',
  null, null, null, '{}'::jsonb, null, 1, 'internal');

select pg_temp.falla(u, format(
  $$select id::text from public.nomina_employee_timeline_events(%L, %L, %s)$$, emp, cur, lim), estado, 'T1: ' || caso)
from (values
  ('20000000-0000-4000-8000-000000000003'::uuid, '30000000-0000-4000-8000-000000000001', null, '20', '42501', 'un comercial no lee la línea de tiempo'),
  ('20000000-0000-4000-8000-000000000008'::uuid, '30000000-0000-4000-8000-000000000001', null, '20', '42501', 'el acceso extra no lee la línea de tiempo'),
  ('20000000-0000-4000-8000-000000000007'::uuid, '30000000-0000-4000-8000-000000000003', null, '20', '42501', 'la lectura propia no lee su línea de tiempo'),
  ('20000000-0000-4000-8000-000000000004'::uuid, '30000000-0000-4000-8000-000000000001', null, '20', 'P0002', 'el admin de otro tenant no encuentra la ficha'),
  ('20000000-0000-4000-8000-000000000002'::uuid, '30000000-0000-4000-8000-000000000001', null, '0', '22023', 'limit 0'),
  ('20000000-0000-4000-8000-000000000002'::uuid, '30000000-0000-4000-8000-000000000001', null, '101', '22023', 'limit 101'),
  ('20000000-0000-4000-8000-000000000002'::uuid, '30000000-0000-4000-8000-000000000001', 'no-es-un-cursor', '20', '22023', 'cursor inválido')
) as t(u, emp, cur, lim, estado, caso);

create temporary table linea_e1 as
select * from pg_temp.linea('20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', null, 50);
select pg_temp.assert_true(
  (select count(*) from linea_e1) = 7
  and (select count(*) from linea_e1 where event_type = 'user_linked') = 1
  and (select count(*) from linea_e1 where event_type = 'user_unlinked') = 1
  and (select count(*) from linea_e1 where event_type = 'photo_set') = 2
  and (select count(*) from linea_e1 where event_type = 'photo_removed') = 1
  and (select count(*) from linea_e1 where event_type = 'bank_account_revealed') = 1
  and (select count(*) from linea_e1 where event_type = 'payroll_settlement_voided') = 1,
  'T2: Contabilidad ve los siete eventos de la ficha, incluido su finiquito anulado');
select pg_temp.assert_true(
  not exists (select 1 from linea_e1 where entity_type = 'otro_tipo')
  and not exists (select 1 from linea_e1 as l join public.entity_audit_log as e on e.id = l.id
                  where e.entity_id = '40000000-0000-4000-8000-000000000002')
  and (select bool_and(next_cursor is null) from linea_e1),
  'T3: no trae otros tipos ni el finiquito de otra ficha, y sin más páginas no hay cursor');
select pg_temp.assert_true(
  (select count(*) from pg_temp.linea('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', null, 50)) = 1,
  'T4: la otra ficha solo tiene su propio finiquito');

-- Paginación con cursor (occurred_at, id) sobre los eventos reales de la ficha Uno.
do $paginas$
declare
  v_cursor text; v_vistos uuid[] := '{}'; v_pagina integer := 0; v_fila record; v_n integer; v_cursores integer;
begin
  loop
    v_pagina := v_pagina + 1; v_n := 0; v_cursores := 0;
    for v_fila in select * from pg_temp.linea(
      '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', v_cursor, 3)
    loop
      v_n := v_n + 1;
      v_vistos := v_vistos || v_fila.id;
      if v_fila.next_cursor is not null then v_cursores := v_cursores + 1; v_cursor := v_fila.next_cursor; end if;
    end loop;
    exit when v_cursores = 0 or v_pagina > 5;
    perform pg_temp.assert_true(v_n = 3 and v_cursores = 1,
      'T5: una página llena trae 3 filas y un solo cursor (página ' || v_pagina || ')');
  end loop;
  perform pg_temp.assert_true(
    v_pagina = 3 and cardinality(v_vistos) = 7
    and (select count(distinct x) from unnest(v_vistos) as x) = 7,
    'T6: tres páginas de 3 recorren los 7 eventos sin repetir ni saltar');
end;
$paginas$;

-- Desempate por id: tres eventos de la ficha Dos en el MISMO instante (el writer
-- sella cada evento con su reloj, así que el empate se siembra directo). Con
-- páginas de 2, la primera corta dentro del empate: sin el id en el cursor, la
-- segunda página perdería los que quedan.
insert into public.entity_audit_log
  (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, payload, occurred_at, source, result, sensitivity)
select '10000000-0000-4000-8000-000000000001', 'nomina_employee_photo', '30000000-0000-4000-8000-000000000002',
       'user', '20000000-0000-4000-8000-000000000001', 'photo_set', '{}'::jsonb,
       '2026-01-01T00:00:00Z'::timestamptz, 'rpc', 'succeeded', 'internal'
from generate_series(1, 3);
do $empate$
declare
  v_cursor text; v_vistos uuid[] := '{}'; v_pagina integer := 0; v_fila record; v_cursores integer;
begin
  loop
    v_pagina := v_pagina + 1; v_cursores := 0;
    for v_fila in select * from pg_temp.linea(
      '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', v_cursor, 2)
    loop
      v_vistos := v_vistos || v_fila.id;
      if v_fila.next_cursor is not null then v_cursores := v_cursores + 1; v_cursor := v_fila.next_cursor; end if;
    end loop;
    exit when v_cursores = 0 or v_pagina > 5;
  end loop;
  perform pg_temp.assert_true(
    v_pagina = 2 and cardinality(v_vistos) = 4
    and (select count(distinct x) from unnest(v_vistos) as x) = 4,
    'T7: con cuatro eventos, tres en el mismo instante, dos páginas de 2 los traen todos');
end;
$empate$;

select 'TEST 0555 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;

rollback;
select to_regclass('public.nomina_employees') is null as nomina_0555_fixture_rolled_back;
