---
sdd: "0557"
title: "Reportes contables sin migración: una cifra de ingreso, comprobación, diario completo y cuadre del libro"
status: in-progress
author: "founder"
created: 2026-10-18
updated: 2026-10-19
supersedes: null
superseded_by: null
related: ["0040", "0041", "0044", "0048", "0052", "0114", "0465", "0494", "0556", "0558", "0559"]
confidencialidad: interno
---

# SDD-0557 — Reportes contables sin migración

> La contadora y Sam ven la misma cifra de ingreso en Contabilidad, Dirección, Reportes y el Dashboard. Sacan el balance de comprobación y el diario completo en CSV, y ven qué documentos no llegaron al mayor y cuánto se separa el mayor de las facturas y las CxP.

## Contexto

Diagnóstico contable del 2026-10-18 (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`, fase 1, tarea 1.4, B17; anexo A, área Reportes, H02, H04 y H07).

1. **Cuatro cifras de ingreso.**
   - Contabilidad: el mayor acumulado sin fecha (`contabilidad/page.tsx`, `ReportesTab.tsx`).
   - Dirección: el mayor del mes en curso (`lib/studio/direccion/queries.ts`).
   - Reportes: el mayor del período elegido (`lib/studio/reports/queries.ts`, `incomeStatement`).
   - Dashboard: `total_amount` crudo, con IVA y sin convertir moneda, por `issued_at ?? created_at` y mes local (`lib/studio/dashboard/dashboard-kpi-queries.ts`).
2. **El diario cortaba en 500 asientos y no lo decía.** `listEntries` tiene `.limit(500)`; la pantalla presentaba ese número como el total y contaba los asentados sobre esos mismos 500. No había exportación.
3. **No había balance de comprobación**, ni lista de documentos sin asiento, ni cuadre del subdiario contra el mayor.
4. **«Cashflow» era en realidad facturado contra cobrado.** Así lo define la SDD-0052, y el Norte lo rotula «Facturado vs cobrado» (`docs/design/studio/_norte/erp/modules/reports.jsx`).

La radiografía 1.1 del Director (solo conteos) encontró 0 asientos vivos y 5 de 5 facturas emitidas, parciales o pagadas sin asiento. Hoy, una cifra de ingreso sacada del mayor da 0.

## Decisión: la cifra oficial de ingreso

**Cifra oficial (gestión):** el ingreso facturado del período. Es la suma de la base imponible (sin IVA) en USD de las facturas no borradas en `emitida | parcial | pagada | vencida`, con `issued_at` en [desde, hasta], los dos extremos inclusive.

- Conversión vigente, `invoiceUsdAmount`: USD y USDT 1:1; VES entre la tasa de la factura. **VES sin tasa y CNY no suman**: se cuentan aparte como «sin convertir».
- Vive en una función pura, `resumirIngreso` (`lib/studio/accounting/ingreso-periodo.ts`). La regla vuelve a filtrar borradas (`deleted_at` viaja en la fila), estado y fecha en memoria: es una sola aunque un lector traiga de más.
- **Desglose propio contra terceros** por `fund_class` (0122_recibos_cobranza.sql): `local_revenue` es propio, cualquier otro valor es de terceros (el default de la columna). La cifra **incluye** los fondos de terceros, igual que el mayor, y cada pantalla lo dice cuando los hay. Si son ingreso propio es la decisión 10 (B10) y no se toma acá: el día que se tome, se cambia un filtro, no la tubería.

**El mayor queda como control, contra las líneas de la cuenta 4.5 de los asientos de factura** (`SALES_INCOME_CODE`, la que acredita el asiento de cada factura; `source = 'invoice'`, asentados y vivos, con `entry_date` en el rango), no contra todas las cuentas 4 ni contra toda la 4.5. Lo demás que el mayor tiene en ingresos son «otros ingresos del mayor»: el 4.6 (spread del Socio China), los asientos manuales (también los que van a la propia 4.5) y cualquier otro origen. Se muestran aparte y no cuentan como diferencia. Lo calculan `saldosDeFacturas` y `controlDelPeriodo` (`libro-control-queries.ts`) y `controlDelMayor` (puro). Estado, borrado y origen van en SQL y se repiten en memoria; el rango de fechas va solo en SQL, como en `accountBalances`. El estado de resultados y el balance siguen saliendo del mayor completo, porque tienen que cuadrar por partida doble.

### Estados del control contra 4.5

`describirIngreso` da un estado, y las cuatro salidas del control (Contabilidad › Reportes, Reportes › Estado de resultados, Dirección y el CSV del P&L) dicen lo mismo. Los estados se evalúan en este orden, y el primero que se cumple gana:

| # | Estado | Cuándo | Diferencia | Pantalla |
|---|---|---|---|---|
| 1 | Sin cuenta 4.5 | el plan no tiene 4.5 | null | aviso |
| 2 | **El mayor tiene menos (mayor vacío, B3)** | las líneas de 4.5 de los asientos de factura no tienen debe ni haber en el rango, y hay facturado o facturas sin convertir. **Gana sobre «no comparable»**: cero no mezcla monedas, así que vale aunque haya facturas en VES o CNY (hoy, 5 de 5 facturas emitidas sin asiento) | todo lo facturado | aviso y enlace a Por contabilizar: «El mayor (cuenta 4.5) tiene $X menos que lo facturado: no tiene ningún asiento de factura en el período.» |
| 3 | **Sin movimiento** | sin facturas que sumen, sin facturas sin convertir y sin debe ni haber de asientos de factura en 4.5 | 0 | neutro, sin ícono de éxito: un 0 contra 0 no es una verificación |
| 4 | **No comparable** | 4.5 **tiene** asientos de factura en el rango y alguna factura no borrador del período en VES o CNY (también anuladas, convertidas o no) **tiene su asiento `invoice` vivo** en el rango: regla E1 de la SDD-0559 con la decisión 7 del Director | null | neutro, sin enlace: esas facturas se asientan en 4.5 por el nominal en bolívares o yuanes (B2); la comparación vuelve cuando el asiento de venta se registre en USD (fase 2 del plan de trabajo de contabilidad). El saldo de 4.5 se lee «nominal mixto (no USD)», no en dólares. Una VES o CNY **sin** asiento no cuenta: ya está en «sin asiento» (B3) |
| 5 | Cuadra | facturado = 4.5 de facturas | 0 | ícono de éxito |
| 5 | El mayor tiene menos / más | facturado ≠ 4.5 de facturas | facturado − 4.5 | aviso y enlace a Por contabilizar |

**Qué facturas cuentan en «no comparable».** `enOtraMoneda` cuenta las facturas no borrador del período en VES o CNY cuyo id está entre las facturas de los asientos de factura vivos del rango. Ese conjunto sale de la MISMA lectura de `saldosDeFacturas` que arma el saldo de 4.5 (`journal_entries.invoice_id`, asentado, sin borrar, `source = 'invoice'`), sin otra consulta, y viaja en `ControlDelMayor.facturasConAsiento`. Las facturas no tienen `journal_entry_id`, así que el vínculo solo existe de ese lado. Sin control del mayor (el Dashboard) `enOtraMoneda` es 0, porque no se leyeron los asientos. El CSV del P&L rotula la fila «Facturas del período en bolívares o yuanes con asiento de factura (cantidad)».

### Decisiones del Director (2026-10-19)

Las preguntas abiertas 6 y 7 de la versión anterior de esta spec las respondió el Director, con criterio técnico. Son **decisión del Director, 2026-10-19, revisable por Sam**. Texto literal:

> **6. Sí:** el mayor vacío también gana en el subdiario de clientes (regla E1 de la 0559). Con un mismo dato, Reportes y «Por contabilizar» tienen que decir lo mismo. Cuando 1.1.2 no tiene movimiento vivo, la comparación muestra «sin movimiento en el mayor» en vez de una diferencia. Hoy es el caso real: 5 facturas sin asiento y el mayor en cero.
>
> **7. Sí:** «no comparable» cuenta solo las facturas VES o CNY **con asiento vivo**, porque esas son las que distorsionan 4.5 (B2). Una VES o CNY sin asiento ya cae en «sin asiento» (B3), y contarla dos veces confundiría.

Cómo quedan aplicadas:

- **Decisión 7, en el control del ingreso:** la fila 4 de la tabla de arriba.
- **Decisión 7, en el subdiario de clientes:** cuenta una factura no borrador en VES o CNY solo si tiene su asiento `invoice` vivo, por el mismo cruce de «documentos sin asiento» (`asientosPorDocumento`). El recibo vivo en VES o CNY con su asiento `receipt` vivo sigue contando, como ya hacía K10.
- **Decisión 6, en el subdiario:** el estado nuevo «Sin movimiento en el mayor» (`mayor_sin_movimiento`), con la tabla de «Subdiario contra mayor». Se aplica a clientes (1.1.2) y, **por simetría, también a proveedores (2.1.1)**: una CxP abierta contra 2.1.1 sin movimiento tampoco tiene asiento, y una diferencia igual al saldo de las CxP diría lo mismo con menos claridad.
- **Decisión 6, en el control del ingreso:** ya estaba desde la tercera vuelta (L1): con 4.5 vacía, «el mayor tiene menos» por todo lo facturado y nunca «no comparable». Las dos pantallas dejan ganar al mayor vacío; la forma cambia: el control del ingreso da la diferencia contra lo facturado del período, y el subdiario dice «sin movimiento en el mayor» sin diferencia.

**Período explícito.** Cada pantalla dice su rango en `AAAA-MM-DD`. Las fechas son las que guarda el sistema, en UTC (B8, fuera de alcance). Reportes gana el preset «Este mes» (`mesEnCurso`), la misma ventana de Contabilidad, Dirección y el Dashboard; las demás siguen siendo ventanas móviles y cada pantalla rotula la suya.

### Divergencias conocidas

- **Anuladas entre períodos.** La regla excluye por el estado ACTUAL: una factura de un mes ya cerrado que se anula después desaparece de ese mes. El mayor de la fase 2 fechará el reverso en el período abierto («nunca reabrir períodos cerrados», diagnóstico). Hay una alternativa sin migración (contarla en su mes y restarla en el mes de la anulación, con la fecha de `entity_audit_log`); queda como pregunta para la contadora y **no se implementa**.
- **Con el libro sano, facturado y mayor no coinciden por construcción**: el 4.6 y los manuales (también a 4.5) quedan fuera de la comparación a propósito, y el plan aprobado cambia el asiento de los fondos de terceros (B10). La comparación contra 4.5 es lo que hoy explica B1 y B3. B2 no se puede medir así: con facturas en VES o CNY asentadas en 4.5, el control dice «no comparable» en vez de una diferencia que mezcla monedas. Con 4.5 vacía sí se mide: la diferencia es todo lo facturado.
- **«No comparable» mira los asientos del rango.** La factura en VES o CNY cuenta si su asiento de factura vivo cae en el mismo rango de `entry_date` que forma 4.5, porque es la lectura que se reusa (decisión 7). Hoy el asiento se fecha el día de la emisión, igual que `issued_at`. Si la fase 2 asienta tarde una factura de un mes anterior, ese asiento entra en la 4.5 del mes del asiento, y ahí la factura no es del período: el control de ese mes no la cuenta en «no comparable». La regla anterior (contar por la moneda de las facturas del período) tampoco lo veía.

## Alcance

**Dentro**, todo sin migración, sin RPC y sin escritura, con el cliente de sesión y la RLS vigente:

| | Cambio |
|---|---|
| (a) | Una sola regla de ingreso (`resumirIngreso`), usada por Contabilidad › Reportes, Reportes › Estado de resultados, Dirección y el Dashboard |
| (b) | Balance de comprobación al corte, con Σ debe = Σ haber y Σ saldos deudores = Σ saldos acreedores, y CSV |
| (c) | El diario completo descargable en CSV; la pantalla dice «Mostrando N de M» y cuenta los asentados reales |
| (d) | Documentos vivos sin asiento vivo y conteo de anulados con asiento vivo, con CSV |
| (e) | Subdiario contra mayor: facturas abiertas contra 1.1.2 y CxP abiertas contra 2.1.1 |
| (f) | «Cashflow» pasa a «Facturado contra cobrado»; el slug `?rep=cashflow` se conserva |

**Fuera:** ver «Fuera de alcance».

## Diseño

Norte: `docs/design/studio/_norte/erp/modules/contabilidad.jsx` (pestaña `subdiario` «Por contabilizar» y «Exportar libros») y `docs/design/studio/_norte/erp/modules/reports.jsx` (pestaña `cashflow`).

- **Contabilidad › Libro diario.** El contador dice los totales reales (`countEntries`): «1.234 asientos · 900 asentados». Si se ven menos, «Mostrando 500 de 1.234 asientos (los más recientes). El CSV trae solo los 900 asentados.» con el enlace «Descargar el diario asentado (CSV)». Un formulario con Desde y Hasta opcionales exporta un tramo con el botón «Descargar el diario asentado (CSV)»; valida las fechas antes de enviar con la misma regla que la ruta. El rótulo dice «asentado» mientras la contadora no responda la pregunta abierta 3.
- **Contabilidad › Reportes.** Formulario GET Desde/Hasta (por defecto, el mes en curso). La decisión de qué calcular es pura (`pedidoDeReportes`) y, con un error, la pestaña no pinta reportes aunque le lleguen. Debajo:
  - la tarjeta «Ingreso del período»: facturado sin IVA, el saldo de 4.5 de los asientos de factura (en «no comparable», «nominal mixto (no USD)» en vez de una cifra con signo de dólar) y la diferencia o el estado del control (tabla de arriba), los avisos de terceros, sin convertir y otros ingresos, y el enlace a Por contabilizar solo si el mayor tiene más o menos (también con el mayor vacío). El ícono que se pinta sigue al estado: el check de éxito solo con «cuadra»;
  - el estado de resultados del período, desde el mayor;
  - el balance general al corte, con el resultado acumulado y sin cierre a 3.4;
  - el balance de comprobación al corte, en tabla, con totales, la insignia «Cuadra» o «Descuadre», «Exportar CSV» y el enlace «Diario hasta el corte (CSV)». El enlace **no lleva `desde`**: así Σ debe del archivo = total debe de la tabla.
  - Con una fecha inválida, una sola fecha o el rango al revés no se calcula nada: el error queda junto al formulario y cita lo tecleado (DAT-01).
- **Contabilidad › Por contabilizar** (`?tab=subdiario`, nueva, solo lectura): subdiario contra mayor en tabla, con estado por lado (Cuadra, No cuadra, No comparable, Cuenta no encontrada, Sin movimiento, Sin movimiento en el mayor) y sus notas (`notasDelSubdiario`: «Sin movimiento en el mayor (cuenta 1.1.2): las facturas abiertas no llegaron al mayor.», lo mismo con 2.1.1 y las CxP, clientes no comparable, facturas sin convertir, CxP sin tasa). «Sin movimiento en el mayor» va con el tono de aviso, como «No cuadra», y la diferencia en «—»; documentos sin asiento con enlace al documento y motivo, con el conteo «Factura: X sin asiento de N vivas · M anuladas aparte» (`textoDelConteo`: el denominador son los vivos); conteo de anulados con asiento vivo por tipo, con enlace al listado. Las dos listas salen en un CSV.
- **Reportes › Estado de resultados.** Gana la tarjeta «Ingreso del período» (la misma de Contabilidad, con los mismos estados). Si el mayor no tiene movimiento pero hay facturado, se muestra la tarjeta con el aviso «El mayor no tiene movimiento en el período» en vez del estado vacío. La decisión vive en `vistaDelEstado`, pura, que usa también el CSV. El CSV del P&L lleva el saldo de 4.5 de facturas, la diferencia (vacía si no es comparable), el estado del control, la cantidad de facturas en bolívares o yuanes con asiento de factura y los otros ingresos. Con «no comparable», el saldo de 4.5 no va bajo «Monto USD»: la fila se rotula «En el mayor · cuenta 4.5 · asientos de factura: nominal mixto (no USD)» y la celda queda vacía.
- **Reportes › Facturado contra cobrado.** Cambian el rótulo de la pestaña, el eyebrow y el nombre del CSV. Su facturado es el total **con IVA** (se compara con lo cobrado, que también lo lleva): el KPI y la leyenda dicen «Facturado con IVA», la nota lo explica y el CSV dice «Facturado con IVA USD».
- **Dirección.** «Ingresos · mes» muestra la cifra oficial con «Facturado sin IVA · desde → hasta» y, en la segunda línea, el control según su estado, nombrando el lado del libro que se compara (la 4.5 de los asientos de factura, no todo el libro): «cuadra con 4.5 de facturas: $X», «4.5 de facturas: $X» (el saldo, sin la diferencia; la diferencia la muestran Contabilidad y Reportes), «4.5 de facturas: no comparable, hay facturas en bolívares o yuanes» (sin cifra en dólares), «sin asientos de factura en 4.5» (sin movimiento, o el mayor vacío con facturas) o «sin cuenta 4.5 en el plan de cuentas». Con otros ingresos del libro (4.6, manuales) agrega «otros ingresos del libro: $Y», y luego «incluye fondos de terceros» y «N sin convertir» si los hay. La tarjeta de utilidad pasa a «Utilidad neta · libro», con «Margen N% sobre los ingresos del libro»: el margen va sobre todos los ingresos del mayor (no sobre el facturado: mezclar fuentes da un margen falso). Los textos salen de `textosFinancieros`, pura. «Pediles» pasa a «Pídeles».
- **Dashboard.** «Ingresos del mes» y «Ticket promedio» usan la regla oficial: «facturado del mes sin IVA», más «N sin convertir» si las hay y «incluye $X de terceros» cuando parte del mes es de terceros. El ticket es un promedio por factura, así que los terceros se dicen contra el total del año del que sale: «$X de los $Y del año son de terceros».

### Definiciones del cruce (canónicas de la SDD-0559)

- **Asiento vivo:** `status = 'asentado'` y `deleted_at` nulo.
- **Vínculo en los dos sentidos:** `journal_entries.<doc>_id = doc.id` o `doc.journal_entry_id = journal_entries.id` (las facturas no tienen `journal_entry_id`).
- **Origen por `source`:** `invoice`, `receipt`, `supplier_bill`, `supplier_payment`. Un `referral_credit` también guarda `invoice_id` y no es el asiento de venta.
- Documentos revisados: facturas no borrador ni borradas (las anuladas, para la lista inversa), recibos (anulado = `deleted_at`), CxP no borradas (anulada = `status`) y pagos a proveedor (anulado = `deleted_at`).
- Motivos: «Sin asiento», «Asiento anulado» (solo tiene asientos anulados), «Sin monto» (monto ≤ 0: el posting no asienta montos en cero) y «Anulado con asiento vivo».

### Subdiario contra mayor

- **Clientes:** Σ (total − pagado), con signo, de las facturas emitidas, parciales, pagadas o vencidas, en USD con `invoiceUsdAmount`, contra el saldo de 1.1.2. No incluye borradores, así que puede no coincidir con «Por cobrar» de Cobranzas. Regla «no comparable» de la SDD-0559 (E1) con la decisión 7: con una factura no borrador en VES o CNY **con su asiento `invoice` vivo**, o un recibo vivo en esas monedas con su asiento `receipt` vivo, la diferencia no se muestra, porque hoy la factura se asienta al nominal (B2) y el cobro convierte. Cada factura llega con `asientoVivo`, calculado por el mismo cruce de «documentos sin asiento».
- **Proveedores:** Σ (total − pagado) de las CxP no anuladas contra 2.1.1, con **la misma regla del asiento** (`billAmountUsd`: cualquier moneda con tasa se convierte; sin tasa, el nominal). Una CxP en yuanes con tasa no fabrica una diferencia. Un pago con otra tasa que la CxP sí deja diferencia: es una diferencia en cambio que el libro no registró. Las CxP con saldo en otra moneda y sin tasa se cuentan (`sinTasa`): la nota dice «N CxP sin tasa van al nominal, como su asiento: el saldo no está en USD» y el CSV lleva la columna «Sin tasa (al nominal: no USD)».
- Saldos vivos a hoy contra el mayor sin rango. Estados de cada lado (`cuadreSubdiario`, `estadoDe`), en este orden; el primero que se cumple gana:

| # | Estado | Cuándo | Diferencia | Pantalla y CSV |
|---|---|---|---|---|
| 1 | Cuenta no encontrada | el plan no tiene 1.1.2 (o 2.1.1) | null | insignia de peligro |
| 2 | **Sin movimiento en el mayor** (`mayor_sin_movimiento`) | la cuenta de control no tiene debe ni haber y hay documentos con saldo (también los que no suman: VES sin tasa o CNY). Gana sobre «no comparable» (decisión 6). Clientes con 1.1.2 y, por simetría, proveedores con 2.1.1 | null | aviso, diferencia «—» y la nota «Sin movimiento en el mayor (cuenta 1.1.2): las facturas abiertas no llegaron al mayor.» (con 2.1.1: «… las CxP abiertas no llegaron al mayor.»). El CSV dice «Sin movimiento en el mayor» y deja vacía la diferencia |
| 3 | No comparable (solo clientes) | factura no borrador en VES o CNY con su asiento `invoice` vivo, o recibo vivo en VES o CNY con su asiento `receipt` vivo (E1 y decisión 7) | null | neutro, con su nota |
| 4 | Sin movimiento | la cuenta no tiene debe ni haber y no hay documentos con saldo: un 0 contra 0 no es una verificación | 0 | neutro |
| 5 | Cuadra / No cuadra | documentos − mayor, igual o distinto de 0 | documentos − mayor | éxito / aviso |

Proveedores no tiene «no comparable»: convierte con la regla del asiento (G8). La SDD-0559 cuenta en su radiografía las CxP y los pagos que no están en USD o USDT con asiento vivo como «no comparable» en 2.1.1; acá no hace falta, porque el subdiario aplica `billAmountUsd`, la misma conversión del asiento.
- No reusa `receivablesQueue` ni `payablesQueue`: la primera incluye borradores con saldo y las dos descartan saldos negativos.

### La ruta de exportación

`GET /api/studio/contabilidad/export?tipo=diario[&desde][&hasta]`: sesión (`requireStudioSession`), `moduleViewDenial(supabase, "accounting")` antes de leer, validación de fechas (400 con fecha inválida o rango al revés), lectura paginada completa con `fetchAllPaged`, solo asientos asentados y vivos, una fila por línea. El CSV sale por el mismo camino que Reportes (`rowsToCsv` → `csvCell`, que neutraliza fórmulas), con BOM, CRLF y `Cache-Control: private, no-store`.

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `lib/studio/accounting/ingreso-periodo.ts` | nuevo, puro: `RangoFechas`, `ESTADOS_DE_INGRESO`, `CUENTA_VENTAS`, `mesEnCurso`, `rangoDesdeParams`, `controlDelMayor` (con los saldos de facturas aparte y `facturasConAsiento`), `resumirIngreso` (con `enOtraMoneda`, que cuenta solo las facturas con asiento de factura vivo; `FacturaDeIngreso` lleva `id`), `describirIngreso` (con «no comparable», «sin movimiento» y la precedencia del mayor vacío), `notaDelMayorMezclado`, `ETIQUETA_ESTADO_INGRESO` |
| `lib/studio/accounting/libro-control.ts` | nuevo, puro y seguro para el cliente: comprobación, cruce documento ↔ asiento (con vivos y anulados por tipo, `textoDelConteo`), tipos y notas del subdiario (`sinTasa`, el estado `mayor_sin_movimiento`, `notasDelSubdiario`), diario y CSV, enlaces, aviso y rótulo del diario, `pedidoDeReportes`, payloads de página |
| `lib/studio/accounting/subdiario.ts` | nuevo, puro de servidor: `cuadreSubdiario`, con las CxP sin tasa contadas, el mayor vacío que gana en los dos lados y `FacturaDelSubdiario` con `asientoVivo` (importa `billAmountUsd`, que trae el cliente admin y no debe ir al navegador) |
| `lib/studio/accounting/libro-control-queries.ts` | nuevo: `saldosDeFacturas` (saldos y facturas con asiento, de una lectura), `controlDelPeriodo`, `ingresoDelPeriodo`, `reportesDelLibro`, `cuadreDelLibro` (con `asientoVivo` por factura), `leerDiarioCompleto` |
| `lib/studio/journal-queries.ts` | `DIARIO_PANTALLA_MAX = 500` y `countEntries` |
| `app/api/studio/contabilidad/export/route.ts` | nuevo: GET del diario en CSV |
| `app/studio/(app)/contabilidad/page.tsx` | pestaña `subdiario`, `desde`/`hasta` por `pedidoDeReportes`, lecturas por pestaña |
| `app/studio/(app)/contabilidad/_components/ContabilidadClient.tsx` | pestaña «Por contabilizar», props y texto de cabecera |
| `app/studio/(app)/contabilidad/_components/LibroDiarioTab.tsx` | totales reales, aviso «Mostrando N de M» con los asentados del CSV, rótulo «diario asentado» y exportación con fechas |
| `app/studio/(app)/contabilidad/_components/ReportesTab.tsx` | período, ingreso, comprobación y CSV; sin reportes debajo de un error |
| `app/studio/(app)/contabilidad/_components/PorContabilizarTab.tsx` | nuevo (con el tono de aviso de «Sin movimiento en el mayor») |
| `app/studio/(app)/contabilidad/_components/IngresoDelPeriodoCard.tsx` | nuevo: la tarjeta de la cifra oficial (Contabilidad y Reportes), con el tono por estado (`TONO_DEL_CONTROL`) y el saldo de 4.5 como `NOMINAL_MIXTO` en «no comparable» |
| `lib/studio/direccion/queries.ts` | `finance.ingreso: IngresoPeriodo` con `controlDelPeriodo`; margen sobre los ingresos del mayor; `textosFinancieros` |
| `app/studio/(app)/direccion/page.tsx` | KPI de ingreso y de utilidad desde `textosFinancieros`; «Pídeles» |
| `lib/studio/dashboard/dashboard-kpi-queries.ts` | ingresos del mes y ticket promedio con `resumirIngreso`; recibe `hoy`; aviso de terceros; lee `id` para que la fila sea una `FacturaDeIngreso` completa |
| `lib/studio/reports/types.ts` | preset `MES` «Este mes»; `IncomeStatement.ingreso`; `vistaDelEstado` |
| `lib/studio/reports/queries.ts` | `incomeStatement` devuelve `ingreso` con `controlDelPeriodo`; comentario de Facturado contra cobrado |
| `lib/studio/reports/export-csv.ts` | filas de control en el CSV del P&L (con el estado, 4.5 fuera de «Monto USD» en «no comparable» y la cantidad de facturas en bolívares o yuanes con asiento de factura); slug `contable-facturado-contra-cobrado` y «Facturado con IVA USD» |
| `app/studio/(app)/reportes/_components/ReportesClient.tsx` | `TABS_BY_CATEGORY` exportado en su lugar; rótulos; tarjeta de ingreso; `CashflowView` exportada y «Facturado con IVA»; `IncomeStatementCard` exportada, con la nota del mayor mezclado |
| `lib/studio/accounting/__tests__/ingreso-fixture.ts` | nuevo: fixture compartido (con `ASIENTOS_EN_OTRA_MONEDA` y `control()` con la lista de facturas asentadas) |
| `lib/studio/accounting/__tests__/ingreso-periodo.test.ts` | nuevo |
| `lib/studio/accounting/__tests__/libro-control.test.ts` | nuevo |
| `lib/studio/accounting/__tests__/libro-control-queries.test.ts` | nuevo |
| `app/api/studio/contabilidad/__tests__/export.test.ts` | nuevo (con el 500 por lectura incompleta) |
| `app/studio/(app)/contabilidad/__tests__/libro-diario-aviso.test.tsx` | nuevo |
| `app/studio/(app)/contabilidad/__tests__/reportes-tab.test.tsx` | nuevo (también la tarjeta por estado) |
| `app/studio/(app)/contabilidad/__tests__/por-contabilizar.test.tsx` | nuevo |
| `app/studio/(app)/reportes/__tests__/facturado-contra-cobrado.test.ts` | nuevo: rótulo, contrato por AST de «Cashflow» y «Facturado con IVA» pintado |
| `app/studio/(app)/reportes/__tests__/estado-gerencial-mezclado.test.tsx` | nuevo: el estado de resultados gerencial avisa cuando el mayor mezcla monedas |
| `lib/studio/direccion/__tests__/queries.test.ts` | smoke con `issued_at`/`base_amount`, 4.5 de factura y `entry_id`; casos nuevos con 4.6, manual a 4.5 y `textosFinancieros` |
| `lib/studio/dashboard/__tests__/dashboard-kpi-queries.test.ts` | fixtures con `base_amount`/`currency`; mes en UTC; casos nuevos (también terceros) |
| `lib/studio/reports/__tests__/queries.test.ts` | casos nuevos de `incomeStatement.ingreso` (no comparable y manual a 4.5) |
| `lib/studio/reports/__tests__/export-csv.test.ts` | casos nuevos |
| `lib/studio/reports/__tests__/types.test.ts` | `MES` y `vistaDelEstado` |
| `lib/studio/__tests__/listados-double.ts` | opción `serverCap` (emula `db-max-rows`) |
| `lib/studio/rbac-api-guard.test.ts` | la ruta nueva en `GUARDED` (`accounting`, antes de `leerDiarioCompleto`) |
| `scripts/__tests__/invoice-read-boundary.test.mjs` | +2 lecturas de `invoices` en `libro-control-queries.ts`, justificadas |
| `docs/specs/0557-reportes-contables-una-cifra/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0557-reportes-contables-una-cifra.md` | handoff |

Las correcciones de la revisión adversaria (K1 a K15, 2026-10-19), las de la tercera vuelta (L1 a L10, el mismo día) y las de las decisiones 6 y 7 del Director (M1 a M3, el mismo día) no suman archivos: cambian archivos de esta misma lista. Los merges de `origin/main` (`6c3f0a9f`, con #280 y #281, y `7fba5711`, con #282 de la SDD-0561) traen archivos de otras SDD que esta no modifica.

Archivos vedados por otras SDD y no tocados: `lib/studio/invoice-queries.ts`, `lib/studio/invoice-types.ts`, `lib/portal/**`, `app/portal/**`, `app/studio/(app)/clientes/**`, `lib/studio/client-*.ts`, `lib/studio/payment-queries.ts`, `app/studio/(app)/cobranzas/**`, `lib/studio/borrado/**`, `app/studio/(app)/embarques/**`.

## Criterios de aceptación

1. **Una regla.** `resumirIngreso` es la única función que calcula el ingreso del período. La usan `ingresoDelPeriodo` (Contabilidad › Reportes, Reportes › Estado de resultados y Dirección) y `financeInvoiceKpis` (Dashboard). `git grep -n "monthRevenue +=" -- lib app` no devuelve nada.
2. **La misma regla con el mismo período da la misma cifra.** Con el fixture compartido y el período 2025-03-01 → 2025-03-18, las pruebas de Contabilidad (`libro-control-queries`), Reportes (preset «Este mes»), Dirección y el Dashboard dan 2000 USD, con 2 facturas sin convertir. Como 3 de esas facturas están en VES o CNY y las pruebas siembran sus asientos de factura vivos (`ASIENTOS_EN_OTRA_MONEDA`, o el `control()` del fixture), el control de Contabilidad, Reportes y Dirección es «no comparable». El Dashboard no lee el mayor y cuenta 0 en `enOtraMoneda`. Con el mismo fixture y 4.5 vacía, el mayor tiene menos por los 2000 (B3, criterio 3). Las pruebas de la diferencia usan el mismo fixture sin ellas (`FACTURAS_EN_USD`). Cada prueba fija su período.
3. **Lo que muestra cada pantalla del control.** Contabilidad › Reportes y Reportes › Estado de resultados muestran el rango, el facturado sin IVA, el saldo de 4.5 de los asientos de factura (en «no comparable», «nominal mixto (no USD)») y, según el estado, la diferencia o el texto de «no comparable», «sin movimiento» o «sin cuenta 4.5». Una factura en VES sin ningún asiento da «el mayor tiene menos» por todo lo facturado, con el enlace a Por contabilizar (prueba y mutante). Una factura USD asentada y una VES sin asiento, con 4.5 en movimiento, dan la diferencia normal; la misma VES con su asiento vivo da «no comparable» (decisión 7, en la regla pura y por el lector, con mutantes). Ningún texto visible cita números de tarea del plan. Dirección muestra «Facturado sin IVA · desde → hasta» y una de estas: «cuadra con 4.5 de facturas: $X», «4.5 de facturas: $X» (el saldo de 4.5, sin la diferencia), «4.5 de facturas: no comparable, hay facturas en bolívares o yuanes», «sin asientos de factura en 4.5» o «sin cuenta 4.5 en el plan de cuentas», más «otros ingresos del libro: $Y», terceros y sin convertir. Rotula «Utilidad neta · libro» la utilidad, con el margen «sobre los ingresos del libro». El Dashboard dice «sin IVA», «incluye $X de terceros» en el mes y «N % del facturado del año es de terceros» en el ticket (un porcentaje, para que el redondeo a miles no diga «$2.3K de los $2.3K»). Con «no comparable», la utilidad de Dirección agrega «· mezcla el nominal de facturas en bolívares o yuanes», y el estado de resultados gerencial de Reportes pinta una nota: sus cifras salen del mayor y no son todas USD. Con 4.5 vacía y solo facturas sin convertir, falta el asiento pero la diferencia no tiene monto en USD: `diferenciaUsd` es null y el texto nombra cuántas facturas son. Los textos de Dirección salen de `textosFinancieros`, con prueba.
4. Contabilidad › Reportes: P&L del rango, balance al corte y comprobación al corte con debe, haber, saldo deudor y saldo acreedor por cuenta, totales, «Cuadra» o «Descuadre» y CSV. Una fecha inválida, una sola fecha o un rango al revés muestran el error y no calculan: lo decide `pedidoDeReportes` (pura, con prueba) y la pestaña no pinta reportes con un error.
5. Diario: la pantalla muestra los totales reales; si hay más de 500, avisa «Mostrando N de M» y dice cuántos asentados trae el CSV; el enlace y el botón dicen «Descargar el diario asentado (CSV)». La ruta baja todos los asientos asentados y vivos (sin los borrados), sin tope, una fila por línea, con BOM, CRLF, fórmulas neutralizadas y `private, no-store`. Solo accounting y admin (403 para los demás, 401 sin sesión, 400 con fechas inválidas, 500 si la lectura queda incompleta). Σ debe del CSV hasta el corte = total debe de la comprobación al corte, también con un asiento asentado y borrado en la base.
6. Por contabilizar: documentos vivos sin asiento vivo de su origen, con su motivo y enlace; «X sin asiento de N vivas», con los anulados aparte del denominador; anulados con asiento vivo aparte, también recibos y pagos con `deleted_at`; CSV.
7. Subdiario contra mayor: clientes contra 1.1.2 (sin borradores, con «no comparable» por B2 solo con una factura VES o CNY con su asiento `invoice` vivo, o un recibo vivo en VES o CNY con asiento vivo; la misma VES sin asiento la deja comparable, y un recibo vivo en USD o USDT con asiento vivo también, con prueba y mutante) y proveedores contra 2.1.1 con la regla del asiento, con las CxP sin tasa contadas y avisadas (una CxP en USDT sin tasa no cuenta: va 1:1); diferencia, documentos y estado; CSV. Con la cuenta de control sin movimiento y documentos abiertos, en clientes y en proveedores, el estado es «Sin movimiento en el mayor», sin diferencia y con su nota, también si hay una VES asentada o un recibo VES con asiento (decisión 6); el CSV lleva el estado nuevo. Con pruebas en la regla pura, en el lector y en la pantalla, y sus mutantes.
8. En la UI de Reportes no queda el texto «Cashflow»; `?rep=cashflow` sigue abriendo la vista; el CSV se llama `reporte-contable-facturado-contra-cobrado-<fecha>.csv`; su facturado se rotula «Facturado con IVA».
9. Sin migración, RPC ni escritura nueva. Ningún archivo en rutas públicas. Lint con las fronteras y la regla de `.limit > 1000`.
10. Control rojo: cada regresión de la lista del handoff hace fallar al menos una prueba (exit 1 y la línea `Tests … failed`). El handoff cita la línea `TOTAL` del log de mutantes.
11. `/ui-check` de las tres pestañas de Contabilidad, el Estado de resultados de Reportes y los KPI de Dirección.
12. El handoff registra la revisión de datos personales del CSV del diario.
13. `docs:check`, `sdd:check`, `governance:check` y `components:check` pasan. `pnpm verify` necesita turno del Director.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | cumplimiento | esta spec con allowlist exacta |
| DAT-01 | cumplimiento | `rangoDesdeParams` y `rangoDelDiario` no corrigen en silencio: error que cita lo tecleado y explica el formato; rango inverso y fecha sola probados; la página decide con `pedidoDeReportes` (pura, con prueba y mutante) y la pestaña no pinta reportes debajo de un error; la ruta repite la validación (400); borrar una fecha no equivale a «hoy». Presets: «Este mes» en Reportes; el resto del gate de DAT-01 (teclado del selector, zoom, móvil) es el `input type="date"` nativo y no se probó en navegador |
| FRM-01 | cumplimiento | etiquetas persistentes, error junto al campo con `aria-invalid` y `aria-describedby`, validación en cliente y en servidor; los filtros son GET y no hay cambios sin guardar que perder |
| TBL-01 | cumplimiento | tablas semánticas de lectura (`<th scope>`), unidades en las cabeceras, estado vacío honesto, scroll horizontal propio (`TableFrame`); sin selección ni acciones masivas |
| BTN-01 | cumplimiento | «Aplicar» es el único primario del bloque; exportar en pantalla con `ActionButton` ghost; las descargas por ruta son `<a>` o un GET; sin acciones de asentar |
| ERR-01 | cumplimiento | las lecturas incompletas lanzan con nombre (`fetchAllPaged`) y caen en `error.tsx`; probado con un doble de 1 fila por respuesta: `leerDiarioCompleto` rechaza con «Diario · asientos…» o «Diario · líneas…» y la ruta responde 500, y `saldosDeFacturas` (el control del ingreso) rechaza con «Control del mayor · asientos de factura…» (61 asientos) o «Control del mayor · líneas de factura…» (30 asientos con 60 líneas), todos con sus mutantes; la ruta responde 400/403/500 con `apiError` sin detalle crudo en producción |
| LOD-01 | no aplica | páginas de servidor sin carga progresiva nueva; las exportaciones en pantalla usan `ActionButton` (estado de carga propio) |
| A11Y-01 | cumplimiento | tablas con cabecera, `aria-labelledby` por sección, errores con `role="alert"`, avisos con `role="status"`, contraste calculado sobre los tokens en los dos temas (handoff); las pestañas de Contabilidad no cambian de patrón |
| VIS-01 | cumplimiento | solo tokens `var(--*)`, sentence case, tuteo; el texto va en tinta y el tono semántico en el icono (SDD-0441) |
| CMP-01 | no aplica | `IngresoDelPeriodoCard` es un componente de módulo, no entra a `app/studio/_components/ui` |
| NUM-01 | no aplica | no hay campos numéricos nuevos |
| AUD-01 | no conformidad | AUD-01 lista las exportaciones como evento obligatorio. La exportación del diario no deja evento porque la tarea 1.4 es «sin escritura nueva». Es el mismo estado de las exportaciones existentes (`operativo/export`, `comercial/export`); su corrección es una SDD aparte (handoff, fuera de alcance) |
| AUD-02 | no aplica | gobierna la consulta y exportación del audit log, que no se toca |
| Privacidad (revisar-datos-ve) | cumplimiento con hallazgos | revisión del CSV del diario en el handoff |

## Datos personales

El CSV del diario exporta el concepto y el detalle de cada asiento. Esos textos ya contienen datos de personas que se ven hoy en la pantalla del diario:

- el nombre del trabajador en el finiquito (`lib/studio/accounting/settlement-posting.ts:141`);
- el Shipping Mark del referidor (`lib/studio/accounting/referral-credit-posting.ts:212`);
- el texto libre de los asientos manuales (`app/studio/(app)/contabilidad/actions.ts`).

Mitigaciones: solo accounting y admin, los mismos roles que ven nómina; `Cache-Control: private, no-store`; sin columnas nuevas de cliente; fórmulas neutralizadas. Los demás CSV muestran códigos de documento, fechas y montos, sin nombre ni RIF. El resultado completo de `revisar-datos-ve` está en el handoff.

## Validación

- Pruebas puntuales con `corepack pnpm exec vitest run` sobre los archivos de la allowlist y los contratos (`rbac-api-guard`, `studio-api-auth-guard`, `invoice-read-boundary`, `spec-migration-refs`).
- Mutantes uno por vez, con el script del scratchpad (`mutantes-0557.cjs`): los 43 de la primera pasada, los 51 de las correcciones K1 a K15, los 17 de la tercera vuelta L1 a L10 y los 17 de las decisiones 6 y 7 (O01 a O17). Última corrida (2026-10-19, sobre el código de `21f7a4ed`): `TOTAL: 128 mutantes · 128 MUERTOS · 0 SOBREVIVEN · 0 NO APLICADOS`. Los 8 de la cuarta vuelta (`mutantes-0557-final.mjs`, P1 a P8), sobre el mismo código: «Todos los mutantes murieron.». La tabla está en el handoff.
- Candado de migraciones (SDD-0561) sobre el árbol fusionado con `7fba5711`: `node scripts/migrations-lock.mjs verificar` en verde (esta SDD no lleva migración). `origin/main` no avanzó después de ese merge.
- `corepack pnpm typecheck`, `eslint --max-warnings=0` de lo tocado, `docs:check`, `sdd:check`, `governance:check`, `components:check`, `/ui-check`.
- `pnpm verify` con turno del Director.

Producción no se lee ni se escribe. Todo se prueba con fixtures y con el doble `lib/studio/__tests__/listados-double.ts`, que aplica los filtros y corta en 1.000 filas por respuesta.

## Fuera de alcance

- Reparar el posting: reverso al anular (B1), asiento de venta convertido a USD (B2), posting transaccional y bandeja de fallos (B3). Es la fase 2; Por contabilizar es de solo lectura.
- **Otras cifras de «facturado», con dueño:**
  - «Facturado YTD» de `invoiceKpis` (`lib/studio/invoice-queries.ts`) suma `total_amount` con IVA, sin convertir, por `issued_at ?? created_at`. El archivo es de la SDD-0555; se rotula o se unifica en una SDD posterior.
  - El libro de ventas y la Posición de IVA filtran por `created_at` y no normalizan moneda (`lib/studio/fiscal/queries.ts`, `lib/studio/reports/queries.ts`). El criterio de fecha lo decide la contadora.
  - Overview, Costing y Comercial a 12 meses (revenue por embarque, con IVA o por `created_at`).
  - El facturado de Reportes › Facturado contra cobrado (`cashflowReport`, `lib/studio/reports/queries.ts`) es el total con IVA, convertido, por `issued_at ?? created_at`. Es correcto para comparar contra lo cobrado; esta SDD solo lo rotula «Facturado con IVA» y no lo unifica con la cifra oficial.
- Las CxP en otra moneda sin tasa: el asiento las lleva a 2.1.1 por el nominal (`bill-posting.ts`, `billAmountUsd`) y la CxP se puede guardar sin tasa. Esta SDD solo las cuenta y lo dice; exigir la tasa o convertir en el asiento va con la conversión unificada (H08).
- `fund_class` third_party como ingreso propio (B10, decisión 10).
- Las fechas en UTC (B8).
- El flujo de caja real (5.3), el cierre a 3.4 y los saldos iniciales (B22).
- Antigüedad por cliente y por proveedor, pagos no aplicados y paquete del contador.
- Unificar la conversión a USD (H08) y «Por cobrar» sin normalizar (H03).
- Los borradores con saldo en `receivablesQueue` (anexo, Cobranzas H07): va con la SDD-0558.
- Gastos, nómina, reclamos y Socio China dentro de «documentos sin asiento».
- Cobros sin recibo (`paid_amount` contra Σ recibos): es de la SDD-0559; acá solo se ve como diferencia del subdiario.
- Auditar las exportaciones CSV (AUD-01), para todas las rutas de exportación.
- Editar el Norte («vs» contra «contra»), cerrar H11 completo y el `.limit(1000)` de `listAccounts`.

## Preguntas abiertas

1. Sam y la contadora: ¿confirman el facturado sin IVA por emisión como cifra oficial de gestión, y el mayor (4.5 de los asientos de factura) como control, hasta que la fase 2 cuadre el libro? Mientras 4.5 tenga asientos de factura y alguna factura del período en VES o CNY tenga el suyo, el control dice «no comparable»; con 4.5 vacía dice cuánto falta. No bloquea.
2. B10: ¿las facturas `third_party` son ingreso propio? Hoy entran, igual que en el mayor, y cada pantalla dice cuánto es de terceros.
3. La contadora: ¿el diario CSV solo con asentados (así cuadra con la comprobación) o también con los anulados y una columna Estado? Mientras no responda, la pantalla dice «Descargar el diario asentado (CSV)» y el aviso, cuántos asentados trae.
4. La contadora: ¿una factura anulada después de cerrar su mes debe restarse en el mes de la anulación (alternativa sin migración con `entity_audit_log`)?
5. La contadora: un asiento manual a la propia 4.5 hoy va a «otros ingresos del mayor» y no cuenta como diferencia. ¿Se acepta así, o los ingresos sin factura deben ir a otra cuenta 4?

Las preguntas 6 (el mayor vacío en el subdiario) y 7 (contar solo las facturas con asiento vivo) se respondieron: están en «Decisiones del Director (2026-10-19)», como decisión del Director, revisable por Sam.
