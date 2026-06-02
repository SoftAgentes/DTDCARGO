-- ─────────────────────────────────────────────────────────────
-- SDD-0042 Fase 3b: Documentos del envío (BL / POD / otros) subibles por el
-- admin + visibles read-only en el Portal del Cliente.
--
-- Tabla `shipment_documents` (indexa objects del bucket `shipment-docs`) +
-- bucket privado + RLS. El equipo (authenticated del tenant) sube/lee/borra por
-- tenant; el cliente del portal LEE los suyos por markbox (policy aditiva). Las
-- signed URLs del portal se generan server-side con admin client (un cliente
-- puro NO matchea get_user_tenant_id(), así que NO puede firmar vía storage RLS;
-- el ownership ya lo garantiza la RLS de tabla por markbox antes de firmar).
--
-- Path scheme en el bucket: {tenant_id}/{shipment_id}/{uuid}.{ext}
-- ─────────────────────────────────────────────────────────────

create type shipment_doc_type as enum ('bl', 'pod', 'otro');

create table public.shipment_documents (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  shipment_id    uuid not null references public.shipments(id) on delete cascade,
  client_markbox text,                                   -- denormalizado para la RLS del portal
  doc_type       shipment_doc_type not null default 'otro',
  storage_path   text not null,
  file_name      text not null,
  content_type   text,
  size_bytes     bigint,
  uploaded_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (storage_path)
);

comment on table public.shipment_documents is
  'SDD-0042 Fase 3b: documentos del envío (BL/POD/otros) en bucket shipment-docs. client_markbox denormalizado para la RLS del portal. Soft delete via deleted_at.';

create index shipment_documents_shipment_idx
  on public.shipment_documents (shipment_id) where deleted_at is null;
create index shipment_documents_tenant_idx
  on public.shipment_documents (tenant_id) where deleted_at is null;
create index shipment_documents_markbox_idx
  on public.shipment_documents (client_markbox) where deleted_at is null;

-- GRANTS (auto-expose new tables OFF)
grant select, insert, update, delete on public.shipment_documents to authenticated;

-- RLS
alter table public.shipment_documents enable row level security;

-- Equipo: CRUD por tenant.
create policy "shipment_documents by tenant"
  on public.shipment_documents for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- Cliente del portal: LEE los suyos por markbox (aditiva, SELECT-only).
create policy "shipment_documents portal self read"
  on public.shipment_documents for select
  to authenticated
  using (
    deleted_at is null
    and client_markbox is not null
    and client_markbox = public.get_portal_client_markbox()
  );

-- Trigger updated_at no aplica (sin columna updated_at; los docs no se editan,
-- se reemplazan borrando + subiendo).

-- ── Bucket privado · 10MB · PDF + imágenes ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shipment-docs',
  'shipment-docs',
  false,
  10 * 1024 * 1024,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Storage RLS (espeja receipt-photos: por tenant = primer segmento del path) ──
create policy "shipment-docs service_role all"
  on storage.objects for all
  to service_role
  using (bucket_id = 'shipment-docs')
  with check (bucket_id = 'shipment-docs');

create policy "shipment-docs tenant insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'shipment-docs'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

create policy "shipment-docs tenant read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'shipment-docs'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

create policy "shipment-docs tenant delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'shipment-docs'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );
