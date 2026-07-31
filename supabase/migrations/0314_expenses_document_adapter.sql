-- SDD-0224 · Adaptador aditivo del piloto Gastos al hub canónico.

alter type public.document_entity_type add value if not exists 'expense';

alter table public.expenses
  add column if not exists receipt_document_id uuid
    references public.documents(id) on delete set null;

create index if not exists expenses_receipt_document_idx
  on public.expenses (tenant_id, receipt_document_id)
  where receipt_document_id is not null and deleted_at is null;

create or replace function public.document_entity_in_tenant(
  p_type public.document_entity_type,
  p_id uuid,
  p_tenant uuid
) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  ok boolean := false;
begin
  if p_type::text = 'none' or p_id is null then return true; end if;
  case p_type::text
    when 'shipment' then select exists(select 1 from public.shipments where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'invoice' then select exists(select 1 from public.invoices where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'supplier_bill' then select exists(select 1 from public.supplier_bills where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'supplier_payment' then select exists(select 1 from public.supplier_payments where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'journal_entry' then select exists(select 1 from public.journal_entries where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'client' then select exists(select 1 from public.clients where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'supplier' then select exists(select 1 from public.suppliers where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'consolidation' then select exists(select 1 from public.consolidations where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'booking' then select exists(select 1 from public.bookings where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'expense' then select exists(select 1 from public.expenses where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    else ok := false;
  end case;
  return ok;
end;
$$;

create or replace function public.attach_document_to_expense(p_expense_id uuid, p_document_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := public.get_user_tenant_id();
begin
  if not exists (
    select 1 from public.documents d
    where d.id = p_document_id and d.tenant_id = v_tenant
      and d.entity_type::text = 'expense' and d.entity_id = p_expense_id
      and d.scan_status = 'clean' and d.deleted_at is null
  ) then
    raise exception 'adjunto no disponible, no pertenece al gasto o es ajeno al tenant'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  update public.expenses
  set receipt_document_id = p_document_id
  where id = p_expense_id and tenant_id = v_tenant and deleted_at is null;
  if not found then
    raise exception 'gasto inexistente o ajeno al tenant' using errcode = 'no_data_found';
  end if;
  return true;
end;
$$;

revoke all on function public.attach_document_to_expense(uuid,uuid) from public;
grant execute on function public.attach_document_to_expense(uuid,uuid) to authenticated;

comment on column public.expenses.receipt_document_id is
  'SDD-0224: puntero aditivo al documento canónico; receipt_path legado se conserva durante el piloto.';

