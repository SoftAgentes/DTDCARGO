\set ON_ERROR_STOP on

-- SDD-0676 · contrato de la 0566 («Vincular a cliente»: unión primero, teléfono después).
--
-- Monta lo mínimo que dan por sentado las migraciones de Chatwoot y del CRM (la
-- misma forma que el contrato de la 0513) más lo que pide la 0554 (user_has_module,
-- el catálogo de auditoría y append_audit_event, dobles con la MISMA firma). Después
-- aplica la 0503, 0504, 0505, 0506, 0513 y 0554 REALES y la 0566 dos veces
-- (idempotencia), y llama las RPC como service_role, igual que el ERP.
--
-- Negativos: ninguna sesión ejecuta las funciones; un actor sin edición de la
-- Bandeja, desactivado o de otro tenant no vincula; una ficha de otro tenant o
-- borrada no recibe uniones; un chat unido a otra ficha no se mueve sin p_mover.
--
-- CONTROL ROJO: sin la 0566 cae en la primera aserción (la columna no existe).
-- Termina siempre en ROLLBACK. Solo ids, nombres y teléfonos sintéticos (555).
begin;

do $roles$
begin
  if to_regclass('public.crm_tarjetas') is not null then
    raise exception 'Fixture 0566 rechazada: el objeto real ya existe';
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

-- Doble de user_has_module (firma de 0538): admin todo; bandeja para commercial y
-- support, support sin edición. Filtra de verdad por el rol de la sesión.
create function public.user_has_module(p_module_id text, p_edit boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when ut.role = 'admin' then true
      when p_module_id = 'bandeja' and ut.role in ('commercial', 'support') then not (coalesce(p_edit, false) and ut.role = 'support')
      else false
    end
    from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = (select public.get_user_tenant_id())
      and ut.disabled_at is null
    limit 1
  ), false);
$$;
revoke all on function public.user_has_module(text, boolean) from public, anon;
grant execute on function public.user_has_module(text, boolean) to authenticated, service_role;

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

-- Forma de 0258 + entity_audit_log con FK al catálogo, y el doble de append_audit_event (0294).
create table public.audit_entity_types (
  entity_type text primary key,
  status text not null check (status in ('active', 'deprecated')),
  domain_code text,
  contract_version integer,
  introduced_by_ref text
);
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  entity_type text not null references public.audit_entity_types(entity_type),
  entity_id uuid not null,
  actor_type text not null,
  actor_id uuid,
  event_type text not null,
  reason text,
  before_data jsonb,
  after_data jsonb,
  payload jsonb not null default '{}'::jsonb,
  correlation_id text check (correlation_id is null or correlation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  occurred_at timestamptz not null default now()
);
create function public.append_audit_event(
  p_tenant_id uuid, p_entity_type text, p_entity_id uuid, p_actor_type text, p_actor_id uuid,
  p_event_type text, p_source text, p_result text default 'succeeded', p_reason text default null,
  p_before_data jsonb default null, p_after_data jsonb default null, p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null, p_schema_version integer default 1, p_sensitivity text default 'internal'
) returns uuid language plpgsql security definer set search_path = '' as $fn$
declare v_id uuid;
begin
  if not exists (select 1 from public.audit_entity_types where entity_type = p_entity_type and status = 'active') then
    raise exception 'audit: entity_type inexistente o inactivo';
  end if;
  if p_reason is not null and pg_catalog.char_length(p_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres';
  end if;
  insert into public.entity_audit_log (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, reason, before_data, after_data, payload, correlation_id)
  values (p_tenant_id, p_entity_type, p_entity_id, p_actor_type, p_actor_id, p_event_type, p_reason, p_before_data, p_after_data, p_payload, p_correlation_id)
  returning id into v_id;
  return v_id;
end;
$fn$;
revoke all on function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text) from public, anon, authenticated;

-- ── Fixture ─────────────────────────────────────────────────────────────
insert into public.tenants values
  ('10000000-0000-0000-0000-000000000001', 'dtd'),
  ('10000000-0000-0000-0000-000000000002', 'otro');
insert into auth.users values
  ('20000000-0000-0000-0000-000000000001'), ('20000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000003'), ('20000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000005');
-- 01 admin T1 · 02 comercial T1 · 03 admin T2 · 04 soporte T1 · 05 comercial T1 desactivado.
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin', null),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'commercial', null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'admin', null),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'support', null),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'commercial', now());

-- T1. 01: cliente (con carga) y asesor 01, sin tarjeta. 02: lead registrado, sin asesor.
-- 03: ya tiene tarjeta (alta web). 04: se borra después. 06: borrada. La 19 es de T2.
insert into public.clients (id, tenant_id, markbox, phone, advisor_id, deleted_at) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'DTD-1001', '+584125550201', '20000000-0000-0000-0000-000000000001', null),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'DTD-1002', '+584125550202', null, null),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'DTD-1003', '+584125550203', null, null),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'DTD-1004', '+584125550204', null, null),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'DTD-1006', '+584125550206', null, now()),
  ('30000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000002', 'DTD-1019', '+584125550219', null, null);
insert into public.shipments (tenant_id, client_markbox, status) values
  ('10000000-0000-0000-0000-000000000001', 'DTD-1001', 'in_transit');

\ir ../migrations/0503_chatwoot_bandeja.sql
\ir ../migrations/0504_chatwoot_eventos.sql
\ir ../migrations/0505_chatwoot_segmento.sql
\ir ../migrations/0506_crm_modelo.sql
\ir ../migrations/0513_crm_entrada_leads.sql
\ir ../migrations/0554_chatwoot_contact_links.sql

-- El chat del portal (0519), lo justo para chatwoot_portal_vincular: la tabla de hilos de la
-- 0106 con las columnas que lee, y las dos tablas de la 0519 copiadas tal cual.
create table public.conversations (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid references public.clients(id),
  channel text not null
);
create table public.chatwoot_portal_contactos (
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  client_id           uuid not null references public.clients(id) on delete cascade,
  identificador       uuid not null default gen_random_uuid() unique,
  chatwoot_contact_id bigint check (chatwoot_contact_id > 0 and chatwoot_contact_id <= 2147483647),
  chatwoot_source_id  text check (
    chatwoot_source_id ~ '^[A-Za-z0-9._:@=+/-]{1,255}$' and chatwoot_source_id !~ '^\+?[0-9]+$'
  ),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (tenant_id, client_id),
  unique (tenant_id, chatwoot_contact_id),
  check ((chatwoot_contact_id is null) = (chatwoot_source_id is null))
);
create table public.chatwoot_portal_hilos (
  conversation_id          uuid primary key references public.conversations(id) on delete cascade,
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  chatwoot_conversation_id bigint not null check (chatwoot_conversation_id > 0 and chatwoot_conversation_id <= 2147483647),
  created_at               timestamptz not null default now(),
  unique (tenant_id, chatwoot_conversation_id)
);

\ir ../migrations/0566_chatwoot_vincular_canal.sql
-- Idempotente: aplicarla otra vez no falla ni cambia nada.
\ir ../migrations/0566_chatwoot_vincular_canal.sql

-- Agente 7 → comercial 02 en T1.
insert into public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 7);

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0566: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

create function pg_temp.t1() returns uuid language sql immutable as $$ select '10000000-0000-0000-0000-000000000001'::uuid $$;
create function pg_temp.u(p_n text) returns uuid language sql immutable as $$ select ('20000000-0000-0000-0000-0000000000' || p_n)::uuid $$;
create function pg_temp.k(p_n text) returns uuid language sql immutable as $$ select ('30000000-0000-0000-0000-0000000000' || p_n)::uuid $$;

-- Las RPC, como service_role (igual que el ERP después de su candado).
create function pg_temp.vincular(
  p_actor uuid, p_ficha uuid, p_contacto bigint, p_canal text default 'instagram',
  p_motivo text default 'Vinculado desde la conversación 9', p_mover boolean default false,
  p_tenant uuid default '10000000-0000-0000-0000-000000000001'
) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  set local role service_role;
  v := public.chatwoot_vincular_contacto(p_tenant, p_actor, p_ficha, p_contacto, p_canal, p_motivo, p_mover);
  reset role;
  return v;
end;
$$;

-- El sqlstate con que falla vincular, o null si no falla.
create function pg_temp.vincular_falla(
  p_actor uuid, p_ficha uuid, p_contacto bigint, p_canal text default 'instagram',
  p_motivo text default 'Vinculado desde la conversación 9', p_mover boolean default false,
  p_tenant uuid default '10000000-0000-0000-0000-000000000001'
) returns text language plpgsql as $$
declare v_estado text;
begin
  begin
    set local role service_role;
    perform public.chatwoot_vincular_contacto(p_tenant, p_actor, p_ficha, p_contacto, p_canal, p_motivo, p_mover);
    v_estado := null;
  exception when others then
    v_estado := sqlstate;
  end;
  reset role;
  return v_estado;
end;
$$;

create function pg_temp.entrada(
  p_contacto bigint, p_telefono text, p_nombre text default 'Lead Sintetico',
  p_agente bigint default null, p_clave text default null, p_ocurrio timestamptz default now(),
  p_fuente text default 'instagram'
) returns record language plpgsql as $$
declare r record;
begin
  set local role service_role;
  select * into r from public.crm_entrada_chatwoot(
    pg_temp.t1(), p_contacto, null, p_telefono, p_nombre, p_fuente, p_agente, p_clave, p_ocurrio);
  reset role;
  return r;
end;
$$;

create function pg_temp.evento(
  p_clave text, p_conversacion bigint, p_telefono text, p_actualizado double precision, p_contacto bigint default null
) returns uuid language plpgsql as $$
declare r record;
begin
  set local role service_role;
  select * into r from public.chatwoot_registrar_evento(
    pg_temp.t1(), p_clave, 'message_created', p_conversacion, 3, 'open', 0, null, p_telefono, null,
    p_actualizado, null, false, p_contacto);
  reset role;
  return r.client_id;
end;
$$;

-- Lo mismo, pero devuelve de dónde dice la función que salió el cliente.
create function pg_temp.evento_origen(
  p_clave text, p_conversacion bigint, p_telefono text, p_actualizado double precision, p_contacto bigint default null
) returns text language plpgsql as $$
declare r record;
begin
  set local role service_role;
  select * into r from public.chatwoot_registrar_evento(
    pg_temp.t1(), p_clave, 'message_created', p_conversacion, 3, 'open', 0, null, p_telefono, null,
    p_actualizado, null, false, p_contacto);
  reset role;
  return r.origen_cliente;
end;
$$;

create function pg_temp.del_contacto(p_contacto bigint) returns public.crm_tarjetas language sql as $$
  select t.* from public.crm_tarjetas t where t.tenant_id = pg_temp.t1() and t.chatwoot_contact_id = p_contacto
$$;
create function pg_temp.de_la_ficha(p_ficha uuid) returns public.crm_tarjetas language sql as $$
  select t.* from public.crm_tarjetas t where t.tenant_id = pg_temp.t1() and t.client_id = p_ficha
$$;

-- ─── 1. Forma y permisos ─────────────────────────────────────────────────────
do $forma$
begin
  perform pg_temp.assert_true(exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'chatwoot_contact_links' and column_name = 'canal_chat'),
    '1a la unión guarda el canal');
  perform pg_temp.assert_true(exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_tarjetas' and column_name = 'absorbida_en'),
    '1b la tarjeta guarda quién la absorbió');
  perform pg_temp.assert_true(
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'chatwoot_registrar_evento') = 1,
    '1c queda UNA sola firma de chatwoot_registrar_evento');
  perform pg_temp.assert_true(
    not has_function_privilege('authenticated', 'public.chatwoot_vincular_contacto(uuid,uuid,uuid,bigint,text,text,boolean)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.chatwoot_vincular_contacto(uuid,uuid,uuid,bigint,text,text,boolean)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.chatwoot_vincular_contacto(uuid,uuid,uuid,bigint,text,text,boolean)', 'EXECUTE'),
    '1d vincular es solo de service_role');
  perform pg_temp.assert_true(
    not has_function_privilege('authenticated', 'public.chatwoot_ficha_de_contacto(uuid,bigint)', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.crm_absorber_tarjeta_de_contacto(uuid,uuid,bigint)', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.crm_soltar_tarjeta_de_contacto(uuid,bigint)', 'EXECUTE'),
    '1e la ficha de un contacto no es de las sesiones; absorber y soltar no son de nadie');
end;
$forma$;

-- ─── 2. Quién vincula y qué ficha ────────────────────────────────────────────
do $actor$
begin
  perform pg_temp.assert_true(pg_temp.vincular_falla(pg_temp.u('04'), pg_temp.k('01'), 900) = '42501',
    '2a soporte (Bandeja sin edición) no vincula');
  perform pg_temp.assert_true(pg_temp.vincular_falla(pg_temp.u('05'), pg_temp.k('01'), 900) = '42501',
    '2b un usuario desactivado no vincula');
  perform pg_temp.assert_true(pg_temp.vincular_falla(pg_temp.u('03'), pg_temp.k('01'), 900) = '42501',
    '2c un admin de OTRO tenant no vincula en este');
  perform pg_temp.assert_true(pg_temp.vincular_falla(pg_temp.u('02'), pg_temp.k('19'), 900) = 'P0002',
    '2d una ficha de otro tenant no recibe uniones');
  perform pg_temp.assert_true(pg_temp.vincular_falla(pg_temp.u('02'), pg_temp.k('06'), 900) = 'P0002',
    '2e una ficha borrada no recibe uniones');
  perform pg_temp.assert_true(pg_temp.vincular_falla(pg_temp.u('02'), pg_temp.k('01'), 900, 'telegram') = '22023',
    '2f un canal desconocido se rechaza');
  perform pg_temp.assert_true(pg_temp.vincular_falla(pg_temp.u('02'), pg_temp.k('01'), 900, 'instagram', 'no') = '22023',
    '2g el motivo va de 4 a 1000 caracteres');
  perform pg_temp.assert_true((select count(*) from public.chatwoot_contact_links) = 0,
    '2h ningún rechazo dejó una unión');
  perform pg_temp.assert_true((select count(*) from public.entity_audit_log) = 0,
    '2i ningún rechazo dejó auditoría');
end;
$actor$;

-- ─── 3. Vincular: unión con canal, tarjeta absorbida y auditoría ─────────────
do $vincular$
declare
  r      record;
  v      jsonb;
  lead   public.crm_tarjetas;
  cli    public.crm_tarjetas;
  antes  timestamptz;
begin
  -- Un lead escribe por Instagram: sin teléfono, tarjeta en «Nuevo» con su nombre visible.
  r := pg_temp.entrada(500, null, 'Lead Instagram', 7, 'message_created:1000', now() - interval '2 days');
  lead := pg_temp.del_contacto(500);
  perform pg_temp.assert_true(r.creada and lead.client_id is null and lead.etapa_leads = 'nuevo'
    and lead.nombre_visible = 'Lead Instagram' and lead.fuente = 'instagram',
    '3a antes de vincular es un lead suelto');
  perform pg_temp.assert_true(pg_temp.de_la_ficha(pg_temp.k('01')) is null, '3b el cliente 01 no tenía tarjeta');
  antes := lead.ultima_actividad_at;

  v := pg_temp.vincular(pg_temp.u('02'), pg_temp.k('01'), 500);
  perform pg_temp.assert_true(v ->> 'resultado' = 'unido' and (v ->> 'tarjeta_absorbida')::boolean,
    '3c vincular une y dice que absorbió una tarjeta');
  perform pg_temp.assert_true(exists (
    select 1 from public.chatwoot_contact_links l
    where l.tenant_id = pg_temp.t1() and l.chatwoot_contact_id = 500 and l.client_id = pg_temp.k('01')
      and l.origen = 'manual' and l.canal_chat = 'instagram' and l.created_by = pg_temp.u('02')),
    '3d la unión guarda ficha, canal y autor');

  cli := pg_temp.de_la_ficha(pg_temp.k('01'));
  lead := pg_temp.del_contacto(500);
  perform pg_temp.assert_true(cli.id is not null and cli.fuente = 'instagram'
    and cli.etapa_leads = 'registrado_recontacto' and cli.asesor_id = pg_temp.u('01'),
    '3e el cliente sin tarjeta recibe la suya: fuente del lead, etapa por segmento y el asesor de la ficha');
  perform pg_temp.assert_true(lead.absorbida_en = cli.id and lead.absorbida_at is not null,
    '3f la tarjeta del lead queda absorbida en la del cliente');
  perform pg_temp.assert_true(lead.etapa_leads = 'nuevo' and lead.nombre_visible = 'Lead Instagram'
    and lead.client_id is null and lead.ultima_actividad_at = antes,
    '3g absorber no mueve la etapa ni borra lo del lead');
  perform pg_temp.assert_true((select count(*) from public.crm_tarjetas where tenant_id = pg_temp.t1()) = 2,
    '3h quedan dos tarjetas: la del cliente y la absorbida');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log a
    where a.tenant_id = pg_temp.t1() and a.entity_type = 'chatwoot_contact_link' and a.entity_id = pg_temp.k('01')
      and a.event_type = 'chatwoot_contact_linked' and a.actor_id = pg_temp.u('02')
      and a.after_data ->> 'canal' = 'instagram' and (a.after_data ->> 'chatwoot_contact_id')::bigint = 500
      and (a.after_data ->> 'tarjeta_absorbida')::uuid = lead.id
      and a.reason = 'Vinculado desde la conversación 9'),
    '3i vincular queda auditado con el actor, el canal y la tarjeta absorbida');
  perform pg_temp.assert_true(not exists (
    select 1 from public.entity_audit_log a where a.after_data::text like '%Lead Instagram%' or a.payload::text like '%Lead Instagram%'),
    '3j la auditoría no lleva el nombre del lead');

  v := pg_temp.vincular(pg_temp.u('02'), pg_temp.k('01'), 500);
  perform pg_temp.assert_true(v ->> 'resultado' = 'ya_estaba'
    and (select count(*) from public.entity_audit_log where event_type = 'chatwoot_contact_linked') = 1,
    '3k vincular dos veces no duplica la unión ni la auditoría');

  -- Una tarjeta absorbida no puede pasar a ser de una ficha.
  begin
    update public.crm_tarjetas set client_id = pg_temp.k('02') where id = lead.id;
    perform pg_temp.assert_true(false, '3l una tarjeta absorbida no recibe ficha');
  exception when check_violation then
    perform pg_temp.assert_true(true, '3l una tarjeta absorbida no recibe ficha');
  end;
end;
$vincular$;

-- ─── 4. Reconocimiento automático: unión primero, teléfono después ───────────
do $reconocer$
declare
  r     record;
  lead  public.crm_tarjetas;
  cli   public.crm_tarjetas;
  antes timestamptz;
  ajena  uuid;
  propia uuid;
  ev     uuid;
  og     text;
begin
  lead := pg_temp.del_contacto(500);
  antes := lead.ultima_actividad_at;

  -- Vuelve a escribir por Instagram (sin teléfono): la actividad va a la tarjeta del cliente.
  r := pg_temp.entrada(500, null, 'Lead Instagram', null, 'message_created:2000', now());
  cli := pg_temp.de_la_ficha(pg_temp.k('01'));
  lead := pg_temp.del_contacto(500);
  perform pg_temp.assert_true(r.tarjeta_id = cli.id and not r.creada,
    '4a la entrada de un contacto vinculado cae en la tarjeta del cliente');
  perform pg_temp.assert_true(cli.ultima_actividad_at > antes and lead.ultima_actividad_at = antes
    and lead.absorbida_en = cli.id,
    '4b la actividad sube en la del cliente y la absorbida no se toca');
  perform pg_temp.assert_true((select count(*) from public.crm_tarjetas where tenant_id = pg_temp.t1()) = 2,
    '4c no nace otra tarjeta');

  -- El asesor del chat no se le pone a la tarjeta absorbida.
  set local role service_role;
  perform public.crm_asesor_desde_chatwoot(pg_temp.t1(), 500, null, null, 7);
  reset role;
  perform pg_temp.assert_true((pg_temp.de_la_ficha(pg_temp.k('01'))).asesor_id = pg_temp.u('01'),
    '4d el asesor de la tarjeta del cliente sigue siendo el de la ficha');

  -- El evento: con el contacto y sin teléfono, la conversación es del cliente unido.
  perform pg_temp.assert_true(pg_temp.evento('message_created:3000', 70, null, 100, 500) = pg_temp.k('01'),
    '4e el evento de un contacto vinculado devuelve su ficha, sin teléfono');
  perform pg_temp.assert_true(
    (select client_id from public.chatwoot_conversations where tenant_id = pg_temp.t1() and conversation_id = 70) = pg_temp.k('01'),
    '4f la conversación queda cruzada con la ficha unida');
  -- La unión manda sobre el teléfono (aquí, el teléfono de la ficha 02).
  perform pg_temp.assert_true(pg_temp.evento('message_created:3001', 71, '4125550202', 100, 500) = pg_temp.k('01'),
    '4g la unión manda sobre el teléfono');
  -- Sin contacto y sin teléfono (reproceso) se conserva el cruce anterior.
  -- El evento se registra ANTES de mirar la tabla: dentro de una misma expresión, Postgres
  -- puede leer la subconsulta primero y ver el estado de antes.
  ev := pg_temp.evento('message_created:3002', 70, null, 101);
  -- El evento devuelve el cliente que la conversación tiene de verdad: el conservado.
  perform pg_temp.assert_true(ev = pg_temp.k('01')
    and (select client_id from public.chatwoot_conversations where tenant_id = pg_temp.t1() and conversation_id = 70) = pg_temp.k('01'),
    '4h sin contacto ni teléfono el cruce guardado se conserva');
  -- Sin unión, el teléfono cruza como siempre.
  perform pg_temp.assert_true(pg_temp.evento('message_created:3004', 72, '4125550202', 100, 501) = pg_temp.k('02'),
    '4j sin unión, el teléfono con ficha única sigue cruzando');
  -- Ningún evento automático quita un cliente: el mismo contacto, ya sin teléfono y sin
  -- unión, conserva la ficha que la conversación tenía (y el evento la devuelve).
  ev := pg_temp.evento('message_created:3003', 72, null, 101, 501);
  perform pg_temp.assert_true(ev = pg_temp.k('02')
    and (select client_id from public.chatwoot_conversations where tenant_id = pg_temp.t1() and conversation_id = 72) = pg_temp.k('02'),
    '4i un evento con contacto, sin unión ni teléfono, conserva la ficha de la conversación');
  -- Un teléfono que dejó de coincidir con una ficha tampoco la quita.
  ev := pg_temp.evento('message_created:3006', 72, '4125559999', 102, 501);
  perform pg_temp.assert_true(ev = pg_temp.k('02')
    and (select client_id from public.chatwoot_conversations where tenant_id = pg_temp.t1() and conversation_id = 72) = pg_temp.k('02'),
    '4m un teléfono que ya no coincide con ninguna ficha no quita la que había');
  perform pg_temp.assert_true(
    (select chat_contact_id from public.chatwoot_conversations where tenant_id = pg_temp.t1() and conversation_id = 71) = 500
    and (select chat_contact_id from public.chatwoot_conversations where tenant_id = pg_temp.t1() and conversation_id = 72) = 501,
    '4n la conversación guarda de qué contacto es');
  -- De dónde salió el cliente: quien une solo (el webhook) lo hace únicamente con 'telefono'.
  og := pg_temp.evento_origen('message_created:3010', 71, null, 103, 500);
  perform pg_temp.assert_true(og = 'union', '4o un cliente que sale de la unión del contacto se dice «union»');
  og := pg_temp.evento_origen('message_created:3011', 72, '4125550202', 103, 501);
  perform pg_temp.assert_true(og = 'telefono', '4p un cliente que sale del teléfono con ficha única se dice «telefono»');
  og := pg_temp.evento_origen('message_created:3012', 72, null, 104, 501);
  perform pg_temp.assert_true(og = 'conservado', '4q un cliente que solo se conservó se dice «conservado», no «telefono»');
  og := pg_temp.evento_origen('message_created:3014', 72, '4125559999', 105, 501);
  perform pg_temp.assert_true(og = 'conservado', '4r un teléfono que ya no coincide conserva el cliente como «conservado»');
  og := pg_temp.evento_origen('message_created:3013', 76, null, 100, 502);
  perform pg_temp.assert_true(og is null, '4s sin cliente no hay origen');
  -- Los 13 parámetros de antes siguen sirviendo (el web anterior a esta PR).
  set local role service_role;
  select * into r from public.chatwoot_registrar_evento(
    pg_temp.t1(), 'message_created:3005', 'message_created', 73, 3, 'open', 0, null, '4125550202', null, 100, null, false);
  reset role;
  perform pg_temp.assert_true(r.nuevo and r.client_id = pg_temp.k('02'),
    '4k la llamada con los 13 parámetros de antes sigue funcionando');
  -- La unión es del tenant: el mismo contacto visto desde T2 no es de nadie.
  set local role service_role;
  ajena := public.chatwoot_ficha_de_contacto('10000000-0000-0000-0000-000000000002', 500);
  propia := public.chatwoot_ficha_de_contacto(pg_temp.t1(), 500);
  reset role;
  perform pg_temp.assert_true(ajena is null and propia = pg_temp.k('01'),
    '4l la ficha de un contacto no cruza de tenant');
end;
$reconocer$;

-- ─── 5. Chat unido a otra ficha: solo se mueve con confirmación ──────────────
do $mover$
declare
  v    jsonb;
  lead public.crm_tarjetas;
begin
  perform pg_temp.assert_true(pg_temp.vincular_falla(pg_temp.u('02'), pg_temp.k('02'), 500) = '23505',
    '5a un chat unido a otra ficha no se mueve sin p_mover');
  perform pg_temp.assert_true(
    (select client_id from public.chatwoot_contact_links where chatwoot_contact_id = 500) = pg_temp.k('01'),
    '5b el rechazo deja la unión donde estaba');

  v := pg_temp.vincular(pg_temp.u('02'), pg_temp.k('02'), 500, 'instagram', 'Era de la otra ficha', true);
  lead := pg_temp.del_contacto(500);
  perform pg_temp.assert_true(v ->> 'resultado' = 'movido'
    and (select client_id from public.chatwoot_contact_links where chatwoot_contact_id = 500) = pg_temp.k('02'),
    '5c con p_mover la unión pasa a la ficha nueva');
  perform pg_temp.assert_true(lead.absorbida_en = (pg_temp.de_la_ficha(pg_temp.k('02'))).id,
    '5d la tarjeta del lead queda absorbida en la del cliente nuevo');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log a
    where a.entity_id = pg_temp.k('01') and a.event_type = 'chatwoot_contact_unlinked'
      and a.actor_id = pg_temp.u('02') and a.reason = 'Era de la otra ficha'
      and (a.payload ->> 'movido_a')::uuid = pg_temp.k('02')),
    '5e mover deja la salida auditada en la ficha anterior');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log a
    where a.entity_id = pg_temp.k('02') and a.event_type = 'chatwoot_contact_linked'
      and (a.payload ->> 'movido_de')::uuid = pg_temp.k('01')),
    '5f y la entrada auditada en la ficha nueva');
  perform pg_temp.assert_true(
    (select count(*) from public.chatwoot_conversations
     where tenant_id = pg_temp.t1() and chat_contact_id = 500 and client_id = pg_temp.k('02')) = 2
    and not exists (select 1 from public.chatwoot_conversations
                    where tenant_id = pg_temp.t1() and chat_contact_id = 500 and client_id = pg_temp.k('01')),
    '5g al mover, las conversaciones de ese contacto pasan a la ficha nueva');
end;
$mover$;

-- ─── 6. Quitar la unión: la tarjeta del lead vuelve como estaba ──────────────
do $quitar$
declare
  r    record;
  ok   boolean;
  lead public.crm_tarjetas;
begin
  set local role service_role;
  ok := public.chatwoot_quitar_union(pg_temp.t1(), pg_temp.u('02'), pg_temp.k('02'), 500, 'Fue un error');
  reset role;
  lead := pg_temp.del_contacto(500);
  perform pg_temp.assert_true(ok and not exists (select 1 from public.chatwoot_contact_links where chatwoot_contact_id = 500),
    '6a quitar borra la unión');
  perform pg_temp.assert_true(lead.absorbida_en is null and lead.absorbida_at is null
    and lead.etapa_leads = 'nuevo' and lead.nombre_visible = 'Lead Instagram',
    '6b la tarjeta del lead vuelve a su tablero, en su etapa y con su nombre');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log a
    where a.entity_id = pg_temp.k('02') and a.event_type = 'chatwoot_contact_unlinked'
      and a.reason = 'Fue un error' and (a.payload ->> 'tarjeta_restaurada')::uuid = lead.id
      and a.before_data ->> 'canal' = 'instagram'),
    '6c quitar queda auditado con la tarjeta que restauró');
  perform pg_temp.assert_true(
    not exists (select 1 from public.chatwoot_conversations
                where tenant_id = pg_temp.t1() and chat_contact_id = 500 and client_id is not null)
    and (select client_id from public.chatwoot_conversations where tenant_id = pg_temp.t1() and conversation_id = 72) = pg_temp.k('02'),
    '6f quitar deja sin ficha las conversaciones de ese contacto, y no las de otro contacto de la misma ficha');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log a
    where a.tenant_id = pg_temp.t1() and a.entity_id = pg_temp.k('02') and a.event_type = 'chatwoot_contact_unlinked'
      and a.reason = 'Fue un error' and (a.payload ->> 'conversaciones_sin_ficha')::int = 2),
    '6g la auditoría de quitar dice cuántas conversaciones quedaron sin ficha');

  -- Sin unión, vuelve a ser un lead: su actividad cae en SU tarjeta.
  r := pg_temp.entrada(500, null, 'Lead Instagram', null, 'message_created:4000', now());
  perform pg_temp.assert_true(r.tarjeta_id = lead.id and not r.creada,
    '6d desvinculado, el contacto vuelve a su tarjeta de lead');
  perform pg_temp.assert_true(pg_temp.evento('message_created:4001', 74, null, 100, 500) is null,
    '6e desvinculado, el evento ya no devuelve ficha');
end;
$quitar$;

-- ─── 7. Cliente que ya tenía tarjeta: se conserva la suya ────────────────────
do $con_tarjeta$
declare
  v    jsonb;
  cli  public.crm_tarjetas;
  lead public.crm_tarjetas;
begin
  set local role service_role;
  perform public.crm_alta_tarjeta_web(pg_temp.t1(), pg_temp.k('03'), 'portal');
  reset role;
  -- El lead de Messenger trae asesor (agente 7 → comercial 02).
  perform pg_temp.entrada(700, null, 'Lead Messenger', 7, 'message_created:5000', now(), 'messenger');
  v := pg_temp.vincular(pg_temp.u('01'), pg_temp.k('03'), 700, 'messenger');
  cli := pg_temp.de_la_ficha(pg_temp.k('03'));
  lead := pg_temp.del_contacto(700);
  perform pg_temp.assert_true((v ->> 'tarjeta_absorbida')::boolean and cli.fuente = 'web_registro'
    and (select count(*) from public.crm_tarjetas where tenant_id = pg_temp.t1() and client_id = pg_temp.k('03')) = 1,
    '7a el cliente conserva su tarjeta y su fuente; no nace otra');
  perform pg_temp.assert_true(cli.asesor_id = pg_temp.u('02') and lead.absorbida_en = cli.id,
    '7b sin dueño propio, la tarjeta del cliente hereda el asesor del lead');
end;
$con_tarjeta$;

-- ─── 8. Ficha borrada: sin uniones y con la tarjeta del lead suelta ──────────
do $borrada$
declare
  lead  public.crm_tarjetas;
  ficha uuid;
begin
  perform pg_temp.entrada(800, null, 'Lead Ochocientos', null, 'message_created:6000', now());
  perform pg_temp.vincular(pg_temp.u('02'), pg_temp.k('04'), 800);
  perform pg_temp.assert_true((pg_temp.del_contacto(800)).absorbida_en is not null, '8a quedó absorbida');
  -- Dos conversaciones de esa ficha: una por su contacto unido y otra solo por teléfono.
  perform pg_temp.evento('message_created:6001', 80, null, 100, 800);
  perform pg_temp.evento('message_created:6002', 81, '4125550204', 100, 801);
  perform pg_temp.assert_true(
    (select count(*) from public.chatwoot_conversations
     where tenant_id = pg_temp.t1() and conversation_id in (80, 81) and client_id = pg_temp.k('04')) = 2,
    '8a2 las dos conversaciones son de la ficha antes de borrarla');
  update public.clients set deleted_at = now() where id = pg_temp.k('04');
  lead := pg_temp.del_contacto(800);
  perform pg_temp.assert_true(not exists (select 1 from public.chatwoot_contact_links where chatwoot_contact_id = 800)
    and lead.absorbida_en is null,
    '8b borrar la ficha quita la unión y suelta la tarjeta del lead');
  set local role service_role;
  ficha := public.chatwoot_ficha_de_contacto(pg_temp.t1(), 800);
  reset role;
  perform pg_temp.assert_true(ficha is null, '8c un contacto de una ficha borrada no es de nadie');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log a
    where a.tenant_id = pg_temp.t1() and a.entity_type = 'chatwoot_contact_link' and a.entity_id = pg_temp.k('04')
      and a.event_type = 'chatwoot_contact_unlinked'
      and a.before_data ->> 'motivo' = 'ficha_borrada'
      and a.before_data -> 'tarjetas_soltadas' = pg_catalog.jsonb_build_array(lead.id)),
    '8d la auditoría del borrado de la ficha nombra la tarjeta que se soltó');
  perform pg_temp.assert_true(
    not exists (select 1 from public.chatwoot_conversations
                where tenant_id = pg_temp.t1() and client_id = pg_temp.k('04')),
    '8e borrar la ficha deja sin ficha todas sus conversaciones, las unidas y las de teléfono');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log a
    where a.tenant_id = pg_temp.t1() and a.entity_id = pg_temp.k('04') and a.event_type = 'chatwoot_contact_unlinked'
      and a.before_data ->> 'motivo' = 'ficha_borrada'
      and (a.before_data ->> 'conversaciones_sin_ficha')::int = 2),
    '8f y la auditoría dice cuántas');
  -- Ni un evento posterior con el mismo teléfono se la devuelve: la ficha está borrada.
  perform pg_temp.assert_true(pg_temp.evento('message_created:6003', 81, '4125550204', 101, 801) is null,
    '8g un evento posterior no revive la ficha borrada');
  -- Una conversación que quedó apuntando a una ficha borrada (por otra vía, o por una carrera
  -- con el borrado) no la conserva: el evento la revalida.
  update public.chatwoot_conversations set client_id = pg_temp.k('06')
  where tenant_id = pg_temp.t1() and conversation_id = 81;
  perform pg_temp.assert_true(pg_temp.evento('message_created:6004', 81, null, 102, 801) is null
    , '8h el evento no devuelve una ficha borrada');
  perform pg_temp.assert_true(
    (select client_id from public.chatwoot_conversations where tenant_id = pg_temp.t1() and conversation_id = 81) is null,
    '8i una ficha borrada no se conserva en la conversación');
end;
$borrada$;

-- ─── 9. Ninguna sesión llama estas funciones ─────────────────────────────────
do $sesiones$
declare
  v_estado text;
begin
  begin
    perform set_config('request.jwt.claim.sub', pg_temp.u('01')::text, true);
    set local role authenticated;
    perform public.chatwoot_vincular_contacto(pg_temp.t1(), pg_temp.u('01'), pg_temp.k('01'), 901, 'instagram', 'Directo por la API', false);
    v_estado := null;
  exception when others then
    v_estado := sqlstate;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.assert_true(v_estado = '42501', '9a un admin con sesión no llama vincular directo por la API');
end;
$sesiones$;

-- ─── 10. Unión que ya existía con la tarjeta del lead suelta ─────────────────
-- El caso de una unión del webhook o de Kommo (0554): el contacto ya es de la ficha,
-- pero su tarjeta de lead sigue en el tablero. Vincular responde «ya_estaba», la
-- absorbe y lo deja auditado con el actor y el motivo.
do $pendiente$
declare
  v    jsonb;
  lead public.crm_tarjetas;
begin
  perform pg_temp.entrada(950, null, 'Lead Pendiente', null, 'message_created:7000', now());
  insert into public.chatwoot_contact_links (tenant_id, client_id, chatwoot_contact_id, origen, created_by)
  values (pg_temp.t1(), pg_temp.k('02'), 950, 'webhook', null);

  v := pg_temp.vincular(pg_temp.u('02'), pg_temp.k('02'), 950);
  lead := pg_temp.del_contacto(950);
  perform pg_temp.assert_true(v ->> 'resultado' = 'ya_estaba' and (v ->> 'tarjeta_absorbida')::boolean
    and lead.absorbida_en is not null,
    '10a una unión que ya existía absorbe la tarjeta del lead que seguía suelta');
  perform pg_temp.assert_true((
    select count(*) from public.entity_audit_log a
    where a.tenant_id = pg_temp.t1() and a.entity_type = 'chatwoot_contact_link' and a.entity_id = pg_temp.k('02')
      and a.event_type = 'chatwoot_contact_linked' and a.actor_id = pg_temp.u('02')
      and (a.after_data ->> 'chatwoot_contact_id')::bigint = 950
      and (a.after_data ->> 'tarjeta_absorbida')::uuid = lead.id
      and a.after_data ->> 'origen' = 'webhook'
      and a.reason = 'Vinculado desde la conversación 9') = 1,
    '10b esa absorción queda auditada con el actor, el motivo y la tarjeta');
  perform pg_temp.assert_true((
    select origen from public.chatwoot_contact_links where tenant_id = pg_temp.t1() and chatwoot_contact_id = 950) = 'webhook',
    '10c la unión conserva su origen');

  v := pg_temp.vincular(pg_temp.u('02'), pg_temp.k('02'), 950);
  perform pg_temp.assert_true(v ->> 'resultado' = 'ya_estaba' and not (v ->> 'tarjeta_absorbida')::boolean
    and (select count(*) from public.entity_audit_log a
         where a.tenant_id = pg_temp.t1() and a.event_type = 'chatwoot_contact_linked'
           and (a.after_data ->> 'chatwoot_contact_id')::bigint = 950) = 1,
    '10d repetirlo no absorbe ni audita otra vez');
end;
$pendiente$;

-- ─── 11. El chat del portal: una sola fuente de vínculos ────────────────────
do $portal$
declare
  hilo   constant uuid := '50000000-0000-0000-0000-000000000001';
  ficha  constant uuid := '30000000-0000-0000-0000-000000000007';
  v_est  text;
  ev     uuid;
begin
  insert into public.clients (id, tenant_id, markbox, phone, advisor_id, deleted_at)
  values (ficha, pg_temp.t1(), 'DTD-1007', '+584125550207', null, null);
  insert into public.conversations (id, tenant_id, client_id, channel) values (hilo, pg_temp.t1(), ficha, 'portal');
  insert into public.chatwoot_portal_contactos (tenant_id, client_id) values (pg_temp.t1(), ficha);

  set local role service_role;
  perform public.chatwoot_portal_vincular(pg_temp.t1(), hilo, 620, 'src-portal-620', 4, 95);
  -- Repetirlo (un reintento del envío) no duplica nada.
  perform public.chatwoot_portal_vincular(pg_temp.t1(), hilo, 620, 'src-portal-620', 4, 95);
  reset role;

  perform pg_temp.assert_true(exists (
    select 1 from public.chatwoot_contact_links l
    where l.tenant_id = pg_temp.t1() and l.chatwoot_contact_id = 620 and l.client_id = ficha
      and l.origen = 'portal' and l.canal_chat = 'portal' and l.created_by is null),
    '11a chatwoot_portal_vincular deja la unión del contacto en chatwoot_contact_links');
  perform pg_temp.assert_true((
    select count(*) from public.entity_audit_log a
    where a.tenant_id = pg_temp.t1() and a.entity_type = 'chatwoot_contact_link' and a.entity_id = ficha
      and a.event_type = 'chatwoot_contact_linked' and a.actor_type = 'system' and a.actor_id is null
      and a.after_data ->> 'origen' = 'portal' and (a.after_data ->> 'chatwoot_contact_id')::bigint = 620) = 1,
    '11b la unión del portal queda auditada una sola vez, como del sistema');
  perform pg_temp.assert_true(exists (
    select 1 from public.chatwoot_conversations cc
    where cc.tenant_id = pg_temp.t1() and cc.conversation_id = 95 and cc.client_id = ficha and cc.chat_contact_id = 620),
    '11c la conversación del portal queda con su cliente y su contacto');

  -- El caso que rompía: una conversación del portal de ANTES de la 0566 (su cliente fijado
  -- por la 0519, sin unión todavía) recibe un evento con contacto, sin unión y sin teléfono.
  insert into public.chatwoot_conversations (tenant_id, conversation_id, inbox_id, status, client_id)
  values (pg_temp.t1(), 96, 4, 'open', ficha);
  ev := pg_temp.evento('message_created:8000', 96, null, 100, 621);
  perform pg_temp.assert_true(ev = ficha
    and (select client_id from public.chatwoot_conversations where tenant_id = pg_temp.t1() and conversation_id = 96) = ficha,
    '11d una conversación del portal sin unión conserva su cliente tras un evento sin teléfono');
  -- Y con la unión, el evento del contacto del portal devuelve su ficha.
  perform pg_temp.assert_true(pg_temp.evento('message_created:8001', 95, null, 100, 620) = ficha,
    '11e el evento del contacto del portal devuelve su ficha por la unión');

  -- La unión del portal no se quita ni se mueve a mano.
  begin
    set local role service_role;
    perform public.chatwoot_quitar_union(pg_temp.t1(), pg_temp.u('02'), ficha, 620, 'Intento de quitar');
    v_est := null;
  exception when others then
    v_est := sqlstate;
  end;
  reset role;
  perform pg_temp.assert_true(v_est = '55000'
    and exists (select 1 from public.chatwoot_contact_links where chatwoot_contact_id = 620),
    '11f la unión del portal no se quita a mano');
  perform pg_temp.assert_true(
    pg_temp.vincular_falla(pg_temp.u('02'), pg_temp.k('02'), 620, 'otro', 'Intento de mover', true) = '55000'
    and pg_temp.vincular_falla(pg_temp.u('02'), pg_temp.k('02'), 620) = '55000'
    and (select client_id from public.chatwoot_contact_links where chatwoot_contact_id = 620) = ficha,
    '11g la unión del portal no se mueve a otra ficha, ni con p_mover');

  -- La ficha se borra: sus dos conversaciones del portal quedan sin cliente y la unión se va.
  update public.clients set deleted_at = now() where id = ficha;
  perform pg_temp.assert_true(
    not exists (select 1 from public.chatwoot_conversations where tenant_id = pg_temp.t1() and client_id = ficha)
    and not exists (select 1 from public.chatwoot_contact_links where chatwoot_contact_id = 620),
    '11h al borrar la ficha, sus conversaciones del portal quedan sin cliente y la unión se va');
end;
$portal$;

select 'TEST 0566 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
