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

**El mayor queda como control, contra la cuenta 4.5** (`SALES_INCOME_CODE`, la que acredita el asiento de cada factura), no contra todas las cuentas 4. El 4.6 (spread del Socio China) y los asientos manuales a 4.x son «otros ingresos del mayor»: se muestran aparte y no cuentan como diferencia. El estado de resultados y el balance siguen saliendo del mayor, porque tienen que cuadrar por partida doble.

**Período explícito.** Cada pantalla dice su rango en `AAAA-MM-DD`. Las fechas son las que guarda el sistema, en UTC (B8, fuera de alcance). Reportes gana el preset «Este mes» (`mesEnCurso`), la misma ventana de Contabilidad, Dirección y el Dashboard; las demás siguen siendo ventanas móviles y cada pantalla rotula la suya.

### Divergencias conocidas

- **Anuladas entre períodos.** La regla excluye por el estado ACTUAL: una factura de un mes ya cerrado que se anula después desaparece de ese mes. El mayor de la fase 2 fechará el reverso en el período abierto («nunca reabrir períodos cerrados», diagnóstico). Hay una alternativa sin migración (contarla en su mes y restarla en el mes de la anulación, con la fecha de `entity_audit_log`); queda como pregunta para la contadora y **no se implementa**.
- **Con el libro sano, facturado y mayor no coinciden por construcción**: el 4.6 y los manuales a 4.x quedan fuera de la comparación a propósito, y el plan aprobado cambia el asiento de los fondos de terceros (B10). La comparación contra 4.5 es lo que hoy explica B1–B3.

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

- **Contabilidad › Libro diario.** El contador dice los totales reales (`countEntries`): «1.234 asientos · 900 asentados». Si se ven menos, «Mostrando 500 de 1.234 asientos (los más recientes)» con el enlace «Descargar el diario completo (CSV)». Un formulario con Desde y Hasta opcionales exporta un tramo; valida las fechas antes de enviar con la misma regla que la ruta.
- **Contabilidad › Reportes.** Formulario GET Desde/Hasta (por defecto, el mes en curso) y, debajo:
  - la tarjeta «Ingreso del período»: facturado sin IVA, el saldo de 4.5 en el mayor y la diferencia, los avisos de terceros, sin convertir y otros ingresos, y el enlace a Por contabilizar si no cuadra;
  - el estado de resultados del período, desde el mayor;
  - el balance general al corte, con el resultado acumulado y sin cierre a 3.4;
  - el balance de comprobación al corte, en tabla, con totales, la insignia «Cuadra» o «Descuadre», «Exportar CSV» y el enlace «Diario hasta el corte (CSV)». El enlace **no lleva `desde`**: así Σ debe del archivo = total debe de la tabla.
  - Con una fecha inválida, una sola fecha o el rango al revés no se calcula nada: el error queda junto al formulario y cita lo tecleado (DAT-01).
- **Contabilidad › Por contabilizar** (`?tab=subdiario`, nueva, solo lectura): subdiario contra mayor en tabla, con estado por lado (Cuadra, No cuadra, No comparable, Cuenta no encontrada, Sin movimiento); documentos sin asiento con enlace al documento y motivo; conteo de anulados con asiento vivo por tipo, con enlace al listado. Las dos listas salen en un CSV.
- **Reportes › Estado de resultados.** Gana la tarjeta «Ingreso del período». Si el mayor no tiene movimiento pero hay facturado, se muestra la tarjeta con el aviso «El mayor no tiene movimiento en el período» en vez del estado vacío. La decisión vive en `vistaDelEstado`, pura, que usa también el CSV.
- **Reportes › Facturado contra cobrado.** Cambian el rótulo de la pestaña, el eyebrow y el nombre del CSV.
- **Dirección.** «Ingresos · mes» muestra la cifra oficial con el rango, «sin IVA» y «cuadra con el libro» o «en el libro: $X». La tarjeta de utilidad pasa a «Utilidad neta · libro», con el margen sobre los ingresos del mayor (no sobre el facturado: mezclar fuentes da un margen falso). «Pediles» pasa a «Pídeles».
- **Dashboard.** «Ingresos del mes» y «Ticket promedio» usan la regla oficial: «facturado del mes sin IVA», más «N sin convertir» si las hay.

### Definiciones del cruce (canónicas de la SDD-0559)

- **Asiento vivo:** `status = 'asentado'` y `deleted_at` nulo.
- **Vínculo en los dos sentidos:** `journal_entries.<doc>_id = doc.id` o `doc.journal_entry_id = journal_entries.id` (las facturas no tienen `journal_entry_id`).
- **Origen por `source`:** `invoice`, `receipt`, `supplier_bill`, `supplier_payment`. Un `referral_credit` también guarda `invoice_id` y no es el asiento de venta.
- Documentos revisados: facturas no borrador ni borradas (las anuladas, para la lista inversa), recibos (anulado = `deleted_at`), CxP no borradas (anulada = `status`) y pagos a proveedor (anulado = `deleted_at`).
- Motivos: «Sin asiento», «Asiento anulado» (solo tiene asientos anulados), «Sin monto» (monto ≤ 0: el posting no asienta montos en cero) y «Anulado con asiento vivo».

### Subdiario contra mayor

- **Clientes:** Σ (total − pagado), con signo, de las facturas emitidas, parciales, pagadas o vencidas, en USD con `invoiceUsdAmount`, contra el saldo de 1.1.2. No incluye borradores, así que puede no coincidir con «Por cobrar» de Cobranzas. Regla «no comparable» de la SDD-0559 (E1): con cualquier factura no borrador en VES o CNY, o un recibo vivo en esas monedas con asiento vivo, la diferencia no se muestra, porque hoy la factura se asienta al nominal (B2) y el cobro convierte.
- **Proveedores:** Σ (total − pagado) de las CxP no anuladas contra 2.1.1, con **la misma regla del asiento** (`billAmountUsd`: cualquier moneda con tasa se convierte; sin tasa, el nominal). Una CxP en yuanes con tasa no fabrica una diferencia. Un pago con otra tasa que la CxP sí deja diferencia: es una diferencia en cambio que el libro no registró.
- Saldos vivos a hoy contra el mayor sin rango. «Sin movimiento» (la cuenta no tiene débitos ni créditos y no hay saldo de documentos) va aparte de «Cuadra»: un 0 contra 0 no es una verificación.
- No reusa `receivablesQueue` ni `payablesQueue`: la primera incluye borradores con saldo y las dos descartan saldos negativos.

### La ruta de exportación

`GET /api/studio/contabilidad/export?tipo=diario[&desde][&hasta]`: sesión (`requireStudioSession`), `moduleViewDenial(supabase, "accounting")` antes de leer, validación de fechas (400 con fecha inválida o rango al revés), lectura paginada completa con `fetchAllPaged`, solo asientos asentados y vivos, una fila por línea. El CSV sale por el mismo camino que Reportes (`rowsToCsv` → `csvCell`, que neutraliza fórmulas), con BOM, CRLF y `Cache-Control: private, no-store`.

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `lib/studio/accounting/ingreso-periodo.ts` | nuevo, puro: `RangoFechas`, `ESTADOS_DE_INGRESO`, `CUENTA_VENTAS`, `mesEnCurso`, `rangoDesdeParams`, `controlDelMayor`, `resumirIngreso`, `describirIngreso` |
| `lib/studio/accounting/libro-control.ts` | nuevo, puro y seguro para el cliente: comprobación, cruce documento ↔ asiento, tipos del subdiario, diario y CSV, enlaces, aviso, payloads de página |
| `lib/studio/accounting/subdiario.ts` | nuevo, puro de servidor: `cuadreSubdiario` (importa `billAmountUsd`, que trae el cliente admin y no debe ir al navegador) |
| `lib/studio/accounting/libro-control-queries.ts` | nuevo: `ingresoDelPeriodo`, `reportesDelLibro`, `cuadreDelLibro`, `leerDiarioCompleto` |
| `lib/studio/journal-queries.ts` | `DIARIO_PANTALLA_MAX = 500` y `countEntries` |
| `app/api/studio/contabilidad/export/route.ts` | nuevo: GET del diario en CSV |
| `app/studio/(app)/contabilidad/page.tsx` | pestaña `subdiario`, `desde`/`hasta`, lecturas por pestaña |
| `app/studio/(app)/contabilidad/_components/ContabilidadClient.tsx` | pestaña «Por contabilizar», props y texto de cabecera |
| `app/studio/(app)/contabilidad/_components/LibroDiarioTab.tsx` | totales reales, aviso «Mostrando N de M» y exportación con fechas |
| `app/studio/(app)/contabilidad/_components/ReportesTab.tsx` | período, ingreso, comprobación y CSV |
| `app/studio/(app)/contabilidad/_components/PorContabilizarTab.tsx` | nuevo |
| `app/studio/(app)/contabilidad/_components/IngresoDelPeriodoCard.tsx` | nuevo: la tarjeta de la cifra oficial (Contabilidad y Reportes) |
| `lib/studio/direccion/queries.ts` | `finance.ingreso: IngresoPeriodo`; margen sobre los ingresos del mayor |
| `app/studio/(app)/direccion/page.tsx` | KPI de ingreso y de utilidad; «Pídeles» |
| `lib/studio/dashboard/dashboard-kpi-queries.ts` | ingresos del mes y ticket promedio con `resumirIngreso`; recibe `hoy` |
| `lib/studio/reports/types.ts` | preset `MES` «Este mes»; `IncomeStatement.ingreso`; `vistaDelEstado` |
| `lib/studio/reports/queries.ts` | `incomeStatement` devuelve `ingreso`; comentario de Facturado contra cobrado |
| `lib/studio/reports/export-csv.ts` | filas de control en el CSV del P&L; slug `contable-facturado-contra-cobrado` |
| `app/studio/(app)/reportes/_components/ReportesClient.tsx` | `TABS_BY_CATEGORY` exportado en su lugar; rótulos; tarjeta de ingreso |
| `lib/studio/accounting/__tests__/ingreso-fixture.ts` | nuevo: fixture compartido |
| `lib/studio/accounting/__tests__/ingreso-periodo.test.ts` | nuevo |
| `lib/studio/accounting/__tests__/libro-control.test.ts` | nuevo |
| `lib/studio/accounting/__tests__/libro-control-queries.test.ts` | nuevo |
| `app/api/studio/contabilidad/__tests__/export.test.ts` | nuevo |
| `app/studio/(app)/contabilidad/__tests__/libro-diario-aviso.test.tsx` | nuevo |
| `app/studio/(app)/contabilidad/__tests__/reportes-tab.test.tsx` | nuevo |
| `app/studio/(app)/contabilidad/__tests__/por-contabilizar.test.tsx` | nuevo |
| `app/studio/(app)/reportes/__tests__/facturado-contra-cobrado.test.ts` | nuevo: rótulo y contrato por AST de «Cashflow» |
| `lib/studio/direccion/__tests__/queries.test.ts` | smoke con `issued_at`/`base_amount` y 4.5; caso nuevo con 4.6 |
| `lib/studio/dashboard/__tests__/dashboard-kpi-queries.test.ts` | fixtures con `base_amount`/`currency`; mes en UTC; casos nuevos |
| `lib/studio/reports/__tests__/queries.test.ts` | caso nuevo de `incomeStatement.ingreso` |
| `lib/studio/reports/__tests__/export-csv.test.ts` | casos nuevos |
| `lib/studio/reports/__tests__/types.test.ts` | `MES` y `vistaDelEstado` |
| `lib/studio/__tests__/listados-double.ts` | opción `serverCap` (emula `db-max-rows`) |
| `lib/studio/rbac-api-guard.test.ts` | la ruta nueva en `GUARDED` (`accounting`, antes de `leerDiarioCompleto`) |
| `scripts/__tests__/invoice-read-boundary.test.mjs` | +2 lecturas de `invoices` en `libro-control-queries.ts`, justificadas |
| `docs/specs/0557-reportes-contables-una-cifra/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0557-reportes-contables-una-cifra.md` | handoff |

Archivos vedados por otras SDD y no tocados: `lib/studio/invoice-queries.ts`, `lib/studio/invoice-types.ts`, `lib/portal/**`, `app/portal/**`, `app/studio/(app)/clientes/**`, `lib/studio/client-*.ts`, `lib/studio/payment-queries.ts`, `app/studio/(app)/cobranzas/**`, `lib/studio/borrado/**`, `app/studio/(app)/embarques/**`.

## Criterios de aceptación

1. **Una regla.** `resumirIngreso` es la única función que calcula el ingreso del período. La usan `ingresoDelPeriodo` (Contabilidad › Reportes, Reportes › Estado de resultados y Dirección) y `financeInvoiceKpis` (Dashboard). `git grep -n "monthRevenue +=" -- lib app` no devuelve nada.
2. **La misma regla con el mismo período da la misma cifra.** Con el fixture compartido y el período 2025-03-01 → 2025-03-18, las pruebas de Contabilidad (`libro-control-queries`), Reportes (preset «Este mes»), Dirección y el Dashboard dan 2000 USD, con 2 facturas sin convertir. Cada prueba fija su período.
3. Contabilidad, Reportes y Dirección muestran el rango, el facturado, el saldo de 4.5 y la diferencia. Dirección y el Dashboard dicen «sin IVA»; Dirección rotula «libro» la utilidad.
4. Contabilidad › Reportes: P&L del rango, balance al corte y comprobación al corte con debe, haber, saldo deudor y saldo acreedor por cuenta, totales, «Cuadra» o «Descuadre» y CSV. Una fecha inválida, una sola fecha o un rango al revés muestran el error y no calculan.
5. Diario: la pantalla muestra los totales reales; si hay más de 500, avisa «Mostrando N de M». La ruta baja todos los asientos asentados, sin tope, una fila por línea, con BOM, CRLF, fórmulas neutralizadas y `private, no-store`. Solo accounting y admin (403 para los demás, 401 sin sesión, 400 con fechas inválidas). Σ debe del CSV hasta el corte = total debe de la comprobación al corte.
6. Por contabilizar: documentos vivos sin asiento vivo de su origen, con su motivo y enlace; anulados con asiento vivo aparte; CSV.
7. Subdiario contra mayor: clientes contra 1.1.2 (sin borradores, con «no comparable» por B2) y proveedores contra 2.1.1 con la regla del asiento; diferencia, documentos y estado; CSV.
8. En la UI de Reportes no queda el texto «Cashflow»; `?rep=cashflow` sigue abriendo la vista; el CSV se llama `reporte-contable-facturado-contra-cobrado-<fecha>.csv`.
9. Sin migración, RPC ni escritura nueva. Ningún archivo en rutas públicas. Lint con las fronteras y la regla de `.limit > 1000`.
10. Control rojo: cada regresión de la lista del handoff hace fallar al menos una prueba (exit 1 y la línea `Tests … failed`).
11. `/ui-check` de las tres pestañas de Contabilidad, el Estado de resultados de Reportes y los KPI de Dirección.
12. El handoff registra la revisión de datos personales del CSV del diario.
13. `docs:check`, `sdd:check`, `governance:check` y `components:check` pasan. `pnpm verify` necesita turno del Director.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | cumplimiento | esta spec con allowlist exacta |
| DAT-01 | cumplimiento | `rangoDesdeParams` y `rangoDelDiario` no corrigen en silencio: error que cita lo tecleado y explica el formato; rango inverso y fecha sola probados; la ruta repite la validación (400); borrar una fecha no equivale a «hoy». Presets: «Este mes» en Reportes; el resto del gate de DAT-01 (teclado del selector, zoom, móvil) es el `input type="date"` nativo y no se probó en navegador |
| FRM-01 | cumplimiento | etiquetas persistentes, error junto al campo con `aria-invalid` y `aria-describedby`, validación en cliente y en servidor; los filtros son GET y no hay cambios sin guardar que perder |
| TBL-01 | cumplimiento | tablas semánticas de lectura (`<th scope>`), unidades en las cabeceras, estado vacío honesto, scroll horizontal propio (`TableFrame`); sin selección ni acciones masivas |
| BTN-01 | cumplimiento | «Aplicar» es el único primario del bloque; exportar en pantalla con `ActionButton` ghost; las descargas por ruta son `<a>` o un GET; sin acciones de asentar |
| ERR-01 | cumplimiento | las lecturas incompletas lanzan con nombre (`fetchAllPaged`) y caen en `error.tsx`; la ruta responde 400/403/500 con `apiError` sin detalle crudo en producción |
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
- Mutantes uno por vez, con el script del scratchpad.
- `corepack pnpm typecheck`, `eslint --max-warnings=0` de lo tocado, `docs:check`, `sdd:check`, `governance:check`, `components:check`, `/ui-check`.
- `pnpm verify` con turno del Director.

Producción no se lee ni se escribe. Todo se prueba con fixtures y con el doble `lib/studio/__tests__/listados-double.ts`, que aplica los filtros y corta en 1.000 filas por respuesta.

## Fuera de alcance

- Reparar el posting: reverso al anular (B1), asiento de venta convertido a USD (B2), posting transaccional y bandeja de fallos (B3). Es la fase 2; Por contabilizar es de solo lectura.
- **Otras cifras de «facturado», con dueño:**
  - «Facturado YTD» de `invoiceKpis` (`lib/studio/invoice-queries.ts`) suma `total_amount` con IVA, sin convertir, por `issued_at ?? created_at`. El archivo es de la SDD-0555; se rotula o se unifica en una SDD posterior.
  - El libro de ventas y la Posición de IVA filtran por `created_at` y no normalizan moneda (`lib/studio/fiscal/queries.ts`, `lib/studio/reports/queries.ts`). El criterio de fecha lo decide la contadora.
  - Overview, Costing y Comercial a 12 meses (revenue por embarque, con IVA o por `created_at`).
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

1. Sam y la contadora: ¿confirman el facturado sin IVA por emisión como cifra oficial de gestión, y el mayor (4.5) como control, hasta que la fase 2 cuadre el libro? No bloquea.
2. B10: ¿las facturas `third_party` son ingreso propio? Hoy entran, igual que en el mayor.
3. La contadora: ¿el diario CSV solo con asentados (así cuadra con la comprobación) o también con los anulados y una columna Estado?
4. La contadora: ¿una factura anulada después de cerrar su mes debe restarse en el mes de la anulación (alternativa sin migración con `entity_audit_log`)?
