\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0358. Fixtures ficticios y rollback: no toca prod.
--
-- Hermano del contrato de 0351, sobre la RPC que aquel barrido no tocó.
-- El andamiaje (tablas, índices únicos reales y fixture del caso DTD-Y009 /
-- DTD-9009) se copió del contrato de 0341 a propósito: es el mismo escenario,
-- y retipearlo sólo abriría la puerta a que los dos se desincronicen.
--
-- Lo que defiende, que es exactamente lo que puede romperse en silencio:
--   1. los roles de la matriz `clients` siguen fusionando (si esto se rompe, el
--      módulo de duplicados queda muerto y nadie se entera),
--   2. marketing y warehouse NO pueden fusionar — el hallazgo; y las dos fichas
--      quedan intactas,
--   3. el candado corre ANTES de 'No existe el cliente superviviente': sin
--      oráculo para sondear qué ids existen,
--   4. un usuario DESACTIVADO no pasa (current_studio_role filtra disabled_at),
--   5. el candado de tenant que ya existía sigue vivo — el rol no lo reemplaza.

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

-- clients con TODAS las columnas que lee merge_clients + los índices únicos que
-- de verdad existen en prod (son los que hacen peligrosa la fusión).
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
  email_marketing_optin_at timestamptz, email_optin_source text,
  whatsapp_marketing_optin_at timestamptz,
  advisor_id uuid, person_id uuid, contact_name text, avatar_path text
);
create unique index clients_tenant_id_markbox_key on public.clients (tenant_id, markbox);
create unique index clients_tenant_doc_unique on public.clients
  (tenant_id, upper(regexp_replace(rif, '[^A-Za-z0-9]', '', 'g')))
  where rif is not null and btrim(rif) <> '' and deleted_at is null;

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


-- current_studio_role(): lo crea la migr 0200 en prod; acá se calca porque
-- assert_studio_role (migr 0351) cuelga de él.
create function public.current_studio_role() returns text
language sql stable security definer set search_path = public as $$
  select ut.role from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null limit 1;
$$;

\ir ../migrations/0341_client_merge_duplicados.sql
\ir ../migrations/0351_operario_rpc_exige_rol.sql
\ir ../migrations/0358_merge_clients_exige_rol.sql

-- ── Fixture ──────────────────────────────────────────────────
insert into public.tenants (id) values ('11111111-1111-1111-1111-111111111111');
insert into public.user_tenants (user_id, tenant_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'admin');

insert into public.clients (id, tenant_id, markbox, name, email, phone, rif, registration_channel, notes)
values
  ('c0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
   'DTD-Y009', 'ELIAS ACOSTA', null, null, null, 'studio', 'Cliente del legado'),
  ('c0000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111',
   'DTD-9009', 'Elias Acosta', 'eliasmoes@hotmail.com', '+58 4140538566', 'V-20108108',
   'portal', 'Se registró solo');

insert into public.legal_acceptances (client_id) values ('c0000000-0000-0000-0000-00000000000b');
insert into public.client_users (tenant_id, client_id, email, auth_user_id)
values ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000b',
        'eliasmoes@hotmail.com', 'dddddddd-0000-0000-0000-000000000001');
insert into public.conversations (tenant_id, client_id, channel) values
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000a', 'whatsapp'),
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000b', 'whatsapp'),
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000b', 'email');
insert into public.client_change_requests (tenant_id, client_id, status) values
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000a', 'pending'),
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000b', 'pending');

-- Un usuario por rol en el tenant bueno, uno desactivado, y para el test de
-- tenant se reusa el admin ajeno que ya trae el fixture ('bbbbbbbb-…-002').
insert into public.user_tenants (user_id, tenant_id, role, disabled_at) values
  ('aaaaaaaa-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'commercial', null),
  ('aaaaaaaa-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'operations', null),
  ('aaaaaaaa-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'marketing',  null),
  ('aaaaaaaa-0000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111', 'warehouse',  null),
  ('aaaaaaaa-0000-0000-0000-000000000015', '11111111-1111-1111-1111-111111111111', 'operations', now());

-- ── 2. marketing y warehouse rebotan, y las dos fichas quedan intactas ──────
-- Va PRIMERO a propósito: la fusión del test 1 es irreversible y dejaría a las
-- fichas marcadas, así que los rebotes se prueban sobre el estado limpio.
do $t2$
declare
  v_rol text; v_uid uuid; v_reboto boolean;
  v_merged_antes uuid; v_merged_despues uuid;
begin
  select merged_into_client_id into v_merged_antes from public.clients
   where id = 'c0000000-0000-0000-0000-00000000000b';

  foreach v_uid in array array[
    'aaaaaaaa-0000-0000-0000-000000000013'::uuid,  -- marketing
    'aaaaaaaa-0000-0000-0000-000000000014'::uuid   -- warehouse
  ] loop
    select role into v_rol from public.user_tenants where user_id = v_uid;
    v_reboto := false;
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    begin
      perform public.merge_clients('c0000000-0000-0000-0000-00000000000a',
                                   'c0000000-0000-0000-0000-00000000000b');
    exception when insufficient_privilege then
      v_reboto := true;
    end;
    if not v_reboto then
      raise exception 'REGRESIÓN: el rol % fusionó dos clientes', v_rol;
    end if;
  end loop;

  select merged_into_client_id into v_merged_despues from public.clients
   where id = 'c0000000-0000-0000-0000-00000000000b';
  if v_merged_despues is distinct from v_merged_antes then
    raise exception 'La ficha se fusionó pese a que la llamada rebotó';
  end if;
end;
$t2$;

-- ── 3. Sin oráculo: el rol se chequea antes de mirar si el cliente existe ───
do $t3$
declare v_estado text;
begin
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000013', true);
  begin
    -- ids que no existen: si el candado corriera después, contestaría P0002 y
    -- serviría para sondear qué fichas hay.
    perform public.merge_clients('c0000000-0000-0000-0000-0000000000ff',
                                 'c0000000-0000-0000-0000-0000000000fe');
    v_estado := 'no lanzó';
  exception
    when insufficient_privilege then v_estado := 'ok';
    when others then v_estado := 'filtró: ' || sqlstate;
  end;
  if v_estado <> 'ok' then
    raise exception 'El candado de rol no corre primero (%)', v_estado;
  end if;
end;
$t3$;

-- ── 4. Un usuario desactivado no pasa ───────────────────────────────────────
do $t4$
declare v_reboto boolean := false;
begin
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000015', true);
  begin
    perform public.merge_clients('c0000000-0000-0000-0000-00000000000a',
                                 'c0000000-0000-0000-0000-00000000000b');
  exception when insufficient_privilege then
    v_reboto := true;
  end;
  if not v_reboto then
    raise exception 'Un operations DESACTIVADO fusionó dos clientes';
  end if;
end;
$t4$;

-- ── 5. El candado de tenant sigue vivo (el rol no lo reemplazó) ─────────────
do $t5$
declare v_msg text := '';
begin
  -- admin, pero de OTRO tenant: pasa el candado de rol y debe morir en el de tenant.
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
  begin
    perform public.merge_clients('c0000000-0000-0000-0000-00000000000a',
                                 'c0000000-0000-0000-0000-00000000000b');
  exception when insufficient_privilege then
    v_msg := sqlerrm;
  end;
  if v_msg not like 'Tenant mismatch%' then
    raise exception 'El candado de tenant se perdió (mensaje: %)', v_msg;
  end if;
end;
$t5$;

-- ── 1. Los roles de la matriz siguen fusionando ─────────────────────────────
-- De último porque la fusión es irreversible: una vez hecha, los rebotes de
-- arriba ya no se podrían distinguir de 'ya fue fusionada'.
do $t1$
declare v_res jsonb;
begin
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000012', true);
  v_res := public.merge_clients('c0000000-0000-0000-0000-00000000000a',
                                'c0000000-0000-0000-0000-00000000000b');
  if v_res is null then
    raise exception 'REGRESIÓN: operations no pudo fusionar';
  end if;
  if v_res->>'survivor_markbox' <> 'DTD-Y009' then
    raise exception 'REGRESIÓN: sobrevivió el markbox equivocado (%)', v_res->>'survivor_markbox';
  end if;
  if not exists (
    select 1 from public.clients
     where id = 'c0000000-0000-0000-0000-00000000000b'
       and merged_into_client_id = 'c0000000-0000-0000-0000-00000000000a'
  ) then
    raise exception 'REGRESIÓN: la fusión no marcó la ficha retirada';
  end if;
end;
$t1$;

rollback;
