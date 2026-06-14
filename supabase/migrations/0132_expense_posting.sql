-- ─────────────────────────────────────────────────────────────
-- SDD-0079 · Asiento automático del gasto (expenses → journal_entries)
--
-- Cierra el último ciclo contable abierto: hoy factura/cobro/CxP/pago
-- generan asiento automático, pero el GASTO operativo no (SDD-0077 dejó
-- `expenses.account_id` listo pero difirió el posteo). Con esto, al cargar
-- un gasto se asienta:
--   DR  account_id (cuenta de gasto imputada, 5./6.)   = amount_usd
--   CR  caja/banco según `method`                      = amount_usd
-- El gasto es un desembolso directo (el operario ya pagó) → CR caja, no
-- "por pagar" como la CxP. La contrapartida se elige del método
-- (cash→Caja chica 1.1.1.1 · transfer→Banco 1.1.1.2 · card→Tarjeta 2.1.2 ·
-- usdt→Banco USD 1.1.1.3); ver EXPENSE_METHOD_ACCOUNT_CODE en
-- lib/studio/accounting/expense-posting.ts.
--
-- Reusa journal_entries/journal_lines (0078), accounts (0078),
-- expenses.account_id (0131), RPC next_entry_code (0078). `source` es text
-- (no enum) → 'expense' no requiere alterar tipo. Idempotencia por expense_id.
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ Link asiento ↔ gasto (idempotencia + anulación + traza)   ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.journal_entries
  add column if not exists expense_id uuid
    references public.expenses(id) on delete set null;

comment on column public.journal_entries.expense_id is
  'SDD-0079: gasto (expenses) que originó este asiento (source=''expense''). Para idempotencia (no duplicar) y anulación al editar/borrar el gasto. on delete set null.';

create index if not exists je_expense_idx
  on public.journal_entries (expense_id)
  where expense_id is not null;

-- Defensa anti-doble-asiento: a lo sumo UN asiento vivo 'asentado' por gasto.
-- El check app-side (postExpenseJournalEntry) ya lo evita en el caso normal;
-- este índice único cierra la carrera de doble-submit. El void (status→anulado)
-- libera el gasto para re-postear (la edición anula y repostea).
create unique index if not exists je_one_live_entry_per_expense
  on public.journal_entries (expense_id)
  where expense_id is not null and status = 'asentado' and deleted_at is null;

-- ─────────────────────────────────────────────────────────────
-- RLS / Grants: journal_entries ya tiene RLS por tenant (0078). La columna
-- es aditiva nullable → hereda las policies existentes. Sin tablas/funciones
-- nuevas; `next_entry_code` y el enum entry_status ya existen (0078).
-- ─────────────────────────────────────────────────────────────
-- Fin migración 0132_expense_posting.sql
-- Aplicar (coordinación, NO en esta ventana): supabase migration apply 0132
-- ─────────────────────────────────────────────────────────────
