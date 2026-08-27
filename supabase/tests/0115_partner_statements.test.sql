\set ON_ERROR_STOP on

-- Contrato de la reconciliación del estado de cuenta del socio China
-- (SDD-0059 Slice B1 · migr 0115). Fixtures ficticios y rollback: no toca prod.
--
-- ⚠️ SE CARGAN DOS MIGRACIONES, NO UNA
--
-- La 0115 se monta encima de la 0114: valida contra `supplier_charges` y
-- `partner_ledger_entries`, y —lo importante— **le pone a `supplier_credit_notes`
-- el trigger cross-tenant que la 0114 nunca le puso**. Cargar sólo la 0115 no
-- compila; cargar sólo la 0114 dejaría fuera justamente la corrección.
--
-- ── POR QUÉ IMPORTA ───────────────────────────────────────────────────────
--
-- Acá se decide qué línea del estado de cuenta del socio corresponde a qué
-- cargo del ERP. Es el paso previo a pagarle. Una línea atada al cargo
-- equivocado no da error: da un pago mal conciliado, y del lado de la otra
-- empresa, un neto que no cuadra sin que nadie sepa por qué.
--
-- ── QUÉ SE PROTEGE ────────────────────────────────────────────────────────
--
--   1. 🔴 Una línea no se cuelga del estado de cuenta de OTRO tenant.
--   2. 🔴 Ni matchea contra un cargo o un asiento de otro tenant.
--   3. 🔴 La cabecera no se cuelga del proveedor de otro tenant.
--   4. 🔴 **La nota de crédito tampoco** — éste es el hueco que la 0114 dejó
--      abierto y que la 0115 cierra. Una nota contra el cargo ajeno le baja el
--      neto a otra empresa: es plata que se deja de pagar del lado de allá.
--   5. 🔴 Un cargo dado de baja no sirve como destino de match. Conciliar
--      contra algo borrado es conciliar contra nada.
--   6. Los match NULL pasan — una línea sin conciliar tiene que poder existir,
--      que es el estado en que nacen todas.
--   7. 🔴 Borrar el estado borra sus líneas (cascade), pero borrar un CARGO
--      **no** borra la línea: la deja sin match (`set null`). La asimetría es
--      deliberada y va en los dos sentidos — la línea es evidencia de lo que
--      el socio facturó, y no se pierde porque del lado del ERP se corrija algo.
--   8. Los CHECK de `match_status` y `match_confidence` acotan el vocabulario.
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

-- ── Esqueleto mínimo (el mismo que pide la 0114) ──────────────────────────
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
create table public.supplier_bills (id uuid primary key default gen_random_uuid(), tenant_id uuid);

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
\ir ../migrations/0115_partner_statements.sql

-- ── Fixtures ──────────────────────────────────────────────────────────────
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'
insert into public.tenants (id, slug) values (:'t1', 'dtd'), (:'t2', 'otro');

\set s1 'aa111111-1111-1111-1111-111111111111'
\set s2 'ab222222-2222-2222-2222-222222222222'
insert into public.suppliers (id, tenant_id, name) values
  (:'s1', :'t1', 'Socio China'), (:'s2', :'t2', 'Socio de otro');

-- Un cargo y un asiento por tenant, más un cargo dado de baja en el tenant 1.
\set c1 'ca111111-1111-1111-1111-111111111111'
\set c2 'cb222222-2222-2222-2222-222222222222'
\set cx 'cc999999-9999-9999-9999-999999999999'
insert into public.supplier_charges (id, tenant_id, supplier_id, description, amount, deleted_at) values
  (:'c1', :'t1', :'s1', 'flete contenedor',  4200.00, null),
  (:'c2', :'t2', :'s2', 'flete del otro',    1000.00, null),
  (:'cx', :'t1', :'s1', 'cargo dado de baja', 300.00, now());

\set l1 'da111111-1111-1111-1111-111111111111'
\set l2 'db222222-2222-2222-2222-222222222222'
insert into public.partner_ledger_entries
  (id, tenant_id, supplier_id, entry_code, entry_type, direction, amount_usd) values
  (:'l1', :'t1', :'s1', 'PLE-2026-0001', 'costo_contenedor', 'debe', 4200.00),
  (:'l2', :'t2', :'s2', 'PLE-2026-0001', 'costo_contenedor', 'debe', 1000.00);

-- Un estado de cuenta por tenant.
\set e1 'ea111111-1111-1111-1111-111111111111'
\set e2 'eb222222-2222-2222-2222-222222222222'
insert into public.partner_statements (id, tenant_id, supplier_id, period_label, total_usd) values
  (:'e1', :'t1', :'s1', '2026-Q1', 4200.00),
  (:'e2', :'t2', :'s2', '2026-Q1', 1000.00);

create or replace function pg_temp.n_lineas() returns int language sql as $n$
  select count(*)::int from public.partner_statement_lines
$n$;

-- ── 1 · 🔴 La línea no se cuelga del estado de OTRO tenant ────────────────
do $$
begin
  begin
    insert into public.partner_statement_lines
      (tenant_id, statement_id, raw_description, amount)
    values ('11111111-1111-1111-1111-111111111111',
            'eb222222-2222-2222-2222-222222222222',   -- estado del tenant 2
            'linea colada', 100.00);
  exception when others then null;
  end;

  if pg_temp.n_lineas() <> 0 then
    raise exception 'CONTRATO 1 ROTO: una linea entro en el estado de cuenta de OTRO tenant';
  end if;
end;
$$;

-- ── 2 · 🔴 Ni matchea contra el cargo o el asiento de otro tenant ─────────
do $$
begin
  begin
    insert into public.partner_statement_lines
      (tenant_id, statement_id, raw_description, amount, matched_charge_id, match_status)
    values ('11111111-1111-1111-1111-111111111111',
            'ea111111-1111-1111-1111-111111111111', 'match cruzado', 100.00,
            'cb222222-2222-2222-2222-222222222222',   -- cargo del tenant 2
            'match_manual');
  exception when others then null;
  end;

  begin
    insert into public.partner_statement_lines
      (tenant_id, statement_id, raw_description, amount, matched_ledger_entry_id, match_status)
    values ('11111111-1111-1111-1111-111111111111',
            'ea111111-1111-1111-1111-111111111111', 'match cruzado 2', 100.00,
            'db222222-2222-2222-2222-222222222222',   -- asiento del tenant 2
            'match_manual');
  exception when others then null;
  end;

  if pg_temp.n_lineas() <> 0 then
    raise exception
      'CONTRATO 2 ROTO: entraron % lineas conciliadas contra el ERP de otro tenant',
      pg_temp.n_lineas();
  end if;
end;
$$;

-- ── 3 · 🔴 La cabecera no se cuelga del proveedor de otro tenant ──────────
do $$
declare v_n int;
begin
  begin
    insert into public.partner_statements (tenant_id, supplier_id, period_label)
    values ('11111111-1111-1111-1111-111111111111',
            'ab222222-2222-2222-2222-222222222222', '2026-Q2');
  exception when others then null;
  end;

  select count(*) into v_n from public.partner_statements
   where tenant_id = '11111111-1111-1111-1111-111111111111';
  if v_n <> 1 then
    raise exception 'CONTRATO 3 ROTO: se importo un estado de cuenta contra el proveedor de OTRO tenant';
  end if;
end;
$$;

-- ── 4 · 🔴 La nota de crédito tampoco ─────────────────────────────────────
--
-- Éste es el hueco que la 0114 dejó abierto y que la 0115 cierra. Una nota
-- contra el cargo ajeno le baja el neto a otra empresa: es plata que se deja
-- de pagar del lado de allá, sin que nada avise.
do $$
declare v_n int;
begin
  begin
    insert into public.supplier_credit_notes (tenant_id, charge_id, reason, amount)
    values ('11111111-1111-1111-1111-111111111111',
            'cb222222-2222-2222-2222-222222222222',   -- cargo del tenant 2
            'nota cruzada', 50.00);
  exception when others then null;
  end;

  select count(*) into v_n from public.supplier_credit_notes;
  if v_n <> 0 then
    raise exception 'CONTRATO 4 ROTO: una nota de credito descuenta del cargo de OTRO tenant';
  end if;

  -- Y contra el cargo propio sí entra.
  insert into public.supplier_credit_notes (tenant_id, charge_id, reason, amount)
  values ('11111111-1111-1111-1111-111111111111',
          'ca111111-1111-1111-1111-111111111111', 'cobró de más', 50.00);
  select count(*) into v_n from public.supplier_credit_notes;
  if v_n <> 1 then
    raise exception 'CONTRATO 4 ROTO: una nota de credito LEGITIMA fue rechazada';
  end if;
end;
$$;

-- ── 5 · 🔴 Un cargo dado de baja no sirve como destino ────────────────────
do $$
begin
  begin
    insert into public.partner_statement_lines
      (tenant_id, statement_id, raw_description, amount, matched_charge_id, match_status)
    values ('11111111-1111-1111-1111-111111111111',
            'ea111111-1111-1111-1111-111111111111', 'match a un fantasma', 300.00,
            'cc999999-9999-9999-9999-999999999999', 'match_manual');
  exception when others then null;
  end;

  if pg_temp.n_lineas() <> 0 then
    raise exception 'CONTRATO 5 ROTO: se concilio contra un cargo dado de baja';
  end if;
end;
$$;

-- ── 6 · Sin match sí entra (así nacen todas) ──────────────────────────────
\set n1 'fa111111-1111-1111-1111-111111111111'
do $$
begin
  insert into public.partner_statement_lines
    (id, tenant_id, statement_id, raw_description, amount, currency)
  values ('fa111111-1111-1111-1111-111111111111',
          '11111111-1111-1111-1111-111111111111',
          'ea111111-1111-1111-1111-111111111111',
          'OCEAN FREIGHT SHA-LAG', 4200.00, 'USD');

  -- Y el match legítimo contra el ERP propio también.
  update public.partner_statement_lines
     set matched_charge_id = 'ca111111-1111-1111-1111-111111111111',
         match_status = 'match_auto',
         match_confidence = 'alta'
   where id = 'fa111111-1111-1111-1111-111111111111';

  if (select match_status from public.partner_statement_lines
       where id = 'fa111111-1111-1111-1111-111111111111') <> 'match_auto' then
    raise exception 'CONTRATO 6 ROTO: un match LEGITIMO fue rechazado — la reconciliacion no puede operar';
  end if;
end;
$$;

-- ── 7 · 🔴 Borrar el cargo NO borra la línea; borrar el estado SÍ ─────────
--
-- La asimetría es deliberada y va en los dos sentidos. La línea es evidencia
-- de lo que el socio facturó: no se pierde porque del lado del ERP se corrija
-- algo. Pero sí se va con su estado de cuenta, que es su contenedor natural.
do $$
declare v_n int; v_match uuid;
begin
  -- Se suelta la nota de crédito primero (su restrict sujeta el cargo — ver
  -- el contrato 5 de la 0114) para poder probar el `set null` de acá.
  delete from public.supplier_credit_notes
   where charge_id = 'ca111111-1111-1111-1111-111111111111';
  delete from public.supplier_charges where id = 'ca111111-1111-1111-1111-111111111111';

  select count(*) into v_n from public.partner_statement_lines
   where id = 'fa111111-1111-1111-1111-111111111111';
  if v_n <> 1 then
    raise exception 'CONTRATO 7 ROTO: borrar un cargo del ERP se llevo la linea del estado — se pierde la evidencia del socio';
  end if;

  select matched_charge_id into v_match from public.partner_statement_lines
   where id = 'fa111111-1111-1111-1111-111111111111';
  if v_match is not null then
    raise exception 'CONTRATO 7 ROTO: la linea quedo apuntando a un cargo que ya no existe';
  end if;

  -- Y borrar el estado sí se lleva sus líneas.
  delete from public.partner_statements where id = 'ea111111-1111-1111-1111-111111111111';
  if pg_temp.n_lineas() <> 0 then
    raise exception 'CONTRATO 7 ROTO: borrar el estado dejo lineas huerfanas';
  end if;
end;
$$;

-- ── 8 · El vocabulario de la conciliación está acotado ────────────────────
--
-- ⚠️ El estado de cuenta es del MISMO tenant a propósito. La primera versión de
-- este contrato usaba el del tenant 2, así que lo rechazaba el TRIGGER
-- cross-tenant y no el CHECK — pasaba en verde con el CHECK arrancado. En
-- Postgres los BEFORE triggers corren ANTES que los CHECK, y los dos levantan
-- `check_violation`: son indistinguibles desde el `exception when`. La única
-- forma de probar el CHECK es que no haya nada más que pueda rechazar la fila.
do $$
declare v_e uuid; v_n int;
begin
  insert into public.partner_statements (id, tenant_id, supplier_id, period_label)
  values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
          'aa111111-1111-1111-1111-111111111111', '2026-Q3')
  returning id into v_e;

  begin
    insert into public.partner_statement_lines
      (tenant_id, statement_id, raw_description, amount, match_status)
    values ('11111111-1111-1111-1111-111111111111', v_e, 'x', 1, 'mas_o_menos');
  exception when others then null;
  end;

  begin
    insert into public.partner_statement_lines
      (tenant_id, statement_id, raw_description, amount, match_confidence)
    values ('11111111-1111-1111-1111-111111111111', v_e, 'x', 1, 'segurisimo');
  exception when others then null;
  end;

  if pg_temp.n_lineas() <> 0 then
    raise exception
      'CONTRATO 8 ROTO: entraron % lineas con vocabulario inventado — la reconciliacion deja de ser legible',
      pg_temp.n_lineas();
  end if;

  -- NULL sí es válido: el motor puede no opinar sobre la confianza.
  insert into public.partner_statement_lines
    (tenant_id, statement_id, raw_description, amount, match_confidence)
  values ('11111111-1111-1111-1111-111111111111', v_e, 'sin opinion', 1, null);

  select count(*) into v_n from public.partner_statement_lines;
  if v_n <> 1 then
    raise exception 'CONTRATO 8 ROTO: una linea sin opinion de confianza fue rechazada';
  end if;
end;
$$;

rollback;
