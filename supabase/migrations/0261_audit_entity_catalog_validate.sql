-- ─────────────────────────────────────────────────────────────
-- 0261 · SDD-0166 Corte A2 · Validación de catálogo auditable
--
-- Alcance A2:
--   1. comprobar que A1 existe con su forma aprobada;
--   2. abortar si hay tipos huérfanos o drift de constraints;
--   3. validar entity_audit_log_entity_type_fkey;
--   4. retirar el CHECK regresivo solo después de validar la FK.
--
-- Deliberadamente NO hace en A2:
--   · cambiar grants, RLS, policies o Realtime;
--   · cambiar viewer, writers, payloads o filas históricas;
--   · añadir tipos de dominio futuros como comment;
--   · ejecutar los Cortes B, C, D o E.
--
-- REVISIÓN LOCAL SOLAMENTE. NO AUTORIZADA PARA CLOUD.
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

-- ── 0. Preflight fail-closed ──────────────────────────────────

do $$
declare
  v_entity_type_attnum smallint;
  v_catalog_entity_type_attnum smallint;
  v_orphan_count bigint;
begin
  if to_regclass('public.entity_audit_log') is null then
    raise exception 'A2 requiere public.entity_audit_log';
  end if;

  if to_regclass('public.audit_entity_types') is null then
    raise exception 'A2 requiere public.audit_entity_types creado por A1';
  end if;

  select attnum::smallint
    into v_entity_type_attnum
  from pg_attribute
  where attrelid = 'public.entity_audit_log'::regclass
    and attname = 'entity_type'
    and not attisdropped;

  if v_entity_type_attnum is null then
    raise exception 'A2 requiere entity_audit_log.entity_type';
  end if;

  select attnum::smallint
    into v_catalog_entity_type_attnum
  from pg_attribute
  where attrelid = 'public.audit_entity_types'::regclass
    and attname = 'entity_type'
    and not attisdropped;

  if v_catalog_entity_type_attnum is null then
    raise exception 'A2 requiere audit_entity_types.entity_type';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and confrelid = 'public.audit_entity_types'::regclass
      and conname = 'entity_audit_log_entity_type_fkey'
      and contype = 'f'
      and conkey = array[v_entity_type_attnum]::smallint[]
      and confkey = array[v_catalog_entity_type_attnum]::smallint[]
      and confupdtype = 'r'
      and confdeltype = 'r'
      and not convalidated
  ) then
    raise exception 'A2 requiere la FK A1 exacta y todavía NOT VALID';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = 'entity_audit_log_entity_type_check'
      and contype = 'c'
      and v_entity_type_attnum = any (conkey)
  ) then
    raise exception 'A2 requiere el CHECK legacy exacto sobre entity_type';
  end if;

  if not exists (
    select 1
    from public.audit_entity_types
    where entity_type = 'rendition'
      and status = 'active'
  ) then
    raise exception 'A2 abortado: rendition debe estar activo en el catálogo';
  end if;

  select count(*)
    into v_orphan_count
  from public.entity_audit_log as log
  left join public.audit_entity_types as catalog
    on catalog.entity_type = log.entity_type
  where catalog.entity_type is null;

  if v_orphan_count <> 0 then
    raise exception 'A2 abortado: existen % tipos históricos fuera del catálogo', v_orphan_count;
  end if;
end
$$;

-- ── 1. Validar primero; no retirar todavía el CHECK ──────────

alter table public.entity_audit_log
  validate constraint entity_audit_log_entity_type_fkey;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = 'entity_audit_log_entity_type_fkey'
      and contype = 'f'
      and convalidated
  ) then
    raise exception 'A2 abortado: la FK no quedó validada; el CHECK no se retirará';
  end if;
end
$$;

-- ── 2. Sustituir la whitelist regresiva por el catálogo ─────

alter table public.entity_audit_log
  drop constraint entity_audit_log_entity_type_check;

comment on constraint entity_audit_log_entity_type_fkey
  on public.entity_audit_log is
  'SDD-0166 Corte A2: FK validada; audit_entity_types sustituye la whitelist CHECK regresiva.';

-- ── 3. Postcondiciones A2 ────────────────────────────────────

do $$
declare
  v_orphan_count bigint;
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and confrelid = 'public.audit_entity_types'::regclass
      and conname = 'entity_audit_log_entity_type_fkey'
      and contype = 'f'
      and convalidated
  ) then
    raise exception 'A2 abortado: la FK validada no está presente';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = 'entity_audit_log_entity_type_check'
  ) then
    raise exception 'A2 abortado: el CHECK legacy sigue presente';
  end if;

  if not exists (
    select 1
    from public.audit_entity_types
    where entity_type = 'rendition'
      and status = 'active'
  ) then
    raise exception 'A2 abortado: rendition dejó de estar activo';
  end if;

  select count(*)
    into v_orphan_count
  from public.entity_audit_log as log
  left join public.audit_entity_types as catalog
    on catalog.entity_type = log.entity_type
  where catalog.entity_type is null;

  if v_orphan_count <> 0 then
    raise exception 'A2 abortado: aparecieron % huérfanos después de validar', v_orphan_count;
  end if;
end
$$;

reset statement_timeout;
reset lock_timeout;
