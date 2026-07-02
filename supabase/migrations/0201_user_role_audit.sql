-- 0201_user_role_audit.sql
--
-- Auditoría de cambios de rol y activación/desactivación de usuarios
-- (SDD-0085 hardening 3 · auditoría 2026-07-02 · ISO 9001 §7.5 trazabilidad).
--
-- El módulo Usuarios es keystone (gestión de roles) y no dejaba rastro de
-- quién cambió el rol de quién ni quién desactivó a quién. Trigger AFTER
-- UPDATE sobre user_tenants → atrapa TODAS las vías (RPCs studio_*, admin
-- client, SQL directo), no solo la UI.
--
-- Append-only: sin UPDATE/DELETE para authenticated (deny by default);
-- INSERT solo vía trigger (security definer). SELECT solo admins activos.

-- ─── Tabla ───────────────────────────────────────────────────────────────

create table public.user_role_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- Quién ejecutó el cambio. NULL = service_role / proceso de sistema
  -- (auth.uid() no resuelve fuera de una sesión de usuario).
  actor_user_id uuid,
  target_user_id uuid not null,
  -- 'scope_change' lo emite el trigger a partir de 0202 (warehouse_scope).
  action text not null check (action in ('role_change', 'disable', 'enable', 'scope_change')),
  -- Valor antes/después: rol para role_change; rol vigente para disable/enable
  -- (contexto); scope para scope_change.
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

comment on table public.user_role_audit is
  'Log append-only de cambios de rol y disable/enable de memberships (trigger sobre user_tenants). 0201.';

create index user_role_audit_tenant_created_idx
  on public.user_role_audit (tenant_id, created_at desc);

-- ─── RLS ─────────────────────────────────────────────────────────────────

alter table public.user_role_audit enable row level security;

-- SELECT: solo admins activos del tenant (current_studio_role ya filtra
-- disabled_at desde 0200).
create policy "user_role_audit_admin_select"
  on public.user_role_audit for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );

-- Sin policies de INSERT/UPDATE/DELETE para authenticated → deny by default.
-- El trigger escribe como security definer; service_role mantiene su vía.
create policy "service_role_all_user_role_audit"
  on public.user_role_audit for all to service_role
  using (true) with check (true);

-- 'Automatically expose new tables' está OFF en este proyecto (ver 0001):
-- sin GRANT explícito la policy de SELECT nunca llega a evaluarse.
grant select on public.user_role_audit to authenticated;
revoke insert, update, delete on public.user_role_audit from anon, authenticated;
revoke all on public.user_role_audit from anon;

-- ─── Trigger ─────────────────────────────────────────────────────────────

create or replace function public.audit_user_tenants_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    insert into public.user_role_audit
      (tenant_id, actor_user_id, target_user_id, action, old_value, new_value)
    values
      (new.tenant_id, auth.uid(), new.user_id, 'role_change', old.role, new.role);
  end if;

  if old.disabled_at is null and new.disabled_at is not null then
    insert into public.user_role_audit
      (tenant_id, actor_user_id, target_user_id, action, old_value, new_value)
    values
      (new.tenant_id, auth.uid(), new.user_id, 'disable', new.role, new.role);
  elsif old.disabled_at is not null and new.disabled_at is null then
    insert into public.user_role_audit
      (tenant_id, actor_user_id, target_user_id, action, old_value, new_value)
    values
      (new.tenant_id, auth.uid(), new.user_id, 'enable', new.role, new.role);
  end if;

  return new;
end;
$$;

comment on function public.audit_user_tenants_changes is
  'Trigger AFTER UPDATE de user_tenants: registra role_change / disable / enable en user_role_audit. 0201.';

-- Convención del repo para trigger functions security definer: nadie la
-- ejecuta directo (solo el trigger).
revoke all on function public.audit_user_tenants_changes() from public, anon, authenticated;

create trigger user_tenants_audit
  after update on public.user_tenants
  for each row
  execute function public.audit_user_tenants_changes();
