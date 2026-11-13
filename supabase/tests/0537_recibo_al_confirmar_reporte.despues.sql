-- La 0422 y la 0423 aplicadas DESPUÉS de la 0537, como quedarían en producción
-- (están en espera desde 2026-09-13). NO es un *.test.sql: lo ejecutan, después de
-- 0537_recibo_al_confirmar_reporte.casos.sql y como superusuario, el contrato
-- 0537_recibo_al_confirmar_reporte.test.sql (dblink) y la prueba PGlite
-- lib/portal/__tests__/payment-report-receipt.migration.test.ts.
--
-- Cada migración corre ENTERA, con su preflight y su postflight: si la 0537
-- rompiera algo de lo que exigen, abortan acá. Encima se confirma, se reintenta
-- y se rechaza otra vez con la frontera de la 0422 puesta.
--
-- Dependencias laterales de la 0423 (rename de Shipping Mark, 0367 y 0371): las
-- mismas que monta su contrato, 0423_payment_report_historical_identity.test.sql,
-- pero sin pisar las tablas reales que el fixture 0533 ya tiene.
alter table public.clients add column merged_into_client_id uuid,
  add column aliado_id uuid, add column kommo_lead_id bigint;
create table public.aliados(id uuid primary key,tenant_id uuid,client_id uuid,prefix text,status text,deleted_at timestamptz);
do $rename_platform$
declare t text; source text; body text;
begin
  foreach t in array array['prealertas','payment_receipts','prealerta_service_requests','prealerta_documents',
    'shipment_documents','client_delivery_addresses','client_claims','client_claim_evidence',
    'client_notification_schedule','quotes','sales_orders','purchase_orders','consolidation_items',
    'packing_list_submissions','suppliers_cn','supplier_claims','supplier_order_signals','warehouse_receipts_cn',
    'academy_enrollments','academy_lesson_progress','academy_diplomas','club_members','legal_acceptances'] loop
    if pg_catalog.to_regclass('public.' || t) is null then
      execute format('create table public.%I(tenant_id uuid,client_markbox text)',t);
    else
      execute format('alter table public.%I add column if not exists client_markbox text',t);
    end if;
  end loop;
  foreach t in array array['warehouse_boxes','warehouse_receipt_ve_boxes','qr_print_orders'] loop
    if pg_catalog.to_regclass('public.' || t) is null then
      execute format('create table public.%I(tenant_id uuid,markbox text)',t);
    end if;
  end loop;
  source:=pg_read_file('/sb/migrations/0012_rls_perf_and_rpc_guards.sql');
  body:=split_part(split_part(source,'create or replace function public.assert_tenant_match(p_tenant_id uuid)',2),
    'comment on function public.assert_tenant_match',1);
  if body='' or body not like '%Tenant mismatch:%' then raise exception 'TEST0537: fuente0012 no reconocida'; end if;
  execute 'create or replace function public.assert_tenant_match(p_tenant_id uuid)'||body;
end;
$rename_platform$;
revoke all on function public.assert_tenant_match(uuid) from public,anon,authenticated;
grant execute on function public.assert_tenant_match(uuid) to service_role;
create table if not exists public.referrals(tenant_id uuid,referrer_markbox text);
create table if not exists public.dispatch_orders(id uuid,tenant_id uuid);
create table if not exists public.dispatch_order_packages(od_id uuid,markbox text);
create table if not exists public.dispatch_rules(tenant_id uuid,vip_markboxes text[],whitelist_markboxes text[]);
do $laterales$
begin
  execute pg_read_file('/sb/migrations/0367_client_markbox_historial.sql');
  execute pg_read_file('/sb/migrations/0371_insignia_pelada_del_aliado.sql');
end;
$laterales$;

-- La 0422 y la 0423, enteras y en ese orden (su orden de L14).
do $frontera$
begin
  execute pg_read_file('/sb/migrations/0422_payment_report_command_boundary.sql');
  execute pg_read_file('/sb/migrations/0423_payment_report_historical_identity.sql');
end;
$frontera$;

do $despues$
declare
  v_caja uuid := md5('0533-synthetic-cash')::uuid;
  v jsonb;
  v2 jsonb;
begin
  -- Lo de la 0537 sigue en pie.
  perform r0537.ok(to_regprocedure('public.confirm_payment_report_with_receipt(uuid,uuid,uuid,text)') is not null
    and has_function_privilege('authenticated', 'public.confirm_payment_report_with_receipt(uuid,uuid,uuid,text)', 'EXECUTE')
    and exists (select 1 from pg_trigger where tgname = 'payment_receipts_report_link_guard' and tgenabled = 'O'),
    'después de 0422 y 0423 siguen el wrapper y el guard de la 0537');
  perform r0537.ok(not has_table_privilege('authenticated', 'public.payment_reports', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.payment_reports', 'INSERT'),
    'la frontera de la 0422 quedó puesta');

  -- Confirmar con la frontera puesta: recibo, vínculo y saldo.
  v := r0537.como('accounting-A', r0537.confirmar('req-d1', 'rep-d1', v_caja));
  perform r0537.ok(v ->> 'status' = 'confirmado' and v -> 'receipt' ->> 'id' is not null
    and r0537.recibos('inv-d') = 1 and r0537.pagado('inv-d') = 200
    and exists (select 1 from public.payment_receipts where payment_report_id = r0537.cid('rep-d1')),
    'con 0422 y 0423 la confirmación crea su recibo: ' || (v)::text);
  v2 := r0537.como('accounting-A', r0537.confirmar('req-d1', 'rep-d1', v_caja));
  perform r0537.ok((v2 ->> 'replayed')::boolean and v2 -> 'receipt' = v -> 'receipt' and r0537.recibos('inv-d') = 1,
    'con 0422 y 0423 el reintento devuelve el mismo recibo');
  -- Un rechazo con la frontera puesta sigue sin recibo.
  insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox,
    amount, currency, method, paid_at, note, proof_path)
  values (r0537.cid('rep-d2'), r0537.id('tenant-A'), r0537.cid('inv-d'), 'F-0630-D', 'DUP', 50, 'USD',
    'zelle', current_date - 1, 'Nota sintética', 'sintetico/rep-d2.pdf');
  v := r0537.como('accounting-A', format('select public.resolve_payment_report(%L, %L, ''rechazado'', %L)',
    r0537.cid('req-d2'), r0537.cid('rep-d2'), 'No coincide con el banco'));
  perform r0537.ok(v ->> 'status' = 'rechazado' and r0537.recibos('inv-d') = 1 and r0537.pagado('inv-d') = 200,
    'con 0422 y 0423 rechazar no crea recibo');
end;
$despues$;

select 'TEST0537 después de 0422/0423 OK: ' || (select last_value from r0537.aserciones) || ' aserciones' as resultado;
