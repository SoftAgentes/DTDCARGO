-- 0277 — Calculadora pública: agregar los 5 destinos que tenían landing SEO
--        pero NO se podían cotizar.
--
-- Contexto: había 4 listas de ciudades desalineadas. `lib/geo-zonas.ts` publica
-- 20 páginas geo-locales ("Importar de China a {ciudad}"), pero
-- `calculator_cities` solo tenía 12 destinos reales. Resultado: 5 ciudades con
-- landing indexada en el sitemap donde el visitante llegaba, hacía clic en
-- cotizar y NO encontraba su ciudad en el selector.
--
-- Los km salen de `lib/geo-zonas.ts` (fuente ya verificada, misma distancia
-- desde Valencia centro que usa el contenido SEO) — no se inventa ninguno.
--
-- Nota sobre Acarigua: 175 km está DENTRO del `threshold_casco_km` (200), así
-- que su recargo por distancia calcula $0 con el modelo actual. Se carga con
-- casco = false igual, porque no es casco central operativo (no hay corredor
-- diario); el $0 sale de la fórmula, no de una excepción hardcodeada.
--
-- Idempotente: on conflict contra el índice parcial vivo (deleted_at is null).
-- Si una ciudad ya existe (creada a mano desde el Studio), no se toca.

insert into public.calculator_cities (tenant_id, slug, label, km, casco, sort_order)
select t.id, c.slug, c.label, c.km, c.casco, c.sort_order
from public.tenants t
cross join (values
  ('acarigua',      'Acarigua',                175, false, 14),
  ('valera',        'Valera',                  360, false, 15),
  ('san-fernando',  'San Fernando de Apure',   370, false, 16),
  ('cumana',        'Cumaná',                  560, false, 17),
  ('maturin',       'Maturín',                 650, false, 18)
) as c(slug, label, km, casco, sort_order)
where t.slug = 'dtd'
on conflict (tenant_id, slug) where (deleted_at is null) do nothing;
