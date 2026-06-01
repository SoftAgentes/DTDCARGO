---
sdd: "0021"
title: "Facturación — Invoice + estados + pago (Bloque 1.1 financiero)"
status: done
author: "founder"
created: 2026-06-01
updated: 2026-06-01
supersedes: null
superseded_by: null
related: ["0010", "0011", "0012"]
confidencialidad: interno
---

# DTD-0021 — Facturación

> **Arranque del Bloque 1 (núcleo financiero).** Primera de las entidades que
> faltan del blueprint Prisma (ver `docs/architecture/schema-reconciliation.md`).
> Reemplaza el placeholder EmptyState de `app/studio/(app)/facturacion/` por un
> módulo real: emitir factura `F-2026-NNNN`, registrar pagos que bajan el saldo,
> estados, y respeto del toggle IVA/SENIAT (OFF por defecto). El **asiento
> contable automático** y el **plan de cuentas** quedan para el SDD de
> Contabilidad (Bloque 1.2) — acá se deja el `gancho` listo (campo + evento),
> no la lógica contable.

---

## 1. Resumen en una línea

CRUD de facturas con cálculo de líneas (base + IVA cuando el toggle está ON),
código `F-2026-NNNN` server-side, state machine de 6 estados
(borrador → emitida → parcial/pagada · vencida visual · anulada), y
"Registrar pago" que incrementa `paid_amount` y recalcula el saldo/estado.

---

## 2. Scope

### Incluye

#### Backend (Supabase)
- Migration `00NN_invoices.sql` (siguiente correlativo libre — al implementar
  confirmar el número, ~`0077`):
  - Enum `invoice_status` (`borrador / emitida / parcial / pagada / vencida / anulada`)
  - Enum `invoice_currency` (`USD / VES / USDT / CNY`) — default `USD` (moneda funcional)
  - Tabla `public.invoices` con: id, tenant_id, invoice_code (unique por
    tenant), client_markbox, client_name (snapshot), shipment_id (FK opcional a
    shipments), shipment_code (snapshot textual), currency, fx_rate (BCV usado
    si la moneda es VES o para el asiento fiscal), base_amount, iva_amount,
    total_amount, iva_rate (snapshot, ej 16.00), status, issued_at, due_date,
    paid_amount, last_payment_at, lines (jsonb), notes, timestamps, deleted_at
  - Función `public.next_invoice_code(p_tenant_id)` formato `F-YYYY-NNNN`
    (padding 4, counter por año + tenant) — mismo patrón que `next_quote_code`
  - Índices: `(tenant_id, status)` y `(tenant_id, client_markbox)` (where deleted_at is null)
  - RLS por tenant (`get_user_tenant_id()`) + grants explícitos + trigger `touch_updated_at`
  - SIN seed (las facturas son data operativa, no demo)
  - **Toggle IVA:** columna `tenants.iva_enabled boolean not null default false`
    (en la misma migración, `alter table tenants add column …`). Es la fuente de
    verdad del flag fiscal; el front la lee al render. (Si al implementar se ve
    mejor reusar `feature_flags`, documentarlo — preferencia: columna en `tenants`
    por simplicidad y porque el blueprint lo modela así.)

#### Lib
- `lib/studio/invoice-types.ts`:
  - `Invoice`, `InvoiceStatus`, `InvoiceCurrency`, `InvoiceLine`, `InvoiceInput`
  - `INVOICE_STATUS_OPTIONS`, `statusLabel(s)`, `statusBadgeTone(s)`
    (`pagada→success · emitida→info · parcial→warning · vencida→danger ·
    borrador→neutral · anulada→neutral`)
  - `calcInvoiceTotals({ lines, ivaRate, ivaOn })` → `{ base, iva, total }`
    (función pura: suma `qty*unitPrice` de las líneas = base; si `ivaOn`,
    `iva = base * ivaRate/100`; `total = base + iva`. Con `ivaOn=false`,
    `iva=0`, `total=base`.)
  - `computeBalance(inv)` → `total_amount - paid_amount`
  - `isOverdue(inv)` → `due_date < today && status not in (pagada, anulada)`
  - `validateInvoiceInput(partial)` — manual, sin zod (patrón del repo)
- `lib/studio/invoice-queries.ts`:
  - `listInvoices(supabase, filters)` — `tab` (all/pending/overdue/paid),
    `q` (code/client_name/markbox), `client_markbox` específico
  - `getInvoiceByCode(supabase, code)`
  - `invoiceKpis(supabase)` — `{ billedYtd, outstanding, overdue }` agregados
    por tenant (alimenta las 3 KPI cards del header)

#### Pages + actions
- `app/studio/(app)/facturacion/page.tsx` (server) — **reemplaza el placeholder
  EmptyState**:
  - PageHeader: eyebrow + "Facturación." + subtítulo + "+ Nueva factura"
    (+ "Exportar" disabled placeholder)
  - 3 KPI cards: Facturado YTD · Por cobrar · Vencido (de `invoiceKpis`)
  - Tabs: Todas · Por cobrar · Vencidas · Pagadas (con counts)
  - Toolbar: search + ColumnManager (`dtd-inv-cols-v1`)
  - Tabla: Factura (`F-…` mono) · Cliente (name + MARKBOX, link a cliente) ·
    Embarque (link a tracking) · Emitida · Vence (rojo si vencida) · Total ·
    Saldo · Estado (badge dot). Click fila → `/studio/facturacion/[code]`
- `app/studio/(app)/facturacion/[code]/page.tsx` (server):
  - Header: code (mono grande) + cliente + status badge
  - Card TOTAL en navy (hero); si IVA ON, desglose Base / IVA 16% / Total
  - Grid: cliente, MARKBOX, embarque, moneda (+ fx_rate si aplica), emitida,
    vence, saldo, líneas (tabla simple desc/qty/precio/subtotal)
  - Botones contextuales según status:
    - `borrador` → Editar (drawer) · Emitir
    - `emitida / parcial / vencida` → **Registrar pago** · Anular
    - `pagada` → (solo lectura) · Duplicar (disabled) · PDF (disabled)
  - Link al embarque si `shipment_id`; "← Volver al listado"
- `_components/FacturacionClient.tsx`: orquesta lista + drawer
- `_components/InvoiceDrawer.tsx`: form + editor de líneas + total en vivo
  (con desglose IVA reactivo al toggle); cliente con lookup blando del MARKBOX
  (warning si no existe, no bloquea — patrón cotizador/shipments)
- `_components/InvoiceDetailClient.tsx`: wrapper client del detalle (drawer de
  edit + modal "Registrar pago" + confirmación de anular)
- `facturacion/actions.ts`:
  - `createInvoice(prev, formData)` — autogenera code via rpc → insert como
    `borrador` (o `emitida` si se marca "emitir al crear"); calcula base/iva/total
    server-side con `calcInvoiceTotals`
  - `updateInvoice(id, prev, formData)` — solo si status=`borrador`
  - `emitInvoice(id)` — `borrador → emitida` + `issued_at = today`,
    `due_date = today + 30d` (si no se setó)
  - `registerPayment(id, amount)` — `paid_amount += amount` (validar
    `0 < amount <= saldo`); recalcula status: `paid >= total → pagada`,
    `0 < paid < total → parcial`; setea `last_payment_at`
  - `voidInvoice(id)` — `→ anulada` (no permitido si ya `pagada`)
  - `softDeleteInvoice(id)`
  - Cada acción sensible escribe en `entity_audit_log` (patrón existente)

### NO incluye (queda para SDDs futuros)

- **Asiento contable automático** — al emitir/cobrar una factura el blueprint
  genera un asiento. Eso necesita `accounts` + `journal_entries/lines`, que **no
  existen todavía** → es el **SDD de Contabilidad (Bloque 1.2)**. Acá se deja el
  gancho: un evento/columna preparada, sin lógica contable. (Cuando exista
  Contabilidad, ese SDD wirea el asiento desde `emitInvoice`/`registerPayment`.)
- **Ledger de pagos / recibos** — por ahora se trackea `paid_amount` +
  `last_payment_at` (un acumulador). El historial de pagos (quién, cuándo, método,
  recibo) es del **SDD de Cobranzas (Bloque 2)**.
- **Capa fiscal SENIAT** — Libro de Ventas, retenciones, TXT/XML. Con IVA ON acá
  solo se discrimina base+IVA en la factura. La declaración es **SDD Fiscal (Bloque 3)**.
- **PDF export** y **envío de email real** — botones disabled con tooltip
  "Próximamente". (Email reusará el dominio mail_* cuando se wiree, SDD futuro.)
- **Multi-moneda con conversión** — se guarda `currency` + `fx_rate` como snapshot;
  no hay motor de conversión ni revaluación. USD es funcional.
- **Conciliación bancaria** — match extracto↔factura es trabajo aparte.
- **Auto-vencimiento (job)** — `vencida` se calcula visualmente
  (`due_date < today`), sin cron que cambie el status en BD (igual que quotes).
- **Numeración fiscal correlativa SENIAT** — `F-2026-NNNN` es el nº interno; el
  control fiscal SENIAT (si IVA ON) es del SDD Fiscal.

---

## 3. Archivos a crear / editar

### Nuevos
```
docs/specs/0021-facturacion/
└── spec.md                                          ← este

supabase/migrations/
└── 00NN_invoices.sql                                ← invoices + enums + next_invoice_code + tenants.iva_enabled

lib/studio/
├── invoice-types.ts                                 ← Invoice + calcInvoiceTotals + helpers
└── invoice-queries.ts                               ← listInvoices, getByCode, invoiceKpis

app/studio/(app)/facturacion/
├── page.tsx                                          ← reemplaza placeholder EmptyState
├── actions.ts                                        ← 6 actions
├── _components/
│   ├── FacturacionClient.tsx                         ← orquesta lista + drawer
│   ├── InvoiceDrawer.tsx                             ← form + líneas + total/IVA en vivo
│   └── InvoiceDetailClient.tsx                       ← wrapper detalle + modal pago
└── [code]/
    └── page.tsx                                      ← detalle con card total + acciones
```

### Editados
```
docs/architecture/schema-reconciliation.md           ← Invoice ❌ → ✅ (al cerrar)
docs/architecture/module-sdd-map.md                  ← facturacion → SDD-0021
```

---

## 4. Schema (esqueleto — el detalle fino se ajusta al implementar)

```sql
create type invoice_status   as enum ('borrador','emitida','parcial','pagada','vencida','anulada');
create type invoice_currency as enum ('USD','VES','USDT','CNY');

alter table public.tenants add column if not exists iva_enabled boolean not null default false;

create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  invoice_code    text not null,                       -- "F-2026-0001"
  client_markbox  text not null,                       -- lookup textual (blando)
  client_name     text not null,                       -- snapshot
  shipment_id     uuid references public.shipments(id) on delete set null,
  shipment_code   text,                                -- snapshot textual (DTDU-…)
  currency        invoice_currency not null default 'USD',
  fx_rate         numeric(14,4),                       -- BCV si VES / para asiento fiscal
  iva_rate        numeric(5,2) not null default 0,     -- snapshot (16.00 si IVA ON, 0 si OFF)
  base_amount     numeric(14,2) not null,              -- suma de líneas
  iva_amount      numeric(14,2) not null default 0,
  total_amount    numeric(14,2) not null,              -- base + iva
  status          invoice_status not null default 'borrador',
  issued_at       date,
  due_date        date,
  paid_amount     numeric(14,2) not null default 0,
  last_payment_at timestamptz,
  lines           jsonb not null default '[]',         -- [{ desc, qty, unitPrice }]
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  unique (tenant_id, invoice_code)
);

create index invoices_tenant_status_idx on public.invoices (tenant_id, status) where deleted_at is null;
create index invoices_tenant_client_idx on public.invoices (tenant_id, client_markbox) where deleted_at is null;

create or replace function public.next_invoice_code(p_tenant_id uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare
  v_year int := extract(year from current_date);
  v_max int;
begin
  select coalesce(max((regexp_match(invoice_code, '^F-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.invoices
  where tenant_id = p_tenant_id and invoice_code like 'F-' || v_year || '-%';
  return 'F-' || v_year || '-' || lpad(v_max::text, 4, '0');
end;
$$;

grant select, insert, update, delete on public.invoices to authenticated;
grant execute on function public.next_invoice_code(uuid) to authenticated;

alter table public.invoices enable row level security;
create policy "invoices by tenant" on public.invoices for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create trigger invoices_touch before update on public.invoices
  for each row execute function public.touch_updated_at();
```

---

## 5. Decisiones de diseño

### 5.1 client_name / shipment_code como snapshot
La factura es un documento histórico: guarda `client_name` y `shipment_code` al
momento. Si el cliente cambia razón social después, la factura vieja no cambia.

### 5.2 Lookup blando del cliente (no requiere)
MARKBOX no registrado → warning visual, no bloquea (patrón shipments/cotizador).

### 5.3 IVA como toggle de tenant (`tenants.iva_enabled`, OFF por defecto)
- **OFF (default):** `iva_rate=0`, sin desglose; el drawer y el detalle muestran
  un único `total`. `base_amount = total_amount`.
- **ON:** `iva_rate=16`, el drawer muestra Base / IVA 16% / Total; el detalle
  desglosa. `total = base * 1.16`.
- El front lee `iva_enabled` del tenant en el server component (no `localStorage`).
  Cambiar el flag NO recalcula facturas viejas (guardan su `iva_rate` snapshot).

### 5.4 Pago = acumulador, no ledger (por ahora)
`registerPayment` incrementa `paid_amount` y recalcula status. No hay tabla de
recibos todavía (eso es Cobranzas, Bloque 2). `last_payment_at` da un dato mínimo.
Validación: `0 < amount <= (total_amount - paid_amount)`.

### 5.5 State machine
| Desde | A | Acción |
|---|---|---|
| borrador | emitida | "Emitir" (setea issued_at + due_date) |
| borrador | (edit) | "Editar" (drawer) |
| emitida/parcial | parcial | "Registrar pago" (paid < total) |
| emitida/parcial/vencida | pagada | "Registrar pago" (paid >= total) |
| emitida/parcial/borrador | anulada | "Anular" (no si pagada) |
| any | (soft delete) | "Eliminar" |

`vencida` se deriva visualmente (`due_date < today` y status no pagada/anulada);
sin job que cambie el status real (igual que quotes en SDD-0011).

### 5.6 calcInvoiceTotals helper (puro)
Mismo criterio que `calcQuoteTotal`: función pura usada client-side (total en
vivo mientras el operador tipea líneas) y server-side (recálculo al persistir).
UI y BD muestran el mismo número.

### 5.7 Gancho contable, sin contabilidad
`emitInvoice` y `registerPayment` son los puntos donde el SDD de Contabilidad
enganchará el asiento automático. Acá NO se crea asiento (no hay `accounts` aún).
Se deja el TODO explícito en el código (`// TODO(SDD-contabilidad): asiento`).

### 5.8 Origen de la factura (cotización / embarque / manual)
Se puede crear factura: (a) manual, (b) desde un embarque (prefill client +
shipment + monto sugerido). El link cotización→factura (cuando una quote
aceptada factura) se menciona pero el botón "Facturar" desde el embarque/quote
es un plus; mínimo viable = crear manual + opción shipment_id en el drawer.

---

## 6. Criterios de aceptación

### Backend
- [ ] Migración aplica sin errores; `tenants.iva_enabled` default false
- [ ] `next_invoice_code()` → `F-2026-0001` en la 1ª del año, incrementa por tenant
- [ ] RLS: un tenant no ve facturas de otro
- [ ] FKs `shipment_id` opcional + `on delete set null`

### Lib
- [ ] `calcInvoiceTotals({lines:[{qty:2,unitPrice:500}], ivaRate:16, ivaOn:true})`
      → `{base:1000, iva:160, total:1160}`
- [ ] mismo input con `ivaOn:false` → `{base:1000, iva:0, total:1000}`
- [ ] `listInvoices({tab:'overdue'})` filtra vencidas; `invoiceKpis` agrega bien

### UI
- [ ] `/studio/facturacion` muestra lista (o empty state + CTA) — placeholder reemplazado
- [ ] "+ Nueva factura" abre drawer; editor de líneas suma el total en vivo
- [ ] Con IVA ON, el drawer y el detalle muestran Base / IVA / Total; con OFF, solo Total
- [ ] Crear → factura `borrador`, redirect al detalle
- [ ] "Emitir" pasa a `emitida` con issued_at + due_date
- [ ] "Registrar pago" baja el saldo y mueve a `parcial`/`pagada`
- [ ] Vencida se muestra en rojo si `due_date < today`
- [ ] Sidebar marca "Facturación" active; light + dark OK; cero hex literales

### Sistema
- [ ] `pnpm typecheck` pasa · `node scripts/verify.mjs` verde
- [ ] frontera público↔ERP intacta (ESLint)

---

## 7. Out of scope / open questions

- **¿La factura nace de una cotización aceptada?** El flujo cotizador (0011) tiene
  "Convertir a embarque". Facturar desde quote/embarque es deseable pero el MVP es
  crear factura (manual o con shipment_id). El botón "Facturar" en el detalle de
  embarque/quote = plus si entra; si no, SDD futuro de cross-links.
- **¿Numeración fiscal SENIAT separada de `F-NNNN`?** Sí, cuando IVA ON el control
  fiscal correlativo lo maneja el SDD Fiscal. `F-NNNN` es interno.
- **¿Nota de crédito / débito?** No en este SDD. Anular = `anulada`. NC/ND es SDD futuro.
- **¿Moneda de la línea distinta a la factura?** No. Una moneda por factura.
- **¿Quién puede emitir/anular?** Por ahora cualquier rol con acceso al módulo
  (matriz de permisos por rol es transversal, SDD aparte). Anular debería ser
  admin/contabilidad — anotarlo como TODO.

## Diseño
`docs/design/studio/_norte/erp/modules/invoices.jsx` (v2.3) — KPIs, tabs, tabla,
drawer, desglose IVA reactivo a `DTDConfig('iva')`. Modelo de datos:
`docs/design/studio/_norte/backend/prisma/schema.prisma` → `model Invoice` (v2.3).

---

## 8. Notas de implementación (spec-anchored, 2026-06-01)

Descubrimientos al implementar — fijan decisiones que el spec dejaba abiertas:

- **Correlativo de migración:** el siguiente libre era **`0077`** (último real:
  `0076_mail_event_consolidated_cn.sql`), no `0077` por asunción sino verificado
  listando `supabase/migrations/`. Archivo: `0077_invoices.sql`.
- **Audit log (`entity_audit_log`):** la tabla (0066) tiene un **CHECK** sobre
  `entity_type` que NO incluía `'invoice'`, y su INSERT está concedido **solo a
  `service_role`** (authenticated tiene únicamente SELECT). Por eso:
  1. la migración 0077 **amplía el CHECK** para sumar `'invoice'` (drop+add idempotente);
  2. las acciones sensibles (`emitInvoice`, `registerPayment`, `voidInvoice`,
     y create con "emitir") escriben el audit con `actor_type='user'` vía
     `createAdminClient()` (service_role), best-effort (no bloquea la mutación).
- **Toggle IVA:** implementado como columna **`tenants.iva_enabled`** (no
  `feature_flags`), como prefería el spec §2. El server (page + actions) la lee;
  el drawer/detalle reaccionan al flag. Cambiar el flag NO recalcula facturas
  viejas (guardan su `iva_rate` snapshot).
- **Resolución de tenant:** patrón real del repo (`user_tenants` →
  `.maybeSingle()`), igual que Cotizador — no `JWT.tenantId` del blueprint.
- **`tab` (all/pending/overdue/paid):** se resuelve **in-memory** (`filterByTab`)
  porque `pending`/`overdue` dependen de `due_date < today` y de `balance>0`, que
  no son columnas directas. `vencida` es derivada visual (`displayStatus`), sin job.
- **Tokens sobre navy:** el mockup v2.3 usa `rgba(255,255,255,X)` literal en la
  card navy; acá se usan `--ink-inv` / `--ink-inv-soft` / `--ink-inv-mute`
  (CHECKPOINTS C5 · cero rgba inline).
- **Origen de la factura:** MVP = manual + `shipment_code` opcional con lookup
  blando (`lookupShipmentForInvoice`) que prefilla cliente. El botón "Facturar"
  desde embarque/quote queda como plus (SDD futuro de cross-links).
- **Fuera de alcance respetado:** sin asiento contable (solo
  `// TODO(SDD-contabilidad)` en emit/pago), sin ledger de pagos (`paid_amount`
  acumulador + `last_payment_at`), sin PDF/email (botones disabled), sin SENIAT.
- **Tests:** `lib/studio/__tests__/invoice-{types,queries}.test.ts` (44 casos)
  cubren `calcInvoiceTotals` IVA on/off, `computeBalance`/`isOverdue`,
  `validateInvoiceInput`, guards de state-machine, `filterByTab`/`tabCounts`,
  `invoiceKpis` (con stub de Supabase) y el contrato de formato `F-YYYY-NNNN`.
