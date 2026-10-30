\set ON_ERROR_STOP on

-- SDD-0586 · contrato de 0505 (segmento del contacto, respuestas del bot y BSUID).
--
-- Monta lo mínimo que 0505 da por sentado, con la forma de las migraciones
-- reales: tenants, clients (markbox, phone_last10 de 0383, merged_into_client_id
-- de 0341, deleted_at), client_markbox_history (0367), shipments con su enum de
-- estados (0002) y warehouse_receipts_cn con el suyo (0008). Después aplica la
-- 0505 REAL.
--
-- CONTROL ROJO: sin 0505 cae en la primera aserción (la función no existe).
--
-- Termina siempre en ROLLBACK. Solo ids, códigos y teléfonos sintéticos (555).
begin;

do $roles$
begin
  if to_regprocedure('public.chatwoot_segmento_contacto(uuid,text)') is not null then
    raise exception 'Fixture 0505 rechazada: el objeto real ya existe';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

create table public.tenants (id uuid primary key, slug text);

-- Forma de 0383 (phone_last10 generada) + 0341 (merged_into_client_id).
create table public.clients (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  markbox text not null,
  phone text,
  merged_into_client_id uuid references public.clients(id),
  deleted_at timestamptz,
  phone_last10 text generated always as (
    case when length(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) >= 10
         then right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) end
  ) stored,
  unique (tenant_id, markbox)
);

-- Forma de 0367.
create table public.client_markbox_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  client_id uuid not null references public.clients(id),
  markbox text not null
);

-- Forma de 0002.
create type public.shipment_status as enum (
  'draft', 'in_warehouse', 'consolidating', 'shipped', 'in_transit', 'in_customs',
  'arrived_destination', 'delayed_warehouse', 'out_for_delivery', 'last_mile',
  'delivered', 'exception', 'cancelled'
);
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  client_markbox text,
  status public.shipment_status not null default 'draft',
  deleted_at timestamptz
);

-- Forma de 0008.
create type public.warehouse_receipt_status as enum ('pendiente_consolidacion', 'consolidado', 'incidencia');
create table public.warehouse_receipts_cn (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  client_markbox text,
  is_orphan boolean not null default false,
  status public.warehouse_receipt_status not null default 'pendiente_consolidacion',
  deleted_at timestamptz
);

insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001', 'dtd'),
  ('10000000-0000-0000-0000-000000000002', 'otro');

-- T1. Cada ficha tiene su teléfono 412-555-02NN; el NN es el caso.
insert into public.clients (id, tenant_id, markbox, phone, merged_into_client_id, deleted_at) values
  -- 01 envío vivo · 02 solo recibo en China · 03 sin nada
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'DTD-1001', '+58 412-555-0201', null, null),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'DTD-1002', '+584125550202', null, null),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'DTD-1003', '0412 555 0203', null, null),
  -- 04 ambiguo: dos fichas vivas con el mismo teléfono, una con envío
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'DTD-1004', '+584125550204', null, null),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'DTD-1005', '04125550204', null, null),
  -- 06 envío con un código de su historial
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'DTD-1006', '+584125550206', null, null),
  -- 07 sobreviviente; 08 fusionada en 07 (borrada, mismo teléfono) con envío
  ('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'DTD-1007', '+584125550207', null, null),
  -- 10 sobreviviente; 11 fusionada en 10 con un código histórico; 12 fusionada en 11 (dos saltos)
  ('30000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'DTD-1010', '+584125550210', null, null),
  -- 13 solo borrador, cancelado, envío borrado y recibo borrado
  ('30000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 'DTD-1013', '+584125550213', null, null),
  -- 14 recibo en incidencia · 15 recibo huérfano con su código escrito
  ('30000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', 'DTD-1014', '+584125550214', null, null),
  ('30000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000001', 'DTD-1015', '+584125550215', null, null),
  -- 16 ficha borrada con envío vivo
  ('30000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000001', 'DTD-1016', '+584125550216', null, now()),
  -- 17 pierde su único envío
  ('30000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000001', 'DTD-1017', '+584125550217', null, null),
  -- 18 código guardado con minúsculas y espacios; el envío lo escribe distinto
  ('30000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000001', 'dtd-1018 ', '+584125550218', null, null);
insert into public.clients (id, tenant_id, markbox, phone, merged_into_client_id, deleted_at) values
  ('30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'DTD-1008', '+584125550207', '30000000-0000-0000-0000-000000000007', now()),
  ('30000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'DTD-1011', null, '30000000-0000-0000-0000-000000000010', now());
insert into public.clients (id, tenant_id, markbox, phone, merged_into_client_id, deleted_at) values
  ('30000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'DTD-1012', null, '30000000-0000-0000-0000-000000000011', now());
-- T2: 19 con un teléfono que no existe en T1; su código tiene envío, pero en T1.
insert into public.clients (id, tenant_id, markbox, phone) values
  ('30000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000002', 'DTD-1019', '+584125550219');

insert into public.client_markbox_history (tenant_id, client_id, markbox) values
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006', 'DTD-0906'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000011', 'DTD-0911');

insert into public.shipments (tenant_id, client_markbox, status, deleted_at) values
  ('10000000-0000-0000-0000-000000000001', 'DTD-1001', 'in_transit', null),
  ('10000000-0000-0000-0000-000000000001', 'DTD-1004', 'delivered', null),
  ('10000000-0000-0000-0000-000000000001', ' dtd-0906', 'in_warehouse', null),
  ('10000000-0000-0000-0000-000000000001', 'DTD-1008', 'delivered', null),
  ('10000000-0000-0000-0000-000000000001', 'DTD-1013', 'draft', null),
  ('10000000-0000-0000-0000-000000000001', 'DTD-1013', 'cancelled', null),
  ('10000000-0000-0000-0000-000000000001', 'DTD-1013', 'in_transit', now()),
  ('10000000-0000-0000-0000-000000000001', 'DTD-1016', 'in_transit', null),
  ('10000000-0000-0000-0000-000000000001', 'DTD-1017', 'shipped', null),
  ('10000000-0000-0000-0000-000000000001', 'DTD-1018', 'exception', null),
  ('10000000-0000-0000-0000-000000000001', 'DTD-1019', 'in_transit', null);

insert into public.warehouse_receipts_cn (tenant_id, client_markbox, is_orphan, status, deleted_at) values
  ('10000000-0000-0000-0000-000000000001', 'DTD-1002', false, 'pendiente_consolidacion', null),
  ('10000000-0000-0000-0000-000000000001', 'DTD-1013', false, 'consolidado', now()),
  ('10000000-0000-0000-0000-000000000001', 'DTD-1014', false, 'incidencia', null),
  ('10000000-0000-0000-0000-000000000001', 'DTD-1015', true, 'pendiente_consolidacion', null),
  ('10000000-0000-0000-0000-000000000001', null, true, 'pendiente_consolidacion', null);

\ir ../migrations/0505_chatwoot_segmento.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0505: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Llama la función como service_role (lo que hace el manejador del webhook).
create function pg_temp.segmento(p_phone text, p_tenant uuid default '10000000-0000-0000-0000-000000000001')
returns text language plpgsql as $$
declare v text;
begin
  set local role service_role;
  v := public.chatwoot_segmento_contacto(p_tenant, p_phone);
  reset role;
  return v;
end;
$$;

create function pg_temp.reservar(p_conv bigint, p_tipo text default 'redireccion_cliente') returns boolean language plpgsql as $$
declare v boolean;
begin
  set local role service_role;
  v := public.chatwoot_reservar_respuesta('10000000-0000-0000-0000-000000000001', p_conv, p_tipo);
  reset role;
  return v;
end;
$$;

create function pg_temp.cerrar(p_conv bigint, p_enviada boolean) returns boolean language plpgsql as $$
declare v boolean;
begin
  set local role service_role;
  v := public.chatwoot_cerrar_respuesta('10000000-0000-0000-0000-000000000001', p_conv, p_enviada);
  reset role;
  return v;
end;
$$;

create function pg_temp.bsuid(p_bsuid text, p_conv bigint) returns void language plpgsql as $$
begin
  set local role service_role;
  perform public.chatwoot_guardar_bsuid('10000000-0000-0000-0000-000000000001', p_bsuid, p_conv);
  reset role;
end;
$$;

-- ── 1. La regla de segmentos ──
do $segmento$
begin
  perform pg_temp.assert_true(pg_temp.segmento('4125550201') = 'cliente', 'cliente por envío vivo');
  perform pg_temp.assert_true(pg_temp.segmento('4125550202') = 'cliente', 'cliente solo por recibo en China');
  perform pg_temp.assert_true(pg_temp.segmento('4125550203') = 'lead_registrado', 'registrado sin envío ni recibo');
  perform pg_temp.assert_true(pg_temp.segmento('4125550299') = 'lead_nuevo', 'teléfono que no está en clients es lead nuevo');
  perform pg_temp.assert_true(pg_temp.segmento('4125550204') = 'lead_nuevo', 'teléfono ambiguo es lead nuevo aunque una ficha tenga envío');
  perform pg_temp.assert_true(pg_temp.segmento('4125550206') = 'cliente', 'envío con un código del historial cuenta');
  perform pg_temp.assert_true(pg_temp.segmento('4125550207') = 'cliente', 'envío con el código de una ficha fusionada cuenta y la fusionada borrada no vuelve ambiguo el teléfono');
  perform pg_temp.assert_true(pg_temp.segmento('4125550210') = 'lead_registrado', 'sobreviviente sin envíos propios ni de sus fusionadas es registrado');
  perform pg_temp.assert_true(pg_temp.segmento('4125550213') = 'lead_registrado', 'borrador, cancelado, envío borrado y recibo borrado no cuentan');
  perform pg_temp.assert_true(pg_temp.segmento('4125550214') = 'cliente', 'recibo en incidencia cuenta');
  perform pg_temp.assert_true(pg_temp.segmento('4125550215') = 'lead_registrado', 'recibo huérfano no cuenta aunque tenga el código');
  perform pg_temp.assert_true(pg_temp.segmento('4125550216') = 'lead_nuevo', 'una ficha borrada no cruza');
  perform pg_temp.assert_true(pg_temp.segmento('4125550218') = 'cliente', 'los códigos se comparan sin mayúsculas ni espacios');
  perform pg_temp.assert_true(pg_temp.segmento('4125550219') = 'lead_nuevo', 'el teléfono de otro tenant no cruza');
  perform pg_temp.assert_true(
    pg_temp.segmento('4125550219', '10000000-0000-0000-0000-000000000002') = 'lead_registrado',
    'un envío de otro tenant con el mismo código no cuenta');
  perform pg_temp.assert_true(pg_temp.segmento(null) = 'lead_nuevo' and pg_temp.segmento('555') = 'lead_nuevo'
    and pg_temp.segmento('41255502011') = 'lead_nuevo' and pg_temp.segmento('412555020a') = 'lead_nuevo',
    'un teléfono que no son 10 dígitos es lead nuevo');
end;
$segmento$;

-- Dos saltos de fusión: el historial de la intermedia y el código de la del fondo.
insert into public.shipments (tenant_id, client_markbox, status) values
  ('10000000-0000-0000-0000-000000000001', 'DTD-0911', 'in_customs');
do $fusion$
begin
  perform pg_temp.assert_true(pg_temp.segmento('4125550210') = 'cliente', 'envío con el historial de una ficha fusionada cuenta');
end;
$fusion$;
delete from public.shipments where client_markbox = 'DTD-0911';
insert into public.warehouse_receipts_cn (tenant_id, client_markbox, status) values
  ('10000000-0000-0000-0000-000000000001', 'DTD-1012', 'consolidado');
do $fusion2$
begin
  perform pg_temp.assert_true(pg_temp.segmento('4125550210') = 'cliente', 'recibo con el código de una fusionada a dos saltos cuenta');
end;
$fusion2$;

-- Quien pierde su único envío vuelve a registrado, sin guardar nada.
do $pierde$
begin
  perform pg_temp.assert_true(pg_temp.segmento('4125550217') = 'cliente', 'antes de perder el envío es cliente');
end;
$pierde$;
update public.shipments set status = 'cancelled' where client_markbox = 'DTD-1017';
do $pierde2$
begin
  perform pg_temp.assert_true(pg_temp.segmento('4125550217') = 'lead_registrado', 'al cancelar su único envío vuelve a registrado');
end;
$pierde2$;
update public.shipments set status = 'shipped', deleted_at = now() where client_markbox = 'DTD-1017';
do $pierde3$
begin
  perform pg_temp.assert_true(pg_temp.segmento('4125550217') = 'lead_registrado', 'al borrar su único envío vuelve a registrado');
end;
$pierde3$;

do $tenant$
begin
  begin
    perform pg_temp.segmento('4125550201', null);
    perform pg_temp.assert_true(false, 'sin tenant falla');
  exception when sqlstate '22023' then
    perform pg_temp.assert_true(true, 'sin tenant falla');
  end;
end;
$tenant$;

-- ── 2. Respuestas del bot: una por conversación cada 24 h ──
do $respuestas$
begin
  perform pg_temp.assert_true(pg_temp.reservar(501), 'la primera respuesta se reserva');
  perform pg_temp.assert_true(not pg_temp.reservar(501), 'no se responde dos veces mientras la reserva está viva');
  perform pg_temp.assert_true(pg_temp.cerrar(501, true), 'la respuesta enviada se confirma');
  perform pg_temp.assert_true(not pg_temp.reservar(501), 'no se responde dos veces dentro de 24 h');
  perform pg_temp.assert_true(pg_temp.reservar(502, 'neutra_sin_telefono'), 'otra conversación se reserva aparte');
  perform pg_temp.assert_true(pg_temp.cerrar(502, false), 'una reserva no enviada se libera');
  perform pg_temp.assert_true(pg_temp.reservar(502, 'neutra_sin_telefono'), 'una reserva liberada se puede volver a tomar');
  perform pg_temp.assert_true(not pg_temp.cerrar(501, false), 'liberar no borra una respuesta ya enviada');
end;
$respuestas$;
update public.chatwoot_respuestas_bot set enviada_at = now() - interval '25 hours' where conversation_id = 501;
update public.chatwoot_respuestas_bot set reservada_at = now() - interval '11 minutes' where conversation_id = 502;
do $tiempo$
begin
  perform pg_temp.assert_true(pg_temp.reservar(501), 'pasadas 24 h se puede responder otra vez');
  perform pg_temp.assert_true(pg_temp.reservar(502, 'neutra_sin_telefono'), 'una reserva sin confirmar de hace más de 10 min se reclama');
  perform pg_temp.assert_true(not pg_temp.reservar(502, 'neutra_sin_telefono'), 'una reserva reclamada no se reclama dos veces');
end;
$tiempo$;

-- ── 3. BSUID ──
do $bsuid$
declare v_conv bigint;
begin
  perform pg_temp.bsuid('VE.5550000000000000001', 601);
  perform pg_temp.bsuid('VE.5550000000000000001', 602);
  select conversation_id into v_conv from public.chatwoot_contactos_bsuid where bsuid = 'VE.5550000000000000001';
  perform pg_temp.assert_true(
    (select count(*) from public.chatwoot_contactos_bsuid) = 1 and v_conv = 602,
    'el mismo BSUID es una fila con su última conversación');
  begin
    perform pg_temp.bsuid('584125550201', 603);
    perform pg_temp.assert_true(false, 'un teléfono no se guarda como BSUID');
  exception when check_violation then
    perform pg_temp.assert_true(true, 'un teléfono no se guarda como BSUID');
  end;
end;
$bsuid$;

-- ── 4. Acceso y datos ──
do $acceso$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.chatwoot_segmento_contacto(uuid, text)',
    'public.chatwoot_reservar_respuesta(uuid, bigint, text)',
    'public.chatwoot_cerrar_respuesta(uuid, bigint, boolean)',
    'public.chatwoot_guardar_bsuid(uuid, text, bigint)'
  ] loop
    perform pg_temp.assert_true(
      has_function_privilege('service_role', v_fn, 'EXECUTE')
      and not has_function_privilege('authenticated', v_fn, 'EXECUTE')
      and not has_function_privilege('anon', v_fn, 'EXECUTE'),
      'las funciones son solo de service_role: ' || v_fn);
    perform pg_temp.assert_true(exists (
      select 1 from pg_proc p
      where p.oid = v_fn::regprocedure and p.prosecdef and p.proconfig = array['search_path=""']
    ), 'security definer con search_path vacío: ' || v_fn);
  end loop;
  perform pg_temp.assert_true(
    not has_table_privilege('authenticated', 'public.chatwoot_respuestas_bot', 'SELECT')
    and not has_table_privilege('anon', 'public.chatwoot_respuestas_bot', 'SELECT')
    and not has_table_privilege('authenticated', 'public.chatwoot_contactos_bsuid', 'SELECT')
    and not has_table_privilege('anon', 'public.chatwoot_contactos_bsuid', 'SELECT'),
    'las tablas nuevas no se leen desde la API');
  perform pg_temp.assert_true(exists (
    select 1 from pg_proc p
    where p.oid = 'public.chatwoot_segmento_contacto(uuid, text)'::regprocedure
      and p.prorettype = 'text'::regtype and not p.proretset and p.provolatile = 's'
  ), 'el segmento es un solo texto, sin filas ni ids, y estable');
  perform pg_temp.assert_true(not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name in ('chatwoot_respuestas_bot', 'chatwoot_contactos_bsuid')
      and column_name ~ '(phone|telefono|content|texto|name|nombre|email|correo|markbox)'
  ), 'ninguna columna guarda teléfono, texto, nombre, correo ni código');
end;
$acceso$;

select 'TEST 0505 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
