-- ─────────────────────────────────────────────────────────────
-- 0262 · SDD-0168 · DB-1 contrato aditivo de ciclo de comentarios
--
-- Alcance local autorizado:
--   1. registrar `comment` en el catálogo AUD extensible;
--   2. añadir metadatos nullable, constraints e índices sin backfill;
--   3. crear RPCs service-role-only para delete/restore atómicos;
--   4. ampliar el freeze trigger con un guard transicional compatible.
--
-- DB-1 conserva temporalmente el UPDATE directo de `deleted_at` que usa la
-- aplicación vigente. APP lo sustituirá por estas RPCs y DB-2 retirará el
-- bypass directo. No incluye APP, DB-2, hard-delete, jobs ni purga.
--
-- REVISIÓN LOCAL SOLAMENTE. NO AUTORIZADA PARA CLOUD.
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

-- ── 0. Preflight fail-closed ──────────────────────────────────

do $preflight$
declare
  v_existing_columns text;
  v_signature text;
  v_names text[];
  v_function_def text;
begin
  if to_regclass('public.comments') is null
     or to_regclass('public.comment_mentions') is null
     or to_regclass('public.comment_reactions') is null
     or to_regclass('public.user_tenants') is null
     or to_regclass('public.shipments') is null
     or to_regclass('public.bitacora_tasks') is null
     or to_regclass('public.entity_audit_log') is null
     or to_regclass('public.audit_entity_types') is null then
    raise exception 'DB-1 requiere comments, relaciones, tenancy, contextos y AUD A2';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'anon')
     or not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception 'DB-1 requiere los roles anon, authenticated y service_role';
  end if;

  -- El contrato se apoya en la forma exacta previa de las tres tablas. Una
  -- columna agregada, retirada o retipada por otra sesión debe cerrar el gate.
  select string_agg(
           format(
             '%s:%s:%s:%s',
             column_name,
             udt_name,
             is_nullable,
             coalesce(column_default, '')
           ),
           ',' order by ordinal_position
         )
    into v_signature
  from information_schema.columns
  where table_schema = 'public' and table_name = 'comments';

  if v_signature is distinct from
    'id:uuid:NO:gen_random_uuid(),tenant_id:uuid:NO:,entity_type:text:NO:,entity_id:uuid:NO:,entity_code:text:YES:,author_id:uuid:YES:,body:text:NO:,parent_id:uuid:YES:,edited_at:timestamptz:YES:,created_at:timestamptz:NO:now(),deleted_at:timestamptz:YES:' then
    raise exception 'DB-1 detectó drift en la forma de public.comments'
      using detail = coalesce(v_signature, '<ausente>');
  end if;

  select string_agg(
           format(
             '%s:%s:%s:%s',
             column_name,
             udt_name,
             is_nullable,
             coalesce(column_default, '')
           ),
           ',' order by ordinal_position
         )
    into v_signature
  from information_schema.columns
  where table_schema = 'public' and table_name = 'comment_mentions';

  if v_signature is distinct from
    'id:uuid:NO:gen_random_uuid(),comment_id:uuid:NO:,tenant_id:uuid:NO:,mentioned_user_id:uuid:NO:,read_at:timestamptz:YES:,created_at:timestamptz:NO:now()' then
    raise exception 'DB-1 detectó drift en la forma de public.comment_mentions'
      using detail = coalesce(v_signature, '<ausente>');
  end if;

  select string_agg(
           format(
             '%s:%s:%s:%s',
             column_name,
             udt_name,
             is_nullable,
             coalesce(column_default, '')
           ),
           ',' order by ordinal_position
         )
    into v_signature
  from information_schema.columns
  where table_schema = 'public' and table_name = 'comment_reactions';

  if v_signature is distinct from
    'id:uuid:NO:gen_random_uuid(),comment_id:uuid:NO:,tenant_id:uuid:NO:,user_id:uuid:NO:,emoji:text:NO:,created_at:timestamptz:NO:now()' then
    raise exception 'DB-1 detectó drift en la forma de public.comment_reactions'
      using detail = coalesce(v_signature, '<ausente>');
  end if;

  select array_agg(conname::text order by conname)
    into v_names
  from pg_constraint
  where conrelid = 'public.comments'::regclass;

  if v_names is distinct from array[
    'comments_author_id_fkey',
    'comments_body_check',
    'comments_entity_type_check',
    'comments_parent_id_fkey',
    'comments_pkey',
    'comments_tenant_id_fkey'
  ]::text[] then
    raise exception 'DB-1 detectó drift en constraints de public.comments'
      using detail = coalesce(array_to_string(v_names, ', '), '<ausentes>');
  end if;

  select array_agg(conname::text order by conname)
    into v_names
  from pg_constraint
  where conrelid = 'public.comment_mentions'::regclass;

  if v_names is distinct from array[
    'comment_mentions_comment_id_fkey',
    'comment_mentions_comment_id_mentioned_user_id_key',
    'comment_mentions_mentioned_user_id_fkey',
    'comment_mentions_pkey',
    'comment_mentions_tenant_id_fkey'
  ]::text[] then
    raise exception 'DB-1 detectó drift en constraints de public.comment_mentions'
      using detail = coalesce(array_to_string(v_names, ', '), '<ausentes>');
  end if;

  select array_agg(conname::text order by conname)
    into v_names
  from pg_constraint
  where conrelid = 'public.comment_reactions'::regclass;

  if v_names is distinct from array[
    'comment_reactions_comment_id_fkey',
    'comment_reactions_comment_id_user_id_emoji_key',
    'comment_reactions_emoji_check',
    'comment_reactions_pkey',
    'comment_reactions_tenant_id_fkey',
    'comment_reactions_user_id_fkey'
  ]::text[] then
    raise exception 'DB-1 detectó drift en constraints de public.comment_reactions'
      using detail = coalesce(array_to_string(v_names, ', '), '<ausentes>');
  end if;

  if exists (
    select 1
    from pg_class
    where oid = any (array[
      'public.comments'::regclass,
      'public.comment_mentions'::regclass,
      'public.comment_reactions'::regclass
    ])
      and (not relrowsecurity or relforcerowsecurity)
  ) then
    raise exception 'DB-1 requiere RLS habilitada y no forzada en comments y relaciones';
  end if;

  select array_agg(
           format('%s:%s:%s', policyname, cmd, array_to_string(roles, ','))
           order by policyname
         )
    into v_names
  from pg_policies
  where schemaname = 'public' and tablename = 'comments';

  if v_names is distinct from array[
    'comments_author_insert:INSERT:authenticated',
    'comments_author_or_admin_update:UPDATE:authenticated',
    'comments_no_hard_delete:DELETE:authenticated',
    'comments_service_role_all:ALL:service_role',
    'comments_tenant_select:SELECT:authenticated'
  ]::text[] then
    raise exception 'DB-1 detectó drift en policies de public.comments'
      using detail = coalesce(array_to_string(v_names, ', '), '<ausentes>');
  end if;

  if not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'comments'
         and policyname = 'comments_tenant_select'
         and qual like '%get_user_tenant_id%'
     )
     or not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'comments'
         and policyname = 'comments_author_insert'
         and with_check like '%get_user_tenant_id%'
         and with_check like '%auth.uid%'
         and with_check like '%author_id%'
     )
     or not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'comments'
         and policyname = 'comments_no_hard_delete'
         and regexp_replace(coalesce(qual, ''), '\s', '', 'g') in ('false', '(false)')
     )
     or not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'comments'
         and policyname = 'comments_service_role_all'
         and regexp_replace(coalesce(qual, ''), '\s', '', 'g') in ('true', '(true)')
         and regexp_replace(coalesce(with_check, ''), '\s', '', 'g') in ('true', '(true)')
     )
     or not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'comments'
         and policyname = 'comments_author_or_admin_update'
         and qual like '%get_user_tenant_id%'
         and qual like '%auth.uid%'
         and qual like '%user_tenants%'
         and qual like '%disabled_at%'
         and with_check like '%get_user_tenant_id%'
     ) then
    raise exception 'DB-1 detectó drift semántico en policies de public.comments';
  end if;

  select array_agg(
           format('%s:%s:%s', policyname, cmd, array_to_string(roles, ','))
           order by policyname
         )
    into v_names
  from pg_policies
  where schemaname = 'public' and tablename = 'comment_mentions';

  if v_names is distinct from array[
    'comment_mentions_author_insert:INSERT:authenticated',
    'comment_mentions_no_delete:DELETE:authenticated',
    'comment_mentions_owner_update:UPDATE:authenticated',
    'comment_mentions_service_role_all:ALL:service_role',
    'comment_mentions_tenant_select:SELECT:authenticated'
  ]::text[] then
    raise exception 'DB-1 detectó drift en policies de public.comment_mentions'
      using detail = coalesce(array_to_string(v_names, ', '), '<ausentes>');
  end if;

  if not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'comment_mentions'
         and policyname = 'comment_mentions_tenant_select'
         and qual like '%get_user_tenant_id%'
     )
     or not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'comment_mentions'
         and policyname = 'comment_mentions_author_insert'
         and with_check like '%get_user_tenant_id%'
         and with_check like '%auth.uid%'
         and with_check like '%comments%'
         and with_check like '%author_id%'
     )
     or not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'comment_mentions'
         and policyname = 'comment_mentions_owner_update'
         and qual like '%get_user_tenant_id%'
         and qual like '%auth.uid%'
         and qual like '%mentioned_user_id%'
         and with_check like '%get_user_tenant_id%'
         and with_check like '%auth.uid%'
         and with_check like '%mentioned_user_id%'
     )
     or not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'comment_mentions'
         and policyname = 'comment_mentions_no_delete'
         and regexp_replace(coalesce(qual, ''), '\s', '', 'g') in ('false', '(false)')
     )
     or not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'comment_mentions'
         and policyname = 'comment_mentions_service_role_all'
         and regexp_replace(coalesce(qual, ''), '\s', '', 'g') in ('true', '(true)')
         and regexp_replace(coalesce(with_check, ''), '\s', '', 'g') in ('true', '(true)')
     ) then
    raise exception 'DB-1 detectó drift semántico en policies de public.comment_mentions';
  end if;

  select array_agg(
           format('%s:%s:%s', policyname, cmd, array_to_string(roles, ','))
           order by policyname
         )
    into v_names
  from pg_policies
  where schemaname = 'public' and tablename = 'comment_reactions';

  if v_names is distinct from array[
    'comment_reactions_owner_delete:DELETE:authenticated',
    'comment_reactions_owner_insert:INSERT:authenticated',
    'comment_reactions_service_role_all:ALL:service_role',
    'comment_reactions_tenant_select:SELECT:authenticated'
  ]::text[] then
    raise exception 'DB-1 detectó drift en policies de public.comment_reactions'
      using detail = coalesce(array_to_string(v_names, ', '), '<ausentes>');
  end if;

  if not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'comment_reactions'
         and policyname = 'comment_reactions_tenant_select'
         and qual like '%get_user_tenant_id%'
     )
     or not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'comment_reactions'
         and policyname = 'comment_reactions_owner_insert'
         and with_check like '%get_user_tenant_id%'
         and with_check like '%auth.uid%'
         and with_check like '%comments%'
         and with_check like '%user_id%'
     )
     or not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'comment_reactions'
         and policyname = 'comment_reactions_owner_delete'
         and qual like '%get_user_tenant_id%'
         and qual like '%auth.uid%'
         and qual like '%user_id%'
     )
     or not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'comment_reactions'
         and policyname = 'comment_reactions_service_role_all'
         and regexp_replace(coalesce(qual, ''), '\s', '', 'g') in ('true', '(true)')
         and regexp_replace(coalesce(with_check, ''), '\s', '', 'g') in ('true', '(true)')
     ) then
    raise exception 'DB-1 detectó drift semántico en policies de public.comment_reactions';
  end if;

  select array_agg(privilege_type::text order by privilege_type)
    into v_names
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'comments'
    and grantee = 'authenticated';

  if v_names is distinct from array['INSERT', 'SELECT', 'UPDATE']::text[] then
    raise exception 'DB-1 detectó drift en grants authenticated de public.comments'
      using detail = coalesce(array_to_string(v_names, ', '), '<ausentes>');
  end if;

  select array_agg(privilege_type::text order by privilege_type)
    into v_names
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'comment_mentions'
    and grantee = 'authenticated';

  if v_names is distinct from array['INSERT', 'SELECT', 'UPDATE']::text[] then
    raise exception 'DB-1 detectó drift en grants authenticated de public.comment_mentions'
      using detail = coalesce(array_to_string(v_names, ', '), '<ausentes>');
  end if;

  select array_agg(privilege_type::text order by privilege_type)
    into v_names
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'comment_reactions'
    and grantee = 'authenticated';

  if v_names is distinct from array['DELETE', 'INSERT', 'SELECT']::text[] then
    raise exception 'DB-1 detectó drift en grants authenticated de public.comment_reactions'
      using detail = coalesce(array_to_string(v_names, ', '), '<ausentes>');
  end if;

  if has_table_privilege('anon', 'public.comments', 'SELECT')
     or has_table_privilege('anon', 'public.comments', 'INSERT')
     or has_table_privilege('anon', 'public.comments', 'UPDATE')
     or has_table_privilege('anon', 'public.comments', 'DELETE')
     or has_table_privilege('anon', 'public.comment_mentions', 'SELECT')
     or has_table_privilege('anon', 'public.comment_mentions', 'INSERT')
     or has_table_privilege('anon', 'public.comment_mentions', 'UPDATE')
     or has_table_privilege('anon', 'public.comment_mentions', 'DELETE')
     or has_table_privilege('anon', 'public.comment_reactions', 'SELECT')
     or has_table_privilege('anon', 'public.comment_reactions', 'INSERT')
     or has_table_privilege('anon', 'public.comment_reactions', 'UPDATE')
     or has_table_privilege('anon', 'public.comment_reactions', 'DELETE') then
    raise exception 'DB-1 detectó grants de datos inesperados para anon';
  end if;

  if has_table_privilege('authenticated', 'public.comments', 'DELETE')
     or has_table_privilege('authenticated', 'public.comments', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.comments', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.comments', 'TRIGGER')
     or has_table_privilege('authenticated', 'public.comment_mentions', 'DELETE')
     or has_table_privilege('authenticated', 'public.comment_mentions', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.comment_mentions', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.comment_mentions', 'TRIGGER')
     or has_table_privilege('authenticated', 'public.comment_reactions', 'UPDATE')
     or has_table_privilege('authenticated', 'public.comment_reactions', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.comment_reactions', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.comment_reactions', 'TRIGGER') then
    raise exception 'DB-1 detectó grants excesivos para authenticated';
  end if;

  if not has_table_privilege('service_role', 'public.comments', 'SELECT')
     or not has_table_privilege('service_role', 'public.comments', 'INSERT')
     or not has_table_privilege('service_role', 'public.comments', 'UPDATE')
     or not has_table_privilege('service_role', 'public.comments', 'DELETE')
     or not has_table_privilege('service_role', 'public.comments', 'TRUNCATE')
     or not has_table_privilege('service_role', 'public.comments', 'REFERENCES')
     or not has_table_privilege('service_role', 'public.comments', 'TRIGGER')
     or not has_table_privilege('service_role', 'public.comment_mentions', 'SELECT')
     or not has_table_privilege('service_role', 'public.comment_mentions', 'INSERT')
     or not has_table_privilege('service_role', 'public.comment_mentions', 'UPDATE')
     or not has_table_privilege('service_role', 'public.comment_mentions', 'DELETE')
     or not has_table_privilege('service_role', 'public.comment_mentions', 'TRUNCATE')
     or not has_table_privilege('service_role', 'public.comment_mentions', 'REFERENCES')
     or not has_table_privilege('service_role', 'public.comment_mentions', 'TRIGGER')
     or not has_table_privilege('service_role', 'public.comment_reactions', 'SELECT')
     or not has_table_privilege('service_role', 'public.comment_reactions', 'INSERT')
     or not has_table_privilege('service_role', 'public.comment_reactions', 'UPDATE')
     or not has_table_privilege('service_role', 'public.comment_reactions', 'DELETE')
     or not has_table_privilege('service_role', 'public.comment_reactions', 'TRUNCATE')
     or not has_table_privilege('service_role', 'public.comment_reactions', 'REFERENCES')
     or not has_table_privilege('service_role', 'public.comment_reactions', 'TRIGGER') then
    raise exception 'DB-1 requiere grants completos de service_role en comments y relaciones';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and confrelid = 'public.audit_entity_types'::regclass
      and conname = 'entity_audit_log_entity_type_fkey'
      and contype = 'f'
      and convalidated
      and confupdtype = 'r'
      and confdeltype = 'r'
  ) then
    raise exception 'DB-1 requiere la FK AUD de A2 validada y restrictiva';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = 'entity_audit_log_entity_type_check'
  ) then
    raise exception 'DB-1 requiere que A2 haya retirado el CHECK AUD legacy';
  end if;

  if not exists (
    select 1
    from public.audit_entity_types
    where entity_type = 'rendition'
      and status = 'active'
  ) then
    raise exception 'DB-1 requiere el catálogo AUD aplicado y operativo';
  end if;

  if exists (
    select 1 from public.audit_entity_types where entity_type = 'comment'
  ) then
    raise exception 'DB-1 no aplica: comment ya existe en audit_entity_types';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.comments'::regclass
      and conname = 'comments_entity_type_check'
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%shipment%'
      and pg_get_constraintdef(oid) like '%bitacora_task%'
  ) then
    raise exception 'DB-1 requiere el CHECK vigente de comments con shipment y bitacora_task';
  end if;

  if to_regprocedure('public.comment_entity_in_tenant(text,uuid,uuid)') is null
     or to_regprocedure('public.comments_freeze_immutable()') is null
     or to_regprocedure('public.comments_validate_entity()') is null then
    raise exception 'DB-1 requiere los helpers y triggers vigentes de comments';
  end if;

  select array_agg(tgname::text order by tgname)
    into v_names
  from pg_trigger
  where tgrelid = 'public.comments'::regclass
    and not tgisinternal;

  if v_names is distinct from array[
    'comments_freeze_immutable_trg',
    'comments_validate_entity_trg'
  ]::text[]
     or not exists (
       select 1 from pg_trigger
       where tgrelid = 'public.comments'::regclass
         and tgname = 'comments_freeze_immutable_trg'
         and tgfoid = 'public.comments_freeze_immutable()'::regprocedure
         and tgenabled = 'O'
         and pg_get_triggerdef(oid) like '%BEFORE UPDATE%'
     )
     or not exists (
       select 1 from pg_trigger
       where tgrelid = 'public.comments'::regclass
         and tgname = 'comments_validate_entity_trg'
         and tgfoid = 'public.comments_validate_entity()'::regprocedure
         and tgenabled = 'O'
         and pg_get_triggerdef(oid) like '%BEFORE INSERT%'
     ) then
    raise exception 'DB-1 detectó drift en triggers de public.comments'
      using detail = coalesce(array_to_string(v_names, ', '), '<ausentes>');
  end if;

  if not exists (
       select 1 from pg_proc
       where oid = 'public.comment_entity_in_tenant(text,uuid,uuid)'::regprocedure
         and prosecdef
         and provolatile = 's'
         and proconfig @> array['search_path=public']::text[]
     )
     or not exists (
       select 1 from pg_proc
       where oid = 'public.comments_freeze_immutable()'::regprocedure
         and not prosecdef
         and prorettype = 'trigger'::regtype
         and proconfig @> array['search_path=public']::text[]
     )
     or not exists (
       select 1 from pg_proc
       where oid = 'public.comments_validate_entity()'::regprocedure
         and not prosecdef
         and prorettype = 'trigger'::regtype
         and proconfig @> array['search_path=public']::text[]
     ) then
    raise exception 'DB-1 detectó drift en propiedades de funciones comments';
  end if;

  select pg_get_functiondef(
           'public.comment_entity_in_tenant(text,uuid,uuid)'::regprocedure
         )
    into v_function_def;

  if v_function_def not like '%shipment%'
     or v_function_def not like '%client%'
     or v_function_def not like '%invoice%'
     or v_function_def not like '%quote%'
     or v_function_def not like '%dispatch_order%'
     or v_function_def not like '%supplier_bill%'
     or v_function_def not like '%warehouse_receipt_cn%'
     or v_function_def not like '%warehouse_receipt_ve%'
     or v_function_def not like '%bitacora_task%' then
    raise exception 'DB-1 detectó drift en contextos de comment_entity_in_tenant';
  end if;

  select pg_get_functiondef('public.comments_freeze_immutable()'::regprocedure)
    into v_function_def;

  if v_function_def not like '%new.tenant_id%old.tenant_id%'
     or v_function_def not like '%new.entity_type%old.entity_type%'
     or v_function_def not like '%new.entity_id%old.entity_id%'
     or v_function_def not like '%new.entity_code%old.entity_code%'
     or v_function_def not like '%new.author_id%old.author_id%'
     or v_function_def not like '%new.parent_id%old.parent_id%'
     or v_function_def not like '%new.created_at%old.created_at%' then
    raise exception 'DB-1 detectó drift en comments_freeze_immutable';
  end if;

  select pg_get_functiondef('public.comments_validate_entity()'::regprocedure)
    into v_function_def;

  if v_function_def not like '%comment_entity_in_tenant%'
     or v_function_def not like '%new.entity_type%'
     or v_function_def not like '%new.entity_id%'
     or v_function_def not like '%new.tenant_id%' then
    raise exception 'DB-1 detectó drift en comments_validate_entity';
  end if;

  select string_agg(attname, ', ' order by attname)
    into v_existing_columns
  from pg_attribute
  where attrelid = 'public.comments'::regclass
    and attname = any (array[
      'deleted_by',
      'deletion_mode',
      'deletion_reason',
      'lifecycle_correlation_id',
      'last_lifecycle_operation_id',
      'lifecycle_contract_version'
    ])
    and not attisdropped;

  if v_existing_columns is not null then
    raise exception 'DB-1 no aplica: columnas lifecycle ya existen'
      using detail = v_existing_columns;
  end if;

  if to_regprocedure(
       'public.rpc_soft_delete_comment(uuid,uuid,uuid,uuid,text)'
     ) is not null
     or to_regprocedure(
       'public.rpc_restore_comment(uuid,uuid,uuid,uuid,uuid,text,text)'
     ) is not null
     or to_regprocedure(
       'public.comment_restore_window_code(timestamp with time zone,timestamp with time zone,text)'
     ) is not null then
    raise exception 'DB-1 no aplica: funciones lifecycle ya existen';
  end if;

  if to_regprocedure('public.comments_lifecycle_insert_guard()') is not null
     or exists (
       select 1
       from pg_trigger
       where tgrelid = 'public.comments'::regclass
         and tgname = 'comments_lifecycle_insert_guard_trg'
         and not tgisinternal
     ) then
    raise exception 'DB-1 no aplica: el guard lifecycle de INSERT ya existe';
  end if;

  if to_regclass('public.comments_deleted_entity_idx') is not null
     or to_regclass('public.comment_mentions_unread_idx') is not null then
    raise exception 'DB-1 no aplica: índices lifecycle ya existen';
  end if;

  if not has_table_privilege('authenticated', 'public.comments', 'UPDATE')
     or not has_table_privilege('service_role', 'public.comments', 'UPDATE') then
    raise exception 'DB-1 requiere el camino UPDATE heredado previo a APP/DB-2';
  end if;
end
$preflight$;

-- ── 1. Catálogo AUD aditivo ───────────────────────────────────

insert into public.audit_entity_types (
  entity_type,
  status,
  domain_code,
  contract_version,
  introduced_by_ref
)
values (
  'comment',
  'active',
  'collaboration',
  1,
  'SDD-0168'
);

-- ── 2. Metadatos nullable; cero backfill inventado ───────────

alter table public.comments
  add column deleted_by uuid,
  add column deletion_mode text,
  add column deletion_reason text,
  add column lifecycle_correlation_id uuid,
  add column last_lifecycle_operation_id uuid,
  add column lifecycle_contract_version smallint;

alter table public.comments
  add constraint comments_deletion_mode_check
    check (deletion_mode is null or deletion_mode in ('self', 'moderation')),
  add constraint comments_deletion_reason_check
    check (
      deletion_reason is null
      or char_length(btrim(deletion_reason)) between 1 and 500
    ),
  add constraint comments_lifecycle_contract_version_check
    check (
      lifecycle_contract_version is null
      or lifecycle_contract_version = 1
    );

comment on column public.comments.deleted_by is
  'SDD-0168: actor real de la eliminación gobernada vigente. Sin FK para conservar identidad histórica si el usuario desaparece.';
comment on column public.comments.deletion_mode is
  'SDD-0168: self o moderation para la eliminación gobernada vigente; null en activo y legacy.';
comment on column public.comments.deletion_reason is
  'SDD-0168: razón acotada de moderation; se limpia al restaurar. No incluir PII ni secretos.';
comment on column public.comments.lifecycle_correlation_id is
  'SDD-0168: correlación durable del ciclo delete→restore; permanece al restaurar hasta un nuevo delete.';
comment on column public.comments.last_lifecycle_operation_id is
  'SDD-0168: última operación lifecycle aceptada; acelera replay y detecta conflicto contra AUD.';
comment on column public.comments.lifecycle_contract_version is
  'SDD-0168: versión 1 para filas que atravesaron una transición gobernada; null para historia legacy.';

create index comments_deleted_entity_idx
  on public.comments (
    tenant_id,
    entity_type,
    entity_id,
    deleted_at desc,
    id desc
  )
  where deleted_at is not null;

create index comment_mentions_unread_idx
  on public.comment_mentions (
    tenant_id,
    mentioned_user_id,
    created_at desc,
    id desc
  )
  where read_at is null;

-- ── 3. Guard de INSERT + guard transicional de UPDATE ────────
--
-- Todo comentario nuevo nace activo y sin metadata lifecycle aunque un cliente
-- PostgREST intente forjar columnas que la aplicación no envía.

create function public.comments_lifecycle_insert_guard()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.deleted_at := null;
  new.deleted_by := null;
  new.deletion_mode := null;
  new.deletion_reason := null;
  new.lifecycle_correlation_id := null;
  new.last_lifecycle_operation_id := null;
  new.lifecycle_contract_version := null;
  return new;
end
$function$;

create trigger comments_lifecycle_insert_guard_trg
  before insert on public.comments
  for each row execute function public.comments_lifecycle_insert_guard();

revoke all on function public.comments_lifecycle_insert_guard()
  from public, anon, authenticated, service_role;

-- Sin la marca local que solo fijan las RPC, conserva el comportamiento
-- heredado: body, edited_at y deleted_at siguen mutables; los metadatos nuevos
-- se congelan. Con la marca correcta, permite una transición lifecycle y
-- congela body/edited_at para que dos intenciones no se mezclen.

create or replace function public.comments_freeze_immutable()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_operation_setting text :=
    pg_catalog.current_setting('dtd.comment_lifecycle_operation_id', true);
  v_rpc_transition boolean := false;
begin
  new.tenant_id   := old.tenant_id;
  new.entity_type := old.entity_type;
  new.entity_id   := old.entity_id;
  new.entity_code := old.entity_code;
  new.author_id   := old.author_id;
  new.parent_id   := old.parent_id;
  new.created_at  := old.created_at;

  v_rpc_transition :=
    nullif(v_operation_setting, '') is not null
    and new.last_lifecycle_operation_id is not null
    and v_operation_setting = new.last_lifecycle_operation_id::text;

  if not v_rpc_transition then
    if old.lifecycle_contract_version = 1
       and new.deleted_at is distinct from old.deleted_at then
      new.deleted_at := old.deleted_at;
    end if;
    new.deleted_by := old.deleted_by;
    new.deletion_mode := old.deletion_mode;
    new.deletion_reason := old.deletion_reason;
    new.lifecycle_correlation_id := old.lifecycle_correlation_id;
    new.last_lifecycle_operation_id := old.last_lifecycle_operation_id;
    new.lifecycle_contract_version := old.lifecycle_contract_version;
    return new;
  end if;

  new.body := old.body;
  new.edited_at := old.edited_at;

  if new.lifecycle_contract_version is distinct from 1 then
    raise exception 'Transición lifecycle sin contract_version=1'
      using errcode = 'check_violation';
  end if;

  if old.deleted_at is null and new.deleted_at is not null then
    if new.deleted_by is null
       or new.deletion_mode is null
       or new.lifecycle_correlation_id is null
       or new.last_lifecycle_operation_id is null then
      raise exception 'Eliminación gobernada incompleta'
        using errcode = 'check_violation';
    end if;

    if (new.deletion_mode = 'self' and new.deletion_reason is not null)
       or (
         new.deletion_mode = 'moderation'
         and new.deletion_reason is null
       ) then
      raise exception 'Modo y razón de eliminación inconsistentes'
        using errcode = 'check_violation';
    end if;
  elsif old.deleted_at is not null and new.deleted_at is null then
    if new.deleted_by is not null
       or new.deletion_mode is not null
       or new.deletion_reason is not null
       or new.lifecycle_correlation_id is null
       or new.last_lifecycle_operation_id is null then
      raise exception 'Restauración gobernada incompleta'
        using errcode = 'check_violation';
    end if;

    if old.lifecycle_correlation_id is not null
       and new.lifecycle_correlation_id is distinct from
         old.lifecycle_correlation_id then
      raise exception 'La restauración cambió la correlación del ciclo'
        using errcode = 'check_violation';
    end if;
  else
    raise exception 'Marca lifecycle sin transición de deleted_at'
      using errcode = 'check_violation';
  end if;

  return new;
end
$function$;

-- Clasificador interno y determinista. La RPC aporta una única hora capturada
-- al comenzar; separar la comparación permite probar los bordes exactos sin
-- exponer un reloj controlable al cliente.
create function public.comment_restore_window_code(
  p_deleted_at timestamptz,
  p_now timestamptz,
  p_mode text
)
returns text
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_age interval;
begin
  if p_deleted_at is null
     or p_now is null
     or p_mode is null
     or p_mode not in ('undo', 'ordinary', 'exceptional') then
    raise exception 'deleted_at, now y mode válidos son obligatorios'
      using errcode = '22023';
  end if;

  v_age := p_now - p_deleted_at;

  if v_age < interval '0 seconds' then
    return 'state_conflict';
  end if;

  if v_age > interval '90 days' then
    return 'not_ordinary_restorable';
  end if;

  if p_mode = 'undo' and v_age > interval '10 seconds' then
    return 'undo_expired';
  end if;

  if p_mode = 'ordinary' and v_age > interval '30 days' then
    return 'ordinary_window_expired';
  end if;

  if p_mode = 'exceptional' and v_age <= interval '30 days' then
    return 'state_conflict';
  end if;

  return 'eligible';
end
$function$;

revoke all on function public.comment_restore_window_code(
  timestamptz,
  timestamptz,
  text
) from public, anon, authenticated, service_role;

comment on function public.comment_restore_window_code(
  timestamptz,
  timestamptz,
  text
) is 'SDD-0168: clasificador interno de ventanas 10 s / 30 d / 90 d.';

-- ── 4. RPC de eliminación gobernada ─────────────────────────

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
set lock_timeout = '5s'
set statement_timeout = '30s'
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_role text;
  v_comment public.comments%rowtype;
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_mode text;
  v_action text;
  v_friction text;
  v_correlation_id uuid;
  v_existing_event_type text;
begin
  if p_comment_id is null
     or p_actor_id is null
     or p_tenant_id is null
     or p_operation_id is null then
    raise exception 'comment_id, actor_id, tenant_id y operation_id son obligatorios'
      using errcode = '22023';
  end if;

  if v_reason is not null and pg_catalog.char_length(v_reason) > 500 then
    raise exception 'reason excede 500 caracteres' using errcode = '22023';
  end if;

  select ut.role
    into v_role
  from public.user_tenants as ut
  where ut.user_id = p_actor_id
    and ut.tenant_id = p_tenant_id
    and ut.disabled_at is null;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;

  select c.*
    into v_comment
  from public.comments as c
  where c.id = p_comment_id
    and c.tenant_id = p_tenant_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;

  if v_comment.entity_type not in ('shipment', 'bitacora_task') then
    return pg_catalog.jsonb_build_object(
      'ok', false, 'code', 'unsupported_context'
    );
  end if;

  if v_comment.entity_type = 'shipment' then
    if v_role not in (
      'admin', 'commercial', 'operations', 'accounting', 'warehouse'
    ) or not exists (
      select 1
      from public.shipments as s
      where s.id = v_comment.entity_id
        and s.tenant_id = p_tenant_id
        and s.deleted_at is null
    ) then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_allowed');
    end if;
  elsif v_role not in (
    'admin', 'commercial', 'operations', 'accounting', 'warehouse', 'marketing'
  ) or not exists (
    select 1
    from public.bitacora_tasks as t
    where t.id = v_comment.entity_id
      and t.tenant_id = p_tenant_id
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;

  select log.event_type
    into v_existing_event_type
  from public.entity_audit_log as log
  where log.entity_type = 'comment'
    and log.entity_id = p_comment_id
    and log.payload->>'operation_id' = p_operation_id::text
  order by log.occurred_at desc, log.id desc
  limit 1;

  if found then
    if v_comment.last_lifecycle_operation_id = p_operation_id
       and v_existing_event_type = 'comment_soft_deleted' then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'code', 'idempotent_replay',
        'comment_id', v_comment.id,
        'state', case
          when v_now <= v_comment.deleted_at + interval '10 seconds'
            then 'deleted_undoable'
          else 'deleted_retained'
        end,
        'correlation_id', v_comment.lifecycle_correlation_id,
        'deleted_at', v_comment.deleted_at,
        'undo_expires_at', v_comment.deleted_at + interval '10 seconds'
      );
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', false, 'code', 'operation_conflict'
    );
  end if;

  if v_comment.last_lifecycle_operation_id = p_operation_id
     or v_comment.deleted_at is not null then
    return pg_catalog.jsonb_build_object(
      'ok', false, 'code', 'state_conflict'
    );
  end if;

  if v_comment.author_id = p_actor_id then
    if v_reason is not null then
      raise exception 'La eliminación propia no admite reason'
        using errcode = '22023';
    end if;
    v_mode := 'self';
    v_action := 'self_delete';
    v_friction := 'R1';
  elsif v_role = 'admin' then
    if v_reason is null then
      raise exception 'La moderación exige reason' using errcode = '22023';
    end if;
    v_mode := 'moderation';
    v_action := 'moderation';
    v_friction := 'R2';
  else
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;

  v_correlation_id := gen_random_uuid();

  perform pg_catalog.set_config(
    'dtd.comment_lifecycle_operation_id',
    p_operation_id::text,
    true
  );

  update public.comments
  set deleted_at = v_now,
      deleted_by = p_actor_id,
      deletion_mode = v_mode,
      deletion_reason = v_reason,
      lifecycle_correlation_id = v_correlation_id,
      last_lifecycle_operation_id = p_operation_id,
      lifecycle_contract_version = 1
  where id = v_comment.id
  returning * into v_comment;

  perform pg_catalog.set_config(
    'dtd.comment_lifecycle_operation_id',
    '',
    true
  );

  insert into public.entity_audit_log (
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
    p_tenant_id,
    'comment',
    v_comment.id,
    'user',
    p_actor_id,
    'comment_soft_deleted',
    pg_catalog.jsonb_build_object(
      'schema', 'comment.lifecycle.v1',
      'source', 'studio',
      'result', 'succeeded',
      'sensitivity', 'internal',
      'operation_id', p_operation_id,
      'correlation_id', v_correlation_id,
      'action', v_action,
      'classification', 'P2',
      'friction', v_friction,
      'before', pg_catalog.jsonb_build_object('deleted_at', null),
      'after', pg_catalog.jsonb_build_object('deleted_at', v_now),
      'reason', v_reason
    ),
    v_now
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'code', 'deleted',
    'comment_id', v_comment.id,
    'state', 'deleted_undoable',
    'correlation_id', v_correlation_id,
    'deleted_at', v_now,
    'undo_expires_at', v_now + interval '10 seconds'
  );
end
$function$;

-- ── 5. RPC de restauración gobernada ────────────────────────

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
set lock_timeout = '5s'
set statement_timeout = '30s'
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_role text;
  v_comment public.comments%rowtype;
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_window_code text;
  v_previous_deleted_at timestamptz;
  v_action text;
  v_friction text;
  v_correlation_id uuid;
  v_existing_event_type text;
begin
  if p_comment_id is null
     or p_actor_id is null
     or p_tenant_id is null
     or p_operation_id is null
     or p_mode is null then
    raise exception 'comment_id, actor_id, tenant_id, operation_id y mode son obligatorios'
      using errcode = '22023';
  end if;

  if p_mode not in ('undo', 'ordinary', 'exceptional') then
    raise exception 'mode inválido' using errcode = '22023';
  end if;

  if v_reason is not null and pg_catalog.char_length(v_reason) > 500 then
    raise exception 'reason excede 500 caracteres' using errcode = '22023';
  end if;

  select ut.role
    into v_role
  from public.user_tenants as ut
  where ut.user_id = p_actor_id
    and ut.tenant_id = p_tenant_id
    and ut.disabled_at is null;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;

  select c.*
    into v_comment
  from public.comments as c
  where c.id = p_comment_id
    and c.tenant_id = p_tenant_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;

  if v_comment.entity_type not in ('shipment', 'bitacora_task') then
    return pg_catalog.jsonb_build_object(
      'ok', false, 'code', 'unsupported_context'
    );
  end if;

  if v_comment.entity_type = 'shipment' then
    if v_role not in (
      'admin', 'commercial', 'operations', 'accounting', 'warehouse'
    ) or not exists (
      select 1
      from public.shipments as s
      where s.id = v_comment.entity_id
        and s.tenant_id = p_tenant_id
        and s.deleted_at is null
    ) then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_allowed');
    end if;
  elsif v_role not in (
    'admin', 'commercial', 'operations', 'accounting', 'warehouse', 'marketing'
  ) or not exists (
    select 1
    from public.bitacora_tasks as t
    where t.id = v_comment.entity_id
      and t.tenant_id = p_tenant_id
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;

  select log.event_type
    into v_existing_event_type
  from public.entity_audit_log as log
  where log.entity_type = 'comment'
    and log.entity_id = p_comment_id
    and log.payload->>'operation_id' = p_operation_id::text
  order by log.occurred_at desc, log.id desc
  limit 1;

  if found then
    if v_comment.last_lifecycle_operation_id = p_operation_id
       and v_existing_event_type = 'comment_restored'
       and v_comment.deleted_at is null then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'code', 'idempotent_replay',
        'comment_id', v_comment.id,
        'state', 'active',
        'correlation_id', v_comment.lifecycle_correlation_id,
        'deleted_at', null,
        'undo_expires_at', null
      );
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', false, 'code', 'operation_conflict'
    );
  end if;

  if v_comment.last_lifecycle_operation_id = p_operation_id then
    return pg_catalog.jsonb_build_object(
      'ok', false, 'code', 'operation_conflict'
    );
  end if;

  if v_comment.deleted_at is null then
    return pg_catalog.jsonb_build_object(
      'ok', false, 'code', 'state_conflict'
    );
  end if;

  if v_comment.lifecycle_correlation_id is null then
    if p_expected_correlation_id is not null then
      return pg_catalog.jsonb_build_object(
        'ok', false, 'code', 'operation_conflict'
      );
    end if;
  elsif p_expected_correlation_id is distinct from
    v_comment.lifecycle_correlation_id then
    return pg_catalog.jsonb_build_object(
      'ok', false, 'code', 'operation_conflict'
    );
  end if;

  if p_mode in ('ordinary', 'exceptional') and v_role <> 'admin' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;

  v_previous_deleted_at := v_comment.deleted_at;
  v_window_code := public.comment_restore_window_code(
    v_comment.deleted_at,
    v_now,
    p_mode
  );

  if v_window_code in ('state_conflict', 'not_ordinary_restorable') then
    return pg_catalog.jsonb_build_object(
      'ok', false, 'code', v_window_code
    );
  end if;

  if p_mode = 'undo' then
    if v_comment.deleted_by is null
       or v_comment.lifecycle_correlation_id is null
       or v_comment.deleted_by <> p_actor_id then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_allowed');
    end if;

    if v_window_code <> 'eligible' then
      return pg_catalog.jsonb_build_object(
        'ok', false, 'code', v_window_code
      );
    end if;

    if v_reason is not null then
      raise exception 'undo no admite reason' using errcode = '22023';
    end if;

    v_action := 'undo';
    v_friction := 'R1';
  elsif p_mode = 'ordinary' then
    if v_role <> 'admin' then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_allowed');
    end if;

    if v_window_code <> 'eligible' then
      return pg_catalog.jsonb_build_object(
        'ok', false, 'code', v_window_code
      );
    end if;

    if v_reason is not null then
      raise exception 'ordinary restore no admite reason' using errcode = '22023';
    end if;

    v_action := 'ordinary_restore';
    v_friction := 'R2';
  else
    if v_role <> 'admin' then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_allowed');
    end if;

    if v_window_code <> 'eligible' then
      return pg_catalog.jsonb_build_object(
        'ok', false, 'code', v_window_code
      );
    end if;

    if v_reason is null then
      raise exception 'exceptional restore exige reason' using errcode = '22023';
    end if;

    v_action := 'exceptional_restore';
    v_friction := 'R3';
  end if;

  v_correlation_id := coalesce(
    v_comment.lifecycle_correlation_id,
    gen_random_uuid()
  );

  perform pg_catalog.set_config(
    'dtd.comment_lifecycle_operation_id',
    p_operation_id::text,
    true
  );

  update public.comments
  set deleted_at = null,
      deleted_by = null,
      deletion_mode = null,
      deletion_reason = null,
      lifecycle_correlation_id = v_correlation_id,
      last_lifecycle_operation_id = p_operation_id,
      lifecycle_contract_version = 1
  where id = v_comment.id
  returning * into v_comment;

  perform pg_catalog.set_config(
    'dtd.comment_lifecycle_operation_id',
    '',
    true
  );

  insert into public.entity_audit_log (
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
    p_tenant_id,
    'comment',
    v_comment.id,
    'user',
    p_actor_id,
    'comment_restored',
    pg_catalog.jsonb_build_object(
      'schema', 'comment.lifecycle.v1',
      'source', 'studio',
      'result', 'succeeded',
      'sensitivity', 'internal',
      'operation_id', p_operation_id,
      'correlation_id', v_correlation_id,
      'action', v_action,
      'classification', 'P2',
      'friction', v_friction,
      'before', pg_catalog.jsonb_build_object(
        'deleted_at', v_previous_deleted_at
      ),
      'after', pg_catalog.jsonb_build_object('deleted_at', null),
      'reason', v_reason
    ),
    v_now
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'code', 'restored',
    'comment_id', v_comment.id,
    'state', 'active',
    'correlation_id', v_correlation_id,
    'deleted_at', null,
    'undo_expires_at', null
  );
end
$function$;

-- Las RPC quedan expuestas por PostgREST solo al backend service_role. El
-- navegador no recibe esa clave y no aporta actor/tenant como autoridad.
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

comment on function public.rpc_soft_delete_comment(
  uuid, uuid, uuid, uuid, text
) is
  'SDD-0168 DB-1: soft-delete gobernado, idempotente y atómico con AUD. EXECUTE solo service_role; actor/tenant se revalidan en DB.';

comment on function public.rpc_restore_comment(
  uuid, uuid, uuid, uuid, uuid, text, text
) is
  'SDD-0168 DB-1: undo/restore ordinario/excepcional con reloj DB, correlación, idempotencia y AUD atómico. EXECUTE solo service_role.';

-- ── 6. Postcondiciones DB-1 ──────────────────────────────────

do $postconditions$
declare
  v_nullable_count integer;
begin
  if not exists (
    select 1
    from public.audit_entity_types
    where entity_type = 'comment'
      and status = 'active'
      and domain_code = 'collaboration'
      and contract_version = 1
      and introduced_by_ref = 'SDD-0168'
      and deprecated_at is null
  ) then
    raise exception 'DB-1: comment no quedó registrado con el contrato exacto';
  end if;

  select count(*)
    into v_nullable_count
  from pg_attribute
  where attrelid = 'public.comments'::regclass
    and attname = any (array[
      'deleted_by',
      'deletion_mode',
      'deletion_reason',
      'lifecycle_correlation_id',
      'last_lifecycle_operation_id',
      'lifecycle_contract_version'
    ])
    and not attisdropped
    and not attnotnull
    and atthasdef = false;

  if v_nullable_count <> 6 then
    raise exception 'DB-1: las seis columnas deben quedar nullable y sin default';
  end if;

  if to_regclass('public.comments_deleted_entity_idx') is null
     or to_regclass('public.comment_mentions_unread_idx') is null then
    raise exception 'DB-1: faltan índices lifecycle';
  end if;

  if to_regprocedure('public.comments_lifecycle_insert_guard()') is null
     or not exists (
       select 1
       from pg_trigger
       where tgrelid = 'public.comments'::regclass
         and tgname = 'comments_lifecycle_insert_guard_trg'
         and not tgisinternal
     ) then
    raise exception 'DB-1: falta el guard lifecycle de INSERT';
  end if;

  if to_regprocedure(
       'public.rpc_soft_delete_comment(uuid,uuid,uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.rpc_restore_comment(uuid,uuid,uuid,uuid,uuid,text,text)'
     ) is null
     or to_regprocedure(
       'public.comment_restore_window_code(timestamp with time zone,timestamp with time zone,text)'
     ) is null then
    raise exception 'DB-1: faltan funciones lifecycle';
  end if;

  if has_function_privilege(
       'anon',
       'public.comment_restore_window_code(timestamp with time zone,timestamp with time zone,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.comment_restore_window_code(timestamp with time zone,timestamp with time zone,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.comment_restore_window_code(timestamp with time zone,timestamp with time zone,text)',
       'EXECUTE'
     ) then
    raise exception 'DB-1: el clasificador interno quedó expuesto';
  end if;

  if has_function_privilege(
       'anon',
       'public.rpc_soft_delete_comment(uuid,uuid,uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.rpc_soft_delete_comment(uuid,uuid,uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.rpc_restore_comment(uuid,uuid,uuid,uuid,uuid,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.rpc_restore_comment(uuid,uuid,uuid,uuid,uuid,text,text)',
       'EXECUTE'
     ) then
    raise exception 'DB-1: anon/authenticated no pueden ejecutar RPCs lifecycle';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.rpc_soft_delete_comment(uuid,uuid,uuid,uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.rpc_restore_comment(uuid,uuid,uuid,uuid,uuid,text,text)',
       'EXECUTE'
     ) then
    raise exception 'DB-1: service_role debe ejecutar ambas RPCs';
  end if;

  if not has_table_privilege('authenticated', 'public.comments', 'UPDATE')
     or not has_table_privilege('service_role', 'public.comments', 'UPDATE') then
    raise exception 'DB-1: el camino heredado debe permanecer hasta APP/DB-2';
  end if;
end
$postconditions$;

reset statement_timeout;
reset lock_timeout;
