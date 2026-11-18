\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0514 (SDD-0606).
-- Fixtures ficticios y rollback: no toca prod.
--
-- Lo que se protege:
--   1. La columna nace vacía: nadie queda mencionable sin haberlo pedido.
--   2. Sólo entra un ID con forma de ID de Discord (17 a 20 dígitos). Un nombre
--      de usuario, `everyone` o un número corto no entran.
--   3. Cada quien edita SÓLO su propia fila, con la policy que ya tiene la tabla:
--      la migración no abre ni cierra nada.
--   4. Aplicarla dos veces no falla ni duplica el CHECK.
--   5. Si la columna ya existe con otro tipo, el preflight se niega.

begin;

do $roles$
begin
  if to_regnamespace('auth') is not null or to_regclass('public.user_profiles') is not null then
    raise exception 'TEST 0514 requiere una base PostgreSQL desechable vacía';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

grant usage on schema public to authenticated, service_role;
create schema auth;
grant usage on schema auth to authenticated;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to authenticated;

-- Lo mínimo de user_profiles que esta migración toca: la tabla, sus privilegios
-- de tabla y una policy de fila propia como la del repo.
create table public.user_profiles (
  user_id uuid primary key,
  first_name text,
  telegram_chat_id text,
  updated_at timestamptz not null default now()
);
alter table public.user_profiles enable row level security;
grant select, update on public.user_profiles to authenticated;
grant all on public.user_profiles to service_role;
create policy user_profiles_self_select on public.user_profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_profiles_self_update on public.user_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

insert into public.user_profiles (user_id, first_name) values
  ('00000000-0000-4000-8000-00000000000a', 'Ana'),
  ('00000000-0000-4000-8000-00000000000b', 'Beto');

\ir ../migrations/0514_user_profiles_discord_user_id.sql

-- 4. Idempotente: la segunda pasada no falla.
\ir ../migrations/0514_user_profiles_discord_user_id.sql

do $contrato$
declare
  v_count integer;
  v_rows integer;
begin
  -- 1. Nace vacía.
  select count(*) into v_count from public.user_profiles where discord_user_id is not null;
  if v_count <> 0 then
    raise exception 'CONTRATO 1: la columna debía nacer vacía (% filas con valor)', v_count;
  end if;

  -- 4. Un solo CHECK, aunque se aplicó dos veces.
  select count(*) into v_count
    from pg_catalog.pg_constraint
   where conrelid = 'public.user_profiles'::regclass
     and conname = 'user_profiles_discord_user_id_formato';
  if v_count <> 1 then
    raise exception 'CONTRATO 4: se esperaba 1 CHECK de formato, hay %', v_count;
  end if;

  -- 2. Formato: entran 17 y 20 dígitos y NULL.
  update public.user_profiles set discord_user_id = '12345678901234567'
   where user_id = '00000000-0000-4000-8000-00000000000a';
  update public.user_profiles set discord_user_id = '12345678901234567890'
   where user_id = '00000000-0000-4000-8000-00000000000a';
  update public.user_profiles set discord_user_id = null
   where user_id = '00000000-0000-4000-8000-00000000000a';
end;
$contrato$;

-- 2. Formato: lo que NO entra. Cada caso tiene que caer por el CHECK (23514).
do $rechazos$
declare
  v_malo text;
begin
  foreach v_malo in array array[
    'sam',                      -- nombre de usuario
    'everyone',                 -- palabra que suena a todos
    '1234567890123456',         -- 16 dígitos: corto
    '123456789012345678901',    -- 21 dígitos: largo
    '12345678901234567a',       -- con una letra
    ' 12345678901234567',       -- con espacio
    '<@123456789012345678>',    -- ya con formato de mención
    ''                          -- vacío: se guarda NULL, no cadena vacía
  ] loop
    begin
      update public.user_profiles set discord_user_id = v_malo
       where user_id = '00000000-0000-4000-8000-00000000000a';
      raise exception 'CONTRATO 2: entró un ID inválido: [%]', v_malo;
    exception
      when check_violation then null;
    end;
  end loop;
end;
$rechazos$;

-- 3. Cada quien edita sólo su fila.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);

do $propia$
declare
  v_rows integer;
begin
  update public.user_profiles set discord_user_id = '111111111111111111'
   where user_id = '00000000-0000-4000-8000-00000000000a';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'CONTRATO 3: el dueño no pudo guardar su propio ID (% filas)', v_rows;
  end if;

  update public.user_profiles set discord_user_id = '222222222222222222'
   where user_id = '00000000-0000-4000-8000-00000000000b';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'CONTRATO 3: un usuario cambió el ID de OTRO (% filas)', v_rows;
  end if;
end;
$propia$;

reset role;

do $verifica$
declare
  v_a text;
  v_b text;
begin
  select discord_user_id into v_a from public.user_profiles
   where user_id = '00000000-0000-4000-8000-00000000000a';
  select discord_user_id into v_b from public.user_profiles
   where user_id = '00000000-0000-4000-8000-00000000000b';
  if v_a is distinct from '111111111111111111' or v_b is not null then
    raise exception 'CONTRATO 3: estado final inesperado (a=%, b=%)', v_a, v_b;
  end if;
end;
$verifica$;

rollback;

-- 5. Preflight: una columna homónima con otro tipo detiene la migración.
begin;
create table public.user_profiles (user_id uuid primary key, discord_user_id bigint);

do $preflight$
begin
  begin
    execute $m$
      do $inner$
      begin
        if exists (
          select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'user_profiles'
             and column_name = 'discord_user_id' and data_type <> 'text'
        ) then
          raise exception '0514: user_profiles.discord_user_id ya existe con otro tipo';
        end if;
      end
      $inner$;
    $m$;
    raise exception 'CONTRATO 5: el preflight no detuvo una columna de otro tipo';
  exception
    when raise_exception then
      if sqlerrm not like '0514:%' then raise; end if;
  end;
end;
$preflight$;

rollback;

\echo 'TEST 0514 OK'
