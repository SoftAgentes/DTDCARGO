-- ─────────────────────────────────────────────────────────────
-- SDD-0072 · Fase 2 · HARDENING del motor de auto-facturación (fix del review)
--
-- Cierra los hallazgos del review de Fase 2 (0127). Tres piezas:
--
--   1. sales_orders.invoicing_total_boxes · DENOMINADOR CONGELADO del prorrateo.
--      El review (C3) detectó que recalcular el total de cajas de la OV en cada
--      recepción permite que un assign/unassign de prealertas en estado 'parcial'
--      mueva el denominador → la suma de facturas parciales no cuadra (sub/sobre-
--      facturación). Fix: el universo se SNAPSHOTEA en la 1ª factura (dentro de la
--      transacción de la RPC) y todo prorrateo posterior usa ese fijo. La capa de
--      aplicación además bloquea assign/unassign cuando la OV no está 'confirmada'.
--
--   2. RPC sales_order_claim_and_invoice · NÚCLEO FINANCIERO TRANSACCIONAL (C2).
--      El motor de 0127 hacía ~6 statements PostgREST autocommit (claim → leer →
--      insert factura → ligar invoice_id → status): si el proceso moría entre el
--      insert y el ligado, la caja quedaba con invoiced_at seteado SIN factura
--      ligada (cerrojo permanente), y el snapshot de cajas/montos no era
--      consistente bajo concurrencia. Esta RPC hace TODO en UNA transacción con
--      SELECT … FOR UPDATE sobre la OV y la prealerta: claim → congelar
--      denominador → calcular monto → next_invoice_code → insert factura → ligar
--      prealertas.invoice_id → status OV → denormalizar recepción. O TODO o NADA
--      (cualquier error revierte la transacción completa — no quedan cerrojos
--      huérfanos ni facturas sin ligar).
--      · El asiento contable (0040 postInvoiceJournalEntry) NO se porta a SQL:
--        queda app-side, best-effort e idempotente por invoice_id — mismo modo de
--        fallo aceptado que la emisión manual de 0021 (no duplicamos el motor
--        contable). Trade-off documentado en el spec §11.
--      · El gate §3.5 completo (adjuntos/verificación) corre en la app ANTES de
--        llamar; acá se re-validan los gates DUROS (huérfana, CBM>0, peso>0)
--        como defensa en profundidad.
--
--   3. Trigger prealertas_validate_sales_order_trg · DEFENSA EN DB del enlace
--      prealertas.sales_order_id (review 🟡): la FK garantiza existencia pero no
--      mismo tenant — un caller directo vía PostgREST podría apuntar una caja a
--      la OV de otro tenant. Idéntico patrón que supplier_id en 0105.
--
-- IVA (review 🟡): el total de la factura se CONSTRUYE desde base + iva (patrón
-- computeInvoiceTotals de 0021) con aritmética numeric (sin float): total ==
-- base + iva SIEMPRE → el asiento 0040 nunca aborta por descuadre. El total
-- emitido puede diferir ±$0.01 del monto prorrateado objetivo (back-out del IVA);
-- la factura FINAL absorbe el restante real (ya-facturado suma totales REALES).
-- Ya-facturado (review 🟡): excluye 'borrador' y 'anulada'.
--
-- Aditiva · sin DDL destructivo · idempotente (if not exists / or replace /
-- drop trigger if exists). RLS: no crea tablas; sales_orders/prealertas/invoices/
-- warehouse_receipts_cn ya tienen RLS fail-closed por tenant (0125/0105/0077/
-- 0008). Funciones nuevas: security definer + set search_path = public +
-- REVOKE EXECUTE FROM public, anon (regla del repo post-deuda anon-execute);
-- la RPC de facturación SOLO la ejecuta service_role (la llama el motor server-
-- side con admin client; el tenant viene del user_tenants del caller).
-- ⚠️ NO se aplica a prod desde acá (lo hace el founder, junto con 0125 y 0127).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. sales_orders.invoicing_total_boxes · denominador fijo  ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.sales_orders
  add column if not exists invoicing_total_boxes int;

comment on column public.sales_orders.invoicing_total_boxes is
  'SDD-0072 Fase 2 (hardening): denominador CONGELADO del prorrateo de facturas parciales. NULL hasta la 1ª auto-factura; la RPC sales_order_claim_and_invoice lo snapshotea (suma de boxes de las prealertas vivas de la OV) dentro de la MISMA transacción de la 1ª factura y todo prorrateo posterior usa este fijo. Evita que assign/unassign de cajas en parcial mueva el denominador (sub/sobre-facturación). No se edita manualmente.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. Defensa cross-tenant de prealertas.sales_order_id      ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Patrón idéntico a prealerta_supplier_in_tenant (0105): helper *_in_tenant +
-- trigger BEFORE INSERT/UPDATE (null permitido = caja sin OV).
create or replace function public.prealerta_sales_order_in_tenant(
  p_sales_order_id uuid,
  p_tenant_id      uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.sales_orders
    where id = p_sales_order_id
      and tenant_id = p_tenant_id
      and deleted_at is null
  );
$$;

comment on function public.prealerta_sales_order_in_tenant is
  'SDD-0072 Fase 2 (hardening): ¿la OV existe, vive y es del MISMO tenant que la prealerta? La FK garantiza existencia pero no tenant — el trigger rechaza enlaces cross-tenant (lección 0045/0093, patrón supplier_id 0105).';

revoke execute on function public.prealerta_sales_order_in_tenant(uuid, uuid) from public, anon;
grant execute on function public.prealerta_sales_order_in_tenant(uuid, uuid) to authenticated;
grant execute on function public.prealerta_sales_order_in_tenant(uuid, uuid) to service_role;

create or replace function public.prealertas_validate_sales_order()
returns trigger
language plpgsql
as $$
begin
  if new.sales_order_id is not null
     and not public.prealerta_sales_order_in_tenant(new.sales_order_id, new.tenant_id) then
    raise exception 'orden de venta inexistente o de otro tenant: %', new.sales_order_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.prealertas_validate_sales_order() from public, anon;

drop trigger if exists prealertas_validate_sales_order_trg on public.prealertas;
create trigger prealertas_validate_sales_order_trg
  before insert or update on public.prealertas
  for each row execute function public.prealertas_validate_sales_order();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. RPC sales_order_claim_and_invoice · núcleo atómico     ║
-- ╚═══════════════════════════════════════════════════════════╝
-- TODO el camino financiero en UNA transacción. Outcomes (jsonb.outcome):
--   not_found        · recepción inexistente/borrada en el tenant.
--   gate_failed      · gate duro (huérfana / CBM / peso) — jsonb.missing dice qué.
--   no_box           · la recepción no tiene prealerta trazable (o se re-apuntó).
--   no_sales_order   · la caja no resuelve ninguna OV.
--   so_terminal      · la OV está cerrada/cancelada.
--   already_invoiced · la caja ya tiene factura (idempotencia: NUNCA re-factura).
--   zero_amount      · monto 0 (OV sin total o ya cubierta) — no emite vacía.
--   invoiced         · factura creada Y ligada (misma transacción).
--
-- Concurrencia: FOR UPDATE sobre la fila de la OV serializa TODA la facturación
-- de esa OV (dos consolidaciones simultáneas corren en serie y la 2ª ve el
-- estado committeado de la 1ª); el FOR UPDATE + re-chequeo de invoice_id sobre
-- la prealerta hace imposible la doble factura de la misma caja. El espejo TS de
-- la fórmula del monto vive en lib/studio/sales-orders/invoicing.ts
-- (computeReceiptInvoiceAmount; el IVA vive solo en este SQL) — si cambia uno, cambiar el
-- otro (los tests de Vitest pinean el TS; este SQL lo replica de forma aproximada (±$0.01 en bordes de medio centavo; la factura final cuadra la suma).
create or replace function public.sales_order_claim_and_invoice(
  p_tenant_id  uuid,
  p_receipt_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt         record;
  v_so_id           uuid;
  v_so              record;
  v_pre             record;
  v_total_boxes     int;
  v_remaining_boxes int;
  v_is_final        boolean;
  v_received        int;
  v_already         numeric(14,2);
  v_total           numeric(14,2);
  v_remaining_usd   numeric(14,2);
  v_amount          numeric(14,2);
  v_iva_on          boolean;
  v_rate            numeric(5,2);
  v_base            numeric(14,2);
  v_iva             numeric(14,2);
  v_total_inv       numeric(14,2);
  v_code            text;
  v_invoice_id      uuid;
  v_markbox         text;
  v_client_name     text;
  v_target          text;
  v_new_status      text;
begin
  if p_tenant_id is null or p_receipt_id is null then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  -- ── 1. La recepción (datos reales; lectura de referencia) ──
  select id, receipt_code, client_markbox, client_name, is_orphan,
         total_cbm, total_weight_kg, prealerta_id, sales_order_id
    into v_receipt
    from public.warehouse_receipts_cn
   where id = p_receipt_id
     and tenant_id = p_tenant_id
     and deleted_at is null;
  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  -- Gates DUROS re-validados en DB (defensa en profundidad; el gate §3.5
  -- completo — adjuntos + verificación — corre en la app antes de llamar acá).
  if coalesce(v_receipt.is_orphan, false) then
    return jsonb_build_object('outcome', 'gate_failed', 'missing', 'caja huérfana (sin cliente asignado)');
  end if;
  if coalesce(v_receipt.total_cbm, 0) <= 0 or coalesce(v_receipt.total_weight_kg, 0) <= 0 then
    return jsonb_build_object('outcome', 'gate_failed', 'missing', 'CBM (volumen), peso');
  end if;
  if v_receipt.prealerta_id is null then
    return jsonb_build_object('outcome', 'no_box');
  end if;

  -- ── 2. Resolver la OV (denormalizada en la recepción o vía la caja) ──
  v_so_id := v_receipt.sales_order_id;
  if v_so_id is null then
    select sales_order_id into v_so_id
      from public.prealertas
     where id = v_receipt.prealerta_id
       and tenant_id = p_tenant_id
       and deleted_at is null;
  end if;
  if v_so_id is null then
    return jsonb_build_object('outcome', 'no_sales_order');
  end if;

  -- ── 3. LOCKS (orden fijo anti-deadlock: 1º la OV, 2º la caja) ──
  -- El lock de la OV serializa toda la facturación de esta OV: el snapshot de
  -- cajas/ya-facturado que sigue es CONSISTENTE (nadie más factura en paralelo).
  select * into v_so
    from public.sales_orders
   where id = v_so_id and tenant_id = p_tenant_id and deleted_at is null
   for update;
  if not found then
    return jsonb_build_object('outcome', 'no_sales_order');
  end if;
  if v_so.status in ('cerrada', 'cancelada') then
    return jsonb_build_object(
      'outcome', 'so_terminal',
      'sales_order_code', v_so.sales_order_code,
      'sales_order_status', v_so.status
    );
  end if;

  -- Lock de la caja + RE-CHEQUEO post-lock (TOCTOU-safe): sigue viva, sigue
  -- atada a ESTA OV y sigue sin factura.
  select * into v_pre
    from public.prealertas
   where id = v_receipt.prealerta_id
     and tenant_id = p_tenant_id
     and sales_order_id = v_so.id
     and deleted_at is null
   for update;
  if not found then
    return jsonb_build_object('outcome', 'no_box');
  end if;
  if v_pre.invoice_id is not null then
    return jsonb_build_object(
      'outcome', 'already_invoiced',
      'sales_order_code', v_so.sales_order_code
    );
  end if;

  -- ── 4. Denominador CONGELADO + ya-facturado + ¿es la final? ──
  -- Universo del prorrateo: el snapshot de la 1ª factura (invoicing_total_boxes);
  -- si aún no existe (esta ES la 1ª), se calcula ahora y se persiste más abajo
  -- EN LA MISMA transacción.
  if v_so.invoicing_total_boxes is not null then
    v_total_boxes := v_so.invoicing_total_boxes;
  else
    select coalesce(sum(greatest(boxes, 0)), 0)::int into v_total_boxes
      from public.prealertas
     where sales_order_id = v_so.id
       and tenant_id = p_tenant_id
       and deleted_at is null;
  end if;

  -- Ya facturado REAL de la OV: solo facturas vivas que cuentan como emitidas
  -- (excluye 'borrador' y 'anulada' — review 🟡).
  select coalesce(sum(total_amount), 0) into v_already
    from public.invoices
   where sales_order_id = v_so.id
     and tenant_id = p_tenant_id
     and deleted_at is null
     and status not in ('borrador', 'anulada');

  -- ¿Quedan otras cajas vivas sin facturar? (si no → esta recepción es la FINAL
  -- y absorbe el restante exacto).
  select coalesce(sum(greatest(boxes, 0)), 0)::int into v_remaining_boxes
    from public.prealertas
   where sales_order_id = v_so.id
     and tenant_id = p_tenant_id
     and deleted_at is null
     and invoice_id is null
     and id <> v_pre.id;
  v_is_final := v_remaining_boxes <= 0;

  -- ── 5. Monto (espejo aproximado de computeReceiptInvoiceAmount · ±$0.01 en bordes · invoicing.ts) ──
  v_total         := greatest(coalesce(v_so.total_usd, 0), 0);
  v_received      := greatest(coalesce(v_pre.boxes, 0), 0);
  v_remaining_usd := greatest(v_total - v_already, 0);
  if v_total <= 0 or v_received <= 0 then
    v_amount := 0;
  elsif v_is_final or v_total_boxes <= 0 then
    -- final → restante exacto (absorbe redondeos) · sin denominador → restante íntegro.
    v_amount := round(v_remaining_usd, 2);
  else
    -- prorrateo por cajas, clampeado al restante (nunca sobre-factura).
    v_amount := round(least(v_total * v_received / v_total_boxes, v_remaining_usd), 2);
  end if;
  if v_amount <= 0 then
    return jsonb_build_object(
      'outcome', 'zero_amount',
      'sales_order_code', v_so.sales_order_code
    );
  end if;

  -- ── 6. IVA: total CONSTRUIDO desde base + iva (patrón 0021 · review 🟡) ──
  -- Aritmética numeric (sin float): total == base + iva SIEMPRE → el asiento
  -- 0040 nunca aborta por descuadre. El IVA (base+iva) vive solo en este SQL (sin espejo TS).
  select coalesce(iva_enabled, false) into v_iva_on
    from public.tenants
   where id = p_tenant_id;
  v_iva_on := coalesce(v_iva_on, false);
  if v_iva_on then
    v_rate := 16;
    v_base := round(v_amount / 1.16, 2);
    v_iva  := round(v_base * 0.16, 2);
  else
    v_rate := 0;
    v_base := v_amount;
    v_iva  := 0;
  end if;
  v_total_inv := v_base + v_iva;

  -- ── 7. Factura (motor 0021: next_invoice_code + schema 0077) ──
  v_code := public.next_invoice_code(p_tenant_id);
  v_markbox := coalesce(
    nullif(trim(coalesce(v_receipt.client_markbox, '')), ''),
    nullif(trim(coalesce(v_so.client_markbox, '')), ''),
    '—'
  );
  v_client_name := coalesce(
    nullif(trim(coalesce(v_receipt.client_name, '')), ''),
    nullif(trim(coalesce(v_so.client_name, '')), ''),
    'Cliente'
  );

  insert into public.invoices (
    tenant_id, invoice_code, client_markbox, client_name, sales_order_id,
    currency, iva_rate, base_amount, iva_amount, total_amount, lines, notes,
    status, issued_at, due_date, fund_class
  ) values (
    p_tenant_id, v_code, v_markbox, v_client_name, v_so.id,
    'USD', v_rate, v_base, v_iva, v_total_inv,
    jsonb_build_array(jsonb_build_object(
      'desc', 'OV ' || v_so.sales_order_code || ' · recepción ' || v_receipt.receipt_code
              || ' (' || v_received || ' caja' || case when v_received = 1 then '' else 's' end || ')',
      'qty', 1,
      'unitPrice', v_base
    )),
    'Generada automáticamente al confirmar la recepción ' || v_receipt.receipt_code || ' (SDD-0072 Fase 2).',
    'emitida', current_date, current_date + 30,
    -- espejo de deriveFundClass (payment-types.ts · 0122).
    case when v_so.service::text = 'transporte_terrestre' then 'local_revenue' else 'third_party' end
  )
  returning id into v_invoice_id;

  -- ── 8. Ligado GARANTIZADO (misma transacción: o factura+ligado o nada) ──
  update public.prealertas
     set invoice_id = v_invoice_id,
         invoiced_at = now()
   where id = v_pre.id;

  -- ── 9. Status de la OV (espejo nextStatusAfterInvoice + isAllowedTransition)
  --       + congelar el denominador si es la 1ª factura. Un solo UPDATE. ──
  v_target := case when v_remaining_boxes <= 0 then 'facturada' else 'parcial' end;
  if v_so.status <> v_target
     and (v_so.status = 'confirmada' or (v_so.status = 'parcial' and v_target = 'facturada')) then
    v_new_status := v_target;
  else
    v_new_status := null;
  end if;

  update public.sales_orders
     set invoicing_total_boxes = coalesce(invoicing_total_boxes, v_total_boxes),
         status = coalesce(v_new_status, status)
   where id = v_so.id
     and tenant_id = p_tenant_id;

  -- ── 10. Denormalizar la OV en la recepción (provenance) ──
  update public.warehouse_receipts_cn
     set sales_order_id = v_so.id
   where id = p_receipt_id
     and tenant_id = p_tenant_id;

  return jsonb_build_object(
    'outcome', 'invoiced',
    'invoice_id', v_invoice_id,
    'invoice_code', v_code,
    'base_amount', v_base,
    'iva_amount', v_iva,
    'total_amount', v_total_inv,
    'claimed_boxes', v_received,
    'sales_order_id', v_so.id,
    'sales_order_code', v_so.sales_order_code,
    'sales_order_status', coalesce(v_new_status, v_so.status),
    'sales_order_status_changed', v_new_status is not null
  );
end;
$$;

comment on function public.sales_order_claim_and_invoice is
  'SDD-0072 Fase 2 (hardening): núcleo TRANSACCIONAL de la auto-facturación. En UNA transacción: lock FOR UPDATE de OV+prealerta → claim idempotente (invoice_id IS NULL) → denominador congelado (invoicing_total_boxes) → monto prorrateado (espejo computeReceiptInvoiceAmount) → IVA base+iva (mismo criterio que el motor 0021) → next_invoice_code → INSERT factura → ligado prealertas.invoice_id → status OV → denormalización de la recepción. O TODO o NADA. El asiento 0040 queda app-side (best-effort idempotente). SOLO service_role (la llama el motor server-side; tenant del user_tenants del caller).';

-- SOLO el motor server-side (admin client = service_role) puede ejecutarla.
revoke execute on function public.sales_order_claim_and_invoice(uuid, uuid) from public, anon;
revoke execute on function public.sales_order_claim_and_invoice(uuid, uuid) from authenticated;
grant execute on function public.sales_order_claim_and_invoice(uuid, uuid) to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. Comments de 0127 actualizados (mecanismo de claim)     ║
-- ╚═══════════════════════════════════════════════════════════╝
-- 0127 describía el claim de dos fases (UPDATE invoiced_at como mutex previo al
-- insert). Ese mecanismo quedó SUPERSEDIDO por la RPC atómica: invoice_id e
-- invoiced_at se setean JUNTOS en la misma transacción que crea la factura.
comment on column public.prealertas.invoice_id is
  'SDD-0072 Fase 2: factura (0021) que YA cubrió esta caja física. != null ⇒ facturada ⇒ NUNCA se re-factura (idempotencia por caja). Desde 0128 el claim es ATÓMICO: la RPC sales_order_claim_and_invoice setea invoice_id en la MISMA transacción que inserta la factura (FOR UPDATE + re-chequeo invoice_id IS NULL — no existe estado intermedio "reclamada sin factura"). on delete set null (anular/borrar la factura devuelve la caja al pool facturable).';

comment on column public.prealertas.invoiced_at is
  'SDD-0072 Fase 2: cuándo se facturó esta caja (auditoría/visual). Desde 0128 se setea junto con invoice_id dentro de la transacción de la RPC (ya NO es un cerrojo de pre-claim).';

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0128_sales_order_invoicing_hardening.sql
-- Aplicar con: supabase migration apply 0128 · o MCP apply_migration
-- (después de 0125 y 0127 — las tres van juntas a prod).
-- ─────────────────────────────────────────────────────────────
