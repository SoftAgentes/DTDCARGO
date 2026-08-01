-- SDD-0188 · D3 R3 · motivos humanos en cancelaciones comerciales.
--
-- Cada RPC valida el motivo, lo fija sólo para su transacción y ejecuta una
-- única transición allowlisted. El trigger D3 conserva la escritura del evento
-- y el wrapper de SDD-0187 sustituye la frase legacy por el motivo humano.

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_signature text;
begin
  if to_regprocedure(
    'public.append_audit_event_v1(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null then
    raise exception '0295 requiere SDD-0187 / migración 0294';
  end if;

  if to_regprocedure('public.audit_d3_commercial_change()') is null then
    raise exception '0295 requiere D3 / migración 0291';
  end if;

  foreach v_signature in array array[
    'public.cancel_purchase_order_with_audit_reason(uuid,text)',
    'public.cancel_sales_order_with_audit_reason(uuid,text)'
  ] loop
    if to_regprocedure(v_signature) is not null then
      raise exception '0295 abortado: % ya existe', v_signature;
    end if;
  end loop;
end;
$preflight$;

create function public.cancel_purchase_order_with_audit_reason(
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

  update public.purchase_orders
  set status = 'cancelada'
  where id = p_id
    and status in ('borrador', 'confirmada')
    and deleted_at is null;

  return found;
end;
$function$;

create function public.cancel_sales_order_with_audit_reason(
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

  update public.sales_orders
  set status = 'cancelada'
  where id = p_id
    and status in ('confirmada', 'parcial')
    and deleted_at is null;

  return found;
end;
$function$;

alter function public.cancel_purchase_order_with_audit_reason(uuid,text)
  owner to postgres;
alter function public.cancel_sales_order_with_audit_reason(uuid,text)
  owner to postgres;

revoke all on function public.cancel_purchase_order_with_audit_reason(uuid,text)
  from public, anon;
revoke all on function public.cancel_sales_order_with_audit_reason(uuid,text)
  from public, anon;

grant execute on function public.cancel_purchase_order_with_audit_reason(uuid,text)
  to authenticated;
grant execute on function public.cancel_sales_order_with_audit_reason(uuid,text)
  to authenticated;

comment on function public.cancel_purchase_order_with_audit_reason(uuid,text) is
  'SDD-0188: cancela una OC elegible y conserva el motivo humano en el evento D3 de la misma transacción.';
comment on function public.cancel_sales_order_with_audit_reason(uuid,text) is
  'SDD-0188: cancela una OV elegible y conserva el motivo humano en el evento D3 de la misma transacción.';

do $postcondition$
begin
  if (
    select pg_catalog.count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'cancel_purchase_order_with_audit_reason',
        'cancel_sales_order_with_audit_reason'
      ])
      and not p.prosecdef
      and p.proconfig @> array['search_path=""']
  ) <> 2 then
    raise exception '0295: RPC comerciales sin security-invoker/search_path vacío';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    join pg_roles r on r.oid = a.grantee
    where n.nspname = 'public'
      and p.proname = any (array[
        'cancel_purchase_order_with_audit_reason',
        'cancel_sales_order_with_audit_reason'
      ])
      and a.privilege_type = 'EXECUTE'
      and r.rolname = 'anon'
  ) then
    raise exception '0295: anon conserva EXECUTE';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    join pg_roles r on r.oid = a.grantee
    where n.nspname = 'public'
      and p.proname = any (array[
        'cancel_purchase_order_with_audit_reason',
        'cancel_sales_order_with_audit_reason'
      ])
      and a.privilege_type = 'EXECUTE'
      and r.rolname = 'authenticated'
  ) <> 2 then
    raise exception '0295: faltan grants authenticated exactos';
  end if;
end;
$postcondition$;

reset statement_timeout;
reset lock_timeout;
