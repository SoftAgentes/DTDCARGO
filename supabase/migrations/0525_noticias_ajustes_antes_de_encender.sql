-- ─────────────────────────────────────────────────────────────
-- 0525 · SDD-0611 — Ajustes de la publicación automática antes de encender.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK de Sam NOMBRANDO este archivo, el runbook aplicar-migraciones-prod y el
--    Director General. Aplicarla NO enciende nada: el interruptor sigue apagado.
--
-- Requiere la 0518 aplicada (en prueba y producción desde el 2026-11-08).
--
-- ── Qué hace ─────────────────────────────────────────────────
-- 1. C2 (decisión de Sam, 2026-11-08: «Quedan sin autor»): `seo_drafts.created_by`
--    pasa a `on delete set null` y deja de ser NOT NULL. Antes, borrar en Auth a
--    quien creó el borrador de una noticia automática publicada daba «Database
--    error deleting user»: la cascada de la 0053 chocaba con la FK `no action` de
--    `news_posts.seo_draft_id` (0518). Ahora el borrador queda sin autor.
-- 2. `news_salida_motivo` exige el motivo, de la lista cerrada, y la nota con
--    «otro», igual que `news_retirar`. Antes aceptaba un motivo nulo.
-- 3. anon pierde EXECUTE sobre `news_texto_tiene_marca` y `news_huella`. La 0518
--    las revocó solo `from public`, y los privilegios por defecto de Supabase
--    pueden dárselo a anon directamente. anon no escribe `news_posts`, así que el
--    CHECK de marcas no lo necesita.
-- 4. Punto 13 (decisión de Sam, 2026-11-08: «Sí, sigue contando»): si una persona
--    edita una noticia automática, `content_sha256` se recalcula con
--    `news_huella`. La noticia sigue siendo automática (cuenta en F7) y la guarda
--    de origen no cambia. La huella revisada sigue en `news_publication_audit`.
--
-- ── Qué NO toca ──────────────────────────────────────────────
-- La 0518 (su archivo ni sus objetos, salvo `news_salida_motivo`), las filas, las
-- policies, la lectura pública y el interruptor.
-- ─────────────────────────────────────────────────────────────

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regprocedure('public.news_huella(jsonb)') is null
     or pg_catalog.to_regprocedure('public.news_texto_tiene_marca(text)') is null
     or pg_catalog.to_regprocedure('public.news_salida_motivo(uuid,text,text)') is null
     or pg_catalog.to_regprocedure('public.news_posts_guarda_automatica()') is null then
    raise exception '0525 requiere la 0518 aplicada (news_huella, news_texto_tiene_marca, news_salida_motivo, news_posts_guarda_automatica)';
  end if;
  -- El cuerpo vivo de news_salida_motivo tiene que ser el de la 0518.
  if (select pg_catalog.md5(p.prosrc) from pg_catalog.pg_proc p
       where p.oid = 'public.news_salida_motivo(uuid,text,text)'::regprocedure)
     is distinct from '24f25f9541e99d5ac407d908db04945a' then
    raise exception '0525: news_salida_motivo no tiene el cuerpo de la 0518';
  end if;
  -- La FK viva de created_by tiene que ser la de la 0053.
  if (select pg_catalog.pg_get_constraintdef(c.oid) from pg_catalog.pg_constraint c
       where c.conrelid = 'public.seo_drafts'::regclass and c.conname = 'seo_drafts_created_by_fkey')
     is distinct from 'FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE' then
    raise exception '0525: seo_drafts_created_by_fkey no es la de la 0053';
  end if;
  if pg_catalog.to_regprocedure('public.news_posts_huella_al_editar()') is not null then
    raise exception '0525 ya aplicada: existe news_posts_huella_al_editar';
  end if;
end;
$preflight$;

-- ─── 1. C2 · borradores sin autor ────────────────────────────────────────────
alter table public.seo_drafts alter column created_by drop not null;
alter table public.seo_drafts
  drop constraint seo_drafts_created_by_fkey,
  add constraint seo_drafts_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

-- ─── 2. Motivo obligatorio al completar una salida ───────────────────────────
-- create or replace conserva los grants de la 0518 (EXECUTE solo authenticated).
create or replace function public.news_salida_motivo(p_exit_id uuid, p_motivo text, p_nota text)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if not (select public.is_tenant_admin()) then
    raise exception 'SDD-0611: solo un admin completa el motivo' using errcode = '42501';
  end if;
  -- La misma lista cerrada que news_retirar y que el CHECK news_exit_reason.
  if p_motivo is null or p_motivo not in ('dato_incorrecto', 'sin_fuente', 'linea_roja',
       'suena_a_ia', 'tono', 'no_es_el_publico', 'repetida', 'forma', 'otro') then
    raise exception 'SDD-0611: el motivo es obligatorio' using errcode = '22023';
  end if;
  if p_motivo = 'otro' and coalesce(pg_catalog.btrim(p_nota), '') = '' then
    raise exception 'SDD-0611: con «otro» la nota es obligatoria' using errcode = '22023';
  end if;
  update public.news_post_exits
     set reason = p_motivo, note = nullif(pg_catalog.btrim(p_nota), ''), reason_at = pg_catalog.now()
   where id = p_exit_id and tenant_id = (select public.get_user_tenant_id()) and reason is null;
  if not found then
    raise exception 'SDD-0611: no hay una salida con motivo pendiente con ese id' using errcode = 'P0002';
  end if;
end;
$fn$;

-- ─── 3. anon sin EXECUTE sobre las funciones de marca y huella ───────────────
revoke execute on function public.news_texto_tiene_marca(text) from anon;
revoke execute on function public.news_huella(jsonb) from anon;

-- ─── 4. La huella sigue al texto cuando una persona edita una automática ─────
create function public.news_posts_huella_al_editar()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  -- news_huella lee tipo, categoria, title, focus_keyword, secondary_keywords,
  -- meta_description y body_markdown: to_jsonb(new) trae esas claves.
  if new.publish_via = 'automatica' and (
       new.tipo is distinct from old.tipo
    or new.categoria is distinct from old.categoria
    or new.title is distinct from old.title
    or new.focus_keyword is distinct from old.focus_keyword
    or new.secondary_keywords is distinct from old.secondary_keywords
    or new.meta_description is distinct from old.meta_description
    or new.body_markdown is distinct from old.body_markdown) then
    new.content_sha256 := public.news_huella(pg_catalog.to_jsonb(new));
  end if;
  return new;
end;
$fn$;

comment on function public.news_posts_huella_al_editar() is
  'SDD-0611 punto 13: recalcula content_sha256 de una automática editada. Corre después de news_posts_guarda_automatica_trg (orden alfabético).';

revoke all on function public.news_posts_huella_al_editar() from public, anon, authenticated;

-- El nombre va después de news_posts_guarda_automatica_trg en orden alfabético:
-- la guarda ve el content_sha256 sin tocar y después este disparador lo recalcula.
create trigger news_posts_huella_al_editar_trg
  before update on public.news_posts
  for each row execute function public.news_posts_huella_al_editar();

-- ─── Postflight ──────────────────────────────────────────────────────────────
do $postflight$
begin
  if (select pg_catalog.pg_get_constraintdef(c.oid) from pg_catalog.pg_constraint c
       where c.conrelid = 'public.seo_drafts'::regclass and c.conname = 'seo_drafts_created_by_fkey')
     is distinct from 'FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL' then
    raise exception '0525 postflight: la FK de created_by no quedó en SET NULL';
  end if;
  if pg_catalog.has_function_privilege('anon', 'public.news_huella(jsonb)', 'execute')
     or pg_catalog.has_function_privilege('anon', 'public.news_texto_tiene_marca(text)', 'execute') then
    raise exception '0525 postflight: anon sigue con EXECUTE sobre la huella o la marca';
  end if;
  if not exists (select 1 from pg_catalog.pg_trigger
                  where tgrelid = 'public.news_posts'::regclass
                    and tgname = 'news_posts_huella_al_editar_trg' and not tgisinternal) then
    raise exception '0525 postflight: falta el disparador de la huella';
  end if;
end;
$postflight$;
