-- ─────────────────────────────────────────────────────────────
-- 0058_user_invitations_region.sql
--
-- Captura un cambio que estaba aplicado en prod via SQL editor
-- (migration registrada como "user_invitations_region") pero NO existía
-- como file en el repo. Sin este archivo, un clone + fresh DB setup
-- recrearía user_invitations sin la columna region — divergiría de prod
-- y rompería el flow de invitación (que necesita propagar region desde
-- la invitación hacia user_tenants al aceptar).
--
-- Contexto:
--   El admin invita a un user para una oficina específica (ve / cn).
--   Esa decisión vive en user_invitations.region hasta que el invitado
--   acepta, y entonces se materializa como user_tenants.region (que ya
--   tiene la columna desde 0052_user_region).
--
-- Default 've' cubre invitaciones legacy y el caso common (oficina VE).
--
-- Idempotente: ADD COLUMN IF NOT EXISTS es no-op si ya existe.
-- ─────────────────────────────────────────────────────────────

alter table public.user_invitations
  add column if not exists region public.user_region not null default 've';

comment on column public.user_invitations.region is
  'Oficina del invitado (ve por default). Se propaga a user_tenants.region cuando el user acepta la invitación. Decisión del admin al invitar.';
