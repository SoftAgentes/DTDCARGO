---
sdd: "0572"
title: "Los 13 conversores a USD pasan a uno solo, que falla cerrado"
status: in-progress
author: "founder"
created: 2026-10-20
updated: 2026-10-20
supersedes: null
superseded_by: null
related: ["0569", "0557"]
confidencialidad: interno
---

# SDD-0572 — Los 13 conversores a USD pasan a uno solo, que falla cerrado

> La 2.1 del plan contable, segunda parte. La SDD-0569 creó el conversor canónico (`toUsd` en `lib/shared/fx.ts` y `to_usd` en la 0495) y la tabla `fx_rates`. Esta reemplaza las 13 implementaciones y las tasas fijas del código por ese conversor. **Aquí sí cambian cifras visibles.**

**Estado: 0572-a IMPLEMENTADA Y REVISADA LOCALMENTE; COBERTURA CANÓNICA INCOMPLETA** (reglas A a F y completitud cambiaria). Producto `4dbdb21b`, [PR #310 en borrador](https://github.com/SoftAgentes/DTDCARGO/pull/310), después de integrar #301 desde main `d410ab2e` en `2df9d22d`. Verify terminó exit 0 con 14/17 controles medidos y tres omisiones críticas; no equivale a cierre verde completo ni a integración aprobada. La base original apilada fue `3d0c9028`; el diseño lo aprobó el Director el 2026-10-20 (sobre `da23a77f`). G queda para 2.3 y 0572-b inicia su transición compatible en rama separada, según la subsección b.

El primer cierre parcial de 0572-a en Codex el 2026-10-20 recibió turno exclusivo de validación y autorización para commits selectivos y push a la misma rama; entonces la PR esperaba la integración de #301. La retoma vigente se rige por la decisión siguiente. El estado general permanece `in-progress` porque la validación, integración y transición SQL 0572-b siguen abiertas.

El cierre parcial anterior esperó la reparación de #301. El Director confirmó ahora su integración y la aplicación/verificación de 0495: la retoma no edita ni reaplica SQL. Sam informó el rechazo de pago y aclaró que las 48 horas son la espera para cambiar la tarjeta, sin garantía de habilitación de Actions; los checks remotos no se presumen aprobados. La validación local y una PR en borrador están autorizadas; la integración final de 0572 debe revalidarse contra la base que incluya 0573 y conserva el orden coordinado por el Director.

## Decisión del Director para la retoma local · 2026-10-20

El Director aceptó expresamente la preparación externa
`C:/tmp/director-traspaso-20261020/0572-retoma-despues-301.md`, sus contratos
R1–R3/I1–I4/C1 y escenarios T1–T10. Se registra antes de editar producto:

- Toda conversión faltante mantiene subtotal conocido y contador visible;
  diferencia USD completa en `null`, nunca «Cuadra» o éxito.
- Se conservan ausencia de mayor/cuenta, B3 (faltan asientos, sin cuantificar
  una diferencia incompleta) y `no_comparable` del mayor nominal mixto.
  `conversion_incompleta` es un motivo diferente; no recalcula 4.5 ni el
  facturado oficial. Se acepta cambiar la aserción I2 por esta decisión,
  conservando filtros de base sin IVA, emisión, estado, borrado y fondos.
- Costing ordena primero los completos y deja los incompletos al final de
  manera estable en los cuatro órdenes. Ningún incompleto entra en top/peores
  ni recibe margen definitivo o color de rentabilidad. Conserva costos,
  subtotal, contador y estado, también en totales y agregados por ruta de
  **este Costing**. No incorpora los KPIs globales de otra SDD.
- Los CSV conservan estado/contador y señalan el subtotal parcial; diferencia
  o margen no certificados van vacíos, cero conocido sigue siendo 0. El texto
  sobre CNY indica «bolívares o yuanes sin tasa».
- Lectura truncada/errónea rechaza; lectura completa sin tasa produce
  subtotal y contador. Segunda página y deduplicación se verifican sin
  presuponer que fallen. Se preserva el futuro puente de 0573.
- Se amplía exactamente la allowlist **55→58** con la tarjeta de ingreso,
  una prueba del CostingClient real y el exportador CSV, enumerados abajo.
  Captura/CAS/aviso/SQL recibidos de 0569 son dependencia, no autoría nueva.
- Primero se preparan y capturan rojos funcionales; después se corrige
  producto. Pruebas, tipos, build, verify, Docker e instalaciones esperan
  el turno pesado expreso del Director. Ningún permiso incluye merge a main,
  despliegue, DB real, históricos, 2.3/G, BCV o reloj Caracas.
- Tras evidencia visual a contenedor 390 px, el Director aprobó cambiar
  únicamente el overflow horizontal del ranking a auto: permite acceder al
  nuevo contador/estado sin rediseñar columnas. La frase histórica del
  Overview con revenue/costo cero queda fuera de alcance documentado.
- A 22:25Z, el Director autorizó ampliar exactamente **58→60** con
  `lib/studio/reports/__tests__/builder.test.ts` y
  `scripts/__tests__/invoice-read-boundary.test.mjs`. El constructor debe
  conservar igualdades exactas incluyendo `tasa` y verificar su proyección
  real para ambas fuentes. El inventario pasa costing 2→1 y total 44→43 por
  retirar `latestVesFxRate`; mantiene 19 rutas y toda la comparación exacta.
  Revenue conserva cliente de sesión/guards/RLS; display usa `ultimaTasa`
  sobre `fx_rates`, sin nueva lectura de facturas ni cliente admin.
  Se detuvo verify220a con evidencia parcial: dos asserts fallidos y un
  subconteo descubierto en revisión. Antes de reparar se reproducirá la mezcla
  de dos facturas distintas, una por ID+code y otra solo code, en páginas
  diferentes. No se cambiará el subtotal histórico por inferencia. Se prepara
  mientras el turno pesado está cedido al Worker del publicador.
- El Director amplió después **60→65**, únicamente con `BuilderView.tsx`,
  `CobranzasClient.tsx` y las pruebas reales `ReportesClient.sin-tasa.test.tsx`,
  `BuilderView.sin-tasa.test.tsx`, `CobranzasClient.sin-tasa.test.tsx` (rutas
  exactas en allowlist). Aceptación: todas las salidas de estas conversiones
  conservan subtotal parcial + estado/contador, incluido Mixto y CSV de
  rutas/servicios/aging/cashflow. Solo excluidas no significa «sin saldos» ni
  permite omitir CSV. Constructor propaga completitud por métrica, grupo y
  total además del filtro Tasa; suma monetaria parcial visible, promedio
  monetario incompleto no certificado, desconocido distinto de cero válido.
  Cantidad, medidas físicas y costo por CBM siguen calculables. Fondos conserva
  su clasificación y subtotal; muestra incompletitud y cuenta los cobros sin
  identificar independientemente de su tasa. Sin KPIs globales, ledger, SQL,
  históricos ni IVA. Regresiones funcionales sobre220a antes de reparar,
  cuando se devuelva expresamente el turno pesado.
- Precisión F5 aprobada por el Director: conservar la columna monetaria
  histórica del CSV del Constructor, redondeada a entero y cubierta por su
  prueba; añadir subtotal conocido con centavos, estado/contador y null vacío.
  Revisar globalmente ese formato histórico queda fuera del alcance de0572-a.
- Conservación posterior acordada: el total global de sumas físicas (CBM)
  mantiene round2 histórico y sus filas conservan precisión sin redondear.
  El promedio monetario incompleto está cubierto en helper/CSV con null y
  subtotal conocido; el catálogo UI no ofrece esa métrica, y no se amplía.

## Decisiones del Director, por la delegación de Sam del 2026-10-20

Sam pidió avanzar de forma continua y delegó en el Director las decisiones pendientes. Estas cinco son **decisión del Director, por la delegación de Sam del 2026-10-20**:

1. **El asiento sin tasa no se crea** y queda en «Por contabilizar». **El cobro en CNY exige tasa**, igual que en VES.
2. **Una rendición con un cobro sin tasa no se emite.**
3. **Dos PR:**
   - **0572-a:** la app (reglas A a G) y las pruebas;
   - **0572-b:** la migración de 0404 y 0411. Su número se le pide al Director al arrancarla.
4. **El nivel del cliente** cuenta las facturas en yuanes con su tasa.
5. **Las sumas multimoneda con «$» sin convertir** van en otra SDD, con destino «SDD de KPIs multimoneda» (ver *Fuera de alcance*).

## Contexto

- **Decisión 1 de Sam (2026-10-19):** el mayor va en USD, con USDT = USD 1:1. Los bolívares solo en reportes. Sin impuestos.
- **Decisión 2 de Sam:** lo que hay son datos de prueba; no se reparan datos históricos.
- **El Director (2026-10-20):** VES y CNY siempre con tasa, fallando cerrado. Nunca 0 ni el monto tal cual.
- **El mapa** se hizo el 2026-10-20 sobre la rama de la 0569 (`05331fa7`), en solo lectura. Las líneas son de esa versión.

## Qué cambia para Sam, pantalla por pantalla

Hoy cada pantalla convierte a dólares a su manera. Con esta SDD todas usan la misma regla:
- USD y USDT valen lo mismo;
- bolívares y yuanes se dividen por su tasa;
- **si no hay tasa, la pantalla lo dice («sin tasa») en lugar de inventar un número.**

| Pantalla | Qué se ve hoy | Qué se va a ver |
|---|---|---|
| **Reportes › Operativo** (Revenue, por ruta, por servicio) y el CSV | una factura en yuanes cuenta **0** | cuenta su monto en dólares; si no tiene tasa, aparece en «sin convertir» junto al total |
| **Reportes › Flujo de caja** (Facturado, Cobrado) | un cobro en yuanes cuenta **0** aquí, pero en Cobranzas cuenta | las dos pantallas dan lo mismo |
| **Reportes › Constructor de facturas** (Monto USD, Saldo USD) | yuanes en 0 | convertido, o «sin convertir» |
| **Costeo** (revenue, costo, margen) y **Reportes › Mixto** | un embarque facturado en yuanes sale **con margen negativo** | margen real; sin tasa, el embarque se marca «sin tasa» y no «en pérdida» |
| **Dashboard** (Margen sobre embarques, Ingresos del mes, Ticket promedio) | yuanes en 0 o en «sin convertir» | yuanes con tasa suman |
| **Contabilidad › Reportes** (Ingreso del período) y **Reportes › Estado de resultados** | yuanes siempre en «sin convertir» | yuanes con tasa suman |
| **Dirección** (CxC, CxP, vencido, posición neta) | **casi toda la CxP del socio China, en yuanes, suma 0** | la CxP en yuanes aparece; sin tasa, un contador «N sin tasa» |
| **Reportes › Antigüedad** (CxC y CxP) | yuanes en 0 | convertido, o «sin tasa» |
| **Financiero China** (aviso «$X pendiente») | una CxP en yuanes con tasa 7 cuenta **0** | cuenta su monto en dólares |
| **Cobranzas › Exportar** (columna saldo_usd) | yuanes en 0 | convertido, o celda vacía con «sin tasa» |
| **Cobranzas › Separación de fondos**, **Rendiciones** (al emitir) | un cobro en bolívares o yuanes **sin tasa se toma como si fueran dólares** | se excluye con un contador «N sin tasa», y la rendición no se emite hasta cargar la tasa (pregunta 2) |
| **Asientos de cobro, de CxP y de pago a proveedor** | sin tasa, se asienta el monto tal cual, como si fueran dólares | sin tasa, **no se asienta** y queda en «Por contabilizar» (pregunta 1) |
| **Contabilidad › Por contabilizar** (subdiario) | las CxP sin tasa van «al nominal» | van a «sin convertir» |
| **Móvil › Gastos hoy** | convierte con tasas fijas: 36 Bs y 7,18 ¥ | suma el monto en dólares que ya guardó cada gasto |
| **Mensaje de Telegram del CEO** («Gastos del día») | tasas fijas: 36,5 Bs y 7,18 ¥ | igual que el móvil |
| **Costeo › ver en bolívares** | usa la tasa de la última factura en bolívares, o 36,45 fija | usa la tasa vigente de Admin › Tasas; sin tasa, el botón de bolívares se apaga |
| **Fidelización, Reportes › Por cliente y por agente, CRM, Portal › Referidos** (nivel del cliente) | las facturas en yuanes no cuentan para el nivel | cuentan con su tasa (necesita migración, pregunta 4) |

**Además** (pregunta 5), varias pantallas suman montos de distintas monedas y los muestran con «$» sin convertir nada:
- Facturación (KPIs);
- Cobranzas («Por cobrar», «Vencido», «En promesa»);
- Tesorería («Por pagar», «Vencido», «Pagado del mes»);
- Dashboard («Por cobrar»);
- Dirección (pronóstico).

También el correo «Factura emitida» pone `{{total_usd}}` con el monto en bolívares o yuanes. Y el estado de cuenta de Financiero China cuenta los bolívares 1:1 como dólares.

## Lo que hay hoy (las 13 implementaciones)

| Regla | Dónde | Sin tasa | CNY | Reemplazo |
|---|---|---|---|---|
| **A** | `invoiceUsdAmount` (`lib/studio/fidelizacion/types.ts:283`), `balanceToUsd` (`payment-queries.ts:425`), `billBalanceToUsd` (`treasury/bill-queries.ts:209`) | 0 | 0 | `toUsd`; el que no convierte va a «sin convertir» |
| **B** | `receiptAmountUsd` (`accounting/receipt-posting.ts:75`), `billAmountUsd` (`bill-posting.ts:63`), `paymentAmountUsd` (`supplier-payment-posting.ts:63`) | el nominal | /tasa | `toUsd`; sin tasa, no asienta |
| **C** | `amountToUsd` (`partner-finance/types.ts:343`) | falla cerrado | /tasa (`RMB`) | `toUsd`; misma semántica |
| **D** | `toAmountUsd` (`expense-types.ts:255`) y la copia muerta `toUsd` de `lib/i18n/format.ts:102` | 0 (inalcanzable: el validador exige la tasa) | /tasa | `toUsd`; la copia muerta se borra |
| **E** | `convertToUsd` (`expense-queries.ts:77`, con 36 y 7,18) y `lib/news/ceo-brief.ts:129-140` (36,5 y 7,18) | — | /7,18 | sumar `expenses.amount_usd`, que ya se guarda con la tasa del gasto |
| **F** | `convertUsd` y `resolveDisplayRate` (`costing/types.ts:235`, `costing/ui.ts:34`), USD → Bs | 36,45 | — | `toUsd` no aplica (va al revés): la tasa vigente de `fx_rates` (`ultimaTasa`) o el selector apagado |
| **G** (encontrada) | `sumaEnUsd` del subdiario (`accounting/subdiario.ts:91`, :138): solo USD y USDT | — | sin convertir, incluso con tasa | `toUsd` |
| **SQL** | `get_portal_referral_program()` (`0404:28-33`) y `studio_client_annual_billing(date)` (`0411:102-109`, `:124-131`) | 0 | 0 | migración nueva (pregunta 4) |

**`to_usd` no se puede meter tal cual en un `sum()`:** una sola factura sin tasa haría fallar la RPC entera. La migración filtra antes las que no convierten y devuelve aparte cuántas quedaron fuera.

## Propuesta

1. **Un ayudante para sumar** en `lib/shared/fx.ts`: `sumarEnUsd(items)` devuelve `{ usd, sinConvertir }`, con la cuenta exacta de `toUsd`. Las pantallas de la regla A muestran el total y, si `sinConvertir > 0`, «N sin tasa», como ya lo hace Contabilidad › Reportes.
2. **Los asientos (regla B) sin tasa no se crean.** El documento queda sin asiento y lo detecta «Por contabilizar»; la 2.2 («asientos sin fallos silenciosos») le da la pantalla de «asentar pendientes». **El cobro en CNY exige tasa**, como ya la exige en VES (`payment-types.ts:546`); hoy se puede guardar sin ella.
3. **Rendiciones:** con un cobro sin tasa en el período, la emisión se bloquea con el mensaje «Falta la tasa de N cobros: cárgala antes de emitir».
4. **Regla E:** sumar `amount_usd`. La decisión 2 permite no reparar los gastos viejos con `amount_usd = amount` (backfill de la 0074).
5. **Regla F:** `deUsdABolivares(usd, tasa)` con la tasa de `ultimaTasa("VES")`; sin tasa, el selector de bolívares se apaga con «Sin tasa de bolívares en Admin › Tasas».
6. **El SQL (0404 y 0411):** una migración nueva, MIGRATE-FIRST, que usa `to_usd` solo en las facturas con tasa válida y devuelve también cuántas quedaron fuera. **Necesita número del Director.**
7. **Las pruebas que fijan lo de hoy se reescriben**, cada una citando la decisión 1. El mapa encontró estas:
   - el fixture `ingreso-fixture.ts` y su `ESPERADO`, compartidos por 7 archivos;
   - `fidelizacion/types.test.ts:258-274`;
   - `alerts.test.ts:101-113`;
   - `costing/queries.test.ts:89-96`;
   - `payment.test.ts:341-343`;
   - `treasury.test.ts:332-334`;
   - `libro-control.test.ts:364-396`, `:428-460` y `libro-control-queries.test.ts:610-630`;
   - `reports/types.test.ts:472-476`;
   - `costing/ui.test.ts:78-89` y `costing/types.test.ts:143-157`;
   - los contratos `0404_…test.sql` y `0411_…test.sql`.

## Qué NO cambia

- Las tasas de los documentos: siguen congeladas como dejó la 0569.
- El asiento de la venta (no convierte; es la 2.3 y el B2).
- La hora de Caracas (otra SDD).
- La carga automática del BCV.
- Los datos históricos (decisión 2).

## Fuera de alcance

- **SDD de KPIs multimoneda** (decisión 5): las sumas de varias monedas que se muestran con «$» sin convertir:
  - los KPIs de Facturación (`invoiceKpis`, que también alimenta «Por cobrar» y «Vencido» del flujo de caja);
  - Cobranzas («Por cobrar», «Vencido», «En promesa»);
  - Tesorería («Por pagar», «Vencido», «Pagado del mes»);
  - Dashboard («Por cobrar»);
  - Dirección (pronóstico);
  - el `{{total_usd}}` del correo «Factura emitida» (`invoice-mail-vars.ts:59`);
  - el `total_usd` del estado de cuenta de Financiero China (`ImportStatementDrawer.tsx:143-145`, que cuenta VES 1:1).

## Preguntas que se hicieron al Director (respondidas el 2026-10-20: ver *Decisiones*)

1. **Asiento sin tasa (regla B):** ¿no se crea y queda en «Por contabilizar», como propongo, o se rechaza el cobro, la CxP o el pago? Hoy las CxP nuevas ya exigen tasa (0569); los cobros en CNY no.
2. **Rendición con un cobro sin tasa:** ¿se bloquea la emisión, como propongo, o se emite excluyendo ese cobro, con aviso?
3. **¿Una PR o dos?** Propongo dos:
   - **0572-a:** la app (reglas A a G) y las pruebas;
   - **0572-b:** la migración de 0404 y 0411, con su número y su OK nominal de Sam.
   Así la parte sin migración no espera a producción.
4. **El nivel del cliente con facturas en yuanes:** ¿cuentan con su tasa (propuesta) o siguen fuera? Cambia el nivel y los «faltan $X» del portal.
5. **Las sumas sin conversión de varias monedas** (KPIs de Facturación, Cobranzas, Tesorería, Dashboard, Dirección, el `{{total_usd}}` del correo y el estado de cuenta de Financiero China): ¿entran en esta SDD o van en una aparte? Propongo una aparte: son otros 6 sitios con su propia lista de pantallas, y aquí ya hay muchas cifras que cambian.

## Implementación (0572-a)

Todas las conversiones pasan por `toUsd` (`lib/shared/fx.ts`) a través de dos ayudantes nuevos: `usdOrNull(monto, moneda, tasa)` (`null` sin tasa) y `sumarEnUsd(items)` (`{ usd, sinConvertir }`, en centavos).

| Regla | Qué quedó |
|---|---|
| **A** | `invoiceUsdAmount`, `balanceToUsd` y `billBalanceToUsd` devuelven `null` sin tasa. Reportes (resumen, rutas, servicios, flujo de caja, armador y antigüedad), Cobranzas, Tesorería, Dirección, Costing, Financiero China y el ingreso del período cuentan aparte las «sin tasa» y lo dicen. En Costing, un embarque con una factura sin tasa no es «rentable» ni «en pérdida»: dice «Sin tasa». |
| **B** | `receiptAmountUsd`, `billAmountUsd` y `paymentAmountUsd` devuelven `null` sin tasa. Los cinco asientos (cobro aplicado, sin identificar, reclasificación, CxP y pago) devuelven `{ ok: false, skipped: "missing-fx-rate" }` **antes** de buscar cuentas o insertar (decisión 1). El cobro sin identificar en CNY exige tasa. La separación de fondos cuenta `sinTasaCount`. La rendición: la previa marca la línea «sin tasa» (`RenditionPreviewLine`; la emitida, `RenditionLine`, siempre trae USD), el botón se apaga y `emitRenditionFor` rechaza (decisión 2). La regla también cuenta las **facturas locales** sin tasa del período, porque restan del saldo a favor de la Operadora. |
| **C** | `amountToUsd` de Financiero China usa `usdOrNull`: misma semántica, cuenta exacta. |
| **D** | `toAmountUsd` de gastos usa `usdOrNull` (`null` sin tasa) y el validador falla cerrado. Se borró la copia muerta `toUsd` de `lib/i18n/format.ts` y su reexportación. |
| **E** | «Gastos hoy» (`sumMyExpensesTodayUsd`) y el brief del CEO suman `expenses.amount_usd`; desaparecen 36, 36,5 y 7,18. |
| **F** | Costing toma la tasa de `ultimaTasa("VES")`; sin ella el selector de VES se apaga con «Sin tasa de bolívares en Admin › Tasas». Desaparecen `DEFAULT_VES_RATE` (36,45) y `latestVesFxRate`. |
| **G** | **Diferida a la 2.3.** El subdiario de clientes se cuadra contra el asiento de venta, que sigue al nominal (B2): convertir solo el subdiario abriría una diferencia falsa. |

**Subdiario de proveedores:** sigue sumando al nominal la CxP sin tasa (`billAmountUsd(...) ?? saldo`, con comentario). Desde la 0569 toda CxP nueva en otra moneda trae tasa; las sin tasa son históricas y se asentaron al nominal, así que el subdiario cuadra con su asiento.

**Pruebas reescritas**, cada una citando la decisión 1:
- el fixture compartido `ingreso-fixture.ts`: F6 (yuanes con tasa) ahora suma 1000 y entra F9 (yuanes sin tasa). `ESPERADO` pasa a 3000, 3 facturas, 2 sin convertir y 4 en otra moneda; se ajustan sus consumidores (Contabilidad, Reportes, Dirección, Dashboard y `reportes-tab`);
- `fidelizacion/types`, `alerts`, `costing/queries`, `costing/ui`, `payment` y `treasury`.

**Pruebas nuevas:**
- `accounting/__tests__/asiento-sin-tasa.test.ts`: los cinco asientos, sin tocar la base;
- `__tests__/gastos-y-pagos-en-usd-0572.test.ts`: reglas B, C, D y E;
- `EmitDrawer.sin-tasa.test.tsx`;
- casos nuevos en `renditions`, `emit-void` y `payment-receipts-0068`.

En el cierre parcial de Codex se agregaron cinco casos: mezcla USD/USDT/VES/CNY/RMB, suma exacta en centavos y distinción entre cero y falta de tasa, además del bloqueo por factura local sin tasa tanto en servidor como en el drawer. El typecheck detectó y permitió restaurar los tres formateadores de `lib/i18n/format.ts` que habían sido eliminados accidentalmente junto al conversor duplicado.

**Texto corregido:** el aviso del ingreso decía «en bolívares sin tasa o en yuanes»; ahora dice «en bolívares o yuanes sin tasa», porque un yuan con tasa ya suma. De paso se corrigió un voseo de Costing («Identificá»).

### Allowlist

```text
app/studio/(app)/contabilidad/__tests__/reportes-tab.test.tsx
app/studio/(app)/contabilidad/_components/IngresoDelPeriodoCard.tsx
app/studio/(app)/cobranzas/_components/CobranzasClient.tsx
app/studio/(app)/cobranzas/_components/CobranzasClient.sin-tasa.test.tsx
app/studio/(app)/costing/_components/CostingClient.tsx
app/studio/(app)/costing/_components/CostingClient.sin-tasa.test.tsx
app/studio/(app)/costing/page.tsx
app/studio/(app)/direccion/_components/FinanceHealthCard.tsx
app/studio/(app)/financiero-china/_components/PartnerAlertsBanner.tsx
app/studio/(app)/rendiciones/_components/EmitDrawer.sin-tasa.test.tsx
app/studio/(app)/rendiciones/_components/EmitDrawer.tsx
app/studio/(app)/reportes/_components/ReportesClient.tsx
app/studio/(app)/reportes/_components/ReportesClient.sin-tasa.test.tsx
app/studio/(app)/reportes/_components/BuilderView.tsx
app/studio/(app)/reportes/_components/BuilderView.sin-tasa.test.tsx
app/studio/(app)/tesoreria/_components/TesoreriaClient.cxp-saldada.test.tsx
docs/specs/0572-conversor-usd-reemplazos/spec.md
docs/specs/README.md
.agents/handoffs/0572-conversor-usd-reemplazos.md
lib/i18n/format.ts
lib/i18n/index.ts
lib/news/ceo-brief.ts
lib/shared/fx.ts
lib/studio/__tests__/gastos-y-pagos-en-usd-0572.test.ts
lib/studio/__tests__/payment-receipts-0068.test.ts
lib/studio/__tests__/payment.test.ts
lib/studio/accounting/__tests__/asiento-sin-tasa.test.ts
lib/studio/accounting/__tests__/ingreso-fixture.ts
lib/studio/accounting/__tests__/ingreso-periodo.test.ts
lib/studio/accounting/bill-posting.ts
lib/studio/accounting/ingreso-periodo.ts
lib/studio/accounting/receipt-posting.ts
lib/studio/accounting/subdiario.ts
lib/studio/accounting/supplier-payment-posting.ts
lib/studio/costing/__tests__/queries.test.ts
lib/studio/costing/__tests__/ui.test.ts
lib/studio/costing/queries.ts
lib/studio/costing/ui.ts
lib/studio/dashboard/__tests__/dashboard-kpi-queries.test.ts
lib/studio/direccion/__tests__/queries.test.ts
lib/studio/direccion/queries.ts
lib/studio/expense-queries.ts
lib/studio/expense-types.ts
lib/studio/fidelizacion/__tests__/types.test.ts
lib/studio/fidelizacion/types.ts
lib/studio/partner-finance/__tests__/alerts.test.ts
lib/studio/partner-finance/alerts-queries.ts
lib/studio/partner-finance/types.ts
lib/studio/payment-queries.ts
lib/studio/payment-types.ts
lib/studio/renditions/__tests__/emit-void.test.ts
lib/studio/renditions/__tests__/renditions.test.ts
lib/studio/renditions/actions-helpers.ts
lib/studio/renditions/queries.ts
lib/studio/renditions/types.ts
lib/studio/reports/__tests__/queries.test.ts
lib/studio/reports/__tests__/export-csv.test.ts
lib/studio/reports/__tests__/builder.test.ts
lib/studio/reports/builder-types.ts
lib/studio/reports/export-csv.ts
lib/studio/reports/queries.ts
lib/studio/reports/types.ts
lib/studio/treasury/__tests__/treasury.test.ts
lib/studio/treasury/bill-queries.ts
scripts/__tests__/invoice-read-boundary.test.mjs
```

`docs/specs/README.md` se incorporó a la allowlist por autorización acotada del Director el 2026-10-20: es el índice generado necesario para reflejar el estado de esta spec, sin ampliar el alcance de producto.

En el mismo cierre, el Director autorizó sumar únicamente `TesoreriaClient.cxp-saldada.test.tsx` y `reports/__tests__/export-csv.test.ts` para completar sus fixtures con `cxpSinTasa: 0` y `sinTasa: 0`. El typecheck detectó esos consumidores; se conservan sus aserciones y los contadores siguen siendo obligatorios.

### Lo que queda abierto

- **Cobro aplicado a una factura sin tasa:** el cobro hereda la moneda y la tasa de la factura (RPC 0467). Si la factura no la tiene, el cobro se guarda pero no se asienta y queda en «Por contabilizar». La pantalla de «asentar pendientes» es de la 2.2.
- **«Gastos hoy»** calcula «hoy» con la hora del servidor (`setHours(0, 0, 0, 0)`), no la de Caracas. Va en la SDD de la hora de Caracas.
- **0572-b:** el SQL de 0404 y 0411, con su número del Director y el OK nominal de Sam.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | cumplimiento | SDD aprobada + allowlist exacta (arriba) |
| Producción | no aplica a la 0572-a | la 0572-a no tiene migración; la 0572-b sí |
| ERR-01 | cumplimiento | cada «sin tasa» dice dónde cargarla («Contabilidad › Tasas de cambio», «Admin › Tasas») o qué falta para emitir |
| Contrato Director / SGE-00.07 / NUM-01 | cumplimiento local revisado; cobertura canónica incompleta | F1–F6 reparados y revisados sobre4dbd: subtotal conocido + contador; diferencia total null; cero válido distinto de importe desconocido; CSV y consumidores conservan estado |
| DAT-01 | no aplica al delta de fechas/rangos | no se modifica selección de fechas, rango ni Caracas; DAT-01 no gobierna completitud financiera |
| VIS-01 / VIS-02 / CMP-01 | cumplimiento en el diff | componentes y tokens existentes; incompleto neutral, sin color de rentabilidad; ranking desplazable en ancho reducido |
| A11Y-01 | cumplimiento parcial observado | estado textual junto al número, selector rotulado, VES deshabilitado sin tasa; fixture claro/oscuro y ancho390. Auditoría integral y dispositivo real NO EJECUTADOS |

## Validación

### Cierre de corrida canónica sobre 4dbdb21b · 2026-10-20

`corepack pnpm verify` finalizó exit 0: **CIERRE INCOMPLETO — 14/17 controles
medidos; críticos sin medir migrations-applied, sql-tests y schema-rebuild**.
Inicio 23:10:17Z, fin 23:37:18Z, 1621.265s. El handoff registra los 17 controles
individuales y los recibos externos; no se infiere cobertura de exit0.

- **PASÓ:** harness 237/237, lint 0 errores/15 warnings generales previos, RSC,
  tipos, 4 edge, unitarios 12378/1 omitida en 868 archivos (867 aprobados), docs 557,
  numbering, 6 feature-constants, 5 fuentes CMP, 28 políticas y símbolos pendientes
  (0 rojo/1 amarillo 0495/3 homónimos).
- **PASÓ con aviso según runner:** E2E 177 aprobados, 1 flaky, 20 omitidos, 10.3min;
  error inicial de navegación con token ficticio aprobado al reintentar y
  cierre forzado de worker tras 300000ms. Se aplicó la regla heredada sin
  alterarla; no venció watchdog. JSONoriginal NO DISPONIBLE porque el runner
  lo elimina al iniciar build; log y dictamen emitido sí conservados. No se
  atribuye causa WebKit solo por el texto del mensaje.
- **PASÓ build:** compile 27.4s, TypeScript 108s, 162 páginas en 1.128s, tsconfig restaurado.
- **NO EJECUTADO:** ledger por credenciales ausentes (release); SQL/rebuild por
  Docker NO DISPONIBLE. La omisión unitaria es corpus real no configurado;
  E2E omite 18 casos de credenciales/seed y 2 capturas exclusivas de Chromium.
- **PASÓ limpieza:** árbol 4dbd limpio y cero procesos/listeners propios a 23:38:13Z.
  Revisión independiente de 4dbd sin hallazgos nuevos, condicionada a cobertura.

Knowledge: inspección de solo lectura finalizada exit 0 pero **ok=false**;
Graphify 0.9.61 INVALID por grafo ausente, piloto 0/16 y global 0/1324; Archify 2.16.0
NO DISPONIBLE (runtime ausente), Obsidian PENDING, preview nueva NO EJECUTADA.
No regeneración ni publicación; turno devuelto a 23:41:30Z con procesos cero.
El cierre documental posterior conserva runtime/pruebas idénticos a 4dbd.
La PR permanece en borrador; cobertura pendiente, CI y base 0573 se coordinan
antes de integrar. No SQL nuevo, merge, despliegue ni datos reales.

### Ajuste visual posterior al checkpoint 3c36 · 2026-10-20

El Director aprobó, después de reproducir el recorte a 390 px, un delta mínimo
en ReportesClient y BuilderView: contenedor horizontal accesible, ancho mínimo
coherente para tablas de rentabilidad/CBM/Constructor y corrección del pie
visible CNY → 0. No cambia agregación, catálogo, cifras, acciones ni estructura
de vistas. Solo esos dos TSX y documentos propios cambian en este checkpoint.

UI sintética **PASÓ en el alcance observado** con componentes y agregadores
reales: incompletitud parcial/solo desconocido/cero, Mixto preservando costo
por CBM, Aging CxC sola/CxP sola/ambas y vacío real, cashflow y fondos. Claro y
oscuro, escritorio y contenedor390: contenido358/358 sin desborde de página;
regiones356 con desplazamiento hasta últimas columnas. No es prueba de móvil
real ni Studio autenticado. Capturas `revision-ui-*` y medidas externas
`revision-ui-measurements.json`; servidor propio/tab cerrados a23:06Z.

Focal final de tres componentes **PASÓ 18/18 sin SKIPs**, exit0; tipos **PASÓ**,
exit0; ESLint de ambos TSX **PASÓ**, exit0 sin advertencias. El handoff conserva
los recibos efectivos y los límites visuales. Los
751 casos y43mutantes del checkpoint3c36 no se repiten por este delta de
disposición/texto aprobado. Verify y revisión nueva siguen pendientes hasta
fijar la nueva cabeza. No se modifica SQL ni la dependencia0569.

### Reparación F1–F6 sobre 220a · checkpoint local 2026-10-20

Allowlist 65, turno pesado concedido a las 22:43:12Z. El ROJO sobre producto 220a
reprodujo 43 fallos/184; cuatro negativos UI se repitieron con selector preciso
(14 fallos funcionales/1 PASÓ en esas dos suites), antes de reparar producto.
VERDE 184/184 y focal ampliado 35 archivos/751 PASÓ, sin SKIPs. Además se reprodujo
el total CBM 0.3579 frente al 0.36 histórico y se conservó round2 global.

F1 une el contador propio por FK con solo-code sin duplicar ni reasignar un FK
ajeno; subtotal revenue histórico no cambia. F2 propaga el contador a cliente
y CBM de Mixto, conserva costo/CBM y omite márgenes definitivos. F3/F4 preservan
Aging solo excluidas y sus CSV; rutas/servicios/cashflow exportan estado y
contador (mensual para cashflow). F5 conserva null/subtotal/completitud por
métrica, grupo y total, sin invalidar count/CBM. F6 muestra incompletitud de
fondos y cuenta sin identificar independientemente del FX.

Mutantes nuevos 22/22 detectados entre corrida inicial 21/22 y suplemento único
de Aging 11 con la suite que contiene sus tres casos solo excluidas. Los 21
mutantes originales también se detectaron; todas las fuentes se restauraron
por SHA256. Tipos PASÓ. Alcance 65 y diff-check completo contra d410 PASÓ.
ESLint de 61 archivos PASÓ sin advertencias; la espera del efecto de Builder
en pruebas pasó 4/4 sin avisos React. Fixture F1–F6, verify y revisión nueva permanecen pendientes en este
checkpoint. Recibos `revision-*` en la carpeta externa de validación; el
handoff conserva cada corrida, selección corregida y límite de cobertura.

### Retoma después de #301 · 2026-10-20

Base `2df9d22dbcff3fbf77056b434494450faf33b88f` (merge 9c254107 + d410ab2e).
Primero se escribieron las regresiones y después se corrigió producto.

| Comprobación | Resultado |
|---|---|
| ROJO sobre base sin reparar | FALLÓ esperado: 23 aserciones funcionales / 179 PASÓ; 8 archivos, cero errores de harness/import/mock |
| VERDE focal | PASÓ: 202/202, sin SKIPs |
| Focal ampliado y contratos heredados 0569 | PASÓ: 632/632 en 29 archivos, sin SKIPs |
| Mutantes de app | PASÓ: 21/21 detectados por aserciones y fuentes restauradas por SHA256 |
| typecheck / lint | PASÓ: exit 0; ESLint 55 archivos, cero warnings |
| Último ajuste de scroll | PASÓ: 6/6 pruebas existentes del componente y lint puntual |
| Fixture real Costing + ingreso | PASÓ alcance sintético: parcial positivo/negativo, B3, mixto, cero, claro/oscuro, contenedor390 con desplazamiento. Studio real/dispositivo/a11y integral NO EJECUTADOS |
| verify sobre220a2c3e | INTERRUMPIDO/INCOMPLETO por Director a22:25Z: harness237, lint, rsc, tipos y edge PASÓ; dos asserts unitarios fallaron. La suite no terminó; build/E2E/gates posteriores NO EJECUTADOS |
| Conocimiento | status terminó pero ok=false; estructura INVALID, semántica 0/16 y 0/1324, Archify/Obsidian PENDING; preview interrumpida, no completada |

Logs, mutantes, fixtures y capturas fuera de Git en
`C:/tmp/director-traspaso-20261020/0572-codex-validation/retoma-*`.
El handoff detalla límites, incidente de inspección duplicada y autorización
del Director para diferir reconstrucción de derivados hasta la base 0573.
No se alteró SQL ni la captura/procedencia/CAS/aviso persistido de 0569.
El subtotal y margen aritmético interno de Costing conservan su tipo numérico;
`sinTasa` califica completitud, y UI/CSV no los presentan como margen definitivo.

El pendiente `topAndWorst` se reprodujo y quedó reparado: incompletos positivos
y negativos fuera de top/peores, cuatro órdenes estables con completos primero,
margen pendiente, propagación a totales/rutas y CSV. T9 ya preservaba paginación
y deduplicación por fila; se completó la proyección del contador por ruta.
T10 ya rechazaba lecturas incompletas/erróneas: se conserva esa regresión.

### Cierre parcial anterior · evidencia histórica

| Comprobación | Resultado |
|---|---|
| Pruebas puntuales, un archivo a la vez (sin turno de máquina) | PASÓ: los 31 archivos tocados o que leen el fixture |
| Pruebas focales del cierre Codex | PASÓ: 6 archivos, 71 pruebas sobre las reparaciones y los cinco casos adicionales |
| `corepack pnpm typecheck` | FALLÓ inicialmente; PASÓ después de restaurar formatos y completar fixtures con contadores obligatorios |
| eslint del diff | PASÓ: 52 archivos, cero errores; la única advertencia propia se corrigió y el lint puntual posterior pasó sin advertencias |
| `pnpm verify` | NO EJECUTADO: diferido por el Director hasta recibir la corrección de la dependencia #301 |
| Mutantes de app | NO EJECUTADO: diferidos por la misma dependencia |
| Revisión visual con navegador/fixtures | NO EJECUTADO en este cierre parcial |

En ese cierre anterior quedó pendiente comprobar `topAndWorst` con ingreso
parcial. La retoma posterior de esta sección registra su reproducción y reparación.

## 0572-b · Transición compatible de agregados anuales · asignación 2026-10-20

**IMPLEMENTACIÓN LOCAL COMPLETA; cierre canónico y revisión financiera pendientes.** Base a30d8585, rama
`codex/sdd-0572-conversor-usd-sql`, worktree aislado propio. El Director aprobó
la alternativa A y asignó `0498_annual_billing_fx_v2` tras inventario. El handoff
propio es `.agents/handoffs/0572-conversor-usd-sql.md`; conserva el contrato
completo. No se modifica el handoff de a ni sus migraciones aplicadas.

- Portal conserva firma, identidad, propietario, ACL y campos legados; añade
  `billing_v2`. Studio v1 permanece idéntica y añade RPC tabular
  `studio_client_annual_billing_v2(p_as_of date)` sin tenant/cliente de entrada.
- Decimal exacto con dos decimales como string, contador seguro y estado
  `completo`/`sin_tasa`/`datos_invalidos`. Lectura `no_disponible` separada de
  falta de tasa y ausencia de principal. Cero y signo se conservan.
- Clasificador privado vigente: `annual_billing_private.convertir_factura_anual_usd(numeric,text,numeric)`.
  INVOKER, IMMUTABLE, search_path vacío, sin USAGE/EXECUTE para roles API.
  Invoca `public.to_usd`; captura solo SQLSTATE 22023 + hint dtd-fx + mensajes
  FX_AMOUNT_INVALID/FX_RATE_MISSING/FX_CURRENCY_UNKNOWN; relanza todo lo demás.
  No duplica conversión, no usa catálogo ni altera `lib/shared/fx.ts`.
- Suma redondeada por factura, filtros/ventanas y permisos de cada fachada
  preservados. Studio no usa HAVING positivo; paginación hasta vacío, mismo
  p_as_of, claves repetidas/error/tope rechazan. Sin garantía de snapshot entre
  peticiones. Portal y Studio mantienen sus diferencias temporales existentes.
- Subtotal/contador/estado hasta Portal, Fidelización, Reportes/CSV y CRM.
  Lectura de Fidelización compartida; nivel/progreso parcial Por revisar.
  Error de facturación o cruce CRM incompleto no se vuelve Map/objeto vacío
  exitoso ni oculta datos no financieros. Cliente convertido no usa precio
  Kommo como sustituto. Contadores por markbox sin multiplicarlos por lead;
  atribución histórica de ingreso por lead se conserva, sin certificar KPI global.
- Rollout MIGRATE-FIRST y compatibilidad DB nueva/app antigua; app nueva con
  DB/caché anterior muestra no disponible. Retiro futuro de v1 es deuda
  explícita, sin afirmar reemplazo universal de conversiones legadas.
- Riesgo R3: SGE-00 (12 principios), NUM-01, ERR-01 y políticas aplicables se
  contrastan con pruebas/UI, no con el resultado aislado de validadores.
- Validación autorizada serial: rojos funcionales, SQL PostgreSQL17, PGlite,
  PostgREST14.17 local con JWT sintéticos, paginación >1000/límite500, mutantes,
  tipos/lint, UI real con fixtures y verify. Preservar JSON E2E antes de build.
- 0495 ya aplicada por Director; baseline solo agrega espera0498. No DB real,
  secretos, merge, deploy, 2.3/G, BCV/Caracas, cambios históricos ni KPI global.
  PR propia en borrador apilada sobre #310, con integración final coordinada.

### Allowlist exclusiva de b — 41 rutas aprobadas

Checkpoint SQL 2026-10-21 00:50 UTC: implementación de0498 y contrato PGlite
PASÓ17/17, sinSKIPs (contrato, control sin expansión,3preflights,12mutantes).
PostgreSQL/HTTP y cierre general permanecen NO EJECUTADOS en este checkpoint;
evidencia externa y límites de identidad/carga en el handoff propio de b.
La carga1201 prueba materialización sin clasificación repetida por agregado.
No atribuir este verde a la app todavía sin commit ni a producción.

Suplemento00:58UTC: contrato PostgreSQL17.11 PASÓ37aserciones/ROLLBACK;
HTTP14.17 PASÓ transición antes/DDL/COMMIT/recarga caliente/después, legado,
aislamiento y paginación1202grupos500/500/202/0. Migración idéntica a f9cc1dd.
El contrato de zona fija p_as_of al cambiar timezone y demuestra su guarda
con mutante; PGlite18/18 (13mutantes) incluido en focal247/247sinSKIPs.
Arnés durable permite --http-only para suplementos sin repetir contratoSQL.
Limitaciones de identidad sintética y recibos crudosStartedAt en handoff;
tipos/lint/visual/verify y revisión financiera todavía pendientes en ese checkpoint.

Checkpoint aplicación01:16UTC: DTO exacto y todos los consumidores de b
implementados. Focal247/247; suplemento de disposición28/28 y casos UI nuevos
20/20, todos sinSKIPs (corridas solapadas, no total único). Mutantes app13/13
detectados al cerrar suplemento: primera medición10/13, dos regresiones UI
faltantes y un foco RSC corregido; todos los archivos restaurados por hash.
UI sintética real390/1280 y claro/oscuro conserva importes grandes completos,
subtotal/contador/estado; tablas consultables por Tab/flechas. Evidencia y
limitaciones en handoff b. No certifica Studio autenticado ni producción.
Tipos PASÓ y correcciones propias de lint PASÓ; dos advertencias de reloj CRM
idénticas a a30 permanecen fuera del delta. Gate de símbolos detectó homónimos
del nombre privado convertir en textos UI, sin llamadas reales al helper;
resolución propuesta y evidencia en handoff. Cierre canónico aún no ejecutado.

Decisión Director01:20UTC: renombrar únicamente el helper privado de0498 aún
no aplicada a convertir_factura_anual_usd para evitar el homónimo textual del
detector. Se conservan esquema/cuerpo/ACL/API; se actualizan las cuatro rutas
SQL/contratos/arnés y se exige suplemento PGlite/mutantes/PostgreSQL/HTTP y
revisión SQL por el nuevo blob. Los recibos f9/3b permanecen históricos, sin
atribuirse por hash al nuevo nombre. App congelada en a734aa61 para revisión.

### Gobernanza de b · clasificación y evidencia por principio

| Norma | Clasificación del delta | Evidencia/límite |
|---|---|---|
| SGE-00.01 predictibilidad | Cumplimiento | Lecturas y CSV conservan significado; subtotal parcial distinto de total completo. |
| SGE-00.02 conservación | No aplica a escritura | No nuevos editores ni mutaciones; se mantienen datos no financieros cuando falla facturación. |
| SGE-00.03 riesgo/fricción | Cumplimiento de alcance R3 | Sin confirmaciones nuevas de lectura; migración/publicación requieren aprobación nominal separada. |
| SGE-00.04 auditoría | No aplica a eventos de negocio | No DML de negocio; DDL/pruebas/SHAs y recibos durables, no se confunde toast con auditoría. |
| SGE-00.05 aislamiento | Cumplimiento local | SQL37 y HTTP sintético prueban ACL, tenants, ambiguo0453, disabled y OR con overridesfalse; no equivalencia Auth productivo. |
| SGE-00.06 prevención | Cumplimiento | Decodificador cerrado, decimal exacto, errores/cap/duplicados rechazan; tests y mutantes. |
| SGE-00.07 estado verdadero | Cumplimiento local | DTO y UI separan completo/sin tasa/inválido/no disponible; cero conocido conserva0, nunca precio Kommo para ERP desconocido. |
| SGE-00.08 recorrido | Cumplimiento | Mismas páginas y acciones; Fidelización comparte lectura en listado/distribución, sin pasos agregados. |
| SGE-00.09 reutilización | Cumplimiento | KpiCard/Badge/Progress/Avatar/tokens existentes; helper compartido de dinero, sin nueva primitiva global. |
| SGE-00.10 accesibilidad | Parcial; aceptación integral pendiente | Teclado/foco/regiones y390/1280/light-dark/reduced-motion medidos. CSSzoom2 no sustituye zoom nativo200%; lector de pantalla/WCAG integral NO EJECUTADOS. |
| SGE-00.11 lenguaje | Cumplimiento local | Subtotal parcial, contador, Por revisar y no disponible son texto visible; error Portal explica reintento; no depende del color. |
| SGE-00.12 autoridad | Cumplimiento | Solo entorno sintético y PR borrador autorizados; ninguna aplicación/merge/deploy real. |
| NUM-01 / ERR-01 | Cumplimiento local | Céntimos/string canónicos, signo/0/grande, null vacío en CSV, diagnóstico sanitizado y error distinto de sin tasa. |
| VIS-01 / CMP-01 | Cumplimiento acotado | Componentes y tokens DTD, cambios mínimos de wrap/scroll en sus consumidores, sin rediseño. |
| A11Y-01 | Parcial, no excepción aprobada | Límites de SGE-00.10 explícitos; recorte preexistente de recompensa Portal fuera del delta con reproducción a30. |

No se atribuye DAT-01 a completitud financiera ni se cambia la política de
fechas: ventanas temporales existentes preservadas por contrato SQL. Deuda
compatible: mantener v1/legado hasta retiro aprobado; atribución por lead no
equivale a facturación única del tenant. Previa/paquete/OK nominal, caché y
rollback compatible descritos en handoff propio; release NO EJECUTADO.

Suplemento del identificador privado (21oct01:24UTC):0498 usa
`annual_billing_private.convertir_factura_anual_usd`, sin cambio de fórmula,
cuerpo ni ACL/API. Sobre blob `5b302b5cad00529fcc5731aa570fd620794c4689`
pasaron PGlite18/18 (13mutantes), PostgreSQL37aserciones y HTTP real con
recarga en caliente en el mismo PostgREST14.17. Gate de símbolos pendientes
PASÓ sin modificar el detector. Recibos y límites en el handoff de b;
revisión del nuevo blob y verify siguen pendientes.

Precisión Director para el P2 de CRM: disponibilidad del cruce de identidad
y de la métrica anual son estados distintos. Si el cruce completo confirma
un lead no convertido, la falla anual no debe ocultar su nominal CRM ni la
cabecera nominal. Si está convertido, o el cruce no está disponible, no se
reemplaza un ERP desconocido por nominal. Requiere regresiones reales de
lector, transporte RSC y ambos consumidores antes de certificar el cierre.

```text
supabase/migrations/0498_annual_billing_fx_v2.sql
supabase/tests/0498_annual_billing_fx_v2.test.sql
supabase/migrations-baseline.json
supabase/pending-migration-symbol-declarations.json
lib/studio/__tests__/annual-billing-fx-v2.migration.test.ts
scripts/tests/annual-billing-fx-v2-postgrest.mjs
lib/shared/annual-billing.ts
lib/shared/__tests__/annual-billing.test.ts
lib/portal/portal-referral-queries.ts
lib/portal/__tests__/portal-referral-query.test.ts
lib/portal/__tests__/referrals.test.ts
app/portal/(app)/referidos/page.tsx
app/portal/(app)/referidos/__tests__/page.test.tsx
lib/studio/fidelizacion/queries.ts
lib/studio/fidelizacion/__tests__/queries.test.ts
lib/studio/__tests__/listados-sin-eliminados.test.ts
app/studio/(app)/fidelizacion/page.tsx
app/studio/(app)/fidelizacion/_components/FidelizacionClient.tsx
app/studio/(app)/fidelizacion/_components/FidelizacionClient.annual-billing.test.tsx
app/studio/(app)/fidelizacion/__tests__/annual-billing-page.test.tsx
lib/studio/reports/queries.ts
lib/studio/reports/types.ts
lib/studio/reports/__tests__/queries.test.ts
lib/studio/reports/export-csv.ts
lib/studio/reports/__tests__/export-csv.test.ts
app/studio/(app)/reportes/_components/ReportesClient.tsx
app/studio/(app)/reportes/_components/ReportesClient.annual-billing.test.tsx
lib/studio/kommo-analytics.ts
lib/studio/__tests__/kommo-analytics.test.ts
lib/studio/__tests__/kommo-analytics-paging.test.ts
app/studio/(app)/crm/page.tsx
app/studio/(app)/crm/_components/KommoClient.tsx
app/studio/(app)/crm/_components/KommoBoardView.tsx
app/studio/(app)/crm/_components/DireccionTab.tsx
app/studio/(app)/crm/_components/KommoClient.annual-billing.test.tsx
app/studio/(app)/crm/_components/KommoBoardView.annual-billing.test.tsx
app/studio/(app)/crm/_components/DireccionTab.annual-billing.test.tsx
app/studio/(app)/crm/__tests__/annual-billing-page.test.tsx
docs/specs/0572-conversor-usd-reemplazos/spec.md
docs/specs/README.md
.agents/handoffs/0572-conversor-usd-sql.md
```
