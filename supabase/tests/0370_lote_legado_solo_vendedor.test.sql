\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0370 (SDD-0258).
-- Fixtures ficticios y rollback: no toca prod.
--
-- La 0369 barria con `^DTD-[A-Za-z]` y eso arrastraba fichas que NO son de
-- ningun vendedor. Este contrato fija el limite exacto del lote, con los dos
-- casos que de verdad discriminan:
--   1. ⭐ `DTD-LEG-SN01` NO entra — tres letras, no es serie de vendedor.
--   2. ⭐ `DTD-A102-` SI entra — es de la serie A con un guion de mas, y un
--      patron anclado al final (`\d+$`) lo dejaria fuera EN SILENCIO.
-- Sin el caso 2, cualquiera "arreglaria" el patron anclandolo y se llevaria por
-- delante una ficha real sin que nada gritara.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema extensions;
create function extensions.gen_random_uuid() returns uuid
language sql volatile as $$ select gen_random_uuid() $$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null, disabled_at timestamptz
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
  if v_t is null then raise exception 'Authenticated tenant required' using errcode = '42501'; end if;
  if v_t <> p_tenant_id then raise exception 'Tenant mismatch' using errcode = '42501'; end if;
end; $$;

create function public.current_studio_role() returns text
language sql stable security definer set search_path = public as $$
  select ut.role from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null limit 1;
$$;

create function public.assert_studio_role(p_roles text[]) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_role text := public.current_studio_role();
begin
  if v_role is null or not (v_role = any(p_roles)) then
    raise exception 'No tienes permiso para realizar esta acción' using errcode = '42501';
  end if;
end; $$;

create table public.clients (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  markbox text, deleted_at timestamptz,
  merged_into_client_id uuid references public.clients(id),
  aliado_id uuid, kommo_lead_id bigint
);
create unique index clients_tenant_id_markbox_key on public.clients (tenant_id, markbox);

create table public.aliados (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null, client_id uuid, parent_aliado_id uuid,
  prefix text not null, status text not null default 'activo', deleted_at timestamptz
);
create function public.aliado_prefix_chain(p_aliado_id uuid) returns text
language sql stable set search_path = public as $$
  select upper(a.prefix) from public.aliados a where a.id = p_aliado_id;
$$;

create table public.dispatch_orders (id uuid primary key, tenant_id uuid not null);
create table public.dispatch_order_packages (od_id uuid not null, markbox text not null);
create table public.dispatch_rules (
  tenant_id uuid not null,
  vip_markboxes text[] not null default '{}',
  whitelist_markboxes text[] not null default '{}'
);

do $stubs$
declare t text;
begin
  foreach t in array array[
    'invoices','prealertas','shipments','payment_reports','payment_receipts',
    'prealerta_service_requests','prealerta_documents','shipment_documents',
    'client_delivery_addresses','client_claims','client_claim_evidence',
    'client_notification_schedule','quotes','sales_orders','purchase_orders',
    'consolidation_items','packing_list_submissions','suppliers_cn','supplier_claims',
    'supplier_order_signals','warehouse_receipts_cn','academy_enrollments',
    'academy_lesson_progress','academy_diplomas','club_members','legal_acceptances'
  ] loop
    execute format('create table public.%I (tenant_id uuid not null, client_markbox text)', t);
  end loop;
  foreach t in array array['warehouse_boxes','warehouse_receipt_ve_boxes','qr_print_orders'] loop
    execute format('create table public.%I (tenant_id uuid not null, markbox text)', t);
  end loop;
end;
$stubs$;

create table public.referrals (tenant_id uuid not null, referrer_markbox text);

\ir ../migrations/0367_client_markbox_historial.sql
\ir ../migrations/0369_rename_legacy_markboxes.sql
\ir ../migrations/0370_lote_legado_solo_vendedor.sql

do $grants$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('grant select on public.%I to authenticated', t);
    if t <> 'client_markbox_history' then
      execute format('grant insert, update, delete on public.%I to authenticated', t);
    end if;
  end loop;
end;
$grants$;

-- ── Datos ────────────────────────────────────────────────────────────────────
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.tenants (id) values ('00000000-0000-0000-0000-00000000d7d1');
insert into public.user_tenants (user_id, tenant_id, role)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000d7d1', 'admin');

insert into public.clients (id, tenant_id, markbox) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d7d1', 'DTD-A101'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000d7d1', 'DTD-j029'),
  -- ⭐ Sucio pero de vendedor: serie A con un guion de mas. TIENE que migrar.
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000d7d1', 'DTD-A102-'),
  -- ⭐ NO es de vendedor: tres letras. Se queda fuera por decision del founder.
  ('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-00000000d7d1', 'DTD-LEG-SN01'),
  ('00000000-0000-0000-0000-00000000c005', '00000000-0000-0000-0000-00000000d7d1', 'DTD-LEG-SN02'),
  ('00000000-0000-0000-0000-00000000c006', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9058');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

-- 1. ⭐ Las LEG quedan fuera del lote.
do $$
declare r jsonb;
begin
  r := public.rename_legacy_markboxes();
  assert r->>'mapeo' not like '%LEG%',
    'metio una ficha DTD-LEG-* al lote: no es de ningun vendedor';
  assert (r->>'en_este_lote')::int = 3,
    format('esperaba 3 fichas de vendedor, listo %s', r->>'en_este_lote');
end $$;

-- 2. ⭐ La sucia SI entra. Sin este caso, anclar el patron al final pasaria
--    desapercibido y se perderia una ficha real.
do $$
declare r jsonb;
begin
  r := public.rename_legacy_markboxes();
  assert r->>'mapeo' like '%DTD-A102-%',
    'dejo fuera DTD-A102-, que es de la serie A con un guion de mas';
end $$;

-- 3. Y al ejecutar, las LEG siguen intactas.
do $$
declare r jsonb;
begin
  r := public.rename_legacy_markboxes(p_batch => 50, p_dry_run => false);
  assert (r->>'renombrados')::int = 3, format('renombro %s, esperaba 3', r->>'renombrados');
  assert (r->>'pendientes_despues')::int = 0, 'quedaron fichas de vendedor sin migrar';
end $$;

do $$ begin
  assert (select count(*) from public.clients where markbox like 'DTD-LEG-%') = 2,
    'las fichas LEG fueron tocadas por el lote';
  assert (select count(*) from public.client_markbox_history where markbox like 'DTD-LEG-%') = 0,
    'una ficha LEG acabo en el historial: el lote la migro';
  -- Y la sucia migro de verdad, dejando su codigo viejo jubilado.
  assert (select count(*) from public.client_markbox_history where markbox = 'DTD-A102-') = 1,
    'DTD-A102- no migro';
end $$;

rollback;
