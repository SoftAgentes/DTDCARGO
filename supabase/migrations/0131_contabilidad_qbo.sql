-- ─────────────────────────────────────────────────────────────
-- SDD-0077 · Contabilidad estilo QuickBooks (3 slices)
--
-- Acerca el Studio al modelo de QuickBooks Online en 3 puntos que
-- aceleran la carga y cierran el puente operación↔contabilidad:
--   1. suppliers.default_expense_account_id — el proveedor guarda su
--      cuenta de gasto; al crear su CxP se autollena (como QBO).
--   2. accounts.subtype — 2ª capa "detail type" (cascada Tipo→Subtipo
--      al crear cuenta). Metadata de organización; NO cambia P&L/Balance
--      (eso lo decide `type`). Nullable; las 84 cuentas sembradas siguen
--      funcionando sin subtipo.
--   3. expenses.account_id — imputa el gasto del operario a una cuenta
--      del plan (hoy va solo por `category`, suelto de la contabilidad).
--      Se calcula de la categoría vía mapeo; editable después.
--
-- Reusa accounts (0078), suppliers (0088), expenses (0047/0073/0074).
-- Columnas aditivas FK nullable: heredan la RLS existente de cada tabla,
-- sin policies nuevas. FK `on delete set null` para no borrar el
-- proveedor/gasto si se borra la cuenta. Sin funciones nuevas.
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. Proveedor → cuenta de gasto por defecto                ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.suppliers
  add column if not exists default_expense_account_id uuid
    references public.accounts(id) on delete set null;

comment on column public.suppliers.default_expense_account_id is
  'SDD-0077: cuenta de costo/gasto (tipo CGS o G, postable) que se autollena al crear una CxP de este proveedor. La validación de tipo vive en la action (createSupplier/updateSupplier) y el posteo (bill-posting) revalida en uso. on delete set null.';

create index if not exists suppliers_default_expense_account_idx
  on public.suppliers (default_expense_account_id)
  where default_expense_account_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. Cuenta → subtipo (cascada Tipo→Subtipo, estilo QBO)    ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.accounts
  add column if not exists subtype text;

comment on column public.accounts.subtype is
  'SDD-0077: 2ª capa de clasificación (estilo "detail type" de QBO). Valor de ACCT_SUBTYPES[type] en lib/studio/account-types.ts. Solo organiza/agrupa; el reporte (P&L vs Balance) lo decide `type`. Nullable.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. Gasto → cuenta del plan (puente operación↔contabilidad)║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.expenses
  add column if not exists account_id uuid
    references public.accounts(id) on delete set null;

comment on column public.expenses.account_id is
  'SDD-0077: cuenta del plan a la que se imputa el gasto. Se DERIVA de la categoría vía resolveExpenseAccountId() al cargar y se re-deriva al editar (hoy NO editable a mano en la UI; si se hace editable, no re-derivar incondicionalmente). on delete set null. NO genera asiento por ahora (imputación advisory para que reportes consoliden por cuenta).';

create index if not exists expenses_account_id_idx
  on public.expenses (account_id)
  where account_id is not null;

-- Backfill: mapear cada gasto vivo a su cuenta del plan por categoría.
-- Mapeo igual al de resolveExpenseAccountId() (lib/studio/expense-queries.ts).
-- Join por tenant + code; si el tenant no sembró el plan, queda null (ok).
update public.expenses e
set account_id = a.id
from public.accounts a, (values
  ('taxi', '6.14'),
  ('comida', '6.14'),
  ('hotel', '6.14'),
  ('vuelo', '6.14'),
  ('peaje', '6.14'),
  ('combustible', '6.1'),
  ('aduana', '5.5'),
  ('cliente', '6.99'),
  ('otro', '6.99'),
  ('op_rent', '6.7'),
  ('op_utilities', '6.8'),
  ('op_salaries', '6.5.1'),
  ('op_supplies', '6.13'),
  ('op_equipment', '6.2'),
  ('op_local_transport', '5.2'),
  ('op_customs_local', '5.5')
) as m(category, code)
where e.category::text = m.category
  and a.tenant_id = e.tenant_id
  and a.code = m.code
  and a.is_postable
  and e.account_id is null;

-- ─────────────────────────────────────────────────────────────
-- RLS / Grants: suppliers, accounts y expenses YA tienen RLS por
-- tenant. Las columnas nuevas son aditivas nullable → heredan las
-- policies existentes sin cambios. Sin tablas/funciones nuevas →
-- sin GRANT ni EXECUTE nuevos.
-- ─────────────────────────────────────────────────────────────
-- Fin migración 0131_contabilidad_qbo.sql
-- Aplicar (coordinación, NO en esta ventana): supabase migration apply 0131
-- ─────────────────────────────────────────────────────────────
