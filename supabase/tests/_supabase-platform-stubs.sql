-- ─────────────────────────────────────────────────────────────
-- Stubs de la plataforma Supabase para reconstruir el schema en un Postgres
-- pelado. NO es parte del schema del producto: son las piezas que en producción
-- provee Supabase (auth, storage, vault, realtime, pg_cron, pg_net) y que
-- nuestras migraciones dan por sentadas.
--
-- Lo usa `scripts/check-schema-rebuild.mjs`. Si una migración nueva empieza a
-- depender de otra pieza de la plataforma, el gate se pone rojo y el stub que
-- falta se agrega ACÁ — así queda explícito de qué depende el ERP.
--
-- ⚠️ Estos stubs son de FIDELIDAD MÍNIMA: existen para que el DDL aplique, no
-- reproducen el comportamiento real (auth.uid() lee un GUC, vault no cifra,
-- net.http_post no llama a nadie). No usarlos para probar lógica de negocio.
-- ─────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on

create schema if not exists auth;
create schema if not exists vault;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
-- Supabase resuelve pgcrypto sin calificar (search_path incluye extensions).
alter database postgres set search_path = public, extensions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator nologin; end if;
end $$;

grant usage on schema public, auth, extensions to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  encrypted_password text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid $$;

create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('test.role', true), ''), 'authenticated') $$;

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('test.jwt', true), ''), '{}')::jsonb $$;

create table auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  not_after timestamptz,
  aal text
);

create table auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_id text not null,
  identity_data jsonb not null default '{}'::jsonb
);

create table auth.refresh_tokens (
  id bigserial primary key,
  session_id uuid references auth.sessions(id) on delete cascade,
  token text,
  user_id text,
  revoked boolean not null default false
);

create table auth.mfa_factors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'unverified',
  factor_type text not null default 'totp'
);

create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  public boolean not null default false,
  avif_autodetection boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/') $$;

-- pg_cron y pg_net: en Supabase son extensiones; acá stubs con la misma firma.
create schema if not exists cron;
create schema if not exists net;
grant usage on schema cron, net to postgres, service_role;

create table cron.job (
  jobid bigserial primary key,
  schedule text, command text, nodename text default 'localhost',
  nodeport int default 5432, database text, username text,
  active boolean not null default true, jobname text unique
);

create function cron.schedule(job_name text, schedule text, command text)
returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid $$;

create function cron.unschedule(job_name text)
returns boolean language sql as $$
  delete from cron.job where jobname = job_name returning true $$;

create function net.http_post(
  url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000
) returns bigint language sql as $$ select 1::bigint $$;

create function net.http_get(
  url text, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb,
  timeout_milliseconds int default 5000
) returns bigint language sql as $$ select 1::bigint $$;

-- Ledger de migraciones de Supabase (lo crea la CLI/plataforma).
create schema if not exists supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);

-- `rls_auto_enable()` existe en prod desde ANTES de la 0209, creada fuera de
-- banda. Su definición canónica ya vive en la migración 0277, pero 0209 y 0211
-- le hacen revoke/grant antes de que 0277 corra → hace falta este placeholder
-- para que la reconstrucción respete el orden real. La 0277 lo reemplaza con la
-- definición verdadera (misma firma → CREATE OR REPLACE limpio).
create function public.rls_auto_enable()
returns event_trigger language plpgsql as $stub$ begin end $stub$;

-- Usuarios que algunas migraciones siembran con UUID hardcoded (founder, etc.).
insert into auth.users (id, email, raw_user_meta_data) values
  ('83c98d22-ea54-4d7a-b10f-a23098a2edbe', 'founder@example.test', '{"tenant":"dtd-cargo"}'::jsonb),
  ('4ede88a0-b9c4-49ff-962b-e5a5014776e6', 'seed2@example.test',   '{"tenant":"dtd-cargo"}'::jsonb),
  ('01680000-0000-4000-8000-000000000001', 'seed3@example.test',   '{"tenant":"dtd-cargo"}'::jsonb)
on conflict (id) do nothing;

-- Realtime: Supabase la crea de fábrica.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

create table vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text, secret text, description text
);

create function vault.create_secret(new_secret text, new_name text default null, new_description text default '')
returns uuid language sql as $$
  insert into vault.secrets (name, secret, description) values (new_name, new_secret, new_description) returning id $$;

-- En Supabase real es una vista que descifra; acá el secret ya va en claro.
create view vault.decrypted_secrets as
  select id, name, description, secret, secret as decrypted_secret from vault.secrets;
