-- SDD-0232 · autorización gobernada de consolidación Naviera.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.consolidations') is null
     or to_regclass('public.user_tenants') is null
     or to_regclass('public.entity_audit_log') is null
     or to_regclass('public.audit_entity_types') is null
     or to_regprocedure('public.next_consolidation_ref(uuid)') is null
     or to_regprocedure(
       'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
     ) is null then
    raise exception '0322 requiere Naviera, membresías y el writer AUD-01';
  end if;
  if to_regprocedure(
       'public.authorize_consolidation_governed(uuid,text,text)'
     ) is not null
     or to_regprocedure(
       'public.guard_consolidation_authorization()'
     ) is not null then
    raise exception '0322 abortado: contrato de autorización ya existe';
  end if;
end;
$preflight$;

insert into public.audit_entity_types (
  entity_type, status, domain_code, contract_version, introduced_by_ref
)
values ('consolidation', 'active', 'logistics', 1, 'migration:0322')
on conflict (entity_type) do update
set status = excluded.status,
    domain_code = excluded.domain_code,
    contract_version = greatest(
      public.audit_entity_types.contract_version,
      excluded.contract_version
    );

create unique index entity_audit_consolidation_authorization_request_uidx
  on public.entity_audit_log (
    tenant_id,
    event_type,
    ((payload ->> 'request_ref'))
  )
  where event_type = 'consolidation_authorized'
    and payload ? 'request_ref';

create function public.guard_consolidation_authorization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request_ref text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting('dtd.consolidation_authorization', true)
    ),
    ''
  );
  v_consolidation_id text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting('dtd.consolidation_authorization_id', true)
    ),
    ''
  );
begin
  if old.status = 'solicitada' and new.status = 'consolidando' then
    if v_request_ref is null
       or v_consolidation_id is distinct from new.id::text then
      raise exception 'naviera: autorizar requiere el RPC gobernado'
        using errcode = '42501';
    end if;
    if (to_jsonb(old) - array[
      'ref','status','authorized_by','authorized_at','updated_at'
    ]) is distinct from (to_jsonb(new) - array[
      'ref','status','authorized_by','authorized_at','updated_at'
    ]) then
      raise exception 'naviera: la autorización no puede alterar la solicitud'
        using errcode = '22023';
    end if;
    if new.ref is null
       or new.authorized_by is null
       or new.authorized_at is null then
      raise exception 'naviera: autorización incompleta'
        using errcode = '23514';
    end if;
  elsif new.ref is distinct from old.ref
     or new.authorized_by is distinct from old.authorized_by
     or new.authorized_at is distinct from old.authorized_at then
    raise exception 'naviera: correlativo y evidencia de autorización son inmutables'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

alter function public.guard_consolidation_authorization() owner to postgres;
revoke all on function public.guard_consolidation_authorization()
  from public, anon, authenticated, service_role;

create trigger guard_consolidation_authorization_trg
before update on public.consolidations
for each row execute function public.guard_consolidation_authorization();

create function public.authorize_consolidation_governed(
  p_consolidation_id uuid,
  p_reason text,
  p_request_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_request_ref text := nullif(pg_catalog.btrim(p_request_ref), '');
  v_consolidation public.consolidations%rowtype;
  v_existing public.entity_audit_log%rowtype;
  v_ref text;
  v_attempt integer;
  v_correlation text;
begin
  if v_actor is null then
    raise exception 'naviera: autenticación requerida'
      using errcode = '42501';
  end if;
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'naviera: motivo inválido'
      using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'naviera: referencia inválida'
      using errcode = '22023';
  end if;

  select c.* into v_consolidation
  from public.consolidations c
  join public.user_tenants ut
    on ut.tenant_id = c.tenant_id
   and ut.user_id = v_actor
   and ut.role in ('admin', 'operations', 'accounting')
   and ut.disabled_at is null
  where c.id = p_consolidation_id
    and c.deleted_at is null
  for update of c;
  if not found then
    raise exception 'naviera: solicitud no disponible'
      using errcode = 'P0002';
  end if;
  v_tenant := v_consolidation.tenant_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'consolidation-authorization:' || v_tenant::text || ':' || v_request_ref,
      232
    )
  );

  select * into v_existing
  from public.entity_audit_log l
  where l.tenant_id = v_tenant
    and l.event_type = 'consolidation_authorized'
    and l.payload ->> 'request_ref' = v_request_ref
  limit 1;

  if found then
    if v_existing.entity_id = p_consolidation_id
       and v_existing.reason = v_reason then
      return pg_catalog.jsonb_build_object(
        'outcome', 'replayed',
        'ref', v_existing.payload ->> 'consolidation_ref',
        'requested_by_operario_id', v_consolidation.requested_by_operario_id,
        'container_type', v_consolidation.container_type
      );
    end if;
    raise exception 'naviera: referencia reutilizada'
      using errcode = '40001';
  end if;

  if v_consolidation.status <> 'solicitada' then
    raise exception 'naviera: conflicto de estado'
      using errcode = '40001';
  end if;
  if v_consolidation.ref is not null
     or v_consolidation.authorized_by is not null
     or v_consolidation.authorized_at is not null then
    raise exception 'naviera: solicitud ya contiene evidencia de autorización'
      using errcode = '40001';
  end if;

  perform pg_catalog.set_config(
    'dtd.consolidation_authorization', v_request_ref, true
  );
  perform pg_catalog.set_config(
    'dtd.consolidation_authorization_id', p_consolidation_id::text, true
  );

  for v_attempt in 1..3 loop
    begin
      v_ref := public.next_consolidation_ref(v_tenant);
      update public.consolidations
      set ref = v_ref,
          status = 'consolidando',
          authorized_by = v_actor,
          authorized_at = pg_catalog.clock_timestamp()
      where id = p_consolidation_id
        and tenant_id = v_tenant
        and status = 'solicitada'
        and ref is null
        and authorized_by is null
        and authorized_at is null;
      if not found then
        raise exception 'naviera: conflicto al autorizar'
          using errcode = '40001';
      end if;
      exit;
    exception when unique_violation then
      if v_attempt = 3 then
        raise exception 'naviera: no se pudo reservar el correlativo'
          using errcode = '40001';
      end if;
    end;
  end loop;

  v_correlation := pg_catalog.concat(
    'consolidation-authorization:', p_consolidation_id::text, ':', v_request_ref
  );
  perform public.append_audit_event(
    v_tenant,
    'consolidation',
    p_consolidation_id,
    'user',
    v_actor,
    'consolidation_authorized',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'status', v_consolidation.status,
      'ref', v_consolidation.ref,
      'authorized_by', v_consolidation.authorized_by,
      'authorized_at', v_consolidation.authorized_at
    ),
    pg_catalog.jsonb_build_object(
      'status', 'consolidando',
      'ref', v_ref,
      'authorized_by', v_actor,
      'authorized_at', pg_catalog.clock_timestamp()
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'consolidation_ref', v_ref,
      'requested_by_operario_id', v_consolidation.requested_by_operario_id,
      'container_type', v_consolidation.container_type,
      'from', 'solicitada',
      'to', 'consolidando'
    ),
    v_correlation,
    1,
    'restricted'
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'transitioned',
    'ref', v_ref,
    'requested_by_operario_id', v_consolidation.requested_by_operario_id,
    'container_type', v_consolidation.container_type
  );
end;
$function$;

alter function public.authorize_consolidation_governed(uuid, text, text)
  owner to postgres;
revoke all on function public.authorize_consolidation_governed(uuid, text, text)
  from public, anon, service_role;
grant execute on function public.authorize_consolidation_governed(uuid, text, text)
  to authenticated;

comment on function public.authorize_consolidation_governed(uuid, text, text) is
  'SDD-0232: autorización R3 de consolidación con rol, tenant, correlativo, idempotencia y AUD-01 atómicos.';
