-- ─────────────────────────────────────────────────────────────
-- SDD-0028: RPCs admin para CRUD de operarios desde el Studio web.
--
-- Patrón: SECURITY DEFINER + assert_tenant_match() para que solo el
-- admin del tenant pueda tocar sus propios operarios. NO podés
-- crear/modificar operarios de otro tenant aunque sepas el id.
--
-- Las RPCs piden el PIN en plain (HTTPS protege en transit) y lo
-- hashean server-side con crypt(pin, gen_salt('bf')) de pgcrypto.
-- El PIN plain NUNCA se persiste, solo el hash bcrypt.
-- ─────────────────────────────────────────────────────────────

-- Helper: validar PIN format antes de hashear
create or replace function public.validate_operario_pin_format(p_pin text)
returns void
language plpgsql
immutable
as $$
begin
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    raise exception 'PIN debe ser 4 dígitos numéricos' using errcode = 'P0010';
  end if;
end;
$$;

-- ─── Crear operario ──────────────────────────────────────────────
create or replace function public.admin_create_operario(
  p_tenant_id        uuid,
  p_warehouse_id     uuid,
  p_display_name     text,
  p_display_name_cn  text,
  p_pin              text,
  p_role             text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
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

comment on function public.admin_create_operario is
  'Crea operario para el tenant del caller (assert_tenant_match). PIN se hashea bcrypt server-side. Unique (warehouse, display_name).';

-- ─── Reset PIN ───────────────────────────────────────────────────
create or replace function public.admin_reset_operario_pin(
  p_operario_id uuid,
  p_pin         text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tenant_id uuid;
begin
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

comment on function public.admin_reset_operario_pin is
  'Resetea el PIN de un operario. Solo si pertenece al tenant del caller.';

-- ─── Activar / desactivar ────────────────────────────────────────
create or replace function public.admin_set_operario_active(
  p_operario_id uuid,
  p_active      boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
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

comment on function public.admin_set_operario_active is
  'Activa/desactiva un operario. Inactivo NO puede loguear ni crear receipts.';

-- ─── Update display name / role / warehouse ─────────────────────
create or replace function public.admin_update_operario(
  p_operario_id      uuid,
  p_display_name     text,
  p_display_name_cn  text,
  p_role             text,
  p_warehouse_id     uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
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

comment on function public.admin_update_operario is
  'Edita nombre, role y warehouse de un operario. NO toca PIN.';

-- ─── RLS policy · admin del tenant puede SELECT operario_pins ────
create policy "operario_pins select by admin of tenant"
  on public.operario_pins for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id());

-- Grants
grant select on public.operario_pins to authenticated;

revoke all on function public.admin_create_operario(
  uuid, uuid, text, text, text, text
) from public, anon;
grant execute on function public.admin_create_operario(
  uuid, uuid, text, text, text, text
) to authenticated;

revoke all on function public.admin_reset_operario_pin(uuid, text) from public, anon;
grant execute on function public.admin_reset_operario_pin(uuid, text) to authenticated;

revoke all on function public.admin_set_operario_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_operario_active(uuid, boolean) to authenticated;

revoke all on function public.admin_update_operario(uuid, text, text, text, uuid) from public, anon;
grant execute on function public.admin_update_operario(uuid, text, text, text, uuid) to authenticated;
