\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0359. Fixtures ficticios y rollback: no toca prod.
--
-- Hermano de los contratos de 0351 y 0358, sobre la RPC del grupo dinero que SÍ
-- se puede cerrar en la función (las cinco `void_*` no: son SECURITY INVOKER y
-- se esquivan con un UPDATE directo — ver la cabecera de la migración).
--
-- Lo que defiende, que es exactamente lo que puede romperse en silencio:
--   1. accounting y admin siguen confirmando (si esto se rompe, Facturación
--      queda muerta y nadie se entera hasta que un cliente reclame su pago),
--   2. marketing/warehouse/commercial/support NO pueden — el hallazgo; y la
--      factura NO se mueve (ni paid_amount ni status),
--   3. el candado corre ANTES de 'reporte no encontrado': sin oráculo de ids,
--   4. un usuario DESACTIVADO no pasa (current_studio_role filtra disabled_at),
--   5. el candado de tenant que ya existía sigue vivo — el rol no lo reemplaza.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema auth;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create type payment_report_status as enum ('reportado', 'confirmado', 'rechazado');
create type invoice_status as enum ('borrador','emitida','parcial','pagada','vencida','anulada');

create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz, primary key (user_id, tenant_id)
);

create table public.invoices (
  id uuid primary key,
  tenant_id uuid not null,
  total_amount numeric(14,2) not null,
  paid_amount numeric(14,2) not null default 0,
  status invoice_status not null default 'emitida',
  last_payment_at timestamptz,
  deleted_at timestamptz
);

create table public.payment_reports (
  id uuid primary key,
  tenant_id uuid not null,
  invoice_id uuid not null references public.invoices(id),
  amount numeric(14,2) not null,
  status payment_report_status not null default 'reportado',
  note text,
  confirmed_by uuid,
  confirmed_at timestamptz,
  deleted_at timestamptz
);

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select ut.tenant_id from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null limit 1;
$$;

create function public.current_studio_role() returns text
language sql stable security definer set search_path = public as $$
  select ut.role from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null limit 1;
$$;

\ir ../migrations/0351_operario_rpc_exige_rol.sql
\ir ../migrations/0359_confirm_payment_report_exige_rol.sql

-- ── Fixture ────────────────────────────────────────────────────────────────
-- Tenant A (f1) con un usuario por rol + uno desactivado · Tenant B (f2) ajeno.
insert into public.user_tenants (user_id, tenant_id, role, disabled_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1', 'admin',      null),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f1', 'accounting', null),
  ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000f1', 'marketing',  null),
  ('aaaaaaaa-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000f1', 'warehouse',  null),
  ('aaaaaaaa-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000f1', 'commercial', null),
  ('aaaaaaaa-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000f1', 'support',    null),
  ('aaaaaaaa-0000-0000-0000-000000000007', '00000000-0000-0000-0000-0000000000f1', 'accounting', now()),
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f2', 'accounting', null);

insert into public.invoices (id, tenant_id, total_amount, paid_amount, status) values
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1', 1000.00, 0, 'emitida');

insert into public.payment_reports (id, tenant_id, invoice_id, amount) values
  ('22222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1',
   '11111111-0000-0000-0000-000000000001', 400.00);

-- ── 2. Los roles sin permiso rebotan, y la FACTURA no se mueve ──────────────
-- Va primero: confirmar es irreversible (el reporte deja de estar 'reportado').
do $t2$
declare
  v_uid uuid; v_rol text; v_reboto boolean;
  v_paid_antes numeric; v_paid_despues numeric; v_status_despues invoice_status;
begin
  select paid_amount into v_paid_antes from public.invoices
   where id = '11111111-0000-0000-0000-000000000001';

  foreach v_uid in array array[
    'aaaaaaaa-0000-0000-0000-000000000003'::uuid,  -- marketing
    'aaaaaaaa-0000-0000-0000-000000000004'::uuid,  -- warehouse
    'aaaaaaaa-0000-0000-0000-000000000005'::uuid,  -- commercial
    'aaaaaaaa-0000-0000-0000-000000000006'::uuid   -- support
  ] loop
    select role into v_rol from public.user_tenants where user_id = v_uid;
    v_reboto := false;
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    begin
      perform public.confirm_payment_report(
        '22222222-0000-0000-0000-000000000001', 'confirmado', null);
    exception when insufficient_privilege then v_reboto := true;
    end;
    if not v_reboto then
      raise exception 'REGRESIÓN: el rol % dio por pagada una factura', v_rol;
    end if;
  end loop;

  select paid_amount, status into v_paid_despues, v_status_despues
    from public.invoices where id = '11111111-0000-0000-0000-000000000001';
  if v_paid_despues is distinct from v_paid_antes then
    raise exception 'El paid_amount se movió pese a que la llamada rebotó (% → %)',
      v_paid_antes, v_paid_despues;
  end if;
  if v_status_despues <> 'emitida' then
    raise exception 'El status de la factura cambió pese al rebote (%)', v_status_despues;
  end if;
end;
$t2$;

-- ── 3. Sin oráculo: el rol se chequea antes de buscar el reporte ────────────
do $t3$
declare v_estado text;
begin
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', true);
  begin
    -- id inexistente: si el candado corriera después, contestaría no_data_found
    -- y serviría para sondear qué reportes existen.
    perform public.confirm_payment_report(
      '22222222-0000-0000-0000-0000000000ff', 'confirmado', null);
    v_estado := 'no lanzó';
  exception
    when insufficient_privilege then v_estado := 'ok';
    when others then v_estado := 'filtró: ' || sqlstate;
  end;
  if v_estado <> 'ok' then
    raise exception 'El candado de rol no corre primero (%)', v_estado;
  end if;
end;
$t3$;

-- ── 4. Un accounting DESACTIVADO no pasa ───────────────────────────────────
do $t4$
declare v_reboto boolean := false;
begin
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000007', true);
  begin
    perform public.confirm_payment_report(
      '22222222-0000-0000-0000-000000000001', 'confirmado', null);
  exception when insufficient_privilege then v_reboto := true;
  end;
  if not v_reboto then
    raise exception 'Un accounting DESACTIVADO confirmó un pago';
  end if;
end;
$t4$;

-- ── 5. El candado de tenant sigue vivo (el rol no lo reemplazó) ─────────────
do $t5$
declare v_msg text := '';
begin
  -- accounting, pero de OTRO tenant: pasa el rol y debe morir en el de tenant.
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000001', true);
  begin
    perform public.confirm_payment_report(
      '22222222-0000-0000-0000-000000000001', 'confirmado', null);
  exception when others then v_msg := sqlerrm;
  end;
  if v_msg not like '%no encontrado%' and v_msg not like '%ajeno%' then
    raise exception 'El candado de tenant se perdió (mensaje: %)', v_msg;
  end if;
end;
$t5$;

-- ── 1. accounting sigue confirmando, y la plata se aplica bien ─────────────
-- De último porque confirmar es irreversible.
do $t1$
declare v_rep public.payment_reports; v_inv public.invoices;
begin
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', true);
  v_rep := public.confirm_payment_report(
    '22222222-0000-0000-0000-000000000001', 'confirmado', 'ok');

  if v_rep.status <> 'confirmado' then
    raise exception 'REGRESIÓN: accounting no pudo confirmar (status %)', v_rep.status;
  end if;

  select * into v_inv from public.invoices
   where id = '11111111-0000-0000-0000-000000000001';
  if v_inv.paid_amount <> 400.00 then
    raise exception 'REGRESIÓN: paid_amount quedó en % (esperado 400.00)', v_inv.paid_amount;
  end if;
  if v_inv.status <> 'parcial' then
    raise exception 'REGRESIÓN: 400 de 1000 debía dejar la factura parcial, quedó %', v_inv.status;
  end if;
end;
$t1$;

rollback;
