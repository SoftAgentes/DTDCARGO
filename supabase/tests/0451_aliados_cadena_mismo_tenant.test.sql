\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0451 (SDD-0461): la CADENA de aliados no cruza
-- tenants. Fixtures ficticios y rollback: no consulta ni modifica una base
-- alojada. Aplica las migraciones reales 0362, 0382, 0401, 0450 y 0451, en el
-- orden en que viven en producción.
--
-- Lo que defiende:
--   1. RED, y es el hueco de DINERO: sin 0451 un aliado de T1 puede colgar de un
--      aliado de T2, y entonces `aliado_prefix_chain` mezcla los prefijos de dos
--      empresas y `resolve_price_book` devuelve la LISTA DE PRECIOS del tenant
--      ajeno. También RED: un aliado de T1 puede colgar de un cliente de T2, y la
--      RPC de marca del Portal entrega la marca ajena si la FK de la 0450 no está.
--   2. Estático: el archivo no trae DML, y `lock_timeout`, los locks (en orden
--      fijo, el mismo de la 0450) y los DOS preflights corren antes del primer DDL.
--   3. Con filas incoherentes —por el padre o por el cliente-ancla— 0451 falla en
--      el preflight con P0001 y un mensaje que lleva sólo el CONTEO: ni uuid, ni
--      prefijo, ni Shipping Mark.
--   4. Una constraint homónima con otra forma (drift), cualquiera de las tres, hace
--      fallar el postflight en vez de darse por buena.
--   5. Aplicada sobre datos coherentes no cambia ninguna fila; reaplicada, deja el
--      catálogo idéntico.
--   6. Catálogo: las dos FK compuestas validadas, MATCH SIMPLE, ON DELETE RESTRICT
--      y ON UPDATE NO ACTION, y el destino único nuevo en `clients`. Las dos FK
--      simples de la 0362 siguen vivas: el embed PostgREST `clients:client_id` de
--      `listAliadoOptions` depende de la simple.
--   7. Cruzar tenants por el padre o por el cliente-ancla (enlazar, dar de alta,
--      mover cualquiera de las dos puntas) falla con 23503 de la FK compuesta que
--      corresponde. El mismo tenant, el aliado raíz (`parent_aliado_id` NULL) y la
--      cadena legítima se aceptan. `deleted_at` no exime.
--   8. `get_portal_brand()` queda con `a.tenant_id = c.tenant_id`, y el filtro
--      funciona SOLO: con la FK compuesta de la 0450 caída a propósito, la RPC
--      devuelve cero filas donde antes entregaba la marca de la otra empresa.
--      Fuera de esa línea la RPC es la de la 0401: mismo encabezado y mismo ACL.
--   9. `resolve_price_book` sigue devolviendo lo mismo para la cadena legítima y
--      para el cliente directo.
--  10. Los borrados terminan IGUAL antes y después de 0451 (mismo SQLSTATE).
--
-- Lo que NO mide: que un fallo no deje cambios a medias. Eso lo garantiza la
-- transacción de la migración (locks, preflight y DDL van en un solo `do`), no
-- este contrato.

begin;

do $fixture_guard$
begin
  if to_regnamespace('auth') is not null or to_regclass('public.clients') is not null then
    raise exception 'TEST 0451 requiere una base PostgreSQL desechable vacía';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$fixture_guard$;

create schema extensions;
create function extensions.gen_random_uuid() returns uuid
language sql volatile as $$ select gen_random_uuid() $$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid $$;

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
  if v_t is null then raise exception 'Authenticated tenant required' using errcode = '42501'; end if;
  if v_t <> p_tenant_id then raise exception 'Tenant mismatch' using errcode = '42501'; end if;
end;
$$;

-- Stub de la migr 0048: el trigger de `updated_at` que la 0382 le pone a `price_books`.
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

-- `clients` con las columnas que leen la 0362, la 0382, la 0401, la 0450 y la
-- 0451. La FK a `tenants` copia la de la 0006 (`on delete cascade`), que decide
-- cómo termina borrar un tenant.
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  markbox text,
  name text not null,
  email text, phone text, rif text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  merged_into_client_id uuid
);
create unique index clients_tenant_id_markbox_key on public.clients (tenant_id, markbox);

-- Stub de la migr 0342: normaliza el teléfono a sus últimos 7 dígitos.
create function public.phone_match_key(p text) returns text
language sql immutable set search_path = public as $$
  select nullif(right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), 7), '');
$$;

-- Stub del espejo del Portal que lee la 0401.
create table public.client_users (
  auth_user_id uuid,
  client_id uuid not null,
  status text not null
);

-- `service` va como text: ni la 0382 ni la 0451 lo tocan, y el enum real no
-- aporta nada a este contrato (mismo criterio que el contrato de la 0382).
create table public.rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service text not null, origin text not null, destination text not null,
  per_cbm numeric(10,2), flat_rate numeric(10,2), min_charge numeric(10,2),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

insert into public.tenants (id) values
  ('aaaaaaaa-0000-0000-0000-000000000001'),   -- T1, la casa
  ('aaaaaaaa-0000-0000-0000-000000000002');   -- T2, otra empresa

insert into public.rates (tenant_id, service, origin, destination, per_cbm, is_public) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'puerta_a_puerta_DDP', 'China', 'Venezuela', 800.00, true),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'puerta_a_puerta_DDP', 'China', 'Venezuela', 900.00, false);

-- Los clientes-ancla: el founder marca un cliente existente como aliado.
insert into public.clients (id, tenant_id, markbox, name) values
  ('cccccccc-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-9010', 'Herneka'),
  ('cccccccc-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-9011', 'Sub de Herneka'),
  ('cccccccc-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-9012', 'Antonella Guerrero'),
  ('cccccccc-0000-0000-0000-0000000000a4', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-9013', 'Nadie Bajo'),
  ('cccccccc-0000-0000-0000-0000000000a5', 'aaaaaaaa-0000-0000-0000-000000000002', 'DTD-9010', 'Dynasty Cargo'),
  ('cccccccc-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-9058', 'Directo de T1'),
  ('cccccccc-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-000000000002', 'DTD-9058', 'Directo de T2');

-- La migración real que creó la entidad, la cadena y sus dos FK simples.
\ir ../migrations/0362_aliados_base.sql

-- ── Fixture de aliados ──────────────────────────────────────────────────────
-- T1: HR raíz con lista propia, SH colgando de HR (cadena legítima), AG raíz SIN
-- lista (la que el RED va a colgar de otro tenant) y NB raíz sin nada.
-- T2: DC raíz con SU lista de precios.

insert into public.aliados (id, tenant_id, client_id, parent_aliado_id, prefix, trade_name, brand_name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-0000000000a1', null, 'HR', 'Herneka', 'Marca HR'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-0000000000a2', 'bbbbbbbb-0000-0000-0000-000000000001',
   'SH', 'Sub de Herneka', null),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-0000000000a3', null, 'AG', 'Antonella Guerrero', null),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-0000000000a4', null, 'NB', 'Nadie Bajo', null),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000002',
   'cccccccc-0000-0000-0000-0000000000a5', null, 'DC', 'Dynasty Cargo', 'Marca DC');

-- Un cliente por aliado. El Shipping Mark respeta la insignia de su cadena,
-- porque el guard de la 0362 lo exige en las filas nuevas.
insert into public.clients (id, tenant_id, markbox, name, aliado_id) values
  ('cccccccc-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001', 'HR-0001',
   'Cliente de HR', 'bbbbbbbb-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-0000000000c2', 'aaaaaaaa-0000-0000-0000-000000000001', 'HR-SH-0001',
   'Cliente de SH', 'bbbbbbbb-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-0000000000c3', 'aaaaaaaa-0000-0000-0000-000000000001', 'AG-0001',
   'Cliente de AG', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('cccccccc-0000-0000-0000-0000000000c4', 'aaaaaaaa-0000-0000-0000-000000000002', 'DC-0001',
   'Cliente de DC', 'bbbbbbbb-0000-0000-0000-000000000005');

-- Dos accesos de Portal: uno del cliente de HR y uno del cliente DIRECTO de T1,
-- que es el que el RED de la marca va a enlazar al aliado ajeno.
insert into auth.users (id) values
  ('0000dddd-0000-0000-0000-000000000001'),
  ('0000dddd-0000-0000-0000-000000000002');
insert into public.client_users (auth_user_id, client_id, status) values
  ('0000dddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-0000000000c1', 'active'),
  ('0000dddd-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-0000000000b1', 'active');

-- Las listas de precios y `resolve_price_book`, la función que se cotiza.
\ir ../migrations/0382_price_books.sql

insert into public.price_books (id, tenant_id, aliado_id, name, discount_pct) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001', 'Lista de Herneka', 10.00),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002',
   'bbbbbbbb-0000-0000-0000-000000000005', 'Lista de Dynasty Cargo', 40.00);

-- La RPC de marca del Portal, tal como está aplicada hoy (sin filtro de tenant).
\ir ../migrations/0401_portal_brand_por_principal.sql

-- La FK compuesta del cliente, ya aplicada en producción.
\ir ../migrations/0450_clients_aliado_mismo_tenant.sql

-- ── Ayudas ──────────────────────────────────────────────────────────────────

create function pg_temp.assert_true(p_ok boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_ok is not true then raise exception 'TEST 0451: %', p_label; end if;
end;
$$;

-- Ejecuta la sentencia y SIEMPRE la deshace: devuelve 'ok' o el SQLSTATE.
create function pg_temp.outcome(p_sql text) returns text
language plpgsql as $$
begin
  begin
    execute p_sql;
    raise exception using errcode = 'PT510', message = 'deshacer';
  exception
    when sqlstate 'PT510' then return 'ok';
    when others then return sqlstate;
  end;
end;
$$;

-- Igual, pero con la constraint que frenó la sentencia: 'SQLSTATE:constraint'.
create function pg_temp.outcome_fk(p_sql text) returns text
language plpgsql as $$
declare
  v_constraint text;
begin
  begin
    execute p_sql;
    raise exception using errcode = 'PT510', message = 'deshacer';
  exception
    when sqlstate 'PT510' then return 'ok';
    when others then
      get stacked diagnostics v_constraint = constraint_name;
      return sqlstate || ':' || coalesce(nullif(v_constraint, ''), '?');
  end;
end;
$$;

create function pg_temp.row_snapshot() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'clients', (select jsonb_agg(to_jsonb(c) order by c.id) from public.clients c),
    'aliados', (select jsonb_agg(to_jsonb(a) order by a.id) from public.aliados a),
    'price_books', (select jsonb_agg(to_jsonb(p) order by p.id) from public.price_books p)
  )
$$;

create function pg_temp.constraint_shape(p_rel regclass, p_name text) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'type', c.contype,
    'ref', (select n.nspname || '.' || r.relname
              from pg_class r join pg_namespace n on n.oid = r.relnamespace
             where r.oid = c.confrelid),
    'cols', (select array_agg(a.attname order by k.ord)
               from unnest(c.conkey) with ordinality as k(num, ord)
               join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.num),
    'ref_cols', (select array_agg(a.attname order by k.ord)
                   from unnest(c.confkey) with ordinality as k(num, ord)
                   join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.num),
    'match', c.confmatchtype,
    'on_delete', c.confdeltype,
    'on_update', c.confupdtype,
    'validated', c.convalidated,
    'comment', obj_description(c.oid, 'pg_constraint')
  )
  from pg_constraint c
  where c.conrelid = p_rel and c.conname = p_name
$$;

-- La lista que se le cotiza a cada cliente, por nombre para que el fallo se lea.
create function pg_temp.lista_de(p_client uuid) returns text
language sql stable as $$
  select pb.name from public.price_books pb
   where pb.id = public.resolve_price_book(p_client)
$$;

create function pg_temp.tenant_de_lista(p_client uuid) returns uuid
language sql stable as $$
  select pb.tenant_id from public.price_books pb
   where pb.id = public.resolve_price_book(p_client)
$$;

create function pg_temp.borrados() returns jsonb
language sql volatile as $$
  select jsonb_build_object(
    'aliado_con_subaliado', pg_temp.outcome(
      $q$delete from public.aliados where id = 'bbbbbbbb-0000-0000-0000-000000000001'$q$),
    'aliado_sin_nada', pg_temp.outcome(
      $q$delete from public.aliados where id = 'bbbbbbbb-0000-0000-0000-000000000004'$q$),
    'cliente_ancla_de_aliado', pg_temp.outcome(
      $q$delete from public.clients where id = 'cccccccc-0000-0000-0000-0000000000a1'$q$),
    'cliente_de_aliado', pg_temp.outcome(
      $q$delete from public.clients where id = 'cccccccc-0000-0000-0000-0000000000c1'$q$),
    'tenant_entero', pg_temp.outcome(
      $q$delete from public.tenants where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$)
  )
$$;

-- ── 0. El fixture describe la realidad de hoy ───────────────────────────────
select pg_temp.assert_true(
  public.aliado_prefix_chain('bbbbbbbb-0000-0000-0000-000000000002') = 'HR-SH',
  'La cadena legítima de SH no es HR-SH');
select pg_temp.assert_true(
  pg_temp.lista_de('cccccccc-0000-0000-0000-0000000000c2') = 'Lista de Herneka',
  'El cliente del sub-aliado SH no hereda la lista del raíz HR');
select pg_temp.assert_true(
  pg_temp.lista_de('cccccccc-0000-0000-0000-0000000000c3') = 'Tarifa DTD Cargo',
  'El cliente de AG, raíz sin lista, no cae en la lista de la casa');
select pg_temp.assert_true(
  pg_temp.lista_de('cccccccc-0000-0000-0000-0000000000b1') = 'Tarifa DTD Cargo',
  'El cliente directo de T1 no cotiza con la lista de la casa');

-- ── 1a. RED: sin 0451, la cadena cruza tenants y se cotiza con la lista ajena ─
savepoint red_cadena;
update public.aliados
   set parent_aliado_id = 'bbbbbbbb-0000-0000-0000-000000000005'   -- DC, aliado de T2
 where id = 'bbbbbbbb-0000-0000-0000-000000000003';                -- AG, aliado de T1

select pg_temp.assert_true(
  public.aliado_prefix_chain('bbbbbbbb-0000-0000-0000-000000000003') = 'DC-AG',
  'RED: sin 0451 la insignia de AG debía poder mezclar el prefijo de otro tenant');
select pg_temp.assert_true(
  pg_temp.lista_de('cccccccc-0000-0000-0000-0000000000c3') = 'Lista de Dynasty Cargo'
  and pg_temp.tenant_de_lista('cccccccc-0000-0000-0000-0000000000c3')
      = 'aaaaaaaa-0000-0000-0000-000000000002',
  format('RED: sin 0451 el cliente de AG (T1) debía poder cotizarse con la lista de T2; dio %s',
    pg_temp.lista_de('cccccccc-0000-0000-0000-0000000000c3')));
rollback to savepoint red_cadena;
release savepoint red_cadena;

-- ── 1b. RED: sin 0451, un aliado de T1 cuelga de un cliente de T2 ───────────
savepoint red_ancla;
insert into public.aliados (id, tenant_id, client_id, prefix, trade_name)
values ('bbbbbbbb-0000-0000-0000-00000000000f', 'aaaaaaaa-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-0000000000b2',   -- cliente de T2
        'XX', 'Ancla Ajena');
select pg_temp.assert_true(
  (select count(*) from public.aliados a join public.clients c on c.id = a.client_id
    where c.tenant_id <> a.tenant_id) = 1,
  'RED: sin 0451 un aliado de T1 debía poder colgar de un cliente de T2');
rollback to savepoint red_ancla;
release savepoint red_ancla;

-- ── 1c. RED: la RPC de marca entrega la marca ajena si la FK de la 0450 cae ──
-- El filtro de tenant de `get_portal_brand()` es cinturón y tirantes, así que el
-- RED se monta soltando a propósito la FK compuesta de la 0450.
savepoint red_marca;
alter table public.clients drop constraint clients_aliado_mismo_tenant_fkey;
update public.clients
   set aliado_id = 'bbbbbbbb-0000-0000-0000-000000000005'   -- DC, aliado de T2
 where id = 'cccccccc-0000-0000-0000-0000000000b1';         -- cliente directo de T1

set local role authenticated;
set local "request.jwt.claim.sub" = '0000dddd-0000-0000-0000-000000000002';
do $red_marca$
declare v_marcas text[];
begin
  select pg_catalog.array_agg(brand_name) into v_marcas from public.get_portal_brand();
  if v_marcas is distinct from array['Marca DC']::text[] then
    raise exception 'TEST 0451 RED: sin el filtro de tenant la RPC debía entregar la marca ajena; dio %',
      v_marcas;
  end if;
end;
$red_marca$;
reset role;
rollback to savepoint red_marca;
release savepoint red_marca;

-- Borrados ANTES de 0451: la referencia del punto 10.
create temporary table borrados_antes as select pg_temp.borrados() as resultado;

select pg_temp.assert_true(
  (select resultado ->> 'aliado_con_subaliado' <> 'ok'
      and resultado ->> 'aliado_sin_nada' = 'ok'
      and resultado ->> 'cliente_ancla_de_aliado' <> 'ok'
      and resultado ->> 'cliente_de_aliado' = 'ok'
     from borrados_antes),
  format('Referencia de borrados inesperada antes de 0451: %s',
    (select resultado from borrados_antes)));

-- ── 2. Estático: sin DML, y lock_timeout, locks y preflights antes del DDL ───
do $contrato_estatico$
declare
  v_codigo text := lower(regexp_replace(regexp_replace(
    pg_read_file('/sb/migrations/0451_aliados_cadena_mismo_tenant.sql'),
    '/\*.*?\*/', '', 'g'), '--[^\n]*', '', 'g'));
  v_timeout int := strpos(v_codigo, 'set local lock_timeout');
  v_lock_aliados int := strpos(v_codigo, 'lock table public.aliados in access exclusive mode');
  v_lock_clients int := strpos(v_codigo, 'lock table public.clients in access exclusive mode');
  v_pre_padre int := strpos(v_codigo, 'cuelgan de un aliado de otro tenant');
  v_pre_ancla int := strpos(v_codigo, 'cuelgan de un cliente de otro tenant');
  v_primer_ddl int := regexp_instr(v_codigo, '\m(alter|create|drop|comment)\M');
begin
  -- El UPDATE se reconoce por su `set`, para no confundirlo con el
  -- `on update no action` de las FK.
  perform pg_temp.assert_true(
    v_codigo !~ '\m(insert\s+into|delete\s+from|merge\s+into|truncate|copy)\M'
    and v_codigo !~ '\mupdate\s+(only\s+)?[a-z0-9_."]+(\s+(as\s+)?[a-z0-9_]+)?\s+set\M',
    'La migración contiene DML');
  perform pg_temp.assert_true(
    0 < v_timeout and v_timeout < v_lock_aliados and v_lock_aliados < v_lock_clients
    and v_lock_clients < v_pre_padre and v_pre_padre < v_pre_ancla
    and v_pre_ancla < v_primer_ddl,
    format('Orden roto: lock_timeout %s, lock aliados %s, lock clients %s, preflight padre %s, '
           'preflight ancla %s, primer DDL %s',
      v_timeout, v_lock_aliados, v_lock_clients, v_pre_padre, v_pre_ancla, v_primer_ddl));
  -- El orden de los locks es el de la 0450 a propósito: dos migraciones de esta
  -- familia corriendo a la vez no se abrazan.
  perform pg_temp.assert_true(
    (select strpos(lower(pg_read_file('/sb/migrations/0450_clients_aliado_mismo_tenant.sql')),
                   'lock table public.aliados')
          < strpos(lower(pg_read_file('/sb/migrations/0450_clients_aliado_mismo_tenant.sql')),
                   'lock table public.clients')),
    'La 0450 cambió el orden de sus locks: revisar el de la 0451 antes de aplicar');
  -- La 0401 no se toca: la RPC se redefine desde la 0451.
  perform pg_temp.assert_true(
    pg_read_file('/sb/migrations/0401_portal_brand_por_principal.sql')
      !~ 'a\.tenant_id\s*=\s*c\.tenant_id',
    'La 0401 fue modificada; el filtro debe vivir en la 0451');
end;
$contrato_estatico$;

-- ── 3a. Preflight del padre: falla y reporta sólo el conteo ─────────────────
do $contrato_preflight_padre$
declare
  v_migration text := pg_read_file('/sb/migrations/0451_aliados_cadena_mismo_tenant.sql');
  v_failed boolean := false;
  v_state text;
  v_message text;
  v_detail text;
  v_hint text;
  v_logs text;
begin
  begin
    -- AG (T1) y NB (T1) colgando del aliado DC (T2).
    update public.aliados
       set parent_aliado_id = 'bbbbbbbb-0000-0000-0000-000000000005'
     where id in ('bbbbbbbb-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000004');

    begin
      execute v_migration;
    exception when others then
      get stacked diagnostics
        v_state = returned_sqlstate,
        v_message = message_text,
        v_detail = pg_exception_detail,
        v_hint = pg_exception_hint;
      v_failed := true;
    end;

    perform pg_temp.assert_true(v_failed, 'El preflight aceptó dos cadenas cruzadas');
    perform pg_temp.assert_true(
      v_state = 'P0001' and v_message like '0451: 2 aliado(s) cuelgan de un aliado de otro tenant%',
      format('El preflight del padre falló por otra causa: %s %s', v_state, v_message));

    v_logs := concat_ws(' ', v_message, v_detail, v_hint);
    perform pg_temp.assert_true(
      v_logs !~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-' and v_logs !~ '[A-Z]{2,4}-[0-9]',
      format('El mensaje del preflight filtra ids o Shipping Marks: %s', v_logs));

    raise exception using errcode = 'PT511', message = 'deshacer las cadenas cruzadas sintéticas';
  exception when sqlstate 'PT511' then null;
  end;

  perform pg_temp.assert_true(
    (select count(*) from public.aliados where parent_aliado_id is not null) = 1,
    'El fixture no volvió a su estado coherente');
end;
$contrato_preflight_padre$;

-- ── 3b. Preflight del cliente-ancla: falla y reporta sólo el conteo ─────────
do $contrato_preflight_ancla$
declare
  v_migration text := pg_read_file('/sb/migrations/0451_aliados_cadena_mismo_tenant.sql');
  v_failed boolean := false;
  v_state text;
  v_message text;
  v_detail text;
  v_hint text;
  v_logs text;
begin
  begin
    insert into public.aliados (tenant_id, client_id, prefix, trade_name)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            'cccccccc-0000-0000-0000-0000000000b2', 'XX', 'Ancla Ajena');

    begin
      execute v_migration;
    exception when others then
      get stacked diagnostics
        v_state = returned_sqlstate,
        v_message = message_text,
        v_detail = pg_exception_detail,
        v_hint = pg_exception_hint;
      v_failed := true;
    end;

    perform pg_temp.assert_true(v_failed, 'El preflight aceptó un cliente-ancla de otro tenant');
    perform pg_temp.assert_true(
      v_state = 'P0001' and v_message like '0451: 1 aliado(s) cuelgan de un cliente de otro tenant%',
      format('El preflight del ancla falló por otra causa: %s %s', v_state, v_message));

    v_logs := concat_ws(' ', v_message, v_detail, v_hint);
    perform pg_temp.assert_true(
      v_logs !~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-' and v_logs !~ '[A-Z]{2,4}-[0-9]',
      format('El mensaje del preflight filtra ids o Shipping Marks: %s', v_logs));

    raise exception using errcode = 'PT512', message = 'deshacer el ancla ajena sintética';
  exception when sqlstate 'PT512' then null;
  end;

  perform pg_temp.assert_true(
    (select count(*) from public.aliados) = 5,
    'El fixture no volvió a su estado coherente');
end;
$contrato_preflight_ancla$;

-- ── 4. Drift: una constraint homónima con otra forma no se da por buena ─────
-- Arma el drift, corre la migración entera y lo deshace todo, también el drift.
-- Devuelve 'SQLSTATE|mensaje', u 'ok|' si la migración lo dio por bueno.
create function pg_temp.drift(p_setup text) returns text
language plpgsql as $$
declare
  v_state text := 'ok';
  v_message text := '';
begin
  begin
    execute p_setup;
    begin
      execute pg_read_file('/sb/migrations/0451_aliados_cadena_mismo_tenant.sql');
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    end;
    raise exception using errcode = 'PT513', message = 'deshacer el drift sintético';
  exception when sqlstate 'PT513' then null;
  end;
  return v_state || '|' || v_message;
end;
$$;

-- Alguien creó a mano la FK del padre con el mismo nombre, pero con CASCADE.
select pg_temp.assert_true(
  pg_temp.drift($q$
    alter table public.aliados add constraint aliados_parent_mismo_tenant_fkey
      foreign key (tenant_id, parent_aliado_id) references public.aliados (tenant_id, id)
      on delete cascade$q$)
    like 'P0001|0451: aliados_parent_mismo_tenant_fkey existe con otra forma%',
  'El postflight dio por buena una FK del padre homónima con CASCADE');

-- Lo mismo con la FK del cliente-ancla, sobre un destino correcto.
select pg_temp.assert_true(
  pg_temp.drift($q$
    alter table public.clients add constraint clients_tenant_id_id_key unique (tenant_id, id);
    alter table public.aliados add constraint aliados_client_mismo_tenant_fkey
      foreign key (tenant_id, client_id) references public.clients (tenant_id, id)
      on delete cascade$q$)
    like 'P0001|0451: aliados_client_mismo_tenant_fkey existe con otra forma%',
  'El postflight dio por buena una FK del ancla homónima con CASCADE');

-- Y un destino homónimo con las columnas en otro orden.
select pg_temp.assert_true(
  pg_temp.drift($q$
    alter table public.clients add constraint clients_tenant_id_id_key unique (id, tenant_id)$q$)
    like 'P0001|0451: clients_tenant_id_id_key existe con otra forma%',
  'El postflight dio por bueno un destino homónimo con las columnas en otro orden');

select pg_temp.assert_true(
  not exists (select 1 from pg_constraint
               where conname in ('aliados_parent_mismo_tenant_fkey',
                                 'aliados_client_mismo_tenant_fkey',
                                 'clients_tenant_id_id_key')),
  'El fixture no volvió a su estado sin 0451');

-- ── 5. Aplicar 0451 sobre datos coherentes: sin DML e idempotente ───────────
create temporary table filas_antes as select pg_temp.row_snapshot() as filas;

-- La RPC tal como la dejó la 0401, para compararla en el punto 8: la 0451 sólo
-- puede agregarle el filtro de tenant.
create temporary table rpc_0401 as
select pg_catalog.pg_get_functiondef('public.get_portal_brand()'::regprocedure) as def,
       (select p.proacl::text from pg_catalog.pg_proc p
         where p.oid = 'public.get_portal_brand()'::regprocedure) as acl;

\ir ../migrations/0451_aliados_cadena_mismo_tenant.sql

create temporary table catalogo_primera as
select pg_temp.constraint_shape('public.aliados', 'aliados_parent_mismo_tenant_fkey') as fk_padre,
       pg_temp.constraint_shape('public.aliados', 'aliados_client_mismo_tenant_fkey') as fk_ancla,
       pg_temp.constraint_shape('public.clients', 'clients_tenant_id_id_key') as destino,
       pg_catalog.pg_get_functiondef('public.get_portal_brand()'::regprocedure) as rpc;

\ir ../migrations/0451_aliados_cadena_mismo_tenant.sql

select pg_temp.assert_true(
  (select to_jsonb(p) from catalogo_primera p) = jsonb_build_object(
    'fk_padre', pg_temp.constraint_shape('public.aliados', 'aliados_parent_mismo_tenant_fkey'),
    'fk_ancla', pg_temp.constraint_shape('public.aliados', 'aliados_client_mismo_tenant_fkey'),
    'destino', pg_temp.constraint_shape('public.clients', 'clients_tenant_id_id_key'),
    'rpc', pg_catalog.pg_get_functiondef('public.get_portal_brand()'::regprocedure)),
  'Reaplicar 0451 cambia el catálogo');
select pg_temp.assert_true((select filas from filas_antes) = pg_temp.row_snapshot(),
  'Aplicar 0451 modificó filas');

-- ── 6. Catálogo ─────────────────────────────────────────────────────────────
select pg_temp.assert_true(
  pg_temp.constraint_shape('public.aliados', 'aliados_parent_mismo_tenant_fkey') - 'comment'
    = jsonb_build_object(
        'type', 'f',
        'ref', 'public.aliados',
        'cols', array['tenant_id', 'parent_aliado_id'],
        'ref_cols', array['tenant_id', 'id'],
        'match', 's',
        'on_delete', 'r',
        'on_update', 'a',
        'validated', true),
  format('La FK del padre no tiene la forma del contrato: %s',
    pg_temp.constraint_shape('public.aliados', 'aliados_parent_mismo_tenant_fkey')));

select pg_temp.assert_true(
  pg_temp.constraint_shape('public.aliados', 'aliados_client_mismo_tenant_fkey') - 'comment'
    = jsonb_build_object(
        'type', 'f',
        'ref', 'public.clients',
        'cols', array['tenant_id', 'client_id'],
        'ref_cols', array['tenant_id', 'id'],
        'match', 's',
        'on_delete', 'r',
        'on_update', 'a',
        'validated', true),
  format('La FK del cliente-ancla no tiene la forma del contrato: %s',
    pg_temp.constraint_shape('public.aliados', 'aliados_client_mismo_tenant_fkey')));

select pg_temp.assert_true(
  pg_temp.constraint_shape('public.aliados', 'aliados_parent_mismo_tenant_fkey') ->> 'comment'
    like 'SDD-0461:%'
  and pg_temp.constraint_shape('public.aliados', 'aliados_client_mismo_tenant_fkey') ->> 'comment'
    like 'SDD-0461:%'
  and pg_temp.constraint_shape('public.clients', 'clients_tenant_id_id_key') ->> 'comment'
    like 'SDD-0461:%',
  'Alguna constraint nueva quedó sin su comentario');

select pg_temp.assert_true(
  pg_temp.constraint_shape('public.clients', 'clients_tenant_id_id_key') ->> 'type' = 'u'
  and pg_temp.constraint_shape('public.clients', 'clients_tenant_id_id_key') -> 'cols'
      = '["tenant_id", "id"]'::jsonb,
  'El destino de la FK del cliente-ancla no es unique (tenant_id, id) en clients');

-- El destino de la 0450 se reutiliza tal cual: la 0451 no lo recrea ni lo
-- re-comenta, así que conserva su comentario SDD-0456.
select pg_temp.assert_true(
  pg_temp.constraint_shape('public.aliados', 'aliados_tenant_id_id_key') ->> 'comment'
    like 'SDD-0456:%',
  'La 0451 pisó el destino único que creó la 0450');

-- Las FK simples de una columna de la 0362 siguen vivas: sin la de `client_id` el
-- embed PostgREST `clients:client_id` de listAliadoOptions se queda sin relación.
select pg_temp.assert_true(
  (select count(*) from pg_constraint c
    where c.conrelid = 'public.aliados'::regclass
      and c.contype = 'f'
      and c.confrelid = 'public.clients'::regclass
      and c.conkey = array[(select a.attnum from pg_attribute a
                              where a.attrelid = 'public.aliados'::regclass
                                and a.attname = 'client_id')]::int2[]
      and c.confdeltype = 'r'
      and c.convalidated) = 1,
  'La FK simple de aliados.client_id (0362) ya no está');
select pg_temp.assert_true(
  (select count(*) from pg_constraint c
    where c.conrelid = 'public.aliados'::regclass
      and c.contype = 'f'
      and c.confrelid = 'public.aliados'::regclass
      and c.conkey = array[(select a.attnum from pg_attribute a
                              where a.attrelid = 'public.aliados'::regclass
                                and a.attname = 'parent_aliado_id')]::int2[]
      and c.confdeltype = 'r'
      and c.convalidated) = 1,
  'La FK simple de aliados.parent_aliado_id (0362) ya no está');
select pg_temp.assert_true(
  (select count(*) from pg_constraint c
    where c.conrelid = 'public.aliados'::regclass and c.contype = 'f'
      and c.confrelid = 'public.clients'::regclass) = 2
  and (select count(*) from pg_constraint c
        where c.conrelid = 'public.aliados'::regclass and c.contype = 'f'
          and c.confrelid = 'public.aliados'::regclass) = 2,
  'aliados debe tener exactamente dos FK hacia clients y dos hacia sí misma: la simple y la compuesta');

-- ── 7. Comportamiento de las dos FK ─────────────────────────────────────────
-- El padre: lo legítimo se acepta.
select pg_temp.assert_true(
  public.aliado_prefix_chain('bbbbbbbb-0000-0000-0000-000000000002') = 'HR-SH',
  'La cadena legítima HR-SH se rompió con 0451');
select pg_temp.assert_true(pg_temp.outcome($q$
  update public.aliados set parent_aliado_id = 'bbbbbbbb-0000-0000-0000-000000000001'
   where id = 'bbbbbbbb-0000-0000-0000-000000000004'$q$) = 'ok',
  'Colgar NB de HR, los dos de T1, quedó bloqueado');
select pg_temp.assert_true(pg_temp.outcome($q$
  update public.aliados set parent_aliado_id = null
   where id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$) = 'ok',
  'Volver a raíz (parent_aliado_id NULL) quedó bloqueado: MATCH SIMPLE no se respetó');
select pg_temp.assert_true(pg_temp.outcome($q$
  insert into public.aliados (tenant_id, client_id, parent_aliado_id, prefix, trade_name)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-0000000000b1',
          'bbbbbbbb-0000-0000-0000-000000000001', 'YY', 'Otro sub de HR')$q$) = 'ok',
  'Dar de alta un sub-aliado del mismo tenant quedó bloqueado');

-- El padre: el cruce se frena.
select pg_temp.assert_true(pg_temp.outcome_fk($q$
  update public.aliados set parent_aliado_id = 'bbbbbbbb-0000-0000-0000-000000000005'
   where id = 'bbbbbbbb-0000-0000-0000-000000000003'$q$) = '23503:aliados_parent_mismo_tenant_fkey',
  'Colgar AG (T1) de DC (T2) no lo frenó la FK compuesta del padre');
select pg_temp.assert_true(pg_temp.outcome_fk($q$
  insert into public.aliados (tenant_id, client_id, parent_aliado_id, prefix, trade_name)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-0000000000b1',
          'bbbbbbbb-0000-0000-0000-000000000005', 'YY', 'Sub del aliado ajeno')$q$)
  = '23503:aliados_parent_mismo_tenant_fkey',
  'Dar de alta un sub-aliado de T1 bajo el aliado de T2 no lo frenó la FK compuesta del padre');
select pg_temp.assert_true(pg_temp.outcome_fk($q$
  update public.aliados set deleted_at = now(),
         parent_aliado_id = 'bbbbbbbb-0000-0000-0000-000000000005'
   where id = 'bbbbbbbb-0000-0000-0000-000000000003'$q$)
  = '23503:aliados_parent_mismo_tenant_fkey',
  'Un aliado borrado lógicamente pudo colgar del aliado de otro tenant');
-- Mover de tenant una punta de la cadena. El aliado que se mueve arrastra a su
-- cliente-ancla en la MISMA sentencia (un CTE que modifica datos): así la FK del
-- ancla queda satisfecha y la única violación que sobrevive es la de la cadena,
-- que es la que se quiere medir. Sin eso Postgres reporta la primera FK que
-- dispara, no la del padre. Las FK sin DEFERRABLE se revisan al terminar la
-- sentencia entera, no a mitad del CTE. NB no tiene clientes ni lista.
select pg_temp.assert_true(pg_temp.outcome_fk($q$
  update public.aliados set parent_aliado_id = 'bbbbbbbb-0000-0000-0000-000000000001'
   where id = 'bbbbbbbb-0000-0000-0000-000000000004';
  with ancla as (
    update public.clients set tenant_id = 'aaaaaaaa-0000-0000-0000-000000000002'
     where id = 'cccccccc-0000-0000-0000-0000000000a4' returning id)
  update public.aliados set tenant_id = 'aaaaaaaa-0000-0000-0000-000000000002'
   where id = 'bbbbbbbb-0000-0000-0000-000000000004'$q$)
  = '23503:aliados_parent_mismo_tenant_fkey',
  'Mover de tenant al sub-aliado NB (con su ancla) sin soltar a su padre HR no lo frenó la FK compuesta del padre');
select pg_temp.assert_true(pg_temp.outcome_fk($q$
  update public.aliados set parent_aliado_id = 'bbbbbbbb-0000-0000-0000-000000000004'
   where id = 'bbbbbbbb-0000-0000-0000-000000000003';
  with ancla as (
    update public.clients set tenant_id = 'aaaaaaaa-0000-0000-0000-000000000002'
     where id = 'cccccccc-0000-0000-0000-0000000000a4' returning id)
  update public.aliados set tenant_id = 'aaaaaaaa-0000-0000-0000-000000000002'
   where id = 'bbbbbbbb-0000-0000-0000-000000000004'$q$)
  = '23503:aliados_parent_mismo_tenant_fkey',
  'Mover de tenant al aliado padre NB (con su ancla) mientras AG cuelga de él no lo frenó la FK compuesta del padre');

-- El cliente-ancla: lo legítimo se acepta y el cruce se frena.
select pg_temp.assert_true(pg_temp.outcome($q$
  insert into public.aliados (tenant_id, client_id, prefix, trade_name)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-0000000000b1',
          'ZZ', 'Ancla del mismo tenant')$q$) = 'ok',
  'Dar de alta un aliado con un cliente-ancla de su mismo tenant quedó bloqueado');
select pg_temp.assert_true(pg_temp.outcome_fk($q$
  insert into public.aliados (tenant_id, client_id, prefix, trade_name)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-0000000000b2',
          'XX', 'Ancla Ajena')$q$) = '23503:aliados_client_mismo_tenant_fkey',
  'Dar de alta un aliado de T1 con un cliente-ancla de T2 no lo frenó la FK compuesta del ancla');
select pg_temp.assert_true(pg_temp.outcome_fk($q$
  update public.aliados set client_id = 'cccccccc-0000-0000-0000-0000000000b2'
   where id = 'bbbbbbbb-0000-0000-0000-000000000004'$q$)
  = '23503:aliados_client_mismo_tenant_fkey',
  'Reapuntar el cliente-ancla de NB (T1) a un cliente de T2 no lo frenó la FK compuesta del ancla');
select pg_temp.assert_true(pg_temp.outcome_fk($q$
  update public.aliados set tenant_id = 'aaaaaaaa-0000-0000-0000-000000000002'
   where id = 'bbbbbbbb-0000-0000-0000-000000000004'$q$)
  = '23503:aliados_client_mismo_tenant_fkey',
  'Mover de tenant a NB, sin soltar su cliente-ancla, no lo frenó la FK compuesta del ancla');
select pg_temp.assert_true(pg_temp.outcome_fk($q$
  update public.clients set tenant_id = 'aaaaaaaa-0000-0000-0000-000000000002'
   where id = 'cccccccc-0000-0000-0000-0000000000a4'$q$)
  = '23503:aliados_client_mismo_tenant_fkey',
  'Mover de tenant al cliente-ancla de NB no lo frenó la FK compuesta del ancla');

-- ── 8. La RPC de marca filtra el tenant por su cuenta ───────────────────────
select pg_temp.assert_true(
  pg_catalog.pg_get_functiondef('public.get_portal_brand()'::regprocedure)
    ~* 'a\.tenant_id\s*=\s*c\.tenant_id',
  'get_portal_brand() quedó sin el filtro explícito de tenant');

-- Contra la 0401: el cuerpo nuevo, sin la línea del filtro, es el de la 0401
-- (encabezado incluido: firma, SECURITY DEFINER, search_path vacío, STABLE), y el
-- ACL es el mismo. Sólo authenticated ejecuta la RPC.
select pg_temp.assert_true(
  replace(replace(pg_catalog.pg_get_functiondef('public.get_portal_brand()'::regprocedure), E'\r', ''),
          E'\n   and a.tenant_id = c.tenant_id', '')
    = replace((select def from rpc_0401), E'\r', ''),
  'get_portal_brand() cambió algo más que el filtro de tenant respecto de la 0401');
select pg_temp.assert_true(
  (select p.proacl::text from pg_catalog.pg_proc p
    where p.oid = 'public.get_portal_brand()'::regprocedure) = (select acl from rpc_0401),
  'Los grants de get_portal_brand() ya no son los de la 0401');
select pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.get_portal_brand()', 'execute')
  and not has_function_privilege('anon', 'public.get_portal_brand()', 'execute')
  and not has_function_privilege('service_role', 'public.get_portal_brand()', 'execute'),
  'get_portal_brand() quedó ejecutable por anon o service_role, o dejó de serlo para authenticated');

savepoint marca_verde;
alter table public.clients drop constraint clients_aliado_mismo_tenant_fkey;
update public.clients
   set aliado_id = 'bbbbbbbb-0000-0000-0000-000000000005'
 where id = 'cccccccc-0000-0000-0000-0000000000b1';

set local role authenticated;
set local "request.jwt.claim.sub" = '0000dddd-0000-0000-0000-000000000002';
do $marca_cruzada$
begin
  if exists (select 1 from public.get_portal_brand()) then
    raise exception 'TEST 0451: la RPC entregó marca de otro tenant aun con el filtro';
  end if;
end;
$marca_cruzada$;
set local "request.jwt.claim.sub" = '0000dddd-0000-0000-0000-000000000001';
do $marca_propia$
declare v_marcas text[];
begin
  select pg_catalog.array_agg(brand_name) into v_marcas from public.get_portal_brand();
  if v_marcas is distinct from array['Marca HR']::text[] then
    raise exception 'TEST 0451: el cliente de HR dejó de recibir su propia marca: %', v_marcas;
  end if;
end;
$marca_propia$;
reset role;
rollback to savepoint marca_verde;
release savepoint marca_verde;

-- ── 9. `resolve_price_book` no cambió para lo legítimo ──────────────────────
select pg_temp.assert_true(
  pg_temp.lista_de('cccccccc-0000-0000-0000-0000000000c2') = 'Lista de Herneka',
  'El cliente del sub-aliado SH dejó de heredar la lista del raíz HR');
select pg_temp.assert_true(
  pg_temp.lista_de('cccccccc-0000-0000-0000-0000000000c1') = 'Lista de Herneka',
  'El cliente de HR dejó de cotizar con la lista de su aliado');
select pg_temp.assert_true(
  pg_temp.lista_de('cccccccc-0000-0000-0000-0000000000c3') = 'Tarifa DTD Cargo',
  'El cliente de AG dejó de caer en la lista de la casa');
select pg_temp.assert_true(
  pg_temp.lista_de('cccccccc-0000-0000-0000-0000000000b1') = 'Tarifa DTD Cargo',
  'El cliente directo de T1 dejó de cotizar con la lista de la casa');
select pg_temp.assert_true(
  pg_temp.tenant_de_lista('cccccccc-0000-0000-0000-0000000000c4')
    = 'aaaaaaaa-0000-0000-0000-000000000002',
  'El cliente de DC dejó de cotizar dentro de su propio tenant');

-- ── 10. Borrados DESPUÉS de 0451: iguales que antes ────────────────────────
create temporary table borrados_despues as select pg_temp.borrados() as resultado;

select pg_temp.assert_true(
  (select resultado from borrados_antes) = (select resultado from borrados_despues),
  format('Borrar cambió de comportamiento con 0451: antes %s, después %s',
    (select resultado from borrados_antes), (select resultado from borrados_despues)));

select a.resultado as borrados_antes_0451, d.resultado as borrados_despues_0451
  from borrados_antes a cross join borrados_despues d;

rollback;

select to_regclass('public.clients') is null as aliados_cadena_0451_fixture_rolled_back;
