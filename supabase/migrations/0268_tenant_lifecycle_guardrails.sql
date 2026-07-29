-- ─────────────────────────────────────────────────────────────
-- 0268 · SDD-0172 · Guardrails de lifecycle tenant/fixtures
--
-- Alcance:
--   1. impedir que borrar un tenant elimine transitivamente auditoría;
--   2. retirar DELETE ordinario de service_role sobre public.tenants.
--
-- Deliberadamente NO:
--   · crea una función de purga;
--   · cambia las otras FK hacia tenants;
--   · implementa suspensión/archivo;
--   · abre los Cortes C, D o E de SDD-0166.
--
-- REVISIÓN LOCAL SOLAMENTE. NO AUTORIZADA PARA CLOUD.
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.tenants') is null
     or to_regclass('public.entity_audit_log') is null then
    raise exception '0268 requiere tenants y entity_audit_log';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and confrelid = 'public.tenants'::regclass
      and conname = 'entity_audit_log_tenant_id_fkey'
      and contype = 'f'
      and confdeltype = 'c'
      and convalidated
  ) then
    raise exception '0268 requiere la FK audit de tenant validada y CASCADE';
  end if;

  if to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null then
    raise exception '0268 requiere el writer de 0267';
  end if;

  if not has_table_privilege('service_role', 'public.tenants', 'SELECT')
     or not has_table_privilege('service_role', 'public.tenants', 'INSERT')
     or not has_table_privilege('service_role', 'public.tenants', 'UPDATE')
     or not has_table_privilege('service_role', 'public.tenants', 'DELETE') then
    raise exception '0268 abortado: ACL service_role de tenants no coincide';
  end if;

  if has_table_privilege('anon', 'public.tenants', 'DELETE')
     or has_table_privilege('authenticated', 'public.tenants', 'DELETE') then
    raise exception '0268 abortado: un rol cliente puede borrar tenants';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and cmd = 'DELETE'
  ) then
    raise exception '0268 abortado: existe una policy DELETE sobre tenants';
  end if;

  if exists (
    select 1
    from public.tenants
    where id = '01680000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception '0268 abortado: el tenant fixture SDD-0168 sigue presente';
  end if;
end
$preflight$;

alter table public.entity_audit_log
  drop constraint entity_audit_log_tenant_id_fkey,
  add constraint entity_audit_log_tenant_id_fkey
    foreign key (tenant_id)
    references public.tenants(id)
    on delete restrict
    not valid;

alter table public.entity_audit_log
  validate constraint entity_audit_log_tenant_id_fkey;

revoke delete on table public.tenants from service_role;

do $postconditions$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and confrelid = 'public.tenants'::regclass
      and conname = 'entity_audit_log_tenant_id_fkey'
      and contype = 'f'
      and confdeltype = 'r'
      and convalidated
  ) then
    raise exception '0268 abortado: FK audit no quedó RESTRICT y validada';
  end if;

  if has_table_privilege('service_role', 'public.tenants', 'DELETE') then
    raise exception '0268 abortado: service_role conserva DELETE en tenants';
  end if;

  if not has_table_privilege('service_role', 'public.tenants', 'SELECT')
     or not has_table_privilege('service_role', 'public.tenants', 'INSERT')
     or not has_table_privilege('service_role', 'public.tenants', 'UPDATE') then
    raise exception '0268 abortado: se retiró un privilegio fuera de alcance';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and cmd = 'DELETE'
  ) then
    raise exception '0268 abortado: apareció una policy DELETE';
  end if;
end
$postconditions$;

reset statement_timeout;
reset lock_timeout;
