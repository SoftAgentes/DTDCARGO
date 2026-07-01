-- ─────────────────────────────────────────────────────────────
-- 0191 · SDD-0122 · Numeración & legal — leyendas legales en facturas
--   tenants += invoice_footer_text, invoice_terms_text
--
-- Sección "Numeración & legal" de /studio/admin. Los FORMATOS de numeración
-- (correlativos F-YYYY-NNNN, Q-YYYY-NNNN, etc.) son fijos por diseño y viven en
-- RPCs (next_invoice_code, next_quote_code…) — son correlativos legales, NO se
-- editan desde acá (cambiarlos = spec fiscal dedicada, gate contador). Esta
-- migración cubre SOLO la parte editable y segura: las leyendas legales que van
-- al pie de las facturas (texto de pie + términos y condiciones).
--
-- Se guardan en `tenants` (dominio company/admin, junto a legal_name/rif del
-- 0120) y NO en `fiscal_settings`, para no entrar en las tablas/tipos del
-- módulo Fiscal (gate contador). Son solo texto — cero lógica de numeración,
-- cero cálculo fiscal. El renderer de la factura las consumirá (follow-up del
-- módulo de facturación).
--
-- Aditiva e idempotente. NO aplicar a prod desde la rama — la aplica
-- coordinación / founder.
-- ─────────────────────────────────────────────────────────────

alter table public.tenants
  add column if not exists invoice_footer_text text,
  add column if not exists invoice_terms_text  text;

comment on column public.tenants.invoice_footer_text is
  'SDD-0122: leyenda legal del pie de factura (RIF, contribuyente especial, resolución SENIAT, imprenta autorizada…). Texto libre editable por admin; lo consume el renderer de facturación.';
comment on column public.tenants.invoice_terms_text is
  'SDD-0122: términos y condiciones que se imprimen en la factura (alcance del servicio, pago a N días…). Texto libre editable por admin.';
