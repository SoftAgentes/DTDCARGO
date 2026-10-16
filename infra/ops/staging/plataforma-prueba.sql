-- ─────────────────────────────────────────────────────────────────────────────
-- infra/ops/staging/plataforma-prueba.sql — lo que la base de prueba necesita ANTES
-- de las migraciones de main (SDD-0540, Fase 1). Lo corre resetear-base-prueba.sh
-- como supabase_admin en `<proyecto>-db-1`, una sola vez por reset.
--
-- Deriva de supabase/tests/_supabase-platform-stubs.supabase.sql (el que hace pasar
-- `pnpm schema:rebuild:supabase` sobre la misma imagen), con una diferencia: en
-- prueba GoTrue y storage-api ya arrancaron y crearon sus tablas, así que las
-- tablas y funciones de `auth` y `storage` se crean SOLO si faltan (la prueba
-- efímera del reset corre sobre una base sin esos servicios). Nada de este archivo
-- pisa un objeto que ya exista.
--
-- El bloque de default privileges es copia del de los stubs: los MISMOS que
-- producción (pg_default_acl leído el 2026-10-08). Sin él, cada tabla nueva nace
-- abierta para anon y authenticated (servidor-contabo.md §2.1, paso 4).
-- scripts/__tests__/entorno-prueba-contrato.test.ts falla si los dos bloques
-- dejan de ser iguales.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on

\connect postgres supabase_admin

create extension if not exists pg_cron;
create extension if not exists pg_net;
grant usage on schema cron to postgres, service_role;
grant usage on schema net to postgres, anon, authenticated, service_role;
grant all on all tables in schema cron to postgres;
grant all on all functions in schema cron to postgres;
grant execute on all functions in schema net to postgres, anon, authenticated, service_role;

-- La 0038 evalúa has_table_privilege('service_role', 'public.' || relname) sobre
-- toda tabla con RLS antes de filtrar por esquema, y cron.job_run_details la
-- aborta. Se apaga mientras corren las migraciones; resetear-base-prueba.sh la
-- vuelve a encender al terminar.
alter table cron.job disable row level security;
alter table cron.job_run_details disable row level security;

-- `auth`: auth.sessions la crea GoTrue; la 0019 le pone un trigger.
do $plataforma_auth$
begin
  if pg_catalog.to_regclass('auth.sessions') is null then
    create table auth.sessions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      not_after timestamptz,
      aal text
    );
    alter table auth.sessions owner to supabase_auth_admin;
  end if;
  if pg_catalog.to_regprocedure('auth.jwt()') is null then
    create function auth.jwt() returns jsonb language sql stable as
      'select coalesce(nullif(current_setting(''request.jwt.claims'', true), ''''), ''{}'')::jsonb';
  end if;
end
$plataforma_auth$;
grant all on auth.sessions to postgres;
grant select on auth.sessions to anon, authenticated, service_role;
grant execute on function auth.jwt() to postgres, anon, authenticated, service_role;

-- Usuarios que algunas migraciones siembran con UUID fijo (fundador y dos más).
-- Correos de dominio reservado: no son personas.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data) values
  ('83c98d22-ea54-4d7a-b10f-a23098a2edbe', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'founder@example.test', '{"tenant":"dtd-cargo"}'::jsonb, '{}'::jsonb),
  ('4ede88a0-b9c4-49ff-962b-e5a5014776e6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed2@example.test',   '{"tenant":"dtd-cargo"}'::jsonb, '{}'::jsonb),
  ('01680000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed3@example.test',   '{"tenant":"dtd-cargo"}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

-- `storage`: si storage-api no corrió (prueba efímera), las tablas mínimas con
-- dueño postgres, como en los stubs del rebuild.
do $plataforma_storage$
begin
  if pg_catalog.to_regclass('storage.buckets') is null then
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
    alter table storage.buckets owner to postgres;
    grant all on storage.buckets to postgres, service_role;
    grant select on storage.buckets to anon, authenticated;
  end if;
  if pg_catalog.to_regclass('storage.objects') is null then
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id),
      name text,
      owner uuid,
      metadata jsonb,
      created_at timestamptz not null default now()
    );
    alter table storage.objects owner to postgres;
    grant all on storage.objects to postgres, service_role;
    grant select on storage.objects to anon, authenticated;
  end if;
  if pg_catalog.to_regprocedure('storage.foldername(text)') is null then
    create function storage.foldername(name text) returns text[] language sql immutable as
      'select string_to_array(name, ''/'')';
    alter function storage.foldername(text) owner to postgres;
    grant execute on function storage.foldername(text) to postgres, anon, authenticated, service_role;
  end if;
end
$plataforma_storage$;

do $plataforma_realtime$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$plataforma_realtime$;

\connect postgres postgres

-- Default privileges del rol `postgres` en `public`: los MISMOS que tiene
-- producción, leídos de `pg_default_acl` el 2026-10-08 (SDD-0505).
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

-- Ledger con las columnas de producción (version, statements, name, created_by,
-- idempotency_key, rollback; leídas por el Director el 2026-10-14). El tipo de
-- las dos últimas es inferencia: la app y los scripts no las usan.
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
alter table supabase_migrations.schema_migrations
  add column if not exists created_by text,
  add column if not exists idempotency_key text,
  add column if not exists rollback text[];

-- `rls_auto_enable()` existe en producción desde antes de la 0209 (creada fuera
-- de banda); 0209 y 0211 le hacen revoke/grant antes de que la 0277 la versione.
create or replace function public.rls_auto_enable()
returns event_trigger language plpgsql as $stub$ begin end $stub$;

-- La base tiene que quedar sin ninguna migración: el reset la llena entera.
do $plataforma_vacia$
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 0 then
    raise exception 'plataforma-prueba: el ledger ya tiene filas; el reset espera una base nueva';
  end if;
end
$plataforma_vacia$;
