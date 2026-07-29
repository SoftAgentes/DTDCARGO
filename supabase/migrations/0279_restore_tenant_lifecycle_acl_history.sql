-- SDD-0172 · hacer reproducible el preflight histórico de 0268.
-- Sólo antepone al ledger el retiro de DELETE de roles cliente; no ejecuta DDL.

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
  statements[1]
]
where version = '20260729053713'
  and name = '0268_tenant_lifecycle_guardrails'
  and cardinality(statements) = 1
  and md5(statements[1]) = '127a11d4eac9106d621a537b1886c6c3';

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
