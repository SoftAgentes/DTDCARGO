\set ON_ERROR_STOP on

-- SDD-0647 · contrato de 0553 (tarjetas para todos los clientes con carga).
--
-- Monta el mismo escenario que el contrato de la 0506 (fichas, códigos,
-- envíos y recibos con sus casos borde), aplica la 0505, la 0506 y la 0553
-- REALES y mide el alta inicial que la 0553 corre al aplicarse.
--
-- CONTROL ROJO: sin 0553 cae en la primera aserción (la función no existe).
--
-- Termina siempre en ROLLBACK. Solo ids, códigos y teléfonos sintéticos (555).
begin;

do $roles$
begin
  if to_regclass('public.crm_tarjetas') is not null then
    raise exception 'Fixture 0553 rechazada: el objeto real ya existe';
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

-- ── Antes de la 0553: lo que ya existe en la base cuando se aplica ──────────
-- clients.advisor_id (0151).
alter table public.clients add column advisor_id uuid references auth.users(id);
-- Asesores: 02 → comercial activo de T1; 04 → comercial desactivado; 06 → admin de T2.
update public.clients set advisor_id = '20000000-0000-0000-0000-000000000002' where id = '30000000-0000-0000-0000-000000000002';
update public.clients set advisor_id = '20000000-0000-0000-0000-000000000005' where id = '30000000-0000-0000-0000-000000000004';
update public.clients set advisor_id = '20000000-0000-0000-0000-000000000003' where id = '30000000-0000-0000-0000-000000000006';
-- 20: fusionada en 01 pero VIVA (sin deleted_at), con envío propio.
insert into public.clients (id, tenant_id, markbox, phone, merged_into_client_id, deleted_at) values
  ('30000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000001', 'DTD-1020', null, '30000000-0000-0000-0000-000000000001', null);
insert into public.shipments (tenant_id, client_markbox, status, deleted_at) values
  ('10000000-0000-0000-0000-000000000001', 'DTD-1020', 'in_transit', null);
-- La ficha 01 (cliente) ya tiene tarjeta, con actividad real; y hay un lead sin ficha.
-- Solo si la 0506 creó crm_tarjetas: así la prueba PREFLIGHT (0506 reemplazada)
-- llega al preflight de la 0553 en vez de caer aquí.
do $previas$
begin
  if to_regclass('public.crm_tarjetas') is not null then
    insert into public.crm_tarjetas (tenant_id, client_id, fuente, ultima_actividad_at) values
      ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'web_registro', '2026-11-15 12:00:00+00');
    insert into public.crm_tarjetas (tenant_id, nombre_visible, phone_last10, fuente) values
      ('10000000-0000-0000-0000-000000000001', 'Lead sin ficha', '4125550299', 'whatsapp_leads');
  end if;
end;
$previas$;

\ir ../migrations/0553_crm_tarjetas_clientes_con_carga.sql

-- T3 nace después de la 0506: sus etapas las siembra el trigger.
insert into public.tenants values ('10000000-0000-0000-0000-000000000003', 'nuevo');

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0553: %', p_label; end if;
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

create function pg_temp.tiene_tarjeta(p_client text) returns boolean language sql as $$
  select exists (select 1 from public.crm_tarjetas
                 where client_id = ('30000000-0000-0000-0000-0000000000' || p_client)::uuid);
$$;

create function pg_temp.asesor_de(p_client text) returns uuid language sql as $$
  select asesor_id from public.crm_tarjetas
  where client_id = ('30000000-0000-0000-0000-0000000000' || p_client)::uuid;
$$;

do $alta$
declare
  v_creadas text;
begin
  perform pg_temp.assert_true(
    to_regprocedure('public.crm_alta_tarjetas_clientes(uuid)') is not null,
    'la 0553 crea crm_alta_tarjetas_clientes(uuid)');

  -- Alta inicial al aplicar: 8 en T1 (01 ya tenía) y 1 en T2.
  perform pg_temp.assert_true(
    (select count(*) from public.crm_tarjetas where fuente = 'carga_erp'
     and tenant_id = '10000000-0000-0000-0000-000000000001') = 8
    and (select count(*) from public.crm_tarjetas where fuente = 'carga_erp'
         and tenant_id = '10000000-0000-0000-0000-000000000002') = 1
    and pg_temp.tiene_tarjeta('19'),
    'el alta inicial crea al aplicar las 8 que faltan en T1 y la de T2');

  -- Clientes con carga: envío en tránsito (01, ya tenía), recibo en China (02),
  -- entregado (04), código del historial (06), carga de la fusionada (07), dos
  -- saltos de fusión (10), recibo en incidencia (14), embarcado (17), código en
  -- minúscula y con espacios (18).
  perform pg_temp.assert_true(
    pg_temp.tiene_tarjeta('02') and pg_temp.tiene_tarjeta('04') and pg_temp.tiene_tarjeta('06')
    and pg_temp.tiene_tarjeta('07') and pg_temp.tiene_tarjeta('10') and pg_temp.tiene_tarjeta('14')
    and pg_temp.tiene_tarjeta('17') and pg_temp.tiene_tarjeta('18'),
    'cada ficha con prueba de carga tiene tarjeta');
  perform pg_temp.assert_true(
    (select count(*) from public.crm_tarjetas
     where client_id = '30000000-0000-0000-0000-000000000001') = 1
    and (select ultima_actividad_at from public.crm_tarjetas
         where client_id = '30000000-0000-0000-0000-000000000001') = '2026-11-15 12:00:00+00',
    'la ficha que ya tenía tarjeta no recibe otra ni se toca');

  -- Sin prueba de carga: registrado sin carga (05), envío solo de otro tenant
  -- (03), borrador + cancelado + envío borrado + recibo borrado (13), recibo
  -- huérfano (15), ficha borrada con envío (16), fusionadas borradas (08, 11,
  -- 12) y fusionada VIVA con envío propio (20).
  perform pg_temp.assert_true(
    not pg_temp.tiene_tarjeta('03') and not pg_temp.tiene_tarjeta('05')
    and not pg_temp.tiene_tarjeta('13') and not pg_temp.tiene_tarjeta('15')
    and not pg_temp.tiene_tarjeta('16') and not pg_temp.tiene_tarjeta('08')
    and not pg_temp.tiene_tarjeta('11') and not pg_temp.tiene_tarjeta('12'),
    'carga anulada, huérfana, de otro tenant, ficha borrada o fusionada borrada: sin tarjeta');
  perform pg_temp.assert_true(not pg_temp.tiene_tarjeta('20'),
    'una ficha fusionada viva no recibe tarjeta: su carga es de la ficha que queda');

  -- No aparenta actividad: va al final del orden del tablero.
  perform pg_temp.assert_true(not exists (
    select 1 from public.crm_tarjetas
    where fuente = 'carga_erp' and ultima_actividad_at <> '2000-01-01 00:00:00+00'
  ), 'la tarjeta nueva no aparenta actividad: ultima_actividad_at = 2000-01-01');

  -- Asesor heredado solo si sigue activo en el tenant.
  perform pg_temp.assert_true(
    pg_temp.asesor_de('02') = '20000000-0000-0000-0000-000000000002'
    and pg_temp.asesor_de('04') is null
    and pg_temp.asesor_de('06') is null
    and pg_temp.asesor_de('07') is null,
    'hereda el asesor activo de la ficha; desactivado o de otro tenant, sin asesor');

  perform pg_temp.assert_true(not exists (
    select 1 from public.crm_tarjetas
    where fuente = 'carga_erp'
      and (nombre_visible is not null or phone_last10 is not null or chatwoot_contact_id is not null
           or bsuid is not null or etapa_clientes <> 'activo' or etapa_leads <> 'nuevo')
  ), 'la tarjeta nueva no copia nombre ni teléfono y nace en Clientes › Activo');
  perform pg_temp.assert_true(
    (select count(*) from public.crm_tarjetas where nombre_visible = 'Lead sin ficha') = 1,
    'no toca la tarjeta del lead sin ficha');

  -- Solo service_role: ni la vista ni anon la llaman.
  perform pg_temp.assert_true(
    not has_function_privilege('anon', 'public.crm_alta_tarjetas_clientes(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.crm_alta_tarjetas_clientes(uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.crm_alta_tarjetas_clientes(uuid)', 'EXECUTE'),
    'la ejecuta solo service_role');
  perform pg_temp.falla('20000000-0000-0000-0000-000000000001',
    'select public.crm_alta_tarjetas_clientes(''10000000-0000-0000-0000-000000000001''::uuid)',
    'permission denied|permiso denegado', 'un admin con sesión no la llama');

  -- Idempotente: otra corrida no crea nada.
  v_creadas := pg_temp.valor(null,
    'public.crm_alta_tarjetas_clientes(''10000000-0000-0000-0000-000000000001''::uuid)');
  perform pg_temp.assert_true(v_creadas = '0', 'una segunda corrida no crea nada');

  -- Un cliente que pierde su carga conserva la tarjeta; el segmento lo baja solo.
  update public.shipments set status = 'cancelled' where client_markbox = 'DTD-1017';
  v_creadas := pg_temp.valor(null,
    'public.crm_alta_tarjetas_clientes(''10000000-0000-0000-0000-000000000001''::uuid)');
  perform pg_temp.assert_true(v_creadas = '0' and pg_temp.tiene_tarjeta('17')
    and pg_temp.seg('17') = 'lead_registrado',
    'cancelar su único envío no borra la tarjeta: pasa a lead_registrado');

  -- La fuente nueva entra en el CHECK y una inventada no.
  perform pg_temp.falla(null,
    'insert into public.crm_tarjetas (tenant_id, client_id, fuente) values '
    || '(''10000000-0000-0000-0000-000000000001'', ''30000000-0000-0000-0000-000000000005'', ''inventada'')',
    'crm_tarjetas_fuente_check', 'una fuente fuera de la lista no entra');
  perform pg_temp.assert_true(
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'crm_alta_tarjetas_clientes'
              and p.prosecdef and p.proconfig = array['search_path=""']),
    'security definer con search_path vacío');
end;
$alta$;

select 'TEST 0553 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
