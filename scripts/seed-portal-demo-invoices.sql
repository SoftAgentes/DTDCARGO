-- ============================================================================
-- SEED · Facturas demo del Portal (complemento de seed-portal-demo.sql)
-- ----------------------------------------------------------------------------
-- Pegá TODO esto en Supabase → SQL Editor → Run. Idempotente (re-corrible).
--
-- Siembra 5 facturas demo para DTD-1004 ("Demo Pyme C.A.") ligadas a sus envíos
-- ya sembrados, con estados variados (pagada · parcial · emitida · vencida) para
-- que /portal/facturas y /portal/finanzas muestren los KPIs (Total/Pagado/Saldo),
-- la tabla densa y los 4 tonos de badge con data real (rediseño Norte).
--
-- IMPORTANTE — los códigos 'F-2026-Dnn' NO afectan el contador next_invoice_code():
--   su regexp ('^F-\d{4}-(\d+)$') exige dígitos tras el último guion, y 'Dnn'
--   empieza con letra → no matchea → se ignora en el max(). Así las facturas reales
--   siguen numerando F-2026-0001, 0002, … sin saltos.
--
-- Requisito: correr ANTES `scripts/seed-portal-demo.sql` (necesita los envíos
-- DTD-2026-0401..0407). Si en el futuro querés otro cliente, cambiá v_markbox.
-- ============================================================================
do $$
declare
  v_markbox text := 'DTD-1004';                 -- 👈 cliente a sembrar
  v_tenant  uuid;
  v_name    text;
begin
  select id into v_tenant from public.tenants where slug = 'dtd' limit 1;
  if v_tenant is null then
    raise exception 'No existe el tenant demo (slug=dtd).';
  end if;

  select name into v_name from public.clients
    where tenant_id = v_tenant and markbox = v_markbox and deleted_at is null;
  if v_name is null then
    raise exception 'No existe el cliente % en el tenant demo.', v_markbox;
  end if;

  -- 5 facturas demo (IVA OFF → total = base; lines es jsonb [{desc,qty,unitPrice}]).
  -- D05 va 'emitida' con due_date pasada → el portal la MUESTRA como "vencida"
  -- (derivación visual invoiceDisplayStatus), sin tocar el enum.
  insert into public.invoices
    (tenant_id, invoice_code, client_markbox, client_name, shipment_id, shipment_code,
     currency, iva_rate, base_amount, iva_amount, total_amount, status,
     issued_at, due_date, paid_amount, last_payment_at, lines, notes,
     created_at, updated_at)
  select
    v_tenant, x.code, v_markbox, v_name,
    (select s.id from public.shipments s
       where s.tenant_id = v_tenant and s.code = x.shipment_code limit 1),
    x.shipment_code,
    'USD'::invoice_currency, 0, x.amount, 0, x.amount, x.status::invoice_status,
    x.issued, x.due, x.paid, x.last_pay, x.lines::jsonb, x.notes,
    x.issued::timestamptz, now()
  from (values
    ('F-2026-D01','DTD-2026-0406', 1200.00, 1200.00, 'pagada',
       (current_date - 60), (current_date - 30), (now() - interval '32 days'),
       '[{"desc":"Flete consolidado China–Venezuela (LCL)","qty":1,"unitPrice":1200}]',
       'Pago confirmado. ¡Gracias!'),
    ('F-2026-D02','DTD-2026-0404',  850.00,  850.00, 'pagada',
       (current_date - 50), (current_date - 20), (now() - interval '22 days'),
       '[{"desc":"Servicio puerta a puerta (LCL)","qty":1,"unitPrice":850}]',
       null),
    ('F-2026-D03','DTD-2026-0403', 9800.00, 4000.00, 'parcial',
       (current_date - 12), (current_date + 18), (now() - interval '5 days'),
       '[{"desc":"Reserva FCL 40''HC Shenzhen–Maracaibo","qty":1,"unitPrice":9800}]',
       'Abono inicial recibido; saldo contra llegada.'),
    ('F-2026-D04','DTD-2026-0401', 1450.00,    0.00, 'emitida',
       (current_date - 18), (current_date + 12), null,
       '[{"desc":"Flete consolidado + manejo en bodega","qty":1,"unitPrice":1450}]',
       null),
    ('F-2026-D05','DTD-2026-0402', 2100.00,    0.00, 'emitida',
       (current_date - 40), (current_date - 10), null,
       '[{"desc":"Puerta a puerta DDP (pagas al llegar)","qty":1,"unitPrice":2100}]',
       'Coordinar pago con tu asesor.')
  ) as x(code, shipment_code, amount, paid, status, issued, due, last_pay, lines, notes)
  on conflict (tenant_id, invoice_code) do update
    set status = excluded.status, base_amount = excluded.base_amount,
        total_amount = excluded.total_amount, paid_amount = excluded.paid_amount,
        issued_at = excluded.issued_at, due_date = excluded.due_date,
        last_payment_at = excluded.last_payment_at, shipment_id = excluded.shipment_id,
        shipment_code = excluded.shipment_code, lines = excluded.lines,
        notes = excluded.notes, updated_at = now();

  raise notice 'Seed facturas demo OK · cliente=% (%) · 5 facturas (total 15400, pagado 6050)',
    v_name, v_markbox;
end $$;

-- Verificación (esperado: 5 filas · total 15400 · pagado 6050 · saldo 9350):
select invoice_code, status, total_amount, paid_amount, issued_at, due_date, shipment_code
from public.invoices
where client_markbox = 'DTD-1004' and invoice_code like 'F-2026-D%'
order by invoice_code;
