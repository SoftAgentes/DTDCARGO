# Handoff — `finish` cubre también los worktrees de `.claude/worktrees/`

Fecha: 2026-09-12. Task ID: `finish-claude-worktrees`.
Owner / sesión escritora: `cranky-yonath-83f00c` (Worker Claude Code). Sin subagentes.

Estado: lista-para-revision. **No está integrada.** La PR es la frontera; el merge lo decide el Director.

## Aislamiento y estado

- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/cranky-yonath-83f00c`.
  La sesión ya lo recibió aislado —es justamente uno de los worktrees que esta tarea arregla—, así que **no** se creó otro con `start`: anidar habría duplicado el aislamiento existente. `claim --owner cranky-yonath-83f00c` tomado antes de editar.
- **Rama:** `claude/youthful-driscoll-120aae`, nacida en `ce023926` (`main` al arrancar). Después de publicar, `main` avanzó con la PR #77 (L06 documentos Portal) y se integró `origin/main` `f93c0f2c` en la rama: el único solapamiento era `docs/specs/README.md`, que resolvió el driver `dtd-generated-records` sin conflicto, y `docs:check` quedó en verde con 432 specs y las dos filas (0342 y 0458) presentes. Nada de L06 se tocó.
- **SDD:** `docs/specs/0458-harness-finish-claude-worktrees/spec.md`, en `done`.
  - Reservado con `corepack pnpm sdd:next --reserve harness-finish-claude-worktrees`: creó `refs/dtd/reservations/0458` y `refs/heads/codex/sdd-reserve-0458-harness-finish-claude-worktrees` sobre `origin/main`, sin tocar HEAD. El inventario previo dio 0458 libre sobre 209 refs y worktrees; las advertencias de colisión que imprime son históricas y de la PR #21, ajenas a esta tarea.
  - El stub se movió a la rama con `git cherry-pick` (`d3f257a7`). La rama de reserva y su lock quedan intactos y **sin publicar**: la PR lleva la spec, así que el número ya es visible.
  - Índice regenerado con `docs:index`: 431 specs.
- **No se tocó:** producción, Supabase, migraciones, `app/`, `lib/`, `.claude/settings.json`. Sin `git add -A`, sin force push, sin cambios en ramas ajenas.

## Qué estaba roto y qué se hizo

`finish` resolvía el candidato armando la ruta con `worktreePathFor`, así que solo existía para él `<padre-del-checkout>/DTD-worktrees/<slug>`. Reproducido acá el 2026-09-12 antes de tocar nada, y confirmando que **no es regresión de la PR #94 (SDD-0457)**: el control sobre `DTD-worktrees/` pasa igual antes y después.

| invocación | antes | después |
| --- | --- | --- |
| `finish` (sin argumento) | exit 1, «Slug inválido» | exit 0, informe del worktree actual |
| `finish cranky-yonath-83f00c` | exit 1, «El candidato no es un worktree registrado y disponible» | exit 0, informe |
| `finish c-l17-verificar-throttle` (control) | exit 0 | exit 0 |
| `finish no-existe` | exit 1, mensaje genérico | exit 1, nombra el pedido y lista los candidatos |
| `finish` desde el checkout principal | exit 1, «Slug inválido» | exit 1, dice que el principal nunca es candidato |

El arreglo: `resolveCandidate` —pura y exportada— resuelve contra `git worktree list`, con `worktreeContainers` como **filtro de pertenencia** de los dos contenedores, nunca como fuente de rutas. El nombre se **compara** con `path.basename` de entradas ya registradas y jamás se concatena, así que ningún traversal alcanza nada. Sin argumento, informa sobre el worktree donde se corre. `start` no cambió: sigue creando siempre en `DTD-worktrees/<slug>`.

**`finish` sigue siendo solo informe:** no borra worktrees ni ramas, no poda, no publica; `cleanupAuthorized: false` y el pie sobre limpieza manual del Director quedan como estaban, y ningún campo del JSON cambia de nombre ni de tipo. Lo único que cambia en la salida es que `candidate` ya puede apuntar a `.claude/worktrees/`.

## Validación

| comprobación | resultado |
| --- | --- |
| `corepack pnpm harness:test` (Windows) | PASÓ — 12 archivos, 83/83 |
| `harness-worktree` + `harness-spawn` en Linux (`node:24`, repo armado en el contenedor) | PASÓ — 9/9 |
| `corepack pnpm docs:check` | PASÓ — 431 specs |
| `corepack pnpm sdd:check` | PASÓ — sin números repetidos |
| `corepack pnpm lint` | PASÓ — 0 errores (8 warnings preexistentes en `app/`, ajenos) |
| `eslint` sobre los 2 archivos tocados | PASÓ — 0 problemas |
| `git diff --check` | PASÓ |
| `corepack pnpm verify` | **NO EJECUTADO** — su paso `e2e` exige Supabase, que esta sesión no tiene |
| CI alojado sobre `7aefc71c` | PASÓ — los 4 checks, «Calidad local sin secretos» en 14m38s |
| CI alojado sobre `ff6f2a9c` | PASÓ — los 4 checks, «Calidad local sin secretos» en 8m51s ([run 34675256173](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/34675256173)) |
| `docs:check` tras el segundo merge de `main` | PASÓ — 436 specs, con la fila 0458 |

**Siete mutantes** dejan rojo exactamente la prueba que les toca: quitar el contenedor `.claude/worktrees`; que sin nombre deje de mirar el worktree actual; devolver al checkout principal a la lista de candidatos; armar la ruta con `path.join(contenedor, nombre)`; elegir el primero ante un nombre ambiguo; volver al mensaje genérico; y dejar de distinguir un candidato registrado pero ausente en disco. **El séptimo sobrevivió en la primera ronda**: la prueba que lo mata se escribió por eso.

**Pruebas de producto que no aplican.** El cambio vive en `scripts/` y ninguna ruta de `app/`, `lib/` ni `supabase/` importa este archivo: `playwright`, `typecheck`, `rsc-boundary`, `components:check`, `governance:check`, `edge:check`, `sql-tests`, `schema-rebuild` y `migrations-applied` no aplican. Tampoco `/ui-check` (no hay UI) ni `revisar-datos-ve`: el informe nombra rutas de archivos, nunca su contenido, y no se trata dato personal alguno.

**Dos trampas de entorno, ninguna del cambio.** (1) En Windows `tmpdir()` devuelve la forma 8.3 (`AKXGEN~1`) y git siempre la ruta larga; `fs.realpathSync` **no** expande el 8.3 y `fs.realpathSync.native` sí — el fixture ahora usa `.native`. (2) La primera corrida en Linux dejó rojo `harness-spawn` con un repo de tres archivos: su aserción mide un listado de más de 1 KB. Con 805 archivos rastreados pasan las dos suites. Se copiaron los archivos al contenedor en vez de montar el worktree, porque su `.git` es un archivo que apunta a una ruta de Windows y git ahí devuelve 128 (lección de SDD-0457).

## Pendientes de esta tarea

1. ~~Publicar la rama y abrir la PR~~ — hecho: [PR #97](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/97), autorizada por el encargo, que pone la PR como frontera.
2. ~~Esperar el CI alojado~~ — hecho, y dos veces: verde sobre `7aefc71c` y sobre `ff6f2a9c`.
2b. **Dos merges más de `main`**, ambos pedidos por el Director el 2026-09-12 y resueltos sin conflicto por el driver `dtd-generated-records`:
   - `1c065bc4` — las seis migrate-first, 33 archivos. Se preparó local y **no se publicó**, porque #96 se había liberado sobre la misma base y publicar las dos a la vez haría correr dos CI para fusionar una sola.
   - `62f0f6f0` — #96 ya fusionada, un solo archivo de handoff ajeno.
   `docs:check` da **436 specs** con la fila 0458, el número que el Director predijo, medido y no asumido. Ninguno de los dos merges tocó `scripts/harness-worktree.mjs` ni su prueba (`git diff ff6f2a9c HEAD --` sobre esos dos archivos sale vacío); `scripts/` sí recibió `check-public-verify-concurrency.mjs`, ajeno y ya fusionado en main.
   **Límite de la revalidación:** la rama ahora contiene producto ajeno llegado con los merges (`app/`, `lib/`, `supabase/`) y la validación local **no lo cubre** — se corrió el harness, no `pnpm test` ni las pruebas SQL. Cada una de esas PRs pasó su propio CI antes de entrar a `main`, y el CI de esta rama las corre todas; esa cobertura existe pero **no la produjo esta sesión**.
3. ~~Liberar el claim~~ — hecho al cerrar la sesión de escritura.
4. **Integración: del Director.** No se mergea desde acá. Falta decidir si se espera una corrida del CI sobre el head final antes de integrar.

## FUERA DE ALCANCE DETECTADO

No se tocó nada de esto; queda anotado con evidencia para que el Director decida.

1. **`finish` ignora `locked` y `prunable` del porcelain.** `git worktree list --porcelain` los expone y `worktrees()` solo lee `worktree` y `branch` ([scripts/harness-worktree.mjs:60](scripts/harness-worktree.mjs:60)). Un worktree bloqueado se informa como cualquier otro; uno ausente en disco se rechaza por `existsSync`, no por lo que git diga. Sería evidencia útil para el paso 4 del cleanup.
2. **`worktrees()` no descarta entradas `bare`,** mientras que `scripts/next-number.mjs:50` sí lo hace (`if (fields.includes("bare")) continue;`). Asimetría real entre dos lectores del mismo porcelain; no afecta a DTDCARGO porque su checkout principal no es bare, pero la suposición «`entries[0]` es el principal» depende de eso.
3. **`finish --dry-run` se acepta y no hace nada:** `finish` siempre es informe. La bandera queda en la ayuda sugiriendo una diferencia que no existe.
4. **`finish` sigue pidiendo `git status --untracked-files=all` para calcular un booleano** (heredado de SDD-0457, riesgo 4 de esa spec). Ya no revienta, pero materializa un árbol grande para nada.
5. **8 warnings de eslint preexistentes en producto** (`react-hooks/set-state-in-effect` y compañía), ajenos a esta tarea y anteriores a ella.
