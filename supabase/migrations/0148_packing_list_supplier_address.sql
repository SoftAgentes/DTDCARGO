-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ SDD-0097 · Persistir dirección + ciudad del proveedor en el submit   ║
-- ║ del packing list (cierra el follow-up de Slice A).                    ║
-- ╚════════════════════════════════════════════════════════════════════╝
-- Hoy el form recoge dirección/ciudad del proveedor pero solo viven en el
-- DOCUMENTO + el borrador localStorage: al ENVIAR se pierden (no hay columna).
-- Esta migración los persiste como snapshot, igual que supplier_company/contact/…
--
-- Aditiva + backward-compatible:
--   1) 2 columnas nullable (filas viejas intactas).
--   2) extiende submit_packing_list (SDD-0096, migr 0147) con 2 params NUEVOS
--      TRAILING con DEFAULT NULL → el código viejo (19 args con nombre) sigue
--      resolviendo contra la función nueva (los 2 caen a null) y el nuevo (21
--      args) también. CERO-downtime sea cual sea el orden migración↔deploy.
--
-- ⚠️ La firma cambia → DROP + CREATE (create-or-replace no puede agregar params:
--    cambia la identidad). No quedan overloads → sin ambigüedad de PostgREST.
--    Defaults TRAILING porque Postgres exige que todo param con default vaya
--    después de los que no lo tienen. Re-aplica el hardening de grants sobre la
--    firma NUEVA completa (revoke public/anon/authenticated; grant solo
--    service_role) — calca 0147. security definer + set search_path = public.

-- 1) Columnas nuevas (snapshot del proveedor; no muta suppliers_cn).
alter table public.packing_list_submissions
  add column if not exists supplier_address text,
  add column if not exists supplier_city    text;

-- 2) Drop de la firma vieja (19 params) — la firma cambia.
drop function if exists public.submit_packing_list(
  uuid, uuid, text, packing_list_currency, date,
  text, text, text, text, text, text, jsonb,
  numeric, numeric, numeric, numeric, numeric, text, text
);

-- 3) Recreación: 19 params originales en su MISMA posición + 2 trailing default.
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
  p_user_agent       text,
  p_supplier_address text default null,
  p_supplier_city    text default null
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

  -- 2) insertar la nueva versión vigente (con dirección/ciudad del proveedor).
  insert into public.packing_list_submissions (
    tenant_id, prealerta_id, client_markbox, version_no, is_current,
    supplier_company, supplier_contact, supplier_email, supplier_wechat, supplier_phone,
    supplier_address, supplier_city,
    currency, doc_date, folio, supplier_note,
    rows, total_ctns, total_qty, total_amount, total_weight, total_cbm,
    submit_ip, user_agent
  ) values (
    p_tenant_id, p_prealerta_id, p_client_markbox, v_next, true,
    p_supplier_company, p_supplier_contact, p_supplier_email, p_supplier_wechat, p_supplier_phone,
    p_supplier_address, p_supplier_city,
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
  'SDD-0096/0097: envía un packing list del proveedor (flip is_current + insert atómico, calca add_document_version 0116). Serializa la cadena (tenant+prealerta) con advisory lock; version_no=max+1; deja exactamente 1 is_current. Incluye snapshot de dirección/ciudad del proveedor (0097, params trailing default → backward-compatible con callers de 0096). Totales re-sumados por el route. Append-only. Trusted-server path: SOLO service_role.';

-- 4) Hardening sobre la firma NUEVA (21 types): trusted-server only. EXECUTE solo
--    service_role (no forjable desde el navegador con anon/authenticated). Calca 0147.
revoke all on function public.submit_packing_list(
  uuid, uuid, text, packing_list_currency, date,
  text, text, text, text, text, text, jsonb,
  numeric, numeric, numeric, numeric, numeric, text, text, text, text
) from public;
revoke all on function public.submit_packing_list(
  uuid, uuid, text, packing_list_currency, date,
  text, text, text, text, text, text, jsonb,
  numeric, numeric, numeric, numeric, numeric, text, text, text, text
) from anon;
revoke all on function public.submit_packing_list(
  uuid, uuid, text, packing_list_currency, date,
  text, text, text, text, text, text, jsonb,
  numeric, numeric, numeric, numeric, numeric, text, text, text, text
) from authenticated;
grant execute on function public.submit_packing_list(
  uuid, uuid, text, packing_list_currency, date,
  text, text, text, text, text, text, jsonb,
  numeric, numeric, numeric, numeric, numeric, text, text, text, text
) to service_role;
