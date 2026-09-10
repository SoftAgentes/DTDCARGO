\set ON_ERROR_STOP on

-- Contrato desechable de 0447 (SDD-0439). Fixtures ficticios + rollback.
-- Demuestra que la primera foto sigue disponible y que un reemplazo no crea
-- histórico, no mueve el puntero y falla dentro de la transacción de 0445.

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
returns uuid language sql security definer set search_path = '' as $$
  select gen_random_uuid()
$$;

\ir ../migrations/0445_portal_profile_edit_limit.sql
\ir ../migrations/0447_identity_photo_replacement_privacy_gate.sql

insert into auth.users(id) values
  ('00000000-0000-0000-0000-0000000000a1');
insert into public.tenants(id) values
  ('00000000-0000-0000-0000-00000000d7d1');
insert into public.clients(id, tenant_id, markbox) values
  ('00000000-0000-0000-0000-00000000c001',
   '00000000-0000-0000-0000-00000000d7d1', 'DTD-9001');
insert into public.client_users(client_id, auth_user_id, status) values
  ('00000000-0000-0000-0000-00000000c001',
   '00000000-0000-0000-0000-0000000000a1', 'active');
insert into storage.objects(bucket_id, name) values
  ('client-docs', '00000000-0000-0000-0000-00000000d7d1/DTD-9001/primera.jpg'),
  ('client-docs', '00000000-0000-0000-0000-00000000d7d1/DTD-9001/reemplazo.jpg');

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
    'CONTRATO 1 ROTO: 0447 bloqueó o contó la primera foto';
end;
$$;

do $$
begin
  perform public.portal_set_identity_photo(
    '00000000-0000-0000-0000-00000000d7d1/DTD-9001/reemplazo.jpg'
  );
  raise exception 'CONTRATO 2 ROTO: el reemplazo atravesó el gate de privacidad';
exception
  when raise_exception then
    if sqlerrm <> 'identity_photo_replacement_temporarily_disabled' then
      raise;
    end if;
end;
$$;

reset role;

do $$
begin
  assert (
    select cedula_photo_path
    from public.clients
    where id = '00000000-0000-0000-0000-00000000c001'
  ) = '00000000-0000-0000-0000-00000000d7d1/DTD-9001/primera.jpg',
    'CONTRATO 3 ROTO: el reemplazo bloqueado movió el puntero';

  assert not exists (
    select 1 from public.client_profile_edits
    where edit_kind = 'identity_photo'
  ), 'CONTRATO 3 ROTO: el reemplazo bloqueado creó historial sensible';

  assert exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.client_profile_edits'::regclass
      and tgname = 'client_profile_edits_identity_photo_privacy_gate'
      and tgenabled = 'O'
  ), 'CONTRATO 4 ROTO: el trigger fail-closed no quedó activo';

  assert not pg_catalog.has_function_privilege(
    'authenticated',
    'public.block_identity_photo_replacement_without_privacy_controls()',
    'EXECUTE'
  ), 'CONTRATO 5 ROTO: authenticated puede ejecutar la función interna';
end;
$$;

rollback;
