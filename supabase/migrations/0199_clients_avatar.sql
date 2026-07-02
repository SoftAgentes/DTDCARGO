-- ─────────────────────────────────────────────────────────────
-- SDD-0138 · Mi Perfil del cliente — Slice D · avatar editable
--
-- El Norte (PortalProfile) muestra una foto de perfil EDITABLE por el cliente.
-- Se separa del documento de identidad (clients.cedula_photo_path, migr 0091):
--   · cedula_photo_path → foto de la cédula/RIF (PII de verificación, la revisa
--     el asesor; el cliente la sube una vez en "Completa tu perfil").
--   · avatar_path       → foto de perfil (cosmética, el cliente la cambia cuando
--     quiera desde Mi cuenta).
--
-- Storage: REUSA el bucket privado `client-docs` (sin bucket ni policies nuevas)
-- con el sub-path `{tenant_id}/{markbox}/avatar/{uuid}.{ext}`. El portal sube y
-- firma server-side con el admin client, scopeado al cliente resuelto por sesión
-- (mismo patrón que la foto de cédula — el cliente nunca toca el bucket directo).
--
-- Aditiva · idempotente · NO se aplica a prod desde acá (lo hace el Director;
-- dry-run begin…rollback antes). Número 0199.
-- ─────────────────────────────────────────────────────────────

alter table public.clients
  add column if not exists avatar_path text;

comment on column public.clients.avatar_path is
  'SDD-0138 Slice D: foto de perfil del cliente (cosmética, editable desde el portal). Path en el bucket privado client-docs ({tenant_id}/{markbox}/avatar/…). Distinta de cedula_photo_path (documento de identidad, verificación).';

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0199_clients_avatar.sql
-- Aplicar con: MCP apply_migration (Director) · dry-run begin…rollback en prod antes.
-- ─────────────────────────────────────────────────────────────
