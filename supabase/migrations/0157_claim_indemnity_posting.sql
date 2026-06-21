-- ─────────────────────────────────────────────────────────────
-- SDD-0101 C2: asiento contable automático de la indemnización.
--
-- Cuando un reclamo pasa a 'pagado' (Contabilidad paga la indemnización al
-- cliente) se asienta el desembolso, espejo del gasto (SDD-0079):
--
--   DR  6.20  Siniestros / indemnizaciones a clientes        = amount
--   CR  caja/banco según payment_method                       = amount
--
-- Esta migración es solo el ANDAMIAJE (cuenta + columnas + índice). El asiento
-- lo crea el helper `postClaimIndemnityEntry` (lib/studio/accounting/claim-posting.ts)
-- con admin client, idempotente por claim_id, best-effort (no rompe el pago).
-- El trigger de cierre de período (0133) ya protege contra asentar en período
-- cerrado; la action además valida isPeriodClosed antes de marcar pagado.
--
-- Aditiva. NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

-- 1. Cuenta de gasto para la indemnización (hija del grupo 6, postable).
--    Idempotente. El parent_id se resuelve al grupo '6' del mismo tenant.
insert into public.accounts (tenant_id, code, name, type, is_postable, qbo_type, parent_id)
select t.id, '6.20', 'Siniestros / indemnizaciones a clientes', 'G', true, 'Expenses', p.id
from public.tenants t
left join public.accounts p on p.tenant_id = t.id and p.code = '6'
where t.slug = 'dtd'
on conflict (tenant_id, code) do nothing;

-- 2. Vínculo del asiento al reclamo (source='claim') + índice de idempotencia.
--    on delete set null: borrar un reclamo no borra su asiento contable.
alter table public.journal_entries
  add column if not exists claim_id uuid references public.client_claims(id) on delete set null;

comment on column public.journal_entries.claim_id is
  'SDD-0101 C2: reclamo cuya indemnización generó este asiento (source=claim).';

create index if not exists je_claim_idx
  on public.journal_entries (claim_id) where claim_id is not null;

-- Defensa anti-doble-asiento (carrera de doble-submit): único parcial sobre el
-- asiento VIVO por reclamo. El check de idempotencia en claim-posting.ts es
-- read-then-write sin lock; este índice cierra la carrera (el 2º insert revienta
-- 23505 y el best-effort lo traga). Espejo de je_one_live_entry_per_expense (0132).
create unique index if not exists je_one_live_entry_per_claim
  on public.journal_entries (claim_id)
  where claim_id is not null and status = 'asentado' and deleted_at is null;

-- 3. Método de pago de la indemnización → determina la cuenta de caja/banco
--    (haber). Mismo set que los gastos (cash/transfer/usdt). Default 'transfer'.
alter table public.client_claim_financials
  add column if not exists payment_method text not null default 'transfer'
    check (payment_method in ('cash', 'transfer', 'usdt'));

comment on column public.client_claim_financials.payment_method is
  'SDD-0101 C2: medio de pago de la indemnización → cuenta de contrapartida del asiento.';

-- 4. Defensa en DB: el monto del reclamo no puede ser negativo (el validador TS
--    lo cubre, pero un UPDATE por PostgREST directo lo evadiría). C2-3 auditoría.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'client_claims_amount_nonneg'
  ) then
    alter table public.client_claims
      add constraint client_claims_amount_nonneg check (amount_usd >= 0);
  end if;
end $$;
