\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0387. Fixtures ficticios y rollback: no toca prod.
--
-- Lo que defiende, que es exactamente lo que puede romperse en silencio:
--   1. el CHECK de la tabla acepta 'studio.email_change',
--   2. el CHECK sigue rechazando cualquier valor inventado,
--   3. la VALIDACIÓN DE LA FUNCIÓN acepta 'studio.email_change',
--   4. la VALIDACIÓN DE LA FUNCIÓN sigue rechazando cualquier valor inventado,
--   5. el evento del tipo nuevo se registra con entity_type 'membership' y
--      event_type 'membership_email_changed',
--   6. REGRESIÓN: 'studio.access_link' sobrevive intacto al recrear el CHECK y
--      la función — conserva su propio event_type, no hereda el nuevo,
--   7. REGRESIÓN: los 'portal.*' siguen con portal_invitation / _requested,
--   8. el event_type nuevo cumple el contrato de 0267 (regex + no termina en
--      un sufijo reservado de reversión).
--
-- Los puntos 1-2 y 3-4 están separados A PROPÓSITO: el valor permitido vive en
-- DOS lugares (CHECK de tabla y `not in` dentro de la función). Un test que
-- sólo mirara uno daría verde con el otro roto — la lección de 0350.
--
-- El estado PREVIO que arma este archivo es el que dejó 0350, no el de 0293:
-- 0387 se aplica encima de aquél, y el punto 6 sólo tiene sentido si el valor
-- de 0350 ya estaba antes de correr la migración bajo prueba.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.tenants (id uuid primary key);

-- `studio_access_tokens` sólo hace falta para que pase el preflight de 0387.
-- La revocación en sí la ejecuta la server action con el service role, no SQL.
create table public.studio_access_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  token text not null,
  created_by uuid,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz
);

create table public.audit_entity_types (
  entity_type text primary key,
  status text not null,
  domain_code text not null,
  contract_version integer not null default 1,
  introduced_by_ref text
);
insert into public.audit_entity_types values
  ('membership', 'active', 'access', 1, 'migration:0289'),
  ('portal_invitation', 'active', 'access', 1, 'migration:0293');

create table public.audit_d5_external_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  operation_key uuid not null,
  operation_type text not null,
  target_id uuid,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'intent_recorded',
  attempt_count integer not null default 0,
  error_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  next_attempt_at timestamptz,
  finished_at timestamptz,
  unique (tenant_id, operation_key)
);

-- Estado PREVIO = el que dejó 0350 (con studio.access_link ya adentro).
alter table public.audit_d5_external_operations
  add constraint audit_d5_external_operations_operation_type_check
  check (
    operation_type in (
      'portal.whatsapp_link',
      'portal.bulk_whatsapp_link',
      'portal.email_invite',
      'portal.email_resend',
      'studio.access_link'
    )
  );

create table public.eventos_capturados (
  entity_type text,
  entity_id uuid,
  event_type text,
  meta jsonb
);

create function public.append_audit_event(
  p_tenant_id uuid, p_entity_type text, p_entity_id uuid, p_actor_type text,
  p_actor_id uuid, p_event_type text, p_source text, p_status text,
  p_reason text, p_before jsonb, p_after jsonb, p_meta jsonb,
  p_dedupe text, p_version integer, p_sensitivity text
) returns void language plpgsql set search_path = '' as $$
begin
  -- Espeja la FK real de entity_audit_log (migr 0258): un entity_type sin
  -- registrar revienta. Sin esto el test no vería el error más probable.
  if not exists (
    select 1 from public.audit_entity_types
    where entity_type = p_entity_type and status = 'active'
  ) then
    raise exception 'entity_type % no registrado en audit_entity_types', p_entity_type;
  end if;
  insert into public.eventos_capturados values
    (p_entity_type, p_entity_id, p_event_type, p_after);
end;
$$;

create function public.audit_d5_admin_tenant() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.tenants limit 1;
$$;

-- Versión post-0350 de la función, con su case de entity/event.
create function public.audit_d5_external_intent(
  p_operation_id uuid,
  p_operation_type text,
  p_target_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_tenant_id uuid := public.audit_d5_admin_tenant();
  v_actor_id uuid := auth.uid();
  v_operation public.audit_d5_external_operations%rowtype;
  v_entity_id uuid := coalesce(p_target_id, p_operation_id);
  v_inserted_count integer := 0;
  v_entity_type text;
  v_event_type text;
begin
  if p_operation_id is null
     or p_operation_type not in (
       'portal.whatsapp_link',
       'portal.bulk_whatsapp_link',
       'portal.email_invite',
       'portal.email_resend',
       'studio.access_link'
     ) then
    raise exception 'invalid_input' using errcode='22023';
  end if;

  if p_operation_type = 'studio.access_link' then
    v_entity_type := 'membership';
    v_event_type := 'membership_access_link_requested';
  else
    v_entity_type := 'portal_invitation';
    v_event_type := 'portal_invitation_requested';
  end if;

  insert into public.audit_d5_external_operations (
    tenant_id, operation_key, operation_type, target_id, requested_by
  ) values (
    v_tenant_id, p_operation_id, p_operation_type, p_target_id, v_actor_id
  )
  on conflict (tenant_id, operation_key) do nothing;
  get diagnostics v_inserted_count = row_count;

  select * into v_operation
  from public.audit_d5_external_operations
  where tenant_id=v_tenant_id and operation_key=p_operation_id
  for update;

  if v_operation.operation_type <> p_operation_type
     or v_operation.target_id is distinct from p_target_id
     or v_operation.requested_by <> v_actor_id then
    raise exception 'idempotency_conflict' using errcode='23505';
  end if;

  if v_inserted_count = 1 then
    perform public.append_audit_event(
      v_tenant_id, v_entity_type, v_entity_id, 'user', v_actor_id,
      v_event_type, 'rpc', 'succeeded', null,
      null,
      pg_catalog.jsonb_build_object('operation_type', p_operation_type),
      '{}'::jsonb,
      pg_catalog.concat('d5:',p_operation_id::text),
      1, 'restricted'
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'operation_id', v_operation.operation_key,
    'status', v_operation.status
  );
end;
$function$;

-- ── Fixture ────────────────────────────────────────────────────────────────
insert into public.tenants values ('11111111-1111-1111-1111-111111111111');
insert into auth.users values ('22222222-2222-2222-2222-222222222222');
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

-- ── La migración bajo prueba ───────────────────────────────────────────────
\ir ../migrations/0387_audit_d5_studio_email_change.sql

-- ── 1 + 2. El CHECK de la tabla ────────────────────────────────────────────
do $t1$
declare ok boolean;
begin
  insert into public.audit_d5_external_operations
    (tenant_id, operation_key, operation_type, requested_by)
  values (
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    'studio.email_change',
    '22222222-2222-2222-2222-222222222222'
  );

  ok := false;
  begin
    insert into public.audit_d5_external_operations
      (tenant_id, operation_key, operation_type, requested_by)
    values (
      '11111111-1111-1111-1111-111111111111',
      '44444444-4444-4444-4444-444444444444',
      'studio.inventado',
      '22222222-2222-2222-2222-222222222222'
    );
  exception when check_violation then ok := true;
  end;
  if not ok then
    raise exception 'El CHECK acepto un operation_type inventado';
  end if;
end;
$t1$;

-- ── 6. REGRESIÓN: el CHECK no perdió el valor que ya tenía ─────────────────
do $t1b$
begin
  insert into public.audit_d5_external_operations
    (tenant_id, operation_key, operation_type, requested_by)
  values (
    '11111111-1111-1111-1111-111111111111',
    '3a3a3a3a-3a3a-3a3a-3a3a-3a3a3a3a3a3a',
    'studio.access_link',
    '22222222-2222-2222-2222-222222222222'
  );
end;
$t1b$;

-- ── 3 + 4 + 5 + 8. La validación de la FUNCIÓN y el evento que emite ───────
do $t2$
declare
  ok boolean;
  n int;
  ev record;
begin
  perform public.audit_d5_external_intent(
    '55555555-5555-5555-5555-555555555555',
    'studio.email_change',
    '22222222-2222-2222-2222-222222222222'
  );

  ok := false;
  begin
    perform public.audit_d5_external_intent(
      '66666666-6666-6666-6666-666666666666',
      'studio.inventado',
      '22222222-2222-2222-2222-222222222222'
    );
  exception when sqlstate '22023' then ok := true;
  end;
  if not ok then
    raise exception 'La funcion acepto un operation_type inventado';
  end if;

  select count(*) into n from public.eventos_capturados
   where event_type = 'membership_email_changed';
  if n <> 1 then
    raise exception 'Se esperaba 1 evento membership_email_changed, hubo %', n;
  end if;

  select * into ev from public.eventos_capturados
   where event_type = 'membership_email_changed';
  if ev.entity_type <> 'membership' then
    raise exception 'entity_type esperado membership, fue %', ev.entity_type;
  end if;

  -- Contrato de nombres de 0267.
  if 'membership_email_changed' !~ '^[a-z][a-z0-9_]{1,79}$' then
    raise exception 'membership_email_changed no cumple el regex de 0267';
  end if;
  if 'membership_email_changed' ~ '(_rejected|_voided|_cancelled|_canceled|_overridden|_deleted|_restored|_reversed)$' then
    raise exception 'membership_email_changed termina en un sufijo reservado de reversion';
  end if;
end;
$t2$;

-- ── 6 + 7. REGRESIÓN de entity/event de los tipos que ya existían ──────────
do $t3$
declare ev record;
begin
  perform public.audit_d5_external_intent(
    '77777777-7777-7777-7777-777777777777',
    'studio.access_link',
    '22222222-2222-2222-2222-222222222222'
  );
  select * into ev from public.eventos_capturados
   where event_type = 'membership_access_link_requested';
  if ev is null then
    raise exception 'studio.access_link dejo de emitir membership_access_link_requested';
  end if;

  perform public.audit_d5_external_intent(
    '88888888-8888-8888-8888-888888888888',
    'portal.email_invite',
    '22222222-2222-2222-2222-222222222222'
  );
  select * into ev from public.eventos_capturados
   where event_type = 'portal_invitation_requested';
  if ev is null then
    raise exception 'portal.email_invite dejo de emitir portal_invitation_requested';
  end if;
  if ev.entity_type <> 'portal_invitation' then
    raise exception 'portal.* cambio de entity_type a %', ev.entity_type;
  end if;
end;
$t3$;

rollback;
