---
sdd: "0569"
title: "Un solo conversor a USD, que falla cerrado, y una tabla de tasas con fuente y fecha"
status: in-progress
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

**Estado: IMPLEMENTADA, en PR en borrador.** El Director aprobó el diseño el 2026-10-20 y respondió las cinco preguntas (ver *Decisiones del Director*). La 0495 espera el OK nominal de Sam (MIGRATE-FIRST).

## Decisiones del Director, 2026-10-20 (respuesta a las preguntas del diseño)

1. **`tenant_fx_history`:** el Director midió **0 filas** en producción. No hay copia: `fx_rates` arranca vacía, y el preflight de la 0495 aborta si `tenant_fx_history` tiene alguna fila al aplicar. La tabla vieja no se borra, pero la app deja de escribirla y de leerla.
2. **Dos tasas manuales del mismo día:** la segunda reemplaza a la primera por la RPC, y la auditoría D2 guarda la anterior y la nueva.
3. **Preferencia de la fuente:** `bcv`, después `manual` y después `operacion`. De acuerdo.
4. **El gasto móvil en VES o CNY:** se precarga la última tasa y se muestra, editable.
5. **La partición:** aprobada. Los 13 reemplazos van en su propia SDD, con número al empezarla.

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

## La partición (aprobada)

Reemplazar las 13 implementaciones cambia cifras visibles en reportes, cobranzas, CxP, costing, el dashboard y el móvil, y reescribe unas diez pruebas. Junto con la tabla y la migración, no entra en una PR revisable. Por eso:

- **0569 (esta PR):** la tabla `fx_rates`, `to_usd` en SQL y `toUsd` en `lib/shared/fx.ts`, la tasa vigente (`fx_rate_on`), la captura con tasa obligatoria y congelada en el documento, y Admin › Tasas, gastos y el móvil sobre `fx_rates`. **Ningún reporte cambia todavía.**
- **La SDD siguiente:** reemplaza las 13 implementaciones y las constantes por `toUsd`, con la lista de pantallas que cambian de cifra, y reescribe las pruebas que fijan lo de hoy, cada una citando la decisión 1.

## Implementación

### 1. La migración `0495_fx_rates_conversor_usd.sql` (MIGRATE-FIRST)

- **Preflight:** aborta si `fx_rates` o `to_usd` ya existen, o si `tenant_fx_history` tiene filas. Exige `append_audit_event` SECURITY DEFINER con `search_path` vacío y el tipo de entidad de auditoría `exchange_rate`.
- **La tabla `fx_rates`:**

  | Columna | Tipo | Qué es |
  |---|---|---|
  | `id` | `uuid` | |
  | `tenant_id` | `uuid` | en cascada, como el resto |
  | `currency` | `text` | `VES` o `CNY`; un CHECK (`RMB` se normaliza antes) |
  | `rate` | `numeric(20,8)` | unidades de esa moneda por 1 USD; mayor que 0 y menor que 1e12 (eso descarta NaN e Infinity) |
  | `valid_on` | `date` | la fecha de valor, el día de Caracas |
  | `source` | `text` | `bcv`, `manual` u `operacion`; un CHECK |
  | `set_by` | `uuid` | quién, o null si la cargó un proceso |
  | `set_at` | `timestamptz` | cuándo |
  | `note` | `text` | opcional, hasta 500 caracteres |

  Única por `(tenant_id, currency, valid_on, source)`. RLS de lectura por tenant; `authenticated` solo lee. La escritura va por la RPC o por `service_role`, que es la futura carga del BCV.
- **`fx_normalizar_moneda` y `to_usd(amount, currency, rate)`:** IMMUTABLE, sin acceso a tablas; la tasa llega ya resuelta. USD y USDT 1:1. VES y CNY divididos por la tasa, con `RMB` = CNY. Redondeo a 2 decimales al final. Un monto null devuelve null. **Falla cerrado** con hint `dtd-fx`:
  - `FX_RATE_MISSING` sin una tasa finita y mayor que 0;
  - `FX_CURRENCY_UNKNOWN` con otra moneda;
  - `FX_AMOUNT_INVALID` con un monto fuera de ±1e12, o NaN.
- **`fx_rate_on(tenant, currency, date)`:** STABLE e INVOKER, así que la RLS filtra por tenant. Devuelve la tasa, su fuente y su fecha: la de la fecha más reciente menor o igual a `date`, y ese día la de `bcv`, después `manual` y después `operacion`. Sin ninguna, `FX_RATE_MISSING`.
- **`registrar_tasa_de_cambio(currency, rate, valid_on, note)`:** SECURITY DEFINER, solo admin o accounting del tenant. Valida la moneda, la tasa y que la fecha no sea posterior a hoy en Caracas. Una segunda tasa manual del mismo día y moneda reemplaza a la primera.
- **La auditoría D2:** un disparador sobre `fx_rates` llama a `append_audit_event` con `exchange_rate_recorded`, `exchange_rate_corrected` o `exchange_rate_deleted`, y guarda la tasa anterior y la nueva en `before_data` y `after_data`.
- **`invoices` y `supplier_bills`:** dos columnas nuevas, `fx_rate_source` (CHECK `bcv`, `manual` u `operacion`) y `fx_rate_valid_on`. El documento congela la tasa que usó: una corrección posterior de `fx_rates` no lo cambia (decisión 1: la factura toma «la tasa BCV del día de emisión»).
- **El contrato** (`supabase/tests/0495_fx_rates_conversor_usd.test.sql`) replica la 0261: retira el CHECK legacy de `entity_type` que las migraciones viejas de facturas vuelven a crear en el fixture; en producción manda la FK a `audit_entity_types`.
- **Postflight:** las volatilidades, que `authenticated` solo lee `fx_rates`, la ACL de la RPC y de la auditoría, y el disparador.

**Por qué `to_usd` es IMMUTABLE y `fx_rate_on` STABLE:** el conversor no lee tablas, así que puede ir en índices, CHECK y columnas generadas. La tasa vigente sí lee `fx_rates`, que cambia entre transacciones.

### 2. `lib/shared/fx.ts`

`normalizarMoneda`, `necesitaTasa`, `tasaValida` y `toUsd`, con la misma regla que `to_usd`: devuelve `{ ok: true, usd }` o `{ ok: false, reason }`, con las razones `missing-fx-rate`, `unknown-currency` e `invalid-amount`. Vive en `lib/shared` porque la SDD siguiente lo usa también fuera del Studio.

### 3. `lib/studio/fx-rates.ts`

- `tasaVigente`: llama a `fx_rate_on`; null si no hay tasa o si la base todavía no tiene la 0495.
- `tasaDelDocumento`: la tasa que congela un documento. En USD y USDT no hay tasa y no se llama a la base. La tasa escrita es `manual` y del día del documento. Sin ella, la vigente, con su fuente y su fecha. Sin ninguna, el error «Falta la tasa de {bolívares|yuanes} para el {fecha}: escríbela aquí o cárgala en Admin › Tasas.»
- `ultimaTasa`: la última tasa de una moneda, para precargar gastos, Admin y el móvil.

### 4. La captura con tasa obligatoria

- **Factura** (`invoice-types.ts`, `facturacion/actions.ts`): exige la tasa también en CNY. `createInvoice` y `updateInvoice` resuelven la tasa antes de validar y guardan `fx_rate`, `fx_rate_source` y `fx_rate_valid_on`. En USD y USDT no nombran las columnas nuevas. El día del documento es hoy en UTC; la hora de Caracas es la 0570.
- **CxP** (`treasury/types.ts`, `treasury-actions.ts`): exige la tasa fuera de USD y USDT. `createBillFor` la resuelve al día de emisión.
- **Gastos de escritorio:** ya exigían la tasa. Dejan de copiarla a `tenant_fx_history`, y la precarga sale de `fx_rates` (`getLastFxRate` usa `ultimaTasa`; `setAt` pasa a ser la fecha de valor).
- **Gasto móvil:** el formulario de crear y el de editar muestran la tasa en VES o CNY, precargada con la última del Studio y editable (`CampoTasaGasto`); la acción la manda. Sin tasa, el validador lo rechaza como en escritorio.

### 5. Admin › Tasas

Registra por la RPC, con la fecha de la tasa (por defecto hoy en Caracas, sin fechas futuras) y una nota. Muestra la última por par con su fecha y su fuente. Muestra solo los mensajes de la 0495 (hint `dtd-fx`); cualquier otro error de la base se cambia por uno genérico. La descripción de la pantalla deja de prometer «configuración de qué tasa usa cada flujo».

## Qué NO cambia en esta PR

- Ninguna cifra de los reportes, cobranzas, CxP, costing ni el dashboard. Eso es la SDD siguiente.
- El asiento de la venta, que es la 2.3 y el B2.
- La hora de Caracas, que es la 0570.
- La carga del BCV, que es la tercera.
- `tenant_fx_history` no se borra.

## Riesgos

- **Entre aplicar la 0495 y desplegar la PR:** ninguno. La migración es aditiva y la app desplegada no la nota.
- **La PR desplegada sin la 0495:** una factura o una CxP en VES o CNY falla al guardar, porque nombra las columnas nuevas, y Admin › Tasas no guarda. En USD y USDT todo sigue igual. Está declarado en `pending-migration-symbol-declarations.json`, y el orden MIGRATE-FIRST lo evita.
- **Un documento en VES o CNY sin tasa cargada:** ya no se guarda con una tasa inventada; pide la tasa. Es el comportamiento buscado (falla cerrado).

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0495_fx_rates_conversor_usd.sql` | la migración |
| `supabase/tests/0495_fx_rates_conversor_usd.test.sql` | el contrato |
| `lib/studio/__tests__/fx-rates-conversor.migration.test.ts` | el contrato en PGlite: control rojo, 16 mutantes, el preflight con una fila en `tenant_fx_history`, la reaplicación y la espera |
| `supabase/migrations-baseline.json` | la espera de la 0495 |
| `supabase/pending-migration-symbol-declarations.json` | los 7 símbolos y su degradación |
| `lib/shared/fx.ts` | nuevo: el conversor canónico en TS |
| `lib/shared/__tests__/fx.test.ts` | nueva |
| `lib/studio/fx-rates.ts` | nuevo: la tasa vigente, la del documento y la última |
| `lib/studio/__tests__/fx-rates.test.ts` | nueva: la tasa del documento y los validadores |
| `lib/studio/invoice-types.ts` | la tasa obligatoria también en CNY |
| `app/studio/(app)/facturacion/actions.ts` | la tasa congelada al crear y al guardar un borrador |
| `app/studio/(app)/facturacion/__tests__/factura-congela-la-tasa.test.ts` | nueva |
| `lib/studio/treasury/types.ts` | la tasa obligatoria fuera de USD y USDT |
| `lib/studio/treasury/treasury-actions.ts` | la tasa congelada al crear la CxP |
| `lib/studio/treasury/__tests__/cxp-congela-la-tasa.test.ts` | nueva |
| `lib/studio/exchange-rates-types.ts` | fecha y nota; fuente y fecha de valor en la última tasa |
| `lib/studio/exchange-rates-queries.ts` | lee `fx_rates` |
| `app/studio/(app)/admin/exchange-rates-actions.ts` | registra por la RPC |
| `app/studio/(app)/admin/__tests__/exchange-rates-actions.test.ts` | nueva |
| `app/studio/(app)/admin/_components/ExchangeRatesSection.tsx` | fecha de la tasa, fuente y textos nuevos |
| `app/studio/(app)/admin/page.tsx` | la descripción de la sección |
| `lib/studio/expense-queries.ts` | la precarga sale de `fx_rates` |
| `app/studio/(app)/gastos/actions.ts` | deja de escribir `tenant_fx_history` |
| `app/m/erp/_components/MobileErpClient.tsx` | el campo de la tasa en el gasto móvil |
| `app/m/erp/actions.ts` | manda la tasa al crear y al editar |
| `app/m/erp/page.tsx` | la precarga de la tasa |
| `docs/specs/0569-conversor-usd-tasas/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0569-conversor-usd-tasas.md` | handoff |

## Criterios de aceptación

1. `to_usd` y `toUsd` dan lo mismo: USD y USDT 1:1, VES y CNY divididos por la tasa, `RMB` = CNY, redondeo al final. Sin tasa válida, con moneda desconocida o con un monto inválido, fallan cerrado: nunca 0 ni el monto tal cual.
2. `fx_rate_on` devuelve la tasa vigente con su fuente y su fecha, prefiere `bcv`, después `manual` y después `operacion`, y falla cerrado sin tasa.
3. Solo admin o accounting registran una tasa, nunca con fecha futura; la segunda manual del día reemplaza a la primera, y la auditoría guarda las dos.
4. `authenticated` solo lee `fx_rates`, y solo las de su tenant. `fx_rate_on` filtra por tenant en la consulta **y** en la RLS: sin RLS (`service_role`) sigue devolviendo solo la tasa del tenant pedido (pedido del Director).
10. La auditoría D2 de `fx_rates` guarda solo la moneda, la tasa, el día y la fuente: ni la nota ni `set_by`. Quién la cargó queda en `actor_id`, como en toda la D2 (pedido del Director).
5. Una factura o una CxP en VES o CNY guarda la tasa que usó, con su fuente y su fecha; sin ninguna tasa, no se guarda y el error dice qué hacer. En USD y USDT no cambia nada.
6. Admin › Tasas, gastos y el móvil leen y escriben `fx_rates`; nada escribe `tenant_fx_history`.
7. El preflight aborta si `tenant_fx_history` tiene filas; aplicada dos veces, aborta con «ya existe».
8. Control rojo: sin la 0495 el contrato falla en la primera aserción, y cada regla tiene un mutante que muere en su aserción.
9. Ninguna cifra de reportes cambia.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | cumplimiento | esta spec, con allowlist exacta |
| AUD-01 | cumplimiento | la tasa guarda quién, cuándo y la fuente, y cada alta, corrección o borrado entra en la auditoría D2 con la tasa anterior y la nueva |
| ERR-01 | cumplimiento | Admin › Tasas muestra solo los mensajes con `hint = 'dtd-fx'`; el resto, un mensaje genérico (prueba de la acción) |
| FRM-01, A11Y-01 | cumplimiento | la fecha y la tasa del móvil con `<label>`; la ayuda de la tasa con `aria-describedby` |
| Producción | cumplimiento | el conteo de `tenant_fx_history` lo midió el Director; la 0495 se aplica con el OK nominal de Sam y el runbook |
| Datos personales | no aplica | las tasas no son datos personales |

## Validación

Ver el handoff `.agents/handoffs/0569-conversor-usd-tasas.md`.
