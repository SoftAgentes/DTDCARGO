-- ─────────────────────────────────────────────────────────────
-- 0265 · SDD-0168 · DB-2 hardening del ciclo de comentarios
--
-- Cierra el bypass directo conservado deliberadamente por DB-1:
--   · authenticated solo puede editar comments.body/edited_at;
--   · service_role no puede UPDATE/DELETE/TRUNCATE comments directamente;
--   · las transiciones lifecycle pasan únicamente por las RPC owner-controlled;
--   · RLS oculta relaciones cuando el comentario padre no es visible y bloquea
--     mutaciones de menciones/reacciones sobre padres eliminados;
--   · el guard lifecycle deja de tolerar el UPDATE heredado.
--
-- No modifica ACL históricos de otras tablas, defaults globales, purga,
-- hard-delete, ventanas, RBAC de aplicación ni roles no administradores.
--
-- REVISIÓN LOCAL SOLAMENTE. NO AUTORIZADA PARA CLOUD.
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

-- ── 0. Preflight fail-closed sobre DB-1 + APP ────────────────

do $preflight$
declare
  v_policy_contract text[];
  v_function_def text;
begin
  if not exists (select 1 from pg_roles where rolname = 'anon')
     or not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'service_role')
     or not exists (select 1 from pg_roles where rolname = 'postgres') then
    raise exception
      '0265 requiere los roles anon, authenticated, service_role y postgres';
  end if;

  if to_regclass('public.comments') is null
     or to_regclass('public.comment_mentions') is null
     or to_regclass('public.comment_reactions') is null
     or to_regclass('public.user_tenants') is null then
    raise exception
      '0265 requiere comments, relaciones y user_tenants';
  end if;

  if not (
    select bool_and(c.relrowsecurity and c.relkind = 'r')
    from pg_class as c
    where c.oid = any (array[
      'public.comments'::regclass,
      'public.comment_mentions'::regclass,
      'public.comment_reactions'::regclass
    ])
  ) then
    raise exception '0265 requiere RLS activo en las tres tablas';
  end if;

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
    raise exception '0265 requiere el catálogo comment de DB-1';
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'comments'
      and column_name = any (array[
        'deleted_by',
        'deletion_mode',
        'deletion_reason',
        'lifecycle_correlation_id',
        'last_lifecycle_operation_id',
        'lifecycle_contract_version'
      ])
  ) <> 6 then
    raise exception '0265 requiere las seis columnas lifecycle de DB-1';
  end if;

  if to_regprocedure(
       'public.rpc_soft_delete_comment(uuid,uuid,uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.rpc_restore_comment(uuid,uuid,uuid,uuid,uuid,text,text)'
     ) is null
     or to_regprocedure('public.comments_freeze_immutable()') is null
     or to_regprocedure('public.comments_lifecycle_insert_guard()') is null then
    raise exception '0265 requiere las funciones lifecycle de DB-1';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.comments_freeze_immutable()'::regprocedure
      and proowner = 'postgres'::regrole
      and prorettype = 'trigger'::regtype
      and not prosecdef
      and proconfig @> array['search_path=""']::text[]
  ) then
    raise exception '0265 detectó drift en comments_freeze_immutable()';
  end if;

  select pg_get_functiondef(
    'public.comments_freeze_immutable()'::regprocedure
  )
    into v_function_def;

  if v_function_def not like
       '%dtd.comment_lifecycle_operation_id%'
     or v_function_def not like
       '%old.lifecycle_contract_version = 1%'
     or v_function_def not like
       '%new.last_lifecycle_operation_id%' then
    raise exception
      '0265 requiere el guard transicional exacto de DB-1';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.comments'::regclass
      and tgname = 'comments_freeze_immutable_trg'
      and tgfoid = 'public.comments_freeze_immutable()'::regprocedure
      and tgenabled = 'O'
      and not tgisinternal
  ) then
    raise exception '0265 requiere comments_freeze_immutable_trg activo';
  end if;

  select array_agg(
           format('%s:%s:%s', tablename, policyname, cmd)
           order by tablename, policyname, cmd
         )
    into v_policy_contract
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'comments',
      'comment_mentions',
      'comment_reactions'
    );

  if v_policy_contract is distinct from array[
    'comment_mentions:comment_mentions_author_insert:INSERT',
    'comment_mentions:comment_mentions_no_delete:DELETE',
    'comment_mentions:comment_mentions_owner_update:UPDATE',
    'comment_mentions:comment_mentions_service_role_all:ALL',
    'comment_mentions:comment_mentions_tenant_select:SELECT',
    'comment_reactions:comment_reactions_owner_delete:DELETE',
    'comment_reactions:comment_reactions_owner_insert:INSERT',
    'comment_reactions:comment_reactions_service_role_all:ALL',
    'comment_reactions:comment_reactions_tenant_select:SELECT',
    'comments:comments_author_insert:INSERT',
    'comments:comments_author_or_admin_update:UPDATE',
    'comments:comments_no_hard_delete:DELETE',
    'comments:comments_service_role_all:ALL',
    'comments:comments_tenant_select:SELECT'
  ]::text[] then
    raise exception '0265 detectó drift en el inventario de policies';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'comments'
      and policyname = 'comments_author_or_admin_update'
      and roles = array['authenticated']::name[]
      and qual ilike '%author_id%'
      and qual ilike '%user_tenants%'
      and qual ilike '%admin%'
      and qual ilike '%disabled_at IS NULL%'
  ) then
    raise exception
      '0265 requiere la policy UPDATE heredada de comments';
  end if;

  if not has_table_privilege(
       'authenticated', 'public.comments', 'SELECT'
     )
     or not has_table_privilege(
       'authenticated', 'public.comments', 'INSERT'
     )
     or not has_table_privilege(
       'authenticated', 'public.comments', 'UPDATE'
     )
     or has_table_privilege(
       'authenticated', 'public.comments', 'DELETE'
     )
     or has_table_privilege(
       'authenticated', 'public.comments', 'TRUNCATE'
     ) then
    raise exception '0265 detectó ACL authenticated previo inesperado';
  end if;

  if not has_table_privilege(
       'service_role', 'public.comments', 'SELECT'
     )
     or not has_table_privilege(
       'service_role', 'public.comments', 'INSERT'
     )
     or not has_table_privilege(
       'service_role', 'public.comments', 'UPDATE'
     )
     or not has_table_privilege(
       'service_role', 'public.comments', 'DELETE'
     )
     or not has_table_privilege(
       'service_role', 'public.comments', 'TRUNCATE'
     ) then
    raise exception '0265 requiere el ACL service_role previo a DB-2';
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
     or not has_function_privilege(
       'service_role',
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
     )
     or not has_function_privilege(
       'service_role',
       'public.rpc_restore_comment(uuid,uuid,uuid,uuid,uuid,text,text)',
       'EXECUTE'
     ) then
    raise exception '0265 requiere el ACL exacto de las RPC DB-1';
  end if;

  if exists (
    select 1
    from pg_locks
    where not granted
      and relation = any (array[
        'public.comments'::regclass,
        'public.comment_mentions'::regclass,
        'public.comment_reactions'::regclass
      ])
  ) then
    raise exception '0265 detectó locks en espera sobre tablas objetivo';
  end if;
end
$preflight$;

-- ── 1. Visibilidad y edición directa de comments ─────────────

drop policy "comments_tenant_select" on public.comments;
create policy "comments_tenant_select"
  on public.comments for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (
      deleted_at is null
      or exists (
        select 1
        from public.user_tenants as ut
        where ut.user_id = (select auth.uid())
          and ut.tenant_id = comments.tenant_id
          and ut.role = 'admin'
          and ut.disabled_at is null
      )
      or (
        author_id = (select auth.uid())
        and deleted_by = (select auth.uid())
        and deletion_mode = 'self'
        and lifecycle_contract_version = 1
        and pg_catalog.clock_timestamp()
          <= deleted_at + interval '10 seconds'
      )
    )
  );

drop policy "comments_author_or_admin_update" on public.comments;
create policy "comments_author_active_update"
  on public.comments for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and author_id = (select auth.uid())
    and deleted_at is null
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and author_id = (select auth.uid())
    and deleted_at is null
  );

revoke update on table public.comments from authenticated;
grant update (body, edited_at) on table public.comments to authenticated;

revoke update, delete, truncate
  on table public.comments
  from service_role;

-- ── 2. Relaciones condicionadas por el padre visible/activo ─

drop policy "comment_mentions_tenant_select"
  on public.comment_mentions;
create policy "comment_mentions_tenant_select"
  on public.comment_mentions for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and exists (
      select 1
      from public.comments as c
      where c.id = comment_mentions.comment_id
        and c.tenant_id = comment_mentions.tenant_id
    )
  );

drop policy "comment_mentions_author_insert"
  on public.comment_mentions;
create policy "comment_mentions_author_insert"
  on public.comment_mentions for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and exists (
      select 1
      from public.comments as c
      where c.id = comment_mentions.comment_id
        and c.author_id = (select auth.uid())
        and c.tenant_id = comment_mentions.tenant_id
        and c.deleted_at is null
    )
  );

drop policy "comment_mentions_owner_update"
  on public.comment_mentions;
create policy "comment_mentions_owner_update"
  on public.comment_mentions for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and mentioned_user_id = (select auth.uid())
    and exists (
      select 1
      from public.comments as c
      where c.id = comment_mentions.comment_id
        and c.tenant_id = comment_mentions.tenant_id
        and c.deleted_at is null
    )
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and mentioned_user_id = (select auth.uid())
    and exists (
      select 1
      from public.comments as c
      where c.id = comment_mentions.comment_id
        and c.tenant_id = comment_mentions.tenant_id
        and c.deleted_at is null
    )
  );

drop policy "comment_reactions_tenant_select"
  on public.comment_reactions;
create policy "comment_reactions_tenant_select"
  on public.comment_reactions for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and exists (
      select 1
      from public.comments as c
      where c.id = comment_reactions.comment_id
        and c.tenant_id = comment_reactions.tenant_id
    )
  );

drop policy "comment_reactions_owner_insert"
  on public.comment_reactions;
create policy "comment_reactions_owner_insert"
  on public.comment_reactions for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.comments as c
      where c.id = comment_reactions.comment_id
        and c.tenant_id = comment_reactions.tenant_id
        and c.deleted_at is null
    )
  );

drop policy "comment_reactions_owner_delete"
  on public.comment_reactions;
create policy "comment_reactions_owner_delete"
  on public.comment_reactions for delete to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.comments as c
      where c.id = comment_reactions.comment_id
        and c.tenant_id = comment_reactions.tenant_id
        and c.deleted_at is null
    )
  );

-- ── 3. Guard lifecycle estricto ──────────────────────────────

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
    if new.deleted_at is distinct from old.deleted_at
       or new.deleted_by is distinct from old.deleted_by
       or new.deletion_mode is distinct from old.deletion_mode
       or new.deletion_reason is distinct from old.deletion_reason
       or new.lifecycle_correlation_id is distinct from
         old.lifecycle_correlation_id
       or new.last_lifecycle_operation_id is distinct from
         old.last_lifecycle_operation_id
       or new.lifecycle_contract_version is distinct from
         old.lifecycle_contract_version then
      raise exception
        'Cambio lifecycle directo bloqueado por DB-2'
        using errcode = '42501';
    end if;
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

revoke execute on function public.comments_freeze_immutable()
  from public, anon, authenticated, service_role;

comment on function public.comments_freeze_immutable() is
  'SDD-0168 DB-2: congela identidad y rechaza lifecycle directo; solo las RPC owner-controlled pueden cambiar permanencia.';

-- ── 4. Postcondiciones DB-2 ──────────────────────────────────

do $postconditions$
declare
  v_update_columns text[];
  v_function_def text;
begin
  if has_table_privilege(
       'authenticated', 'public.comments', 'UPDATE'
     )
     or has_table_privilege(
       'authenticated', 'public.comments', 'DELETE'
     )
     or has_table_privilege(
       'authenticated', 'public.comments', 'TRUNCATE'
     )
     or not has_table_privilege(
       'authenticated', 'public.comments', 'SELECT'
     )
     or not has_table_privilege(
       'authenticated', 'public.comments', 'INSERT'
     ) then
    raise exception '0265 dejó ACL de tabla incorrecto para authenticated';
  end if;

  select array_agg(a.attname order by a.attname)
    into v_update_columns
  from pg_attribute as a
  where a.attrelid = 'public.comments'::regclass
    and a.attnum > 0
    and not a.attisdropped
    and has_column_privilege(
      'authenticated',
      'public.comments',
      a.attname,
      'UPDATE'
    );

  if v_update_columns is distinct from array['body', 'edited_at']::text[] then
    raise exception
      '0265 dejó UPDATE authenticated en columnas inesperadas: %',
      v_update_columns;
  end if;

  if has_table_privilege(
       'service_role', 'public.comments', 'UPDATE'
     )
     or has_table_privilege(
       'service_role', 'public.comments', 'DELETE'
     )
     or has_table_privilege(
       'service_role', 'public.comments', 'TRUNCATE'
     )
     or not has_table_privilege(
       'service_role', 'public.comments', 'SELECT'
     )
     or not has_table_privilege(
       'service_role', 'public.comments', 'INSERT'
     ) then
    raise exception '0265 dejó ACL directo incorrecto para service_role';
  end if;

  if has_function_privilege(
       'anon',
       'public.comments_freeze_immutable()',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.comments_freeze_immutable()',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.comments_freeze_immutable()',
       'EXECUTE'
     ) then
    raise exception '0265 dejó EXECUTE directo sobre el guard trigger';
  end if;

  select pg_get_functiondef(
    'public.comments_freeze_immutable()'::regprocedure
  )
    into v_function_def;

  if v_function_def not like
       '%Cambio lifecycle directo bloqueado por DB-2%'
     or v_function_def like
       '%old.lifecycle_contract_version = 1%' then
    raise exception '0265 no instaló el guard estricto DB-2';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'comments'
      and policyname = 'comments_author_or_admin_update'
  )
     or not exists (
       select 1
       from pg_policies
       where schemaname = 'public'
         and tablename = 'comments'
         and policyname = 'comments_author_active_update'
         and roles = array['authenticated']::name[]
         and qual ilike '%author_id%'
         and qual ilike '%deleted_at IS NULL%'
         and with_check ilike '%deleted_at IS NULL%'
     )
     or not exists (
       select 1
       from pg_policies
       where schemaname = 'public'
         and tablename = 'comments'
         and policyname = 'comments_tenant_select'
         and qual ilike '%clock_timestamp%'
         and qual ilike '%deleted_by%'
         and qual ilike '%user_tenants%'
         and qual ilike '%admin%'
     ) then
    raise exception '0265 dejó policies comments incorrectas';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'comment_mentions'
      and policyname = 'comment_mentions_tenant_select'
      and qual ilike '%comments%'
  )
     or not exists (
       select 1
       from pg_policies
       where schemaname = 'public'
         and tablename = 'comment_mentions'
         and policyname = 'comment_mentions_author_insert'
         and with_check ilike '%deleted_at IS NULL%'
     )
     or not exists (
       select 1
       from pg_policies
       where schemaname = 'public'
         and tablename = 'comment_mentions'
         and policyname = 'comment_mentions_owner_update'
         and qual ilike '%deleted_at IS NULL%'
         and with_check ilike '%deleted_at IS NULL%'
     )
     or not exists (
       select 1
       from pg_policies
       where schemaname = 'public'
         and tablename = 'comment_reactions'
         and policyname = 'comment_reactions_tenant_select'
         and qual ilike '%comments%'
     )
     or not exists (
       select 1
       from pg_policies
       where schemaname = 'public'
         and tablename = 'comment_reactions'
         and policyname = 'comment_reactions_owner_insert'
         and with_check ilike '%deleted_at IS NULL%'
     )
     or not exists (
       select 1
       from pg_policies
       where schemaname = 'public'
         and tablename = 'comment_reactions'
         and policyname = 'comment_reactions_owner_delete'
         and qual ilike '%deleted_at IS NULL%'
     ) then
    raise exception '0265 dejó policies de relaciones incompletas';
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
     or not has_function_privilege(
       'service_role',
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
     )
     or not has_function_privilege(
       'service_role',
       'public.rpc_restore_comment(uuid,uuid,uuid,uuid,uuid,text,text)',
       'EXECUTE'
     ) then
    raise exception '0265 alteró el ACL de las RPC lifecycle';
  end if;
end
$postconditions$;
