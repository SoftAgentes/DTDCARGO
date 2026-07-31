-- SDD-0174 · D2 · auditoría atómica del núcleo financiero.
--
-- Cada trigger pertenece exclusivamente a una tabla financiera allowlisted.
-- La mutación de fila y append_audit_event comparten la misma transacción:
-- si el evento falla, PostgreSQL revierte la mutación.

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_table text;
begin
  if to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null then
    raise exception '0290 requiere append_audit_event de Corte B1';
  end if;

  foreach v_table in array array[
    'accounts',
    'journal_entries',
    'invoices',
    'payment_receipts',
    'suppliers',
    'supplier_bills',
    'supplier_payments'
  ] loop
    if to_regclass('public.' || v_table) is null then
      raise exception '0290 requiere public.%', v_table;
    end if;
  end loop;

  if to_regprocedure('public.audit_d2_financial_change()') is not null then
    raise exception '0290 abortado: audit_d2_financial_change ya existe';
  end if;

  if exists (
    select 1
    from pg_trigger
    where tgname like 'audit_d2_%'
      and not tgisinternal
  ) then
    raise exception '0290 abortado: ya existe un trigger audit_d2_*';
  end if;
end;
$preflight$;

insert into public.audit_entity_types (
  entity_type,
  status,
  domain_code,
  contract_version,
  introduced_by_ref
)
values
  ('account',          'active', 'finance', 1, 'migration:0290'),
  ('journal_entry',    'active', 'finance', 1, 'migration:0290'),
  ('invoice',          'active', 'finance', 1, 'migration:0290'),
  ('payment_receipt',  'active', 'finance', 1, 'migration:0290'),
  ('supplier',         'active', 'finance', 1, 'migration:0290'),
  ('supplier_bill',    'active', 'finance', 1, 'migration:0290'),
  ('supplier_payment', 'active', 'finance', 1, 'migration:0290')
on conflict (entity_type) do update
set
  status = excluded.status,
  domain_code = excluded.domain_code,
  contract_version = greatest(
    public.audit_entity_types.contract_version,
    excluded.contract_version
  );

create function public.audit_d2_financial_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_tenant_id uuid := coalesce(
    nullif(v_new ->> 'tenant_id', '')::uuid,
    nullif(v_old ->> 'tenant_id', '')::uuid
  );
  v_entity_id uuid := coalesce(
    nullif(v_new ->> 'id', '')::uuid,
    nullif(v_old ->> 'id', '')::uuid
  );
  v_actor_id uuid := auth.uid();
  v_actor_type text := case when auth.uid() is null then 'system' else 'user' end;
  v_entity_type text;
  v_event_type text;
  v_reason text;
  v_before jsonb;
  v_after jsonb;
  v_changed boolean := true;
  v_correlation text;
begin
  case tg_table_name
    when 'accounts' then
      v_entity_type := 'account';
      if tg_op = 'INSERT' then
        v_event_type := 'account_created';
      elsif tg_op = 'DELETE' then
        v_event_type := 'account_deleted';
        v_reason := 'Eliminación confirmada en el flujo contable.';
      else
        v_event_type := 'account_updated';
        v_changed :=
          v_old -> 'type' is distinct from v_new -> 'type'
          or v_old -> 'parent_id' is distinct from v_new -> 'parent_id'
          or v_old -> 'subtype' is distinct from v_new -> 'subtype'
          or v_old -> 'is_postable' is distinct from v_new -> 'is_postable';
      end if;
      v_before := case when v_old is null then null else
        pg_catalog.jsonb_build_object(
          'code', v_old -> 'code',
          'type', v_old -> 'type',
          'parent_id', v_old -> 'parent_id',
          'subtype', v_old -> 'subtype',
          'is_postable', v_old -> 'is_postable'
        ) end;
      v_after := case when v_new is null then null else
        pg_catalog.jsonb_build_object(
          'code', v_new -> 'code',
          'type', v_new -> 'type',
          'parent_id', v_new -> 'parent_id',
          'subtype', v_new -> 'subtype',
          'is_postable', v_new -> 'is_postable'
        ) end;

    when 'journal_entries' then
      v_entity_type := 'journal_entry';
      if tg_op = 'INSERT' then
        v_event_type := case
          when v_new ->> 'status' = 'asentado' then 'journal_entry_posted'
          else 'journal_entry_created'
        end;
      elsif tg_op = 'DELETE' then
        v_event_type := 'journal_entry_deleted';
        v_reason := 'Eliminación confirmada en el flujo contable.';
      elsif v_old ->> 'status' is distinct from v_new ->> 'status' then
        v_event_type := case v_new ->> 'status'
          when 'asentado' then 'journal_entry_posted'
          when 'anulado' then 'journal_entry_voided'
          else 'journal_entry_status_changed'
        end;
        if v_new ->> 'status' = 'anulado' then
          v_reason := 'Anulación confirmada en el flujo contable.';
        end if;
      elsif v_old ->> 'deleted_at' is distinct from v_new ->> 'deleted_at' then
        v_event_type := 'journal_entry_deleted';
        v_reason := 'Eliminación confirmada en el flujo contable.';
      else
        v_changed := false;
      end if;
      v_before := case when v_old is null then null else
        pg_catalog.jsonb_build_object(
          'entry_code', v_old -> 'entry_code',
          'status', v_old -> 'status',
          'source', v_old -> 'source'
        ) end;
      v_after := case when v_new is null then null else
        pg_catalog.jsonb_build_object(
          'entry_code', v_new -> 'entry_code',
          'status', v_new -> 'status',
          'source', v_new -> 'source'
        ) end;

    when 'invoices' then
      v_entity_type := 'invoice';
      if tg_op = 'INSERT' then
        v_event_type := case
          when v_new ->> 'status' = 'emitida' then 'invoice_emitted'
          else 'invoice_created'
        end;
      elsif tg_op = 'DELETE' then
        v_event_type := 'invoice_deleted';
        v_reason := 'Eliminación confirmada en el flujo de facturación.';
      elsif v_old ->> 'status' is distinct from v_new ->> 'status' then
        v_event_type := case v_new ->> 'status'
          when 'emitida' then 'invoice_emitted'
          when 'anulada' then 'invoice_voided'
          when 'parcial' then 'invoice_payment_registered'
          when 'pagada' then 'invoice_payment_registered'
          else 'invoice_status_changed'
        end;
        if v_new ->> 'status' = 'anulada' then
          v_reason := 'Anulación confirmada en el flujo de facturación.';
        end if;
      elsif v_old ->> 'deleted_at' is distinct from v_new ->> 'deleted_at' then
        v_event_type := 'invoice_deleted';
        v_reason := 'Eliminación confirmada en el flujo de facturación.';
      else
        v_event_type := 'invoice_updated';
        v_changed :=
          v_old -> 'currency' is distinct from v_new -> 'currency'
          or v_old -> 'due_date' is distinct from v_new -> 'due_date'
          or v_old -> 'shipment_id' is distinct from v_new -> 'shipment_id';
      end if;
      v_before := case when v_old is null then null else
        pg_catalog.jsonb_build_object(
          'invoice_code', v_old -> 'invoice_code',
          'status', v_old -> 'status',
          'currency', v_old -> 'currency',
          'shipment_id', v_old -> 'shipment_id'
        ) end;
      v_after := case when v_new is null then null else
        pg_catalog.jsonb_build_object(
          'invoice_code', v_new -> 'invoice_code',
          'status', v_new -> 'status',
          'currency', v_new -> 'currency',
          'shipment_id', v_new -> 'shipment_id'
        ) end;

    when 'payment_receipts' then
      v_entity_type := 'payment_receipt';
      if tg_op = 'INSERT' then
        v_event_type := 'payment_registered';
      elsif tg_op = 'DELETE' then
        v_event_type := 'payment_voided';
        v_reason := 'Anulación confirmada en el flujo de cobranzas.';
      elsif v_old ->> 'deleted_at' is distinct from v_new ->> 'deleted_at' then
        v_event_type := 'payment_voided';
        v_reason := 'Anulación confirmada en el flujo de cobranzas.';
      elsif v_old ->> 'invoice_id' is distinct from v_new ->> 'invoice_id' then
        v_event_type := 'payment_identified';
      else
        v_changed := false;
      end if;
      v_before := case when v_old is null then null else
        pg_catalog.jsonb_build_object(
          'receipt_code', v_old -> 'receipt_code',
          'invoice_id', v_old -> 'invoice_id',
          'currency', v_old -> 'currency',
          'application_status', v_old -> 'application_status'
        ) end;
      v_after := case when v_new is null then null else
        pg_catalog.jsonb_build_object(
          'receipt_code', v_new -> 'receipt_code',
          'invoice_id', v_new -> 'invoice_id',
          'currency', v_new -> 'currency',
          'application_status', v_new -> 'application_status'
        ) end;

    when 'suppliers' then
      v_entity_type := 'supplier';
      if tg_op = 'INSERT' then
        v_event_type := 'supplier_created';
      elsif tg_op = 'DELETE' then
        v_event_type := 'supplier_deleted';
        v_reason := 'Eliminación confirmada en el flujo de tesorería.';
      elsif v_old ->> 'deleted_at' is distinct from v_new ->> 'deleted_at' then
        v_event_type := 'supplier_deleted';
        v_reason := 'Eliminación confirmada en el flujo de tesorería.';
      else
        v_event_type := 'supplier_updated';
        v_changed :=
          v_old -> 'type' is distinct from v_new -> 'type'
          or v_old -> 'country' is distinct from v_new -> 'country'
          or v_old -> 'default_currency' is distinct from v_new -> 'default_currency'
          or v_old -> 'payment_channel' is distinct from v_new -> 'payment_channel';
      end if;
      v_before := case when v_old is null then null else
        pg_catalog.jsonb_build_object(
          'supplier_code', v_old -> 'supplier_code',
          'type', v_old -> 'type',
          'country', v_old -> 'country',
          'default_currency', v_old -> 'default_currency',
          'payment_channel', v_old -> 'payment_channel'
        ) end;
      v_after := case when v_new is null then null else
        pg_catalog.jsonb_build_object(
          'supplier_code', v_new -> 'supplier_code',
          'type', v_new -> 'type',
          'country', v_new -> 'country',
          'default_currency', v_new -> 'default_currency',
          'payment_channel', v_new -> 'payment_channel'
        ) end;

    when 'supplier_bills' then
      v_entity_type := 'supplier_bill';
      if tg_op = 'INSERT' then
        v_event_type := 'bill_created';
      elsif tg_op = 'DELETE' then
        v_event_type := 'bill_deleted';
        v_reason := 'Eliminación confirmada en el flujo de cuentas por pagar.';
      elsif v_old ->> 'status' is distinct from v_new ->> 'status' then
        v_event_type := case v_new ->> 'status'
          when 'anulada' then 'bill_voided'
          else 'bill_status_changed'
        end;
        if v_new ->> 'status' = 'anulada' then
          v_reason := 'Anulación confirmada en el flujo de cuentas por pagar.';
        end if;
      elsif v_old ->> 'deleted_at' is distinct from v_new ->> 'deleted_at' then
        v_event_type := 'bill_deleted';
        v_reason := 'Eliminación confirmada en el flujo de cuentas por pagar.';
      else
        v_changed := false;
      end if;
      v_before := case when v_old is null then null else
        pg_catalog.jsonb_build_object(
          'bill_code', v_old -> 'bill_code',
          'supplier_id', v_old -> 'supplier_id',
          'status', v_old -> 'status',
          'currency', v_old -> 'currency'
        ) end;
      v_after := case when v_new is null then null else
        pg_catalog.jsonb_build_object(
          'bill_code', v_new -> 'bill_code',
          'supplier_id', v_new -> 'supplier_id',
          'status', v_new -> 'status',
          'currency', v_new -> 'currency'
        ) end;

    when 'supplier_payments' then
      v_entity_type := 'supplier_payment';
      if tg_op = 'INSERT' then
        v_event_type := 'payment_registered';
      elsif tg_op = 'DELETE' then
        v_event_type := 'payment_voided';
        v_reason := 'Anulación confirmada en el flujo de pagos a proveedores.';
      elsif v_old ->> 'deleted_at' is distinct from v_new ->> 'deleted_at' then
        v_event_type := 'payment_voided';
        v_reason := 'Anulación confirmada en el flujo de pagos a proveedores.';
      else
        v_changed := false;
      end if;
      v_before := case when v_old is null then null else
        pg_catalog.jsonb_build_object(
          'payment_code', v_old -> 'payment_code',
          'bill_id', v_old -> 'bill_id',
          'supplier_id', v_old -> 'supplier_id',
          'currency', v_old -> 'currency'
        ) end;
      v_after := case when v_new is null then null else
        pg_catalog.jsonb_build_object(
          'payment_code', v_new -> 'payment_code',
          'bill_id', v_new -> 'bill_id',
          'supplier_id', v_new -> 'supplier_id',
          'currency', v_new -> 'currency'
        ) end;

    else
      raise exception '0290: tabla no allowlisted: %', tg_table_name;
  end case;

  if v_changed then
    v_correlation := pg_catalog.concat(
      'd2:', tg_table_name, ':', v_entity_id::text, ':',
      pg_catalog.txid_current()::text
    );

    perform public.append_audit_event(
      v_tenant_id,
      v_entity_type,
      v_entity_id,
      v_actor_type,
      v_actor_id,
      v_event_type,
      'rpc',
      'succeeded',
      v_reason,
      v_before,
      v_after,
      '{}'::jsonb,
      v_correlation,
      1,
      'restricted'
    );
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

alter function public.audit_d2_financial_change() owner to postgres;
revoke all on function public.audit_d2_financial_change() from public;
revoke all on function public.audit_d2_financial_change() from anon;
revoke all on function public.audit_d2_financial_change() from authenticated;

create trigger audit_d2_accounts
after insert or update or delete on public.accounts
for each row execute function public.audit_d2_financial_change();

create trigger audit_d2_journal_entries
after insert or update or delete on public.journal_entries
for each row execute function public.audit_d2_financial_change();

create trigger audit_d2_invoices
after insert or update or delete on public.invoices
for each row execute function public.audit_d2_financial_change();

create trigger audit_d2_payment_receipts
after insert or update or delete on public.payment_receipts
for each row execute function public.audit_d2_financial_change();

create trigger audit_d2_suppliers
after insert or update or delete on public.suppliers
for each row execute function public.audit_d2_financial_change();

create trigger audit_d2_supplier_bills
after insert or update or delete on public.supplier_bills
for each row execute function public.audit_d2_financial_change();

create trigger audit_d2_supplier_payments
after insert or update or delete on public.supplier_payments
for each row execute function public.audit_d2_financial_change();

do $postcondition$
begin
  if (
    select pg_catalog.count(*)
    from pg_trigger
    where tgname = any (array[
      'audit_d2_accounts',
      'audit_d2_journal_entries',
      'audit_d2_invoices',
      'audit_d2_payment_receipts',
      'audit_d2_suppliers',
      'audit_d2_supplier_bills',
      'audit_d2_supplier_payments'
    ])
      and not tgisinternal
      and tgenabled = 'O'
  ) <> 7 then
    raise exception '0290: faltan triggers D2 habilitados';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'audit_d2_financial_change'
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
  ) then
    raise exception '0290: trigger function sin SECURITY DEFINER/search_path';
  end if;
end;
$postcondition$;

reset statement_timeout;
reset lock_timeout;
