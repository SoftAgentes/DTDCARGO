-- SDD-0166 / SDD-0168: expose only the allowlisted comment lifecycle action
-- through the governed audit list. The raw payload remains inaccessible.

set statement_timeout = '30s';
set lock_timeout = '5s';

do $preconditions$
declare
  v_list_oid oid := to_regprocedure(
    'public.audit_list_events(integer,text,text,text,text,text,text,text,timestamptz,timestamptz,text)'
  );
  v_result text;
  v_definition text;
  v_search_path text[];
begin
  if v_list_oid is null then
    raise exception '0398 abortada: falta audit_list_events';
  end if;

  if to_regclass('public.entity_audit_log') is null then
    raise exception '0398 abortada: falta entity_audit_log';
  end if;

  select
    pg_catalog.pg_get_function_result(proc.oid),
    pg_catalog.pg_get_functiondef(proc.oid),
    proc.proconfig
    into v_result, v_definition, v_search_path
  from pg_catalog.pg_proc as proc
  where proc.oid = v_list_oid
    and proc.prosecdef
    and pg_catalog.pg_get_userbyid(proc.proowner) = 'postgres';

  if v_result is null or v_definition is null then
    raise exception '0398 abortada: audit_list_events perdió owner/security definer';
  end if;

  if not (
    'search_path=' = any(coalesce(v_search_path, array[]::text[]))
    or 'search_path=""' = any(coalesce(v_search_path, array[]::text[]))
  ) then
    raise exception '0398 abortada: audit_list_events perdió search_path vacío';
  end if;

  if v_result !~* 'summary jsonb'
     or v_result ~* '(payload|before_data|after_data|reason)' then
    raise exception '0398 abortada: firma gobernada inesperada';
  end if;

  if v_definition !~* 'ut\.role = ''admin'''
     or v_definition !~* 'log\.tenant_id = v_tenant_id'
     or v_definition !~* 'null::jsonb' then
    raise exception '0398 abortada: definición base de C1 cambió; revisar antes de reemplazar';
  end if;

  if has_table_privilege('authenticated', 'public.entity_audit_log', 'SELECT')
     or has_table_privilege('service_role', 'public.entity_audit_log', 'SELECT') then
    raise exception '0398 abortada: la tabla base recuperó lectura directa';
  end if;
end
$preconditions$;

create or replace function public.audit_list_events(
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
      log.schema_version,
      log.payload
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
    case
      when row.entity_type = 'comment'
       and row.event_type in ('comment_soft_deleted', 'comment_restored')
       and pg_catalog.jsonb_typeof(row.payload) = 'object'
       and row.payload ->> 'schema' = 'comment.lifecycle.v1'
       and row.payload ->> 'action' in (
         'self_delete',
         'moderation',
         'undo',
         'ordinary_restore',
         'exceptional_restore'
       )
      then pg_catalog.jsonb_build_object(
        'action',
        row.payload ->> 'action'
      )
      else null
    end,
    case when meta.has_more then meta.cursor_value else null end,
    meta.has_more
  from page_rows as row
  cross join page_meta as meta
  order by row.occurred_at desc, row.id desc;
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
  'SDD-0166 C1 allowlist v2: lista admin-only; summary.action solo para comment.lifecycle.v1.';

do $postconditions$
declare
  v_list_oid oid := to_regprocedure(
    'public.audit_list_events(integer,text,text,text,text,text,text,text,timestamptz,timestamptz,text)'
  );
  v_result text;
  v_definition text;
  v_search_path text[];
begin
  if v_list_oid is null then
    raise exception '0398 abortada: falta RPC gobernada después del replace';
  end if;

  select
    pg_catalog.pg_get_function_result(proc.oid),
    pg_catalog.pg_get_functiondef(proc.oid),
    proc.proconfig
    into v_result, v_definition, v_search_path
  from pg_catalog.pg_proc as proc
  where proc.oid = v_list_oid
    and proc.prosecdef
    and pg_catalog.pg_get_userbyid(proc.proowner) = 'postgres';

  if v_result is null or v_definition is null
     or not (
       'search_path=' = any(coalesce(v_search_path, array[]::text[]))
       or 'search_path=""' = any(coalesce(v_search_path, array[]::text[]))
     ) then
    raise exception '0398 abortada: owner/security/search_path inválido';
  end if;

  if v_result !~* 'summary jsonb'
     or v_result ~* '(payload|before_data|after_data|reason)' then
    raise exception '0398 abortada: firma expone campos sensibles';
  end if;

  if v_definition !~* 'comment\.lifecycle\.v1'
     or v_definition !~* 'ordinary_restore'
     or v_definition !~* 'jsonb_build_object' then
    raise exception '0398 abortada: allowlist de action no quedó instalada';
  end if;

  if has_function_privilege('anon', v_list_oid, 'EXECUTE')
     or not has_function_privilege('authenticated', v_list_oid, 'EXECUTE')
     or has_function_privilege('service_role', v_list_oid, 'EXECUTE') then
    raise exception '0398 abortada: ACL de RPC inválida';
  end if;

  if has_table_privilege('authenticated', 'public.entity_audit_log', 'SELECT')
     or has_table_privilege('service_role', 'public.entity_audit_log', 'SELECT') then
    raise exception '0398 abortada: la tabla base recuperó lectura directa';
  end if;
end
$postconditions$;

reset statement_timeout;
reset lock_timeout;
