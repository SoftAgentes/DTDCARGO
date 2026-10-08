-- ─────────────────────────────────────────────────────────────
-- Stubs REDUCIDOS de plataforma para reconstruir el schema sobre la imagen real
-- `supabase/postgres:17.6.1.136` (SDD-0505), la misma que corre la base en el
-- servidor propio (infra/dtd-cargo/compose.supabase.yml).
--
-- Hermano de `_supabase-platform-stubs.sql`, que está pensado para un
-- `postgres:17` pelado y por eso CREA toda la plataforma (schemas auth/storage/
-- vault, roles, pg_cron y pg_net de mentira). Sobre la imagen de Supabase casi
-- todo eso ya existe de verdad —y pertenece a `supabase_admin`, no a `postgres`—
-- así que aquel archivo choca: `create table auth.users` da "permission denied
-- for schema auth" (medido el 2026-10-08) y los control-files vacíos que escribe
-- el script tapan las extensiones reales que justamente se quieren probar.
--
-- Acá va SOLO lo que la imagen no trae y en producción crean los servicios al
-- arrancar (GoTrue, storage-api) o la CLI (ledger), más las piezas que las
-- migraciones dan por sentadas antes de crearlas. Dos bloques, porque los
-- dueños son distintos:
--
--   · `\connect ... supabase_admin` — extensiones (pg_cron/pg_net reales, con
--     shared_preload_libraries de la imagen), objetos de `auth` y `storage` que
--     en Cloud crean GoTrue/storage-api, y el apagado temporal de la RLS de
--     cron.* (ver abajo).
--   · `\connect ... postgres`      — ledger `supabase_migrations` y el placeholder
--     `rls_auto_enable()`, que sí son del dueño de la app.
--
-- Las migraciones se aplican después como `postgres` (no como superusuario):
-- fiel a Cloud, donde `postgres` tampoco es superuser (super=false,
-- bypassrls=true). Los stubs siguen siendo de FIDELIDAD MÍNIMA: auth.jwt() lee
-- un GUC, nada se cifra, nada llama a nadie.
--
-- ESTADO (2026-10-08): con estos stubs la reconstrucción pasa de la 0038 y se
-- detiene en la 0268 ("un rol cliente puede borrar tenants"): la imagen define
-- default privileges de `postgres` en `public` que dan DELETE a anon/authenticated,
-- y el `revoke` que lo corrige vive solo como literal del ledger (0279/0286-0288),
-- no en una migración viva. Decisión pendiente del Director/Sam: hooks por
-- migración o una migración aditiva nueva que haga explícitos esos revokes.
-- ─────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on

\connect postgres supabase_admin

-- Extensiones reales de la imagen (pg_cron y pg_net van en shared_preload_libraries
-- del postgresql.conf de la imagen; sin `-c config_file=` no cargan). Las crea
-- supabase_admin porque `postgres` no tiene CREATE sobre `extensions`.
create extension if not exists pg_cron;
create extension if not exists pg_net;
grant usage on schema cron to postgres, service_role;
grant usage on schema net to postgres, anon, authenticated, service_role;
grant all on all tables in schema cron to postgres;
grant all on all functions in schema cron to postgres;
grant execute on all functions in schema net to postgres, anon, authenticated, service_role;

-- La 0038 recorre pg_class buscando tablas con RLS y evalúa
-- has_table_privilege('service_role', 'public.' || relname) ANTES de filtrar por
-- nspname: con el pg_cron real, cron.job y cron.job_run_details tienen RLS y el
-- `public.job_run_details` inexistente la aborta. La 0038 ya está aplicada en
-- producción y no se edita; se apaga la RLS de esas dos tablas mientras dura
-- la reconstrucción (nunca se vuelve a encender: el contenedor es efímero).
alter table cron.job disable row level security;
alter table cron.job_run_details disable row level security;

-- `auth`: la imagen trae auth.users, refresh_tokens, instances, audit_log_entries
-- y uid()/role()/email(). Lo demás lo crea GoTrue al arrancar. En Cloud las
-- tablas de auth son de supabase_auth_admin y `postgres` recibe ALL por default
-- privileges (la 0019 crea un trigger sobre auth.sessions: exige TRIGGER).
create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  not_after timestamptz,
  aal text
);
alter table auth.sessions owner to supabase_auth_admin;
grant all on auth.sessions to postgres;
grant select on auth.sessions to anon, authenticated, service_role;

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant execute on function auth.jwt() to postgres, anon, authenticated, service_role;

-- Usuarios que algunas migraciones siembran con UUID hardcoded (founder, etc.).
-- La tabla real exige instance_id/aud/role; el resto tiene defaults.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data) values
  ('83c98d22-ea54-4d7a-b10f-a23098a2edbe', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'founder@example.test', '{"tenant":"dtd-cargo"}'::jsonb, '{}'::jsonb),
  ('4ede88a0-b9c4-49ff-962b-e5a5014776e6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed2@example.test',   '{"tenant":"dtd-cargo"}'::jsonb, '{}'::jsonb),
  ('01680000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed3@example.test',   '{"tenant":"dtd-cargo"}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

-- `storage`: el schema existe en la imagen; las tablas las crea storage-api al
-- arrancar. Dueño `postgres` para que las migraciones puedan crear policies
-- sobre storage.objects (en Cloud, storage-api le da esos privilegios a postgres).
create table if not exists storage.buckets (
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
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/') $$;
alter table storage.buckets owner to postgres;
alter table storage.objects owner to postgres;
alter function storage.foldername(text) owner to postgres;
grant all on storage.buckets, storage.objects to postgres, service_role;
grant select on storage.buckets, storage.objects to anon, authenticated;
grant execute on function storage.foldername(text) to postgres, anon, authenticated, service_role;

-- Realtime: en Cloud la publicación existe de fábrica; en la imagen la crea
-- realtime.sql del compose, que acá no corre.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

\connect postgres postgres

-- Ledger de migraciones (lo crea la CLI/plataforma).
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);

-- `rls_auto_enable()` existe en prod desde ANTES de la 0209, creada fuera de
-- banda. 0209 y 0211 le hacen revoke/grant antes de que 0277 la versione →
-- placeholder con la misma firma para respetar el orden real.
create or replace function public.rls_auto_enable()
returns event_trigger language plpgsql as $stub$ begin end $stub$;
