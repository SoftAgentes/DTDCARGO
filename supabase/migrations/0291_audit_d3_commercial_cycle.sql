-- SDD-0174 · D3 · auditoría atómica del ciclo comercial.

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_table text;
begin
  if to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null then
    raise exception '0291 requiere append_audit_event de Corte B1';
  end if;

  foreach v_table in array array[
    'renditions',
    'purchase_orders',
    'sales_orders',
    'prealertas'
  ] loop
    if to_regclass('public.' || v_table) is null then
      raise exception '0291 requiere public.%', v_table;
    end if;
  end loop;

  if to_regprocedure('public.audit_d3_commercial_change()') is not null
     or exists (
       select 1 from pg_trigger
       where tgname like 'audit_d3_%' and not tgisinternal
     ) then
    raise exception '0291 abortado: objetos D3 ya existen';
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
  ('rendition',      'active', 'commercial', 1, 'migration:0291'),
  ('purchase_order', 'active', 'commercial', 1, 'migration:0291'),
  ('sales_order',    'active', 'commercial', 1, 'migration:0291')
on conflict (entity_type) do update
set
  status = excluded.status,
  domain_code = excluded.domain_code,
  contract_version = greatest(
    public.audit_entity_types.contract_version,
    excluded.contract_version
  );

create function public.audit_d3_commercial_change()
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
  v_actor_id uuid := auth.uid();
  v_actor_type text := case when auth.uid() is null then 'system' else 'user' end;
  v_entity_id uuid;
  v_entity_type text;
  v_event_type text;
  v_reason text;
  v_before jsonb;
  v_after jsonb;
  v_changed boolean := true;
begin
  case tg_table_name
    when 'renditions' then
      v_entity_id := coalesce(
        nullif(v_new ->> 'id', '')::uuid,
        nullif(v_old ->> 'id', '')::uuid
      );
      v_entity_type := 'rendition';
      if tg_op = 'INSERT' then
        v_event_type := 'rendition_emitted';
      elsif v_old ->> 'status' = 'emitida'
            and v_new ->> 'status' = 'anulada' then
        v_event_type := 'rendition_voided';
        v_reason := coalesce(
          nullif(v_new ->> 'void_reason', ''),
          'Anulación confirmada en el flujo de rendiciones.'
        );
      else
        v_changed := false;
      end if;
      v_before := case when v_old is null then null else
        pg_catalog.jsonb_build_object(
          'rendition_code', v_old -> 'rendition_code',
          'status', v_old -> 'status',
          'period_from', v_old -> 'period_from',
          'period_to', v_old -> 'period_to',
          'receipt_count', v_old -> 'receipt_count'
        ) end;
      v_after := case when v_new is null then null else
        pg_catalog.jsonb_build_object(
          'rendition_code', v_new -> 'rendition_code',
          'status', v_new -> 'status',
          'period_from', v_new -> 'period_from',
          'period_to', v_new -> 'period_to',
          'receipt_count', v_new -> 'receipt_count'
        ) end;

    when 'purchase_orders' then
      v_entity_id := coalesce(
        nullif(v_new ->> 'id', '')::uuid,
        nullif(v_old ->> 'id', '')::uuid
      );
      v_entity_type := 'purchase_order';
      if tg_op = 'INSERT' then
        v_event_type := 'purchase_order_created';
      elsif tg_op = 'DELETE' then
        v_event_type := 'purchase_order_deleted';
        v_reason := 'Eliminación confirmada en el flujo de compras.';
      elsif v_old ->> 'deleted_at' is distinct from v_new ->> 'deleted_at' then
        v_event_type := 'purchase_order_deleted';
        v_reason := 'Eliminación confirmada en el flujo de compras.';
      elsif v_old ->> 'status' is distinct from v_new ->> 'status' then
        v_event_type := case v_new ->> 'status'
          when 'cancelada' then 'purchase_order_cancelled'
          when 'recibida' then 'purchase_order_received'
          else 'purchase_order_status_changed'
        end;
        if v_new ->> 'status' = 'cancelada' then
          v_reason := 'Cancelación confirmada en el flujo de compras.';
        end if;
      elsif v_old ->> 'bill_id' is distinct from v_new ->> 'bill_id' then
        v_event_type := 'purchase_order_bill_linked';
      else
        v_event_type := 'purchase_order_updated';
        v_changed :=
          v_old -> 'supplier_id' is distinct from v_new -> 'supplier_id'
          or v_old -> 'sales_order_id' is distinct from v_new -> 'sales_order_id';
      end if;
      v_before := case when v_old is null then null else
        pg_catalog.jsonb_build_object(
          'purchase_order_code', v_old -> 'purchase_order_code',
          'status', v_old -> 'status',
          'supplier_id', v_old -> 'supplier_id',
          'sales_order_id', v_old -> 'sales_order_id',
          'bill_id', v_old -> 'bill_id'
        ) end;
      v_after := case when v_new is null then null else
        pg_catalog.jsonb_build_object(
          'purchase_order_code', v_new -> 'purchase_order_code',
          'status', v_new -> 'status',
          'supplier_id', v_new -> 'supplier_id',
          'sales_order_id', v_new -> 'sales_order_id',
          'bill_id', v_new -> 'bill_id'
        ) end;

    when 'sales_orders' then
      v_entity_id := coalesce(
        nullif(v_new ->> 'id', '')::uuid,
        nullif(v_old ->> 'id', '')::uuid
      );
      v_entity_type := 'sales_order';
      if tg_op = 'INSERT' then
        v_event_type := case
          when v_new ->> 'quote_id' is null then 'sales_order_created'
          else 'sales_order_created_from_estimate'
        end;
      elsif tg_op = 'DELETE' then
        v_event_type := 'sales_order_deleted';
        v_reason := 'Eliminación confirmada en el flujo de ventas.';
      elsif v_old ->> 'deleted_at' is distinct from v_new ->> 'deleted_at' then
        v_event_type := 'sales_order_deleted';
        v_reason := 'Eliminación confirmada en el flujo de ventas.';
      elsif v_old ->> 'status' is distinct from v_new ->> 'status' then
        v_event_type := case v_new ->> 'status'
          when 'cancelada' then 'sales_order_cancelled'
          when 'facturada' then 'sales_order_invoiced'
          when 'parcial' then 'sales_order_partially_invoiced'
          else 'sales_order_status_changed'
        end;
        if v_new ->> 'status' = 'cancelada' then
          v_reason := 'Cancelación confirmada en el flujo de ventas.';
        end if;
      else
        v_event_type := 'sales_order_updated';
        v_changed :=
          v_old -> 'quote_id' is distinct from v_new -> 'quote_id'
          or v_old -> 'service' is distinct from v_new -> 'service';
      end if;
      v_before := case when v_old is null then null else
        pg_catalog.jsonb_build_object(
          'sales_order_code', v_old -> 'sales_order_code',
          'status', v_old -> 'status',
          'quote_id', v_old -> 'quote_id',
          'service', v_old -> 'service'
        ) end;
      v_after := case when v_new is null then null else
        pg_catalog.jsonb_build_object(
          'sales_order_code', v_new -> 'sales_order_code',
          'status', v_new -> 'status',
          'quote_id', v_new -> 'quote_id',
          'service', v_new -> 'service'
        ) end;

    when 'prealertas' then
      v_entity_id := coalesce(
        nullif(v_new ->> 'sales_order_id', '')::uuid,
        nullif(v_old ->> 'sales_order_id', '')::uuid
      );
      if v_entity_id is null
         or v_old ->> 'sales_order_id' is not distinct from v_new ->> 'sales_order_id' then
        v_changed := false;
      else
        v_entity_type := 'sales_order';
        v_event_type := case
          when v_new ->> 'sales_order_id' is null
            then 'sales_order_prealert_unassigned'
          else 'sales_order_prealert_assigned'
        end;
        v_before := pg_catalog.jsonb_build_object(
          'prealert_id', v_old -> 'id',
          'sales_order_id', v_old -> 'sales_order_id'
        );
        v_after := pg_catalog.jsonb_build_object(
          'prealert_id', v_new -> 'id',
          'sales_order_id', v_new -> 'sales_order_id'
        );
      end if;

    else
      raise exception '0291: tabla no allowlisted: %', tg_table_name;
  end case;

  if v_changed then
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
      pg_catalog.concat(
        'd3:', tg_table_name, ':', v_entity_id::text, ':',
        pg_catalog.txid_current()::text
      ),
      1,
      'restricted'
    );
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

alter function public.audit_d3_commercial_change() owner to postgres;
revoke all on function public.audit_d3_commercial_change() from public;
revoke all on function public.audit_d3_commercial_change() from anon;
revoke all on function public.audit_d3_commercial_change() from authenticated;

create trigger audit_d3_renditions
after insert or update on public.renditions
for each row execute function public.audit_d3_commercial_change();

create trigger audit_d3_purchase_orders
after insert or update or delete on public.purchase_orders
for each row execute function public.audit_d3_commercial_change();

create trigger audit_d3_sales_orders
after insert or update or delete on public.sales_orders
for each row execute function public.audit_d3_commercial_change();

create trigger audit_d3_prealertas
after update of sales_order_id on public.prealertas
for each row execute function public.audit_d3_commercial_change();

do $postcondition$
begin
  if (
    select pg_catalog.count(*)
    from pg_trigger
    where tgname = any (array[
      'audit_d3_renditions',
      'audit_d3_purchase_orders',
      'audit_d3_sales_orders',
      'audit_d3_prealertas'
    ])
      and not tgisinternal
      and tgenabled = 'O'
  ) <> 4 then
    raise exception '0291: faltan triggers D3 habilitados';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'audit_d3_commercial_change'
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
  ) then
    raise exception '0291: trigger function sin SECURITY DEFINER/search_path';
  end if;
end;
$postcondition$;

reset statement_timeout;
reset lock_timeout;
