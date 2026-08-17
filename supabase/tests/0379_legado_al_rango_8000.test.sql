\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0379 (SDD-0258).
-- Fixtures ficticios y rollback: no toca prod.
--
-- El legado se va al rango DTD-8xxx, separado de la serie viva de la casa.
--
-- ⭐ EL CASO QUE DECIDE TODO: una ficha que YA se migro al 9000 por error pero
-- VIENE del legado tiene que entrar igual. Si el grupo se definiera por el
-- codigo de HOY quedaria fuera, y el trabajo terminaria a medias: unas en el
-- 8000 y otras en el 9000. El historial es lo que la delata.
--
-- Y el espejo: una ficha que SIEMPRE fue DTD-9xxx no se toca jamas.

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
  aliado_id uuid, kommo_lead_id bigint,
  -- La 0373 devuelve el nombre en el mapeo; sin esta columna el fixture ni
  -- siquiera compila la funcion nueva.
  name text
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
create table public.client_users (client_id uuid not null, status text not null);

\ir ../migrations/0367_client_markbox_historial.sql
\ir ../migrations/0369_rename_legacy_markboxes.sql
\ir ../migrations/0370_lote_legado_solo_vendedor.sql
\ir ../migrations/0373_lote_legado_con_nombre.sql
\ir ../migrations/0379_legado_al_rango_8000.sql

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

insert into public.clients (id, tenant_id, markbox, name) values
  -- Todavia con codigo de vendedor.
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d7d1', 'DTD-J044', 'Cliente con letra'),
  -- ⭐ YA migrada al 9000 por error, pero VIENE del legado.
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9066', 'Migrada al 9000 por error'),
  -- ⭐ SIEMPRE fue de la casa: no se toca.
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9058', 'Siempre fue de la casa'),
  -- Una aliada: su ficha lleva su insignia, fuera del lote.
  ('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-00000000d7d1', 'DC', 'Aliada');

-- El rastro que delata a la que ya se movio.
insert into public.client_markbox_history (tenant_id, client_id, markbox)
values ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c002', 'DTD-A001');

insert into public.aliados (id, tenant_id, client_id, prefix)
values ('00000000-0000-0000-0000-00000000a111', '00000000-0000-0000-0000-00000000d7d1',
        '00000000-0000-0000-0000-00000000c004', 'DC');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

-- 1. ⭐ Entran las DOS del legado: la que tiene letra y la que YA se movio.
do $$
declare r jsonb;
begin
  r := public.rename_legacy_markboxes();
  assert (r->>'en_este_lote')::int = 2,
    format('esperaba 2 del legado, listo %s', r->>'en_este_lote');
  assert r->>'mapeo' like '%DTD-J044%', 'dejo fuera la que todavia tiene letra';
  assert r->>'mapeo' like '%DTD-9066%',
    'dejo fuera la que YA se migro al 9000 — el trabajo quedaria a medias';
end $$;

-- 2. ⭐ NO entra la que siempre fue de la casa, ni la aliada.
do $$
declare r jsonb;
begin
  r := public.rename_legacy_markboxes();
  assert r->>'mapeo' not like '%DTD-9058%', 'metio a un cliente que SIEMPRE fue de la casa';
  assert r->>'mapeo' not like '%"de": "DC"%', 'metio a una aliada al lote';
end $$;

-- 3. ⭐ Los codigos nuevos son del rango 8000, no del 9000.
do $$
declare r jsonb;
begin
  r := public.rename_legacy_markboxes();
  assert (select bool_and(e->>'a' ~ '^DTD-8\d{3}$') from jsonb_array_elements(r->'mapeo') e),
    'emitio codigos fuera del rango 8000';
end $$;

-- ── El lote de verdad ────────────────────────────────────────────────────────
do $$
declare r jsonb;
begin
  r := public.rename_legacy_markboxes(p_batch => 50, p_dry_run => false);
  assert (r->>'renombrados')::int = 2, format('renombro %s, esperaba 2', r->>'renombrados');
  assert (r->>'pendientes_despues')::int = 0, 'quedaron fichas del legado sin migrar';
end $$;

do $$ begin
  assert (select markbox from public.clients where id='00000000-0000-0000-0000-00000000c003') = 'DTD-9058',
    'TOCO al cliente que siempre fue de la casa';
  assert (select markbox from public.clients where id='00000000-0000-0000-0000-00000000c004') = 'DC',
    'TOCO a la aliada';
  assert (select markbox from public.clients where id='00000000-0000-0000-0000-00000000c002') ~ '^DTD-8\d{3}$',
    'la que venia del 9000 no llego al rango 8000';
  -- La que se movio dos veces conserva SUS DOS codigos viejos, y los dos resuelven.
  assert (select count(*) from public.client_markbox_history
           where client_id='00000000-0000-0000-0000-00000000c002') = 2,
    'perdio uno de sus dos codigos anteriores';
  assert (select count(*) from public.client_markbox_history h
           where (select client_id from public.resolve_markbox(h.tenant_id, h.markbox)) is distinct from h.client_id) = 0,
    'algun codigo jubilado dejo de resolver';
end $$;

-- 4. Correr otra vez no hace nada: ya estan en su rango.
do $$
declare r jsonb;
begin
  r := public.rename_legacy_markboxes(p_batch => 50, p_dry_run => false);
  assert (r->>'renombrados')::int = 0, 'volvio a renombrar fichas que ya estaban en el 8000';
end $$;

rollback;
