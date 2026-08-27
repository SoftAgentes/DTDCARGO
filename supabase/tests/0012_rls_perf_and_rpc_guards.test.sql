\set ON_ERROR_STOP on

-- Contrato del guard de tenant en las RPC (migr 0012 · auditoría RLS 2026-05-24).
-- Fixtures ficticios y rollback: no toca prod.
--
-- ── POR QUÉ IMPORTA ───────────────────────────────────────────────────────
--
-- Los siete generadores de correlativo (`next_markbox`, `next_quote_code`, …)
-- son **security definer**: corren con los privilegios del dueño y se saltan
-- RLS por diseño, porque tienen que barrer la tabla entera para calcular el
-- siguiente número. Eso los vuelve la superficie más golosa del schema: si no
-- validan a quién le pertenece el tenant que se les pasa, cualquier usuario
-- autenticado le quema el correlativo a otra empresa —o le lee cuántos clientes
-- tiene— con una sola llamada.
--
-- Ése fue el FINDING-001 (CRITICAL) de la auditoría, y `assert_tenant_match` es
-- lo que lo cerró. No tenía contrato.
--
-- ── 🔴 LO QUE DE VERDAD SE PROTEGE: LA LÓGICA DE TRES VALORES ────────────
--
-- El guard parece que podría ser una línea:
--
--     if p_tenant_id <> v_caller_tenant then raise; end if;
--
-- Y **estaría roto**. En SQL, `NULL <> 'algo'` no es TRUE: es **NULL**. Un `if`
-- con condición NULL no dispara. O sea que esa versión de una línea **deja
-- pasar** al llamador sin sesión — que es justo el atacante, no el caso raro.
--
-- Por eso el guard tiene DOS `is null` explícitos antes de comparar, y por eso
-- los contratos 1 y 2 de acá son los importantes: prueban el agujero que la
-- versión "obvia" tendría.
--
-- ── QUÉ SE PROTEGE ────────────────────────────────────────────────────────
--
--   1. 🔴 Sin tenant en el argumento → rechaza.
--   2. 🔴 Sin sesión (el caller no resuelve tenant) → rechaza. Éste es el que
--      la comparación suelta dejaría pasar.
--   3. 🔴 Tenants distintos → rechaza, con 42501.
--   4. Tenants iguales → deja pasar (si no, el ERP no puede crear nada).
--   5. 🔴 Los SIETE correlativos llaman al guard. Se prueban los siete: basta
--      que a uno le falte el `perform` para que quede abierto mientras el resto
--      sigue cerrado.
--   6. 🔴 `anon` no puede ejecutar ninguno. Un `revoke` que se pierda en un
--      `create or replace` posterior devuelve el agujero sin que nada avise.
--   7. 🔴 Todas son `security definer` **con `search_path` fijado**. Sin fijarlo,
--      quien controle el search_path puede anteponer un esquema propio y hacer
--      que la función ejecute SU tabla — escalada de privilegios (ADVISOR-A).
--
-- Cada contrato se validó rompiéndolo a propósito.

begin;

\ir _supabase-platform-stubs.sql

-- ── Esqueleto mínimo ──────────────────────────────────────────────────────
-- Sólo lo que los siete correlativos barren para calcular su próximo número.
create table public.tenants (id uuid primary key, slug text);

create table public.user_tenants (
  user_id     uuid,
  tenant_id   uuid,
  role        text,
  disabled_at timestamptz
);

create table public.clients             (id uuid primary key default gen_random_uuid(), tenant_id uuid, markbox text, deleted_at timestamptz);
create table public.quotes              (id uuid primary key default gen_random_uuid(), tenant_id uuid, quote_code text, deleted_at timestamptz);
create table public.warehouse_receipts_cn (id uuid primary key default gen_random_uuid(), tenant_id uuid, receipt_code text, orphan_code text, deleted_at timestamptz);
create table public.customs_filings     (id uuid primary key default gen_random_uuid(), tenant_id uuid, dua_code text, deleted_at timestamptz);
create table public.tms_routes          (id uuid primary key default gen_random_uuid(), tenant_id uuid, route_code text, deleted_at timestamptz);
create table public.tms_incidents       (id uuid primary key default gen_random_uuid(), tenant_id uuid, incident_code text, deleted_at timestamptz);

-- El resto de las tablas que las policies de la 0012 nombran. Sólo tienen que
-- existir con `tenant_id` para que el DDL de las policies aplique: ninguna se
-- consulta en estos contratos.
create table public.shipments        (id uuid primary key default gen_random_uuid(), tenant_id uuid, status text, deleted_at timestamptz, arrived_destination_at timestamptz, delivered_at timestamptz, updated_at timestamptz not null default now());
create table public.shipment_events  (id uuid primary key default gen_random_uuid(), tenant_id uuid, shipment_id uuid, deleted_at timestamptz);
create table public.customs_documents(id uuid primary key default gen_random_uuid(), tenant_id uuid, filing_id uuid, updated_at timestamptz not null default now());
create table public.rates            (id uuid primary key default gen_random_uuid(), tenant_id uuid, updated_at timestamptz not null default now(), deleted_at timestamptz);
create table public.warehouse_receipt_items  (id uuid primary key default gen_random_uuid(), tenant_id uuid, receipt_id uuid, updated_at timestamptz not null default now(), deleted_at timestamptz);
create table public.warehouse_receipt_events (id uuid primary key default gen_random_uuid(), tenant_id uuid, receipt_id uuid, deleted_at timestamptz);

create table public.tms_drivers (id uuid primary key default gen_random_uuid(), tenant_id uuid, updated_at timestamptz not null default now(), deleted_at timestamptz);
create table public.tms_trucks  (id uuid primary key default gen_random_uuid(), tenant_id uuid, updated_at timestamptz not null default now(), deleted_at timestamptz);

-- Los otros trigger helpers que la 0012 recrea con search_path.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $c$ begin new.updated_at := now(); return new; end; $c$;
create or replace function public.set_arrived_destination_at()
returns trigger language plpgsql as $c$ begin return new; end; $c$;
create or replace function public.set_delivered_at()
returns trigger language plpgsql as $c$ begin return new; end; $c$;
create or replace function public.seed_customs_documents()
returns trigger language plpgsql as $c$ begin return new; end; $c$;
create or replace function public.tms_route_status_timestamps()
returns trigger language plpgsql as $c$ begin return new; end; $c$;

-- Las dos funciones de trigger a las que la 0012 les revoca el EXECUTE.
create or replace function public.cascade_soft_delete_events()
returns trigger language plpgsql as $c$ begin return new; end; $c$;
create or replace function public.create_initial_shipment_event()
returns trigger language plpgsql as $c$ begin return new; end; $c$;

\ir ../migrations/0012_rls_perf_and_rpc_guards.sql

-- ── Fixtures ──────────────────────────────────────────────────────────────
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'
insert into public.tenants (id, slug) values (:'t1', 'dtd'), (:'t2', 'otro');

\set u1 'aa111111-1111-1111-1111-111111111111'
\set u2 'ab222222-2222-2222-2222-222222222222'
insert into auth.users (id, email) values (:'u1', 'uno@dtd.test'), (:'u2', 'dos@otro.test');
insert into public.user_tenants (user_id, tenant_id, role) values
  (:'u1', :'t1', 'admin'),
  (:'u2', :'t2', 'admin');

/*
 * Se hace pasar por un usuario. `auth.uid()` de los stubs lee el GUC `test.uid`,
 * así que esto es lo más cerca de una sesión real que se puede montar en un
 * Postgres desechable.
 */
create or replace function pg_temp.como(p_uid text) returns void
language sql as $c$ select set_config('test.uid', coalesce(p_uid, ''), true)::void $c$;

/*
 * ¿El guard dejó pasar? Devuelve true si NO lanzó. Se afirma sobre eso y no
 * sobre el mensaje: lo que importa es si la puerta se abrió.
 */
create or replace function pg_temp.paso(p_tenant uuid) returns boolean
language plpgsql as $c$
begin
  perform public.assert_tenant_match(p_tenant);
  return true;
exception when others then
  return false;
end;
$c$;

-- ── 1 · 🔴 Sin tenant en el argumento ─────────────────────────────────────
do $$
begin
  perform pg_temp.como('aa111111-1111-1111-1111-111111111111');
  if pg_temp.paso(null) then
    raise exception 'CONTRATO 1 ROTO: el guard dejo pasar un tenant NULL';
  end if;
end;
$$;

-- ── 2 · 🔴 Sin sesión ─────────────────────────────────────────────────────
--
-- ÉSTE es el agujero de la versión de una línea. Sin sesión,
-- `get_user_tenant_id()` devuelve NULL, y `NULL <> '1111…'` evalúa a NULL —
-- no a TRUE. Un `if` con condición NULL no dispara, así que la comparación
-- suelta dejaría entrar exactamente al que no tiene por qué entrar.
do $$
begin
  perform pg_temp.como(null);   -- sin sesión
  if pg_temp.paso('11111111-1111-1111-1111-111111111111') then
    raise exception
      'CONTRATO 2 ROTO: un llamador SIN SESION paso el guard — es el caso que la comparacion suelta deja entrar';
  end if;

  -- Y un usuario que existe pero no está en ningún tenant, igual.
  perform pg_temp.como('cccccccc-cccc-cccc-cccc-cccccccccccc');
  if pg_temp.paso('11111111-1111-1111-1111-111111111111') then
    raise exception 'CONTRATO 2 ROTO: un usuario sin tenant paso el guard';
  end if;
end;
$$;

-- ── 3 · 🔴 Tenants distintos ──────────────────────────────────────────────
do $$
begin
  perform pg_temp.como('ab222222-2222-2222-2222-222222222222');   -- del tenant 2
  if pg_temp.paso('11111111-1111-1111-1111-111111111111') then
    raise exception 'CONTRATO 3 ROTO: el usuario del tenant 2 paso el guard del tenant 1';
  end if;
end;
$$;

-- ── 4 · El caso legítimo pasa ─────────────────────────────────────────────
--
-- Sin esto, un guard que rechazara TODO también pasaría los tres de arriba y
-- el ERP no podría crear un cliente.
do $$
begin
  perform pg_temp.como('aa111111-1111-1111-1111-111111111111');
  if not pg_temp.paso('11111111-1111-1111-1111-111111111111') then
    raise exception 'CONTRATO 4 ROTO: el dueno del tenant NO paso su propio guard';
  end if;
end;
$$;

-- ── 5 · 🔴 Los SIETE correlativos llaman al guard ─────────────────────────
--
-- Se prueban los siete, uno por uno. Basta que a uno le falte el `perform`
-- para que quede abierto mientras los otros seis siguen cerrados — y un
-- contrato que probara sólo `next_markbox` no vería nada.
do $$
declare
  v_rpc    text;
  v_abrio  text[] := '{}';
  v_nego   text[] := '{}';
begin
  -- Sesión del tenant 2 intentando quemar el correlativo del tenant 1.
  perform pg_temp.como('ab222222-2222-2222-2222-222222222222');

  foreach v_rpc in array array[
    'next_markbox', 'next_quote_code', 'next_receipt_code', 'next_orphan_code',
    'next_dua_code', 'next_route_code', 'next_incident_code'
  ]
  loop
    begin
      execute format('select public.%I($1)', v_rpc)
        using '11111111-1111-1111-1111-111111111111'::uuid;
      v_abrio := v_abrio || v_rpc;      -- devolvió un número: la puerta se abrió
    exception when others then
      v_nego := v_nego || v_rpc;
    end;
  end loop;

  if array_length(v_abrio, 1) is not null then
    raise exception
      'CONTRATO 5 ROTO: % correlativo(s) del tenant 1 se dejaron quemar desde el tenant 2: %',
      array_length(v_abrio, 1), array_to_string(v_abrio, ', ');
  end if;
  if coalesce(array_length(v_nego, 1), 0) <> 7 then
    raise exception 'CONTRATO 5 ROTO: se probaron % RPC en vez de 7', coalesce(array_length(v_nego, 1), 0);
  end if;

  -- Y con su propio tenant, los siete responden (si no, el ERP queda mudo).
  perform pg_temp.como('aa111111-1111-1111-1111-111111111111');
  foreach v_rpc in array array[
    'next_markbox', 'next_quote_code', 'next_receipt_code', 'next_orphan_code',
    'next_dua_code', 'next_route_code', 'next_incident_code'
  ]
  loop
    begin
      execute format('select public.%I($1)', v_rpc)
        using '11111111-1111-1111-1111-111111111111'::uuid;
    exception when others then
      raise exception 'CONTRATO 5 ROTO: % nego el correlativo a su PROPIO tenant (%)', v_rpc, sqlerrm;
    end;
  end loop;
end;
$$;

-- ── 6 · 🔴 `anon` no ejecuta ninguna ──────────────────────────────────────
--
-- El `revoke` es lo único que separa a un visitante anónimo de una función
-- security definer que barre la tabla entera. Un `create or replace` posterior
-- que no lo repita devuelve el agujero sin que nada avise.
do $$
declare v_abiertas text;
begin
  select string_agg(p.proname, ', ')
    into v_abiertas
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (
       'assert_tenant_match', 'get_user_tenant_id', 'next_markbox',
       'next_quote_code', 'next_receipt_code', 'next_orphan_code',
       'next_dua_code', 'next_route_code', 'next_incident_code',
       'cascade_soft_delete_events', 'create_initial_shipment_event')
     and has_function_privilege('anon', p.oid, 'EXECUTE');

  if v_abiertas is not null then
    raise exception 'CONTRATO 6 ROTO: anon puede ejecutar %', v_abiertas;
  end if;
end;
$$;

-- ── 7 · 🔴 Security definer SIN search_path fijado es escalada ────────────
--
-- Una función security definer sin `search_path` resuelve los nombres con el
-- search_path del LLAMADOR: quien lo controle antepone un esquema propio y hace
-- que la función corra SU tabla con los privilegios del dueño. Es el ADVISOR-A
-- de la auditoría.
do $$
declare v_sueltas text;
begin
  select string_agg(p.proname, ', ')
    into v_sueltas
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef                                  -- security definer
     and p.proname in (
       'assert_tenant_match', 'get_user_tenant_id', 'next_markbox',
       'next_quote_code', 'next_receipt_code', 'next_orphan_code',
       'next_dua_code', 'next_route_code', 'next_incident_code')
     and not exists (
       select 1 from unnest(coalesce(p.proconfig, '{}')) c
        where c like 'search_path=%'
     );

  if v_sueltas is not null then
    raise exception
      'CONTRATO 7 ROTO: security definer con search_path suelto (escalada de privilegios): %',
      v_sueltas;
  end if;
end;
$$;

rollback;
