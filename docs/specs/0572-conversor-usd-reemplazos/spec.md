---
sdd: "0572"
title: "Los 13 conversores a USD pasan a uno solo, que falla cerrado"
status: draft
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

**Estado: DISEÑO APROBADO por el Director el 2026-10-20** (sobre `da23a77f`), con las cinco propuestas. No hay código todavía: la 0572-a arranca cuando la SDD-0569 esté en main, porque usa `toUsd`.

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

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | por cumplir | la allowlist exacta va con la implementación |
| Producción | por cumplir | la migración de 0404 y 0411 con el OK nominal de Sam y el runbook |
| ERR-01 | por cumplir | «sin tasa» y «sin convertir» con un mensaje que dice qué hacer |

## Validación

Pendiente.
