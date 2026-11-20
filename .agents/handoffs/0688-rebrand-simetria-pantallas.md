# Handoff — SDD-0688 · Simetría de pantallas del Studio

- Fecha: 2026-11-20
- Owner: Worker «Rebrand Design» (Claude Code), bajo el Director General
- Worktree: `.claude/worktrees/rebrand-design-aa6ba9`
- Rama: `claude/sdd-0688-simetria-pantallas` (parte de `claude/rebrand-design-aa6ba9` más `origin/main` `2ea18799a`)
- SDD: `docs/specs/0688-rebrand-simetria-pantallas/spec.md`, estado `proposed`. Reserva del Director: `codex/sdd-reserve-0688` (`0bf583338`).
- Estado de tarea: **spec escrita; ninguna fase implementada.** Sin push, sin PR.
- Permisos: commits locales selectivos. Push y PR, con orden del Director. Sin merge, sin producción, sin base de datos.

## OBJETIVO ORIGINAL

Sam pidió el 2026-11-20 que el ERP se vea simétrico en todas las secciones, con reglas de botones, de títulos y de mensajes. No elige pantallas: «todas las vamos a cambiar». Citas literales en la spec, §1.

## COMPLETADO

- Spec real de la SDD-0688: medición del problema, políticas aprobadas que solo se adoptan (VIS-02, TBL-01, BTN-01, LOD-01, ERR-01, FRM-01, CMP-01), once reglas nuevas que aprueba Sam, diez piezas compartidas, nueve fases con orden de grupos de módulos, allowlist de la fase 1, aceptación por contrato y gate VIS-01.
- Índice de specs regenerado (`docs/specs/README.md`).

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `docs:check` (con `node scripts/build-docs-index.mjs --check`) | **PASÓ** (668 specs) |
| `sdd:check` (con `node scripts/check-numbering.mjs`) | **PASÓ** |
| `governance:check`, `verify`, vitest, build | **NO EJECUTADO**: no hay cambio de producto ni de políticas. Requieren `pnpm install` en este worktree, con turno del Director |
| Recorrido visual | **NO EJECUTADO**: las cifras son conteos de código |

## PENDIENTE DE ESTA TAREA

1. Va **después** de SDD-0686 y SDD-0687.
2. Decisiones de Sam (spec §11): las nueve reglas de botones y mensajes, los tres anchos de panel, si se extiende al Portal y cuáles extras entran.
3. Fase 1 (reglas en políticas); luego fases 2 a 9, cada una con su allowlist y su PR.
4. Localizar el texto normativo de AVS-01: el registro la da por «verificada», pero no hay archivo en `docs/governance/policies/`.

## FUERA DE ALCANCE DETECTADO

- A 375 px el menú lateral del Studio ocupa casi toda la pantalla (no conformidad ya anotada en SDD-0603). Esta spec no la resuelve.
- Los siete archivos detenidos por la PR #318 (SDD-0603) siguen fuera.
