\set ON_ERROR_STOP on

-- Prueba contractual local del Corte B1. Crea una fixture mínima en public
-- únicamente dentro de esta transacción y termina siempre con ROLLBACK.
-- No imprime payloads ni deja filas persistidas.
begin;

do $roles$
begin
  if to_regclass('public.entity_audit_log') is not null
     or to_regclass('public.audit_entity_types') is not null
     or to_regclass('public.tenants') is not null then
    raise exception 'Fixture B1 rechazada: los objetos reales ya existen';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$roles$;

grant usage on schema public to anon, authenticated, service_role;

create table public.tenants (
  id uuid primary key
);

create table public.audit_entity_types (
  entity_type text primary key,
  status text not null check (status in ('active', 'deprecated'))
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
    foreign key (tenant_id)
    references public.tenants(id)
    on delete cascade,
  constraint entity_audit_log_entity_type_fkey
    foreign key (entity_type)
    references public.audit_entity_types(entity_type)
    on update restrict
    on delete restrict,
  constraint entity_audit_log_actor_type_check
    check (actor_type in ('user', 'operario', 'system'))
);

create index entity_audit_log_entity_idx
  on public.entity_audit_log (entity_type, entity_id, occurred_at desc);

create index entity_audit_log_tenant_idx
  on public.entity_audit_log (tenant_id, occurred_at desc);

alter table public.entity_audit_log enable row level security;

create policy entity_audit_log_tenant_select
  on public.entity_audit_log
  for select
  to authenticated
  using (true);

create policy entity_audit_log_service_role_all
  on public.entity_audit_log
  for all
  to service_role
  using (true)
  with check (true);

grant select on public.entity_audit_log to authenticated;
grant all on public.entity_audit_log to service_role;

create publication supabase_realtime;
alter publication supabase_realtime
  add table public.entity_audit_log;

insert into public.tenants (id)
values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');

insert into public.audit_entity_types (entity_type, status)
values
  ('shipment', 'active'),
  ('comment', 'active'),
  ('deprecated_contract', 'deprecated');

insert into public.entity_audit_log (
  id,
  tenant_id,
  entity_type,
  entity_id,
  actor_type,
  actor_id,
  event_type,
  payload,
  occurred_at
)
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'shipment',
  '30000000-0000-0000-0000-000000000001',
  'system',
  null,
  'legacy_created',
  '{"legacy":true}'::jsonb,
  '2026-07-20 12:00:00+00'
);

create temporary table b1_legacy_columns_before as
select
  column_name,
  ordinal_position,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'entity_audit_log'
order by ordinal_position;

-- Fixture de las siete firmas SQL presentes en Cloud. Sus cuerpos insertan
-- un evento mínimo para demostrar que B1 conserva su operación.
create function public.b1_fixture_writer_emit(p_event_type text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.entity_audit_log (
    tenant_id,
    entity_type,
    entity_id,
    actor_type,
    event_type
  )
  values (
    '10000000-0000-0000-0000-000000000001',
    'shipment',
    gen_random_uuid(),
    'system',
    p_event_type
  );

  return pg_catalog.jsonb_build_object('ok', true);
end
$function$;

create function public.operario_action(
  p_operario_id uuid,
  p_action_type text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return public.b1_fixture_writer_emit('legacy_operario_action');
end
$function$;

create function public.stuff_box_as_operario(
  p_operario_id uuid,
  p_consolidation_id uuid,
  p_code text,
  p_zx integer,
  p_zy integer,
  p_zz integer,
  p_manual boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return public.b1_fixture_writer_emit('legacy_stuff_box');
end
$function$;

create function public.unstuff_box_as_operario(
  p_operario_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return public.b1_fixture_writer_emit('legacy_unstuff_box');
end
$function$;

create function public.stuff_lot_as_operario(
  p_operario_id uuid,
  p_consolidation_id uuid,
  p_scanned_code text,
  p_width integer,
  p_count integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return public.b1_fixture_writer_emit('legacy_stuff_lot');
end
$function$;

create function public.unstuff_lot_as_operario(
  p_operario_id uuid,
  p_consolidation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return public.b1_fixture_writer_emit('legacy_unstuff_lot');
end
$function$;

create function public.rpc_soft_delete_comment(
  p_comment_id uuid,
  p_actor_id uuid,
  p_tenant_id uuid,
  p_operation_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return public.b1_fixture_writer_emit('legacy_comment_deleted');
end
$function$;

create function public.rpc_restore_comment(
  p_comment_id uuid,
  p_actor_id uuid,
  p_tenant_id uuid,
  p_operation_id uuid,
  p_expected_correlation_id uuid,
  p_mode text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return public.b1_fixture_writer_emit('legacy_comment_restored');
end
$function$;

revoke all on function public.b1_fixture_writer_emit(text)
  from public, anon, authenticated;
grant execute on function public.b1_fixture_writer_emit(text)
  to service_role;

revoke all on function public.operario_action(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.operario_action(uuid, text, jsonb)
  to service_role;

revoke all on function public.stuff_box_as_operario(
  uuid, uuid, text, integer, integer, integer, boolean
) from public, anon, authenticated;
grant execute on function public.stuff_box_as_operario(
  uuid, uuid, text, integer, integer, integer, boolean
) to service_role;

revoke all on function public.unstuff_box_as_operario(uuid, text)
  from public, anon, authenticated;
grant execute on function public.unstuff_box_as_operario(uuid, text)
  to service_role;

revoke all on function public.stuff_lot_as_operario(
  uuid, uuid, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.stuff_lot_as_operario(
  uuid, uuid, text, integer, integer
) to service_role;

revoke all on function public.unstuff_lot_as_operario(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.unstuff_lot_as_operario(uuid, uuid)
  to service_role;

revoke all on function public.rpc_soft_delete_comment(
  uuid, uuid, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.rpc_soft_delete_comment(
  uuid, uuid, uuid, uuid, text
) to service_role;

revoke all on function public.rpc_restore_comment(
  uuid, uuid, uuid, uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.rpc_restore_comment(
  uuid, uuid, uuid, uuid, uuid, text, text
) to service_role;

create temporary table b1_sql_writers_before as
select
  p.oid,
  p.proname,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
  p.prosrc,
  p.proacl,
  p.prosecdef,
  p.proconfig
from pg_proc as p
join pg_namespace as n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = any (array[
    'operario_action',
    'stuff_box_as_operario',
    'unstuff_box_as_operario',
    'stuff_lot_as_operario',
    'unstuff_lot_as_operario',
    'rpc_soft_delete_comment',
    'rpc_restore_comment'
  ]);

\ir ../migrations/0267_audit_contract_append_only.sql

-- ── Contrato de columnas, defaults y constraints ─────────────

do $contract$
declare
  v_new_column_count integer;
  v_valid_constraint_count integer;
begin
  if exists (
    (
      select
        column_name,
        ordinal_position,
        data_type,
        udt_name,
        is_nullable,
        column_default
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'entity_audit_log'
        and ordinal_position <= 9
    )
    except
    select * from b1_legacy_columns_before
  ) or exists (
    select * from b1_legacy_columns_before
    except
    (
      select
        column_name,
        ordinal_position,
        data_type,
        udt_name,
        is_nullable,
        column_default
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'entity_audit_log'
        and ordinal_position <= 9
    )
  ) then
    raise exception 'TEST B1: cambió una columna histórica';
  end if;

  select count(*)
    into v_new_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'entity_audit_log'
    and column_name = any (array[
      'correlation_id',
      'source',
      'result',
      'reason',
      'before_data',
      'after_data',
      'schema_version',
      'sensitivity'
    ]);

  if v_new_column_count <> 8 then
    raise exception 'TEST B1: faltan columnas nuevas';
  end if;

  select count(*)
    into v_valid_constraint_count
  from pg_constraint
  where conrelid = 'public.entity_audit_log'::regclass
    and conname = any (array[
      'entity_audit_log_actor_type_check',
      'entity_audit_log_actor_identity_check',
      'entity_audit_log_correlation_id_check',
      'entity_audit_log_source_check',
      'entity_audit_log_result_check',
      'entity_audit_log_reason_check',
      'entity_audit_log_before_data_check',
      'entity_audit_log_after_data_check',
      'entity_audit_log_schema_version_check',
      'entity_audit_log_sensitivity_check',
      'entity_audit_log_payload_object_check',
      'entity_audit_log_forbidden_keys_check'
    ])
    and contype = 'c'
    and convalidated;

  if v_valid_constraint_count <> 12 then
    raise exception 'TEST B1: constraints incompletos o no validados';
  end if;

  if not exists (
    select 1
    from public.entity_audit_log
    where id = '20000000-0000-0000-0000-000000000001'
      and correlation_id is null
      and source = 'legacy_unknown'
      and result = 'legacy_unknown'
      and reason is null
      and before_data is null
      and after_data is null
      and schema_version = 1
      and sensitivity = 'legacy_unknown'
  ) then
    raise exception 'TEST B1: los defaults legacy no describen la historia';
  end if;

  if not public.audit_json_has_forbidden_key(
    '{"nested":[{"ToKeN":"oculto"}]}'::jsonb
  ) then
    raise exception 'TEST B1: no detectó una clave prohibida recursiva';
  end if;

  if public.audit_json_has_forbidden_key(
    '{"nested":[{"safe_key":"valor"}]}'::jsonb
  ) then
    raise exception 'TEST B1: rechazó una clave permitida';
  end if;
end
$contract$;

-- ── Writer común: casos válidos ──────────────────────────────

set local role service_role;

select public.append_audit_event(
  '10000000-0000-0000-0000-000000000001',
  'shipment',
  '30000000-0000-0000-0000-000000000002',
  'agent',
  '40000000-0000-0000-0000-000000000001',
  'shipment_reviewed',
  'ai',
  'succeeded',
  null,
  '{"status":"draft"}'::jsonb,
  '{"status":"reviewed"}'::jsonb,
  '{"safe":true}'::jsonb,
  'corr.B1:agent-001',
  1,
  'internal'
);

select public.append_audit_event(
  '10000000-0000-0000-0000-000000000001',
  'shipment',
  '30000000-0000-0000-0000-000000000003',
  'integration',
  '40000000-0000-0000-0000-000000000002',
  'shipment_sync_failed',
  'integration',
  'failed',
  'Fallo remoto controlado',
  null,
  null,
  '{}'::jsonb,
  'corr.B1:integration-001',
  1,
  'metadata'
);

select public.append_audit_event(
  '10000000-0000-0000-0000-000000000001',
  'shipment',
  '30000000-0000-0000-0000-000000000004',
  'system',
  null,
  'shipment_indexed',
  'job'
);

-- INSERT directo legacy continúa disponible hasta Corte D.
insert into public.entity_audit_log (
  tenant_id,
  entity_type,
  entity_id,
  actor_type,
  event_type
)
values (
  '10000000-0000-0000-0000-000000000001',
  'shipment',
  '30000000-0000-0000-0000-000000000005',
  'system',
  'legacy_direct_insert'
);

-- Las siete firmas SQL legacy siguen ejecutando e insertando.
select public.operario_action(
  '40000000-0000-0000-0000-000000000010',
  'test',
  '{}'::jsonb
);
select public.stuff_box_as_operario(
  '40000000-0000-0000-0000-000000000011',
  '50000000-0000-0000-0000-000000000001',
  'BOX-1',
  0,
  0,
  0,
  false
);
select public.unstuff_box_as_operario(
  '40000000-0000-0000-0000-000000000012',
  'BOX-1'
);
select public.stuff_lot_as_operario(
  '40000000-0000-0000-0000-000000000013',
  '50000000-0000-0000-0000-000000000002',
  'LOT-1',
  1,
  null
);
select public.unstuff_lot_as_operario(
  '40000000-0000-0000-0000-000000000014',
  '50000000-0000-0000-0000-000000000002'
);
select public.rpc_soft_delete_comment(
  '60000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000015',
  '10000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  'Motivo de prueba'
);
select public.rpc_restore_comment(
  '60000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000015',
  '10000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000002',
  '70000000-0000-0000-0000-000000000001',
  'ordinary',
  'Motivo de prueba'
);

reset role;

do $valid_results$
begin
  if (
    select count(*)
    from public.entity_audit_log
    where actor_type in ('agent', 'integration')
      and source <> 'legacy_unknown'
  ) <> 2 then
    raise exception 'TEST B1: agent/integration no quedaron registrados';
  end if;

  if (
    select count(*)
    from public.entity_audit_log
    where event_type like 'legacy_%'
  ) <> 9 then
    raise exception 'TEST B1: no operaron los siete writers y dos eventos legacy';
  end if;

  if exists (
    (
      select
        p.oid,
        p.proname,
        pg_catalog.pg_get_function_identity_arguments(p.oid),
        p.prosrc,
        p.proacl,
        p.prosecdef,
        p.proconfig
      from pg_proc as p
      join pg_namespace as n
        on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = any (array[
          'operario_action',
          'stuff_box_as_operario',
          'unstuff_box_as_operario',
          'stuff_lot_as_operario',
          'unstuff_lot_as_operario',
          'rpc_soft_delete_comment',
          'rpc_restore_comment'
        ])
    )
    except
    select * from b1_sql_writers_before
  ) or exists (
    select * from b1_sql_writers_before
    except
    (
      select
        p.oid,
        p.proname,
        pg_catalog.pg_get_function_identity_arguments(p.oid),
        p.prosrc,
        p.proacl,
        p.prosecdef,
        p.proconfig
      from pg_proc as p
      join pg_namespace as n
        on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = any (array[
          'operario_action',
          'stuff_box_as_operario',
          'unstuff_box_as_operario',
          'stuff_lot_as_operario',
          'unstuff_lot_as_operario',
          'rpc_soft_delete_comment',
          'rpc_restore_comment'
        ])
    )
  ) then
    raise exception 'TEST B1: B modificó una firma SQL legacy';
  end if;
end
$valid_results$;

-- ── Writer común: rechazos contractuales ─────────────────────

do $writer_rejections$
begin
  begin
    perform public.append_audit_event(
      '10000000-0000-0000-0000-000000000001',
      'deprecated_contract',
      gen_random_uuid(),
      'system',
      null,
      'entity_rejected',
      'rpc',
      'rejected',
      'Entidad inactiva'
    );
    raise exception 'TEST B1: aceptó una entidad inactiva';
  exception when foreign_key_violation then null;
  end;

  begin
    perform public.append_audit_event(
      '10000000-0000-0000-0000-000000000001',
      'shipment',
      gen_random_uuid(),
      'unknown',
      gen_random_uuid(),
      'actor_rejected',
      'rpc',
      'rejected',
      'Actor inválido'
    );
    raise exception 'TEST B1: aceptó actor inválido';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.append_audit_event(
      '10000000-0000-0000-0000-000000000001',
      'shipment',
      gen_random_uuid(),
      null,
      null,
      'actor_rejected',
      'rpc',
      'rejected',
      'Actor ausente'
    );
    raise exception 'TEST B1: aceptó actor_type NULL';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.append_audit_event(
      '10000000-0000-0000-0000-000000000001',
      'shipment',
      gen_random_uuid(),
      'agent',
      null,
      'actor_rejected',
      'rpc',
      'rejected',
      'Falta actor ID'
    );
    raise exception 'TEST B1: aceptó actor no-system sin ID';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.append_audit_event(
      '10000000-0000-0000-0000-000000000001',
      'shipment',
      gen_random_uuid(),
      'system',
      null,
      'Evento Libre',
      'rpc'
    );
    raise exception 'TEST B1: aceptó event_type inválido';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.append_audit_event(
      '10000000-0000-0000-0000-000000000001',
      'shipment',
      gen_random_uuid(),
      'system',
      null,
      'source_rejected',
      'legacy_unknown',
      'rejected',
      'Origen inválido'
    );
    raise exception 'TEST B1: writer aceptó source legacy_unknown';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.append_audit_event(
      '10000000-0000-0000-0000-000000000001',
      'shipment',
      gen_random_uuid(),
      'system',
      null,
      'result_rejected',
      'rpc',
      'legacy_unknown',
      'Resultado inválido'
    );
    raise exception 'TEST B1: writer aceptó result legacy_unknown';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.append_audit_event(
      '10000000-0000-0000-0000-000000000001',
      'shipment',
      gen_random_uuid(),
      'system',
      null,
      'schema_rejected',
      'rpc',
      'rejected',
      'Schema inválido',
      null,
      null,
      '{}'::jsonb,
      null,
      0
    );
    raise exception 'TEST B1: aceptó schema_version inválido';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.append_audit_event(
      '10000000-0000-0000-0000-000000000001',
      'shipment',
      gen_random_uuid(),
      'system',
      null,
      'sensitivity_rejected',
      'rpc',
      'rejected',
      'Sensibilidad inválida',
      null,
      null,
      '{}'::jsonb,
      null,
      1,
      'legacy_unknown'
    );
    raise exception 'TEST B1: writer aceptó sensibilidad legacy_unknown';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.append_audit_event(
      '10000000-0000-0000-0000-000000000001',
      'shipment',
      gen_random_uuid(),
      'system',
      null,
      'secret_rejected',
      'rpc',
      'rejected',
      'Clave prohibida',
      null,
      '{"nested":[{"Authorization":"oculto"}]}'::jsonb
    );
    raise exception 'TEST B1: aceptó una clave prohibida recursiva';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.append_audit_event(
      '10000000-0000-0000-0000-000000000001',
      'shipment',
      gen_random_uuid(),
      'system',
      null,
      'shipment_deleted',
      'rpc'
    );
    raise exception 'TEST B1: aceptó evento obligado sin motivo';
  exception when invalid_parameter_value then null;
  end;
end
$writer_rejections$;

-- El CHECK de tabla también bloquea claves prohibidas en el camino legacy.
set local role service_role;

do $direct_rejection$
begin
  begin
    insert into public.entity_audit_log (
      tenant_id,
      entity_type,
      entity_id,
      actor_type,
      event_type,
      payload
    )
    values (
      '10000000-0000-0000-0000-000000000001',
      'shipment',
      gen_random_uuid(),
      'system',
      'legacy_secret',
      '{"nested":{"Api_Key":"oculto"}}'::jsonb
    );

    raise exception 'TEST B1: INSERT legacy aceptó clave prohibida';
  exception when check_violation then null;
  end;
end
$direct_rejection$;

reset role;

-- ── ACL de función y tabla ────────────────────────────────────

set local role authenticated;
select count(*) from public.entity_audit_log;

do $authenticated_denied$
begin
  begin
    perform public.append_audit_event(
      '10000000-0000-0000-0000-000000000001',
      'shipment',
      gen_random_uuid(),
      'system',
      null,
      'auth_denied',
      'rpc'
    );
    raise exception 'TEST B1: authenticated ejecutó el writer';
  exception when insufficient_privilege then null;
  end;
end
$authenticated_denied$;

reset role;

set local role anon;

do $anon_denied$
begin
  begin
    perform count(*) from public.entity_audit_log;
    raise exception 'TEST B1: anon consultó la tabla';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.append_audit_event(
      '10000000-0000-0000-0000-000000000001',
      'shipment',
      gen_random_uuid(),
      'system',
      null,
      'anon_denied',
      'rpc'
    );
    raise exception 'TEST B1: anon ejecutó el writer';
  exception when insufficient_privilege then null;
  end;
end
$anon_denied$;

reset role;

set local role service_role;

do $append_only$
begin
  begin
    update public.entity_audit_log
    set event_type = 'tampered';
    raise exception 'TEST B1: service_role ejecutó UPDATE';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.entity_audit_log;
    raise exception 'TEST B1: service_role ejecutó DELETE';
  exception when insufficient_privilege then null;
  end;

  begin
    truncate table public.entity_audit_log;
    raise exception 'TEST B1: service_role ejecutó TRUNCATE';
  exception when insufficient_privilege then null;
  end;
end
$append_only$;

reset role;

do $postconditions$
declare
  v_writer oid := to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  );
  v_index_definition text;
begin
  if v_writer is null
     or has_function_privilege('anon', v_writer, 'EXECUTE')
     or has_function_privilege('authenticated', v_writer, 'EXECUTE')
     or not has_function_privilege('service_role', v_writer, 'EXECUTE') then
    raise exception 'TEST B1: ACL del writer no es exacta';
  end if;

  if has_table_privilege('anon', 'public.entity_audit_log', 'SELECT')
     or not has_table_privilege(
       'authenticated',
       'public.entity_audit_log',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'public.entity_audit_log',
       'INSERT'
     )
     or has_table_privilege('service_role', 'public.entity_audit_log', 'SELECT')
     or not has_table_privilege(
       'service_role',
       'public.entity_audit_log',
       'INSERT'
     )
     or has_table_privilege('service_role', 'public.entity_audit_log', 'UPDATE')
     or has_table_privilege('service_role', 'public.entity_audit_log', 'DELETE')
     or has_table_privilege('service_role', 'public.entity_audit_log', 'TRUNCATE')
  then
    raise exception 'TEST B1: matriz ACL de tabla incorrecta';
  end if;

  if exists (
    select 1
    from pg_class as c
    cross join lateral pg_catalog.aclexplode(c.relacl) as acl
    left join pg_roles as granted_role
      on granted_role.oid = acl.grantee
    where c.oid = 'public.entity_audit_log'::regclass
      and (
        acl.grantee = 0
        or granted_role.rolname = 'anon'
        or (
          granted_role.rolname = 'authenticated'
          and (
            acl.privilege_type <> 'SELECT'
            or acl.is_grantable
          )
        )
        or (
          granted_role.rolname = 'service_role'
          and (
            acl.privilege_type <> 'INSERT'
            or acl.is_grantable
          )
        )
      )
  ) then
    raise exception 'TEST B1: hay privilegios explícitos fuera de matriz';
  end if;

  if has_function_privilege(
       'anon',
       'public.audit_json_has_forbidden_key(jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.audit_json_has_forbidden_key(jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.audit_json_has_forbidden_key(jsonb)',
       'EXECUTE'
     ) then
    raise exception 'TEST B1: ACL del helper JSON no es exacta';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'entity_audit_log'
      and policyname = 'entity_audit_log_service_role_all'
  ) then
    raise exception 'TEST B1: policy amplia de service_role sigue presente';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'entity_audit_log'
      and policyname = 'entity_audit_log_tenant_select'
      and cmd = 'SELECT'
  ) then
    raise exception 'TEST B1: policy tenant_select fue alterada';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = 'entity_audit_log_tenant_id_fkey'
      and confdeltype = 'c'
      and convalidated
  ) then
    raise exception 'TEST B1: FK de tenant dejó de ser CASCADE';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'entity_audit_log'
  ) then
    raise exception 'TEST B1: Realtime cambió';
  end if;

  select pg_catalog.pg_get_indexdef(indexrelid)
    into v_index_definition
  from pg_index
  where indexrelid =
    'public.entity_audit_log_tenant_correlation_idx'::regclass;

  if v_index_definition not like
    '%(tenant_id, correlation_id, occurred_at DESC, id DESC) WHERE (correlation_id IS NOT NULL)' then
    raise exception 'TEST B1: definición del índice inesperada';
  end if;
end
$postconditions$;

rollback;

select
  to_regclass('public.entity_audit_log') is null
  and to_regclass('public.audit_entity_types') is null
  and to_regclass('public.tenants') is null
  and to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null
  as b1_fixture_rolled_back;
