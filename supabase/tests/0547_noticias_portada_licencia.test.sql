\set ON_ERROR_STOP on

-- SDD-0611 §11.5 · contrato de la 0547: foto de portada con crédito, licencia y enlace de origen.
--
-- Monta el mismo fixture que los contratos de la 0518, 0525 y 0526 (roles, auth,
-- tenants y las migraciones REALES de noticias 0053, 0055, 0057, 0140, 0518, 0525
-- y 0526) y aplica la 0547 REAL.
--
-- Lo que se protege:
--   C  la base solo guarda una portada con URL permitida, licencia escrita y
--      comprobada, origen y, si no es propia, enlace de origen;
--   N  sin permiso la noticia se publica igual, SIN portada (nunca retenida);
--   M  la marca anterior (doortudoor, door-to-door, door%20to%20door) nunca entra;
--   A  anon lee las seis columnas públicas de portada y no la fecha de comprobación;
--   R  los errores que no son de portada siguen fallando (no se tragan);
--   P  la función conserva sus privilegios (ningún rol de API la ejecuta).
--
-- La vuelta del desarme NO está aquí: vive solo en el runner PGlite
-- (lib/news/autopublicar/__tests__/noticias-0547.migration.test.ts), porque el
-- control C4 del CI no copia supabase/desarmes/.
-- CONTROL ROJO: sin 0547 cae en la primera aserción.
-- Termina siempre en ROLLBACK. Solo ids y textos sintéticos.
begin;

do $roles$
begin
  if to_regclass('public.news_posts') is not null then
    raise exception 'Fixture 0547 rechazada: el objeto real ya existe';
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
  ('20000000-0000-4000-8000-000000000001'),  -- admin de T1
  ('20000000-0000-4000-8000-000000000002');  -- admin de T2
insert into public.user_tenants values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'admin', null),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'admin', null);

-- Como en Supabase: los privilegios por defecto dan EXECUTE a anon, authenticated y
-- service_role sobre cada función nueva de public (las 0518 y 0525 lo esperan así).
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

\ir ../migrations/0053_seo_drafts.sql
\ir ../migrations/0055_news_posts.sql
\ir ../migrations/0057_seo_drafts_brief_fields.sql
\ir ../migrations/0140_news_categorias_negocio.sql

-- Como en Supabase: service_role tiene los privilegios de tabla (y salta RLS).
grant all on public.news_posts, public.seo_drafts to service_role;
\ir ../migrations/0518_noticias_publicacion_automatica.sql
\ir ../migrations/0525_noticias_ajustes_antes_de_encender.sql
\ir ../migrations/0526_noticias_anon_solo_columnas_publicas.sql
\ir ../migrations/0547_noticias_portada_licencia.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0547: %', p_label; end if;
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

do $contrato$
declare
  t1 constant uuid := '10000000-0000-4000-8000-000000000001';
  sam constant uuid := '20000000-0000-4000-8000-000000000001';
  v_id uuid;
  v_n integer := 0;
  v_cons text;
  c record;

  -- Una portada válida de la propia marca; cada caso cambia una pieza.
  base_portada constant jsonb := jsonb_build_object(
    'cover_image_url', '/fotos/dtd-cargo-camion-entrega.webp',
    'cover_alt', 'Camión de DTD Cargo',
    'cover_origin', 'propia',
    'cover_license', 'Foto propia de DTD Cargo',
    'cover_license_verified_at', '2026-11-15T12:00:00Z');
begin
  -- ── Presencia ──
  perform pg_temp.assert_true(
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'news_posts'
        and column_name in ('cover_image_url', 'cover_alt', 'cover_origin', 'cover_credit',
                            'cover_license', 'cover_source_url', 'cover_license_verified_at')) = 7,
    'C0: news_posts tiene las 7 columnas de portada');
  perform pg_temp.assert_true(
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'seo_drafts'
        and column_name like 'autopub_cover_%') = 7,
    'C0: seo_drafts tiene autopub_cover_image_url y las 6 nuevas');

  -- ── C · una portada completa se guarda ──
  v_id := public.news_insertar_post(t1, 'manual', null,
    jsonb_build_object('slug', 'con-portada-propia', 'tipo', 'informativo', 'categoria', 'importa-sin-perder-plata',
      'title', 'Importa · Titular sintético', 'excerpt', 'x', 'body_markdown', 'Cuerpo sintético.') || base_portada,
    repeat('a', 64), sam);
  perform pg_temp.assert_true(
    (select cover_image_url = '/fotos/dtd-cargo-camion-entrega.webp' and cover_origin = 'propia'
            and cover_license = 'Foto propia de DTD Cargo' and cover_license_verified_at is not null
       from public.news_posts where id = v_id),
    'C1: una portada propia con licencia comprobada se guarda');

  v_id := public.news_insertar_post(t1, 'manual', null,
    jsonb_build_object('slug', 'con-portada-fuente', 'tipo', 'informativo', 'categoria', 'importa-sin-perder-plata',
      'title', 'Importa · Titular sintético', 'excerpt', 'x', 'body_markdown', 'Cuerpo sintético.')
    || base_portada || jsonb_build_object('cover_origin', 'fuente', 'cover_license', 'CC BY 4.0',
         'cover_credit', 'Autoría sintética', 'cover_source_url', 'https://fuente.example/foto'),
    repeat('a', 64), sam);
  perform pg_temp.assert_true(
    (select cover_origin = 'fuente' and cover_credit = 'Autoría sintética'
            and cover_source_url = 'https://fuente.example/foto'
       from public.news_posts where id = v_id),
    'C2: una foto de la fuente se guarda con crédito, licencia y enlace de origen');

  v_id := public.news_insertar_post(t1, 'manual', null,
    jsonb_build_object('slug', 'con-portada-storage', 'tipo', 'informativo', 'categoria', 'importa-sin-perder-plata',
      'title', 'Importa · Titular sintético', 'excerpt', 'x', 'body_markdown', 'Cuerpo sintético.')
    || base_portada || jsonb_build_object('cover_origin', 'banco', 'cover_license', 'Pexels License',
         'cover_image_url', 'https://abcdefgh.supabase.co/storage/v1/object/public/noticias/foto-1.webp',
         'cover_source_url', 'https://www.pexels.com/photo/1234/'),
    repeat('a', 64), sam);
  perform pg_temp.assert_true(
    (select cover_origin = 'banco' from public.news_posts where id = v_id),
    'C3: el Storage público de Supabase es un host permitido');

  -- ── N/M · sin permiso o con URL mala: la noticia se publica SIN portada ──
  for c in
    select * from (values
      ('sin-licencia',        base_portada - 'cover_license'),
      ('licencia-en-blanco',  base_portada || jsonb_build_object('cover_license', '   ')),
      ('sin-comprobar',       base_portada - 'cover_license_verified_at'),
      ('fecha-ilegible',      base_portada || jsonb_build_object('cover_license_verified_at', 'ayer')),
      ('sin-origen',          base_portada - 'cover_origin'),
      ('origen-raro',         base_portada || jsonb_build_object('cover_origin', 'inventado')),
      ('fuente-sin-enlace',   base_portada || jsonb_build_object('cover_origin', 'fuente')),
      ('host-ajeno',          base_portada || jsonb_build_object('cover_image_url', 'https://otro.example/x.jpg')),
      ('host-parecido',       base_portada || jsonb_build_object('cover_image_url', 'https://supabase.co.otro.example/storage/v1/object/public/x.jpg')),
      ('http-sin-s',          base_portada || jsonb_build_object('cover_image_url', 'http://abcdefgh.supabase.co/storage/v1/object/public/x.jpg')),
      ('protocolo-relativo',  base_portada || jsonb_build_object('cover_image_url', '//otro.example/x.jpg')),
      ('ruta-fuera-de-fotos', base_portada || jsonb_build_object('cover_image_url', '/otra/x.jpg')),
      ('ruta-con-puntos',     base_portada || jsonb_build_object('cover_image_url', '/fotos/../secreto.jpg')),
      ('doortudoor',          base_portada || jsonb_build_object('cover_image_url', '/fotos/precinto-doortudoor-contenedor.jpg')),
      ('door-to-door',        base_portada || jsonb_build_object('cover_image_url', '/fotos/equipo-door-to-door.webp')),
      ('door-codificado',     base_portada || jsonb_build_object('cover_image_url', '/fotos/door%20to%20door.webp')),
      ('mayusculas',          base_portada || jsonb_build_object('cover_image_url', '/fotos/DoorToDoor.JPG')),
      ('extension-rara',      base_portada || jsonb_build_object('cover_image_url', '/fotos/foto.svg')),
      ('alt-largo',           base_portada || jsonb_build_object('cover_alt', repeat('a', 201)))
    ) as t(nombre, portada)
  loop
    v_n := v_n + 1;
    v_id := public.news_insertar_post(t1, 'manual', null,
      jsonb_build_object('slug', 'caso-' || c.nombre, 'tipo', 'informativo', 'categoria', 'importa-sin-perder-plata',
        'title', 'Importa · Titular sintético', 'excerpt', 'x', 'body_markdown', 'Cuerpo sintético.') || c.portada,
      repeat('a', 64), sam);
    perform pg_temp.assert_true(
      (select published and cover_image_url is null and cover_alt is null and cover_origin is null
              and cover_credit is null and cover_license is null and cover_source_url is null
              and cover_license_verified_at is null
         from public.news_posts where id = v_id),
      'N: ' || c.nombre || ' se publica sin portada, sin retener la noticia');
  end loop;
  -- Piso: si la lista de casos quedara vacía, el bucle no probaría nada.
  perform pg_temp.assert_true(v_n >= 19, 'N: se probaron al menos 19 casos');

  -- Una noticia sin portada declarada queda sin portada (el respaldo vive en el código).
  v_id := public.news_insertar_post(t1, 'manual', null,
    jsonb_build_object('slug', 'sin-portada', 'tipo', 'informativo', 'categoria', 'importa-sin-perder-plata',
      'title', 'Importa · Titular sintético', 'excerpt', 'x', 'body_markdown', 'Cuerpo sintético.'),
    repeat('a', 64), sam);
  perform pg_temp.assert_true(
    (select published and cover_image_url is null from public.news_posts where id = v_id),
    'N0: sin portada declarada, la noticia queda sin portada');

  -- ── C · el CHECK de la base se sostiene aun saltando la función ──
  perform pg_temp.assert_true(pg_temp.falla('service_role', null,
    'insert into public.news_posts (tenant_id, slug, tipo, categoria, title, excerpt, body_markdown, cover_image_url)
     values (''10000000-0000-4000-8000-000000000001'', ''directo-1'', ''informativo'', ''importa-sin-perder-plata'',
             ''t'', ''e'', ''b'', ''/fotos/dtd-cargo-camion-entrega.webp'')') = '23514',
    'C4: insertar una portada sin licencia a mano falla con 23514');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null,
    'insert into public.news_posts (tenant_id, slug, tipo, categoria, title, excerpt, body_markdown, cover_alt)
     values (''10000000-0000-4000-8000-000000000001'', ''directo-2'', ''informativo'', ''importa-sin-perder-plata'',
             ''t'', ''e'', ''b'', ''alt suelto sin foto'')') = '23514',
    'C5: metadatos de foto sin foto fallan con 23514');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null,
    'update public.news_posts set cover_image_url = ''/fotos/precinto-doortudoor-x.jpg'', cover_origin = ''propia'',
            cover_license = ''Propia'', cover_license_verified_at = now() where slug = ''sin-portada''') = '23514',
    'C6: ni con licencia entra un archivo de la marca anterior (UPDATE)');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null,
    'update public.news_posts set cover_image_url = ''/fotos/dtd-cargo-camion-entrega.webp'', cover_origin = ''propia'',
            cover_license = ''Propia'', cover_license_verified_at = now() where slug = ''sin-portada''') is null,
    'C7: la misma portada con licencia comprobada sí entra (control del control)');

  -- ── R · lo que no es de portada no se traga ──
  begin
    perform public.news_insertar_post(t1, 'manual', null,
      jsonb_build_object('slug', 'con-portada-propia', 'tipo', 'informativo', 'categoria', 'importa-sin-perder-plata',
        'title', 't', 'excerpt', 'e', 'body_markdown', 'b') || base_portada, repeat('a', 64), sam);
    raise exception 'TEST 0547: R1: un slug repetido debía fallar';
  exception when unique_violation then
    null;
  end;
  perform pg_temp.assert_true(true, 'R1: un slug repetido sigue fallando (unique_violation)');
  begin
    perform public.news_insertar_post(t1, 'manual', null,
      jsonb_build_object('slug', 'con-marca', 'tipo', 'informativo', 'categoria', 'importa-sin-perder-plata',
        'title', 't', 'excerpt', 'e', 'body_markdown', 'Texto con [VERIFICAR: dato] pendiente') || base_portada,
      repeat('a', 64), sam);
    raise exception 'TEST 0547: R2: la marca [VERIFICAR debía fallar';
  exception when check_violation then
    get stacked diagnostics v_cons = constraint_name;
    perform pg_temp.assert_true(v_cons = 'news_posts_sin_marca_verificar',
      'R2: la marca [VERIFICAR sigue fallando con su propio CHECK, aunque la portada sea válida');
  end;

  -- ── A · anon lee la portada pública, no la fecha de comprobación ──
  perform pg_temp.assert_true(pg_temp.filas('anon', null,
    'select cover_image_url, cover_alt, cover_origin, cover_credit, cover_license, cover_source_url
       from public.news_posts where published = true') >= 3,
    'A1: anon lee las seis columnas de portada');
  perform pg_temp.assert_true(pg_temp.falla('anon', null,
    'select cover_license_verified_at from public.news_posts') = '42501',
    'A2: anon no lee cover_license_verified_at');
  perform pg_temp.assert_true(pg_temp.falla('anon', null,
    'select * from public.news_posts') = '42501', 'A3: anon sigue sin poder pedir select *');
  perform pg_temp.assert_true(pg_temp.falla('anon', null,
    'select created_by from public.news_posts') = '42501', 'A4: anon sigue sin leer created_by (0526)');
  -- Las tres válidas (C1 a C3) y la que guardó el UPDATE C7.
  perform pg_temp.assert_true(pg_temp.filas('anon', null,
    'select slug, cover_image_url from public.news_posts where cover_image_url is not null and published = true') = 4,
    'A5: anon ve exactamente las cuatro portadas válidas guardadas');

  -- ── D · el borrador solo declara con forma ──
  perform pg_temp.assert_true(pg_temp.falla('service_role', null,
    'insert into public.seo_drafts (tenant_id, topic, tone, created_by, autopub_cover_origin)
     values (''10000000-0000-4000-8000-000000000001'', ''t'', ''informativo'',
             ''20000000-0000-4000-8000-000000000001'', ''inventado'')') = '23514',
    'D1: un origen inventado en el borrador falla con 23514');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null,
    'insert into public.seo_drafts (tenant_id, topic, tone, created_by, autopub_cover_origin, autopub_cover_source_url)
     values (''10000000-0000-4000-8000-000000000001'', ''t'', ''informativo'',
             ''20000000-0000-4000-8000-000000000001'', ''fuente'', ''http://sin-s.example/x'')') = '23514',
    'D2: un enlace de origen sin https en el borrador falla con 23514');
  perform pg_temp.assert_true(pg_temp.falla('service_role', null,
    'insert into public.seo_drafts (tenant_id, topic, tone, created_by, autopub_cover_origin, autopub_cover_source_url)
     values (''10000000-0000-4000-8000-000000000001'', ''t'', ''informativo'',
             ''20000000-0000-4000-8000-000000000001'', ''fuente'', ''https://fuente.example/x'')') is null,
    'D3: un borrador con origen y enlace válidos entra (control del control)');

  -- ── P · la función conserva sus privilegios ──
  perform pg_temp.assert_true(
    not has_function_privilege('anon', 'public.news_insertar_post(uuid,text,uuid,jsonb,text,uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.news_insertar_post(uuid,text,uuid,jsonb,text,uuid)', 'execute')
    and not has_function_privilege('service_role', 'public.news_insertar_post(uuid,text,uuid,jsonb,text,uuid)', 'execute'),
    'P1: ningún rol de API ejecuta news_insertar_post');
end;
$contrato$;

select 'TEST 0547 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;

rollback;
