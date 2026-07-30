-- SDD-0172 · hacer replay-safe el restaurador histórico del ACL tenant.
-- Sólo sustituye el payload de 0279 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0172_tenant_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729224850'
      and name = '0279_restore_tenant_lifecycle_acl_history'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('5251a9ca8ccbf579c5b81688e63acb01', 'd67b2e81a67028e56bd994f47ce16f6d')
  ) then
    raise exception '0286 abortada: ledger 0279 ausente, ambiguo o con drift';
  end if;
end
$sdd0172_tenant_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0172_tenant_split_patched_0279$-- SDD-0172 · hacer reproducible el preflight histórico de 0268.
-- Sólo repara el estado canónico o el split exacto de R17; no ejecuta DDL.
-- 0286 conserva fail-closed cualquier representación no reconocida.

do $sdd0172_tenant_acl_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729053713'
      and name = '0268_tenant_lifecycle_guardrails'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '127a11d4eac9106d621a537b1886c6c3'
        )
        or (
          cardinality(statements) = 2
          and md5(statements[1]) = '6f6ddc2074c8f8c527fa6150ff8616c5'
          and md5(statements[2]) = '127a11d4eac9106d621a537b1886c6c3'
        )
        or (
          cardinality(statements) = 10
          and md5(array_to_string(statements, E'\n')) = 'f21fd3848c7a52b0c12c0c215da86c31'
        )
      )
  ) then
    raise exception
      '0279 abortada: ledger 0268 ausente, ambiguo o con payload inesperado';
  end if;
end
$sdd0172_tenant_acl_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0172_tenant_acl_revoke$revoke delete on table public.tenants from public, anon, authenticated;$sdd0172_tenant_acl_revoke$,
  $sdd0172_tenant_acl_canonical_0268$-- ─────────────────────────────────────────────────────────────
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
$sdd0172_tenant_acl_canonical_0268$
]
where version = '20260729053713'
  and name = '0268_tenant_lifecycle_guardrails'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '127a11d4eac9106d621a537b1886c6c3'
    )
    or (
      cardinality(statements) = 10
      and md5(array_to_string(statements, E'\n')) = 'f21fd3848c7a52b0c12c0c215da86c31'
    )
  );

do $sdd0172_tenant_acl_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729053713'
      and name = '0268_tenant_lifecycle_guardrails'
      and cardinality(statements) = 2
      and md5(statements[1]) = '6f6ddc2074c8f8c527fa6150ff8616c5'
      and md5(statements[2]) = '127a11d4eac9106d621a537b1886c6c3'
  ) then
    raise exception '0279 abortada: 0268 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0172_tenant_acl_postconditions$;
$sdd0172_tenant_split_patched_0279$ || chr(13) || chr(10)
]
where version = '20260729224850'
  and name = '0279_restore_tenant_lifecycle_acl_history'
  and cardinality(statements) = 1
  and md5(statements[1]) = '5251a9ca8ccbf579c5b81688e63acb01';

do $sdd0172_tenant_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729224850'
      and name = '0279_restore_tenant_lifecycle_acl_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'd67b2e81a67028e56bd994f47ce16f6d'
  ) then
    raise exception '0286 abortada: 0279 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0172_tenant_split_postconditions$;
