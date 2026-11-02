\set ON_ERROR_STOP on

-- SDD-0587 · contrato de 0513 (entrada de leads desde Chatwoot y la web, paso 6.4).
--
-- Monta lo mínimo que dan por sentado las migraciones de Chatwoot y del CRM, con
-- la forma de las reales: tenants, user_tenants, auth.users, feature_flags,
-- clients (0383, 0341, advisor_id de 0151), client_markbox_history, shipments y
-- warehouse_receipts_cn. Después aplica la 0503, 0504, 0505, 0506 y 0513 REALES y
-- llama las RPC como service_role, igual que el webhook y /registro.
--
-- CONTROL ROJO: sin 0513 cae en la primera aserción (el evento nuevo no entra).
--
-- Termina siempre en ROLLBACK. Solo ids, nombres y teléfonos sintéticos (555).
begin;

do $roles$
begin
  if to_regclass('public.crm_tarjetas') is not null then
    raise exception 'Fixture 0513 rechazada: el objeto real ya existe';
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

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1]
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid())
    and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
grant execute on function public.get_user_tenant_id() to authenticated;

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

create function public.current_studio_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.user_tenants
  where user_id = (select auth.uid()) and disabled_at is null
  limit 1
$$;
grant execute on function public.current_studio_role() to authenticated;

-- Lo que la 0503 redefine y siembra.
create table public.feature_flags (
  tenant_id uuid not null, key text not null, enabled boolean not null, description text,
  primary key (tenant_id, key)
);
create function public.feature_flag_catalog() returns table (key text, enabled boolean, description text)
language sql immutable set search_path = public, pg_catalog as $$
  select null::text, null::boolean, null::text where false
$$;

create table public.clients (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  markbox text not null,
  phone text,
  advisor_id uuid references auth.users(id),
  merged_into_client_id uuid references public.clients(id),
  deleted_at timestamptz,
  phone_last10 text generated always as (
    case when length(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) >= 10
         then right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) end
  ) stored,
  unique (tenant_id, markbox)
);

create table public.client_markbox_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  client_id uuid not null references public.clients(id),
  markbox text not null
);

create type public.shipment_status as enum ('draft', 'in_transit', 'delivered', 'cancelled');
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  client_markbox text,
  status public.shipment_status not null default 'draft',
  deleted_at timestamptz
);

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
  ('20000000-0000-0000-0000-000000000003'), ('20000000-0000-0000-0000-000000000005');
-- 01 admin T1 · 02 comercial T1 · 03 admin T2 · 05 comercial T1 desactivado.
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin', null),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'commercial', null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'admin', null),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'commercial', now());

-- T1. 01: cliente con asesor 01. 02: lead registrado. 03 y 04: mismo teléfono.
-- 05: asesor desactivado. 06: borrada. 07: fusionada en 08, con el mismo teléfono
-- que 08. 09: alta web. 10: ya tiene tarjeta. 11: se liga cuando cruza. 12: carrera.
-- 13 y 14: mismo teléfono, para la web. La 19 es de T2.
insert into public.clients (id, tenant_id, markbox, phone, advisor_id, deleted_at) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'DTD-1001', '+584125550201', '20000000-0000-0000-0000-000000000001', null),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'DTD-1002', '+584125550202', null, null),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'DTD-1003', '+584125550204', null, null),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'DTD-1004', '04125550204', null, null),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'DTD-1005', '+584125550205', '20000000-0000-0000-0000-000000000005', null),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'DTD-1006', '+584125550206', null, now()),
  ('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'DTD-1007', '+584125550207', null, now()),
  ('30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'DTD-1008', '+584125550207', null, null),
  ('30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 'DTD-1009', '+584125550209', '20000000-0000-0000-0000-000000000002', null),
  ('30000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'DTD-1010', '+584125550210', null, null),
  ('30000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'DTD-1011', '+584125550211', null, null),
  ('30000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'DTD-1012', '+584125550212', null, null),
  ('30000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 'DTD-1013', '+584125550213', null, null),
  ('30000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', 'DTD-1014', '04125550213', null, null),
  ('30000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000002', 'DTD-1019', '+584125550201', null, null);
insert into public.shipments (tenant_id, client_markbox, status) values
  ('10000000-0000-0000-0000-000000000001', 'DTD-1001', 'in_transit');

\ir ../migrations/0503_chatwoot_bandeja.sql
\ir ../migrations/0504_chatwoot_eventos.sql
\ir ../migrations/0505_chatwoot_segmento.sql
\ir ../migrations/0506_crm_modelo.sql
\ir ../migrations/0513_crm_entrada_leads.sql

-- Agente 7 → comercial 02 en T1 y admin 03 en T2. Agente 9 → usuario desactivado.
insert into public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 7),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 8),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', 9),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 7);

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0513: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Las RPC, como service_role. El tenant por defecto es T1 y la fuente, leads.
create function pg_temp.entrada(
  p_contacto bigint, p_telefono text, p_nombre text default 'Lead Sintetico',
  p_agente bigint default null, p_clave text default null, p_ocurrio timestamptz default now(),
  p_tenant uuid default '10000000-0000-0000-0000-000000000001',
  p_fuente text default 'whatsapp_leads', p_bsuid text default null
) returns record language plpgsql as $$
declare r record;
begin
  set local role service_role;
  select * into r from public.crm_entrada_chatwoot(
    p_tenant, p_contacto, p_bsuid, p_telefono, p_nombre, p_fuente, p_agente, p_clave, p_ocurrio);
  reset role;
  return r;
end;
$$;

create function pg_temp.asesor(
  p_contacto bigint, p_telefono text, p_agente bigint,
  p_tenant uuid default '10000000-0000-0000-0000-000000000001'
) returns boolean language plpgsql as $$
declare v boolean;
begin
  set local role service_role;
  v := public.crm_asesor_desde_chatwoot(p_tenant, p_contacto, null, p_telefono, p_agente);
  reset role;
  return v;
end;
$$;

create function pg_temp.web(
  p_cliente uuid, p_origen text default 'portal', p_utm_source text default null, p_utm_campaign text default null,
  p_tenant uuid default '10000000-0000-0000-0000-000000000001'
) returns text language plpgsql as $$
declare v text;
begin
  set local role service_role;
  select r.resultado into v from public.crm_alta_tarjeta_web(p_tenant, p_cliente, p_origen, p_utm_source, null, p_utm_campaign) r;
  reset role;
  return v;
end;
$$;

create function pg_temp.tarjeta(p_contacto bigint, p_tenant uuid default '10000000-0000-0000-0000-000000000001')
returns public.crm_tarjetas language sql as $$
  select t.* from public.crm_tarjetas t where t.tenant_id = p_tenant and t.chatwoot_contact_id = p_contacto
$$;

-- ─── Eventos del webhook ─────────────────────────────────────────────────────
do $eventos$
declare
  r record;
begin
  set local role service_role;
  select * into r from public.chatwoot_registrar_evento(
    '10000000-0000-0000-0000-000000000001', 'conversation_created:1', 'conversation_created',
    1, 3, 'open', 0, null, null, null, 1000);
  reset role;
  perform pg_temp.assert_true(r.nuevo, 'el registro admite conversation_created');
  set local role service_role;
  select * into r from public.chatwoot_registrar_evento(
    '10000000-0000-0000-0000-000000000001', 'conversation_updated:1:7:1001', 'conversation_updated',
    1, 3, 'open', 0, 7, null, null, 1001);
  reset role;
  perform pg_temp.assert_true(r.nuevo, 'el registro admite conversation_updated');
  begin
    insert into public.chatwoot_webhook_events (tenant_id, event_key, event, conversation_id)
    values ('10000000-0000-0000-0000-000000000001', 'contact_created:1', 'contact_created', 1);
    perform pg_temp.assert_true(false, 'el registro sigue rechazando un evento desconocido');
  exception when check_violation then
    perform pg_temp.assert_true(true, 'el registro sigue rechazando un evento desconocido');
  end;
end;
$eventos$;

-- ─── Alta desde Chatwoot, por segmento ───────────────────────────────────────
do $alta$
declare
  r record;
  t public.crm_tarjetas;
begin
  r := pg_temp.entrada(100, '4125550300', 'Lead Uno', null, 'message_created:1000');
  t := pg_temp.tarjeta(100);
  perform pg_temp.assert_true(r.creada and not r.volvio, 'un lead nuevo crea su tarjeta');
  perform pg_temp.assert_true(
    t.etapa_leads = 'nuevo' and t.fuente = 'whatsapp_leads' and t.client_id is null
    and t.nombre_visible = 'Lead Uno' and t.phone_last10 = '4125550300',
    'lead nuevo: en «Nuevo», con su fuente, nombre y últimos 10');

  r := pg_temp.entrada(100, '4125550300', 'Otro Nombre', null, 'message_created:1000');
  perform pg_temp.assert_true(not r.creada and r.tarjeta_id = t.id, 'correr dos veces no crea otra');
  perform pg_temp.assert_true((select count(*) = 1 from public.crm_tarjetas x where x.chatwoot_contact_id = 100), 'sigue una sola tarjeta');
  perform pg_temp.assert_true((pg_temp.tarjeta(100)).nombre_visible = 'Lead Uno', 'un nombre nuevo no pisa el que ya estaba');

  r := pg_temp.entrada(102, '4125550202');
  t := pg_temp.tarjeta(102);
  perform pg_temp.assert_true(
    t.etapa_leads = 'registrado_recontacto' and t.client_id = '30000000-0000-0000-0000-000000000002',
    'lead registrado: en «Registrado / recontacto» y ligado a su ficha');
  perform pg_temp.assert_true(t.nombre_visible is null and t.phone_last10 is null, 'con ficha no copia nombre ni teléfono');

  r := pg_temp.entrada(101, '4125550201', 'x', 7);
  t := pg_temp.tarjeta(101);
  perform pg_temp.assert_true(
    t.client_id = '30000000-0000-0000-0000-000000000001' and t.etapa_leads = 'registrado_recontacto' and t.etapa_clientes = 'activo',
    'cliente: ligado; en Clientes «Activo», y si vuelve a lead, a «Registrado / recontacto»');
  perform pg_temp.assert_true(t.asesor_id = '20000000-0000-0000-0000-000000000001', 'cliente: el asesor de la ficha manda sobre el agente (§5.4)');

  r := pg_temp.entrada(104, '4125550204');
  t := pg_temp.tarjeta(104);
  perform pg_temp.assert_true(t.client_id is null and t.etapa_leads = 'nuevo' and t.phone_last10 = '4125550204', 'teléfono ambiguo: no adivina, es lead nuevo');

  r := pg_temp.entrada(106, '4125550206');
  perform pg_temp.assert_true((pg_temp.tarjeta(106)).client_id is null, 'una ficha borrada no cruza');

  r := pg_temp.entrada(100, '4125550201', 'x', null, null, now(), '10000000-0000-0000-0000-000000000002');
  t := pg_temp.tarjeta(100, '10000000-0000-0000-0000-000000000002');
  perform pg_temp.assert_true(r.creada and t.client_id = '30000000-0000-0000-0000-000000000019', 'otro tenant: otra tarjeta y su propia ficha');

  r := pg_temp.entrada(null, '4125550301', 'Con BSUID', null, null, now(), '10000000-0000-0000-0000-000000000001', 'instagram', 'VE.bsuid-uno');
  perform pg_temp.assert_true(
    r.creada and (select x.fuente = 'instagram' from public.crm_tarjetas x where x.bsuid = 'VE.bsuid-uno'),
    'sin contacto, la llave es el BSUID');
  r := pg_temp.entrada(null, '4125550301', 'Con BSUID', null, null, now(), '10000000-0000-0000-0000-000000000001', 'instagram', 'VE.bsuid-uno');
  perform pg_temp.assert_true(not r.creada, 'el BSUID tampoco duplica');

  begin
    r := pg_temp.entrada(null, '4125550302');
    perform pg_temp.assert_true(false, 'sin contacto ni BSUID no hay tarjeta');
  exception when invalid_parameter_value then
    reset role;
    perform pg_temp.assert_true(true, 'sin contacto ni BSUID no hay tarjeta');
  end;
  begin
    r := pg_temp.entrada(107, '4125550303', 'x', null, null, now(), '10000000-0000-0000-0000-000000000001', 'web_registro');
    perform pg_temp.assert_true(false, 'Chatwoot no declara la fuente web');
  exception when invalid_parameter_value then
    reset role;
    perform pg_temp.assert_true(true, 'Chatwoot no declara la fuente web');
  end;
end;
$alta$;

-- ─── Dos entregas a la vez ───────────────────────────────────────────────────
-- PGlite tiene una sola conexión: la otra entrega se simula con un trigger que
-- inserta la misma llave justo antes de la inserción de la RPC.
create function public.prueba_carrera_0513() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.crm_tarjetas x where x.tenant_id = new.tenant_id and x.chatwoot_contact_id = new.chatwoot_contact_id)
     and new.nombre_visible is distinct from 'Otra entrega' and new.chatwoot_contact_id = 500 then
    insert into public.crm_tarjetas (tenant_id, chatwoot_contact_id, nombre_visible, fuente)
    values (new.tenant_id, new.chatwoot_contact_id, 'Otra entrega', 'whatsapp_leads');
  end if;
  if new.client_id = '30000000-0000-0000-0000-000000000012' and new.fuente = 'web_registro'
     and not exists (select 1 from public.crm_tarjetas x where x.client_id = new.client_id) then
    insert into public.crm_tarjetas (tenant_id, client_id, fuente) values (new.tenant_id, new.client_id, 'manual');
  end if;
  return new;
end;
$$;
create trigger prueba_carrera before insert on public.crm_tarjetas
  for each row execute function public.prueba_carrera_0513();

do $carrera$
declare
  r record;
  v text;
begin
  r := pg_temp.entrada(500, '4125550500', 'Esta entrega');
  perform pg_temp.assert_true(not r.creada and r.tarjeta_id is not null, 'si otra entrega ganó, no falla y devuelve esa tarjeta');
  perform pg_temp.assert_true(
    (select count(*) = 1 and min(x.nombre_visible) = 'Otra entrega' from public.crm_tarjetas x where x.chatwoot_contact_id = 500),
    'dos entregas a la vez no crean dos tarjetas');
  v := pg_temp.web('30000000-0000-0000-0000-000000000012');
  perform pg_temp.assert_true(v = 'existente', 'en la web tampoco: si otra llamada ganó, es «existente»');
  perform pg_temp.assert_true(
    (select count(*) = 1 from public.crm_tarjetas x where x.client_id = '30000000-0000-0000-0000-000000000012'),
    'una sola tarjeta por ficha aunque dos altas corran a la vez');
end;
$carrera$;

drop trigger prueba_carrera on public.crm_tarjetas;
drop function public.prueba_carrera_0513();

-- ─── Tarjeta existente: se completa, no se pisa ──────────────────────────────
do $completar$
declare
  r record;
  t public.crm_tarjetas;
  antes timestamptz;
begin
  -- Escribió sin teléfono; después Chatwoot lo conoce y cruza con una ficha.
  r := pg_temp.entrada(110, null, 'Sin Telefono');
  perform pg_temp.assert_true((pg_temp.tarjeta(110)).client_id is null and (pg_temp.tarjeta(110)).nombre_visible = 'Sin Telefono', 'sin teléfono queda sin ficha');
  r := pg_temp.entrada(110, '4125550211', 'Sin Telefono');
  t := pg_temp.tarjeta(110);
  perform pg_temp.assert_true(
    not r.creada and t.client_id = '30000000-0000-0000-0000-000000000011' and t.nombre_visible is null and t.phone_last10 is null,
    'cuando el teléfono cruza, se liga y suelta nombre y teléfono (D6)');
  perform pg_temp.assert_true(t.etapa_leads = 'nuevo', 'ligarse no mueve la etapa (§4.5)');

  -- Sin teléfono al principio y sin cruce después: guarda el que llega.
  r := pg_temp.entrada(111, null, null);
  perform pg_temp.assert_true((pg_temp.tarjeta(111)).phone_last10 is null and (pg_temp.tarjeta(111)).nombre_visible is null, 'sin nombre ni teléfono también entra');
  r := pg_temp.entrada(111, '4125550311', 'Ya Tiene Nombre');
  t := pg_temp.tarjeta(111);
  perform pg_temp.assert_true(t.phone_last10 = '4125550311' and t.nombre_visible = 'Ya Tiene Nombre', 'lo que faltaba se completa');

  -- Cargada a mano solo con el teléfono: el mensaje la encuentra.
  insert into public.crm_tarjetas (tenant_id, phone_last10, nombre_visible, fuente)
  values ('10000000-0000-0000-0000-000000000001', '4125550312', 'A Mano', 'manual');
  r := pg_temp.entrada(112, '4125550312', 'Otro');
  t := pg_temp.tarjeta(112);
  perform pg_temp.assert_true(not r.creada and t.fuente = 'manual' and t.nombre_visible = 'A Mano', 'la tarjeta manual con ese teléfono toma el contacto y conserva su fuente');

  -- Ficha borrada y fusionada: la tarjeta pasa a la ficha que cruza hoy.
  insert into public.crm_tarjetas (tenant_id, client_id, chatwoot_contact_id, fuente)
  values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', 113, 'manual');
  r := pg_temp.entrada(113, '4125550207');
  perform pg_temp.assert_true((pg_temp.tarjeta(113)).client_id = '30000000-0000-0000-0000-000000000008', 'una ficha fusionada no esconde la tarjeta: pasa a la viva');
  insert into public.crm_tarjetas (tenant_id, client_id, chatwoot_contact_id, fuente)
  values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006', 114, 'manual');
  r := pg_temp.entrada(114, '4125550314', 'De Vuelta');
  t := pg_temp.tarjeta(114);
  perform pg_temp.assert_true(t.client_id is null and t.nombre_visible = 'De Vuelta', 'sin ficha viva queda como lead, a la vista');

  -- La ficha ya tiene otra tarjeta con otro contacto: no se fusionan ni se pisa.
  r := pg_temp.entrada(115, null, 'Primero');
  insert into public.crm_tarjetas (tenant_id, client_id, chatwoot_contact_id, fuente)
  values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000010', 116, 'manual');
  r := pg_temp.entrada(115, '4125550210', 'Primero');
  perform pg_temp.assert_true(
    r.tarjeta_id = (pg_temp.tarjeta(116)).id and (pg_temp.tarjeta(115)).client_id is null,
    'con ficha, manda la tarjeta de la ficha; la otra no se toca');

  -- La actividad sube, y un evento viejo no la baja.
  antes := now() - interval '10 days';
  r := pg_temp.entrada(117, '4125550317', 'x', null, null, antes);
  perform pg_temp.assert_true((pg_temp.tarjeta(117)).ultima_actividad_at = antes, 'la actividad nace con la del evento');
  r := pg_temp.entrada(117, '4125550317', 'x', null, null, antes + interval '1 day');
  perform pg_temp.assert_true((pg_temp.tarjeta(117)).ultima_actividad_at = antes + interval '1 day', 'cada mensaje sube la actividad');
  r := pg_temp.entrada(117, '4125550317', 'x', null, null, antes);
  perform pg_temp.assert_true((pg_temp.tarjeta(117)).ultima_actividad_at = antes + interval '1 day', 'un evento viejo no baja la actividad');
end;
$completar$;

-- ─── Asesor (§5.4) ───────────────────────────────────────────────────────────
do $asesor$
declare
  r record;
begin
  r := pg_temp.entrada(120, '4125550320', 'x', 7);
  perform pg_temp.assert_true((pg_temp.tarjeta(120)).asesor_id = '20000000-0000-0000-0000-000000000002', 'al crear, toma el agente vinculado');
  r := pg_temp.entrada(121, '4125550321', 'x', 9);
  perform pg_temp.assert_true(r.creada and (pg_temp.tarjeta(121)).asesor_id is null, 'un agente de un usuario desactivado no da asesor ni rompe el alta');
  r := pg_temp.entrada(122, '4125550205');
  perform pg_temp.assert_true(
    r.creada and (pg_temp.tarjeta(122)).client_id = '30000000-0000-0000-0000-000000000005' and (pg_temp.tarjeta(122)).asesor_id is null,
    'una ficha con asesor desactivado no rompe el alta');

  perform pg_temp.assert_true(pg_temp.asesor(121, null, 7), 'conversation_updated da asesor a la tarjeta que no lo tiene');
  perform pg_temp.assert_true((pg_temp.tarjeta(121)).asesor_id = '20000000-0000-0000-0000-000000000002', 'es el usuario vinculado a ese agente');
  perform pg_temp.assert_true(not pg_temp.asesor(121, null, 7), 'dos veces no hace nada la segunda');
  perform pg_temp.assert_true(not pg_temp.asesor(121, null, 8), 'un segundo agente no pisa al primero');
  perform pg_temp.assert_true((pg_temp.tarjeta(121)).asesor_id = '20000000-0000-0000-0000-000000000002', 'el dueño de la tarjeta sigue siendo el primero');
  perform pg_temp.assert_true(not pg_temp.asesor(999, '4125550999', 7), 'sin tarjeta no crea nada');
  perform pg_temp.assert_true(not exists (select 1 from public.crm_tarjetas x where x.chatwoot_contact_id = 999), 'conversation_updated no crea tarjetas');

  r := pg_temp.entrada(123, '4125550323');
  perform pg_temp.assert_true(not pg_temp.asesor(123, null, 77), 'un agente sin vínculo no da asesor');
  perform pg_temp.assert_true(not pg_temp.asesor(123, null, 9), 'un vínculo de un usuario desactivado tampoco');
  perform pg_temp.assert_true((pg_temp.tarjeta(123)).asesor_id is null, 'y la tarjeta sigue sin asesor');

  -- El vínculo es por tenant: en T2 el agente 7 es otro usuario.
  r := pg_temp.entrada(123, '4125550323', 'x', null, null, now(), '10000000-0000-0000-0000-000000000002');
  perform pg_temp.assert_true(pg_temp.asesor(123, null, 7, '10000000-0000-0000-0000-000000000002'), 'otro tenant: su propio vínculo');
  perform pg_temp.assert_true(
    (pg_temp.tarjeta(123, '10000000-0000-0000-0000-000000000002')).asesor_id = '20000000-0000-0000-0000-000000000003'
    and (pg_temp.tarjeta(123)).asesor_id is null,
    'el vínculo no cruza de tenant');
end;
$asesor$;

-- ─── Quien vuelve (§4.3, §6.2) ───────────────────────────────────────────────
do $volvio$
declare
  r record;
  t public.crm_tarjetas;
  v_ayer timestamptz := now() - interval '1 day';
begin
  r := pg_temp.entrada(130, '4125550330', 'x', 7, 'message_created:1');
  t := pg_temp.tarjeta(130);
  update public.crm_tarjetas x set etapa_leads = 'perdido', motivo_perdida = 'No contesta', etapa_leads_manual_at = v_ayer where x.id = t.id;

  r := pg_temp.entrada(130, '4125550330', 'x', 7, null);
  perform pg_temp.assert_true(not r.volvio and (pg_temp.tarjeta(130)).etapa_leads = 'perdido', 'una conversación nueva sin mensaje entrante no lo saca de «Perdido»');

  r := pg_temp.entrada(130, '4125550330', 'x', 7, 'message_created:2');
  t := pg_temp.tarjeta(130);
  perform pg_temp.assert_true(r.volvio and t.etapa_leads = 'registrado_recontacto', 'el perdido que escribe vuelve a «Registrado / recontacto»');
  perform pg_temp.assert_true(t.motivo_perdida is null, 'al volver se borra el motivo');
  perform pg_temp.assert_true(
    (select count(*) = 1 and bool_and(h.origen = 'automatico' and h.de = 'perdido') from public.crm_historial_etapas h where h.tarjeta_id = t.id),
    'queda en el historial como automático');
  perform pg_temp.assert_true(
    (select count(*) = 1 and bool_and(k.origen = 'automatico' and k.asignado_a = t.asesor_id and k.completada_at is null)
     from public.crm_tareas k where k.tarjeta_id = t.id),
    'con una tarea para su asesor');
  perform pg_temp.assert_true(
    not exists (select 1 from public.crm_tareas k where k.tarjeta_id = t.id and k.texto ~ 'message_created|4125550330'),
    'la tarea no lleva datos del contacto');

  -- El mismo mensaje dos veces, aunque otra vez esté en «Perdido»: nada doble.
  update public.crm_tarjetas x set etapa_leads = 'perdido', motivo_perdida = 'Otra vez' where x.id = t.id;
  r := pg_temp.entrada(130, '4125550330', 'x', 7, 'message_created:2');
  perform pg_temp.assert_true(not r.volvio and (pg_temp.tarjeta(130)).etapa_leads = 'perdido', 'el mismo evento no mueve dos veces');
  perform pg_temp.assert_true((select count(*) = 1 from public.crm_tareas k where k.tarjeta_id = t.id), 'ni crea otra tarea');

  -- Lo movieron a mano después de que escribiera: gana el manual.
  update public.crm_tarjetas x set etapa_leads_manual_at = now() where x.id = t.id;
  r := pg_temp.entrada(130, '4125550330', 'x', 7, 'message_created:3', v_ayer);
  perform pg_temp.assert_true(not r.volvio and (pg_temp.tarjeta(130)).etapa_leads = 'perdido', 'un movimiento manual posterior gana');
  perform pg_temp.assert_true((pg_temp.tarjeta(130)).motivo_perdida = 'Otra vez', 'y conserva su motivo');

  -- Un mensaje en otra etapa no la mueve.
  r := pg_temp.entrada(131, '4125550331', 'x', null, 'message_created:4');
  update public.crm_tarjetas x set etapa_leads = 'contactado' where x.chatwoot_contact_id = 131;
  r := pg_temp.entrada(131, '4125550331', 'x', null, 'message_created:5');
  perform pg_temp.assert_true(not r.volvio and (pg_temp.tarjeta(131)).etapa_leads = 'contactado', 'escribir no mueve una tarjeta que no estaba perdida');

  -- Un cliente no está en el tablero Leads: su etapa de leads no se toca.
  update public.crm_tarjetas x set etapa_leads = 'perdido', motivo_perdida = 'Viejo' where x.chatwoot_contact_id = 101;
  r := pg_temp.entrada(101, '4125550201', 'x', null, 'message_created:6');
  perform pg_temp.assert_true(not r.volvio and (pg_temp.tarjeta(101)).etapa_leads = 'perdido', 'un cliente que escribe no mueve su etapa de leads');

  -- Una tarjeta anonimizada no revive: la persona empieza de cero.
  r := pg_temp.entrada(132, '4125550332', 'Se Anonimiza', null, null, now() - interval '13 months');
  update public.crm_tarjetas x set etapa_leads = 'perdido', motivo_perdida = 'Viejo' where x.chatwoot_contact_id = 132;
  set local role service_role;
  perform public.crm_anonimizar_leads_perdidos('10000000-0000-0000-0000-000000000001');
  reset role;
  r := pg_temp.entrada(132, '4125550332', 'De Nuevo', null, 'message_created:7');
  t := pg_temp.tarjeta(132);
  perform pg_temp.assert_true(r.creada and t.etapa_leads = 'nuevo' and t.nombre_visible = 'De Nuevo', 'quien vuelve después de anonimizado es una tarjeta nueva');
  perform pg_temp.assert_true(
    (select count(*) = 1 from public.crm_tarjetas x where x.anonimizada_at is not null and x.nombre_visible is null),
    'la anonimizada sigue vacía');
end;
$volvio$;

-- ─── Alta desde /registro ────────────────────────────────────────────────────
do $web$
declare
  t public.crm_tarjetas;
  v text;
begin
  v := pg_temp.web('30000000-0000-0000-0000-000000000009', 'academia', 'facebook', 'lanzamiento');
  select * into t from public.crm_tarjetas x where x.client_id = '30000000-0000-0000-0000-000000000009';
  perform pg_temp.assert_true(v = 'creada' and t.etapa_leads = 'nuevo' and t.fuente = 'web_registro', 'la web crea la tarjeta en «Nuevo», con fuente web');
  perform pg_temp.assert_true(
    t.fuente_detalle = 'academia' and t.utm_source = 'facebook' and t.utm_campaign = 'lanzamiento' and t.utm_medium is null,
    'guarda el origen y los UTM');
  perform pg_temp.assert_true(t.nombre_visible is null and t.phone_last10 is null, 'con ficha no copia nombre ni teléfono');
  perform pg_temp.assert_true(t.asesor_id = '20000000-0000-0000-0000-000000000002', 'toma el asesor de la ficha');

  v := pg_temp.web('30000000-0000-0000-0000-000000000009', 'portal', 'otro', 'otra');
  perform pg_temp.assert_true(v = 'existente', 'correr dos veces no crea otra');
  select * into t from public.crm_tarjetas x where x.client_id = '30000000-0000-0000-0000-000000000009';
  perform pg_temp.assert_true(t.fuente_detalle = 'academia' and t.utm_source = 'facebook', 'la atribución no se pisa');
  perform pg_temp.assert_true((select count(*) = 1 from public.crm_tarjetas x where x.client_id = '30000000-0000-0000-0000-000000000009'), 'sigue una sola');

  v := pg_temp.web('30000000-0000-0000-0000-000000000002', 'academia', 'facebook');
  perform pg_temp.assert_true(v = 'existente', 'una ficha que ya entró por Chatwoot no crea otra');

  -- El lead que ya escribió se registra: la ficha nace después, como en la vida real.
  perform pg_temp.entrada(140, '4125550402', 'Escribio Antes', 7, null);
  update public.crm_tarjetas x set etapa_leads = 'contactado' where x.chatwoot_contact_id = 140;
  insert into public.clients (id, tenant_id, markbox, phone) values
    ('30000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000001', 'DTD-1015', '+584125550402');
  v := pg_temp.web('30000000-0000-0000-0000-000000000015', 'academia', 'facebook');
  t := pg_temp.tarjeta(140);
  perform pg_temp.assert_true(v = 'ligada' and t.client_id = '30000000-0000-0000-0000-000000000015', 'la web liga la tarjeta del lead que ya escribió');
  perform pg_temp.assert_true(t.nombre_visible is null and t.phone_last10 is null, 'al ligar suelta nombre y teléfono');
  perform pg_temp.assert_true(t.etapa_leads = 'contactado', 'registrarse no cambia lo que el asesor ya hizo (§4.5)');
  perform pg_temp.assert_true(t.fuente = 'whatsapp_leads' and t.fuente_detalle is null and t.utm_source is null, 'ligar no pisa la fuente: se fija al crear');
  perform pg_temp.assert_true(t.asesor_id = '20000000-0000-0000-0000-000000000002', 'y conserva a su asesor');

  -- El perdido que se registra vuelve a recontacto, con tarea, una sola vez.
  perform pg_temp.entrada(141, '4125550403', 'Perdido', null, null);
  update public.crm_tarjetas x set etapa_leads = 'perdido', motivo_perdida = 'Viejo' where x.chatwoot_contact_id = 141;
  insert into public.clients (id, tenant_id, markbox, phone) values
    ('30000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000001', 'DTD-1016', '+584125550403');
  v := pg_temp.web('30000000-0000-0000-0000-000000000016');
  t := pg_temp.tarjeta(141);
  perform pg_temp.assert_true(
    v = 'ligada' and t.etapa_leads = 'registrado_recontacto' and t.motivo_perdida is null,
    'el perdido que se registra vuelve a «Registrado / recontacto»');
  perform pg_temp.assert_true((select count(*) = 1 from public.crm_tareas k where k.tarjeta_id = t.id), 'con su tarea');

  -- Dos fichas con ese teléfono: no se liga la del lead, la ficha tiene la suya.
  perform pg_temp.entrada(142, '4125550213', 'Ambiguo', null, null);
  v := pg_temp.web('30000000-0000-0000-0000-000000000013');
  t := pg_temp.tarjeta(142);
  perform pg_temp.assert_true(v = 'creada' and t.client_id is null and t.phone_last10 = '4125550213', 'con el teléfono en dos fichas, no adivina');
  perform pg_temp.assert_true((select x.fuente = 'web_registro' from public.crm_tarjetas x where x.client_id = '30000000-0000-0000-0000-000000000013'), 'y la ficha tiene su propia tarjeta');

  -- Dos tarjetas sin ligar con ese teléfono: se liga la más vieja, que trae la atribución.
  perform pg_temp.entrada(143, '4125550404', 'Primera', null, null, now() - interval '2 days');
  update public.crm_tarjetas x set created_at = now() - interval '2 days' where x.chatwoot_contact_id = 143;
  perform pg_temp.entrada(144, '4125550404', 'Segunda', null, null);
  insert into public.clients (id, tenant_id, markbox, phone) values
    ('30000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000001', 'DTD-1017', '+584125550404');
  v := pg_temp.web('30000000-0000-0000-0000-000000000017');
  perform pg_temp.assert_true(
    v = 'ligada' and (pg_temp.tarjeta(143)).client_id = '30000000-0000-0000-0000-000000000017' and (pg_temp.tarjeta(144)).client_id is null,
    'con dos tarjetas de ese teléfono se liga la más vieja');

  -- Ficha borrada o de otro tenant: error, sin tarjeta.
  begin
    v := pg_temp.web('30000000-0000-0000-0000-000000000006');
    perform pg_temp.assert_true(false, 'una ficha borrada no crea tarjeta');
  exception when invalid_parameter_value then
    reset role;
    perform pg_temp.assert_true(
      not exists (select 1 from public.crm_tarjetas x where x.client_id = '30000000-0000-0000-0000-000000000006' and x.fuente = 'web_registro'),
      'una ficha borrada no crea tarjeta');
  end;
  begin
    v := pg_temp.web('30000000-0000-0000-0000-000000000019');
    perform pg_temp.assert_true(false, 'una ficha de otro tenant no crea tarjeta');
  exception when invalid_parameter_value then
    reset role;
    perform pg_temp.assert_true(
      not exists (select 1 from public.crm_tarjetas x where x.client_id = '30000000-0000-0000-0000-000000000019' and x.fuente = 'web_registro'),
      'una ficha de otro tenant no crea tarjeta');
  end;
end;
$web$;

-- Vacíos y largos, sobre una ficha sin tarjeta.
do $largos$
declare
  t public.crm_tarjetas;
  v text;
begin
  insert into public.clients (id, tenant_id, markbox, phone) values
    ('30000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000001', 'DTD-1018', '+584125550405');
  v := pg_temp.web('30000000-0000-0000-0000-000000000018', '   ', repeat('x', 500), '   ');
  select * into t from public.crm_tarjetas x where x.client_id = '30000000-0000-0000-0000-000000000018';
  perform pg_temp.assert_true(v = 'creada' and t.fuente_detalle is null and t.utm_campaign is null, 'un valor vacío se guarda como null');
  perform pg_temp.assert_true(length(t.utm_source) = 120, 'un valor largo se recorta a lo que admite la tabla');
end;
$largos$;

-- ─── Permisos y datos ────────────────────────────────────────────────────────
do $acceso$
declare
  f text;
begin
  foreach f in array array[
    'public.crm_ficha_por_telefono(uuid,text)',
    'public.crm_asesor_activo(uuid,uuid)',
    'public.crm_usuario_de_agente(uuid,bigint)',
    'public.crm_buscar_tarjeta(uuid,uuid,bigint,text,text)',
    'public.crm_volver_a_recontacto(uuid,uuid,text,timestamptz)',
    'public.crm_entrada_chatwoot(uuid,bigint,text,text,text,text,bigint,text,timestamptz)',
    'public.crm_asesor_desde_chatwoot(uuid,bigint,text,text,bigint)',
    'public.crm_alta_tarjeta_web(uuid,uuid,text,text,text,text,text,text)'
  ] loop
    perform pg_temp.assert_true(
      not has_function_privilege('anon', f, 'EXECUTE') and not has_function_privilege('authenticated', f, 'EXECUTE'),
      'anon y authenticated no ejecutan ' || f);
  end loop;
  foreach f in array array[
    'public.crm_entrada_chatwoot(uuid,bigint,text,text,text,text,bigint,text,timestamptz)',
    'public.crm_asesor_desde_chatwoot(uuid,bigint,text,text,bigint)',
    'public.crm_alta_tarjeta_web(uuid,uuid,text,text,text,text,text,text)'
  ] loop
    perform pg_temp.assert_true(has_function_privilege('service_role', f, 'EXECUTE'), 'service_role ejecuta ' || f);
  end loop;
  perform pg_temp.assert_true(not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'crm_ficha_por_telefono', 'crm_asesor_activo', 'crm_usuario_de_agente', 'crm_buscar_tarjeta',
      'crm_volver_a_recontacto', 'crm_entrada_chatwoot', 'crm_asesor_desde_chatwoot', 'crm_alta_tarjeta_web')
      and not (p.prosecdef and p.proconfig @> array['search_path=""'])
  ), 'toda función nueva es security definer con search_path vacío');
end;
$acceso$;

select 'TEST 0513 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
