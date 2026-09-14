-- SDD-0365 · restricción posterior a0421 y a sus consumidores verificados.
-- Aplicar sólo con GO nominal, en transacción, DESPUÉS del smoke de la app.
-- No modifica filas, Storage, auditoría, fórmulas ni cuerpos de comandos.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare v_table text; v_api record; v_role text;
begin
  foreach v_table in array array[
    'public.payment_reports', 'public.invoices', 'public.client_users',
    'public.clients', 'public.user_tenants', 'payment_private.report_commands'
  ] loop
    if not exists (select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass(v_table) and relrowsecurity) then
      raise exception '0422 requiere tabla con RLS: %', v_table;
    end if;
  end loop;
  if pg_catalog.to_regprocedure('auth.uid()') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.current_studio_role()') is null
     or pg_catalog.to_regprocedure('public.assert_studio_role(text[])') is null
     or pg_catalog.to_regprocedure('public.confirm_payment_report(uuid,public.payment_report_status,text)') is null then
    raise exception '0422 requiere identidades vigentes y RPC heredada inventariada';
  end if;
  if not pg_catalog.has_table_privilege('authenticated', 'public.user_tenants', 'SELECT') then
    raise exception '0422 requiere SELECT de membresías propio/activo de0001/0200';
  end if;
  if exists (select 1 from pg_catalog.pg_policies
    where schemaname = 'payment_private' and tablename = 'report_commands') then
    raise exception '0422 abortado: recibos privados con policies inesperadas';
  end if;
  foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
    if pg_catalog.has_table_privilege(v_role, 'payment_private.report_commands',
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      or pg_catalog.has_any_column_privilege(v_role, 'payment_private.report_commands',
        'SELECT,INSERT,UPDATE,REFERENCES') then
      raise exception '0422 abortado: recibos privados con privilegios API para %', v_role;
    end if;
  end loop;
  for v_api in select * from (values
    ('public.create_portal_payment_report(uuid,uuid,text,numeric,public.payment_report_method,date,text,text)', false),
    ('public.cancel_portal_payment_report(uuid,uuid,text,text)', false),
    ('public.resolve_payment_report(uuid,uuid,public.payment_report_status,text)', false),
    ('payment_private.run_report_command(uuid,uuid,text,jsonb)', true)
  ) api(signature, is_definer) loop
    if not exists (select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(v_api.signature)
        and p.prosecdef = v_api.is_definer
        and p.proowner = 'postgres'::regrole
        and p.proconfig = array['search_path=""']::text[]
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')) then
      raise exception '0422 requiere comando0421 con owner/seguridad/ACL original: %', v_api.signature;
    end if;
  end loop;
  if exists (select 1 from pg_catalog.pg_class
    where oid in ('public.payment_reports'::regclass, 'payment_private.report_commands'::regclass)
      and relowner <> 'postgres'::regrole) then
    raise exception '0422 abortado: owner inesperado de reportes/recibos';
  end if;

  -- Fingerprints de pg_policies sobre0195+0230+0420 (PG17). No se aceptan
  -- OR true ni cambios de expresión disfrazados con nombres correctos.
  -- Si otra versión de PostgreSQL los representa distinto, revisar en
  -- preflight: nunca actualizar estas huellas sin comparar las expresiones.
  if exists (
    with expected(policyname, cmd, policyrole, expression_hash) as (values
      ('payment_reports by tenant', 'ALL', 'authenticated', 'f118dd90556c13981e880287a2b28599'),
      ('payment_reports service_role all', 'ALL', 'service_role', 'fe2e7aa3a94b94b876d7713f1517686d'),
      ('payment_reports portal self insert', 'INSERT', 'authenticated', '4cf28b9e935965fedd7f75ee95f2de81'),
      ('payment_reports portal self read', 'SELECT', 'authenticated', 'af236df7310d9dc253eeb404ad3536c5'),
      ('payment_reports portal self update', 'UPDATE', 'authenticated', 'e97d881fac2ed9207e0aa1adcfeeb458')
    ), actual as (
      select * from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'payment_reports'
    )
    select 1 from expected e full join actual a on a.policyname = e.policyname
    where e.policyname is null or a.policyname is null or a.cmd <> e.cmd
      or a.roles <> array[e.policyrole]::name[] or a.permissive <> 'PERMISSIVE'
      or pg_catalog.md5(coalesce(a.qual, '') || '|' || coalesce(a.with_check, '')) <> e.expression_hash
  ) then
    raise exception '0422 abortado: policies heredadas ausentes o con drift';
  end if;
end;
$preflight$;

-- Retirar toda escritura API, incluido service_role que omite RLS.
-- Los comandos0421 y rename0371 siguen con su owner postgres; no se cambia
-- su lógica ni se simula una identidad de sesión desde la aplicación.
revoke all privileges on table public.payment_reports from public, anon, authenticated, service_role;
-- PostgreSQL retira también los grants correspondientes por columna.
-- El postflight verifica privilegios efectivos, incluidos los heredados.
grant select on table public.payment_reports to authenticated, service_role;

drop policy "payment_reports by tenant" on public.payment_reports;
drop policy "payment_reports portal self insert" on public.payment_reports;
drop policy "payment_reports portal self update" on public.payment_reports;
drop policy "payment_reports service_role all" on public.payment_reports;

create policy payment_reports_accounting_select
  on public.payment_reports for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = payment_reports.tenant_id
        and ut.disabled_at is null and ut.role in ('accounting', 'admin')
    )
  );
create policy "payment_reports service_role read"
  on public.payment_reports for select to service_role using (true);
-- "payment_reports portal self read" queda intacta: no unir con invoices ni
-- esconder un reporte histórico por archivar su factura. No concede escritura.

revoke all privileges on function public.confirm_payment_report(uuid, public.payment_report_status, text)
  from public, anon, authenticated, service_role;

comment on table public.payment_reports is
  'SDD-0134/0365: reportes financieros P3 con evidencia P4. API sólo SELECT: accounting/admin activos del tenant o Portal propio activo; servicio conserva lecturas server-side scopeadas. Crear/cancelar/resolver mediante comandos auditados0421, sin DML ni confirm_payment_report legacy. Cancelación conserva original. Rename de Shipping Mark conserva su comando autorizado.';

do $postflight$
declare v_role text; v_oid oid := 'public.payment_reports'::regclass;
begin
  foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
    if pg_catalog.has_table_privilege(v_role, v_oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
       or pg_catalog.has_any_column_privilege(v_role, v_oid, 'INSERT,UPDATE,REFERENCES')
       or (v_role = 'anon' and pg_catalog.has_any_column_privilege(v_role, v_oid, 'SELECT'))
       or pg_catalog.has_function_privilege(v_role,
         'public.confirm_payment_report(uuid,public.payment_report_status,text)', 'EXECUTE')
       or pg_catalog.has_table_privilege(v_role, v_oid, 'SELECT') <> (v_role <> 'anon') then
      raise exception '0422: ACL final no cumple SELECT mínimo para %', v_role;
    end if;
  end loop;
  if exists (
    with expected(policyname, policyrole) as (values
      ('payment_reports_accounting_select', 'authenticated'),
      ('payment_reports portal self read', 'authenticated'),
      ('payment_reports service_role read', 'service_role')
    ), actual as (
      select * from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'payment_reports'
    )
    select 1 from expected e full join actual a on a.policyname = e.policyname
    where e.policyname is null or a.policyname is null or a.cmd <> 'SELECT'
      or a.roles <> array[e.policyrole]::name[] or a.permissive <> 'PERMISSIVE'
  ) then
    raise exception '0422: frontera final debe tener exactamente tres policies SELECT';
  end if;
end;
$postflight$;
