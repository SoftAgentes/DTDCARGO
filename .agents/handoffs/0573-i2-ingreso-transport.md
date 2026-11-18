# SDD-0573 · fresh I2: transporte del ingreso

## Autoridad y alcance

Tarea nueva y autosuficiente del mismo CORE, owner
worker-0573core-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
Autoridades: sección B de
DIRECTOR-TWO-BOUNDED-FOLLOWUPS-PARITY0571-AND-FRESH-I2-20261025 y addendum
DIRECTOR-FRESH-I2-EXPLICIT-BASE-34E-20261026. La sección A/Paridad es historia,
sin asignación nueva. Las posteriores excepciones concretas de recepción y
construcción administrativa se conservan separadas de la autoría.

Base inmutable: 34e5911c77bdc80956051984515df027b669fe5e,
tree 9abf5db692519478b78b3da857f31eb6a88a2455,
padre a1a8e966cb4f00de52b14ffe2d3e45a5c455e84d.
Rama: codex/sdd-0573-i2-transporte-20261025.
WT real: C:/Users/AKX generator/.codex/worktrees/sdd-0573-i2-transporte-20261025/DTDCARGO.
El commit que contiene este documento debe ser hija directa de34e y fijar
exactamente una modificación del módulo y las dos altas de esta allowlist:

- lib/studio/accounting/libro-control-queries.ts
- lib/studio/accounting/__tests__/libro-control-ingreso-transport.test.ts
- .agents/handoffs/0573-i2-ingreso-transport.md

Se reutilizan SDD0573 y la regla oficial de ingreso0557. No se modifican sus
specs, API pública, monedas, SQL, paginador compartido, otros módulos ni fuentes
de Reportes. No se incorpora la rama hermana15d.

## Problema y cambio

fetchAllPaged tolera data:null como array vacío. Dentro del lector I2, eso podía
acreditar un contexto completo aun cuando no se hubiera recibido una página
legible. El API público ingresoDelPeriodo ya propaga el error de este contexto;
se conserva esa conducta y no se introduce un DTO parcial alternativo.

paginaI2, local a contextoDelIngreso, valida la página de candidatos y las seis
lecturas por ID: asientos por documento, originales por vínculo, reversos por
vínculo, metadata documental, líneas y cuentas/ascendencia. Requiere envelope
con data/error, error:null para datos, array y filas objeto con identidad
string no vacía y valores escalares de las columnas seleccionadas. Rechaza
contenedores no array, filas null/escalares/arrays, identidad ausente y campos
compuestos ilegibles. [] sigue siendo un resultado vacío válido.

Un error nativo objeto se propaga intacto antes de llegar al paginador, incluidos
identidad, código y causa. Un error de transporte malformado recibe diagnóstico
con el nombre de la lectura. No hay retry, catch que fabrique éxito, cambio de
filtros/orden/rangos/IDs, ni conversión del mayor a USD.

Esta validación distingue transporte y dominio: una fila legible puede tener
metadata faltante o null. Esa evidencia sigue pasando al puente puro, que
conserva subtotal conocido, incidencias y diferencia desconocida; no se filtra
para fabricar ausencia. La prueba incluye metadata documental no disponible y
tenant documental null como casos distintos de una página ilegible.

## Fuentes y preservación

Preimagen del módulo: 23312 bytes,
blob02d2cc028acc1605c266939f1bfccd53f0f34b3c.
Lectura propia completa nueva: Native808355/0. Dependencias pertinentes leídas
completas desdeGit34e: ingreso-periodo.ts, Native6d8835/0,31342bytes,
SHA256 3c6802f78d1da55a6db9365261f8fc651e783980e14477e98a81ea2e1ef104c2;
lib/db/paginate.ts, Native12c2b1/0,5525bytes,
SHA256 405985db99231eae153a70a0f50d88622c40cc5c4e882b175349b15168d15d49.
Ninguna de estas dependencias se modifica.

Prueba administrativa94eb51/0: tres hunks literales del patch, forward completo
contra la preimagen y operación inversa completa; prefijo/sufijo fuera de
contextoDelIngreso BYTEWHOLE idénticos. Módulo nuevo24898bytes,
SHA256 e756eaf725786d0bf39bfc2fe17df3e2643d74534e98f72b26f43c42ad94abb6.
diff --check conforme. Es evidencia de edición/preservación, no compilación.

El test grande retenido no fue leído, importado ni copiado. Su identidad en la
baseACK es blob a28ea0a200120193e0b3cd1916c2ca86cef97a77, con los dos puentes
de tipos legítimos ya existentes. Se conserva exactamente ese blob; no se
reinstaura la preimagen383af. No se accede a ingreso-fixture, semillas ajenas,
omitidos, Source03–06, RAW/custodia ni llamadas detenidas.

## Test nuevo, datos y expectativas independientes

El test es autocontenido, con UUIDs sintéticos del prefijo f1c71000, tenant
ficticio y período fijo2026-04. No hay reloj, fixtures externos, API/DB real ni
mocks del paginador. El único cliente parcial está rotulado FICTICIO y su cast
está en esa frontera; no cambia contratos productivos.

El doble reconoce tabla/select y los filtros, aplica is/in/gte/lte, ordena por
id, proyecta columnas y usa el rango solicitado. Exige el tamaño1000 real y
rechaza consultas inesperadas. Separa oficial, candidatos y las seis rutas por
ID. No enruta por nombre de test, ni devuelve [] como fallback genérico. Las
respuestas defectuosas se inyectan explícitamente por rol de consulta/rango.
Las definiciones y todos los casos están materializados antes de registrar
los callbacks que invocan el API.

Hay75 casos declarados, todos pendientes de ejecución local:

- 6 positivos/de dominio: vacío acreditado; oficial175 sin posting; parUSD;
  metadata no disponible; tenant documental null; nominalVES/CNY.
- 56 negativos: las siete lecturasI2 por ocho cuerpos/filas ilegibles
  (null,undefined,objeto,fila null,escalar,array,sin identidad,campo compuesto).
- 7 errores nativos, uno por lectura, conservando identidad/código/causa.
- 4 envelopes inválidos o sin error:null.
- 2 páginas posteriores ilegibles tras1000 filas legibles: candidatos y
  asientos por documento. Se exige observar ambos rangos0..999 y1000..1999.

Oráculos fijos: el oficialUSD175 y una factura se conservan. El par de anulación
USD120 tiene dos contribuciones y ajuste neto0; el control del mayor neto0
con actividad da base175/diferencia175. Los50 manuales quedan como otros
ingresos y fuera del puente. Hay cuenta hoja y ascendencia leída por ID.

La falta de metadata o tenant documental conserva175/una factura, requiere
revisión, unidad sin verificar, causa identificable y diferencia null.
No se cambia esa expectativa a cero o USD para lograr pase.

Tres documentos nominales nuevos: VES300/tasa3, CNY200 sin conversión y
VES250/tasa5. Oficial150, dos facturas convertibles, una sin convertir,
tres documentos con movimiento nominal, mayor750, nominal_mixto,
No comparable y diferenciaUSDnull. Esta ficción no convierte el posting real
a USD ni adopta conversion_incompleta de otra rama.

## Focal local: NO DISPONIBLE / NO EJECUTADA

El guard propio5cea4b/0 observó node_modules=false y
node_modules/vitest/vitest.mjs=false en este WT nuevo. No se instaló, copió,
enlazó ni tomó un runner de otro WT. Cero invocacionesNode y cero pruebas
ejecutadas. No se afirma TypeScript, ESLint, unitarios ni75PASS.
Versión de Node/Vitest de esta tarea: no observada.

Input íntegro preparado para la única focal condicional, NO INVOCADO:

{
  "cmd": "& 'C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' node_modules/vitest/vitest.mjs run lib/studio/accounting/__tests__/libro-control-ingreso-transport.test.ts --maxWorkers=1 --no-file-parallelism --reporter=verbose",
  "shell": "C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe",
  "login": false,
  "tty": false,
  "workdir": "C:/Users/AKX generator/.codex/worktrees/sdd-0573-i2-transporte-20261025/DTDCARGO",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}

Registro propio: 0573-i2-fresh:single-focal.
invoked=false; beforeUtc=null; afterUtc=null; result=null; error=null;
exit=null; session=null; chunk=null; nodeInvocations=0.
No hay retorno de ejecución que reconstruir o heredar. Las75 expectativas
tienen estado NO EJECUTADO, no FALLÓ ni PASÓ por lectura estática.

## Aislamiento e incidentes administrativos conservados

La creación managed se invocó una vez. Operación
144b6f09-3e51-4042-898b-6ebf19f25688 inicialmente pending. La recepción de
su primera consulta quedó truncada, sin ruta/exit/sesión acreditados. No se
recargó ni reemitió esa captura.

Con autorización humana nueva literal se consultó UNA vez esa misma operación.
Registro0573-i2-fresh:managed-status-human-r1, before02:39:13.855Z y
after02:39:14.577Z del2026-10-26: revision80/completed/isErrorfalse, ambas raíces
reales coincidentes con este WT. Se guardó el retorno completo antes de
interpretar; las selecciones posteriores usaron ese mismo retorno, sin poll
adicional. La recepción vieja permanece parcial.

El guard que se intentó construir después tuvo SyntaxError:
Unexpected identifier 'n', exteriorJavaScript. No evaluó su cuerpo, no guardó
captura prospectiva ni invocó Native. Su input no se reconstruyó o reemitió.
La key nominal de aquella construcción no se presenta como captura existente.
No fue un falloGit, de suite o de política.

La disposición concretaDIRECTOR-FRESH-I2-SETUP-GUARD-CONSTRUCTION-DISPOSITION-20261026
admitió una construcción nueva desde cero, sin recuperar la anterior.
Guard nuevo5cea4b/0,2026-10-26T02:49:07.2201279Z: sieteGit individuales0,
base/tree/padre exactos, detached inicial limpio, rama nueva ausente,
claim ausente y dos destinos nuevos ausentes. Después8ef6de/0 creó la rama
exacta y reclamó sólo el claim nuevo propio202bytes, SHA256
eb6fd6557925cb8910e1ecae74b5a337740606052e0b7806611f3c2c29463c51,
Git worktrees/DTDCARGO13/harness-session-claim.json, owner/ruta exactos.
No se libera ni altera B4 u otro claim anterior.

## Gobernanza y cierre

Cumplimiento estático: AGENT-BRIEF/registro vigentes; SGE-00 mantiene límites,
evidencia incompleta y lenguaje honesto; ERR-01 conserva errores y causa.
La cifra oficial y nominal_mixto permanecen; no se añade efecto ni necesidad
de auditoría de escrituraAUD-01 porque este lector sólo consulta.
UI/móvil/accesibilidad: no aplica al delta sin componentes ni interacción.
No aplica migración/aplicaciónDB, capacidades, nueva librería o endpoint.
No hay excepción que permita SQLreal, APIreal, secretos o datos de negocio.

El índice final debe contener exclusivamente1M+2A de la allowlist. El recibo
terminal externo fija el SHA/tree/padre reales, conservación del resto del
árbol y liberación exacta del claim nuevo con pin/owner/ruta antes deFIN.
Este documento no afirma un cierreNative futuro. Worker no publica.

Pendiente de esta tarea: revisión fijaParent de las tres unidades completas,
CI nueva porGeneral, incluida la focal y la composición posterior pertinente.
El CIa1a anterior pasóTypeScript y falló en dos casosReportes de una rama
hermana: se conserva ese hecho, sin repetirCI ni incorporar su arreglo.

FUERA DE ALCANCE DETECTADO: I2antiguo/113b22 permanecePARCIAL; Reportes15d y
sus límites841 no se rescatan; #318 queda sin autoría y con sus gates propios;
CORE06 no apto, fechas transcurridas sinEJE06, sin inferir consumo de claves.
Auth4/origen/budgetNULL, reserva false y QPG17/B NO EJECUTADOS se conservan.
No cierre2.1, concurrenciaPG17, aceptación financiera, merge, producción,
conocimiento/gestores ni publicaciónGraphify/Archify/Obsidian.
AutomatizaciónPAUSADA. TrasFIN no se adelanta otra fase.
