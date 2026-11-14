\set ON_ERROR_STOP on
-- infra/ops/portal-historial/ensayo-studio-esquema.sql — SDD-0586 10.7, PR 2b: el ESQUEMA de la copia efímera de
-- Studio del ensayo (ensayo-portal.sh). Sin datos: los datos entran después, con COPY, por la lista explícita de
-- copia-columnas.tsv. Así no viaja ningún pg_dump de producción, ni siquiera de esquema.
--
-- Es el esquema de pruebas/studio-fixture.sql (la prueba punta a punta, copiado del contrato de la 0523) sin sus
-- datos inventados, más la 0508 y la 0524 (como el fixture desde la #468). Las migraciones se leen de /supabase, que
-- el ensayo monta en solo lectura desde la carpeta de migraciones que se le pasa (MIGRACIONES).
-- Se aplica con:  docker exec -i <copia> psql -X -U postgres -d postgres -f - < ensayo-studio-esquema.sql
begin;

do $roles$
begin
  if to_regclass('public.chatwoot_portal_salida') is not null or to_regclass('public.clients') is not null then
    raise exception 'el esquema del ensayo requiere una base PostgreSQL desechable vacía';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

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

create table public.user_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name  text
);

create table public.feature_flags (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  key         text not null,
  enabled     boolean not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  unique (tenant_id, key)
);

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1]
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid())
    and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
grant execute on function public.get_user_tenant_id() to authenticated;

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

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create publication supabase_realtime;

\i /supabase/migrations/0006_clients.sql
alter table public.clients
  add column phone_last10 text
  generated always as (
    case
      when pg_catalog.length(pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g')) >= 10
      then pg_catalog."right"(pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)
    end
  ) stored;
\i /supabase/migrations/0106_conversaciones.sql

\i /supabase/migrations/0337_feature_flags_seed_and_trigger.sql
\i /supabase/migrations/0503_chatwoot_bandeja.sql
\i /supabase/migrations/0504_chatwoot_eventos.sql

\i /supabase/migrations/0519_chatwoot_portal.sql

\i /supabase/migrations/0520_chatwoot_portal_vuelta.sql
\i /supabase/migrations/0523_chatwoot_portal_carga.sql
\i /supabase/migrations/0508_chatwoot_bajas_purga.sql
\i /supabase/migrations/0524_chatwoot_portal_puerta4.sql

-- C-7 de controles-studio.sql lee estas tablas del CRM: aquí van vacías, solo con lo que esa consulta mira.
create table public.crm_tarjetas (id uuid primary key default gen_random_uuid(), tenant_id uuid not null);
create table public.crm_tareas (id uuid primary key default gen_random_uuid(), tenant_id uuid not null);
-- El id es bigint identity, como en 0506_crm_modelo.sql (el --solo-copia del 2026-11-14 falló con uuid:
-- «invalid input syntax for type uuid»). En producción es «always»; aquí va «by default», para que el COPY pueda traer el
-- id de producción sin OVERRIDING SYSTEM VALUE. El tipo, bigint, es el mismo, y es lo único que compara la guarda.
create table public.crm_historial_etapas (
  id           bigint generated by default as identity primary key,
  tenant_id    uuid not null
);

commit;
