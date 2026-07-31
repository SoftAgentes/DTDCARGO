-- SDD-0224 · Metadatos canónicos del ciclo de vida del adjunto.

alter table public.documents
  add column if not exists bucket_id text not null default 'documents',
  add column if not exists object_key text,
  add column if not exists original_name text,
  add column if not exists canonical_mime text,
  add column if not exists sha256 text,
  add column if not exists attachment_status text not null default 'guardado',
  add column if not exists scan_status text not null default 'legacy',
  add column if not exists backup_status text not null default 'not_required',
  add column if not exists backed_up_at timestamptz,
  add column if not exists idempotency_key uuid,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text,
  add column if not exists quarantine_until timestamptz,
  add column if not exists retention_class text not null default 'operational',
  add column if not exists legal_hold boolean not null default false;

update public.documents
set object_key = storage_path,
    original_name = coalesce(original_name, name),
    canonical_mime = coalesce(canonical_mime, content_type)
where object_key is null
   or original_name is null
   or canonical_mime is null;

alter table public.documents
  alter column object_key set not null,
  add constraint documents_sha256_format check (
    sha256 is null or sha256 ~ '^[0-9a-f]{64}$'
  ),
  add constraint documents_attachment_status_check check (
    attachment_status in (
      'reservado', 'subiendo', 'guardado', 'verificando', 'cuarentena',
      'disponible', 'protegido', 'fallido', 'eliminado'
    )
  ),
  add constraint documents_scan_status_check check (
    scan_status in ('legacy', 'pending', 'clean', 'infected', 'failed')
  ),
  add constraint documents_backup_status_check check (
    backup_status in ('not_required', 'pending', 'running', 'verified', 'failed')
  ),
  add constraint documents_retention_class_check check (
    retention_class in ('operational', 'financial', 'legal')
  );

create unique index if not exists documents_bucket_object_key_uidx
  on public.documents (bucket_id, object_key);

create unique index if not exists documents_tenant_idempotency_uidx
  on public.documents (tenant_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists documents_attachment_status_idx
  on public.documents (tenant_id, attachment_status, created_at)
  where deleted_at is null;

create or replace function public.documents_sync_storage_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.object_key is null then
    new.object_key := new.storage_path;
  end if;
  if new.storage_path is null then
    new.storage_path := new.object_key;
  end if;
  if new.object_key <> new.storage_path then
    raise exception 'object_key y storage_path deben identificar el mismo objeto'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists documents_sync_storage_identity_trg on public.documents;
create trigger documents_sync_storage_identity_trg
  before insert or update of object_key, storage_path on public.documents
  for each row execute function public.documents_sync_storage_identity();

comment on column public.documents.object_key is
  'SDD-0224: clave exacta generada por servidor. No acepta paths elegidos por el cliente.';
comment on column public.documents.attachment_status is
  'SDD-0224: estado técnico independiente del estado de negocio del documento.';

