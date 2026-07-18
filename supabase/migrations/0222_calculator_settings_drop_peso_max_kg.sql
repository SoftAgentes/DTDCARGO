-- 0222_calculator_settings_drop_peso_max_kg.sql
--
-- Elimina la columna `peso_max_kg` de calculator_settings. Ya NO entra al
-- cálculo: desde 2026-07-06 el recargo por densidad es CONTINUO sin tope
-- (lib/calculadora.ts §5.6), así que `peso_max_kg` era un campo muerto que solo
-- sostenía el CHECK peso_max_kg >= peso_incluido_kg. Se retira junto con el CHECK
-- y se recrea la RPC pública sin ese campo.
--
-- Orden: soltar el CHECK → DROP de la RPC (depende de la columna) → DROP de la
-- columna → recrear la RPC con 9 columnas (misma seguridad + grants que 0110).
-- No cambia el pricing.

-- 1) Soltar el CHECK cruzado (ya no aplica sin peso_max_kg).
alter table public.calculator_settings
  drop constraint if exists calculator_settings_peso_max_gte_incluido;

-- 2) Soltar la RPC pública antes de tocar la columna (la función la referencia).
drop function if exists public.public_calculator_config();

-- 3) Soltar la columna muerta.
alter table public.calculator_settings
  drop column if exists peso_max_kg;

-- 4) Recrear la RPC pública sin peso_max_kg (9 columnas). Misma seguridad que
--    0110: stable + security definer + search_path fijo; re-otorgar grants.
create function public.public_calculator_config()
returns table(
  peso_incluido_kg numeric,
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
  select cs.peso_incluido_kg, cs.recargo_excedente_kg,
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
