-- ─────────────────────────────────────────────────────────────────────────────
-- SDD-0435 · Tres cambios efectivos de perfil por cliente.
--
-- Cuenta en un ledger restringido:
--   · solicitud de datos PENDING  → reserved
--   · solicitud APPROVED          → applied
--   · solicitud REJECTED/DELETE   → released (deja traza, devuelve el cupo)
--   · reemplazo de foto existente → applied
--
-- La primera foto no consume cupo. Las direcciones viven en otra tabla y no
-- participan de este contrato. NO aplicar a prod sin GO Cloud nombrando 0445.
-- ─────────────────────────────────────────────────────────────────────────────

do $preflight$
begin
  if to_regclass('public.clients') is null
     or to_regclass('public.client_change_requests') is null
     or to_regclass('public.entity_audit_log') is null
     or to_regclass('storage.objects') is null
     or to_regprocedure('public.get_portal_client_id()') is null
     or to_regprocedure(
       'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
     ) is null then
    raise exception '0445 requiere clients, client_change_requests, storage.objects y auditoría canónica';
  end if;

  if to_regclass('public.client_profile_edits') is not null
     or to_regprocedure('public.get_my_portal_profile_edit_quota()') is not null
     or to_regprocedure('public.portal_set_identity_photo(text)') is not null then
    raise exception '0445 abortado: el contrato de cupo ya existe';
  end if;
end;
$preflight$;

alter table public.client_change_requests
  add column submitted_by uuid references auth.users(id) on delete set null;

comment on column public.client_change_requests.submitted_by is
  'SDD-0435: auth.user que originó la solicitud desde el portal; permite atribuir reserva/cancelación sin exponer PII.';

create table public.client_profile_edits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  edit_kind text not null check (edit_kind in ('profile_data', 'identity_photo')),
  status text not null check (status in ('reserved', 'applied', 'released')),
  request_id uuid,
  previous_storage_path text,
  new_storage_path text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  released_at timestamptz,
  constraint client_profile_edits_shape check (
    (
      edit_kind = 'profile_data'
      and request_id is not null
      and previous_storage_path is null
      and new_storage_path is null
    )
    or (
      edit_kind = 'identity_photo'
      and request_id is null
      and status = 'applied'
      and previous_storage_path is not null
      and new_storage_path is not null
    )
  ),
  constraint client_profile_edits_timestamps check (
    (status = 'reserved' and applied_at is null and released_at is null)
    or (status = 'applied' and applied_at is not null and released_at is null)
    or (status = 'released' and applied_at is null and released_at is not null)
  )
);

comment on table public.client_profile_edits is
  'SDD-0435: ledger restringido del cupo vitalicio de 3 cambios efectivos de perfil. No contiene los valores personales propuestos; las rutas de documentos sustituidos no se exponen por Data API.';

create unique index client_profile_edits_request_unique
  on public.client_profile_edits (request_id)
  where request_id is not null;

create index client_profile_edits_active_count_idx
  on public.client_profile_edits (client_id, status)
  where status in ('reserved', 'applied');

alter table public.client_profile_edits enable row level security;
revoke all on table public.client_profile_edits
  from public, anon, authenticated, service_role;
-- Sin policies: sólo las funciones internas, cuyo owner es postgres, acceden.

-- Historial comprobable anterior a 0445. Rechazos previos no consumen cupo y
-- reemplazos de foto previos no se infieren: no existe evidencia suficiente.
insert into public.client_profile_edits (
  tenant_id,
  client_id,
  edit_kind,
  status,
  request_id,
  actor_id,
  created_at,
  applied_at
)
select
  request.tenant_id,
  request.client_id,
  'profile_data',
  case when request.status = 'approved' then 'applied' else 'reserved' end,
  request.id,
  request.reviewed_by,
  request.submitted_at,
  case when request.status = 'approved'
    then coalesce(request.reviewed_at, request.updated_at, request.submitted_at)
    else null
  end
from public.client_change_requests as request
where request.source = 'client'
  and request.status in ('pending', 'approved');

create function public.portal_profile_edit_request_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid;
  v_actor_type text;
  v_active_count integer;
  v_ledger_id uuid;
  v_status text;
begin
  if tg_op = 'INSERT' then
    if new.source <> 'client' or new.status not in ('pending', 'approved') then
      return new;
    end if;

    perform 1 from public.clients where id = new.client_id for update;
    if not found then
      raise exception 'profile_client_not_found' using errcode = '23503';
    end if;

    select pg_catalog.count(*)::integer
      into v_active_count
    from public.client_profile_edits
    where client_id = new.client_id
      and status in ('reserved', 'applied');

    if v_active_count >= 3 then
      raise exception 'profile_edit_limit_reached'
        using errcode = 'P0001', detail = 'El cliente ya consumió o reservó sus 3 cambios de perfil.';
    end if;

    v_status := case when new.status = 'approved' then 'applied' else 'reserved' end;
    insert into public.client_profile_edits (
      tenant_id, client_id, edit_kind, status, request_id, actor_id,
      created_at, applied_at
    ) values (
      new.tenant_id, new.client_id, 'profile_data', v_status, new.id,
      coalesce(new.submitted_by, new.reviewed_by), new.submitted_at,
      case when v_status = 'applied' then coalesce(new.reviewed_at, now()) else null end
    ) returning id into v_ledger_id;

    v_actor_id := coalesce(new.submitted_by, new.reviewed_by);
    v_actor_type := case when v_actor_id is null then 'system' else 'user' end;

    perform public.append_audit_event(
      new.tenant_id,
      'client',
      new.client_id,
      v_actor_type,
      v_actor_id,
      case when v_status = 'applied'
        then 'client_profile_edit_applied'
        else 'client_profile_edit_reserved'
      end,
      'rpc',
      'succeeded',
      null,
      null,
      pg_catalog.jsonb_build_object('edit_kind', 'profile_data', 'status', v_status),
      pg_catalog.jsonb_build_object(
        'ledger_id', v_ledger_id,
        'request_id', new.id,
        'remaining_count', greatest(0, 2 - v_active_count)
      ),
      'profile-edit:' || v_ledger_id::text,
      1,
      'sensitive'
    );
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.source = 'client'
     and old.status = 'pending'
     and new.status in ('approved', 'rejected') then
    if new.status = 'approved' then
      update public.client_profile_edits
      set status = 'applied', applied_at = coalesce(new.reviewed_at, now())
      where request_id = new.id and status = 'reserved'
      returning id into v_ledger_id;
      v_status := 'applied';
    else
      update public.client_profile_edits
      set status = 'released', released_at = coalesce(new.reviewed_at, now())
      where request_id = new.id and status = 'reserved'
      returning id into v_ledger_id;
      v_status := 'released';
    end if;

    if v_ledger_id is not null then
      v_actor_id := coalesce(new.reviewed_by, new.submitted_by);
      v_actor_type := case when v_actor_id is null then 'system' else 'user' end;
      perform public.append_audit_event(
        new.tenant_id,
        'client',
        new.client_id,
        v_actor_type,
        v_actor_id,
        case when v_status = 'applied'
          then 'client_profile_edit_applied'
          else 'client_profile_edit_released'
        end,
        'rpc',
        'succeeded',
        null,
        pg_catalog.jsonb_build_object('edit_kind', 'profile_data', 'status', 'reserved'),
        pg_catalog.jsonb_build_object(
          'edit_kind', 'profile_data',
          'status', v_status,
          'outcome', new.status
        ),
        pg_catalog.jsonb_build_object('ledger_id', v_ledger_id, 'request_id', new.id),
        'profile-edit:' || v_ledger_id::text || ':' || v_status,
        1,
        'sensitive'
      );
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' and old.source = 'client' and old.status = 'pending' then
    update public.client_profile_edits
    set status = 'released', released_at = now()
    where request_id = old.id and status = 'reserved'
    returning id into v_ledger_id;

    if v_ledger_id is not null then
      v_actor_id := old.submitted_by;
      v_actor_type := case when v_actor_id is null then 'system' else 'user' end;
      perform public.append_audit_event(
        old.tenant_id,
        'client',
        old.client_id,
        v_actor_type,
        v_actor_id,
        'client_profile_edit_released',
        'rpc',
        'succeeded',
        null,
        pg_catalog.jsonb_build_object('edit_kind', 'profile_data', 'status', 'reserved'),
        pg_catalog.jsonb_build_object(
          'edit_kind', 'profile_data',
          'status', 'released',
          'outcome', 'cancelled'
        ),
        pg_catalog.jsonb_build_object('ledger_id', v_ledger_id, 'request_id', old.id),
        'profile-edit:' || v_ledger_id::text || ':released',
        1,
        'sensitive'
      );
    end if;
    return old;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

alter function public.portal_profile_edit_request_lifecycle() owner to postgres;
revoke all on function public.portal_profile_edit_request_lifecycle()
  from public, anon, authenticated, service_role;

create trigger client_change_requests_profile_edit_lifecycle
  after insert or update or delete on public.client_change_requests
  for each row execute function public.portal_profile_edit_request_lifecycle();

create function public.get_my_portal_profile_edit_quota()
returns table (
  limit_count integer,
  applied_count integer,
  reserved_count integer,
  remaining_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_client_id uuid := public.get_portal_client_id();
begin
  if auth.uid() is null or v_client_id is null then
    raise exception 'portal_session_required' using errcode = '42501';
  end if;

  return query
  select
    3,
    (pg_catalog.count(*) filter (where edit.status = 'applied'))::integer,
    (pg_catalog.count(*) filter (where edit.status = 'reserved'))::integer,
    greatest(
      0,
      3 - (
        pg_catalog.count(*) filter (where edit.status in ('reserved', 'applied'))
      )::integer
    )::integer
  from public.client_profile_edits as edit
  where edit.client_id = v_client_id;
end;
$function$;

alter function public.get_my_portal_profile_edit_quota() owner to postgres;
revoke all on function public.get_my_portal_profile_edit_quota()
  from public, anon, authenticated, service_role;
grant execute on function public.get_my_portal_profile_edit_quota()
  to authenticated;

create function public.portal_set_identity_photo(p_new_path text)
returns table (counted boolean, remaining_count integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_client_id uuid := public.get_portal_client_id();
  v_tenant_id uuid;
  v_markbox text;
  v_old_path text;
  v_prefix text;
  v_active_count integer;
  v_ledger_id uuid;
begin
  if v_actor_id is null or v_client_id is null then
    raise exception 'portal_session_required' using errcode = '42501';
  end if;

  select client.tenant_id, client.markbox, client.cedula_photo_path
    into v_tenant_id, v_markbox, v_old_path
  from public.clients as client
  where client.id = v_client_id and client.deleted_at is null
  for update;

  if not found then
    raise exception 'profile_client_not_found' using errcode = 'P0001';
  end if;

  v_prefix := v_tenant_id::text || '/' || v_markbox || '/';
  p_new_path := pg_catalog.btrim(coalesce(p_new_path, ''));
  if p_new_path = ''
     or pg_catalog.char_length(p_new_path) > 500
     or pg_catalog.left(p_new_path, pg_catalog.char_length(v_prefix)) <> v_prefix
     or pg_catalog.strpos(p_new_path, '/avatar/') > 0
     or pg_catalog.strpos(p_new_path, '..') > 0
     or p_new_path = v_old_path then
    raise exception 'invalid_identity_photo_path' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from storage.objects as object
    where object.bucket_id = 'client-docs' and object.name = p_new_path
  ) then
    raise exception 'identity_photo_object_not_found' using errcode = '22023';
  end if;

  select pg_catalog.count(*)::integer
    into v_active_count
  from public.client_profile_edits
  where client_id = v_client_id and status in ('reserved', 'applied');

  if v_old_path is not null and pg_catalog.btrim(v_old_path) <> '' then
    if v_active_count >= 3 then
      raise exception 'profile_edit_limit_reached'
        using errcode = 'P0001', detail = 'El cliente ya consumió o reservó sus 3 cambios de perfil.';
    end if;

    insert into public.client_profile_edits (
      tenant_id, client_id, edit_kind, status, previous_storage_path,
      new_storage_path, actor_id, applied_at
    ) values (
      v_tenant_id, v_client_id, 'identity_photo', 'applied', v_old_path,
      p_new_path, v_actor_id, now()
    ) returning id into v_ledger_id;
  end if;

  update public.clients
  set cedula_photo_path = p_new_path
  where id = v_client_id;

  perform public.append_audit_event(
    v_tenant_id,
    'client',
    v_client_id,
    'user',
    v_actor_id,
    case when v_ledger_id is null
      then 'client_identity_photo_uploaded'
      else 'client_identity_photo_replaced'
    end,
    'rpc',
    'succeeded',
    null,
    pg_catalog.jsonb_build_object('identity_photo_present', v_old_path is not null),
    pg_catalog.jsonb_build_object('identity_photo_present', true),
    pg_catalog.jsonb_build_object(
      'counted', v_ledger_id is not null,
      'ledger_id', v_ledger_id,
      'remaining_count', case when v_ledger_id is null
        then greatest(0, 3 - v_active_count)
        else greatest(0, 2 - v_active_count)
      end
    ),
    case when v_ledger_id is null
      then 'identity-photo:' || v_client_id::text || ':' || pg_catalog.txid_current()::text
      else 'profile-edit:' || v_ledger_id::text
    end,
    1,
    'restricted'
  );

  return query select
    v_ledger_id is not null,
    case when v_ledger_id is null
      then greatest(0, 3 - v_active_count)
      else greatest(0, 2 - v_active_count)
    end::integer;
end;
$function$;

alter function public.portal_set_identity_photo(text) owner to postgres;
revoke all on function public.portal_set_identity_photo(text)
  from public, anon, authenticated, service_role;
grant execute on function public.portal_set_identity_photo(text)
  to authenticated;

comment on function public.get_my_portal_profile_edit_quota() is
  'SDD-0435: agregado self-scope del cupo de 3 cambios; no expone el ledger ni rutas de documentos.';
comment on function public.portal_set_identity_photo(text) is
  'SDD-0435: registra la primera foto gratis o reemplaza la existente consumiendo cupo, siempre self-scope y con auditoría.';
