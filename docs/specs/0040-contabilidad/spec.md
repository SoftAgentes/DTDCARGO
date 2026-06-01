---
sdd: "0040"
title: "Contabilidad — plan de cuentas + diario/mayor + P&L/Balance + asiento automático (Bloque 1.2)"
status: done
author: "founder"
created: 2026-06-01
updated: 2026-06-01
supersedes: null
superseded_by: null
related: ["0021", "0011", "0010"]
confidencialidad: interno
---

# DTD-0040 — Contabilidad

> **Bloque 1.2 financiero.** Cierra el núcleo contable: plan de cuentas jerárquico, libro
> diario (doble partida), libro mayor, y reportes P&L + Balance. **Activa el asiento automático
> desde factura** — cierra el gancho `// TODO(SDD-contabilidad)` que dejó SDD-0021. Construye
> 3 de las 4 entidades faltantes del blueprint (Account + JournalEntry + JournalLine).
> Estilo QuickBooks, libros en USD (moneda funcional).

---

## 1. Resumen en una línea

Plan de cuentas (`accounts`, árbol padre→hijo, sembrado con un CoA estándar de transporte/freight
editable) + asientos de doble partida (`journal_entries` + `journal_lines`, debe = haber) con
state machine borrador → asentado · anulado, libro mayor por cuenta, P&L y Balance computados de
los saldos, y **asiento automático al emitir una factura** (debe Clientes / haber Ingresos [+ IVA]).

---

## 2. Scope

### Incluye

#### Backend (Supabase)
- Migration `00NN_contabilidad.sql` (siguiente correlativo libre, ~`0078`):
  - Enums `acct_type` (`A / P / PT / I / CGS / G`) y `entry_status` (`borrador / asentado / anulado`)
  - Tabla `public.accounts`: id, tenant_id, code (unique por tenant), name, type, parent_id
    (self-ref nullable, `on delete cascade`), qbo_type (text, referencia), is_postable (bool;
    true = hoja donde se asienta), notes, created_at, updated_at. La jerarquía también es derivable
    del `code` (parent = code sin el último segmento) — usar eso para sembrar el `parent_id`.
  - Tabla `public.journal_entries`: id, tenant_id, entry_code (unique por tenant, `A-YYYY-NNNN`),
    entry_date (date), memo, status, source (`manual` | `invoice`), invoice_id (FK opcional a
    invoices, `on delete set null`), posted_at, timestamps, deleted_at
  - Tabla `public.journal_lines`: id, entry_id (FK `on delete cascade`), account_id (FK a accounts),
    debit numeric(14,2) default 0, credit numeric(14,2) default 0, line_memo. Índices `(entry_id)`,
    `(account_id)`. CHECK: una línea tiene debe XOR haber (no ambos > 0).
  - Función `public.next_entry_code(p_tenant_id)` → `A-YYYY-NNNN` (mismo patrón que `next_invoice_code`)
  - **Seed del plan de cuentas** desde `docs/specs/0040-contabilidad/assets/chart-of-accounts.md`
    (84 cuentas, genérico, SIN datos reales) para el tenant DTD (`where slug='dtd'`), idempotente
    (`on conflict (tenant_id, code) do nothing`). Resolver `parent_id` por prefijo de `code`.
  - RLS por tenant (`get_user_tenant_id()`) en las 3 tablas + grants + triggers `touch_updated_at`
- **Edita `supabase` NADA en prod por el harness** (la aplica el founder).

#### Lib
- `lib/studio/account-types.ts`: `Account`, `AcctType`, `ACCT_TYPE_LABEL`, `normalSide(type)`
  (A/CGS/G = debe-normal; P/PT/I = haber-normal), `buildAccountTree(accounts)` (anida por code/parent),
  `validateAccountInput`.
- `lib/studio/account-queries.ts`: `listAccounts(supabase)`, `accountBalances(supabase)` →
  por cuenta `{ debit, credit, balance }` (solo de asientos `asentado`), con **rollup a los padres**.
- `lib/studio/journal-types.ts`: `JournalEntry`, `JournalLine`, `EntryStatus`, `JournalEntryInput`,
  `entryTotals(lines)` → `{ debit, credit, balanced }`, `validateEntryInput` (líneas ≥2, balanceado, cuentas postables).
- `lib/studio/journal-queries.ts`: `listEntries(supabase, filters)`, `getEntryByCode`,
  `ledgerForAccount(supabase, accountId)` → líneas con saldo corrido (mayor).
- `lib/studio/accounting/reports.ts`: `profitAndLoss(balances)` → `{ income, cogs, grossProfit,
  expenses, netIncome }`; `balanceSheet(balances)` → `{ assets, liabilities, equity, netIncome, ok }`
  (ok = activo = pasivo + patrimonio + resultado). Funciones puras sobre los saldos.

#### Pages + actions (módulo NUEVO — no existe `contabilidad/` todavía)
- `app/studio/(app)/contabilidad/page.tsx` (server) + registrar el ítem en el sidebar del Studio
  (mirar cómo se registran los módulos en el shell/nav; agregar "Contabilidad" en el grupo Finanzas).
  Tabs: **Plan de cuentas** · **Libro diario** · **Libro mayor** · **Reportes**.
- `_components/`:
  - `ContabilidadClient.tsx` — orquesta tabs.
  - `PlanCuentasTab.tsx` — árbol del CoA (expand/collapse), badge de tipo, saldo por cuenta;
    "+ Cuenta" abre drawer (code, name, type, parent, postable).
  - `LibroDiarioTab.tsx` — lista de asientos + "Nuevo asiento" (drawer con editor de líneas:
    cuenta + debe/haber, valida balanceado en vivo, total debe/haber visible).
  - `LibroMayorTab.tsx` — selector de cuenta → movimientos con saldo corrido.
  - `ReportesTab.tsx` — P&L (Ingresos − CGS = bruto − Gastos = neto) y Balance (A = P + PT + resultado),
    en cards/tabla navy estilo del sistema; toggle de fecha (a hoy / rango simple).
- `contabilidad/actions.ts`:
  - `createJournalEntry(prev, formData)` — parsea líneas, valida balanceado (debe=haber, ≥2 líneas,
    cuentas postables), inserta entry `borrador` + líneas, code via rpc
  - `postEntry(id)` — `borrador → asentado` (requiere balanceado) + `posted_at`
  - `voidEntry(id)` — `asentado → anulado` (no borra; los saldos lo ignoran)
  - `createAccount` / `updateAccount` — gestionar el CoA (no permitir borrar cuenta con movimientos;
    no permitir asentar a cuenta no-postable)
  - `softDeleteEntry(id)` (solo si `borrador`)
  - Acciones sensibles → `entity_audit_log` (ampliar el CHECK con `journal_entry`/`account`, aditivo)

#### Asiento automático desde factura (cierra el gancho de 0021)
- Editar `app/studio/(app)/facturacion/actions.ts` → en `emitInvoice`, reemplazar el
  `// TODO(SDD-contabilidad)` por: crear un `journal_entry` (`source='invoice'`, `invoice_id`,
  `status='asentado'`) con líneas:
  - **debe** `1.1.2` Cuentas por cobrar clientes = `total_amount`
  - **haber** cuenta de ingreso por defecto (`4.5` Otros ingresos por servicios, postable) = `base_amount`
  - si `iva_amount > 0`: **haber** `2.1.5` IVA por pagar = `iva_amount`
  - memo: `Factura {invoice_code}`. Idempotente (no duplicar si ya hay entry para esa factura).
  - Usar el cliente admin (service_role) igual que las escrituras de audit. Si falla la contabilidad,
    NO romper la emisión (log + seguir) — la factura se emite igual; el asiento es consecuencia.

### NO incluye (queda para SDDs futuros)
- **Lock / cierre de período** — sin bloqueo de fechas. SDD futuro.
- **Tab Fiscal · SENIAT** (Libro de Ventas/Compras, retenciones, IVA) — **Bloque 3** (depende del toggle IVA).
- **Asiento automático del PAGO** (`registerPayment` → debe Banco / haber Clientes) — necesita elegir
  la cuenta de caja/banco; vive en **Cobranzas/Tesorería (Bloque 2)**. Acá `registerPayment` NO genera asiento.
- **Tabs Flujo de trabajo / Dashboard** del mockup, **Exportar libros**, **multi-moneda con
  revaluación**, **ajuste por inflación**, **conciliación bancaria**, **numeración fiscal**. SDDs futuros.
- **CoA fiscal venezolano (SENIAT/VEN-NIF)** — el seed es estándar gerencial estilo QBO, no fiscal VE.

---

## 3. Archivos a crear / editar

### Nuevos
```
docs/specs/0040-contabilidad/spec.md                       ← este
docs/specs/0040-contabilidad/assets/chart-of-accounts.md   ← seed del CoA (ya creado)
supabase/migrations/00NN_contabilidad.sql                  ← 3 tablas + enums + next_entry_code + seed CoA
lib/studio/account-types.ts                                ← Account + tree + normalSide
lib/studio/account-queries.ts                              ← listAccounts, accountBalances (rollup)
lib/studio/journal-types.ts                                ← JournalEntry + validación balanceado
lib/studio/journal-queries.ts                              ← listEntries, ledgerForAccount
lib/studio/accounting/reports.ts                           ← profitAndLoss, balanceSheet (puras)
app/studio/(app)/contabilidad/page.tsx                     ← módulo nuevo (4 tabs)
app/studio/(app)/contabilidad/actions.ts                   ← asientos + cuentas
app/studio/(app)/contabilidad/_components/*.tsx            ← Client + 4 tabs + drawers
```
### Editados
```
app/studio/(app)/facturacion/actions.ts                    ← emitInvoice: asiento automático (quita el TODO)
<shell/sidebar del Studio>                                  ← ítem "Contabilidad" en grupo Finanzas
docs/architecture/schema-reconciliation.md                 ← Account/JournalEntry/JournalLine ❌→✅ (al cerrar)
docs/architecture/module-sdd-map.md                        ← contabilidad → SDD-0040
```

---

## 4. Schema (esqueleto — el detalle fino se ajusta al implementar)

```sql
create type acct_type    as enum ('A','P','PT','I','CGS','G');
create type entry_status as enum ('borrador','asentado','anulado');

create table public.accounts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  code        text not null,
  name        text not null,
  type        acct_type not null,
  parent_id   uuid references public.accounts(id) on delete cascade,
  qbo_type    text,
  is_postable boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, code)
);
create index accounts_tenant_idx on public.accounts (tenant_id);
create index accounts_parent_idx on public.accounts (parent_id);

create table public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  entry_code text not null,
  entry_date date not null default current_date,
  memo       text,
  status     entry_status not null default 'borrador',
  source     text not null default 'manual',       -- 'manual' | 'invoice'
  invoice_id uuid references public.invoices(id) on delete set null,
  posted_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, entry_code)
);
create index je_tenant_status_idx on public.journal_entries (tenant_id, status) where deleted_at is null;

create table public.journal_lines (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  debit      numeric(14,2) not null default 0,
  credit     numeric(14,2) not null default 0,
  line_memo  text,
  check (not (debit > 0 and credit > 0))           -- debe XOR haber
);
create index jl_entry_idx on public.journal_lines (entry_id);
create index jl_account_idx on public.journal_lines (account_id);

-- next_entry_code: A-YYYY-NNNN (igual patrón que next_invoice_code / next_quote_code)
-- + RLS por tenant en las 3 tablas + grants + triggers touch_updated_at
-- + seed del CoA (assets/chart-of-accounts.md) para el tenant dtd, idempotente.
```
Balance de doble partida: **a nivel de acción** (`postEntry` exige `sum(debit)=sum(credit)` y >0).
`borrador` puede estar desbalanceado mientras se edita; solo `asentado` afecta saldos.

---

## 5. Decisiones de diseño

### 5.1 Plan de cuentas = seed genérico estilo QBO (transporte), editable
Sembrado de `assets/chart-of-accounts.md` (84 cuentas, 6 grupos A/P/PT/I/CGS/G, hasta 4 niveles).
**NO son datos reales** → puede ir commiteado. El usuario renombra/agrega/desactiva por la UI.
Caveat documentado: no mapea al CoA fiscal venezolano (SENIAT/VEN-NIF).

### 5.2 Saldos solo de asientos `asentado` + rollup al árbol
`accountBalances` suma debe/haber de líneas de entries `asentado` (ignora borrador y anulado),
calcula el saldo según el lado normal del tipo, y **acumula hacia los padres** (un grupo muestra la
suma de sus hojas). El P&L y el Balance leen estos saldos.

### 5.3 Anular, no borrar (asientos asentados)
`asentado` no se edita ni borra; se `anula` (status). Los saldos ignoran `anulado`. (Reverso contable
formal — un asiento espejo — es refinamiento futuro; por ahora el anulado simplemente no cuenta.)

### 5.4 Asiento automático: DR Clientes / CR Ingresos (+ IVA)
Al **emitir** factura (no al crearla en borrador). Cuenta de ingreso por defecto = `4.5` (postable);
mapear por tipo de servicio del embarque es refinamiento futuro. Si la contabilidad falla, la factura
se emite igual (el asiento es consecuencia, no bloquea la operación comercial). Idempotente por `invoice_id`.

### 5.5 Postable = hoja
Solo se asienta a cuentas `is_postable=true` (las hojas). Los grupos (`is_postable=false`) solo agregan.
La UI del drawer de asiento filtra a postables.

### 5.6 P&L y Balance básicos (no fiscales)
P&L = Ingresos − Costo de ventas = Utilidad bruta − Gastos = Utilidad neta. Balance = Activo vs
Pasivo + Patrimonio + Utilidad del ejercicio. Reportes gerenciales en USD; sin comparativos ni export
(eso es SDD Reportes 0023 / futuro).

---

## 6. Criterios de aceptación

### Backend
- [ ] Migración aplica sin errores; 3 tablas con RLS + `tenant_id`
- [ ] Seed: el tenant dtd queda con las 84 cuentas, jerarquía correcta (`parent_id` resuelto), idempotente
- [ ] `next_entry_code()` → `A-2026-0001` en el 1º del año
- [ ] CHECK debe-XOR-haber activo; FK `invoice_id` opcional `set null`

### Lib
- [ ] `entryTotals([{debit:100},{credit:100}])` → `{debit:100,credit:100,balanced:true}`
- [ ] `validateEntryInput` rechaza desbalanceado y cuentas no-postables
- [ ] `accountBalances` suma solo `asentado` y hace rollup a padres
- [ ] `profitAndLoss`/`balanceSheet` dan números coherentes sobre un set de prueba (balance cuadra)

### UI
- [ ] `/studio/contabilidad` existe, en el sidebar (grupo Finanzas), 4 tabs
- [ ] Plan de cuentas muestra el árbol sembrado; "+ Cuenta" agrega una hoja
- [ ] "Nuevo asiento": editor de líneas, total debe/haber en vivo, no deja asentar si no balancea
- [ ] Asentar mueve el saldo; el Libro mayor de una cuenta muestra el movimiento con saldo corrido
- [ ] Reportes: P&L y Balance reflejan los asientos asentados
- [ ] **Emitir una factura crea su asiento automático** (DR Clientes / CR Ingresos), visible en el diario
- [ ] light + dark; cero hex literales

### Sistema
- [ ] `node scripts/verify.mjs` verde (lint + typecheck + tests nuevos + docs:check)
- [ ] frontera público↔ERP intacta

---

## 7. Out of scope / open questions

- **¿Reverso contable formal al anular?** No — el anulado se ignora en saldos. Asiento espejo = futuro.
- **¿Mapear factura→cuenta de ingreso por servicio (LCL/FCL/DDP/terrestre)?** No en el MVP; default `4.5`.
  Cuando exista, el asiento automático elige la cuenta `4.1.x` según el servicio del embarque.
- **¿Multi-moneda en los libros?** Libros en USD. VES@BCV de referencia y revaluación = futuro.
- **¿Asiento del cobro?** No acá — va con Cobranzas/Tesorería (necesita la cuenta de caja/banco).
- **¿Validación contra el CoA fiscal VE?** No; el seed es gerencial estilo QBO. Lo fiscal es Bloque 3.

## 8. Notas de implementación (in-progress)

- **Migración:** `supabase/migrations/0078_contabilidad.sql` (el siguiente
  correlativo libre real era 0078, no 0077). Enums `acct_type`/`entry_status`,
  3 tablas con RLS + grants + triggers, `next_entry_code` y el seed de las 84
  cuentas para `slug='dtd'` (insert sin parent + `update` que resuelve
  `parent_id` por prefijo del code, idempotente `on conflict do nothing`).
  El CHECK de `entity_audit_log` se amplió aditivamente con `journal_entry` y
  `account`. **NO aplicada a prod** (la aplica el founder).
- **RLS de `journal_lines`:** la tabla no tiene `tenant_id` propio; la policy se
  ata al `entry_id` (su `journal_entry` debe pertenecer al tenant). Evita
  desnormalizar el tenant a la línea.
- **Asiento automático:** vive en `lib/studio/accounting/invoice-posting.ts`
  (`postInvoiceJournalEntry`, vía admin client, idempotente por `invoice_id`,
  best-effort). Se dispara desde `emitInvoice` **y** desde `createInvoice` con
  `emit_on_create=true` (ambos son puntos de emisión). Si la contabilidad falla,
  la factura se emite igual (log + seguir). Cuentas: DR `1.1.2` = total ·
  CR `4.5` = base · CR `2.1.5` = iva (si > 0). El asiento se valida cuadrado
  (total = base + iva) antes de insertar.
- **Saldos/reportes:** `computeBalances` (pura) hace el rollup por el árbol de
  codes; `accountBalances` filtra a asientos `asentado` (no borrador/anulado)
  antes de llamarla. `profitAndLoss`/`balanceSheet` leen el saldo de las cuentas
  raíz por tipo (ya agregadas por rollup). El balance cuadra en el set de prueba.
- **Sidebar:** ítem "Contabilidad" en el grupo FINANZAS (después de Facturación),
  id `accounting`, icono `calc`, sin `labelKey` (usa el `label` es-VE; i18n de la
  key queda para una pasada de traducción).
- **Tests:** `lib/studio/__tests__/{account-types,journal-types,account-balances,
  reports}.test.ts` (75 tests) cubren entryTotals/validateEntryInput,
  accountBalances con rollup, P&L/Balance que cuadra y el formato `A-YYYY-NNNN`.
- **Gate:** `node scripts/verify.mjs` VERDE (lint 0 errores · typecheck ·
  213 tests · docs:check).

## Diseño
`docs/design/studio/_norte/nuevo/modules/contabilidad.jsx` + `contabilidad-data.jsx` (v2.3) — tabs
Plan de cuentas / Libro diario / Libro mayor / Reportes (ignorar por ahora Flujo, Dashboard, Fiscal,
Config/lock). Modelo de datos: `_norte/backend/prisma/schema.prisma` → `Account` / `JournalEntry` /
`JournalLine` (v2.3). Plan de cuentas seed: `assets/chart-of-accounts.md`.
