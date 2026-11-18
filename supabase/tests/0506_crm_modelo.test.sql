\set ON_ERROR_STOP on

-- SDD-0587 · contrato de 0506 (modelo de datos del CRM propio, paso 6.2).
--
-- Monta lo mínimo que 0505 y 0506 dan por sentado, con la forma de las
-- migraciones reales: tenants, user_tenants, auth.users, get_user_tenant_id
-- (0453), is_tenant_admin (0386), current_studio_role (0200), clients (0383,
-- 0341), client_markbox_history (0367), shipments (0002) y warehouse_receipts_cn
-- (0008). Después aplica la 0505 REAL y la 0506 REAL.
--
-- CONTROL ROJO: sin 0506 cae en la primera aserción (el núcleo no existe).
--
-- Termina siempre en ROLLBACK. Solo ids, códigos, nombres y teléfonos
-- sintéticos (555); ningún dato de una persona real.
begin;

do $roles$
begin
  if to_regclass('public.crm_tarjetas') is not null then
    raise exception 'Fixture 0506 rechazada: el objeto real ya existe';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table auth.users (id uuid primary key);

create table public.tenants (id uuid primary key, slug text);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
grant select on public.user_tenants to authenticated;

-- Copia de 0453.
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1]
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid())
    and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
grant execute on function public.get_user_tenant_id() to authenticated;

-- Copia de 0386.
create function public.is_tenant_admin() returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce(exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = (select public.get_user_tenant_id())
      and ut.role = 'admin'
      and ut.disabled_at is null
  ), false);
$fn$;
grant execute on function public.is_tenant_admin() to authenticated;

-- Copia de 0200.
create function public.current_studio_role() returns text
language sql stable security definer set search_path = public as $$
  select role
  from public.user_tenants
  where user_id = (select auth.uid())
    and disabled_at is null
  limit 1
$$;
grant execute on function public.current_studio_role() to authenticated;

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
insert into auth.users values
  ('20000000-0000-0000-0000-000000000001'), ('20000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000003'), ('20000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000005');
-- 01 admin T1 · 02 comercial T1 · 03 admin T2 · 04 operaciones T1 · 05 comercial T1 desactivado
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin', null),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'commercial', null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'admin', null),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'operations', null),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'commercial', now());

-- Fichas de T1: teléfono 412-555-02NN, el NN es el caso (los mismos de 0505).
insert into public.clients (id, tenant_id, markbox, phone, merged_into_client_id, deleted_at) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'DTD-1001', '+584125550201', null, null),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'DTD-1002', '+584125550202', null, null),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'DTD-1003', '+584125550203', null, null),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'DTD-1004', '+584125550204', null, null),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'DTD-1005', '04125550204', null, null),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'DTD-1006', '+584125550206', null, null),
  ('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'DTD-1007', '+584125550207', null, null),
  ('30000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'DTD-1010', '+584125550210', null, null),
  ('30000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 'DTD-1013', '+584125550213', null, null),
  ('30000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', 'DTD-1014', '+584125550214', null, null),
  ('30000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000001', 'DTD-1015', '+584125550215', null, null),
  ('30000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000001', 'DTD-1016', '+584125550216', null, now()),
  ('30000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000001', 'DTD-1017', '+584125550217', null, null),
  ('30000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000001', 'dtd-1018 ', '+584125550218', null, null);
-- 08 fusionada en 07 (borrada); 11 en 10 y 12 en 11 (dos saltos).
insert into public.clients (id, tenant_id, markbox, phone, merged_into_client_id, deleted_at) values
  ('30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'DTD-1008', null, '30000000-0000-0000-0000-000000000007', now()),
  ('30000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'DTD-1011', null, '30000000-0000-0000-0000-000000000010', now());
insert into public.clients (id, tenant_id, markbox, phone, merged_into_client_id, deleted_at) values
  ('30000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'DTD-1012', null, '30000000-0000-0000-0000-000000000011', now());
-- T2: 19, con envío propio.
insert into public.clients (id, tenant_id, markbox, phone) values
  ('30000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000002', 'DTD-1019', '+584125550219');

insert into public.client_markbox_history (tenant_id, client_id, markbox) values
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006', 'DTD-0906');

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
  -- En T2 hay un envío con el código de la 03 de T1: no cuenta para T1.
  ('10000000-0000-0000-0000-000000000002', 'DTD-1003', 'in_transit', null),
  ('10000000-0000-0000-0000-000000000002', 'DTD-1019', 'in_transit', null);

insert into public.warehouse_receipts_cn (tenant_id, client_markbox, is_orphan, status, deleted_at) values
  ('10000000-0000-0000-0000-000000000001', 'DTD-1002', false, 'pendiente_consolidacion', null),
  ('10000000-0000-0000-0000-000000000001', 'DTD-1012', false, 'consolidado', null),
  ('10000000-0000-0000-0000-000000000001', 'DTD-1013', false, 'consolidado', now()),
  ('10000000-0000-0000-0000-000000000001', 'DTD-1014', false, 'incidencia', null),
  ('10000000-0000-0000-0000-000000000001', 'DTD-1015', true, 'pendiente_consolidacion', null);

\ir ../migrations/0505_chatwoot_segmento.sql
\ir ../migrations/0506_crm_modelo.sql

-- T3 nace después de la 0506: sus etapas las siembra el trigger.
insert into public.tenants values ('10000000-0000-0000-0000-000000000003', 'nuevo');

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0506: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Corre un SQL como un usuario (authenticated con su sub) o, con null, como service_role.
create function pg_temp.como(p_user uuid, p_sql text) returns void language plpgsql as $$
begin
  if p_user is null then
    set local role service_role;
  else
    perform set_config('request.jwt.claim.sub', p_user::text, true);
    set local role authenticated;
  end if;
  execute p_sql;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

-- El primer valor de una consulta, como texto, corrida como un usuario.
create function pg_temp.valor(p_user uuid, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  if p_user is null then
    set local role service_role;
  else
    perform set_config('request.jwt.claim.sub', p_user::text, true);
    set local role authenticated;
  end if;
  execute 'select (' || p_sql || ')::text' into v;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v;
end;
$$;

-- Afirma que un SQL falla con un mensaje que coincide con el patrón.
create function pg_temp.falla(p_user uuid, p_sql text, p_patron text, p_label text) returns void language plpgsql as $$
declare v_msg text;
begin
  begin
    perform pg_temp.como(p_user, p_sql);
    v_msg := null;
  exception when others then
    v_msg := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.assert_true(v_msg is not null and v_msg ~ p_patron,
    p_label || ' (error: ' || coalesce(v_msg, 'ninguno') || ')');
end;
$$;

create function pg_temp.seg(p_client text) returns text language sql as $$
  select pg_temp.valor(null, format('public.crm_segmento_cliente(%L::uuid, %L::uuid)',
    '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000' || p_client));
$$;

-- ─── 1. Núcleo de la regla de segmentos ──────────────────────────────────────
do $regla$
begin
  perform pg_temp.assert_true(pg_temp.seg('01') = 'cliente', 'envío vivo es cliente');
  perform pg_temp.assert_true(pg_temp.seg('02') = 'cliente', 'cliente solo por recibo en China');
  perform pg_temp.assert_true(pg_temp.seg('03') = 'lead_registrado',
    'sin envíos propios es lead registrado: el envío de otro tenant con su código no cuenta');
  perform pg_temp.assert_true(pg_temp.seg('06') = 'cliente', 'envío con un código del historial cuenta, normalizado');
  perform pg_temp.assert_true(pg_temp.seg('07') = 'cliente', 'envío con el código de una ficha fusionada cuenta');
  perform pg_temp.assert_true(pg_temp.seg('10') = 'cliente', 'recibo con el código de una fusionada a dos saltos cuenta');
  perform pg_temp.assert_true(pg_temp.seg('13') = 'lead_registrado',
    'borrador, cancelado, envío borrado y recibo borrado no cuentan');
  perform pg_temp.assert_true(pg_temp.seg('14') = 'cliente', 'recibo en incidencia cuenta');
  perform pg_temp.assert_true(pg_temp.seg('15') = 'lead_registrado', 'recibo huérfano no cuenta');
  perform pg_temp.assert_true(pg_temp.seg('16') = 'lead_nuevo', 'ficha borrada no tiene segmento: lead nuevo');
  perform pg_temp.assert_true(pg_temp.seg('18') = 'cliente', 'código guardado con minúsculas y espacios cruza');
  perform pg_temp.assert_true(pg_temp.seg('19') = 'lead_nuevo', 'una ficha de otro tenant no tiene segmento aquí');

  perform pg_temp.assert_true(pg_temp.seg('17') = 'cliente', 'la 17 es cliente mientras tiene su envío');
  update public.shipments set status = 'cancelled' where client_markbox = 'DTD-1017';
  perform pg_temp.assert_true(pg_temp.seg('17') = 'lead_registrado',
    'quien pierde su único envío vuelve a lead registrado, sin guardar nada');
  update public.shipments set status = 'shipped' where client_markbox = 'DTD-1017';

  perform pg_temp.assert_true(pg_temp.valor(null, $q$
    select count(*) from public.crm_segmento_clientes('10000000-0000-0000-0000-000000000001',
      array['30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003',
            '30000000-0000-0000-0000-000000000016', '30000000-0000-0000-0000-000000000019']::uuid[])
  $q$) = '2', 'el conjunto omite la ficha borrada y la de otro tenant');

  perform pg_temp.assert_true(
    pg_temp.valor(null, $q$public.chatwoot_segmento_contacto('10000000-0000-0000-0000-000000000001', '4125550201')$q$) = 'cliente'
    and pg_temp.valor(null, $q$public.chatwoot_segmento_contacto('10000000-0000-0000-0000-000000000001', '4125550203')$q$) = 'lead_registrado'
    and pg_temp.valor(null, $q$public.chatwoot_segmento_contacto('10000000-0000-0000-0000-000000000001', '4125550204')$q$) = 'lead_nuevo'
    and pg_temp.valor(null, $q$public.chatwoot_segmento_contacto('10000000-0000-0000-0000-000000000001', '4125550299')$q$) = 'lead_nuevo',
    'el segmento por teléfono de la 0505 coincide con el núcleo y el ambiguo es lead nuevo');
  perform pg_temp.assert_true(
    pg_get_functiondef('public.chatwoot_segmento_contacto(uuid, text)'::regprocedure) ~ 'crm_segmento_cliente'
    and pg_get_functiondef('public.chatwoot_segmento_contacto(uuid, text)'::regprocedure) !~ 'shipments',
    'la regla vive una sola vez: la función de la 0505 delega en el núcleo');
end;
$regla$;

-- ─── 2. Etapas ───────────────────────────────────────────────────────────────
do $etapas$
begin
  perform pg_temp.assert_true((
    select count(*) filter (where tablero = 'leads') = 7 and count(*) filter (where tablero = 'clientes') = 4
       and bool_and(sistema)
    from public.crm_etapas where tenant_id = '10000000-0000-0000-0000-000000000001'
  ) and (select count(*) from public.crm_etapas where tenant_id = '10000000-0000-0000-0000-000000000002') = 11,
    'cada tenant existente tiene las 7 etapas de Leads y las 4 de Clientes');
  perform pg_temp.assert_true(
    (select count(*) from public.crm_etapas where tenant_id = '10000000-0000-0000-0000-000000000003') = 11,
    'un tenant nuevo recibe sus etapas por el trigger');
  perform pg_temp.assert_true(
    (select string_agg(clave, ',' order by orden) from public.crm_etapas
     where tenant_id = '10000000-0000-0000-0000-000000000001' and tablero = 'leads')
      = 'nuevo,contactado,registrado_recontacto,estimado_enviado,negociacion,aceptado_esperando_carga,perdido'
    and (select terminal from public.crm_etapas
         where tenant_id = '10000000-0000-0000-0000-000000000001' and clave = 'perdido'),
    'las etapas de Leads van en el orden de D1 y «perdido» es de cierre');

  perform pg_temp.como('20000000-0000-0000-0000-000000000002',
    $q$update public.crm_etapas set nombre = 'X' where clave = 'nuevo'$q$);
  perform pg_temp.assert_true(
    (select nombre from public.crm_etapas where tenant_id = '10000000-0000-0000-0000-000000000001' and clave = 'nuevo') = 'Nuevo',
    'un comercial no renombra etapas');
  perform pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$update public.crm_etapas set nombre = 'Entrante', orden = 5 where clave = 'nuevo'$q$);
  perform pg_temp.assert_true(
    (select nombre from public.crm_etapas where tenant_id = '10000000-0000-0000-0000-000000000001' and clave = 'nuevo') = 'Entrante'
    and (select nombre from public.crm_etapas where tenant_id = '10000000-0000-0000-0000-000000000002' and clave = 'nuevo') = 'Nuevo',
    'el admin renombra las etapas de su tenant y no las de otro');
  perform pg_temp.falla('20000000-0000-0000-0000-000000000001',
    $q$update public.crm_etapas set activa = false where clave = 'perdido'$q$, 'check constraint',
    'una etapa de sistema no se apaga');
  perform pg_temp.falla('20000000-0000-0000-0000-000000000001',
    $q$update public.crm_etapas set clave = 'otra' where clave = 'contactado'$q$, 'permission denied',
    'la clave de una etapa no cambia');
  perform pg_temp.falla('20000000-0000-0000-0000-000000000001',
    $q$insert into public.crm_etapas (tenant_id, tablero, clave, nombre, orden, sistema)
       values ('10000000-0000-0000-0000-000000000001', 'leads', 'propia', 'Propia', 70, true)$q$, 'permission denied',
    'nadie crea etapas de sistema desde la API');
  perform pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$insert into public.crm_etapas (tenant_id, tablero, clave, nombre, orden)
       values ('10000000-0000-0000-0000-000000000001', 'leads', 'propia', 'Propia', 70)$q$);
  perform pg_temp.como('20000000-0000-0000-0000-000000000001',
    $q$delete from public.crm_etapas where clave in ('propia', 'perdido')$q$);
  perform pg_temp.assert_true(
    (select count(*) from public.crm_etapas where tenant_id = '10000000-0000-0000-0000-000000000001') = 11
    and exists (select 1 from public.crm_etapas where tenant_id = '10000000-0000-0000-0000-000000000001' and clave = 'perdido'),
    'el admin crea y borra una etapa propia, pero no borra una de sistema');
  perform pg_temp.falla('20000000-0000-0000-0000-000000000002',
    $q$insert into public.crm_etapas (tenant_id, tablero, clave, nombre, orden)
       values ('10000000-0000-0000-0000-000000000001', 'leads', 'otra', 'Otra', 71)$q$, 'row-level security',
    'un comercial no crea etapas');
end;
$etapas$;

-- ─── 3. Tarjetas ─────────────────────────────────────────────────────────────
insert into public.crm_tarjetas (id, tenant_id, client_id, chatwoot_contact_id, bsuid, nombre_visible, phone_last10, fuente, utm_source) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, null, null, null, 'whatsapp_clientes', null),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', null, null, null, null, 'web_registro', 'google'),
  ('40000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000001', null, 501, null, 'Lead Prueba Uno', '4125550301', 'whatsapp_leads', null),
  ('40000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000001', null, null, 'VE.prueba-1', null, null, 'whatsapp_leads', null),
  ('40000000-0000-0000-0000-000000000031', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000019', null, null, null, null, 'portal', null);

do $tarjetas$
begin
  perform pg_temp.como('20000000-0000-0000-0000-000000000002', $q$
    insert into public.crm_tarjetas (tenant_id, nombre_visible, phone_last10, fuente, asesor_id)
    values ('10000000-0000-0000-0000-000000000001', 'Lead Prueba Dos', '4125550302', 'manual',
            '20000000-0000-0000-0000-000000000002')$q$);
  perform pg_temp.assert_true(
    (select etapa_leads = 'nuevo' and etapa_clientes = 'activo' from public.crm_tarjetas where phone_last10 = '4125550302'),
    'un comercial crea a mano un lead que entra en «Nuevo»');
  perform pg_temp.falla('20000000-0000-0000-0000-000000000002', $q$
    insert into public.crm_tarjetas (tenant_id, phone_last10, fuente)
    values ('10000000-0000-0000-0000-000000000001', '4125550303', 'kommo')$q$, 'row-level security',
    'desde Studio solo se crean tarjetas con fuente manual');
  perform pg_temp.falla(null, $q$
    insert into public.crm_tarjetas (tenant_id, fuente)
    values ('10000000-0000-0000-0000-000000000001', 'manual')$q$, 'check constraint',
    'una tarjeta sin ninguna llave no entra');

  perform pg_temp.assert_true(
    pg_temp.valor('20000000-0000-0000-0000-000000000002', 'select count(*) from public.crm_tarjetas') = '5'
    and pg_temp.valor('20000000-0000-0000-0000-000000000001', 'select count(*) from public.crm_tarjetas') = '5',
    'admin y comercial de T1 ven las 5 tarjetas de T1');
  perform pg_temp.assert_true(
    pg_temp.valor('20000000-0000-0000-0000-000000000003', 'select count(*) from public.crm_tarjetas') = '1',
    'el admin de T2 ve solo la tarjeta de T2');
  perform pg_temp.assert_true(
    pg_temp.valor('20000000-0000-0000-0000-000000000004', 'select count(*) from public.crm_tarjetas') = '0'
    and pg_temp.valor('20000000-0000-0000-0000-000000000004', 'select count(*) from public.crm_etapas') = '0',
    'quien no tiene el módulo CRM no ve tarjetas ni etapas');
  perform pg_temp.assert_true(
    pg_temp.valor('20000000-0000-0000-0000-000000000005', 'select count(*) from public.crm_tarjetas') = '0',
    'un comercial desactivado no ve tarjetas');

  perform pg_temp.falla('20000000-0000-0000-0000-000000000002',
    $q$update public.crm_tarjetas set etapa_leads = 'perdido' where id = '40000000-0000-0000-0000-000000000021'$q$,
    'permission denied', 'la etapa no se cambia con UPDATE: solo por RPC');
  perform pg_temp.falla(null,
    $q$update public.crm_tarjetas set utm_source = 'otro' where id = '40000000-0000-0000-0000-000000000003'$q$,
    'se fijan al crear', 'la fuente y la atribución no se pisan');
  perform pg_temp.falla(null, $q$
    insert into public.crm_tarjetas (tenant_id, client_id, fuente)
    values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000019', 'portal')$q$,
    'otro tenant', 'una ficha de otro tenant no se liga');
  perform pg_temp.falla(null, $q$
    update public.crm_tarjetas set asesor_id = '20000000-0000-0000-0000-000000000003'
    where id = '40000000-0000-0000-0000-000000000021'$q$,
    'el asesor no es del tenant', 'el asesor tiene que ser del tenant');
  perform pg_temp.falla(null, $q$
    insert into public.crm_tarjetas (tenant_id, client_id, fuente)
    values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'portal')$q$,
    'crm_tarjetas_client_uq', 'una ficha tiene una sola tarjeta');
  perform pg_temp.falla(null, $q$
    insert into public.crm_tarjetas (tenant_id, chatwoot_contact_id, fuente)
    values ('10000000-0000-0000-0000-000000000001', 501, 'whatsapp_leads')$q$,
    'crm_tarjetas_contacto_uq', 'un contacto de Chatwoot tiene una sola tarjeta');
  perform pg_temp.falla(null, $q$
    insert into public.crm_tarjetas (tenant_id, client_id, nombre_visible, fuente)
    values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'Copia', 'portal')$q$,
    'check constraint', 'con ficha, la tarjeta no copia nombre ni teléfono (D6)');
  perform pg_temp.falla(null, $q$
    insert into public.crm_tarjetas (tenant_id, bsuid, fuente)
    values ('10000000-0000-0000-0000-000000000001', '584125550299', 'whatsapp_leads')$q$,
    'check constraint', 'un teléfono no se guarda como BSUID');

  perform pg_temp.assert_true(
    pg_temp.valor('20000000-0000-0000-0000-000000000002', $q$
      select string_agg(tarjeta_id::text || '=' || segmento, ',' order by tarjeta_id)
      from public.crm_segmento_tarjetas(array['40000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000021',
        '40000000-0000-0000-0000-000000000031']::uuid[])$q$)
    = '40000000-0000-0000-0000-000000000001=cliente,40000000-0000-0000-0000-000000000003=lead_registrado,40000000-0000-0000-0000-000000000021=lead_nuevo',
    'el tablero sale del segmento en el momento y no ve tarjetas de otro tenant');
  perform pg_temp.falla('20000000-0000-0000-0000-000000000004',
    $q$select * from public.crm_segmento_tarjetas(array['40000000-0000-0000-0000-000000000001']::uuid[])$q$,
    'sin acceso al CRM', 'el segmento del tablero exige el módulo CRM');
end;
$tarjetas$;

-- ─── 4. Movimientos de etapa ─────────────────────────────────────────────────
do $mover$
declare
  v_1 text;
  v_2 text;
begin
  v_1 := pg_temp.valor('20000000-0000-0000-0000-000000000002',
    $q$public.crm_mover_etapa('40000000-0000-0000-0000-000000000021', 'leads', 'contactado')$q$);
  v_2 := pg_temp.valor('20000000-0000-0000-0000-000000000002',
    $q$public.crm_mover_etapa('40000000-0000-0000-0000-000000000021', 'leads', 'contactado')$q$);
  perform pg_temp.assert_true(v_1 = 'true' and v_2 = 'false',
    'mover a mano cambia la etapa una vez y la segunda no hace nada');
  perform pg_temp.assert_true((
    select count(*) = 1 and bool_and(de = 'nuevo' and a = 'contactado' and origen = 'manual'
                                     and actor_id = '20000000-0000-0000-0000-000000000002')
    from public.crm_historial_etapas where tarjeta_id = '40000000-0000-0000-0000-000000000021'),
    'el movimiento manual deja historial con quién lo hizo');
  perform pg_temp.falla('20000000-0000-0000-0000-000000000002',
    $q$select public.crm_mover_etapa('40000000-0000-0000-0000-000000000021', 'leads', 'perdido')$q$,
    'pide motivo', 'pasar a «Perdido» pide motivo');
  perform pg_temp.como('20000000-0000-0000-0000-000000000002',
    $q$select public.crm_mover_etapa('40000000-0000-0000-0000-000000000021', 'leads', 'perdido', 'No-fit')$q$);
  perform pg_temp.assert_true(
    (select etapa_leads = 'perdido' and motivo_perdida = 'No-fit' from public.crm_tarjetas where id = '40000000-0000-0000-0000-000000000021'),
    '«Perdido» guarda el motivo');
  perform pg_temp.como('20000000-0000-0000-0000-000000000002',
    $q$select public.crm_mover_etapa('40000000-0000-0000-0000-000000000021', 'leads', 'registrado_recontacto')$q$);
  perform pg_temp.assert_true(
    (select etapa_leads = 'registrado_recontacto' and motivo_perdida is null from public.crm_tarjetas where id = '40000000-0000-0000-0000-000000000021'),
    'al salir de «Perdido» se borra el motivo');
  perform pg_temp.falla('20000000-0000-0000-0000-000000000002',
    $q$select public.crm_mover_etapa('40000000-0000-0000-0000-000000000021', 'leads', 'activo')$q$,
    'etapa inexistente', 'una etapa de otro tablero no sirve');
  perform pg_temp.falla('20000000-0000-0000-0000-000000000002',
    $q$select public.crm_mover_etapa('40000000-0000-0000-0000-000000000031', 'leads', 'contactado')$q$,
    'tarjeta inexistente', 'no se mueve una tarjeta de otro tenant');
  perform pg_temp.falla('20000000-0000-0000-0000-000000000004',
    $q$select public.crm_mover_etapa('40000000-0000-0000-0000-000000000021', 'leads', 'nuevo')$q$,
    'sin acceso al CRM', 'sin el módulo CRM no se mueve nada');

  -- Automático: la 03 está en «nuevo» sin movimientos manuales.
  -- Cada llamada va en su propia sentencia: en una sola expresión, la consulta
  -- de control vería la foto anterior a las llamadas.
  v_1 := pg_temp.valor(null, $q$public.crm_mover_etapa_auto('10000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000003', 'leads', 'estimado_enviado', 'estimado:E1:sent', now())$q$);
  v_2 := pg_temp.valor(null, $q$public.crm_mover_etapa_auto('10000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000003', 'leads', 'estimado_enviado', 'estimado:E1:sent', now())$q$);
  perform pg_temp.assert_true(v_1 = 'movida' and v_2 = 'duplicado'
    and (select count(*) from public.crm_historial_etapas where clave_evento = 'estimado:E1:sent') = 1,
    'un evento automático repetido no mueve dos veces');
  v_1 := pg_temp.valor(null, $q$public.crm_mover_etapa_auto('10000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000021', 'leads', 'estimado_enviado', 'estimado:E2:sent', now() - interval '1 hour')$q$);
  perform pg_temp.assert_true(v_1 = 'omitido_manual'
    and (select etapa_leads from public.crm_tarjetas where id = '40000000-0000-0000-0000-000000000021') = 'registrado_recontacto',
    'un movimiento manual posterior al evento gana');
  perform pg_temp.assert_true(pg_temp.valor(null, $q$public.crm_mover_etapa_auto('10000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000021', 'leads', 'estimado_enviado', 'estimado:E3:sent', now() + interval '1 hour')$q$) = 'movida',
    'un evento posterior al movimiento manual sí mueve');
  perform pg_temp.assert_true(pg_temp.valor(null, $q$public.crm_mover_etapa_auto('10000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000003', 'leads', 'estimado_enviado', 'estimado:E4:sent', now())$q$) = 'sin_cambio',
    'si ya está en la etapa no deja historial');
  perform pg_temp.falla(null, $q$select public.crm_mover_etapa_auto('10000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000031', 'leads', 'contactado', 'x:1', now())$q$,
    'tarjeta inexistente', 'el automático no mueve tarjetas de otro tenant');
end;
$mover$;

-- ─── 5. Tareas, notas y mapeo de Kommo ───────────────────────────────────────
do $hijos$
begin
  perform pg_temp.como('20000000-0000-0000-0000-000000000002', $q$
    insert into public.crm_tareas (tenant_id, tarjeta_id, texto, created_by)
    values ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000021', 'Llamar', '20000000-0000-0000-0000-000000000002')$q$);
  perform pg_temp.assert_true((select count(*) from public.crm_tareas) = 1, 'un comercial crea una tarea');
  perform pg_temp.falla('20000000-0000-0000-0000-000000000002', $q$
    insert into public.crm_tareas (tenant_id, tarjeta_id, texto, created_by)
    values ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000021', 'Otra', '20000000-0000-0000-0000-000000000001')$q$,
    'row-level security', 'una tarea se crea a nombre propio');
  perform pg_temp.falla(null, $q$
    insert into public.crm_tareas (tenant_id, tarjeta_id, texto)
    values ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000031', 'Cruce')$q$,
    'otro tenant', 'una tarea no cuelga de una tarjeta de otro tenant');
  perform pg_temp.como('20000000-0000-0000-0000-000000000002', $q$
    insert into public.crm_notas (tenant_id, tarjeta_id, texto, autor_id)
    values ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000021', 'Pidió precio', '20000000-0000-0000-0000-000000000002')$q$);
  perform pg_temp.falla('20000000-0000-0000-0000-000000000002',
    $q$update public.crm_notas set texto = 'cambio'$q$, 'permission denied', 'las notas no se editan desde la API');
  perform pg_temp.assert_true(
    not has_table_privilege('authenticated', 'public.crm_ids_externos', 'SELECT')
    and not has_table_privilege('authenticated', 'public.crm_ids_externos', 'INSERT')
    and not has_table_privilege('authenticated', 'public.crm_historial_etapas', 'INSERT'),
    'el mapeo de Kommo y el historial no se escriben desde la API');
  perform pg_temp.falla(null, $q$
    insert into public.crm_ids_externos (tenant_id, sistema, tipo, id_externo, tarea_id)
    values ('10000000-0000-0000-0000-000000000001', 'kommo', 'lead', 77, (select id from public.crm_tareas limit 1))$q$,
    'check constraint', 'un lead de Kommo se mapea a una tarjeta, no a una tarea');
end;
$hijos$;

-- ─── 6. Retención de D6 ──────────────────────────────────────────────────────
-- 41 perdido sin ficha, 13 meses quieto · 42 perdido, 11 meses · 43 nuevo, 13 meses · 44 perdido con ficha, 13 meses
insert into public.crm_tarjetas (id, tenant_id, client_id, chatwoot_contact_id, nombre_visible, phone_last10, etapa_leads, motivo_perdida, fuente, ultima_actividad_at) values
  ('40000000-0000-0000-0000-000000000041', '10000000-0000-0000-0000-000000000001', null, 541, 'Lead Prueba Viejo', '4125550341', 'perdido', 'Sin respuesta', 'whatsapp_leads', now() - interval '13 months'),
  ('40000000-0000-0000-0000-000000000042', '10000000-0000-0000-0000-000000000001', null, 542, 'Lead Prueba Reciente', '4125550342', 'perdido', 'Sin respuesta', 'whatsapp_leads', now() - interval '11 months'),
  ('40000000-0000-0000-0000-000000000043', '10000000-0000-0000-0000-000000000001', null, 543, 'Lead Prueba Abierto', '4125550343', 'nuevo', null, 'whatsapp_leads', now() - interval '13 months'),
  ('40000000-0000-0000-0000-000000000044', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', null, null, null, 'perdido', 'Sin respuesta', 'portal', now() - interval '13 months');
insert into public.crm_notas (tenant_id, tarjeta_id, texto) values
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000041', 'Nota vieja'),
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000042', 'Nota reciente');
insert into public.crm_tareas (tenant_id, tarjeta_id, texto) values
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000041', 'Tarea vieja');
insert into public.crm_ids_externos (tenant_id, sistema, tipo, id_externo, tarjeta_id) values
  ('10000000-0000-0000-0000-000000000001', 'kommo', 'lead', 9041, '40000000-0000-0000-0000-000000000041');
insert into public.crm_historial_etapas (tenant_id, tarjeta_id, tablero, de, a, origen, motivo, ocurrio_at) values
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000041', 'leads', 'nuevo', 'perdido', 'manual', 'Sin respuesta', now() - interval '13 months');

do $retencion$
begin
  perform pg_temp.assert_true(pg_temp.valor(null,
    $q$public.crm_anonimizar_leads_perdidos('10000000-0000-0000-0000-000000000001')$q$) = '1',
    'se anonimiza solo el lead sin ficha, perdido y con 12 meses sin actividad');
  perform pg_temp.assert_true((
    select anonimizada_at is not null and nombre_visible is null and phone_last10 is null
       and chatwoot_contact_id is null and motivo_perdida is null
    from public.crm_tarjetas where id = '40000000-0000-0000-0000-000000000041'),
    'la tarjeta anonimizada no guarda nombre, teléfono, contacto ni motivo');
  perform pg_temp.assert_true(
    not exists (select 1 from public.crm_notas where tarjeta_id = '40000000-0000-0000-0000-000000000041')
    and not exists (select 1 from public.crm_tareas where tarjeta_id = '40000000-0000-0000-0000-000000000041')
    and not exists (select 1 from public.crm_ids_externos where tarjeta_id = '40000000-0000-0000-0000-000000000041')
    and (select bool_and(motivo is null) from public.crm_historial_etapas where tarjeta_id = '40000000-0000-0000-0000-000000000041'),
    'al anonimizar se borran sus notas, tareas, mapeos y motivos del historial');
  perform pg_temp.assert_true(
    (select nombre_visible from public.crm_tarjetas where id = '40000000-0000-0000-0000-000000000042') is not null
    and (select nombre_visible from public.crm_tarjetas where id = '40000000-0000-0000-0000-000000000043') is not null
    and (select anonimizada_at from public.crm_tarjetas where id = '40000000-0000-0000-0000-000000000044') is null
    and exists (select 1 from public.crm_notas where tarjeta_id = '40000000-0000-0000-0000-000000000042'),
    'no se tocan el perdido reciente, el abierto viejo ni el perdido con ficha');
  perform pg_temp.assert_true(pg_temp.valor(null,
    $q$public.crm_anonimizar_leads_perdidos('10000000-0000-0000-0000-000000000001')$q$) = '0',
    'anonimizar otra vez no toca nada');
end;
$retencion$;

-- ─── 7. Acceso y forma ───────────────────────────────────────────────────────
do $acceso$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.crm_segmento_clientes(uuid, uuid[])', 'public.crm_segmento_cliente(uuid, uuid)',
    'public.crm_mover_etapa_auto(uuid, uuid, text, text, text, timestamptz)',
    'public.crm_anonimizar_leads_perdidos(uuid, timestamptz)', 'public.crm_sembrar_etapas(uuid)'
  ] loop
    perform pg_temp.assert_true(
      not has_function_privilege('authenticated', v_fn, 'EXECUTE')
      and not has_function_privilege('anon', v_fn, 'EXECUTE')
      and has_function_privilege('service_role', v_fn, 'EXECUTE'),
      'las funciones internas son solo de service_role: ' || v_fn);
  end loop;
  perform pg_temp.assert_true(
    has_function_privilege('authenticated', 'public.crm_mover_etapa(uuid, text, text, text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.crm_segmento_tarjetas(uuid[])', 'EXECUTE')
    and not has_function_privilege('anon', 'public.crm_mover_etapa(uuid, text, text, text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.crm_segmento_tarjetas(uuid[])', 'EXECUTE'),
    'mover a mano y el segmento del tablero son de authenticated, no de anon');
  perform pg_temp.assert_true(not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'crm\_%'
      and not (p.prosecdef and p.proconfig = array['search_path=""'])
  ), 'toda función crm_ es security definer con search_path vacío');
  perform pg_temp.assert_true(not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'crm\_%' and not c.relrowsecurity
  ) and (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'crm\_%') = 6,
    'las 6 tablas crm_ tienen RLS');
  perform pg_temp.assert_true(not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name like 'crm\_%'
      and column_name ~ '(^phone$|telefono|email|correo|markbox|mensaje|^content$)'
  ), 'ninguna tabla crm_ guarda teléfono completo, correo, código ni mensajes');
  perform pg_temp.assert_true(
    not has_table_privilege('anon', 'public.crm_tarjetas', 'SELECT')
    and not has_table_privilege('anon', 'public.crm_notas', 'SELECT')
    and not has_table_privilege('authenticated', 'public.crm_tarjetas', 'DELETE'),
    'anon no lee el CRM y nadie borra tarjetas desde la API');
end;
$acceso$;

select 'TEST 0506 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
