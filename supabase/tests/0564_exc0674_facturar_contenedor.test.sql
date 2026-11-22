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
--   2. Por cliente: accounting factura el total tecleado con IVA.
--      · base = round(total/1,16) e iva = total − base;
--      · factura emitida en USD, con una línea por embarque vigente repartida por CBM, cuya suma da
--        exactamente la base;
--      · se le factura al aliado raíz;
--      · se hace el asiento y queda el rastro con legal_ack 'exc_0674' y quién tecleó.
--   3. Un cliente no se factura dos veces.
--   4. Roles: operations, commercial, warehouse y support no facturan. accounting y admin sí.
--   5. Un contenedor fuera de la lista, borrado o de otro tenant no se factura.
--   6. Monto: 0, negativo y más de 2 decimales se rechazan.
--      Confirmación: sin «Confirmado» exacto se rechaza.
--   7. Contenedor completo, todo o nada: si un cliente falla, no queda ninguna factura.
--      Tampoco queda ninguna si el asiento no sale.
--   8. Un embarque reasignado después a otro contenedor no cuenta.
--   9. Privilegios: anon y service_role no ejecutan la RPC, y authenticated no escribe las tablas.
--      RLS: otro tenant y commercial no ven filas.
--  10. Asiento 'already_posted' se acepta; uno 'not_posted' deshace todo.
--  11. Auditoría: cada factura deja un evento invoice_emitted_exc0674 con legal_ack exc_0674 y el
--      actor real. Si el evento no se puede escribir, no se factura nada.
--  12. La lista transitoria: sin motivo (dtd.audit_reason) no se agrega ni se quita nada, no se
--      edita, y cada alta queda auditada.
--  14. Anular la factura en Facturación marca la fila y el cliente se puede volver a facturar (índice
--      parcial).
--  15. operations no factura ni ve el rastro, el vínculo ni la lista (Sam, 2026-11-18).
--  16. Dos fichas vivas con el mismo Shipping Mark: error explícito (no limit 1).
--  17. Un ciclo en la cadena de aliados aborta con error, no cuelga.
--  18. El desarme se ensaya: se niega con facturas de la regla y, sin ellas, quita todo.
--  13. El vínculo factura ↔ envío ↔ cliente real (para la 0574) cubre todos los embarques del cliente,
--      con su Shipping Mark y no el del aliado. La vista es security_invoker y deja de contar una
--      factura borrada.

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
-- Copia del cuerpo de la 0077 (63-83): max+1 sin lock. La carrera 0564 lo necesita así.
create function public.next_invoice_code(p_tenant_id uuid) returns text language plpgsql volatile
security definer set search_path = public as $$
declare
  v_year int := extract(year from current_date);
  v_max int;
begin
  select coalesce(max((regexp_match(invoice_code, '^F-\d{4}-(\d+)$'))[1]::int), 0) + 1
    into v_max
    from public.invoices
   where tenant_id = p_tenant_id and invoice_code like 'F-' || v_year || '-%';
  return 'F-' || v_year || '-' || lpad(v_max::text, 4, '0');
end $$;
create table public.t_asientos (invoice_id uuid not null);
create function public.post_invoice_journal_entry_atomic(p_tenant_id uuid, p_invoice_id uuid) returns jsonb
language plpgsql volatile as $$
begin
  if coalesce(current_setting('test.post', true), '') = 'falla' then
    return jsonb_build_object('version', 1, 'outcome', 'not_posted', 'reason', 'sin_cuentas');
  end if;
  if coalesce(current_setting('test.post', true), '') = 'raro' then
    return jsonb_build_object('version', 1, 'outcome', 'otro');
  end if;
  if coalesce(current_setting('test.post', true), '') = 'ya' then
    return jsonb_build_object('version', 1, 'outcome', 'already_posted', 'reason', 'already_posted');
  end if;
  insert into public.t_asientos (invoice_id) values (p_invoice_id);
  return jsonb_build_object('version', 1, 'outcome', 'posted', 'reason', 'posted');
end $$;
create table public.t_audit (
  tenant_id uuid, entity_type text, entity_id uuid, actor_type text, actor_id uuid, event_type text,
  source text, result text, reason text, after_data jsonb
);
create function public.append_audit_event(
  p_tenant_id uuid, p_entity_type text, p_entity_id uuid, p_actor_type text, p_actor_id uuid,
  p_event_type text, p_source text, p_result text default 'succeeded', p_reason text default null,
  p_before_data jsonb default null, p_after_data jsonb default null, p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null, p_schema_version integer default 1, p_sensitivity text default 'internal'
) returns uuid language plpgsql volatile as $$
begin
  if coalesce(current_setting('test.audit', true), '') = 'falla' then
    raise exception 'audit: falla de prueba';
  end if;
  insert into public.t_audit values (p_tenant_id, p_entity_type, p_entity_id, p_actor_type, p_actor_id,
    p_event_type, p_source, p_result, p_reason, p_after_data);
  return gen_random_uuid();
end $$;
revoke all on function public.next_invoice_code(uuid), public.post_invoice_journal_entry_atomic(uuid, uuid) from public;
revoke all on function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text) from public;
-- Para que la vista security_invoker lea en esta base de prueba (la réplica de invoices no tiene la RLS 0414).
grant select on public.invoices to authenticated;

\ir ../migrations/0564_exc0674_facturar_contenedor.sql
-- 1. Aplicarla otra vez no falla.
\ir ../migrations/0564_exc0674_facturar_contenedor.sql

-- ─── Fixtures ────────────────────────────────────────────────
-- Tenant A (IVA 16 %) y tenant B. Usuarios: a1 operations, a2 commercial, a3 warehouse, a4 support,
-- a5 accounting, a6 admin (de A) y b1 accounting (de B). Solo accounting y admin facturan (Sam,
-- 2026-11-18: «El rol operaciones no factura y tampoco ve los valores.»).
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
  ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-0000000000b0', 'accounting');

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
-- Para la carrera (0564_…_carrera.test.sql): un cliente por escenario, cada uno con un embarque en K64,
-- y uno del tenant B en su contenedor.
insert into public.clients (id, tenant_id, markbox, name)
select md5('0564-c' || n)::uuid, '00000000-0000-4000-8000-0000000000a0', 'DTD-C00' || n, 'Cliente Carrera ' || n
  from generate_series(1, 6) as n;
insert into public.clients (id, tenant_id, markbox, name) values
  ('00000000-0000-4000-8000-0000000c0b01', '00000000-0000-4000-8000-0000000000b0', 'DTD-B001', 'Cliente Tenant B');

-- Contenedores: K64 (en la lista), K65 (fuera de la lista), KDEL (en la lista pero borrado) y KB (tenant B).
insert into public.consolidations values
  ('00000000-0000-4000-8000-00000000c064', '00000000-0000-4000-8000-0000000000a0', 'TEST-CONSOL-64', null),
  ('00000000-0000-4000-8000-00000000c065', '00000000-0000-4000-8000-0000000000a0', 'TEST-CONSOL-65', null),
  ('00000000-0000-4000-8000-00000000c0d1', '00000000-0000-4000-8000-0000000000a0', 'TEST-CONSOL-DEL', now()),
  ('00000000-0000-4000-8000-00000000cb64', '00000000-0000-4000-8000-0000000000b0', 'TEST-CONSOL-B', null);
-- 12. Sin motivo no entra nada a la lista.
do $sin_motivo$
begin
  begin
    insert into public.exc0674_contenedores (tenant_id, consolidation_id)
    values ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064');
    raise exception 'CONTRATO 12: la lista aceptó un alta sin motivo';
  exception when others then
    if sqlerrm <> 'exc0674:lista_sin_motivo' then raise; end if;
  end;
end
$sin_motivo$;
select set_config('dtd.audit_reason', 'Contrato 0564: lista de prueba con OK ficticio', true);
insert into public.exc0674_contenedores (tenant_id, consolidation_id) values
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c0d1'),
  ('00000000-0000-4000-8000-0000000000b0', '00000000-0000-4000-8000-00000000cb64');

select set_config('dtd.audit_reason', '', true);
do $lista$
begin
  if (select count(*) from public.t_audit where event_type = 'exc0674_lista_alta' and entity_type = 'consolidation'
        and reason like 'Contrato 0564%' and actor_type = 'system' and actor_id is null) <> 3 then
    raise exception 'CONTRATO 12: las altas de la lista no quedaron auditadas';
  end if;
  begin
    update public.exc0674_contenedores set nota = 'x';
    raise exception 'CONTRATO 12: la lista se pudo editar';
  exception when others then
    if sqlerrm <> 'exc0674:lista_inmutable' then raise; end if;
  end;
  begin
    delete from public.exc0674_contenedores where consolidation_id = '00000000-0000-4000-8000-00000000c0d1';
    raise exception 'CONTRATO 12: la lista aceptó una baja sin motivo';
  exception when others then
    if sqlerrm <> 'exc0674:lista_sin_motivo' then raise; end if;
  end;
  delete from public.t_audit;
end
$lista$;

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
insert into public.shipments (id, tenant_id, code, client_markbox, volume_m3)
select md5('0564-e' || n)::uuid, '00000000-0000-4000-8000-0000000000a0', 'DTD-C00' || n || '-01', 'DTD-C00' || n, 1
  from generate_series(1, 6) as n;
insert into public.consolidation_items (tenant_id, consolidation_id, shipment_id, created_at)
select '00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064', md5('0564-e' || n)::uuid,
       now() - interval '2 days'
  from generate_series(1, 6) as n;
insert into public.shipments (id, tenant_id, code, client_markbox, volume_m3) values
  ('00000000-0000-4000-8000-0000000e0b01', '00000000-0000-4000-8000-0000000000b0', 'DTD-B001-01', 'DTD-B001', 1);
insert into public.consolidation_items (tenant_id, consolidation_id, shipment_id, created_at) values
  ('00000000-0000-4000-8000-0000000000b0', '00000000-0000-4000-8000-00000000cb64', '00000000-0000-4000-8000-0000000e0b01', now() - interval '2 days');

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

-- ── Aserciones (aquí termina el fixture que reusa la carrera) ──

-- ─── 4 y 6. Rechazos antes de facturar nada ──────────────────
do $rechazos$
declare
  k64 constant uuid := '00000000-0000-4000-8000-00000000c064';
  uno constant jsonb := '[{"client_markbox":"DTD-T001","total_usd":116}]';
  v text;
begin
  v := public.t_intento('00000000-0000-4000-8000-00000000a001', k64, uno);
  if v is distinct from 'exc0674:rol' then raise exception 'CONTRATO 4: operations facturó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a002', k64, uno);
  if v is distinct from 'exc0674:rol' then raise exception 'CONTRATO 4: commercial facturó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a003', k64, uno);
  if v is distinct from 'exc0674:rol' then raise exception 'CONTRATO 4: warehouse facturó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a004', k64, uno);
  if v is distinct from 'exc0674:rol' then raise exception 'CONTRATO 4: support facturó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a005', k64, uno, 'confirmado');
  if v is distinct from 'exc0674:sin_confirmacion' then raise exception 'CONTRATO 6: confirmación inexacta pasó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a005', k64, uno, null);
  if v is distinct from 'exc0674:sin_confirmacion' then raise exception 'CONTRATO 6: sin confirmación pasó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a005', '00000000-0000-4000-8000-00000000c065',
                        '[{"client_markbox":"DTD-T002","total_usd":10}]');
  if v is distinct from 'exc0674:contenedor_fuera_de_lista' then raise exception 'CONTRATO 5: K65 fuera de la lista se facturó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a005', '00000000-0000-4000-8000-00000000c0d1', uno);
  if v is distinct from 'exc0674:contenedor_fuera_de_lista' then raise exception 'CONTRATO 5: contenedor borrado se facturó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000b001', k64, uno);
  if v is distinct from 'exc0674:contenedor_fuera_de_lista' then raise exception 'CONTRATO 5: el tenant B facturó el K64 de A (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a005', k64, '[{"client_markbox":"DTD-T001","total_usd":0}]');
  if v is distinct from 'exc0674:monto:DTD-T001' then raise exception 'CONTRATO 6: monto 0 pasó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a005', k64, '[{"client_markbox":"DTD-T001","total_usd":-5}]');
  if v is distinct from 'exc0674:monto:DTD-T001' then raise exception 'CONTRATO 6: monto negativo pasó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a005', k64, '[{"client_markbox":"DTD-T001","total_usd":10.005}]');
  if v is distinct from 'exc0674:monto:DTD-T001' then raise exception 'CONTRATO 6: tres decimales pasó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a005', k64, '[{"client_markbox":"DTD-T001","total_usd":"10"}]');
  if v is distinct from 'exc0674:datos' then raise exception 'CONTRATO 6: monto como texto pasó (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a005', k64, '[{"client_markbox":"DTD-T002","total_usd":10}]');
  if v is distinct from 'exc0674:cliente_sin_embarques:DTD-T002' then raise exception 'CONTRATO 5: cliente sin embarques en K64 pasó (%)', v; end if;
  -- 16. Dos fichas vivas con el mismo Shipping Mark normalizado: error explícito, no la primera que salga.
  begin
    insert into public.clients (id, tenant_id, markbox, name) values
      ('00000000-0000-4000-8000-0000000c0a99', '00000000-0000-4000-8000-0000000000a0', ' dtd-t001', 'Ficha Duplicada');
    v := public.t_intento('00000000-0000-4000-8000-00000000a005', k64, uno);
    raise exception 'deshacer:%', coalesce(v, 'facturó');
  exception when others then
    if sqlerrm is distinct from 'deshacer:exc0674:cliente_ambiguo:DTD-T001' then
      raise exception 'CONTRATO 16: Shipping Mark ambiguo (%)', sqlerrm;
    end if;
  end;
  -- 17. Un ciclo en la cadena de aliados aborta, no cuelga.
  begin
    insert into public.aliados values
      ('00000000-0000-4000-8000-0000000a1003', '00000000-0000-4000-8000-0000000000a0', null, '00000000-0000-4000-8000-0000000a1004'),
      ('00000000-0000-4000-8000-0000000a1004', '00000000-0000-4000-8000-0000000000a0', null, '00000000-0000-4000-8000-0000000a1003');
    update public.clients set aliado_id = '00000000-0000-4000-8000-0000000a1003'
     where id = '00000000-0000-4000-8000-0000000c0a03';
    v := public.t_intento('00000000-0000-4000-8000-00000000a005', k64, uno);
    raise exception 'deshacer:%', coalesce(v, 'facturó');
  exception when others then
    if sqlerrm is distinct from 'deshacer:exc0674:aliado_ciclo:DTD-T001' then
      raise exception 'CONTRATO 17: ciclo de aliados (%)', sqlerrm;
    end if;
  end;
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
  v := public.t_intento('00000000-0000-4000-8000-00000000a005', k64,
    '[{"client_markbox":"DTD-T001","total_usd":116},{"client_markbox":"DTD-T002","total_usd":10}]');
  if v is distinct from 'exc0674:cliente_sin_embarques:DTD-T002' then raise exception 'CONTRATO 7: (%)', v; end if;
  -- El mismo cliente dos veces en una llamada.
  v := public.t_intento('00000000-0000-4000-8000-00000000a005', k64,
    '[{"client_markbox":"DTD-T001","total_usd":116},{"client_markbox":"dtd-t001","total_usd":116}]');
  if v is distinct from 'exc0674:datos' then raise exception 'CONTRATO 7: cliente repetido pasó (%)', v; end if;
  -- El asiento no sale.
  perform set_config('test.post', 'falla', true);
  v := public.t_intento('00000000-0000-4000-8000-00000000a005', k64, '[{"client_markbox":"DTD-T001","total_usd":116}]');
  perform set_config('test.post', '', true);
  if v is distinct from 'exc0674:asiento:sin_cuentas' then raise exception 'CONTRATO 7: asiento fallido (%)', v; end if;
  -- 10. Un outcome desconocido también deshace todo.
  perform set_config('test.post', 'raro', true);
  v := public.t_intento('00000000-0000-4000-8000-00000000a005', k64, '[{"client_markbox":"DTD-T001","total_usd":116}]');
  perform set_config('test.post', '', true);
  if v is distinct from 'exc0674:asiento:desconocido' then raise exception 'CONTRATO 10: outcome raro (%)', v; end if;
  -- 11. Si el evento de auditoría no se puede escribir, no se factura.
  perform set_config('test.audit', 'falla', true);
  v := public.t_intento('00000000-0000-4000-8000-00000000a005', k64, '[{"client_markbox":"DTD-T001","total_usd":116}]');
  perform set_config('test.audit', '', true);
  if v is distinct from 'audit: falla de prueba' then raise exception 'CONTRATO 11: auditoría fallida (%)', v; end if;
  if exists (select 1 from public.invoices) or exists (select 1 from public.exc0674_facturas)
     or exists (select 1 from public.t_asientos) or exists (select 1 from public.exc0674_factura_envios)
     or exists (select 1 from public.t_audit) then
    raise exception 'CONTRATO 7: quedó una factura, un rastro, un vínculo, un evento o un asiento a medias';
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
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000a005', true);
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
     or f.legal_ack <> 'exc_0674' or f.tecleado_por <> '00000000-0000-4000-8000-00000000a005' then
    raise exception 'CONTRATO 2: rastro incompleto';
  end if;

  -- 13. El vínculo cubre los 3 embarques vigentes con el Shipping Mark del cliente real, no el del aliado.
  if (select count(*) from public.exc0674_factura_envios
       where invoice_id = i.id and client_markbox = 'AR-S-0001'
         and consolidation_id = k64) <> 3
     or exists (select 1 from public.exc0674_factura_envios where shipment_id = '00000000-0000-4000-8000-0000000e0004') then
    raise exception 'CONTRATO 13: el vínculo factura ↔ envío no es el esperado';
  end if;
  if (select count(*) from public.exc0674_envios_cubiertos where client_markbox = 'AR-S-0001' and status = 'emitida') <> 3 then
    raise exception 'CONTRATO 13: la vista no muestra los envíos cubiertos';
  end if;
  -- 11. Evento de auditoría con legal_ack y actor real.
  if (select count(*) from public.t_audit
       where entity_type = 'invoice' and entity_id = i.id and event_type = 'invoice_emitted_exc0674'
         and actor_type = 'user' and actor_id = '00000000-0000-4000-8000-00000000a005' and source = 'rpc'
         and after_data ->> 'legal_ack' = 'exc_0674' and reason like 'EXC-0674%') <> 1 then
    raise exception 'CONTRATO 11: falta el evento de auditoría con legal_ack';
  end if;

  -- 3. Otra vez el mismo cliente, ahora con accounting: no se factura dos veces.
  v := public.t_intento('00000000-0000-4000-8000-00000000a005', k64, '[{"client_markbox":"AR-S-0001","total_usd":406}]');
  if v is distinct from 'exc0674:ya_facturado:AR-S-0001' then raise exception 'CONTRATO 3: (%)', v; end if;
  if (select pg_catalog.count(*) from public.invoices) <> 1 then raise exception 'CONTRATO 3: segunda factura'; end if;

  -- 4. admin sí factura (cliente directo, se le factura a él mismo). 10: con asiento 'already_posted'.
  perform set_config('test.post', 'ya', true);
  v := public.t_intento('00000000-0000-4000-8000-00000000a006', k64, '[{"client_markbox":"DTD-T001","total_usd":0.01}]');
  perform set_config('test.post', '', true);
  if v is not null then raise exception 'CONTRATO 4: admin no pudo facturar (%)', v; end if;
  select * into i from public.invoices where client_markbox = 'DTD-T001';
  if i.total_amount <> 0.01 or i.base_amount + i.iva_amount <> 0.01 then
    raise exception 'CONTRATO 2: el total mínimo no cuadra (% + %)', i.base_amount, i.iva_amount;
  end if;

  -- 13. Una factura borrada sale de la vista (sus envíos vuelven a «sin facturar»).
  update public.invoices set deleted_at = now() where id = i.id;
  if exists (select 1 from public.exc0674_envios_cubiertos where invoice_id = i.id) then
    raise exception 'CONTRATO 13: la vista cuenta una factura borrada';
  end if;
  update public.invoices set deleted_at = null where id = i.id;
end
$por_cliente$;

-- ─── 14. Anular y volver a facturar ──────────────────────────
do $refacturar$
declare
  k64 constant uuid := '00000000-0000-4000-8000-00000000c064';
  v text;
  v_vieja uuid;
begin
  select invoice_id into v_vieja from public.exc0674_facturas where client_markbox = 'DTD-T001';
  -- Mientras está viva, no se refactura.
  v := public.t_intento('00000000-0000-4000-8000-00000000a005', k64, '[{"client_markbox":"DTD-T001","total_usd":5}]');
  if v is distinct from 'exc0674:ya_facturado:DTD-T001' then raise exception 'CONTRATO 14: refacturó una viva (%)', v; end if;
  -- Facturación la anula (como voidInvoice): el trigger marca la fila.
  update public.invoices set status = 'anulada' where id = v_vieja;
  if (select anulada_at from public.exc0674_facturas where invoice_id = v_vieja) is null then
    raise exception 'CONTRATO 14: anular no marcó el rastro';
  end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a005', k64, '[{"client_markbox":"DTD-T001","total_usd":5}]');
  if v is not null then raise exception 'CONTRATO 14: no se pudo volver a facturar después de anular (%)', v; end if;
  if (select count(*) from public.exc0674_facturas where client_markbox = 'DTD-T001') <> 2
     or (select count(*) from public.exc0674_facturas where client_markbox = 'DTD-T001' and anulada_at is null) <> 1 then
    raise exception 'CONTRATO 14: el rastro no quedó con una anulada y una viva';
  end if;
  -- La vista sigue mostrando la anulada con su estado (la 0574 no la cuenta como facturada).
  if not exists (select 1 from public.exc0674_envios_cubiertos where invoice_id = v_vieja and status = 'anulada') then
    raise exception 'CONTRATO 14: la vista no trae el estado anulada';
  end if;
end
$refacturar$;

-- ─── 9. Privilegios y RLS ────────────────────────────────────
do $privilegios$
declare
  n integer;
begin
  if not exists (select 1 from pg_catalog.pg_class c where c.oid = 'public.exc0674_envios_cubiertos'::regclass
                   and c.reloptions @> array['security_invoker=true']) then
    raise exception 'CONTRATO 13: la vista no es security_invoker';
  end if;
  if pg_catalog.has_function_privilege('anon', 'public.exc0674_facturar(uuid,jsonb,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.exc0674_facturar(uuid,jsonb,text)', 'EXECUTE') then
    raise exception 'CONTRATO 9: anon o service_role ejecutan la RPC';
  end if;
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000a005', true);
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
  begin
    insert into public.exc0674_factura_envios (tenant_id, invoice_id, shipment_id, consolidation_id, client_markbox)
    select tenant_id, invoice_id, shipment_id, consolidation_id, 'DTD-T009' from public.exc0674_factura_envios limit 1;
    raise exception 'CONTRATO 9: authenticated escribió el vínculo';
  exception when insufficient_privilege then null;
  end;
  select pg_catalog.count(*) into n from public.exc0674_facturas;
  if n <> 3 then raise exception 'CONTRATO 9: accounting de A ve % filas del rastro (esperaba 3)', n; end if;
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

  -- 15. operations no ve el rastro, el vínculo ni la lista (Sam: operaciones no ve los valores).
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000a001', true);
  set local role authenticated;
  if (select pg_catalog.count(*) from public.exc0674_facturas) <> 0
     or (select pg_catalog.count(*) from public.exc0674_factura_envios) <> 0
     or (select pg_catalog.count(*) from public.exc0674_contenedores) <> 0 then
    raise exception 'CONTRATO 15: operations ve filas de la regla';
  end if;
  reset role;

  -- 12. La baja de la lista (con motivo, por service_role o una migración) queda auditada como 'system'.
  perform set_config('dtd.audit_reason', 'Contrato 0564: baja de prueba con OK ficticio', true);
  perform set_config('test.uid', '', true);
  delete from public.exc0674_contenedores where consolidation_id = '00000000-0000-4000-8000-00000000c064';
  perform set_config('dtd.audit_reason', '', true);
  if not exists (select 1 from public.t_audit where event_type = 'exc0674_lista_baja'
                  and actor_type = 'system' and actor_id is null and reason like 'Contrato 0564%') then
    raise exception 'CONTRATO 12: la baja de la lista no quedó auditada como system con su motivo';
  end if;
  -- accounting sigue viendo lo facturado aunque el contenedor salga de la lista.
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000a005', true);
  set local role authenticated;
  select pg_catalog.count(*) into n from public.exc0674_facturas;
  if n <> 3 then raise exception 'CONTRATO 15: accounting dejó de ver el rastro (% filas)', n; end if;
  reset role;
end
$privilegios$;

-- ─── 18. Ensayo del desarme (supabase/desarmes/0564_desarme.sql) ─────────
do $desarme$
declare
  v_sql text := pg_catalog.pg_read_file('/sb/desarmes/0564_desarme.sql');
begin
  -- Con facturas de la regla, se niega y no quita nada.
  begin
    execute v_sql;
    raise exception 'CONTRATO 18: el desarme corrió con facturas de la regla';
  exception when others then
    if sqlerrm not like '0564 desarme: hay facturas%' then raise; end if;
  end;
  if pg_catalog.to_regprocedure('public.exc0674_facturar(uuid,jsonb,text)') is null
     or pg_catalog.to_regclass('public.exc0674_facturas') is null then
    raise exception 'CONTRATO 18: el desarme que se negó quitó algo';
  end if;
  -- Sin facturas de la regla, quita todo: RPC, trigger, vista, tablas y la función del trigger de la lista.
  delete from public.exc0674_factura_envios;
  delete from public.exc0674_facturas;
  execute v_sql;
  if pg_catalog.to_regprocedure('public.exc0674_facturar(uuid,jsonb,text)') is not null
     or pg_catalog.to_regclass('public.exc0674_envios_cubiertos') is not null
     or pg_catalog.to_regclass('public.exc0674_factura_envios') is not null
     or pg_catalog.to_regclass('public.exc0674_facturas') is not null
     or pg_catalog.to_regclass('public.exc0674_contenedores') is not null
     or pg_catalog.to_regprocedure('public.exc0674_contenedores_auditar()') is not null
     or pg_catalog.to_regprocedure('public.exc0674_marcar_anulada()') is not null
     or exists (select 1 from pg_catalog.pg_trigger where tgname = 'exc0674_marcar_anulada') then
    raise exception 'CONTRATO 18: el desarme dejó objetos de la 0564';
  end if;
end
$desarme$;

rollback;
