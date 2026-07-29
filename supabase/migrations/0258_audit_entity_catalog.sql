-- ─────────────────────────────────────────────────────────────
-- 0258 · SDD-0166 Corte A1 · Catálogo aditivo de entidades auditables
--
-- ✅ REVISADA EN REV-AUD-003 Y APLICADA INDIVIDUALMENTE A CLOUD.
--    Ledger: 20260722122332 / 0258_audit_entity_catalog.
--    Verificación: REV-AUD-004.
--
-- Alcance A1:
--   1. crear public.audit_entity_types sin acceso de aplicación;
--   2. poblar unión conocida + tipos históricos existentes;
--   3. añadir FK NOT VALID desde entity_audit_log.entity_type.
--
-- Deliberadamente NO hace en A1:
--   · validar la FK;
--   · retirar entity_audit_log_entity_type_check;
--   · cambiar grants/policies/Realtime de entity_audit_log;
--   · cambiar viewer, writers o payloads históricos.
--
-- A2 tendrá archivo, revisión y autorización separados.
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

-- ── 0. Preflight fail-closed ──────────────────────────────────

do $$
begin
  if to_regclass('public.entity_audit_log') is null then
    raise exception 'A1 requiere public.entity_audit_log';
  end if;

  if to_regclass('public.audit_entity_types') is not null then
    raise exception 'A1 no aplica: public.audit_entity_types ya existe';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = 'entity_audit_log_entity_type_check'
      and contype = 'c'
  ) then
    raise exception 'A1 requiere el CHECK vigente de entity_type; ejecutar inventario antes de continuar';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = 'entity_audit_log_entity_type_fkey'
  ) then
    raise exception 'A1 no aplica: entity_audit_log_entity_type_fkey ya existe';
  end if;
end
$$;

-- ── 1. Catálogo global, sin grants de aplicación ─────────────

create table public.audit_entity_types (
  entity_type       text primary key,
  status            text not null default 'active',
  domain_code       text not null,
  contract_version  smallint not null default 1,
  introduced_by_ref text not null,
  deprecated_at     timestamptz,
  created_at        timestamptz not null default now(),

  constraint audit_entity_types_key_format_check
    check (entity_type ~ '^[a-z][a-z0-9_]*$'),
  constraint audit_entity_types_status_check
    check (status in ('active', 'deprecated')),
  constraint audit_entity_types_domain_format_check
    check (domain_code ~ '^[a-z][a-z0-9_]*$'),
  constraint audit_entity_types_contract_version_check
    check (contract_version > 0),
  constraint audit_entity_types_introduced_by_ref_check
    check (btrim(introduced_by_ref) <> ''),
  constraint audit_entity_types_deprecation_check
    check (
      (status = 'active' and deprecated_at is null)
      or (status = 'deprecated' and deprecated_at is not null)
    )
);

comment on table public.audit_entity_types is
  'SDD-0166 Corte A: catálogo global y aditivo de entity_type. Las claves con historia se deprecan; nunca se borran.';

comment on column public.audit_entity_types.domain_code is
  'Dominio de routing/ownership. No representa sensibilidad ni retención AUD-02.';

comment on column public.audit_entity_types.contract_version is
  'Versión del contrato canónico del tipo de entidad; inicia en 1.';

alter table public.audit_entity_types enable row level security;

-- Supabase puede heredar default privileges amplios en tablas nuevas. El
-- catálogo es administrado solo por migraciones; las futuras funciones
-- SECURITY DEFINER lo consultarán como owner.
revoke all privileges on table public.audit_entity_types
  from public, anon, authenticated, service_role;

-- ── 2. Unión conocida del repo/writers ───────────────────────

insert into public.audit_entity_types (
  entity_type,
  status,
  domain_code,
  contract_version,
  introduced_by_ref
)
values
  ('shipment',                  'active', 'operations',  1, 'migration:0066'),
  ('dispatch_order',            'active', 'operations',  1, 'migration:0066'),
  ('dispatch_order_package',    'active', 'operations',  1, 'migration:0066'),
  ('warehouse_receipt_cn',      'active', 'operations',  1, 'migration:0066'),
  ('warehouse_receipt_ve',      'active', 'operations',  1, 'migration:0066'),
  ('invoice',                   'active', 'finance',     1, 'migration:0077'),
  ('journal_entry',             'active', 'finance',     1, 'migration:0078'),
  ('account',                   'active', 'finance',     1, 'migration:0078'),
  ('payment_receipt',           'active', 'finance',     1, 'migration:0079'),
  ('supplier',                  'active', 'procurement', 1, 'migration:0088'),
  ('supplier_bill',             'active', 'finance',     1, 'migration:0088'),
  ('supplier_payment',          'active', 'finance',     1, 'migration:0088'),
  ('rendition',                 'active', 'finance',     1, 'migration:0123'),
  ('purchase_order',            'active', 'procurement', 1, 'migration:0124'),
  ('sales_order',               'active', 'commercial',  1, 'migration:0125'),
  ('consolidation',             'active', 'operations',  1, 'migration:0241')
on conflict (entity_type) do nothing;

-- La semilla histórica no lee payload, IDs, tenant ni actor. Si apareciera una
-- clave válida que no está en la unión conocida, se conserva como legacy para
-- revisión; nunca se elimina historia para hacer pasar la FK.
insert into public.audit_entity_types (
  entity_type,
  status,
  domain_code,
  contract_version,
  introduced_by_ref
)
select distinct
  log.entity_type,
  'active',
  'legacy_unknown',
  1,
  'history:entity_audit_log'
from public.entity_audit_log as log
on conflict (entity_type) do nothing;

-- ── 3. Comprobar unión completa antes de crear la FK ─────────

do $$
declare
  v_missing text;
begin
  select string_agg(m.entity_type, ', ' order by m.entity_type)
    into v_missing
  from (
    select distinct log.entity_type
    from public.entity_audit_log as log
    except
    select catalog.entity_type
    from public.audit_entity_types as catalog
  ) as m;

  if v_missing is not null then
    raise exception 'A1 abortado: tipos históricos fuera del catálogo'
      using detail = v_missing;
  end if;

  if not exists (
    select 1
    from public.audit_entity_types
    where entity_type = 'rendition'
      and status = 'active'
  ) then
    raise exception 'A1 abortado: rendition no quedó activo en el catálogo';
  end if;
end
$$;

-- ── 4. Puente progresivo; A2 validará y retirará el CHECK ───

alter table public.entity_audit_log
  add constraint entity_audit_log_entity_type_fkey
  foreign key (entity_type)
  references public.audit_entity_types (entity_type)
  on update restrict
  on delete restrict
  not valid;

comment on constraint entity_audit_log_entity_type_fkey
  on public.entity_audit_log is
  'SDD-0166 Corte A1: FK aditiva NOT VALID. A2 valida y solo después retira el CHECK regresivo.';

-- ── 5. Postcondiciones A1 ────────────────────────────────────

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = 'entity_audit_log_entity_type_fkey'
      and contype = 'f'
      and not convalidated
  ) then
    raise exception 'A1 abortado: la FK debe existir como NOT VALID';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = 'entity_audit_log_entity_type_check'
      and contype = 'c'
  ) then
    raise exception 'A1 abortado: el CHECK debe permanecer hasta A2';
  end if;
end
$$;

reset statement_timeout;
reset lock_timeout;
