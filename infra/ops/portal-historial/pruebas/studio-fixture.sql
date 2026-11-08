\set ON_ERROR_STOP on
-- infra/ops/portal-historial/pruebas/studio-fixture.sql — SDD-0586 10.7 (P4): la base de Studio de la prueba punta
-- a punta (prueba-punta-a-punta.sh), en un Postgres 17 desechable. SOLO DATOS INVENTADOS.
--
-- Copia del fixture del contrato supabase/tests/0523_chatwoot_portal_carga.test.sql (E10, #456), líneas 17 a 158:
-- los roles, el esquema auth mínimo, las fichas y los hilos sintéticos (ids md5('0523-sintetico-…'), teléfonos 555,
-- textos «SINT …») y las migraciones reales 0006, 0106, 0337, 0503, 0504, 0519, 0520 y 0523. Cambia en cuatro cosas:
--   · aplica las migraciones con \i desde /supabase (montado por la prueba), no con \ir;
--   · el vínculo del agente lo pone la prueba, con el id del agente de su Chatwoot;
--   · suma las tablas del CRM que lee controles-studio.sql (C-7), vacías;
--   · termina en COMMIT, para que extraer.sh y vincular.sh lo lean como una base de verdad.
-- Se aplica con:  docker exec -i <pg> psql -X -U postgres -d postgres -f - < studio-fixture.sql
begin;

do $roles$
begin
  if to_regclass('public.chatwoot_portal_salida') is not null or to_regclass('public.clients') is not null then
    raise exception 'TEST 0523 requiere una base PostgreSQL desechable vacía';
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

create function pg_temp.id(label text) returns uuid language sql immutable as $$
  select md5('0523-sintetico-' || label)::uuid
$$;

insert into public.tenants values (pg_temp.id('T1'), 'dtd'), (pg_temp.id('T2'), 'otro');

\i /supabase/migrations/0337_feature_flags_seed_and_trigger.sql
\i /supabase/migrations/0503_chatwoot_bandeja.sql
\i /supabase/migrations/0504_chatwoot_eventos.sql

insert into auth.users values (pg_temp.id('U1')), (pg_temp.id('U2'));
-- El vínculo del agente U1 lo pone la prueba, con el id del agente de su Chatwoot (prueba-punta-a-punta.sh).

-- Fichas de T1: A (con teléfono, que nunca sale), B y C vivas, D borrada. Z en T2.
insert into public.clients (id, tenant_id, markbox, name, phone, deleted_at) values
  (pg_temp.id('A'), pg_temp.id('T1'), 'DTD-SA', 'Cliente A', '+584125550101', null),
  (pg_temp.id('B'), pg_temp.id('T1'), 'DTD-SB', 'Cliente B', null, null),
  (pg_temp.id('C'), pg_temp.id('T1'), 'DTD-SC', 'Cliente C', null, null),
  (pg_temp.id('D'), pg_temp.id('T1'), 'DTD-SD', 'Cliente D', null, now()),
  (pg_temp.id('Z'), pg_temp.id('T2'), 'DTD-SZ', 'Cliente Z', null, null);

-- Hilos de T1: hA portal abierto de A; hP portal pendiente de B; hX portal de A archivado (resuelto
-- en Chatwoot, con su nota); hC portal de C ya vinculado por la cola (no se carga); hD portal de la
-- ficha borrada (no se carga); hE correo de A (no se carga). hZ portal de T2.
insert into public.conversations (id, tenant_id, client_id, channel, status, deleted_at, last_message_at, created_at) values
  (pg_temp.id('hA'), pg_temp.id('T1'), pg_temp.id('A'), 'portal', 'abierto',   null, now() - interval '20 minutes', now() - interval '3 days'),
  (pg_temp.id('hP'), pg_temp.id('T1'), pg_temp.id('B'), 'portal', 'pendiente', null, now() - interval '1 day', now() - interval '2 days'),
  (pg_temp.id('hX'), pg_temp.id('T1'), pg_temp.id('A'), 'portal', 'abierto',   now() - interval '1 day', now() - interval '5 days', now() - interval '9 days'),
  (pg_temp.id('hC'), pg_temp.id('T1'), pg_temp.id('C'), 'portal', 'abierto',   null, null, now()),
  (pg_temp.id('hD'), pg_temp.id('T1'), pg_temp.id('D'), 'portal', 'abierto',   null, null, now()),
  (pg_temp.id('hE'), pg_temp.id('T1'), pg_temp.id('A'), 'email',  'abierto',   null, null, now()),
  (pg_temp.id('hZ'), pg_temp.id('T2'), pg_temp.id('Z'), 'portal', 'abierto',   null, null, now());

insert into public.conversation_messages (id, tenant_id, conversation_id, direction, author_name, author_user_id, body, external_msg_id, sent_at) values
  (pg_temp.id('a1'), pg_temp.id('T1'), pg_temp.id('hA'), 'in',  'Cliente A', null,            'SINT pregunta a1', 'portal:a1', now() - interval '40 minutes'),
  (pg_temp.id('a2'), pg_temp.id('T1'), pg_temp.id('hA'), 'out', 'Ana',       pg_temp.id('U1'), 'SINT respuesta a2', null,      now() - interval '30 minutes'),
  (pg_temp.id('a3'), pg_temp.id('T1'), pg_temp.id('hA'), 'out', 'Luis',      pg_temp.id('U2'), 'SINT respuesta a3', null,      now() - interval '25 minutes'),
  (pg_temp.id('a4'), pg_temp.id('T1'), pg_temp.id('hA'), 'out', 'Ana',       null,            'SINT vino de Chatwoot', 'chatwoot:999', now() - interval '24 minutes'),
  -- En el margen del corte (2 minutos antes de la foto) y dentro de la foto.
  (pg_temp.id('am'), pg_temp.id('T1'), pg_temp.id('hA'), 'in',  'Cliente A', null,            'SINT en el margen',  null,      now() - interval '2 minutes'),
  (pg_temp.id('p1'), pg_temp.id('T1'), pg_temp.id('hP'), 'in',  'Cliente B', null,            'SINT pregunta p1',   null,      now() - interval '1 day'),
  (pg_temp.id('x1'), pg_temp.id('T1'), pg_temp.id('hX'), 'in',  'Cliente A', null,            'SINT archivado x1',  null,      now() - interval '5 days'),
  (pg_temp.id('c1'), pg_temp.id('T1'), pg_temp.id('hC'), 'in',  'Cliente C', null,            'SINT ya en la cola', null,      now() - interval '1 hour'),
  (pg_temp.id('d1'), pg_temp.id('T1'), pg_temp.id('hD'), 'in',  'Cliente D', null,            'SINT ficha borrada', null,      now() - interval '1 hour'),
  (pg_temp.id('z1'), pg_temp.id('T2'), pg_temp.id('hZ'), 'in',  'Cliente Z', null,            'SINT otro tenant',   null,      now() - interval '1 hour');

\i /supabase/migrations/0519_chatwoot_portal.sql

-- hC ya lo vinculó la cola (su ficha tiene identificador y contacto).
insert into public.chatwoot_portal_contactos (tenant_id, client_id, chatwoot_contact_id, chatwoot_source_id)
values (pg_temp.id('T1'), pg_temp.id('C'), 300, 'dtd-portal:previo');
insert into public.chatwoot_portal_hilos (conversation_id, tenant_id, chatwoot_conversation_id)
values (pg_temp.id('hC'), pg_temp.id('T1'), 1100);
insert into public.chatwoot_portal_salida (message_id, tenant_id, conversation_id, estado, chatwoot_message_id)
values (pg_temp.id('c1'), pg_temp.id('T1'), pg_temp.id('hC'), 'enviado', 1101);

\i /supabase/migrations/0520_chatwoot_portal_vuelta.sql
\i /supabase/migrations/0523_chatwoot_portal_carga.sql

-- C-7 de controles-studio.sql lee estas tablas del CRM: aquí van vacías, solo con lo que esa consulta mira.
create table public.crm_tarjetas (id uuid primary key default gen_random_uuid(), tenant_id uuid not null);
create table public.crm_tareas (id uuid primary key default gen_random_uuid(), tenant_id uuid not null);
create table public.crm_historial_etapas (id uuid primary key default gen_random_uuid(), tenant_id uuid not null);

commit;
