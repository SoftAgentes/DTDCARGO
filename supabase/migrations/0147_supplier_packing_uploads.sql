-- ─────────────────────────────────────────────────────────────
-- SDD-0096 · Packing List online del proveedor + adjuntos por el link.
-- Extiende SDD-0057 (prealertas / página pública /p/{token}).
--
-- Hoy el proveedor chino abre /p/{token} y solo PUEDE DESCARGAR un Excel
-- pre-llenado. Esta migración habilita que LLENE el packing list ONLINE y lo
-- ENVÍE (guardado APPEND-ONLY + versionado por orden/prealerta — "graba 1, 2, 3
-- veces", el equipo ve el último + el historial), y que suba ARCHIVOS (re-subir
-- el Excel llenado + fotos del producto + cualquier otro documento) reusando
-- prealerta_documents (0118) + bucket prealerta-docs.
--
-- El insert lo hace el route handler público con admin client (service_role),
-- que bypassa RLS — el proveedor es anónimo (su capability es el token). El
-- versionado (flip is_current + insert) es ATÓMICO vía RPC submit_packing_list()
-- (calca add_document_version, 0116), serializando la cadena con advisory lock
-- (la 1ª versión no tiene fila-cabeza para FOR UPDATE → advisory lock cubre el
-- caso). Totales se reciben YA re-sumados por el route (no se confía en el
-- cliente; el route recomputa desde los números por fila).
--
-- Hardening (skills Supabase + lección project_rpc_anon_execute_debt): las RPCs
-- security-definer hacen REVOKE EXECUTE … FROM public, anon; submit_packing_list
-- queda SOLO service_role (path-servidor-de-confianza, como next_markbox_service
-- 0109). next_packing_list_folio: authenticated + service_role.
--
-- ⚠️ NO se aplica a prod desde acá (lo hace la coordinación / MCP). Número 0147
--    (0145/0146 ya ocupados en origin/main: academia_portal_read + ocean_rates_cache).
--    Aditiva: create type/table/function + ALTER ADD (default seguro), sin DDL
--    destructivo.
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. Tabla del envío · append-only + versionado por prealerta ║
-- ╚═══════════════════════════════════════════════════════════╝
create type packing_list_currency as enum ('USD', 'RMB', 'EUR');

create table public.packing_list_submissions (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  prealerta_id     uuid not null references public.prealertas(id) on delete cascade,
  client_markbox   text not null,                          -- denormalizado (filtros)
  -- Versionado de la cadena (cadena = prealerta_id dentro del tenant).
  version_no       int  not null default 1,
  is_current       boolean not null default true,
  -- Snapshot del contacto del PROVEEDOR (poder contactarlo). NO muta suppliers_cn.
  supplier_company text,
  supplier_contact text,
  supplier_email   text,
  supplier_wechat  text,
  supplier_phone   text,
  -- Cabecera del documento.
  currency         packing_list_currency not null default 'USD',
  doc_date         date,
  folio            text,                                   -- DTD-PL-YYYY-NNNN (RPC)
  supplier_note    text,
  -- Filas de mercancía: brand/code/zh/es/hs/carton/ctns/perctn/unit/wkg/cbm +
  -- computados por fila (qty/amount/weight/vol) — saneadas server-side.
  rows             jsonb not null default '[]'::jsonb,
  -- Totales AUTORITATIVOS (re-sumados server-side desde las filas numéricas).
  total_ctns       numeric(14,3) not null default 0,
  total_qty        numeric(14,3) not null default 0,
  total_amount     numeric(14,2) not null default 0,
  total_weight     numeric(14,3) not null default 0,
  total_cbm        numeric(14,4) not null default 0,
  -- Anti-abuso / auditoría (IP cruda = evidencia, no control de acceso).
  submit_ip        text,
  user_agent       text,
  created_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

comment on table public.packing_list_submissions is
  'SDD-0096: packing list + factura que el proveedor chino envía online desde /p/{token} (público, anónimo). Append-only + versionado por prealerta_id (is_current + version_no). Totales re-sumados server-side. Contacto del proveedor = snapshot (no muta suppliers_cn). RLS por tenant. Soft delete via deleted_at.';

-- Invariante: a lo sumo 1 versión vigente por orden (no borrada). La RPC DEBE
-- flipear is_current=false antes de insertar la nueva (en una transacción).
create unique index packing_list_submissions_one_current_per_prealerta
  on public.packing_list_submissions (prealerta_id)
  where is_current and deleted_at is null;

-- Historial: navegar la cadena de una orden ordenada por versión.
create index packing_list_submissions_chain_idx
  on public.packing_list_submissions (tenant_id, prealerta_id, version_no)
  where deleted_at is null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. GRANTS + RLS (calca prealerta_documents 0118)           ║
-- ╚═══════════════════════════════════════════════════════════╝
grant select, insert, update, delete on public.packing_list_submissions to authenticated;
grant all on public.packing_list_submissions to service_role;

alter table public.packing_list_submissions enable row level security;

-- Equipo (Studio): CRUD por tenant; lectura solo no-borradas.
create policy "packing_list_submissions by tenant"
  on public.packing_list_submissions for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- service_role: all (el route handler público inserta vía RPC con admin client).
create policy "packing_list_submissions service_role all"
  on public.packing_list_submissions for all
  to service_role
  using (true)
  with check (true);
-- Sin policy anon/public: el proveedor nunca toca la tabla; el token (capability)
-- lo resuelve el route, que escribe con service_role (bypassa RLS).

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. RPC next_packing_list_folio · DTD-PL-YYYY-NNNN          ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Calca next_estimate_code (0113): MAX(regexp)+1 por tenant+año, padding 4.
create or replace function public.next_packing_list_folio(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year   int := extract(year from current_date);
  v_max    int;
  v_padded text;
begin
  select coalesce(max((regexp_match(folio, '^DTD-PL-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.packing_list_submissions
  where tenant_id = p_tenant_id
    and folio like 'DTD-PL-' || v_year || '-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'DTD-PL-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_packing_list_folio is
  'SDD-0096: próximo folio DTD-PL-YYYY-NNNN por tenant + año (solo cuenta folios DTD-PL-). MAX(num)+1, padding 4 auto-extensible.';

-- Hardening: revocar de public/anon (lección project_rpc_anon_execute_debt; el
-- advisor flaggea security-definer ejecutable por anon). authenticated por si el
-- Studio la necesita; service_role la llama desde el route público.
revoke execute on function public.next_packing_list_folio(uuid) from public, anon;
grant execute on function public.next_packing_list_folio(uuid) to authenticated;
grant execute on function public.next_packing_list_folio(uuid) to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. RPC submit_packing_list · flip is_current + insert ATÓMICO ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Calca add_document_version (0116) pero para el path-servidor-de-confianza:
-- SOLO service_role (sin assert_tenant_match, como next_markbox_service 0109) —
-- el admin client no tiene tenant autenticado. Serializa la cadena (tenant +
-- prealerta) con advisory lock: la 1ª versión NO tiene fila-cabeza para FOR
-- UPDATE, así que el lock evita que dos envíos concurrentes inserten ambos
-- version_no=1 is_current=true (violación del índice único). version_no = max+1
-- contando TODAS las filas de la orden (monotónico aunque haya borradas).
--
-- ⚠️ search_path=public no incluye `extensions`: acá no se llama a extensions.*
--    (gen_random_uuid del id corre en el contexto de la tabla). hashtextextended
--    y pg_advisory_xact_lock son del catálogo pg_catalog (siempre en search_path).
create or replace function public.submit_packing_list(
  p_prealerta_id     uuid,
  p_tenant_id        uuid,
  p_client_markbox   text,
  p_currency         packing_list_currency,
  p_doc_date         date,
  p_supplier_company text,
  p_supplier_contact text,
  p_supplier_email   text,
  p_supplier_wechat  text,
  p_supplier_phone   text,
  p_supplier_note    text,
  p_rows             jsonb,
  p_total_ctns       numeric,
  p_total_qty        numeric,
  p_total_amount     numeric,
  p_total_weight     numeric,
  p_total_cbm        numeric,
  p_submit_ip        text,
  p_user_agent       text
) returns public.packing_list_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next  int;
  v_folio text;
  v_new   public.packing_list_submissions%rowtype;
begin
  if p_tenant_id is null then
    raise exception 'Tenant ID required' using errcode = '42501';
  end if;
  if p_prealerta_id is null then
    raise exception 'Prealerta ID required' using errcode = '22023';
  end if;
  if p_client_markbox is null or btrim(p_client_markbox) = '' then
    raise exception 'Shipping Mark required' using errcode = '22023';
  end if;

  -- Serializa la cadena (tenant+prealerta): dos envíos concurrentes del mismo
  -- proveedor → el 2º espera, recalcula version_no y no viola el índice único.
  perform pg_advisory_xact_lock(
    hashtextextended(p_tenant_id::text || ':' || p_prealerta_id::text, 0)
  );

  -- Próximo correlativo = max(version_no) de la orden (incluye borradas →
  -- monotónico) + 1.
  select coalesce(max(version_no), 0) + 1
  into v_next
  from public.packing_list_submissions
  where prealerta_id = p_prealerta_id;

  v_folio := public.next_packing_list_folio(p_tenant_id);

  -- 1) marcar las vigentes de la cadena como históricas (libera el unique parcial).
  update public.packing_list_submissions
  set is_current = false
  where prealerta_id = p_prealerta_id
    and is_current = true
    and deleted_at is null;

  -- 2) insertar la nueva versión vigente.
  insert into public.packing_list_submissions (
    tenant_id, prealerta_id, client_markbox, version_no, is_current,
    supplier_company, supplier_contact, supplier_email, supplier_wechat, supplier_phone,
    currency, doc_date, folio, supplier_note,
    rows, total_ctns, total_qty, total_amount, total_weight, total_cbm,
    submit_ip, user_agent
  ) values (
    p_tenant_id, p_prealerta_id, p_client_markbox, v_next, true,
    p_supplier_company, p_supplier_contact, p_supplier_email, p_supplier_wechat, p_supplier_phone,
    coalesce(p_currency, 'USD'), p_doc_date, v_folio, p_supplier_note,
    coalesce(p_rows, '[]'::jsonb),
    coalesce(p_total_ctns, 0), coalesce(p_total_qty, 0), coalesce(p_total_amount, 0),
    coalesce(p_total_weight, 0), coalesce(p_total_cbm, 0),
    p_submit_ip, p_user_agent
  )
  returning * into v_new;

  return v_new;
end;
$$;

comment on function public.submit_packing_list is
  'SDD-0096: envía un packing list del proveedor (flip is_current + insert atómico, calca add_document_version 0116). Serializa la cadena (tenant+prealerta) con advisory lock; version_no=max+1; deja exactamente 1 is_current. Totales se reciben ya re-sumados por el route. Append-only. Trusted-server path: SOLO service_role (sin assert_tenant_match, como next_markbox_service 0109).';

-- Hardening: trusted-server only. EXECUTE solo service_role (no forjable desde el
-- navegador con anon/authenticated key). Calca next_markbox_service (0109).
revoke all on function public.submit_packing_list(
  uuid, uuid, text, packing_list_currency, date,
  text, text, text, text, text, text, jsonb,
  numeric, numeric, numeric, numeric, numeric, text, text
) from public;
revoke all on function public.submit_packing_list(
  uuid, uuid, text, packing_list_currency, date,
  text, text, text, text, text, text, jsonb,
  numeric, numeric, numeric, numeric, numeric, text, text
) from anon;
revoke all on function public.submit_packing_list(
  uuid, uuid, text, packing_list_currency, date,
  text, text, text, text, text, text, jsonb,
  numeric, numeric, numeric, numeric, numeric, text, text
) from authenticated;
grant execute on function public.submit_packing_list(
  uuid, uuid, text, packing_list_currency, date,
  text, text, text, text, text, text, jsonb,
  numeric, numeric, numeric, numeric, numeric, text, text
) to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. Adjuntos del proveedor · extender prealerta_documents   ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Tipo nuevo para "cualquier otro documento" que suba el proveedor.
-- ⚠️ ALTER TYPE … ADD VALUE: no se USA en esta misma migración (solo se agrega)
--    → seguro en transacción (PG 12+). Si apply_migration se queja, mover a 0148.
alter type prealerta_doc_type add value if not exists 'otro';

-- Procedencia del adjunto: distingue la subida del proveedor (link público) de la
-- del cliente (portal) o el equipo. Las filas previas = 'client' (eran del portal).
alter table public.prealerta_documents
  add column if not exists source text not null default 'client'
    check (source in ('client', 'supplier', 'team'));

comment on column public.prealerta_documents.source is
  'SDD-0096: origen del adjunto — client (portal), supplier (link público /p/{token}), team (Studio).';

-- El bucket hoy SOLO acepta pdf + imágenes → ampliar para el Excel llenado
-- (re-subida) y "cualquier otro documento", y subir el límite (fotos de móvil).
update storage.buckets set
  allowed_mime_types = array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',   -- xlsx
    'application/vnd.ms-excel',                                            -- xls
    'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- docx
    'application/msword'                                                   -- doc
  ],
  file_size_limit = 15 * 1024 * 1024
where id = 'prealerta-docs';

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0147_supplier_packing_uploads.sql
-- Aplicar con: supabase migration apply 0147 · o MCP apply_migration
-- ─────────────────────────────────────────────────────────────
