-- 0038_service_role_grants_all_tables.sql
--
-- Fix preventivo MASIVO: 41 tablas con RLS enabled tenían grants
-- incompletos a service_role. La migración 0033 fixeó las 10 tablas
-- usadas por sendEmail (mail_*, user_*, tenants, skills), pero
-- quedaban TODAS las demás operativas (bug_*, back_*, agent_*,
-- dispatch_*, tms_*, shipments, quotes, rates, clients, customs_*,
-- warehouse_*, etc).
--
-- Mismo bug raíz: tablas creadas en migraciones del Studio NO incluyeron
-- el GRANT explícito a service_role. PostgreSQL no auto-grants a
-- service_role en CREATE TABLE (depende de ALTER DEFAULT PRIVILEGES,
-- que recién agregamos en 0033).
--
-- Sin este fix, server actions que usen createAdminClient para esas
-- tablas devuelven 403. Incluye:
--  - Bug Reporter F5 (notif por email a admin) cuando se implemente
--  - Cron jobs / webhooks que necesiten service_role
--  - Scripts de mantenimiento ad-hoc
--
-- Detectado 2026-05-26 durante audit preventivo post-Resend.
--
-- Fix: GRANT ALL en todas las tablas con RLS donde service_role
-- no tenga acceso completo. Idempotente (re-correr es no-op).

do $$
declare
  v_table record;
begin
  for v_table in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity = true
      and not (
        has_table_privilege('service_role', 'public.' || c.relname, 'SELECT')
        and has_table_privilege('service_role', 'public.' || c.relname, 'INSERT')
        and has_table_privilege('service_role', 'public.' || c.relname, 'UPDATE')
        and has_table_privilege('service_role', 'public.' || c.relname, 'DELETE')
      )
  loop
    execute format('grant all on public.%I to service_role', v_table.table_name);
    raise notice '[0038] granted ALL on %s to service_role', v_table.table_name;
  end loop;
end;
$$;

-- Nota: ALTER DEFAULT PRIVILEGES ya aplicado en 0033, así que tablas
-- futuras se auto-grantean. Esta migración cubre solo las preexistentes.
