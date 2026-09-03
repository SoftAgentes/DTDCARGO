---
title: Integridad y lifecycle de la verificacion local
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-03
updated: 2026-09-03
review-by: 2026-09-10
confidencialidad: interno
---

# SDD0378 · cierre E2E medido y estabilidad unitaria

## Estado y alcance

Sólo local. No gates Cloud, push, main, despliegue ni datos reales.
No limpiar worktrees reales ni matar procesos ajenos. El objetivo guardado
no se modifica. Portal queda conservado en6ae46e81 y946c4976.

## Falso verde E2E demostrado

La decisión anterior sólo miraba expected>0/unexpected0; ocultaba errors
globales y atribuía WebKit sin demostrarlo. Además, la detección de navegador
ausente usaba some por test: un fallo de lanzamiento ocultaba un afterAll
real del mismo test. El JSON se borraba al comenzar cada gate, incluso build.

RED independiente con funciones/bucle reales en VM y transporte sintético:
cuatro expectativas fallaban; controles sin pérdida de cobertura aprobaban.
Luego regresión persistida:65/84fallaban en el clasificador legado, exit1;
la importación era real mediante adaptador temporal, no un missing import.
Contraste posterior del bucle HEAD:5expectativas causales fallaban; un error
global salía0/TODO VERDE, navegador ausente también, build borraba JSON y
fallar al retirar un JSON viejo no impedía iniciar Playwright.

Nuevo contrato:

- Valida exitstatus, errors globales, contadores enteros no negativos,
  estructura y resultados de cada hoja, incluido outcome de todos los retries.
- Error global, señal, wrapper fallido, JSON ausente/incoherente o error
  real nunca es pass/skip. Cero pruebas aprobadas tampoco.
- Navegador exclusivamente ausente produce SKIP parcial, no paso medido verde.
  Todos los errores/resultados fallidos deben corresponder a launch ausente.
- Conserva los retries de Playwright por prueba; elimina sólo el reintento
  automático de toda la suite. No altera480s/8workers.
- JSON fresco sólo antes del paso E2E y preservado después, incluso build rojo.
  Fallo al retirar evidencia vieja aborta antes del spawn.
- Exit3 sólo significa SKIP en los pasos con ese contrato. E2E lo clasifica
  como fallo; no hereda la excepción de Docker/Deno.

Revisión agregó3RED por outcomes inconsistentes entre retries y1RED por
bypass de exit3 en el bucle, corregidos. Resultado final105/105:
89clasificador+16integración del bucle. Los12controles históricos de puertos
y no absolución también pasaron; lint focal y diff-check correctos.

Límite: VM instrumenta FS/spawn, no acredita cierre real de navegador.
No se falsea la evidencia del E2E anterior150/18 con2errores globales.

## CLI de worktrees: contención y planificación

Gate previo: primer intento6956/6957por RED de Cancelar añadido en curso;
corregido. Segundo6954/6957: tres Synthetic CLI ETIMEDOUT10s. Portal pasa.
Después, mismo archivo/mismos límites:52/52 aislados,170,02s, exit0.
No hubo assertions de seguridad fallidas fuera de esos timeouts.

Vitest4.1.7 ahora declara dos proyectos heredados: unit conserva todos sus
casos excepto ese archivo, que worktree-cli ejecuta al terminar unit.
sequence.groupOrder0/1 y fileParallelism:false sólo para CLI. No se
incrementa20s de test/hook ni10s del subprocesso; no se cambia maxWorkers
del resto. Contrato de configuración RED3/4→GREEN4/4.

Fuentes verificadas para la versión instalada:
[proyectos Vitest4](https://v4.vitest.dev/guide/projects) y
[orden entre proyectos](https://v4.vitest.dev/config/sequence).
Es mitigación de contención demostrada por contraste, no SLA bajo cualquier
carga del host. Resultado conjunto con la planificación nueva:7066/7066
en550archivos,390,65s, exit0. Sin reintento manual ni cambio de plazos.

## Corrida real E2E

Primera corrida: outputs/e2e-lifecycle-2026-09-03T2207/.
DEBUG=pw:browser,pw:webserver; JSON y lifecycle.log preservados.
Puerto3601 verificado libre; deny-only13601; sin .env real ni claves
de servicios en entorno. Test global480000ms/8workers/localretry1.
No upgrade, no retiro de Safari, no cambio de timeout.

Resultado real:150aprobadas/18omitidas,0fallos de caso,2errores globales,
480032ms, exit1. El nuevo clasificador la rechaza correctamente; no WebKit
absuelto ni JSON borrado. tsconfig restaurado por el wrapper.

DEBUG localiza dos cierres WebKit que no terminan (padres54128/57128).
Sus intentos taskkill no encuentran los padres. CIM/tasklist aún muestran
NetworkProcess114444/137164 con esos padres y creación22:10:56/58UTC;
Get-Process y taskkill no encuentran instancia activa. Se intentó retirar
sólo esos dos con guards PID/padre/exe/UTC, sin éxito; no se confirmó
terminación. La primera comprobación UTC abortó por conversión local y se
corrigió con DateTimeOffset explícito antes de intentar la operación.
No se tocaron los NetworkProcess antiguos ajenos.

No basta ese inventario para decir que están vivos: se debe distinguir
exit del proceso y close de sus pipes. El código instalado de Playwright1.60
lib/coreBundle.js:8650 registra "process did exit" en el evento close y su
gracefullyClose espera ese evento. Sonda efímera preparada para medir exit,
close y cada canal propio; no se modificó node_modules.

La corrida mide Next real y los tres proyectos existentes; los Tier3 sin
entorno autorizado conservan su omisión. El browser focal de Portal es otra
medición sintética, no evidencia de integración Portal→Cloud.

## Pendientes

- Cierre local medido; publicación del tooling aún no autorizada.
- Gates externos y cobertura autenticada permanecen separados.
- Continuar Portal/RBAC por entidades, luego specs, logs, CSP y web.

## Reproducción causal y corrección posterior

Safari solo, mismos8workers/480s,231297ms, exit1:
44pass/5flaky/6skip/1fail, errors globales vacío. No fue una aprobación.
Artefactos safari-events.jsonl, safari-trace-report.json y
safari-trace-measured.log en el directorio anterior.

| Proceso propio | Evidencia |
|---|---|
| 139960 | exit0 a22:27:13UTC; 15s después cuatro canales seguían abiertos; liberación propia y close inmediato |
| 62360 | exit0 a22:27:38UTC; misma retención15s; liberación propia→close en5ms |

La sonda registró RED antes de intervenir y sólo tras exit0/sin señal.
No mató PID ni modificó exit codes. Los minirrepros independientes simples
(incluyendo HTTP/SSE/WebSocket) cerraron normalmente y no reprodujeron el
problema; no se presentan como evidencia causal.

Esto coincide con el contrato documentado de Node: exit y cierre de stdio
son eventos distintos ([Node24.15 ChildProcess](https://nodejs.org/download/release/v24.15.0/docs/api/child_process.html#event-close)).
No se atribuye el origen del handle retenido a un tercero no demostrado.

Corrección persistida: scripts/e2e/webkit-exit.mjs, precargado por --import
en el CLI Windows y heredado por sus forks. No NODE_OPTIONS ni precarga en
Next. Matching exacto de ejecutable instalado, --inspector-pipe, stdio y
ausencia de shell. Sólo tras exit0/sin señal drena15s y libera streams
propios aún abiertos. No cambia plazos, navegadores, assertions ni resultados.

RED contrato inicial por módulo ausente (no causal), luego dos RED focales:
aviso sin canales pendientes y URL transformada por jsdom. Corregidos.
Final51/51:48guard+3wrapper; lint del helper/wrapper aprobado. Conversión
a ESM evitó modificar ESLint global por un primer archivoCommonJS.
La causalidad física proviene del JSONL real, no de mocks de ChildProcess.

Revisión de fallos de navegación: primer intento auth interrumpido aunque
snapshot contiene el encabezado correcto; retry espera load60s y recibe
HTML200 en2,09s pero no llega a aserciones. Dos fullreload de Next dev y un
fatal tryAllocPixels de WebKit se observan en el log. No prueban un bug del
token ni una causa única: no se cambió app/acceso ni se debilitó goto.
errors globales vacío tampoco certifica consola limpia; existen errores
del overlay Next en un retry aprobado.

### Guard persistido y límite de recursos

Corrida general guard-full-report.json:146pass/3flaky/18skip/1fail,
316541ms, exit1, errors globales vacío. El guard liberó los canales propios
del75724 a15s y permitió terminar. El clasificador correctamente siguió rojo.
Nuevo fallo real: WebKit48048 no puede arrancar; taskkill del proveedor
informa «No hay suficientes recursos de memoria», exit3221225501.
Retry no crea página en60s. No se absuelve como teardown ni bug de producto.

Se limita sólo mobile-safari a1worker en Windows, con8como tope global
conservado; plataformas restantes/Chrome siguen iguales. Configuración
RED1/12→GREEN12/12; junto con guard/wrapper63/63. No cambia ninguna aserción
ni timeout. API por proyecto confirmada en los tipos instalados1.60.

Contraste Safari completo con traza desde primer intento:
guard-serial-safari-report.json:50pass/0flaky/6skip/0fail,
284407ms, exit0, errors globales vacío. El91820 también necesitó liberar
canales después de exit0; guard funcionó sin timeout global. Next y deny-only
se cerraron, tsconfig fue restaurado. Casos previamente fallidos pasan.
Esto verifica Safari local y sus negativos, no los Tier3 ni un smoke Cloud.
La medición conjunta posterior con los tres proyectos se detalla abajo.

## Gate conjunto final del guard y fflate

Log: outputs/e2e-lifecycle-2026-09-03T2207/gate-final.log.
Terminó exit 0: 16/17 pasos medidos; sólo migrations-applied fue SKIP.
No es un gate alojado ni un cierre sin reservas.

- Lint, tipos, frontera RSC, cuatro Edge, documentación, numeración,
  constantes, componentes y 28 políticas de gobernanza aprobados.
- Unitarios, intento 1: 7.125/7.126, 551/552 archivos, 529,04 s.
  Un timeout de 20 s durante importación en attachments/service.test.ts.
  Intento 2 automático existente: 7.126/7.126, 552 archivos, 315,04 s.
  No se oculta el intento fallido ni se atribuye a un codec de replay.
- 169 contratos SQL; reserva atómica y ocho carreras Portal aprobadas.
- Rebuild: 424 archivos, 406 migraciones ejecutables y 18 sólo-ledger;
  comprobación de aislamiento sobre 219 tablas y dos tenants sintéticos.
- E2E real: inicio 2026-09-03T23:10:00.783Z, duración 211.048 ms,
  150 aprobados/18 omitidos/0 flaky/0 inesperados, errors globales vacío.
  Reporte: C:/Users/Trabajo/AppData/Local/Temp/dtd-e2e-29256.json.
  El clasificador persistido devuelve pass, indicando las 18 omisiones.
  Next y deny-only cerraron; tsconfig restaurado. No hubo timeout global.
- Build de producción correcto: 158 páginas; tsconfig restaurado.

### Concurrencia unitaria posterior

Lectura del runner instalado Vitest 4.1.7: resolveMaxWorkers usa CPU-1 en
run cuando no hay límite. Este equipo expone 32 procesadores lógicos y
15,7 GiB de RAM; durante la corrida se midieron sólo 1,14 GiB libres.
El tiempo agregado de transformación/importación/entorno fue mucho mayor
en el primer intento. Es evidencia de contención, no un diagnóstico del SO.

El caso de adjuntos intacto pasó solo: 56 ms de test, 25,27 s totales
(21,29 s de preparación jsdom). Contrato RED de configuración: 1/5 falló
por maxWorkers indefinido. Tras limitar Windows a 4: contrato y caso
original 6/6 correctos, 1,52 s totales. Ningún plazo ni prueba se amplió
o retiró. Plataformas no Windows mantienen su configuración original.
Primer contraste a cuatro trabajadores: 7.126 aprobados y un fallo,
447,24 s. No hubo timeout: el fallo fue documental porque se creó la spec0380
con una referencia a0428 antes de que existiera ese archivo, durante la corrida.
Fue un error de secuenciación del agente, no un resultado verde ni un defecto
de concurrencia. Se completaron ambos archivos y se congeló el árbol.

Medición final directa, sin reintento del wrapper:
7.149/7.149 pruebas en553archivos, 421,24 s, exit0; inicio19:25:56 Caracas.
Log: outputs/e2e-lifecycle-2026-09-03T2207/quotes-unit-final.log.
Incluye22casos nuevos de cotizaciones0380 y el control de configuración.
No se repite una corrida limpia sin cambio que lo justifique.

El alcance local0378 queda cerrado con esa evidencia. E2E150/18 y build158
corresponden al gate anterior al delta0380; no se presentan como E2E autenticado
de cotizaciones ni como cobertura de las18pruebas omitidas.
