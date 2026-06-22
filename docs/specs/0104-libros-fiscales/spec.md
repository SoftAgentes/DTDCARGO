---
sdd: "0104"
title: "Libros fiscales persistidos — asentar Libro de Ventas / Compras (snapshot inmutable) + Retenciones (comprobantes emitidos)"
status: in-progress
author: "Claude Code (lane sdd-0104-libros-fiscales · Norte hueco #2)"
created: 2026-06-22
updated: 2026-06-22
supersedes: null
superseded_by: null
related: ["0073", "0080", "0085", "0044", "0021", "0102", "0006", "0052"]
confidencialidad: interno
---

# DTD-0104 — Libros fiscales persistidos

> **Hueco #2 del Norte.** SDD-0073 entregó la **configuración fiscal** (`fiscal_settings`) y los
> Libros de IVA como **clasificación on-the-fly** (preview vivo sobre `invoices`/`supplier_bills`).
> Lo que falta — y lo que entrega este SDD — es **persistir los movimientos**: convertir el preview
> en un **registro oficial inmutable** (los libros que SENIAT exige respaldar) y crear las
> **Retenciones** como tabla transaccional (hoy no existen en ninguna parte del ERP).

> ⚠️ **No es asesoría fiscal.** Igual que SDD-0073: el software fija el **andamiaje configurable**;
> los **valores** (¿exento o gravado?, %, columnas) los define el contador en `fiscal_settings`.
> Este SDD **no introduce ninguna regla fiscal nueva hardcodeada** — la clasificación sigue saliendo
> 100% de la config vía los helpers de SDD-0073.

## 1. Resumen en una línea

Extiende `/studio/fiscal` con **asentar período** (congela un snapshot inmutable del Libro de Ventas
y del Libro de Compras en tablas append-only) y una **3ª sub-pestaña Retenciones** (comprobantes de
retención de IVA/ISLR que DTD emite como agente, tabla propia con CRUD admin/accounting), sobre
**2 migraciones: `0165` (libros asentados) + `0166` (retenciones)**.

## 2. Por qué (grounding)

- **El hueco real (no cosmético):** hoy el Libro de Ventas/Compras se **recomputa en cada request**
  leyendo `invoices`/`supplier_bills` (SDD-0073, `salesBook()`/`purchaseBook()`). Eso significa que
  **si editas o anulas una factura de un mes ya declarado, el libro de ese mes cambia
  retroactivamente** — un libro fiscal oficial **no puede mutar** después de presentado. SENIAT exige
  libros cronológicos **respaldados** (el blueprint del Norte lista "Libros de compra/venta ·
  Respaldados" como obligación cumplida). Persistir = **congelar** el período (snapshot inmutable).
- **SDD-0073 ya dejó esto como su V2** (spec 0073 §6): *"Declaración mensual / cierre de período →
  V2 (puede necesitar tabla de cierres)"* y *"Comprobantes de Retención de IVA → V2 (tablas)"*. Este
  SDD ejecuta exactamente esa V2 de **libros** (la Declaración IVA persistida + puente contable es un
  SDD aparte — ver §6).
- **Retenciones = dato genuinamente nuevo.** El blueprint `fiscal.jsx`/`fiscal-data.jsx` muestra a DTD
  emitiendo comprobantes de retención (IVA 75% sobre el IVA de compras + ISLR honorarios). Hoy **no
  hay tabla** — los libros de SDD-0073 dejaron la columna `retention` *preparada pero vacía* (`—`,
  V2). Acá nace la tabla.
- **Reuso, cero duplicación:** el asentado **consume** la clasificación de SDD-0073 (`toSalesRow`/
  `toPurchaseRow`/`salesTotals`/`purchaseTotals`) — la lógica de "gravada/exenta/tasa cero según el
  `iva_mode` de cada factura" vive en **un solo lugar** (`lib/studio/fiscal/types.ts`). Replicarla en
  SQL sería un bug fiscal silencioso esperando a divergir → **se clasifica en TS, se persiste el
  resultado**.

## 3. Decisiones ancladas

1. **Persistir = ASENTAR (snapshot), no movimientos en vivo.** El preview vivo de SDD-0073 se
   mantiene; se agrega "Asentar período" que **congela** las filas computadas en tablas append-only.
   Asentado ⇒ el libro de ese período ya no depende de `invoices`/`supplier_bills` (inmune a ediciones
   retroactivas). No se tocan las tablas de facturación ni de compras (bajo acoplamiento).
2. **Cero reglas fiscales hardcodeadas (heredado de 0073 #1/#3).** La clasificación al asentar sale de
   `fiscal_settings` + el `iva_mode` de cada factura, vía los helpers existentes. **Transporte de
   carga = exento** es un **default editable** (`default_invoice_iva_mode = sin_iva` hoy), no un valor
   en código. Este SDD **no agrega** ningún `if servicio == transporte` ni alícuota literal.
3. **Append-only / inmutable de verdad, en la DB (no solo en la action).** Las filas asentadas
   (`fiscal_book_entries`) **nunca** se editan ni borran (trigger `BEFORE UPDATE OR DELETE → raise`).
   La cabecera (`fiscal_books`) solo admite la transición `asentado → anulado`. Corregir un período =
   **anular** el asiento (queda en historial) y **re-asentar** (nueva fila vigente).
4. **Idempotencia en la DB por índice único parcial** (patrón ⭐ SDD-0102): `unique (tenant_id,
   period, book_type) where status = 'asentado'` → no puede existir más de **un** libro vigente por
   período+tipo; PostgREST/carrera de doble-submit revienta `23505`, la action lo traduce a "ya
   asentado". El historial de anulados se conserva.
5. **Gate de poderes EN LA DB** (patrón ⭐ SDD-0102 — *PostgREST evade la action*). Asentar/anular un
   libro y crear/anular una retención exige rol **`accounting` o `admin`** del tenant, verificado
   contra `user_tenants` (rol + `disabled_at is null`, atado al tenant) **dentro de la DB** (RLS
   `with check` + el `exists` del cuerpo de la RPC), no solo en la action.
   Consistente con RBAC `fiscal: ["accounting"]` (SDD-0085) y la separación de poderes (DINERO =
   accounting + admin).
6. **Atomicidad del asentado vía RPC `security definer`.** Insertar cabecera + N líneas debe ser
   atómico (una cabecera sin líneas o líneas huérfanas serían un libro corrupto). PostgREST no hace
   multi-tabla atómico → una RPC `fiscal_post_book(...)` lo envuelve en una transacción, valida
   rol+tenant adentro (atado a `user_tenants` con `disabled_at`, no a `current_studio_role()`) y
   **recalcula los totales de la cabecera desde las líneas recibidas** (la cabecera nunca confía en
   totales sueltos del caller). `revoke execute from public, anon`.
   **Modelo de confianza (V1):** las LÍNEAS (base/iva/clasificación) las computa la server action
   desde `invoices`/`supplier_bills` + la config (helpers de 0073) y se pasan a la RPC; la RPC **no
   re-deriva la clasificación en SQL** — hacerlo duplicaría la lógica de 0073 y arriesgaría
   divergencia silenciosa (un bug fiscal peor que el que evita). Por eso el asentado refleja lo que el
   **sistema computó** al asentar, bajo responsabilidad de `accounting`/`admin`; **no** es una
   verificación independiente contra las facturas (eso es V2 — §6). Mismo modelo que cualquier asiento
   contable del equipo (0079/0157).
7. **Retenciones con nº de comprobante CAPTURADO, no auto-generado** (cero-fabricar, regla 0052 §3.2).
   El comprobante de retención de IVA venezolano lo numera el agente en el portal SENIAT (formato
   `AAAAMM`+secuencia). En V1 el usuario **ingresa** el nº del comprobante real emitido — el ERP no
   inventa correlativos fiscales. Unicidad por índice único parcial sobre el comprobante vigente.
8. **text + CHECK para todos los enums** (no tipos enum nativos) — patrón del repo, evita el landmine
   de cast enum↔text en backfills ([[feedback_migration_enum_text_cast]]).
9. **Toca DB → los 2 skills Supabase invocados ANTES del SQL** (seguridad + postgres-best-practices) —
   hecho en esta lane. RLS por tenant, GRANTS explícitos (auto-expose OFF), índices en FK + columnas
   de RLS, `numeric(14,2)` para montos, `(select get_user_tenant_id())` en policies (cacheado).

## 4. Approach

Dos slices, una migración cada uno. El módulo `/studio/fiscal` y su entrada en `modules.ts` **ya
existen** (no se toca el registro de módulos ni el RBAC).

### 4.1 Slice A — Asentar Libro de Ventas / Compras (migración `0165`)

**Tablas (`text`+`check`, RLS por tenant, GRANTS explícitos):**

`fiscal_books` — cabecera del asiento de un libro-período:
```
id              uuid pk default gen_random_uuid()
tenant_id       uuid not null references tenants(id) on delete cascade
period          text not null            check (period ~ '^\d{4}-(0[1-9]|1[0-2])$')
book_type       text not null            check (book_type in ('ventas','compras'))
status          text not null default 'asentado'  check (status in ('asentado','anulado'))
-- totales congelados (recalculados desde las líneas por la RPC)
total_base          numeric(14,2) not null default 0
total_iva           numeric(14,2) not null default 0
total_total         numeric(14,2) not null default 0
total_base_exenta   numeric(14,2) not null default 0
total_base_gravada  numeric(14,2) not null default 0
total_base_tasa_cero numeric(14,2) not null default 0
row_count       integer not null default 0
currencies      text[]  not null default '{}'   -- monedas presentes (nota de mezcla)
default_iva_mode text                          -- snapshot del default vigente al asentar (traza)
posted_at       timestamptz not null default now()
posted_by       uuid references auth.users(id) on delete set null
voided_at       timestamptz
voided_by       uuid references auth.users(id) on delete set null
void_reason     text
created_at      timestamptz not null default now()
```
- Idempotencia: `create unique index fiscal_books_one_live on fiscal_books (tenant_id, period, book_type) where status = 'asentado';`
- Índices: `(tenant_id, book_type, period)` para el listado; `(tenant_id, status)`.

`fiscal_book_entries` — líneas congeladas (append-only, inmutables):
```
id              uuid pk default gen_random_uuid()
book_id         uuid not null references fiscal_books(id) on delete cascade
tenant_id       uuid not null references tenants(id) on delete cascade  -- denormalizado para RLS simple
line_no         integer not null
op_date         date
document_number text            -- factura (ventas) / documento del proveedor (compras)
control_number  text            -- nº de control fiscal (— si sin fuente, V1)
rif             text
party_name      text            -- cliente (ventas) / proveedor (compras)
iva_class       text check (iva_class in ('gravada','exenta','tasa_cero'))
base            numeric(14,2)
rate            numeric(6,3)
iva             numeric(14,2)
total           numeric(14,2)
retention       numeric(14,2)   -- columna preparada (— en V1)
currency        text
source_type     text check (source_type in ('invoice','bill'))
source_ref      text            -- invoice_code / bill_code (traza, no FK: el snapshot sobrevive borrados)
created_at      timestamptz not null default now()
```
- Índice FK: `(book_id, line_no)`; `(tenant_id)`.

**Seguridad / inmutabilidad (en la DB):**
- RLS ambas tablas: `SELECT` a `authenticated` del tenant; `INSERT/UPDATE/DELETE` restringidos (ver
  triggers + RPC). `service_role` all.
- Gate de rol: `exists` a `user_tenants` (rol ∈ `accounting`/`admin` + `disabled_at is null`, atado al
  tenant) — mismo predicado en las RLS y en el cuerpo de la RPC. NO `current_studio_role()`: ese hace
  `limit 1` sin atar el tenant ni filtrar `disabled_at` (cierra deshabilitado + split-role).
- Trigger `fiscal_book_entries` `BEFORE UPDATE OR DELETE` → `raise exception` SIEMPRE (append-only
  puro; el `on delete cascade` de la cabecera no aplica porque la cabecera **nunca se borra**).
- Trigger `fiscal_books` `BEFORE UPDATE`: solo permite `asentado→anulado` (+ setear `voided_*`); todo
  otro cambio de columnas → `raise`. `BEFORE DELETE` → `raise` (solo se anula).
- Trigger de coherencia de tenant en `fiscal_book_entries` (el `book_id` es del mismo `tenant_id`).

**RPC atómica `fiscal_post_book` (`security definer`, `search_path = public`):**
```
fiscal_post_book(p_period text, p_book_type text, p_entries jsonb, p_default_iva_mode text)
  returns uuid   -- book_id
```
- Resuelve `v_tenant := get_user_tenant_id()`; exige `exists` en `user_tenants` (rol accounting/admin
  + `disabled_at is null` + `tenant_id = v_tenant`) → si no, `raise 42501`.
- Inserta la cabecera (status `asentado`) + las líneas desde `jsonb_to_recordset(p_entries)`,
  numerando `line_no`, en una transacción. **Recalcula** `total_*`/`row_count`/`currencies` desde las
  líneas insertadas (no confía en totales del caller).
- El índice único parcial garantiza idempotencia (segundo asiento vigente → `23505`).
- `revoke execute from public, anon; grant execute to authenticated;`
- *(Anular* no necesita RPC: es un `update fiscal_books set status='anulado', voided_* ...` que la RLS
  + el trigger ya gatean; la action lo hace con el cliente del usuario.)*

**Capa TS (`lib/studio/fiscal/`):**
- `books-types.ts` (puro, server-safe): `PostedBook`, `PostedBookEntry`, `PostedBookStatus`; helper
  `salesRowToEntry`/`purchaseRowToEntry` (mapea el `SalesBookRow`/`PurchaseBookRow` de 0073 → payload
  de línea), validadores de `period`/`book_type`.
- `books-queries.ts`: `getPostedBook(supabase, period, bookType)` (cabecera vigente + líneas, ordenado
  por `line_no`); `listPostedBooks(supabase, bookType)` (historial por período).
- Extiende `actions.ts`:
  - `postFiscalBookAction(period, bookType)`: gate `canEditModule(role,"fiscal")` + módulo ON →
    `salesBook()/purchaseBook()` (clasifica) → arma `p_entries` → `rpc('fiscal_post_book', …)`.
    Traduce `23505` a "Este período ya está asentado".
  - `voidFiscalBookAction(bookId, reason)`: gate accounting/admin → update status anulado.

**UI (`FiscalClient.tsx`, sub-pestañas Ventas/Compras existentes):**
- Si el período **no está asentado** → preview vivo (como hoy) + botón **"Asentar período"**
  (accounting/admin, módulo ON) con confirmación.
- Si **está asentado** → muestra las filas **del snapshot** (no el vivo) + badge `Asentado · {fecha}`
  + (si el vivo difiere del snapshot, aviso "hay cambios desde el asiento; anula y re-asienta para
  actualizar") + botón **"Anular asiento"** (accounting/admin). Export CSV/PDF sobre el snapshot.

### 4.2 Slice B — Retenciones (migración `0166`)

`tax_withholdings` — comprobantes de retención emitidos por DTD (agente):
```
id              uuid pk default gen_random_uuid()
tenant_id       uuid not null references tenants(id) on delete cascade
withholding_type text not null  check (withholding_type in ('iva','islr'))
voucher_number  text not null                 -- capturado del comprobante SENIAT real
period          text not null  check (period ~ '^\d{4}-(0[1-9]|1[0-2])$')
op_date         date not null
supplier_id     uuid references suppliers(id) on delete set null
supplier_name   text not null                 -- snapshot
rif             text
source_bill_id  uuid references supplier_bills(id) on delete set null
source_doc      text                          -- snapshot del documento que origina la retención
base            numeric(14,2) not null  check (base >= 0)   -- IVA (ret-IVA) / monto (ret-ISLR)
pct             numeric(6,3)  not null  check (pct >= 0 and pct <= 100)
amount          numeric(14,2) not null  check (amount >= 0) -- retenido
currency        text not null default 'USD'
status          text not null default 'emitido'  check (status in ('emitido','anulado'))
notes           text
created_by      uuid references auth.users(id) on delete set null
created_at      timestamptz not null default now()
updated_at      timestamptz not null default now()
voided_at       timestamptz
voided_by       uuid references auth.users(id) on delete set null
```
- Idempotencia: `unique (tenant_id, withholding_type, voucher_number) where status = 'emitido'`.
- Índices: `(tenant_id, period, withholding_type)`; FK `(supplier_id)`, `(source_bill_id)`.
- RLS por tenant; `INSERT/UPDATE` gateados a rol accounting/admin (`with check` con `exists` a
  `user_tenants` role ∈ (accounting,admin) `and disabled_at is null`, patrón 0133); editable mientras
  `emitido`, anulable. Trigger de coherencia tenant (supplier_id / source_bill_id del tenant) +
  `touch_updated_at` (0002).

**Capa TS:**
- `withholding-types.ts` (puro): tipos + `validateWithholdingInput()` (sin Zod) + labels (`iva`/`islr`)
  + `computeWithholdingAmount(base, pct)` (redondeo 2 dec) + helper de período.
- `withholding-queries.ts`: `listWithholdings(supabase, period)` + `withholdingTotals()` (Σ IVA / Σ
  ISLR), resuelve RIF del proveedor si `supplier_id`.
- `actions.ts`: `createWithholdingAction` / `voidWithholdingAction` (gate accounting/admin, módulo ON).

**UI:** nueva sub-pestaña **"Retenciones"** en `FiscalClient.tsx` + `page.tsx` (`?tab=retenciones`):
selector de mes + 2 KPIs (Retención IVA / ISLR del período) + tabla (fecha, comprobante, tipo,
proveedor, RIF, base, %, retenido, estado) + drawer crear (`DrawerShell`, patrón Studio) + acción
anular + export CSV/PDF (reusa `rowsToCsv`/`PrintLayout`). `EmptyState` honesto si el mes no tiene
comprobantes / módulo OFF (reusa `FiscalDisabled`).

### 4.3 Tests (`lib/studio/fiscal/__tests__/`)

- `books-types.test.ts`: `salesRowToEntry`/`purchaseRowToEntry` (exenta→iva 0; gravada sin IVA real→
  rate null; total = base+iva); validación period/book_type; recálculo de totales coincide con
  `salesTotals`/`purchaseTotals` de 0073 (no diverge).
- `books-queries.test.ts`: stub `SupabaseClient` → cabecera vigente + líneas ordenadas; columnas
  seleccionadas ⊆ schema real (anti falso-verde); status anulado excluido del vigente.
- `withholding-types.test.ts`: `computeWithholdingAmount` (base×pct/100, redondeo); validación
  (pct 0–100, base/amount ≥0, voucher requerido, tipo iva/islr); totales IVA/ISLR.
- `withholding-queries.test.ts`: rango por período; exclusión de anulados de los totales.

## 5. Acceptance — V1

- [x] Migración `0165_fiscal_books.sql`: `fiscal_books` + `fiscal_book_entries` (text+check, RLS por
  tenant, GRANTS explícitos), índice único parcial de idempotencia, triggers append-only/anulación,
  RPC `fiscal_post_book` (`security definer`, `revoke from public,anon`, recalcula totales).
- [x] Migración `0166_tax_withholdings.sql`: `tax_withholdings` (RLS por tenant, gate accounting/admin
  en `with check`, índice único parcial del comprobante vigente, coherencia tenant, `touch_updated_at`).
- [x] **Asentar** un período (Ventas/Compras) congela el snapshot; volver a entrar muestra el snapshot,
  no el vivo. Editar una factura del período **no** cambia el libro asentado (inmutabilidad
  post-asiento verificada por triggers + tests).
- [x] **Anular** (accounting/admin) deja el asiento en historial y permite re-asentar. Re-asentar sin
  anular → bloqueado por el índice único (la action lo reporta amable, no crashea).
- [x] **Retenciones**: crear comprobante (nº capturado) + anular; pestaña lista el período con totales
  IVA/ISLR; export CSV/PDF. Duplicar comprobante vigente → bloqueado por el índice único.
- [x] Gate de poderes **en la DB**: un rol no-accounting/admin no puede asentar/anular/crear retención
  ni por PostgREST directo (RLS/RPC lo rechazan) — verificado por reviewer + auditor adversarial.
- [x] Módulo OFF (`fiscal_module_enabled=false`, DTD hoy) ⇒ todo inerte (no se asienta, no se crean
  retenciones); reusa el estado `FiscalDisabled`.
- [x] Cero valores fiscales fabricados (nº control, retención en libros → `—`; clasificación 100% de
  la config). `node scripts/verify.mjs` 🟢. Reviewer **APPROVED** + auditor adversarial **0 crítico**.

> **Cierre V1 (2026-06-22, vía harness `/feature`):** implement → verify 🟢 (2442 tests) → review
> **APPROVED** (findings solo INFO) ‖ auditor adversarial **0 crítico, 1 alto, 3 medio** → fixes
> aplicados: **H-2** (gate de la RPC atado a `user_tenants` + `disabled_at`, no a
> `current_studio_role()`), **H-3** (retención `anulado` terminal — guard de transición), **H-5**
> (guard de cabecera fuerza TODO el snapshot = `old` al anular, robusto) → re-verify 🟢. **H-1**
> (alto) **aceptado como trade-off documentado** (clasificar en SQL duplicaría 0073 → divergencia
> peor; modelo de confianza accounting/admin, como todo asiento del equipo) + lenguaje ajustado a ser
> honesto (verificación contra facturas = V2). **Gate founder pendiente:** aplicar `0165`+`0166` a
> prod (con los 2 skills Supabase). **NO** aplicada a prod, **NO** pusheada.

## 6. Fuera de alcance V1 (→ futuro)

- **Declaración IVA persistida + puente a Contabilidad** (débito−crédito, asiento de la cuota, "Posición
  IVA"). El blueprint la muestra (`DeclaracionView`/`ContabilizarFiscal`); es un SDD aparte que se
  apoya en los libros asentados de este.
- **Auto-numeración de correlativos de retención** (hoy capturado). Requiere confirmar el formato
  vigente con el contador (spec 0073 §8.4 #4).
- **Captura de IVA discriminado por compra** (`supplier_bills` no discrimina IVA → libro de Compras
  muestra `—`, heredado de 0073). Migración a `supplier_bills` = futuro.
- **Normalización multi-moneda por tasa BCV** (los totales V1 suman sin convertir + banner de aviso,
  heredado de 0073).
- **Retenciones que a DTD le practican** (IVA soportado 75%): la Declaración (futuro) las usa como
  deducción; este SDD modela las **emitidas**.
- **Verificación del asiento contra las facturas reales** (recomputar las líneas en SQL / anclar cada
  línea a su `invoice`/`bill` y validar montos) → V2. V1 confía en que la server action computó bien
  (modelo de confianza accounting/admin, §3 #6); no re-deriva la clasificación en SQL para no duplicar
  la lógica de 0073.
- **NO** tocar la frontera público↔ERP (todo Studio). **NO** tocar facturación ni `fiscal_settings`.

## 7. Notas de seguridad (checklist Supabase aplicado)

- RLS habilitada en las 3 tablas nuevas (schema `public` expuesto). GRANTS explícitos a `authenticated`
  (+ `service_role`) porque el auto-expose está OFF.
- `SECURITY DEFINER` solo en la RPC `fiscal_post_book` + triggers: `set search_path = public`,
  `revoke execute from public, anon`, chequeo de `auth.uid()`/tenant/rol **dentro** del cuerpo.
- UPDATE policies con `using` **y** `with check`. Sin `auth.role()` (deprecado) — se usa `to
  authenticated` + predicado de tenant `(select public.get_user_tenant_id())` (cacheado).
- Gate de rol duplicado (action **y** DB) — el founder lo exige para dinero (PostgREST evade la action).
- Idempotencia y unicidad por índices únicos **parciales** (no por lógica de app).
- `numeric(14,2)` para montos (llegan a TS como string → coercer con `num()`). Backfills/enlikes con
  `::text` si aplica (no hay backfill de enum nativo: todo text+check).
- Migraciones **aditivas**, **NO** aplicadas a prod (gate founder/coordinación).
