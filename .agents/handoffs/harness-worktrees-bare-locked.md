# Handoff — `worktrees()` descarta el registro bare, y `finish` informa `locked` y `prunable`

Fecha: 2026-09-12. Task ID: `harness-worktrees-bare-locked`. SDD-0460.
Owner / sesión escritora: `nervous-tharp-418741` (Worker Claude Code). Sin subagentes.

Estado: lista-para-revision. **No está integrada.** La PR es la frontera; el merge lo decide el Director.

## Aislamiento y estado

- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/nervous-tharp-418741`.
  La sesión lo recibió ya aislado, así que **no** se creó otro con `start`: anidar habría duplicado el aislamiento existente. `guard` PASÓ y `claim --owner nervous-tharp-418741` se tomó antes de editar; se revalidó `guard --owner` antes del primer commit.
- **Rama:** `claude/quizzical-dijkstra-809aae`, nacida en `0413d4a1`, que es `origin/main` al arrancar y al cerrar (se verificó con `git fetch`: main no avanzó durante la tarea).
- **No se tocó:** producción, Supabase, migraciones, `app/`, `lib/`, `.claude/settings.json`. Sin `git add -A`, sin force push, sin cambios en ramas ni worktrees ajenos.
- **SDD:** `docs/specs/0460-harness-worktrees-bare-locked/spec.md`, en `done`. Reservado con `pnpm sdd:next --reserve harness-worktrees-bare-locked`, que creó `refs/dtd/reservations/0460` y `refs/heads/codex/sdd-reserve-0460-harness-worktrees-bare-locked` sobre `origin/main`, sin tocar HEAD; el stub entró a la rama con `git cherry-pick` (`84c8b919`). La rama de reserva y su lock quedan intactos y **sin publicar**: la PR lleva la spec. Índice regenerado con `docs:index`: 433 specs.

## ⚠️ DOS COSAS QUE SOLO EL DIRECTOR PUEDE RESOLVER

**1. Otra sesión reservó SDD-0459 `principal-sin-inferir` 34 segundos antes que yo, sobre el mismo supuesto.**
Mi primer `sdd:next --reserve` pidió 0459 y el CAS lo rechazó: `cannot lock ref 'refs/dtd/reservations/0459': reference already exists`. El lock funcionó y no hubo número duplicado; tomé 0460. Pero el nombre de esa reserva apunta al **mismo hallazgo** que esta tarea, por la vía que mi encargo excluyó explícitamente («no es un refactor»): dejar de inferir el principal de `entries[0]`.

- Refs de esa sesión: `refs/dtd/reservations/0459`, `refs/heads/codex/sdd-reserve-0459-principal-sin-inferir` y la rama de trabajo `refs/heads/codex/principal-sin-inferir` (commit `4566a296` sobre `0413d4a1`, solo el stub al momento de escribir esto).
- **No toqué nada de eso.** Si esa sesión reescribe cómo se elige el principal, su cambio y el mío viven en la misma función y habrá que decidir qué queda. Mi arreglo es la línea que descarta el `bare`; el suyo, por nombre, sería el arreglo de fondo. Pueden ser complementarios o redundantes: no lo sé y no lo decido.

**2. Mi base es `main`, no la PR #97, y el merge con #97 tiene dos conflictos que ya resolví y probé.**
El encargo describía código de SDD-0458 (`worktreeContainers`, `resolveCandidate`, y pruebas de los dos contenedores) que **no está en `main`**: la PR #97 sigue abierta. Elegí basar en `origin/main` en vez de apilar sobre #97, con esta evidencia: **#97 no toca `worktrees()`**, que es donde vive todo mi cambio, así que mi PR es mergeable en cualquier orden y no arrastra el contenido de #97. Apilar habría metido en mi PR los 895 borrados que el diff de #97 muestra contra el `main` de hoy.

Consecuencia honesta: **las pruebas de `resolveCandidate` y de los dos contenedores no existen en mi árbol**, así que no pude dejarlas verdes; en el merge verificado abajo quedan verdes. Nada mío las debilita.

### Los dos conflictos, con la resolución ya verificada

Medido con `git merge-tree --write-tree HEAD claude/youthful-driscoll-120aae` y reproducido con un merge real en un clon desechable (borrado al terminar):

| archivo | conflicto | resolución |
| --- | --- | --- |
| `docs/specs/README.md` | **ninguno en el repo real** — lo resuelve solo el driver `dtd-generated-records` («✓ merge semántico»). En un clon sin ese driver sí choca; regenerar con `docs:index`. | regenerar el índice con el script |
| `scripts/harness-worktree.mjs` (~línea 96) | mi `worktrees()` nuevo queda pegado a `safeTarget`, que #97 reemplaza por `assertNotRedirected` | **conservar las dos mitades**: mi `worktrees()` completo (con `parseWorktrees` y la guarda de lista vacía) seguido del `function assertNotRedirected(target) {` de #97. Lo único que se descarta son las 4 líneas de la cabecera de `safeTarget`, que #97 elimina de todos modos |
| `scripts/tests/harness-worktree.node.mjs` (línea 8) | las dos ramas agregan imports nombrados del mismo módulo | **unión**: `import { isValidSlug, worktreePathFor, worktreeContainers, resolveCandidate, branchFor, parseArgs, isSensitiveIgnoredName, parseWorktrees } from '../harness-worktree.mjs';` |

**Resultado del merge resuelto así: `run-harness.mjs` → 85/85 en verde** (81 de `main` + 2 de #97 + 2 mías), con el índice regenerado en 434 specs. También se verificó que los dos cambios **se componen**: el `entry` que #97 saca de `resolveCandidate` es un registro de `parseWorktrees`, así que lleva `locked`/`prunable` y el JSON sigue funcionando; y el `finish` de #97 hereda gratis el filtro del `bare`. Mis pruebas se insertaron arriba del archivo, no al final, justamente para no solapar con el bloque que #97 agrega al final.

## Qué estaba mal y qué se hizo

**Hallazgo 1 — `worktrees()` no descartaba el registro `bare`.** `scripts/next-number.mjs:50` sí lo hacía; `worktrees()` no. Asimetría real entre dos lectores del mismo porcelain. De `entries[0]` salen el checkout principal, su contenedor de worktrees, el rechazo de `guard` y el candidato de `finish`, así que pega a `guard`, `claim`, `release` y `finish`, y en #97 también a `worktreeContainers` y `resolveCandidate`.

Medido con git 2.55 en Windows, sobre un repo bare con tres worktrees vinculados:

| medición | resultado |
| --- | --- |
| posición del registro `bare` | **primera, siempre** |
| orden de los vinculados | alfabético por ruta |
| repo **normal**: ¿el principal va primero aunque su nombre sea el último alfabéticamente? | **sí** (`zzz-principal` antes de `aaa` y `mmm`) |

O sea: en un repo normal el principal gana el primer puesto por ser el principal, y **lo único que se lo quitaba era el registro bare**. El arreglo es la línea `if (fields.includes('bare')) return [];`. El parseo se extrajo a `parseWorktrees`, **pura y exportada**, para fijar el caso sobre una salida literal sin depender de armar un repo bare.

**Una línea más, declarada:** al descartar el bare, un repo bare **sin** vinculados deja la lista vacía y `entries[0].path` moría con `TypeError: Cannot read properties of undefined`. Se cambió por un error con nombre. Es un crash opaco convertido en mensaje, no una ampliación de alcance, y tiene prueba.

**Hallazgo 2 — `locked` y `prunable` se descartaban.** El informe suma cuatro campos: `locked` y `prunable` booleanos, `lockedReason` y `prunableReason` con la razón de git o `null`. Cuatro campos de tipo estable en vez de dos uniones, porque un worktree bloqueado **sin** razón es `locked: true` con `lockedReason: null` y no un bloqueo invisible. No cuesta una llamada nueva a git.

**Hallazgo del camino, medido:** sin `-z`, git **cita y escapa en octal** la razón del lock (`locked "el Director lo pidi\303\263"`); con `-z` la entrega cruda. Lo destapó una aserción mía que releía el formato sin `-z` y falló. `worktrees()` ya usaba `-z`; ahora hay prueba que lo sostiene, y el mutante que le quita el `-z` deja rojas **tres** pruebas, dos preexistentes.

**Lo que NO cambió, a propósito:** `finish` sigue siendo solo informe —no borra, no poda, no publica; `cleanupAuthorized: false` y el pie sobre limpieza manual quedan—; `start` sigue creando en `DTD-worktrees/<slug>`; ningún campo existente del JSON cambia de nombre ni de tipo; y un candidato ausente en disco se sigue rechazando por `existsSync` y **no** por lo que opine git. Ese último límite tiene prueba propia: un worktree que git ya llama `prunable` por estar borrado sigue dando exit 1. Si git y el disco discrepan, manda el disco.

Detalle interno sin efecto externo: `branch` pasa de `undefined` a `null` cuando no hay rama (HEAD detached). Los dos usos son indistinguibles — `finish` ya publicaba `entry.branch ?? null` y `guard` lo evalúa por falsy.

## Validación

| comprobación | resultado |
| --- | --- |
| `node scripts/tests/run-harness.mjs` (Windows) | PASÓ — 12 archivos, **83/83** |
| la misma suite sobre el **merge resuelto con #97** | PASÓ — **85/85** |
| `eslint` sobre los 2 archivos tocados | PASÓ — 0 problemas |
| `corepack pnpm lint` | PASÓ — 0 errores (8 warnings preexistentes en `app/`, ajenos y anteriores) |
| `corepack pnpm docs:check` | PASÓ — 433 specs |
| `corepack pnpm sdd:check` | PASÓ — sin números repetidos (las ⏸ son choques históricos ya aplicados en prod) |
| `git diff --check` | PASÓ |
| `finish` real contra `DTD-worktrees/c-l17-verificar-throttle` | PASÓ — solo lectura; informe con los 4 campos nuevos y los anteriores intactos |
| `corepack pnpm verify` | **NO EJECUTADO** — su paso `e2e` exige Supabase, que esta sesión no tiene |
| CI alojado | **NO EJECUTADO al escribir esto**: es lo único que no se sabe antes de publicar. Se le informa al Director por mensaje; no se empuja nada después del push |

**Siete mutantes** dejan rojo exactamente la prueba que les toca, con control verde antes y después: quitar el filtro de `bare` (caen las dos pruebas nuevas); quitar los cuatro campos del JSON; que `hasField` mire solo el campo pelado; que mire solo el campo con valor; quitar la guarda de lista vacía; que `fieldValue` devuelva `undefined` en vez de `null`; y quitarle el `-z` a `worktrees()` (caen tres, dos preexistentes).

**Por qué las pruebas de producto no aplican.** El cambio vive entero en `scripts/harness-worktree.mjs` y su archivo de pruebas. Ninguna ruta de `app/`, `lib/` ni `supabase/` importa ese archivo, así que `playwright`, `typecheck`, `rsc-boundary`, `components:check`, `governance:check`, `edge:check`, `sql-tests`, `schema-rebuild` y `migrations-applied` no tienen nada que medir acá: no hay componente, ni frontera de import, ni SQL, ni esquema tocado. `/ui-check` tampoco: no hay UI. `revisar-datos-ve` tampoco: el informe nombra rutas de archivos y razones de lock que escribe quien bloquea, nunca contenido de archivos, y no se trata dato personal alguno. `pnpm verify` completo queda NO EJECUTADO por el paso `e2e`, que exige Supabase.

**Una trampa de entorno, ninguna del cambio.** El primer fixture del repo bare se armó bajo el scratch de la sesión (~190 caracteres) y `git worktree add` devolvió `fatal: '$GIT_DIR' too big`: es el límite de ruta de Windows, no el código. La prueba usa `mkdtempSync(tmpdir())`, que deja rutas cortas. Aparte, el corredor de mutantes daba «todos sobrevivieron» hasta que se le pasó `--test-reporter=tap`: Node 24 no emite TAP por defecto ni fuera de TTY, y el control en ROJO fue lo que delató que el lector estaba mal, no las pruebas.

## Commits

- `84c8b919` — `chore(sdd): reserva SDD-0460` (cherry-pick del stub).
- `3155f5b3` — `fix(harness): worktrees() descarta el registro bare y expone locked y prunable` (código + pruebas).
- `2dbedf4f` — `docs(sdd): SDD-0460` (spec + índice regenerado).
- El commit que trae este documento cierra la tarea.

## Pendientes de esta tarea

Ninguno de implementación. Falta la revisión del Director, su decisión sobre el orden de integración frente a #97 y 0459, y la CI del head publicado.

## FUERA DE ALCANCE DETECTADO

No se tocó nada de esto; queda anotado con evidencia.

1. **El principal sigue siendo `entries[0]`.** Esta tarea quita de la lista el registro que no es checkout de nada; no convierte la inferencia en una consulta explícita a git. En un repo **bare** no hay principal y `entries[0]` pasa a ser el vinculado que git liste primero, que es alfabético. Es exactamente el territorio de la reserva 0459 `principal-sin-inferir` de la otra sesión.
2. **`finish --dry-run` se acepta y no hace nada** (hallazgo 3 del handoff de 0458, sin atender). La bandera sigue en la ayuda sugiriendo una diferencia que no existe.
3. **`finish` sigue pidiendo `git status --untracked-files=all` para calcular un booleano** (riesgo 4 de SDD-0457). Ya no revienta, pero materializa un árbol grande para nada.
4. **La expansión de directorios ignorados colapsados llega a un nivel** (riesgo 1 de SDD-0457). Sin cambios.
5. **La razón del lock la escribe una persona y el informe la imprime cruda**, sin escapar, dentro de un JSON que alguien puede leer con otro programa. No se interpreta ni se usa para decidir nada, pero es texto ajeno en una salida estructurada.
6. **8 warnings de eslint preexistentes en producto** (`react-hooks/set-state-in-effect` y compañía), ajenos y anteriores a esta tarea.
7. **`c-l17-verificar-throttle` tiene un claim activo** (`claude-worker-l17-r2`, del 2026-09-12T05:50:12Z) y lo usé como candidato de la prueba real de `finish`. Solo lectura; no se tocó ese worktree ni su rama. Lo anoto porque el informe de `finish` muestra claims ajenos y eso es evidencia de sesiones vivas, no permiso para limpiarlas.

## Handoff al Director

- **Siguiente acción:** revisar la PR y decidir el orden frente a #97 y frente a 0459. Mi rama es mergeable en cualquier orden respecto de #97; los dos conflictos y su resolución están arriba, ya probados en 85/85.
- **Contratos compartidos:** el JSON de `finish` **suma** `locked`, `lockedReason`, `prunable` y `prunableReason`; ninguno existente cambia de nombre ni de tipo. `parseWorktrees` queda exportada. `cleanupAuthorized: false` y el pie de limpieza manual no cambian. `start`, `guard`, `claim` y `release` conservan su contrato: lo único que cambia para ellos es que ya no pueden confundir un repositorio bare con el checkout principal.
- **Efecto en los demás Workers:** ninguno visible hoy, porque este checkout no es bare — y eso es precisamente el punto: el cambio quita un supuesto silencioso antes de que cueste un diagnóstico. Lo que sí se nota desde ya es que el informe de `finish` trae dos datos más para el paso de limpieza, que hoy se hace sin ellos.
- **Integración y producción:** integrar a `main` **dispara el deploy de producción en Vercel**, porque el `ignoreCommand` de `vercel.json` no excluye `scripts/**`. El artefacto de la app no cambia, pero la autorización de merge tiene que cubrir ese deploy. No hay migraciones y no se tocó producción ni Supabase.
- **Ownership:** el claim `nervous-tharp-418741` se libera al cerrar. La rama y el worktree se conservan; no se borra nada.
