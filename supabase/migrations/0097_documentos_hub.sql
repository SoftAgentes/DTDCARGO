-- ─────────────────────────────────────────────────────────────
-- SDD-0049 · Documentos · Hub (DMS) — Slice A (foundation)
--
-- El hub central de adjuntos: una entidad `documents` POLIMÓRFICA
-- (entity_type + entity_id) que cualquier transacción del ERP puede
-- adjuntar (embarque, factura, CxP, pago, asiento, cliente, proveedor,
-- contenedor, booking — o `none` = sin transacción). GENERALIZA el patrón
-- de `shipment_documents` (0086): bucket privado por tenant + 4 Storage
-- policies por tenant (1er segmento del path = tenant_id) + RLS de tabla
-- fail-closed por tenant + validación en DB de la tabla polimórfica.
--
-- Coexiste con `shipment_documents` (0086) — NO lo migra (§4.1): aquel
-- sigue siendo portal-facing (RLS por markbox); `documents` es el DMS
-- interno genérico.
--
-- Path scheme en el bucket: {tenant_id}/{entity_type}/{entity_id|none}/{uuid}.{ext}
--
-- ⚠️ Validación en DB de la tabla polimórfica (lección SDD-0045, memoria
--    feedback_polymorphic_table_db_validation): la server action valida,
--    PERO un cliente Supabase directo (PostgREST) la saltaría. El trigger
--    BEFORE INSERT/UPDATE + helper *_in_tenant() defienden en la DB → cubren
--    TODO cliente, no solo la action.
--
-- vencido / por-vencer NO se persisten como status — se DERIVAN de
-- valid_until en código (lib/studio/documents/types.ts · deriveDocStatus).
--
-- NO se aplica a prod desde acá (lo hace el founder / MCP). Número 0097.
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. ENUMS                                                   ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Tipo de la transacción a la que se adjunta el documento. `none` = sin
-- transacción (plantillas, internos, estados de cuenta sueltos). El set
-- mapea 1:1 a una tabla real en el helper document_entity_in_tenant().
create type document_entity_type as enum (
  'shipment',
  'invoice',
  'supplier_bill',
  'supplier_payment',
  'journal_entry',
  'client',
  'supplier',
  'consolidation',
  'booking',
  'none'
);

-- Estados PERSISTIDOS (campo libre operativo). vencido/por-vencer NO van acá:
-- se derivan de valid_until en código (deriveDocStatus).
create type document_status as enum (
  'firmado',
  'vigente',
  'pendiente',
  'borrador'
);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. TABLA documents · adjuntos polimórficos                ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  entity_type   document_entity_type not null default 'none',
  entity_id     uuid,                                  -- null sii entity_type = 'none'
  folder        text not null,                         -- id de subcarpeta del taxonomy fijo (ej. 'log-bl')
  doc_type      text,                                  -- texto libre legible (ej. "BL marítimo")
  name          text not null,
  storage_path  text not null unique,                  -- {tenant}/{type}/{id|none}/{uuid}.{ext}
  content_type  text,
  size_bytes    bigint,
  status        document_status not null default 'vigente',
  valid_until   date,                                  -- vencido/por-vencer se derivan de acá
  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,                           -- soft delete (auditable)
  -- coherencia entity_type ↔ entity_id: 'none' ⇒ sin id; cualquier otro ⇒ con id
  constraint documents_entity_id_coherent check (
    (entity_type = 'none' and entity_id is null)
    or (entity_type <> 'none' and entity_id is not null)
  )
);

comment on table public.documents is
  'SDD-0049: hub central de adjuntos (DMS). Polimórfico por (entity_type, entity_id) — generaliza shipment_documents (0086) a cualquier transacción. folder = id de subcarpeta del taxonomy fijo del Norte. vencido/por-vencer se derivan de valid_until en código. Soft delete via deleted_at. RLS por tenant_id. Coexiste con shipment_documents (portal-facing), no lo migra.';

create index documents_entity_idx
  on public.documents (tenant_id, entity_type, entity_id)
  where deleted_at is null;

create index documents_folder_idx
  on public.documents (tenant_id, folder)
  where deleted_at is null;

create index documents_valid_until_idx
  on public.documents (tenant_id, valid_until)
  where deleted_at is null and valid_until is not null;

-- GRANTS explícitos (auto-expose new tables OFF)
grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. RLS de tabla · fail-closed por tenant (patrón 0086/0090)║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.documents enable row level security;

-- Equipo: CRUD por tenant (lectura solo no-borradas).
create policy "documents by tenant"
  on public.documents for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- service_role full access (workers, migraciones de datos, signed URLs).
create policy "documents service_role all"
  on public.documents for all
  to service_role
  using (true)
  with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. Trigger updated_at (reusa touch_updated_at de 0002)    ║
-- ╚═══════════════════════════════════════════════════════════╝
create trigger documents_touch
  before update on public.documents
  for each row execute function public.touch_updated_at();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. Validación DB de la tabla polimórfica (no negociable)  ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Helper: ¿la entidad adjuntada existe, es del tipo correcto y del tenant?
-- Polimórfico (entity_type + entity_id, sin FK por diseño). CASE sobre las 9
-- tablas adjuntables (todas con tenant_id + deleted_at). SECURITY DEFINER para
-- no depender del grant SELECT de cada tabla al rol authenticated; el filtro
-- por tenant_id es explícito (el trigger pasa NEW.tenant_id, que RLS ya forzó =
-- tenant del caller), así que no hay fuga cross-tenant.
-- `none` o entity_id null → true (salta la validación; ya lo acota el CHECK
-- documents_entity_id_coherent).
create or replace function public.document_entity_in_tenant(
  p_type   document_entity_type,
  p_id     uuid,
  p_tenant uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ok boolean := false;
begin
  if p_type = 'none' or p_id is null then
    return true;
  end if;

  case p_type
    when 'shipment' then
      select exists(select 1 from public.shipments where id = p_id and tenant_id = p_tenant and deleted_at is null) into ok;
    when 'invoice' then
      select exists(select 1 from public.invoices where id = p_id and tenant_id = p_tenant and deleted_at is null) into ok;
    when 'supplier_bill' then
      select exists(select 1 from public.supplier_bills where id = p_id and tenant_id = p_tenant and deleted_at is null) into ok;
    when 'supplier_payment' then
      select exists(select 1 from public.supplier_payments where id = p_id and tenant_id = p_tenant and deleted_at is null) into ok;
    when 'journal_entry' then
      select exists(select 1 from public.journal_entries where id = p_id and tenant_id = p_tenant and deleted_at is null) into ok;
    when 'client' then
      select exists(select 1 from public.clients where id = p_id and tenant_id = p_tenant and deleted_at is null) into ok;
    when 'supplier' then
      select exists(select 1 from public.suppliers where id = p_id and tenant_id = p_tenant and deleted_at is null) into ok;
    when 'consolidation' then
      select exists(select 1 from public.consolidations where id = p_id and tenant_id = p_tenant and deleted_at is null) into ok;
    when 'booking' then
      select exists(select 1 from public.bookings where id = p_id and tenant_id = p_tenant and deleted_at is null) into ok;
    else
      ok := false; -- tipo desconocido → rechaza (fail-closed; el enum ya acota el set)
  end case;

  return ok;
end;
$$;

comment on function public.document_entity_in_tenant is
  'SDD-0049: ¿(entity_type, entity_id) existe, es del tipo correcto y del tenant? Polimórfico (sin FK). none/null → true. Defiende contra entity_id forjado vía PostgREST directo.';

-- Trigger BEFORE INSERT OR UPDATE: rechaza entity inexistente / wrong-type / de
-- otro tenant. Cubre TODO cliente (no solo la server action). `none` pasa.
create or replace function public.documents_validate_entity()
returns trigger
language plpgsql
as $$
begin
  if not public.document_entity_in_tenant(new.entity_type, new.entity_id, new.tenant_id) then
    raise exception 'documento sobre entidad inexistente, de otro tipo o ajena al tenant: %/%', new.entity_type, new.entity_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists documents_validate_entity_trg on public.documents;
create trigger documents_validate_entity_trg
  before insert or update on public.documents
  for each row execute function public.documents_validate_entity();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. Bucket privado `documents` + Storage RLS por tenant    ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Calca shipment-docs (0086): bucket privado, 10MB, mimes acotados, 4 policies
-- por tenant (1er segmento del path = tenant_id). Las signed URLs se generan
-- server-side (Slice B). Path: {tenant}/{type}/{id|none}/{uuid}.{ext}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10 * 1024 * 1024,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  -- xlsx
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  -- docx
    'application/zip'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- service_role: all (signed URLs, workers).
create policy "documents service_role all storage"
  on storage.objects for all
  to service_role
  using (bucket_id = 'documents')
  with check (bucket_id = 'documents');

-- tenant insert: el 1er segmento del path debe ser el tenant del caller.
create policy "documents tenant insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

-- tenant read.
create policy "documents tenant read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

-- tenant delete.
create policy "documents tenant delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0097_documentos_hub.sql
-- Aplicar con: supabase migration apply 0097 · o MCP apply_migration
-- ─────────────────────────────────────────────────────────────
