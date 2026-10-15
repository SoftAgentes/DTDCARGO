\set ON_ERROR_STOP on

-- Contrato desechable de la 0476 (SDD-0522): borrado auditado de embarques y
-- recepciones del Almacén CN. Fixture sintética y ROLLBACK: nunca consulta ni
-- modifica una base alojada.
--
-- Aplica las migraciones REALES de auditoría (0258, 0261, 0267, 0294), de
-- embarques (0002, 0003, 0009), del Almacén CN (0008), la 0230, las cajas
-- (0240) y la guarda de entrega (0321). Las tablas que sólo leen las guardas
-- (facturas, gastos, aduana, despacho…) van como dobles mínimos con las mismas
-- columnas: el preflight de la 0476 exige esas columnas por nombre y
-- `schema-rebuild` de verify aplica la 0476 sobre el schema completo.
--
-- RED: `-v apply_fix=false` no aplica la 0476 y la primera aserción falla
-- porque el equipo borra físicamente un embarque por la API.
-- DRIFT (sólo PGlite, lib/studio/__tests__/borrado-embarques-recepciones.migration.test.ts):
-- `-v drift_<caso>=true` rompe el catálogo antes de aplicar y la 0476 aborta
-- en el preflight con su mensaje.
--
-- Lo que defiende:
--   1. Sin borrado físico ni UPDATE directo de deleted_at desde la API.
--   2. Forma final, ACL, triggers, timeouts restaurados, catálogo vecino
--      intacto y reaplicación sin cambios.
--   3. Sólo un admin activo de una sola membresía borra, con motivo de 4 a
--      1000 caracteres y de 1 a 100 ids.
--   4. Cada guarda bloquea y su contraparte (anulada, cancelada, eliminada) no.
--   5. Todo o nada; not_found para otro tenant o inexistente.
--   6. Evento por fila con actor, motivo, antes/después, correlación del lote
--      y sin datos personales; fallo del evento revierte todo.
--   7. Efectos: eventos del timeline, avisos programados cancelados, cajas
--      retiradas; lo enviado y los adjuntos se conservan.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.shipments') is not null or to_regclass('public.tenants') is not null
     or to_regclass('public.entity_audit_log') is not null then
    raise exception 'TEST 0476: fixture rechazada, la base ya contiene objetos de aplicación';
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

-- Columnas de 0001/0019/0200, con el CHECK de rol de producción.
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
-- La semántica de 0453: el tenant de la ÚNICA membresía activa.
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1] from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
revoke execute on function public.get_user_tenant_id() from public, anon;
grant execute on function public.get_user_tenant_id() to authenticated;

-- Plataforma de auditoría real, sobre el entity_audit_log legacy.
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

-- Embarques, eventos y Almacén CN reales, en el orden de producción.
\ir ../migrations/0002_shipments.sql
\ir ../migrations/0003_shipment_events_on_insert.sql
\ir ../migrations/0008_warehouses_cn.sql
\ir ../migrations/0009_shipment_delivery_pod.sql
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
\ir ../migrations/0240_warehouse_boxes.sql
\ir ../migrations/0321_warehouse_ve_delivery_governance.sql

-- ── Dobles mínimos de lo que leen las guardas (columnas de producción) ─────
create type public.invoice_status as enum ('borrador', 'emitida', 'parcial', 'pagada', 'vencida', 'anulada');
create table public.invoices (
  id uuid primary key, tenant_id uuid not null, shipment_id uuid references public.shipments(id) on delete set null,
  status public.invoice_status not null default 'borrador', deleted_at timestamptz
);
create table public.expenses (
  id uuid primary key, tenant_id uuid not null, shipment_id uuid references public.shipments(id) on delete set null,
  deleted_at timestamptz
);
create table public.supplier_bills (
  id uuid primary key, tenant_id uuid not null, shipment_id uuid references public.shipments(id) on delete set null,
  status text not null default 'pendiente', deleted_at timestamptz
);
create table public.shipment_costs (
  id uuid primary key, tenant_id uuid not null,
  shipment_id uuid not null references public.shipments(id) on delete cascade, deleted_at timestamptz
);
create table public.currency_conversions (
  id uuid primary key, tenant_id uuid not null, shipment_id uuid references public.shipments(id) on delete set null,
  deleted_at timestamptz
);
create table public.partner_ledger_entries (
  id uuid primary key, tenant_id uuid not null, shipment_id uuid references public.shipments(id) on delete set null,
  deleted_at timestamptz
);
create table public.supplier_claim_offsets (
  id uuid primary key, tenant_id uuid not null, shipment_id uuid references public.shipments(id) on delete set null,
  deleted_at timestamptz
);
create table public.customs_filings (
  id uuid primary key, tenant_id uuid not null,
  shipment_id uuid not null references public.shipments(id) on delete cascade, deleted_at timestamptz
);
create type public.tms_route_status as enum ('planificado', 'en_ruta', 'completado', 'cancelado');
create table public.tms_routes (
  id uuid primary key, tenant_id uuid not null,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status public.tms_route_status not null default 'planificado', deleted_at timestamptz
);
create table public.client_claims (
  id uuid primary key, tenant_id uuid not null, shipment_id uuid references public.shipments(id) on delete set null,
  deleted_at timestamptz
);
create table public.consolidations (id uuid primary key, tenant_id uuid not null, deleted_at timestamptz);
create table public.consolidation_items (
  id uuid primary key, tenant_id uuid not null,
  consolidation_id uuid not null references public.consolidations(id) on delete cascade,
  shipment_id uuid references public.shipments(id) on delete set null
);
create table public.prealertas (
  id uuid primary key, tenant_id uuid not null, shipment_id uuid,
  status text not null default 'anunciada'
    check (status in ('anunciada', 'en_camino', 'recibida', 'consolidada', 'cancelada')),
  deleted_at timestamptz
);
create type public.document_entity_type as enum ('shipment', 'invoice', 'none');
create table public.documents (
  id uuid primary key, tenant_id uuid not null,
  entity_type public.document_entity_type not null default 'none', entity_id uuid, deleted_at timestamptz
);
create table public.shipment_documents (
  id uuid primary key, tenant_id uuid not null,
  shipment_id uuid not null references public.shipments(id) on delete cascade, deleted_at timestamptz
);
create table public.client_notification_schedule (
  id uuid primary key, tenant_id uuid not null,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'skipped', 'canceled', 'failed')),
  error text
);
create table public.quotes (
  id uuid primary key, tenant_id uuid not null,
  converted_to_shipment_id uuid references public.shipments(id) on delete set null, deleted_at timestamptz
);
create type public.dispatch_order_status as enum ('creada', 'cargando', 'lista', 'en_ruta', 'entregada', 'cerrada', 'cancelada');
create table public.dispatch_orders (
  id uuid primary key, tenant_id uuid not null,
  status public.dispatch_order_status not null default 'creada'
);
create table public.dispatch_order_packages (
  od_id uuid not null references public.dispatch_orders(id) on delete cascade,
  package_kind text not null check (package_kind in ('warehouse_receipt_cn', 'warehouse_receipt_ve')),
  package_id uuid not null,
  primary key (od_id, package_id)
);
create table public.sales_orders (
  id uuid primary key, tenant_id uuid not null,
  status text not null default 'confirmada'
    check (status in ('confirmada', 'parcial', 'facturada', 'cerrada', 'cancelada')),
  deleted_at timestamptz
);
-- 0127: la recepción materializa una compra y, si aplica, una orden de venta.
alter table public.warehouse_receipts_cn
  add column prealerta_id uuid references public.prealertas(id) on delete set null,
  add column sales_order_id uuid references public.sales_orders(id) on delete set null;
create table public.warehouse_receipts_ve (id uuid primary key, tenant_id uuid not null, deleted_at timestamptz);
create table public.warehouse_receipt_ve_boxes (
  id uuid primary key, tenant_id uuid not null,
  receipt_id uuid not null references public.warehouse_receipts_ve(id) on delete cascade,
  source_receipt_cn_id uuid references public.warehouse_receipts_cn(id) on delete set null
);
create table public.consolidation_box_positions (
  id uuid primary key, tenant_id uuid not null,
  consolidation_id uuid not null references public.consolidations(id) on delete cascade,
  box_id uuid not null references public.warehouse_boxes(id) on delete cascade,
  unstuffed_at timestamptz
);

-- Supabase le da a service_role todo sobre public por default privileges; anon
-- no tiene DML en producción (0465).
grant all on all tables in schema public to service_role;

-- ── Datos sintéticos ────────────────────────────────────────────────────────
create function pg_temp.fid(p_label text) returns uuid language sql immutable as $$
  select md5('0476-synthetic-' || p_label)::uuid
$$;

insert into auth.users (id)
select pg_temp.fid(u) from unnest(array['admin-A', 'admin-off', 'admin-dual', 'operations-A', 'commercial-A',
  'accounting-A', 'warehouse-A', 'support-A', 'marketing-A', 'admin-B']) u;
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fid('tenant-A'), 'tenant-a-0476', 'Tenant A 0476'),
  (pg_temp.fid('tenant-B'), 'tenant-b-0476', 'Tenant B 0476');
insert into public.user_tenants (user_id, tenant_id, role, disabled_at)
select pg_temp.fid(v.u), pg_temp.fid(v.t), v.r, case when v.off then now() end from (values
  ('admin-A', 'tenant-A', 'admin', false), ('admin-off', 'tenant-A', 'admin', true),
  ('admin-dual', 'tenant-A', 'admin', false), ('admin-dual', 'tenant-B', 'operations', false),
  ('operations-A', 'tenant-A', 'operations', false), ('commercial-A', 'tenant-A', 'commercial', false),
  ('accounting-A', 'tenant-A', 'accounting', false), ('warehouse-A', 'tenant-A', 'warehouse', false),
  ('support-A', 'tenant-A', 'support', false), ('marketing-A', 'tenant-A', 'marketing', false),
  ('admin-B', 'tenant-B', 'admin', false)
) v(u, t, r, off);

-- Embarques del tenant A: el código es la etiqueta y el id es fid(etiqueta).
insert into public.shipments (id, tenant_id, code, client_name, client_markbox, shipment_service, status, deleted_at)
select pg_temp.fid(v.code), pg_temp.fid(v.t), v.code, 'Cliente Ficticio 0476', 'DTD-0476',
  'consolidacion', v.st::public.shipment_status, case when v.gone then now() - interval '1 day' end
from (values
  ('S-OK-1', 'tenant-A', 'in_transit', false), ('S-OK-2', 'tenant-A', 'draft', false),
  ('S-OK-3', 'tenant-A', 'cancelled', false), ('S-OK-4', 'tenant-A', 'draft', false),
  ('S-DEL', 'tenant-A', 'delivered', false),
  ('S-INV', 'tenant-A', 'in_transit', false), ('S-INV-NUL', 'tenant-A', 'in_transit', false),
  ('S-EXP', 'tenant-A', 'in_transit', false), ('S-EXP-OFF', 'tenant-A', 'in_transit', false),
  ('S-BILL', 'tenant-A', 'in_transit', false), ('S-BILL-NUL', 'tenant-A', 'in_transit', false),
  ('S-COST', 'tenant-A', 'in_transit', false),
  ('S-CNY1', 'tenant-A', 'in_transit', false), ('S-CNY2', 'tenant-A', 'in_transit', false),
  ('S-CNY3', 'tenant-A', 'in_transit', false),
  ('S-CUS', 'tenant-A', 'in_customs', false),
  ('S-TMS', 'tenant-A', 'out_for_delivery', false), ('S-TMS-CAN', 'tenant-A', 'out_for_delivery', false),
  ('S-CLM', 'tenant-A', 'in_transit', false),
  ('S-NAV', 'tenant-A', 'consolidating', false), ('S-NAV-OFF', 'tenant-A', 'consolidating', false),
  ('S-REC', 'tenant-A', 'consolidating', false), ('S-REC-OFF', 'tenant-A', 'consolidating', false),
  ('S-PRE', 'tenant-A', 'draft', false), ('S-PRE-CAN', 'tenant-A', 'draft', false),
  ('S-GONE', 'tenant-A', 'draft', true), ('S-GONE-2', 'tenant-A', 'draft', true),
  ('S-SYS', 'tenant-A', 'draft', false),
  ('S-B', 'tenant-B', 'draft', false)
) v(code, t, st, gone);

insert into public.invoices (id, tenant_id, shipment_id, status, deleted_at) values
  (pg_temp.fid('inv-1'), pg_temp.fid('tenant-A'), pg_temp.fid('S-INV'), 'emitida', null),
  (pg_temp.fid('inv-2'), pg_temp.fid('tenant-A'), pg_temp.fid('S-INV-NUL'), 'anulada', null),
  (pg_temp.fid('inv-3'), pg_temp.fid('tenant-A'), pg_temp.fid('S-INV-NUL'), 'borrador', now());
insert into public.expenses (id, tenant_id, shipment_id, deleted_at) values
  (pg_temp.fid('exp-1'), pg_temp.fid('tenant-A'), pg_temp.fid('S-EXP'), null),
  (pg_temp.fid('exp-2'), pg_temp.fid('tenant-A'), pg_temp.fid('S-EXP-OFF'), now());
insert into public.supplier_bills (id, tenant_id, shipment_id, status) values
  (pg_temp.fid('bill-1'), pg_temp.fid('tenant-A'), pg_temp.fid('S-BILL'), 'pendiente'),
  (pg_temp.fid('bill-2'), pg_temp.fid('tenant-A'), pg_temp.fid('S-BILL-NUL'), 'anulada');
insert into public.shipment_costs (id, tenant_id, shipment_id) values
  (pg_temp.fid('cost-1'), pg_temp.fid('tenant-A'), pg_temp.fid('S-COST'));
insert into public.currency_conversions (id, tenant_id, shipment_id) values
  (pg_temp.fid('cny-1'), pg_temp.fid('tenant-A'), pg_temp.fid('S-CNY1'));
insert into public.partner_ledger_entries (id, tenant_id, shipment_id) values
  (pg_temp.fid('cny-2'), pg_temp.fid('tenant-A'), pg_temp.fid('S-CNY2'));
insert into public.supplier_claim_offsets (id, tenant_id, shipment_id) values
  (pg_temp.fid('cny-3'), pg_temp.fid('tenant-A'), pg_temp.fid('S-CNY3'));
insert into public.customs_filings (id, tenant_id, shipment_id) values
  (pg_temp.fid('cus-1'), pg_temp.fid('tenant-A'), pg_temp.fid('S-CUS'));
insert into public.tms_routes (id, tenant_id, shipment_id, status) values
  (pg_temp.fid('tms-1'), pg_temp.fid('tenant-A'), pg_temp.fid('S-TMS'), 'planificado'),
  (pg_temp.fid('tms-2'), pg_temp.fid('tenant-A'), pg_temp.fid('S-TMS-CAN'), 'cancelado');
insert into public.client_claims (id, tenant_id, shipment_id) values
  (pg_temp.fid('clm-1'), pg_temp.fid('tenant-A'), pg_temp.fid('S-CLM'));
insert into public.consolidations (id, tenant_id, deleted_at) values
  (pg_temp.fid('cons-live'), pg_temp.fid('tenant-A'), null),
  (pg_temp.fid('cons-off'), pg_temp.fid('tenant-A'), now());
insert into public.consolidation_items (id, tenant_id, consolidation_id, shipment_id) values
  (pg_temp.fid('ci-1'), pg_temp.fid('tenant-A'), pg_temp.fid('cons-live'), pg_temp.fid('S-NAV')),
  (pg_temp.fid('ci-2'), pg_temp.fid('tenant-A'), pg_temp.fid('cons-off'), pg_temp.fid('S-NAV-OFF'));
insert into public.prealertas (id, tenant_id, shipment_id, status, deleted_at) values
  (pg_temp.fid('pre-1'), pg_temp.fid('tenant-A'), pg_temp.fid('S-PRE'), 'consolidada', null),
  (pg_temp.fid('pre-2'), pg_temp.fid('tenant-A'), pg_temp.fid('S-PRE-CAN'), 'cancelada', null),
  (pg_temp.fid('pre-r1'), pg_temp.fid('tenant-A'), null, 'recibida', null),
  (pg_temp.fid('pre-r2'), pg_temp.fid('tenant-A'), null, 'cancelada', null),
  (pg_temp.fid('pre-r3'), pg_temp.fid('tenant-A'), null, 'recibida', now());
-- Avisos: lo programado se cancela al borrar; lo enviado se conserva.
insert into public.client_notification_schedule (id, tenant_id, shipment_id, status) values
  (pg_temp.fid('noti-1'), pg_temp.fid('tenant-A'), pg_temp.fid('S-OK-1'), 'scheduled'),
  (pg_temp.fid('noti-2'), pg_temp.fid('tenant-A'), pg_temp.fid('S-OK-1'), 'sent'),
  (pg_temp.fid('noti-3'), pg_temp.fid('tenant-A'), pg_temp.fid('S-INV'), 'scheduled');
insert into public.documents (id, tenant_id, entity_type, entity_id) values
  (pg_temp.fid('doc-1'), pg_temp.fid('tenant-A'), 'shipment', pg_temp.fid('S-OK-2'));
insert into public.shipment_documents (id, tenant_id, shipment_id) values
  (pg_temp.fid('sdoc-1'), pg_temp.fid('tenant-A'), pg_temp.fid('S-OK-2'));
insert into public.quotes (id, tenant_id, converted_to_shipment_id) values
  (pg_temp.fid('quo-1'), pg_temp.fid('tenant-A'), pg_temp.fid('S-OK-2'));
insert into public.dispatch_orders (id, tenant_id, status) values
  (pg_temp.fid('od-live'), pg_temp.fid('tenant-A'), 'en_ruta'),
  (pg_temp.fid('od-can'), pg_temp.fid('tenant-A'), 'cancelada');
insert into public.sales_orders (id, tenant_id, status) values
  (pg_temp.fid('so-live'), pg_temp.fid('tenant-A'), 'facturada'),
  (pg_temp.fid('so-can'), pg_temp.fid('tenant-A'), 'cancelada');
insert into public.warehouse_receipts_ve (id, tenant_id, deleted_at) values
  (pg_temp.fid('ve-live'), pg_temp.fid('tenant-A'), null),
  (pg_temp.fid('ve-off'), pg_temp.fid('tenant-A'), now());

-- Recepciones del tenant A. El trigger de 0240 crea una caja por cada `boxes`.
insert into public.warehouse_receipts_cn (id, tenant_id, receipt_code, warehouse_id, client_markbox, client_name,
  boxes, status, shipment_id, prealerta_id, sales_order_id, deleted_at)
select pg_temp.fid(v.code), pg_temp.fid(v.t), v.code, (select id from public.warehouses_cn where code = 'YIW-A1'),
  'DTD-0476', 'Cliente Ficticio 0476', v.boxes, 'pendiente_consolidacion'::public.warehouse_receipt_status,
  case when v.ship is null then null else pg_temp.fid(v.ship) end,
  case when v.pre is null then null else pg_temp.fid(v.pre) end,
  case when v.so is null then null else pg_temp.fid(v.so) end,
  case when v.gone then now() - interval '1 day' end
from (values
  ('WR-OK-1', 'tenant-A', 2, null, null, null, false), ('WR-OK-2', 'tenant-A', 1, null, null, null, false),
  ('WR-OK-3', 'tenant-A', 0, null, null, null, false),
  ('WR-CONS', 'tenant-A', 1, 'S-REC', null, null, false),
  ('WR-CONS-OFF', 'tenant-A', 1, 'S-GONE-2', null, null, false),
  ('WR-OF-REC-OFF', 'tenant-A', 1, 'S-REC-OFF', null, null, true),
  ('WR-OD', 'tenant-A', 1, null, null, null, false), ('WR-OD-CAN', 'tenant-A', 1, null, null, null, false),
  ('WR-PRE', 'tenant-A', 1, null, 'pre-r1', null, false),
  ('WR-PRE-CAN', 'tenant-A', 1, null, 'pre-r2', null, false),
  ('WR-PRE-OFF', 'tenant-A', 1, null, 'pre-r3', null, false),
  ('WR-SO', 'tenant-A', 1, null, null, 'so-live', false), ('WR-SO-CAN', 'tenant-A', 1, null, null, 'so-can', false),
  ('WR-VE', 'tenant-A', 1, null, null, null, false), ('WR-VE-OFF', 'tenant-A', 1, null, null, null, false),
  ('WR-STOW', 'tenant-A', 2, null, null, null, false), ('WR-STOW-OUT', 'tenant-A', 1, null, null, null, false),
  ('WR-STOW-OFF', 'tenant-A', 1, null, null, null, false),
  ('WR-GONE', 'tenant-A', 0, null, null, null, true),
  ('WR-B', 'tenant-B', 1, null, null, null, false)
) v(code, t, boxes, ship, pre, so, gone);

insert into public.dispatch_order_packages (od_id, package_kind, package_id) values
  (pg_temp.fid('od-live'), 'warehouse_receipt_cn', pg_temp.fid('WR-OD')),
  (pg_temp.fid('od-can'), 'warehouse_receipt_cn', pg_temp.fid('WR-OD-CAN')),
  -- La misma etiqueta de id con otro tipo de paquete no es esta recepción.
  (pg_temp.fid('od-live'), 'warehouse_receipt_ve', pg_temp.fid('WR-OK-2'));
insert into public.warehouse_receipt_ve_boxes (id, tenant_id, receipt_id, source_receipt_cn_id) values
  (pg_temp.fid('veb-1'), pg_temp.fid('tenant-A'), pg_temp.fid('ve-live'), pg_temp.fid('WR-VE')),
  (pg_temp.fid('veb-2'), pg_temp.fid('tenant-A'), pg_temp.fid('ve-off'), pg_temp.fid('WR-VE-OFF'));
insert into public.consolidation_box_positions (id, tenant_id, consolidation_id, box_id, unstuffed_at)
select pg_temp.fid('pos-' || b.code), b.tenant_id,
  case when r.receipt_code = 'WR-STOW-OFF' then pg_temp.fid('cons-off') else pg_temp.fid('cons-live') end, b.id,
  case when r.receipt_code = 'WR-STOW-OUT' then now() end
from public.warehouse_boxes b join public.warehouse_receipts_cn r on r.id = b.receipt_id
where r.receipt_code in ('WR-STOW', 'WR-STOW-OUT', 'WR-STOW-OFF') and b.seq = 1;

-- ── Drift: cada caso rompe el catálogo y la 0476 tiene que abortar ──────────
\if :{?drift_sin_rls}
alter table public.shipments disable row level security;
\endif
\if :{?drift_sin_columna}
alter table public.prealertas drop column shipment_id;
\endif
\if :{?drift_enum}
alter type public.invoice_status rename value 'anulada' to 'anulado';
\endif
\if :{?drift_tipo_inactivo}
update public.audit_entity_types set status = 'deprecated', deprecated_at = now()
  where entity_type = 'warehouse_receipt_cn';
\endif
\if :{?drift_writer}
alter function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)
  security invoker;
\endif
\if :{?drift_sin_canceled}
alter table public.client_notification_schedule drop constraint client_notification_schedule_status_check;
alter table public.client_notification_schedule add constraint client_notification_schedule_status_check
  check (status in ('scheduled', 'sent', 'skipped', 'failed'));
\endif
\if :{?drift_funcion_ajena}
create function public.soft_delete_shipments_with_audit_reason(p_ids uuid[], p_reason text) returns boolean
  language sql security invoker set search_path = '' as $$ select true $$;
\endif
\if :{?drift_trigger_ajeno}
create function public.drift_0476_ajeno() returns trigger language plpgsql as $$ begin return null; end; $$;
create trigger shipments_audit_soft_delete after update on public.shipments
  for each row execute function public.drift_0476_ajeno();
\endif

-- Lo que la 0476 NO puede tocar.
create temporary table baseline_policies as
select to_jsonb(p) as definition from pg_catalog.pg_policies p;
create temporary table baseline_acl as
select c.oid, c.relname, a.grantee, a.privilege_type, a.is_grantable
from pg_class c, lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v');
create temporary table baseline_triggers as select t.oid, to_jsonb(t) as definition
from pg_trigger t where not t.tgisinternal;
create temporary table baseline_functions as
select p.oid, to_jsonb(p) as definition from pg_catalog.pg_proc p
join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'auth');
create temporary table baseline_rows as
select 'shipment' as kind, to_jsonb(s) - 'updated_at' as row_data from public.shipments s
union all select 'receipt', to_jsonb(r) - 'updated_at' from public.warehouse_receipts_cn r
union all select 'box', to_jsonb(b) - 'updated_at' from public.warehouse_boxes b
union all select 'notification', to_jsonb(n) from public.client_notification_schedule n;

\if :apply_fix
\ir ../migrations/0476_borrado_embarques_recepciones.sql
\endif

-- ── Utilidades ──────────────────────────────────────────────────────────────
create temporary sequence aserciones;
create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0476: %', p_msg; end if;
  perform nextval('pg_temp.aserciones');
end;
$$;

create function pg_temp.ids(p_labels text[]) returns uuid[] language sql immutable as $$
  select coalesce(array_agg(pg_temp.fid(l) order by o), '{}') from unnest(p_labels) with ordinality u(l, o)
$$;

-- Corre p_sql como el actor (rol de la API + su auth.uid) y cuenta filas o
-- devuelve el error. La autorización la da la base real, no este helper.
create function pg_temp.intenta(p_actor text, p_sql text, p_rol text default 'authenticated')
returns jsonb language plpgsql as $$
declare v_filas bigint := 0; v_state text; v_msg text;
begin
  perform set_config('request.jwt.claim.sub',
    case when p_actor is null then '' else pg_temp.fid(p_actor)::text end, true);
  begin
    execute format('set local role %I', p_rol);
    execute p_sql;
    get diagnostics v_filas = row_count;
    reset role;
    return jsonb_build_object('ok', true, 'filas', v_filas);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    reset role;
    return jsonb_build_object('ok', false, 'sqlstate', v_state, 'mensaje', v_msg);
  end;
end;
$$;

-- Llama a una RPC de borrado (o de lectura con p_reason null y p_lectura) como
-- el actor y devuelve sus filas o el error.
create function pg_temp.rpc(p_fn text, p_actor text, p_ids uuid[], p_reason text default null,
  p_rol text default 'authenticated', p_lectura boolean default false)
returns jsonb language plpgsql as $$
declare v jsonb; v_state text; v_msg text;
begin
  perform set_config('request.jwt.claim.sub',
    case when p_actor is null then '' else pg_temp.fid(p_actor)::text end, true);
  begin
    execute format('set local role %I', p_rol);
    if p_lectura then
      execute format('select coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) from public.%I($1) r', p_fn)
        into v using p_ids;
    else
      execute format('select coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) from public.%I($1, $2) r', p_fn)
        into v using p_ids, p_reason;
    end if;
    reset role;
    return jsonb_build_object('ok', true, 'filas', v);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    reset role;
    return jsonb_build_object('ok', false, 'sqlstate', v_state, 'mensaje', v_msg);
  end;
end;
$$;

create function pg_temp.fila(p_res jsonb, p_label text) returns jsonb language sql immutable as $$
  select e from jsonb_array_elements(p_res -> 'filas') e
  where coalesce(e ->> 'shipment_id', e ->> 'receipt_id') = pg_temp.fid(p_label)::text
$$;
create function pg_temp.outcome(p_res jsonb, p_label text) returns text language sql immutable as $$
  select pg_temp.fila(p_res, p_label) ->> 'outcome'
$$;
-- VOLÁTILES a propósito: una función STABLE reusa la instantánea de la sentencia
-- que la llama y no vería lo que acaba de escribir la RPC.
create function pg_temp.embarque_vivo(p_label text) returns boolean language sql volatile as $$
  select deleted_at is null from public.shipments where id = pg_temp.fid(p_label)
$$;
create function pg_temp.recepcion_viva(p_label text) returns boolean language sql volatile as $$
  select deleted_at is null from public.warehouse_receipts_cn where id = pg_temp.fid(p_label)
$$;
create function pg_temp.eventos(p_event text, p_label text) returns bigint language sql volatile as $$
  select count(*) from public.entity_audit_log
  where event_type = p_event and entity_id = pg_temp.fid(p_label)
$$;
create function pg_temp.eventos_borrado() returns bigint language sql volatile as $$
  select count(*) from public.entity_audit_log
  where event_type in ('shipment_deleted', 'warehouse_receipt_cn_deleted')
$$;
create function pg_temp.cajas_vivas(p_label text) returns bigint language sql volatile as $$
  select count(*) from public.warehouse_boxes where receipt_id = pg_temp.fid(p_label) and deleted_at is null
$$;

-- ── 1. RED: sin borrado físico ni UPDATE directo desde la API ───────────────
do $red$
declare v_r jsonb;
begin
  v_r := pg_temp.intenta('admin-A', format('delete from public.shipments where id = %L', pg_temp.fid('S-OK-4')));
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
    'el equipo borró físicamente un embarque por la API: ' || v_r::text);
  v_r := pg_temp.intenta('admin-A', format('delete from public.warehouse_receipts_cn where id = %L', pg_temp.fid('WR-OK-3')));
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
    'el equipo borró físicamente una recepción por la API: ' || v_r::text);
  -- El UPDATE directo de deleted_at tampoco: ni admin ni el resto del equipo.
  v_r := pg_temp.intenta('admin-A', format('update public.shipments set deleted_at = now() where id = %L', pg_temp.fid('S-OK-4')));
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
    'un admin puso deleted_at directo en un embarque, sin la RPC: ' || v_r::text);
  v_r := pg_temp.intenta('operations-A', format('update public.shipments set deleted_at = now() where id = %L', pg_temp.fid('S-OK-4')));
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
    'operations puso deleted_at directo en un embarque: ' || v_r::text);
  v_r := pg_temp.intenta('warehouse-A', format('update public.warehouse_receipts_cn set deleted_at = now() where id = %L', pg_temp.fid('WR-OK-3')));
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
    'warehouse puso deleted_at directo en una recepción: ' || v_r::text);
  perform pg_temp.afirmar(pg_temp.embarque_vivo('S-OK-4') and pg_temp.recepcion_viva('WR-OK-3'),
    'un intento rechazado dejó algo borrado');
  -- Lo demás del equipo sigue igual: editar campos de negocio.
  v_r := pg_temp.intenta('operations-A', format('update public.shipments set notes = %L where id = %L', 'nota', pg_temp.fid('S-OK-4')));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 1,
    'operations dejó de poder editar un embarque: ' || v_r::text);
  v_r := pg_temp.intenta('warehouse-A', format('update public.warehouse_receipts_cn set notes = %L where id = %L', 'nota', pg_temp.fid('WR-OK-3')));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 1,
    'warehouse dejó de poder editar una recepción: ' || v_r::text);
end;
$red$;

-- ── 2. Forma, ACL, triggers y catálogo vecino ───────────────────────────────
do $forma$
declare v_fn record; v_def text;
begin
  perform pg_temp.afirmar(current_setting('lock_timeout') = '0' and current_setting('statement_timeout') = '0',
    'la 0476 no restauró lock_timeout y statement_timeout');
  perform pg_temp.afirmar(coalesce(current_setting('dtd.huella_0476', true), '') = '',
    'la huella quedó en la sesión');
  perform pg_temp.afirmar(coalesce(current_setting('dtd.audit_reason', true), '') = '',
    'quedó un motivo en la sesión');

  for v_fn in select * from (values
    ('public.soft_delete_shipments_with_audit_reason(uuid[],text)', true, true),
    ('public.soft_delete_warehouse_receipts_cn_with_audit_reason(uuid[],text)', true, true),
    ('public.shipment_delete_blockers(uuid[])', true, true),
    ('public.warehouse_receipt_cn_delete_blockers(uuid[])', true, true),
    ('public.shipment_delete_blockers_internal(uuid,uuid[])', false, false),
    ('public.warehouse_receipt_cn_delete_blockers_internal(uuid,uuid[])', false, false),
    ('public.soft_delete_admin_tenant_internal()', false, false),
    ('public.soft_delete_ids_internal(uuid[],integer)', false, false),
    ('public.shipments_audit_soft_delete()', true, false),
    ('public.warehouse_receipts_cn_audit_soft_delete()', true, false),
    ('public.soft_delete_requires_governed_rpc()', false, false)
  ) f(sig, definer, api) loop
    perform pg_temp.afirmar(to_regprocedure(v_fn.sig) is not null, 'falta ' || v_fn.sig);
    perform pg_temp.afirmar((select prosecdef = v_fn.definer and proconfig = array['search_path=""']
      from pg_proc where oid = to_regprocedure(v_fn.sig)), v_fn.sig || ' sin la seguridad o el search_path esperados');
    perform pg_temp.afirmar(has_function_privilege('authenticated', v_fn.sig, 'EXECUTE') = v_fn.api,
      v_fn.sig || ': EXECUTE de authenticated distinto del esperado');
    perform pg_temp.afirmar(not has_function_privilege('anon', v_fn.sig, 'EXECUTE'),
      v_fn.sig || ' ejecutable por anon');
    perform pg_temp.afirmar(not has_function_privilege('service_role', v_fn.sig, 'EXECUTE'),
      v_fn.sig || ' ejecutable por service_role');
  end loop;

  -- El bloqueo de filas en orden estable no se ve en una sola sesión: se lee del
  -- cuerpo aplicado. Y la regla de las guardas vive en un solo lugar.
  select regexp_replace(prosrc, '\s+', ' ', 'g') into v_def from pg_proc
   where oid = to_regprocedure('public.soft_delete_shipments_with_audit_reason(uuid[],text)');
  perform pg_temp.afirmar(position('order by s.id for update of s' in v_def) > 0,
    'el borrado de embarques no bloquea las filas en orden de id');
  perform pg_temp.afirmar(position('public.shipment_delete_blockers_internal(v_tenant, v_ids)' in v_def) > 0,
    'el borrado de embarques no usa la misma regla que la lectura');
  select regexp_replace(prosrc, '\s+', ' ', 'g') into v_def from pg_proc
   where oid = to_regprocedure('public.soft_delete_warehouse_receipts_cn_with_audit_reason(uuid[],text)');
  perform pg_temp.afirmar(position('order by r.id for update of r' in v_def) > 0,
    'el borrado de recepciones no bloquea las filas en orden de id');
  perform pg_temp.afirmar(position('public.warehouse_receipt_cn_delete_blockers_internal(v_tenant, v_ids)' in v_def) > 0,
    'el borrado de recepciones no usa la misma regla que la lectura');

  perform pg_temp.afirmar((
    select count(*) from pg_trigger t
    where not t.tgisinternal and t.tgenabled = 'O'
      and (t.tgrelid, t.tgname) in (('public.shipments'::regclass, 'shipments_soft_delete_guard'),
        ('public.shipments'::regclass, 'shipments_audit_soft_delete'),
        ('public.warehouse_receipts_cn'::regclass, 'warehouse_receipts_cn_soft_delete_guard'),
        ('public.warehouse_receipts_cn'::regclass, 'warehouse_receipts_cn_audit_soft_delete'))
      and pg_get_triggerdef(t.oid) like '%WHEN (((old.deleted_at IS NULL) AND (new.deleted_at IS NOT NULL)))%'
  ) = 4, 'faltan los cuatro triggers de borrado con su condición');

  perform pg_temp.afirmar(not has_table_privilege('authenticated', 'public.shipments', 'DELETE')
    and not has_table_privilege('authenticated', 'public.warehouse_receipts_cn', 'DELETE'),
    'authenticated conserva DELETE');
  perform pg_temp.afirmar(has_table_privilege('service_role', 'public.warehouse_receipts_cn', 'DELETE'),
    'service_role perdió DELETE sobre warehouse_receipts_cn (rollback de createReceiptAction)');

  -- Nada más cambió: policies, ACL, triggers ni funciones ajenas.
  perform pg_temp.afirmar(not exists (
    select 1 from (select to_jsonb(p) as definition from pg_catalog.pg_policies p) ahora
    full join baseline_policies b on b.definition = ahora.definition
    where b.definition is null or ahora.definition is null), 'cambió alguna policy');
  perform pg_temp.afirmar((
    select count(*) from baseline_acl b
    where not exists (
      select 1 from pg_class c, lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
      where c.oid = b.oid and a.grantee = b.grantee and a.privilege_type = b.privilege_type
        and a.is_grantable = b.is_grantable)
  ) = 2 and not exists (
    select 1 from baseline_acl b
    where not exists (
      select 1 from pg_class c, lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
      where c.oid = b.oid and a.grantee = b.grantee and a.privilege_type = b.privilege_type)
      and not (b.relname in ('shipments', 'warehouse_receipts_cn') and b.grantee = 'authenticated'::regrole
               and b.privilege_type = 'DELETE')
  ) and not exists (
    select 1 from pg_class c, lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v')
      and not exists (select 1 from baseline_acl b where b.oid = c.oid and b.grantee = a.grantee
                        and b.privilege_type = a.privilege_type and b.is_grantable = a.is_grantable)
  ), 'la ACL cambió en algo más que el DELETE de authenticated sobre las dos tablas');
  perform pg_temp.afirmar(not exists (
    select 1 from (select t.oid, to_jsonb(t) as definition from pg_trigger t where not t.tgisinternal
                     and t.tgname not in ('shipments_soft_delete_guard', 'shipments_audit_soft_delete',
                       'warehouse_receipts_cn_soft_delete_guard', 'warehouse_receipts_cn_audit_soft_delete')) ahora
    full join baseline_triggers b on b.oid = ahora.oid
    where b.oid is null or ahora.oid is null or b.definition is distinct from ahora.definition),
    'cambió algún trigger que no es de la 0476');
  perform pg_temp.afirmar(not exists (
    select 1 from (
      select p.oid, to_jsonb(p) as definition from pg_catalog.pg_proc p
      join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'auth')
        and p.proname not in ('soft_delete_shipments_with_audit_reason', 'soft_delete_warehouse_receipts_cn_with_audit_reason',
          'shipment_delete_blockers', 'warehouse_receipt_cn_delete_blockers', 'shipment_delete_blockers_internal',
          'warehouse_receipt_cn_delete_blockers_internal', 'soft_delete_admin_tenant_internal', 'soft_delete_ids_internal',
          'shipments_audit_soft_delete', 'warehouse_receipts_cn_audit_soft_delete', 'soft_delete_requires_governed_rpc')
    ) ahora full join baseline_functions b on b.oid = ahora.oid
    where b.oid is null or ahora.oid is null or b.definition is distinct from ahora.definition),
    'cambió alguna función que no es de la 0476');
  -- Sin backfill: ni filas ni eventos nuevos al aplicar (los rechazos de 1. no escriben).
  perform pg_temp.afirmar(not exists (
    select 1 from (
      select 'shipment' as kind, to_jsonb(s) - 'updated_at' - 'notes' as row_data from public.shipments s
      union all select 'receipt', to_jsonb(r) - 'updated_at' - 'notes' from public.warehouse_receipts_cn r
      union all select 'box', to_jsonb(b) - 'updated_at' from public.warehouse_boxes b
      union all select 'notification', to_jsonb(n) from public.client_notification_schedule n
    ) ahora full join (select kind, row_data - 'notes' as row_data from baseline_rows) b
      on b.kind = ahora.kind and b.row_data = ahora.row_data
    where b.row_data is null or ahora.row_data is null), 'la 0476 cambió filas al aplicarse');
  perform pg_temp.afirmar(pg_temp.eventos_borrado() = 0, 'la 0476 escribió eventos al aplicarse');
end;
$forma$;

-- Reaplicar no crea ni cambia nada.
create temporary table antes_de_reaplicar as
select 'F:' || p.oid || ':' || md5(p.prosrc) || ':' || coalesce(p.proacl::text, '') as x
from pg_proc p where p.pronamespace = 'public'::regnamespace
  and (p.proname like 'soft_delete%' or p.proname like '%delete_blockers%' or p.proname like '%audit_soft_delete')
union all select 'T:' || t.oid || ':' || t.tgname from pg_trigger t
where t.tgname like '%soft_delete%' and not t.tgisinternal
union all select 'A:' || c.relname || ':' || coalesce(c.relacl::text, '') from pg_class c
where c.oid in ('public.shipments'::regclass, 'public.warehouse_receipts_cn'::regclass);
\if :apply_fix
\ir ../migrations/0476_borrado_embarques_recepciones.sql
\endif
do $reaplicar$
begin
  perform pg_temp.afirmar(not exists (
    select 1 from (
      select 'F:' || p.oid || ':' || md5(p.prosrc) || ':' || coalesce(p.proacl::text, '') as x
      from pg_proc p where p.pronamespace = 'public'::regnamespace
        and (p.proname like 'soft_delete%' or p.proname like '%delete_blockers%' or p.proname like '%audit_soft_delete')
      union all select 'T:' || t.oid || ':' || t.tgname from pg_trigger t
      where t.tgname like '%soft_delete%' and not t.tgisinternal
      union all select 'A:' || c.relname || ':' || coalesce(c.relacl::text, '') from pg_class c
      where c.oid in ('public.shipments'::regclass, 'public.warehouse_receipts_cn'::regclass)
    ) ahora full join antes_de_reaplicar b on b.x = ahora.x
    where b.x is null or ahora.x is null), 'reaplicar la 0476 cambió el catálogo');
end;
$reaplicar$;

-- ── 3. Quién puede borrar y con qué entrada ─────────────────────────────────
do $quien$
declare
  v_r jsonb; v_actor text; v_cien uuid[];
begin
  foreach v_actor in array array['operations-A', 'commercial-A', 'accounting-A', 'warehouse-A', 'support-A',
    'marketing-A', 'admin-off', 'admin-dual'] loop
    v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', v_actor, pg_temp.ids(array['S-OK-4']), 'Embarque de prueba');
    perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
      v_actor || ' pudo borrar un embarque con la RPC: ' || v_r::text);
    v_r := pg_temp.rpc('soft_delete_warehouse_receipts_cn_with_audit_reason', v_actor, pg_temp.ids(array['WR-OK-3']), 'Recepción de prueba');
    perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
      v_actor || ' pudo borrar una recepción con la RPC: ' || v_r::text);
    v_r := pg_temp.rpc('shipment_delete_blockers', v_actor, pg_temp.ids(array['S-OK-4']), null, 'authenticated', true);
    perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
      v_actor || ' pudo leer los bloqueos de embarques: ' || v_r::text);
    v_r := pg_temp.rpc('warehouse_receipt_cn_delete_blockers', v_actor, pg_temp.ids(array['WR-OK-3']), null, 'authenticated', true);
    perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
      v_actor || ' pudo leer los bloqueos de recepciones: ' || v_r::text);
  end loop;
  v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', null, pg_temp.ids(array['S-OK-4']), 'Embarque de prueba');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '42501', 'sin sesión se pudo llamar al borrado: ' || v_r::text);
  v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', 'admin-A', pg_temp.ids(array['S-OK-4']), 'Embarque de prueba', 'anon');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '42501', 'anon pudo llamar al borrado: ' || v_r::text);
  v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', 'admin-A', pg_temp.ids(array['S-OK-4']), 'Embarque de prueba', 'service_role');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '42501', 'service_role pudo llamar al borrado: ' || v_r::text);

  -- Motivo: obligatorio, recortado, de 4 a 1000 caracteres.
  foreach v_actor in array array[null, '', '   ', 'abc', repeat('m', 1001)] loop
    v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', 'admin-A', pg_temp.ids(array['S-OK-4']), v_actor);
    perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023',
      format('motivo %s aceptado en embarques: %s', coalesce(length(v_actor)::text, 'nulo'), v_r::text));
    v_r := pg_temp.rpc('soft_delete_warehouse_receipts_cn_with_audit_reason', 'admin-A', pg_temp.ids(array['WR-OK-3']), v_actor);
    perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023',
      format('motivo %s aceptado en recepciones: %s', coalesce(length(v_actor)::text, 'nulo'), v_r::text));
  end loop;
  -- Ids: lista nula, vacía, con nulos o con más de 100 distintos.
  v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', 'admin-A', null, 'Embarques de prueba');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'lista nula aceptada: ' || v_r::text);
  v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', 'admin-A', '{}'::uuid[], 'Embarques de prueba');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'lista vacía aceptada: ' || v_r::text);
  v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', 'admin-A',
    array[pg_temp.fid('S-OK-4'), null]::uuid[], 'Embarques de prueba');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'lista con nulos aceptada: ' || v_r::text);
  select array_agg(pg_temp.fid('nadie-' || g)) into v_cien from generate_series(1, 101) g;
  v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', 'admin-A', v_cien, 'Embarques de prueba');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', '101 ids aceptados en embarques: ' || v_r::text);
  v_r := pg_temp.rpc('soft_delete_warehouse_receipts_cn_with_audit_reason', 'admin-A', v_cien, 'Recepciones de prueba');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', '101 ids aceptados en recepciones: ' || v_r::text);
  -- 100 distintos sí entran (y como no existen, nada se borra).
  v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', 'admin-A', v_cien[1:100], 'Embarques de prueba');
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and jsonb_array_length(v_r -> 'filas') = 100
    and not exists (select 1 from jsonb_array_elements(v_r -> 'filas') e where e ->> 'outcome' <> 'not_found'),
    '100 ids inexistentes no dieron 100 not_found: ' || v_r::text);
  select array_agg(pg_temp.fid('nadie-' || g)) into v_cien from generate_series(1, 501) g;
  v_r := pg_temp.rpc('shipment_delete_blockers', 'admin-A', v_cien, null, 'authenticated', true);
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', '501 ids aceptados en la lectura: ' || v_r::text);
  perform pg_temp.afirmar(pg_temp.eventos_borrado() = 0 and pg_temp.embarque_vivo('S-OK-4')
    and pg_temp.recepcion_viva('WR-OK-3'), 'un rechazo dejó algo borrado o un evento');
end;
$quien$;

-- ── 4. La lectura para la UI decide lo mismo que el borrado ─────────────────
do $lectura$
declare v_r jsonb;
begin
  v_r := pg_temp.rpc('shipment_delete_blockers', 'admin-A',
    pg_temp.ids(array['S-OK-1', 'S-OK-2', 'S-INV', 'S-DEL', 'S-B', 'nadie']), null, 'authenticated', true);
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and jsonb_array_length(v_r -> 'filas') = 4,
    'la lectura no devolvió sólo los 4 del tenant: ' || v_r::text);
  perform pg_temp.afirmar(pg_temp.fila(v_r, 'S-B') is null and pg_temp.fila(v_r, 'nadie') is null,
    'la lectura mostró un embarque de otro tenant o inexistente');
  perform pg_temp.afirmar(pg_temp.fila(v_r, 'S-OK-1') -> 'blockers' = '{}'::jsonb
    and pg_temp.fila(v_r, 'S-OK-1') -> 'warnings' = '{"sent_notifications": 1, "scheduled_notifications": 1}'::jsonb,
    'S-OK-1: bloqueos o avisos inesperados: ' || coalesce(pg_temp.fila(v_r, 'S-OK-1')::text, 'null'));
  perform pg_temp.afirmar(pg_temp.fila(v_r, 'S-OK-2') -> 'warnings' = '{"documents": 2, "converted_quotes": 1}'::jsonb,
    'S-OK-2: avisos inesperados: ' || coalesce(pg_temp.fila(v_r, 'S-OK-2')::text, 'null'));
  perform pg_temp.afirmar(pg_temp.fila(v_r, 'S-INV') -> 'blockers' = '{"invoices": 1}'::jsonb
    and pg_temp.fila(v_r, 'S-DEL') -> 'blockers' = '{"delivered": 1}'::jsonb,
    'la lectura no ve la factura o la entrega');
  v_r := pg_temp.rpc('warehouse_receipt_cn_delete_blockers', 'admin-A',
    pg_temp.ids(array['WR-OK-1', 'WR-CONS', 'WR-B']), null, 'authenticated', true);
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and jsonb_array_length(v_r -> 'filas') = 2
    and pg_temp.fila(v_r, 'WR-OK-1') -> 'warnings' = '{"boxes": 2}'::jsonb
    and pg_temp.fila(v_r, 'WR-CONS') -> 'blockers' = '{"consolidated": 1}'::jsonb,
    'la lectura de recepciones no coincide: ' || v_r::text);
  perform pg_temp.afirmar(pg_temp.eventos_borrado() = 0, 'leer escribió eventos');
end;
$lectura$;

-- ── 5. Cada guarda bloquea; su contraparte no ───────────────────────────────
do $guardas$
declare v_r jsonb; v_g record;
begin
  for v_g in select * from (values
    ('S-DEL', 'delivered'), ('S-INV', 'invoices'), ('S-EXP', 'expenses'), ('S-BILL', 'supplier_bills'),
    ('S-COST', 'shipment_costs'), ('S-CNY1', 'china_finance'), ('S-CNY2', 'china_finance'),
    ('S-CNY3', 'china_finance'), ('S-CUS', 'customs_filings'), ('S-TMS', 'tms_routes'),
    ('S-CLM', 'client_claims'), ('S-NAV', 'naviera_consolidations'), ('S-REC', 'cn_receipts'),
    ('S-PRE', 'purchases'), ('S-GONE', 'already_deleted')
  ) g(label, kind) loop
    v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', 'admin-A', pg_temp.ids(array[v_g.label]), 'Embarque de prueba');
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and pg_temp.outcome(v_r, v_g.label) = 'blocked'
      and pg_temp.fila(v_r, v_g.label) -> 'blockers' = jsonb_build_object(v_g.kind, 1),
      format('%s no quedó bloqueado por %s: %s', v_g.label, v_g.kind, v_r::text));
  end loop;
  perform pg_temp.afirmar(pg_temp.eventos_borrado() = 0, 'un bloqueado escribió un evento');
  perform pg_temp.afirmar((select count(*) from public.shipments where deleted_at is not null) = 2,
    'un embarque bloqueado quedó borrado');
  perform pg_temp.afirmar((select status from public.client_notification_schedule where id = pg_temp.fid('noti-3')) = 'scheduled',
    'un bloqueado canceló sus avisos');

  for v_g in select * from (values
    ('WR-CONS', 'consolidated'), ('WR-OD', 'dispatch_orders'), ('WR-PRE', 'purchase'), ('WR-SO', 'sales_order'),
    ('WR-VE', 've_receipts'), ('WR-STOW', 'stowed_boxes'), ('WR-GONE', 'already_deleted')
  ) g(label, kind) loop
    v_r := pg_temp.rpc('soft_delete_warehouse_receipts_cn_with_audit_reason', 'admin-A', pg_temp.ids(array[v_g.label]), 'Recepción de prueba');
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and pg_temp.outcome(v_r, v_g.label) = 'blocked'
      and pg_temp.fila(v_r, v_g.label) -> 'blockers' = jsonb_build_object(v_g.kind, 1),
      format('%s no quedó bloqueada por %s: %s', v_g.label, v_g.kind, v_r::text));
  end loop;
  perform pg_temp.afirmar(pg_temp.eventos_borrado() = 0, 'una recepción bloqueada escribió un evento');
  perform pg_temp.afirmar((select count(*) from public.warehouse_receipts_cn where deleted_at is not null) = 2,
    'una recepción bloqueada quedó borrada');
  perform pg_temp.afirmar(pg_temp.cajas_vivas('WR-STOW') = 2, 'una recepción bloqueada retiró sus cajas');
end;
$guardas$;

-- ── 6. Todo o nada, otro tenant e inexistente ───────────────────────────────
do $todo_o_nada$
declare v_r jsonb;
begin
  v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', 'admin-A',
    pg_temp.ids(array['S-OK-1', 'S-INV']), 'Embarques de prueba');
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and pg_temp.outcome(v_r, 'S-OK-1') = 'held'
    and pg_temp.outcome(v_r, 'S-INV') = 'blocked', 'el lote mixto no dio held + blocked: ' || v_r::text);
  v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', 'admin-A',
    pg_temp.ids(array['S-OK-1', 'S-B']), 'Embarques de prueba');
  perform pg_temp.afirmar(pg_temp.outcome(v_r, 'S-OK-1') = 'held' and pg_temp.outcome(v_r, 'S-B') = 'not_found'
    and pg_temp.fila(v_r, 'S-B') ->> 'code' is null,
    'un embarque de otro tenant no dio not_found sin código: ' || v_r::text);
  v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', 'admin-A',
    pg_temp.ids(array['S-OK-1', 'nadie']), 'Embarques de prueba');
  perform pg_temp.afirmar(pg_temp.outcome(v_r, 'S-OK-1') = 'held' and pg_temp.outcome(v_r, 'nadie') = 'not_found',
    'un id inexistente no detuvo el lote: ' || v_r::text);
  v_r := pg_temp.rpc('soft_delete_warehouse_receipts_cn_with_audit_reason', 'admin-A',
    pg_temp.ids(array['WR-OK-1', 'WR-OD']), 'Recepciones de prueba');
  perform pg_temp.afirmar(pg_temp.outcome(v_r, 'WR-OK-1') = 'held' and pg_temp.outcome(v_r, 'WR-OD') = 'blocked',
    'el lote mixto de recepciones no dio held + blocked: ' || v_r::text);
  v_r := pg_temp.rpc('soft_delete_warehouse_receipts_cn_with_audit_reason', 'admin-A',
    pg_temp.ids(array['WR-OK-1', 'WR-B']), 'Recepciones de prueba');
  perform pg_temp.afirmar(pg_temp.outcome(v_r, 'WR-OK-1') = 'held' and pg_temp.outcome(v_r, 'WR-B') = 'not_found',
    'una recepción de otro tenant no dio not_found: ' || v_r::text);
  perform pg_temp.afirmar(pg_temp.embarque_vivo('S-OK-1') and pg_temp.recepcion_viva('WR-OK-1')
    and pg_temp.embarque_vivo('S-B') and pg_temp.recepcion_viva('WR-B'), 'un lote detenido borró algo');
  perform pg_temp.afirmar(pg_temp.eventos_borrado() = 0, 'un lote detenido escribió eventos');
  perform pg_temp.afirmar((select status from public.client_notification_schedule where id = pg_temp.fid('noti-1')) = 'scheduled',
    'un lote detenido canceló avisos');
  perform pg_temp.afirmar(pg_temp.cajas_vivas('WR-OK-1') = 2, 'un lote detenido retiró cajas');
  perform pg_temp.afirmar(coalesce(current_setting('dtd.audit_reason', true), '') = '',
    'un lote detenido dejó el motivo en la transacción');
end;
$todo_o_nada$;

-- ── 7. Borrar de verdad: embarques ──────────────────────────────────────────
do $borrar_embarques$
declare v_r jsonb; v_e record; v_corr text;
begin
  perform set_config('dtd.audit_reason', 'motivo previo del caller', true);
  -- Contrapartes que no bloquean, duplicados y espacios alrededor del motivo.
  v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', 'admin-A',
    pg_temp.ids(array['S-OK-1', 'S-OK-2', 'S-OK-3', 'S-OK-1', 'S-INV-NUL', 'S-EXP-OFF', 'S-BILL-NUL',
      'S-TMS-CAN', 'S-NAV-OFF', 'S-REC-OFF', 'S-PRE-CAN']), '  Embarques de prueba de Sam  ');
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and jsonb_array_length(v_r -> 'filas') = 10
    and not exists (select 1 from jsonb_array_elements(v_r -> 'filas') e where e ->> 'outcome' <> 'deleted'),
    'el lote borrable no se borró completo: ' || v_r::text);
  perform pg_temp.afirmar(pg_temp.fila(v_r, 'S-OK-1') ->> 'code' = 'S-OK-1', 'la fila no trae el código');
  perform pg_temp.afirmar(current_setting('dtd.audit_reason', true) = 'motivo previo del caller',
    'la RPC no restauró el motivo previo del caller');
  perform set_config('dtd.audit_reason', '', true);
  perform pg_temp.afirmar(not pg_temp.embarque_vivo('S-OK-1') and not pg_temp.embarque_vivo('S-PRE-CAN'),
    'un embarque del lote sigue vivo');
  perform pg_temp.afirmar(pg_temp.embarque_vivo('S-INV') and pg_temp.embarque_vivo('S-B'),
    'se borró algo fuera del lote');
  -- Un evento por embarque, con actor, motivo, antes/después y la misma correlación.
  perform pg_temp.afirmar((select count(*) from public.entity_audit_log where event_type = 'shipment_deleted') = 10,
    'no hay exactamente 10 eventos shipment_deleted');
  select * into v_e from public.entity_audit_log
   where event_type = 'shipment_deleted' and entity_id = pg_temp.fid('S-OK-1');
  perform pg_temp.afirmar(v_e.tenant_id = pg_temp.fid('tenant-A') and v_e.entity_type = 'shipment'
    and v_e.actor_type = 'user' and v_e.actor_id = pg_temp.fid('admin-A')
    and v_e.reason = 'Embarques de prueba de Sam' and v_e.source = 'rpc' and v_e.result = 'succeeded'
    and v_e.sensitivity = 'restricted', 'el evento de S-OK-1 no tiene tenant, actor, motivo o fuente: ' || to_jsonb(v_e)::text);
  perform pg_temp.afirmar(v_e.before_data = '{"deleted_at": null, "status": "in_transit"}'::jsonb
    and v_e.after_data ->> 'deleted_at' is not null and v_e.after_data ->> 'status' = 'in_transit'
    and (v_e.after_data - 'deleted_at' - 'status') = '{}'::jsonb,
    'antes/después del evento no son los esperados: ' || to_jsonb(v_e)::text);
  perform pg_temp.afirmar(v_e.payload = '{"permanence": "P2", "consequence": "removed_from_studio_portal_calendar_pending_notices_canceled", "recovery": "database_only", "shipment_code": "S-OK-1", "related_files": []}'::jsonb,
    'payload del evento inesperado: ' || v_e.payload::text);
  perform pg_temp.afirmar(position('Cliente Ficticio' in to_jsonb(v_e)::text) = 0
    and position('DTD-0476' in to_jsonb(v_e)::text) = 0, 'el evento copió datos del cliente');
  v_corr := v_e.correlation_id;
  perform pg_temp.afirmar(v_corr like 'sdd-0522:shipments:%' and (
    select count(distinct correlation_id) from public.entity_audit_log where event_type = 'shipment_deleted') = 1,
    'los eventos del lote no comparten una correlación');
  -- Efectos: timeline, avisos y lo que se conserva.
  perform pg_temp.afirmar(not exists (
    select 1 from public.shipment_events where shipment_id = pg_temp.fid('S-OK-1') and deleted_at is null),
    'los eventos del timeline siguen vivos');
  perform pg_temp.afirmar((select status || ':' || error from public.client_notification_schedule
    where id = pg_temp.fid('noti-1')) = 'canceled:envío eliminado', 'el aviso programado no se canceló');
  perform pg_temp.afirmar((select status from public.client_notification_schedule where id = pg_temp.fid('noti-2')) = 'sent'
    and (select error from public.client_notification_schedule where id = pg_temp.fid('noti-2')) is null,
    'el aviso enviado cambió');
  perform pg_temp.afirmar((select status from public.client_notification_schedule where id = pg_temp.fid('noti-3')) = 'scheduled',
    'se canceló el aviso de un embarque fuera del lote');
  perform pg_temp.afirmar((select deleted_at is null from public.documents where id = pg_temp.fid('doc-1'))
    and (select deleted_at is null from public.shipment_documents where id = pg_temp.fid('sdoc-1'))
    and (select converted_to_shipment_id = pg_temp.fid('S-OK-2') from public.quotes where id = pg_temp.fid('quo-1')),
    'el borrado tocó adjuntos o el estimado');
  -- El código no se libera: sigue ocupado por la fila eliminada.
  perform pg_temp.afirmar((pg_temp.intenta('admin-A', format(
    'insert into public.shipments (id, tenant_id, code, shipment_service) values (%L, %L, %L, %L)',
    pg_temp.fid('S-OK-1-bis'), pg_temp.fid('tenant-A'), 'S-OK-1', 'consolidacion'))) ->> 'sqlstate' = '23505',
    'el código de un embarque eliminado se pudo reutilizar');
  -- Volver a pedirlo: ya eliminado.
  v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', 'admin-A', pg_temp.ids(array['S-OK-1']), 'Otra vez');
  perform pg_temp.afirmar(pg_temp.outcome(v_r, 'S-OK-1') = 'blocked'
    and pg_temp.fila(v_r, 'S-OK-1') -> 'blockers' = '{"already_deleted": 1}'::jsonb, 'borrar dos veces no se bloqueó');
  -- El tenant B borra lo suyo, aparte.
  v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', 'admin-B', pg_temp.ids(array['S-B']), 'Prueba de B');
  perform pg_temp.afirmar(pg_temp.outcome(v_r, 'S-B') = 'deleted' and not pg_temp.embarque_vivo('S-B')
    and (select tenant_id from public.entity_audit_log where entity_id = pg_temp.fid('S-B')) = pg_temp.fid('tenant-B'),
    'el admin de B no borró lo suyo en su tenant: ' || v_r::text);
end;
$borrar_embarques$;

-- ── 8. Borrar de verdad: recepciones ────────────────────────────────────────
do $borrar_recepciones$
declare v_r jsonb; v_e record;
begin
  perform set_config('dtd.audit_reason', 'motivo previo del caller', true);
  v_r := pg_temp.rpc('soft_delete_warehouse_receipts_cn_with_audit_reason', 'admin-A',
    pg_temp.ids(array['WR-OK-1', 'WR-OK-2', 'WR-CONS-OFF', 'WR-OD-CAN', 'WR-PRE-CAN', 'WR-PRE-OFF', 'WR-SO-CAN',
      'WR-VE-OFF', 'WR-STOW-OUT', 'WR-STOW-OFF']), 'Recepciones de prueba');
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and jsonb_array_length(v_r -> 'filas') = 10
    and not exists (select 1 from jsonb_array_elements(v_r -> 'filas') e where e ->> 'outcome' <> 'deleted'),
    'el lote borrable de recepciones no se borró completo: ' || v_r::text);
  perform pg_temp.afirmar(current_setting('dtd.audit_reason', true) = 'motivo previo del caller',
    'la RPC de recepciones no restauró el motivo previo del caller');
  perform set_config('dtd.audit_reason', '', true);
  perform pg_temp.afirmar(not pg_temp.recepcion_viva('WR-OK-1') and not pg_temp.recepcion_viva('WR-STOW-OFF'),
    'una recepción del lote sigue viva');
  perform pg_temp.afirmar(pg_temp.recepcion_viva('WR-OD') and pg_temp.recepcion_viva('WR-OK-3'),
    'se borró una recepción fuera del lote');
  perform pg_temp.afirmar(pg_temp.cajas_vivas('WR-OK-1') = 0 and pg_temp.cajas_vivas('WR-STOW-OUT') = 0,
    'las cajas de una recepción borrada siguen vivas');
  perform pg_temp.afirmar(pg_temp.cajas_vivas('WR-STOW') = 2 and pg_temp.cajas_vivas('WR-OD') = 1,
    'se retiraron cajas de recepciones fuera del lote');
  perform pg_temp.afirmar((select count(*) from public.entity_audit_log where event_type = 'warehouse_receipt_cn_deleted') = 10,
    'no hay exactamente 10 eventos warehouse_receipt_cn_deleted');
  select * into v_e from public.entity_audit_log
   where event_type = 'warehouse_receipt_cn_deleted' and entity_id = pg_temp.fid('WR-OK-1');
  perform pg_temp.afirmar(v_e.entity_type = 'warehouse_receipt_cn' and v_e.actor_id = pg_temp.fid('admin-A')
    and v_e.reason = 'Recepciones de prueba' and v_e.sensitivity = 'restricted'
    and v_e.correlation_id like 'sdd-0522:warehouse_receipts_cn:%'
    and v_e.payload = '{"permanence": "P2", "consequence": "removed_from_cn_lists_boxes_retired", "recovery": "database_only", "receipt_code": "WR-OK-1", "related_files": []}'::jsonb
    and v_e.before_data = '{"deleted_at": null, "status": "pendiente_consolidacion"}'::jsonb,
    'el evento de WR-OK-1 no es el esperado: ' || to_jsonb(v_e)::text);
  perform pg_temp.afirmar(position('Cliente Ficticio' in to_jsonb(v_e)::text) = 0
    and position('DTD-0476' in to_jsonb(v_e)::text) = 0, 'el evento de la recepción copió datos del cliente');
end;
$borrar_recepciones$;

-- ── 9. Atomicidad, roles de confianza y restauración ────────────────────────
do $atomico$
declare v_r jsonb; v_antes bigint;
begin
  v_antes := pg_temp.eventos_borrado();
  -- Con el tipo de entidad inactivo, el evento no se escribe: nada se borra.
  update public.audit_entity_types set status = 'deprecated', deprecated_at = now() where entity_type = 'shipment';
  v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', 'admin-A', pg_temp.ids(array['S-OK-4']), 'Embarque de prueba');
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and pg_temp.embarque_vivo('S-OK-4'),
    'con el writer roto se borró un embarque: ' || v_r::text);
  update public.audit_entity_types set status = 'active', deprecated_at = null where entity_type = 'shipment';
  update public.audit_entity_types set status = 'deprecated', deprecated_at = now() where entity_type = 'warehouse_receipt_cn';
  v_r := pg_temp.rpc('soft_delete_warehouse_receipts_cn_with_audit_reason', 'admin-A', pg_temp.ids(array['WR-OK-3']), 'Recepción de prueba');
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and pg_temp.recepcion_viva('WR-OK-3'),
    'con el writer roto se borró una recepción: ' || v_r::text);
  update public.audit_entity_types set status = 'active', deprecated_at = null where entity_type = 'warehouse_receipt_cn';
  perform pg_temp.afirmar(pg_temp.eventos_borrado() = v_antes, 'un borrado fallido dejó eventos');

  -- Un rol de confianza (service_role, sin auth.uid) sí puede, y queda auditado
  -- como sistema con el motivo por defecto. Y conserva el DELETE físico.
  v_r := pg_temp.intenta(null, format('update public.shipments set deleted_at = now() where id = %L', pg_temp.fid('S-SYS')), 'service_role');
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and not pg_temp.embarque_vivo('S-SYS'),
    'service_role no pudo poner deleted_at: ' || v_r::text);
  perform pg_temp.afirmar((select actor_type || ':' || coalesce(actor_id::text, '') || ':' || reason
    from public.entity_audit_log where entity_id = pg_temp.fid('S-SYS')) = 'system::Embarque eliminado sin motivo indicado (SDD-0522).',
    'el borrado de sistema no quedó auditado como sistema con el motivo por defecto');
  v_r := pg_temp.intenta(null, format('delete from public.warehouse_receipts_cn where id = %L', pg_temp.fid('WR-OK-3')), 'service_role');
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and (v_r ->> 'filas')::int = 1,
    'service_role perdió el DELETE físico del rollback: ' || v_r::text);

  -- Restaurar (por base de datos) no escribe un evento de borrado; volver a borrar sí.
  update public.shipments set deleted_at = null where id = pg_temp.fid('S-OK-3');
  perform pg_temp.afirmar(pg_temp.eventos('shipment_deleted', 'S-OK-3') = 1, 'restaurar escribió un evento de borrado');
  v_r := pg_temp.rpc('soft_delete_shipments_with_audit_reason', 'admin-A', pg_temp.ids(array['S-OK-3']), 'Segundo borrado');
  perform pg_temp.afirmar(pg_temp.outcome(v_r, 'S-OK-3') = 'deleted' and pg_temp.eventos('shipment_deleted', 'S-OK-3') = 2,
    'volver a borrar no escribió otro evento: ' || v_r::text);
  -- Mover el deleted_at de un borrado no es otro borrado.
  update public.shipments set deleted_at = deleted_at - interval '1 hour' where id = pg_temp.fid('S-OK-3');
  perform pg_temp.afirmar(pg_temp.eventos('shipment_deleted', 'S-OK-3') = 2, 'mover deleted_at escribió un evento');
end;
$atomico$;

select 'TEST 0476 GREEN: ' || currval('pg_temp.aserciones') || ' aserciones' as resultado;
rollback;
