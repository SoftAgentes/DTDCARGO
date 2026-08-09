\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0354. Fixtures ficticios y rollback: no toca prod.
--
-- Lo que defiende, que es exactamente lo que puede romperse en silencio:
--   1. la RLS queda ACTIVA (sin ella la tabla de secretos sería legible por
--      cualquiera con la anon key),
--   2. `authenticated` NO tiene política y NO puede leer los tokens — este es
--      el contrato central: el secreto sólo lo ve el servidor,
--   3. `anon` tampoco,
--   4. `service_role` SI puede operar (sin su política explícita el flujo entero
--      se cae en silencio — gap conocido del repo),
--   5. el token unico no admite duplicados,
--   6. un token demasiado corto es rechazado (evita que un bug de generacion
--      meta un secreto adivinable),
--   7. borrar el usuario se lleva sus tokens (no quedan enlaces vivos de una
--      persona que ya no existe).

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema auth;
create table auth.users (id uuid primary key);

create table public.tenants (id uuid primary key);

\ir ../migrations/0354_studio_access_tokens.sql

insert into public.tenants values ('11111111-1111-1111-1111-111111111111');
insert into auth.users values ('22222222-2222-2222-2222-222222222222');
insert into auth.users values ('33333333-3333-3333-3333-333333333333');

-- ── 1. RLS activa ──────────────────────────────────────────────────────────
do $t1$
begin
  if not exists (
    select 1 from pg_tables
    where schemaname='public' and tablename='studio_access_tokens' and rowsecurity
  ) then
    raise exception 'La RLS no quedo activa sobre studio_access_tokens';
  end if;
end;
$t1$;

-- ── 2 + 3. Ni authenticated ni anon pueden leer el secreto ─────────────────
do $t2$
begin
  if has_table_privilege('authenticated', 'public.studio_access_tokens', 'SELECT') then
    raise exception 'authenticated puede leer los tokens de acceso';
  end if;
  if has_table_privilege('anon', 'public.studio_access_tokens', 'SELECT') then
    raise exception 'anon puede leer los tokens de acceso';
  end if;
  if has_table_privilege('authenticated', 'public.studio_access_tokens', 'INSERT') then
    raise exception 'authenticated puede crear tokens de acceso';
  end if;
  -- Y no debe existir politica alguna que se los abra por la puerta de atras.
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='studio_access_tokens'
      and ('authenticated' = any(roles) or 'anon' = any(roles) or 'public' = any(roles))
  ) then
    raise exception 'Hay una politica que expone los tokens a un rol no privilegiado';
  end if;
end;
$t2$;

-- ── 4. service_role SI opera ───────────────────────────────────────────────
do $t3$
begin
  if not has_table_privilege('service_role', 'public.studio_access_tokens', 'SELECT') then
    raise exception 'service_role no puede leer — el flujo se caeria en silencio';
  end if;
  if not has_table_privilege('service_role', 'public.studio_access_tokens', 'INSERT') then
    raise exception 'service_role no puede insertar';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='studio_access_tokens'
      and 'service_role' = any(roles)
  ) then
    raise exception 'Falta la politica de service_role (gap force_rls)';
  end if;
end;
$t3$;

-- ── 5 + 6. Unicidad y largo minimo del secreto ─────────────────────────────
do $t4$
declare ok boolean;
begin
  insert into public.studio_access_tokens
    (tenant_id, user_id, token, created_by, expires_at)
  values (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    repeat('a', 48),
    '33333333-3333-3333-3333-333333333333',
    now() + interval '7 days'
  );

  ok := false;
  begin
    insert into public.studio_access_tokens
      (tenant_id, user_id, token, created_by, expires_at)
    values (
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      repeat('a', 48),
      '33333333-3333-3333-3333-333333333333',
      now() + interval '7 days'
    );
  exception when unique_violation then ok := true;
  end;
  if not ok then raise exception 'Se acepto un token duplicado'; end if;

  ok := false;
  begin
    insert into public.studio_access_tokens
      (tenant_id, user_id, token, created_by, expires_at)
    values (
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      'corto',
      '33333333-3333-3333-3333-333333333333',
      now() + interval '7 days'
    );
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'Se acepto un token demasiado corto'; end if;
end;
$t4$;

-- ── 7. Borrar el usuario se lleva sus enlaces ──────────────────────────────
do $t5$
declare n int;
begin
  delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
  select count(*) into n from public.studio_access_tokens
   where user_id = '22222222-2222-2222-2222-222222222222';
  if n <> 0 then
    raise exception 'Quedaron % enlaces vivos de un usuario borrado', n;
  end if;
end;
$t5$;

rollback;
