\set ON_ERROR_STOP on

-- SDD-0622 · contrato de la 0530 (Comercial en la base acepta los accesos por persona).
--
-- Monta lo mínimo que 0505, 0506, 0357, 0529 y 0530 dan por sentado, con la forma
-- de las migraciones reales (ver el contrato de la 0506 y el de la 0529), y copia
-- LITERAL de la 0444 para document_entity_module_contract y
-- document_entity_authorized (su cadena 0438–0444 tiene contrato propio). Aplica
-- la 0505, 0506, 0357, 0529 y 0530 REALES.
--
-- Caso de aceptación obligatorio (SDD-0622 §7.1): alguien de contabilidad con el
-- extra «CRM editar» ve y edita el CRM de punta a punta; sin el extra, no.
--
-- CONTROL ROJO: sin 0530 cae en «3b: con extra de edición ve las tarjetas».
-- Termina siempre en ROLLBACK. Solo ids, códigos y teléfonos sintéticos (555).
begin;

do $roles$
begin
  if to_regclass('public.crm_tarjetas') is not null then
    raise exception 'Fixture 0530 rechazada: el objeto real ya existe';
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
  disabled_at timestamptz,
  warehouse_scope text not null default 'all'
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
  select role from public.user_tenants
  where user_id = (select auth.uid()) and disabled_at is null limit 1
$$;
grant execute on function public.current_studio_role() to authenticated;

create table public.platform_admins (user_id uuid primary key);
create function public.is_platform_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;
grant execute on function public.is_platform_admin() to authenticated;

create table public.audit_entity_types (
  entity_type text primary key, status text not null, domain_code text,
  contract_version integer, introduced_by_ref text
);
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, entity_type text not null references public.audit_entity_types(entity_type),
  entity_id uuid not null, actor_type text not null, actor_id uuid, event_type text not null,
  reason text, payload jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now()
);
-- Doble de append_audit_event (firma de 0294); el writer real tiene su contrato.
create function public.append_audit_event(
  p_tenant_id uuid, p_entity_type text, p_entity_id uuid, p_actor_type text, p_actor_id uuid,
  p_event_type text, p_source text, p_result text default 'succeeded', p_reason text default null,
  p_before_data jsonb default null, p_after_data jsonb default null, p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null, p_schema_version integer default 1, p_sensitivity text default 'internal'
) returns uuid language plpgsql security definer set search_path = '' as $fn$
declare v_id uuid;
begin
  insert into public.entity_audit_log (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, reason, payload)
  values (p_tenant_id, p_entity_type, p_entity_id, p_actor_type, p_actor_id, p_event_type, p_reason, p_payload)
  returning id into v_id;
  return v_id;
end;
$fn$;
revoke all on function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text) from public, anon, authenticated;

-- Forma de 0383 + 0341, 0367, 0002 y 0008 (lo que leen 0505/0506).
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
create table public.client_markbox_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  client_id uuid not null references public.clients(id),
  markbox text not null
);
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
create type public.warehouse_receipt_status as enum ('pendiente_consolidacion', 'consolidado', 'incidencia');
create table public.warehouse_receipts_cn (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  client_markbox text,
  is_orphan boolean not null default false,
  status public.warehouse_receipt_status not null default 'pendiente_consolidacion',
  deleted_at timestamptz
);

-- La 0444 lee los desvíos por rol: la 0357 va antes.
\ir ../migrations/0357_role_module_overrides.sql

-- ── Copia literal de la 0444 (contrato documental vigente) ───────────────
create or replace function public.document_entity_module_contract(p_entity_type text)
returns table(module_id text, default_roles text[])
language sql
immutable
security invoker
set search_path = ''
as $$
  select v.module_id, v.default_roles
  from (values
    ('expense', 'expenses', array['accounting', 'operations', 'warehouse']::text[]),
    ('shipment', 'tracking', array['commercial', 'operations', 'accounting', 'warehouse', 'support']::text[]),
    ('client', 'clients', array['commercial', 'operations', 'accounting', 'support']::text[]),
    ('supplier', 'suppliers', array['commercial', 'operations']::text[]),
    ('consolidation', 'naviera', array['operations', 'accounting']::text[]),
    ('booking', 'naviera', array['operations', 'accounting']::text[]),
    ('bitacora_task', 'bitacora', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[]),
    ('none', 'documents', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[]),
    ('', 'documents', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[])
  ) as v(entity_type, module_id, default_roles)
  where v.entity_type = pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_entity_type, ''))
  )
$$;

comment on function public.document_entity_module_contract(text) is
  'SDD-0412: mapa interno completo entidad documental → módulo/defaults; vacío conserva paths legados como Documentos. Sin EXECUTE para roles de API.';

revoke all on function public.document_entity_module_contract(text)
  from public, anon, authenticated, service_role;

create or replace function public.document_entity_authorized(
  p_entity_type text,
  p_tenant_id uuid,
  p_access text
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with normalized as (
    select
      pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) as entity_type,
      pg_catalog.lower(pg_catalog.btrim(coalesce(p_access, ''))) as access
  ), membership as (
    select pg_catalog.lower(pg_catalog.btrim(ut.role)) as role
    from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = p_tenant_id
      and ut.disabled_at is null
    limit 1
  ), decision as (
    select
      n.entity_type,
      n.access,
      m.role,
      c.module_id,
      c.default_roles,
      o.can_view,
      o.can_edit
    from normalized n
    cross join membership m
    left join lateral public.document_entity_module_contract(n.entity_type) c
      on true
    left join public.studio_role_module_overrides o
      on o.tenant_id = p_tenant_id
     and pg_catalog.lower(pg_catalog.btrim(o.role)) = m.role
     and o.module_id = c.module_id
  )
  select coalesce((
    select case
      when d.access not in ('view', 'edit') then false
      when d.entity_type in (
        'invoice',
        'supplier_bill',
        'supplier_payment',
        'journal_entry'
      ) then d.role in ('accounting', 'admin')
      when d.module_id is not null and d.role = 'admin' then true
      when d.module_id is not null and d.access = 'view' then
        coalesce(d.can_view, d.role = any(d.default_roles))
      when d.module_id is not null and d.access = 'edit' then
        d.role <> 'support'
        and coalesce(d.can_edit, d.role = any(d.default_roles))
      else false
    end
    from decision d
  ), false)
$$;
comment on function public.document_entity_module_contract(text) is
  'SDD-0412: mapa interno completo entidad documental → módulo/defaults; vacío conserva paths legados como Documentos. Sin EXECUTE para roles de API.';
revoke all on function public.document_entity_module_contract(text) from public, anon, authenticated, service_role;
comment on function public.document_entity_authorized(text,uuid,text) is
  'SDD-0412: autorización documental tenant-aware completa para los 12 tipos; none/vacío heredan Documents y cualquier tipo desconocido falla cerrado.';
revoke all on function public.document_entity_authorized(text,uuid,text) from public, anon;
grant execute on function public.document_entity_authorized(text,uuid,text) to authenticated, service_role;

-- ── Fixture ─────────────────────────────────────────────────────────────
-- 01 admin · 02 comercial · 03 contabilidad (Alejandro) · 04 contabilidad
-- 05 support · 06 almacén. Todos en T1.
insert into public.tenants values ('10000000-0000-0000-0000-000000000001', 'dtd');
insert into auth.users values
  ('20000000-0000-0000-0000-000000000001'), ('20000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000003'), ('20000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000005'), ('20000000-0000-0000-0000-000000000006');
insert into public.user_tenants (user_id, tenant_id, role) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'commercial'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'accounting'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'accounting'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'support'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'warehouse');
insert into public.clients (id, tenant_id, markbox, phone) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'DTD-2001', '+584125550401');

\ir ../migrations/0505_chatwoot_segmento.sql
\ir ../migrations/0506_crm_modelo.sql
\ir ../migrations/0529_studio_user_module_grants.sql

insert into public.crm_tarjetas (id, tenant_id, client_id, fuente) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'whatsapp_clientes');

\ir ../migrations/0530_comercial_acepta_accesos_por_persona.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0530: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

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

create function pg_temp.u(p_n text) returns uuid language sql immutable as $$
  select ('20000000-0000-0000-0000-0000000000' || p_n)::uuid;
$$;

create function pg_temp.tarjetas(p_n text) returns int language sql as $$
  select pg_temp.valor(pg_temp.u(p_n), 'select count(*) from public.crm_tarjetas')::int;
$$;

-- Escrituras del CRM que hace la pantalla, como el usuario p_n.
create function pg_temp.alta_lead(p_n text, p_tel text) returns void language sql as $$
  select pg_temp.como(pg_temp.u(p_n), format(
    $q$insert into public.crm_tarjetas (tenant_id, nombre_visible, phone_last10, fuente)
       values ('10000000-0000-0000-0000-000000000001', 'Lead Prueba', %L, 'manual')$q$, p_tel));
$$;

-- ── 1. Sin cambios para admin y comercial ────────────────────────────────
select pg_temp.assert_true(pg_temp.tarjetas('01') = 1, '1a: admin sigue viendo el CRM');
select pg_temp.assert_true(pg_temp.tarjetas('02') = 1, '1b: comercial sigue viendo el CRM');
select pg_temp.alta_lead('02', '4125550501');
select pg_temp.assert_true(pg_temp.tarjetas('02') = 2, '1c: comercial sigue creando tarjetas');

-- ── 2. Sin extra, contabilidad no entra ──────────────────────────────────
select pg_temp.assert_true(pg_temp.tarjetas('03') = 0, '2a: sin extra, contabilidad no ve tarjetas');
select pg_temp.falla(pg_temp.u('03'),
  $q$insert into public.crm_tarjetas (tenant_id, nombre_visible, phone_last10, fuente)
     values ('10000000-0000-0000-0000-000000000001', 'Lead Prueba', '4125550502', 'manual')$q$,
  'row-level security', '2b: sin extra, contabilidad no crea tarjetas');
select pg_temp.falla(pg_temp.u('03'),
  $q$select public.crm_mover_etapa('40000000-0000-0000-0000-000000000001', 'clientes', 'postventa')$q$,
  'sin acceso al CRM', '2c: sin extra, contabilidad no mueve etapas');

-- ── 3. Caso Alejandro: CRM editar de punta a punta ───────────────────────
select pg_temp.como(pg_temp.u('01'),
  format($q$select public.studio_grant_user_module(%L, 'kommo', true, true, 'Atiende el CRM con comercial')$q$, pg_temp.u('03')));
select pg_temp.assert_true(pg_temp.valor(pg_temp.u('03'), 'public.crm_puede_usar()')::boolean, '3a: crm_puede_usar con extra');
select pg_temp.assert_true(pg_temp.tarjetas('03') = 2, '3b: con extra de edición ve las tarjetas');
select pg_temp.alta_lead('03', '4125550503');
select pg_temp.assert_true(pg_temp.tarjetas('03') = 3, '3c: crea una tarjeta');
select pg_temp.como(pg_temp.u('03'),
  $q$update public.crm_tarjetas set asesor_id = '20000000-0000-0000-0000-000000000003'
     where phone_last10 = '4125550503'$q$);
select pg_temp.assert_true((select asesor_id = pg_temp.u('03') from public.crm_tarjetas where phone_last10 = '4125550503'),
  '3d: se asigna como asesor');
select pg_temp.assert_true(pg_temp.valor(pg_temp.u('03'),
  $q$public.crm_mover_etapa('40000000-0000-0000-0000-000000000001', 'clientes', 'postventa')$q$)::boolean,
  '3e: mueve una etapa');
select pg_temp.como(pg_temp.u('03'),
  $q$insert into public.crm_tareas (tenant_id, tarjeta_id, texto, created_by)
     values ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Llamar', '20000000-0000-0000-0000-000000000003')$q$);
select pg_temp.como(pg_temp.u('03'),
  $q$update public.crm_tareas set completada_at = now() where texto = 'Llamar'$q$);
select pg_temp.como(pg_temp.u('03'),
  $q$insert into public.crm_notas (tenant_id, tarjeta_id, texto, autor_id)
     values ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Nota de prueba', '20000000-0000-0000-0000-000000000003')$q$);
select pg_temp.assert_true(pg_temp.valor(pg_temp.u('03'),
  'select count(*) from public.crm_tareas where completada_at is not null')::int = 1, '3f: crea y completa una tarea');
select pg_temp.assert_true(pg_temp.valor(pg_temp.u('03'), 'select count(*) from public.crm_notas')::int = 1, '3g: deja una nota');
select pg_temp.assert_true(pg_temp.valor(pg_temp.u('03'), 'select count(*) from public.crm_historial_etapas')::int >= 1,
  '3h: ve el historial');
select pg_temp.assert_true(pg_temp.valor(pg_temp.u('03'),
  $q$select count(*) from public.crm_segmento_tarjetas(array['40000000-0000-0000-0000-000000000001']::uuid[])$q$)::int = 1,
  '3i: el tablero calcula el segmento');
select pg_temp.assert_true(pg_temp.tarjetas('04') = 0, '3j: la otra persona de contabilidad sigue sin CRM');

-- ── 4. Solo ver: lee pero no cambia ──────────────────────────────────────
select pg_temp.como(pg_temp.u('01'),
  format($q$select public.studio_grant_user_module(%L, 'kommo', true, false, 'Solo consulta el CRM')$q$, pg_temp.u('04')));
select pg_temp.assert_true(pg_temp.tarjetas('04') = 3, '4a: con solo ver lee las tarjetas');
select pg_temp.falla(pg_temp.u('04'),
  $q$insert into public.crm_tarjetas (tenant_id, nombre_visible, phone_last10, fuente)
     values ('10000000-0000-0000-0000-000000000001', 'Lead Prueba', '4125550504', 'manual')$q$,
  'row-level security', '4b: con solo ver no crea tarjetas');
select pg_temp.falla(pg_temp.u('04'),
  $q$select public.crm_mover_etapa('40000000-0000-0000-0000-000000000001', 'clientes', 'activo')$q$,
  'sin acceso al CRM', '4c: con solo ver no mueve etapas');
select pg_temp.falla(pg_temp.u('04'),
  $q$insert into public.crm_notas (tenant_id, tarjeta_id, texto, autor_id)
     values ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'No', '20000000-0000-0000-0000-000000000004')$q$,
  'row-level security', '4d: con solo ver no deja notas');

-- ── 5. support con extra de edición sigue sin editar ─────────────────────
select pg_temp.como(pg_temp.u('01'),
  format($q$select public.studio_grant_user_module(%L, 'kommo', true, true, 'Mira el CRM')$q$, pg_temp.u('05')));
select pg_temp.assert_true(pg_temp.tarjetas('05') = 3, '5a: support ve con el extra');
select pg_temp.falla(pg_temp.u('05'),
  $q$insert into public.crm_tarjetas (tenant_id, nombre_visible, phone_last10, fuente)
     values ('10000000-0000-0000-0000-000000000001', 'Lead Prueba', '4125550505', 'manual')$q$,
  'row-level security', '5b: support no edita aunque el extra diga editar');

-- ── 6. Clientes y documentos ─────────────────────────────────────────────
select pg_temp.assert_true(not pg_temp.valor(pg_temp.u('06'),
  $q$public.document_entity_authorized('client', '10000000-0000-0000-0000-000000000001', 'view')$q$)::boolean,
  '6a: almacén no ve clientes por rol');
select pg_temp.como(pg_temp.u('01'),
  format($q$select public.studio_grant_user_module(%L, 'clients', true, true, 'Atiende clientes en almacén')$q$, pg_temp.u('06')));
select pg_temp.assert_true(pg_temp.valor(pg_temp.u('06'),
  $q$public.document_entity_authorized('client', '10000000-0000-0000-0000-000000000001', 'edit')$q$)::boolean,
  '6b: con extra de Clientes edita clientes');
select pg_temp.assert_true(not pg_temp.valor(pg_temp.u('06'),
  $q$public.document_entity_authorized('supplier', '10000000-0000-0000-0000-000000000001', 'view')$q$)::boolean,
  '6c: el extra de Clientes no abre Proveedores');
select pg_temp.assert_true(not pg_temp.valor(pg_temp.u('06'),
  $q$public.document_entity_authorized('invoice', '10000000-0000-0000-0000-000000000001', 'view')$q$)::boolean,
  '6d: las entidades de dinero siguen por rol');
select pg_temp.como(pg_temp.u('01'),
  format($q$select public.studio_grant_user_module(%L, 'suppliers', true, false, 'Consulta proveedores')$q$, pg_temp.u('03')));
select pg_temp.assert_true(pg_temp.valor(pg_temp.u('03'),
  $q$public.document_entity_authorized('supplier', '10000000-0000-0000-0000-000000000001', 'view')$q$)::boolean
  and not pg_temp.valor(pg_temp.u('03'),
  $q$public.document_entity_authorized('supplier', '10000000-0000-0000-0000-000000000001', 'edit')$q$)::boolean,
  '6e: un extra de solo ver no da edición de documentos');
select pg_temp.assert_true(pg_temp.valor(pg_temp.u('03'),
  $q$public.document_entity_authorized('invoice', '10000000-0000-0000-0000-000000000001', 'view')$q$)::boolean,
  '6f: contabilidad sigue con dinero por rol');

-- ── 7. Vencido o quitado, la base cierra sola ────────────────────────────
update public.studio_user_module_grants set expires_at = now() - interval '1 minute'
where user_id = pg_temp.u('06') and module_id = 'clients';
select pg_temp.assert_true(not pg_temp.valor(pg_temp.u('06'),
  $q$public.document_entity_authorized('client', '10000000-0000-0000-0000-000000000001', 'view')$q$)::boolean,
  '7a: vencido, ya no ve clientes');
select pg_temp.como(pg_temp.u('01'),
  format($q$select public.studio_revoke_user_module_grant(%L, 'kommo', 'Vuelve solo a contabilidad')$q$, pg_temp.u('03')));
select pg_temp.assert_true(pg_temp.tarjetas('03') = 0, '7b: quitado el extra, contabilidad deja de ver el CRM');

-- ── 8. Desvío por rol sobre el CRM: pantalla y base deciden igual ───────
insert into public.studio_role_module_overrides (tenant_id, role, module_id, can_view, can_edit)
values ('10000000-0000-0000-0000-000000000001', 'warehouse', 'kommo', true, false);
select pg_temp.assert_true(pg_temp.tarjetas('06') = 3, '8a: el desvío por rol sobre kommo ahora abre la lectura en la base');
select pg_temp.assert_true(not pg_temp.valor(pg_temp.u('06'), 'public.crm_puede_editar()')::boolean,
  '8b: y no la edición');

select 'TEST 0530: ' || nextval('pg_temp.assertion_count') - 1 || ' aserciones OK' as resultado;

rollback;
