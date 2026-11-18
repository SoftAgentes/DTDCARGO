\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0564 (SDD-0674, EXC-0674): botón «Facturar» en Embarques. Usa
-- fixtures ficticios y hace rollback al final: no toca prod.
--
-- Las tablas y funciones de las que depende la 0564 son réplicas mínimas, con solo las columnas que
-- usa. El asiento (post_invoice_journal_entry_atomic) es un doble: responde 'posted' o falla según
-- test.post, y anota cada llamada.
--
-- Lo que se protege:
--   1. Aplicar la 0564 otra vez no falla.
--   2. Por cliente: operations factura el total tecleado con IVA.
--      · base = round(total/1,16) e iva = total − base;
--      · factura emitida en USD, con una línea por embarque vigente repartida por CBM, cuya suma da
--        exactamente la base;
--      · se le factura al aliado raíz;
--      · se hace el asiento y queda el rastro con legal_ack 'exc_0674' y quién tecleó.
--   3. Un cliente no se factura dos veces.
--   4. Roles: commercial, warehouse y support no facturan. accounting y admin sí.
--   5. Un contenedor fuera de la lista, borrado o de otro tenant no se factura.
--   6. Monto: 0, negativo y más de 2 decimales se rechazan.
--      Confirmación: sin «Confirmado» exacto se rechaza.
--   7. Contenedor completo, todo o nada: si un cliente falla, no queda ninguna factura.
--      Tampoco queda ninguna si el asiento no sale.
--   8. Un embarque reasignado después a otro contenedor no cuenta.
--   9. Privilegios: anon y service_role no ejecutan la RPC, y authenticated no escribe las tablas.
--      RLS: otro tenant y commercial no ven filas.

begin;

do $roles$
begin
  if pg_catalog.to_regclass('public.invoices') is not null or pg_catalog.to_regclass('public.tenants') is not null then
    raise exception 'TEST 0564 requiere una base PostgreSQL desechable vacía';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;

-- ─── Réplicas mínimas ────────────────────────────────────────
create table public.tenants (id uuid primary key, iva_enabled boolean);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null references public.tenants(id), role text not null,
  disabled_at timestamptz
);
create function public.get_user_tenant_id() returns uuid language sql stable security definer set search_path = ''
as $$ select (pg_catalog.array_agg(ut.tenant_id))[1] from public.user_tenants ut
      where ut.user_id = (select auth.uid()) and ut.disabled_at is null having pg_catalog.count(*) = 1 $$;
create function public.current_studio_role() returns text language sql stable security definer set search_path = public
as $$ select role from public.user_tenants where user_id = (select auth.uid()) and disabled_at is null limit 1 $$;
grant execute on function public.get_user_tenant_id(), public.current_studio_role() to authenticated;

create table public.aliados (
  id uuid primary key, tenant_id uuid not null, client_id uuid, parent_aliado_id uuid
);
create table public.clients (
  id uuid primary key, tenant_id uuid not null, markbox text, name text not null, rif text, doc_kind text,
  aliado_id uuid references public.aliados(id), deleted_at timestamptz
);
create table public.shipments (
  id uuid primary key, tenant_id uuid not null, code text not null, client_markbox text,
  volume_m3 numeric, deleted_at timestamptz
);
create table public.consolidations (
  id uuid primary key, tenant_id uuid not null, ref text not null, deleted_at timestamptz
);
create table public.consolidation_items (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  consolidation_id uuid not null references public.consolidations(id), shipment_id uuid references public.shipments(id),
  created_at timestamptz not null default now()
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, invoice_code text not null,
  client_markbox text not null, client_name text not null, client_rif text, client_doc_kind text,
  shipment_id uuid, shipment_code text, currency text not null, iva_rate numeric(5,2) not null,
  base_amount numeric(14,2) not null, iva_amount numeric(14,2) not null, total_amount numeric(14,2) not null,
  status text not null, issued_at date, due_date date, lines jsonb not null, notes text,
  fund_class text not null, deleted_at timestamptz, unique (tenant_id, invoice_code)
);
create sequence public.t_correlativo;
create function public.next_invoice_code(p_tenant_id uuid) returns text language sql volatile
as $$ select 'F-TEST-' || pg_catalog.nextval('public.t_correlativo')::text $$;
create table public.t_asientos (invoice_id uuid not null);
create function public.post_invoice_journal_entry_atomic(p_tenant_id uuid, p_invoice_id uuid) returns jsonb
language plpgsql volatile as $$
begin
  if coalesce(current_setting('test.post', true), '') = 'falla' then
    return jsonb_build_object('version', 1, 'outcome', 'not_posted', 'reason', 'sin_cuentas');
  end if;
  insert into public.t_asientos (invoice_id) values (p_invoice_id);
  return jsonb_build_object('version', 1, 'outcome', 'posted', 'reason', 'posted');
end $$;
revoke all on function public.next_invoice_code(uuid), public.post_invoice_journal_entry_atomic(uuid, uuid) from public;

\ir ../migrations/0564_exc0674_facturar_contenedor.sql
-- 1. Aplicarla otra vez no falla.
\ir ../migrations/0564_exc0674_facturar_contenedor.sql

-- ─── Fixtures ────────────────────────────────────────────────
-- Tenant A (IVA 16 %) y tenant B. Usuarios: a1 operations, a2 commercial, a3 warehouse, a4 support,
-- a5 accounting, a6 admin (de A) y b1 operations (de B).
insert into public.tenants values
  ('00000000-0000-4000-8000-0000000000a0', true),
  ('00000000-0000-4000-8000-0000000000b0', false);
insert into public.user_tenants (user_id, tenant_id, role) values
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-0000000000a0', 'operations'),
  ('00000000-0000-4000-8000-00000000a002', '00000000-0000-4000-8000-0000000000a0', 'commercial'),
  ('00000000-0000-4000-8000-00000000a003', '00000000-0000-4000-8000-0000000000a0', 'warehouse'),
  ('00000000-0000-4000-8000-00000000a004', '00000000-0000-4000-8000-0000000000a0', 'support'),
  ('00000000-0000-4000-8000-00000000a005', '00000000-0000-4000-8000-0000000000a0', 'accounting'),
  ('00000000-0000-4000-8000-00000000a006', '00000000-0000-4000-8000-0000000000a0', 'admin'),
  ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-0000000000b0', 'operations');

-- Aliado raíz «AR» (su ficha es el cliente AR) con un subaliado «AR-S»; el cliente AR-S-0001 es del
-- subaliado, así que se le factura a AR.
insert into public.clients (id, tenant_id, markbox, name, rif, doc_kind) values
  ('00000000-0000-4000-8000-0000000c0a01', '00000000-0000-4000-8000-0000000000a0', 'AR', 'Aliado Raíz Ficticio', 'J-000000001', 'rif');
insert into public.aliados values
  ('00000000-0000-4000-8000-0000000a1001', '00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-0000000c0a01', null),
  ('00000000-0000-4000-8000-0000000a1002', '00000000-0000-4000-8000-0000000000a0', null, '00000000-0000-4000-8000-0000000a1001');
insert into public.clients (id, tenant_id, markbox, name, aliado_id) values
  ('00000000-0000-4000-8000-0000000c0a02', '00000000-0000-4000-8000-0000000000a0', 'AR-S-0001', 'Cliente de Subaliado', '00000000-0000-4000-8000-0000000a1002'),
  ('00000000-0000-4000-8000-0000000c0a03', '00000000-0000-4000-8000-0000000000a0', 'DTD-T001', 'Cliente Directo Uno', null),
  ('00000000-0000-4000-8000-0000000c0a04', '00000000-0000-4000-8000-0000000000a0', 'DTD-T002', 'Cliente Directo Dos', null);

-- Contenedores: K64 (en la lista), K65 (fuera de la lista), KDEL (en la lista pero borrado) y KB (tenant B).
insert into public.consolidations values
  ('00000000-0000-4000-8000-00000000c064', '00000000-0000-4000-8000-0000000000a0', 'TEST-CONSOL-64', null),
  ('00000000-0000-4000-8000-00000000c065', '00000000-0000-4000-8000-0000000000a0', 'TEST-CONSOL-65', null),
  ('00000000-0000-4000-8000-00000000cdel', '00000000-0000-4000-8000-0000000000a0', 'TEST-CONSOL-DEL', now()),
  ('00000000-0000-4000-8000-00000000cb64', '00000000-0000-4000-8000-0000000000b0', 'TEST-CONSOL-B', null);
insert into public.exc0674_contenedores (tenant_id, consolidation_id) values
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000cdel'),
  ('00000000-0000-4000-8000-0000000000b0', '00000000-0000-4000-8000-00000000cb64');

-- Embarques: AR-S-0001 tiene 3 en K64 (CBM 1, 2 y 0,5). Uno más se reasignó después al K65 y no cuenta.
-- DTD-T001 tiene 1 en K64; DTD-T002 tiene 1 en K65.
insert into public.shipments values
  ('00000000-0000-4000-8000-0000000e0001', '00000000-0000-4000-8000-0000000000a0', 'AR-S-0001-01', 'AR-S-0001', 1, null),
  ('00000000-0000-4000-8000-0000000e0002', '00000000-0000-4000-8000-0000000000a0', 'AR-S-0001-02', 'AR-S-0001', 2, null),
  ('00000000-0000-4000-8000-0000000e0003', '00000000-0000-4000-8000-0000000000a0', 'AR-S-0001-03', 'ar-s-0001 ', 0.5, null),
  ('00000000-0000-4000-8000-0000000e0004', '00000000-0000-4000-8000-0000000000a0', 'AR-S-0001-04', 'AR-S-0001', 9, null),
  ('00000000-0000-4000-8000-0000000e0005', '00000000-0000-4000-8000-0000000000a0', 'DTD-T001-01', 'DTD-T001', 3, null),
  ('00000000-0000-4000-8000-0000000e0006', '00000000-0000-4000-8000-0000000000a0', 'DTD-T002-01', 'DTD-T002', 1, null);
insert into public.consolidation_items (tenant_id, consolidation_id, shipment_id, created_at) values
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064', '00000000-0000-4000-8000-0000000e0001', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064', '00000000-0000-4000-8000-0000000e0002', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064', '00000000-0000-4000-8000-0000000e0003', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064', '00000000-0000-4000-8000-0000000e0004', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c065', '00000000-0000-4000-8000-0000000e0004', now() - interval '1 day'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064', '00000000-0000-4000-8000-0000000e0005', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c065', '00000000-0000-4000-8000-0000000e0006', now() - interval '2 days');

-- Ayuda: llama a la RPC como un usuario y devuelve el mensaje del error (o null si no falló).
create function public.t_intento(p_uid text, p_cons uuid, p_montos jsonb, p_conf text default 'Confirmado')
returns text language plpgsql as $$
declare v_err text;
begin
  perform set_config('test.uid', p_uid, true);
  set local role authenticated;
  begin
    perform public.exc0674_facturar(p_cons, p_montos, p_conf);
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  return v_err;
end $$;
grant execute on function public.t_intento(text, uuid, jsonb, text) to authenticated;

-- ─── 4 y 6. Rechazos antes de facturar nada ──────────────────
do $rechazos$
declare
  k64 constant uuid := '00000000-0000-4000-8000-00000000c064';
  uno constant jsonb := '[{"client_markbox":"DTD-T001","total_usd":116}]';
  v text;
begin
  v := public.t_intento('00000000-0000-4000-8000-00000000a002', k64, uno);
  if v is distinct from 'exc0674:rol' then raise exception 'CONTRATO 4: commercial facturó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a003', k64, uno);
  if v is distinct from 'exc0674:rol' then raise exception 'CONTRATO 4: warehouse facturó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a004', k64, uno);
  if v is distinct from 'exc0674:rol' then raise exception 'CONTRATO 4: support facturó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a001', k64, uno, 'confirmado');
  if v is distinct from 'exc0674:sin_confirmacion' then raise exception 'CONTRATO 6: confirmación inexacta pasó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a001', k64, uno, null);
  if v is distinct from 'exc0674:sin_confirmacion' then raise exception 'CONTRATO 6: sin confirmación pasó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000c065',
                        '[{"client_markbox":"DTD-T002","total_usd":10}]');
  if v is distinct from 'exc0674:contenedor_fuera_de_lista' then raise exception 'CONTRATO 5: K65 fuera de la lista se facturó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000cdel', uno);
  if v is distinct from 'exc0674:contenedor_fuera_de_lista' then raise exception 'CONTRATO 5: contenedor borrado se facturó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000b001', k64, uno);
  if v is distinct from 'exc0674:contenedor_fuera_de_lista' then raise exception 'CONTRATO 5: el tenant B facturó el K64 de A (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a001', k64, '[{"client_markbox":"DTD-T001","total_usd":0}]');
  if v is distinct from 'exc0674:monto:DTD-T001' then raise exception 'CONTRATO 6: monto 0 pasó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a001', k64, '[{"client_markbox":"DTD-T001","total_usd":-5}]');
  if v is distinct from 'exc0674:monto:DTD-T001' then raise exception 'CONTRATO 6: monto negativo pasó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a001', k64, '[{"client_markbox":"DTD-T001","total_usd":10.005}]');
  if v is distinct from 'exc0674:monto:DTD-T001' then raise exception 'CONTRATO 6: tres decimales pasó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a001', k64, '[{"client_markbox":"DTD-T001","total_usd":"10"}]');
  if v is distinct from 'exc0674:datos' then raise exception 'CONTRATO 6: monto como texto pasó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a001', k64, '[{"client_markbox":"DTD-T002","total_usd":10}]');
  if v is distinct from 'exc0674:cliente_sin_embarques:DTD-T002' then raise exception 'CONTRATO 5: cliente sin embarques en K64 pasó (%)', v; end if;
  if exists (select 1 from public.invoices) or exists (select 1 from public.exc0674_facturas) then
    raise exception 'CONTRATO 4-6: un rechazo dejó una factura o un rastro';
  end if;
end
$rechazos$;

-- ─── 7. Todo o nada ──────────────────────────────────────────
do $todo_o_nada$
declare
  k64 constant uuid := '00000000-0000-4000-8000-00000000c064';
  v text;
begin
  -- El segundo cliente no tiene embarques en el K64: no queda la factura del primero.
  v := public.t_intento('00000000-0000-4000-8000-00000000a001', k64,
    '[{"client_markbox":"DTD-T001","total_usd":116},{"client_markbox":"DTD-T002","total_usd":10}]');
  if v is distinct from 'exc0674:cliente_sin_embarques:DTD-T002' then raise exception 'CONTRATO 7: (%)', v; end if;
  -- El mismo cliente dos veces en una llamada.
  v := public.t_intento('00000000-0000-4000-8000-00000000a001', k64,
    '[{"client_markbox":"DTD-T001","total_usd":116},{"client_markbox":"dtd-t001","total_usd":116}]');
  if v is distinct from 'exc0674:datos' then raise exception 'CONTRATO 7: cliente repetido pasó (%)', v; end if;
  -- El asiento no sale.
  perform set_config('test.post', 'falla', true);
  v := public.t_intento('00000000-0000-4000-8000-00000000a001', k64, '[{"client_markbox":"DTD-T001","total_usd":116}]');
  perform set_config('test.post', '', true);
  if v is distinct from 'exc0674:asiento:sin_cuentas' then raise exception 'CONTRATO 7: asiento fallido (%)', v; end if;
  if exists (select 1 from public.invoices) or exists (select 1 from public.exc0674_facturas)
     or exists (select 1 from public.t_asientos) then
    raise exception 'CONTRATO 7: quedó una factura, un rastro o un asiento a medias';
  end if;
end
$todo_o_nada$;

-- ─── 2, 3 y 8. Facturar por cliente ──────────────────────────
do $por_cliente$
declare
  k64 constant uuid := '00000000-0000-4000-8000-00000000c064';
  r jsonb;
  i public.invoices%rowtype;
  f public.exc0674_facturas%rowtype;
  v text;
  v_suma numeric;
begin
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000a001', true);
  set local role authenticated;
  r := public.exc0674_facturar(k64, '[{"client_markbox":" ar-s-0001","total_usd":406}]', 'Confirmado');
  reset role;
  if pg_catalog.jsonb_array_length(r -> 'facturas') <> 1 then raise exception 'CONTRATO 2: salida %', r; end if;

  select * into i from public.invoices;
  if i.status <> 'emitida' or i.currency <> 'USD' or i.issued_at is null or i.due_date <> i.issued_at + 30 then
    raise exception 'CONTRATO 2: la factura no quedó emitida en USD con vencimiento a 30 días';
  end if;
  -- 406 con IVA 16 %: base 350,00 e IVA 56,00.
  if i.total_amount <> 406 or i.base_amount <> 350 or i.iva_amount <> 56 or i.iva_rate <> 16 then
    raise exception 'CONTRATO 2: montos % / % / %', i.base_amount, i.iva_amount, i.total_amount;
  end if;
  if i.client_markbox <> 'AR' or i.client_name <> 'Aliado Raíz Ficticio' or i.client_rif <> 'J-000000001' then
    raise exception 'CONTRATO 2: no se le facturó al aliado raíz (%)', i.client_markbox;
  end if;
  -- 8. Tres líneas (la del -04, reasignado al K65, no cuenta), en orden de código, repartidas por CBM
  --    1 : 2 : 0,5 sobre 3,5, y la suma es exactamente la base.
  if pg_catalog.jsonb_array_length(i.lines) <> 3 then
    raise exception 'CONTRATO 8: % líneas', pg_catalog.jsonb_array_length(i.lines);
  end if;
  select pg_catalog.sum((l ->> 'unitPrice')::numeric * (l ->> 'qty')::numeric) into v_suma
    from pg_catalog.jsonb_array_elements(i.lines) l;
  if v_suma <> i.base_amount then raise exception 'CONTRATO 2: las líneas suman % y la base es %', v_suma, i.base_amount; end if;
  if (i.lines -> 0 ->> 'unitPrice')::numeric <> 100 or (i.lines -> 1 ->> 'unitPrice')::numeric <> 200
     or (i.lines -> 2 ->> 'unitPrice')::numeric <> 50 or i.lines -> 0 ->> 'shipmentCode' <> 'AR-S-0001-01' then
    raise exception 'CONTRATO 2: reparto por CBM %', i.lines;
  end if;
  if i.shipment_code <> 'AR-S-0001-01' or i.fund_class <> 'third_party' then
    raise exception 'CONTRATO 2: primer embarque o clase de fondos';
  end if;
  if (select pg_catalog.count(*) from public.t_asientos where invoice_id = i.id) <> 1 then
    raise exception 'CONTRATO 2: no se hizo el asiento';
  end if;
  select * into f from public.exc0674_facturas;
  if f.invoice_id <> i.id or f.client_markbox <> 'AR-S-0001' or f.billed_markbox <> 'AR' or f.total_usd <> 406
     or f.legal_ack <> 'exc_0674' or f.tecleado_por <> '00000000-0000-4000-8000-00000000a001' then
    raise exception 'CONTRATO 2: rastro incompleto';
  end if;

  -- 3. Otra vez el mismo cliente, ahora con accounting: no se factura dos veces.
  v := public.t_intento('00000000-0000-4000-8000-00000000a005', k64, '[{"client_markbox":"AR-S-0001","total_usd":406}]');
  if v is distinct from 'exc0674:ya_facturado:AR-S-0001' then raise exception 'CONTRATO 3: (%)', v; end if;
  if (select pg_catalog.count(*) from public.invoices) <> 1 then raise exception 'CONTRATO 3: segunda factura'; end if;

  -- 4. admin sí factura (cliente directo, se le factura a él mismo).
  v := public.t_intento('00000000-0000-4000-8000-00000000a006', k64, '[{"client_markbox":"DTD-T001","total_usd":0.01}]');
  if v is not null then raise exception 'CONTRATO 4: admin no pudo facturar (%)', v; end if;
  select * into i from public.invoices where client_markbox = 'DTD-T001';
  if i.total_amount <> 0.01 or i.base_amount + i.iva_amount <> 0.01 then
    raise exception 'CONTRATO 2: el total mínimo no cuadra (% + %)', i.base_amount, i.iva_amount;
  end if;
end
$por_cliente$;

-- ─── 9. Privilegios y RLS ────────────────────────────────────
do $privilegios$
declare
  n integer;
begin
  if pg_catalog.has_function_privilege('anon', 'public.exc0674_facturar(uuid,jsonb,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.exc0674_facturar(uuid,jsonb,text)', 'EXECUTE') then
    raise exception 'CONTRATO 9: anon o service_role ejecutan la RPC';
  end if;
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000a001', true);
  set local role authenticated;
  begin
    insert into public.exc0674_contenedores (tenant_id, consolidation_id)
    values ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c065');
    raise exception 'CONTRATO 9: authenticated agregó un contenedor a la lista';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.exc0674_facturas;
    raise exception 'CONTRATO 9: authenticated borró el rastro';
  exception when insufficient_privilege then null;
  end;
  select pg_catalog.count(*) into n from public.exc0674_facturas;
  if n <> 2 then raise exception 'CONTRATO 9: operations de A ve % filas del rastro (esperaba 2)', n; end if;
  reset role;

  perform set_config('test.uid', '00000000-0000-4000-8000-00000000a002', true);
  set local role authenticated;
  select pg_catalog.count(*) into n from public.exc0674_facturas;
  if n <> 0 then raise exception 'CONTRATO 9: commercial ve el rastro con montos'; end if;
  select pg_catalog.count(*) into n from public.exc0674_contenedores;
  if n <> 0 then raise exception 'CONTRATO 9: commercial ve la lista'; end if;
  reset role;

  perform set_config('test.uid', '00000000-0000-4000-8000-00000000b001', true);
  set local role authenticated;
  select pg_catalog.count(*) into n from public.exc0674_facturas;
  if n <> 0 then raise exception 'CONTRATO 9: el tenant B ve el rastro de A'; end if;
  select pg_catalog.count(*) into n from public.exc0674_contenedores;
  if n <> 1 then raise exception 'CONTRATO 9: el tenant B ve % contenedores (esperaba el suyo)', n; end if;
  reset role;
end
$privilegios$;

rollback;
