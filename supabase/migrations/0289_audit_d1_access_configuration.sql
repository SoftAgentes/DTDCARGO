-- ─────────────────────────────────────────────────────────────
-- 0289 · SDD-0174 D1 · Acceso y configuración auditables
--
-- Fronteras:
--   · mutaciones PostgreSQL: operación + cambio + evento en un commit;
--   · Supabase Auth: intención durable -> efecto externo -> confirmación o
--     compensación. No declara atomicidad ACID distribuida;
--   · payload de auditoría e idempotencia sin secretos ni PII.
--
-- Aplicación local solamente. Producción requiere autorización nominal del
-- basename exacto y el runbook aplicar-migraciones-prod.md.
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null then
    raise exception '0289 requiere append_audit_event de Corte B1';
  end if;

  if to_regclass('public.audit_d1_operations') is not null
     or to_regclass('public.audit_external_operations') is not null then
    raise exception '0289 abortado: las tablas D1 ya existen';
  end if;

  if to_regprocedure('public.audit_d1_execute(uuid,text,uuid,jsonb,text)') is not null
     or to_regprocedure('public.audit_d1_auth_intent(uuid,uuid,boolean,text)') is not null then
    raise exception '0289 abortado: las RPC D1 ya existen';
  end if;
end;
$preflight$;

insert into public.audit_entity_types (
  entity_type,
  status,
  domain_code,
  contract_version,
  introduced_by_ref
)
values
  ('membership',        'active', 'access',        1, 'migration:0289'),
  ('api_key',           'active', 'access',        1, 'migration:0289'),
  ('webhook',           'active', 'access',        1, 'migration:0289'),
  ('tenant',            'active', 'configuration', 1, 'migration:0289'),
  ('office',            'active', 'configuration', 1, 'migration:0289'),
  ('bank_account',      'active', 'configuration', 1, 'migration:0289'),
  ('feature_flag',      'active', 'configuration', 1, 'migration:0289'),
  ('notification_rule', 'active', 'configuration', 1, 'migration:0289'),
  ('agent',             'active', 'access',        1, 'migration:0289')
on conflict (entity_type) do update
set
  status = excluded.status,
  domain_code = excluded.domain_code,
  contract_version = greatest(
    public.audit_entity_types.contract_version,
    excluded.contract_version
  );

create table public.audit_d1_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  operation_id uuid not null,
  operation_type text not null,
  target_id uuid,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'succeeded')),
  result_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  unique (tenant_id, operation_id)
);

comment on table public.audit_d1_operations is
  'SDD-0174 D1: idempotencia mínima de mutaciones PostgreSQL. result_data solo conserva IDs/estados no sensibles.';

alter table public.audit_d1_operations enable row level security;
revoke all on table public.audit_d1_operations from public, anon, authenticated;
grant select, insert, update on table public.audit_d1_operations to service_role;

create table public.audit_external_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  operation_key uuid not null,
  operation_type text not null
    check (operation_type in ('membership.disable', 'membership.enable')),
  target_id uuid not null references auth.users(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check (char_length(reason) between 8 and 500),
  correlation_id text not null,
  desired_state text not null check (desired_state in ('disabled', 'enabled')),
  previous_state text not null check (previous_state in ('disabled', 'enabled')),
  status text not null check (status in (
    'intent_recorded',
    'auth_in_progress',
    'auth_succeeded',
    'confirmed',
    'auth_failed_retryable',
    'auth_failed_terminal',
    'confirmation_failed',
    'compensation_in_progress',
    'compensated',
    'reconciliation_required'
  )),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  last_error_code text,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  unique (tenant_id, operation_key)
);

comment on table public.audit_external_operations is
  'SDD-0174 D1: workflow durable de disable/enable. Metadatos únicamente; sin email, Auth metadata ni mensajes del proveedor.';

create index audit_external_operations_reconcile_idx
  on public.audit_external_operations (status, next_attempt_at, claim_expires_at)
  where status not in ('confirmed', 'auth_failed_terminal', 'compensated');

alter table public.audit_external_operations enable row level security;
revoke all on table public.audit_external_operations from public, anon, authenticated;
grant select, insert, update on table public.audit_external_operations to service_role;

create function public.audit_d1_admin_tenant()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tenant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select ut.tenant_id
    into v_tenant_id
  from public.user_tenants ut
  where ut.user_id = auth.uid()
    and ut.role = 'admin'
    and ut.disabled_at is null
  order by ut.created_at
  limit 1;

  if v_tenant_id is null then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  return v_tenant_id;
end;
$function$;

alter function public.audit_d1_admin_tenant() owner to postgres;
revoke all on function public.audit_d1_admin_tenant()
  from public, anon, authenticated, service_role;

create function public.audit_d1_execute(
  p_operation_id uuid,
  p_operation_type text,
  p_target_id uuid default null,
  p_input jsonb default '{}'::jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant_id uuid := public.audit_d1_admin_tenant();
  v_actor_id uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_operation public.audit_d1_operations%rowtype;
  v_entity_type text;
  v_entity_id uuid;
  v_event_type text;
  v_before jsonb;
  v_after jsonb;
  v_result jsonb := '{}'::jsonb;
  v_existing record;
  v_invitation record;
  v_agent_id uuid;
  v_slug text;
  v_tool text;
  v_events jsonb;
begin
  if p_operation_id is null
     or p_operation_type is null
     or pg_catalog.jsonb_typeof(coalesce(p_input, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  insert into public.audit_d1_operations (
    tenant_id,
    operation_id,
    operation_type,
    target_id,
    requested_by
  )
  values (
    v_tenant_id,
    p_operation_id,
    p_operation_type,
    p_target_id,
    v_actor_id
  )
  on conflict (tenant_id, operation_id) do nothing;

  select *
    into v_operation
  from public.audit_d1_operations
  where tenant_id = v_tenant_id
    and operation_id = p_operation_id
  for update;

  if v_operation.operation_type <> p_operation_type
     or v_operation.requested_by <> v_actor_id
     or (
       v_operation.target_id is not null
       and p_target_id is not null
       and v_operation.target_id <> p_target_id
     ) then
    raise exception 'idempotency_conflict' using errcode = '23505';
  end if;

  if v_operation.status = 'succeeded' then
    return v_operation.result_data;
  end if;

  case p_operation_type
    when 'membership.invite' then
      select *
        into v_invitation
      from public.studio_invite_user(
        p_input ->> 'email',
        p_input ->> 'role',
        coalesce(p_input ->> 'region', 've')
      );
      v_entity_type := 'membership';
      v_entity_id := v_invitation.invitation_id;
      v_event_type := 'membership_invited';
      v_after := pg_catalog.jsonb_build_object(
        'role', p_input ->> 'role',
        'region', coalesce(p_input ->> 'region', 've')
      );
      v_result := pg_catalog.jsonb_build_object(
        'entity_id', v_entity_id,
        'invitation_id', v_entity_id
      );

    when 'membership.role_change' then
      select ut.role
        into v_existing
      from public.user_tenants ut
      where ut.tenant_id = v_tenant_id
        and ut.user_id = p_target_id
      for update;
      if not found then
        raise exception 'invalid_state' using errcode = 'P0002';
      end if;
      perform public.studio_change_user_role(
        p_target_id,
        p_input ->> 'role'
      );
      v_entity_type := 'membership';
      v_entity_id := p_target_id;
      v_event_type := 'membership_role_changed';
      v_before := pg_catalog.jsonb_build_object('role', v_existing.role);
      v_after := pg_catalog.jsonb_build_object('role', p_input ->> 'role');
      v_result := pg_catalog.jsonb_build_object('entity_id', p_target_id);

    when 'membership.scope_change' then
      select ut.warehouse_scope
        into v_existing
      from public.user_tenants ut
      where ut.tenant_id = v_tenant_id
        and ut.user_id = p_target_id
      for update;
      if not found then
        raise exception 'invalid_state' using errcode = 'P0002';
      end if;
      perform public.studio_set_user_warehouse_scope(
        p_target_id,
        p_input ->> 'scope'
      );
      v_entity_type := 'membership';
      v_entity_id := p_target_id;
      v_event_type := 'membership_scope_changed';
      v_before := pg_catalog.jsonb_build_object(
        'warehouse_scope', v_existing.warehouse_scope
      );
      v_after := pg_catalog.jsonb_build_object(
        'warehouse_scope', p_input ->> 'scope'
      );
      v_result := pg_catalog.jsonb_build_object('entity_id', p_target_id);

    when 'membership.invitation_revoke' then
      if v_reason is null or char_length(v_reason) not between 8 and 500 then
        raise exception 'invalid_input' using errcode = '22023';
      end if;
      perform public.studio_revoke_invitation(p_target_id);
      v_entity_type := 'membership';
      v_entity_id := p_target_id;
      v_event_type := 'membership_invitation_revoked';
      v_after := pg_catalog.jsonb_build_object('revoked', true);
      v_result := pg_catalog.jsonb_build_object('entity_id', p_target_id);

    when 'notification_channel.link' then
      update public.user_profiles
      set
        telegram_link_code = p_input ->> 'link_code',
        updated_at = pg_catalog.clock_timestamp()
      where user_id = v_actor_id;
      if not found then
        raise exception 'invalid_state' using errcode = 'P0002';
      end if;
      v_entity_type := 'membership';
      v_entity_id := v_actor_id;
      v_event_type := 'notification_channel_link_requested';
      v_after := pg_catalog.jsonb_build_object(
        'channel', 'telegram',
        'link_requested', true
      );
      v_result := pg_catalog.jsonb_build_object('entity_id', v_actor_id);

    when 'notification_channel.unlink' then
      update public.user_profiles
      set
        telegram_chat_id = null,
        telegram_username = null,
        telegram_link_code = null,
        updated_at = pg_catalog.clock_timestamp()
      where user_id = v_actor_id;
      if not found then
        raise exception 'invalid_state' using errcode = 'P0002';
      end if;
      v_entity_type := 'membership';
      v_entity_id := v_actor_id;
      v_event_type := 'notification_channel_unlinked';
      v_after := pg_catalog.jsonb_build_object(
        'channel', 'telegram',
        'linked', false
      );
      v_result := pg_catalog.jsonb_build_object('entity_id', v_actor_id);

    when 'api_key.create' then
      insert into public.api_keys (
        tenant_id,
        name,
        key_prefix,
        key_hash,
        created_by
      )
      values (
        v_tenant_id,
        p_input ->> 'name',
        p_input ->> 'key_prefix',
        p_input ->> 'key_hash',
        v_actor_id
      )
      returning id into v_entity_id;
      v_entity_type := 'api_key';
      v_event_type := 'api_key_created';
      v_after := pg_catalog.jsonb_build_object(
        'name', p_input ->> 'name',
        'key_prefix', p_input ->> 'key_prefix'
      );
      v_result := pg_catalog.jsonb_build_object('entity_id', v_entity_id);

    when 'api_key.revoke' then
      if v_reason is null or char_length(v_reason) not between 8 and 500 then
        raise exception 'invalid_input' using errcode = '22023';
      end if;
      update public.api_keys
      set revoked_at = pg_catalog.clock_timestamp()
      where id = p_target_id
        and tenant_id = v_tenant_id
        and revoked_at is null
      returning id into v_entity_id;
      if v_entity_id is null then
        raise exception 'invalid_state' using errcode = 'P0002';
      end if;
      v_entity_type := 'api_key';
      v_event_type := 'api_key_revoked';
      v_after := pg_catalog.jsonb_build_object('revoked', true);
      v_result := pg_catalog.jsonb_build_object('entity_id', v_entity_id);

    when 'webhook.save' then
      v_events := coalesce(p_input -> 'events', '[]'::jsonb);
      if p_target_id is null then
        insert into public.webhooks (
          tenant_id,
          name,
          url,
          events,
          secret,
          active
        )
        values (
          v_tenant_id,
          p_input ->> 'name',
          p_input ->> 'url',
          v_events,
          p_input ->> 'secret',
          coalesce((p_input ->> 'active')::boolean, true)
        )
        returning id into v_entity_id;
        v_event_type := 'webhook_created';
        v_before := null;
      else
        select pg_catalog.jsonb_build_object(
          'active', w.active,
          'event_count', pg_catalog.jsonb_array_length(w.events)
        )
          into v_before
        from public.webhooks w
        where w.id = p_target_id
          and w.tenant_id = v_tenant_id
          and w.deleted_at is null
        for update;
        if not found then
          raise exception 'invalid_state' using errcode = 'P0002';
        end if;
        update public.webhooks
        set
          name = p_input ->> 'name',
          url = p_input ->> 'url',
          events = v_events,
          active = coalesce((p_input ->> 'active')::boolean, true)
        where id = p_target_id
          and tenant_id = v_tenant_id;
        v_entity_id := p_target_id;
        v_event_type := 'webhook_updated';
      end if;
      v_entity_type := 'webhook';
      v_after := pg_catalog.jsonb_build_object(
        'active', coalesce((p_input ->> 'active')::boolean, true),
        'event_count', pg_catalog.jsonb_array_length(v_events)
      );
      v_result := pg_catalog.jsonb_build_object('entity_id', v_entity_id);

    when 'webhook.delete' then
      if v_reason is null or char_length(v_reason) not between 8 and 500 then
        raise exception 'invalid_input' using errcode = '22023';
      end if;
      update public.webhooks
      set deleted_at = pg_catalog.clock_timestamp()
      where id = p_target_id
        and tenant_id = v_tenant_id
        and deleted_at is null
      returning id into v_entity_id;
      if v_entity_id is null then
        raise exception 'invalid_state' using errcode = 'P0002';
      end if;
      v_entity_type := 'webhook';
      v_event_type := 'webhook_deleted';
      v_after := pg_catalog.jsonb_build_object('deleted', true);
      v_result := pg_catalog.jsonb_build_object('entity_id', v_entity_id);

    when 'tenant.identity_update' then
      select pg_catalog.jsonb_build_object(
        'iva_enabled', t.iva_enabled,
        'iva_rate', t.iva_rate,
        'islr_rate', t.islr_rate,
        'igtf_rate', t.igtf_rate
      )
        into v_before
      from public.tenants t
      where t.id = v_tenant_id
      for update;
      update public.tenants
      set
        legal_name = p_input ->> 'legal_name',
        trade_name = nullif(p_input ->> 'trade_name', ''),
        rif = nullif(p_input ->> 'rif', ''),
        commercial_email = nullif(p_input ->> 'commercial_email', ''),
        phone = nullif(p_input ->> 'phone', ''),
        whatsapp = nullif(p_input ->> 'whatsapp', ''),
        website = nullif(p_input ->> 'website', ''),
        iva_enabled = (p_input ->> 'iva_enabled')::boolean,
        iva_rate = (p_input ->> 'iva_rate')::numeric,
        islr_rate = (p_input ->> 'islr_rate')::numeric,
        igtf_rate = (p_input ->> 'igtf_rate')::numeric
      where id = v_tenant_id;
      v_entity_type := 'tenant';
      v_entity_id := v_tenant_id;
      v_event_type := 'tenant_identity_updated';
      v_after := pg_catalog.jsonb_build_object(
        'iva_enabled', (p_input ->> 'iva_enabled')::boolean,
        'iva_rate', (p_input ->> 'iva_rate')::numeric,
        'islr_rate', (p_input ->> 'islr_rate')::numeric,
        'igtf_rate', (p_input ->> 'igtf_rate')::numeric
      );
      v_result := pg_catalog.jsonb_build_object('entity_id', v_entity_id);

    when 'office.save' then
      if p_target_id is null then
        insert into public.company_offices (
          tenant_id,
          country,
          name,
          address
        )
        values (
          v_tenant_id,
          p_input ->> 'country',
          p_input ->> 'name',
          p_input ->> 'address'
        )
        returning id into v_entity_id;
        v_event_type := 'office_created';
      else
        select pg_catalog.jsonb_build_object('country', o.country)
          into v_before
        from public.company_offices o
        where o.id = p_target_id
          and o.tenant_id = v_tenant_id
          and o.deleted_at is null
        for update;
        if not found then
          raise exception 'invalid_state' using errcode = 'P0002';
        end if;
        update public.company_offices
        set
          country = p_input ->> 'country',
          name = p_input ->> 'name',
          address = p_input ->> 'address'
        where id = p_target_id
          and tenant_id = v_tenant_id;
        v_entity_id := p_target_id;
        v_event_type := 'office_updated';
      end if;
      v_entity_type := 'office';
      v_after := pg_catalog.jsonb_build_object('country', p_input ->> 'country');
      v_result := pg_catalog.jsonb_build_object('entity_id', v_entity_id);

    when 'office.delete' then
      if v_reason is null or char_length(v_reason) not between 8 and 500 then
        raise exception 'invalid_input' using errcode = '22023';
      end if;
      update public.company_offices
      set deleted_at = pg_catalog.clock_timestamp()
      where id = p_target_id
        and tenant_id = v_tenant_id
        and deleted_at is null
      returning id into v_entity_id;
      if v_entity_id is null then
        raise exception 'invalid_state' using errcode = 'P0002';
      end if;
      v_entity_type := 'office';
      v_event_type := 'office_deleted';
      v_after := pg_catalog.jsonb_build_object('deleted', true);
      v_result := pg_catalog.jsonb_build_object('entity_id', v_entity_id);

    when 'bank_account.save' then
      if p_target_id is null then
        insert into public.company_bank_accounts (
          tenant_id,
          bank_name,
          account_type,
          currency,
          account_number
        )
        values (
          v_tenant_id,
          p_input ->> 'bank_name',
          p_input ->> 'account_type',
          p_input ->> 'currency',
          p_input ->> 'account_number'
        )
        returning id into v_entity_id;
        v_event_type := 'bank_account_created';
      else
        select pg_catalog.jsonb_build_object(
          'account_type', a.account_type,
          'currency', a.currency
        )
          into v_before
        from public.company_bank_accounts a
        where a.id = p_target_id
          and a.tenant_id = v_tenant_id
          and a.deleted_at is null
        for update;
        if not found then
          raise exception 'invalid_state' using errcode = 'P0002';
        end if;
        update public.company_bank_accounts
        set
          bank_name = p_input ->> 'bank_name',
          account_type = p_input ->> 'account_type',
          currency = p_input ->> 'currency',
          account_number = p_input ->> 'account_number'
        where id = p_target_id
          and tenant_id = v_tenant_id;
        v_entity_id := p_target_id;
        v_event_type := 'bank_account_updated';
      end if;
      v_entity_type := 'bank_account';
      v_after := pg_catalog.jsonb_build_object(
        'account_type', p_input ->> 'account_type',
        'currency', p_input ->> 'currency'
      );
      v_result := pg_catalog.jsonb_build_object('entity_id', v_entity_id);

    when 'bank_account.delete' then
      if v_reason is null or char_length(v_reason) not between 8 and 500 then
        raise exception 'invalid_input' using errcode = '22023';
      end if;
      update public.company_bank_accounts
      set deleted_at = pg_catalog.clock_timestamp()
      where id = p_target_id
        and tenant_id = v_tenant_id
        and deleted_at is null
      returning id into v_entity_id;
      if v_entity_id is null then
        raise exception 'invalid_state' using errcode = 'P0002';
      end if;
      v_entity_type := 'bank_account';
      v_event_type := 'bank_account_deleted';
      v_after := pg_catalog.jsonb_build_object('deleted', true);
      v_result := pg_catalog.jsonb_build_object('entity_id', v_entity_id);

    when 'feature_flag.toggle' then
      select pg_catalog.jsonb_build_object('enabled', f.enabled), f.id
        into v_before, v_entity_id
      from public.feature_flags f
      where f.tenant_id = v_tenant_id
        and f.key = p_input ->> 'key'
      for update;
      if v_entity_id is null then
        raise exception 'invalid_state' using errcode = 'P0002';
      end if;
      update public.feature_flags
      set
        enabled = (p_input ->> 'enabled')::boolean,
        updated_at = pg_catalog.clock_timestamp(),
        updated_by = v_actor_id
      where id = v_entity_id;
      v_entity_type := 'feature_flag';
      v_event_type := 'feature_flag_changed';
      v_after := pg_catalog.jsonb_build_object(
        'key', p_input ->> 'key',
        'enabled', (p_input ->> 'enabled')::boolean
      );
      v_result := pg_catalog.jsonb_build_object('entity_id', v_entity_id);

    when 'numbering.legal_legend_update' then
      update public.tenants
      set
        invoice_footer_text = nullif(p_input ->> 'footer', ''),
        invoice_terms_text = nullif(p_input ->> 'terms', '')
      where id = v_tenant_id;
      v_entity_type := 'tenant';
      v_entity_id := v_tenant_id;
      v_event_type := 'numbering_legal_legend_changed';
      v_after := pg_catalog.jsonb_build_object(
        'footer_present', nullif(p_input ->> 'footer', '') is not null,
        'terms_present', nullif(p_input ->> 'terms', '') is not null
      );
      v_result := pg_catalog.jsonb_build_object('entity_id', v_entity_id);

    when 'notification_rule.upsert' then
      if p_target_id is null then
        select r.id
          into v_entity_id
        from public.client_notification_rules r
        where r.tenant_id = v_tenant_id
          and r.trigger_event = p_input ->> 'trigger_event'
          and (
            (
              nullif(p_input ->> 'client_id', '') is null
              and r.client_id is null
            )
            or r.client_id = nullif(p_input ->> 'client_id', '')::uuid
          )
        for update;
      else
        v_entity_id := p_target_id;
      end if;

      if v_entity_id is null then
        insert into public.client_notification_rules (
          tenant_id,
          client_id,
          trigger_event,
          channel,
          anchor,
          offset_minutes,
          template_key,
          custom_title,
          custom_body,
          visible_in_portal,
          active
        )
        values (
          v_tenant_id,
          nullif(p_input ->> 'client_id', '')::uuid,
          p_input ->> 'trigger_event',
          p_input ->> 'channel',
          p_input ->> 'anchor',
          (p_input ->> 'offset_minutes')::integer,
          nullif(p_input ->> 'template_key', ''),
          nullif(p_input ->> 'custom_title', ''),
          nullif(p_input ->> 'custom_body', ''),
          (p_input ->> 'visible_in_portal')::boolean,
          (p_input ->> 'active')::boolean
        )
        returning id into v_entity_id;
        v_event_type := 'notification_rule_created';
      else
        select pg_catalog.jsonb_build_object(
          'channel', r.channel,
          'anchor', r.anchor,
          'active', r.active
        )
          into v_before
        from public.client_notification_rules r
        where r.id = v_entity_id
          and r.tenant_id = v_tenant_id
        for update;
        if not found then
          raise exception 'invalid_state' using errcode = 'P0002';
        end if;
        update public.client_notification_rules
        set
          client_id = nullif(p_input ->> 'client_id', '')::uuid,
          trigger_event = p_input ->> 'trigger_event',
          channel = p_input ->> 'channel',
          anchor = p_input ->> 'anchor',
          offset_minutes = (p_input ->> 'offset_minutes')::integer,
          template_key = nullif(p_input ->> 'template_key', ''),
          custom_title = nullif(p_input ->> 'custom_title', ''),
          custom_body = nullif(p_input ->> 'custom_body', ''),
          visible_in_portal = (p_input ->> 'visible_in_portal')::boolean,
          active = (p_input ->> 'active')::boolean,
          updated_at = pg_catalog.clock_timestamp()
        where id = v_entity_id;
        v_event_type := 'notification_rule_updated';
      end if;
      v_entity_type := 'notification_rule';
      v_after := pg_catalog.jsonb_build_object(
        'trigger_event', p_input ->> 'trigger_event',
        'channel', p_input ->> 'channel',
        'anchor', p_input ->> 'anchor',
        'offset_minutes', (p_input ->> 'offset_minutes')::integer,
        'visible_in_portal', (p_input ->> 'visible_in_portal')::boolean,
        'active', (p_input ->> 'active')::boolean
      );
      v_result := pg_catalog.jsonb_build_object('entity_id', v_entity_id);

    when 'notification_rule.delete' then
      if v_reason is null or char_length(v_reason) not between 8 and 500 then
        raise exception 'invalid_input' using errcode = '22023';
      end if;
      delete from public.client_notification_rules
      where id = p_target_id
        and tenant_id = v_tenant_id
      returning id into v_entity_id;
      if v_entity_id is null then
        raise exception 'invalid_state' using errcode = 'P0002';
      end if;
      v_entity_type := 'notification_rule';
      v_event_type := 'notification_rule_deleted';
      v_after := pg_catalog.jsonb_build_object('deleted', true);
      v_result := pg_catalog.jsonb_build_object('entity_id', v_entity_id);

    when 'notification_rule.restore_defaults' then
      v_entity_id := v_tenant_id;
      insert into public.client_notification_rules (
        tenant_id,
        client_id,
        trigger_event,
        channel,
        anchor,
        offset_minutes,
        visible_in_portal,
        active
      )
      select
        v_tenant_id,
        null,
        defaults.trigger_event,
        'email',
        'event',
        0,
        true,
        true
      from (
        values
          ('status:in_warehouse'),
          ('status:shipped'),
          ('status:out_for_delivery'),
          ('status:delivered')
      ) as defaults(trigger_event)
      on conflict (tenant_id, trigger_event)
        where client_id is null
      do nothing;
      v_entity_type := 'notification_rule';
      v_event_type := 'notification_rule_defaults_restored';
      v_after := pg_catalog.jsonb_build_object('default_count', 4);
      v_result := pg_catalog.jsonb_build_object('entity_id', v_entity_id);

    when 'agent.install' then
      select public.next_agent_slug(v_tenant_id) into v_slug;
      insert into public.agents (
        tenant_id,
        skill_id,
        slug,
        name,
        model,
        status,
        budget_usd_monthly,
        trigger_config,
        created_by
      )
      values (
        v_tenant_id,
        (p_input ->> 'skill_id')::uuid,
        v_slug,
        p_input ->> 'name',
        (p_input ->> 'model')::public.agent_model,
        'off',
        (p_input ->> 'budget_usd_monthly')::numeric,
        coalesce(p_input -> 'trigger_config', '{}'::jsonb),
        v_actor_id
      )
      returning id into v_agent_id;

      for v_tool in
        select pg_catalog.jsonb_array_elements_text(
          coalesce(p_input -> 'tools_required', '[]'::jsonb)
        )
      loop
        insert into public.agent_tool_grants (
          agent_id,
          tool_key,
          scope,
          granted_by
        )
        values (v_agent_id, v_tool, '{}'::jsonb, v_actor_id);
      end loop;

      v_entity_type := 'agent';
      v_entity_id := v_agent_id;
      v_event_type := 'agent_installed';
      v_after := pg_catalog.jsonb_build_object(
        'skill_id', p_input ->> 'skill_id',
        'status', 'off',
        'model', p_input ->> 'model',
        'tool_count', pg_catalog.jsonb_array_length(
          coalesce(p_input -> 'tools_required', '[]'::jsonb)
        )
      );
      v_result := pg_catalog.jsonb_build_object('entity_id', v_entity_id);

    when 'agent.status_change' then
      select pg_catalog.jsonb_build_object('status', a.status)
        into v_before
      from public.agents a
      where a.id = p_target_id
        and a.tenant_id = v_tenant_id
        and a.deleted_at is null
      for update;
      if not found then
        raise exception 'invalid_state' using errcode = 'P0002';
      end if;
      update public.agents
      set status = (p_input ->> 'status')::public.agent_status
      where id = p_target_id
        and tenant_id = v_tenant_id;
      v_entity_type := 'agent';
      v_entity_id := p_target_id;
      v_event_type := 'agent_status_changed';
      v_after := pg_catalog.jsonb_build_object('status', p_input ->> 'status');
      v_result := pg_catalog.jsonb_build_object('entity_id', v_entity_id);

    else
      raise exception 'invalid_input' using errcode = '22023';
  end case;

  perform public.append_audit_event(
    v_tenant_id,
    v_entity_type,
    v_entity_id,
    'user',
    v_actor_id,
    v_event_type,
    'rpc',
    'succeeded',
    v_reason,
    v_before,
    v_after,
    '{}'::jsonb,
    p_operation_id::text,
    1,
    case
      when v_entity_type in ('api_key', 'webhook', 'bank_account')
        then 'restricted'
      else 'internal'
    end
  );

  update public.audit_d1_operations
  set
    target_id = v_entity_id,
    status = 'succeeded',
    result_data = v_result,
    completed_at = pg_catalog.clock_timestamp()
  where id = v_operation.id;

  if p_operation_type = 'membership.invite' then
    return v_result || pg_catalog.jsonb_build_object(
      'token', v_invitation.token
    );
  end if;

  return v_result;
end;
$function$;

alter function public.audit_d1_execute(uuid,text,uuid,jsonb,text)
  owner to postgres;
revoke all on function public.audit_d1_execute(uuid,text,uuid,jsonb,text)
  from public, anon;
grant execute on function public.audit_d1_execute(uuid,text,uuid,jsonb,text)
  to authenticated;

create function public.audit_d1_auth_intent(
  p_operation_id uuid,
  p_target_id uuid,
  p_disabled boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant_id uuid := public.audit_d1_admin_tenant();
  v_actor_id uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_current_disabled boolean;
  v_desired_state text := case when p_disabled then 'disabled' else 'enabled' end;
  v_operation_type text := case
    when p_disabled then 'membership.disable'
    else 'membership.enable'
  end;
  v_previous_state text;
  v_operation public.audit_external_operations%rowtype;
  v_event_type text;
begin
  if p_operation_id is null
     or p_target_id is null
     or v_reason is null
     or char_length(v_reason) not between 8 and 500 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  select ut.disabled_at is not null
    into v_current_disabled
  from public.user_tenants ut
  where ut.tenant_id = v_tenant_id
    and ut.user_id = p_target_id
  for update;

  if not found or v_current_disabled = p_disabled then
    raise exception 'invalid_state' using errcode = '22023';
  end if;

  v_previous_state := case
    when v_current_disabled then 'disabled'
    else 'enabled'
  end;

  insert into public.audit_external_operations (
    tenant_id,
    operation_key,
    operation_type,
    target_id,
    requested_by,
    reason,
    correlation_id,
    desired_state,
    previous_state,
    status
  )
  values (
    v_tenant_id,
    p_operation_id,
    v_operation_type,
    p_target_id,
    v_actor_id,
    v_reason,
    p_operation_id::text,
    v_desired_state,
    v_previous_state,
    'intent_recorded'
  )
  on conflict (tenant_id, operation_key) do nothing;

  select *
    into v_operation
  from public.audit_external_operations
  where tenant_id = v_tenant_id
    and operation_key = p_operation_id
  for update;

  if v_operation.target_id <> p_target_id
     or v_operation.requested_by <> v_actor_id
     or v_operation.desired_state <> v_desired_state then
    raise exception 'idempotency_conflict' using errcode = '23505';
  end if;

  if v_operation.status = 'intent_recorded' then
    v_event_type := case
      when p_disabled then 'membership_disable_requested'
      else 'membership_enable_requested'
    end;
    perform public.append_audit_event(
      v_tenant_id,
      'membership',
      p_target_id,
      'user',
      v_actor_id,
      v_event_type,
      'rpc',
      'succeeded',
      v_reason,
      pg_catalog.jsonb_build_object('state', v_operation.previous_state),
      pg_catalog.jsonb_build_object('state', v_operation.desired_state),
      '{}'::jsonb,
      p_operation_id::text,
      1,
      'restricted'
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'operation_id', v_operation.id,
    'operation_key', v_operation.operation_key,
    'target_id', v_operation.target_id,
    'desired_state', v_operation.desired_state,
    'status', v_operation.status
  );
end;
$function$;

create function public.audit_d1_auth_transition(
  p_operation_id uuid,
  p_transition text,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant_id uuid := public.audit_d1_admin_tenant();
  v_actor_id uuid := auth.uid();
  v_operation public.audit_external_operations%rowtype;
  v_disabled boolean;
  v_event_type text;
begin
  select *
    into v_operation
  from public.audit_external_operations
  where tenant_id = v_tenant_id
    and operation_key = p_operation_id
    and requested_by = v_actor_id
  for update;

  if not found then
    raise exception 'invalid_state' using errcode = 'P0002';
  end if;

  case p_transition
    when 'claim' then
      if v_operation.status not in ('intent_recorded', 'auth_failed_retryable')
         and not (
           v_operation.status = 'auth_in_progress'
           and v_operation.claim_expires_at < pg_catalog.clock_timestamp()
         ) then
        raise exception 'invalid_state' using errcode = '22023';
      end if;
      update public.audit_external_operations
      set
        status = 'auth_in_progress',
        attempt_count = attempt_count + 1,
        claimed_at = pg_catalog.clock_timestamp(),
        claim_expires_at = pg_catalog.clock_timestamp() + interval '2 minutes',
        updated_at = pg_catalog.clock_timestamp()
      where id = v_operation.id;

    when 'auth_succeeded' then
      if v_operation.status <> 'auth_in_progress' then
        raise exception 'invalid_state' using errcode = '22023';
      end if;
      update public.audit_external_operations
      set
        status = 'auth_succeeded',
        last_error_code = null,
        updated_at = pg_catalog.clock_timestamp()
      where id = v_operation.id;

    when 'reconcile_auth_succeeded' then
      if v_operation.status = 'confirmed' then
        null;
      elsif v_operation.status not in (
        'auth_in_progress',
        'auth_succeeded',
        'confirmation_failed',
        'compensation_in_progress',
        'reconciliation_required'
      ) then
        raise exception 'invalid_state' using errcode = '22023';
      else
        update public.audit_external_operations
        set
          status = 'auth_succeeded',
          last_error_code = null,
          next_attempt_at = null,
          updated_at = pg_catalog.clock_timestamp()
        where id = v_operation.id;
      end if;

    when 'confirm' then
      if v_operation.status = 'confirmed' then
        null;
      elsif v_operation.status <> 'auth_succeeded' then
        raise exception 'invalid_state' using errcode = '22023';
      else
        v_disabled := v_operation.desired_state = 'disabled';
        perform public.studio_set_user_disabled(v_operation.target_id, v_disabled);
        v_event_type := case
          when v_disabled then 'membership_disabled'
          else 'membership_enabled'
        end;
        perform public.append_audit_event(
          v_tenant_id,
          'membership',
          v_operation.target_id,
          'user',
          v_actor_id,
          v_event_type,
          'rpc',
          'succeeded',
          v_operation.reason,
          pg_catalog.jsonb_build_object('state', v_operation.previous_state),
          pg_catalog.jsonb_build_object('state', v_operation.desired_state),
          '{}'::jsonb,
          v_operation.correlation_id,
          1,
          'restricted'
        );
        update public.audit_external_operations
        set
          status = 'confirmed',
          completed_at = pg_catalog.clock_timestamp(),
          updated_at = pg_catalog.clock_timestamp()
        where id = v_operation.id;
      end if;

    when 'auth_retryable' then
      if v_operation.status <> 'auth_in_progress' then
        raise exception 'invalid_state' using errcode = '22023';
      end if;
      update public.audit_external_operations
      set
        status = 'auth_failed_retryable',
        last_error_code = coalesce(nullif(p_error_code, ''), 'auth_retryable'),
        next_attempt_at =
          pg_catalog.clock_timestamp()
          + least(attempt_count + 1, 10) * interval '30 seconds',
        updated_at = pg_catalog.clock_timestamp()
      where id = v_operation.id;

    when 'auth_terminal' then
      if v_operation.status <> 'auth_in_progress' then
        raise exception 'invalid_state' using errcode = '22023';
      end if;
      update public.audit_external_operations
      set
        status = 'auth_failed_terminal',
        last_error_code = coalesce(nullif(p_error_code, ''), 'auth_terminal'),
        completed_at = pg_catalog.clock_timestamp(),
        updated_at = pg_catalog.clock_timestamp()
      where id = v_operation.id;

    when 'confirmation_failed' then
      if v_operation.status <> 'auth_succeeded' then
        raise exception 'invalid_state' using errcode = '22023';
      end if;
      update public.audit_external_operations
      set
        status = 'confirmation_failed',
        last_error_code = 'confirmation_failed',
        updated_at = pg_catalog.clock_timestamp()
      where id = v_operation.id;

    when 'compensation_started' then
      if v_operation.status <> 'confirmation_failed' then
        raise exception 'invalid_state' using errcode = '22023';
      end if;
      update public.audit_external_operations
      set
        status = 'compensation_in_progress',
        updated_at = pg_catalog.clock_timestamp()
      where id = v_operation.id;

    when 'compensated' then
      if v_operation.status <> 'compensation_in_progress' then
        raise exception 'invalid_state' using errcode = '22023';
      end if;
      update public.audit_external_operations
      set
        status = 'compensated',
        completed_at = pg_catalog.clock_timestamp(),
        updated_at = pg_catalog.clock_timestamp()
      where id = v_operation.id;

    when 'reconciliation_required' then
      if v_operation.status not in (
        'confirmation_failed',
        'compensation_in_progress'
      ) then
        raise exception 'invalid_state' using errcode = '22023';
      end if;
      update public.audit_external_operations
      set
        status = 'reconciliation_required',
        last_error_code = coalesce(
          nullif(p_error_code, ''),
          'reconciliation_required'
        ),
        next_attempt_at = null,
        updated_at = pg_catalog.clock_timestamp()
      where id = v_operation.id;

    else
      raise exception 'invalid_input' using errcode = '22023';
  end case;

  select *
    into v_operation
  from public.audit_external_operations
  where id = v_operation.id;

  return pg_catalog.jsonb_build_object(
    'operation_id', v_operation.id,
    'operation_key', v_operation.operation_key,
    'target_id', v_operation.target_id,
    'desired_state', v_operation.desired_state,
    'previous_state', v_operation.previous_state,
    'status', v_operation.status,
    'attempt_count', v_operation.attempt_count,
    'next_attempt_at', v_operation.next_attempt_at,
    'last_error_code', v_operation.last_error_code
  );
end;
$function$;

alter function public.audit_d1_auth_intent(uuid,uuid,boolean,text)
  owner to postgres;
alter function public.audit_d1_auth_transition(uuid,text,text)
  owner to postgres;

revoke all on function public.audit_d1_auth_intent(uuid,uuid,boolean,text)
  from public, anon;
revoke all on function public.audit_d1_auth_transition(uuid,text,text)
  from public, anon;
grant execute on function public.audit_d1_auth_intent(uuid,uuid,boolean,text)
  to authenticated;
grant execute on function public.audit_d1_auth_transition(uuid,text,text)
  to authenticated;

do $postcondition$
begin
  if not has_function_privilege(
    'authenticated',
    'public.audit_d1_execute(uuid,text,uuid,jsonb,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.audit_d1_execute(uuid,text,uuid,jsonb,text)',
    'EXECUTE'
  ) then
    raise exception '0289: ACL inválida en audit_d1_execute';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.audit_external_operations',
    'SELECT'
  ) or has_table_privilege(
    'authenticated',
    'public.audit_d1_operations',
    'SELECT'
  ) then
    raise exception '0289: authenticated no debe leer tablas internas';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'audit_d1_execute',
        'audit_d1_auth_intent',
        'audit_d1_auth_transition'
      )
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
  ) <> 3 then
    raise exception '0289: falta SECURITY DEFINER/search_path sellado';
  end if;
end;
$postcondition$;

reset statement_timeout;
reset lock_timeout;
