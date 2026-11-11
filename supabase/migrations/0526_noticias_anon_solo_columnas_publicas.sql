-- ─────────────────────────────────────────────────────────────
-- 0526 · SDD-0611 (N1) — anon lee solo las columnas públicas de `news_posts`.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK de Sam NOMBRANDO este archivo, el runbook aplicar-migraciones-prod y el
--    Director General. Aplicarla NO enciende nada: el interruptor sigue apagado.
--
-- Requiere la 0518 aplicada (crea `publish_via`, `seo_draft_id` y `content_sha256`).
--
-- ── Por qué ──────────────────────────────────────────────────
-- La 0055 dio a anon SELECT sobre TODA la tabla: con la clave anon cualquiera
-- puede pedir `created_by` (uuid de una persona del Studio) y `publish_via`
-- (`automatica` declara la IA, contra §4.7 de la SDD-0611). La C1 (PR #492) hizo
-- que el sitio pida 18 columnas explícitas, pero eso solo cuida al sitio: la
-- clave anon es pública y PostgREST sirve lo que el GRANT permite. N1 es la
-- primera condición de Sam para encender las noticias automáticas: el público
-- no ve quién creó la noticia ni por qué vía se publicó.
--
-- ── Qué hace ─────────────────────────────────────────────────
-- 1. Quita a anon el SELECT de tabla sobre `news_posts`. Un REVOKE de columna no
--    sirve mientras exista el de tabla: el de tabla cubre todas las columnas.
-- 2. Le devuelve SELECT solo sobre las 18 columnas que pide
--    `lib/public/news-queries.ts` (COLUMNAS_PUBLICAS). Quedan fuera
--    `created_by`, `publish_via`, `seo_draft_id`, `content_sha256`, `tenant_id`
--    y `source`, y toda columna que se agregue en el futuro: una columna nueva
--    nace invisible para anon hasta que una migración la nombre.
--
-- ── Qué NO toca ──────────────────────────────────────────────
-- La policy `news_posts_public_select` (sigue `published = true`), las filas,
-- los privilegios de authenticated y service_role (el Studio lee igual), las
-- otras tablas de noticias (ya sin acceso de anon desde la 0518) y la retención
-- de `actor_id` (decisión abierta para Sam, SDD-0611 §11.4).
--
-- ── Efecto visible ───────────────────────────────────────────
-- `select=*` con la clave anon pasa a dar 401/42501. Ninguna lectura pública lo
-- usa (prueba estática de la C1). /noticias, /noticias/[slug], su imagen OG y el
-- sitemap piden las 18 columnas o solo `slug`.
--
-- ── Deshacer ─────────────────────────────────────────────────
--   grant select on public.news_posts to anon;
-- (el SELECT de tabla de la 0055 cubre otra vez todas las columnas, también las
-- internas; los grants de columna quedan redundantes).
-- ─────────────────────────────────────────────────────────────

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_col text;
begin
  if pg_catalog.to_regclass('public.news_posts') is null then
    raise exception '0526 requiere public.news_posts';
  end if;
  foreach v_col in array array[
    'id', 'slug', 'tipo', 'categoria', 'title', 'excerpt', 'body_markdown',
    'author_name', 'author_role', 'focus_keyword', 'secondary_keywords',
    'meta_description', 'pain_points', 'date', 'read_time_min', 'published',
    'created_at', 'updated_at', 'created_by', 'publish_via'] loop
    if not exists (select 1 from pg_catalog.pg_attribute a
                    where a.attrelid = 'public.news_posts'::regclass
                      and a.attname = v_col and a.attnum > 0 and not a.attisdropped) then
      raise exception '0526: falta la columna news_posts.% (¿0518 sin aplicar?)', v_col;
    end if;
  end loop;
  -- Estado de partida: el SELECT de tabla de la 0055. Sin él, o ya se aplicó la
  -- 0526 o alguien cambió los privilegios a mano: se para a mirar.
  if not pg_catalog.has_table_privilege('anon', 'public.news_posts', 'select') then
    raise exception '0526 ya aplicada o anon sin el SELECT de tabla de la 0055';
  end if;
end;
$preflight$;

-- ─── 1. Fuera el SELECT de tabla ─────────────────────────────────────────────
revoke select on public.news_posts from anon;

-- ─── 2. SELECT solo de las columnas públicas (= COLUMNAS_PUBLICAS) ───────────
grant select (
  id, slug, tipo, categoria, title, excerpt, body_markdown,
  author_name, author_role, focus_keyword, secondary_keywords,
  meta_description, pain_points, date, read_time_min, published,
  created_at, updated_at
) on public.news_posts to anon;

-- ─── Postflight ──────────────────────────────────────────────────────────────
do $postflight$
declare
  v_col text;
begin
  if pg_catalog.has_table_privilege('anon', 'public.news_posts', 'select') then
    raise exception '0526 postflight: anon sigue con SELECT de tabla';
  end if;
  foreach v_col in array array[
    'created_by', 'publish_via', 'seo_draft_id', 'content_sha256', 'tenant_id', 'source'] loop
    if pg_catalog.has_column_privilege('anon', 'public.news_posts', v_col, 'select') then
      raise exception '0526 postflight: anon lee news_posts.%', v_col;
    end if;
  end loop;
  foreach v_col in array array[
    'id', 'slug', 'tipo', 'categoria', 'title', 'excerpt', 'body_markdown',
    'author_name', 'author_role', 'focus_keyword', 'secondary_keywords',
    'meta_description', 'pain_points', 'date', 'read_time_min', 'published',
    'created_at', 'updated_at'] loop
    if not pg_catalog.has_column_privilege('anon', 'public.news_posts', v_col, 'select') then
      raise exception '0526 postflight: anon no lee la columna pública news_posts.%', v_col;
    end if;
  end loop;
  if not pg_catalog.has_table_privilege('authenticated', 'public.news_posts', 'select') then
    raise exception '0526 postflight: authenticated perdió el SELECT de tabla';
  end if;
end;
$postflight$;
