-- 0202_warehouse_scope.sql
--
-- SDD-0139 · Scope de almacén por usuario (decisión founder 2026-07-02:
-- opinión Codex + panel de expertos — Norte users.jsx prometía scope por
-- almacén en el alta de usuario).
--
-- El scope es un ATRIBUTO OPERATIVO del membership (qué lado de la operación
-- ve el usuario: China, Venezuela o ambos), NO una dimensión de la matriz
-- RBAC. La matriz rol×módulo sigue en código (lib/studio/rbac.ts); el scope
-- solo RESTRINGE los módulos con lado geográfico (cn, cola-qr, etiquetas vs
-- ve) para roles no-admin. Default 'all' = cero cambio de comportamiento
-- hasta que un admin asigne un scope.
--
-- ⚠️ ORDEN DE DEPLOY: aplicar esta migración ANTES de deployar el código que
-- la consume (listMembers selecciona la columna). Los guards degradan solos
-- (select("*") → scope 'all' si la columna no existe), pero el listado de
-- Usuarios la nombra explícito.

-- ─── Columna ─────────────────────────────────────────────────────────────

alter table public.user_tenants
  add column if not exists warehouse_scope text not null default 'all'
  constraint user_tenants_warehouse_scope_check
  check (warehouse_scope in ('cn', 've', 'all'));

comment on column public.user_tenants.warehouse_scope is
  'SDD-0139: lado de la operación que ve el usuario (cn | ve | all). Atributo operativo, no dimensión RBAC. Solo restringe módulos de almacén para no-admin.';

-- ─── RPC studio_set_user_warehouse_scope ─────────────────────────────────
-- user_tenants no tiene policy de UPDATE para authenticated (deny by default,
-- a propósito — ver 0200): toda mutación de membership va por RPC security
-- definer con check de admin activo.

create or replace function public.studio_set_user_warehouse_scope(
  p_target_user_id uuid,
  p_scope text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
begin
  if v_tenant_id is null then
    raise exception 'Sin membership activo' using errcode = '42501';
  end if;

  if p_scope not in ('cn', 've', 'all') then
    raise exception 'Scope inválido: % (cn | ve | all)', p_scope using errcode = '22023';
  end if;

  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role is distinct from 'admin' then
    raise exception 'Solo admins pueden cambiar el scope de almacén' using errcode = '42501';
  end if;

  select role into v_target_role
  from public.user_tenants
  where user_id = p_target_user_id and tenant_id = v_tenant_id;
  if v_target_role is null then
    raise exception 'El usuario target no pertenece a este tenant' using errcode = '23503';
  end if;

  update public.user_tenants
  set warehouse_scope = p_scope
  where user_id = p_target_user_id and tenant_id = v_tenant_id;

  return true;
end;
$$;

comment on function public.studio_set_user_warehouse_scope is
  'Solo admins activos. Asigna el scope de almacén (cn|ve|all) de otro user del tenant. SDD-0139 / 0202.';

revoke all on function public.studio_set_user_warehouse_scope(uuid, text) from public, anon;
grant execute on function public.studio_set_user_warehouse_scope(uuid, text) to authenticated;

-- ─── Auditoría: el trigger de 0201 ahora también registra scope_change ───
-- (la tabla user_role_audit ya admite action='scope_change' desde 0201).

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

  if new.warehouse_scope is distinct from old.warehouse_scope then
    insert into public.user_role_audit
      (tenant_id, actor_user_id, target_user_id, action, old_value, new_value)
    values
      (new.tenant_id, auth.uid(), new.user_id, 'scope_change', old.warehouse_scope, new.warehouse_scope);
  end if;

  return new;
end;
$$;

comment on function public.audit_user_tenants_changes is
  'Trigger AFTER UPDATE de user_tenants: registra role_change / disable / enable / scope_change en user_role_audit. 0201 + 0202.';
