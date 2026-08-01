-- SDD-0229 · pago gobernado de indemnización de Reclamos.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.client_claims') is null
     or to_regclass('public.client_claim_financials') is null
     or to_regclass('public.accounts') is null
     or to_regclass('public.journal_entries') is null
     or to_regclass('public.journal_lines') is null
     or to_regclass('public.accounting_settings') is null
     or to_regclass('public.user_tenants') is null
     or to_regclass('public.entity_audit_log') is null
     or to_regprocedure('public.next_entry_code(uuid)') is null
     or to_regprocedure(
       'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
     ) is null then
    raise exception '0319 requiere Reclamos, Contabilidad y el writer AUD-01';
  end if;
  if to_regprocedure(
    'public.pay_claim_indemnity_governed(uuid,text,date,text,text)'
  ) is not null
     or to_regprocedure('public.guard_claim_indemnity_payment()') is not null
     or to_regprocedure('public.guard_paid_claim_financials()') is not null then
    raise exception '0319 abortado: contrato de pago ya existe';
  end if;
end;
$preflight$;

insert into public.audit_entity_types (
  entity_type, status, domain_code, contract_version, introduced_by_ref
)
values ('client_claim', 'active', 'claims', 1, 'migration:0319')
on conflict (entity_type) do update
set status = excluded.status,
    domain_code = excluded.domain_code,
    contract_version = greatest(
      public.audit_entity_types.contract_version,
      excluded.contract_version
    );

create unique index entity_audit_claim_payment_request_uidx
  on public.entity_audit_log (
    tenant_id,
    event_type,
    ((payload ->> 'request_ref'))
  )
  where event_type = 'client_claim_indemnity_paid'
    and payload ? 'request_ref';

-- Corrige el gate legacy: rol y membresía se resuelven para el tenant de la
-- fila, no mediante un `limit 1` global del usuario.
create or replace function public.client_claims_guard_pago()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status = 'pagado'
     and (tg_op = 'INSERT' or old.status is distinct from 'pagado') then
    if not exists (
      select 1
      from public.user_tenants ut
      where ut.user_id = auth.uid()
        and ut.tenant_id = new.tenant_id
        and ut.role in ('accounting', 'admin')
        and ut.disabled_at is null
    ) then
      raise exception 'claims: sólo Contabilidad puede declarar el pago'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

alter function public.client_claims_guard_pago() owner to postgres;
revoke all on function public.client_claims_guard_pago()
  from public, anon, authenticated, service_role;

create function public.guard_claim_indemnity_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request_ref text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting('dtd.claim_indemnity_payment', true)
    ),
    ''
  );
  v_claim_id text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting('dtd.claim_indemnity_payment_claim', true)
    ),
    ''
  );
begin
  if old.status = 'pagado'
     and (
       new.status is distinct from old.status
       or new.amount_usd is distinct from old.amount_usd
       or new.resolution_note is distinct from old.resolution_note
       or new.resolved_at is distinct from old.resolved_at
       or new.deleted_at is distinct from old.deleted_at
     ) then
    raise exception 'claims: el pago es un hito terminal e inmutable'
      using errcode = '42501';
  end if;
  if old.status is distinct from new.status and new.status = 'pagado' then
    if v_request_ref is null or v_claim_id is distinct from new.id::text then
      raise exception 'claims: el pago requiere el RPC gobernado'
        using errcode = '42501';
    end if;
    if (to_jsonb(old) - array[
      'status','resolution_note','resolved_at','updated_at'
    ]) is distinct from (to_jsonb(new) - array[
      'status','resolution_note','resolved_at','updated_at'
    ]) then
      raise exception 'claims: el pago no puede alterar el reclamo'
        using errcode = '22023';
    end if;
  end if;
  return new;
end;
$function$;

alter function public.guard_claim_indemnity_payment() owner to postgres;
revoke all on function public.guard_claim_indemnity_payment()
  from public, anon, authenticated, service_role;

create trigger guard_claim_indemnity_payment_trg
before update on public.client_claims
for each row execute function public.guard_claim_indemnity_payment();

create function public.guard_paid_claim_financials()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_claim_id uuid := case when tg_op = 'DELETE' then old.claim_id else new.claim_id end;
  v_status text;
begin
  perform 1
  from public.client_claims c
  where c.id = v_claim_id
  for key share;

  select c.status into v_status
  from public.client_claims c
  where c.id = v_claim_id;
  if v_status = 'pagado' then
    raise exception 'claims: la resolución financiera pagada es inmutable'
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

alter function public.guard_paid_claim_financials() owner to postgres;
revoke all on function public.guard_paid_claim_financials()
  from public, anon, authenticated, service_role;

create trigger guard_paid_claim_financials_trg
before insert or update or delete on public.client_claim_financials
for each row execute function public.guard_paid_claim_financials();

create function public.pay_claim_indemnity_governed(
  p_claim_id uuid,
  p_payment_method text,
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
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_request_ref text := nullif(pg_catalog.btrim(p_request_ref), '');
  v_method text := nullif(pg_catalog.btrim(p_payment_method), '');
  v_claim public.client_claims%rowtype;
  v_existing public.entity_audit_log%rowtype;
  v_stored_method text := 'transfer';
  v_cash_code text;
  v_indemnity_account uuid;
  v_cash_account uuid;
  v_entry_id uuid;
  v_entry_code text;
  v_closing_date date;
  v_attempt integer;
  v_correlation text;
begin
  if v_actor is null then
    raise exception 'claims: autenticación requerida'
      using errcode = '42501';
  end if;
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'claims: motivo inválido'
      using errcode = '22023';
  end if;
  if p_effective_date is null or p_effective_date > current_date then
    raise exception 'claims: fecha efectiva inválida'
      using errcode = '22023';
  end if;
  if v_method not in ('cash', 'transfer', 'usdt') then
    raise exception 'claims: medio de pago inválido'
      using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'claims: referencia inválida'
      using errcode = '22023';
  end if;

  select c.* into v_claim
  from public.client_claims c
  join public.user_tenants ut
    on ut.tenant_id = c.tenant_id
   and ut.user_id = v_actor
   and ut.role in ('accounting', 'admin')
   and ut.disabled_at is null
  where c.id = p_claim_id
    and c.deleted_at is null
  for update of c;

  if not found then
    raise exception 'claims: reclamo no disponible'
      using errcode = 'P0002';
  end if;
  v_tenant := v_claim.tenant_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'claim-indemnity-payment:' || v_tenant::text || ':' || v_request_ref,
      229
    )
  );

  select * into v_existing
  from public.entity_audit_log l
  where l.tenant_id = v_tenant
    and l.event_type = 'client_claim_indemnity_paid'
    and l.payload ->> 'request_ref' = v_request_ref
  limit 1;

  if found then
    if v_existing.entity_id = p_claim_id
       and v_existing.reason = v_reason
       and v_existing.payload ->> 'effective_date' = p_effective_date::text
       and v_existing.payload ->> 'payment_method' = v_method then
      return 'replayed';
    end if;
    raise exception 'claims: referencia reutilizada'
      using errcode = '40001';
  end if;

  if v_claim.status <> 'aprobado' then
    raise exception 'claims: conflicto de estado'
      using errcode = '40001';
  end if;
  if v_claim.amount_usd <= 0 then
    raise exception 'claims: indemnización sin monto positivo'
      using errcode = '22023';
  end if;
  if p_effective_date < v_claim.created_at::date then
    raise exception 'claims: fecha anterior al reclamo'
      using errcode = '22023';
  end if;

  select f.payment_method into v_stored_method
  from public.client_claim_financials f
  where f.claim_id = p_claim_id
    and f.tenant_id = v_tenant
  for update;
  if not found then
    v_stored_method := 'transfer';
  end if;
  if v_stored_method is distinct from v_method then
    raise exception 'claims: el medio de pago cambió'
      using errcode = '40001';
  end if;

  select s.closing_date into v_closing_date
  from public.accounting_settings s
  where s.tenant_id = v_tenant;
  if v_closing_date is not null and p_effective_date <= v_closing_date then
    raise exception 'claims: período contable cerrado'
      using errcode = '23514';
  end if;

  v_cash_code := case v_method
    when 'cash' then '1.1.1.1'
    when 'usdt' then '1.1.1.3'
    else '1.1.1.2'
  end;

  select a.id into v_indemnity_account
  from public.accounts a
  where a.tenant_id = v_tenant
    and a.code = '6.20'
    and a.is_postable
  for share;
  select a.id into v_cash_account
  from public.accounts a
  where a.tenant_id = v_tenant
    and a.code = v_cash_code
    and a.is_postable
  for share;
  if v_indemnity_account is null or v_cash_account is null then
    raise exception 'claims: faltan cuentas contables del pago'
      using errcode = '55000';
  end if;

  if exists (
    select 1 from public.journal_entries je
    where je.claim_id = p_claim_id
      and je.status = 'asentado'
      and je.deleted_at is null
  ) then
    raise exception 'claims: el reclamo ya tiene un asiento vivo'
      using errcode = '55000';
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);
  perform pg_catalog.set_config('dtd.claim_indemnity_payment', v_request_ref, true);
  perform pg_catalog.set_config(
    'dtd.claim_indemnity_payment_claim',
    p_claim_id::text,
    true
  );

  update public.client_claims
  set status = 'pagado',
      resolution_note = v_reason
  where id = p_claim_id
    and tenant_id = v_tenant
    and status = 'aprobado'
    and deleted_at is null;
  if not found then
    raise exception 'claims: conflicto al declarar el pago'
      using errcode = '40001';
  end if;

  for v_attempt in 1..3 loop
    begin
      v_entry_code := public.next_entry_code(v_tenant);
      insert into public.journal_entries (
        tenant_id, entry_code, entry_date, memo, status, source,
        claim_id, posted_at
      ) values (
        v_tenant,
        v_entry_code,
        p_effective_date,
        'Indemnización ' || v_claim.claim_code,
        'asentado',
        'claim',
        p_claim_id,
        pg_catalog.clock_timestamp()
      ) returning id into v_entry_id;
      exit;
    exception when unique_violation then
      if v_attempt = 3 then
        raise exception 'claims: no se pudo reservar el código del asiento'
          using errcode = '40001';
      end if;
    end;
  end loop;

  insert into public.journal_lines (
    entry_id, account_id, debit, credit, line_memo
  ) values
    (v_entry_id, v_indemnity_account, v_claim.amount_usd, 0, 'Indemnización al cliente'),
    (v_entry_id, v_cash_account, 0, v_claim.amount_usd, 'Salida de caja / banco');

  v_correlation := pg_catalog.concat(
    'claim-indemnity-payment:', p_claim_id::text, ':', v_request_ref
  );
  perform public.append_audit_event(
    v_tenant,
    'client_claim',
    p_claim_id,
    'user',
    v_actor,
    'client_claim_indemnity_paid',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'status', v_claim.status,
      'resolution_note', v_claim.resolution_note
    ),
    pg_catalog.jsonb_build_object(
      'status', 'pagado',
      'resolution_note', v_reason
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'effective_date', p_effective_date,
      'payment_method', v_method,
      'amount_usd', v_claim.amount_usd,
      'journal_entry_id', v_entry_id,
      'entry_code', v_entry_code,
      'from', v_claim.status,
      'to', 'pagado'
    ),
    v_correlation,
    1,
    'restricted'
  );

  return 'transitioned';
end;
$function$;

alter function public.pay_claim_indemnity_governed(
  uuid, text, date, text, text
) owner to postgres;
revoke all on function public.pay_claim_indemnity_governed(
  uuid, text, date, text, text
) from public, anon, service_role;
grant execute on function public.pay_claim_indemnity_governed(
  uuid, text, date, text, text
) to authenticated;

comment on function public.pay_claim_indemnity_governed(
  uuid, text, date, text, text
) is
  'SDD-0229: pago R3 de indemnización con rol, tenant, estado, período, asiento balanceado, idempotencia y AUD-01 atómicos.';
