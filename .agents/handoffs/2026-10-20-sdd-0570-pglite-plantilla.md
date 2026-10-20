# Handoff · SDD-0570 — pruebas PGlite sin initdb por caso

## Adopción Codex y medición local · 2026-10-20

- El Director delegó a Codex la continuación documental y el criterio 5, con la sesión Claude
  pausada explícitamente por Sam. Se conserva esta rama y este worktree, sin trasladar cambios.
- Owner actual: `codex-0570-ab-01a15a4e`; HEAD recibido y remoto comprobado:
  `59e8491b4842e92678509ca7d1b4788718f7243d`. Árbol limpio, claim previamente ausente,
  guard correcto y claim adquirido. No se encontraron procesos visibles asociados a la ruta;
  esta observación no identifica directorios de trabajo ocultos de otros procesos.
- Turno exclusivo de medición cedido por 0569. Alcance: los 33 contratos afectados más las 8
  pruebas del helper (34 archivos), A/B local comparable, documentación y push a la misma rama.
  Sin suite completa, producto, base real, merge, deploy ni cambio de estado del borrador.
- Control A temporal: revertir únicamente los constructores e imports del commit `4b05a262`,
  con respaldo de bytes y SHA-256 de los 27 archivos; ningún caso, aserción ni SQL cambia.
  El helper y sus pruebas permanecieron intactos. B estaba previsto con los bytes restaurados.
- Se planificaron dos workers/forks en ambos lados, misma selección, orden por semilla y entorno.
  Se obtuvieron resultados parciales A por archivo; la identidad de casos entre A y B no llegó
  a comprobarse. Logs fuera de Git en
  `C:/tmp/director-traspaso-20261020/0570-ab-local`.
- Estado de esta retoma: **PARCIAL, bloque de medición cerrado**. A fue interrumpido por el
  watchdog de 20 minutos del arnés temporal: 26/34 archivos completos, 649 casos reportados en
  verde, 1.200,846 s. B **NO EJECUTADO**. El criterio 5 local sigue pendiente y no se afirma
  mejora de rendimiento. El Director ordenó no reiniciar al cortar.
- Restauración final comprobada: 36/36 SHA-256 originales iguales, cero diferencias; no hay
  cambios persistentes en tests/helper ni procesos Node visibles del worktree. Turno pesado
  devuelto explícitamente a 0569 antes del cierre documental.
- Evidencia por las 34 rutas:
  [comparacion-local.txt](../../docs/specs/0570-pglite-plantilla-por-archivo/assets/comparacion-local.txt)
  y [comparacion-local.json](../../docs/specs/0570-pglite-plantilla-por-archivo/assets/comparacion-local.json).
  No se emitió el JSON final de Vitest; los 26 resultados completos provienen del log A.
- El preflight inicial rechazó un import relativo `.mjs` que el normalizador no contemplaba.
  No lanzó tests y restauró 36/36 hashes; se corrigió el comprobador, sin tocar las pruebas.
- El watchdog se fijó en 20 minutos por fase antes de ampliar el turno total a 35 minutos.
  Es una limitación del arnés temporal, no un fallo de aserción de producto. El próximo intento
  necesita nuevo turno y un límite suficiente definido antes de arrancar.
- El registro histórico siguiente se conserva como evidencia fechada. La afirmación anterior
  de criterios completos no cerraba el A/B local pendiente. El CI actual de `59e8491b` sí pasó.

| Campo | Valor |
|---|---|
| Task ID | `2026-10-20-sdd-0570-pglite-plantilla` |
| Owner / sesión | Último Worker: Codex · `codex-0570-ab-01a15a4e`; Claude pausado por Sam |
| Worktree | `DTD-worktrees/pglite-snapshot-esquema` |
| Rama | `codex/pglite-snapshot-esquema`, base `origin/main` `d50aa3e7` (incluye la #298) |
| SDD | [0570](../../docs/specs/0570-pglite-plantilla-por-archivo/spec.md), `in-progress` |
| Estado | **PARCIAL**. Criterio 5 local pendiente; A incompleto por watchdog, B no ejecutado. CI de `59e8491b` pasó; PR #304 sigue en borrador |
| Permisos | commits selectivos, push de la rama propia y PR en borrador. Sin merge. |

## Autorizaciones (literales)

- Sam: «Haz esta tarea aquí: “Pruebas PGlite: snapshot del esquema base por worker”».
- Director, en su sesión: la 0570 queda para esta tarea (la había prometido a Contabilidad, que
  pasa a la 0571). Hoy la máquina la usa Contabilidad: validar con el CI de GitHub y pedir turno
  local cuando se libere.

## OBJETIVO ORIGINAL

Bajar el costo de las pruebas `*.migration.test.*` (PGlite) sin debilitar ninguna aserción, control
rojo, mutante ni contrato:

1. Medir primero qué parte de cada caso es levantar PGlite y qué parte es el contrato.
2. Si conviene, una plantilla del esquema base.
3. SDD con el Director.
4. Medición antes/después y este handoff.

## Hallazgo

La hipótesis inicial era que el costo estaba en aplicar migraciones. **Era el initdb.**

| Arranque (máquina de Sam, mediana de 5) | ms |
|---|---|
| `new PGlite({ extensions: { pgcrypto } })` | 1.321 |
| `new PGlite()` | 1.186 |
| `new PGlite({ loadDataDir })` desde un dump post-initdb | 322 |

Cada contrato aplica solo su puñado de migraciones (`\ir`) dentro de su transacción; lo caro es el
cluster nuevo de cada caso. `new PGlite()` hace el initdb en otra instancia, la vuelca y la carga.

## COMPLETADO

- `48ac8439`: reserva de la SDD-0570 con `sdd:next --reserve`, traída por cherry-pick.
- `08c0dc7b`: `vitest/pglite-limpio.ts` y su prueba.
  - Hace un initdb por juego de extensiones y por archivo, y da a cada caso una instancia propia
    cargada del dump.
  - Si la plantilla falla, sale del caché.
- `4b05a262`: 36 sitios en 27 archivos pasan a `await pgliteLimpio(...)`, con las mismas
  extensiones. Son 26 archivos de prueba y `r3-correlation-contract.ts`, que usan 7 archivos más.
  - Solo cambian la línea de construcción y los imports.
  - Quedan con `new PGlite()`: los seis `beforeAll` de una instancia por archivo y
    `pin-operarios-endurecer.migration.test.ts:1159`.
- `14e88ef1`: spec e índice de specs regenerado.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Guard, claim y `git diff --check` | PASÓ |
| Helper inicial, evidencia histórica | PASÓ, 6/6; el archivo actual tiene 8 casos |
| Helper actual dentro del intento A | PASÓ, 8/8, fuente intacta |
| Huella fresco contra cargado (script aparte, con y sin pgcrypto) | PASÓ: 11 de 11 medidas iguales, incluidos txid (752) y OID siguiente |
| Mutantes del helper (TAP, control sin mutar: 8 ok) | 6 de 6 mueren; un equivalente documentado (`txid_current()` sin checkpoint no llega al dump) |
| A/B `cobro-factura-atomico` (7 casos) | PASÓ: 11,2 y 11,7 s → 7,3 y 8,0 s |
| A/B `portal-bandeja-avisos` (48 casos) | PASÓ: 66,2 s → 27,1 s, 48/48 |
| ESLint sobre los archivos cambiados | PASÓ: 0 errores; los 20 imports `PGlite` sin uso se quitaron (más el del `.mjs`, que ESLint ignora) |
| `pnpm docs:index`, `docs:check` y `sdd:check` | PASÓ |
| Retoma: entradas Node de índice, docs:check, numbering y `git diff --check` | PASÓ: 556 specs, 488 migraciones, 11 excepciones históricas ya registradas; índice regenerado sin diff |
| Corrida local A/B de los 34 archivos, sobre `59e8491b` | **PARCIAL**: A terminó por watchdog a 1.200,846 s; 26 archivos y 649 casos reportados verdes. B NO EJECUTADO; no comparación local válida |
| Integridad tras el control A | PASÓ: 36/36 SHA-256 originales restaurados; solo documentación queda modificada |
| `pnpm typecheck` | NO EJECUTADO en esta retoma acotada; lo cubre el check CI observado del código |
| `pnpm verify` | NO EJECUTADO: es un cambio de prueba, sin código de producto. Lo cubren el CI de calidad (lint, typecheck, test, build) y la corrida local cuando haya turno. |
| CI con plantilla, run 39436611054 sobre `8a13412c` | PASÓ: Unitarios 21,6 min contra 33,9 sin plantilla (run 39429472606); los 33 archivos afectados, 9,5 min contra 21,7. Detalle en la spec y en `assets/comparacion-ci.txt`. |
| Criterio 6: mismos resultados | PASÓ: mismo conteo y todos en verde en los 33 archivos afectados; los dos conteos que cambian son de la #300 |
| Criterio 7: control rojo | PASÓ: 40 controles rojos y 375 mutantes en verde con plantilla |
| CI histórico de `e6311891` (merge de main del Director) | NO EJECUTADO en ese momento: GitHub no arrancó por facturación (run 39453136909). Sustituido como estado vigente por el check de `59e8491b` |
| CI vigente de `59e8491b` | PASÓ: `Calidad local sin secretos`, run 39460332474 / job 118776457014, 2026-10-20 17:23:59Z–17:48:05Z |

La comparación histórica de `assets/comparacion-ci.txt` usa un worker en ambos lados. La punta
actual ya contiene la integración de #302; no se deben mezclar sus tiempos con aquel A/B como si
fueran condiciones iguales. El intento local fijó expresamente dos workers en ambos lados,
pero quedó sin B.

## COMMITS

- `48ac8439` chore(sdd): reserva SDD-0570 — pglite-plantilla-por-archivo
- `08c0dc7b` test: SDD-0570 — pgliteLimpio carga un cluster recién inicializado sin initdb
- `4b05a262` test: SDD-0570 — los contratos PGlite toman cada caso de la plantilla
- `14e88ef1` docs(sdd): SDD-0570 — pruebas PGlite sin initdb por caso
- este handoff
- commit que contiene la evidencia parcial local, las correcciones de estado de esta spec y este
  handoff; el SHA final se entrega al Director, sin recursión de commits por su propio hash

## PR / BRANCH

Rama `codex/pglite-snapshot-esquema`, [PR #304](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/304)
en borrador contra `main`. La reserva `codex/sdd-reserve-0570-pglite-plantilla-por-archivo` y
`refs/dtd/reservations/0570` siguen locales. El Director la publica o la descarta: la spec entra por
esta PR.

## PENDIENTES DE ESTA TAREA

- Hecho: CI medido y criterios 6 y 7 registrados en la spec.
- **Criterio 5 local:** completar un nuevo par A/B de los 34 archivos en otro turno autorizado,
  con límite del arnés suficiente desde el inicio. El listado exacto queda en los assets locales.
  No reiniciar ni completar por subconjuntos sin coordinar la comparación con el Director.
- El CI observado de `59e8491b` pasó; después del commit documental, el Director debe distinguir
  el estado de su nuevo SHA del check del código ya observado. No se cambió el borrador de #304.
- Integración, estado final de criterios y eventual cambio de la PR corresponden al Director.

## FUERA DE ALCANCE DETECTADO

- **Caché entre archivos.** Un `globalSetup` que deje el dump en disco ahorraría además un initdb
  por archivo (~1,3 s × 33). No hace falta para el objetivo.
- **Contratos con SQL caro de verdad.** En `cobro-factura-atomico` el caso sigue en 1,2 a 2,8 s
  después del cambio: ahí pesa el contrato, no el arranque. Si algún archivo sigue arriba, el paso
  siguiente es medir su SQL, no tocar la plantilla.

## Impacto documental

- Nueva spec 0570 e índice regenerado. No cambia ningún runbook.
- Graphify y Archify: sin cambios en fuentes de `semanticPilot`. Durante A, `node
  scripts/knowledge-sync.mjs status` terminó por sí solo con exit 0, `ok=false`, estructura
  `INVALID`; es una foto del control temporal, no evidencia del cierre restaurado. El intento de
  detener la espera llegó después de su salida y no terminó ningún proceso.
- No se publicaron derivados ni la bóveda compartida. Revisión final de Graphify, Archify y
  Obsidian pendiente del Director; esta entrega solo guarda evidencia de la tarea.

## HANDOFF AL DIRECTOR

El bloque local se entrega **PARCIAL**: A cortado por el watchdog, B no ejecutado y criterio 5
pendiente. No se infiere una mejora local. El turno pesado quedó devuelto a 0569, sin pruebas
en segundo plano y con 36 archivos originales restaurados. Solo se publican spec, assets de
comparación local y handoff en la misma rama. El cierre libera el claim después de commit/push;
la entrega final al Director registra SHA y comprobación de su ausencia. No hay autorización
nueva de merge, deploy, base real ni cambio de estado de la PR.
