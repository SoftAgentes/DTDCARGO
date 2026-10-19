# Handoff · SDD-0557 · Reportes contables sin migración: una cifra de ingreso, comprobación, diario completo y cuadre del libro

| Campo | Valor |
|---|---|
| Fecha | 2026-10-19; en Caracas, de 01:15 a 02:05 aprox. (UTC 05:15 a 06:05) la primera pasada, y de 02:20 a 03:05 aprox. (UTC 06:20 a 07:05) las correcciones K1 a K15 |
| Task ID / owner | `contabilidad-2026-10-18` / Worker «Contabilidad»; las dos pasadas las escribió un subagente escritor de esa Worker |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0557-reportes-una-cifra` |
| Rama | `codex/sdd-0557-reportes-una-cifra`, desde `origin/main` `3f3a52cc` (merge de la #279); `origin/main` `6c3f0a9f` mergeado en `da7f09f0` |
| SDD | [0557](../../docs/specs/0557-reportes-contables-una-cifra/spec.md), `in-progress`. La reserva entró por cherry-pick (`3030cd03`) |
| Estado | correcciones de la revisión adversaria aplicadas (K1 a K15) y main mergeado; lista para la revisión de la Worker; sin push ni PR |
| Permisos | commits selectivos en la rama propia, sin push. No incluye producción ni base de datos. `pnpm verify` necesita turno del Director |

## OBJETIVO ORIGINAL

Tarea 1.4 del plan contable (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`, fase 1; B17 y anexo A, Reportes H02, H04 y H07), sin migración:

- una sola cifra de ingreso para Contabilidad, Dirección, Reportes y el Dashboard;
- balance de comprobación y diario completo en CSV;
- documentos sin asiento y cuadre del subdiario contra el mayor;
- «Cashflow» pasa a «Facturado contra cobrado».

Mandan las decisiones `decisiones-0557.md` (G1 a G14) sobre el plan `3-plan-0557.json`, y las definiciones canónicas de la SDD-0559 (E7).

## COMPLETADO

- **Una regla** (`lib/studio/accounting/ingreso-periodo.ts`, `resumirIngreso`): base sin IVA en USD, facturas `emitida | parcial | pagada | vencida` no borradas, por `issued_at` inclusive. VES sin tasa y CNY van a «sin convertir». `deleted_at` viaja en la fila y la regla lo vuelve a filtrar (G1). Desglose propio/terceros por `fund_class` (G1). El control del mayor es el saldo de **4.5 de los asientos de factura** (K3); el 4.6, los manuales (también a 4.5) y cualquier otro origen son «otros ingresos del mayor», aparte (G2).
- **Los cuatro consumidores la usan**, con el mismo fixture y el mismo período (2025-03-01 → 2025-03-18, lejos de la fecha real, G11): `ingresoDelPeriodo` (Contabilidad › Reportes, Reportes › Estado de resultados y Dirección) y `financeInvoiceKpis` (Dashboard). Todos dan 2000 USD con 2 sin convertir. El «Ticket promedio» del Dashboard usa la misma base (G12).
- **Contabilidad › Reportes**: Desde/Hasta (G7, DAT-01: con fecha inválida, una sola fecha o rango al revés no calcula y muestra el error citando lo tecleado), tarjeta «Ingreso del período», P&L del período, balance general y **balance de comprobación al corte** (movimientos directos, sin duplicar el rollup) con CSV y el enlace «Diario hasta el corte (CSV)» **sin `desde`** (G6).
- **Libro diario**: totales reales con `countEntries`; «Mostrando N de M» con los asentados que trae el CSV y el enlace «Descargar el diario asentado (CSV)» (K5); exportación con Desde/Hasta que valida antes de enviar.
- **Ruta** `GET /api/studio/contabilidad/export?tipo=diario`: sesión, `moduleViewDenial(supabase, "accounting")` antes de leer, 400 con fechas inválidas, lectura completa paginada, CSV con BOM, CRLF, fórmulas neutralizadas por `rowsToCsv` y `private, no-store` (G4, G5). Entra a `GUARDED` del contrato RBAC.
- **Por contabilizar** (`?tab=subdiario`): subdiario contra mayor (clientes contra 1.1.2, con «no comparable» por B2 según E1 de la 0559; proveedores contra 2.1.1 con `billAmountUsd`, G8, y las CxP sin tasa contadas, K7), documentos sin asiento con motivo y enlace y el conteo «X sin asiento de N vivas» (K8), conteo de anulados con asiento vivo con enlace (G9), CSV.
- **Reportes**: preset «Este mes» (G10); tarjeta de ingreso en el Estado de resultados; la decisión de la vista en `vistaDelEstado` (G11), que también usa el CSV; «Facturado contra cobrado» con `?rep=cashflow` intacto; `TABS_BY_CATEGORY` exportado donde estaba (G12).
- **Dirección**: `finance.ingreso: IngresoPeriodo` (G12), «Utilidad neta · libro» con el margen sobre los ingresos del mayor, «Pídeles».

### Merge de main (2026-10-19)

- `git fetch origin main` y `git merge --no-edit origin/main` (sin rebase): `origin/main` en `6c3f0a9f` (#280, SDD-0556, y #281). Merge `da7f09f0`, **sin conflictos**: el índice de specs entró solo y `node scripts/build-docs-index.mjs` no cambió nada (`✓ índice regenerado en docs\specs\README.md — 545 specs, 15 huecos`).
- Inventario de `scripts/__tests__/invoice-read-boundary.test.mjs` recalculado corriendo la prueba sobre el árbol fusionado: `Tests  4 passed (4)`. El mapa y los totales no cambian con el merge: 20 archivos y 45 lecturas (main no tocó llamadas `from("invoices")` fuera de `lib/portal/**`, y la de `portal-queries.ts` sigue en 2).

### Correcciones de la revisión adversaria (K1 a K15)

Commits `bab54b96` (fix, K1 a K8, K14 y K15) y `6bc0c463` (test, K9 a K13).

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

## VALIDACIÓN

Todo sobre este worktree, en la rama de la tarea. Las filas son de la segunda pasada (correcciones K1 a K15, después del merge de main); las de la primera pasada quedan en el historial de este archivo (`2e901f98`).

| Comprobación | Alcance | Resultado |
|---|---|---|
| `vitest run` (binario del worktree) sobre accounting, contabilidad, reportes, la ruta, reports, dashboard, dirección, fiscal, los listados sin eliminados, borrado y los contratos `rbac-api-guard`, `studio-api-auth-guard`, `invoice-read-boundary` y `spec-migration-refs` | 44 archivos | PASÓ: `Test Files  44 passed (44)`, `Tests  700 passed (700)`, exit 0 |
| `invoice-read-boundary` sobre el árbol fusionado | inventario | PASÓ: `Tests  4 passed (4)`; 20 archivos, 45 lecturas, sin cambios |
| Mutantes (`mutantes-0557.cjs` en el scratchpad; uno por vez, restaura en `finally`; log `mutantes-0557.log`, el anterior en `mutantes-0557.antes-correcciones.log`) | los 43 de la primera pasada y 51 nuevos (K1 a K15) | `TOTAL: 94 mutantes · 94 MUERTOS · 0 SOBREVIVEN · 0 NO APLICADOS`, todos con exit 1 y la línea `Tests … failed` (tabla abajo). `git status` después: solo la spec y este handoff, sin commitear |
| `tsc --noEmit` (con `prune-next-types`, como `typecheck`) | repo completo | PASÓ (exit 0; `[tipos-de-ruta] sanos — nada que podar`) |
| `eslint --max-warnings=0` | los 29 archivos tocados en las correcciones | PASÓ (exit 0, sin salida) |
| `node scripts/check-rsc-boundary.mjs` | app, lib | PASÓ: `sin cruces server→client de valores ni client→node: transitivos` (1695 módulos) |
| `docs:check` (`build-docs-index.mjs --check`) | índice | PASÓ: `✓ docs:check — índice sincronizado con 545 specs` |
| `sdd:check` (`check-numbering.mjs`) | numeración | PASÓ: `numbering: sin números repetidos` (avisa los choques históricos 0342, 0363 y 0394, ya aplicados) |
| `governance:check` | cápsula | PASÓ: `Gobernanza: 28 política(s) aprobada(s) · cápsula vigente` |
| `components:check` | registro CMP | PASÓ: `CMP-01 válido: 5 fuente(s), agregado reproducible y cero rutas rotas` |
| `git diff --check da7f09f0 HEAD` | diff de las correcciones | PASÓ |
| `git grep -n "monthRevenue +=" -- lib app` | criterio 1 | sin resultados (exit 1) |
| `/ui-check` | — | NO EJECUTADO en esta pasada. Los cambios de UI son textos, tonos de íconos ya del sistema (`StatusIcon` neutral) y el contador por vivas; el veredicto de la primera pasada (abajo) no se rehízo |
| Comprobación en el navegador | — | NO EJECUTADA: el worktree no tiene `.env.local` (a propósito) y las pantallas necesitan sesión y base. Las pruebas montan los componentes en jsdom |
| `pnpm verify` | — | NO EJECUTADO: necesita turno del Director |

### Mutantes

Corrida del 2026-10-19 sobre `6bc0c463` (uno por vez; el script exige exit 1 y la línea `Tests … failed`). Línea final del log:

```
TOTAL: 94 mutantes · 94 MUERTOS · 0 SOBREVIVEN · 0 NO APLICADOS
```

M01 a M43 son los de la primera pasada; M07 y M30 cambiaron su texto de origen porque K1 y K5 cambiaron el código que mutan (M07 sigue siendo «contra todas las cuentas 4»; M30, «sin el texto del enlace»). N01 a N51 son los de K1 a K15.

| # | Regresión | Resultado |
|---|---|---|
| M01 | resumirIngreso suma total_amount (con IVA) en vez de base_amount | MUERTO · exit 1 · `Tests  9 failed \| 20 passed (29)` |
| M02 | la fecha de la regla es created_at, no issued_at | MUERTO · exit 1 · `Tests  7 failed \| 22 passed (29)` |
| M03 | sin filtro de estado en memoria | MUERTO · exit 1 · `Tests  7 failed \| 22 passed (29)` |
| M04 | VES sin tasa cuenta como convertible | MUERTO · exit 1 · `Tests  3 failed \| 26 passed (29)` |
| M05 | el extremo «hasta» deja de ser inclusivo | MUERTO · exit 1 · `Tests  1 failed \| 28 passed (29)` |
| M06 | la regla no vuelve a filtrar borradas en memoria | MUERTO · exit 1 · `Tests  13 failed \| 51 passed (64)` |
| M07 | el control compara contra todas las cuentas 4, no contra 4.5 | MUERTO · exit 1 · `Tests  4 failed \| 104 passed (108)` |
| M08 | DAT-01: el rango inverso pasa en silencio | MUERTO · exit 1 · `Tests  1 failed \| 28 passed (29)` |
| M09 | comprobación con el saldo acumulado (rollup) en vez del directo | MUERTO · exit 1 · `Tests  4 failed \| 26 passed (30)` |
| M10 | el cruce empareja por FK sin mirar el source | MUERTO · exit 1 · `Tests  1 failed \| 45 passed (46)` |
| M11 | un asiento anulado cuenta como vivo | MUERTO · exit 1 · `Tests  3 failed \| 43 passed (46)` |
| M12 | el vínculo solo en un sentido (sin journal_entry_id del documento) | MUERTO · exit 1 · `Tests  1 failed \| 29 passed (30)` |
| M13 | un documento con monto 0 sale como «sin asiento» | MUERTO · exit 1 · `Tests  2 failed \| 28 passed (30)` |
| M14 | el aviso del diario aparece aunque se vean todos | MUERTO · exit 1 · `Tests  2 failed \| 32 passed (34)` |
| M15 | el CSV del diario sin neutralizar fórmulas (como buildCsv) | MUERTO · exit 1 · `Tests  2 failed \| 38 passed (40)` |
| M16 | el subdiario de clientes incluye borradores | MUERTO · exit 1 · `Tests  1 failed \| 29 passed (30)` |
| M17 | el subdiario descarta saldos negativos (max 0) | MUERTO · exit 1 · `Tests  1 failed \| 29 passed (30)` |
| M18 | proveedores convierte con invoiceUsdAmount (CNY → 0), no con la regla del asiento | MUERTO · exit 1 · `Tests  2 failed \| 28 passed (30)` |
| M19 | sin la regla «no comparable» de B2 (E1) | MUERTO · exit 1 · `Tests  2 failed \| 28 passed (30)` |
| M20 | ingresoDelPeriodo sin .is(deleted_at) en SQL | MUERTO · exit 1 · `Tests  1 failed \| 15 passed (16)` |
| M21 | el diario se lee de una sola vez (sin fetchAllPaged real) | MUERTO · exit 1 · `Tests  4 failed \| 12 passed (16)` |
| M22 | el diario sin .eq(status, asentado) | MUERTO · exit 1 · `Tests  5 failed \| 21 passed (26)` |
| M23 | el cruce sin .in(source, …) en SQL | MUERTO · exit 1 · `Tests  1 failed \| 15 passed (16)` |
| M24 | countEntries cuenta borradores como asentados | MUERTO · exit 1 · `Tests  1 failed \| 15 passed (16)` |
| M25 | la ruta no corta con el gate | MUERTO · exit 1 · `Tests  1 failed \| 9 passed (10)` |
| M26 | la ruta no valida las fechas | MUERTO · exit 1 · `Tests  2 failed \| 8 passed (10)` |
| M27 | la ruta pide el módulo reports (equivalente en la matriz; lo fija el contrato AST) | MUERTO · exit 1 · `Tests  1 failed \| 16 passed (17)` |
| M28 | el contador del diario vuelve a ser entries.length | MUERTO · exit 1 · `Tests  1 failed \| 3 passed (4)` |
| M29 | los asentados se cuentan sobre la lista de pantalla | MUERTO · exit 1 · `Tests  1 failed \| 3 passed (4)` |
| M30 | sin el texto del enlace al diario (K5: el rótulo cambió a «asentado») | MUERTO · exit 1 · `Tests  1 failed \| 3 passed (4)` |
| M31 | la exportación con fechas no valida antes de enviar | MUERTO · exit 1 · `Tests  1 failed \| 3 passed (4)` |
| M32 | el diario junto a la comprobación lleva desde (no cuadra con la tabla) | MUERTO · exit 1 · `Tests  1 failed \| 7 passed (8)` |
| M33 | la pestaña vuelve a decir Cashflow | MUERTO · exit 1 · `Tests  3 failed \| 3 passed (6)` |
| M34 | el eyebrow del estado vacío vuelve a decir Cashflow | MUERTO · exit 1 · `Tests  1 failed \| 5 passed (6)` |
| M35 | el slug de la pestaña cambia sin alias | MUERTO · exit 1 · `Tests  1 failed \| 5 passed (6)` |
| M36 | el CSV conserva el slug contable-cashflow | MUERTO · exit 1 · `Tests  2 failed \| 25 passed (27)` |
| M37 | el CSV del P&L usa la condición vieja de vacío | MUERTO · exit 1 · `Tests  2 failed \| 19 passed (21)` |
| M38 | vistaDelEstado manda al vacío aunque haya facturado | MUERTO · exit 1 · `Tests  2 failed \| 43 passed (45)` |
| M39 | sin el preset Este mes | MUERTO · exit 1 · `Tests  3 failed \| 70 passed (73)` |
| M40 | Reportes calcula el ingreso sobre otro rango | MUERTO · exit 1 · `Tests  2 failed \| 26 passed (28)` |
| M41 | Dirección calcula el margen con el facturado | MUERTO · exit 1 · `Tests  2 failed \| 33 passed (35)` |
| M42 | Dashboard usa el reloj en vez de hoy | MUERTO · exit 1 · `Tests  3 failed \| 4 passed (7)` |
| M43 | Dashboard: ticket promedio con otra base | MUERTO · exit 1 · `Tests  1 failed \| 6 passed (7)` |
| N01 | K1: la diferencia se calcula aunque haya facturas en VES o CNY | MUERTO · exit 1 · `Tests  5 failed \| 132 passed (137)` |
| N02 | K1: describirIngreso sin el estado no_comparable | MUERTO · exit 1 · `Tests  9 failed \| 100 passed (109)` |
| N03 | K1: las anuladas en VES o CNY no cuentan (solo las de ingreso) | MUERTO · exit 1 · `Tests  2 failed \| 43 passed (45)` |
| N04 | K1: un borrador en VES también vuelve no comparable | MUERTO · exit 1 · `Tests  1 failed \| 28 passed (29)` |
| N05 | K1: el lector del ingreso no trae las anuladas | MUERTO · exit 1 · `Tests  3 failed \| 41 passed (44)` |
| N06 | K1: la tarjeta pone «no comparable» con el ícono de éxito | MUERTO · exit 1 · `Tests  2 failed \| 6 passed (8)` |
| N07 | K1: el CSV del P&L sin la fila del estado del control | MUERTO · exit 1 · `Tests  2 failed \| 19 passed (21)` |
| N08 | K2: sin el estado sin_movimiento (0 contra 0 dice «cuadra») | MUERTO · exit 1 · `Tests  4 failed \| 84 passed (88)` |
| N09 | K2: el movimiento de 4.5 se mide por el saldo y no por debe/haber | MUERTO · exit 1 · `Tests  1 failed \| 28 passed (29)` |
| N10 | K2: la tarjeta pone «sin movimiento» con el ícono de éxito | MUERTO · exit 1 · `Tests  1 failed \| 7 passed (8)` |
| N11 | K2: Dirección dice «cuadra con el libro» sin movimiento | MUERTO · exit 1 · `Tests  1 failed \| 34 passed (35)` |
| N12 | K3: el control usa toda la 4.5 (también los manuales) | MUERTO · exit 1 · `Tests  4 failed \| 75 passed (79)` |
| N13 | K3: el lector de asientos de factura sin .eq(source) en SQL | MUERTO · exit 1 · `Tests  2 failed \| 42 passed (44)` |
| N14 | K3: sin repetir el origen en memoria (asientos) | MUERTO · exit 1 · `Tests  2 failed \| 61 passed (63)` |
| N15 | K3: sin repetir el asiento en memoria (líneas) | MUERTO · exit 1 · `Tests  2 failed \| 61 passed (63)` |
| N16 | K4: el Dashboard no dice cuánto es de terceros | MUERTO · exit 1 · `Tests  4 failed \| 3 passed (7)` |
| N17 | K4: el ticket promedio dice los terceros del mes y no del año | MUERTO · exit 1 · `Tests  1 failed \| 6 passed (7)` |
| N18 | K5: el rótulo vuelve a «el diario completo» | MUERTO · exit 1 · `Tests  2 failed \| 32 passed (34)` |
| N19 | K5: el aviso no dice cuántos asentados trae el CSV | MUERTO · exit 1 · `Tests  2 failed \| 32 passed (34)` |
| N20 | K5: el aviso cuenta los asentados con el total | MUERTO · exit 1 · `Tests  1 failed \| 3 passed (4)` |
| N21 | K5: el botón vuelve a «Exportar diario (CSV)» | MUERTO · exit 1 · `Tests  1 failed \| 3 passed (4)` |
| N22 | K6: el KPI vuelve a «Facturado» | MUERTO · exit 1 · `Tests  1 failed \| 5 passed (6)` |
| N23 | K6: la leyenda vuelve a «Facturado» | MUERTO · exit 1 · `Tests  1 failed \| 5 passed (6)` |
| N24 | K6: la nota no dice «con IVA» | MUERTO · exit 1 · `Tests  1 failed \| 5 passed (6)` |
| N25 | K6: la cabecera del CSV vuelve a «Facturado USD» | MUERTO · exit 1 · `Tests  1 failed \| 20 passed (21)` |
| N26 | K7: no cuenta las CxP sin tasa | MUERTO · exit 1 · `Tests  2 failed \| 31 passed (33)` |
| N27 | K7: cuenta también las que tienen tasa | MUERTO · exit 1 · `Tests  1 failed \| 29 passed (30)` |
| N28 | K7: sin la nota de las CxP sin tasa | MUERTO · exit 1 · `Tests  2 failed \| 31 passed (33)` |
| N29 | K7: el CSV del subdiario sin la columna de sin tasa | MUERTO · exit 1 · `Tests  2 failed \| 28 passed (30)` |
| N30 | K8: el denominador vuelve a ser revisados (con anulados) | MUERTO · exit 1 · `Tests  2 failed \| 31 passed (33)` |
| N31 | K8: los anulados se cuentan como vivos | MUERTO · exit 1 · `Tests  5 failed \| 44 passed (49)` |
| N32 | K9: el diario completo sin .is(deleted_at) | MUERTO · exit 1 · `Tests  3 failed \| 23 passed (26)` |
| N33 | K10: el conteo de recibos VES/CNY con asiento vale 0 | MUERTO · exit 1 · `Tests  1 failed \| 15 passed (16)` |
| N34 | K10: cuenta también el recibo anulado | MUERTO · exit 1 · `Tests  1 failed \| 15 passed (16)` |
| N35 | K10: cuenta el recibo aunque su asiento esté anulado | MUERTO · exit 1 · `Tests  1 failed \| 15 passed (16)` |
| N36 | K11: los recibos se leen sin los anulados | MUERTO · exit 1 · `Tests  1 failed \| 15 passed (16)` |
| N37 | K11: los pagos se leen sin los anulados | MUERTO · exit 1 · `Tests  1 failed \| 15 passed (16)` |
| N38 | K11: el recibo anulado se mapea como vivo | MUERTO · exit 1 · `Tests  2 failed \| 14 passed (16)` |
| N39 | K11: el pago anulado se mapea como vivo | MUERTO · exit 1 · `Tests  1 failed \| 15 passed (16)` |
| N40 | K11: las CxP no llegan al subdiario | MUERTO · exit 1 · `Tests  1 failed \| 15 passed (16)` |
| N41 | K12: el diario sin el criterio de fecha | MUERTO · exit 1 · `Tests  1 failed \| 29 passed (30)` |
| N42 | K12: el diario sin «debe antes que haber» | MUERTO · exit 1 · `Tests  1 failed \| 29 passed (30)` |
| N43 | K12: el cruce sin el criterio de fecha | MUERTO · exit 1 · `Tests  1 failed \| 29 passed (30)` |
| N44 | K13: leerCompleto no lanza con la lectura incompleta | MUERTO · exit 1 · `Tests  2 failed \| 24 passed (26)` |
| N45 | K13: las líneas del diario no lanzan con la lectura incompleta | MUERTO · exit 1 · `Tests  1 failed \| 15 passed (16)` |
| N46 | K14: con error, la página cae al mes en curso | MUERTO · exit 1 · `Tests  1 failed \| 29 passed (30)` |
| N47 | K14: la pestaña pinta reportes debajo del error | MUERTO · exit 1 · `Tests  1 failed \| 7 passed (8)` |
| N48 | K15: la utilidad pierde «libro» | MUERTO · exit 1 · `Tests  1 failed \| 34 passed (35)` |
| N49 | K15: el ingreso pierde «sin IVA» | MUERTO · exit 1 · `Tests  1 failed \| 34 passed (35)` |
| N50 | K15: «en el libro» muestra la diferencia y no el saldo de 4.5 | MUERTO · exit 1 · `Tests  2 failed \| 33 passed (35)` |
| N51 | K15: no comparable dice «cuadra con el libro» | MUERTO · exit 1 · `Tests  2 failed \| 33 passed (35)` |

Dos mutantes del plan no se pueden matar y se reemplazaron: «`issued_at ?? created_at`» es equivalente (la única factura sin `issued_at` es el borrador, que el estado ya excluye), así que M02 mide `created_at`; y «reports en lugar de accounting» es equivalente en la matriz (G4), así que lo fija el contrato AST (M27). Dos defensas redundantes se quitaron para que su mutante tuviera sentido: el chequeo de `source` repetido en `asientosPorDocumento` y el `continue` duplicado de borradores en `cuadreSubdiario`.

Cómo mueren los de las correcciones que tienen una sola salida:

- N13 (sin `.eq(source)` en SQL) muere solo por la aserción sobre el filtro registrado, porque la regla lo repite en memoria; es el mismo caso de M20 y M23.
- N14 y N15 (sin repetir el origen en memoria, en asientos y en líneas) mueren solo con los dobles de Reportes y Dirección, que no filtran: con el doble de listados, que sí filtra, el SQL ya deja afuera el manual.
- La condición «sin facturas sin convertir» de `sin_movimiento` no tiene mutante: hoy toda factura que no suma está en VES o CNY, y esas vuelven «no comparable» antes. Se deja porque K2 la nombra.

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

- Documentos canónicos actualizados: la spec 0557 (estados del control, control contra la 4.5 de asientos de factura, criterios 2 a 8 y 10, gobernanza DAT-01 y ERR-01, allowlist con los símbolos nuevos, fuera de alcance y preguntas abiertas 1, 2, 3 y 5) y `docs/specs/README.md` (índice: el merge no lo cambió).
- Desactualizado y no tocado: `docs/architecture/contabilidad-qbo-online.md` (no menciona la comprobación, Por contabilizar ni la exportación) y el Norte (`reports.jsx` dice «Facturado vs cobrado»; la UI dice «contra», que es la redacción del plan aprobado).
- `knowledge:status`: no se volvió a correr en esta pasada. En la primera: exit 0, modo `integrated`, `ok: false` por motivos globales ya conocidos (estructural INVALID con 4.875 pendientes, semántico INVALID, Archify PENDING por `ARCHIFY_RUNTIME_MISSING`, publicación `MAIN_REQUIRED`). Nada propio de esta rama. Graphify y Archify los actualiza el Director desde main integrado.
- `origin/main` `6c3f0a9f` (#280, SDD-0556, y #281) ya está mergeado (`da7f09f0`), sin conflictos.

## PENDIENTES DE ESTA TAREA

1. `pnpm verify` con turno del Director.
2. Push y PR cuando lo autorice el encargo. No lleva migración. Si `main` avanza otra vez, mergear y regenerar el índice (`node scripts/build-docs-index.mjs`).
3. `/ui-check` de esta pasada, si la Worker lo pide: los cambios de UI son textos, el tono neutro del ícono en «no comparable» y «sin movimiento», y el contador por vivas.
4. Nota para Sam (va también en la PR): Dirección y el Dashboard ahora muestran el facturado aunque el mayor esté en 0. Antes Dirección mostraba 0 (el mayor está vacío) y el Dashboard el total con IVA y sin convertir moneda. Contabilidad › Reportes pasa de acumulado a período (por defecto, el mes en curso). Mientras exista B3, la diferencia con el mayor no va a ser cero: es la señal, no un error de la pantalla. Con facturas en bolívares o yuanes en el período, el control dice «no comparable» en vez de una diferencia: hoy esas facturas se asientan por el nominal (B2). Un asiento manual a 4.5 ya no cuenta como diferencia: se ve en «otros ingresos del mayor».
5. Las preguntas abiertas de la spec (cifra oficial, B10, diario con anulados, anuladas entre períodos, manuales a 4.5) para Sam y la contadora.

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
