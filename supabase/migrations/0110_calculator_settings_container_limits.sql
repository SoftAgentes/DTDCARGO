-- 0110_calculator_settings_container_limits.sql
--
-- Agrega los LÍMITES DEL CONTENEDOR (CBM máx, peso máx) a calculator_settings
-- para que sean autogestionables desde /studio/tarifas › Parámetros. Antes
-- estaban hardcodeados en CONFIG (lib/calculadora.ts). Defaults = los valores
-- históricos (68 m³ · 27.000 kg) → cero regresión.
--
-- También actualiza la RPC pública `public_calculator_config` para exponer los
-- 2 campos nuevos al calculador del sitio (vía getPublicCalculatorConfig).

-- 1) Columnas nuevas. NOT NULL + DEFAULT pobla la fila existente del tenant dtd.
alter table public.calculator_settings
  add column if not exists cbm_max_contenedor numeric not null default 68
    check (cbm_max_contenedor > 0),
  add column if not exists peso_max_contenedor_kg numeric not null default 27000
    check (peso_max_contenedor_kg > 0);

-- 2) Recrear la RPC pública con los 2 campos nuevos. Cambia la firma (columnas
--    del RETURNS TABLE) → hace falta DROP + CREATE; re-otorgamos el grant a anon.
drop function if exists public.public_calculator_config();

create function public.public_calculator_config()
returns table(
  peso_incluido_kg numeric,
  peso_max_kg numeric,
  recargo_excedente_kg numeric,
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
  select cs.peso_incluido_kg, cs.peso_max_kg, cs.recargo_excedente_kg,
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
