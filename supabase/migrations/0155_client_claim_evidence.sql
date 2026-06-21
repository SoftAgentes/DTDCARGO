-- ─────────────────────────────────────────────────────────────
-- SDD-0101 B2: Evidencia (fotos/documentos) de un reclamo.
--
-- Calca shipment_documents (0086): tabla que indexa objects del bucket
-- `claim-evidence` + bucket privado + RLS. El equipo (authenticated del tenant)
-- sube/lee/borra por tenant; el cliente del portal LEE las suyas por markbox
-- (policy aditiva). El cliente NO toca el bucket directo: sube vía la action del
-- portal con admin client; las signed URLs del portal se generan server-side con
-- admin (un cliente puro no matchea get_user_tenant_id() → no firma vía storage
-- RLS; el ownership ya lo garantiza la RLS de tabla por markbox antes de firmar).
--
-- Path scheme: {tenant_id}/{claim_id}/{uuid}.{ext}
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

create table public.client_claim_evidence (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  claim_id       uuid not null references public.client_claims(id) on delete cascade,
  client_markbox text,                                   -- denormalizado (lo fija el trigger)
  evidence_type  text not null default 'foto'
    check (evidence_type in ('foto', 'documento', 'otro')),
  storage_path   text not null,
  file_name      text not null,
  content_type   text,
  size_bytes     bigint,
  source         text not null default 'studio'
    check (source in ('studio', 'portal')),
  uploaded_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (storage_path)
);

comment on table public.client_claim_evidence is
  'SDD-0101 B2: evidencia (fotos/docs) de un reclamo, en bucket claim-evidence. client_markbox denormalizado (trigger) para la RLS del portal. Soft delete.';

create index client_claim_evidence_claim_idx
  on public.client_claim_evidence (claim_id) where deleted_at is null;
create index client_claim_evidence_tenant_idx
  on public.client_claim_evidence (tenant_id) where deleted_at is null;
create index client_claim_evidence_markbox_idx
  on public.client_claim_evidence (client_markbox) where deleted_at is null;

-- Trigger: valida que el claim sea del tenant y FUERZA el client_markbox del
-- claim (no forjable desde el insert). security definer (patrón clients_check_advisor).
create or replace function public.client_claim_evidence_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_markbox text;
begin
  select c.client_markbox into v_markbox
  from public.client_claims c
  where c.id = new.claim_id and c.tenant_id = new.tenant_id;

  if not found then
    raise exception 'claim_id % no pertenece al tenant %', new.claim_id, new.tenant_id
      using errcode = 'check_violation';
  end if;

  new.client_markbox := v_markbox;
  return new;
end;
$$;

revoke execute on function public.client_claim_evidence_check() from public, anon;

drop trigger if exists client_claim_evidence_check_trg on public.client_claim_evidence;
create trigger client_claim_evidence_check_trg
  before insert or update on public.client_claim_evidence
  for each row execute function public.client_claim_evidence_check();

-- GRANTS (auto-expose new tables OFF)
grant select, insert, update, delete on public.client_claim_evidence to authenticated;

-- RLS
alter table public.client_claim_evidence enable row level security;

-- Equipo: CRUD por tenant.
create policy "client_claim_evidence by tenant"
  on public.client_claim_evidence for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- Cliente del portal: LEE las suyas por markbox (aditiva, SELECT-only).
create policy "client_claim_evidence portal self read"
  on public.client_claim_evidence for select
  to authenticated
  using (
    deleted_at is null
    and client_markbox is not null
    and client_markbox = public.get_portal_client_markbox()
  );

-- ── Bucket privado · 10MB · PDF + imágenes ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'claim-evidence',
  'claim-evidence',
  false,
  10 * 1024 * 1024,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Storage RLS (por tenant = primer segmento del path; espeja shipment-docs) ──
create policy "claim-evidence service_role all"
  on storage.objects for all
  to service_role
  using (bucket_id = 'claim-evidence')
  with check (bucket_id = 'claim-evidence');

create policy "claim-evidence tenant insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'claim-evidence'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

create policy "claim-evidence tenant read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'claim-evidence'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

create policy "claim-evidence tenant delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'claim-evidence'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );
