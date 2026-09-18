\set ON_ERROR_STOP on

-- Contrato desechable de 0462 (SDD-0482). Fixtures ficticios + rollback.
-- Aplica la cadena real 0445 → 0462 y demuestra:
--   · edición directa con cupo compartido, sin tocar la verificación;
--   · «no_changes» sin gastar cupo;
--   · bloqueo por documento y por teléfono, sin cupo y con intento registrado;
--   · límite anti-enumeración (5 bloqueos en 24 h corta también lo libre);
--   · la solicitud pendiente propia se reemplaza y libera su reserva;
--   · carrera con el índice único → bloqueo sin efectos;
--   · formatos, sesión y aislamiento.

begin;

do $roles$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end;
$roles$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
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
  name text,
  rif text,
  phone text,
  doc_kind text,
  doc_verify_status text,
  doc_verified_at timestamptz,
  deleted_at timestamptz,
  phone_last10 text generated always as (
    case
      when pg_catalog.length(pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g')) >= 10
      then pg_catalog."right"(pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)
    end
  ) stored
);
-- Mismo índice que 0095.
create unique index clients_tenant_doc_unique
  on public.clients (tenant_id, upper(regexp_replace(rif, '[^A-Za-z0-9]', '', 'g')))
  where rif is not null and btrim(rif) <> '' and deleted_at is null;

create table public.client_users (
  client_id uuid not null,
  auth_user_id uuid not null,
  status text not null
);

create function public.get_portal_client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select link.client_id
  from public.client_users as link
  where link.auth_user_id = auth.uid()
    and link.status = 'active'
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
create unique index client_change_requests_one_open
  on public.client_change_requests (client_id)
  where status = 'pending';

create table public.entity_audit_log (id uuid primary key default gen_random_uuid());
create table public.captured_audit_events (
  entity_id uuid,
  event_type text,
  result text,
  reason text,
  payload jsonb
);

-- Stub con las reglas de 0267 que esta migración ejerce.
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
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event_type !~ '^[a-z][a-z0-9_]{1,79}$'
     or p_source not in ('studio', 'mobile', 'rpc', 'job', 'webhook', 'integration', 'ai')
     or p_result not in ('succeeded', 'rejected', 'failed')
     or p_sensitivity not in ('metadata', 'internal', 'sensitive', 'restricted')
     or (p_result in ('rejected', 'failed')
         and (p_reason is null or pg_catalog.char_length(p_reason) not between 4 and 1000))
     or p_correlation_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
     or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'audit stub: contrato 0267 roto (%)', p_event_type;
  end if;
  insert into public.captured_audit_events(entity_id, event_type, result, reason, payload)
  values (p_entity_id, p_event_type, p_result, p_reason, p_payload);
  return gen_random_uuid();
end;
$$;

\ir ../migrations/0445_portal_profile_edit_limit.sql
\ir ../migrations/0462_portal_profile_direct_edit.sql

insert into auth.users(id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a3'),
  ('00000000-0000-0000-0000-0000000000a4'),
  ('00000000-0000-0000-0000-0000000000a5');
insert into public.tenants(id) values ('00000000-0000-0000-0000-00000000d7d1');

-- A: persona verificada · B: otra ficha con documento y teléfono ocupados ·
-- C: tiene una solicitud pendiente · D: cupo agotado · E: empresa.
insert into public.clients(id, tenant_id, markbox, name, rif, phone, doc_kind, doc_verify_status, doc_verified_at) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9001',
   'Ana Ficticia', 'V-12.345.678', '+58 412 0000001', 'persona', 'verified', now()),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9002',
   'Beto Ficticio', 'V-87654321', '584120000002', 'persona', null, null),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9003',
   'Caro Ficticia', 'V-11111111', '584120000003', 'persona', null, null),
  ('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9004',
   'Dani Ficticio', 'V-22222222', '584120000004', 'persona', null, null),
  ('00000000-0000-0000-0000-00000000c005', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9005',
   'Empresa Ficticia CA', 'J-12345678-9', '584120000005', 'empresa', null, null);
insert into public.client_users(client_id, auth_user_id, status) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a1', 'active'),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-0000000000a3', 'active'),
  ('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-0000000000a4', 'active'),
  ('00000000-0000-0000-0000-00000000c005', '00000000-0000-0000-0000-0000000000a5', 'active');

-- C: solicitud pendiente (reserva 1 cupo) · D: 3 cambios aplicados.
insert into public.client_change_requests(tenant_id, client_id, proposed_name, prev_name, status, source)
values ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c003',
        'Caro Vieja Propuesta', 'Caro Ficticia', 'pending', 'client');
insert into public.client_change_requests(tenant_id, client_id, proposed_name, status, source, reviewed_at)
select '00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c004',
       'Nombre ' || n, 'approved', 'client', now()
from generate_series(1, 3) as n;

-- ── 1. Catálogo y grants ──
do $$
begin
  assert not pg_catalog.has_table_privilege('authenticated', 'public.client_profile_blocked_attempts', 'SELECT')
     and not pg_catalog.has_table_privilege('anon', 'public.client_profile_blocked_attempts', 'SELECT')
     and not pg_catalog.has_table_privilege('service_role', 'public.client_profile_blocked_attempts', 'INSERT')
     and pg_catalog.has_table_privilege('service_role', 'public.client_profile_blocked_attempts', 'SELECT'),
    'CONTRATO 1 ROTO: grants del registro de intentos';
  assert pg_catalog.has_function_privilege('authenticated', 'public.portal_update_my_profile(text,text,text)', 'EXECUTE')
     and not pg_catalog.has_function_privilege('anon', 'public.portal_update_my_profile(text,text,text)', 'EXECUTE')
     and not pg_catalog.has_function_privilege('service_role', 'public.portal_update_my_profile(text,text,text)', 'EXECUTE'),
    'CONTRATO 1 ROTO: EXECUTE de la RPC';
  assert not pg_catalog.has_function_privilege('authenticated', 'public.portal_profile_edit_remaining(uuid)', 'EXECUTE')
     and not pg_catalog.has_function_privilege('authenticated',
       'public.portal_profile_record_blocked_attempt(uuid,uuid,uuid,text,uuid)', 'EXECUTE'),
    'CONTRATO 1 ROTO: las funciones internas quedaron expuestas';
end;
$$;

-- ── 2. Sin sesión ──
set local role authenticated;
do $$
begin
  perform public.portal_update_my_profile('X Y', null, null);
  raise exception 'CONTRATO 2 ROTO: la RPC corrió sin sesión';
exception when insufficient_privilege then
  if sqlerrm <> 'portal_session_required' then raise; end if;
end;
$$;

-- ── 3. A cambia el teléfono: aplica, gasta 1 cupo, no toca la verificación ──
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$
declare r record;
begin
  select * into r from public.portal_update_my_profile(null, null, '584141234567');
  assert r.outcome = 'applied' and r.remaining_count = 2,
    'CONTRATO 3 ROTO: el cambio de teléfono no aplicó o no gastó cupo';

  -- Mismo documento con otro formato y mismo teléfono en otro formato: nada cambia.
  select * into r from public.portal_update_my_profile('Ana Ficticia', 'V-12345678', '0414-1234567');
  assert r.outcome = 'no_changes' and r.remaining_count = 2,
    'CONTRATO 3 ROTO: un cambio sólo de formato gastó cupo';
end;
$$;

reset role;
do $$
declare v_client public.clients%rowtype;
begin
  select * into v_client from public.clients where id = '00000000-0000-0000-0000-00000000c001';
  assert v_client.phone = '584141234567' and v_client.rif = 'V-12.345.678',
    'CONTRATO 3 ROTO: la ficha no quedó con el teléfono nuevo';
  assert v_client.doc_verify_status = 'verified' and v_client.doc_verified_at is not null,
    'CONTRATO 3 ROTO: la verificación se reinició (Sam decidió mantenerla)';
  assert (
    select pg_catalog.count(*) from public.client_change_requests
    where client_id = v_client.id and status = 'approved' and source = 'client'
      and reviewed_by is null and reviewed_at is not null
      and proposed_phone = '584141234567' and prev_phone = '+58 412 0000001'
      and proposed_name is null and proposed_rif is null
      and review_note like '%SDD-0482%'
  ) = 1, 'CONTRATO 3 ROTO: falta la fila de historial con antes y después';
  assert (
    select pg_catalog.count(*) from public.client_profile_edits
    where client_id = v_client.id and status = 'applied'
  ) = 1, 'CONTRATO 3 ROTO: el cupo no quedó aplicado';
end;
$$;

-- ── 4. Duplicados: documento y teléfono de B, sin cupo y con intento ──
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$
declare r record;
begin
  select * into r from public.portal_update_my_profile(null, 'V-87654321', null);
  assert r.outcome = 'blocked' and r.remaining_count = 2,
    'CONTRATO 4 ROTO: el documento de otro cliente no se bloqueó';
  select * into r from public.portal_update_my_profile(null, null, '+58 (412) 000-0002');
  assert r.outcome = 'blocked' and r.remaining_count = 2,
    'CONTRATO 4 ROTO: el teléfono de otro cliente no se bloqueó';
end;
$$;

reset role;
do $$
begin
  assert (select rif from public.clients where id = '00000000-0000-0000-0000-00000000c001') = 'V-12.345.678',
    'CONTRATO 4 ROTO: el bloqueo cambió la ficha';
  assert (
    select pg_catalog.count(*) from public.client_profile_blocked_attempts
    where client_id = '00000000-0000-0000-0000-00000000c001'
      and conflicting_client_id = '00000000-0000-0000-0000-00000000c002'
  ) = 2, 'CONTRATO 4 ROTO: faltan los intentos con el cliente en conflicto';
  assert (
    select pg_catalog.array_agg(field order by field) from public.client_profile_blocked_attempts
    where client_id = '00000000-0000-0000-0000-00000000c001'
  ) = array['document', 'phone'], 'CONTRATO 4 ROTO: campos del intento';
  assert (
    select pg_catalog.count(*) from public.captured_audit_events
    where event_type = 'client_profile_edit_blocked' and result = 'rejected'
      and payload::text not like '%87654321%' and payload::text not like '%0000002%'
  ) = 2, 'CONTRATO 4 ROTO: auditoría del bloqueo ausente o con el valor intentado';
end;
$$;

-- ── 5. Anti-enumeración: al 5.º bloqueo se corta también lo libre ──
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$
declare r record;
begin
  select * into r from public.portal_update_my_profile(null, 'V-87654321', null);
  select * into r from public.portal_update_my_profile(null, 'V-87654321', null);
  select * into r from public.portal_update_my_profile(null, 'V-87654321', null);
  assert r.outcome = 'blocked', 'CONTRATO 5 ROTO: el 5.º intento no se bloqueó';

  select * into r from public.portal_update_my_profile(null, 'V-99999999', null);
  assert r.outcome = 'rate_limited' and r.remaining_count = 2,
    'CONTRATO 5 ROTO: un documento libre pasó con 5 bloqueos en 24 h';
  select * into r from public.portal_update_my_profile(null, null, '584149999999');
  assert r.outcome = 'rate_limited',
    'CONTRATO 5 ROTO: un teléfono libre pasó con 5 bloqueos en 24 h';

  select * into r from public.portal_update_my_profile('Ana María Ficticia', null, null);
  assert r.outcome = 'applied' and r.remaining_count = 1,
    'CONTRATO 5 ROTO: el límite también frenó el nombre';
end;
$$;

-- ── 6. C: la edición directa reemplaza su solicitud pendiente ──
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a3';
do $$
declare r record;
begin
  select * into r from public.portal_update_my_profile(null, 'V-33333333', null);
  assert r.outcome = 'applied' and r.remaining_count = 2,
    'CONTRATO 6 ROTO: la reserva de la solicitud pendiente no se liberó';
end;
$$;

reset role;
do $$
begin
  assert not exists (
    select 1 from public.client_change_requests
    where client_id = '00000000-0000-0000-0000-00000000c003' and status = 'pending'
  ), 'CONTRATO 6 ROTO: la solicitud pendiente sigue viva';
  assert (
    select pg_catalog.count(*) from public.client_profile_edits
    where client_id = '00000000-0000-0000-0000-00000000c003' and status = 'released'
  ) = 1, 'CONTRATO 6 ROTO: la reserva no quedó liberada';
  assert (select rif from public.clients where id = '00000000-0000-0000-0000-00000000c003') = 'V-33333333',
    'CONTRATO 6 ROTO: el documento nuevo no quedó';
end;
$$;

-- ── 7. D: cupo agotado ──
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a4';
do $$
begin
  perform public.portal_update_my_profile('Dani Nuevo', null, null);
  raise exception 'CONTRATO 7 ROTO: un cuarto cambio superó el cupo';
exception when raise_exception then
  if sqlerrm <> 'profile_edit_limit_reached' then raise; end if;
end;
$$;

-- ── 8. Formatos según el tipo ──
do $$
begin
  begin
    perform public.portal_update_my_profile(null, 'J-12345678-0', null);
    raise exception 'CONTRATO 8 ROTO: una persona guardó un RIF J';
  exception when invalid_parameter_value then
    if sqlerrm <> 'invalid_profile_document' then raise; end if;
  end;
  begin
    perform public.portal_update_my_profile(null, null, '123');
    raise exception 'CONTRATO 8 ROTO: teléfono de 3 dígitos';
  exception when invalid_parameter_value then
    if sqlerrm <> 'invalid_profile_phone' then raise; end if;
  end;
  begin
    perform public.portal_update_my_profile('A', null, null);
    raise exception 'CONTRATO 8 ROTO: nombre de 1 carácter';
  exception when invalid_parameter_value then
    if sqlerrm <> 'invalid_profile_name' then raise; end if;
  end;
end;
$$;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a5';
do $$
declare r record;
begin
  select * into r from public.portal_update_my_profile(null, 'G-20000000-1', null);
  assert r.outcome = 'applied', 'CONTRATO 8 ROTO: la empresa no pudo guardar un RIF G';
  begin
    perform public.portal_update_my_profile(null, 'V-12345678', null);
    raise exception 'CONTRATO 8 ROTO: una empresa guardó una cédula sin verificador';
  exception when invalid_parameter_value then
    if sqlerrm <> 'invalid_profile_document' then raise; end if;
  end;
end;
$$;

-- ── 9. Carrera con el índice único: se deshace todo y queda el intento ──
reset role;
create function public.simular_carrera() returns trigger
language plpgsql as $$
begin
  insert into public.clients(id, tenant_id, markbox, name, rif, phone, doc_kind)
  values ('00000000-0000-0000-0000-00000000c099', new.tenant_id, 'DTD-9099',
          'Ficha Concurrente', 'V-44444444', null, 'persona');
  return new;
end;
$$;
create trigger simular_carrera
  after insert on public.client_change_requests
  for each row
  when (new.proposed_rif = 'V-44444444')
  execute function public.simular_carrera();

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a3';
do $$
declare r record;
begin
  select * into r from public.portal_update_my_profile(null, 'V-44444444', null);
  assert r.outcome = 'blocked' and r.remaining_count = 2,
    'CONTRATO 9 ROTO: la carrera con el índice no se tradujo en bloqueo sin cupo';
end;
$$;

reset role;
drop trigger simular_carrera on public.client_change_requests;
drop function public.simular_carrera();
do $$
begin
  assert (select rif from public.clients where id = '00000000-0000-0000-0000-00000000c003') = 'V-33333333',
    'CONTRATO 9 ROTO: la carrera dejó la ficha cambiada';
  assert not exists (select 1 from public.clients where id = '00000000-0000-0000-0000-00000000c099'),
    'CONTRATO 9 ROTO: el bloque interno no se deshizo';
  assert not exists (
    select 1 from public.client_change_requests where proposed_rif = 'V-44444444'
  ), 'CONTRATO 9 ROTO: quedó historial de un cambio que no se aplicó';
  assert exists (
    select 1 from public.client_profile_blocked_attempts
    where client_id = '00000000-0000-0000-0000-00000000c003' and field = 'document'
      and conflicting_client_id is null
  ), 'CONTRATO 9 ROTO: la carrera no dejó intento registrado';
end;
$$;

rollback;
