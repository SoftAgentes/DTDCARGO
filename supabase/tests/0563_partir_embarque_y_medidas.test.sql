\set ON_ERROR_STOP on

-- Contrato desechable de la 0563 (SDD-0673): corregir medidas, partir un
-- embarque y el grupo de WeChat. Fixture sintética y ROLLBACK: nunca consulta
-- ni modifica una base alojada.
--
-- Aplica las migraciones REALES de auditoría (0258, 0261, 0267, 0294), de
-- embarques (0002, 0003, 0004, 0009, 0305), del Almacén CN (0008), la 0230 y las
-- cajas (0240, la estiba y la sincronía endurecida de la 0241 y el índice único
-- parcial de la 0243, como en producción). Clientes, facturas, contenedores,
-- recepciones de Venezuela, estiba, documentos, avisos, reclamos, prealertas y
-- despacho van como dobles mínimos con las columnas de producción que lee la
-- 0563: su preflight las exige por nombre.
--
-- RED: `-v apply_fix=false` no aplica la 0563 y la primera aserción falla
-- porque operaciones no puede corregir las medidas.
--
-- Lo que defiende:
--   1. Corregir: los tres lugares quedan alineados; subir y bajar cajas físicas.
--   2. Partir: dos partes que suman lo de antes, cajas movidas con su código,
--      línea de tiempo copiada, eventos en los dos embarques.
--   3. Bloqueos: entregado, factura emitida, caja escaneada o esperada en
--      Venezuela, cajas estibadas, medidas desalineadas, sin contenedor.
--   4. Roles, validaciones, vista previa sin escritura, todo o nada.
--   5. Forma, ACL y el check del grupo de WeChat.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.shipments') is not null or to_regclass('public.tenants') is not null
     or to_regclass('public.entity_audit_log') is not null then
    raise exception 'TEST 0563: fixture rechazada, la base ya contiene objetos de aplicación';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$fixture_guard$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create table public.tenants (id uuid primary key, slug text unique not null, display_name text not null);
create table public.user_tenants (
  user_id uuid not null references auth.users(id), tenant_id uuid not null references public.tenants(id),
  role text not null, disabled_at timestamptz, primary key (user_id, tenant_id),
  constraint user_tenants_role_check check (role in ('admin', 'commercial', 'operations', 'accounting',
    'warehouse', 'support', 'marketing'))
);
alter table public.user_tenants enable row level security;
grant select on public.user_tenants to authenticated;
create policy "users see their own user_tenants" on public.user_tenants
  for select to authenticated using (user_id = (select auth.uid()) and disabled_at is null);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1] from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
revoke execute on function public.get_user_tenant_id() from public, anon;
grant execute on function public.get_user_tenant_id() to authenticated;

create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  entity_type text not null, entity_id uuid not null, actor_type text not null,
  actor_id uuid, event_type text not null, payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint entity_audit_log_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint entity_audit_log_actor_type_check check (actor_type in ('user', 'operario', 'system')),
  constraint entity_audit_log_entity_type_check check (entity_type in ('shipment'))
);
alter table public.entity_audit_log enable row level security;
create policy entity_audit_log_tenant_select on public.entity_audit_log for select to authenticated
  using (tenant_id = public.get_user_tenant_id());
create policy entity_audit_log_service_role_all on public.entity_audit_log for all to service_role
  using (true) with check (true);
grant select on public.entity_audit_log to authenticated;
grant all on public.entity_audit_log to service_role;
create publication supabase_realtime;
alter publication supabase_realtime add table public.entity_audit_log;
\ir ../migrations/0258_audit_entity_catalog.sql
\ir ../migrations/0261_audit_entity_catalog_validate.sql
\ir ../migrations/0267_audit_contract_append_only.sql
\ir ../migrations/0294_audit_d2_human_reasons.sql

\ir ../migrations/0002_shipments.sql
\ir ../migrations/0003_shipment_events_on_insert.sql
\ir ../migrations/0004_add_destination_gps.sql
\ir ../migrations/0008_warehouses_cn.sql
\ir ../migrations/0009_shipment_delivery_pod.sql
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
\ir ../migrations/0240_warehouse_boxes.sql
\ir ../migrations/0305_shipment_planning_dates.sql

-- ── Dobles mínimos (columnas de producción que lee o escribe la 0563) ──────
create table public.clients (
  id uuid primary key, tenant_id uuid not null references public.tenants(id), markbox text,
  name text not null, deleted_at timestamptz, merged_into_client_id uuid
);
create type public.invoice_status as enum ('borrador', 'emitida', 'parcial', 'pagada', 'vencida', 'anulada');
create table public.invoices (
  id uuid primary key, tenant_id uuid not null, shipment_id uuid references public.shipments(id) on delete set null,
  status public.invoice_status not null default 'borrador', lines jsonb not null default '[]', deleted_at timestamptz
);
create table public.consolidations (
  id uuid primary key, tenant_id uuid not null, status text not null default 'consolidando', deleted_at timestamptz
);
create table public.consolidation_items (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  consolidation_id uuid not null references public.consolidations(id) on delete cascade,
  shipment_id uuid references public.shipments(id) on delete set null, client_markbox text, client_name text,
  supplier_name text, cbm numeric(10,3) not null default 0, weight_kg numeric(12,2) not null default 0,
  pieces int not null default 0, created_at timestamptz not null default now()
);
-- Lo que la 0241 necesita para crear la estiba (sólo las columnas que toca).
create table public.container_types (code text primary key);
create table public.operario_pins (id uuid primary key);
\ir ../migrations/0241_estiba_por_zonas.sql
\ir ../migrations/0243_warehouse_boxes_seq_partial_unique.sql
create table public.warehouse_receipts_ve (id uuid primary key, tenant_id uuid not null, deleted_at timestamptz);
create table public.warehouse_receipt_ve_boxes (
  id uuid primary key default gen_random_uuid(), receipt_id uuid not null references public.warehouse_receipts_ve(id),
  code text not null, markbox text, client_name text, scanned_at timestamptz
);
create table public.shipment_documents (
  id uuid primary key, tenant_id uuid not null,
  shipment_id uuid not null references public.shipments(id) on delete cascade, deleted_at timestamptz
);
create table public.shipment_rate_snapshots (
  id uuid primary key, tenant_id uuid not null,
  receipt_id uuid not null references public.warehouse_receipts_cn(id) on delete cascade, superseded_at timestamptz
);
create table public.client_notification_schedule (
  id uuid primary key, tenant_id uuid not null,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status text not null default 'scheduled'
);
create table public.client_claims (
  id uuid primary key, tenant_id uuid not null, shipment_id uuid references public.shipments(id) on delete set null,
  deleted_at timestamptz
);
create table public.prealertas (
  id uuid primary key, tenant_id uuid not null, shipment_id uuid,
  status text not null default 'anunciada', deleted_at timestamptz
);
create type public.dispatch_order_status as enum ('creada', 'cargando', 'lista', 'en_ruta', 'entregada', 'cerrada', 'cancelada');
create table public.dispatch_orders (
  id uuid primary key, tenant_id uuid not null, status public.dispatch_order_status not null default 'creada'
);
create table public.dispatch_order_packages (
  od_id uuid not null references public.dispatch_orders(id) on delete cascade,
  package_kind text not null, package_id uuid not null, primary key (od_id, package_id)
);
grant all on all tables in schema public to service_role;

-- ── Datos sintéticos ────────────────────────────────────────────────────────
create function pg_temp.fid(p_label text) returns uuid language sql immutable as $$
  select md5('0563-synthetic-' || p_label)::uuid
$$;

insert into auth.users (id)
select pg_temp.fid(u) from unnest(array['admin-A', 'admin-off', 'operations-A', 'commercial-A',
  'accounting-A', 'warehouse-A', 'admin-B']) u;
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fid('tenant-A'), 'tenant-a-0563', 'Tenant A 0563'),
  (pg_temp.fid('tenant-B'), 'tenant-b-0563', 'Tenant B 0563');
insert into public.user_tenants (user_id, tenant_id, role, disabled_at)
select pg_temp.fid(v.u), pg_temp.fid(v.t), v.r, case when v.off then now() end from (values
  ('admin-A', 'tenant-A', 'admin', false), ('admin-off', 'tenant-A', 'admin', true),
  ('operations-A', 'tenant-A', 'operations', false), ('commercial-A', 'tenant-A', 'commercial', false),
  ('accounting-A', 'tenant-A', 'accounting', false), ('warehouse-A', 'tenant-A', 'warehouse', false),
  ('admin-B', 'tenant-B', 'admin', false)
) v(u, t, r, off);

insert into public.clients (id, tenant_id, markbox, name, deleted_at, merged_into_client_id)
select pg_temp.fid(v.label), pg_temp.fid(v.t), v.mb, v.nombre,
  case when v.gone then now() end, case when v.merged then pg_temp.fid('C-A') end
from (values
  ('C-A', 'tenant-A', 'SINT-1001', 'Cliente Ficticio A', false, false),
  ('C-B', 'tenant-A', 'SINT-1002', 'Cliente Ficticio B', false, false),
  ('C-SIN-MB', 'tenant-A', null, 'Cliente sin marca', false, false),
  ('C-FUSION', 'tenant-A', 'SINT-1003', 'Cliente fusionado', false, true),
  ('C-GONE', 'tenant-A', 'SINT-1004', 'Cliente eliminado', true, false),
  ('C-TB', 'tenant-B', 'SINT-2001', 'Cliente del tenant B', false, false)
) v(label, t, mb, nombre, gone, merged);

insert into public.consolidations (id, tenant_id, status) values
  (pg_temp.fid('cons'), pg_temp.fid('tenant-A'), 'zarpado');

-- Cada embarque de contenedor: 5 cajas, 1,780 m³ y 300,00 kg, alineado en las tres tablas.
insert into public.shipments (id, tenant_id, code, client_name, client_markbox, origin, destination,
  shipment_service, status, weight_kg, volume_m3, vehicle_category, notes, created_at)
select pg_temp.fid(v.code), pg_temp.fid(v.t), v.code, 'Cliente Ficticio A', 'SINT-1001', 'Yiwu, China', 'La Guaira',
  'consolidacion', v.st::public.shipment_status, 300.00, case when v.code = 'DTD-9004' then 1.800 else 1.780 end,
  'contenedor_maritimo', 'Nota sintética', now() - interval '10 days'
from (values
  ('DTD-9001', 'tenant-A', 'in_transit'),  -- partir, camino feliz
  ('DTD-9002', 'tenant-A', 'in_transit'),  -- corregir, camino feliz
  ('DTD-9003', 'tenant-A', 'in_transit'),  -- borrador de factura (aviso)
  ('DTD-9004', 'tenant-A', 'in_transit'),  -- medidas desalineadas (CBM del embarque distinto)
  ('DTD-9005', 'tenant-A', 'delivered'),   -- entregado
  ('DTD-9006', 'tenant-A', 'in_transit'),  -- factura emitida
  ('DTD-9007', 'tenant-A', 'in_transit'),  -- caja escaneada / esperada en Venezuela
  ('DTD-9008', 'tenant-A', 'in_transit'),  -- cajas estibadas
  ('DTD-9009', 'tenant-A', 'in_transit'),  -- sin contenedor ni recepción
  ('DTD-9010', 'tenant-A', 'in_transit'),  -- todo o nada
  ('DTD-9011', 'tenant-A', 'in_transit'),  -- roles y validaciones
  ('DTD-9001-B', 'tenant-A', 'cancelled'), -- código ocupado: la parte nueva será -C
  ('DTD-9999', 'tenant-B', 'in_transit')
) v(code, t, st);
-- Un evento con nota además del inicial de 0003: la parte nueva lo hereda.
insert into public.shipment_events (tenant_id, shipment_id, status, note, occurred_at) values
  (pg_temp.fid('tenant-A'), pg_temp.fid('DTD-9001'), 'shipped', 'Zarpó (sintético)', now() - interval '5 days');

insert into public.consolidation_items (tenant_id, consolidation_id, shipment_id, client_markbox, client_name,
  supplier_name, cbm, weight_kg, pieces)
select pg_temp.fid('tenant-A'), pg_temp.fid('cons'), pg_temp.fid(c), 'SINT-1001', 'Cliente Ficticio A',
  'Proveedor sintético', 1.780, 300.00, 5
from unnest(array['DTD-9001', 'DTD-9002', 'DTD-9003', 'DTD-9004', 'DTD-9005', 'DTD-9006', 'DTD-9007',
  'DTD-9008', 'DTD-9010', 'DTD-9011']) c;
-- Otro embarque del contenedor que no se toca.
insert into public.shipments (id, tenant_id, code, client_markbox, shipment_service, status, weight_kg, volume_m3)
values (pg_temp.fid('DTD-9100'), pg_temp.fid('tenant-A'), 'DTD-9100', 'SINT-1002', 'consolidacion', 'in_transit', 50.00, 0.500);
insert into public.consolidation_items (tenant_id, consolidation_id, shipment_id, client_markbox, cbm, weight_kg, pieces)
values (pg_temp.fid('tenant-A'), pg_temp.fid('cons'), pg_temp.fid('DTD-9100'), 'SINT-1002', 0.500, 50.00, 3);

insert into public.warehouse_receipts_cn (id, tenant_id, receipt_code, warehouse_id, client_markbox, client_name,
  boxes, total_cbm, total_weight_kg, status, shipment_id)
select pg_temp.fid('WR-' || c), pg_temp.fid('tenant-A'), 'WR-C9-' || c, (select id from public.warehouses_cn where code = 'YIW-A1'),
  'SINT-1001', 'Cliente Ficticio A', 5, 1.780, 300.00, 'consolidado'::public.warehouse_receipt_status, pg_temp.fid(c)
from unnest(array['DTD-9001', 'DTD-9002', 'DTD-9003', 'DTD-9004', 'DTD-9005', 'DTD-9006', 'DTD-9007',
  'DTD-9008', 'DTD-9010', 'DTD-9011']) c;

insert into public.invoices (id, tenant_id, shipment_id, status, lines) values
  (pg_temp.fid('inv-draft'), pg_temp.fid('tenant-A'), null, 'borrador',
    '[{"desc":"Flete","qty":1.78,"unitPrice":10,"shipmentCode":"DTD-9003"}]'),
  (pg_temp.fid('inv-emi'), pg_temp.fid('tenant-A'), pg_temp.fid('DTD-9006'), 'emitida', '[]'),
  (pg_temp.fid('inv-nul'), pg_temp.fid('tenant-A'), pg_temp.fid('DTD-9001'), 'anulada', '[]');

-- DTD-9007: su caja de seq más alto ya se escaneó en Venezuela; la anterior está esperada sin escanear.
insert into public.warehouse_receipts_ve (id, tenant_id) values (pg_temp.fid('ve'), pg_temp.fid('tenant-A'));
insert into public.warehouse_receipt_ve_boxes (receipt_id, code, markbox, scanned_at)
select pg_temp.fid('ve'), b.code, b.markbox, case when b.seq = 5 then now() end
  from public.warehouse_boxes b where b.receipt_id = pg_temp.fid('WR-DTD-9007') and b.seq in (4, 5);
-- DTD-9008: todas sus cajas tienen historia de estiba.
insert into public.consolidation_box_positions (tenant_id, consolidation_id, box_id, zx, zy, zz, seq)
select pg_temp.fid('tenant-A'), pg_temp.fid('cons'), b.id, 0, 0, 0, b.seq
  from public.warehouse_boxes b where b.receipt_id = pg_temp.fid('WR-DTD-9008');
-- DTD-9003: su recepción tiene tarifa congelada viva (0496).
insert into public.shipment_rate_snapshots (id, tenant_id, receipt_id) values
  (pg_temp.fid('rs-9003'), pg_temp.fid('tenant-A'), pg_temp.fid('WR-DTD-9003'));
-- DTD-9001: llegada, planificación y GPS que la parte nueva hereda (el guard de 0305 pide la marca).
select set_config('dtd.shipment_planning_write', 'rpc', true);
update public.shipments set destination_gps = '10.0, -66.0', planned_arrival_at = now() + interval '20 days',
  arrived_destination_at = now() - interval '1 day'
 where id = pg_temp.fid('DTD-9001');
select set_config('dtd.shipment_planning_write', '', true);

alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

\if :apply_fix
\ir ../migrations/0563_partir_embarque_y_medidas.sql
\endif

-- ── Utilidades ──────────────────────────────────────────────────────────────
create temporary sequence aserciones;
create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0563: %', p_msg; end if;
  perform nextval('pg_temp.aserciones');
end;
$$;

create function pg_temp.como(p_actor text, p_sql text, p_rol text default 'authenticated')
returns jsonb language plpgsql as $$
declare v jsonb; v_state text; v_msg text;
begin
  perform set_config('request.jwt.claim.sub',
    case when p_actor is null then '' else pg_temp.fid(p_actor)::text end, true);
  begin
    execute format('set local role %I', p_rol);
    execute p_sql into v;
    reset role;
    return jsonb_build_object('ok', true, 'r', v);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    reset role;
    return jsonb_build_object('ok', false, 'sqlstate', v_state, 'mensaje', v_msg);
  end;
end;
$$;
create function pg_temp.corregir(p_actor text, p_ship text, p_boxes int, p_cbm numeric, p_kg numeric,
  p_reason text, p_dry boolean default false, p_rol text default 'authenticated')
returns jsonb language sql volatile as $$
  select pg_temp.como(p_actor, format('select public.correct_shipment_measures(%L::uuid, %L::int, %L::numeric, %L::numeric, %L, %L::boolean)',
    pg_temp.fid(p_ship), p_boxes, p_cbm, p_kg, p_reason, p_dry), p_rol)
$$;
create function pg_temp.partir(p_actor text, p_ship text, p_client text, p_boxes int, p_cbm numeric, p_kg numeric,
  p_reason text, p_codes text[] default null, p_dry boolean default false)
returns jsonb language sql volatile as $$
  select pg_temp.como(p_actor, format('select public.split_shipment(%L::uuid, %L::uuid, %L::int, %L::numeric, %L::numeric, %L, %L::text[], %L::boolean)',
    pg_temp.fid(p_ship), pg_temp.fid(p_client), p_boxes, p_cbm, p_kg, p_reason, p_codes, p_dry))
$$;
create function pg_temp.huella() returns text language sql volatile as $$
  select md5(string_agg(x, '|' order by x)) from (
    select (to_jsonb(s) - 'updated_at')::text as x from public.shipments s
    union all select to_jsonb(e)::text from (select id, shipment_id, note from public.shipment_events) e
    union all select to_jsonb(r)::text from (select id, boxes, total_cbm, total_weight_kg from public.warehouse_receipts_cn) r
    union all select to_jsonb(b)::text from (select id, receipt_id, markbox, deleted_at from public.warehouse_boxes) b
    union all select to_jsonb(c)::text from (select id, shipment_id, cbm, weight_kg, pieces from public.consolidation_items) c
    union all select to_jsonb(v)::text from (select id, markbox from public.warehouse_receipt_ve_boxes) v
  ) t
$$;
create function pg_temp.eventos() returns bigint language sql volatile as $$
  select count(*) from public.entity_audit_log
   where event_type in ('shipment_measures_corrected', 'shipment_split_out', 'shipment_split_in')
$$;
create function pg_temp.medidas(p_ship text) returns jsonb language sql volatile as $$
  select jsonb_build_object(
    's_cbm', s.volume_m3, 's_kg', s.weight_kg,
    'i_cbm', (select ci.cbm from public.consolidation_items ci where ci.shipment_id = s.id order by ci.created_at desc limit 1),
    'i_kg', (select ci.weight_kg from public.consolidation_items ci where ci.shipment_id = s.id order by ci.created_at desc limit 1),
    'i_pieces', (select ci.pieces from public.consolidation_items ci where ci.shipment_id = s.id order by ci.created_at desc limit 1),
    'r_boxes', (select r.boxes from public.warehouse_receipts_cn r where r.shipment_id = s.id and r.deleted_at is null),
    'r_cbm', (select r.total_cbm from public.warehouse_receipts_cn r where r.shipment_id = s.id and r.deleted_at is null),
    'r_kg', (select r.total_weight_kg from public.warehouse_receipts_cn r where r.shipment_id = s.id and r.deleted_at is null),
    'cajas', (select count(*) from public.warehouse_boxes b join public.warehouse_receipts_cn r on r.id = b.receipt_id
               where r.shipment_id = s.id and r.deleted_at is null and b.deleted_at is null))
  from public.shipments s where s.code = p_ship and s.tenant_id = pg_temp.fid('tenant-A')
$$;
create function pg_temp.total_contenedor() returns jsonb language sql volatile as $$
  select jsonb_build_object('pieces', sum(pieces), 'cbm', sum(cbm), 'kg', sum(weight_kg))
    from public.consolidation_items where consolidation_id = pg_temp.fid('cons')
$$;

-- ── 1. RED / corregir: operaciones alinea las tres tablas ──────────────────
do $corregir$
declare v_r jsonb; v_prev jsonb; v_huella text := pg_temp.huella(); v_ev record; v_codigos text[];
begin
  v_prev := pg_temp.corregir('operations-A', 'DTD-9002', 6, 1.800, 310.50, null, true);
  perform pg_temp.afirmar((v_prev ->> 'ok')::boolean and v_prev -> 'r' ->> 'outcome' = 'preview',
    'operaciones no pudo ver la vista previa de la corrección: ' || v_prev::text);
  perform pg_temp.afirmar(pg_temp.huella() = v_huella and pg_temp.eventos() = 0, 'la vista previa de corregir escribió algo');
  perform pg_temp.afirmar(v_prev -> 'r' -> 'warnings' = '{"contenedor": "zarpado", "cajas_nuevas_sin_etiqueta": 1}'::jsonb,
    'la vista previa no avisó el contenedor zarpado o la caja sin etiqueta: ' || (v_prev -> 'r' -> 'warnings')::text);

  select array_agg(code order by seq) into v_codigos from public.warehouse_boxes where receipt_id = pg_temp.fid('WR-DTD-9002');
  v_r := pg_temp.corregir('operations-A', 'DTD-9002', 6, 1.800, 310.50, '  Cuadre con el Excel de carga  ');
  perform pg_temp.afirmar(v_r -> 'r' ->> 'outcome' = 'corrected', 'operaciones no pudo corregir: ' || v_r::text);
  perform pg_temp.afirmar(pg_temp.medidas('DTD-9002') = '{"s_cbm": 1.800, "s_kg": 310.50, "i_cbm": 1.800, "i_kg": 310.50,
      "i_pieces": 6, "r_boxes": 6, "r_cbm": 1.800, "r_kg": 310.50, "cajas": 6}'::jsonb,
    'la corrección no alineó las tres tablas: ' || pg_temp.medidas('DTD-9002')::text);
  perform pg_temp.afirmar((select array_agg(code order by seq) from public.warehouse_boxes
      where receipt_id = pg_temp.fid('WR-DTD-9002') and seq <= 5) = v_codigos,
    'subir cajas cambió el código de las cajas que ya existían');
  perform pg_temp.afirmar(pg_temp.medidas('DTD-9100') ->> 'i_pieces' = '3', 'la corrección tocó otro embarque');

  select * into v_ev from public.entity_audit_log where event_type = 'shipment_measures_corrected';
  perform pg_temp.afirmar(v_ev.entity_id = pg_temp.fid('DTD-9002') and v_ev.actor_id = pg_temp.fid('operations-A')
    and v_ev.reason = 'Cuadre con el Excel de carga', 'el evento de corrección no tiene entidad, actor o motivo');
  perform pg_temp.afirmar(v_ev.before_data -> 'warehouse_receipt_cn' ->> 'boxes' = '5'
    and v_ev.after_data -> 'warehouse_receipt_cn' ->> 'boxes' = '6'
    and (v_ev.after_data -> 'shipment' ->> 'cbm')::numeric = 1.800, 'el evento no guarda el antes y el después');
  perform pg_temp.afirmar(coalesce(current_setting('dtd.audit_reason', true), '') = '', 'el motivo quedó fijado después de corregir');

  -- Bajar cajas: se borran (lógico) las de seq más alto; sólo cambia el CBM si es lo único que viene.
  v_r := pg_temp.corregir('admin-A', 'DTD-9002', 4, null, null, 'Una caja de más en el conteo');
  perform pg_temp.afirmar(v_r -> 'r' ->> 'outcome' = 'corrected'
    and pg_temp.medidas('DTD-9002') ->> 'cajas' = '4' and pg_temp.medidas('DTD-9002') ->> 'i_pieces' = '4'
    and (pg_temp.medidas('DTD-9002') ->> 's_cbm')::numeric = 1.800,
    'bajar cajas no dejó 4 cajas vivas o cambió otra medida: ' || v_r::text || pg_temp.medidas('DTD-9002')::text);
  perform pg_temp.afirmar((select array_agg(code order by seq) from public.warehouse_boxes
      where receipt_id = pg_temp.fid('WR-DTD-9002') and deleted_at is null) = v_codigos[1:4],
    'bajar cajas no borró las de seq más alto');

  -- Volver a subir tras bajar: con el índice parcial de la 0243 no choca.
  v_r := pg_temp.corregir('operations-A', 'DTD-9002', 5, null, null, 'Vuelve la caja');
  perform pg_temp.afirmar(v_r -> 'r' ->> 'outcome' = 'corrected' and pg_temp.medidas('DTD-9002') ->> 'cajas' = '5',
    'subir cajas tras borrar no dejó 5 cajas vivas: ' || v_r::text);

  v_r := pg_temp.corregir('operations-A', 'DTD-9002', 5, 1.800, 310.50, 'Lo mismo otra vez');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'aceptó corregir a las mismas medidas: ' || v_r::text);
end;
$corregir$;

-- ── 2. Corregir: bloqueos ───────────────────────────────────────────────────
do $corregir_bloqueos$
declare v_r jsonb; v_huella text := pg_temp.huella(); v_ev bigint := pg_temp.eventos();
begin
  v_r := pg_temp.corregir('operations-A', 'DTD-9005', null, 1.700, null, 'Entregado');
  perform pg_temp.afirmar(v_r -> 'r' -> 'blockers' = '{"estado": "delivered"}'::jsonb, 'corrigió un embarque entregado: ' || v_r::text);
  v_r := pg_temp.corregir('operations-A', 'DTD-9006', null, 1.700, null, 'Facturado');
  perform pg_temp.afirmar(v_r -> 'r' -> 'blockers' = '{"factura_emitida": 1}'::jsonb, 'corrigió con factura emitida: ' || v_r::text);
  v_r := pg_temp.corregir('operations-A', 'DTD-9007', 4, null, null, 'Baja una caja escaneada');
  perform pg_temp.afirmar(v_r -> 'r' -> 'blockers' = '{"caja_en_recepcion_ve": 1}'::jsonb,
    'bajó una caja que ya está en Venezuela: ' || v_r::text);
  v_r := pg_temp.corregir('operations-A', 'DTD-9008', 4, null, null, 'Baja una caja estibada');
  perform pg_temp.afirmar(v_r -> 'r' -> 'blockers' = '{"cajas_estibadas": 1}'::jsonb, 'bajó una caja estibada: ' || v_r::text);
  perform pg_temp.afirmar(pg_temp.huella() = v_huella and pg_temp.eventos() = v_ev, 'una corrección bloqueada cambió algo');

  -- El borrador avisa y no bloquea.
  v_r := pg_temp.corregir('operations-A', 'DTD-9003', null, 1.790, null, null, true);
  perform pg_temp.afirmar(v_r -> 'r' ->> 'outcome' = 'preview' and v_r -> 'r' -> 'warnings' ? 'borrador_factura',
    'el borrador de factura no avisó al corregir o bloqueó: ' || v_r::text);
  perform pg_temp.afirmar(v_r -> 'r' -> 'warnings' ->> 'tarifa_congelada' = '1',
    'corregir no avisó la tarifa congelada: ' || v_r::text);

  -- Sin contenedor ni recepción: el CBM sí; las cajas no.
  v_r := pg_temp.corregir('operations-A', 'DTD-9009', null, 0.900, null, 'Embarque suelto');
  perform pg_temp.afirmar(v_r -> 'r' ->> 'outcome' = 'corrected'
    and (pg_temp.medidas('DTD-9009') ->> 's_cbm')::numeric = 0.900, 'no corrigió el CBM de un embarque suelto: ' || v_r::text);
  v_r := pg_temp.corregir('operations-A', 'DTD-9009', 3, null, null, 'Cajas sin recepción');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'aceptó cajas sin contenedor ni recepción: ' || v_r::text);
end;
$corregir_bloqueos$;

-- ── 3. Partir: camino feliz ─────────────────────────────────────────────────
do $partir$
declare v_r jsonb; v_prev jsonb; v_huella text; v_total jsonb := pg_temp.total_contenedor(); v_movidas text[];
  v_nuevo uuid; v_ev record; v_ev0 bigint := pg_temp.eventos();
begin
  v_huella := pg_temp.huella();
  select array_agg(code order by seq) into v_movidas from public.warehouse_boxes
   where receipt_id = pg_temp.fid('WR-DTD-9001') and seq in (4, 5);

  v_prev := pg_temp.partir('operations-A', 'DTD-9001', 'C-B', 2, 0.400, 80.00, null, null, true);
  perform pg_temp.afirmar(v_prev -> 'r' ->> 'outcome' = 'preview', 'operaciones no pudo ver la vista previa de partir: ' || v_prev::text);
  perform pg_temp.afirmar(pg_temp.huella() = v_huella and pg_temp.eventos() = v_ev0, 'la vista previa de partir escribió algo');
  perform pg_temp.afirmar(v_prev -> 'r' -> 'parts' -> 'nueva' ->> 'code' = 'DTD-9001-C'
    and v_prev -> 'r' -> 'parts' -> 'original' = '{"code": "DTD-9001", "boxes": 3, "cbm": 1.380, "weight_kg": 220.00}'::jsonb
    and v_prev -> 'r' -> 'parts' -> 'box_codes' = to_jsonb(v_movidas),
    'la vista previa de partir no calculó las dos partes: ' || (v_prev -> 'r' -> 'parts')::text);

  v_r := pg_temp.partir('operations-A', 'DTD-9001', 'C-B', 2, 0.400, 80.00, 'La carga es de dos clientes del mismo grupo');
  perform pg_temp.afirmar(v_r -> 'r' ->> 'outcome' = 'split', 'operaciones no pudo partir: ' || v_r::text);
  v_nuevo := (v_r -> 'r' ->> 'new_shipment_id')::uuid;
  perform pg_temp.afirmar(pg_temp.total_contenedor() = v_total, 'partir cambió el total del contenedor');
  perform pg_temp.afirmar(pg_temp.medidas('DTD-9001') = '{"s_cbm": 1.380, "s_kg": 220.00, "i_cbm": 1.380, "i_kg": 220.00,
      "i_pieces": 3, "r_boxes": 3, "r_cbm": 1.380, "r_kg": 220.00, "cajas": 3}'::jsonb,
    'el original no quedó con el resto: ' || pg_temp.medidas('DTD-9001')::text);
  perform pg_temp.afirmar((select s.code = 'DTD-9001-C' and s.client_markbox = 'SINT-1002' and s.client_name = 'Cliente Ficticio B'
      and s.status = 'in_transit' and s.shipment_service = 'consolidacion' and s.group_reference = 'DTD-9001'
      from public.shipments s where s.id = v_nuevo), 'la parte nueva no tiene código, dueño, estado o grupo');
  perform pg_temp.afirmar((select n.notes is null and o.notes = 'Nota sintética'
      from public.shipments n, public.shipments o where n.id = v_nuevo and o.id = pg_temp.fid('DTD-9001')),
    'la parte nueva heredó las notas del original');
  perform pg_temp.afirmar((select n.destination_gps = o.destination_gps
      and n.arrived_destination_at = o.arrived_destination_at and n.planned_arrival_at = o.planned_arrival_at
      and n.planning_timezone = o.planning_timezone
      from public.shipments n, public.shipments o where n.id = v_nuevo and o.id = pg_temp.fid('DTD-9001')),
    'la parte nueva no heredó la llegada, la planificación o el GPS');
  perform pg_temp.afirmar(pg_temp.medidas('DTD-9001-C') = '{"s_cbm": 0.400, "s_kg": 80.00, "i_cbm": 0.400, "i_kg": 80.00,
      "i_pieces": 2, "r_boxes": 2, "r_cbm": 0.400, "r_kg": 80.00, "cajas": 2}'::jsonb,
    'la parte nueva no tiene sus medidas: ' || pg_temp.medidas('DTD-9001-C')::text);
  perform pg_temp.afirmar((select array_agg(b.code order by b.seq) = v_movidas and bool_and(b.markbox = 'SINT-1002')
      from public.warehouse_boxes b join public.warehouse_receipts_cn r on r.id = b.receipt_id
     where r.shipment_id = v_nuevo and b.deleted_at is null), 'las cajas no se movieron con su código y el dueño nuevo');
  perform pg_temp.afirmar((select receipt_code from public.warehouse_receipts_cn where shipment_id = v_nuevo) = 'WR-C9-DTD-9001-C',
    'la recepción nueva no tiene el código esperado');
  perform pg_temp.afirmar((select group_reference from public.shipments where id = pg_temp.fid('DTD-9001')) = 'DTD-9001',
    'el original no quedó con su código como grupo');
  perform pg_temp.afirmar((select count(*) from public.shipment_events e where e.shipment_id = v_nuevo and e.note = 'Zarpó (sintético)') = 1
    and (select count(*) from public.shipment_events e where e.shipment_id = v_nuevo and e.note = 'Nace de partir DTD-9001') = 1,
    'la parte nueva no heredó la línea de tiempo');
  perform pg_temp.afirmar((select count(*) from public.warehouse_boxes where deleted_at is not null
      and receipt_id in (pg_temp.fid('WR-DTD-9001'), (select id from public.warehouse_receipts_cn where shipment_id = v_nuevo))) = 0,
    'el trigger de 0240 borró cajas al partir');

  select * into v_ev from public.entity_audit_log where event_type = 'shipment_split_out';
  perform pg_temp.afirmar(v_ev.entity_id = pg_temp.fid('DTD-9001') and v_ev.payload ->> 'new_shipment_code' = 'DTD-9001-C'
    and v_ev.reason = 'La carga es de dos clientes del mismo grupo', 'falta el evento shipment_split_out');
  select * into v_ev from public.entity_audit_log where event_type = 'shipment_split_in';
  perform pg_temp.afirmar(v_ev.entity_id = v_nuevo and v_ev.payload ->> 'from_shipment_code' = 'DTD-9001',
    'falta el evento shipment_split_in');
  perform pg_temp.afirmar(position('Cliente Ficticio' in (select string_agg(payload::text || coalesce(before_data::text, '')
      || coalesce(after_data::text, ''), '') from public.entity_audit_log)) = 0, 'un evento lleva el nombre del cliente');

  -- Con códigos de caja elegidos y el borrador de factura (aviso, no bloqueo).
  v_r := pg_temp.partir('admin-A', 'DTD-9003', 'C-A', 1, 0.000, 0.00, 'Separar una caja del mismo cliente',
    array[(select code from public.warehouse_boxes where receipt_id = pg_temp.fid('WR-DTD-9003') and seq = 1)]);
  perform pg_temp.afirmar(v_r -> 'r' ->> 'outcome' = 'split' and v_r -> 'r' ->> 'new_shipment_code' = 'DTD-9003-B',
    'no partió con un código de caja elegido: ' || v_r::text);
  perform pg_temp.afirmar(v_r -> 'r' -> 'warnings' ? 'borrador_factura',
    'el borrador de factura no avisó al partir: ' || v_r::text);
  perform pg_temp.afirmar(v_r -> 'r' -> 'warnings' ->> 'tarifa_congelada' = '1',
    'partir no avisó la tarifa congelada: ' || v_r::text);
  perform pg_temp.afirmar((select seq from public.warehouse_boxes b join public.warehouse_receipts_cn r on r.id = b.receipt_id
      where r.shipment_id = (v_r -> 'r' ->> 'new_shipment_id')::uuid) = 1, 'no movió la caja elegida');
  perform pg_temp.afirmar((select lines from public.invoices where id = pg_temp.fid('inv-draft'))
      = '[{"desc":"Flete","qty":1.78,"unitPrice":10,"shipmentCode":"DTD-9003"}]'::jsonb, 'partir tocó el borrador');
end;
$partir$;

-- ── 4. Partir: bloqueos y validaciones ──────────────────────────────────────
do $partir_bloqueos$
declare v_r jsonb; v_huella text := pg_temp.huella(); v_ev bigint := pg_temp.eventos();
begin
  v_r := pg_temp.partir('operations-A', 'DTD-9004', 'C-B', 1, 0.100, 10.00, 'Desalineado');
  perform pg_temp.afirmar(v_r -> 'r' -> 'blockers' = '{"medidas_desalineadas": 1}'::jsonb,
    'partió un embarque con medidas desalineadas: ' || v_r::text);
  v_r := pg_temp.partir('operations-A', 'DTD-9005', 'C-B', 1, 0.100, 10.00, 'Entregado');
  perform pg_temp.afirmar(v_r -> 'r' -> 'blockers' = '{"estado": "delivered"}'::jsonb, 'partió un embarque entregado: ' || v_r::text);
  v_r := pg_temp.partir('operations-A', 'DTD-9006', 'C-B', 1, 0.100, 10.00, 'Facturado');
  perform pg_temp.afirmar(v_r -> 'r' -> 'blockers' = '{"factura_emitida": 1}'::jsonb, 'partió con factura emitida: ' || v_r::text);
  v_r := pg_temp.partir('operations-A', 'DTD-9007', 'C-B', 1, 0.100, 10.00, 'Caja escaneada');
  perform pg_temp.afirmar(v_r -> 'r' -> 'blockers' = '{"caja_escaneada_ve": 1}'::jsonb,
    'partió moviendo una caja escaneada en Venezuela: ' || v_r::text);
  v_r := pg_temp.partir('operations-A', 'DTD-9009', 'C-B', 1, 0.100, 10.00, 'Suelto');
  perform pg_temp.afirmar(v_r -> 'r' -> 'blockers' = '{"sin_contenedor": 1, "recepciones": 0}'::jsonb,
    'partió un embarque sin contenedor: ' || v_r::text);
  v_r := pg_temp.partir('operations-A', 'DTD-9011', 'C-B', 1, 0.100, 10.00, 'Caja ajena', array['DTD-B-999999']);
  perform pg_temp.afirmar(v_r -> 'r' -> 'blockers' = '{"caja_ajena": 1}'::jsonb, 'partió con una caja ajena: ' || v_r::text);
  perform pg_temp.afirmar(pg_temp.huella() = v_huella and pg_temp.eventos() = v_ev, 'un partir bloqueado cambió algo');

  -- Caja esperada en Venezuela sin escanear: sí se puede, y sigue al dueño nuevo.
  v_r := pg_temp.partir('operations-A', 'DTD-9007', 'C-B', 1, 0.100, 10.00, 'Caja esperada sin escanear',
    array[(select code from public.warehouse_boxes where receipt_id = pg_temp.fid('WR-DTD-9007') and seq = 4)]);
  perform pg_temp.afirmar(v_r -> 'r' ->> 'outcome' = 'split'
    and (select vb.markbox from public.warehouse_receipt_ve_boxes vb join public.warehouse_boxes b on b.code = vb.code
          where b.receipt_id <> pg_temp.fid('WR-DTD-9007') and vb.scanned_at is null) = 'SINT-1002',
    'la caja esperada en Venezuela no siguió al dueño nuevo: ' || v_r::text);

  v_huella := pg_temp.huella(); v_ev := pg_temp.eventos();
  v_r := pg_temp.partir('operations-A', 'DTD-9011', 'C-B', 5, 0.100, 10.00, 'Todas las cajas');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'aceptó partir todas las cajas: ' || v_r::text);
  v_r := pg_temp.partir('operations-A', 'DTD-9011', 'C-B', 1, 1.781, 10.00, 'Más CBM que el total');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'aceptó más CBM que el total: ' || v_r::text);
  v_r := pg_temp.partir('operations-A', 'DTD-9011', 'C-B', 1, 0.1234, 10.00, 'Cuatro decimales');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'aceptó un CBM con 4 decimales: ' || v_r::text);
  v_r := pg_temp.partir('operations-A', 'DTD-9011', 'C-B', 2, 0.100, 10.00, 'Códigos de menos', array['X']);
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'aceptó menos códigos que cajas: ' || v_r::text);
  v_r := pg_temp.partir('operations-A', 'DTD-9011', 'C-SIN-MB', 1, 0.100, 10.00, 'Sin marca');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'aceptó un cliente sin Shipping Mark: ' || v_r::text);
  v_r := pg_temp.partir('operations-A', 'DTD-9011', 'C-FUSION', 1, 0.100, 10.00, 'Fusionado');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'aceptó una ficha fusionada: ' || v_r::text);
  v_r := pg_temp.partir('operations-A', 'DTD-9011', 'C-GONE', 1, 0.100, 10.00, 'Eliminado');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = 'P0002', 'aceptó un cliente eliminado: ' || v_r::text);
  v_r := pg_temp.partir('operations-A', 'DTD-9011', 'C-TB', 1, 0.100, 10.00, 'Cliente de otro tenant');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = 'P0002', 'aceptó un cliente de otro tenant: ' || v_r::text);
  v_r := pg_temp.partir('operations-A', 'DTD-9011', 'C-B', 1, 0.100, 10.00, 'abc');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'aceptó un motivo de 3 caracteres: ' || v_r::text);
  perform pg_temp.afirmar(pg_temp.huella() = v_huella and pg_temp.eventos() = v_ev, 'una validación fallida de partir cambió algo');
end;
$partir_bloqueos$;

-- ── 5. Roles y tenant ───────────────────────────────────────────────────────
do $roles$
declare v_r jsonb; v_actor text; v_huella text := pg_temp.huella(); v_ev bigint := pg_temp.eventos();
begin
  foreach v_actor in array array['commercial-A', 'accounting-A', 'warehouse-A', 'admin-off'] loop
    v_r := pg_temp.corregir(v_actor, 'DTD-9011', null, 1.700, null, 'Sin permiso');
    perform pg_temp.afirmar(v_r ->> 'sqlstate' = '42501', v_actor || ' pudo corregir: ' || v_r::text);
    v_r := pg_temp.partir(v_actor, 'DTD-9011', 'C-B', 1, 0.100, 10.00, 'Sin permiso');
    perform pg_temp.afirmar(v_r ->> 'sqlstate' = '42501', v_actor || ' pudo partir: ' || v_r::text);
  end loop;
  v_r := pg_temp.corregir(null, 'DTD-9011', null, 1.700, null, 'Sin sesión');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '42501', 'sin sesión no dio 42501: ' || v_r::text);
  v_r := pg_temp.corregir('operations-A', 'DTD-9011', null, 1.700, null, 'Por anon', false, 'anon');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '42501', 'anon pudo corregir: ' || v_r::text);
  v_r := pg_temp.corregir('admin-B', 'DTD-9011', null, 1.700, null, 'Otro tenant');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = 'P0002', 'un admin de otro tenant corrigió un embarque ajeno: ' || v_r::text);
  v_r := pg_temp.partir('admin-B', 'DTD-9011', 'C-TB', 1, 0.100, 10.00, 'Otro tenant');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = 'P0002', 'un admin de otro tenant partió un embarque ajeno: ' || v_r::text);
  v_r := pg_temp.corregir('operations-A', 'DTD-9011', null, 1.700, null, 'abc');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'corregir aceptó un motivo de 3 caracteres: ' || v_r::text);
  v_r := pg_temp.corregir('operations-A', 'DTD-9011', null, 1.7001, null, 'Cuatro decimales');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'corregir aceptó 4 decimales: ' || v_r::text);
  v_r := pg_temp.corregir('operations-A', 'DTD-9011', 0, null, null, 'Cero cajas');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'corregir aceptó cero cajas: ' || v_r::text);
  v_r := pg_temp.corregir('operations-A', 'DTD-9011', null, null, null, 'Nada');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'corregir aceptó no corregir nada: ' || v_r::text);
  perform pg_temp.afirmar(pg_temp.huella() = v_huella and pg_temp.eventos() = v_ev, 'un intento rechazado cambió algo');
end;
$roles$;

-- ── 6. Todo o nada: si el evento falla, nada cambia ─────────────────────────
do $atomico$
declare v_r jsonb; v_huella text; v_ev bigint;
begin
  update public.audit_entity_types set status = 'deprecated', deprecated_at = now() where entity_type = 'shipment';
  v_huella := pg_temp.huella(); v_ev := pg_temp.eventos();
  v_r := pg_temp.partir('operations-A', 'DTD-9010', 'C-B', 1, 0.100, 10.00, 'El evento va a fallar');
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean, 'con el writer roto se partió el embarque: ' || v_r::text);
  v_r := pg_temp.corregir('operations-A', 'DTD-9010', 6, null, null, 'El evento va a fallar');
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean, 'con el writer roto se corrigió el embarque: ' || v_r::text);
  perform pg_temp.afirmar(pg_temp.huella() = v_huella and pg_temp.eventos() = v_ev, 'un cambio fallido dejó filas o eventos');
  update public.audit_entity_types set status = 'active', deprecated_at = null where entity_type = 'shipment';
end;
$atomico$;

-- ── 7. Forma, ACL y grupo de WeChat ─────────────────────────────────────────
do $forma$
declare v_fn oid; v_name text; v_state text;
begin
  foreach v_name in array array['public.correct_shipment_measures(uuid,integer,numeric,numeric,text,boolean)',
      'public.split_shipment(uuid,uuid,integer,numeric,numeric,text,text[],boolean)'] loop
    v_fn := to_regprocedure(v_name);
    perform pg_temp.afirmar((select prosecdef and proconfig @> array['search_path=""']::text[] from pg_proc where oid = v_fn),
      v_name || ' no es SECURITY DEFINER con search_path vacío');
    perform pg_temp.afirmar(has_function_privilege('authenticated', v_fn, 'EXECUTE')
      and not has_function_privilege('anon', v_fn, 'EXECUTE')
      and not has_function_privilege('service_role', v_fn, 'EXECUTE'), 'EXECUTE de ' || v_name || ' no es sólo de authenticated');
  end loop;
  begin
    update public.shipments set group_reference = '   ' where id = pg_temp.fid('DTD-9011');
    v_state := 'ok';
  exception when check_violation then v_state := '23514';
  end;
  perform pg_temp.afirmar(v_state = '23514', 'el grupo de WeChat aceptó texto vacío');
  begin
    update public.shipments set group_reference = repeat('x', 121) where id = pg_temp.fid('DTD-9011');
    v_state := 'ok';
  exception when check_violation then v_state := '23514';
  end;
  perform pg_temp.afirmar(v_state = '23514', 'el grupo de WeChat aceptó 121 caracteres');
  update public.shipments set group_reference = 'Grupo sintético 9011' where id = pg_temp.fid('DTD-9011');
  perform pg_temp.afirmar((select group_reference from public.shipments where id = pg_temp.fid('DTD-9011')) = 'Grupo sintético 9011',
    'el grupo de WeChat no guardó un texto válido');
end;
$forma$;

select 'TEST 0563 GREEN: ' || currval('pg_temp.aserciones') || ' aserciones' as resultado;
rollback;
