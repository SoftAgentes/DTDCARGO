-- ─────────────────────────────────────────────────────────────
-- 0407 · SDD-0350 · Facturación: RBAC de escritura en la base
--
-- HALLAZGO: la aplicación reserva `invoices` a accounting + admin, pero la
-- policy histórica "invoices by tenant" era FOR ALL. Cualquier sesión
-- authenticated activa del tenant podía saltar el guard de Server Actions y
-- hacer INSERT/UPDATE/DELETE directo por PostgREST.
--
-- ESTE SLICE:
--   · separa SELECT de INSERT/UPDATE;
--   · exige current_studio_role() = accounting|admin para escribir;
--   · revoca DELETE físico a authenticated (facturas emitidas se ANULAN; los
--     borradores se retiran por soft-delete, nunca se purgan desde el cliente);
--   · conserva sin cambios el SELECT tenant-wide y la policy del Portal.
--
-- El SELECT tenant-wide sigue siendo deuda deliberada: módulos comerciales
-- consumen agregados de invoices y requieren RPCs minimizadas antes de cerrar
-- la lectura cruda. No se rompe ese comportamiento dentro de un slice de
-- integridad. `service_role` conserva su acceso para jobs/RPCs controladas.
--
-- NO aplicar a Cloud/Producción desde esta rama. Gate individual obligatorio:
-- docs/runbooks/aplicar-migraciones-prod.md.
-- ─────────────────────────────────────────────────────────────

do $preflight$
begin
  if to_regclass('public.invoices') is null then
    raise exception '0407 requiere public.invoices (migración 0077)';
  end if;
  if to_regprocedure('public.get_user_tenant_id()') is null then
    raise exception '0407 requiere public.get_user_tenant_id()';
  end if;
  if to_regprocedure('public.current_studio_role()') is null then
    raise exception '0407 requiere public.current_studio_role() (migración 0200)';
  end if;
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'invoices'
      and policyname = 'invoices by tenant'
      and cmd = 'ALL'
  ) then
    raise exception '0407 abortada: policy histórica "invoices by tenant" ausente o con drift';
  end if;
end;
$preflight$;

drop policy "invoices by tenant" on public.invoices;

drop policy if exists invoices_team_select on public.invoices;
create policy invoices_team_select
  on public.invoices for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
  );

drop policy if exists invoices_accounting_insert on public.invoices;
create policy invoices_accounting_insert
  on public.invoices for insert
  to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );

drop policy if exists invoices_accounting_update on public.invoices;
create policy invoices_accounting_update
  on public.invoices for update
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );

grant select, insert, update on public.invoices to authenticated;
revoke delete on public.invoices from authenticated;

comment on table public.invoices is
  'SDD-0021/0350: facturas operativas y financieras. SELECT interno permanece tenant-wide por compatibilidad con consumidores agregados; INSERT/UPDATE requieren accounting o admin en RLS (0407). authenticated no tiene DELETE físico: borradores usan soft-delete y hechos emitidos se anulan. service_role queda reservado a jobs/RPCs controladas.';

do $postflight$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices'
      and policyname = 'invoices by tenant'
  ) then
    raise exception '0407: la policy FOR ALL histórica sigue presente';
  end if;

  if (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'invoices'
        and policyname in (
          'invoices_team_select',
          'invoices_accounting_insert',
          'invoices_accounting_update'
        )) <> 3 then
    raise exception '0407: faltan policies separadas de invoices';
  end if;

  if not has_table_privilege('authenticated', 'public.invoices', 'SELECT')
     or not has_table_privilege('authenticated', 'public.invoices', 'INSERT')
     or not has_table_privilege('authenticated', 'public.invoices', 'UPDATE')
     or has_table_privilege('authenticated', 'public.invoices', 'DELETE') then
    raise exception '0407: ACL final de authenticated inválida';
  end if;
end;
$postflight$;
