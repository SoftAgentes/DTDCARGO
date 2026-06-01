---
sdd: "0041"
title: "Cobranzas — recibos de pago + asiento del cobro + cola CxC (Bloque 2.1)"
status: done
author: "founder"
created: 2026-06-01
updated: 2026-06-01
supersedes: null
superseded_by: null
related: ["0021", "0040", "0010"]
confidencialidad: interno
---

# DTD-0041 — Cobranzas

> **Bloque 2.1 financiero.** Completa el ciclo **factura → cobro → caja → contabilidad**.
> Hoy `registerPayment` (SDD-0021) es un acumulador (`paid_amount`) sin historial ni asiento.
> Acá se agrega el **ledger de recibos** + el **asiento del cobro** (DR Banco/Caja / CR Clientes) —
> cierra el gap que SDD-0040 dejó explícito (el asiento del pago necesitaba elegir cuenta de caja).
> Más la **cola de CxC** (facturas con saldo, aging, gestión de cobranza).

---

## 1. Resumen en una línea

Tabla `payment_receipts` (recibos `R-YYYY-NNNN`) + upgrade del registro de pago a (a) crear recibo,
(b) bajar saldo de la factura, (c) **asentar el cobro** (DR cuenta de caja/banco / CR Clientes), +
módulo Cobranzas con la cola de CxC (aging, KPIs) y un log de gestión (contacto/promesa) liviano.

---

## 2. Scope

### Incluye

#### Backend (Supabase)
- Migration `00NN_cobranzas.sql` (siguiente correlativo libre, ~`0079`):
  - Tabla `public.payment_receipts`: id, tenant_id, receipt_code (unique por tenant, `R-YYYY-NNNN`),
    invoice_id (FK a invoices, `on delete restrict` — no borrar factura con recibos), client_markbox
    + client_name (snapshot), amount, currency (`invoice_currency`), fx_rate, method (text:
    `efectivo/transferencia/zelle/pago_movil/usdt/otro`), cash_account_id (FK a accounts — la
    cuenta de caja/banco que recibió; debe ser postable), reference, received_at (date),
    journal_entry_id (FK opcional al asiento generado), notes, created_at, deleted_at
  - Tabla `public.collection_activities` (gestión de cobranza, log liviano): id, tenant_id,
    invoice_id (FK), kind (`contacto/promesa/nota/recordatorio`), promised_amount, promised_date,
    next_followup, body, created_at, created_by
  - Función `public.next_receipt_code(p_tenant_id)` → `R-YYYY-NNNN` (patrón `next_invoice_code`)
  - Índices `(tenant_id, invoice_id)` en ambas + RLS por tenant + grants + trigger updated_at donde aplique

#### Lib
- `lib/studio/payment-types.ts`: `PaymentReceipt`, `PaymentMethod` + `PAYMENT_METHOD_OPTIONS`,
  `CollectionActivity`, `CollectionKind`, `validatePaymentInput` (amount > 0 y ≤ saldo, cuenta requerida),
  `validateActivityInput`.
- `lib/studio/payment-queries.ts`: `listReceipts(supabase, {invoiceId})`, `receivablesQueue(supabase)`
  (facturas con `total_amount - paid_amount > 0`, no anuladas, con aging `días vencido` + stage derivado),
  `collectionKpis(supabase)` (`{ porCobrar, vencido, enPromesa }`), `listActivities(supabase, invoiceId)`.
- `lib/studio/accounting/receipt-posting.ts`: `postReceiptJournalEntry(admin, receipt)` → asiento
  `source='receipt'`, **DR `cash_account_id`** = amount, **CR `1.1.2` Clientes** = amount; idempotente
  por `receipt_id` (guardar `journal_entry_id` en el recibo); best-effort. (Hermano de `invoice-posting.ts`.)

#### Pages + actions
- Upgrade del registro de pago (vive en `lib/studio` + se llama desde 2 lugares):
  - Reemplazar/extender `registerPayment` de `facturacion/actions.ts`: ahora recibe `cashAccountId`,
    `method`, `receivedAt`, `reference` → crea `payment_receipt` (code via rpc) + sube `paid_amount` +
    recalcula status (`parcial`/`pagada`) + `postReceiptJournalEntry` (best-effort, no rompe el pago).
  - El modal "Registrar pago" del detalle de factura (SDD-0021) gana los campos: **cuenta de caja/banco**
    (select de cuentas postables tipo banco/caja — `qbo_type='Bank'` o code `1.1.1.*`), método, fecha, referencia.
- Módulo NUEVO `app/studio/(app)/cobranzas/page.tsx` (server) + ítem en el sidebar (grupo Finanzas,
  tras Facturación/Contabilidad). Vista:
  - KPIs: Por cobrar · Vencido · En promesa de pago · Tasa de cobro (de `collectionKpis`).
  - Tabla cola CxC: Factura · Cliente · Saldo · Vencimiento (con "vencido Xd" en `--danger`) · Última
    gestión · Estado. Filtro por stage (todas/abiertas/vencidas/promesa/pagadas). Fila vencida >30d en `--danger-bg`.
  - Click fila → drawer/detalle del receivable: datos de la factura + **Registrar cobro** + **Registrar
    gestión** (contacto/promesa/nota) + historial de recibos y gestiones.
- `cobranzas/actions.ts`: `registerCollection(...)` (la lógica compartida del cobro), `logActivity(...)`
  (gestión), `voidReceipt(id)` (anula recibo → reversa el efecto: baja `paid_amount`, anula su asiento).
  Acciones sensibles → `entity_audit_log` (ampliar CHECK aditivo con `payment_receipt`).

### NO incluye (queda para SDDs futuros)
- **Tesorería (Bloque 2.2)** — cuentas de caja/banco como módulo, CxP (cuentas por pagar a
  proveedores/navieras), órdenes de pago, **remesas a China**, multi-firma, dashboard de caja multi-moneda.
- **Recordatorios automáticos / "Recordatorio masivo" real** — el botón puede quedar disabled o encolar
  un email del dominio `mail_*` en un SDD posterior. Acá la gestión es manual (log).
- **Escalamiento automático** por días de mora, alertas de promesa incumplida — SDD futuro.
- **Conversión multi-moneda** del cobro — se guarda `currency`+`fx_rate`; el asiento se hace en USD
  funcional (si el cobro es en VES, el monto USD se deriva con `fx_rate`). Revaluación = futuro.
- **Conciliación bancaria** (match recibo↔extracto) — Tesorería/futuro.
- **Nota de crédito / quita** — anular recibo sí; descuentos/quitas formales = futuro.

---

## 3. Archivos a crear / editar

### Nuevos
```
docs/specs/0041-cobranzas/spec.md
supabase/migrations/00NN_cobranzas.sql              ← payment_receipts + collection_activities + next_receipt_code
lib/studio/payment-types.ts
lib/studio/payment-queries.ts
lib/studio/accounting/receipt-posting.ts            ← asiento del cobro (hermano de invoice-posting)
app/studio/(app)/cobranzas/page.tsx                 ← módulo nuevo
app/studio/(app)/cobranzas/actions.ts
app/studio/(app)/cobranzas/_components/*.tsx        ← cola CxC + drawer receivable + registrar cobro/gestión
```
### Editados
```
app/studio/(app)/facturacion/actions.ts             ← registerPayment → crea recibo + asiento del cobro
app/studio/(app)/facturacion/_components/InvoiceDetailClient.tsx  ← modal pago: + cuenta caja/método/fecha/ref
app/studio/(app)/_components/StudioSidebar.tsx       ← ítem "Cobranzas" (grupo Finanzas)
docs/architecture/module-sdd-map.md                  ← cobranzas → SDD-0041
```

---

## 4. Schema (esqueleto)

```sql
create table public.payment_receipts (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  receipt_code     text not null,
  invoice_id       uuid not null references public.invoices(id) on delete restrict,
  client_markbox   text not null,
  client_name      text not null,
  amount           numeric(14,2) not null,
  currency         invoice_currency not null default 'USD',
  fx_rate          numeric(14,4),
  method           text not null default 'transferencia',
  cash_account_id  uuid not null references public.accounts(id),
  reference        text,
  received_at      date not null default current_date,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  notes            text,
  created_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  unique (tenant_id, receipt_code)
);
create index pr_tenant_invoice_idx on public.payment_receipts (tenant_id, invoice_id) where deleted_at is null;

create table public.collection_activities (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  invoice_id    uuid not null references public.invoices(id) on delete cascade,
  kind          text not null,                         -- contacto/promesa/nota/recordatorio
  promised_amount numeric(14,2),
  promised_date date,
  next_followup date,
  body          text,
  created_at    timestamptz not null default now(),
  created_by    uuid
);
create index ca_tenant_invoice_idx on public.collection_activities (tenant_id, invoice_id);

-- next_receipt_code R-YYYY-NNNN + RLS por tenant en ambas + grants.
```
La **cola de CxC** se deriva por query de `invoices` (`total_amount - paid_amount > 0` y status ≠
`anulada`), no es una tabla nueva. El "stage" se deriva (vencido si `due_date<today`; promesa si hay
`collection_activity` kind=promesa vigente; pagado si saldo 0).

---

## 5. Decisiones de diseño

### 5.1 El cobro vive una sola vez (lib compartida), se dispara desde 2 lugares
La lógica (recibo + saldo + asiento) es una función compartida; la llaman el detalle de factura
(SDD-0021) y el módulo Cobranzas. Misma operación, un solo camino server-side.

### 5.2 Asiento del cobro: DR caja/banco / CR Clientes
Al registrar cobro: **DR** la `cash_account_id` elegida (caja/banco, postable) por `amount`, **CR**
`1.1.2` Cuentas por cobrar clientes por `amount`. `source='receipt'`, idempotente por recibo, best-effort
(si la contabilidad falla, el cobro se registra igual; log). Cierra el ciclo iniciado por el asiento de
emisión de SDD-0040 (que dejó el saldo en Clientes).

### 5.3 USD funcional; VES con fx_rate (sin revaluación)
El asiento se hace en USD. Si el cobro entra en VES/USDT, se guarda `currency`+`fx_rate` y el monto USD
se deriva. Sin motor de conversión ni revaluación (Tesorería/futuro).

### 5.4 Gestión de cobranza = log liviano, stage derivado
`collection_activities` registra contacto/promesa/nota. El "estado" de la cola se deriva (vencido/
promesa/pagado), no es una máquina de estados con persistencia propia. Recordatorios automáticos = futuro.

### 5.5 Anular recibo revierte
`voidReceipt` baja `paid_amount`, recalcula status de la factura, y **anula su asiento** (el del cobro).
No se borra (auditable).

### 5.6 Cuenta de caja válida
El select filtra a cuentas postables de tipo banco/caja (`qbo_type='Bank'` o code `1.1.1.*`). Si el CoA
no está sembrado, el cobro se registra pero el asiento queda best-effort (log `missing-cash-account`).

---

## 6. Criterios de aceptación

### Backend
- [ ] Migración aplica; `payment_receipts` + `collection_activities` con RLS + `tenant_id`
- [ ] `next_receipt_code()` → `R-2026-0001`; FK `invoice_id` `on delete restrict`

### Lib
- [ ] `receivablesQueue` lista solo facturas con saldo > 0 y status ≠ anulada, con aging correcto
- [ ] `validatePaymentInput` rechaza amount ≤ 0, amount > saldo, y cuenta faltante
- [ ] `postReceiptJournalEntry` arma DR caja / CR 1.1.2 balanceado, idempotente por recibo

### UI / flujo E2E
- [ ] `/studio/cobranzas` existe (sidebar, grupo Finanzas), KPIs + cola con aging
- [ ] "Registrar cobro" (desde factura o cobranzas): elige cuenta de caja + método → baja el saldo,
      mueve status a parcial/pagada, crea el recibo
- [ ] El cobro **genera su asiento** (DR caja / CR Clientes), visible en Libro diario (Contabilidad)
- [ ] "Registrar gestión" (promesa con monto/fecha) queda en el historial; el stage refleja "promesa"
- [ ] Anular recibo revierte saldo + anula su asiento
- [ ] light + dark; cero hex; pasó ui-ux-designer

### Sistema
- [ ] `node scripts/verify.mjs` verde · frontera público↔ERP intacta

---

## 7. Out of scope / open questions
- **¿El cobro puede ser sobre varias facturas a la vez (un pago, N facturas)?** No en el MVP — un recibo
  por factura. Pago multi-factura = futuro.
- **¿Anticipos / pagos a cuenta sin factura?** No — el recibo requiere `invoice_id`. Anticipos = Tesorería/futuro.
- **¿Recordatorio masivo real (email)?** No acá — botón disabled o encola para SDD de mail. Gestión manual.
- **¿De qué cuenta de ingreso/caja por defecto?** El usuario elige la caja/banco en cada cobro (no default).

## Diseño
`docs/design/studio/_norte/nuevo/modules/cobranzas.jsx` + `cobranzas-data.jsx` (v2.3) — cola CxC, KPIs,
aging, stages, gestión. Modelo: el cobro se apoya en `invoices` (SDD-0021) + `accounts`/`journal_entries`
(SDD-0040). Asiento del cobro: hermano de `lib/studio/accounting/invoice-posting.ts`.

## Notas de implementación (2026-06-01)
- **Migración `0079_cobranzas.sql`** (el correlativo libre era 0079, tras `0078_contabilidad.sql`):
  `payment_receipts` + `collection_activities` + `next_receipt_code()` + RLS por tenant + grants +
  CHECK aditivo de `entity_audit_log` (+ `payment_receipt`). **Además** agrega (aditivo, nullable)
  `journal_entries.receipt_id` (FK→`payment_receipts`, `on delete set null`) + índice `je_receipt_idx`,
  porque el asiento del cobro (`source='receipt'`) referencia su recibo igual que el de factura usa
  `invoice_id`. `source` es texto libre → `'receipt'` no necesita tocar ningún enum/CHECK. Se actualizó
  `EntrySource`/`JournalEntry`/`entrySourceLabel` ("Cobro") + `ENTRY_COLUMNS` para incluirlo.
- **Lógica del cobro compartida** en `lib/studio/collections-actions.ts` (`registerCollectionFor` /
  `voidReceiptFor`): la llaman `facturacion/actions.ts` (`registerPayment` extendido a recibir
  `cashAccountId/method/receivedAt/reference`) y `cobranzas/actions.ts` (`registerCollection`). Un solo
  camino server-side. El asiento es best-effort (no rompe el cobro); `journal_entry_id` se guarda en el
  recibo. `voidReceipt` marca `deleted_at`, baja `paid_amount`, recalcula status (`emitida`/`parcial`) y
  anula su asiento.
- **Aging/stage** se derivan en `payment-queries.ts` (`buildReceivablesQueue` + `derivedStage`, puras);
  KPIs en `computeCollectionKpis`. Cuenta de caja válida: `isCashAccount` (`qbo_type='Bank'` o code
  `1.1.1.*`, postable).
- **Tests**: `lib/studio/__tests__/payment.test.ts` (43 casos) cubren `buildReceivablesQueue`
  (saldo>0/no-anulada/aging/orden), `derivedStage`, `computeCollectionKpis`, `validatePaymentInput`
  (≤0, >saldo, cuenta faltante, fecha), `validateActivityInput`, `buildReceiptLines`+`receiptAmountUsd`
  (DR caja / CR 1.1.2 balanceado), `isCashAccount`, `formatReceiptCode` (R-YYYY-NNNN).
- **NO incluido** (respetado): sin Tesorería, sin recordatorio masivo real (botón disabled), sin
  conversión multi-moneda (se guarda `currency`+`fx_rate`, asiento en USD vía `receiptAmountUsd`), sin
  conciliación, sin pago multi-factura. Comprobante de pago obligatorio del mockup → **diferido**
  (Storage/Tesorería); en V1 la referencia es texto opcional.
- Migración **NO** aplicada a prod (la aplica el founder). Sin commit/push.
