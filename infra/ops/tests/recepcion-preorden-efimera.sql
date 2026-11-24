\set ON_ERROR_STOP on
-- Caracterización de la SDD-0713. El harness llama este archivo exclusivamente
-- en su contenedor desechable, con todo el esquema y la semilla sintética.
begin;
create function pg_temp.comprobar_alta(caso text, recepcion uuid, facturas_antes bigint) returns void
language plpgsql as $$
begin
  if not exists (select from public.warehouse_receipts_cn where id = recepcion and status = 'pendiente_consolidacion')
      or not exists (select from public.warehouse_receipt_events where receipt_id = recepcion and event_type = 'received') then
    raise exception '%: no se completó la recepción', caso;
  end if;
  if (select count(*) from public.invoices) <> facturas_antes then
    raise exception '%: cambió la cantidad de facturas al recibir. Revisar la caracterización de la preorden', caso;
  end if;
  raise notice '%: recepción registrada, cero facturas nuevas (incluidos borradores)', caso;
end $$;

do $prueba$
declare
  operario constant uuid := '05400000-0000-4000-8000-000000000202';
  compra constant uuid := '05400000-0000-4000-8000-000000000302';
  empresa uuid;
  almacen uuid;
  marca text;
  orden uuid;
  recepcion uuid;
  caja text;
  facturas_antes bigint;
  caso text;
begin
  select tenant_id, warehouse_id into strict empresa, almacen from public.operario_pins where id = operario and region = 'cn';
  select client_markbox into strict marca from public.prealertas where id = compra and tenant_id = empresa;
  insert into public.sales_orders (tenant_id, sales_order_code, client_markbox, client_name)
    values (empresa, 'OV-PRUEBA-0713', marca, 'Cliente inventado') returning id into orden;
  update public.prealertas set sales_order_id = orden where id = compra;
  foreach caso in array array['Studio identificada', 'Studio con orden de venta previa', 'Studio huérfana'] loop
    select count(*) into facturas_antes from public.invoices;
    insert into public.warehouse_receipts_cn (tenant_id, warehouse_id, client_markbox, is_orphan, boxes)
      values (empresa, almacen, case when caso <> 'Studio huérfana' then marca end, caso = 'Studio huérfana', 1)
      returning id into recepcion;
    insert into public.warehouse_receipt_items (tenant_id, receipt_id, description, quantity)
      values (empresa, recepcion, 'Caja de práctica', 1);
    insert into public.warehouse_receipt_events (tenant_id, receipt_id, event_type, description)
      values (empresa, recepcion, 'received', 'Recepción inventada');
    if caso = 'Studio con orden de venta previa' then
      update public.warehouse_receipts_cn set sales_order_id = orden, prealerta_id = compra where id = recepcion;
    end if;
    perform pg_temp.comprobar_alta(caso, recepcion, facturas_antes);
  end loop;

  select count(*) into facturas_antes from public.invoices;
  select receipt_id into strict recepcion from public.create_receipt_as_operario(
    operario, almacen, false, marca, 'Cliente inventado', null, null, null, null, 1,
    null, null, current_date, null, '[{"description":"Caja de práctica","quantity":1}]'::jsonb, false, null, null);
  perform pg_temp.comprobar_alta('Móvil, alta directa', recepcion, facturas_antes);

  foreach caso in array array['Móvil, prealerta por conteo','Móvil, cajas seleccionadas'] loop
    select code into strict caja from public.warehouse_boxes
      where prealerta_id = compra and receipt_id is null and status = 'esperada' and deleted_at is null order by seq limit 1;
    select count(*) into facturas_antes from public.invoices;
    if caso = 'Móvil, prealerta por conteo' then
      recepcion := (public.receive_prealerta_as_operario(operario, caja, 1)->>'receipt_id')::uuid;
    else
      recepcion := (public.receive_prealerta_boxes_as_operario(operario, caja, array[caja])->>'receipt_id')::uuid;
    end if;
    perform pg_temp.comprobar_alta(caso, recepcion, facturas_antes);
  end loop;
end $prueba$;
rollback;
