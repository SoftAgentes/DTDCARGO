-- 0037_harden_operario_pin_validator.sql
--
-- Mejora seguridad: el validator validate_operario_pin_format solo
-- chequeaba que el PIN tuviera 4 dígitos numéricos. NO bloqueaba PINs
-- comunes (1234, 0000, etc) que son trivialmente vulnerable a brute force
-- en login PIN (sin lockout actual).
--
-- Detectado 2026-05-26: durante audit post-Resend, operario Yusneidy Pérez
-- tenía PIN '1234'. Top 10 PINs más comunes representan ~15% de todos los
-- PINs en estudios reales.
--
-- Fix: agregar blacklist explícita de 24 PINs débiles comunes al validator.
-- Aplica a admin_create_operario y admin_reset_operario_pin que llaman
-- a esta función.
--
-- Operarios existentes con PINs débiles NO se resetean automáticamente
-- (impactaría operación). El founder decide cuándo y con qué PIN nuevo.
--
-- Referencia: https://datagenetics.com/blog/september32012/

create or replace function public.validate_operario_pin_format(p_pin text)
returns void
language plpgsql
immutable
as $func$
begin
  -- Format: exactamente 4 dígitos numéricos
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    raise exception 'PIN debe ser 4 dígitos numéricos' using errcode = 'P0010';
  end if;

  -- Blacklist: PINs débiles más comunes (top 10 + secuenciales obvios + patrones)
  if p_pin in (
    -- Repetidos: 10
    '0000', '1111', '2222', '3333', '4444',
    '5555', '6666', '7777', '8888', '9999',
    -- Secuenciales: 4
    '1234', '4321', '0123', '0987',
    -- Patrones tipo MM-DD-AA o piano keys: 10
    '1212', '2121', '0101', '1010', '1313',
    '6969', '2580', '1357', '2468', '1379'
  ) then
    raise exception 'PIN demasiado común. Elegí uno menos predecible.'
      using errcode = 'P0010';
  end if;
end;
$func$;

comment on function public.validate_operario_pin_format is
  'Valida format PIN (4 dígitos) + blacklist de PINs comunes. Llamada desde admin_create_operario y admin_reset_operario_pin.';
