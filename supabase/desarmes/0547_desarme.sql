-- SDD-0611 §11.5 · Desarme de la 0547: quita las columnas de portada con licencia.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: lib/news/autopublicar/__tests__/noticias-0547.migration.test.ts (bloque «desarme»).
--
-- SOLO SIRVE MIENTRAS NINGUNA NOTICIA USÓ UNA PORTADA PROPIA. El preflight aborta, sin cambiar nada, si
-- alguna fila de news_posts tiene portada o alguna de seo_drafts declara una: borrar las columnas
-- perdería esa licencia registrada. En ese caso desarmar es otra decisión: se exporta o se mueve antes.
--
-- QUITA los CHECK de portada, las 7 columnas cover_* de news_posts y las 6 autopub_cover_* nuevas de
-- seo_drafts (autopub_cover_image_url es de la 0518 y se queda), y el SELECT de anon sobre ellas (cae con
-- las columnas). DEVUELVE news_insertar_post al cuerpo de la 0518, con sus mismos privilegios.
-- CONSERVA toda fila de news_posts y seo_drafts.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if not exists (select 1 from pg_catalog.pg_attribute a
                  where a.attrelid = 'public.news_posts'::regclass
                    and a.attname = 'cover_license_verified_at' and a.attnum > 0 and not a.attisdropped) then
    raise exception 'Desarme abortado: la 0547 no está aplicada';
  end if;
  if exists (select 1 from public.news_posts where cover_image_url is not null) then
    raise exception 'Desarme abortado: hay noticias con portada propia; se perdería su licencia registrada';
  end if;
  if exists (select 1 from public.seo_drafts
              where autopub_cover_license is not null or autopub_cover_origin is not null
                 or autopub_cover_credit is not null or autopub_cover_source_url is not null
                 or autopub_cover_alt is not null or autopub_cover_license_verified_at is not null) then
    raise exception 'Desarme abortado: hay borradores con datos de portada; se perderían';
  end if;
end;
$preflight$;

alter table public.news_posts
  drop constraint news_posts_portada_con_permiso,
  drop constraint news_posts_portada_campos;
alter table public.seo_drafts
  drop constraint seo_drafts_portada_forma;

-- Antes de quitar las columnas, la función vuelve al cuerpo de la 0518 (no las nombra).
create or replace function public.news_insertar_post(
  p_tenant uuid, p_via text, p_draft_id uuid, p_post jsonb, p_huella text, p_actor uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_id uuid;
begin
  insert into public.news_posts (
    tenant_id, slug, tipo, categoria, title, excerpt, body_markdown,
    author_name, author_role, focus_keyword, secondary_keywords, meta_description,
    pain_points, read_time_min, date, published, source, created_by,
    publish_via, seo_draft_id, content_sha256)
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
    p_via, p_draft_id, p_huella)
  returning id into v_id;
  return v_id;
end;
$fn$;

alter table public.news_posts
  drop column cover_image_url,
  drop column cover_alt,
  drop column cover_origin,
  drop column cover_credit,
  drop column cover_license,
  drop column cover_source_url,
  drop column cover_license_verified_at;

alter table public.seo_drafts
  drop column autopub_cover_alt,
  drop column autopub_cover_origin,
  drop column autopub_cover_credit,
  drop column autopub_cover_license,
  drop column autopub_cover_source_url,
  drop column autopub_cover_license_verified_at;

notify pgrst, 'reload schema';
