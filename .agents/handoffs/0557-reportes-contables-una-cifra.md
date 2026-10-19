# Handoff · SDD-0557 · Reportes contables sin migración: una cifra de ingreso, comprobación, diario completo y cuadre del libro

| Campo | Valor |
|---|---|
| Fecha | 2026-10-19; en Caracas, de 01:15 a 02:05 aprox. (UTC 05:15 a 06:05) la primera pasada, de 02:20 a 03:05 aprox. (UTC 06:20 a 07:05) las correcciones K1 a K15, de 03:15 a 04:00 aprox. (UTC 07:15 a 08:00) la tercera vuelta L1 a L10, y de 04:05 a 04:45 aprox. (UTC 08:05 a 08:45) las decisiones 6 y 7 del Director (M1 a M3) |
| Task ID / owner | `contabilidad-2026-10-18` / Worker «Contabilidad»; todas las pasadas las escribió un subagente escritor de esa Worker |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0557-reportes-una-cifra` |
| Rama | `codex/sdd-0557-reportes-una-cifra`, desde `origin/main` `3f3a52cc` (merge de la #279); `origin/main` `6c3f0a9f` mergeado en `da7f09f0` y `origin/main` `7fba5711` mergeado en `4770174b` |
| SDD | [0557](../../docs/specs/0557-reportes-contables-una-cifra/spec.md), `in-progress`. La reserva entró por cherry-pick (`3030cd03`) |
| Estado | la rama está publicada como la PR #283 con la cabeza `0b73e864`. Encima, las decisiones 6 y 7 del Director aplicadas (M1 a M3, `correcciones-0557-c.md`), en commits locales **sin push** |
| Permisos | Sam autorizó la fase 1 completa: commits selectivos, push de la rama propia y PR en borrador (#283), sin fusionar. No incluye producción ni base de datos. El `pnpm verify` corrió con el turno que dio el Director |

## OBJETIVO ORIGINAL

Tarea 1.4 del plan contable (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`, fase 1; B17 y anexo A, Reportes H02, H04 y H07), sin migración:

- una sola cifra de ingreso para Contabilidad, Dirección, Reportes y el Dashboard;
- balance de comprobación y diario completo en CSV;
- documentos sin asiento y cuadre del subdiario contra el mayor;
- «Cashflow» pasa a «Facturado contra cobrado».

Mandan las decisiones `decisiones-0557.md` (G1 a G14) sobre el plan `3-plan-0557.json`, y las definiciones canónicas de la SDD-0559 (E1 y E7). Encima, `correcciones-0557.md` (K1 a K15), `correcciones-0557-b.md` (L1 a L10, tercera vuelta) y `correcciones-0557-c.md` (M1 a M3: las decisiones 6 y 7 del Director, del 2026-10-19).

## COMPLETADO

- **Una regla** (`lib/studio/accounting/ingreso-periodo.ts`, `resumirIngreso`): base sin IVA en USD, facturas `emitida | parcial | pagada | vencida` no borradas, por `issued_at` inclusive. VES sin tasa y CNY van a «sin convertir». `deleted_at` viaja en la fila y la regla lo vuelve a filtrar (G1). Desglose propio/terceros por `fund_class` (G1). El control del mayor es el saldo de **4.5 de los asientos de factura** (K3); el 4.6, los manuales (también a 4.5) y cualquier otro origen son «otros ingresos del mayor», aparte (G2).
- **Los cuatro consumidores la usan**, con el mismo fixture y el mismo período (2025-03-01 → 2025-03-18, lejos de la fecha real, G11): `ingresoDelPeriodo` (Contabilidad › Reportes, Reportes › Estado de resultados y Dirección) y `financeInvoiceKpis` (Dashboard). Todos dan 2000 USD con 2 sin convertir. El «Ticket promedio» del Dashboard usa la misma base (G12).
- **Contabilidad › Reportes**: Desde/Hasta (G7, DAT-01: con fecha inválida, una sola fecha o rango al revés no calcula y muestra el error citando lo tecleado), tarjeta «Ingreso del período», P&L del período, balance general y **balance de comprobación al corte** (movimientos directos, sin duplicar el rollup) con CSV y el enlace «Diario hasta el corte (CSV)» **sin `desde`** (G6).
- **Libro diario**: totales reales con `countEntries`; «Mostrando N de M» con los asentados que trae el CSV y el enlace «Descargar el diario asentado (CSV)» (K5); exportación con Desde/Hasta que valida antes de enviar.
- **Ruta** `GET /api/studio/contabilidad/export?tipo=diario`: sesión, `moduleViewDenial(supabase, "accounting")` antes de leer, 400 con fechas inválidas, lectura completa paginada, CSV con BOM, CRLF, fórmulas neutralizadas por `rowsToCsv` y `private, no-store` (G4, G5). Entra a `GUARDED` del contrato RBAC.
- **Por contabilizar** (`?tab=subdiario`): subdiario contra mayor (clientes contra 1.1.2, con «no comparable» por B2 según E1 de la 0559 y la decisión 7: solo con facturas o recibos VES o CNY con asiento vivo; proveedores contra 2.1.1 con `billAmountUsd`, G8, y las CxP sin tasa contadas, K7; con la cuenta sin movimiento y documentos abiertos, «Sin movimiento en el mayor», decisión 6), documentos sin asiento con motivo y enlace y el conteo «X sin asiento de N vivas» (K8), conteo de anulados con asiento vivo con enlace (G9), CSV.
- **Reportes**: preset «Este mes» (G10); tarjeta de ingreso en el Estado de resultados; la decisión de la vista en `vistaDelEstado` (G11), que también usa el CSV; «Facturado contra cobrado» con `?rep=cashflow` intacto; `TABS_BY_CATEGORY` exportado donde estaba (G12).
- **Dirección**: `finance.ingreso: IngresoPeriodo` (G12), el lado comparado con su nombre («4.5 de facturas: $X», «sin asientos de factura en 4.5») y «otros ingresos del libro» (L2), «Utilidad neta · libro» con el margen sobre los ingresos del mayor, «Pídeles».
- **El control del ingreso** (L1): con 4.5 sin asientos de factura, el mayor vacío gana sobre «no comparable» y la diferencia es todo lo facturado, con el enlace a Por contabilizar; «no comparable» pinta 4.5 como «nominal mixto (no USD)» (L3) y cuenta solo las facturas VES o CNY con su asiento de factura vivo (decisión 7, M1).

### Merge de main (2026-10-19)

- `git fetch origin main` y `git merge --no-edit origin/main` (sin rebase): `origin/main` en `6c3f0a9f` (#280, SDD-0556, y #281). Merge `da7f09f0`, **sin conflictos**: el índice de specs entró solo y `node scripts/build-docs-index.mjs` no cambió nada (`✓ índice regenerado en docs\specs\README.md — 545 specs, 15 huecos`).
- Inventario de `scripts/__tests__/invoice-read-boundary.test.mjs` recalculado corriendo la prueba sobre el árbol fusionado: `Tests  4 passed (4)`. El mapa y los totales no cambian con el merge: 20 archivos y 45 lecturas (main no tocó llamadas `from("invoices")` fuera de `lib/portal/**`, y la de `portal-queries.ts` sigue en 2).

### Correcciones de la revisión adversaria (K1 a K15)

Commits `bab54b96` (fix, K1 a K8, K14 y K15) y `6bc0c463` (test, K9 a K13). La tercera vuelta cambia tres cosas de esta tabla: la precedencia de K1 (el mayor vacío gana, L1), el texto que citaba «la tarea 2.3» (L5) y los textos de Dirección de K2 y K15, que dejan de decir «el libro» para el lado comparado (L2).

| # | Qué | Dónde |
|---|---|---|
| K1 | Con alguna factura no borrador del período en VES o CNY (también anuladas, convertidas o no), el control contra 4.5 es `no_comparable`: `diferenciaUsd` null, sin enlace a Por contabilizar, y el texto explica el nominal y la tarea 2.3. El lector del ingreso trae también las anuladas (`.in(status, [...ESTADOS_DE_INGRESO, "anulada"])`). Va en Contabilidad › Reportes, Reportes › Estado de resultados (la misma tarjeta), Dirección y el CSV del P&L | `ingreso-periodo.ts`, `libro-control-queries.ts`, `IngresoDelPeriodoCard.tsx`, `direccion/queries.ts`, `export-csv.ts` |
| K2 | `sin_movimiento`: sin facturas que sumen, sin sin convertir y sin debe ni haber de asientos de factura en 4.5. Texto neutro, ícono neutro; Dirección dice «sin movimiento en el libro» | `ingreso-periodo.ts` (`ventasConMovimiento`), tarjeta, Dirección |
| K3 | `ventas` sale solo de las líneas de 4.5 de asientos `source = 'invoice'`, asentados y vivos, del rango (`saldosDeFacturas` + `controlDelPeriodo`, que también usan Reportes y Dirección); filtro en SQL y repetido en memoria sobre asientos y líneas. Un manual a 4.5 queda en `otrosIngresos`. Spec, comentarios y textos dicen lo mismo | `libro-control-queries.ts`, `ingreso-periodo.ts`, `reports/queries.ts`, `direccion/queries.ts` |
| K4 | Dashboard: «· incluye $X de terceros» en «Ingresos del mes» (con el mes) y en el ticket (con el año) | `dashboard-kpi-queries.ts` |
| K5 | «Descargar el diario asentado (CSV)» en el enlace y el botón; el aviso dice «El CSV trae solo los N asentados.» | `libro-control.ts` (`ROTULO_DIARIO_CSV`, `avisoDelDiario`), `LibroDiarioTab.tsx` |
| K6 | «Facturado con IVA» en el KPI, la leyenda, la nota y la etiqueta del gráfico de Facturado contra cobrado; el CSV dice «Facturado con IVA USD» (la cabecera del CSV no estaba en K6: ver desvíos) | `ReportesClient.tsx` (`CashflowView` exportada), `export-csv.ts` |
| K7 | Subdiario de proveedores: `sinTasa` cuenta las CxP con saldo en otra moneda sin tasa; nota «N CxP sin tasa van al nominal, como su asiento: el saldo no está en USD» y columna en el CSV | `subdiario.ts`, `libro-control.ts` (`notasDelSubdiario`, `subdiarioCsv`) |
| K8 | «Factura: X sin asiento de N vivas · M anuladas aparte»: el conteo trae `vivos` y `anulados` | `libro-control.ts` (`textoDelConteo`), `PorContabilizarTab.tsx` |
| K9 | Un asiento asentado con `deleted_at` y monto propio (777) en `diarioGrande`: no sale en el CSV y la invariante Σ debe = total debe sigue | `libro-control-queries.test.ts` |
| K10 | E1 por el recibo: factura USD pagada con un recibo VES con asiento `receipt` asentado → `no_comparable`; controles: con el asiento anulado y con el recibo anulado, `cuadra` | `libro-control-queries.test.ts` |
| K11 | Recibo y pago con `deleted_at` y asiento vivo van a `anuladosConAsiento`; una CxP viva sin asiento; una CxP abierta que lleva el subdiario de proveedores a 800 | `libro-control-queries.test.ts` |
| K12 | Orden infeliz: asiento con código menor y fecha posterior; debe a 6.1 contra haber a 1.1.1; dos facturas con fecha y código opuestos | `libro-control.test.ts` |
| K13 | ERR-01: con un doble de 1 fila por respuesta, 61 asientos (o 30 asientos con 60 líneas) superan `MAX_PAGES`; `leerDiarioCompleto` rechaza con su mensaje y la ruta responde 500 con el mensaje seguro | `libro-control-queries.test.ts`, `export.test.ts` |
| K14 | `pedidoDeReportes` (pura) decide filtro y rango; con error, `rango` null. Además, `ReportesTab` no pinta reportes si `filtro.error` está puesto | `libro-control.ts`, `contabilidad/page.tsx`, `ReportesTab.tsx` |
| K15 | `textosFinancieros` (pura) arma los dos KPI de Dirección; criterio 3 de la spec corregido para decir lo que muestra Dirección | `direccion/queries.ts`, `direccion/page.tsx`, spec |

Lecturas y desvíos de esta pasada (ninguna corrección se dejó sin aplicar):

1. **K1, «no borrador» incluye las anuladas.** Es la regla E1 tal como la aplica el subdiario (`f.status !== "borrador"`). Una anulada en VES o CNY puede conservar su asiento al nominal (B1 + B2), así que el lector del ingreso ahora trae las anuladas; no suman, solo cuentan para `enOtraMoneda`. Cambia el filtro SQL que fijaban las pruebas (`[...ESTADOS_DE_INGRESO, "anulada"]`).
2. **K2, «4.5 no tiene movimiento» se lee sobre el lado que se compara**: las líneas de 4.5 de asientos de factura (después de K3), no toda la 4.5. Un manual a 4.5 solo, sin facturas, da «sin movimiento» y se ve en «otros ingresos del mayor». Leerlo sobre toda la 4.5 habría devuelto «cuadra» con un 0 contra 0, que es lo que K2 prohíbe.
3. **K5**: de las dos opciones, el aviso dice cuántos asentados trae el CSV («El CSV trae solo los N asentados.»).
4. **K6, un poco más de lo pedido**: además del KPI, la leyenda y la nota, cambian la cabecera del CSV («Facturado con IVA USD») y la etiqueta accesible del gráfico. Es el mismo rótulo de la misma cifra; tiene su mutante (N25).
5. **K7**: la columna del CSV se llama «Sin tasa (al nominal: no USD)», sin coma, para que la cabecera no salga entre comillas.
6. **K8**: el texto concuerda en género por tipo («vivas» para facturas y CxP, «vivos» para recibos y pagos) y agrega «· M anuladas aparte».
7. **K14**: se hicieron las dos defensas, la función pura y que `ReportesTab` no pinte reportes con un error, cada una con su mutante (N46 y N47).
8. **Fixture compartido**: como F2, F6 y F7 están en VES o CNY, con K1 el control del fixture compartido es «no comparable» en los cuatro consumidores. Las pruebas que miden la diferencia pasaron a `FACTURAS_EN_USD` (el mismo fixture sin esas tres), y las del fixture completo afirman «no comparable». La cifra (2000 y 2 sin convertir) no cambia.
9. **Prueba existente ajustada, no debilitada**: el caso SDD-0465 del Dashboard ahora espera «1 factura(s) en el año · sin IVA · incluye $800 de terceros», porque la factura del fixture no trae `fund_class` y es de terceros por el default de la 0122.
10. **El commit del merge** (`da7f09f0`) lleva el mensaje por defecto de `git merge --no-edit`, sin la línea `Co-Authored-By`, como pedía el encargo.
11. Los verificadores de la revisión refutaron varios de estos hallazgos por ser lo que la spec aprobada decía: los dos verificadores en la lente contable H0, H2, H3, H4 y H6 y en la lente corrección H0, y uno de los dos en la lente contable H5 y H7. Las correcciones los mandan aplicar, y la spec quedó actualizada para decir lo nuevo.

### Merge de main, segundo (2026-10-19)

- `git fetch origin main` y `git merge --no-edit origin/main` (sin rebase): `origin/main` en `7fba5711` (#282, SDD-0561, el candado de las migraciones aplicadas). Merge `4770174b`, **sin conflictos**: el índice de specs entró solo y no hubo que regenerarlo (`✓ docs:check — índice sincronizado con 546 specs`).
- Candado sobre el árbol fusionado: `node scripts/migrations-lock.mjs verificar` → `migrations-lock: 483 selladas (la mayor: 0491) · 2 espera(s) sin sellar (0422_payment_report_command_boundary, 0423_payment_report_historical_identity) · 0 nueva(s) sin sellar · historia comparada contra 7fba57119535`, exit 0. Su prueba, `node --test scripts/tests/migrations-lock.node.mjs`: `ℹ pass 22`, `ℹ fail 0`. Esta SDD no lleva migración.
- Inventario de lecturas (`invoice-read-boundary`) sobre el árbol fusionado: `Tests  4 passed (4)`. La tercera vuelta no agrega lecturas de `invoices`.
- El commit del merge lleva el mensaje por defecto de `git merge --no-edit`, sin `Co-Authored-By`, como el primero.

### Tercera vuelta (L1 a L10, revisión del delta K1 a K15)

Pedido: `correcciones-0557-b.md`; hallazgos en `correccion-0557.json` → `revision`. Se aplicaron los diez.

| # | Qué | Dónde | Mutantes |
|---|---|---|---|
| L1 | **El mayor vacío gana sobre «no comparable» (B3).** Si las líneas de 4.5 de los asientos de factura no tienen debe ni haber y hay facturado o facturas sin convertir, el estado es `mayor_menor`, `diferenciaUsd` = `facturado.total` y la tarjeta lleva el enlace a Por contabilizar: «El mayor (cuenta 4.5) tiene $X menos que lo facturado: no tiene ningún asiento de factura en el período.» «No comparable» queda solo con asientos de factura en 4.5 y alguna factura en VES o CNY. Orden de `describirIngreso`: sin cuenta → mayor vacío → sin movimiento → no comparable → diferencia. Pruebas con una factura VES sin ningún asiento en `ingreso-periodo`, en el lector (`libro-control-queries`), en la tarjeta (`reportes-tab`) y en el CSV | `ingreso-periodo.ts` (`resumirIngreso`, `describirIngreso`) | N52, N53, N54 |
| L2 | **Dirección nombra lo que compara**: «cuadra con 4.5 de facturas: $X», «4.5 de facturas: $X», «4.5 de facturas: no comparable, hay facturas en bolívares o yuanes», «sin asientos de factura en 4.5» (sin movimiento o mayor vacío) y «sin cuenta 4.5 en el plan de cuentas». Con `mayor.otrosIngresos ≠ 0`, «otros ingresos del libro: $Y». El margen sigue «sobre los ingresos del libro». Casos nuevos: manual a 4.5 sin facturas (ingresos 700) y VES con el mayor vacío | `direccion/queries.ts` (`textosFinancieros`) | N55, N56, N57; N11, N50 y N51 cambiaron su texto de origen |
| L3 | **Con «no comparable», 4.5 no se pinta como dólares**: la tarjeta muestra «nominal mixto (no USD)» (`NOMINAL_MIXTO`); en el CSV del P&L la fila pasa a «En el mayor · cuenta 4.5 · asientos de factura: nominal mixto (no USD)» con la celda vacía | `IngresoDelPeriodoCard.tsx`, `export-csv.ts` | N58, N59 |
| L4 | **Ticket promedio**: «3 factura(s) en el año · sin IVA · $1.3K de los $2.3K del año son de terceros», en vez de colgarlo del ticket | `dashboard-kpi-queries.ts` | N60, N61; N17 cambió su texto de origen |
| L5 | **Sin números internos en la pantalla**: «La comparación vuelve cuando el asiento de venta se registre en USD (fase 2 del plan de trabajo de contabilidad).» Era la única aparición visible; el encabezado de `ingreso-periodo.ts` decía lo mismo y también se corrigió. Después del cambio, `git grep -n -i "plan contable\|tarea [0-9]\.[0-9]"` en `lib`, `app` y `components`, sin pruebas, da una sola línea, un comentario sin número de tarea: `PorContabilizarTab.tsx:13: * No asienta nada: reparar el posting es la fase 2 del plan contable.` | `ingreso-periodo.ts` | N62 |
| L6 | **K10 en positivo**: un recibo vivo en USD, y otro en USDT, con asiento `receipt` asentado deja el subdiario de clientes en `cuadra` | `libro-control-queries.test.ts` (`conReciboVes` con moneda) | N63 |
| L7 | **El tope «hasta» del lector de asientos de factura**: un asiento `invoice` del 2025-03-25 (después del rango) en «sin mayor dado» y una prueba directa de los filtros de `saldosDeFacturas` (gte y lte por página). Se corrigió el comentario: estado, borrado y origen se repiten en memoria; el rango va solo en SQL, como en `accountBalances` | `libro-control-queries.ts` (comentario), su prueba | N64 |
| L8 | **ERR-01 de `saldosDeFacturas`** con `serverCap: 1`: 61 asientos de factura en el rango rechazan con «Control del mayor · asientos de factura: …» y 30 asientos con 60 líneas, con «Control del mayor · líneas de factura: …» | `libro-control-queries.test.ts` | N65, N66 |
| L9 | **El ícono que se pinta**: dentro de `ingreso-control`, el path del check (`m7 12 3 3 7-7`) no existe en «no comparable» ni en «sin movimiento» y sí en «cuadra» | `reportes-tab.test.tsx` | N67 |
| L10 | **USDT no es «sin tasa»**: una CxP pendiente en USDT sin tasa no cuenta en `sinTasa` (suma 1:1) | `libro-control.test.ts` | N68 |

Lecturas y desvíos de esta vuelta:

1. **L1 cambia la precedencia que K1 había pedido.** Los dos verificadores de la revisión refutaron el hallazgo porque K1 y la spec decían «no comparable aunque no se haya convertido»; el pedido b lo manda aplicar y la spec quedó con la tabla de estados en orden. **El subdiario de clientes no cambia**: L1 habla de las líneas de 4.5 de los asientos de factura, y en `subdiario.ts` «no comparable» sigue antes de «sin movimiento» (E1 tal cual). Va como pregunta abierta 6 de la spec.
2. **L1 con solo facturas sin convertir** (VES sin tasa o CNY) y 4.5 vacía: el facturado es 0, así que el estado es `mayor_menor` con diferencia 0 y un texto sin monto: «El mayor (cuenta 4.5) no tiene ningún asiento de factura en el período, y las facturas sin convertir también deberían tenerlo.» Tiene prueba y mutante (N54). Con eso, la condición «sin facturas sin convertir» de `sin_movimiento`, que en la segunda pasada no tenía mutante, queda cubierta.
3. **L1, borde**: facturas que suman 0 con 4.5 vacía y ninguna sin convertir siguen comparándose 0 contra 0 («cuadra»), como antes. No tiene prueba propia.
4. **L3, un poco más de lo pedido en el CSV**: la fila de conteo pasa de «(asentadas al nominal)» a «(cantidad)», porque con 4.5 vacía no están asentadas y la celda es un número de facturas, no un monto. Los rótulos nuevos no llevan coma para que no salgan entre comillas.
5. **L7**: de las dos opciones se tomó corregir el comentario, sin traer `entry_date`. Así el mutante del `.lte` muere por el asiento posterior (4.5 subiría a 850) y por la prueba directa de los filtros. Repetir la fecha en memoria habría obligado a sembrar `entry_date` en los dobles de Reportes y Dirección, que no filtran.
6. **L2, el margen**: el texto no cambia («Margen N% sobre los ingresos del libro»). Ahora el lado comparado se llama «4.5 de facturas» y lo demás «otros ingresos del libro», así que «los ingresos del libro» ya no tiene dos sentidos. Sin cuenta 4.5, todos los ingresos del mayor salen como otros ingresos.
7. **Prueba ajustada, no debilitada**: la primera prueba de `ingresoDelPeriodo` pasaba `control(0)` (sin movimiento) con el fixture en VES y CNY y esperaba «no comparable». Con L1 eso es «el mayor tiene menos», así que pasa a `control(1500)` para seguir probando «no comparable» y los filtros SQL; el caso del mayor vacío tiene sus propias pruebas. En `export-csv.test.ts` pasa lo mismo con la factura en bolívares, y se agregó el caso con 4.5 vacía.
8. **L8, la prueba de filtros**: el doble arma la consulta una vez por página (la de datos y la vacía del final), así que la prueba exige el par gte/lte en cada página y no una lista exacta de dos.

### Quinta vuelta: decisiones 6 y 7 del Director (M1 a M3)

Pedido: `correcciones-0557-c.md`, sobre la cabeza `0b73e864` (PR #283). Las preguntas abiertas 6 y 7 de la spec las respondió el Director, y quedan en la spec como «decisión del Director, 2026-10-19, revisable por Sam», con su texto literal. Se aplicaron las tres.

| # | Qué | Dónde | Mutantes |
|---|---|---|---|
| M1 | **«No comparable» cuenta solo las facturas VES o CNY con su asiento `invoice` vivo** (decisión 7). `FacturaDeIngreso` lleva `id`; `ControlDelMayor` lleva `facturasConAsiento`, que sale de la MISMA lectura de `saldosDeFacturas` (ahora `select` con `invoice_id` y devuelve `{ saldos, facturas }`), sin otra consulta. Sin control (Dashboard), `enOtraMoneda` es 0. El CSV del P&L rotula la fila «Facturas del período en bolívares o yuanes con asiento de factura (cantidad)». Pruebas: en la regla pura, una USD asentada más una VES sin asiento, con 4.5 en movimiento, da la diferencia normal (1000, «el mayor tiene menos»), y la misma VES con asiento da «no comparable»; lo mismo por el lector sobre el doble que filtra, con los controles del asiento anulado y del crédito de referido; y una prueba directa de que `saldosDeFacturas` solo saca la factura del asiento vivo del rango | `ingreso-periodo.ts`, `libro-control-queries.ts`, `export-csv.ts`, `dashboard-kpi-queries.ts` (lee `id`) | O01 a O05 |
| M2 | **El mayor vacío gana en el subdiario** (decisión 6): estado nuevo `mayor_sin_movimiento` («Sin movimiento en el mayor»), sin diferencia, con tono de aviso y la nota «Sin movimiento en el mayor (cuenta 1.1.2): las facturas abiertas no llegaron al mayor.». Gana sobre «no comparable». También en proveedores, por simetría, con 2.1.1 y «… las CxP abiertas no llegaron al mayor.». «No comparable» del subdiario cuenta la factura VES o CNY solo con su asiento vivo (`FacturaDelSubdiario.asientoVivo`, del mismo cruce de «sin asiento»); el recibo VES con asiento `receipt` vivo sigue contando (K10). Pruebas puras (VES abierta con 1.1.2 vacía; la precedencia con la VES asentada y con el recibo; una abierta sin convertir; proveedores; controles con movimiento y sin abiertas; CSV), por el lector (VES con y sin asiento contra 1.1.2 con movimiento, y 1.1.2 vacía) y en la pantalla (insignia, «—», nota y el SVG sin el check) | `subdiario.ts`, `libro-control.ts`, `libro-control-queries.ts`, `PorContabilizarTab.tsx` | O06 a O17 |
| M3 | Spec: sección «Decisiones del Director (2026-10-19)» con el texto literal de las dos, fila 4 de la tabla del control, tabla de estados del subdiario, Diseño, allowlist, criterios 2, 3 y 7, divergencias, preguntas abiertas y validación. Este handoff | spec, handoff | — |

Lecturas y desvíos de esta vuelta:

1. **Las facturas no tienen `journal_entry_id`.** El pedido dice «unido por `journal_entries.invoice_id` o `invoices.journal_entry_id`». Ninguna migración agrega esa columna a `invoices`: `git grep journal_entry_id -- supabase/migrations` la muestra en `payment_receipts` (0079), `supplier_bills` y `supplier_payments` (0088), `currency_conversions` y `partner_ledger_entries` (0114), `supplier_charges` y `supplier_claim_offsets` (0178) y `nomina_settlements` (0179). La spec ya lo decía. El vínculo de la factura es solo `journal_entries.invoice_id`; el cruce de «sin asiento» lo trata igual.
2. **«Con asiento vivo» quiere decir con asiento vivo en el rango del control.** Se reusa la lectura de `saldosDeFacturas`, que trae los asientos de factura con `entry_date` en el rango, como pedía el encargo. Son los que forman la 4.5 que se compara, así que son los que la distorsionan. Hoy el asiento se fecha el día de la emisión (`entryDate: today` en `facturacion/actions.ts` y `sales-orders/actions.ts`), igual que `issued_at`. Si la fase 2 asienta tarde, ver la divergencia nueva de la spec.
3. **La forma del mayor vacío no es igual en las dos pantallas.** El control del ingreso conserva L1 (con 4.5 vacía, «el mayor tiene menos» por todo lo facturado, con diferencia y enlace); el subdiario muestra «sin movimiento en el mayor» sin diferencia, como pide M2. Las dos dejan ganar al mayor vacío y ninguna dice «no comparable». Si el Director quiere que el ingreso tampoco muestre la diferencia, es un cambio de L1 que este pedido no hace.
4. **Proveedores**: la regla del mayor vacío se aplica por simetría (M2 lo pedía si correspondía). «No comparable» no se agrega a proveedores: el subdiario de CxP convierte con la regla del asiento (G8). La radiografía de la 0559 sí cuenta en 2.1.1 las CxP y los pagos no USD con asiento vivo; la diferencia está escrita en la spec.
5. **La nota de «no comparable» del subdiario cambió de texto** para decir lo que cuenta: «Clientes no es comparable: hay facturas o recibos en bolívares o yuanes con su asiento vivo; hoy la factura se asienta por su monto nominal y el cobro la convierte.» Antes decía solo «facturas», aunque el recibo también lo dispara.
6. **El Dashboard lee `id`**: no cambia ninguna cifra (pasa sin control del mayor), pero la fila se trata como `FacturaDeIngreso` y ahora el tipo exige el `id`. Quitar el `id` sería un mutante equivalente, así que no se agregó.
7. **Pruebas ajustadas, no debilitadas.** El `control()` del fixture da por asentadas las facturas F1 a F8 cuando 4.5 tiene movimiento, y ninguna cuando no; las pruebas con facturas propias pasan su lista. Las que esperaban `enOtraMoneda: 1` con una VES sin asiento y 4.5 vacía pasan a 0 (es la decisión 7), con el mismo estado. Los dobles de Dirección y Reportes siembran `ASIENTOS_EN_OTRA_MONEDA` (los asientos de F2, F6 y F7) para seguir probando «no comparable» con el fixture compartido. En Por contabilizar, la prueba de «No cuadra» tenía 1.1.2 sin movimiento: con la decisión 6 eso es «Sin movimiento en el mayor», así que la cuenta pasa a tener un debe y un haber que se anulan, y el caso vacío tiene su prueba propia.
8. **Mutantes del script principal que no aplicaban.** Al revisar el script antes de correrlo, `check-mutantes-0557.cjs` dio 7 que no aplicaban. Cinco (N03, N04, N12, N14 y N65) eran por el código de esta vuelta. Dos (N17 y N61, el ticket del Dashboard) no aplicaban desde la cuarta vuelta (`8df40599`), que cambió el ticket a un porcentaje: la línea `TOTAL: 111` del handoff anterior es de la corrida sobre `afe657c3`, antes de esa vuelta. Los siete se reescribieron sobre el código actual sin cambiar lo que miden, y N15 se ajustó a la sangría nueva.

## VALIDACIÓN

Todo sobre este worktree, en la rama de la tarea.

**Quinta vuelta (M1 a M3), sobre el código de `21f7a4ed`.** `origin/main` sigue en `7fba5711`, ya mergeado (`git merge-base --is-ancestor origin/main HEAD`), así que no hubo merge nuevo.

| Comprobación | Alcance | Resultado |
|---|---|---|
| `corepack pnpm verify` | completo, sobre `34b3bc99`, con el turno que dio el Director; de 2026-10-19 08:52:20Z a 09:13:11Z; Docker encendido; antes de lanzarlo, sin corridas pesadas y CPU al 12 % | exit 0, **16 de 17 pasos medidos y en verde**: `harness`, `lint`, `rsc-boundary`, `typecheck`, `edge-functions`, `test` (`Test Files  831 passed | 1 skipped (832)`, `Tests  11758 passed | 1 skipped (11759)`), `docs:check`, `numbering`, `feature-constants`, `components:check`, `governance:check`, `pending-migration-symbols` (0 rojo, 0 amarillo), `sql-tests`, `schema-rebuild`, `e2e` (177 passed, 20 skipped, 1 flaky; el aviso conocido del worker de WebKit que no cierra en Windows, sin fallos) y `build`. **NO MEDIDO: `migrations-applied`**, porque el worktree no tiene `.env.local` (a propósito). La prueba inestable es `e2e/auth.spec.ts:81` (`page.goto: net::ERR_ABORTED` en `/acceso/<token>`), la misma de las #277 y #280, ajena al diff. El registro quedó guardado en el scratchpad (`verify-0557.log`) |
| Sexta vuelta (revisor de M1/M2: «listo con ajustes menores») · vitest de las carpetas de la tarea, los 7 consumidores del doble de listados y los contratos | accounting, contabilidad, reportes, la ruta, reports, dirección, dashboard, fiscal, `rbac-api-guard`, `studio-api-auth-guard`, `invoice-read-boundary`, `spec-migration-refs` | PASÓ: `Test Files  43 passed (43)`, `Tests  661 passed (661)`. Ajustes: el doble de listados gana `proyectar` (devuelve solo las columnas del `select`, a pedido) y la prueba de la decisión 7 corre con él; en el subdiario, un asiento solo anulado o de referido no es vivo (da la diferencia, como en Reportes); el tono de aviso de «Sin movimiento en el mayor» se prueba por el triángulo que se pinta; la nota dice «no llegaron al mayor» (un asiento vivo sin líneas también deja la cuenta en 0, FUERA DE ALCANCE #12) |
| Sexta vuelta · mutantes (`mutantes-0557-m.mjs`; log `mutantes-0557-m.log`) | Q1 (`invoice_id` fuera del select), Q2 (asiento anulado contado como vivo en el subdiario), Q3 (el aviso pasa a neutral) y Q4 (la nota vieja): los tres primeros son los que el revisor dejó vivos | PASÓ: «Todos los mutantes murieron.», 4 de 4 con exit 1 y la línea `Tests … failed` |
| Sexta vuelta · `typecheck` y eslint `--max-warnings=0` (5 archivos) | repo y archivos tocados | PASÓ (exit 0) |
| `vitest run` (binario del worktree) sobre accounting, contabilidad y reportes (app), la ruta, reports, dirección, dashboard, fiscal y los contratos `rbac-api-guard`, `studio-api-auth-guard`, `invoice-read-boundary` y `spec-migration-refs` | 38 archivos (lista en `vitest-0557-m.json` del scratchpad) | PASÓ: `Test Files  38 passed (38)`, `Tests  597 passed (597)`, exit 0, antes y después de la corrida de mutantes. La carpeta `app/studio/(app)/direccion` no tiene pruebas |
| Mutantes (`mutantes-0557.cjs`) | los 111 anteriores y 17 nuevos (O01 a O17) | PASÓ: `TOTAL: 128 mutantes · 128 MUERTOS · 0 SOBREVIVEN · 0 NO APLICADOS`, exit 0; `check-mutantes-0557.cjs` después: `128 mutantes, 0 que no aplican una vez` |
| Mutantes de la cuarta vuelta (`mutantes-0557-final.mjs`) | P1 a P8 | PASÓ: «Todos los mutantes murieron.», exit 0 |
| `tsc --noEmit` (con `prune-next-types`, como `typecheck`) | repo completo | PASÓ: exit 0 (`[tipos-de-ruta] sanos — nada que podar`) |
| `eslint --max-warnings=0` | los 18 `.ts`/`.tsx` tocados en esta vuelta | PASÓ: exit 0, sin salida |
| `node scripts/check-rsc-boundary.mjs` | app, lib | PASÓ: `sin cruces server→client de valores ni client→node: transitivos` (1695 módulos) |
| `node scripts/build-docs-index.mjs` y `docs:check` | índice | PASÓ: `✓ índice regenerado en docs\specs\README.md — 546 specs, 15 huecos`, sin diff; `✓ docs:check — índice sincronizado con 546 specs` |
| `sdd:check` | numeración | PASÓ: `numbering: sin números repetidos` (con los choques históricos 0342 y 0394 ya aplicados) |
| `governance:check` | cápsula | PASÓ: `Gobernanza: 28 política(s) aprobada(s) · cápsula vigente` |
| `components:check` | registro CMP | PASÓ: `CMP-01 válido: 5 fuente(s), agregado reproducible y cero rutas rotas` |
| `node scripts/migrations-lock.mjs verificar` y `node --test scripts/tests/migrations-lock.node.mjs` | candado de la SDD-0561 | PASÓ: `migrations-lock: 483 selladas (la mayor: 0491) · 2 espera(s) sin sellar (0422_payment_report_command_boundary, 0423_payment_report_historical_identity) · 0 nueva(s) sin sellar · historia comparada contra 7fba57119535`, exit 0; `ℹ pass 22`, `ℹ fail 0` |
| `/ui-check` rápido | la insignia y la nota nuevas de Por contabilizar | PASÓ, sin hallazgos (abajo, «/ui-check, quinta vuelta») |
| Comprobación en el navegador | — | NO EJECUTADA: sin `.env.local` en el worktree, a propósito |
| `pnpm verify` | — | (en esa vuelta) NO EJECUTADO; ver la fila del verify completo sobre `34b3bc99` arriba |

**Tercera vuelta (L1 a L10, después del segundo merge de main), sobre el código de `afe657c3`.** Las de las pasadas anteriores quedan en el historial de este archivo (`2e901f98` y `d0003efa`).

| Comprobación | Alcance | Resultado |
|---|---|---|
| `vitest run` (binario del worktree) sobre accounting, contabilidad, reportes y dirección (app), la ruta, reports, dirección, dashboard, fiscal y los contratos `rbac-api-guard`, `studio-api-auth-guard`, `invoice-read-boundary` y `spec-migration-refs` | 38 archivos | PASÓ: `Test Files  38 passed (38)`, `Tests  591 passed (591)`, exit 0 (antes y después de la corrida de mutantes) |
| El commit `287d264d` solo (sin las pruebas de L6, L7, L8 y L10) | accounting, contabilidad, reportes, la ruta, reports, dirección, dashboard | PASÓ: `Tests  419 passed (419)`; se armó la versión intermedia de `libro-control-queries.test.ts` y se restauró la final (sha256 igual) |
| `invoice-read-boundary` sobre el árbol fusionado | inventario | PASÓ: `Tests  4 passed (4)` |
| `node scripts/migrations-lock.mjs verificar` y `node --test scripts/tests/migrations-lock.node.mjs` sobre el árbol fusionado | candado de la SDD-0561 | PASÓ: exit 0 (línea literal en «Merge de main, segundo»); `ℹ pass 22`, `ℹ fail 0` |
| Cuarta vuelta (revisor final: «listo con ajustes menores») · vitest de las carpetas de la tarea y los contratos | accounting, contabilidad, reportes y dirección (app), la ruta, reports, dirección, dashboard, fiscal, `rbac-api-guard`, `studio-api-auth-guard`, `invoice-read-boundary`, `spec-migration-refs` | PASÓ: `Test Files  39 passed (39)`, `Tests  597 passed (597)`. Ajustes: la diferencia sin monto en USD va en null, el texto nombra cuántas facturas faltan, la nota del mayor mezclado sale en el estado de resultados gerencial y en la utilidad de Dirección, el ticket usa un porcentaje y hay una prueba de 4.5 con movimiento que suma 0 (el mutante R12 del revisor) |
| Cuarta vuelta · mutantes (`mutantes-0557-final.mjs`; log `mutantes-0557-final.log`) | 8 mutantes P1–P8 de los ajustes | PASÓ: «Todos los mutantes murieron.», 8 de 8 con exit 1 y la línea `Tests … failed` |
| Cuarta vuelta · `typecheck`, eslint `--max-warnings=0` (8 archivos) y `check-rsc-boundary` | repo y archivos tocados | PASÓ (exit 0) |
| Mutantes (`mutantes-0557.cjs` en el scratchpad; uno por vez, restaura en `finally`; log `mutantes-0557.log`, el anterior en `mutantes-0557.antes-l.log`) | los 94 anteriores y 17 nuevos (L1 a L10) | `TOTAL: 111 mutantes · 111 MUERTOS · 0 SOBREVIVEN · 0 NO APLICADOS`, todos con exit 1 y la línea `Tests … failed` (tabla abajo). Después, `check-mutantes-0557.cjs`: `111 mutantes, 0 que no aplican una vez` (el código quedó como estaba) |
| `tsc --noEmit` (con `prune-next-types`, como `typecheck`) | repo completo | PASÓ (exit 0; `[tipos-de-ruta] sanos — nada que podar`) |
| `eslint --max-warnings=0` | los 13 archivos tocados en la tercera vuelta | PASÓ (exit 0, sin salida) |
| `node scripts/check-rsc-boundary.mjs` | app, lib | PASÓ: `sin cruces server→client de valores ni client→node: transitivos` (1695 módulos) |
| `docs:check` (`build-docs-index.mjs --check`) | índice | PASÓ: `✓ docs:check — índice sincronizado con 546 specs` |
| `sdd:check` (`check-numbering.mjs`) | numeración | PASÓ: `numbering: sin números repetidos` (avisa los choques históricos 0342, 0363 y 0394, ya aplicados) |
| `governance:check` | cápsula | PASÓ: `Gobernanza: 28 política(s) aprobada(s) · cápsula vigente` |
| `components:check` | registro CMP | PASÓ: `CMP-01 válido: 5 fuente(s), agregado reproducible y cero rutas rotas` |
| `git diff --check` | diff de la tercera vuelta | PASÓ |
| `git grep -n "monthRevenue +=" -- lib app` | criterio 1 | sin resultados (exit 1) |
| `/ui-check` | textos y tonos nuevos | PASÓ con hallazgos menores (abajo, «/ui-check, tercera vuelta») |
| Comprobación en el navegador | — | NO EJECUTADA: el worktree no tiene `.env.local` (a propósito) y las pantallas necesitan sesión y base. Las pruebas montan los componentes en jsdom |
| `pnpm verify` | — | (en esa vuelta) NO EJECUTADO; ver la fila del verify completo sobre `34b3bc99` arriba |

### Mutantes

Corrida del 2026-10-19, de 04:27 a 04:31 en Caracas (UTC 08:27:10 a 08:31:30), sobre el commit `21f7a4ed` (uno por vez; el script exige exit 1 y la línea `Tests … failed`, y restaura cada archivo en `finally`; después, `git status` no muestra cambios en `lib` ni `app`). Línea final del log (`mutantes-0557.log`):

```
TOTAL: 128 mutantes · 128 MUERTOS · 0 SOBREVIVEN · 0 NO APLICADOS
```

La corrida anterior de esta vuelta, antes de la prueba de la cabecera sin líneas, dio `TOTAL: 128 mutantes · 127 MUERTOS · 1 SOBREVIVEN · 0 NO APLICADOS` (`mutantes-0557.n52-vivo.log`): sobrevivía N52, porque con la decisión 7 una VES sin asiento ya no cuenta en `enOtraMoneda` y el disyunto «4.5 sin movimiento» de `comparable` solo pesa si una factura VES o CNY tiene asiento vivo pero 4.5 no tiene debe ni haber. Eso pasa de verdad: `invoice-posting.ts` inserta la cabecera y después las líneas sin transacción, y si el rollback manual del header falla queda un asiento vivo sin líneas. Se agregó esa prueba (el mayor vacío gana igual, con diferencia) y N52 murió; no se quitó código.

Los ocho de la cuarta vuelta (`mutantes-0557-final.mjs`, log `mutantes-0557-final.log`, UTC 08:31:30 a 08:31:45, sobre `21f7a4ed`): «Todos los mutantes murieron.», P1 a P8 con exit 1 y la línea `Tests … failed`.

M01 a M43 son los de la primera pasada; M07 y M30 cambiaron su texto de origen porque K1 y K5 cambiaron el código que mutan. N01 a N51 son los de K1 a K15; N52 a N68, los de L1 a L10. En esta vuelta, N03, N04, N12, N14, N15 y N65 cambiaron su texto de origen porque M1 cambió el código que mutan, y N17 y N61 porque la cuarta vuelta cambió el ticket a un porcentaje; ninguno cambia lo que mide. O01 a O17 son los de M1 y M2.

| # | Regresión | Resultado |
|---|---|---|
| M01 | resumirIngreso suma total_amount (con IVA) en vez de base_amount | MUERTO · exit 1 · `Tests  13 failed \| 25 passed (38)` |
| M02 | la fecha de la regla es created_at, no issued_at | MUERTO · exit 1 · `Tests  8 failed \| 30 passed (38)` |
| M03 | sin filtro de estado en memoria | MUERTO · exit 1 · `Tests  9 failed \| 29 passed (38)` |
| M04 | VES sin tasa cuenta como convertible | MUERTO · exit 1 · `Tests  3 failed \| 35 passed (38)` |
| M05 | el extremo «hasta» deja de ser inclusivo | MUERTO · exit 1 · `Tests  1 failed \| 37 passed (38)` |
| M06 | la regla no vuelve a filtrar borradas en memoria | MUERTO · exit 1 · `Tests  15 failed \| 62 passed (77)` |
| M07 | el control compara contra todas las cuentas 4, no contra 4.5 | MUERTO · exit 1 · `Tests  4 failed \| 129 passed (133)` |
| M08 | DAT-01: el rango inverso pasa en silencio | MUERTO · exit 1 · `Tests  1 failed \| 37 passed (38)` |
| M09 | comprobación con el saldo acumulado (rollup) en vez del directo | MUERTO · exit 1 · `Tests  4 failed \| 31 passed (35)` |
| M10 | el cruce empareja por FK sin mirar el source | MUERTO · exit 1 · `Tests  1 failed \| 62 passed (63)` |
| M11 | un asiento anulado cuenta como vivo | MUERTO · exit 1 · `Tests  3 failed \| 60 passed (63)` |
| M12 | el vínculo solo en un sentido (sin journal_entry_id del documento) | MUERTO · exit 1 · `Tests  1 failed \| 34 passed (35)` |
| M13 | un documento con monto 0 sale como «sin asiento» | MUERTO · exit 1 · `Tests  2 failed \| 33 passed (35)` |
| M14 | el aviso del diario aparece aunque se vean todos | MUERTO · exit 1 · `Tests  2 failed \| 37 passed (39)` |
| M15 | el CSV del diario sin neutralizar fórmulas (como buildCsv) | MUERTO · exit 1 · `Tests  2 failed \| 43 passed (45)` |
| M16 | el subdiario de clientes incluye borradores | MUERTO · exit 1 · `Tests  2 failed \| 33 passed (35)` |
| M17 | el subdiario descarta saldos negativos (max 0) | MUERTO · exit 1 · `Tests  2 failed \| 33 passed (35)` |
| M18 | proveedores convierte con invoiceUsdAmount (CNY → 0), no con la regla del asiento | MUERTO · exit 1 · `Tests  2 failed \| 33 passed (35)` |
| M19 | sin la regla «no comparable» de B2 (E1) | MUERTO · exit 1 · `Tests  2 failed \| 33 passed (35)` |
| M20 | ingresoDelPeriodo sin .is(deleted_at) en SQL | MUERTO · exit 1 · `Tests  1 failed \| 27 passed (28)` |
| M21 | el diario se lee de una sola vez (sin fetchAllPaged real) | MUERTO · exit 1 · `Tests  4 failed \| 24 passed (28)` |
| M22 | el diario sin .eq(status, asentado) | MUERTO · exit 1 · `Tests  5 failed \| 33 passed (38)` |
| M23 | el cruce sin .in(source, …) en SQL | MUERTO · exit 1 · `Tests  1 failed \| 27 passed (28)` |
| M24 | countEntries cuenta borradores como asentados | MUERTO · exit 1 · `Tests  1 failed \| 27 passed (28)` |
| M25 | la ruta no corta con el gate | MUERTO · exit 1 · `Tests  1 failed \| 9 passed (10)` |
| M26 | la ruta no valida las fechas | MUERTO · exit 1 · `Tests  2 failed \| 8 passed (10)` |
| M27 | la ruta pide el módulo reports (equivalente en la matriz; lo fija el contrato AST) | MUERTO · exit 1 · `Tests  1 failed \| 16 passed (17)` |
| M28 | el contador del diario vuelve a ser entries.length | MUERTO · exit 1 · `Tests  1 failed \| 3 passed (4)` |
| M29 | los asentados se cuentan sobre la lista de pantalla | MUERTO · exit 1 · `Tests  1 failed \| 3 passed (4)` |
| M30 | sin el texto del enlace al diario (K5: el rótulo cambió a «asentado») | MUERTO · exit 1 · `Tests  1 failed \| 3 passed (4)` |
| M31 | la exportación con fechas no valida antes de enviar | MUERTO · exit 1 · `Tests  1 failed \| 3 passed (4)` |
| M32 | el diario junto a la comprobación lleva desde (no cuadra con la tabla) | MUERTO · exit 1 · `Tests  1 failed \| 8 passed (9)` |
| M33 | la pestaña vuelve a decir Cashflow | MUERTO · exit 1 · `Tests  3 failed \| 3 passed (6)` |
| M34 | el eyebrow del estado vacío vuelve a decir Cashflow | MUERTO · exit 1 · `Tests  1 failed \| 5 passed (6)` |
| M35 | el slug de la pestaña cambia sin alias | MUERTO · exit 1 · `Tests  1 failed \| 5 passed (6)` |
| M36 | el CSV conserva el slug contable-cashflow | MUERTO · exit 1 · `Tests  2 failed \| 26 passed (28)` |
| M37 | el CSV del P&L usa la condición vieja de vacío | MUERTO · exit 1 · `Tests  3 failed \| 19 passed (22)` |
| M38 | vistaDelEstado manda al vacío aunque haya facturado | MUERTO · exit 1 · `Tests  2 failed \| 43 passed (45)` |
| M39 | sin el preset Este mes | MUERTO · exit 1 · `Tests  3 failed \| 70 passed (73)` |
| M40 | Reportes calcula el ingreso sobre otro rango | MUERTO · exit 1 · `Tests  2 failed \| 26 passed (28)` |
| M41 | Dirección calcula el margen con el facturado | MUERTO · exit 1 · `Tests  2 failed \| 37 passed (39)` |
| M42 | Dashboard usa el reloj en vez de hoy | MUERTO · exit 1 · `Tests  3 failed \| 5 passed (8)` |
| M43 | Dashboard: ticket promedio con otra base | MUERTO · exit 1 · `Tests  1 failed \| 7 passed (8)` |
| N01 | K1: la diferencia se calcula aunque haya facturas en VES o CNY | MUERTO · exit 1 · `Tests  8 failed \| 156 passed (164)` |
| N02 | K1: describirIngreso sin el estado no_comparable | MUERTO · exit 1 · `Tests  14 failed \| 122 passed (136)` |
| N03 | K1: las anuladas en VES o CNY no cuentan (solo las de ingreso) | MUERTO · exit 1 · `Tests  2 failed \| 64 passed (66)` |
| N04 | K1: un borrador en VES también vuelve no comparable | MUERTO · exit 1 · `Tests  1 failed \| 37 passed (38)` |
| N05 | K1: el lector del ingreso no trae las anuladas | MUERTO · exit 1 · `Tests  3 failed \| 53 passed (56)` |
| N06 | K1: la tarjeta pone «no comparable» con el ícono de éxito | MUERTO · exit 1 · `Tests  2 failed \| 7 passed (9)` |
| N07 | K1: el CSV del P&L sin la fila del estado del control | MUERTO · exit 1 · `Tests  3 failed \| 19 passed (22)` |
| N08 | K2: sin el estado sin_movimiento (0 contra 0 dice «cuadra») | MUERTO · exit 1 · `Tests  6 failed \| 108 passed (114)` |
| N09 | K2: el movimiento de 4.5 se mide por el saldo y no por debe/haber | MUERTO · exit 1 · `Tests  1 failed \| 37 passed (38)` |
| N10 | K2: la tarjeta pone «sin movimiento» con el ícono de éxito | MUERTO · exit 1 · `Tests  1 failed \| 8 passed (9)` |
| N11 | K2: Dirección dice «cuadra con 4.5 de facturas» sin movimiento | MUERTO · exit 1 · `Tests  2 failed \| 37 passed (39)` |
| N12 | K3: el control usa toda la 4.5 (también los manuales) | MUERTO · exit 1 · `Tests  4 failed \| 91 passed (95)` |
| N13 | K3: el lector de asientos de factura sin .eq(source) en SQL | MUERTO · exit 1 · `Tests  2 failed \| 54 passed (56)` |
| N14 | K3: sin repetir el origen en memoria (asientos) | MUERTO · exit 1 · `Tests  2 failed \| 65 passed (67)` |
| N15 | K3: sin repetir el asiento en memoria (líneas) | MUERTO · exit 1 · `Tests  2 failed \| 65 passed (67)` |
| N16 | K4: el Dashboard no dice cuánto es de terceros | MUERTO · exit 1 · `Tests  2 failed \| 6 passed (8)` |
| N17 | K4: el ticket promedio dice los terceros del mes y no del año | MUERTO · exit 1 · `Tests  1 failed \| 7 passed (8)` |
| N18 | K5: el rótulo vuelve a «el diario completo» | MUERTO · exit 1 · `Tests  2 failed \| 37 passed (39)` |
| N19 | K5: el aviso no dice cuántos asentados trae el CSV | MUERTO · exit 1 · `Tests  2 failed \| 37 passed (39)` |
| N20 | K5: el aviso cuenta los asentados con el total | MUERTO · exit 1 · `Tests  1 failed \| 3 passed (4)` |
| N21 | K5: el botón vuelve a «Exportar diario (CSV)» | MUERTO · exit 1 · `Tests  1 failed \| 3 passed (4)` |
| N22 | K6: el KPI vuelve a «Facturado» | MUERTO · exit 1 · `Tests  1 failed \| 5 passed (6)` |
| N23 | K6: la leyenda vuelve a «Facturado» | MUERTO · exit 1 · `Tests  1 failed \| 5 passed (6)` |
| N24 | K6: la nota no dice «con IVA» | MUERTO · exit 1 · `Tests  1 failed \| 5 passed (6)` |
| N25 | K6: la cabecera del CSV vuelve a «Facturado USD» | MUERTO · exit 1 · `Tests  1 failed \| 21 passed (22)` |
| N26 | K7: no cuenta las CxP sin tasa | MUERTO · exit 1 · `Tests  2 failed \| 37 passed (39)` |
| N27 | K7: cuenta también las que tienen tasa | MUERTO · exit 1 · `Tests  1 failed \| 34 passed (35)` |
| N28 | K7: sin la nota de las CxP sin tasa | MUERTO · exit 1 · `Tests  2 failed \| 37 passed (39)` |
| N29 | K7: el CSV del subdiario sin la columna de sin tasa | MUERTO · exit 1 · `Tests  4 failed \| 31 passed (35)` |
| N30 | K8: el denominador vuelve a ser revisados (con anulados) | MUERTO · exit 1 · `Tests  2 failed \| 37 passed (39)` |
| N31 | K8: los anulados se cuentan como vivos | MUERTO · exit 1 · `Tests  5 failed \| 62 passed (67)` |
| N32 | K9: el diario completo sin .is(deleted_at) | MUERTO · exit 1 · `Tests  3 failed \| 35 passed (38)` |
| N33 | K10: el conteo de recibos VES/CNY con asiento vale 0 | MUERTO · exit 1 · `Tests  1 failed \| 27 passed (28)` |
| N34 | K10: cuenta también el recibo anulado | MUERTO · exit 1 · `Tests  1 failed \| 27 passed (28)` |
| N35 | K10: cuenta el recibo aunque su asiento esté anulado | MUERTO · exit 1 · `Tests  1 failed \| 27 passed (28)` |
| N36 | K11: los recibos se leen sin los anulados | MUERTO · exit 1 · `Tests  1 failed \| 27 passed (28)` |
| N37 | K11: los pagos se leen sin los anulados | MUERTO · exit 1 · `Tests  1 failed \| 27 passed (28)` |
| N38 | K11: el recibo anulado se mapea como vivo | MUERTO · exit 1 · `Tests  2 failed \| 26 passed (28)` |
| N39 | K11: el pago anulado se mapea como vivo | MUERTO · exit 1 · `Tests  1 failed \| 27 passed (28)` |
| N40 | K11: las CxP no llegan al subdiario | MUERTO · exit 1 · `Tests  1 failed \| 27 passed (28)` |
| N41 | K12: el diario sin el criterio de fecha | MUERTO · exit 1 · `Tests  1 failed \| 34 passed (35)` |
| N42 | K12: el diario sin «debe antes que haber» | MUERTO · exit 1 · `Tests  1 failed \| 34 passed (35)` |
| N43 | K12: el cruce sin el criterio de fecha | MUERTO · exit 1 · `Tests  1 failed \| 34 passed (35)` |
| N44 | K13: leerCompleto no lanza con la lectura incompleta | MUERTO · exit 1 · `Tests  3 failed \| 35 passed (38)` |
| N45 | K13: las líneas del diario no lanzan con la lectura incompleta | MUERTO · exit 1 · `Tests  1 failed \| 27 passed (28)` |
| N46 | K14: con error, la página cae al mes en curso | MUERTO · exit 1 · `Tests  1 failed \| 34 passed (35)` |
| N47 | K14: la pestaña pinta reportes debajo del error | MUERTO · exit 1 · `Tests  1 failed \| 8 passed (9)` |
| N48 | K15: la utilidad pierde «libro» | MUERTO · exit 1 · `Tests  1 failed \| 38 passed (39)` |
| N49 | K15: el ingreso pierde «sin IVA» | MUERTO · exit 1 · `Tests  1 failed \| 38 passed (39)` |
| N50 | K15/L2: «4.5 de facturas» muestra la diferencia y no el saldo de 4.5 | MUERTO · exit 1 · `Tests  5 failed \| 34 passed (39)` |
| N51 | K15: no comparable dice «cuadra con 4.5 de facturas» | MUERTO · exit 1 · `Tests  2 failed \| 37 passed (39)` |
| N52 | L1: con 4.5 vacía y una factura en VES, la diferencia vuelve a null | MUERTO · exit 1 · `Tests  1 failed \| 135 passed (136)` |
| N53 | L1: «no comparable» vuelve a ganar sobre el mayor vacío (el orden de K1) | MUERTO · exit 1 · `Tests  5 failed \| 131 passed (136)` |
| N54 | L1: solo facturas sin convertir con 4.5 vacía caen a «sin movimiento» | MUERTO · exit 1 · `Tests  1 failed \| 37 passed (38)` |
| N55 | L2: Dirección sin «otros ingresos del libro» | MUERTO · exit 1 · `Tests  4 failed \| 35 passed (39)` |
| N56 | L2: con 4.5 vacía y facturas, Dirección dice «4.5 de facturas: $0.00» | MUERTO · exit 1 · `Tests  1 failed \| 38 passed (39)` |
| N57 | L2: Dirección vuelve a decir «sin movimiento en el libro» | MUERTO · exit 1 · `Tests  3 failed \| 36 passed (39)` |
| N58 | L3: la tarjeta pinta 4.5 con signo de dólar en «no comparable» | MUERTO · exit 1 · `Tests  2 failed \| 7 passed (9)` |
| N59 | L3: el CSV del P&L pone 4.5 bajo «Monto USD» en «no comparable» | MUERTO · exit 1 · `Tests  1 failed \| 21 passed (22)` |
| N60 | L4: el ticket vuelve a colgar «incluye $X de terceros» del promedio | MUERTO · exit 1 · `Tests  4 failed \| 4 passed (8)` |
| N61 | L4: el ticket compara los terceros con el total del mes | MUERTO · exit 1 · `Tests  1 failed \| 7 passed (8)` |
| N62 | L5: vuelve «la tarea 2.3 del plan contable» | MUERTO · exit 1 · `Tests  2 failed \| 45 passed (47)` |
| N63 | L6: E1 por el recibo sin el predicado de moneda (USD y USDT vuelven no comparable) | MUERTO · exit 1 · `Tests  1 failed \| 27 passed (28)` |
| N64 | L7: saldosDeFacturas sin .lte(entry_date) en SQL | MUERTO · exit 1 · `Tests  3 failed \| 92 passed (95)` |
| N65 | L8: la lectura incompleta de asientos de factura se traga y da el mayor vacío | MUERTO · exit 1 · `Tests  1 failed \| 27 passed (28)` |
| N66 | L8: las líneas de factura no lanzan con la lectura incompleta | MUERTO · exit 1 · `Tests  1 failed \| 27 passed (28)` |
| N67 | L9: el ícono del control pinta el check de éxito en cualquier estado | MUERTO · exit 1 · `Tests  3 failed \| 6 passed (9)` |
| N68 | L10: una CxP en USDT sin tasa cuenta como «sin tasa» | MUERTO · exit 1 · `Tests  1 failed \| 34 passed (35)` |
| O01 | M1: una VES o CNY sin asiento vuelve a contar en «no comparable» | MUERTO · exit 1 · `Tests  10 failed \| 78 passed (88)` |
| O02 | M1: sin control (Dashboard) todas cuentan como asentadas | MUERTO · exit 1 · `Tests  2 failed \| 36 passed (38)` |
| O03 | M1: el lector no saca las facturas de los asientos (conjunto vacío) | MUERTO · exit 1 · `Tests  4 failed \| 91 passed (95)` |
| O04 | M1: controlDelPeriodo no pasa las facturas con asiento | MUERTO · exit 1 · `Tests  3 failed \| 92 passed (95)` |
| O05 | M1: el CSV del P&L vuelve a rotular la cantidad sin «con asiento de factura» | MUERTO · exit 1 · `Tests  3 failed \| 19 passed (22)` |
| O06 | M2: una factura VES o CNY sin asiento vuelve no comparable el subdiario | MUERTO · exit 1 · `Tests  3 failed \| 60 passed (63)` |
| O07 | M2: el lector marca todas las facturas como asentadas | MUERTO · exit 1 · `Tests  1 failed \| 27 passed (28)` |
| O08 | M2: el lector no marca ninguna factura como asentada | MUERTO · exit 1 · `Tests  1 failed \| 27 passed (28)` |
| O09 | M2: sin el estado «sin movimiento en el mayor» | MUERTO · exit 1 · `Tests  6 failed \| 61 passed (67)` |
| O10 | M2: «no comparable» vuelve a ganar sobre el mayor vacío | MUERTO · exit 1 · `Tests  1 failed \| 34 passed (35)` |
| O11 | M2: las abiertas que no suman (sin convertir) no cuentan como abiertas | MUERTO · exit 1 · `Tests  1 failed \| 34 passed (35)` |
| O12 | M2: proveedores sin la regla del mayor vacío (simetría) | MUERTO · exit 1 · `Tests  1 failed \| 34 passed (35)` |
| O13 | M2: con el mayor vacío se muestra una diferencia | MUERTO · exit 1 · `Tests  6 failed \| 61 passed (67)` |
| O14 | M2: sin la nota de clientes «sin movimiento en el mayor (cuenta 1.1.2)» | MUERTO · exit 1 · `Tests  2 failed \| 37 passed (39)` |
| O15 | M2: sin la nota de proveedores «sin movimiento en el mayor (cuenta 2.1.1)» | MUERTO · exit 1 · `Tests  1 failed \| 34 passed (35)` |
| O16 | M2: el rótulo del estado nuevo se confunde con «Sin movimiento» (CSV e insignia) | MUERTO · exit 1 · `Tests  3 failed \| 36 passed (39)` |
| O17 | M2: la insignia del mayor vacío pinta el check de éxito | MUERTO · exit 1 · `Tests  1 failed \| 3 passed (4)` |

Dos mutantes del plan no se pueden matar y se reemplazaron: «`issued_at ?? created_at`» es equivalente (la única factura sin `issued_at` es el borrador, que el estado ya excluye), así que M02 mide `created_at`; y «reports en lugar de accounting» es equivalente en la matriz (G4), así que lo fija el contrato AST (M27). Dos defensas redundantes se quitaron para que su mutante tuviera sentido: el chequeo de `source` repetido en `asientosPorDocumento` y el `continue` duplicado de borradores en `cuadreSubdiario`.

Cómo mueren los de las correcciones que tienen una sola salida:

- N13 (sin `.eq(source)` en SQL) muere solo por la aserción sobre el filtro registrado, porque la regla lo repite en memoria; es el mismo caso de M20 y M23.
- N14 y N15 (sin repetir el origen en memoria, en asientos y en líneas) mueren solo con los dobles de Reportes y Dirección, que no filtran: con el doble de listados, que sí filtra, el SQL ya deja afuera el manual.
- La condición «sin facturas sin convertir», que en la segunda pasada no tenía mutante, ahora lo tiene: con L1, solo facturas sin convertir y 4.5 vacía dan «el mayor tiene menos», y N54 (quitarla) las manda a «sin movimiento».
- N64 (sin el `.lte` de `saldosDeFacturas`) muere en dos pruebas, comprobado con `quien-mata-0557.cjs` del scratchpad: «sin mayor dado…» (el asiento del 2025-03-25 subiría 4.5) y «el rango baja a SQL sobre entry_date, con sus dos topes».
- N65 (tragarse la lectura incompleta de los asientos de factura) muere solo por «ERR-01 · más de 60 asientos de factura…»: es el único fixture que no termina de leerse.

### /ui-check, quinta vuelta (rápido, sobre lo nuevo de Por contabilizar)

🎨 UI-CHECK · `PorContabilizarTab.tsx`: la insignia «Sin movimiento en el mayor» y las notas «Sin movimiento en el mayor (cuenta 1.1.2): las facturas abiertas no llegaron al mayor.» y «… (cuenta 2.1.1): las CxP abiertas no llegaron al mayor.».

Hallazgos (0).

✅ Lo que está bien: usa `Badge` del sistema con el tono `warning` (el mismo de «No cuadra»), así que el ícono es el de aviso y no el check (probado sobre el SVG); `Badge` ya trae `whiteSpace: "nowrap"` y altura fija, y la tabla vive en `TableFrame` con `minWidth: 680` y scroll propio, así que el rótulo más largo («Sin movimiento en el mayor», contra «Cuenta no encontrada») ensancha la columna sin partir la fila (no medido en navegador); la diferencia vacía usa el «—» que ya usaban los otros estados sin diferencia; sin hex, tokens ni fuentes nuevas; textos en sentence case, sin imperativos ni voseo.

Veredicto: OK para commit.

### /ui-check, tercera vuelta (rápido, sobre los textos y tonos nuevos)

🎨 UI-CHECK · tarjeta «Ingreso del período» (Contabilidad › Reportes y Reportes › Estado de resultados), KPI de Dirección y «Ticket promedio» del Dashboard.

Hallazgos (2, menores, no bloqueantes; no se cambió nada por ellos):

1 ⭐ [baja] `lib/studio/direccion/queries.ts` (`textosFinancieros`) · la segunda línea del KPI de ingresos puede juntar cuatro partes («4.5 de facturas: $600.00 · otros ingresos del libro: $500.00 · incluye fondos de terceros · 2 sin convertir»). El `sub` de `KpiCard` envuelve (11px, `line-height: 1.4`, sin `nowrap`), así que se lee en dos o tres renglones; no se midió en navegador.
2 [baja] `lib/studio/dashboard/dashboard-kpi-queries.ts` · el subtítulo del ticket crece («3 factura(s) en el año · sin IVA · $1.3K de los $2.3K del año son de terceros») y también envuelve en la tarjeta. «factura(s)» viene de antes.

✅ Lo que está bien: el tono sigue al estado con íconos del sistema (`StatusIcon`): `warning` y enlace con el mayor vacío, `neutral` en «no comparable» y «sin movimiento», el check solo con «cuadra» (ahora probado sobre el SVG); «nominal mixto (no USD)» ocupa el lugar de la cifra sin signo de dólar; sin hex ni tokens nuevos; sin números internos del plan en la pantalla; textos nuevos sin imperativos y sin voseo.

Veredicto: OK para commit.

### /ui-check (rúbrica `.claude/commands/ui-check.md`), primera pasada

🎨 UI-CHECK · Contabilidad (Libro diario, Reportes, Por contabilizar), Reportes › Estado de resultados y Facturado contra cobrado, KPI de Dirección.

Hallazgos (4, todos corregidos antes del commit):

1 ⭐ [alta] `ReportesTab.tsx` · el rótulo «Balance cuadra» de la tarjeta navy usaba `--ink-inv-mute`, que en tema oscuro da **1,07:1** sobre `--bg-sidebar` (era así antes de esta tarea). Pasó a `--ink-side-soft`: 5,82:1 claro y 5,32:1 oscuro.
2 [media] `ReportesTab.tsx` y `LibroDiarioTab.tsx` · los `input type="date"` tenían ancho fijo estimado (160/170 px). Pasaron a `minWidth: 160`; el ancho real lo pone el control nativo y la fila envuelve.
3 [media] `PorContabilizarTab.tsx` · «factura(s)» en la nota. Pasó a singular y plural correctos.
4 [baja] `direccion/page.tsx` · el sub del KPI de ingresos dejó de decir los embarques activos; la tarjeta Operación los sigue mostrando.

✅ Lo que está bien: solo tokens `var(--*)`, sin hex ni fuentes nuevas, sin AI slop; texto en tinta y el tono en el icono (SDD-0441); sentence case; tuteo sin voseo («Revisa», «Indica», «Usa», «Pídeles»); tablas semánticas con `<th scope>` dentro de `TableFrame` (scroll propio); montos en mono con `nowrap` y `tabular-nums`; errores con `role="alert"`, `aria-invalid` y `aria-describedby`; un solo primario por bloque.

Contraste **calculado** con la fórmula WCAG sobre los valores de `app/studio/tokens.css`, con los `rgba` mezclados sobre su fondo (`contraste-0557.cjs` del scratchpad; no medido en navegador):

| Par | Claro | Oscuro |
|---|---|---|
| `--ink` sobre `--bg-surface` | 16,49 | 13,08 |
| `--ink-soft` sobre `--bg-surface` | 5,33 | 6,86 |
| `--ink-soft` sobre `--bg-elevated` (cabeceras, etiquetas) | 4,68 | 6,00 |
| `--wine-text` sobre `--bg-surface` (enlaces) | 10,58 | 6,44 |
| `--ink-side-soft` sobre `--bg-sidebar` | 5,82 | 5,32 |
| `--warning` (icono) sobre `--bg-surface` | 3,14 | 7,15 |
| `--success` (icono) sobre `--bg-surface` | 4,33 | 7,71 |

Veredicto: OK para commit (con los ajustes ya aplicados).

### revisar-datos-ve sobre el CSV del diario

Advisory; no es asesoría legal. Estados: ENCONTRADO, CORRECTO o NO VERIFICABLE.

**Inventario de lo que sale en el archivo.**

| Columna | Qué es | Personas | Evidencia |
|---|---|---|---|
| Concepto (`journal_entries.memo`) | texto del asiento | nombre del trabajador en el finiquito; Shipping Mark del referidor; texto libre de los asientos manuales | `lib/studio/accounting/settlement-posting.ts:141`, `lib/studio/accounting/referral-credit-posting.ts:212`, `app/studio/(app)/contabilidad/actions.ts:79` |
| Detalle (`journal_lines.line_memo`) | texto de la línea | texto libre de los asientos manuales | `app/studio/(app)/contabilidad/actions.ts:150` |
| Fecha, asiento, origen, cuenta, debe, haber | datos contables | ninguna | `lib/studio/accounting/libro-control.ts` (`filasDelDiario`) |

Los dos titulares nombrados (trabajadores y referidores) **no son usuarios del sistema** (punto 12). Los datos ya se ven hoy en la pantalla del diario; el cambio los lleva a un archivo.

**Puntos.**

| # | Punto | Estado | Evidencia y nota |
|---|---|---|---|
| 1 | Inventario | CORRECTO | tabla de arriba |
| 2 | Minimización | ENCONTRADO | el archivo lleva el nombre del trabajador porque el concepto lo trae (`settlement-posting.ts:141`); para cuadrar el libro alcanza el código del finiquito. Arreglo propuesto (otra SDD): que el posting del finiquito deje de escribir el nombre en el concepto, o que el CSV lo reemplace por el código. No se hizo acá porque cambia el posting y el texto de la pantalla |
| 5 | Borrado | NO VERIFICABLE | un CSV descargado queda en el equipo de quien lo baja y ningún borrado lo alcanza. Es un destino nuevo del dato (escondite 6, «exports») y hay que contarlo en el mapa de borrado |
| 8 | Terceros | CORRECTO | el archivo no se manda a ningún servicio: lo genera el servidor y lo baja el usuario (`app/api/studio/contabilidad/export/route.ts:65`, `respuestaCsv` con `attachment`) |
| 9 | Transferencia internacional | NO VERIFICABLE | `accounting` no tiene alcance de almacén (`lib/studio/rbac.ts:276-281`); si un usuario accounting está en Yiwu, bajar el archivo es tratamiento en China (PIPL). El repo no dice dónde está cada usuario |
| 12 | Titulares que no son usuarios | ENCONTRADO | trabajadores y referidores no pasaron por ninguna política del Studio. La mitigación es de acceso, no de aviso |
| — | Acceso | CORRECTO | solo accounting y admin, los mismos roles que ven nómina (`lib/studio/rbac.ts:116`, `:130`); gate antes de leer (`route.ts:50`); prueba de 403 para commercial |
| — | Caché | CORRECTO | `Cache-Control: private, no-store` (`lib/studio/export/csv.ts:58`), afirmado en `export.test.ts` |
| — | Inyección de fórmulas | CORRECTO | `rowsToCsv` → `csvCell` neutraliza (`lib/studio/reports/builder-types.ts:235`); prueba con `=HYPERLINK(...)` y mutante M15 |
| — | Rastro de la exportación (AUD-01) | ENCONTRADO | AUD-01 pide un evento por exportación y la ruta no lo deja (tarea sin escritura). Igual que `operativo/export` y `comercial/export`. Queda en FUERA DE ALCANCE |

Fuera de alcance de esta revisión (abogado): la base de licitud de tratar los nombres de trabajadores en libros contables, y el plazo de conservación de los libros.

## Impacto documental y conocimiento

- Documentos canónicos actualizados: la spec 0557 (tabla de estados del control en orden, con la precedencia del mayor vacío; textos de Dirección, del ticket y del CSV del P&L; criterios 2, 3 y 7; ERR-01 con `saldosDeFacturas`; allowlist con `NOMINAL_MIXTO`; validación con el total de mutantes; preguntas abiertas 1 y 6). En la quinta vuelta: la sección «Decisiones del Director (2026-10-19)» con el texto literal de las decisiones 6 y 7, la fila 4 del control, la tabla de estados del subdiario, criterios 2, 3 y 7, una divergencia nueva y las preguntas 6 y 7 fuera de las abiertas. `docs/specs/README.md` (índice): ni los merges ni esta vuelta lo cambiaron (`node scripts/build-docs-index.mjs` no deja diff).
- Conocimiento nuevo propuesto, sin convertirlo en regla: las decisiones 6 y 7 son del Director y revisables por Sam; su destino canónico es la spec 0557 (hecho) y las definiciones canónicas de la SDD-0559 (E7), que las cita igual. Nada para la memoria: es estado de esta SDD.
- Desactualizado y no tocado: `docs/architecture/contabilidad-qbo-online.md` (no menciona la comprobación, Por contabilizar ni la exportación) y el Norte (`reports.jsx` dice «Facturado vs cobrado»; la UI dice «contra», que es la redacción del plan aprobado).
- `knowledge:status`: no se volvió a correr en la segunda ni en la tercera pasada. En la primera: exit 0, modo `integrated`, `ok: false` por motivos globales ya conocidos (estructural INVALID con 4.875 pendientes, semántico INVALID, Archify PENDING por `ARCHIFY_RUNTIME_MISSING`, publicación `MAIN_REQUIRED`). Nada propio de esta rama. Graphify y Archify los actualiza el Director desde main integrado.
- `origin/main` `6c3f0a9f` (#280, SDD-0556, y #281) está mergeado en `da7f09f0`, y `origin/main` `7fba5711` (#282, SDD-0561) en `4770174b`, los dos sin conflictos.

## PENDIENTES DE ESTA TAREA

1. Integración por el Director (PR #283). No lleva migración. Si `main` avanza otra vez, mergear, regenerar el índice (`node scripts/build-docs-index.mjs`) y volver a correr `node scripts/migrations-lock.mjs verificar`.
3. Nota para Sam (va también en la PR): Dirección y el Dashboard ahora muestran el facturado aunque el mayor esté en 0. Antes Dirección mostraba 0 (el mayor está vacío) y el Dashboard el total con IVA y sin convertir moneda. Contabilidad › Reportes pasa de acumulado a período (por defecto, el mes en curso). Mientras exista B3, la diferencia con el mayor no va a ser cero: es la señal, no un error de la pantalla. **Hoy (4.5 sin asientos de factura) el control dice cuánto le falta al mayor, también con facturas en bolívares o yuanes.** Cuando 4.5 tenga asientos de factura y alguna factura del período en bolívares o yuanes tenga el suyo, dirá «no comparable» en vez de una diferencia: esas facturas se asientan por el nominal (B2). Una en bolívares o yuanes sin asiento no lo dispara: ya sale en «sin asiento». En Por contabilizar, con 1.1.2 (o 2.1.1) en cero y documentos abiertos, dice «Sin movimiento en el mayor» en vez de una diferencia. Un asiento manual a 4.5 ya no cuenta como diferencia: se ve en «otros ingresos del mayor» (en Dirección, «otros ingresos del libro»).
4. Las preguntas abiertas de la spec (cifra oficial, B10, diario con anulados, anuladas entre períodos, manuales a 4.5) para Sam o la contadora. Las 6 y 7 ya las respondió el Director (revisables por Sam).
5. Desvíos de la quinta vuelta: el Director aceptó el 3 (el control del ingreso dice cuánto falta asentar y el subdiario describe el estado; son dos vistas del mismo hecho). Queda a su revisión el 2 («con asiento vivo» = en el rango del control).

## FUERA DE ALCANCE DETECTADO

1. **AUD-01 en las exportaciones CSV**: ni esta ruta ni `operativo/export` ni `comercial/export` dejan un evento de auditoría. Necesita una SDD con escritura (y quizá RPC).
2. **El concepto del finiquito lleva el nombre del trabajador** (`lib/studio/accounting/settlement-posting.ts:141`). Para el libro alcanza el código; se ve en pantalla y ahora en el CSV.
3. **«Facturado YTD» de `invoiceKpis`** (`lib/studio/invoice-queries.ts`, de la SDD-0555): `total_amount` con IVA, sin convertir, por `issued_at ?? created_at`. Hay que rotularlo o unificarlo.
4. **Libro de ventas y Posición de IVA por `created_at`** (`lib/studio/fiscal/queries.ts`, `lib/studio/reports/queries.ts`): el criterio lo decide la contadora.
5. **Borradores con saldo en `receivablesQueue`** (Cobranzas H07): va con la SDD-0558. Por eso el subdiario de clientes no coincide con «Por cobrar».
6. **H03 y H08**: «Por cobrar» sin normalizar y dos conversiones a USD distintas.
7. **El rótulo «Balance cuadra» en tema oscuro** estaba en 1,07:1 desde antes; quedó corregido acá solo en esa tarjeta. Otros usos de `--ink-inv-mute` sobre fondos navy no se revisaron.
8. **Las pestañas de Contabilidad** son botones sin `role="tab"` ni flechas (A11Y-01 §11), como antes; no cambia en esta tarea.
9. **CxP en otra moneda sin tasa**: `billAmountUsd` (`lib/studio/accounting/bill-posting.ts`) la asienta en 2.1.1 por el nominal. Según la revisión, el formulario (`app/studio/(app)/tesoreria/_components/BillDrawer.tsx`) y `validateBillInput` (`lib/studio/treasury/types.ts:285`) la aceptan sin tasa; eso no se volvió a leer acá. Esta SDD solo la cuenta y lo dice (K7). Exigir la tasa o convertir en el asiento va con la conversión unificada (H08).
10. **El facturado de Facturado contra cobrado** sigue por `issued_at ?? created_at` y con IVA (`cashflowReport`); se rotuló «con IVA» (K6) y quedó en el inventario de «otras cifras de facturado» de la spec.
11. ~~El subdiario de clientes con 1.1.2 vacía~~: resuelto en la quinta vuelta con la decisión 6 del Director (estado «Sin movimiento en el mayor»). Ya no queda fuera de alcance.
12. **Cabecera de asiento sin líneas** (`lib/studio/accounting/invoice-posting.ts`, inserción de `journal_lines` con «Rollback manual del header (no hay transacción cross-statement acá)»): si las líneas fallan y el rollback del header también, queda un asiento de factura vivo sin líneas. Esta SDD lo trata como mayor vacío (prueba nueva); el arreglo es el posting transaccional de la fase 2 (B3).
