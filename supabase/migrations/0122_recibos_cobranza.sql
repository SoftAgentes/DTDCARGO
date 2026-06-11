-- ─────────────────────────────────────────────────────────────
-- SDD-0068: Recibos de cobranza con mandato (SDD-C capa legal)
-- ADITIVA sobre payment_receipts (0079) + invoices (0077) + seed
-- de cuenta puente en el plan de cuentas (0078/0114).
--
-- 1. Pagador (decisión #7 handoff): payer_kind cliente|tercero +
--    payer_name/payer_relation + licit_declared (declaración de
--    licitud de fondos cuando paga un tercero).
-- 2. Estados de aplicación del pago (COPY_LEGAL_UI §7):
--    recibido_sin_ref | identificado | aplicado | rendido.
--    Default 'aplicado' (todo recibo histórico nació aplicado).
--    'rendido' queda DEFINIDO pero su transición es SDD-D.
-- 3. Pago sin referencia (cláusula 7.3 + decisión #6): el recibo
--    puede existir SIN factura → invoice_id pasa a NULLABLE
--    (relajación segura, sin pérdida de datos) y los snapshots
--    client_markbox/client_name quedan NULL hasta identificar.
--    CHECK de integridad: sin-ref ⇔ invoice_id IS NULL.
-- 4. Separación de fondos (mandato): fund_class third_party |
--    local_revenue en invoices Y payment_receipts, con backfill
--    por shipment_service (transporte_terrestre o factura sin
--    shipment ⇒ local_revenue; el resto ⇒ third_party — fondos
--    recaudados por cuenta de la Operadora).
-- 5. Cuenta puente "Fondos por identificar" (pasivo 2.1.8) para el
--    asiento del pago sin referencia (DR caja / CR 2.1.8) y su
--    reclasificación al identificar (DR 2.1.8 / CR 1.1.2).
--    ⚠ 2.1.7 YA está tomada por 0114 (Cuenta corriente Socio
--    Logístico China) → el siguiente code libre en 2.1.x es 2.1.8
--    (verificado contra los seeds reales de 0078 + 0114).
--
-- NO toca: máquina de estados de invoices, asientos de emisión,
-- legal_acceptances (0067), tesorería. NO se aplica a prod (founder).
-- ─────────────────────────────────────────────────────────────

-- ── 1+2. Columnas nuevas en payment_receipts ──────────────────
alter table public.payment_receipts
  add column if not exists payer_kind         text not null default 'cliente',
  add column if not exists payer_name         text,
  add column if not exists payer_relation     text,
  add column if not exists licit_declared     boolean not null default false,
  add column if not exists application_status text not null default 'aplicado',
  add column if not exists identified_at      timestamptz,
  add column if not exists fund_class         text not null default 'third_party';

comment on column public.payment_receipts.payer_kind is
  'SDD-0068: quién realizó el pago — cliente (default) | tercero (decisión #7 del handoff legal).';
comment on column public.payment_receipts.payer_name is
  'SDD-0068: nombre del pagador. Obligatorio (a nivel de acción + CHECK) cuando payer_kind=tercero.';
comment on column public.payment_receipts.payer_relation is
  'SDD-0068: relación del tercero con el cliente — familiar|socio|empleado|otro. Solo aplica a payer_kind=tercero.';
comment on column public.payment_receipts.licit_declared is
  'SDD-0068: el pagador declaró que los fondos corresponden a la operación y son de origen lícito (checkbox obligatorio para terceros). false para pagos del propio cliente (no aplica).';
comment on column public.payment_receipts.application_status is
  'SDD-0068 (COPY §7): recibido_sin_ref (fondos en cuenta sin cruce) | identificado (cruzado, imputación retroactiva) | aplicado (saldo actualizado) | rendido (incluido en rendición quincenal — transición SDD-D, definida pero sin wiring en V1).';
comment on column public.payment_receipts.identified_at is
  'SDD-0068: timestamp de la identificación retroactiva de un pago sin referencia. received_at conserva la fecha ORIGINAL de recepción de fondos (la imputación es retroactiva, decisión #6).';
comment on column public.payment_receipts.fund_class is
  'SDD-0068: clasificación de fondos del mandato — third_party (recaudado por cuenta de la Operadora) | local_revenue (servicios locales de DTD Services). Hereda de la factura; sin-ref ⇒ third_party hasta identificar.';

-- ── 3. invoice_id + snapshots NULLABLES (pago sin referencia) ──
-- Relajación segura: ninguna fila existente viola NOT NULL al soltarlo.
alter table public.payment_receipts alter column invoice_id     drop not null;
alter table public.payment_receipts alter column client_markbox drop not null;
alter table public.payment_receipts alter column client_name    drop not null;

-- ── CHECKs (drop+add para idempotencia — patrón entity_audit_log) ──
do $$
begin
  alter table public.payment_receipts drop constraint if exists payment_receipts_payer_kind_check;
  alter table public.payment_receipts
    add constraint payment_receipts_payer_kind_check
    check (payer_kind in ('cliente', 'tercero'));

  alter table public.payment_receipts drop constraint if exists payment_receipts_payer_relation_check;
  alter table public.payment_receipts
    add constraint payment_receipts_payer_relation_check
    check (payer_relation is null or payer_relation in ('familiar', 'socio', 'empleado', 'otro'));

  -- Defensa en la DB (lección SDD-0045): un tercero SIEMPRE viaja con nombre +
  -- relación + declaración de licitud — la validación de la action no alcanza
  -- contra un INSERT directo por PostgREST.
  alter table public.payment_receipts drop constraint if exists payment_receipts_tercero_completo_check;
  alter table public.payment_receipts
    add constraint payment_receipts_tercero_completo_check
    check (
      payer_kind <> 'tercero'
      or (payer_name is not null and payer_relation is not null and licit_declared = true)
    );

  alter table public.payment_receipts drop constraint if exists payment_receipts_application_status_check;
  alter table public.payment_receipts
    add constraint payment_receipts_application_status_check
    check (application_status in ('recibido_sin_ref', 'identificado', 'aplicado', 'rendido'));

  -- Integridad sin-ref ⇔ sin factura (decisión #2 del spec): un pago sin
  -- referencia NO apunta a factura; identificado/aplicado/rendido SIEMPRE.
  alter table public.payment_receipts drop constraint if exists payment_receipts_sinref_invoice_check;
  alter table public.payment_receipts
    add constraint payment_receipts_sinref_invoice_check
    check ((application_status = 'recibido_sin_ref') = (invoice_id is null));

  -- Los snapshots de cliente solo pueden faltar mientras el pago está sin
  -- identificar (quedan NULL hasta identificar, decisión #2).
  alter table public.payment_receipts drop constraint if exists payment_receipts_snapshots_check;
  alter table public.payment_receipts
    add constraint payment_receipts_snapshots_check
    check (
      application_status = 'recibido_sin_ref'
      or (client_markbox is not null and client_name is not null)
    );

  alter table public.payment_receipts drop constraint if exists payment_receipts_fund_class_check;
  alter table public.payment_receipts
    add constraint payment_receipts_fund_class_check
    check (fund_class in ('third_party', 'local_revenue'));
end $$;

-- Índice parcial para la bandeja "Sin identificar" (pocas filas, lookup directo).
create index if not exists pr_tenant_sin_ref_idx
  on public.payment_receipts (tenant_id, received_at)
  where application_status = 'recibido_sin_ref' and deleted_at is null;

-- ── 4. invoices.fund_class + backfill ─────────────────────────
alter table public.invoices
  add column if not exists fund_class text not null default 'third_party';

comment on column public.invoices.fund_class is
  'SDD-0068: clasificación de fondos del mandato — third_party (flete internacional recaudado por cuenta de la Operadora) | local_revenue (servicios locales facturables por DTD Services). Derivada de shipments.shipment_service al crear/emitir: transporte_terrestre o factura SIN shipment ⇒ local_revenue; consolidacion | puerta_a_puerta_DDP | reserva_FCL ⇒ third_party.';

do $$
begin
  alter table public.invoices drop constraint if exists invoices_fund_class_check;
  alter table public.invoices
    add constraint invoices_fund_class_check
    check (fund_class in ('third_party', 'local_revenue'));
end $$;

-- Backfill (decisión #5): factura SIN shipment ⇒ servicio local.
update public.invoices
set fund_class = 'local_revenue'
where shipment_id is null;

-- Backfill: shipment de transporte terrestre ⇒ servicio local. El resto
-- (consolidacion / puerta_a_puerta_DDP / reserva_FCL) queda en el default
-- 'third_party' (fondos de la Operadora).
update public.invoices i
set fund_class = 'local_revenue'
from public.shipments s
where i.shipment_id = s.id
  and s.shipment_service = 'transporte_terrestre';

-- Backfill receipts: heredan la clase de SU factura. (Pre-0122 todo recibo
-- tiene invoice_id NOT NULL → no quedan sin-ref históricos; los que no
-- crucen quedarían en el default 'third_party'.)
update public.payment_receipts pr
set fund_class = i.fund_class
from public.invoices i
where pr.invoice_id = i.id;

-- ── 5. Cuenta puente 2.1.8 "Fondos por identificar" (seed) ─────
-- Pasivo corriente postable. Patrón idempotente de 0078/0114 (on conflict
-- (tenant_id, code) do nothing) + parent_id por prefijo del code.
-- Asientos que la usan (SDD-0068):
--   · pago sin referencia : DR caja / CR 2.1.8
--   · identificación      : DR 2.1.8 / CR 1.1.2 (fecha = received_at original)
insert into public.accounts (tenant_id, code, name, type, is_postable, qbo_type)
select t.id, x.code, x.name, x.type::acct_type, x.is_postable, x.qbo_type
from public.tenants t
cross join (values
  ('2.1.8', 'Fondos por identificar', 'P', true, 'Other Current Liabilities')
) as x(code, name, type, is_postable, qbo_type)
where t.slug = 'dtd'
on conflict (tenant_id, code) do nothing;

update public.accounts child
set parent_id = parent.id
from public.accounts parent, public.tenants t
where t.slug = 'dtd'
  and child.tenant_id = t.id
  and parent.tenant_id = t.id
  and child.parent_id is null
  and child.code = '2.1.8'
  and parent.code = '2.1';

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0122_recibos_cobranza.sql
-- La aplica el founder (el harness NO aplica migraciones a prod).
-- ─────────────────────────────────────────────────────────────
