-- SDD-0611 · Desarme de la 0518: la base vuelve a como estaba antes de la publicación automática.
-- ⚠️ NO ES UNA MIGRACIÓN. Vive fuera de supabase/migrations/ y sin número, para que nada la aplique
--    ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el siguiente
--    número libre y se aplica con el runbook de producción.
-- Ensayo: lib/news/autopublicar/__tests__/noticias-0518.migration.test.ts («DESARME»), que compara
--    el catálogo antes de la 0518 y después del desarme.
--
-- SOLO SIRVE MIENTRAS LA 0518 NO SE USÓ. El preflight aborta, sin cambiar nada, si:
--   · el interruptor está encendido en algún tenant (lo apaga Sam primero);
--   · hay alguna noticia publicada por la vía automática (perdería su origen y su guarda de borrado);
--   · hay borradores en `en_revision` o `retenido` (el CHECK viejo no los admite);
--   · hay filas en la auditoría, en las salidas o en el registro del interruptor (se perderían).
-- En cualquiera de esos casos, desarmar es otra decisión: exportar o mover esas filas antes, con su OK.
--
-- QUITA todo lo que trajo la 0518: funciones, disparadores, las cuatro tablas, las columnas nuevas de
--   seo_drafts y news_posts, sus índices y CHECK, y el CHECK de marcas [VERIFICAR.
-- DEVUELVE el CHECK de estados de seo_drafts a los tres de la 0053 y, solo si la 0518 lo había
--   cambiado (lo dice el comentario), el CHECK de categorías a la lista de la 0053.
-- CONSERVA toda fila de news_posts y seo_drafts.
-- PIERDE el bloqueo de [VERIFICAR en la base: queda el del servidor (publishPost), que no depende de esto.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.news_publication_audit') is null then
    raise exception 'Desarme abortado: la 0518 no está aplicada';
  end if;
  if exists (select 1 from public.news_autopublish_settings where enabled) then
    raise exception 'Desarme abortado: el interruptor está encendido; lo apaga Sam primero';
  end if;
  if exists (select 1 from public.news_posts where publish_via = 'automatica') then
    raise exception 'Desarme abortado: hay noticias publicadas por la vía automática';
  end if;
  if exists (select 1 from public.seo_drafts where status in ('en_revision', 'retenido')) then
    raise exception 'Desarme abortado: hay borradores en revisión o retenidos';
  end if;
  if exists (select 1 from public.news_publication_audit)
     or exists (select 1 from public.news_post_exits)
     or exists (select 1 from public.news_autopublish_settings_log)
     or exists (select 1 from public.news_autopublish_settings) then
    raise exception 'Desarme abortado: hay filas de auditoría, salidas o interruptor que se perderían';
  end if;
end;
$preflight$;

-- Disparadores y funciones.
drop trigger news_posts_registra_salida_del on public.news_posts;
drop trigger news_posts_registra_salida_upd on public.news_posts;
drop trigger news_posts_guarda_automatica_trg on public.news_posts;
drop function public.news_evaluacion_automatica(uuid, uuid, jsonb, jsonb, jsonb, text[]);
drop function public.news_publicar_manual(uuid, jsonb, jsonb, text[]);
drop function public.news_insertar_post(uuid, text, uuid, jsonb, text, uuid);
drop function public.news_registrar_aviso(uuid, text, text);
drop function public.news_aviso_confirmar_a_mano(uuid);
drop function public.news_retirar(uuid, text, text);
drop function public.news_volver_a_publicar(uuid);
drop function public.news_salida_motivo(uuid, text, text);
drop function public.news_autopublish_configurar(boolean, integer, integer);
drop function public.news_posts_registra_salida();
drop function public.news_posts_guarda_automatica();

-- Tablas nuevas (vacías: lo comprobó el preflight).
drop table public.news_post_exits;
drop table public.news_publication_audit;
drop table public.news_autopublish_settings_log;
drop table public.news_autopublish_settings;

-- news_posts.
alter table public.news_posts drop constraint news_posts_sin_marca_verificar;
drop index public.news_posts_automaticas_idx;
drop index public.news_posts_un_borrador_una_vez;
alter table public.news_posts
  drop column content_sha256,
  drop column seo_draft_id,
  drop column publish_via;

-- seo_drafts.
drop index public.seo_drafts_en_revision_idx;
alter table public.seo_drafts
  drop column review_entered_at,
  drop column filter_results,
  drop column held_reasons,
  drop column writer_agent,
  drop column autopub_cover_image_url,
  drop column autopub_content_kind,
  drop column autopub_test_noticia,
  drop column idea_tipo,
  drop column search_console,
  drop column autopub_sources,
  drop column reviewer_verdict;

alter table public.seo_drafts drop constraint seo_drafts_status_check;
alter table public.seo_drafts add constraint seo_drafts_status_check
  check (status in ('draft', 'published', 'archived'));

do $categorias$
begin
  if pg_catalog.obj_description(
       (select oid from pg_catalog.pg_constraint
         where conrelid = 'public.seo_drafts'::regclass and conname = 'seo_drafts_categoria_check'),
       'pg_constraint') like 'SDD-0611 (0518)%' then
    alter table public.seo_drafts drop constraint seo_drafts_categoria_check;
    -- La lista de la 0053, NOT VALID como quedó desde la 0518.
    alter table public.seo_drafts add constraint seo_drafts_categoria_check
      check (categoria in (
        'operaciones','tarifas-fletes','aduana-seniat','tutoriales-guias',
        'china','industria-global','casos-reales',
        'analisis-opinion','mitos-realidades','anuncios-dtd'
      )) not valid;
  end if;
end
$categorias$;

-- Las dos funciones puras van al final: el CHECK que las usaba ya no está.
drop function public.news_huella(jsonb);
drop function public.news_texto_tiene_marca(text);
