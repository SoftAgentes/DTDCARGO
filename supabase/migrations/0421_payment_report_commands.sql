-- SDD-0365 · expansión local de comandos auditados de reportes de pago.
-- NO retira todavía DML/RPC legacy: primero consumidores, smoke y restricción.
-- No cambia comprobantes, pagos históricos, policies existentes ni asientos.
-- Aplicación Cloud exige autorización nominal de esta migración.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare v_table text;
begin
  foreach v_table in array array['payment_reports', 'invoices', 'client_users', 'clients', 'user_tenants', 'entity_audit_log', 'audit_entity_types'] loop
    if not exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass('public.' || v_table) and relrowsecurity
    ) then
      raise exception '0421 requiere tabla con RLS: %', v_table;
    end if;
  end loop;
  if pg_catalog.to_regprocedure('auth.uid()') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)') is null
     or pg_catalog.to_regprocedure('public.append_audit_event_v1(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)') is null then
    raise exception '0421 requiere identidad y auditoría 0267/0294';
  end if;
  if pg_catalog.to_regnamespace('payment_private') is not null
     or exists (select 1 from pg_catalog.pg_attribute
       where attrelid = 'public.payment_reports'::regclass and not attisdropped
         and attname in ('cancelled_at', 'cancelled_by', 'resolution_reason'))
     or exists (select 1 from public.audit_entity_types where entity_type = 'payment_report')
     or exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in (
         'create_portal_payment_report', 'cancel_portal_payment_report', 'resolve_payment_report')) then
    raise exception '0421 abortado: objetos de expansión ya existen; revisar drift';
  end if;
  if not exists (select 1 from storage.buckets where id = 'payment-proofs' and public is false) then
    raise exception '0421 requiere bucket privado payment-proofs';
  end if;
end;
$preflight$;

alter table public.payment_reports
  add column cancelled_at timestamptz,
  add column cancelled_by uuid,
  add column resolution_reason text,
  add constraint payment_reports_cancellation_pair check (
    (cancelled_at is null) = (cancelled_by is null)
    and (cancelled_at is null or (status = 'reportado' and deleted_at is null))
  ),
  add constraint payment_reports_resolution_reason_length check (
    resolution_reason is null or pg_catalog.char_length(resolution_reason) between 4 and 500
  );
comment on column public.payment_reports.cancelled_by is
  'SDD-0365: actor de cancelación P3; sin FK a auth.users para conservar identidad histórica.';
comment on column public.payment_reports.cancelled_at is
  'SDD-0365: estado compensatorio irreversible; no borra reporte, nota ni comprobante.';
comment on column public.payment_reports.resolution_reason is
  'SDD-0365: motivo financiero separado de la nota original del cliente.';

create schema payment_private authorization postgres;
revoke all on schema payment_private from public, anon, authenticated, service_role;
grant usage on schema payment_private to authenticated;

create table payment_private.report_commands (
  request_id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  actor_id uuid not null,
  report_id uuid not null references public.payment_reports(id) on delete restrict,
  verb text not null check (verb in ('create', 'cancel', 'confirm', 'reject')),
  input_hash bytea not null check (pg_catalog.octet_length(input_hash) = 32),
  result jsonb not null check (pg_catalog.jsonb_typeof(result) = 'object'),
  audit_event_id uuid not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table payment_private.report_commands owner to postgres;
alter table payment_private.report_commands enable row level security;
revoke all on table payment_private.report_commands from public, anon, authenticated, service_role;
create index report_commands_report_idx on payment_private.report_commands (report_id, created_at);
create index report_commands_tenant_idx on payment_private.report_commands (tenant_id);
comment on table payment_private.report_commands is
  'SDD-0365: recibos P4 privados, append-only y sin CRUD API; no contiene monto, nota ni comprobante.';

create function payment_private.prevent_receipt_mutation() returns trigger
language plpgsql security invoker set search_path = '' as $function$
begin
  raise exception 'PAYMENT_RECEIPT_IMMUTABLE' using errcode = '55000';
end;
$function$;
alter function payment_private.prevent_receipt_mutation() owner to postgres;
revoke all on function payment_private.prevent_receipt_mutation() from public, anon, authenticated, service_role;
create trigger report_commands_immutable
  before update or delete or truncate on payment_private.report_commands
  for each statement execute function payment_private.prevent_receipt_mutation();

-- INVOKER deliberado: current_user es authenticated/service_role en DML directo
-- y postgres dentro del comando definer. No es un GUC falsificable por el caller.
create function payment_private.guard_report_command_fields() returns trigger
language plpgsql security invoker set search_path = '' as $function$
begin
  if tg_op = 'UPDATE' and old.cancelled_at is not null
     and (new.cancelled_at, new.cancelled_by) is distinct from (old.cancelled_at, old.cancelled_by) then
    raise exception 'PAYMENT_STATE' using errcode = '23514';
  end if;
  if current_user <> 'postgres' and (
    (tg_op = 'INSERT' and (new.cancelled_at is not null or new.cancelled_by is not null or new.resolution_reason is not null))
    or (tg_op = 'UPDATE' and
      (new.cancelled_at, new.cancelled_by, new.resolution_reason) is distinct from
      (old.cancelled_at, old.cancelled_by, old.resolution_reason))
  ) then
    raise exception 'PAYMENT_COMMAND_REQUIRED' using errcode = '42501';
  end if;
  return new;
end;
$function$;
alter function payment_private.guard_report_command_fields() owner to postgres;
revoke all on function payment_private.guard_report_command_fields() from public, anon, authenticated, service_role;
create trigger payment_reports_command_fields
  before insert or update on public.payment_reports
  for each row execute function payment_private.guard_report_command_fields();

insert into public.audit_entity_types (entity_type, status, domain_code, contract_version, introduced_by_ref)
values ('payment_report', 'active', 'finance', 1, 'migration:0421');

create function payment_private.run_report_command(
  p_request_id uuid, p_report_id uuid, p_kind text, p_input jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $function$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_markbox text;
  v_invoice_id uuid;
  v_rep public.payment_reports;
  v_inv public.invoices;
  v_receipt payment_private.report_commands;
  v_input jsonb;
  v_hash bytea;
  v_code text;
  v_reason text;
  v_note text;
  v_proof text;
  v_amount numeric;
  v_method public.payment_report_method;
  v_paid_at date;
  v_new_paid numeric(14,2);
  v_new_status public.invoice_status;
  v_before jsonb;
  v_after jsonb;
  v_audit_id uuid;
  v_result jsonb;
  v_old_reason text := pg_catalog.current_setting('dtd.audit_reason', true);
begin
  if v_actor is null then
    raise exception 'PAYMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if p_request_id is null or p_report_id is null or p_kind is null
     or p_kind not in ('create', 'cancel', 'confirm', 'reject')
     or p_input is null or pg_catalog.jsonb_typeof(p_input) <> 'object' then
    raise exception 'PAYMENT_INPUT' using errcode = '22023';
  end if;

  -- Autorizar antes de sondear recibos o reportes. SHARE bloquea revocaciones
  -- (también UPDATE no-key), no sólo el borrado físico de la membresía.
  if p_kind in ('create', 'cancel') then
    select cu.tenant_id, c.markbox into v_tenant, v_markbox
    from public.client_users cu join public.clients c
      on c.id = cu.client_id and c.tenant_id = cu.tenant_id
    where cu.auth_user_id = v_actor and cu.status = 'active' and c.deleted_at is null
    for share of cu, c;
    if v_tenant is null or v_markbox is null then
      raise exception 'PAYMENT_FORBIDDEN' using errcode = '42501';
    end if;
  else
    v_tenant := public.get_user_tenant_id();
    perform 1 from public.user_tenants ut
    where ut.user_id = v_actor and ut.tenant_id = v_tenant
      and ut.disabled_at is null and ut.role in ('admin', 'accounting')
    for share;
    if not found then
      raise exception 'PAYMENT_FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  if exists (select 1 from pg_catalog.jsonb_object_keys(p_input) as k(key)
    where not (k.key = any(case p_kind
      when 'create' then array['invoice_code', 'amount', 'method', 'paid_at', 'proof_path', 'note']
      when 'cancel' then array['invoice_code', 'reason']
      else array['reason'] end))) then
    raise exception 'PAYMENT_INPUT' using errcode = '22023';
  end if;
  v_code := pg_catalog.btrim(p_input ->> 'invoice_code');
  v_reason := nullif(pg_catalog.regexp_replace(p_input ->> 'reason', '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  if p_kind in ('create', 'cancel') and
     (v_code is null or pg_catalog.char_length(v_code) not between 1 and 80 or v_code ~ '[[:cntrl:]]') then
    raise exception 'PAYMENT_INPUT' using errcode = '22023';
  end if;
  if p_kind <> 'create' and (v_reason is null or pg_catalog.char_length(v_reason) not between 4 and 500) then
    raise exception 'PAYMENT_REASON' using errcode = '22023';
  end if;
  if p_kind = 'create' then
    begin
      v_amount := (p_input ->> 'amount')::numeric;
      v_method := (p_input ->> 'method')::public.payment_report_method;
      v_paid_at := (p_input ->> 'paid_at')::date;
    exception when data_exception then
      raise exception 'PAYMENT_INPUT' using errcode = '22023';
    end;
    v_note := nullif(pg_catalog.regexp_replace(p_input ->> 'note', '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
    v_proof := p_input ->> 'proof_path';
    if v_amount is null or v_amount <= 0 or v_amount > 9999999.99
       or pg_catalog.round(v_amount, 2) <> v_amount or v_method is null
       or v_paid_at is null or not pg_catalog.isfinite(v_paid_at)
       or (p_input ->> 'paid_at') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       or v_paid_at > (pg_catalog.clock_timestamp() at time zone 'UTC')::date
       or pg_catalog.char_length(v_note) > 500 or v_proof is null then
      raise exception 'PAYMENT_INPUT' using errcode = '22023';
    end if;
    v_input := pg_catalog.jsonb_build_object('invoice_code', v_code,
      'amount', v_amount::numeric(14,2), 'method', v_method, 'paid_at', v_paid_at,
      'proof_path', v_proof, 'note', v_note);
  elsif p_kind = 'cancel' then
    v_input := pg_catalog.jsonb_build_object('invoice_code', v_code, 'reason', v_reason);
  else
    v_input := pg_catalog.jsonb_build_object('reason', v_reason);
  end if;
  v_hash := pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'verb', p_kind, 'report_id', p_report_id, 'input', v_input)::text, 'UTF8'));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payment-command:' || p_request_id::text, 0));

  -- Todos los comandos nuevos bloquean factura ANTES de reporte. El lookup
  -- preliminar no da permiso: después de esperar se revalida toda la relación.
  if p_kind = 'create' then
    select * into v_inv from public.invoices
    where tenant_id = v_tenant and invoice_code = v_code and client_markbox = v_markbox
    for update;
  else
    select invoice_id into v_invoice_id from public.payment_reports
    where id = p_report_id and tenant_id = v_tenant
      and (p_kind <> 'cancel' or (client_markbox = v_markbox and invoice_code = v_code));
    select * into v_inv from public.invoices
    where id = v_invoice_id and tenant_id = v_tenant
      and (p_kind <> 'cancel' or (client_markbox = v_markbox and invoice_code = v_code))
    for update;
    select * into v_rep from public.payment_reports
    where id = p_report_id and tenant_id = v_tenant and invoice_id = v_inv.id
      and client_markbox = v_inv.client_markbox and invoice_code = v_inv.invoice_code
    for update;
    if v_rep.id is null then
      raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;
  if v_inv.id is null then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_receipt from payment_private.report_commands where request_id = p_request_id;
  if found then
    if v_receipt.actor_id <> v_actor or v_receipt.tenant_id <> v_tenant
       or v_receipt.report_id <> p_report_id or v_receipt.verb <> p_kind or v_receipt.input_hash <> v_hash then
      raise exception 'PAYMENT_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return v_receipt.result || pg_catalog.jsonb_build_object('replayed', true);
  end if;
  if v_inv.deleted_at is not null or v_inv.status in ('borrador', 'anulada') then
    raise exception 'PAYMENT_STATE' using errcode = '23514';
  end if;
  if p_kind <> 'create' and
     (v_rep.deleted_at is not null or v_rep.status <> 'reportado' or v_rep.cancelled_at is not null) then
    raise exception 'PAYMENT_STATE' using errcode = '23514';
  end if;
  if p_kind in ('confirm', 'reject') and v_rep.currency <> v_inv.currency then
    raise exception 'PAYMENT_CURRENCY' using errcode = '23514';
  end if;

  -- 0294 prioriza este contexto sobre p_reason. Sellarlo impide suplantar el
  -- motivo con un GUC previo; nunca se usa como permiso. Restaurado al terminar.
  perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_reason, ''), true);
  if p_kind = 'create' then
    if v_inv.status = 'pagada' then
      raise exception 'PAYMENT_STATE' using errcode = '23514';
    end if;
    if (select count(*) from public.payment_reports where tenant_id = v_tenant and invoice_id = v_inv.id
      and status = 'reportado' and deleted_at is null and cancelled_at is null) >= 5 then
      raise exception 'PAYMENT_PENDING_LIMIT' using errcode = '23514';
    end if;
    if v_proof !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png|webp|heic|heif)$'
       or v_proof ~ '[[:space:]]'
       or pg_catalog.split_part(v_proof, '/', 1) <> v_tenant::text
       or pg_catalog.split_part(v_proof, '/', 2) <> v_inv.id::text
       or pg_catalog.split_part(v_proof, '/', 3) <> p_report_id::text then
      raise exception 'PAYMENT_PROOF' using errcode = '22023';
    end if;
    perform 1 from storage.objects where bucket_id = 'payment-proofs' and name = v_proof for share;
    if not found then
      raise exception 'PAYMENT_PROOF' using errcode = '22023';
    end if;
    insert into public.payment_reports (
      id, tenant_id, invoice_id, invoice_code, client_markbox, amount, currency,
      method, paid_at, proof_path, status, note
    ) values (
      p_report_id, v_tenant, v_inv.id, v_inv.invoice_code, v_inv.client_markbox,
      v_amount, v_inv.currency, v_method, v_paid_at, v_proof, 'reportado', v_note
    ) returning * into v_rep;
  else
    v_before := pg_catalog.jsonb_build_object('status', v_rep.status, 'cancelled', false, 'invoice_id', v_inv.id);
    if p_kind = 'cancel' then
      update public.payment_reports set cancelled_at = pg_catalog.clock_timestamp(), cancelled_by = v_actor
      where id = p_report_id returning * into v_rep;
    else
      if p_kind = 'confirm' then
        v_new_paid := pg_catalog.round(coalesce(v_inv.paid_amount, 0) + v_rep.amount, 2);
        v_new_status := v_inv.status;
        if v_inv.status in ('emitida', 'parcial', 'vencida') then
          if v_new_paid >= v_inv.total_amount then v_new_status := 'pagada';
          elsif v_new_paid > 0 then v_new_status := 'parcial'; end if;
        end if;
        update public.invoices set paid_amount = v_new_paid, status = v_new_status,
          last_payment_at = pg_catalog.clock_timestamp() where id = v_inv.id;
      end if;
      update public.payment_reports set
        status = case when p_kind = 'confirm' then 'confirmado'::public.payment_report_status else 'rechazado'::public.payment_report_status end,
        resolution_reason = v_reason, confirmed_by = v_actor, confirmed_at = pg_catalog.clock_timestamp()
      where id = p_report_id returning * into v_rep;
    end if;
  end if;
  v_after := pg_catalog.jsonb_build_object('status', v_rep.status, 'cancelled', v_rep.cancelled_at is not null, 'invoice_id', v_inv.id);
  v_audit_id := public.append_audit_event(v_tenant, 'payment_report', p_report_id, 'user', v_actor,
    case p_kind when 'create' then 'payment_report_created' when 'cancel' then 'payment_report_cancelled'
      when 'confirm' then 'payment_report_confirmed' else 'payment_report_rejected' end,
    'rpc', 'succeeded', v_reason, v_before, v_after,
    pg_catalog.jsonb_build_object('permanence', 'P3', 'evidence_permanence', 'P4',
      'evidence_retained', true, 'related_report_id', p_report_id,
      'consequence', case p_kind when 'confirm' then 'invoice_paid_amount_updated'
        when 'cancel' then 'report_cancelled_without_payment' when 'reject' then 'report_rejected_without_payment'
        else 'payment_declared_not_credited' end,
      'recovery', 'new_command_required'),
    p_request_id::text, 1, 'restricted');
  if v_audit_id is null then
    raise exception 'PAYMENT_AUDIT' using errcode = '23514';
  end if;
  v_result := pg_catalog.jsonb_build_object('request_id', p_request_id, 'report_id', p_report_id,
    'invoice_id', v_inv.id, 'invoice_code', v_inv.invoice_code, 'status', v_rep.status,
    'cancelled', v_rep.cancelled_at is not null, 'audit_event_id', v_audit_id, 'replayed', false);
  insert into payment_private.report_commands (request_id, tenant_id, actor_id, report_id, verb, input_hash, result, audit_event_id)
  values (p_request_id, v_tenant, v_actor, p_report_id, p_kind, v_hash, v_result, v_audit_id);
  perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_old_reason, ''), true);
  return v_result;
end;
$function$;
alter function payment_private.run_report_command(uuid,uuid,text,jsonb) owner to postgres;
revoke all on function payment_private.run_report_command(uuid,uuid,text,jsonb) from public, anon, authenticated, service_role;
grant execute on function payment_private.run_report_command(uuid,uuid,text,jsonb) to authenticated;

create function public.create_portal_payment_report(
  p_request_id uuid, p_report_id uuid, p_invoice_code text, p_amount numeric,
  p_method public.payment_report_method, p_paid_at date, p_proof_path text, p_note text default null
) returns jsonb language sql security invoker set search_path = '' as $function$
  select payment_private.run_report_command(p_request_id, p_report_id, 'create',
    pg_catalog.jsonb_build_object('invoice_code', p_invoice_code, 'amount', p_amount,
      'method', p_method, 'paid_at', p_paid_at, 'proof_path', p_proof_path, 'note', p_note));
$function$;
create function public.cancel_portal_payment_report(
  p_request_id uuid, p_report_id uuid, p_invoice_code text, p_reason text
) returns jsonb language sql security invoker set search_path = '' as $function$
  select payment_private.run_report_command(p_request_id, p_report_id, 'cancel',
    pg_catalog.jsonb_build_object('invoice_code', p_invoice_code, 'reason', p_reason));
$function$;
create function public.resolve_payment_report(
  p_request_id uuid, p_report_id uuid, p_action public.payment_report_status, p_reason text
) returns jsonb language sql security invoker set search_path = '' as $function$
  select payment_private.run_report_command(p_request_id, p_report_id,
    case p_action when 'confirmado' then 'confirm' when 'rechazado' then 'reject' else 'invalid' end,
    pg_catalog.jsonb_build_object('reason', p_reason));
$function$;
alter function public.create_portal_payment_report(uuid,uuid,text,numeric,public.payment_report_method,date,text,text) owner to postgres;
alter function public.cancel_portal_payment_report(uuid,uuid,text,text) owner to postgres;
alter function public.resolve_payment_report(uuid,uuid,public.payment_report_status,text) owner to postgres;
revoke all on function public.create_portal_payment_report(uuid,uuid,text,numeric,public.payment_report_method,date,text,text) from public, anon, authenticated, service_role;
revoke all on function public.cancel_portal_payment_report(uuid,uuid,text,text) from public, anon, authenticated, service_role;
revoke all on function public.resolve_payment_report(uuid,uuid,public.payment_report_status,text) from public, anon, authenticated, service_role;
grant execute on function public.create_portal_payment_report(uuid,uuid,text,numeric,public.payment_report_method,date,text,text) to authenticated;
grant execute on function public.cancel_portal_payment_report(uuid,uuid,text,text) to authenticated;
grant execute on function public.resolve_payment_report(uuid,uuid,public.payment_report_status,text) to authenticated;

do $postflight$
begin
  if exists (select 1 from pg_catalog.pg_policies where schemaname = 'payment_private')
     or pg_catalog.has_table_privilege('anon', 'payment_private.report_commands', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or pg_catalog.has_table_privilege('authenticated', 'payment_private.report_commands', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or pg_catalog.has_table_privilege('service_role', 'payment_private.report_commands', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception '0421 abortado: recibos expuestos a roles API';
  end if;
end;
$postflight$;
