-- SDD-0227 · pago gobernado de cruce en Financiero China.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.supplier_claim_offsets') is null
     or to_regclass('public.user_tenants') is null
     or to_regclass('public.entity_audit_log') is null
     or to_regprocedure(
       'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
     ) is null then
    raise exception '0317 requiere Financiero China y el writer AUD-01';
  end if;
  if to_regprocedure(
    'public.mark_claim_offset_paid_in_china_governed(uuid,date,text,text)'
  ) is not null
     or to_regprocedure('public.guard_claim_offset_paid_in_china()') is not null then
    raise exception '0317 abortado: contrato de pago ya existe';
  end if;
end;
$preflight$;

insert into public.audit_entity_types (
  entity_type, status, domain_code, contract_version, introduced_by_ref
)
values ('supplier_claim_offset', 'active', 'finance', 1, 'migration:0317')
on conflict (entity_type) do update
set status = excluded.status,
    domain_code = excluded.domain_code,
    contract_version = greatest(
      public.audit_entity_types.contract_version,
      excluded.contract_version
    );

create unique index entity_audit_partner_claim_payment_request_uidx
  on public.entity_audit_log (
    tenant_id,
    event_type,
    ((payload ->> 'request_ref'))
  )
  where event_type = 'partner_claim_paid_in_china'
    and payload ? 'request_ref';

create function public.guard_claim_offset_paid_in_china()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request_ref text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting('dtd.partner_claim_payment', true)
    ),
    ''
  );
begin
  if old.status = 'reconocido_proveedor'
     and new.status = 'pagado_en_china' then
    if v_request_ref is null then
      raise exception 'partner finance: el pago requiere el RPC gobernado'
        using errcode = '42501';
    end if;
    if (to_jsonb(old) - array['status','received_in_china_on'])
       is distinct from
       (to_jsonb(new) - array['status','received_in_china_on']) then
      raise exception 'partner finance: el pago no puede alterar el cruce'
        using errcode = '22023';
    end if;
  end if;
  return new;
end;
$function$;

alter function public.guard_claim_offset_paid_in_china() owner to postgres;
revoke all on function public.guard_claim_offset_paid_in_china()
  from public, anon, authenticated, service_role;

create trigger guard_claim_offset_paid_in_china_trg
before update on public.supplier_claim_offsets
for each row execute function public.guard_claim_offset_paid_in_china();

create function public.mark_claim_offset_paid_in_china_governed(
  p_claim_id uuid,
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
  v_has_admin boolean;
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_request_ref text := nullif(pg_catalog.btrim(p_request_ref), '');
  v_claim public.supplier_claim_offsets%rowtype;
  v_existing public.entity_audit_log%rowtype;
  v_correlation text;
begin
  if v_actor is null then
    raise exception 'partner finance: autenticación requerida'
      using errcode = '42501';
  end if;
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'partner finance: motivo inválido'
      using errcode = '22023';
  end if;
  if p_effective_date is null or p_effective_date > current_date then
    raise exception 'partner finance: fecha efectiva inválida'
      using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'partner finance: referencia inválida'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = v_actor
      and ut.role = 'admin'
      and ut.disabled_at is null
  ) into v_has_admin;

  if not v_has_admin then
    raise exception 'partner finance: permiso insuficiente'
      using errcode = '42501';
  end if;

  select c.* into v_claim
  from public.supplier_claim_offsets c
  join public.user_tenants ut
    on ut.tenant_id = c.tenant_id
   and ut.user_id = v_actor
   and ut.role = 'admin'
   and ut.disabled_at is null
  where c.id = p_claim_id
    and c.deleted_at is null
  for update of c;

  if not found then
    raise exception 'partner finance: cruce no disponible'
      using errcode = 'P0002';
  end if;
  v_tenant := v_claim.tenant_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'partner-claim-payment:' || v_tenant::text || ':' || v_request_ref,
      227
    )
  );

  select * into v_existing
  from public.entity_audit_log l
  where l.tenant_id = v_tenant
    and l.event_type = 'partner_claim_paid_in_china'
    and l.payload ->> 'request_ref' = v_request_ref
  limit 1;

  if found then
    if v_existing.entity_id = p_claim_id
       and v_existing.reason = v_reason
       and v_existing.payload ->> 'effective_date' = p_effective_date::text then
      return 'replayed';
    end if;
    raise exception 'partner finance: referencia reutilizada'
      using errcode = '40001';
  end if;

  if v_claim.status <> 'reconocido_proveedor' then
    raise exception 'partner finance: conflicto de estado'
      using errcode = '40001';
  end if;
  if p_effective_date < coalesce(v_claim.recognized_on, v_claim.claimed_on) then
    raise exception 'partner finance: fecha anterior al reconocimiento'
      using errcode = '22023';
  end if;

  v_correlation := pg_catalog.concat(
    'partner-claim-payment:', p_claim_id::text, ':', v_request_ref
  );
  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);
  perform pg_catalog.set_config(
    'dtd.partner_claim_payment',
    v_request_ref,
    true
  );

  update public.supplier_claim_offsets
  set status = 'pagado_en_china',
      received_in_china_on = p_effective_date
  where id = p_claim_id
    and tenant_id = v_tenant
    and status = 'reconocido_proveedor'
    and deleted_at is null;
  if not found then
    raise exception 'partner finance: conflicto al registrar el pago'
      using errcode = '40001';
  end if;

  perform public.append_audit_event(
    v_tenant,
    'supplier_claim_offset',
    p_claim_id,
    'user',
    v_actor,
    'partner_claim_paid_in_china',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'status', v_claim.status,
      'received_in_china_on', v_claim.received_in_china_on
    ),
    pg_catalog.jsonb_build_object(
      'status', 'pagado_en_china',
      'received_in_china_on', p_effective_date
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'effective_date', p_effective_date,
      'supplier_id', v_claim.supplier_id,
      'amount_usd', v_claim.amount_usd,
      'from', v_claim.status,
      'to', 'pagado_en_china'
    ),
    v_correlation,
    1,
    'restricted'
  );

  return 'transitioned';
end;
$function$;

alter function public.mark_claim_offset_paid_in_china_governed(
  uuid, date, text, text
) owner to postgres;
revoke all on function public.mark_claim_offset_paid_in_china_governed(
  uuid, date, text, text
) from public, anon, service_role;
grant execute on function public.mark_claim_offset_paid_in_china_governed(
  uuid, date, text, text
) to authenticated;

comment on function public.mark_claim_offset_paid_in_china_governed(
  uuid, date, text, text
) is
  'SDD-0227: transición R3 reconocido_proveedor→pagado_en_china con admin, tenant, lock, idempotencia y AUD-01 atómicos.';
