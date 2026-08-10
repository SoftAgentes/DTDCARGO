---
sdd: "0044"
title: "Tesorería — Proveedores + CxP + órdenes de pago + asiento del pago (Bloque 2.2)"
status: done
author: "founder"
created: 2026-06-02
updated: 2026-06-03
supersedes: null
superseded_by: null
related: ["0041", "0040", "0021", "0010"]
confidencialidad: interno
---

# DTD-0044 — Tesorería

> **Bloque 2.2 financiero — el espejo de Cobranzas.** Donde SDD-0041 cerró el ciclo del **cobro**
> (factura → recibo → caja → asiento DR Caja / CR Clientes), acá se cierra el del **pago**:
> proveedor → cuenta por pagar (CxP) → orden de pago → asiento **DR Cuentas por pagar / CR Caja**.
> Completa el flujo de caja del ERP: la mitad de salida (lo que pagamos), incluyendo **remesas a China**
> (USDT/CNY) a proveedores CN y pagos a navieras/agentes. Reusa `accounts`/`journal_entries` (SDD-0040)
> y calca el patrón de `payment_receipts`/`collection_activities` de Cobranzas.

---

## 1. Resumen en una línea

Tabla `suppliers` (proveedores-lite, `PRV-NNNN`) + `supplier_bills` (CxP, `CXP-YYYY-NNNN`, con
**asiento de causación** DR Costo/Gasto / CR `2.1.1` Proveedores) + `supplier_payments` (órdenes de pago,
`OP-YYYY-NNNN`, con **asiento del pago** DR `2.1.1` / CR cuenta de caja) + módulo Tesorería con la **cola
de CxP** (aging, KPIs) y el historial de pagos. Multi-moneda USD/VES/USDT/CNY (asiento en USD funcional vía
`fx_rate`). **Sin** aprobación multi-firma (Fase 2).

---

## 2. Scope

### Incluye

#### Backend (Supabase)
- Migration `0088_tesoreria.sql`:
  - Tabla `public.suppliers` (proveedor-lite): id, tenant_id, supplier_code (unique por tenant,
    `PRV-NNNN`), name, name_cn (nullable, 唛/proveedor chino), type (text: `proveedor_cn/naviera/
    agente_aduanal/servicio/otro`), country (text: `CN/VE/otro`), default_currency (`invoice_currency`,
    default `USD`), payment_channel (text libre: "USDT", "Alipay", "transferencia BS", etc.), contact_name,
    contact_phone, contact_email, tax_id (RIF/registro), notes, created_at, updated_at, deleted_at.
  - Tabla `public.supplier_bills` (CxP): id, tenant_id, bill_code (unique, `CXP-YYYY-NNNN`),
    supplier_id (FK `restrict`), supplier_name (snapshot), concept, expense_account_id (FK accounts —
    la cuenta de costo/gasto que se debita en la causación; postable, tipo CGS/Gasto), currency
    (`invoice_currency`), fx_rate, total_amount, paid_amount (default 0), status (text:
    `pendiente/parcial/pagada/anulada`, default `pendiente`), issue_date (date), due_date (date),
    reference (nº de proforma/factura del proveedor), shipment_id (FK shipments `set null`, nullable —
    para costing futuro), journal_entry_id (FK al asiento de causación, opcional), notes, created_at,
    updated_at, deleted_at.
  - Tabla `public.supplier_payments` (órdenes de pago): id, tenant_id, payment_code (unique,
    `OP-YYYY-NNNN`), bill_id (FK `restrict`), supplier_id (FK), supplier_name (snapshot), amount,
    currency (`invoice_currency`), fx_rate, method (text: `transferencia/efectivo/zelle/usdt/alipay/
    remesa_china/otro`), cash_account_id (FK accounts — la cuenta de caja/banco que paga; postable),
    reference, paid_at (date), journal_entry_id (FK al asiento del pago, opcional), notes, created_at,
    deleted_at.
  - Funciones `public.next_supplier_code(p_tenant_id)` → `PRV-NNNN` (patrón `next_markbox`, sin año),
    `public.next_bill_code(p_tenant_id)` → `CXP-YYYY-NNNN` y
    `public.next_payment_order_code(p_tenant_id)` → `OP-YYYY-NNNN` (patrón `next_invoice_code`).
  - Aditivo a `journal_entries`: columnas nullable `bill_id` (FK `supplier_bills` `set null`) y
    `supplier_payment_id` (FK `supplier_payments` `set null`) + índices — el asiento de causación
    (`source='supplier_bill'`) y el del pago (`source='supplier_payment'`) referencian su origen igual
    que el de factura usa `invoice_id` y el del cobro `receipt_id`. `source` es texto libre → no toca
    enums/CHECK.
  - Índices `(tenant_id, ...)` + RLS por tenant en las 3 tablas + grants + trigger updated_at donde aplique.
  - CHECK aditivo de `entity_audit_log` → `+ supplier`, `+ supplier_bill`, `+ supplier_payment`.

#### Lib (`lib/studio/treasury/` — dominio con ≥3 archivos → carpeta)
- `types.ts`: `Supplier`, `SupplierType` + `SUPPLIER_TYPE_OPTIONS`, `SupplierBill`, `BillStatus` +
  `BILL_STATUS_META` (label + badge tone), `SupplierPayment`, `PaymentMethod` + `PAYMENT_METHOD_OPTIONS`,
  `validateSupplierInput` (name requerido), `validateBillInput` (total > 0, proveedor + cuenta de gasto +
  vencimiento requeridos), `validatePaymentInput` (amount > 0 y ≤ saldo, cuenta de caja requerida).
- `supplier-queries.ts`: `listSuppliers(supabase, {type?})`, `getSupplier(supabase, id)`.
- `bill-queries.ts`: `listBills(supabase, {supplierId?})`, `buildPayablesQueue` (puras: bills con
  `total_amount - paid_amount > 0`, no anuladas, con aging `días vencido` + `derivedStage` —
  `vencida`/`por_vencer`/`parcial`/`pagada`), `computeTreasuryKpis` (`{ porPagar, vencido, pagadoMes,
  proveedoresActivos }`), `listPayments(supabase, {billId?})`.
- `lib/studio/accounting/bill-posting.ts`: `postBillJournalEntry(admin, bill)` → asiento de **causación**
  `source='supplier_bill'`, **DR `expense_account_id`** = total, **CR `2.1.1` Cuentas por pagar
  proveedores** = total; idempotente por `bill_id`; best-effort. (Hermano de `invoice-posting.ts`.)
- `lib/studio/accounting/supplier-payment-posting.ts`: `postSupplierPaymentJournalEntry(admin, payment)`
  → asiento del **pago** `source='supplier_payment'`, **DR `2.1.1`** = amount, **CR `cash_account_id`** =
  amount; idempotente por `payment_id`; best-effort. (Hermano de `receipt-posting.ts`.)
- Helper `isExpenseAccount` (postable, tipo `qbo_type IN ('Cost of Goods Sold','Expense')` o code `5.*`/`6.*`).
  Reusar `isCashAccount` de Cobranzas (`qbo_type='Bank'` o code `1.1.1.*`).

#### Pages + actions
- Módulo NUEVO `app/studio/(app)/tesoreria/page.tsx` (server) + ítem en el sidebar (grupo **FINANZAS**,
  id `treasury`, tras Cobranzas/`collections`). Vista con **KPI strip** + **3 tabs**:
  - **Cuentas por pagar** (core): KPIs (Por pagar · Vencido · Pagado mes · Proveedores activos). Tabla cola
    CxP: CxP · Proveedor (+ 中文 si hay) · Concepto · Saldo (USD) · Vencimiento (con "vencido Xd" en
    `--danger`) · Estado. Filtros por tipo de proveedor y estado. Fila vencida >0d en `--danger-bg`.
    Botón "Nueva CxP".
  - **Pagos** (historial de órdenes de pago, derivado de `supplier_payments`): Orden · Fecha · Proveedor ·
    Método · Monto (USD, + original si VES/CNY) · CxP origen. KPI "Remesas a China" (USDT+CNY) opcional.
  - **Proveedores** (supplier-lite): lista + alta/edición. Tipo, país, canal de pago, contacto, moneda default.
  - Click fila CxP → **drawer**: datos de la CxP + proveedor + **Registrar pago** (elige cuenta de caja +
    método + monto + fecha + ref → baja saldo, mueve status, crea la orden de pago) + historial de pagos.
    Embarque vinculado (si `shipment_id`) como link read-only.
- `tesoreria/actions.ts`: `createSupplier`/`updateSupplier`, `createBill` (crea CxP + `postBillJournalEntry`
  best-effort), `voidBill` (anula CxP sin pagos), `registerPayment` (la lógica del pago), `voidPayment`
  (anula orden → reversa: baja `paid_amount`, recalcula status, anula su asiento). Acciones sensibles →
  `entity_audit_log`.

### NO incluye (queda para Fase 2 / SDDs futuros)
- **Aprobación / multi-firma de órdenes de pago** — decisión del founder (2026-06-02): el MVP registra el
  pago directo (igual que Cobranzas registra el cobro directo). Estado `borrador→aprobado→pagado`,
  `approved_by` y workflow de aprobación = Fase 2.
- **Dashboard de proyección de caja** (forecast 4 semanas, "caja cubre X% del por pagar") — Fase 2.
- **Posición de caja multi-moneda por cuenta** (tab "Cuentas" del mockup, saldos por cash account
  derivados del mayor) — depende de query de balance del ledger; Fase 2.
- **Conciliación bancaria** (match pago↔extracto) — futuro.
- **Anticipos a proveedores** (cuenta `1.1.4`) sin CxP previa — el pago requiere `bill_id`. Futuro.
- **Pago multi-factura** (una orden, N CxP) — una orden por CxP en el MVP. Futuro.
- **Conversión / revaluación FX** — se guarda `currency`+`fx_rate`; el asiento se hace en USD funcional
  (monto USD derivado del `fx_rate` si entra en VES/CNY/USDT). Revaluación = futuro.
- **Comprobante de pago obligatorio** (Storage) — en V1 la `reference` es texto opcional; el archivo se
  difiere a un SDD de Documentos/Storage.
- **Costing real CxP↔embarque** — se guarda `shipment_id` (nullable) para futuro; la imputación al costo
  directo del embarque es Bloque 5 (SDD-0022 Costing).
- **Proveedores como módulo dedicado** (`/studio/proveedores`) — el stub existente queda como está; la
  gestión de proveedores vive en el tab de Tesorería. Migrar el stub = futuro.

---

## 3. Archivos a crear / editar

> **Nota de implementación (2026-06-03):** la migración se numeró **`0088_tesoreria.sql`**
> (no `0087`): `0087_portal_approval.sql` ya estaba tomada por SDD-0042 Fase 5 entre la
> aprobación de esta spec y su implementación. `0088` era el correlativo libre.

### Nuevos
```
docs/specs/0044-tesoreria/spec.md
supabase/migrations/0088_tesoreria.sql              ← suppliers + supplier_bills + supplier_payments + 3 RPCs + columnas en journal_entries
lib/studio/treasury/types.ts
lib/studio/treasury/supplier-queries.ts
lib/studio/treasury/bill-queries.ts
lib/studio/accounting/bill-posting.ts               ← asiento de causación (DR gasto / CR 2.1.1)
lib/studio/accounting/supplier-payment-posting.ts   ← asiento del pago (DR 2.1.1 / CR caja)
app/studio/(app)/tesoreria/page.tsx                 ← módulo nuevo
app/studio/(app)/tesoreria/actions.ts
app/studio/(app)/tesoreria/_components/*.tsx        ← cola CxP + tabs + drawer CxP + registrar pago + alta proveedor
lib/studio/treasury/__tests__/treasury.test.ts
```
### Editados
```
app/studio/(app)/_components/StudioSidebar.tsx       ← ítem "Tesorería" (id treasury, grupo FINANZAS, tras Cobranzas)
lib/studio/journal-types.ts                          ← EntrySource + 'supplier_bill'/'supplier_payment'; entrySourceLabel ("Causación CxP"/"Pago a proveedor"); ENTRY_COLUMNS
docs/architecture/module-sdd-map.md                  ← tesoreria → SDD-0044
docs/architecture/schema-reconciliation.md           ← Supplier 🟡→✅(lite) · Bloque 2.2 done
```

---

## 4. Schema (esqueleto)

```sql
create table public.suppliers (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  supplier_code    text not null,                          -- PRV-NNNN
  name             text not null,
  name_cn          text,
  type             text not null default 'proveedor_cn',   -- proveedor_cn/naviera/agente_aduanal/servicio/otro
  country          text not null default 'CN',             -- CN/VE/otro
  default_currency invoice_currency not null default 'USD',
  payment_channel  text,
  contact_name     text,
  contact_phone    text,
  contact_email    text,
  tax_id           text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  unique (tenant_id, supplier_code)
);

create table public.supplier_bills (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  bill_code          text not null,                        -- CXP-YYYY-NNNN
  supplier_id        uuid not null references public.suppliers(id) on delete restrict,
  supplier_name      text not null,
  concept            text,
  expense_account_id uuid not null references public.accounts(id),  -- DR en la causación
  currency           invoice_currency not null default 'USD',
  fx_rate            numeric(14,4),
  total_amount       numeric(14,2) not null,
  paid_amount        numeric(14,2) not null default 0,
  status             text not null default 'pendiente',    -- pendiente/parcial/pagada/anulada
  issue_date         date not null default current_date,
  due_date           date not null,
  reference          text,
  shipment_id        uuid references public.shipments(id) on delete set null,
  journal_entry_id   uuid references public.journal_entries(id) on delete set null,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  unique (tenant_id, bill_code)
);
create index sb_tenant_supplier_idx on public.supplier_bills (tenant_id, supplier_id) where deleted_at is null;

create table public.supplier_payments (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  payment_code     text not null,                          -- OP-YYYY-NNNN
  bill_id          uuid not null references public.supplier_bills(id) on delete restrict,
  supplier_id      uuid not null references public.suppliers(id),
  supplier_name    text not null,
  amount           numeric(14,2) not null,
  currency         invoice_currency not null default 'USD',
  fx_rate          numeric(14,4),
  method           text not null default 'transferencia',
  cash_account_id  uuid not null references public.accounts(id),    -- CR en el pago
  reference        text,
  paid_at          date not null default current_date,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  notes            text,
  created_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  unique (tenant_id, payment_code)
);
create index sp_tenant_bill_idx on public.supplier_payments (tenant_id, bill_id) where deleted_at is null;

-- next_supplier_code PRV-NNNN · next_bill_code CXP-YYYY-NNNN · next_payment_order_code OP-YYYY-NNNN
-- + RLS por tenant en las 3 + grants + journal_entries.bill_id / .supplier_payment_id (aditivo, nullable).
```
La **cola de CxP** se deriva por query de `supplier_bills` (`total_amount - paid_amount > 0` y status ≠
`anulada`), no es tabla nueva. El "stage" se deriva (vencida si `due_date<today` con saldo; por_vencer si
saldo y no vencida; parcial si `0 < paid < total`; pagada si saldo 0).

---

## 5. Decisiones de diseño

### 5.1 Espejo simétrico de Cobranzas (mismo patrón, lado pasivo)
Cobranzas: `payment_receipts` + asiento DR Caja / CR Clientes (`1.1.2`). Tesorería: `supplier_payments` +
asiento DR Proveedores (`2.1.1`) / CR Caja. Misma forma de cola, drawer, validación y `next_*_code`. Quien
conoce Cobranzas lee Tesorería sin fricción.

### 5.2 Dos asientos: causación (al crear la CxP) + pago (al pagar)
- **Crear CxP** → asiento de causación: **DR `expense_account_id`** (costo/gasto, ej. `5.1` Flete navieras,
  `5.2` Transporte terceros) / **CR `2.1.1`** Cuentas por pagar proveedores. `source='supplier_bill'`.
- **Registrar pago** → asiento del pago: **DR `2.1.1`** / **CR `cash_account_id`** (caja/banco postable).
  `source='supplier_payment'`. Cierra el saldo que la causación dejó en `2.1.1`.
- Ambos idempotentes por su origen, best-effort (si la contabilidad falla, la operación se registra igual;
  `journal_entry_id` se guarda en la fila). Si el CoA no está sembrado → se registra y el asiento queda
  best-effort (log `missing-account`).

### 5.3 Supplier-lite: entidad mínima, absorbe navieras/agentes vía `type`
`suppliers` no es el módulo de proveedores completo (Bloque 5) — es lo justo para atar la CxP a un payee
real y poder agrupar "cuánto le debo a X" y las remesas a China. El campo `type`
(`proveedor_cn/naviera/agente_aduanal/servicio/otro`) cubre los tipos de beneficiario del mockup sin
entidades separadas. Empieza a cerrar el hueco `Supplier` (❌→✅ lite) de `schema-reconciliation.md`.

### 5.4 USD funcional; VES/CNY/USDT con fx_rate (sin revaluación)
El asiento se hace en USD. Si la CxP/pago entra en VES/CNY/USDT se guarda `currency`+`fx_rate` y el monto
USD se deriva. Reusa el enum `invoice_currency` (`USD/VES/USDT/CNY`, ya existe). Sin motor de conversión ni
revaluación (futuro).

### 5.5 Sin aprobación en V1 (founder)
El mockup muestra "se envía a aprobación de Admin" y "aprobado por"; el founder decidió **diferir
multi-firma a Fase 2**. En V1 el pago es directo. El campo de aprobación se agrega cuando se construya el
workflow.

### 5.6 Anular revierte
`voidPayment` marca `deleted_at`, baja `paid_amount` de la CxP, recalcula status y **anula su asiento**.
`voidBill` solo permite anular CxP **sin pagos** (status `anulada` + anula su asiento de causación). No se
borran (auditable).

---

## 6. Criterios de aceptación

### Backend
- [ ] Migración `0087` aplica; `suppliers` + `supplier_bills` + `supplier_payments` con RLS + `tenant_id`
- [ ] `next_supplier_code()` → `PRV-0001`; `next_bill_code()` → `CXP-2026-0001`;
      `next_payment_order_code()` → `OP-2026-0001`; FKs `on delete restrict` en bill/payment
- [ ] `journal_entries.bill_id` / `.supplier_payment_id` existen (aditivo, nullable)

### Lib
- [ ] `buildPayablesQueue` lista solo CxP con saldo > 0 y status ≠ anulada, con aging y stage correctos
- [ ] `validatePaymentInput` rechaza amount ≤ 0, amount > saldo, y cuenta de caja faltante
- [ ] `validateBillInput` rechaza total ≤ 0, proveedor/cuenta de gasto/vencimiento faltantes
- [ ] `postBillJournalEntry` arma DR gasto / CR `2.1.1` balanceado, idempotente por bill
- [ ] `postSupplierPaymentJournalEntry` arma DR `2.1.1` / CR caja balanceado, idempotente por payment

### UI / flujo E2E
- [ ] `/studio/tesoreria` existe (sidebar, grupo FINANZAS), KPI strip + 3 tabs (CxP/Pagos/Proveedores)
- [ ] Alta de proveedor (PRV-NNNN) con tipo/país/canal de pago
- [ ] "Nueva CxP" crea la cuenta por pagar y genera su asiento de causación (visible en Libro diario)
- [ ] "Registrar pago" (desde la cola): elige cuenta de caja + método → baja el saldo, mueve status a
      parcial/pagada, crea la orden de pago `OP-`
- [ ] El pago **genera su asiento** (DR `2.1.1` / CR caja), visible en Contabilidad
- [ ] Anular orden de pago revierte saldo + anula su asiento; anular CxP sin pagos la marca anulada
- [ ] Remesa a China (método `usdt`/`remesa_china`, moneda CNY/USDT) se registra con fx_rate
- [ ] light + dark; cero hex; pasó ui-ux-designer

### Sistema
- [ ] `node scripts/verify.mjs` verde · frontera público↔ERP intacta

---

## 7. Out of scope / open questions
- **¿Una orden de pago puede saldar varias CxP?** No en el MVP — una orden por CxP. Pago consolidado = futuro.
- **¿Pago sin CxP (anticipo / gasto directo)?** No — la orden requiere `bill_id`. Anticipos (`1.1.4`) = futuro.
  (Para gastos operativos directos ya existe el módulo Gastos, SDD-0039.)
- **¿De qué cuenta de gasto por defecto?** El usuario elige la cuenta de costo/gasto al crear la CxP (sin default).
- **¿Saldo de las cuentas de caja en vivo?** No en V1 (tab "Cuentas" + posición multi-moneda = Fase 2). El
  pago solo elige entre cuentas postables tipo banco/caja.

## Diseño
`docs/design/studio/_norte/erp/modules/tesoreria.jsx` + `tesoreria-data.jsx` (v1.2) — Dashboard, CxP,
Pagos & remesas, Cuentas. **V1 construye un subconjunto:** KPI strip + cola CxP + Pagos + Proveedores
(se difieren el Dashboard de proyección de caja, la posición multi-moneda por cuenta y la conciliación).
Modelo: la CxP/pago se apoyan en `accounts`/`journal_entries` (SDD-0040); espejo de
`lib/studio/accounting/{invoice-posting,receipt-posting}.ts`. Cuenta de control CxP: `2.1.1` (del CoA
sembrado en SDD-0040). Cuentas de costo típicas: `5.1` Flete navieras, `5.2` Transporte terceros.

---

## Notas de implementación (2026-06-03)

> Implementado por el harness `/feature` (implement → verify → review). Review **APPROVED** en una ronda,
> 8 checkpoints en `[x]`, gate verde (`.harness/progress/review_0044-tesoreria.md`). Detalle de la
> implementación en `.harness/progress/impl_0044-tesoreria.md`.

### Número real de migración
- **`supabase/migrations/0088_tesoreria.sql`** (no `0087`, como decía la spec en §2/§4/§6). El slot `0087`
  ya estaba tomado por **`0087_portal_approval.sql` (SDD-0042 Fase 5)**, que corrió entre la aprobación de
  esta spec y su implementación. `0088` era el correlativo libre. La migración crea las 3 tablas
  (`suppliers`/`supplier_bills`/`supplier_payments`), los 3 RPCs, las columnas aditivas nullable
  `journal_entries.bill_id` + `.supplier_payment_id`, RLS por tenant + grants, el CHECK aditivo de
  `entity_audit_log` (+`supplier`/`supplier_bill`/`supplier_payment`) y los triggers `updated_at`.
  Reusa el enum `invoice_currency` (de 0077). Sin seed, sin DDL destructivo.

### Desviaciones respecto al spec original (sección 3)
- **`ENTRY_COLUMNS` + coerción** de las nuevas columnas del asiento (`bill_id`/`supplier_payment_id`) se
  editaron en **`lib/studio/journal-queries.ts`** (no en `journal-types.ts`, como anticipaba §3). En
  `journal-types.ts` solo viven `EntrySource` (+`supplier_bill`/`supplier_payment`), `entrySourceLabel`
  ("Causación CxP"/"Pago a proveedor") y el type `JournalEntry`. La coerción real (que puebla las columnas
  no-opcionales del type al leer del ledger) corresponde a `journal-queries.ts`.
- **Lógica IO compartida** de las acciones se factoró en un archivo extra no listado en §3:
  **`lib/studio/treasury/treasury-actions.ts`** (`createBillFor`, `voidBillFor`, `registerPaymentFor`,
  `voidPaymentFor`). El `actions.ts` del módulo (`"use server"`) queda fino y delega ahí.
- **Postings** además de `postBillJournalEntry` / `postSupplierPaymentJournalEntry` exponen helpers puros
  (`buildBillLines`/`billAmountUsd`, `buildSupplierPaymentLines`/`paymentAmountUsd`) y sus
  reversas (`voidBillJournalEntry`/`voidSupplierPaymentJournalEntry`) para la anulación. Idempotentes por
  `bill_id` / `supplier_payment_id`, best-effort (si el CoA no está sembrado → la operación se registra y
  el asiento queda skip con log `missing-*`).
- **`shipment_id` en CxP** queda nullable y **sin selector de UI en V1** (para costing futuro, Bloque 5); el
  drawer solo muestra un aviso read-only si está seteado.
- Componentes reales: `app/studio/(app)/tesoreria/_components/{TesoreriaClient,BillDrawer,SupplierDrawer}.tsx`
  (KPI strip + 3 tabs + drawer CxP con "Registrar pago" + historial + anular + alta/edición de proveedor).

### Cobertura de tests
- **56 casos** en `lib/studio/treasury/__tests__/treasury.test.ts` (suite total del repo: 362 verde).
  Cubren: aging/stage, `buildPayablesQueue` (excluye pagadas/anuladas, ordena por días vencido),
  `computeTreasuryKpis`, `validateBillInput`/`validatePaymentInput`/`validateSupplierInput`,
  `buildBillLines` + `buildSupplierPaymentLines` (asientos balanceados Σdebe=Σhaber, DR gasto/CR `2.1.1` y
  DR `2.1.1`/CR caja), `billAmountUsd`/`paymentAmountUsd` (multi-moneda vía `fx_rate`), `isExpenseAccount`,
  `isChinaRemittance` y los formatos de código `PRV-`/`CXP-`/`OP-`. Idempotencia y anulación quedan
  cubiertas por construcción (las partes con DB son best-effort idempotentes por origen).

### Pendientes antes del commit (del founder)
- **Migración `0088_tesoreria.sql` NO aplicada a prod** — la aplica el founder.
- **Pasada por `ui-ux-designer` pendiente** antes del commit (regla del founder; no bloqueó el APPROVED).
