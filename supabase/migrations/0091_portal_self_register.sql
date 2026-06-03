-- ─────────────────────────────────────────────────────────────
-- SDD-0042 Fase 6: Registro self-service del Portal del Cliente.
--
-- El cliente se da de alta solo desde /portal/registro: queda con cuenta ACTIVA
-- (clients.portal_approved_at = now()), con su MARKBOX al instante y una cuenta
-- de auth (login = MARKBOX + contraseña, contraseña inicial = cédula/RIF).
--
-- Esta migración suma SÓLO lo que la Fase 6 necesita en DB:
--   1. `clients.cedula_photo_path` — path en Storage de la foto de cédula/RIF
--      (identidad obligatoria; la REVISIÓN admin de la foto es trabajo futuro).
--   2. Bucket privado `client-docs` para esas fotos + RLS por tenant (admin del
--      tenant lee/escribe; cero acceso anon/público). El alta sube la foto con
--      service_role (el registrante es anónimo al subir), pero el ownership de
--      lectura queda scopeado por tenant = primer segmento del path. Espeja el
--      patrón de `shipment-docs` (migr 0086) y `receipt-photos`.
--
-- Aditiva, sin DDL destructivo. NO tocar RLS existente de clients/client_users.
-- Las RPCs (next_markbox) y la tabla client_users ya existen (0006 / 0080).
-- NO aplicar a prod (lo hace el founder).
-- ─────────────────────────────────────────────────────────────

-- 1. Path de la foto de identidad (cédula/RIF) en el bucket client-docs.
alter table public.clients
  add column if not exists cedula_photo_path text;

comment on column public.clients.cedula_photo_path is
  'SDD-0042 Fase 6: path en el bucket privado client-docs de la foto de cédula/RIF subida en el registro self-service. La revisión admin de la identidad es trabajo futuro.';

-- 2. Bucket privado · 8MB · imágenes (cédula/RIF; PDF no, son fotos).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-docs',
  'client-docs',
  false,
  8 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Storage RLS (espeja shipment-docs / receipt-photos: tenant = 1er segmento del path) ──
-- Path scheme: {tenant_id}/{markbox}/{uuid}.{ext}
-- service_role: el alta self-service sube con service_role (registrante anónimo).
create policy "client-docs service_role all"
  on storage.objects for all
  to service_role
  using (bucket_id = 'client-docs')
  with check (bucket_id = 'client-docs');

-- El equipo (admin del tenant) lee las fotos de su tenant (para revisar identidad).
create policy "client-docs tenant read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'client-docs'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

-- El equipo (admin del tenant) puede borrar fotos de su tenant.
create policy "client-docs tenant delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'client-docs'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

-- Sin policy de INSERT para authenticated/anon: el upload SOLO ocurre vía
-- service_role en el alta (registerClientAction). Cero acceso público/anon.
