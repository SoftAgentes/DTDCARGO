\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0384 (SDD-0269).
-- Fixtures ficticios y rollback: no toca prod.
--
-- La columna guarda PLATA, y una tarifa negativa o en cero no es un acuerdo:
-- es un cliente al que le pagamos por llevarle la carga. El resto de la logica
-- —cual de las cuatro formas gana— vive en TypeScript y se prueba alli
-- (lib/studio/price-books/__tests__).

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
create function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end; $$;

create table public.clients (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  markbox text, aliado_id uuid, deleted_at timestamptz
);
create table public.aliados (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  client_id uuid, parent_aliado_id uuid references public.aliados(id),
  prefix text not null, trade_name text not null default 'x',
  status text not null default 'activo', deleted_at timestamptz
);
create table public.rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  service text not null, origin text not null, destination text not null,
  per_cbm numeric(10,2), flat_rate numeric(10,2), min_charge numeric(10,2),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

insert into public.tenants (id) values ('00000000-0000-0000-0000-00000000d7d1');
insert into public.clients (id, tenant_id, markbox) values
  ('00000000-0000-0000-0000-00000000c0dc', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9001');
insert into public.aliados (id, tenant_id, client_id, prefix, trade_name) values
  ('00000000-0000-0000-0000-0000000000dc', '00000000-0000-0000-0000-00000000d7d1',
   '00000000-0000-0000-0000-00000000c0dc', 'DC', 'Dynasty Cargo');

\ir ../migrations/0382_price_books.sql
\ir ../migrations/0384_price_book_valor_pactado.sql

-- 1. La columna nace nullable: las listas que ya existen no necesitan un numero.
do $$ begin
  assert (select count(*) from information_schema.columns
           where table_schema='public' and table_name='price_books'
             and column_name='base_per_cbm' and is_nullable='YES') = 1,
    'base_per_cbm tenia que existir y ser nullable';
  assert (select count(*) from public.price_books where base_per_cbm is not null) = 0,
    'la migracion le invento un precio a una lista que ya existia';
end $$;

-- 2. ⭐ Cero y negativo: RECHAZADOS. Un acuerdo en $0 el CBM no es un acuerdo.
insert into public.price_books (id, tenant_id, aliado_id, name)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000d7d1',
        '00000000-0000-0000-0000-0000000000dc', 'Tarifa Dynasty Cargo');

do $$ begin
  begin
    update public.price_books set base_per_cbm = 0
     where id = '00000000-0000-0000-0000-0000000000b1';
    raise exception 'CONTRATO ROTO: acepto un precio pactado de $0 el CBM';
  exception when check_violation then null;
  end;

  begin
    update public.price_books set base_per_cbm = -690
     where id = '00000000-0000-0000-0000-0000000000b1';
    raise exception 'CONTRATO ROTO: acepto un precio pactado NEGATIVO';
  exception when check_violation then null;
  end;
end $$;

-- 3. El numero real se guarda, con sus centavos.
do $$ begin
  update public.price_books set base_per_cbm = 690.50
   where id = '00000000-0000-0000-0000-0000000000b1';
  assert (select base_per_cbm from public.price_books
           where id = '00000000-0000-0000-0000-0000000000b1') = 690.50,
    'no guardo el precio pactado con centavos';
end $$;

-- 4. ⭐ Precio pactado Y descuento CONVIVEN. No son excluyentes: el precio manda
--    donde se cobra por CBM, el descuento cubre lo que va por contenedor.
do $$ begin
  update public.price_books set discount_pct = 12
   where id = '00000000-0000-0000-0000-0000000000b1';
  assert (select base_per_cbm = 690.50 and discount_pct = 12
            from public.price_books where id = '00000000-0000-0000-0000-0000000000b1'),
    'la base rechazo tener precio pactado y descuento a la vez';
end $$;

-- 5. Y quitarlo vuelve a dejar la lista sin precio propio.
do $$ begin
  update public.price_books set base_per_cbm = null
   where id = '00000000-0000-0000-0000-0000000000b1';
  assert (select base_per_cbm is null from public.price_books
           where id = '00000000-0000-0000-0000-0000000000b1'),
    'no se pudo borrar el precio pactado';
end $$;

rollback;
