---
sdd: "0073"
title: "Fiscal · SENIAT — módulo configurable: Configuración fiscal (per-tenant) + Libro de Ventas + Libro de Compras (Bloque 3)"
status: in-progress
author: "Claude Code (carril Bloque 3 · Norte v2.5)"
created: 2026-06-12
updated: 2026-06-16
supersedes: null
superseded_by: null
related: ["0018", "0021", "0040", "0042", "0044", "0052", "0053"]
confidencialidad: interno
---

# DTD-0073 — Fiscal · SENIAT (módulo configurable)

> **Bloque 3 — el único bloque del roadmap sin empezar** (el bottleneck del Norte). Entrega el
> módulo fiscal SENIAT con **principio rector: el software NO hardcodea reglas tributarias — las
> parametriza**. Toda decisión fiscal (calificación del servicio, alícuotas, condición de
> contribuyente especial, agente de retención, fuente del IVA de compras, columnas de los libros)
> es **configuración per-tenant**, editable por el admin/founder según lo que indique el contador.
> Los **Libros de IVA** (Ventas + Compras) **consumen** esa configuración.
> **V1 = Configuración fiscal + Libro de Ventas + Libro de Compras.** **V2 →** Declaración mensual ·
> comprobantes de Retención de IVA · "Posición IVA".

> ⚠️ **No es asesoría fiscal.** El software fija el **andamiaje configurable**; los **valores** de la
> configuración (¿exento o gravado?, %, columnas) los define el **contador**. La ventaja del enfoque
> configurable: implementamos **ya** con defaults sensatos y el contador ajusta los settings en la
> UI **sin tocar código** ni re-specar.

## 1. Resumen en una línea

`/studio/fiscal` con 3 tabs: **Configuración** (settings fiscales del tenant, admin-only),
**Libro de Ventas** y **Libro de Compras** — los libros se generan en formato SENIAT a partir de
`invoices` (0021) + compras del tenant, **interpretados según la Configuración**, con selector de
mes y export CSV/PDF.

## 2. Por qué (grounding)

- **Hueco:** Bloque 3 Fiscal/SENIAT no existe (ni spec ni tablas). `0018` cubre el **workflow
  aduanal** (DUA, aranceles, IGTF, IVA *de importación* del container) — **no** los libros de IVA.
- **El IVA ya se modela a nivel transacción** (reuse): toggle `tenants.iva_enabled`
  (`lib/studio/invoice-types.ts`); `invoices` con `base_amount`/`iva_rate`/`iva_amount`/`total_amount`
  (0077). El **RIF NO vive en `invoices`** (enlaza al cliente por `client_markbox`, texto sin FK) →
  el libro lo resuelve contra `clients` (0006, columna `rif`) por `markbox`. IVA débito fiscal
  asentado en `2.1.5` (`invoice-posting.ts`); compras en `supplier_bills` (0044, hoy **sin
  discriminar** el IVA → va al costo).
- **Por qué configurable (no hardcodeado):** la calificación tributaria del servicio de DTD es una
  **decisión del contador que puede cambiar** (reformas SENIAT, alta como contribuyente especial,
  aparición de operaciones gravadas por el trading). Hardcodear "exento" en el código obligaría a
  re-specar/re-deployar ante cualquier cambio. **El proyecto ya parametriza** lo equivalente:
  `tenants.iva_enabled` (toggle IVA), `rates`/`/studio/tarifas` (tarifas en DB), `feature_flags`
  (0042 per-tenant). El módulo fiscal sigue ese mismo patrón.

## 3. Decisiones ancladas

1. **Cero reglas fiscales hardcodeadas.** Toda regla vive en **Configuración fiscal per-tenant**
   (tabla `fiscal_settings`, 1 row/tenant). Los libros y (V2) la declaración la **leen**; el código
   nunca asume "exento"/"16%"/"retiene" — lo deriva de la config. Defaults sensatos para Venezuela,
   ajustables sin deploy.
2. **Migración mínima (solo la config).** A diferencia de Reportes (0048/0052, cero tablas), este
   módulo **sí** persiste configuración → 1 tabla `fiscal_settings` (per-tenant, RLS). Los **libros
   siguen siendo presentación pura** sobre `invoices`/compras (sin tablas de libros). *(Cambio
   respecto al draft inicial "sin migración": la configurabilidad lo exige y lo vale.)*
3. **Anclar a datos reales, nunca fabricar** (regla 0052 §3.2). Columna sin fuente → `—` + nota, jamás
   un valor inventado.
4. **Período mensual server-side** (`?period=YYYY-MM`, default mes actual). El IVA se declara por mes.
5. **Defaults de la config = el caso DTD hoy**, todos editables (ver §8):
   - Calificación del servicio: **exento** (transporte de carga, reforma 2018) — `[default, editable]`.
   - Agente de retención de IVA: **sí** (founder lo confirmó) — `[default true, editable]`.
   - Alícuota general: **16%**. Periodicidad: **mensual**.
6. **Toca DB → invocar los 2 skills Supabase** (seguridad + postgres-best-practices) **al
   implementar** la migración de `fiscal_settings` (RLS por tenant, patrón de `rates`/`feature_flags`).

## 4. Approach — V1

### 4.1 Configuración fiscal (el corazón del módulo)

**Migración** (`fiscal_settings`, per-tenant, RLS por tenant · patrón `feature_flags` 0042):
- `tenant_id` (PK/FK), `service_iva_treatment` enum (`exento` | `gravado` | `tasa_cero` | `mixto`)
  default `exento`, `iva_rate` numeric default 16, `is_special_taxpayer` bool default false,
  `is_iva_withholding_agent` bool default true, `iva_withholding_pct` numeric default 75,
  `purchase_iva_mode` enum (`derivado` | `capturado`) default `derivado`,
  `declaration_period` enum (`mensual`) default `mensual`, `updated_at`, `updated_by`.
- Helper `getFiscalSettings(supabase)` → settings del tenant con **defaults** si la row no existe
  (cero-config arranca usable). Lazy upsert al guardar.

**Types/validación** (`lib/studio/fiscal/config-types.ts`, sin Zod, validator propio).

**UI — tab Configuración** (`_components/FiscalConfig.tsx`, admin-only): form con los settings
(Server Action `useActionState` + parsing manual + `revalidatePath`, patrón Studio). Cada campo con
nota de ayuda ("esto lo define tu contador"). Sobre fondo navy → tokens `--ink-inv-*`.

### 4.2 Libros (consumen la config)

**`lib/studio/fiscal/types.ts`** (puro): `FiscalPeriod` + `fiscalRange`; `SalesBookRow` /
`PurchaseBookRow` (fecha, factura, nº control, RIF+nombre, base, alícuota, IVA, total, condición +
col. retención preparada); `BookTotals` (Σ base/IVA/total + desglose por alícuota). Helpers puros
testeables que reciben los settings (clasificación gravada/exenta **según `service_iva_treatment`**).

**`lib/studio/fiscal/queries.ts`** (puras, RLS por tenant):
- `salesBook(supabase, period, settings)` → `invoices` del mes **solo en estados emitidos**
  (`emitida`/`parcial`/`pagada`/`vencida`) → filas clasificadas según la config. `borrador` (no
  emitida) y `anulada` quedan **fuera** — un libro fiscal oficial no puede incluir base/IVA no
  emitidos (mismo criterio que Reportes 0052 / `invoiceKpis`). El RIF+nombre se resuelve contra
  `clients` por `client_markbox` (1 query extra, sin N+1; sin match → `—`). Σ por alícuota. Devuelve
  además las **monedas presentes** (la UI advierte si hay más de una; V1 no normaliza con `fx_rate`).
- `purchaseBook(supabase, period, settings)` → compras del mes desde `supplier_bills` (excluye
  `anulada`). IVA de compra según `purchase_iva_mode` (`derivado` = del total/base si hay; `capturado`
  = campo explícito, V2 si no existe). Sin fuente → `—`. Devuelve también las monedas presentes.

**UI — tabs Ventas/Compras** (`FiscalClient.tsx`, `"use client"`): selector de mes (URL) + tabla
formato-SENIAT + totales + export CSV/PDF (reusa `lib/studio/reports/export-csv.ts` +
`window.print()` de 0052, sin lib de PDF). `EmptyState` honesto. Entrada en `StudioSidebar` (Finanzas).

### 4.3 Tests (`lib/studio/fiscal/__tests__/`)
- `config-types.test.ts`: defaults, validación, cada `service_iva_treatment`.
- `types.test.ts`: `fiscalRange` (bordes/bisiesto), clasificación según settings (exento vs gravado
  vs mixto), totales por alícuota; **gravada sin IVA real (`iva_amount=0`) → alícuota `null` ("—"),
  no la general**.
- `queries.test.ts`: stub `SupabaseClient` → rango mensual; **el set seleccionado de `invoices` está
  contenido en las columnas reales (0077) y NO incluye `rif`** (anti falso-verde); RIF resuelto desde
  `clients` por markbox (sin N+1) y `—` sin match; **`borrador` excluido del Libro de Ventas**;
  monedas presentes reportadas; exclusión de anuladas en compras; `getFiscalSettings` cae a default
  sin row pero **propaga un error de lectura real** (no fabrica un libro exento).

## 5. Acceptance — V1

- [x] Migración `fiscal_settings` (per-tenant, RLS, defaults) **escrita** (`0126_fiscal_settings.sql`, RLS espejando feature_flags 0042; reviewer + auditor confirman sin IDOR/BOLA); `getFiscalSettings` cae a defaults sin row. ⚠️ **Aplicación a prod = gate founder** (no aplicada en este loop).
- [x] `/studio/fiscal` con tab **Configuración** (admin-only, guard server-side + RLS) que persiste los settings; entrada en el sidebar (Finanzas).
- [x] **Libro de Ventas** sobre `invoices` **emitidas** del mes (excluye `borrador` y `anulada`), clasificado **según la config**: fecha, factura, RIF (resuelto desde `clients`) + cliente, base, alícuota, IVA, total + totales por alícuota.
- [x] **Libro de Compras** sobre compras del mes; IVA según `purchase_iva_mode` (o `—` honesto sin fuente).
- [x] Cambiar un setting (`service_iva_treatment` exento→gravado) **cambia los libros sin tocar código** (clasificación derivada de la config; cero hardcode — verificado por reviewer).
- [x] `lib/studio/fiscal/{config-types,types,queries}.ts` puros + tests verdes. Export CSV/PDF.
- [x] `node scripts/verify.mjs` 🟢 (1769 tests). `ui-ux-designer` **OK** (2026-06-12, check de código — 1 fix de alineación del PDF de Compras aplicado; render real pendiente hasta aplicar la migr). Cero valores fiscales fabricados.

> **Cierre V1 (2026-06-12, vía harness `/feature`):** implement → verify 🟢 → review **CHANGES_REQUESTED** (6 findings reales: `invoices.rif` inexistente [crash], `borrador` en el libro, fallback exento silencioso, `gravado` retroactivo, mezcla de monedas, colisión de migr 0125) → fix → verify 🟢 → review **APPROVED** → ui-ux **OK**. Reviewer + auditor adversarial confirmaron RLS sin IDOR/BOLA, gate admin server-side real, fronteras público↔ERP + RSC intactas, principio cero-hardcode. **Gate founder pendiente:** aplicar `0126_fiscal_settings.sql` a prod (con los 2 skills Supabase) para activar el módulo. **V2** = §6 (declaración + retenciones + Posición IVA).

## 6. Fuera de alcance V1 (→ V2)

- **Declaración mensual / cierre de período** (débito − crédito = a pagar/excedente) → V2 (puede
  necesitar tabla de cierres). La **config** de período sí entra en V1 (el setting).
- **Comprobantes de Retención de IVA** (emitidos/recibidos, correlativos SENIAT) → V2 (tablas). En
  V1 la config **declara** que DTD retiene (`is_iva_withholding_agent`) y los libros dejan la columna
  de retención preparada; **no** se generan comprobantes aún.
- **"Posición IVA"** (reporte combinado que 0052 dejó bloqueado) → se desbloquea con la Declaración (V2).
- **Captura de IVA discriminado por compra** si `purchase_iva_mode=capturado` y no hay campo → V2 (migración a `supplier_bills`).
- **Retención ISLR**, libro de inventarios → fuera.
- **NO** tocar la frontera público↔ERP (todo Studio).

## 7. Notas de implementación

**V1 implementada** (carril `claude/admiring-lederberg-3b4fcc`, ronda 2 de correcciones aplicada · pendiente re-review):

- **Migración `0126_fiscal_settings.sql`** (el `0125` lo toma `0125_sales_orders` de
  la lane `feat/orden-venta` aún sin mergear → se subió al siguiente libre por encima
  de 0125 para evitar la colisión). Singleton por tenant (`tenant_id` PK). RLS
  espejada de `feature_flags` (0042): SELECT a authenticated del tenant ·
  INSERT/UPDATE **admin-only** (lazy upsert) · DELETE bloqueado · `service_role` all.
  UPDATE con `USING` **y** `WITH CHECK`. CHECKs de rango (alícuota/retención 0–100) +
  enums. **NO aplicada a prod.**
- **`lib/studio/fiscal/`** (puro, server-safe, sin Zod):
  - `config-types.ts`: `FiscalSettings` + enums + `validateFiscalSettingsInput()` +
    `DEFAULT_FISCAL_SETTINGS` (caso DTD §5).
  - `types.ts`: `FiscalPeriod` (`YYYY-MM`) + `fiscalRange()` (1°→último día, UTC,
    bisiesto OK) + `SalesBookRow`/`PurchaseBookRow`/`BookTotals` + helpers de
    clasificación **derivada de la config** (`classifyVenta`, `effectiveRate`,
    `toSalesRow`, `toPurchaseRow`) + totales por alícuota. **`toSalesRow`: gravada con
    `iva_amount=0` (factura vieja sin IVA real) → alícuota `null` ("—"), NO se fuerza
    la general (coherencia columna-a-columna; sin fuente, no se fabrica).**
  - `queries.ts`: `getFiscalSettings()` (defaults sin row, pero **propaga un error de
    lectura real** — no fabrica un libro exento por un fallo transitorio) · `salesBook()`
    sobre `invoices` **solo en estados emitidos** (`emitida`/`parcial`/`pagada`/`vencida`;
    `borrador`+`anulada` fuera), rango mensual por `created_at`, **RIF+nombre resueltos
    contra `clients` por `client_markbox`** (1 query extra, sin N+1; sin match → `—`) ·
    `purchaseBook()` sobre `supplier_bills` (excluye `anulada`, rango por `issue_date`,
    embebe `suppliers(tax_id)` → sin N+1). Ambos devuelven `{ rows, currencies }`
    (`FiscalBook<T>`) con las **monedas presentes** del período. `INVOICE_COLUMNS`/
    `SALE_STATUSES` exportadas para que los tests aserten contra el schema real.
- **UI** `app/studio/(app)/fiscal/`: `page.tsx` (server, `?tab`+`?period`) +
  `_components/FiscalClient.tsx` (3 tabs + selector de mes + tablas SENIAT + export
  CSV via `rowsToCsv`/`downloadTextFile` + PDF via `window.print()` + **`CurrencyNote`:
  muestra la moneda del período y, si hay >1, un banner visible — `--warning` — de que
  los totales mezclan monedas sin convertir**) + `_components/FiscalConfig.tsx` +
  `actions.ts` (admin-only upsert). Entrada en el sidebar (FINANZAS, junto a Tesorería).
- **Tests** `lib/studio/fiscal/__tests__/`: `config-types` (defaults, validación,
  cada treatment), `types` (fiscalRange bordes/bisiesto, clasificación por settings,
  totales, **#4 gravada sin IVA → rate null**), `queries` (stub SupabaseClient: rango,
  **set de columnas ⊆ columnas reales de invoices sin `rif`**, **RIF desde `clients`
  por markbox sin N+1**, **`borrador` excluido**, monedas reportadas, exclusión de
  anuladas, defaults sin row + **error de lectura propagado**, embed RIF de proveedor).
- **Cero valores fabricados:** nº de control fiscal → `—`; RIF sin cliente → `—`; IVA/base
  de compras en V1 (supplier_bills no discrimina IVA) → `—` + nota honesta; columna de
  retención preparada pero vacía (V2).
- **Mezcla de monedas (V1):** `invoices`/`supplier_bills` son multi-moneda (`fx_rate`);
  V1 **no normaliza** — suma crudo pero **lo muestra**: encabezado con la(s) moneda(s) +
  banner de aviso cuando hay más de una. Normalización por tasa BCV → V2.
- **Decisión de fuente del Libro de Compras:** se usa `supplier_bills` (0044, las
  CxP con `issue_date`/`reference`/proveedor reales), no `expenses` — los expenses
  son gastos operativos sin RIF de proveedor ni nº de factura, no aptos para el
  libro fiscal. Capturar IVA discriminado por compra queda a V2.
- **Follow-ups documentados (fuera de esta ronda, para no ampliar scope):** CSV injection
  en `csvCell` (código compartido de Reportes) · `disabled_at` en el admin gate de la
  action (la RLS ya defiende) · usar `total_amount` en vez de recalcular base+iva.

## 8. Configuración del módulo — DEFINICIÓN CANÓNICA (deep search SENIAT 2026-06-12)

> **Esta sección reemplaza la config tentativa de la V1.** Incorpora (a) los **4 principios del
> founder** (2026-06-12) y (b) el **research normativo verificado** (`assets/seniat-research-2026-06.md`).
>
> **✅ IMPLEMENTADA (2026-06-16, vía harness autónomo):** la reconciliación §8 está hecha — migración
> `0141_fiscal_module_v2_seniat.sql` (ALTER de `fiscal_settings` a la estructura §8.2 + `invoices.iva_mode`),
> `lib/studio/fiscal/{config-types,types,queries}.ts` reescritos (clasificación por `iva_mode` por factura),
> UI con **estado módulo-OFF** + form §8 (grupos A–H), tests verdes (`node scripts/verify.mjs` 🟢, 2070 tests).
> Reviewer **APPROVED** + auditor adversarial (0 crítico/alto; fixes aplicados: CSV-injection hardening,
> migración robusta `if exists`, error genérico) + ui-ux **OK** (master toggle con acento + disabled legible).
> **NO aplicada a prod** (gate founder). Queda fuera (ver §8.5): el camino de ESCRITURA de `iva_mode` por
> factura en el módulo de Facturación (drawer + compute) — el más invasivo, gateado por el master toggle OFF.

### 8.1 Principios rectores (founder · 2026-06-12)

1. **Módulo activable/desactivable.** Master toggle `fiscal_module_enabled` (**default FALSE**). Con
   OFF el módulo **no hace NADA**: no genera libros, no toca IVA, la facturación sigue normal (sin
   IVA). **DTD hoy = OFF.** La pantalla `/studio/fiscal` muestra "módulo desactivado" cuando OFF.
2. **Libros totalmente separados** del flujo de facturación normal (su propio módulo, sus propios
   correlativos/períodos).
3. **IVA por factura, NO por tenant.** Cada factura se marca individualmente **con-IVA / sin-IVA**
   (reemplaza el `service_iva_treatment` único del tenant). Hay un **default** configurable para
   facturas nuevas (hoy = sin-IVA), pero cada factura puede ser lo uno o lo otro.
4. **Cero automatismo fiscal** hasta activar — el módulo nunca empieza a facturar con IVA por su cuenta.

### 8.2 Settings de la configuración

| # | Grupo · setting | Opciones | Default (DTD hoy) | Fuente / nota |
|---|---|---|---|---|
| A | **`fiscal_module_enabled`** (master) | bool | **false** | principio #1 — OFF = módulo inerte |
| B | `is_special_taxpayer` (SPE) | bool | false | research §3/§6 — determina E y F · **a confirmar contador** |
| C | `iva_rate_general` | numeric | 16 | research §2 (Art. 63 LIVA; banda 8–16,5) — **configurable, el Ejecutivo la mueve** |
| C | `iva_rate_reduced` | numeric | 8 | research §2 |
| C | `iva_rate_export` | numeric | 0 | research §2 |
| C | `iva_rate_luxury_surcharge` | numeric | 15 | research §2 (suntuaria 16+15=31) |
| D | `default_invoice_iva_mode` | sin_iva · con_iva · exento · tasa_cero | **sin_iva** | principio #3 — default de facturas nuevas; cada factura sobreescribe |
| E | `igtf_enabled` | bool | false | research §3 — IGTF sobre cobros en divisa |
| E | `igtf_rate_fx` | numeric | 3 | research §3 (Art. 24; **configurable**, decreto del Ejecutivo) |
| E | `igtf_is_perception_agent` | bool | false | research §3 — solo si SPE; tarjeta en divisa exonerada |
| F | `iva_withholding_agent` | bool | false | research §6 — solo si SPE · **a confirmar contador** |
| F | `iva_withholding_pct` | 75 · 100 | 75 | research §6 (pendiente providencia vigente) |
| G | `digital_invoicing_enabled` | bool | **false** | research §1 — **DTD NO obligada** (no es operador exclusivamente online, Art. 4) |
| G | `homologated_provider` | text/null | null | research §1 — proveedor **homologado** que asigna el nº de control (el ERP NO lo autogenera) |
| H | `declaration_period` | mensual | mensual | research §4 |

**Por factura (toca facturación 0021 → V2):** `iva_mode` (sin_iva/con_iva/exento/tasa_cero) + alícuota
aplicada + base/IVA discriminados. El **número de control** (identificador 2 dígitos + secuencial
hasta 8) lo **asigna la imprenta digital homologada**, no el ERP (research §1).

### 8.3 Reconciliación con la V1 (`0126`) — ✅ HECHA (migr `0141`, 2026-06-16)

- ✅ `service_iva_treatment` (tenant) **reemplazado** por `default_invoice_iva_mode` (D) + columna
  `invoices.iva_mode` **por factura** (lectura en libros) + master `fiscal_module_enabled` (A).
- ✅ Agregados: `fiscal_module_enabled`, 4 alícuotas separadas (C), IGTF (E), `digital_invoicing_enabled` /
  `homologated_provider` (G). `is_iva_withholding_agent` renombrado a `iva_withholding_agent` (F, default
  ahora `false` per research §6). `is_special_taxpayer` (B) conservado.
- ✅ Libros (`salesBook`) clasifican por el `iva_mode` efectivo de cada factura (propio o el default del
  tenant si null). Estado **módulo-OFF** en `/studio/fiscal` (principio #1).

### 8.5 Slice siguiente (NO en este loop) — escritura de `iva_mode` por factura

El **camino de ESCRITURA** del `iva_mode` por factura toca el core de Facturación (0021):
`createInvoice/updateInvoice` (compute de IVA leyendo la config en vez de `tenants.iva_enabled`) + selector
en el `InvoiceDrawer`. Se **difirió a propósito** (decisión del loop autónomo 2026-06-16): el spec ya lo
marcaba "lo más invasivo, V2", el master toggle está **OFF** (no entrega valor hoy) y la activación
depende del contador (§8.4). La columna `invoices.iva_mode` + la lectura en los libros ya están listas —
es un slice limpio y aislado para cuando se active el módulo. **Debe quedar gateado por RBAC treasury/admin
(SDD-0085)** al implementarse.

### 8.4 Pendientes a confirmar (con el contador) antes de activar — load-bearing

1. **Base legal exacta de la EXENCIÓN del flete** (Arts. 16/17-19 LIVA) ⚠️ + verificar el posible
   **decreto 2026 de SUSPENSIÓN de exenciones a la importación** (research §6).
2. **¿DTD es Sujeto Pasivo Especial?** — determina IGTF (E) y retención (F).
3. **Columnas exactas de los Arts. 75 (Compras) / 76 (Ventas) RLIVA** — fija las tablas de los libros.
4. **Régimen vigente de retenciones de IVA** (providencia histórica `SNAT/2015/0049`: %, comprobante, plazos).
5. **Proveedor homologado** a integrar (PA-00121) si algún día se emite factura fiscal digital.
