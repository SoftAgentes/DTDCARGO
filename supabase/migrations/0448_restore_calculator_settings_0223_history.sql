-- SDD-0440 · restaurar en el ledger el estado final de calculator_settings.
--
-- 0222 y 0223 se aplicaron históricamente fuera de banda: Producción tiene su
-- efecto, pero un branch creado desde el ledger conserva peso_max_kg y no crea
-- peso_max_envio_kg. Esta migración materializa ese mismo estado final mediante
-- DDL idempotente. En Producción no cambia valores; en un replay completa lo
-- que el ledger histórico no puede reconstruir.

do $preflight$
begin
  if to_regclass('public.calculator_settings') is null
     or to_regclass('public.tenants') is null then
    raise exception '0448 requiere public.calculator_settings y public.tenants';
  end if;

  -- El nombre pertenece al CHECK de esta migración. No retirar por accidente
  -- una PK, UNIQUE o FK si un schema divergente lo reutilizó para otro objeto.
  if exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.calculator_settings'::regclass
      and conname = 'calculator_settings_peso_max_envio_kg_check'
      and contype <> 'c'
  ) then
    raise exception '0448 abortado: el constraint de peso máximo existe y no es CHECK';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_attribute attribute
    where attribute.attrelid = 'public.calculator_settings'::regclass
      and attribute.attname = 'peso_max_envio_kg'
      and not attribute.attisdropped
      and attribute.atttypid <> 'numeric'::regtype
  ) then
    raise exception '0448 abortado: peso_max_envio_kg existe con un tipo distinto de numeric';
  end if;

  if exists (
    select 1
    from public.calculator_settings
    where peso_max_envio_kg <= 0
  ) then
    raise exception '0448 abortado: peso_max_envio_kg contiene valores no positivos';
  end if;
exception
  when undefined_column then
    null;
end;
$preflight$;

-- La firma histórica puede depender de peso_max_kg; se retira antes de tocar
-- la columna para que el mismo SQL funcione sobre Producción y sobre replay.
drop function if exists public.public_calculator_config();

alter table public.calculator_settings
  drop constraint if exists calculator_settings_peso_max_gte_incluido;

alter table public.calculator_settings
  drop column if exists peso_max_kg;

alter table public.calculator_settings
  add column if not exists peso_max_envio_kg numeric not null default 9000;

alter table public.calculator_settings
  alter column peso_max_envio_kg set default 9000,
  alter column peso_max_envio_kg set not null;

-- Reparación determinista del CHECK que pertenece a 0223/0448: el nombre no
-- demuestra ni su expresión ni que esté validado. Recrearlo valida las filas
-- existentes y elimina el falso verde de CHECK(true) o NOT VALID. No se tocan
-- los demás constraints. Ejecutar el archivo completo en una sola transacción.
alter table public.calculator_settings
  drop constraint if exists calculator_settings_peso_max_envio_kg_check;

alter table public.calculator_settings
  add constraint calculator_settings_peso_max_envio_kg_check
  check (peso_max_envio_kg > 0);

create function public.public_calculator_config()
returns table(
  peso_incluido_kg numeric,
  recargo_excedente_kg numeric,
  peso_max_envio_kg numeric,
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
    settings.recargo_excedente_kg,
    settings.peso_max_envio_kg,
    settings.descuento_valencia,
    settings.recargo_embalaje_especial,
    settings.recargo_bateria_mult,
    settings.threshold_casco_km,
    settings.tarifa_km_fuera_casco,
    settings.cbm_max_contenedor,
    settings.peso_max_contenedor_kg
  from public.calculator_settings as settings
  join public.tenants as tenant on tenant.id = settings.tenant_id
  where tenant.slug = 'dtd'
  limit 1;
$function$;

-- Excepción intencional de Advisors 0028/0029: ésta es la API anónima de la
-- calculadora pública y devuelve sólo diez escalares, sin tenant_id ni PII.
revoke all on function public.public_calculator_config() from public;
grant execute on function public.public_calculator_config() to anon, authenticated;

comment on function public.public_calculator_config() is
  'Configuración pública mínima de la calculadora DTD; replay 0222/0223 recuperado por 0448.';

do $postflight$
begin
  if exists (
    select 1
    from pg_catalog.pg_attribute attribute
    where attribute.attrelid = 'public.calculator_settings'::regclass
      and attribute.attname = 'peso_max_kg'
      and not attribute.attisdropped
  ) then
    raise exception '0448 falló: peso_max_kg sigue presente';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_attribute attribute
    where attribute.attrelid = 'public.calculator_settings'::regclass
      and attribute.attname = 'peso_max_envio_kg'
      and not attribute.attisdropped
      and attribute.atttypid = 'numeric'::regtype
      and attribute.attnotnull
  ) then
    raise exception '0448 falló: peso_max_envio_kg no quedó numeric NOT NULL';
  end if;

  if to_regprocedure('public.public_calculator_config()') is null then
    raise exception '0448 falló: public_calculator_config() no existe';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.calculator_settings'::regclass
      and conname = 'calculator_settings_peso_max_envio_kg_check'
      and contype = 'c' and convalidated
  ) then
    raise exception '0448 falló: el CHECK de peso máximo no quedó validado';
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
    raise exception '0448 falló: PUBLIC conserva EXECUTE sobre public_calculator_config()';
  end if;
end;
$postflight$;
