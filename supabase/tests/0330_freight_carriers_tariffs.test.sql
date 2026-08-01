\set ON_ERROR_STOP on

-- ─────────────────────────────────────────────────────────────
-- Prueba contractual autocontenida de 0330 (SDD-0236).
-- Corre sobre una base PostgreSQL desechable y vacía. Fixture, migración y
-- datos viven dentro de la transacción y termina siempre en ROLLBACK.
--
-- Lo que congela, en orden de importancia:
--   C1 · La web pública NUNCA ve el costo ni quién es el transportista.
--   C2 · La RPC devuelve SÓLO el proveedor predeterminado.
--   C3 · UN solo predeterminado vivo por tenant.
--   C4 · Una tarifa no puede apuntar a un transportista de otro tenant.
--   C5 · Aislamiento multi-tenant real en lectura y escritura.
--   C6 · anon no puede leer las tablas directo; sólo por la RPC.
--
-- PRUEBAS DE MUTACIÓN (hacer a mano sobre 0330_freight_carriers_tariffs.sql;
-- cada una tiene que poner ESTE archivo en rojo — si no, el test es decorado):
--   · agregar `ct.cost_usd_cbm` al returns/select de la RPC        → C1
--   · quitar `and fc.is_default` del where de la RPC               → C2
--   · quitar el índice freight_carriers_one_default_per_tenant     → C3
--   · cambiar el FK compuesto por `references freight_carriers(id)` → C4
--   · quitar `enable row level security` de carrier_tariffs        → C5
--   · agregar `grant select on carrier_tariffs to anon`            → C6
-- ─────────────────────────────────────────────────────────────

begin;

do $fixture_guard$
begin
  if to_regclass('public.freight_carriers') is not null
     or to_regclass('public.carrier_tariffs') is not null then
    raise exception 'Fixture 0330 rechazada: los objetos reales ya existen';
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

-- Las policies de la migración consultan user_tenants; en el esquema real
-- authenticated tiene SELECT sobre ella. El fixture lo espeja.
grant select on public.tenants      to authenticated, anon;
grant select on public.user_tenants to authenticated;

-- Stubs de las funciones que la migración da por existentes.
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

\ir ../migrations/0330_freight_carriers_tariffs.sql

-- ═════════════════════════════════════════════════════════════
-- Fixture: dos tenants, dos transportistas, tarifas en ambos
-- ═════════════════════════════════════════════════════════════

insert into auth.users (id) values
  ('aa000000-0000-4000-8000-000000000001'),
  ('bb000000-0000-4000-8000-000000000002');

insert into public.tenants (id, slug) values
  ('11110000-0000-4000-8000-00000000000a', 'dtd'),
  ('22220000-0000-4000-8000-00000000000b', 'otro-tenant');

insert into public.user_tenants (user_id, tenant_id, role) values
  ('aa000000-0000-4000-8000-000000000001', '11110000-0000-4000-8000-00000000000a', 'admin'),
  ('bb000000-0000-4000-8000-000000000002', '22220000-0000-4000-8000-00000000000b', 'admin');

-- Tenant dtd: Benito (predeterminado) y otro que NO lo es.
insert into public.freight_carriers (id, tenant_id, name, legal_name, tax_id, is_default) values
  ('cc000000-0000-4000-8000-0000000000b1', '11110000-0000-4000-8000-00000000000a',
   'Benito', 'BENITO TRANSPORTE EXPRESS, C.A', 'J-50266334-7', true),
  ('cc000000-0000-4000-8000-0000000000a2', '11110000-0000-4000-8000-00000000000a',
   'GAG', 'TRANSPORTES GAG', null, false);

-- Tenant ajeno: su propio transportista, también predeterminado (legítimo:
-- el índice único es POR tenant).
insert into public.freight_carriers (id, tenant_id, name, is_default) values
  ('dd000000-0000-4000-8000-0000000000c3', '22220000-0000-4000-8000-00000000000b',
   'Transportista del otro tenant', true);

insert into public.carrier_tariffs
  (tenant_id, carrier_id, city_slug, cost_usd_cbm, price_usd_cbm, dispatch_frequency_days, transit_days)
values
  -- Benito (el predeterminado del tenant dtd)
  ('11110000-0000-4000-8000-00000000000a', 'cc000000-0000-4000-8000-0000000000b1',
   'puerto-ordaz', 80.00, 123.60, 7, '24 a 48 horas'),
  ('11110000-0000-4000-8000-00000000000a', 'cc000000-0000-4000-8000-0000000000b1',
   'guasipati', 80.00, 176.57, 15, '24 a 72 horas'),
  -- GAG (NO predeterminado): su precio no puede salir por la RPC pública
  ('11110000-0000-4000-8000-00000000000a', 'cc000000-0000-4000-8000-0000000000a2',
   'puerto-ordaz', 90.00, 999.99, 7, 'otro'),
  -- El tenant ajeno
  ('22220000-0000-4000-8000-00000000000b', 'dd000000-0000-4000-8000-0000000000c3',
   'maracaibo', 50.00, 111.11, 7, 'ajeno');

-- ═════════════════════════════════════════════════════════════
-- C1 · La RPC pública NO expone el costo ni la identidad del proveedor
-- ═════════════════════════════════════════════════════════════

do $c1$
declare
  v_cols text;
begin
  select string_agg(p.proargnames[i], ',')
    into v_cols
  from pg_proc p,
       lateral generate_subscripts(p.proargnames, 1) i
  where p.proname = 'public_carrier_tariffs'
    and p.pronamespace = 'public'::regnamespace;

  if v_cols ilike '%cost%' then
    raise exception 'C1: la RPC pública expone el COSTO del transportista (%)', v_cols;
  end if;
  if v_cols ilike '%carrier%' or v_cols ilike '%name%' or v_cols ilike '%tax%' then
    raise exception 'C1: la RPC pública expone la identidad del transportista (%)', v_cols;
  end if;
end
$c1$;

-- ═════════════════════════════════════════════════════════════
-- C2 · Devuelve SÓLO el predeterminado, y sólo lo vigente
-- ═════════════════════════════════════════════════════════════

do $c2$
declare
  v_filas   int;
  v_precio  numeric;
  v_intruso int;
begin
  select count(*) into v_filas from public.public_carrier_tariffs();
  if v_filas <> 2 then
    raise exception 'C2: la RPC devolvió % fila(s); se esperaban 2 (sólo las de Benito)', v_filas;
  end if;

  select price_usd_cbm into v_precio
    from public.public_carrier_tariffs() where city_slug = 'puerto-ordaz';
  if v_precio <> 123.60 then
    raise exception 'C2: Puerto Ordaz devolvió % — no es el precio del predeterminado', v_precio;
  end if;

  -- El precio de GAG (999.99) NO puede aparecer nunca.
  select count(*) into v_intruso
    from public.public_carrier_tariffs() where price_usd_cbm = 999.99;
  if v_intruso <> 0 then
    raise exception 'C2: se filtró la tarifa de un transportista NO predeterminado';
  end if;

  -- Ni las de otro tenant.
  select count(*) into v_intruso
    from public.public_carrier_tariffs() where city_slug = 'maracaibo';
  if v_intruso <> 0 then
    raise exception 'C2: se filtró la tarifa de OTRO tenant';
  end if;
end
$c2$;

-- Una tarifa vencida deja de salir.
do $c2b$
declare
  v_filas int;
begin
  update public.carrier_tariffs set valid_to = current_date - 1
   where city_slug = 'guasipati';
  select count(*) into v_filas from public.public_carrier_tariffs();
  if v_filas <> 1 then
    raise exception 'C2b: una tarifa VENCIDA sigue saliendo por la RPC (% filas)', v_filas;
  end if;
  update public.carrier_tariffs set valid_to = null where city_slug = 'guasipati';
end
$c2b$;

-- ═════════════════════════════════════════════════════════════
-- C3 · UN solo predeterminado vivo por tenant
-- ═════════════════════════════════════════════════════════════

do $c3$
begin
  begin
    update public.freight_carriers set is_default = true
     where id = 'cc000000-0000-4000-8000-0000000000a2';
    raise exception 'C3: el tenant quedó con DOS transportistas predeterminados';
  exception
    when unique_violation then null;   -- lo correcto
  end;

  -- Pero el borrado en blando sí libera el puesto.
  update public.freight_carriers set deleted_at = now()
   where id = 'cc000000-0000-4000-8000-0000000000b1';
  update public.freight_carriers set is_default = true
   where id = 'cc000000-0000-4000-8000-0000000000a2';
  -- Y lo devolvemos como estaba.
  update public.freight_carriers set is_default = false
   where id = 'cc000000-0000-4000-8000-0000000000a2';
  update public.freight_carriers set deleted_at = null
   where id = 'cc000000-0000-4000-8000-0000000000b1';
end
$c3$;

-- ═════════════════════════════════════════════════════════════
-- C4 · Una tarifa no puede colgar de un transportista de otro tenant
-- ═════════════════════════════════════════════════════════════

do $c4$
begin
  begin
    insert into public.carrier_tariffs
      (tenant_id, carrier_id, city_slug, cost_usd_cbm, price_usd_cbm)
    values
      ('11110000-0000-4000-8000-00000000000a',      -- tenant dtd…
       'dd000000-0000-4000-8000-0000000000c3',      -- …transportista del OTRO
       'colado', 1, 1);
    raise exception 'C4: se creó una tarifa apuntando a un transportista de otro tenant';
  exception
    when foreign_key_violation then null;   -- lo correcto
  end;
end
$c4$;

-- ═════════════════════════════════════════════════════════════
-- C5 · Aislamiento multi-tenant real (lectura y escritura)
-- ═════════════════════════════════════════════════════════════

set local role authenticated;
select set_config('test.uid', 'aa000000-0000-4000-8000-000000000001', true);

do $c5$
declare
  v_propios int;
  v_ajenos  int;
  v_tocadas int;
begin
  select count(*) into v_propios from public.freight_carriers;
  if v_propios <> 2 then
    raise exception 'C5: el tenant dtd ve % transportistas propios; esperaba 2', v_propios;
  end if;

  select count(*) into v_ajenos from public.freight_carriers
   where tenant_id = '22220000-0000-4000-8000-00000000000b';
  if v_ajenos <> 0 then
    raise exception 'C5: el tenant dtd LEE % transportista(s) ajeno(s)', v_ajenos;
  end if;

  select count(*) into v_ajenos from public.carrier_tariffs
   where tenant_id = '22220000-0000-4000-8000-00000000000b';
  if v_ajenos <> 0 then
    raise exception 'C5: el tenant dtd LEE % tarifa(s) ajena(s) — se filtra el COSTO de otro', v_ajenos;
  end if;

  update public.carrier_tariffs set price_usd_cbm = 1
   where tenant_id = '22220000-0000-4000-8000-00000000000b';
  get diagnostics v_tocadas = row_count;
  if v_tocadas <> 0 then
    raise exception 'C5: el tenant dtd MODIFICÓ % tarifa(s) ajena(s)', v_tocadas;
  end if;
end
$c5$;

reset role;

-- ═════════════════════════════════════════════════════════════
-- C6 · anon no toca las tablas: sólo la RPC
-- ═════════════════════════════════════════════════════════════

do $c6$
begin
  if has_table_privilege('anon', 'public.freight_carriers', 'SELECT') then
    raise exception 'C6: anon puede leer freight_carriers directo';
  end if;
  if has_table_privilege('anon', 'public.carrier_tariffs', 'SELECT') then
    raise exception 'C6: anon puede leer carrier_tariffs directo — vería el COSTO';
  end if;
  if not has_function_privilege('anon', 'public.public_carrier_tariffs(uuid)', 'EXECUTE') then
    raise exception 'C6: anon no puede ejecutar la RPC pública';
  end if;
end
$c6$;

rollback;

select '0330 freight_carriers + carrier_tariffs: contrato verificado' as resultado;
