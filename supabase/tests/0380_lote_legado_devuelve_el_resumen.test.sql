\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0380 (SDD-0258).
-- Fixtures ficticios y rollback: no toca prod.
--
-- La pantalla dejo de tener su propia definicion de "del legado": el conteo y el
-- desglose por serie ahora salen de la MISMA funcion que ejecuta. El espejo que
-- habia en JavaScript se desincronizo de la base en cuatro horas y marcaba 201
-- donde habia 361.
--
-- ⭐ EL CASO QUE DECIDE: una ficha que ya paso por el 9000 tiene que contar en
-- SU serie de siempre (la letra del vendedor), no como "serie 9". El desglose se
-- lee del codigo ORIGINAL, no del actual.

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
\ir ../migrations/0380_lote_legado_devuelve_el_resumen.sql

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
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d7d1', 'DTD-J044', 'Con letra J'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000d7d1', 'DTD-J045', 'Otra con letra J'),
  -- ⭐ Ya paso por el 9000, pero su ORIGEN es la serie A.
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9066', 'Movida al 9000'),
  -- Siempre fue de la casa: no cuenta en ninguna serie.
  ('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9058', 'De la casa');

insert into public.client_markbox_history (tenant_id, client_id, markbox)
values ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c003', 'DTD-A001');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

-- 1. El resumen viene DENTRO de la respuesta, con el mismo predicado del lote.
do $$
declare r jsonb;
begin
  r := public.rename_legacy_markboxes(1, true);
  assert r ? 'por_serie', 'la funcion no devuelve el desglose por serie';
  assert (r->>'pendientes_despues')::int = 3,
    format('esperaba 3 pendientes, dijo %s', r->>'pendientes_despues');
end $$;

-- 2. ⭐ La que paso por el 9000 cuenta en la serie A, NO en una "serie 9".
do $$
declare r jsonb; a int; j int; nueve int;
begin
  r := public.rename_legacy_markboxes(1, true);
  select coalesce((select (e->>'fichas')::int from jsonb_array_elements(r->'por_serie') e
                    where e->>'serie' = 'A'), 0) into a;
  select coalesce((select (e->>'fichas')::int from jsonb_array_elements(r->'por_serie') e
                    where e->>'serie' = 'J'), 0) into j;
  select coalesce((select (e->>'fichas')::int from jsonb_array_elements(r->'por_serie') e
                    where e->>'serie' = '9'), 0) into nueve;
  assert a = 1, format('la ficha que paso por el 9000 no conto en la serie A (A=%s)', a);
  assert j = 2, format('esperaba 2 en la serie J, dio %s', j);
  assert nueve = 0, format('aparecio una "serie 9" inventada (%s)', nueve);
end $$;

-- 3. El desglose NO cuenta a los que siempre fueron de la casa.
do $$
declare r jsonb; total int;
begin
  r := public.rename_legacy_markboxes(1, true);
  select coalesce(sum((e->>'fichas')::int), 0) into total from jsonb_array_elements(r->'por_serie') e;
  assert total = 3, format('el desglose suma %s y los pendientes son 3', total);
end $$;

-- 4. Tras migrar, el desglose se achica solo.
do $$
declare r jsonb;
begin
  r := public.rename_legacy_markboxes(50, false);
  assert (r->>'pendientes_despues')::int = 0, 'quedaron pendientes';
  assert jsonb_array_length(r->'por_serie') = 0, 'el desglose no se vacio al terminar';
end $$;

rollback;
