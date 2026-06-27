---
sdd: "0105"
title: "Conciliación bancaria + Activos fijos — sub-pestañas de Contabilidad (hueco #3 del Norte)"
status: done
author: "Claude Code (carril sdd-0105-conciliacion-bancaria)"
created: 2026-06-22
updated: 2026-06-27
supersedes: null
superseded_by: null
related: ["0040", "0077", "0079", "0080"]
confidencialidad: interno
---

# SDD-0105 · Conciliación bancaria + Activos fijos

## Contexto

La Contabilidad (SDD-0040) ya tiene plan de cuentas, libro diario por doble partida, libro mayor,
reportes P&L/Balance, asiento automático de factura/cobro/CxP/pago/gasto (SDD-0079) y cierre de
período (SDD-0080). El **norte** del ERP (`docs/design/studio/_norte/erp/modules/conciliacion.jsx`
y `contabilidad-data.jsx`) muestra dos piezas que el módulo real todavía **no** tiene y que cierran
el hueco #3 del Norte:

1. **Conciliación bancaria** — subir el extracto del banco, cruzar cada movimiento contra el libro
   diario y marcar qué está conciliado.
2. **Activos fijos** — registrar los bienes de uso (flota, equipos, mobiliario) y su depreciación
   lineal, con su asiento mensual.

Ambas **cruzan con el plan de cuentas y el diario que ya existen** (SDD-0040): la cuenta banco
(`1.1.1.x`), las cuentas de activo fijo (`1.2.x`), la depreciación acumulada contra (`1.2.9`) y el
gasto de depreciación (`6.17`) ya están sembradas en el CoA estándar (migración 0078).

## Qué hace (alcance V1)

Se **extiende el módulo existente** `/studio/contabilidad` con **dos sub-pestañas** nuevas:
**Conciliación** y **Activos fijos**. **No** se agrega un módulo nuevo a `lib/studio/modules.ts`
(el módulo `accounting` ya existe; su `layout.tsx` con `requireModuleView("accounting")` cubre todo
el subtree, así que ambas pestañas heredan el gate RBAC automáticamente).

### Conciliación bancaria

- **Cargar un extracto** (`bank_statements`): cuenta banco del plan, período, saldo inicial/final,
  banco, referencia, moneda. Sus **movimientos** (`bank_statement_lines`): fecha, descripción,
  referencia, sentido (crédito/débito), monto.
- **Cruzar cada movimiento contra el diario**: el usuario **liga** un movimiento a un asiento ya
  existente del libro diario (`matched_entry_id` → `journal_entries`), o lo marca **manual**
  (conciliado sin asiento) o **ignorado**. Una **sugerencia automática** liviana propone el asiento
  cuyo monto y cuenta-banco coinciden y aún no está conciliado (confianza alta/media/baja, *display*).
- **Tira de saldos** (display): saldo inicial + créditos − débitos vs. saldo final → diferencia.
  KPIs: movimientos importados, conciliados, pendientes, % del extracto conciliado.
- **Regla dura de alcance:** conciliar **solo setea el vínculo** (`matched_entry_id` + estado del
  movimiento). **No crea ni muta asientos** del mayor en V1 → el write-path financiero de esta
  pestaña es casi nulo (solo escribe en las tablas propias de conciliación, jamás en
  `journal_entries`/`journal_lines`). "Crear el asiento faltante desde la conciliación" (lo que hace
  `reconcileBankMovement` en el mock del Norte) queda como **no-goal V1** (ver abajo).

### Activos fijos

- **Registrar un bien** (`fixed_assets`): nombre, cuenta del activo (`1.2.x`), costo, valor residual,
  fecha de adquisición, vida útil en meses, método (línea recta V1). Opcionalmente la cuenta de
  depreciación acumulada (default `1.2.9`) y la de gasto (default `6.17`).
- **Cédula de depreciación** (cálculo *puro*, sin tocar la DB): cuota mensual = `(costo − residual)
  / vida_útil_meses`; meses transcurridos a una fecha; depreciación acumulada (tope = costo −
  residual); valor neto en libros. Mostrado por activo + totales.
- **Postear la depreciación del mes** (write-path financiero, *opt-in* por botón admin): por cada
  activo activo no totalmente depreciado se crea **un asiento asentado** idempotente:

  ```
  DR  6.17  Depreciación de flota y equipos        = cuota del activo
  CR  1.2.9 Depreciación acumulada (contra)        = cuota del activo
  ```

  con `source = 'depreciacion'`, **idempotente por (activo, período-mes)** y registrado en
  `fixed_asset_depreciation`. Respeta el **cierre de período** (`isPeriodClosed`, SDD-0080) y el
  **RBAC** (`moduleEditDenial("accounting")`). Mismo patrón exacto que `expense-posting.ts`
  (SDD-0079): admin client, best-effort, rollback manual, sin romper si falta una cuenta.
- **Dar de baja** un activo (`status = 'baja'`, `disposed_on`). La baja contable (asiento de
  enajenación) queda como no-goal V1.

## Esquema

> **2 migraciones reservadas: `0167`, `0168`.** Estados como **`text` + `check`** (no enums nuevos →
> se evita el dolor de backfill de enums; los `check` se amplían con un simple `drop/add constraint`).
> Sin funciones SQL nuevas (la idempotencia vive en índices únicos + la capa app con admin client,
> como `expense-posting`), así que **no hace falta `revoke execute from public, anon`** en estas
> migraciones (esa regla aplica a funciones `security definer`, de las que no creamos ninguna). Los
> `updated_at` reusan la función existente `public.touch_updated_at()` (0002) — no se crea función.

### Migración `0167_bank_reconciliation.sql`

**`bank_statements`** — cabecera del extracto, una por (cuenta, período):

| columna | tipo | nota |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `tenant_id` | uuid not null | → `tenants(id)` on delete cascade |
| `account_id` | uuid not null | → `accounts(id)` on delete **restrict** (la cuenta banco/caja del plan) |
| `period_label` | text not null | ej. `2026-05` |
| `period_start` / `period_end` | date | rango del extracto (opcional) |
| `bank_name` | text | display, ej. "Banesco USD" |
| `statement_ref` | text | nº de extracto / archivo |
| `opening_balance` / `closing_balance` | numeric(14,2) not null default 0 | |
| `currency` | text not null default `'USD'` | |
| `status` | text not null default `'open'` | check `('open','reconciled','archived')` |
| `notes` | text | |
| `created_by` | uuid | → `auth.users(id)` on delete set null |
| `created_at` / `updated_at` | timestamptz | |
| | | **unique (tenant_id, account_id, period_label)** |

**`bank_statement_lines`** — movimientos del extracto:

| columna | tipo | nota |
|---|---|---|
| `id` | uuid PK | |
| `statement_id` | uuid not null | → `bank_statements(id)` on delete cascade |
| `tenant_id` | uuid not null | → `tenants(id)` on delete cascade (denormalizado para RLS directa) |
| `line_date` | date not null | |
| `description` | text not null | |
| `reference` | text | ref bancaria del movimiento |
| `direction` | text not null | check `('credit','debit')` (crédito=entrada, débito=salida) |
| `amount` | numeric(14,2) not null | check `amount >= 0` |
| `status` | text not null default `'pending'` | check `('pending','matched','manual','ignored')` |
| `matched_entry_id` | uuid | → `journal_entries(id)` on delete set null |
| `match_confidence` | text | check `('high','medium','low')` (sugerencia, nullable) |
| `note` | text | |
| `reconciled_at` | timestamptz | |
| `reconciled_by` | uuid | → `auth.users(id)` on delete set null |
| `created_at` / `updated_at` | timestamptz | |

- Índices: `(statement_id)`, `(tenant_id, status)`, `(matched_entry_id) where matched_entry_id is not null`.
- **Anti doble-conciliación:** `unique index (tenant_id, matched_entry_id) where matched_entry_id is not null`
  → un asiento del diario no puede quedar ligado a dos movimientos a la vez (1:1).
- RLS por `tenant_id` en ambas (`get_user_tenant_id()`). Grants `authenticated` + `service_role`.
  Trigger `touch_updated_at` en ambas.

### Migración `0168_fixed_assets.sql`

**`fixed_assets`** — bienes de uso:

| columna | tipo | nota |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid not null | → `tenants(id)` on delete cascade |
| `name` | text not null | |
| `asset_account_id` | uuid not null | → `accounts(id)` on delete restrict (cuenta del activo `1.2.x`) |
| `accum_dep_account_id` | uuid | → `accounts(id)` on delete restrict (deprec. acumulada; default app `1.2.9`) |
| `expense_account_id` | uuid | → `accounts(id)` on delete restrict (gasto deprec.; default app `6.17`) |
| `cost` | numeric(14,2) not null | check `cost >= 0` |
| `salvage_value` | numeric(14,2) not null default 0 | check `>= 0` |
| `acquired_on` | date not null | |
| `useful_life_months` | integer not null | check `> 0` |
| `method` | text not null default `'linea_recta'` | check `('linea_recta')` |
| `status` | text not null default `'activo'` | check `('activo','baja','depreciado')` |
| `disposed_on` | date | fecha de baja |
| `notes` | text | |
| `created_by` | uuid | → `auth.users(id)` on delete set null |
| `created_at` / `updated_at` | timestamptz | |
| | | check **`salvage_value <= cost`** |

**`fixed_asset_depreciation`** — depreciación posteada por mes (registro + idempotencia):

| columna | tipo | nota |
|---|---|---|
| `id` | uuid PK | |
| `asset_id` | uuid not null | → `fixed_assets(id)` on delete cascade |
| `tenant_id` | uuid not null | → `tenants(id)` on delete cascade |
| `period` | text not null | `YYYY-MM` del mes depreciado |
| `amount` | numeric(14,2) not null | check `amount > 0` |
| `entry_id` | uuid | → `journal_entries(id)` on delete set null (asiento DR 6.17 / CR 1.2.9) |
| `posted_at` | timestamptz not null default now() | |
| `posted_by` | uuid | → `auth.users(id)` on delete set null |
| `created_at` | timestamptz | |
| | | **unique (asset_id, period)** ← idempotencia del posteo mensual |

- Índices: `(tenant_id)` en ambas, `(asset_id)` en depreciación, `(entry_id) where entry_id is not null`.
- RLS por `tenant_id`, grants `authenticated` + `service_role`, trigger `touch_updated_at` en `fixed_assets`.

`journal_entries` **no** necesita columna nueva: el vínculo asiento↔activo vive en
`fixed_asset_depreciation.entry_id`, y asiento↔movimiento en `bank_statement_lines.matched_entry_id`.
Los asientos de depreciación, al ser `journal_entries`, ya quedan protegidos por el **trigger de
cierre de período** (0133) sin trabajo extra.

## Capa app

```
lib/studio/accounting/
  bank-statement-types.ts        # tipos + validadores (sin Zod) + helpers de label/tono
  bank-statement-queries.ts      # listStatements, statementWithLines, suggestMatches (puro+query)
  fixed-asset-types.ts           # tipos + validadores + computeDepreciation() (PURA)
  fixed-asset-queries.ts         # listAssets, assetDepreciationRows
  depreciation-posting.ts        # postDepreciationForPeriod() — espejo de expense-posting.ts
  __tests__/                     # vitest: computeDepreciation, balance del extracto, validadores, idempotencia

app/studio/(app)/contabilidad/
  page.tsx                       # +tabs "conciliacion" | "activos"; fetch condicional por tab
  _components/ContabilidadClient.tsx   # +2 tabs en la barra
  _components/ConciliacionTab.tsx + StatementDrawer.tsx + LineMatchDrawer.tsx
  _components/ActivosFijosTab.tsx + AssetDrawer.tsx
  reconcile-actions.ts           # "use server": createStatement, addLines, matchLine, setLineStatus
  assets-actions.ts              # "use server": createAsset, disposeAsset, postDepreciationAction
```

- **Server actions**: patrón del repo — `moduleEditDenial("accounting")` primero, `resolveTenant`,
  `validate*Input()`, `revalidatePath("/studio/contabilidad")`. El posteo de depreciación valida
  `isPeriodClosed()` antes de tocar la DB (mensaje claro) y postea con admin client idempotente.
- **UI**: componentes del Studio (`Badge`, `EmptyState`, `ActionButton`, `Drawer`/`DrawerShell`,
  `useToast`, `Icon`) + tokens `var(--*)`. Español venezolano, **tuteo, cero voseo**. Sin AI slop.

## Defensa del dinero (write-path)

1. **Conciliación** no escribe en el mayor → riesgo financiero mínimo (solo vincula). El `unique`
   parcial sobre `matched_entry_id` impide ligar un asiento a dos movimientos.
2. **Depreciación**: idempotente por `(asset, period)` (unique en `fixed_asset_depreciation`) +
   `unique` parcial sobre `journal_entries` para el asiento vivo por registro de depreciación →
   un doble-submit no duplica el asiento. Respeta cierre de período (trigger DB 0133 + chequeo app).
   El asiento siempre balancea por construcción (DR cuota = CR cuota).
3. **RLS por tenant** en las 4 tablas; un `account_id`/`entry_id` de otro tenant es invisible (RLS)
   y se valida `tenant_id` en la action antes de postear.
4. **RBAC**: todo el subtree exige `requireModuleView("accounting")`; las mutaciones exigen
   `moduleEditDenial("accounting")`.

## Criterios de aceptación

- [ ] Migraciones `0167` y `0168` aplican limpio; RLS por tenant + grants + checks + uniques.
- [ ] `/studio/contabilidad?tab=conciliacion` lista extractos y movimientos; se puede cargar un
      extracto con movimientos y ligar un movimiento a un asiento existente (estado → matched).
- [ ] La tira de saldos cuadra (inicial + créditos − débitos vs. final) y los KPIs son correctos.
- [ ] No es posible ligar dos movimientos al mismo asiento (unique parcial lo rechaza).
- [ ] `/studio/contabilidad?tab=activos` registra un activo y muestra su cédula de depreciación
      (cuota, acumulada con tope, valor neto) correcta.
- [ ] "Registrar depreciación del mes" crea un asiento balanceado DR 6.17 / CR 1.2.9 por activo,
      **idempotente** (re-correr el mismo mes no duplica), y respeta el cierre de período.
- [ ] `node scripts/verify.mjs` en verde (lint → rsc-boundary → typecheck → test → docs:check).
- [ ] Tests unitarios: `computeDepreciation`, balance del extracto, validadores, idempotencia.

## No-goals (V1)

- **Crear/postear asientos faltantes desde la conciliación** (lo del mock `reconcileBankMovement`):
  V1 solo vincula a asientos existentes. Diferido para no abrir un write-path al mayor desde acá.
- **Import de extracto por archivo** (CSV/OFX/PDF parsing): V1 carga movimientos manualmente / pegados.
- **Asiento de baja/enajenación** del activo (ganancia/pérdida en disposición): solo se marca `baja`.
- **Depreciación acelerada / por unidades**: V1 solo línea recta.
- **Revaluación / ajuste por inflación de activos** (SDD-0073 fiscal lo trata aparte).

## Notas de implementación (carril sdd-0105)

- **`source='depreciacion'`**: `journal_entries.source` es `text` (no enum), así que el
  posteo de depreciación no requiere alterar tipo. Se agregaron los labels `expense` y
  `depreciacion` a `EntrySource`/`entrySourceLabel` en `lib/studio/journal-types.ts` (display).
- **Idempotencia del posteo**: la fila guard en `fixed_asset_depreciation` se inserta
  como cerrojo (unique `(asset_id, period)`) **antes del asiento**; si choca (`23505`) → skip sin
  tocar el mayor. Se eligió no usar el `unique` parcial sobre `journal_entries` (no hay columna
  `asset_id`/`depreciation_id` en `journal_entries`): el cerrojo del registro de depreciación
  ya garantiza 1 asiento por (activo, mes) sin alterar `journal_entries`.
- **Último mes redondea exacto**: la cuota a postear el mes que cierra la vida útil es
  `min(cuota, base − acumulada)` para que la acumulada cierre exactamente en la base
  (no deja centavos colgando). La acumulada topa en `cost − salvage` (valor neto nunca < residual).
- **Fecha del asiento de depreciación** = último día del mes del período (`endOfMonth`), así el
  trigger de cierre (0133) lo cubre "a fin de mes".
- **Cuentas banco/activo en la UI** se derivan del plan por `qbo_type` (`Bank` / `Fixed Assets`),
  `subtype` (`banco_caja` / `activo_fijo`) o prefijo de `code` (`1.1.1.` / `1.2.`, excluyendo la
  contra `1.2.9`). Sin tabla nueva ni columna nueva.
- **Sugerencia de match**: heurística PURA por monto (exacto→high, ±2%→medium, ±10%→low),
  display; un asiento ya ligado nunca se sugiere (1:1 forzado por el unique parcial de la DB).

## Hardening post-auditoría (auditor adversarial del dinero)

El auditor adversarial corrió en paralelo al reviewer: **0 críticos**, 1 alto, 3 medios, 3 bajos.
Se cerraron el alto y un medio (los demás son por-diseño o no-goals declarados):

- **A1 (alto · cerrado)** — *Integridad cross-tenant del vínculo a un asiento, defensa solo-app.*
  `matchLine` validaba el tenant del asiento, pero un PATCH directo vía PostgREST (saltándose la
  action) podía ligar `bank_statement_lines.matched_entry_id` —o `fixed_asset_depreciation.entry_id`—
  a un asiento de **otro tenant** (la FK y la RLS de la fila propia pasan). No corrompe el mayor
  ajeno (conciliar no muta asientos), pero rompe integridad referencial. **Fix:** trigger
  `BEFORE INSERT/UPDATE` en ambas tablas + helper `security definer` `public.journal_entry_in_tenant()`
  (creado en 0167, reusado en 0168; `revoke execute from public, anon`). Patrón espejo de
  `0093_comments_hardening`. La defensa ahora vive en la **DB**, no solo en la action.
- **M2 (medio · cerrado)** — el posteo de depreciación resuelve las cuentas 6.17/1.2.9 **antes** de
  insertar la fila guard, así no deja una fila transitoria (`amount>0`/`entry_id=null`) si falta una
  cuenta. La idempotencia no cambia (la guard sigue siendo el cerrojo, insertada antes del asiento).
- **M1 (medio · por diseño)** — `setLineStatus` limpia `matched_entry_id` al des-conciliar: es el
  comportamiento correcto (un movimiento que pasa a *pending/manual/ignored* deja de estar ligado).
  Sin impacto de dinero, intra-tenant, RBAC-gated; documentado en el código.
- **M3 (operacional)** — este SDD agrega un nuevo write-path al mayor (depreciación). **Gate de
  deploy:** confirmar que `accounting_settings` + el trigger de cierre (0133) están vivos en prod
  antes de habilitar el posteo, para que el chequeo de período cerrado no degrade a no-op.

## Trazabilidad

- Cruza con: `accounts` + `journal_entries`/`journal_lines` (SDD-0040, migr 0078), imputación de
  cuenta (SDD-0077), patrón de posteo automático (`expense-posting.ts`, SDD-0079), cierre de período
  (`isPeriodClosed`, SDD-0080, migr 0133), RBAC por módulo (SDD-0085).
- Diseño de referencia: `docs/design/studio/_norte/erp/modules/conciliacion.jsx` y
  `contabilidad-data.jsx` (mock del Norte; la implementación real usa Supabase, no localStorage).
