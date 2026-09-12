\set ON_ERROR_STOP on

-- Contrato desechable de SDD-0339. Usa datos ficticios y rollback total.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema auth;
create function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.clients (
  id uuid primary key,
  tenant_id uuid not null,
  markbox text not null,
  deleted_at timestamptz
);

create table public.client_users (
  auth_user_id uuid,
  client_id uuid not null,
  tenant_id uuid not null,
  status text not null
);

create table public.invoices (
  tenant_id uuid not null,
  client_markbox text not null,
  currency text not null,
  total_amount numeric not null,
  fx_rate numeric,
  status text not null,
  issued_at date,
  created_at timestamptz not null,
  deleted_at timestamptz
);

create table public.referrals (
  id uuid primary key,
  tenant_id uuid not null,
  referrer_markbox text not null,
  referred_name text not null,
  referred_company text,
  referred_email text,
  referred_phone text,
  status text not null,
  reward_usd numeric not null,
  lead_id text,
  notes text,
  created_at timestamptz not null,
  deleted_at timestamptz
);

create table public.referral_settings (
  tenant_id uuid primary key,
  referrer_reward_usd numeric not null,
  referred_reward_usd numeric not null
);

insert into public.clients (id, tenant_id, markbox, deleted_at) values
  ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-1001', null),
  ('10000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'DTD-2002', null),
  ('10000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-1003', now());

insert into public.client_users (auth_user_id, client_id, tenant_id, status) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'active'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'active'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'revoked'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'active');

insert into public.invoices (
  tenant_id, client_markbox, currency, total_amount, fx_rate, status,
  issued_at, created_at, deleted_at
) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'DTD-1001', 'USD', 100, null, 'emitida', current_date, now(), null),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'DTD-1001', 'VES', 3700, 37, 'pagada', current_date, now(), null),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'DTD-1001', 'CNY', 9999, null, 'pagada', current_date, now(), null),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'DTD-1001', 'USD', 500, null, 'borrador', current_date, now(), null),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'DTD-1001', 'USD', 700, null, 'pagada', current_date - 400, now() - interval '400 days', null),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'DTD-2002', 'USD', 900, null, 'pagada', current_date, now(), null);

insert into public.referral_settings values
  ('aaaaaaaa-0000-0000-0000-000000000001', 100, 50);

insert into public.referrals (
  id, tenant_id, referrer_markbox, referred_name, referred_company,
  referred_email, referred_phone, status, reward_usd, lead_id, notes,
  created_at, deleted_at
) values
  ('30000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-1001', 'Ana Referida', 'Empresa A', 'ana@example.test', '+58 414 000 0001', 'acreditado', 100, 'LEAD-SECRETO', 'NOTA-SECRETA', now(), null),
  ('30000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'DTD-2002', 'Luis Referido', 'Empresa B', 'luis@example.test', '+58 414 000 0002', 'registrado', 0, 'LEAD-AJENO', 'NOTA-AJENA', now(), null);

\ir ../migrations/0404_portal_referidos_por_principal.sql

do $contract$
declare
  v_oid oid := pg_catalog.to_regprocedure('public.get_portal_referral_program()');
begin
  if v_oid is null then raise exception 'TEST 0404: la RPC no existe'; end if;
  if pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', v_oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE') then
    raise exception 'TEST 0404: ACL inválida';
  end if;
  if pg_catalog.pg_get_function_result(v_oid) <> 'jsonb' then
    raise exception 'TEST 0404: la firma no devuelve jsonb mínimo';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc as p
    where p.oid = v_oid and p.prosecdef
      and exists (
        select 1 from pg_catalog.unnest(coalesce(p.proconfig, '{}'::text[])) as config
        where config ~ '^search_path=("")?$'
      )
  ) then
    raise exception 'TEST 0404: falta SECURITY DEFINER con search_path vacío';
  end if;
end;
$contract$;

set local role authenticated;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
do $own_program$
declare v_program jsonb := public.get_portal_referral_program();
begin
  if v_program->>'markbox' <> 'DTD-1001'
     or (v_program->>'billed_usd')::numeric <> 200
     or (v_program->>'referrer_reward_usd')::numeric <> 100
     or (v_program->>'referred_reward_usd')::numeric <> 50
     or pg_catalog.jsonb_array_length(v_program->'referrals') <> 1
     or v_program#>>'{referrals,0,referred_name}' <> 'Ana Referida' then
    raise exception 'TEST 0404: snapshot propio incompleto: %', v_program;
  end if;
  if v_program::text ~ '(ana@example|414 000 0001|LEAD-SECRETO|NOTA-SECRETA|tenant_id|client_id)'
     or v_program::text like '%Luis Referido%' then
    raise exception 'TEST 0404: el snapshot filtró PII/campos internos o tenant ajeno: %', v_program;
  end if;
end;
$own_program$;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000002';
do $other_tenant$
declare v_program jsonb := public.get_portal_referral_program();
begin
  if v_program->>'markbox' <> 'DTD-2002'
     or (v_program->>'billed_usd')::numeric <> 900
     or (v_program->>'referrer_reward_usd')::numeric <> 80
     or (v_program->>'referred_reward_usd')::numeric <> 60
     or v_program#>>'{referrals,0,referred_name}' <> 'Luis Referido'
     or v_program::text like '%Ana Referida%' then
    raise exception 'TEST 0404: aislamiento/fallback del segundo tenant inválido: %', v_program;
  end if;
end;
$other_tenant$;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000003';
do $revoked$
begin
  if public.get_portal_referral_program() is not null then
    raise exception 'TEST 0404: una vinculación revocada obtuvo programa';
  end if;
end;
$revoked$;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000004';
do $deleted$
begin
  if public.get_portal_referral_program() is not null then
    raise exception 'TEST 0404: un cliente eliminado obtuvo programa';
  end if;
end;
$deleted$;

reset role;
rollback;

select pg_catalog.to_regprocedure('public.get_portal_referral_program()') is null
  as portal_referrals_0404_fixture_rolled_back;
