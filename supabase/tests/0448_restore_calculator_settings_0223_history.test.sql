-- TEST 0448 · el replay converge al estado final de 0222/0223.
--
-- Parte del estado que realmente produjo el ledger: calculator_settings aún
-- tiene peso_max_kg y no conoce peso_max_envio_kg. Aplica el artefacto real dos
-- veces y comprueba schema, datos, firma pública y privilegios.
\set ON_ERROR_STOP on

begin;

do $roles$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'authenticated'
  ) then
    create role authenticated nologin;
  end if;
end;
$roles$;

create table public.tenants (
  id uuid primary key,
  slug text not null unique
);

create table public.calculator_settings (
  tenant_id uuid primary key references public.tenants(id),
  peso_incluido_kg numeric not null default 500,
  peso_max_kg numeric not null default 600,
  recargo_excedente_kg numeric not null default 1,
  descuento_valencia numeric not null default 50,
  recargo_embalaje_especial numeric not null default 50,
  recargo_bateria_mult numeric not null default 1.5,
  threshold_casco_km numeric not null default 200,
  tarifa_km_fuera_casco numeric not null default 1,
  cbm_max_contenedor numeric not null default 68,
  peso_max_contenedor_kg numeric not null default 27000,
  constraint calculator_settings_peso_max_gte_incluido
    check (peso_max_kg >= peso_incluido_kg)
);

insert into public.tenants (id, slug)
values ('04480000-0000-4000-8000-000000000001', 'dtd');

insert into public.calculator_settings (tenant_id)
values ('04480000-0000-4000-8000-000000000001');

create function public.public_calculator_config()
returns table(
  peso_incluido_kg numeric,
  peso_max_kg numeric,
  recargo_excedente_kg numeric,
  descuento_valencia numeric,
  recargo_embalaje_especial numeric,
  recargo_bateria_mult numeric,
  threshold_casco_km numeric,
  tarifa_km_fuera_casco numeric,
  cbm_max_contenedor numeric,
  peso_max_contenedor_kg numeric
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    settings.peso_incluido_kg,
    settings.peso_max_kg,
    settings.recargo_excedente_kg,
    settings.descuento_valencia,
    settings.recargo_embalaje_especial,
    settings.recargo_bateria_mult,
    settings.threshold_casco_km,
    settings.tarifa_km_fuera_casco,
    settings.cbm_max_contenedor,
    settings.peso_max_contenedor_kg
  from public.calculator_settings as settings;
$function$;

\ir ../migrations/0448_restore_calculator_settings_0223_history.sql

do $first_replay$
begin
  if (
    select peso_max_envio_kg
    from public.calculator_settings
    where tenant_id = '04480000-0000-4000-8000-000000000001'
  ) <> 9000 then
    raise exception 'TEST 0448: el replay no pobló el default histórico 9000';
  end if;
end;
$first_replay$;

update public.calculator_settings
set peso_max_envio_kg = 7777
where tenant_id = '04480000-0000-4000-8000-000000000001';

\ir ../migrations/0448_restore_calculator_settings_0223_history.sql

do $contract$
declare
  v_config record;
  v_default text;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calculator_settings'
      and column_name = 'peso_max_kg'
  ) then
    raise exception 'TEST 0448: replay conservó peso_max_kg';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calculator_settings'
      and column_name = 'peso_max_envio_kg'
      and data_type = 'numeric'
      and is_nullable = 'NO'
  ) then
    raise exception 'TEST 0448: falta peso_max_envio_kg numeric NOT NULL';
  end if;

  select column_default
    into v_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'calculator_settings'
    and column_name = 'peso_max_envio_kg';

  if v_default is null or v_default not like '%9000%' then
    raise exception 'TEST 0448: default inesperado para peso_max_envio_kg: %', v_default;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.calculator_settings'::regclass
      and constraint_row.conname = 'calculator_settings_peso_max_envio_kg_check'
      and constraint_row.contype = 'c'
  ) then
    raise exception 'TEST 0448: falta el CHECK positivo canónico';
  end if;

  if (
    select peso_max_envio_kg
    from public.calculator_settings
    where tenant_id = '04480000-0000-4000-8000-000000000001'
  ) <> 7777 then
    raise exception 'TEST 0448: la segunda ejecución pisó un valor existente';
  end if;

  select * into v_config from public.public_calculator_config();
  if v_config.peso_incluido_kg <> 500
     or v_config.recargo_excedente_kg <> 1
     or v_config.peso_max_envio_kg <> 7777
     or v_config.descuento_valencia <> 50
     or v_config.recargo_embalaje_especial <> 50
     or v_config.recargo_bateria_mult <> 1.5
     or v_config.threshold_casco_km <> 200
     or v_config.tarifa_km_fuera_casco <> 1
     or v_config.cbm_max_contenedor <> 68
     or v_config.peso_max_contenedor_kg <> 27000 then
    raise exception 'TEST 0448: retorno RPC incorrecto';
  end if;

  if not pg_catalog.has_function_privilege(
    'anon', 'public.public_calculator_config()', 'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'authenticated', 'public.public_calculator_config()', 'EXECUTE'
  ) then
    raise exception 'TEST 0448: grants explícitos incompletos';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    where procedure_row.oid = 'public.public_calculator_config()'::regprocedure
      and procedure_row.prosecdef
      and procedure_row.provolatile = 's'
      and procedure_row.proconfig @> array['search_path=public']
  ) then
    raise exception 'TEST 0448: RPC perdió estabilidad o search_path fijo';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        procedure_row.proacl,
        pg_catalog.acldefault('f', procedure_row.proowner)
      )
    ) acl
    where procedure_row.oid = 'public.public_calculator_config()'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'TEST 0448: PUBLIC conserva EXECUTE';
  end if;
end;
$contract$;

rollback;

select to_regclass('public.calculator_settings') is null
  and to_regclass('public.tenants') is null
  and to_regprocedure('public.public_calculator_config()') is null
  as replay_0223_fixture_rolled_back;
