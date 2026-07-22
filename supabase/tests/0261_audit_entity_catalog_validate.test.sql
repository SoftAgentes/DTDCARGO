\set ON_ERROR_STOP on

-- Prueba contractual local de A1 + A2. Crea una fixture mínima en public
-- únicamente dentro de esta transacción y termina siempre con ROLLBACK.
begin;

do $$
begin
  if to_regclass('public.entity_audit_log') is not null
     or to_regclass('public.audit_entity_types') is not null then
    raise exception 'Fixture A2 rechazada: los objetos reales ya existen en esta base';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$$;

create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  actor_type text not null check (actor_type in ('user', 'operario', 'system')),
  actor_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint entity_audit_log_entity_type_check check (
    entity_type = any (array[
      'shipment', 'dispatch_order', 'dispatch_order_package',
      'warehouse_receipt_cn', 'warehouse_receipt_ve',
      'invoice', 'journal_entry', 'account', 'payment_receipt',
      'supplier', 'supplier_bill', 'supplier_payment',
      'purchase_order', 'sales_order', 'consolidation'
    ])
  )
);

create index entity_audit_log_entity_idx
  on public.entity_audit_log (entity_type, entity_id, occurred_at desc);

grant select on public.entity_audit_log to authenticated;
grant all on public.entity_audit_log to service_role;

\ir ../migrations/0258_audit_entity_catalog.sql

create temporary table a2_acl_before as
select relacl
from pg_class
where oid = 'public.entity_audit_log'::regclass;

\ir ../migrations/0261_audit_entity_catalog_validate.sql

do $$
declare
  v_acl_before aclitem[];
  v_acl_after aclitem[];
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = 'entity_audit_log_entity_type_fkey'
      and contype = 'f'
      and convalidated
  ) then
    raise exception 'TEST A2: la FK no quedó validada';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and conname = 'entity_audit_log_entity_type_check'
  ) then
    raise exception 'TEST A2: el CHECK legacy no fue retirado';
  end if;

  select relacl into v_acl_before from a2_acl_before;
  select relacl into v_acl_after
  from pg_class
  where oid = 'public.entity_audit_log'::regclass;

  if v_acl_after is distinct from v_acl_before then
    raise exception 'TEST A2: cambió la ACL de entity_audit_log';
  end if;
end
$$;

-- `rendition` debe quedar aceptado por el catálogo aunque el CHECK anterior
-- no lo incluía.
insert into public.entity_audit_log (
  tenant_id,
  entity_type,
  entity_id,
  actor_type,
  event_type
)
values (
  gen_random_uuid(),
  'rendition',
  gen_random_uuid(),
  'system',
  'a2_contract_test'
);

-- Una clave que no existe en el catálogo debe fallar por la FK validada.
do $$
begin
  begin
    insert into public.entity_audit_log (
      tenant_id,
      entity_type,
      entity_id,
      actor_type,
      event_type
    )
    values (
      gen_random_uuid(),
      'unknown_a2_contract_test',
      gen_random_uuid(),
      'system',
      'a2_contract_test'
    );

    raise exception 'TEST A2: un tipo desconocido fue aceptado';
  exception
    when foreign_key_violation then
      null;
  end;
end
$$;

rollback;

select
  to_regclass('public.entity_audit_log') is null
  and to_regclass('public.audit_entity_types') is null
  as a2_fixture_rolled_back;
