\set ON_ERROR_STOP on

-- SDD-0611 (N1) · contrato de la 0526: anon lee solo las columnas públicas de news_posts.
--
-- Monta el mismo fixture que los contratos de la 0518 y la 0525 (roles, auth,
-- tenants y las migraciones REALES de noticias 0053, 0055, 0057, 0140, 0518 y
-- 0525) y aplica la 0526 REAL.
--
-- Lo que se protege:
--   N1  anon no lee, ni usa en un filtro, created_by ni publish_via (ni
--       seo_draft_id, content_sha256, tenant_id o source), y no puede pedir `*`;
--   L   las lecturas de lib/public/news-queries.ts siguen funcionando con anon,
--       y la RLS sigue escondiendo lo no publicado;
--   S   authenticated y service_role (el Studio) siguen leyendo esas columnas.
--
-- CONTROL ROJO: sin 0526 cae en la primera aserción.
-- Termina siempre en ROLLBACK. Solo ids y textos sintéticos.
begin;

do $roles$
begin
  if to_regclass('public.news_posts') is not null then
    raise exception 'Fixture 0526 rechazada: el objeto real ya existe';
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
-- service_role sobre cada función nueva de public (las 0518 y 0525 lo esperan así).
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

\ir ../migrations/0053_seo_drafts.sql
\ir ../migrations/0055_news_posts.sql
\ir ../migrations/0057_seo_drafts_brief_fields.sql
\ir ../migrations/0140_news_categorias_negocio.sql

-- Como en Supabase: service_role tiene los privilegios de tabla (y salta RLS).
-- Sin esto, la aserción S de service_role no se probaría.
grant all on public.news_posts, public.seo_drafts to service_role;
\ir ../migrations/0518_noticias_publicacion_automatica.sql
\ir ../migrations/0525_noticias_ajustes_antes_de_encender.sql
\ir ../migrations/0526_noticias_anon_solo_columnas_publicas.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0526: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Ejecuta con un rol (y el JWT del usuario si es authenticated); devuelve las filas.
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

-- ¿Cuántas filas lee? -1 si la sentencia falla: así la aserción cae con su nombre.
create function pg_temp.filas(p_rol text, p_user uuid, p_sql text) returns integer language plpgsql as $$
begin
  return pg_temp.como(p_rol, p_user, p_sql);
exception when others then
  return -1;
end;
$$;

-- Dos publicadas y una sin publicar, con autor del Studio. Las carga el dueño.
insert into public.news_posts (tenant_id, slug, tipo, categoria, title, excerpt, body_markdown,
                               date, created_by)
values
  ('10000000-0000-4000-8000-000000000001', 'publicada-1', 'informativo', 'importa-sin-perder-plata',
   'Importa · Titular sintético 1', 'Extracto sintético.', 'Cuerpo sintético.', date '2026-11-01',
   '20000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001', 'publicada-2', 'informativo', 'importa-sin-perder-plata',
   'Importa · Titular sintético 2', 'Extracto sintético.', 'Cuerpo sintético.', date '2026-11-02',
   '20000000-0000-4000-8000-000000000001');
insert into public.news_posts (tenant_id, slug, tipo, categoria, title, excerpt, body_markdown,
                               published, created_by)
values
  ('10000000-0000-4000-8000-000000000001', 'sin-publicar', 'informativo', 'importa-sin-perder-plata',
   'Importa · Titular sin publicar', 'Extracto sintético.', 'Cuerpo sintético.', false,
   '20000000-0000-4000-8000-000000000001');

do $contrato$
declare
  sam constant uuid := '20000000-0000-4000-8000-000000000001';
  -- Las 18 de COLUMNAS_PUBLICAS (lib/public/news-queries.ts).
  publicas constant text := 'id,slug,tipo,categoria,title,excerpt,body_markdown,author_name,author_role,'
    || 'focus_keyword,secondary_keywords,meta_description,pain_points,date,read_time_min,published,'
    || 'created_at,updated_at';
  v_col text;
begin
  -- ── N1 · anon no ve quién creó la noticia ni por qué vía se publicó ──
  perform pg_temp.assert_true(pg_temp.falla('anon', null,
    'select created_by from public.news_posts') = '42501', 'N1: anon no lee created_by');
  perform pg_temp.assert_true(pg_temp.falla('anon', null,
    'select publish_via from public.news_posts') = '42501', 'N1: anon no lee publish_via');
  -- Un filtro también lee la columna: `?publish_via=eq.automatica` contaría las automáticas.
  perform pg_temp.assert_true(pg_temp.falla('anon', null,
    'select id from public.news_posts where publish_via = ''automatica''') = '42501',
    'N1: anon no filtra por publish_via');
  perform pg_temp.assert_true(pg_temp.falla('anon', null,
    format('select id from public.news_posts where created_by = %L', sam)) = '42501',
    'N1: anon no filtra por created_by');
  foreach v_col in array array['seo_draft_id', 'content_sha256', 'tenant_id', 'source'] loop
    perform pg_temp.assert_true(pg_temp.falla('anon', null,
      format('select %I from public.news_posts', v_col)) = '42501', 'N1: anon no lee ' || v_col);
  end loop;
  perform pg_temp.assert_true(pg_temp.falla('anon', null,
    'select * from public.news_posts') = '42501', 'N1: anon no puede pedir select *');

  -- ── L · las lecturas públicas siguen (las de lib/public/news-queries.ts) ──
  perform pg_temp.assert_true(pg_temp.filas('anon', null, format(
    'select %s from public.news_posts where published = true order by date desc, created_at desc', publicas)) = 2,
    'L: listPublishedPosts lee las 18 columnas de las 2 publicadas');
  perform pg_temp.assert_true(pg_temp.filas('anon', null, format(
    'select %s from public.news_posts where slug = %L and published = true', publicas, 'publicada-1')) = 1,
    'L: getPostBySlug lee la publicada');
  perform pg_temp.assert_true(pg_temp.filas('anon', null, format(
    'select %s from public.news_posts where published = true and categoria = %L and slug <> %L order by date desc limit 3',
    publicas, 'importa-sin-perder-plata', 'publicada-1')) = 1,
    'L: getRelatedPosts lee las relacionadas');
  perform pg_temp.assert_true(pg_temp.filas('anon', null,
    'select slug from public.news_posts where published = true') = 2,
    'L: listPublishedSlugs lee los slugs');
  perform pg_temp.assert_true(pg_temp.filas('anon', null,
    'select slug from public.news_posts where slug = ''sin-publicar''') = 0,
    'L: la RLS sigue escondiendo la no publicada');

  -- ── S · el Studio sigue leyendo las columnas internas ──
  perform pg_temp.assert_true(pg_temp.filas('authenticated', sam,
    'select created_by, publish_via, seo_draft_id, content_sha256, tenant_id, source from public.news_posts') = 2,
    'S: authenticated sigue leyendo created_by y publish_via');
  perform pg_temp.assert_true(pg_temp.filas('service_role', null,
    'select created_by, publish_via, seo_draft_id, content_sha256, tenant_id, source from public.news_posts') = 3,
    'S: service_role sigue leyendo todo');
end;
$contrato$;

select 'TEST 0526 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;

rollback;
