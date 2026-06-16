-- ─────────────────────────────────────────────────────────────
-- SDD-0073 · Fiscal/SENIAT — reconciliación §8 (módulo configurable v2)
--
-- Lleva `fiscal_settings` de la config tentativa de V1 (0126) a la ESTRUCTURA
-- CANÓNICA del spec §8 (deep-research SENIAT 2026-06-12 + 4 principios del
-- founder). Cambios clave:
--
--   1. MASTER TOGGLE `fiscal_module_enabled` (default FALSE). Con OFF el módulo
--      es INERTE: no genera libros, no toca IVA, la facturación sigue normal.
--      DTD hoy = OFF. (principio #1 + #4: cero automatismo fiscal hasta activar)
--   2. IVA POR FACTURA (no por tenant): se reemplaza el `service_iva_treatment`
--      único del tenant por `default_invoice_iva_mode` (default de facturas
--      nuevas) + la columna `invoices.iva_mode` (cada factura la sobreescribe).
--      (principio #3)
--   3. 4 ALÍCUOTAS separadas (general/reducida/exportación/suntuaria) — el
--      Ejecutivo las mueve dentro de bandas legales, por eso son config.
--   4. IGTF (3% sobre cobros en divisa) configurable.
--   5. FACTURACIÓN DIGITAL: proveedor homologado que asigna el nº de control
--      (el ERP NO lo autogenera, research §1). Default OFF.
--
-- Aditiva sobre 0126 (que NO se aplicó a prod): cuando el founder aplique las
-- migraciones en orden, terminan en el estado §8. Respeta inmutabilidad: NO
-- edita 0126, reconcilia por ALTER. RLS/grants intactos (las columnas heredan
-- la RLS por tenant de 0126). NO se aplica a prod desde acá (gate founder).
--
-- Toca DB → revisado con el skill Supabase postgres-best-practices: enums como
-- text+CHECK (patrón del repo), CHECKs de rango, columnas con default constante
-- (sin table-rewrite), sin nuevos GRANT (no hay tabla/función nueva → no aplica
-- el revoke-from-anon; la única función nueva sería V2).
--
-- ⚠️ Correlativo: 0141 (último libre; 0140 = news_categorias). NO aplicada a prod.
-- ─────────────────────────────────────────────────────────────

-- ── 1 · fiscal_settings → estructura §8 ────────────────────────

-- A · Master toggle (principio #1). OFF = módulo inerte.
alter table public.fiscal_settings
  add column if not exists fiscal_module_enabled boolean not null default false;

-- D · Default de IVA para facturas nuevas (cada factura lo sobreescribe vía
--     invoices.iva_mode). Reemplaza el service_iva_treatment a nivel tenant.
alter table public.fiscal_settings
  add column if not exists default_invoice_iva_mode text not null default 'sin_iva'
    check (default_invoice_iva_mode in ('sin_iva', 'con_iva', 'exento', 'tasa_cero'));

-- C · 4 alícuotas separadas (research §2 · Art. 63 LIVA). Configurables.
alter table public.fiscal_settings
  add column if not exists iva_rate_general          numeric(5,2) not null default 16,
  add column if not exists iva_rate_reduced          numeric(5,2) not null default 8,
  add column if not exists iva_rate_export           numeric(5,2) not null default 0,
  add column if not exists iva_rate_luxury_surcharge numeric(5,2) not null default 15;

-- Migrar el valor viejo `iva_rate` (V1) → `iva_rate_general` antes de dropearlo,
-- por si alguna environment tuviera la row de 0126 (prod no la tiene). Guardado
-- con `if exists`: si 0141 corriera sobre una base donde 0126 nunca creó la
-- columna `iva_rate`, el update se omite en vez de romper (robustez de orden).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fiscal_settings'
      and column_name = 'iva_rate'
  ) then
    update public.fiscal_settings
      set iva_rate_general = iva_rate
      where iva_rate is not null;
  end if;
end $$;

-- E · IGTF (research §3 · Art. 24). 3% sobre cobros en divisa. Configurable.
alter table public.fiscal_settings
  add column if not exists igtf_enabled             boolean      not null default false,
  add column if not exists igtf_rate_fx             numeric(5,2) not null default 3,
  add column if not exists igtf_is_perception_agent boolean      not null default false;

-- G · Facturación digital (research §1). El proveedor homologado asigna el nº de
--     control; el ERP NO lo autogenera. DTD NO está obligada hoy → OFF.
alter table public.fiscal_settings
  add column if not exists digital_invoicing_enabled boolean not null default false,
  add column if not exists homologated_provider      text;

-- F · Alinear el nombre del agente de retención al canónico §8.2 (era
--     is_iva_withholding_agent en V1). Default ahora FALSE (research §6: solo si SPE).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fiscal_settings'
      and column_name = 'is_iva_withholding_agent'
  ) then
    alter table public.fiscal_settings rename column is_iva_withholding_agent to iva_withholding_agent;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fiscal_settings'
      and column_name = 'iva_withholding_agent'
  ) then
    alter table public.fiscal_settings
      add column iva_withholding_agent boolean not null default false;
  end if;
end $$;

-- El agente de retención por default deja de ser TRUE (research §6: solo si es
-- Sujeto Pasivo Especial → a confirmar el contador). No fuerza filas existentes.
alter table public.fiscal_settings
  alter column iva_withholding_agent set default false;

-- Drop de lo reemplazado por el modelo por-factura (V1 tentativa).
alter table public.fiscal_settings drop column if exists service_iva_treatment;
alter table public.fiscal_settings drop column if exists iva_rate;

-- Rangos de cordura para las nuevas alícuotas (una config inválida sesgaría los libros).
alter table public.fiscal_settings
  add constraint fiscal_settings_rate_general_range  check (iva_rate_general          >= 0 and iva_rate_general          <= 100),
  add constraint fiscal_settings_rate_reduced_range  check (iva_rate_reduced          >= 0 and iva_rate_reduced          <= 100),
  add constraint fiscal_settings_rate_export_range   check (iva_rate_export           >= 0 and iva_rate_export           <= 100),
  add constraint fiscal_settings_rate_luxury_range   check (iva_rate_luxury_surcharge >= 0 and iva_rate_luxury_surcharge <= 100),
  add constraint fiscal_settings_igtf_rate_range     check (igtf_rate_fx              >= 0 and igtf_rate_fx              <= 100);

comment on column public.fiscal_settings.fiscal_module_enabled is
  'SDD-0073 §8 (principio #1): master toggle del módulo Fiscal/SENIAT. Default FALSE = INERTE (no libros, no IVA, facturación normal). DTD hoy = OFF. Cero automatismo fiscal hasta que el admin lo active (con el contador).';
comment on column public.fiscal_settings.default_invoice_iva_mode is
  'SDD-0073 §8 (principio #3): modo de IVA por default de facturas NUEVAS (sin_iva|con_iva|exento|tasa_cero). Cada factura lo sobreescribe vía invoices.iva_mode. Reemplaza el service_iva_treatment a nivel tenant de V1.';
comment on column public.fiscal_settings.iva_rate_general is
  'SDD-0073 §8 C (research §2, Art. 63 LIVA): alícuota general (%). Configurable (el Ejecutivo la mueve en banda 8–16,5).';
comment on column public.fiscal_settings.igtf_enabled is
  'SDD-0073 §8 E (research §3): IGTF sobre cobros en divisa. Configurable, solo aplica con el módulo ON.';
comment on column public.fiscal_settings.digital_invoicing_enabled is
  'SDD-0073 §8 G (research §1): facturación fiscal digital. El proveedor homologado asigna el nº de control; el ERP NO lo autogenera. DTD NO obligada hoy → OFF.';

-- ── 2 · invoices.iva_mode (IVA por factura · principio #3) ─────
-- Aditiva. NULL = "hereda el default del tenant" (default_invoice_iva_mode).
-- Solo es SIGNIFICATIVA con el módulo fiscal ON; con OFF la facturación ignora
-- esta columna y sigue usando tenants.iva_enabled (comportamiento actual intacto).
alter table public.invoices
  add column if not exists iva_mode text
    check (iva_mode is null or iva_mode in ('sin_iva', 'con_iva', 'exento', 'tasa_cero'));

comment on column public.invoices.iva_mode is
  'SDD-0073 §8 (principio #3): modo de IVA de ESTA factura (sin_iva|con_iva|exento|tasa_cero). NULL = hereda fiscal_settings.default_invoice_iva_mode. Solo se aplica con fiscal_module_enabled=true; con el módulo OFF la facturación la ignora (usa tenants.iva_enabled, comportamiento actual).';
