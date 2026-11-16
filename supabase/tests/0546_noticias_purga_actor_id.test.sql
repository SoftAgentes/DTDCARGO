\set ON_ERROR_STOP on

-- SDD-0611 §11.4.1 · contrato de la 0546: la purga de actor_id a los 12 meses.
--
-- Monta el mismo fixture que los contratos de la 0518, 0525 y 0526 (roles, auth,
-- tenants y las migraciones REALES de noticias 0053, 0055, 0057, 0140, 0518 y
-- 0525) y aplica la 0546 REAL. No usa el desarme: el control C4 del CI no copia
-- supabase/desarmes; su vuelta se ensaya solo en PGlite
-- (lib/news/autopublicar/__tests__/noticias-0546.migration.test.ts).
--
-- Lo que se protege:
--   F  frontera estricta: una fila de 13 meses queda sin uuid; una de 11 y una de
--      exactamente 12 no se tocan todavía (en las cuatro tablas);
--   R  el resto de cada fila no cambia y ninguna fila se borra (piso de conteo);
--   M  la marca de purga queda en la auditoría y en el log; el CHECK sigue
--      exigiendo persona a una fila NUEVA (manual sin uuid y sin marca es
--      rechazada; uuid y marca juntos, también);
--   P  solo service_role ejecuta la purga; es idempotente.
--
-- CONTROL ROJO: sin 0546 cae en la primera aserción.
-- Termina siempre en ROLLBACK. Solo ids y textos sintéticos.
begin;

do $roles$
begin
  if to_regclass('public.news_posts') is not null then
    raise exception 'Fixture 0546 rechazada: el objeto real ya existe';
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
  ('20000000-0000-4000-8000-000000000001'),  -- persona A
  ('20000000-0000-4000-8000-000000000002'),  -- persona B
  ('20000000-0000-4000-8000-000000000003');  -- persona C
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

grant all on public.news_posts, public.seo_drafts to service_role;
\ir ../migrations/0518_noticias_publicacion_automatica.sql
\ir ../migrations/0525_noticias_ajustes_antes_de_encender.sql

-- ── Filas de antes de la 0546, con edades relativas a now() (el de esta transacción) ──
-- 13 meses (vence), exactamente 12 (todavía no) y 11 (no). Las inserta el dueño.
insert into public.news_post_exits (tenant_id, post_id, slug, title, publish_via, kind, actor_id, created_at)
values
  ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'exit-13', 'Titular sintético 13', 'manual',
   'despublicada', '20000000-0000-4000-8000-000000000001', now() - interval '13 months'),
  ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'exit-12', 'Titular sintético 12', 'manual',
   'despublicada', '20000000-0000-4000-8000-000000000001', now() - interval '12 months'),
  ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 'exit-11', 'Titular sintético 11', 'automatica',
   'despublicada', '20000000-0000-4000-8000-000000000002', now() - interval '11 months'),
  -- Ya sin uuid (no cuenta como vaciada por la purga).
  ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004', 'exit-sin', 'Titular sintético sin', 'automatica',
   'despublicada', null, now() - interval '14 months');

insert into public.news_publication_audit
  (tenant_id, correlation_id, evaluated_at, via, decision, filters, actor_id)
values
  ('10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', now() - interval '13 months',
   'manual', 'retenida', '{}', '20000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', now() - interval '12 months',
   'manual', 'retenida', '{}', '20000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', now() - interval '11 months',
   'manual', 'retenida', '{}', '20000000-0000-4000-8000-000000000002'),
  -- Automática con uuid (la que pasa por una persona al avisar): también vence a los 13.
  ('10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004', now() - interval '13 months',
   'automatica', 'retenida', '{}', '20000000-0000-4000-8000-000000000003'),
  -- Automática sin persona, vieja: nada que vaciar.
  ('10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000005', now() - interval '20 months',
   'automatica', 'retenida', '{}', null);

insert into public.news_autopublish_settings_log (tenant_id, enabled, daily_cap, weekly_cap, changed_by, changed_at)
values
  ('10000000-0000-4000-8000-000000000001', true, 1, 2, '20000000-0000-4000-8000-000000000001', now() - interval '13 months'),
  ('10000000-0000-4000-8000-000000000001', false, 1, 2, '20000000-0000-4000-8000-000000000001', now() - interval '12 months'),
  ('10000000-0000-4000-8000-000000000001', true, 1, 2, '20000000-0000-4000-8000-000000000002', now() - interval '11 months');

insert into public.news_autopublish_settings (tenant_id, enabled, daily_cap, weekly_cap, updated_at, updated_by)
values
  ('10000000-0000-4000-8000-000000000001', false, 1, 2, now() - interval '13 months', '20000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002', false, 1, 2, now() - interval '11 months', '20000000-0000-4000-8000-000000000002');

-- Foto de cada fila ANTES de la 0546 (sin las columnas que la purga puede tocar).
create temporary table foto_antes (tabla text, id text, fila jsonb);
insert into foto_antes
  select 'exits', id::text, to_jsonb(t) - 'actor_id' from public.news_post_exits t
  union all select 'audit', id::text, to_jsonb(t) - 'actor_id' from public.news_publication_audit t
  union all select 'log', id::text, to_jsonb(t) - 'changed_by' from public.news_autopublish_settings_log t
  union all select 'settings', tenant_id::text, to_jsonb(t) - 'updated_by' from public.news_autopublish_settings t;

\ir ../migrations/0546_noticias_purga_actor_id.sql

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0546: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Ejecuta con un rol; devuelve el SQLSTATE o null si pasó.
create function pg_temp.falla(p_rol text, p_sql text) returns text language plpgsql as $$
begin
  execute format('set local role %I', p_rol);
  execute p_sql;
  reset role;
  return null;
exception when others then
  reset role;
  return sqlstate;
end;
$$;

-- La purga, como service_role (el cron). Devuelve lo que cuenta.
create function pg_temp.purgar() returns jsonb language plpgsql as $$
declare r jsonb;
begin
  set local role service_role;
  select public.news_purgar_actor_id() into r;
  reset role;
  return r;
exception when others then
  reset role;
  raise;
end;
$$;

-- ¿La fila entra? Corre la sentencia y deshace (sub-transacción); devuelve el SQLSTATE o null si entra.
create function pg_temp.entra(p_sql text) returns text language plpgsql as $$
begin
  begin
    execute p_sql;
    raise exception 'entro' using errcode = 'P9999';
  exception
    when sqlstate 'P9999' then return null;
    when others then return sqlstate;
  end;
end;
$$;

do $contrato$
declare
  t1 constant uuid := '10000000-0000-4000-8000-000000000001';
  t2 constant uuid := '10000000-0000-4000-8000-000000000002';
  v_r jsonb;
  v_r2 jsonb;
  v_resto integer;
begin
  -- ── Punto de partida (piso de conteo: ninguna aserción pasa sobre tablas vacías) ──
  perform pg_temp.assert_true((select count(*) from public.news_post_exits) = 4
    and (select count(*) from public.news_publication_audit) = 5
    and (select count(*) from public.news_autopublish_settings_log) = 3
    and (select count(*) from public.news_autopublish_settings) = 2, 'piso: las filas de partida están');
  perform pg_temp.assert_true((select count(*) from public.news_post_exits where actor_id is not null) = 3
    and (select count(*) from public.news_publication_audit where actor_id is not null) = 4
    and (select count(*) from public.news_autopublish_settings_log where changed_by is not null) = 3
    and (select count(*) from public.news_autopublish_settings where updated_by is not null) = 2,
    'piso: hay uuid que vaciar');

  -- ── P · quién ejecuta la purga ──
  perform pg_temp.assert_true(pg_temp.falla('anon', 'select public.news_purgar_actor_id()') = '42501',
    'P: anon no ejecuta la purga');
  perform pg_temp.assert_true(pg_temp.falla('authenticated', 'select public.news_purgar_actor_id()') = '42501',
    'P: authenticated no ejecuta la purga');
  -- Ni los datos cambiaron por los intentos.
  perform pg_temp.assert_true((select count(*) from public.news_post_exits where actor_id is not null) = 3,
    'P: los intentos rechazados no vaciaron nada');

  -- ── M · el CHECK sigue exigiendo persona a una fila NUEVA ──
  perform pg_temp.assert_true(pg_temp.entra(format(
    'insert into public.news_publication_audit (tenant_id, correlation_id, via, decision, filters, actor_id)
     values (%L, gen_random_uuid(), ''manual'', ''retenida'', ''{}'', null)', t1)) = '23514',
    'M: una fila manual nueva sin uuid y sin marca se rechaza');
  perform pg_temp.assert_true(pg_temp.entra(format(
    'insert into public.news_publication_audit (tenant_id, correlation_id, via, decision, filters, actor_id, actor_purged_at)
     values (%L, gen_random_uuid(), ''manual'', ''retenida'', ''{}'', %L, now())', t1,
    '20000000-0000-4000-8000-000000000001')) = '23514',
    'M: uuid y marca de purga a la vez se rechazan (auditoría)');
  perform pg_temp.assert_true(pg_temp.entra(format(
    'insert into public.news_publication_audit (tenant_id, correlation_id, via, decision, filters, actor_id, actor_purged_at)
     values (%L, gen_random_uuid(), ''manual'', ''retenida'', ''{}'', null, now())', t1)) is null,
    'M: una fila vaciada por la purga (sin uuid, con marca) sí es válida');
  perform pg_temp.assert_true(pg_temp.entra(format(
    'insert into public.news_autopublish_settings_log (tenant_id, enabled, daily_cap, weekly_cap, changed_by)
     values (%L, true, 1, 2, null)', t1)) = '23514',
    'M: una fila nueva del log sin uuid y sin marca se rechaza');
  perform pg_temp.assert_true(pg_temp.entra(format(
    'insert into public.news_autopublish_settings_log (tenant_id, enabled, daily_cap, weekly_cap, changed_by, changed_by_purged_at)
     values (%L, true, 1, 2, %L, now())', t1, '20000000-0000-4000-8000-000000000001')) = '23514',
    'M: uuid y marca a la vez se rechazan (log)');
  perform pg_temp.assert_true(pg_temp.entra(format(
    'insert into public.news_autopublish_settings_log (tenant_id, enabled, daily_cap, weekly_cap, changed_by, changed_by_purged_at)
     values (%L, true, 1, 2, null, now())', t1)) is null,
    'M: una fila del log vaciada por la purga es válida');

  -- ── F · la purga ──
  v_r := pg_temp.purgar();
  perform pg_temp.assert_true(v_r = jsonb_build_object(
    'news_post_exits', 1, 'news_publication_audit', 2,
    'news_autopublish_settings_log', 1, 'news_autopublish_settings', 1),
    'F: la purga cuenta exactamente lo vencido por tabla (' || v_r::text || ')');

  -- 13 meses: sin uuid.
  perform pg_temp.assert_true((select actor_id from public.news_post_exits where slug = 'exit-13') is null,
    'F: la salida de 13 meses queda sin uuid');
  perform pg_temp.assert_true((select actor_id is null and actor_purged_at is not null
      from public.news_publication_audit where correlation_id = '40000000-0000-4000-8000-000000000001'),
    'F: la auditoría manual de 13 meses queda sin uuid y con marca');
  perform pg_temp.assert_true((select actor_id is null and actor_purged_at is not null
      from public.news_publication_audit where correlation_id = '40000000-0000-4000-8000-000000000004'),
    'F: la auditoría automática con uuid de 13 meses también');
  perform pg_temp.assert_true((select count(*) from public.news_autopublish_settings_log
      where changed_by is null and changed_by_purged_at is not null and changed_at < now() - interval '12 months') = 1,
    'F: el log de 13 meses queda sin uuid y con marca');
  perform pg_temp.assert_true((select updated_by from public.news_autopublish_settings where tenant_id = t1) is null,
    'F: el interruptor de 13 meses queda sin updated_by');

  -- Exactamente 12 meses: todavía no (frontera estricta).
  perform pg_temp.assert_true((select actor_id is not null from public.news_post_exits where slug = 'exit-12'),
    'F: la salida de exactamente 12 meses no se toca todavía');
  perform pg_temp.assert_true((select actor_id is not null and actor_purged_at is null
      from public.news_publication_audit where correlation_id = '40000000-0000-4000-8000-000000000002'),
    'F: la auditoría de exactamente 12 meses no se toca todavía');
  perform pg_temp.assert_true((select changed_by is not null and changed_by_purged_at is null
      from public.news_autopublish_settings_log where changed_at = now() - interval '12 months'),
    'F: el log de exactamente 12 meses no se toca todavía');

  -- 11 meses: no se toca.
  perform pg_temp.assert_true((select actor_id is not null from public.news_post_exits where slug = 'exit-11'),
    'F: la salida de 11 meses no se toca');
  perform pg_temp.assert_true((select actor_id is not null from public.news_publication_audit
      where correlation_id = '40000000-0000-4000-8000-000000000003'),
    'F: la auditoría de 11 meses no se toca');
  perform pg_temp.assert_true((select changed_by is not null from public.news_autopublish_settings_log
      where changed_at = now() - interval '11 months'),
    'F: el log de 11 meses no se toca');
  perform pg_temp.assert_true((select updated_by is not null from public.news_autopublish_settings where tenant_id = t2),
    'F: el interruptor de 11 meses no se toca');

  -- ── R · el resto de la fila no cambia y no se borra nada ──
  perform pg_temp.assert_true((select count(*) from public.news_post_exits) = 4
    and (select count(*) from public.news_publication_audit) = 5
    and (select count(*) from public.news_autopublish_settings_log) = 3
    and (select count(*) from public.news_autopublish_settings) = 2, 'R: la purga no borra filas');
  select count(*) into v_resto from (
    select 'exits' as tabla, id::text as id, to_jsonb(t) - 'actor_id' as fila from public.news_post_exits t
    union all select 'audit', id::text, to_jsonb(t) - 'actor_id' - 'actor_purged_at' from public.news_publication_audit t
    union all select 'log', id::text, to_jsonb(t) - 'changed_by' - 'changed_by_purged_at' from public.news_autopublish_settings_log t
    union all select 'settings', tenant_id::text, to_jsonb(t) - 'updated_by' from public.news_autopublish_settings t
  ) d
  join foto_antes f on f.tabla = d.tabla and f.id = d.id
  where (f.fila - 'actor_purged_at' - 'changed_by_purged_at') = (d.fila - 'actor_purged_at' - 'changed_by_purged_at');
  perform pg_temp.assert_true(v_resto = 14, 'R: las 14 filas conservan todo menos el uuid y su marca (' || v_resto || ')');

  -- ── P · idempotente ──
  v_r2 := pg_temp.purgar();
  perform pg_temp.assert_true(v_r2 = jsonb_build_object(
    'news_post_exits', 0, 'news_publication_audit', 0,
    'news_autopublish_settings_log', 0, 'news_autopublish_settings', 0),
    'P: la segunda corrida no vacía nada');
end;
$contrato$;

select 'TEST 0546 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;

rollback;
