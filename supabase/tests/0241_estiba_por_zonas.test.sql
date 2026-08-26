\set ON_ERROR_STOP on

-- Contrato del sincronizador de cajas físicas (SDD-0152 · SDD-0310).
-- Fixtures ficticios y rollback: no toca prod.
--
-- ⚠️ SE CARGAN DOS MIGRACIONES, NO UNA
--
-- `sync_boxes_for_receipt` vive repartida: la **0240** la creó borrando las
-- cajas sobrantes **sin mirar si estaban estibadas** (en ese momento la estiba
-- no existía), y la **0241** la reescribió agregando el guard. Producción corre
-- la de 0241 — verificado el 2026-08-26 contra `pg_get_functiondef`.
--
-- Un contrato que cargara sólo la 0240 probaría el borrado sin guard y saldría
-- verde, sin decir nada de lo que hoy protege una caja con historia.
--
-- QUÉ SE PROTEGE
--
--   1. Una recepción materializa UNA FILA POR CAJA con código escaneable.
--   2. Subir el conteo crea sólo las que faltan — no duplica las que existen.
--   3. 🔴 Bajar el conteo NUNCA borra una caja YA ESTIBADA. Ese es el guard que
--      agregó la 0241: perder una caja con historia es perder dónde está la
--      mercancía de un cliente.
--   4. Bajar el conteo borra por seq DESCENDENTE (se va la última, no la
--      primera).
--   5. 🔴 El correlativo `DTD-B-NNNNNN` es por TENANT y no colisiona. Dos cajas
--      con el mismo código hacen ambiguo el escaneo en bodega.
--   6. Cambiar el dueño de una recepción huérfana propaga el markbox a sus
--      cajas.
--
-- Cada contrato se validó rompiéndolo a propósito.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

\ir _supabase-platform-stubs.sql

-- ── Esqueleto mínimo ──────────────────────────────────────────────────────
create table public.tenants (id uuid primary key, slug text);

create or replace function public.get_user_tenant_id()
returns uuid language sql stable as $gut$ select null::uuid $gut$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $touch$
begin
  new.updated_at := now();
  return new;
end;
$touch$;

-- Piezas que las dos migraciones dan por existentes. Fidelidad mínima: sólo
-- lo que necesitan para aplicar (la 0241 re-declara el CHECK de
-- entity_audit_log y referencia consolidations/operario_pins por FK).
create table public.entity_audit_log (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null
);

create table public.consolidations (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid
,
  deleted_at timestamptz
);

create table public.consolidation_items (
  id               uuid primary key default gen_random_uuid(),
  consolidation_id uuid,
  pieces           int
,
  deleted_at timestamptz
);

create table public.operario_pins (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid
,
  deleted_at timestamptz
);

-- La 0241 le agrega `zone_layout`; acá sólo hace falta que exista.
create table public.container_types (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid
,
  deleted_at timestamptz
);

create table public.warehouse_receipts_cn (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  boxes           int,
  client_markbox  text,
  client_name     text,
  total_cbm       numeric(12,3),
  total_weight_kg numeric(12,2),
  -- El backfill de la 0240 ordena por `received_at`.
  received_at     timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

\ir ../migrations/0240_warehouse_boxes.sql
\ir ../migrations/0241_estiba_por_zonas.sql

-- ── Fixtures ──────────────────────────────────────────────────────────────
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'
insert into public.tenants (id, slug) values (:'t1', 'dtd'), (:'t2', 'otro');

-- ── 1 · Una recepción materializa una fila por caja ───────────────────────
do $$
declare v_n int; v_codes int;
begin
  insert into public.warehouse_receipts_cn (id, tenant_id, boxes, client_markbox, client_name)
  values ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
          3, 'DTD-0001', 'Cliente Uno');

  select count(*), count(distinct code) into v_n, v_codes
  from public.warehouse_boxes
  where receipt_id = 'cccccccc-0000-0000-0000-000000000001' and deleted_at is null;

  if v_n <> 3 then
    raise exception 'CONTRATO 1 ROTO: 3 cajas declaradas produjeron % filas', v_n;
  end if;
  if v_codes <> 3 then
    raise exception 'CONTRATO 1 ROTO: los codigos no son unicos (% distintos de %)', v_codes, v_n;
  end if;
end;
$$;

-- ── 2 · Subir el conteo crea SOLO las que faltan ──────────────────────────
do $$
declare v_n int;
begin
  update public.warehouse_receipts_cn set boxes = 5
   where id = 'cccccccc-0000-0000-0000-000000000001';

  select count(*) into v_n from public.warehouse_boxes
  where receipt_id = 'cccccccc-0000-0000-0000-000000000001' and deleted_at is null;

  if v_n <> 5 then
    raise exception 'CONTRATO 2 ROTO: subir 3→5 dejo % cajas (deberia crear solo las 2 que faltan)', v_n;
  end if;
end;
$$;

-- ── 3 · 🔴 Bajar el conteo NO borra una caja YA ESTIBADA ──────────────────
--
-- Se estiba la caja de seq MÁS ALTO —justo la que el borrado elegiría primero—
-- y se baja el conteo. Sin el guard de la 0241, esa caja se perdería y con ella
-- el rastro de dónde está la mercancía del cliente.
do $$
declare v_box uuid; v_viva boolean; v_cons uuid;
begin
  select id into v_box from public.warehouse_boxes
  where receipt_id = 'cccccccc-0000-0000-0000-000000000001' and deleted_at is null
  order by seq desc limit 1;

  insert into public.consolidations (tenant_id)
  values ('11111111-1111-1111-1111-111111111111')
  returning id into v_cons;

  insert into public.consolidation_box_positions
    (tenant_id, consolidation_id, box_id, zx, zy, zz, seq)
  values ('11111111-1111-1111-1111-111111111111', v_cons, v_box, 0, 0, 0, 1);

  update public.warehouse_receipts_cn set boxes = 4
   where id = 'cccccccc-0000-0000-0000-000000000001';

  select (wb.deleted_at is null) into v_viva from public.warehouse_boxes wb where wb.id = v_box;
  if not v_viva then
    raise exception 'CONTRATO 3 ROTO: se borro una caja YA ESTIBADA — se pierde donde esta la mercancia';
  end if;
end;
$$;

-- ── 5 · 🔴 El correlativo no colisiona entre tenants ──────────────────────
do $$
declare v_dup int;
begin
  insert into public.warehouse_receipts_cn (tenant_id, boxes, client_markbox, client_name)
  values ('22222222-2222-2222-2222-222222222222', 4, 'DTD-9001', 'Cliente Otro');

  select count(*) into v_dup from (
    select code from public.warehouse_boxes
     where deleted_at is null
     group by tenant_id, code having count(*) > 1
  ) d;

  if v_dup > 0 then
    raise exception 'CONTRATO 5 ROTO: hay % codigo(s) de caja repetidos — el escaneo en bodega queda ambiguo', v_dup;
  end if;
end;
$$;

-- ── 6 · Asignarle dueño a una huérfana propaga el markbox ─────────────────
do $$
declare v_id uuid; v_mal int;
begin
  insert into public.warehouse_receipts_cn (tenant_id, boxes)
  values ('11111111-1111-1111-1111-111111111111', 2)
  returning id into v_id;

  update public.warehouse_receipts_cn
     set client_markbox = 'DTD-0777', client_name = 'Aparecio el Dueno'
   where id = v_id;

  select count(*) into v_mal from public.warehouse_boxes
   where receipt_id = v_id and deleted_at is null
     and markbox is distinct from 'DTD-0777';

  if v_mal > 0 then
    raise exception 'CONTRATO 6 ROTO: % caja(s) quedaron sin el markbox del dueno nuevo', v_mal;
  end if;
end;
$$;

rollback;
