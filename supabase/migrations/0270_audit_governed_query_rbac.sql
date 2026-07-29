-- SDD-0166 · Corte C1
-- Consulta gobernada, RBAC admin-only y retiro de lectura/Realtime crudos.
--
-- Este cambio no depende de 0268: acepta la FK tenant CASCADE (Cloud actual)
-- o RESTRICT (lifecycle aplicado después), pero no la modifica.

set lock_timeout = '5s';
set statement_timeout = '60s';

do $preconditions$
declare
  v_fk_action "char";
begin
  if to_regclass('public.entity_audit_log') is null
     or to_regclass('public.user_tenants') is null
     or to_regclass('public.user_profiles') is null
     or to_regclass('public.operario_pins') is null then
    raise exception 'C1 requiere audit log, memberships y directorios de actor';
  end if;

  if to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null then
    raise exception 'C1 requiere append_audit_event de Corte B';
  end if;

  if to_regprocedure(
       'public.audit_list_events(integer,text,text,text,text,text,text,text,timestamptz,timestamptz,text)'
     ) is not null
     or to_regprocedure(
       'public.audit_get_event_detail(uuid,text)'
     ) is not null then
    raise exception 'C1 no aplica: las RPC gobernadas ya existen';
  end if;

  if not has_table_privilege(
       'authenticated',
       'public.entity_audit_log',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'public.entity_audit_log',
       'INSERT'
     )
     or not has_table_privilege(
       'service_role',
       'public.entity_audit_log',
       'INSERT'
     )
     or has_table_privilege(
       'service_role',
       'public.entity_audit_log',
       'SELECT'
     ) then
    raise exception 'C1 abortado: ACL previa no coincide con Corte B';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'entity_audit_log'
      and policyname = 'entity_audit_log_tenant_select'
      and cmd = 'SELECT'
      and roles @> array['authenticated']::name[]
  ) then
    raise exception 'C1 abortado: falta tenant_select previo';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'entity_audit_log'
  ) then
    raise exception 'C1 abortado: Realtime cambió antes de la migración';
  end if;

  select confdeltype
    into v_fk_action
  from pg_constraint
  where conrelid = 'public.entity_audit_log'::regclass
    and conname = 'entity_audit_log_tenant_id_fkey'
    and contype = 'f'
    and convalidated;

  if v_fk_action is null or v_fk_action not in ('c', 'r') then
    raise exception 'C1 abortado: FK de tenant no es CASCADE ni RESTRICT';
  end if;
end
$preconditions$;

create function public.audit_list_events(
  p_limit integer default 50,
  p_entity_type text default null,
  p_actor_type text default null,
  p_event_type text default null,
  p_source text default null,
  p_result text default null,
  p_sensitivity text default null,
  p_correlation_id text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_cursor text default null
)
returns table (
  id uuid,
  entity_type text,
  entity_id uuid,
  actor_type text,
  actor_id uuid,
  actor_label text,
  actor_resolved boolean,
  event_type text,
  occurred_at timestamptz,
  correlation_id text,
  source text,
  result text,
  sensitivity text,
  schema_version integer,
  timezone text,
  summary jsonb,
  next_cursor text,
  has_more boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_memberships integer;
  v_limit integer := coalesce(p_limit, 50);
  v_cursor_at timestamptz;
  v_cursor_id uuid;
  v_cursor_raw text;
  v_cursor_b64 text;
begin
  select
    count(*)::integer,
    (array_agg(ut.tenant_id order by ut.tenant_id))[1]
    into v_memberships, v_tenant_id
  from public.user_tenants as ut
  where ut.user_id = v_user_id
    and ut.disabled_at is null
    and ut.role = 'admin';

  if v_user_id is null or v_memberships <> 1 or v_tenant_id is null then
    raise exception 'audit: capability audit_view denegada'
      using errcode = '42501';
  end if;

  if v_limit < 1 or v_limit > 100 then
    raise exception 'audit: limit debe estar entre 1 y 100'
      using errcode = '22023';
  end if;

  if p_actor_type is not null
     and p_actor_type not in (
       'user',
       'operario',
       'system',
       'agent',
       'integration'
     ) then
    raise exception 'audit: actor_type inválido' using errcode = '22023';
  end if;

  if p_source is not null
     and p_source not in (
       'studio',
       'mobile',
       'rpc',
       'job',
       'webhook',
       'integration',
       'ai',
       'legacy_unknown'
     ) then
    raise exception 'audit: source inválido' using errcode = '22023';
  end if;

  if p_result is not null
     and p_result not in (
       'succeeded',
       'rejected',
       'failed',
       'legacy_unknown'
     ) then
    raise exception 'audit: result inválido' using errcode = '22023';
  end if;

  if p_sensitivity is not null
     and p_sensitivity not in (
       'metadata',
       'internal',
       'sensitive',
       'restricted',
       'legacy_unknown'
     ) then
    raise exception 'audit: sensitivity inválida' using errcode = '22023';
  end if;

  if p_correlation_id is not null
     and p_correlation_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'audit: correlation_id inválido' using errcode = '22023';
  end if;

  if p_entity_type is not null
     and p_entity_type !~ '^[a-z][a-z0-9_]{1,79}$' then
    raise exception 'audit: entity_type inválido' using errcode = '22023';
  end if;

  if p_event_type is not null
     and p_event_type !~ '^[a-z][a-z0-9_]{1,79}$' then
    raise exception 'audit: event_type inválido' using errcode = '22023';
  end if;

  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'audit: rango de fechas inválido' using errcode = '22023';
  end if;

  if p_cursor is not null then
    begin
      if pg_catalog.length(p_cursor) not between 8 and 256
         or p_cursor !~ '^[A-Za-z0-9_-]+$' then
        raise exception 'cursor inválido';
      end if;

      v_cursor_b64 :=
        pg_catalog.translate(p_cursor, '-_', '+/')
        || pg_catalog.repeat(
          '=',
          (4 - pg_catalog.length(p_cursor) % 4) % 4
        );
      v_cursor_raw := pg_catalog.convert_from(
        pg_catalog.decode(v_cursor_b64, 'base64'),
        'UTF8'
      );

      if pg_catalog.length(v_cursor_raw)
         - pg_catalog.length(pg_catalog.replace(v_cursor_raw, '|', '')) <> 1 then
        raise exception 'cursor inválido';
      end if;

      v_cursor_at := pg_catalog.split_part(v_cursor_raw, '|', 1)::timestamptz;
      v_cursor_id := pg_catalog.split_part(v_cursor_raw, '|', 2)::uuid;
    exception
      when others then
        raise exception 'audit: cursor inválido' using errcode = '22023';
    end;
  end if;

  return query
  with filtered as (
    select
      log.id,
      log.entity_type,
      log.entity_id,
      log.actor_type,
      log.actor_id,
      case
        when log.actor_type = 'system' then 'Sistema'
        when log.actor_type = 'user' then (
          select coalesce(
            nullif(
              pg_catalog.btrim(
                pg_catalog.concat_ws(' ', profile.first_name, profile.last_name)
              ),
              ''
            ),
            'Usuario'
          )
          from public.user_tenants as actor_membership
          left join public.user_profiles as profile
            on profile.user_id = actor_membership.user_id
          where actor_membership.user_id = log.actor_id
            and actor_membership.tenant_id = log.tenant_id
            and actor_membership.disabled_at is null
          limit 1
        )
        when log.actor_type = 'operario' then (
          select op.display_name
          from public.operario_pins as op
          where op.id = log.actor_id
            and op.tenant_id = log.tenant_id
          limit 1
        )
        else null
      end as actor_label,
      case
        when log.actor_type = 'system' then true
        when log.actor_type = 'user' then exists (
          select 1
          from public.user_tenants as actor_membership
          where actor_membership.user_id = log.actor_id
            and actor_membership.tenant_id = log.tenant_id
            and actor_membership.disabled_at is null
        )
        when log.actor_type = 'operario' then exists (
          select 1
          from public.operario_pins as op
          where op.id = log.actor_id
            and op.tenant_id = log.tenant_id
        )
        else false
      end as actor_resolved,
      log.event_type,
      log.occurred_at,
      log.correlation_id,
      log.source,
      log.result,
      log.sensitivity,
      log.schema_version
    from public.entity_audit_log as log
    where log.tenant_id = v_tenant_id
      and (p_entity_type is null or log.entity_type = p_entity_type)
      and (p_actor_type is null or log.actor_type = p_actor_type)
      and (p_event_type is null or log.event_type = p_event_type)
      and (p_source is null or log.source = p_source)
      and (p_result is null or log.result = p_result)
      and (p_sensitivity is null or log.sensitivity = p_sensitivity)
      and (
        p_correlation_id is null
        or log.correlation_id = p_correlation_id
      )
      and (p_from is null or log.occurred_at >= p_from)
      and (p_to is null or log.occurred_at <= p_to)
      and (
        v_cursor_at is null
        or (log.occurred_at, log.id) < (v_cursor_at, v_cursor_id)
      )
    order by log.occurred_at desc, log.id desc
    limit v_limit + 1
  ),
  page_rows as (
    select *
    from filtered
    order by filtered.occurred_at desc, filtered.id desc
    limit v_limit
  ),
  page_meta as (
    select
      (select count(*) > v_limit from filtered) as has_more,
      (
        select pg_catalog.rtrim(
          pg_catalog.translate(
            pg_catalog.replace(
              pg_catalog.replace(
                pg_catalog.encode(
                  pg_catalog.convert_to(
                    pg_catalog.to_char(
                      last_row.occurred_at at time zone 'UTC',
                      'YYYY-MM-DD"T"HH24:MI:SS.US'
                    )
                    || 'Z|'
                    || last_row.id::text,
                    'UTF8'
                  ),
                  'base64'
                ),
                E'\n',
                ''
              ),
              E'\r',
              ''
            ),
            '+/',
            '-_'
          ),
          '='
        )
        from (
          select page_row.occurred_at, page_row.id
          from page_rows as page_row
          order by page_row.occurred_at desc, page_row.id desc
          offset greatest(v_limit - 1, 0)
          limit 1
        ) as last_row
      ) as cursor_value
  )
  select
    row.id,
    row.entity_type,
    row.entity_id,
    row.actor_type,
    row.actor_id,
    row.actor_label,
    row.actor_resolved,
    row.event_type,
    row.occurred_at,
    row.correlation_id,
    row.source,
    row.result,
    row.sensitivity,
    row.schema_version,
    'UTC'::text,
    null::jsonb,
    case when meta.has_more then meta.cursor_value else null end,
    meta.has_more
  from page_rows as row
  cross join page_meta as meta
  order by row.occurred_at desc, row.id desc;
end
$function$;

create function public.audit_get_event_detail(
  p_event_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_memberships integer;
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_event record;
  v_access_event_id uuid;
begin
  select
    count(*)::integer,
    (array_agg(ut.tenant_id order by ut.tenant_id))[1]
    into v_memberships, v_tenant_id
  from public.user_tenants as ut
  where ut.user_id = v_user_id
    and ut.disabled_at is null
    and ut.role = 'admin';

  if v_user_id is null or v_memberships <> 1 or v_tenant_id is null then
    raise exception 'audit: capability audit_view_sensitive denegada'
      using errcode = '42501';
  end if;

  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'audit: reautenticación AAL2 requerida'
      using errcode = '42501';
  end if;

  if v_reason is null or pg_catalog.char_length(v_reason) not between 8 and 500 then
    raise exception 'audit: motivo debe tener entre 8 y 500 caracteres'
      using errcode = '22023';
  end if;

  select
    log.id,
    log.entity_type,
    log.entity_id,
    log.event_type,
    log.occurred_at,
    log.sensitivity
    into v_event
  from public.entity_audit_log as log
  where log.id = p_event_id
    and log.tenant_id = v_tenant_id;

  if not found then
    raise exception 'audit: evento no encontrado' using errcode = 'P0002';
  end if;

  if v_event.event_type = 'audit_sensitive_accessed' then
    raise exception 'audit: un evento de acceso no admite reveal'
      using errcode = '22023';
  end if;

  v_access_event_id := public.append_audit_event(
    v_tenant_id,
    v_event.entity_type,
    v_event.entity_id,
    'user',
    v_user_id,
    'audit_sensitive_accessed',
    'rpc',
    'succeeded',
    v_reason,
    null,
    null,
    pg_catalog.jsonb_build_object('target_audit_event_id', p_event_id),
    null,
    1,
    'metadata'
  );

  return pg_catalog.jsonb_build_object(
    'event_id',
    p_event_id,
    'occurred_at',
    v_event.occurred_at,
    'sensitivity',
    v_event.sensitivity,
    'redacted',
    true,
    'fields',
    '{}'::jsonb,
    'access_event_id',
    v_access_event_id
  );
end
$function$;

alter function public.audit_list_events(
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text
) owner to postgres;

alter function public.audit_get_event_detail(uuid, text) owner to postgres;

revoke all on function public.audit_list_events(
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text
) from public, anon, authenticated, service_role;
grant execute on function public.audit_list_events(
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text
) to authenticated;

revoke all on function public.audit_get_event_detail(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.audit_get_event_detail(uuid, text)
  to authenticated;

comment on function public.audit_list_events(
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text
) is
  'SDD-0166 Corte C: lista admin-only, redacted, filtrada y paginada por cursor.';

comment on function public.audit_get_event_detail(uuid, text) is
  'SDD-0166 Corte C: reveal fail-closed con AAL2, motivo y evento de acceso; allowlist v1 vacía.';

do $remove_realtime$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'entity_audit_log'
  ) then
    alter publication supabase_realtime
      drop table public.entity_audit_log;
  end if;
end
$remove_realtime$;

drop policy entity_audit_log_tenant_select
  on public.entity_audit_log;

revoke select on table public.entity_audit_log from authenticated;

do $postconditions$
declare
  v_list_oid oid := to_regprocedure(
    'public.audit_list_events(integer,text,text,text,text,text,text,text,timestamptz,timestamptz,text)'
  );
  v_detail_oid oid := to_regprocedure(
    'public.audit_get_event_detail(uuid,text)'
  );
  v_result text;
begin
  if v_list_oid is null or v_detail_oid is null then
    raise exception 'C1 abortado: faltan RPCs';
  end if;

  if has_function_privilege('anon', v_list_oid, 'EXECUTE')
     or not has_function_privilege('authenticated', v_list_oid, 'EXECUTE')
     or has_function_privilege('service_role', v_list_oid, 'EXECUTE')
     or has_function_privilege('anon', v_detail_oid, 'EXECUTE')
     or not has_function_privilege('authenticated', v_detail_oid, 'EXECUTE')
     or has_function_privilege('service_role', v_detail_oid, 'EXECUTE') then
    raise exception 'C1 abortado: ACL de RPC inválida';
  end if;

  if has_table_privilege(
       'authenticated',
       'public.entity_audit_log',
       'SELECT'
     )
     or has_table_privilege(
       'service_role',
       'public.entity_audit_log',
       'SELECT'
     )
     or not has_table_privilege(
       'service_role',
       'public.entity_audit_log',
       'INSERT'
     ) then
    raise exception 'C1 abortado: ACL final de tabla inválida';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'entity_audit_log'
  ) then
    raise exception 'C1 abortado: quedó una policy de tabla base';
  end if;

  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'entity_audit_log'
  ) then
    raise exception 'C1 abortado: tabla base sigue en Realtime';
  end if;

  select pg_get_function_result(v_list_oid) into v_result;
  if v_result ~* '(payload|before_data|after_data|reason)' then
    raise exception 'C1 abortado: firma de lista expone campos sensibles';
  end if;
end
$postconditions$;

reset statement_timeout;
reset lock_timeout;
