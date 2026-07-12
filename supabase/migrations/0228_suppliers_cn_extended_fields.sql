-- ─────────────────────────────────────────────────────────────
-- 0228_suppliers_cn_extended_fields.sql
--
-- SIN APLICAR A PROD — requiere OK explícito del founder (AGENTS.md: "migrations
-- a prod = con tu OK explícito, nunca auto"). Este archivo queda staged en la
-- rama para que el founder decida si aplicarlo.
--
-- Contexto: gap-analysis Norte vs código (2026-07-12) sobre el alta de
-- suppliers_cn (proveedores chinos del CLIENTE — NO confundir con suppliers de
-- Tesorería/vendors de DTD, SDD-0044). El Norte (docs/design/studio/_norte/erp/
-- modules/suppliers.jsx, SupplierForm) diseñó un drawer de alta con más campos
-- que el schema real de 0105_portal_compras.sql. Este ALTER agrega esos campos
-- de forma 100% ADITIVA (columnas nullable / con default) — no rompe ninguna
-- fila ni código existente, así que es seguro de aplicar en cualquier momento
-- SIN requerir cambios de código simultáneos.
--
-- NO incluido a propósito (fuera de alcance de este ALTER):
--   - No agrega el drawer de alta en /studio/proveedores: esa página es
--     SOLO LECTURA por decisión explícita del founder ("cero writes",
--     SDD-0057 Slice C). Habilitar un alta desde el Studio es una decisión de
--     producto que revierte esa decisión — no se toca acá sin que el founder
--     lo pida explícitamente.
--   - No incluye el scorecard/rating de SDD-0111 (draft, requiere tablas de
--     señales aparte — alcance mayor, spec separada).
-- ─────────────────────────────────────────────────────────────

alter table public.suppliers_cn
  add column if not exists legal_name_cn text,        -- nombre legal · 中文 (Norte: SupplierForm)
  add column if not exists industry      text,         -- industria (Norte: dropdown fijo)
  add column if not exists address_cn    text,         -- dirección completa · 中文
  add column if not exists contact_name  text,         -- nombre del contacto (ES)
  add column if not exists contact_name_cn text,       -- nombre del contacto · 中文
  add column if not exists contact_phone text,         -- teléfono del contacto (separado de wechat)
  add column if not exists contact_email text,         -- email del contacto
  add column if not exists status        text not null default 'aprobado';

comment on column public.suppliers_cn.legal_name_cn is 'Nombre legal del proveedor en chino (Norte: erp/modules/suppliers.jsx SupplierForm).';
comment on column public.suppliers_cn.industry is 'Industria del proveedor (Norte: dropdown fijo — bazar/LED/textil/electrónica/cosmética/industrial/tech/calzado/muebles). Texto libre acá a propósito: no se agrega check constraint hasta que haya UI que lo use, para no bloquear valores futuros.';
comment on column public.suppliers_cn.address_cn is 'Dirección completa del proveedor en chino.';
comment on column public.suppliers_cn.contact_name is 'Nombre del contacto principal (español).';
comment on column public.suppliers_cn.contact_name_cn is 'Nombre del contacto principal (中文).';
comment on column public.suppliers_cn.contact_phone is 'Teléfono del contacto — separado de wechat (que sigue siendo el WeChat ID/número, campo pre-existente).';
comment on column public.suppliers_cn.contact_email is 'Email del contacto principal.';
comment on column public.suppliers_cn.status is 'Estado del proveedor (Norte: aprobado · uso normal / preferido · uso priorizado / observación · necesita revisión). Default aprobado — no bloquea proveedores existentes ni el alta actual del portal.';

alter table public.suppliers_cn
  add constraint suppliers_cn_status_check
  check (status in ('aprobado', 'preferido', 'observacion'));

-- ─────────────────────────────────────────────────────────────
-- Fin 0228_suppliers_cn_extended_fields.sql
-- ─────────────────────────────────────────────────────────────
