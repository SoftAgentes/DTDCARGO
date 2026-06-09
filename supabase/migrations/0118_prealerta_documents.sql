-- ─────────────────────────────────────────────────────────────
-- SDD-0057 (extensión) · Adjuntos de la compra/prealerta — subibles por el
-- CLIENTE del portal al registrar su compra.
--
-- El cliente adjunta (opcional) el packing list, la factura del proveedor, fotos
-- del producto y una captura del WhatsApp/WeChat del proveedor. Calca el patrón
-- portal-facing de `shipment_documents` (0086): tabla que indexa objects de un
-- bucket privado + `client_markbox` denormalizado para la RLS del portal.
--
-- DIFERENCIA con 0086: la SUBIDA la hace el server action con admin client
-- (service_role), NO el cliente directo — por eso las Storage policies de abajo
-- son solo service_role + equipo (por tenant). El cliente LEE sus adjuntos por
-- markbox (RLS de tabla) y las signed URLs se generan server-side con admin.
--
-- Path scheme en el bucket: {tenant_id}/{prealerta_id}/{uuid}.{ext}
--
-- El WeChat/WhatsApp (número o ID) del proveedor NO necesita columna nueva: reusa
-- `suppliers_cn.wechat` (0105). Acá solo van los ARCHIVOS.
--
-- NO se aplica a prod desde acá (lo hace el founder / MCP). Número 0118.
-- ─────────────────────────────────────────────────────────────

create type prealerta_doc_type as enum ('packing', 'factura', 'foto', 'whatsapp');

create table public.prealerta_documents (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  prealerta_id   uuid not null references public.prealertas(id) on delete cascade,
  client_markbox text,                                   -- denormalizado para la RLS del portal
  doc_type       prealerta_doc_type not null default 'foto',
  storage_path   text not null,
  file_name      text not null,
  content_type   text,
  size_bytes     bigint,
  uploaded_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (storage_path)
);

comment on table public.prealerta_documents is
  'SDD-0057 ext: adjuntos de la compra/prealerta (packing/factura/foto/whatsapp) en bucket prealerta-docs. client_markbox denormalizado para la RLS del portal. Subida server-side con admin client; lectura del cliente por markbox. Soft delete via deleted_at.';

create index prealerta_documents_prealerta_idx
  on public.prealerta_documents (prealerta_id) where deleted_at is null;
create index prealerta_documents_tenant_idx
  on public.prealerta_documents (tenant_id) where deleted_at is null;
create index prealerta_documents_markbox_idx
  on public.prealerta_documents (client_markbox) where deleted_at is null;

-- GRANTS (auto-expose new tables OFF)
grant select, insert, update, delete on public.prealerta_documents to authenticated;
grant all on public.prealerta_documents to service_role;

-- RLS
alter table public.prealerta_documents enable row level security;

-- Equipo: CRUD por tenant.
create policy "prealerta_documents by tenant"
  on public.prealerta_documents for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- Cliente del portal: LEE los suyos por markbox (aditiva, SELECT-only). La
-- escritura la hace el server action con admin client (service_role).
create policy "prealerta_documents portal self read"
  on public.prealerta_documents for select
  to authenticated
  using (
    deleted_at is null
    and client_markbox is not null
    and client_markbox = public.get_portal_client_markbox()
  );

-- service_role: all (subida server-side, signed URLs, workers).
create policy "prealerta_documents service_role all"
  on public.prealerta_documents for all
  to service_role
  using (true)
  with check (true);

-- ── Bucket privado · 10MB · PDF + imágenes (incl. heic/heif de iPhone) ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'prealerta-docs',
  'prealerta-docs',
  false,
  10 * 1024 * 1024,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Storage RLS (por tenant = primer segmento del path; espeja shipment-docs) ──
-- La subida real la hace service_role (server action con admin client); el equipo
-- puede leer/subir/borrar por tenant. El cliente del portal NO toca Storage: lee
-- vía signed URLs generadas server-side con admin.
create policy "prealerta-docs service_role all"
  on storage.objects for all
  to service_role
  using (bucket_id = 'prealerta-docs')
  with check (bucket_id = 'prealerta-docs');

create policy "prealerta-docs tenant insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'prealerta-docs'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

create policy "prealerta-docs tenant read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'prealerta-docs'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

create policy "prealerta-docs tenant delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'prealerta-docs'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0118_prealerta_documents.sql
-- Aplicar con: supabase migration apply 0118 · o MCP apply_migration
-- ─────────────────────────────────────────────────────────────
