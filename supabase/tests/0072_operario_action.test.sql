\set ON_ERROR_STOP on

-- Contrato de `operario_action` — lo que el operario puede hacer desde el
-- teléfono (migr 0070 + 0072). Fixtures ficticios y rollback: no toca prod.
--
-- ⚠️ SE CARGAN DOS MIGRACIONES, Y EL ORDEN IMPORTA
--
-- `operario_action` se reescribió entera seis veces (0066 → 0067 → 0068 → 0069
-- → 0070 → 0072). La **0070** agregó la rama `edit_receipt`; la **0072** la
-- recreó completa para arreglar un bug de runtime. Producción corre la de
-- 0072 — verificado el 2026-08-26 contra `pg_get_functiondef`: trae el fix de
-- entity_type, no trae el genérico buggy, e incluye `edit_receipt`.
--
-- Cargar sólo la 0070 probaría la versión con el bug. Se cargan las dos en
-- orden, que además demuestra que la 0072 gana.
--
-- ── 🔴 UNA MEDICIÓN QUE CAMBIÓ LO QUE ESTE CONTRATO DEBÍA AFIRMAR ─────────
--
-- El bug que arregló la 0072: las ramas escribían `entity_type =
-- 'warehouse_receipt'` (genérico) y el CHECK de `entity_audit_log` sólo
-- admitía la lista `shipment | dispatch_order | … | warehouse_receipt_cn |
-- warehouse_receipt_ve`. Reventaba con 23514 EN RUNTIME, invisible a typecheck
-- y a build — o sea, en la mano del operario, en Yiwu, sin nadie mirando.
--
-- **Ese CHECK ya no existe.** Al medirlo contra producción, `entity_audit_log`
-- fue endurecido después y `entity_type` pasó a ser una **FK contra el catálogo
-- `audit_entity_types`** (45 tipos). El stub de acá modela eso —FK a catálogo,
-- no CHECK— porque un contrato que reprodujera el CHECK estaría probando una
-- protección que la base ya no tiene: verde, y describiendo un mundo muerto.
--
-- El fix de la 0072 sigue siendo load-bearing: el catálogo tiene los tres tipos
-- correctos y **no** tiene el genérico. Sólo cambió el número del error (23503
-- en vez de 23514) y no la consecuencia.
--
-- ── QUÉ SE PROTEGE ────────────────────────────────────────────────────────
--
--   1. 🔴 Cada rama escribe un entity_type que el audit acepta.
--   2. 🔴 Editar una recepción SIN mandar items NO borra los items. El
--      `delete from warehouse_receipt_items` sólo corre si el payload los
--      trae; si no, corregir el conteo de cajas se llevaría la mercancía
--      declarada por delante.
--   3. 🔴 Pero `items: []` SÍ los vacía. La diferencia entre «ausente» y
--      «vacío» decide si sobrevive la declaración de mercancía — queda fijada
--      acá para que nadie la cambie sin darse cuenta.
--   4. 🔴 Sólo SU recepción (salvo supervisor).
--   5. 🔴 Sólo en `pendiente_consolidacion`.
--   6. 🔴 Nunca la recepción de otro tenant.
--   7. Operario inactivo o de la región equivocada: rechazado.
--   8. 🔴 `scan_box`: un receipt sellado no admite más escaneos, una caja
--      ajena no entra, y una caja ya escaneada no se re-escanea.
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

create table public.operario_pins (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  role      text,
  roles     text[] not null default '{}',
  region    text,
  active    boolean not null default true
);

-- El catálogo + la FK: así es como la base restringe entity_type HOY.
create table public.audit_entity_types (entity_type text primary key);
insert into public.audit_entity_types (entity_type) values
  ('shipment'), ('dispatch_order'), ('dispatch_order_package'),
  ('warehouse_receipt_cn'), ('warehouse_receipt_ve');

create table public.entity_audit_log (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  entity_type text not null references public.audit_entity_types(entity_type),
  entity_id   uuid not null,
  actor_type  text not null,
  actor_id    uuid,
  event_type  text not null,
  payload     jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table public.warehouse_receipts_cn (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null,
  status                   text not null default 'pendiente_consolidacion',
  created_by_operario_id   uuid,
  is_orphan                boolean not null default false,
  client_markbox           text,
  client_name              text,
  supplier_name            text,
  supplier_name_translated text,
  boxes                    int,
  total_cbm                numeric(12,3),
  total_weight_kg          numeric(12,2),
  notes                    text,
  orphan_marks             text,
  orphan_brought_by        text,
  destination_city         text,
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz
);

create table public.warehouse_receipt_items (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null,
  receipt_id             uuid not null,
  description            text,
  description_translated text,
  hs_code                text,
  quantity               int,
  unit_value_usd         numeric(14,2),
  notes                  text,
  position               int
);

-- El enum real de la 0008: el evento de la bitacora tiene vocabulario acotado.
do $ev$
begin
  if not exists (select 1 from pg_type where typname = 'warehouse_receipt_event_type') then
    create type warehouse_receipt_event_type as enum
      ('received', 'consolidated', 'incident', 'note', 'status_change');
  end if;
end;
$ev$;

create table public.warehouse_receipt_events (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid,
  receipt_id  uuid,
  event_type  warehouse_receipt_event_type not null,
  description text,
  occurred_at timestamptz not null default now()
);

create table public.warehouse_receipts_ve (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  status     text not null default 'recibiendo',
  started_at timestamptz,
  sealed_at  timestamptz,
  sealed_by_operario_id uuid,
  received_by_operario_id uuid,
  incident_note text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.warehouse_receipt_ve_boxes (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null,
  receipt_id             uuid not null,
  code                   text not null,
  scanned_at             timestamptz,
  scanned_by_operario_id uuid,
  scanned_manual         boolean not null default false
);

create table public.dispatch_orders (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  status       text,
  driver_id    uuid,
  truck_id     uuid,
  route_id     uuid,
  order_code   text,
  parent_od_id uuid,
  hub          text,
  updated_at   timestamptz not null default now()
);

create table public.dispatch_order_packages (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  od_id         uuid,
  package_kind  text,
  package_id    uuid,
  markbox       text,
  boxes_total   int,
  boxes_shipped int,
  split_reason  text
);

create table public.tms_trucks  (id uuid primary key default gen_random_uuid(), tenant_id uuid, active boolean default true);
create table public.tms_drivers (id uuid primary key default gen_random_uuid(), tenant_id uuid, active boolean default true);

\ir ../migrations/0070_edit_receipt_operario.sql
\ir ../migrations/0072_fix_audit_entity_type.sql

-- ── Fixtures ──────────────────────────────────────────────────────────────
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'
insert into public.tenants (id, slug) values (:'t1', 'dtd'), (:'t2', 'otro');

\set op1 'aa111111-1111-1111-1111-111111111111'
\set op2 'ab222222-2222-2222-2222-222222222222'
\set opve 'ac333333-3333-3333-3333-333333333333'
\set opoff 'ad444444-4444-4444-4444-444444444444'
insert into public.operario_pins (id, tenant_id, role, roles, region, active) values
  (:'op1',  :'t1', 'almacenista', '{almacenista}',            'cn', true),
  (:'op2',  :'t1', 'almacenista', '{almacenista}',            'cn', true),
  (:'opve', :'t1', 'bodeguero',   '{bodeguero,supervisor}',   've', true),
  (:'opoff',:'t1', 'almacenista', '{almacenista}',            'cn', false);

\set rc 'ca111111-1111-1111-1111-111111111111'
insert into public.warehouse_receipts_cn
  (id, tenant_id, created_by_operario_id, client_markbox, client_name, boxes)
values (:'rc', :'t1', :'op1', 'DTD-0001', 'Importadora Uno', 5);

insert into public.warehouse_receipt_items (tenant_id, receipt_id, description, quantity, position) values
  (:'t1', :'rc', 'zapatos deportivos', 200, 0),
  (:'t1', :'rc', 'medias',             500, 1);

create or replace function pg_temp.n_items() returns int language sql as $n$
  select count(*)::int from public.warehouse_receipt_items
   where receipt_id = 'ca111111-1111-1111-1111-111111111111'
$n$;

create or replace function pg_temp.cajas() returns int language sql as $n$
  select boxes from public.warehouse_receipts_cn
   where id = 'ca111111-1111-1111-1111-111111111111'
$n$;

-- ── 1 · 🔴 El fix de la 0072: el audit acepta lo que la rama escribe ──────
--
-- Sin el fix, esto revienta al insertar en el audit y la edición del operario
-- falla entera — en el teléfono, en Yiwu, sin nadie mirando.
do $$
declare v_n int;
begin
  -- Se atrapa el error para poder DECIRLO. Sin esto el archivo revienta con el
  -- mensaje crudo de Postgres y quien lo lea tiene que ir a adivinar qué pasó.
  begin
    perform public.operario_action(
      'aa111111-1111-1111-1111-111111111111', 'edit_receipt',
      jsonb_build_object(
        'receipt_id', 'ca111111-1111-1111-1111-111111111111',
        'boxes', 6,
        'client_markbox', 'DTD-0001',
        'client_name', 'Importadora Uno'
      ));
  exception when others then
    raise exception
      'CONTRATO 1 ROTO: edit_receipt fallo en runtime (%) — el operario no puede corregir su recepcion desde el telefono',
      sqlerrm;
  end;

  select count(*) into v_n from public.entity_audit_log
   where entity_type = 'warehouse_receipt_cn';
  if v_n <> 1 then
    raise exception 'CONTRATO 1 ROTO: edit_receipt no dejo su rastro de auditoria (% filas)', v_n;
  end if;
  if pg_temp.cajas() <> 6 then
    raise exception 'CONTRATO 1 ROTO: la edicion no aplico (boxes = %)', pg_temp.cajas();
  end if;
end;
$$;

-- ── 2 · 🔴 Editar SIN mandar items no borra los items ─────────────────────
--
-- El operario corrige el conteo de cajas. Si el `delete from` corriera igual,
-- se llevaría por delante la mercancía declarada — y eso es lo que después
-- viaja en la aduana.
do $$
begin
  if pg_temp.n_items() <> 2 then
    raise exception
      'CONTRATO 2 ROTO: corregir las cajas borro los items (quedan %) — se pierde la mercancia declarada',
      pg_temp.n_items();
  end if;
end;
$$;

-- ── 3 · 🔴 Pero `items: []` SÍ los vacía ──────────────────────────────────
--
-- La diferencia entre «ausente» y «vacío» decide si sobrevive la declaración.
-- No es un accidente del código: es la única forma que tiene el operario de
-- borrar una lista mal cargada. Queda fijada acá para que nadie la cambie sin
-- darse cuenta de cuál de las dos cosas está tocando.
do $$
begin
  perform public.operario_action(
    'aa111111-1111-1111-1111-111111111111', 'edit_receipt',
    jsonb_build_object(
      'receipt_id', 'ca111111-1111-1111-1111-111111111111',
      'boxes', 6,
      'items', '[]'::jsonb
    ));

  if pg_temp.n_items() <> 0 then
    raise exception 'CONTRATO 3 ROTO: items:[] no vacio la lista (quedan %)', pg_temp.n_items();
  end if;

  -- Y una lista nueva reemplaza a la anterior, no se acumula.
  perform public.operario_action(
    'aa111111-1111-1111-1111-111111111111', 'edit_receipt',
    jsonb_build_object(
      'receipt_id', 'ca111111-1111-1111-1111-111111111111',
      'boxes', 6,
      'items', jsonb_build_array(jsonb_build_object('description', 'gorras', 'quantity', 100))
    ));
  if pg_temp.n_items() <> 1 then
    raise exception 'CONTRATO 3 ROTO: la lista nueva se acumulo con la vieja (% items)', pg_temp.n_items();
  end if;
end;
$$;

-- ── 4 · 🔴 Sólo SU recepción ──────────────────────────────────────────────
do $$
begin
  begin
    perform public.operario_action(
      'ab222222-2222-2222-2222-222222222222', 'edit_receipt',   -- otro operario CN
      jsonb_build_object('receipt_id', 'ca111111-1111-1111-1111-111111111111', 'boxes', 99));
  exception when others then null;
  end;

  if pg_temp.cajas() = 99 then
    raise exception 'CONTRATO 4 ROTO: un operario edito la recepcion de OTRO';
  end if;
end;
$$;

-- Pero un supervisor sí puede (es la excepción que el código concede).
do $$
declare v_sup uuid;
begin
  insert into public.operario_pins (tenant_id, role, roles, region, active)
  values ('11111111-1111-1111-1111-111111111111', 'almacenista',
          '{almacenista,supervisor}', 'cn', true)
  returning id into v_sup;

  perform public.operario_action(v_sup, 'edit_receipt',
    jsonb_build_object('receipt_id', 'ca111111-1111-1111-1111-111111111111', 'boxes', 7));

  if pg_temp.cajas() <> 7 then
    raise exception 'CONTRATO 4 ROTO: el supervisor NO pudo editar (boxes = %)', pg_temp.cajas();
  end if;
end;
$$;

-- ── 5 · 🔴 Sólo en pendiente_consolidacion ────────────────────────────────
do $$
begin
  update public.warehouse_receipts_cn set status = 'consolidado'
   where id = 'ca111111-1111-1111-1111-111111111111';

  begin
    perform public.operario_action(
      'aa111111-1111-1111-1111-111111111111', 'edit_receipt',
      jsonb_build_object('receipt_id', 'ca111111-1111-1111-1111-111111111111', 'boxes', 99));
  exception when others then null;
  end;

  if pg_temp.cajas() = 99 then
    raise exception
      'CONTRATO 5 ROTO: se edito una recepcion YA CONSOLIDADA — la carga ya salio con otro numero';
  end if;

  update public.warehouse_receipts_cn set status = 'pendiente_consolidacion'
   where id = 'ca111111-1111-1111-1111-111111111111';
end;
$$;

-- ── 6 · 🔴 Nunca la recepción de otro tenant ──────────────────────────────
do $$
declare v_op2 uuid; v_boxes int;
begin
  insert into public.operario_pins (tenant_id, role, roles, region, active)
  values ('22222222-2222-2222-2222-222222222222', 'almacenista',
          '{almacenista,supervisor}', 'cn', true)
  returning id into v_op2;

  begin
    perform public.operario_action(v_op2, 'edit_receipt',
      jsonb_build_object('receipt_id', 'ca111111-1111-1111-1111-111111111111', 'boxes', 99));
  exception when others then null;
  end;

  select boxes into v_boxes from public.warehouse_receipts_cn
   where id = 'ca111111-1111-1111-1111-111111111111';
  if v_boxes = 99 then
    raise exception 'CONTRATO 6 ROTO: un operario del tenant 2 edito una recepcion del tenant 1';
  end if;
end;
$$;

-- ── 7 · Operario inactivo, región equivocada y cajas en cero ──────────────
do $$
begin
  -- ⚠️ El inactivo edita SU PROPIA recepción, a propósito. Con la de otro, lo
  -- frenaría el guard de «sólo SU recepción» y este contrato estaría midiendo
  -- la protección de al lado — verde con el guard de `active` arrancado.
  declare v_propia uuid;
  begin
    insert into public.warehouse_receipts_cn
      (tenant_id, created_by_operario_id, client_markbox, client_name, boxes)
    values ('11111111-1111-1111-1111-111111111111',
            'ad444444-4444-4444-4444-444444444444', 'DTD-0009', 'De un inactivo', 3)
    returning id into v_propia;

    begin
      perform public.operario_action(
        'ad444444-4444-4444-4444-444444444444', 'edit_receipt',
        jsonb_build_object('receipt_id', v_propia, 'boxes', 99));
    exception when others then null;
    end;

    if (select boxes from public.warehouse_receipts_cn where id = v_propia) = 99 then
      raise exception 'CONTRATO 7 ROTO: un operario INACTIVO edito su recepcion — el PIN dado de baja sigue operando';
    end if;
  end;

  -- region VE editando una recepcion CN
  begin
    perform public.operario_action(
      'ac333333-3333-3333-3333-333333333333', 'edit_receipt',
      jsonb_build_object('receipt_id', 'ca111111-1111-1111-1111-111111111111', 'boxes', 99));
  exception when others then null;
  end;
  if pg_temp.cajas() = 99 then
    raise exception 'CONTRATO 7 ROTO: un operario VE edito una recepcion CN';
  end if;

  -- boxes <= 0: una recepcion sin cajas no es una recepcion
  begin
    perform public.operario_action(
      'aa111111-1111-1111-1111-111111111111', 'edit_receipt',
      jsonb_build_object('receipt_id', 'ca111111-1111-1111-1111-111111111111', 'boxes', 0));
  exception when others then null;
  end;
  if pg_temp.cajas() = 0 then
    raise exception 'CONTRATO 7 ROTO: se guardo una recepcion con 0 cajas';
  end if;
end;
$$;

-- ── 8 · 🔴 scan_box: sellado, caja ajena y doble escaneo ──────────────────
\set rv 'cb222222-2222-2222-2222-222222222222'
do $$
declare v_escaneada timestamptz;
begin
  insert into public.warehouse_receipts_ve (id, tenant_id, status)
  values ('cb222222-2222-2222-2222-222222222222',
          '11111111-1111-1111-1111-111111111111', 'recibiendo');
  insert into public.warehouse_receipt_ve_boxes (tenant_id, receipt_id, code)
  values ('11111111-1111-1111-1111-111111111111',
          'cb222222-2222-2222-2222-222222222222', 'DTDU-0001');

  -- (a) una caja que NO figura en el receipt
  begin
    perform public.operario_action(
      'ac333333-3333-3333-3333-333333333333', 'scan_box',
      jsonb_build_object('receipt_id', 'cb222222-2222-2222-2222-222222222222',
                         'code', 'DTDU-AJENA'));
  exception when others then null;
  end;
  if exists (select 1 from public.warehouse_receipt_ve_boxes where code = 'DTDU-AJENA') then
    raise exception 'CONTRATO 8 ROTO: escanear una caja ajena la creo en el receipt';
  end if;

  -- (b) el escaneo legítimo sí funciona
  perform public.operario_action(
    'ac333333-3333-3333-3333-333333333333', 'scan_box',
    jsonb_build_object('receipt_id', 'cb222222-2222-2222-2222-222222222222',
                       'code', 'DTDU-0001'));
  select scanned_at into v_escaneada from public.warehouse_receipt_ve_boxes
   where code = 'DTDU-0001';
  if v_escaneada is null then
    raise exception 'CONTRATO 8 ROTO: un escaneo LEGITIMO no marco la caja';
  end if;

  -- (c) no se re-escanea: la hora original manda (es cuándo llegó de verdad).
  --
  -- ⚠️ Se ANTEDATA la marca a propósito. `now()` en Postgres es la hora de la
  -- TRANSACCIÓN, no del reloj: sin antedatar, un re-escaneo escribiría el mismo
  -- timestamp y el contrato pasaría en verde con el guard arrancado. La primera
  -- versión de esta afirmación caía justo ahí.
  update public.warehouse_receipt_ve_boxes
     set scanned_at = now() - interval '4 hours'
   where code = 'DTDU-0001';
  select scanned_at into v_escaneada from public.warehouse_receipt_ve_boxes
   where code = 'DTDU-0001';

  begin
    perform public.operario_action(
      'ac333333-3333-3333-3333-333333333333', 'scan_box',
      jsonb_build_object('receipt_id', 'cb222222-2222-2222-2222-222222222222',
                         'code', 'DTDU-0001'));
  exception when others then null;
  end;
  if (select scanned_at from public.warehouse_receipt_ve_boxes where code = 'DTDU-0001')
     <> v_escaneada then
    raise exception 'CONTRATO 8 ROTO: se re-escaneo la caja y se piso la hora real de llegada';
  end if;

  -- (d) un receipt sellado no admite más escaneos
  insert into public.warehouse_receipt_ve_boxes (tenant_id, receipt_id, code)
  values ('11111111-1111-1111-1111-111111111111',
          'cb222222-2222-2222-2222-222222222222', 'DTDU-0002');
  update public.warehouse_receipts_ve set status = 'sellado'
   where id = 'cb222222-2222-2222-2222-222222222222';

  begin
    perform public.operario_action(
      'ac333333-3333-3333-3333-333333333333', 'scan_box',
      jsonb_build_object('receipt_id', 'cb222222-2222-2222-2222-222222222222',
                         'code', 'DTDU-0002'));
  exception when others then null;
  end;
  if (select scanned_at from public.warehouse_receipt_ve_boxes where code = 'DTDU-0002')
     is not null then
    raise exception 'CONTRATO 8 ROTO: se escaneo una caja en un receipt YA SELLADO';
  end if;
end;
$$;

rollback;
