\set ON_ERROR_STOP on

-- SDD-0625 · contrato de la 0532 (editar, retirar y volver a publicar una noticia
-- queda auditado).
--
-- Monta el writer AUD-01 REAL (0267 + 0294) como el contrato de la 0491 y las
-- migraciones REALES de noticias 0053, 0055, 0057, 0140, 0518 y 0525 como el de
-- la 0525; después aplica la 0532 REAL. Escribe como la Server Action: rol
-- authenticated con el JWT de un admin.
--
-- Lo que se protege:
--   E1  corregir el texto de una publicada deja news_post_updated con el actor,
--       las columnas cambiadas y huellas, sin copiar el texto;
--   E2  un UPDATE que no cambia contenido ni estado no deja evento;
--   E3  retirar con news_retirar deja news_post_withdrawn con el motivo;
--   E4  sacarla por otra vía (service_role) deja «motivo pendiente» y actor system;
--   E5  volver a publicar deja news_post_republished;
--   E6  si el writer falla, la edición se revierte (misma transacción);
--   E7  quien no es admin no edita y no deja evento; anon sigue sin escribir y
--       no ejecuta la función del disparador.
--
-- CONTROL ROJO: sin 0532 cae en la primera aserción.
-- Termina siempre en ROLLBACK. Solo ids y textos sintéticos.
begin;

do $roles$
begin
  if to_regclass('public.entity_audit_log') is not null
     or to_regclass('public.news_posts') is not null then
    raise exception 'Fixture 0532 rechazada: los objetos reales ya existen';
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

-- ── Plataforma previa a 0267 (copia del contrato de 0491) ───────────────────
create table public.tenants (id uuid primary key, slug text);

create table public.audit_entity_types (
  entity_type text primary key,
  status text not null check (status in ('active', 'deprecated')),
  domain_code text,
  contract_version integer,
  introduced_by_ref text
);

create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  actor_type text not null,
  actor_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint entity_audit_log_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint entity_audit_log_entity_type_fkey
    foreign key (entity_type) references public.audit_entity_types(entity_type)
    on update restrict on delete restrict,
  constraint entity_audit_log_actor_type_check
    check (actor_type in ('user', 'operario', 'system'))
);

alter table public.entity_audit_log enable row level security;
create policy entity_audit_log_tenant_select on public.entity_audit_log
  for select to authenticated using (true);
create policy entity_audit_log_service_role_all on public.entity_audit_log
  for all to service_role using (true) with check (true);
grant select on public.entity_audit_log to authenticated;
grant all on public.entity_audit_log to service_role;

create publication supabase_realtime;
alter publication supabase_realtime add table public.entity_audit_log;

\ir ../migrations/0267_audit_contract_append_only.sql
\ir ../migrations/0294_audit_d2_human_reasons.sql

-- ── Lo que las noticias necesitan (copia del contrato de 0525) ──────────────
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
grant select on public.user_tenants to authenticated;

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

insert into public.tenants values
  ('10000000-0000-4000-8000-000000000001', 'dtd'),
  ('10000000-0000-4000-8000-000000000002', 'otro');
insert into auth.users values
  ('20000000-0000-4000-8000-000000000001'),  -- admin de T1
  ('20000000-0000-4000-8000-000000000003');  -- commercial de T1
insert into public.user_tenants values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'admin', null),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'commercial', null);

-- Como en Supabase: EXECUTE por defecto a los roles de la API sobre funciones nuevas.
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

\ir ../migrations/0053_seo_drafts.sql
\ir ../migrations/0055_news_posts.sql
\ir ../migrations/0057_seo_drafts_brief_fields.sql
\ir ../migrations/0140_news_categorias_negocio.sql
grant all on public.news_posts, public.seo_drafts to service_role;
\ir ../migrations/0518_noticias_publicacion_automatica.sql
\ir ../migrations/0525_noticias_ajustes_antes_de_encender.sql
\ir ../migrations/0532_noticias_edicion_auditada.sql

-- Una noticia manual publicada (la siembra la hace el dueño: INSERT, sin evento).
insert into public.news_posts (id, tenant_id, slug, tipo, categoria, title, excerpt, body_markdown,
                               meta_description, focus_keyword)
values ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
        'tiempos-sinteticos', 'informativo', 'importa-sin-perder-plata',
        'Importa · TEXTO-TITULO-VIEJO', 'TEXTO-BAJADA-VIEJA', 'TEXTO-CUERPO-VIEJO decía 30 días.',
        'TEXTO-META-VIEJA', 'importador');

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0532: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

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

create function pg_temp.falla(p_rol text, p_user uuid, p_sql text) returns text language plpgsql as $$
begin
  perform pg_temp.como(p_rol, p_user, p_sql);
  return null;
exception when others then
  return sqlstate;
end;
$$;

create function pg_temp.eventos(p_tipo text) returns bigint language sql as $$
  select count(*) from public.entity_audit_log
   where entity_type = 'news_post' and event_type = p_tipo
     and entity_id = '40000000-0000-4000-8000-000000000001';
$$;

do $contrato$
declare
  v_post uuid := '40000000-0000-4000-8000-000000000001';
  v_admin uuid := '20000000-0000-4000-8000-000000000001';
  v_comercial uuid := '20000000-0000-4000-8000-000000000003';
  v_ev public.entity_audit_log;
  v_total bigint;
begin
  -- E1 · corregir el texto, como guardarEdicion.
  perform pg_temp.assert_true(pg_temp.como('authenticated', v_admin, format(
    'update public.news_posts set title = %L, body_markdown = %L
      where id = %L and tenant_id = %L and published',
    'Importa · TEXTO-TITULO-NUEVO', 'TEXTO-CUERPO-NUEVO tarda de 45 a 55 días.',
    v_post, '10000000-0000-4000-8000-000000000001')) = 1,
    'E1: el admin corrige la noticia publicada');
  perform pg_temp.assert_true(pg_temp.eventos('news_post_updated') = 1,
    'E1: corregir deja un news_post_updated');
  select * into v_ev from public.entity_audit_log
   where entity_type = 'news_post' and event_type = 'news_post_updated';
  perform pg_temp.assert_true(v_ev.actor_type = 'user' and v_ev.actor_id = v_admin,
    'E1: el evento lleva al admin como actor');
  perform pg_temp.assert_true(v_ev.payload -> 'changed_fields' = '["body_markdown", "title"]'::jsonb,
    'E1: el evento dice qué columnas cambiaron');
  perform pg_temp.assert_true(position('TEXTO-' in pg_catalog.to_jsonb(v_ev)::text) = 0,
    'E1: el evento no copia el texto de la noticia');
  perform pg_temp.assert_true(
    (pg_catalog.to_jsonb(v_ev) -> 'before_data' ->> 'body_sha256')
      is distinct from (pg_catalog.to_jsonb(v_ev) -> 'after_data' ->> 'body_sha256')
    and length(pg_catalog.to_jsonb(v_ev) -> 'after_data' ->> 'body_sha256') = 64,
    'E1: antes y después llevan la huella del cuerpo');

  -- E2 · un UPDATE sin cambios de contenido ni de estado.
  perform pg_temp.como('authenticated', v_admin, format(
    'update public.news_posts set title = title where id = %L', v_post));
  perform pg_temp.assert_true(pg_temp.eventos('news_post_updated') = 1,
    'E2: un UPDATE que no cambia nada no deja evento');

  -- E7 · quien no es admin no edita ni deja evento.
  perform pg_temp.assert_true(pg_temp.como('authenticated', v_comercial, format(
    'update public.news_posts set title = %L where id = %L', 'Importa · Otro', v_post)) = 0,
    'E7: un commercial no edita la noticia');
  perform pg_temp.assert_true(coalesce(pg_temp.falla('anon', null, format(
    'update public.news_posts set title = %L where id = %L', 'Importa · Otro', v_post)), '') <> ''
    or pg_temp.como('anon', null, format(
    'update public.news_posts set title = %L where id = %L', 'Importa · Otro', v_post)) = 0,
    'E7: anon no edita la noticia');
  perform pg_temp.assert_true(pg_temp.eventos('news_post_updated') = 1,
    'E7: los intentos sin permiso no dejan evento');
  perform pg_temp.assert_true(
    not has_function_privilege('anon', 'public.audit_news_post_change()', 'execute')
    and not has_function_privilege('authenticated', 'public.audit_news_post_change()', 'execute'),
    'E7: la API no ejecuta la función del disparador');

  -- E6 · si el writer falla, la edición se revierte.
  update public.audit_entity_types set status = 'deprecated' where entity_type = 'news_post';
  perform pg_temp.assert_true(pg_temp.falla('authenticated', v_admin, format(
    'update public.news_posts set excerpt = %L where id = %L', 'TEXTO-BAJADA-SIN-BITACORA', v_post)) is not null,
    'E6: sin bitácora la edición falla');
  update public.audit_entity_types set status = 'active' where entity_type = 'news_post';
  perform pg_temp.assert_true(
    (select excerpt from public.news_posts where id = v_post) = 'TEXTO-BAJADA-VIEJA',
    'E6: la edición fallida no quedó escrita');

  -- E3 · retirar con motivo.
  perform pg_temp.como('authenticated', v_admin, format(
    'select public.news_retirar(%L, %L, %L)', v_post, 'dato_incorrecto', 'el tiempo estaba mal'));
  perform pg_temp.assert_true(pg_temp.eventos('news_post_withdrawn') = 1,
    'E3: retirar deja un news_post_withdrawn');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
     where event_type = 'news_post_withdrawn' and actor_id = v_admin
       and pg_catalog.to_jsonb(entity_audit_log) ->> 'reason' like '%dato_incorrecto%'),
    'E3: el retiro lleva el motivo y el actor');

  -- E5 · volver a publicar.
  perform pg_temp.como('authenticated', v_admin, format(
    'select public.news_volver_a_publicar(%L)', v_post));
  perform pg_temp.assert_true(pg_temp.eventos('news_post_republished') = 1,
    'E5: volver a publicar deja un news_post_republished');

  -- E4 · sacarla por otra vía: service_role, sin motivo.
  perform pg_temp.como('service_role', null, format(
    'update public.news_posts set published = false where id = %L', v_post));
  perform pg_temp.assert_true(pg_temp.eventos('news_post_withdrawn') = 2,
    'E4: despublicar por otra vía también deja news_post_withdrawn');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
     where event_type = 'news_post_withdrawn' and actor_type = 'system'
       and pg_catalog.to_jsonb(entity_audit_log) ->> 'reason' like '%motivo pendiente%'),
    'E4: sin motivo queda «motivo pendiente» y actor system');

  select count(*) into v_total from public.entity_audit_log where entity_type = 'news_post';
  perform pg_temp.assert_true(v_total = 4, 'el total de eventos news_post es exactamente 4');
end;
$contrato$;

select 'TEST 0532 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;

rollback;
