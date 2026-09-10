\set ON_ERROR_STOP on

-- Contrato desechable de 0445 (SDD-0435). Fixtures ficticios + rollback.
-- Protege el límite en DB, la liberación del cupo, la primera foto gratuita,
-- el historial de reemplazo, el self-scope y la ACL cerrada del ledger.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid
language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to authenticated;

create schema storage;
create table storage.objects (bucket_id text not null, name text not null);

create table public.tenants (id uuid primary key);
create table public.clients (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  markbox text not null,
  cedula_photo_path text,
  deleted_at timestamptz
);
create table public.client_users (
  client_id uuid not null,
  auth_user_id uuid not null,
  status text not null
);
create function public.get_portal_client_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select link.client_id
  from public.client_users as link
  where link.auth_user_id = auth.uid() and link.status = 'active'
  limit 1
$$;
grant execute on function public.get_portal_client_id() to authenticated;

create table public.client_change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  client_id uuid not null references public.clients(id),
  proposed_name text,
  proposed_rif text,
  proposed_phone text,
  prev_name text,
  prev_rif text,
  prev_phone text,
  status text not null default 'pending',
  source text not null default 'client',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entity_audit_log (id uuid primary key default gen_random_uuid());
create table public.captured_audit_events (
  entity_id uuid,
  event_type text,
  payload jsonb
);
create function public.append_audit_event(
  p_tenant_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_event_type text,
  p_source text,
  p_result text,
  p_reason text,
  p_before_data jsonb,
  p_after_data jsonb,
  p_payload jsonb,
  p_correlation_id text,
  p_schema_version integer,
  p_sensitivity text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into public.captured_audit_events(entity_id, event_type, payload)
  values (p_entity_id, p_event_type, p_payload);
  return v_id;
end;
$$;

\ir ../migrations/0445_portal_profile_edit_limit.sql

insert into auth.users(id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2');
insert into public.tenants(id) values
  ('00000000-0000-0000-0000-00000000d7d1');
insert into public.clients(id, tenant_id, markbox) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9001'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9002');
insert into public.client_users(client_id, auth_user_id, status) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a1', 'active'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000a2', 'active');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

-- 1 · Empieza con tres cambios disponibles.
set local role authenticated;
do $$ declare q record; begin
  select * into q from public.get_my_portal_profile_edit_quota();
  assert q.limit_count = 3 and q.remaining_count = 3 and q.applied_count = 0,
    'CONTRATO 1 ROTO: un cliente nuevo no empieza con 3 cambios';
end $$;
reset role;

-- 2 · PENDING reserva; REJECTED libera.
insert into public.client_change_requests(
  id, tenant_id, client_id, proposed_name, status, submitted_by
) values (
  '00000000-0000-0000-0000-00000000e001',
  '00000000-0000-0000-0000-00000000d7d1',
  '00000000-0000-0000-0000-00000000c001',
  'Nombre corregido', 'pending', '00000000-0000-0000-0000-0000000000a1'
);
set local role authenticated;
do $$ declare q record; begin
  select * into q from public.get_my_portal_profile_edit_quota();
  assert q.reserved_count = 1 and q.remaining_count = 2,
    'CONTRATO 2 ROTO: PENDING no reservó exactamente un cupo';
end $$;
reset role;

update public.client_change_requests
set status = 'rejected', reviewed_at = now(), reviewed_by = '00000000-0000-0000-0000-0000000000a1'
where id = '00000000-0000-0000-0000-00000000e001';
set local role authenticated;
do $$ declare q record; begin
  select * into q from public.get_my_portal_profile_edit_quota();
  assert q.reserved_count = 0 and q.applied_count = 0 and q.remaining_count = 3,
    'CONTRATO 2 ROTO: REJECTED no liberó la reserva';
end $$;
reset role;

-- 3 · DELETE de una pendiente (cancelación actual del portal) también libera.
insert into public.client_change_requests(
  id, tenant_id, client_id, proposed_phone, status, submitted_by
) values (
  '00000000-0000-0000-0000-00000000e002',
  '00000000-0000-0000-0000-00000000d7d1',
  '00000000-0000-0000-0000-00000000c001',
  '04120000000', 'pending', '00000000-0000-0000-0000-0000000000a1'
);
delete from public.client_change_requests
where id = '00000000-0000-0000-0000-00000000e002';
set local role authenticated;
do $$ declare q record; begin
  select * into q from public.get_my_portal_profile_edit_quota();
  assert q.remaining_count = 3,
    'CONTRATO 3 ROTO: cancelar la PENDING consumió un cambio efectivo';
end $$;
reset role;

-- 4 · Tres aprobadas consumen todo y una cuarta solicitud falla en DB.
insert into public.client_change_requests(
  id, tenant_id, client_id, proposed_name, status, submitted_by
) values
  ('00000000-0000-0000-0000-00000000e011', '00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c001', 'Cambio 1', 'pending', '00000000-0000-0000-0000-0000000000a1');
update public.client_change_requests set status='approved', reviewed_at=now(), reviewed_by='00000000-0000-0000-0000-0000000000a1'
where id='00000000-0000-0000-0000-00000000e011';
insert into public.client_change_requests(
  id, tenant_id, client_id, proposed_name, status, submitted_by
) values
  ('00000000-0000-0000-0000-00000000e012', '00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c001', 'Cambio 2', 'pending', '00000000-0000-0000-0000-0000000000a1');
update public.client_change_requests set status='approved', reviewed_at=now(), reviewed_by='00000000-0000-0000-0000-0000000000a1'
where id='00000000-0000-0000-0000-00000000e012';
insert into public.client_change_requests(
  id, tenant_id, client_id, proposed_name, status, submitted_by
) values
  ('00000000-0000-0000-0000-00000000e013', '00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c001', 'Cambio 3', 'pending', '00000000-0000-0000-0000-0000000000a1');
update public.client_change_requests set status='approved', reviewed_at=now(), reviewed_by='00000000-0000-0000-0000-0000000000a1'
where id='00000000-0000-0000-0000-00000000e013';

set local role authenticated;
do $$ declare q record; begin
  select * into q from public.get_my_portal_profile_edit_quota();
  assert q.applied_count = 3 and q.remaining_count = 0,
    'CONTRATO 4 ROTO: tres aprobaciones no agotaron el cupo';
end $$;
reset role;

do $$ begin
  insert into public.client_change_requests(
    tenant_id, client_id, proposed_name, status, submitted_by
  ) values (
    '00000000-0000-0000-0000-00000000d7d1',
    '00000000-0000-0000-0000-00000000c001',
    'Cambio 4', 'pending', '00000000-0000-0000-0000-0000000000a1'
  );
  raise exception 'CONTRATO 4 ROTO: la cuarta solicitud entró';
exception
  when raise_exception then
    if sqlerrm <> 'profile_edit_limit_reached' then raise; end if;
end $$;

-- 5 · Primera foto gratuita; reemplazo posterior consume y conserva rutas.
insert into storage.objects(bucket_id, name) values
  ('client-docs', '00000000-0000-0000-0000-00000000d7d1/DTD-9002/primera.jpg'),
  ('client-docs', '00000000-0000-0000-0000-00000000d7d1/DTD-9002/reemplazo.jpg');
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
set local role authenticated;
do $$ declare r record; begin
  select * into r from public.portal_set_identity_photo(
    '00000000-0000-0000-0000-00000000d7d1/DTD-9002/primera.jpg'
  );
  assert r.counted = false and r.remaining_count = 3,
    'CONTRATO 5 ROTO: la primera foto consumió cupo';
  select * into r from public.portal_set_identity_photo(
    '00000000-0000-0000-0000-00000000d7d1/DTD-9002/reemplazo.jpg'
  );
  assert r.counted = true and r.remaining_count = 2,
    'CONTRATO 5 ROTO: el reemplazo no consumió exactamente un cupo';
end $$;
reset role;

do $$ begin
  assert exists (
    select 1 from public.client_profile_edits
    where client_id='00000000-0000-0000-0000-00000000c002'
      and previous_storage_path like '%/primera.jpg'
      and new_storage_path like '%/reemplazo.jpg'
      and status='applied'
  ), 'CONTRATO 5 ROTO: no quedó el historial privado de sustitución';
end $$;

-- 6 · Un usuario no puede apuntar su foto al prefijo de otro cliente.
set local role authenticated;
do $$ begin
  perform public.portal_set_identity_photo(
    '00000000-0000-0000-0000-00000000d7d1/DTD-9001/ajena.jpg'
  );
  raise exception 'CONTRATO 6 ROTO: la RPC aceptó una ruta ajena';
exception
  when invalid_parameter_value then null;
end $$;
reset role;

-- 7 · Ledger cerrado; sólo las dos RPC públicas son ejecutables por cliente.
do $$ begin
  assert not has_table_privilege('anon', 'public.client_profile_edits', 'SELECT'),
    'CONTRATO 7 ROTO: anon puede leer el ledger';
  assert not has_table_privilege('authenticated', 'public.client_profile_edits', 'SELECT'),
    'CONTRATO 7 ROTO: authenticated puede leer rutas históricas';
  assert not has_table_privilege('service_role', 'public.client_profile_edits', 'SELECT'),
    'CONTRATO 7 ROTO: service_role tiene acceso directo al ledger';
  assert has_function_privilege('authenticated', 'public.get_my_portal_profile_edit_quota()', 'EXECUTE'),
    'CONTRATO 7 ROTO: el portal no puede leer su agregado';
  assert has_function_privilege('authenticated', 'public.portal_set_identity_photo(text)', 'EXECUTE'),
    'CONTRATO 7 ROTO: el portal no puede registrar su foto';
  assert not has_function_privilege('anon', 'public.portal_set_identity_photo(text)', 'EXECUTE'),
    'CONTRATO 7 ROTO: anon puede mutar la foto';
end $$;

-- 8 · Los eventos no contienen los valores personales ni las rutas.
do $$ begin
  assert not exists (
    select 1 from public.captured_audit_events
    where payload::text like '%primera.jpg%'
       or payload::text like '%reemplazo.jpg%'
       or payload::text like '%Nombre corregido%'
  ), 'CONTRATO 8 ROTO: la auditoría copió PII o rutas de documento';
end $$;

rollback;
