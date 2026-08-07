\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0350. Fixtures ficticios y rollback: no toca prod.
--
-- Lo que defiende, que es exactamente lo que puede romperse en silencio:
--   1. el CHECK de la tabla acepta 'studio.access_link',
--   2. el CHECK sigue rechazando cualquier valor inventado,
--   3. la VALIDACIÓN DE LA FUNCIÓN acepta 'studio.access_link',
--   4. la VALIDACIÓN DE LA FUNCIÓN sigue rechazando cualquier valor inventado,
--   5. el evento del tipo nuevo se registra con entity_type 'membership'
--      (registrado en audit_entity_types — hay FK desde entity_audit_log),
--   6. los 'portal.*' NO cambian de entity/event type — cero regresión,
--   7. el event_type nuevo cumple el contrato de 0267 (regex + no termina en
--      un sufijo reservado de reversión),
--   8. la plantilla studio_access_link queda activa en cada tenant.
--
-- Los puntos 1-2 y 3-4 están separados A PROPÓSITO: el valor permitido vive en
-- DOS lugares (CHECK de tabla y `not in` dentro de la función). Un test que
-- sólo mirara uno daría verde con el otro roto.

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

-- ── Superficie D5 tal como la deja 0293 ────────────────────────────────────
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

create table public.mail_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  slug text not null,
  name text not null,
  category text not null,
  channel text not null,
  lang text not null default 'es',
  subject text not null,
  body_html text not null,
  active boolean not null default true,
  unique (tenant_id, slug)
);

create table public.audit_d5_external_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  operation_key uuid not null,
  operation_type text not null check (
    operation_type in (
      'portal.whatsapp_link',
      'portal.bulk_whatsapp_link',
      'portal.email_invite',
      'portal.email_resend'
    )
  ),
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

-- Captura de eventos: el stub de append_audit_event guarda lo que le pasan,
-- que es justo lo que queremos afirmar (entity_type / event_type).
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
begin
  if p_operation_id is null
     or p_operation_type not in (
       'portal.whatsapp_link',
       'portal.bulk_whatsapp_link',
       'portal.email_invite',
       'portal.email_resend'
     ) then
    raise exception 'invalid_input' using errcode='22023';
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

  if v_inserted_count = 1 then
    perform public.append_audit_event(
      v_tenant_id, 'portal_invitation', v_entity_id, 'user', v_actor_id,
      'portal_invitation_requested', 'rpc', 'succeeded', null,
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
\ir ../migrations/0350_audit_d5_studio_access_link.sql

-- ── 1 + 2. El CHECK de la tabla ────────────────────────────────────────────
do $t1$
declare ok boolean;
begin
  insert into public.audit_d5_external_operations
    (tenant_id, operation_key, operation_type, requested_by)
  values (
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    'studio.access_link',
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
    raise exception 'El CHECK aceptó un operation_type inventado';
  end if;
end;
$t1$;

-- ── 3 + 4 + 5 + 7. La validación de la FUNCIÓN y el evento que emite ───────
do $t2$
declare
  v_res jsonb;
  ok boolean;
  n int;
  ev record;
begin
  v_res := public.audit_d5_external_intent(
    '55555555-5555-5555-5555-555555555555',
    'studio.access_link',
    '22222222-2222-2222-2222-222222222222'
  );
  if v_res is null then
    raise exception 'La función rechazó studio.access_link';
  end if;

  ok := false;
  begin
    perform public.audit_d5_external_intent(
      '66666666-6666-6666-6666-666666666666',
      'studio.inventado',
      null
    );
  exception when others then ok := true;
  end;
  if not ok then
    raise exception 'La función aceptó un operation_type inventado';
  end if;

  select count(*) into n from public.eventos_capturados
   where entity_type = 'membership'
     and event_type = 'membership_access_link_requested';
  if n <> 1 then
    raise exception 'El evento de studio.access_link no salió como membership (% filas)', n;
  end if;

  -- Contrato de 0267: el event_type tiene que pasar el regex y no puede
  -- terminar en un sufijo reservado de reversión.
  select * into ev from public.eventos_capturados
   where event_type = 'membership_access_link_requested' limit 1;
  if ev.event_type !~ '^[a-z][a-z0-9_]{1,79}$' then
    raise exception 'event_type % no cumple el regex de 0267', ev.event_type;
  end if;
  if ev.event_type ~ '(_rejected|_voided|_cancelled|_canceled|_overridden|_deleted|_restored|_reversed)$' then
    raise exception 'event_type % usa un sufijo reservado', ev.event_type;
  end if;
end;
$t2$;

-- ── 6. Los portal.* no se movieron ─────────────────────────────────────────
do $t3$
declare n int;
begin
  perform public.audit_d5_external_intent(
    '77777777-7777-7777-7777-777777777777',
    'portal.email_invite',
    null
  );

  select count(*) into n from public.eventos_capturados
   where entity_type = 'portal_invitation'
     and event_type = 'portal_invitation_requested'
     and meta ->> 'operation_type' = 'portal.email_invite';
  if n <> 1 then
    raise exception 'portal.email_invite cambió de entity/event type (% filas)', n;
  end if;

  -- Y no se contaminó con el par nuevo.
  select count(*) into n from public.eventos_capturados
   where meta ->> 'operation_type' like 'portal.%'
     and entity_type <> 'portal_invitation';
  if n <> 0 then
    raise exception 'Un portal.* salió con entity_type ajeno (% filas)', n;
  end if;
end;
$t3$;

-- ── 8. La plantilla de correo ──────────────────────────────────────────────
do $t4$
declare n int; body text;
begin
  select count(*) into n from public.mail_templates
   where slug = 'studio_access_link' and active;
  if n <> 1 then
    raise exception 'La plantilla studio_access_link no quedó activa (% filas)', n;
  end if;

  select body_html into body from public.mail_templates
   where slug = 'studio_access_link';
  if body not like '%{{access_link}}%' then
    raise exception 'La plantilla no interpola {{access_link}} — el correo saldría sin enlace';
  end if;
end;
$t4$;

rollback;
