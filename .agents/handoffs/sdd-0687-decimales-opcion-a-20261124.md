# SDD-0687 — decimales, opción A

Estado: lista para revisión; regla y vista previa aprobadas por Sam. No integrada ni publicada.

### Corrección fiscal posterior a Quality (2026-11-24)

Quality [45412543217](https://github.com/SoftAgentes/DTDCARGO/actions/runs/45412543217),
sobre `5500ffffe77ca8716020fa614df0a2e62157aebe`, terminó en FALLÓ: 1 archivo
fallido, 1381 aprobados y 6 omitidos; 1 prueba fallida, 22378 aprobadas y 44
omitidas. El único rojo fue `WithholdingDrawer.test.tsx:31`, que aún aceptaba
la entrada humana agrupada `1.200,50 + 2.300,50`. No se atribuye a flakiness:
ese fixture contradecía la opción A.

El Director autorizó esa ruta en `msg_3a65db49fba6`. Se volvió a adquirir el
claim propio, con guard correcto y árbol limpio, para modificar solo la prueba,
esta evidencia y la allowlist SDD. La suma válida pasa a `1200,50 + 2300.50`;
se conservan base `3501`, monto canónico `2625.75` y salida fiscal `2,625.75`.
Cuatro casos nuevos rechazan agrupaciones VE/US en cada operando, conservan
el texto, vacían los ocultos, invalidan el formulario y muestran el mensaje
exacto. El caso de porcentaje parcial `75+` permanece intacto.

Validación de este delta: PASÓ Vitest focal (un archivo, seis pruebas,
`--maxWorkers=1`), ESLint del archivo, `docs:check` y `git diff --check`.
No hay cambio de producto ni cálculo fiscal; no se repitieron instalación,
build, verify o suite global local. El turno pesado sigue entregado.
Se publica la corrección en la misma PR; Quality debe volver a cerrar sobre
la nueva cabeza. La evidencia de `5500ffffe` que sigue abajo es el corte previo,
no un verde general de la cabeza corregida. El claim se libera otra vez tras
el commit de esta corrección, antes de worker_done.

- Owner: `codex-sdd-0687-opcion-a-20261124`.
- Coordinador: `orca_session_id:14b98827-b1e5-41f3-aee0-c72c837f96fc`.
- Sesión: `orca_session_id:59009432-ed96-474c-99b1-b22cb2deffaf`.
- Task: `task_3ad70eb679c6`; Dispatch: `ctx_17e2355591a5`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/Orca/DTDCARGO/sdd-0687-decimales-opcion-a-20261124`.
- Rama: `SoftAgentes/sdd-0687-decimales-opcion-a-20261124`.
- Base: `8580490f8d95872a407ab83ab9acb6b1b265a451`, verificada antes de editar.
- Guard: PASÓ al inicio y antes del commit; claim propio comprobado en metadatos Git.
- Permisos: edición, pruebas, commits, rama y PR; sin merge, DB real, migraciones ni deploy.
- Ampliaciones: `msg_29ad984245b7` (expresiones/transportistas), `msg_505aa05df7cb`
  (seis suites consumidoras), `msg_c31b38185eb6` (tracking y adopción normativa)
  y `msg_3a65db49fba6` (prueba fiscal tras Quality).
- NUM-01: Sam aprobó expresamente regla y vista previa el 2026-11-24, según
  confirmación del Director `msg_c31b38185eb6`. La selección inicial para construir
  y esta aprobación posterior se distinguen. v1.2 conserva la trazabilidad de
  v1.1 y de la propuesta anterior; no se promueven otros componentes.
- Turno pesado entregado por `msg_fd890c795b82` y devuelto mediante
  `msg_5a4cb891cfb8`; no quedan corridas pesadas locales activas al cierre.

## OBJETIVO ORIGINAL

Opción A: punto o coma únicos son decimales en cada literal humano; agrupaciones
rechazadas, vista inmediata venezolana y precisión/rango/signo/unidades/edición
parcial conservados. Presentar demo ficticia y entregar código revisable sin
reinterpretar registros, cambiar cálculo de negocio o retirar ft³.

## COMPLETADO

- Analizador compartido sin agrupación humana y sin regla de ambigüedad.
- NumericInput muestra salida VE y no oculta decimales válidos del resultado.
- Tabla SDD y doce archivos de pruebas propios/consumidores actualizados;
  código consumidor y `parseMaquina` intactos. Se cubren dinero, tasa, medida,
  porcentaje, USD/EUR/VES, unidades, precisión especial, cero/vacío, signo,
  rangos, expresiones por operando, edición parcial, error y recuperación.
- NUM-01 y solo su fila del registro adoptan la decisión expresa; derivados
  regenerados canónicamente. El registro de componentes cambia solo sourceCommit.
- Inventario AST: 41 formularios, 89 campos JSX reales; matriz de wrappers y
  fronteras abajo. No equivale a aceptación manual de todos los formularios.
- Demo local del componente real, estado de error y capturas escritorio/móvil.

## VALIDACIÓN

| Comprobación | Estado | Evidencia / límite |
|---|---|---|
| `corepack pnpm install --frozen-lockfile` | PASÓ | Dependencias propias; sin copiar .env |
| Vitest focal final, `--maxWorkers=1` | PASÓ | 12 archivos, 524/524; once suites afectadas y TransportistasPanel en aislamiento |
| Mutantes | PASÓ | 9/9 muertos; controles previo y posterior 345/345; fuentes restauradas byte a byte |
| ESLint final | PASÓ | 13 archivos TS/TSX del delta, sin errores ni warnings |
| `build-docs-index.mjs --check` | PASÓ | Índice sincronizado con 695 specs |
| `check-numbering.mjs` | PASÓ | Sin colisiones nuevas; excepciones históricas informadas |
| `build-governance-capsule.mjs --check` | PASÓ | 29 políticas; estado final aprobado de NUM-01 |
| `validate-component-registry.mjs` | PASÓ | 8 componentes; sin promociones ajenas |
| `git diff --check` | PASÓ | Sin errores de whitespace |
| Comparación `parseMaquina` con base | PASÓ | Bloque idéntico, consumidores sin cambios de código |
| Demo en navegador Orca | PASÓ focal | Ejemplos, hidden canónico, agrupaciones, error al confirmar y corrección; no ERP completo |
| `pnpm verify` local previo | NO COMPLETADO | Iniciado antes del delta final; interrumpido durante suite general, salida 1 por interrupción; no se declara verde |
| Build, e2e y gates restantes de ese verify | NO EJECUTADO | El runner no llegó a ellos; Quality final cubre cierre sin secretos, no equivale a pruebas e2e completas |
| Quality de GitHub | PENDIENTE al cierre de escritura | Se activa sobre la cabeza final de PR #807; consultar checks en esa cabeza exacta |

El verify previo sí completó harness (392 aprobadas, 5 omitidas), lint global
(0 errores, 42 warnings), frontera RSC, typecheck y las cuatro Edge Functions.
Esos resultados no se presentan como una corrida canónica completa del delta
final. Los tres últimos casos de denominación se comprobaron después en focal y
controles de mutantes; los gates documentales se ejecutaron tras la adopción final.

La suite general interrumpida observó fallos en TransportistasPanel (dos casos),
supplier-flow, correo-comprobacion y cable-oficina-puente. TransportistasPanel
pasó 24/24 en el control final aislado. Las otras tres suites no se repararon ni
se declararon flakiness o fallos de base sin un control que lo demuestre; Quality
de la cabeza final determina el cierre general.

Comando focal: `node node_modules/vitest/vitest.mjs run` con los once archivos
de prueba de la allowlist SDD más
`app/studio/(app)/admin/_components/calculator/__tests__/TransportistasPanel.test.tsx`,
`--maxWorkers=1`. El wrapper cmd de corepack no preservó inicialmente los paths
con paréntesis; se invocó el entry Node directamente, sin cambiar la configuración.

Logs locales: `C:/Windows/Temp/sdd0687-verify.log`,
`C:/Windows/Temp/sdd0687-mutantes/`. El instrumento de mutantes tuvo inicialmente
un error al imprimir Unicode en CP1252; restauró en finally y conservó los tres
reportes ya escritos. Se corrigió la impresión, se repitió el control previo,
se completaron los seis mutantes restantes y el control posterior. No hubo
fallos de carga, cero pruebas ni mutantes activos al cerrar.

## COMMITS

- `039ecc8f1e29276fa7e248f7a6ce8073e55baf15`: implementación, contratos y adopción
  normativa autorizada.
- `5500ffffe77ca8716020fa614df0a2e62157aebe`: denominaciones y corte de evidencia
  previo a Quality; el rojo fiscal de esa cabeza se corrige en el commit actual.
- Commit que contiene este documento: evidencia final y comprobación explícita
  del contrato consumidor fiscal. SHA final disponible en PR; se evita una cadena de
  commits para incluir el hash propio en el documento.

## PR / BRANCH

[PR #807](https://github.com/SoftAgentes/DTDCARGO/pull/807), base `main`, rama
`SoftAgentes/sdd-0687-decimales-opcion-a-20261124`. Se publica como borrador y
se abre a revisión para activar Quality tras subir la cabeza final, según
instrucción del Director de usar CI para el cierre íntegro.

## PENDIENTES DE ESTA TAREA

- Quality sobre la cabeza final y revisión independiente por impacto en montos.
- Integración y publicación corresponden al Director; no realizadas aquí.
- Regla/vista y NUM-01 ya aprobadas; no se solicita esa aprobación otra vez.

## FUERA DE ALCANCE DETECTADO

- Retiro de ft³, fases futuras y cambio global de formateadores/exportaciones.
- Traducciones de error y comentarios históricos de consumidores no editados.
- Las tres suites generales pendientes de diagnóstico indicadas arriba; no se
  absorben bugs ajenos para presentar un verde local.
- Cache del plugin de gobernanza desactualizada, detectada antes de la adopción;
  los gates canónicos del repositorio sí pasaron. No se editó el plugin instalado.

## HANDOFF AL DIRECTOR

Resultado listo para revisión. PC liberada; solo queda el servidor liviano de
demo para consulta, sin nuevas corridas pesadas. La escritura termina con el
commit de cierre y después se libera el claim con
`node scripts/harness-worktree.mjs release --owner codex-sdd-0687-opcion-a-20261124`,
antes de worker_done; la confirmación de liberación queda también en la entrega
y PR. No se elimina el worktree ni la rama.

## Matriz de mutantes

| Mutante | Aserciones falladas | Estado |
|---|---:|---|
| `aceptar-agrupado-ve` | 30 | muerto por aserciones |
| `aceptar-agrupado-us` | 32 | muerto por aserciones |
| `aceptar-miles-repetidos` | 14 | muerto por aserciones |
| `separador-unico-como-miles` | 47 | muerto por aserciones |
| `rechazar-punto-tasa` | 4 | muerto por aserciones |
| `omitir-precision` | 26 | muerto por aserciones |
| `eco-en-us` | 16 | muerto por aserciones |
| `ocultar-decimales-tasa` | 1 | muerto por aserciones |
| `conservar-callback-anterior` | 5 | muerto por aserciones |

Se conserva el código fuente sin mutantes; cada prueba compara comportamiento real.

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
