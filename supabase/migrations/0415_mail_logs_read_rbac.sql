-- 0415 · SDD-0358 · Cierre de lectura de Mailing después del deploy de Cobranzas.
-- Requiere 0410 aplicada + app que usa collections_mail_context desplegada y
-- verificada. El catálogo SQL no certifica ese segundo requisito.
-- No aplicar a Cloud/Producción desde esta rama; autorización individual.
--
-- IMPORTACIÓN L10 (2026-09-12). Desviación respecto de la PR #21, decidida por
-- el Director antes de cualquier aplicación: lock_timeout y statement_timeout
-- propios antes del primer lock. La restricción toma ACCESS EXCLUSIVE sobre
-- mail_logs; sin tope, su espera dejaba en cola envíos, webhook de Resend, crons
-- y la consola de Mailing. Patrón de 0342, 0383, 0450 y 0451.

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.mail_logs') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.current_studio_role()') is null
     or not exists (
       select 1 from pg_catalog.pg_proc
       where oid = pg_catalog.to_regprocedure('public.collections_mail_context(uuid[])')
         and prosecdef
     ) then
    raise exception '0415 requiere mail_logs, helpers activos y el facade 0410';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', 'public.collections_mail_context(uuid[])', 'EXECUTE') then
    raise exception '0415: el consumidor autenticado no puede ejecutar el facade';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'mail_logs'
      and policyname = 'mail_logs_tenant_select' and cmd = 'SELECT'
  ) or exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'mail_logs'
      and cmd in ('SELECT', 'ALL')
      and ('authenticated' = any(roles) or 'public' = any(roles))
      and policyname <> 'mail_logs_tenant_select'
  ) then
    raise exception '0415 abortada: policies de lectura ausentes o con drift';
  end if;
end;
$preflight$;

drop policy "mail_logs_tenant_select" on public.mail_logs;
create policy mail_logs_admin_select
  on public.mail_logs for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );
revoke all on public.mail_logs from authenticated;
grant select on public.mail_logs to authenticated;

do $postflight$
begin
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'mail_logs'
      and policyname = 'mail_logs_tenant_select'
  ) or not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'mail_logs'
      and policyname = 'mail_logs_admin_select' and cmd = 'SELECT'
      and qual like '%current_studio_role%'
  ) then
    raise exception '0415: policy final de mail_logs inválida';
  end if;
  if not pg_catalog.has_table_privilege('authenticated', 'public.mail_logs', 'SELECT')
     or pg_catalog.has_table_privilege('authenticated', 'public.mail_logs', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.mail_logs', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.mail_logs', 'DELETE')
     or pg_catalog.has_table_privilege('authenticated', 'public.mail_logs', 'TRUNCATE') then
    raise exception '0415: ACL final de mail_logs inválida';
  end if;
end;
$postflight$;
