-- ─────────────────────────────────────────────────────────────
-- 0057_user_profiles_locale_nullable.sql
--
-- Captura un cambio que estaba aplicado en prod via SQL editor
-- (migration registrada como "user_profiles_locale_nullable") pero
-- NO existía como file en el repo. Sin este archivo, un clone +
-- fresh DB setup recrearía el schema con locale NOT NULL — divergiría
-- de prod.
--
-- Contexto (de la decisión arquitectónica en 0052_user_region):
--   "La oficina del user (region) es la única decisión que toma el admin
--    al invitar. De ahí se derivan locale, timezone, moneda default. NO
--    se mezcla con user_profiles.locale (que queda obsoleto para flow
--    normal)."
--
-- Por eso locale se hizo nullable: el flujo real lo deriva de
-- user_tenants.region, no de user_profiles.locale. La columna queda
-- como override opcional manual por user.
--
-- Idempotente: DROP NOT NULL es no-op si ya está nullable.
-- ─────────────────────────────────────────────────────────────

alter table public.user_profiles
  alter column locale drop not null;

comment on column public.user_profiles.locale is
  'Override manual de locale del user. NULLABLE — el flujo normal deriva locale desde user_tenants.region via lib/i18n/region.ts. Solo setteado si el user pide explícito.';
