-- 0420 · SDD-0364 · Reportes de pago Portal ligados al principal y tenant.
-- Sólo tres policies Portal; sin DML, ACL, funciones, triggers ni Storage.
-- Conserva 0195/0230/0359 y la lectura del historial con factura archivada.
-- No cierra los hallazgos separados de cancelación, campos reservados o RBAC
-- interno. Cloud: autorización nominal y transacción; sin nuevo consumidor.

do $preflight$
declare v_table text;
begin
  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0420: requiere auth.uid()';
  end if;
  foreach v_table in array array['client_users', 'clients', 'payment_reports'] loop
    if not exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass('public.' || v_table) and relrowsecurity
    ) then
      raise exception '0420: tabla ausente o sin RLS: %', v_table;
    end if;
  end loop;
  if exists (
    with expected(policyname, cmd, policyrole) as (values
      ('payment_reports by tenant', 'ALL', 'authenticated'),
      ('payment_reports service_role all', 'ALL', 'service_role'),
      ('payment_reports portal self read', 'SELECT', 'authenticated'),
      ('payment_reports portal self insert', 'INSERT', 'authenticated'),
      ('payment_reports portal self update', 'UPDATE', 'authenticated')
    ), actual as (
      select * from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'payment_reports'
    )
    select 1 from expected e full join actual a on a.policyname = e.policyname
    where e.policyname is null or a.policyname is null or a.cmd <> e.cmd
      or a.roles <> array[e.policyrole]::name[] or a.permissive <> 'PERMISSIVE'
  ) then
    raise exception '0420: inventario de policies ausente o con drift; revisar antes de aplicar';
  end if;
end;
$preflight$;

-- No unir contra invoices: archivar una factura no retira su reporte histórico.
alter policy "payment_reports portal self read" on public.payment_reports
  using (
    deleted_at is null and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = payment_reports.tenant_id
        and c.markbox = payment_reports.client_markbox
    )
  );

-- El trigger 0195 valida la factura y sella invoice_code. Eso no sustituye
-- comprobar que el actor es el cliente de la fila nueva.
alter policy "payment_reports portal self insert" on public.payment_reports
  with check (
    status = 'reportado' and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = payment_reports.tenant_id
        and c.markbox = payment_reports.client_markbox
    )
  );

-- USING protege la fila previa; WITH CHECK también niega trasladarla a B.
-- No se amplía SELECT para permitir soft-delete: su reparación es otro slice.
alter policy "payment_reports portal self update" on public.payment_reports
  using (
    status = 'reportado' and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = payment_reports.tenant_id
        and c.markbox = payment_reports.client_markbox
    )
  )
  with check (
    status = 'reportado' and exists (
      select 1 from public.client_users cu
      join public.clients c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid()) and cu.status = 'active'
        and cu.tenant_id = payment_reports.tenant_id
        and c.markbox = payment_reports.client_markbox
    )
  );

do $postflight$
begin
  if (select count(*) from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'payment_reports'
        and policyname like '% portal %' and cmd in ('SELECT', 'INSERT', 'UPDATE')
        and roles = array['authenticated']::name[] and permissive = 'PERMISSIVE'
        and (cmd = 'INSERT' or (
          qual like '%client_users%' and qual like '%auth.uid()%'
          and qual like '%tenant_id%' and qual like '%client_markbox%'
        ))
        and (cmd = 'SELECT' or (
          with_check like '%client_users%' and with_check like '%auth.uid()%'
          and with_check like '%tenant_id%' and with_check like '%client_markbox%'
          and with_check like '%reportado%'
        ))
    ) <> 3 then
    raise exception '0420: frontera Portal final inválida';
  end if;
end;
$postflight$;
