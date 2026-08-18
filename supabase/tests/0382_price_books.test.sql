\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0382 (SDD-0269).
-- Fixtures ficticios y rollback: no toca prod.
--
-- Lo que se protege acá son cuatro cosas que no revientan nunca hasta el dia que
-- pasan:
--   1. Que una tarifa de aliado NO se publique en la calculadora del sitio.
--   2. Que la tarifa se pacte con el aliado RAIZ, no con un sub-aliado.
--   3. Que un cliente de sub-aliado cotice con la lista de su RAIZ.
--   4. Que ninguna tarifa quede sin lista — ni las que ya existen ni las nuevas.
--
-- Cada contrato se valido rompiendolo a proposito (ver la cabecera de la spec
-- SDD-0269, seccion "Mutaciones corridas"): un contrato verde que sigue verde
-- con la proteccion apagada es decorado, no contrato.

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
language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

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

-- `service` va como text: la migracion 0382 no lo toca y el enum real no aporta
-- nada a este contrato.
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

-- ── Datos ANTERIORES a la migracion ──────────────────────────────────────────
-- Dos tenants a proposito: la lista de la casa es por tenant, y el cruce entre
-- tenants es justo lo que un candado de una sola tabla no ve.
insert into public.tenants (id) values
  ('00000000-0000-0000-0000-00000000d7d1'),
  ('00000000-0000-0000-0000-00000000d7d2');

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.user_tenants (user_id, tenant_id, role)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000d7d1', 'admin');

-- Cuatro tarifas que ya existian, como en prod. Ninguna sabe de listas.
insert into public.rates (id, tenant_id, service, origin, destination, per_cbm, min_charge, is_public) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000d7d1',
   'puerta_a_puerta_DDP', 'China', 'Venezuela', 800.00, 50.00, true),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000d7d1',
   'consolidado_lcl', 'China', 'Puerto en Venezuela', 580.00, null, false),
  ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-00000000d7d1',
   'fcl_directo', 'Guangzhou', 'La Guaira', null, null, false),
  ('00000000-0000-0000-0000-00000000f004', '00000000-0000-0000-0000-00000000d7d2',
   'puerta_a_puerta_DDP', 'China', 'Venezuela', 900.00, null, false);
update public.rates set flat_rate = 8500.00 where id = '00000000-0000-0000-0000-00000000f003';

-- La jerarquia del founder: DC raiz, FA colgando de DC, AG raiz sin lista.
insert into public.clients (id, tenant_id, markbox) values
  ('00000000-0000-0000-0000-00000000c0dc', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9001'),
  ('00000000-0000-0000-0000-00000000c0fa', '00000000-0000-0000-0000-00000000d7d1', 'DC-FA-0001'),
  ('00000000-0000-0000-0000-00000000c0a9', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9002');

insert into public.aliados (id, tenant_id, client_id, parent_aliado_id, prefix, trade_name) values
  ('00000000-0000-0000-0000-0000000000dc', '00000000-0000-0000-0000-00000000d7d1',
   '00000000-0000-0000-0000-00000000c0dc', null, 'DC', 'Dynasty Cargo'),
  ('00000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-00000000d7d1',
   '00000000-0000-0000-0000-00000000c0fa', '00000000-0000-0000-0000-0000000000dc', 'FA', 'Sub de DC'),
  ('00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-00000000d7d1',
   '00000000-0000-0000-0000-00000000c0a9', null, 'AG', 'Antonella Guerrero');

-- Los clientes: uno directo, uno de DC, uno de FA, uno de AG.
insert into public.clients (id, tenant_id, markbox, aliado_id) values
  ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9058', null),
  ('00000000-0000-0000-0000-00000000c102', '00000000-0000-0000-0000-00000000d7d1', 'DC-0001',
   '00000000-0000-0000-0000-0000000000dc'),
  ('00000000-0000-0000-0000-00000000c103', '00000000-0000-0000-0000-00000000d7d1', 'DC-FA-1232',
   '00000000-0000-0000-0000-0000000000fa'),
  ('00000000-0000-0000-0000-00000000c104', '00000000-0000-0000-0000-00000000d7d1', 'AG-0001',
   '00000000-0000-0000-0000-0000000000a9');

\ir ../migrations/0382_price_books.sql

do $grants$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$grants$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. La lista de la casa nace sola, UNA por tenant, y se lleva las tarifas que
--    ya existian. Si el backfill fallara, las 4 tarifas de prod quedarian
--    huerfanas y el cotizador no encontraria ninguna.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare v_casa uuid;
begin
  assert (select count(*) from public.price_books where is_house) = 2,
    'esperaba una lista de la casa por tenant (2 tenants)';

  select id into v_casa from public.price_books
   where tenant_id = '00000000-0000-0000-0000-00000000d7d1' and is_house;

  assert (select count(*) from public.rates
           where tenant_id = '00000000-0000-0000-0000-00000000d7d1'
             and price_book_id = v_casa) = 3,
    'el backfill dejo tarifas sin lista: las que ya existian son de la casa';

  assert (select count(*) from public.rates where price_book_id is null) = 0,
    'quedo una tarifa sin lista despues del backfill';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Una tarifa nueva SIN lista cae en la de la casa sola. Es lo que mantiene
--    vivo al Studio ya desplegado, que inserta sin conocer la columna.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare v_casa uuid;
begin
  select id into v_casa from public.price_books
   where tenant_id = '00000000-0000-0000-0000-00000000d7d1' and is_house;

  insert into public.rates (id, tenant_id, service, origin, destination, per_cbm)
  values ('00000000-0000-0000-0000-00000000f005', '00000000-0000-0000-0000-00000000d7d1',
          'consolidado_lcl', 'Yiwu', 'Valencia', 620.00);

  assert (select price_book_id from public.rates
           where id = '00000000-0000-0000-0000-00000000f005') = v_casa,
    'una tarifa insertada sin lista tenia que caer en la de la casa';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Dos listas de la casa en el mismo tenant: RECHAZADO. Con dos,
--    resolve_price_book() elegiria al azar y el precio del cliente directo
--    cambiaria segun el humor del planner.
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  begin
    insert into public.price_books (tenant_id, name, is_house)
    values ('00000000-0000-0000-0000-00000000d7d1', 'Otra casa', true);
    raise exception 'CONTRATO ROTO: dejo crear una segunda lista de la casa';
  exception when unique_violation then null;
  end;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. La lista del aliado raiz: se crea. La del sub-aliado: RECHAZADA.
--    Decision del founder — FA no factura con DTD, le factura Dynasty Cargo.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.price_books (id, tenant_id, aliado_id, name, discount_pct)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000d7d1',
        '00000000-0000-0000-0000-0000000000dc', 'Tarifa Dynasty Cargo', 12.00);

do $$ begin
  begin
    insert into public.price_books (tenant_id, aliado_id, name)
    values ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-0000000000fa',
            'Tarifa del sub-aliado');
    raise exception 'CONTRATO ROTO: le dejo lista de precios propia a un sub-aliado';
  exception when check_violation then null;
  end;
end $$;

-- 5. Dos listas para el mismo aliado: RECHAZADO.
do $$ begin
  begin
    insert into public.price_books (tenant_id, aliado_id, name)
    values ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-0000000000dc',
            'Segunda de Dynasty');
    raise exception 'CONTRATO ROTO: dejo dos listas vivas para el mismo aliado';
  exception when unique_violation then null;
  end;
end $$;

-- 6. La lista de la casa no puede tener dueno, y el descuento tiene rango.
do $$ begin
  begin
    insert into public.price_books (tenant_id, aliado_id, name, is_house)
    values ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-0000000000a9',
            'Casa con dueno', true);
    raise exception 'CONTRATO ROTO: la lista de la casa termino colgando de un aliado';
  exception when check_violation then null;
  end;

  begin
    insert into public.price_books (tenant_id, aliado_id, name, discount_pct)
    values ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-0000000000a9',
            'Regalada', 100.00);
    raise exception 'CONTRATO ROTO: acepto un descuento del 100%%';
  exception when check_violation then null;
  end;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ⭐ 7. LA PUBLICA ES SOLO DE LA CASA.
--    Sin este candado, DTD publica en su propia calculadora el precio que
--    negocio con su aliado.
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  begin
    insert into public.rates (tenant_id, service, origin, destination, per_cbm, is_public, price_book_id)
    values ('00000000-0000-0000-0000-00000000d7d1', 'puerta_a_puerta_DDP', 'China', 'Venezuela',
            700.00, true, '00000000-0000-0000-0000-0000000000b1');
    raise exception 'CONTRATO ROTO: publico al sitio una tarifa de la lista de un aliado';
  exception when check_violation then null;
  end;
end $$;

-- 7b. Y por el camino largo: crearla privada y marcarla publica despues.
insert into public.rates (id, tenant_id, service, origin, destination, per_cbm, price_book_id)
values ('00000000-0000-0000-0000-00000000f006', '00000000-0000-0000-0000-00000000d7d1',
        'puerta_a_puerta_DDP', 'China', 'Venezuela', 700.00,
        '00000000-0000-0000-0000-0000000000b1');
do $$ begin
  begin
    update public.rates set is_public = true where id = '00000000-0000-0000-0000-00000000f006';
    raise exception 'CONTRATO ROTO: un update marco publica una tarifa de aliado';
  exception when check_violation then null;
  end;
end $$;

-- 7c. La de la casa SI se publica: el candado no puede romper lo que ya andaba.
do $$ begin
  update public.rates set is_public = true
   where id = '00000000-0000-0000-0000-00000000f002';
  assert (select is_public from public.rates where id = '00000000-0000-0000-0000-00000000f002'),
    'el candado bloqueo la tarifa publica de la CASA, que es la que alimenta el sitio';
end $$;

-- 8. Una tarifa no puede vivir en la lista de OTRO tenant.
do $$ begin
  begin
    insert into public.rates (tenant_id, service, origin, destination, per_cbm, price_book_id)
    values ('00000000-0000-0000-0000-00000000d7d2', 'consolidado_lcl', 'China', 'Valencia',
            500.00, '00000000-0000-0000-0000-0000000000b1');
    raise exception 'CONTRATO ROTO: una tarifa quedo colgada de la lista de otro tenant';
  exception when check_violation then null;
  end;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ⭐ 9. QUE LISTA LE TOCA A CADA CLIENTE.
--    El caso que importa es el tercero: el cliente de un SUB-aliado cotiza con
--    la lista del RAIZ. Si resolve_price_book() no subiera la jerarquia,
--    caeria en la de la casa y le cobrariamos a Dynasty Cargo precio de calle.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare v_casa uuid; v_dc uuid;
begin
  select id into v_casa from public.price_books
   where tenant_id = '00000000-0000-0000-0000-00000000d7d1' and is_house;
  v_dc := '00000000-0000-0000-0000-0000000000b1';

  assert public.resolve_price_book('00000000-0000-0000-0000-00000000c101') = v_casa,
    'un cliente directo tiene que cotizar con la lista de la casa';

  assert public.resolve_price_book('00000000-0000-0000-0000-00000000c102') = v_dc,
    'un cliente de Dynasty Cargo tiene que cotizar con la lista de Dynasty Cargo';

  assert public.resolve_price_book('00000000-0000-0000-0000-00000000c103') = v_dc,
    'el cliente del SUB-aliado tiene que heredar la lista del raiz, no caer en la casa';

  assert public.resolve_price_book('00000000-0000-0000-0000-00000000c104') = v_casa,
    'un aliado sin lista propia cotiza con la de la casa';

  assert public.resolve_price_book('00000000-0000-0000-0000-000000000000') is null,
    'un cliente que no existe no puede devolver una lista';
end $$;

-- 9b. Si la lista del raiz se cierra, sus clientes vuelven a la casa — no se
--     quedan sin precio.
do $$
declare v_casa uuid;
begin
  select id into v_casa from public.price_books
   where tenant_id = '00000000-0000-0000-0000-00000000d7d1' and is_house;

  update public.price_books set deleted_at = now()
   where id = '00000000-0000-0000-0000-0000000000b1';

  assert public.resolve_price_book('00000000-0000-0000-0000-00000000c103') = v_casa,
    'con la lista del raiz cerrada, su cliente tenia que caer en la de la casa';

  update public.price_books set deleted_at = null
   where id = '00000000-0000-0000-0000-0000000000b1';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Un aliado con lista propia no puede pasar a colgar de otro: su lista
--     quedaria pactada con alguien que ya no factura con DTD.
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  begin
    update public.aliados set parent_aliado_id = '00000000-0000-0000-0000-0000000000a9'
     where id = '00000000-0000-0000-0000-0000000000dc';
    raise exception 'CONTRATO ROTO: un aliado con lista propia paso a ser sub-aliado';
  exception when check_violation then null;
  end;
end $$;

-- 11. `anon` no ejecuta resolve_price_book. Que lista de precios le toca a un
--     cliente es informacion comercial: no es un endpoint publico.
--     Se mide el GRANT y no un `set role`, porque en este contenedor el dueno de
--     las tablas es superusuario y RLS no lo frena — un `set role` mediria el
--     permiso de la sesion, no el de la funcion.
do $$ begin
  assert not has_function_privilege('anon', 'public.resolve_price_book(uuid)', 'execute'),
    'CONTRATO ROTO: anon puede resolver la lista de precios de un cliente';
  assert not has_function_privilege('public', 'public.resolve_price_book(uuid)', 'execute'),
    'CONTRATO ROTO: el grant por defecto a PUBLIC quedo vivo';
  assert has_function_privilege('authenticated', 'public.resolve_price_book(uuid)', 'execute'),
    'el Studio no puede resolver la lista de precios: la funcion quedo sin grant';
end $$;

rollback;
