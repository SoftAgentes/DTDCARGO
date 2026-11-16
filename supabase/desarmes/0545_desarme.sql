-- SDD-0636 · Desarme de la 0545: quita la política «solo el superadministrador crea administradores».
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: supabase/tests/0545_solo_superadmin_crea_admin.test.sql (bloque «desarme») y
--   lib/studio/__tests__/solo-superadmin-crea-admin.migration.test.ts.
--
-- QUITA los disparadores user_invitations_exige_superadmin, user_tenants_exige_superadmin y
-- user_tenants_audit_alta, y sus tres funciones. DEVUELVE el EXECUTE de
-- studio_invite_user(text,text,text) a authenticated, como lo dejó la 0203.
-- NO TOCA las filas: invitaciones, membresías y la bitácora user_role_audit quedan como están
-- (las filas de alta que escribió la 0545 se conservan).
set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop trigger if exists user_invitations_exige_superadmin on public.user_invitations;
drop trigger if exists user_tenants_exige_superadmin on public.user_tenants;
drop trigger if exists user_tenants_audit_alta on public.user_tenants;
drop function if exists public.user_invitations_exige_superadmin();
drop function if exists public.user_tenants_exige_superadmin();
drop function if exists public.audit_user_tenants_alta();

grant execute on function public.studio_invite_user(text, text, text) to authenticated;

notify pgrst, 'reload schema';
