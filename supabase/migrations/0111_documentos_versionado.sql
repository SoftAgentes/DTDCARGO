-- ─────────────────────────────────────────────────────────────
-- SDD-0060 · Documentos · Versionado — Slice A (foundation)
--
-- Capa 2 de SDD-0049 (Hub DMS). Agrega revisiones APPEND-ONLY a un
-- documento ya subido: una CADENA de versiones dentro de la MISMA tabla
-- `documents` (root_id + version_no + supersedes_id + is_current), sin
-- reescribir nada de 0049 (reusa su RLS, trigger polimórfico, bucket,
-- signed-URLs y derivación de estado).
--
-- Modelo de la cadena:
--   - root_id      = cabeza lógica de la cadena (la v1 apunta a sí misma).
--   - version_no   = correlativo dentro de la cadena (1, 2, 3…).
--   - supersedes_id= versión anterior directa (null en la v1).
--   - is_current   = marca la versión vigente (a lo sumo 1 por cadena).
--   - version_note = nota opcional de la revisión.
--
-- Invariante de integridad (no solo convención): índice único parcial
-- documents_one_current_per_root → a lo sumo 1 versión vigente por cadena.
--
-- La subida de una nueva versión es ATÓMICA vía RPC SECURITY DEFINER
-- add_document_version() (flip is_current + insert en una transacción):
-- evita la ventana no-atómica de 2 round-trips PostgREST y la violación
-- del índice único; centraliza la herencia de entity_type/entity_id/folder
-- de la cabeza vigente (la nueva versión NO se re-parametriza).
--
-- ⚠️ NO se aplica a prod desde acá (lo hace el founder / MCP). Número 0111
--    (0110 lo toma SDD-0059). Aditiva: ALTER ADD COLUMN con default seguro,
--    sin DDL destructivo.
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. COLUMNAS NUEVAS en public.documents (default seguro)    ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Todas con default que deja toda fila previa como cadena de 1: root_id se
-- backfillea abajo (no se puede default a la propia PK en ADD COLUMN).
alter table public.documents
  add column if not exists root_id       uuid,
  add column if not exists version_no    int not null default 1,
  add column if not exists supersedes_id uuid references public.documents(id) on delete set null,
  add column if not exists is_current    boolean not null default true,
  add column if not exists version_note  text;

comment on column public.documents.root_id is
  'SDD-0060: cabeza lógica de la cadena de versiones (la v1 apunta a sí misma).';
comment on column public.documents.version_no is
  'SDD-0060: correlativo dentro de la cadena (1, 2, 3…).';
comment on column public.documents.supersedes_id is
  'SDD-0060: versión anterior directa de la cadena (null en la v1).';
comment on column public.documents.is_current is
  'SDD-0060: marca la versión vigente de la cadena (a lo sumo 1 por root).';
comment on column public.documents.version_note is
  'SDD-0060: nota opcional de la revisión ("corregido el monto", "firmado por aduana").';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. BACKFILL · toda fila previa = cadena de 1               ║
-- ╚═══════════════════════════════════════════════════════════╝
-- root_id = id, version_no = 1, is_current = true, supersedes_id = null.
update public.documents
set root_id       = id,
    version_no    = coalesce(version_no, 1),
    is_current    = coalesce(is_current, true),
    supersedes_id = null
where root_id is null;

-- root_id pasa a NOT NULL tras el backfill.
alter table public.documents
  alter column root_id set not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. ÍNDICES de la cadena                                    ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Invariante: a lo sumo 1 versión vigente por cadena (no borrada). Único
-- parcial → la RPC DEBE flipear is_current=false en la actual antes de
-- insertar la nueva (lo hace en una transacción).
create unique index if not exists documents_one_current_per_root
  on public.documents (root_id)
  where is_current and deleted_at is null;

-- Historial: navegar la cadena (tenant + root, ordenada por versión).
create index if not exists documents_chain_idx
  on public.documents (tenant_id, root_id, version_no)
  where deleted_at is null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. RPC add_document_version · flip + insert ATÓMICO        ║
-- ╚═══════════════════════════════════════════════════════════╝
-- SECURITY DEFINER + set search_path = public (patrón next_booking_code /
-- next_consolidation_ref / get_user_tenant_id). Tenant-safe: resuelve el
-- tenant del caller y valida que la cadena le pertenezca (fail-closed ante
-- cross-tenant / inexistente / borrada). La nueva versión HEREDA
-- entity_type/entity_id/folder de la cabeza vigente — una "nueva versión"
-- es el mismo documento lógico corregido, no un re-archivado.
--
-- ⚠️ search_path=public no incluye el schema `extensions`: NO se usan
--    funciones de extensión acá (no hace falta gen_random_*; el id lo da el
--    default de la tabla, que sí corre con su propio search_path). Lección
--    feedback_search_path_extensions_qualifier — aplica solo si se llamara a
--    extensions.* dentro de la función, que NO es el caso.
create or replace function public.add_document_version(
  p_root         uuid,
  p_storage_path text,
  p_name         text,
  p_content_type text,
  p_size_bytes   bigint,
  p_status       document_status,
  p_valid_until  date,
  p_doc_type     text,
  p_version_note text
) returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant  uuid := public.get_user_tenant_id();
  v_current public.documents%rowtype;
  v_next    int;
  v_new     public.documents%rowtype;
begin
  if v_tenant is null then
    raise exception 'sin tenant: usuario no autenticado o sin membresía'
      using errcode = 'insufficient_privilege';
  end if;

  -- Cabeza vigente de la cadena, del MISMO tenant y no borrada (fail-closed).
  -- El lock evita carreras de dos subidas concurrentes a la misma cadena
  -- (la segunda espera, recalcula version_no y no viola el índice único).
  select * into v_current
  from public.documents
  where root_id = p_root
    and tenant_id = v_tenant
    and is_current = true
    and deleted_at is null
  for update;

  if not found then
    raise exception 'cadena de versiones inexistente, borrada o ajena al tenant: %', p_root
      using errcode = 'no_data_found';
  end if;

  -- Próximo correlativo = max(version_no) de la cadena (no borrada) + 1.
  select coalesce(max(version_no), 0) + 1
  into v_next
  from public.documents
  where root_id = p_root
    and tenant_id = v_tenant
    and deleted_at is null;

  -- 1) marca la actual como histórica (libera el índice único parcial).
  update public.documents
  set is_current = false
  where id = v_current.id;

  -- 2) inserta la nueva versión vigente, heredando entity/folder de la cabeza.
  --    El trigger documents_validate_entity corre acá igual (defensa en profundidad).
  insert into public.documents (
    tenant_id, entity_type, entity_id, folder, doc_type, name,
    storage_path, content_type, size_bytes, status, valid_until,
    uploaded_by, root_id, version_no, supersedes_id, is_current, version_note
  ) values (
    v_tenant, v_current.entity_type, v_current.entity_id, v_current.folder,
    p_doc_type, p_name, p_storage_path, p_content_type, p_size_bytes, p_status,
    p_valid_until, auth.uid(), p_root, v_next, v_current.id, true, p_version_note
  )
  returning * into v_new;

  return v_new;
end;
$$;

comment on function public.add_document_version is
  'SDD-0060: sube una nueva versión a la cadena p_root (flip is_current + insert atómico). Tenant-safe: valida que la cabeza vigente sea del tenant del caller (fail-closed); hereda entity_type/entity_id/folder de la cabeza; calcula version_no=max+1 y supersedes_id; deja exactamente 1 is_current. Append-only (el object anterior se conserva).';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. GRANTS                                                  ║
-- ╚═══════════════════════════════════════════════════════════╝
-- RLS de tabla + el filtro por tenant explícito en la función cubren el
-- aislamiento (mismo criterio que las RPCs next_* del repo). El trigger
-- documents_validate_entity igual corre sobre el insert.
grant execute on function public.add_document_version(
  uuid, text, text, text, bigint, document_status, date, text, text
) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0111_documentos_versionado.sql
-- Aplicar con: supabase migration apply 0111 · o MCP apply_migration
-- ─────────────────────────────────────────────────────────────
