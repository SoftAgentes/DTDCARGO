---
sdd: "0569"
title: "Un solo conversor a USD, que falla cerrado, y una tabla de tasas con fuente y fecha"
status: draft
author: "founder"
created: 2026-10-20
updated: 2026-10-20
supersedes: null
superseded_by: null
related: ["0557", "0563", "0496"]
confidencialidad: interno
---

# SDD-0569 — Un solo conversor a USD, que falla cerrado, y una tabla de tasas con fuente y fecha

> La 2.1 del plan contable, primera parte: la tabla `fx_rates` y el conversor canónico (`to_usd` en SQL y `toUsd` en `lib/shared`), que nunca devuelve 0 ni el monto tal cual cuando falta la tasa. USDT = USD 1:1.

**Estado: DISEÑO para revisión del Director.** Todavía no hay migración ni código. La propuesta de partir la 2.1 y las preguntas están al final.

## Contexto

### El plan contable (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`)

- **B8:** «Conviven constantes fijas (36, 36.45, 7.18) y la regla de conversión a USD está copiada en seis sitios, con divergencia en CNY (en unos vale 0, en otros se divide por la tasa).» Además, `tenant_fx_history` no guarda si la tasa es BCV, paralela o manual, ni la fecha de vigencia.
- **2.1:** «Tasa BCV única: tabla `fx_rates` (8 decimales, fuente BCV / manual / operación, fecha de valor, quién) con carga diaria automática y respaldo; conversor canónico `to_usd` que falla cerrado (nunca cero ni el monto tal cual) y reemplaza las seis copias y las constantes; hora de Caracas para fechas de emisión y asiento; política USDT = USD 1:1 con el diferencial a 6.19.»

### Decisiones de Sam y del Director

- **Decisión 1 de Sam (2026-10-19):** el mayor va en USD, con USDT = USD 1:1. Los bolívares solo en reportes, y la diferencia en cambio a 6.19. Sin impuestos. Sam lo dijo así: «todo el sistema tiene que estar en USDT».
- **Decisión 2 de Sam:** lo que hay son datos de prueba. Según la radiografía, todo está en USD en producción.
- **El Director, 2026-10-20:** la 2.1 se parte en tres.
  - **SDD-0569** es esta: el conversor y la tabla, con la migración 0495.
  - **SDD-0570** es la hora de Caracas.
  - **La carga automática del BCV** va en una tercera, que necesita que Sam decida la fuente y la salida a internet.
  - El Director agregó: «CNY y VES siempre con tasa, fallando cerrado. Toma de modelo el `amountToUsd` de Financiero China, con `RMB` y `CNY` normalizados a un solo código.»

## Lo que hay hoy (mapa del 2026-10-20, sobre `9b932095`)

**No son seis copias: son 13 implementaciones con 6 reglas distintas,** sin contar envoltorios ni guardas.

| Regla | Dónde | Sin tasa | CNY | USDT |
|---|---|---|---|---|
| **A** | `invoiceUsdAmount` (`lib/studio/fidelizacion/types.ts:280`), con `balanceToUsd` (`payment-queries.ts:425`) y `billBalanceToUsd` (`treasury/bill-queries.ts:209`); la usan reportes (`reports/queries.ts:250, 844, 858, 1104, 1112`), costing (`costing/queries.ts:193`), el ingreso del período (`accounting/ingreso-periodo.ts:289`) y el dashboard; en SQL, `0404:28-33` y `0411:102-109, 124-131` | **0** | **0** | 1:1 |
| **B** | `receiptAmountUsd` (`accounting/receipt-posting.ts:75`), `billAmountUsd` (`bill-posting.ts:63`) y `paymentAmountUsd` (`supplier-payment-posting.ts:63`); la usan rendiciones, la separación de fondos y el subdiario | **el nominal** | /tasa | 1:1 |
| **C** | `amountToUsd` (`partner-finance/types.ts:343`) | **falla cerrado** | /tasa (`RMB`) | 1:1 |
| **D** | `toAmountUsd` (`expense-types.ts:255`) y la copia muerta `toUsd` (`lib/i18n/format.ts:102`) | 0, aunque el validador lo impide antes | /tasa | no existe |
| **E** | `convertToUsd` (`expense-queries.ts:76`, con las constantes 36 y 7.18) y `ceo-brief.ts:136` (36.5 y 7.18) | — | /7.18 | tal cual, o 0 en `ceo-brief` |
| **F** | `convertUsd` y `resolveDisplayRate` (`costing/types.ts:235`, `costing/ui.ts:34`), de USD a Bs | 36.45 | — | — |

**Además:**
- **El asiento de la venta no convierte:** `InvoicePostingInput` (`invoice-posting.ts:28-37`) no tiene ni moneda ni tasa. Es el B2 del plan.
- **`tenant_fx_history`** (`0074:55-63`):
  - tiene `currency_pair`, `rate numeric`, `set_at` y `set_by`;
  - no tiene fuente, fecha de valor ni unicidad;
  - la escriben Admin › Tasas y cada gasto VES o CNY de escritorio, y la leen gastos y Admin;
  - **no hay ninguna carga del BCV.**
- **Captura:** la factura exige la tasa solo en VES (`invoice-types.ts:420-426`), y la CxP nunca la exige (`treasury/types.ts:327-330`).
- **Pruebas que fijan lo de hoy:**
  - el nominal sin tasa: `payment.test.ts:341-343`, `treasury.test.ts:332-334` y `libro-control.test.ts:364-396`;
  - CNY = 0: `fidelizacion/types.test.ts:270-274` y `alerts.test.ts:101-115`;
  - CNY dividido por la tasa: `treasury.test.ts:328-330` y `renditions.test.ts:213, 249`.

## Propuesta: partir la 0569 en dos PR

Reemplazar las 13 implementaciones cambia cifras visibles en reportes, cobranzas, CxP, costing, el dashboard y el móvil, y reescribe unas diez pruebas. Junto con la tabla y la migración, no entra en una PR revisable. **Propongo:**

- **0569 (esta PR):**
  - la tabla `fx_rates`;
  - `to_usd` en SQL y `toUsd` en `lib/shared/fx.ts`;
  - la tasa vigente (`fx_rate_on`);
  - la captura con tasa obligatoria (factura en CNY, CxP);
  - Admin › Tasas escribe en `fx_rates`.

  Ningún reporte cambia todavía.
- **0569-b (SDD siguiente):** reemplaza las 13 implementaciones y las constantes por `toUsd`, con la lista de pantallas que cambian de cifra, y reescribe las pruebas que fijan lo de hoy, cada una citando la decisión 1.

## Diseño (esta PR)

### 1. La tabla `fx_rates` (migración 0495, MIGRATE-FIRST)

| Columna | Tipo | Qué es |
|---|---|---|
| `id` | `uuid` | |
| `tenant_id` | `uuid` | en cascada, como el resto |
| `currency` | `text` | `VES` o `CNY` (`RMB` se normaliza a `CNY`); un CHECK |
| `rate` | `numeric(20,8)` | unidades de esa moneda por 1 USD, mayor que 0 |
| `valid_on` | `date` | la fecha de valor, el día de Caracas |
| `source` | `text` | `bcv`, `manual` u `operacion`; un CHECK |
| `set_by` | `uuid` | quién, o null si la cargó un proceso |
| `set_at` | `timestamptz` | cuándo |
| `note` | `text` | opcional |

- **Unicidad:** `(tenant_id, currency, valid_on, source)`. Una corrección del mismo día crea una fila nueva con otra fuente, o reemplaza la manual por la RPC con su historial (pregunta 2).
- **Permisos:** RLS de lectura por tenant. La escritura va solo por una RPC DEFINER, para admin y accounting, y por `service_role`, que es la futura carga del BCV.
- **`tenant_fx_history` no se borra.** Sus filas pasan a `fx_rates` con `source = 'manual'` y `valid_on` = el día de Caracas de `set_at` (pregunta 1).

### 2. El conversor: `to_usd` (SQL) y `toUsd` (`lib/shared/fx.ts`)

Las dos versiones siguen la misma regla, la de `amountToUsd`:
- **USD y USDT:** el monto, 1:1.
- **VES y CNY (y `RMB`, que se normaliza a CNY):** el monto dividido por la tasa. **Sin una tasa finita y mayor que 0, falla cerrado:**
  - en SQL lanza `FX_RATE_MISSING` (22023, con hint);
  - en TS devuelve `{ ok: false, reason: "missing-fx-rate" }`.
- **Una moneda desconocida:** falla cerrado, con `FX_CURRENCY_UNKNOWN`.
- **El redondeo** es a 2 decimales al final, nunca en el medio.

`to_usd` es `immutable` y sin acceso a tablas. Recibe la tasa ya resuelta.

### 3. La tasa vigente: `fx_rate_on(tenant, currency, date)`

Devuelve la tasa de la fecha más reciente que sea menor o igual a `date`. Si ese día hay varias, el orden de preferencia es `bcv`, después `manual` y después `operacion` (pregunta 3). Sin ninguna, falla cerrado con `FX_RATE_MISSING`. Los documentos siguen congelando su propia tasa (`invoices.fx_rate` y las demás); `fx_rate_on` es para precargarla y para los reportes en Bs.

### 4. La captura con tasa obligatoria

- **Factura:** exige la tasa también en CNY (`invoice-types.ts:420-426`).
- **CxP:** exige la tasa si la moneda no es USD ni USDT (`treasury/types.ts:327-330`).
- **Gastos:** ya la exigen.
- **Gasto móvil:** el formulario no manda `fx_rate`. La 0569 lo precarga desde `fx_rate_on`, o el móvil deja de ofrecer VES y CNY (pregunta 4).

### 5. Admin › Tasas

Escribe en `fx_rates` por la RPC, con la fuente y la fecha de valor. La pantalla deja de prometer «configuración de qué tasa usa cada flujo» (`admin/page.tsx:176`), que no existe.

## Qué NO cambia en esta PR

- Ninguna cifra de los reportes, cobranzas, CxP, costing ni el dashboard. Eso es la 0569-b.
- El asiento de la venta, que es la 2.3 y el B2.
- La hora de Caracas, que es la 0570.
- La carga del BCV, que es la tercera.

## Preguntas para el Director

1. **`tenant_fx_history`:** ¿se copia a `fx_rates` como `manual`, o arranca vacía? Por la decisión 2 son datos de prueba. Propongo copiar sin borrar la vieja, y que el Director mida antes cuántas filas hay (un conteo).
2. **Dos tasas manuales del mismo día:** ¿la segunda reemplaza a la primera, guardando el historial en la auditoría, o se rechaza? Propongo reemplazar por la RPC y que quede en la auditoría D2.
3. **El orden de preferencia de la fuente** (`bcv`, después `manual` y después `operacion`): ¿de acuerdo? La de `operacion` es la que un gasto trae de su propia transacción.
4. **El gasto móvil en VES o CNY:** ¿se precarga la tasa vigente o se quitan esas monedas del móvil? Propongo precargarla y que se muestre.
5. **¿Partimos la 0569 como propongo** (tabla y conversor ahora, los 13 reemplazos en la 0569-b)?

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | por cumplir | la allowlist exacta va con la implementación |
| Producción | cumplimiento | la 0495 se aplica con el OK nominal de Sam y el runbook; el conteo de `tenant_fx_history` lo mide el Director |
| AUD-01 | por cumplir | la tasa guarda quién, cuándo y la fuente; `fx_rates` entra en la auditoría D2 |

## Validación

Pendiente.
