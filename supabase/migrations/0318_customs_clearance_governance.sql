-- SDD-0228 · liberación gobernada de Aduana SENIAT.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.customs_filings') is null
     or to_regclass('public.customs_documents') is null
     or to_regclass('public.shipments') is null
     or to_regclass('public.shipment_events') is null
     or to_regclass('public.user_tenants') is null
     or to_regclass('public.entity_audit_log') is null
     or to_regprocedure(
       'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
     ) is null then
    raise exception '0318 requiere Aduana SENIAT, Shipments y el writer AUD-01';
  end if;
  if to_regprocedure(
    'public.clear_customs_filing_governed(uuid,date,text,text)'
  ) is not null
     or to_regprocedure('public.guard_customs_filing_clearance()') is not null then
    raise exception '0318 abortado: contrato de liberación ya existe';
  end if;
end;
$preflight$;

insert into public.audit_entity_types (
  entity_type, status, domain_code, contract_version, introduced_by_ref
)
values ('customs_filing', 'active', 'customs', 1, 'migration:0318')
on conflict (entity_type) do update
set status = excluded.status,
    domain_code = excluded.domain_code,
    contract_version = greatest(
      public.audit_entity_types.contract_version,
      excluded.contract_version
    );

create unique index entity_audit_customs_clearance_request_uidx
  on public.entity_audit_log (
    tenant_id,
    event_type,
    ((payload ->> 'request_ref'))
  )
  where event_type = 'customs_filing_cleared'
    and payload ? 'request_ref';

create function public.guard_customs_filing_clearance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request_ref text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting('dtd.customs_clearance', true)
    ),
    ''
  );
  v_filing_id text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting('dtd.customs_clearance_filing', true)
    ),
    ''
  );
begin
  if old.status = 'liberado'::public.customs_status
     and (
       new.status is distinct from old.status
       or new.cleared_at is distinct from old.cleared_at
     ) then
    raise exception 'customs: la liberación es un hito terminal e inmutable'
      using errcode = '42501';
  end if;
  if old.status is distinct from new.status
     and new.status = 'liberado'::public.customs_status then
    if v_request_ref is null or v_filing_id is distinct from new.id::text then
      raise exception 'customs: la liberación requiere el RPC gobernado'
        using errcode = '42501';
    end if;
    if (to_jsonb(old) - array['status','cleared_at','alert','updated_at'])
       is distinct from
       (to_jsonb(new) - array['status','cleared_at','alert','updated_at']) then
      raise exception 'customs: la liberación no puede alterar el trámite'
        using errcode = '22023';
    end if;
  end if;
  return new;
end;
$function$;

alter function public.guard_customs_filing_clearance() owner to postgres;
revoke all on function public.guard_customs_filing_clearance()
  from public, anon, authenticated, service_role;

create trigger guard_customs_filing_clearance_trg
before update on public.customs_filings
for each row execute function public.guard_customs_filing_clearance();

create function public.clear_customs_filing_governed(
  p_filing_id uuid,
  p_effective_date date,
  p_reason text,
  p_request_ref text
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_has_role boolean;
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_request_ref text := nullif(pg_catalog.btrim(p_request_ref), '');
  v_filing public.customs_filings%rowtype;
  v_shipment public.shipments%rowtype;
  v_existing public.entity_audit_log%rowtype;
  v_required_count integer;
  v_required_ready boolean;
  v_correlation text;
begin
  if v_actor is null then
    raise exception 'customs: autenticación requerida'
      using errcode = '42501';
  end if;
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'customs: motivo inválido'
      using errcode = '22023';
  end if;
  if p_effective_date is null or p_effective_date > current_date then
    raise exception 'customs: fecha efectiva inválida'
      using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'customs: referencia inválida'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = v_actor
      and ut.role in ('admin', 'operations', 'accounting')
      and ut.disabled_at is null
  ) into v_has_role;

  if not v_has_role then
    raise exception 'customs: permiso insuficiente'
      using errcode = '42501';
  end if;

  select f.* into v_filing
  from public.customs_filings f
  join public.user_tenants ut
    on ut.tenant_id = f.tenant_id
   and ut.user_id = v_actor
   and ut.role in ('admin', 'operations', 'accounting')
   and ut.disabled_at is null
  where f.id = p_filing_id
    and f.deleted_at is null
  for update of f;

  if not found then
    raise exception 'customs: trámite no disponible'
      using errcode = 'P0002';
  end if;
  v_tenant := v_filing.tenant_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'customs-clearance:' || v_tenant::text || ':' || v_request_ref,
      228
    )
  );

  select * into v_existing
  from public.entity_audit_log l
  where l.tenant_id = v_tenant
    and l.event_type = 'customs_filing_cleared'
    and l.payload ->> 'request_ref' = v_request_ref
  limit 1;

  if found then
    if v_existing.entity_id = p_filing_id
       and v_existing.reason = v_reason
       and v_existing.payload ->> 'effective_date' = p_effective_date::text then
      return 'replayed';
    end if;
    raise exception 'customs: referencia reutilizada'
      using errcode = '40001';
  end if;

  if v_filing.status <> 'pagado'::public.customs_status then
    raise exception 'customs: conflicto de estado'
      using errcode = '40001';
  end if;
  if p_effective_date < v_filing.arrived_at then
    raise exception 'customs: fecha anterior al arribo'
      using errcode = '22023';
  end if;

  select s.* into v_shipment
  from public.shipments s
  where s.id = v_filing.shipment_id
    and s.tenant_id = v_tenant
    and s.deleted_at is null
  for update;
  if not found or v_shipment.status <> 'in_customs'::public.shipment_status then
    raise exception 'customs: conflicto del shipment'
      using errcode = '40001';
  end if;

  perform 1
  from public.customs_documents d
  where d.tenant_id = v_tenant
    and d.filing_id = p_filing_id
    and d.doc_type in (
      'commercial'::public.customs_doc_type,
      'packing'::public.customs_doc_type,
      'bl'::public.customs_doc_type,
      'cert_origin'::public.customs_doc_type,
      'dua'::public.customs_doc_type,
      'payment'::public.customs_doc_type
    )
  for update;

  select count(*), coalesce(bool_and(d.uploaded), false)
  into v_required_count, v_required_ready
  from public.customs_documents d
  where d.tenant_id = v_tenant
    and d.filing_id = p_filing_id
    and d.doc_type in (
      'commercial'::public.customs_doc_type,
      'packing'::public.customs_doc_type,
      'bl'::public.customs_doc_type,
      'cert_origin'::public.customs_doc_type,
      'dua'::public.customs_doc_type,
      'payment'::public.customs_doc_type
    );

  if v_required_count <> 6 or not v_required_ready then
    raise exception 'customs: documentos obligatorios incompletos'
      using errcode = '22023';
  end if;

  v_correlation := pg_catalog.concat(
    'customs-clearance:', p_filing_id::text, ':', v_request_ref
  );
  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);
  perform pg_catalog.set_config('dtd.customs_clearance', v_request_ref, true);
  perform pg_catalog.set_config(
    'dtd.customs_clearance_filing',
    p_filing_id::text,
    true
  );

  update public.customs_filings
  set status = 'liberado',
      cleared_at = p_effective_date,
      alert = null
  where id = p_filing_id
    and tenant_id = v_tenant
    and status = 'pagado'
    and deleted_at is null;
  if not found then
    raise exception 'customs: conflicto al liberar el trámite'
      using errcode = '40001';
  end if;

  update public.shipments
  set status = 'arrived_destination'
  where id = v_shipment.id
    and tenant_id = v_tenant
    and status = 'in_customs'
    and deleted_at is null;
  if not found then
    raise exception 'customs: conflicto al mover el shipment'
      using errcode = '40001';
  end if;

  insert into public.shipment_events (
    tenant_id, shipment_id, status, note, created_by
  ) values (
    v_tenant,
    v_shipment.id,
    'arrived_destination',
    'Liberación SENIAT confirmada · DUA ' || v_filing.dua_code,
    v_actor
  );

  perform public.append_audit_event(
    v_tenant,
    'customs_filing',
    p_filing_id,
    'user',
    v_actor,
    'customs_filing_cleared',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'status', v_filing.status,
      'cleared_at', v_filing.cleared_at,
      'shipment_status', v_shipment.status
    ),
    pg_catalog.jsonb_build_object(
      'status', 'liberado',
      'cleared_at', p_effective_date,
      'shipment_status', 'arrived_destination'
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'effective_date', p_effective_date,
      'shipment_id', v_shipment.id,
      'dua_code', v_filing.dua_code,
      'required_documents', 6,
      'from', v_filing.status,
      'to', 'liberado'
    ),
    v_correlation,
    1,
    'restricted'
  );

  return 'transitioned';
end;
$function$;

alter function public.clear_customs_filing_governed(
  uuid, date, text, text
) owner to postgres;
revoke all on function public.clear_customs_filing_governed(
  uuid, date, text, text
) from public, anon, service_role;
grant execute on function public.clear_customs_filing_governed(
  uuid, date, text, text
) to authenticated;

comment on function public.clear_customs_filing_governed(
  uuid, date, text, text
) is
  'SDD-0228: transición R3 pagado→liberado con rol, tenant, locks, documentos, shipment, idempotencia y AUD-01 atómicos.';
