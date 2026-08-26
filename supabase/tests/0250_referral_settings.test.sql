\set ON_ERROR_STOP on

-- Contrato desechable del trigger de acreditación automática (SDD-0309).
-- Fixtures ficticios y rollback: no toca prod.
--
-- ⚠️ SE CARGAN TRES MIGRACIONES, NO UNA
--
-- La función vive repartida: `0197` la creó con el premio HARDCODEADO en 80,
-- `0238` agregó `accredited_at`, y `0250` la reescribió para leer el premio de
-- `referral_settings`. Producción corre la versión de **0250**.
--
-- Un contrato que cargara sólo la 0197 probaría un comportamiento que ya no
-- existe — y saldría verde. Por eso el archivo se llama por la migración que
-- HOY es dueña del cuerpo de la función.
--
-- POR QUÉ EXISTE, MESES DESPUÉS DE LA MIGRACIÓN
--
-- El trigger `invoices_accredit_referral` está VIVO en producción desde la
-- Fase 2 y **nunca ha corrido**: `referrals` tiene 0 filas (medido 2026-08-26).
-- Su primera ejecución real va a ser con un referido de verdad, y lo que
-- escribe es **dinero** (`reward_usd`). Cero cobertura hasta hoy.
--
-- LO QUE SE PROTEGE
--
--   1. Que acredite en la 1ª factura billable del referido. Es la razón de ser.
--   2. 🔴 Que NO acredite dos veces. El premio se pagaría doble.
--   3. Que un BORRADOR no acredite. Una factura sin emitir no es una compra.
--   4. Que una factura BORRADA no acredite.
--   5. 🔴 Aislamiento por tenant: la factura de un tenant NO acredita el
--      referido de otro. Con dinero de por medio es el contrato que más
--      importa, y el que ningún test de aplicación puede cubrir.
--   6. Que el premio salga de `referral_settings`, no de un número fijo.
--
-- Cada contrato se validó rompiéndolo a propósito: un contrato verde que sigue
-- verde con la protección apagada es decorado.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

-- ── Esqueleto mínimo: sólo lo que el trigger toca o referencia ────────────
create type referral_status as enum
  ('invitado', 'registrado', 'primer-embarque', 'acreditado');

-- Stubs de la plataforma (auth, vault, extensions): las migraciones los
-- dan por sentados. Mismo archivo que usa el gate de schema-rebuild.
\ir _supabase-platform-stubs.sql

create table public.tenants (id uuid primary key, slug text);

create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  markbox    text not null,
  deleted_at timestamptz
);

create table public.referrals (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null,
  referred_client_id uuid,
  status             referral_status not null default 'invitado',
  reward_usd         numeric(12,2) not null default 0,
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null,
  client_markbox text not null,
  status         text not null,
  deleted_at     timestamptz
);

-- `referral_settings` la crea la 0250; acá sólo va lo que las migraciones
-- asumen que ya existe.
-- Las policies de la 0250 la invocan. Stub: el contrato prueba el TRIGGER,
-- no la RLS (el trigger es SECURITY DEFINER y no pasa por policies).
create or replace function public.get_user_tenant_id()
returns uuid language sql stable as $gut$ select null::uuid $gut$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $touch$
begin
  new.updated_at := now();
  return new;
end;
$touch$;

\ir ../migrations/0197_referral_auto_accredit.sql
\ir ../migrations/0238_referrals_accredited_at.sql
\ir ../migrations/0250_referral_settings.sql

-- ── Fixtures ──────────────────────────────────────────────────────────────
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'

insert into public.tenants (id) values (:'t1'), (:'t2');

insert into public.clients (id, tenant_id, markbox) values
  ('aaaaaaaa-0000-0000-0000-000000000001', :'t1', 'DTD-0001'),
  -- 🔴 Este markbox existe SOLO en el tenant 2. Es lo que hace detectable el
  -- contrato 5: si el lookup del cliente perdiera su filtro de tenant, una
  -- factura del tenant 1 lo encontraría y acreditaría a un referido ajeno.
  ('aaaaaaaa-0000-0000-0000-000000000002', :'t2', 'DTD-9999');

insert into public.referral_settings (tenant_id, referrer_reward_usd)
values (:'t1', 125.00);

insert into public.referrals (id, tenant_id, referred_client_id, status) values
  ('bbbbbbbb-0000-0000-0000-000000000001', :'t1', 'aaaaaaaa-0000-0000-0000-000000000001', 'registrado'),
  ('bbbbbbbb-0000-0000-0000-000000000002', :'t2', 'aaaaaaaa-0000-0000-0000-000000000002', 'registrado');

-- ── 1 · La 1ª factura billable acredita, con el premio de settings ────────
do $$
declare v_status text; v_reward numeric;
begin
  insert into public.invoices (tenant_id, client_markbox, status)
  values ('11111111-1111-1111-1111-111111111111', 'DTD-0001', 'emitida');

  select status::text, reward_usd into v_status, v_reward
  from public.referrals where id = 'bbbbbbbb-0000-0000-0000-000000000001';

  if v_status <> 'acreditado' then
    raise exception 'CONTRATO 1 ROTO: la factura emitida no acredito (status=%)', v_status;
  end if;
  -- 6 · el premio sale de referral_settings, no de un 80 hardcodeado.
  if v_reward <> 125.00 then
    raise exception 'CONTRATO 6 ROTO: el premio no salio de referral_settings (%)', v_reward;
  end if;
end;
$$;

-- ── 5 · 🔴 Una factura del tenant 1 NO acredita al referido del tenant 2 ──
--
-- El markbox `DTD-9999` sólo existe en el tenant 2. Se emite una factura del
-- tenant 1 con ESE markbox: si el lookup del cliente perdiera su filtro de
-- tenant, encontraría al cliente ajeno y le pagaría el premio a un referidor de
-- otra empresa. Con dinero de por medio es el contrato que más importa.
do $$
declare v_status text;
begin
  insert into public.invoices (tenant_id, client_markbox, status)
  values ('11111111-1111-1111-1111-111111111111', 'DTD-9999', 'emitida');

  select status::text into v_status
  from public.referrals where id = 'bbbbbbbb-0000-0000-0000-000000000002';
  if v_status <> 'registrado' then
    raise exception 'CONTRATO 5 ROTO: una factura del tenant 1 acredito el referido del tenant 2 (status=%)', v_status;
  end if;
end;
$$;

-- ── 2 · 🔴 Una segunda factura NO vuelve a acreditar ──────────────────────
do $$
declare v_n int;
begin
  update public.referrals set reward_usd = 999
   where id = 'bbbbbbbb-0000-0000-0000-000000000001';

  insert into public.invoices (tenant_id, client_markbox, status)
  values ('11111111-1111-1111-1111-111111111111', 'DTD-0001', 'pagada');

  select count(*) into v_n
  from public.referrals
  where id = 'bbbbbbbb-0000-0000-0000-000000000001' and reward_usd = 999;

  if v_n <> 1 then
    raise exception 'CONTRATO 2 ROTO: se re-acredito un referido ya acreditado — el premio se pagaria doble';
  end if;
end;
$$;

-- ── 3 · Un BORRADOR no acredita ───────────────────────────────────────────
do $$
declare v_status text;
begin
  insert into public.referrals (id, tenant_id, referred_client_id, status)
  values ('bbbbbbbb-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
          'aaaaaaaa-0000-0000-0000-000000000001', 'registrado');

  insert into public.invoices (tenant_id, client_markbox, status)
  values ('11111111-1111-1111-1111-111111111111', 'DTD-0001', 'borrador');

  select status::text into v_status
  from public.referrals where id = 'bbbbbbbb-0000-0000-0000-000000000003';
  if v_status <> 'registrado' then
    raise exception 'CONTRATO 3 ROTO: un borrador acredito (status=%) — una factura sin emitir no es una compra', v_status;
  end if;
end;
$$;

-- ── 4 · Una factura BORRADA no acredita ───────────────────────────────────
do $$
declare v_status text;
begin
  insert into public.invoices (tenant_id, client_markbox, status, deleted_at)
  values ('11111111-1111-1111-1111-111111111111', 'DTD-0001', 'emitida', now());

  select status::text into v_status
  from public.referrals where id = 'bbbbbbbb-0000-0000-0000-000000000003';
  if v_status <> 'registrado' then
    raise exception 'CONTRATO 4 ROTO: una factura borrada acredito (status=%)', v_status;
  end if;
end;
$$;

-- ── 1b · El borrador que se EMITE sí acredita ─────────────────────────────
--
-- Es el camino normal del Studio: la factura nace borrador y se emite después.
-- Si el trigger sólo mirara el INSERT, este caso —el más común— no acreditaría
-- nunca.
do $$
declare v_id uuid; v_status text;
begin
  insert into public.invoices (tenant_id, client_markbox, status)
  values ('11111111-1111-1111-1111-111111111111', 'DTD-0001', 'borrador')
  returning id into v_id;

  update public.invoices set status = 'emitida' where id = v_id;

  select status::text into v_status
  from public.referrals where id = 'bbbbbbbb-0000-0000-0000-000000000003';
  if v_status <> 'acreditado' then
    raise exception 'CONTRATO 1b ROTO: emitir un borrador no acredito (status=%) — es el camino normal', v_status;
  end if;
end;
$$;

rollback;
