\set ON_ERROR_STOP on

-- ─────────────────────────────────────────────────────────────
-- Prueba contractual autocontenida de 0332 (SDD-0237).
-- Corre sobre una base PostgreSQL desechable y vacía. Fixture, migraciones y
-- datos viven dentro de la transacción y termina siempre en ROLLBACK.
--
-- QUÉ CONGELA ESTE ARCHIVO, Y POR QUÉ ES DISTINTO DEL DE 0330. El test de 0330
-- congela el ESQUEMA (RLS, aislamiento, que la RPC no filtre el costo). Éste
-- congela el DATO SEMBRADO: son invariantes de negocio que, si se rompen, no
-- tiran ningún error — simplemente le cobran mal al cliente en silencio.
--
--   S1 · Con datos reales cargados, la RPC pública sigue sin soltar el costo.
--   S2 · Las 8 ciudades de la zona sin costo quedan con casco = true.
--        Si una se voltea, el cliente empieza a pagar entrega en Valencia.
--   S3 · La opción agrupada `casco-central` queda soft-borrada.
--   S4 · Las 9 sin cobertura existen como ciudad pero NO tienen tarifa →
--        la calculadora deriva al asesor en vez de inventar un precio.
--   S5 · La migración es idempotente: correrla dos veces no duplica nada.
--   S6 · Los precios de venta son exactamente los tres del acuerdo, y ninguna
--        tarifa vende por debajo de lo que nos cuesta.
--   S7 · Ningún slug que ya vivía en producción desapareció (los usan las
--        direcciones de clientes, lib/geo-zonas.ts y el portal).
--
-- PRUEBAS DE MUTACIÓN sobre 0332_seed_tarifario_benito.sql. Corridas el
-- 1-ago-2026: **6/6 cazadas**. Cada una tiene que poner ESTE archivo en rojo —
-- si alguna sobrevive, el test es decorado y hay que endurecerlo.
--   · poner `false` en el casco de 'valencia'                           → S2
--   · apuntar el UPDATE de soft-delete a un slug que no existe          → S3
--   · renombrar la tarifa de 'abejales' a 'guiria' (sin cobertura)      → S4
--   · cambiar el `on conflict` de carrier_tariffs por `do nothing`      → S5
--   · poner 95.00 en vez de 105.94 en el primer destino Centro          → S6
--   · borrar la fila de 'puerto-ordaz' de la lista de ciudades          → S7
--
-- ⚠️ Para S7 NO sirve borrar 'maracaibo': el fixture de abajo ya la inserta
-- antes de correr la migración (a propósito, para probar que el `km` viejo no
-- se pisa), así que la mutación sobreviviría. Usa un slug que sólo aparezca en
-- la migración.
-- ─────────────────────────────────────────────────────────────

begin;

do $fixture_guard$
begin
  if to_regclass('public.freight_carriers') is not null
     or to_regclass('public.calculator_cities') is not null then
    raise exception 'Fixture 0332 rechazada: los objetos reales ya existen';
  end if;
end
$fixture_guard$;

create extension if not exists pgcrypto;
create schema if not exists auth;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$roles$;

create table auth.users (id uuid primary key);

create table public.tenants (
  id   uuid primary key,
  slug text not null unique
);

create table public.user_tenants (
  user_id     uuid not null references auth.users(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  role        text not null,
  disabled_at timestamptz,
  primary key (user_id, tenant_id)
);

grant select on public.tenants      to authenticated, anon;
grant select on public.user_tenants to authenticated;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid;
$$;

create or replace function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select ut.tenant_id from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null
   limit 1;
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Stub de calculator_cities, copiado literal de 0104. No se hace `\ir` de esa
-- migración porque arrastra el Slice C (rates.status) y con él media cadena de
-- dependencias. Lo que este test verifica es el DATO que 0332 siembra, no el
-- esquema de 0104 — que ya tiene su propio contrato. Si 0104 cambia la forma de
-- la tabla o el índice parcial, el `on conflict` de 0332 revienta acá.
create table public.calculator_cities (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  slug        text not null,
  label       text not null,
  km          numeric(10,1) not null default 0,
  casco       boolean not null default false,
  sort_order  int not null default 0,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint calculator_cities_km_nonneg check (km >= 0),
  constraint calculator_cities_slug_nonempty check (length(trim(slug)) > 0)
);

create unique index calculator_cities_tenant_slug_alive
  on public.calculator_cities (tenant_id, slug)
  where deleted_at is null;

\ir ../migrations/0330_freight_carriers_tariffs.sql

-- ═════════════════════════════════════════════════════════════
-- Fixture mínimo: el tenant dtd y un tenant ajeno
-- ═════════════════════════════════════════════════════════════

insert into public.tenants (id, slug) values
  ('11110000-0000-4000-8000-00000000000a', 'dtd'),
  ('22220000-0000-4000-8000-00000000000b', 'otro-tenant');

-- Ciudades que YA existían en producción antes de 0332, con su km real. La
-- migración tiene que respetarles el km (que sigue alimentando el copy de
-- geo-zonas) y sólo tocarles label/casco/sort_order.
insert into public.calculator_cities (tenant_id, slug, label, km, casco, sort_order) values
  ('11110000-0000-4000-8000-00000000000a', 'casco-central', 'Casco central (Valencia · Maracay · Caracas)', 0, true, 0),
  ('11110000-0000-4000-8000-00000000000a', 'valencia',      'Valencia (sede)', 0,   true,  1),
  ('11110000-0000-4000-8000-00000000000a', 'barquisimeto',  'Barquisimeto',    220, false, 4),
  ('11110000-0000-4000-8000-00000000000a', 'maracaibo',     'Maracaibo',       410, false, 5),
  ('11110000-0000-4000-8000-00000000000a', 'acarigua',      'Acarigua',        175, false, 14);

-- El tenant ajeno tiene su propia ciudad: 0332 no la puede tocar.
insert into public.calculator_cities (tenant_id, slug, label, km, casco, sort_order) values
  ('22220000-0000-4000-8000-00000000000b', 'valencia', 'Valencia del otro tenant', 0, false, 1);

\ir ../migrations/0332_seed_tarifario_benito.sql

-- ═════════════════════════════════════════════════════════════
-- S1 · Con datos reales, la RPC pública sigue sin soltar el costo
-- ═════════════════════════════════════════════════════════════

do $s1$
declare
  v_cols text[];
  v_filas int;
begin
  select array_agg(p.attname order by p.attnum) into v_cols
    from pg_proc pr
    cross join lateral unnest(pr.proallargtypes, pr.proargnames)
      with ordinality as p(atttypid, attname, attnum)
   where pr.proname = 'public_carrier_tariffs'
     and pr.pronamespace = 'public'::regnamespace;

  if v_cols && array['cost_usd_cbm'] then
    raise exception 'S1: la RPC pública expone el COSTO — %', v_cols;
  end if;

  select count(*) into v_filas from public.public_carrier_tariffs();
  if v_filas < 150 then
    raise exception 'S1: la RPC devolvió sólo % tarifas; la siembra no llegó', v_filas;
  end if;
end
$s1$;

-- ═════════════════════════════════════════════════════════════
-- S2 · Las 8 de la zona sin costo quedan en casco = true
-- ═════════════════════════════════════════════════════════════
-- Si una se voltea, el cliente empieza a pagar entrega donde el founder
-- decidió regalarla. No tira error: cobra de más, callado.

do $s2$
declare
  v_faltan text[];
begin
  select array_agg(s) into v_faltan
    from unnest(array[
      'valencia', 'naguanagua', 'san-diego', 'guacara',
      'maracay', 'caracas', 'barquisimeto', 'acarigua'
    ]) as s
   where not exists (
     select 1 from public.calculator_cities cc
      join public.tenants t on t.id = cc.tenant_id and t.slug = 'dtd'
     where cc.slug = s and cc.casco and cc.deleted_at is null
   );

  if v_faltan is not null then
    raise exception 'S2: estas ciudades de la zona sin costo NO están en casco: %', v_faltan;
  end if;
end
$s2$;

-- ═════════════════════════════════════════════════════════════
-- S3 · La opción agrupada muere
-- ═════════════════════════════════════════════════════════════

do $s3$
begin
  if exists (
    select 1 from public.calculator_cities cc
     join public.tenants t on t.id = cc.tenant_id and t.slug = 'dtd'
    where cc.slug = 'casco-central' and cc.deleted_at is null
  ) then
    raise exception 'S3: la opción agrupada casco-central sigue viva en el selector';
  end if;
end
$s3$;

-- ═════════════════════════════════════════════════════════════
-- S4 · Las sin cobertura existen como ciudad pero NO tienen tarifa
-- ═════════════════════════════════════════════════════════════
-- Tienen que aparecer en el selector (para poder decirle al cliente "no
-- llegamos, pero sí hasta X"), y NO pueden tener precio: una tarifa acá sería
-- cotizarle un viaje que nadie va a hacer.

do $s4$
declare
  v_sin_cobertura text[] := array[
    'cariaco', 'el-callao', 'el-manteco', 'el-dorado', 'km-88',
    'santa-elena-de-uairen', 'el-pilar', 'guiria', 'cumanacoa'
  ];
  v_ausentes text[];
  v_con_precio text[];
begin
  select array_agg(s) into v_ausentes
    from unnest(v_sin_cobertura) as s
   where not exists (
     select 1 from public.calculator_cities cc
      join public.tenants t on t.id = cc.tenant_id and t.slug = 'dtd'
     where cc.slug = s and cc.deleted_at is null
   );
  if v_ausentes is not null then
    raise exception 'S4: faltan en el selector, el cliente no puede ni escogerlas: %', v_ausentes;
  end if;

  select array_agg(city_slug) into v_con_precio
    from public.public_carrier_tariffs()
   where city_slug = any(v_sin_cobertura);
  if v_con_precio is not null then
    raise exception 'S4: hay precio para destinos SIN cobertura: %', v_con_precio;
  end if;
end
$s4$;

-- ═════════════════════════════════════════════════════════════
-- S6 · Los tres precios del acuerdo, y nunca vender bajo costo
-- ═════════════════════════════════════════════════════════════
-- Va antes de S5 porque S5 vuelve a correr la migración.

do $s6$
declare
  v_raros numeric[];
  v_bajo_costo int;
begin
  select array_agg(distinct price_usd_cbm) into v_raros
    from public.public_carrier_tariffs()
   where price_usd_cbm not in (105.94, 123.60, 176.57);
  if v_raros is not null then
    raise exception 'S6: precios de venta fuera del acuerdo: %', v_raros;
  end if;

  select count(*) into v_bajo_costo
    from public.carrier_tariffs
   where deleted_at is null and price_usd_cbm < cost_usd_cbm;
  if v_bajo_costo > 0 then
    raise exception 'S6: % tarifas venden por debajo del costo', v_bajo_costo;
  end if;
end
$s6$;

-- ═════════════════════════════════════════════════════════════
-- S7 · Ningún slug de producción desapareció
-- ═════════════════════════════════════════════════════════════
-- Las direcciones de clientes, lib/geo-zonas.ts y el portal guardan estos
-- slugs. Perder uno rompe direcciones ya guardadas, no sólo el selector.

do $s7$
declare
  v_perdidos text[];
begin
  select array_agg(s) into v_perdidos
    from unnest(array[
      'valencia', 'maracay', 'caracas', 'barquisimeto', 'maracaibo',
      'puerto-la-cruz', 'san-cristobal', 'merida', 'ciudad-bolivar',
      'puerto-ordaz', 'punto-fijo', 'coro', 'acarigua', 'valera',
      'san-fernando', 'cumana', 'maturin', 'margarita'
    ]) as s
   where not exists (
     select 1 from public.calculator_cities cc
      join public.tenants t on t.id = cc.tenant_id and t.slug = 'dtd'
     where cc.slug = s and cc.deleted_at is null
   );
  if v_perdidos is not null then
    raise exception 'S7: slugs de producción perdidos: %', v_perdidos;
  end if;

  -- El km de las que ya existían no se pisa: sigue alimentando el copy.
  if (select km from public.calculator_cities cc
       join public.tenants t on t.id = cc.tenant_id and t.slug = 'dtd'
      where cc.slug = 'maracaibo' and cc.deleted_at is null) <> 410 then
    raise exception 'S7: la migración pisó el km de una ciudad que ya existía';
  end if;

  -- El tenant ajeno queda intacto.
  if (select count(*) from public.calculator_cities cc
       join public.tenants t on t.id = cc.tenant_id and t.slug = 'otro-tenant') <> 1 then
    raise exception 'S7: la siembra se derramó al otro tenant';
  end if;
end
$s7$;

-- ═════════════════════════════════════════════════════════════
-- S5 · Idempotencia: correrla otra vez no duplica nada
-- ═════════════════════════════════════════════════════════════

do $s5_antes$
begin
  create temp table conteo_antes as
  select
    (select count(*) from public.freight_carriers where deleted_at is null)  as carriers,
    (select count(*) from public.carrier_tariffs   where deleted_at is null) as tarifas,
    (select count(*) from public.calculator_cities where deleted_at is null) as ciudades;
end
$s5_antes$;

\ir ../migrations/0332_seed_tarifario_benito.sql

do $s5$
declare
  a record;
  d record;
begin
  select * into a from conteo_antes;
  select
    (select count(*) from public.freight_carriers where deleted_at is null)  as carriers,
    (select count(*) from public.carrier_tariffs   where deleted_at is null) as tarifas,
    (select count(*) from public.calculator_cities where deleted_at is null) as ciudades
  into d;

  if a.carriers <> d.carriers then
    raise exception 'S5: la 2.ª corrida duplicó transportistas (% → %)', a.carriers, d.carriers;
  end if;
  if a.tarifas <> d.tarifas then
    raise exception 'S5: la 2.ª corrida duplicó tarifas (% → %)', a.tarifas, d.tarifas;
  end if;
  if a.ciudades <> d.ciudades then
    raise exception 'S5: la 2.ª corrida duplicó ciudades (% → %)', a.ciudades, d.ciudades;
  end if;
end
$s5$;

rollback;

select '0332 siembra del tarifario de Benito: contrato verificado' as resultado;
