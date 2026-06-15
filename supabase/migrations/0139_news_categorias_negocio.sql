-- ─────────────────────────────────────────────────────────────
-- SDD-0087 · F1 — Taxonomía de negocio de news_posts (6 categorías)
--
-- Reemplaza las 10 categorías técnicas (operaciones, tarifas-fletes, …)
-- por las 6 categorías de negocio del founder, orientadas al público
-- objetivo (importador pyme VE que ya compra recurrente cada ~3 meses).
--
-- Orden OBLIGATORIO (el UPDATE va ANTES del nuevo CHECK; si no, el CHECK
-- nuevo rechazaría las filas viejas con categorías técnicas):
--   1. drop del CHECK viejo de categoria
--   2. UPDATE news_posts → re-mapeo de las categorías técnicas a las 6 de negocio
--   3. add del CHECK nuevo con los 6 slugs de negocio
--
-- Tabla chica (5 seeds): el cambio de constraint es lock-instantáneo y seguro.
-- Sin funciones nuevas → no aplica `revoke execute`. RLS intacta (no se toca).
--
-- ⚠️ NO aplicada a producción por el harness — la aplica el founder.
-- ─────────────────────────────────────────────────────────────

-- 1. soltar el CHECK viejo (auto-generado por el check inline en 0055).
--    `if exists` por idempotencia/robustez ante re-runs.
alter table public.news_posts
  drop constraint if exists news_posts_categoria_check;

-- 2. re-mapear las categorías técnicas a las 6 de negocio (antes del CHECK).
--    `::text` en el WHERE por robustez (categoria es text; cast explícito
--    evita sorpresas si alguna columna llegara como enum en otro entorno).
update public.news_posts set categoria = 'como-llega-tu-mercancia'  where categoria::text = 'tutoriales-guias';
update public.news_posts set categoria = 'que-se-mueve-en-china'    where categoria::text = 'china';
update public.news_posts set categoria = 'como-llega-tu-mercancia'  where categoria::text = 'operaciones';
update public.news_posts set categoria = 'como-llega-tu-mercancia'  where categoria::text = 'industria-global';
update public.news_posts set categoria = 'como-llega-tu-mercancia'  where categoria::text = 'tarifas-fletes';
update public.news_posts set categoria = 'como-llega-tu-mercancia'  where categoria::text = 'aduana-seniat';
update public.news_posts set categoria = 'historias-reales'        where categoria::text = 'casos-reales';
update public.news_posts set categoria = 'venezuela-y-tu-bolsillo' where categoria::text = 'analisis-opinion';
update public.news_posts set categoria = 'importa-sin-perder-plata' where categoria::text = 'mitos-realidades';
update public.news_posts set categoria = 'novedades-dtd'           where categoria::text = 'anuncios-dtd';

-- 3. add del CHECK nuevo con los 6 slugs de negocio.
alter table public.news_posts
  add constraint news_posts_categoria_check check (categoria in (
    'importa-sin-perder-plata',
    'que-se-mueve-en-china',
    'como-llega-tu-mercancia',
    'venezuela-y-tu-bolsillo',
    'historias-reales',
    'novedades-dtd'
  ));

comment on column public.news_posts.categoria is
  'Categoría de negocio (SDD-0087 F1). 6 valores: importa-sin-perder-plata (motor) · que-se-mueve-en-china · como-llega-tu-mercancia · venezuela-y-tu-bolsillo · historias-reales · novedades-dtd. Source of truth en TS: lib/news/categories.ts.';
