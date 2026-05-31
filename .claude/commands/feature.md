---
description: Corre el bucle del harness (implement → verify → review) sobre una spec/feature de DTD Cargo, en orden fijo.
---

# /feature — bucle del harness DTD Cargo

Orquesta una feature de punta a punta con orden **estructural** (no confía en que un agente "se acuerde" de verificar o revisar).

**Argumento:** la spec/feature a implementar — ej. `/feature 0039 helper de consolidación USD`.

## Procedimiento (seguir al pie de la letra)

1. **Pre-check.** Corré `node scripts/verify.mjs`. Si está 🔴 → PARÁ y reportá (el repo debe estar verde antes de empezar). Leé `AGENTS.md`, la spec indicada y `.harness/CHECKPOINTS.md`.

2. **Implement.** Lanzá el subagente `implementer` con la spec/feature. Esperá su respuesta de una línea: `done -> .harness/progress/impl_<feature>.md` (o `blocked -> …`).

3. **Verify (gate).** Corré `node scripts/verify.mjs`.
   - 🔴 rojo → devolvé el error al `implementer` para que corrija (sin cambiar el scope). Repetí.
   - 🟢 verde → seguí al review.

4. **Review.** Lanzá el subagente `reviewer`. Leé su veredicto en `.harness/progress/review_<feature>.md`.
   - `CHANGES_REQUESTED` → devolvé los findings al `implementer` (volvé al paso 2).
   - `APPROVED` → seguí al cierre.

5. **Cierre.** El `implementer` actualiza el spec SDD (spec-anchored). Resumí al founder: qué se hizo, qué validó el reviewer, y proponé el commit (`feat(studio): SDD-NNNN — …`). **NO commitees ni `git push` sin OK del founder.**

6. **Freno.** Máximo **3 rondas** implement↔review. Si se agotan sin verde+aprobado → PARÁ y mostrá al founder dónde se trabó. **No fuerces un `done`.**

## Invariantes
- El orden `implement → verify → review` es fijo. El `reviewer` NUNCA corre antes de que `node scripts/verify.mjs` pase.
- Estado efímero en `.harness/progress/` (gitignored). Historia permanente en `git log`.
- Nunca: migraciones a prod · cruzar/relajar la frontera público↔ERP · `git push` / deploy automático.
