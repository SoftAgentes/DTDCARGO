# Handoff — «No hay respuesta para "no sé"»: el principal dejó de elegirse a ciegas

Fecha: 2026-09-12. Task ID: `principal-sin-inferir`.
Owner / sesión escritora: `principal-sin-inferir` (Worker Claude Code). Sin subagentes.

Estado: lista-para-revision. **No está integrada.** La PR es la frontera; el merge lo decide el Director.

## Aislamiento y estado

- **Worktree:** `.claude/worktrees/principal-sin-inferir`, creado con `git worktree add` porque la herramienta de la app solo entra a worktrees bajo ese contenedor; `guard` OK y claim `principal-sin-inferir` tomado antes de editar.
- **Rama:** `codex/principal-sin-inferir`.
- **BASE: `ff6f2a9c`, NO `origin/main` — desviación declarada.** El runbook manda nacer de `origin/main`; esta rama nace del head de la PR #97 (SDD-0458) por dependencia real de código: el rediseño cambia cómo se deriva el principal, y ese valor alimenta `resolveCandidate` y `worktreeContainers`, que solo existen en #97. Lo decidió el Director tras revisar #97 entera y comprometerse a no pedirle cambios. **Cuando #97 esté en `main`, integrar `main` — no la rama de #97.**
- **SDD-0459**, reservado con `corepack pnpm sdd:next --reserve principal-sin-inferir` (`refs/dtd/reservations/0459`, 215 refs, sin colisión con 0458). Stub incorporado con cherry-pick. La ref de reserva queda sin publicar: la PR lleva la spec.
- **No se tocó:** producción, Supabase, migraciones, `app/`, `lib/`, `.claude/settings.json`. Sin `git add -A`, sin force push. **La rama de #97 quedó intacta en `ff6f2a9c`.**

## Archivos tocados (todos, no solo el centro)

1. `scripts/harness-worktree.mjs` — el arreglo.
2. `scripts/tests/harness-worktree.node.mjs` — dos pruebas nuevas y un ajuste de aserción.
3. `docs/specs/0459-principal-sin-inferir/spec.md` — spec completa (el stub reservado, reescrito).
4. `docs/specs/README.md` — índice regenerado con `docs:index` (433 specs).
5. `.agents/handoffs/principal-sin-inferir.md` — este archivo.

**`docs/runbooks/codex-engineering.md` NO se tocó**, y es deliberado: el runbook describe el flujo normal del repo, que no es bare, y el caso nuevo no aparece en ninguno de sus pasos. Si el Director prefiere una línea ahí, la agrego.

## Qué estaba mal

`entries[0]` de `git worktree list` se tomaba como checkout principal. **La posición no era el defecto**: medido con git 2.55 y worktrees creados en orden no alfabético —incluido uno llamado `aaa`—, el principal se lista primero siempre, desde donde sea. Lo que faltaba era **preguntar si existe un principal**. Cuando el repo común es bare no existe: `entries[0]` es el propio `repo.git`.

**El arreglo que proponía el encargo era peor que el defecto.** Medido, desde un árbol de Worker legítimo:

| | código actual | con «descartar la entrada bare» como `next-number.mjs:50` |
| --- | --- | --- |
| `guard` | `Guard OK` | **«el checkout principal no es un workspace de implementación»** |
| `finish` sin nombre | informa bien | **«estás en el checkout principal (…/dos)»** |

Bloquearía a un Worker en su propio árbol. `next-number.mjs` descarta `bare` porque no le importa cuál es el principal; acá sí importa.

**Y la vía obvia de detección falla en silencio:** `git rev-parse --is-bare-repository` devuelve **`false`** desde un worktree linked de un repo bare. Es lo primero que uno prueba y confirma la hipótesis equivocada.

## Qué se hizo

`mainWorktreeFrom(entries, commonDir)` —pura y exportada— devuelve la ruta del principal o **`null`** cuando no hay ninguno verificable, con una sola condición: el principal es el árbol cuyo `.git` es el directorio común (`dirname(--git-common-dir) === entries[0]`). Y ningún consumidor contesta igual con `null` que sin él: `start` y `finish <nombre>` **se niegan nombrando el motivo y la salida**; `guard` y `finish` sin nombre siguen funcionando porque no lo necesitan. La entrada `bare` nunca es candidato.

`finish` sigue siendo solo informe y ningún campo del JSON cambió de nombre ni de tipo.

**La mutación borró código en vez de agregar pruebas.** Dos guardas de la primera versión —el flag `bare` dentro de `mainWorktreeFrom` y un chequeo de que el common-dir se llamara `.git`— sobrevivieron a sus mutantes: no cambiaban ningún resultado, porque la comparación sola ya cubre el caso. Se borraron. Al quitar el chequeo del nombre se vio además que la prueba que esperaba `null` para `<principal>/otro-dir` estaba fijando ese chequeo y no una verdad del dominio; ahora espera `principal`, que es lo correcto.

## Validación

| comprobación | resultado |
| --- | --- |
| `corepack pnpm harness:test` (Windows) | PASÓ — 85/85 |
| `node --test` sobre el archivo tocado | PASÓ — 8/8, incluidas las 6 de SDD-0457/0458 sin tocarlas |
| `corepack pnpm docs:check` | PASÓ — 433 specs |
| `corepack pnpm sdd:check` | PASÓ — sin números repetidos |
| `eslint` sobre los 2 archivos de código | PASÓ — 0 problemas |
| `git diff --check` | PASÓ |
| comportamiento contra un repo `--bare` real y contra DTDCARGO | PASÓ |
| `corepack pnpm verify` | **NO EJECUTADO** — su paso `e2e` exige Supabase, que esta sesión no tiene |
| CI alojado | **PENDIENTE** — se registra por mensaje al Director, no con otro push |

**Seis mutantes** dejan rojo la prueba que les toca. Los dos que sobrevivieron en la primera ronda no se taparon con más pruebas: señalaban código que no hacía falta y se borró.

**Pruebas de producto que no aplican.** El cambio vive en `scripts/` y ninguna ruta de `app/`, `lib/` ni `supabase/` importa este archivo: `playwright`, `typecheck`, `rsc-boundary`, `components:check`, `governance:check`, `edge:check`, `sql-tests`, `schema-rebuild` y `migrations-applied` no aplican. Tampoco `/ui-check` (no hay UI) ni `revisar-datos-ve` (no se trata dato personal alguno).

## Pendientes de esta tarea

1. Publicar y abrir la PR. **Una vez publicada, la rama se congela**: el resultado del CI se le manda al Director por mensaje, no con otro commit.
2. Integrar `main` cuando #97 aterrice, y resolver ahí una sola vez.
3. Liberar el claim al cerrar la escritura.
4. **Integración: del Director.**

## FUERA DE ALCANCE DETECTADO

1. **`locked` y `prunable` del porcelain siguen sin exponerse.** El Director los quiere para la limpieza de worktrees y quedó como tarea suya, separada a propósito para que no espere este rediseño.
2. **`finish --dry-run` se acepta y no hace nada**, porque `finish` siempre es informe.
3. **Un repo con `--separate-git-dir` fuera del árbol quedaría «sin principal»** y `start` se negaría. Es fail-closed y coherente, pero **no está medido**: no se probó un repo así. Si alguien usa ese setup, es la primera piedra con la que va a tropezar.
4. **El caso bare no se ejerce en este repo.** Todo lo de arriba se sostiene en el fixture, no en uso real de DTDCARGO.
