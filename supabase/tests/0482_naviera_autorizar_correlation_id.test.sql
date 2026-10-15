\set ON_ERROR_STOP on

-- SDD-0532 · contrato de 0482 con el writer AUD-01 REAL.
--
-- El contrato de 0322 simula append_audit_event sin validar el correlation_id,
-- y usa referencias cortas ('naviera-auth-0001'). Por eso no vio que la
-- referencia de la pantalla (109 caracteres) hace un correlation_id de 174 y
-- el writer real lo rechaza. Este contrato monta el writer de verdad: la
-- plataforma mínima que el preflight de 0267 exige, 0267 y 0294 reales, y
-- después 0322 y 0482. Sin 0482 cae en el escenario 2 con 22023 «audit:
-- correlation_id inválido»: ése es el control rojo.
--
-- Termina siempre en ROLLBACK. No imprime payloads.
begin;

do $roles$
begin
  if to_regclass('public.entity_audit_log') is not null
     or to_regclass('public.consolidations') is not null then
    raise exception 'Fixture 0482 rechazada: los objetos reales ya existen';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

create schema auth;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

-- ── Plataforma previa a 0267: lo que su preflight exige ─────────────────────
create table public.tenants (id uuid primary key);

create table public.audit_entity_types (
  entity_type text primary key,
  status text not null check (status in ('active', 'deprecated')),
  domain_code text,
  contract_version integer,
  introduced_by_ref text
);

create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  actor_type text not null,
  actor_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint entity_audit_log_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint entity_audit_log_entity_type_fkey
    foreign key (entity_type) references public.audit_entity_types(entity_type)
    on update restrict on delete restrict,
  constraint entity_audit_log_actor_type_check
    check (actor_type in ('user', 'operario', 'system'))
);

alter table public.entity_audit_log enable row level security;
create policy entity_audit_log_tenant_select on public.entity_audit_log
  for select to authenticated using (true);
create policy entity_audit_log_service_role_all on public.entity_audit_log
  for all to service_role using (true) with check (true);
grant select on public.entity_audit_log to authenticated;
grant all on public.entity_audit_log to service_role;

create publication supabase_realtime;
alter publication supabase_realtime add table public.entity_audit_log;

\ir ../migrations/0267_audit_contract_append_only.sql
\ir ../migrations/0294_audit_d2_human_reasons.sql

-- ── Naviera: lo que 0322 necesita además de la auditoría ────────────────────
-- Mismas tablas y correlativo que el contrato de 0322.
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
create table public.consolidations (
  id uuid primary key, tenant_id uuid not null, ref text,
  booking_id uuid, sailing_id uuid, container_type text, container_no text,
  status text not null, notes text, requested_by_operario_id uuid,
  requested_at timestamptz, authorized_by uuid, authorized_at timestamptz,
  rejected_reason text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (tenant_id, ref)
);

create function public.next_consolidation_ref(p_tenant_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_max integer;
begin
  select coalesce(max((regexp_match(ref, '^DTD-CONSOL-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.consolidations
  where tenant_id = p_tenant_id;
  return 'DTD-CONSOL-' || lpad(v_max::text, 4, '0');
end $$;

\ir ../migrations/0322_naviera_consolidation_authorization_governance.sql
\ir ../migrations/0482_naviera_autorizar_correlation_id.sql

grant select, update on public.consolidations to authenticated;

insert into public.tenants values ('10000000-0000-0000-0000-000000000001');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','operations',null);
insert into public.consolidations (
  id, tenant_id, container_type, status, requested_by_operario_id, requested_at
) values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','40HC','solicitada','40000000-0000-4000-8000-000000000001',now()),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','20GP','solicitada','40000000-0000-4000-8000-000000000002',now()),
  ('30000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000001','40HC','solicitada','40000000-0000-4000-8000-000000000003',now());

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0482: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Autoriza como el operador de la fixture, igual que la Server Action.
create function pg_temp.autorizar(p_id uuid, p_ref text) returns jsonb language plpgsql as $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
  set local role authenticated;
  v_result := public.authorize_consolidation_governed(p_id, 'Capacidad y operación verificadas', p_ref);
  reset role;
  return v_result;
end;
$$;

-- Lo que la autorización tiene que dejar, con la referencia que se le dio.
create function pg_temp.assert_autorizada(p_id uuid, p_ref text, p_result jsonb, p_label text)
returns void language plpgsql as $$
declare
  v_correlation text;
  v_events integer;
begin
  perform pg_temp.assert_true(p_result->>'outcome' = 'transitioned',
    p_label || ': la RPC transiciona');
  perform pg_temp.assert_true(exists (
    select 1 from public.consolidations
    where id = p_id and status = 'consolidando' and ref = p_result->>'ref'
      and authorized_by = '20000000-0000-0000-0000-000000000001'
      and authorized_at is not null
  ), p_label || ': la solicitud queda consolidando con su correlativo y su actor');
  select count(*), max(correlation_id) into v_events, v_correlation
  from public.entity_audit_log
  where entity_id = p_id and event_type = 'consolidation_authorized';
  perform pg_temp.assert_true(v_events = 1, p_label || ': exactamente un AUD-01');
  perform pg_temp.assert_true(
    v_correlation = 'consolidation-authorization:' || p_id::text || ':' || md5(p_ref),
    p_label || ': correlation_id = prefijo, id y md5 de la referencia');
  perform pg_temp.assert_true(char_length(v_correlation) = 97,
    p_label || ': correlation_id de 97 caracteres');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = p_id and event_type = 'consolidation_authorized'
      and payload->>'request_ref' = p_ref
      and payload->>'consolidation_ref' = p_result->>'ref'
  ), p_label || ': payload.request_ref conserva la referencia completa');
end;
$$;

-- 1. El writer de este contrato es el real: rechaza un correlation_id de 129.
do $writer_real$
declare v_state text; v_message text;
begin
  begin
    perform public.append_audit_event(
      '10000000-0000-0000-0000-000000000001', 'consolidation',
      '30000000-0000-4000-8000-000000000001', 'system', null,
      'consolidation_probe', 'rpc', 'succeeded', null, null, null, '{}'::jsonb,
      repeat('a', 129), 1, 'internal'
    );
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;
  perform pg_temp.assert_true(v_state = '22023' and v_message = 'audit: correlation_id inválido',
    'el writer AUD-01 rechaza un correlation_id de 129');
  perform pg_temp.assert_true(not exists (
    select 1 from public.entity_audit_log where event_type = 'consolidation_probe'
  ), 'la sonda rechazada no deja evento');
end;
$writer_real$;

-- 2. La referencia que arma la pantalla (NavieraClient.tsx:706-707): 109.
do $pantalla$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000001';
  v_ref text := 'naviera-consolidation-authorization:' || v_id::text || ':' || gen_random_uuid()::text;
begin
  perform pg_temp.assert_true(char_length(v_ref) = 109, 'la referencia de la pantalla mide 109');
  perform pg_temp.assert_true(
    char_length('consolidation-authorization:' || v_id::text || ':' || v_ref) = 174,
    'con la 0322 el correlation_id mediría 174');
  perform pg_temp.assert_autorizada(v_id, v_ref, pg_temp.autorizar(v_id, v_ref), 'pantalla');

  -- 3. Replay idéntico: misma respuesta y ningún evento nuevo.
  perform pg_temp.assert_true(
    pg_temp.autorizar(v_id, v_ref)->>'outcome' = 'replayed'
    and (select count(*) from public.entity_audit_log
         where entity_id = v_id and event_type = 'consolidation_authorized') = 1,
    'el replay con la misma referencia no escribe otro AUD-01');
end;
$pantalla$;

-- 4. Umbral: 64 es la referencia más corta que la 0322 rechazaba (129).
do $umbral$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000002';
  v_ref text := 'r' || repeat('0', 63);
begin
  perform pg_temp.assert_true(
    char_length('consolidation-authorization:' || v_id::text || ':' || v_ref) = 129,
    'con la 0322 una referencia de 64 da un correlation_id de 129');
  perform pg_temp.assert_autorizada(v_id, v_ref, pg_temp.autorizar(v_id, v_ref), 'referencia de 64');
end;
$umbral$;

-- 5. Máxima: 128 es la referencia más larga que la RPC acepta.
do $maxima$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000003';
  v_ref text := 'naviera-consolidation-authorization:' || v_id::text || ':' || repeat('f', 128 - 73);
begin
  perform pg_temp.assert_true(char_length(v_ref) = 128, 'la referencia máxima mide 128');
  perform pg_temp.assert_autorizada(v_id, v_ref, pg_temp.autorizar(v_id, v_ref), 'referencia de 128');
end;
$maxima$;

-- 6. La RPC instalada es la de 0482 (su comentario lo dice).
do $catalogo$
begin
  perform pg_temp.assert_true(
    obj_description('public.authorize_consolidation_governed(uuid,text,text)'::regprocedure, 'pg_proc')
      like '%SDD-0532%',
    'el comentario de la RPC nombra la SDD-0532');
end;
$catalogo$;

select 'TEST 0482 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
