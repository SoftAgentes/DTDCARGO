-- ─────────────────────────────────────────────────────────────
-- SDD-0025 · No-Olvidar — endurecimiento de AUTORIZACIÓN (Fase 2.2)
--
-- Cierra 4 hallazgos del review interno adversarial (2026-07-17) sobre la
-- frontera RLS/GRANT. El núcleo libsodium quedó sólido; los agujeros graves
-- estaban en la capa DB. Aditiva sobre 0251 + 0252.
--
--   C1 (CRÍTICO) · Audit log NO era inmutable frente a service_role.
--       service_role tiene BYPASSRLS → las policies USING(false) de 0251 NO le
--       aplican, y por los default privileges (0033) conserva UPDATE/DELETE. El
--       mismo rol que escribe el log (audit.ts) podía borrar su rastro — el
--       escenario "compromiso del server" del threat model §2. Los criterios
--       spec:662-663 fallaban en prod real. Fix: REVOKE + trigger que aborta
--       todo UPDATE/DELETE (un trigger SÍ corre aunque el rol bypasee RLS).
--
--   C2 (CRÍTICO) · Escalada de privilegios en no_olvidar_user_keys.
--       GRANT UPDATE de columna-completa (0251:346) + policy que solo valida la
--       fila (0251:408) → un authenticated hacía, directo por PostgREST:
--         · UPDATE ... SET role='admin'      → auto-promoción a admin
--         · SET failed_unlock_attempts=0, locked_until=null → bypass lockout
--         · SET last_unlock_at=now()         → forja de sesión = bypass 2FA
--       Fix: REVOKE UPDATE a authenticated + DROP de la policy owner_update.
--       Las escrituras legítimas se reencaminan a service_role en actions.ts
--       (setupNoOlvidarAction + markUnlocked) o al RPC SECURITY DEFINER
--       no_olvidar_increment_failed_attempt (0252). authenticated conserva
--       SELECT de su propia fila.
--
--   A1 (ALTO) · rotate_kek era un confused deputy.
--       Autorizaba por el parámetro p_actor (elegido por quien llama), nunca
--       contra auth.uid() (0251:255) → cualquiera pasaba un UUID de admin y
--       causaba DoS del módulo (KEK activa → legacy apuntando a un secret
--       inexistente) + spoofing del audit. Fix: REVOKE EXECUTE a authenticated;
--       solo lo invoca key-manager.rotateKek con service_role.
--
--   A2 (ALTO) · INSERT forjado de recovery "aprobado".
--       authenticated tenía INSERT directo (0251:355) con WITH CHECK que solo
--       validaba requester_user_id (0251:448) → se insertaba status='approved',
--       approvals_required=0 y executeRecovery lo aceptaba sin las 2 firmas de
--       admin (bypass M-of-N §4.6). Fix: REVOKE INSERT a authenticated + DROP de
--       la policy insert. El request legítimo se crea con service_role
--       (requestRecoveryAction → requestRecovery(admin, …), status='pending').
--
-- Los grants explícitos a service_role de abajo son defensivos: hacen la
-- migración auto-contenida sin depender del orden de los default privileges.
--
-- ⚠️ NUMERACIÓN: renumerada 2026-07-18 (0225→0252→0253) por encima del máximo de
--    main — al traer main a la rama, 0250_no_olvidar colisionaba con
--    0250_referral_settings (SDD-0159). El set no_olvidar quedó contiguo y libre:
--    0251 (crear) → 0252 (hardening) → 0253 (authz). Aplicar a prod SOLO tras el
--    review cripto externo, de a una con OK del founder NOMBRANDO el archivo —
--    runbook docs/runbooks/aplicar-migraciones-prod.md. NO aplicar desde la rama.
-- ─────────────────────────────────────────────────────────────

-- ── C1 · Audit log verdaderamente inmutable (spec §4.7) ──────
revoke update, delete, truncate on public.no_olvidar_access_log
  from authenticated, anon, service_role;

create or replace function public.no_olvidar_block_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'no_olvidar_access_log es append-only: % prohibido', tg_op
    using errcode = '42501';
end;
$$;

comment on function public.no_olvidar_block_audit_mutation is
  'Aborta cualquier UPDATE/DELETE/TRUNCATE sobre el audit log del No-Olvidar. Un trigger se ejecuta aunque el rol tenga BYPASSRLS (service_role), a diferencia de las policies RLS — por eso esto SÍ hace inmutable el log (spec §4.7). service_role conserva solo INSERT.';

drop trigger if exists no_olvidar_access_log_immutable on public.no_olvidar_access_log;
create trigger no_olvidar_access_log_immutable
  before update or delete on public.no_olvidar_access_log
  for each row execute function public.no_olvidar_block_audit_mutation();

-- TRUNCATE NO lo cubre un trigger FOR EACH ROW → un trigger de statement aparte.
-- Sin esto, la inmutabilidad ante TRUNCATE dependería solo del REVOKE de arriba,
-- que un default-privilege futuro podría volver a filtrar (exactamente el patrón
-- que C1 declaró inaceptable para UPDATE/DELETE). Cierra la última rendija.
drop trigger if exists no_olvidar_access_log_no_truncate on public.no_olvidar_access_log;
create trigger no_olvidar_access_log_no_truncate
  before truncate on public.no_olvidar_access_log
  for each statement execute function public.no_olvidar_block_audit_mutation();

-- ── C2 · Cerrar la escalada por UPDATE directo a user_keys ───
drop policy if exists "no_olvidar_user_keys_owner_update" on public.no_olvidar_user_keys;
revoke update on public.no_olvidar_user_keys from authenticated;
-- setup/unlock ahora escriben esta tabla con service_role (ver actions.ts);
-- el conteo de intentos va por el RPC SECURITY DEFINER de 0251.
grant update on public.no_olvidar_user_keys to service_role;

-- ── A1 · rotate_kek solo service_role (no confiar en p_actor) ─
revoke execute on function public.no_olvidar_rotate_kek(text, uuid) from authenticated;
grant  execute on function public.no_olvidar_rotate_kek(text, uuid) to service_role;

-- ── A2 · recovery request solo se crea con service_role ──────
drop policy if exists "no_olvidar_recovery_requests_insert" on public.no_olvidar_recovery_requests;
revoke insert on public.no_olvidar_recovery_requests from authenticated;
grant  insert on public.no_olvidar_recovery_requests to service_role;
