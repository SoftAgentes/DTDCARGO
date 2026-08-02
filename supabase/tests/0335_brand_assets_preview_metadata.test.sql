-- Contrato de 0335 (SDD-0238): metadatos de previsualización de brand_assets.
--
-- Lo que se fija acá:
--   · las columnas nuevas no rompen las filas que ya existían (default 'auto');
--   · `tile` sólo acepta los 4 valores del diseño — un valor libre entraría en
--     el `style` de la miniatura sin que nadie lo mire;
--   · las dimensiones no pueden ser 0 ni negativas (vienen del navegador, o sea
--     de un cliente manipulable).
\set ON_ERROR_STOP on
begin;

do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema extensions;
create extension pgcrypto with schema extensions;
create schema auth;
create schema storage;

create table public.tenants(id uuid primary key);
create table auth.users(id uuid primary key);
create table public.user_tenants(
  user_id uuid not null, tenant_id uuid not null,
  role text not null, disabled_at timestamptz
);
create table storage.buckets(
  id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text);

create function auth.uid() returns uuid language sql stable
  as $$ select '99999999-9999-4999-8999-999999999999'::uuid $$;
create function public.get_user_tenant_id() returns uuid language sql stable
  as $$ select '11111111-1111-4111-8111-111111111111'::uuid $$;
create function public.touch_updated_at() returns trigger language plpgsql
  as $$ begin new.updated_at = now(); return new; end $$;

\ir ../migrations/0334_brand_catalog_public_gate.sql

-- Una fila creada ANTES de 0335: es la que prueba que la migración no rompe
-- lo que ya estaba en producción.
do $$
declare
  t1 uuid = '11111111-1111-4111-8111-111111111111';
  sec uuid;
begin
  insert into public.tenants values (t1);
  insert into public.brand_sections(tenant_id, slug, title, sort_order)
  values (t1, 'logos', 'Logos', 10) returning id into sec;
  insert into public.brand_assets(tenant_id, section_id, title, storage_path)
  values (t1, sec, 'Asset viejo', 'x/viejo.png');
end $$;

\ir ../migrations/0335_brand_assets_preview_metadata.sql

do $$
declare
  t1 uuid = '11111111-1111-4111-8111-111111111111';
  sec uuid;
  r record;
begin
  select id into sec from public.brand_sections where tenant_id = t1 and slug = 'logos';

  -- ── 1 · La fila preexistente sobrevive con el default ────────
  select width, height, tile into r
  from public.brand_assets where title = 'Asset viejo';
  if r.width is not null or r.height is not null then
    raise exception '0335: la fila vieja no quedó con dimensiones nulas';
  end if;
  if r.tile <> 'auto' then
    raise exception '0335: el default de tile no es "auto" (es %) — cambiaría el fondo de todo lo ya subido', r.tile;
  end if;

  -- ── 2 · Los 4 valores válidos de tile entran ─────────────────
  insert into public.brand_assets(tenant_id, section_id, title, storage_path, tile)
  values (t1, sec, 'light',   'x/1.png', 'light'),
         (t1, sec, 'dark',    'x/2.png', 'dark'),
         (t1, sec, 'checker', 'x/3.png', 'checker'),
         (t1, sec, 'auto',    'x/4.png', 'auto');

  -- ── 3 · Cualquier otro NO ────────────────────────────────────
  -- Sin esto, un valor libre viajaría al `style` de la miniatura.
  begin
    insert into public.brand_assets(tenant_id, section_id, title, storage_path, tile)
    values (t1, sec, 'malo', 'x/5.png', 'transparente');
    raise exception '0335: aceptó un tile fuera del enum';
  exception when check_violation then
    null;
  end;

  -- ── 4 · Dimensiones no positivas ─────────────────────────────
  begin
    insert into public.brand_assets(tenant_id, section_id, title, storage_path, width, height)
    values (t1, sec, 'cero', 'x/6.png', 0, 100);
    raise exception '0335: aceptó width = 0';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.brand_assets(tenant_id, section_id, title, storage_path, width, height)
    values (t1, sec, 'negativo', 'x/7.png', 100, -5);
    raise exception '0335: aceptó height negativo';
  exception when check_violation then
    null;
  end;

  -- ── 5 · Dimensiones válidas, y parciales ─────────────────────
  -- Parciales a propósito: un SVG puede dar ancho y no alto.
  insert into public.brand_assets(tenant_id, section_id, title, storage_path, width, height)
  values (t1, sec, 'completo', 'x/8.png', 741, 764),
         (t1, sec, 'parcial',  'x/9.svg', 512, null);

  select width, height into r from public.brand_assets where title = 'completo';
  if r.width <> 741 or r.height <> 764 then
    raise exception '0335: no guardó las dimensiones';
  end if;
end $$;

rollback;
