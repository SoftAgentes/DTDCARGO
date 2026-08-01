-- SDD-0224 · Reserva durable e idempotente previa a una subida TUS.

create table public.document_upload_intents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null unique,
  entity_type text not null,
  entity_id uuid not null,
  folder text not null,
  doc_type text,
  original_name text not null,
  declared_mime text not null,
  declared_size bigint not null check (declared_size > 0),
  bucket_id text not null default 'erp-attachments',
  object_key text not null,
  idempotency_key uuid not null,
  status text not null default 'reserved'
    check (status in ('reserved', 'uploading', 'uploaded', 'finalized', 'expired', 'failed')),
  expires_at timestamptz not null default (now() + interval '20 minutes'),
  finalized_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key),
  unique (bucket_id, object_key)
);

alter table public.document_upload_intents enable row level security;

create policy "document upload intents own tenant read"
  on public.document_upload_intents for select to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and user_id = auth.uid()
  );

create policy "document upload intents service role all"
  on public.document_upload_intents for all to service_role
  using (true) with check (true);

grant select on public.document_upload_intents to authenticated;
grant all on public.document_upload_intents to service_role;

create trigger document_upload_intents_touch
  before update on public.document_upload_intents
  for each row execute function public.touch_updated_at();

alter table public.documents
  add column if not exists upload_intent_id uuid
    references public.document_upload_intents(id) on delete set null;

create unique index if not exists documents_upload_intent_uidx
  on public.documents (upload_intent_id)
  where upload_intent_id is not null;

comment on table public.document_upload_intents is
  'SDD-0224: reservas server-side para subida TUS. Nunca persiste tokens ni URLs firmadas.';

