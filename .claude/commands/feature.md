---
description: Corre el bucle del harness (implement → verify → review) sobre una spec/feature de DTD Cargo, en orden fijo.
---

# /feature — bucle del harness DTD Cargo

Orquesta una feature de punta a punta con orden **estructural** (no confía en que un agente "se acuerde" de verificar o revisar).

**Argumento:** la spec/feature a implementar — ej. `/feature 0039 helper de consolidación USD`.

## Procedimiento (seguir al pie de la letra)

0. **Aislamiento (worktree).** Confirma que estás en el worktree del lane, **NO en `main`**: `git branch --show-current` debe dar `codex/<slug>` (o `feat/<slug>` heredada), no `main`.
   - Si estás en `main` (o la carpeta principal `DTDCargo`) → **PARÁ.** Una feature nueva NO se implementa en `main` (ahí se mezcla con todo y choca con otras ventanas). Creá el lane aislado: `node scripts/harness-worktree.mjs start <slug>`, abrí una ventana en `DTD-worktrees/<slug>`, y corré `/feature` **ahí**.
   - El gate `node scripts/verify.mjs` corre igual desde cualquier worktree. `start` usa origin/main actual, no copia entorno e instala con `pnpm install --frozen-lockfile`; si falla, el worktree permanece pero no está listo.
   - ⚠️ Plan mode NO crea el worktree solo — este paso es manual (o vía `start`).

1. **Pre-check.** Corré `node scripts/verify.mjs`. Si está 🔴 → PARÁ y reportá (el repo debe estar verde antes de empezar). Leé `AGENTS.md`, la spec indicada y `.harness/CHECKPOINTS.md`.

2. **Implement.** Lanzá el subagente `implementer` con la spec/feature. Esperá su respuesta de una línea: `done -> .harness/progress/impl_<feature>.md` (o `blocked -> …`).

3. **Verify (gate).** Corré `node scripts/verify.mjs`.
   - 🔴 rojo → devolvé el error al `implementer` para que corrija (sin cambiar el scope). Repetí.
   - 🟢 verde → seguí al review.
   - El `implementer` repara con un **bucle interno acotado** (protocolo Reflexion: tope DURO de **5 intentos** sobre la misma falla + log de hipótesis en `.harness/progress/reflexion_<feature>.md`). Si agota los 5 sin verde → devuelve `blocked`; **no se fuerza un `done`**.

4. **Review.** Lanzá el subagente `reviewer`. Leé su veredicto en `.harness/progress/review_<feature>.md`.
   - `CHANGES_REQUESTED` → devolvé los findings al `implementer` (volvé al paso 2).
   - `APPROVED` → seguí al cierre.

5. **Cierre.** El `implementer` actualiza el spec SDD (spec-anchored). Resume al founder qué se hizo, qué validó el reviewer y el commit propuesto (`feat(studio): SDD-NNNN — …`). **NO hacer commit ni push sin su OK.** Integración/publicación/limpieza respetan el rol y el GO del [runbook](../../docs/runbooks/git-worktrees-multiventana.md); un worker Codex no integra ni se retira a sí mismo. El cierre autorizado se ejecuta desde main principal limpio/actual, después de comprobar externamente inactividad y preservación: `node scripts/harness-worktree.mjs finish <slug> --confirm-idle <HEAD_COMPLETO_VERIFICADO> --handoff <HANDOFF_RELATIVO> --delete-branch --dry-run`. Los marcadores se sustituyen por valores comprobados; sólo retirar `--dry-run` con todas las condiciones satisfechas. Ignorados bloquean y requieren preservación/retiro previo separado. No hay force, fallback long-path, merge ni push automático.

6. **Freno (dos topes duros).** Externo: máximo **3 rondas** implement↔review. Interno: máximo **5 intentos** en el bucle de reparación del `implementer` (Reflexion). Si se agota cualquiera sin verde+aprobado → PARÁ y mostrá al founder dónde se trabó. **No fuerces un `done`.** (Ninguno de los dos es un proceso de fondo: son pasadas que se cortan solas al tope; nada queda corriendo.)

## Invariantes
- Una feature nueva vive en **su worktree** (`harness-worktree start <slug>`), nunca directo en `main`. El número de SDD/migración se elige mirando **todas** las ramas/worktrees, no solo el índice de `main`.
- El orden `implement → verify → review` es fijo. El `reviewer` NUNCA corre antes de que `node scripts/verify.mjs` pase.
- Estado efímero en `.harness/progress/` (gitignored). Historia permanente en `git log`.
- Nunca: migraciones a prod · cruzar/relajar la frontera público↔ERP · `git push` / deploy automático.
