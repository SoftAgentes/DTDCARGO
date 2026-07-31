-- SDD-0189 · D4 R3 · search_path vacío en las cinco RPC logísticas.
--
-- Cuatro cuerpos ya califican todas sus referencias no-pg_catalog. El cuerpo
-- vigente de operario_action conserva dos casts de enum sin esquema; se
-- cualifican de forma controlada antes de vaciar el path. No cambia firmas,
-- owner, ACL ni lógica de negocio.

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.operario_action(uuid,text,jsonb)',
    'public.stuff_box_as_operario(uuid,uuid,text,integer,integer,integer,boolean)',
    'public.unstuff_box_as_operario(uuid,text)',
    'public.stuff_lot_as_operario(uuid,uuid,text,integer,integer)',
    'public.unstuff_lot_as_operario(uuid,uuid)'
  ] loop
    if to_regprocedure(v_signature) is null then
      raise exception '0296 requiere %', v_signature;
    end if;
  end loop;

  if (
    select pg_catalog.count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'operario_action',
        'stuff_box_as_operario',
        'unstuff_box_as_operario',
        'stuff_lot_as_operario',
        'unstuff_lot_as_operario'
      ])
      and p.prosecdef
      and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      and p.proconfig @> array['search_path=pg_catalog, public']
  ) <> 5 then
    raise exception '0296 abortado: owner, SECURITY DEFINER o path legacy inesperado';
  end if;
end;
$preflight$;

do $qualify_operario_types$
declare
  v_oid oid := 'public.operario_action(uuid,text,jsonb)'::regprocedure::oid;
  v_before text;
  v_after text;
begin
  select pg_catalog.pg_get_functiondef(v_oid) into strict v_before;

  v_after := pg_catalog.replace(
    v_before,
    '::warehouse_receipt_event_type',
    '::public.warehouse_receipt_event_type'
  );
  v_after := pg_catalog.replace(
    v_after,
    '::warehouse_receipt_ve_status',
    '::public.warehouse_receipt_ve_status'
  );

  if v_after is distinct from v_before then
    execute v_after;
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.operario_action(uuid,text,jsonb)'::regprocedure
  ) into strict v_after;

  if v_after ~ '::(warehouse_receipt_event_type|warehouse_receipt_ve_status)' then
    raise exception '0296: operario_action conserva casts de enum sin esquema';
  end if;
end;
$qualify_operario_types$;

alter function public.operario_action(uuid,text,jsonb)
  set search_path = '';
alter function public.stuff_box_as_operario(
  uuid,uuid,text,integer,integer,integer,boolean
) set search_path = '';
alter function public.unstuff_box_as_operario(uuid,text)
  set search_path = '';
alter function public.stuff_lot_as_operario(uuid,uuid,text,integer,integer)
  set search_path = '';
alter function public.unstuff_lot_as_operario(uuid,uuid)
  set search_path = '';

do $postcondition$
begin
  if (
    select pg_catalog.count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'operario_action',
        'stuff_box_as_operario',
        'unstuff_box_as_operario',
        'stuff_lot_as_operario',
        'unstuff_lot_as_operario'
      ])
      and p.prosecdef
      and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      and p.proconfig @> array['search_path=""']
  ) <> 5 then
    raise exception '0296: las cinco RPC no tienen owner/path vacío esperado';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'operario_action',
        'stuff_box_as_operario',
        'unstuff_box_as_operario',
        'stuff_lot_as_operario',
        'unstuff_lot_as_operario'
      ])
      and pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      and not pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) <> 5 then
    raise exception '0296: ACL service_role-only inesperado';
  end if;
end;
$postcondition$;

reset statement_timeout;
reset lock_timeout;
