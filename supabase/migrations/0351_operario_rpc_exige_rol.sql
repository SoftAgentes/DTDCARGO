-- ─────────────────────────────────────────────────────────────
-- SDD-0250 · b) Las RPC de operario exigen ROL, no sólo tenant.
--
-- EL HUECO. `admin_create_operario`, `admin_reset_operario_pin`,
-- `admin_set_operario_active` y `admin_update_operario` sólo llamaban
-- `assert_tenant_match()`, que compara `get_user_tenant_id()` — o sea, valida
-- QUE seas del tenant, no QUIÉN eres dentro de él.
--
-- La matriz RBAC dice `operarios: ["operations"]` (lib/studio/rbac.ts) y la
-- server action sí tiene su `moduleEditDenial`. Pero una RPC es alcanzable
-- DIRECTO por PostgREST con el JWT de cualquier usuario del tenant, sin pasar
-- por la action. Resultado: marketing, support, accounting o commercial podían
-- resetear el PIN de un operario y entrar a /m/cn o /m/ve como él.
--
-- Es el mismo patrón que ya cazó el auditor adversarial en SDD-0085, un nivel
-- más abajo: allá el hueco era gatear la VISTA y no la ACTION; acá es gatear la
-- ACTION y no la RPC. El control de verdad tiene que vivir donde termina el
-- salto: en la base.
--
-- EL CANDADO. Helper `assert_studio_role(text[])` — hermano de
-- `assert_tenant_match()` — y se llama de PRIMERO en las cuatro. De primero a
-- propósito: así una sesión sin permiso tampoco puede usar el 'Operario no
-- encontrado' como oráculo para adivinar ids ajenos.
--
-- QUÉ NO ROMPE. Las 4 actions llaman estas RPC con el cliente del USUARIO
-- (app/studio/(app)/operarios/actions.ts lo dice explícito: "NO service_role"),
-- así que `auth.uid()` resuelve y admin/operations pasan igual que siempre.
-- Ningún flujo interno las llama con service_role (verificado por grep).
-- ─────────────────────────────────────────────────────────────

-- ── Helper: el llamante debe tener uno de estos roles en su tenant ──────────
create or replace function public.assert_studio_role(p_roles text[])
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := public.current_studio_role();
begin
  -- current_studio_role() ya filtra `disabled_at is null` (migr 0200): un
  -- usuario desactivado llega acá como NULL y rebota.
  if v_role is null or not (v_role = any(p_roles)) then
    raise exception 'No tienes permiso para realizar esta acción'
      using errcode = '42501';
  end if;
end;
$$;

comment on function public.assert_studio_role(text[]) is
  'SDD-0250. Hermano de assert_tenant_match(): exige que el llamante tenga uno de los roles dados en su tenant (activo). Para RPC alcanzables directo por PostgREST, donde el gate de la server action no alcanza.';

revoke all on function public.assert_studio_role(text[]) from public, anon;
grant execute on function public.assert_studio_role(text[]) to authenticated, service_role;

-- ── 1/4 · crear operario ───────────────────────────────────────────────────
create or replace function public.admin_create_operario(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_display_name text,
  p_display_name_cn text,
  p_pin text,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  perform public.assert_studio_role(array['admin', 'operations']);
  perform public.assert_tenant_match(p_tenant_id);
  perform public.validate_operario_pin_format(p_pin);

  if p_display_name is null or length(trim(p_display_name)) = 0 then
    raise exception 'Nombre requerido' using errcode = 'P0011';
  end if;
  if p_role not in ('operario', 'supervisor') then
    raise exception 'Rol inválido (operario | supervisor)' using errcode = 'P0012';
  end if;

  insert into public.operario_pins (
    tenant_id, warehouse_id, display_name, display_name_cn, pin_hash, role
  ) values (
    p_tenant_id, p_warehouse_id,
    trim(p_display_name),
    nullif(trim(coalesce(p_display_name_cn, '')), ''),
    crypt(p_pin, gen_salt('bf')),
    p_role
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'Ya existe un operario con ese nombre en ese warehouse'
      using errcode = 'P0013';
end;
$$;

-- ── 2/4 · resetear PIN (el de mayor impacto: da acceso a /m/cn y /m/ve) ─────
create or replace function public.admin_reset_operario_pin(
  p_operario_id uuid,
  p_pin text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tenant_id uuid;
begin
  perform public.assert_studio_role(array['admin', 'operations']);

  select op.tenant_id into v_tenant_id
    from public.operario_pins op where op.id = p_operario_id;
  if v_tenant_id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0014';
  end if;

  perform public.assert_tenant_match(v_tenant_id);
  perform public.validate_operario_pin_format(p_pin);

  update public.operario_pins
     set pin_hash = crypt(p_pin, gen_salt('bf'))
   where id = p_operario_id;
end;
$$;

-- ── 3/4 · activar / desactivar ─────────────────────────────────────────────
create or replace function public.admin_set_operario_active(
  p_operario_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  perform public.assert_studio_role(array['admin', 'operations']);

  select op.tenant_id into v_tenant_id
    from public.operario_pins op where op.id = p_operario_id;
  if v_tenant_id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0014';
  end if;
  perform public.assert_tenant_match(v_tenant_id);

  update public.operario_pins
     set active = p_active
   where id = p_operario_id;
end;
$$;

-- ── 4/4 · editar ficha ─────────────────────────────────────────────────────
create or replace function public.admin_update_operario(
  p_operario_id uuid,
  p_display_name text,
  p_display_name_cn text,
  p_role text,
  p_warehouse_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  perform public.assert_studio_role(array['admin', 'operations']);

  select op.tenant_id into v_tenant_id
    from public.operario_pins op where op.id = p_operario_id;
  if v_tenant_id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0014';
  end if;
  perform public.assert_tenant_match(v_tenant_id);

  if p_display_name is null or length(trim(p_display_name)) = 0 then
    raise exception 'Nombre requerido' using errcode = 'P0011';
  end if;
  if p_role not in ('operario', 'supervisor') then
    raise exception 'Rol inválido' using errcode = 'P0012';
  end if;

  update public.operario_pins
     set display_name = trim(p_display_name),
         display_name_cn = nullif(trim(coalesce(p_display_name_cn, '')), ''),
         role = p_role,
         warehouse_id = p_warehouse_id
   where id = p_operario_id;
end;
$$;

comment on function public.admin_reset_operario_pin(uuid, text) is
  'Resetea el PIN de un operario. Fix 0351 (SDD-0250): exige rol admin|operations, no sólo tenant.';

-- Grants sin cambio (create or replace los preserva; se reafirman por claridad).
revoke all on function public.admin_create_operario(uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_create_operario(uuid, uuid, text, text, text, text) to authenticated;

revoke all on function public.admin_reset_operario_pin(uuid, text) from public, anon;
grant execute on function public.admin_reset_operario_pin(uuid, text) to authenticated;

revoke all on function public.admin_set_operario_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_operario_active(uuid, boolean) to authenticated;

revoke all on function public.admin_update_operario(uuid, text, text, text, uuid) from public, anon;
grant execute on function public.admin_update_operario(uuid, text, text, text, uuid) to authenticated;
