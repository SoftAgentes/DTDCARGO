# SDD-0687 — decimales, opción A

Estado: implementación preparada; validación local y revisión independientes en curso.
Regla y vista previa de NUM-01 aprobadas expresamente por Sam, confirmadas por Director `msg_c31b38185eb6` el 2026-11-24.

- Owner: `codex-sdd-0687-opcion-a-20261124`.
- Coordinador: `orca_session_id:14b98827-b1e5-41f3-aee0-c72c837f96fc`.
- Sesión: `orca_session_id:59009432-ed96-474c-99b1-b22cb2deffaf`.
- Task: `task_3ad70eb679c6`; Dispatch: `ctx_17e2355591a5`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/Orca/DTDCARGO/sdd-0687-decimales-opcion-a-20261124`.
- Rama: `SoftAgentes/sdd-0687-decimales-opcion-a-20261124`.
- Base verificada: `8580490f8d95872a407ab83ab9acb6b1b265a451`.
- Guard: PASÓ; claim propio comprobado en metadatos Git.
- Permisos: edición, pruebas y commits; rama y PR draft autorizadas; sin merge ni producción.
- Turno pesado: entregado por Director `msg_fd890c795b82`; instalación congelada PASÓ.
- Pruebas focales iniciales: PASÓ, 4 archivos y 342 pruebas.
- Ampliación de seis pruebas autorizada por `msg_505aa05df7cb`:
- `lib/portal/__tests__/payment-reports.test.ts`
- `lib/portal/__tests__/cotizacion-request.test.ts`
- `lib/studio/__tests__/fx-rates.test.ts`
- `lib/studio/__tests__/scorecard-types.test.ts`
- `lib/studio/price-books/__tests__/price-books.test.ts`
- `lib/studio/rate-snapshots/__tests__/types.test.ts`

- Allowlist inicial del Dispatch, ampliada por respuesta `msg_29ad984245b7` para
  `__tests__/parse-numeric-expression.test.ts` y `lib/studio/__tests__/freight-carriers-types.test.ts`.
- Alcance: literales humanos sin miles, separador único decimal, vista inmediata VE;
  precisión/rangos/signo/unidades/edición parcial conservados; `parseMaquina` intacto.
- SDD: `docs/specs/0687-rebrand-cifras-formato-ve/spec.md`, conserva aprobación original, sin marcar done.
- Ampliación `msg_c31b38185eb6`: prueba tracking, NUM-01 y solo su fila del registro,
  regeneración canónica de cápsula y registro de componentes cuando aplica.
- Fuente adicional de test: `app/studio/(app)/tracking/[id]/__tests__/shipment-data-panel-cifras.test.tsx`.
- Política NUM-01: v1.2 opción A aprobada; la propuesta v1.2 previa sin aprobación
  queda trazada como sustituida. No se creó una v1.3 aprobada ni se promovieron otros componentes.

## OBJETIVO ORIGINAL

Implementar opción A y presentar demo ficticia antes de integrar, sin retirar ft³,
reinterpretar registros ni modificar cálculo o redondeos de negocio.

## COMPLETADO

Analizador de opción A y preview VE sin ocultar decimales válidos. Tabla SDD y
contratos de entrada humana actualizados; fronteras canónicas conservadas.
Matriz de consumidores, demo real aislada y capturas escritorio/móvil.
NUM-01 y su fila adoptan la decisión expresa; derivados regenerados con scripts
canónicos. Guard/claim y base verificados; no hay código consumidor modificado.

## VALIDACIÓN

- Instalación congelada PASÓ, sin copiar .env.
- Focal inicial PASÓ: 4 archivos / 342 pruebas.
- Consumidores: 147/148 inicialmente; lista de precios usa su traducción propia
  de formato. Se conservó esa traducción y su suite volvió a PASÓ (27/27).
- `pnpm verify` iniciado antes de aprobación documental final: EN CURSO, log
  `C:/Windows/Temp/sdd0687-verify.log`. Harness PASÓ (392; 5 omitidas), lint PASÓ
  (0 errores; 42 warnings), RSC PASÓ. No se presenta como cierre de la cabeza final.
- Sobre documentos finales: `build-governance-capsule.mjs --check` y
  `validate-component-registry.mjs` PASÓ; 29 políticas y 8 componentes.
- `parseMaquina` idéntico al bloque de base; código consumidor sin cambios.
- Mutantes y validación focal final: pendientes de finalizar verify.

## COMMITS

Pendientes.

## PR / BRANCH

Sin PR aún; rama arriba indicada, base main.

## PENDIENTES DE ESTA TAREA

Cierre de validación local, mutantes, commits/PR y revisión independiente/CI sobre la cabeza final. Regla/vista y adopción normativa aprobadas; integración y publicación no realizadas.

## FUERA DE ALCANCE DETECTADO

Retiro de ft³ y fases de formateadores/salidas futuras.

## HANDOFF AL DIRECTOR

Escritura activa con claim propio. Regla y vista de NUM-01 aprobadas expresamente; integración espera revisión independiente y CI sobre la cabeza exacta.


## Matriz de consumidores (inventario de código, base 8580490f)

Inventario mediante `git grep` de imports y llamadas; no equivale a una prueba
manual de todos los formularios. Solo se editaron el analizador, NumericInput,
sus pruebas autorizadas y documentación de esta tarea.

| Consumidor / frontera | API | Comportamiento y prueba |
|---|---|---|
| `app/studio/(app)/admin/_components/ExchangeRatesSection.tsx` | parseTasa | Texto humano; límite de ocho decimales. Suite fx-rates |
| `app/studio/(app)/proveedores/actions.ts` | parseDinero | Cotización humana; mantiene validación y error del servidor |
| `lib/portal/cotizacion-request.ts` | parseMedida | Números recibidos conservan su valor; cadenas humanas sin miles; cotizacion-request.test.ts |
| `lib/portal/payment-report-types.ts` | parseDinero | Reporte humano, precisión 2 y límites de pago; payment-reports.test.ts |
| `lib/studio/exchange-rates-types.ts` | parseTasa | FormData humano, rango positivo, ocho decimales; fx-rates.test.ts |
| `lib/studio/freight-carriers/types.ts` | parseMonto → parseDinero; parsePrecioFt3 → parseMaquina primero | El servidor conserva canónico ft³ de 4 decimales y alternativa humana; conversiones, campos y redondeos intactos; freight-carriers-types.test.ts |
| `lib/studio/price-books/price-book-types.ts` | parseDinero / parsePorcentaje | Entrada humana, límites y centavos intactos; price-books.test.ts; traducción de error propia conservada |
| `lib/studio/proveedores/scorecard-types.ts` | parseDinero | Reclamo humano con validaciones propias; scorecard-types.test.ts |
| `lib/studio/rate-snapshots/types.ts` | parseDinero | Formulario del congelado, sin releer almacenamiento; types.test.ts; errores i18n propios conservados |
| `lib/studio/util/parse-numeric-expression.ts` | interpretarLiteral | Un separador decimal por operando; BigInt/división y rango final intactos; parse-numeric-expression.test.ts |
| `app/studio/_components/ui/NumericInput.tsx` | parseNumericExpressionDetailed | Texto editable separado de hidden canónico; vista VE; NumericInput.test.tsx |
| `lib/shared/cifras.ts` | parseDinero / parseTasa / parseMedida / parsePorcentaje → parseNumero | Los cuatro wrappers comparten opción A sin cambiar modos/precisión/rangos |

### Formularios que consumen NumericInput

Inventario con AST TypeScript de tags JSX reales, excluyendo menciones en comentarios.
Tipos y modos explícitos o por tipo; min/max/unidad/precisión siguen intactos.
No equivale a una prueba funcional de cada formulario.

| Ruta | Campos JSX | Tipos | Modos explícitos | Props propias preservadas |
|---|---:|---|---|---|
| `app/m/cn/nueva/_components/NuevaRecepcionClient.tsx` | 3 | count, volume, weight | por tipo | min, unit, value |
| `app/m/cn/recepcion/[id]/editar/_components/EditarRecepcionClient.tsx` | 3 | count, volume, weight | por tipo | min, unit, value |
| `app/studio/(app)/admin/_components/calculator/BulkPriceDrawer.tsx` | 2 | currency | por tipo | min |
| `app/studio/(app)/admin/_components/calculator/CityDrawer.tsx` | 1 | count | por tipo | defaultValue, min, unit |
| `app/studio/(app)/admin/_components/calculator/ParametrosPanel.tsx` | 1 | dinámico | dinámico | min, precision, unit, value |
| `app/studio/(app)/admin/_components/calculator/TariffDrawer.tsx` | 5 | currency, count | por tipo | decimales, defaultValue, min, precision, unit |
| `app/studio/(app)/club/_components/GroupBuyDrawer.tsx` | 1 | volume | por tipo | min, value |
| `app/studio/(app)/club/_components/ParticipantDrawer.tsx` | 2 | volume, currency | por tipo | min, value |
| `app/studio/(app)/cn/_components/NewReceiptDrawer.tsx` | 5 | count, volume, weight, currency | por tipo | currency, min, unit, value |
| `app/studio/(app)/cn/_components/RateSnapshotDrawer.tsx` | 2 | currency | por tipo | min, value |
| `app/studio/(app)/cobranzas/_components/CobranzaDrawer.tsx` | 2 | currency | por tipo | currency, max, min, value |
| `app/studio/(app)/cobranzas/_components/UnidentifiedPaymentDrawer.tsx` | 2 | currency, decimal | por tipo, tasa | currency, min, value |
| `app/studio/(app)/contabilidad/_components/AssetDrawer.tsx` | 3 | currency, count | por tipo | currency, min, value |
| `app/studio/(app)/contabilidad/_components/EntryDrawer.tsx` | 2 | currency | por tipo | currency, min, value |
| `app/studio/(app)/contabilidad/_components/StatementDrawer.tsx` | 3 | currency | por tipo | currency, min, value |
| `app/studio/(app)/costing/_components/CostEditorDrawer.tsx` | 1 | currency | por tipo | currency, min, value |
| `app/studio/(app)/costing/_components/TemplateDrawer.tsx` | 1 | currency | por tipo | currency, min, value |
| `app/studio/(app)/cotizador/_components/QuoteDrawer.tsx` | 6 | volume, weight, count, currency | por tipo | currency, min, unit, value |
| `app/studio/(app)/facturacion/_components/InvoiceDetailClient.tsx` | 1 | currency | por tipo | currency, max, min, value |
| `app/studio/(app)/facturacion/_components/InvoiceDrawer.tsx` | 3 | decimal, count, currency | tasa, por tipo | currency, min, value |
| `app/studio/(app)/financiero-china/_components/ChargeDrawer.tsx` | 1 | decimal | dinero | min, value |
| `app/studio/(app)/financiero-china/_components/ClaimOffsetDrawer.tsx` | 1 | currency | por tipo | min, value |
| `app/studio/(app)/financiero-china/_components/ConversionDrawer.tsx` | 4 | decimal | dinero, tasa | min, value |
| `app/studio/(app)/financiero-china/_components/CreditNoteDrawer.tsx` | 1 | decimal | dinero | max, min, value |
| `app/studio/(app)/fiscal/_components/WithholdingDrawer.tsx` | 2 | decimal | dinero, porcentaje | decimales, max, min, precision, unit, value |
| `app/studio/(app)/gastos/_components/ExpenseDrawer.tsx` | 2 | decimal | dinero, tasa | min, precision, value |
| `app/studio/(app)/naviera/_components/AssignCargoDrawer.tsx` | 3 | volume, weight, count | por tipo | min, unit, value |
| `app/studio/(app)/ordenes-compra/_components/PoDrawer.tsx` | 2 | decimal, currency | medida, por tipo | currency, min, value |
| `app/studio/(app)/ordenes-venta/_components/OvDrawer.tsx` | 2 | currency | por tipo | currency, min, value |
| `app/studio/(app)/proveedores/_components/SupplierClaimDrawer.tsx` | 1 | currency | por tipo | value |
| `app/studio/(app)/reclamos/_components/ClaimDrawer.tsx` | 1 | currency | por tipo | min, value |
| `app/studio/(app)/reclamos/_components/ReclamosClient.tsx` | 2 | currency | por tipo | defaultValue, min |
| `app/studio/(app)/seniat/_components/CostHelpers.tsx` | 1 | currency | por tipo | currency, min, value |
| `app/studio/(app)/seniat/_components/CreateFilingDrawer.tsx` | 1 | currency | por tipo | currency, min, value |
| `app/studio/(app)/tarifas/_components/RateDrawer.tsx` | 4 | currency, count | por tipo | currency, defaultValue, min, unit |
| `app/studio/(app)/tesoreria/_components/BillDrawer.tsx` | 3 | currency, decimal | por tipo, tasa | currency, max, min, value |
| `app/studio/(app)/tms/_components/TruckDrawer.tsx` | 1 | dinámico | dinámico | value |
| `app/studio/(app)/tracking/[id]/_components/CargaDelEmbarque.tsx` | 3 | count, volume, weight | por tipo | decimales, min, precision, unit, value |
| `app/studio/(app)/tracking/[id]/_components/ChangeDestinationModal.tsx` | 1 | currency | por tipo | currency, min, value |
| `app/studio/(app)/tracking/[id]/_components/ShipmentDataPanel.tsx` | 2 | weight, volume | por tipo | defaultValue, min |
| `app/studio/(app)/tracking/nuevo/_components/CreateShipmentForm.tsx` | 2 | weight, volume | por tipo | min |

Total del inventario JSX real: 41 archivos, 89 campos. No sustituye runtime.

### Fronteras preservadas y límites de mensaje

- `parseMaquina` y su suite de decimales serializados se conservan; `3.498`
  canónico sigue siendo 3.498 en ft³. Las pruebas de DB (p. ej. tasa
  `36.50000000`) y formateadores (`usd(1234.5) → $1.234,50`) no se cambian.
- No se leen datos reales ni se reinterpretan registros. No hay migración,
  escritura de negocio, redondeo nuevo ni retiro de ft³.
- Mensaje exacto de agrupación: shared/NumericInput, Portal de pagos, tasa y
  scorecard lo reciben. Lista de precios conserva «El precio pactado es un
  número, por ejemplo 690 o 690,50»; transportistas conserva «No es un monto
  válido» y snapshots conserva su código i18n. La solicitud del Portal conserva
  su contrato de número opcional → null. No se amplió código de consumidores
  para unificar esos mensajes; requiere otra autorización si se decide hacerlo.
- Comentarios antiguos de consumidores y del parser de expresiones todavía
  describen la regla de ambigüedad anterior; no se editaron fuera de allowlist.

### Revisión de gobernanza

Superficie: entrada numérica transversal Studio y consumidores shared; riesgo R2,
revisión previa por montos. NUM-01 v1.2 opción A aprobada expresamente por Sam según `msg_c31b38185eb6`.

| Política | Clasificación | Evidencia / gate |
|---|---|---|
| NUM-01 v1.2, opción A | cumplimiento focal; regla/vista aprobadas | cifras.ts / NumericInput, tabla y pruebas; revisión y CI final antes de integrar |
| FRM-01 v1.1 | cumplimiento focal | primer error al confirmar, corrección posterior, parcial conserva último válido y bloquea submit; prueba del componente |
| ERR-01 v1.0 | cumplimiento focal | texto preservado, aria-describedby, sin región viva durante edición; mensajes propios de consumidores conservados |
| Datos, DB y publicación | no aplica | No cambian schema, permisos ni producción |

El validador del plugin devolvió «policy-registry.json está desactualizado»;
sus entradas derivan de la cápsula y componentes que esta tarea no modificó.
El plugin instalado ya estaba desactualizado antes de la adopción final; no se regeneró su cache fuera de alcance. La política se aprobó por confirmación expresa, no para poner verde un gate.


## Demo local con el componente real

- URL: `http://127.0.0.1:5687/`; browserPageId `fa8dde1c-ca24-4711-9805-cb35c930b570`.
- Terminal preservado: `term_ab999cc0-4158-4208-bda6-1c5da45f9bce`, Demo SDD-0687.
- Reproducción local: desde este worktree, `node C:/Windows/Temp/sdd0687-demo/server.mjs`.
- Es un montaje aislado de NumericInput real mediante Vite, fuera de rutas del producto,
  sin backend, auth, .env ni datos reales. No equivale a flujo ERP completo ni a aceptación de implementación.
- Capturas observadas: `C:/Windows/Temp/sdd0687-demo/escritorio.png` (1280×1000)
  y `C:/Windows/Temp/sdd0687-demo/movil.png` (ancho 390, página completa).
- Se observaron `0.366 → 0,366 m³`, `1250 → 1.250 m³`, monto `1234,50 → 1.234,50`,
  tasa con ocho decimales, porcentaje, peso con signo permitido y ft³ de cuatro decimales.
- Ambas agrupaciones `1.234,50` y `1,234.50` produjeron el mensaje exacto al confirmar;
  corregir a `1234,50` retiró el error. DOM: agrupado invalid/hidden vacío y Constraint
  Validation false; valores válidos con hidden canónico. No se registró ninguna operación.
- Las primeras capturas se tomaron antes de recibir la confirmación normativa de Sam;
  la confirmación posterior está trazada arriba, separada del resultado de pruebas.
