\set ON_ERROR_STOP on

-- SDD-0582 · E6, paso 6.5 · contrato del cargador supabase/cargas/crm-kommo/carga.sql.
--
-- Monta lo mínimo que dan por sentado las migraciones de Chatwoot y del CRM (el mismo preludio que el
-- contrato de la 0513), un espejo de Kommo con la forma de las migraciones reales y datos INVENTADOS.
-- Aplica la 0503, 0504, 0505, 0506 y 0513 REALES y corre el cargador real tres veces: en seco (dentro de un
-- savepoint que se deshace), de verdad y otra vez con el mismo corte.
--
-- CONTROL ROJO: sin el cargador cae en la primera llamada (pg_temp.crm_carga_kommo no existe).
--
-- Termina siempre en ROLLBACK. Solo ids, nombres, correos y teléfonos sintéticos (555 y dtd.test).
begin;

do $roles$
begin
  if to_regclass('public.crm_tarjetas') is not null then
    raise exception 'Fixture de la carga rechazada: el objeto real ya existe';
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
create table auth.users (id uuid primary key, email text);

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
  kommo_lead_id bigint,
  kommo_contact_id bigint,
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
-- 01 admin T1 · 02 comercial T1 · 03 admin T2 · 05 comercial T1 desactivado.
insert into auth.users (id, email) values
  ('20000000-0000-0000-0000-000000000001', 'uno@dtd.test'),
  ('20000000-0000-0000-0000-000000000002', 'dos@dtd.test'),
  ('20000000-0000-0000-0000-000000000003', 'tres@dtd.test'),
  ('20000000-0000-0000-0000-000000000005', 'cinco@dtd.test');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin', null),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'commercial', null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'admin', null),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'commercial', now());

-- Fichas de T1. 01: cliente (envío vivo), su teléfono cruza con el contacto 5001. 02: ligada al lead 1002.
-- 03: ligada al contacto 5003. 04 y 14: mismo teléfono (ambiguo). 06: borrada, ligada al lead 1006.
-- 19: de T2 con el teléfono de la 01.
insert into public.clients (id, tenant_id, markbox, phone, kommo_lead_id, kommo_contact_id, deleted_at) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'DTD-1001', '+584125550201', null, null, null),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'DTD-1002', '+584125550202', 1002, null, null),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'DTD-1003', null, null, 5003, null),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'DTD-1004', '+584125550204', null, null, null),
  ('30000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', 'DTD-1014', '04125550204', null, null, null),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'DTD-1006', null, 1006, null, now()),
  ('30000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000002', 'DTD-1019', '+584125550201', null, null, null);
insert into public.shipments (tenant_id, client_markbox, status) values
  ('10000000-0000-0000-0000-000000000001', 'DTD-1001', 'in_transit');

-- Espejo de Kommo con la forma de las migraciones reales (0082, 0139, 0362, 0363, 0390 y 0391), sin datos reales.
create table public.kommo_users (
  tenant_id uuid not null references public.tenants(id), id bigint not null, name text, email text,
  synced_at timestamptz not null default now(), primary key (tenant_id, id));
create table public.kommo_contacts (
  tenant_id uuid not null references public.tenants(id), id bigint not null, name text,
  responsible_user_id bigint, kommo_created_at timestamptz, kommo_updated_at timestamptz,
  custom_fields jsonb not null default '[]', synced_at timestamptz not null default now(),
  email text, phone text,
  phone_last10 text generated always as (
    case when length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) >= 10
         then right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) end) stored,
  primary key (tenant_id, id));
create table public.kommo_leads (
  tenant_id uuid not null references public.tenants(id), id bigint not null, name text,
  status_id bigint, pipeline_id bigint, price numeric, responsible_user_id bigint,
  kommo_created_at timestamptz, kommo_updated_at timestamptz, closed_at timestamptz,
  custom_fields jsonb not null default '[]', synced_at timestamptz not null default now(),
  last_inbound_at timestamptz, last_outbound_at timestamptz, last_message_origin text,
  primary key (tenant_id, id));
create table public.kommo_lead_contacts (
  tenant_id uuid not null, lead_id bigint not null, contact_id bigint not null,
  is_main boolean not null default false, synced_at timestamptz not null default now(),
  primary key (tenant_id, lead_id, contact_id),
  foreign key (tenant_id, lead_id) references public.kommo_leads (tenant_id, id) on delete cascade);
create table public.kommo_tasks (
  tenant_id uuid not null references public.tenants(id), id bigint not null, entity_id bigint,
  entity_type text, responsible_user_id bigint, text text, task_type_id bigint,
  complete_till timestamptz, is_completed boolean not null default false,
  kommo_created_at timestamptz, kommo_updated_at timestamptz, synced_at timestamptz not null default now(),
  primary key (tenant_id, id));

\ir ../migrations/0503_chatwoot_bandeja.sql
\ir ../migrations/0504_chatwoot_eventos.sql
\ir ../migrations/0505_chatwoot_segmento.sql
\ir ../migrations/0506_crm_modelo.sql
\ir ../migrations/0513_crm_entrada_leads.sql

-- Usuarios de Kommo: 901 cruza con 02 (mayúsculas y espacios), 902 es del desactivado 05, 903 sin correo,
-- 904 con un correo que nadie tiene.
insert into public.kommo_users (tenant_id, id, name, email) values
  ('10000000-0000-0000-0000-000000000001', 901, 'Asesor Sintetico', ' DOS@dtd.test '),
  ('10000000-0000-0000-0000-000000000001', 902, 'Desactivado Sintetico', 'cinco@dtd.test'),
  ('10000000-0000-0000-0000-000000000001', 903, 'Sin Correo', null),
  ('10000000-0000-0000-0000-000000000001', 904, 'Nadie', 'nadie@dtd.test'),
  ('10000000-0000-0000-0000-000000000002', 901, 'Otro Tenant', 'tres@dtd.test');

insert into public.kommo_contacts (tenant_id, id, name, phone) values
  ('10000000-0000-0000-0000-000000000001', 5001, 'Contacto Uno', '+58 412-555-0201'),
  ('10000000-0000-0000-0000-000000000001', 5003, 'Contacto Tres', null),
  ('10000000-0000-0000-0000-000000000001', 5004, 'Contacto Cuatro', '+584125550204'),
  ('10000000-0000-0000-0000-000000000001', 5007, '  Lead Siete  ', '+584125550300'),
  ('10000000-0000-0000-0000-000000000001', 5008, 'Lead Ocho', '+584125550301'),
  ('10000000-0000-0000-0000-000000000001', 5009, 'Lead Nueve', '+584125550302'),
  ('10000000-0000-0000-0000-000000000001', 5010, 'Sin Telefono', null),
  ('10000000-0000-0000-0000-000000000001', 5011, 'Lead Once', '+584125550303'),
  ('10000000-0000-0000-0000-000000000001', 5012, 'Lead Doce', '+584125550304'),
  ('10000000-0000-0000-0000-000000000002', 5001, 'Contacto T2', '+584125550201');

-- Leads de T1. El corte es hace 1 día y la ventana, 180 días.
insert into public.kommo_leads
  (tenant_id, id, name, status_id, responsible_user_id, kommo_created_at, kommo_updated_at, closed_at,
   last_inbound_at, last_message_origin) values
  ('10000000-0000-0000-0000-000000000001', 1001, 'L', 108343839, 901, now() - interval '90 days', now() - interval '10 days', null, null, 'waba'),
  ('10000000-0000-0000-0000-000000000001', 1002, 'L', 108343831, 902, now() - interval '90 days', now() - interval '11 days', null, null, null),
  ('10000000-0000-0000-0000-000000000001', 1003, 'L', 108343835, null, now() - interval '90 days', now() - interval '12 days', null, null, 'instagram'),
  ('10000000-0000-0000-0000-000000000001', 1004, 'L', 108343827, 903, now() - interval '90 days', now() - interval '13 days', null, null, null),
  ('10000000-0000-0000-0000-000000000001', 1006, 'L', 108343827, null, now() - interval '90 days', now() - interval '14 days', null, null, null),
  ('10000000-0000-0000-0000-000000000001', 1007, 'L', 108343827, 901, now() - interval '90 days', now() - interval '300 days', null, now() - interval '15 days', null),
  ('10000000-0000-0000-0000-000000000001', 1081, 'L', 109855104, null, now() - interval '90 days', now() - interval '16 days', null, null, null),
  ('10000000-0000-0000-0000-000000000001', 1082, 'L', 108343827, null, now() - interval '90 days', now() - interval '40 days', null, null, null),
  ('10000000-0000-0000-0000-000000000001', 1009, 'L', 108343827, null, now() - interval '90 days', now() - interval '17 days', null, null, null),
  ('10000000-0000-0000-0000-000000000001', 1010, 'L', 108343827, null, now() - interval '90 days', now() - interval '18 days', null, null, null),
  ('10000000-0000-0000-0000-000000000001', 1011, 'L', 108343839, 901, now() - interval '90 days', now() - interval '19 days', null, null, null),
  ('10000000-0000-0000-0000-000000000001', 1012, 'L', 142, null, now() - interval '90 days', now() - interval '5 days', now() - interval '5 days', null, null),
  ('10000000-0000-0000-0000-000000000001', 1013, 'L', 108343831, null, now() - interval '90 days', now() - interval '5 days', now() - interval '5 days', null, null),
  ('10000000-0000-0000-0000-000000000001', 1014, 'L', 143, null, now() - interval '90 days', now() - interval '5 days', null, null, null),
  ('10000000-0000-0000-0000-000000000001', 1015, 'L', 108343831, null, now() - interval '400 days', now() - interval '200 days', null, null, null),
  ('10000000-0000-0000-0000-000000000001', 1016, 'L', 99999, null, now() - interval '90 days', now() - interval '5 days', null, null, null),
  ('10000000-0000-0000-0000-000000000001', 1017, 'L', 108343827, null, now(), now(), null, null, null),
  ('10000000-0000-0000-0000-000000000001', 1018, 'L', 142, null, now() - interval '90 days', now() - interval '5 days', null, null, null),
  ('10000000-0000-0000-0000-000000000001', 1019, 'L', 108343831, 901, now() - interval '90 days', now() - interval '20 days', null, null, null),
  ('10000000-0000-0000-0000-000000000002', 2001, 'L', 108343827, 901, now() - interval '90 days', now() - interval '5 days', null, null, null);
insert into public.kommo_lead_contacts (tenant_id, lead_id, contact_id, is_main) values
  ('10000000-0000-0000-0000-000000000001', 1001, 5001, true),
  ('10000000-0000-0000-0000-000000000001', 1003, 5003, true),
  ('10000000-0000-0000-0000-000000000001', 1004, 5004, true),
  ('10000000-0000-0000-0000-000000000001', 1007, 5004, false),
  ('10000000-0000-0000-0000-000000000001', 1007, 5007, true),
  ('10000000-0000-0000-0000-000000000001', 1081, 5008, true),
  ('10000000-0000-0000-0000-000000000001', 1082, 5008, true),
  ('10000000-0000-0000-0000-000000000001', 1009, 5009, true),
  ('10000000-0000-0000-0000-000000000001', 1010, 5010, true),
  ('10000000-0000-0000-0000-000000000001', 1011, 5011, true),
  ('10000000-0000-0000-0000-000000000001', 1019, 5012, true),
  ('10000000-0000-0000-0000-000000000002', 2001, 5001, true);
-- Tareas: 7001 abierta; 7002 completada; 7003 sin texto y con vencimiento en milisegundos; 7004 del segundo
-- lead de la misma persona; 7005 de un lead ambiguo; 7006 de un contacto, no de un lead.
insert into public.kommo_tasks (tenant_id, id, entity_id, entity_type, responsible_user_id, text, complete_till, is_completed) values
  ('10000000-0000-0000-0000-000000000001', 7001, 1007, 'leads', 901, '  Llamar  ', now() + interval '1 day', false),
  ('10000000-0000-0000-0000-000000000001', 7002, 1007, 'leads', 901, 'Hecha', now(), true),
  ('10000000-0000-0000-0000-000000000001', 7003, 1007, 'leads', 904, null, '57000-01-01 00:00:00+00', false),
  ('10000000-0000-0000-0000-000000000001', 7004, 1082, 'leads', null, 'Del segundo lead', null, false),
  ('10000000-0000-0000-0000-000000000001', 7005, 1009, 'leads', null, 'Ambiguo', null, false),
  ('10000000-0000-0000-0000-000000000001', 7006, 5007, 'contacts', null, 'De contacto', null, false);

-- Tarjetas que ya existen: dos manuales sin ficha con el teléfono del 5009 y una de Chatwoot con el del 5011.
insert into public.crm_tarjetas (tenant_id, nombre_visible, phone_last10, fuente) values
  ('10000000-0000-0000-0000-000000000001', 'Manual A', '4125550302', 'manual'),
  ('10000000-0000-0000-0000-000000000001', 'Manual B', '4125550302', 'manual');
select * from public.crm_entrada_chatwoot(
  '10000000-0000-0000-0000-000000000001', 77, null, '4125550303', 'Chat Once', 'whatsapp_leads', null, null,
  now() - interval '30 days');
-- Y otra de Chatwoot que ya tiene dueño (el admin 01): la carga no se lo cambia.
select * from public.crm_entrada_chatwoot(
  '10000000-0000-0000-0000-000000000001', 78, null, '4125550304', 'Chat Doce', 'whatsapp_leads', null, null,
  now() - interval '30 days');
update public.crm_tarjetas set asesor_id = '20000000-0000-0000-0000-000000000001' where chatwoot_contact_id = 78;

\ir ../cargas/crm-kommo/carga.sql

-- La marca de la copia efímera: el ensayo la pone con «alter database … set dtd.entorno = 'copia'». Queda
-- guardada en pg_db_role_setting (se deshace con el rollback del contrato) y vale para las sesiones nuevas;
-- en esta sesión se pone además con set_config, que es lo que vería una sesión abierta después.
do $marca$
begin
  execute pg_catalog.format('alter database %I set dtd.entorno = %L', pg_catalog.current_database(), 'copia');
end;
$marca$;
select set_config('dtd.entorno', 'copia', true);

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST CARGA KOMMO: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;
create temporary table corrida (n int, clave text, valor bigint);
create function pg_temp.c(p_n int, p_clave text) returns bigint language sql as $$
  select coalesce((select r.valor from pg_temp.corrida r where r.n = p_n and r.clave = p_clave), 0)
$$;
-- Huella de lo que la carga no puede tocar: el espejo, las fichas y T2.
create function pg_temp.huella_ajena() returns text language sql as $$
  select md5(concat_ws('|',
    (select string_agg(concat_ws(',', id, status_id, kommo_updated_at, synced_at), ';' order by tenant_id, id) from public.kommo_leads),
    (select string_agg(concat_ws(',', id, name, phone, synced_at), ';' order by tenant_id, id) from public.kommo_contacts),
    (select string_agg(concat_ws(',', id, is_completed, text), ';' order by tenant_id, id) from public.kommo_tasks),
    (select string_agg(concat_ws(',', id, email), ';' order by tenant_id, id) from public.kommo_users),
    (select count(*) from public.kommo_lead_contacts),
    (select string_agg(concat_ws(',', id, phone, kommo_lead_id, kommo_contact_id, deleted_at), ';' order by id) from public.clients),
    (select count(*) from public.crm_tarjetas where tenant_id = '10000000-0000-0000-0000-000000000002')))
$$;
create function pg_temp.huella_crm() returns text language sql as $$
  select md5(concat_ws('|',
    (select string_agg(concat_ws(',', id, client_id, nombre_visible, phone_last10, etapa_leads, asesor_id, fuente, fuente_detalle, ultima_actividad_at), ';' order by id) from public.crm_tarjetas),
    (select string_agg(concat_ws(',', tarjeta_id, de, a, origen), ';' order by id) from public.crm_historial_etapas),
    (select string_agg(concat_ws(',', id, tarjeta_id, texto, vence_at, asignado_a, origen), ';' order by id) from public.crm_tareas),
    (select string_agg(concat_ws(',', tipo, id_externo, tarjeta_id, tarea_id, usuario_id), ';' order by tipo, id_externo) from public.crm_ids_externos)))
$$;
create temporary table huellas (cual text primary key, valor text);
insert into huellas values ('ajena_antes', pg_temp.huella_ajena()), ('crm_antes', pg_temp.huella_crm());
create function pg_temp.corte() returns timestamptz language sql as $$ select now() - interval '1 day' $$;

-- ─── Modo seco: la misma corrida dentro de un savepoint que se deshace no deja nada ───────────────────
savepoint seco;
insert into corrida select 0, r.clave, r.valor
from pg_temp.crm_carga_kommo('10000000-0000-0000-0000-000000000001', pg_temp.corte(), 180, 'copia', null) r;
do $seco_dentro$
begin
  perform pg_temp.assert_true(pg_temp.c(0, 'tarjetas_creadas') = 6, 'el seco cuenta lo mismo que la carga');
end;
$seco_dentro$;
rollback to savepoint seco;
release savepoint seco;
do $seco$
begin
  perform pg_temp.assert_true(not exists (select 1 from pg_temp.corrida), 'el seco se deshace con su conteo');
  perform pg_temp.assert_true(
    pg_temp.huella_crm() = (select valor from pg_temp.huellas where cual = 'crm_antes'), 'el seco no deja nada en crm_*');
end;
$seco$;

-- ─── Primera corrida ─────────────────────────────────────────────────────────────────────────────────
insert into corrida select 1, r.clave, r.valor
from pg_temp.crm_carga_kommo('10000000-0000-0000-0000-000000000001', pg_temp.corte(), 180, 'copia', null) r;

do $primera$
declare
  t public.crm_tarjetas;
  v_t2 uuid := '10000000-0000-0000-0000-000000000002';
begin
  -- Conteos del alcance (D4 a).
  perform pg_temp.assert_true(pg_temp.c(1, 'leads_en_espejo') = 19, 'leads del espejo de T1: 19');
  perform pg_temp.assert_true(pg_temp.c(1, 'leads_cerrados') = 4, 'ganado, perdido y cerrado quedan fuera');
  perform pg_temp.assert_true(pg_temp.c(1, 'leads_despues_del_corte') = 1, 'el creado después del corte queda fuera');
  perform pg_temp.assert_true(pg_temp.c(1, 'leads_fuera_de_ventana') = 1, 'el quieto hace 200 días queda fuera');
  perform pg_temp.assert_true(pg_temp.c(1, 'leads_etapa_desconocida') = 1, 'una etapa sin mapa no se adivina');
  perform pg_temp.assert_true(pg_temp.c(1, 'leads_en_alcance') = 12, 'en alcance: 12');
  perform pg_temp.assert_true(pg_temp.c(1, 'leads_ambiguos') = 1, 'dos tarjetas con el mismo teléfono: no adivina');
  perform pg_temp.assert_true(pg_temp.c(1, 'leads_sin_ubicador') = 2, 'sin ficha viva ni teléfono no se carga');
  perform pg_temp.assert_true(pg_temp.c(1, 'tarjetas_creadas') = 6, 'tarjetas creadas: 6');
  perform pg_temp.assert_true(pg_temp.c(1, 'tarjetas_con_ficha') = 3 and pg_temp.c(1, 'tarjetas_sin_ficha') = 3, 'tres con ficha y tres sin ficha');
  perform pg_temp.assert_true(pg_temp.c(1, 'leads_misma_persona') = 1, 'dos leads de un contacto dan una tarjeta');
  perform pg_temp.assert_true(pg_temp.c(1, 'tarjetas_existentes') = 2, 'las tarjetas de Chatwoot se reusan');
  perform pg_temp.assert_true(pg_temp.c(1, 'mapeos_lead') = 9 and pg_temp.c(1, 'mapeos_contacto') = 7, 'mapeos: 9 leads y 7 contactos');
  perform pg_temp.assert_true(pg_temp.c(1, 'etapa_nuevo') = 2 and pg_temp.c(1, 'etapa_contactado') = 1
    and pg_temp.c(1, 'etapa_registrado_recontacto') = 1 and pg_temp.c(1, 'etapa_estimado_enviado') = 1
    and pg_temp.c(1, 'etapa_negociacion') = 1, 'conteo por etapa');
  perform pg_temp.assert_true(pg_temp.c(1, 'usuarios_kommo') = 4 and pg_temp.c(1, 'usuarios_mapeados') = 1
    and pg_temp.c(1, 'usuarios_sin_par') = 3, 'asesores: solo el correo de un usuario activo');
  perform pg_temp.assert_true(pg_temp.c(1, 'tarjetas_con_asesor') = 2 and pg_temp.c(1, 'asesor_completado') = 1, 'asesor en 2 nuevas y 1 existente');
  perform pg_temp.assert_true(pg_temp.c(1, 'tareas_creadas') = 3 and pg_temp.c(1, 'tareas_sin_vencimiento') = 2, 'tareas abiertas: 3, dos sin vencimiento');
  perform pg_temp.assert_true(pg_temp.c(1, 'total_mapeos_kommo') = 20 and pg_temp.c(1, 'total_tarjetas_kommo') = 6, 'totales del tenant');

  -- Mapeo de asesores.
  perform pg_temp.assert_true((select x.usuario_id from public.crm_ids_externos x
    where x.tipo = 'usuario' and x.id_externo = 901 and x.tenant_id = '10000000-0000-0000-0000-000000000001')
    = '20000000-0000-0000-0000-000000000002', 'el 901 es el usuario 02');
  perform pg_temp.assert_true(not exists (select 1 from public.crm_ids_externos x where x.tipo = 'usuario' and x.id_externo = 902),
    'el asesor desactivado no se mapea');

  -- Ficha por el teléfono (1001): sin nombre ni teléfono copiados, etapa, asesor, fuente e historial.
  select * into t from public.crm_tarjetas where client_id = '30000000-0000-0000-0000-000000000001';
  perform pg_temp.assert_true(t.nombre_visible is null and t.phone_last10 is null, 'con ficha no copia nombre ni teléfono (D6)');
  perform pg_temp.assert_true(t.etapa_leads = 'estimado_enviado', 'etapa mapeada de Kommo');
  perform pg_temp.assert_true(t.asesor_id = '20000000-0000-0000-0000-000000000002', 'asesor por correo');
  perform pg_temp.assert_true(t.fuente = 'kommo' and t.fuente_detalle = 'waba', 'fuente kommo con el canal de origen');
  perform pg_temp.assert_true((select count(*) from public.crm_historial_etapas h
    where h.tarjeta_id = t.id and h.origen = 'migracion' and h.de is null and h.a = 'estimado_enviado') = 1, 'historial de migración');
  perform pg_temp.assert_true(not exists (select 1 from public.crm_tarjetas x
    where x.tenant_id = v_t2 and x.fuente = 'kommo'), 'nada en T2');

  -- Ficha por el vínculo del lead (1002) y por el del contacto (1003); la borrada (1006) no cuenta.
  perform pg_temp.assert_true(exists (select 1 from public.crm_tarjetas x
    where x.client_id = '30000000-0000-0000-0000-000000000002' and x.etapa_leads = 'contactado' and x.asesor_id is null),
    'ficha por kommo_lead_id, sin asesor desactivado');
  perform pg_temp.assert_true(exists (select 1 from public.crm_tarjetas x
    where x.client_id = '30000000-0000-0000-0000-000000000003' and x.etapa_leads = 'registrado_recontacto'),
    'ficha por kommo_contact_id');
  perform pg_temp.assert_true(not exists (select 1 from public.crm_tarjetas x
    where x.client_id = '30000000-0000-0000-0000-000000000006'), 'la ficha borrada no recibe tarjeta');

  -- Teléfono con dos fichas (1004): tarjeta sin ficha, con nombre y 10 dígitos.
  perform pg_temp.assert_true(exists (select 1 from public.crm_tarjetas x
    where x.client_id is null and x.phone_last10 = '4125550204' and x.nombre_visible = 'Contacto Cuatro' and x.fuente = 'kommo'),
    'ficha ambigua: tarjeta sin ficha');

  -- Contacto principal y nombre recortado (1007); tareas.
  select * into t from public.crm_tarjetas where phone_last10 = '4125550300';
  perform pg_temp.assert_true(t.nombre_visible = 'Lead Siete' and t.etapa_leads = 'nuevo', 'contacto principal y nombre sin espacios');
  perform pg_temp.assert_true(t.ultima_actividad_at > now() - interval '16 days', 'la actividad toma el último entrante');
  perform pg_temp.assert_true(exists (select 1 from public.crm_tareas k where k.tarjeta_id = t.id and k.texto = 'Llamar'
    and k.vence_at > now() and k.asignado_a = '20000000-0000-0000-0000-000000000002' and k.origen = 'migracion'), 'tarea abierta migrada');
  perform pg_temp.assert_true(exists (select 1 from public.crm_tareas k where k.tarjeta_id = t.id and k.texto = 'Tarea de Kommo'
    and k.vence_at is null and k.asignado_a is null), 'tarea sin texto y con vencimiento en milisegundos');
  perform pg_temp.assert_true(not exists (select 1 from public.crm_tareas k where k.texto in ('Hecha', 'De contacto', 'Ambiguo')),
    'ni completadas, ni de contacto, ni de un lead sin cargar');

  -- Dos leads del mismo contacto (1081 y 1082): una tarjeta, la etapa del más reciente y las tareas de los dos.
  select * into t from public.crm_tarjetas where phone_last10 = '4125550301';
  perform pg_temp.assert_true(t.etapa_leads = 'negociacion', 'el lead más reciente fija la etapa');
  perform pg_temp.assert_true((select count(*) from public.crm_ids_externos x where x.tarjeta_id = t.id and x.tipo = 'lead') = 2,
    'los dos leads apuntan a la misma tarjeta');
  perform pg_temp.assert_true(exists (select 1 from public.crm_tareas k where k.tarjeta_id = t.id and k.texto = 'Del segundo lead'),
    'la tarea del segundo lead va a la misma tarjeta');

  -- Tarjeta que ya existía (1011): gana su etapa y su fuente; se completa el asesor.
  select * into t from public.crm_tarjetas where chatwoot_contact_id = 77;
  perform pg_temp.assert_true(t.etapa_leads = 'nuevo' and t.fuente = 'whatsapp_leads', 'la tarjeta de Studio gana la etapa (§5.3)');
  perform pg_temp.assert_true(t.asesor_id = '20000000-0000-0000-0000-000000000002', 'se completa el asesor vacío');
  perform pg_temp.assert_true(t.ultima_actividad_at > now() - interval '20 days', 'la actividad no retrocede y sube');
  perform pg_temp.assert_true(not exists (select 1 from public.crm_historial_etapas h where h.tarjeta_id = t.id and h.origen = 'migracion'),
    'sin historial de migración en la existente');
  perform pg_temp.assert_true((select count(*) from public.crm_tarjetas x where x.phone_last10 = '4125550302') = 2
    and not exists (select 1 from public.crm_ids_externos x where x.id_externo = 1009), 'las manuales ambiguas quedan como estaban');
  select * into t from public.crm_tarjetas where chatwoot_contact_id = 78;
  perform pg_temp.assert_true(t.asesor_id = '20000000-0000-0000-0000-000000000001' and t.etapa_leads = 'nuevo',
    'la tarjeta con dueño conserva su dueño y su etapa');

  -- Nada fuera de crm_*.
  perform pg_temp.assert_true(pg_temp.huella_ajena() = (select valor from pg_temp.huellas where cual = 'ajena_antes'),
    'no toca el espejo, las fichas ni T2');
end;
$primera$;

insert into huellas values ('crm_primera', pg_temp.huella_crm());

-- ─── Segunda corrida con el mismo corte: no cambia nada ──────────────────────────────────────────────
insert into corrida select 2, r.clave, r.valor
from pg_temp.crm_carga_kommo('10000000-0000-0000-0000-000000000001', pg_temp.corte(), 180, 'copia', null) r;

do $segunda$
begin
  perform pg_temp.assert_true(pg_temp.huella_crm() = (select valor from pg_temp.huellas where cual = 'crm_primera'),
    'la segunda corrida no cambia crm_*');
  perform pg_temp.assert_true(pg_temp.c(2, 'leads_ya_migrados') = 9 and pg_temp.c(2, 'tarjetas_creadas') = 0
    and pg_temp.c(2, 'tareas_creadas') = 0 and pg_temp.c(2, 'mapeos_lead') = 0, 'todo ya migrado');
  perform pg_temp.assert_true(pg_temp.c(2, 'usuarios_ya_mapeados') = 1 and pg_temp.c(2, 'usuarios_mapeados') = 0, 'asesor ya mapeado');
  perform pg_temp.assert_true(pg_temp.c(2, 'total_mapeos_kommo') = 20 and pg_temp.c(2, 'total_tarjetas_kommo') = 6, 'mismos totales');
end;
$segunda$;

-- ─── Una tarea nueva en un lead ya migrado entra en la siguiente corrida, y solo ella ─────────────────
insert into public.kommo_tasks (tenant_id, id, entity_id, entity_type, text, is_completed) values
  ('10000000-0000-0000-0000-000000000001', 7007, 1001, 'leads', 'Nueva', false);
insert into corrida select 3, r.clave, r.valor
from pg_temp.crm_carga_kommo('10000000-0000-0000-0000-000000000001', pg_temp.corte(), 180, 'copia', null) r;
do $tercera$
begin
  perform pg_temp.assert_true(pg_temp.c(3, 'tareas_creadas') = 1 and pg_temp.c(3, 'tarjetas_creadas') = 0, 'solo la tarea nueva');
  perform pg_temp.assert_true(exists (select 1 from public.crm_tareas k join public.crm_tarjetas t on t.id = k.tarjeta_id
    where k.texto = 'Nueva' and t.client_id = '30000000-0000-0000-0000-000000000001'), 'va a la tarjeta del lead');
end;
$tercera$;

-- ─── Preflight ───────────────────────────────────────────────────────────────────────────────────────
do $preflight$
declare
  v_ok boolean;
begin
  begin
    perform pg_temp.crm_carga_kommo('10000000-0000-0000-0000-000000000001', now() + interval '1 hour', 180, 'copia', null);
    v_ok := false;
  exception when invalid_parameter_value then v_ok := true;
  end;
  perform pg_temp.assert_true(v_ok, 'un corte en el futuro se rechaza');
  begin
    perform pg_temp.crm_carga_kommo('10000000-0000-0000-0000-000000000001', pg_temp.corte(), 0, 'copia', null);
    v_ok := false;
  exception when invalid_parameter_value then v_ok := true;
  end;
  perform pg_temp.assert_true(v_ok, 'cero días se rechaza');
  begin
    perform pg_temp.crm_carga_kommo('10000000-0000-0000-0000-0000000000ff', pg_temp.corte(), 180, 'copia', null);
    v_ok := false;
  exception when invalid_parameter_value then v_ok := true;
  end;
  perform pg_temp.assert_true(v_ok, 'un tenant inexistente se rechaza');

  -- El entorno pedido tiene que coincidir con la marca de la base, aunque el identificador sea el bueno.
  begin
    perform pg_temp.crm_carga_kommo('10000000-0000-0000-0000-000000000001', pg_temp.corte(), 180, 'produccion',
      (select s.system_identifier::text from pg_control_system() s));
    v_ok := false;
  exception when invalid_parameter_value then v_ok := sqlerrm like '%entorno%';
  end;
  perform pg_temp.assert_true(v_ok, 'pedir produccion en una base marcada como copia se rechaza');
  begin
    perform set_config('dtd.entorno', '', true);
    perform pg_temp.crm_carga_kommo('10000000-0000-0000-0000-000000000001', pg_temp.corte(), 180, 'copia', null);
    v_ok := false;
  exception when invalid_parameter_value then v_ok := sqlerrm like '%entorno%';
  end;
  perform pg_temp.assert_true(v_ok, 'pedir copia en una base sin marca se rechaza');
  perform pg_temp.assert_true(current_setting('dtd.entorno', true) = 'copia', 'la marca vuelve después del caso');
  begin
    perform pg_temp.crm_carga_kommo('10000000-0000-0000-0000-000000000001', pg_temp.corte(), 180, 'otro', null);
    v_ok := false;
  exception when invalid_parameter_value then v_ok := sqlerrm like '%entorno%';
  end;
  perform pg_temp.assert_true(v_ok, 'un entorno desconocido se rechaza');

  -- La marca puesta solo en la sesión (PGOPTIONS, options= del servicio o un set) no vale como copia.
  begin
    execute pg_catalog.format('alter database %I reset dtd.entorno', pg_catalog.current_database());
    set dtd.entorno = 'copia';
    perform pg_temp.crm_carga_kommo('10000000-0000-0000-0000-000000000001', pg_temp.corte(), 180, 'copia', null);
    v_ok := false;
  exception when invalid_parameter_value then v_ok := sqlerrm like '%no está guardada para la base%';
  end;
  perform pg_temp.assert_true(v_ok, 'la marca copia solo en la sesión se rechaza');
  -- Guardada para un rol (alter role … in database) tampoco: la marca es de la base, para todos.
  begin
    execute pg_catalog.format('alter database %I reset dtd.entorno', pg_catalog.current_database());
    execute pg_catalog.format('alter role %I in database %I set dtd.entorno = %L',
      current_user, pg_catalog.current_database(), 'copia');
    perform pg_temp.crm_carga_kommo('10000000-0000-0000-0000-000000000001', pg_temp.corte(), 180, 'copia', null);
    v_ok := false;
  exception when invalid_parameter_value then v_ok := sqlerrm like '%no está guardada para la base%';
  end;
  perform pg_temp.assert_true(v_ok, 'la marca copia guardada solo para un rol se rechaza');
  perform pg_temp.assert_true(exists (select 1 from pg_catalog.pg_db_role_setting s
    where s.setrole = 0 and 'dtd.entorno=copia' = any (s.setconfig)), 'la marca guardada vuelve después del caso');

  -- Producción se identifica en positivo: sin marca y con el system_identifier que trae quien opera.
  begin
    perform set_config('dtd.entorno', '', true);
    perform pg_temp.crm_carga_kommo('10000000-0000-0000-0000-000000000001', pg_temp.corte(), 180, 'produccion', '1');
    v_ok := false;
  exception when invalid_parameter_value then v_ok := sqlerrm like '%identificador del sistema%';
  end;
  perform pg_temp.assert_true(v_ok, 'produccion con el identificador equivocado se rechaza');
  begin
    perform set_config('dtd.entorno', '', true);
    perform pg_temp.crm_carga_kommo('10000000-0000-0000-0000-000000000001', pg_temp.corte(), 180, 'produccion', null);
    v_ok := false;
  exception when invalid_parameter_value then v_ok := sqlerrm like '%identificador del sistema%';
  end;
  perform pg_temp.assert_true(v_ok, 'produccion sin identificador se rechaza');
  begin
    perform set_config('dtd.entorno', '', true);
    perform pg_temp.crm_carga_kommo('10000000-0000-0000-0000-000000000001', pg_temp.corte(), 180, 'produccion',
      (select s.system_identifier::text from pg_control_system() s));
    raise exception 'paso_produccion';
  exception when others then v_ok := sqlerrm = 'paso_produccion';
  end;
  perform pg_temp.assert_true(v_ok, 'produccion sin marca y con su identificador pasa');
  perform pg_temp.assert_true(current_setting('dtd.entorno', true) = 'copia', 'la marca vuelve después de los casos de produccion');

  -- Dos fichas vivas con el mismo kommo_lead_id: no se elige una, se aborta.
  begin
    insert into public.kommo_leads (tenant_id, id, name, status_id, kommo_created_at, kommo_updated_at)
    values ('10000000-0000-0000-0000-000000000001', 1020, 'L', 108343827, now() - interval '90 days', now() - interval '3 days');
    insert into public.clients (id, tenant_id, markbox, kommo_lead_id) values
      ('30000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000001', 'DTD-1020', 1020),
      ('30000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000001', 'DTD-1021', 1020);
    perform pg_temp.crm_carga_kommo('10000000-0000-0000-0000-000000000001', pg_temp.corte(), 180, 'copia', null);
    v_ok := false;
  exception when others then v_ok := sqlerrm like '%kommo_lead_id%';
  end;
  perform pg_temp.assert_true(v_ok, 'dos fichas vivas con el mismo kommo_lead_id abortan la carga');
  perform pg_temp.assert_true(not exists (select 1 from public.kommo_leads where id = 1020), 'el caso se deshizo');

  -- A un tenant le falta una etapa del mapa: el preflight aborta.
  begin
    delete from public.crm_etapas
    where tenant_id = '10000000-0000-0000-0000-000000000002' and tablero = 'leads' and clave = 'negociacion';
    perform pg_temp.crm_carga_kommo('10000000-0000-0000-0000-000000000002', pg_temp.corte(), 180, 'copia', null);
    v_ok := false;
  exception when others then v_ok := sqlerrm like '%faltan etapas%';
  end;
  perform pg_temp.assert_true(v_ok, 'sin las etapas sembradas el preflight aborta');
end;
$preflight$;

select 'TEST CARGA KOMMO GREEN: ' || (select last_value from pg_temp.assertion_count) || ' aserciones' as resultado;

rollback;
