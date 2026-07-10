-- 0223_calculator_settings_peso_max_envio.sql
--
-- Agrega el TOPE DE PESO POR ENVÍO (peso_max_envio_kg) a calculator_settings.
-- Sobre este peso, la calculadora deriva al asesor en vez de auto-cotizar: evita
-- que un solo envío monopolice el peso del contenedor (ej. 27.000 kg en 27 CBM
-- llena el peso con 40% del volumen → nadie más entra y cotizar por volumen va a
-- pérdida). Default 9.000 kg (⅓ de 27.000 → garantiza ≥3 clientes por consolidado).
-- Configurable desde Admin › Calculadora pública.
--
-- Depende de 0222 (drop peso_max_kg) idealmente aplicada antes, pero la recreación
-- de la RPC acá define la firma final completa, así que el orden no la rompe.

-- 1) Columna nueva. NOT NULL + DEFAULT pobla la fila existente del tenant dtd.
alter table public.calculator_settings
  add column if not exists peso_max_envio_kg numeric not null default 9000
    check (peso_max_envio_kg > 0);

-- 2) Recrear la RPC pública con el campo nuevo (cambia la firma → DROP + CREATE;
--    re-otorgar grants). Firma final: sin peso_max_kg (0222), con peso_max_envio_kg.
drop function if exists public.public_calculator_config();

create function public.public_calculator_config()
returns table(
  peso_incluido_kg numeric,
  recargo_excedente_kg numeric,
  peso_max_envio_kg numeric,
  descuento_valencia numeric,
  recargo_embalaje_especial numeric,
  recargo_bateria_mult numeric,
  threshold_casco_km numeric,
  tarifa_km_fuera_casco numeric,
  cbm_max_contenedor numeric,
  peso_max_contenedor_kg numeric
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select cs.peso_incluido_kg, cs.recargo_excedente_kg, cs.peso_max_envio_kg,
         cs.descuento_valencia, cs.recargo_embalaje_especial, cs.recargo_bateria_mult,
         cs.threshold_casco_km, cs.tarifa_km_fuera_casco,
         cs.cbm_max_contenedor, cs.peso_max_contenedor_kg
  from public.calculator_settings cs
  join public.tenants t on t.id = cs.tenant_id
  where t.slug = 'dtd'
  limit 1;
$$;

grant execute on function public.public_calculator_config() to anon;
grant execute on function public.public_calculator_config() to authenticated;
