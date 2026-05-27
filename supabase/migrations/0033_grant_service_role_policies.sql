-- 0033_grant_service_role_policies.sql
--
-- Fix raíz: tablas mail_* y user_* del Studio fueron creadas SIN
-- GRANT base a service_role. Las policies para authenticated existían
-- pero PostgREST rechazaba al admin client antes incluso de evaluar RLS
-- porque service_role no tenía siquiera SELECT/INSERT permission.
--
-- Hint literal de PostgreSQL al hacer SELECT con service_role:
--   "permission denied for table mail_config
--    HINT: Grant the required privileges to the current role with:
--    GRANT SELECT ON public.mail_config TO service_role;"
--
-- Sin GRANT base, la policy nunca se evalúa.
--
-- Esto rompía:
--   - sendEmail() helper (no podía leer mail_config, escribir mail_logs)
--   - pnpm seed con seedAgents (skills sin grant) y seedMailTemplates
--     (tenants sin grant)
--   - Bug Reporter F5 cuando llegue (necesita admin email send)
--   - Webhook handler /api/webhooks/resend (admin update mail_logs)
--
-- Detectado 2026-05-26 al testear flow de invitación post-setup Resend.
-- Aplicado in-place en prod ese mismo día via MCP execute_sql.

-- 1. GRANTs base · service_role necesita acceso CRUD completo
grant all on public.mail_config to service_role;
grant all on public.mail_logs to service_role;
grant all on public.mail_blacklist to service_role;
grant all on public.mail_templates to service_role;
grant all on public.mail_rules to service_role;

grant all on public.tenants to service_role;
grant all on public.user_tenants to service_role;
grant all on public.user_invitations to service_role;
grant all on public.user_profiles to service_role;
grant all on public.skills to service_role;

-- 2. Defensive: futuras tablas en public auto-granteadas a service_role
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

-- 3. Policies "service_role bypass" · defense in depth
-- (los grants ya alcanzan, pero las policies explícitas hacen el intent
-- evidente para future auditing)
create policy "service_role_all_mail_config"
  on public.mail_config for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_logs"
  on public.mail_logs for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_blacklist"
  on public.mail_blacklist for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_templates"
  on public.mail_templates for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_rules"
  on public.mail_rules for all to service_role
  using (true) with check (true);

create policy "service_role_all_tenants"
  on public.tenants for all to service_role
  using (true) with check (true);

create policy "service_role_all_user_tenants"
  on public.user_tenants for all to service_role
  using (true) with check (true);

create policy "service_role_all_user_invitations"
  on public.user_invitations for all to service_role
  using (true) with check (true);

create policy "service_role_all_user_profiles"
  on public.user_profiles for all to service_role
  using (true) with check (true);
