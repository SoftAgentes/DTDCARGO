\set ON_ERROR_STOP on

-- SDD-0611 · contrato de la 0518 (publicación automática de noticias).
--
-- Monta lo mínimo que la 0518 da por sentado: roles, auth.uid() leyendo el JWT,
-- tenants, user_tenants, get_user_tenant_id() (copia de 0453), is_tenant_admin()
-- (copia de 0386) y extensions.gen_random_uuid(). Aplica las migraciones REALES
-- de noticias (0053, 0055, 0057 y 0140) y la 0518 REAL.
--
-- Lo que se protege, en la base y para cualquier ruta:
--   F1  con el interruptor apagado no se publica nada;
--   F3  el veredicto vale solo para su huella y su borrador;
--   F7  tope por día (límite duro de 1) y por semana, solo automáticas;
--   F9  sin auditoría completa no se publica;
--   F10 un borrador se publica una sola vez y el slug no choca;
--   criterio 3: nada con [VERIFICAR queda publicado;
--   la guarda de origen, el retiro con motivo y el registro de toda salida.
--
-- CONTROL ROJO: sin 0518 cae en la primera aserción.
-- PGlite tiene una sola conexión: la carrera de dos corridas no se prueba aquí
-- (ver el handoff). Sí que dos corridas seguidas publican una vez.
--
-- Termina siempre en ROLLBACK. Solo ids y textos sintéticos.
begin;

do $roles$
begin
  if to_regclass('public.news_posts') is not null then
    raise exception 'Fixture 0518 rechazada: el objeto real ya existe';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

create schema if not exists extensions;
create or replace function extensions.gen_random_uuid() returns uuid
language sql volatile as $$ select gen_random_uuid() $$;
grant usage on schema extensions to anon, authenticated, service_role;
grant execute on function extensions.gen_random_uuid() to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table auth.users (id uuid primary key);

create table public.tenants (id uuid primary key, slug text);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
grant select on public.user_tenants to authenticated;

-- Copia de 0453.
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1]
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid())
    and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
grant execute on function public.get_user_tenant_id() to authenticated;

-- Copia de 0386.
create function public.is_tenant_admin() returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce(exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = (select public.get_user_tenant_id())
      and ut.role = 'admin'
      and ut.disabled_at is null
  ), false);
$fn$;
grant execute on function public.is_tenant_admin() to authenticated;

insert into public.tenants values
  ('10000000-0000-4000-8000-000000000001', 'dtd'),
  ('10000000-0000-4000-8000-000000000002', 'otro');
insert into auth.users values
  ('20000000-0000-4000-8000-000000000001'),  -- admin de T1 (Sam)
  ('20000000-0000-4000-8000-000000000002'),  -- admin de T2
  ('20000000-0000-4000-8000-000000000003'),  -- commercial de T1
  ('20000000-0000-4000-8000-000000000004');  -- segundo admin de T1 (Alejandro)
insert into public.user_tenants values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'admin', null),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'admin', null),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'commercial', null),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'admin', null);

\ir ../migrations/0053_seo_drafts.sql
\ir ../migrations/0055_news_posts.sql
\ir ../migrations/0057_seo_drafts_brief_fields.sql
\ir ../migrations/0140_news_categorias_negocio.sql

-- Como en Supabase: service_role tiene los privilegios de tabla (y salta RLS).
-- Sin esto, la guarda de origen frente a service_role no se probaría.
grant all on public.news_posts, public.seo_drafts to service_role;
\ir ../migrations/0518_noticias_publicacion_automatica.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0518: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Ejecuta con un rol (y el JWT del usuario si es authenticated).
create function pg_temp.como(p_rol text, p_user uuid, p_sql text) returns integer language plpgsql as $$
declare v_rows integer;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  execute format('set local role %I', p_rol);
  execute p_sql;
  get diagnostics v_rows = row_count;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v_rows;
exception when others then
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  raise;
end;
$$;

-- ¿Falla la sentencia? Devuelve el SQLSTATE o null si pasó.
create function pg_temp.falla(p_rol text, p_user uuid, p_sql text) returns text language plpgsql as $$
begin
  perform pg_temp.como(p_rol, p_user, p_sql);
  return null;
exception when others then
  return sqlstate;
end;
$$;

-- Un post válido (cumple los CHECK de news_posts) con slug propio.
create function pg_temp.post(p_slug text, p_cuerpo text default 'Cuerpo sintético de la noticia.') returns jsonb
language sql as $$
  select jsonb_build_object(
    'slug', p_slug, 'tipo', 'informativo', 'categoria', 'importa-sin-perder-plata',
    'title', 'Importa · Titular sintético ' || p_slug, 'excerpt', 'Extracto sintético.',
    'body_markdown', p_cuerpo, 'focus_keyword', 'importador',
    'secondary_keywords', '[]'::jsonb, 'meta_description', 'Extracto sintético.',
    'pain_points', '[]'::jsonb, 'read_time_min', 5,
    'author_name', 'Escritor invitado', 'author_role', 'Colaborador');
$$;

-- Un borrador en revisión, con su veredicto atado a la huella del post.
-- plpgsql y no sql: el cuerpo se valida al llamarla, así el CONTROL ROJO (sin
-- 0518) cae en la primera aserción y no al crear el ayudante.
create function pg_temp.borrador(p_id uuid, p_tenant uuid, p_post jsonb) returns uuid language plpgsql as $$
begin
  insert into public.seo_drafts (id, tenant_id, topic, tone, tipo, categoria, article_markdown,
                                 status, created_by, reviewer_verdict, review_entered_at)
  values (p_id, p_tenant, 'Tema sintético', 'informativo', 'informativo', 'importa-sin-perder-plata',
          p_post ->> 'body_markdown', 'en_revision', '20000000-0000-4000-8000-000000000001',
          jsonb_build_object('veredicto', 'aprobado', 'agente', 'revisor', 'modelo', 'modelo-x',
                             'version', '1', 'draft_id', p_id::text,
                             'huella', public.news_huella(p_post)),
          now());
  return p_id;
end;
$$;

-- La auditoría que manda el Studio: agente, modelo y versión de cada lado.
create function pg_temp.auditoria(p_post jsonb) returns jsonb language plpgsql as $$
begin
  return jsonb_build_object(
    'content_sha256', public.news_huella(p_post),
    'writer', jsonb_build_object('agente', 'redactor', 'modelo', 'modelo-x', 'version', '1'),
    'reviewer', jsonb_build_object('agente', 'revisor', 'modelo', 'modelo-x', 'version', '1'),
    'prompts_version', 'prompts-v1', 'control_version', '0611-control-v1');
end;
$$;

-- La vía automática como la llama el Studio (service_role).
create function pg_temp.auto(p_tenant uuid, p_draft uuid, p_post jsonb,
                             p_motivos text[] default '{}', p_audit jsonb default null)
returns jsonb language plpgsql as $$
declare v jsonb;
begin
  set local role service_role;
  v := public.news_evaluacion_automatica(p_tenant, p_draft, p_post,
         coalesce(p_audit, pg_temp.auditoria(p_post)), '{}'::jsonb, p_motivos);
  reset role;
  return v;
exception when others then
  reset role;
  raise;
end;
$$;

do $contrato$
declare
  t1 constant uuid := '10000000-0000-4000-8000-000000000001';
  t2 constant uuid := '10000000-0000-4000-8000-000000000002';
  sam constant uuid := '20000000-0000-4000-8000-000000000001';
  admin2 constant uuid := '20000000-0000-4000-8000-000000000002';
  comercial constant uuid := '20000000-0000-4000-8000-000000000003';
  alejandro constant uuid := '20000000-0000-4000-8000-000000000004';
  d1 constant uuid := '30000000-0000-4000-8000-000000000001';
  d2 constant uuid := '30000000-0000-4000-8000-000000000002';
  d3 constant uuid := '30000000-0000-4000-8000-000000000003';
  d4 constant uuid := '30000000-0000-4000-8000-000000000004';
  d5 constant uuid := '30000000-0000-4000-8000-000000000005';
  d6 constant uuid := '30000000-0000-4000-8000-000000000006';
  d7 constant uuid := '30000000-0000-4000-8000-000000000007';
  d8 constant uuid := '30000000-0000-4000-8000-000000000008';
  r jsonb;
  v_post uuid;
  v_n integer;
begin
  -- ── Estructura ──
  perform pg_temp.assert_true(to_regclass('public.news_publication_audit') is not null,
    'existe la auditoría de publicaciones');
  perform pg_temp.assert_true(not exists (select 1 from public.news_autopublish_settings where enabled),
    'el interruptor nace apagado');
  perform pg_temp.assert_true(not has_function_privilege('authenticated',
    'public.news_evaluacion_automatica(uuid,uuid,jsonb,jsonb,jsonb,text[])', 'execute'),
    'una sesión de la API no llama a la vía automática');
  perform pg_temp.assert_true(not has_function_privilege('anon',
    'public.news_retirar(uuid,text,text)', 'execute'), 'anon no retira');

  -- ── F1 · sin interruptor no se publica ──
  perform pg_temp.borrador(d1, t1, pg_temp.post('d1'));
  r := pg_temp.auto(t1, d1, pg_temp.post('d1'));
  perform pg_temp.assert_true(r ->> 'decision' = 'retenida' and r -> 'motivos' ? 'interruptor_apagado',
    'F1: sin interruptor queda retenida');
  perform pg_temp.assert_true(not exists (select 1 from public.news_posts),
    'F1: con el interruptor apagado no se publica nada');
  perform pg_temp.assert_true((select status from public.seo_drafts where id = d1) = 'retenido'
    and (select held_reasons from public.seo_drafts where id = d1) @> array['interruptor_apagado'],
    'F1: el borrador queda retenido con su motivo');

  -- ── Interruptor: solo un admin, con límite duro ──
  perform pg_temp.assert_true(pg_temp.falla('authenticated', comercial,
    'select public.news_autopublish_configurar(true, 1, 2)') = '42501',
    'quien no es admin no enciende el interruptor');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', sam,
    'select public.news_autopublish_configurar(true, 2, 7)') = '23514',
    'una configuración de 2 por día se rechaza');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', sam,
    'select public.news_autopublish_configurar(true, 1, 8)') = '23514',
    'más de 7 por semana se rechaza');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', sam,
    'update public.news_autopublish_settings set enabled = true') = '42501',
    'el interruptor no se cambia por la tabla');
  perform pg_temp.como('authenticated', sam, 'select public.news_autopublish_configurar(true, 1, 2)');
  perform pg_temp.assert_true((select enabled from public.news_autopublish_settings where tenant_id = t1),
    'un admin enciende el interruptor');
  perform pg_temp.assert_true((select count(*) from public.news_autopublish_settings_log
    where tenant_id = t1 and changed_by = sam) = 1, 'el cambio queda registrado con quién');

  -- ── Publica: todo en verde ──
  perform pg_temp.borrador(d2, t1, pg_temp.post('d2'));
  r := pg_temp.auto(t1, d2, pg_temp.post('d2'));
  perform pg_temp.assert_true(r ->> 'decision' = 'publicada', 'con todo en verde se publica');
  v_post := (r ->> 'post_id')::uuid;
  perform pg_temp.assert_true((select publish_via = 'automatica' and published
      and author_name = 'DTD Cargo' and author_role is null and seo_draft_id = d2
      and content_sha256 = public.news_huella(pg_temp.post('d2'))
    from public.news_posts where id = v_post),
    'la noticia automática firma DTD Cargo, sin escritor invitado, con su huella');
  perform pg_temp.assert_true((select status from public.seo_drafts where id = d2) = 'published',
    'el borrador pasa a publicado');
  perform pg_temp.assert_true((select decision = 'publicada' and via = 'automatica' and post_id = v_post
      and writer ->> 'modelo' = 'modelo-x' and reviewer ->> 'agente' = 'revisor'
      and prompts_version = 'prompts-v1' and control_version = '0611-control-v1'
      and switch_enabled and notice_state = 'pendiente'
    from public.news_publication_audit where draft_id = d2),
    'F9: la auditoría trae modelo, agente y versión de cada lado y el interruptor');

  -- ── Doble ejecución sobre el mismo borrador ──
  r := pg_temp.auto(t1, d2, pg_temp.post('d2'));
  perform pg_temp.assert_true(r ->> 'decision' = 'ignorada'
    and (select count(*) from public.news_posts where seo_draft_id = d2) = 1,
    'dos corridas sobre el mismo borrador publican una sola vez');

  -- ── F7 · segundo automático del día ──
  perform pg_temp.borrador(d3, t1, pg_temp.post('d3'));
  r := pg_temp.auto(t1, d3, pg_temp.post('d3'));
  perform pg_temp.assert_true(r ->> 'decision' = 'retenida' and r -> 'motivos' ? 'tope_dia',
    'F7: dos borradores distintos el mismo día publican uno solo');

  -- Una manual el mismo día no ocupa cupo (en T2, sin automáticas hoy).
  perform pg_temp.como('authenticated', admin2, 'select public.news_autopublish_configurar(true, 1, 2)');
  perform pg_temp.como('authenticated', admin2,
    format('select public.news_publicar_manual(null, %L::jsonb, null, null)', pg_temp.post('m1')));
  perform pg_temp.borrador(d4, t2, pg_temp.post('d4'));
  r := pg_temp.auto(t2, d4, pg_temp.post('d4'));
  perform pg_temp.assert_true(r ->> 'decision' = 'publicada',
    'F7: una publicada a mano el mismo día no frena a la automática');

  -- La de T1 de hoy se corre a hace 8 días: ya no cuenta, y pasa la siguiente.
  update public.news_posts set created_at = now() - interval '8 days' where id = v_post;
  update public.seo_drafts set status = 'en_revision', held_reasons = '{}' where id = d3;
  r := pg_temp.auto(t1, d3, pg_temp.post('d3'));
  perform pg_temp.assert_true(r ->> 'decision' = 'publicada',
    'F7: la de la semana pasada no cuenta para hoy ni para esta semana');

  -- Tope semanal: con 0 por semana no pasa ninguna, aunque el día esté libre.
  update public.news_posts set created_at = now() - interval '8 days' where seo_draft_id = d3;
  perform pg_temp.como('authenticated', sam, 'select public.news_autopublish_configurar(true, 1, 0)');
  perform pg_temp.borrador(d5, t1, pg_temp.post('d5'));
  r := pg_temp.auto(t1, d5, pg_temp.post('d5'));
  perform pg_temp.assert_true(r ->> 'decision' = 'retenida' and r -> 'motivos' ? 'tope_semana'
    and not (r -> 'motivos' ? 'tope_dia'), 'F7: el tope por semana retiene');
  perform pg_temp.como('authenticated', sam, 'select public.news_autopublish_configurar(true, 1, 2)');

  -- ── F3 · huella y veredicto ──
  update public.seo_drafts set status = 'en_revision', held_reasons = '{}' where id = d5;
  r := pg_temp.auto(t1, d5, pg_temp.post('d5', 'Cuerpo sintético de la noticia,'));
  perform pg_temp.assert_true(r ->> 'decision' = 'retenida' and r -> 'motivos' ? 'revision_vencida',
    'F3: una coma cambiada después del veredicto lo vence');
  perform pg_temp.borrador(d6, t1, pg_temp.post('d6'));
  update public.seo_drafts set reviewer_verdict = reviewer_verdict || jsonb_build_object('draft_id', d1::text)
   where id = d6;
  r := pg_temp.auto(t1, d6, pg_temp.post('d6'));
  perform pg_temp.assert_true(r ->> 'decision' = 'retenida' and r -> 'motivos' ? 'revision_vencida',
    'F3: un veredicto de otro borrador no vale');
  update public.seo_drafts set status = 'en_revision', reviewer_verdict = null where id = d6;
  r := pg_temp.auto(t1, d6, pg_temp.post('d6'));
  perform pg_temp.assert_true(r ->> 'decision' = 'retenida' and r -> 'motivos' ? 'sin_revisor',
    'F3: sin veredicto queda sin_revisor');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null,
    format('select public.news_evaluacion_automatica(%L, %L, %L::jsonb, %L::jsonb, null, null)',
      t2, d6, pg_temp.post('d6'), pg_temp.auditoria(pg_temp.post('d6')))) = 'P0002',
    'un borrador de otro tenant no se evalúa');

  -- ── Motivos del código y F10 ──
  perform pg_temp.borrador(d7, t1, pg_temp.post('d7'));
  r := pg_temp.auto(t1, d7, pg_temp.post('d7'), array['linea_roja:precio', 'puntaje:largo']);
  perform pg_temp.assert_true(r ->> 'decision' = 'retenida'
    and (select held_reasons from public.seo_drafts where id = d7) = array['linea_roja:precio', 'puntaje:largo'],
    'los filtros del código que fallaron retienen con sus códigos');
  update public.seo_drafts set status = 'en_revision', held_reasons = '{}' where id = d7;
  r := pg_temp.auto(t1, d7, pg_temp.post('d2'));
  perform pg_temp.assert_true(r ->> 'decision' = 'retenida' and r -> 'motivos' ? 'duplicado',
    'F10: un slug que ya existe no se publica');

  -- ── F9 · auditoría incompleta: nada publicado ──
  perform pg_temp.borrador(d8, t1, pg_temp.post('d8'));
  update public.news_posts set created_at = now() - interval '8 days' where publish_via = 'automatica';
  v_n := (select count(*) from public.news_posts);
  perform pg_temp.assert_true(pg_temp.falla('service_role', null,
    format('select public.news_evaluacion_automatica(%L, %L, %L::jsonb, %L::jsonb, null, null)',
      t1, d8, pg_temp.post('d8'),
      pg_temp.auditoria(pg_temp.post('d8')) || jsonb_build_object('writer',
        jsonb_build_object('agente', 'redactor', 'modelo', '', 'version', '1')))) = '23514',
    'F9: sin modelo del Redactor la auditoría se rechaza');
  perform pg_temp.assert_true((select count(*) from public.news_posts) = v_n
    and (select status from public.seo_drafts where id = d8) = 'en_revision',
    'F9: si la auditoría no se escribe, no se publica');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null,
    format('select public.news_evaluacion_automatica(%L, %L, %L::jsonb, %L::jsonb, null, null)',
      t1, d8, pg_temp.post('d8'),
      pg_temp.auditoria(pg_temp.post('d8')) || jsonb_build_object('writer',
        jsonb_build_object('agente', 'redactor', 'modelo', 'm', 'version', '1', 'prompt', 'texto')))) = '23514',
    'la auditoría no guarda prompts');

  -- ── Criterio 3 · nada con [VERIFICAR queda publicado ──
  r := pg_temp.auto(t1, d8, pg_temp.post('d8', 'Cuerpo con [verificar: dato] pendiente.'));
  perform pg_temp.assert_true(r ->> 'decision' = 'retenida' and r -> 'motivos' ? 'marca_pendiente',
    'la vía automática retiene un texto con marca aunque el código no la vea');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', sam,
    $q$insert into public.news_posts (tenant_id, slug, tipo, categoria, title, excerpt, body_markdown)
       values ('10000000-0000-4000-8000-000000000001', 'manual-con-marca', 'informativo',
               'importa-sin-perder-plata', 'Importa · T', 'E', 'Dato [VERIFICAR] pendiente')$q$) = '23514',
    'la vía manual directa no publica una marca vacía');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', sam,
    $q$insert into public.news_posts (tenant_id, slug, tipo, categoria, title, excerpt, body_markdown)
       values ('10000000-0000-4000-8000-000000000001', 'manual-con-marca', 'informativo',
               'importa-sin-perder-plata', 'Importa · T', 'E', '[x](https://dtdcargo.com/%5BVERIFICAR%5D)')$q$) = '23514',
    'tampoco una marca escondida en un enlace');
  perform pg_temp.como('authenticated', sam,
    $q$insert into public.news_posts (tenant_id, slug, tipo, categoria, title, excerpt, body_markdown, published)
       values ('10000000-0000-4000-8000-000000000001', 'borrador-con-marca', 'informativo',
               'importa-sin-perder-plata', 'Importa · T', 'E', 'Dato [VERIFICAR] pendiente', false)$q$);
  perform pg_temp.assert_true(pg_temp.falla('authenticated', sam,
    format('select public.news_volver_a_publicar(%L)',
      (select id from public.news_posts where slug = 'borrador-con-marca'))) = '23514',
    'una noticia con marca no se vuelve a publicar');

  -- ── Guarda de origen ──
  perform pg_temp.assert_true(pg_temp.falla('authenticated', sam,
    $q$insert into public.news_posts (tenant_id, slug, tipo, categoria, title, excerpt, body_markdown,
                                      publish_via, seo_draft_id, content_sha256)
       values ('10000000-0000-4000-8000-000000000001', 'falsa-auto', 'informativo',
               'importa-sin-perder-plata', 'Importa · T', 'E', 'Cuerpo',
               'automatica', '30000000-0000-4000-8000-000000000008', repeat('a', 64))$q$) = '42501',
    'un admin no escribe una automática por la tabla');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null,
    $q$insert into public.news_posts (tenant_id, slug, tipo, categoria, title, excerpt, body_markdown,
                                      publish_via, seo_draft_id, content_sha256)
       values ('10000000-0000-4000-8000-000000000001', 'falsa-auto', 'informativo',
               'importa-sin-perder-plata', 'Importa · T', 'E', 'Cuerpo',
               'automatica', '30000000-0000-4000-8000-000000000008', repeat('a', 64))$q$) = '42501',
    'la llave service_role tampoco escribe una automática por la tabla');
  perform pg_temp.como('authenticated', sam,
    $q$insert into public.news_posts (tenant_id, slug, tipo, categoria, title, excerpt, body_markdown)
       values ('10000000-0000-4000-8000-000000000001', 'manual-t1', 'informativo',
               'importa-sin-perder-plata', 'Importa · T', 'E', 'Cuerpo limpio')$q$);
  perform pg_temp.assert_true(pg_temp.falla('authenticated', sam,
    $q$update public.news_posts set publish_via = 'automatica' where slug = 'manual-t1'$q$) = '42501',
    'el origen de una noticia no se cambia a mano');

  -- ── Retiro con un clic y su porqué ──
  v_post := (select id from public.news_posts where seo_draft_id = d3);
  perform pg_temp.assert_true(pg_temp.falla('authenticated', comercial,
    format('select public.news_retirar(%L, %L, null)', v_post, 'tono')) = '42501',
    'una cuenta sin permiso no retira');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', alejandro,
    format('select public.news_retirar(%L, null, null)', v_post)) = '22023',
    'sin motivo no se retira');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', alejandro,
    format('select public.news_retirar(%L, %L, %L)', v_post, 'otro', ' ')) = '22023',
    'con «otro» la nota es obligatoria');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', admin2,
    format('select public.news_retirar(%L, %L, null)', v_post, 'tono')) = 'P0002',
    'un admin de otro tenant no retira una noticia ajena');
  perform pg_temp.como('authenticated', alejandro,
    format('select public.news_retirar(%L, %L, %L)', v_post, 'dato_incorrecto', 'La cifra está mal'));
  perform pg_temp.assert_true(not (select published from public.news_posts where id = v_post),
    'Alejandro, con su cuenta, retira: la noticia sale del sitio');
  perform pg_temp.assert_true((select kind = 'retiro' and reason = 'dato_incorrecto'
      and note = 'La cifra está mal' and actor_id = alejandro and publish_via = 'automatica'
    from public.news_post_exits where post_id = v_post),
    'el retiro queda registrado con motivo, nota y quién');
  perform pg_temp.assert_true((select enabled from public.news_autopublish_settings where tenant_id = t1),
    'retirar una noticia automática no apaga el interruptor');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', comercial,
    format('select public.news_volver_a_publicar(%L)', v_post)) = '42501',
    'quien no es admin no vuelve a publicar');
  perform pg_temp.como('authenticated', sam, format('select public.news_volver_a_publicar(%L)', v_post));
  perform pg_temp.assert_true((select published from public.news_posts where id = v_post),
    'una persona vuelve a publicar una retirada');
  perform pg_temp.como('authenticated', sam,
    format('select public.news_retirar(%L, %L, null)', v_post, 'forma'));

  -- ── Otra salida sin motivo: queda pendiente ──
  -- Por la API un admin no puede: la policy pública de lectura (published = true)
  -- también se aplica a la fila nueva del UPDATE. Lo prueba la primera aserción.
  -- La otra vía real es una llave de servidor o una sesión SQL.
  v_post := (select id from public.news_posts where seo_draft_id = d2);
  perform pg_temp.assert_true(pg_temp.falla('authenticated', sam,
    format('update public.news_posts set published = false where id = %L', v_post)) = '42501',
    'por la API, un admin no despublica con un UPDATE directo');
  perform pg_temp.como('service_role', null,
    format('update public.news_posts set published = false where id = %L', v_post));
  perform pg_temp.assert_true((select kind = 'despublicada' and reason is null
    from public.news_post_exits where post_id = v_post),
    'despublicar por otra vía deja «motivo pendiente»');
  perform pg_temp.como('authenticated', sam,
    format('select public.news_salida_motivo(%L, %L, null)',
      (select id from public.news_post_exits where post_id = v_post), 'repetida'));
  perform pg_temp.assert_true((select reason = 'repetida' and reason_at is not null
    from public.news_post_exits where post_id = v_post), 'el motivo pendiente se completa después');

  -- ── Borrar ──
  perform pg_temp.assert_true(pg_temp.falla('authenticated', admin2,
    format('delete from public.news_posts where seo_draft_id = %L', d4)) = '42501',
    'borrar una noticia publicada sola se rechaza');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null,
    format('delete from public.news_posts where id = %L', v_post)) = '42501',
    'ni con la llave de servidor se borra una automática retirada');
  perform pg_temp.assert_true(exists (select 1 from public.news_posts where id = v_post),
    'la noticia automática sigue en la tabla');
  perform pg_temp.como('authenticated', admin2, $q$delete from public.news_posts where slug = 'm1'$q$);
  perform pg_temp.assert_true((select kind = 'borrada' and reason is null and title like 'Importa · Titular%'
      and content_sha256 ~ '^[0-9a-f]{64}$'
    from public.news_post_exits where slug = 'm1'),
    'borrar una manual deja registro con titular y huella');

  -- ── Salida manual de IA-01 ──
  perform pg_temp.assert_true(pg_temp.falla('authenticated', comercial,
    format('select public.news_publicar_manual(%L, %L::jsonb, null, null)', d5, pg_temp.post('d5'))) = '42501',
    'quien no es admin no publica un retenido');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', admin2,
    format('select public.news_publicar_manual(%L, %L::jsonb, null, null)', d5, pg_temp.post('d5'))) = '42501',
    'un admin de otro tenant no publica un borrador ajeno');
  perform pg_temp.como('authenticated', sam,
    format('select public.news_publicar_manual(%L, %L::jsonb, %L::jsonb, %L)',
      d5, pg_temp.post('d5'), '{"F7":{"pasa":false,"codigos":["tope_semana"]}}', '{tope_semana}'));
  perform pg_temp.assert_true((select publish_via = 'manual' and author_name = 'Escritor invitado'
    from public.news_posts where seo_draft_id = d5), 'una persona admin publica a mano un retenido');
  perform pg_temp.assert_true((select actor_id = sam and via = 'manual' and reasons = array['tope_semana']
    from public.news_publication_audit where draft_id = d5 and decision = 'publicada'),
    'y queda su nombre en la auditoría, con lo que había fallado');

  -- ── Aviso (F8 lo lee) ──
  perform pg_temp.assert_true(pg_temp.falla('authenticated', sam,
    format('select public.news_registrar_aviso(%L, %L, null)',
      (select id from public.news_publication_audit where draft_id = d2), 'entregado')) = '42501',
    'una sesión de la API no marca un aviso como entregado');
  perform pg_temp.como('service_role', null,
    format('select public.news_registrar_aviso(%L, %L, null)',
      (select id from public.news_publication_audit where draft_id = d2), 'incierto'));
  perform pg_temp.assert_true(pg_temp.falla('service_role', null,
    format('select public.news_registrar_aviso(%L, %L, null)',
      (select id from public.news_publication_audit where draft_id = d2), 'inventado')) = '23514',
    'el estado del aviso es uno de la lista');
  perform pg_temp.como('authenticated', sam,
    format('select public.news_aviso_confirmar_a_mano(%L)',
      (select id from public.news_publication_audit where draft_id = d2)));
  perform pg_temp.assert_true((select notice_state from public.news_publication_audit where draft_id = d2)
    = 'confirmado_a_mano', 'Sam confirma a mano un aviso incierto');

  -- ── Lectura por tenant ──
  perform set_config('request.jwt.claim.sub', admin2::text, true);
  set local role authenticated;
  v_n := (select count(*) from public.news_publication_audit where tenant_id = t1)
       + (select count(*) from public.news_post_exits where tenant_id = t1)
       + (select count(*) from public.news_autopublish_settings where tenant_id = t1);
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.assert_true(v_n = 0, 'un admin de otro tenant no ve la auditoría ni las salidas ajenas');
  perform set_config('request.jwt.claim.sub', comercial::text, true);
  set local role authenticated;
  v_n := (select count(*) from public.news_publication_audit);
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.assert_true(v_n = 0, 'quien no es admin no ve la auditoría');
end;
$contrato$;

select 'TEST 0518 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;

rollback;
