\set ON_ERROR_STOP on

-- Contrato del financiero con el Socio Logístico China (SDD-0059 · migr 0114).
-- Fixtures ficticios y rollback: no toca prod.
--
-- ── POR QUÉ IMPORTA ───────────────────────────────────────────────────────
--
-- Acá vive la cuenta corriente bilateral con el socio en China: cargos, notas
-- de crédito, conversiones de divisa y el cruce de reclamos. El saldo neto NO
-- se persiste —se deriva en `lib`, justamente para no driftear—, así que la
-- integridad de estas filas ES el saldo. Una fila colgada del proveedor
-- equivocado no da error en ningún lado: da un número distinto.
--
-- ── QUÉ SE PROTEGE ────────────────────────────────────────────────────────
--
--   1. 🔴 No se le carga plata al proveedor de OTRO tenant. Y se prueba en
--      las TRES tablas: el trigger es una función genérica compartida por tres
--      triggers, así que basta con que a una le falte el `create trigger` para
--      que esa tabla quede sin puerta. Probar una sola no prueba las otras dos.
--   2. 🔴 Tampoco al contenedor de otro tenant.
--   3. 🔴 Ni a un proveedor dado de baja: el helper exige `deleted_at is null`.
--      Un proveedor borrado con cargos nuevos es un saldo que nadie concilia.
--   4. La referencia NULL sí pasa — el contenedor es opcional y un cargo sin
--      contenedor tiene que poder existir.
--   5. 🔴 No se borra un cargo que tiene notas de crédito vivas (`restrict`).
--      La nota descuenta del bruto; si el cargo desaparece, la nota queda
--      huérfana y el neto del socio se calcula de más.
--   6. 🔴 Ni un proveedor con movimientos en la cuenta corriente.
--   7. 🔴 El CHECK de moneda incluye **RMB**, que NO está en el enum
--      `invoice_currency`. Ése es el motivo por el que estas tablas usan text
--      con CHECK propio en vez de reusar el enum — y una moneda inventada
--      rompe el saldo dual USD/RMB.
--   8. El correlativo PLE-YYYY-NNNN no se comparte entre tenants.
--
-- Las afirmaciones miran el ESTADO DE LA FILA después del intento, no el texto
-- de la excepción.
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

create table public.user_tenants (
  user_id     uuid,
  tenant_id   uuid,
  role        text,
  disabled_at timestamptz
);

create table public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  name       text,
  deleted_at timestamptz
);

create table public.consolidations (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  deleted_at timestamptz
);

create table public.shipments      (id uuid primary key default gen_random_uuid(), tenant_id uuid);
create table public.clients        (id uuid primary key default gen_random_uuid(), tenant_id uuid);
create table public.invoices       (id uuid primary key default gen_random_uuid(), tenant_id uuid);
create table public.journal_entries(id uuid primary key default gen_random_uuid(), tenant_id uuid);
create table public.documents      (id uuid primary key default gen_random_uuid(), tenant_id uuid);

-- La 0114 le agrega `bill_kind`; sólo tiene que existir para que el ALTER corra.
create table public.supplier_bills (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid
);

-- El plan de cuentas: la 0114 siembra 3 cuentas para el tenant de slug 'dtd'.
do $acct$
begin
  if not exists (select 1 from pg_type where typname = 'acct_type') then
    create type acct_type as enum ('A', 'P', 'PT', 'I', 'CGS', 'G');
  end if;
end;
$acct$;

create table public.accounts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  code        text not null,
  name        text not null,
  type        acct_type not null,
  is_postable boolean not null default true,
  qbo_type    text,
  parent_id   uuid,
  unique (tenant_id, code)
);

create or replace function public.get_user_tenant_id()
returns uuid language sql stable as $gut$ select null::uuid $gut$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $touch$
begin
  new.updated_at := now();
  return new;
end;
$touch$;

\ir ../migrations/0114_financiero_china.sql

-- ── Fixtures ──────────────────────────────────────────────────────────────
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'
insert into public.tenants (id, slug) values (:'t1', 'dtd'), (:'t2', 'otro');

\set s1 'aa111111-1111-1111-1111-111111111111'
\set s2 'ab222222-2222-2222-2222-222222222222'
\set sx 'ac999999-9999-9999-9999-999999999999'
insert into public.suppliers (id, tenant_id, name, deleted_at) values
  (:'s1', :'t1', 'Socio China',        null),
  (:'s2', :'t2', 'Socio de otro',      null),
  (:'sx', :'t1', 'Socio dado de baja', now());

\set k1 'ba111111-1111-1111-1111-111111111111'
\set k2 'bb222222-2222-2222-2222-222222222222'
insert into public.consolidations (id, tenant_id) values (:'k1', :'t1'), (:'k2', :'t2');

-- ¿Cuántas filas hay en las 3 tablas con trigger? Se afirma sobre el conteo.
create or replace function pg_temp.n_filas() returns int language sql as $n$
  select (select count(*) from public.supplier_charges)
       + (select count(*) from public.partner_ledger_entries)
       + (select count(*) from public.supplier_claim_offsets)
$n$;

-- ── 1 · 🔴 Proveedor de otro tenant · en las TRES tablas ──────────────────
--
-- El trigger es UNA función compartida por TRES triggers. Probar una tabla no
-- prueba las otras: si mañana alguien agrega una tabla y se olvida el
-- `create trigger`, esa tabla queda sin puerta y todo lo demás sigue verde.
do $$
begin
  begin
    insert into public.supplier_charges (tenant_id, supplier_id, description, amount)
    values ('11111111-1111-1111-1111-111111111111',
            'ab222222-2222-2222-2222-222222222222', 'flete', 1000);
  exception when others then null;
  end;

  begin
    insert into public.partner_ledger_entries
      (tenant_id, supplier_id, entry_code, entry_type, direction, amount_usd)
    values ('11111111-1111-1111-1111-111111111111',
            'ab222222-2222-2222-2222-222222222222',
            'PLE-2026-9001', 'costo_contenedor', 'debe', 1000);
  exception when others then null;
  end;

  begin
    insert into public.supplier_claim_offsets (tenant_id, supplier_id, amount_usd)
    values ('11111111-1111-1111-1111-111111111111',
            'ab222222-2222-2222-2222-222222222222', 500);
  exception when others then null;
  end;

  if pg_temp.n_filas() <> 0 then
    raise exception
      'CONTRATO 1 ROTO: entraron % filas contra el proveedor de OTRO tenant — el saldo del socio queda mal',
      pg_temp.n_filas();
  end if;
end;
$$;

-- ── 2 · 🔴 Contenedor de otro tenant ──────────────────────────────────────
do $$
begin
  begin
    insert into public.supplier_charges (tenant_id, supplier_id, container_id, description, amount)
    values ('11111111-1111-1111-1111-111111111111',
            'aa111111-1111-1111-1111-111111111111',
            'bb222222-2222-2222-2222-222222222222',   -- contenedor del tenant 2
            'flete', 1000);
  exception when others then null;
  end;

  begin
    insert into public.partner_ledger_entries
      (tenant_id, supplier_id, container_id, entry_code, entry_type, direction, amount_usd)
    values ('11111111-1111-1111-1111-111111111111',
            'aa111111-1111-1111-1111-111111111111',
            'bb222222-2222-2222-2222-222222222222',
            'PLE-2026-9002', 'costo_contenedor', 'debe', 1000);
  exception when others then null;
  end;

  if pg_temp.n_filas() <> 0 then
    raise exception 'CONTRATO 2 ROTO: se colgo un movimiento del contenedor de OTRO tenant';
  end if;
end;
$$;

-- ── 3 · 🔴 Proveedor dado de baja ─────────────────────────────────────────
do $$
begin
  begin
    insert into public.supplier_charges (tenant_id, supplier_id, description, amount)
    values ('11111111-1111-1111-1111-111111111111',
            'ac999999-9999-9999-9999-999999999999', 'cargo tardio', 1000);
  exception when others then null;
  end;

  if pg_temp.n_filas() <> 0 then
    raise exception 'CONTRATO 3 ROTO: se le cargo plata a un proveedor dado de baja';
  end if;
end;
$$;

-- ── 4 · La referencia NULL pasa, y el camino legítimo también ─────────────
--
-- Sin esto, un guard que rechazara TODO también pasaría los tres de arriba.
\set c1 'ca111111-1111-1111-1111-111111111111'
do $$
begin
  -- Cargo SIN contenedor (opcional por diseño).
  insert into public.supplier_charges (id, tenant_id, supplier_id, description, amount, currency)
  values ('ca111111-1111-1111-1111-111111111111',
          '11111111-1111-1111-1111-111111111111',
          'aa111111-1111-1111-1111-111111111111', 'inspección QC', 350.00, 'USD');

  -- Y con contenedor del MISMO tenant.
  insert into public.partner_ledger_entries
    (tenant_id, supplier_id, container_id, entry_code, entry_type, direction, amount_usd, amount_rmb)
  values ('11111111-1111-1111-1111-111111111111',
          'aa111111-1111-1111-1111-111111111111',
          'ba111111-1111-1111-1111-111111111111',
          'PLE-2026-0001', 'costo_contenedor', 'debe', 4200.00, 30000.00);

  if pg_temp.n_filas() <> 2 then
    raise exception 'CONTRATO 4 ROTO: un movimiento LEGITIMO fue rechazado — el modulo no puede operar';
  end if;
end;
$$;

-- ── 5 · 🔴 No se borra un cargo con notas de crédito vivas ────────────────
--
-- La nota descuenta del bruto. Si el cargo desaparece, la nota queda huérfana
-- y el neto del socio se calcula de más — plata que se le paga y no se debía.
do $$
declare v_n int;
begin
  insert into public.supplier_credit_notes (tenant_id, charge_id, reason, amount)
  values ('11111111-1111-1111-1111-111111111111',
          'ca111111-1111-1111-1111-111111111111', 'cobró de más', 50.00);

  begin
    delete from public.supplier_charges where id = 'ca111111-1111-1111-1111-111111111111';
  exception when others then null;
  end;

  select count(*) into v_n from public.supplier_charges
   where id = 'ca111111-1111-1111-1111-111111111111';
  if v_n <> 1 then
    raise exception 'CONTRATO 5 ROTO: se borro un cargo con nota de credito viva — la nota queda huerfana';
  end if;
end;
$$;

-- ── 6 · 🔴 No se borra un proveedor con movimientos ───────────────────────
--
-- ⚠️ Se usa un proveedor con SÓLO un movimiento de cuenta corriente, a
-- propósito. El proveedor principal está protegido **por partida doble**: sus
-- cargos lo sujetan, y a sus cargos los sujetan las notas de crédito. Probar
-- con ése no aislaría nada — al soltar su FK, el `restrict` de la nota seguiría
-- bloqueando el borrado y el contrato saldría verde igual.
do $$
declare v_n int; v_s3 uuid;
begin
  insert into public.suppliers (tenant_id, name)
  values ('11111111-1111-1111-1111-111111111111', 'Socio solo con cuenta corriente')
  returning id into v_s3;

  insert into public.partner_ledger_entries
    (tenant_id, supplier_id, entry_code, entry_type, direction, amount_usd)
  values ('11111111-1111-1111-1111-111111111111', v_s3,
          'PLE-2026-0002', 'ajuste', 'haber', 250.00);

  begin
    delete from public.suppliers where id = v_s3;
  exception when others then null;
  end;

  select count(*) into v_n from public.suppliers where id = v_s3;
  if v_n <> 1 then
    raise exception
      'CONTRATO 6 ROTO: se borro un proveedor con cuenta corriente — sus movimientos quedan sin dueno';
  end if;

  -- Y el principal, sujetado por sus cargos, tampoco.
  begin
    delete from public.suppliers where id = 'aa111111-1111-1111-1111-111111111111';
  exception when others then null;
  end;
  select count(*) into v_n from public.suppliers
   where id = 'aa111111-1111-1111-1111-111111111111';
  if v_n <> 1 then
    raise exception 'CONTRATO 6 ROTO: se borro el proveedor con cargos vivos';
  end if;
end;
$$;

-- ── 7 · 🔴 Las monedas del socio incluyen RMB y excluyen lo inventado ─────
--
-- RMB NO está en el enum `invoice_currency` — por eso estas tablas usan text
-- con CHECK propio. Si el CHECK dejara pasar cualquier cosa, el saldo dual
-- USD/RMB sumaría peras con manzanas.
do $$
declare v_n int;
begin
  insert into public.supplier_charges (tenant_id, supplier_id, description, amount, currency)
  values ('11111111-1111-1111-1111-111111111111',
          'aa111111-1111-1111-1111-111111111111', 'pago fábrica', 12000.00, 'RMB');

  begin
    insert into public.supplier_charges (tenant_id, supplier_id, description, amount, currency)
    values ('11111111-1111-1111-1111-111111111111',
            'aa111111-1111-1111-1111-111111111111', 'cargo raro', 100.00, 'EUR');
    raise exception 'CONTRATO 7 ROTO: entro un cargo en una moneda que el saldo no sabe sumar (EUR)';
  exception
    when check_violation then null;  -- esperado
  end;

  select count(*) into v_n from public.supplier_charges where currency = 'RMB';
  if v_n <> 1 then
    raise exception 'CONTRATO 7 ROTO: RMB fue rechazado — es la moneda del socio, tiene que entrar';
  end if;
end;
$$;

-- Y un entry_type inventado tampoco entra (decide cómo se clasifica el gasto).
do $$
begin
  insert into public.partner_ledger_entries
    (tenant_id, supplier_id, entry_code, entry_type, direction, amount_usd)
  values ('11111111-1111-1111-1111-111111111111',
          'aa111111-1111-1111-1111-111111111111',
          'PLE-2026-9003', 'lo_que_sea', 'debe', 100);
  raise exception 'CONTRATO 7 ROTO: entro un entry_type fuera del catalogo';
exception
  when check_violation then null;  -- esperado
end;
$$;

-- ── 8 · El correlativo no se comparte entre tenants ───────────────────────
do $$
declare v1 text; v2 text;
begin
  v1 := public.next_partner_ledger_code('11111111-1111-1111-1111-111111111111');
  v2 := public.next_partner_ledger_code('22222222-2222-2222-2222-222222222222');

  if v1 !~ '^PLE-[0-9]{4}-[0-9]{4}$' then
    raise exception 'CONTRATO 8 ROTO: el codigo no tiene forma PLE-YYYY-NNNN (es %)', v1;
  end if;
  -- El tenant 1 ya tiene PLE-2026-0001 y -0002 → el próximo es el 3º.
  if v1 not like '%-0003' then
    raise exception 'CONTRATO 8 ROTO: el tenant 1 iba por 0003 y dio %', v1;
  end if;
  -- El tenant 2 no tiene ninguno → arranca en 1, no sigue el contador ajeno.
  if v2 not like '%-0001' then
    raise exception 'CONTRATO 8 ROTO: el contador se comparte entre tenants (tenant 2 dio %)', v2;
  end if;
end;
$$;

rollback;
