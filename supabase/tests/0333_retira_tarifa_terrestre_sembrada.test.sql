\set ON_ERROR_STOP on

-- ─────────────────────────────────────────────────────────────
-- Prueba contractual autocontenida de 0333 (SDD-0237).
-- Corre sobre una base PostgreSQL desechable y vacía. Fixture, migraciones y
-- datos viven dentro de la transacción y termina siempre en ROLLBACK.
--
-- QUÉ CONGELA. Un soft-delete dirigido es fácil de escribir de más: un WHERE
-- flojo barre tarifas que sí valen, y nadie se entera hasta que un asesor no
-- encuentra un precio. Este archivo fija el ALCANCE, no el efecto.
--
--   S1 · La fila sembrada por 0005 queda soft-borrada.
--   S2 · Las otras cinco tarifas de 0005 siguen VIVAS.
--   S3 · Sólo se borra UNA fila: ninguna vecina cae de arrastre.
--   S4 · La misma fila en OTRO tenant no se toca — el WHERE clava slug 'dtd'.
--   S5 · Idempotente: correrla dos veces no repisa el `deleted_at` original.
--
-- Se hace `\ir` de la 0005 REAL en vez de copiar el seed: si alguien cambia esa
-- fila sembrada, este test tiene que enterarse.
--
-- ⚠️ LECCIÓN DEL PRIMER INTENTO. La versión inicial de este archivo daba VERDE
-- con tres mutaciones vivas. El motivo: el filtro por `notes` identifica la
-- fila él solo, así que quitar `service`, `origin`, `destination` o
-- `flat_rate` no cambiaba a quién acertaba el UPDATE. El fixture de abajo
-- agrega cuatro filas que difieren en UN SOLO campo cada una — son las que
-- convierten esas guardas en verificables.
--
-- PRUEBAS DE MUTACIÓN sobre 0333_retira_tarifa_terrestre_sembrada.sql.
-- Corridas el 1-ago-2026: **6/6 cazadas**. Cada una tiene que poner ESTE
-- archivo en rojo — si alguna sobrevive, el test es decorado.
--   · quitar `and t.slug = 'dtd'`                → S3
--   · quitar `and r.deleted_at is null`          → S5
--   · quitar `and r.flat_rate = 650.00`          → S3
--   · quitar `and r.destination = 'Maracaibo'`   → S3
--   · quitar `and r.origin = 'Valencia'`         → S1
--   · quitar `and r.service = ...terrestre`      → S3
--
-- El que caza casi todo es S3 (el conteo), y eso es a propósito: da igual QUÉ
-- guarda se afloje, el efecto siempre es el mismo —barrer de más— y el conteo
-- lo ve sin tener que anticipar cuál se cayó. S1 y S5 cubren los dos fallos
-- que el conteo no vería: no borrar nada, y repisar la fecha.
-- ─────────────────────────────────────────────────────────────

begin;

do $fixture_guard$
begin
  if to_regclass('public.rates') is not null then
    raise exception 'Fixture 0333 rechazada: la tabla real ya existe';
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

-- El enum vive en 0002, que arrastra media cadena de envíos. Acá sólo importan
-- los cuatro valores del producto comercial.
create type shipment_service as enum (
  'consolidacion',
  'puerta_a_puerta_DDP',
  'reserva_FCL',
  'transporte_terrestre'
);

-- ═════════════════════════════════════════════════════════════
-- Los dos tenants ANTES de 0005: su seed inserta por cada tenant que
-- tenga slug 'dtd', así que el ajeno tiene que existir para probar S5.
-- ═════════════════════════════════════════════════════════════

insert into public.tenants (id, slug) values
  ('11110000-0000-4000-8000-00000000000a', 'dtd'),
  ('22220000-0000-4000-8000-00000000000b', 'otro-tenant');

\ir ../migrations/0005_rates.sql

-- El tenant ajeno con la MISMA fila, cargada a mano: 0005 sólo siembra 'dtd'.
insert into public.rates
  (tenant_id, service, origin, destination, flat_rate, transit_days, valid_until, notes)
values
  ('22220000-0000-4000-8000-00000000000b', 'transporte_terrestre',
   'Valencia', 'Maracaibo', 650.00, 2, '2026-12-31'::date,
   'Camión chico Valencia-Maracaibo');

-- Tarifas del tenant dtd que NO se pueden tocar.
--
-- Las cuatro últimas son deliberadamente sintéticas: cada una difiere de la
-- fila sembrada en UN SOLO campo y conserva su nota. Sin ellas el test no vale
-- nada, y lo comprobé: el filtro por `notes` identifica la fila él solo, así
-- que al quitar cualquier otra guarda el UPDATE seguía acertando y la mutación
-- SOBREVIVÍA. Estas filas son las que obligan a cada guarda a cargar peso.
insert into public.rates
  (tenant_id, service, origin, destination, flat_rate, transit_days, valid_until, notes)
values
  -- Ruta distinta y nota distinta: el caso realista.
  ('11110000-0000-4000-8000-00000000000a', 'transporte_terrestre',
   'Valencia', 'Barquisimeto', 300.00, 1, '2027-12-31'::date, 'Ruta distinta'),
  -- Misma ruta, precio verificado distinto: camión dedicado cargado después.
  ('11110000-0000-4000-8000-00000000000a', 'transporte_terrestre',
   'Valencia', 'Maracaibo', 420.00, 2, '2027-12-31'::date, 'Camión dedicado verificado'),
  -- Difiere SOLO en el precio → hace cargar peso a `flat_rate = 650.00`.
  ('11110000-0000-4000-8000-00000000000a', 'transporte_terrestre',
   'Valencia', 'Maracaibo', 500.00, 2, '2027-12-31'::date,
   'Camión chico Valencia-Maracaibo'),
  -- Difiere SOLO en el destino → hace cargar peso a `destination`.
  ('11110000-0000-4000-8000-00000000000a', 'transporte_terrestre',
   'Valencia', 'Valera', 650.00, 2, '2027-12-31'::date,
   'Camión chico Valencia-Maracaibo'),
  -- Difiere SOLO en el origen → hace cargar peso a `origin`.
  ('11110000-0000-4000-8000-00000000000a', 'transporte_terrestre',
   'Maracay', 'Maracaibo', 650.00, 2, '2027-12-31'::date,
   'Camión chico Valencia-Maracaibo'),
  -- Difiere SOLO en el servicio → hace cargar peso a `service`.
  ('11110000-0000-4000-8000-00000000000a', 'consolidacion',
   'Valencia', 'Maracaibo', 650.00, 2, '2027-12-31'::date,
   'Camión chico Valencia-Maracaibo');

\ir ../migrations/0333_retira_tarifa_terrestre_sembrada.sql

-- ═════════════════════════════════════════════════════════════
-- S1 · la fila sembrada queda soft-borrada
-- ═════════════════════════════════════════════════════════════
do $s1$
declare v_borradas int;
begin
  select count(*) into v_borradas
    from public.rates r
    join public.tenants t on t.id = r.tenant_id
   where t.slug = 'dtd'
     and r.service = 'transporte_terrestre'
     and r.destination = 'Maracaibo'
     and r.flat_rate = 650.00
     and r.deleted_at is not null;
  if v_borradas <> 1 then
    raise exception 'S1: se esperaba 1 fila soft-borrada, hay %', v_borradas;
  end if;
end
$s1$;

-- ═════════════════════════════════════════════════════════════
-- S2 · las otras cinco tarifas de 0005 siguen vivas
-- ═════════════════════════════════════════════════════════════
do $s2$
declare v_vivas int;
begin
  select count(*) into v_vivas
    from public.rates r
    join public.tenants t on t.id = r.tenant_id
   where t.slug = 'dtd'
     and r.deleted_at is null
     and r.notes in (
       'LCL DDP estándar Yiwu-Valencia',
       'LCL DDP Guangzhou-Valencia',
       'DDP prepago Yiwu-Caracas con last mile',
       'FCL 40 HC Guangzhou-La Guaira',
       'FCL 40 estándar Shenzhen-Puerto Cabello'
     );
  if v_vivas <> 5 then
    raise exception 'S2: el barrido se llevó tarifas de más — vivas %, esperadas 5', v_vivas;
  end if;
end
$s2$;

-- ═════════════════════════════════════════════════════════════
-- S3 · se borra UNA fila y nada más
--
-- Es la red que atrapa cualquier WHERE que se afloje: da igual qué guarda se
-- caiga, alguna de las filas-vecinas del fixture entra en el barrido y el
-- conteo deja de ser 1.
-- ═════════════════════════════════════════════════════════════
do $s3$
declare v_total int;
        v_sobrevivientes int;
begin
  select count(*) into v_total
    from public.rates where deleted_at is not null;
  if v_total <> 1 then
    raise exception
      'S3: el barrido tocó % filas, se esperaba exactamente 1 — el WHERE se aflojó', v_total;
  end if;

  -- Y las seis vecinas siguen enteras, dicho por su nombre para que el mensaje
  -- de error diga cuál se perdió.
  select count(*) into v_sobrevivientes
    from public.rates r
    join public.tenants t on t.id = r.tenant_id
   where r.deleted_at is null
     and (
       (t.slug = 'otro-tenant' and r.flat_rate = 650.00)
       or (t.slug = 'dtd' and r.notes = 'Ruta distinta')
       or (t.slug = 'dtd' and r.notes = 'Camión dedicado verificado')
       or (t.slug = 'dtd' and r.flat_rate = 500.00)
       or (t.slug = 'dtd' and r.destination = 'Valera')
       or (t.slug = 'dtd' and r.origin = 'Maracay')
       or (t.slug = 'dtd' and r.service = 'consolidacion'
           and r.notes = 'Camión chico Valencia-Maracaibo')
     );
  if v_sobrevivientes <> 7 then
    raise exception
      'S3: sobrevivieron % de las 7 filas vecinas — cayó alguna de arrastre', v_sobrevivientes;
  end if;
end
$s3$;

-- ═════════════════════════════════════════════════════════════
-- S4 · el tenant ajeno no se toca
-- ═════════════════════════════════════════════════════════════
do $s4$
begin
  if not exists (
    select 1 from public.rates r
     join public.tenants t on t.id = r.tenant_id
    where t.slug = 'otro-tenant'
      and r.flat_rate = 650.00
      and r.deleted_at is null
  ) then
    raise exception 'S4: el barrido cruzó la frontera de tenant';
  end if;
end
$s4$;

-- ═════════════════════════════════════════════════════════════
-- S5 · idempotente: la segunda corrida no repisa el deleted_at
-- ═════════════════════════════════════════════════════════════
-- Se marca la fila borrada con una fecha vieja y distinguible.
--
-- ⚠️ Se filtra por `deleted_at is not null`, NO por `flat_rate = 650`: el
-- fixture tiene cuatro filas con ese precio (las que hacen cargar peso a las
-- guardas), así que un SELECT por precio agarraría cualquiera de ellas. S3 ya
-- probó que la borrada es exactamente una.
--
-- La fecha se fuerza a 2020 porque `now()` devuelve el inicio de la
-- TRANSACCIÓN: dentro de este begin/rollback las dos corridas darían la misma
-- marca y la mutación sobreviviría sin que nadie lo note.
update public.rates
   set deleted_at = timestamptz '2020-01-01 00:00:00+00'
 where deleted_at is not null;

\ir ../migrations/0333_retira_tarifa_terrestre_sembrada.sql

do $s5$
declare v_deleted timestamptz;
        v_cuantas int;
begin
  select count(*) into v_cuantas from public.rates where deleted_at is not null;
  if v_cuantas <> 1 then
    raise exception 'S5: tras la segunda corrida hay % filas borradas, se esperaba 1', v_cuantas;
  end if;

  -- Si el WHERE perdiera `deleted_at is null`, la segunda corrida movería la
  -- fecha de borrado — y con ella la traza de cuándo se retiró de verdad.
  select deleted_at into v_deleted from public.rates where deleted_at is not null;
  if v_deleted <> timestamptz '2020-01-01 00:00:00+00' then
    raise exception
      'S5: la segunda corrida repisó el deleted_at (quedó %) — falta `deleted_at is null` en el WHERE',
      v_deleted;
  end if;
end
$s5$;

rollback;
