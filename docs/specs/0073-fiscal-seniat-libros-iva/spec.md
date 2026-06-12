---
sdd: "0073"
title: "Fiscal · SENIAT — módulo configurable: Configuración fiscal (per-tenant) + Libro de Ventas + Libro de Compras (Bloque 3)"
status: draft
author: "Claude Code (carril Bloque 3 · Norte v2.5)"
created: 2026-06-12
updated: 2026-06-12
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
  (`lib/studio/invoice-types.ts`); `invoices` con `base_amount`/`iva_rate`/`iva_amount`/`total_amount`/
  `rif` (0021); IVA débito fiscal asentado en `2.1.5` (`invoice-posting.ts`); compras en
  `supplier_bills` (0044, hoy **sin discriminar** el IVA → va al costo).
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
- `salesBook(supabase, period, settings)` → `invoices` del mes (excluye `anulada`) → filas
  clasificadas según la config. Σ por alícuota.
- `purchaseBook(supabase, period, settings)` → compras del mes desde `supplier_bills` (+`expenses`
  si aplica). IVA de compra según `purchase_iva_mode` (`derivado` = del total/base si hay; `capturado`
  = campo explícito, V2 si no existe). Sin fuente → `—`.

**UI — tabs Ventas/Compras** (`FiscalClient.tsx`, `"use client"`): selector de mes (URL) + tabla
formato-SENIAT + totales + export CSV/PDF (reusa `lib/studio/reports/export-csv.ts` +
`window.print()` de 0052, sin lib de PDF). `EmptyState` honesto. Entrada en `StudioSidebar` (Finanzas).

### 4.3 Tests (`lib/studio/fiscal/__tests__/`)
- `config-types.test.ts`: defaults, validación, cada `service_iva_treatment`.
- `types.test.ts`: `fiscalRange` (bordes/bisiesto), clasificación según settings (exento vs gravado
  vs mixto), totales por alícuota.
- `queries.test.ts`: stub `SupabaseClient` → rango mensual, exclusión de anuladas, mapeo, lectura de
  settings (default cuando no hay row).

## 5. Acceptance — V1

- [ ] Migración `fiscal_settings` (per-tenant, RLS, defaults) aplicada vía skills Supabase; `getFiscalSettings` cae a defaults sin row.
- [ ] `/studio/fiscal` con tab **Configuración** (admin-only) que persiste los settings; entrada en el sidebar (Finanzas).
- [ ] **Libro de Ventas** sobre `invoices` del mes, clasificado **según la config** (exento → IVA 0; gravado → débito 16%): fecha, factura, RIF+cliente, base, alícuota, IVA, total + totales por alícuota.
- [ ] **Libro de Compras** sobre compras del mes; IVA según `purchase_iva_mode` (o `—` honesto sin fuente).
- [ ] Cambiar un setting (p. ej. `service_iva_treatment` exento→gravado) **cambia los libros sin tocar código**.
- [ ] `lib/studio/fiscal/{config-types,types,queries}.ts` puros + tests verdes. Export CSV/PDF.
- [ ] `node scripts/verify.mjs` 🟢. `ui-ux-designer` OK. Cero valores fiscales fabricados.

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

(Pendiente — se completa al implementar V1.)

## 8. Configuración del módulo (lo que el contador define como DATOS, no como código)

> Antes eran "preguntas abiertas bloqueantes". Con el enfoque configurable **dejan de bloquear**: son
> los **campos de `fiscal_settings`**, con default y opciones. El contador los ajusta en la UI.

| Setting | Opciones | Default | Quién lo decide |
|---|---|---|---|
| `service_iva_treatment` | exento · gravado · tasa_cero · mixto | **exento** (transporte de carga) | contador |
| `iva_rate` | numeric | **16** | contador (alícuota vigente) |
| `is_special_taxpayer` | bool | false | contador |
| `is_iva_withholding_agent` | bool | **true** (founder) | contador |
| `iva_withholding_pct` | 75 · 100 | 75 | contador |
| `purchase_iva_mode` | derivado · capturado | derivado | founder/contador |
| `declaration_period` | mensual | mensual | contador |

**Lo único que NO se resuelve con config y queda como decisión de diseño previa a implementar:**
1. **Columnas exactas exigidas por la providencia SENIAT vigente** para cada libro (nº de control,
   tipo de transacción, etc.) — fija el set de columnas. *(Si varían por contribuyente, podrían
   volverse config jsonb; por ahora, set fijo según providencia + revisión del contador.)*
2. **Fuente del IVA de compras** cuando `purchase_iva_mode=capturado`: hoy `supplier_bills` no lo
   discrimina → habilitar ese modo es V2 (migración).
