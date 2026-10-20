# Handoff · SDD-0570 — pruebas PGlite sin initdb por caso

## Retoma vigente y adopción · 2026-10-20

| Campo | Valor |
|---|---|
| Task ID | 2026-10-20-sdd-0570-pglite-plantilla |
| Worker de medición | Codex / codex-0570-ab-reintento-01a15a4e |
| Worker documental | Codex / codex-0570-ab-docs-01a15a4e |
| Worktree | DTD-worktrees/pglite-snapshot-esquema |
| Rama | codex/pglite-snapshot-esquema |
| Cabeza recibida y medida | 1077ff216956d2062f3ce281971f68d084fe0a92 |
| Base histórica | origin/main d50aa3e7; la rama conserva las integraciones posteriores ya recibidas |
| SDD | [0570](../../docs/specs/0570-pglite-plantilla-por-archivo/spec.md), in-progress; criterio 5 completo y aceptado |
| Estado | Medición A/B completa aceptada por el Director; cierre documental para revisión final de la PR |
| PR | [#304](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/304), draft contra main al retomar |
| Permisos de este cierre | Solo spec, handoff y resúmenes TXT/JSON; commit selectivo, push a la misma rama y actualización del cuerpo de #304. Sin merge ni producción |

El Worker adoptó explícitamente AGENTS, skill Worker y runbook Director/Worker, conservando
rama, worktree y trabajo preexistente. Sam había pausado la sesión Claude y autorizado la
adopción. Antes de medir se verificaron raíz/rama/HEAD, árbol limpio, ausencia de claim y
consumidores visibles; se adquirió el claim y pasó el guard. La observación de procesos se
limita a PIDs, árbol de padres y líneas de comando visibles, no demuestra el cwd oculto de
cualquier sesión.

0571 devolvió su turno y confirmó su fixture detenida/cero procesos propios. El Director
asignó el turno exclusivo A/B304 con un límite de 45 minutos POR FASE, dos workers y semilla
570. Al cerrar el par se verificaron 36 hashes restaurados, árbol limpio y cero procesos
propios; se liberó el claim y se devolvió explícitamente el turno a las 19:54:13.609Z.
El turno pesado pasó a 0569. Este cierre documental tomó un claim nuevo y no ejecuta otra
corrida pesada.

## OBJETIVO ORIGINAL

Bajar el costo de los contratos PGlite sin debilitar aserciones, controles rojos, mutantes ni
SQL; documentar la decisión y medir antes/después por archivo en local y CI. El encargo
actual completa el criterio 5 pendiente y conserva evidencia revisable, sin producto nuevo.

Sam: «Haz esta tarea aquí: “Pruebas PGlite: snapshot del esquema base por worker”».
El hallazgo fue que el costo dominante estaba en initdb por caso, no en las migraciones.
Las medianas históricas de cinco arranques locales fueron 1.321 ms con pgcrypto, 1.186 ms
sin extensiones y 322 ms al cargar el dump post-initdb. La decisión final conserva una
plantilla por archivo y juego de extensiones; cada caso recibe una instancia nueva.

## COMPLETADO

- Helper pgliteLimpio: plantilla del cluster recién inicializado, aislada por archivo, sin
  persistencia entre corridas y con expulsión del caché si falla. Ocho pruebas actuales
  verifican huella, aislamiento, extensiones, reutilización y ausencia de almacenamiento
  persistente. No se modificó el helper en esta retoma.
- Adopción existente: 36 sitios en 27 archivos, solo imports/constructor. Son 26 pruebas y
  r3-correlation-contract.ts, consumido por siete archivos adicionales: 33 afectados.
  Los seis beforeAll de una instancia por archivo y el único constructor sin extensiones
  de pin-operarios-endurecer permanecen como estaban.
- Segundo par local A → B sobre 1077ff21: **34 archivos / 854 casos por lado, todos
  aprobados; cero fallidos u omitidos; firmas completas iguales en 34/34 archivos**.
- A revirtió temporalmente imports/constructores del commit 4b05a262; B usó los bytes
  originales. Se comprobaron cuerpos normalizados iguales, aserciones/SQL intactos y
  36 respaldos de bytes. Se restauraron/verificaron los originales después de A y al salir.
- Director revisó comparación, manifiesto, reportes y límites y **aceptó el criterio 5**.
  Se registran sumas por archivo y tiempo de pared por separado.
- Solo cuatro rutas cambian en este cierre: esta spec, este handoff y los assets
  comparacion-local.txt / comparacion-local.json. El intento parcial anterior queda
  íntegro como sección/objeto histórico, con hashes de sus assets originales.
- El cuerpo de la PR se actualiza para corregir los seis casos históricos del helper
  frente a ocho actuales, la rama ya integrada con #302 y el estado vigente de medición/CI.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Identidad, guard y claim de la medición | PASÓ: 1077ff21, árbol inicialmente limpio, owner propio |
| Sintaxis del arnés y comparador temporales | PASÓ mediante node --check antes de ejecutar |
| A: instancia PGlite nueva | PASÓ: 34/34 archivos, 854/854 casos, exit 0, 641,565 s de pared |
| B: plantilla | PASÓ: 34/34 archivos, 854/854 casos, exit 0, 361,750 s de pared |
| Firmas de casos entre A/B | PASÓ: 34/34; ancestros, título, nombre y estado iguales |
| Conteos por archivo | PASÓ: 33 afectados / 846 casos más helper / 8 casos, iguales a la selección revisada |
| Fuentes y restauración | PASÓ: cuerpos normalizados iguales en 27 archivos / 36 constructores; 36/36 SHA-256 después de A y al terminar |
| Verificación independiente al cerrar | PASÓ: 36 fuentes, seis configuraciones/lockfile y tres entradas de runtime iguales; árbol limpio |
| Procesos y turno de medición | PASÓ: cero PIDs propios/descendientes y cero consumidores visibles; claim liberado y turno devuelto |
| Watchdog | 45 minutos por fase, fijados antes de arrancar; no se activó, sin reintentos |
| Suma de los 33 archivos afectados | 1.212,711 → 630,722 s; reducción 47,99 % en este par |
| Tiempo de pared | 641,565 → 361,750 s; reducción 43,61 % en este par |
| Helper intacto | 8/8 en ambos; 16,675 → 20,909 s, más lento y excluido del agregado de afectados |
| Huella histórica fresco/cargado | PASÓ: 11/11 medidas iguales, con y sin pgcrypto, incluidos txid y OID siguiente |
| Mutantes históricos del helper | PASÓ: seis mueren; equivalente txid_current sin checkpoint documentado, no llega al dump |
| CI histórico antes/después | PASÓ: runs 39429472606 y 39436611054, Linux y un worker; detalle en spec y comparacion-ci.txt |
| Criterios 6 y 7 | PASÓ histórico: mismos conteos en 33 afectados; 40 controles rojos y 375 mutantes detectados con plantilla |
| CI sobre la cabeza medida 1077ff21 | PASÓ: Calidad local sin secretos, run 39476193413 / job 118812654825, 18:36:19Z–19:01:29Z |
| Documentación, numbering y diff del cierre | PASÓ: entradas Node directas; índice sincronizado con 556 specs, 488 migraciones y 11 excepciones históricas registradas; diff sin errores, enlaces relativos válidos, solo cuatro documentos/assets |
| Suite completa, typecheck/build y nuevo ciclo separado de mutantes | NO EJECUTADO en este cierre documental; no cambió producto ni se amplió el par autorizado |
| Check del commit documental posterior | Estado propio que se consultará tras push; no hereda el verde de 1077ff21 |

El JSON conserva el vector exacto de argumentos, versiones, hashes, condiciones y resultados
por archivo. Los resúmenes son sanitizados; los logs/JSON crudos y el arnés no se suben.
La evidencia externa se identifica por el archivo de corrida 20261020T193515078Z. El hash de
la comparación cruda JSON aceptada es
c96139535505af4f6d6373c2909e21fcaea0313933636e0160c29eb17cca2f69;
el TXT, a87741d0a68e8d0fa3972a8540f54045061e850b3b98c2316ccecc016bbabb1a.

**Límites:** un único par A → B, sin AB/BA repetido ni intervalo de confianza. Cachés del
sistema, carga incidental, temperatura y antivirus no se eliminan; el helper intacto más
lento lo hace visible. Misma semilla con dos workers no garantiza el mismo orden temporal.
No se generalizan porcentajes a CI/otras máquinas ni se mezclan las condiciones del A/B
histórico CI de un worker con este local de dos.

## Histórico: primer intento parcial

Sobre 59e8491b, el owner codex-0570-ab-01a15a4e recibió turno de 0569. A se cortó por el
watchdog cargado de 20 minutos a 1.200,846 s: 26/34 archivos y 649 casos reportados verdes;
B NO EJECUTADO. Los ocho archivos sin resultado completo no se contaron aprobados ni
fallidos; no hubo reporte JSON final ni comparación válida. Restauración 36/36 y turno
devuelto, sin reinicio automático.

El primer preflight no contempló el import relativo del archivo .mjs hacia el helper .ts:
falló antes de pruebas, restauró 36 hashes y se corrigió solo el comprobador. El siguiente
preflight pasó. La ampliación del turno total a 35 minutos no cambió el watchdog ya cargado.
Ese parcial no demuestra mejora ni se mezcla con la B del segundo intento.

Los assets actuales conservan el histórico con sus 34 filas y hashes. Sus versiones
originales siguen recuperables en 1077ff21: JSON SHA-256
d92d2279d3c1d9cfc8670290d7ad29d8cceff282769646b41161505af9f63e26 y TXT
c9b7a413bf93e85ffc722f884f4e53d9f3ed2cf2d9b2e1c1d08a6d819a6805c9.
El check de 59e8491b pasó en el run 39460332474; el bloqueo de facturación del run
39453136909 pertenece a una cabeza histórica y no describe el estado observado actual.

## COMMITS

- 48ac8439: reserva SDD-0570.
- 08c0dc7b: helper pgliteLimpio y prueba inicial.
- 4b05a262: adopción de la plantilla en contratos.
- 14e88ef1: spec e índice de specs.
- La cabeza recibida 1077ff21 conserva la evidencia parcial y correcciones documentales.
- Commit que contiene este documento: evidencia del par completo aceptado y cierre del
  criterio 5, con solo cuatro rutas documentales. SHA final en la entrega/PR, sin recursión
  de commits para escribir su propio hash.

## PR / BRANCH

[PR #304](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/304), draft contra main al
retomar; rama codex/pglite-snapshot-esquema. Push explícito de esta rama a sí misma.
No se cambia base ni estado draft en este encargo.

La reserva codex/sdd-reserve-0570-pglite-plantilla-por-archivo y
refs/dtd/reservations/0570 son históricas; su publicación/descarte corresponde al Director.

## PENDIENTES DE ESTA TAREA

- Revisión del delta documental y checks propios del nuevo SHA por el Director.
- Revisión final e integración de #304 cuando corresponda; sin autorización de merge.
- El criterio 5 ya está completo y aceptado: no requiere otra corrida ni nueva aprobación.
- Estado final de SDD/PR, compatibilidad con nuevas integraciones y release se deciden por
  separado. El par se conserva sobre 1077ff21; origin/main observado al terminar fue 8e9e0f50.

## FUERA DE ALCANCE DETECTADO

- Caché entre archivos en disco/globalSetup: decisión nueva, no necesaria para esta SDD.
- Optimizar el SQL de contratos cuyo costo restante sea significativo: requiere medición
  y alcance propios; no modificar la plantilla o debilitar aserciones para ocultarlo.

## Impacto documental y conocimiento

Se actualizan spec, handoff y resúmenes locales TXT/JSON. No cambia runbook, fuente de
producto, helper, test o fuente del piloto semántico. Los hashes verifican su conservación.
No se ejecuta knowledge:status, Graphify, Archify ni publicación Obsidian en este cierre:
el encargo del Director limita la actividad a documentación/diff/guard ligeros mientras
0569 conserva el turno pesado. La revisión de esas capas queda registrada para el Director.

El knowledge:status del primer intento fue una foto histórica durante el control temporal:
exit 0 con ok=false/estructura INVALID, no evidencia del árbol restaurado. No se usa como
estado actual ni se publicaron derivados o bóveda compartida.

## HANDOFF AL DIRECTOR

Medición completa aceptada; criterio 5 cerrado con límites explícitos. El turno pesado
quedó devuelto y los 36 archivos restaurados antes de retomar documentación. El claim
documental se libera tras commit/push; la entrega final comprueba ausencia, árbol limpio,
SHA local/remoto y ahead/behind 0/0. Este documento no atribuye al nuevo commit el CI verde
de la cabeza medida. No hay merge, despliegue, base real ni cambio de estado de la PR.
