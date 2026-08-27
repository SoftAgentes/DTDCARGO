\set ON_ERROR_STOP on

-- Contrato de la capa legal (SDD-0054 · migr 0102).
-- Fixtures ficticios y rollback: no toca prod.
--
-- ── POR QUÉ IMPORTA ───────────────────────────────────────────────────────
--
-- `legal_acceptances` es la ÚNICA prueba de que un cliente aceptó las
-- condiciones. En Venezuela, sin certificado de un PSC acreditado por SUSCERTE,
-- esa aceptación se valora por sana crítica (art. 17 LMDFE): vale lo que valga
-- la integridad del registro. Una fila que se puede editar después no prueba
-- nada — y el día que se necesita es el día de un reclamo, cuando ya es tarde
-- para descubrir que el trigger no estaba.
--
-- ── QUÉ SE PROTEGE ────────────────────────────────────────────────────────
--
--   1. 🔴 Append-only de verdad: ni UPDATE ni DELETE, ni siquiera con los
--      grants puestos (el grant habilita el verbo; el trigger lo corta).
--   2. 🔴 `hash` NOT NULL — es LOAD-BEARING: el gate AUT-04 lo recomputa y
--      compara. Sin hash no hay nada que verificar.
--   3. 🔴 Idempotencia por hash. La migración lo dice explícito: dos NULL en
--      `idempotency_key` NO colisionan en Postgres, así que un reintento sin
--      esa clave duplicaría la evidencia. El unique por hash es lo que evita
--      dos aceptaciones para un solo acto.
--   4. 🔴 El cliente tiene que ser del MISMO tenant. La FK garantiza que
--      existe, no de quién es.
--   5. 🔴 Como máximo UN documento vigente por (tenant, key). Con dos, «las
--      condiciones vigentes» que el cliente aceptó son ambiguas — y eso es
--      justo lo que un reclamo discute.
--   6. El correlativo AC-YYYY-NNNN no se comparte entre tenants.
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

create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  name       text,
  deleted_at timestamptz
);

-- Las policies de `legal_docs` miran el rol en user_tenants. Acá sólo hace
-- falta que la tabla exista para que la policy compile: quién puede escribir un
-- documento legal lo cubren los contratos de RLS de 0019, no éste.
create table public.user_tenants (
  user_id     uuid,
  tenant_id   uuid,
  role        text,
  disabled_at timestamptz
);

create or replace function public.get_user_tenant_id()
returns uuid language sql stable as $gut$ select null::uuid $gut$;

\ir ../migrations/0102_capa_legal.sql

-- ── Fixtures ──────────────────────────────────────────────────────────────
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'
insert into public.tenants (id, slug) values (:'t1', 'dtd'), (:'t2', 'otro');

\set c1 'c1111111-1111-1111-1111-111111111111'
\set c2 'c2222222-2222-2222-2222-222222222222'
insert into public.clients (id, tenant_id, name) values
  (:'c1', :'t1', 'Cliente del tenant 1'),
  (:'c2', :'t2', 'Cliente del tenant 2');

insert into public.legal_acceptances
  (id, tenant_id, acceptance_code, client_id, client_markbox, quote_code,
   docs, cbm, weight_kg, total_usd, hash)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', :'t1', 'AC-2026-0001', :'c1',
   'DTD-0001', 'Q-2026-0001',
   '[{"key":"tyc","version":3}]'::jsonb, 2.500, 300.00, 1200.00,
   'hash-original-de-la-aceptacion');

-- ── 1 · 🔴 La evidencia no se reescribe ───────────────────────────────────
do $$
begin
  update public.legal_acceptances
     set total_usd = 1.00
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  raise exception 'CONTRATO 1 ROTO: se pudo EDITAR una aceptacion legal — la prueba deja de probar';
exception
  when check_violation then null;  -- esperado
end;
$$;

-- Y no se editó ni de casualidad.
do $$
declare v numeric;
begin
  select total_usd into v from public.legal_acceptances
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v <> 1200.00 then
    raise exception 'CONTRATO 1 ROTO: el monto quedo en % (era 1200.00)', v;
  end if;
end;
$$;

-- ── 2 · 🔴 La evidencia no se borra ───────────────────────────────────────
do $$
declare v_n int;
begin
  begin
    delete from public.legal_acceptances
     where id = 'aaaaaaaa-0000-0000-0000-000000000001';
    raise exception 'CONTRATO 2 ROTO: se pudo BORRAR una aceptacion legal';
  exception
    when check_violation then null;  -- esperado
  end;

  select count(*) into v_n from public.legal_acceptances;
  if v_n <> 1 then
    raise exception 'CONTRATO 2 ROTO: quedan % filas donde deberia haber 1', v_n;
  end if;
end;
$$;

-- ── 3 · 🔴 Sin hash no hay evidencia ──────────────────────────────────────
--
-- El gate AUT-04 recomputa el hash y lo compara. Una fila sin hash pasa por
-- aceptación y no se puede verificar contra nada.
do $$
begin
  insert into public.legal_acceptances
    (tenant_id, acceptance_code, client_id, hash)
  values ('11111111-1111-1111-1111-111111111111', 'AC-2026-0009',
          'c1111111-1111-1111-1111-111111111111', null);
  raise exception 'CONTRATO 3 ROTO: entro una aceptacion SIN hash — no hay nada que verificar';
exception
  when not_null_violation then null;  -- esperado
end;
$$;

-- ── 4 · 🔴 El mismo hash no entra dos veces ───────────────────────────────
--
-- La migración es explícita: dos NULL en `idempotency_key` NO colisionan en
-- Postgres, así que un reintento sin esa clave duplicaría la evidencia. Las dos
-- filas de abajo van con `idempotency_key` NULL a propósito — si la protección
-- fuera esa y no el hash, este contrato pasaría igual y no probaría nada.
do $$
declare v_n int;
begin
  begin
    insert into public.legal_acceptances
      (tenant_id, acceptance_code, client_id, hash, idempotency_key)
    values ('11111111-1111-1111-1111-111111111111', 'AC-2026-0002',
            'c1111111-1111-1111-1111-111111111111',
            'hash-original-de-la-aceptacion', null);
    raise exception 'CONTRATO 4 ROTO: el mismo hash entro dos veces — un reintento duplica la prueba';
  exception
    when unique_violation then null;  -- esperado
  end;

  select count(*) into v_n from public.legal_acceptances
   where tenant_id = '11111111-1111-1111-1111-111111111111';
  if v_n <> 1 then
    raise exception 'CONTRATO 4 ROTO: hay % aceptaciones para un solo acto', v_n;
  end if;
end;
$$;

-- Pero OTRO tenant sí puede tener el mismo hash: el unique es por (tenant, hash).
do $$
begin
  insert into public.legal_acceptances
    (tenant_id, acceptance_code, client_id, hash)
  values ('22222222-2222-2222-2222-222222222222', 'AC-2026-0001',
          'c2222222-2222-2222-2222-222222222222',
          'hash-original-de-la-aceptacion');
exception when others then
  raise exception 'CONTRATO 4 ROTO: el unique de hash es global y no por tenant (%)', sqlerrm;
end;
$$;

-- ── 5 · 🔴 El cliente tiene que ser del mismo tenant ──────────────────────
do $$
begin
  insert into public.legal_acceptances
    (tenant_id, acceptance_code, client_id, hash)
  values ('11111111-1111-1111-1111-111111111111', 'AC-2026-0003',
          'c2222222-2222-2222-2222-222222222222',  -- cliente del tenant 2
          'hash-cruzado');
  raise exception 'CONTRATO 5 ROTO: se sello una aceptacion contra un cliente de OTRO tenant';
exception
  when check_violation then null;  -- esperado
end;
$$;

-- Sin cliente sí se puede (client_id es nullable por diseño: aceptación de un
-- visitante que todavía no es cliente).
do $$
begin
  insert into public.legal_acceptances
    (tenant_id, acceptance_code, client_id, hash)
  values ('11111111-1111-1111-1111-111111111111', 'AC-2026-0004', null,
          'hash-sin-cliente');
exception when others then
  raise exception 'CONTRATO 5 ROTO: una aceptacion sin cliente fue rechazada (%)', sqlerrm;
end;
$$;

-- ── 6 · 🔴 Un solo documento vigente por (tenant, key) ────────────────────
--
-- Con dos vigentes, «las condiciones que el cliente aceptó» son ambiguas — y
-- eso es exactamente lo que se discute en un reclamo.
do $$
begin
  insert into public.legal_docs (tenant_id, key, version, name, effective_date, audience, status)
  values ('11111111-1111-1111-1111-111111111111', 'tyc', 'v3',
          'Términos y Condiciones', '2026-01-01', 'cliente', 'vigente');

  begin
    insert into public.legal_docs (tenant_id, key, version, name, effective_date, audience, status)
    values ('11111111-1111-1111-1111-111111111111', 'tyc', 'v4',
            'Términos y Condiciones', '2026-06-01', 'cliente', 'vigente');
    raise exception 'CONTRATO 6 ROTO: dos versiones vigentes del mismo documento a la vez';
  exception
    when unique_violation then null;  -- esperado
  end;

  -- Archivada sí convive: el histórico es lo que conserva qué se aceptó.
  insert into public.legal_docs (tenant_id, key, version, name, effective_date, audience, status)
  values ('11111111-1111-1111-1111-111111111111', 'tyc', 'v2',
          'Términos y Condiciones', '2025-01-01', 'cliente', 'archivada');
end;
$$;

-- ── 7 · El correlativo no se comparte entre tenants ───────────────────────
do $$
declare v1 text; v2 text;
begin
  v1 := public.next_acceptance_code('11111111-1111-1111-1111-111111111111');
  v2 := public.next_acceptance_code('22222222-2222-2222-2222-222222222222');

  if v1 !~ '^AC-[0-9]{4}-[0-9]{4}$' then
    raise exception 'CONTRATO 7 ROTO: el codigo no tiene forma AC-YYYY-NNNN (es %)', v1;
  end if;
  -- El tenant 1 ya tiene AC-2026-0001 y AC-2026-0004 → el próximo es el 5º.
  if v1 not like '%-0005' then
    raise exception 'CONTRATO 7 ROTO: el tenant 1 iba por 0005 y dio %', v1;
  end if;
  -- El tenant 2 tiene UNA sola aceptación → va por el 2º, no por el 5º.
  if v2 not like '%-0002' then
    raise exception 'CONTRATO 7 ROTO: el contador se comparte entre tenants (tenant 2 dio %)', v2;
  end if;
end;
$$;

rollback;
