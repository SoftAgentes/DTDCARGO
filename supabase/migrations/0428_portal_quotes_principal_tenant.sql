-- 0428 · SDD-0380 · Lectura de cotizaciones Portal por principal y tenant.
-- Sólo una policy SELECT. Sin DML, ACL, helpers, triggers o cambios de equipo.
-- LOCAL: Cloud conserva autorización nominal independiente.

do $preflight$
declare v_table text;
begin
  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0428 requiere auth.uid()';
  end if;
  foreach v_table in array array['quotes', 'client_users', 'clients'] loop
    if not exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass('public.' || v_table)
        and relkind in ('r', 'p') and relrowsecurity
    ) then
      raise exception '0428: tabla ausente o sin RLS: %', v_table;
    end if;
  end loop;
  if exists (
    with expected(policyname, cmd, roles) as (values
      ('quotes by tenant', 'ALL', array['authenticated']::name[]),
      ('quotes portal self read', 'SELECT', array['authenticated']::name[])
    ), actual as (
      select * from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'quotes'
    )
    select 1 from expected e full join actual a using (policyname)
    where e.policyname is null or a.policyname is null
      or a.cmd <> e.cmd or a.roles <> e.roles or a.permissive <> 'PERMISSIVE'
      or a.qual is null
      or (e.cmd = 'SELECT' and a.with_check is not null)
      or (e.cmd = 'ALL' and a.with_check is null)
  ) then
    raise exception '0428: inventario de policies con drift';
  end if;
end;
$preflight$;

alter policy "quotes portal self read" on public.quotes
  using (
    deleted_at is null and client_markbox is not null
    and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id
          and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = quotes.tenant_id
        and c.markbox = quotes.client_markbox
    )
  );
