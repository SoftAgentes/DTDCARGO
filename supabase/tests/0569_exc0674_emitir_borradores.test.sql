\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0569 (SDD-0690, EXC-0674 ampliada a pre-orden): «Facturar» en
-- Embarques emite la pre-orden (borrador) del cliente. Usa fixtures ficticios y hace rollback al final:
-- no toca prod.
--
-- Las tablas y funciones de las que dependen la 0564 y la 0569 son réplicas mínimas, con solo las
-- columnas que usan. El asiento (post_invoice_journal_entry_atomic) es un doble: responde 'posted' o
-- falla según test.post, y anota cada llamada.
--
-- Los triggers de invoices que actúan en el UPDATE borrador → emitida van COPIADOS de su migración
-- (spec 0690 §3.3: hay que probar que lo aceptan):
--   · invoices_seal_billing_titular (0466:249-349), copia íntegra;
--   · i3_invoice_guard (0497:536-575), copia íntegra, con una réplica mínima de journal_entries;
--   · increment_invoice_write_version (0495:376-386), copia íntegra;
--   · audit_d2_invoices (0290): réplica REDUCIDA al ramal de invoices que anota invoice_emitted.
--
-- Lo que se protege:
--   1. Aplicar la 0569 otra vez no falla, y las filas de la 0564 quedan con origen_monto 'tecleado'.
--   2. Por cliente: accounting emite la pre-orden sin cambiar su código, sus líneas ni sus montos;
--      issued_at de hoy (Caracas), due_date a +30, write_version + 1 exacto; el titular lo sella el
--      trigger 0466 y la salida tiene la forma de la 0564.
--   3. Se hace el asiento; el rastro lleva origen_monto 'borrador', legal_ack 'exc_0674' y quién emitió; el
--      vínculo cubre todos los embarques vigentes del cliente en el contenedor.
--   4. Auditoría: invoice_emitted_exc0674_borrador con origen_monto y legal_ack, y el invoice_emitted del d2.
--   5. Roles: operations, commercial, warehouse y support no emiten. accounting y admin sí.
--   6. Confirmación inexacta, contenedor fuera de la lista, borrado o de otro tenant: rechazo.
--   7. Datos: nulo, vacío, repetidos, con nulos, más de 500 o de dos dimensiones: rechazo.
--   8. Por factura: inexistente, de otro tenant, borrada, no borrador, en otra moneda, en 0, con un
--      embarque de otro contenedor o reasignado: rechazo.
--   9. Todo o nada: si una falla (aunque otra ya se haya emitido en la misma llamada), no queda nada.
--      Tampoco si el asiento no sale o si el evento de auditoría no se puede escribir.
--  10. «Facturar todo»: varias pre-órdenes en una llamada, en orden de Shipping Mark.
--  11. Un cliente ya facturado (por pre-orden o por monto tecleado de la 0564) no se emite otra vez;
--      después de anular su factura en Facturación, sí.
--  12. El desarme se ensaya: se niega con facturas de origen_monto borrador y, sin ellas, quita la RPC y la
--      columna sin tocar la 0564; repetirlo no falla.
--  13. Privilegios: anon y service_role no ejecutan la RPC; authenticated sí y no escribe el rastro. El
--      check de origen_monto rechaza otro valor.
--  14. La 0569 redefine exc0674_facturar (0564) con la guarda exc0674:tiene_preorden, sin cambiar su firma,
--      SECURITY DEFINER, search_path ni grants: (a) un cliente con pre-orden viva en el contenedor no se
--      factura con monto tecleado, todo o nada, sin crear factura; (b) después de emitir su pre-orden el
--      tecleado sale ya_facturado; (c) un cliente sin pre-orden viva en el contenedor (las borradas y las de
--      un embarque de otro contenedor no cuentan) sí se factura con monto tecleado. El desarme (12) repone
--      la definición de la 0564, sin la guarda.

begin;

do $roles$
begin
  if pg_catalog.to_regclass('public.invoices') is not null or pg_catalog.to_regclass('public.tenants') is not null then
    raise exception 'TEST 0569 requiere una base PostgreSQL desechable vacía';
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
create table public.client_billing_identities (
  id uuid primary key default gen_random_uuid(), client_id uuid not null unique, kind text not null,
  legal_name text not null, doc text not null, fiscal_address text, is_billing_default boolean not null default false
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
  client_fiscal_address text, bill_to_kind text,
  shipment_id uuid, shipment_code text, currency text not null, iva_rate numeric(5,2) not null,
  base_amount numeric(14,2) not null, iva_amount numeric(14,2) not null, total_amount numeric(14,2) not null,
  status text not null, issued_at date, due_date date, lines jsonb not null, notes text,
  fund_class text not null, deleted_at timestamptz, write_version bigint not null default 0,
  unique (tenant_id, invoice_code)
);
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(), invoice_id uuid, source text, reverses_entry_id uuid
);
-- Copia del cuerpo de la 0077 (63-83): max+1 sin lock. La carrera la necesita así.
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
  -- Como la real (0497), el asiento solo sale de una factura emitida.
  if (select status from public.invoices where id = p_invoice_id) <> 'emitida' then
    return jsonb_build_object('version', 1, 'outcome', 'not_posted', 'reason', 'invoice_not_postable');
  end if;
  insert into public.t_asientos (invoice_id) values (p_invoice_id);
  return jsonb_build_object('version', 1, 'outcome', 'posted', 'reason', 'posted');
end $$;
create table public.t_audit (
  tenant_id uuid, entity_type text, entity_id uuid, actor_type text, actor_id uuid, event_type text,
  source text, result text, reason text, before_data jsonb, after_data jsonb, payload jsonb
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
    p_event_type, p_source, p_result, p_reason, p_before_data, p_after_data, p_payload);
  return gen_random_uuid();
end $$;
revoke all on function public.next_invoice_code(uuid), public.post_invoice_journal_entry_atomic(uuid, uuid) from public;
revoke all on function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text) from public;
grant select on public.invoices to authenticated;

-- ─── Triggers de invoices, copiados de su migración ──────────
-- 0466:249-349 (titular), copia íntegra.
create function public.invoices_seal_billing_titular()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_client record;
  v_identity record;
  v_principal_kind text;
  v_preferred_kind text;
  v_kind text;
  v_actor uuid := auth.uid();
begin
  -- Después de emitir, el titular no cambia. Nada más queda congelado.
  if tg_op = 'UPDATE' and old.status <> 'borrador' then
    if new.client_name is distinct from old.client_name
       or new.client_rif is distinct from old.client_rif
       or new.client_doc_kind is distinct from old.client_doc_kind
       or new.client_fiscal_address is distinct from old.client_fiscal_address
       or new.bill_to_kind is distinct from old.bill_to_kind then
      raise exception 'invoice_titular_frozen' using errcode = '55000';
    end if;
    return new;
  end if;

  if not (
    (tg_op = 'INSERT' and new.status = 'emitida')
    or (tg_op = 'UPDATE' and old.status = 'borrador' and new.status = 'emitida')
  ) then
    return new;
  end if;

  select client.id, client.name, client.rif, client.doc_kind
    into v_client
  from public.clients as client
  where client.tenant_id = new.tenant_id
    and client.markbox = new.client_markbox
    and client.deleted_at is null
  limit 1;

  if not found then
    -- Sin cliente vivo: la factura se emite como viene (SDD-0298).
    return new;
  end if;

  select identity.kind, identity.legal_name, identity.doc,
         identity.fiscal_address, identity.is_billing_default
    into v_identity
  from public.client_billing_identities as identity
  where identity.client_id = v_client.id;

  v_principal_kind := coalesce(v_client.doc_kind, 'persona');
  v_preferred_kind := case
    when v_identity.kind is not null and v_identity.is_billing_default
      then v_identity.kind
    else v_principal_kind
  end;
  v_kind := coalesce(new.bill_to_kind, v_preferred_kind);

  if v_identity.kind is not null
     and v_kind = v_identity.kind
     and v_identity.kind <> v_principal_kind then
    new.client_name := v_identity.legal_name;
    new.client_rif := v_identity.doc;
    new.client_doc_kind := v_identity.kind;
    new.client_fiscal_address := v_identity.fiscal_address;
  else
    new.client_name := coalesce(nullif(pg_catalog.btrim(v_client.name), ''), new.client_name);
    new.client_rif := nullif(pg_catalog.btrim(coalesce(v_client.rif, '')), '');
    new.client_doc_kind := case when new.client_rif is null then null else v_client.doc_kind end;
    new.client_fiscal_address := null;
  end if;

  if new.bill_to_kind is not null and new.bill_to_kind <> v_preferred_kind then
    perform public.append_audit_event(
      new.tenant_id,
      'invoice',
      new.id,
      case when v_actor is null then 'system' else 'user' end,
      v_actor,
      'invoice_bill_to_overridden',
      'studio',
      'succeeded',
      'El operador eligió un titular distinto de la preferencia del cliente.',
      null,
      null,
      pg_catalog.jsonb_build_object(
        'bill_to_kind', new.bill_to_kind,
        'preferred_kind', v_preferred_kind,
        'applied_kind', coalesce(new.client_doc_kind, v_principal_kind)
      ),
      'invoice-bill-to:' || new.id::text,
      1,
      'internal'
    );
  end if;

  return new;
end;
$function$;
create trigger invoices_seal_billing_titular
  before insert or update on public.invoices
  for each row execute function public.invoices_seal_billing_titular();

-- 0497:536-575 (guarda i3), copia íntegra.
create function public.i3_invoice_guard()
returns trigger language plpgsql volatile security definer set search_path = ''
as $function$
declare v_has boolean;
begin
  if tg_op = 'INSERT' then return new; end if;
  -- La transición a anulada debe poder acreditar ausencia tras el lock aun si
  -- el posting concurrente no actualizó la fila de invoices.
  if (tg_op = 'DELETE' or (tg_op = 'UPDATE' and
      ((new.status = 'anulada' and old.status is distinct from new.status)
       or new.id is distinct from old.id or new.tenant_id is distinct from old.tenant_id
       or new.deleted_at is distinct from old.deleted_at)))
     and pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'La operación contable requiere una transacción READ COMMITTED.' using errcode = '25000';
  end if;
  select exists (select 1 from public.journal_entries e
    where e.invoice_id in (old.id, case when tg_op = 'UPDATE' then new.id else old.id end)
      and (e.source in ('invoice','invoice_reversal') or e.reverses_entry_id is not null))
    into v_has;
  if v_has and (tg_op = 'DELETE' or
       (tg_op = 'UPDATE' and
        (new.id is distinct from old.id or new.tenant_id is distinct from old.tenant_id
         or new.deleted_at is distinct from old.deleted_at
         or (old.status = 'anulada' and new.status is distinct from old.status)))) then
    raise exception 'No se desvincula ni reabre una factura con asiento automático.' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
create trigger i3_invoice_guard
before insert or update or delete on public.invoices
for each row execute function public.i3_invoice_guard();

-- 0495:376-386 (write_version), copia íntegra.
create function public.increment_invoice_write_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $version$
begin
  -- OLD es la fuente: un cliente no puede conservar ni adelantar la versión.
  new.write_version := old.write_version + 1;
  return new;
end;
$version$;
create trigger invoices_write_version
  before update on public.invoices
  for each row execute function public.increment_invoice_write_version();

-- 0290 (audit_d2_invoices): réplica REDUCIDA al ramal de invoices. Anota directo en t_audit para que
-- test.audit = 'falla' pruebe solo el evento propio de la RPC.
create function public.t_audit_d2_invoices() returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.status = 'emitida')
     or (tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'emitida') then
    insert into public.t_audit (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, source,
                                result, before_data, after_data)
    values (new.tenant_id, 'invoice', new.id, case when auth.uid() is null then 'system' else 'user' end,
            auth.uid(), 'invoice_emitted', 'rpc', 'succeeded',
            case when tg_op = 'UPDATE' then pg_catalog.jsonb_build_object('status', old.status) end,
            pg_catalog.jsonb_build_object('invoice_code', new.invoice_code, 'status', new.status));
  end if;
  return null;
end $$;
create trigger audit_d2_invoices
after insert or update or delete on public.invoices
for each row execute function public.t_audit_d2_invoices();

\ir ../migrations/0564_exc0674_facturar_contenedor.sql
\ir ../migrations/0569_exc0674_emitir_borradores.sql
-- 1. Aplicarla otra vez no falla.
\ir ../migrations/0569_exc0674_emitir_borradores.sql

-- ─── Fixtures ────────────────────────────────────────────────
-- Tenant A (IVA 16 %) y tenant B. Usuarios: a1 operations, a2 commercial, a3 warehouse, a4 support,
-- a5 accounting, a6 admin (de A) y b1 accounting (de B).
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

-- Aliado raíz «AR» con un subaliado; el cliente AR-S-0001 es del subaliado, así que su pre-orden va a
-- nombre de AR (como la deja el cargador, SDD-0543).
insert into public.clients (id, tenant_id, markbox, name, rif, doc_kind) values
  ('00000000-0000-4000-8000-0000000c0a01', '00000000-0000-4000-8000-0000000000a0', 'AR', 'Aliado Raíz Ficticio', 'J-000000001', 'empresa');
insert into public.aliados values
  ('00000000-0000-4000-8000-0000000a1001', '00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-0000000c0a01', null),
  ('00000000-0000-4000-8000-0000000a1002', '00000000-0000-4000-8000-0000000000a0', null, '00000000-0000-4000-8000-0000000a1001');
insert into public.clients (id, tenant_id, markbox, name, aliado_id) values
  ('00000000-0000-4000-8000-0000000c0a02', '00000000-0000-4000-8000-0000000000a0', 'AR-S-0001', 'Cliente de Subaliado', '00000000-0000-4000-8000-0000000a1002'),
  ('00000000-0000-4000-8000-0000000c0a03', '00000000-0000-4000-8000-0000000000a0', 'DTD-T001', 'Cliente Directo Uno', null),
  ('00000000-0000-4000-8000-0000000c0a04', '00000000-0000-4000-8000-0000000000a0', 'DTD-T002', 'Cliente Directo Dos', null),
  ('00000000-0000-4000-8000-0000000c0a05', '00000000-0000-4000-8000-0000000000a0', 'DTD-T003', 'Cliente Directo Tres', null),
  ('00000000-0000-4000-8000-0000000c0a06', '00000000-0000-4000-8000-0000000000a0', 'DTD-T004', 'Cliente Directo Cuatro', null);
-- Para la carrera (0569_…_carrera.test.sql): DTD-C001 a DTD-C008 (tenant A) y DTD-B001 (tenant B).
insert into public.clients (id, tenant_id, markbox, name)
select md5('0569-c' || n)::uuid, '00000000-0000-4000-8000-0000000000a0', 'DTD-C00' || n, 'Cliente Carrera ' || n
  from generate_series(1, 8) as n;
insert into public.clients (id, tenant_id, markbox, name) values
  ('00000000-0000-4000-8000-0000000c0b01', '00000000-0000-4000-8000-0000000000b0', 'DTD-B001', 'Cliente Tenant B');

-- Contenedores: K64 (en la lista), K65 (fuera de la lista), KDEL (en la lista pero borrado) y KB (tenant B).
insert into public.consolidations values
  ('00000000-0000-4000-8000-00000000c064', '00000000-0000-4000-8000-0000000000a0', 'TEST-CONSOL-64', null),
  ('00000000-0000-4000-8000-00000000c065', '00000000-0000-4000-8000-0000000000a0', 'TEST-CONSOL-65', null),
  ('00000000-0000-4000-8000-00000000c0d1', '00000000-0000-4000-8000-0000000000a0', 'TEST-CONSOL-DEL', now()),
  ('00000000-0000-4000-8000-00000000cb64', '00000000-0000-4000-8000-0000000000b0', 'TEST-CONSOL-B', null);
select set_config('dtd.audit_reason', 'Contrato 0569: lista de prueba con OK ficticio', true);
insert into public.exc0674_contenedores (tenant_id, consolidation_id) values
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c0d1'),
  ('00000000-0000-4000-8000-0000000000b0', '00000000-0000-4000-8000-00000000cb64');
select set_config('dtd.audit_reason', '', true);

-- Embarques: AR-S-0001 tiene 3 en K64; su -04 se reasignó después al K65. DTD-T001, DTD-T003 y DTD-T004
-- tienen 1 en K64; DTD-T002 tiene 1 en K65.
insert into public.shipments values
  ('00000000-0000-4000-8000-0000000e0001', '00000000-0000-4000-8000-0000000000a0', 'AR-S-0001-01', 'AR-S-0001', 1, null),
  ('00000000-0000-4000-8000-0000000e0002', '00000000-0000-4000-8000-0000000000a0', 'AR-S-0001-02', 'AR-S-0001', 2, null),
  ('00000000-0000-4000-8000-0000000e0003', '00000000-0000-4000-8000-0000000000a0', 'AR-S-0001-03', 'ar-s-0001 ', 0.5, null),
  ('00000000-0000-4000-8000-0000000e0004', '00000000-0000-4000-8000-0000000000a0', 'AR-S-0001-04', 'AR-S-0001', 9, null),
  ('00000000-0000-4000-8000-0000000e0005', '00000000-0000-4000-8000-0000000000a0', 'DTD-T001-01', 'DTD-T001', 3, null),
  ('00000000-0000-4000-8000-0000000e0006', '00000000-0000-4000-8000-0000000000a0', 'DTD-T002-01', 'DTD-T002', 1, null),
  ('00000000-0000-4000-8000-0000000e0007', '00000000-0000-4000-8000-0000000000a0', 'DTD-T003-01', 'DTD-T003', 1, null),
  ('00000000-0000-4000-8000-0000000e0008', '00000000-0000-4000-8000-0000000000a0', 'DTD-T004-01', 'DTD-T004', 1, null);
insert into public.consolidation_items (tenant_id, consolidation_id, shipment_id, created_at) values
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064', '00000000-0000-4000-8000-0000000e0001', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064', '00000000-0000-4000-8000-0000000e0002', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064', '00000000-0000-4000-8000-0000000e0003', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064', '00000000-0000-4000-8000-0000000e0004', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c065', '00000000-0000-4000-8000-0000000e0004', now() - interval '1 day'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064', '00000000-0000-4000-8000-0000000e0005', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c065', '00000000-0000-4000-8000-0000000e0006', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064', '00000000-0000-4000-8000-0000000e0007', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064', '00000000-0000-4000-8000-0000000e0008', now() - interval '2 days');
insert into public.shipments (id, tenant_id, code, client_markbox, volume_m3)
select md5('0569-e' || n)::uuid, '00000000-0000-4000-8000-0000000000a0', 'DTD-C00' || n || '-01', 'DTD-C00' || n, 1
  from generate_series(1, 8) as n;
insert into public.consolidation_items (tenant_id, consolidation_id, shipment_id, created_at)
select '00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064', md5('0569-e' || n)::uuid,
       now() - interval '2 days'
  from generate_series(1, 8) as n;
insert into public.shipments (id, tenant_id, code, client_markbox, volume_m3) values
  ('00000000-0000-4000-8000-0000000e0b01', '00000000-0000-4000-8000-0000000000b0', 'DTD-B001-01', 'DTD-B001', 1);
insert into public.consolidation_items (tenant_id, consolidation_id, shipment_id, created_at) values
  ('00000000-0000-4000-8000-0000000000b0', '00000000-0000-4000-8000-00000000cb64', '00000000-0000-4000-8000-0000000e0b01', now() - interval '2 days');

-- Pre-órdenes (borradores) como las deja el cargador: código ya asignado, líneas de la pre-orden y
-- shipment_id = el primer embarque del cliente. Montos inventados.
--   f0101 AR-S-0001 (a nombre de AR, con un titular viejo que el trigger 0466 sella al emitir)
--   f0102 DTD-T001 · f0103 DTD-T003 · f0112 DTD-T004 · f0111 otra de DTD-T001
--   f0104 DTD-T003 ya emitida · f0105 borrada · f0106 en VES · f0107 en 0
--   f0108 DTD-T002 (su embarque está en K65) · f0109 AR (embarque reasignado al K65)
--   f0110 tenant B · carrera: md5('0569-f' || n), DTD-C00n
insert into public.invoices
  (id, tenant_id, invoice_code, client_markbox, client_name, shipment_id, shipment_code, currency,
   iva_rate, base_amount, iva_amount, total_amount, status, lines, notes, fund_class, deleted_at)
values
  ('00000000-0000-4000-8000-0000000f0101', '00000000-0000-4000-8000-0000000000a0', 'F-1999-0101', 'AR', 'Titular Viejo Ficticio',
   '00000000-0000-4000-8000-0000000e0001', 'AR-S-0001-01', 'USD', 16, 350, 56, 406, 'borrador',
   '[{"desc":"Línea de prueba A","qty":2,"unitPrice":100,"shipmentCode":"AR-S-0001-01"},{"desc":"Línea de prueba B","qty":1,"unitPrice":150,"shipmentCode":"AR-S-0001-02"}]',
   'Lote de prueba', 'third_party', null),
  ('00000000-0000-4000-8000-0000000f0102', '00000000-0000-4000-8000-0000000000a0', 'F-1999-0102', 'DTD-T001', 'Cliente Directo Uno',
   '00000000-0000-4000-8000-0000000e0005', 'DTD-T001-01', 'USD', 16, 100, 16, 116, 'borrador',
   '[{"desc":"Línea de prueba","qty":1,"unitPrice":100,"shipmentCode":"DTD-T001-01"}]', 'Lote de prueba', 'third_party', null),
  ('00000000-0000-4000-8000-0000000f0103', '00000000-0000-4000-8000-0000000000a0', 'F-1999-0103', 'DTD-T003', 'Cliente Directo Tres',
   '00000000-0000-4000-8000-0000000e0007', 'DTD-T003-01', 'USD', 16, 50, 8, 58, 'borrador',
   '[{"desc":"Línea de prueba","qty":1,"unitPrice":50,"shipmentCode":"DTD-T003-01"}]', 'Lote de prueba', 'third_party', null),
  ('00000000-0000-4000-8000-0000000f0104', '00000000-0000-4000-8000-0000000000a0', 'F-1999-0104', 'DTD-T003', 'Cliente Directo Tres',
   '00000000-0000-4000-8000-0000000e0007', 'DTD-T003-01', 'USD', 16, 50, 8, 58, 'emitida',
   '[]', 'Lote de prueba', 'third_party', null),
  ('00000000-0000-4000-8000-0000000f0105', '00000000-0000-4000-8000-0000000000a0', 'F-1999-0105', 'DTD-T003', 'Cliente Directo Tres',
   '00000000-0000-4000-8000-0000000e0007', 'DTD-T003-01', 'USD', 16, 50, 8, 58, 'borrador',
   '[]', 'Lote de prueba', 'third_party', now()),
  ('00000000-0000-4000-8000-0000000f0106', '00000000-0000-4000-8000-0000000000a0', 'F-1999-0106', 'DTD-T003', 'Cliente Directo Tres',
   '00000000-0000-4000-8000-0000000e0007', 'DTD-T003-01', 'VES', 16, 50, 8, 58, 'borrador',
   '[]', 'Lote de prueba', 'third_party', null),
  ('00000000-0000-4000-8000-0000000f0107', '00000000-0000-4000-8000-0000000000a0', 'F-1999-0107', 'DTD-T003', 'Cliente Directo Tres',
   '00000000-0000-4000-8000-0000000e0007', 'DTD-T003-01', 'USD', 16, 0, 0, 0, 'borrador',
   '[]', 'Lote de prueba', 'third_party', null),
  ('00000000-0000-4000-8000-0000000f0108', '00000000-0000-4000-8000-0000000000a0', 'F-1999-0108', 'DTD-T002', 'Cliente Directo Dos',
   '00000000-0000-4000-8000-0000000e0006', 'DTD-T002-01', 'USD', 16, 50, 8, 58, 'borrador',
   '[]', 'Lote de prueba', 'third_party', null),
  ('00000000-0000-4000-8000-0000000f0109', '00000000-0000-4000-8000-0000000000a0', 'F-1999-0109', 'AR', 'Aliado Raíz Ficticio',
   '00000000-0000-4000-8000-0000000e0004', 'AR-S-0001-04', 'USD', 16, 50, 8, 58, 'borrador',
   '[]', 'Lote de prueba', 'third_party', null),
  ('00000000-0000-4000-8000-0000000f0110', '00000000-0000-4000-8000-0000000000b0', 'F-1999-0110', 'DTD-B001', 'Cliente Tenant B',
   '00000000-0000-4000-8000-0000000e0b01', 'DTD-B001-01', 'USD', 0, 10, 0, 10, 'borrador',
   '[]', 'Lote de prueba', 'third_party', null),
  ('00000000-0000-4000-8000-0000000f0111', '00000000-0000-4000-8000-0000000000a0', 'F-1999-0111', 'DTD-T001', 'Cliente Directo Uno',
   '00000000-0000-4000-8000-0000000e0005', 'DTD-T001-01', 'USD', 16, 100, 16, 116, 'borrador',
   '[]', 'Lote de prueba', 'third_party', null),
  ('00000000-0000-4000-8000-0000000f0112', '00000000-0000-4000-8000-0000000000a0', 'F-1999-0112', 'DTD-T004', 'Cliente Directo Cuatro',
   '00000000-0000-4000-8000-0000000e0008', 'DTD-T004-01', 'USD', 16, 100, 16, 116, 'borrador',
   '[]', 'Lote de prueba', 'third_party', null);
insert into public.invoices
  (id, tenant_id, invoice_code, client_markbox, client_name, shipment_id, shipment_code, currency,
   iva_rate, base_amount, iva_amount, total_amount, status, lines, notes, fund_class)
select md5('0569-f' || n)::uuid, '00000000-0000-4000-8000-0000000000a0', 'F-1999-02' || lpad(n::text, 2, '0'),
       'DTD-C00' || n, 'Cliente Carrera ' || n, md5('0569-e' || n)::uuid, 'DTD-C00' || n || '-01', 'USD',
       16, 10, 1.60, 11.60, 'borrador', '[]', 'Lote de prueba', 'third_party'
  from generate_series(1, 8) as n;
delete from public.t_audit;

-- Ayuda: llama a la RPC como un usuario y devuelve el mensaje del error (o null si no falló).
create function public.t_intento(p_uid text, p_cons uuid, p_ids uuid[], p_conf text default 'Confirmado')
returns text language plpgsql as $$
declare v_err text;
begin
  perform set_config('test.uid', p_uid, true);
  set local role authenticated;
  begin
    perform public.exc0674_emitir_borradores(p_cons, p_ids, p_conf);
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  return v_err;
end $$;
grant execute on function public.t_intento(text, uuid, uuid[], text) to authenticated;

-- Ayuda: lo que la RPC escribe, en un texto, para comparar antes y después de un rechazo.
create function public.t_huella() returns text language sql as $$
  select concat_ws('|',
    (select count(*) from public.invoices where status = 'emitida'),
    (select count(*) from public.exc0674_facturas),
    (select count(*) from public.exc0674_factura_envios),
    (select count(*) from public.t_asientos),
    (select count(*) from public.t_audit),
    (select sum(write_version) from public.invoices))
$$;

-- ── Aserciones (aquí termina el fixture que reusa la carrera) ──

-- ─── 1. Las filas de la 0564 quedan en 'tecleado' ────────────
do $origen_monto$
begin
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'exc0674_facturas' and column_name = 'origen_monto')
     not like '''tecleado''%' then
    raise exception 'CONTRATO 1: origen_monto sin default tecleado';
  end if;
end
$origen_monto$;

-- ─── 5, 6, 7 y 8. Rechazos antes de emitir nada ──────────────
do $rechazos$
declare
  k64 constant uuid := '00000000-0000-4000-8000-00000000c064';
  a5  constant text := '00000000-0000-4000-8000-00000000a005';
  t001 constant uuid[] := array['00000000-0000-4000-8000-0000000f0102']::uuid[];
  v_antes text := public.t_huella();
  v text;
begin
  v := public.t_intento('00000000-0000-4000-8000-00000000a001', k64, t001);
  if v is distinct from 'exc0674:rol' then raise exception 'CONTRATO 5: operations emitió (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a002', k64, t001);
  if v is distinct from 'exc0674:rol' then raise exception 'CONTRATO 5: commercial emitió (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a003', k64, t001);
  if v is distinct from 'exc0674:rol' then raise exception 'CONTRATO 5: warehouse emitió (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000a004', k64, t001);
  if v is distinct from 'exc0674:rol' then raise exception 'CONTRATO 5: support emitió (%)', v; end if;
  v := public.t_intento('', k64, t001);
  if v is distinct from 'exc0674:sin_sesion' then raise exception 'CONTRATO 5: sin sesión emitió (%)', v; end if;

  v := public.t_intento(a5, k64, t001, 'confirmado');
  if v is distinct from 'exc0674:sin_confirmacion' then raise exception 'CONTRATO 6: confirmación inexacta (%)', v; end if;
  v := public.t_intento(a5, k64, t001, null);
  if v is distinct from 'exc0674:sin_confirmacion' then raise exception 'CONTRATO 6: sin confirmación (%)', v; end if;
  v := public.t_intento(a5, '00000000-0000-4000-8000-00000000c065', array['00000000-0000-4000-8000-0000000f0108']::uuid[]);
  if v is distinct from 'exc0674:contenedor_fuera_de_lista' then raise exception 'CONTRATO 6: K65 fuera de la lista (%)', v; end if;
  v := public.t_intento(a5, '00000000-0000-4000-8000-00000000c0d1', t001);
  if v is distinct from 'exc0674:contenedor_fuera_de_lista' then raise exception 'CONTRATO 6: contenedor borrado (%)', v; end if;
  v := public.t_intento('00000000-0000-4000-8000-00000000b001', k64, t001);
  if v is distinct from 'exc0674:contenedor_fuera_de_lista' then raise exception 'CONTRATO 6: el tenant B emitió en el K64 de A (%)', v; end if;

  v := public.t_intento(a5, k64, null);
  if v is distinct from 'exc0674:datos' then raise exception 'CONTRATO 7: ids nulos (%)', v; end if;
  v := public.t_intento(a5, null, t001);
  if v is distinct from 'exc0674:datos' then raise exception 'CONTRATO 7: contenedor nulo (%)', v; end if;
  v := public.t_intento(a5, k64, array[]::uuid[]);
  if v is distinct from 'exc0674:datos' then raise exception 'CONTRATO 7: lista vacía (%)', v; end if;
  v := public.t_intento(a5, k64, t001 || t001);
  if v is distinct from 'exc0674:datos' then raise exception 'CONTRATO 7: id repetido (%)', v; end if;
  v := public.t_intento(a5, k64, t001 || array[null]::uuid[]);
  if v is distinct from 'exc0674:datos' then raise exception 'CONTRATO 7: id nulo (%)', v; end if;
  v := public.t_intento(a5, k64, array(select gen_random_uuid() from generate_series(1, 501)));
  if v is distinct from 'exc0674:datos' then raise exception 'CONTRATO 7: más de 500 (%)', v; end if;
  v := public.t_intento(a5, k64, array[['00000000-0000-4000-8000-0000000f0102'], ['00000000-0000-4000-8000-0000000f0103']]::uuid[]);
  if v is distinct from 'exc0674:datos' then raise exception 'CONTRATO 7: dos dimensiones (%)', v; end if;

  v := public.t_intento(a5, k64, array['00000000-0000-4000-8000-0000000f0999']::uuid[]);
  if v is distinct from 'exc0674:factura_inexistente:00000000-0000-4000-8000-0000000f0999' then
    raise exception 'CONTRATO 8: factura inexistente (%)', v;
  end if;
  v := public.t_intento(a5, k64, array['00000000-0000-4000-8000-0000000f0110']::uuid[]);
  if v is distinct from 'exc0674:factura_inexistente:00000000-0000-4000-8000-0000000f0110' then
    raise exception 'CONTRATO 8: factura de otro tenant (%)', v;
  end if;
  v := public.t_intento(a5, k64, array['00000000-0000-4000-8000-0000000f0105']::uuid[]);
  if v is distinct from 'exc0674:factura_inexistente:00000000-0000-4000-8000-0000000f0105' then
    raise exception 'CONTRATO 8: factura borrada (%)', v;
  end if;
  v := public.t_intento(a5, k64, array['00000000-0000-4000-8000-0000000f0104']::uuid[]);
  if v is distinct from 'exc0674:no_borrador:F-1999-0104' then raise exception 'CONTRATO 8: no borrador (%)', v; end if;
  v := public.t_intento(a5, k64, array['00000000-0000-4000-8000-0000000f0106']::uuid[]);
  if v is distinct from 'exc0674:moneda:F-1999-0106' then raise exception 'CONTRATO 8: en VES (%)', v; end if;
  v := public.t_intento(a5, k64, array['00000000-0000-4000-8000-0000000f0107']::uuid[]);
  if v is distinct from 'exc0674:monto:F-1999-0107' then raise exception 'CONTRATO 8: total 0 (%)', v; end if;
  v := public.t_intento(a5, k64, array['00000000-0000-4000-8000-0000000f0108']::uuid[]);
  if v is distinct from 'exc0674:envio_fuera_del_contenedor:F-1999-0108' then
    raise exception 'CONTRATO 8: embarque de otro contenedor (%)', v;
  end if;
  v := public.t_intento(a5, k64, array['00000000-0000-4000-8000-0000000f0109']::uuid[]);
  if v is distinct from 'exc0674:envio_fuera_del_contenedor:F-1999-0109' then
    raise exception 'CONTRATO 8: embarque reasignado (%)', v;
  end if;

  -- 9. Todo o nada: AR-S-0001 va primero (orden de Shipping Mark) y ya quedó emitida dentro de la
  --    llamada cuando falla la de DTD-T003. No queda nada.
  v := public.t_intento(a5, k64, array['00000000-0000-4000-8000-0000000f0106', '00000000-0000-4000-8000-0000000f0101']::uuid[]);
  if v is distinct from 'exc0674:moneda:F-1999-0106' then raise exception 'CONTRATO 9: (%)', v; end if;
  v := public.t_intento(a5, k64, array['00000000-0000-4000-8000-0000000f0102', '00000000-0000-4000-8000-0000000f0110']::uuid[]);
  if v is distinct from 'exc0674:factura_inexistente:00000000-0000-4000-8000-0000000f0110' then
    raise exception 'CONTRATO 9: una de otro tenant en la lista (%)', v;
  end if;
  perform set_config('test.post', 'falla', true);
  v := public.t_intento(a5, k64, t001);
  perform set_config('test.post', '', true);
  if v is distinct from 'exc0674:asiento:sin_cuentas' then raise exception 'CONTRATO 9: asiento fallido (%)', v; end if;
  perform set_config('test.post', 'raro', true);
  v := public.t_intento(a5, k64, t001);
  perform set_config('test.post', '', true);
  if v is distinct from 'exc0674:asiento:desconocido' then raise exception 'CONTRATO 9: outcome raro (%)', v; end if;
  perform set_config('test.audit', 'falla', true);
  v := public.t_intento(a5, k64, t001);
  perform set_config('test.audit', '', true);
  if v is distinct from 'audit: falla de prueba' then raise exception 'CONTRATO 9: auditoría fallida (%)', v; end if;

  if public.t_huella() is distinct from v_antes
     or exists (select 1 from public.invoices where id in ('00000000-0000-4000-8000-0000000f0101',
                  '00000000-0000-4000-8000-0000000f0102') and (status <> 'borrador' or issued_at is not null)) then
    raise exception 'CONTRATO 5-9: un rechazo dejó algo (% → %)', v_antes, public.t_huella();
  end if;
end
$rechazos$;

-- ─── 2, 3 y 4. Emitir la pre-orden de un cliente ─────────────
do $por_cliente$
declare
  k64 constant uuid := '00000000-0000-4000-8000-00000000c064';
  r jsonb;
  antes public.invoices%rowtype;
  i public.invoices%rowtype;
  f public.exc0674_facturas%rowtype;
  v_hoy date := (statement_timestamp() at time zone 'America/Caracas')::date;
begin
  select * into antes from public.invoices where id = '00000000-0000-4000-8000-0000000f0101';
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000a005', true);
  set local role authenticated;
  r := public.exc0674_emitir_borradores(k64, array['00000000-0000-4000-8000-0000000f0101']::uuid[], 'Confirmado');
  reset role;

  if (r ->> 'version')::int is distinct from 1 or pg_catalog.jsonb_array_length(r -> 'facturas') <> 1
     or (select array_agg(k order by k) from jsonb_object_keys(r -> 'facturas' -> 0) as k)
        <> array['billed_markbox', 'billed_name', 'client_markbox', 'due_date', 'invoice_code', 'invoice_id',
                 'issued_at', 'shipment_code', 'total_usd'] then
    raise exception 'CONTRATO 2: la salida no tiene la forma de la 0564: %', r;
  end if;
  if r -> 'facturas' -> 0 ->> 'client_markbox' <> 'AR-S-0001' or r -> 'facturas' -> 0 ->> 'invoice_code' <> 'F-1999-0101'
     or r -> 'facturas' -> 0 ->> 'billed_markbox' <> 'AR' or r -> 'facturas' -> 0 ->> 'billed_name' <> 'Aliado Raíz Ficticio'
     or r -> 'facturas' -> 0 ->> 'shipment_code' <> 'AR-S-0001-01'
     or (r -> 'facturas' -> 0 ->> 'total_usd')::numeric <> 406
     or (r -> 'facturas' -> 0 ->> 'issued_at')::date <> v_hoy
     or (r -> 'facturas' -> 0 ->> 'due_date')::date <> v_hoy + 30
     or (r -> 'facturas' -> 0 ->> 'invoice_id')::uuid <> antes.id then
    raise exception 'CONTRATO 2: salida %', r;
  end if;

  select * into i from public.invoices where id = antes.id;
  if i.status <> 'emitida' or i.issued_at <> v_hoy or i.due_date <> v_hoy + 30 then
    raise exception 'CONTRATO 2: no quedó emitida con fecha de hoy y vencimiento a 30 días';
  end if;
  if i.invoice_code <> antes.invoice_code or i.total_amount <> antes.total_amount or i.base_amount <> antes.base_amount
     or i.iva_amount <> antes.iva_amount or i.lines <> antes.lines or i.currency <> 'USD'
     or i.shipment_id <> antes.shipment_id or i.notes <> antes.notes then
    raise exception 'CONTRATO 2: emitir cambió el código, las líneas o los montos de la pre-orden';
  end if;
  if i.write_version <> antes.write_version + 1 then
    raise exception 'CONTRATO 2: write_version % → % (esperaba +1)', antes.write_version, i.write_version;
  end if;
  -- El trigger 0466 selló el titular desde la ficha de AR en la transición borrador → emitida.
  if i.client_name <> 'Aliado Raíz Ficticio' or i.client_rif <> 'J-000000001' or i.client_markbox <> 'AR' then
    raise exception 'CONTRATO 2: el titular no quedó sellado (% / %)', i.client_name, i.client_rif;
  end if;

  -- 3. Asiento, rastro y vínculo.
  if (select count(*) from public.t_asientos where invoice_id = i.id) <> 1 then
    raise exception 'CONTRATO 3: no se hizo el asiento';
  end if;
  select * into f from public.exc0674_facturas where invoice_id = i.id;
  if f.client_markbox <> 'AR-S-0001' or f.billed_markbox <> 'AR' or f.total_usd <> 406 or f.invoice_code <> 'F-1999-0101'
     or f.legal_ack <> 'exc_0674' or f.tecleado_por <> '00000000-0000-4000-8000-00000000a005'
     or f.origen_monto <> 'borrador' or f.consolidation_id <> k64 or f.anulada_at is not null then
    raise exception 'CONTRATO 3: rastro incompleto';
  end if;
  if (select count(*) from public.exc0674_factura_envios
       where invoice_id = i.id and client_markbox = 'AR-S-0001' and consolidation_id = k64) <> 3
     or exists (select 1 from public.exc0674_factura_envios where shipment_id = '00000000-0000-4000-8000-0000000e0004') then
    raise exception 'CONTRATO 3: el vínculo no cubre los 3 embarques vigentes del cliente';
  end if;
  if (select count(*) from public.exc0674_envios_cubiertos where invoice_id = i.id and status = 'emitida') <> 3 then
    raise exception 'CONTRATO 3: la vista de la 0574 no muestra los envíos cubiertos';
  end if;

  -- 4. Auditoría.
  if (select count(*) from public.t_audit
       where entity_type = 'invoice' and entity_id = i.id and event_type = 'invoice_emitted_exc0674_borrador'
         and actor_type = 'user' and actor_id = '00000000-0000-4000-8000-00000000a005' and source = 'rpc'
         and after_data ->> 'legal_ack' = 'exc_0674' and after_data ->> 'origen' = 'borrador'
         and after_data ->> 'invoice_code' = 'F-1999-0101' and (after_data ->> 'total_amount')::numeric = 406
         and before_data ->> 'status' = 'borrador'
         and reason like 'EXC-0674 ampliada a pre-orden (Sam, 2026-11-20)%' and reason like '%AUT-04%'
         and payload ->> 'sdd' = '0690') <> 1 then
    raise exception 'CONTRATO 4: falta el evento invoice_emitted_exc0674_borrador';
  end if;
  if (select count(*) from public.t_audit
       where entity_id = i.id and event_type = 'invoice_emitted' and before_data ->> 'status' = 'borrador') <> 1 then
    raise exception 'CONTRATO 4: el d2 no anotó la emisión';
  end if;
end
$por_cliente$;

-- ─── 10. «Facturar todo», con admin y asiento already_posted ─
do $todo$
declare
  k64 constant uuid := '00000000-0000-4000-8000-00000000c064';
  r jsonb;
  n_asientos integer := (select count(*) from public.t_asientos);
begin
  perform set_config('test.post', 'ya', true);
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000a006', true);
  set local role authenticated;
  r := public.exc0674_emitir_borradores(k64,
    array['00000000-0000-4000-8000-0000000f0103', '00000000-0000-4000-8000-0000000f0102']::uuid[], 'Confirmado');
  reset role;
  perform set_config('test.post', '', true);
  if pg_catalog.jsonb_array_length(r -> 'facturas') <> 2
     or r -> 'facturas' -> 0 ->> 'client_markbox' <> 'DTD-T001' or r -> 'facturas' -> 1 ->> 'client_markbox' <> 'DTD-T003'
     or r -> 'facturas' -> 0 ->> 'invoice_code' <> 'F-1999-0102' or r -> 'facturas' -> 1 ->> 'invoice_code' <> 'F-1999-0103' then
    raise exception 'CONTRATO 10: salida %', r;
  end if;
  if (select count(*) from public.invoices where id in ('00000000-0000-4000-8000-0000000f0102',
        '00000000-0000-4000-8000-0000000f0103') and status = 'emitida') <> 2
     or (select count(*) from public.exc0674_facturas where origen_monto = 'borrador'
          and tecleado_por = '00000000-0000-4000-8000-00000000a006') <> 2
     or (select count(*) from public.t_asientos) <> n_asientos then
    raise exception 'CONTRATO 10: «Facturar todo» no emitió las dos con already_posted';
  end if;
end
$todo$;

-- ─── 14. El monto tecleado no se emite si el cliente tiene pre-orden ─
-- Ayuda: llama a exc0674_facturar (redefinida por la 0569) como un usuario y devuelve el error (o null).
create function public.t_teclear(p_uid text, p_cons uuid, p_montos jsonb)
returns text language plpgsql as $$
declare v_err text;
begin
  perform set_config('test.uid', p_uid, true);
  set local role authenticated;
  begin
    perform public.exc0674_facturar(p_cons, p_montos, 'Confirmado');
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  return v_err;
end $$;
grant execute on function public.t_teclear(text, uuid, jsonb) to authenticated;

-- Fixture propio (después del de la carrera): DTD-S001 tiene un embarque vigente en el K64 (-01) y otro en
-- el K65 (-02). Sus dos pre-órdenes NO cuentan en el K64: f0113 es de su embarque del K65 y f0114 está
-- borrada. Montos inventados.
insert into public.clients (id, tenant_id, markbox, name) values
  ('00000000-0000-4000-8000-0000000c0a07', '00000000-0000-4000-8000-0000000000a0', 'DTD-S001', 'Cliente Sin Pre-orden');
insert into public.shipments (id, tenant_id, code, client_markbox, volume_m3) values
  ('00000000-0000-4000-8000-0000000e0009', '00000000-0000-4000-8000-0000000000a0', 'DTD-S001-01', 'DTD-S001', 2),
  ('00000000-0000-4000-8000-0000000e0010', '00000000-0000-4000-8000-0000000000a0', 'DTD-S001-02', 'DTD-S001', 1);
insert into public.consolidation_items (tenant_id, consolidation_id, shipment_id, created_at) values
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064', '00000000-0000-4000-8000-0000000e0009', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c065', '00000000-0000-4000-8000-0000000e0010', now() - interval '2 days');
insert into public.invoices
  (id, tenant_id, invoice_code, client_markbox, client_name, shipment_id, shipment_code, currency,
   iva_rate, base_amount, iva_amount, total_amount, status, lines, notes, fund_class, deleted_at)
values
  ('00000000-0000-4000-8000-0000000f0113', '00000000-0000-4000-8000-0000000000a0', 'F-1999-0113', 'DTD-S001', 'Cliente Sin Pre-orden',
   '00000000-0000-4000-8000-0000000e0010', 'DTD-S001-02', 'USD', 16, 50, 8, 58, 'borrador',
   '[]', 'Lote de prueba', 'third_party', null),
  ('00000000-0000-4000-8000-0000000f0114', '00000000-0000-4000-8000-0000000000a0', 'F-1999-0114', 'DTD-S001', 'Cliente Sin Pre-orden',
   '00000000-0000-4000-8000-0000000e0009', 'DTD-S001-01', 'USD', 16, 50, 8, 58, 'borrador',
   '[]', 'Lote de prueba', 'third_party', now());

do $tiene_preorden$
declare
  k64 constant uuid := '00000000-0000-4000-8000-00000000c064';
  a5  constant text := '00000000-0000-4000-8000-00000000a005';
  n_inv integer := (select count(*) from public.invoices);
  v_antes text := public.t_huella();
  v text;
  r jsonb;
begin
  -- La función aplicada tiene la guarda y conserva la forma y los grants de la 0564.
  if not exists (select 1 from pg_catalog.pg_proc p
                  where p.oid = 'public.exc0674_facturar(uuid,jsonb,text)'::regprocedure
                    and p.prosecdef and p.proconfig @> array['search_path=""']
                    and pg_catalog.strpos(p.prosrc, 'exc0674:tiene_preorden:') > 0)
     or pg_catalog.has_function_privilege('anon', 'public.exc0674_facturar(uuid,jsonb,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.exc0674_facturar(uuid,jsonb,text)', 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', 'public.exc0674_facturar(uuid,jsonb,text)', 'EXECUTE') then
    raise exception 'CONTRATO 14: exc0674_facturar no quedó con la guarda de pre-orden y la forma de la 0564';
  end if;

  -- a. DTD-T004 tiene su pre-orden viva (f0112) en el K64: el monto tecleado no se emite.
  v := public.t_teclear(a5, k64, '[{"client_markbox":"DTD-T004","total_usd":116}]');
  if v is distinct from 'exc0674:tiene_preorden:DTD-T004' then
    raise exception 'CONTRATO 14a: un cliente con pre-orden se facturó con monto tecleado (%)', v;
  end if;
  -- El Shipping Mark se normaliza como en la 0564.
  v := public.t_teclear(a5, k64, '[{"client_markbox":" dtd-t004 ","total_usd":116}]');
  if v is distinct from 'exc0674:tiene_preorden:DTD-T004' then
    raise exception 'CONTRATO 14a: el Shipping Mark sin normalizar esquivó la guarda (%)', v;
  end if;
  -- Todo o nada: DTD-S001 va primero (orden de Shipping Mark) y ya quedó facturado dentro de la llamada
  -- cuando la guarda frena a DTD-T004. No queda nada.
  v := public.t_teclear(a5, k64,
    '[{"client_markbox":"DTD-T004","total_usd":116},{"client_markbox":"DTD-S001","total_usd":58}]');
  if v is distinct from 'exc0674:tiene_preorden:DTD-T004' then
    raise exception 'CONTRATO 14a: contenedor completo con un cliente con pre-orden (%)', v;
  end if;
  if (select count(*) from public.invoices) <> n_inv or public.t_huella() is distinct from v_antes
     or (select status from public.invoices where id = '00000000-0000-4000-8000-0000000f0112') <> 'borrador'
     or exists (select 1 from public.exc0674_facturas where client_markbox in ('DTD-T004', 'DTD-S001')) then
    raise exception 'CONTRATO 14a: un rechazo por pre-orden dejó algo (% → %)', v_antes, public.t_huella();
  end if;

  -- b. Pre-orden ya emitida (CONTRATOS 2 y 10): el monto tecleado sale ya facturado. DTD-T001 aún tiene
  --    otra pre-orden viva (f0111) y AR-S-0001 una de un embarque reasignado (f0109): manda ya_facturado.
  v := public.t_teclear(a5, k64, '[{"client_markbox":"DTD-T001","total_usd":116}]');
  if v is distinct from 'exc0674:ya_facturado:DTD-T001' then
    raise exception 'CONTRATO 14b: tecleado después de emitir la pre-orden (%)', v;
  end if;
  v := public.t_teclear(a5, k64, '[{"client_markbox":"AR-S-0001","total_usd":406}]');
  if v is distinct from 'exc0674:ya_facturado:AR-S-0001' then
    raise exception 'CONTRATO 14b: tecleado de un cliente aliado después de emitir su pre-orden (%)', v;
  end if;
  if (select count(*) from public.invoices) <> n_inv or public.t_huella() is distinct from v_antes then
    raise exception 'CONTRATO 14b: un rechazo dejó algo (% → %)', v_antes, public.t_huella();
  end if;

  -- c. DTD-S001 no tiene pre-orden viva en el K64: se factura con monto tecleado, como en la 0564.
  perform set_config('test.uid', a5, true);
  set local role authenticated;
  r := public.exc0674_facturar(k64, '[{"client_markbox":"DTD-S001","total_usd":58}]', 'Confirmado');
  reset role;
  if pg_catalog.jsonb_array_length(r -> 'facturas') <> 1 or r -> 'facturas' -> 0 ->> 'client_markbox' <> 'DTD-S001'
     or (r -> 'facturas' -> 0 ->> 'total_usd')::numeric <> 58 then
    raise exception 'CONTRATO 14c: salida %', r;
  end if;
  if (select count(*) from public.invoices) <> n_inv + 1
     or (select count(*) from public.invoices where status = 'emitida' and client_markbox = 'DTD-S001'
          and id = (r -> 'facturas' -> 0 ->> 'invoice_id')::uuid) <> 1
     or (select count(*) from public.exc0674_facturas where client_markbox = 'DTD-S001' and anulada_at is null
          and origen_monto = 'tecleado' and consolidation_id = k64) <> 1
     or (select count(*) from public.invoices where id in ('00000000-0000-4000-8000-0000000f0113',
          '00000000-0000-4000-8000-0000000f0114') and status = 'borrador') <> 2 then
    raise exception 'CONTRATO 14c: el cliente sin pre-orden no quedó facturado con monto tecleado';
  end if;
end
$tiene_preorden$;

-- ─── 11. Cliente ya facturado; anular y volver a emitir ──────
do $ya_facturado$
declare
  k64 constant uuid := '00000000-0000-4000-8000-00000000c064';
  a5  constant text := '00000000-0000-4000-8000-00000000a005';
  v text;
  r jsonb;
begin
  -- Otra pre-orden de un cliente ya emitido por pre-orden.
  v := public.t_intento(a5, k64, array['00000000-0000-4000-8000-0000000f0111']::uuid[]);
  if v is distinct from 'exc0674:ya_facturado:DTD-T001' then raise exception 'CONTRATO 11: (%)', v; end if;
  -- La misma pre-orden otra vez (doble clic): el cliente ya está facturado.
  v := public.t_intento(a5, k64, array['00000000-0000-4000-8000-0000000f0101']::uuid[]);
  if v is distinct from 'exc0674:ya_facturado:AR-S-0001' then raise exception 'CONTRATO 11: dos veces (%)', v; end if;

  -- Un cliente facturado por la 0564 con monto tecleado: su fila es 'tecleado' y su pre-orden no se emite.
  -- Desde la 0569 el tecleado se niega mientras la pre-orden esté viva (CONTRATO 14a). Para llegar a este
  -- estado (pre-orden que aparece después del tecleado), se borra f0112, se teclea y se repone.
  update public.invoices set deleted_at = now() where id = '00000000-0000-4000-8000-0000000f0112';
  perform set_config('test.uid', a5, true);
  set local role authenticated;
  r := public.exc0674_facturar(k64, '[{"client_markbox":"DTD-T004","total_usd":116}]', 'Confirmado');
  reset role;
  update public.invoices set deleted_at = null where id = '00000000-0000-4000-8000-0000000f0112';
  if (select origen_monto from public.exc0674_facturas where client_markbox = 'DTD-T004') is distinct from 'tecleado' then
    raise exception 'CONTRATO 11: la 0564 no dejó origen_monto tecleado';
  end if;
  v := public.t_intento(a5, k64, array['00000000-0000-4000-8000-0000000f0112']::uuid[]);
  if v is distinct from 'exc0674:ya_facturado:DTD-T004' then raise exception 'CONTRATO 11: tecleado y pre-orden (%)', v; end if;
  if (select status from public.invoices where id = '00000000-0000-4000-8000-0000000f0112') <> 'borrador' then
    raise exception 'CONTRATO 11: la pre-orden de un cliente facturado cambió';
  end if;

  -- Facturación anula la de DTD-T001 (como voidInvoice): el trigger de la 0564 libera al cliente.
  update public.invoices set status = 'anulada' where id = '00000000-0000-4000-8000-0000000f0102';
  v := public.t_intento(a5, k64, array['00000000-0000-4000-8000-0000000f0111']::uuid[]);
  if v is not null then raise exception 'CONTRATO 11: no se pudo emitir después de anular (%)', v; end if;
  if (select count(*) from public.exc0674_facturas where client_markbox = 'DTD-T001') <> 2
     or (select count(*) from public.exc0674_facturas where client_markbox = 'DTD-T001' and anulada_at is null
          and invoice_id = '00000000-0000-4000-8000-0000000f0111' and origen_monto = 'borrador') <> 1 then
    raise exception 'CONTRATO 11: el rastro no quedó con una anulada y una viva';
  end if;
end
$ya_facturado$;

-- ─── 13. Privilegios ─────────────────────────────────────────
do $privilegios$
declare
  n integer;
begin
  if not exists (select 1 from pg_catalog.pg_proc p
                  where p.oid = 'public.exc0674_emitir_borradores(uuid,uuid[],text)'::regprocedure
                    and p.prosecdef and p.proconfig @> array['search_path=""']) then
    raise exception 'CONTRATO 13: la RPC no es SECURITY DEFINER con search_path vacío';
  end if;
  if pg_catalog.has_function_privilege('anon', 'public.exc0674_emitir_borradores(uuid,uuid[],text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.exc0674_emitir_borradores(uuid,uuid[],text)', 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', 'public.exc0674_emitir_borradores(uuid,uuid[],text)', 'EXECUTE') then
    raise exception 'CONTRATO 13: EXECUTE de la RPC no es solo de authenticated';
  end if;
  begin
    insert into public.exc0674_facturas
      (tenant_id, consolidation_id, client_markbox, invoice_id, invoice_code, billed_markbox, total_usd, tecleado_por, origen_monto)
    values ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000c064', 'DTD-T002',
            '00000000-0000-4000-8000-0000000f0108', 'F-1999-0108', 'DTD-T002', 58,
            '00000000-0000-4000-8000-00000000a005', 'otro');
    raise exception 'CONTRATO 13: el check de origen_monto aceptó otro valor';
  exception when check_violation then null;
  end;
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000a005', true);
  set local role authenticated;
  begin
    update public.exc0674_facturas set origen_monto = 'tecleado';
    raise exception 'CONTRATO 13: authenticated cambió el origen_monto del rastro';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.exc0674_facturas;
  -- 6: las 5 de los CONTRATOS 2, 10 y 11 y la tecleada de DTD-S001 (CONTRATO 14c).
  if n <> 6 then raise exception 'CONTRATO 13: accounting de A ve % filas del rastro (esperaba 6)', n; end if;
  reset role;
  perform set_config('test.uid', '00000000-0000-4000-8000-00000000a001', true);
  set local role authenticated;
  if (select count(*) from public.exc0674_facturas) <> 0 then
    raise exception 'CONTRATO 13: operations ve el rastro';
  end if;
  reset role;
end
$privilegios$;

-- ─── 12. Ensayo del desarme (supabase/desarmes/0569_desarme.sql) ─────────
do $desarme$
declare
  v_sql text := pg_catalog.pg_read_file('/sb/desarmes/0569_desarme.sql');
begin
  begin
    execute v_sql;
    raise exception 'CONTRATO 12: el desarme corrió con facturas de origen_monto borrador';
  exception when others then
    if sqlerrm not like '0569 desarme: hay facturas emitidas desde una pre-orden%' then raise; end if;
  end;
  if pg_catalog.to_regprocedure('public.exc0674_emitir_borradores(uuid,uuid[],text)') is null then
    raise exception 'CONTRATO 12: el desarme que se negó quitó algo';
  end if;
  -- Sin facturas de origen_monto borrador, quita la RPC y la columna; la 0564 queda entera.
  delete from public.exc0674_factura_envios e
   using public.exc0674_facturas f where f.invoice_id = e.invoice_id and f.origen_monto = 'borrador';
  delete from public.exc0674_facturas where origen_monto = 'borrador';
  execute v_sql;
  if pg_catalog.to_regprocedure('public.exc0674_emitir_borradores(uuid,uuid[],text)') is not null
     or exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'exc0674_facturas' and column_name = 'origen_monto') then
    raise exception 'CONTRATO 12: el desarme dejó objetos de la 0569';
  end if;
  if pg_catalog.to_regprocedure('public.exc0674_facturar(uuid,jsonb,text)') is null
     or (select count(*) from public.exc0674_facturas where client_markbox = 'DTD-T004') <> 1 then
    raise exception 'CONTRATO 12: el desarme tocó la 0564 o su rastro';
  end if;
  -- exc0674_facturar vuelve a la definición de la 0564: sin la guarda de pre-orden, con la misma forma y
  -- los mismos grants.
  if not exists (select 1 from pg_catalog.pg_proc p
                  where p.oid = 'public.exc0674_facturar(uuid,jsonb,text)'::regprocedure
                    and p.prosecdef and p.proconfig @> array['search_path=""']
                    and pg_catalog.strpos(p.prosrc, 'tiene_preorden') = 0
                    and pg_catalog.strpos(p.prosrc, 'exc0674:ya_facturado:') > 0)
     or pg_catalog.has_function_privilege('anon', 'public.exc0674_facturar(uuid,jsonb,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.exc0674_facturar(uuid,jsonb,text)', 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', 'public.exc0674_facturar(uuid,jsonb,text)', 'EXECUTE')
     or pg_catalog.obj_description('public.exc0674_facturar(uuid,jsonb,text)'::regprocedure, 'pg_proc') like '%SDD-0690%' then
    raise exception 'CONTRATO 12: el desarme no repuso exc0674_facturar de la 0564';
  end if;
  -- Sin la guarda, DTD-C008 (pre-orden viva en el K64, sin fila en el rastro) vuelve a facturarse con
  -- monto tecleado, como en la 0564.
  if public.t_teclear('00000000-0000-4000-8000-00000000a005', '00000000-0000-4000-8000-00000000c064',
       '[{"client_markbox":"DTD-C008","total_usd":11.60}]') is not null then
    raise exception 'CONTRATO 12: tras el desarme, el monto tecleado de la 0564 no funciona';
  end if;
  -- Repetirlo no falla.
  execute v_sql;
  if pg_catalog.strpos((select p.prosrc from pg_catalog.pg_proc p
                         where p.oid = 'public.exc0674_facturar(uuid,jsonb,text)'::regprocedure), 'tiene_preorden') <> 0 then
    raise exception 'CONTRATO 12: el desarme repetido dejó la guarda de la 0569';
  end if;
end
$desarme$;

rollback;
