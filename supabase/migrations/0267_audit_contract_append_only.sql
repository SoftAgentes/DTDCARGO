-- ─────────────────────────────────────────────────────────────
-- 0267 · SDD-0166 Corte B1 · Contrato audit v1 y append-only
--
-- Alcance local:
--   1. añadir columnas y constraints contractuales sin inventar historia;
--   2. crear append_audit_event como writer estrecho;
--   3. reducir ACL de tabla a SELECT authenticated / INSERT service_role;
--   4. retirar la policy amplia de service_role;
--   5. añadir el índice parcial por tenant/correlación.
--
-- Deliberadamente NO hace:
--   · cambiar la FK de tenant ON DELETE CASCADE;
--   · migrar writers SQL o TypeScript;
--   · cambiar viewer, Realtime, consulta gobernada o RBAC;
--   · implementar retención, purga, exportación o lifecycle de tenants.
--
-- REVISIÓN LOCAL SOLAMENTE. NO AUTORIZADA PARA CLOUD.
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

-- ── 0. Preflight fail-closed sobre Corte A y estado B0 ───────

do $preflight$
declare
  v_actor_invalid_count bigint;
  v_payload_invalid_count bigint;
begin
  if to_regclass('public.entity_audit_log') is null then
    raise exception 'B1 requiere public.entity_audit_log';
  end if;

  if to_regclass('public.audit_entity_types') is null then
    raise exception 'B1 requiere public.audit_entity_types';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and confrelid = 'public.audit_entity_types'::regclass
      and conname = 'entity_audit_log_entity_type_fkey'
      and contype = 'f'
      and confupdtype = 'r'
      and confdeltype = 'r'
      and convalidated
  ) then
    raise exception 'B1 requiere la FK de catálogo A2 validada y RESTRICT';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = 'entity_audit_log_entity_type_check'
  ) then
    raise exception 'B1 requiere que A2 haya retirado el CHECK legacy de entidad';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = 'entity_audit_log_tenant_id_fkey'
      and contype = 'f'
      and confdeltype = 'c'
      and convalidated
  ) then
    raise exception 'B1 abortado: la FK de tenant no conserva ON DELETE CASCADE';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = 'entity_audit_log_actor_type_check'
      and contype = 'c'
      and convalidated
  ) then
    raise exception 'B1 requiere el CHECK legacy de actor';
  end if;

  if exists (
    select 1
    from pg_attribute
    where attrelid = 'public.entity_audit_log'::regclass
      and attname = any (array[
        'correlation_id',
        'source',
        'result',
        'reason',
        'before_data',
        'after_data',
        'schema_version',
        'sensitivity'
      ])
      and not attisdropped
  ) then
    raise exception 'B1 abortado: ya existe al menos una columna del contrato 0267';
  end if;

  if to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is not null then
    raise exception 'B1 abortado: append_audit_event ya existe';
  end if;

  if to_regprocedure('public.audit_json_has_forbidden_key(jsonb)') is not null then
    raise exception 'B1 abortado: audit_json_has_forbidden_key ya existe';
  end if;

  if to_regclass('public.entity_audit_log_tenant_correlation_idx') is not null then
    raise exception 'B1 abortado: el índice de correlación ya existe';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = any (array[
        'entity_audit_log_correlation_id_check',
        'entity_audit_log_source_check',
        'entity_audit_log_result_check',
        'entity_audit_log_reason_check',
        'entity_audit_log_before_data_check',
        'entity_audit_log_after_data_check',
        'entity_audit_log_schema_version_check',
        'entity_audit_log_sensitivity_check',
        'entity_audit_log_payload_object_check',
        'entity_audit_log_forbidden_keys_check',
        'entity_audit_log_actor_identity_check'
      ])
  ) then
    raise exception 'B1 abortado: ya existe al menos un constraint del contrato 0267';
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
    raise exception 'B1 requiere la policy tenant_select de authenticated';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'entity_audit_log'
      and policyname = 'entity_audit_log_service_role_all'
      and cmd = 'ALL'
      and roles @> array['service_role']::name[]
  ) then
    raise exception 'B1 requiere la policy amplia legacy de service_role';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'entity_audit_log'
  ) then
    raise exception 'B1 abortado: entity_audit_log no está en Realtime';
  end if;

  if not has_table_privilege('authenticated', 'public.entity_audit_log', 'SELECT')
     or not has_table_privilege('service_role', 'public.entity_audit_log', 'INSERT')
     or not has_table_privilege('service_role', 'public.entity_audit_log', 'UPDATE')
     or not has_table_privilege('service_role', 'public.entity_audit_log', 'DELETE') then
    raise exception 'B1 abortado: la ACL legacy no coincide con el snapshot B0';
  end if;

  select count(*)
    into v_actor_invalid_count
  from public.entity_audit_log
  where actor_type not in ('user', 'operario', 'system')
     or (actor_type <> 'system' and actor_id is null);

  if v_actor_invalid_count <> 0 then
    raise exception
      'B1 abortado: % filas no cumplen la identidad de actor v1',
      v_actor_invalid_count;
  end if;

  select count(*)
    into v_payload_invalid_count
  from public.entity_audit_log
  where pg_catalog.jsonb_typeof(payload) <> 'object';

  if v_payload_invalid_count <> 0 then
    raise exception
      'B1 abortado: % payloads históricos no son objetos JSON',
      v_payload_invalid_count;
  end if;
end
$preflight$;

-- ── 1. Helper inmutable para claves prohibidas recursivas ─────

create function public.audit_json_has_forbidden_key(p_value jsonb)
returns boolean
language sql
immutable
strict
set search_path = ''
as $function$
  with recursive walk(value) as (
    select p_value

    union all

    select child.value
    from walk
    cross join lateral (
      select object_value.value
      from pg_catalog.jsonb_each(
        case
          when pg_catalog.jsonb_typeof(walk.value) = 'object'
            then walk.value
          else '{}'::jsonb
        end
      ) as object_value

      union all

      select array_value.value
      from pg_catalog.jsonb_array_elements(
        case
          when pg_catalog.jsonb_typeof(walk.value) = 'array'
            then walk.value
          else '[]'::jsonb
        end
      ) as array_value
    ) as child
  ),
  object_keys(key) as (
    select key_name
    from walk
    cross join lateral pg_catalog.jsonb_object_keys(
      case
        when pg_catalog.jsonb_typeof(walk.value) = 'object'
          then walk.value
        else '{}'::jsonb
      end
    ) as key_names(key_name)
  )
  select exists (
    select 1
    from object_keys
    where pg_catalog.lower(key) = any (array[
      'password',
      'pass',
      'token',
      'access_token',
      'refresh_token',
      'secret',
      'api_key',
      'authorization',
      'cookie',
      'private_key',
      'service_role_key',
      'cvv',
      'card_number',
      'account_number'
    ]::text[])
  );
$function$;

alter function public.audit_json_has_forbidden_key(jsonb) owner to postgres;
revoke all on function public.audit_json_has_forbidden_key(jsonb)
  from public, anon, authenticated;
grant execute on function public.audit_json_has_forbidden_key(jsonb)
  to service_role;

do $payload_preflight$
declare
  v_forbidden_count bigint;
begin
  select count(*)
    into v_forbidden_count
  from public.entity_audit_log
  where public.audit_json_has_forbidden_key(payload);

  if v_forbidden_count <> 0 then
    raise exception
      'B1 abortado: % eventos históricos contienen claves prohibidas',
      v_forbidden_count;
  end if;
end
$payload_preflight$;

-- ── 2. Columnas aditivas y contrato validado ─────────────────

alter table public.entity_audit_log
  add column correlation_id text,
  add column source text not null default 'legacy_unknown',
  add column result text not null default 'legacy_unknown',
  add column reason text,
  add column before_data jsonb,
  add column after_data jsonb,
  add column schema_version integer not null default 1,
  add column sensitivity text not null default 'legacy_unknown';

alter table public.entity_audit_log
  drop constraint entity_audit_log_actor_type_check,
  add constraint entity_audit_log_actor_type_check
    check (actor_type in ('user', 'operario', 'system', 'agent', 'integration'))
    not valid,
  add constraint entity_audit_log_actor_identity_check
    check (actor_type = 'system' or actor_id is not null)
    not valid,
  add constraint entity_audit_log_correlation_id_check
    check (
      correlation_id is null
      or correlation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    )
    not valid,
  add constraint entity_audit_log_source_check
    check (
      source in (
        'studio',
        'mobile',
        'rpc',
        'job',
        'webhook',
        'integration',
        'ai',
        'legacy_unknown'
      )
    )
    not valid,
  add constraint entity_audit_log_result_check
    check (result in ('succeeded', 'rejected', 'failed', 'legacy_unknown'))
    not valid,
  add constraint entity_audit_log_reason_check
    check (
      (
        reason is null
        or (
          reason = pg_catalog.btrim(reason)
          and pg_catalog.char_length(reason) between 4 and 1000
        )
      )
      and (
        source = 'legacy_unknown'
        or (
          result not in ('rejected', 'failed')
          and event_type !~ '(_rejected|_voided|_cancelled|_canceled|_overridden|_deleted|_restored|_reversed)$'
        )
        or reason is not null
      )
    )
    not valid,
  add constraint entity_audit_log_before_data_check
    check (
      before_data is null
      or pg_catalog.jsonb_typeof(before_data) = 'object'
    )
    not valid,
  add constraint entity_audit_log_after_data_check
    check (
      after_data is null
      or pg_catalog.jsonb_typeof(after_data) = 'object'
    )
    not valid,
  add constraint entity_audit_log_schema_version_check
    check (schema_version > 0)
    not valid,
  add constraint entity_audit_log_sensitivity_check
    check (
      sensitivity in (
        'metadata',
        'internal',
        'sensitive',
        'restricted',
        'legacy_unknown'
      )
    )
    not valid,
  add constraint entity_audit_log_payload_object_check
    check (pg_catalog.jsonb_typeof(payload) = 'object')
    not valid,
  add constraint entity_audit_log_forbidden_keys_check
    check (
      not public.audit_json_has_forbidden_key(payload)
      and (
        before_data is null
        or not public.audit_json_has_forbidden_key(before_data)
      )
      and (
        after_data is null
        or not public.audit_json_has_forbidden_key(after_data)
      )
    )
    not valid;

alter table public.entity_audit_log
  validate constraint entity_audit_log_actor_type_check;
alter table public.entity_audit_log
  validate constraint entity_audit_log_actor_identity_check;
alter table public.entity_audit_log
  validate constraint entity_audit_log_correlation_id_check;
alter table public.entity_audit_log
  validate constraint entity_audit_log_source_check;
alter table public.entity_audit_log
  validate constraint entity_audit_log_result_check;
alter table public.entity_audit_log
  validate constraint entity_audit_log_reason_check;
alter table public.entity_audit_log
  validate constraint entity_audit_log_before_data_check;
alter table public.entity_audit_log
  validate constraint entity_audit_log_after_data_check;
alter table public.entity_audit_log
  validate constraint entity_audit_log_schema_version_check;
alter table public.entity_audit_log
  validate constraint entity_audit_log_sensitivity_check;
alter table public.entity_audit_log
  validate constraint entity_audit_log_payload_object_check;
alter table public.entity_audit_log
  validate constraint entity_audit_log_forbidden_keys_check;

-- ── 3. Writer estrecho para eventos nuevos ───────────────────

create function public.append_audit_event(
  p_tenant_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_event_type text,
  p_source text,
  p_result text default 'succeeded',
  p_reason text default null,
  p_before_data jsonb default null,
  p_after_data jsonb default null,
  p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null,
  p_schema_version integer default 1,
  p_sensitivity text default 'internal'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_correlation_id text :=
    nullif(pg_catalog.btrim(p_correlation_id), '');
begin
  if p_tenant_id is null or p_entity_id is null then
    raise exception 'audit: tenant_id y entity_id son obligatorios'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.tenants
    where id = p_tenant_id
  ) then
    raise exception 'audit: tenant inexistente'
      using errcode = '23503';
  end if;

  if p_entity_type is null
     or not exists (
       select 1
       from public.audit_entity_types
       where entity_type = p_entity_type
         and status = 'active'
     ) then
    raise exception 'audit: entity_type inexistente o inactivo'
      using errcode = '23503';
  end if;

  if p_actor_type is null
     or p_actor_type not in (
       'user',
       'operario',
       'system',
       'agent',
       'integration'
     ) then
    raise exception 'audit: actor_type inválido'
      using errcode = '22023';
  end if;

  if p_actor_type <> 'system' and p_actor_id is null then
    raise exception 'audit: actor_id es obligatorio para este actor_type'
      using errcode = '22023';
  end if;

  if p_event_type is null
     or p_event_type !~ '^[a-z][a-z0-9_]{1,79}$' then
    raise exception 'audit: event_type inválido'
      using errcode = '22023';
  end if;

  if p_source is null
     or p_source not in (
       'studio',
       'mobile',
       'rpc',
       'job',
       'webhook',
       'integration',
       'ai'
     ) then
    raise exception 'audit: source inválido'
      using errcode = '22023';
  end if;

  if p_result is null
     or p_result not in ('succeeded', 'rejected', 'failed') then
    raise exception 'audit: result inválido'
      using errcode = '22023';
  end if;

  if p_sensitivity is null
     or p_sensitivity not in (
       'metadata',
       'internal',
       'sensitive',
       'restricted'
     ) then
    raise exception 'audit: sensitivity inválida'
      using errcode = '22023';
  end if;

  if p_schema_version is null or p_schema_version <= 0 then
    raise exception 'audit: schema_version debe ser positivo'
      using errcode = '22023';
  end if;

  if v_correlation_id is not null
     and v_correlation_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'audit: correlation_id inválido'
      using errcode = '22023';
  end if;

  if v_reason is not null
     and pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres'
      using errcode = '22023';
  end if;

  if (
    p_result in ('rejected', 'failed')
    or p_event_type ~ '(_rejected|_voided|_cancelled|_canceled|_overridden|_deleted|_restored|_reversed)$'
  ) and v_reason is null then
    raise exception 'audit: reason es obligatorio para este resultado o evento'
      using errcode = '22023';
  end if;

  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'audit: payload debe ser un objeto JSON'
      using errcode = '22023';
  end if;

  if p_before_data is not null
     and pg_catalog.jsonb_typeof(p_before_data) <> 'object' then
    raise exception 'audit: before_data debe ser objeto JSON o NULL'
      using errcode = '22023';
  end if;

  if p_after_data is not null
     and pg_catalog.jsonb_typeof(p_after_data) <> 'object' then
    raise exception 'audit: after_data debe ser objeto JSON o NULL'
      using errcode = '22023';
  end if;

  if public.audit_json_has_forbidden_key(p_payload)
     or (
       p_before_data is not null
       and public.audit_json_has_forbidden_key(p_before_data)
     )
     or (
       p_after_data is not null
       and public.audit_json_has_forbidden_key(p_after_data)
     ) then
    raise exception 'audit: JSON contiene una clave prohibida'
      using errcode = '22023';
  end if;

  insert into public.entity_audit_log (
    tenant_id,
    entity_type,
    entity_id,
    actor_type,
    actor_id,
    event_type,
    payload,
    occurred_at,
    correlation_id,
    source,
    result,
    reason,
    before_data,
    after_data,
    schema_version,
    sensitivity
  )
  values (
    p_tenant_id,
    p_entity_type,
    p_entity_id,
    p_actor_type,
    p_actor_id,
    p_event_type,
    p_payload,
    pg_catalog.clock_timestamp(),
    v_correlation_id,
    p_source,
    p_result,
    v_reason,
    p_before_data,
    p_after_data,
    p_schema_version,
    p_sensitivity
  )
  returning id into v_id;

  return v_id;
end
$function$;

alter function public.append_audit_event(
  uuid,
  text,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  text,
  integer,
  text
) owner to postgres;

revoke all on function public.append_audit_event(
  uuid,
  text,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  text,
  integer,
  text
) from public, anon, authenticated;

grant execute on function public.append_audit_event(
  uuid,
  text,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  text,
  integer,
  text
) to service_role;

comment on function public.append_audit_event(
  uuid,
  text,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  text,
  integer,
  text
) is
  'SDD-0166 Corte B1: writer append-only para eventos nuevos; EXECUTE solo service_role y owner.';

-- ── 4. ACL exacta y RLS sin policy amplia ────────────────────

revoke all privileges on table public.entity_audit_log
  from public, anon, authenticated, service_role;

grant select on table public.entity_audit_log to authenticated;
grant insert on table public.entity_audit_log to service_role;

drop policy entity_audit_log_service_role_all
  on public.entity_audit_log;

-- ── 5. Único índice nuevo aprobado en B ──────────────────────

create index entity_audit_log_tenant_correlation_idx
  on public.entity_audit_log (
    tenant_id,
    correlation_id,
    occurred_at desc,
    id desc
  )
  where correlation_id is not null;

-- ── 6. Postcondiciones fail-closed ───────────────────────────

do $postconditions$
declare
  v_column_count integer;
  v_constraint_count integer;
  v_writer_oid oid;
  v_writer_owner text;
  v_writer_security_definer boolean;
  v_writer_config text[];
begin
  select count(*)
    into v_column_count
  from pg_attribute
  where attrelid = 'public.entity_audit_log'::regclass
    and attname = any (array[
      'correlation_id',
      'source',
      'result',
      'reason',
      'before_data',
      'after_data',
      'schema_version',
      'sensitivity'
    ])
    and not attisdropped;

  if v_column_count <> 8 then
    raise exception 'B1 abortado: quedaron % de 8 columnas nuevas', v_column_count;
  end if;

  select count(*)
    into v_constraint_count
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

  if v_constraint_count <> 12 then
    raise exception
      'B1 abortado: quedaron % de 12 constraints v1 validados',
      v_constraint_count;
  end if;

  select
    p.oid,
    owner_role.rolname,
    p.prosecdef,
    p.proconfig
  into
    v_writer_oid,
    v_writer_owner,
    v_writer_security_definer,
    v_writer_config
  from pg_proc as p
  join pg_roles as owner_role
    on owner_role.oid = p.proowner
  where p.oid = to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  );

  if v_writer_oid is null
     or v_writer_owner <> 'postgres'
     or not v_writer_security_definer
     or not ('search_path=""' = any (v_writer_config)) then
    raise exception 'B1 abortado: append_audit_event no quedó endurecida';
  end if;

  if has_function_privilege('anon', v_writer_oid, 'EXECUTE')
     or has_function_privilege('authenticated', v_writer_oid, 'EXECUTE')
     or not has_function_privilege('service_role', v_writer_oid, 'EXECUTE') then
    raise exception 'B1 abortado: ACL inválida en append_audit_event';
  end if;

  if exists (
       select 1
       from pg_class as c
       cross join lateral pg_catalog.aclexplode(
         coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))
       ) as acl
       where c.oid = 'public.entity_audit_log'::regclass
         and acl.grantee = 0
     )
     or has_table_privilege('anon', 'public.entity_audit_log', 'SELECT')
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
     or has_table_privilege(
       'service_role',
       'public.entity_audit_log',
       'REFERENCES'
     )
     or has_table_privilege('service_role', 'public.entity_audit_log', 'TRIGGER') then
    raise exception 'B1 abortado: matriz ACL de tabla inválida';
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
        or (
          granted_role.rolname = 'anon'
        )
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
    raise exception 'B1 abortado: existen privilegios explícitos fuera de matriz';
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
    raise exception 'B1 abortado: ACL inválida en helper JSON';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'entity_audit_log'
      and policyname = 'entity_audit_log_service_role_all'
  ) then
    raise exception 'B1 abortado: policy amplia de service_role sigue presente';
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
    raise exception 'B1 abortado: tenant_select cambió';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = 'entity_audit_log_tenant_id_fkey'
      and contype = 'f'
      and confdeltype = 'c'
      and convalidated
  ) then
    raise exception 'B1 abortado: la FK de tenant cambió';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'entity_audit_log'
  ) then
    raise exception 'B1 abortado: Realtime cambió';
  end if;

  if to_regclass('public.entity_audit_log_tenant_correlation_idx') is null then
    raise exception 'B1 abortado: falta el índice de correlación';
  end if;
end
$postconditions$;

reset statement_timeout;
reset lock_timeout;
