-- ─────────────────────────────────────────────────────────────────────────────
-- 0532 · SDD-0625 — Editar, retirar y volver a publicar una noticia queda auditado.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK de Sam NOMBRANDO este archivo, el runbook aplicar-migraciones-prod y el
--    Director General. Fusionar la PR NO autoriza aplicarla.
--    ORDEN: migrate-first compatible. La pantalla de SDD-0625 funciona sin ella
--    (edita con la policy de 0055 y retira con las funciones de 0518); lo único
--    que falta sin esta migración es la fila de quién y cuándo editó.
--
-- Requiere la 0518 aplicada (en prueba y producción desde el 2026-11-08) y el
-- writer AUD-01 (append_audit_event, 0267 → 0294).
--
-- ── Por qué ─────────────────────────────────────────────────
-- SDD-0625 deja corregir una noticia ya publicada desde el Studio. `news_posts`
-- solo guarda `updated_at`: no dice quién cambió el texto público. AUD-01 §1
-- pide que la mutación y su evento sean una sola operación, y §5 que la
-- bitácora no copie datos que no hacen falta.
--
-- ── Qué hace ────────────────────────────────────────────────
-- 1. Registra el tipo de entidad `news_post` (dominio marketing).
-- 2. Crea audit_news_post_change(): disparador AFTER UPDATE sobre news_posts
--    que llama a append_audit_event en la MISMA transacción. Si el writer
--    falla, la escritura de la noticia se revierte.
--    · actor: auth.uid() del JWT; sin JWT (service_role, funciones), `system`.
--    · antes/después: `published`, `categoria` y la huella sha256 del titular,
--      la bajada, el cuerpo y el SEO. NO el texto: la noticia ya es pública y
--      la bitácora es de solo agregar (0267); copiarla ahí no aporta.
--    · payload.changed_fields: qué columnas cambiaron, sin valores.
--    · eventos: news_post_updated (texto, categoría o SEO),
--      news_post_withdrawn (published true → false; motivo = el de
--      news_retirar, o «motivo pendiente» si salió por otra vía) y
--      news_post_republished (false → true).
--    · un UPDATE que no cambia nada de eso (p. ej. solo updated_at) no
--      escribe evento.
-- No toca filas, policies, grants, la lectura pública (anon), news_post_exits
-- ni las funciones de 0518/0525/0526.
--
-- ── Locks ───────────────────────────────────────────────────
-- CREATE TRIGGER toma ShareRowExclusiveLock sobre news_posts hasta el COMMIT:
-- bloquea escrituras, no lecturas (/noticias sigue sirviendo).
--
-- ── Deshacer ────────────────────────────────────────────────
--   drop trigger audit_news_posts on public.news_posts;
--   drop function public.audit_news_post_change();
--   update public.audit_entity_types set status = 'deprecated' where entity_type = 'news_post';
-- (las filas ya escritas en entity_audit_log se quedan: es de solo agregar).
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_col text;
  v_writer regprocedure := pg_catalog.to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  );
begin
  if v_writer is null then
    raise exception '0532 requiere append_audit_event (0267/0294)';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = v_writer and p.prosecdef and p.proconfig @> array['search_path=""']
  ) then
    raise exception '0532 requiere append_audit_event SECURITY DEFINER con search_path vacío';
  end if;
  if pg_catalog.to_regclass('public.news_posts') is null
     or pg_catalog.to_regclass('public.audit_entity_types') is null
     or pg_catalog.to_regprocedure('public.news_retirar(uuid,text,text)') is null then
    raise exception '0532 requiere news_posts (0055), audit_entity_types y news_retirar (0518)';
  end if;
  foreach v_col in array array[
    'id', 'tenant_id', 'title', 'excerpt', 'body_markdown', 'categoria', 'tipo',
    'meta_description', 'focus_keyword', 'secondary_keywords', 'published'] loop
    if not exists (select 1 from pg_catalog.pg_attribute a
                    where a.attrelid = 'public.news_posts'::regclass
                      and a.attname = v_col and a.attnum > 0 and not a.attisdropped) then
      raise exception '0532 requiere public.news_posts.%', v_col;
    end if;
  end loop;
  if pg_catalog.to_regprocedure('public.audit_news_post_change()') is not null then
    raise exception '0532 ya aplicada: existe audit_news_post_change';
  end if;
  if exists (select 1 from pg_catalog.pg_trigger
              where tgrelid = 'public.news_posts'::regclass and tgname = 'audit_news_posts') then
    raise exception '0532 abortado: el disparador audit_news_posts ya existe';
  end if;
end;
$preflight$;

insert into public.audit_entity_types (entity_type, status, domain_code, contract_version, introduced_by_ref)
values ('news_post', 'active', 'marketing', 1, 'migration:0532')
on conflict (entity_type) do update
set status = excluded.status,
    domain_code = excluded.domain_code,
    contract_version = greatest(public.audit_entity_types.contract_version, excluded.contract_version);

create function public.audit_news_post_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old jsonb := pg_catalog.to_jsonb(old);
  v_new jsonb := pg_catalog.to_jsonb(new);
  v_actor_id uuid := auth.uid();
  v_motivo text := nullif(pg_catalog.current_setting('dtd.news_retiro_motivo', true), '');
  v_changed jsonb;
  v_event_type text;
  v_reason text;
  v_before jsonb;
  v_after jsonb;
begin
  select coalesce(pg_catalog.jsonb_agg(c.col order by c.col), '[]'::jsonb)
    into v_changed
    from pg_catalog.unnest(array[
      'title', 'excerpt', 'body_markdown', 'categoria', 'tipo',
      'meta_description', 'focus_keyword', 'secondary_keywords', 'published'
    ]) as c(col)
   where v_old -> c.col is distinct from v_new -> c.col;
  -- Nada de contenido ni de estado cambió (p. ej. solo updated_at): sin evento.
  if v_changed = '[]'::jsonb then
    return new;
  end if;

  -- Solo huellas y banderas: el texto ya es público y la bitácora no se borra.
  v_before := pg_catalog.jsonb_build_object(
    'published', v_old -> 'published',
    'categoria', v_old -> 'categoria',
    'title_sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(old.title, ''), 'UTF8')), 'hex'),
    'excerpt_sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(old.excerpt, ''), 'UTF8')), 'hex'),
    'body_sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(old.body_markdown, ''), 'UTF8')), 'hex'),
    'meta_sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      coalesce(old.meta_description, '') || E'\n' || coalesce(old.focus_keyword, ''), 'UTF8')), 'hex')
  );
  v_after := pg_catalog.jsonb_build_object(
    'published', v_new -> 'published',
    'categoria', v_new -> 'categoria',
    'title_sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(new.title, ''), 'UTF8')), 'hex'),
    'excerpt_sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(new.excerpt, ''), 'UTF8')), 'hex'),
    'body_sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(new.body_markdown, ''), 'UTF8')), 'hex'),
    'meta_sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      coalesce(new.meta_description, '') || E'\n' || coalesce(new.focus_keyword, ''), 'UTF8')), 'hex')
  );

  if old.published and not new.published then
    v_event_type := 'news_post_withdrawn';
    v_reason := case when v_motivo is null
      then 'Noticia sacada del sitio sin motivo: motivo pendiente.'
      else 'Noticia retirada del sitio. Motivo: ' || v_motivo || '.' end;
  elsif not old.published and new.published then
    v_event_type := 'news_post_republished';
    v_reason := 'Noticia publicada otra vez en el sitio.';
  else
    v_event_type := 'news_post_updated';
  end if;

  perform public.append_audit_event(
    new.tenant_id,
    'news_post',
    new.id,
    case when v_actor_id is null then 'system' else 'user' end,
    v_actor_id,
    v_event_type,
    case when v_actor_id is null then 'rpc' else 'studio' end,
    'succeeded',
    v_reason,
    v_before,
    v_after,
    pg_catalog.jsonb_build_object('changed_fields', v_changed),
    pg_catalog.concat('news-post:', new.id::text, ':', pg_catalog.txid_current()::text),
    1,
    'internal'
  );
  return new;
end;
$function$;

alter function public.audit_news_post_change() owner to postgres;
revoke all on function public.audit_news_post_change() from public, anon, authenticated;

comment on function public.audit_news_post_change() is
  'SDD-0625 · AUD-01: evento news_post_* con huellas de antes/después, columnas cambiadas y actor en la misma transacción que la edición, el retiro o la vuelta a publicar. No copia el texto. Si el writer falla, la escritura se revierte.';

create trigger audit_news_posts
  after update on public.news_posts
  for each row execute function public.audit_news_post_change();

do $postflight$
begin
  if not exists (select 1 from public.audit_entity_types
                  where entity_type = 'news_post' and status = 'active') then
    raise exception '0532 postflight: falta el tipo de entidad news_post activo';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure('public.audit_news_post_change()')
      and p.prosecdef and p.proconfig @> array['search_path=""']
  ) then
    raise exception '0532 postflight: audit_news_post_change sin SECURITY DEFINER o sin search_path vacío';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_trigger
       where tgrelid = 'public.news_posts'::regclass and tgname = 'audit_news_posts'
         and not tgisinternal and tgenabled = 'O') <> 1 then
    raise exception '0532 postflight: falta el disparador audit_news_posts habilitado';
  end if;
  if pg_catalog.has_function_privilege('authenticated', 'public.audit_news_post_change()', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.audit_news_post_change()', 'EXECUTE') then
    raise exception '0532 postflight: audit_news_post_change quedó ejecutable por la API';
  end if;
end;
$postflight$;
