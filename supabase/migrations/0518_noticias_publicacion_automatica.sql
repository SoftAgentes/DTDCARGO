-- ─────────────────────────────────────────────────────────────
-- 0518 · SDD-0611 — Publicación automática de noticias en /noticias, con filtros.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK de Sam NOMBRANDO este archivo, el runbook aplicar-migraciones-prod y el
--    Director General. Aplicarla NO enciende nada: el interruptor nace apagado
--    y ninguna ruta del Studio llama todavía a estas funciones.
--
-- ── Qué hace ─────────────────────────────────────────────────
-- 1. `seo_drafts`: los estados `en_revision` y `retenido` (SDD-0611 §4.1), las
--    columnas (`autopub_*` y las del veredicto; nombres únicos para que el gate
--    de símbolos pendientes no las confunda con claves homónimas) que trae un borrador para poder publicarse solo (veredicto del
--    Revisor, fuentes, consulta de Search Console, agente que redactó, …) y los
--    motivos de retención. El CHECK de `categoria` pasa a las 6 categorías de
--    negocio (0140 lo cambió en `news_posts` y no aquí) como NOT VALID, solo si
--    todavía es el de la 0053.
-- 2. `news_posts`: `publish_via` (manual | automatica), `seo_draft_id` (una sola
--    publicación por borrador, F10) y `content_sha256`. Un CHECK NOT VALID
--    rechaza publicar un texto con una marca `[VERIFICAR`, por cualquier vía
--    (criterio 3). Una fila automática solo la escriben estas funciones.
-- 3. `news_autopublish_settings`: el interruptor (apagado por defecto) y los
--    topes por día y por semana. El límite duro de una por día es un CHECK.
--    Cada cambio deja su fila en `news_autopublish_settings_log`.
-- 4. `news_publication_audit`: una fila por evaluación (§4.4), sin prompts,
--    razonamiento, secretos ni datos personales. Lleva el estado del aviso a
--    Discord, que lee F8.
-- 5. `news_post_exits`: toda salida de una noticia del sitio (retiro, despublicar
--    por otra vía, borrado) con su motivo o «motivo pendiente» (§4.11).
-- 6. Funciones:
--    · `news_evaluacion_automatica` (solo service_role): reevalúa F1, F3 (huella),
--      F7, F9 y F10 con bloqueo y publica o retiene en la misma transacción.
--    · `news_publicar_manual` (admin): la salida manual de IA-01; deja el nombre.
--    · `news_registrar_aviso` (service_role) y `news_aviso_confirmar_a_mano` (admin).
--    · `news_autopublish_configurar` (admin): interruptor y topes, con registro.
--    · `news_retirar` (admin): retiro con motivo obligatorio; no toca el interruptor.
--    · `news_salida_motivo` (admin): completa el motivo de una salida pendiente.
--    · `news_volver_a_publicar` (admin): una persona vuelve a publicar una retirada.
-- 7. Disparadores: registran toda salida, rechazan borrar una noticia automática
--    y rechazan que una sesión de la API escriba una fila automática a mano.
--
-- ── Qué NO toca ──────────────────────────────────────────────
-- Filas existentes (salvo el valor por defecto `publish_via = 'manual'` de las
-- noticias de hoy, que publicó una persona), las policies de `news_posts` y
-- `seo_drafts`, la lectura pública y cualquier otra tabla.
-- ─────────────────────────────────────────────────────────────

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.news_posts') is null
     or pg_catalog.to_regclass('public.seo_drafts') is null
     or pg_catalog.to_regclass('public.tenants') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.is_tenant_admin()') is null then
    raise exception '0518 requiere news_posts (0055), seo_drafts (0053), tenants, get_user_tenant_id() e is_tenant_admin() (0386)';
  end if;
  if pg_catalog.to_regclass('public.news_publication_audit') is not null
     or pg_catalog.to_regprocedure('public.news_evaluacion_automatica(uuid,uuid,jsonb,jsonb,jsonb,text[])') is not null then
    raise exception '0518: la publicación automática ya existe; no se reaplica';
  end if;
  if exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.news_posts'::regclass and attname = 'publish_via' and not attisdropped
  ) then
    raise exception '0518: news_posts.publish_via ya existe con otra forma';
  end if;
end
$preflight$;

-- ─── 0. Marca [VERIFICAR, en cualquier forma ────────────────────────────────
-- La misma regla que `lib/news/autopublicar/marcas.ts`: NFKC (un corchete de
-- ancho completo cuenta), sin caracteres invisibles ni guiones blandos, sin
-- distinguir mayúsculas, con o sin dos puntos, vacía, y también codificada en
-- un enlace (`%5B`).
create function public.news_texto_tiene_marca(p_texto text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $fn$
  select coalesce(
    pg_catalog.regexp_replace(
      pg_catalog.normalize(p_texto, 'NFKC'),
      '[­​-‏⁠﻿]', '', 'g'
    ) ~* '(\[|%5b)\s*verificar',
    false
  );
$fn$;

comment on function public.news_texto_tiene_marca(text) is
  'SDD-0611 F4: ¿el texto tiene una marca [VERIFICAR en cualquier forma? Gemela de lib/news/autopublicar/marcas.ts.';

revoke all on function public.news_texto_tiene_marca(text) from public;
grant execute on function public.news_texto_tiene_marca(text) to authenticated, service_role;

-- Huella de lo que se publica (F3): la misma serialización que
-- `lib/news/autopublicar/huella.ts`. Campos en orden fijo, separados por U+001F;
-- las palabras secundarias, por U+001E.
create function public.news_huella(p_post jsonb)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $fn$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.concat_ws(
      pg_catalog.chr(31),
      'sdd0611-v1',
      coalesce(p_post ->> 'tipo', ''),
      coalesce(p_post ->> 'categoria', ''),
      coalesce(p_post ->> 'title', ''),
      coalesce(p_post ->> 'focus_keyword', ''),
      coalesce(pg_catalog.array_to_string(array(
        select pg_catalog.jsonb_array_elements_text(
          case when pg_catalog.jsonb_typeof(p_post -> 'secondary_keywords') = 'array'
               then p_post -> 'secondary_keywords' else '[]'::jsonb end)
      ), pg_catalog.chr(30)), ''),
      coalesce(p_post ->> 'meta_description', ''),
      coalesce(p_post ->> 'body_markdown', '')
    ), 'UTF8')), 'hex');
$fn$;

comment on function public.news_huella(jsonb) is
  'SDD-0611 F3: SHA-256 del titular, cuerpo y metadatos que se publican. Gemela de lib/news/autopublicar/huella.ts.';

revoke all on function public.news_huella(jsonb) from public;
grant execute on function public.news_huella(jsonb) to authenticated, service_role;

-- ─── 1. Borradores ───────────────────────────────────────────────────────────
alter table public.seo_drafts drop constraint if exists seo_drafts_status_check;
alter table public.seo_drafts add constraint seo_drafts_status_check
  check (status in ('draft', 'en_revision', 'retenido', 'published', 'archived'));

-- 0140 cambió las categorías de `news_posts` y no las de `seo_drafts`. Solo si el
-- CHECK sigue siendo el de la 0053 (lista vieja) se cambia por las 6 de negocio,
-- NOT VALID (no revisa las filas de hoy) y con una marca en su comentario para que
-- el desarme sepa qué devolver. Si producción ya lo cambió fuera de banda, no se toca.
do $categorias$
begin
  if exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'public.seo_drafts'::regclass and conname = 'seo_drafts_categoria_check'
       and pg_catalog.pg_get_constraintdef(oid) like '%tarifas-fletes%'
  ) then
    alter table public.seo_drafts drop constraint seo_drafts_categoria_check;
    alter table public.seo_drafts add constraint seo_drafts_categoria_check
      check (categoria is null or categoria in (
        'importa-sin-perder-plata', 'que-se-mueve-en-china', 'como-llega-tu-mercancia',
        'venezuela-y-tu-bolsillo', 'historias-reales', 'novedades-dtd'
      )) not valid;
    comment on constraint seo_drafts_categoria_check on public.seo_drafts is
      'SDD-0611 (0518): reemplazó el de la 0053 con la lista vieja de 10 categorías';
  end if;
end
$categorias$;

alter table public.seo_drafts
  add column reviewer_verdict    jsonb,
  add column autopub_sources     jsonb not null default '[]'::jsonb,
  add column search_console      jsonb,
  add column idea_tipo           text,
  add column autopub_test_noticia jsonb,
  add column autopub_content_kind text,
  add column autopub_cover_image_url text,
  add column writer_agent        jsonb,
  add column held_reasons        text[] not null default '{}',
  add column filter_results      jsonb,
  add column review_entered_at   timestamptz;

alter table public.seo_drafts
  add constraint seo_drafts_sources_lista
    check (jsonb_typeof(autopub_sources) = 'array' and jsonb_array_length(autopub_sources) <= 50
           and octet_length(autopub_sources::text) <= 16384),
  add constraint seo_drafts_verdict_objeto
    check (reviewer_verdict is null or (jsonb_typeof(reviewer_verdict) = 'object'
           and octet_length(reviewer_verdict::text) <= 16384)),
  add constraint seo_drafts_search_console_objeto
    check (search_console is null or (jsonb_typeof(search_console) = 'object'
           and octet_length(search_console::text) <= 4096)),
  add constraint seo_drafts_idea_tipo_valido
    check (idea_tipo is null or idea_tipo in (
      'guia', 'postura', 'historia', 'dato', 'actualidad', 'promo', 'pregunta', 'detras-camara')),
  add constraint seo_drafts_test_noticia_objeto
    check (autopub_test_noticia is null or jsonb_typeof(autopub_test_noticia) = 'object'),
  add constraint seo_drafts_content_kind_valido
    check (autopub_content_kind is null or autopub_content_kind in ('guide', 'news', 'analysis', 'case')),
  add constraint seo_drafts_writer_agent_objeto
    check (writer_agent is null or (jsonb_typeof(writer_agent) = 'object'
           and (writer_agent - array['agente', 'modelo', 'version']) = '{}'::jsonb)),
  add constraint seo_drafts_held_reasons_cortos
    check (cardinality(held_reasons) <= 30
           and array_to_string(held_reasons, ',') ~ '^([a-z0-9_:]{1,60}(,[a-z0-9_:]{1,60})*)?$'),
  add constraint seo_drafts_filter_results_objeto
    check (filter_results is null or jsonb_typeof(filter_results) = 'object');

comment on column public.seo_drafts.reviewer_verdict is
  'SDD-0611 F3/F5: veredicto del Revisor {veredicto, agente, modelo, version, draft_id, huella, lineas_rojas{}, riesgo}. Vale solo para esa huella.';
comment on column public.seo_drafts.held_reasons is
  'SDD-0611 §4.2: códigos de los filtros que fallaron cuando el borrador quedó retenido.';

create index seo_drafts_en_revision_idx
  on public.seo_drafts (tenant_id, review_entered_at)
  where status = 'en_revision';

-- ─── 2. Noticias ─────────────────────────────────────────────────────────────
alter table public.news_posts
  add column publish_via     text not null default 'manual',
  add column seo_draft_id    uuid references public.seo_drafts(id) on delete set null,
  add column content_sha256  text;

alter table public.news_posts
  add constraint news_posts_publish_via_valida check (publish_via in ('manual', 'automatica')),
  add constraint news_posts_sha256_hex check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  add constraint news_posts_automatica_con_huella
    check (publish_via = 'manual' or (seo_draft_id is not null and content_sha256 is not null));

-- Criterio 3: nada con una marca [VERIFICAR queda publicado, venga de donde venga.
-- NOT VALID: no revisa las filas de hoy (antes de aplicar se cuentan, ver el
-- paquete); sí todo INSERT y todo UPDATE de una fila publicada.
alter table public.news_posts add constraint news_posts_sin_marca_verificar
  check (
    not published
    or not (
      public.news_texto_tiene_marca(title)
      or public.news_texto_tiene_marca(body_markdown)
      or public.news_texto_tiene_marca(excerpt)
      or public.news_texto_tiene_marca(coalesce(meta_description, ''))
    )
  ) not valid;

-- F10: un borrador se publica una sola vez.
create unique index news_posts_un_borrador_una_vez
  on public.news_posts (seo_draft_id) where seo_draft_id is not null;

-- F7: lo que cuenta el tope (solo las automáticas).
create index news_posts_automaticas_idx
  on public.news_posts (tenant_id, created_at) where publish_via = 'automatica';

comment on column public.news_posts.publish_via is
  'SDD-0611: manual (una persona) o automatica (la vía de los filtros). Solo las automáticas cuentan para el tope.';

-- ─── 3. Interruptor y topes ──────────────────────────────────────────────────
create table public.news_autopublish_settings (
  tenant_id     uuid primary key references public.tenants(id) on delete cascade,
  enabled       boolean not null default false,
  daily_cap     integer not null default 1,
  weekly_cap    integer not null default 2,
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  -- El límite duro de §4.2.1: nunca más de una automática por día.
  constraint news_autopublish_tope_dia check (daily_cap between 0 and 1),
  constraint news_autopublish_tope_semana check (weekly_cap between 0 and 7)
);

comment on table public.news_autopublish_settings is
  'SDD-0611 §4.6: interruptor news_autopublish (apagado por defecto) y topes por tenant. Solo se cambia con news_autopublish_configurar.';

create table public.news_autopublish_settings_log (
  id          uuid primary key default extensions.gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  enabled     boolean not null,
  daily_cap   integer not null,
  weekly_cap  integer not null,
  changed_by  uuid not null,
  changed_at  timestamptz not null default now()
);

-- ─── 4. Auditoría ────────────────────────────────────────────────────────────
create table public.news_publication_audit (
  id                 uuid primary key default extensions.gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  draft_id           uuid,
  post_id            uuid,
  correlation_id     uuid not null,
  evaluated_at       timestamptz not null default now(),
  via                text not null,
  decision           text not null,
  content_sha256     text,
  writer             jsonb,
  reviewer           jsonb,
  prompts_version    text,
  control_version    text,
  filters            jsonb not null,
  reasons            text[] not null default '{}',
  switch_enabled     boolean,
  actor_id           uuid,
  notice_state       text,
  notice_message_id  text,
  notice_at          timestamptz,

  constraint news_audit_via check (via in ('manual', 'automatica')),
  constraint news_audit_decision check (decision in ('publicada', 'retenida')),
  constraint news_audit_sha check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  -- Agente, modelo y versión; nada más (sin prompts ni razonamiento).
  constraint news_audit_writer_forma check (writer is null or (
    jsonb_typeof(writer) = 'object' and (writer - array['agente', 'modelo', 'version']) = '{}'::jsonb)),
  constraint news_audit_reviewer_forma check (reviewer is null or (
    jsonb_typeof(reviewer) = 'object' and (reviewer - array['agente', 'modelo', 'version', 'veredicto']) = '{}'::jsonb)),
  -- Solo los resultados de F1 a F10.
  constraint news_audit_filters_forma check (
    jsonb_typeof(filters) = 'object'
    and (filters - array['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10']) = '{}'::jsonb
    and octet_length(filters::text) <= 8192),
  constraint news_audit_reasons check (cardinality(reasons) <= 30
    and array_to_string(reasons, ',') ~ '^([a-z0-9_:]{1,60}(,[a-z0-9_:]{1,60})*)?$'),
  constraint news_audit_versiones_cortas check (
    coalesce(char_length(prompts_version), 0) <= 80 and coalesce(char_length(control_version), 0) <= 80),
  -- F9: una publicación automática deja agente, modelo y versión de quien
  -- redactó y de quien revisó, y las versiones de prompts y control.
  constraint news_audit_publicada_completa check (
    not (via = 'automatica' and decision = 'publicada')
    or (post_id is not null and content_sha256 is not null
        and coalesce(writer ->> 'agente', '') <> '' and coalesce(writer ->> 'modelo', '') <> ''
        and coalesce(writer ->> 'version', '') <> ''
        and coalesce(reviewer ->> 'agente', '') <> '' and coalesce(reviewer ->> 'modelo', '') <> ''
        and coalesce(reviewer ->> 'version', '') <> ''
        and coalesce(prompts_version, '') <> '' and coalesce(control_version, '') <> '')),
  constraint news_audit_manual_con_persona check (via = 'automatica' or actor_id is not null),
  constraint news_audit_aviso check (notice_state is null or notice_state in (
    'pendiente', 'entregado', 'rechazado', 'reintentable', 'incierto', 'confirmado_a_mano')),
  constraint news_audit_aviso_snowflake check (
    notice_message_id is null or notice_message_id ~ '^[0-9]{17,20}$')
);

comment on table public.news_publication_audit is
  'SDD-0611 §4.4: una fila por evaluación de una noticia (publique o retenga). Sin prompts, razonamiento, secretos ni datos personales.';

create index news_publication_audit_tenant_idx
  on public.news_publication_audit (tenant_id, evaluated_at desc);

-- ─── 5. Salidas del sitio ────────────────────────────────────────────────────
create table public.news_post_exits (
  id              uuid primary key default extensions.gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  post_id         uuid not null,
  slug            text not null,
  title           text not null,
  content_sha256  text,
  publish_via     text not null,
  kind            text not null,
  reason          text,
  note            text,
  actor_id        uuid,
  created_at      timestamptz not null default now(),
  reason_at       timestamptz,

  constraint news_exit_kind check (kind in ('retiro', 'despublicada', 'borrada')),
  constraint news_exit_via check (publish_via in ('manual', 'automatica')),
  constraint news_exit_reason check (reason is null or reason in (
    'dato_incorrecto', 'sin_fuente', 'linea_roja', 'suena_a_ia', 'tono',
    'no_es_el_publico', 'repetida', 'forma', 'otro')),
  constraint news_exit_nota_corta check (note is null or char_length(note) <= 1000),
  constraint news_exit_otro_con_nota check (reason is distinct from 'otro' or coalesce(btrim(note), '') <> ''),
  constraint news_exit_retiro_con_motivo check (kind <> 'retiro' or reason is not null)
);

comment on table public.news_post_exits is
  'SDD-0611 §4.11: toda salida de una noticia del sitio. reason null = motivo pendiente.';

create index news_post_exits_tenant_idx on public.news_post_exits (tenant_id, created_at desc);

-- ─── 6. Permisos de las tablas nuevas ────────────────────────────────────────
alter table public.news_autopublish_settings enable row level security;
alter table public.news_autopublish_settings_log enable row level security;
alter table public.news_publication_audit enable row level security;
alter table public.news_post_exits enable row level security;

revoke all on public.news_autopublish_settings, public.news_autopublish_settings_log,
  public.news_publication_audit, public.news_post_exits from public, anon, authenticated;
-- Un admin LEE lo de su tenant; escribir, solo por las funciones.
grant select on public.news_autopublish_settings, public.news_autopublish_settings_log,
  public.news_publication_audit, public.news_post_exits to authenticated;
grant select, insert, update, delete on public.news_autopublish_settings,
  public.news_autopublish_settings_log, public.news_publication_audit,
  public.news_post_exits to service_role;

create policy news_autopublish_settings_admin_select on public.news_autopublish_settings
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));
create policy news_autopublish_settings_log_admin_select on public.news_autopublish_settings_log
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));
create policy news_publication_audit_admin_select on public.news_publication_audit
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));
create policy news_post_exits_admin_select on public.news_post_exits
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));

-- ─── 7. Disparadores de news_posts ───────────────────────────────────────────
-- Una fila automática solo la escriben las funciones de esta migración (corren
-- como su dueño). Una sesión de la API no la crea ni le cambia el origen.
create function public.news_posts_guarda_automatica()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  -- service_role tampoco: la llave general no publica una automática (§4.8).
  if current_user in ('authenticated', 'anon', 'service_role') then
    if tg_op = 'INSERT' and (new.publish_via = 'automatica' or new.seo_draft_id is not null
                             or new.content_sha256 is not null) then
      raise exception 'SDD-0611: una noticia automática solo la publica la función de la base'
        using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (new.publish_via is distinct from old.publish_via
                             or new.seo_draft_id is distinct from old.seo_draft_id
                             or new.content_sha256 is distinct from old.content_sha256) then
      raise exception 'SDD-0611: el origen de una noticia no se cambia a mano'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$fn$;

create trigger news_posts_guarda_automatica_trg
  before insert or update on public.news_posts
  for each row execute function public.news_posts_guarda_automatica();

-- Toda salida queda registrada (§4.11). `news_retirar` marca la transacción para
-- que su salida lleve motivo; cualquier otra queda con «motivo pendiente».
create function public.news_posts_registra_salida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_motivo text := nullif(pg_catalog.current_setting('dtd.news_retiro_motivo', true), '');
  v_nota   text := nullif(pg_catalog.current_setting('dtd.news_retiro_nota', true), '');
begin
  if tg_op = 'DELETE' then
    -- Borrar de verdad una noticia automática no se permite: se retira. El
    -- borrado en cascada (un tenant que se elimina) llega con profundidad > 1.
    if old.publish_via = 'automatica' and pg_catalog.pg_trigger_depth() = 1 then
      raise exception 'SDD-0611: una noticia publicada sola no se borra; se retira'
        using errcode = '42501';
    end if;
    if old.published and pg_catalog.pg_trigger_depth() = 1 then
      insert into public.news_post_exits
        (tenant_id, post_id, slug, title, content_sha256, publish_via, kind, actor_id)
      values (old.tenant_id, old.id, old.slug, old.title,
              coalesce(old.content_sha256, pg_catalog.encode(pg_catalog.sha256(
                pg_catalog.convert_to(old.body_markdown, 'UTF8')), 'hex')),
              old.publish_via, 'borrada', (select auth.uid()));
    end if;
    return old;
  end if;

  if old.published and not new.published then
    insert into public.news_post_exits
      (tenant_id, post_id, slug, title, content_sha256, publish_via, kind, reason, note, actor_id, reason_at)
    values (new.tenant_id, new.id, new.slug, new.title,
            coalesce(new.content_sha256, pg_catalog.encode(pg_catalog.sha256(
              pg_catalog.convert_to(new.body_markdown, 'UTF8')), 'hex')),
            new.publish_via,
            case when v_motivo is null then 'despublicada' else 'retiro' end,
            v_motivo, v_nota, (select auth.uid()),
            case when v_motivo is null then null else pg_catalog.now() end);
  end if;
  return new;
end;
$fn$;

revoke all on function public.news_posts_registra_salida() from public, anon, authenticated;

create trigger news_posts_registra_salida_upd
  after update of published on public.news_posts
  for each row execute function public.news_posts_registra_salida();
create trigger news_posts_registra_salida_del
  before delete on public.news_posts
  for each row execute function public.news_posts_registra_salida();

-- ─── 8. Funciones ────────────────────────────────────────────────────────────

-- Interruptor y topes. Solo un admin del tenant, con registro.
create function public.news_autopublish_configurar(
  p_enabled boolean, p_daily_cap integer, p_weekly_cap integer)
returns public.news_autopublish_settings
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_tenant uuid := (select public.get_user_tenant_id());
  v_actor  uuid := (select auth.uid());
  v_fila   public.news_autopublish_settings;
begin
  if v_tenant is null or v_actor is null or not (select public.is_tenant_admin()) then
    raise exception 'SDD-0611: solo un admin cambia el interruptor' using errcode = '42501';
  end if;
  if p_enabled is null or p_daily_cap is null or p_weekly_cap is null then
    raise exception 'SDD-0611: interruptor y topes son obligatorios' using errcode = '22004';
  end if;
  insert into public.news_autopublish_settings as s
    (tenant_id, enabled, daily_cap, weekly_cap, updated_at, updated_by)
  values (v_tenant, p_enabled, p_daily_cap, p_weekly_cap, pg_catalog.now(), v_actor)
  on conflict (tenant_id) do update
    set enabled = excluded.enabled, daily_cap = excluded.daily_cap,
        weekly_cap = excluded.weekly_cap, updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
  returning * into v_fila;
  insert into public.news_autopublish_settings_log
    (tenant_id, enabled, daily_cap, weekly_cap, changed_by)
  values (v_tenant, p_enabled, p_daily_cap, p_weekly_cap, v_actor);
  return v_fila;
end;
$fn$;

-- Lo común a las dos vías: insertar la noticia desde campos permitidos.
create function public.news_insertar_post(
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

revoke all on function public.news_insertar_post(uuid, text, uuid, jsonb, text, uuid) from public, anon, authenticated, service_role;

-- La vía automática. La llama el Studio (service_role) después de evaluar en
-- código F2, F4, F5, F6 y F8; `p_motivos` trae lo que ya falló allí. Aquí se
-- reevalúan, con bloqueo, F1, F3 (huella y veredicto), F7 y F10, y la auditoría
-- (F9) se escribe en la misma transacción: si no se puede escribir, no se publica.
create function public.news_evaluacion_automatica(
  p_tenant_id  uuid,
  p_draft_id   uuid,
  p_post       jsonb,
  p_auditoria  jsonb,
  p_filtros    jsonb,
  p_motivos    text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_draft    public.seo_drafts;
  v_conf     public.news_autopublish_settings;
  v_motivos  text[] := coalesce(p_motivos, '{}');
  v_filtros  jsonb := coalesce(p_filtros, '{}'::jsonb);
  v_huella   text := public.news_huella(p_post);
  v_ahora    timestamp := (pg_catalog.now() at time zone 'America/Caracas');
  v_dia      integer;
  v_semana   integer;
  v_post_id  uuid;
  v_audit_id uuid;
  v_decision text;
  v_f3       text;
begin
  -- El borrador, con bloqueo: dos corridas sobre el mismo borrador se ordenan.
  select * into v_draft from public.seo_drafts where id = p_draft_id for update;
  if not found or v_draft.tenant_id is distinct from p_tenant_id then
    raise exception 'SDD-0611: borrador inexistente para este tenant' using errcode = 'P0002';
  end if;
  -- La vía automática solo toma borradores en revisión (§4.1).
  if v_draft.status <> 'en_revision' then
    return pg_catalog.jsonb_build_object('decision', 'ignorada', 'estado', v_draft.status);
  end if;

  -- F1 · interruptor, con bloqueo: serializa las corridas del tenant, así el
  -- tope se cuenta con lo que la otra corrida ya publicó.
  select * into v_conf from public.news_autopublish_settings
   where tenant_id = p_tenant_id for update;
  if not found or not v_conf.enabled then
    v_motivos := pg_catalog.array_append(v_motivos, 'interruptor_apagado');
    v_filtros := v_filtros || pg_catalog.jsonb_build_object('F1', pg_catalog.jsonb_build_object(
      'pasa', false, 'codigos', pg_catalog.jsonb_build_array('interruptor_apagado')));
  end if;

  -- F3 · el veredicto vale solo para esta huella y este borrador.
  if v_draft.reviewer_verdict is null
     or coalesce(v_draft.reviewer_verdict ->> 'veredicto', '') <> 'aprobado' then
    v_f3 := 'sin_revisor';
  elsif v_draft.reviewer_verdict ->> 'huella' is distinct from v_huella
        or v_draft.reviewer_verdict ->> 'draft_id' is distinct from p_draft_id::text
        or p_auditoria ->> 'content_sha256' is distinct from v_huella then
    v_f3 := 'revision_vencida';
  end if;
  if v_f3 is not null then
    v_motivos := v_motivos || v_f3;
    v_filtros := v_filtros || pg_catalog.jsonb_build_object('F3', pg_catalog.jsonb_build_object(
      'pasa', false, 'codigos', pg_catalog.jsonb_build_array(v_f3)));
  end if;

  -- F7 · tope por día y por semana, en hora de Caracas, de lunes a domingo, solo
  -- automáticas. El límite duro de una por día lo cuida además el CHECK.
  select count(*) filter (where (p.created_at at time zone 'America/Caracas')::date = v_ahora::date),
         count(*) filter (where pg_catalog.date_trunc('week', p.created_at at time zone 'America/Caracas')
                                = pg_catalog.date_trunc('week', v_ahora))
    into v_dia, v_semana
    from public.news_posts p
   where p.tenant_id = p_tenant_id and p.publish_via = 'automatica';
  if v_dia >= least(coalesce(v_conf.daily_cap, 0), 1) then
    v_motivos := pg_catalog.array_append(v_motivos, 'tope_dia');
    v_filtros := v_filtros || pg_catalog.jsonb_build_object('F7', pg_catalog.jsonb_build_object(
      'pasa', false, 'codigos', pg_catalog.jsonb_build_array('tope_dia')));
  elsif v_semana >= coalesce(v_conf.weekly_cap, 0) then
    v_motivos := pg_catalog.array_append(v_motivos, 'tope_semana');
    v_filtros := v_filtros || pg_catalog.jsonb_build_object('F7', pg_catalog.jsonb_build_object(
      'pasa', false, 'codigos', pg_catalog.jsonb_build_array('tope_semana')));
  end if;

  -- F10 · una sola vez por borrador, y el slug no choca.
  if exists (select 1 from public.news_posts where seo_draft_id = p_draft_id)
     or exists (select 1 from public.news_posts where slug = p_post ->> 'slug') then
    v_motivos := pg_catalog.array_append(v_motivos, 'duplicado');
    v_filtros := v_filtros || pg_catalog.jsonb_build_object('F10', pg_catalog.jsonb_build_object(
      'pasa', false, 'codigos', pg_catalog.jsonb_build_array('duplicado')));
  end if;

  -- Criterio 3, también aquí: con una marca no se publica.
  if public.news_texto_tiene_marca(p_post ->> 'title')
     or public.news_texto_tiene_marca(p_post ->> 'body_markdown')
     or public.news_texto_tiene_marca(coalesce(p_post ->> 'excerpt', ''))
     or public.news_texto_tiene_marca(coalesce(p_post ->> 'meta_description', '')) then
    if not ('marca_pendiente' = any (v_motivos)) then
      v_motivos := pg_catalog.array_append(v_motivos, 'marca_pendiente');
    end if;
    v_filtros := v_filtros || pg_catalog.jsonb_build_object('F4', pg_catalog.jsonb_build_object(
      'pasa', false, 'codigos', pg_catalog.jsonb_build_array('marca_pendiente')));
  end if;

  -- Sin repetidos, en el orden en que aparecieron.
  v_motivos := array(
    select u.m from pg_catalog.unnest(v_motivos) with ordinality as u(m, i)
     group by u.m order by min(u.i));
  v_decision := case when pg_catalog.cardinality(v_motivos) = 0 then 'publicada' else 'retenida' end;

  if v_decision = 'publicada' then
    v_post_id := public.news_insertar_post(p_tenant_id, 'automatica', p_draft_id, p_post, v_huella, null);
    update public.seo_drafts
       set status = 'published', held_reasons = '{}', filter_results = v_filtros
     where id = p_draft_id;
  else
    update public.seo_drafts
       set status = 'retenido', held_reasons = v_motivos, filter_results = v_filtros
     where id = p_draft_id;
  end if;

  -- F9 · la auditoría en la misma transacción. Si un CHECK la rechaza, todo lo
  -- anterior se deshace: no queda nada publicado.
  insert into public.news_publication_audit (
    tenant_id, draft_id, post_id, correlation_id, via, decision, content_sha256,
    writer, reviewer, prompts_version, control_version, filters, reasons,
    switch_enabled, notice_state)
  values (
    p_tenant_id, p_draft_id, v_post_id,
    coalesce((p_auditoria ->> 'correlation_id')::uuid, extensions.gen_random_uuid()),
    'automatica', v_decision, v_huella,
    p_auditoria -> 'writer', p_auditoria -> 'reviewer',
    p_auditoria ->> 'prompts_version', p_auditoria ->> 'control_version',
    v_filtros, v_motivos, coalesce(v_conf.enabled, false),
    'pendiente')
  returning id into v_audit_id;

  return pg_catalog.jsonb_build_object(
    'decision', v_decision, 'post_id', v_post_id, 'audit_id', v_audit_id,
    'motivos', pg_catalog.to_jsonb(v_motivos), 'huella', v_huella,
    'semana', v_semana + case when v_decision = 'publicada' then 1 else 0 end);
end;
$fn$;

-- La vía manual: una persona admin publica (también un retenido) y queda su nombre.
create function public.news_publicar_manual(
  p_draft_id uuid, p_post jsonb, p_filtros jsonb, p_motivos text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_tenant   uuid := (select public.get_user_tenant_id());
  v_actor    uuid := (select auth.uid());
  v_huella   text := public.news_huella(p_post);
  v_post_id  uuid;
  v_audit_id uuid;
begin
  if v_tenant is null or v_actor is null or not (select public.is_tenant_admin()) then
    raise exception 'SDD-0611: solo un admin publica a mano' using errcode = '42501';
  end if;
  if p_draft_id is not null and not exists (
    select 1 from public.seo_drafts where id = p_draft_id and tenant_id = v_tenant
  ) then
    raise exception 'SDD-0611: borrador de otro tenant' using errcode = '42501';
  end if;
  v_post_id := public.news_insertar_post(v_tenant, 'manual', p_draft_id, p_post, v_huella, v_actor);
  if p_draft_id is not null then
    update public.seo_drafts set status = 'published' where id = p_draft_id;
  end if;
  insert into public.news_publication_audit (
    tenant_id, draft_id, post_id, correlation_id, via, decision, content_sha256,
    filters, reasons, actor_id, notice_state)
  values (
    v_tenant, p_draft_id, v_post_id, extensions.gen_random_uuid(), 'manual', 'publicada',
    v_huella, coalesce(p_filtros, '{}'::jsonb), coalesce(p_motivos, '{}'), v_actor, 'pendiente')
  returning id into v_audit_id;
  return pg_catalog.jsonb_build_object('post_id', v_post_id, 'audit_id', v_audit_id, 'huella', v_huella);
end;
$fn$;

-- El resultado del aviso a Discord (F8 lee el de la última automática).
create function public.news_registrar_aviso(
  p_audit_id uuid, p_estado text, p_message_id text)
returns void
language sql
security definer
set search_path = ''
as $fn$
  update public.news_publication_audit
     set notice_state = p_estado, notice_message_id = p_message_id, notice_at = pg_catalog.now()
   where id = p_audit_id;
$fn$;

-- Sam (o un admin) confirma a mano que vio la publicación cuyo aviso no llegó.
create function public.news_aviso_confirmar_a_mano(p_audit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if not (select public.is_tenant_admin()) then
    raise exception 'SDD-0611: solo un admin confirma un aviso' using errcode = '42501';
  end if;
  update public.news_publication_audit
     set notice_state = 'confirmado_a_mano', notice_at = pg_catalog.now()
   where id = p_audit_id and tenant_id = (select public.get_user_tenant_id())
     and decision = 'publicada' and coalesce(notice_state, '') <> 'entregado';
  if not found then
    raise exception 'SDD-0611: no hay un aviso pendiente con ese id' using errcode = 'P0002';
  end if;
end;
$fn$;

-- Retiro con un clic y su porqué (§4.5). NO toca el interruptor (§4.6).
create function public.news_retirar(p_post_id uuid, p_motivo text, p_nota text)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_slug text;
begin
  if not (select public.is_tenant_admin()) then
    raise exception 'SDD-0611: solo un admin retira' using errcode = '42501';
  end if;
  if p_motivo is null or p_motivo not in ('dato_incorrecto', 'sin_fuente', 'linea_roja',
       'suena_a_ia', 'tono', 'no_es_el_publico', 'repetida', 'forma', 'otro') then
    raise exception 'SDD-0611: el motivo del retiro es obligatorio' using errcode = '22023';
  end if;
  if p_motivo = 'otro' and coalesce(pg_catalog.btrim(p_nota), '') = '' then
    raise exception 'SDD-0611: con «otro» la nota es obligatoria' using errcode = '22023';
  end if;
  perform pg_catalog.set_config('dtd.news_retiro_motivo', p_motivo, true);
  perform pg_catalog.set_config('dtd.news_retiro_nota', coalesce(p_nota, ''), true);
  update public.news_posts
     set published = false
   where id = p_post_id and tenant_id = (select public.get_user_tenant_id()) and published
  returning slug into v_slug;
  perform pg_catalog.set_config('dtd.news_retiro_motivo', '', true);
  perform pg_catalog.set_config('dtd.news_retiro_nota', '', true);
  if v_slug is null then
    raise exception 'SDD-0611: no hay una noticia publicada con ese id' using errcode = 'P0002';
  end if;
  return v_slug;
end;
$fn$;

-- Una persona vuelve a publicar una noticia retirada (§4.1). El CHECK de marcas
-- sigue mandando. Hace falta una función: la lectura de `news_posts` solo deja
-- ver las publicadas, y un UPDATE directo no encuentra la retirada.
create function public.news_volver_a_publicar(p_post_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_slug text;
begin
  if not (select public.is_tenant_admin()) then
    raise exception 'SDD-0611: solo un admin vuelve a publicar' using errcode = '42501';
  end if;
  update public.news_posts
     set published = true
   where id = p_post_id and tenant_id = (select public.get_user_tenant_id()) and not published
  returning slug into v_slug;
  if v_slug is null then
    raise exception 'SDD-0611: no hay una noticia retirada con ese id' using errcode = 'P0002';
  end if;
  return v_slug;
end;
$fn$;

-- Completa el motivo de una salida que llegó sin él.
create function public.news_salida_motivo(p_exit_id uuid, p_motivo text, p_nota text)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if not (select public.is_tenant_admin()) then
    raise exception 'SDD-0611: solo un admin completa el motivo' using errcode = '42501';
  end if;
  update public.news_post_exits
     set reason = p_motivo, note = nullif(p_nota, ''), reason_at = pg_catalog.now()
   where id = p_exit_id and tenant_id = (select public.get_user_tenant_id()) and reason is null;
  if not found then
    raise exception 'SDD-0611: no hay una salida con motivo pendiente con ese id' using errcode = 'P0002';
  end if;
end;
$fn$;

revoke all on function public.news_autopublish_configurar(boolean, integer, integer) from public, anon;
revoke all on function public.news_evaluacion_automatica(uuid, uuid, jsonb, jsonb, jsonb, text[]) from public, anon, authenticated;
revoke all on function public.news_publicar_manual(uuid, jsonb, jsonb, text[]) from public, anon;
revoke all on function public.news_registrar_aviso(uuid, text, text) from public, anon, authenticated;
revoke all on function public.news_aviso_confirmar_a_mano(uuid) from public, anon;
revoke all on function public.news_retirar(uuid, text, text) from public, anon;
revoke all on function public.news_salida_motivo(uuid, text, text) from public, anon;
revoke all on function public.news_volver_a_publicar(uuid) from public, anon;
revoke all on function public.news_posts_guarda_automatica() from public, anon, authenticated;

grant execute on function public.news_autopublish_configurar(boolean, integer, integer) to authenticated;
grant execute on function public.news_evaluacion_automatica(uuid, uuid, jsonb, jsonb, jsonb, text[]) to service_role;
grant execute on function public.news_publicar_manual(uuid, jsonb, jsonb, text[]) to authenticated;
grant execute on function public.news_registrar_aviso(uuid, text, text) to service_role;
grant execute on function public.news_aviso_confirmar_a_mano(uuid) to authenticated;
grant execute on function public.news_retirar(uuid, text, text) to authenticated;
grant execute on function public.news_salida_motivo(uuid, text, text) to authenticated;
grant execute on function public.news_volver_a_publicar(uuid) to authenticated;

-- ─── Postflight ──────────────────────────────────────────────────────────────
do $postflight$
begin
  if pg_catalog.has_function_privilege('authenticated',
       'public.news_evaluacion_automatica(uuid,uuid,jsonb,jsonb,jsonb,text[])', 'execute') then
    raise exception '0518: authenticated no puede llamar a la vía automática';
  end if;
  if exists (select 1 from public.news_autopublish_settings where enabled) then
    raise exception '0518: el interruptor tiene que nacer apagado';
  end if;
end
$postflight$;
