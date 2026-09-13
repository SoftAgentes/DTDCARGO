-- 0414 · SDD-0357 · Lectura de facturas por rol financiero o principal Portal.
-- Gate individual: 0411–0413 aplicadas + app con los tres facades desplegada.
-- No aplicar a Cloud/Producción desde esta rama.
--
-- IMPORTACIÓN L07 (2026-09-12). Desviación respecto de la PR #21, pre-autorizada
-- por el Director antes de cualquier aplicación: set local lock_timeout y
-- statement_timeout antes del primer lock, como 0450/0451 pero fuera de un do:
-- rige en la transacción de aplicación. 0414 toma ACCESS EXCLUSIVE sobre
-- invoices (y ACCESS SHARE sobre clients y client_users); sin tope, su espera
-- dejaba en cola toda lectura de facturas, incluido el Portal.

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare v_signature text;
begin
  if pg_catalog.to_regclass('public.invoices') is null
     or pg_catalog.to_regclass('public.client_users') is null
     or pg_catalog.to_regclass('public.clients') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.current_studio_role()') is null then
    raise exception '0414 requiere facturas, principal Portal y helpers activos de equipo';
  end if;
  foreach v_signature in array array[
    'public.studio_client_annual_billing(date)',
    'public.conversation_client_outstanding(uuid)',
    'public.sales_order_invoice_refs(uuid[])'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_proc as p
      where p.oid = pg_catalog.to_regprocedure(v_signature) and p.prosecdef
    ) then
      raise exception '0414 requiere RPC minimizada SECURITY DEFINER: %', v_signature;
    end if;
  end loop;
  if (select count(*) from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'invoices' and cmd = 'SELECT'
        and policyname in ('invoices_team_select', 'invoices portal self read')) <> 2
     or exists (
       select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'invoices'
         and cmd in ('ALL', 'SELECT')
         and policyname not in ('invoices_team_select', 'invoices portal self read')
     ) then
    raise exception '0414 abortada: policies de lectura ausentes o con drift; revisar antes de aplicar';
  end if;
end;
$preflight$;

drop policy invoices_team_select on public.invoices;
create policy invoices_accounting_select
  on public.invoices for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );

-- La unicidad del Shipping Mark es POR TENANT. El vínculo activo también debe
-- pertenecer al tenant de la factura y del cliente; una coincidencia textual
-- aislada nunca concede acceso. Se conservan las RLS propias de cu y c.
drop policy "invoices portal self read" on public.invoices;
create policy "invoices portal self read"
  on public.invoices for select to authenticated
  using (
    deleted_at is null
    and status <> 'borrador'
    and client_markbox is not null
    and exists (
      select 1
      from public.client_users as cu
      join public.clients as c
        on c.id = cu.client_id and c.tenant_id = cu.tenant_id
          and c.deleted_at is null
      where cu.auth_user_id = (select auth.uid())
        and cu.status = 'active'
        and cu.tenant_id = invoices.tenant_id
        and c.markbox = invoices.client_markbox
    )
  );

comment on table public.invoices is
  'SDD-0021/0350/0357: lectura y escritura internas requieren accounting/admin activos del tenant. Portal sólo lee sus facturas no borrador/vivas mediante vínculo activo, cliente vivo y tenant coincidente. Módulos no financieros usan RPCs minimizadas 0411–0413. authenticated no tiene DELETE físico; service_role se reserva a procesos controlados.';

do $postflight$
begin
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'invoices'
      and (policyname = 'invoices_team_select' or cmd = 'ALL')
  ) then
    raise exception '0414: sobrevivió lectura interna tenant-wide';
  end if;
  if (select count(*) from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'invoices' and cmd = 'SELECT'
        and policyname in ('invoices_accounting_select', 'invoices portal self read')) <> 2
     or not pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'SELECT')
     or not pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'INSERT')
     or not pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'DELETE') then
    raise exception '0414: policies de lectura o ACL de facturas inválidas';
  end if;
end;
$postflight$;
