\set ON_ERROR_STOP on

-- SDD-0611 · contrato de la 0525 (ajustes de la publicación automática antes de encender).
--
-- Monta el mismo fixture que el contrato de la 0518 (roles, auth, tenants y las
-- migraciones REALES de noticias 0053, 0055, 0057, 0140 y 0518), emula los
-- privilegios por defecto de Supabase y aplica la 0525 REAL.
--
-- Lo que se protege:
--   C2  borrar en Auth a quien creó el borrador de una automática no aborta: el
--       borrador queda sin autor («Quedan sin autor», Sam, 2026-11-08);
--   11  news_salida_motivo exige un motivo de la lista y la nota con «otro»;
--   12  anon no ejecuta news_huella ni news_texto_tiene_marca;
--   13  editar el texto de una automática recalcula content_sha256, la noticia
--       sigue automática («Sí, sigue contando», Sam, 2026-11-08) y la guarda no cambia.
--
-- CONTROL ROJO: sin 0525 cae en la primera aserción.
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

-- Como en Supabase: los privilegios por defecto dan EXECUTE a anon, authenticated y
-- service_role sobre cada función nueva de public. Sin esto, el punto 12 no se probaría.
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

\ir ../migrations/0053_seo_drafts.sql
\ir ../migrations/0055_news_posts.sql
\ir ../migrations/0057_seo_drafts_brief_fields.sql
\ir ../migrations/0140_news_categorias_negocio.sql

-- Como en Supabase: service_role tiene los privilegios de tabla (y salta RLS).
-- Sin esto, la guarda de origen frente a service_role no se probaría.
grant all on public.news_posts, public.seo_drafts to service_role;
\ir ../migrations/0518_noticias_publicacion_automatica.sql
\ir ../migrations/0525_noticias_ajustes_antes_de_encender.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0525: %', p_label; end if;
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
  sam constant uuid := '20000000-0000-4000-8000-000000000001';
  alejandro constant uuid := '20000000-0000-4000-8000-000000000004';
  d1 constant uuid := '30000000-0000-4000-8000-000000000001';
  r jsonb;
  v_post uuid;
  v_manual uuid;
  v_exit uuid;
  v_antes text;
  v_despues text;
begin
  -- ── Punto 12 · anon sin EXECUTE sobre la marca y la huella ──
  perform pg_temp.assert_true(not has_function_privilege('anon', 'public.news_huella(jsonb)', 'execute'),
    '12: anon no ejecuta news_huella');
  perform pg_temp.assert_true(not has_function_privilege('anon', 'public.news_texto_tiene_marca(text)', 'execute'),
    '12: anon no ejecuta news_texto_tiene_marca');
  perform pg_temp.assert_true(
    has_function_privilege('authenticated', 'public.news_huella(jsonb)', 'execute')
    and has_function_privilege('service_role', 'public.news_huella(jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.news_texto_tiene_marca(text)', 'execute')
    and has_function_privilege('service_role', 'public.news_texto_tiene_marca(text)', 'execute'),
    '12: authenticated y service_role siguen ejecutando la marca y la huella');

  -- Una automática publicada.
  perform pg_temp.como('authenticated', sam, 'select public.news_autopublish_configurar(true, 1, 2)');
  perform pg_temp.borrador(d1, t1, pg_temp.post('d1'));
  r := pg_temp.auto(t1, d1, pg_temp.post('d1'));
  perform pg_temp.assert_true(r ->> 'decision' = 'publicada', 'la automática de base se publica');
  v_post := (select id from public.news_posts where seo_draft_id = d1);
  v_antes := (select content_sha256 from public.news_posts where id = v_post);
  perform pg_temp.assert_true(v_antes = (select public.news_huella(to_jsonb(p)) from public.news_posts p where p.id = v_post),
    '13: la huella de la fila es la de news_huella(to_jsonb(fila)), la misma que firma el Revisor');

  -- ── Punto 13 · una persona edita la automática ──
  perform pg_temp.como('authenticated', sam,
    format('update public.news_posts set body_markdown = %L where id = %L', 'Cuerpo corregido a mano.', v_post));
  v_despues := (select content_sha256 from public.news_posts where id = v_post);
  perform pg_temp.assert_true(v_despues is distinct from v_antes
    and v_despues = (select public.news_huella(to_jsonb(p)) from public.news_posts p where p.id = v_post),
    '13: editar el cuerpo recalcula content_sha256');
  perform pg_temp.assert_true((select publish_via from public.news_posts where id = v_post) = 'automatica',
    '13: la editada sigue siendo automática (cuenta en F7)');
  perform pg_temp.assert_true((select content_sha256 from public.news_publication_audit
    where post_id = v_post and decision = 'publicada') = v_antes,
    '13: la auditoría conserva la huella que revisó el Revisor');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', sam,
    format('update public.news_posts set content_sha256 = %L where id = %L', repeat('0', 64), v_post)) = '42501',
    '13: la guarda sigue rechazando que una sesión cambie la huella a mano');
  perform pg_temp.como('authenticated', sam,
    format('update public.news_posts set slug = slug where id = %L', v_post));
  perform pg_temp.assert_true((select content_sha256 from public.news_posts where id = v_post) = v_despues,
    '13: un cambio fuera del texto de la huella no la toca');

  -- Una manual: no lleva huella y editarla no le pone una.
  perform pg_temp.como('authenticated', sam, format(
    'insert into public.news_posts (tenant_id, slug, tipo, categoria, title, excerpt, body_markdown) values (%L, %L, %L, %L, %L, %L, %L)',
    t1, 'manual-1', 'informativo', 'importa-sin-perder-plata', 'Importa · Titular manual', 'Extracto.', 'Cuerpo.'));
  v_manual := (select id from public.news_posts where slug = 'manual-1');
  perform pg_temp.como('authenticated', sam,
    format('update public.news_posts set body_markdown = %L where id = %L', 'Cuerpo editado.', v_manual));
  perform pg_temp.assert_true((select content_sha256 is null from public.news_posts where id = v_manual),
    '13: una manual editada sigue sin huella');

  -- ── C2 · borrar en Auth a quien creó el borrador de una automática ──
  update public.seo_drafts set created_by = alejandro where id = d1;
  perform pg_temp.assert_true(pg_temp.falla('postgres', null,
    format('delete from auth.users where id = %L', alejandro)) is null,
    'C2: se puede borrar en Auth a quien creó el borrador de una automática publicada');
  perform pg_temp.assert_true((select created_by is null from public.seo_drafts where id = d1),
    'C2: el borrador queda sin autor («Quedan sin autor»)');
  perform pg_temp.assert_true(exists (select 1 from public.news_posts where id = v_post and published and seo_draft_id = d1),
    'C2: la noticia sigue publicada y atada a su borrador');

  -- ── Punto 11 · completar el motivo de una salida exige un motivo válido ──
  perform pg_temp.como('service_role', null,
    format('update public.news_posts set published = false where id = %L', v_post));
  v_exit := (select id from public.news_post_exits where post_id = v_post and kind = 'despublicada');
  perform pg_temp.assert_true((select reason is null from public.news_post_exits where id = v_exit),
    '11: la salida por otra vía queda con el motivo pendiente');
  perform pg_temp.assert_true((select content_sha256 from public.news_post_exits where id = v_exit) = v_despues,
    '13: la salida registra la huella del texto que estaba publicado');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', sam,
    format('select public.news_salida_motivo(%L, null, null)', v_exit)) = '22023',
    '11: un motivo nulo se rechaza');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', sam,
    format('select public.news_salida_motivo(%L, %L, null)', v_exit, 'inventado')) = '22023',
    '11: un motivo fuera de la lista se rechaza');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', sam,
    format('select public.news_salida_motivo(%L, %L, %L)', v_exit, 'otro', '   ')) = '22023',
    '11: «otro» sin nota se rechaza');
  perform pg_temp.assert_true((select reason is null from public.news_post_exits where id = v_exit),
    '11: los rechazos no tocan la salida');
  perform pg_temp.como('authenticated', sam,
    format('select public.news_salida_motivo(%L, %L, %L)', v_exit, 'repetida', '  ya estaba  '));
  perform pg_temp.assert_true((select reason = 'repetida' and note = 'ya estaba' and reason_at is not null
    from public.news_post_exits where id = v_exit), '11: un motivo válido se guarda, con la nota recortada');
end;
$contrato$;

select 'TEST 0525 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;

rollback;
