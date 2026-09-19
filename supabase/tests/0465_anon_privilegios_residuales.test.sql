\set ON_ERROR_STOP on
-- SDD-0485 · Contrato de la migración 0465: anon y authenticated pierden
-- MAINTAIN, REFERENCES y TRIGGER sobre las tablas y vistas de public.
-- Fixture sintético y rollback: no toca producción.
--
-- POR QUÉ EL FIXTURE SE ENSUCIA A PROPÓSITO. Un schema reconstruido desde el
-- repo sale limpio: el residuo viene de los default privileges que Supabase
-- tenía antes de 0263, y eso no vive en ninguna migración. Un contrato que sólo
-- afirmara «anon no tiene TRIGGER» pasaría en verde sin medir nada. Por eso el
-- fixture reproduce el estado que el Director leyó en producción el 2026-09-18
-- y el CONTROL 0 falla si ese residuo no quedó puesto.
--
-- QUÉ SE PROTEGE
--   0. Control positivo: el fixture tiene el residuo.
--   1. anon y authenticated quedan sin MAINTAIN, REFERENCES ni TRIGGER.
--   2. anon lee exactamente las 5 tablas públicas y nada más.
--   3. Todo lo demás queda igual: DML de authenticated, privilegios por columna,
--      service_role, la secuencia y el SELECT de authenticated en user_tenants
--      que exige el preflight de 0422.
--   4. Aplicarla dos veces no cambia nada.
--   5. Una tabla nueva nace sin privilegios para anon ni authenticated.

begin;

do $fixture_guard$
begin
  if to_regclass('public.back_glosario') is not null
     or to_regclass('public.user_tenants') is not null then
    raise exception 'Fixture 0465 rechazada: la base ya contiene tablas del producto';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$fixture_guard$;

grant usage on schema public to anon, authenticated, service_role;

-- Default de postgres como en producción desde 0263: sólo service_role.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on tables to service_role;

-- ── Las 5 tablas que anon lee, con RLS y su policy ───────────
create table public.back_glosario (id int primary key, is_published boolean not null default false);
create table public.back_noticias (id int primary key, is_published boolean not null default false);
create table public.back_servicios (id int primary key, is_published boolean not null default false);
create table public.news_posts (id int primary key, published boolean not null default false);
create table public.ve_locality_catalog (id int primary key, city text, state_name text);

alter table public.back_glosario enable row level security;
alter table public.back_noticias enable row level security;
alter table public.back_servicios enable row level security;
alter table public.news_posts enable row level security;
alter table public.ve_locality_catalog enable row level security;

create policy back_glosario_anon on public.back_glosario for select to anon using (is_published);
create policy back_noticias_anon on public.back_noticias for select to anon using (is_published);
create policy back_servicios_anon on public.back_servicios for select to anon using (is_published);
create policy news_posts_public_select on public.news_posts for select using (published);
create policy ve_locality_catalog_read on public.ve_locality_catalog for select to anon, authenticated using (true);

grant select on public.back_glosario, public.back_noticias, public.back_servicios,
  public.news_posts, public.ve_locality_catalog to anon, authenticated;
grant insert, update, delete on public.back_glosario, public.back_noticias,
  public.back_servicios, public.news_posts to authenticated;

-- ── Tablas de negocio con el residuo, como las 179 de producción ──
create table public.user_tenants (user_id uuid, tenant_id uuid, role text, primary key (user_id, tenant_id));
create table public.invoices (id int primary key, total numeric);
create table public.mail_logs (id int primary key, destinatario text);
create table public.perfil_columnas (id int primary key, nombre text, telefono text, secreto text);
create table public.privada (id int primary key);

alter table public.user_tenants enable row level security;
alter table public.invoices enable row level security;
alter table public.mail_logs enable row level security;
alter table public.perfil_columnas enable row level security;
alter table public.privada enable row level security;

grant select on public.user_tenants, public.mail_logs to authenticated;
grant select, insert, update on public.invoices to authenticated;
grant select on public.perfil_columnas to authenticated;
-- Privilegios por columna, como los 7 UPDATE de producción.
grant update (nombre, telefono) on public.perfil_columnas to authenticated;
-- REFERENCES por columna: producción no tiene, pero si aparece, PostgreSQL lo
-- retira junto con el de tabla y la migración tiene que aceptarlo.
grant references (id) on public.privada to authenticated;

-- ── Vista INVOKER con el residuo, como la de producción ──────
create view public.vista_invoker with (security_invoker = true) as
  select id, total from public.invoices;
grant select on public.vista_invoker to authenticated;

-- ── Tabla creada después de 0263: nunca tuvo residuo ─────────
create table public.tabla_nueva (id int primary key);
alter table public.tabla_nueva enable row level security;
grant select on public.tabla_nueva to authenticated;

-- ── Secuencia: fuera del alcance, tiene que quedar igual ─────
create sequence public.secuencia_prueba;
grant usage, select on sequence public.secuencia_prueba to authenticated;

-- ── El residuo: lo que dejaron los defaults de Supabase antes de 0263 ──
grant maintain, references, trigger on
  public.back_glosario, public.back_noticias, public.back_servicios,
  public.news_posts, public.ve_locality_catalog,
  public.user_tenants, public.invoices, public.mail_logs,
  public.perfil_columnas, public.privada, public.vista_invoker
  to anon, authenticated;

-- ── 0 · Control positivo ─────────────────────────────────────
do $control$
begin
  if not has_table_privilege('anon', 'public.invoices', 'MAINTAIN')
     or not has_table_privilege('anon', 'public.mail_logs', 'REFERENCES')
     or not has_table_privilege('anon', 'public.vista_invoker', 'TRIGGER')
     or not has_table_privilege('authenticated', 'public.privada', 'TRIGGER')
     or not has_table_privilege('authenticated', 'public.user_tenants', 'MAINTAIN') then
    raise exception
      'CONTROL 0 ROTO: el fixture no tiene el residuo de producción, así que el '
      'resto del contrato no probaría nada';
  end if;
end
$control$;

-- La foto de todo lo que NO se tiene que mover.
create temporary table acl_0465_intacto as
select c.relname::text as rel, coalesce(g.rolname, 'PUBLIC') as rol, a.privilege_type as priv
from pg_class c
cross join lateral aclexplode(c.relacl) a
left join pg_roles g on g.oid = a.grantee
where c.relnamespace = 'public'::regnamespace
  and not (coalesce(g.rolname, '') in ('anon', 'authenticated')
           and a.privilege_type in ('MAINTAIN', 'REFERENCES', 'TRIGGER'));

create temporary table acl_0465_columnas as
select c.relname::text as rel, at.attname::text as col, coalesce(g.rolname, 'PUBLIC') as rol,
       a.privilege_type as priv
from pg_attribute at
join pg_class c on c.oid = at.attrelid
cross join lateral aclexplode(at.attacl) a
left join pg_roles g on g.oid = a.grantee
where c.relnamespace = 'public'::regnamespace and at.attacl is not null
  and not (coalesce(g.rolname, '') in ('anon', 'authenticated') and a.privilege_type = 'REFERENCES');

\ir ../migrations/0465_anon_privilegios_residuales.sql

-- ── 1 · Sin MAINTAIN, REFERENCES ni TRIGGER ──────────────────
do $contrato_1$
declare v_quedan text;
begin
  select string_agg(c.relname || ':' || r.rol, ', ')
    into v_quedan
  from pg_class c
  cross join (values ('anon'), ('authenticated')) r(rol)
  where c.relnamespace = 'public'::regnamespace
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and (has_table_privilege(r.rol, c.oid, 'MAINTAIN, REFERENCES, TRIGGER')
         or has_any_column_privilege(r.rol, c.oid, 'REFERENCES'));
  if v_quedan is not null then
    raise exception 'CONTRATO 1 ROTO: quedan MAINTAIN/REFERENCES/TRIGGER en %', v_quedan;
  end if;
end
$contrato_1$;

-- ── 2 · anon lee exactamente las 5 tablas públicas ───────────
do $contrato_2$
declare v_lee text[];
begin
  select array_agg(c.relname::text order by c.relname::text)
    into v_lee
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and has_table_privilege('anon', c.oid, 'SELECT');
  if v_lee is distinct from array['back_glosario', 'back_noticias', 'back_servicios',
                                  'news_posts', 've_locality_catalog'] then
    raise exception 'CONTRATO 2 ROTO: anon lee %', v_lee;
  end if;
  if has_table_privilege('anon', 'public.invoices', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') then
    raise exception 'CONTRATO 2 ROTO: anon alcanzó invoices';
  end if;
end
$contrato_2$;

-- ── 3 · Todo lo demás queda igual ────────────────────────────
do $contrato_3$
declare v_diferencia bigint;
begin
  select count(*) into v_diferencia from (
    (select * from acl_0465_intacto
     except
     select c.relname::text, coalesce(g.rolname, 'PUBLIC'), a.privilege_type
     from pg_class c
     cross join lateral aclexplode(c.relacl) a
     left join pg_roles g on g.oid = a.grantee
     where c.relnamespace = 'public'::regnamespace)
    union all
    (select c.relname::text, coalesce(g.rolname, 'PUBLIC'), a.privilege_type
     from pg_class c
     cross join lateral aclexplode(c.relacl) a
     left join pg_roles g on g.oid = a.grantee
     where c.relnamespace = 'public'::regnamespace
     except
     select * from acl_0465_intacto)
  ) d;
  if v_diferencia <> 0 then
    raise exception 'CONTRATO 3 ROTO: cambiaron % privilegios que no eran objetivo', v_diferencia;
  end if;

  select count(*) into v_diferencia from (
    (select * from acl_0465_columnas
     except
     select c.relname::text, at.attname::text, coalesce(g.rolname, 'PUBLIC'), a.privilege_type
     from pg_attribute at
     join pg_class c on c.oid = at.attrelid
     cross join lateral aclexplode(at.attacl) a
     left join pg_roles g on g.oid = a.grantee
     where c.relnamespace = 'public'::regnamespace and at.attacl is not null)
    union all
    (select c.relname::text, at.attname::text, coalesce(g.rolname, 'PUBLIC'), a.privilege_type
     from pg_attribute at
     join pg_class c on c.oid = at.attrelid
     cross join lateral aclexplode(at.attacl) a
     left join pg_roles g on g.oid = a.grantee
     where c.relnamespace = 'public'::regnamespace and at.attacl is not null
     except
     select * from acl_0465_columnas)
  ) d;
  if v_diferencia <> 0 then
    raise exception 'CONTRATO 3 ROTO: cambiaron % privilegios por columna', v_diferencia;
  end if;

  if not has_table_privilege('authenticated', 'public.user_tenants', 'SELECT') then
    raise exception 'CONTRATO 3 ROTO: authenticated perdió SELECT en user_tenants y 0422 abortaría';
  end if;
  if not has_table_privilege('authenticated', 'public.invoices', 'SELECT')
     or not has_table_privilege('authenticated', 'public.invoices', 'INSERT')
     or not has_table_privilege('authenticated', 'public.invoices', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.perfil_columnas', 'telefono', 'UPDATE')
     or has_column_privilege('authenticated', 'public.perfil_columnas', 'secreto', 'UPDATE') then
    raise exception 'CONTRATO 3 ROTO: el Studio perdió o ganó DML sobre invoices o perfil_columnas';
  end if;
  if not has_table_privilege('service_role', 'public.invoices', 'MAINTAIN, REFERENCES, TRIGGER, TRUNCATE') then
    raise exception 'CONTRATO 3 ROTO: service_role perdió privilegios';
  end if;
end
$contrato_3$;

-- ── 4 · Idempotente ──────────────────────────────────────────
create temporary table acl_0465_despues as
select c.oid, c.relacl::text as acl from pg_class c
where c.relnamespace = 'public'::regnamespace;

\ir ../migrations/0465_anon_privilegios_residuales.sql

do $contrato_4$
begin
  if exists (
    select 1 from acl_0465_despues d
    join pg_class c on c.oid = d.oid
    where c.relacl::text is distinct from d.acl
  ) then
    raise exception 'CONTRATO 4 ROTO: la segunda aplicación cambió ACL';
  end if;
end
$contrato_4$;

-- ── 5 · Una tabla nueva nace sin privilegios para anon ni authenticated ──
create table public.tabla_posterior (id int primary key);

do $contrato_5$
begin
  if has_table_privilege('anon', 'public.tabla_posterior', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN')
     or has_table_privilege('authenticated', 'public.tabla_posterior', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN') then
    raise exception 'CONTRATO 5 ROTO: una tabla nueva nació con privilegios para anon o authenticated';
  end if;
end
$contrato_5$;

rollback;

select to_regclass('public.back_glosario') is null
   and to_regclass('public.tabla_posterior') is null as fixture_0465_revertido;
