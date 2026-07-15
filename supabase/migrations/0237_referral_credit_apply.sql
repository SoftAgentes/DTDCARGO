-- ─────────────────────────────────────────────────────────────
-- SDD-0137 · Crédito de referido AUTO-APLICADO — Opción A (derivar de referrals)
--
-- Cierra el último eslabón del programa de referidos (SDD-0051): APLICAR el
-- crédito acreditado ($80) del REFERIDOR a su próxima factura. Hoy (Slice C,
-- migr 0197) el crédito solo se ACREDITA (referrals.status='acreditado' +
-- reward_usd=80) y es advisory. Esta migración le agrega el estado terminal
-- 'aplicado' + el rastro de aplicación, y hace CONFIGURABLE cómo se refleja
-- fiscalmente el crédito (setting per-tenant referral_credit_mode).
--
-- Decisión del founder (2026-07-14):
--   · Modelo = Opción A: se DERIVA de `referrals` (sin tabla ledger nueva). Un
--     referido acreditado = un crédito de $80; aplicarlo = transición
--     'acreditado' → 'aplicado' (mismo patrón idempotente-por-estado que la
--     acreditación de Slice C: UPDATE ... WHERE status='acreditado' con row-lock).
--   · El reflejo FISCAL va CONFIGURABLE (el founder NO decidió aún): setting
--     `referral_credit_mode` en fiscal_settings (la config contable/fiscal
--     per-tenant, patrón SDD-0073). Default 'marketing_expense' (el crédito es
--     gasto de incentivo, DR 6.11 / CR 1.1.2 — recomendación §3.3 del spec).
--     Alternativa 'commercial_discount' (descuento sobre ventas, DR 4.9 / CR 1.1.2).
--     La lógica de posting (lib/studio/accounting/referral-credit-posting.ts) lee
--     este valor; el founder lo cambia después SIN re-código.
--
-- Aditiva: NO toca tablas existentes salvo aditivos (enum value + columnas +
-- una columna en fiscal_settings). NO toca el trigger de Slice C (0197).
--
-- ⚠️ ALTER TYPE ... ADD VALUE: esta migración NO usa el valor nuevo 'aplicado'
--    en el mismo statement/tx (los CHECK/índices de abajo NO referencian el
--    literal del enum) → seguro. Precedente: 0073_expense_categories_op.sql.
--
-- ⚠️ NO se aplica a prod desde acá (lo hace el Director/founder).
--    Número de migración: 0237 (siguiente libre reservado por el Director).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. ENUM · nuevo estado terminal 'aplicado'                ║
-- ╚═══════════════════════════════════════════════════════════╝
-- 'aplicado' = crédito ya cobrado (aplicado a una factura + asiento contable).
-- Se llega SOLO por el RPC/acción con gate de dinero, nunca por avance manual.
alter type public.referral_status add value if not exists 'aplicado';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. REFERRALS · rastro de aplicación del crédito           ║
-- ╚═══════════════════════════════════════════════════════════╝
-- applied_invoice_id → factura del REFERIDOR donde se aplicó el crédito.
-- applied_entry_id   → asiento de marketing/descuento generado al aplicar.
-- applied_at         → cuándo se aplicó (auditoría).
alter table public.referrals
  add column if not exists applied_invoice_id uuid references public.invoices(id) on delete set null,
  add column if not exists applied_entry_id   uuid references public.journal_entries(id) on delete set null,
  add column if not exists applied_at         timestamptz;

comment on column public.referrals.applied_invoice_id is
  'SDD-0137: factura del referidor donde se aplicó su crédito acreditado (Opción A). Set solo con status=aplicado.';
comment on column public.referrals.applied_entry_id is
  'SDD-0137: asiento contable (journal_entries) del crédito aplicado (DR 6.11 o 4.9 / CR 1.1.2 · según referral_credit_mode). Puede quedar null si el CoA del tenant no tiene las cuentas (posting best-effort, skip graceful).';
comment on column public.referrals.applied_at is
  'SDD-0137: timestamp de aplicación del crédito (auditoría de dinero).';

-- Coherencia de campos (NO referencia el literal del enum → seguro en la misma
-- migración que ADD VALUE): un crédito aplicado tiene factura + timestamp juntos;
-- el asiento solo puede existir si hay factura aplicada.
alter table public.referrals
  drop constraint if exists referrals_credit_applied_coherent;
alter table public.referrals
  add constraint referrals_credit_applied_coherent check (
    ( (applied_invoice_id is null) = (applied_at is null) )
    and (applied_entry_id is null or applied_invoice_id is not null)
  );

-- Índice para la REVERSIÓN al anular factura (§3.6): busca créditos por la
-- factura donde se aplicaron. Parcial (solo créditos ya aplicados).
create index if not exists referrals_applied_invoice_idx
  on public.referrals (applied_invoice_id)
  where applied_invoice_id is not null and deleted_at is null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. SETTING per-tenant · referral_credit_mode              ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Vive en fiscal_settings (la config contable/fiscal per-tenant, SDD-0073):
-- decide cómo se ASIENTA el crédito al aplicarlo. Default = marketing_expense
-- (recomendación del spec §3.3: el crédito es gasto de incentivo, no rebaja de
-- precio). Editable por el founder sin re-código (flip en DB o UI futura).
alter table public.fiscal_settings
  add column if not exists referral_credit_mode text not null default 'marketing_expense'
    check (referral_credit_mode in ('marketing_expense', 'commercial_discount'));

comment on column public.fiscal_settings.referral_credit_mode is
  'SDD-0137: cómo se refleja contablemente el crédito de referido al aplicarlo. '
  'marketing_expense (default) → DR 6.11 Publicidad y marketing / CR 1.1.2 CxC (gasto de incentivo, no toca base ni IVA). '
  'commercial_discount → DR 4.9 Descuentos sobre ventas (contra) / CR 1.1.2 CxC (rebaja de precio). '
  'La decisión fiscal la confirma el founder/contador; la lógica de posting lee este valor sin re-código.';

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0237_referral_credit_apply.sql
-- Aplicar con: supabase migration apply 0237 · o MCP apply_migration
-- (lo hace el Director/founder; el harness NO aplica a prod).
-- ─────────────────────────────────────────────────────────────
