\set ON_ERROR_STOP on

-- Contrato desechable de 0461 (SDD-0481). Fixtures ficticios + rollback.
-- Aplica la cadena real 0445 → 0446 → 0447 → 0461 y demuestra que el reemplazo
-- de la foto de identidad vuelve a funcionar dentro del cupo COMPARTIDO de 3
-- cambios, que invalida la verificación previa, que conserva la versión
-- sustituida en el ledger restringido y que el gate de 0447 no queda.

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
  cedula_photo_path text,
  doc_verify_status text,
  doc_verify_source text,
  doc_registry_name text,
  doc_verified_at timestamptz,
  doc_verified_by uuid references auth.users(id),
  merged_into_client_id uuid references public.clients(id),
  deleted_at timestamptz
);

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
  before_data jsonb,
  after_data jsonb,
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
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into public.captured_audit_events(
    entity_id, event_type, before_data, after_data, payload
  ) values (
    p_entity_id, p_event_type, p_before_data, p_after_data, p_payload
  );
  return v_id;
end;
$$;

\ir ../migrations/0445_portal_profile_edit_limit.sql
\ir ../migrations/0446_portal_profile_functional_remediation.sql
\ir ../migrations/0447_identity_photo_replacement_privacy_gate.sql
\ir ../migrations/0461_identity_photo_replacement_enable.sql

insert into auth.users(id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000f1');
insert into public.tenants(id) values
  ('00000000-0000-0000-0000-00000000d7d1');
insert into public.clients(id, tenant_id, markbox) values
  ('00000000-0000-0000-0000-00000000c001',
   '00000000-0000-0000-0000-00000000d7d1', 'DTD-9001'),
  ('00000000-0000-0000-0000-00000000c002',
   '00000000-0000-0000-0000-00000000d7d1', 'DTD-9002');
insert into public.client_users(client_id, auth_user_id, status) values
  ('00000000-0000-0000-0000-00000000c001',
   '00000000-0000-0000-0000-0000000000a1', 'active'),
  ('00000000-0000-0000-0000-00000000c002',
   '00000000-0000-0000-0000-0000000000a2', 'active');
insert into storage.objects(bucket_id, name) values
  ('client-docs', '00000000-0000-0000-0000-00000000d7d1/DTD-9001/primera.jpg'),
  ('client-docs', '00000000-0000-0000-0000-00000000d7d1/DTD-9001/uno.jpg'),
  ('client-docs', '00000000-0000-0000-0000-00000000d7d1/DTD-9001/dos.jpg'),
  ('client-docs', '00000000-0000-0000-0000-00000000d7d1/DTD-9001/tres.jpg'),
  ('client-docs', '00000000-0000-0000-0000-00000000d7d1/DTD-9001/cuatro.jpg'),
  ('client-docs', '00000000-0000-0000-0000-00000000d7d1/DTD-9002/primera.jpg'),
  ('client-docs', '00000000-0000-0000-0000-00000000d7d1/DTD-9002/uno.jpg'),
  ('client-docs', '00000000-0000-0000-0000-00000000d7d1/DTD-9002/dos.jpg'),
  ('client-docs', '00000000-0000-0000-0000-00000000d7d1/DTD-9002/tres.jpg');

-- ── Catálogo: el gate de 0447 ya no existe y los grants no se ampliaron ──
do $$
begin
  assert not exists (
    select 1
    from pg_catalog.pg_trigger
    where tgrelid = 'public.client_profile_edits'::pg_catalog.regclass
      and tgname = 'client_profile_edits_identity_photo_privacy_gate'
  ), 'CONTRATO 1 ROTO: el trigger de 0447 sigue enganchado';

  assert pg_catalog.to_regprocedure(
    'public.block_identity_photo_replacement_without_privacy_controls()'
  ) is null, 'CONTRATO 1 ROTO: la función de 0447 sigue existiendo';

  assert pg_catalog.has_function_privilege(
    'authenticated', 'public.portal_set_identity_photo(text)', 'EXECUTE'
  ) and not pg_catalog.has_function_privilege(
    'anon', 'public.portal_set_identity_photo(text)', 'EXECUTE'
  ) and not pg_catalog.has_function_privilege(
    'service_role', 'public.portal_set_identity_photo(text)', 'EXECUTE'
  ), 'CONTRATO 2 ROTO: cambió quién ejecuta portal_set_identity_photo';

  assert not pg_catalog.has_table_privilege(
    'authenticated', 'public.client_profile_edits', 'SELECT'
  ) and not pg_catalog.has_table_privilege(
    'service_role', 'public.client_profile_edits', 'SELECT'
  ) and not pg_catalog.has_table_privilege(
    'anon', 'public.client_profile_edits', 'SELECT'
  ), 'CONTRATO 2 ROTO: el ledger con rutas quedó legible por Data API';

  assert pg_catalog.col_description(
    'public.client_profile_edits'::pg_catalog.regclass,
    (select attnum from pg_catalog.pg_attribute
     where attrelid = 'public.client_profile_edits'::pg_catalog.regclass
       and attname = 'previous_storage_path')
  ) like 'SDD-0481:%', 'CONTRATO 2 ROTO: falta la nota de versión conservada en previous_storage_path';
end;
$$;

-- ── Cliente 1: primera foto gratis y tres reemplazos, el cuarto no ──
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set local role authenticated;

do $$
declare result record;
begin
  select * into result
  from public.portal_set_identity_photo(
    '00000000-0000-0000-0000-00000000d7d1/DTD-9001/primera.jpg'
  );
  assert result.counted is false and result.remaining_count = 3,
    'CONTRATO 3 ROTO: la primera foto consumió cupo';
end;
$$;

reset role;
update public.clients
set doc_verify_status = 'verified',
    doc_verify_source = 'manual',
    doc_registry_name = 'NOMBRE FICTICIO',
    doc_verified_at = now(),
    doc_verified_by = '00000000-0000-0000-0000-0000000000f1'
where id = '00000000-0000-0000-0000-00000000c001';
set local role authenticated;

do $$
declare result record;
begin
  select * into result
  from public.portal_set_identity_photo(
    '00000000-0000-0000-0000-00000000d7d1/DTD-9001/uno.jpg'
  );
  assert result.counted is true and result.remaining_count = 2,
    'CONTRATO 4 ROTO: el primer reemplazo no pasó o no consumió cupo';

  select * into result
  from public.portal_set_identity_photo(
    '00000000-0000-0000-0000-00000000d7d1/DTD-9001/dos.jpg'
  );
  assert result.counted is true and result.remaining_count = 1,
    'CONTRATO 4 ROTO: el segundo reemplazo no descontó bien';

  select * into result
  from public.portal_set_identity_photo(
    '00000000-0000-0000-0000-00000000d7d1/DTD-9001/tres.jpg'
  );
  assert result.counted is true and result.remaining_count = 0,
    'CONTRATO 4 ROTO: el tercer reemplazo no descontó bien';
end;
$$;

do $$
begin
  perform public.portal_set_identity_photo(
    '00000000-0000-0000-0000-00000000d7d1/DTD-9001/cuatro.jpg'
  );
  raise exception 'CONTRATO 5 ROTO: un cuarto cambio superó el cupo de 3';
exception
  when raise_exception then
    if sqlerrm <> 'profile_edit_limit_reached' then
      raise;
    end if;
end;
$$;

reset role;

do $$
declare
  v_client public.clients%rowtype;
begin
  select * into v_client
  from public.clients
  where id = '00000000-0000-0000-0000-00000000c001';

  assert v_client.cedula_photo_path
    = '00000000-0000-0000-0000-00000000d7d1/DTD-9001/tres.jpg',
    'CONTRATO 5 ROTO: el cambio rechazado movió el puntero';

  assert v_client.doc_verify_status is null
     and v_client.doc_verify_source is null
     and v_client.doc_registry_name is null
     and v_client.doc_verified_at is null
     and v_client.doc_verified_by is null,
    'CONTRATO 6 ROTO: el reemplazo conservó la verificación de la foto anterior';

  assert (
    select pg_catalog.count(*)
    from public.client_profile_edits
    where client_id = v_client.id
      and edit_kind = 'identity_photo'
      and status = 'applied'
  ) = 3, 'CONTRATO 7 ROTO: el ledger no registra exactamente 3 reemplazos';

  assert exists (
    select 1
    from public.client_profile_edits
    where client_id = v_client.id
      and edit_kind = 'identity_photo'
      and previous_storage_path like '%/DTD-9001/primera.jpg'
      and new_storage_path like '%/DTD-9001/uno.jpg'
  ), 'CONTRATO 7 ROTO: el ledger no conserva la versión de la foto sustituida';

  assert (
    select pg_catalog.count(*)
    from public.captured_audit_events
    where entity_id = v_client.id
      and event_type = 'client_identity_photo_replaced'
  ) = 3, 'CONTRATO 8 ROTO: faltan eventos de auditoría de reemplazo';

  assert not exists (
    select 1
    from public.captured_audit_events
    where entity_id = v_client.id
      and (
        before_data::text like '%.jpg%'
        or after_data::text like '%.jpg%'
        or payload::text like '%.jpg%'
      )
  ), 'CONTRATO 8 ROTO: la auditoría copió rutas de documentos';
end;
$$;

-- ── Cliente 2: el cupo es COMPARTIDO con las solicitudes de datos ──
insert into public.client_change_requests(
  tenant_id, client_id, proposed_phone, prev_phone, status, source
) values (
  '00000000-0000-0000-0000-00000000d7d1',
  '00000000-0000-0000-0000-00000000c002',
  '04120000000', '04121111111', 'pending', 'client'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
set local role authenticated;

do $$
declare result record;
begin
  select * into result
  from public.portal_set_identity_photo(
    '00000000-0000-0000-0000-00000000d7d1/DTD-9002/primera.jpg'
  );
  assert result.counted is false and result.remaining_count = 2,
    'CONTRATO 9 ROTO: la primera foto no respetó la reserva pendiente';

  select * into result
  from public.portal_set_identity_photo(
    '00000000-0000-0000-0000-00000000d7d1/DTD-9002/uno.jpg'
  );
  assert result.counted is true and result.remaining_count = 1,
    'CONTRATO 9 ROTO: el reemplazo no compartió cupo con la solicitud';

  select * into result
  from public.portal_set_identity_photo(
    '00000000-0000-0000-0000-00000000d7d1/DTD-9002/dos.jpg'
  );
  assert result.counted is true and result.remaining_count = 0,
    'CONTRATO 9 ROTO: el segundo reemplazo no agotó el cupo compartido';
end;
$$;

do $$
begin
  perform public.portal_set_identity_photo(
    '00000000-0000-0000-0000-00000000d7d1/DTD-9002/tres.jpg'
  );
  raise exception 'CONTRATO 9 ROTO: solicitud + dos reemplazos superaron el cupo';
exception
  when raise_exception then
    if sqlerrm <> 'profile_edit_limit_reached' then
      raise;
    end if;
end;
$$;

-- ── Aislamiento: la sesión del cliente 2 no mueve la foto del cliente 1 ──
do $$
begin
  perform public.portal_set_identity_photo(
    '00000000-0000-0000-0000-00000000d7d1/DTD-9001/cuatro.jpg'
  );
  raise exception 'CONTRATO 10 ROTO: una sesión movió la foto de otro cliente';
exception
  when invalid_parameter_value then
    if sqlerrm <> 'invalid_identity_photo_path' then
      raise;
    end if;
end;
$$;

reset role;

rollback;
