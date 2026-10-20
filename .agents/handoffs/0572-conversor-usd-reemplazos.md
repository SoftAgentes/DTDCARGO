# Handoff · SDD-0572 · Los 13 conversores a USD pasan a uno solo, que falla cerrado (0572-a)

## Retoma local autorizada después de #301 · 2026-10-20

Esta sección es el estado vigente; el cierre parcial siguiente conserva su
fecha y evidencia, sin sustituir la validación de esta retoma.

**Estado al cierre local:** producto revisado en `4dbdb21b3d8017d0c60c6d70291e86347f020233`,
respaldado en [PR #310, borrador](https://github.com/SoftAgentes/DTDCARGO/pull/310).
Implementación y revisión local completadas; `verify` terminó con **CIERRE
INCOMPLETO, 14/17 controles medidos y exit 0**. No equivale a cobertura completa
ni a preparación para integrar. El commit que contiene este cierre solo cambia
spec/handoff; producto y pruebas permanecen idénticos a 4dbd.

**OBJETIVO ORIGINAL:** completar 0572-a con los contratos de incompletitud
cambiaria aprobados, pruebas y validación local, conservando 2.3/G y SQL fuera.

**Adopción:** worktree y rama de la tabla histórica, HEAD recibido
`9c254107c7c1b9544bf91ebff177ab790b438f5f`. A `2026-10-20T21:51:58Z` el árbol
estaba limpio, claim ausente y sin consumidores Node/Claude/Codex explícitos
del worktree. Sam pausó las sesiones anteriores y autorizó la adopción.
`node_modules` es local sin junction; no se copiaron secretos ni se instalaron
dependencias. Guard y claim
`worker-0572-01a15a4e-ddf0-7d82-8656-d9dc56b58468` pasaron.
Fetch confirmó origin/main `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`; merge
limpio en la rama propia produjo `2df9d22dbcff3fbf77056b434494450faf33b88f`.
Se preservaron `tasaPersistible`, `usdOrNull`, `sumarEnUsd` y la dependencia
completa de 0569. El Director confirmó 0495 aplicada/verificada; no se reaplica.

**Decisión autorizada antes de producto:** R1–R3/I1–I4/C1 y T1–T10 de
`C:/tmp/director-traspaso-20261020/0572-retoma-despues-301.md`. Diferencia total
null ante cualquier conversión faltante; subtotal y contador visibles; nunca
Cuadra/éxito. Se mantienen ausencia de mayor/cuenta, B3 sin cuantificar el
total incompleto y `no_comparable` de nominal mixto. Nuevo motivo
`conversion_incompleta` solo cuando corresponde, preservando el futuro puente
0573. El cambio de la aserción I2 fue aceptado por contrato, no para hacer
pasar un test. Costing completo primero e incompleto al final estable;
exclusión de top/peores, margen sin evaluación definitiva, propagación a
totales/rutas y CSV con estado/contador y null vacío. Sin recalcular 4.5,
facturado oficial ni KPIs globales. Truncamiento/error de lectura rechaza.

**Allowlist y permisos iniciales:** 58 rutas exactas en la spec: las 55 previas más
`IngresoDelPeriodoCard.tsx`, `CostingClient.sin-tasa.test.tsx` y
`lib/studio/reports/export-csv.ts`. Ediciones reversibles, commits selectivos,
push de esta rama y draft PR después de validación local autorizados.
Cambios heredados al integrar 0569 no son autoría propia. No SQL, producción,
merge a main, deploy, tags, pagos, datos de negocio ni cambios ajenos.

**COMPLETADO:** T1–T10 reproducidos y contrato implementado. `topAndWorst`
excluye incompletos positivos y negativos; los cuatro órdenes los dejan al
final estable. Ranking, Overview, totales, rutas y CSV conservan subtotal,
costos y contador sin certificar margen. `diferenciaUsd` es null si falta una
conversión; el motivo nuevo no desplaza B3, mayor/cuenta ausentes ni nominal
mixto. Se corrigió el texto CNY del CSV. Los filtros oficiales no cambiaron.
T9 (paginación/dedup) ya pasaba a nivel de fila; la nueva proyección de rutas
sí fallaba. T10 (truncamiento/error) ya pasaba y permanece como regresión.
El Director aprobó además `overflowX:auto` solo en el ranking: el contenedor
recortaba su nuevo contador a 390 px. No se rediseñaron columnas ni otras vistas.

**VALIDACIÓN actual:** turno exclusivo concedido a `21:58:10Z`. Evidencia en
`C:/tmp/director-traspaso-20261020/0572-codex-validation/`, fuera de Git.

| Comprobación / alcance | Resultado y recibo |
|---|---|
| Base `2df9d22d` + regresiones, producto sin reparar | **FALLÓ esperado:** 23 aserciones funcionales / 179 PASÓ en 8 archivos, sin errores de import/mock/infra. `retoma-red.log`, 21:58:35Z–21:59:20Z |
| Mismos 8 archivos sobre producto reparado | **PASÓ:** 202/202, sin SKIPs, `retoma-green-1.log` |
| Regresión ampliada, incluidos captura/CAS/correo/CxP de 0569 | **PASÓ:** 29 archivos, 632/632, sin SKIPs, `retoma-focal-expanded.log`; inventario `retoma-focal-files.json` |
| Mutantes funcionales | **PASÓ:** 21/21 detectados y fuentes restauradas por SHA256; `retoma-mutants-result.json` + logs individuales. Incluye cinco guards de asientos, dos de rendición, CNY, fallback fijo, ranking/CSV/completitud y tres lectores truncados |
| `corepack pnpm typecheck` | **PASÓ**, exit 0, `retoma-typecheck.log` |
| ESLint del diff propio TS/TSX | **PASÓ:** 55 archivos, cero warnings, `retoma-lint.log` |
| Cambio final de scroll del ranking | **PASÓ:** 6/6 pruebas del componente y lint puntual; `retoma-ui-final-focal.log`, `retoma-ui-final-lint.log` |
| UI sintética con componentes reales y tokens/fuentes locales | **PASÓ en el alcance observado:** incompletitud positiva/negativa, B3, nominal mixto, cero conocido, claro/oscuro y contenedor 390 px. Margen/contador visibles tras desplazamiento horizontal; escritorio sin desborde. No acredita dispositivo real ni Studio autenticado |
| `pnpm verify` sobre220a, build y E2E | **INTERRUMPIDO / NO ACEPTADO:** dos aserciones fallidas y revisión F1–F6; sin resultado global. Build/E2E posteriores NO EJECUTADOS. Recibo de parada abajo |
| DB/producción/migraciones | **NO EJECUTADO:** fuera del encargo; diff SQL y captura/CAS/correo frente a `d410ab2e` vacío |

La UI usa `CostingClient` e `IngresoDelPeriodoCard` reales; solo los dos
editores inactivos se sustituyeron por null. Servidor estático propio en
127.0.0.1:4802, sin credenciales, banco ni datos reales. Capturas
`retoma-ui-ranking-ascending-light.png`, `retoma-ui-ranking-final-dark.png`,
`retoma-ui-routes-dark.png`, `retoma-ui-b3-dark.png` y
`retoma-ui-width390-scrolled-{light,dark}.png`. La captura anterior
`retoma-ui-width390-light.png` documenta el recorte. Medida posterior:
356 px visibles / 810 de contenido, scrollLeft 454; escritorio 1246/1246.
Tab cerrada y PID 4880 detenido; puerto sin listener a 22:11:59Z, recibo
`retoma-fixture-cleanup.json`. No se ejecutó auditoría integral de accesibilidad
ni prueba de dispositivo físico. `/ui-check` se aplicó al diff: tokens,
componentes existentes y estado textual neutral; sin nuevos anchos fijos.
El aviso nuevo de rendición pasó de peligro a tinta neutral y el aviso de
Reportes usa spacing de la escala. Hallazgo restante descrito abajo.

**Checkpoint 22:25Z / decisión Director:** producto publicado en
`220a2c3e30b0b070a5dc6d44ad8131021f2a0d2c`, local/remoto iguales y árbol limpio
al detener. La corrida `corepack pnpm verify` comenzó a22:16:18Z y se
**INTERRUMPIÓ por orden expresa, INCOMPLETA**: harness237/237, lint0errores/
15warnings globales, rsc-boundary, tipos y cuatro edge functions PASÓ.
Se observaron dos asserts unitarios fallidos (builder e inventario de lecturas);
no se completó la suite ni se atribuyen conteos globales. Los gates posteriores,
build y E2E NO EJECUTADOS. Logs `retoma-verify-220a2c3e.log` y recibos
`retoma-verify-220a2c3e-{start,process-tree-before-stop,process-tree-stop,stop}.json`.
Parada solo del árbol propio25392, 34procesos identificados con CreationDate;
sesión45345 cerróexit-1 y limpieza53275exit0. Cero descendientes/consumidores y
puerto4802 libre a22:25:17Z, `retoma-heavy-turn-return.json`. Turno pesado
**DEVUELTO temporalmente** al Director; no ejecutar antes de nueva concesión.

La revisión independiente detectó subconteo de `resolveSinTasa` si un embarque
tiene simultáneamente dos facturas sin tasa, una con ID+code y otra solo code.
T9 anterior separaba esas alternativas y no cubría la mezcla simultánea.
Nuevo ROJO pendiente con IDs documentales distintos y segunda página, sin
cambiar subtotal conocido. La reparación de producto espera esa reproducción
y la precisión del revisor sobre consumidores de márgenes de Reportes/Mixto.

**Ampliación aprobada antes de editar:** allowlist **58→60**, solo
`lib/studio/reports/__tests__/builder.test.ts` y
`scripts/__tests__/invoice-read-boundary.test.mjs`. No se relajan pruebas:
catálogo exacto incluye `tasa` y proyección real de completos/incompletos para
facturas/embarques; inventario exacto mantiene19rutas, costing2→1/total44→43
por eliminación de `latestVesFxRate`. La lectura restante de revenue conserva
cliente de sesión, guards y RLS; display lee `fx_rates` con `ultimaTasa` y el
mismo cliente, sin añadir acceso admin ni lecturas de facturas.

**Ampliación posterior aprobada 60→65:** `BuilderView.tsx`,
`CobranzasClient.tsx` y tres pruebas reales de ReportesClient, BuilderView y
CobranzasClient (rutas exactas en spec). Hallazgos agrupados para ROJO sobre220a:
Mixto pierde completitud de los agregados Costing; CSV rutas/servicios/aging/
cashflow pierde contador/estado; Aging solo excluidas declara vacío y omite CSV;
Constructor convierte métrica ausente en cero y no protege agrupaciones por
cliente; fondos no muestra `sinTasaCount` y omite un no identificado sin tasa.
Contrato aprobado: subtotal parcial, estado y contador en esas salidas; nunca
margen/promedio monetario definitivo si incompleto; solo desconocido distinto
de cero conocido. Cantidad/medidas físicas/costo por CBM siguen calculables.
Clasificación de fondos no cambia, y no identificado se cuenta sin depender
de la tasa. No amplía a KPIs globales/SQL/ledger/IVA. Preparar docs/pruebas sin
ejecución ni corrección de producto hasta recuperar turno del publicador.

**Preparación de reparación F1–F6:** informe externo
`C:/tmp/director-traspaso-20261020/0572-revision-independiente-220a2c3e.md`,
SHA256 `a8bcdd053a85909c3ecb9fb1f537989365b5aa61228c0c8d9f13aca8cf19a980`.
Se prepararon nueve archivos focales de pruebas sobre producto220a intacto:
queries Costing; queries/Builder/CSV Reportes; payment-receipts; tres componentes
reales y el inventario de invoices. Incluyen mezcla simultánea ID+code/solo-code
con documentos distintos y segunda página, FK ajeno no reasignado por code,
Aging CxC sola/CxP sola/ambas/parcial/vacío, Mixto con signo positivo/negativo,
costo/CBM preservado, Constructor por Cliente/Estado/filtro, cero conocido y
fondos sin identificar independientes del FX. No se simula el agregador probado.
Ese checkpoint de preparación conservó producto 220a intacto; el turno pesado
se devolvió expresamente a 0572 a las 22:43:12Z y se ejecutó la secuencia siguiente.
La precisión de gobernanza en spec se corrigió: contrato Director, SGE-00.07 y
NUM-01 para estado verdadero/precisión; DAT-01 no aplica al delta de fechas.
El whitespace EOF de format.ts quedó corregido; `git diff --check d410ab2e`
PASÓ sobre el rango completo y el árbol reparado.
El Director confirmó conservar el formato histórico entero de la columna
monetaria del CSV Constructor y su prueba, añadiendo subtotal conocido con
centavos/estado/contador y null vacío. La revisión global de ese formato se
clasifica **FUERA DE ALCANCE DETECTADO**, no como pendiente F5.

**Checkpoint reparado F1–F6, antes de la revisión independiente nueva:**

- F1 cuenta FK propio más documentos sin FK por code, con identificadores
  documentales distintos, mezcla simultánea, segunda página y FK ajeno. No
  se modificó la selección histórica del subtotal revenue por mapas.
- F2 conserva incompletitud en cliente/CBM de Mixto, sus totales y CSV;
  margen e ingreso/CBM quedan pendientes, costo y costo/CBM permanecen válidos.
- F3/F4 Aging con CxC sola/CxP sola/ambas sin tasa conserva existencia, subtotal
  y exportación. Rutas/servicios/cashflow exportan estado y contador; el
  cashflow cuenta los documentos excluidos por mes, conservando sus filtros.
- F5 propaga completitud monetaria por métrica/grupo/total, además del filtro;
  solo desconocido conserva null, suma parcial conserva subtotal y promedio
  incompleto conserva null más subtotal conocido en helper/CSV. El catálogo
  UI vigente solo ofrece sumas monetarias: no se añadió promedio monetario.
  Cantidad/CBM siguen calculables. El total global físico conserva round2
  histórico, sin redondear las filas de suma CBM.
- F6 muestra el contador de fondos y cuenta el cobro sin identificar antes
  del descarte por FX. Se conserva clasificación propios/terceros y subtotal.

| Comprobación nueva (producto posterior a 220a, aún sin SHA de cierre) | Resultado / evidencia externa |
|---|---|
| ROJO funcional sobre producto220a | **FALLÓ esperado:** 43/184 inicialmente, 141 PASÓ. Cuatro negativos UI dieron selector ambiguo por valores erróneos duplicados; se precisaron con queryAll y se repitieron las dos suites sin tocar producto: 14 fallos funcionales/1 PASÓ. `revision-f1-f6-red*` y `revision-f1-f6-red-ui-selectors*`; no error de import/mock/infra |
| Verde inicial F1–F6 | **PASÓ:** 184/184 en 9 archivos, sin SKIPs, `revision-f1-f6-green-2.log`. La primera verde dejó 182/184: un texto genérico de pie de impresión confundía el estado completo; se corrigió ese texto, no las aserciones |
| Redondeo físico histórico | **FALLÓ esperado:** total 0.3579 vs 0.36 en nueva regresión; 30 pruebas no seleccionadas. Reparado antes del focal ampliado, `revision-cbm-red.log` |
| Focal ampliado, incluido contrato heredado 0569 | **PASÓ:** 751/751, 35 archivos, sin SKIPs, `revision-expanded-focal.log/.json` |
| Mutantes nuevos | **PASÓ combinado:** 22/22 detectados con fallos funcionales y restauración SHA256. La primera selección produjo 21/22: Aging 11 sobrevivió al correr suite CSV sin los casos solo excluidas. Su suplemento con queries detectó los 3 casos; no se reescribe el resultado inicial. `revision-mutants-result.json`, `revision-recheck-mutants-result.json` |
| Mutantes originales repetidos | **PASÓ:** 21/21 detectados/restaurados, `revision-original-mutants-result.json` |
| Tipos | **PASÓ:** corepack pnpm typecheck, `revision-typecheck.log` |
| Alcance y whitespace | **PASÓ:** 65 rutas contra d410, ninguna fuera; full-range diff-check limpio. `revision-scope.json` |
| ESLint | **PASÓ:** 61 archivos TS/TSX, cero advertencias; `revision-lint.log` y manifest `revision-lint-files.json` |
| Espera del efecto de Builder en la prueba | **PASÓ:** 4/4, sin avisos React, `revision-builder-act-green.log` |
| UI nueva, verify y revisión nueva | **PENDIENTES al preparar este checkpoint**; se registrarán con recibo al finalizar |

Los efectos de lectura de reportes guardados del Builder se esperan con act en
la prueba; no se alteró ese comportamiento de producto. La revisión React se
limita al delta de TSX, sin refactor ni bibliotecas nuevas. La fixture F1–F6
está preparada fuera de Git con componentes/agregadores reales y adaptadores
de navegación/toast/editores inactivos; todavía no acredita validación visual.

**Checkpoint publicado de reparación:** `3c36a7b242f78b2a2b93250ee30c9e2d897d5087`,
local/remoto iguales y árbol limpio al publicar. El recibo externo
`revision-checkpoint-3c36a7b2.json` conserva los exits efectivos de tipos,
lint y docs, además de la igualdad remota. Los resultados F1–F6 anteriores
corresponden a ese producto; la UI final añade solo el delta siguiente.

**Ajuste visual aprobado por el Director después de observar la fixture:**
en `ReportesClient.tsx`, las tablas de rentabilidad y CBM colapsaban la primera
columna a 390 px y dejaban columnas fuera de la tarjeta. En `BuilderView.tsx`,
el importe/estado quedaba recortado y el pie visible todavía decía CNY → 0.
El Director autorizó únicamente contenedores horizontales desplazables,
ancho mínimo coherente de cabecera/filas y texto acorde con la tasa del
documento. Se preservan cifras, agregadores, catálogo, selectores, acciones,
tokens y estructura de las vistas. No se añadieron pruebas que espejen CSS.
El comentario de cashflow en `queries.ts` ya estaba corregido en 3c36; no
requiere otro cambio de producto. Solo dos TSX cambian en este delta visual.

**UI F1–F6 ejecutada con datos ficticios y componentes/agregadores reales:**
ReportesClient, BuilderView y CobranzasClient, con fixtures fuera de Git.
Se observaron parcial/solo desconocido/cero conocido, Mixto cliente/ruta/CBM,
Aging CxC sola/CxP sola/ambas sin tasa y verdadero vacío, cashflow mensual,
fondos y exportación habilitada cuando solo hay excluidas. Las medidas
físicas/costo por CBM siguen disponibles y los márgenes incompletos no se
certifican. No hubo credenciales, lecturas de negocio ni conexión a base.

- **PASÓ en el alcance observado:** escritorio claro/oscuro y contenedor de
  390 px, no dispositivo móvil real. Contenido de la fixture 358/358 px sin
  desborde; regiones visibles de 356 px con contenidos 724/744/620 y últimos
  desplazamientos observados 368/388/264 respectivamente. Escritorio: tablas
  1246/1246 sin scroll. La última columna y el contador son consultables.
- Evidencia anterior/posterior: `revision-ui-mixto-cliente-390-table-before.png`,
  `revision-ui-mixto-cliente-390-after.png`,
  `revision-ui-mixto-cliente-390-last-light.png`,
  `revision-ui-mixto-cbm-390-last-dark.png`,
  `revision-ui-builder-390-last-dark.png`,
  `revision-ui-cbm-desktop-dark.png` y `revision-ui-measurements.json`.
  Aging/fondos/cashflow conservan capturas `revision-ui-*` separadas.
- Estas capturas corresponden a los bytes de 3c36 más el delta de los dos TSX
  contenido en este commit. La compilación de fixture final pasó; el primer
  intento falló por resolución React del adaptador externo y se corrigió allí,
  sin alterar producto para resolver infraestructura.
- **PASÓ:** focal final de los tres componentes, 18/18 sin SKIPs, exit 0,
  sesión 75534; tipos exit 0, sesión 4596; ESLint de los dos TSX exit 0 sin
  advertencias, sesión 32924. Recibos `revision-ui-final-focal.log/.json`,
  `revision-ui-final-typecheck.log` y `revision-ui-final-lint.log`.
- Servidor propio solo en 127.0.0.1:4802. Se cerraron tab, PID34560 y su
  conhost13164; cero procesos y listeners a `2026-10-20T23:06:00Z`,
  `revision-fixture-cleanup.json`. No se deja servicio de fixture activo.
- **NO EJECUTADO:** Studio autenticado, producción, dispositivo físico,
  auditoría integral de accesibilidad e impresión/PDF. La observación local
  no certifica esas superficies. No se repitieron 751 pruebas ni 43 mutantes
  por este delta exclusivo de disposición/texto, por decisión del Director.

**VALIDACIÓN canónica final sobre 4dbdb21b:** `corepack pnpm verify`, sesión63809,
desde `2026-10-20T23:10:17.5474501Z` hasta `23:37:18.8128386Z`, 1621.265s.
Salida real **exit 0**, con veredicto literal **CIERRE INCOMPLETO — CRÍTICOS SIN
MEDIR: migrations-applied, sql-tests, schema-rebuild**. No se cambiaron límites,
políticas ni exclusiones. El runner no mide el tiempo individual de todos los
controles; se conservan únicamente las duraciones emitidas.

| Control | Resultado y alcance |
|---|---|
| harness | **PASÓ:** 237/237, sin omisiones, 114.567s |
| lint | **PASÓ con advertencias:** 0 errores y 15 warnings generales previos; lint propio sin warnings |
| rsc-boundary | **PASÓ:** 1706 módulos, sin cruces prohibidos |
| typecheck | **PASÓ:** sin errores |
| edge-functions | **PASÓ:** 4 funciones |
| test | **PASÓ con omisión:** 12378 pruebas / 867 archivos aprobados; 1 prueba / 1 archivo omitido, 582.44s, sin reintento de suite |
| docs:check | **PASÓ:** 557 specs, índice sincronizado |
| numbering | **PASÓ:** 557 specs / 489 migraciones, colisiones históricas declaradas |
| feature-constants | **PASÓ:** 6 banderas |
| components:check | **PASÓ:** 5 fuentes, agregado reproducible |
| governance:check | **PASÓ:** 28 políticas, cápsula vigente |
| migrations-applied | **NO EJECUTADO:** sin credenciales; validación de release, no motivo para aplicar DB |
| pending-migration-symbols | **PASÓ con aviso:** 0 rojo, 1 amarillo declarado 0495 y 3 homónimos descartados |
| sql-tests | **NO EJECUTADO:** Docker NO DISPONIBLE |
| schema-rebuild | **NO EJECUTADO:** Docker NO DISPONIBLE |
| e2e | **PASÓ con aviso según runner:** 177 aprobados, 1 flaky, 20 omitidos; 10.3min. Salida no-cero de Playwright aceptada por regla heredada, con cierre forzado de un worker |
| build | **PASÓ:** compile27.4s, TypeScript108s, 162 páginas en1.128s; tsconfig restaurado |

La prueba unitaria omitida pertenece al corpus real de proformas:
`DOCUMENT_IMPORT_CORPUS` no configurado y `corpus.test.ts:31` usa skipIf. No se
leyó ese corpus. La prueba auxiliar de scripts terminó dentro de su límite
600000ms; sus dos fuentes son idénticas a d410 y no se repararon por hipótesis.
Las duraciones individuales restantes son **NO DISPONIBLES**, no cero.

E2E omitió 18 casos por credenciales/seed y dos capturas limitadas a Chromium.
`auth.spec.ts:81` tuvo `page.goto: net::ERR_ABORTED` con el token ficticio:
primer intento23.0s, retry aprobado9.7s. Después Playwright informó
`worker-17 process did not exit within 300000ms after stop, force-killed it`
y un error fuera de tests. No venció el watchdog. La regla existente emitió
`[OK] e2e (con aviso)`; no se repitió la suite ni se alteró el absolver. La
atribución a WebKit en ese mensaje heredado no es diagnóstico causal propio.
El JSON original E2E es **NO DISPONIBLE**: no se preservó antes de build y
`verify.mjs:554–556,616` lo borra antes de cada intento de cada gate. No se
regeneró un reporte para presentarlo como original. Log y clasificación
emitida conservados. Nota independiente `0572-e2e-cierre-lectura.md`, SHA256
`406b5bc02e58b89cadc6bf6e994b26ee9f837deaea6749bf359d3fc84f9b27d1`.

Recibos externos: `revision-verify-4dbdb21b-{start,end,cleanup}.json`, log del
mismo prefijo, `revision-unit-summary.json` y `revision-validacion-4dbdb21b.md`
con la matriz completa. A23:38:13Z el árbol estaba limpio y no quedaban procesos
con identidades previas, consumidores explícitos ni listeners3569/13569/4802.

**Revisión independiente:** F1–F6 y delta visual 4dbd sin hallazgos nuevos,
aprobación local condicionada a la cobertura del gate. Informe
`0572-revision-independiente-3c36a7b2.md`, addendum4dbd, SHA256
`4fe01633c2cadda248a6fed4f7ed53a2895e53a55c23834aada59e2b8e50af58`.
La inspección no sustituye los tres controles omitidos ni la base futura.

**COMMITS:** `2df9d22d` integra d410 en la rama propia; `220a2c3e` conserva el
primer candidato y su revisión fallida; `3c36a7b2` repara F1–F6 con regresiones;
`4dbdb21b` corrige disposición/texto de dos TSX con evidencia visual. El commit
que contiene este documento registra el cierre sin alterar runtime/pruebas.
Todos los candidatos de producto están respaldados en la misma rama remota.

**PR / BRANCH:** [#310](https://github.com/SoftAgentes/DTDCARGO/pull/310), abierta
y en borrador contra main d410; rama y worktree propios de esta sección.
Se creó durante verify con la ejecución declarada EN CURSO, por autorización
expresa, y se adjuntó al chat. La descripción se actualiza con este cierre.

**PENDIENTES DE ESTA TAREA:** resolver cobertura SQL/rebuild en el entorno
coordinado, preservar el ledger como validación de release, revisar CI cuando
esté disponible y revalidar producto contra la base que incluya 0573 antes de
integrar. Quedan las capas de conocimiento indicadas abajo. No hay nueva
reparación financiera F1–F6 identificada por la revisión; la PR sigue en draft.
Actions está retenido por rechazo de pago/revisión
de 48 horas según Sam/Director: no se presume verde. Antes de integrar se exige
revalidación contra la base que incluya 0573. Orden Director: 301 → 304/306 →
307 → 0573 → sellos. GitHub redirige a `SoftAgentes/DTDCARGO` según comprobación
del Director; no se alteraron origin, workflows ni referencias de publicación.

**FUERA DE ALCANCE DETECTADO:** `CostingClient.tsx`, `OverviewView`, rama completa
con revenue=0/costo=0: los KPIs muestran 0, pero el texto histórico «Por cada
$100… quedan $100» usa `100 - costPct`. No es incompletitud cambiaria. El
Director ordenó conservarlo como hallazgo y no absorberlo. Continúan 2.3/G,
0572-b, KPIs globales, históricos y automatización BCV fuera del encargo.

**CONOCIMIENTO / HANDOFF AL DIRECTOR:** decisiones y evidencia guardadas en
spec/handoff propios; no integradas ni publicadas a la bóveda. Inspección actual
`corepack pnpm knowledge:status` sobre4dbd terminó exit0, **ok=false**, a23:41:07Z
(159.146s), después de verify y con autorización de solo lectura. Graphify0.9.61
estructural **INVALID** por graph.json ausente/vacío; piloto0/16 **PENDING**,
global0/1324 **INVALID**, 1308 fuentes pendientes fuera del piloto. Archify2.16.0
**NO DISPONIBLE** en este worktree: `ARCHIFY_RUNTIME_MISSING`; Obsidian **PENDING**.
Preview nueva **NO EJECUTADA**: faltan los prerrequisitos estructurales/semánticos
y Director difirió regeneración/publicación. No hubo bypass ni publicación.
Recibos `revision-knowledge-status{,-start,-end}` y `revision-heavy-turn-return.json`.
La sesión72759 cerró efectivamente; node18648/python7492/22288 ausentes. A23:41:30Z
knownRemaining=[], explicitConsumers=[] y árbol limpio; turno pesado
**DEVUELTO explícitamente** al Director antes del cierre documental.

Antecedente preservado: inspección
`knowledge:status --preview` terminada exit 0 pero **ok=false**: Graphify
0.9.61 estructural INVALID (grafo ausente), semántica 0/16 piloto y 0/1324
global; Archify PENDING por runtime ausente y Obsidian PENDING. Recibo
`retoma-knowledge-status-before.log`, sobre 2df9 más el diff previo al cierre.
La preview **NO COMPLETADA**: se lanzó por error al devolver session_id la
inspección anterior, solapando dos lecturas. Se detuvieron únicamente sus
PIDs verificados 22780/40020/13460; status se dejó terminar. No hubo extracción,
build ni publicación. Recibo `retoma-knowledge-preview-interruption.txt`.
Director indicó no reintentar ni reconstruir ahora; coordinar derivados tras
base 0573. Todos esos PIDs e inspección 40504/23600/32464 terminaron antes de
verify. No se certifica Graphify/Archify/preview ni revisión en Obsidian.
Claim conservado durante la escritura documental y publicación selectiva;
el protocolo lo libera después de confirmar push. El recibo externo de entrega
y el informe final al Director registran la liberación efectiva, sin crear un
commit recursivo solo para incluir su propio SHA. No se deja proceso pesado ni
servidor a otra sesión y no se elimina el worktree. El siguiente paso de producto
pertenece al Director: cobertura pendiente, base0573 y orden de integración;
este cierre no autoriza merge, deploy, DB ni lectura de datos reales.

## Cierre parcial anterior · antecedente fechado

| Campo | Valor |
|---|---|
| Fecha | 2026-10-20 |
| Task ID / owner | `0572-a-cierre-20261020` / `codex-0572-01a15a4e-ddf0`, subagente Worker del Director Codex |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0572-conversor-usd-reemplazos` |
| Rama | `codex/sdd-0572-conversor-usd-reemplazos`, apilada sobre la #301 (`3d0c9028`, mezclada en `9c864da5`) |
| SDD | [0572](../../docs/specs/0572-conversor-usd-reemplazos/spec.md), diseño aprobado por el Director el 2026-10-20 |
| Estado | 0572-a implementada (reglas A a F); cierre parcial, pendiente de corregir y recibir la dependencia #301. HEAD recibido `4f24a1db09704b1d34cd6073589c95dc84c22ccd`, ya publicado en la rama remota, árbol limpio al adoptar |
| Permisos | Adopción autorizada por Sam al pausar Claude y continuar en los mismos worktrees. Director concedió turno exclusivo para typecheck, eslint, `pnpm verify` y mutantes en serie, además de commits selectivos y push a esta misma rama. PR únicamente después de confirmación del Director de que #301 entró en main. **Sin merge, deploy, migraciones, datos de negocio ni 0572-b.** |

## Adopción del 2026-10-20

- Se adopta expresamente la metodología vigente AGENTS → Worker → runbook, preservando la implementación recibida y sus pruebas.
- Director liberó el claim previo `contabilidad-2026-10-18`; el nuevo Worker adquirió `codex-0572-01a15a4e-ddf0` y validó `guard --owner`.
- Rama y raíz verificadas antes de escribir. `node_modules` es un directorio local, sin junction; no se copiaron secretos.
- No había procesos pesados activos al iniciar. Las comprobaciones se ejecutan una tras otra con el turno asignado.
- Se conserva la decisión delegada del Director: las facturas locales sin tasa también bloquean la rendición porque restan de su saldo. El aviso debe explicar qué falta.
- Los resultados anteriores del Worker «Contabilidad» se preservan como evidencia histórica; las comprobaciones de este cierre se registran por separado.
- Director autorizó ampliar la allowlist únicamente con el índice generado `docs/specs/README.md` y los fixtures consumidores `TesoreriaClient.cxp-saldada.test.tsx` y `reports/__tests__/export-csv.test.ts`.
- Durante la revisión de #301, Director detectó una confusión entre `source=manual` de la tabla de tasas y el override manual del documento. Ordenó terminar reparaciones, typecheck, lint y pruebas focales, publicar este avance y liberar el turno. `verify` y mutantes todavía no habían comenzado: se difieren hasta recibir la dependencia corregida.

## OBJETIVO ORIGINAL

La 2.1 del plan contable, segunda parte: reemplazar las 13 implementaciones de conversión a USD y las tasas fijas del código por el conversor canónico de la 0569, fallando cerrado.

## COMPLETADO

- Reglas A a F, según la tabla *Implementación* de la spec.
- La regla G se difiere a la 2.3. El asiento de venta sigue al nominal (B2); convertir solo el subdiario de clientes abriría una diferencia falsa.
- Las pruebas que fijaban lo de antes se reescribieron. Hay pruebas nuevas para los asientos sin tasa, gastos y pagos, y la previa de la rendición.
- Cierre Codex: se restauraron las implementaciones de `formatDate`, `formatNumber` y `formatCurrency` que se habían eliminado accidentalmente junto al conversor duplicado. Frente a la base, `format.ts` solo elimina ese conversor.
- Se completaron fixtures con los nuevos contadores obligatorios, sin hacerlos opcionales ni debilitar aserciones.
- Se agregaron tres casos de mezcla de monedas/redondeo y dos de bloqueo por factura local sin tasa (servidor y drawer).
- Se retiró el import de tipo `ExpenseCurrency` que quedó sin uso después de eliminar el conversor de gastos.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Pruebas puntuales heredadas, un archivo a la vez (`node node_modules/vitest/vitest.mjs run <archivo>`) | PASÓ según el handoff recibido en 31 archivos (detalle abajo); no se repitieron todos en este cierre parcial |
| Pruebas focales Codex | PASÓ: 6 archivos, 71 pruebas; gastos/pagos 10, emit/void 10, costing/ui 17, EmitDrawer 3, TesoreriaClient 9 y export-csv 22 |
| `corepack pnpm typecheck` inicial | FALLÓ: tres formateadores eliminados y fixtures sin los nuevos contadores; defectos propios reparados |
| `corepack pnpm typecheck` después de la reparación | PASÓ: exit 0, después de restaurar formatos y completar los fixtures |
| eslint sobre los archivos TS/TSX del diff | PASÓ: 52 archivos, cero errores y una advertencia propia; se retiró el import de tipo sin uso y el lint puntual posterior PASÓ sin advertencias |
| `docs:check` | PASÓ: 557 specs, índice sincronizado |
| Allowlist / `git diff --check` | PASÓ: 55 rutas contra la base `3d0c9028`, todas autorizadas, sin errores de whitespace |
| `knowledge:status --preview` (entrada Node directa) | PASÓ la inspección, exit 0; Graphify 0.9.61 estructural INVALID por grafo ausente/vacío, semántica 0/16 piloto y 0/1323 global, Archify PENDING por runtime ausente y Obsidian PENDING. No equivale a publicación ni a cobertura aprobada |
| `pnpm verify` / build / E2E | NO EJECUTADO en este cierre por instrucción del Director: esperar la dependencia #301 corregida |
| Mutantes de app | NO EJECUTADO por la misma instrucción; pendientes los cinco `missing-fx-rate`, `emitRenditionFor` (cobros y factura local), CNY del validador y `resolveDisplayRate` |

Alcance de esta ronda: base `3d0c9028`, implementación recibida `4f24a1db` más el commit que contiene este documento. Las correcciones no cambian la procedencia de las tasas de #301. Logs locales, fuera de Git: `C:\tmp\director-traspaso-20261020\0572-codex-validation\`. No se usaron variables de Supabase ni `.env.local`, ni datos de negocio.

Recibos: `targeted-corrections.log` (71/71), `typecheck.log` (fallo inicial), `typecheck-corrected.log` (PASÓ), `eslint-diff-direct.log` (52 archivos), `eslint-final-import.log` (PASÓ), `knowledge-status.log` (capas pendientes). El primer intento de eslint con `corepack pnpm exec` no llegó a ejecutarlo: el wrapper `.cmd` de Windows no preservó las rutas con `(app)`; se usó la entrada Node directa. La única edición de fuente posterior al typecheck fue retirar un import de tipo sin uso; no cambió lógica ni contratos. Estas comprobaciones no tuvieron SKIPs; el gate canónico todavía no se ejecutó.

### Evidencia histórica del Worker anterior

Pruebas puntuales que pasaron:

- **Conversión y cobros:** `payment` 46, `treasury` 57, `partner-finance/types` 54, `alerts` 7, `fidelizacion/types` 38.
- **Costing:** `costing/queries` 18, `costing/ui` 17, `costing/types` 28.
- **Reportes:** `reports/types` 45, `reports/queries` 28.
- **Ingreso del período y libro de control:** `ingreso-periodo` 38, `libro-control` 42, `libro-control-queries` 34.
- **Dashboard y Dirección:** `dashboard-kpi-queries` 8, `direccion/queries` 39.
- **Pantallas:** `reportes-tab` 9, `estado-gerencial-mezclado` 2, `pantallas-muestran-la-denegacion` 9, `TesoreriaClient.cxp-saldada` 9.
- **Cobros sin identificar y cobranza:** `payment-receipts-0068` 31, `collections-identify` 22, `recordatorios` 19.
- **Exportación:** `operativo-csv` 15.
- **Rendiciones:** `renditions` 35, `emit-void` 9.
- **CxP y pagos a proveedores:** `cxp-congela-la-tasa` 4, `treasury-payments` 11.
- **Nuevas:** `asiento-sin-tasa` 5, `gastos-y-pagos-en-usd-0572` 7, `EmitDrawer.sin-tasa` 2.

## Impacto documental y conocimiento

- La spec 0572 trae la implementación, la allowlist y lo que queda abierto.
- No cambia reglas de AGENTS.
- El cambio de comportamiento visible para Sam está en *Qué cambia para Sam, pantalla por pantalla*.
- Índice regenerado con la spec en `in-progress`; 0572-b y G permanecen diferidas.
- Graphify 0.9.61 estructural: `knowledge:status --preview` informa INVALID porque no existe `graphify-out/graph.json` en este worktree. Actualización y recibo pendientes del cierre posterior a la corrección de #301.
- Semántica: ninguno de los documentos modificados pertenece al piloto canónico de 16 fuentes. La inspección informa 0/16 piloto y 0/1323 global (1307 pendientes fuera del piloto); no se afirma cobertura semántica nueva ni global.
- Archify 2.16.0: construcción y `knowledge:visual:check` NO EJECUTADOS en esta entrega parcial; no hay JSON/evidencia visual local generados.
- Obsidian: preview y revisión visible NO EJECUTADAS; publicación compartida NO EJECUTADA, reservada al Director desde main integrado comprobado.
- Revisión `/ui-check` de código: usa componentes y tokens existentes; los avisos y el bloqueo son explícitos. Observaciones advisory para la retoma: el nuevo aviso de Rendiciones usa cuerpo rojo (`EmitDrawer.tsx`, aviso `rendicion-sin-tasa`) y el aviso operativo de Reportes usa `padding: "7px 12px"` fuera de la escala de 4 px. Revisar texto neutro con estado localizado y tokens de espaciado. Revisión visual con navegador, contraste medido, móvil y zoom NO EJECUTADOS. La revisión visual no se infiere de las pruebas de componentes.

## PENDIENTES DE ESTA TAREA

1. Recibir la corrección de #301 y volver a comprobar el contrato de procedencia de las tasas. No abrir PR hasta confirmación del Director de su integración.
2. Ejecutar `pnpm verify`, sus comprobaciones aplicables y los mutantes con un nuevo turno de máquina; conservar los SKIPs explícitos.
3. Comprobar un hallazgo preliminar de esta revisión: `topAndWorst` de Costing todavía filtra solo `revenue > 0`. Una fila con revenue parcial y `facturasSinTasa > 0` podría aparecer entre los mejores/peores del Overview aunque el Ranking ya la rotule «Sin tasa». Hace falta fixture antes de certificar la regla A.
4. Completar revisión visual local con fixtures de Costing, Rendiciones, Reportes, Dirección y Financiero China.
5. Completar las capas locales de Graphify, Archify y preview de Obsidian con sus estados separados.

## FUERA DE ALCANCE DETECTADO (para el Director)

- **Cobro aplicado a una factura sin tasa:** hereda la tasa de la factura (RPC 0467). Sin tasa, queda sin asiento, en «Por contabilizar». La pantalla de «asentar pendientes» es de la 2.2.
- **«Gastos hoy» usa la hora del servidor** (`expense-queries.ts`, `setHours(0, 0, 0, 0)`), no la de Caracas. Va en la SDD de la hora de Caracas.
- **Las sumas multimoneda con «$» sin convertir** van en la SDD de KPIs multimoneda (decisión 5).
- **0572-b:** SQL de 0404 y 0411 diferido a otro encargo, con número del Director y autorización nominal de Sam. No es un cambio pendiente que este Worker deba implementar.

## COMMITS

- `4f24a1db09704b1d34cd6073589c95dc84c22ccd`: implementación recibida, ya publicada al adoptar.
- Commit que contiene este documento: reparaciones de formatos y fixtures, cinco pruebas adicionales y handoff de cierre parcial.

## PR / BRANCH

- Rama: `codex/sdd-0572-conversor-usd-reemplazos`, publicada a sí misma.
- No se abre PR en esta entrega: espera #301 corregida e integrada por el Director.
- Worktree conservado; no merge, deploy ni migraciones.

## HANDOFF AL DIRECTOR

- Retomar después de la corrección de #301 con el SHA de esta entrega y un nuevo turno exclusivo de verificación.
- La publicación del avance no certifica aceptación completa ni preparación para merge.
- El protocolo de esta entrega termina con la liberación de `codex-0572-01a15a4e-ddf0` después de confirmar el push; el informe al Director conserva el recibo efectivo. No se deja ningún proceso de verificación a cargo de otra sesión ni se elimina el worktree.
