-- SDD-0082 (implementa SDD-0062 Slice D): nuevo evento de mailing para la
-- reactivación de prospectos inactivos por email. Aditiva, idempotente.
--
-- ADD VALUE IF NOT EXISTS es seguro de re-correr. NO se usa el valor nuevo en esta
-- misma migración (Postgres prohíbe usar un valor de enum recién agregado dentro de
-- la misma transacción) — la plantilla la siembra scripts/seed-mail-templates.ts y
-- la regla la crea un admin en /studio/mailing. Sin sender automático todavía.

alter type public.mail_rule_event add value if not exists 'lead_dormant_reengagement';
