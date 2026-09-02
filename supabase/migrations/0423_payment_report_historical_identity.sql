-- SDD-0366: sincronizar sólo la identidad de un reporte histórico conservado.
-- Aplicar con GO nominal después de0421/0422; sin backfill ni cambios de filas.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare v_table text; v_role text;
begin
  foreach v_table in array array['payment_reports', 'invoices', 'clients',
    'client_markbox_history', 'user_tenants', 'entity_audit_log'] loop
    if not exists (select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass('public.' || v_table) and relrowsecurity) then
      raise exception '0423 requiere tabla con RLS: %', v_table;
    end if;
  end loop;
  if not exists (select 1 from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure('public.payment_reports_validate_invoice()')
      and p.proowner = 'postgres'::regrole and p.prosecdef
      and p.prorettype = 'pg_catalog.trigger'::regtype
      and p.proconfig = array['search_path=public']::text[]
      and pg_catalog.md5(p.prosrc) = '89444225ab2212c58a331ea279ca0c5a') then
    raise exception '0423 abortado: validador0195 ausente o con drift';
  end if;
  if not exists (select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.payment_reports'::regclass
      and tgname = 'payment_reports_validate_invoice_trg'
      and tgfoid = 'public.payment_reports_validate_invoice()'::regprocedure
      and tgtype = 23 and tgenabled = 'O' and not tgisinternal
      and tgattr::text = '' and tgqual is null and tgnargs = 0
      and pg_catalog.octet_length(tgargs) = 0) then
    raise exception '0423 abortado: trigger de validación ausente o con drift';
  end if;
  if pg_catalog.to_regprocedure('auth.uid()') is null
    or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
    or pg_catalog.to_regprocedure('public.rename_client_markbox(uuid,text,text)') is null
    or pg_catalog.to_regprocedure('public.confirm_payment_report(uuid,public.payment_report_status,text)') is null
    or pg_catalog.to_regprocedure('public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)') is null
    or pg_catalog.to_regclass('payment_private.report_commands') is null then
    raise exception '0423 requiere identidades, rename0371 y expansión0421';
  end if;
  if not exists (select 1 from public.audit_entity_types
    where entity_type = 'payment_report' and status = 'active') then
    raise exception '0423 requiere entidad de auditoría payment_report de0421';
  end if;
  foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
    if pg_catalog.has_table_privilege(v_role, 'public.payment_reports',
      'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      or pg_catalog.has_any_column_privilege(v_role, 'public.payment_reports', 'INSERT,UPDATE,REFERENCES')
      or pg_catalog.has_function_privilege(v_role,
        'public.confirm_payment_report(uuid,public.payment_report_status,text)', 'EXECUTE') then
      raise exception '0423 requiere restricción0422 sin escritura API: %', v_role;
    end if;
  end loop;
end;
$preflight$;

create or replace function public.payment_reports_validate_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_code text;
  v_archived_at timestamptz;
  v_actor uuid;
  v_client uuid;
  v_history uuid;
  v_reason text;
  v_audit_id uuid;
  v_old_reason text;
begin
  select invoice_code, deleted_at into v_code, v_archived_at
  from public.invoices
  where id = new.invoice_id
    and tenant_id = new.tenant_id
    and client_markbox = new.client_markbox
    and status <> 'borrador';

  if v_code is null then
    raise exception 'reporte de pago sobre factura inexistente, ajena, en borrador o de otro cliente (invoice %, tenant %, markbox %)',
      new.invoice_id, new.tenant_id, new.client_markbox
      using errcode = 'check_violation';
  end if;

  if v_archived_at is not null then
    if tg_op <> 'UPDATE' then
      raise exception 'No se puede registrar un pago sobre una factura archivada'
        using errcode = '23514';
    end if;
    -- Comparar ANTES de sellar el snapshot. Columnas futuras quedan protegidas.
    if new.client_markbox is not distinct from old.client_markbox
      or (pg_catalog.to_jsonb(new) - array['client_markbox', 'updated_at'])
        is distinct from (pg_catalog.to_jsonb(old) - array['client_markbox', 'updated_at'])
      or old.invoice_code is distinct from v_code then
      raise exception 'Un reporte de factura archivada sólo admite sincronizar su Shipping Mark; los datos del pago se conservan'
        using errcode = '23514';
    end if;

    v_actor := auth.uid();
    if v_actor is null or new.tenant_id is distinct from public.get_user_tenant_id() then
      raise exception 'No tienes permiso para sincronizar este reporte histórico'
        using errcode = '42501';
    end if;
    -- Mismo actor/tenant/rol en UNA membresía; no confiar en un GUC de permiso.
    perform 1 from public.user_tenants ut
    where ut.user_id = v_actor and ut.tenant_id = new.tenant_id
      and ut.disabled_at is null and ut.role in ('admin', 'commercial', 'operations')
    for share;
    if not found then
      raise exception 'No tienes permiso para sincronizar este reporte histórico'
        using errcode = '42501';
    end if;
    select c.id, h.id, h.reason into v_client, v_history, v_reason
    from public.client_markbox_history h
    join public.clients c on c.id = h.client_id and c.tenant_id = h.tenant_id
    where c.tenant_id = new.tenant_id and c.markbox = new.client_markbox
      and c.deleted_at is null and c.merged_into_client_id is null
      and h.markbox = old.client_markbox and h.retired_by = v_actor
    for share of c, h;
    if not found then
      raise exception 'El reporte histórico requiere el historial autorizado del mismo cliente'
        using errcode = '42501';
    end if;
    v_reason := nullif(pg_catalog.regexp_replace(v_reason, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
    if v_reason is null or pg_catalog.char_length(v_reason) not between 4 and 500 then
      raise exception 'Indica un motivo de 4 a 500 caracteres para cambiar el Shipping Mark de un expediente histórico'
        using errcode = '22023';
    end if;

    -- 0294 prioriza el GUC; sellar el motivo real y restaurar el contexto previo.
    -- Sólo es transporte de auditoría, nunca una autorización.
    v_old_reason := pg_catalog.current_setting('dtd.audit_reason', true);
    perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);
    v_audit_id := public.append_audit_event(new.tenant_id, 'payment_report', new.id,
      'user', v_actor, 'payment_report_markbox_updated', 'rpc', 'succeeded', v_reason,
      pg_catalog.jsonb_build_object('client_markbox', old.client_markbox, 'invoice_id', old.invoice_id),
      pg_catalog.jsonb_build_object('client_markbox', new.client_markbox, 'invoice_id', new.invoice_id),
      pg_catalog.jsonb_build_object('permanence', 'P3', 'evidence_permanence', 'P4',
        'evidence_retained', true, 'related_client_id', v_client, 'history_id', v_history,
        'consequence', 'historical_identity_synchronized_without_payment',
        'recovery', 'new_authorized_rename_required'),
      v_history::text, 1, 'restricted');
    if v_audit_id is null then
      raise exception 'No se pudo registrar la auditoría del cambio; no se modificó el expediente'
        using errcode = '23514';
    end if;
    perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_old_reason, ''), true);
  end if;

  new.invoice_code := v_code;
  return new;
end;
$function$;

comment on function public.payment_reports_validate_invoice() is
  'SDD-0134/0366: valida factura no-borrador del mismo tenant/cliente y sella invoice_code. Padre archivado sólo permite UPDATE de identidad con fila restante intacta, historial del mismo cliente/actor, rol activo, motivo y auditoría atómica. No crea ni modifica pagos sobre archivos; conserva ACL, trigger y evidencia.';

do $postflight$
begin
  if not exists (select 1 from pg_catalog.pg_proc
    where oid = 'public.payment_reports_validate_invoice()'::regprocedure
      and proowner = 'postgres'::regrole and prosecdef
      and proconfig = array['search_path=""']::text[]) then
    raise exception '0423: el validador no conserva owner y search_path seguro';
  end if;
end;
$postflight$;
