\set ON_ERROR_STOP on

-- Contrato desechable de la 0551 (SDD-0645): pasar un embarque a otro cliente.
-- Fixture sintética y ROLLBACK: nunca consulta ni modifica una base alojada.
--
-- Aplica las migraciones REALES de auditoría (0258, 0261, 0267, 0294), de
-- embarques (0002, 0003, 0009), del Almacén CN (0008), la 0230 y las cajas
-- (0240, con su trigger de sincronía de Shipping Mark). Clientes, facturas,
-- consolidación, documentos, avisos, reclamos, prealertas y despacho van como
-- dobles mínimos con las columnas de producción que lee la 0551: su preflight
-- las exige por nombre y `schema-rebuild` de verify la aplica sobre el schema
-- completo.
--
-- RED: `-v apply_fix=false` no aplica la 0551 y la primera aserción falla
-- porque operaciones no puede pasar el embarque.
--
-- Lo que defiende:
--   1. Forma, ACL (EXECUTE sólo authenticated) y SECURITY DEFINER.
--   2. Sólo operations o admin activos de una sola membresía.
--   3. Validaciones: motivo, mismo cliente, sin Shipping Mark, fusionado,
--      eliminado, de otro tenant, embarque eliminado.
--   4. Cada bloqueo impide el cambio y su contraparte no.
--   5. Lo que se mueve y lo que no; las cajas por el trigger de 0240.
--   6. La vista previa calcula lo mismo y no escribe.
--   7. Evento con actor, motivo, antes/después sin nombres y correlación; si el
--      evento falla, nada cambia.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.shipments') is not null or to_regclass('public.tenants') is not null
     or to_regclass('public.entity_audit_log') is not null then
    raise exception 'TEST 0551: fixture rechazada, la base ya contiene objetos de aplicación';
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

\ir ../migrations/0002_shipments.sql
\ir ../migrations/0003_shipment_events_on_insert.sql
\ir ../migrations/0008_warehouses_cn.sql
\ir ../migrations/0009_shipment_delivery_pod.sql
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
\ir ../migrations/0240_warehouse_boxes.sql

-- ── Dobles mínimos (columnas de producción que lee o escribe la 0551) ──────
create table public.clients (
  id uuid primary key, tenant_id uuid not null references public.tenants(id), markbox text,
  name text not null, deleted_at timestamptz, merged_into_client_id uuid
);
create type public.invoice_status as enum ('borrador', 'emitida', 'parcial', 'pagada', 'vencida', 'anulada');
create table public.invoices (
  id uuid primary key, tenant_id uuid not null, shipment_id uuid references public.shipments(id) on delete set null,
  status public.invoice_status not null default 'borrador', lines jsonb not null default '[]',
  client_markbox text not null, client_name text not null, client_rif text, client_doc_kind text,
  client_fiscal_address text, bill_to_kind text, deleted_at timestamptz
);
alter table public.invoices enable row level security;
create table public.consolidations (id uuid primary key, tenant_id uuid not null);
create table public.consolidation_items (
  id uuid primary key, tenant_id uuid not null,
  consolidation_id uuid not null references public.consolidations(id) on delete cascade,
  shipment_id uuid references public.shipments(id) on delete set null, client_markbox text, client_name text
);
create table public.shipment_documents (
  id uuid primary key, tenant_id uuid not null,
  shipment_id uuid not null references public.shipments(id) on delete cascade, client_markbox text,
  doc_type text not null default 'otro' check (doc_type in ('bl', 'pod', 'otro')), deleted_at timestamptz
);
alter table public.shipment_documents enable row level security;
-- 0496: la tarifa congelada por recepción (las columnas que lee la 0551).
create table public.shipment_rate_snapshots (
  id uuid primary key, tenant_id uuid not null,
  receipt_id uuid not null references public.warehouse_receipts_cn(id) on delete cascade,
  client_id uuid not null references public.clients(id), superseded_at timestamptz
);
create table public.client_notification_schedule (
  id uuid primary key, tenant_id uuid not null,
  shipment_id uuid not null references public.shipments(id) on delete cascade, client_markbox text not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'skipped', 'canceled', 'failed'))
);
create table public.client_claims (
  id uuid primary key, tenant_id uuid not null, shipment_id uuid references public.shipments(id) on delete set null,
  deleted_at timestamptz
);
create table public.prealertas (
  id uuid primary key, tenant_id uuid not null, shipment_id uuid,
  status text not null default 'anunciada'
    check (status in ('anunciada', 'en_camino', 'recibida', 'consolidada', 'cancelada')),
  deleted_at timestamptz
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
grant all on all tables in schema public to service_role;

-- ── Datos sintéticos ────────────────────────────────────────────────────────
create function pg_temp.fid(p_label text) returns uuid language sql immutable as $$
  select md5('0551-synthetic-' || p_label)::uuid
$$;

insert into auth.users (id)
select pg_temp.fid(u) from unnest(array['admin-A', 'admin-off', 'admin-dual', 'operations-A', 'commercial-A',
  'accounting-A', 'warehouse-A', 'support-A', 'marketing-A', 'admin-B']) u;
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fid('tenant-A'), 'tenant-a-0551', 'Tenant A 0551'),
  (pg_temp.fid('tenant-B'), 'tenant-b-0551', 'Tenant B 0551');
insert into public.user_tenants (user_id, tenant_id, role, disabled_at)
select pg_temp.fid(v.u), pg_temp.fid(v.t), v.r, case when v.off then now() end from (values
  ('admin-A', 'tenant-A', 'admin', false), ('admin-off', 'tenant-A', 'admin', true),
  ('admin-dual', 'tenant-A', 'admin', false), ('admin-dual', 'tenant-B', 'operations', false),
  ('operations-A', 'tenant-A', 'operations', false), ('commercial-A', 'tenant-A', 'commercial', false),
  ('accounting-A', 'tenant-A', 'accounting', false), ('warehouse-A', 'tenant-A', 'warehouse', false),
  ('support-A', 'tenant-A', 'support', false), ('marketing-A', 'tenant-A', 'marketing', false),
  ('admin-B', 'tenant-B', 'admin', false)
) v(u, t, r, off);

-- Clientes: la ficha provisional, el dueño real y los casos raros.
insert into public.clients (id, tenant_id, markbox, name, deleted_at, merged_into_client_id)
select pg_temp.fid(v.label), pg_temp.fid(v.t), v.mb, v.nombre,
  case when v.gone then now() end, case when v.merged then pg_temp.fid('C-REAL') end
from (values
  ('C-PROV', 'tenant-A', 'SINT-0000', 'Ficha provisional', false, false),
  ('C-REAL', 'tenant-A', 'SINT-1001', 'Cliente Ficticio Real', false, false),
  ('C-SIN-MB', 'tenant-A', null, 'Cliente sin marca', false, false),
  ('C-FUSION', 'tenant-A', 'SINT-1002', 'Cliente fusionado', false, true),
  ('C-GONE', 'tenant-A', 'SINT-1003', 'Cliente eliminado', true, false),
  ('C-B', 'tenant-B', 'SINT-2001', 'Cliente del tenant B', false, false)
) v(label, t, mb, nombre, gone, merged);

-- Todos los embarques nacen en la ficha provisional.
insert into public.shipments (id, tenant_id, code, client_name, client_markbox, shipment_service, status, deleted_at)
select pg_temp.fid(v.code), pg_temp.fid(v.t), v.code, 'Ficha provisional', 'SINT-0000',
  'consolidacion', 'consolidating'::public.shipment_status, case when v.gone then now() end
from (values
  ('S-OK', 'tenant-A', false), ('S-OTRO', 'tenant-A', false), ('S-ROL', 'tenant-A', false),
  ('S-INV', 'tenant-A', false), ('S-INV-NUL', 'tenant-A', false), ('S-MIX', 'tenant-A', false),
  ('S-CLM', 'tenant-A', false), ('S-PRE', 'tenant-A', false), ('S-PRE-CAN', 'tenant-A', false),
  ('S-OD', 'tenant-A', false), ('S-OD-CAN', 'tenant-A', false), ('S-AUD', 'tenant-A', false),
  ('S-GONE', 'tenant-A', true), ('S-B', 'tenant-B', false)
) v(code, t, gone);

insert into public.warehouse_receipts_cn (id, tenant_id, receipt_code, warehouse_id, client_markbox, client_name,
  boxes, status, shipment_id, is_orphan, deleted_at)
select pg_temp.fid(v.code), pg_temp.fid('tenant-A'), v.code, (select id from public.warehouses_cn where code = 'YIW-A1'),
  'SINT-0000', 'Ficha provisional', v.boxes, 'pendiente_consolidacion'::public.warehouse_receipt_status,
  pg_temp.fid(v.ship), v.orphan, case when v.gone then now() end
from (values
  ('WR-OK-1', 'S-OK', 5, false, false), ('WR-OK-2', 'S-OK', 1, true, false),
  ('WR-OK-GONE', 'S-OK', 1, false, true),
  ('WR-OD', 'S-OD', 1, false, false), ('WR-OD-CAN', 'S-OD-CAN', 1, false, false)
) v(code, ship, boxes, orphan, gone);

insert into public.invoices (id, tenant_id, shipment_id, status, lines, client_markbox, client_name,
  client_rif, client_doc_kind, client_fiscal_address, bill_to_kind, deleted_at)
select pg_temp.fid(v.label), pg_temp.fid('tenant-A'),
  case when v.ship is null then null else pg_temp.fid(v.ship) end,
  v.st::public.invoice_status, v.lines::jsonb, 'SINT-0000', 'Ficha provisional',
  'V-00000000', 'persona', 'Dirección ficticia', 'persona', case when v.gone then now() end
from (values
  -- S-OK: un borrador por shipment_id y otro sólo por el código de la línea.
  ('inv-ok', 'S-OK', 'borrador', '[{"desc":"Flete","qty":1,"unitPrice":10}]', false),
  ('inv-ok-linea', null, 'borrador', '[{"desc":"Flete","qty":1,"unitPrice":5,"shipmentCode":"S-OK"}]', false),
  -- Historia del viejo que no bloquea ni se mueve.
  ('inv-ok-nul', 'S-OK', 'anulada', '[]', false),
  ('inv-ok-gone', 'S-OK', 'emitida', '[]', true),
  ('inv-emi', 'S-INV', 'emitida', '[]', false),
  ('inv-nul', 'S-INV-NUL', 'anulada', '[]', false),
  ('inv-mix', 'S-MIX', 'borrador',
    '[{"desc":"A","qty":1,"unitPrice":1,"shipmentCode":"S-MIX"},{"desc":"B","qty":1,"unitPrice":1,"shipmentCode":"S-OTRO"}]', false)
) v(label, ship, st, lines, gone);

insert into public.consolidations (id, tenant_id) values (pg_temp.fid('cons'), pg_temp.fid('tenant-A'));
insert into public.consolidation_items (id, tenant_id, consolidation_id, shipment_id, client_markbox, client_name) values
  (pg_temp.fid('ci-ok'), pg_temp.fid('tenant-A'), pg_temp.fid('cons'), pg_temp.fid('S-OK'), 'SINT-0000', 'Ficha provisional'),
  (pg_temp.fid('ci-otro'), pg_temp.fid('tenant-A'), pg_temp.fid('cons'), pg_temp.fid('S-OTRO'), 'SINT-0000', 'Ficha provisional');
insert into public.shipment_documents (id, tenant_id, shipment_id, client_markbox, doc_type) values
  (pg_temp.fid('sdoc-ok'), pg_temp.fid('tenant-A'), pg_temp.fid('S-OK'), 'SINT-0000', 'bl'),
  (pg_temp.fid('sdoc-pod'), pg_temp.fid('tenant-A'), pg_temp.fid('S-OK'), 'SINT-0000', 'pod');
-- Un evento con nota además del inicial de 0003: el Portal del nuevo lo verá.
insert into public.shipment_events (tenant_id, shipment_id, status, note) values
  (pg_temp.fid('tenant-A'), pg_temp.fid('S-OK'), 'consolidating', 'Nota sintética del equipo');
-- H-1: la tarifa congelada viva de WR-OK-1 es del cliente provisional; la de WR-OK-2 ya fue sustituida.
insert into public.shipment_rate_snapshots (id, tenant_id, receipt_id, client_id, superseded_at) values
  (pg_temp.fid('rs-viva'), pg_temp.fid('tenant-A'), pg_temp.fid('WR-OK-1'), pg_temp.fid('C-PROV'), null),
  (pg_temp.fid('rs-vieja'), pg_temp.fid('tenant-A'), pg_temp.fid('WR-OK-2'), pg_temp.fid('C-PROV'), now());
insert into public.client_notification_schedule (id, tenant_id, shipment_id, client_markbox, status) values
  (pg_temp.fid('noti-prog'), pg_temp.fid('tenant-A'), pg_temp.fid('S-OK'), 'SINT-0000', 'scheduled'),
  (pg_temp.fid('noti-env'), pg_temp.fid('tenant-A'), pg_temp.fid('S-OK'), 'SINT-0000', 'sent');
insert into public.client_claims (id, tenant_id, shipment_id) values
  (pg_temp.fid('clm'), pg_temp.fid('tenant-A'), pg_temp.fid('S-CLM'));
insert into public.prealertas (id, tenant_id, shipment_id, status) values
  (pg_temp.fid('pre'), pg_temp.fid('tenant-A'), pg_temp.fid('S-PRE'), 'consolidada'),
  (pg_temp.fid('pre-can'), pg_temp.fid('tenant-A'), pg_temp.fid('S-PRE-CAN'), 'cancelada');
insert into public.dispatch_orders (id, tenant_id, status) values
  (pg_temp.fid('od-viva'), pg_temp.fid('tenant-A'), 'en_ruta'),
  (pg_temp.fid('od-can'), pg_temp.fid('tenant-A'), 'cancelada');
insert into public.dispatch_order_packages (od_id, package_kind, package_id) values
  (pg_temp.fid('od-viva'), 'warehouse_receipt_cn', pg_temp.fid('WR-OD')),
  (pg_temp.fid('od-can'), 'warehouse_receipt_cn', pg_temp.fid('WR-OD-CAN'));

-- Como en Supabase: EXECUTE por defecto a los roles de la API sobre funciones
-- nuevas. La 0551 tiene que quitárselo a anon, service_role y PUBLIC ella misma.
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

\if :apply_fix
\ir ../migrations/0551_pasar_embarque_a_otro_cliente.sql
\endif

-- ── Utilidades ──────────────────────────────────────────────────────────────
create temporary sequence aserciones;
create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0551: %', p_msg; end if;
  perform nextval('pg_temp.aserciones');
end;
$$;

-- Llama a la RPC como el actor (rol de la API + su auth.uid) y devuelve su
-- resultado o el error. La autorización la da la base real, no este helper.
create function pg_temp.pasar(p_actor text, p_ship text, p_client text, p_reason text,
  p_dry boolean default false, p_rol text default 'authenticated')
returns jsonb language plpgsql as $$
declare v jsonb; v_state text; v_msg text;
begin
  perform set_config('request.jwt.claim.sub',
    case when p_actor is null then '' else pg_temp.fid(p_actor)::text end, true);
  begin
    execute format('set local role %I', p_rol);
    execute 'select public.reassign_shipment_client($1, $2, $3, $4)'
      into v using pg_temp.fid(p_ship), pg_temp.fid(p_client), p_reason, p_dry;
    reset role;
    return jsonb_build_object('ok', true, 'r', v);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    reset role;
    return jsonb_build_object('ok', false, 'sqlstate', v_state, 'mensaje', v_msg);
  end;
end;
$$;

-- VOLÁTILES a propósito: una función STABLE reusa la instantánea de la sentencia
-- que la llama y no vería lo que acaba de escribir la RPC.
create function pg_temp.marca_embarque(p_label text) returns text language sql volatile as $$
  select client_markbox from public.shipments where id = pg_temp.fid(p_label)
$$;
create function pg_temp.huella() returns text language sql volatile as $$
  select md5(string_agg(x, '|' order by x)) from (
    select to_jsonb(s)::text as x from (select id, client_markbox, client_name from public.shipments) s
    union all select to_jsonb(r)::text from (select id, client_markbox, client_name, is_orphan from public.warehouse_receipts_cn) r
    union all select to_jsonb(b)::text from (select id, markbox, client_name from public.warehouse_boxes) b
    union all select to_jsonb(i)::text from (select id, client_markbox, client_name, client_rif, bill_to_kind from public.invoices) i
    union all select to_jsonb(c)::text from (select id, client_markbox, client_name from public.consolidation_items) c
    union all select to_jsonb(d)::text from (select id, client_markbox from public.shipment_documents) d
    union all select to_jsonb(n)::text from (select id, client_markbox from public.client_notification_schedule) n
  ) t
$$;
create function pg_temp.eventos() returns bigint language sql volatile as $$
  select count(*) from public.entity_audit_log where event_type = 'shipment_client_reassigned'
$$;

-- ── 1. RED / camino feliz: operaciones pasa el embarque al dueño real ───────
do $feliz$
declare v_r jsonb; v_prev jsonb; v_huella text; v_ev record;
begin
  v_huella := pg_temp.huella();

  -- La vista previa calcula y no escribe.
  v_prev := pg_temp.pasar('operations-A', 'S-OK', 'C-REAL', null, true);
  perform pg_temp.afirmar((v_prev ->> 'ok')::boolean and v_prev -> 'r' ->> 'outcome' = 'preview',
    'operaciones no pudo ver la vista previa del cambio: ' || v_prev::text);
  perform pg_temp.afirmar(pg_temp.huella() = v_huella and pg_temp.eventos() = 0,
    'la vista previa escribió algo');
  perform pg_temp.afirmar(v_prev -> 'r' -> 'moved' = jsonb_build_object(
      'shipments', 1, 'warehouse_receipts_cn', 2, 'warehouse_boxes', 6, 'invoices', 2,
      'consolidation_items', 1, 'shipment_documents', 2, 'client_notification_schedule', 1),
    'la vista previa contó otra cosa: ' || (v_prev -> 'r' -> 'moved')::text);
  perform pg_temp.afirmar(v_prev -> 'r' -> 'warnings' = '{"tarifa_congelada": 1}'::jsonb,
    'la vista previa no avisó la tarifa congelada del cliente anterior: ' || coalesce((v_prev -> 'r' -> 'warnings')::text, 'null'));
  perform pg_temp.afirmar(v_prev -> 'r' -> 'portal' = jsonb_build_object(
      'documentos', '{"bl": 1, "pod": 1}'::jsonb,
      'eventos', (select count(*) from public.shipment_events where shipment_id = pg_temp.fid('S-OK') and deleted_at is null),
      'eventos_con_nota', (select count(*) from public.shipment_events where shipment_id = pg_temp.fid('S-OK')
                             and deleted_at is null and nullif(btrim(coalesce(note, '')), '') is not null)),
    'la vista previa no contó lo que verá el Portal: ' || coalesce((v_prev -> 'r' -> 'portal')::text, 'null'));
  perform pg_temp.afirmar(((v_prev -> 'r' -> 'portal' ->> 'eventos_con_nota')::int) >= 1, 'el evento con nota no se contó');

  v_r := pg_temp.pasar('operations-A', 'S-OK', 'C-REAL', '  Dueño real confirmado por la persona de operaciones  ');
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean and v_r -> 'r' ->> 'outcome' = 'reassigned',
    'operaciones no pudo pasar el embarque: ' || v_r::text);
  perform pg_temp.afirmar(v_r -> 'r' -> 'moved' = v_prev -> 'r' -> 'moved',
    'la vista previa y el cambio no contaron lo mismo');
  perform pg_temp.afirmar(v_r -> 'r' ->> 'old_markbox' = 'SINT-0000' and v_r -> 'r' ->> 'new_markbox' = 'SINT-1001'
    and v_r -> 'r' ->> 'shipment_code' = 'S-OK', 'la respuesta no trae los Shipping Marks y el código');

  perform pg_temp.afirmar((select client_markbox = 'SINT-1001' and client_name = 'Cliente Ficticio Real' and code = 'S-OK'
    from public.shipments where id = pg_temp.fid('S-OK')), 'el embarque no cambió de dueño o perdió su código');
  perform pg_temp.afirmar((select count(*) = 2 and bool_and(client_markbox = 'SINT-1001' and client_name = 'Cliente Ficticio Real'
      and not is_orphan)
    from public.warehouse_receipts_cn where id in (pg_temp.fid('WR-OK-1'), pg_temp.fid('WR-OK-2'))),
    'las recepciones vivas no se movieron o siguen huérfanas');
  perform pg_temp.afirmar((select client_markbox from public.warehouse_receipts_cn where id = pg_temp.fid('WR-OK-GONE')) = 'SINT-0000',
    'se movió una recepción eliminada');
  perform pg_temp.afirmar((select count(*) = 6 and bool_and(b.markbox = 'SINT-1001')
    from public.warehouse_boxes b where b.receipt_id in (pg_temp.fid('WR-OK-1'), pg_temp.fid('WR-OK-2'))),
    'las cajas no siguieron a su recepción');
  perform pg_temp.afirmar((select count(*) = 2 and bool_and(client_markbox = 'SINT-1001' and client_name = 'Cliente Ficticio Real'
      and client_rif is null and client_doc_kind is null and client_fiscal_address is null and bill_to_kind is null)
    from public.invoices where id in (pg_temp.fid('inv-ok'), pg_temp.fid('inv-ok-linea'))),
    'los borradores no se movieron o conservan el titular fiscal del viejo');
  perform pg_temp.afirmar((select bool_and(client_markbox = 'SINT-0000' and client_rif = 'V-00000000')
    from public.invoices where id in (pg_temp.fid('inv-ok-nul'), pg_temp.fid('inv-ok-gone'))),
    'se movió una factura anulada o eliminada');
  perform pg_temp.afirmar((select client_markbox from public.consolidation_items where id = pg_temp.fid('ci-ok')) = 'SINT-1001'
    and (select client_markbox from public.consolidation_items where id = pg_temp.fid('ci-otro')) = 'SINT-0000',
    'la consolidación no se movió o se movió la de otro embarque');
  perform pg_temp.afirmar((select client_markbox from public.shipment_documents where id = pg_temp.fid('sdoc-ok')) = 'SINT-1001',
    'el documento del Portal no se movió');
  perform pg_temp.afirmar((select client_markbox from public.client_notification_schedule where id = pg_temp.fid('noti-prog')) = 'SINT-1001'
    and (select client_markbox from public.client_notification_schedule where id = pg_temp.fid('noti-env')) = 'SINT-0000',
    'los avisos no quedaron bien: el programado va al nuevo y el enviado queda');
  perform pg_temp.afirmar(pg_temp.marca_embarque('S-OTRO') = 'SINT-0000', 'se movió otro embarque');

  select * into v_ev from public.entity_audit_log where event_type = 'shipment_client_reassigned';
  perform pg_temp.afirmar(pg_temp.eventos() = 1 and v_ev.entity_type = 'shipment' and v_ev.entity_id = pg_temp.fid('S-OK')
    and v_ev.actor_type = 'user' and v_ev.actor_id = pg_temp.fid('operations-A'),
    'el evento no tiene la entidad o el actor');
  perform pg_temp.afirmar(v_ev.reason = 'Dueño real confirmado por la persona de operaciones', 'el evento no tiene el motivo recortado');
  perform pg_temp.afirmar(v_ev.before_data = '{"client_markbox": "SINT-0000"}'::jsonb
    and v_ev.after_data = '{"client_markbox": "SINT-1001"}'::jsonb,
    'antes/después no son sólo el Shipping Mark: ' || coalesce(v_ev.before_data::text, '') || coalesce(v_ev.after_data::text, ''));
  perform pg_temp.afirmar(v_ev.correlation_id like 'sdd-%:reassign:%' and v_ev.source = 'rpc'
    and v_ev.payload ->> 'shipment_code' = 'S-OK' and v_ev.payload -> 'moved' = v_r -> 'r' -> 'moved',
    'el evento no tiene correlación, fuente o payload');
  perform pg_temp.afirmar(v_ev.payload -> 'warnings' = '{"tarifa_congelada": 1}'::jsonb,
    'el evento no guardó el aviso de tarifa congelada');
  perform pg_temp.afirmar((select client_id from public.shipment_rate_snapshots where id = pg_temp.fid('rs-viva')) = pg_temp.fid('C-PROV'),
    'la 0551 tocó la tarifa congelada');
  perform pg_temp.afirmar(position('Cliente Ficticio' in v_ev.payload::text || v_ev.before_data::text || v_ev.after_data::text) = 0,
    'el evento lleva el nombre del cliente');
  perform pg_temp.afirmar(coalesce(current_setting('dtd.audit_reason', true), '') = '',
    'el motivo quedó fijado después de la RPC');

  -- P1: se vuelve a pasar (y el admin también puede).
  v_r := pg_temp.pasar('admin-A', 'S-OK', 'C-PROV', 'Vuelve a la ficha provisional');
  perform pg_temp.afirmar(v_r -> 'r' ->> 'outcome' = 'reassigned' and pg_temp.marca_embarque('S-OK') = 'SINT-0000'
    and pg_temp.eventos() = 2, 'admin no pudo devolver el embarque: ' || v_r::text);
end;
$feliz$;

-- ── 2. Forma y ACL ──────────────────────────────────────────────────────────
do $forma$
declare v_fn oid := to_regprocedure('public.reassign_shipment_client(uuid,uuid,text,boolean)');
begin
  perform pg_temp.afirmar((select prosecdef and proconfig @> array['search_path=""']::text[] from pg_proc where oid = v_fn),
    'la función no es SECURITY DEFINER con search_path vacío');
  perform pg_temp.afirmar(has_function_privilege('authenticated', v_fn, 'EXECUTE')
    and not has_function_privilege('anon', v_fn, 'EXECUTE')
    and not has_function_privilege('service_role', v_fn, 'EXECUTE'),
    'EXECUTE no es sólo de authenticated');
end;
$forma$;

-- ── 3. Roles ────────────────────────────────────────────────────────────────
do $roles$
declare v_r jsonb; v_actor text; v_huella text := pg_temp.huella(); v_ev bigint := pg_temp.eventos();
begin
  foreach v_actor in array array['accounting-A', 'warehouse-A', 'support-A', 'marketing-A',
    'admin-off', 'admin-dual'] loop
    v_r := pg_temp.pasar(v_actor, 'S-ROL', 'C-REAL', 'Intento sin permiso');
    perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean and v_r ->> 'sqlstate' = '42501',
      v_actor || ' pudo pasar el embarque o falló por otra cosa: ' || v_r::text);
    v_r := pg_temp.pasar(v_actor, 'S-ROL', 'C-REAL', null, true);
    perform pg_temp.afirmar(v_r ->> 'sqlstate' = '42501', v_actor || ' vio la vista previa: ' || v_r::text);
  end loop;
  -- D2 de Sam (2026-11-16): comercial también puede.
  v_r := pg_temp.pasar('commercial-A', 'S-ROL', 'C-REAL', null, true);
  perform pg_temp.afirmar(v_r -> 'r' ->> 'outcome' = 'preview', 'comercial no pudo ver la vista previa: ' || v_r::text);
  v_r := pg_temp.pasar(null, 'S-ROL', 'C-REAL', 'Sin sesión');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '42501', 'sin sesión no dio 42501: ' || v_r::text);
  v_r := pg_temp.pasar('operations-A', 'S-ROL', 'C-REAL', 'Por anon', false, 'anon');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '42501', 'anon pudo ejecutar: ' || v_r::text);
  -- Un admin de otro tenant no ve el embarque ni el cliente del tenant A.
  v_r := pg_temp.pasar('admin-B', 'S-ROL', 'C-REAL', 'Otro tenant');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = 'P0002', 'un admin de otro tenant encontró el embarque: ' || v_r::text);
  -- … tampoco con un cliente de SU tenant (H-6): el embarque del tenant A no existe para él.
  v_r := pg_temp.pasar('admin-B', 'S-ROL', 'C-B', 'Otro tenant con cliente propio');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = 'P0002' and pg_temp.marca_embarque('S-ROL') = 'SINT-0000',
    'un admin de otro tenant pasó un embarque ajeno a su cliente: ' || v_r::text);
  perform pg_temp.afirmar(pg_temp.huella() = v_huella and pg_temp.eventos() = v_ev, 'un intento rechazado cambió algo');
end;
$roles$;

-- ── 4. Validaciones ─────────────────────────────────────────────────────────
do $validaciones$
declare v_r jsonb; v_huella text := pg_temp.huella(); v_ev bigint := pg_temp.eventos();
begin
  v_r := pg_temp.pasar('operations-A', 'S-ROL', 'C-REAL', 'abc');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'aceptó un motivo de 3 caracteres: ' || v_r::text);
  v_r := pg_temp.pasar('operations-A', 'S-ROL', 'C-REAL', '   ');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'aceptó un motivo vacío: ' || v_r::text);
  v_r := pg_temp.pasar('operations-A', 'S-ROL', 'C-REAL', repeat('x', 1001));
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'aceptó un motivo de 1001 caracteres: ' || v_r::text);
  v_r := pg_temp.pasar('operations-A', 'S-ROL', 'C-PROV', 'Mismo cliente');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'aceptó pasarlo al mismo cliente: ' || v_r::text);
  v_r := pg_temp.pasar('operations-A', 'S-ROL', 'C-SIN-MB', 'Sin marca');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'aceptó un cliente sin Shipping Mark: ' || v_r::text);
  v_r := pg_temp.pasar('operations-A', 'S-ROL', 'C-FUSION', 'Fusionado');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = '22023', 'aceptó una ficha fusionada: ' || v_r::text);
  v_r := pg_temp.pasar('operations-A', 'S-ROL', 'C-GONE', 'Eliminado');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = 'P0002', 'aceptó un cliente eliminado: ' || v_r::text);
  v_r := pg_temp.pasar('operations-A', 'S-ROL', 'C-B', 'Otro tenant');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = 'P0002', 'aceptó un cliente de otro tenant: ' || v_r::text);
  v_r := pg_temp.pasar('operations-A', 'S-GONE', 'C-REAL', 'Embarque eliminado');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = 'P0002', 'pasó un embarque eliminado: ' || v_r::text);
  v_r := pg_temp.pasar('operations-A', 'S-B', 'C-REAL', 'Embarque de otro tenant');
  perform pg_temp.afirmar(v_r ->> 'sqlstate' = 'P0002', 'pasó un embarque de otro tenant: ' || v_r::text);
  perform pg_temp.afirmar(pg_temp.huella() = v_huella and pg_temp.eventos() = v_ev, 'una validación fallida cambió algo');
end;
$validaciones$;

-- ── 5. Bloqueos y sus contrapartes ──────────────────────────────────────────
do $bloqueos$
declare v_r jsonb; v_caso record; v_huella text; v_ev bigint;
begin
  for v_caso in select * from (values
    ('S-INV', 'factura_emitida'), ('S-MIX', 'factura_varios_embarques'), ('S-CLM', 'reclamo'),
    ('S-PRE', 'prealerta'), ('S-OD', 'orden_despacho')
  ) c(ship, bloqueo) loop
    v_huella := pg_temp.huella(); v_ev := pg_temp.eventos();
    v_r := pg_temp.pasar('operations-A', v_caso.ship, 'C-REAL', 'Intento bloqueado');
    perform pg_temp.afirmar((v_r ->> 'ok')::boolean and v_r -> 'r' ->> 'outcome' = 'blocked'
      and v_r -> 'r' -> 'blockers' = jsonb_build_object(v_caso.bloqueo, 1),
      v_caso.ship || ' no quedó bloqueado sólo por ' || v_caso.bloqueo || ': ' || v_r::text);
    perform pg_temp.afirmar(pg_temp.huella() = v_huella and pg_temp.eventos() = v_ev,
      v_caso.ship || ' bloqueado cambió algo');
    v_r := pg_temp.pasar('operations-A', v_caso.ship, 'C-REAL', null, true);
    perform pg_temp.afirmar(v_r -> 'r' ->> 'outcome' = 'blocked', 'la vista previa de ' || v_caso.ship || ' no avisó el bloqueo');
  end loop;
  -- El borrador mixto bloquea también al otro embarque que factura.
  v_r := pg_temp.pasar('operations-A', 'S-OTRO', 'C-REAL', null, true);
  perform pg_temp.afirmar(v_r -> 'r' -> 'blockers' = '{"factura_varios_embarques": 1}'::jsonb,
    'el otro embarque del borrador mixto no quedó bloqueado: ' || v_r::text);

  foreach v_caso.ship in array array['S-INV-NUL', 'S-PRE-CAN', 'S-OD-CAN'] loop
    v_r := pg_temp.pasar('operations-A', v_caso.ship, 'C-REAL', 'La contraparte no bloquea');
    perform pg_temp.afirmar(v_r -> 'r' ->> 'outcome' = 'reassigned' and pg_temp.marca_embarque(v_caso.ship) = 'SINT-1001',
      v_caso.ship || ' quedó bloqueado por algo anulado o cancelado: ' || v_r::text);
  end loop;
  perform pg_temp.afirmar((select client_markbox from public.invoices where id = pg_temp.fid('inv-nul')) = 'SINT-0000',
    'la factura anulada se movió');
end;
$bloqueos$;

-- ── 6. Todo o nada: si el evento falla, nada cambia ─────────────────────────
do $atomico$
declare v_r jsonb; v_huella text; v_ev bigint;
begin
  update public.audit_entity_types set status = 'deprecated', deprecated_at = now() where entity_type = 'shipment';
  v_huella := pg_temp.huella(); v_ev := pg_temp.eventos();
  v_r := pg_temp.pasar('operations-A', 'S-AUD', 'C-REAL', 'El evento va a fallar');
  perform pg_temp.afirmar(not (v_r ->> 'ok')::boolean, 'con el writer roto se pasó el embarque: ' || v_r::text);
  perform pg_temp.afirmar(pg_temp.huella() = v_huella and pg_temp.eventos() = v_ev, 'un cambio fallido dejó filas o eventos');
  update public.audit_entity_types set status = 'active', deprecated_at = null where entity_type = 'shipment';
  v_r := pg_temp.pasar('operations-A', 'S-AUD', 'C-REAL', 'Con el writer de vuelta');
  perform pg_temp.afirmar(v_r -> 'r' ->> 'outcome' = 'reassigned', 'con el writer de vuelta no se pudo: ' || v_r::text);
end;
$atomico$;

select 'TEST 0551 GREEN: ' || currval('pg_temp.aserciones') || ' aserciones' as resultado;
rollback;
