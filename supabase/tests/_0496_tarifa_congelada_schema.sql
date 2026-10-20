-- SDD-0571 · Esquema mínimo para probar 0496 (shipment_rate_snapshots).
--
-- NO es un contrato: lo incluye con \ir el contrato
-- `0496_tarifa_congelada_por_embarque.test.sql`, y desde PGlite
-- `lib/studio/__tests__/tarifa-congelada.migration.test.ts`. No abre ni cierra
-- transacción: la abre quien lo incluye.
--
-- Cascarones con las columnas y tipos que el preflight de 0496 exige, los enums
-- reales (0002/0256 y 0007) y los cuerpos EXACTOS de los helpers que 0496
-- reutiliza: get_user_tenant_id (0453), current_studio_role (0200) y
-- resolve_price_book (0382). El preflight los compara por md5, así que una copia
-- que se aparte del árbol hace fallar el contrato antes de la primera aserción.
do $fixture_guard$
begin
  if to_regclass('public.tenants') is not null or to_regclass('public.warehouse_receipts_cn') is not null then
    raise exception 'TEST 0496: fixture rechazada, la base ya contiene objetos de aplicación';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$fixture_guard$;
grant usage on schema public to anon, authenticated, service_role;
-- Como Supabase: toda tabla nueva de public nace con todos los privilegios para
-- los roles de la API. La 0496 tiene que quitarlos ella misma (TRUNCATE incluido).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.tenants (id uuid primary key, slug text unique not null, display_name text not null);
create table public.user_tenants (
  user_id uuid not null references auth.users(id), tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null, disabled_at timestamptz, primary key (user_id, tenant_id),
  constraint user_tenants_role_check check (role in ('admin', 'commercial', 'operations', 'accounting',
    'warehouse', 'support', 'marketing'))
);
alter table public.user_tenants enable row level security;
grant select on public.user_tenants to authenticated;
create policy "users see their own user_tenants" on public.user_tenants
  for select to authenticated using (user_id = (select auth.uid()) and disabled_at is null);

-- El cuerpo exacto de 0453: la ÚNICA membresía activa.
create function public.get_user_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1]
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid())
    and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
-- El cuerpo exacto de 0200.
create or replace function public.current_studio_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_tenants
  where user_id = (select auth.uid())
    and disabled_at is null
  limit 1
$$;

-- Enums reales: 0002 con los nombres de 0256, y 0007.
create type public.shipment_service as enum
  ('puerta_a_puerta_DDP', 'consolidado_lcl', 'fcl_directo', 'transporte_terrestre', 'fcl_bodega');
create type public.quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired');

-- Cascarones: solo las columnas que 0496 y resolve_price_book leen.
create table public.aliados (
  id uuid primary key, tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_aliado_id uuid references public.aliados(id), deleted_at timestamptz
);
create table public.clients (
  id uuid primary key, tenant_id uuid not null references public.tenants(id) on delete cascade,
  markbox text not null, name text not null, aliado_id uuid references public.aliados(id),
  deleted_at timestamptz, unique (tenant_id, markbox)
);
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null, deleted_at timestamptz
);
create table public.price_books (
  id uuid primary key, tenant_id uuid not null references public.tenants(id) on delete cascade,
  aliado_id uuid references public.aliados(id), name text not null,
  is_house boolean not null default false, discount_pct numeric(5,2), base_per_cbm numeric(10,2),
  deleted_at timestamptz
);
create table public.rates (
  id uuid primary key, tenant_id uuid not null references public.tenants(id) on delete cascade,
  service public.shipment_service not null, origin text not null default 'Yiwu',
  destination text not null, per_cbm numeric(10,2), flat_rate numeric(10,2), min_charge numeric(10,2),
  valid_until date,
  price_book_id uuid references public.price_books(id) on delete restrict, deleted_at timestamptz
);
create table public.quotes (
  id uuid primary key, tenant_id uuid not null references public.tenants(id) on delete cascade,
  quote_code text not null, client_markbox text, service public.shipment_service not null,
  rate_per_cbm numeric(10,2), rate_used_id uuid references public.rates(id) on delete set null,
  status public.quote_status not null default 'draft', deleted_at timestamptz
);
create table public.warehouse_receipts_cn (
  id uuid primary key, tenant_id uuid not null references public.tenants(id) on delete cascade,
  receipt_code text not null, client_markbox text, is_orphan boolean not null default false,
  total_cbm numeric(10,3), total_weight_kg numeric(10,2), destination_city text,
  deleted_at timestamptz
);

-- El cuerpo exacto de 0382.
create or replace function public.resolve_price_book(p_client_id uuid)
returns uuid
language sql
stable
set search_path = public
as $$
  with recursive cliente as (
    select c.tenant_id, c.aliado_id
      from public.clients c
     where c.id = p_client_id
  ),
  cadena as (
    select a.id, a.parent_aliado_id, 1 as nivel
      from public.aliados a
      join cliente cl on cl.aliado_id = a.id
     where a.deleted_at is null
    union all
    select p.id, p.parent_aliado_id, c.nivel + 1
      from public.aliados p
      join cadena c on p.id = c.parent_aliado_id
     where p.deleted_at is null
       -- Tope de seguridad: el trigger anti-ciclo de la 0362 lo impide, pero una
       -- recursión sin freno en una función `stable` cuelga la sesión entera.
       and c.nivel < 10
  )
  select coalesce(
    (select pb.id
       from public.price_books pb
      where pb.deleted_at is null
        and pb.aliado_id in (select id from cadena where parent_aliado_id is null)
      limit 1),
    (select pb.id
       from public.price_books pb, cliente cl
      where pb.tenant_id = cl.tenant_id
        and pb.is_house
        and pb.deleted_at is null
      limit 1)
  );
$$;
