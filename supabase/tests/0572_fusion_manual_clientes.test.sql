\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0572 (SDD-0712). Fixtures ficticios y rollback:
-- no toca prod. Corre en `verify` (Docker) y, con el MISMO texto, en PGlite desde
-- lib/studio/__tests__/fusion-manual-clientes.pglite.test.ts.
--
-- El andamiaje (tablas e índices únicos reales de la fusión) sale del contrato de
-- la 0358 y se carga la cadena REAL de `merge_clients` (0341 → 0351 → 0358 →
-- 0361). La auditoría es un doble: `append_audit_event` guarda lo que recibe, y un
-- trigger de prueba anota el motivo (`dtd.audit_reason`) que ve la fusión, que es
-- lo que lee el trigger real de la 0455.
--
-- Lo que defiende (cada punto es una aserción nombrada):
--   1. la búsqueda encuentra por Shipping Mark (vigente y anterior), nombre
--      parcial sin acentos ni mayúsculas, teléfono y correo, y NO a otro tenant,
--      aliados, borrados ni fusionados; los comodines del usuario son texto;
--   2. la vista previa trae conteos y avisos y ningún monto;
--   3. merge_clients_manual rechaza: Shipping Mark mal tecleado, motivo corto,
--      misma ficha, otro tenant, aliado, rol sin permiso; y no deja nada a medias;
--   4. al fusionar deja el motivo humano en la auditoría y restaura el ajuste;
--   5. anon no puede ejecutar ninguna de las tres.

-- RED: `-v apply_fix=false` no aplica la 0572 y la primera aserción falla.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema auth;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select ut.tenant_id from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null limit 1;
$$;

create function public.assert_tenant_match(p_tenant_id uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_t uuid := public.get_user_tenant_id();
begin
  if v_t is null then
    raise exception 'Authenticated tenant required' using errcode = '42501';
  end if;
  if v_t <> p_tenant_id then
    raise exception 'Tenant mismatch' using errcode = '42501';
  end if;
end;
$$;

create table public.clients (
  id uuid primary key,
  tenant_id uuid not null,
  markbox text,
  name text not null,
  email text, phone text, address text, address_reference text, rif text,
  tier text not null default 'regular',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  lat numeric, lng numeric,
  facade_photo_url text,
  portal_approved_at timestamptz,
  cedula_photo_path text,
  registration_channel text not null default 'studio',
  doc_kind text,
  doc_verify_status text, doc_verify_source text, doc_registry_name text,
  doc_verified_at timestamptz, doc_verified_by uuid,
  kommo_lead_id bigint,
  kommo_contact_id bigint,
  email_marketing_optin_at timestamptz, email_optin_source text,
  whatsapp_marketing_optin_at timestamptz,
  advisor_id uuid, person_id uuid, contact_name text, avatar_path text,
  aliado_id uuid
);
create unique index clients_tenant_id_markbox_key on public.clients (tenant_id, markbox);
create unique index clients_tenant_doc_unique on public.clients
  (tenant_id, upper(regexp_replace(rif, '[^A-Za-z0-9]', '', 'g')))
  where rif is not null and btrim(rif) <> '' and deleted_at is null;

create table public.aliados (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id), deleted_at timestamptz
);

create table public.client_markbox_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid not null references public.clients(id),
  markbox text not null, reason text,
  retired_at timestamptz not null default now(), retired_by uuid
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_markbox text, deleted_at timestamptz
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_markbox text not null, deleted_at timestamptz
);

create table public.client_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid not null references public.clients(id),
  email text, auth_user_id uuid, status text not null default 'active',
  token text, bound_at timestamptz
);
create unique index client_users_tenant_id_client_id_key
  on public.client_users (tenant_id, client_id);

create table public.client_delivery_addresses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid not null references public.clients(id),
  label text, is_default boolean not null default false, deleted_at timestamptz
);
create unique index client_delivery_addresses_default_uidx
  on public.client_delivery_addresses (client_id) where is_default and deleted_at is null;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid references public.clients(id),
  channel text not null, deleted_at timestamptz
);
create unique index conversations_client_channel_live_idx
  on public.conversations (tenant_id, client_id, channel) where deleted_at is null;

create table public.conversation_monthly_digests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid references public.clients(id)
);
create table public.client_notification_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid references public.clients(id),
  trigger_event text not null
);
create unique index client_notif_rules_override_uniq
  on public.client_notification_rules (tenant_id, client_id, trigger_event)
  where client_id is not null;

create table public.client_change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid references public.clients(id),
  status text not null default 'pending'
);
create unique index client_change_requests_one_open
  on public.client_change_requests (client_id) where status = 'pending';

create table public.client_claims (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid references public.clients(id)
);
create table public.bitacora_meetings (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id));
create table public.bitacora_tasks (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id));
create table public.currency_conversions (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id));
create table public.inspection_reports (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id));
create table public.supplier_claim_offsets (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id));
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_client_id uuid references public.clients(id),
  referred_client_id uuid references public.clients(id));
create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id));

grant select, insert, update, delete on public.clients to authenticated;

create function public.current_studio_role() returns text
language sql stable security definer set search_path = public as $$
  select ut.role from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null limit 1;
$$;

-- phone_match_key: cuerpo de la migr 0342 (la migración trae además otras piezas).
create function public.phone_match_key(p_phone text)
returns text language sql immutable set search_path = public as $$
  with d as (select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as dig)
  select case
    when length(d.dig) >= 7
     and right(d.dig, 7) !~ '^(.)\1{6}$'
     and right(d.dig, 7) not in ('1234567', '0123456', '7654321', '9876543')
    then right(d.dig, 7)
  end from d;
$$;

-- Doble de la auditoría: guarda lo que recibe y el motivo humano vigente.
create table public.audit_entity_types (entity_type text primary key, status text not null);
insert into public.audit_entity_types values ('client', 'active');
create table public.audit_calls (
  entity_type text, entity_id uuid, event text, reason text, reason_setting text,
  before_state jsonb, after_state jsonb, meta jsonb
);
create function public.append_audit_event(
  p_tenant uuid, p_entity_type text, p_entity_id uuid, p_actor_kind text, p_actor uuid,
  p_event text, p_source text, p_outcome text, p_reason text,
  p_before jsonb, p_after jsonb, p_meta jsonb, p_key text, p_version integer, p_visibility text
) returns void language plpgsql as $$
begin
  insert into public.audit_calls
  values (p_entity_type, p_entity_id, p_event, p_reason,
          current_setting('dtd.audit_reason', true), p_before, p_after, p_meta);
end;
$$;

-- Sonda: lo que ve la fusión en `dtd.audit_reason` cuando retira la ficha (es lo
-- que lee el trigger real de la 0455).
create table public.probe_audit_reason (visto text);
create function public.probe_retiro() returns trigger language plpgsql as $$
begin
  insert into public.probe_audit_reason values (current_setting('dtd.audit_reason', true));
  return new;
end;
$$;

\ir ../migrations/0341_client_merge_duplicados.sql
\ir ../migrations/0351_operario_rpc_exige_rol.sql
\ir ../migrations/0358_merge_clients_exige_rol.sql
\ir ../migrations/0361_merge_clients_conserva_kommo_contact.sql

-- La columna merged_into_client_id la crea la 0341: la sonda va después.
create trigger probe_retiro_t after update of merged_into_client_id on public.clients
  for each row when (new.merged_into_client_id is not null)
  execute function public.probe_retiro();

-- La migración bajo prueba. En el contrato de 0551 esto se puede apagar para ver
-- el rojo; acá el rojo es no tener las funciones.
\if :apply_fix
\ir ../migrations/0572_fusion_manual_clientes.sql
\endif

-- ── Ayudas ───────────────────────────────────────────────────
create temp sequence aserciones;
create function pg_temp.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'TEST 0572: %', p_msg; end if;
  perform nextval('pg_temp.aserciones');
end;
$$;
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_uid::text, true);
$$;
-- Ejecuta una sentencia y devuelve 'ok' o 'SQLSTATE: mensaje'.
create function pg_temp.falla(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return sqlstate || ': ' || sqlerrm;
end;
$$;

-- ── Fixture ──────────────────────────────────────────────────
insert into public.tenants (id) values
  ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
insert into public.user_tenants (user_id, tenant_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('aaaaaaaa-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'marketing'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'admin');

insert into public.clients (id, tenant_id, markbox, name, email, phone, rif, aliado_id, deleted_at) values
  -- El caso de Sam: DTD-8221 (migración legacy, sin datos) y DTD-9001 (el nuevo, con datos).
  ('c0000000-0000-0000-0000-000000009001', '11111111-1111-1111-1111-111111111111', 'DTD-9001',
   'jose mendez', 'josemendezc@msn.com', '+58 424 6333765', 'V-19695856', null, null),
  ('c0000000-0000-0000-0000-000000008221', '11111111-1111-1111-1111-111111111111', 'DTD-8221',
   'Jose Mendez', null, null, null, null, null),
  -- Acentos.
  ('c0000000-0000-0000-0000-000000000500', '11111111-1111-1111-1111-111111111111', 'DTD-0500',
   'María Peña', null, null, null, null, null),
  -- Esposos con acceso al portal los dos.
  ('c0000000-0000-0000-0000-00000000a001', '11111111-1111-1111-1111-111111111111', 'DTD-0600',
   'Ana Rojas', null, null, null, null, null),
  ('c0000000-0000-0000-0000-00000000a002', '11111111-1111-1111-1111-111111111111', 'DTD-0601',
   'Luis Duarte', null, null, null, null, null),
  -- La que se queda tiene una fila de portal REVOCADA; la otra, acceso vivo.
  ('c0000000-0000-0000-0000-00000000e001', '11111111-1111-1111-1111-111111111111', 'DTD-0700',
   'Carla Soto', null, null, null, null, null),
  ('c0000000-0000-0000-0000-00000000e002', '11111111-1111-1111-1111-111111111111', 'DTD-0701',
   'Pedro Lugo', null, null, null, null, null),
  -- Otro tenant, aliado, borrado.
  ('c0000000-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'DTD-7000',
   'Jose Otro Tenant', null, null, null, null, null),
  ('c0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'HR-0001',
   'Jose Aliado', null, null, null, 'a1a1a1a1-0000-0000-0000-000000000001', null),
  ('c0000000-0000-0000-0000-0000000000d1', '11111111-1111-1111-1111-111111111111', 'DTD-0999',
   'Jose Borrado', null, null, null, null, now());

insert into public.client_markbox_history (tenant_id, client_id, markbox, reason) values
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000009001', 'LEG-OLD1', 'migración legacy');
insert into public.shipments (tenant_id, client_markbox) values
  ('11111111-1111-1111-1111-111111111111', 'DTD-8221'),
  ('11111111-1111-1111-1111-111111111111', 'DTD-8221');
insert into public.invoices (tenant_id, client_markbox) values
  ('11111111-1111-1111-1111-111111111111', 'DTD-9001');
insert into public.client_users (tenant_id, client_id, email, auth_user_id) values
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000a001', 'ana@example.test', 'dddddddd-0000-0000-0000-000000000001'),
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000a002', 'luis@example.test', 'dddddddd-0000-0000-0000-000000000002');
insert into public.client_users (tenant_id, client_id, email, auth_user_id, status) values
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000e001', 'carla@example.test', 'dddddddd-0000-0000-0000-000000000003', 'revoked'),
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000e002', 'pedro@example.test', 'dddddddd-0000-0000-0000-000000000004', 'active');

select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');

-- ── 1. Búsqueda ──────────────────────────────────────────────
select pg_temp.ok(
  (select count(*) from public.client_search_for_merge('jose mendez')) = 2,
  'jose mendez debía traer exactamente las dos fichas del caso de Sam');
select pg_temp.ok(
  (select count(*) from public.client_search_for_merge('JOSÉ MÉNDEZ')) = 2,
  'mayúsculas y acentos no deben cambiar el resultado');
select pg_temp.ok(
  (select count(*) from public.client_search_for_merge('mend')) = 2,
  'el nombre parcial debía encontrar');
select pg_temp.ok(
  (select nombre from public.client_search_for_merge('maria pena')) = 'María Peña',
  'maria pena (sin acentos) debía encontrar a María Peña');
select pg_temp.ok(
  (select count(*) from public.client_search_for_merge('peña')) = 1,
  'peña (con ñ) debía encontrar a María Peña');
select pg_temp.ok(
  (select markbox from public.client_search_for_merge('dtd-9001')) = 'DTD-9001',
  'el Shipping Mark exacto debía encontrar');
select pg_temp.ok(
  (select markbox from public.client_search_for_merge('8221')) = 'DTD-8221',
  'un fragmento del Shipping Mark debía encontrar');
select pg_temp.ok(
  (select markbox from public.client_search_for_merge('leg-old1')) = 'DTD-9001'
  and (select 'Shipping Mark' = any(matched_by) from public.client_search_for_merge('leg-old1')),
  'un código ANTERIOR debía llevar a la ficha vigente y decir que fue por Shipping Mark');
select pg_temp.ok(
  (select markbox from public.client_search_for_merge('633-3765')) = 'DTD-9001',
  'el teléfono (>=4 dígitos, con o sin formato) debía encontrar');
select pg_temp.ok(
  (select markbox from public.client_search_for_merge('MSN.com')) = 'DTD-9001',
  'el correo parcial debía encontrar');
select pg_temp.ok(
  (select markbox from public.client_search_for_merge('v-19695856')) = 'DTD-9001',
  'el documento debía encontrar');
select pg_temp.ok(
  (select markbox from public.client_search_for_merge('dtd9001')) = 'DTD-9001'
  and (select markbox from public.client_search_for_merge('DTD 9001')) = 'DTD-9001'
  and (select markbox from public.client_search_for_merge('V19695856')) = 'DTD-9001',
  'el código y el documento debían encontrarse también sin guiones ni espacios');
select pg_temp.ok(
  (select count(*) from public.client_search_for_merge('otro tenant')) = 0,
  'otro tenant no debía aparecer');
select pg_temp.ok(
  (select count(*) from public.client_search_for_merge('aliado')) = 0,
  'un cliente de aliado no debía aparecer');
select pg_temp.ok(
  (select count(*) from public.client_search_for_merge('borrado')) = 0,
  'un cliente borrado no debía aparecer');
select pg_temp.ok(
  (select count(*) from public.client_search_for_merge('%%')) = 0
  and (select count(*) from public.client_search_for_merge('__')) = 0,
  'los comodines del usuario son texto, no patrón');
select pg_temp.ok(
  (select count(*) from public.client_search_for_merge('j')) = 0,
  'una letra sola no busca');
select pg_temp.ok(
  (select count(*) from public.client_search_for_merge('1')) = 0
  and (select count(*) from public.client_search_for_merge('12')) = 0,
  'un teléfono de menos de 4 dígitos no busca por teléfono');

select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.ok(
  (select count(*) from public.client_search_for_merge('jose')) = 1
  and (select markbox from public.client_search_for_merge('jose')) = 'DTD-7000',
  'el otro tenant solo ve lo suyo');
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');

-- ── 2. Vista previa ──────────────────────────────────────────
select pg_temp.ok(
  (public.client_merge_preview('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-000000008221') #>> '{merged,counts,shipments}')::int = 2
  and (public.client_merge_preview('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-000000008221') #>> '{survivor,counts,invoices}')::int = 1,
  'la vista previa debía contar embarques y facturas de cada lado');
select pg_temp.ok(
  (public.client_merge_preview('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-000000008221') #>> '{warnings,sameNameOnly}')::boolean,
  'DTD-8221 y DTD-9001 coinciden solo por nombre: debía avisarlo');
select pg_temp.ok(
  (public.client_merge_preview('c0000000-0000-0000-0000-00000000a001', 'c0000000-0000-0000-0000-00000000a002') #>> '{warnings,portalRevoked}')::boolean,
  'dos con acceso al portal: debía avisar que se revoca uno');
select pg_temp.ok(
  (public.client_merge_preview('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-000000008221') #>> '{survivor,document}') = 'V-19695856'
  and (public.client_merge_preview('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-000000008221') #>> '{survivor,email}') = 'josemendezc@msn.com'
  and (public.client_merge_preview('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-000000008221') #> '{merged,document}') = 'null'::jsonb,
  'la vista previa debía traer documento y correo de cada ficha para compararlas');
select pg_temp.ok(
  (public.client_merge_preview('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-000000008221') #>> '{warnings,nothingInCommon}')::boolean = false
  and (public.client_merge_preview('c0000000-0000-0000-0000-00000000a001', 'c0000000-0000-0000-0000-00000000a002') #>> '{warnings,nothingInCommon}')::boolean
  and (public.client_merge_preview('c0000000-0000-0000-0000-00000000a001', 'c0000000-0000-0000-0000-00000000a002') #>> '{warnings,sameNameOnly}')::boolean = false,
  'dos fichas sin nada en común (los esposos) debían avisarse como tales');
select pg_temp.ok(
  (public.client_merge_preview('c0000000-0000-0000-0000-00000000e001', 'c0000000-0000-0000-0000-00000000e002') #>> '{warnings,portalLost}')::boolean
  and (public.client_merge_preview('c0000000-0000-0000-0000-00000000e001', 'c0000000-0000-0000-0000-00000000e002') #>> '{warnings,portalMoved}')::boolean = false
  and (public.client_merge_preview('c0000000-0000-0000-0000-00000000e001', 'c0000000-0000-0000-0000-00000000e002') #>> '{warnings,portalRevoked}')::boolean = false,
  'si la que se queda tiene el acceso revocado y la otra uno vivo, debía avisar que NADIE queda con acceso');
select pg_temp.ok(
  (public.client_merge_preview('c0000000-0000-0000-0000-00000000e002', 'c0000000-0000-0000-0000-00000000e001') -> 'warnings'
     @> '{"portalLost": false, "portalRevoked": false, "portalMoved": false}'::jsonb),
  'invertido (se queda la del acceso vivo) no debía avisar nada del portal');
select pg_temp.ok(
  public.client_merge_preview('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-000000008221')::text !~* 'amount|total|monto|balance|saldo',
  'la vista previa no debe llevar montos');
select pg_temp.ok(
  (public.client_merge_preview('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-0000000000a1') ->> 'ok')::boolean = false,
  'con un aliado la vista previa debía marcar que no se puede');
select pg_temp.ok(
  pg_temp.falla($q$select public.client_merge_preview('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-000000009001')$q$) like '22023:%',
  'la vista previa de una ficha consigo misma debía rechazarse');
select pg_temp.ok(
  pg_temp.falla($q$select public.client_merge_preview('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-0000000000b1')$q$) like 'P0002:%',
  'la vista previa con una ficha de otro tenant debía decir que no existe');

-- ── 3. Roles ─────────────────────────────────────────────────
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000013');
select pg_temp.ok(
  pg_temp.falla($q$select * from public.client_search_for_merge('jose')$q$) like '42501:%',
  'marketing no debía poder buscar');
select pg_temp.ok(
  pg_temp.falla($q$select public.client_merge_preview('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-000000008221')$q$) like '42501:%',
  'marketing no debía ver la vista previa');
select pg_temp.ok(
  pg_temp.falla($q$select public.merge_clients_manual('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-000000008221', 'Es la misma persona', 'DTD-8221')$q$) like '42501:%',
  'marketing no debía poder fusionar');
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');

-- ── 4. Rechazos (y nada queda a medias) ──────────────────────
select pg_temp.ok(
  pg_temp.falla($q$select public.merge_clients_manual('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-000000008221', 'Es la misma persona', 'DTD-9001')$q$) like '22023:%escribe el Shipping Mark que se anula%',
  'escribir el Shipping Mark de la ficha que SE QUEDA debía rechazarse');
select pg_temp.ok(
  pg_temp.falla($q$select public.merge_clients_manual('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-000000008221', 'Es la misma persona', '')$q$) like '22023:%',
  'sin confirmar no debía fusionar');
select pg_temp.ok(
  pg_temp.falla($q$select public.merge_clients_manual('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-000000008221', 'no', 'DTD-8221')$q$) like '22023: audit: reason%',
  'un motivo de menos de 4 caracteres debía rechazarse');
select pg_temp.ok(
  pg_temp.falla($q$select public.merge_clients_manual('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-000000009001', 'Es la misma persona', 'DTD-9001')$q$) like '22023:%consigo mismo%',
  'fusionar una ficha consigo misma debía rechazarse');
select pg_temp.ok(
  pg_temp.falla($q$select public.merge_clients_manual('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-0000000000a1', 'Es la misma persona', 'HR-0001')$q$) like '23514:%',
  'fusionar contra un aliado debía rechazarse');
select pg_temp.ok(
  pg_temp.falla($q$select public.merge_clients_manual('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-0000000000b1', 'Es la misma persona', 'DTD-7000')$q$) like 'P0002:%',
  'una ficha de otro tenant debía contestar que no existe');
select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.ok(
  pg_temp.falla($q$select public.merge_clients_manual('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-000000008221', 'Es la misma persona', 'DTD-8221')$q$) like 'P0002:%',
  'un admin de OTRO tenant no debía poder fusionar fichas ajenas');
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');

select pg_temp.ok(
  (select count(*) from public.clients where merged_into_client_id is not null) = 0
  and (select count(*) from public.audit_calls) = 0
  and (select count(*) from public.probe_audit_reason) = 0,
  'tras los rechazos no debía haberse fusionado ni auditado nada');

-- ── 5. La fusión del caso de Sam: se queda el 9001, se anula el 8221 ─────────
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select set_config('dtd.audit_reason', 'ajuste previo', true);
create temp table res as
  select public.merge_clients_manual('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-000000008221',
                                     ' Es la misma persona ', ' dtd-8221 ') as r;

select pg_temp.ok(
  (select r ->> 'survivor_markbox' from res) = 'DTD-9001' and (select r ->> 'retired_markbox' from res) = 'DTD-8221',
  'debía quedarse el 9001 y anularse el 8221');
select pg_temp.ok(
  (select merged_into_client_id from public.clients where markbox = 'DTD-8221') = 'c0000000-0000-0000-0000-000000009001'
  and (select deleted_at is not null from public.clients where markbox = 'DTD-8221')
  and (select merged_into_client_id is null and deleted_at is null from public.clients where markbox = 'DTD-9001'),
  'el 8221 debía quedar retirado y resolviendo hacia el 9001');
select pg_temp.ok(
  (select rif from public.clients where markbox = 'DTD-9001') = 'V-19695856'
  and (select email from public.clients where markbox = 'DTD-9001') = 'josemendezc@msn.com',
  'los datos del que se queda no se pisan');
select pg_temp.ok(
  (select visto from public.probe_audit_reason) = 'Es la misma persona',
  'durante la fusión, dtd.audit_reason debía llevar el motivo humano (lo lee el trigger de la 0455)');
select pg_temp.ok(
  (select count(*) from public.audit_calls where event = 'client_merge_manual'
      and entity_type = 'client' and entity_id = 'c0000000-0000-0000-0000-000000009001'
      and reason = 'Es la misma persona'
      and before_state ->> 'merged_markbox' = 'DTD-8221'
      and after_state ->> 'survivor_markbox' = 'DTD-9001') = 1,
  'debía quedar UN evento client_merge_manual en la ficha que se queda, con el par y el motivo');
select pg_temp.ok(
  current_setting('dtd.audit_reason', true) = 'ajuste previo',
  'el ajuste dtd.audit_reason debía quedar como estaba');
select pg_temp.ok(
  (select count(*) from public.client_search_for_merge('8221')) = 0
  and (select count(*) from public.client_search_for_merge('dtd-9001')) = 1,
  'tras fusionar, el 8221 deja de ofrecerse y el 9001 sigue');
select pg_temp.ok(
  pg_temp.falla($q$select public.merge_clients_manual('c0000000-0000-0000-0000-000000009001', 'c0000000-0000-0000-0000-000000008221', 'Otra vez', 'DTD-8221')$q$) like '22023:%eliminada%',
  'fusionar dos veces la misma ficha debía rechazarse');

-- ── 6. Esposos con portal: el acceso del anulado se revoca ──────────────────
select public.merge_clients_manual('c0000000-0000-0000-0000-00000000a001', 'c0000000-0000-0000-0000-00000000a002',
                                   'Esposos, un solo código', 'DTD-0601');
select pg_temp.ok(
  (select status from public.client_users where client_id = 'c0000000-0000-0000-0000-00000000a002') = 'revoked'
  and (select status from public.client_users where client_id = 'c0000000-0000-0000-0000-00000000a001') = 'active',
  'dos accesos al portal: se queda el de la ficha que sobrevive y el otro se revoca');

-- ── 6b. La vista previa dijo «nadie queda con acceso»: la fusión real lo confirma ──
select public.merge_clients_manual('c0000000-0000-0000-0000-00000000e001', 'c0000000-0000-0000-0000-00000000e002',
                                   'Prueba del aviso de portal', 'DTD-0701');
select pg_temp.ok(
  (select count(*) from public.client_users
    where client_id in ('c0000000-0000-0000-0000-00000000e001', 'c0000000-0000-0000-0000-00000000e002')
      and status <> 'revoked') = 0,
  'la vista previa (portalLost) debía coincidir con lo que hace merge_clients: ningún acceso vivo');

-- ── 7. anon no ejecuta ───────────────────────────────────────
select pg_temp.ok(
  not has_function_privilege('anon', 'public.client_search_for_merge(text)', 'execute')
  and not has_function_privilege('anon', 'public.client_merge_preview(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.merge_clients_manual(uuid, uuid, text, text)', 'execute')
  and has_function_privilege('authenticated', 'public.merge_clients_manual(uuid, uuid, text, text)', 'execute'),
  'anon no debía poder ejecutar ninguna de las tres; authenticated sí');

select 'TEST 0572 GREEN: ' || currval('pg_temp.aserciones') || ' aserciones' as resultado;
rollback;
