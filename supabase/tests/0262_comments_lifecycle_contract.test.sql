\set ON_ERROR_STOP on

\if :{?DRIFT_RLS}
\else
  \set DRIFT_RLS false
\endif
\if :{?DRIFT_POLICY}
\else
  \set DRIFT_POLICY false
\endif
\if :{?DRIFT_GRANT}
\else
  \set DRIFT_GRANT false
\endif
\if :{?DRIFT_TRIGGER}
\else
  \set DRIFT_TRIGGER false
\endif

-- Prueba contractual autocontenida de SDD-0168 DB-1. Debe ejecutarse sobre
-- una base PostgreSQL desechable y vacía. Toda la fixture, migración y datos
-- viven dentro de esta transacción y terminan siempre con ROLLBACK.
begin;

do $fixture_guard$
begin
  if to_regclass('public.comments') is not null
     or to_regclass('public.entity_audit_log') is not null
     or to_regclass('public.audit_entity_types') is not null then
    raise exception 'Fixture 0262 rechazada: los objetos reales ya existen';
  end if;
end
$fixture_guard$;

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
    create role service_role nologin;
  end if;
end
$roles$;

create table auth.users (
  id uuid primary key
);

create table public.tenants (
  id uuid primary key
);

create table public.user_tenants (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null,
  disabled_at timestamptz,
  primary key (user_id, tenant_id)
);

create table public.shipments (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  deleted_at timestamptz
);

create table public.bitacora_tasks (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade
);

create table public.audit_entity_types (
  entity_type text primary key,
  status text not null default 'active',
  domain_code text not null,
  contract_version smallint not null default 1,
  introduced_by_ref text not null,
  deprecated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint audit_entity_types_key_format_check
    check (entity_type ~ '^[a-z][a-z0-9_]*$'),
  constraint audit_entity_types_status_check
    check (status in ('active', 'deprecated')),
  constraint audit_entity_types_domain_format_check
    check (domain_code ~ '^[a-z][a-z0-9_]*$'),
  constraint audit_entity_types_contract_version_check
    check (contract_version > 0),
  constraint audit_entity_types_introduced_by_ref_check
    check (btrim(introduced_by_ref) <> ''),
  constraint audit_entity_types_deprecation_check
    check (
      (status = 'active' and deprecated_at is null)
      or (status = 'deprecated' and deprecated_at is not null)
    )
);

insert into public.audit_entity_types (
  entity_type,
  status,
  domain_code,
  contract_version,
  introduced_by_ref
)
values ('rendition', 'active', 'finance', 1, 'test:A2');

create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  actor_type text not null check (actor_type in ('user', 'operario', 'system')),
  actor_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint entity_audit_log_entity_type_fkey
    foreign key (entity_type)
    references public.audit_entity_types(entity_type)
    on update restrict
    on delete restrict
);

create index entity_audit_log_entity_idx
  on public.entity_audit_log (entity_type, entity_id, occurred_at desc);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  entity_code text,
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (
    char_length(btrim(body)) > 0 and char_length(body) <= 4000
  ),
  parent_id uuid references public.comments(id) on delete cascade,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint comments_entity_type_check check (entity_type in (
    'shipment',
    'client',
    'invoice',
    'quote',
    'dispatch_order',
    'supplier_bill',
    'warehouse_receipt_cn',
    'warehouse_receipt_ve',
    'bitacora_task'
  ))
);

create table public.comment_mentions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (comment_id, mentioned_user_id)
);

create table public.comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('👍','✓','👀','🔥','❓')),
  created_at timestamptz not null default now(),
  unique (comment_id, user_id, emoji)
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $function$
  select '10000000-0000-0000-0000-000000000001'::uuid
$function$;

create or replace function public.get_user_tenant_id()
returns uuid
language sql
stable
as $function$
  select '00000000-0000-0000-0000-000000000001'::uuid
$function$;

create or replace function public.comment_entity_in_tenant(
  p_entity_type text,
  p_entity_id uuid,
  p_tenant_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  ok boolean := false;
begin
  case p_entity_type
    when 'shipment' then
      select exists(select 1 from public.shipments where id = p_entity_id and tenant_id = p_tenant_id) into ok;
    when 'client' then
      select exists(select 1 from public.clients where id = p_entity_id and tenant_id = p_tenant_id) into ok;
    when 'invoice' then
      select exists(select 1 from public.invoices where id = p_entity_id and tenant_id = p_tenant_id) into ok;
    when 'quote' then
      select exists(select 1 from public.quotes where id = p_entity_id and tenant_id = p_tenant_id) into ok;
    when 'dispatch_order' then
      select exists(select 1 from public.dispatch_orders where id = p_entity_id and tenant_id = p_tenant_id) into ok;
    when 'supplier_bill' then
      select exists(select 1 from public.supplier_bills where id = p_entity_id and tenant_id = p_tenant_id) into ok;
    when 'warehouse_receipt_cn' then
      select exists(select 1 from public.warehouse_receipts_cn where id = p_entity_id and tenant_id = p_tenant_id) into ok;
    when 'warehouse_receipt_ve' then
      select exists(select 1 from public.warehouse_receipts_ve where id = p_entity_id and tenant_id = p_tenant_id) into ok;
    when 'bitacora_task' then
      select exists(select 1 from public.bitacora_tasks where id = p_entity_id and tenant_id = p_tenant_id) into ok;
    else
      ok := false;
  end case;
  return ok;
end
$function$;

create or replace function public.comments_freeze_immutable()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.tenant_id := old.tenant_id;
  new.entity_type := old.entity_type;
  new.entity_id := old.entity_id;
  new.entity_code := old.entity_code;
  new.author_id := old.author_id;
  new.parent_id := old.parent_id;
  new.created_at := old.created_at;
  return new;
end
$function$;

create trigger comments_freeze_immutable_trg
  before update on public.comments
  for each row execute function public.comments_freeze_immutable();

create or replace function public.comments_validate_entity()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if not public.comment_entity_in_tenant(
    new.entity_type,
    new.entity_id,
    new.tenant_id
  ) then
    raise exception 'comentario sobre entidad inexistente o ajena al tenant: %/%',
      new.entity_type,
      new.entity_id
      using errcode = 'check_violation';
  end if;
  return new;
end
$function$;

create trigger comments_validate_entity_trg
  before insert on public.comments
  for each row execute function public.comments_validate_entity();

alter table public.comments enable row level security;
alter table public.comment_mentions enable row level security;
alter table public.comment_reactions enable row level security;

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
        select 1 from public.user_tenants ut
        where ut.user_id = (select auth.uid())
          and ut.tenant_id = comments.tenant_id
          and ut.role = 'admin'
          and ut.disabled_at is null
      )
    )
  )
  with check (tenant_id = (select public.get_user_tenant_id()));

create policy "comments_no_hard_delete"
  on public.comments for delete to authenticated using (false);

create policy "comments_service_role_all"
  on public.comments for all to service_role using (true) with check (true);

create policy "comment_mentions_tenant_select"
  on public.comment_mentions for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

create policy "comment_mentions_author_insert"
  on public.comment_mentions for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and exists (
      select 1 from public.comments c
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
  on public.comment_mentions for delete to authenticated using (false);

create policy "comment_mentions_service_role_all"
  on public.comment_mentions for all to service_role
  using (true) with check (true);

create policy "comment_reactions_tenant_select"
  on public.comment_reactions for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

create policy "comment_reactions_owner_insert"
  on public.comment_reactions for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.comments c
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
  using (true) with check (true);

grant select, insert, update on public.comments to authenticated;
grant select, insert, update on public.comment_mentions to authenticated;
grant select, insert, delete on public.comment_reactions to authenticated;

grant all on public.comments to service_role;
grant all on public.comment_mentions to service_role;
grant all on public.comment_reactions to service_role;

-- ── Fixture preexistente: demuestra cero backfill ────────────

insert into public.tenants (id)
values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');

insert into auth.users (id)
values
  ('10000000-0000-0000-0000-000000000001'), -- author/commercial
  ('10000000-0000-0000-0000-000000000002'), -- admin
  ('10000000-0000-0000-0000-000000000003'), -- support
  ('10000000-0000-0000-0000-000000000004'), -- other tenant admin
  ('10000000-0000-0000-0000-000000000005'); -- disabled admin

insert into public.user_tenants (user_id, tenant_id, role, disabled_at)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'commercial', null),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'admin', null),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'support', null),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'admin', null),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'admin', now());

insert into public.shipments (id, tenant_id)
values (
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001'
);

insert into public.bitacora_tasks (id, tenant_id)
values (
  '20000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001'
);

insert into public.comments (
  id,
  tenant_id,
  entity_type,
  entity_id,
  author_id,
  body,
  deleted_at
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'shipment',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Legacy activo',
    null
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'shipment',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Legacy eliminado',
    clock_timestamp() - interval '5 days'
  );

insert into public.comment_mentions (
  id, comment_id, tenant_id, mentioned_user_id, read_at
)
values (
  '60000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '2026-07-22 10:00:00+00'::timestamptz
);

insert into public.comment_reactions (
  id, comment_id, tenant_id, user_id, emoji
)
values (
  '70000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '✓'
);

-- Variantes negativas: el mismo contrato se ejecuta en procesos desechables
-- separados y debe abortar antes de cualquier DDL de DB-1.
\if :DRIFT_RLS
  alter table public.comments disable row level security;
\endif

\if :DRIFT_POLICY
  drop policy "comments_no_hard_delete" on public.comments;
  create policy "comments_no_hard_delete"
    on public.comments for delete to authenticated using (true);
\endif

\if :DRIFT_GRANT
  revoke insert on public.comments from authenticated;
\endif

\if :DRIFT_TRIGGER
  drop trigger comments_validate_entity_trg on public.comments;
\endif

\ir ../migrations/0262_comments_lifecycle_contract.sql

-- ── 1. Forma, ACL y cero backfill ────────────────────────────

do $shape$
declare
  v_null_legacy integer;
begin
  if not exists (
    select 1
    from public.audit_entity_types
    where entity_type = 'comment'
      and status = 'active'
      and domain_code = 'collaboration'
      and contract_version = 1
      and introduced_by_ref = 'SDD-0168'
  ) then
    raise exception 'TEST 0262: catálogo comment incorrecto';
  end if;

  select count(*)
    into v_null_legacy
  from public.comments
  where id in (
    '30000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002'
  )
    and deleted_by is null
    and deletion_mode is null
    and deletion_reason is null
    and lifecycle_correlation_id is null
    and last_lifecycle_operation_id is null
    and lifecycle_contract_version is null;

  if v_null_legacy <> 2 then
    raise exception 'TEST 0262: se inventó metadata para filas legacy';
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
    raise exception 'TEST 0262: RPC expuesta a anon/authenticated';
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
    raise exception 'TEST 0262: service_role sin EXECUTE';
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
    raise exception 'TEST 0262: clasificador de ventanas expuesto';
  end if;
end
$shape$;

-- ── 1.b Bordes exactos con reloj DB fijo ───────────────────

do $exact_boundaries$
declare
  v_now constant timestamptz := '2026-07-22 12:00:00+00'::timestamptz;
begin
  begin
    perform public.comment_restore_window_code(
      v_now - interval '1 second', v_now, null
    );
    raise exception 'TEST 0262: mode null fue aceptado';
  exception
    when invalid_parameter_value then null;
  end;

  if public.comment_restore_window_code(
       v_now - interval '9.999 seconds', v_now, 'undo'
     ) <> 'eligible'
     or public.comment_restore_window_code(
       v_now - interval '10.001 seconds', v_now, 'undo'
     ) <> 'undo_expired' then
    raise exception 'TEST 0262: borde exacto de 10 segundos incorrecto';
  end if;

  if public.comment_restore_window_code(
       v_now - interval '30 days', v_now, 'ordinary'
     ) <> 'eligible'
     or public.comment_restore_window_code(
       v_now - interval '30 days 0.000001 seconds', v_now, 'ordinary'
     ) <> 'ordinary_window_expired'
     or public.comment_restore_window_code(
       v_now - interval '30 days', v_now, 'exceptional'
     ) <> 'state_conflict'
     or public.comment_restore_window_code(
       v_now - interval '30 days 0.000001 seconds', v_now, 'exceptional'
     ) <> 'eligible' then
    raise exception 'TEST 0262: borde exacto de 30 días incorrecto';
  end if;

  if public.comment_restore_window_code(
       v_now - interval '90 days', v_now, 'exceptional'
     ) <> 'eligible'
     or public.comment_restore_window_code(
       v_now - interval '90 days 0.000001 seconds', v_now, 'exceptional'
     ) <> 'not_ordinary_restorable' then
    raise exception 'TEST 0262: borde exacto de 90 días incorrecto';
  end if;
end
$exact_boundaries$;

-- ── 2. Guard transicional: deleted_at legacy sí; metadata forjada no ───────

update public.comments
set deleted_at = clock_timestamp(),
    deleted_by = '10000000-0000-0000-0000-000000000002',
    deletion_mode = 'moderation',
    deletion_reason = 'forjado',
    lifecycle_correlation_id = gen_random_uuid(),
    last_lifecycle_operation_id = gen_random_uuid(),
    lifecycle_contract_version = 1
where id = '30000000-0000-0000-0000-000000000001';

do $transitional_guard$
begin
  if not exists (
    select 1
    from public.comments
    where id = '30000000-0000-0000-0000-000000000001'
      and deleted_at is not null
      and deleted_by is null
      and deletion_mode is null
      and deletion_reason is null
      and lifecycle_correlation_id is null
      and last_lifecycle_operation_id is null
      and lifecycle_contract_version is null
  ) then
    raise exception 'TEST 0262: el guard transicional no congeló metadata';
  end if;
end
$transitional_guard$;

-- El rol de aplicación puede insertar aunque la función trigger no sea
-- invocable directamente; el guard debe ejecutarse por la vía del trigger.
grant insert on public.comments to authenticated;
set local role authenticated;

insert into public.comments (
  id,
  tenant_id,
  entity_type,
  entity_id,
  author_id,
  body,
  deleted_at,
  deleted_by,
  deletion_mode,
  deletion_reason,
  lifecycle_correlation_id,
  last_lifecycle_operation_id,
  lifecycle_contract_version
)
values (
  '30000000-0000-0000-0000-000000000009',
  '00000000-0000-0000-0000-000000000001',
  'shipment',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'INSERT forjado',
  clock_timestamp(),
  '10000000-0000-0000-0000-000000000002',
  'moderation',
  'No debe persistir',
  gen_random_uuid(),
  gen_random_uuid(),
  1
);

reset role;

do $insert_guard$
begin
  if not exists (
    select 1
    from public.comments
    where id = '30000000-0000-0000-0000-000000000009'
      and deleted_at is null
      and deleted_by is null
      and deletion_mode is null
      and deletion_reason is null
      and lifecycle_correlation_id is null
      and last_lifecycle_operation_id is null
      and lifecycle_contract_version is null
  ) then
    raise exception 'TEST 0262: INSERT forjó estado lifecycle';
  end if;
end
$insert_guard$;

-- La fila se reutiliza como activo para las pruebas gobernadas.
update public.comments
set deleted_at = null
where id = '30000000-0000-0000-0000-000000000001';

-- ── 3. Eliminación propia, auditoría mínima y replay ─────────

do $self_delete$
declare
  v_result jsonb;
  v_correlation uuid;
  v_audit_count integer;
begin
  v_result := public.rpc_soft_delete_comment(
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    null
  );

  if v_result->>'code' <> 'deleted'
     or v_result->>'state' <> 'deleted_undoable' then
    raise exception 'TEST 0262: self-delete falló: %', v_result;
  end if;

  select lifecycle_correlation_id
    into v_correlation
  from public.comments
  where id = '30000000-0000-0000-0000-000000000001'
    and deleted_by = '10000000-0000-0000-0000-000000000001'
    and deletion_mode = 'self'
    and deletion_reason is null
    and lifecycle_contract_version = 1;

  if v_correlation is null then
    raise exception 'TEST 0262: self-delete no persistió metadata';
  end if;

  update public.comments
  set deleted_at = null,
      deleted_by = null,
      lifecycle_contract_version = null
  where id = '30000000-0000-0000-0000-000000000001';

  if not exists (
    select 1
    from public.comments
    where id = '30000000-0000-0000-0000-000000000001'
      and deleted_at is not null
      and deleted_by = '10000000-0000-0000-0000-000000000001'
      and lifecycle_contract_version = 1
  ) then
    raise exception 'TEST 0262: UPDATE directo alteró una fila gobernada';
  end if;

  if exists (
    select 1
    from public.entity_audit_log
    where entity_type = 'comment'
      and entity_id = '30000000-0000-0000-0000-000000000001'
      and (
        payload ? 'body'
        or payload ? 'email'
        or payload ? 'mentions'
      )
  ) then
    raise exception 'TEST 0262: payload audit contiene contenido prohibido';
  end if;

  v_result := public.rpc_soft_delete_comment(
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    null
  );

  select count(*)
    into v_audit_count
  from public.entity_audit_log
  where entity_type = 'comment'
    and entity_id = '30000000-0000-0000-0000-000000000001'
    and payload->>'operation_id' = '40000000-0000-0000-0000-000000000001';

  if v_result->>'code' <> 'idempotent_replay' or v_audit_count <> 1 then
    raise exception 'TEST 0262: replay duplicó o falló: %, %', v_result, v_audit_count;
  end if;
end
$self_delete$;

-- ── 4. Undo real y correlación preservada ────────────────────

do $undo$
declare
  v_correlation uuid;
  v_result jsonb;
begin
  select lifecycle_correlation_id
    into v_correlation
  from public.comments
  where id = '30000000-0000-0000-0000-000000000001';

  v_result := public.rpc_restore_comment(
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    v_correlation,
    'undo',
    null
  );

  if v_result->>'code' <> 'restored'
     or not exists (
       select 1
       from public.comments
       where id = '30000000-0000-0000-0000-000000000001'
         and deleted_at is null
         and deleted_by is null
         and deletion_mode is null
         and deletion_reason is null
         and lifecycle_correlation_id = v_correlation
         and last_lifecycle_operation_id =
           '40000000-0000-0000-0000-000000000002'
     ) then
    raise exception 'TEST 0262: undo no restauró el mismo registro: %', v_result;
  end if;

  if not exists (
       select 1
       from public.comment_mentions
       where id = '60000000-0000-0000-0000-000000000001'
         and comment_id = '30000000-0000-0000-0000-000000000001'
         and read_at = '2026-07-22 10:00:00+00'::timestamptz
     )
     or not exists (
       select 1
       from public.comment_reactions
       where id = '70000000-0000-0000-0000-000000000001'
         and comment_id = '30000000-0000-0000-0000-000000000001'
         and user_id = '10000000-0000-0000-0000-000000000002'
         and emoji = '✓'
     ) then
    raise exception 'TEST 0262: restauración alteró menciones o reacciones';
  end if;
end
$undo$;

-- ── 5. Permisos: support, disabled y tenant cruzado fallan cerrado ─────────

do $denials$
declare
  v_result jsonb;
begin
  v_result := public.rpc_soft_delete_comment(
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000003',
    null
  );
  if v_result->>'code' <> 'not_allowed' then
    raise exception 'TEST 0262: support no falló cerrado: %', v_result;
  end if;

  v_result := public.rpc_soft_delete_comment(
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000004',
    'No debe aplicar'
  );
  if v_result->>'code' <> 'not_allowed' then
    raise exception 'TEST 0262: disabled no falló cerrado: %', v_result;
  end if;

  v_result := public.rpc_soft_delete_comment(
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000005',
    'No debe aplicar'
  );
  if v_result->>'code' <> 'not_allowed' then
    raise exception 'TEST 0262: tenant cruzado no falló cerrado: %', v_result;
  end if;
end
$denials$;

-- ── 6. Moderación admin exige razón ──────────────────────────

insert into public.comments (
  id, tenant_id, entity_type, entity_id, author_id, body
)
values (
  '30000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'bitacora_task',
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  'Moderable'
);

do $moderation$
declare
  v_result jsonb;
begin
  v_result := public.rpc_soft_delete_comment(
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000006',
    'No debe aplicar'
  );
  if v_result->>'code' <> 'not_allowed' then
    raise exception 'TEST 0262: autor no admin moderó comentario ajeno: %', v_result;
  end if;

  begin
    perform public.rpc_soft_delete_comment(
      '30000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000017',
      null
    );
    raise exception 'TEST 0262: moderación sin razón fue aceptada';
  exception
    when invalid_parameter_value then null;
  end;

  v_result := public.rpc_soft_delete_comment(
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000007',
    'Incumple el uso interno'
  );

  if v_result->>'code' <> 'deleted'
     or not exists (
       select 1
       from public.comments
       where id = '30000000-0000-0000-0000-000000000003'
         and deletion_mode = 'moderation'
         and deletion_reason = 'Incumple el uso interno'
         and deleted_by = '10000000-0000-0000-0000-000000000002'
     ) then
    raise exception 'TEST 0262: moderación con razón falló: %', v_result;
  end if;
end
$moderation$;

-- ── 7. Ventanas 10 s / 30 d / 90 d ──────────────────────────

-- Estados gobernados controlados por fixture. Se insertan ya eliminados para
-- no debilitar el guard: una fila contract_version=1 no puede retimbrarse por
-- UPDATE directo, ni siquiera durante DB-1.
alter table public.comments
  disable trigger comments_lifecycle_insert_guard_trg;

insert into public.comments (
  id,
  tenant_id,
  entity_type,
  entity_id,
  author_id,
  body,
  deleted_at,
  deleted_by,
  deletion_mode,
  deletion_reason,
  lifecycle_correlation_id,
  last_lifecycle_operation_id,
  lifecycle_contract_version
)
values
  (
    '30000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'shipment',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Undo expirado',
    clock_timestamp() - interval '11 seconds',
    '10000000-0000-0000-0000-000000000002',
    'moderation',
    'Fixture controlada',
    '50000000-0000-0000-0000-000000000005',
    '41000000-0000-0000-0000-000000000005',
    1
  ),
  (
    '30000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'shipment',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Restore ordinario',
    clock_timestamp() - interval '20 days',
    '10000000-0000-0000-0000-000000000002',
    'moderation',
    'Fixture controlada',
    '50000000-0000-0000-0000-000000000006',
    '41000000-0000-0000-0000-000000000006',
    1
  ),
  (
    '30000000-0000-0000-0000-000000000007',
    '00000000-0000-0000-0000-000000000001',
    'shipment',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Restore excepcional',
    clock_timestamp() - interval '31 days',
    '10000000-0000-0000-0000-000000000002',
    'moderation',
    'Fixture controlada',
    '50000000-0000-0000-0000-000000000007',
    '41000000-0000-0000-0000-000000000007',
    1
  ),
  (
    '30000000-0000-0000-0000-000000000008',
    '00000000-0000-0000-0000-000000000001',
    'shipment',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Retenido >90 días',
    clock_timestamp() - interval '91 days',
    '10000000-0000-0000-0000-000000000002',
    'moderation',
    'Fixture controlada',
    '50000000-0000-0000-0000-000000000008',
    '41000000-0000-0000-0000-000000000008',
    1
  );

alter table public.comments
  enable trigger comments_lifecycle_insert_guard_trg;

do $undo_expired$
declare
  v_result jsonb;
begin
  v_result := public.rpc_restore_comment(
    '30000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000008',
    '50000000-0000-0000-0000-000000000005',
    'undo',
    null
  );

  if v_result->>'code' <> 'undo_expired' then
    raise exception 'TEST 0262: undo >10 s no expiró: %', v_result;
  end if;
end
$undo_expired$;

do $ordinary_restore$
declare
  v_result jsonb;
begin
  v_result := public.rpc_restore_comment(
    '30000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000009',
    '50000000-0000-0000-0000-000000000006',
    'ordinary',
    null
  );
  if v_result->>'code' <> 'not_allowed' then
    raise exception 'TEST 0262: actor no admin restauró fuera de undo: %', v_result;
  end if;

  v_result := public.rpc_restore_comment(
    '30000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000010',
    '50000000-0000-0000-0000-000000000099',
    'ordinary',
    null
  );
  if v_result->>'code' <> 'operation_conflict' then
    raise exception 'TEST 0262: correlación incorrecta no falló cerrado: %', v_result;
  end if;

  v_result := public.rpc_restore_comment(
    '30000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000014',
    '50000000-0000-0000-0000-000000000006',
    'ordinary',
    null
  );

  if v_result->>'code' <> 'restored' then
    raise exception 'TEST 0262: restore ordinario falló: %', v_result;
  end if;
end
$ordinary_restore$;

do $exceptional_restore$
declare
  v_result jsonb;
begin
  v_result := public.rpc_restore_comment(
    '30000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000011',
    '50000000-0000-0000-0000-000000000007',
    'ordinary',
    null
  );
  if v_result->>'code' <> 'ordinary_window_expired' then
    raise exception 'TEST 0262: ordinary >30 d no expiró: %', v_result;
  end if;

  begin
    perform public.rpc_restore_comment(
      '30000000-0000-0000-0000-000000000007',
      '10000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000012',
      '50000000-0000-0000-0000-000000000007',
      'exceptional',
      null
    );
    raise exception 'TEST 0262: exceptional sin razón fue aceptado';
  exception
    when invalid_parameter_value then null;
  end;

  v_result := public.rpc_restore_comment(
    '30000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000013',
    '50000000-0000-0000-0000-000000000007',
    'exceptional',
    'Excepción revisada por administración'
  );
  if v_result->>'code' <> 'restored' then
    raise exception 'TEST 0262: exceptional válido falló: %', v_result;
  end if;
end
$exceptional_restore$;

do $retained$
declare
  v_result jsonb;
begin
  v_result := public.rpc_restore_comment(
    '30000000-0000-0000-0000-000000000008',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000018',
    '50000000-0000-0000-0000-000000000008',
    'ordinary',
    null
  );

  if v_result->>'code' <> 'not_allowed' then
    raise exception 'TEST 0262: no-admin conoció ventana >90 d: %', v_result;
  end if;

  v_result := public.rpc_restore_comment(
    '30000000-0000-0000-0000-000000000008',
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000015',
    '50000000-0000-0000-0000-000000000008',
    'exceptional',
    'No debe aplicarse'
  );

  if v_result->>'code' <> 'not_ordinary_restorable'
     or not exists (
       select 1 from public.comments
       where id = '30000000-0000-0000-0000-000000000008'
         and deleted_at is not null
     ) then
    raise exception 'TEST 0262: fila >90 d no quedó retenida: %', v_result;
  end if;
end
$retained$;

-- ── 8. Legacy eliminado: admin restaura sin inventar correlación previa ────

do $legacy_restore$
declare
  v_result jsonb;
begin
  v_result := public.rpc_restore_comment(
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000016',
    null,
    'ordinary',
    null
  );

  if v_result->>'code' <> 'restored'
     or not exists (
       select 1
       from public.comments
       where id = '30000000-0000-0000-0000-000000000002'
         and deleted_at is null
         and lifecycle_correlation_id is not null
         and lifecycle_contract_version = 1
     ) then
    raise exception 'TEST 0262: restauración legacy falló: %', v_result;
  end if;
end
$legacy_restore$;

-- ── 9. Fallo AUD revierte el comentario en la misma transacción ───────────

insert into public.comments (
  id, tenant_id, entity_type, entity_id, author_id, body
)
values (
  '30000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000001',
  'shipment',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Debe permanecer activo si AUD falla'
);

create function public.test_0262_fail_audit()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.payload->>'operation_id' =
     '40000000-0000-0000-0000-000000000017' then
    raise exception 'TEST 0262: fallo audit forzado';
  end if;
  return new;
end
$function$;

create trigger test_0262_fail_audit_trg
  before insert on public.entity_audit_log
  for each row execute function public.test_0262_fail_audit();

do $atomicity$
begin
  begin
    perform public.rpc_soft_delete_comment(
      '30000000-0000-0000-0000-000000000004',
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000017',
      null
    );
    raise exception 'TEST 0262: se esperaba fallo audit';
  exception
    when raise_exception then
      if sqlerrm <> 'TEST 0262: fallo audit forzado' then
        raise;
      end if;
  end;

  if not exists (
    select 1
    from public.comments
    where id = '30000000-0000-0000-0000-000000000004'
      and deleted_at is null
      and deleted_by is null
      and last_lifecycle_operation_id is null
  ) then
    raise exception 'TEST 0262: fallo AUD no revirtió el comentario';
  end if;
end
$atomicity$;

rollback;

select
  to_regclass('public.comments') is null
  and to_regclass('public.entity_audit_log') is null
  and to_regclass('public.audit_entity_types') is null
  as comments_lifecycle_fixture_rolled_back;
