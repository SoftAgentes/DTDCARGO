-- SDD-0187 · D2 R3 · motivos humanos en anulaciones financieras.
--
-- El caller ya no puede sustituir el contexto humano por una frase fija. Cada
-- RPC valida el motivo, lo fija sólo para su transacción y ejecuta una única
-- mutación allowlisted. El trigger D2 conserva la atomicidad y el writer toma
-- ese contexto sin copiarlo al payload.

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_signature text;
begin
  if to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null then
    raise exception '0294 requiere append_audit_event de Corte B1';
  end if;

  if to_regprocedure(
    'public.append_audit_event_v1(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is not null then
    raise exception '0294 abortado: append_audit_event_v1 ya existe';
  end if;

  foreach v_signature in array array[
    'public.void_journal_entry_with_audit_reason(uuid,text)',
    'public.void_invoice_with_audit_reason(uuid,text)',
    'public.void_payment_receipt_with_audit_reason(uuid,text)',
    'public.void_supplier_bill_with_audit_reason(uuid,text)',
    'public.void_supplier_payment_with_audit_reason(uuid,text)'
  ] loop
    if to_regprocedure(v_signature) is not null then
      raise exception '0294 abortado: % ya existe', v_signature;
    end if;
  end loop;
end;
$preflight$;

alter function public.append_audit_event(
  uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text
) rename to append_audit_event_v1;

revoke all on function public.append_audit_event_v1(
  uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text
) from public, anon, authenticated, service_role;

create function public.append_audit_event(
  p_tenant_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_event_type text,
  p_source text,
  p_result text default 'succeeded',
  p_reason text default null,
  p_before_data jsonb default null,
  p_after_data jsonb default null,
  p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null,
  p_schema_version integer default 1,
  p_sensitivity text default 'internal'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_context_reason text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting('dtd.audit_reason', true)
    ),
    ''
  );
begin
  return public.append_audit_event_v1(
    p_tenant_id,
    p_entity_type,
    p_entity_id,
    p_actor_type,
    p_actor_id,
    p_event_type,
    p_source,
    p_result,
    coalesce(v_context_reason, p_reason),
    p_before_data,
    p_after_data,
    p_payload,
    p_correlation_id,
    p_schema_version,
    p_sensitivity
  );
end;
$function$;

alter function public.append_audit_event(
  uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text
) owner to postgres;

revoke all on function public.append_audit_event(
  uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text
) from public, anon, authenticated;
grant execute on function public.append_audit_event(
  uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text
) to service_role;

comment on function public.append_audit_event(
  uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text
) is
  'SDD-0187: wrapper append-only que prioriza motivo R3 transaccional validado; EXECUTE sólo service_role y owner.';

create function public.void_journal_entry_with_audit_reason(
  p_id uuid,
  p_reason text
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
begin
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres'
      using errcode = '22023';
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);

  update public.journal_entries
  set status = 'anulado'
  where id = p_id
    and status = 'asentado';

  return found;
end;
$function$;

create function public.void_invoice_with_audit_reason(
  p_id uuid,
  p_reason text
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
begin
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres'
      using errcode = '22023';
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);

  update public.invoices
  set status = 'anulada'
  where id = p_id
    and status <> 'pagada'
    and status <> 'anulada';

  return found;
end;
$function$;

create function public.void_payment_receipt_with_audit_reason(
  p_id uuid,
  p_reason text
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
begin
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres'
      using errcode = '22023';
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);

  update public.payment_receipts
  set deleted_at = pg_catalog.clock_timestamp()
  where id = p_id
    and deleted_at is null;

  return found;
end;
$function$;

create function public.void_supplier_bill_with_audit_reason(
  p_id uuid,
  p_reason text
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
begin
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres'
      using errcode = '22023';
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);

  update public.supplier_bills
  set status = 'anulada'
  where id = p_id
    and status <> 'anulada'
    and paid_amount = 0;

  return found;
end;
$function$;

create function public.void_supplier_payment_with_audit_reason(
  p_id uuid,
  p_reason text
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
begin
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres'
      using errcode = '22023';
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);

  update public.supplier_payments
  set deleted_at = pg_catalog.clock_timestamp()
  where id = p_id
    and deleted_at is null;

  return found;
end;
$function$;

alter function public.void_journal_entry_with_audit_reason(uuid,text)
  owner to postgres;
alter function public.void_invoice_with_audit_reason(uuid,text)
  owner to postgres;
alter function public.void_payment_receipt_with_audit_reason(uuid,text)
  owner to postgres;
alter function public.void_supplier_bill_with_audit_reason(uuid,text)
  owner to postgres;
alter function public.void_supplier_payment_with_audit_reason(uuid,text)
  owner to postgres;

revoke all on function public.void_journal_entry_with_audit_reason(uuid,text)
  from public, anon;
revoke all on function public.void_invoice_with_audit_reason(uuid,text)
  from public, anon;
revoke all on function public.void_payment_receipt_with_audit_reason(uuid,text)
  from public, anon;
revoke all on function public.void_supplier_bill_with_audit_reason(uuid,text)
  from public, anon;
revoke all on function public.void_supplier_payment_with_audit_reason(uuid,text)
  from public, anon;

grant execute on function public.void_journal_entry_with_audit_reason(uuid,text)
  to authenticated;
grant execute on function public.void_invoice_with_audit_reason(uuid,text)
  to authenticated;
grant execute on function public.void_payment_receipt_with_audit_reason(uuid,text)
  to authenticated;
grant execute on function public.void_supplier_bill_with_audit_reason(uuid,text)
  to authenticated;
grant execute on function public.void_supplier_payment_with_audit_reason(uuid,text)
  to authenticated;

do $postcondition$
begin
  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'void_journal_entry_with_audit_reason',
        'void_invoice_with_audit_reason',
        'void_payment_receipt_with_audit_reason',
        'void_supplier_bill_with_audit_reason',
        'void_supplier_payment_with_audit_reason'
      ])
      and not p.prosecdef
      and p.proconfig @> array['search_path=""']
  ) <> 5 then
    raise exception '0294: faltan RPC D2 security-invoker selladas';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'void_journal_entry_with_audit_reason',
        'void_invoice_with_audit_reason',
        'void_payment_receipt_with_audit_reason',
        'void_supplier_bill_with_audit_reason',
        'void_supplier_payment_with_audit_reason'
      ])
      and pg_catalog.has_function_privilege(
        'authenticated',
        p.oid,
        'EXECUTE'
      )
      and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
  ) <> 5 then
    raise exception '0294: ACL D2 inválida';
  end if;

  if pg_catalog.has_function_privilege(
    'service_role',
    'public.append_audit_event_v1(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)',
    'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'service_role',
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)',
    'EXECUTE'
  ) then
    raise exception '0294: ACL del writer wrapper inválida';
  end if;
end;
$postcondition$;

reset statement_timeout;
reset lock_timeout;
