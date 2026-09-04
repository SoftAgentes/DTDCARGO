-- ─────────────────────────────────────────────────────────────────────────────
-- SDD-0438 · Correctivo funcional posterior a la migración aplicada 0445.
--
-- 1. Cambiar la evidencia de identidad invalida cualquier verificación previa.
-- 2. El ledger vitalicio sigue al cliente superviviente durante merge_clients.
--
-- 0445 es historia aplicada y no se reescribe. Esta migración preserva la firma,
-- self-scope, SECURITY DEFINER, search_path vacío y grants estrechos de sus RPC.
-- NO aplicar a producción sin GO Cloud explícito nombrando 0446.
-- ─────────────────────────────────────────────────────────────────────────────

do $preflight$
declare
  v_client_columns integer;
begin
  if to_regclass('public.clients') is null
     or to_regclass('public.client_change_requests') is null
     or to_regclass('public.client_profile_edits') is null
     or to_regclass('storage.objects') is null
     or to_regprocedure('public.get_portal_client_id()') is null
     or to_regprocedure('public.portal_set_identity_photo(text)') is null
     or to_regprocedure(
       'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
     ) is null then
    raise exception '0446 requiere el contrato completo de 0445 y la auditoría canónica';
  end if;

  select pg_catalog.count(*)::integer
    into v_client_columns
  from pg_catalog.pg_attribute
  where attrelid = 'public.clients'::pg_catalog.regclass
    and attname = any (array[
      'merged_into_client_id',
      'doc_verify_status',
      'doc_verify_source',
      'doc_registry_name',
      'doc_verified_at',
      'doc_verified_by'
    ])
    and attnum > 0
    and not attisdropped;

  if v_client_columns <> 6 then
    raise exception '0446 abortado: clients no tiene el contrato de fusión/verificación esperado';
  end if;
end;
$preflight$;

-- Una reasignación de solicitud conserva el vínculo 1:1 con su asiento del
-- ledger. No se impone otra vez el máximo: merge_clients debe preservar toda la
-- historia de ambas fichas aunque la suma ya haya agotado el cupo.
create function public.portal_profile_edit_follow_request_reassignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_target_tenant_id uuid;
begin
  if old.client_id is not distinct from new.client_id then
    return new;
  end if;

  if old.tenant_id is distinct from new.tenant_id then
    raise exception 'profile_edit_request_tenant_change_forbidden'
      using errcode = '42501';
  end if;

  select client.tenant_id
    into v_target_tenant_id
  from public.clients as client
  where client.id = new.client_id
    and client.deleted_at is null
  for update;

  if not found
     or v_target_tenant_id is distinct from new.tenant_id then
    raise exception 'profile_edit_request_target_invalid'
      using errcode = '23503';
  end if;

  update public.client_profile_edits
  set client_id = new.client_id,
      tenant_id = new.tenant_id
  where request_id = new.id
    and client_id = old.client_id;

  return new;
end;
$function$;

alter function public.portal_profile_edit_follow_request_reassignment()
  owner to postgres;
revoke all on function public.portal_profile_edit_follow_request_reassignment()
  from public, anon, authenticated, service_role;

create trigger client_change_requests_profile_edit_reassignment
  after update of client_id on public.client_change_requests
  for each row
  when (old.client_id is distinct from new.client_id)
  execute function public.portal_profile_edit_follow_request_reassignment();

-- merge_clients deja la ficha retirada con merged_into_client_id. Ese es el
-- vínculo definitivo que permite mover, una sola vez, los asientos sin
-- request_id (reemplazos de foto) y las solicitudes pendientes que la fusión
-- conserva en la ficha retirada para revisión manual.
create function public.portal_profile_edits_follow_client_merge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_survivor_tenant_id uuid;
begin
  if new.merged_into_client_id is null
     or new.merged_into_client_id is not distinct from old.merged_into_client_id then
    return new;
  end if;

  if new.deleted_at is null
     or new.merged_into_client_id = new.id then
    raise exception 'profile_edit_merge_target_invalid'
      using errcode = '23514';
  end if;

  select survivor.tenant_id
    into v_survivor_tenant_id
  from public.clients as survivor
  where survivor.id = new.merged_into_client_id
    and survivor.deleted_at is null
  for update;

  if not found
     or v_survivor_tenant_id is distinct from new.tenant_id then
    raise exception 'profile_edit_merge_target_invalid'
      using errcode = '23514';
  end if;

  update public.client_profile_edits
  set client_id = new.merged_into_client_id,
      tenant_id = v_survivor_tenant_id
  where client_id = new.id;

  return new;
end;
$function$;

alter function public.portal_profile_edits_follow_client_merge()
  owner to postgres;
revoke all on function public.portal_profile_edits_follow_client_merge()
  from public, anon, authenticated, service_role;

create trigger clients_profile_edits_follow_merge
  after update of merged_into_client_id on public.clients
  for each row
  when (new.merged_into_client_id is distinct from old.merged_into_client_id)
  execute function public.portal_profile_edits_follow_client_merge();

-- Repara merges ocurridos después de aplicar 0445 y antes de este correctivo.
-- La cardinalidad no cambia: sólo se reasigna el dueño canónico del asiento.
do $backfill_guard$
begin
  if exists (
    select 1
    from public.client_profile_edits as edit
    join public.clients as retired on retired.id = edit.client_id
    join public.clients as survivor on survivor.id = retired.merged_into_client_id
    where retired.merged_into_client_id is not null
      and (
        retired.merged_into_client_id = retired.id
        or survivor.deleted_at is not null
        or survivor.tenant_id is distinct from retired.tenant_id
      )
  ) then
    raise exception '0446 abortado: merge histórico inválido en client_profile_edits';
  end if;
end;
$backfill_guard$;

update public.client_profile_edits as edit
set client_id = survivor.id,
    tenant_id = survivor.tenant_id
from public.clients as retired
join public.clients as survivor on survivor.id = retired.merged_into_client_id
where edit.client_id = retired.id
  and retired.merged_into_client_id is not null;

-- Mantiene el contrato público de 0445, pero invalida de forma atómica el
-- veredicto derivado cuando cambia la evidencia que lo sustentaba.
create or replace function public.portal_set_identity_photo(p_new_path text)
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
  v_had_verification boolean;
begin
  if v_actor_id is null or v_client_id is null then
    raise exception 'portal_session_required' using errcode = '42501';
  end if;

  select
    client.tenant_id,
    client.markbox,
    client.cedula_photo_path,
    (
      client.doc_verify_status is not null
      or client.doc_verify_source is not null
      or client.doc_registry_name is not null
      or client.doc_verified_at is not null
      or client.doc_verified_by is not null
    )
    into v_tenant_id, v_markbox, v_old_path, v_had_verification
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
  set cedula_photo_path = p_new_path,
      doc_verify_status = null,
      doc_verify_source = null,
      doc_registry_name = null,
      doc_verified_at = null,
      doc_verified_by = null
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
    pg_catalog.jsonb_build_object(
      'identity_photo_present', v_old_path is not null,
      'identity_verification_present', v_had_verification
    ),
    pg_catalog.jsonb_build_object(
      'identity_photo_present', true,
      'identity_verification_present', false
    ),
    pg_catalog.jsonb_build_object(
      'counted', v_ledger_id is not null,
      'ledger_id', v_ledger_id,
      'remaining_count', case when v_ledger_id is null
        then greatest(0, 3 - v_active_count)
        else greatest(0, 2 - v_active_count)
      end,
      'verification_invalidated', v_had_verification
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

comment on function public.portal_profile_edit_follow_request_reassignment() is
  'SDD-0438: mantiene el asiento 1:1 del ledger junto a una solicitud de cambio de perfil reasignada, sin exponer el ledger.';
comment on function public.portal_profile_edits_follow_client_merge() is
  'SDD-0438: reasigna atómicamente al cliente superviviente todos los asientos de cupo de una ficha retirada por merge_clients.';
comment on function public.portal_set_identity_photo(text) is
  'SDD-0435 + SDD-0438: registra o reemplaza la foto self-scope, consume cupo cuando aplica e invalida cualquier verificación basada en la evidencia anterior.';
