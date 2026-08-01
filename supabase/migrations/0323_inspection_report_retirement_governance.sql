-- SDD-0233 · retiro gobernado de reportes de Inspecciones.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.inspection_reports') is null
     or to_regclass('public.inspection_report_photos') is null
     or to_regclass('public.user_tenants') is null
     or to_regclass('public.entity_audit_log') is null
     or to_regclass('public.audit_entity_types') is null
     or to_regprocedure(
       'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
     ) is null then
    raise exception '0323 requiere Inspecciones, membresías y el writer AUD-01';
  end if;
  if to_regprocedure(
       'public.retire_inspection_report_governed(uuid,text,text,text)'
     ) is not null
     or to_regprocedure('public.guard_inspection_report_retirement()') is not null then
    raise exception '0323 abortado: contrato de retiro ya existe';
  end if;
end;
$preflight$;

insert into public.audit_entity_types (
  entity_type, status, domain_code, contract_version, introduced_by_ref
)
values ('inspection_report', 'active', 'inspections', 1, 'migration:0323')
on conflict (entity_type) do update
set status = excluded.status,
    domain_code = excluded.domain_code,
    contract_version = greatest(
      public.audit_entity_types.contract_version,
      excluded.contract_version
    );

create unique index entity_audit_inspection_retirement_request_uidx
  on public.entity_audit_log (
    tenant_id,
    event_type,
    ((payload ->> 'request_ref'))
  )
  where event_type = 'inspection_report_retired'
    and payload ? 'request_ref';

-- El producto nunca necesita hard-delete de estas tablas. El retiro de reporte
-- y el retiro individual de foto son soft-delete; service_role conserva su gate
-- operativo separado.
revoke delete on table public.inspection_reports from authenticated;
revoke delete on table public.inspection_report_photos from authenticated;

create function public.guard_inspection_report_retirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request_ref text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting('dtd.inspection_report_retirement', true)
    ),
    ''
  );
  v_report_id text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting('dtd.inspection_report_retirement_id', true)
    ),
    ''
  );
begin
  if old.deleted_at is null and new.deleted_at is not null then
    if v_request_ref is null or v_report_id is distinct from new.id::text then
      raise exception 'inspecciones: retirar requiere el RPC gobernado'
        using errcode = '42501';
    end if;
    if (to_jsonb(old) - array['deleted_at','updated_at'])
       is distinct from
       (to_jsonb(new) - array['deleted_at','updated_at']) then
      raise exception 'inspecciones: el retiro no puede alterar el reporte'
        using errcode = '22023';
    end if;
  elsif old.deleted_at is not null and to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception 'inspecciones: el retiro es un hito terminal e inmutable'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

alter function public.guard_inspection_report_retirement() owner to postgres;
revoke all on function public.guard_inspection_report_retirement()
  from public, anon, authenticated, service_role;

create trigger guard_inspection_report_retirement_trg
before update on public.inspection_reports
for each row execute function public.guard_inspection_report_retirement();

create function public.retire_inspection_report_governed(
  p_report_id uuid,
  p_expected_status text,
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
  v_report public.inspection_reports%rowtype;
  v_existing public.entity_audit_log%rowtype;
  v_retired_at timestamptz := pg_catalog.clock_timestamp();
  v_photo_count integer := 0;
  v_correlation text;
begin
  if v_actor is null then
    raise exception 'inspecciones: autenticación requerida'
      using errcode = '42501';
  end if;
  if p_expected_status not in ('draft', 'final') then
    raise exception 'inspecciones: estado esperado inválido'
      using errcode = '22023';
  end if;
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'inspecciones: motivo inválido'
      using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'inspecciones: referencia inválida'
      using errcode = '22023';
  end if;

  select r.* into v_report
  from public.inspection_reports r
  join public.user_tenants ut
    on ut.tenant_id = r.tenant_id
   and ut.user_id = v_actor
   and ut.role in ('admin', 'operations', 'commercial')
   and ut.disabled_at is null
  where r.id = p_report_id
  for update of r;
  if not found then
    raise exception 'inspecciones: reporte no disponible'
      using errcode = 'P0002';
  end if;
  v_tenant := v_report.tenant_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'inspection-report-retirement:' || v_tenant::text || ':' || v_request_ref,
      233
    )
  );

  select * into v_existing
  from public.entity_audit_log l
  where l.tenant_id = v_tenant
    and l.event_type = 'inspection_report_retired'
    and l.payload ->> 'request_ref' = v_request_ref
  limit 1;
  if found then
    if v_existing.entity_id = p_report_id
       and v_existing.reason = v_reason
       and v_existing.payload ->> 'from_status' = p_expected_status then
      return pg_catalog.jsonb_build_object(
        'outcome', 'replayed',
        'report_no', v_existing.payload ->> 'report_no',
        'photo_count', (v_existing.payload ->> 'photo_count')::integer,
        'storage_disposition', 'retained_private_objects'
      );
    end if;
    raise exception 'inspecciones: referencia reutilizada'
      using errcode = '40001';
  end if;

  if v_report.deleted_at is not null
     or v_report.status::text <> p_expected_status then
    raise exception 'inspecciones: conflicto de estado'
      using errcode = '40001';
  end if;

  select count(*)::integer into v_photo_count
  from public.inspection_report_photos p
  where p.report_id = p_report_id
    and p.tenant_id = v_tenant
    and p.deleted_at is null;

  perform pg_catalog.set_config(
    'dtd.inspection_report_retirement', v_request_ref, true
  );
  perform pg_catalog.set_config(
    'dtd.inspection_report_retirement_id', p_report_id::text, true
  );

  update public.inspection_reports
  set deleted_at = v_retired_at
  where id = p_report_id
    and tenant_id = v_tenant
    and deleted_at is null
    and status::text = p_expected_status;
  if not found then
    raise exception 'inspecciones: conflicto al retirar'
      using errcode = '40001';
  end if;

  update public.inspection_report_photos
  set deleted_at = v_retired_at
  where report_id = p_report_id
    and tenant_id = v_tenant
    and deleted_at is null;

  v_correlation := pg_catalog.concat(
    'inspection-report-retirement:', p_report_id::text, ':', v_request_ref
  );
  perform public.append_audit_event(
    v_tenant,
    'inspection_report',
    p_report_id,
    'user',
    v_actor,
    'inspection_report_retired',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'status', v_report.status,
      'deleted_at', v_report.deleted_at
    ),
    pg_catalog.jsonb_build_object(
      'status', v_report.status,
      'deleted_at', v_retired_at
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'report_no', v_report.report_no,
      'from_status', p_expected_status,
      'photo_count', v_photo_count,
      'photo_metadata_retired', true,
      'storage_disposition', 'retained_private_objects',
      'physical_objects_deleted', false
    ),
    v_correlation,
    1,
    'restricted'
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'transitioned',
    'report_no', v_report.report_no,
    'photo_count', v_photo_count,
    'storage_disposition', 'retained_private_objects'
  );
end;
$function$;

alter function public.retire_inspection_report_governed(uuid, text, text, text)
  owner to postgres;
revoke all on function public.retire_inspection_report_governed(uuid, text, text, text)
  from public, anon, service_role;
grant execute on function public.retire_inspection_report_governed(uuid, text, text, text)
  to authenticated;

comment on function public.retire_inspection_report_governed(uuid, text, text, text) is
  'SDD-0233: retiro R3 de reporte y metadata de fotos con rol, tenant, estado, idempotencia, retención honesta de Storage y AUD-01 atómicos.';
