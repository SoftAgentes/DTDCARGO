# Handoff — SDD-0685: marcar históricas las referencias al back Norte

- **Owner / sesión:** Worker (Claude), lanzado por Director DTD · 2026-11-22
- **Ruta / rama:** `.claude/worktrees/nifty-stonebraker-d97e28` · `claude/nifty-stonebraker-d97e28` (base `b0218800c`)
- **SDD:** [0685](../../docs/specs/0685-norte-referencias-historicas/spec.md) · **Carril:** rápido (solo docs; `node scripts/carril.mjs` lo confirma en la PR)

## OBJETIVO ORIGINAL
Retomar el stub de la rama `codex/docs-norte-historico-0685` (commit `9febde239`, 2026-11-19, sin PR) y marcar como históricas las referencias vivas al back Norte.

## COMPLETADO
- Stub revisado; el 0685 no lo usa otra spec en main (hueco en el correlativo; `origin/main` solo tiene 0684 y 0686). La #706 (retiro del back Norte) está fusionada desde el 2026-11-19.
- Inventario en `b0218800c`: `git grep -n "backend/" -- docs/design/studio/_norte` → 31 líneas en 15 archivos (coinciden con el allowlist del stub; CLAUDE.md corrió de 386/423 a 393/430). `CHANGELOG.md:1875` es falsa positiva, excluida.
- 31 marcas insertadas con la nota exacta del stub, justo tras la última referencia `backend/…` de cada línea. Texto original intacto.
- Spec completada (contexto, alcance, qué sigue vigente, archivos, exclusiones, criterios).

## VALIDACIÓN
| Comprobación | Resultado |
|---|---|
| Quitar la marca de cada línea nueva reproduce la original (31 líneas, 0 anomalías) | PASÓ |
| `git grep "backend/"` en `_norte` sin marca | PASÓ (solo `CHANGELOG.md:1875`, falso positivo) |
| `git diff --check` | PASÓ |
| `pnpm docs:check`, `pnpm sdd:check` | PENDIENTE: esperan turno de PC de Director |
| `pnpm verify` | NO APLICA: solo documentación; los dos `.jsx` cambian únicamente comentarios |
| CI de la PR | PENDIENTE |

## COMMITS
Ver PR.

## PR / BRANCH
Pendiente de abrir (ver mensaje a Director).

## PENDIENTES DE ESTA TAREA
Correr docs:check/sdd:check, abrir PR, CI en verde, avisar a Director número y cabeza.

## FUERA DE ALCANCE DETECTADO
- La rama `codex/docs-norte-historico-0685` (stub) queda como reserva ya cumplida: borrarla cuando la 0685 esté en main (Director decide).
- El id de sesión `local_8306aa01-…` que venía en el encargo como Director no existe; la comunicación fue con `local_25e2dded-…` («Director DTD»).

## HANDOFF AL DIRECTOR
Impacto documental: spec 0685 y 31 marcas en el prototipo Norte; AGENTS/project-rules sin cambios. Riesgo conocido: un NORTE-SYNC futuro puede pisar las marcas; se reaplican (documentado en la spec). Conocimiento nuevo propuesto: ninguno.
