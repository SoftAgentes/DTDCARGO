-- ─────────────────────────────────────────────────────────────
-- 0409 · SDD-0352 · Conciliación bancaria: RBAC en la base
--
-- HALLAZGO: Contabilidad es accounting + admin en la aplicación, pero
-- bank_statements y bank_statement_lines concedían CRUD a cualquier sesión
-- authenticated activa del tenant mediante policies FOR ALL.
--
-- ESTE SLICE:
--   · separa SELECT/INSERT/UPDATE/DELETE en ambas tablas;
--   · exige tenant activo y rol accounting|admin en cada operación;
--   · conserva el CRUD que usa el flujo actual y el bypass de service_role;
--   · elimina privilegios fuera del CRUD explícito, incluido TRUNCATE.
--
-- No cambia estados, matching, asientos ni triggers. NO aplicar a
-- Cloud/Producción desde esta rama; seguir el runbook individual de migraciones.
-- ─────────────────────────────────────────────────────────────

do $preflight$
begin
  if pg_catalog.to_regclass('public.bank_statements') is null
     or pg_catalog.to_regclass('public.bank_statement_lines') is null then
    raise exception '0409 requiere las tablas de conciliación de la migración 0167';
  end if;
  if pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.current_studio_role()') is null then
    raise exception '0409 requiere helpers activos de tenant y rol';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bank_statements'
      and policyname = 'bank_statements by tenant' and cmd = 'ALL'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bank_statement_lines'
      and policyname = 'bank_statement_lines by tenant' and cmd = 'ALL'
  ) then
    raise exception '0409 abortada: policies FOR ALL históricas ausentes o con drift';
  end if;
end;
$preflight$;

drop policy "bank_statements by tenant" on public.bank_statements;

create policy bank_statements_accounting_select
  on public.bank_statements for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
create policy bank_statements_accounting_insert
  on public.bank_statements for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
create policy bank_statements_accounting_update
  on public.bank_statements for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
create policy bank_statements_accounting_delete
  on public.bank_statements for delete to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );

drop policy "bank_statement_lines by tenant" on public.bank_statement_lines;

create policy bank_statement_lines_accounting_select
  on public.bank_statement_lines for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
create policy bank_statement_lines_accounting_insert
  on public.bank_statement_lines for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
create policy bank_statement_lines_accounting_update
  on public.bank_statement_lines for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
create policy bank_statement_lines_accounting_delete
  on public.bank_statement_lines for delete to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );

revoke all on public.bank_statements from authenticated;
grant select, insert, update, delete on public.bank_statements to authenticated;
revoke all on public.bank_statement_lines from authenticated;
grant select, insert, update, delete on public.bank_statement_lines to authenticated;

comment on table public.bank_statements is
  'SDD-0105/0352: extractos bancarios. authenticated requiere tenant activo y rol accounting|admin en RLS; service_role conserva el acceso operativo.';
comment on table public.bank_statement_lines is
  'SDD-0105/0352: movimientos conciliables. authenticated requiere tenant activo y rol accounting|admin en RLS; matching y trazabilidad conservan sus triggers.';

do $postflight$
declare
  v_expected constant text[] := array[
    'bank_statements_accounting_select',
    'bank_statements_accounting_insert',
    'bank_statements_accounting_update',
    'bank_statements_accounting_delete',
    'bank_statement_lines_accounting_select',
    'bank_statement_lines_accounting_insert',
    'bank_statement_lines_accounting_update',
    'bank_statement_lines_accounting_delete'
  ];
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and policyname in ('bank_statements by tenant', 'bank_statement_lines by tenant')
  ) then
    raise exception '0409: sobrevivió una policy FOR ALL histórica';
  end if;
  if (select count(*) from pg_policies
      where schemaname = 'public' and policyname = any(v_expected))
      <> pg_catalog.array_length(v_expected, 1) then
    raise exception '0409: faltan policies accounting/admin';
  end if;
  if not has_table_privilege('authenticated', 'public.bank_statements', 'SELECT,INSERT,UPDATE,DELETE')
     or not has_table_privilege('authenticated', 'public.bank_statement_lines', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.bank_statements', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.bank_statement_lines', 'TRUNCATE') then
    raise exception '0409: ACL final inválida';
  end if;
end;
$postflight$;
