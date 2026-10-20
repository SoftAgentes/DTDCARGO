# Handoff · CI «Calidad continua»: tope de 60 min y unitarios en paralelo

| Campo | Valor |
|---|---|
| Task ID | `2026-10-20-ci-calidad-tope-y-paralelismo` |
| Owner / sesión | Worker (Claude Code) · claim `claude-sharp-ellis-7c6126` |
| Worktree | `.claude/worktrees/sharp-ellis-7c6126` |
| Rama | `claude/sharp-ellis-7c6126`, base `origin/main` 653802e2 |
| SDD | no aplica: cambio de harness/CI, sin comportamiento de producto |
| Estado | lista para revisión: PR #302 en borrador con el CI en verde y medido |
| Permisos | commits selectivos, push de la rama propia y PR en borrador. Sin merge ni deploy. |

## OBJETIVO ORIGINAL

El check obligatorio «Calidad local sin secretos» se canceló el 2026-10-20 en la PR #298 (run
39417924823, intento 1) por el tope de 45 minutos, sin fallo de código. Pedido de Sam:

1. Medir las últimas 30 corridas en PR y en main, en total y por paso (tests, e2e y build), y ver
   si la duración crece.
2. Aplicar lo más simple que sea seguro: subir el tope y/o acelerar el paso más lento sin debilitar
   pruebas.
3. Nada pesado en local sin turno del Director.
4. Dejar este handoff.

## Medición (GitHub, solo lectura)

Fuente: `gh run list --workflow quality.yml` y `gh api …/runs/<id>/attempts/<n>/jobs`, 150
corridas del 17 al 20-oct. Los scripts quedaron en el scratchpad de la sesión: `medir.mjs`,
`resumir.mjs` y `archivos.mjs`.

**El paso lento no es el build, son los unitarios.** En el run cancelado:

| Paso | min |
|---|---|
| Instalar | 1,1 |
| ESLint | 1,7 |
| TypeScript | 1,2 |
| **Unitarios** | **37,3** |
| Harness + bash | 1,4 |
| Build (cortado a los 1,9) | 1,9 |
| Job | 45,4 |

El build nunca pasó de 2,4 min en las 150 corridas. El corte cayó en el build solo porque es el
último paso largo. El workflow no tiene paso e2e: el contrato lo excluye (`test:e2e`), así que no
hay e2e que medir.

**Últimas 30 exitosas** (19-oct 18:27Z a 20-oct 11:47Z):

| Medida | Mediana | Máx | Mín |
|---|---|---|---|
| Job | 34,5 | 43,7 | 22,7 |
| Unitarios | 27,6 | — | — |
| Build | 2,0 | 2,4 | — |

Por evento: PR n=22, mediana 33,5 y máx 43,0; main n=8, mediana 35,6 y máx 43,7. La cola es de
0,1 a 1,6 min, así que no influye.

**Tendencia.** Hay dos clases de runner: TypeScript tarda menos de 1 min en una y 1,1 a 1,3 en la
otra. En la clase lenta, los unitarios crecen de un día a otro:

| Día | Mediana | Máx |
|---|---|---|
| 17-oct | 26,9 | 27,8 |
| 18-oct | 27,0 | 27,6 |
| 19-oct | 28,4 | 34,4 |
| 20-oct | 29,2 | 36,1 (37,3 el cancelado) |

El máximo diario del job pasó de 34,3 a 42,2 y a 43,7. Sí crece, y con picos.

**Dónde se va el tiempo** (run cancelado, 851 archivos): 34 archivos `*.migration.test.*` (PGlite)
suman 25,4 de los 29,1 min de pruebas. Los 160 `.tsx` suman 2,2 y los otros 624 `.ts`, 1,0. Los más
lentos:

| Archivo | s |
|---|---|
| `borrado-embarques-recepciones` | 198 |
| `pin-operarios-endurecer` | 179 |
| `credito-referido-candado` (#298) | 104 |
| `cierre-contable-superclave` | 104 |

**Causa del serial.** Vitest 4.1.7 resuelve por defecto `availableParallelism() - 1` workers
(`resolveMaxWorkers`, `node_modules/vitest/dist/chunks/cli-api.*.js`). El runner estándar de un
repo privado trae 2 vCPU según la documentación de GitHub; esto es inferido y no se midió `nproc`.
Resultado: 1 worker. El resumen de vitest lo confirma: `tests 1743.26s` en `Duration 2236.95s`
(con transform, setup, import y environment). Con más de un worker, el acumulado superaría a la
pared.

## COMPLETADO

- `99ce2dc6` `ci: el check de calidad pasa de 45 a 60 minutos de límite`. Toca
  `.github/workflows/quality.yml` (con un comentario del porqué) y el contrato
  `scripts/__tests__/ci-workflow-contract.test.mjs`, que fija 60.
- `b6469e48` `ci: los unitarios del check de calidad usan un worker por vCPU`. El paso «Unitarios»
  corre `pnpm test --maxWorkers=100%`: mismos archivos y aserciones, en paralelo, como ya corren en
  local. `vitest.config.ts` no cambia, así que `pnpm verify` local conserva su resolución.
  - El contrato fija el comando exacto en la lista de pasos.
  - Un bloque nuevo, «CI · los unitarios corren completos y en paralelo», tiene 10 controles.
    Rechaza: quitar el paso, volver a 1 worker, quitar el paralelismo, partir en shards, filtrar
    archivos, `|| true`, condicionar el paso, `continue-on-error` y `VITEST_MAX_WORKERS` en el paso
    o en el job.
- Están en commits separados para revertir solo el paralelismo si diera problemas de memoria o de
  intermitencia.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `node scripts/harness-worktree.mjs guard` | PASÓ |
| `git diff --check` | PASÓ |
| Parseo YAML del workflow con js-yaml 4.3.1 | PASÓ: `timeout-minutes` 60, paso Unitarios `pnpm test --maxWorkers=100%`, lista de `run:` igual a la del contrato |
| Contrato `ci-workflow-contract.test.mjs` en local | NO EJECUTADO. Había un `pnpm verify` ajeno en curso (`sdd-0569-conversor-usd-tasas`), y la regla es una corrida pesada a la vez, sin pruebas puntuales durante un verify. Lo corre el CI de la PR dentro de `pnpm test`. |
| `pnpm verify` | NO APLICA: cambio solo de CI y de su contrato; no hay código de producto |
| `pnpm harness:test` | NO APLICA: no cambian scripts del harness. El CI lo corre igual. |
| CI de la PR (Calidad continua) | PASÓ: run 39427642677 sobre `047c3626`, todos los pasos en verde |

**Medición del CI con 2 workers** (run 39427642677):

| Medida | Valor |
|---|---|
| Job | 21,7 min (13:06:48Z a 13:28:30Z) |
| Unitarios | 16,3 min |
| Vitest | `Duration 976.98s`, `tests 1442.62s` (acumulado / pared = 1,48) |
| Pruebas | 847 archivos y 12.079 casos, todos verdes |
| Build | 1,5 min |

El acumulado supera a la pared, así que corrieron 2 workers en paralelo.

El runner fue de la clase rápida (TypeScript en 49 s). Contra la mediana de esa clase el 20-oct
(Unitarios 21,9 min y job 27,9), baja 26 % y 22 %. Contra la clase lenta (29,2 y 36,5), baja 44 % y
41 %.

La rama sale de `653802e2`, antes de la #298; por eso son 3 archivos menos que en el run cancelado.

Criterio para dar por bueno el paralelismo:

- el CI de la PR sale verde;
- en el log de «Unitarios», `tests …s` es ≈ 2× la pared de `Duration`, lo que prueba 2 workers;
- el paso baja de forma visible frente a la mediana de 27,6 min.

Si sale rojo por memoria (OOM, «Failed to start forks worker») o por intermitencia, se revierte solo
`b6469e48` y queda el tope de 60.

## COMMITS

- `99ce2dc6` ci: el check de calidad pasa de 45 a 60 minutos de límite
- `b6469e48` ci: los unitarios del check de calidad usan un worker por vCPU
- este handoff (commit `docs(handoff): …`)

## PR / BRANCH

Rama `claude/sharp-ellis-7c6126`, [PR #302](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/302) en borrador contra `main`.

## PENDIENTES DE ESTA TAREA

- Hecho: CI medido y en verde. Con esa evidencia el paralelismo se queda; no hace falta revertir
  `b6469e48`.
- Merge: lo decide el Director. Esta rama no toca migraciones ni producto. Al fusionarse dispara la
  publicación automática (SDD-0541), que reconstruye la imagen sin cambio funcional.

## FUERA DE ALCANCE DETECTADO

- **Crecimiento de las pruebas PGlite.** Lo toma la SDD-0570 (rama `codex/pglite-snapshot-esquema`).
  Hallazgo de esa tarea: casi todo el costo es el initdb de cada `new PGlite()` (~1,3 s), no las
  migraciones. Lo que sigue es el análisis original. Cada `*.migration.test.*` levanta PGlite y aplica el
  historial de migraciones en muchos casos. Crece con cada migración nueva, y la #298 sola sumó
  104 s. Con el doble de workers se gana tiempo, pero la curva sigue. Propuesta (SDD de
  test-infra, no de producto): un snapshot del esquema base por worker (`dumpDataDir`/`loadDataDir`
  de PGlite) o un `globalSetup` que lo hornee una vez. Hay que medir antes cuánto de cada caso es
  aplicar migraciones y cuánto es el contrato.
- **Runners de dos velocidades.** La misma suite tarda 1,6× más en una clase de runner. No se
  controla desde el workflow. Si molesta, un runner más grande (de pago) o shards en jobs aparte,
  pero eso cambia los nombres de los checks obligatorios y pide decisión de Sam.
- El intento 2 del run 39417924823 estaba en curso al medir; no lo toqué.

## Impacto documental

- No hay documento canónico que cite el tope de 45 min (grep en runbooks, engineering, AGENTS y
  skills). El porqué queda en los comentarios del workflow y en los commits.
- Graphify y Archify: sin cambios de fuentes de conocimiento (`semanticPilot` no incluye workflows).
  `pnpm knowledge:status` no se ejecutó: no hay `node_modules` en el worktree y había un verify
  ajeno en curso.

## HANDOFF AL DIRECTOR

Son dos commits de CI, separables, más este handoff. Hay que revisar la corrida del CI de la propia
PR: es la primera medición con 2 workers. Si sale verde y más rápida, se puede integrar cuando
quieras. Si sale roja por memoria, revierte solo `b6469e48`.
