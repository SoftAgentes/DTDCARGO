-- ─────────────────────────────────────────────────────────────
-- 0547 · SDD-0611 §11.5 — foto de portada con crédito, licencia y enlace de origen.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK de Sam NOMBRANDO este archivo, el runbook aplicar-migraciones-prod y el
--    Director General (migrate-first). Aplicarla NO enciende nada: el interruptor
--    de la publicación automática sigue apagado y ninguna noticia cambia de foto.
--
-- Requiere la 0518 (news_posts, seo_drafts y news_insertar_post) y la 0526
-- (anon lee solo columnas con GRANT).
--
-- ── Por qué ──────────────────────────────────────────────────
-- Hoy `news_posts` no tiene columnas de portada: las 5 noticias publicadas usan el
-- respaldo propio por categoría (código) y `news_insertar_post` nunca guarda una
-- portada. §11.5 (Sam, 2026-11-15) fija el orden: foto de la fuente solo con
-- licencia comprobable; si no, banco libre o foto propia sin la marca anterior; si
-- no, sin foto. Esta migración es lo que le da a la base con qué exigirlo.
--
-- ── Qué hace ─────────────────────────────────────────────────
-- 1. `news_posts` +7 columnas: cover_image_url, cover_alt, cover_origin
--    (fuente | banco | propia), cover_credit, cover_license, cover_source_url y
--    cover_license_verified_at. Dos CHECK: una portada solo existe con URL permitida
--    (ruta propia `/fotos/…` o Storage público de Supabase; nunca la marca
--    anterior), licencia escrita, comprobación con fecha y, si es de la fuente o de
--    un banco, enlace de origen.
-- 2. `seo_drafts` +6 columnas autopub_cover_*: lo que el borrador declara. Solo
--    forma (largos y origen); la exigencia de permiso se aplica al publicar.
-- 3. `news_insertar_post` (la que usan las dos vías) guarda la portada SOLO si
--    cumple todo; si no, publica la noticia sin esa portada y sin retenerla.
-- 4. anon recibe SELECT de seis columnas de portada. `cover_license_verified_at`
--    queda interna: la base ya exigió la comprobación para guardar la foto.
--
-- ── Qué NO toca ──────────────────────────────────────────────
-- Filas existentes (las columnas nuevas nacen NULL: sin portada propia, siguen con
-- el respaldo por categoría), la firma y los privilegios de news_insertar_post, la
-- RLS, la huella F3 (no incluye la portada), y el filtro de la marca anterior en
-- archivos: eso lo revisa una persona a la vista (§11.5).
--
-- ── Lock ─────────────────────────────────────────────────────
-- ALTER TABLE ADD COLUMN (sin default) y ADD CONSTRAINT sobre columnas nuevas, todas
-- NULL: ACCESS EXCLUSIVE breve sobre news_posts y seo_drafts (decenas de filas);
-- lock_timeout 5 s.
--
-- ── Deshacer ─────────────────────────────────────────────────
--   supabase/desarmes/0547_desarme.sql (aborta si ya hay portadas guardadas).
-- ─────────────────────────────────────────────────────────────

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.news_posts') is null
     or pg_catalog.to_regclass('public.seo_drafts') is null then
    raise exception '0547 requiere public.news_posts y public.seo_drafts';
  end if;
  if pg_catalog.to_regprocedure('public.news_insertar_post(uuid,text,uuid,jsonb,text,uuid)') is null then
    raise exception '0547 requiere news_insertar_post de la 0518';
  end if;
  if not exists (select 1 from pg_catalog.pg_attribute a
                  where a.attrelid = 'public.seo_drafts'::regclass
                    and a.attname = 'autopub_cover_image_url' and a.attnum > 0 and not a.attisdropped) then
    raise exception '0547: falta seo_drafts.autopub_cover_image_url (¿0518 sin aplicar?)';
  end if;
  if exists (select 1 from pg_catalog.pg_attribute a
              where a.attrelid = 'public.news_posts'::regclass
                and a.attname in ('cover_image_url', 'cover_alt', 'cover_origin', 'cover_credit',
                                  'cover_license', 'cover_source_url', 'cover_license_verified_at')
                and a.attnum > 0 and not a.attisdropped) then
    raise exception '0547 ya aplicada, o news_posts ya tiene columnas de portada hechas a mano';
  end if;
  if exists (select 1 from pg_catalog.pg_attribute a
              where a.attrelid = 'public.seo_drafts'::regclass
                and a.attname in ('autopub_cover_alt', 'autopub_cover_origin', 'autopub_cover_credit',
                                  'autopub_cover_license', 'autopub_cover_source_url',
                                  'autopub_cover_license_verified_at')
                and a.attnum > 0 and not a.attisdropped) then
    raise exception '0547 ya aplicada, o seo_drafts ya tiene columnas autopub_cover_* hechas a mano';
  end if;
end;
$preflight$;

-- ─── 1. Portada de la noticia publicada ──────────────────────────────────────
alter table public.news_posts
  add column cover_image_url           text,
  add column cover_alt                 text,
  add column cover_origin              text,
  add column cover_credit              text,
  add column cover_license             text,
  add column cover_source_url          text,
  add column cover_license_verified_at timestamptz;

alter table public.news_posts
  add constraint news_posts_portada_con_permiso
    check (
      cover_image_url is null or (
        -- Ruta propia versionada (public/fotos) o Storage público de Supabase; nada más.
        (cover_image_url ~* '^/fotos/[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*\.(webp|jpe?g|png|avif)$'
         or cover_image_url ~* '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/[A-Za-z0-9._%/-]+\.(webp|jpe?g|png|avif)$')
        and pg_catalog.strpos(cover_image_url, '..') = 0
        and pg_catalog.length(cover_image_url) <= 2048
        -- Nunca la marca anterior (misma expresión que MARCA_ANTERIOR_RE en lib/news/portada.ts).
        and cover_image_url !~* 'door.{0,6}t[uo].{0,6}door|door.{0,6}2.{0,6}door'
        -- Licencia escrita y comprobada, con fecha.
        and cover_license is not null and pg_catalog.btrim(cover_license) <> ''
        and pg_catalog.length(cover_license) <= 120
        and cover_license_verified_at is not null
        -- De dónde viene, y con enlace de origen si no es propia.
        and cover_origin is not null and cover_origin in ('fuente', 'banco', 'propia')
        and (cover_origin = 'propia' or cover_source_url is not null)
      )
    ),
  add constraint news_posts_portada_campos
    check (
      (cover_alt is null or pg_catalog.length(cover_alt) <= 200)
      and (cover_credit is null or pg_catalog.length(cover_credit) <= 200)
      and (cover_source_url is null
           or (cover_source_url ~ '^https://[^[:space:]]+\.[^[:space:]]+$'
               and pg_catalog.length(cover_source_url) <= 2048))
      -- Sin foto no hay metadatos de foto sueltos.
      and (cover_image_url is not null
           or (cover_alt is null and cover_origin is null and cover_credit is null
               and cover_license is null and cover_source_url is null
               and cover_license_verified_at is null))
    );

comment on column public.news_posts.cover_image_url is
  'SDD-0611 §11.5 (0547): portada propia de la noticia; solo con licencia comprobada. NULL = respaldo por categoría o sin foto.';

-- ─── 2. Lo que declara el borrador ───────────────────────────────────────────
alter table public.seo_drafts
  add column autopub_cover_alt                 text,
  add column autopub_cover_origin              text,
  add column autopub_cover_credit              text,
  add column autopub_cover_license             text,
  add column autopub_cover_source_url          text,
  add column autopub_cover_license_verified_at timestamptz;

alter table public.seo_drafts
  add constraint seo_drafts_portada_forma
    check (
      (autopub_cover_alt is null or pg_catalog.length(autopub_cover_alt) <= 200)
      and (autopub_cover_origin is null or autopub_cover_origin in ('fuente', 'banco', 'propia'))
      and (autopub_cover_credit is null or pg_catalog.length(autopub_cover_credit) <= 200)
      and (autopub_cover_license is null or pg_catalog.length(autopub_cover_license) <= 120)
      and (autopub_cover_source_url is null
           or (autopub_cover_source_url ~ '^https://[^[:space:]]+\.[^[:space:]]+$'
               and pg_catalog.length(autopub_cover_source_url) <= 2048))
    );

-- ─── 3. La inserción de la noticia guarda la portada solo si cumple todo ─────
-- Misma firma y mismos privilegios que la 0518 (CREATE OR REPLACE los conserva).
-- Primer intento: con la portada del jsonb. Si un CHECK de portada la rechaza
-- (sin licencia, sin comprobar, URL no permitida, marca anterior…), segundo
-- intento SIN portada: la noticia se publica igual (§11.5 «sin retener»). Un
-- CHECK que no es de portada se vuelve a lanzar como antes.
create or replace function public.news_insertar_post(
  p_tenant uuid, p_via text, p_draft_id uuid, p_post jsonb, p_huella text, p_actor uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_id      uuid;
  v_intento integer;
  v_cons    text;
  v_verif   timestamptz;
begin
  begin
    v_verif := (p_post ->> 'cover_license_verified_at')::timestamptz;
  exception when others then
    v_verif := null;
  end;

  for v_intento in 1..2 loop
    begin
      insert into public.news_posts (
        tenant_id, slug, tipo, categoria, title, excerpt, body_markdown,
        author_name, author_role, focus_keyword, secondary_keywords, meta_description,
        pain_points, read_time_min, date, published, source, created_by,
        publish_via, seo_draft_id, content_sha256,
        cover_image_url, cover_alt, cover_origin, cover_credit, cover_license,
        cover_source_url, cover_license_verified_at)
      values (
        p_tenant, p_post ->> 'slug', p_post ->> 'tipo', p_post ->> 'categoria',
        p_post ->> 'title', p_post ->> 'excerpt', p_post ->> 'body_markdown',
        -- §4.7: lo automático firma DTD Cargo, sin escritor invitado.
        case when p_via = 'automatica' then 'DTD Cargo' else coalesce(p_post ->> 'author_name', 'DTD Cargo') end,
        case when p_via = 'automatica' then null else p_post ->> 'author_role' end,
        nullif(p_post ->> 'focus_keyword', ''),
        coalesce(p_post -> 'secondary_keywords', '[]'::jsonb),
        p_post ->> 'meta_description',
        coalesce(p_post -> 'pain_points', '[]'::jsonb),
        greatest(1, coalesce((p_post ->> 'read_time_min')::integer, 5)),
        (pg_catalog.now() at time zone 'America/Caracas')::date,
        true, 'seo-generator', p_actor,
        p_via, p_draft_id, p_huella,
        case when v_intento = 1 then nullif(pg_catalog.btrim(p_post ->> 'cover_image_url'), '') end,
        case when v_intento = 1 then nullif(pg_catalog.btrim(p_post ->> 'cover_alt'), '') end,
        case when v_intento = 1 then nullif(pg_catalog.btrim(p_post ->> 'cover_origin'), '') end,
        case when v_intento = 1 then nullif(pg_catalog.btrim(p_post ->> 'cover_credit'), '') end,
        case when v_intento = 1 then nullif(pg_catalog.btrim(p_post ->> 'cover_license'), '') end,
        case when v_intento = 1 then nullif(pg_catalog.btrim(p_post ->> 'cover_source_url'), '') end,
        case when v_intento = 1 then v_verif end)
      returning id into v_id;
      exit;
    exception when check_violation then
      get stacked diagnostics v_cons = constraint_name;
      if v_intento = 2 or v_cons is null
         or v_cons not in ('news_posts_portada_con_permiso', 'news_posts_portada_campos') then
        raise;
      end if;
    end;
  end loop;
  return v_id;
end;
$fn$;

-- ─── 4. anon lee la portada pública (no la fecha de comprobación) ────────────
grant select (cover_image_url, cover_alt, cover_origin, cover_credit, cover_license, cover_source_url)
  on public.news_posts to anon;

-- ─── Postflight ──────────────────────────────────────────────────────────────
do $postflight$
declare
  v_col text;
begin
  foreach v_col in array array[
    'cover_image_url', 'cover_alt', 'cover_origin', 'cover_credit', 'cover_license',
    'cover_source_url', 'cover_license_verified_at'] loop
    if not exists (select 1 from pg_catalog.pg_attribute a
                    where a.attrelid = 'public.news_posts'::regclass
                      and a.attname = v_col and a.attnum > 0 and not a.attisdropped) then
      raise exception '0547 postflight: falta news_posts.%', v_col;
    end if;
  end loop;
  if (select pg_catalog.count(*) from pg_catalog.pg_constraint c
       where c.conrelid = 'public.news_posts'::regclass and c.convalidated
         and c.conname in ('news_posts_portada_con_permiso', 'news_posts_portada_campos')) <> 2 then
    raise exception '0547 postflight: faltan los CHECK de portada o no están validados';
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint c
                  where c.conrelid = 'public.seo_drafts'::regclass
                    and c.conname = 'seo_drafts_portada_forma' and c.convalidated) then
    raise exception '0547 postflight: falta seo_drafts_portada_forma';
  end if;
  foreach v_col in array array[
    'cover_image_url', 'cover_alt', 'cover_origin', 'cover_credit', 'cover_license', 'cover_source_url'] loop
    if not pg_catalog.has_column_privilege('anon', 'public.news_posts', v_col, 'select') then
      raise exception '0547 postflight: anon no lee news_posts.%', v_col;
    end if;
  end loop;
  foreach v_col in array array[
    'cover_license_verified_at', 'created_by', 'publish_via', 'seo_draft_id', 'content_sha256',
    'tenant_id', 'source'] loop
    if pg_catalog.has_column_privilege('anon', 'public.news_posts', v_col, 'select') then
      raise exception '0547 postflight: anon lee news_posts.%', v_col;
    end if;
  end loop;
  if pg_catalog.has_table_privilege('anon', 'public.news_posts', 'select') then
    raise exception '0547 postflight: anon volvió a tener SELECT de tabla';
  end if;
  -- Los privilegios de la función no cambian (la 0518 se los quitó a todos).
  if pg_catalog.has_function_privilege('anon', 'public.news_insertar_post(uuid,text,uuid,jsonb,text,uuid)', 'execute')
     or pg_catalog.has_function_privilege('authenticated', 'public.news_insertar_post(uuid,text,uuid,jsonb,text,uuid)', 'execute')
     or pg_catalog.has_function_privilege('service_role', 'public.news_insertar_post(uuid,text,uuid,jsonb,text,uuid)', 'execute') then
    raise exception '0547 postflight: news_insertar_post quedó ejecutable por un rol de API';
  end if;
end;
$postflight$;

notify pgrst, 'reload schema';
