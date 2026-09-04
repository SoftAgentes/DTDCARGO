\set ON_ERROR_STOP on

-- Contrato desechable de SDD-0438. El fixture de merge_clients conserva sólo
-- las dos transiciones relevantes de 0361: reasignar solicitudes y retirar la
-- ficha fusionada. Todo corre en PostgreSQL efímero y termina en ROLLBACK.

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

-- 0 · Un asiento ya ligado a una ficha retirada simula el intervalo entre la
-- aplicación de 0445 y la llegada de 0446. El backfill debe moverlo sin
-- insertar ni borrar historia.
insert into public.tenants(id) values
  ('00000000-0000-0000-0000-00000000d7d0');
insert into public.clients(id, tenant_id, markbox) values
  (
    '00000000-0000-0000-0000-00000000c010',
    '00000000-0000-0000-0000-00000000d7d0',
    'DTD-9010'
  );
insert into public.clients(
  id, tenant_id, markbox, merged_into_client_id, deleted_at
) values (
  '00000000-0000-0000-0000-00000000c011',
  '00000000-0000-0000-0000-00000000d7d0',
  'DTD-9011',
  '00000000-0000-0000-0000-00000000c010',
  now()
);
insert into public.client_profile_edits(
  id, tenant_id, client_id, edit_kind, status, previous_storage_path,
  new_storage_path, applied_at
) values (
  '00000000-0000-0000-0000-00000000f001',
  '00000000-0000-0000-0000-00000000d7d0',
  '00000000-0000-0000-0000-00000000c011',
  'identity_photo', 'applied', 'anterior.jpg', 'nueva.jpg', now()
);

\ir ../migrations/0446_portal_profile_functional_remediation.sql

do $backfill$
begin
  assert (select client_id from public.client_profile_edits
          where id = '00000000-0000-0000-0000-00000000f001') =
         '00000000-0000-0000-0000-00000000c010',
    'CONTRATO 0 ROTO: el backfill no siguió al superviviente';
  assert (select pg_catalog.count(*) from public.client_profile_edits
          where id = '00000000-0000-0000-0000-00000000f001') = 1,
    'CONTRATO 0 ROTO: el backfill perdió o duplicó el asiento';
end;
$backfill$;

delete from public.client_profile_edits
where id = '00000000-0000-0000-0000-00000000f001';
delete from public.clients
where id in (
  '00000000-0000-0000-0000-00000000c011',
  '00000000-0000-0000-0000-00000000c010'
);
delete from public.tenants
where id = '00000000-0000-0000-0000-00000000d7d0';

-- Fixture recortado de merge_clients 0361. La condición de conflicto y el
-- orden de los UPDATE son iguales a los de la función productiva.
create function public.merge_clients(p_survivor_id uuid, p_merged_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_survivor public.clients;
  v_merged public.clients;
begin
  select * into strict v_survivor
  from public.clients
  where id = p_survivor_id and deleted_at is null
  for update;

  select * into strict v_merged
  from public.clients
  where id = p_merged_id and deleted_at is null
  for update;

  if v_survivor.tenant_id is distinct from v_merged.tenant_id then
    raise exception 'cross_tenant_merge' using errcode = '42501';
  end if;

  update public.client_change_requests
  set client_id = v_survivor.id
  where client_id = v_merged.id
    and not (
      status = 'pending'
      and exists (
        select 1
        from public.client_change_requests as other
        where other.client_id = v_survivor.id
          and other.status = 'pending'
      )
    );

  update public.clients
  set merged_into_client_id = v_survivor.id,
      deleted_at = now()
  where id = v_merged.id;

  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

insert into auth.users(id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2');

insert into public.tenants(id) values
  ('00000000-0000-0000-0000-00000000d7d1'),
  ('00000000-0000-0000-0000-00000000d7d2');

insert into public.clients(
  id, tenant_id, markbox, cedula_photo_path, doc_verify_status,
  doc_verify_source, doc_registry_name, doc_verified_at, doc_verified_by
) values
  (
    '00000000-0000-0000-0000-00000000c001',
    '00000000-0000-0000-0000-00000000d7d1',
    'DTD-9001', null, null, null, null, null, null
  ),
  (
    '00000000-0000-0000-0000-00000000c002',
    '00000000-0000-0000-0000-00000000d7d1',
    'DTD-9002',
    '00000000-0000-0000-0000-00000000d7d1/DTD-9002/anterior.jpg',
    'ok', 'manual', 'NOMBRE DE PRUEBA', now(),
    '00000000-0000-0000-0000-0000000000a2'
  ),
  (
    '00000000-0000-0000-0000-00000000c003',
    '00000000-0000-0000-0000-00000000d7d2',
    'DTD-9003', null, null, null, null, null, null
  );

insert into public.client_users(client_id, auth_user_id, status) values
  (
    '00000000-0000-0000-0000-00000000c001',
    '00000000-0000-0000-0000-0000000000a1',
    'active'
  ),
  (
    '00000000-0000-0000-0000-00000000c002',
    '00000000-0000-0000-0000-0000000000a2',
    'active'
  );

insert into storage.objects(bucket_id, name) values (
  'client-docs',
  '00000000-0000-0000-0000-00000000d7d1/DTD-9002/reemplazo.jpg'
);

-- 1 · Sustituir la evidencia borra atómicamente el veredicto derivado.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
set local role authenticated;
do $identity$
declare
  v_result record;
begin
  select * into v_result
  from public.portal_set_identity_photo(
    '00000000-0000-0000-0000-00000000d7d1/DTD-9002/reemplazo.jpg'
  );

  assert v_result.counted and v_result.remaining_count = 2,
    'CONTRATO 1 ROTO: el reemplazo no consumió exactamente un cupo';
end;
$identity$;
reset role;

do $identity_assertions$
declare
  v_client public.clients;
begin
  select * into strict v_client
  from public.clients
  where id = '00000000-0000-0000-0000-00000000c002';

  assert v_client.cedula_photo_path =
    '00000000-0000-0000-0000-00000000d7d1/DTD-9002/reemplazo.jpg',
    'CONTRATO 1 ROTO: la evidencia nueva no quedó vigente';
  assert v_client.doc_verify_status is null
     and v_client.doc_verify_source is null
     and v_client.doc_registry_name is null
     and v_client.doc_verified_at is null
     and v_client.doc_verified_by is null,
    'CONTRATO 1 ROTO: sobrevivió un campo de la verificación anterior';

  assert exists (
    select 1
    from public.captured_audit_events
    where entity_id = v_client.id
      and event_type = 'client_identity_photo_replaced'
      and before_data->>'identity_verification_present' = 'true'
      and after_data->>'identity_verification_present' = 'false'
      and payload->>'verification_invalidated' = 'true'
  ), 'CONTRATO 1 ROTO: la auditoría no registra la invalidación sin copiar PII';
end;
$identity_assertions$;

-- 2 · Cada ficha tiene su historial antes de fusionarse.
insert into public.client_change_requests(
  id, tenant_id, client_id, proposed_name, status, submitted_by
) values
  (
    '00000000-0000-0000-0000-00000000e001',
    '00000000-0000-0000-0000-00000000d7d1',
    '00000000-0000-0000-0000-00000000c001',
    'Pendiente superviviente', 'pending',
    '00000000-0000-0000-0000-0000000000a1'
  ),
  (
    '00000000-0000-0000-0000-00000000e002',
    '00000000-0000-0000-0000-00000000d7d1',
    '00000000-0000-0000-0000-00000000c002',
    'Pendiente fusionada', 'pending',
    '00000000-0000-0000-0000-0000000000a2'
  ),
  (
    '00000000-0000-0000-0000-00000000e003',
    '00000000-0000-0000-0000-00000000d7d1',
    '00000000-0000-0000-0000-00000000c002',
    'Aprobada fusionada', 'approved',
    '00000000-0000-0000-0000-0000000000a2'
  );

do $pre_merge$
begin
  assert (select pg_catalog.count(*) from public.client_profile_edits) = 4,
    'CONTRATO 2 ROTO: el fixture no tiene cuatro asientos únicos';
  assert (select pg_catalog.count(*) from public.client_profile_edits
          where client_id = '00000000-0000-0000-0000-00000000c001') = 1,
    'CONTRATO 2 ROTO: el superviviente no empezó con un asiento';
  assert (select pg_catalog.count(*) from public.client_profile_edits
          where client_id = '00000000-0000-0000-0000-00000000c002') = 3,
    'CONTRATO 2 ROTO: la ficha fusionada no empezó con tres asientos';
end;
$pre_merge$;

-- 3 · Un destino de otro tenant falla cerrado y no mueve el ledger.
do $cross_tenant$
begin
  begin
    update public.clients
    set merged_into_client_id = '00000000-0000-0000-0000-00000000c003',
        deleted_at = now()
    where id = '00000000-0000-0000-0000-00000000c002';
    raise exception 'CONTRATO 3 ROTO: aceptó mover el cupo a otro tenant';
  exception
    when check_violation then null;
  end;

  assert (select merged_into_client_id from public.clients
          where id = '00000000-0000-0000-0000-00000000c002') is null,
    'CONTRATO 3 ROTO: el fallo cross-tenant dejó la ficha alterada';
  assert (select pg_catalog.count(*) from public.client_profile_edits
          where client_id = '00000000-0000-0000-0000-00000000c002') = 3,
    'CONTRATO 3 ROTO: el fallo cross-tenant movió asientos';
end;
$cross_tenant$;

-- 4 · La fusión realista conserva el pendiente conflictivo en la ficha retirada,
-- pero TODO el cupo acumulado queda en el cliente canónico, una sola vez.
do $merge$
declare
  v_result jsonb;
begin
  v_result := public.merge_clients(
    '00000000-0000-0000-0000-00000000c001',
    '00000000-0000-0000-0000-00000000c002'
  );
  assert v_result->>'ok' = 'true', 'CONTRATO 4 ROTO: la fusión no terminó';
end;
$merge$;

do $merge_assertions$
declare
  v_total integer;
  v_distinct integer;
begin
  select pg_catalog.count(*), pg_catalog.count(distinct id)
    into v_total, v_distinct
  from public.client_profile_edits;

  assert v_total = 4 and v_distinct = 4,
    'CONTRATO 4 ROTO: la fusión perdió o duplicó asientos de cupo';
  assert not exists (
    select 1
    from public.client_profile_edits
    where client_id = '00000000-0000-0000-0000-00000000c002'
  ), 'CONTRATO 4 ROTO: quedó cupo ligado a la ficha retirada';
  assert (select pg_catalog.count(*) from public.client_profile_edits
          where client_id = '00000000-0000-0000-0000-00000000c001') = 4,
    'CONTRATO 4 ROTO: el superviviente no acumuló exactamente ambos historiales';

  assert (select client_id from public.client_change_requests
          where id = '00000000-0000-0000-0000-00000000e003') =
         '00000000-0000-0000-0000-00000000c001',
    'CONTRATO 4 ROTO: la solicitud aprobada no siguió al superviviente';
  assert (select client_id from public.client_change_requests
          where id = '00000000-0000-0000-0000-00000000e002') =
         '00000000-0000-0000-0000-00000000c002',
    'CONTRATO 4 ROTO: el fixture no conservó el pendiente conflictivo';
end;
$merge_assertions$;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set local role authenticated;
do $quota$
declare
  v_quota record;
begin
  select * into v_quota from public.get_my_portal_profile_edit_quota();
  assert v_quota.applied_count = 2
     and v_quota.reserved_count = 2
     and v_quota.remaining_count = 0,
    'CONTRATO 4 ROTO: el agregado del superviviente perdió o regaló cupo';
end;
$quota$;
reset role;

-- 5 · Se preservan SECURITY DEFINER, search_path vacío y grants estrechos.
do $security_contract$
declare
  v_function text;
begin
  foreach v_function in array array[
    'portal_profile_edit_follow_request_reassignment',
    'portal_profile_edits_follow_client_merge',
    'portal_set_identity_photo'
  ] loop
    assert exists (
      select 1
      from pg_catalog.pg_proc as proc
      join pg_catalog.pg_namespace as namespace on namespace.oid = proc.pronamespace
      where namespace.nspname = 'public'
        and proc.proname = v_function
        and proc.prosecdef
        and exists (
          select 1
          from pg_catalog.unnest(coalesce(proc.proconfig, array[]::text[])) as setting
          where setting like 'search_path=%'
            and setting not like '%public%'
        )
    ), 'CONTRATO 5 ROTO: función sin SECURITY DEFINER/search_path vacío: ' || v_function;
  end loop;

  assert pg_catalog.has_function_privilege(
           'authenticated', 'public.portal_set_identity_photo(text)', 'EXECUTE'
         ),
    'CONTRATO 5 ROTO: authenticated perdió la RPC self-scope';
  assert not pg_catalog.has_function_privilege(
           'anon', 'public.portal_set_identity_photo(text)', 'EXECUTE'
         ),
    'CONTRATO 5 ROTO: anon obtuvo la RPC sensible';
  assert not pg_catalog.has_function_privilege(
           'service_role', 'public.portal_set_identity_photo(text)', 'EXECUTE'
         ),
    'CONTRATO 5 ROTO: service_role obtuvo la RPC pública';
  assert not pg_catalog.has_function_privilege(
           'authenticated',
           'public.portal_profile_edits_follow_client_merge()',
           'EXECUTE'
         ),
    'CONTRATO 5 ROTO: el trigger de fusión quedó invocable por cliente';
end;
$security_contract$;

rollback;
