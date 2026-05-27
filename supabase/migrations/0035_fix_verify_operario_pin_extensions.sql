-- 0035_fix_verify_operario_pin_extensions.sql
--
-- Fix regresión: la migración 0025 (SDD-0030) recreó verify_operario_pin
-- para agregar el campo `region` al return type, pero lo hizo con
-- `set search_path = public` (sin extensions). Eso rompió el lookup de
-- crypt() de pgcrypto que vive en schema extensions.
--
-- Impact: las PWAs operario (/m/cn login + /m/ve login + /m/admin login)
-- estaban TOTALMENTE rotas — el login con PIN devolvía "function
-- crypt(text, text) does not exist".
--
-- La migración 0020b había aplicado el fix originalmente, pero 0025 lo
-- pisó con DROP + CREATE sin preservar el search_path correcto.
--
-- Detectado 2026-05-26 noche durante audit preventivo post setup Resend.
-- Fix: re-aplicar con search_path = public, extensions.
--
-- Lección: cualquier RPC que use crypt/gen_salt/gen_random_bytes/digest/
-- uuid_generate_v4/hmac de pgcrypto DEBE tener `extensions` en search_path
-- o usar qualifier `extensions.X()` explícito.

drop function if exists public.verify_operario_pin(text);

create or replace function public.verify_operario_pin(
  p_pin text
)
returns table (
  operario_id      uuid,
  tenant_id        uuid,
  warehouse_id     uuid,
  display_name     text,
  display_name_cn  text,
  role             text,
  region           operario_region
)
language plpgsql
security definer
set search_path = public, extensions
as $func$
declare
  v_matches int;
begin
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    return;
  end if;

  -- Contar matches (improbable colisión pero auditable)
  select count(*) into v_matches
  from public.operario_pins
  where active = true
    and pin_hash = crypt(p_pin, pin_hash);

  if v_matches <> 1 then
    return;
  end if;

  return query
  update public.operario_pins op
     set last_login_at = now()
   where op.active = true
     and op.pin_hash = crypt(p_pin, op.pin_hash)
  returning op.id, op.tenant_id, op.warehouse_id,
            op.display_name, op.display_name_cn, op.role, op.region;
end;
$func$;

comment on function public.verify_operario_pin(text) is
  'Valida PIN del operario (4 dígitos plain). Retorna identidad incluyendo region (cn|ve) para que el server action de login redirija a la app correcta. SDD-0030. search_path incluye extensions para resolver crypt() de pgcrypto.';

revoke all on function public.verify_operario_pin(text) from public, anon, authenticated;
grant execute on function public.verify_operario_pin(text) to service_role;
