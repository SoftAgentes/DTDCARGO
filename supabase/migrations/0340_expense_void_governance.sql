-- SDD-0243 · Anulación gobernada de gastos.
--
-- Convierte expenses.deleted_at en una transición P3/R3 exclusiva del RPC:
-- gasto, asiento vivo y auditoría se confirman o revierten juntos. Las
-- referencias del recibo permanecen intactas; esta migración no toca Storage.

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.expenses') is null
     or to_regclass('public.journal_entries') is null
     or to_regclass('public.audit_entity_types') is null
     or to_regclass('public.entity_audit_log') is null then
    raise exception '0340 requiere expenses, journal_entries y el contrato AUD-01';
  end if;
  if to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null then
    raise exception '0340 requiere append_audit_event de Corte B';
  end if;
  if to_regprocedure('public.get_accounting_closing_date(uuid)') is null then
    raise exception '0340 requiere get_accounting_closing_date';
  end if;
  if to_regprocedure('public.audit_d2_financial_change()') is null
     or not exists (
       select 1 from pg_catalog.pg_trigger
       where tgname = 'audit_d2_journal_entries'
         and not tgisinternal
         and tgenabled = 'O'
     ) then
    raise exception '0340 requiere auditoría D2 activa en journal_entries';
  end if;
  if to_regprocedure('public.void_expense_governed(uuid,text,text)') is not null
     or to_regprocedure('public.guard_expense_void()') is not null
     or exists (
       select 1 from pg_catalog.pg_trigger
       where tgname = 'guard_expense_void_trg' and not tgisinternal
     ) then
    raise exception '0340 abortado: contrato de anulación de gastos ya existe';
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
values ('expense', 'active', 'finance', 1, 'migration:0340')
on conflict (entity_type) do update
set
  status = excluded.status,
  domain_code = excluded.domain_code,
  contract_version = greatest(
    public.audit_entity_types.contract_version,
    excluded.contract_version
  );

create function public.guard_expense_void()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request_ref text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting('dtd.expense_void', true)
    ),
    ''
  );
begin
  if old.deleted_at is null and new.deleted_at is not null then
    if v_request_ref is null
       or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
      raise exception 'expenses: la anulación exige void_expense_governed'
        using errcode = '42501';
    end if;
  elsif old.deleted_at is not null
        and old.deleted_at is distinct from new.deleted_at then
    raise exception 'expenses: el estado anulado es permanente'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

alter function public.guard_expense_void() owner to postgres;
revoke all on function public.guard_expense_void()
  from public, anon, authenticated, service_role;

create trigger guard_expense_void_trg
before update of deleted_at on public.expenses
for each row execute function public.guard_expense_void();

create function public.void_expense_governed(
  p_expense_id uuid,
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
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_request_ref text := nullif(pg_catalog.btrim(p_request_ref), '');
  v_expense public.expenses%rowtype;
  v_journal public.journal_entries%rowtype;
  v_correlation text;
  v_closing_date date;
begin
  if v_actor is null then
    raise exception 'expenses: autenticación requerida' using errcode = '42501';
  end if;
  if p_expense_id is null then
    raise exception 'expenses: identificador inválido' using errcode = '22023';
  end if;
  if v_reason is null or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'expenses: motivo inválido' using errcode = '22023';
  end if;
  if v_request_ref is null
     or v_request_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'expenses: referencia inválida' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('expense-void:' || v_request_ref, 243)
  );

  select e.* into v_expense
  from public.expenses e
  join public.user_tenants ut
    on ut.tenant_id = e.tenant_id
   and ut.user_id = v_actor
   and ut.role in ('accounting', 'admin')
   and ut.disabled_at is null
  where e.id = p_expense_id
  for update of e;

  if not found then
    raise exception 'expenses: gasto no disponible' using errcode = 'P0002';
  end if;

  if v_expense.deleted_at is not null then
    if exists (
      select 1
      from public.entity_audit_log l
      where l.tenant_id = v_expense.tenant_id
        and l.entity_type = 'expense'
        and l.entity_id = v_expense.id
        and l.event_type = 'expense_voided'
        and l.payload ->> 'request_ref' = v_request_ref
    ) then
      return 'replayed';
    end if;
    raise exception 'expenses: el gasto ya fue anulado' using errcode = '40001';
  end if;

  v_closing_date := public.get_accounting_closing_date(v_expense.tenant_id);
  if v_closing_date is not null
     and v_expense.occurred_at::date <= v_closing_date then
    raise exception 'expenses: período contable cerrado' using errcode = '23514';
  end if;

  select j.* into v_journal
  from public.journal_entries j
  where j.tenant_id = v_expense.tenant_id
    and j.expense_id = v_expense.id
    and j.status = 'asentado'
    and j.deleted_at is null
  order by j.id
  limit 1
  for update;

  if found then
    v_correlation := pg_catalog.concat(
      'd2:journal_entries:', v_journal.id::text, ':',
      pg_catalog.txid_current()::text
    );
  else
    v_correlation := pg_catalog.concat(
      'expense:', v_expense.id::text, ':',
      pg_catalog.txid_current()::text
    );
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);
  perform pg_catalog.set_config('dtd.expense_void', v_request_ref, true);

  update public.journal_entries
  set status = 'anulado'
  where tenant_id = v_expense.tenant_id
    and expense_id = v_expense.id
    and status = 'asentado'
    and deleted_at is null;

  update public.expenses
  set
    deleted_at = pg_catalog.statement_timestamp(),
    updated_at = pg_catalog.statement_timestamp()
  where id = v_expense.id
    and tenant_id = v_expense.tenant_id
    and deleted_at is null;
  if not found then
    raise exception 'expenses: conflicto al anular el gasto' using errcode = '40001';
  end if;

  perform public.append_audit_event(
    v_expense.tenant_id,
    'expense',
    v_expense.id,
    'user',
    v_actor,
    'expense_voided',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'expense_code', v_expense.expense_code,
      'deleted_at', v_expense.deleted_at,
      'receipt_path', v_expense.receipt_path,
      'receipt_document_id', v_expense.receipt_document_id
    ),
    pg_catalog.jsonb_build_object(
      'expense_code', v_expense.expense_code,
      'deleted_at', pg_catalog.statement_timestamp(),
      'receipt_path', v_expense.receipt_path,
      'receipt_document_id', v_expense.receipt_document_id
    ),
    pg_catalog.jsonb_build_object(
      'request_ref', v_request_ref,
      'permanence', 'P3',
      'journal_entry_id', v_journal.id
    ),
    v_correlation,
    1,
    'restricted'
  );

  return 'voided';
end;
$function$;

alter function public.void_expense_governed(uuid,text,text) owner to postgres;
revoke all on function public.void_expense_governed(uuid,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.void_expense_governed(uuid,text,text)
  to authenticated;

comment on function public.void_expense_governed(uuid,text,text) is
  'SDD-0243: anula gasto y asiento atómicamente; accounting/admin, motivo, replay, período y auditoría obligatorios; no toca Storage.';

do $postcondition$
begin
  if not pg_catalog.has_function_privilege(
    'authenticated', 'public.void_expense_governed(uuid,text,text)', 'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'anon', 'public.void_expense_governed(uuid,text,text)', 'EXECUTE'
  ) then
    raise exception '0340: ACL inválida';
  end if;
  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('void_expense_governed', 'guard_expense_void')
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
  ) <> 2 then
    raise exception '0340: funciones sin SECURITY DEFINER/search_path vacío';
  end if;
  if not exists (
    select 1 from public.audit_entity_types
    where entity_type = 'expense' and status = 'active'
  ) then
    raise exception '0340: expense no quedó activo en el catálogo AUD-01';
  end if;
end;
$postcondition$;

reset statement_timeout;
reset lock_timeout;
