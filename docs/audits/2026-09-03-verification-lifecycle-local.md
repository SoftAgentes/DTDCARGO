---
title: Integridad y lifecycle de la verificacion local
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-03
updated: 2026-09-03
review-by: 2026-09-10
confidencialidad: interno
---

# SDD0378 · evidencia en curso

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
gracefullyClose espera ese evento. Sonda efímera observacional preparada,
sin patch de node_modules ni cambio del comportamiento, para medirlo.

La corrida mide Next real y los tres proyectos existentes; los Tier3 sin
entorno autorizado conservan su omisión. El browser focal de Portal es otra
medición sintética, no evidencia de integración Portal→Cloud.

## Pendientes

- Localizar el cierre E2E con evidencia real y corregir sólo su causa.
- Terminar diagnóstico E2E y gate completo; suite unitaria conjunta aprobada.
- Actualizar checkpoint sin inflar el56/106 original.
- Después: fflate/replay; RBAC/Portal restante, specs, logs, CSP y web.
