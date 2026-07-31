-- SDD-0174 · D5 · cobertura residual, efectos externos y retiro del INSERT
-- directo de service_role.

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_table text;
begin
  if to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null then
    raise exception '0293 requiere append_audit_event de Corte B1';
  end if;

  foreach v_table in array array[
    'calculator_settings',
    'calculator_cities',
    'operational_calendar',
    'tenant_fx_history',
    'clients',
    'client_users',
    'prealerta_addons',
    'dispatch_routes',
    'dispatch_city_catalog'
  ] loop
    if to_regclass('public.' || v_table) is null then
      raise exception '0293 requiere public.%', v_table;
    end if;
  end loop;

  if to_regprocedure('public.audit_d5_residual_change()') is not null
     or to_regclass('public.audit_d5_external_operations') is not null then
    raise exception '0293 abortado: objetos D5 ya existen';
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
  ('calculator_settings', 'active', 'configuration', 1, 'migration:0293'),
  ('calculator_city',     'active', 'configuration', 1, 'migration:0293'),
  ('calendar_event',      'active', 'configuration', 1, 'migration:0293'),
  ('exchange_rate',       'active', 'configuration', 1, 'migration:0293'),
  ('client',              'active', 'commercial',    1, 'migration:0293'),
  ('portal_invitation',   'active', 'access',        1, 'migration:0293'),
  ('prealerta_addon',     'active', 'configuration', 1, 'migration:0293'),
  ('dispatch_route',      'active', 'logistics',     1, 'migration:0293'),
  ('dispatch_city',       'active', 'logistics',     1, 'migration:0293')
on conflict (entity_type) do update
set
  status = excluded.status,
  domain_code = excluded.domain_code,
  contract_version = greatest(
    public.audit_entity_types.contract_version,
    excluded.contract_version
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
  status text not null default 'intent_recorded' check (
    status in (
      'intent_recorded',
      'in_progress',
      'succeeded',
      'failed',
      'reconciliation_required'
    )
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  error_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  next_attempt_at timestamptz,
  finished_at timestamptz,
  unique (tenant_id, operation_key),
  check (error_code is null or error_code ~ '^[a-z0-9_.:-]{1,80}$')
);

create index audit_d5_external_operations_reconcile_idx
  on public.audit_d5_external_operations (
    status,
    next_attempt_at,
    claim_expires_at
  )
  where status not in ('succeeded');

alter table public.audit_d5_external_operations enable row level security;
revoke all on public.audit_d5_external_operations from public, anon, authenticated;

create function public.audit_d5_admin_tenant()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tenant_id uuid;
begin
  select ut.tenant_id into v_tenant_id
  from public.user_tenants ut
  where ut.user_id = auth.uid()
    and ut.role = 'admin'
    and ut.disabled_at is null
  order by ut.created_at
  limit 1;
  if v_tenant_id is null then
    raise exception 'audit_d5_forbidden' using errcode='42501';
  end if;
  return v_tenant_id;
end;
$function$;

create function public.audit_d5_external_intent(
  p_operation_id uuid,
  p_operation_type text,
  p_target_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
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

  if v_operation.operation_type <> p_operation_type
     or v_operation.target_id is distinct from p_target_id
     or v_operation.requested_by <> v_actor_id then
    raise exception 'idempotency_conflict' using errcode='23505';
  end if;

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

create function public.audit_d5_external_transition(
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
  v_tenant_id uuid := public.audit_d5_admin_tenant();
  v_actor_id uuid := auth.uid();
  v_operation public.audit_d5_external_operations%rowtype;
  v_next text;
  v_error text := nullif(pg_catalog.lower(pg_catalog.btrim(p_error_code)), '');
  v_entity_id uuid;
  v_previous_status text;
  v_emit_final boolean := false;
begin
  select * into v_operation
  from public.audit_d5_external_operations
  where tenant_id=v_tenant_id and operation_key=p_operation_id
  for update;
  if not found then
    raise exception 'operation_not_found' using errcode='P0002';
  end if;
  if v_operation.requested_by <> v_actor_id then
    raise exception 'audit_d5_forbidden' using errcode='42501';
  end if;

  v_previous_status := v_operation.status;
  v_next := case
    when p_transition='claim' and v_operation.status='intent_recorded'
      then 'in_progress'
    when p_transition='claim'
         and v_operation.status='failed'
         and v_operation.next_attempt_at <= pg_catalog.clock_timestamp()
      then 'in_progress'
    when p_transition='claim'
         and v_operation.status='in_progress'
         and v_operation.claim_expires_at < pg_catalog.clock_timestamp()
      then 'in_progress'
    when p_transition='succeed' and v_operation.status='in_progress'
      then 'succeeded'
    when p_transition='fail' and v_operation.status='in_progress'
      then 'failed'
    when p_transition='succeed' and v_operation.status='succeeded'
      then 'succeeded'
    when p_transition='fail' and v_operation.status='failed'
      then 'failed'
    when p_transition='reconciliation_required'
         and v_operation.status in ('in_progress','reconciliation_required')
      then 'reconciliation_required'
    when p_transition='reconcile_succeed'
         and v_operation.status in (
           'in_progress',
           'reconciliation_required',
           'succeeded'
         )
      then 'succeeded'
    when p_transition='reconcile_fail'
         and v_operation.status in (
           'in_progress',
           'reconciliation_required',
           'failed'
         )
      then 'failed'
    else null
  end;
  if v_next is null then
    raise exception 'invalid_transition' using errcode='22023';
  end if;
  if v_next in ('failed','reconciliation_required')
     and (v_error is null or v_error !~ '^[a-z0-9_.:-]{1,80}$') then
    raise exception 'invalid_error_code' using errcode='22023';
  end if;

  v_emit_final :=
    v_operation.status is distinct from v_next
    and v_next in ('succeeded','failed');

  update public.audit_d5_external_operations
  set
    status=v_next,
    started_at=case when v_next='in_progress'
      then coalesce(started_at,pg_catalog.clock_timestamp()) else started_at end,
    attempt_count=case when p_transition='claim'
      then attempt_count + 1 else attempt_count end,
    claimed_at=case when p_transition='claim'
      then pg_catalog.clock_timestamp() else claimed_at end,
    claim_expires_at=case when v_next='in_progress'
      then pg_catalog.clock_timestamp() + interval '2 minutes' else null end,
    next_attempt_at=case when v_next='failed'
      then pg_catalog.clock_timestamp() + interval '5 minutes' else null end,
    finished_at=case when v_next='succeeded'
      then pg_catalog.clock_timestamp() else null end,
    error_code=case
      when v_next in ('failed','reconciliation_required') then v_error
      else null
    end
  where id=v_operation.id
  returning * into v_operation;

  v_entity_id := coalesce(v_operation.target_id, v_operation.operation_key);
  if v_emit_final then
    perform public.append_audit_event(
      v_tenant_id, 'portal_invitation', v_entity_id, 'user', v_actor_id,
      case when v_next='succeeded'
        then 'portal_invitation_completed'
        else 'portal_invitation_failed'
      end,
      'rpc',
      case when v_next='succeeded' then 'succeeded' else 'failed' end,
      case when v_next='failed'
        then pg_catalog.concat('Proveedor externo: ',v_error,'.')
        else null
      end,
      pg_catalog.jsonb_build_object('status',v_previous_status),
      pg_catalog.jsonb_build_object(
        'status',v_next,
        'operation_type',v_operation.operation_type,
        'error_code',v_operation.error_code
      ),
      '{}'::jsonb,
      pg_catalog.concat('d5:',p_operation_id::text),
      1, 'restricted'
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'operation_id',v_operation.operation_key,
    'status',v_operation.status
  );
end;
$function$;

create function public.audit_d5_residual_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old jsonb := case when tg_op='INSERT' then null else to_jsonb(old) end;
  v_new jsonb := case when tg_op='DELETE' then null else to_jsonb(new) end;
  v_tenant_id uuid := coalesce(
    nullif(v_new->>'tenant_id','')::uuid,
    nullif(v_old->>'tenant_id','')::uuid
  );
  v_entity_id uuid;
  v_entity_type text;
  v_event_type text;
  v_reason text;
  v_before jsonb;
  v_after jsonb;
  v_changed boolean := true;
  v_actor_id uuid := auth.uid();
  v_actor_type text := case when auth.uid() is null then 'system' else 'user' end;
begin
  case tg_table_name
    when 'calculator_settings' then
      v_entity_id := v_tenant_id;
      v_entity_type := 'calculator_settings';
      v_event_type := 'calculator_settings_changed';
      v_before := case when v_old is null then null else
        pg_catalog.jsonb_build_object('configured',true) end;
      v_after := pg_catalog.jsonb_build_object('configured',true);

    when 'calculator_cities' then
      v_entity_id := coalesce(nullif(v_new->>'id','')::uuid,nullif(v_old->>'id','')::uuid);
      v_entity_type := 'calculator_city';
      if tg_op='INSERT' then v_event_type := 'calculator_city_created';
      elsif tg_op='DELETE' or v_old->>'deleted_at' is distinct from v_new->>'deleted_at' then
        v_event_type := 'calculator_city_deleted';
        v_reason := 'Eliminación confirmada en configuración del calculador.';
      else v_event_type := 'calculator_city_updated';
      end if;
      v_before := case when v_old is null then null else
        pg_catalog.jsonb_build_object('slug',v_old->'slug','active',to_jsonb((v_old->>'deleted_at') is null)) end;
      v_after := case when v_new is null then null else
        pg_catalog.jsonb_build_object('slug',v_new->'slug','active',to_jsonb((v_new->>'deleted_at') is null)) end;

    when 'operational_calendar' then
      v_entity_id := coalesce(nullif(v_new->>'id','')::uuid,nullif(v_old->>'id','')::uuid);
      v_entity_type := 'calendar_event';
      if tg_op='INSERT' then v_event_type := 'calendar_event_created';
      elsif tg_op='DELETE' or v_old->>'deleted_at' is distinct from v_new->>'deleted_at' then
        v_event_type := 'calendar_event_deleted';
        v_reason := 'Eliminación confirmada en calendario operativo.';
      else v_event_type := 'calendar_event_updated';
      end if;
      v_before := case when v_old is null then null else
        pg_catalog.jsonb_build_object('country',v_old->'country','kind',v_old->'kind','start_date',v_old->'start_date','end_date',v_old->'end_date') end;
      v_after := case when v_new is null then null else
        pg_catalog.jsonb_build_object('country',v_new->'country','kind',v_new->'kind','start_date',v_new->'start_date','end_date',v_new->'end_date') end;

    when 'tenant_fx_history' then
      v_entity_id := coalesce(nullif(v_new->>'id','')::uuid,nullif(v_old->>'id','')::uuid);
      v_entity_type := 'exchange_rate';
      v_event_type := 'exchange_rate_recorded';
      v_after := pg_catalog.jsonb_build_object('currency_pair',v_new->'currency_pair');

    when 'clients' then
      v_entity_id := coalesce(nullif(v_new->>'id','')::uuid,nullif(v_old->>'id','')::uuid);
      v_entity_type := 'client';
      if tg_op <> 'UPDATE'
         or (
           v_old->'email' is not distinct from v_new->'email'
           and v_old->'phone' is not distinct from v_new->'phone'
         ) then
        v_changed := false;
      else
        v_event_type := 'client_contact_updated';
        v_before := pg_catalog.jsonb_build_object(
          'email_present',to_jsonb(nullif(v_old->>'email','') is not null),
          'phone_present',to_jsonb(nullif(v_old->>'phone','') is not null)
        );
        v_after := pg_catalog.jsonb_build_object(
          'email_present',to_jsonb(nullif(v_new->>'email','') is not null),
          'phone_present',to_jsonb(nullif(v_new->>'phone','') is not null)
        );
      end if;

    when 'client_users' then
      v_entity_id := coalesce(
        nullif(v_new->>'client_id','')::uuid,
        nullif(v_old->>'client_id','')::uuid
      );
      v_entity_type := 'portal_invitation';
      if tg_op='INSERT' then v_event_type := 'portal_access_invited';
      elsif v_old->>'status' is distinct from v_new->>'status' then
        v_event_type := 'portal_access_status_changed';
      else v_changed := false;
      end if;
      v_before := case when v_old is null then null else
        pg_catalog.jsonb_build_object('status',v_old->'status') end;
      v_after := case when v_new is null then null else
        pg_catalog.jsonb_build_object('status',v_new->'status') end;

    when 'prealerta_addons' then
      v_entity_id := coalesce(nullif(v_new->>'id','')::uuid,nullif(v_old->>'id','')::uuid);
      v_entity_type := 'prealerta_addon';
      v_event_type := case when tg_op='INSERT' then 'prealerta_addon_created'
        else 'prealerta_addon_changed' end;
      v_before := case when v_old is null then null else
        pg_catalog.jsonb_build_object('code',v_old->'code','is_active',v_old->'is_active','multi_tracking',v_old->'multi_tracking') end;
      v_after := case when v_new is null then null else
        pg_catalog.jsonb_build_object('code',v_new->'code','is_active',v_new->'is_active','multi_tracking',v_new->'multi_tracking') end;

    when 'dispatch_routes' then
      v_entity_id := coalesce(nullif(v_new->>'id','')::uuid,nullif(v_old->>'id','')::uuid);
      v_entity_type := 'dispatch_route';
      if tg_op='INSERT' then v_event_type := 'dispatch_route_created';
      elsif tg_op='DELETE' or v_old->>'deleted_at' is distinct from v_new->>'deleted_at' then
        v_event_type := 'dispatch_route_deleted';
        v_reason := 'Eliminación confirmada en catálogo de rutas.';
      elsif v_old->>'active' is distinct from v_new->>'active' then
        v_event_type := 'dispatch_route_status_changed';
      else v_event_type := 'dispatch_route_updated';
      end if;
      v_before := case when v_old is null then null else
        pg_catalog.jsonb_build_object('route_code',v_old->'route_code','route_type',v_old->'route_type','hub',v_old->'hub','active',v_old->'active') end;
      v_after := case when v_new is null then null else
        pg_catalog.jsonb_build_object('route_code',v_new->'route_code','route_type',v_new->'route_type','hub',v_new->'hub','active',v_new->'active') end;

    when 'dispatch_city_catalog' then
      v_entity_id := coalesce(nullif(v_new->>'id','')::uuid,nullif(v_old->>'id','')::uuid);
      v_entity_type := 'dispatch_city';
      if tg_op='INSERT' then v_event_type := 'dispatch_city_created';
      elsif tg_op='DELETE' then
        v_event_type := 'dispatch_city_deleted';
        v_reason := 'Eliminación confirmada en catálogo de ciudades.';
      else v_event_type := 'dispatch_city_updated';
      end if;
      v_before := case when v_old is null then null else
        pg_catalog.jsonb_build_object('state_code',v_old->'state_code','active',v_old->'active','is_hq',v_old->'is_hq') end;
      v_after := case when v_new is null then null else
        pg_catalog.jsonb_build_object('state_code',v_new->'state_code','active',v_new->'active','is_hq',v_new->'is_hq') end;

    else
      raise exception '0293: tabla no allowlisted: %',tg_table_name;
  end case;

  if v_changed then
    perform public.append_audit_event(
      v_tenant_id,v_entity_type,v_entity_id,v_actor_type,v_actor_id,
      v_event_type,'rpc','succeeded',v_reason,v_before,v_after,'{}'::jsonb,
      pg_catalog.concat('d5:',tg_table_name,':',v_entity_id::text,':',pg_catalog.txid_current()::text),
      1,'restricted'
    );
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$function$;

alter function public.audit_d5_admin_tenant() owner to postgres;
alter function public.audit_d5_external_intent(uuid,text,uuid) owner to postgres;
alter function public.audit_d5_external_transition(uuid,text,text) owner to postgres;
alter function public.audit_d5_residual_change() owner to postgres;

revoke all on function public.audit_d5_admin_tenant() from public,anon,authenticated;
revoke all on function public.audit_d5_external_intent(uuid,text,uuid) from public,anon;
revoke all on function public.audit_d5_external_transition(uuid,text,text) from public,anon;
revoke all on function public.audit_d5_residual_change() from public,anon,authenticated;
grant execute on function public.audit_d5_external_intent(uuid,text,uuid) to authenticated;
grant execute on function public.audit_d5_external_transition(uuid,text,text) to authenticated;

create trigger audit_d5_calculator_settings after insert or update on public.calculator_settings
for each row execute function public.audit_d5_residual_change();
create trigger audit_d5_calculator_cities after insert or update or delete on public.calculator_cities
for each row execute function public.audit_d5_residual_change();
create trigger audit_d5_operational_calendar after insert or update or delete on public.operational_calendar
for each row execute function public.audit_d5_residual_change();
create trigger audit_d5_tenant_fx_history after insert on public.tenant_fx_history
for each row execute function public.audit_d5_residual_change();
create trigger audit_d5_clients_contact after update of email,phone on public.clients
for each row execute function public.audit_d5_residual_change();
create trigger audit_d5_client_users after insert or update of status on public.client_users
for each row execute function public.audit_d5_residual_change();
create trigger audit_d5_prealerta_addons after insert or update on public.prealerta_addons
for each row execute function public.audit_d5_residual_change();
create trigger audit_d5_dispatch_routes after insert or update or delete on public.dispatch_routes
for each row execute function public.audit_d5_residual_change();
create trigger audit_d5_dispatch_city_catalog after insert or update or delete on public.dispatch_city_catalog
for each row execute function public.audit_d5_residual_change();

revoke insert on public.entity_audit_log from service_role;

do $postcondition$
begin
  if has_table_privilege('service_role','public.entity_audit_log','INSERT') then
    raise exception '0293: service_role conserva INSERT directo';
  end if;
  if (
    select pg_catalog.count(*) from pg_trigger
    where tgname like 'audit_d5_%' and not tgisinternal and tgenabled='O'
  ) <> 9 then
    raise exception '0293: faltan triggers residuales';
  end if;
  if has_function_privilege('anon','public.audit_d5_external_intent(uuid,text,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.audit_d5_external_intent(uuid,text,uuid)','EXECUTE') then
    raise exception '0293: ACL externa inválida';
  end if;
end;
$postcondition$;

reset statement_timeout;
reset lock_timeout;
