-- SDD-0573 · Desarme de la 0497: cobrar y anular vuelven a funcionar sin restaurar un respaldo.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción. Si hubo otra migración encima,
--    su preflight la frena: hay que revisarla antes.
-- Ensayo: infra/ops/tests/prueba-0497-rol-real.mjs, con el rol real y el esquema completo.
-- Contrato: lib/studio/__tests__/reverso-al-anular-factura.migration.test.ts.
--
-- QUITA los cinco triggers i3_*. Cobrar, renombrar y anular un recibo dejan de pasar por la aserción.
-- DEVUELVE void_invoice_with_audit_reason al cuerpo, al modo y a los permisos de la 0294.
-- AJUSTA post_invoice_journal_entry_atomic: nombra dos de esos triggers en SET CONSTRAINTS y, si se
--   quitan sin esto, falla siempre, y emitir con la web nueva deja la factura sin asiento.
-- CONSERVA toda fila, la columna reverses_entry_id con su índice, su CHECK y su FK, la FK diferible de
--   las líneas, que la web nueva necesita, y las funciones i3_*, sin uso y sin permisos.
--
-- PIERDE lo que la 0497 trajo:
--   · Anular no revierte: la factura queda anulada y su venta sigue asentada, sin reverso, como antes de
--     la 0497. El ingreso queda contado de más hasta repararla.
--   · La base deja de frenar: anular con cobros vivos o crédito aplicado, y cambiar a mano un asiento
--     automático. Quién anula queda a cargo de la RLS de invoices y de la app.
--   · Volver a armar pide una migración nueva, y antes reparar lo anulado en el intervalo:
--     scripts/qa/0497-control-posterior.sql lo lista, como anulada_sin_reverso.
set local lock_timeout = '5s'; -- local: valen hasta el COMMIT, también para la fila del ledger
set local statement_timeout = '30s';

do $preflight$
declare
  v_md5 text;
begin
  select pg_catalog.md5(pg_catalog.replace(p.prosrc,E'\r\n',E'\n')) into v_md5 from pg_catalog.pg_proc p
    where p.oid=pg_catalog.to_regprocedure('public.void_invoice_with_audit_reason(uuid,text)');
  if v_md5 is distinct from 'ab48314832efcf3251331617874e0a1b' then
    raise exception 'Desarme abortado: void_invoice_with_audit_reason no es la de la 0497 (md5 %)', v_md5;
  end if;
  select pg_catalog.md5(pg_catalog.replace(p.prosrc,E'\r\n',E'\n')) into v_md5 from pg_catalog.pg_proc p
    where p.oid=pg_catalog.to_regprocedure('public.post_invoice_journal_entry_atomic(uuid,uuid)');
  if v_md5 is distinct from 'c72a9358ec04f565a80fb822504a5629' then
    raise exception 'Desarme abortado: post_invoice_journal_entry_atomic no es la de la 0497 (md5 %)', v_md5;
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_trigger t where not t.tgisinternal
      and t.tgname in ('i3_invoice_guard','i3_invoice_final_check','i3_journal_entry_guard','i3_journal_entry_final_check','i3_journal_line_guard')) <> 5 then
    raise exception 'Desarme abortado: no están los cinco triggers de la 0497';
  end if;
end;
$preflight$;

-- En el orden en que las RPC toman los locks: factura, cabecera, líneas.
drop trigger i3_invoice_final_check on public.invoices;
drop trigger i3_invoice_guard on public.invoices;
drop trigger i3_journal_entry_final_check on public.journal_entries;
drop trigger i3_journal_entry_guard on public.journal_entries;
drop trigger i3_journal_line_guard on public.journal_lines;

-- El de la 0294, byte por byte.
create or replace function public.void_invoice_with_audit_reason(
  p_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security invoker
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
alter function public.void_invoice_with_audit_reason(uuid,text) owner to postgres;
-- La ACL de antes de la 0497, medida en producción el 2026-11-02: la 0497 le quitó service_role.
revoke all on function public.void_invoice_with_audit_reason(uuid,text) from public, anon;
grant execute on function public.void_invoice_with_audit_reason(uuid,text) to authenticated, service_role;

-- El de la 0497, sin los dos nombres de triggers en sus tres SET CONSTRAINTS. Nada más cambia.
create or replace function public.post_invoice_journal_entry_atomic(p_tenant_id uuid, p_invoice_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path = ''
as $function$
declare
  v_motivo_exterior text := pg_catalog.current_setting('dtd.audit_reason', true);
  v_inv public.invoices%rowtype;
  v_entry public.journal_entries%rowtype;
  v_all integer;
  v_vivos integer;
  v_ar uuid;
  v_sales uuid;
  v_tax uuid;
  v_closing date;
  v_nuevo uuid;
  v_code text;
  v_result jsonb;
  v_schema text;
  v_table text;
  v_constraint text;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'La operación contable requiere una transacción READ COMMITTED.' using errcode = '25000';
  end if;
  if p_tenant_id is null or p_invoice_id is null then
    raise exception 'Identidad de factura inválida.' using errcode = '22023';
  end if;
  v_result := pg_catalog.jsonb_build_object('version',1,'outcome','not_posted',
    'invoice_id',p_invoice_id,'entry_id',null,'entry_code',null,'entry_date',null);
  select * into v_inv from public.invoices i
  where i.id = p_invoice_id and i.tenant_id = p_tenant_id for update;
  if not found or v_inv.deleted_at is not null then
    return v_result || pg_catalog.jsonb_build_object('reason','invoice_unavailable');
  end if;
  if v_inv.status::text not in ('emitida','parcial','vencida','pagada') then
    return v_result || pg_catalog.jsonb_build_object('reason','invoice_not_postable');
  end if;
  if v_inv.issued_at is null or not pg_catalog.isfinite(v_inv.issued_at)
     or v_inv.issued_at not between date '0001-01-01' and date '9999-12-31' then
    return v_result || pg_catalog.jsonb_build_object('reason','invalid_issue_date');
  end if;
  if v_inv.base_amount is null or v_inv.iva_amount is null or v_inv.total_amount is null
     or not (v_inv.base_amount between 0 and 999999999999.99
       and v_inv.iva_amount between 0 and 999999999999.99
       and v_inv.total_amount between 0 and 999999999999.99)
     or scale(v_inv.base_amount) > 2 or scale(v_inv.iva_amount) > 2 or scale(v_inv.total_amount) > 2 then
    return v_result || pg_catalog.jsonb_build_object('reason','invalid_amounts');
  end if;
  if v_inv.total_amount <> v_inv.base_amount + v_inv.iva_amount then
    return v_result || pg_catalog.jsonb_build_object('reason','totals_mismatch');
  end if;
  perform e.id from public.journal_entries e
  where e.invoice_id = p_invoice_id or e.reverses_entry_id in (
    select x.id from public.journal_entries x where x.invoice_id = p_invoice_id)
  order by e.id for update;
  perform l.id from public.journal_lines l where l.entry_id in (
    select e.id from public.journal_entries e where e.invoice_id = p_invoice_id)
  order by l.id for update;
  perform a.id from public.accounts a where a.id in (
    select l.account_id from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    where e.invoice_id = p_invoice_id) order by a.id for share;
  select count(*), count(*) filter (where e.source = 'invoice' and e.reverses_entry_id is null)
    into v_all, v_vivos
  from public.journal_entries e
  where (e.invoice_id = p_invoice_id and
       (e.source in ('invoice','invoice_reversal') or e.reverses_entry_id is not null))
     or e.reverses_entry_id in (select x.id from public.journal_entries x where x.invoice_id = p_invoice_id);
  if v_all > 0 then
    select * into v_entry from public.journal_entries where invoice_id = p_invoice_id and source = 'invoice';
    if v_all <> 1 or v_vivos <> 1 or
       not public.i3_original_valid(v_entry.id,p_tenant_id,p_invoice_id) then
      return v_result || pg_catalog.jsonb_build_object('reason','existing_sale_requires_review');
    end if;
    return pg_catalog.jsonb_build_object('version',1,'outcome','already_posted',
      'reason','entry_already_exists','invoice_id',p_invoice_id,
      'entry_id',v_entry.id,'entry_code',v_entry.entry_code,
      'entry_date',pg_catalog.to_char(v_entry.entry_date,'YYYY-MM-DD'));
  end if;
  if v_inv.total_amount = 0 then
    return v_result || pg_catalog.jsonb_build_object('reason','zero_total');
  end if;
  perform a.id from public.accounts a
  where a.tenant_id = p_tenant_id and a.code in ('1.1.2','4.5','2.1.5') order by a.id for share;
  select id into v_ar from public.accounts where tenant_id = p_tenant_id and code = '1.1.2' and is_postable;
  select id into v_sales from public.accounts where tenant_id = p_tenant_id and code = '4.5' and is_postable;
  select id into v_tax from public.accounts where tenant_id = p_tenant_id and code = '2.1.5' and is_postable;
  if v_ar is null or v_sales is null or (v_inv.iva_amount > 0 and v_tax is null) then
    return v_result || pg_catalog.jsonb_build_object('reason','missing_accounts');
  end if;
  select closing_date into v_closing from public.accounting_settings where tenant_id = p_tenant_id;
  if v_closing is not null and v_inv.issued_at <= v_closing then
    return v_result || pg_catalog.jsonb_build_object('reason','period_closed');
  end if;
  v_nuevo := pg_catalog.gen_random_uuid();
  perform public.i3_lock_entry(v_nuevo);
  -- Normalización retroactiva, sólo después de descartar lectura/no-op.
  set constraints public.journal_lines_entry_id_fkey immediate;
  for v_intento in 1..3 loop
    begin
      perform pg_catalog.set_config('dtd.audit_reason', '', true);
      set constraints public.journal_lines_entry_id_fkey deferred;
      v_code := public.next_entry_code(p_tenant_id);
      insert into public.journal_lines(entry_id,account_id,debit,credit,line_memo) values
        (v_nuevo,v_ar,v_inv.total_amount,0,'Factura ' || v_inv.invoice_code),
        (v_nuevo,v_sales,0,v_inv.base_amount,'Ingreso de factura ' || v_inv.invoice_code);
      if v_inv.iva_amount > 0 then
        insert into public.journal_lines(entry_id,account_id,debit,credit,line_memo)
        values(v_nuevo,v_tax,0,v_inv.iva_amount,'IVA de factura ' || v_inv.invoice_code);
      end if;
      insert into public.journal_entries(id,tenant_id,entry_code,entry_date,memo,status,source,invoice_id,posted_at)
      values(v_nuevo,p_tenant_id,v_code,v_inv.issued_at,'Factura ' || v_inv.invoice_code,
             'asentado','invoice',p_invoice_id,pg_catalog.clock_timestamp());
      perform public.i3_assert_invoice_final(p_invoice_id);
      set constraints public.journal_lines_entry_id_fkey immediate;
      perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_motivo_exterior, ''), true);
      return pg_catalog.jsonb_build_object('version',1,'outcome','posted','reason','posted',
        'invoice_id',p_invoice_id,'entry_id',v_nuevo,'entry_code',v_code,
        'entry_date',pg_catalog.to_char(v_inv.issued_at,'YYYY-MM-DD'));
    exception when unique_violation then
      get stacked diagnostics v_schema = schema_name, v_table = table_name, v_constraint = constraint_name;
      if v_schema is distinct from 'public' or v_table is distinct from 'journal_entries'
         or v_constraint is distinct from 'journal_entries_tenant_id_entry_code_key'
         or v_intento = 3 then raise; end if;
    end;
  end loop;
  raise exception 'No se confirmó el asiento.' using errcode = '40001';
end;
$function$;

do $postflight$
declare
  v_proc pg_catalog.pg_proc%rowtype;
begin
  if exists (select 1 from pg_catalog.pg_trigger t where not t.tgisinternal
      and t.tgname in ('i3_invoice_guard','i3_invoice_final_check','i3_journal_entry_guard','i3_journal_entry_final_check','i3_journal_line_guard')) then
    raise exception 'Desarme: postflight — quedó un trigger de la 0497';
  end if;
  select p.* into v_proc from pg_catalog.pg_proc p
    where p.oid=pg_catalog.to_regprocedure('public.void_invoice_with_audit_reason(uuid,text)');
  if pg_catalog.md5(pg_catalog.replace(v_proc.prosrc,E'\r\n',E'\n')) <> '76644e17876d0caaa46e727de5946138'
     or v_proc.prosecdef or v_proc.proconfig is distinct from array['search_path=""']
     or v_proc.proowner <> 'postgres'::regrole then
    raise exception 'Desarme: postflight — void_invoice_with_audit_reason no quedó como en la 0294';
  end if;
  if pg_catalog.has_function_privilege('anon','public.void_invoice_with_audit_reason(uuid,text)','EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated','public.void_invoice_with_audit_reason(uuid,text)','EXECUTE')
     or not pg_catalog.has_function_privilege('service_role','public.void_invoice_with_audit_reason(uuid,text)','EXECUTE') then
    raise exception 'Desarme: postflight — la ACL de void_invoice_with_audit_reason no es la de antes de la 0497';
  end if;
  select p.* into v_proc from pg_catalog.pg_proc p
    where p.oid=pg_catalog.to_regprocedure('public.post_invoice_journal_entry_atomic(uuid,uuid)');
  if pg_catalog.md5(pg_catalog.replace(v_proc.prosrc,E'\r\n',E'\n')) <> 'fe31d473cc2ba8f8edf694ce8dfa79a5'
     or not v_proc.prosecdef or v_proc.proconfig is distinct from array['search_path=""']
     or not pg_catalog.has_function_privilege('service_role','public.post_invoice_journal_entry_atomic(uuid,uuid)','EXECUTE')
     or pg_catalog.has_function_privilege('authenticated','public.post_invoice_journal_entry_atomic(uuid,uuid)','EXECUTE')
     or pg_catalog.has_function_privilege('anon','public.post_invoice_journal_entry_atomic(uuid,uuid)','EXECUTE') then
    raise exception 'Desarme: postflight — post_invoice_journal_entry_atomic no quedó como se esperaba';
  end if;
end;
$postflight$;
