-- ─────────────────────────────────────────────────────────────
-- SDD-0144 · 0208 — correlativo de compra asistida: OC-YYYY-NNNN → CANNNN
--
-- Decisión founder (2026-07-03): el código visible de la compra asistida es
-- "CA" + correlativo, SIN año y SIN guiones (CA0001). La fecha ya vive en
-- created_at del registro; el contador deja de reiniciar por año (si
-- reiniciara, CA0001 se repetiría cada enero y chocaría con el unique).
--
--  1. Backfill: renumera los códigos legacy 'OC-YYYY-NNNN' → 'CANNNN' por
--     tenant en orden de creación, y actualiza la referencia textual del
--     Bill vinculado (supplier_bills.reference guardaba el código viejo).
--     En prod la tabla está vacía a la fecha — el backfill es no-op seguro.
--  2. Reemplaza la RPC next_purchase_order_code: mismo nombre y firma
--     (la UI/actions no cambian), ahora cuenta '^CA(\d+)$' global por
--     tenant. Padding 4; se extiende solo > 9999. TOCTOU: el unique
--     (tenant_id, purchase_order_code) de 0124 sigue siendo el backstop.
--  3. Re-asserta los revokes de 0124b (create or replace preserva grants,
--     pero se re-declaran por la regla "siempre revoke public/anon").
--
-- Patrón: next_estimate_code 0113 / next_bill_code 0088 · security definer
-- + search_path pinneado. Aditiva sobre 0124/0124b; sin cambios de schema.
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. Backfill códigos legacy OC-YYYY-NNNN → CANNNN          ║
-- ╚═══════════════════════════════════════════════════════════╝
with legacy as (
  select
    id,
    tenant_id,
    purchase_order_code as old_code,
    bill_id,
    row_number() over (partition by tenant_id order by created_at, id) as rn
  from public.purchase_orders
  where purchase_order_code ~ '^OC-\d{4}-\d+$'
),
renamed as (
  update public.purchase_orders po
  set purchase_order_code = 'CA' || lpad(l.rn::text, 4, '0')
  from legacy l
  where po.id = l.id
  returning po.id, po.tenant_id, po.purchase_order_code as new_code,
            l.old_code, l.bill_id
)
update public.supplier_bills b
set reference = r.new_code
from renamed r
where b.id = r.bill_id
  and b.reference = r.old_code;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. RPC next_purchase_order_code · CANNNN (global/tenant)  ║
-- ╚═══════════════════════════════════════════════════════════╝
create or replace function public.next_purchase_order_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
begin
  select coalesce(max((regexp_match(purchase_order_code, '^CA(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.purchase_orders
  where tenant_id = p_tenant_id
    and purchase_order_code like 'CA%';

  return 'CA' || lpad(v_max::text, 4, '0');
end;
$$;

comment on function public.next_purchase_order_code is
  'SDD-0144: genera el próximo purchase_order_code CANNNN (sin año, sin guiones; contador global por tenant). Ex OC-YYYY-NNNN (0124). Decisión founder 2026-07-03.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. Revokes (regla: nunca ejecutable por public/anon)      ║
-- ╚═══════════════════════════════════════════════════════════╝
revoke execute on function public.next_purchase_order_code(uuid) from public;
revoke execute on function public.next_purchase_order_code(uuid) from anon;
