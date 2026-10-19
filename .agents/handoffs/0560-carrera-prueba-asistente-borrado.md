# Handoff 0560 · seguimiento: la carrera de `AsistenteBorrado.test.tsx`

- Fecha: 2026-10-19. Estado de la tarea: **lista; PR en borrador**. Falta `pnpm verify` completo,
  que espera el turno del Director.
- Owner/sesión: `claude-vigilant-hopper-2810dc` (Claude Opus 5.5, Worker, sesión «Arreglar la carrera
  de AsistenteBorrado.test.tsx» [f1f39d]).
- Worktree: `.claude/worktrees/vigilant-hopper-2810dc`, creado por la app de escritorio.
- Rama: `claude/vigilant-hopper-2810dc`, desde `main` = `b34c8d57`.
- SDD: [0560](../../docs/specs/0560-asistente-borrado-embarques/spec.md), como seguimiento y sin
  número nuevo (ver «Clasificación»).
- Aislamiento comprobado antes de editar: toplevel y rama correctos, `guard` → `Guard OK`, claim
  adquirido con el owner de arriba. `guard` otra vez antes de cada commit.
- Permisos del encargo (Sam, en esta sesión): commits en la rama, push de la rama propia y PR **en
  borrador** contra `main`. **No merge. No producción.** Antes de una corrida pesada (verify
  completo), pedir turno al Director.

## OBJETIVO ORIGINAL

En el `pnpm verify` de la SDD-0563 (2026-10-19), la primera vuelta de `test` dio dos rojos rápidos en
`app/studio/(app)/embarques/_components/__tests__/AsistenteBorrado.test.tsx` que pasaron en el
reintento: no encontró el botón «Anular factura» justo después de la alerta (873 ms), y el `waitFor`
de 1 s no vio el `role="alert"` (1841 ms). Reproducirlo, corregir la prueba o el componente sin
aflojar aserciones ni subir timeouts, y cerrar con 20 vueltas en verde y un control rojo que muestre
que la prueba sigue detectando la falta del botón.

## DIAGNÓSTICO

Son dos causas, y la segunda depende de la primera.

1. **El componente tenía un render intermedio** (rojo del botón). En React 19, lo que se actualiza
   después de un `await` dentro de `startTransition(async …)` ya no cuenta como parte de la
   transición: se pinta en un render propio, antes de que `isPending` vuelva a `false`. En ese render
   el diálogo mostraba el error con el botón de confirmar en «Procesando…», deshabilitado. La prueba
   esperaba el error con `waitFor` y buscaba el botón enseguida, así que ganaba quien llegara primero:
   el `setTimeout(0)` con que RTL cierra el `waitFor`, o la tarea (`setImmediate`) del render
   siguiente. Bajo carga gana el `setTimeout` y sale un rojo rápido. «Revisar» tenía lo mismo: el
   plan nuevo aparecía junto a «Revisando…» y con sus botones deshabilitados.
2. **La prueba de la alerta caía en cascada.** `vi.clearAllMocks()` borra las llamadas, pero deja en
   cola los `mockResolvedValueOnce` sin consumir (`mockClear` de `@vitest/spy` 4.1.7 no toca
   `onceMockImplementations`; `mockReset` sí). La prueba del reintento, al caer antes de su segundo
   clic, dejaba en cola un «éxito», y la prueba siguiente («si la acción no responde») lo heredaba: el
   paso salía bien, el diálogo se cerraba y la alerta nunca aparecía.

**Reproducción forzando el orden** (copia temporal sin rastrear, ya borrada): un `vi.hoisted` que
retrasa 10 ms el planificador de React (`setImmediate` → `setTimeout(…, 10)`), para que el
`setTimeout(0)` de RTL gane siempre. Con la prueba y el componente de `b34c8d57` dio los dos rojos
del verify, con sus mensajes, en cada corrida:
`Unable to find an accessible element with the role "button" and name "Anular factura"` (el botón
estaba como «Procesando…») y `Unable to find role="alert"`. Sola, la prueba de la alerta pasa aun
forzada: confirma la cascada.

## COMPLETADO

- **`AsistenteBorrado.tsx`:** lo que llega después del `await` va dentro de otra llamada a la
  transición (`startRevision(() => …)` y `startEjecucion(() => …)`, cuatro lugares: resultado y
  `catch` de «revisar» y de «confirmar»). Es el arreglo que documenta React para este caso: el
  resultado y el fin de la espera llegan en el mismo render. Los estados finales no cambian.
- **`AsistenteBorrado.test.tsx`** (13 → 14 casos):
  - `vi.resetAllMocks()` en vez de `vi.clearAllMocks()`, con el porqué en un comentario;
  - helper `filmar`: un `MutationObserver` anota cómo se ve el contenedor después de cada tarea que
    lo toca. Así un estado intermedio queda registrado aunque dure un solo render, sin depender del
    reloj. Más `fotoDialogo` y `fotoPanel`;
  - reintento y «no responde»: el botón final se espera con `findByRole`, acotado con `within` al
    diálogo, y cada cuadro con error debe mostrar «Anular factura» habilitado;
  - TMS «revisar de nuevo»: cada cuadro con el plan nuevo debe mostrarlo sin «Revisando…» y con su
    botón habilitado;
  - caso nuevo, «si revisar de nuevo se cae…»: cubre la envoltura del `catch` de «revisar», que
    ninguna prueba cubría (su mutante sobrevivía).

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Archivo final, una vuelta | PASÓ: `Tests 14 passed (14)` |
| 20 vueltas: 20 copias temporales del archivo final, `--maxWorkers=2` | PASÓ: `Test Files 20 passed (20)`, `Tests 280 passed (280)` |
| Las mismas 20 vueltas con el planificador retrasado 10 ms | PASÓ: `Test Files 20 passed (20)`, `Tests 280 passed (280)` |
| Reproducción: prueba y componente de `b34c8d57`, planificador retrasado | FALLÓ como se esperaba: los dos rojos del verify |
| **Control A:** prueba de `5d88fefd` (13 casos) contra el componente de `b34c8d57`, sin forzar, 10 vueltas | FALLÓ como se esperaba, 30 de 30 (3 por vuelta: reintento, «no responde» y TMS). Cada rojo muestra el cuadro intermedio, p. ej. `"No se pudo anular la factura. \| Procesando… (deshabilitado)"` |
| **Control B, la falta del botón:** mutante `pending={ejecutando \|\| errorDialogo !== undefined}` en el `ConfirmDialog` (el botón no vuelve después del error) | FALLÓ como se esperaba: reintento y «no responde», los dos en el `findByRole` con `Unable to find role="button" and name "Anular factura"` |
| Mutantes por envoltura, archivo final: resultado y `catch` de «revisar» y de «confirmar» | 4 de 4 muertos, cada uno solo por su prueba (TMS, «revisar se cae», reintento y «no responde») |
| Cascada, archivo final con `resetAllMocks` y el reintento forzado a caer antes del segundo clic | Cae solo el forzado; «no responde» pasa |
| Cascada, igual pero con `clearAllMocks` | Cae también «no responde» con `Unable to find role="alert"`: el rojo del verify |
| `eslint` de los dos archivos | PASÓ |
| `tsc` de los dos archivos y lo que importan (tsconfig temporal, ya borrado) | PASÓ (exit 0). Control con un error de tipo a propósito: exit 2 |
| `git diff --check` | PASÓ |
| `pnpm verify` completo | **NO EJECUTADO**: es corrida pesada y espera el turno del Director |

Las copias, los mutantes y las sondas se aplicaron y se revirtieron fuera de los commits; `git
status` quedó limpio después de cada uno. Durante las 20 vueltas había otra sesión corriendo una
prueba puntual de vitest (no un verify); por eso se limitaron a 2 workers.

## Clasificación

- **Comportamiento del Studio: sin cambio.** Los estados finales son los mismos, y la tabla de la
  0560 ya los pedía: «Error del módulo: el diálogo queda abierto con el error y se puede reintentar»
  y «Cargando: `role="status"` … botones deshabilitados». El arreglo hace que el componente los
  cumpla en cada render. Por eso no se pidió número nuevo. Si el Director lo clasifica como cambio de
  comportamiento, hay que pedirle uno.
- Allowlist: los dos archivos están en la allowlist exacta de la 0560.
- LOD-01 (carga y espera): **cumplimiento**. El render intermedio era un destello más corto que una
  transición, que la política pide evitar.
- ERR-01 (errores y recuperación): **cumplimiento**. El error llega con el reintento disponible, y el
  candado anti doble envío del `ConfirmDialog` no cambia.

## COMMITS

- `5d88fefd` fix(studio): SDD-0560 — el resultado de un paso llega junto con el fin de la espera
- `4e7bc754` test(studio): SDD-0560 — revisar de nuevo caído también llega en un solo render
- el commit de este handoff

## PR / BRANCH

- Rama `claude/vigilant-hopper-2810dc` → `main`, PR en borrador (el enlace queda en el reporte de la
  sesión).

## PENDIENTES DE ESTA TAREA

- `pnpm verify` completo, con turno del Director.
- La spec 0560 registra 13 casos para este archivo (evidencia de `b19e41f7`); ahora son 14. No se tocó
  la spec porque esa tabla es evidencia fechada.

## FUERA DE ALCANCE DETECTADO

1. **En desarrollo, el asistente descarta todos sus resultados** (anterior a esta tarea). El efecto
   `useEffect(() => () => { montado.current = false }, [])` no vuelve a poner `true` al montar. Con
   `reactStrictMode: true` (`next.config`), React monta, desmonta y vuelve a montar en desarrollo:
   `montado` queda en `false` y `revisar` y `confirmar` ignoran lo que responde el servidor. Sonda
   (temporal, ya borrada): con el asistente dentro de `<StrictMode>`, el paso se ejecuta (`ejecutar`
   llamado una vez), pero el diálogo nunca se cierra (`expected [ …(2) ] to have a length of 1 but got
   2`). En producción no hay doble montaje, así que **NO VERIFICADO** que afecte a usuarios; sí afecta
   a cualquier smoke en `next dev`, donde el paso se ejecuta en la base sin que la pantalla lo diga.
2. **El mismo patrón en otras pantallas** (sin auditar): `startTransition(async` aparece en 47
   archivos `.tsx` de `app/studio` (54 en `app/`). Los que actualizan estado después del `await` sin
   volver a la transición pueden tener el mismo render intermedio y las mismas pruebas frágiles.

## IMPACTO DOCUMENTAL

- Documentos canónicos: ninguno cambia. Este handoff es nuevo.
- `pnpm knowledge:status` (al cerrar, `4e7bc754`): `ok: false` por pendientes globales que ya
  estaban. Este worktree no tiene `graphify-out/` (`graph_missing_or_invalid`). Estructural `INVALID`
  (4919 pendientes; entre ellos los dos archivos tocados), semántico `INVALID` (0 de 1302; ninguna
  fuente del piloto cambió), Archify `PENDING` (runtime ausente) y Obsidian `PENDING`.
- No se reconstruyó Graphify en el worktree. La capa estructural la actualiza el Director desde
  `main` integrado, como dice el runbook de conocimiento. Este cambio no requiere extracción
  semántica.

## HANDOFF AL DIRECTOR

1. Turno para el `pnpm verify` completo de esta rama, o correrlo en la integración.
2. Confirmar la clasificación: corrección dentro de la 0560, sin SDD nueva.
3. Fuera de alcance 1 (StrictMode): merece su propia tarea, porque engaña a cualquier smoke local.
