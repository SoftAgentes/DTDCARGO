\set ON_ERROR_STOP on

\if :{?DRIFT_POLICY}
\else
  \set DRIFT_POLICY false
\endif
\if :{?DRIFT_GRANT}
\else
  \set DRIFT_GRANT false
\endif
\if :{?DRIFT_GUARD}
\else
  \set DRIFT_GUARD false
\endif
\if :{?DRIFT_RPC_ACL}
\else
  \set DRIFT_RPC_ACL false
\endif

-- Contrato autocontenido de SDD-0168 DB-2. Se ejecuta en PostgreSQL
-- desechable, no usa filas reales y termina siempre con ROLLBACK.
begin;

create extension if not exists pgcrypto;
create schema if not exists auth;

do $roles$
begin
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

grant usage on schema public, auth to anon, authenticated, service_role;

create function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $function$
  select nullif(
    pg_catalog.current_setting('request.jwt.claim.sub', true),
    ''
  )::uuid
$function$;

grant execute on function auth.uid()
  to anon, authenticated, service_role;

create table public.tenants (
  id uuid primary key
);

create table public.user_tenants (
  user_id uuid not null,
  tenant_id uuid not null references public.tenants(id),
  role text not null,
  disabled_at timestamptz,
  primary key (user_id, tenant_id)
);

alter table public.user_tenants enable row level security;
create policy "users see active own membership"
  on public.user_tenants for select to authenticated
  using (
    user_id = (select auth.uid())
    and disabled_at is null
  );
grant select on public.user_tenants to authenticated;
grant all on public.user_tenants to service_role;

create function public.get_user_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select ut.tenant_id
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid())
    and ut.disabled_at is null
  limit 1
$function$;

revoke all on function public.get_user_tenant_id()
  from public, anon, service_role;
grant execute on function public.get_user_tenant_id()
  to authenticated;

create table public.audit_entity_types (
  entity_type text primary key,
  status text not null,
  domain_code text not null,
  contract_version integer not null,
  introduced_by_ref text not null,
  deprecated_at timestamptz
);

insert into public.audit_entity_types (
  entity_type,
  status,
  domain_code,
  contract_version,
  introduced_by_ref,
  deprecated_at
)
values (
  'comment',
  'active',
  'collaboration',
  1,
  'SDD-0168',
  null
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  entity_type text not null,
  entity_id uuid not null,
  entity_code text,
  author_id uuid,
  body text not null,
  parent_id uuid references public.comments(id),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_mode text,
  deletion_reason text,
  lifecycle_correlation_id uuid,
  last_lifecycle_operation_id uuid,
  lifecycle_contract_version integer
);

create table public.comment_mentions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id),
  tenant_id uuid not null references public.tenants(id),
  mentioned_user_id uuid not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id),
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null,
  emoji text not null,
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;
alter table public.comment_mentions enable row level security;
alter table public.comment_reactions enable row level security;

-- Estado exacto de policies previo a DB-2.
create policy "comments_tenant_select"
  on public.comments for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

create policy "comments_author_insert"
  on public.comments for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and author_id = (select auth.uid())
  );

create policy "comments_author_or_admin_update"
  on public.comments for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (
      author_id = (select auth.uid())
      or exists (
        select 1
        from public.user_tenants as ut
        where ut.user_id = (select auth.uid())
          and ut.tenant_id = comments.tenant_id
          and ut.role = 'admin'
          and ut.disabled_at is null
      )
    )
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
  );

create policy "comments_no_hard_delete"
  on public.comments for delete to authenticated
  using (false);

create policy "comments_service_role_all"
  on public.comments for all to service_role
  using (true)
  with check (true);

create policy "comment_mentions_tenant_select"
  on public.comment_mentions for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

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
    )
  );

create policy "comment_mentions_owner_update"
  on public.comment_mentions for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and mentioned_user_id = (select auth.uid())
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and mentioned_user_id = (select auth.uid())
  );

create policy "comment_mentions_no_delete"
  on public.comment_mentions for delete to authenticated
  using (false);

create policy "comment_mentions_service_role_all"
  on public.comment_mentions for all to service_role
  using (true)
  with check (true);

create policy "comment_reactions_tenant_select"
  on public.comment_reactions for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

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
    )
  );

create policy "comment_reactions_owner_delete"
  on public.comment_reactions for delete to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and user_id = (select auth.uid())
  );

create policy "comment_reactions_service_role_all"
  on public.comment_reactions for all to service_role
  using (true)
  with check (true);

grant select, insert, update
  on public.comments, public.comment_mentions
  to authenticated;
grant select, insert, delete
  on public.comment_reactions
  to authenticated;

grant all on public.comments, public.comment_mentions, public.comment_reactions
  to service_role;

-- Guard de INSERT y guard transicional de DB-1.
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

create function public.comments_freeze_immutable()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_operation_setting text :=
    pg_catalog.current_setting('dtd.comment_lifecycle_operation_id', true);
  v_rpc_transition boolean := false;
begin
  new.tenant_id := old.tenant_id;
  new.entity_type := old.entity_type;
  new.entity_id := old.entity_id;
  new.entity_code := old.entity_code;
  new.author_id := old.author_id;
  new.parent_id := old.parent_id;
  new.created_at := old.created_at;

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
  elsif old.deleted_at is not null and new.deleted_at is null then
    if new.deleted_by is not null
       or new.deletion_mode is not null
       or new.deletion_reason is not null
       or new.lifecycle_correlation_id is null
       or new.last_lifecycle_operation_id is null then
      raise exception 'Restauración gobernada incompleta'
        using errcode = 'check_violation';
    end if;
  else
    raise exception 'Marca lifecycle sin transición de deleted_at'
      using errcode = 'check_violation';
  end if;

  return new;
end
$function$;

create trigger comments_freeze_immutable_trg
  before update on public.comments
  for each row execute function public.comments_freeze_immutable();

-- RPCs mínimas owner-controlled para demostrar que DB-2 cierra el acceso
-- directo sin romper el camino gobernado. DB-1 prueba el contrato completo.
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
declare
  v_correlation_id uuid := gen_random_uuid();
begin
  perform pg_catalog.set_config(
    'dtd.comment_lifecycle_operation_id',
    p_operation_id::text,
    true
  );

  update public.comments
  set deleted_at = pg_catalog.clock_timestamp(),
      deleted_by = p_actor_id,
      deletion_mode = case
        when p_reason is null then 'self'
        else 'moderation'
      end,
      deletion_reason = p_reason,
      lifecycle_correlation_id = v_correlation_id,
      last_lifecycle_operation_id = p_operation_id,
      lifecycle_contract_version = 1
  where id = p_comment_id
    and tenant_id = p_tenant_id;

  perform pg_catalog.set_config(
    'dtd.comment_lifecycle_operation_id',
    '',
    true
  );

  return jsonb_build_object(
    'ok', true,
    'correlation_id', v_correlation_id
  );
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
      lifecycle_correlation_id = p_expected_correlation_id,
      last_lifecycle_operation_id = p_operation_id,
      lifecycle_contract_version = 1
  where id = p_comment_id
    and tenant_id = p_tenant_id;

  perform pg_catalog.set_config(
    'dtd.comment_lifecycle_operation_id',
    '',
    true
  );

  return jsonb_build_object('ok', true);
end
$function$;

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

insert into public.tenants (id)
values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');

insert into public.user_tenants (
  user_id, tenant_id, role, disabled_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'operations',
    null
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'admin',
    null
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'operations',
    null
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'operations',
    '2026-07-23 00:00:00+00'
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000002',
    'admin',
    null
  );

insert into public.comments (
  id, tenant_id, entity_type, entity_id, author_id, body
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'shipment',
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Comentario del autor'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'shipment',
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    'Comentario de otra persona'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    'shipment',
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000005',
    'Comentario de otro tenant'
  );

insert into public.comment_mentions (
  id, comment_id, tenant_id, mentioned_user_id
)
values (
  '60000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000003'
);

insert into public.comment_reactions (
  id, comment_id, tenant_id, user_id, emoji
)
values (
  '70000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000003',
  '✓'
);

-- Variantes negativas: cada una se ejecuta en un PostgreSQL desechable
-- separado y debe abortar dentro del preflight, antes del primer DROP POLICY.
\if :DRIFT_POLICY
  drop policy "comments_no_hard_delete" on public.comments;
\endif

\if :DRIFT_GRANT
  revoke insert on public.comments from authenticated;
\endif

\if :DRIFT_GUARD
  alter function public.comments_freeze_immutable() security definer;
\endif

\if :DRIFT_RPC_ACL
  grant execute on function public.rpc_soft_delete_comment(
    uuid, uuid, uuid, uuid, text
  ) to authenticated;
\endif

\ir ../migrations/0265_comments_lifecycle_hardening.sql

-- ── 1. ACL y guard exactos ───────────────────────────────────

do $acl$
declare
  v_columns text[];
begin
  if has_table_privilege(
       'authenticated', 'public.comments', 'UPDATE'
     )
     or not has_column_privilege(
       'authenticated', 'public.comments', 'body', 'UPDATE'
     )
     or not has_column_privilege(
       'authenticated', 'public.comments', 'edited_at', 'UPDATE'
     )
     or has_column_privilege(
       'authenticated', 'public.comments', 'deleted_at', 'UPDATE'
     ) then
    raise exception 'TEST 0265: ACL columnar authenticated incorrecto';
  end if;

  select array_agg(a.attname order by a.attname)
    into v_columns
  from pg_attribute as a
  where a.attrelid = 'public.comments'::regclass
    and a.attnum > 0
    and not a.attisdropped
    and has_column_privilege(
      'authenticated', 'public.comments', a.attname, 'UPDATE'
    );

  if v_columns is distinct from array['body', 'edited_at']::text[] then
    raise exception 'TEST 0265: columnas UPDATE inesperadas: %', v_columns;
  end if;

  if has_table_privilege(
       'service_role', 'public.comments', 'UPDATE'
     )
     or has_table_privilege(
       'service_role', 'public.comments', 'DELETE'
     )
     or has_table_privilege(
       'service_role', 'public.comments', 'TRUNCATE'
     ) then
    raise exception 'TEST 0265: service_role conserva bypass directo';
  end if;

  if has_function_privilege(
       'anon', 'public.comments_freeze_immutable()', 'EXECUTE'
     )
     or has_function_privilege(
       'authenticated', 'public.comments_freeze_immutable()', 'EXECUTE'
     )
     or has_function_privilege(
       'service_role', 'public.comments_freeze_immutable()', 'EXECUTE'
     ) then
    raise exception 'TEST 0265: guard trigger invocable directamente';
  end if;
end
$acl$;

-- Incluso el owner queda bloqueado por el guard si no existe marca RPC.
do $strict_guard$
begin
  begin
    update public.comments
    set deleted_at = pg_catalog.clock_timestamp()
    where id = '30000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0265: owner cambió lifecycle sin RPC';
  exception
    when insufficient_privilege then null;
  end;
end
$strict_guard$;

-- ── 2. Edición normal, rol, disabled y tenant ────────────────

set local "request.jwt.claim.sub" =
  '10000000-0000-0000-0000-000000000001';
set local role authenticated;

update public.comments
set body = 'Comentario editado',
    edited_at = pg_catalog.clock_timestamp()
where id = '30000000-0000-0000-0000-000000000001';

do $author_edit$
begin
  if not exists (
    select 1
    from public.comments
    where id = '30000000-0000-0000-0000-000000000001'
      and body = 'Comentario editado'
      and edited_at is not null
  ) then
    raise exception 'TEST 0265: el autor no pudo editar body/edited_at';
  end if;

  begin
    update public.comments
    set deleted_at = pg_catalog.clock_timestamp()
    where id = '30000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0265: authenticated cambió deleted_at';
  exception
    when insufficient_privilege then null;
  end;
end
$author_edit$;

reset role;
set local "request.jwt.claim.sub" =
  '10000000-0000-0000-0000-000000000002';
set local role authenticated;

do $admin_cannot_edit_other$
declare
  v_rows integer;
begin
  update public.comments
  set body = 'Edición admin directa'
  where id = '30000000-0000-0000-0000-000000000001';
  get diagnostics v_rows = row_count;

  if v_rows <> 0 then
    raise exception 'TEST 0265: admin editó directamente comentario ajeno';
  end if;
end
$admin_cannot_edit_other$;

reset role;
set local "request.jwt.claim.sub" =
  '10000000-0000-0000-0000-000000000004';
set local role authenticated;

do $disabled$
begin
  if exists (
    select 1
    from public.comments
    where tenant_id = '00000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'TEST 0265: usuario deshabilitado conserva lectura';
  end if;
end
$disabled$;

reset role;
set local "request.jwt.claim.sub" =
  '10000000-0000-0000-0000-000000000005';
set local role authenticated;

do $cross_tenant$
begin
  if exists (
    select 1
    from public.comments
    where tenant_id = '00000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'TEST 0265: tenant cruzado conserva lectura';
  end if;
end
$cross_tenant$;

-- ── 3. Relaciones activas funcionan; eliminadas fallan cerrado ───────────

reset role;
set local "request.jwt.claim.sub" =
  '10000000-0000-0000-0000-000000000003';
set local role authenticated;

update public.comment_mentions
set read_at = pg_catalog.clock_timestamp()
where id = '60000000-0000-0000-0000-000000000001';

insert into public.comment_reactions (
  id, comment_id, tenant_id, user_id, emoji
)
values (
  '70000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000003',
  '👍'
);

delete from public.comment_reactions
where id = '70000000-0000-0000-0000-000000000002';

reset role;
set local role service_role;

do $service_direct_delete$
begin
  begin
    delete from public.comments
    where id = '30000000-0000-0000-0000-000000000001';
    raise exception 'TEST 0265: service_role hizo DELETE directo';
  exception
    when insufficient_privilege then null;
  end;
end
$service_direct_delete$;

select public.rpc_soft_delete_comment(
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '80000000-0000-0000-0000-000000000001',
  null
);

reset role;
set local "request.jwt.claim.sub" =
  '10000000-0000-0000-0000-000000000003';
set local role authenticated;

do $hidden_parent$
declare
  v_rows integer;
begin
  if exists (
    select 1
    from public.comments
    where id = '30000000-0000-0000-0000-000000000001'
  )
     or exists (
       select 1
       from public.comment_mentions
       where id = '60000000-0000-0000-0000-000000000001'
     )
     or exists (
       select 1
       from public.comment_reactions
       where id = '70000000-0000-0000-0000-000000000001'
     ) then
    raise exception
      'TEST 0265: usuario ajeno ve comentario eliminado o relaciones';
  end if;

  update public.comment_mentions
  set read_at = null
  where id = '60000000-0000-0000-0000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'TEST 0265: se actualizó mención con padre eliminado';
  end if;

  delete from public.comment_reactions
  where id = '70000000-0000-0000-0000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'TEST 0265: se eliminó reacción con padre eliminado';
  end if;

  begin
    insert into public.comment_reactions (
      id, comment_id, tenant_id, user_id, emoji
    )
    values (
      '70000000-0000-0000-0000-000000000003',
      '30000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000003',
      '👀'
    );
    raise exception 'TEST 0265: se insertó reacción con padre eliminado';
  exception
    when insufficient_privilege then null;
  end;
end
$hidden_parent$;

-- Autor conserva la fila solo durante la ventana inmediata.
reset role;
set local "request.jwt.claim.sub" =
  '10000000-0000-0000-0000-000000000001';
set local role authenticated;

do $author_undo_visibility$
begin
  if not exists (
    select 1
    from public.comments
    where id = '30000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'TEST 0265: autor perdió visibilidad de undo';
  end if;
end
$author_undo_visibility$;

-- Admin ve recuperación y puede invocar restore únicamente mediante backend.
reset role;
set local "request.jwt.claim.sub" =
  '10000000-0000-0000-0000-000000000002';
set local role authenticated;

do $admin_recovery_visibility$
begin
  if not exists (
    select 1
    from public.comments
    where id = '30000000-0000-0000-0000-000000000001'
  )
     or not exists (
       select 1
       from public.comment_mentions
       where id = '60000000-0000-0000-0000-000000000001'
     )
     or not exists (
       select 1
       from public.comment_reactions
       where id = '70000000-0000-0000-0000-000000000001'
     ) then
    raise exception 'TEST 0265: admin perdió recuperación o relaciones';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.rpc_restore_comment(uuid,uuid,uuid,uuid,uuid,text,text)',
       'EXECUTE'
     ) then
    raise exception 'TEST 0265: RPC restore expuesta al navegador';
  end if;
end
$admin_recovery_visibility$;

reset role;
set local role service_role;

select public.rpc_restore_comment(
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '80000000-0000-0000-0000-000000000002',
  (
    select lifecycle_correlation_id
    from public.comments
    where id = '30000000-0000-0000-0000-000000000001'
  ),
  'ordinary',
  null
);

reset role;
set local "request.jwt.claim.sub" =
  '10000000-0000-0000-0000-000000000003';
set local role authenticated;

do $restored_relations$
begin
  if not exists (
    select 1
    from public.comments
    where id = '30000000-0000-0000-0000-000000000001'
      and deleted_at is null
  )
     or not exists (
       select 1
       from public.comment_mentions
       where id = '60000000-0000-0000-0000-000000000001'
         and read_at is not null
     )
     or not exists (
       select 1
       from public.comment_reactions
       where id = '70000000-0000-0000-0000-000000000001'
     ) then
    raise exception
      'TEST 0265: restauración no recuperó identidad y relaciones';
  end if;
end
$restored_relations$;

reset role;
rollback;
