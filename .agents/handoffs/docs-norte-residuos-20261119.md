# Handoff — residuos del back Norte fuera del allowlist de docs-agents-pruning (2026-11-19)

- **Owner:** `docs-norte-residuos-worker` · Sesión `ses_e0bf46e0cffeSNrw6ky6t7bHIx`.
- **Worktree:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\docs-norte-residuos`.
- **Rama:** `codex/docs-norte-residuos` · **Base:** `origin/main` @ `a6050cc8b` (idéntica; sin commits previos).
- **Coordinador:** Director (sesión de Sam). **SDD:** no aplica (harness/documentación).
- **Salida del claim (íntegra):** `Claim adquirido: docs-norte-residuos-worker` (guard previo: `Guard OK: C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\docs-norte-residuos`).
- **Autorización (Sam, 2026-11-19):** edición y pruebas dentro del allowlist; commits locales selectivos; push de la rama propia y apertura de PR (ese push no publica). NO autorizado: merge a main, deploy, migraciones/escritura de datos, filas de negocio/PII, tocar el Norte de diseño.

## OBJETIVO ORIGINAL

Limpiar los residuos del «back Norte» que quedaron fuera del allowlist de la tarea docs-agents-pruning (PR #706, abierta): la entrada huérfana de `.gitignore` y las 2 referencias de `docs/architecture/schema-reconciliation.md`, conservando `NORTE-CHANGELOG.md` por ser bitácora histórica.

## COMPLETADO

1. **`.gitignore` (línea 153):** retirada la entrada `docs/design/studio/_norte/backend/prisma/` — la carpeta fue retirada del diseño en la PR #706 y la entrada ya no protege nada. Solo se tocó esa línea (allowlist estricto); el diff lo confirma.
2. **`docs/architecture/schema-reconciliation.md` (líneas 8 y 54):** las dos citas a `_norte/backend/API-CONTRACT.md` quedaron como fuente histórica retirada: `API-CONTRACT.md` (fuente histórica retirada del repo en la PR #706; vive en git). Método, cifras y conclusiones del documento intactos (diff de exactamente esas 2 líneas). Nota: se omitió la ruta literal `_norte/backend/...` en el texto de reemplazo porque el grep de aceptación exige cero matches de ese patrón; la procedencia queda indicada en prosa.
3. **`docs/design/studio/NORTE-CHANGELOG.md` (líneas 439 y 443):** SIN tocar, conservado por diseño — es bitácora histórica (registro fechado de la consolidación v3). `git status` lo confirma: cero cambios.

## VALIDACIÓN

Comandos y resultados por comprobación (SHA observado: `a6050cc8b` + commits de esta rama):

- **`node scripts/harness-worktree.mjs guard`** — **PASÓ**: `Guard OK: C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\docs-norte-residuos`.
- **`node scripts/harness-worktree.mjs claim --owner docs-norte-residuos-worker`** — **PASÓ**: `Claim adquirido: docs-norte-residuos-worker`.
- **Grep de aceptación** `git grep -n -i -E "_norte/backend|backend/README" -- . ':!docs/specs' ':!.agents/handoffs' ':!docs/archive' ':!docs/design/studio/_norte' ':!docs/design/studio/NORTE-CHANGELOG.md'` — **PASÓ para las líneas de esta tarea**: mis 3 blancos editables (.gitignore:153, schema-reconciliation:8 y :54) ya no aparecen. En la base `origin/main` de esta rama el grep aún devuelve 3 matches (`AGENTS.md:32`, `docs/engineering/project-rules.md:334`, `docs/organizacion/organigrama-paperclip.md:1356`) cuya limpieza pertenece a la PR #706: verificado con `gh pr diff 706` que su rama ya los elimina (junto con `docs/design/studio/_norte/backend/README.md` y `API-CONTRACT.md`). El «cero matches» del criterio se cumple en el estado combinado tras integrar #706; esta rama y #706 tienen archivos disjuntos (el files de #706 no incluye `.gitignore` ni `schema-reconciliation.md`), sin conflictos.
- **`pnpm docs:check`** — **PASÓ** antes y después del cambio: `✓ docs:check — índice sincronizado con 663 specs` (663 specs en ambos corridos; el índice no cambia porque no se agregó ni retiró ningún doc indexado).
- **`git diff --check`** — **PASÓ** (sin salida; sin errores de whitespace).
- **`git status --porcelain`** — **PASÓ**: solo los archivos del allowlist (`M .gitignore`, `M docs/architecture/schema-reconciliation.md` + este handoff nuevo).
- **`pnpm verify`** — **NO EJECUTADO**: cambio docs-only (2 líneas de referencia en un doc de arquitectura) + 1 línea de `.gitignore` que retiraba una entrada que ya no protegía nada (la carpeta `prisma/` jamás fue trackeada). Sin cambios de código de producto, build, migraciones ni comportamiento; `docs:check` cubre el cierre documental aplicable.

## COMMITS

- `docs(norte)`: retiro de entrada prisma huérfana y API-CONTRACT como fuente histórica (`.gitignore` + `docs/architecture/schema-reconciliation.md`).
- `chore(handoff)`: commit que contiene este documento (hashes finales registrados en la PR).

## PR / BRANCH

- Rama: `codex/docs-norte-residuos` (push a sí misma; base `main`). Worktree: `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\docs-norte-residuos`.
- PR: ver URL actualizada en la conversación de entrega / `gh pr list --head codex/docs-norte-residuos`. Archivos de esta PR disjuntos de los de #706.

## PENDIENTES DE ESTA TAREA

- Ninguno para la aceptación de esta rama. Integración a `main` la decide el Director (puede ordenarla antes o después de #706; sin conflictos entre ambas).

## FUERA DE ALCANCE DETECTADO

- **3 matches restantes del grep en main** (`AGENTS.md:32`, `docs/engineering/project-rules.md:334`, `docs/organizacion/organigrama-paperclip.md:1356`): ya eliminados en la rama de la PR #706 (evidencia: `gh pr diff 706`). No se tocan aquí por allowlist; bastará integrar #706.
- **Comentario huérfano en `.gitignore` (líneas ~150–152):** el bloque de comentario que explicaba la entrada `backend/prisma/` («Blueprint Prisma que Cloud Design re-incluye…») quedó sin su entrada. El allowlist permitía solo la línea de la entrada, así que se conservó. Candidato a limpieza futura si el Director lo aprueba (nota: el comentario no contiene los patrones del grep de aceptación).
- **`pnpm` WARN del campo `pnpm` en `package.json`** («pnpm.onlyBuiltDependencies» ya no se lee): hallazgo de tooling menor, sin relación con esta tarea; se reporta sin actuar.

## HANDOFF AL DIRECTOR

- Siguiente acción: revisar diff (3 archivos: 1 línea .gitignore, 2 líneas schema-reconciliation, handoff) y decidir orden de integración respecto a #706. Sin dependencias duras entre ambas PRs (archivos disjuntos); el criterio de grep-cero queda completo al tener ambas en main.
- CI: PR publicada como lista; validar la corrida `quality.yml` sobre la cabeza exacta según runbook (corrida `pull_request` más reciente, `success` no `skipped`).
- Contratos compartidos: ninguno (no hay cambios de API/schema/UI).
- Ownership: liberado con `node scripts/harness-worktree.mjs release --owner docs-norte-residuos-worker` al terminar la escritura (salida registrada en la conversación de entrega). Worktree y rama conservados.
