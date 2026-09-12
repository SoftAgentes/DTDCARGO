# Handoff — `locked` y `prunable` en el informe de `finish` (SDD-0460)

Fecha: 2026-09-12. Task ID: `harness-worktrees-bare-locked`. SDD-0460.
Owner / sesión escritora: `nervous-tharp-418741` (Worker Claude Code). Sin subagentes.

Estado: lista-para-revision, **ronda 2**. **No está integrada.** La PR es la frontera; el merge lo decide el Director.

## RONDA 2 — LA MITAD GRANDE DEL ENCARGO SE RETIRÓ, Y FUE LO CORRECTO

La ronda 1 (head `03535d16`) traía dos cosas. **Una introducía una regresión y no se integró.**

El Director la detectó leyendo el código y pidió medirla antes de aceptar su lectura. La medí con un repo `--bare` de dos vinculados y el script de `main` de entonces como control:

| comando | desde | control | ronda 1 |
| --- | --- | --- | --- |
| `guard` | `aaa-worker` | exit 0 · `Guard OK` | **exit 1 · «el checkout principal no es un workspace de implementación»** |
| `guard` | `zzz-worker` | exit 0 · `Guard OK` | exit 0 · `Guard OK` |
| `claim --dry-run` | `aaa-worker` | exit 0 | **exit 1 · mismo rechazo** |
| `finish <nombre>` | ambos | exit 1 | exit 1 — idéntico |

En un repo bare **todos** los worktrees son vinculados. Al descartar el registro `bare`, `entries[0]` pasaba a ser el árbol de un Worker y el harness lo declaraba checkout principal. Y rompía **a uno solo** —el que ordena primero por ruta—, que es peor que romper a todos: el mismo comando anda desde un árbol y falla desde su hermano, culpando al workspace de quien lo corre.

**Por qué las pruebas de la ronda 1 no lo agarraron, que es la lección del episodio.** El fixture reproducía la disposición **feliz**: el suplente del principal se llamaba `AAA-principal` justo para ordenar primero, o sea el acomodo donde el defecto no se nota. Siete mutantes morían y **ninguna prueba miraba `guard` en un repo bare**. Y peor: la spec de esa ronda **ya nombraba el mecanismo** en su riesgo 1 y lo leí como límite residual en vez de regresión activa. Tener el hecho anotado y sacar la conclusión contraria se parece más a estar cubierto que no haberlo visto — un ítem en Riesgos le dice a quien lo lea, y al autor al revisar, que ese frente ya fue considerado. Quedó escrito en la spec, en el [comentario de la PR](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/99#issuecomment-5644467288) y como memoria del proyecto, porque este hilo se resume y se pierde.

**Lo que se hizo en la ronda 1 y no se deshace:** el comentario en la PR con la tabla, puesto antes de rehacer nada, porque la spec publicada decía `CUMPLE` en siete criterios y había un registro durable afirmando algo que no se sostenía.

## Aislamiento y estado

- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/nervous-tharp-418741`. Recibido ya aislado; no se creó otro con `start`. `claim --owner nervous-tharp-418741` retomado antes de editar en esta ronda.
- **Rama:** `claude/quizzical-dijkstra-809aae`. Se integró `origin/main` `e3dcd314` —el SHA que mandó el Director, con SDD-0458 y SDD-0459 adentro— **antes** de tocar nada. Verificado contra lo que él informó: SHA idéntico, 437 specs, `0458` y `0459` presentes en el árbol de main.
- **Resolución del merge, declarada:** conflictó en los dos archivos de `scripts/`. Se resolvió tomando **la versión de `main` completa** (`git checkout origin/main -- <los dos archivos>`) y reaplicando encima solo el alcance reducido, para no arrastrar estructura de la ronda 1. Sin force push; el historial conserva las dos rondas.
- **No se tocó:** producción, Supabase, migraciones, `app/`, `lib/`, `.claude/settings.json`. Sin `git add -A`.
- **SDD:** se **reescribe 0460** en vez de reservar otro número. El número ya estaba gastado y la tarea es reconocible como la misma —mismo encargo, misma función, misma PR—; lo que cambió es que una de sus dos mitades se retiró, y la spec lo declara en su primera sección en vez de esconderlo. Coincide con la inclinación del Director. Índice regenerado: **438 specs**.

## Qué queda en la PR

1. **`parseWorktrees(porcelain)`, pura y exportada**, que **conserva todos los registros** y no reordena: `entries[0]` sigue siendo el primero del porcelain, que es la invariante sobre la que `mainWorktreeFrom` verifica el principal. Se extrae para fijar el parseo por prueba sobre una salida literal, sin depender de armar el repo que lo produce.
2. **Cuatro campos nuevos en el informe:** `locked`, `lockedReason`, `prunable`, `prunableReason`. Tipo estable: bloqueado **sin** razón es `locked: true` + `lockedReason: null` —deliberado, sin motivo guardado por git—, que no puede leerse igual que «no está bloqueado».
3. **El disco sigue siendo el árbitro**, con prueba propia: un worktree que git ya llama `prunable` por estar borrado sigue dando exit 1 por `existsSync` y sigue registrado. El informe publica la opinión de git como evidencia, nunca como autorización.

**Lo que se fue, y verificado contra `main` como pidió el Director:**

- **Descartar el `bare`.** Bajo SDD-0459 ya no reproduce la regresión (`guard` rechaza por el principal verificado, no por `entries[0]`), pero tampoco aporta: la entrada bare ya queda fuera de los candidatos por el flag, en `guard` y en `resolveCandidate`. El único argumento que quedaba —cerrar la asimetría con `next-number.mjs:50`— es débil solo, y en contra está que le saca la invariante de abajo a `mainWorktreeFrom`. **No lo defiendo.**
- **El error con nombre de la lista vacía.** Medido: en un repo bare sin vinculados el código de `main` responde «Este repo no tiene checkout principal verificable…» con instrucción de qué hacer y **cero** `Cannot read properties`. El mensaje de `main` es mejor que el que traía la ronda 1.

`finish` sigue siendo solo informe, `start` intacto, ningún campo existente renombrado ni cambiado de tipo.

Detalle interno sin efecto externo: `path` y `branch` pasan de `undefined` a `null` cuando el campo no está, porque ahora salen del mismo helper. Los tres usos son indistinguibles — `mainWorktreeFrom` mira `!entries[0].path`, `guard` mira `!entry.branch` y el informe publica `entry.branch ?? null`; se verificó que ninguna prueba de `main` asevera `undefined`.

## Validación

| comprobación | resultado |
| --- | --- |
| `node scripts/tests/run-harness.mjs` (Windows) | PASÓ — 12 archivos, **87/87** |
| `eslint` sobre los 2 archivos tocados | PASÓ — 0 problemas |
| `corepack pnpm lint` | PASÓ — 0 errores (8 warnings preexistentes en `app/`, ajenos) |
| `corepack pnpm docs:check` | PASÓ — 438 specs |
| `corepack pnpm sdd:check` | PASÓ — sin números repetidos |
| `git diff --check` | PASÓ |
| `corepack pnpm verify` | **NO EJECUTADO** — su paso `e2e` exige Supabase, que esta sesión no tiene |
| CI alojado | se informa al Director por mensaje, con «Calidad local sin secretos» nombrado y el `headSha` del check |

**Siete mutantes** dejan rojo exactamente la prueba que les toca, con control verde antes y después: quitar los cuatro campos del JSON; `hasField` solo con campo pelado; `hasField` solo con campo con valor; `fieldValue` devolviendo `undefined`; quitarle el `-z` a `worktrees()` (deja rojas cinco, cuatro preexistentes); **descartar el registro bare**; y que `finish` le crea a git en vez de al disco.

**Dato honesto sobre el mutante del bare:** deja roja **solo la prueba nueva de `parseWorktrees`**, no las pruebas de repo bare de SDD-0459 — bajo la derivación nueva, descartar el bare ya no cambia el resultado de `mainWorktreeFrom`. O sea: las pruebas de `main` no atajan por sí solas el error de la ronda 1, y la prueba de esta spec es lo que lo fija. Ese es su valor real, y es más chico que el que le habría puesto sin medirlo.

El corredor de mutantes usa `--test-reporter=tap`: Node 24 usa `spec` por defecto **también fuera de TTY**, y con `spec` informa que los siete sobrevivieron. En la ronda 1 pasó exactamente eso, y lo delató la corrida de **control en ROJO** — un control rojo significa que el lector está mal, no el código.

**Por qué las pruebas de producto no aplican.** El cambio vive entero en `scripts/harness-worktree.mjs` y su archivo de pruebas, y ninguna ruta de `app/`, `lib/` ni `supabase/` lo importa: `playwright`, `typecheck`, `rsc-boundary`, `components:check`, `governance:check`, `edge:check`, `sql-tests`, `schema-rebuild` y `migrations-applied` no tienen nada que medir — no hay componente, ni frontera de import, ni SQL, ni esquema tocado. `/ui-check` tampoco (no hay UI) ni `revisar-datos-ve`: el informe nombra rutas de archivos y razones de lock que escribe quien bloquea, nunca contenido de archivos, y no se trata dato personal alguno.

## Pendientes de esta tarea

Ninguno de implementación. Falta la revisión del Director y la CI del head publicado.

## FUERA DE ALCANCE DETECTADO

1. **El informe no dice nada de los worktrees que no son el candidato.** `locked` y `prunable` se publican solo del candidato, así que un barrido de limpieza sigue necesitando correr `finish` por cada uno o leer el porcelain a mano. Si el paso de limpieza del runbook quiere una vista de todos, es otra tarea.
2. **`finish --dry-run` se acepta y no hace nada** (hallazgo 3 del handoff de 0458, sigue sin atender).
3. **`finish` sigue pidiendo `git status --untracked-files=all` para calcular un booleano** (riesgo 4 de SDD-0457).
4. **La expansión de directorios ignorados colapsados llega a un nivel** (riesgo 1 de SDD-0457).
5. **La razón del lock la escribe una persona y se imprime cruda**, sin escapar, dentro de un JSON que otro programa puede leer. No se interpreta ni decide nada con ella.
6. **8 warnings de eslint preexistentes en producto**, ajenos y anteriores.

## Handoff al Director

- **Siguiente acción:** revisar y fusionar. Es la última de la cola según su mensaje.
- **Contratos compartidos:** el JSON de `finish` **suma** cuatro campos y ninguno existente cambia de nombre ni de tipo. `parseWorktrees` queda exportada junto a `mainWorktreeFrom`, `resolveCandidate` y `worktreeContainers`. `cleanupAuthorized: false` y el pie de limpieza manual no cambian; el pie suma una frase que dice que `locked`/`prunable` son evidencia y que el disco manda sobre git.
- **Efecto en los demás Workers:** el informe de cierre trae dos datos más para el paso de limpieza, que hoy se hace sin ellos. Nada más cambia.
- **Integración y producción:** integrar a `main` **dispara el deploy de producción en Vercel**, porque el `ignoreCommand` de `vercel.json` no excluye `scripts/**`. El artefacto de la app no cambia, pero la autorización de merge tiene que cubrir ese deploy. Sin migraciones; no se tocó producción ni Supabase.
- **Ownership:** el claim `nervous-tharp-418741` se libera al cerrar. La rama y el worktree se conservan; no se borra nada.
