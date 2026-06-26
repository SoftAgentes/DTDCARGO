-- ─────────────────────────────────────────────────────────────
-- SDD-0066 · Inspecciones de calidad · Fase 1 (fundación)
--
-- DTD re-captura los datos de una inspección de calidad (la ejecuta un
-- TERCERO en China) y emite un reporte WHITE-LABEL con marca DTD. Dos tipos:
--   · product_psi   — inspección de producto (AQL / PSI)   → DTD-QC-NNNN
--   · factory_audit — auditoría de fábrica (puntaje /100)   → DTD-FA-NNNN
--
-- WHITE-LABEL / CONFIDENCIALIDAD (regla dura del módulo):
--   El proveedor tercero y la entidad china se guardan SOLO en la columna
--   interna `provider_internal` — JAMÁS se renderiza en el reporte al cliente.
--   Las fotos / PDF crudo del tercero viven en Storage privado (bucket
--   `inspections`), nunca en git/seeds. Datos de cliente → DB con RLS.
--
-- Calca el patrón del DMS (0097_documentos_hub.sql): tabla con tenant_id +
-- soft delete, GRANTS explícitos, RLS fail-closed por tenant, bucket privado
-- por tenant (1er segmento del path = tenant_id) con 4 Storage policies. El
-- correlativo por tenant calca next_markbox_service (0109): security definer,
-- regexp sobre el max, lpad 4, y EXECUTE revocado de public/anon/authenticated
-- y otorgado solo a service_role (regla anti anon-execute).
--
-- Los sub-puntajes (AQL, defectos, pruebas, medidas, secciones legales, etc.)
-- viven en `payload jsonb` — el shape se valida en TypeScript (types.ts), no en
-- la DB, porque varía mucho entre los dos tipos de reporte.
--
-- NO se aplica a prod desde acá (lo hace el founder / MCP). Número 0176.
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. ENUMS                                                   ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Tipo del reporte. Decide el prefijo del correlativo y el builder.
create type inspection_type as enum (
  'product_psi',   -- inspección de producto (AQL / PSI) → DTD-QC-NNNN
  'factory_audit'  -- auditoría de fábrica (puntaje /100) → DTD-FA-NNNN
);

-- Conclusión del reporte (lo que ve el cliente como veredicto).
create type inspection_conclusion as enum (
  'approved',      -- aprobado
  'observations',  -- aprobado con observaciones
  'rejected'       -- rechazado
);

-- Estado de edición del reporte (no se publica `final` sin estar completo).
create type inspection_status as enum (
  'draft',   -- borrador (en captura)
  'final'    -- emitido / listo para el cliente
);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. TABLA inspection_reports                                ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.inspection_reports (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  report_no         text not null,                              -- DTD-QC-NNNN / DTD-FA-NNNN
  type              inspection_type not null,
  client_id         uuid references public.clients(id) on delete set null,
  client_name       text,                                       -- snapshot legible (opcional)
  title             text not null,
  product           text,
  inspection_date   date,
  duration_mandays  numeric,                                    -- días-hombre de la inspección
  score             int,                                        -- solo factory_audit (0..100)
  conclusion        inspection_conclusion,
  status            inspection_status not null default 'draft',
  payload           jsonb not null default '{}'::jsonb,         -- AQL, defectos, pruebas, medidas, secciones
  provider_internal text,                                       -- INTERNO · proveedor tercero · NUNCA al cliente
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,                                -- soft delete (auditable)
  -- score solo aplica a auditoría de fábrica y vive en 0..100.
  constraint inspection_reports_score_range check (
    score is null or (type = 'factory_audit' and score between 0 and 100)
  )
);

comment on table public.inspection_reports is
  'SDD-0066: reportes white-label de inspección de calidad (PSI / auditoría de fábrica). El proveedor tercero vive en provider_internal (INTERNO, nunca al cliente). Sub-datos en payload jsonb (shape validado en TS). Soft delete via deleted_at. RLS por tenant_id.';

comment on column public.inspection_reports.provider_internal is
  'INTERNO · nombre del proveedor de inspección (tercero / entidad china). NUNCA se renderiza en el reporte ni se envía al cliente. White-label.';

-- Correlativo único por tenant (ignora borrados).
create unique index inspection_reports_no_uq
  on public.inspection_reports (tenant_id, report_no)
  where deleted_at is null;

create index inspection_reports_tenant_type_idx
  on public.inspection_reports (tenant_id, type)
  where deleted_at is null;

create index inspection_reports_client_idx
  on public.inspection_reports (tenant_id, client_id)
  where deleted_at is null;

create index inspection_reports_date_idx
  on public.inspection_reports (tenant_id, inspection_date)
  where deleted_at is null;

-- GRANTS explícitos (auto-expose new tables OFF).
grant select, insert, update, delete on public.inspection_reports to authenticated;
grant all on public.inspection_reports to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. TABLA inspection_report_photos                          ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.inspection_report_photos (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  report_id     uuid not null references public.inspection_reports(id) on delete cascade,
  category      text,                                  -- ej. 'producto', 'embalaje', 'fabrica'
  caption       text,
  storage_path  text not null unique,                  -- {tenant}/{report}/{uuid}.{ext}
  redacted      boolean not null default false,        -- oculta marcas del tercero
  sort          int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

comment on table public.inspection_report_photos is
  'SDD-0066: fotos del reporte de inspección. Objetos crudos en el bucket privado `inspections`. redacted = oculta marcas del proveedor tercero (white-label). RLS por tenant_id.';

create index inspection_report_photos_report_idx
  on public.inspection_report_photos (tenant_id, report_id, sort)
  where deleted_at is null;

grant select, insert, update, delete on public.inspection_report_photos to authenticated;
grant all on public.inspection_report_photos to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. RLS de tabla · fail-closed por tenant (patrón 0097)     ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.inspection_reports enable row level security;

create policy "inspection_reports by tenant"
  on public.inspection_reports for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create policy "inspection_reports service_role all"
  on public.inspection_reports for all
  to service_role
  using (true)
  with check (true);

alter table public.inspection_report_photos enable row level security;

create policy "inspection_report_photos by tenant"
  on public.inspection_report_photos for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create policy "inspection_report_photos service_role all"
  on public.inspection_report_photos for all
  to service_role
  using (true)
  with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. Triggers updated_at (reusa touch_updated_at de 0002)    ║
-- ╚═══════════════════════════════════════════════════════════╝
create trigger inspection_reports_touch
  before update on public.inspection_reports
  for each row execute function public.touch_updated_at();

create trigger inspection_report_photos_touch
  before update on public.inspection_report_photos
  for each row execute function public.touch_updated_at();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. RPC correlativo por tenant + tipo (patrón next_markbox) ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Devuelve el próximo correlativo del reporte para (tenant, tipo). Prefijo según
-- el tipo: product_psi → DTD-QC-NNNN · factory_audit → DTD-FA-NNNN. MAX del
-- número parseado (regexp) + 1, lpad 4. security definer para leer todo el tenant
-- aunque la fila esté fuera del scope RLS del caller; el filtro por tenant_id es
-- explícito. EXECUTE solo para service_role (anti anon-execute): la action lo
-- llama server-side con el tenant ya resuelto vía RLS.
create or replace function public.next_inspection_report_no(
  p_tenant_id uuid,
  p_type      inspection_type
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_prefix text;
  v_max    int;
begin
  if p_tenant_id is null then
    raise exception 'Tenant ID required' using errcode = '42501';
  end if;

  v_prefix := case p_type
    when 'product_psi'   then 'DTD-QC-'
    when 'factory_audit' then 'DTD-FA-'
    else null
  end;
  if v_prefix is null then
    raise exception 'Unknown inspection type %', p_type using errcode = '22023';
  end if;

  select coalesce(
           max((regexp_match(report_no, '^' || v_prefix || '(\d+)$'))[1]::int),
           0
         ) + 1
    into v_max
    from public.inspection_reports
   where tenant_id = p_tenant_id
     and type = p_type;

  return v_prefix || lpad(v_max::text, 4, '0');
end;
$function$;

comment on function public.next_inspection_report_no is
  'SDD-0066: próximo correlativo del reporte por (tenant, tipo). DTD-QC-NNNN (PSI) / DTD-FA-NNNN (fábrica). EXECUTE solo service_role.';

revoke all on function public.next_inspection_report_no(uuid, inspection_type) from public;
revoke all on function public.next_inspection_report_no(uuid, inspection_type) from anon;
revoke all on function public.next_inspection_report_no(uuid, inspection_type) from authenticated;
grant execute on function public.next_inspection_report_no(uuid, inspection_type) to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. Bucket privado `inspections` + Storage RLS por tenant   ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Calca documents (0097): bucket privado, 25MB (PDF/foto del tercero pesan),
-- mimes acotados, 4 policies por tenant (1er segmento del path = tenant_id). Las
-- signed URLs se generan server-side. Path: {tenant}/{report}/{uuid}.{ext}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inspections',
  'inspections',
  false,
  25 * 1024 * 1024,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- service_role: all (signed URLs, workers).
create policy "inspections service_role all storage"
  on storage.objects for all
  to service_role
  using (bucket_id = 'inspections')
  with check (bucket_id = 'inspections');

-- tenant insert: el 1er segmento del path debe ser el tenant del caller.
create policy "inspections tenant insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'inspections'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

-- tenant read.
create policy "inspections tenant read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'inspections'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

-- tenant delete.
create policy "inspections tenant delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'inspections'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0176_inspecciones.sql
-- Aplicar con: supabase migration apply 0176 · o MCP apply_migration
-- ─────────────────────────────────────────────────────────────
